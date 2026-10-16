<?php
/**
 * Cashier Module: verify payments, issue official receipts.
 * @var Router $router
 */

$paymentSelect = "SELECT p.*, r.receipt_id, r.receipt_number, r.issued_at,
           s.student_number, s.first_name, s.last_name, pr.program_code,
           " . name_sql('p.verified_by') . " AS verified_by_name,
           CASE WHEN p.enrollment_id IS NOT NULL THEN CONCAT('Enrollment - ', t.semester, ' Sem, SY ', t.school_year)
                ELSE CONCAT(dt.document_name, ' x', d.copies, ' (Request #', d.request_id, ')') END AS description
      FROM payments p
      LEFT JOIN receipts r ON r.payment_id = p.payment_id
      LEFT JOIN enrollments e ON e.enrollment_id = p.enrollment_id
      LEFT JOIN academic_terms t ON t.term_id = e.term_id
      LEFT JOIN document_requests d ON d.request_id = p.document_request_id
      LEFT JOIN document_types dt ON dt.document_type_id = d.document_type_id
      JOIN students s ON s.student_id = COALESCE(e.student_id, d.student_id)
      JOIN programs pr ON pr.program_id = s.program_id";

$router->get('/cashier/payments', function () use ($paymentSelect) {
    require_perm('payments.verify');
    $status = query_param('status');
    $sql = $paymentSelect;
    $params = [];
    if ($status === 'NoReceipt') {
        $sql .= " WHERE p.payment_status = 'Confirmed' AND r.receipt_id IS NULL";
    } elseif ($status) {
        $sql .= " WHERE p.payment_status = ?";
        $params[] = $status;
    }
    $sql .= " ORDER BY FIELD(p.payment_status,'Submitted','Confirmed','Unconfirmed','Cancelled'), p.submitted_at DESC LIMIT 300";
    return ['payments' => all($sql, $params)];
});

$router->post('/cashier/payments/{id}/verify', function ($p) {
    $u = require_perm('payments.verify');
    $d = validate([
        'action' => 'required|in:confirm,unconfirm',
        'remarks' => 'nullable|max:255',
    ]);
    $pay = one("SELECT p.*, COALESCE(e.student_id, dr.student_id) AS student_id FROM payments p
                  LEFT JOIN enrollments e ON e.enrollment_id = p.enrollment_id
                  LEFT JOIN document_requests dr ON dr.request_id = p.document_request_id
                 WHERE p.payment_id = ?", [(int) $p['id']]);
    if (!$pay) fail(404, 'Payment not found.');
    if ($pay['payment_status'] !== 'Submitted') fail(409, "Only submitted payments can be verified (current: {$pay['payment_status']}).");
    if ($d['action'] === 'unconfirm' && mb_strlen((string) $d['remarks']) < 5) {
        fail(422, 'Please correct the highlighted fields.', ['remarks' => 'State why the payment could not be confirmed (at least 5 characters).']);
    }
    $status = $d['action'] === 'confirm' ? 'Confirmed' : 'Unconfirmed';
    $affected = q(
        "UPDATE payments SET payment_status = ?, verified_by = ?, verified_at = NOW(), remarks = ? WHERE payment_id = ? AND payment_status = 'Submitted'",
        [$status, $u['user_id'], $d['remarks'], $pay['payment_id']]
    )->rowCount();
    if ($affected === 0) fail(409, 'This payment was already verified.');
    audit('PAYMENT_' . strtoupper($status), 'payments', $pay['payment_id'], ['status' => 'Submitted'], ['status' => $status, 'remarks' => $d['remarks']]);
    $amount = '₱' . number_format((float) $pay['amount'], 2);
    notify(
        student_user_id((int) $pay['student_id']),
        "Payment $status",
        $status === 'Confirmed'
            ? "Your payment of $amount was confirmed. An official receipt will be issued."
            : "Your payment of $amount could not be confirmed: {$d['remarks']}. Please submit a new payment.",
        'payments',
        $pay['payment_id']
    );
    return ['message' => "Payment marked as $status."];
});

// Issue an official receipt - only for confirmed payments, one receipt per payment
$router->post('/cashier/payments/{id}/receipt', function ($p) {
    $u = require_perm('receipts.issue');
    $pay = one("SELECT p.*, COALESCE(e.student_id, dr.student_id) AS student_id FROM payments p
                  LEFT JOIN enrollments e ON e.enrollment_id = p.enrollment_id
                  LEFT JOIN document_requests dr ON dr.request_id = p.document_request_id
                 WHERE p.payment_id = ?", [(int) $p['id']]);
    if (!$pay) fail(404, 'Payment not found.');
    if ($pay['payment_status'] !== 'Confirmed') fail(409, 'A receipt can only be issued for a confirmed payment.');
    if (val("SELECT receipt_id FROM receipts WHERE payment_id = ?", [$pay['payment_id']])) fail(409, 'A receipt was already issued for this payment.');

    $number = 'OR-' . date('Y') . '-' . str_pad((string) $pay['payment_id'], 6, '0', STR_PAD_LEFT);
    q("INSERT INTO receipts (payment_id, receipt_number, issued_by) VALUES (?, ?, ?)", [$pay['payment_id'], $number, $u['user_id']]);
    $rid = last_id();
    audit('RECEIPT_ISSUED', 'receipts', $rid, null, ['receipt_number' => $number, 'payment_id' => $pay['payment_id'], 'amount' => $pay['amount']]);
    notify(student_user_id((int) $pay['student_id']), 'Official receipt issued', "Official Receipt $number for ₱" . number_format((float) $pay['amount'], 2) . ' is now available under Payments.', 'receipts', $rid);
    return ['message' => "Official Receipt $number issued.", 'receipt_id' => $rid, 'receipt_number' => $number];
});

$router->get('/cashier/receipts', function () {
    require_perm('payments.verify');
    return ['receipts' => all(
        "SELECT r.*, p.amount, p.payment_method, s.student_number, CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                " . name_sql('r.issued_by') . " AS issued_by_name
           FROM receipts r
           JOIN payments p ON p.payment_id = r.payment_id
           LEFT JOIN enrollments e ON e.enrollment_id = p.enrollment_id
           LEFT JOIN document_requests d ON d.request_id = p.document_request_id
           JOIN students s ON s.student_id = COALESCE(e.student_id, d.student_id)
          ORDER BY r.receipt_id DESC LIMIT 300"
    )];
});
