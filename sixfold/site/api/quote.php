<?php
/**
 * api/quote.php — storage for the Quote Build tool at /summit-de59ae83/quote.html
 *
 * Replaces the two things the Claude artifact got from `claude.use("db")`:
 *   config/rates   — the standing rate table, shared by everyone who may use it
 *   jobs           — saved jobs, newest first
 *
 * ⚑ ADMIN ONLY, AND DELIBERATELY. Matthew, 2026-09-30: he wants to test it
 * before anyone else is let in. The gate is the session's ROLE, never a
 * particular person's code — hardcoding a six-digit code into a file the web
 * server serves would put it one misconfiguration away from being public, and
 * the codes file says of itself "never commit, never paste it anywhere".
 * To let Brad in later, change his line in api/rounds-codes.php from 'crew' to
 * 'admin'. Nothing in this file or the page changes.
 *
 * ⚑ WHERE THE DATA LIVES. Outside public_html, for the reason recorded in
 * rounds.php: on 2026-09-29 an .htaccess deny on public_html/data FAILED on this
 * host and served real addresses over the web. This is worse than addresses —
 * it is the cost model, the margins and saved customer quotes — so it never goes
 * under the document root at all.
 *
 * Session, signing and the cookie are rounds.php's, unchanged: one code, both
 * tools. A quote session is the same session as a doors session.
 */

declare(strict_types=1);

/* A notice printed into the body corrupts every response — same trap rounds.php
   hit with PHP 8.4's fputcsv deprecation. Errors go to the log, never the output. */
@ini_set('display_errors', '0');
@ini_set('log_errors', '1');

function quoteDir(): string {
    $outside = dirname(__DIR__, 2) . '/sixfold-data/quote';
    if (is_dir($outside)) return $outside;
    /* 2026-10-03 (review, as rounds.php): never fall back to a folder inside public_html on the
       host. Beside existing door data the folder is simply made; the old fallback is for PHP's
       own test server only. */
    if (is_dir(dirname($outside)) && @mkdir($outside, 0750, true)) return $outside;
    if (PHP_SAPI === 'cli-server') return __DIR__ . '/../data/quote';
    http_response_code(503); header('Content-Type: application/json');
    exit('{"ok":false,"error":"Storage is not set up on this server."}');
}
define('QUOTE_DIR', quoteDir());
const COOKIE = 'sfr';
const MAX_JOBS = 400;          // a job is small; this is a sanity ceiling, not a product limit

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');

function out(array $body, int $status = 200): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(string $msg, int $status = 400): never { out(['ok' => false, 'error' => $msg], $status); }

/* SX-9e (2026-10-03): the crew codes live ABOVE public_html, in sixfold-private/, beside
   sixfold-data/. If PHP ever stops running in this folder, a file in here is served as plain
   text — every code public. The copy beside this file is read only during the changeover;
   delete it from the host once the private copy is up. */
$cfgPath = dirname(__DIR__, 2) . '/sixfold-private/rounds-codes.php';
if (!is_readable($cfgPath)) $cfgPath = __DIR__ . '/rounds-codes.php';
if (!is_readable($cfgPath)) fail('Not configured on this server.', 503);
$cfg = (array) (require $cfgPath);
$sessionKey = (string) ($cfg['session_key'] ?? '');
if ($sessionKey === '' || $sessionKey === 'REPLACE-WITH-64-RANDOM-HEX-CHARACTERS') {
    fail('Not configured on this server.', 503);
}

/* ---- session, identical to rounds.php so one sign-in covers both ---- */
function b64u_dec(string $s): string {
    return (string) base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true);
}
function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function verify(?string $token, string $key): ?array {
    if (!$token || substr_count($token, '.') !== 1) return null;
    [$body, $mac] = explode('.', $token, 2);
    if (!hash_equals(b64u(hash_hmac('sha256', $body, $key, true)), $mac)) return null;   // constant time
    $p = json_decode(b64u_dec($body), true);
    if (!is_array($p) || ($p['exp'] ?? 0) < time()) return null;
    return $p;
}

$session = verify($_COOKIE[COOKIE] ?? null, $sessionKey);
if (!$session) fail('Sign in first.', 401);

/* 2026-10-03 (review): the same check as rounds.php. The person is looked up by the keyed hash
   of their code ('c') in the CURRENT list; name and role come from that line, never from the
   cookie. Without it a deleted or demoted admin kept the cost model and saved quotes for up to
   45 days. ⚑ Keep codeId() identical to rounds.php's, or every admin is refused here. */
function codeId(string $code, string $key): string { return substr(hash_hmac('sha256', 'code|' . $code, $key), 0, 20); }
$line = null;
foreach ((array) ($cfg['people'] ?? []) as $c => $who) {
    if (is_array($who) && hash_equals(codeId((string) $c, $sessionKey), (string) ($session['c'] ?? ''))) $line = $who;
}
if ($line === null) fail('Sign in first.', 401);

$me   = (string) ($line[0] ?? '');
$role = (string) ($line[1] ?? 'crew');

/* ⚑ The gate. A crew member signing in for doors gets a valid session, so the
   check has to be here and not only on the button that links to the page. */
if ($role !== 'admin') fail('Not allowed.', 403);

/* ---- storage ------------------------------------------------------------
 * Two files, both plain JSON. Writes go through a temp file and rename so a
 * half-written file can never be read: rename is atomic on the same volume.  */
if (!is_dir(QUOTE_DIR)) @mkdir(QUOTE_DIR, 0775, true);
if (!is_dir(QUOTE_DIR)) fail('Storage is not set up on this server.', 503);

function readJson(string $path, array $fallback): array {
    if (!is_readable($path)) return $fallback;
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') return $fallback;
    $v = json_decode($raw, true);
    return is_array($v) ? $v : $fallback;
}
function writeJson(string $path, array $value): bool {
    $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
    $ok = @file_put_contents($tmp, json_encode($value, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);
    if ($ok === false) { @unlink($tmp); return false; }
    if (!@rename($tmp, $path)) { @unlink($tmp); return false; }
    return true;
}

$ratesFile = QUOTE_DIR . '/rates.json';
$jobsFile  = QUOTE_DIR . '/jobs.json';
/* read-modify-write of the job list happens under one lock (review 2026-10-03): two saves at
   the same moment used to both read the old list, and the second write dropped the first job.
   The lock is released when the request ends. */
function jobsLock() {
    $fh = @fopen(QUOTE_DIR . '/jobs.lock', 'c');
    if ($fh) @flock($fh, LOCK_EX);
    return $fh;
}

$action = (string) ($_REQUEST['action'] ?? '');
$isPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
$body   = [];
if ($isPost) {
    $raw  = file_get_contents('php://input') ?: '';
    $body = (array) (json_decode($raw, true) ?? []);
}

/* who am I — the page uses this to confirm the gate before rendering anything */
if ($action === 'me') out(['ok' => true, 'name' => $me, 'role' => $role]);

/* the standing rate table */
if ($action === 'rates') {
    if (!$isPost) out(['ok' => true, 'rates' => readJson($ratesFile, [])]);
    $in = (array) ($body['rates'] ?? []);
    if (!$in) fail('Nothing to save.');
    /* 2026-10-03 (review): only known shapes, and every figure a non-negative number. It used to
       store whatever came: a string crewCost "28" plus overhead "20" read as $2,820 an hour, and
       a null billable priced every job at $0. */
    $num = static fn($v) => (is_int($v) || is_float($v) || (is_string($v) && is_numeric($v))) && (float) $v >= 0 ? (float) $v : null;
    $payload = ['v' => substr((string) ($in['v'] ?? ''), 0, 20), 'rates' => [], 'confirmed' => [], 'cfg' => []];
    foreach ((array) ($in['rates'] ?? []) as $k => $v) {
        if (!preg_match('/^[A-Za-z0-9]{1,24}$/D', (string) $k) || count($payload['rates']) >= 100) continue;
        if (($n = $num($v)) === null) fail('Rate "' . $k . '" must be a number, zero or more.');
        $payload['rates'][$k] = $n;
    }
    foreach ((array) ($in['confirmed'] ?? []) as $k => $v) {
        if (preg_match('/^[A-Za-z0-9]{1,24}$/D', (string) $k) && count($payload['confirmed']) < 100) $payload['confirmed'][$k] = (bool) $v;
    }
    foreach (['billable', 'handling', 'crewCost', 'overhead', 'rounding'] as $k) {
        if (!array_key_exists($k, (array) ($in['cfg'] ?? []))) continue;
        if (($n = $num($in['cfg'][$k])) === null) fail('Setting "' . $k . '" must be a number, zero or more.');
        $payload['cfg'][$k] = $n;
    }
    $payload['updatedAt'] = gmdate('c');
    $payload['updatedBy'] = $me;
    if (!writeJson($ratesFile, $payload)) fail('Could not save the rate table.', 500);
    out(['ok' => true, 'updatedAt' => $payload['updatedAt']]);
}

/* saved jobs */
if ($action === 'jobs') out(['ok' => true, 'jobs' => readJson($jobsFile, [])]);

if ($action === 'save') {
    if (!$isPost) fail('POST required', 405);
    $job = (array) ($body['job'] ?? []);
    $name = trim((string) ($job['name'] ?? ''));
    if ($name === '') fail('Give the job a name first.');
    $job['name'] = mb_substr($name, 0, 120);
    $lock = jobsLock();
    $jobs = readJson($jobsFile, []);
    if (count($jobs) >= MAX_JOBS) fail('The job list is full — delete an old one first.', 507);
    $job['id'] = bin2hex(random_bytes(8));
    $job['savedAt'] = gmdate('c');
    $job['savedBy'] = $me;
    array_unshift($jobs, $job);                       // newest first, no sort needed on read
    if (!writeJson($jobsFile, $jobs)) fail('Could not save the job.', 500);
    out(['ok' => true, 'id' => $job['id'], 'savedAt' => $job['savedAt']]);
}

if ($action === 'delete') {
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? '');
    if ($id === '') fail('Which job?');
    $lock = jobsLock();
    $jobs = readJson($jobsFile, []);
    $kept = array_values(array_filter($jobs, fn($j) => (string) ($j['id'] ?? '') !== $id));
    if (count($kept) === count($jobs)) out(['ok' => true, 'removed' => 0]);   // idempotent
    if (!writeJson($jobsFile, $kept)) fail('Could not delete the job.', 500);
    out(['ok' => true, 'removed' => 1]);
}

fail('Unknown action.', 404);
