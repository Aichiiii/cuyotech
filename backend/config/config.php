<?php
/**
 * CuyoTech SSIS - Backend configuration.
 * Edit the database settings below to match your MySQL / XAMPP setup.
 * Environment variables (SSIS_DB_HOST, SSIS_DB_USER, ...) override these values if set.
 */
$env = static function (string $key, $default) {
    $v = getenv($key);
    return $v === false ? $default : $v;
};

return [
    'db' => [
        'host' => $env('SSIS_DB_HOST', '127.0.0.1'),
        'port' => $env('SSIS_DB_PORT', '3306'),
        'name' => $env('SSIS_DB_NAME', 'cuyotech_ssis'),
        'user' => $env('SSIS_DB_USER', 'root'),
        'pass' => $env('SSIS_DB_PASS', ''),      // XAMPP default: root with empty password
    ],

    'timezone' => 'Asia/Manila',

    // Security settings
    'session_timeout_minutes' => 30,   // auto-logout after inactivity
    'max_login_attempts'      => 5,    // failed attempts before the account is Locked
    'login_window_minutes'    => 15,   // window used to count failed attempts

    // Front-end origins allowed to call the API (React dev server)
    'allowed_origins' => [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],

    // Business rules
    'max_units_per_term' => 26,
    'max_document_copies' => 10,
    'valid_grades' => ['1.00', '1.25', '1.50', '1.75', '2.00', '2.25', '2.50', '2.75', '3.00', '5.00'],
    'passing_grade' => 3.00,

    // Show detailed PHP errors in API responses (set false for deployment)
    'debug' => true,
];
