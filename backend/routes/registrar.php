<?php
/**
 * Registrar Module: enrollment review & finalization, grade encoding & publishing, document requests.
 * @var Router $router
 */

/* ------------------------------ ENROLLMENTS ------------------------------ */

$router->get('/registrar/enrollments', function () {
    require_perm('enrollment.review');
    $status = query_param('status');
    $termId = query_param('term_id');
    $search = query_param('search');
    $sql = "SELECT e.*, s.student_number, s.first_name, s.last_name, s.year_level, p.program_code, t.school_year, t.semester,
                   (SELECT COALESCE(SUM(c.units),0) FROM enrollment_subjects es JOIN course_offerings o ON o.offering_id = es.offering_id JOIN courses c ON c.course_id = o.course_id WHERE es.enrollment_id = e.enrollment_id) AS units
              FROM enrollments e
              JOIN students s ON s.student_id = e.student_id
              JOIN programs p ON p.program_id = s.program_id
              JOIN academic_terms t ON t.term_id = e.term_id
             WHERE e.enrollment_status <> 'Draft'";
    $params = [];
    if ($status) { $sql .= " AND e.enrollment_status = ?"; $params[] = $status; }
    if ($termId) { $sql .= " AND e.term_id = ?"; $params[] = (int) $termId; }
    if ($search) { $sql .= " AND (s.student_number LIKE ? OR CONCAT(s.first_name,' ',s.last_name) LIKE ?)"; $params[] = "%$search%"; $params[] = "%$search%"; }
    $sql .= " ORDER BY FIELD(e.enrollment_status,'Submitted','Approved','For Correction','Finalized','Rejected','Cancelled'), e.submitted_at DESC LIMIT 300";
    $rows = all($sql, $params);
    foreach ($rows as &$r) {
        $r['term_label'] = term_label($r);
        $r['payment_state'] = payment_state('enrollment_id', (int) $r['enrollment_id'])['state'];
    }
    return ['enrollments' => $rows];
});

$router->get('/registrar/enrollments/{id}', function ($p) {
    require_perm('enrollment.review');
    $e = one("SELECT e.*, t.school_year, t.semester FROM enrollments e JOIN academic_terms t ON t.term_id = e.term_id WHERE e.enrollment_id = ?", [(int) $p['id']]);
    if (!$e) fail(404, 'Enrollment not found.');
    $e['term_label'] = term_label($e);
    $e['reviewed_by_name'] = $e['reviewed_by'] ? val("SELECT " . name_sql('?'), [$e['reviewed_by']]) : null;
    $e['finalized_by_name'] = $e['finalized_by'] ? val("SELECT " . name_sql('?'), [$e['finalized_by']]) : null;
    $student = one(
        "SELECT s.*, p.program_code, p.program_name, u.account_status FROM students s
           JOIN programs p ON p.program_id = s.program_id JOIN users u ON u.user_id = s.user_id WHERE s.student_id = ?",
        [$e['student_id']]
    );
    $subjects = enrollment_subject_rows((int) $e['enrollment_id'], (int) $e['student_id']);
    $fees = enrollment_fees((int) $e['enrollment_id']);
    $checks = [
        ['label' => 'Student account and status are active', 'ok' => $student['student_status'] === 'Active' && $student['account_status'] === 'Active'],
        ['label' => 'All prerequisites are passed', 'ok' => !in_array(false, array_column($subjects, 'prerequisites_met'), true)],
        ['label' => 'All selected sections have available seats', 'ok' => !in_array(false, array_column($subjects, 'has_seat'), true)],
        ['label' => 'Total units within the limit (' . cfg('max_units_per_term') . ')', 'ok' => $fees['units'] > 0 && $fees['units'] <= cfg('max_units_per_term')],
    ];
    $history = all("SELECT a.action, a.created_at, a.new_value, " . name_sql('a.user_id') . " AS actor FROM audit_logs a WHERE a.table_name = 'enrollments' AND a.record_id = ? ORDER BY a.audit_id", [$e['enrollment_id']]);
    return [
        'enrollment' => $e,
        'student' => $student,
        'subjects' => $subjects,
        'fees' => $fees,
        'payment' => payment_state('enrollment_id', (int) $e['enrollment_id']),
        'checks' => $checks,
        'eligible' => !in_array(false, array_column($checks, 'ok'), true),
        'history' => $history,
    ];
});

$router->post('/registrar/enrollments/{id}/decision', function ($p) use ($router) {
    $u = require_perm('enrollment.review');
    $d = validate([
        'action' => 'required|in:approve,correct,reject',
        'reason' => 'nullable|max:500',
    ]);
    $e = one("SELECT * FROM enrollments WHERE enrollment_id = ?", [(int) $p['id']]);
    if (!$e) fail(404, 'Enrollment not found.');
    if ($e['enrollment_status'] !== 'Submitted') fail(409, "Only submitted applications can be reviewed (current: {$e['enrollment_status']}).");
    if ($d['action'] !== 'approve' && mb_strlen((string) $d['reason']) < 5) {
        fail(422, 'Please correct the highlighted fields.', ['reason' => 'A reason (at least 5 characters) is required for correction or rejection.']);
    }

    if ($d['action'] === 'approve') {
        $detail = $router->dispatch('GET', '/registrar/enrollments/' . $e['enrollment_id']);
        if (!$detail['eligible']) {
            $failed = array_column(array_filter($detail['checks'], fn ($c) => !$c['ok']), 'label');
            fail(422, 'Cannot approve: ' . implode('; ', $failed) . '. Request a correction or reject instead.');
        }
    }

    $status = ['approve' => 'Approved', 'correct' => 'For Correction', 'reject' => 'Rejected'][$d['action']];
    $affected = q(
        "UPDATE enrollments SET enrollment_status = ?, reviewed_by = ?, reviewed_at = NOW(), decision_reason = ? WHERE enrollment_id = ? AND enrollment_status = 'Submitted'",
        [$status, $u['user_id'], $d['reason'], $e['enrollment_id']]
    )->rowCount();
    if ($affected === 0) fail(409, 'This application was already processed.');
    audit('ENROLLMENT_' . strtoupper($d['action'] === 'correct' ? 'returned_for_correction' : $status), 'enrollments', $e['enrollment_id'], ['status' => 'Submitted'], ['status' => $status, 'reason' => $d['reason']]);

    $fees = enrollment_fees((int) $e['enrollment_id']);
    $msg = match ($status) {
        'Approved' => $fees['total'] > 0
            ? 'Your enrollment was approved. Please pay ₱' . number_format($fees['total'], 2) . ' under Payments so the Registrar can finalize it.'
            : 'Your enrollment was approved. No fees are due; the Registrar will finalize it.',
        'For Correction' => "Your enrollment needs correction: {$d['reason']}",
        'Rejected' => "Your enrollment was rejected: {$d['reason']}",
    };
    notify(student_user_id((int) $e['student_id']), "Enrollment $status", $msg, 'enrollments', $e['enrollment_id']);
    return ['message' => "Enrollment marked as $status."];
});

$router->post('/registrar/enrollments/{id}/finalize', function ($p) {
    $u = require_perm('enrollment.finalize');
    $e = one("SELECT e.*, t.school_year FROM enrollments e JOIN academic_terms t ON t.term_id = e.term_id WHERE e.enrollment_id = ?", [(int) $p['id']]);
    if (!$e) fail(404, 'Enrollment not found.');
    if ($e['enrollment_status'] !== 'Approved') fail(409, "Only approved applications can be finalized (current: {$e['enrollment_status']}).");
    $fees = enrollment_fees((int) $e['enrollment_id']);
    $pay = payment_state('enrollment_id', (int) $e['enrollment_id']);
    if ($fees['total'] > 0 && $pay['state'] !== 'Confirmed') {
        fail(409, 'Cannot finalize: enrollment fees of ₱' . number_format($fees['total'], 2) . ' are not yet confirmed by the Cashier.');
    }
    // Re-check seats at finalization time
    foreach (enrollment_subject_rows((int) $e['enrollment_id'], (int) $e['student_id']) as $s) {
        if (!$s['has_seat']) fail(409, "Cannot finalize: {$s['course_code']} ({$s['section_code']}) is now full.");
    }
    $cor = 'COR-' . substr($e['school_year'], 0, 4) . '-' . str_pad((string) $e['enrollment_id'], 6, '0', STR_PAD_LEFT);
    $affected = q(
        "UPDATE enrollments SET enrollment_status = 'Finalized', finalized_by = ?, finalized_at = NOW(), cor_number = ? WHERE enrollment_id = ? AND enrollment_status = 'Approved'",
        [$u['user_id'], $cor, $e['enrollment_id']]
    )->rowCount();
    if ($affected === 0) fail(409, 'This application was already finalized.');
    audit('ENROLLMENT_FINALIZED', 'enrollments', $e['enrollment_id'], ['status' => 'Approved'], ['status' => 'Finalized', 'cor_number' => $cor]);
    notify(student_user_id((int) $e['student_id']), 'Enrollment finalized', "You are officially enrolled. Your Certificate of Registration ($cor) is now available.", 'enrollments', $e['enrollment_id']);
    return ['message' => "Enrollment finalized. COR $cor generated.", 'cor_number' => $cor];
});

/* ------------------------------ GRADES ------------------------------ */

$router->get('/registrar/offerings', function () {
    require_perm('grades.encode');
    $termId = (int) (query_param('term_id') ?: (open_term()['term_id'] ?? 0));
    $rows = all(
        "SELECT o.offering_id, o.section_code, o.capacity, o.offering_status, c.course_code, c.course_name, c.units, d.department_code,
                COUNT(es.enrollment_subject_id) AS students,
                SUM(g.grade_status = 'Encoded') AS encoded,
                SUM(g.grade_status = 'Published') AS published
           FROM course_offerings o
           JOIN courses c ON c.course_id = o.course_id
           JOIN departments d ON d.department_id = c.department_id
           LEFT JOIN enrollment_subjects es ON es.offering_id = o.offering_id
                AND es.enrollment_id IN (SELECT enrollment_id FROM enrollments WHERE enrollment_status = 'Finalized')
           LEFT JOIN grades g ON g.enrollment_subject_id = es.enrollment_subject_id
          WHERE o.term_id = ?
          GROUP BY o.offering_id
          ORDER BY c.course_code, o.section_code",
        [$termId]
    );
    foreach ($rows as &$r) {
        $r['encoded'] = (int) $r['encoded'];
        $r['published'] = (int) $r['published'];
    }
    return ['term_id' => $termId, 'offerings' => $rows];
});

$router->get('/registrar/offerings/{id}/grades', function ($p) {
    require_perm('grades.encode');
    $o = one(
        "SELECT o.*, c.course_code, c.course_name, c.units, t.school_year, t.semester FROM course_offerings o
           JOIN courses c ON c.course_id = o.course_id JOIN academic_terms t ON t.term_id = o.term_id WHERE o.offering_id = ?",
        [(int) $p['id']]
    );
    if (!$o) fail(404, 'Offering not found.');
    $o['term_label'] = term_label($o);
    $students = all(
        "SELECT es.enrollment_subject_id, s.student_number, s.first_name, s.middle_name, s.last_name, p.program_code, s.year_level,
                g.grade_id, g.grade_value, g.special_mark, g.grade_status, g.encoded_at, g.published_at
           FROM enrollment_subjects es
           JOIN enrollments e ON e.enrollment_id = es.enrollment_id AND e.enrollment_status = 'Finalized'
           JOIN students s ON s.student_id = e.student_id
           JOIN programs p ON p.program_id = s.program_id
           LEFT JOIN grades g ON g.enrollment_subject_id = es.enrollment_subject_id
          WHERE es.offering_id = ?
          ORDER BY s.last_name, s.first_name",
        [$o['offering_id']]
    );
    return ['offering' => $o, 'students' => $students, 'valid_grades' => cfg('valid_grades')];
});

// Save grades for an offering: { grades: [ { enrollment_subject_id, value: "1.75" | "INC" | "DRP" } ] }
$router->post('/registrar/offerings/{id}/grades', function ($p) {
    $u = require_perm('grades.encode');
    $offeringId = (int) $p['id'];
    $items = input('grades');
    if (!is_array($items) || !$items) fail(422, 'No grades to save.');

    $errors = [];
    $valid = cfg('valid_grades');
    $saved = 0;
    tx(function () use ($items, $offeringId, $valid, $u, &$errors, &$saved) {
        foreach ($items as $i => $item) {
            $esId = (int) ($item['enrollment_subject_id'] ?? 0);
            $value = strtoupper(trim((string) ($item['value'] ?? '')));
            if ($value === '') continue;

            $es = one(
                "SELECT es.enrollment_subject_id, s.student_number FROM enrollment_subjects es
                   JOIN enrollments e ON e.enrollment_id = es.enrollment_id AND e.enrollment_status = 'Finalized'
                   JOIN students s ON s.student_id = e.student_id
                  WHERE es.enrollment_subject_id = ? AND es.offering_id = ?",
                [$esId, $offeringId]
            );
            if (!$es) { $errors[] = "Row " . ($i + 1) . ": student is not officially enrolled in this class."; continue; }

            $gradeValue = null; $mark = null;
            if (in_array($value, ['INC', 'DRP'], true)) {
                $mark = $value;
            } elseif (is_numeric($value) && in_array(number_format((float) $value, 2, '.', ''), $valid, true)) {
                $gradeValue = number_format((float) $value, 2, '.', '');
            } else {
                $errors[] = "{$es['student_number']}: \"$value\" is not a valid grade. Use " . implode(', ', $valid) . ', INC or DRP.';
                continue;
            }

            $old = one("SELECT grade_value, special_mark, grade_status FROM grades WHERE enrollment_subject_id = ?", [$esId]);
            if ($old && $old['grade_status'] === 'Published') {
                if ($old['grade_value'] !== $gradeValue || $old['special_mark'] !== $mark) {
                    $errors[] = "{$es['student_number']}: grade is already published and locked.";
                }
                continue;
            }
            if ($old && $old['grade_value'] === $gradeValue && $old['special_mark'] === $mark) continue;

            q(
                "INSERT INTO grades (enrollment_subject_id, grade_value, special_mark, encoded_by, encoded_at)
                 VALUES (?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE grade_value = VALUES(grade_value), special_mark = VALUES(special_mark),
                                         encoded_by = VALUES(encoded_by), encoded_at = NOW()",
                [$esId, $gradeValue, $mark, $u['user_id']]
            );
            audit('GRADE_ENCODED', 'grades', $esId, $old, ['grade_value' => $gradeValue, 'special_mark' => $mark]);
            $saved++;
        }
        if ($errors) {
            fail(422, 'Some grades could not be saved. No changes were applied.', ['grades' => $errors]);
        }
    });
    return ['message' => $saved ? "$saved grade(s) saved as Encoded. Publish them to make them visible to students." : 'No changes to save.'];
});

$router->post('/registrar/offerings/{id}/publish', function ($p) {
    $u = require_perm('grades.publish');
    $o = one("SELECT o.*, c.course_code FROM course_offerings o JOIN courses c ON c.course_id = o.course_id WHERE o.offering_id = ?", [(int) $p['id']]);
    if (!$o) fail(404, 'Offering not found.');
    $rows = all(
        "SELECT g.grade_id, e.student_id FROM grades g
           JOIN enrollment_subjects es ON es.enrollment_subject_id = g.enrollment_subject_id
           JOIN enrollments e ON e.enrollment_id = es.enrollment_id
          WHERE es.offering_id = ? AND g.grade_status = 'Encoded'",
        [$o['offering_id']]
    );
    if (!$rows) fail(409, 'There are no encoded grades to publish for this class.');
    tx(function () use ($rows, $u, $o) {
        foreach ($rows as $r) {
            q("UPDATE grades SET grade_status = 'Published', published_by = ?, published_at = NOW() WHERE grade_id = ?", [$u['user_id'], $r['grade_id']]);
            notify(student_user_id((int) $r['student_id']), 'Grade published', "Your grade for {$o['course_code']} is now available.", 'grades', $r['grade_id']);
        }
        audit('GRADES_PUBLISHED', 'course_offerings', $o['offering_id'], null, ['course' => $o['course_code'], 'section' => $o['section_code'], 'count' => count($rows)]);
    });
    return ['message' => count($rows) . " grade(s) published for {$o['course_code']} {$o['section_code']}."];
});

/* ------------------------------ DOCUMENT REQUESTS ------------------------------ */

$router->get('/registrar/documents', function () {
    require_perm('documents.review');
    $status = query_param('status');
    $sql = "SELECT r.*, dt.document_code, dt.document_name, dt.requires_clearance, dt.processing_days,
                   s.student_number, s.first_name, s.last_name, s.student_status, p.program_code,
                   (SELECT c.clearance_id FROM clearance_requests c WHERE c.student_id = r.student_id AND c.clearance_status = 'Completed' ORDER BY c.completed_at DESC LIMIT 1) AS completed_clearance_id
              FROM document_requests r
              JOIN document_types dt ON dt.document_type_id = r.document_type_id
              JOIN students s ON s.student_id = r.student_id
              JOIN programs p ON p.program_id = s.program_id";
    $params = [];
    if ($status) { $sql .= " WHERE r.request_status = ?"; $params[] = $status; }
    $sql .= " ORDER BY FIELD(r.request_status,'Submitted','Approved','For Correction','Released','Rejected','Cancelled'), r.submitted_at DESC LIMIT 300";
    $rows = all($sql, $params);
    foreach ($rows as &$r) {
        $r['fee'] = document_fee((int) $r['document_type_id'], (int) $r['copies']);
        $r['payment'] = payment_state('document_request_id', (int) $r['request_id']);
        $r['due_date'] = date('Y-m-d', strtotime($r['submitted_at'] . " +{$r['processing_days']} weekdays"));
    }
    return ['requests' => $rows];
});

$router->post('/registrar/documents/{id}/decision', function ($p) {
    $u = require_perm('documents.review');
    $d = validate([
        'action' => 'required|in:approve,correct,reject',
        'reason' => 'nullable|max:500',
    ]);
    $r = one("SELECT r.*, dt.document_name, dt.requires_clearance FROM document_requests r JOIN document_types dt ON dt.document_type_id = r.document_type_id WHERE r.request_id = ?", [(int) $p['id']]);
    if (!$r) fail(404, 'Document request not found.');
    if ($r['request_status'] !== 'Submitted') fail(409, "Only submitted requests can be reviewed (current: {$r['request_status']}).");
    if ($d['action'] !== 'approve' && mb_strlen((string) $d['reason']) < 5) {
        fail(422, 'Please correct the highlighted fields.', ['reason' => 'A reason (at least 5 characters) is required for correction or rejection.']);
    }

    $clearanceId = $r['clearance_id'];
    if ($d['action'] === 'approve' && $r['requires_clearance']) {
        $clearanceId = val("SELECT clearance_id FROM clearance_requests WHERE student_id = ? AND clearance_status = 'Completed' ORDER BY completed_at DESC LIMIT 1", [$r['student_id']]);
        if (!$clearanceId) fail(422, "Cannot approve: {$r['document_name']} requires a completed clearance and the student has none.");
    }
    $status = ['approve' => 'Approved', 'correct' => 'For Correction', 'reject' => 'Rejected'][$d['action']];
    $affected = q(
        "UPDATE document_requests SET request_status = ?, reviewed_by = ?, reviewed_at = NOW(), decision_reason = ?, clearance_id = ? WHERE request_id = ? AND request_status = 'Submitted'",
        [$status, $u['user_id'], $d['reason'], $clearanceId, $r['request_id']]
    )->rowCount();
    if ($affected === 0) fail(409, 'This request was already processed.');
    audit('DOCUMENT_' . strtoupper(str_replace(' ', '_', $status)), 'document_requests', $r['request_id'], ['status' => 'Submitted'], ['status' => $status, 'reason' => $d['reason']]);

    $fee = document_fee((int) $r['document_type_id'], (int) $r['copies']);
    $msg = match ($status) {
        'Approved' => "Your {$r['document_name']} request was approved." . ($fee['total'] > 0 ? ' Please pay ₱' . number_format($fee['total'], 2) . ' under Payments.' : ' No fee is due.'),
        'For Correction' => "Your {$r['document_name']} request needs correction: {$d['reason']}",
        'Rejected' => "Your {$r['document_name']} request was rejected: {$d['reason']}",
    };
    notify(student_user_id((int) $r['student_id']), "Document request $status", $msg, 'document_requests', $r['request_id']);
    return ['message' => "Request marked as $status."];
});

$router->post('/registrar/documents/{id}/release', function ($p) {
    $u = require_perm('documents.release');
    $r = one("SELECT r.*, dt.document_name FROM document_requests r JOIN document_types dt ON dt.document_type_id = r.document_type_id WHERE r.request_id = ?", [(int) $p['id']]);
    if (!$r) fail(404, 'Document request not found.');
    if ($r['request_status'] !== 'Approved') fail(409, "Only approved requests can be released (current: {$r['request_status']}).");
    $fee = document_fee((int) $r['document_type_id'], (int) $r['copies']);
    if ($fee['total'] > 0 && payment_state('document_request_id', (int) $r['request_id'])['state'] !== 'Confirmed') {
        fail(409, 'Cannot release: payment of ₱' . number_format($fee['total'], 2) . ' is not yet confirmed by the Cashier.');
    }
    $affected = q("UPDATE document_requests SET request_status = 'Released', released_by = ?, released_at = NOW() WHERE request_id = ? AND request_status = 'Approved'", [$u['user_id'], $r['request_id']])->rowCount();
    if ($affected === 0) fail(409, 'This request was already released.');
    audit('DOCUMENT_RELEASED', 'document_requests', $r['request_id'], ['status' => 'Approved'], ['status' => 'Released', 'channel' => $r['delivery_channel']]);
    $how = ['Pickup' => 'It is ready for pickup at the Registrar\'s Office.', 'Email' => 'It was sent to your registered email address.', 'Courier' => 'It was handed to the courier for delivery.'][$r['delivery_channel']];
    notify(student_user_id((int) $r['student_id']), 'Document released', "Your {$r['document_name']} has been released. $how", 'document_requests', $r['request_id']);
    return ['message' => "{$r['document_name']} released via {$r['delivery_channel']}."];
});
