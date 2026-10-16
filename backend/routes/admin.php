<?php
/**
 * Admin Module: user accounts, roles & permissions, service policies (fees, document types, terms, offices), audit logs.
 * Admin access does NOT include academic or financial approvals (separation of duties).
 * @var Router $router
 */

/* ------------------------------ USERS ------------------------------ */

$router->get('/admin/lookups', function () {
    require_perm('users.manage');
    return [
        'roles' => all("SELECT role_id, role_code, role_name FROM roles ORDER BY role_id"),
        'programs' => all("SELECT program_id, program_code, program_name FROM programs WHERE program_status = 'Active' ORDER BY program_code"),
        'offices' => all("SELECT office_id, office_code, office_name, office_type FROM offices WHERE office_status = 'Active' ORDER BY office_name"),
    ];
});

$router->get('/admin/users', function () {
    require_perm('users.manage');
    $sql = "SELECT u.user_id, u.username, u.account_status, u.last_login_at, u.created_at, r.role_code, r.role_name,
                   COALESCE(s.first_name, st.first_name) AS first_name, COALESCE(s.last_name, st.last_name) AS last_name,
                   COALESCE(s.email, st.email) AS email, COALESCE(s.student_number, st.employee_number) AS id_number,
                   COALESCE(p.program_code, o.office_name) AS unit
              FROM users u JOIN roles r ON r.role_id = u.role_id
              LEFT JOIN students s ON s.user_id = u.user_id LEFT JOIN programs p ON p.program_id = s.program_id
              LEFT JOIN staff st ON st.user_id = u.user_id LEFT JOIN offices o ON o.office_id = st.office_id
             WHERE 1 = 1";
    $params = [];
    if ($role = query_param('role')) { $sql .= " AND r.role_code = ?"; $params[] = $role; }
    if ($status = query_param('status')) { $sql .= " AND u.account_status = ?"; $params[] = $status; }
    if ($search = query_param('search')) {
        $sql .= " AND (u.username LIKE ? OR CONCAT(COALESCE(s.first_name, st.first_name), ' ', COALESCE(s.last_name, st.last_name)) LIKE ? OR COALESCE(s.email, st.email) LIKE ?)";
        array_push($params, "%$search%", "%$search%", "%$search%");
    }
    $sql .= " ORDER BY r.role_id, u.username LIMIT 500";
    return ['users' => all($sql, $params)];
});

$router->post('/admin/users', function () {
    $admin = require_perm('users.manage');
    $base = validate([
        'role_code' => 'required|in:STUDENT,REGISTRAR,CASHIER,DEPARTMENT,ADMIN',
        'username' => 'required|min:4|max:50|regex:/^[A-Za-z0-9._\-]+$/',
        'password' => 'required|min:8|max:72',
        'first_name' => 'required|max:100',
        'middle_name' => 'nullable|max:100',
        'last_name' => 'required|max:100',
        'email' => 'required|email|max:150',
    ]);
    if ($base['role_code'] === 'STUDENT') {
        $extra = validate([
            'student_number' => 'required|max:20|regex:/^\d{4}-\d{5}$/',
            'program_id' => 'required|int',
            'year_level' => 'required|int|between:1,5',
        ]);
    } else {
        $extra = validate([
            'employee_number' => 'required|max:20',
            'office_id' => 'required|int',
            'position_title' => 'required|max:100',
        ]);
    }
    if (val("SELECT user_id FROM users WHERE username = ?", [$base['username']])) {
        fail(422, 'Please correct the highlighted fields.', ['username' => 'Username is already taken.']);
    }

    $id = tx(function () use ($base, $extra, $admin) {
        $roleId = val("SELECT role_id FROM roles WHERE role_code = ?", [$base['role_code']]);
        q(
            "INSERT INTO users (role_id, username, password_hash, created_by) VALUES (?, ?, ?, ?)",
            [$roleId, $base['username'], password_hash($base['password'], PASSWORD_BCRYPT), $admin['user_id']]
        );
        $id = last_id();
        if ($base['role_code'] === 'STUDENT') {
            q(
                "INSERT INTO students (user_id, student_number, program_id, first_name, middle_name, last_name, email, year_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [$id, $extra['student_number'], $extra['program_id'], $base['first_name'], $base['middle_name'], $base['last_name'], $base['email'], $extra['year_level']]
            );
        } else {
            q(
                "INSERT INTO staff (user_id, employee_number, office_id, first_name, middle_name, last_name, email, position_title) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [$id, $extra['employee_number'], $extra['office_id'], $base['first_name'], $base['middle_name'], $base['last_name'], $base['email'], $extra['position_title']]
            );
        }
        $logged = $base + $extra;
        unset($logged['password']);
        audit('USER_CREATED', 'users', $id, null, $logged);
        notify($id, 'Welcome to CuyoTech SSIS', 'Your account was created. Please change your password after your first login.', 'users', $id);
        return $id;
    });
    return ['message' => "Account {$base['username']} created.", 'user_id' => $id];
});

$router->put('/admin/users/{id}', function ($p) {
    $admin = require_perm('users.manage');
    $user = one("SELECT u.*, r.role_code FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = ?", [(int) $p['id']]);
    if (!$user) fail(404, 'User not found.');
    $d = validate([
        'account_status' => 'required|in:Active,Inactive,Locked',
        'new_password' => 'nullable|min:8|max:72',
    ]);
    if ((int) $user['user_id'] === (int) $admin['user_id'] && $d['account_status'] !== 'Active') {
        fail(422, 'You cannot deactivate or lock your own account.');
    }
    q("UPDATE users SET account_status = ?, updated_by = ? WHERE user_id = ?", [$d['account_status'], $admin['user_id'], $user['user_id']]);
    if ($d['new_password']) {
        q("UPDATE users SET password_hash = ? WHERE user_id = ?", [password_hash($d['new_password'], PASSWORD_BCRYPT), $user['user_id']]);
        audit('PASSWORD_RESET', 'users', $user['user_id']);
    }
    if ($d['account_status'] !== $user['account_status']) {
        audit('ACCOUNT_STATUS_CHANGED', 'users', $user['user_id'], ['account_status' => $user['account_status']], ['account_status' => $d['account_status']]);
    }
    return ['message' => "Account {$user['username']} updated."];
});

/* ------------------------------ ROLES & PERMISSIONS ------------------------------ */

$router->get('/admin/roles', function () {
    require_perm('roles.manage');
    $roles = all("SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.role_id) AS user_count FROM roles r ORDER BY r.role_id");
    foreach ($roles as &$r) {
        $r['permission_ids'] = array_map('intval', array_column(all("SELECT permission_id FROM role_permissions WHERE role_id = ?", [$r['role_id']]), 'permission_id'));
    }
    return ['roles' => $roles, 'permissions' => all("SELECT * FROM permissions ORDER BY permission_code")];
});

$router->put('/admin/roles/{id}/permissions', function ($p) {
    $admin = require_perm('roles.manage');
    $role = one("SELECT * FROM roles WHERE role_id = ?", [(int) $p['id']]);
    if (!$role) fail(404, 'Role not found.');
    $ids = array_values(array_unique(array_map('intval', (array) input('permission_ids', []))));
    $codes = $ids ? array_column(all("SELECT permission_code FROM permissions WHERE permission_id IN (" . placeholders($ids) . ")", $ids), 'permission_code') : [];
    if (count($codes) !== count($ids)) fail(422, 'Unknown permission selected.');
    if ($role['role_code'] === 'ADMIN' && (!in_array('roles.manage', $codes, true) || !in_array('users.manage', $codes, true))) {
        fail(422, 'The Administrator role must keep users.manage and roles.manage to avoid locking everyone out.');
    }
    $old = array_column(all("SELECT p.permission_code FROM role_permissions rp JOIN permissions p ON p.permission_id = rp.permission_id WHERE rp.role_id = ?", [$role['role_id']]), 'permission_code');
    tx(function () use ($role, $ids, $admin) {
        q("DELETE FROM role_permissions WHERE role_id = ?", [$role['role_id']]);
        foreach ($ids as $pid) {
            q("INSERT INTO role_permissions (role_id, permission_id, granted_by) VALUES (?, ?, ?)", [$role['role_id'], $pid, $admin['user_id']]);
        }
    });
    audit('ROLE_PERMISSIONS_UPDATED', 'role_permissions', $role['role_id'], $old, $codes);
    return ['message' => "Permissions of {$role['role_name']} updated."];
});

/* ------------------------------ POLICIES ------------------------------ */

$router->get('/admin/policies', function () {
    require_perm('policies.manage');
    $terms = all("SELECT * FROM academic_terms ORDER BY start_date DESC");
    foreach ($terms as &$t) $t['label'] = term_label($t);
    return [
        'fees' => all("SELECT * FROM fees ORDER BY applies_to, fee_id"),
        'document_types' => all("SELECT dt.*, f.fee_name FROM document_types dt LEFT JOIN fees f ON f.fee_id = dt.fee_id ORDER BY dt.document_name"),
        'terms' => $terms,
        'offices' => all("SELECT * FROM offices ORDER BY office_type, office_name"),
    ];
});

$router->put('/admin/fees/{id}', function ($p) {
    $admin = require_perm('policies.manage');
    $f = one("SELECT * FROM fees WHERE fee_id = ?", [(int) $p['id']]);
    if (!$f) fail(404, 'Fee not found.');
    $d = validate(['amount' => 'required|numeric|between:0,1000000', 'fee_status' => 'required|in:Active,Inactive']);
    q("UPDATE fees SET amount = ?, fee_status = ?, updated_by = ? WHERE fee_id = ?", [$d['amount'], $d['fee_status'], $admin['user_id'], $f['fee_id']]);
    audit('FEE_UPDATED', 'fees', $f['fee_id'], ['amount' => $f['amount'], 'fee_status' => $f['fee_status']], $d);
    return ['message' => "{$f['fee_name']} updated."];
});

$router->put('/admin/document-types/{id}', function ($p) {
    $admin = require_perm('policies.manage');
    $t = one("SELECT * FROM document_types WHERE document_type_id = ?", [(int) $p['id']]);
    if (!$t) fail(404, 'Document type not found.');
    $d = validate([
        'requires_clearance' => 'required|bool',
        'fee_id' => 'nullable|int',
        'processing_days' => 'required|int|between:1,60',
        'document_status' => 'required|in:Active,Inactive',
    ]);
    if ($d['fee_id'] && !val("SELECT fee_id FROM fees WHERE fee_id = ? AND applies_to = 'Document'", [$d['fee_id']])) fail(422, 'Select a document fee.');
    q(
        "UPDATE document_types SET requires_clearance = ?, fee_id = ?, processing_days = ?, document_status = ?, updated_by = ? WHERE document_type_id = ?",
        [$d['requires_clearance'], $d['fee_id'] ?: null, $d['processing_days'], $d['document_status'], $admin['user_id'], $t['document_type_id']]
    );
    audit('DOCUMENT_TYPE_UPDATED', 'document_types', $t['document_type_id'], array_intersect_key($t, $d), $d);
    return ['message' => "{$t['document_name']} updated."];
});

$termRules = [
    'school_year' => 'required|regex:/^\d{4}-\d{4}$/',
    'semester' => 'required|in:First,Second,Summer',
    'start_date' => 'required|date',
    'end_date' => 'required|date',
    'enrollment_start' => 'required|date',
    'enrollment_end' => 'required|date',
    'term_status' => 'required|in:Upcoming,Open,Closed',
];

function check_term_dates(array $d): void
{
    $errors = [];
    if ($d['end_date'] <= $d['start_date']) $errors['end_date'] = 'End date must be after the start date.';
    if ($d['enrollment_end'] < $d['enrollment_start']) $errors['enrollment_end'] = 'Enrollment end must be on or after enrollment start.';
    [$y1, $y2] = explode('-', $d['school_year']);
    if ((int) $y2 !== (int) $y1 + 1) $errors['school_year'] = 'School year must be consecutive years, e.g. 2026-2027.';
    if ($errors) fail(422, 'Please correct the highlighted fields.', $errors);
}

/** Only one term may be Open at a time. */
function close_other_open_terms(int $exceptId, int $adminId): void
{
    q("UPDATE academic_terms SET term_status = 'Closed', updated_by = ? WHERE term_status = 'Open' AND term_id <> ?", [$adminId, $exceptId]);
}

$router->post('/admin/terms', function () use ($termRules) {
    $admin = require_perm('policies.manage');
    $d = validate($termRules);
    check_term_dates($d);
    q(
        "INSERT INTO academic_terms (school_year, semester, start_date, end_date, enrollment_start, enrollment_end, term_status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [$d['school_year'], $d['semester'], $d['start_date'], $d['end_date'], $d['enrollment_start'], $d['enrollment_end'], $d['term_status'], $admin['user_id']]
    );
    $id = last_id();
    if ($d['term_status'] === 'Open') close_other_open_terms($id, (int) $admin['user_id']);
    audit('TERM_CREATED', 'academic_terms', $id, null, $d);
    return ['message' => 'Academic term created.', 'term_id' => $id];
});

$router->put('/admin/terms/{id}', function ($p) use ($termRules) {
    $admin = require_perm('policies.manage');
    $t = one("SELECT * FROM academic_terms WHERE term_id = ?", [(int) $p['id']]);
    if (!$t) fail(404, 'Term not found.');
    $d = validate($termRules);
    check_term_dates($d);
    q(
        "UPDATE academic_terms SET school_year = ?, semester = ?, start_date = ?, end_date = ?, enrollment_start = ?, enrollment_end = ?, term_status = ?, updated_by = ? WHERE term_id = ?",
        [$d['school_year'], $d['semester'], $d['start_date'], $d['end_date'], $d['enrollment_start'], $d['enrollment_end'], $d['term_status'], $admin['user_id'], $t['term_id']]
    );
    if ($d['term_status'] === 'Open') close_other_open_terms((int) $t['term_id'], (int) $admin['user_id']);
    audit('TERM_UPDATED', 'academic_terms', $t['term_id'], array_intersect_key($t, $d), $d);
    return ['message' => 'Academic term updated.'];
});

$router->put('/admin/offices/{id}', function ($p) {
    $admin = require_perm('policies.manage');
    $o = one("SELECT * FROM offices WHERE office_id = ?", [(int) $p['id']]);
    if (!$o) fail(404, 'Office not found.');
    $d = validate(['requires_clearance' => 'required|bool', 'office_status' => 'required|in:Active,Inactive']);
    q("UPDATE offices SET requires_clearance = ?, office_status = ?, updated_by = ? WHERE office_id = ?", [$d['requires_clearance'], $d['office_status'], $admin['user_id'], $o['office_id']]);
    audit('OFFICE_UPDATED', 'offices', $o['office_id'], array_intersect_key($o, $d), $d);
    return ['message' => "{$o['office_name']} updated."];
});

/* ------------------------------ AUDIT LOGS ------------------------------ */

$router->get('/admin/audit-logs', function () {
    require_perm('audit.view');
    $sql = "SELECT a.*, u.username, r.role_name FROM audit_logs a
              LEFT JOIN users u ON u.user_id = a.user_id LEFT JOIN roles r ON r.role_id = u.role_id WHERE 1 = 1";
    $params = [];
    if ($action = query_param('action')) { $sql .= " AND a.action LIKE ?"; $params[] = "%$action%"; }
    if ($user = query_param('user')) { $sql .= " AND u.username LIKE ?"; $params[] = "%$user%"; }
    if ($table = query_param('table')) { $sql .= " AND a.table_name = ?"; $params[] = $table; }
    $sql .= " ORDER BY a.audit_id DESC LIMIT 300";
    return [
        'logs' => all($sql, $params),
        'tables' => array_column(all("SELECT DISTINCT table_name FROM audit_logs ORDER BY table_name"), 'table_name'),
    ];
});
