<?php
/**
 * Session-based authentication and role/permission checks.
 */

function start_session(): void
{
    session_name('SSISSESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,                    // JavaScript cannot read the cookie (XSS protection)
        'samesite' => 'Lax',                   // basic CSRF protection
        'secure' => !empty($_SERVER['HTTPS']), // HTTPS-only cookie in production
    ]);
    session_start();

    // Inactivity timeout
    $timeout = (int) cfg('session_timeout_minutes') * 60;
    if (!empty($_SESSION['user_id']) && isset($_SESSION['last_activity']) && time() - $_SESSION['last_activity'] > $timeout) {
        $_SESSION = [];
        session_regenerate_id(true);
        $_SESSION['expired'] = true;
    }
    $_SESSION['last_activity'] = time();
}

/** The logged-in user with role, permissions and profile, or null. */
function current_user(bool $refresh = false): ?array
{
    static $cache = false;
    if ($cache !== false && !$refresh) {
        return $cache;
    }
    $cache = null;
    if (empty($_SESSION['user_id'])) {
        return null;
    }

    $u = one(
        "SELECT u.user_id, u.username, u.account_status, u.last_login_at, r.role_id, r.role_code, r.role_name
           FROM users u JOIN roles r ON r.role_id = u.role_id
          WHERE u.user_id = ?",
        [$_SESSION['user_id']]
    );
    if (!$u || $u['account_status'] !== 'Active') {
        $_SESSION = [];
        return null;
    }

    $u['permissions'] = array_column(all(
        "SELECT p.permission_code FROM role_permissions rp
           JOIN permissions p ON p.permission_id = rp.permission_id
          WHERE rp.role_id = ? ORDER BY p.permission_code",
        [$u['role_id']]
    ), 'permission_code');

    $u['student'] = one(
        "SELECT s.*, p.program_code, p.program_name, d.department_id, d.department_code, d.department_name, d.office_id AS department_office_id
           FROM students s
           JOIN programs p ON p.program_id = s.program_id
           JOIN departments d ON d.department_id = p.department_id
          WHERE s.user_id = ?",
        [$u['user_id']]
    );
    $u['staff'] = one(
        "SELECT st.*, o.office_code, o.office_name, o.office_type
           FROM staff st JOIN offices o ON o.office_id = st.office_id
          WHERE st.user_id = ?",
        [$u['user_id']]
    );

    $p = $u['student'] ?: $u['staff'];
    $u['display_name'] = $p ? trim($p['first_name'] . ' ' . $p['last_name']) : $u['username'];

    $cache = $u;
    return $u;
}

function require_login(): array
{
    $u = current_user();
    if (!$u) {
        $expired = !empty($_SESSION['expired']);
        fail(401, $expired ? 'Your session has expired. Please sign in again.' : 'Please sign in to continue.');
    }
    return $u;
}

function has_perm(array $user, string $perm): bool
{
    return in_array($perm, $user['permissions'], true);
}

/** Require at least one of the given permissions. */
function require_perm(string ...$perms): array
{
    $u = require_login();
    foreach ($perms as $p) {
        if (has_perm($u, $p)) {
            return $u;
        }
    }
    fail(403, 'You are not authorized to perform this action.');
}

/** Require a student account; returns [user, student_id]. */
function require_student(string $perm = 'portal.access'): array
{
    $u = require_perm($perm);
    if (!$u['student']) {
        fail(403, 'This feature is only available to student accounts.');
    }
    return [$u, (int) $u['student']['student_id']];
}

/** Require a staff account with the given permission; returns [user, office_id]. */
function require_staff(string ...$perms): array
{
    $u = require_perm(...$perms);
    if (!$u['staff']) {
        fail(403, 'This feature is only available to staff accounts.');
    }
    return [$u, (int) $u['staff']['office_id']];
}

function uid(): ?int
{
    $u = current_user();
    return $u ? (int) $u['user_id'] : null;
}
