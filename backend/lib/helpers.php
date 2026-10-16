<?php
/**
 * Shared business helpers: audit trail, notifications, fees, payments, terms.
 */

/** Write an audit log entry (who, what, which record, when). */
function audit(string $action, string $table, $recordId = null, $old = null, $new = null, ?int $userId = null): void
{
    q(
        "INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            $userId ?? uid(),
            $action,
            $table,
            $recordId,
            $old === null ? null : json_encode($old, JSON_UNESCAPED_UNICODE),
            $new === null ? null : json_encode($new, JSON_UNESCAPED_UNICODE),
            $_SERVER['REMOTE_ADDR'] ?? null,
        ]
    );
}

/** Send a notification to one user. */
function notify(int $userId, string $title, string $message, ?string $table = null, $refId = null): void
{
    q(
        "INSERT INTO notifications (user_id, title, message, reference_table, reference_id) VALUES (?, ?, ?, ?, ?)",
        [$userId, $title, $message, $table, $refId]
    );
}

/** Notify every active user with the given role code. */
function notify_role(string $roleCode, string $title, string $message, ?string $table = null, $refId = null): void
{
    $users = all(
        "SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
          WHERE r.role_code = ? AND u.account_status = 'Active'",
        [$roleCode]
    );
    foreach ($users as $row) {
        notify((int) $row['user_id'], $title, $message, $table, $refId);
    }
}

/** Notify every active staff member of an office. */
function notify_office(int $officeId, string $title, string $message, ?string $table = null, $refId = null): void
{
    $users = all(
        "SELECT st.user_id FROM staff st JOIN users u ON u.user_id = st.user_id
          WHERE st.office_id = ? AND st.staff_status = 'Active' AND u.account_status = 'Active'",
        [$officeId]
    );
    foreach ($users as $row) {
        notify((int) $row['user_id'], $title, $message, $table, $refId);
    }
}

function student_user_id(int $studentId): int
{
    return (int) val("SELECT user_id FROM students WHERE student_id = ?", [$studentId]);
}

/** The term currently open for enrollment/clearance, or null. */
function open_term(): ?array
{
    $t = one("SELECT * FROM academic_terms WHERE term_status = 'Open' ORDER BY start_date DESC LIMIT 1");
    if ($t) {
        $today = date('Y-m-d');
        $t['enrollment_window_open'] = $today >= $t['enrollment_start'] && $today <= $t['enrollment_end'];
        $t['label'] = term_label($t);
    }
    return $t;
}

function term_label(array $t): string
{
    return "{$t['semester']} Semester, SY {$t['school_year']}";
}

function money($v): float
{
    return round((float) $v, 2);
}

/** Fee breakdown for an enrollment, based on the active Enrollment fees. */
function enrollment_fees(int $enrollmentId): array
{
    $units = (int) val(
        "SELECT COALESCE(SUM(c.units), 0) FROM enrollment_subjects es
           JOIN course_offerings o ON o.offering_id = es.offering_id
           JOIN courses c ON c.course_id = o.course_id
          WHERE es.enrollment_id = ?",
        [$enrollmentId]
    );
    $lines = [];
    $total = 0.0;
    foreach (all("SELECT * FROM fees WHERE applies_to = 'Enrollment' AND fee_status = 'Active' ORDER BY fee_id") as $f) {
        $sub = $f['fee_basis'] === 'Per Unit' ? $f['amount'] * $units : (float) $f['amount'];
        $lines[] = [
            'fee_name' => $f['fee_name'],
            'fee_basis' => $f['fee_basis'],
            'amount' => money($f['amount']),
            'quantity' => $f['fee_basis'] === 'Per Unit' ? $units : 1,
            'subtotal' => money($sub),
        ];
        $total += $sub;
    }
    return ['units' => $units, 'lines' => $lines, 'total' => money($total)];
}

/** Fee for a document request (0 when the document type has no active fee). */
function document_fee(int $documentTypeId, int $copies): array
{
    $f = one(
        "SELECT f.* FROM document_types dt JOIN fees f ON f.fee_id = dt.fee_id
          WHERE dt.document_type_id = ? AND f.fee_status = 'Active'",
        [$documentTypeId]
    );
    if (!$f) {
        return ['fee_name' => null, 'amount' => 0.0, 'total' => 0.0];
    }
    $total = $f['fee_basis'] === 'Per Copy' ? $f['amount'] * $copies : (float) $f['amount'];
    return ['fee_name' => $f['fee_name'], 'fee_basis' => $f['fee_basis'], 'amount' => money($f['amount']), 'total' => money($total)];
}

/**
 * Payment state for a transaction: Confirmed, Submitted (awaiting cashier), or Unpaid.
 * $column is 'enrollment_id' or 'document_request_id'.
 */
function payment_state(string $column, int $id): array
{
    if (!in_array($column, ['enrollment_id', 'document_request_id'], true)) {
        throw new InvalidArgumentException('bad column');
    }
    $p = one(
        "SELECT p.*, r.receipt_number, r.receipt_id FROM payments p
           LEFT JOIN receipts r ON r.payment_id = p.payment_id
          WHERE p.$column = ? AND p.payment_status IN ('Confirmed', 'Submitted')
          ORDER BY FIELD(p.payment_status, 'Confirmed', 'Submitted'), p.payment_id DESC LIMIT 1",
        [$id]
    );
    $last = $p ?: one("SELECT * FROM payments WHERE $column = ? ORDER BY payment_id DESC LIMIT 1", [$id]);
    return [
        'state' => $p ? $p['payment_status'] : 'Unpaid',
        'payment' => $p,
        'last_payment' => $last,
    ];
}

/** Courses a student has passed (published grade within passing range). */
function passed_course_ids(int $studentId): array
{
    $rows = all(
        "SELECT DISTINCT o.course_id FROM grades g
           JOIN enrollment_subjects es ON es.enrollment_subject_id = g.enrollment_subject_id
           JOIN enrollments e ON e.enrollment_id = es.enrollment_id
           JOIN course_offerings o ON o.offering_id = es.offering_id
          WHERE e.student_id = ? AND g.grade_status = 'Published'
            AND g.grade_value IS NOT NULL AND g.grade_value <= ?",
        [$studentId, cfg('passing_grade')]
    );
    return array_map('intval', array_column($rows, 'course_id'));
}

/** Prerequisites of a course with a met flag for the student. */
function prerequisite_status(int $courseId, array $passedIds): array
{
    $rows = all(
        "SELECT c.course_id, c.course_code, c.course_name FROM course_prerequisites cp
           JOIN courses c ON c.course_id = cp.prerequisite_course_id
          WHERE cp.course_id = ? ORDER BY c.course_code",
        [$courseId]
    );
    foreach ($rows as &$r) {
        $r['met'] = in_array((int) $r['course_id'], $passedIds, true);
    }
    return $rows;
}

/** Number of seats taken in an offering (approved or finalized enrollments). */
function seats_taken(int $offeringId, ?int $excludeEnrollmentId = null): int
{
    return (int) val(
        "SELECT COUNT(*) FROM enrollment_subjects es JOIN enrollments e ON e.enrollment_id = es.enrollment_id
          WHERE es.offering_id = ? AND e.enrollment_status IN ('Approved', 'Finalized') AND e.enrollment_id <> ?",
        [$offeringId, $excludeEnrollmentId ?? 0]
    );
}

/** Subjects in an enrollment with prerequisite and capacity checks. */
function enrollment_subject_rows(int $enrollmentId, int $studentId): array
{
    $passed = passed_course_ids($studentId);
    $rows = all(
        "SELECT es.enrollment_subject_id, o.offering_id, o.section_code, o.capacity, o.offering_status,
                c.course_id, c.course_code, c.course_name, c.units,
                g.grade_value, g.special_mark, g.grade_status
           FROM enrollment_subjects es
           JOIN course_offerings o ON o.offering_id = es.offering_id
           JOIN courses c ON c.course_id = o.course_id
           LEFT JOIN grades g ON g.enrollment_subject_id = es.enrollment_subject_id
          WHERE es.enrollment_id = ? ORDER BY c.course_code",
        [$enrollmentId]
    );
    foreach ($rows as &$r) {
        $r['prerequisites'] = prerequisite_status((int) $r['course_id'], $passed);
        $r['prerequisites_met'] = !in_array(false, array_column($r['prerequisites'], 'met'), true);
        $r['seats_taken'] = seats_taken((int) $r['offering_id'], $enrollmentId);
        $r['has_seat'] = $r['seats_taken'] < (int) $r['capacity'];
        // Hide unpublished grades from students
        if ($r['grade_status'] !== 'Published' && (current_user()['student'] ?? null)) {
            $r['grade_value'] = null;
            $r['special_mark'] = null;
        }
    }
    return $rows;
}

function grade_remark($value, $mark): string
{
    if ($mark === 'INC') return 'Incomplete';
    if ($mark === 'DRP') return 'Dropped';
    if ($value === null) return '';
    return (float) $value <= (float) cfg('passing_grade') ? 'Passed' : 'Failed';
}

/** Units-weighted average of numeric grades. */
function compute_gwa(array $rows): ?float
{
    $sum = 0; $units = 0;
    foreach ($rows as $r) {
        if ($r['grade_value'] !== null) {
            $sum += (float) $r['grade_value'] * (int) $r['units'];
            $units += (int) $r['units'];
        }
    }
    return $units ? round($sum / $units, 4) : null;
}

function person_name(?array $p): string
{
    if (!$p) return '';
    return trim($p['first_name'] . ' ' . (!empty($p['middle_name']) ? mb_substr($p['middle_name'], 0, 1) . '. ' : '') . $p['last_name']);
}

/** SQL snippet resolving a user_id to a display name. */
function name_sql(string $userIdExpr): string
{
    return "(SELECT COALESCE(CONCAT(sx.first_name, ' ', sx.last_name), CONCAT(tx.first_name, ' ', tx.last_name), ux.username)
               FROM users ux LEFT JOIN staff sx ON sx.user_id = ux.user_id LEFT JOIN students tx ON tx.user_id = ux.user_id
              WHERE ux.user_id = $userIdExpr)";
}
