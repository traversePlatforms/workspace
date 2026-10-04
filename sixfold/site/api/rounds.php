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
    /* 2026-10-03 (review): the fallback is inside public_html, and leads would follow it there.
       So it is for a local checkout only; on the host a missing data folder is an error. */
    /* PHP's own test server, never the host: SERVER_NAME can come from the visitor's Host header
       on Apache, and on a LAN-bound test server it isn't "localhost" (second review) */
    if (PHP_SAPI === 'cli-server') return __DIR__ . '/../data/rounds';
    http_response_code(503); header('Content-Type: application/json');
    exit('{"ok":false,"error":"Rounds is not configured on this server."}');
}
define('DATA_DIR', dataDir());
date_default_timezone_set('America/Denver');   /* review 2026-10-03: the export's date() used the host's zone */
const COOKIE     = 'sfr';
const MAX_TRIES  = 8;      // wrong codes per address per window
const TRY_WINDOW = 900;    // 15 minutes
const SITE_TRIES = 60;     // wrong codes from ALL addresses per hour before new sign-ins pause
const SITE_WINDOW = 3600;

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
 *     Quote booked leaves Quotes to build, and the old phone, email and note are shown as the
 *     previous owner's, with no Call or Email button;
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
 * Numbers are entered BY A PERSON. Nothing here fetches from a people-search
 * site -- automated pulling was declined on 2026-10-01 and stays declined. */
function phonesFile(string $key): string { return DATA_DIR . '/phones-' . $key . '.log'; }

/** Replay the append-only log: last line per door wins; a null phone removes it. */
function loadPhones(string $key): array {
    $out = [];
    foreach (logRows('phones', $key) as $p) {
        if (!is_array($p) || !isset($p['id'])) continue;
        if (($p['phone'] ?? null) === null) unset($out[$p['id']]);   // removed
        else $out[$p['id']] = ['phone' => $p['phone'], 'source' => $p['source'] ?? 'other',
                                'seen' => $p['seen'] ?? '', 'by' => $p['by'] ?? '', 'at' => $p['at'] ?? 0];
    }
    return $out;
}
function appendPhone(string $key, array $row): bool {
    return (bool) @file_put_contents(phonesFile($key), json_encode(stamped($row), JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}
const PHONE_SOURCES = ['door', 'tps', 'fps', 'other'];

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
const WORK_TAGS = ['roof', 'gutters', 'brush', 'deadtree', 'irrigation', 'bare', 'beds'];
const WORK_LABEL = ['roof' => 'Branches over the roof', 'gutters' => 'Gutters full of debris', 'brush' => 'Brush or junk against the house',
    'deadtree' => 'Dead or dying trees', 'irrigation' => 'Irrigation problem', 'bare' => 'Bare or patchy lawn', 'beds' => 'Overgrown beds or weeds'];
function loadWork(string $key): array {
    $out = [];
    foreach (logRows('work', $key) as $r) {
        if (!is_array($r) || !isset($r['id'])) continue;
        $t = array_values(array_intersect((array) ($r['work'] ?? []), WORK_TAGS));
        if (!$t) unset($out[$r['id']]);
        else $out[$r['id']] = ['tags' => $t, 'by' => $r['by'] ?? '', 'at' => $r['at'] ?? 0];
    }
    return $out;
}
function appendWork(string $key, array $row): bool {
    return (bool) @file_put_contents(DATA_DIR . '/work-' . $key . '.log', json_encode(stamped($row), JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}
/* ---- what became of a booked quote (2026-10-03) ------------------------------
 * Won (with the job's value) or lost (with a reason), set from Quotes to build. Over time this
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
 * Test sign-ins (Claude Check, Fable, the harness's Test people) never appear on the board. */
const BOARD_OPEN = false;
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
    $out = ''; while (strlen($l) > 75) { $cut = 75; while ($cut > 0 && (ord($l[$cut]) & 0xC0) === 0x80) $cut--; $out .= substr($l, 0, $cut) . "\r\n "; $l = substr($l, $cut); }
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
 * The admin "Quotes to build" list shows every door marked Quote booked. Ticking
 * "quote sent" moves it to the Sent section. Same append-only shape as the rest. */
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

if ($action === 'signin') {
    if (!$isPost) fail('POST required', 405);
    $addrFile = rateFile(clientKey()); $siteFile = rateFile('*site*');
    if (!throttleTake($addrFile, MAX_TRIES, TRY_WINDOW)) fail('Too many wrong codes from here. Wait fifteen minutes.', 429);
    if (!throttleTake($siteFile, SITE_TRIES, SITE_WINDOW)) {
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
    if (!$hit) fail('That code was not recognised.', 401);      // the attempt already counted stands
    throttleGiveBack($addrFile); throttleGiveBack($siteFile);   // right code: only THIS attempt is given back
    $payload = ['n' => $hit[0], 'r' => $hit[1] ?? 'crew', 'c' => codeId($hitCode, $sessionKey), 'exp' => time() + $sessionDays * 86400];
    $secure = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off');
    $tok = sign($payload, $sessionKey);
    setcookie(COOKIE, $tok, [
        'expires'  => $payload['exp'], 'path' => '/', 'httponly' => true,
        'samesite' => 'Lax', 'secure' => $secure,
    ]);
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
    $secure = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off');
    setcookie(COOKIE, '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => $secure]);
    out(['ok' => true]);
}

/* everything past here needs a session */
if (!$session) fail('Sign in first.', 401);
$me   = (string) $session['n'];
$role = (string) ($session['r'] ?? 'crew');

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
    foreach (($idx['regions'] ?? []) as $r) {
        $data = loadRegion($r['key']);
        if (!$data) continue;
        $marks = loadMarks($r['key']);
        $aflags = loadAreaFlags($r['key']);
        $lfix = loadLawnFix($r['key']);
        $assign = boardOpen($role) ? loadAssign($r['key']) : [];
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
                        'lawnL' => $lawnL, 'lawnM' => $lawnM, 'treeA' => $treeA, 'treeH' => $treeH, 'place' => $a['place'] ?? null, 'fw' => $a['fw'] ?? null,
                        'st' => topStreets($streets, 4), 'ns' => count($streets), 'who' => $assign[$a['name']] ?? null,
                        'cwpp' => !empty($a['place']['n']) ? (cwppPlaces()[strtolower((string) $a['place']['n'])] ?? null) : null,
                        '_seg' => $aseg];
        }
        $regions[] = ['key' => $r['key'], 'label' => $r['label'], 'areas' => $areas];
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
                                 'by' => $p['by'], 'at' => $p['at']] + ownerFlag($d, $p) : null,
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
    header('Cache-Control: private, max-age=604800');
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
    $hdr = array_merge(['User-Agent: SixfoldRounds/1.0 (contact@sixfoldcolorado.com)', 'Accept: application/geo+json, application/json'], $headers);
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
    $hdr = ['User-Agent: SixfoldRounds/1.0 (contact@sixfoldcolorado.com)', 'Accept: application/geo+json, application/json'];
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
 * phone calls and referrals are added by hand from the app. Door bookings stay in Quotes to
 * build. Admin only: these are customers' names and numbers. Append-only, like the marks:
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
    if (!is_array($tags) || count($tags) > count(WORK_TAGS)) fail('Bad list of work.');
    foreach ($tags as $t) if (!in_array($t, WORK_TAGS, true)) fail('Unknown kind of work.');
    $tags = array_values(array_unique($tags));
    if (!appendWork($key, ['id' => $id, 'work' => $tags ?: null, 'by' => $me, 'at' => tapTime($body)])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
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
    out(['ok' => true, 'from' => $from, 'to' => $to, 'walks' => $list]);
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
    $L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sixfold Colorado//Door rounds//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
          'UID:walk-' . $key . '-' . $id . '-' . $w['at'] . '@sixfoldcolorado.com',
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

/* ---- quotes to build (admin) ---------------------------------------------
 * The knock-to-quote handoff. Every door marked Quote booked, across every town,
 * newest first, with everything the person building the quote needs: address,
 * owner, acres, fire hazard, coordinates, the number and its source, the note.
 * Kept inside the door app on purpose — the Quote Build tool already exists in
 * three copies that must be kept in step (SX-2b); this adds no fourth. */
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
                    'phone' => $p ? ['phone' => $p['phone'], 'source' => $p['source'], 'seen' => $p['seen'], 'at' => $p['at']] + ownerFlag($d, $p) : null,
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
   Top level, so both exports have it (it used to live inside the export block only). */
function csvSafe($v) { return is_string($v) && $v !== '' && strpbrk($v[0], "=+-@\t\r") !== false ? "'" . $v : $v; }

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
            $noteBits = ['Booked at the door by ' . ($m['by'] ?: 'crew') . ' on ' . date('M j, Y', (int) $m['at']) . ' (Sixfold door app).'];
            if (isset($fireName[$f])) $noteBits[] = 'Fire hazard: ' . $fireName[$f] . ' (USFS 2023, neighbourhood scale).';
            if ($lv && isset($lawnName[$lv])) $noteBits[] = 'Lawn: ' . $lawnName[$lv] . '.';
            if ($wk) $noteBits[] = 'Extra work seen: ' . implode('; ', array_map(fn($t) => WORK_LABEL[$t] ?? $t, $wk)) . '.';
            if (!empty($d['val'])) $noteBits[] = 'County value: $' . number_format((int) $d['val']) . '.';
            if ($p && ($p['source'] ?? '') !== 'door') $noteBits[] = 'Phone was looked up, not given: check the Do Not Call lists before calling.';
            if ($n) $noteBits[] = 'Door note: ' . $n['note'];
            if ($rs) $noteBits[] = $rs['result'] === 'won' ? 'Won' . (!empty($rs['value']) ? ' at $' . number_format((int) $rs['value']) : '') . '.' : 'Lost' . (!empty($rs['why']) ? ': ' . (LOST_LABEL[$rs['why']] ?? $rs['why']) : '') . '.';
            $tags = ['Sixfold door app', (string) ($r['label'] ?? $r['key'])];
            if (isset($fireName[$f])) $tags[] = 'Fire ' . $fireName[$f];
            if ($lv === 'L' || $lv === 'M') $tags[] = ucfirst($lawnName[$lv]) . ' lawn';
            foreach ($wk as $t) $tags[] = WORK_LABEL[$t] ?? $t;
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
    $srcName = ['door' => 'given at the door', 'tps' => 'True People Search', 'fps' => 'Fast People Search', 'other' => 'other'];
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
                              $wk ? implode('; ', array_map(fn($t) => WORK_LABEL[$t] ?? $t, $wk['tags'])) : '',
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
