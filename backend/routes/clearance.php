<?php
/**
 * Clearance processing for every office that requires clearance (Department, Registrar, Cashier).
 * Each staff member only sees and decides for their own office.
 * @var Router $router
 */

$router->get('/clearance/queue', function () {
    [$u, $officeId] = require_staff('clearance.decide');
    $status = query_param('status', 'For Review');
    $sql = "SELECT d.*, c.purpose, c.clearance_status, c.submitted_at, c.student_id,
                   s.student_number, s.first_name, s.last_name, s.year_level, p.program_code, t.school_year, t.semester,
                   " . name_sql('d.decided_by') . " AS decided_by_name,
                   (SELECT COUNT(*) FROM clearance_office_decisions x WHERE x.clearance_id = c.clearance_id) AS total_offices,
                   (SELECT COUNT(*) FROM clearance_office_decisions x WHERE x.clearance_id = c.clearance_id AND x.decision_status = 'Approved') AS approved_offices
              FROM clearance_office_decisions d
              JOIN clearance_requests c ON c.clearance_id = d.clearance_id
              JOIN students s ON s.student_id = c.student_id
              JOIN programs p ON p.program_id = s.program_id
              JOIN academic_terms t ON t.term_id = c.term_id
             WHERE d.office_id = ?";
    $params = [$officeId];
    if ($status !== 'All') {
        $sql .= " AND d.decision_status = ?";
        $params[] = $status;
        if ($status !== 'Approved') $sql .= " AND c.clearance_status = 'In Progress'";
    }
    $sql .= " ORDER BY COALESCE(d.resubmitted_at, c.submitted_at) DESC LIMIT 300";
    $rows = all($sql, $params);

    // Help the Cashier check financial obligations: unconfirmed fees of the student
    $isCashier = $u['staff']['office_type'] === 'Cashier';
    foreach ($rows as &$r) {
        $r['term_label'] = term_label($r);
        if ($isCashier) {
            $unpaid = [];
            foreach (all("SELECT enrollment_id FROM enrollments WHERE student_id = ? AND enrollment_status IN ('Approved','Finalized')", [$r['student_id']]) as $e) {
                $fees = enrollment_fees((int) $e['enrollment_id']);
                if ($fees['total'] > 0 && payment_state('enrollment_id', (int) $e['enrollment_id'])['state'] !== 'Confirmed') $unpaid[] = "Enrollment #{$e['enrollment_id']}: ₱" . number_format($fees['total'], 2);
            }
            foreach (all("SELECT request_id, document_type_id, copies FROM document_requests WHERE student_id = ? AND request_status IN ('Approved','Released')", [$r['student_id']]) as $dr) {
                $fee = document_fee((int) $dr['document_type_id'], (int) $dr['copies']);
                if ($fee['total'] > 0 && payment_state('document_request_id', (int) $dr['request_id'])['state'] !== 'Confirmed') $unpaid[] = "Document #{$dr['request_id']}: ₱" . number_format($fee['total'], 2);
            }
            $r['outstanding'] = $unpaid;
        }
    }
    return ['office' => $u['staff']['office_name'], 'office_type' => $u['staff']['office_type'], 'items' => $rows];
});

$router->post('/clearance/decisions/{id}', function ($p) {
    [$u, $officeId] = require_staff('clearance.decide');
    $d = validate([
        'action' => 'required|in:approve,pending',
        'pending_items' => 'nullable|max:500',
    ]);
    $dec = one(
        "SELECT d.*, c.student_id, c.clearance_status, o.office_name FROM clearance_office_decisions d
           JOIN clearance_requests c ON c.clearance_id = d.clearance_id JOIN offices o ON o.office_id = d.office_id
          WHERE d.decision_id = ?",
        [(int) $p['id']]
    );
    if (!$dec) fail(404, 'Clearance item not found.');
    if ((int) $dec['office_id'] !== $officeId) fail(403, 'You can only decide clearance items for your own office.');
    if ($dec['clearance_status'] !== 'In Progress') fail(409, "This clearance is already {$dec['clearance_status']}.");
    if ($dec['decision_status'] === 'Approved') fail(409, 'Your office has already approved this clearance.');
    if ($d['action'] === 'pending' && mb_strlen((string) $d['pending_items']) < 5) {
        fail(422, 'Please correct the highlighted fields.', ['pending_items' => 'List the requirements the student must resolve.']);
    }

    $status = $d['action'] === 'approve' ? 'Approved' : 'Pending Requirements';
    $studentUser = student_user_id((int) $dec['student_id']);

    $completed = tx(function () use ($dec, $d, $status, $u, $studentUser) {
        q(
            "UPDATE clearance_office_decisions SET decision_status = ?, pending_items = ?, decided_by = ?, decided_at = NOW() WHERE decision_id = ?",
            [$status, $d['action'] === 'pending' ? $d['pending_items'] : $dec['pending_items'], $u['user_id'], $dec['decision_id']]
        );
        audit('CLEARANCE_' . strtoupper(str_replace(' ', '_', $status)), 'clearance_office_decisions', $dec['decision_id'], ['status' => $dec['decision_status']], ['status' => $status, 'pending_items' => $d['pending_items']]);

        if ($status === 'Pending Requirements') {
            notify($studentUser, "Clearance pending - {$dec['office_name']}", "{$dec['office_name']} needs: {$d['pending_items']}. Resolve it and resubmit to this office.", 'clearance_requests', $dec['clearance_id']);
            return false;
        }
        notify($studentUser, "Clearance approved - {$dec['office_name']}", "{$dec['office_name']} approved your clearance.", 'clearance_requests', $dec['clearance_id']);

        // Overall clearance completes only when EVERY required office has approved
        $remaining = (int) val("SELECT COUNT(*) FROM clearance_office_decisions WHERE clearance_id = ? AND decision_status <> 'Approved'", [$dec['clearance_id']]);
        if ($remaining === 0) {
            q("UPDATE clearance_requests SET clearance_status = 'Completed', completed_at = NOW() WHERE clearance_id = ?", [$dec['clearance_id']]);
            audit('CLEARANCE_COMPLETED', 'clearance_requests', $dec['clearance_id'], ['status' => 'In Progress'], ['status' => 'Completed']);
            notify($studentUser, 'Clearance completed', 'All required offices approved. Your clearance is complete.', 'clearance_requests', $dec['clearance_id']);
            return true;
        }
        return false;
    });

    return ['message' => $completed ? 'Approved. All offices have approved - clearance is now Completed.' : "Marked as $status."];
});
