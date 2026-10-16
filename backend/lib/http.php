<?php
/**
 * HTTP helpers: JSON responses, request body, validation, router.
 */

class HttpError extends Exception
{
    public int $status;
    public $details;

    public function __construct(int $status, string $message, $details = null)
    {
        parent::__construct($message);
        $this->status = $status;
        $this->details = $details;
    }
}

/** Stop the request with an error response. */
function fail(int $status, string $message, $details = null): void
{
    throw new HttpError($status, $message, $details);
}

function json_out($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Decoded JSON body of the request. */
function body(): array
{
    static $body;
    if ($body === null) {
        $raw = file_get_contents('php://input');
        $decoded = $raw ? json_decode($raw, true) : [];
        $body = is_array($decoded) ? $decoded : [];
    }
    return $body;
}

function input(string $key, $default = null)
{
    $b = body();
    return array_key_exists($key, $b) ? $b[$key] : $default;
}

function query_param(string $key, $default = null)
{
    return isset($_GET[$key]) && $_GET[$key] !== '' ? $_GET[$key] : $default;
}

/**
 * Validate request body fields.
 * Rules: required, nullable, int, numeric, email, min:n, max:n, between:a,b, in:a,b,c, regex:/../, array, bool, date
 * Returns cleaned values; throws 422 with per-field messages on failure.
 */
function validate(array $rules, ?array $data = null): array
{
    $data = $data ?? body();
    $errors = [];
    $clean = [];

    foreach ($rules as $field => $ruleString) {
        $rulesList = explode('|', $ruleString);
        $label = ucfirst(str_replace('_', ' ', $field));
        $value = $data[$field] ?? null;
        if (is_string($value)) {
            $value = trim($value);
        }
        $isEmpty = $value === null || $value === '' || (is_array($value) && count($value) === 0);

        if ($isEmpty) {
            if (in_array('required', $rulesList, true)) {
                $errors[$field] = "$label is required.";
            } else {
                $clean[$field] = in_array('array', $rulesList, true) ? [] : null;
            }
            continue;
        }

        foreach ($rulesList as $rule) {
            [$name, $arg] = array_pad(explode(':', $rule, 2), 2, null);
            $err = null;
            switch ($name) {
                case 'int':
                    if (filter_var($value, FILTER_VALIDATE_INT) === false) $err = "$label must be a whole number.";
                    else $value = (int) $value;
                    break;
                case 'numeric':
                    if (!is_numeric($value)) $err = "$label must be a number.";
                    else $value = $value + 0;
                    break;
                case 'bool':
                    $value = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
                    break;
                case 'email':
                    if (!filter_var($value, FILTER_VALIDATE_EMAIL)) $err = "$label must be a valid email address.";
                    break;
                case 'date':
                    $d = DateTime::createFromFormat('Y-m-d', (string) $value);
                    if (!$d || $d->format('Y-m-d') !== $value) $err = "$label must be a valid date (YYYY-MM-DD).";
                    break;
                case 'min':
                    if (is_string($value) && mb_strlen($value) < (int) $arg) $err = "$label must be at least $arg characters.";
                    break;
                case 'max':
                    if (is_string($value) && mb_strlen($value) > (int) $arg) $err = "$label must not exceed $arg characters.";
                    break;
                case 'between':
                    [$lo, $hi] = explode(',', $arg);
                    if (!is_numeric($value) || $value < $lo || $value > $hi) $err = "$label must be between $lo and $hi.";
                    break;
                case 'in':
                    if (!in_array((string) $value, explode(',', $arg), true)) $err = "$label has an invalid value.";
                    break;
                case 'regex':
                    if (!preg_match($arg, (string) $value)) $err = "$label has an invalid format.";
                    break;
                case 'array':
                    if (!is_array($value)) $err = "$label must be a list.";
                    break;
            }
            if ($err) {
                $errors[$field] = $err;
                break;
            }
        }
        $clean[$field] = $value;
    }

    if ($errors) {
        fail(422, 'Please correct the highlighted fields.', $errors);
    }
    return $clean;
}

/** Minimal router with {param} placeholders. */
class Router
{
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
        $this->routes[] = [$method, $regex, $handler];
    }

    public function get(string $p, callable $h): void { $this->add('GET', $p, $h); }
    public function post(string $p, callable $h): void { $this->add('POST', $p, $h); }
    public function put(string $p, callable $h): void { $this->add('PUT', $p, $h); }
    public function delete(string $p, callable $h): void { $this->add('DELETE', $p, $h); }

    public function dispatch(string $method, string $path)
    {
        $pathMatched = false;
        foreach ($this->routes as [$m, $regex, $handler]) {
            if (preg_match($regex, $path, $matches)) {
                $pathMatched = true;
                if ($m !== $method) {
                    continue;
                }
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                return $handler($params);
            }
        }
        fail($pathMatched ? 405 : 404, $pathMatched ? 'Method not allowed.' : 'Endpoint not found.');
    }
}
