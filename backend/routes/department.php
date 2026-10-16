<?php
/**
 * Department Module: maintain the department's courses, prerequisites and term offerings.
 * (Clearance processing for the department is in clearance.php.)
 * @var Router $router
 */

function staff_department(array $u): array
{
    $dept = one("SELECT * FROM departments WHERE office_id = ?", [$u['staff']['office_id']]);
    if (!$dept) fail(403, 'Your account is not assigned to an academic department.');
    return $dept;
}

function save_prerequisites(int $courseId, int $deptId, array $ids, int $userId): void
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
    if (in_array($courseId, $ids, true)) fail(422, 'A course cannot be its own prerequisite.');
    if ($ids) {
        $found = (int) val("SELECT COUNT(*) FROM courses WHERE course_id IN (" . placeholders($ids) . ")", $ids);
        if ($found !== count($ids)) fail(422, 'One or more prerequisite courses do not exist.');
    }
    q("DELETE FROM course_prerequisites WHERE course_id = ?", [$courseId]);
    foreach ($ids as $pid) {
        q("INSERT INTO course_prerequisites (course_id, prerequisite_course_id, created_by) VALUES (?, ?, ?)", [$courseId, $pid, $userId]);
    }
}

$router->get('/department/courses', function () {
    $u = require_perm('courses.manage');
    $dept = staff_department($u);
    $courses = all(
        "SELECT c.*, (SELECT COUNT(*) FROM course_offerings o WHERE o.course_id = c.course_id) AS offerings
           FROM courses c WHERE c.department_id = ? ORDER BY c.course_code",
        [$dept['department_id']]
    );
    foreach ($courses as &$c) {
        $c['prerequisites'] = all(
            "SELECT p.course_id, p.course_code FROM course_prerequisites cp JOIN courses p ON p.course_id = cp.prerequisite_course_id WHERE cp.course_id = ? ORDER BY p.course_code",
            [$c['course_id']]
        );
    }
    $allCourses = all("SELECT course_id, course_code, course_name FROM courses WHERE course_status = 'Active' ORDER BY course_code");
    return ['department' => $dept, 'courses' => $courses, 'all_courses' => $allCourses];
});

$courseRules = [
    'course_code' => 'required|max:20|regex:/^[A-Z0-9\- ]+$/',
    'course_name' => 'required|min:3|max:150',
    'units' => 'required|int|between:1,6',
    'course_status' => 'nullable|in:Active,Archived',
    'prerequisite_ids' => 'nullable|array',
];

$router->post('/department/courses', function () use ($courseRules) {
    $u = require_perm('courses.manage');
    $dept = staff_department($u);
    body();
    $d = validate($courseRules, array_merge(body(), ['course_code' => strtoupper(trim((string) input('course_code', '')))]));
    $id = tx(function () use ($d, $dept, $u) {
        q("INSERT INTO courses (department_id, course_code, course_name, units, created_by) VALUES (?, ?, ?, ?, ?)", [$dept['department_id'], $d['course_code'], $d['course_name'], $d['units'], $u['user_id']]);
        $id = last_id();
        save_prerequisites($id, (int) $dept['department_id'], $d['prerequisite_ids'], (int) $u['user_id']);
        audit('COURSE_CREATED', 'courses', $id, null, $d);
        return $id;
    });
    return ['message' => "Course {$d['course_code']} created.", 'course_id' => $id];
});

$router->put('/department/courses/{id}', function ($p) use ($courseRules) {
    $u = require_perm('courses.manage');
    $dept = staff_department($u);
    $c = one("SELECT * FROM courses WHERE course_id = ? AND department_id = ?", [(int) $p['id'], $dept['department_id']]);
    if (!$c) fail(404, 'Course not found in your department.');
    $d = validate($courseRules, array_merge(body(), ['course_code' => $c['course_code']]));
    tx(function () use ($d, $c, $dept, $u) {
        q("UPDATE courses SET course_name = ?, units = ?, course_status = ?, updated_by = ? WHERE course_id = ?", [$d['course_name'], $d['units'], $d['course_status'] ?? $c['course_status'], $u['user_id'], $c['course_id']]);
        save_prerequisites((int) $c['course_id'], (int) $dept['department_id'], $d['prerequisite_ids'], (int) $u['user_id']);
        audit('COURSE_UPDATED', 'courses', $c['course_id'], array_intersect_key($c, $d), $d);
    });
    return ['message' => "Course {$c['course_code']} updated."];
});

$router->get('/department/offerings', function () {
    $u = require_perm('courses.manage');
    $dept = staff_department($u);
    $termId = (int) (query_param('term_id') ?: (open_term()['term_id'] ?? 0));
    $rows = all(
        "SELECT o.*, c.course_code, c.course_name, c.units FROM course_offerings o JOIN courses c ON c.course_id = o.course_id
          WHERE c.department_id = ? AND o.term_id = ? ORDER BY c.course_code, o.section_code",
        [$dept['department_id'], $termId]
    );
    foreach ($rows as &$r) $r['seats_taken'] = seats_taken((int) $r['offering_id']);
    return ['term_id' => $termId, 'offerings' => $rows];
});

$router->post('/department/offerings', function () {
    $u = require_perm('courses.manage');
    $dept = staff_department($u);
    $d = validate([
        'course_id' => 'required|int',
        'term_id' => 'required|int',
        'section_code' => 'required|max:20|regex:/^[A-Za-z0-9\-]+$/',
        'capacity' => 'required|int|between:1,500',
    ]);
    if (!val("SELECT course_id FROM courses WHERE course_id = ? AND department_id = ? AND course_status = 'Active'", [$d['course_id'], $dept['department_id']])) fail(422, 'Select an active course from your department.');
    $term = one("SELECT * FROM academic_terms WHERE term_id = ?", [$d['term_id']]);
    if (!$term || $term['term_status'] === 'Closed') fail(422, 'Offerings can only be added to upcoming or open terms.');
    q("INSERT INTO course_offerings (course_id, term_id, section_code, capacity, created_by) VALUES (?, ?, ?, ?, ?)", [$d['course_id'], $d['term_id'], strtoupper($d['section_code']), $d['capacity'], $u['user_id']]);
    $id = last_id();
    audit('OFFERING_CREATED', 'course_offerings', $id, null, $d);
    return ['message' => 'Offering added.', 'offering_id' => $id];
});

$router->put('/department/offerings/{id}', function ($p) {
    $u = require_perm('courses.manage');
    $dept = staff_department($u);
    $o = one("SELECT o.* FROM course_offerings o JOIN courses c ON c.course_id = o.course_id WHERE o.offering_id = ? AND c.department_id = ?", [(int) $p['id'], $dept['department_id']]);
    if (!$o) fail(404, 'Offering not found in your department.');
    $d = validate([
        'capacity' => 'required|int|between:1,500',
        'offering_status' => 'required|in:Open,Closed,Cancelled',
    ]);
    $taken = seats_taken((int) $o['offering_id']);
    if ($d['capacity'] < $taken) fail(422, "Capacity cannot be lower than the $taken seats already taken.");
    q("UPDATE course_offerings SET capacity = ?, offering_status = ?, updated_by = ? WHERE offering_id = ?", [$d['capacity'], $d['offering_status'], $u['user_id'], $o['offering_id']]);
    audit('OFFERING_UPDATED', 'course_offerings', $o['offering_id'], ['capacity' => $o['capacity'], 'offering_status' => $o['offering_status']], $d);
    return ['message' => 'Offering updated.'];
});
