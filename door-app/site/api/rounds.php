<?php
/**
 * Door rounds API (the door app; first install Sixfold Colorado).  2026-09-29.
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
 *      phone, so a stolen session leaks ~26 doors and not 2,656. 'search'
 *      (2026-10-04) answers at most 25 addresses, needs a street name, and is
 *      counted per person (60 per 10 minutes); it carries no owner names.
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
    /* 2026-10-03 (review): the fallback is inside public_html, and leads would follow it there.
       So it is for a local checkout only; on the host a missing data folder is an error. */
    /* PHP's own test server, never the host: SERVER_NAME can come from the visitor's Host header
       on Apache, and on a LAN-bound test server it isn't "localhost" (second review) */
    if (PHP_SAPI === 'cli-server') return __DIR__ . '/../data/rounds';
    http_response_code(503); header('Content-Type: application/json');
    exit('{"ok":false,"error":"Rounds is not configured on this server."}');
}
define('DATA_DIR', dataDir());

/* ---- the company this install is for (2026-10-04) ----------------------------------------
 * Matthew: the app is his product and Sixfold is its first user, so nothing about one company is
 * written into the code. Each install has a company.json beside its door files (DATA_DIR) with
 * its name, contact details, services, extra-work list, mark, colours and which tools it uses.
 * Missing keys fall back to the neutral defaults below. Nothing in it is secret: the page asks
 * for it before anyone signs in (action=company, minus appUrl), so it never holds a key, a code or a price.
 * Nothing in it is trusted either: the page draws every value as text and sanitises the logo and colours. */
function company(): array {
    static $c = null;
    if ($c !== null) return $c;
    $def = ['name' => 'Door App', 'short' => 'Door App', 'tagline' => '', 'phone' => '', 'email' => '', 'site' => '', 'appUrl' => '',
            'visit' => 'visit', 'visitShort' => 'Visit', 'logo' => null, 'colors' => [],
            'services' => [['job', 'Job'], ['other', 'Other']], 'leadNeeds' => ['A quote', 'Question'], 'extraWork' => [],
            'features' => ['quote' => false, 'communities' => false, 'firecheck' => false, 'skiptrace' => true, 'hail' => false, 'roof' => false],
            /* which parts of the door card show (2026-10-04); a part with no data never shows anyway */
            'card' => ['lawn' => true, 'trees' => true, 'fire' => true, 'money' => true, 'water' => true], 'links' => []];
    $f = json_decode((string) @file_get_contents(DATA_DIR . '/company.json'), true);
    $c = is_array($f) ? array_replace($def, array_intersect_key($f, $def)) : $def;
    $c['features'] = array_replace($def['features'], is_array($c['features']) ? $c['features'] : []);
    $c['card'] = array_replace($def['card'], is_array($c['card']) ? $c['card'] : []);
    foreach (['services', 'extraWork'] as $k) $c[$k] = array_values(array_filter((array) $c[$k], fn($p) => is_array($p) && count($p) >= 2 && preg_match('/^[a-z0-9_-]{1,30}$/D', (string) $p[0])));
    if (!$c['services']) $c['services'] = $def['services'];
    return $c;
}
function feature(string $k): bool { return !empty(company()['features'][$k]); }
/* ---- hail (2026-10-04): the radar estimate per door, built offline by operations/door-territory/hail/build-hail.mjs.
   Admin only, and only where the company turns it on (features.hail). Matthew is evaluating it for roofing. */
function hailOn(string $role): bool { return $role === 'admin' && feature('hail'); }
function loadHail(string $key): array {
    static $memo = [];
    if (!isset($memo[$key])) { $j = json_decode((string) @file_get_contents(DATA_DIR . '/hail-' . $key . '.json'), true); $memo[$key] = is_array($j['doors'] ?? null) ? $j['doors'] : []; }
    return $memo[$key];
}
/* roof size and pitch (laser scan) and year built / roof material (county files), per door, built offline
   (operations/door-territory/roofs/sample-roofs.mjs, assessor/build-year.mjs). Admins only, features.roof. */
function roofDataOn(string $role): bool { return $role === 'admin' && feature('roof'); }
function loadSide(string $kind, string $key): array {
    static $memo = [];
    $k = $kind . '-' . $key;
    if (!isset($memo[$k])) { $j = json_decode((string) @file_get_contents(DATA_DIR . '/' . $k . '.json'), true); $memo[$k] = is_array($j['doors'] ?? null) ? $j['doors'] : []; }
    return $memo[$k];
}
/** service keys, and the label for each */
function custServices(): array { return array_map(fn($p) => (string) $p[0], company()['services']); }
function workLabels(): array { $o = []; foreach (company()['extraWork'] as $p) $o[(string) $p[0]] = (string) $p[1]; return $o; }
function workTags(): array { return array_keys(workLabels()); }
/** who the app says it is when it asks a public service for data (the weather service wants a contact) */
function agentHeader(): string { $c = company(); return 'User-Agent: DoorApp/1.0 (' . preg_replace('/[\r\n]+/', ' ', (string) ($c['email'] ?: ($c['site'] ?: 'no contact set'))) . ')'; }
date_default_timezone_set('America/Denver');   /* review 2026-10-03: the export's date() used the host's zone */
const COOKIE     = 'sfr';
const MAX_TRIES  = 8;      // wrong codes per address per window
const TRY_WINDOW = 900;    // 15 minutes
const SITE_TRIES = 60;     // wrong codes from ALL addresses per hour before new sign-ins pause
const SITE_WINDOW = 3600;
/* review 2026-10-05: the pause only starts once wrong codes have come from at least this many addresses in the
   window. Two phones on one carrier could otherwise keep new sign-ins paused for the whole company; a lone guesser
   is already held by the per-address limit. */
const SITE_MIN_ADDRS = 5;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');

function out(array $body, int $status = 200): never {
    if (defined('SIXFOLD_CLI')) throw new SixfoldOut($body);    /* the morning email (sixfold-tools/morning-email.php), command line only */
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
if (!is_readable($cfgPath)) fail('Rounds is not configured on this server.', 503);
$cfg = (array) (require $cfgPath);
$people      = (array) ($cfg['people'] ?? []);
$sessionKey  = (string) ($cfg['session_key'] ?? '');
$sessionDays = (int) ($cfg['session_days'] ?? 45);
if ($sessionKey === '' || $sessionKey === 'REPLACE-WITH-64-RANDOM-HEX-CHARACTERS') {
    fail('Rounds is not configured on this server.', 503);
}

/* ---- accounts managed from the app (2026-10-04) ------------------------------------------
 * Matthew: add, change and remove sign-ins from an admin screen. The server's codes file stays
 * the base list; the app keeps its own file beside it (sixfold-private, never in public_html):
 *   people: code => [name, role, by, at]   sign-ins added in the app
 *   off:    id => {by, at}                  lines of the codes file turned off
 *   over:   id => [name, role]              lines of the codes file renamed or re-roled
 * id = codeId(code), a keyed hash: the page and the log never see a code. A code is shown once,
 * when it is made. Every request reads the merged list, so a change works at once (a removed
 * person's phone is signed out on its next request; see the session check below). */
function accountsFile(): string {
    $priv = dirname(__DIR__, 2) . '/sixfold-private';
    return (is_dir($priv) ? $priv : dirname(DATA_DIR)) . '/rounds-accounts.json';
}
function loadAccounts(): array {
    $f = accountsFile();
    if (!file_exists($f)) $a = [];
    else {
        /* present but unreadable or broken (Fable 2026-10-04): carrying on would bring back everyone removed,
           demoted or signed out in the app and drop every app-made sign-in, silently. Stop instead. */
        $raw = @file_get_contents($f); $a = $raw === false ? null : json_decode($raw, true);
        if (!is_array($a)) { error_log('sixfold rounds: ' . $f . ' is unreadable or not valid JSON - sign-ins stopped'); fail('Sign-ins are unavailable for a moment. Tell the office.', 503); }
    }
    foreach (['people', 'off', 'over'] as $k) if (!isset($a[$k]) || !is_array($a[$k])) $a[$k] = [];
    return $a;
}
function saveAccounts(array $a): bool {
    $f = accountsFile(); $tmp = $f . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (@file_put_contents($tmp, json_encode($a, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX) === false) return false;
    @chmod($tmp, 0600);
    if (!@rename($tmp, $f)) { @unlink($tmp); return false; }
    return true;
}
function accountLog(array $row): void {
    @file_put_contents(dirname(accountsFile()) . '/rounds-accounts.log', json_encode($row + ['at' => time()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}
/* ---- who is signed in (2026-10-04) ----
 * Matthew: the Accounts screen could not say who was signed in, so a Sign out had nothing to show it
 * worked. The cookie is the session and the server kept no list; now it keeps one, beside the accounts:
 *   s:     tag => [id, exp, seen, device]   one line per sign-in (a phone, an iPad); tag = sessionTag(cookie),
 *                                           so the file never holds a cookie or a code
 *   o:     id => when they were last signed out
 *   since: when the list was started
 * A sign-in adds a line, using the app moves 'seen' on (written at most every 5 minutes), Sign out on the
 * phone removes its line, and an admin's Sign out, New code or Remove removes all of that person's lines.
 * Phones signed in before this was uploaded join the list the next time they are used. */
const SEEN_EVERY = 300;
function sessFile(): string { return dirname(accountsFile()) . '/rounds-sessions.json'; }
function sessLoad(): array { $a = json_decode((string) @file_get_contents(sessFile()), true); return is_array($a) ? $a : []; }
function sessEdit(callable $fn): void {
    $fh = @fopen(sessFile(), 'c+');
    if (!$fh) return;
    @flock($fh, LOCK_EX);
    $a = json_decode(stream_get_contents($fh) ?: '[]', true);
    if (!is_array($a)) $a = [];
    if (!isset($a['s']) || !is_array($a['s'])) $a['s'] = [];
    if (!isset($a['o']) || !is_array($a['o'])) $a['o'] = [];
    if (empty($a['since'])) $a['since'] = time();
    $a = $fn($a);
    $now = time();
    foreach ($a['s'] as $t => $l) if ((int) ($l[1] ?? 0) < $now) unset($a['s'][$t]);   // expired sign-ins drop off
    ftruncate($fh, 0); rewind($fh);
    @fwrite($fh, json_encode($a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    @flock($fh, LOCK_UN); @fclose($fh);
    @chmod(sessFile(), 0600);
}
/** every sign-in of one person ends (admin Sign out, New code, Remove) */
function sessEnd(string $id): void {
    sessEdit(function ($a) use ($id) {
        foreach ($a['s'] as $t => $l) if (($l[0] ?? '') === $id) unset($a['s'][$t]);
        $a['o'][$id] = time();
        return $a;
    });
}
/** what kind of device, from the browser's own description; an iPad on Safari says it is a Mac */
function deviceName(): string {
    $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
    if (stripos($ua, 'iPad') !== false) return 'iPad';
    if (stripos($ua, 'iPhone') !== false) return 'iPhone';
    if (stripos($ua, 'Android') !== false) return stripos($ua, 'Mobile') !== false ? 'Android phone' : 'Android tablet';
    if (stripos($ua, 'CrOS') !== false) return 'Chromebook';
    if (stripos($ua, 'Macintosh') !== false) return 'Mac or iPad';
    if (stripos($ua, 'Windows') !== false) return 'Windows computer';
    return 'Computer';
}
$basePeople = $people;
$acct = loadAccounts();
foreach ($basePeople as $c => $who) {
    $id = codeId((string) $c, $sessionKey);
    if (isset($acct['off'][$id])) { unset($people[$c]); continue; }
    if (isset($acct['over'][$id]) && is_array($acct['over'][$id])) $people[$c] = [(string) $acct['over'][$id][0], (string) $acct['over'][$id][1]];
}
foreach ($acct['people'] as $c => $p) {
    if (is_array($p) && !isset($basePeople[$c])) $people[(string) $c] = [(string) ($p[0] ?? ''), (string) ($p[1] ?? 'crew')];
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
/** a short tag for one sign-in, so the page can name its own session without seeing the cookie */
function sessionTag(string $tok): string { return substr(hash('sha256', 'sid|' . $tok), 0, 20); }
/* 2026-10-03 (review): the cookie proves who signed in, not that they still may. Deleting a
   person's line used to leave their phone signed in for up to 45 days, and a demoted admin
   kept admin. So every request looks the person up in the CURRENT list, and the name and role
   come from that line, never from the cookie.
   ⚑ Looked up by CODE, not by name (second review): matching by name merged two people who
   share one (a crew test code called "Matthew" became admin), and deleting one of two
   same-named lines left that phone signed in. The cookie carries a keyed hash of the code
   ('c'), never the code itself. Cookies from before this change have no 'c' and are refused,
   so everyone signs in once after the upload. */
function codeId(string $code, string $key): string { return substr(hash_hmac('sha256', 'code|' . $code, $key), 0, 20); }
if ($session) {
    $line = null;
    foreach ($people as $c => $who) {
        if (is_array($who) && hash_equals(codeId((string) $c, $sessionKey), (string) ($session['c'] ?? ''))) $line = $who;
    }
    /* signed out by an admin (2026-10-04): a session that began before the sign-out is refused; the code still works */
    $kick = (int) ($acct['kick'][(string) ($session['c'] ?? '')] ?? 0);
    if ($line !== null && $kick && ((int) ($session['exp'] ?? 0) - $sessionDays * 86400) <= $kick) $line = null;   // <=: a sign-in in the same second as the sign-out ends too
    if ($line === null) $session = null;
    else { $session['n'] = (string) ($line[0] ?? ''); $session['r'] = (string) ($line[1] ?? 'crew'); }
}

/* ---- sign-in rate limit -------------------------------------------------
 *
 * ⚑ COUNT FAILURES ONLY. The first version recorded every attempt, successes
 * included, and locked a legitimate user out after eight sign-ins — which is
 * exactly what happened on 2026-09-29: testing from one office used up the
 * allowance for everyone behind that IP, and the next correct code was refused.
 *
 * ⚑ 2026-10-03 (security review): a success used to CLEAR the address's failures.
 * That let one valid code buy unlimited guesses at the others: 7 wrong, 1 right,
 * repeat, until an admin code turned up. Now failures just expire. The 09-29
 * lockout stays fixed because a success is still never counted.
 * Also from the review:
 *   - the check and the count are one locked step (parallel requests used to all
 *     pass before any of them was counted);
 *   - IPv6 addresses are grouped by /64 (one home connection has billions);
 *   - a site-wide ceiling pauses NEW sign-ins when wrong codes pour in from many
 *     addresses. Phones already signed in keep working through a pause.
 */
function clientKey(): string {
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0');
    if (str_contains($ip, ':') && ($bin = @inet_pton($ip)) !== false && strlen($bin) === 16) {
        /* an IPv4 visitor reported as ::ffff:a.b.c.d would otherwise land every visitor in ONE
           bucket (all zeros /64), the 2026-09-29 lockout again (second review) */
        if (substr($bin, 0, 12) === "\0\0\0\0\0\0\0\0\0\0\xff\xff") return inet_ntop(substr($bin, 12));
        return bin2hex(substr($bin, 0, 8)) . '/64';
    }
    return $ip;
}
/* outside public_html, beside the door data (second review). The contact form still keeps its own counters in api/.ratelimit. */
function rateFile(string $who): string {
    $dir = dirname(DATA_DIR) . '/ratelimit';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    return $dir . '/r' . hash('sha256', $who . '|rounds');
}
/** Under the lock: refuse if over the limit, else count this attempt now. A success gives it back. */
function throttleTake(string $file, int $max, int $window): bool {
    global $throttleHeld;
    $fh = @fopen($file, 'c+');
    if (!$fh) { error_log('sixfold rounds: sign-in limiter cannot write ' . $file . ' - limit is OFF'); return true; }   // fail open, but say so
    @flock($fh, LOCK_EX);
    $raw = stream_get_contents($fh) ?: '[]';
    $hits = array_values(array_filter((array) json_decode($raw, true), fn($t) => is_int($t) && $t > time() - $window));
    $ok = count($hits) < $max;
    if ($ok) { $now = time(); $hits[] = $now; $throttleHeld[$file] = $now; }
    ftruncate($fh, 0); rewind($fh);
    @fwrite($fh, json_encode($hits));
    @flock($fh, LOCK_UN); @fclose($fh);
    return $ok;
}
/** The code was right: remove the attempt this request counted. Never touches earlier failures. */
function throttleGiveBack(string $file): void {
    global $throttleHeld;
    if (!isset($throttleHeld[$file])) return;
    $fh = @fopen($file, 'c+');
    if (!$fh) return;
    @flock($fh, LOCK_EX);
    $hits = (array) json_decode(stream_get_contents($fh) ?: '[]', true);
    $i = array_search($throttleHeld[$file], $hits, true);
    if ($i !== false) array_splice($hits, $i, 1);
    ftruncate($fh, 0); rewind($fh);
    @fwrite($fh, json_encode(array_values($hits)));
    @flock($fh, LOCK_UN); @fclose($fh);
    unset($throttleHeld[$file]);
}
$throttleHeld = [];
/** how many different addresses sent wrong codes in the last SITE_WINDOW; $add records one more (hashed) */
function siteAddrs(?string $add = null): int {
    $fh = @fopen(rateFile('*site-addrs*'), 'c+');
    if (!$fh) return SITE_MIN_ADDRS;   /* cannot tell: keep the pause able to work */
    @flock($fh, LOCK_EX);
    $rows = array_values(array_filter((array) json_decode(stream_get_contents($fh) ?: '[]', true), fn($r) => is_array($r) && (int) ($r[0] ?? 0) > time() - SITE_WINDOW));
    if ($add !== null) $rows[] = [time(), substr(hash('sha256', $add), 0, 16)];
    ftruncate($fh, 0); rewind($fh); @fwrite($fh, json_encode($rows));
    @flock($fh, LOCK_UN); @fclose($fh);
    return count(array_unique(array_column($rows, 1)));
}


/* ---- data -------------------------------------------------------------- */
function regionFile(string $key): ?string {
    if (!preg_match('/^[a-z0-9-]{1,40}$/D', $key)) return null;   // never let a path in
    $f = DATA_DIR . '/' . $key . '.json';
    return is_readable($f) ? $f : null;
}
function loadRegion(string $key): ?array {
    $f = regionFile($key);
    return $f ? json_decode((string) file_get_contents($f), true) : null;
}

/* ---- towns that used to share doors (2026-10-03) --------------------------
 * 958 doors were listed under two towns at once (all of Palmer Lake inside Monument; Castle
 * Rock overlapping Franktown and Sedalia), so a door marked under one still showed open under
 * the other, and its notes and numbers were split. Each door now belongs to ONE town. Whatever
 * was already recorded for it under the other town follows it: a town's logs are read together
 * with its partners' logs, keeping only rows for doors this town owns, oldest first, so "last
 * line wins" still holds. index.json "shared" names the partners; it only ever grows, because
 * the old rows stay in the old town's file for good. Writes go to the town that owns the door. */
function sharedWith(string $key): array {
    static $map = null;
    if ($map === null) {
        $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: [];
        $map = (array) ($idx['shared'] ?? []);
    }
    return array_values(array_filter((array) ($map[$key] ?? []), fn($k) => is_string($k) && regionFile($k)));
}
function doorIds(string $key): array {
    static $cache = [];
    if (!isset($cache[$key])) {
        $ids = [];
        foreach ((loadRegion($key)['areas'] ?? []) as $a) foreach (($a['doors'] ?? []) as $d) $ids[$d['id']] = true;
        $cache[$key] = $ids;
    }
    return $cache[$key];
}
/** Rows of one log ('marks', 'phones', ...) for a town, its partners' rows for its doors merged in. */
/** every door-log row also carries 'rt', when the server received it, to the microsecond. 'at' is
 *  when it was tapped (whole seconds), so two rows for one door can share it, and a door whose
 *  rows sit in two town files (SX-32) needs 'rt' to know which came last (found 2026-10-03: a
 *  "No answer" and an undo in the same second read in the wrong order). Rows from before this
 *  have no 'rt' and keep their file order. */
function stamped(array $row): array { $row['rt'] = round(microtime(true), 4); return $row; }
function logRows(string $kind, string $key): array {
    $read = static function (string $file): array {
        $rows = [];
        if (!is_readable($file) || !($fh = @fopen($file, 'r'))) return $rows;
        while (($line = fgets($fh)) !== false) { $r = json_decode(trim($line), true); if (is_array($r)) $rows[] = $r; }
        fclose($fh);
        return $rows;
    };
    $partners = sharedWith($key);
    $mine = $partners ? doorIds($key) : [];
    $all = []; $seq = 0;
    foreach ($partners as $p) foreach ($read(DATA_DIR . '/' . $kind . '-' . $p . '.log') as $r) {
        $hit = isset($r['id']) ? isset($mine[$r['id']])
             : (isset($r['ids']) && array_intersect_key(array_flip((array) $r['ids']), $mine));   /* area flags carry a list */
        if ($hit) { $r['_from'] = $p; $all[] = [(int) ($r['at'] ?? 0), (float) ($r['rt'] ?? 0), $seq++, $r]; }
    }
    foreach ($read(DATA_DIR . '/' . $kind . '-' . $key . '.log') as $r) $all[] = [(int) ($r['at'] ?? 0), (float) ($r['rt'] ?? 0), $seq++, $r];
    /* one total order (Fable): tap second, then unstamped before stamped, then receipt time,
       then file order — partner files first, because they hold the door's older history */
    usort($all, fn($a, $b) => $a[0] <=> $b[0] ?: ($a[1] > 0) <=> ($b[1] > 0) ?: $a[1] <=> $b[1] ?: $a[2] <=> $b[2]);
    return array_map(function ($x) { unset($x[3]['rt']); return $x[3]; }, $all);
}
/* ---- when a house sells (2026-10-03) ---------------------------------------
 * The door lists are rebuilt from county records every quarter. When the owner on the record
 * changes (build-rounds-data.mjs compares names; a spouse added or a move into a family trust
 * is not a change), the door carries 'os', the date the new owner was first seen, and 'oa'.
 * County records carry no sale date, so the sale fell somewhere before 'os':
 *   - recorded before 'oa': surely the previous owner's. The door is back on the list, an old
 *     Quote booked leaves the booked-quote list, and the old phone, email and note are shown as
 *     the previous owner's, with no Call or Email button;
 *   - recorded between 'oa' and 'os': could be either. It stays live, marked "check it's the
 *     new owner's" (review 2026-10-03: a Quote booked by the new owner between the sale and
 *     the re-pull must not vanish).
 * Nothing is deleted; the export keeps it all, with both dates. */
function dayTs(array $d, string $k): int {
    if (empty($d[$k]) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', (string) $d[$k])) return 0;
    return (new DateTime($d[$k] . ' 00:00', new DateTimeZone('America/Denver')))->getTimestamp();
}
/** 'prev' (surely the previous owner's), 'maybe' (either owner's) or '' (the current owner's) */
function ownerAge(array $d, ?array $r): string {
    $os = dayTs($d, 'os');
    if (!$os || !$r) return '';
    $at = (int) ($r['at'] ?? 0);
    if ($at >= $os) return '';
    $oa = dayTs($d, 'oa');
    return ($oa && $at >= $oa) ? 'maybe' : 'prev';
}
/** "1063 CLARKE CT" -> "CLARKE CT" — the same rule the walk-list builder groups by */
function streetName(string $address): string { return trim((string) preg_replace('/^\s*\d+\s+/', '', $address)); }
/** the biggest streets first (Fable, live review 2026-10-03: 62% of doors are on a street other than the name) */
function topStreets(array $counts, int $n): array { arsort($counts); return array_slice(array_keys($counts), 0, $n); }
/** the mark, unless it was surely made for the previous owner */
function freshMark(array $d, ?array $m): ?array { return ($m && ownerAge($d, $m) !== 'prev') ? $m : null; }
/** the flag a record carries in the app: ['prev' => true], ['maybe' => true] or nothing */
function ownerFlag(array $d, ?array $r): array { $a = ownerAge($d, $r); return $a ? [$a => true] : []; }

/** The town a door belongs to now, given the town the phone asked for. 409 when no town has it:
 *  a phone holding an old list must not save onto nothing (or, worse, onto another door). */
function doorHome(string $key, string $id): string {
    if (isset(doorIds($key)[$id])) return $key;
    foreach (sharedWith($key) as $p) if (isset(doorIds($p)[$id])) return $p;
    fail('That door is no longer on this list. Reload the neighbourhood.', 409);
}
function marksFile(string $key): string { return DATA_DIR . '/marks-' . $key . '.log'; }

/** Replay the append-only log: last line per door wins. */
function loadMarks(string $key): array {
    /* review 2026-10-03: a put-back removes only the mark it undid, so the door shows the mark
       before it (someone's Not now and its date survive a mistaken Quote booked + Undo). It used
       to wipe the door, while the stats (liveMarks) removed only one mark: the two disagreed. */
    $stack = [];
    foreach (logRows('marks', $key) as $m) {
        if (!is_array($m) || !isset($m['id'])) continue;
        if (($m['outcome'] ?? null) === null) { if (!empty($stack[$m['id']])) array_pop($stack[$m['id']]); continue; }
        $stack[$m['id']][] = ['outcome' => $m['outcome'], 'by' => $m['by'] ?? '', 'at' => $m['at'] ?? 0, 'revisit' => $m['revisit'] ?? ''];
    }
    $out = [];
    foreach ($stack as $id => $s) if ($s) $out[$id] = end($s);
    return $out;
}
function appendMark(string $key, array $row): bool {
    return (bool) @file_put_contents(marksFile($key), json_encode(stamped($row), JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}

/* A no-answer rests, then comes back on the to-knock list by itself (2026-10-02, Matthew):
   not the same afternoon, and nobody has to remember to put it back. One number to change. */
const MISS_REST_DAYS = 2;
function missRetry(array $m): string {
    return (new DateTime('@' . (int) ($m['at'] ?? 0)))->setTimezone(new DateTimeZone('America/Denver'))
        ->modify('+' . MISS_REST_DAYS . ' days')->format('Y-m-d');
}
/* Put back on the list is for mistakes (2026-10-02): it cancels the mark it undid, so that
   mark never counts on anyone's stats. Returns the marks still standing, oldest first. */
function liveMarks(array $rows): array {
    $stack = [];
    foreach ($rows as $m) {
        if (($m['outcome'] ?? null) === null) { if (!empty($stack[$m['id']])) array_pop($stack[$m['id']]); }
        else $stack[$m['id']][] = $m;
    }
    $out = [];
    foreach ($stack as $evs) foreach ($evs as $m) $out[] = $m;
    usort($out, fn($a, $b) => ($a['at'] ?? 0) <=> ($b['at'] ?? 0));
    return $out;
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
 * Numbers from people-search sites are typed in BY A PERSON. The app does not
 * scrape those sites: Claude declined to build that on 2026-10-01 (it would mean
 * defeating their anti-bot protection to harvest personal data, against their
 * terms). Licensed provider lookups are a different thing: see skip tracing below. */
function phonesFile(string $key): string { return DATA_DIR . '/phones-' . $key . '.log'; }

/** Replay the append-only log: last line per door wins; a null phone removes it. */
function loadPhones(string $key): array {
    $out = [];
    foreach (logRows('phones', $key) as $p) {
        if (!is_array($p) || !isset($p['id'])) continue;
        if (($p['phone'] ?? null) === null) unset($out[$p['id']]);   // removed
        else $out[$p['id']] = ['phone' => $p['phone'], 'source' => $p['source'] ?? 'other',
                                'seen' => $p['seen'] ?? '', 'by' => $p['by'] ?? '', 'at' => $p['at'] ?? 0]
                                + (isset($p['dnc']) ? ['dnc' => $p['dnc']] : []);   /* 'clear' on a number a skip trace put here (2026-10-04) */
    }
    return $out;
}
function appendPhone(string $key, array $row): bool {
    return (bool) @file_put_contents(phonesFile($key), json_encode(stamped($row), JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}
/* what a PERSON may pick in the form. 'trace' (a skip-trace result an admin put on the door, api/skiptrace.php)
   is written only by action=skippick, and only for a number the provider returned as not on the DNC list. */
const PHONE_SOURCES = ['door', 'tps', 'fps', 'other'];

/* ---- skip tracing (2026-10-04) ------------------------------------------
 * Matthew asked for provider lookups (BatchData first): a licensed, paid data service with an API
 * built for this, not the people-search scraping above. Nothing fetches on its own: an admin starts a
 * run, pays for it knowingly (dry run first), and every number that comes back is treated as
 * looked-up: no Call link until the provider says it is not on the Do Not Call list. The provider,
 * the batching, the results log and the rule live in api/skiptrace.php; the actions are below. */
require_once __DIR__ . '/skiptrace.php';

/* ---- notes (2026-10-01) ------------------------------------------------
 * What was said at the door: "dog in the yard", "back after 5", "wants aeration in
 * spring". Same append-only, keyed-on-door-id shape as marks and phones, so notes
 * survive every rebuild of the door lists. Last line wins; an empty note removes it. */
const NOTE_MAX = 500;

/* ---- crew lawn corrections (2026-10-02, SX-19) ---------------------------
 * The lawn level comes from a 2023 aerial photo and is a rough guide. Anyone at the
 * door can say what is really there: N none/little, S small, M medium, L large.
 * Last line per door wins; null clears it. These are the calibration data. */
function lawnfixFile(string $key): string { return DATA_DIR . '/lawnfix-' . $key . '.log'; }
function loadLawnFix(string $key): array {
    $out = [];
    foreach (logRows('lawnfix', $key) as $r) {
        if (!is_array($r) || !isset($r['id'])) continue;
        if (empty($r['lv'])) unset($out[$r['id']]);
        else $out[$r['id']] = ['lv' => $r['lv'], 'by' => $r['by'] ?? '', 'at' => $r['at'] ?? 0];
    }
    return $out;
}
function appendLawnFix(string $key, array $row): bool {
    return (bool) @file_put_contents(lawnfixFile($key), json_encode(stamped($row), JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}
/* ---- extra work spotted at the door (2026-10-03) ----------------------------
 * One door can be several jobs: branches over the roof, gutters full, an irrigation problem.
 * The crew taps what they saw; the whole set is saved each time, last line per door wins, an
 * empty set clears it. About the property, not the owner, so a house sale does not hide it. */
/* the list itself is the company's (company.json extraWork): workTags() / workLabels() */
function loadWork(string $key): array {
    $out = [];
    foreach (logRows('work', $key) as $r) {
        if (!is_array($r) || !isset($r['id'])) continue;
        $t = array_values(array_intersect((array) ($r['work'] ?? []), workTags()));
        if (!$t) unset($out[$r['id']]);
        else $out[$r['id']] = ['tags' => $t, 'by' => $r['by'] ?? '', 'at' => $r['at'] ?? 0];
    }
    return $out;
}
function appendWork(string $key, array $row): bool {
    return (bool) @file_put_contents(DATA_DIR . '/work-' . $key . '.log', json_encode(stamped($row), JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}
/* ---- what became of a booked quote (2026-10-03) ------------------------------
 * Won (with the job's value) or lost (with a reason), set on the Pipeline. Over time this
 * says which doors actually turn into jobs — the results report reads it. Last line wins. */
const LOST_WHY = ['price', 'other', 'later', 'silent', 'diy'];
const LOST_LABEL = ['price' => 'Price', 'other' => 'Went with someone else', 'later' => 'Not now, maybe later', 'silent' => 'Stopped answering', 'diy' => 'Doing it themselves'];
function loadResults(string $key): array {
    $out = [];
    foreach (logRows('result', $key) as $r) {
        if (!is_array($r) || !isset($r['id'])) continue;
        if (($r['result'] ?? null) !== 'won' && ($r['result'] ?? null) !== 'lost') unset($out[$r['id']]);
        else $out[$r['id']] = ['result' => $r['result'], 'value' => $r['value'] ?? null, 'why' => $r['why'] ?? '', 'by' => $r['by'] ?? '', 'at' => $r['at'] ?? 0];
    }
    return $out;
}
function appendResult(string $key, array $row): bool {
    return (bool) @file_put_contents(DATA_DIR . '/result-' . $key . '.log', json_encode(stamped($row), JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}
/* ---- leaderboard, daily goals, territories (SX-53, 2026-10-04) --------------------------
 * From the competitor audit (SalesRabbit, KnockBase), without live location tracking. Brandon
 * agreed to try it; Matthew 2026-10-04: admins only while it is tested. BOARD_OPEN = true shows
 * the board, the goals and each person's neighbourhoods to the crew as well.
 * Territories: a neighbourhood assigned to one person (newest row wins; who '' clears it).
 * Goals: one daily target per person for the whole team, in goals.json.
 * The test sign-ins (any name starting Claude or Fable, e.g. "Claude Check") never appear on the board. */
const BOARD_OPEN = false;
/* Matthew 2026-10-04: switched ON ("it won't matter if I don't assign territories yet, but I want it on"). Each person
   sees theirs: Your territories on the tools screen, a count per town, Yours on the list and Only mine. With nobody
   assigned, everyone still sees every neighbourhood as before. false hides the assignments from the crew again. */
const TERRITORIES_OPEN = true;
const ODDS_MIN = 150;   /* SX-54: conversations (booked + not now) across the team before the Odds sort means anything */
function boardOpen(string $role): bool { return BOARD_OPEN || $role === 'admin'; }
function boardHidden(string $name): bool { return (bool) preg_match('/^(claude|fable)\b/i', $name); }
function loadAssign(string $key): array {
    $out = [];
    foreach (logRows('assign', $key) as $r) {
        if (!is_array($r) || !isset($r['area'])) continue;
        if (($r['who'] ?? '') === '') unset($out[$r['area']]); else $out[$r['area']] = (string) $r['who'];
    }
    return $out;
}
function appendAssign(string $key, array $row): bool {
    return (bool) @file_put_contents(DATA_DIR . '/assign-' . $key . '.log', json_encode(stamped($row), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}
function loadGoals(): array {
    $g = json_decode((string) @file_get_contents(DATA_DIR . '/goals.json'), true);
    return is_array($g) ? $g : ['doors' => null, 'talked' => null, 'booked' => null];
}
/* ---- address search (2026-10-04) ------------------------------------------------------
 * Matthew: someone driving past a property that needs us can type the address and get its card.
 * Every door in every town, from a small text index (one line per door) rebuilt whenever a door
 * file is newer than it, so a search reads one file, not 8 MB of door lists. Words match the start
 * of a word in the address, in any order; "drive", "road", "north" match DR, RD, N. */
const SEARCH_SYN = ['DRIVE' => 'DR', 'ROAD' => 'RD', 'STREET' => 'ST', 'LANE' => 'LN', 'COURT' => 'CT', 'CIRCLE' => 'CIR',
    'AVENUE' => 'AVE', 'PLACE' => 'PL', 'TRAIL' => 'TRL', 'BOULEVARD' => 'BLVD', 'PARKWAY' => 'PKWY', 'TERRACE' => 'TER',
    'POINT' => 'PT', 'HEIGHTS' => 'HTS', 'HIGHWAY' => 'HWY', 'NORTH' => 'N', 'SOUTH' => 'S', 'EAST' => 'E', 'WEST' => 'W'];
function searchIndex(): array {
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $f = DATA_DIR . '/search-index.txt';
    $newest = 0; foreach (($idx['regions'] ?? []) as $r) { $rf = regionFile($r['key']); if ($rf) $newest = max($newest, (int) @filemtime($rf)); }
    if (!is_readable($f) || (int) @filemtime($f) < $newest) {
        $out = '';
        foreach (($idx['regions'] ?? []) as $r) {
            $data = loadRegion($r['key']); if (!$data) continue;
            foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
                $out .= implode("\t", [$r['key'], $r['label'], $a['name'], $d['id'], strtoupper((string) $d['address']), (int) ($d['fire'] ?? 0),
                    $d['lawn']['lv'] ?? '', $d['lawn']['yr'] ?? '', treeLevel($d) ?? '']) . "\n";
            }
        }
        $tmp = $f . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (@file_put_contents($tmp, $out, LOCK_EX) !== false) { if (!@rename($tmp, $f)) { @unlink($tmp); } }
        return explode("\n", rtrim($out, "\n"));
    }
    return explode("\n", rtrim((string) file_get_contents($f), "\n"));
}
/* ---- customers (2026-10-04) ------------------------------------------------------------------
 * Matthew: "we need a CRM ... something that can store this info and be used to rebuild data."
 * Customers and their visits live beside the leads, outside public_html, as append-only logs:
 *   customers/customers.log  one line per change   { id, by, at, f: {field: value, ...} }   later lines win, field by field
 *   customers/visits.log     one line per change   { vid, cid, by, at, date, service, price, note, status, del? }
 * Nothing is ever overwritten, so the whole history can be replayed (and rebuilt from a backup).
 * A customer may be tied to a door ('door' = "<town>/<door id>"), which keeps the door's fire, lawn,
 * trees and photos with them and tags the door "Customer" for the crew. Payments, cards and invoices
 * are deliberately not kept here; agreements are linked, not stored. Admin only. */
/* services are the company's (company.json services): custServices() */
const CUST_PLANS = ['oneoff', 'monthly', 'yearly', 'custom'];
const CUST_STATUS = ['active', 'paused', 'ended'];
function custDir(): string { return dirname(DATA_DIR) . '/customers'; }
function custLines(string $name): array {
    $f = custDir() . '/' . $name; $out = [];
    if (!is_readable($f)) return $out;
    foreach (explode("\n", (string) file_get_contents($f)) as $ln) { $j = json_decode($ln, true); if (is_array($j)) $out[] = $j; }
    return $out;
}
function loadCustomers(): array {
    $c = [];
    foreach (custLines('customers.log') as $r) {
        $id = (string) ($r['id'] ?? ''); if ($id === '' || !is_array($r['f'] ?? null)) continue;
        if (!isset($c[$id])) $c[$id] = ['id' => $id, 'created' => (int) ($r['at'] ?? 0), 'createdBy' => (string) ($r['by'] ?? '')];
        foreach ($r['f'] as $k => $v) $c[$id][$k] = $v;
        $c[$id]['updated'] = (int) ($r['at'] ?? 0); $c[$id]['updatedBy'] = (string) ($r['by'] ?? '');
    }
    return $c;
}
function loadVisits(): array {
    $v = [];
    foreach (custLines('visits.log') as $r) {
        $vid = (string) ($r['vid'] ?? ''); if ($vid === '') continue;
        if (!empty($r['del'])) { unset($v[$vid]); continue; }
        $v[$vid] = $r;
    }
    return $v;
}
/** door key => [plan, service, since] for active customers: the crew see "Customer" on that door */
function customerDoors(): array {
    $out = [];
    foreach (loadCustomers() as $c) if (($c['status'] ?? 'active') === 'active' && !empty($c['door'])) $out[(string) $c['door']] = ['plan' => $c['plan'] ?? 'oneoff', 'service' => $c['service'] ?? '', 'since' => $c['start'] ?? ''];
    return $out;
}
/* next visit after a done one: a month or a year on, kept inside the month (Fable 2026-10-04: PHP's
   '+1 month' turns 31 Jan into 3 Mar and skips February; 29 Feb + a year becomes 28 Feb) */
function nextDue(string $date, string $plan): string {
    [$y, $m, $d] = array_map('intval', explode('-', $date));
    if ($plan === 'yearly') $y++; else { $m++; if ($m > 12) { $m = 1; $y++; } }
    $last = (int) (new DateTime(sprintf('%04d-%02d-01', $y, $m)))->format('t');
    return sprintf('%04d-%02d-%02d', $y, $m, min($d, $last));
}
function dateOk(string $d): bool { return (bool) preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $d, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1]); }
/* ---- the walk (SX-51, 2026-10-04) ------------------------------------------------------
 * Sixfold quotes from a walk of the property, so a booked quote is a booked walk. The crew picks
 * the date and, if agreed, the time at the door; an admin can set or change it after a call. The
 * newest row per door wins; a cleared walk has date null. A walk saved before the door's current
 * booking belongs to an earlier one and is not shown (same rule as "quote sent"). */
function loadWalks(string $key): array {
    $out = [];
    foreach (logRows('walk', $key) as $r) {
        if (!is_array($r) || !isset($r['id'])) continue;
        if (empty($r['date'])) { unset($out[$r['id']]); continue; }
        $out[$r['id']] = ['date' => (string) $r['date'], 'time' => (string) ($r['time'] ?? ''), 'by' => $r['by'] ?? '', 'at' => (int) ($r['at'] ?? 0)];
    }
    return $out;
}
function appendWalk(string $key, array $row): bool {
    return (bool) @file_put_contents(DATA_DIR . '/walk-' . $key . '.log', json_encode(stamped($row), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}
/** the walk for a door's current booking, or null */
function walkFor(?array $m, ?array $w): ?array {
    if (!$m || ($m['outcome'] ?? '') !== 'booked' || !$w) return null;
    return (int) $w['at'] >= (int) ($m['at'] ?? 0) ? $w : null;
}
function regionLabel(string $key): string {
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    foreach (($idx['regions'] ?? []) as $r) if (($r['key'] ?? '') === $key) return (string) ($r['label'] ?? $key);
    return $key;
}
/* iCalendar text: escape, then fold at 75 octets (RFC 5545 3.1, 3.3.11) */
function icsEsc(string $v): string { return str_replace(["\\", ';', ',', "\r\n", "\n", "\r"], ["\\\\", '\;', '\,', '\n', '\n', ''], $v); }
function icsLine(string $l): string {
    $out = ''; $max = 75;                                    /* continuation lines start with a space, so they carry 74 (Fable 2026-10-04) */
    while (strlen($l) > $max) { $cut = $max; while ($cut > 0 && (ord($l[$cut]) & 0xC0) === 0x80) $cut--; $out .= substr($l, 0, $cut) . "\r\n "; $l = substr($l, $cut); $max = 74; }
    return $out . $l . "\r\n";
}
/* ---- fire check (SX-50, 2026-10-03) ------------------------------------------------------
 * A visual check of the home ignition zone, item by item, from the Colorado State Forest
 * Service's Home Ignition Zone guide (2021). Each item is 'ok' (done), 'fix' (needs work) or 'na'
 * (couldn't check). Every check is kept, so a check after the job sits beside the one before it
 * (before and after, the evidence insurers now have to count). About the property, so a house
 * sale does not hide it. The keys are fixed here and in the page. */
const FIRE_ITEMS = ['roof', 'debris', 'vents', 'deck', 'windows', 'siding', 'fence',
    'z1plants', 'z1store', 'overhang', 'grass', 'crowns', 'ladder', 'dead', 'firewood', 'propane', 'address'];
function loadFireChecks(string $key): array {
    $out = [];
    foreach (logRows('firecheck', $key) as $r) {
        if (!is_array($r) || !isset($r['id']) || !is_array($r['items'] ?? null)) continue;
        $items = array_intersect_key($r['items'], array_flip(FIRE_ITEMS));
        $out[$r['id']][] = ['items' => $items, 'note' => (string) ($r['note'] ?? ''), 'by' => $r['by'] ?? '', 'at' => $r['at'] ?? 0];
    }
    return $out;
}
function appendFireCheck(string $key, array $row): bool {
    return (bool) @file_put_contents(DATA_DIR . '/firecheck-' . $key . '.log', json_encode(stamped($row), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}
/** the newest check and the one before it (before and after); older ones stay in the log */
function lastChecks(array $checks): array { return array_slice($checks, -2); }
/* ---- emails (2026-10-02) ------------------------------------------------
 * For people who'd rather not give a number. Given at the door only: nothing looks
 * emails up. Last line per door wins; null removes it. */
function emailsFile(string $key): string { return DATA_DIR . '/emails-' . $key . '.log'; }
function loadEmails(string $key): array {
    $out = [];
    foreach (logRows('emails', $key) as $r) {
        if (!is_array($r) || !isset($r['id'])) continue;
        if (($r['email'] ?? null) === null) unset($out[$r['id']]);
        else $out[$r['id']] = ['email' => $r['email'], 'by' => $r['by'] ?? '', 'at' => $r['at'] ?? 0];
    }
    return $out;
}
function appendEmail(string $key, array $row): bool {
    return (bool) @file_put_contents(emailsFile($key), json_encode(stamped($row), JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}

/* ---- photos (2026-10-02) ------------------------------------------------
 * Walk-through photos for whoever builds the quote. The phone shrinks each one to
 * ~1600 px and re-encodes it as JPEG before sending, which also strips the phone's
 * GPS tag. Stored OUTSIDE public_html beside the logs, served only to a signed-in
 * session. Rule shown under the button: only with the owner's OK; the property, not
 * people. Log rows {id, f, by, at} add; {id, f, del:true} remove. */
const PHOTO_MAX_BYTES = 4194304;
const PHOTO_PER_DOOR = 20;
function photosFile(string $key): string { return DATA_DIR . '/photos-' . $key . '.log'; }
function photoPath(string $key, string $id, string $f): string { return DATA_DIR . '/photos/' . $key . '/' . $id . '/' . $f; }
function loadPhotos(string $key): array {
    $out = [];
    foreach (logRows('photos', $key) as $r) {
        if (!is_array($r) || !isset($r['id'], $r['f'])) continue;
        if (!empty($r['del'])) { if (isset($out[$r['id']])) $out[$r['id']] = array_values(array_filter($out[$r['id']], fn($x) => $x['f'] !== $r['f'])); }
        else $out[$r['id']][] = ['f' => $r['f'], 'by' => $r['by'] ?? '', 'at' => $r['at'] ?? 0, 'k' => $r['_from'] ?? $key];
    }
    return $out;
}
function appendPhotoLog(string $key, array $row): bool {
    return (bool) @file_put_contents(photosFile($key), json_encode(stamped($row), JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}
function validPhotoName(string $f): bool { return (bool) preg_match('/^\d{8}-\d{6}-[0-9a-f]{8}\.jpg$/D', $f); }

/* the level that counts: the crew's answer if there is one, else the photo's */
/* trees near the house (2026-10-03): the same levels as the door chip — against needs >= 25%
   cover in both 0-5 ft and 5-30 ft; heavy is >= 35% in 5-30 ft */
function treeLevel(array $d): ?string {
    $t = $d['trees'] ?? null;
    if (!$t || !isset($t['z2'])) return null;
    if (($t['z1'] ?? 0) >= 0.25 && $t['z2'] >= 0.25) return 'against';
    if ($t['z2'] >= 0.35) return 'heavy';
    return $t['z2'] >= 0.10 ? 'some' : 'clear';
}
function lawnLevel(array $d, array $fix): ?string {
    if (isset($fix[$d['id']])) return $fix[$d['id']]['lv'];
    return $d['lawn']['lv'] ?? null;
}

/* ---- neighbourhood no-soliciting flag (2026-10-01, SX-13) ----------------
 * A posting at a subdivision entrance. Any crew member can raise it; only an
 * admin can clear it, or one wrong tap quietly drops a neighbourhood from the
 * programme. The neighbourhood still shows, with a warning: an entrance sign does
 * not always cover every street.
 *
 * ⚑ STORED AGAINST THE DOOR IDS IT COVERED, NOT THE NEIGHBOURHOOD NAME. Names
 * change when the lists are rebuilt (the 2026-10-01 split renamed dozens). A flag
 * keyed on a name would silently fall off and the doors would be knocked again.
 * Keyed on doors, a neighbourhood shows as flagged if ANY of its doors was under a
 * flag — so a flagged pocket that gets split leaves both halves flagged, which is
 * the safe direction. Rows: {fid, name, ids, on, by, at}; last line per fid wins. */
function areaflagFile(string $key): string { return DATA_DIR . '/areaflags-' . $key . '.log'; }
function loadAreaFlags(string $key): array {
    $out = [];
    foreach (logRows('areaflags', $key) as $r) {
        if (!is_array($r) || !isset($r['fid'])) continue;
        if (empty($r['on'])) { unset($out[$r['fid']]); continue; }
        $out[$r['fid']] = ['name' => $r['name'] ?? '', 'ids' => array_flip((array) ($r['ids'] ?? [])),
                           'by' => $r['by'] ?? '', 'at' => $r['at'] ?? 0];
    }
    return $out;
}
function appendAreaFlag(string $key, array $row): bool {
    return (bool) @file_put_contents(areaflagFile($key), json_encode(stamped($row), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}
/* every active flag that covers any door of this neighbourhood */
function flagsOver(array $doors, array $flags): array {
    $hit = [];
    foreach ($flags as $fid => $fl) {
        foreach ($doors as $d) { if (isset($fl['ids'][$d['id']])) { $hit[$fid] = $fl; break; } }
    }
    return $hit;
}
function flagSummary(array $hit): ?array {
    if (!$hit) return null;
    $first = reset($hit);
    return ['by' => $first['by'], 'at' => $first['at']];
}

/* ---- quote sent (2026-10-01) -------------------------------------------
 * The Pipeline shows every door marked Quote booked. Ticking "quote sent" moves it to
 * the Quote sent stage. Same append-only shape as the rest. */
function quotedFile(string $key): string { return DATA_DIR . '/quoted-' . $key . '.log'; }
function loadQuoted(string $key): array {
    $out = [];
    foreach (logRows('quoted', $key) as $q) {
        if (!is_array($q) || !isset($q['id'])) continue;
        if (empty($q['quoted'])) unset($out[$q['id']]);
        else $out[$q['id']] = ['by' => $q['by'] ?? '', 'at' => $q['at'] ?? 0];
    }
    return $out;
}
function appendQuoted(string $key, array $row): bool {
    return (bool) @file_put_contents(quotedFile($key), json_encode(stamped($row), JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}
function notesFile(string $key): string { return DATA_DIR . '/notes-' . $key . '.log'; }
function loadNotes(string $key): array {
    $out = [];
    foreach (logRows('notes', $key) as $n) {
        if (!is_array($n) || !isset($n['id'])) continue;
        if (($n['note'] ?? null) === null) unset($out[$n['id']]);
        else $out[$n['id']] = ['note' => $n['note'], 'by' => $n['by'] ?? '', 'at' => $n['at'] ?? 0];
    }
    return $out;
}
function appendNote(string $key, array $row): bool {
    return (bool) @file_put_contents(notesFile($key), json_encode(stamped($row), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}

/* When a save happened. A phone with no signal sends its queue later, and the time it was TAPPED
   rides along as 't': used if it is within the last 7 days and not in the future, so a dead-zone
   Friday evening counts on Friday and its no-answers come back on time (review 2026-10-03). */
function tapTime(array $body): int {
    $now = time(); $t = (int) ($body['t'] ?? 0);
    return ($t > $now - 7 * 86400 && $t <= $now + 60) ? min($t, $now) : $now;
}

/* ---- routing ----------------------------------------------------------- */
$action = (string) ($_REQUEST['action'] ?? '');
$isPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
$body = [];
if ($isPost) {
    $raw = file_get_contents('php://input') ?: '';
    $body = (array) (json_decode($raw, true) ?? []);
}

/* the Hail screen: every storm day, the towns and neighbourhoods it hit (admins, where the company has it on) */
if ($action === 'hail') {
    if (!$session) fail('Sign in first.', 401);
    if (!hailOn((string) ($session['r'] ?? ''))) fail('Not allowed.', 403);
    $j = json_decode((string) @file_get_contents(DATA_DIR . '/hail-storms.json'), true);
    out(['ok' => true] + (is_array($j) ? $j : ['storms' => [], 'none' => true]));
}

/* the hail map (2026-10-05): one storm day's path, grid squares of 0.75 in or more */
if ($action === 'hailmap') {
    if (!$session) fail('Sign in first.', 401);
    if (!hailOn((string) ($session['r'] ?? ''))) fail('Not allowed.', 403);
    $day = (string) ($_GET['day'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $day)) fail('Pick a storm day.');
    $j = json_decode((string) @file_get_contents(DATA_DIR . '/hail-paths.json'), true);
    if (!is_array($j)) out(['ok' => true, 'none' => true, 'cells' => []]);
    out(['ok' => true, 'day' => $day, 'grid' => array_intersect_key($j, array_flip(['lat1', 'lon1', 'dx', 'dy', 'r0', 'c0'])), 'cells' => $j['paths'][$day] ?? []]);
}

/* the company's name, mark, colours and lists, for the sign-in screen and everything after (2026-10-04) */
/* without appUrl (review 2026-10-04): the folder name is what keeps the sign-in page out of sight; only the morning email needs it */
if ($action === 'company') out(['ok' => true, 'company' => array_diff_key(company(), ['appUrl' => 1])]);

if ($action === 'signin') {
    if (!$isPost) fail('POST required', 405);
    $addrFile = rateFile(clientKey()); $siteFile = rateFile('*site*');
    if (!throttleTake($addrFile, MAX_TRIES, TRY_WINDOW)) fail('Too many wrong codes from here. Wait fifteen minutes.', 429);
    if (!throttleTake($siteFile, SITE_TRIES, SITE_WINDOW) && siteAddrs() >= SITE_MIN_ADDRS) {
        throttleGiveBack($addrFile);
        /* written down so a pause is noticed (second review): one line per refused sign-in.
           To lift a pause early, delete sixfold-data/ratelimit/ entirely. */
        @file_put_contents(dirname(DATA_DIR) . '/ratelimit/paused.log', json_encode(['at' => time(), 'ip' => clientKey()]) . "\n", FILE_APPEND | LOCK_EX);
        fail('Sign-in is paused for up to an hour after too many wrong codes. Phones already signed in still work. Tell an admin.', 429);
    }
    $code = preg_replace('/\D/', '', (string) ($body['code'] ?? ''));
    $hit = null; $hitCode = '';
    foreach ($people as $c => $who) {                            // constant-time-ish: check all
        if (hash_equals((string) $c, (string) $code)) { $hit = $who; $hitCode = (string) $c; }
    }
    if (!$hit) { siteAddrs(clientKey()); fail('That code was not recognised.', 401); }      // the attempt already counted stands
    throttleGiveBack($addrFile); throttleGiveBack($siteFile);   // right code: only THIS attempt is given back
    /* 'j': two sign-ins in the same second used to get the same cookie, so the signed-in list saw one phone (2026-10-04) */
    $payload = ['n' => $hit[0], 'r' => $hit[1] ?? 'crew', 'c' => codeId($hitCode, $sessionKey), 'exp' => time() + $sessionDays * 86400, 'j' => bin2hex(random_bytes(4))];
    $secure = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off');
    $tok = sign($payload, $sessionKey);
    setcookie(COOKIE, $tok, [
        'expires'  => $payload['exp'], 'path' => '/', 'httponly' => true,
        'samesite' => 'Lax', 'secure' => $secure,
    ]);
    $line = [$payload['c'], $payload['exp'], time(), deviceName()];
    sessEdit(function ($a) use ($tok, $line) { $a['s'][sessionTag($tok)] = $line; return $a; });
    out(['ok' => true, 'name' => $payload['n'], 'role' => $payload['r'], 'sid' => sessionTag($tok)]);
}

/* A sign-out names the session it is for (Fable, 2026-10-03). A phone that signed out with no
   signal tells the server later; by then someone else may have signed in on the same iPad, and
   a late "sign out" must not end THEIR session. The page only knows the tag (the cookie itself
   is HttpOnly); a sign-out with no tag clears whatever is there, as before. */
if ($action === 'signout') {
    $sid = (string) ($_GET['sid'] ?? '');
    $cur = (string) ($_COOKIE[COOKIE] ?? '');
    if ($sid !== '' && $cur !== '' && !hash_equals(sessionTag($cur), $sid)) out(['ok' => true, 'kept' => true]);
    /* review 2026-10-05: a link someone taps (a GET without this session's tag) signs nobody out; the page posts */
    if (!$isPost && $sid === '') out(['ok' => true, 'kept' => true]);
    if ($cur !== '') {
        $gone = sessionTag($cur); $who = (string) ($session['c'] ?? '');
        sessEdit(function ($a) use ($gone, $who) { unset($a['s'][$gone]); if ($who !== '') $a['o'][$who] = time(); return $a; });
    }
    $secure = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off');
    setcookie(COOKIE, '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => $secure]);
    out(['ok' => true]);
}

/* the morning email runs this file from the server's own command line (sixfold-tools/morning-email.php,
   started by cron) and asks for one thing: the digest. A web request is never 'cli', so this can't be
   reached from a browser. */
if (PHP_SAPI === 'cli' && defined('SIXFOLD_CLI') && in_array($action, ['digest', 'skiptrace', 'skiplist', 'skipexport'], true)) {
    /* skiptrace / skiplist / skipexport: tools/skip-trace.php, the same way (2026-10-04) */
    $session = ['n' => $action === 'digest' ? 'Morning email' : 'Command line', 'r' => 'admin', 'c' => ''];
}

/* everything past here needs a session */
if (!$session) fail('Sign in first.', 401);
$me   = (string) $session['n'];
$role = (string) ($session['r'] ?? 'crew');
if (!defined('SIXFOLD_CLI') && ($cookieNow = (string) ($_COOKIE[COOKIE] ?? '')) !== '') {
    $tagNow = sessionTag($cookieNow);
    $lineNow = sessLoad()['s'][$tagNow] ?? null;
    if (!is_array($lineNow) || (int) ($lineNow[2] ?? 0) < time() - SEEN_EVERY) {
        $fresh = [(string) ($session['c'] ?? ''), (int) ($session['exp'] ?? 0), time(), is_array($lineNow) ? (string) ($lineNow[3] ?? deviceName()) : deviceName()];
        sessEdit(function ($a) use ($tagNow, $fresh) { $a['s'][$tagNow] = $fresh; return $a; });
    }
}

if ($action === 'me') out(['ok' => true, 'name' => $me, 'role' => $role, 'sid' => sessionTag((string) ($_COOKIE[COOKIE] ?? ''))]);

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

/** county wildfire protection plan ratings by place name (SX-47; cwppPlaces() reads cwpp.json once) */
function cwppPlaces(): array {
    static $p = null;
    if ($p === null) $p = json_decode((string) @file_get_contents(DATA_DIR . '/cwpp.json'), true)['places'] ?? [];
    return $p;
}
if ($action === 'regions') {
    if (!is_readable(DATA_DIR . '/index.json')) {
        fail('The door lists are not on this server yet. Sign in as admin and open ?action=diag to see where it looked.', 503);
    }
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $regions = [];
    $today = (new DateTime('now', new DateTimeZone('America/Denver')))->format('Y-m-d');
    $segT = []; $segB = [];                  /* SX-54: conversations and quotes per kind of door, across every town */
    /* the county each town is in, from the funding sheet (one list to keep up to date) */
    $countyOf = (json_decode((string) @file_get_contents(DATA_DIR . '/docs/money.json'), true) ?: [])['counties'] ?? [];
    foreach (($idx['regions'] ?? []) as $r) {
        $data = loadRegion($r['key']);
        if (!$data) continue;
        $marks = loadMarks($r['key']);
        $aflags = loadAreaFlags($r['key']);
        $lfix = loadLawnFix($r['key']);
        $assign = (TERRITORIES_OPEN || $role === 'admin') ? loadAssign($r['key']) : [];   /* admins plan territories now; the crew see theirs once TERRITORIES_OPEN is true */
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
            /* due: a Not-now door whose come-back date has arrived. It is open again,
               so a due high-hazard door counts towards the hazard sort as well. */
            /* retry: a no-answer that has rested MISS_REST_DAYS, back on the list. noanswer is
               now only the ones still resting. */
            $done = 0; $noanswer = 0; $hot = 0; $vhot = 0; $due = 0; $booked = 0; $retry = 0;
            $treeA = 0; $treeH = 0;                  /* trees against / heavy at doors STILL TO KNOCK, for the trees sort */
            $sla = 0.0; $slo = 0.0; $nll = 0;        /* centre point, for "nearest neighbourhood" */
            $lawnL = 0; $lawnM = 0;                  /* large / medium lawns STILL TO KNOCK, for the lawn sort */
            $all3 = 0;                               /* still to knock with all three: high fire, large or medium lawn, trees against or heavy (2026-10-04) */
            $streets = [];                           /* doors per street: a neighbourhood is named after its biggest street only */
            $aseg = [];                              /* SX-54: doors still to knock, per kind of door */
            foreach ($a['doors'] as $d) {
                $sn = streetName((string) ($d['address'] ?? ''));
                if ($sn !== '') $streets[$sn] = ($streets[$sn] ?? 0) + 1;
                $m = freshMark($d, $marks[$d['id']] ?? null);
                $f = (int) ($d['fire'] ?? 0);
                if (isset($d['lat'], $d['lon']) && is_numeric($d['lat']) && is_numeric($d['lon'])) { $sla += $d['lat']; $slo += $d['lon']; $nll++; }
                $isDue = $m && $m['outcome'] === 'later' && ($m['revisit'] ?? '') !== '' && $m['revisit'] <= $today;
                /* a no-answer still counts as needing a knock (SX-9b rule), even during its 2-day rest */
                $open = !$m || $m['outcome'] === 'miss' || $isDue;
                if ($open && ($f === 4 || $f === 5)) { $hot++; if ($f === 5) $vhot++; }
                if ($open) { $lv = lawnLevel($d, $lfix); if ($lv === 'L') $lawnL++; elseif ($lv === 'M') $lawnM++; }
                if ($open) { $tl = treeLevel($d); if ($tl === 'against') $treeA++; elseif ($tl === 'heavy') $treeH++; }
                if ($open && ($f === 4 || $f === 5) && in_array(lawnLevel($d, $lfix), ['L', 'M'], true) && in_array(treeLevel($d), ['against', 'heavy'], true)) $all3++;
                $seg = (in_array($f, [3, 4, 5], true) ? (string) $f : 'x') . (lawnLevel($d, $lfix) ?: 'x');
                if ($open) $aseg[$seg] = ($aseg[$seg] ?? 0) + 1;
                if ($m && in_array($m['outcome'], ['booked', 'later'], true)) { $segT[$seg] = ($segT[$seg] ?? 0) + 1; if ($m['outcome'] === 'booked') $segB[$seg] = ($segB[$seg] ?? 0) + 1; }
                if (!$m) continue;
                if ($m['outcome'] === 'booked') $booked++;
                if ($isDue) $due++;
                elseif ($m['outcome'] === 'miss' && missRetry($m) <= $today) $retry++;
                elseif ($m['outcome'] === 'miss') $noanswer++;
                else $done++;
            }
            $areas[] = ['name' => $a['name'], 'avg' => $a['avg'], 'total' => count($a['doors']),
                        'done' => $done, 'noanswer' => $noanswer, 'hot' => $hot, 'vhot' => $vhot, 'due' => $due, 'retry' => $retry, 'booked' => $booked,
                        'nosol' => flagSummary(flagsOver($a['doors'], $aflags)),
                        'la' => $nll ? round($sla / $nll, 5) : null, 'lo' => $nll ? round($slo / $nll, 5) : null,
                        'lawnL' => $lawnL, 'lawnM' => $lawnM, 'treeA' => $treeA, 'treeH' => $treeH, 'all3' => $all3, 'place' => $a['place'] ?? null, 'fw' => $a['fw'] ?? null,
                        'st' => topStreets($streets, 4), 'ns' => count($streets), 'who' => $assign[$a['name']] ?? null,
                        'cwpp' => !empty($a['place']['n']) ? (cwppPlaces()[strtolower((string) $a['place']['n'])] ?? null) : null,
                        '_seg' => $aseg];
        }
        $regions[] = ['key' => $r['key'], 'label' => $r['label'], 'county' => $countyOf[$r['key']] ?? null, 'areas' => $areas];
    }
    /* ---- our own odds (SX-54, 2026-10-04) ----
       Expected quotes from the doors still to knock: each door counts at the rate doors like it
       (fire hazard x lawn size) have booked when someone answered, across every town. A kind of
       door with few conversations leans on the overall rate (k = 10). Nothing until the team has
       ODDS_MIN conversations: before that the numbers are noise. */
    $T = array_sum($segT); $B = array_sum($segB); $ready = $T >= ODDS_MIN;
    $base = $T ? $B / $T : 0;
    foreach ($regions as &$rg) {
        foreach ($rg['areas'] as &$ar) {
            if ($ready) {
                $e = 0.0; $n = 0;
                foreach ($ar['_seg'] as $sg => $c) { $e += $c * ((($segB[$sg] ?? 0) + 10 * $base) / (($segT[$sg] ?? 0) + 10)); $n += $c; }
                $ar['odds'] = ['exp' => round($e, 1), 'open' => $n];
            }
            unset($ar['_seg']);
        }
        unset($ar);
        $rg['odds'] = ['ready' => $ready, 'talked' => $T, 'booked' => $B, 'min' => ODDS_MIN];
    }
    unset($rg);
    out(['ok' => true, 'regions' => $regions]);
}

if ($action === 'area') {
    $key  = (string) ($_REQUEST['region'] ?? '');
    $name = (string) ($_REQUEST['area'] ?? '');
    $data = loadRegion($key);
    if (!$data) fail('No such region.', 404);
    $marks = loadMarks($key);
    $phones = loadPhones($key);
    $notes = loadNotes($key);
    $lfix = loadLawnFix($key);
    $emails = loadEmails($key);
    $photos = loadPhotos($key);
    $work = loadWork($key);
    $fchk = loadFireChecks($key);
    $walks = loadWalks($key);
    $custDoors = customerDoors();   /* the crew see the tag on the door (plan and start date only, no contact details) */
    /* skip-trace results ride along for admins only (crew too if the config says crew_see); every number carries its DNC answer */
    $placeOf = skipMail($key);   /* id => {c: city, z: ZIP, m: mailing}; only c and z are sent */
    $traces = ($role === 'admin' || !empty(skipConfig(__DIR__)['crew_see'])) ? skipLoad($key) : [];
    $hailOf = hailOn($role) ? loadHail($key) : [];   /* admins only: storms near the house, newest first */
    $roofOf = roofDataOn($role) ? loadSide('roof', $key) : []; $bldOf = roofDataOn($role) ? loadSide('year', $key) : [];
    $photoOf = roofDataOn($role) ? loadSide('photo', $key) : [];   /* [file, x, y, half-window] in the 2020 3-inch photos */
    foreach ($data['areas'] as $a) {
        if ($a['name'] !== $name) continue;
        $doors = [];
        foreach ($a['doors'] as $d) {
            $m0 = $marks[$d['id']] ?? null; $m = freshMark($d, $m0);
            $p = $phones[$d['id']] ?? null;
            $n = $notes[$d['id']] ?? null;
            $em = $emails[$d['id']] ?? null;
            $doors[] = [
                'id' => $d['id'], 'address' => $d['address'], 'acres' => $d['acres'], 'owner' => $d['owner'],
                'lat' => $d['lat'] ?? null, 'lon' => $d['lon'] ?? null,
                'fire' => $d['fire'] ?? null,
                'mark' => $m ? ['outcome' => $m['outcome'], 'by' => $m['by'], 'revisit' => $m['revisit'] ?? '',
                               'retry' => $m['outcome'] === 'miss' ? missRetry($m) : ''] + ownerFlag($d, $m) : null,
                'phone' => $p ? ['phone' => $p['phone'], 'source' => $p['source'], 'seen' => $p['seen'],
                                 'by' => $p['by'], 'at' => $p['at']] + ownerFlag($d, $p) + (isset($p['dnc']) ? ['dnc' => $p['dnc']] : []) : null,
                'trace' => isset($traces[$d['id']]) ? skipPublic($traces[$d['id']]) : null,
                'hail' => $hailOf[$d['id']] ?? null,
                'roof' => $roofOf[$d['id']] ?? null, 'bld' => $bldOf[$d['id']] ?? null, 'photo' => $photoOf[$d['id']] ?? null,
                'city' => $placeOf[$d['id']]['c'] ?? null, 'zip' => $placeOf[$d['id']]['z'] ?? null,   /* for Look up number (2026-10-04); the mailing address stays on the server */
                'note' => $n ? ['note' => $n['note'], 'by' => $n['by'], 'at' => $n['at']] + ownerFlag($d, $n) : null,
                'os' => $d['os'] ?? null,
                'prevMark' => ($m0 && !$m) ? ['outcome' => $m0['outcome'], 'by' => $m0['by'], 'at' => $m0['at']] : null,
                'lawn' => $d['lawn'] ?? null,
                'lawnfix' => $lfix[$d['id']] ?? null,
                'trees' => $d['trees'] ?? null,
                'val' => $d['val'] ?? null,
                'work' => $work[$d['id']] ?? null,
                'fc' => isset($fchk[$d['id']]) ? lastChecks($fchk[$d['id']]) : null,
                'walk' => walkFor($m, $walks[$d['id']] ?? null),
                'cust' => $custDoors[$key . '/' . $d['id']] ?? null,
                'email' => $em ? $em + ownerFlag($d, $em) : null,
                'photos' => $photos[$d['id']] ?? [],
            ];
        }
        out(['ok' => true, 'area' => $a['name'], 'avg' => $a['avg'], 'doors' => $doors, 'rest' => MISS_REST_DAYS, 'place' => $a['place'] ?? null, 'fw' => $a['fw'] ?? null,
             'nosol' => flagSummary(flagsOver($a['doors'], loadAreaFlags($key)))]);
    }
    fail('No such neighbourhood.', 404);
}

if ($action === 'mark') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    $out = $body['outcome'] ?? null;                              // null = undo
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    /* 'nosolicit' (2026-10-01): the door shows a no-soliciting sign. A finished door,
       permanently — counted as done, never as open, never in the hazard count. */
    if ($out !== null && !in_array($out, ['booked', 'later', 'miss', 'nosolicit'], true)) fail('Bad outcome.');
    /* "Come back when" rides on the Not-now mark itself, so it travels through the
       offline queue with the mark: a date picked in a dead zone is not lost. */
    $row = ['id' => $id, 'outcome' => $out, 'by' => $me, 'at' => tapTime($body)];
    $rv = (string) ($body['revisit'] ?? '');
    if ($rv !== '') {
        if ($out !== 'later') fail('A come-back date only goes with Not now.');
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $rv, $mm) || !checkdate((int) $mm[2], (int) $mm[3], (int) $mm[1])) {
            fail('That is not a real date.');
        }
        $row['revisit'] = $rv;
    }
    $ok = appendMark($key, $row);
    if (!$ok) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

if ($action === 'phone') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    $raw = $body['phone'] ?? null;
    if ($raw === null || trim((string) $raw) === '') {             // remove the number
        if (!appendPhone($key, ['id' => $id, 'phone' => null, 'by' => $me, 'at' => tapTime($body)])) fail('Could not save that. Try again.', 500);
        out(['ok' => true]);
    }
    $digits = preg_replace('/\D/', '', (string) $raw);
    if (strlen($digits) === 11 && $digits[0] === '1') $digits = substr($digits, 1);
    /* North American numbering: area code and exchange both start 2-9 */
    if (!preg_match('/^[2-9]\d{2}[2-9]\d{6}$/D', $digits)) fail('That is not a valid 10-digit US number.');
    $source = (string) ($body['source'] ?? '');
    if (!in_array($source, PHONE_SOURCES, true)) fail('Pick where the number came from.');
    $seen = (string) ($body['seen'] ?? '');
    if ($seen !== '' && !preg_match('/^\d{4}-(0[1-9]|1[0-2])$/D', $seen)) fail('Last seen must be a month, like 2026-08.');
    if ($source === 'door') $seen = '';                             // given in person: the date given is `at`
    if (!appendPhone($key, ['id' => $id, 'phone' => $digits, 'source' => $source, 'seen' => $seen, 'by' => $me, 'at' => tapTime($body)])) {
        fail('Could not save that. Try again.', 500);
    }
    out(['ok' => true]);
}

if ($action === 'email') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    $e = trim((string) ($body['email'] ?? ''));
    if ($e === '') {
        if (!appendEmail($key, ['id' => $id, 'email' => null, 'by' => $me, 'at' => tapTime($body)])) fail('Could not save that. Try again.', 500);
        out(['ok' => true]);
    }
    if (strlen($e) > 120 || !filter_var($e, FILTER_VALIDATE_EMAIL)) fail('That does not look like an email address.');
    if (!appendEmail($key, ['id' => $id, 'email' => strtolower($e), 'by' => $me, 'at' => tapTime($body)])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

if ($action === 'photo') {
    if (!$isPost) fail('POST required', 405);
    /* review 2026-10-05: a ceiling per person, so one code cannot fill the host's disk */
    if (!throttleTake(rateFile('photo|' . (string) ($session['c'] ?? $me)), 120, 3600)) fail('That is a lot of photos in an hour. Wait a little and try again.', 429);
    $key = (string) ($_GET['region'] ?? '');
    $id  = (string) ($_GET['id'] ?? '');
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    $bin = $raw ?? '';
    if (strlen($bin) < 100) fail('No photo received.');
    if (strlen($bin) > PHOTO_MAX_BYTES) fail('That photo is too big to send.', 413);
    $info = @getimagesizefromstring($bin);
    if (!$info || ($info['mime'] ?? '') !== 'image/jpeg' || $info[0] > 6000 || $info[1] > 6000) fail('That is not a JPEG photo.');
    $have = loadPhotos($key)[$id] ?? [];
    if (count($have) >= PHOTO_PER_DOOR) fail('This door already has ' . PHOTO_PER_DOOR . ' photos. Remove one first.');
    $dir = DATA_DIR . '/photos/' . $key . '/' . $id;
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) fail('Could not save that. Try again.', 500);
    $f = (new DateTime('now', new DateTimeZone('America/Denver')))->format('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.jpg';
    if (@file_put_contents($dir . '/' . $f, $bin, LOCK_EX) === false) fail('Could not save that. Try again.', 500);
    if (!appendPhotoLog($key, ['id' => $id, 'f' => $f, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'f' => $f]);
}

if ($action === 'photoget') {
    $key = (string) ($_GET['region'] ?? '');
    $id  = (string) ($_GET['id'] ?? '');
    $f   = (string) ($_GET['f'] ?? '');
    if (!loadRegion($key) || !preg_match('/^[a-z0-9-]{1,80}$/D', $id) || !validPhotoName($f)) fail('No such photo.', 404);
    $hit = null;
    foreach (loadPhotos($key)[$id] ?? [] as $x) if ($x['f'] === $f) $hit = $x;
    $path = $hit ? photoPath($hit['k'], $id, $f) : '';
    if (!$hit || !is_readable($path)) fail('No such photo.', 404);
    header('Content-Type: image/jpeg');
    header('Cache-Control: no-store');   /* review 2026-10-05: not kept on a shared iPad after sign-out */
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

if ($action === 'photodel') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    $f   = (string) ($body['f'] ?? '');
    if (!loadRegion($key) || !preg_match('/^[a-z0-9-]{1,80}$/D', $id) || !validPhotoName($f)) fail('No such photo.', 404);
    $hit = null;
    foreach (loadPhotos($key)[$id] ?? [] as $x) if ($x['f'] === $f) $hit = $x;
    if (!$hit) fail('No such photo.', 404);
    if ($hit['by'] !== $me && $role !== 'admin') fail('Only the person who took it, or an admin, can remove it.', 403);
    $key = doorHome($key, $id);
    if (!appendPhotoLog($key, ['id' => $id, 'f' => $f, 'del' => true, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    @unlink(photoPath($hit['k'], $id, $f));
    out(['ok' => true]);
}

/* ---- stats (2026-10-02) ---------------------------------------------------
 * Built from the logs, so it covers every day since the app went live, not just
 * since this was added. A door counts once per person per day, at its LAST outcome
 * that day (marking then changing a door is one door). A put-back cancels the mark it
 * undid, on whatever day that mark was made. Days are
 * Colorado days. Crew see their own; an admin sees everyone, or one person. */
/* everyone's (or one person's) days: doors, outcomes, phones given, emails, notes, photos. Shared
   by My stats, Team stats and the leaderboard (SX-53), so they always count the same way. */
function teamDays(int $days, string $who): array {
    $tz = new DateTimeZone('America/Denver');
    $since = (new DateTime('today', $tz))->modify('-' . ($days - 1) . ' days')->getTimestamp();
    $dayOf = function ($ts) use ($tz) { return (new DateTime('@' . (int) $ts))->setTimezone($tz)->format('Y-m-d'); };
    $people = [];
    $bump = function (string $name, string $date, string $k) use (&$people) {
        if (!isset($people[$name][$date])) $people[$name][$date] = ['doors' => 0, 'booked' => 0, 'later' => 0, 'miss' => 0, 'nosolicit' => 0, 'phones' => 0, 'emails' => 0, 'photos' => 0, 'notes' => 0];
        $people[$name][$date][$k]++;
    };
    /* review 2026-10-03: through logRows(), so a door's rows from its old town and its new town are
       read together (a put-back filed under the new town used to leave the old mark counted).
       Rows for a door that moved AWAY to a partner town are left for that town to count. */
    $rowsOf = function (string $kind, string $k) use ($since) {
        $away = [];
        foreach (sharedWith($k) as $pk) foreach (doorIds($pk) as $id => $_) $away[$id] = true;
        $mine = doorIds($k);
        return array_values(array_filter(logRows($kind, $k), fn($r) => isset($r['id']) && (int) ($r['at'] ?? 0) >= $since
            && (isset($r['_from']) || !isset($away[$r['id']]) || isset($mine[$r['id']]))));
    };
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    foreach (($idx['regions'] ?? []) as $rg) {
        $k = $rg['key'];
        $last = [];
        foreach (liveMarks($rowsOf('marks', $k)) as $m) $last[($m['by'] ?? '') . '|' . $dayOf($m['at']) . '|' . $m['id']] = $m['outcome'] ?? null;
        foreach ($last as $kk => $o) {
            if ($o === null) continue;
            [$n, $dt] = explode('|', $kk);
            if ($who !== '' && $n !== $who) continue;
            $bump($n, $dt, 'doors');
            if (in_array($o, ['booked', 'later', 'miss', 'nosolicit'], true)) $bump($n, $dt, $o);
        }
        foreach ([['phones', 'phones', 'phone'], ['emails', 'emails', 'email'], ['notes', 'notes', 'note']] as [$what, $kind, $field]) {
            $seen = [];
            foreach ($rowsOf($kind, $k) as $r) {
                if (($r[$field] ?? null) === null) continue;
                if ($what === 'phones' && ($r['source'] ?? '') !== 'door') continue;     /* only numbers GIVEN at the door count */
                $n = $r['by'] ?? ''; $dt = $dayOf($r['at']);
                if ($who !== '' && $n !== $who) continue;
                if (isset($seen["$n|$dt|{$r['id']}"])) continue;
                $seen["$n|$dt|{$r['id']}"] = 1;
                $bump($n, $dt, $what);
            }
        }
        foreach ($rowsOf('photos', $k) as $r) {
            if (!empty($r['del'])) continue;
            $n = $r['by'] ?? '';
            if ($who !== '' && $n !== $who) continue;
            $bump($n, $dayOf($r['at']), 'photos');
        }
    }
    $list = [];
    foreach ($people as $n => $byDay) {
        if ($n === '') continue;
        krsort($byDay);
        $rows = [];
        foreach ($byDay as $dt => $c) $rows[] = ['date' => $dt] + $c;
        $list[] = ['name' => $n, 'days' => $rows];
    }
    usort($list, fn($a, $b) => strcmp($a['name'], $b['name']));
    return $list;
}
if ($action === 'stats') {
    $days = max(1, min(120, (int) ($_REQUEST['days'] ?? 30)));
    $who = $role === 'admin' ? trim((string) ($_REQUEST['who'] ?? '')) : $me;
    $list = teamDays($days, $who);
    out(['ok' => true, 'days' => $days, 'today' => (new DateTime('now', new DateTimeZone('America/Denver')))->format('Y-m-d'), 'who' => $who, 'people' => $list]);
}

/* ---- my doors (2026-10-02) ------------------------------------------------
 * Every door one person acted on in the window: marked, or gave a phone, email, note
 * or photo. A mark that was put back (a mistake) does not count. Each row carries what THEY last did and what the door shows
 * NOW, so the page can tell "still yours" from "since changed by someone else".
 * Crew see their own; an admin may ask for anyone's (who=). Newest first. */
if ($action === 'mydoors') {
    $days = max(1, min(120, (int) ($_REQUEST['days'] ?? 30)));
    $who = $role === 'admin' ? trim((string) ($_REQUEST['who'] ?? '')) : $me;
    if ($who === '') $who = $me;
    $since = (new DateTime('today', new DateTimeZone('America/Denver')))->modify('-' . ($days - 1) . ' days')->getTimestamp();
    /* rows come through logRows(), so a door that now belongs to another town keeps its history
       (2026-10-03: each door belongs to one town; its old rows stay in the old town's file) */
    $read = function (array $rows, bool $onlyWho) use ($since, $who) {
        return array_values(array_filter($rows, fn($r) => isset($r['id']) && (!$onlyWho || ($r['by'] ?? '') === $who) && (int) ($r['at'] ?? 0) >= $since));
    };
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $rows = [];
    foreach (($idx['regions'] ?? []) as $rg) {
        $k = $rg['key'];
        $hit = [];                                   /* door id => what this person did */
        /* everyone's marks, so a put-back by anyone cancels what it undid; then keep this person's */
        foreach (liveMarks($read(logRows('marks', $k), false)) as $m) {
            if (($m['by'] ?? '') !== $who) continue;
            $h = $hit[$m['id']] ?? ['at' => 0, 'did' => []];
            $h['mine'] = ['outcome' => $m['outcome'] ?? null, 'at' => (int) $m['at'], 'revisit' => $m['revisit'] ?? ''];
            $h['at'] = max($h['at'], (int) $m['at']);
            $hit[$m['id']] = $h;
        }
        foreach ([['phone', 'phones'], ['email', 'emails'], ['note', 'notes'], ['photo', 'photos'], ['work', 'work']] as [$what, $kind]) {
            foreach ($read(logRows($kind, $k), true) as $r) {
                if ($what === 'photo' && !empty($r['del'])) continue;
                if ($what !== 'photo' && ($r[$what] ?? null) === null) continue;
                $h = $hit[$r['id']] ?? ['at' => 0, 'did' => []];
                $h['did'][$what] = 1;
                $h['at'] = max($h['at'], (int) $r['at']);
                $hit[$r['id']] = $h;
            }
        }
        if (!$hit) continue;
        $data = loadRegion($k);
        if (!$data) continue;
        $marks = loadMarks($k);
        foreach ($data['areas'] as $a) {
            foreach ($a['doors'] as $d) {
                if (!isset($hit[$d['id']])) continue;
                $h = $hit[$d['id']];
                $now = $marks[$d['id']] ?? null;
                $rows[] = [
                    'region' => $k, 'town' => $data['label'] ?? $k, 'area' => $a['name'],
                    'id' => $d['id'], 'address' => $d['address'], 'at' => $h['mine']['at'] ?? $h['at'],   /* the mark's day (review 2026-10-03) */
                    'mine' => $h['mine'] ?? null, 'did' => array_keys($h['did']),
                    'now' => $now ? ['outcome' => $now['outcome'], 'by' => $now['by'], 'at' => $now['at'], 'revisit' => $now['revisit'] ?? ''] + ownerFlag($d, $now) : null,
                ];
                unset($hit[$d['id']]);
            }
        }
    }
    usort($rows, fn($x, $y) => $y['at'] <=> $x['at']);
    out(['ok' => true, 'who' => $who, 'days' => $days, 'today' => (new DateTime('now', new DateTimeZone('America/Denver')))->format('Y-m-d'), 'doors' => $rows]);
}

/* ---- money sheets (2026-10-02, SX-23) --------------------------------------
 * Short internal sheets on the tax credit, insurance and grants, opened from a door card.
 * Kept in the private data folder, not the page: they sit behind the sign-in like the
 * doors, and a fact can be corrected by uploading the JSON alone. */
/* ---- the lawn behind a door's size (SX-38, 2026-10-03) -------------------------------
 * build-lawn-outlines.mjs writes one pack per town: for each Medium and Large lawn, which grass
 * was counted and which was left out, on the 2023 photo's grid. The app shades it on the aerial. */
if ($action === 'lawnmask') {
    $key = (string) ($_GET['region'] ?? '');
    $id  = (string) ($_GET['id'] ?? '');
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $home = doorHome($key, $id);
    $f = DATA_DIR . '/lawnmask-' . $home . '.json';
    $p = is_readable($f) ? json_decode((string) file_get_contents($f), true) : null;
    $e = is_array($p) ? ($p['doors'][$id] ?? null) : null;
    out(['ok' => true, 'mask' => $e, 'ndvi' => $e && isset($e['g']) ? ($p['ndvi'] ?? null) : null]);
}

/* ---- communities (SX-40, 2026-10-03) -------------------------------------------------
 * Neighbourhoods grouped by the community they sit in — subdivision or metro district (the
 * parcel records' name) and nearby Firewise sites — with what is still to knock, so a whole
 * HOA or Firewise community can be pitched as one job. HOAs matched by name from the state
 * roster (hoa-communities.json). Admin only. */
if ($action === 'communities') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $hoa = json_decode((string) @file_get_contents(DATA_DIR . '/hoa-communities.json'), true)['places'] ?? [];
    $cwpp = cwppPlaces();
    $g = [];
    foreach (($idx['regions'] ?? []) as $r) {
        $data = loadRegion($r['key']);
        if (!$data) continue;
        $marks = loadMarks($r['key']); $lfix = loadLawnFix($r['key']);
        foreach ($data['areas'] as $a) {
            $keys = [];
            if (!empty($a['place']['n'])) $keys[] = [($a['place']['k'] ?? 'sub') === 'metro' ? 'metro' : 'sub', (string) $a['place']['n']];
            foreach ((array) ($a['fw'] ?? []) as $fw) if (!empty($fw['n'])) $keys[] = ['fw', (string) $fw['n']];
            if (!$keys) continue;
            $st = ['doors' => 0, 'hot' => 0, 'vhot' => 0, 'lawnL' => 0, 'lawnM' => 0, 'treeA' => 0, 'knocked' => 0, 'booked' => 0];
            $vals = [];
            foreach ($a['doors'] as $d) {
                $st['doors']++;
                $m = freshMark($d, $marks[$d['id']] ?? null);
                if ($m) { $st['knocked']++; if ($m['outcome'] === 'booked') $st['booked']++; }
                $open = !$m || $m['outcome'] === 'miss' || ($m['outcome'] === 'later' && ($m['revisit'] ?? '') !== '' && $m['revisit'] <= date('Y-m-d'));
                if (!$open) continue;
                $f = (int) ($d['fire'] ?? 0);
                if ($f === 4 || $f === 5) { $st['hot']++; if ($f === 5) $st['vhot']++; }
                $lv = lawnLevel($d, $lfix); if ($lv === 'L') $st['lawnL']++; elseif ($lv === 'M') $st['lawnM']++;
                if (treeLevel($d) === 'against') $st['treeA']++;
                if (!empty($d['val'])) $vals[] = (int) $d['val'];
            }
            foreach ($keys as [$kind, $name]) {
                $k = $kind . '|' . strtolower($name);
                $c = $g[$k] ?? ['kind' => $kind, 'name' => $name, 'towns' => [], 'areas' => [], 'vals' => [],
                                'doors' => 0, 'hot' => 0, 'vhot' => 0, 'lawnL' => 0, 'lawnM' => 0, 'treeA' => 0, 'knocked' => 0, 'booked' => 0];
                foreach ($st as $f2 => $v) $c[$f2] += $v;
                $c['towns'][$r['label'] ?? $r['key']] = 1;
                $c['areas'][] = ['region' => $r['key'], 'name' => $a['name'], 'doors' => $st['doors'], 'hot' => $st['hot']];
                $c['vals'] = array_merge($c['vals'], $vals);
                $g[$k] = $c;
            }
        }
    }
    $list = [];
    foreach ($g as $c) {
        sort($c['vals']); $n = count($c['vals']);
        $c['valMed'] = $n ? $c['vals'][intdiv($n, 2)] : null; unset($c['vals']);
        $c['towns'] = array_keys($c['towns']);
        usort($c['areas'], fn($x, $y) => $y['hot'] <=> $x['hot'] ?: $y['doors'] <=> $x['doors']);
        $c['hoa'] = $c['kind'] !== 'fw' ? ($hoa[strtolower($c['name'])] ?? null) : null;
        $c['cwpp'] = $c['kind'] !== 'fw' ? ($cwpp[strtolower($c['name'])] ?? null) : null;
        $list[] = $c;
    }
    usort($list, fn($x, $y) => $y['hot'] <=> $x['hot'] ?: $y['doors'] <=> $x['doors']);
    out(['ok' => true, 'communities' => $list]);
}

/* ---- alerts (SX-41, 2026-10-03) ------------------------------------------------------
 * Fire weather and wildfires near the towns, from two public feeds, fetched at most every
 * 10 minutes and kept in sixfold-data/rounds/alerts-cache.json:
 *   - National Weather Service active alerts at each town's centre (api.weather.gov), kept
 *     when they bear on the work: red flag, fire weather, fire, heat, air quality, smoke, wind;
 *   - wildfires (not prescribed burns) within 60 miles that are not fully contained, from the
 *     national interagency incident feed (NIFC WFIGS current incident locations).
 * Homeowners listen after a scare; the app also says never to knock inside an evacuation area.
 * A feed that fails keeps the last good answer and says how old it is. Any signed-in user. */
const ALERT_TOWNS = [
    'monument' => [39.0917, -104.8722], 'palmer-lake' => [39.1222, -104.9169], 'black-forest' => [39.0138, -104.7025],
    'castle-rock' => [39.3722, -104.8561], 'larkspur' => [39.2311, -104.8747], 'sedalia' => [39.4386, -104.9614],
    'franktown' => [39.3894, -104.7519], 'woodland-park' => [39.0000, -105.0569], 'divide' => [38.9469, -105.1636],
    'florissant' => [38.9469, -105.2911], 'cripple-creek' => [38.7466, -105.1783]];
const ALERT_EVENTS = ['Red Flag Warning', 'Fire Weather Watch', 'Fire Warning', 'Extreme Fire Danger', 'Heat Advisory',
    'Excessive Heat Warning', 'Extreme Heat Warning', 'Air Quality Alert', 'Dense Smoke Advisory', 'High Wind Warning', 'High Wind Watch'];
function httpJson(string $url, array $headers = []): ?array {
    $hdr = array_merge([agentHeader(), 'Accept: application/geo+json, application/json'], $headers);
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_HTTPHEADER => $hdr, CURLOPT_FOLLOWLOCATION => true]);
        $body = curl_exec($c); $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c);
        if ($body !== false && $code === 200) { $j = json_decode((string) $body, true); if (is_array($j)) return $j; }
    }
    return httpJsonPlain($url, $hdr);   /* curl missing or failing (e.g. no certificate list): the plain way */
}
function httpJsonPlain(string $url, array $hdr): ?array {
    $body = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 8, 'header' => implode("\r\n", $hdr)]]));
    if ($body === false) return null;
    $j = json_decode((string) $body, true);
    return is_array($j) ? $j : null;
}
/** several GETs at once (curl_multi); null for any that failed. Falls back to one at a time. */
function httpJsonMany(array $urls): array {
    if (!function_exists('curl_multi_init')) return array_map(fn($u) => httpJson($u), $urls);
    $hdr = [agentHeader(), 'Accept: application/geo+json, application/json'];
    $mh = curl_multi_init(); $hs = [];
    foreach ($urls as $k => $u) {
        $c = curl_init($u);
        curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_HTTPHEADER => $hdr, CURLOPT_FOLLOWLOCATION => true]);
        curl_multi_add_handle($mh, $c); $hs[$k] = $c;
    }
    do { $st = curl_multi_exec($mh, $running); if ($running) curl_multi_select($mh, 1.0); } while ($running && $st === CURLM_OK);
    $out = [];
    foreach ($hs as $k => $c) {
        $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE); $body = curl_multi_getcontent($c);
        $j = ($code === 200 && $body) ? json_decode((string) $body, true) : null;
        $out[$k] = is_array($j) ? $j : httpJsonPlain($urls[$k], $hdr);   /* a failed one gets one plain retry */
        curl_multi_remove_handle($mh, $c); curl_close($c);
    }
    curl_multi_close($mh);
    return $out;
}
function milesBetween(float $la1, float $lo1, float $la2, float $lo2): float {
    return hypot(($la1 - $la2) * 69.0, ($lo1 - $lo2) * 69.0 * cos(deg2rad($la1)));
}
function freshAlerts(): array {
    $f = DATA_DIR . '/alerts-cache.json';
    $cache = is_readable($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : [];
    if (($cache['at'] ?? 0) > time() - 600) return $cache;
    $fp = @fopen($f . '.lock', 'c');                        /* one refresh at a time */
    if (!$fp || !flock($fp, LOCK_EX | LOCK_NB)) return $cache ?: ['at' => 0, 'weather' => [], 'fires' => [], 'stale' => true];
    $weather = []; $wOk = true;
    $answers = httpJsonMany(array_map(fn($p) => 'https://api.weather.gov/alerts/active?point=' . $p[0] . ',' . $p[1], ALERT_TOWNS));
    foreach (ALERT_TOWNS as $town => [$la, $lo]) {
        $j = $answers[$town] ?? null;
        if ($j === null) { $wOk = false; continue; }
        foreach (($j['features'] ?? []) as $ft) {
            $p = $ft['properties'] ?? [];
            if (!in_array($p['event'] ?? '', ALERT_EVENTS, true)) continue;
            $id = (string) ($p['id'] ?? $ft['id'] ?? '');
            if (!isset($weather[$id])) $weather[$id] = ['event' => $p['event'], 'headline' => (string) ($p['headline'] ?? ''),
                'ends' => (string) ($p['ends'] ?? $p['expires'] ?? ''), 'severity' => (string) ($p['severity'] ?? ''),
                'url' => 'https://alerts.weather.gov/search?id=' . rawurlencode($id), 'towns' => []];
            $weather[$id]['towns'][] = $town;
        }
    }
    $fires = []; $fOk = true;
    $q = http_build_query(['where' => "IncidentTypeCategory='WF'", 'geometry' => '-104.95,39.1', 'geometryType' => 'esriGeometryPoint', 'inSR' => '4326',
        'distance' => '60', 'units' => 'esriSRUnit_StatuteMile', 'outFields' => 'IncidentName,IncidentSize,PercentContained,FireDiscoveryDateTime,POOCounty,POOState',
        'returnGeometry' => 'true', 'outSR' => '4326', 'f' => 'json']);
    $j = httpJson('https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query?' . $q);
    if ($j === null || isset($j['error'])) $fOk = false;
    else foreach (($j['features'] ?? []) as $ft) {
        $a = $ft['attributes'] ?? []; $g = $ft['geometry'] ?? [];
        if (!isset($g['x'], $g['y'])) continue;
        if (($a['PercentContained'] ?? null) !== null && (float) $a['PercentContained'] >= 100) continue;
        $best = null; $dist = [];
        foreach (ALERT_TOWNS as $town => [$la, $lo]) { $mi = milesBetween($la, $lo, (float) $g['y'], (float) $g['x']); $dist[$town] = (int) round($mi); if (!$best || $mi < $best[1]) $best = [$town, $mi]; }
        $fires[] = ['name' => (string) ($a['IncidentName'] ?? 'Unnamed fire'), 'acres' => isset($a['IncidentSize']) ? (float) $a['IncidentSize'] : null,
            'contained' => isset($a['PercentContained']) ? (float) $a['PercentContained'] : null,
            'found' => isset($a['FireDiscoveryDateTime']) ? (int) ($a['FireDiscoveryDateTime'] / 1000) : null,
            'county' => trim((string) ($a['POOCounty'] ?? '') . ', ' . (string) ($a['POOState'] ?? ''), ', '),
            'near' => $best[0], 'miles' => (int) round($best[1]), 'dist' => $dist, 'lat' => (float) $g['y'], 'lon' => (float) $g['x']];
    }
    usort($fires, fn($x, $y) => $x['miles'] <=> $y['miles']);
    $out = ['at' => time(),
            'weather' => $wOk || !$cache ? array_values($weather) : ($cache['weather'] ?? []),
            'fires' => $fOk || !$cache ? $fires : ($cache['fires'] ?? []),
            'stale' => !$wOk || !$fOk];
    @file_put_contents($f, json_encode($out, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
    flock($fp, LOCK_UN); fclose($fp);
    return $out;
}
if ($action === 'alerts') {
    $a = freshAlerts();
    out(['ok' => true, 'at' => $a['at'] ?? 0, 'weather' => $a['weather'] ?? [], 'fires' => $a['fires'] ?? [], 'stale' => !empty($a['stale'])]);
}

/* ---- around our jobs (2026-10-03, after GlassHouse) ------------------------------------
 * Neighbours notice the trucks. For every job won in the last 60 days, the nearest doors still
 * to knock within half a mile (40 at most), for a short walk with "we're working on a home on
 * your street this week". The job is given by street and number to the crew only; the opener
 * names the street, never the house. Any signed-in user. */
const AROUND_DAYS = 60, AROUND_MAX = 40, AROUND_M = 800;
function metresBetween(float $la1, float $lo1, float $la2, float $lo2): float {
    return hypot(($la1 - $la2) * 111320.0, ($lo1 - $lo2) * 111320.0 * cos(deg2rad($la1)));
}
if ($action === 'aroundjobs') {
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $since = time() - AROUND_DAYS * 86400;
    $jobs = []; $all = [];
    foreach (($idx['regions'] ?? []) as $r) {
        $data = loadRegion($r['key']);
        if (!$data) continue;
        $marks = loadMarks($r['key']); $res = loadResults($r['key']);
        foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
            if (!isset($d['lat'], $d['lon']) || !is_numeric($d['lat'])) continue;
            $m = freshMark($d, $marks[$d['id']] ?? null);
            $rs = $res[$d['id']] ?? null;
            if ($rs && $rs['result'] === 'won' && (int) $rs['at'] >= $since) {
                $jobs[] = ['region' => $r['key'], 'town' => $r['label'] ?? $r['key'], 'area' => $a['name'], 'id' => $d['id'],
                           'address' => $d['address'], 'street' => streetName((string) $d['address']), 'lat' => (float) $d['lat'], 'lon' => (float) $d['lon'], 'won' => (int) $rs['at']];
            }
            $open = !$m || $m['outcome'] === 'miss' || ($m['outcome'] === 'later' && ($m['revisit'] ?? '') !== '' && $m['revisit'] <= date('Y-m-d'));
            if ($open) $all[] = ['region' => $r['key'], 'area' => $a['name'], 'id' => $d['id'], 'address' => $d['address'], 'lat' => (float) $d['lat'], 'lon' => (float) $d['lon'],
                                 'fire' => $d['fire'] ?? null, 'lawn' => $d['lawn']['lv'] ?? null];
        }
    }
    usort($jobs, fn($x, $y) => $y['won'] <=> $x['won']);
    $jobs = array_slice($jobs, 0, 20);
    foreach ($jobs as &$j) {
        $near = [];
        foreach ($all as $d) {
            if ($d['id'] === $j['id']) continue;
            $dm = metresBetween($j['lat'], $j['lon'], $d['lat'], $d['lon']);
            if ($dm <= AROUND_M) $near[] = $d + ['m' => (int) round($dm)];
        }
        usort($near, fn($x, $y) => $x['m'] <=> $y['m']);
        $j['doors'] = array_slice($near, 0, AROUND_MAX);
    }
    unset($j);
    out(['ok' => true, 'days' => AROUND_DAYS, 'jobs' => $jobs]);
}

/* ---- call list when fire weather hits (2026-10-03, after HailTrace) ---------------------
 * When a weather alert covers a town, or a wildfire is within 30 miles of it, the people to
 * check on there: customers won, quotes sent, quotes booked — with the number they gave at the
 * door. A check-in, not a pitch. Admin only (names and numbers). */
if ($action === 'alertcalls') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $al = freshAlerts();
    $towns = [];
    foreach (($al['weather'] ?? []) as $w) foreach ((array) ($w['towns'] ?? []) as $t) $towns[$t][] = (string) $w['event'];
    foreach (($al['fires'] ?? []) as $fi) foreach ((array) ($fi['dist'] ?? []) as $t => $mi) if ($mi <= 30) $towns[$t][] = 'Wildfire ' . $mi . ' mi away (' . $fi['name'] . ')';
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $people = [];
    foreach (($idx['regions'] ?? []) as $r) {
        if (!isset($towns[$r['key']])) continue;
        $data = loadRegion($r['key']);
        if (!$data) continue;
        $marks = loadMarks($r['key']); $res = loadResults($r['key']); $quoted = loadQuoted($r['key']); $phones = loadPhones($r['key']);
        foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
            $m = freshMark($d, $marks[$d['id']] ?? null);
            $rs = $res[$d['id']] ?? null;
            $status = ($rs && $rs['result'] === 'won') ? 'won' : (($m && $m['outcome'] === 'booked') ? (isset($quoted[$d['id']]) ? 'sent' : 'booked') : null);
            if (!$status) continue;
            $p = $phones[$d['id']] ?? null;
            if ($p && (ownerAge($d, $p) === 'prev' || ($p['source'] ?? '') !== 'door')) $p = null;   /* only numbers given at the door */
            $people[] = ['region' => $r['key'], 'town' => $r['label'] ?? $r['key'], 'area' => $a['name'], 'id' => $d['id'], 'address' => $d['address'],
                         'owner' => preg_match('/^unavailable$/i', (string) $d['owner']) ? '' : (string) $d['owner'], 'status' => $status,
                         'phone' => $p['phone'] ?? null, 'why' => array_values(array_unique($towns[$r['key']]))];
        }
    }
    $rank = ['won' => 0, 'sent' => 1, 'booked' => 2];
    usort($people, fn($x, $y) => $rank[$x['status']] <=> $rank[$y['status']] ?: strcmp($x['town'], $y['town']));
    out(['ok' => true, 'towns' => array_keys($towns), 'people' => $people]);
}

if ($action === 'money') {
    $f = DATA_DIR . '/docs/money.json';
    $j = is_readable($f) ? json_decode((string) file_get_contents($f), true) : null;
    if (!is_array($j)) fail('The money sheets are not on this server yet.', 404);
    out(['ok' => true] + $j);
}

/* ---- leads (2026-10-03) ---------------------------------------------------
 * One list for every way an enquiry arrives. The website form files its leads here itself
 * (api/submit.php, beside the email it already sends). Meta ad leads, Nextdoor messages,
 * phone calls and referrals are added by hand from the app; the Pipeline shows them beside the
 * door bookings. Admin only: these are customers' names and numbers. Append-only, like the marks:
 *   leads/leads.log   one line per lead        { id, src, at, need, name, phone, email, town, msg, by? }
 *   leads/leadst.log  one line per update      { id, status?, note?, by, at }   last status wins */
const LEAD_SRC = ['website', 'meta', 'nextdoor', 'phone', 'linktree', 'referral', 'other'];
const LEAD_STATUS = ['new', 'contacted', 'walk', 'quoted', 'won', 'lost'];
function leadsDir(): string { return dirname(DATA_DIR) . '/leads'; }
function readLines(string $f): array {
    $out = [];
    if (!is_readable($f)) return $out;
    $fh = @fopen($f, 'r'); if (!$fh) return $out;
    while (($line = fgets($fh)) !== false) { $r = json_decode(trim($line), true); if (is_array($r) && isset($r['id'])) $out[] = $r; }
    fclose($fh);
    return $out;
}
function appendLine(string $f, array $row): bool {
    if (!is_dir(dirname($f)) && !@mkdir(dirname($f), 0750, true)) return false;
    return (bool) @file_put_contents($f, json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}
$clean = function ($v, int $max): string {
    $t = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', str_replace("\r\n", "\n", (string) $v));
    $t = trim((string) $t);
    return function_exists('mb_substr') ? mb_substr($t, 0, $max, 'UTF-8') : substr($t, 0, $max);
};

if ($action === 'leads') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $leads = []; foreach (readLines(leadsDir() . '/leads.log') as $l) $leads[$l['id']] = $l + ['status' => 'new', 'notes' => [], 'statusAt' => null, 'statusBy' => null];
    foreach (readLines(leadsDir() . '/leadst.log') as $u) {
        if (!isset($leads[$u['id']])) continue;
        if (!empty($u['status'])) { $leads[$u['id']]['status'] = $u['status']; $leads[$u['id']]['statusAt'] = $u['at']; $leads[$u['id']]['statusBy'] = $u['by']; }
        if (!empty($u['note'])) $leads[$u['id']]['notes'][] = ['note' => $u['note'], 'by' => $u['by'], 'at' => $u['at']];
    }
    $list = array_reverse(array_values($leads)); // later in the file = newer, for leads filed in the same second (usort is stable)
    usort($list, fn($a, $b) => ($b['at'] ?? 0) <=> ($a['at'] ?? 0));
    $new = count(array_filter($list, fn($l) => $l['status'] === 'new'));
    if (!empty($_REQUEST['count'])) out(['ok' => true, 'new' => $new]);
    out(['ok' => true, 'new' => $new, 'leads' => $list]);
}

if ($action === 'leadadd') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $src = (string) ($body['src'] ?? '');
    if (!in_array($src, LEAD_SRC, true) || $src === 'website') fail('Pick where the lead came from.');
    $row = ['id' => 'm' . date('YmdHis') . bin2hex(random_bytes(3)), 'src' => $src, 'at' => time(),
            'need' => $clean($body['need'] ?? '', 60), 'name' => $clean($body['name'] ?? '', 120), 'phone' => $clean($body['phone'] ?? '', 40),
            'email' => $clean($body['email'] ?? '', 160), 'town' => $clean($body['town'] ?? '', 160), 'msg' => $clean($body['msg'] ?? '', 2000), 'by' => $me];
    if ($row['name'] === '' && $row['phone'] === '' && $row['email'] === '') fail('Add at least a name, a phone number or an email.');
    if ($row['email'] !== '' && !filter_var($row['email'], FILTER_VALIDATE_EMAIL)) fail('That email does not look right.');
    if (!appendLine(leadsDir() . '/leads.log', $row)) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'id' => $row['id']]);
}

/* Meta Instant Form leads (2026-10-04). They land in Meta's Leads Center and never reach email, so an admin
   downloads them there as a file and the page reads it and sends the rows here. Each keeps Meta's own lead
   id ('ext'), so importing the same file twice adds nothing; someone already in the Pipeline by phone or email
   (a website form, a lead typed in) is counted, not added again. Same row shape as + Add a lead. */
if ($action === 'leadimport') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $rows = $body['rows'] ?? null;
    if (!is_array($rows) || !$rows) fail('No leads in that file.');
    if (count($rows) > 500) fail('That is more than 500 leads at once. Download a shorter date range.');
    $digits = fn($p) => substr(preg_replace('/\D/', '', (string) $p), -10);
    $seenExt = []; $seenWho = [];
    foreach (readLines(leadsDir() . '/leads.log') as $l) {
        if (!empty($l['ext'])) $seenExt[(string) $l['ext']] = true;
        $d = $digits($l['phone'] ?? ''); if (strlen($d) === 10) $seenWho['p' . $d] = true;
        $e = strtolower(trim((string) ($l['email'] ?? ''))); if ($e !== '') $seenWho['e' . $e] = true;
    }
    $added = 0; $already = 0; $skipped = 0;
    foreach ($rows as $r) {
        if (!is_array($r)) { $skipped++; continue; }
        $ext = substr((string) preg_replace('/[^0-9A-Za-z_:.-]/', '', (string) ($r['ext'] ?? '')), 0, 64);
        $phone = $clean(preg_replace('/^p:/i', '', (string) ($r['phone'] ?? '')), 40);
        $email = $clean($r['email'] ?? '', 160); if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $email = '';
        $name = $clean($r['name'] ?? '', 120);
        if ($name === '' && $phone === '' && $email === '') { $skipped++; continue; }
        $d = $digits($phone); $who = strlen($d) === 10 ? 'p' . $d : ($email !== '' ? 'e' . strtolower($email) : '');
        if (($ext !== '' && isset($seenExt[$ext])) || ($who !== '' && isset($seenWho[$who]))) { $already++; continue; }
        $at = strtotime((string) ($r['at'] ?? '')); if (!$at || $at < 1704067200 || $at > time() + 86400) $at = time();
        $row = ['id' => 'm' . date('YmdHis') . bin2hex(random_bytes(3)), 'src' => 'meta', 'at' => $at,
                'need' => $clean($r['need'] ?? '', 60), 'name' => $name, 'phone' => $phone, 'email' => $email,
                'town' => $clean($r['town'] ?? '', 160), 'msg' => $clean($r['msg'] ?? '', 2000), 'by' => $me];
        if ($ext !== '') $row['ext'] = $ext;
        if (!appendLine(leadsDir() . '/leads.log', $row)) fail('Could not save that. Try again.', 500);
        if ($ext !== '') $seenExt[$ext] = true; if ($who !== '') $seenWho[$who] = true;
        $added++;
    }
    out(['ok' => true, 'added' => $added, 'already' => $already, 'skipped' => $skipped]);
}

if ($action === 'leadstatus') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? '');
    if (!preg_match('/^[wm]\d{14}[0-9a-f]{6}$/D', $id)) fail('No such lead.', 404);
    $known = false; foreach (readLines(leadsDir() . '/leads.log') as $l) if ($l['id'] === $id) { $known = true; break; }
    if (!$known) fail('No such lead.', 404);
    $status = (string) ($body['status'] ?? ''); $note = $clean($body['note'] ?? '', 500);
    if ($status !== '' && !in_array($status, LEAD_STATUS, true)) fail('Bad status.');
    if ($status === '' && $note === '') fail('Nothing to save.');
    $row = ['id' => $id, 'by' => $me, 'at' => time()]; if ($status !== '') $row['status'] = $status; if ($note !== '') $row['note'] = $note;
    if (!appendLine(leadsDir() . '/leadst.log', $row)) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

if (in_array($action, ['customers', 'customersave', 'customerfrom', 'visitsave', 'customersexport', 'backup', 'backups', 'backupget'], true)) {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $tz = new DateTimeZone('America/Denver');
    $today = (new DateTime('today', $tz))->format('Y-m-d');
    /* the whole list, with each customer's visits and what is due */
    if ($action === 'customers') {
        $cs = loadCustomers(); $vs = loadVisits();
        $byC = []; foreach ($vs as $v) $byC[(string) $v['cid']][] = $v;
        $soon = (new DateTime('today', $tz))->modify('+7 days')->format('Y-m-d');
        $list = [];
        foreach ($cs as $c) {
            $mine = $byC[$c['id']] ?? [];
            usort($mine, fn($a, $b) => [$b['date'] ?? '', $b['at'] ?? 0] <=> [$a['date'] ?? '', $a['at'] ?? 0]);
            $done = array_values(array_filter($mine, fn($v) => ($v['status'] ?? 'done') === 'done'));
            $c['visits'] = $mine;
            $c['spent'] = array_sum(array_map(fn($v) => (float) ($v['price'] ?? 0), $done));
            $c['last'] = $done[0]['date'] ?? null;
            $c['due'] = ($c['status'] ?? 'active') === 'active' && !empty($c['next']) && $c['next'] <= $soon;
            $c['overdue'] = $c['due'] && $c['next'] < $today;
            $list[] = $c;
        }
        usort($list, fn($a, $b) => strcmp(mb_strtolower((string) ($a['name'] ?? '')), mb_strtolower((string) ($b['name'] ?? ''))));
        /* where each customer from door rounds is, so the day's visits can be put in driving order */
        $regs = [];
        foreach ($list as &$c) {
            if (empty($c['door']) || !preg_match('/^([a-z0-9-]{1,40})\/([a-z0-9-]{1,80})$/D', (string) $c['door'], $dm)) continue;
            if (!array_key_exists($dm[1], $regs)) { $rd = loadRegion($dm[1]); $pos = []; if ($rd) foreach ($rd['areas'] as $a) foreach ($a['doors'] as $d) if (isset($d['lat'], $d['lon'])) $pos[$d['id']] = [$d['lat'], $d['lon']]; $regs[$dm[1]] = $pos; }
            if (isset($regs[$dm[1]][$dm[2]])) $c['ll'] = $regs[$dm[1]][$dm[2]];
        }
        unset($c);
        out(['ok' => true, 'today' => $today, 'customers' => $list]);
    }
    /* every log the app keeps, in one file the admin saves somewhere safe. Rebuilding is putting each
       file back where it came from: the app reads the logs, so the logs are the data. Sign-in codes and
       photos are left out (codes stay in sixfold-private; photos are listed, not copied). */
    /* the nightly copies (sixfold-tools/nightly-backup.php, run by cron) and when anyone last saved a copy
       to a device: a copy on this server doesn't survive losing the server, so the tools screen reminds an
       admin after a week. Every download, of either kind, is a 'backup' line in the accounts log. */
    if ($action === 'backups') {
        $copies = [];
        foreach (array_reverse(glob(dirname(DATA_DIR) . '/backups/sixfold-backup-*.json.gz') ?: []) as $p)
            $copies[] = ['name' => basename($p), 'date' => substr(basename($p), 15, 10), 'bytes' => (int) @filesize($p)];
        $last = 0; $lf = dirname(accountsFile()) . '/rounds-accounts.log';
        $fh = is_readable($lf) ? @fopen($lf, 'r') : false;
        if ($fh) { while (($line = fgets($fh)) !== false) { $r = json_decode($line, true); if (is_array($r) && ($r['what'] ?? '') === 'backup') $last = max($last, (int) ($r['at'] ?? 0)); } fclose($fh); }
        out(['ok' => true, 'copies' => $copies, 'lastDownload' => $last ?: null, 'now' => time()]);
    }
    if ($action === 'backupget') {
        $n = (string) ($_GET['name'] ?? '');
        if (!preg_match('/^sixfold-backup-\d{4}-\d{2}-\d{2}\.json\.gz$/D', $n)) fail('No such copy.', 404);
        $p = dirname(DATA_DIR) . '/backups/' . $n;
        $raw = is_file($p) ? @file_get_contents($p) : false;
        $json = $raw === false ? false : @gzdecode($raw);
        if ($json === false) fail('No such copy.', 404);
        accountLog(['by' => $me, 'what' => 'backup', 'copy' => $n]);
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . substr($n, 0, -3) . '"');   /* the same JSON as a fresh download */
        header('Cache-Control: no-store');
        echo $json;
        exit;
    }
    if ($action === 'backup') {
        $files = [];
        $add = function (string $abs, string $rel) use (&$files) { if (is_file($abs) && is_readable($abs)) $files[$rel] = (string) file_get_contents($abs); };
        foreach ((glob(DATA_DIR . '/*.log') ?: []) as $p) $add($p, 'sixfold-data/rounds/' . basename($p));
        foreach (['goals.json'] as $n) $add(DATA_DIR . '/' . $n, 'sixfold-data/rounds/' . $n);
        foreach ((glob(leadsDir() . '/*.log') ?: []) as $p) $add($p, 'sixfold-data/leads/' . basename($p));
        foreach ((glob(custDir() . '/*.log') ?: []) as $p) $add($p, 'sixfold-data/customers/' . basename($p));
        $photos = [];
        foreach ((glob(DATA_DIR . '/photos/*/*/*') ?: []) as $p) $photos[] = 'sixfold-data/rounds/photos/' . substr($p, strlen(DATA_DIR . '/photos/'));
        $doc = ['backup' => company()['name'] . ' field tools', 'made' => date('c'), 'by' => $me,
                'restore' => 'Each entry in "files" is a log the app reads. To rebuild, put each one back at its path beside public_html (sixfold-data/...). Lines are JSON, one change per line, oldest first. Sign-in codes and the app-made sign-ins are not included (re-create those people in Accounts); photos are listed, not copied.',
                'files' => $files, 'photos' => $photos];
        accountLog(['by' => $me, 'what' => 'backup', 'n' => count($files)]);
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="sixfold-backup-' . date('Y-m-d-His') . '.json"');
        header('Cache-Control: no-store');
        echo json_encode($doc, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }
    if ($action === 'customersexport') {
        $cs = loadCustomers(); $vs = loadVisits();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="sixfold-customers-' . date('Y-m-d') . '.csv"');
        $fh = fopen('php://output', 'w');
        fputcsv($fh, ['Name', 'Phone', 'Email', 'Address', 'Town', 'Service', 'Plan', 'Price', 'Customer since', 'Next due', 'Status', 'Visits done', 'Spent', 'Agreement', 'Notes', 'Door', 'Customer ID'], ',', '"', '');
        foreach ($cs as $c) {
            $done = array_filter($vs, fn($v) => (string) $v['cid'] === $c['id'] && ($v['status'] ?? 'done') === 'done');
            fputcsv($fh, array_map('csvSafe', [$c['name'] ?? '', $c['phone'] ?? '', $c['email'] ?? '', $c['address'] ?? '', $c['town'] ?? '', $c['service'] ?? '', $c['plan'] ?? '',
                $c['price'] ?? '', $c['start'] ?? '', $c['next'] ?? '', $c['status'] ?? 'active', count($done), array_sum(array_map(fn($v) => (float) ($v['price'] ?? 0), $done)),
                $c['agreement'] ?? '', $c['notes'] ?? '', $c['door'] ?? '', $c['id']]), ',', '"', '');
        }
        fclose($fh); exit;
    }
    if (!$isPost) fail('POST required', 405);
    $cs = loadCustomers();
    /* check and tidy the fields that came in; only the ones sent are changed */
    $fields = function (array $in, bool $isNew) use ($clean) {
        $f = [];
        if ($isNew || array_key_exists('name', $in)) { $f['name'] = $clean($in['name'] ?? '', 120); if (mb_strlen($f['name']) < 2) fail('Add the customer\'s name.'); }
        if (array_key_exists('phone', $in)) { $f['phone'] = $clean($in['phone'], 40); $dg = preg_replace('/\D/', '', $f['phone']); if ($f['phone'] !== '' && (strlen($dg) < 10 || strlen($dg) > 11)) fail('That phone number does not look right.'); }
        if (array_key_exists('email', $in)) { $f['email'] = $clean($in['email'], 160); if ($f['email'] !== '' && !filter_var($f['email'], FILTER_VALIDATE_EMAIL)) fail('That email does not look right.'); }
        foreach (['address' => 160, 'town' => 60, 'notes' => 2000] as $k => $max) if (array_key_exists($k, $in)) $f[$k] = $clean($in[$k], $max);
        if (array_key_exists('service', $in)) { $f['service'] = (string) $in['service']; if (!in_array($f['service'], custServices(), true)) fail('Pick the service.'); }
        if (array_key_exists('plan', $in)) { $f['plan'] = (string) $in['plan']; if (!in_array($f['plan'], CUST_PLANS, true)) fail('Pick the plan.'); }
        if (array_key_exists('status', $in)) { $f['status'] = (string) $in['status']; if (!in_array($f['status'], CUST_STATUS, true)) fail('Pick active, paused or ended.'); }
        if (array_key_exists('price', $in)) { $p = $in['price']; if ($p === '' || $p === null) $f['price'] = null; elseif (!is_numeric($p) || $p < 0 || $p > 1000000) fail('The price should be a number of dollars.'); else $f['price'] = round((float) $p, 2); }
        foreach (['start', 'next'] as $k) if (array_key_exists($k, $in)) { $d = (string) $in[$k]; if ($d !== '' && !dateOk($d)) fail('That is not a real date.'); $f[$k] = $d; }
        if (array_key_exists('agreement', $in)) { $u = trim((string) $in['agreement']); if ($u !== '' && !preg_match('#^https://[^\s<>"]{4,500}$#D', $u)) fail('The agreement link should start with https://'); $f['agreement'] = $u; }
        if ($isNew) $f += ['status' => 'active', 'plan' => 'oneoff', 'service' => custServices()[0]];
        return $f;
    };
    $write = function (string $id, array $f) use ($me) {
        if (!appendLine(custDir() . '/customers.log', ['id' => $id, 'by' => $me, 'at' => time(), 'f' => $f])) fail('Could not save that. Try again.', 500);
    };
    if ($action === 'customersave') {
        $id = (string) ($body['id'] ?? '');
        if ($id !== '' && !isset($cs[$id])) fail('No such customer.', 404);
        $isNew = $id === '';
        $f = $fields($body, $isNew);
        if (!$f) fail('Nothing to save.');
        if ($isNew) $id = 'c' . date('YmdHis') . bin2hex(random_bytes(3));
        $write($id, $f);
        out(['ok' => true, 'id' => $id]);
    }
    /* a won door booking or a won lead becomes a customer, carrying what we already know */
    if ($action === 'customerfrom') {
        $f = ['status' => 'active', 'plan' => 'oneoff', 'service' => custServices()[0], 'start' => $today];
        if (!empty($body['lead'])) {
            $lid = (string) $body['lead']; $L = null;
            foreach (readLines(leadsDir() . '/leads.log') as $l) if (($l['id'] ?? '') === $lid) $L = $l;
            if (!$L) fail('No such lead.', 404);
            foreach ($cs as $c) if (($c['lead'] ?? '') === $lid && ($c['status'] ?? 'active') !== 'ended') out(['ok' => true, 'id' => $c['id'], 'existing' => true]);
            $f += ['name' => $clean($L['name'] ?? '', 120) ?: 'Customer', 'phone' => $clean($L['phone'] ?? '', 40), 'email' => $clean($L['email'] ?? '', 160), 'town' => $clean($L['town'] ?? '', 60), 'source' => (string) ($L['src'] ?? 'other'), 'lead' => $lid];
            /* the service whose name the enquiry mentions ("Fire mitigation" -> fire), the most specific if several
               ("Lawn aeration" -> aeration, as before); else the first one */
            $bestLen = 0;
            foreach (company()['services'] as $sv) {
                $word = substr(strtolower(strtok((string) $sv[1], ' &')), 0, 5);
                if ($sv[0] !== 'other' && strlen($word) > 3 && strlen($word) > $bestLen && stripos((string) ($L['need'] ?? ''), $word) !== false) { $f['service'] = (string) $sv[0]; $bestLen = strlen($word); }
            }
        } else {
            $key = (string) ($body['region'] ?? ''); $did = (string) ($body['id'] ?? '');
            $data = loadRegion($key); if (!$data) fail('No such region.', 404);
            if (!preg_match('/^[a-z0-9-]{1,80}$/D', $did)) fail('Bad door id.');
            $key = doorHome($key, $did); $data = loadRegion($key);
            $door = null; foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) if ($d['id'] === $did) $door = $d;
            if (!$door) fail('No such door.', 404);
            $dk = $key . '/' . $did;
            foreach ($cs as $c) if (($c['door'] ?? '') === $dk && ($c['status'] ?? 'active') !== 'ended') out(['ok' => true, 'id' => $c['id'], 'existing' => true]);
            $p = loadPhones($key)[$did] ?? null; $p = ($p && ($p['source'] ?? '') === 'door' && empty(ownerFlag($door, $p)['prev'])) ? $p : null;
            $em = loadEmails($key)[$did] ?? null; $em = ($em && empty(ownerFlag($door, $em)['prev'])) ? $em : null;
            $res = loadResults($key)[$did] ?? null;
            $f += ['name' => $clean((string) ($door['owner'] ?? ''), 120) ?: 'Customer', 'phone' => $p['phone'] ?? '', 'email' => $em['email'] ?? '', 'address' => (string) $door['address'],
                   'town' => regionLabel($key), 'door' => $dk, 'source' => 'door'];
            if ($res && ($res['result'] ?? '') === 'won' && $res['value']) $f['price'] = (float) $res['value'];
        }
        $id = 'c' . date('YmdHis') . bin2hex(random_bytes(3));
        $write($id, $f);
        out(['ok' => true, 'id' => $id]);
    }
    /* a visit: done or booked. A done visit on a monthly or yearly plan moves "next due" on. */
    if ($action === 'visitsave') {
        $cid = (string) ($body['cid'] ?? ''); if (!isset($cs[$cid])) fail('No such customer.', 404);
        $vid = (string) ($body['vid'] ?? '');
        if (!empty($body['del'])) {
            if (!preg_match('/^v\d{14}[0-9a-f]{6}$/D', $vid)) fail('No such visit.', 404);
            if (!appendLine(custDir() . '/visits.log', ['vid' => $vid, 'cid' => $cid, 'del' => true, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
            out(['ok' => true]);
        }
        $date = (string) ($body['date'] ?? ''); if (!dateOk($date)) fail('Pick the date of the visit.');
        $service = (string) ($body['service'] ?? ($cs[$cid]['service'] ?? custServices()[0])); if (!in_array($service, custServices(), true)) fail('Pick the service.');
        $status = (string) ($body['status'] ?? 'done'); if (!in_array($status, ['done', 'booked'], true)) fail('Done or booked?');
        $price = $body['price'] ?? null; if ($price !== null && $price !== '' && (!is_numeric($price) || $price < 0 || $price > 1000000)) fail('The price should be a number of dollars.');
        if ($vid === '') $vid = 'v' . date('YmdHis') . bin2hex(random_bytes(3));
        elseif (!preg_match('/^v\d{14}[0-9a-f]{6}$/D', $vid)) fail('No such visit.', 404);
        $row = ['vid' => $vid, 'cid' => $cid, 'date' => $date, 'service' => $service, 'status' => $status, 'price' => ($price === null || $price === '') ? null : round((float) $price, 2),
                'note' => $clean($body['note'] ?? '', 600), 'by' => $me, 'at' => time()];
        if (!appendLine(custDir() . '/visits.log', $row)) fail('Could not save that. Try again.', 500);
        $c = $cs[$cid]; $next = null;
        /* next due becomes a month (or a year) after this visit, unless that is earlier than it already is:
           a mow a day early still moves it on, and last month's visit typed in late never pulls it back */
        if ($status === 'done' && in_array($c['plan'] ?? '', ['monthly', 'yearly'], true)) {
            $cand = nextDue($date, (string) $c['plan']);
            if (empty($c['next']) || $cand > $c['next']) { $next = $cand; $write($cid, ['next' => $next]); }
        }
        out(['ok' => true, 'vid' => $vid, 'next' => $next]);
    }
}

if ($action === 'lawnfix') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    $lv  = $body['lv'] ?? null;
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    if ($lv !== null && !in_array($lv, ['N', 'S', 'M', 'L'], true)) fail('Bad lawn size.');
    if (!appendLawnFix($key, ['id' => $id, 'lv' => $lv, 'by' => $me, 'at' => tapTime($body)])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

if ($action === 'work') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    $tags = $body['work'] ?? [];
    if (!is_array($tags) || count($tags) > count(workTags())) fail('Bad list of work.');
    foreach ($tags as $t) if (!in_array($t, workTags(), true)) fail('Unknown kind of work.');
    $tags = array_values(array_unique($tags));
    if (!appendWork($key, ['id' => $id, 'work' => $tags ?: null, 'by' => $me, 'at' => tapTime($body)])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

/* ---- the accounts screen (admin) ---------------------------------------------------------- */
function acctName(string $n): string { return trim((string) preg_replace('/\s+/u', ' ', $n)); }
function acctNameOk(string $n): bool { return (bool) preg_match("/^\\p{L}[\\p{L} .'\\-]{1,39}$/uD", $n); }
/** every account, active or turned off, without its code */
function acctRows(array $basePeople, array $acct, string $key): array {
    $rows = [];
    foreach ($basePeople as $c => $who) {
        $id = codeId((string) $c, $key);
        $o = $acct['over'][$id] ?? null;
        $rows[$id] = ['id' => $id, 'name' => (string) ($o[0] ?? $who[0] ?? ''), 'role' => (string) ($o[1] ?? $who[1] ?? 'crew'),
                      'source' => 'server', 'off' => isset($acct['off'][$id]), 'code' => (string) $c];
    }
    foreach ($acct['people'] as $c => $p) {
        if (isset($basePeople[$c]) || !is_array($p)) continue;
        $id = codeId((string) $c, $key);
        $rows[$id] = ['id' => $id, 'name' => (string) ($p[0] ?? ''), 'role' => (string) ($p[1] ?? 'crew'), 'source' => 'app',
                      'off' => false, 'by' => (string) ($p[2] ?? ''), 'at' => (int) ($p[3] ?? 0), 'code' => (string) $c];
    }
    return $rows;
}
function acctNewCode(array $basePeople, array $acct): string {
    for ($i = 0; $i < 200; $i++) {
        $c = (string) random_int(100000, 999999);
        if (!isset($basePeople[$c]) && !isset($acct['people'][$c])) return $c;
    }
    fail('Could not make a new code. Try again.', 500);
}
function acctTaken(array $rows, string $name, string $except = ''): bool {
    foreach ($rows as $r) if (!$r['off'] && $r['id'] !== $except && mb_strtolower($r['name']) === mb_strtolower($name)) return true;
    return false;
}
function acctAdmins(array $rows): int { $n = 0; foreach ($rows as $r) if (!$r['off'] && $r['role'] === 'admin') $n++; return $n; }
if (in_array($action, ['accounts', 'accountadd', 'accountedit', 'accountcode', 'accountremove', 'accountrestore', 'accountsignout', 'accountpins'], true)) {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $rows = acctRows($basePeople, $acct, $sessionKey);
    $myId = (string) ($session['c'] ?? '');
    if ($action === 'accounts') {
        $sess = sessLoad(); $live = [];
        foreach ((array) ($sess['s'] ?? []) as $l) {
            $lid = (string) ($l[0] ?? ''); $kick = (int) ($acct['kick'][$lid] ?? 0);
            if ((int) ($l[1] ?? 0) < time() || ($kick && (int) $l[1] - $sessionDays * 86400 <= $kick)) continue;
            $live[$lid][] = ['device' => (string) ($l[3] ?? ''), 'seen' => (int) ($l[2] ?? 0), 'since' => (int) $l[1] - $sessionDays * 86400];
        }
        $outAt = function ($id) use ($sess, $acct) { return max((int) ($sess['o'][$id] ?? 0), (int) ($acct['kick'][$id] ?? 0)); };
        $list = array_map(function ($r) use ($myId, $live, $outAt) {
            $l = $live[$r['id']] ?? []; usort($l, fn($x, $y) => $y['seen'] <=> $x['seen']);
            return array_diff_key($r, ['code' => 1]) + ['you' => $r['id'] === $myId, 'live' => $l, 'out' => $outAt($r['id'])];
        }, array_values($rows));
        usort($list, fn($x, $y) => [$x['off'], mb_strtolower($x['name'])] <=> [$y['off'], mb_strtolower($y['name'])]);
        out(['ok' => true, 'accounts' => $list, 'tracking' => (int) ($sess['since'] ?? 0)]);
    }
    if (!$isPost) fail('POST required', 405);
    /* every change works on a fresh copy under a lock (Fable 2026-10-04): the file is rewritten whole, so
       two admins saving at once used to keep only one change. The lock goes when the request ends. */
    if ($action !== 'accountpins') {
        $acctLock = @fopen(accountsFile() . '.lock', 'c');
        if (!$acctLock || !flock($acctLock, LOCK_EX)) fail('Could not save that. Try again.', 500);
        $acct = loadAccounts(); $rows = acctRows($basePeople, $acct, $sessionKey);
    }
    /* every PIN, for an admin who types their own code again (Matthew 2026-10-04). Wrong codes count
       against the same limit as the sign-in screen; every reveal is logged. */
    if ($action === 'accountpins') {
        $addrFile = rateFile(clientKey()); $siteFile = rateFile('*site*');
        if (!throttleTake($addrFile, MAX_TRIES, TRY_WINDOW)) fail('Too many wrong codes from here. Wait fifteen minutes.', 429);
        if (!throttleTake($siteFile, SITE_TRIES, SITE_WINDOW)) { throttleGiveBack($addrFile); fail('Too many wrong codes. Try again in an hour.', 429); }
        $mine = preg_replace('/\D/', '', (string) ($body['code'] ?? ''));
        if ($mine === '' || !hash_equals($myId, codeId($mine, $sessionKey)) || !isset($people[$mine])) fail('That is not your code.', 401);
        throttleGiveBack($addrFile); throttleGiveBack($siteFile);
        $pins = []; foreach ($rows as $r) if (!$r['off']) $pins[$r['id']] = $r['code'];
        accountLog(['by' => $me, 'what' => 'showed pins', 'n' => count($pins)]);
        out(['ok' => true, 'pins' => $pins]);
    }
    if ($action === 'accountadd') {
        $name = acctName((string) ($body['name'] ?? '')); $r = (string) ($body['role'] ?? 'crew');
        if (!acctNameOk($name)) fail('Use a name of 2 to 40 letters (spaces, hyphens and apostrophes are fine).');
        if (!in_array($r, ['crew', 'admin'], true)) fail('Pick crew or admin.');
        if (acctTaken($rows, $name)) fail('Someone already signs in as ' . $name . '. Use a different name (a last initial works).');
        $code = acctNewCode($basePeople, $acct);
        $acct['people'][$code] = [$name, $r, $me, time()];
        if (!saveAccounts($acct)) fail('Could not save that. Try again.', 500);
        accountLog(['by' => $me, 'what' => 'add', 'name' => $name, 'role' => $r, 'id' => codeId($code, $sessionKey)]);
        out(['ok' => true, 'id' => codeId($code, $sessionKey), 'name' => $name, 'role' => $r, 'code' => $code]);
    }
    $id = (string) ($body['id'] ?? '');
    if (!isset($rows[$id])) fail('No such account.', 404);
    $t = $rows[$id];
    if ($action === 'accountedit') {
        $name = array_key_exists('name', $body) ? acctName((string) $body['name']) : $t['name'];
        $r = array_key_exists('role', $body) ? (string) $body['role'] : $t['role'];
        if ($t['off']) fail('Turn the account back on first.');
        if (array_key_exists('name', $body) && !acctNameOk($name)) fail('Use a name of 2 to 40 letters (spaces, hyphens and apostrophes are fine).');
        if (!in_array($r, ['crew', 'admin'], true)) fail('Pick crew or admin.');
        if (acctTaken($rows, $name, $id)) fail('Someone else already signs in as ' . $name . '.');
        if ($id === $myId && $r !== 'admin') fail('You cannot take admin off yourself. Ask another admin.');
        if ($t['role'] === 'admin' && $r !== 'admin' && acctAdmins($rows) <= 1) fail('That is the last admin. Make someone else an admin first.');
        if ($t['source'] === 'app') { $p = $acct['people'][$t['code']]; $p[0] = $name; $p[1] = $r; $acct['people'][$t['code']] = $p; }
        else $acct['over'][$id] = [$name, $r];
        if (!saveAccounts($acct)) fail('Could not save that. Try again.', 500);
        accountLog(['by' => $me, 'what' => 'edit', 'name' => $name, 'role' => $r, 'was' => $t['name'] . '/' . $t['role'], 'id' => $id]);
        out(['ok' => true]);
    }
    if ($action === 'accountcode') {
        if ($t['off']) fail('Turn the account back on first.');
        if ($id === $myId) fail('Your own code changes from another admin\'s phone (a new code signs this phone out).');
        $code = acctNewCode($basePeople, $acct);
        if ($t['source'] === 'app') { $p = $acct['people'][$t['code']]; unset($acct['people'][$t['code']]); $acct['people'][$code] = $p; }
        else { $acct['off'][$id] = ['by' => $me, 'at' => time(), 'why' => 'new code']; $acct['people'][$code] = [$t['name'], $t['role'], $me, time()]; }
        if (!saveAccounts($acct)) fail('Could not save that. Try again.', 500);
        sessEnd($id);
        accountLog(['by' => $me, 'what' => 'new code', 'name' => $t['name'], 'id' => $id, 'new' => codeId($code, $sessionKey)]);
        out(['ok' => true, 'id' => codeId($code, $sessionKey), 'name' => $t['name'], 'role' => $t['role'], 'code' => $code]);
    }
    if ($action === 'accountsignout') {
        if ($t['off']) fail('That account is off already.');
        if ($id === $myId) fail('Use Sign out on the tools screen to sign yourself out.');
        $acct['kick'][$id] = time();
        if (!saveAccounts($acct)) fail('Could not save that. Try again.', 500);
        sessEnd($id);
        accountLog(['by' => $me, 'what' => 'signed out', 'name' => $t['name'], 'id' => $id]);
        out(['ok' => true]);
    }
    if ($action === 'accountremove') {
        if ($t['off']) fail('That account is already off.');
        if ($id === $myId) fail('You cannot remove yourself. Ask another admin.');
        if ($t['role'] === 'admin' && acctAdmins($rows) <= 1) fail('That is the last admin.');
        if ($t['source'] === 'app') unset($acct['people'][$t['code']]);
        else $acct['off'][$id] = ['by' => $me, 'at' => time()];
        if (!saveAccounts($acct)) fail('Could not save that. Try again.', 500);
        sessEnd($id);
        accountLog(['by' => $me, 'what' => 'remove', 'name' => $t['name'], 'id' => $id]);
        out(['ok' => true]);
    }
    if ($action === 'accountrestore') {
        if (!$t['off']) fail('That account is already on.');
        if (acctTaken($rows, $t['name'], $id)) fail('Someone else signs in as ' . $t['name'] . ' now. Rename one of them first.');
        unset($acct['off'][$id]);
        if (!saveAccounts($acct)) fail('Could not save that. Try again.', 500);
        accountLog(['by' => $me, 'what' => 'restore', 'name' => $t['name'], 'id' => $id]);
        out(['ok' => true]);
    }
}

/* the board: per person, today / 7 days / 30 days. Talked to = doors minus no-answers and
   no-soliciting. Won = jobs won on doors that person booked, credited when the job was won. */
if ($action === 'board') {
    if (!boardOpen($role)) fail('Not allowed.', 403);
    $tz = new DateTimeZone('America/Denver');
    $today = (new DateTime('today', $tz));
    $from = ['today' => $today->format('Y-m-d'), 'week' => (clone $today)->modify('-6 days')->format('Y-m-d'), 'month' => (clone $today)->modify('-29 days')->format('Y-m-d')];
    $zero = ['doors' => 0, 'talked' => 0, 'booked' => 0, 'won' => 0];
    $rows = [];
    foreach (teamDays(30, '') as $p) {
        if (boardHidden($p['name'])) continue;
        $r = ['name' => $p['name'], 'today' => $zero, 'week' => $zero, 'month' => $zero];
        foreach ($p['days'] as $d) foreach ($from as $per => $since) {
            if ($d['date'] < $since) continue;
            $r[$per]['doors'] += $d['doors'];
            $r[$per]['talked'] += $d['doors'] - $d['miss'] - $d['nosolicit'];
            $r[$per]['booked'] += $d['booked'];
        }
        $rows[$p['name']] = $r;
    }
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $terr = [];
    foreach (($idx['regions'] ?? []) as $rg) {
        $data = loadRegion($rg['key']); if (!$data) continue;
        $marks = loadMarks($rg['key']); $res = loadResults($rg['key']); $assign = loadAssign($rg['key']);
        foreach ($data['areas'] as $a) {
            $total = 0; $knocked = 0;
            foreach ($a['doors'] as $d) {
                $m = freshMark($d, $marks[$d['id']] ?? null);
                $total++; if ($m) $knocked++;
                $x = $res[$d['id']] ?? null;
                if (!$m || $m['outcome'] !== 'booked' || !$x || ($x['result'] ?? '') !== 'won' || (int) $x['at'] < (int) $m['at']) continue;
                $who = (string) ($m['by'] ?? ''); if ($who === '' || boardHidden($who)) continue;
                $day = (new DateTime('@' . (int) $x['at']))->setTimezone($tz)->format('Y-m-d');
                if (!isset($rows[$who])) $rows[$who] = ['name' => $who, 'today' => $zero, 'week' => $zero, 'month' => $zero];
                foreach ($from as $per => $since) if ($day >= $since) $rows[$who][$per]['won']++;
            }
            if (isset($assign[$a['name']])) $terr[] = ['region' => $rg['key'], 'town' => $rg['label'], 'area' => $a['name'], 'who' => $assign[$a['name']], 'total' => $total, 'knocked' => $knocked];
        }
    }
    $names = [];
    foreach ($people as $code => $pp) { $n = (string) ($pp[0] ?? ''); if ($n !== '' && !boardHidden($n)) $names[$n] = true; }   /* names only, never codes */
    ksort($names);
    out(['ok' => true, 'today' => $from['today'], 'open' => BOARD_OPEN, 'goals' => loadGoals(), 'people' => array_values($rows),
         'territories' => $terr, 'names' => $role === 'admin' ? array_keys($names) : []]);
}

if ($action === 'goals') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $g = ['by' => $me, 'at' => time()];
    foreach (['doors', 'talked', 'booked'] as $k) {
        $v = $body[$k] ?? null;
        if ($v === null || $v === '') { $g[$k] = null; continue; }
        if (!is_numeric($v) || (int) $v != $v || (int) $v < 0 || (int) $v > 300) fail('Goals are whole numbers from 0 to 300.');
        $g[$k] = (int) $v;
    }
    if (!@file_put_contents(DATA_DIR . '/goals.json', json_encode($g, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX)) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'goals' => $g]);
}

/* ---- territories (2026-10-04) ---------------------------------------------------------------
 * Matthew: territories get their own screen; admins assign neighbourhoods to people. Later a team
 * manager role will assign within their own team: the assignment rows already say who assigned
 * ('by'), so that role only needs a team list and a check here. */
if ($action === 'territories') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $towns = [];
    foreach (($idx['regions'] ?? []) as $rg) {
        $data = loadRegion($rg['key']); if (!$data) continue;
        $marks = loadMarks($rg['key']); $assign = loadAssign($rg['key']);
        $areas = [];
        foreach ($data['areas'] as $a) {
            $k = 0; foreach ($a['doors'] as $d) if (freshMark($d, $marks[$d['id']] ?? null)) $k++;
            $areas[] = ['name' => $a['name'], 'total' => count($a['doors']), 'knocked' => $k, 'who' => $assign[$a['name']] ?? null];
        }
        $towns[] = ['key' => $rg['key'], 'label' => $rg['label'], 'areas' => $areas];
    }
    $names = [];
    foreach ($people as $pp) { $n = (string) ($pp[0] ?? ''); if ($n !== '' && !boardHidden($n)) $names[$n] = true; }
    ksort($names);
    /* everyone who can sign in now, hidden ones included: an assignment to anyone else belongs to someone removed */
    $active = []; foreach ($people as $pp) { $n = (string) ($pp[0] ?? ''); if ($n !== '') $active[$n] = true; }
    out(['ok' => true, 'towns' => $towns, 'names' => array_keys($names), 'active' => array_keys($active)]);
}
/* every neighbourhood one person holds, in every town, back to unassigned in one go (2026-10-04): when someone leaves,
   or their area changes. Works for people already removed from Accounts too. */
if ($action === 'unassignall') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $who = trim((string) ($body['who'] ?? ''));
    if ($who === '') fail('Whose neighbourhoods?');
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $n = 0;
    foreach (($idx['regions'] ?? []) as $rg) foreach (loadAssign($rg['key']) as $area => $w) {
        if ($w !== $who) continue;
        if (!appendAssign($rg['key'], ['area' => (string) $area, 'who' => '', 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
        $n++;
    }
    out(['ok' => true, 'n' => $n]);
}
if ($action === 'assignmany') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? ''); $who = trim((string) ($body['who'] ?? ''));
    $areas = is_array($body['areas'] ?? null) ? array_values(array_unique(array_map('strval', $body['areas']))) : [];
    $data = loadRegion($key);
    if (!$data) fail('No such region.', 404);
    if (!$areas || count($areas) > 200) fail('Pick the neighbourhoods to assign.');
    $have = array_column($data['areas'], 'name');
    foreach ($areas as $a) if (!in_array($a, $have, true)) fail('No such neighbourhood: ' . $a, 404);
    if ($who !== '') {
        $known = false; foreach ($people as $pp) if ((string) ($pp[0] ?? '') === $who) $known = true;
        if (!$known || boardHidden($who)) fail('Pick someone with a sign-in code.');
    }
    foreach ($areas as $a) if (!appendAssign($key, ['area' => $a, 'who' => $who, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'n' => count($areas)]);
}

if ($action === 'assign') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? ''); $area = (string) ($body['area'] ?? ''); $who = trim((string) ($body['who'] ?? ''));
    $data = loadRegion($key);
    if (!$data) fail('No such region.', 404);
    if (!in_array($area, array_column($data['areas'], 'name'), true)) fail('No such neighbourhood.', 404);
    if ($who !== '') {
        $known = false; foreach ($people as $pp) if ((string) ($pp[0] ?? '') === $who) $known = true;
        if (!$known || boardHidden($who)) fail('Pick someone with a sign-in code.');
    }
    if (!appendAssign($key, ['area' => $area, 'who' => $who, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

const SEARCH_TYPES = ['DR', 'RD', 'LN', 'CT', 'ST', 'AVE', 'AV', 'WAY', 'CIR', 'PL', 'TRL', 'BLVD', 'PKWY', 'HWY', 'LOOP', 'TER', 'PT', 'RUN', 'PASS', 'VW', 'HTS', 'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];
if ($action === 'search') {
    $q = strtoupper(trim((string) ($_GET['q'] ?? '')));
    $q = (string) preg_replace('/[^A-Z0-9 ]+/', ' ', $q);
    $words = array_values(array_filter(explode(' ', $q), fn($w) => $w !== ''));
    if (strlen(implode('', $words)) < 3) out(['ok' => true, 'q' => $q, 'results' => []]);
    $words = array_slice(array_map(fn($w) => SEARCH_SYN[$w] ?? $w, $words), 0, 6);
    /* a street name has to be in it (Fable 2026-10-04): "DRIVE" or "100" alone matched a whole class of
       streets or house numbers, and a loop of them could pull every address in every town. A number with a
       street name ("1840 ponderosa") or a street name alone ("ponderosa") still works. Counted per person:
       60 searches in 10 minutes is far past what a driver needs, and far short of the whole list. */
    $named = array_filter($words, fn($w) => strlen($w) >= 3 && !ctype_digit($w) && !in_array($w, SEARCH_TYPES, true));
    if (!$named) out(['ok' => true, 'q' => $q, 'results' => [], 'need' => 'street']);
    if (!throttleTake(rateFile('search|' . (string) ($session['c'] ?? $me)), 150, 600)) fail('That is a lot of searches. Wait a few minutes.', 429);
    $hits = [];
    foreach (searchIndex() as $line) {
        $p = explode("\t", $line); if (count($p) < 9) continue;
        $aw = explode(' ', (string) preg_replace('/[^A-Z0-9 ]+/', ' ', $p[4]));
        $ok = true; $exactNo = false;
        foreach ($words as $w) {
            $m = false; foreach ($aw as $i => $x) { if ($x !== '' && strncmp($x, $w, strlen($w)) === 0) { $m = true; if ($i === 0 && $x === $w && ctype_digit($w)) $exactNo = true; break; } }
            if (!$m) { $ok = false; break; }
        }
        if (!$ok) continue;
        $hits[] = ['rank' => ($exactNo ? 0 : 1), 'region' => $p[0], 'town' => $p[1], 'area' => $p[2], 'id' => $p[3], 'address' => $p[4],
                   'fire' => (int) $p[5] ?: null, 'lawn' => $p[6] !== '' ? ['lv' => $p[6], 'yr' => (int) $p[7] ?: null] : null, 'tl' => $p[8] !== '' ? $p[8] : null];
        if (count($hits) > 400) break;
    }
    usort($hits, fn($x, $y) => [$x['rank'], $x['address']] <=> [$y['rank'], $y['address']]);
    $more = count($hits) > 25;
    $hits = array_map(function ($h) { unset($h['rank']); return $h; }, array_slice($hits, 0, 25));
    out(['ok' => true, 'q' => $q, 'results' => $hits, 'more' => $more]);
}

if ($action === 'walk') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    $date = $body['date'] ?? null;                                  // null = no walk booked after all
    $time = (string) ($body['time'] ?? '');                         // '' = time still to agree
    if ($date !== null) {
        $date = (string) $date;
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $date, $mm) || !checkdate((int) $mm[2], (int) $mm[3], (int) $mm[1])) fail('That is not a real date.');
        $tz = new DateTimeZone('America/Denver');
        $day = new DateTime($date . ' 00:00', $tz); $today = new DateTime('today', $tz);
        $diff = (int) round(($day->getTimestamp() - $today->getTimestamp()) / 86400);
        if ($diff < -30) fail('That date is more than a month ago.');
        if ($diff > 180) fail('Pick a date within the next six months.');
        if ($time !== '' && !preg_match('/^(0[6-9]|1\d|20):(00|15|30|45)$/D', $time)) fail('Pick a time between 6 am and 8:45 pm.');
    } else $time = '';
    if (!appendWalk($key, ['id' => $id, 'date' => $date, 'time' => $time, 'by' => $me, 'at' => tapTime($body)])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

/* walks booked in a date range, for the date picker ("already booked that day") and the
   admin's list. Addresses only: the crew see these doors anyway. No phones, no owners. */
if ($action === 'walks') {
    $tz = new DateTimeZone('America/Denver');
    $from = (string) ($_GET['from'] ?? ''); $to = (string) ($_GET['to'] ?? '');
    $ok = fn($d) => (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/D', $d);
    if (!$ok($from)) $from = (new DateTime('today', $tz))->format('Y-m-d');
    if (!$ok($to) || $to < $from) $to = (new DateTime($from . ' 00:00', $tz))->modify('+14 days')->format('Y-m-d');
    if ((new DateTime($to . ' 00:00', $tz))->getTimestamp() - (new DateTime($from . ' 00:00', $tz))->getTimestamp() > 62 * 86400) fail('Ask for two months at most.');
    out(['ok' => true, 'from' => $from, 'to' => $to, 'walks' => walksBetween($from, $to)]);
}
function walksBetween(string $from, string $to): array {
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $list = [];
    foreach (($idx['regions'] ?? []) as $r) {
        $walks = loadWalks($r['key']);
        if (!$walks) continue;
        $data = loadRegion($r['key']); if (!$data) continue;
        $marks = loadMarks($r['key']);
        foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
            if (!isset($walks[$d['id']])) continue;
            $w = walkFor(freshMark($d, $marks[$d['id']] ?? null), $walks[$d['id']]);
            if (!$w || $w['date'] < $from || $w['date'] > $to) continue;
            $list[] = ['date' => $w['date'], 'time' => $w['time'], 'by' => $w['by'], 'region' => $r['key'], 'town' => $r['label'],
                       'area' => $a['name'], 'id' => $d['id'], 'address' => $d['address'], 'lat' => $d['lat'] ?? null, 'lon' => $d['lon'] ?? null];
        }
    }
    usort($list, fn($x, $y) => [$x['date'], $x['time'] === '' ? '99' : $x['time']] <=> [$y['date'], $y['time'] === '' ? '99' : $y['time']]);
    return $list;
}

/* ---- the morning digest (2026-10-04) --------------------------------------------------
 * What an admin needs at 6 am without opening the app: leads still to call, today's and tomorrow's
 * walks, customers due this week, and yesterday at the doors. Sent by sixfold-tools/morning-email.php;
 * an admin can also ask for it from the app. */
if ($action === 'digest') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $tz = new DateTimeZone('America/Denver');
    $today = (new DateTime('today', $tz))->format('Y-m-d');
    $yday = (new DateTime('today', $tz))->modify('-1 day')->format('Y-m-d');
    $tom = (new DateTime('today', $tz))->modify('+1 day')->format('Y-m-d');
    $week = (new DateTime('today', $tz))->modify('+7 days')->format('Y-m-d');
    /* leads still New, newest first (the same merge as the leads action) */
    $leads = []; foreach (readLines(leadsDir() . '/leads.log') as $l) $leads[$l['id']] = $l + ['status' => 'new'];
    foreach (readLines(leadsDir() . '/leadst.log') as $u) if (isset($leads[$u['id']]) && !empty($u['status'])) $leads[$u['id']]['status'] = $u['status'];
    $new = array_values(array_filter($leads, fn($l) => $l['status'] === 'new'));
    usort($new, fn($a, $b) => ($b['at'] ?? 0) <=> ($a['at'] ?? 0));
    $newOut = array_map(fn($l) => ['name' => (string) ($l['name'] ?? ''), 'src' => (string) ($l['src'] ?? ''), 'need' => (string) ($l['need'] ?? ''),
        'phone' => (string) ($l['phone'] ?? ''), 'town' => (string) ($l['town'] ?? ''), 'at' => (int) ($l['at'] ?? 0)], array_slice($new, 0, 25));
    $walks = walksBetween($today, $tom);
    /* customers due within a week, overdue first */
    $due = [];
    foreach (loadCustomers() as $c) {
        if (($c['status'] ?? 'active') !== 'active' || empty($c['next']) || $c['next'] > $week) continue;
        $due[] = ['name' => (string) ($c['name'] ?? ''), 'next' => (string) $c['next'], 'overdue' => $c['next'] < $today, 'plan' => (string) ($c['plan'] ?? ''),
                  'service' => (string) ($c['service'] ?? ''), 'price' => $c['price'] ?? null, 'town' => (string) ($c['town'] ?? '')];
    }
    usort($due, fn($a, $b) => strcmp($a['next'], $b['next']));
    /* yesterday at the doors, per person */
    $team = [];
    foreach (teamDays(2, '') as $p) foreach ($p['days'] as $d) {
        if ($d['date'] !== $yday || !$d['doors']) continue;
        $team[] = ['name' => $p['name'], 'doors' => $d['doors'], 'talked' => $d['doors'] - $d['miss'] - ($d['nosolicit'] ?? 0), 'booked' => $d['booked']];
    }
    usort($team, fn($a, $b) => $b['doors'] <=> $a['doors']);
    out(['ok' => true, 'company' => company(), 'today' => $today, 'yesterday' => $yday, 'tomorrow' => $tom, 'leadsNew' => count($new), 'leads' => $newOut,
         'walks' => $walks, 'due' => $due, 'team' => $team]);
}

/* a calendar file for one walk, with reminders the day before and an hour before. Opens in
   the phone's calendar. The phone number goes in only when it was given at the door by the
   current owner, the one number that is consent. */
if ($action === 'walkics') {
    $key = (string) ($_GET['region'] ?? '');
    $id  = (string) ($_GET['id'] ?? '');
    $data = loadRegion($key);
    if (!$data) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $home = doorHome($key, $id); if ($home !== $key) { $key = $home; $data = loadRegion($key); }
    $door = null; foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) if ($d['id'] === $id) { $door = $d; $area = $a['name']; }
    if (!$door) fail('No such door.', 404);
    $m = freshMark($door, loadMarks($key)[$id] ?? null);
    $w = walkFor($m, loadWalks($key)[$id] ?? null);
    if (!$w) fail('No walk booked for this door.', 404);
    $tz = new DateTimeZone('America/Denver'); $utc = new DateTimeZone('UTC');
    $town = regionLabel($key);
    $p = loadPhones($key)[$id] ?? null; $p = ($p && ($p['source'] ?? '') === 'door' && empty(ownerFlag($door, $p)['prev'])) ? $p : null;
    $n = loadNotes($key)[$id] ?? null; $n = ($n && empty(ownerFlag($door, $n)['prev'])) ? $n : null;
    $desc = 'Yard walk for a quote. Booked at the door by ' . ($w['by'] ?: 'the crew') . '.';
    if ($p) $desc .= "\nPhone (given at the door): " . $p['phone'];
    if ($n) $desc .= "\nNote: " . mb_substr((string) $n['note'], 0, 300);
    $L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//' . str_replace(['/', "\n"], '', company()['name']) . '//Door rounds//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
          'UID:walk-' . $key . '-' . $id . '-' . $w['at'] . '@' . (company()['site'] ?: 'door-app.invalid'),
          'DTSTAMP:' . (new DateTime('now', $utc))->format('Ymd\THis\Z')];
    if ($w['time'] !== '') {
        $st = new DateTime($w['date'] . ' ' . $w['time'], $tz);
        $L[] = 'DTSTART:' . (clone $st)->setTimezone($utc)->format('Ymd\THis\Z');
        $L[] = 'DTEND:' . (clone $st)->modify('+1 hour')->setTimezone($utc)->format('Ymd\THis\Z');
    } else {
        $st = new DateTime($w['date'] . ' 00:00', $tz);
        $L[] = 'DTSTART;VALUE=DATE:' . $st->format('Ymd');
        $L[] = 'DTEND;VALUE=DATE:' . (clone $st)->modify('+1 day')->format('Ymd');
    }
    $L[] = 'SUMMARY:' . icsEsc('Yard walk: ' . $door['address'] . ($w['time'] === '' ? ' (time to agree)' : ''));
    $L[] = 'LOCATION:' . icsEsc($door['address'] . ', ' . $town . ', CO');
    if (isset($door['lat'], $door['lon'])) $L[] = 'GEO:' . $door['lat'] . ';' . $door['lon'];
    $L[] = 'DESCRIPTION:' . icsEsc($desc);
    /* the day before; and an hour before when there is a time (an all-day walk gets 9 am the day before) */
    foreach ($w['time'] !== '' ? ['-P1D', '-PT1H'] : ['-PT15H'] as $tr) {
        array_push($L, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' . icsEsc('Yard walk: ' . $door['address']), 'TRIGGER:' . $tr, 'END:VALARM');
    }
    array_push($L, 'END:VEVENT', 'END:VCALENDAR');
    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: attachment; filename="sixfold-walk-' . $w['date'] . '.ics"');
    header('Cache-Control: no-store');
    echo implode('', array_map('icsLine', $L));
    exit;
}

if ($action === 'firecheck') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    $items = $body['items'] ?? null;
    if (!is_array($items) || !$items) fail('Nothing was checked.');
    foreach ($items as $k => $v) {
        if (!in_array($k, FIRE_ITEMS, true)) fail('Unknown check item.');
        if (!in_array($v, ['ok', 'fix', 'na'], true)) fail('Each item is done, needs work, or could not check.');
    }
    $note = trim((string) ($body['note'] ?? ''));
    $note = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $note);
    if (mb_strlen($note) > 600) fail('Keep the note under 600 characters.');
    if (!appendFireCheck($key, ['id' => $id, 'items' => $items, 'note' => $note, 'by' => $me, 'at' => tapTime($body)])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

if ($action === 'result') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    $result = $body['result'] ?? null;
    if ($result !== null && $result !== 'won' && $result !== 'lost') fail('Won or lost only.');
    $value = null;
    if ($result === 'won' && ($body['value'] ?? '') !== '' && $body['value'] !== null) {
        if (!is_numeric($body['value']) || $body['value'] < 0 || $body['value'] > 1000000) fail('The job value has to be a dollar amount.');
        $value = (int) round((float) $body['value']);
    }
    $why = $result === 'lost' ? (string) ($body['why'] ?? '') : '';
    if ($why !== '' && !in_array($why, LOST_WHY, true)) fail('Unknown reason.');
    if (!appendResult($key, ['id' => $id, 'result' => $result, 'value' => $value, 'why' => $why, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

/* ---- results: which doors turn into jobs (2026-10-03) ---------------------------
 * Every door anyone has marked, bucketed by what the app knew about it — fire hazard, lawn,
 * trees, county value, town, extra work — and what became of it: talked to, booked, quote
 * sent, won, lost. No-soliciting doors are left out (nobody could knock). Admin only. */
if ($action === 'results') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $blank = ['knocked' => 0, 'talked' => 0, 'booked' => 0, 'quoted' => 0, 'won' => 0, 'lost' => 0, 'value' => 0];
    $dims = ['fire' => [], 'lawn' => [], 'trees' => [], 'value' => [], 'town' => [], 'work' => []];
    $total = $blank;
    $add = function (string $dim, string $k, array $row) use (&$dims, $blank) {
        $cur = $dims[$dim][$k] ?? $blank;
        foreach ($row as $f => $v) $cur[$f] += $v;
        $dims[$dim][$k] = $cur;
    };
    foreach (($idx['regions'] ?? []) as $r) {
        $data = loadRegion($r['key']);
        if (!$data) continue;
        $marks = loadMarks($r['key']); $quoted = loadQuoted($r['key']); $res = loadResults($r['key']);
        $lfix = loadLawnFix($r['key']); $work = loadWork($r['key']);
        foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
            $m = $marks[$d['id']] ?? null;
            if (!$m || $m['outcome'] === 'nosolicit') continue;
            $booked = $m['outcome'] === 'booked';
            $rs = $booked ? ($res[$d['id']] ?? null) : null;
            $row = ['knocked' => 1, 'talked' => ($booked || $m['outcome'] === 'later') ? 1 : 0, 'booked' => $booked ? 1 : 0,
                    'quoted' => ($booked && isset($quoted[$d['id']])) ? 1 : 0,
                    'won' => ($rs && $rs['result'] === 'won') ? 1 : 0, 'lost' => ($rs && $rs['result'] === 'lost') ? 1 : 0,
                    'value' => ($rs && $rs['result'] === 'won') ? (int) ($rs['value'] ?? 0) : 0];
            foreach ($row as $f => $v) $total[$f] += $v;
            $f = (int) ($d['fire'] ?? 0);
            $add('fire', ($f >= 1 && $f <= 5) ? (string) $f : 'x', $row);
            $add('lawn', lawnLevel($d, $lfix) ?? 'x', $row);
            $add('trees', treeLevel($d) ?? 'x', $row);
            $v = (int) ($d['val'] ?? 0);
            $add('value', !$v ? 'x' : ($v < 400000 ? 'a' : ($v < 600000 ? 'b' : ($v < 800000 ? 'c' : ($v < 1000000 ? 'd' : 'e')))), $row);
            $add('town', (string) ($r['label'] ?? $r['key']), $row);
            $wk = $work[$d['id']]['tags'] ?? [];
            if (!$wk) $add('work', 'none', $row);
            foreach ($wk as $t) $add('work', $t, $row);
        }
    }
    out(['ok' => true, 'total' => $total, 'dims' => $dims]);
}

if ($action === 'note') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    $raw = (string) ($body['note'] ?? '');
    /* keep line breaks and tabs; drop every other control character */
    $t = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', str_replace("\r\n", "\n", $raw));
    if ($t === null) fail('That note has characters that cannot be saved.');
    $t = trim($t);
    $len = function_exists('mb_strlen') ? mb_strlen($t, 'UTF-8') : strlen($t);
    if ($len > NOTE_MAX) fail('Keep notes under ' . NOTE_MAX . ' characters.');
    $row = ['id' => $id, 'note' => $t === '' ? null : $t, 'by' => $me, 'at' => tapTime($body)];
    if (!appendNote($key, $row)) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

if ($action === 'areaflag') {
    if (!$isPost) fail('POST required', 405);
    $key  = (string) ($body['region'] ?? '');
    $name = (string) ($body['area'] ?? '');
    $on   = !empty($body['on']);
    $data = loadRegion($key);
    if (!$data) fail('No such region.', 404);
    $area = null;
    foreach ($data['areas'] as $a) { if ($a['name'] === $name) { $area = $a; break; } }
    if (!$area) fail('No such neighbourhood.', 404);
    $hit = flagsOver($area['doors'], loadAreaFlags($key));
    if ($on) {
        if ($hit) out(['ok' => true]);                              // already flagged
        $row = ['fid' => bin2hex(random_bytes(8)), 'name' => $area['name'],
                'ids' => array_map(fn($d) => $d['id'], $area['doors']), 'on' => true, 'by' => $me, 'at' => time()];
        if (!appendAreaFlag($key, $row)) fail('Could not save that. Try again.', 500);
        out(['ok' => true]);
    }
    if ($role !== 'admin') fail('Only an admin can clear a no-soliciting flag.', 403);
    foreach (array_keys($hit) as $fid) {
        if (!appendAreaFlag($key, ['fid' => $fid, 'on' => null, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    }
    out(['ok' => true]);
}

/* ---- booked quotes, the door bookings on the Pipeline (admin) ---------------
 * The knock-to-quote handoff. Every door marked Quote booked, across every town,
 * newest first, with everything the person building the quote needs: address,
 * owner, acres, fire hazard, coordinates, the number and its source, the note. */
if ($action === 'quotes') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $list = [];
    foreach (($idx['regions'] ?? []) as $r) {
        $data = loadRegion($r['key']);
        if (!$data) continue;
        $marks = loadMarks($r['key']);
        $phones = loadPhones($r['key']);
        $notes = loadNotes($r['key']);
        $quoted = loadQuoted($r['key']);
        $lfix = loadLawnFix($r['key']);
        $emails = loadEmails($r['key']);
        $photos = loadPhotos($r['key']);
        $work = loadWork($r['key']);
        $res = loadResults($r['key']);
        $walks = loadWalks($r['key']);
        foreach ($data['areas'] as $a) {
            foreach ($a['doors'] as $d) {
                $m = freshMark($d, $marks[$d['id']] ?? null);
                if (!$m || $m['outcome'] !== 'booked') continue;
                $p = $phones[$d['id']] ?? null;
                $n = $notes[$d['id']] ?? null;
                $qd = $quoted[$d['id']] ?? null;
                /* a "quote sent" from before this booking was for an earlier booking — or the previous owner (review 2026-10-03) */
                if ($qd && (int) $qd['at'] < (int) $m['at']) $qd = null;
                $em = $emails[$d['id']] ?? null;
                $list[] = [
                    'region' => $r['key'], 'town' => $r['label'], 'area' => $a['name'], 'id' => $d['id'],
                    'address' => $d['address'], 'acres' => $d['acres'], 'owner' => $d['owner'],
                    'fire' => $d['fire'] ?? null, 'lat' => $d['lat'] ?? null, 'lon' => $d['lon'] ?? null,
                    'by' => $m['by'], 'at' => $m['at'], 'os' => $d['os'] ?? null, 'maybe' => ownerAge($d, $m) === 'maybe',
                    'phone' => $p ? ['phone' => $p['phone'], 'source' => $p['source'], 'seen' => $p['seen'], 'at' => $p['at']] + ownerFlag($d, $p) + (isset($p['dnc']) ? ['dnc' => $p['dnc']] : []) : null,
                    'note' => $n ? ['note' => $n['note'], 'by' => $n['by'], 'at' => $n['at']] + ownerFlag($d, $n) : null,
                    'quoted' => $qd,
                    'lawn' => $d['lawn'] ?? null, 'lawnfix' => $lfix[$d['id']] ?? null, 'trees' => $d['trees'] ?? null, 'val' => $d['val'] ?? null,
                    'work' => $work[$d['id']] ?? null,
                    'walk' => walkFor($m, $walks[$d['id']] ?? null),
                    /* a result from before this booking belongs to an earlier one */
                    'result' => (($res[$d['id']] ?? null) && (int) $res[$d['id']]['at'] >= (int) $m['at']) ? $res[$d['id']] : null,
                    'email' => $em ? $em + ownerFlag($d, $em) : null, 'photos' => $photos[$d['id']] ?? [],
                ];
            }
        }
    }
    usort($list, function ($x, $y) { return $y['at'] <=> $x['at']; });
    out(['ok' => true, 'quotes' => $list]);
}

if ($action === 'quoted') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    $row = ['id' => $id, 'quoted' => empty($body['quoted']) ? null : true, 'by' => $me, 'at' => time()];
    if (!appendQuoted($key, $row)) fail('Could not save that. Try again.', 500);
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
/* 2026-10-03 (review): crew-typed text goes into a file an admin opens in Excel or Sheets.
   A note starting "=" (or + - @, tab, CR) would run as a formula; a leading ' stops that.
   Top level, so every export has it. */
function csvSafe($v) { return is_string($v) && $v !== '' && strpbrk($v[0], "=+-@\t\r") !== false ? "'" . $v : $v; }

/* ---- skip tracing (2026-10-04) ----------------------------------------------------------------
 * Owner phone numbers from a provider (api/skiptrace.php; BatchData is the first adapter). Admin
 * only, start to finish: the run, the results, the export and putting a number on a door. Results
 * are kept in skiptrace-<town>.log (append-only, newest line per door wins) and a door is never
 * bought twice unless force=1. Every number is LOOKED-UP: hidden from call lists and the export
 * until the provider says dnc=false (skipCleared). Nothing here dials or texts.
 *
 *   skiptrace   POST {region, area?, limit=500, dry=1|0, force=0|1, chunk?}  dry: counts and cost, nothing sent;
 *                                                                           live: ONE chunk (a provider batch), then remaining
 *   skiplist    GET  region, area?                                          every traced door in the town, numbers flagged
 *   skipexport  GET  region?, all=0|1                                       CSV; cleared numbers only unless all=1 (then flagged)
 *   skippick    POST {region, id, phone}                                    a CLEARED number onto the door, source 'trace'
 *
 * The web run goes a chunk at a time (SiteGround ends a request after a couple of minutes); the page
 * loops until remaining is 0. tools/skip-trace.php runs the same action from the command line with
 * chunk=all, where there is no such limit. */
if ($action === 'skiptrace') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost && !defined('SIXFOLD_CLI')) fail('POST required', 405);
    $in = defined('SIXFOLD_CLI') ? $_REQUEST : $body;
    $key = (string) ($in['region'] ?? '');
    if (!loadRegion($key)) fail('No such region.', 404);
    $area = (string) ($in['area'] ?? '');
    $limit = max(1, min(5000, (int) ($in['limit'] ?? 500)));
    $dry = !isset($in['dry']) || (string) $in['dry'] !== '0';          /* a dry run unless told otherwise */
    $force = (string) ($in['force'] ?? '0') === '1';
    $cfg = skipConfig(__DIR__);
    $since = max(0, (int) ($in['since'] ?? 0));   /* the page's forced run, a chunk at a time: doors done since then are not done again */
    $cand = skipCandidates($key, $area, $limit, $force, regionLabel($key), $since);
    if ($area !== '' && $cand['total'] === 0) fail('No such neighbourhood.', 404);
    $n = count($cand['send']);
    $cost = $cfg['price_per_record'] !== null ? round($n * $cfg['price_per_record'], 2) : null;
    $base = ['ok' => true, 'region' => $key, 'area' => $area, 'limit' => $limit, 'force' => $force, 'provider' => (string) $cfg['provider'], 'configured' => skipConfigured($cfg),
             'total' => $cand['total'], 'wouldSend' => $n, 'withMail' => $cand['withMail'], 'skipped' => $cand['skipped'], 'skippedTotal' => array_sum($cand['skipped']),
             'cached' => $cand['cached'], 'errorsRetried' => $cand['errorsRetried'], 'pricePerRecord' => $cfg['price_per_record'], 'cost' => $cost,
             'costNote' => $cfg['price_per_record'] === null ? 'Price per record is not set in sixfold-private/skiptrace-config.php, so no cost is estimated.'
                                                            : 'Assumes the provider charges for every record sent, matched or not.'];
    if ($dry) out($base + ['dry' => true]);
    if (!skipConfigured($cfg)) fail('Skip trace is not set up: put the provider key in sixfold-private/skiptrace-config.php (the shape is api/skiptrace-config.example.php).', 503);
    /* the owners that are not people are written once, so the flag shows on the door and they are not counted again next run */
    foreach ($cand['skipRows'] as $r) skipAppend($key, $r + ['by' => $me]);
    $chunk = (string) ($in['chunk'] ?? '');
    $take = ($chunk === 'all' && defined('SIXFOLD_CLI')) ? $n : max(1, min(max(1, $n), (int) ($chunk !== '' ? $chunk : $cfg['batch_size'])));
    $send = array_slice($cand['send'], 0, $take);
    $lines = [];
    try { $prov = skipProvider($cfg); } catch (Throwable $e) { fail($e->getMessage(), 503); }
    $rows = $send ? skipRun($send, $prov, $cfg, function (string $l) use (&$lines, $key) {
        $lines[] = $l;
        if (str_contains($l, 'failed') || str_starts_with($l, 'retry')) skipErr($key, $l);
        if (defined('SIXFOLD_CLI')) fwrite(STDERR, "  $l\n");
    }, null, $me) : [];
    $tally = ['matched' => 0, 'nomatch' => 0, 'error' => 0]; $phones = 0; $clear = 0;
    foreach ($rows as $r) {
        if (!skipAppend($key, $r)) fail('Could not write the results log.', 500);
        $tally[$r['status']] = ($tally[$r['status']] ?? 0) + 1;
        $phones += count($r['phones']); foreach ($r['phones'] as $p) if (skipCleared($p)) $clear++;
    }
    out($base + ['dry' => false, 'sent' => count($send), 'remaining' => $n - count($send), 'matched' => $tally['matched'], 'nomatch' => $tally['nomatch'],
                 'errors' => $tally['error'], 'phones' => $phones, 'cleared' => $clear, 'log' => $lines]);
}

if ($action === 'skiplist') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $key = (string) ($_REQUEST['region'] ?? ''); $area = (string) ($_REQUEST['area'] ?? '');
    $data = loadRegion($key); if (!$data) fail('No such region.', 404);
    $tr = skipLoad($key); $onDoor = loadPhones($key);
    $rows = []; $sum = ['doors' => 0, 'matched' => 0, 'nomatch' => 0, 'error' => 0, 'skipped' => 0, 'phones' => 0, 'clear' => 0, 'listed' => 0, 'unchecked' => 0, 'emails' => 0];
    foreach ($data['areas'] as $a) {
        if ($area !== '' && $a['name'] !== $area) continue;
        foreach ($a['doors'] as $d) {
            $r = $tr[$d['id']] ?? null; if (!$r) continue;
            $pub = skipPublic($r);
            $sum['doors']++; $sum[$pub['status']] = ($sum[$pub['status']] ?? 0) + 1;
            $sum['phones'] += count($pub['phones']); $sum['clear'] += $pub['clear']; $sum['listed'] += $pub['listed']; $sum['unchecked'] += $pub['unchecked']; $sum['emails'] += count($pub['emails']);
            $od = $onDoor[$d['id']] ?? null;
            $rows[] = ['id' => $d['id'], 'address' => $d['address'], 'owner' => $d['owner'], 'area' => $a['name'], 'onDoor' => $od ? $od['phone'] : null] + $pub;
        }
    }
    $errs = []; $ef = skipErrFile();
    if (is_readable($ef)) foreach (array_slice(file($ef, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [], -40) as $l) { $e = json_decode($l, true); if (is_array($e) && ($e['town'] ?? '') === $key) $errs[] = $e; }
    out(['ok' => true, 'region' => $key, 'label' => regionLabel($key), 'area' => $area, 'rows' => $rows, 'sum' => $sum, 'lastErrors' => array_slice($errs, -5), 'crewSee' => !empty(skipConfig(__DIR__)['crew_see'])]);
}

if ($action === 'skipexport') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $all = (string) ($_REQUEST['all'] ?? '0') === '1';
    $only = (string) ($_REQUEST['region'] ?? '');
    if ($only !== '' && !preg_match('/^[a-z0-9-]{1,40}$/D', $only)) fail('No such region.', 404);
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="sixfold-skiptrace-' . ($only !== '' ? $only . '-' : '') . ($all ? 'all-flagged-' : 'cleared-') . date('Y-m-d') . '.csv"');
    $fh = fopen('php://output', 'w');
    fputcsv($fh, ['town', 'neighbourhood', 'address', 'owner', 'phone', 'phone_type', 'dnc', 'call_ok', 'emails', 'match', 'confidence', 'provider', 'looked_up', 'owner_mailing_address'], ',', '"', '');
    $dncWord = ['clear' => 'not on DNC list', 'listed' => 'ON DO NOT CALL LIST', 'unchecked' => 'DNC not checked'];
    foreach (($idx['regions'] ?? []) as $r) {
        if ($only !== '' && $r['key'] !== $only) continue;
        $data = loadRegion($r['key']); if (!$data) continue;
        $tr = skipLoad($r['key']); if (!$tr) continue;
        foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
            $x = $tr[$d['id']] ?? null; if (!$x) continue;
            $keep = $all ? ($x['phones'] ?? []) : array_values(array_filter($x['phones'] ?? [], 'skipCleared'));
            /* cleared-only: a door with no cleared number still has a row if it brought an email; otherwise it is not in this file */
            if (!$keep) { if (!$all && !($x['emails'] ?? [])) continue; $keep = [null]; }
            foreach ($keep as $p) fputcsv($fh, array_map('csvSafe', [$r['label'], $a['name'], $d['address'], $d['owner'],
                $p['n'] ?? '', $p['type'] ?? '', $p ? $dncWord[skipDncLabel($p)] : '', $p ? (skipCleared($p) ? 'yes' : 'NO') : '',
                implode('; ', $x['emails'] ?? []), $x['status'] . (!empty($x['why']) ? ' (' . (SKIP_KIND_LABEL[$x['why']] ?? $x['why']) . ')' : ''),
                $x['conf'] ?? '', $x['prov'] ?? '', date('Y-m-d', (int) ($x['at'] ?? 0)), $x['in']['mail'] ?? '']), ',', '"', '');
        }
    }
    fclose($fh);
    exit;
}

if ($action === 'skippick') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? ''); $id = (string) ($body['id'] ?? '');
    if (!loadRegion($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    $n = skipDigits((string) ($body['phone'] ?? ''));
    $row = skipLoad($key)[$id] ?? null;
    $hit = null; foreach (($row['phones'] ?? []) as $p) if (($p['n'] ?? '') === $n) $hit = $p;
    if (!$hit) fail('That number is not in the skip trace result for this door.', 404);
    if (!skipCleared($hit)) fail(skipDncLabel($hit) === 'listed' ? 'That number is on the Do Not Call list. It cannot go on the door.'
                                                                 : 'That number has not been checked against the Do Not Call list. It cannot go on the door until it is.', 409);
    if (!appendPhone($key, ['id' => $id, 'phone' => $n, 'source' => 'trace', 'seen' => date('Y-m'), 'dnc' => 'clear', 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'phone' => $n]);
}

/* ---- booked doors for Jobber (SX-45, 2026-10-03) ----------------------------------------
 * A CSV in the layout of Jobber's client import (help.getjobber.com "Import clients", checked
 * 2026-10-03): Full name, Is Company?, Main Phone, Email, Street, City, State, Country, Note,
 * Tags, Lead Source. Jobber maps any heading it does not recognise. Booked doors only — the
 * people who asked for a quote. City is the town; the door data has no ZIP code. Lead Source
 * "Other": Jobber's list has no door knocking. A previous owner's phone or email is left out.
 * Only matters if Sixfold adopts Jobber (the CRM decision was no purchase). Admin only. */
if ($action === 'jobber') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="sixfold-booked-for-jobber-' . date('Y-m-d') . '.csv"');
    $fh = fopen('php://output', 'w');
    fputcsv($fh, ['Full name', 'Is Company?', 'Main Phone', 'Email', 'Street', 'City', 'State', 'Country', 'Note', 'Tags', 'Lead Source'], ',', '"', '');
    $fireName = [5 => 'very high', 4 => 'high', 3 => 'moderate', 2 => 'low', 1 => 'very low'];
    $lawnName = ['L' => 'large', 'M' => 'medium', 'S' => 'small', 'N' => 'little or none', 'T' => 'mostly trees'];
    foreach (($idx['regions'] ?? []) as $r) {
        $data = loadRegion($r['key']);
        if (!$data) continue;
        $marks = loadMarks($r['key']); $phones = loadPhones($r['key']); $emails = loadEmails($r['key']);
        $notes = loadNotes($r['key']); $lfix = loadLawnFix($r['key']); $work = loadWork($r['key']); $res = loadResults($r['key']);
        foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
            $m = freshMark($d, $marks[$d['id']] ?? null);
            if (!$m || $m['outcome'] !== 'booked') continue;
            $p = $phones[$d['id']] ?? null; if ($p && ownerAge($d, $p) === 'prev') $p = null;
            $em = $emails[$d['id']] ?? null; if ($em && ownerAge($d, $em) === 'prev') $em = null;
            $n = $notes[$d['id']] ?? null; if ($n && ownerAge($d, $n) === 'prev') $n = null;
            $f = (int) ($d['fire'] ?? 0); $lv = lawnLevel($d, $lfix); $wk = $work[$d['id']]['tags'] ?? [];
            $rs = $res[$d['id']] ?? null;
            $owner = trim((string) ($d['owner'] ?? ''));
            if (preg_match('/^unavailable$/i', $owner)) $owner = '';
            $isCo = (bool) preg_match('/\b(LLC|L\.L\.C|INC|CORP|CORPORATION|COMPANY|LTD|LLLP|LP|PARTNERSHIP)\b/i', $owner);
            $noteBits = ['Booked at the door by ' . ($m['by'] ?: 'crew') . ' on ' . date('M j, Y', (int) $m['at']) . ' (' . company()['short'] . ' door app).'];
            if (isset($fireName[$f])) $noteBits[] = 'Fire hazard: ' . $fireName[$f] . ' (USFS 2023, neighbourhood scale).';
            if ($lv && isset($lawnName[$lv])) $noteBits[] = 'Lawn: ' . $lawnName[$lv] . '.';
            if ($wk) $noteBits[] = 'Extra work seen: ' . implode('; ', array_map(fn($t) => (workLabels()[$t] ?? $t), $wk)) . '.';
            if (!empty($d['val'])) $noteBits[] = 'County value: $' . number_format((int) $d['val']) . '.';
            if ($p && ($p['source'] ?? '') !== 'door') $noteBits[] = 'Phone was looked up, not given: check the Do Not Call lists before calling.';
            if ($n) $noteBits[] = 'Door note: ' . $n['note'];
            if ($rs) $noteBits[] = $rs['result'] === 'won' ? 'Won' . (!empty($rs['value']) ? ' at $' . number_format((int) $rs['value']) : '') . '.' : 'Lost' . (!empty($rs['why']) ? ': ' . (LOST_LABEL[$rs['why']] ?? $rs['why']) : '') . '.';
            $tags = [company()['short'] . ' door app', (string) ($r['label'] ?? $r['key'])];
            if (isset($fireName[$f])) $tags[] = 'Fire ' . $fireName[$f];
            if ($lv === 'L' || $lv === 'M') $tags[] = ucfirst($lawnName[$lv]) . ' lawn';
            foreach ($wk as $t) $tags[] = (workLabels()[$t] ?? $t);
            fputcsv($fh, array_map('csvSafe', [$owner, $isCo ? 'TRUE' : 'FALSE', $p['phone'] ?? '', $em['email'] ?? '',
                (string) $d['address'], (string) ($r['label'] ?? ''), 'CO', 'United States', implode(' ', $noteBits), implode(', ', $tags), 'Other']), ',', '"', '');
        }
    }
    fclose($fh);
    exit;
}

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
            $tot = ['booked' => 0, 'later' => 0, 'miss' => 0, 'nosolicit' => 0];
            foreach ($marks as $id => $m) {
                if (!isset($live[$id])) continue;
                $o = $m['outcome'];
                if (!isset($tot[$o])) continue;
                $tot[$o]++;
                $who = $m['by'] !== '' ? $m['by'] : 'unknown';
                if (!isset($byPerson[$who])) $byPerson[$who] = ['booked' => 0, 'later' => 0, 'miss' => 0, 'nosolicit' => 0];
                $byPerson[$who][$o]++;
            }
            $byRegion[] = ['label' => $r['label'], 'knocked' => array_sum($tot)] + $tot;
        }
        out(['ok' => true, 'byPerson' => $byPerson, 'byRegion' => $byRegion]);
    }

    /* csvSafe(): see above the Jobber export — it is shared */
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="sixfold-rounds.csv"');
    $fh = fopen('php://output', 'w');
    /* the explicit $escape is required from PHP 8.4 and accepted since 5.5; '' is
       also the standards-correct choice — no backslash escaping in CSV */
    fputcsv($fh, ['region', 'neighbourhood', 'address', 'acres', 'owner', 'outcome', 'by', 'when', 'come_back',
                  'phone', 'phone_source', 'phone_last_seen', 'phone_added_by', 'phone_added',
                  'note', 'note_by', 'note_added',
                  'lawn_photo_level', 'lawn_photo_sqft_approx', 'lawn_photo_year', 'lawn_crew_level', 'lawn_crew_by',
                  'trees_0_5ft', 'trees_5_30ft', 'trees_30_100ft', 'tallest_tree_m', 'trees_source',
                  'email', 'email_by', 'email_added', 'photos', 'owner_since', 'previous_owner_before', 'county_value', 'extra_work', 'result', 'job_value', 'lost_reason', 'fire_check', 'walk'], ',', '"', '');
    $srcName = ['door' => 'given at the door', 'tps' => 'True People Search', 'fps' => 'Fast People Search', 'other' => 'other', 'trace' => 'skip trace (not on DNC list)'];
    foreach (($idx['regions'] ?? []) as $r) {
        $data = loadRegion($r['key']);
        $marks = loadMarks($r['key']);
        $phones = loadPhones($r['key']);
        $notes = loadNotes($r['key']);
        $lfix = loadLawnFix($r['key']);
        $emails = loadEmails($r['key']);
        $photos = loadPhotos($r['key']);
        $work = loadWork($r['key']);
        $res = loadResults($r['key']);
        $fchk = loadFireChecks($r['key']);
        $walks = loadWalks($r['key']);
        if (!$data) continue;
        foreach ($data['areas'] as $a) {
            foreach ($a['doors'] as $d) {
                $m = $marks[$d['id']] ?? null;   /* the export keeps everything, previous owners' marks too */
                $p = $phones[$d['id']] ?? null;
                $n = $notes[$d['id']] ?? null;
                $lf = $lfix[$d['id']] ?? null;
                $em = $emails[$d['id']] ?? null;
                $ph = count($photos[$d['id']] ?? []);
                $wk = $work[$d['id']] ?? null;
                $rs = $res[$d['id']] ?? null;
                $fc = isset($fchk[$d['id']]) ? end($fchk[$d['id']]) : null;
                if (!$m && !$p && !$n && !$lf && !$em && !$ph && !$wk && !$rs && !$fc) continue;   // anything collected at a door is worth exporting
                fputcsv($fh, array_map('csvSafe', [$r['label'], $a['name'], $d['address'], $d['acres'], $d['owner'],
                              $m['outcome'] ?? '', $m['by'] ?? '', $m ? date('Y-m-d H:i', (int) $m['at']) : '', $m['revisit'] ?? '',
                              $p['phone'] ?? '', $p ? ($srcName[$p['source']] ?? $p['source']) : '', $p['seen'] ?? '',
                              $p['by'] ?? '', $p ? date('Y-m-d', (int) $p['at']) : '',
                              $n['note'] ?? '', $n['by'] ?? '', $n ? date('Y-m-d', (int) $n['at']) : '',
                              $d['lawn']['lv'] ?? '', $d['lawn']['sq'] ?? '', $d['lawn']['yr'] ?? '', $lf['lv'] ?? '', $lf['by'] ?? '',
                              $d['trees']['z1'] ?? '', $d['trees']['z2'] ?? '', $d['trees']['z3'] ?? '', $d['trees']['h'] ?? '',
                              isset($d['trees']) ? ($d['trees']['src'] === 'lidar' ? 'LiDAR ' . ($d['trees']['yr'] ?? '') : 'canopy map') : '',
                              $em['email'] ?? '', $em['by'] ?? '', $em ? date('Y-m-d', (int) $em['at']) : '', $ph ?: '', $d['os'] ?? '', $d['oa'] ?? '', $d['val'] ?? '',
                              $wk ? implode('; ', array_map(fn($t) => (workLabels()[$t] ?? $t), $wk['tags'])) : '',
                              $rs['result'] ?? '', $rs['value'] ?? '', $rs ? (LOST_LABEL[$rs['why']] ?? '') : '',
                              $fc ? (count(array_filter($fc['items'], fn($v) => $v === 'ok')) . ' done, ' . count(array_filter($fc['items'], fn($v) => $v === 'fix')) . ' to fix (' . date('Y-m-d', (int) $fc['at']) . ')') : '',
                              ($wk2 = walkFor($m, $walks[$d['id']] ?? null)) ? trim($wk2['date'] . ' ' . $wk2['time']) : '']), ',', '"', '');
            }
        }
    }
    fclose($fh);
    exit;
}

fail('Unknown action.', 404);
