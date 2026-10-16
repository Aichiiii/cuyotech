<?php
/**
 * CuyoTech University SSIS - REST API entry point.
 *
 * All requests to /api/... are routed here.
 *   - PHP built-in server:  php -S localhost:8000 index.php   (run inside /backend)
 *   - XAMPP / Apache:       uses .htaccess (mod_rewrite) in this folder
 */
declare(strict_types=1);

require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/http.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/helpers.php';

date_default_timezone_set(cfg('timezone'));
ini_set('display_errors', '0');

// ---------- CORS (only for the React dev server origins in config) ----------
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, cfg('allowed_origins'), true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, X-SSIS-Request');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Vary: Origin');
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Security headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

// ---------- Resolve the API path (works under any sub-folder) ----------
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$pos = strpos($uri, '/api/');
if ($pos === false) {
    json_out(['name' => 'CuyoTech SSIS API', 'status' => 'running', 'hint' => 'Call endpoints under /api/...']);
}
$path = '/' . trim(substr($uri, $pos + 5), '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    // CSRF protection: state-changing requests must carry a custom header,
    // which browsers do not allow other sites to send cross-origin.
    if ($method !== 'GET' && ($_SERVER['HTTP_X_SSIS_REQUEST'] ?? '') !== '1') {
        fail(403, 'Request rejected (missing X-SSIS-Request header).');
    }

    start_session();

    $router = new Router();
    foreach (['auth', 'common', 'student', 'registrar', 'cashier', 'clearance', 'department', 'admin'] as $file) {
        require __DIR__ . "/routes/$file.php";
    }

    $result = $router->dispatch($method, $path);
    json_out($result ?? ['ok' => true]);
} catch (HttpError $e) {
    json_out(['error' => $e->getMessage(), 'details' => $e->details], $e->status);
} catch (PDOException $e) {
    error_log('[SSIS] ' . $e->getMessage());
    if (($e->errorInfo[1] ?? null) === 1062) {
        json_out(['error' => 'A record with the same unique value already exists.', 'details' => cfg('debug') ? $e->getMessage() : null], 409);
    }
    if (($e->errorInfo[1] ?? null) === 1045 || ($e->errorInfo[1] ?? null) === 1049 || $e->getCode() === 2002) {
        json_out(['error' => 'Cannot connect to the database. Check backend/config/config.php.', 'details' => cfg('debug') ? $e->getMessage() : null], 500);
    }
    json_out(['error' => 'A database error occurred.', 'details' => cfg('debug') ? $e->getMessage() : null], 500);
} catch (Throwable $e) {
    error_log('[SSIS] ' . $e);
    json_out(['error' => 'An unexpected error occurred.', 'details' => cfg('debug') ? $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine() : null], 500);
}
