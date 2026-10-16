<?php
/** @var Router $router */

// GET /api/terms - list of academic terms (any logged-in user)
$router->get('/terms', function () {
    require_login();
    $terms = all("SELECT * FROM academic_terms ORDER BY start_date DESC");
    foreach ($terms as &$t) {
        $t['label'] = term_label($t);
    }
    return ['terms' => $terms, 'open_term' => open_term()];
});

// GET /api/notifications
$router->get('/notifications', function () {
    $u = require_login();
    $rows = all(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, notification_id DESC LIMIT 100",
        [$u['user_id']]
    );
    $unread = (int) val("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0", [$u['user_id']]);
    return ['notifications' => $rows, 'unread' => $unread];
});

// POST /api/notifications/{id}/read
$router->post('/notifications/{id}/read', function ($p) {
    $u = require_login();
    q("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE notification_id = ? AND user_id = ? AND is_read = 0", [(int) $p['id'], $u['user_id']]);
    return ['ok' => true];
});

// POST /api/notifications/read-all
$router->post('/notifications/read-all', function () {
    $u = require_login();
    q("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0", [$u['user_id']]);
    return ['ok' => true];
});

// GET /api/dashboard - role-specific summary
$router->get('/dashboard', function () {
    $u = require_login();
    $term = open_term();
    $data = ['role' => $u['role_code'], 'open_term' => $term];

    switch ($u['role_code']) {
        case 'STUDENT':
            $sid = (int) $u['student']['student_id'];
            $enr = $term ? one("SELECT * FROM enrollments WHERE student_id = ? AND term_id = ? ORDER BY enrollment_id DESC LIMIT 1", [$sid, $term['term_id']]) : null;
            $grades = all(
                "SELECT g.grade_value, c.units FROM grades g
                   JOIN enrollment_subjects es ON es.enrollment_subject_id = g.enrollment_subject_id
                   JOIN enrollments e ON e.enrollment_id = es.enrollment_id
                   JOIN course_offerings o ON o.offering_id = es.offering_id
                   JOIN courses c ON c.course_id = o.course_id
                  WHERE e.student_id = ? AND g.grade_status = 'Published'",
                [$sid]
            );
            $data['enrollment'] = $enr ? array_merge($enr, ['units' => enrollment_fees((int) $enr['enrollment_id'])['units']]) : null;
            $data['subjects'] = $enr ? enrollment_subject_rows((int) $enr['enrollment_id'], $sid) : [];
            $data['gwa'] = compute_gwa($grades);
            $data['units_earned'] = array_sum(array_map(fn ($g) => $g['grade_value'] !== null && $g['grade_value'] <= cfg('passing_grade') ? (int) $g['units'] : 0, $grades));
            $data['pending_documents'] = (int) val("SELECT COUNT(*) FROM document_requests WHERE student_id = ? AND request_status IN ('Submitted','For Correction','Approved')", [$sid]);
            $data['clearance'] = one("SELECT clearance_id, clearance_status, submitted_at FROM clearance_requests WHERE student_id = ? ORDER BY clearance_id DESC LIMIT 1", [$sid]);
            $data['pending_payments'] = (int) val("SELECT COUNT(*) FROM payments p LEFT JOIN enrollments e ON e.enrollment_id = p.enrollment_id LEFT JOIN document_requests d ON d.request_id = p.document_request_id WHERE (e.student_id = ? OR d.student_id = ?) AND p.payment_status = 'Submitted'", [$sid, $sid]);

            // Clearance status per office (latest active clearance)
            if ($data['clearance']) {
                $data['clearance']['decisions'] = all(
                    "SELECT d.decision_id, d.decision_status, d.pending_items, o.office_name, o.office_type
                       FROM clearance_office_decisions d JOIN offices o ON o.office_id = d.office_id
                      WHERE d.clearance_id = ? ORDER BY FIELD(o.office_type, 'Department', 'Cashier', 'Registrar', 'Administration')",
                    [$data['clearance']['clearance_id']]
                );
                $data['clearance']['approved_count'] = count(array_filter($data['clearance']['decisions'], fn ($d) => $d['decision_status'] === 'Approved'));
                $data['clearance']['pending_count'] = count(array_filter($data['clearance']['decisions'], fn ($d) => $d['decision_status'] === 'Pending Requirements'));
            }

            // Recent document requests
            $data['recent_documents'] = all(
                "SELECT r.request_id, r.request_status, r.submitted_at, r.released_at, dt.document_code, dt.document_name
                   FROM document_requests r JOIN document_types dt ON dt.document_type_id = r.document_type_id
                  WHERE r.student_id = ? ORDER BY r.request_id DESC LIMIT 3",
                [$sid]
            );

            // Balance due = fees of approved transactions without a confirmed payment
            $due = array_filter(student_transactions($sid), fn ($t) => $t['payment']['state'] !== 'Confirmed');
            $data['balance_due'] = money(array_sum(array_column($due, 'amount')));
            $data['receipts_count'] = (int) val(
                "SELECT COUNT(*) FROM receipts r JOIN payments p ON p.payment_id = r.payment_id
                   LEFT JOIN enrollments e ON e.enrollment_id = p.enrollment_id LEFT JOIN document_requests d ON d.request_id = p.document_request_id
                  WHERE e.student_id = ? OR d.student_id = ?",
                [$sid, $sid]
            );

            // Latest published grades (most recent term with published grades)
            $recent = all(
                "SELECT t.term_id, t.school_year, t.semester, c.course_code, c.course_name, c.units, g.grade_value, g.special_mark
                   FROM grades g
                   JOIN enrollment_subjects es ON es.enrollment_subject_id = g.enrollment_subject_id
                   JOIN enrollments e ON e.enrollment_id = es.enrollment_id
                   JOIN course_offerings o ON o.offering_id = es.offering_id
                   JOIN courses c ON c.course_id = o.course_id
                   JOIN academic_terms t ON t.term_id = e.term_id
                  WHERE e.student_id = ? AND g.grade_status = 'Published'
                  ORDER BY t.start_date DESC, g.published_at DESC, c.course_code",
                [$sid]
            );
            $latestTerm = $recent[0]['term_id'] ?? null;
            $data['recent_grades'] = array_values(array_map(
                fn ($g) => $g + ['remarks' => grade_remark($g['grade_value'], $g['special_mark'])],
                array_filter($recent, fn ($g) => $g['term_id'] === $latestTerm)
            ));
            $data['recent_grades_term'] = $latestTerm ? term_label($recent[0]) : null;
            break;

        case 'REGISTRAR':
            $data['stats'] = [
                'enrollments_for_review' => (int) val("SELECT COUNT(*) FROM enrollments WHERE enrollment_status = 'Submitted'"),
                'enrollments_to_finalize' => (int) val("SELECT COUNT(*) FROM enrollments WHERE enrollment_status = 'Approved'"),
                'documents_for_review' => (int) val("SELECT COUNT(*) FROM document_requests WHERE request_status = 'Submitted'"),
                'documents_to_release' => (int) val("SELECT COUNT(*) FROM document_requests WHERE request_status = 'Approved'"),
                'grades_unpublished' => (int) val("SELECT COUNT(*) FROM grades WHERE grade_status = 'Encoded'"),
                'clearance_for_review' => (int) val("SELECT COUNT(*) FROM clearance_office_decisions d JOIN clearance_requests c ON c.clearance_id = d.clearance_id WHERE d.office_id = ? AND d.decision_status = 'For Review' AND c.clearance_status = 'In Progress'", [$u['staff']['office_id'] ?? 0]),
            ];
            break;

        case 'CASHIER':
            $data['stats'] = [
                'payments_to_verify' => (int) val("SELECT COUNT(*) FROM payments WHERE payment_status = 'Submitted'"),
                'receipts_to_issue' => (int) val("SELECT COUNT(*) FROM payments p LEFT JOIN receipts r ON r.payment_id = p.payment_id WHERE p.payment_status = 'Confirmed' AND r.receipt_id IS NULL"),
                'collected_today' => money(val("SELECT COALESCE(SUM(amount),0) FROM payments WHERE payment_status = 'Confirmed' AND DATE(verified_at) = CURDATE()")),
                'collected_total' => money(val("SELECT COALESCE(SUM(amount),0) FROM payments WHERE payment_status = 'Confirmed'")),
                'clearance_for_review' => (int) val("SELECT COUNT(*) FROM clearance_office_decisions d JOIN clearance_requests c ON c.clearance_id = d.clearance_id WHERE d.office_id = ? AND d.decision_status = 'For Review' AND c.clearance_status = 'In Progress'", [$u['staff']['office_id'] ?? 0]),
            ];
            break;

        case 'DEPARTMENT':
            $officeId = $u['staff']['office_id'] ?? 0;
            $deptId = (int) val("SELECT department_id FROM departments WHERE office_id = ?", [$officeId]);
            $data['stats'] = [
                'clearance_for_review' => (int) val("SELECT COUNT(*) FROM clearance_office_decisions d JOIN clearance_requests c ON c.clearance_id = d.clearance_id WHERE d.office_id = ? AND d.decision_status = 'For Review' AND c.clearance_status = 'In Progress'", [$officeId]),
                'clearance_pending' => (int) val("SELECT COUNT(*) FROM clearance_office_decisions d JOIN clearance_requests c ON c.clearance_id = d.clearance_id WHERE d.office_id = ? AND d.decision_status = 'Pending Requirements' AND c.clearance_status = 'In Progress'", [$officeId]),
                'clearance_approved' => (int) val("SELECT COUNT(*) FROM clearance_office_decisions WHERE office_id = ? AND decision_status = 'Approved'", [$officeId]),
                'active_courses' => (int) val("SELECT COUNT(*) FROM courses WHERE department_id = ? AND course_status = 'Active'", [$deptId]),
                'students' => (int) val("SELECT COUNT(*) FROM students s JOIN programs p ON p.program_id = s.program_id WHERE p.department_id = ? AND s.student_status = 'Active'", [$deptId]),
            ];
            break;

        case 'ADMIN':
            $data['stats'] = [
                'users' => (int) val("SELECT COUNT(*) FROM users"),
                'active_users' => (int) val("SELECT COUNT(*) FROM users WHERE account_status = 'Active'"),
                'locked_users' => (int) val("SELECT COUNT(*) FROM users WHERE account_status = 'Locked'"),
                'students' => (int) val("SELECT COUNT(*) FROM students"),
                'staff' => (int) val("SELECT COUNT(*) FROM staff"),
                'audit_today' => (int) val("SELECT COUNT(*) FROM audit_logs WHERE DATE(created_at) = CURDATE()"),
            ];
            $data['users_by_role'] = all("SELECT r.role_name, COUNT(u.user_id) AS total FROM roles r LEFT JOIN users u ON u.role_id = r.role_id GROUP BY r.role_id ORDER BY r.role_id");
            $data['recent_activity'] = all("SELECT a.action, a.table_name, a.record_id, a.created_at, u.username FROM audit_logs a LEFT JOIN users u ON u.user_id = a.user_id ORDER BY a.audit_id DESC LIMIT 8");
            break;
    }
    return $data;
});

// GET /api/print/cor/{enrollmentId} - Certificate of Registration
$router->get('/print/cor/{id}', function ($p) {
    $u = require_login();
    $e = one(
        "SELECT e.*, t.school_year, t.semester FROM enrollments e JOIN academic_terms t ON t.term_id = e.term_id WHERE e.enrollment_id = ?",
        [(int) $p['id']]
    );
    if (!$e) fail(404, 'Enrollment not found.');
    $own = $u['student'] && (int) $u['student']['student_id'] === (int) $e['student_id'];
    if (!$own && !has_perm($u, 'enrollment.review')) fail(403, 'You are not authorized to view this record.');
    if ($e['enrollment_status'] !== 'Finalized') fail(409, 'The COR is available only after the enrollment is finalized.');

    $student = one(
        "SELECT s.*, p.program_code, p.program_name, d.department_name FROM students s
           JOIN programs p ON p.program_id = s.program_id JOIN departments d ON d.department_id = p.department_id
          WHERE s.student_id = ?",
        [$e['student_id']]
    );
    $e['finalized_by_name'] = val("SELECT " . name_sql('?'), [$e['finalized_by']]);
    return [
        'enrollment' => $e,
        'student' => $student,
        'student_name' => person_name($student),
        'subjects' => enrollment_subject_rows((int) $e['enrollment_id'], (int) $e['student_id']),
        'fees' => enrollment_fees((int) $e['enrollment_id']),
        'payment' => payment_state('enrollment_id', (int) $e['enrollment_id']),
    ];
});

// GET /api/print/receipt/{receiptId} - Official Receipt
$router->get('/print/receipt/{id}', function ($p) {
    $u = require_login();
    $r = one(
        "SELECT r.*, p.amount, p.payment_method, p.reference_number, p.enrollment_id, p.document_request_id, p.verified_at,
                COALESCE(e.student_id, d.student_id) AS student_id,
                dt.document_name, d.copies, t.school_year, t.semester
           FROM receipts r
           JOIN payments p ON p.payment_id = r.payment_id
           LEFT JOIN enrollments e ON e.enrollment_id = p.enrollment_id
           LEFT JOIN academic_terms t ON t.term_id = e.term_id
           LEFT JOIN document_requests d ON d.request_id = p.document_request_id
           LEFT JOIN document_types dt ON dt.document_type_id = d.document_type_id
          WHERE r.receipt_id = ?",
        [(int) $p['id']]
    );
    if (!$r) fail(404, 'Receipt not found.');
    $own = $u['student'] && (int) $u['student']['student_id'] === (int) $r['student_id'];
    if (!$own && !has_perm($u, 'payments.verify')) fail(403, 'You are not authorized to view this receipt.');

    $student = one("SELECT s.*, p.program_code FROM students s JOIN programs p ON p.program_id = s.program_id WHERE s.student_id = ?", [$r['student_id']]);
    $r['issued_by_name'] = val("SELECT " . name_sql('?'), [$r['issued_by']]);
    $r['description'] = $r['enrollment_id']
        ? "Enrollment Fees - {$r['semester']} Semester, SY {$r['school_year']}"
        : "{$r['document_name']} ({$r['copies']} " . ((int) $r['copies'] === 1 ? 'copy' : 'copies') . ")";
    return ['receipt' => $r, 'student' => $student, 'student_name' => person_name($student)];
});
