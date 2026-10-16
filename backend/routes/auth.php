<?php
/** @var Router $router */

// POST /api/auth/login
$router->post('/auth/login', function () {
    $d = validate([
        'username' => 'required|max:50',
        'password' => 'required|max:255',
    ]);
    $generic = 'Invalid username or password.';

    $u = one(
        "SELECT u.*, r.role_code FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.username = ?",
        [$d['username']]
    );

    if (!$u) {
        audit('LOGIN_FAILED', 'users', null, null, ['username' => $d['username'], 'reason' => 'unknown user'], null);
        fail(401, $generic);
    }
    if ($u['account_status'] === 'Locked') {
        fail(423, 'This account is locked. Please contact the System Administrator.');
    }
    if ($u['account_status'] !== 'Active') {
        fail(403, 'This account is inactive. Please contact the System Administrator.');
    }

    if (!password_verify($d['password'], $u['password_hash'])) {
        audit('LOGIN_FAILED', 'users', $u['user_id'], null, ['reason' => 'wrong password'], (int) $u['user_id']);

        // Count recent failures (since the later of: the window start, or the account's last change/login)
        $failures = (int) val(
            "SELECT COUNT(*) FROM audit_logs
              WHERE user_id = ? AND action = 'LOGIN_FAILED'
                AND created_at >= GREATEST(NOW() - INTERVAL ? MINUTE, ?)",
            [$u['user_id'], (int) cfg('login_window_minutes'), $u['updated_at']]
        );
        $max = (int) cfg('max_login_attempts');
        if ($failures >= $max) {
            q("UPDATE users SET account_status = 'Locked' WHERE user_id = ?", [$u['user_id']]);
            audit('ACCOUNT_LOCKED', 'users', $u['user_id'], ['account_status' => 'Active'], ['account_status' => 'Locked'], (int) $u['user_id']);
            fail(423, "Too many failed attempts. The account has been locked. Please contact the System Administrator.");
        }
        $left = $max - $failures;
        fail(401, $generic, ['attempts_left' => $left]);
    }

    session_regenerate_id(true); // prevent session fixation
    $_SESSION = ['user_id' => (int) $u['user_id'], 'last_activity' => time()];
    q("UPDATE users SET last_login_at = NOW() WHERE user_id = ?", [$u['user_id']]);
    audit('LOGIN', 'users', $u['user_id'], null, null, (int) $u['user_id']);

    return ['user' => current_user(true)];
});

// POST /api/auth/logout
$router->post('/auth/logout', function () {
    if ($id = uid()) {
        audit('LOGOUT', 'users', $id);
    }
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    return ['ok' => true];
});

// GET /api/auth/me
$router->get('/auth/me', function () {
    return ['user' => current_user()];
});

// POST /api/auth/change-password
$router->post('/auth/change-password', function () {
    $u = require_login();
    $d = validate([
        'current_password' => 'required',
        'new_password' => 'required|min:8|max:72',
        'confirm_password' => 'required',
    ]);
    if ($d['new_password'] !== $d['confirm_password']) {
        fail(422, 'Please correct the highlighted fields.', ['confirm_password' => 'Passwords do not match.']);
    }
    if (!preg_match('/[A-Za-z]/', $d['new_password']) || !preg_match('/\d/', $d['new_password'])) {
        fail(422, 'Please correct the highlighted fields.', ['new_password' => 'Password must contain letters and numbers.']);
    }
    $hash = val("SELECT password_hash FROM users WHERE user_id = ?", [$u['user_id']]);
    if (!password_verify($d['current_password'], $hash)) {
        fail(422, 'Please correct the highlighted fields.', ['current_password' => 'Current password is incorrect.']);
    }
    q("UPDATE users SET password_hash = ?, updated_by = ? WHERE user_id = ?", [password_hash($d['new_password'], PASSWORD_BCRYPT), $u['user_id'], $u['user_id']]);
    audit('PASSWORD_CHANGED', 'users', $u['user_id']);
    return ['message' => 'Password updated successfully.'];
});
