<?php
/**
 * Database helpers (PDO + prepared statements only, to prevent SQL injection).
 */

function cfg(string $key)
{
    static $config;
    if ($config === null) {
        $config = require __DIR__ . '/../config/config.php';
    }
    return $config[$key] ?? null;
}

function db(): PDO
{
    static $pdo;
    if ($pdo === null) {
        $c = cfg('db');
        $dsn = "mysql:host={$c['host']};port={$c['port']};dbname={$c['name']};charset=utf8mb4";
        $pdo = new PDO($dsn, $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec("SET time_zone = '+08:00'");
    }
    return $pdo;
}

/** Run a prepared statement. */
function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute(array_values($params));
    return $st;
}

/** First row or null. */
function one(string $sql, array $params = []): ?array
{
    $row = q($sql, $params)->fetch();
    return $row ?: null;
}

/** All rows. */
function all(string $sql, array $params = []): array
{
    return q($sql, $params)->fetchAll();
}

/** First column of first row or null. */
function val(string $sql, array $params = [])
{
    $v = q($sql, $params)->fetchColumn();
    return $v === false ? null : $v;
}

function last_id(): int
{
    return (int) db()->lastInsertId();
}

/** Run a callback inside a transaction. */
function tx(callable $fn)
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $result = $fn();
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

/** Build "?, ?, ?" for IN (...) clauses. */
function placeholders(array $items): string
{
    return implode(',', array_fill(0, count($items), '?'));
}
