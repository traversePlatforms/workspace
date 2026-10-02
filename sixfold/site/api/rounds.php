<?php
/**
 * Sixfold Colorado — door rounds API.  2026-09-29.
 *
 * The only thing that serves door data, and the only thing that writes marks.
 * Everything under data/rounds/ is denied by its own .htaccess: this file reads
 * it from disk, the web server never hands it out.
 *
 * ---- WHAT THIS GUARDS ----------------------------------------------------
 * 2,656 households — names, home addresses, lot sizes. Nothing below the
 * sign-in returns a single door. The rules that follow from that:
 *
 *   1. Every action except 'signin' requires a valid session. No secret URL.
 *   2. 'area' returns ONE neighbourhood. The whole list is never sent to a
 *      phone, so a stolen session leaks ~26 doors and not 2,656.
 *   3. Sign-in is rate limited per IP, on the same pattern submit.php uses.
 *
 * ---- WHY NO DATABASE -----------------------------------------------------
 * Door lists are read-only JSON, regenerated on deploy. Marks are an
 * append-only log, one JSON object per line, written with LOCK_EX — safe under
 * two crew marking at once, and impossible to half-corrupt. Current state is
 * the log replayed, last line per door winning. Nothing here needs MySQL or
 * SQLite, neither of which has been confirmed on this host.
 *
 * ---- SESSIONS ------------------------------------------------------------
 * A signed cookie, not PHP sessions: no server-side session store to configure
 * or clean up, and it survives the host recycling processes. Payload is
 * base64url(json).hmac — readable by the holder, forgeable by nobody without
 * session_key. Rotating session_key signs everyone out at once.
 */

declare(strict_types=1);

/* A PHP notice printed into the body corrupts every response here: JSON stops
   parsing and the CSV gets HTML in it. PHP 8.4's fputcsv deprecation did exactly
   that in testing. Errors go to the log, never to the output. */
@ini_set('display_errors', '0');
@ini_set('log_errors', '1');

/* ---- WHERE THE DOOR DATA LIVES, AND WHY IT MOVED ------------------------
 *
 * ⚑ It used to be public_html/data/rounds, protected by an .htaccess deny.
 * On this host that FAILED: 2026-09-29, straight after the first upload,
 * https://sixfoldcolorado.com/data/rounds/monument.json returned 200 and served
 * real addresses. The .htaccess was present and being read — requesting the
 * .htaccess itself correctly returned 403 — SiteGround simply did not apply the
 * deny to the files beside it.
 *
 * So the data now lives OUTSIDE the document root, where no web-server config
 * can expose it. Nothing to serve means nothing to get wrong.
 *
 * This file sits in public_html/api, so dirname(dirname(__DIR__)) is the folder
 * that CONTAINS public_html — no absolute path needs to be known or configured.
 * The old location is kept only as a fallback for a local dev checkout.
 */
function dataDir(): string {
    $outside = dirname(__DIR__, 2) . '/sixfold-data/rounds';
    if (is_dir($outside)) return $outside;
    return __DIR__ . '/../data/rounds';          // dev checkout only
}
define('DATA_DIR', dataDir());
const COOKIE     = 'sfr';
const MAX_TRIES  = 8;      // sign-in attempts per IP per window
const TRY_WINDOW = 900;    // 15 minutes

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

$cfgPath = __DIR__ . '/rounds-codes.php';
if (!is_readable($cfgPath)) fail('Rounds is not configured on this server.', 503);
$cfg = (array) (require $cfgPath);
$people      = (array) ($cfg['people'] ?? []);
$sessionKey  = (string) ($cfg['session_key'] ?? '');
$sessionDays = (int) ($cfg['session_days'] ?? 45);
if ($sessionKey === '' || $sessionKey === 'REPLACE-WITH-64-RANDOM-HEX-CHARACTERS') {
    fail('Rounds is not configured on this server.', 503);
}

/* ---- sessions ---------------------------------------------------------- */
function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64u_dec(string $s): string {
    return (string) base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true);
}
function sign(array $payload, string $key): string {
    $body = b64u(json_encode($payload, JSON_UNESCAPED_SLASHES));
    return $body . '.' . b64u(hash_hmac('sha256', $body, $key, true));
}
function verify(?string $token, string $key): ?array {
    if (!$token || substr_count($token, '.') !== 1) return null;
    [$body, $mac] = explode('.', $token, 2);
    $want = b64u(hash_hmac('sha256', $body, $key, true));
    if (!hash_equals($want, $mac)) return null;                 // constant time
    $p = json_decode(b64u_dec($body), true);
    if (!is_array($p) || ($p['exp'] ?? 0) < time()) return null;
    return $p;
}

$session = verify($_COOKIE[COOKIE] ?? null, $sessionKey);

/* ---- sign-in rate limit -------------------------------------------------
 *
 * ⚑ COUNT FAILURES ONLY. The first version recorded every attempt, successes
 * included, and locked a legitimate user out after eight sign-ins — which is
 * exactly what happened on 2026-09-29: testing from one office used up the
 * allowance for everyone behind that IP, and the next correct code was refused.
 *
 * A limiter exists to slow down someone guessing. Someone who just proved they
 * know the code is not guessing, so a success clears the counter.
 */
function rateFile(): string {
    $dir = __DIR__ . '/.ratelimit';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    return $dir . '/r' . hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '0') . '|rounds');
}
/** True if this address may still try. Records nothing. */
function throttleOk(): bool {
    $raw = @file_get_contents(rateFile());
    if ($raw === false) return true;                      // no history, or unreadable: let them try
    $hits = array_filter((array) json_decode($raw, true), fn($t) => is_int($t) && $t > time() - TRY_WINDOW);
    return count($hits) < MAX_TRIES;
}
/** Record one FAILED attempt. */
function throttleFail(): void {
    $fh = @fopen(rateFile(), 'c+');
    if (!$fh) return;                                     // fail open: a disk problem must never lock anyone out
    @flock($fh, LOCK_EX);
    $raw = stream_get_contents($fh) ?: '[]';
    $hits = array_values(array_filter((array) json_decode($raw, true), fn($t) => is_int($t) && $t > time() - TRY_WINDOW));
    $hits[] = time();
    ftruncate($fh, 0); rewind($fh);
    @fwrite($fh, json_encode($hits));
    @flock($fh, LOCK_UN); @fclose($fh);
}
/** A correct code clears the history for that address. */
function throttleClear(): void { @unlink(rateFile()); }

/* ---- data -------------------------------------------------------------- */
function regionFile(string $key): ?string {
    if (!preg_match('/^[a-z0-9-]{1,40}$/', $key)) return null;   // never let a path in
    $f = DATA_DIR . '/' . $key . '.json';
    return is_readable($f) ? $f : null;
}
function loadRegion(string $key): ?array {
    $f = regionFile($key);
    return $f ? json_decode((string) file_get_contents($f), true) : null;
}
function marksFile(string $key): string { return DATA_DIR . '/marks-' . $key . '.log'; }

/** Replay the append-only log: last line per door wins. */
function loadMarks(string $key): array {
    $f = marksFile($key);
    if (!is_readable($f)) return [];
    $out = [];
    $fh = @fopen($f, 'r');
    if (!$fh) return [];
    while (($line = fgets($fh)) !== false) {
        $m = json_decode(trim($line), true);
        if (!is_array($m) || !isset($m['id'])) continue;
        if (($m['outcome'] ?? null) === null) unset($out[$m['id']]);   // an undo
        else $out[$m['id']] = ['outcome' => $m['outcome'], 'by' => $m['by'] ?? '', 'at' => $m['at'] ?? 0];
    }
    fclose($fh);
    return $out;
}
function appendMark(string $key, array $row): bool {
    return (bool) @file_put_contents(marksFile($key), json_encode($row, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}

/* ---- phone numbers ------------------------------------------------------
 *
 * Added 2026-10-01 (SX-14). Same shape as the marks log, for the same reason:
 * numbers are keyed on door id in their OWN append-only file, so they survive
 * every rebuild of the door lists. Storing them inside the door files would
 * wipe every number the next time the lists are regenerated.
 *
 * ⚑ `source` IS THE COMPLIANCE FIELD, NOT DECORATION. 'door' means the
 * homeowner gave it to us in person -- consent. 'tps' / 'fps' / 'other' means it
 * was looked up, and calling a looked-up number to sell is telemarketing: it
 * must be scrubbed against the national DNC registry and Colorado's no-call
 * list first. Keeping the two distinguishable is the whole point of the field.
 *
 * Numbers are entered BY A PERSON. Nothing here fetches from a people-search
 * site -- automated pulling was declined on 2026-10-01 and stays declined. */
function phonesFile(string $key): string { return DATA_DIR . '/phones-' . $key . '.log'; }

/** Replay the append-only log: last line per door wins; a null phone removes it. */
function loadPhones(string $key): array {
    $f = phonesFile($key);
    if (!is_readable($f)) return [];
    $out = [];
    $fh = @fopen($f, 'r');
    if (!$fh) return [];
    while (($line = fgets($fh)) !== false) {
        $p = json_decode(trim($line), true);
        if (!is_array($p) || !isset($p['id'])) continue;
        if (($p['phone'] ?? null) === null) unset($out[$p['id']]);   // removed
        else $out[$p['id']] = ['phone' => $p['phone'], 'source' => $p['source'] ?? 'other',
                                'seen' => $p['seen'] ?? '', 'by' => $p['by'] ?? '', 'at' => $p['at'] ?? 0];
    }
    fclose($fh);
    return $out;
}
function appendPhone(string $key, array $row): bool {
    return (bool) @file_put_contents(phonesFile($key), json_encode($row, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}
const PHONE_SOURCES = ['door', 'tps', 'fps', 'other'];

/* ---- routing ----------------------------------------------------------- */
$action = (string) ($_REQUEST['action'] ?? '');
$isPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
$body = [];
if ($isPost) {
    $raw = file_get_contents('php://input') ?: '';
    $body = (array) (json_decode($raw, true) ?? []);
}

if ($action === 'signin') {
    if (!$isPost) fail('POST required', 405);
    if (!throttleOk()) fail('Too many wrong codes from here. Wait fifteen minutes.', 429);
    $code = preg_replace('/\D/', '', (string) ($body['code'] ?? ''));
    $hit = null;
    foreach ($people as $c => $who) {                            // constant-time-ish: check all
        if (hash_equals((string) $c, (string) $code)) $hit = $who;
    }
    if (!$hit) { throttleFail(); fail('That code was not recognised.', 401); }
    throttleClear();                                             // they knew it; forget the history
    $payload = ['n' => $hit[0], 'r' => $hit[1] ?? 'crew', 'exp' => time() + $sessionDays * 86400];
    $secure = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off');
    setcookie(COOKIE, sign($payload, $sessionKey), [
        'expires'  => $payload['exp'], 'path' => '/', 'httponly' => true,
        'samesite' => 'Lax', 'secure' => $secure,
    ]);
    out(['ok' => true, 'name' => $payload['n'], 'role' => $payload['r']]);
}

if ($action === 'signout') {
    setcookie(COOKIE, '', ['expires' => time() - 3600, 'path' => '/']);
    out(['ok' => true]);
}

/* everything past here needs a session */
if (!$session) fail('Sign in first.', 401);
$me   = (string) $session['n'];
$role = (string) ($session['r'] ?? 'crew');

if ($action === 'me') out(['ok' => true, 'name' => $me, 'role' => $role]);

if ($action === 'diag') {
    /* ⚑ Added after the first live deploy returned an empty list with no reason.
       Silence is the worst diagnostic: say which directory was looked in and what
       is actually there. Admin only — the paths are infrastructure detail. */
    if ($role !== 'admin') fail('Not allowed.', 403);
    $expected = dirname(__DIR__, 2) . '/sixfold-data/rounds';
    out(['ok' => true,
        'using'        => DATA_DIR,
        'using_exists' => is_dir(DATA_DIR),
        'expected'     => $expected,
        'expected_exists' => is_dir($expected),
        'parent'       => dirname(__DIR__, 2),
        'parent_list'  => is_dir(dirname(__DIR__, 2)) ? array_values(array_diff((array) scandir(dirname(__DIR__, 2)), ['.', '..'])) : [],
        'data_list'    => is_dir(DATA_DIR) ? array_values(array_diff((array) scandir(DATA_DIR), ['.', '..'])) : [],
        'index_readable' => is_readable(DATA_DIR . '/index.json'),
    ]);
}

if ($action === 'regions') {
    if (!is_readable(DATA_DIR . '/index.json')) {
        fail('The door lists are not on this server yet. Sign in as admin and open ?action=diag to see where it looked.', 503);
    }
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $regions = [];
    foreach (($idx['regions'] ?? []) as $r) {
        $data = loadRegion($r['key']);
        if (!$data) continue;
        $marks = loadMarks($r['key']);
        $areas = [];
        foreach ($data['areas'] as $a) {
            /* A no-answer is NOT a finished door — nobody was home. It is counted
               separately so a second pass round the neighbourhood is visible
               rather than something someone has to remember to plan. */
            /* hot / vhot: high (4) and very high (5) fire-hazard doors STILL TO KNOCK.
               A finished door is not a reason to send anyone back, so a neighbourhood
               sinks down the hazard sort as its high-hazard doors get done. A no-answer
               still needs a knock, so it still counts. Class 6 never counts as safe;
               it simply is not counted as high. */
            $done = 0; $noanswer = 0; $hot = 0; $vhot = 0;
            foreach ($a['doors'] as $d) {
                $m = $marks[$d['id']] ?? null;
                $f = (int) ($d['fire'] ?? 0);
                $open = !$m || $m['outcome'] === 'miss';
                if ($open && ($f === 4 || $f === 5)) { $hot++; if ($f === 5) $vhot++; }
                if (!$m) continue;
                if ($m['outcome'] === 'miss') $noanswer++; else $done++;
            }
            $areas[] = ['name' => $a['name'], 'avg' => $a['avg'], 'total' => count($a['doors']),
                        'done' => $done, 'noanswer' => $noanswer, 'hot' => $hot, 'vhot' => $vhot];
        }
        $regions[] = ['key' => $r['key'], 'label' => $r['label'], 'areas' => $areas];
    }
    out(['ok' => true, 'regions' => $regions]);
}

if ($action === 'area') {
    $key  = (string) ($_REQUEST['region'] ?? '');
    $name = (string) ($_REQUEST['area'] ?? '');
    $data = loadRegion($key);
    if (!$data) fail('No such region.', 404);
    $marks = loadMarks($key);
    $phones = loadPhones($key);
    foreach ($data['areas'] as $a) {
        if ($a['name'] !== $name) continue;
        $doors = [];
        foreach ($a['doors'] as $d) {
            $m = $marks[$d['id']] ?? null;
            $p = $phones[$d['id']] ?? null;
            $doors[] = [
                'id' => $d['id'], 'address' => $d['address'], 'acres' => $d['acres'], 'owner' => $d['owner'],
                'lat' => $d['lat'] ?? null, 'lon' => $d['lon'] ?? null,
                'fire' => $d['fire'] ?? null,
                'mark' => $m ? ['outcome' => $m['outcome'], 'by' => $m['by']] : null,
                'phone' => $p ? ['phone' => $p['phone'], 'source' => $p['source'], 'seen' => $p['seen'],
                                 'by' => $p['by'], 'at' => $p['at']] : null,
            ];
        }
        out(['ok' => true, 'area' => $a['name'], 'avg' => $a['avg'], 'doors' => $doors]);
    }
    fail('No such neighbourhood.', 404);
}

if ($action === 'mark') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    $out = $body['outcome'] ?? null;                              // null = undo
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/', $id)) fail('Bad door id.');
    if ($out !== null && !in_array($out, ['booked', 'later', 'miss'], true)) fail('Bad outcome.');
    $ok = appendMark($key, ['id' => $id, 'outcome' => $out, 'by' => $me, 'at' => time()]);
    if (!$ok) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

if ($action === 'phone') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/', $id)) fail('Bad door id.');
    $raw = $body['phone'] ?? null;
    if ($raw === null || trim((string) $raw) === '') {             // remove the number
        if (!appendPhone($key, ['id' => $id, 'phone' => null, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
        out(['ok' => true]);
    }
    $digits = preg_replace('/\D/', '', (string) $raw);
    if (strlen($digits) === 11 && $digits[0] === '1') $digits = substr($digits, 1);
    /* North American numbering: area code and exchange both start 2-9 */
    if (!preg_match('/^[2-9]\d{2}[2-9]\d{6}$/', $digits)) fail('That is not a valid 10-digit US number.');
    $source = (string) ($body['source'] ?? '');
    if (!in_array($source, PHONE_SOURCES, true)) fail('Pick where the number came from.');
    $seen = (string) ($body['seen'] ?? '');
    if ($seen !== '' && !preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $seen)) fail('Last seen must be a month, like 2026-08.');
    if ($source === 'door') $seen = '';                             // given in person: the date given is `at`
    if (!appendPhone($key, ['id' => $id, 'phone' => $digits, 'source' => $source, 'seen' => $seen, 'by' => $me, 'at' => time()])) {
        fail('Could not save that. Try again.', 500);
    }
    out(['ok' => true]);
}

/* ---- the scoreboard, and the export -------------------------------------
 *
 * ⚑ 'report' IS OPEN TO EVERYONE, deliberately. Matthew's call 2026-09-30:
 * the crew should be able to see who knocked what without asking him, so the
 * totals stop routing through one person.
 *
 * 'export' stays admin. It is not the same thing: the report is counts per
 * person, while the export is every door in the database — 15,000 households
 * with names and home addresses — and handing a downloadable copy of that to
 * every code is a different decision from showing a scoreboard.
 */
if ($action === 'report' || $action === 'export') {
    if ($action === 'export' && $role !== 'admin') fail('Not allowed.', 403);
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];

    if ($action === 'report') {
        $byPerson = [];
        $byRegion = [];
        foreach (($idx['regions'] ?? []) as $r) {
            $marks = loadMarks($r['key']);
            /* ⚑ ONLY COUNT MARKS WHOSE DOOR STILL EXISTS.
               The marks log is append-only and survives every rebuild of the door
               lists, which is correct — a door keeps its id (a slug of its address)
               so a mark survives too. But a door that DROPS OUT of a rebuild (a
               tighter radius, a different acre band) leaves its mark behind with
               nothing to attach to. Counting those made the scoreboard disagree
               with the CSV export, which has always matched marks to doors. Found
               live 2026-09-30: the report showed a knock the export could not. */
            $live = [];
            $data = loadRegion($r['key']);
            foreach (($data['areas'] ?? []) as $a) {
                foreach ($a['doors'] as $d) $live[$d['id']] = true;
            }
            $tot = ['booked' => 0, 'later' => 0, 'miss' => 0];
            foreach ($marks as $id => $m) {
                if (!isset($live[$id])) continue;
                $o = $m['outcome'];
                if (!isset($tot[$o])) continue;
                $tot[$o]++;
                $who = $m['by'] !== '' ? $m['by'] : 'unknown';
                if (!isset($byPerson[$who])) $byPerson[$who] = ['booked' => 0, 'later' => 0, 'miss' => 0];
                $byPerson[$who][$o]++;
            }
            $byRegion[] = ['label' => $r['label'], 'knocked' => array_sum($tot)] + $tot;
        }
        out(['ok' => true, 'byPerson' => $byPerson, 'byRegion' => $byRegion]);
    }

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="sixfold-rounds.csv"');
    $fh = fopen('php://output', 'w');
    /* the explicit $escape is required from PHP 8.4 and accepted since 5.5; '' is
       also the standards-correct choice — no backslash escaping in CSV */
    fputcsv($fh, ['region', 'neighbourhood', 'address', 'acres', 'owner', 'outcome', 'by', 'when',
                  'phone', 'phone_source', 'phone_last_seen', 'phone_added_by', 'phone_added'], ',', '"', '');
    $srcName = ['door' => 'given at the door', 'tps' => 'True People Search', 'fps' => 'Fast People Search', 'other' => 'other'];
    foreach (($idx['regions'] ?? []) as $r) {
        $data = loadRegion($r['key']);
        $marks = loadMarks($r['key']);
        $phones = loadPhones($r['key']);
        if (!$data) continue;
        foreach ($data['areas'] as $a) {
            foreach ($a['doors'] as $d) {
                $m = $marks[$d['id']] ?? null;
                $p = $phones[$d['id']] ?? null;
                if (!$m && !$p) continue;                          // a door with a number is worth exporting too
                fputcsv($fh, [$r['label'], $a['name'], $d['address'], $d['acres'], $d['owner'],
                              $m['outcome'] ?? '', $m['by'] ?? '', $m ? date('Y-m-d H:i', (int) $m['at']) : '',
                              $p['phone'] ?? '', $p ? ($srcName[$p['source']] ?? $p['source']) : '', $p['seen'] ?? '',
                              $p['by'] ?? '', $p ? date('Y-m-d', (int) $p['at']) : ''], ',', '"', '');
            }
        }
    }
    fclose($fh);
    exit;
}

fail('Unknown action.', 404);
