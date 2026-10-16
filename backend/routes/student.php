<?php
/**
 * Student Portal: profile, grades, subjects, enrollment, document requests, clearance, payments.
 * Students can only ever access their own records (student_id always comes from the session).
 * @var Router $router
 */

/* ------------------------------ PROFILE ------------------------------ */

$router->get('/student/profile', function () {
    [$u] = require_student();
    return ['profile' => $u['student'], 'username' => $u['username'], 'last_login_at' => $u['last_login_at']];
});

$router->put('/student/profile', function () {
    [$u, $sid] = require_student();
    // Only these fields may be changed by the student; other fields are maintained by the Registrar/Admin.
    $d = validate([
        'email' => 'required|email|max:150',
        'contact_number' => 'nullable|max:30|regex:/^[0-9+\-\s()]{7,30}$/',
        'address' => 'nullable|max:255',
    ]);
    $old = array_intersect_key($u['student'], $d);
    q("UPDATE students SET email = ?, contact_number = ?, address = ? WHERE student_id = ?", [$d['email'], $d['contact_number'], $d['address'], $sid]);
    audit('PROFILE_UPDATED', 'students', $sid, $old, $d);
    return ['message' => 'Profile updated.', 'profile' => current_user(true)['student']];
});

/* ------------------------------ GRADES & SUBJECTS ------------------------------ */

$router->get('/student/grades', function () {
    [, $sid] = require_student();
    $rows = all(
        "SELECT t.term_id, t.school_year, t.semester, c.course_code, c.course_name, c.units, o.section_code,
                g.grade_value, g.special_mark, g.published_at
           FROM grades g
           JOIN enrollment_subjects es ON es.enrollment_subject_id = g.enrollment_subject_id
           JOIN enrollments e ON e.enrollment_id = es.enrollment_id
           JOIN course_offerings o ON o.offering_id = es.offering_id
           JOIN courses c ON c.course_id = o.course_id
           JOIN academic_terms t ON t.term_id = e.term_id
          WHERE e.student_id = ? AND g.grade_status = 'Published'
          ORDER BY t.start_date DESC, c.course_code",
        [$sid]
    );
    $terms = [];
    foreach ($rows as $r) {
        $r['remarks'] = grade_remark($r['grade_value'], $r['special_mark']);
        $key = $r['term_id'];
        $terms[$key] ??= ['term_id' => $r['term_id'], 'label' => term_label($r), 'grades' => []];
        $terms[$key]['grades'][] = $r;
    }
    foreach ($terms as &$t) {
        $t['gwa'] = compute_gwa($t['grades']);
        $t['units'] = array_sum(array_column($t['grades'], 'units'));
    }
    return ['terms' => array_values($terms), 'gwa' => compute_gwa($rows)];
});

$router->get('/student/subjects', function () {
    [, $sid] = require_student();
    $enr = one(
        "SELECT e.*, t.school_year, t.semester FROM enrollments e JOIN academic_terms t ON t.term_id = e.term_id
          WHERE e.student_id = ? AND e.enrollment_status NOT IN ('Cancelled','Rejected')
          ORDER BY t.start_date DESC, e.enrollment_id DESC LIMIT 1",
        [$sid]
    );
    if (!$enr) return ['enrollment' => null, 'subjects' => []];
    $enr['term_label'] = term_label($enr);
    return ['enrollment' => $enr, 'subjects' => enrollment_subject_rows((int) $enr['enrollment_id'], $sid)];
});

/* ------------------------------ ENROLLMENT ------------------------------ */

function student_enrollment_for_term(int $sid, int $termId): ?array
{
    return one(
        "SELECT * FROM enrollments WHERE student_id = ? AND term_id = ? ORDER BY enrollment_id DESC LIMIT 1",
        [$sid, $termId]
    );
}

function own_enrollment(int $id, int $sid): array
{
    $e = one("SELECT * FROM enrollments WHERE enrollment_id = ? AND student_id = ?", [$id, $sid]);
    if (!$e) fail(404, 'Enrollment application not found.');
    return $e;
}

$router->get('/student/enrollment', function () {
    [$u, $sid] = require_student();
    $term = open_term();
    $history = all(
        "SELECT e.enrollment_id, e.enrollment_status, e.cor_number, e.submitted_at, e.finalized_at, t.school_year, t.semester
           FROM enrollments e JOIN academic_terms t ON t.term_id = e.term_id
          WHERE e.student_id = ? ORDER BY e.enrollment_id DESC",
        [$sid]
    );
    foreach ($history as &$h) $h['term_label'] = term_label($h);
    unset($h);

    if (!$term) {
        return ['term' => null, 'enrollment' => null, 'offerings' => [], 'history' => $history];
    }

    $enr = student_enrollment_for_term($sid, (int) $term['term_id']);
    $passed = passed_course_ids($sid);
    $offerings = all(
        "SELECT o.offering_id, o.section_code, o.capacity, o.offering_status,
                c.course_id, c.course_code, c.course_name, c.units, d.department_code
           FROM course_offerings o
           JOIN courses c ON c.course_id = o.course_id
           JOIN departments d ON d.department_id = c.department_id
          WHERE o.term_id = ? AND o.offering_status = 'Open' AND c.course_status = 'Active'
          ORDER BY (d.department_id = ?) DESC, c.course_code, o.section_code",
        [$term['term_id'], $u['student']['department_id']]
    );
    foreach ($offerings as &$o) {
        $o['prerequisites'] = prerequisite_status((int) $o['course_id'], $passed);
        $o['prerequisites_met'] = !in_array(false, array_column($o['prerequisites'], 'met'), true);
        $o['already_passed'] = in_array((int) $o['course_id'], $passed, true);
        $o['seats_taken'] = seats_taken((int) $o['offering_id']);
        $o['is_full'] = $o['seats_taken'] >= (int) $o['capacity'];
    }
    unset($o);

    $data = ['term' => $term, 'enrollment' => null, 'offerings' => $offerings, 'history' => $history, 'max_units' => cfg('max_units_per_term')];
    if ($enr) {
        $enr['reviewed_by_name'] = $enr['reviewed_by'] ? val("SELECT " . name_sql('?'), [$enr['reviewed_by']]) : null;
        $data['enrollment'] = $enr;
        $data['subjects'] = enrollment_subject_rows((int) $enr['enrollment_id'], $sid);
        $data['fees'] = enrollment_fees((int) $enr['enrollment_id']);
        $data['payment'] = payment_state('enrollment_id', (int) $enr['enrollment_id']);
    }
    return $data;
});

// Save (create or update) the draft application with the selected subjects
$router->post('/student/enrollment', function () {
    [$u, $sid] = require_student('enrollment.submit');
    $term = open_term();
    if (!$term) fail(409, 'There is no academic term open for enrollment.');
    if (!$term['enrollment_window_open']) fail(409, "Enrollment is only accepted from {$term['enrollment_start']} to {$term['enrollment_end']}.");
    if ($u['student']['student_status'] !== 'Active') fail(403, 'Only active students may enroll.');

    $d = validate(['offering_ids' => 'required|array']);
    $ids = array_values(array_unique(array_map('intval', $d['offering_ids'])));

    $existing = student_enrollment_for_term($sid, (int) $term['term_id']);
    if ($existing && !in_array($existing['enrollment_status'], ['Draft', 'For Correction', 'Cancelled', 'Rejected'], true)) {
        fail(409, "Your enrollment application is already {$existing['enrollment_status']} and can no longer be edited.");
    }
    if ($existing && in_array($existing['enrollment_status'], ['Cancelled', 'Rejected'], true)) {
        $existing = null; // start a new application
    }

    $offerings = all(
        "SELECT o.*, c.course_code, c.units FROM course_offerings o JOIN courses c ON c.course_id = o.course_id
          WHERE o.offering_id IN (" . placeholders($ids) . ") AND o.term_id = ? AND o.offering_status = 'Open' AND c.course_status = 'Active'",
        [...$ids, $term['term_id']]
    );
    if (count($offerings) !== count($ids)) fail(422, 'One or more selected subjects are not offered this term.');

    $passed = passed_course_ids($sid);
    $errors = [];
    $courses = [];
    $units = 0;
    foreach ($offerings as $o) {
        if (isset($courses[$o['course_id']])) $errors[] = "{$o['course_code']} was selected more than once.";
        $courses[$o['course_id']] = true;
        $units += (int) $o['units'];
        if (in_array((int) $o['course_id'], $passed, true)) $errors[] = "{$o['course_code']} has already been passed.";
        foreach (prerequisite_status((int) $o['course_id'], $passed) as $pr) {
            if (!$pr['met']) $errors[] = "{$o['course_code']} requires {$pr['course_code']} to be passed first.";
        }
        if (seats_taken((int) $o['offering_id']) >= (int) $o['capacity']) $errors[] = "{$o['course_code']} ({$o['section_code']}) is already full.";
    }
    if ($units > cfg('max_units_per_term')) $errors[] = "Total units ($units) exceed the maximum of " . cfg('max_units_per_term') . '.';
    if ($errors) fail(422, 'The subject selection is not valid.', ['subjects' => $errors]);

    $id = tx(function () use ($existing, $sid, $term, $ids) {
        if ($existing) {
            $id = (int) $existing['enrollment_id'];
            q("DELETE FROM enrollment_subjects WHERE enrollment_id = ?", [$id]);
        } else {
            q("INSERT INTO enrollments (student_id, term_id, enrollment_status) VALUES (?, ?, 'Draft')", [$sid, $term['term_id']]);
            $id = last_id();
            audit('ENROLLMENT_CREATED', 'enrollments', $id, null, ['status' => 'Draft']);
        }
        foreach ($ids as $oid) {
            q("INSERT INTO enrollment_subjects (enrollment_id, offering_id) VALUES (?, ?)", [$id, $oid]);
        }
        audit('ENROLLMENT_SUBJECTS_SAVED', 'enrollments', $id, null, ['offering_ids' => $ids]);
        return $id;
    });
    return ['message' => 'Subject selection saved as draft.', 'enrollment_id' => $id];
});

$router->post('/student/enrollment/{id}/submit', function ($p) {
    [$u, $sid] = require_student('enrollment.submit');
    $e = own_enrollment((int) $p['id'], $sid);
    if (!in_array($e['enrollment_status'], ['Draft', 'For Correction'], true)) fail(409, "This application is already {$e['enrollment_status']}.");
    $term = open_term();
    if (!$term || (int) $term['term_id'] !== (int) $e['term_id'] || !$term['enrollment_window_open']) fail(409, 'The enrollment period for this term is closed.');
    if ((int) val("SELECT COUNT(*) FROM enrollment_subjects WHERE enrollment_id = ?", [$e['enrollment_id']]) === 0) {
        fail(422, 'Select at least one subject before submitting.');
    }
    q("UPDATE enrollments SET enrollment_status = 'Submitted', submitted_at = NOW() WHERE enrollment_id = ?", [$e['enrollment_id']]);
    audit('ENROLLMENT_SUBMITTED', 'enrollments', $e['enrollment_id'], ['status' => $e['enrollment_status']], ['status' => 'Submitted']);
    notify_role('REGISTRAR', 'New enrollment application', "{$u['display_name']} ({$u['student']['student_number']}) submitted an enrollment application.", 'enrollments', $e['enrollment_id']);
    return ['message' => 'Enrollment application submitted to the Registrar.'];
});

$router->post('/student/enrollment/{id}/cancel', function ($p) {
    [, $sid] = require_student('enrollment.submit');
    $e = own_enrollment((int) $p['id'], $sid);
    if (!in_array($e['enrollment_status'], ['Draft', 'Submitted', 'For Correction'], true)) {
        fail(409, "An application that is {$e['enrollment_status']} can no longer be cancelled.");
    }
    q("UPDATE enrollments SET enrollment_status = 'Cancelled', cancelled_at = NOW() WHERE enrollment_id = ?", [$e['enrollment_id']]);
    audit('ENROLLMENT_CANCELLED', 'enrollments', $e['enrollment_id'], ['status' => $e['enrollment_status']], ['status' => 'Cancelled']);
    notify(student_user_id($sid), 'Enrollment cancelled', 'Your enrollment application was cancelled.', 'enrollments', $e['enrollment_id']);
    return ['message' => 'Enrollment application cancelled.'];
});

/* ------------------------------ DOCUMENT REQUESTS ------------------------------ */

function own_document_request(int $id, int $sid): array
{
    $r = one("SELECT * FROM document_requests WHERE request_id = ? AND student_id = ?", [$id, $sid]);
    if (!$r) fail(404, 'Document request not found.');
    return $r;
}

$router->get('/student/documents', function () {
    [, $sid] = require_student();
    $types = all(
        "SELECT dt.document_type_id, dt.document_code, dt.document_name, dt.requires_clearance, dt.processing_days,
                f.fee_name, f.fee_basis, CASE WHEN f.fee_status = 'Active' THEN f.amount ELSE 0 END AS fee_amount
           FROM document_types dt LEFT JOIN fees f ON f.fee_id = dt.fee_id
          WHERE dt.document_status = 'Active' ORDER BY dt.document_name"
    );
    $requests = all(
        "SELECT r.*, dt.document_code, dt.document_name, dt.requires_clearance, dt.processing_days
           FROM document_requests r JOIN document_types dt ON dt.document_type_id = r.document_type_id
          WHERE r.student_id = ? ORDER BY r.request_id DESC",
        [$sid]
    );
    foreach ($requests as &$r) {
        $r['fee'] = document_fee((int) $r['document_type_id'], (int) $r['copies']);
        $r['payment'] = payment_state('document_request_id', (int) $r['request_id']);
    }
    $clearance = one("SELECT clearance_id, completed_at FROM clearance_requests WHERE student_id = ? AND clearance_status = 'Completed' ORDER BY completed_at DESC LIMIT 1", [$sid]);
    return ['types' => $types, 'requests' => $requests, 'completed_clearance' => $clearance, 'max_copies' => cfg('max_document_copies')];
});

$documentRules = fn () => [
    'document_type_id' => 'required|int',
    'purpose' => 'required|min:5|max:255',
    'copies' => 'required|int|between:1,' . cfg('max_document_copies'),
    'delivery_channel' => 'required|in:Pickup,Email,Courier',
];

$router->post('/student/documents', function () use ($documentRules) {
    [$u, $sid] = require_student('documents.request');
    $d = validate($documentRules());
    $type = one("SELECT * FROM document_types WHERE document_type_id = ? AND document_status = 'Active'", [$d['document_type_id']]);
    if (!$type) fail(422, 'Please correct the highlighted fields.', ['document_type_id' => 'Selected document type is not available.']);
    if ($u['student']['student_status'] === 'Inactive') fail(403, 'Inactive students cannot request documents. Please contact the Registrar.');

    $dup = val("SELECT request_id FROM document_requests WHERE student_id = ? AND document_type_id = ? AND request_status IN ('Submitted','For Correction')", [$sid, $d['document_type_id']]);
    if ($dup) fail(409, "You already have a pending {$type['document_name']} request (#$dup).");

    $clearanceId = null;
    if ($type['requires_clearance']) {
        $clearanceId = val("SELECT clearance_id FROM clearance_requests WHERE student_id = ? AND clearance_status = 'Completed' ORDER BY completed_at DESC LIMIT 1", [$sid]);
    }
    q(
        "INSERT INTO document_requests (student_id, document_type_id, clearance_id, purpose, copies, delivery_channel) VALUES (?, ?, ?, ?, ?, ?)",
        [$sid, $d['document_type_id'], $clearanceId, $d['purpose'], $d['copies'], $d['delivery_channel']]
    );
    $id = last_id();
    audit('DOCUMENT_REQUESTED', 'document_requests', $id, null, $d);
    notify_role('REGISTRAR', 'New document request', "{$u['display_name']} requested {$type['document_name']} ({$d['copies']}).", 'document_requests', $id);

    $msg = 'Request submitted to the Registrar.';
    if ($type['requires_clearance'] && !$clearanceId) {
        $msg .= ' Note: this document requires a completed clearance. Please file a clearance request.';
    }
    return ['message' => $msg, 'request_id' => $id];
});

// Edit a request that was returned for correction (goes back to Submitted)
$router->put('/student/documents/{id}', function ($p) use ($documentRules) {
    [$u, $sid] = require_student('documents.request');
    $r = own_document_request((int) $p['id'], $sid);
    if ($r['request_status'] !== 'For Correction') fail(409, 'Only requests returned for correction can be edited.');
    $d = validate($documentRules());
    if ((int) $d['document_type_id'] !== (int) $r['document_type_id']) fail(422, 'The document type cannot be changed. Cancel and file a new request instead.');
    q(
        "UPDATE document_requests SET purpose = ?, copies = ?, delivery_channel = ?, request_status = 'Submitted', submitted_at = NOW() WHERE request_id = ?",
        [$d['purpose'], $d['copies'], $d['delivery_channel'], $r['request_id']]
    );
    audit('DOCUMENT_RESUBMITTED', 'document_requests', $r['request_id'], array_intersect_key($r, $d), $d);
    notify_role('REGISTRAR', 'Corrected document request', "{$u['display_name']} resubmitted document request #{$r['request_id']}.", 'document_requests', $r['request_id']);
    return ['message' => 'Corrected request resubmitted.'];
});

$router->post('/student/documents/{id}/cancel', function ($p) {
    [, $sid] = require_student('documents.request');
    $r = own_document_request((int) $p['id'], $sid);
    $pay = payment_state('document_request_id', (int) $r['request_id']);
    $cancellable = in_array($r['request_status'], ['Submitted', 'For Correction'], true)
        || ($r['request_status'] === 'Approved' && $pay['state'] === 'Unpaid');
    if (!$cancellable) fail(409, "A request that is {$r['request_status']}" . ($pay['state'] !== 'Unpaid' ? ' with a recorded payment' : '') . ' can no longer be cancelled.');
    q("UPDATE document_requests SET request_status = 'Cancelled', cancelled_at = NOW() WHERE request_id = ?", [$r['request_id']]);
    audit('DOCUMENT_CANCELLED', 'document_requests', $r['request_id'], ['status' => $r['request_status']], ['status' => 'Cancelled']);
    notify(student_user_id($sid), 'Document request cancelled', "Your document request #{$r['request_id']} was cancelled.", 'document_requests', $r['request_id']);
    return ['message' => 'Document request cancelled.'];
});

/* ------------------------------ CLEARANCE ------------------------------ */

function own_clearance(int $id, int $sid): array
{
    $c = one("SELECT * FROM clearance_requests WHERE clearance_id = ? AND student_id = ?", [$id, $sid]);
    if (!$c) fail(404, 'Clearance request not found.');
    return $c;
}

$router->get('/student/clearances', function () {
    [, $sid] = require_student();
    $rows = all(
        "SELECT c.*, t.school_year, t.semester FROM clearance_requests c JOIN academic_terms t ON t.term_id = c.term_id
          WHERE c.student_id = ? ORDER BY c.clearance_id DESC",
        [$sid]
    );
    foreach ($rows as &$c) {
        $c['term_label'] = term_label($c);
        $c['decisions'] = all(
            "SELECT d.*, o.office_code, o.office_name, o.office_type, " . name_sql('d.decided_by') . " AS decided_by_name
               FROM clearance_office_decisions d JOIN offices o ON o.office_id = d.office_id
              WHERE d.clearance_id = ? ORDER BY FIELD(o.office_type, 'Department', 'Registrar', 'Cashier', 'Administration'), o.office_name",
            [$c['clearance_id']]
        );
        $c['approved_count'] = count(array_filter($c['decisions'], fn ($d) => $d['decision_status'] === 'Approved'));
    }
    return ['clearances' => $rows, 'open_term' => open_term()];
});

$router->post('/student/clearances', function () {
    [$u, $sid] = require_student('clearance.request');
    $d = validate(['purpose' => 'required|min:5|max:255']);
    $term = open_term();
    if (!$term) fail(409, 'There is no open academic term for clearance.');
    $dup = val("SELECT clearance_id FROM clearance_requests WHERE student_id = ? AND term_id = ? AND clearance_status IN ('In Progress','Completed')", [$sid, $term['term_id']]);
    if ($dup) fail(409, "You already have a clearance request for this term (#$dup).");

    // Required offices: the student's own department + all non-department offices that require clearance
    $offices = all(
        "SELECT office_id, office_name FROM offices
          WHERE requires_clearance = 1 AND office_status = 'Active'
            AND (office_type <> 'Department' OR office_id = ?)",
        [$u['student']['department_office_id']]
    );
    if (!$offices) fail(409, 'No clearance offices are configured. Please contact the administrator.');

    $id = tx(function () use ($sid, $term, $d, $offices, $u) {
        q("INSERT INTO clearance_requests (student_id, term_id, purpose) VALUES (?, ?, ?)", [$sid, $term['term_id'], $d['purpose']]);
        $id = last_id();
        foreach ($offices as $o) {
            q("INSERT INTO clearance_office_decisions (clearance_id, office_id) VALUES (?, ?)", [$id, $o['office_id']]);
            notify_office((int) $o['office_id'], 'New clearance request', "{$u['display_name']} ({$u['student']['student_number']}) requested clearance.", 'clearance_requests', $id);
        }
        audit('CLEARANCE_REQUESTED', 'clearance_requests', $id, null, ['purpose' => $d['purpose'], 'offices' => array_column($offices, 'office_name')]);
        return $id;
    });
    return ['message' => 'Clearance request routed to ' . count($offices) . ' offices.', 'clearance_id' => $id];
});

// Resubmit to the same office after resolving its pending requirements
$router->post('/student/clearances/{id}/decisions/{did}/resubmit', function ($p) {
    [$u, $sid] = require_student('clearance.request');
    $c = own_clearance((int) $p['id'], $sid);
    if ($c['clearance_status'] !== 'In Progress') fail(409, "This clearance is already {$c['clearance_status']}.");
    $dec = one("SELECT d.*, o.office_name FROM clearance_office_decisions d JOIN offices o ON o.office_id = d.office_id WHERE d.decision_id = ? AND d.clearance_id = ?", [(int) $p['did'], $c['clearance_id']]);
    if (!$dec) fail(404, 'Office decision not found.');
    if ($dec['decision_status'] !== 'Pending Requirements') fail(409, 'Only offices with pending requirements can be resubmitted.');
    $note = trim((string) input('note', ''));
    q("UPDATE clearance_office_decisions SET decision_status = 'For Review', resubmitted_at = NOW() WHERE decision_id = ?", [$dec['decision_id']]);
    audit('CLEARANCE_RESUBMITTED', 'clearance_office_decisions', $dec['decision_id'], ['status' => 'Pending Requirements'], ['status' => 'For Review', 'note' => mb_substr($note, 0, 255)]);
    notify_office((int) $dec['office_id'], 'Clearance resubmitted', "{$u['display_name']} resubmitted clearance #{$c['clearance_id']}" . ($note ? ": $note" : '.'), 'clearance_requests', $c['clearance_id']);
    return ['message' => "Resubmitted to {$dec['office_name']}."];
});

$router->post('/student/clearances/{id}/cancel', function ($p) {
    [, $sid] = require_student('clearance.request');
    $c = own_clearance((int) $p['id'], $sid);
    if ($c['clearance_status'] !== 'In Progress') fail(409, "A clearance that is {$c['clearance_status']} cannot be cancelled.");
    q("UPDATE clearance_requests SET clearance_status = 'Cancelled', cancelled_at = NOW() WHERE clearance_id = ?", [$c['clearance_id']]);
    audit('CLEARANCE_CANCELLED', 'clearance_requests', $c['clearance_id'], ['status' => 'In Progress'], ['status' => 'Cancelled']);
    return ['message' => 'Clearance request cancelled.'];
});

/* ------------------------------ PAYMENTS ------------------------------ */

/** Transactions of a student that carry fees (enrollments and document requests). */
function student_transactions(int $sid): array
{
    $list = [];
    foreach (all("SELECT e.*, t.school_year, t.semester FROM enrollments e JOIN academic_terms t ON t.term_id = e.term_id WHERE e.student_id = ? AND e.enrollment_status IN ('Approved','Finalized') ORDER BY e.enrollment_id DESC", [$sid]) as $e) {
        $fees = enrollment_fees((int) $e['enrollment_id']);
        if ($fees['total'] <= 0) continue;
        $list[] = [
            'transaction_type' => 'enrollment',
            'transaction_id' => (int) $e['enrollment_id'],
            'description' => 'Enrollment - ' . term_label($e),
            'status' => $e['enrollment_status'],
            'amount' => $fees['total'],
            'payment' => payment_state('enrollment_id', (int) $e['enrollment_id']),
        ];
    }
    foreach (all("SELECT r.*, dt.document_name FROM document_requests r JOIN document_types dt ON dt.document_type_id = r.document_type_id WHERE r.student_id = ? AND r.request_status IN ('Approved','Released') ORDER BY r.request_id DESC", [$sid]) as $r) {
        $fee = document_fee((int) $r['document_type_id'], (int) $r['copies']);
        if ($fee['total'] <= 0) continue;
        $list[] = [
            'transaction_type' => 'document',
            'transaction_id' => (int) $r['request_id'],
            'description' => "{$r['document_name']} x{$r['copies']} (Request #{$r['request_id']})",
            'status' => $r['request_status'],
            'amount' => $fee['total'],
            'payment' => payment_state('document_request_id', (int) $r['request_id']),
        ];
    }
    return $list;
}

$router->get('/student/payments', function () {
    [, $sid] = require_student();
    $history = all(
        "SELECT p.*, r.receipt_id, r.receipt_number, r.issued_at,
                CASE WHEN p.enrollment_id IS NOT NULL THEN CONCAT('Enrollment - ', t.semester, ' Sem, SY ', t.school_year)
                     ELSE CONCAT(dt.document_name, ' (Request #', d.request_id, ')') END AS description
           FROM payments p
           LEFT JOIN receipts r ON r.payment_id = p.payment_id
           LEFT JOIN enrollments e ON e.enrollment_id = p.enrollment_id
           LEFT JOIN academic_terms t ON t.term_id = e.term_id
           LEFT JOIN document_requests d ON d.request_id = p.document_request_id
           LEFT JOIN document_types dt ON dt.document_type_id = d.document_type_id
          WHERE e.student_id = ? OR d.student_id = ?
          ORDER BY p.payment_id DESC",
        [$sid, $sid]
    );
    return ['transactions' => student_transactions($sid), 'history' => $history];
});

$router->post('/student/payments', function () {
    [$u, $sid] = require_student('payments.submit');
    $d = validate([
        'transaction_type' => 'required|in:enrollment,document',
        'transaction_id' => 'required|int',
        'payment_method' => 'required|in:Cash,Bank Transfer,E-Wallet',
        'reference_number' => 'nullable|max:50|regex:/^[A-Za-z0-9\-]+$/',
    ]);
    if ($d['payment_method'] !== 'Cash' && !$d['reference_number']) {
        fail(422, 'Please correct the highlighted fields.', ['reference_number' => 'Reference number is required for bank transfer and e-wallet payments.']);
    }

    $tx = null;
    foreach (student_transactions($sid) as $t) {
        if ($t['transaction_type'] === $d['transaction_type'] && $t['transaction_id'] === $d['transaction_id']) $tx = $t;
    }
    if (!$tx) fail(404, 'No payable transaction found. It may not be approved yet or has no fees.');
    if ($tx['payment']['state'] !== 'Unpaid') fail(409, "A payment for this transaction is already {$tx['payment']['state']}.");

    $col = $d['transaction_type'] === 'enrollment' ? 'enrollment_id' : 'document_request_id';
    q(
        "INSERT INTO payments ($col, amount, payment_method, reference_number) VALUES (?, ?, ?, ?)",
        [$tx['transaction_id'], $tx['amount'], $d['payment_method'], $d['reference_number']]
    );
    $id = last_id();
    audit('PAYMENT_SUBMITTED', 'payments', $id, null, ['transaction' => $tx['description'], 'amount' => $tx['amount'], 'method' => $d['payment_method']]);
    notify_role('CASHIER', 'Payment for verification', "{$u['display_name']} submitted a ₱" . number_format($tx['amount'], 2) . " payment for {$tx['description']}.", 'payments', $id);
    return ['message' => 'Payment submitted. The Cashier will verify it.', 'payment_id' => $id];
});
