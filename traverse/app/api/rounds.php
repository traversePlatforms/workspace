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
/* memory (2026-10-08): the editions' big towns carry tens of MB of side files. The door view and the town list read only what
   they need, but ask for 256 MB where the host's limit is lower and lets a script raise it; diag reports what was granted. */
(function () {
    $m = trim((string) ini_get('memory_limit'));
    $mb = $m === '-1' ? PHP_INT_MAX : (int) $m * (['g' => 1024, 'm' => 1, 'k' => 1 / 1024][strtolower(substr($m, -1))] ?? 1 / 1048576);
    if ($mb < 256) @ini_set('memory_limit', '256M');
})();

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
            'features' => ['fieldguide' => false, 'quote' => false, 'communities' => false, 'firecheck' => false, 'skiptrace' => true, 'hail' => false, 'roof' => false, 'solar' => false, 'pest' => false, 'security' => false],
            /* which parts of the door card show (2026-10-04); a part with no data never shows anyway */
            'card' => ['lawn' => true, 'trees' => true, 'fire' => true, 'money' => true, 'water' => true], 'links' => [],
            /* the weather warnings this install shows and pushes (2026-10-06, the editions); null = Sixfold's rules (see alertEvents) */
            'alerts' => null,
            /* the town groups this install shows (2026-10-07): a town in index.json with a "group" is hidden unless named here */
            'townGroups' => [],
            /* best doors first (2026-10-07, the editions): the trade whose walking order the door list offers; null = none (Sixfold) */
            'best' => null,
            /* the Company screen's brand colour (2026-10-08), laid over from company-local.json */
            'brand' => '',
            /* a market outside Colorado (2026-10-11, editions/clients.cjs market): state, clock, county names, map, photo year, parcel
               service. null = Colorado, as every install was before. Read through market(), never directly. */
            'market' => null,
            /* one phone and one computer per sign-in at a time (2026-10-12); false lets a code be used anywhere */
            'oneDevice' => true];
    $f = json_decode((string) @file_get_contents(DATA_DIR . '/company.json'), true);
    /* what the client's admin set on the Company screen (2026-10-08): over the built file, never shipped in a data pack */
    $loc = json_decode((string) @file_get_contents(DATA_DIR . '/company-local.json'), true);
    if (is_array($f) && is_array($loc)) {
        foreach (['name', 'short', 'tagline', 'phone', 'email', 'site'] as $k0) if (isset($loc[$k0]) && is_string($loc[$k0])) $f[$k0] = $loc[$k0];   /* COMPANY_LOCAL, listed here: a top-level const is not defined yet when company() first runs */
        if (!empty($loc['color']) && preg_match('/^#[0-9a-f]{6}$/', (string) $loc['color'])) { $f['colors'] = brandColors((string) $loc['color']); $f['brand'] = (string) $loc['color']; }
        /* the company's Google review link (2026-10-13): the customer card's Ask for a review uses it */
        if (isset($loc['review']) && is_string($loc['review'])) $f['links'] = array_merge(is_array($f['links'] ?? null) ? $f['links'] : [], ['googleReview' => $loc['review']]);
    }
    $c = is_array($f) ? array_replace($def, array_intersect_key($f, $def)) : $def;
    $c['features'] = array_replace($def['features'], is_array($c['features']) ? $c['features'] : []);
    $c['card'] = array_replace($def['card'], is_array($c['card']) ? $c['card'] : []);
    foreach (['services', 'extraWork'] as $k) $c[$k] = array_values(array_filter((array) $c[$k], fn($p) => is_array($p) && count($p) >= 2 && preg_match('/^[a-z0-9_-]{1,30}$/D', (string) $p[0])));
    if (!$c['services']) $c['services'] = $def['services'];
    if (!in_array($c['best'], ['roof', 'yards', 'solar', 'pest', 'security'], true)) $c['best'] = null;
    $c['townGroups'] = array_values(array_filter(array_map(fn($g) => is_string($g) ? trim($g) : '', (array) $c['townGroups']), fn($g) => (bool) preg_match('/^[a-z0-9-]{1,40}$/D', $g)));
    $c['alerts'] = is_array($c['alerts']) ? array_values(array_filter(array_map(fn($e) => is_string($e) ? trim($e) : '', $c['alerts']), fn($e) => $e !== '' && strlen($e) <= 60)) : null;
    if (!is_array($c['market'])) $c['market'] = null;
    $c['oneDevice'] = $c['oneDevice'] !== false;
    return $c;
}
/** the market this install sells in (2026-10-11): Colorado unless company.json names another. Every value checked, since the
    page is sent the same block before sign-in. */
function market(): array {
    static $m = null;
    if ($m !== null) return $m;
    $m = ['key' => 'co', 'state' => 'CO', 'stateName' => 'Colorado', 'tz' => 'America/Denver', 'box' => [36.9, -109.1, 41.1, -102.0]];
    $x = company()['market'] ?? null;
    if (!is_array($x)) return $m;
    if (is_string($x['key'] ?? null) && preg_match('/^[a-z0-9-]{1,30}$/D', $x['key'])) $m['key'] = $x['key'];
    if (is_string($x['state'] ?? null) && preg_match('/^[A-Z]{2}$/D', $x['state'])) $m['state'] = $x['state'];
    if (is_string($x['stateName'] ?? null) && preg_match('/^[A-Za-z .-]{2,30}$/D', $x['stateName'])) $m['stateName'] = $x['stateName'];
    if (is_string($x['tz'] ?? null) && in_array($x['tz'], DateTimeZone::listIdentifiers(), true)) $m['tz'] = $x['tz'];
    $b = $x['box'] ?? null;
    if (is_array($b) && count($b) === 4 && count(array_filter($b, fn($v) => is_int($v) || is_float($v))) === 4 && $b[0] < $b[2] && $b[1] < $b[3]) $m['box'] = array_map('floatval', array_values($b));
    /* the page's part: its overview heading, county headings, map start, aerial photo search and lot-outline service */
    if (is_string($x['label'] ?? null) && mb_strlen($x['label']) <= 40) $m['label'] = $x['label'];
    $m['counties'] = [];
    foreach ((array) ($x['counties'] ?? []) as $k => $v) if (is_string($k) && preg_match('/^[a-z0-9-]{1,30}$/D', $k) && is_string($v) && mb_strlen($v) <= 40) $m['counties'][$k] = $v;
    $m['parcels'] = array_values(array_filter((array) ($x['parcels'] ?? []), fn($u) => is_string($u) && preg_match('#^https://[a-z0-9.-]+/[A-Za-z0-9_/.-]+/query$#D', $u)));
    $c = $x['centre'] ?? null;
    if (is_array($c) && count($c) === 2 && (is_int($c[0]) || is_float($c[0])) && (is_int($c[1]) || is_float($c[1]))) $m['centre'] = [(float) $c[0], (float) $c[1]];
    if (is_int($x['zoom'] ?? null) && $x['zoom'] >= 5 && $x['zoom'] <= 14) $m['zoom'] = $x['zoom'];
    $n = $x['naip'] ?? null;
    if (is_array($n) && preg_match('/^[a-z]{2}$/D', (string) ($n['state'] ?? '')) && preg_match('/^20\d\d$/D', (string) ($n['year'] ?? ''))) $m['naip'] = ['state' => $n['state'], 'year' => (string) $n['year']];
    return $m;
}
/** the install's clock: Denver for Colorado, the market's zone elsewhere */
function appTz(): string { return market()['tz']; }
/** the time zone block of a calendar feed, for any US zone: the offsets and names in January and July, and the US daylight-saving
    rule (second Sunday of March to first Sunday of November, since 2007) where the zone keeps one */
function icsTimezone(string $tzid): array {
    $z = new DateTimeZone($tzid); $y = (int) gmdate('Y');
    $w = new DateTime($y . '-01-15 12:00', $z); $s = new DateTime($y . '-07-15 12:00', $z);
    $off = fn(DateTime $d) => (($o = $d->getOffset()) < 0 ? '-' : '+') . sprintf('%02d%02d', intdiv(abs($o), 3600), intdiv(abs($o) % 3600, 60));
    $L = ['BEGIN:VTIMEZONE', 'TZID:' . $tzid];
    if ($w->getOffset() !== $s->getOffset()) {
        $L = array_merge($L, ['BEGIN:DAYLIGHT', 'TZOFFSETFROM:' . $off($w), 'TZOFFSETTO:' . $off($s), 'TZNAME:' . $s->format('T'), 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
                              'BEGIN:STANDARD', 'TZOFFSETFROM:' . $off($s), 'TZOFFSETTO:' . $off($w), 'TZNAME:' . $w->format('T'), 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD']);
    } else {
        $L = array_merge($L, ['BEGIN:STANDARD', 'TZOFFSETFROM:' . $off($w), 'TZOFFSETTO:' . $off($w), 'TZNAME:' . $w->format('T'), 'DTSTART:19700101T000000', 'END:STANDARD']);
    }
    $L[] = 'END:VTIMEZONE';
    return $L;
}
function feature(string $k): bool { return !empty(company()['features'][$k]); }
/* who sees the card's trade parts (2026-10-08): admins, and everyone signed in where the company sets features.crew (the editions,
   and Sixfold for its yard parts). These began as an admin-only preview inside Sixfold. Office tools (accounts, JobNimbus) stay admin. */
function crewSees(string $role): bool { return $role === 'admin' || ($role !== '' && feature('crew')); }
/* ---- hail (2026-10-04): the radar estimate per door, built offline by operations/door-territory/hail/build-hail.mjs.
   Admin only, and only where the company turns it on (features.hail). Matthew is evaluating it for roofing. */
function hailOn(string $role): bool { return crewSees($role) && feature('hail'); }
/* roof size and pitch (laser scan) and year built / roof material (county files), per door, built offline
   (operations/door-territory/roofs/sample-roofs.mjs, assessor/build-year.mjs). Admins only, features.roof. */
function roofDataOn(string $role): bool { return crewSees($role) && feature('roof'); }
/* solar (2026-10-06, TraverseSolar): sun-facing roof, shade, a system that fits, its yearly output and the power company, per door,
   built offline by data-pipeline/door-territory/solar/. Admins only, like the roof data, and only where the company turns it on. */
function solarOn(string $role): bool { return crewSees($role) && feature('solar'); }
/* pest (2026-10-06, TraversePest): why a door is worth knocking. Open space or water beside the house, year built and El Paso's
   last sale month (data-pipeline/door-territory/pest/), plus, from this install's own records, customers and bookings within
   about 160 m and what neighbours told the team in the last 30 days. Admins only, where the company turns pest on. */
function pestOn(string $role): bool { return crewSees($role) && feature('pest'); }
/* security (2026-10-06, TraverseSecurity): crime reported near the house (Colorado Springs police, area counts only, never a
   location), town figures (FBI), owner lives elsewhere, plus the pest build's sale month, year built and open space, and the
   same neighbours / bookings / door-note counts. Admins only, where the company turns security on. */
function securityOn(string $role): bool { return crewSees($role) && feature('security'); }
function loadSide(string $kind, string $key, ?array $only = null): array {
    static $memo = [];
    $k = $kind . '-' . $key;
    /* $only (2026-10-08): keep just these door ids and let the rest go at once. A town's side files can be tens of MB once
       decoded (wind for Colorado Springs southeast was 78 MB); one neighbourhood needs a few hundred rows of each. Not memoised. */
    /* a packed file (2026-10-08: security-<town>) holds each door's entry as JSON text; unpacked here, for the rows returned */
    $unpack = fn(array $d, $j) => empty($j['packed']) ? $d : array_map(fn($v) => is_string($v) ? json_decode($v, true) : $v, $d);
    if ($only !== null) { $j = json_decode((string) @file_get_contents(DATA_DIR . '/' . $k . '.json'), true); $d = is_array($j['doors'] ?? null) ? $unpack(array_intersect_key($j['doors'], $only), $j) : []; unset($j); return $d; }
    if (!isset($memo[$k])) { $j = json_decode((string) @file_get_contents(DATA_DIR . '/' . $k . '.json'), true); $memo[$k] = is_array($j['doors'] ?? null) ? $unpack($j['doors'], $j) : []; }
    return $memo[$k];
}
/* wind reports (2026-10-08): wind-<town>.json stores each as "date|mph|kind|miles" (a fifth of the memory of a small array in
   PHP); the door gets them back as [date, mph or null, kind, miles], as before. An older file's arrays pass through. */
function windRows($v): ?array {
    if (!is_array($v)) return null;
    $o = [];
    foreach ($v as $e) {
        if (is_array($e)) { $o[] = $e; continue; }
        $p = explode('|', (string) $e);
        if (count($p) >= 4) $o[] = [$p[0], $p[1] === '' ? null : (int) $p[1], $p[2], is_numeric($p[3]) ? $p[3] + 0 : $p[3]];
    }
    return $o;
}
/* roof outlines (2026-10-08): outline-<town>.json stores each as "u,v u,v ..."; the door gets [[u, v], ...] back, as before */
function olRows($v): ?array {
    if (!is_array($v)) return null;
    $o = [];
    foreach ($v as $k => $pts) $o[$k] = is_array($pts) ? $pts : array_map(fn($p) => array_map('intval', explode(',', $p)), explode(' ', trim((string) $pts)));
    return $o;
}
function windMph($e): float { return is_array($e) ? (float) ($e[1] ?? 0) : (float) (explode('|', (string) $e)[1] ?? 0); }
/** service keys, and the label for each */
function custServices(): array { return array_map(fn($p) => (string) $p[0], company()['services']); }
function workLabels(): array { $o = []; foreach (company()['extraWork'] as $p) $o[(string) $p[0]] = (string) $p[1]; return $o; }
function workTags(): array { return array_keys(workLabels()); }
/** who the app says it is when it asks a public service for data (the weather service wants a contact) */
function agentHeader(): string { $c = company(); return 'User-Agent: DoorApp/1.0 (' . preg_replace('/[\r\n]+/', ' ', (string) ($c['email'] ?: ($c['site'] ?: 'no contact set'))) . ')'; }
date_default_timezone_set(appTz());   /* review 2026-10-03: the export's date() used the host's zone; the market's since 2026-10-11 */
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
    sendJson((string) json_encode($body, JSON_UNESCAPED_SLASHES));
}
/* the answer as text (2026-10-09): out() encodes, and the kept towns answer arrives already encoded. No compressing here: the host
   (nginx) already sends JSON brotli-compressed (checked live 2026-10-09: Content-Encoding: br), which beats gzip. */
function sendJson(string $txt): never {
    if (defined('SIXFOLD_CLI')) throw new SixfoldOut((array) json_decode($txt, true));   /* the command-line tools take the answer as an array, as from out() */
    echo $txt;
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
    foreach ((array) ($a['x'] ?? []) as $t => $x) if ((int) ($x[0] ?? 0) < $now - 60 * 86400) unset($a['x'][$t]);   // ended-elsewhere marks, kept as long as a sign-in can last
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
/* one device at a time (2026-10-12, Matthew: "one device login ... that way people cant share and if they do it logs the other account out").
 * Each person may be signed in on ONE phone or tablet and ONE computer at a time; signing in on a second phone ends the first,
 * which is told why the next time it asks for anything. The page says which kind it is (an iPad on Safari calls itself a Mac);
 * without that, the browser's description decides. A company can turn it off: "oneDevice": false in company.json. */
function devClass(?string $hint = null): string {
    if ($hint === 'm' || $hint === 'c') return $hint;
    return preg_match('/iPhone|iPad|Android/i', (string) ($_SERVER['HTTP_USER_AGENT'] ?? '')) ? 'm' : 'c';
}
function devClassOf(array $line): string { return (string) ($line[4] ?? (preg_match('/iPhone|iPad|Android/', (string) ($line[3] ?? '')) ? 'm' : 'c')); }
function oneDeviceOn(): bool { return company()['oneDevice']; }
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
/* the super admin (2026-10-11, Matthew): Traverse's own sign-in inside a client's install. Only the server's codes file makes one (role
   'super' on its line; the app never writes that role, accountedit takes crew, manager or admin). It works as an admin everywhere, no
   client admin can change, sign out or remove it, and only it downloads the door list. */
$isSuper = false;
if ($session && $session['r'] === 'super') { $isSuper = true; $session['r'] = 'admin'; }
/** every download that leaves the app (2026-10-11, Matthew): who, what, how many, when; admins read it on the Accounts screen */
function exportLog(array $row): void {
    global $me;
    @file_put_contents(dirname(accountsFile()) . '/rounds-exports.log', json_encode(['by' => (string) $me] + $row + ['at' => time()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}
const EXPORT_MAX = 500;   /* doors in one download of the door list */
/* review 2026-10-11: doors shown to each person today; every VIEW_STEP crossed goes in the download log as heavy viewing. The Plan of
   one big town is about 3,000 doors; 20,000 in a day is a whole metro read through. It logs, it never blocks. */
const VIEW_STEP = 20000;
function viewCount(int $n): void {
    global $me;
    if ($n < 1 || (string) $me === '') return;
    $f = dirname(accountsFile()) . '/rounds-views.json';
    $fh = @fopen($f, 'c+'); if (!$fh) return;
    if (!flock($fh, LOCK_EX)) { fclose($fh); return; }
    $v = json_decode((string) stream_get_contents($fh), true); $day = date('Y-m-d');
    if (!is_array($v) || ($v['day'] ?? '') !== $day) $v = ['day' => $day, 'n' => []];
    $was = (int) ($v['n'][$me] ?? 0); $now = $was + $n; $v['n'][$me] = $now;
    ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($v)); fflush($fh); flock($fh, LOCK_UN); fclose($fh);
    if (intdiv($now, VIEW_STEP) > intdiv($was, VIEW_STEP)) exportLog(['what' => 'heavy viewing', 'n' => intdiv($now, VIEW_STEP) * VIEW_STEP]);
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
/* admin-only towns (2026-10-05, the commercial test): index.json marks them "admin": true. Every town is read through
   loadRegion, so refusing them here keeps them off crew phones on every screen, and out of the jobs that run with nobody
   signed in (alerts, morning email), where there is no admin role. */
function adminRegion(string $key): bool {
    static $set = null;
    if ($set === null) { $set = []; $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: []; foreach (($idx['regions'] ?? []) as $r) if (!empty($r['admin'])) $set[(string) $r['key']] = true; }
    return isset($set[$key]);
}
/** a town in a group this company does not show (index.json "group" vs company.json "townGroups"): as if it were not there */
function regionHidden(string $key): bool {
    static $grp = null;
    if ($grp === null) { $grp = []; $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: []; foreach (($idx['regions'] ?? []) as $r) if (!empty($r['group'])) $grp[(string) $r['key']] = (string) $r['group']; }
    return isset($grp[$key]) && !in_array($grp[$key], company()['townGroups'], true);
}
function loadRegion(string $key): ?array {
    if (regionHidden($key)) return null;
    if (adminRegion($key) && ($GLOBALS['role'] ?? '') !== 'admin') return null;
    $f = regionFile($key);
    return $f ? json_decode((string) file_get_contents($f), true) : null;
}
/* ---- light reads of a town (2026-10-10, TR-7) ------------------------------
 * Denver's door file is 40,000 doors: decoded whole it is ~80 MB of server memory, and every tap paid it (a mark checked
 * the town exists with loadRegion, then doorHome decoded it again for the door ids). Now:
 *   regionAvailable()  the same answer as loadRegion() !== null, without decoding the file;
 *   townSplit()        once per change of the town file, its neighbourhoods are written one file each, with its own
 *                      fields and every door id and position, under DATA_DIR/town-cache/<town>/; meta.json is written
 *                      last, so a meta whose stamp matches the town file means every part is there;
 *   areaOf() / doorIds() / townPositions() read those small files. Any failure returns null and the caller falls back
 *   to loadRegion(), as before. */
function regionAvailable(string $key): bool {
    if (regionHidden($key)) return false;
    if (adminRegion($key) && ($GLOBALS['role'] ?? '') !== 'admin') return false;
    return regionFile($key) !== null;
}
function townSplit(string $key): ?array {
    static $memo = [];
    if (array_key_exists($key, $memo)) return $memo[$key];
    $f = regionFile($key); if (!$f) return $memo[$key] = null;
    $dir = DATA_DIR . '/town-cache/' . $key; $stamp = (string) @filesize($f) . '-' . (string) @filemtime($f);
    $meta = json_decode((string) @file_get_contents($dir . '/meta.json'), true);
    if (!is_array($meta) || ($meta['stamp'] ?? '') !== $stamp) {
        $data = json_decode((string) @file_get_contents($f), true);
        if (!is_array($data) || !is_array($data['areas'] ?? null)) return $memo[$key] = null;
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return $memo[$key] = null;
        $names = []; $lines = [];
        foreach ($data['areas'] as $i => $a) {
            if (!isset($names[(string) $a['name']])) $names[(string) $a['name']] = $i;   /* the first of a repeated name, as the old loop found */
            foreach ($a['doors'] as $d) $lines[] = $d['id'] . "\t" . (isset($d['lat'], $d['lon']) && is_numeric($d['lat']) && is_numeric($d['lon']) ? $d['lat'] . ',' . $d['lon'] : '');
            if (!writeJsonAtomic($dir . '/a' . $i . '.json', $a)) return $memo[$key] = null;
        }
        if (!writeTextAtomic($dir . '/doors.txt', implode("\n", $lines))) return $memo[$key] = null;
        unset($lines);
        $top = $data; unset($top['areas'], $data);
        $meta = ['stamp' => $stamp, 'top' => $top, 'names' => $names];
        if (!writeJsonAtomic($dir . '/meta.json', $meta)) return $memo[$key] = null;
    }
    return $memo[$key] = $meta + ['dir' => $dir];
}
/** each neighbourhood's doors and knocked doors, and every won job ([who, when, value]), for one town: the same loop Territories and
    the Leaderboard ran over every door of every town on every request (1.1 s and 0.8 s with 27 towns, 2026-10-11), now kept in
    town-cache/<town>/knocks.json until the door file or its knock or result logs (its partners' too) change. The rules are the
    ones they used, unchanged: a knock counts when freshMark() keeps it, a won job when a booking's result is won after it. */
function townKnockStats(string $key): ?array {
    if (!regionAvailable($key)) return null;   /* hidden and admin-only towns, as loadRegion() */
    $f = regionFile($key); if (!$f) return null;
    $sig = [(string) @filesize($f) . '-' . (string) @filemtime($f)];
    foreach (['marks', 'result'] as $k) foreach (array_merge([$key], sharedWith($key)) as $p) {   /* the logs logRows() reads: marks-<town>.log, result-<town>.log */ $lf = DATA_DIR . '/' . $k . '-' . $p . '.log'; $sig[] = $k . ':' . $p . ':' . (string) @filesize($lf) . '-' . (string) @filemtime($lf); }
    $sig = md5(implode('|', $sig));
    $cf = DATA_DIR . '/town-cache/' . $key . '/knocks.json';
    $c = json_decode((string) @file_get_contents($cf), true);
    if (is_array($c) && ($c['sig'] ?? '') === $sig && is_array($c['areas'] ?? null)) return $c;
    $data = loadRegion($key); if (!$data) return null;
    $marks = loadMarks($key); $res = loadResults($key); $areas = []; $won = [];
    foreach ($data['areas'] as $a) {
        $total = 0; $knocked = 0;
        foreach ($a['doors'] as $d) {
            $m = freshMark($d, $marks[$d['id']] ?? null);
            $total++; if ($m) $knocked++;
            $x = $res[$d['id']] ?? null;
            if ($m && $m['outcome'] === 'booked' && $x && ($x['result'] ?? '') === 'won' && (int) $x['at'] >= (int) $m['at']) $won[] = [(string) ($m['by'] ?? ''), (int) $x['at'], (int) ($x['value'] ?? 0)];
        }
        $areas[] = [(string) $a['name'], $total, $knocked];   /* in file order, repeated names and all, as the loops listed them */
    }
    $c = ['sig' => $sig, 'areas' => $areas, 'won' => $won];
    if (is_dir(dirname($cf)) || @mkdir(dirname($cf), 0700, true)) writeJsonAtomic($cf, $c);
    return $c;
}
/** one neighbourhood of a split town, or null when it has none by that name */
function areaOf(array $split, string $name): ?array {
    $i = $split['names'][$name] ?? null;
    if ($i === null) return null;
    $a = json_decode((string) @file_get_contents($split['dir'] . '/a' . $i . '.json'), true);
    return is_array($a) ? $a : null;
}
/** id => [lat, lon] for every door of a split town */
function townPositions(array $split): array {
    $out = [];
    foreach (explode("\n", (string) @file_get_contents($split['dir'] . '/doors.txt')) as $ln) {
        $t = strpos($ln, "\t"); if ($t === false || $t === strlen($ln) - 1) continue;
        $ll = explode(',', substr($ln, $t + 1)); if (count($ll) === 2) $out[substr($ln, 0, $t)] = [(float) $ll[0], (float) $ll[1]];
    }
    return $out;
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
        $sp = regionAvailable($key) ? townSplit($key) : null;   /* the small id list, not the whole town (TR-7) */
        if ($sp) { foreach (explode("\n", (string) @file_get_contents($sp['dir'] . '/doors.txt')) as $ln) { $t = strpos($ln, "\t"); if ($t) $ids[substr($ln, 0, $t)] = true; } }
        else foreach ((loadRegion($key)['areas'] ?? []) as $a) foreach (($a['doors'] ?? []) as $d) $ids[$d['id']] = true;
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
    return (new DateTime($d[$k] . ' 00:00', new DateTimeZone(appTz())))->getTimestamp();
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
/* the towns answer without its empty fields (2026-10-09, speed): a 0 count or a null on every one of 6,841 neighbourhoods was
   a third of Security's 2.6 MB. Only fields every neighbourhood always carried are left out, and the page puts them back as
   the answer arrives (AREA_ZERO / AREA_NULL in the page), so every screen reads the same object as before. */
const AREA_ZERO = ['done', 'noanswer', 'hot', 'vhot', 'due', 'retry', 'booked', 'lawnL', 'lawnM', 'lawnS', 'cg', 'treeA', 'treeH', 'all3'];
const AREA_NULL = ['nosol', 'la', 'lo', 'place', 'fw', 'who', 'cwpp'];
function areaCompact(array $a): array {
    foreach (AREA_ZERO as $k) if (($a[$k] ?? null) === 0) unset($a[$k]);
    foreach (AREA_NULL as $k) if (array_key_exists($k, $a) && $a[$k] === null) unset($a[$k]);
    return $a;
}
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
        $stack[$m['id']][] = ['outcome' => $m['outcome'], 'by' => $m['by'] ?? '', 'at' => $m['at'] ?? 0, 'revisit' => $m['revisit'] ?? ''] + (!empty($m['qs']) ? ['qs' => 1] : []);
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
    return (new DateTime('@' . (int) ($m['at'] ?? 0)))->setTimezone(new DateTimeZone(appTz()))
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
/* the extra numbers on a door (2026-10-12): id => [{phone, label, source, by, at}], oldest first, at most PHONE_EXTRAS */
const PHONE_EXTRAS = 4;
const PHONE_LABELS = ['owner2', 'spouse', 'tenant', 'other'];
function loadPhoneExtras(string $key): array {
    $out = [];
    foreach (logRows('phones', $key) as $p) {
        if (!is_array($p) || !isset($p['id']) || empty($p['mode'])) continue;
        $id = (string) $p['id']; $n = (string) ($p['phone'] ?? '');
        $list = array_values(array_filter($out[$id] ?? [], fn($x) => $x['phone'] !== $n));
        if ($p['mode'] === 'add') $list[] = ['phone' => $n, 'label' => (string) ($p['label'] ?? 'other'), 'source' => (string) ($p['source'] ?? 'other'), 'by' => (string) ($p['by'] ?? ''), 'at' => (int) ($p['at'] ?? 0)];
        if ($list) $out[$id] = array_slice($list, -PHONE_EXTRAS); else unset($out[$id]);
    }
    return $out;
}
function loadPhones(string $key): array {
    $out = [];
    foreach (logRows('phones', $key) as $p) {
        if (!is_array($p) || !isset($p['id'])) continue;
        if (!empty($p['mode'])) continue;                            // the extra numbers (2026-10-12) are read by loadPhoneExtras
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
require_once __DIR__ . '/webpush.php';   /* phone alerts (2026-10-05): Web Push, no secrets in it */
require_once __DIR__ . '/sms.php';       /* in-app texting (2026-10-10): Twilio, keys in the private folder */
require_once __DIR__ . '/billing.php';   /* billing (2026-10-10): Stripe, keys in the private folder */

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
/* ---- roof material seen at the door (Matthew 2026-10-05) ----
 * Whoever is at the house can say what the roof is. It beats the county record and the photo (a person looking at it),
 * shows on the card under their name, and is the training data for teaching the photo model metal and shake. */
const MAT_KEYS = ['asphalt', 'tile', 'shake', 'metal', 'flat', 'slate'];
function loadMatFix(string $key): array {
    $out = [];
    foreach (logRows('matfix', $key) as $r) {
        if (!is_array($r) || !isset($r['id'])) continue;
        if (empty($r['m'])) unset($out[$r['id']]);
        else $out[$r['id']] = ['m' => (string) $r['m'], 'by' => $r['by'] ?? '', 'at' => $r['at'] ?? 0];
    }
    return $out;
}
function appendMatFix(string $key, array $row): bool {
    return (bool) @file_put_contents(DATA_DIR . '/matfix-' . $key . '.log', json_encode(stamped($row), JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
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
function boardOpen(string $role): bool { return BOARD_OPEN || $role === 'admin' || $role === 'manager'; }
function boardHidden(string $name): bool { return (bool) preg_match('/^(claude|fable)\b/i', $name); }
function loadAssign(string $key): array {
    $out = [];
    foreach (logRows('assign', $key) as $r) {
        if (!is_array($r) || !isset($r['area'])) continue;
        if (($r['who'] ?? '') === '') unset($out[$r['area']]); else $out[$r['area']] = (string) $r['who'];
    }
    return $out;
}
/* the day each current assignment is for, if it has one (2026-10-12): area => YYYY-MM-DD; a later assignment without a day clears it */
function assignDays(string $key): array {
    $out = [];
    foreach (logRows('assign', $key) as $r) {
        if (!is_array($r) || !isset($r['area'])) continue;
        if (($r['who'] ?? '') === '' || empty($r['on'])) unset($out[$r['area']]); else $out[$r['area']] = (string) $r['on'];
    }
    return $out;
}
/* a day to assign for: empty, or a real date from today up to a year ahead */
function assignDay($v): string {
    $v = trim((string) ($v ?? '')); if ($v === '') return '';
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $v, $m) || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) fail('That is not a real date.');
    $today = (new DateTime('now', new DateTimeZone(appTz())))->format('Y-m-d');
    if ($v < $today) fail('Pick today or a day ahead.');
    if ($v > (new DateTime('+1 year', new DateTimeZone(appTz())))->format('Y-m-d')) fail('Pick a day within the next year.');
    return $v;
}
function appendAssign(string $key, array $row): bool {
    return (bool) @file_put_contents(DATA_DIR . '/assign-' . $key . '.log', json_encode(stamped($row), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}
/* Doors assigned to one person (2026-10-08, the desktop planning table): finer than a neighbourhood. Newest row per door wins;
   who '' clears it, and the door falls back to its neighbourhood's person, if any. Same visibility as territories. */
function loadDoorAssign(string $key): array {
    $out = [];
    foreach (logRows('dassign', $key) as $r) {
        if (!is_array($r) || !isset($r['id'])) continue;
        if (($r['who'] ?? '') === '') unset($out[$r['id']]); else $out[(string) $r['id']] = (string) $r['who'];
    }
    return $out;
}function loadGoals(): array {
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
            if (!empty($r['admin'])) continue;   /* the cached index is shared by everyone, so admin-only towns stay out of search */
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
const CUST_PLANS = ['oneoff', 'monthly', 'quarterly', 'yearly', 'custom'];   /* quarterly: 2026-10-06, the pest industry's plan */
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
    if ($plan === 'yearly') $y++; else { $m += $plan === 'quarterly' ? 3 : 1; while ($m > 12) { $m -= 12; $y++; } }
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

/* ---- best neighbourhoods (2026-10-07, the editions) ----
 * The page's Best first gives each door points from its own card's facts (index.html, BEST). The town screen ranks neighbourhoods
 * by the same points over their doors still to knock, so the points are worked out here too, per door, with the same rules.
 * Cached per town in best-<trade>-<town>.json and rebuilt when any file it reads changes (a storm refresh rewrites hail-<town>).
 * Left out here, and added in the regions loop instead: a crew member's lawn correction (Yards). Left out entirely: Pest and
 * Security's "neighbours on service" and "booked nearby", which change by the hour. Keep the numbers in step with BEST. */
/* $parts (2026-10-09): per door [trade figure, ability], what the page's door score adds to the points, so a neighbourhood
   can carry the average 1-10 score of its doors still to knock (Matthew: pick neighbourhoods by score). Keep in step with
   scoreParts() in index.html, as the points are with BEST. */
const BEST_TOP_PHP = ['roof' => 10, 'yards' => 4, 'solar' => 6, 'pest' => 5, 'security' => 4];
/* the lawn's points for lawn work (2026-10-12): any lawn is an aeration job, so small, medium and large count the same and the
   lawn's size only breaks ties; a small lawn mostly under trees counts 1; no lawn to aerate takes points off. Not measured: 0. */
function yardsLawnPts(?string $lv): int { return ['L' => 3, 'M' => 3, 'S' => 3, 'T' => 1, 'N' => -3][$lv ?? ''] ?? 0; }
function doorScore10(string $trade, int $pts, array $q): int {
    $need = $pts <= -3 ? 0.0 : max(0.0, min(1.0, ($pts + (float) $q[0]) / ((BEST_TOP_PHP[$trade] ?? 6) + 1)));
    $v = 0.75 * $need + 0.25 * (float) $q[1];
    return max(1, min(10, (int) round(1 + 9 * $v)));
}
function bestTownPoints(string $trade, string $key, array $data, ?array &$parts = null): array {
    $src = ['hail', 'wind', 'year', 'roof', 'solar', 'permit', 'census', 'pest', 'security'];
    $files = array_map(fn($p) => DATA_DIR . '/' . $p . '-' . $key . '.json', $src);
    $files[] = DATA_DIR . '/' . $key . '.json'; $files[] = DATA_DIR . '/permit-index.json';
    $sig = md5(implode('|', array_map(fn($f) => (string) (@filemtime($f) ?: 0), $files)) . '|' . date('Y') . '|v3');   /* v3 2026-10-12: aeration-first lawn points */
    $cf = DATA_DIR . '/best-' . $trade . '-' . $key . '.json';
    $c = json_decode((string) @file_get_contents($cf), true);
    if (is_array($c) && ($c['sig'] ?? '') === $sig && is_array($c['p'] ?? null) && is_array($c['q'] ?? null)) { $parts = $c['q']; return $c['p']; }
    $side = function (string $p) use ($key): array { $j = json_decode((string) @file_get_contents(DATA_DIR . '/' . $p . '-' . $key . '.json'), true); return is_array($j['doors'] ?? null) ? $j['doors'] : []; };
    $cen = json_decode((string) @file_get_contents(DATA_DIR . '/census-' . $key . '.json'), true) ?: [];
    $pidx = (json_decode((string) @file_get_contents(DATA_DIR . '/permit-index.json'), true) ?: [])[$key] ?? null;
    /* one file at a time, keeping only what the points use (2026-10-08): whole and together they passed 160 MB for a big town */
    /* a packed file (an edition's side files since 2026-10-10) holds each door's entry as JSON text, unpacked here one door at a time */
    $take = function (string $p, callable $f) use ($side): array { $o = []; foreach ($side($p) as $id => $v) { $x = $f(is_string($v) && in_array($v[0] ?? '', ['{', '['], true) ? json_decode($v, true) : $v); if ($x !== null) $o[$id] = $x; } return $o; };
    /* plain numbers and short strings per door, not little arrays (2026-10-10): a two-item array costs PHP several hundred bytes,
       and for Denver's 40,000 doors the arrays kept here came to about 86 MB. $hailS / $hailD: the biggest stone and its date;
       $wind: the strongest gust; $yb / $ym: year built, and the later of it and the last remodel; $sqs: roof squares;
       $kwh / $pn / $sh: a year's output, whether the roof can carry panels, and its shade. */
    $hailS = []; $hailD = [];
    if ($trade === 'roof') foreach ($side('hail') as $id => $v) {
        if (is_string($v)) $v = json_decode($v, true);
        $big = null; foreach ((array) $v as $x) if (is_array($x) && (!$big || (float) $x[1] > (float) $big[1])) $big = $x;
        if ($big) { $hailS[$id] = (float) $big[1]; $hailD[$id] = substr((string) $big[0], 0, 10); }
    }
    $wind = $trade === 'roof' ? $take('wind', function ($v) { $m = 0.0; foreach ((array) $v as $e) $m = max($m, windMph($e)); return $m > 0 ? $m : null; }) : [];
    $yb = $trade === 'roof' ? $take('year', fn($v) => is_array($v) && !empty($v['yb']) ? (int) $v['yb'] : null) : [];
    $ym = $trade === 'roof' ? $take('year', fn($v) => is_array($v) && !empty($v['yb']) ? max((int) $v['yb'], (int) ($v['rm'] ?? 0)) : null) : [];
    $sqs = $trade === 'roof' ? $take('roof', fn($v) => is_array($v) && isset($v['sqs']) ? (float) $v['sqs'] : null) : [];
    $kwh = $trade === 'solar' ? $take('solar', fn($v) => is_array($v) && !empty($v['kwh']) ? (float) $v['kwh'] : null) : [];
    $pn = $trade === 'solar' ? $take('solar', fn($v) => is_array($v) && !empty($v['pn']) ? 1 : null) : [];
    $sh = $trade === 'solar' ? $take('solar', fn($v) => is_array($v) && isset($v['sh']) ? (string) $v['sh'] : null) : [];
    $perm = ($trade === 'roof' || $trade === 'solar') ? $take('permit', fn($v) => is_array($v) ? array_intersect_key($v, ['r' => 1, 's' => 1, 'so' => 1]) : null) : [];
    $pest = $trade === 'pest' ? $take('pest', fn($v) => is_array($v) ? array_intersect_key($v, ['sold' => 1, 'os' => 1, 'wa' => 1]) : null) : [];
    $sec = $trade === 'security' ? $take('security', fn($v) => is_array($v) ? array_intersect_key($v, ['sold' => 1, 'yb' => 1, 'ab' => 1, 'os' => 1]) : null) : [];
    $yr = (int) date('Y'); $ymNow = $yr * 12 + (int) date('n');
    $recent = fn(string $ym): bool => strlen($ym) >= 7 && $ymNow - ((int) substr($ym, 0, 4) * 12 + (int) substr($ym, 5, 2)) <= 12;
    $p = []; $qq = [];
    $c01 = fn($x) => max(0.0, min(1.0, (float) $x));
    foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
        $id = (string) $d['id']; $pts = 0;
        if ($trade === 'roof') {
            $big = isset($hailS[$id]);
            if ($big) { $h = $hailS[$id]; $pts += $h >= 1.75 ? 6 : ($h >= 1.25 ? 4 : ($h >= 1 ? 3 : ($h >= 0.75 ? 1 : 0))); }
            $w = (float) ($wind[$id] ?? 0);
            if ($w >= 58) $pts += $w >= 75 ? 3 : 2;
            $b = $yb[$id] ?? 0;
            if ($b) { $age = $yr - (int) $ym[$id]; if ($age >= 12) $pts += $age >= 20 ? 2 : 1; }
            if ((float) ($sqs[$id] ?? 0) >= 30) $pts += 1;
            $pr = (string) ($perm[$id]['r'] ?? '');
            if ($pr !== '') { if ($big && $pr >= substr($hailD[$id], 0, 7)) $pts -= 8; elseif ($yr - (int) substr($pr, 0, 4) <= 5) $pts -= 3; }
            elseif ($pidx && ($pidx['full'] ?? true) !== false && $b && (int) substr((string) $pidx['since'], 0, 4) - $b >= 5) $pts += 1;
        } elseif ($trade === 'yards') {                            /* the lawn itself is added live, in the regions loop */
            /* aeration first (2026-10-12, Matthew: "we are wanting smaller lots as well due to aeration"): fire hazard and lot size
               no longer count here (they favoured big foothill lots); trees against the house stay as one point, a trim upsell */
            if (treeLevel($d) === 'against') $pts += 1;
        } elseif ($trade === 'solar') {
            if (isset($pn[$id], $kwh[$id])) { $k = $kwh[$id]; $pts += $k >= 10000 ? 3 : ($k >= 7000 ? 2 : ($k >= 4000 ? 1 : 0)); }
            $s = $sh[$id] ?? ''; if ($s === 'open') $pts += 2; elseif ($s === 'heavy') $pts -= 3;
            $pm = $perm[$id] ?? null; if ($pm && !empty($pm['s']) && empty($pm['so'])) $pts -= 8;
        } elseif ($trade === 'pest') {
            $x = $pest[$id] ?? [];
            if ($recent((string) ($x['sold'] ?? ''))) $pts += 2;
            if (in_array(treeLevel($d), ['against', 'heavy'], true)) $pts += 1;
            if (!empty($x['os'])) $pts += 1;
            if (!empty($x['wa'])) $pts += 1;
        } elseif ($trade === 'security') {
            $x = $sec[$id] ?? [];
            if ($recent((string) ($x['sold'] ?? ''))) $pts += 2;
            if (!empty($x['yb']) && (int) $x['yb'] >= $yr - 5) $pts += 1;
            if (!empty($x['ab'])) $pts += 1;
            if ((float) ($d['acres'] ?? 0) >= 1) $pts += 1;
            if (!empty($x['os'])) $pts += 1;
        }
        $bg = $cen['doors'][$id] ?? null; $o = $bg !== null ? ($cen['bgs'][$bg]['o'] ?? null) : null;
        if ($o !== null && $o < 40) $pts -= 2;                    /* a block mostly rented, as on the card */
        if ($pts) $p[$id] = $pts;
        /* the trade figure and the ability to pay, as scoreParts() works them out */
        $acres = (float) ($d['acres'] ?? 0); $tf = 0.0;
        if ($trade === 'roof') $tf = $c01(((float) ($hailS[$id] ?? 0) - 0.75) / 1.75) * 0.6 + $c01((float) ($sqs[$id] ?? 0) / 45) * 0.4;
        elseif ($trade === 'solar') $tf = $c01((float) ($kwh[$id] ?? 0) / 16000);
        elseif ($trade === 'yards') $tf = $c01((float) ($d['lawn']['sq'] ?? 0) / 3000);   /* a tie-break only: full at a large lawn (3,000 sq ft) */
        elseif ($trade === 'pest') $tf = $c01($acres) * 0.5 + $c01((float) ($d['trees']['z2'] ?? 0)) * 0.5;
        elseif ($trade === 'security') $tf = $c01($acres / 2);
        $val = $d['val'] ?? ($bg !== null ? ($cen['bgs'][$bg]['v'] ?? null) : null);
        $ab = ($val === null && $o === null) ? 0.5 : ($val === null ? 0.5 : $c01(((float) $val - 200000) / 700000)) * 0.7 + ($o === null ? 0.5 : $c01(((float) $o - 40) / 50)) * 0.3;
        $qq[$id] = [round($tf, 3), round($ab, 3)];
    }
    writeJsonAtomic($cf, ['sig' => $sig, 'p' => $p, 'q' => $qq]);
    $parts = $qq;
    return $p;
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
/* ---- the roof job (2026-10-09, roofing installs): after the booking, the insurance job's steps with their dates, so the app can
 * show Colorado's two 72-hour cancellation windows (C.R.S. 6-22-103(1)(f): 72 hours after entering the contract; 6-22-104(1): 72
 * hours after the homeowner receives the insurer's written denial, in whole or in part, with payments back within 10 days, 6-22-104(2)).
 * One line per change: { id, step, when ('YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM', Colorado time; null clears), by, at }. */
const ROOF_STEPS = ['signed', 'claim', 'adjuster', 'approved', 'denied', 'materials', 'installed', 'cancelled'];
const ROOF_TIMED = ['signed', 'denied', 'cancelled'];   /* the windows run from these, so they carry a time of day */
function loadRoofJobs(string $key): array {
    $out = [];
    foreach (logRows('roofjob', $key) as $r) {
        if (!is_array($r) || !isset($r['id'], $r['step']) || !in_array($r['step'], ROOF_STEPS, true)) continue;
        if (($r['when'] ?? null) === null) unset($out[$r['id']][$r['step']]);
        else $out[$r['id']][$r['step']] = ['when' => (string) $r['when'], 'by' => $r['by'] ?? '', 'at' => (int) ($r['at'] ?? 0)];
    }
    return $out;
}
function loadQuoted(string $key): array {
    $out = [];
    foreach (logRows('quoted', $key) as $q) {
        if (!is_array($q) || !isset($q['id'])) continue;
        if (empty($q['quoted'])) unset($out[$q['id']]);
        else $out[$q['id']] = ['by' => $q['by'] ?? '', 'at' => $q['at'] ?? 0] + (!empty($q['src']) ? ['src' => (string) $q['src']] : []);
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

/* ---- storms kept fresh by the server (Matthew 2026-10-06: "pull more recent storms", and a time limit) ----
 * The offline build (data-pipeline/door-territory/hail/build-hail.mjs) writes hail-<town>.json, hail-storms.json and hail-paths.json.
 * After that the server adds each new day itself: when an admin opens Hail or the Storm list and the files were last brought up to
 * date more than 12 hours ago, it reads NOAA's MRMS MESH 24-hour maximum for each day since (Iowa State's archive, the same files
 * the build reads; at most HAIL_MAX_DAYS a time), adds the storms to the doors, and drops storm days past the keep rule: two years,
 * five when hail reached 2 in (data-pipeline/door-territory/storm-keep.mjs holds the same numbers). Hail only; wind waits for the
 * next offline build. Nothing about a door leaves the server: only NOAA's file comes in. */
const HAIL_ARCHIVE = 'https://mtarchive.geol.iastate.edu';
const HAIL_MIN_MM = 19.05, HAIL_BIG_MM = 25.4, HAIL_REFRESH = 12 * 3600, HAIL_MAX_DAYS = 10;
const KEEP_YEARS = 2, KEEP_MAJOR_YEARS = 5, KEEP_MAJOR_HAIL_IN = 2.0;
const HAIL_BUDGET = 75;   /* seconds of fetching per run (review 2026-10-07): what is done by then is written; the rest waits for the next run */
/** GET as bytes; null when it failed. $code gets the HTTP status (0 = no answer at all), so a 404 ("not there") can be told from an outage */
function httpGetRaw(string $url, int $timeout = 20, ?int &$code = null): ?string {
    $code = 0;
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_FOLLOWLOCATION => true, CURLOPT_HTTPHEADER => [agentHeader()]]);
        $b = curl_exec($c); $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c);
        return ($b !== false && $code === 200) ? (string) $b : null;
    }
    $b = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => $timeout, 'header' => agentHeader()]]));
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) $code = (int) $m[1];
    if ($b !== false && $code === 0) $code = 200;
    return $b === false ? null : $b;
}
/** one MRMS MESH GRIB2 file (lat/lon grid, PNG packing) cut to a box: grid, the box's first row and column, and every square with
    hail as [row, col, tenths of a mm] from there. Mirrors data-pipeline/door-territory/hail/mesh.mjs, but unpacks only the rows
    it needs (from the nearest row above that does not lean on the one before it). */
function meshCrop(string $b, float $n, float $s, float $w, float $e): ?array {
    if (substr($b, 0, 4) !== 'GRIB' || ord($b[7]) !== 2) return null;
    $u16 = fn(int $o) => unpack('n', substr($b, $o, 2))[1];
    $u32 = fn(int $o) => unpack('N', substr($b, $o, 4))[1];
    $s16 = function (int $o) use ($u16) { $v = $u16($o); return $v & 0x8000 ? -($v & 0x7fff) : $v; };
    $s32 = function (int $o) use ($u32) { $v = $u32($o); return $v & 0x80000000 ? -($v & 0x7fffffff) : $v; };
    $p = 16; $g = []; $png = null; $len = strlen($b);
    while ($p < $len - 4 && substr($b, $p, 4) !== '7777') {
        $sl = $u32($p); $sec = ord($b[$p + 4]);
        if ($sl < 5) return null;
        if ($sec === 3) {
            if ($u16($p + 12) !== 0) return null;
            $g = ['nx' => $u32($p + 30), 'ny' => $u32($p + 34), 'lat1' => $s32($p + 46) / 1e6, 'lon1' => $u32($p + 50) / 1e6, 'dx' => $u32($p + 63) / 1e6, 'dy' => $u32($p + 67) / 1e6];
        }
        if ($sec === 5) { if ($u16($p + 9) !== 41) return null; $g['R'] = unpack('G', substr($b, $p + 11, 4))[1]; $g['E'] = $s16($p + 15); $g['D'] = $s16($p + 17); }
        if ($sec === 7) $png = substr($b, $p + 5, $sl - 5);
        $p += $sl;
    }
    if ($png === null || empty($g['nx']) || !isset($g['R'])) return null;
    $q = 8; $idat = ''; $W = 0; $H = 0; $pl = strlen($png);
    while ($q + 8 <= $pl) {
        $L = unpack('N', substr($png, $q, 4))[1]; $t = substr($png, $q + 4, 4);
        if ($t === 'IHDR') { $W = unpack('N', substr($png, $q + 8, 4))[1]; $H = unpack('N', substr($png, $q + 12, 4))[1]; if (ord($png[$q + 16]) !== 16 || ord($png[$q + 17]) !== 0) return null; }
        if ($t === 'IDAT') $idat .= substr($png, $q + 8, $L);
        $q += 12 + $L;
    }
    unset($png);
    if ($W < 1 || !function_exists('inflate_init')) return null;
    $stride = $W * 2; $rb = $stride + 1;
    $row = fn(float $lat) => (int) round(($g['lat1'] - $lat) / $g['dy']);
    $col = fn(float $lon) => (int) round(($lon + 360 - $g['lon1']) / $g['dx']);
    $r0 = max(0, $row($n)); $r1 = min($H - 1, $row($s)); $c0 = max(0, $col($w)); $c1 = min($W - 1, $col($e));
    if ($r1 < $r0 || $c1 < $c0) return null;
    /* unpacked as a stream (the whole image is 49 MB): only the rows from WIN above the box down to its last are kept */
    $WIN = 256; $rows = []; $y = 0; $buf = ''; $ctx = inflate_init(ZLIB_ENCODING_DEFLATE);
    foreach (str_split($idat, 4096) as $chunk) {
        $more = @inflate_add($ctx, $chunk, ZLIB_SYNC_FLUSH); if ($more === false) return null;
        $buf .= $more; $off = 0; $bl = strlen($buf);
        while ($bl - $off >= $rb) { if ($y >= $r0 - $WIN) $rows[$y] = substr($buf, $off, $rb); $off += $rb; $y++; if ($y > $r1) break 2; }
        $buf = substr($buf, $off);
    }
    unset($idat, $buf);
    if (!isset($rows[$r1])) return null;
    $k = $r0; while ($k > max(0, $r0 - $WIN) && ord($rows[$k][0]) >= 2) $k--;   /* Up, Average and Paeth lean on the row above */
    $scale = 2 ** $g['E']; $div = 10 ** $g['D']; $cells = []; $prev = null;
    for ($y = $k; $y <= $r1; $y++) {
        $f = ord($rows[$y][0]); $cur = array_values(unpack('C*', substr($rows[$y], 1, $stride))); unset($rows[$y]);
        if ($f !== 0) for ($x = 0; $x < $stride; $x++) {
            $a = $x >= 2 ? $cur[$x - 2] : 0; $c = $prev ? $prev[$x] : 0; $ul = ($x >= 2 && $prev) ? $prev[$x - 2] : 0; $v = $cur[$x];
            if ($f === 1) $o = $v + $a; elseif ($f === 2) $o = $v + $c; elseif ($f === 3) $o = $v + (($a + $c) >> 1);
            else { $pp = $a + $c - $ul; $pa = abs($pp - $a); $pb = abs($pp - $c); $pc = abs($pp - $ul); $o = $v + ($pa <= $pb && $pa <= $pc ? $a : ($pb <= $pc ? $c : $ul)); }
            $cur[$x] = $o & 255;
        }
        if ($y >= $r0) for ($x = $c0; $x <= $c1; $x++) {
            $mm = ($g['R'] + ($cur[2 * $x] * 256 + $cur[2 * $x + 1]) * $scale) / $div;
            if ($mm > 0) $cells[] = [$y - $r0, $x - $c0, (int) round($mm * 10)];
        }
        $prev = $cur;
    }
    return ['lat1' => $g['lat1'], 'lon1' => $g['lon1'], 'dx' => $g['dx'], 'dy' => $g['dy'], 'r0' => $r0, 'c0' => $c0, 'cells' => $cells];
}
/** one storm day D: the 24-hour file nearest 12:00 UTC on D+1 (6 am Colorado summer time), cut to the box.
    ['missing' => why] = the archive answered and has no usable file for that day; null = no proper answer (an outage, a timeout),
    so nothing can be said about the day yet (review 2026-10-07: an outage used to be written down as a gap for good). */
function hailDayFetch(string $day, array $box): ?array {
    $base = getenv('TRAVERSE_HAIL_ARCHIVE') ?: HAIL_ARCHIVE;   /* the override is for the test copy only */
    $nx = date('Y/m/d', strtotime($day . ' 12:00 UTC +1 day'));
    $dir = $base . '/' . $nx . '/mrms/ncep/MESH_Max_1440min/';
    $html = httpGetRaw($dir, 15, $code);
    if ($html === null) return $code === 404 ? ['missing' => 'no such day'] : null;
    if (!preg_match_all('/href="([^"]+?_\d{8}-(\d{6})\.grib2\.gz)"/', $html, $m, PREG_SET_ORDER)) return ['missing' => 'no files'];
    $files = []; foreach ($m as $x) { $dt = abs((int) $x[2] - 120000); if ($dt <= 10000) $files[$x[1]] = $dt; }
    if (!$files) return ['missing' => 'no file near 12:00 UTC'];
    asort($files); $outage = false;
    foreach (array_slice(array_keys($files), 0, 3) as $fn) {
        $gz = httpGetRaw($dir . $fn, 30, $code); if ($gz === null) { if ($code !== 404) $outage = true; continue; }
        $grib = @gzdecode($gz); if (!is_string($grib)) continue;
        $c = meshCrop($grib, $box['n'], $box['s'], $box['w'], $box['e']);
        if ($c) return $c + ['file' => $fn];
    }
    return $outage ? null : ['missing' => 'unreadable'];
}
function keepCutoffs(): array { return ['keep' => date('Y-m-d', strtotime('-' . KEEP_YEARS . ' years')), 'major' => date('Y-m-d', strtotime('-' . KEEP_MAJOR_YEARS . ' years'))]; }
function writeJsonAtomic(string $f, array $j): bool { return writeTextAtomic($f, (string) json_encode($j, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)); }
function writeTextAtomic(string $f, string $txt): bool {
    $tmp = $f . '.tmp' . getmypid() . bin2hex(random_bytes(3));   /* threaded servers share a pid */
    /* the whole text or nothing (review 2026-10-10): a full disk makes file_put_contents write part and return the count,
       not false, and the towns answer is sent from this file on its head and tail alone */
    if (@file_put_contents($tmp, $txt, LOCK_EX) !== strlen($txt)) { @unlink($tmp); return false; }
    return @rename($tmp, $f);
}
/** bring the hail files up to date (see above). Returns what it did; never throws. */
function stormRefresh(bool $force = false): array {
    $state = DATA_DIR . '/storm-refresh.json';
    $st = is_readable($state) ? (json_decode((string) file_get_contents($state), true) ?: []) : [];
    if (!$force && ($st['at'] ?? 0) > time() - HAIL_REFRESH) return ['skipped' => 'fresh'] + $st;
    if (PHP_SAPI === 'cli-server' && !getenv('TRAVERSE_HAIL_ARCHIVE')) return ['skipped' => 'test server'];   /* PHP's own test server never reaches out for storms */
    $fp = @fopen($state . '.lock', 'c');
    if (!$fp || !flock($fp, LOCK_EX | LOCK_NB)) return ['skipped' => 'busy'];
    @set_time_limit(120); @ignore_user_abort(true);   /* a phone that stops waiting does not stop the update half-way */
    $sf = DATA_DIR . '/hail-storms.json';
    $hs = json_decode((string) @file_get_contents($sf), true);
    if (!is_array($hs)) { flock($fp, LOCK_UN); fclose($fp); return ['skipped' => 'no hail files yet']; }
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    /* every door, once: town, area, id, where (the box is the doors' extent plus a margin, as the build's) */
    $doors = []; $box = ['n' => -90, 's' => 90, 'w' => 180, 'e' => -180]; $label = [];
    foreach (($idx['regions'] ?? []) as $r) {
        $f = regionFile((string) $r['key']); if (!$f) continue;
        $d = json_decode((string) @file_get_contents($f), true); if (!is_array($d)) continue;
        $label[$r['key']] = (string) ($r['label'] ?? $r['key']);
        foreach (($d['areas'] ?? []) as $a) foreach (($a['doors'] ?? []) as $x) {
            if (!is_numeric($x['lat'] ?? null) || !is_numeric($x['lon'] ?? null)) continue;
            $la = (float) $x['lat']; $lo = (float) $x['lon'];
            $doors[] = [$r['key'], (string) $a['name'], (string) $x['id'], $la, $lo];
            $box['n'] = max($box['n'], $la); $box['s'] = min($box['s'], $la); $box['w'] = min($box['w'], $lo); $box['e'] = max($box['e'], $lo);
        }
    }
    if (!$doors) { flock($fp, LOCK_UN); fclose($fp); return ['skipped' => 'no doors']; }
    $box = ['n' => $box['n'] + 0.03, 's' => $box['s'] - 0.03, 'w' => $box['w'] - 0.03, 'e' => $box['e'] + 0.03];
    $through = (string) ($hs['through'] ?? '2020-03-31');
    $yesterday = date('Y-m-d', strtotime('yesterday'));
    $pf = DATA_DIR . '/hail-paths.json';
    $paths = json_decode((string) @file_get_contents($pf), true);
    $hail = []; $touched = []; $added = []; $missing = []; $storms = [];
    foreach ((array) ($hs['storms'] ?? []) as $sx) $storms[$sx['date']] = $sx;
    $loadTown = function (string $k) use (&$hail) { if (!isset($hail[$k])) { $j = json_decode((string) @file_get_contents(DATA_DIR . '/hail-' . $k . '.json'), true); $hail[$k] = is_array($j) ? $j : ['doors' => []]; if (!is_array($hail[$k]['doors'] ?? null)) $hail[$k]['doors'] = []; } };
    $t0 = microtime(true);
    for ($day = date('Y-m-d', strtotime($through . ' +1 day')), $n = 0; $day <= $yesterday && $n < HAIL_MAX_DAYS; $day = date('Y-m-d', strtotime($day . ' +1 day')), $n++) {
        if (microtime(true) - $t0 > HAIL_BUDGET) break;   /* out of time: write what is done, the rest next run */
        $c = hailDayFetch($day, $box);
        if ($c === null) break;                      /* the archive did not answer properly: nothing is known about this day yet */
        $recent = $day >= date('Y-m-d', strtotime('-3 days'));
        if (isset($c['missing'])) {
            if ($recent) break;                      /* not published yet: try again next time */
            $missing[] = $day; $through = $day; continue;   /* an old gap stays a gap, as in the build */
        }
        $grid = []; foreach ($c['cells'] as $x) $grid[$x[0] * 100000 + $x[1]] = $x[2] / 10;
        if ($grid) foreach ($doors as [$tk, $area, $id, $la, $lo]) {
            $r = (int) round(($c['lat1'] - $la) / $c['dy']) - $c['r0']; $cc = (int) round(($lo + 360 - $c['lon1']) / $c['dx']) - $c['c0'];
            $best = 0.0;
            for ($dr = -1; $dr <= 1; $dr++) for ($dc = -1; $dc <= 1; $dc++) { $v = $grid[($r + $dr) * 100000 + $cc + $dc] ?? 0; if ($v > $best) $best = $v; }
            if ($best < HAIL_MIN_MM) continue;
            $inch = round($best / 25.4, 2);
            $loadTown($tk); $touched[$tk] = true;
            $list = array_values(array_filter((array) ($hail[$tk]['doors'][$id] ?? []), fn($e) => ($e[0] ?? '') !== $day));
            array_unshift($list, [$day, $inch]); usort($list, fn($x, $y) => strcmp((string) $y[0], (string) $x[0]));
            $hail[$tk]['doors'][$id] = $list;
            $s = $storms[$day] ?? ['date' => $day, 'max' => 0, 'n1' => 0, 'n34' => 0, 'towns' => []];
            $tw = $s['towns'][$tk] ?? ['label' => $label[$tk] ?? $tk, 'n1' => 0, 'n34' => 0, 'max' => 0, 'areas' => (object) []];
            $tw['areas'] = (array) $tw['areas'];
            $s['max'] = max($s['max'], $inch); $tw['max'] = max($tw['max'], $inch); $s['n34']++; $tw['n34']++;
            if ($best >= HAIL_BIG_MM) { $s['n1']++; $tw['n1']++; $tw['areas'][$area] = ($tw['areas'][$area] ?? 0) + 1; }
            $s['towns'][$tk] = $tw; $storms[$day] = $s;
        }
        if (isset($storms[$day]) && is_array($paths)) {
            $paths['paths'][$day] = array_values(array_map(fn($x) => [$x[0] + $c['r0'] - (int) $paths['r0'], $x[1] + $c['c0'] - (int) $paths['c0'], (int) round($x[2] / 10 / 25.4 * 100)],
                array_filter($c['cells'], fn($x) => $x[2] / 10 >= HAIL_MIN_MM)));
        }
        $added[] = $day; $through = $day;
    }
    /* the keep rule, by storm day (whole days, so door lists and the storm list agree) */
    $cut = keepCutoffs(); $kept = [];
    foreach ($storms as $d => $s) if ($d >= $cut['keep'] || ((float) ($s['max'] ?? 0) >= KEEP_MAJOR_HAIL_IN && $d >= $cut['major'])) $kept[$d] = true;
    $dropped = array_values(array_diff(array_keys($storms), array_keys($kept)));
    if ($dropped) {
        foreach (($idx['regions'] ?? []) as $r) {
            $k = (string) $r['key']; $loadTown($k);
            foreach ($hail[$k]['doors'] as $id => $list) {
                $l2 = array_values(array_filter((array) $list, fn($e) => isset($kept[$e[0] ?? ''])));
                if (count($l2) !== count((array) $list)) { $touched[$k] = true; if ($l2) $hail[$k]['doors'][$id] = $l2; else unset($hail[$k]['doors'][$id]); }
            }
        }
        foreach ($dropped as $d) { unset($storms[$d]); if (is_array($paths)) unset($paths['paths'][$d]); }
    }
    $ok = true;
    foreach (array_keys($touched) as $k) { $hail[$k]['through'] = $through; $hail[$k]['keep'] = $cut; $ok = writeJsonAtomic(DATA_DIR . '/hail-' . $k . '.json', $hail[$k]) && $ok; }
    if ($added || $dropped || $missing) {
        krsort($storms);
        $hs['storms'] = array_values($storms); $hs['through'] = $through; $hs['keep'] = $cut;
        $hs['days'] = (int) ($hs['days'] ?? 0) + count($added); $hs['missing'] = (int) ($hs['missing'] ?? 0) + count($missing);
        $ok = writeJsonAtomic($sf, $hs) && $ok;
        if (is_array($paths)) $ok = writeJsonAtomic($pf, $paths) && $ok;
    }
    $res = ['at' => time(), 'through' => $through, 'added' => $added, 'dropped' => count($dropped), 'missing' => $missing, 'written' => $ok];
    @file_put_contents($state, json_encode($res, JSON_UNESCAPED_SLASHES), LOCK_EX);
    flock($fp, LOCK_UN); fclose($fp);
    return $res;
}

/* the Hail screen: every storm day, the towns and neighbourhoods it hit (admins, where the company has it on) */
if ($action === 'hail') {
    if (!$session) fail('Sign in first.', 401);
    if (!hailOn((string) ($session['r'] ?? ''))) fail('Not allowed.', 403);
    stormRefresh();   /* new storm days since the files were made, and the keep rule (at most every 12 hours) */
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

/* a text coming in (2026-10-10): Twilio's webhook for the company's number. No session: the request must carry a valid
   X-Twilio-Signature for the configured URL. STOP-type words opt the number out at once, START opts it back in. */
if ($action === 'smsin') {
    $sc = smsConfig(__DIR__);
    if (!smsConfigured($sc)) fail('Not found.', 404);
    $url = (string) ($sc['public_url'] ?: ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? '') . ($_SERVER['REQUEST_URI'] ?? '')));
    $params = $_POST;
    if (!smsValid($sc, $url, $params, (string) ($_SERVER['HTTP_X_TWILIO_SIGNATURE'] ?? ''))) fail('Not allowed.', 403);
    $num = smsE164((string) ($params['From'] ?? ''));
    if ($num !== null) {
        $text = mb_substr((string) ($params['Body'] ?? ''), 0, 1600);
        $kw = smsKeyword($text);
        if ($kw === 'stop') smsSetOpt($num, true, 'reply');
        if ($kw === 'start') smsSetOpt($num, false, 'reply');
        smsLog(['num' => $num, 'dir' => 'in', 'body' => $text, 'sid' => (string) ($params['MessageSid'] ?? ''), 'at' => time()] + ($kw ? ['kw' => $kw] : []));
    }
    header('Content-Type: text/xml; charset=utf-8');
    echo '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    exit;
}

/* Stripe's webhook for this install (2026-10-10, api/billing.php). No session: the raw body must carry a valid
   Stripe-Signature for this install's endpoint secret, and only events for this install are taken. */
if ($action === 'billinghook') {
    $bc = billingConfig(__DIR__);
    if (!billingConfigured($bc)) fail('Not found.', 404);
    if (!$isPost) fail('POST required', 405);
    if (!stripeSigValid((string) $bc['webhook_secret'], (string) ($raw ?? ''), (string) ($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? ''))) fail('Not allowed.', 400);
    $ev = json_decode((string) $raw, true);
    if (!is_array($ev) || empty($ev['type'])) fail('Not an event.', 400);
    $did = billingTakeEvent($bc, $ev);
    if ($did !== '') billingLog(['what' => 'event', 'type' => (string) $ev['type'], 'id' => (string) ($ev['id'] ?? ''), 'did' => $did]);
    out(['ok' => true, 'received' => true]);
}

/* the company's name, mark, colours and lists, for the sign-in screen and everything after (2026-10-04) */
/* without appUrl (review 2026-10-04): the folder name is what keeps the sign-in page out of sight; only the morning email needs it */
if ($action === 'company') out(['ok' => true, 'company' => ['market' => company()['market'] ? market() : null] + array_diff_key(company(), ['appUrl' => 1, 'market' => 1])]);   /* the market checked (2026-10-11) */

/* a session for a person on this install's codes list: the cookie, the signed-in list, and the answer the page expects
   (sign-in, and since 2026-10-12 the super admin arriving from another install) */
function startSession(array $hit, string $hitCode, string $sessionKey, int $sessionDays): array {
    $payload = ['n' => $hit[0], 'r' => $hit[1] ?? 'crew', 'c' => codeId($hitCode, $sessionKey), 'exp' => time() + $sessionDays * 86400, 'j' => bin2hex(random_bytes(4))];
    $secure = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off');
    $tok = sign($payload, $sessionKey);
    setcookie(COOKIE, $tok, [
        'expires'  => $payload['exp'], 'path' => '/', 'httponly' => true,
        'samesite' => 'Lax', 'secure' => $secure,
    ]);
    $cls = devClass(isset($GLOBALS['body']['dev']) ? (string) $GLOBALS['body']['dev'] : null);
    $line = [$payload['c'], $payload['exp'], time(), deviceName(), $cls];
    $ended = [];
    sessEdit(function ($a) use ($tok, $line, $cls, &$ended) {
        $mine = sessionTag($tok);
        if (oneDeviceOn()) foreach ($a['s'] as $t => $l) {
            if ($t === $mine || ($l[0] ?? '') !== $line[0] || devClassOf($l) !== $cls) continue;
            if ((int) ($l[1] ?? 0) < time()) continue;   /* 2026-10-13 (Fable review): a sign-in that has run out ends nothing; sessEdit drops it below. It was being logged as a move between devices (Flags) */
            unset($a['s'][$t]); $a['x'][$t] = [time(), $line[3]]; $ended[] = (string) ($l[3] ?? '');
        }
        $a['s'][$mine] = $line; return $a;
    });
    if ($ended) accountLog(['what' => 'elsewhere', 'who' => (string) $hit[0], 'from' => $ended[0], 'to' => $line[3]]);
    return ['ok' => true, 'name' => $payload['n'], 'role' => $payload['r'] === 'super' ? 'admin' : $payload['r'], 'super' => $payload['r'] === 'super', 'walker' => !empty($GLOBALS['acct']['walker'][(string) $payload['c']]), 'sid' => sessionTag($tok), 'avatar' => avatarVer((string) $payload['c'])];
}

/* ---- moving between installs (2026-10-12, Matthew: "my super admin account just have all of it ... a drop bar function that lets
 * me rotate between editions") ----
 * Every install on this host sits beside the folder traverse-shared/ (outside public_html), which holds installs.json (the list:
 * id = the install's cookie name, its name, its page's address) and hop.key (64 hex characters made on the server, never in git).
 * The super admin's page asks this install for a pass to another; the pass is signed with hop.key, names the person and the
 * install it is for, lasts a minute and works once. The other install checks it, finds ITS OWN super line of the same name and
 * signs that in, as if the code had been typed there. No code travels, and an install with no super of that name refuses.
 * Only the super role (set in the codes files alone) can ask for a pass. */
function hopDir(): string { return dirname(__DIR__, 2) . '/traverse-shared'; }
function hopKey(): string { $k = trim((string) @file_get_contents(hopDir() . '/hop.key')); return preg_match('/^[0-9a-f]{64}$/D', $k) ? $k : ''; }
function hopInstalls(): array {
    $j = json_decode((string) @file_get_contents(hopDir() . '/installs.json'), true);
    $o = [];
    foreach ((array) ($j['installs'] ?? []) as $i) {
        if (!is_array($i)) continue;
        $id = (string) ($i['id'] ?? ''); $url = (string) ($i['url'] ?? ''); $nm = trim((string) ($i['name'] ?? ''));
        if (!preg_match('/^[a-z0-9-]{2,40}$/D', $id) || $nm === '' || !preg_match('#^https?://[^\s"<>]{3,200}$#D', $url)) continue;
        $o[$id] = ['id' => $id, 'name' => substr($nm, 0, 40), 'url' => $url];
    }
    return $o;
}
/* a pass is spent when it is used: its 'j' is kept until the pass would have run out anyway */
function hopSpend(string $j, int $exp): bool {
    $f = hopDir() . '/spent-' . COOKIE . '.json';
    $h = @fopen($f, 'c+'); if (!$h) return false;
    flock($h, LOCK_EX);
    $a = json_decode((string) stream_get_contents($h), true); if (!is_array($a)) $a = [];
    $now = time(); $a = array_filter($a, fn($e) => (int) $e >= $now);
    $fresh = !isset($a[$j]);
    if ($fresh) { $a[$j] = $exp; ftruncate($h, 0); rewind($h); fwrite($h, json_encode($a)); fflush($h); }
    flock($h, LOCK_UN); fclose($h);
    return $fresh;
}

if ($action === 'installs') {
    if (!$isSuper) fail('Not allowed.', 403);
    out(['ok' => true, 'here' => COOKIE, 'installs' => hopKey() === '' ? [] : array_values(hopInstalls())]);
}

if ($action === 'hop') {
    if (!$isPost) fail('POST required', 405);
    if (!$isSuper) fail('Not allowed.', 403);
    $k = hopKey(); $to = (string) ($body['to'] ?? ''); $L = hopInstalls();
    if ($k === '' || !isset($L[$to])) fail('That edition is not set up for switching.', 404);
    if ($to === COOKIE) fail('You are already in this one.');
    $pass = sign(['n' => (string) $session['n'], 'to' => $to, 'exp' => time() + 60, 'j' => bin2hex(random_bytes(12))], $k);
    out(['ok' => true, 'url' => $L[$to]['url'], 'pass' => $pass]);
}

if ($action === 'hopin') {
    if (!$isPost) fail('POST required', 405);
    if (!throttleTake(rateFile('hopin|' . clientKey()), 30, 3600)) fail('Too many switches from here. Wait a while.', 429);
    $k = hopKey(); if ($k === '') fail('Switching is not set up here.', 404);
    $p = verify((string) ($body['pass'] ?? ''), $k);
    if (!$p || ($p['to'] ?? '') !== COOKIE || !isset($p['j'], $p['n']) || (int) $p['exp'] > time() + 120) fail('That switch ran out. Sign in, or switch again.', 401);
    if (!hopSpend((string) $p['j'], (int) $p['exp'])) fail('That switch was already used. Switch again.', 401);
    $hit = null; $hitCode = '';
    foreach ($people as $c => $who) {
        if (($who[1] ?? '') === 'super' && strcasecmp(trim((string) $who[0]), trim((string) $p['n'])) === 0) { $hit = $who; $hitCode = (string) $c; }
    }
    if (!$hit) fail('This edition has no super admin of that name. Sign in with a code.', 403);
    out(startSession($hit, $hitCode, $sessionKey, $sessionDays));
}

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
    out(startSession($hit, $hitCode, $sessionKey, $sessionDays));
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
if (PHP_SAPI === 'cli' && defined('SIXFOLD_CLI') && in_array($action, ['digest', 'skiptrace', 'skiplist', 'skipexport', 'pushcron', 'stormcron', 'jnsync'], true)) {
    /* skiptrace / skiplist / skipexport: tools/skip-trace.php, the same way (2026-10-04) */
    $session = ['n' => $action === 'digest' ? 'Morning email' : 'Command line', 'r' => 'admin', 'c' => ''];
}

/* ---- calendar sync (Matthew 2026-10-11): a person's calendar as an iCalendar feed ----
 * Google Calendar and Apple Calendar subscribe to a link and fetch it themselves (Google every few hours, Apple as set on the
 * phone), so the feed answers with no session: the link carries the person's id and a token made from a per-person salt
 * (DATA_DIR/calfeed.json) and the session key. "New link" changes the salt and the old link stops working. A person who is
 * turned off or removed gets nothing. The feed carries what their calendar screen shows, 30 days back to 4 months ahead:
 * the address and town of walks and come-backs, lead follow-ups by name, their own entries. No phone numbers, no owners. */
function calFeedFile(): string { return DATA_DIR . '/calfeed.json'; }
function calFeedSalt(string $pid, bool $renew = false): ?string {
    $f = calFeedFile(); $lock = @fopen($f . '.lock', 'c'); if ($lock) flock($lock, LOCK_EX);
    $all = json_decode((string) @file_get_contents($f), true); if (!is_array($all)) $all = [];
    if ($renew || empty($all[$pid])) { $all[$pid] = bin2hex(random_bytes(12)); if (!writeJsonAtomic($f, $all)) { if ($lock) { flock($lock, LOCK_UN); fclose($lock); } return null; } }
    if ($lock) { flock($lock, LOCK_UN); fclose($lock); }
    return (string) $all[$pid];
}
function calFeedToken(string $pid, string $salt, string $key): string { return substr(hash_hmac('sha256', 'calfeed|' . $pid . '|' . $salt, $key), 0, 32); }
function icsText(string $s): string { return str_replace(["\\", ';', ',', "\r", "\n"], ['\\\\', '\\;', '\\,', '', '\\n'], $s); }
function icsFold(string $line): string { $out = ''; while (strlen($line) > 74) { $cut = 74; while ($cut > 0 && (ord($line[$cut]) & 0xC0) === 0x80) $cut--; $out .= substr($line, 0, $cut) . "\r\n "; $line = substr($line, $cut); } return $out . $line; }
if ($action === 'calfeed') {
    $pid = (string) ($_GET['p'] ?? ''); $tok = (string) ($_GET['t'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_-]{6,80}$/D', $pid) || !preg_match('/^[0-9a-f]{32}$/D', $tok)) fail('Not found.', 404);
    $all = json_decode((string) @file_get_contents(calFeedFile()), true);
    $salt = is_array($all) ? (string) ($all[$pid] ?? '') : '';
    if ($salt === '' || !hash_equals(calFeedToken($pid, $salt, $sessionKey), $tok)) fail('Not found.', 404);
    $person = null; foreach (acctRows($basePeople, $acct, $sessionKey) as $r) if ($r['id'] === $pid && empty($r['off'])) $person = $r;
    if (!$person) fail('Not found.', 404);
    $who = (string) $person['name'];
    $tz = new DateTimeZone(appTz()); $today = new DateTime('now', $tz);
    $from = (clone $today)->modify('-30 days')->format('Y-m-d'); $to = (clone $today)->modify('+120 days')->format('Y-m-d');
    $co = company(); $visit = ucfirst((string) ($co['visit'] ?? 'visit')); $host = preg_replace('/[^a-z0-9.-]/i', '', (string) ($_SERVER['HTTP_HOST'] ?? 'traverse'));
    $L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//' . str_replace(['/', "\n"], '', (string) $co['name']) . '//Door rounds//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
          'X-WR-CALNAME:' . icsText((string) ($co['short'] ?: $co['name']) . ' · ' . $who), 'X-WR-TIMEZONE:' . appTz(), 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
          ];
    $L = array_merge($L, icsTimezone(appTz()));
    $stamp = gmdate('Ymd\THis\Z');
    foreach (calEventsFor($who, $from, $to) as $e) {
        $d = str_replace('-', '', (string) $e['date']); $t = (string) ($e['time'] ?? '');
        $place = trim((string) ($e['title'] ?? '') . (($e['town'] ?? '') !== '' ? ', ' . $e['town'] : '') . ', ' . market()['state'], ', ');   /* the market's state (2026-10-13, Fable review: it said CO in every market) */
        if ($e['kind'] === 'walk' && !empty($e['dw'])) {   /* the walk desk (2026-10-14) */
            $sum = $visit . ': ' . $e['title']; $loc = (string) $e['addr']; $uid = 'dwalk-' . $e['dw']; $len = 'PT' . max(15, (int) $e['mins']) . 'M';
            $e['note'] = implode("\n", array_filter([$e['phone'] !== '' ? 'Phone: ' . $e['phone'] : '', $e['need'] !== '' ? 'Wants: ' . $e['need'] : '', $e['note'] !== '' ? 'Note: ' . $e['note'] : '', 'Booked by ' . $e['by'] . '. Everything else is in the app.']));
        }
        elseif ($e['kind'] === 'walk') { $sum = $visit . ': ' . $e['title']; $loc = $place; $uid = 'walk-' . $e['region'] . '-' . $e['id']; $len = 'PT1H'; }
        elseif ($e['kind'] === 'revisit') { $sum = 'Come back: ' . $e['title']; $loc = $place; $uid = 'back-' . $e['region'] . '-' . $e['id']; $len = 'PT30M'; }
        elseif ($e['kind'] === 'lead') { $sum = 'Follow up: ' . $e['title'] . (($e['need'] ?? '') !== '' ? ' (' . $e['need'] . ')' : ''); $loc = (string) ($e['town'] ?? ''); $uid = 'lead-' . $e['lead']; $len = 'PT30M'; }
        /* 2026-10-13 (Fable review): a territory for the day (added 2026-10-12, after this feed) has no 'cid', so every one fell into the
           entries branch with the same UID 'own-' and the calendar kept only one of them. Its own UID, by town and neighbourhood. */
        elseif ($e['kind'] === 'terr') { $sum = 'Territory: ' . $e['title']; $loc = (string) ($e['town'] ?? ''); $uid = 'terr-' . $e['region'] . '-' . substr(md5((string) $e['area']), 0, 12); $len = 'PT30M'; }
        else { $sum = (string) $e['title']; $loc = ''; $uid = 'own-' . $e['cid']; $len = 'PT30M'; }
        $L[] = 'BEGIN:VEVENT';
        $L[] = 'UID:' . preg_replace('/[^A-Za-z0-9._-]/', '', $uid) . '@' . $host;
        $L[] = 'DTSTAMP:' . $stamp;
        if ($t !== '' && preg_match('/^\d{2}:\d{2}$/', $t)) { $L[] = 'DTSTART;TZID=' . appTz() . ':' . $d . 'T' . str_replace(':', '', $t) . '00'; $L[] = 'DURATION:' . $len; }
        else { $L[] = 'DTSTART;VALUE=DATE:' . $d; $L[] = 'DTEND;VALUE=DATE:' . (new DateTime($e['date']))->modify('+1 day')->format('Ymd'); $L[] = 'TRANSP:TRANSPARENT'; }
        $L[] = 'SUMMARY:' . icsText($sum);
        if ($loc !== '') $L[] = 'LOCATION:' . icsText($loc);
        if (($e['note'] ?? '') !== '') $L[] = 'DESCRIPTION:' . icsText((string) $e['note']);
        $L[] = 'END:VEVENT';
    }
    $L[] = 'END:VCALENDAR';
    header('Content-Type: text/calendar; charset=utf-8');
    header('Cache-Control: no-cache, private');
    header('Content-Disposition: inline; filename="calendar.ics"');
    echo implode("\r\n", array_map('icsFold', $L)) . "\r\n";
    exit;
}

/* everything past here needs a session */
if (!$session) fail('Sign in first.', 401);
$me   = (string) $session['n'];
$role = (string) ($session['r'] ?? 'crew');
if (!defined('SIXFOLD_CLI') && ($cookieNow = (string) ($_COOKIE[COOKIE] ?? '')) !== '') {
    $tagNow = sessionTag($cookieNow);
    $sessNow = sessLoad();
    if (isset($sessNow['x'][$tagNow])) out(['ok' => false, 'why' => 'elsewhere', 'error' => 'Signed out: your code was used to sign in on another ' . (devClass() === 'm' ? 'phone or tablet' : 'computer') . '. Each code works on one phone and one computer at a time. If that was not you, tell your manager.'], 401);
    $lineNow = $sessNow['s'][$tagNow] ?? null;
    if (!is_array($lineNow) || (int) ($lineNow[2] ?? 0) < time() - SEEN_EVERY) {
        $fresh = [(string) ($session['c'] ?? ''), (int) ($session['exp'] ?? 0), time(), is_array($lineNow) ? (string) ($lineNow[3] ?? deviceName()) : deviceName(), is_array($lineNow) ? devClassOf($lineNow) : devClass()];
        sessEdit(function ($a) use ($tagNow, $fresh) { $a['s'][$tagNow] = $fresh; return $a; });
    }
}

/* ---- in-app texting (2026-10-10, api/sms.php) ----
 * A text goes to a number the homeowner gave: a door phone saved as "given at the door" (anyone who can see the door), a
 * lead (admins, managers, or the lead's owner) or a customer (admins). Never a looked-up number. */
function smsTarget(array $body, string $role, string $me): array {
    $kind = (string) ($body['kind'] ?? ''); $id = (string) ($body['id'] ?? '');
    if ($kind === 'door') {
        $key = (string) ($body['region'] ?? '');
        if (!regionAvailable($key) || !preg_match('/^[a-z0-9-]{1,80}$/D', $id)) return ['err' => 'No such door.'];
        if (!crewSees($role)) return ['err' => 'Not allowed.'];
        $key = doorHome($key, $id); $p = loadPhones($key)[$id] ?? null;
        if (!$p) return ['err' => 'This door has no phone number.'];
        if (($p['source'] ?? '') !== 'door') return ['err' => 'Only a number the homeowner gave at the door can be texted from the app.', 'num' => smsE164((string) $p['phone']), 'blocked' => true];
        return ['num' => smsE164((string) $p['phone']), 'ref' => ['kind' => 'door', 'region' => $key, 'id' => $id]];
    }
    if ($kind === 'lead') {
        $l = leadsAll()[$id] ?? null; if (!$l) return ['err' => 'No such lead.'];
        if (!desk() && $role !== 'manager' && (string) ($l['owner'] ?? '') !== $me) return ['err' => 'Not allowed.'];
        return ['num' => smsE164((string) ($l['phone'] ?? '')), 'ref' => ['kind' => 'lead', 'id' => $id]];
    }
    if ($kind === 'customer') {
        if ($role !== 'admin') return ['err' => 'Not allowed.'];
        $c = loadCustomers()[$id] ?? null; if (!$c) return ['err' => 'No such customer.'];
        return ['num' => smsE164((string) ($c['phone'] ?? '')), 'ref' => ['kind' => 'customer', 'id' => $id]];
    }
    return ['err' => 'Pick who to text.'];
}
if ($action === 'smsthread' || $action === 'smssend') {
    $sc = smsConfig(__DIR__);
    if (!feature('sms')) fail('Texting is not on for this company.', 403);
    $req = $action === 'smssend' ? $body : $_GET;
    $tg = smsTarget($req, $role, $me);
    if (isset($tg['err']) && empty($tg['blocked'])) fail($tg['err'], $tg['err'] === 'Not allowed.' ? 403 : 404);
    $num = $tg['num'] ?? null;
    $ready = smsConfigured($sc);
    $state = ['ready' => $ready, 'num' => $num ? substr($num, 0, 2) . ' ••• ' . substr($num, -4) : null, 'blocked' => $tg['err'] ?? null,
              'optedOut' => $num ? smsOptedOut($num) : false, 'quiet' => smsQuiet($sc), 'quietFrom' => (int) $sc['quiet_end'], 'quietTo' => (int) $sc['quiet_start'],
              'first' => $num ? !smsSentBefore($num) : false];
    if ($action === 'smsthread') {
        $msgs = $num && empty($tg['blocked']) ? array_map(fn($r) => array_intersect_key($r, array_flip(['dir', 'body', 'by', 'at', 'status', 'kw'])), smsThread($num)) : [];
        out(['ok' => true, 'messages' => $msgs] + $state);
    }
    if (!$isPost) fail('POST required', 405);
    if (!empty($tg['blocked'])) fail($tg['err']);
    if (!$ready) fail('Texting is not set up yet: the company\'s Twilio keys are missing.', 503);
    if ($num === null) fail('That is not a US phone number the app can text.');
    if ($state['optedOut']) fail('This number replied STOP. It cannot be texted from the app.');
    if ($state['quiet']) fail('Texts go out between ' . (int) $sc['quiet_start'] . ' am and ' . ((int) $sc['quiet_end'] - 12) . ' pm ' . (market()['key'] === 'co' ? 'Colorado' : 'local') . ' time. Try again then.');
    $text = trim(preg_replace("/[ \t]+/", ' ', (string) ($body['body'] ?? '')) ?? '');
    if ($text === '') fail('Type the message first.');
    if (mb_strlen($text) > SMS_MAX) fail('Keep it under ' . SMS_MAX . ' characters.');
    if ($state['first']) $text .= "\n\n" . $me . ', ' . (string) (company()['name'] ?? '') . '. Reply STOP to opt out.';
    $res = smsSend($sc, $num, $text);
    smsLog(['num' => $num, 'dir' => 'out', 'body' => $text, 'by' => $me, 'at' => time(), 'ref' => $tg['ref'] ?? null,
            'sid' => $res['sid'] ?? '', 'status' => $res['ok'] ? ($res['status'] ?? 'queued') : 'failed'] + ($res['ok'] ? [] : ['error' => $res['error'] ?? '']));
    if (!$res['ok']) fail($res['error'] ?? 'Not sent. Try again.', 502);
    out(['ok' => true, 'message' => ['dir' => 'out', 'body' => $text, 'by' => $me, 'at' => time(), 'status' => $res['status'] ?? 'queued']]);
}

/* the tap log (2026-10-12): [{s: screen, t: tap label or '', at, d: 'p'|'d'}], at most 200 a post and 3,000 a person a day,
   appended to taplog-YYYY-MM.log beside the data. Labels are cleaned on the phone; cleaned again here. */
if ($action === 'taplog') {
    if (!$isPost || !$session) fail('Not allowed.', 403);
    $ev = is_array($body['ev'] ?? null) ? array_slice($body['ev'], 0, 200) : [];
    $cf = rateFile('taplog|' . (string) ($session['c'] ?? $me)); if (!throttleTake($cf, 300, 86400)) out(['ok' => true, 'kept' => 0]);
    $lines = '';
    foreach ($ev as $e) {
        if (!is_array($e)) continue;
        $s = preg_replace('/[^a-z0-9_-]/', '', strtolower((string) ($e['s'] ?? ''))); $t = trim(preg_replace('/\s+/', ' ', (string) ($e['t'] ?? '')));
        if (preg_match('/\d/', $t)) $t = '(an item)';
        $t = mb_substr($t, 0, 40); $at = (int) ($e['at'] ?? time()); if ($at < time() - 7 * 86400 || $at > time() + 600) $at = time();
        $lines .= json_encode(['w' => $me, 'r' => $role, 's' => substr($s, 0, 24), 't' => $t, 'd' => ($e['d'] ?? '') === 'd' ? 'd' : 'p', 'at' => $at], JSON_UNESCAPED_UNICODE) . "\n";
    }
    if ($lines !== '') @file_put_contents(DATA_DIR . '/taplog-' . date('Y-m') . '.log', $lines, FILE_APPEND | LOCK_EX);
    out(['ok' => true]);
}
if ($action === 'taplogread') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $days = max(1, min(60, (int) ($_GET['days'] ?? 7))); $since = time() - $days * 86400; $rows = [];
    foreach ([date('Y-m'), date('Y-m', strtotime('first day of last month'))] as $m) {
        $f = DATA_DIR . '/taplog-' . $m . '.log'; if (!is_readable($f)) continue;
        foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $l) { $r = json_decode($l, true); if (is_array($r) && ($r['at'] ?? 0) >= $since) $rows[] = $r; }
    }
    usort($rows, fn($x, $y) => $y['at'] <=> $x['at']);
    out(['ok' => true, 'days' => $days, 'rows' => array_slice($rows, 0, 20000)]);
}
if ($action === 'me') out(['ok' => true, 'name' => $me, 'role' => $role, 'walker' => !empty($acct['walker'][(string) ($session['c'] ?? '')]), 'super' => $isSuper, 'sid' => sessionTag((string) ($_COOKIE[COOKIE] ?? '')), 'avatar' => avatarVer((string) ($session['c'] ?? ''))]);

/* the Sample door (Matthew 2026-10-05): one made-up door with every part of the card filled in, admins only. Kept in the
   private data folder because its address is a real one; the page holds no copy. Nothing the page does to it is sent back. */
/* teams (2026-10-05): who is on whose team, worked out once per request; the functions and actions are further down */
/* 'office' (2026-10-14, the walk desk): calls, emails and booking walks, nothing else of the admin's; only where features.walkdesk is on */
define('ROLES', feature('walkdesk') ? ['crew', 'office', 'manager', 'admin'] : ['crew', 'manager', 'admin']);
$TEAM = teamInfo($basePeople, $acct, $sessionKey);
$myTeam = (string) ($TEAM['byName'][$me]['team'] ?? '');

/* ---- profile photos (Matthew 2026-10-05) ----
 * Each person may put up a photo of themselves; it takes the place of their initials in the corner. The phone makes it a
 * 256 px square JPEG first. Kept beside the website (sixfold-data/rounds/avatars/<account id>.jpg), filed by account so a
 * rename keeps it, and served only to people signed in. */
function avatarDir(): string { return DATA_DIR . '/avatars'; }
function avatarVer(string $id): int { $f = avatarDir() . '/' . $id . '.jpg'; return (preg_match('/^[0-9a-f]{20}$/D', $id) && is_file($f)) ? (int) filemtime($f) : 0; }
if ($action === 'avatar' || $action === 'avatardel') {
    if (!$isPost) fail('POST required', 405);
    $pid = (string) ($session['c'] ?? '');
    if (!preg_match('/^[0-9a-f]{20}$/D', $pid)) fail('Sign in first.', 401);
    $af = avatarDir() . '/' . $pid . '.jpg';
    if ($action === 'avatardel') { @unlink($af); out(['ok' => true, 'avatar' => 0]); }
    $raw = (string) file_get_contents('php://input');
    if (strlen($raw) < 300 || strlen($raw) > 400000) fail('Use a photo under 400 KB (the app shrinks it first).');
    $info = @getimagesizefromstring($raw);
    if (!$info || $info[2] !== IMAGETYPE_JPEG || $info[0] > 1024 || $info[1] > 1024) fail('That is not a photo the app can use.');
    if (!is_dir(avatarDir()) && !@mkdir(avatarDir(), 0755, true)) fail('Could not save that. Try again.', 500);
    if (@file_put_contents($af, $raw, LOCK_EX) === false) fail('Could not save that. Try again.', 500);
    clearstatcache();
    out(['ok' => true, 'avatar' => avatarVer($pid)]);
}
if ($action === 'avatarget') {
    $who = trim((string) ($_GET['who'] ?? ''));
    $pid = $who === '' ? (string) ($session['c'] ?? '') : (string) ($TEAM['byName'][$who]['id'] ?? '');
    $af = avatarDir() . '/' . $pid . '.jpg';
    if (!preg_match('/^[0-9a-f]{20}$/D', $pid) || !is_file($af)) fail('No photo.', 404);
    header('Content-Type: image/jpeg');
    header('Cache-Control: private, max-age=86400');   /* the page asks with ?v=<when it changed>, so a new photo shows at once */
    header('Content-Length: ' . filesize($af));
    readfile($af);
    exit;
}

if ($action === 'sample') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $j = json_decode((string) @file_get_contents(DATA_DIR . '/sample-door.json'), true);
    if (!is_array($j) || !is_array($j['door'] ?? null)) fail('No sample door on the server yet.', 404);
    out(['ok' => true] + $j);
}

if ($action === 'diag') {
    /* ⚑ Added after the first live deploy returned an empty list with no reason.
       Silence is the worst diagnostic: say which directory was looked in and what
       is actually there. Admin only — the paths are infrastructure detail. */
    if ($role !== 'admin') fail('Not allowed.', 403);
    $expected = dirname(__DIR__, 2) . '/sixfold-data/rounds';
    out(['ok' => true,
        'memory_limit' => ini_get('memory_limit'),   /* 2026-10-08: what the host granted (the script asks for 256M) */
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
/* the four biggest streets of each neighbourhood in one town (2026-10-09): only the desktop picker's search uses them, so they left
   the towns answer (409 KB of Security's) and come here when someone searches that town. Same towns as the towns answer. */
if ($action === 'streets') {
    $key = (string) ($_GET['region'] ?? '');
    if (!preg_match('/^[a-z0-9-]{1,40}$/D', $key) || !($data = loadRegion($key))) fail('No such region.', 404);
    $out = [];
    foreach ($data['areas'] as $a) {
        $streets = [];
        foreach ($a['doors'] as $d) { $sn = streetName((string) ($d['address'] ?? '')); if ($sn !== '') $streets[$sn] = ($streets[$sn] ?? 0) + 1; }
        $out[$a['name']] = topStreets($streets, 4);
    }
    out(['ok' => true, 'region' => $key, 'streets' => $out]);
}

if ($action === 'regions') {
    if (!is_readable(DATA_DIR . '/index.json')) {
        fail('The door lists are not on this server yet. Sign in as admin and open ?action=diag to see where it looked.', 503);
    }
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $regions = [];
    $today = (new DateTime('now', new DateTimeZone(appTz())))->format('Y-m-d');
    /* a ready-made answer (2026-10-09, Matthew: the app ran slowly; this answer took 1.5 s in an edition every time): built once and
       kept until something it reads changes (any door file, log or settings file in the data folder, by name, size and time), the
       day turns, or the code changes. One per kind of viewer: what it shows differs only by admin or not and whether crew see scores. */
    $rkind = ($role === 'admin' ? 'a' : 'c') . (crewSees($role) ? '1' : '0') . ((TERRITORIES_OPEN || $role === 'admin') ? 't' : 'n');
    $rsig = [$today, (string) @filemtime(__FILE__)];
    /* files written on timers that the towns answer never reads (Fable review 2026-10-09: the alerts cron rewrote alerts-cache.json
       every few minutes, so the kept answer rarely lived past ten) */
    $rskip = array_flip(['alerts-cache.json', 'push-sent.json', 'push.log', 'storms-recent.json', 'climate-cache.json', 'secmap-cache.json', 'storm-refresh.json', 'calendar.log']);
    foreach (array_merge(glob(DATA_DIR . '/*.json') ?: [], glob(DATA_DIR . '/*.log') ?: [], glob(DATA_DIR . '/docs/*.json') ?: []) as $rf) {
        $bn = basename($rf); if (strpos($bn, 'regions-cache-') === 0 || strpos($bn, 'best-') === 0 || isset($rskip[$bn])) continue;
        $rsig[] = $bn . ':' . (string) @filesize($rf) . ':' . (string) @filemtime($rf);
    }
    $cf0 = custDir() . '/customers.log'; $rsig[] = 'customers:' . (string) @filesize($cf0) . ':' . (string) @filemtime($cf0);   /* customers leave the counts (2026-10-13) */
    $rsig = md5(implode('|', $rsig)); $rcache = DATA_DIR . '/regions-cache-' . $rkind . '.json';
    /* the kept answer is sent as the text it was written as (2026-10-09, speed): decoding 1.7 MB of JSON and encoding it again
       took 160 ms of every request. The file is {"sig":...,"regions":[...]}, written whole or not at all (writeTextAtomic),
       so a matching head and a closing ]} is the whole check. */
    $rc = (string) @file_get_contents($rcache); $rhead = '{"sig":"' . $rsig . '","regions":';
    if (strncmp($rc, $rhead, strlen($rhead)) === 0 && substr($rc, -2) === ']}') sendJson('{"ok":true,"regions":' . substr($rc, strlen($rhead), -1) . ',"cached":true}');
    unset($rc);
    $segT = []; $segB = [];                  /* SX-54: conversations and quotes per kind of door, across every town */
    /* the county each town is in, from the funding sheet (one list to keep up to date) */
    $countyOf = (json_decode((string) @file_get_contents(DATA_DIR . '/docs/money.json'), true) ?: [])['counties'] ?? [];
    foreach (($idx['regions'] ?? []) as $r) {
        $data = loadRegion($r['key']);
        if (!$data) continue;
        $marks = loadMarks($r['key']);
        $aflags = loadAreaFlags($r['key']);
        $lfix = loadLawnFix($r['key']); $custOpen ??= customerDoors();
        $assign = (TERRITORIES_OPEN || $role === 'admin') ? loadAssign($r['key']) : [];
        $aday = $assign ? assignDays($r['key']) : [];
        /* best neighbourhoods (2026-10-07): each door's points for this edition's trade, cached per town */
        $bestT = crewSees($role) ? company()['best'] : null; $bq = null; $bp = $bestT ? bestTownPoints($bestT, $r['key'], $data, $bq) : null;   /* admins plan territories now; the crew see theirs once TERRITORIES_OPEN is true */
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
            $lawnL = 0; $lawnM = 0; $lawnS = 0; $cgN = 0;   /* cgN: townhome lots, the HOA keeps the lawn (2026-10-13) */      /* large / medium / small lawns STILL TO KNOCK, for the lawn sort (small: 2026-10-12, aeration) */
            $bestN = 0; $bestS = 0;                  /* doors still to knock with reasons for this trade, and their points (2026-10-07) */
            $scSum = 0; $scN = 0; $sc8 = 0;         /* their 1-10 door scores: the average and how many are 8 or more (2026-10-09) */
            $all3 = 0;                               /* still to knock with all three: high fire, large or medium lawn, trees against or heavy (2026-10-04) */
            $aseg = [];                              /* SX-54: doors still to knock, per kind of door */
            foreach ($a['doors'] as $d) {
                $m = freshMark($d, $marks[$d['id']] ?? null);
                $f = (int) ($d['fire'] ?? 0);
                if (isset($d['lat'], $d['lon']) && is_numeric($d['lat']) && is_numeric($d['lon'])) { $sla += $d['lat']; $slo += $d['lon']; $nll++; }
                $isDue = $m && $m['outcome'] === 'later' && ($m['revisit'] ?? '') !== '' && $m['revisit'] <= $today;
                /* a no-answer still counts as needing a knock (SX-9b rule), even during its 2-day rest */
                $open = (!$m || $m['outcome'] === 'miss' || $isDue) && !isset($custOpen[$r['key'] . '/' . $d['id']]);   /* an active customer is not a door to knock (2026-10-13) */
                if ($open && ($f === 4 || $f === 5)) { $hot++; if ($f === 5) $vhot++; }
                if (!empty($d['cg'])) $cgN++;
                if ($open && empty($d['cg'])) { $lv = lawnLevel($d, $lfix); if ($lv === 'L') $lawnL++; elseif ($lv === 'M') $lawnM++; elseif ($lv === 'S') $lawnS++; }
                if ($open) { $tl = treeLevel($d); if ($tl === 'against') $treeA++; elseif ($tl === 'heavy') $treeH++; }
                if ($open && ($f === 4 || $f === 5) && in_array(lawnLevel($d, $lfix), ['L', 'M'], true) && in_array(treeLevel($d), ['against', 'heavy'], true)) $all3++;
                if ($open && $bp !== null) {
                    $pt = (int) ($bp[(string) $d['id']] ?? 0);
                    if ($bestT === 'yards') { $pt += (!empty($d['cg']) && !isset($lfix[$d['id']])) ? -3 : yardsLawnPts(lawnLevel($d, $lfix)); }   /* a townhome lot is no owner's lawn, unless the crew says otherwise (2026-10-13) */   /* live: crews correct lawns */
                    if ($pt > 0) { $bestN++; $bestS += $pt; }
                    if ($bq !== null) { $s10 = doorScore10($bestT, $pt, $bq[(string) $d['id']] ?? [0, 0.5]); $scSum += $s10; $scN++; if ($s10 >= 8) $sc8++; }
                }
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
            $areas[] = areaCompact(['name' => $a['name'], 'avg' => $a['avg'], 'total' => count($a['doors']),
                        'done' => $done, 'noanswer' => $noanswer, 'hot' => $hot, 'vhot' => $vhot, 'due' => $due, 'retry' => $retry, 'booked' => $booked,
                        'nosol' => flagSummary(flagsOver($a['doors'], $aflags)),
                        'la' => $nll ? round($sla / $nll, 4) : null, 'lo' => $nll ? round($slo / $nll, 4) : null,   /* 4 places: about 10 m, plenty for a neighbourhood's centre */
                        'lawnL' => $lawnL, 'lawnM' => $lawnM, 'lawnS' => $lawnS, 'cg' => $cgN, 'treeA' => $treeA, 'treeH' => $treeH, 'all3' => $all3, 'place' => $a['place'] ?? null, 'fw' => $a['fw'] ?? null,
                        'who' => $assign[$a['name']] ?? null,   /* the streets come from ?action=streets, one town at a time */
                        'on' => $aday[$a['name']] ?? null,      /* the day it is assigned for (2026-10-12) */
                        'cwpp' => !empty($a['place']['n']) ? (cwppPlaces()[strtolower((string) $a['place']['n'])] ?? null) : null,
                        '_seg' => $aseg] + ($bp !== null ? ['bestN' => $bestN, 'bestS' => $bestS] : []) + ($scN ? ['sc' => round($scSum / $scN, 1), 'sc8' => $sc8, 'scn' => $scN] : []));
        }
        $regions[] = ['key' => $r['key'], 'label' => $r['label'], 'county' => $countyOf[$r['key']] ?? ($r['county'] ?? null), 'areas' => $areas];
        unset($data, $bp, $areas);   /* free this town before the next is read (2026-10-08): two big towns at once passed 96 MB */
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
    $rtxt = (string) json_encode($regions, JSON_UNESCAPED_SLASHES);   /* encoded once, for the file and the answer alike */
    writeTextAtomic($rcache, $rhead . $rtxt . '}');
    sendJson('{"ok":true,"regions":' . $rtxt . '}');
}

if ($action === 'area') {
    $key  = (string) ($_REQUEST['region'] ?? '');
    $name = (string) ($_REQUEST['area'] ?? '');
    /* several at once (2026-10-11, Matthew: the Plan was slow): POST {region, areas: [...]}, up to 40, answered as {many: [...]}.
       The town's logs and side files are read once for all of them instead of once per neighbourhood. */
    $names = ($isPost && isset($body['areas']) && is_array($body['areas'])) ? array_values(array_unique(array_filter(array_map('strval', $body['areas']), fn($x) => $x !== ''))) : [$name];
    if ($isPost && isset($body['region'])) $key = (string) $body['region'];
    if (count($names) > 40) fail('Ask for 40 neighbourhoods at most.');
    $many = $isPost && isset($body['areas']);
    /* just this neighbourhood, from the town's split cache (TR-7, 2026-10-10); the whole town only when the cache can't be made */
    if (!regionAvailable($key)) fail('No such region.', 404);
    $split = townSplit($key);
    if ($split) { $pick = []; foreach ($names as $nm0) { $one = areaOf($split, $nm0); if ($one) $pick[] = $one; } $data = $split['top'] + ['areas' => $pick]; }
    else $data = loadRegion($key);
    if (!$data) fail('No such region.', 404);
    $marks = loadMarks($key);
    $phones = loadPhones($key); $phoneX = loadPhoneExtras($key);
    $notes = loadNotes($key);
    $lfix = loadLawnFix($key);
    $emails = loadEmails($key);
    $photos = loadPhotos($key);
    $work = loadWork($key);
    $fchk = loadFireChecks($key);
    $walks = loadWalks($key);
    $custDoors = customerDoors();   /* the crew see the tag on the door (plan and start date only, no contact details) */
    $repOf = (TERRITORIES_OPEN || $role === 'admin' || $role === 'manager') ? loadDoorAssign($key) : [];   /* doors assigned to one person (2026-10-08) */
    /* skip-trace results ride along for admins only (crew too if the config says crew_see); every number carries its DNC answer */
    $placeOf = skipMail($key);   /* id => {c: city, z: ZIP, m: mailing}; only c and z are sent */
    $traces = ($role === 'admin' || !empty(skipConfig(__DIR__)['crew_see'])) ? skipLoad($key) : [];
    /* the side files are read for this neighbourhood's doors only (2026-10-08): whole, the big towns' files needed 220-320 MB */
    $only = [];
    foreach ($data['areas'] as $a0) if (in_array($a0['name'], $names, true)) foreach ($a0['doors'] as $d0) $only[(string) $d0['id']] = true;
    $hailOf = hailOn($role) ? loadSide('hail', $key, $only) : [];   /* admins only: storms near the house, newest first */
    $hrepOf = hailOn($role) ? loadSide('hailrep', $key, $only) : [];   /* measured on the ground (2026-10-12) */
    $hrecent = hailOn($role) ? hailRecentReports() : [];
    $roofOf = roofDataOn($role) ? loadSide('roof', $key, $only) : []; $bldOf = roofDataOn($role) ? loadSide('year', $key, $only) : [];
    $photoOf = roofDataOn($role) ? loadSide('photo', $key, $only) : [];
    $olOf = roofDataOn($role) ? loadSide('outline', $key, $only) : [];   /* the building's outline on the roof photo (2026-10-06, data-pipeline/door-territory/roofs/outline-photos.mjs) */
    $windOf = hailOn($role) ? loadSide('wind', $key, $only) : [];
    $matOf = roofDataOn($role) ? loadSide('material', $key, $only) : [];
    $mfxOf = loadMatFix($key);
    $solarOf = solarOn($role) ? loadSide('solar', $key, $only) : [];
    /* re-roof and solar permits (2026-10-07, permits/build-permits.mjs): admins, where the company sells roofs or solar */
    $permOf = (crewSees($role) && (feature('roof') || feature('solar'))) ? loadSide('permit', $key, $only) : [];
    /* FEMA's National Risk Index for the door's census tract (2026-10-07, nri/build-nri.mjs): the editions only, admins */
    $nriF = (crewSees($role) && company()['best'] !== null) ? (json_decode((string) @file_get_contents(DATA_DIR . '/nri-' . $key . '.json'), true) ?: []) : [];
    /* the Census Bureau's survey for the door's block group (2026-10-07, census/build-census.mjs): the editions only, admins */
    $cenF = (crewSees($role) && company()['best'] !== null) ? (json_decode((string) @file_get_contents(DATA_DIR . '/census-' . $key . '.json'), true) ?: []) : [];
    $cenOf = function (string $id) use ($cenF) { $b = $cenF['doors'][$id] ?? null; return $b !== null && isset($cenF['bgs'][$b]) ? $cenF['bgs'][$b] + ['ver' => $cenF['ver'] ?? ''] : null; };
    $nriOf = function (string $id) use ($nriF) { $t = $nriF['doors'][$id] ?? null; return $t !== null && isset($nriF['tracts'][$t]) ? $nriF['tracts'][$t] + ['v' => $nriF['ver'] ?? ''] : null; };
    /* the door's power company in figures (2026-10-07): EIA-861 price, bill, solar homes, outages, time-of-use; solar-utilities.json */
    $solarU = $solarOf ? (json_decode((string) @file_get_contents(DATA_DIR . '/solar-utilities.json'), true) ?: []) : [];
    $solarRow = function ($sv) use ($solarU) {
        if (is_array($sv) && isset($sv['ui'], $solarU['u'][$sv['ui']])) $sv['uf'] = $solarU['u'][$sv['ui']] + ['yr' => $solarU['year'] ?? null, 'co' => $solarU['co'] ?? null];
        return $sv;
    };
    $pestOf = []; $custPts = []; $bookPts = []; $notePts = []; $posOf = [];
    $secOf = securityOn($role) ? loadSide('security', $key, $only) : [];
    if (pestOn($role) || securityOn($role)) {
        $pestOf = pestOn($role) ? loadSide('pest', $key, $only) : [];
        /* every door's position in the town (customers, bookings and notes nearby are counted town-wide) */
        if ($split) $posOf = townPositions($split);
        else foreach ($data['areas'] as $a0) foreach ($a0['doors'] as $d0) if (isset($d0['lat'], $d0['lon'])) $posOf[$d0['id']] = [(float) $d0['lat'], (float) $d0['lon']];
        foreach (customerDoors() as $dk => $_) { $pp = explode('/', (string) $dk, 2); if (count($pp) === 2 && $pp[0] === $key && isset($posOf[$pp[1]])) $custPts[$pp[1]] = $posOf[$pp[1]]; }
        $since = time() - 30 * 86400;
        foreach ($marks as $mid => $mk) if (($mk['outcome'] ?? '') === 'booked' && (int) ($mk['at'] ?? 0) >= $since && isset($posOf[$mid])) $bookPts[$mid] = $posOf[$mid];
        foreach ($work as $wid => $wk) if ((int) ($wk['at'] ?? 0) >= $since && isset($posOf[$wid])) $notePts[$wid] = [$posOf[$wid], $wk['tags']];
    }
    $nearby = function (array $a, array $b): bool { $dy = ($a[0] - $b[0]) * 111000; $dx = ($a[1] - $b[1]) * 111000 * cos(deg2rad($a[0])); return $dx * $dx + $dy * $dy <= 160 * 160; };
    $naipOf = roofDataOn($role) ? loadSide('naip', $key, $only) : [];   /* the 2023 roof close-up window for every house (2026-10-05) */   /* what someone at the house said the roof is (everyone sees it) */   /* roof material: county record or the photo classifier (2026-10-05) */   /* damaging wind reported near the house (2026-10-05), with hail */   /* [file, x, y, half-window] in the 2020 3-inch photos */
    $answers = [];
    foreach ($data['areas'] as $a) {
        if (!in_array($a['name'], $names, true)) continue;
        $doors = [];
        foreach ($a['doors'] as $d) {
            $m0 = $marks[$d['id']] ?? null; $m = freshMark($d, $m0);
            $p = $phones[$d['id']] ?? null;
            $n = $notes[$d['id']] ?? null;
            $em = $emails[$d['id']] ?? null;
            $pestRow = null; $secRow = null;
            if (pestOn($role) || securityOn($role)) {
                $pp = $posOf[$d['id']] ?? null; $nb = 0; $bk = 0; $tg = [];
                if ($pp) {
                    foreach ($custPts as $ci => $cp) if ($ci !== $d['id'] && $nearby($pp, $cp)) $nb++;
                    foreach ($bookPts as $bi => $bp) if ($bi !== $d['id'] && $nearby($pp, $bp)) $bk++;
                    foreach ($notePts as $ni => $nt) if ($ni !== $d['id'] && $nearby($pp, $nt[0])) foreach ($nt[1] as $t) $tg[$t] = ($tg[$t] ?? 0) + 1;
                }
                $near = ['nb' => $nb, 'bk' => $bk] + ($tg ? ['tg' => $tg] : []);
                if (pestOn($role)) $pestRow = ($pestOf[$d['id']] ?? []) + $near;
                if (securityOn($role)) $secRow = ($secOf[$d['id']] ?? []) + $near;
            }
            $doors[] = [
                'id' => $d['id'], 'address' => $d['address'], 'acres' => $d['acres'], 'owner' => $d['owner'],
                'lat' => $d['lat'] ?? null, 'lon' => $d['lon'] ?? null,
                'fire' => $d['fire'] ?? null,
                'mark' => $m ? ['outcome' => $m['outcome'], 'by' => $m['by'], 'revisit' => $m['revisit'] ?? '', 'qs' => !empty($m['qs']) ? 1 : 0,
                               'retry' => $m['outcome'] === 'miss' ? missRetry($m) : ''] + ownerFlag($d, $m) : null,
                'phone' => $p ? ['phone' => $p['phone'], 'source' => $p['source'], 'seen' => $p['seen'],
                                 'by' => $p['by'], 'at' => $p['at']] + ownerFlag($d, $p) + (isset($p['dnc']) ? ['dnc' => $p['dnc']] : []) : null,
                'phones2' => $phoneX[$d['id']] ?? null,   /* extra numbers (2026-10-12) */
                'trace' => isset($traces[$d['id']]) ? skipPublic($traces[$d['id']]) : null,
                'hail' => hailWithHours($hailOf[$d['id']] ?? null, $key), 'wind' => windRows($windOf[$d['id']] ?? null),
                'hrep' => hailRepRows($hrepOf[$d['id']] ?? null, $hrecent, $d),
                'roof' => $roofOf[$d['id']] ?? null, 'bld' => $bldOf[$d['id']] ?? null, 'mat' => $matOf[$d['id']] ?? null, 'matfix' => $mfxOf[$d['id']] ?? null, 'naip' => $naipOf[$d['id']] ?? null, 'ol' => olRows($olOf[$d['id']] ?? null), 'photo' => $photoOf[$d['id']] ?? null, 'solar' => $solarRow($solarOf[$d['id']] ?? null), 'permit' => $permOf[$d['id']] ?? null, 'nri' => $nriOf((string) $d['id']), 'cen' => $cenOf((string) $d['id']), 'pest' => $pestRow, 'sec' => $secRow,
                'city' => $placeOf[$d['id']]['c'] ?? null, 'zip' => $placeOf[$d['id']]['z'] ?? null,   /* for Look up number (2026-10-04); the mailing address stays on the server */
                'note' => $n ? ['note' => $n['note'], 'by' => $n['by'], 'at' => $n['at']] + ownerFlag($d, $n) : null,
                'os' => $d['os'] ?? null,
                'prevMark' => ($m0 && !$m) ? ['outcome' => $m0['outcome'], 'by' => $m0['by'], 'at' => $m0['at']] : null,
                'lawn' => $d['lawn'] ?? null, 'cg' => !empty($d['cg']) ? 1 : null,   /* a townhome lot: the lawn around it is the HOA's (2026-10-13) */
                'lawnfix' => $lfix[$d['id']] ?? null,
                'trees' => $d['trees'] ?? null,
                'val' => $d['val'] ?? null,
                'com' => $d['com'] ?? null,   /* commercial test buildings (admin-only towns): use, roof size, owner lead */
                'work' => $work[$d['id']] ?? null,
                'fc' => isset($fchk[$d['id']]) ? lastChecks($fchk[$d['id']]) : null,
                'walk' => walkFor($m, $walks[$d['id']] ?? null),
                'cust' => $custDoors[$key . '/' . $d['id']] ?? null,
                'rep' => $repOf[$d['id']] ?? null,
                'email' => $em ? $em + ownerFlag($d, $em) : null,
                'photos' => $photos[$d['id']] ?? [],
            ];
        }
        $answers[] = ['ok' => true, 'area' => $a['name'], 'avg' => $a['avg'], 'doors' => $doors, 'rest' => MISS_REST_DAYS, 'place' => $a['place'] ?? null, 'fw' => $a['fw'] ?? null,
             'hoa' => hoaFor($a['place'] ?? null),   /* the subdivision's registered HOA (2026-10-12) */
             'nosol' => flagSummary(flagsOver($a['doors'], loadAreaFlags($key))),
             /* whose permits cover this town and for which years (2026-10-07): lets the card say "no re-roof permit since 2016" */
             'perm' => $permOf || (crewSees($role) && (feature('roof') || feature('solar'))) ? ((json_decode((string) @file_get_contents(DATA_DIR . '/permit-index.json'), true) ?: [])[$key] ?? null) : null];
    }
    viewCount(array_sum(array_map(fn($x) => count($x['doors']), $answers)));
    if ($many) out(['ok' => true, 'many' => $answers]);
    if ($answers) out($answers[0]);
    fail('No such neighbourhood.', 404);
}

if ($action === 'mark') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    $out = $body['outcome'] ?? null;                              // null = undo
    if (!regionAvailable($key)) fail('No such region.', 404);
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
    /* 2026-10-12 (Matthew: "a quote sent, and walk booked options ... instead of the quote booked"): both are a booked door, so every
       count, goal and leaderboard stays as it was; Quote sent also ticks the door's quote as sent (the Pipeline's Quote sent stage),
       for a quote given at the door with no walk to book */
    $qs = $out === 'booked' && !empty($body['qs']);
    if ($qs) $row['qs'] = 1;
    $ok = appendMark($key, $row);
    if (!$ok) fail('Could not save that. Try again.', 500);
    /* the quote-sent tick follows the door's mark as it now stands (an undo brings back the mark before): on while that mark is
       Quote sent, off when it is not, but only a tick a door made comes off; a tick an admin set stays */
    $cur = loadMarks($key)[$id] ?? null; $curQs = $cur && $cur['outcome'] === 'booked' && !empty($cur['qs']);
    $qn = loadQuoted($key)[$id] ?? null;
    if ($curQs && !$qn) appendQuoted($key, ['id' => $id, 'quoted' => true, 'by' => $me, 'at' => $row['at'], 'src' => 'door']);
    elseif (!$curQs && $qn && ($qn['src'] ?? '') === 'door') appendQuoted($key, ['id' => $id, 'quoted' => null, 'by' => $me, 'at' => $row['at']]);
    out(['ok' => true]);
}

if ($action === 'phone') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    if (!regionAvailable($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    $mode = (string) ($body['mode'] ?? '');
    if ($mode === 'add' || $mode === 'del') {                    /* an extra number (2026-10-12) */
        $digits = preg_replace('/\D/', '', (string) ($body['phone'] ?? ''));
        if (strlen($digits) === 11 && $digits[0] === '1') $digits = substr($digits, 1);
        if (!preg_match('/^[2-9]\d{2}[2-9]\d{6}$/D', $digits)) fail('That is not a valid 10-digit US number.');
        if ($mode === 'add') {
            $label = (string) ($body['label'] ?? 'other'); if (!in_array($label, PHONE_LABELS, true)) $label = 'other';
            $source = (string) ($body['source'] ?? 'door'); if (!in_array($source, PHONE_SOURCES, true)) fail('Pick where the number came from.');
            $have = loadPhoneExtras($key)[$id] ?? [];
            if (count($have) >= PHONE_EXTRAS && !in_array($digits, array_column($have, 'phone'), true)) fail('A door holds up to ' . (PHONE_EXTRAS + 1) . ' numbers. Remove one first.');
            if (($p0 = loadPhones($key)[$id] ?? null) && $p0['phone'] === $digits) fail('That is already the main number.');
            $row = ['id' => $id, 'mode' => 'add', 'phone' => $digits, 'label' => $label, 'source' => $source, 'by' => $me, 'at' => tapTime($body)];
        } else $row = ['id' => $id, 'mode' => 'del', 'phone' => $digits, 'by' => $me, 'at' => tapTime($body)];
        if (!appendPhone($key, $row)) fail('Could not save that. Try again.', 500);
        out(['ok' => true, 'extras' => loadPhoneExtras($key)[$id] ?? []]);
    }
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
    if (!regionAvailable($key)) fail('No such region.', 404);
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
    if (!regionAvailable($key)) fail('No such region.', 404);
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
    $f = (new DateTime('now', new DateTimeZone(appTz())))->format('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.jpg';
    if (@file_put_contents($dir . '/' . $f, $bin, LOCK_EX) === false) fail('Could not save that. Try again.', 500);
    if (!appendPhotoLog($key, ['id' => $id, 'f' => $f, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'f' => $f]);
}

if ($action === 'photoget') {
    $key = (string) ($_GET['region'] ?? '');
    $id  = (string) ($_GET['id'] ?? '');
    $f   = (string) ($_GET['f'] ?? '');
    if (!regionAvailable($key) || !preg_match('/^[a-z0-9-]{1,80}$/D', $id) || !validPhotoName($f)) fail('No such photo.', 404);
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
    if (!regionAvailable($key) || !preg_match('/^[a-z0-9-]{1,80}$/D', $id) || !validPhotoName($f)) fail('No such photo.', 404);
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
    $tz = new DateTimeZone(appTz());
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
    $who = whoFor((string) ($_REQUEST['who'] ?? ''));
    /* a manager's Team stats: their team, all at once (team=1) */
    if ($role === 'manager' && !empty($_REQUEST['team']) && trim((string) ($_REQUEST['who'] ?? '')) === '') $who = '';
    $list = teamDays($days, $who);
    if ($role === 'manager' && $who === '') $list = array_values(array_filter($list, fn($p) => $p['name'] === $me || sameTeam($p['name'])));
    out(['ok' => true, 'days' => $days, 'today' => (new DateTime('now', new DateTimeZone(appTz())))->format('Y-m-d'), 'who' => $who, 'people' => $list, 'goal' => $who !== '' ? (loadPGoals()[$who] ?? null) : null, 'company' => loadGoals()]);
}

/* ---- my doors (2026-10-02) ------------------------------------------------
 * Every door one person acted on in the window: marked, or gave a phone, email, note
 * or photo. A mark that was put back (a mistake) does not count. Each row carries what THEY last did and what the door shows
 * NOW, so the page can tell "still yours" from "since changed by someone else".
 * Crew see their own; an admin may ask for anyone's (who=). Newest first. */
if ($action === 'mydoors') {
    $days = max(1, min(120, (int) ($_REQUEST['days'] ?? 30)));
    $who = whoFor((string) ($_REQUEST['who'] ?? ''));
    if ($who === '') $who = $me;
    $since = (new DateTime('today', new DateTimeZone(appTz())))->modify('-' . ($days - 1) . ' days')->getTimestamp();
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
    out(['ok' => true, 'who' => $who, 'days' => $days, 'today' => (new DateTime('now', new DateTimeZone(appTz())))->format('Y-m-d'), 'doors' => $rows]);
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
    if (!regionAvailable($key)) fail('No such region.', 404);
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
/* the HOAs registered under a subdivision's name (state HOA roster, hoa-communities.json): up to three, for the door card */
function hoaFor($place): ?array {
    static $hoa = null;
    if ($hoa === null) $hoa = json_decode((string) @file_get_contents(DATA_DIR . '/hoa-communities.json'), true)['places'] ?? [];
    $n = is_array($place) ? strtolower(trim((string) ($place['n'] ?? ''))) : '';
    if ($n === '' || empty($hoa[$n])) return null;
    return array_map(fn($h) => ['hoa' => (string) ($h['hoa'] ?? ''), 'units' => (int) ($h['units'] ?? 0), 'mgmt' => (string) ($h['mgmt'] ?? '')], array_slice((array) $hoa[$n], 0, 3));
}
/* the homes around a map that are NOT doors to knock (2026-10-12, build-others.mjs): [[lat, lon, code, address], ...] inside the box.
   code: r owner lives elsewhere, p PO box, u owner unchecked, b business-owned. No owner names are kept in these files. */
/* soil temperature (2026-10-12): Colorado State University's CoAgMet stations that report it (5 cm, about 2 in), the nearest within
   25 miles of the town, the average of the last 24 hours. Kept 3 hours in soil-cache.json. No station near: says so (no guessing). */
const SOIL_STATIONS = [['ccr01', 'Cherry Creek Reservoir', 39.61, -104.83], ['cht01', 'Chatfield', 39.57, -105.05], ['ftl01', 'Fort Lupton', 40.00, -104.85],
    ['ftc01', 'Fort Collins', 40.59, -105.14], ['alt01', 'Ault', 40.57, -104.72], ['lcn01', 'Lucerne', 40.48, -104.71], ['gly04', 'Greeley', 40.45, -104.64],
    ['ksy01', 'Kersey', 40.37, -104.54], ['lsl01', 'La Salle', 40.33, -104.63], ['pkh01', 'Peckham', 40.31, -104.73], ['brg01', 'Briggsdale', 40.59, -104.32]];
/* the last 14 days' hail spotter reports in Colorado (2026-10-12), from NWS Local Storm Reports via Iowa Environmental Mesonet:
   [[YYYY-MM-DD (Colorado), lat, lon, inches]], kept 6 hours in hail-lsr-recent.json. What build-hail-reports.mjs has not caught yet. */
/* a door's radar hail days with the town's hours that day (2026-10-12): [date, inches] -> [date, inches, [hours]] when known */
function hailWithHours($rows, string $town): ?array {
    if (!$rows) return null;
    static $hh = null; if ($hh === null) $hh = json_decode((string) @file_get_contents(DATA_DIR . '/hail-hours.json'), true)['days'] ?? [];
    return array_map(fn($r) => (is_array($r) && isset($hh[$r[0]][$town])) ? [$r[0], $r[1], $hh[$r[0]][$town]] : $r, (array) $rows);
}
function hailRecentReports(): array {
    static $mem = null; if ($mem !== null) return $mem;
    $f = DATA_DIR . '/hail-lsr-recent.json'; $c = json_decode((string) @file_get_contents($f), true);
    if (is_array($c) && time() - (int) ($c['got'] ?? 0) < 6 * 3600) return $mem = (array) ($c['r'] ?? []);
    $sts = gmdate('Y-m-d\TH:i', time() - 14 * 86400) . 'Z'; $ets = gmdate('Y-m-d\TH:i') . 'Z';
    $csv = httpGetRaw('https://mesonet.agron.iastate.edu/cgi-bin/request/gis/lsr.py?state=CO&wfo=ALL&sts=' . $sts . '&ets=' . $ets . '&fmt=csv&justcsv=1', 12);
    if ($csv === null) return $mem = (array) ($c['r'] ?? []);   /* the archive did not answer: the last copy stands */
    $lines = preg_split('/\r?\n/', trim($csv)); $h = str_getcsv((string) array_shift($lines)); $ix = array_flip($h); $r = [];
    foreach ($lines as $l) {
        $v = str_getcsv($l); if (($v[$ix['TYPECODE'] ?? -1] ?? '') !== 'H') continue;
        $mag = (float) ($v[$ix['MAG']] ?? 0); $la = (float) ($v[$ix['LAT']] ?? 0); $lo = (float) ($v[$ix['LON']] ?? 0); if ($mag < 0.75 || !$la) continue;
        $t = (string) ($v[$ix['VALID']] ?? ''); if (strlen($t) < 12) continue;
        $dt = new DateTime(substr($t, 0, 4) . '-' . substr($t, 4, 2) . '-' . substr($t, 6, 2) . ' ' . substr($t, 8, 2) . ':' . substr($t, 10, 2), new DateTimeZone('UTC'));
        $r[] = [$dt->setTimezone(new DateTimeZone('America/Denver'))->format('Y-m-d'), $la, $lo, $mag];
    }
    @file_put_contents($f, json_encode(['got' => time(), 'r' => $r]), LOCK_EX);
    return $mem = $r;
}
/* a door's ground reports: the built ones ("date|in|mi|S/L") plus any recent spotter report within 2 miles not in them; newest first */
function hailRepRows($built, array $recent, array $d): ?array {
    $rows = [];
    foreach ((array) $built as $e) { $p = explode('|', (string) $e); if (count($p) >= 4) $rows[$p[0]] = [$p[0], (float) $p[1], (float) $p[2], $p[3]]; }
    if ($recent && isset($d['lat'], $d['lon'])) foreach ($recent as $x) {
        if (isset($rows[$x[0]])) continue;
        $mi = milesBetween((float) $d['lat'], (float) $d['lon'], (float) $x[1], (float) $x[2]); if ($mi > 2) continue;
        $rows[$x[0]] = [$x[0], (float) $x[3], round($mi, 1), 'L'];
    }
    if (!$rows) return null;
    krsort($rows); return array_values(array_slice($rows, 0, 8));
}
if ($action === 'soil') {
    $key = (string) ($_GET['region'] ?? '');
    if (!regionAvailable($key)) fail('No such region.', 404);
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $c = null; foreach (($idx['regions'] ?? []) as $r) if ($r['key'] === $key) $c = $r['c'] ?? null;
    if (!is_array($c)) out(['ok' => true, 'none' => true]);
    $best = null; foreach (SOIL_STATIONS as $s) { $mi = milesBetween((float) $c[0], (float) $c[1], $s[2], $s[3]); if (!$best || $mi < $best[1]) $best = [$s, $mi]; }
    if ($best[1] > 25) out(['ok' => true, 'none' => true, 'nearest' => $best[0][1], 'mi' => round($best[1])]);
    $cf = DATA_DIR . '/soil-cache.json'; $cache = json_decode((string) @file_get_contents($cf), true) ?: [];
    $st = $best[0][0]; $hit = $cache[$st] ?? null;
    if (!$hit || time() - (int) ($hit['got'] ?? 0) > 3 * 3600) {
        $to = new DateTime('now', new DateTimeZone('America/Denver')); $from = (clone $to)->modify('-24 hours');
        $csv = httpGetRaw('https://coagmet.colostate.edu/data/hourly/' . $st . '.csv?from=' . $from->format('Y-m-d\TH:i') . '&to=' . $to->format('Y-m-d\TH:i') . '&fields=st5cm&units=us', 15);
        $v = []; foreach (explode("\n", (string) $csv) as $l) { $p = str_getcsv(trim($l)); $x = isset($p[2]) ? (float) $p[2] : -999; if ($x > -100) $v[] = $x; }
        if ($v) { $hit = ['f' => round(array_sum($v) / count($v)), 'lo' => round(min($v)), 'hi' => round(max($v)), 'n' => count($v), 'got' => time()]; $cache[$st] = $hit; @file_put_contents($cf, json_encode($cache), LOCK_EX); }
    }
    if (!$hit) out(['ok' => true, 'none' => true, 'nearest' => $best[0][1], 'mi' => round($best[1]), 'down' => true]);
    out(['ok' => true, 'f' => $hit['f'], 'lo' => $hit['lo'], 'hi' => $hit['hi'], 'station' => $best[0][1], 'mi' => round($best[1]), 'at' => $hit['got']]);
}
if ($action === 'others') {
    $key = (string) ($_GET['region'] ?? '');
    if (!regionAvailable($key)) fail('No such region.', 404);
    $b = array_map('floatval', [$_GET['s'] ?? 0, $_GET['w'] ?? 0, $_GET['n'] ?? 0, $_GET['e'] ?? 0]);
    if ($b[2] <= $b[0] || $b[3] <= $b[1] || ($b[2] - $b[0]) > 0.2 || ($b[3] - $b[1]) > 0.25) fail('Zoom in to see the homes that are not on the list.');
    $j = json_decode((string) @file_get_contents(DATA_DIR . '/others-' . $key . '.json'), true);
    $o = [];
    foreach ((array) ($j['doors'] ?? []) as $d) {
        if (!is_array($d) || count($d) < 3) continue;
        if ($d[0] < $b[0] || $d[0] > $b[2] || $d[1] < $b[1] || $d[1] > $b[3]) continue;
        $o[] = [$d[0], $d[1], (string) $d[2], (string) ($d[3] ?? '')];
        if (count($o) >= 2500) break;
    }
    out(['ok' => true, 'homes' => $o]);
}
if ($action === 'communities') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $hoa = json_decode((string) @file_get_contents(DATA_DIR . '/hoa-communities.json'), true)['places'] ?? [];
    $cwpp = cwppPlaces();
    $g = [];
    foreach (($idx['regions'] ?? []) as $r) {
        $data = loadRegion($r['key']);
        if (!$data) continue;
        $marks = loadMarks($r['key']); $lfix = loadLawnFix($r['key']); $custOpen ??= customerDoors();
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
                $open = (!$m || $m['outcome'] === 'miss' || ($m['outcome'] === 'later' && ($m['revisit'] ?? '') !== '' && $m['revisit'] <= date('Y-m-d'))) && !isset($custOpen[$r['key'] . '/' . $d['id']]);   /* customers are not doors to knock (2026-10-13) */
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
    'Excessive Heat Warning', 'Extreme Heat Warning', 'Air Quality Alert', 'Dense Smoke Advisory', 'High Wind Warning', 'High Wind Watch',
    'Severe Thunderstorm Warning', 'Severe Thunderstorm Watch', 'Tornado Warning'];
/* per install (Matthew 2026-10-06: "only include the weather alerts that are relative to each edition"): company.json "alerts"
   lists the events this install shows and pushes, and wildfires only when it names 'Wildfires'. Without it (Sixfold), ALERT_EVENTS
   and the wildfire feed as before. Freeze and frost are fetched for the lawn edition. */
const ALERT_EXTRA = ['Freeze Watch', 'Freeze Warning', 'Hard Freeze Warning', 'Frost Advisory'];
function alertEvents(): ?array { $a = company()['alerts'] ?? null; return is_array($a) ? array_values(array_map('strval', $a)) : null; }
/* hail (Matthew 2026-10-05): the storm alerts go only where hail is on (admins of a company with features.hail); a warning
   carries the NWS's own hail size and wind gust. Each one seen is remembered for STORM_KEEP so the storm call list still
   works the day after, when the warning has left the live feed. */
const STORM_EVENTS = ['Severe Thunderstorm Warning', 'Severe Thunderstorm Watch'];
const STORM_KEEP = 3 * 86400;
function isStorm(array $w): bool { return in_array((string) ($w['event'] ?? ''), STORM_EVENTS, true); }
function recentStorms(array $active = []): array {
    $f = DATA_DIR . '/storms-recent.json';
    $all = is_readable($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : [];
    if ($active) {
        foreach ($active as $id => $w) if (isStorm($w)) $all[$id] = $w + ['seen' => time()];
        $all = array_filter($all, fn($w) => (int) ($w['seen'] ?? 0) > time() - STORM_KEEP);
        @file_put_contents($f, json_encode($all, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }
    return array_filter($all, fn($w) => (int) ($w['seen'] ?? 0) > time() - STORM_KEEP);
}
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
/** the towns whose alerts this install asks for (2026-10-07): every town it shows, at its centre (index.json "c", written by
    build-rounds-data.mjs); a town without one falls back to ALERT_TOWNS, and with none at all the fixed list is used */
function alertTowns(): array {
    static $t = null; if ($t !== null) return $t;
    $t = [];
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: [];
    foreach (($idx['regions'] ?? []) as $r) {
        $k = (string) ($r['key'] ?? ''); if ($k === '' || regionHidden($k)) continue;
        if (isset($r['c'][0], $r['c'][1]) && is_numeric($r['c'][0]) && is_numeric($r['c'][1])) $t[$k] = [round((float) $r['c'][0], 4), round((float) $r['c'][1], 4)];
        elseif (isset(ALERT_TOWNS[$k])) $t[$k] = ALERT_TOWNS[$k];
    }
    if (!$t) $t = ALERT_TOWNS;
    return $t;
}
function freshAlerts(int $maxAge = 600): array {
    $f = DATA_DIR . '/alerts-cache.json';
    $cache = is_readable($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : [];
    if (($cache['at'] ?? 0) > time() - $maxAge) return $cache;
    $fp = @fopen($f . '.lock', 'c');                        /* one refresh at a time */
    if (!$fp || !flock($fp, LOCK_EX | LOCK_NB)) return $cache ?: ['at' => 0, 'weather' => [], 'fires' => [], 'stale' => true];
    $weather = []; $wOk = true;
    $towns = alertTowns();
    $answers = httpJsonMany(array_map(fn($p) => 'https://api.weather.gov/alerts/active?point=' . $p[0] . ',' . $p[1], $towns));
    foreach ($towns as $town => [$la, $lo]) {
        $j = $answers[$town] ?? null;
        if ($j === null) { $wOk = false; continue; }
        foreach (($j['features'] ?? []) as $ft) {
            $p = $ft['properties'] ?? [];
            if (!in_array($p['event'] ?? '', ALERT_EVENTS, true) && !in_array($p['event'] ?? '', ALERT_EXTRA, true)) continue;
            $id = (string) ($p['id'] ?? $ft['id'] ?? '');
            if (!isset($weather[$id])) $weather[$id] = ['event' => $p['event'], 'headline' => (string) ($p['headline'] ?? ''),
                'ends' => (string) ($p['ends'] ?? $p['expires'] ?? ''), 'severity' => (string) ($p['severity'] ?? ''),
                'id' => $id, 'url' => 'https://alerts.weather.gov/search?id=' . rawurlencode($id), 'towns' => [],
                'hail' => is_numeric($p['parameters']['maxHailSize'][0] ?? null) ? (float) $p['parameters']['maxHailSize'][0] : null,
                'wind' => (string) ($p['parameters']['maxWindGust'][0] ?? ''), 'sent' => (string) ($p['sent'] ?? '')];
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
        foreach ($towns as $town => [$la, $lo]) { $mi = milesBetween($la, $lo, (float) $g['y'], (float) $g['x']); $dist[$town] = (int) round($mi); if (!$best || $mi < $best[1]) $best = [$town, $mi]; }
        $fires[] = ['name' => (string) ($a['IncidentName'] ?? 'Unnamed fire'), 'acres' => isset($a['IncidentSize']) ? (float) $a['IncidentSize'] : null,
            'contained' => isset($a['PercentContained']) ? (float) $a['PercentContained'] : null,
            'found' => isset($a['FireDiscoveryDateTime']) ? (int) ($a['FireDiscoveryDateTime'] / 1000) : null,
            'county' => trim((string) ($a['POOCounty'] ?? '') . ', ' . (string) ($a['POOState'] ?? ''), ', '),
            'near' => $best[0], 'miles' => (int) round($best[1]), 'dist' => $dist, 'lat' => (float) $g['y'], 'lon' => (float) $g['x']];
    }
    usort($fires, fn($x, $y) => $x['miles'] <=> $y['miles']);
    if ($wOk) recentStorms($weather ?: ['_' => ['event' => '']]);   /* remember storm warnings (the dummy only prunes) */
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
    $list = alertEvents();
    $w = array_values(array_filter($a['weather'] ?? [], function ($x) use ($list, $role) {
        $ev = (string) ($x['event'] ?? '');
        if ($list === null) return in_array($ev, ALERT_EVENTS, true) && (!isStorm($x) || hailOn($role));   /* storms: where hail is on only */
        return in_array($ev, $list, true) && (!isStorm($x) || !feature('hail') || hailOn($role));          /* a storm is a safety warning where there is no hail card */
    }));
    $fires = $list === null || in_array('Wildfires', $list, true) ? ($a['fires'] ?? []) : [];
    out(['ok' => true, 'at' => $a['at'] ?? 0, 'weather' => $w, 'fires' => $fires, 'stale' => !empty($a['stale'])]);
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
        $marks = loadMarks($r['key']); $res = loadResults($r['key']); $custOpen ??= customerDoors();
        foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
            if (!isset($d['lat'], $d['lon']) || !is_numeric($d['lat'])) continue;
            $m = freshMark($d, $marks[$d['id']] ?? null);
            $rs = $res[$d['id']] ?? null;
            if ($rs && $rs['result'] === 'won' && (int) $rs['at'] >= $since) {
                $jobs[] = ['region' => $r['key'], 'town' => $r['label'] ?? $r['key'], 'area' => $a['name'], 'id' => $d['id'],
                           'address' => $d['address'], 'street' => streetName((string) $d['address']), 'lat' => (float) $d['lat'], 'lon' => (float) $d['lon'], 'won' => (int) $rs['at']];
            }
            $open = (!$m || $m['outcome'] === 'miss' || ($m['outcome'] === 'later' && ($m['revisit'] ?? '') !== '' && $m['revisit'] <= date('Y-m-d'))) && !isset($custOpen[$r['key'] . '/' . $d['id']]);   /* customers are not doors to knock (2026-10-13) */
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
    $kind = (string) ($_GET['kind'] ?? 'fire') === 'storm' ? 'storm' : 'fire';
    if ($kind === 'storm' && !hailOn($role)) fail('Not allowed.', 403);
    $al = freshAlerts();
    $towns = [];
    if ($kind === 'storm') {
        /* warnings only (a watch hit nothing yet), active or in the last 3 days, newest first */
        $st = array_filter(recentStorms(), fn($w) => ($w['event'] ?? '') === 'Severe Thunderstorm Warning');
        uasort($st, fn($x, $y) => strcmp((string) ($y['sent'] ?? ''), (string) ($x['sent'] ?? '')));
        foreach ($st as $w) {
            $when = strtotime((string) ($w['sent'] ?? '')) ?: (int) ($w['seen'] ?? time());
            $why = 'Severe thunderstorm warning ' . (new DateTime('@' . $when))->setTimezone(new DateTimeZone(appTz()))->format('D j M') . ($w['hail'] ? ', hail up to ' . rtrim(rtrim(number_format((float) $w['hail'], 2), '0'), '.') . ' in' : '');
            foreach ((array) ($w['towns'] ?? []) as $t) $towns[$t][] = $why;
        }
    } else {
        /* the warnings this install shows (review 2026-10-07: the cache now also holds freeze and frost for the lawn edition; Sixfold's list never did) */
        $shown = alertEvents() ?? ALERT_EVENTS;
        foreach (($al['weather'] ?? []) as $w) if (!isStorm($w) && in_array((string) ($w['event'] ?? ''), $shown, true)) foreach ((array) ($w['towns'] ?? []) as $t) $towns[$t][] = (string) $w['event'];
        foreach (($al['fires'] ?? []) as $fi) foreach ((array) ($fi['dist'] ?? []) as $t => $mi) if ($mi <= 30) $towns[$t][] = 'Wildfire ' . $mi . ' mi away (' . $fi['name'] . ')';
    }
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $people = [];
    foreach (($idx['regions'] ?? []) as $r) {
        if (!isset($towns[$r['key']])) continue;
        $data = loadRegion($r['key']);
        if (!$data) continue;
        $marks = loadMarks($r['key']); $res = loadResults($r['key']); $custOpen ??= customerDoors(); $quoted = loadQuoted($r['key']); $phones = loadPhones($r['key']);
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
    out(['ok' => true, 'kind' => $kind, 'towns' => array_keys($towns), 'people' => $people]);
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


/* ---- teams, the manager role, calendars, lead owners, personal goals, training (Matthew 2026-10-05) ----------
 * Roles: crew, manager, admin. A manager is crew plus their own team: they see the team's calendars and stats, set
 * its goals, and assign its territories and leads. Teams live in the accounts file:
 *   teams:  tid => [name, by, at]
 *   member: account id => tid            (one team per person)
 * Crew on a team may LOOK at their teammates' calendars; crew on no team see only their own (Matthew 2026-10-05).
 * An admin sees anyone's. Everything below keys people by their sign-in name, as the logs do. */
function teamInfo(array $basePeople, array $acct, string $key): array {
    $byName = []; $members = [];
    foreach (acctRows($basePeople, $acct, $key) as $r) {
        if ($r['off']) continue;
        $tid = (string) ($acct['member'][$r['id']] ?? '');
        if ($tid !== '' && !isset($acct['teams'][$tid])) $tid = '';
        $byName[$r['name']] = ['id' => $r['id'], 'role' => $r['role'], 'team' => $tid, 'walker' => !empty($acct['walker'][$r['id']])];
        if ($tid !== '') $members[$tid][] = $r['name'];
    }
    return ['byName' => $byName, 'members' => $members];
}
function sameTeam(string $who): bool { global $TEAM, $myTeam; return $myTeam !== '' && ($TEAM['byName'][$who]['team'] ?? '') === $myTeam; }
/** may the signed-in person manage who's things (stats, calendar entries, goals, leads)? */
function canManage(string $who): bool { global $role, $me; return $who === $me || $role === 'admin' || ($role === 'manager' && sameTeam($who)); }
/** may they look at who's calendar? */
function canViewCal(string $who): bool { global $role; return canManage($who) || desk() || ($role === 'crew' && sameTeam($who)); }
/** the walk desk (2026-10-14): admins, and the office role where the company turns it on */
function desk(): bool { global $role; return $role === 'admin' || ($role === 'office' && feature('walkdesk')); }
function activeName(string $who): bool { global $TEAM; return $who !== '' && isset($TEAM['byName'][$who]); }
/** whose figures a stats-style request is about: admins anyone (or everyone with ''), the rest themselves or someone they manage */
function whoFor(string $req): string { global $role, $me; $req = trim($req); if ($role === 'admin') return $req; return ($req !== '' && canManage($req)) ? $req : $me; }
/** may this person move a neighbourhood from $cur to $new? Managers only within their team (and unassigned ones). */
function mayAssign(string $cur, string $new): bool {
    global $role, $me;
    if ($role === 'admin') return true;
    if ($role !== 'manager') return false;
    $ours = fn($n) => $n === '' || $n === $me || sameTeam($n);
    return $ours($cur) && $ours($new);
}

if ($action === 'teams') {
    $list = [];
    foreach ((array) ($acct['teams'] ?? []) as $tid => $t) {
        if ($role !== 'admin' && (string) $tid !== $myTeam) continue;
        $mem = array_map(fn($n) => ['name' => $n, 'role' => $TEAM['byName'][$n]['role'] ?? 'crew'], $TEAM['members'][$tid] ?? []);
        usort($mem, fn($x, $y) => [$x['role'] !== 'manager', mb_strtolower($x['name'])] <=> [$y['role'] !== 'manager', mb_strtolower($y['name'])]);
        $list[] = ['id' => (string) $tid, 'name' => (string) ($t[0] ?? ''), 'members' => $mem];
    }
    usort($list, fn($x, $y) => strcmp(mb_strtolower($x['name']), mb_strtolower($y['name'])));
    out(['ok' => true, 'teams' => $list, 'mine' => $myTeam]);
}
if ($action === 'teamsave' || $action === 'teammember') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $tlock = @fopen(accountsFile() . '.lock', 'c');
    if (!$tlock || !flock($tlock, LOCK_EX)) fail('Could not save that. Try again.', 500);
    $acct = loadAccounts(); $acct['teams'] = (array) ($acct['teams'] ?? []); $acct['member'] = (array) ($acct['member'] ?? []);
    $tid = (string) ($body['id'] ?? ($body['team'] ?? ''));
    if ($action === 'teamsave') {
        if (!empty($body['del'])) {
            if (!isset($acct['teams'][$tid])) fail('No such team.', 404);
            unset($acct['teams'][$tid]);
            foreach ($acct['member'] as $pid => $t) if ($t === $tid) unset($acct['member'][$pid]);
        } else {
            $name = trim(preg_replace('/\s+/', ' ', (string) ($body['name'] ?? '')));
            if (mb_strlen($name) < 2 || mb_strlen($name) > 40) fail('Give the team a name of 2 to 40 characters.');
            foreach ($acct['teams'] as $k => $t) if ((string) $k !== $tid && mb_strtolower((string) ($t[0] ?? '')) === mb_strtolower($name)) fail('There is already a team called ' . $name . '.');
            if ($tid === '') $tid = 't' . bin2hex(random_bytes(4));
            elseif (!isset($acct['teams'][$tid])) fail('No such team.', 404);
            $acct['teams'][$tid] = [$name, $me, time()];
        }
    } else {
        $pid = (string) ($body['person'] ?? '');
        $rows = acctRows($basePeople, $acct, $sessionKey);
        if (!isset($rows[$pid]) || $rows[$pid]['off']) fail('No such account.', 404);
        if ($tid === '') unset($acct['member'][$pid]);
        elseif (!isset($acct['teams'][$tid])) fail('No such team.', 404);
        else $acct['member'][$pid] = $tid;
    }
    if (!saveAccounts($acct)) fail('Could not save that. Try again.', 500);
    accountLog(['by' => $me, 'what' => $action, 'team' => $tid, 'person' => (string) ($body['person'] ?? ''), 'del' => !empty($body['del'])]);
    out(['ok' => true, 'id' => $tid]);
}

/* ---- leads with an owner (2026-10-05) ----
 * Website and Meta leads are nobody's until an admin or a manager assigns them (Matthew); then they are that person's,
 * on their calendar with a follow-up date they set. A door booking stays with whoever knocked. All in leadst.log rows:
 * {id, owner} and {id, follow: [date, time] | null}, alongside the existing status and note rows. */
function leadsAll(): array {
    $leads = [];
    foreach (readLines(leadsDir() . '/leads.log') as $l) $leads[$l['id']] = $l + ['status' => 'new', 'notes' => [], 'statusAt' => null, 'statusBy' => null, 'owner' => '', 'ownerBy' => null, 'follow' => null, 'tries' => []];
    foreach (readLines(leadsDir() . '/leadst.log') as $u) {
        if (!isset($leads[$u['id']])) continue;
        if (!empty($u['status'])) { $leads[$u['id']]['status'] = $u['status']; $leads[$u['id']]['statusAt'] = $u['at']; $leads[$u['id']]['statusBy'] = $u['by']; }
        if (!empty($u['note'])) $leads[$u['id']]['notes'][] = ['note' => $u['note'], 'by' => $u['by'], 'at' => $u['at']];
        if (!empty($u['untry'])) $leads[$u['id']]['tries'] = array_values(array_filter($leads[$u['id']]['tries'], fn($t) => !($t['at'] === (int) $u['untry'] && $t['by'] === (string) ($u['by'] ?? ''))));
        if (!empty($u['try'])) $leads[$u['id']]['tries'][] = ['o' => (string) $u['try'], 'by' => (string) ($u['by'] ?? ''), 'at' => (int) ($u['at'] ?? 0)];   /* call tries (2026-10-14) */
        if (array_key_exists('owner', $u)) { $leads[$u['id']]['owner'] = (string) $u['owner']; $leads[$u['id']]['ownerBy'] = $u['by'] ?? null; }
        if (array_key_exists('follow', $u)) $leads[$u['id']]['follow'] = is_array($u['follow']) ? ['date' => (string) $u['follow'][0], 'time' => (string) ($u['follow'][1] ?? '')] : null;
    }
    return $leads;
}
function leadOk(string $id): bool { return (bool) preg_match('/^[wm]\d{14}[0-9a-f]{6}$/D', $id); }
if ($action === 'myleads') {
    $who = whoFor((string) ($_GET['who'] ?? '')) ?: $me;
    $list = array_values(array_filter(leadsAll(), fn($l) => $l['owner'] === $who));
    usort($list, fn($a, $b) => ($b['at'] ?? 0) <=> ($a['at'] ?? 0));
    out(['ok' => true, 'who' => $who, 'leads' => $list]);
}
if ($action === 'leadassign') {
    if (!desk() && $role !== 'manager') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $owner = trim((string) ($body['owner'] ?? ''));
    $all = leadsAll();
    if (!leadOk($id) || !isset($all[$id])) fail('No such lead.', 404);
    if ($owner !== '' && (!activeName($owner) || boardHidden($owner))) fail('Pick someone with a sign-in code.');
    if (!desk() && !mayAssign($all[$id]['owner'], $owner)) fail('A manager assigns leads within their own team.', 403);
    if (!appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'owner' => $owner, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
if ($action === 'leadfollow') {
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $all = leadsAll();
    if (!leadOk($id) || !isset($all[$id])) fail('No such lead.', 404);
    $own = $all[$id]['owner'];
    if (!(desk() || ($own !== '' && canManage($own)))) fail('Not allowed.', 403);
    $date = (string) ($body['date'] ?? ''); $time = (string) ($body['time'] ?? '');
    if ($date !== '' && (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $date, $mm) || !checkdate((int) $mm[2], (int) $mm[3], (int) $mm[1]))) fail('That is not a real date.');
    if ($time !== '' && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D', $time)) fail('That is not a real time.');
    if (!appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'follow' => $date === '' ? null : [$date, $time], 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

/* ---- calendars (2026-10-05) ----
 * One per person, built from what the app already knows (walks they booked, doors that said "come back", leads they
 * own with a follow-up date) plus their own entries in calendar.log. Never one merged calendar: an admin picks a person. */
function calEntries(): array {
    $o = [];
    foreach (readLines(DATA_DIR . '/calendar.log') as $r) {
        if (!isset($r['id'])) continue;
        if (!empty($r['del'])) unset($o[$r['id']]); else $o[$r['id']] = $r;
    }
    return $o;
}
function calRange(): array {
    $tz = new DateTimeZone(appTz());
    /* review 2026-10-06: a real date, not just the shape of one. "2026-13-01" passed the pattern and DateTime threw,
       so the request ended with a 500 and no JSON; now a bad from or to falls back like a missing one */
    $ok = fn($d) => dateOk((string) $d);
    $from = (string) ($_GET['from'] ?? ''); $to = (string) ($_GET['to'] ?? '');
    if (!$ok($from)) $from = (new DateTime('today', $tz))->format('Y-m-d');
    if (!$ok($to) || $to < $from) $to = (new DateTime($from . ' 00:00', $tz))->modify('+30 days')->format('Y-m-d');
    if ((new DateTime($to . ' 00:00', $tz))->getTimestamp() - (new DateTime($from . ' 00:00', $tz))->getTimestamp() > 62 * 86400) fail('Ask for two months at most.');
    return [$from, $to];
}
if ($action === 'calpeople') {
    $list = [];
    foreach ($TEAM['byName'] as $n => $x) {
        if ($n !== $me && boardHidden($n)) continue;
        if (!canViewCal((string) $n)) continue;
        $list[] = ['name' => (string) $n, 'role' => $x['role'], 'team' => $x['team'], 'edit' => canManage((string) $n), 'me' => $n === $me, 'walker' => !empty($x['walker'])];
    }
    usort($list, fn($a, $b) => [!$a['me'], mb_strtolower($a['name'])] <=> [!$b['me'], mb_strtolower($b['name'])]);
    $tn = []; foreach ((array) ($acct['teams'] ?? []) as $tid => $t) $tn[(string) $tid] = (string) ($t[0] ?? '');
    out(['ok' => true, 'people' => $list, 'teams' => $tn, 'me' => $me]);
}
/** everything on one person's calendar between two dates: walks they booked, their come-backs, lead follow-ups, their entries */
function calEventsFor(string $who, string $from, string $to): array {
    $ev = [];
    $dw = feature('walkdesk') ? deskWalks() : [];
    $dwDoor = []; foreach ($dw as $x) if (!$x['off'] && $x['kind'] === 'door') $dwDoor[$x['region'] . ':' . $x['door']] = true;
    foreach (walksBetween($from, $to) as $w) if ($w['by'] === $who && !isset($dwDoor[$w['region'] . ':' . $w['id']]))
        $ev[] = ['kind' => 'walk', 'date' => $w['date'], 'time' => $w['time'], 'title' => $w['address'], 'town' => $w['town'], 'region' => $w['region'], 'area' => $w['area'], 'id' => $w['id']];
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    foreach (($idx['regions'] ?? []) as $r) {
        $marks = loadMarks($r['key']); $hit = false;
        foreach ($marks as $m) if (($m['by'] ?? '') === $who && ($m['outcome'] ?? '') === 'later' && ($m['revisit'] ?? '') !== '') { $hit = true; break; }
        if (!$hit) continue;
        $data = loadRegion($r['key']); if (!$data) continue;
        foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
            $m = freshMark($d, $marks[$d['id']] ?? null);
            if (!$m || ($m['by'] ?? '') !== $who || $m['outcome'] !== 'later') continue;
            $rv = (string) ($m['revisit'] ?? '');
            if ($rv === '' || $rv < $from || $rv > $to) continue;
            $ev[] = ['kind' => 'revisit', 'date' => $rv, 'time' => '', 'title' => $d['address'], 'town' => $r['label'], 'region' => $r['key'], 'area' => $a['name'], 'id' => $d['id']];
        }
    }
    /* territories assigned to this person for a day (2026-10-12) */
    foreach (($idx['regions'] ?? []) as $r) {
        $as = loadAssign($r['key']); if (!in_array($who, $as, true)) continue;
        foreach (assignDays($r['key']) as $area => $day) {
            if (($as[$area] ?? '') !== $who || $day < $from || $day > $to) continue;
            $ev[] = ['kind' => 'terr', 'date' => $day, 'time' => '', 'title' => $area, 'town' => $r['label'], 'region' => $r['key'], 'area' => $area];
        }
    }
    foreach (leadsAll() as $l) {
        if ($l['owner'] !== $who || !$l['follow'] || in_array($l['status'], ['won', 'lost'], true)) continue;
        $dt = $l['follow']['date']; if ($dt < $from || $dt > $to) continue;
        $ev[] = ['kind' => 'lead', 'date' => $dt, 'time' => $l['follow']['time'], 'title' => trim(($l['name'] ?? '') ?: ($l['phone'] ?? '') ?: 'Lead'), 'need' => (string) ($l['need'] ?? ''),
                 'town' => (string) ($l['town'] ?? ''), 'phone' => (string) ($l['phone'] ?? ''), 'lead' => $l['id'], 'status' => $l['status']];
    }
    if ($dw) {
        $leadsNow = leadsAll();
        foreach ($dw as $x) {
            if ($x['off'] || $x['walker'] !== $who || $x['date'] < $from || $x['date'] > $to) continue;
            $l = $x['kind'] === 'lead' ? ($leadsNow[$x['lead']] ?? []) : [];
            $ev[] = ['kind' => 'walk', 'dw' => $x['id'], 'date' => $x['date'], 'time' => $x['time'], 'mins' => (int) $x['mins'], 'title' => (string) $x['title'],
                     'town' => $x['kind'] === 'lead' ? (string) ($l['town'] ?? '') : regionLabel((string) $x['region']), 'addr' => (string) $x['addr'], 'phone' => (string) ($l['phone'] ?? ''),
                     'need' => (string) ($l['need'] ?? ''), 'by' => (string) $x['by'], 'done' => $x['done'], 'note' => (string) $x['note']];
        }
    }
    foreach (calEntries() as $c) {
        if (($c['who'] ?? '') !== $who || $c['date'] < $from || $c['date'] > $to) continue;
        $ev[] = ['kind' => 'own', 'date' => $c['date'], 'time' => (string) ($c['time'] ?? ''), 'title' => (string) $c['title'], 'note' => (string) ($c['note'] ?? ''), 'cid' => $c['id'], 'by' => (string) ($c['by'] ?? '')];
    }
    usort($ev, fn($x, $y) => [$x['date'], $x['time'] === '' ? '99' : $x['time']] <=> [$y['date'], $y['time'] === '' ? '99' : $y['time']]);
    return $ev;
}
if ($action === 'calendar') {
    $who = trim((string) ($_GET['who'] ?? '')) ?: $me;
    if (!canViewCal($who)) fail('Not allowed.', 403);
    [$from, $to] = calRange();
    out(['ok' => true, 'who' => $who, 'from' => $from, 'to' => $to, 'edit' => canManage($who), 'events' => calEventsFor($who, $from, $to)]);
}

/* ---- calendar sync (2026-10-11): the person's own feed link, and a new link (the old one stops) ---- */
if ($action === 'calfeedurl' || $action === 'calfeedreset') {
    $pid = (string) ($session['c'] ?? '');
    if ($pid === '') fail('Not allowed.', 403);
    if ($action === 'calfeedreset' && !$isPost) fail('POST required', 405);
    $salt = calFeedSalt($pid, $action === 'calfeedreset');
    if ($salt === null) fail('Could not save that. Try again.', 500);
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    $path = strtok((string) ($_SERVER['REQUEST_URI'] ?? ''), '?');
    $https = 'https://' . $host . $path . '?action=calfeed&p=' . rawurlencode($pid) . '&t=' . calFeedToken($pid, $salt, $sessionKey);
    out(['ok' => true, 'url' => $https, 'webcal' => preg_replace('#^https://#', 'webcal://', $https)]);
}
if ($action === 'calsave') {
    if (!$isPost) fail('POST required', 405);
    $who = trim((string) ($body['who'] ?? '')) ?: $me;
    if (!canManage($who)) fail('Not allowed.', 403);
    $cid = (string) ($body['id'] ?? '');
    if ($cid !== '' && !preg_match('/^c[0-9a-f]{12}$/D', $cid)) fail('No such entry.', 404);
    $have = $cid !== '' ? (calEntries()[$cid] ?? null) : null;
    if ($cid !== '' && (!$have || ($have['who'] ?? '') !== $who)) fail('No such entry.', 404);
    if (!empty($body['del'])) {
        if (!$have) fail('No such entry.', 404);
        if (!appendLine(DATA_DIR . '/calendar.log', ['id' => $cid, 'del' => 1, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
        out(['ok' => true]);
    }
    $date = (string) ($body['date'] ?? ''); $time = (string) ($body['time'] ?? '');
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $date, $mm) || !checkdate((int) $mm[2], (int) $mm[3], (int) $mm[1])) fail('That is not a real date.');
    if ($time !== '' && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D', $time)) fail('That is not a real time.');
    $title = $clean($body['title'] ?? '', 80); $note = $clean($body['note'] ?? '', 500);
    if ($title === '') fail('Give it a title.');
    $row = ['id' => $cid ?: 'c' . bin2hex(random_bytes(6)), 'who' => $who, 'date' => $date, 'time' => $time, 'title' => $title, 'note' => $note, 'by' => $me, 'at' => time()];
    if (!appendLine(DATA_DIR . '/calendar.log', $row)) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'id' => $row['id']]);
}

/* ---- the walk desk (2026-10-14; Sixfold first, Matthew: "just a sixfold build atm") ----
 * The office (admins, and the office role) books a lead's or a door's walk with someone marked "Does walks" in Accounts.
 * The walk lands on that person's calendar with what they need for it (who, where, what they want, the notes), and their
 * phones get an alert when it is booked, moved, handed to someone else or cancelled. When they have done it they say how it
 * went, which moves the lead along. deskwalks.log beside the door files, append-only: a booking line carries every field;
 * later lines for the same id change it. Only where company.json features.walkdesk is on. */
const DESK_MINS = [30, 45, 60, 90, 120];
function deskWalks(): array {
    $o = [];
    foreach (readLines(DATA_DIR . '/deskwalks.log') as $r) {
        $id = (string) $r['id'];
        if (!isset($o[$id])) {
            if (empty($r['walker']) || empty($r['kind'])) continue;
            $o[$id] = $r + ['off' => false, 'done' => null, 'made' => (int) ($r['at'] ?? 0), 'chg' => (int) ($r['at'] ?? 0)];
            continue;
        }
        $moved = false;
        foreach (['walker', 'date', 'time', 'mins', 'addr', 'note'] as $k) if (array_key_exists($k, $r)) { if (in_array($k, ['walker', 'date', 'time'], true)) $moved = true; $o[$id][$k] = $r[$k]; }
        if ($moved) $o[$id]['chg'] = (int) ($r['at'] ?? 0);
        if (!empty($r['del'])) { $o[$id]['off'] = true; $o[$id]['offBy'] = (string) ($r['by'] ?? ''); }
        if (array_key_exists('done', $r)) $o[$id]['done'] = $r['done'];
    }
    return $o;
}
function deskTarget(array $w): string { return $w['kind'] === 'lead' ? 'lead:' . $w['lead'] : 'door:' . $w['region'] . ':' . $w['door']; }
/** the live walk for each lead or door, keyed by deskTarget() */
function deskLive(): array { $o = []; foreach (deskWalks() as $w) if (!$w['off']) $o[deskTarget($w)] = $w; return $o; }
function deskMin(string $t): int { return (int) substr($t, 0, 2) * 60 + (int) substr($t, 3, 2); }
function walkerList(): array {
    global $TEAM; $o = [];
    foreach ($TEAM['byName'] as $n => $x) if (!empty($x['walker'])) $o[] = (string) $n;
    usort($o, fn($a, $b) => strcmp(mb_strtolower($a), mb_strtolower($b)));
    return $o;
}
function pushDevices(string $name): int { global $TEAM; $pid = (string) ($TEAM['byName'][$name]['id'] ?? ''); return $pid === '' ? 0 : count(pushSubs()[$pid] ?? []); }
/** one alert to everything one person turned alerts on for; how many phones and computers took it */
function pushName(string $name, string $title, string $text, string $url, string $tag): array {
    global $TEAM;
    $pid = (string) ($TEAM['byName'][$name]['id'] ?? ''); $devs = $pid === '' ? [] : (pushSubs()[$pid] ?? []);
    if (!$devs) return ['devices' => 0, 'sent' => 0];
    $v = pushVapid(false); if (!$v) return ['devices' => count($devs), 'sent' => 0];
    $payload = json_encode(['title' => $title, 'body' => $text, 'url' => $url, 'tag' => $tag, 'at' => time()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $ok = 0;
    foreach ($devs as $d) { $r = webpushSend($d['sub'], $payload, $v, 86400, ['urgency' => 'high']); if ($r['ok']) $ok++; }
    return ['devices' => count($devs), 'sent' => $ok];
}
function deskWhen(string $date, string $time): string {
    return (new DateTime($date . ' 12:00', new DateTimeZone(appTz())))->format('D j M') . ($time !== '' ? ', ' . (new DateTime('2000-01-01 ' . $time))->format('g:i a') : '');
}
/** what's already on a walker's day that a booking would run into: anything with a time, other than this walk itself */
function deskClashes(string $walker, string $date, string $time, int $mins, string $exceptId, string $exceptDoor): array {
    $s = deskMin($time); $e = $s + $mins; $out = [];
    foreach (calEventsFor($walker, $date, $date) as $ev) {
        if (($ev['time'] ?? '') === '' || ($exceptId !== '' && ($ev['dw'] ?? '') === $exceptId)) continue;
        if ($exceptDoor !== '' && $ev['kind'] === 'walk' && empty($ev['dw']) && ($ev['region'] ?? '') . ':' . ($ev['id'] ?? '') === $exceptDoor) continue;
        $s2 = deskMin((string) $ev['time']); $e2 = $s2 + (int) ($ev['mins'] ?? ($ev['kind'] === 'walk' ? 60 : 30));
        if ($s < $e2 && $s2 < $e) $out[] = ['time' => (string) $ev['time'], 'mins' => $e2 - $s2, 'title' => (string) $ev['title'], 'kind' => (string) $ev['kind']];
    }
    return $out;
}
/** the door a walk is for: where it is and what the crew learned there (a number only if the homeowner gave it) */
function deskDoor(string $key, string $id): ?array {
    if (!regionAvailable($key)) return null;
    $data = loadRegion($key); if (!$data) return null;
    foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
        if ($d['id'] !== $id) continue;
        $ph = loadPhones($key)[$id] ?? null; $nt = loadNotes($key)[$id] ?? null; $em = loadEmails($key)[$id] ?? null;
        return ['address' => (string) $d['address'], 'town' => regionLabel($key), 'area' => (string) $a['name'], 'owner' => $d['owner'] ?? null,
                'lat' => $d['lat'] ?? null, 'lon' => $d['lon'] ?? null, 'lawn' => $d['lawn'] ?? null,
                'phone' => ($ph && ($ph['source'] ?? '') === 'door') ? (string) $ph['phone'] : '', 'email' => $em ? (string) ($em['email'] ?? '') : '',
                'note' => $nt ? (string) ($nt['note'] ?? '') : ''];
    }
    return null;
}
/** a walk as the walker and the office see it, with the lead or the door filled in */
function deskShow(array $w, ?array $leads = null): array {
    $o = array_intersect_key($w, array_flip(['id', 'kind', 'lead', 'region', 'door', 'title', 'walker', 'date', 'time', 'mins', 'addr', 'note', 'by', 'made', 'chg', 'done']));
    if ($w['kind'] === 'lead') {
        $l = ($leads ?? leadsAll())[$w['lead']] ?? null;
        if ($l) $o['who'] = ['name' => (string) ($l['name'] ?? ''), 'phone' => (string) ($l['phone'] ?? ''), 'email' => (string) ($l['email'] ?? ''), 'town' => (string) ($l['town'] ?? ''),
                            'need' => (string) ($l['need'] ?? ''), 'msg' => (string) ($l['msg'] ?? ''), 'src' => (string) ($l['src'] ?? ''), 'status' => (string) $l['status'], 'notes' => $l['notes']];
    } else {
        $d = deskDoor((string) $w['region'], (string) $w['door']);
        if ($d) $o['house'] = $d;
    }
    return $o;
}
function deskSeenFile(): string { return DATA_DIR . '/deskwalks-seen.json'; }

if (in_array($action, ['deskwalks', 'deskday', 'deskwalk', 'mywalks', 'walkdone'], true) && !feature('walkdesk')) fail('Not here.', 404);
/* the Pipeline's view: every live walk from a month back, and who does walks (with whether their phones take alerts) */
if ($action === 'deskwalks') {
    if (!desk()) fail('Not allowed.', 403);
    $from = (new DateTime('today', new DateTimeZone(appTz())))->modify('-30 days')->format('Y-m-d');
    $list = []; foreach (deskLive() as $w) if ($w['date'] >= $from) $list[] = array_intersect_key($w, array_flip(['id', 'kind', 'lead', 'region', 'door', 'title', 'walker', 'date', 'time', 'mins', 'addr', 'note', 'by', 'done']));
    out(['ok' => true, 'walks' => $list, 'walkers' => array_map(fn($n) => ['name' => $n, 'alerts' => pushDevices($n) > 0], walkerList())]);
}
/* one day for every walker, side by side, to pick a time that is free */
if ($action === 'deskday') {
    if (!desk()) fail('Not allowed.', 403);
    $date = (string) ($_GET['date'] ?? ''); if (!dateOk($date)) fail('That is not a real date.');
    $cols = [];
    foreach (walkerList() as $n) {
        $ev = array_map(fn($e) => ['time' => (string) ($e['time'] ?? ''), 'mins' => (int) ($e['mins'] ?? ($e['kind'] === 'walk' ? 60 : 30)), 'title' => (string) $e['title'], 'kind' => (string) $e['kind'], 'dw' => (string) ($e['dw'] ?? ''),
                                 'door' => $e['kind'] === 'walk' && empty($e['dw']) ? (string) ($e['region'] ?? '') . ':' . (string) ($e['id'] ?? '') : ''], calEventsFor($n, $date, $date));
        $cols[] = ['name' => $n, 'alerts' => pushDevices($n) > 0, 'events' => $ev];
    }
    out(['ok' => true, 'date' => $date, 'walkers' => $cols, 'from' => '08:00', 'to' => '18:00']);
}
/* book, change, hand over or cancel a walk */
if ($action === 'deskwalk') {
    if (!desk()) fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $lk = @fopen(DATA_DIR . '/deskwalks.log.lock', 'c');
    if (!$lk || !flock($lk, LOCK_EX)) fail('Could not save that. Try again.', 500);
    $all = deskWalks(); $id = (string) ($body['id'] ?? ''); $have = null;
    if ($id !== '') { if (!preg_match('/^v[0-9a-f]{12}$/D', $id) || !isset($all[$id]) || $all[$id]['off']) fail('No such walk.', 404); $have = $all[$id]; }
    $leads = leadsAll();
    $vw = ucfirst((string) (company()['visitShort'] ?? 'Walk'));
    if (!empty($body['del'])) {
        if (!$have) fail('No such walk.', 404);
        if (!appendLine(DATA_DIR . '/deskwalks.log', ['id' => $id, 'del' => 1, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
        if ($have['kind'] === 'lead' && ($leads[$have['lead']]['status'] ?? '') === 'walk') appendLine(leadsDir() . '/leadst.log', ['id' => $have['lead'], 'status' => 'contacted', 'by' => $me, 'at' => time()]);
        $al = $have['walker'] !== $me ? pushName($have['walker'], $vw . ' cancelled: ' . deskWhen($have['date'], $have['time']), $have['title'] . ' · cancelled by ' . $me, './', 'dw-' . $id) : null;
        out(['ok' => true, 'alert' => $al]);
    }
    /* what it is for: kept from the booking when changing one */
    if ($have) { $kind = $have['kind']; $lead = (string) ($have['lead'] ?? ''); $key = (string) ($have['region'] ?? ''); $door = (string) ($have['door'] ?? ''); $title = (string) $have['title']; }
    else {
        $kind = (string) ($body['kind'] ?? ''); $lead = ''; $key = ''; $door = '';
        if ($kind === 'lead') {
            $lead = (string) ($body['lead'] ?? '');
            if (!leadOk($lead) || !isset($leads[$lead])) fail('No such lead.', 404);
            $title = trim((string) ($leads[$lead]['name'] ?? '')) ?: (trim((string) ($leads[$lead]['phone'] ?? '')) ?: 'Lead');
        } elseif ($kind === 'door') {
            $key = (string) ($body['region'] ?? ''); $door = (string) ($body['door'] ?? '');
            if (!regionAvailable($key) || !preg_match('/^[a-z0-9-]{1,80}$/D', $door)) fail('No such door.', 404);
            $key = doorHome($key, $door); $dd = deskDoor($key, $door); if (!$dd) fail('No such door.', 404);
            $title = $dd['address'];
        } else fail('Say what the walk is for.');
        $tgt = $kind === 'lead' ? 'lead:' . $lead : 'door:' . $key . ':' . $door;
        foreach ($all as $w) if (!$w['off'] && deskTarget($w) === $tgt) fail('This already has a walk booked. Change that one.', 409);
    }
    $walker = trim((string) ($body['walker'] ?? ($have['walker'] ?? '')));
    if (!in_array($walker, walkerList(), true)) fail('Pick someone who does walks. An admin marks them in Accounts.');
    $date = (string) ($body['date'] ?? ($have['date'] ?? '')); $time = (string) ($body['time'] ?? ($have['time'] ?? ''));
    if (!dateOk($date)) fail('That is not a real date.');
    $tz = new DateTimeZone(appTz());
    $diff = (int) round(((new DateTime($date . ' 00:00', $tz))->getTimestamp() - (new DateTime('today', $tz))->getTimestamp()) / 86400);
    if ($diff < 0 && (!$have || $date !== $have['date'])) fail('That day has gone. Pick today or later.');
    if ($diff > 180) fail('Pick a date within the next six months.');
    if (!preg_match('/^(0[6-9]|1\d|20):(00|15|30|45)$/D', $time)) fail('Pick a time between 6 am and 8:45 pm.');
    $mins = (int) ($body['mins'] ?? ($have['mins'] ?? 60)); if (!in_array($mins, DESK_MINS, true)) fail('Pick how long it takes.');
    $addr = array_key_exists('addr', $body) ? $clean($body['addr'], 160) : (string) ($have['addr'] ?? '');
    $note = array_key_exists('note', $body) ? $clean($body['note'], 500) : (string) ($have['note'] ?? '');
    if ($kind === 'door' && $addr === '') $addr = $title . ', ' . regionLabel($key);
    if ($addr === '') fail('Add the address, so ' . $walker . ' knows where to go.');
    if (empty($body['force'])) {
        $cl = deskClashes($walker, $date, $time, $mins, $have ? $id : '', $kind === 'door' ? $key . ':' . $door : '');
        if ($cl) out(['ok' => false, 'clash' => $cl, 'error' => $walker . ' already has something then.']);
    }
    $nid = $have ? $id : 'v' . bin2hex(random_bytes(6));
    if ($have) {
        $row = ['id' => $id];
        foreach (['walker' => $walker, 'date' => $date, 'time' => $time, 'mins' => $mins, 'addr' => $addr, 'note' => $note] as $k => $v) if ((string) $v !== (string) ($have[$k] ?? '')) $row[$k] = $v;
        if (count($row) === 1) out(['ok' => true, 'id' => $id, 'alert' => null, 'same' => true]);
        $row += ['by' => $me, 'at' => time()];
    } else $row = ['id' => $nid, 'kind' => $kind] + ($kind === 'lead' ? ['lead' => $lead] : ['region' => $key, 'door' => $door])
                 + ['title' => $title, 'walker' => $walker, 'date' => $date, 'time' => $time, 'mins' => $mins, 'addr' => $addr, 'note' => $note, 'by' => $me, 'at' => time()];
    if (!appendLine(DATA_DIR . '/deskwalks.log', $row)) fail('Could not save that. Try again.', 500);
    /* the lead moves to Walk booked; a door's own walk keeps step with the booking (still filed under whoever booked it at the door) */
    if ($kind === 'lead' && in_array($leads[$lead]['status'] ?? 'new', ['new', 'contacted'], true)) appendLine(leadsDir() . '/leadst.log', ['id' => $lead, 'status' => 'walk', 'by' => $me, 'at' => time()]);
    if ($kind === 'door') {
        $cur = loadWalks($key)[$door] ?? null;
        if (!$cur || $cur['date'] !== $date || $cur['time'] !== $time) appendWalk($key, ['id' => $door, 'date' => $date, 'time' => $time, 'by' => $cur ? $cur['by'] : $me, 'at' => time()]);
    }
    /* the alerts: never to the person doing the booking */
    $when = deskWhen($date, $time); $where = $kind === 'lead' ? trim((string) ($leads[$lead]['town'] ?? '')) : '';
    $txt = $title . ($where !== '' ? ' · ' . $where : '') . ' · booked by ' . $me;
    $al = null;
    if (!$have) $al = $walker !== $me ? pushName($walker, $vw . ' booked: ' . $when, $txt, './?walk=' . $nid, 'dw-' . $nid) : null;
    elseif ($walker !== $have['walker']) {
        if ($have['walker'] !== $me) pushName($have['walker'], $vw . ' handed to ' . $walker, $have['title'] . ' · ' . deskWhen($have['date'], $have['time']) . ' · by ' . $me, './', 'dw-' . $id);
        $al = $walker !== $me ? pushName($walker, $vw . ' booked: ' . $when, $txt, './?walk=' . $id, 'dw-' . $id) : null;
    } elseif ($date !== $have['date'] || $time !== $have['time']) $al = $walker !== $me ? pushName($walker, $vw . ' moved: ' . $when, $title . ' · was ' . deskWhen($have['date'], $have['time']) . ' · by ' . $me, './?walk=' . $id, 'dw-' . $id) : null;
    out(['ok' => true, 'id' => $nid, 'alert' => $al]);
}
/* the walker's own list: today's and what is coming, with everything for each; the last two weeks' too, to say how they went */
if ($action === 'mywalks') {
    $who = trim((string) ($_GET['who'] ?? '')); if ($who === '' || !desk()) $who = $me;
    $tz = new DateTimeZone(appTz()); $from = (new DateTime('today', $tz))->modify('-14 days')->format('Y-m-d');
    $seenAll = json_decode((string) @file_get_contents(deskSeenFile()), true) ?: []; $seen = (int) ($seenAll[$who] ?? 0);
    $leads = leadsAll(); $list = [];
    foreach (deskWalks() as $w) if (!$w['off'] && $w['walker'] === $who && $w['date'] >= $from) $list[] = deskShow($w, $leads) + ['fresh' => $w['chg'] > $seen && ($w['by'] ?? '') !== $who];
    usort($list, fn($a, $b) => [$a['date'], $a['time']] <=> [$b['date'], $b['time']]);
    if ($who === $me && !empty($_GET['seen'])) { $seenAll[$me] = time(); @file_put_contents(deskSeenFile(), json_encode($seenAll, JSON_UNESCAPED_UNICODE), LOCK_EX); }
    out(['ok' => true, 'who' => $who, 'walks' => $list]);
}
/* how it went, from the walker (or the office): a note, and Quote sent / Done / Nobody there */
if ($action === 'walkdone') {
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $all = deskWalks();
    if (!preg_match('/^v[0-9a-f]{12}$/D', $id) || !isset($all[$id]) || $all[$id]['off']) fail('No such walk.', 404);
    $w = $all[$id];
    if ($w['walker'] !== $me && !desk()) fail('Not allowed.', 403);
    $o = (string) ($body['outcome'] ?? ''); $note = $clean($body['note'] ?? '', 500);
    if (!in_array($o, ['', 'quoted', 'done', 'nobody', 'undo'], true)) fail('Bad outcome.');
    if ($o === '' && $note === '') fail('Nothing to save.');
    $vw = ucfirst((string) (company()['visitShort'] ?? 'Walk'));
    if ($o !== '' && !appendLine(DATA_DIR . '/deskwalks.log', ['id' => $id, 'done' => $o === 'undo' ? null : ['o' => $o, 'by' => $me, 'at' => time()], 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    if ($w['kind'] === 'lead') {
        $say = ['quoted' => $vw . ' done, quote sent', 'done' => $vw . ' done', 'nobody' => 'Nobody there at the ' . strtolower($vw)][$o] ?? '';
        $row = ['id' => $w['lead'], 'by' => $me, 'at' => time()];
        if ($o === 'quoted') $row['status'] = 'quoted';
        $txt = trim($say . ($say !== '' && $note !== '' ? ': ' : '') . $note); if ($txt !== '') $row['note'] = mb_substr($txt, 0, 500);
        if (count($row) > 3) appendLine(leadsDir() . '/leadst.log', $row);
    } elseif ($o === 'quoted') appendQuoted((string) $w['region'], ['id' => $w['door'], 'quoted' => true, 'by' => $me, 'at' => time()]);
    out(['ok' => true]);
}

/* ---- personal goals (2026-10-05) ----
 * Each person can set their own daily goal (doors, people talked to, quotes booked); a manager or an admin can set one
 * for someone they manage. With none set, the company goal on the Leaderboard applies. */
function loadPGoals(): array { $g = json_decode((string) @file_get_contents(DATA_DIR . '/goals-people.json'), true); return is_array($g) ? $g : []; }
if ($action === 'mygoal') {
    if (!$isPost) fail('POST required', 405);
    $who = trim((string) ($body['who'] ?? '')) ?: $me;
    if (!canManage($who)) fail('Not allowed.', 403);
    $g = ['by' => $me, 'at' => time()]; $any = false;
    foreach (['doors', 'talked', 'booked'] as $k) {
        $v = $body[$k] ?? null;
        if ($v === null || $v === '') { $g[$k] = null; continue; }
        if (!is_numeric($v) || (int) $v != $v || (int) $v < 0 || (int) $v > 300) fail('Goals are whole numbers from 0 to 300.');
        $g[$k] = (int) $v; $any = true;
    }
    $gf = DATA_DIR . '/goals-people.json';
    $glock = @fopen($gf . '.lock', 'c');
    if (!$glock || !flock($glock, LOCK_EX)) fail('Could not save that. Try again.', 500);
    $all = loadPGoals();
    if ($any) $all[$who] = $g; else unset($all[$who]);
    if (@file_put_contents($gf, json_encode($all, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX) === false) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'goal' => $any ? $g : null]);
}

/* ---- training (2026-10-05) ----
 * Each company's own lessons, in its data folder (training.json), never in the page: the product carries the section,
 * the company carries the content (Matthew). Everyone signed in reads it; admins edit it. */
if ($action === 'training') {
    $j = json_decode((string) @file_get_contents(DATA_DIR . '/training.json'), true);
    /* the field guide PDF (2026-10-13): an install that has docs/field-guide.pdf offers it at the top of Training. Only Sixfold's
       data carries one (sixfold/training/build-field-guide.mjs); the editions' builds never copy it. */
    $gf = DATA_DIR . '/docs/field-guide.pdf';
    $guide = is_file($gf) ? ['kb' => (int) round(filesize($gf) / 1024), 'at' => (int) filemtime($gf)] : null;
    out(['ok' => true, 'training' => is_array($j) && is_array($j['lessons'] ?? null) ? $j : ['lessons' => []], 'edit' => $role === 'admin', 'guide' => $guide]);
}
/* the field guide itself, to anyone signed in to this install (2026-10-13): internal, so it is served here and not from public_html */
if ($action === 'guidepdf') {
    $gf = DATA_DIR . '/docs/field-guide.pdf';
    if (!is_file($gf)) fail('No field guide here.', 404);
    header('Content-Type: application/pdf');
    header('Content-Disposition: ' . (!empty($_GET['dl']) ? 'attachment' : 'inline') . '; filename="' . preg_replace('/[^A-Za-z0-9 -]/', '', (string) company()['short']) . ' Field Guide.pdf"');
    header('Cache-Control: private, max-age=3600');
    header('Content-Length: ' . filesize($gf));
    readfile($gf);
    exit;
}
if ($action === 'trainingsave') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $in = $body['lessons'] ?? null;
    if (!is_array($in) || count($in) > 200) fail('Up to 200 lessons.');
    $out = [];
    foreach ($in as $l) {
        if (!is_array($l)) fail('Bad lesson.');
        $title = $clean($l['title'] ?? '', 120); $text = trim(str_replace("\r", '', (string) ($l['text'] ?? '')));
        $kind = (string) ($l['kind'] ?? 'other'); if (!in_array($kind, ['door', 'sales', 'quote', 'phone', 'paper', 'safety', 'app', 'other'], true)) $kind = 'other';   /* the seven headings (2026-10-05) */
        if ($title === '') fail('Every lesson needs a title.');
        if (mb_strlen($text) > 20000) fail('A lesson can be up to 20,000 characters.');
        $lid = (string) ($l['id'] ?? ''); if (!preg_match('/^l[0-9a-f]{8}$/D', $lid)) $lid = 'l' . bin2hex(random_bytes(4));
        $out[] = ['id' => $lid, 'title' => $title, 'kind' => $kind, 'text' => $text];
    }
    $j = ['lessons' => $out, 'by' => $me, 'at' => time()];
    if (@file_put_contents(DATA_DIR . '/training.json', json_encode($j, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX) === false) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

/* ---- the storm list (2026-10-05) ------------------------------------------------------------------------------
 * Matthew: roofers use five or six tabs to get from a storm to a phone call (a storm map, the properties, a satellite
 * measure, the material by eye, an owner search, a number search). This is that path in one place: pick a storm day, see
 * every door the hail or wind reached with its roof, material, age, owner and any number we may call, then open the card.
 * Admins where hail is on. Prices per square and damage thresholds are each company's own (roof-settings.json); the app
 * suggests no price. */
const MAT_CLASS = ['asphalt' => 'Asphalt shingle', 'tile' => 'Tile', 'shake' => 'Wood shake', 'metal' => 'Metal', 'flat' => 'Flat or built-up', 'slate' => 'Slate or stone'];
const STORM_MAX_ROWS = 1500;
function matClass(string $county): string {
    $c = strtolower($county);
    if ($c === '') return '';
    if (str_contains($c, 'composition') || str_contains($c, 'asphalt')) return 'asphalt';
    if (str_contains($c, 'tile')) return 'tile';
    if (str_contains($c, 'shake') || str_contains($c, 'wood')) return 'shake';
    if (str_contains($c, 'metal')) return 'metal';
    if (str_contains($c, 'slate') || str_contains($c, 'stone')) return 'slate';
    if (str_contains($c, 'built up') || str_contains($c, 'elastomeric') || str_contains($c, 'ply') || str_contains($c, 'rock')) return 'flat';
    return '';
}
function roofSettings(): array {
    $j = json_decode((string) @file_get_contents(DATA_DIR . '/roof-settings.json'), true);
    $d = json_decode((string) @file_get_contents(DATA_DIR . '/roof-damage-defaults.json'), true);   /* suggested thresholds, from research; editable */
    $out = ['price' => [], 'damage' => [], 'custom' => [], 'defaults' => is_array($d) ? $d : null];
    foreach (MAT_CLASS as $k => $_) {
        $out['price'][$k] = $j['price'][$k] ?? null;
        $out['custom'][$k] = ($j['damage'][$k]['hail'] ?? null) !== null;   /* the company set its own hail figure: no age rule */
        $out['damage'][$k] = ['hail' => $j['damage'][$k]['hail'] ?? ($d['damage'][$k]['hail'] ?? null), 'wind' => $j['damage'][$k]['wind'] ?? ($d['damage'][$k]['wind'] ?? null)];
    }
    $out['by'] = $j['by'] ?? null; $out['at'] = $j['at'] ?? null;
    return $out;
}
if ($action === 'roofsettings') {
    if (!hailOn($role)) fail('Not allowed.', 403);
    if (!$isPost) out(['ok' => true, 'settings' => roofSettings(), 'classes' => MAT_CLASS]);
    if ($role !== 'admin') fail('Not allowed.', 403);   /* the company's prices and thresholds: admins set them (review 2026-10-08: crew could, once features.crew opened hail) */
    $cur = roofSettings();
    $num = function ($v, $max) { if ($v === null || $v === '') return null; if (!is_numeric($v) || (float) $v < 0 || (float) $v > $max) fail('Use numbers from 0 to ' . $max . '.'); return round((float) $v, 2); };
    $save = ['price' => [], 'damage' => [], 'by' => $me, 'at' => time()];
    foreach (MAT_CLASS as $k => $_) {
        $save['price'][$k] = array_key_exists($k, (array) ($body['price'] ?? [])) ? $num($body['price'][$k], 10000) : $cur['price'][$k];
        $dm = (array) ($body['damage'][$k] ?? []);
        $df = (array) ($cur['defaults']['damage'][$k] ?? []);
        $hv = array_key_exists('hail', $dm) ? $num($dm['hail'], 6) : $cur['damage'][$k]['hail']; $wv = array_key_exists('wind', $dm) ? $num($dm['wind'], 250) : $cur['damage'][$k]['wind'];
        /* a figure equal to the suggested one is stored as 'not set', so the suggestion (and the asphalt age rule) still applies */
        $save['damage'][$k] = ['hail' => ($hv !== null && $hv == ($df['hail'] ?? null)) ? null : $hv, 'wind' => ($wv !== null && $wv == ($df['wind'] ?? null)) ? null : $wv];
    }
    if (@file_put_contents(DATA_DIR . '/roof-settings.json', json_encode($save, JSON_UNESCAPED_SLASHES), LOCK_EX) === false) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'settings' => roofSettings()]);
}
if ($action === 'stormdays') {
    if (!hailOn($role)) fail('Not allowed.', 403);
    stormRefresh();
    $h = json_decode((string) @file_get_contents(DATA_DIR . '/hail-storms.json'), true) ?: [];
    $w = json_decode((string) @file_get_contents(DATA_DIR . '/wind-storms.json'), true) ?: [];
    $days = [];
    foreach (($h['storms'] ?? []) as $s) $days[$s['date']] = ['date' => $s['date'], 'hail' => $s['max'] ?? null, 'hailDoors' => (int) ($s['n34'] ?? 0),
        'towns' => array_values(array_map(fn($t) => (string) $t['label'], (array) ($s['towns'] ?? []))), 'wind' => null, 'windKind' => '', 'windDoors' => 0];
    foreach (($w['storms'] ?? []) as $s) {
        $d = $days[$s['date']] ?? ['date' => $s['date'], 'hail' => null, 'hailDoors' => 0, 'towns' => [], 'wind' => null, 'windKind' => '', 'windDoors' => 0];
        $d['wind'] = $s['max'] ?? null; $d['windKind'] = (string) ($s['kind'] ?? ''); $d['windDoors'] = (int) ($s['n'] ?? 0);
        foreach ((array) ($s['towns'] ?? []) as $t) if (!in_array($t['label'], $d['towns'], true)) $d['towns'][] = (string) $t['label'];
        $days[$s['date']] = $d;
    }
    krsort($days);
    out(['ok' => true, 'days' => array_values($days), 'hailThrough' => $h['through'] ?? null, 'windThrough' => $w['through'] ?? null]);
}
if ($action === 'stormdoors') {
    /* an office tool: every town's owners and their looked-up phones (review 2026-10-08), so admins only even where crew see hail */
    if ($role !== 'admin' || !hailOn($role)) fail('Not allowed.', 403);
    $day = (string) ($_GET['day'] ?? ''); $only = (string) ($_GET['town'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $day)) fail('Pick a storm day.');
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    /* first pass: which doors, per town, the hail or the wind reached that day */
    $hits = []; $towns = []; $total = 0;
    /* read one town's file at a time and let it go: the loaders' caches hold every town at once, too much for the wind files */
    $side = function (string $kind, string $k) { $j = json_decode((string) @file_get_contents(DATA_DIR . '/' . $kind . '-' . $k . '.json'), true); return is_array($j['doors'] ?? null) ? $j['doors'] : []; };
    foreach (($idx['regions'] ?? []) as $r) {
        $k = $r['key']; $hit = [];
        $hl = $side('hail', $k); foreach ($hl as $id => $rows) foreach ($rows as $x) if ($x[0] === $day) { $hit[$id]['hail'] = (float) $x[1]; break; }
        unset($hl);
        /* wind files are packed ("date|mph|kind|miles", 2026-10-07): windRows unpacks them (2026-10-08 fix: read raw, a packed
           town's wind never matched, so a wind day listed only towns still in the old format) */
        $wl = $side('wind', $k); foreach ($wl as $id => $rows) foreach ((windRows(is_string($rows) ? json_decode($rows, true) : $rows) ?? []) as $x)   /* packed: JSON text per door (2026-10-10) */ if ($x[0] === $day) { $hit[$id]['wind'] = [$x[1], $x[2], $x[3]]; break; }
        unset($wl);
        if (!$hit) continue;
        $nh = 0; foreach ($hit as $h) if (isset($h['hail'])) $nh++;
        $towns[] = ['key' => $k, 'label' => $r['label'], 'n' => count($hit), 'hail' => $nh];
        $total += count($hit);
        /* keep the doors only while they could be listed: a big wind day reaches most of the map, and holding every door of
           every town just to answer "pick a town" ran out of memory (2026-10-08) */
        if ($only !== '' ? $k === $only : $total <= STORM_MAX_ROWS) $hits[$k] = $hit; elseif ($only === '') $hits = [];
        unset($hit);
    }
    /* a big wind day can reach most of the map (one station covers 10 miles), so past STORM_MAX_ROWS the page picks a town */
    if ($only === '' && $total > STORM_MAX_ROWS) out(['ok' => true, 'day' => $day, 'pick' => true, 'total' => $total, 'towns' => $towns, 'doors' => [], 'settings' => roofSettings(), 'classes' => MAT_CLASS]);
    $list = [];
    foreach (($idx['regions'] ?? []) as $r) {
        $k = $r['key'];
        if (!isset($hits[$k]) || ($only !== '' && $only !== $k)) continue;
        $hit = $hits[$k];
        $data = loadRegion($k); if (!$data) continue;
        $roof = $side('roof', $k); $year = $side('year', $k); $mat = $side('material', $k);
        $marks = loadMarks($k); $phones = loadPhones($k); $traces = skipLoad($k); $mfx = loadMatFix($k);
        /* 2026-10-13 (Fable review): an edition's roof, year and material files are packed (each door's entry as JSON text, since
           build-editions.cjs 2026-10-10), and $side reads them raw, so every door here had its roof as a string of JSON, no year built
           and no county material. Unpacked per listed door, as bestTownPoints does, never the whole file. */
        $un = fn($v) => is_string($v) ? json_decode($v, true) : $v;
        foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
            if (!isset($hit[$d['id']])) continue;
            $h = $hit[$d['id']]; $y = $un($year[$d['id']] ?? null); $m = $un($mat[$d['id']] ?? null);
            if (isset($mfx[$d['id']])) $m = ['m' => $mfx[$d['id']]['m'], 'p' => 1, 'src' => 'crew'];   /* seen at the house: beats the record and the photo */
            $cls = (string) ($m['m'] ?? matClass((string) ($y['mat'] ?? '')));
            $src = $m ? (string) ($m['src'] ?? 'imagery') : (($y['mat'] ?? '') !== '' ? 'county' : '');
            $mk = freshMark($d, $marks[$d['id']] ?? null);
            /* a number that may be dialled: given at the door, or looked up or skip traced and cleared against the Do Not Call list */
            $ph = null; $p = $phones[$d['id']] ?? null;
            if ($p && !empty($p['phone']) && ownerAge($d, $p) !== 'prev' && (($p['source'] ?? '') === 'door' || ($p['dnc'] ?? '') === 'clear')) $ph = ['n' => (string) $p['phone'], 'src' => (string) $p['source']];
            elseif (isset($traces[$d['id']])) { foreach ((skipPublic($traces[$d['id']])['phones'] ?? []) as $tp) if (!empty($tp['clear'])) { $ph = ['n' => (string) $tp['n'], 'src' => 'trace']; break; } }
            $list[] = ['region' => $k, 'town' => $r['label'], 'area' => $a['name'], 'id' => $d['id'], 'address' => $d['address'], 'owner' => (string) ($d['owner'] ?? ''),
                       'hail' => $h['hail'] ?? null, 'wind' => $h['wind'] ?? null, 'roof' => $un($roof[$d['id']] ?? null), 'yb' => $y['yb'] ?? null, 'rm' => $y['rm'] ?? null,
                       'mat' => $cls, 'matSrc' => $src, 'matP' => $m['p'] ?? null, 'mark' => $mk ? $mk['outcome'] : null, 'mq' => ($mk && !empty($mk['qs'])) ? 1 : 0, 'phone' => $ph, 'traced' => isset($traces[$d['id']])];
        }
    }
    usort($list, fn($x, $y) => [($y['hail'] ?? 0), ($y['wind'][0] ?? 0)] <=> [($x['hail'] ?? 0), ($x['wind'][0] ?? 0)]);
    out(['ok' => true, 'day' => $day, 'pick' => false, 'town' => $only, 'total' => $total, 'towns' => $towns, 'doors' => $list, 'settings' => roofSettings(), 'classes' => MAT_CLASS]);
}

/* ---- phone alerts (Matthew 2026-10-05) ---------------------------------------------------------------------------
 * Web Push to the installed app (iPhone and iPad need iOS 16.4+ and the app on the Home Screen; Android Chrome works
 * in the browser too). Design, tests and sources: door-app/research/push/. The library is api/webpush.php (no secrets).
 *   storm warnings (severe thunderstorm, tornado, high wind): everyone, where the company shows hail on its cards;
 *                             admins only where hail is on but hidden from the cards (Sixfold's lawn crews)
 *   fire warnings (red flag, fire): everyone who turned alerts on
 * Someone with neighbourhoods assigned gets only the towns they hold; everyone else gets every town.
 * Private files (never in public_html, never in git): sixfold-private/push-vapid.json (the server makes its key the
 * first time it is needed and NEVER replaces it: a new key would silently cut off every phone) and
 * push-subscriptions.json. The cron job (sixfold-tools/push-alerts.php, every 5 minutes) runs action=pushcron. */
const PUSH_STORM = ['Severe Thunderstorm Warning', 'Tornado Warning', 'High Wind Warning'];
const PUSH_FIRE = ['Red Flag Warning', 'Fire Warning'];
const PUSH_FREEZE = ['Freeze Warning', 'Hard Freeze Warning'];   /* only where company.json "alerts" names them (the lawn edition) */
const PUSH_MAX_DEVICES = 4;
function pushPrivDir(): string { $p = dirname(__DIR__, 2) . '/sixfold-private'; return is_dir($p) ? $p : dirname(DATA_DIR); }
function pushVapid(bool $make = false): ?array {
    $f = pushPrivDir() . '/push-vapid.json';
    $j = json_decode((string) @file_get_contents($f), true);
    if (is_array($j) && !empty($j['publicKey']) && !empty($j['privateKey'])) return $j;
    if (!$make || file_exists($f)) return null;
    $lk = @fopen($f . '.lock', 'c');
    if (!$lk || !flock($lk, LOCK_EX)) return null;
    clearstatcache();
    if (file_exists($f)) { $j = json_decode((string) @file_get_contents($f), true); return is_array($j) ? $j : null; }
    try { $k = vapidKeysGenerate(); } catch (Throwable $e) { error_log('rounds push: no key made: ' . $e->getMessage()); return null; }
    $mail = trim((string) (company()['email'] ?? ''));
    $j = ['publicKey' => $k['publicKey'], 'privateKey' => $k['privateKey'], 'subject' => 'mailto:' . ($mail !== '' ? $mail : 'office@example.com'), 'made' => time()];
    if (@file_put_contents($f, json_encode($j, JSON_UNESCAPED_SLASHES), LOCK_EX) === false) return null;
    @chmod($f, 0600);
    return $j;
}
function pushSubs(): array { $j = json_decode((string) @file_get_contents(pushPrivDir() . '/push-subscriptions.json'), true); return is_array($j) ? $j : []; }
function pushSave(array $a): bool {
    $f = pushPrivDir() . '/push-subscriptions.json'; $tmp = $f . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (@file_put_contents($tmp, json_encode($a, JSON_UNESCAPED_SLASHES), LOCK_EX) === false) return false;
    @chmod($tmp, 0600);
    if (!@rename($tmp, $f)) { @unlink($tmp); return false; }
    return true;
}
function pushLock() { $lk = @fopen(pushPrivDir() . '/push-subscriptions.json.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX)) fail('Could not save that. Try again.', 500); return $lk; }
function pushHash(string $endpoint): string { return substr(hash('sha256', $endpoint), 0, 16); }

if ($action === 'pushkey') {
    $v = pushVapid(true);
    if (!$v) fail('Alerts are not set up on this server yet.', 503);
    out(['ok' => true, 'publicKey' => $v['publicKey']]);
}
if ($action === 'pushsubscribe' || $action === 'pushunsubscribe') {
    if (!$isPost) fail('POST required', 405);
    $pid = (string) ($session['c'] ?? ''); if ($pid === '') fail('Sign in first.', 401);
    $lk = pushLock(); $subs = pushSubs();
    if ($action === 'pushsubscribe') {
        $sub = $body['subscription'] ?? null;
        if (!is_array($sub) || ($err = webpushSubscriptionError($sub)) !== null) fail('That subscription is not usable: ' . ($err ?? 'missing') . '.');
        $h = pushHash((string) $sub['endpoint']);
        foreach ($subs as $p => $devs) { unset($subs[$p][$h]); if (!$subs[$p]) unset($subs[$p]); }   /* a shared iPad: the phone follows whoever signed in */
        $old = (string) ($body['replaces'] ?? ''); if ($old !== '') foreach ($subs as $p => $devs) unset($subs[$p][pushHash($old)]);
        if (count($subs[$pid] ?? []) >= PUSH_MAX_DEVICES) {   /* full: the phone seen longest ago makes room (never the one being added) */
            uasort($subs[$pid], fn($x, $y) => $x['seen'] <=> $y['seen']); unset($subs[$pid][array_key_first($subs[$pid])]);
        }
        $subs[$pid][$h] = ['sub' => ['endpoint' => (string) $sub['endpoint'], 'keys' => ['p256dh' => (string) $sub['keys']['p256dh'], 'auth' => (string) $sub['keys']['auth']]],
                           'device' => substr(preg_replace('/[^A-Za-z0-9 .\'-]/', '', (string) ($body['device'] ?? 'device')), 0, 30), 'name' => $me, 'at' => time(), 'seen' => time()];
        if (!pushSave($subs)) fail('Could not save that. Try again.', 500);
        out(['ok' => true, 'devices' => count($subs[$pid])]);
    }
    $h = pushHash((string) ($body['endpoint'] ?? ''));
    foreach ($subs as $p => $devs) { unset($subs[$p][$h]); if (!$subs[$p]) unset($subs[$p]); }
    if (!pushSave($subs)) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
if ($action === 'pushtest') {
    if (!$isPost) fail('POST required', 405);
    $v = pushVapid(false); if (!$v) fail('Alerts are not set up on this server yet.', 503);
    $devs = pushSubs()[(string) ($session['c'] ?? '')] ?? [];
    if (!$devs) fail('This sign-in has no phone with alerts on yet.');
    $ok = 0; $msgs = [];
    foreach ($devs as $d) {
        $r = webpushSend($d['sub'], json_encode(['title' => 'Test alert', 'body' => 'Alerts work on this ' . $d['device'] . '. Storm and fire warnings will look like this.', 'url' => './', 'tag' => 'test', 'at' => time()]), $v, 300, ['urgency' => 'high']);
        if ($r['ok']) $ok++; else $msgs[] = $r['error'] ?: ('status ' . $r['status']);
    }
    out(['ok' => true, 'sent' => $ok, 'of' => count($devs), 'errors' => $msgs]);
}
if ($action === 'pushlatest') {
    $sent = json_decode((string) @file_get_contents(DATA_DIR . '/push-sent.json'), true) ?: [];
    $best = null; foreach ($sent as $id => $s) if (($s['at'] ?? 0) > time() - 3 * 3600 && (!$best || $s['at'] > $best[1]['at'])) $best = [$id, $s];
    out(['ok' => true, 'alert' => $best ? ['title' => $best[1]['title'], 'body' => $best[1]['body'], 'url' => './', 'tag' => (string) $best[0], 'id' => (string) $best[0]] : null]);
}
if ($action === 'stormcron') {
    if (!(PHP_SAPI === 'cli' && defined('SIXFOLD_CLI'))) fail('Not here.', 404);
    if (!feature('hail')) out(['ok' => true, 'note' => 'Hail is off for this company.']);
    out(['ok' => true] + stormRefresh(!empty($_GET['force'])));
}
if ($action === 'pushcron') {
    if (!defined('SIXFOLD_CLI')) fail('Not here.', 404);
    $dry = !empty($_REQUEST['dry']);
    $sf = DATA_DIR . '/push-sent.json';
    $clk = @fopen($sf . '.lock', 'c');
    if (!$clk || !flock($clk, LOCK_EX | LOCK_NB)) out(['ok' => true, 'busy' => true]);
    $v = pushVapid(false);
    if (!$v) out(['ok' => true, 'note' => 'No key yet: nobody has turned alerts on.', 'pushed' => []]);
    $al = freshAlerts(240);
    $sent = json_decode((string) @file_get_contents($sf), true) ?: [];
    foreach ($sent as $id => $s) if (($s['at'] ?? 0) < time() - 7 * 86400) unset($sent[$id]);
    $subs = pushSubs(); $changed = false;
    /* who is who now: removed people's phones are dropped; roles decide storm alerts */
    $byId = []; foreach (acctRows($basePeople, $acct, $sessionKey) as $r) if (!$r['off']) $byId[$r['id']] = $r;
    $townsOf = []; $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $label = [];
    foreach (($idx['regions'] ?? []) as $rg) { $label[$rg['key']] = $rg['label']; foreach (loadAssign($rg['key']) as $who) $townsOf[$who][$rg['key']] = true; }
    $co = company(); $stormAll = feature('hail') && (($co['card']['hail'] ?? true) !== false); $stormAdmins = feature('hail');
    $fireOn = ($co['card']['fire'] ?? true) !== false;   /* 2026-10-06: fire warnings only where the company shows fire (not a roofer's app) */
    $list = alertEvents();
    if ($list !== null && !feature('hail')) $stormAll = true;   /* an edition's storm warnings are for everyone's safety */
    $pushed = [];
    foreach (($al['weather'] ?? []) as $w) {
        $id = (string) ($w['id'] ?? ''); $ev = (string) ($w['event'] ?? '');
        if ($list === null) { $storm = in_array($ev, PUSH_STORM, true); $fire = $fireOn && in_array($ev, PUSH_FIRE, true); }
        else { $storm = in_array($ev, $list, true) && in_array($ev, array_merge(PUSH_STORM, PUSH_FREEZE), true); $fire = in_array($ev, $list, true) && in_array($ev, PUSH_FIRE, true); }
        if ($id === '' || (!$storm && !$fire) || isset($sent[$id])) continue;
        $ends = strtotime((string) ($w['ends'] ?? '')) ?: time() + 3600;
        if ($ends < time()) continue;
        $towns = array_values((array) ($w['towns'] ?? []));
        $until = (new DateTime('@' . $ends))->setTimezone(new DateTimeZone(appTz()))->format('g:i a');
        $bodyTxt = implode(', ', array_map(fn($t) => $label[$t] ?? $t, $towns)) . ' · until ' . $until
                 . (!empty($w['hail']) ? ' · hail up to ' . rtrim(rtrim(number_format((float) $w['hail'], 2), '0'), '.') . ' in' : '') . (!empty($w['wind']) ? ' · gusts ' . strtolower((string) $w['wind']) : '');
        $payload = json_encode(['title' => $ev, 'body' => $bodyTxt, 'url' => './', 'tag' => substr(sha1($id), 0, 16), 'id' => $id, 'at' => time()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $ttl = max(60, min(6 * 3600, $ends - time()));
        $to = 0; $ok = 0; $gone = 0;
        foreach ($subs as $pid => $devs) {
            $p = $byId[$pid] ?? null;
            if (!$p) { unset($subs[$pid]); $changed = true; continue; }
            if ($storm && !($stormAll || ($stormAdmins && $p['role'] === 'admin'))) continue;
            $mine = array_keys($townsOf[$p['name']] ?? []);
            if ($mine && !array_intersect($mine, $towns)) continue;
            foreach ($devs as $h => $dv) {
                $to++;
                if ($dry) continue;
                $r = webpushSend($dv['sub'], $payload, $v, $ttl, ['urgency' => 'high', 'topic' => substr(sha1($id), 0, 32)]);
                if ($r['ok']) $ok++;
                elseif ($r['gone'] && time() - (int) ($dv['at'] ?? 0) > 120) { unset($subs[$pid][$h]); $changed = true; $gone++; }   /* a brand-new subscription can answer 410 for a minute (tested) */
                if (($r['status'] ?? 0) === 429) break 3;
            }
        }
        if (!$dry) $sent[$id] = ['at' => time(), 'event' => $ev, 'towns' => $towns, 'title' => $ev, 'body' => $bodyTxt, 'to' => $to, 'ok' => $ok, 'gone' => $gone];
        $pushed[] = ['event' => $ev, 'towns' => $towns, 'to' => $to, 'ok' => $ok, 'gone' => $gone];
    }
    if (!$dry) {
        foreach ($subs as $p => $d) if (!$d) unset($subs[$p]);
        if ($changed) { $lk = pushLock(); pushSave($subs); }
        @file_put_contents($sf, json_encode($sent, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
        if ($pushed) @file_put_contents(DATA_DIR . '/push.log', json_encode(['at' => time(), 'pushed' => $pushed]) . "\n", FILE_APPEND | LOCK_EX);
    }
    out(['ok' => true, 'dry' => $dry, 'pushed' => $pushed, 'phones' => array_sum(array_map('count', $subs))]);
}

if ($action === 'leads') {
    if (!desk() && $role !== 'manager') fail('Not allowed.', 403);
    $leads = leadsAll();
    /* a manager sees the leads nobody owns yet and their own team's */
    if (!desk()) $leads = array_filter($leads, fn($l) => $l['owner'] === '' || $l['owner'] === $me || sameTeam($l['owner']));
    $list = array_reverse(array_values($leads)); // later in the file = newer, for leads filed in the same second (usort is stable)
    usort($list, fn($a, $b) => ($b['at'] ?? 0) <=> ($a['at'] ?? 0));
    $new = count(array_filter($list, fn($l) => $l['status'] === 'new'));
    if (!empty($_REQUEST['count'])) out(['ok' => true, 'new' => $new]);
    out(['ok' => true, 'new' => $new, 'leads' => $list]);
}

if ($action === 'leadadd') {
    if (!desk()) fail('Not allowed.', 403);
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
    if (!desk()) fail('Not allowed.', 403);
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

/* how a call went (2026-10-14, Sixfold's lead desk): No answer, Left voicemail, Talked to them. Each try is kept with who and when;
 * the page works out when to try again and when to give up (after 4). Talking to them moves a New lead to Contacted. */
if ($action === 'leadtry') {
    if (!feature('walkdesk')) fail('Not here.', 404);
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $all = leadsAll();
    if (!leadOk($id) || !isset($all[$id])) fail('No such lead.', 404);
    $own = (string) $all[$id]['owner'];
    if (!desk() && !($own !== '' && canManage($own))) fail('Not allowed.', 403);
    $o = (string) ($body['o'] ?? '');
    if ($o === 'undo') {
        $mine = array_values(array_filter($all[$id]['tries'], fn($t) => $t['by'] === $me && $t['at'] > time() - 3600));
        if (!$mine) fail('Nothing of yours to undo in the last hour.');
        if (!appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'untry' => end($mine)['at'], 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
        out(['ok' => true]);
    }
    if (!in_array($o, ['none', 'vm', 'talk'], true)) fail('Say how the call went.');
    $row = ['id' => $id, 'try' => $o, 'by' => $me, 'at' => time()];
    if ($o === 'talk' && $all[$id]['status'] === 'new') $row['status'] = 'contacted';
    if (!appendLine(leadsDir() . '/leadst.log', $row)) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
if ($action === 'leadstatus') {
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? '');
    if (!preg_match('/^[wm]\d{14}[0-9a-f]{6}$/D', $id)) fail('No such lead.', 404);
    $own = (string) (leadsAll()[$id]['owner'] ?? '');
    if (!desk() && !($own !== '' && canManage($own))) fail('Not allowed.', 403);
    $known = false; foreach (readLines(leadsDir() . '/leads.log') as $l) if ($l['id'] === $id) { $known = true; break; }
    if (!$known) fail('No such lead.', 404);
    $status = (string) ($body['status'] ?? ''); $note = $clean($body['note'] ?? '', 500);
    if ($status !== '' && !in_array($status, LEAD_STATUS, true)) fail('Bad status.');
    if ($status === '' && $note === '') fail('Nothing to save.');
    $row = ['id' => $id, 'by' => $me, 'at' => time()]; if ($status !== '') $row['status'] = $status; if ($note !== '') $row['note'] = $note;
    if (!appendLine(leadsDir() . '/leadst.log', $row)) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

/* security edition: the town figures, and neighbourhoods ranked by reported property crime nearby (data/rounds/security-*.json) */
/* ---- crime map (Matthew 2026-10-06, TraverseSecurity: "a crime map like a live radar") ----
 * Property crime reported to the police in the last 90 days, counted in squares of about 280 m: a square, never a house or a
 * point. Three cities publish their reports with a map point (2026-10-07):
 *   Colorado Springs: policedata.coloradosprings.gov, dataset bc88-hemr (never domestic)
 *   Denver: the city's open data, ArcGIS ODC_CRIME_OFFENSES_P layer 324
 *   Boulder: Boulder Police Department, ArcGIS BPD_Offenses layer 0
 * The same four kinds everywhere (burglary; vehicle theft and break-ins; other theft, not shoplifting; vandalism), as the security
 * build counts them per door. Refreshed at most every 12 hours; a city that fails keeps its last good map. */
const SECMAP_KINDS = ['Burglary/Breaking & Entering' => 'b', 'Motor Vehicle Theft' => 'v', 'Theft From Motor Vehicle' => 'v',
    'Theft Of Motor Vehicle Parts' => 'v', 'All Other Larceny' => 't', 'Theft From Building' => 't', 'Destruction/Damage/Vandalism of Property' => 'd'];
const SECMAP_BOULDER_KINDS = ['Burglary / Breaking and Entering' => 'b', 'Motor Vehicle Theft' => 'v', 'Theft from a Motor Vehicle' => 'v',
    'Theft of Motor Vehicle Parts or Accessories' => 'v', 'All Other Larceny' => 't', 'Theft from a Building' => 't', 'Destruction / Damage / Vandalism of Property' => 'd'];
const SECMAP_CITIES = [   /* box: N, W, S, E with a margin; centre: where the map opens on that city */
    'cs' => ['name' => 'Colorado Springs', 'source' => 'Colorado Springs Police Department', 'box' => [39.08, -104.95, 38.68, -104.55], 'centre' => [38.88, -104.76], 'zoom' => 11],
    'denver' => ['name' => 'Denver', 'source' => 'Denver Police Department', 'box' => [39.92, -105.11, 39.61, -104.60], 'centre' => [39.74, -104.93], 'zoom' => 11],
    'boulder' => ['name' => 'Boulder', 'source' => 'Boulder Police Department', 'box' => [40.10, -105.32, 39.95, -105.17], 'centre' => [40.015, -105.26], 'zoom' => 12],
];
const SECMAP_DY = 0.0025, SECMAP_DX = 0.0032, SECMAP_DAYS = 90, SECMAP_AGE = 12 * 3600;
function secMapGet(string $url): ?array {
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 40, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_HTTPHEADER => [agentHeader(), 'Accept: application/json']]);
        $body = curl_exec($c); $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c);
        if ($body === false || $code !== 200) return null;
        $j = json_decode((string) $body, true); return is_array($j) ? $j : null;
    }
    return httpJsonPlain($url, [agentHeader(), 'Accept: application/json']);
}
/** one city's reports as [case id, kind, day, lat, lon]; null when the city's service did not answer */
function secMapRows(string $city): ?array {
    $since = date('Y-m-d', time() - (SECMAP_DAYS + 1) * 86400); $out = [];
    if ($city === 'cs') {
        [$n, $w, $s, $e] = SECMAP_CITIES['cs']['box'];
        $kinds = implode(',', array_map(fn($k) => "'" . str_replace("'", "''", $k) . "'", array_keys(SECMAP_KINDS)));
        $where = "reporteddate > '$since' AND domestic = 'No' AND crimecodedescription IN ($kinds) AND within_box(location_point, $n, $w, $s, $e)";
        for ($off = 0; $off < 200000; $off += 50000) {
            $rows = secMapGet('https://policedata.coloradosprings.gov/resource/bc88-hemr.json?' . http_build_query(['$select' => 'casenumber,reporteddate,crimecodedescription,location_point',
                '$where' => $where, '$limit' => 50000, '$offset' => $off, '$order' => 'casenumber']));
            if (!is_array($rows)) return null;
            foreach ($rows as $r) { $pt = $r['location_point']['coordinates'] ?? null; $k = SECMAP_KINDS[$r['crimecodedescription'] ?? ''] ?? null;
                if ($k && is_array($pt) && count($pt) >= 2) $out[] = ['C' . ($r['casenumber'] ?? ''), $k, substr((string) ($r['reporteddate'] ?? ''), 0, 10), (float) $pt[1], (float) $pt[0]]; }
            if (count($rows) < 50000) break;
        }
        return $out;
    }
    $ts = "TIMESTAMP '$since 00:00:00'";
    if ($city === 'denver') { $url = 'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_CRIME_OFFENSES_P/FeatureServer/324/query';
        $q = ['where' => "REPORTED_DATE > $ts AND IS_CRIME = 1 AND OFFENSE_CATEGORY_ID IN ('burglary','auto-theft','theft-from-motor-vehicle','larceny','public-disorder')",
              'outFields' => 'INCIDENT_ID,OFFENSE_CATEGORY_ID,OFFENSE_TYPE_ID,REPORTED_DATE,GEO_LAT,GEO_LON', 'returnGeometry' => 'false', 'f' => 'json'];
    } elseif ($city === 'boulder') { $url = 'https://services.arcgis.com/ePKBjXrBZ2vEEgWd/arcgis/rest/services/BPD_Offenses/FeatureServer/0/query';
        $q = ['where' => "Report_Date > $ts", 'outFields' => 'Report_Number,nibrs_offense,Report_Date', 'returnGeometry' => 'true', 'outSR' => '4326', 'f' => 'json'];
    } else return null;
    for ($off = 0; $off < 100000; $off += 2000) {
        $j = secMapGet($url . '?' . http_build_query($q + ['resultOffset' => $off, 'resultRecordCount' => 2000]));
        if (!is_array($j) || isset($j['error'])) return null;
        foreach (($j['features'] ?? []) as $f) {
            $a = $f['attributes'] ?? [];
            if ($city === 'denver') {
                $cat = (string) ($a['OFFENSE_CATEGORY_ID'] ?? ''); $type = (string) ($a['OFFENSE_TYPE_ID'] ?? '');
                $k = $cat === 'burglary' ? 'b' : (($cat === 'auto-theft' || $cat === 'theft-from-motor-vehicle') ? 'v'
                    : (($cat === 'larceny' && !preg_match('/shoplift|services/', $type)) ? 't' : (preg_match('/^criminal-mischief/', $type) ? 'd' : null)));
                if ($k && is_numeric($a['GEO_LAT'] ?? null) && is_numeric($a['GEO_LON'] ?? null)) $out[] = ['D' . ($a['INCIDENT_ID'] ?? ''), $k, date('Y-m-d', (int) (($a['REPORTED_DATE'] ?? 0) / 1000)), (float) $a['GEO_LAT'], (float) $a['GEO_LON']];
            } else {
                $k = SECMAP_BOULDER_KINDS[(string) ($a['nibrs_offense'] ?? '')] ?? null; $g = $f['geometry'] ?? [];
                if ($k && is_numeric($g['y'] ?? null) && is_numeric($g['x'] ?? null)) $out[] = ['B' . ($a['Report_Number'] ?? ''), $k, date('Y-m-d', (int) (($a['Report_Date'] ?? 0) / 1000)), (float) $g['y'], (float) $g['x']];
            }
        }
        if (empty($j['exceededTransferLimit']) && count($j['features'] ?? []) < 2000) break;
    }
    return $out;
}
/** one city's map: the squares with reports, [row, col, b, v, t, d, of them in the last 30 days], from the box's north-west corner */
function secMapCity(string $city): ?array {
    $rows = secMapRows($city); if ($rows === null) return null;
    [$n, $w] = SECMAP_CITIES[$city]['box']; $seen = []; $cells = []; $through = ''; $d30 = date('Y-m-d', time() - 30 * 86400);
    foreach ($rows as [$id, $k, $day, $la, $lo]) {
        $key0 = $id . '|' . $k; if (isset($seen[$key0])) continue; $seen[$key0] = 1;   /* one case, several offences: once per kind */
        $row = (int) floor(($n - $la) / SECMAP_DY); $col = (int) floor(($lo - $w) / SECMAP_DX);
        if ($row < 0 || $col < 0) continue;
        $key = $row . ',' . $col;
        if (!isset($cells[$key])) $cells[$key] = [$row, $col, 0, 0, 0, 0, 0];
        $cells[$key][['b' => 2, 'v' => 3, 't' => 4, 'd' => 5][$k]]++;
        if ($day >= $d30) $cells[$key][6]++;
        if ($day > $through) $through = $day;
    }
    $c = SECMAP_CITIES[$city];
    return ['name' => $c['name'], 'source' => $c['source'], 'centre' => $c['centre'], 'zoom' => $c['zoom'], 'through' => $through, 'at' => time(),
            'grid' => ['lat0' => $n, 'lon0' => $w, 'dy' => SECMAP_DY, 'dx' => SECMAP_DX], 'cells' => array_values($cells)];
}
/* ---- frost and rain (2026-10-07, TraverseYards) ----
 * climate.json (data-pipeline/door-territory/climate/build-climate.mjs) holds each town's frost dates (NOAA 1991-2020 normals at
 * the nearest station that has them), that station's year-to-date normal rain by day, and the nearest rain gauges. Here: the last
 * 30 days of rain at the first gauge that reported most of them (NCEI Access Data Service, daily summaries; no key), against the
 * normal for the same 30 days. Fetched at most every 6 hours per town; a failed fetch keeps the last answer. */
if ($action === 'climate') {
    if (!crewSees($role) || company()['best'] !== 'yards') fail('Not here.', 404);
    $ckey = (string) ($_GET['region'] ?? '');
    $C = json_decode((string) @file_get_contents(DATA_DIR . '/climate.json'), true) ?: [];
    $t = $C['towns'][$ckey] ?? null;
    if (!$t) out(['ok' => true, 'climate' => null]);
    $res = ['frost' => $t['frost'] ?? null, 'rain' => null];
    if (!empty($t['gauges'])) {
        $cf = DATA_DIR . '/climate-cache.json';
        $cache = json_decode((string) @file_get_contents($cf), true) ?: [];
        $hit = $cache[$ckey] ?? null;
        if (!$hit || ($hit['at'] ?? 0) < time() - 6 * 3600) {
            $url = 'https://www.ncei.noaa.gov/access/services/data/v1?' . http_build_query(['dataset' => 'daily-summaries', 'stations' => implode(',', array_column($t['gauges'], 0)),
                'startDate' => date('Y-m-d', time() - 45 * 86400), 'endDate' => date('Y-m-d'), 'dataTypes' => 'PRCP', 'units' => 'standard', 'format' => 'json']);
            $rows = httpJsonPlain($url, [agentHeader(), 'Accept: application/json']);
            if (is_array($rows)) {
                $by = [];
                foreach ($rows as $r) { $p = trim((string) ($r['PRCP'] ?? '')); if ($p !== '' && is_numeric($p)) $by[(string) $r['STATION']][(string) $r['DATE']] = (float) $p; }
                $rain = null;
                foreach ($t['gauges'] as [$gid, $gname, $gkm]) {          /* nearest first: the first that reported at least 24 of its last 30 days */
                    if (empty($by[$gid])) continue;
                    $days = $by[$gid]; ksort($days); $thru = array_key_last($days);
                    $from = date('Y-m-d', strtotime($thru) - 29 * 86400);
                    $win = array_filter($days, fn($v, $d) => $d >= $from && $d <= $thru, ARRAY_FILTER_USE_BOTH);
                    if (count($win) < 24) continue;
                    $rain = ['in' => round(array_sum($win), 2), 'days' => count($win), 'from' => $from, 'through' => $thru, 'gauge' => $gname, 'km' => $gkm];
                    break;
                }
                /* the normal for those 30 days, from the frost station's year-to-date normals */
                if ($rain && !empty($t['ytd']) && !empty($C['ytdDays'])) {
                    $pos = array_flip($C['ytdDays']);
                    $at = function (string $ymd) use ($pos, $t) { $k = substr($ymd, 5); return $t['ytd'][$pos[$k] ?? ($pos[$k === '02-29' ? '02-28' : $k] ?? 0)] ?? null; };
                    $end = $at($rain['through']); $before = $at(date('Y-m-d', strtotime($rain['from']) - 86400));
                    if ($end !== null && $before !== null) $rain['normal'] = round($end >= $before ? $end - $before : end($t['ytd']) - $before + $end, 2);
                }
                $hit = ['at' => time(), 'rain' => $rain];
                $cache[$ckey] = $hit; writeJsonAtomic($cf, $cache);
            }
        }
        $res['rain'] = $hit['rain'] ?? null;
    }
    out(['ok' => true, 'climate' => $res]);
}
if ($action === 'secmap') {
    if (!securityOn($role)) fail('Not here.', 404);
    $f = DATA_DIR . '/secmap-cache.json';
    $m = is_readable($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : [];
    if (!isset($m['cities']) || !is_array($m['cities'])) $m = ['cities' => []];   /* a cache from before 2026-10-07 held Colorado Springs alone */
    $stale = array_filter(array_keys(SECMAP_CITIES), fn($k) => (($m['cities'][$k]['at'] ?? 0) < time() - SECMAP_AGE));
    if ($stale) {
        $fp = @fopen($f . '.lock', 'c');
        if ($fp && flock($fp, LOCK_EX | LOCK_NB)) {
            @set_time_limit(120); $changed = false;
            foreach ($stale as $k) { $fresh = secMapCity($k); if ($fresh) { $m['cities'][$k] = $fresh; $changed = true; } }   /* a city that fails keeps its last map */
            if ($changed) { $m['at'] = time(); writeJsonAtomic($f, $m); }
            flock($fp, LOCK_UN); fclose($fp);
        }
    }
    if (!$m['cities']) fail('The police maps could not be reached. Try again in a few minutes.', 503);
    foreach ($m['cities'] as $k => $c) $m['cities'][$k]['stale'] = (($c['at'] ?? 0) < time() - SECMAP_AGE);
    out(['ok' => true, 'days' => SECMAP_DAYS, 'cities' => $m['cities']]);
}

if ($action === 'secrates' || $action === 'seclist') {
    if (!securityOn($role)) fail('Not here.', 404);
    if ($action === 'secrates') out(['ok' => true] + (json_decode((string) @file_get_contents(DATA_DIR . '/security-rates.json'), true) ?: []));
    $ar = json_decode((string) @file_get_contents(DATA_DIR . '/security-areas.json'), true) ?: [];
    $rows = [];
    $zero = ['b' => 0, 'v' => 0, 't' => 0, 'd' => 0];
    foreach (($ar['towns'] ?? []) as $town => $areas) foreach ((array) $areas as $name => $c) $rows[] = ['region' => (string) $town, 'town' => regionLabel((string) $town), 'area' => (string) $name,
        'd30' => array_replace($zero, (array) ($c['d30'] ?? [])), 'd90' => array_replace($zero, (array) ($c['d90'] ?? [])), 'doors' => (int) ($c['doors'] ?? 0)];
    $sum = fn($c) => array_sum(array_map('intval', (array) $c));
    usort($rows, fn($a, $b) => [$sum($b['d90']), $sum($b['d30'])] <=> [$sum($a['d90']), $sum($a['d30'])]);
    out(['ok' => true, 'through' => (string) ($ar['through'] ?? ''), 'source' => (string) ($ar['source'] ?? ''), 'areas' => $rows]);
}

/* what is in season this month (pest edition): data/rounds/pest-season.json, each line from a named source */
if ($action === 'pestseason') {
    if (!pestOn($role)) fail('Not here.', 404);
    $cal = json_decode((string) @file_get_contents(DATA_DIR . '/pest-season.json'), true) ?: [];
    $mo = (int) (new DateTime('now', new DateTimeZone(appTz())))->format('n'); $now = [];
    foreach (($cal['pests'] ?? []) as $k => $pz) if (in_array($mo, (array) ($pz['months'] ?? []), true)) $now[] = ['k' => (string) $k, 'name' => (string) ($pz['name'] ?? $k), 'line' => (string) ($pz['line'] ?? ''), 'src' => (string) ($pz['src'] ?? '')];
    out(['ok' => true, 'month' => $mo, 'pests' => $now]);
}

if (in_array($action, ['customers', 'customersave', 'customerfrom', 'customerimport', 'visitsave', 'customersexport', 'backup', 'backups', 'backupget'], true)) {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $tz = new DateTimeZone(appTz());
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
        exportLog(['what' => 'backup copy']);
        header('Content-Disposition: attachment; filename="' . substr($n, 0, -3) . '"');   /* the same JSON as a fresh download */
        header('Cache-Control: no-store');
        echo $json;
        exit;
    }
    if ($action === 'backup') {
        $files = [];
        $add = function (string $abs, string $rel) use (&$files) { if (is_file($abs) && is_readable($abs)) $files[$rel] = (string) file_get_contents($abs); };
        foreach ((glob(DATA_DIR . '/*.log') ?: []) as $p) $add($p, 'sixfold-data/rounds/' . basename($p));
        /* the settings the app writes as whole files (review 2026-10-06: personal goals, the lessons and the roof prices
           were not in the backup, so a lost server lost them). Keep in step with sixfold-tools/nightly-backup.php. */
        foreach (['goals.json', 'goals-people.json', 'training.json', 'roof-settings.json'] as $n) $add(DATA_DIR . '/' . $n, 'sixfold-data/rounds/' . $n);
        foreach ((glob(leadsDir() . '/*.log') ?: []) as $p) $add($p, 'sixfold-data/leads/' . basename($p));
        foreach ((glob(custDir() . '/*.log') ?: []) as $p) $add($p, 'sixfold-data/customers/' . basename($p));
        $photos = [];
        foreach ((glob(DATA_DIR . '/photos/*/*/*') ?: []) as $p) $photos[] = 'sixfold-data/rounds/photos/' . substr($p, strlen(DATA_DIR . '/photos/'));
        $doc = ['backup' => company()['name'] . ' field tools', 'made' => date('c'), 'by' => $me,
                'restore' => 'Each entry in "files" is a log the app reads. To rebuild, put each one back at its path beside public_html (sixfold-data/...). Lines are JSON, one change per line, oldest first. Sign-in codes and the app-made sign-ins are not included (re-create those people in Accounts); photos are listed, not copied.',
                'files' => $files, 'photos' => $photos];
        accountLog(['by' => $me, 'what' => 'backup', 'n' => count($files)]);
        header('Content-Type: application/json; charset=utf-8');
        exportLog(['what' => 'full backup']);
        header('Content-Disposition: attachment; filename="sixfold-backup-' . date('Y-m-d-His') . '.json"');
        header('Cache-Control: no-store');
        echo json_encode($doc, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }
    if ($action === 'customersexport') {
        $cs = loadCustomers(); $vs = loadVisits();
        exportLog(['what' => 'customers']);
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
        foreach (['start', 'next', 'reviewAsked'] as $k) if (array_key_exists($k, $in)) { $d = (string) $in[$k]; if ($d !== '' && !dateOk($d)) fail('That is not a real date.'); $f[$k] = $d; }   /* reviewAsked 2026-10-13 */
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
    /* customer import (2026-10-06): a company's existing customers from its old software, matched to doors by address so the
       pest card can say "3 neighbours on service" from day one. Up to 500 rows a call. A bad optional value is dropped, never
       the row; a row with no name is skipped; a door that already has a customer is not doubled. */
    if ($action === 'customerimport') {
        $rows = $body['rows'] ?? null;
        if (!is_array($rows) || !$rows) fail('Nothing to import.');
        if (count($rows) > 500) fail('Import 500 at a time.');
        $norm = function ($s): string {
            $s = strtoupper((string) $s); $s = preg_replace('/\b(APT|UNIT|STE|SUITE|#)\b.*$/', '', $s); $s = preg_replace('/[.,#]/', ' ', $s);
            $map = ['STREET' => 'ST', 'AVENUE' => 'AVE', 'DRIVE' => 'DR', 'ROAD' => 'RD', 'LANE' => 'LN', 'COURT' => 'CT', 'CIRCLE' => 'CIR', 'PLACE' => 'PL',
                    'BOULEVARD' => 'BLVD', 'TERRACE' => 'TER', 'TRAIL' => 'TRL', 'PARKWAY' => 'PKWY', 'HIGHWAY' => 'HWY', 'POINT' => 'PT', 'NORTH' => 'N', 'SOUTH' => 'S', 'EAST' => 'E', 'WEST' => 'W'];
            $w = preg_split('/\s+/', trim((string) $s)) ?: []; return implode(' ', array_map(fn($x) => $map[$x] ?? $x, $w));
        };
        $byAddr = []; $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
        foreach (($idx['regions'] ?? []) as $rg) {
            if (!empty($rg['admin'])) continue;
            $rd = loadRegion((string) $rg['key']); if (!$rd) continue;
            foreach ($rd['areas'] as $a) foreach ($a['doors'] as $d) $byAddr[$norm($d['address'])] = [(string) $rg['key'], (string) $d['id'], (string) $d['address']];
        }
        $have = []; foreach ($cs as $c) if (!empty($c['door']) && ($c['status'] ?? 'active') !== 'ended') $have[(string) $c['door']] = true;
        $made = 0; $matched = 0; $dupes = 0; $skipped = 0; $unmatched = [];
        $toDate = function ($v): string { $v = trim((string) $v); if (dateOk($v)) return $v; if (preg_match('#^(\d{1,2})/(\d{1,2})/(\d{4})$#', $v, $m) && checkdate((int) $m[1], (int) $m[2], (int) $m[3])) return sprintf('%04d-%02d-%02d', $m[3], $m[1], $m[2]); return ''; };
        foreach ($rows as $r) {
            if (!is_array($r)) { $skipped++; continue; }
            $f = ['name' => $clean($r['name'] ?? '', 120)];
            if (mb_strlen($f['name']) < 2) { $skipped++; continue; }
            $ph = $clean($r['phone'] ?? '', 40); $dg = preg_replace('/\D/', '', $ph); if ($ph !== '' && strlen($dg) >= 10 && strlen($dg) <= 11) $f['phone'] = $ph;
            $em = $clean($r['email'] ?? '', 160); if ($em !== '' && filter_var($em, FILTER_VALIDATE_EMAIL)) $f['email'] = $em;
            foreach (['address' => 160, 'town' => 60, 'notes' => 2000] as $k => $max) { $v = $clean($r[$k] ?? '', $max); if ($v !== '') $f[$k] = $v; }
            $f['plan'] = in_array((string) ($r['plan'] ?? ''), CUST_PLANS, true) ? (string) $r['plan'] : 'oneoff';
            $f['service'] = in_array((string) ($r['service'] ?? ''), custServices(), true) ? (string) $r['service'] : custServices()[0];
            $f['status'] = 'active';
            if (isset($r['price']) && is_numeric($r['price']) && $r['price'] >= 0 && $r['price'] <= 1000000) $f['price'] = (float) $r['price'];
            foreach (['start', 'next'] as $k) { $dv = $toDate($r[$k] ?? ''); if ($dv !== '') $f[$k] = $dv; }
            $hit = isset($f['address']) ? ($byAddr[$norm($f['address'])] ?? null) : null;
            if ($hit) {
                $dk = $hit[0] . '/' . $hit[1];
                if (isset($have[$dk])) { $dupes++; continue; }
                $f['door'] = $dk; $f['address'] = $hit[2]; $f['town'] = regionLabel($hit[0]); $have[$dk] = true; $matched++;
            } elseif (count($unmatched) < 50) $unmatched[] = ($f['address'] ?? '(no address)');
            $f['source'] = 'import';
            $write('c' . date('YmdHis') . bin2hex(random_bytes(3)), $f); $made++;
        }
        out(['ok' => true, 'made' => $made, 'matched' => $matched, 'dupes' => $dupes, 'skipped' => $skipped, 'unmatched' => $unmatched]);
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
        /* quarterly too (review 2026-10-06: the pest plan was in CUST_PLANS and nextDue, but a done visit never moved it on) */
        if ($status === 'done' && in_array($c['plan'] ?? '', ['monthly', 'quarterly', 'yearly'], true)) {
            $cand = nextDue($date, (string) $c['plan']);
            if (empty($c['next']) || $cand > $c['next']) { $next = $cand; $write($cid, ['next' => $next]); }
        }
        out(['ok' => true, 'vid' => $vid, 'next' => $next]);
    }
}

if ($action === 'matfix') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? ''); $id = (string) ($body['id'] ?? ''); $m = (string) ($body['m'] ?? '');
    if (!regionAvailable($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    if ($m !== '' && !in_array($m, MAT_KEYS, true)) fail('Pick a roof material.');
    if (!appendMatFix($key, ['id' => $id, 'm' => $m === '' ? null : $m, 'by' => $me, 'at' => tapTime($body)])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
if ($action === 'lawnfix') {
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    $lv  = $body['lv'] ?? null;
    if (!regionAvailable($key)) fail('No such region.', 404);
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
    if (!regionAvailable($key)) fail('No such region.', 404);
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
/** review 2026-10-11: names starting Claude or Fable are hidden from boards and pickers (Traverse's own test sign-ins), so an account
    made or renamed in the app may not take one: it would be a sign-in nobody sees on the leaderboard */
function acctNameReserved(string $n): bool { return boardHidden($n); }
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
/* ---- billing (2026-10-10, api/billing.php): the admin sees the plan, pays through Stripe Checkout, manages it in Stripe's portal.
 * Nothing here locks anyone out. */
if (in_array($action, ['billing', 'billingcheckout', 'billingportal'], true)) {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!feature('billing')) fail('Billing is not on for this install.', 403);
    $bc = billingConfig(__DIR__);
    $rows = acctRows($basePeople, $acct, $sessionKey);
    if ($action === 'billing') out(['ok' => true] + billingState($bc, $rows));
    if (!$isPost) fail('POST required', 405);
    if (!billingConfigured($bc)) fail('Billing is not set up yet: the Stripe keys are missing.', 503);
    $back = billingBack($bc, (string) ($body['back'] ?? ''));
    if ($back === null) fail('Open Billing from the app and try again.');
    $b = billingLoad();
    if ($action === 'billingportal') {
        if (empty($b['customer'])) fail('There is no Stripe customer yet. Pick a plan first.');
        $r = stripeCall($bc, 'POST', '/v1/billing_portal/sessions', ['customer' => (string) $b['customer'], 'return_url' => $back]);
        if (isset($r['error']) || empty($r['url'])) fail($r['error'] ?? 'Stripe did not open the billing page.', 502);
        billingLog(['what' => 'portal', 'by' => $me]);
        out(['ok' => true, 'url' => (string) $r['url']]);
    }
    if (in_array($b['status'] ?? '', array_merge(BILLING_GOOD, ['past_due', 'unpaid']), true)) fail('There is a plan already. Change it in Manage billing.');
    $plan = (string) ($body['plan'] ?? ''); $iv = (string) ($body['interval'] ?? ''); $seats = (int) ($body['seats'] ?? 0); $addon = !empty($body['addon']);
    $cf = billingCheckoutFields($bc, $b, $plan, $iv, $seats, $addon, $back);
    if (isset($cf['error'])) fail($cf['error']);
    $r = stripeCall($bc, 'POST', '/v1/checkout/sessions', $cf['fields']);
    if (isset($r['error']) || empty($r['url'])) fail($r['error'] ?? 'Stripe did not open the payment page.', 502);
    billingLog(['what' => 'checkout', 'by' => $me, 'plan' => $plan, 'interval' => $iv, 'seats' => $plan === 'duo' ? 1 : $seats, 'addon' => $addon, 'session' => (string) ($r['id'] ?? '')]);
    out(['ok' => true, 'url' => (string) $r['url']]);
}

/* the door list (2026-10-11, Matthew): the Plan builds the file; the server says yes only to the super admin, at most EXPORT_MAX doors,
   and logs it. Anyone signed in sees doors on screen; this is the bulk download. */
if ($action === 'planexport') {
    if (!$isSuper) fail('Only Traverse downloads the door list.', 403);
    if (!$isPost) fail('POST required', 405);
    $n = (int) ($body['n'] ?? 0);
    if ($n < 1) fail('Nothing to download.');
    if ($n > EXPORT_MAX) fail('Download ' . EXPORT_MAX . ' doors at a time.');
    exportLog(['what' => 'door list', 'region' => (string) ($body['region'] ?? ''), 'n' => $n]);
    out(['ok' => true, 'max' => EXPORT_MAX]);
}
if ($action === 'exportlog') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $rows = [];   /* readLines() keeps rows with an id; these have none */
    foreach ((array) @file(dirname(accountsFile()) . '/rounds-exports.log', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $ln) { $r = json_decode((string) $ln, true); if (is_array($r) && isset($r['what'], $r['at'])) $rows[] = $r; }
    out(['ok' => true, 'rows' => array_reverse(array_slice($rows, -100))]);
}
/* flags (2026-10-12, Matthew: "flag impossible locations, so if one person filling out door info is in aurora and the other in monument
   it gets flagged"). Worked out from WHERE THE MARKED DOORS ARE, never from anyone's phone: the app does not track location and this
   does not need it. Two marks by one person in different towns, further apart than anyone could drive in the time between them,
   suggest two people on one code. Town centres stand in for the doors, less FLAG_SLACK (10) miles for the size of a town, so a long
   street at each edge never trips it. Admins are left out (an office marks doors from a desk). Also: a person whose code moved
   between phones three or more times in a day (one device at a time logs each move). It flags; it never blocks. */
const FLAG_DAYS = 14, FLAG_SLACK = 10, FLAG_MIN_MILES = 15, FLAG_MPH = 70;
if ($action === 'flags') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $since = time() - FLAG_DAYS * 86400;
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $cent = []; $label = [];
    foreach (($idx['regions'] ?? []) as $r) if (isset($r['key'], $r['c'][0], $r['c'][1])) { $cent[$r['key']] = $r['c']; $label[$r['key']] = (string) ($r['label'] ?? $r['key']); }
    $roleOf = []; foreach ($people as $who) if (is_array($who)) $roleOf[(string) ($who[0] ?? '')] = (string) ($who[1] ?? 'crew');
    $by = [];
    foreach ($cent as $key => $c) {
        $f = DATA_DIR . '/marks-' . $key . '.log'; if (!is_readable($f)) continue;
        foreach ((array) @file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $ln) {
            $m = json_decode((string) $ln, true);
            if (!is_array($m) || (int) ($m['at'] ?? 0) < $since || empty($m['by'])) continue;
            $who = (string) $m['by']; $rl = $roleOf[$who] ?? 'crew';
            if ($rl === 'admin' || $rl === 'super') continue;
            $by[$who][] = [(int) $m['at'], $key];
        }
    }
    $flags = [];
    foreach ($by as $who => $rows) {
        usort($rows, fn($x, $y) => $x[0] <=> $y[0]);
        for ($i = 1; $i < count($rows); $i++) {
            [$t1, $k1] = $rows[$i - 1]; [$t2, $k2] = $rows[$i];
            if ($k1 === $k2) continue;
            $mi = milesBetween((float) $cent[$k1][0], (float) $cent[$k1][1], (float) $cent[$k2][0], (float) $cent[$k2][1]);
            $far = $mi - FLAG_SLACK; if ($far < FLAG_MIN_MILES) continue;
            $hrs = max(1 / 60, ($t2 - $t1) / 3600);
            if ($far / $hrs <= FLAG_MPH) continue;
            $flags[] = ['kind' => 'far', 'who' => $who, 'a' => $label[$k1], 'b' => $label[$k2], 'at1' => $t1, 'at' => $t2, 'miles' => (int) round($mi), 'min' => (int) round(($t2 - $t1) / 60)];
        }
    }
    $moves = [];
    foreach ((array) @file(dirname(accountsFile()) . '/rounds-accounts.log', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $ln) {
        $r = json_decode((string) $ln, true);
        if (!is_array($r) || ($r['what'] ?? '') !== 'elsewhere' || (int) ($r['at'] ?? 0) < $since) continue;
        $day = (new DateTime('@' . (int) $r['at']))->setTimezone(new DateTimeZone(appTz()))->format('Y-m-d');
        $k = (string) ($r['who'] ?? '') . '|' . $day; $moves[$k] = [($moves[$k][0] ?? 0) + 1, (int) $r['at']];
    }
    foreach ($moves as $k => [$n, $at]) if ($n >= 3) $flags[] = ['kind' => 'moves', 'who' => explode('|', $k)[0], 'n' => $n, 'at' => $at];
    usort($flags, fn($x, $y) => $y['at'] <=> $x['at']);
    out(['ok' => true, 'days' => FLAG_DAYS, 'flags' => array_slice($flags, 0, 200)]);
}
function acctAdmins(array $rows): int { $n = 0; foreach ($rows as $r) if (!$r['off'] && $r['role'] === 'admin') $n++; return $n; }
/** a code anyone could guess (2026-10-11, admins pick codes now): one digit six times, or a run up or down like 123456 */
function acctWeakCode(string $c): bool {
    if (preg_match('/^(\d)\1{5}$/D', $c)) return true;
    $up = true; $down = true;
    for ($i = 1; $i < 6; $i++) { $d = ((int) $c[$i] - (int) $c[$i - 1] + 10) % 10; if ($d !== 1) $up = false; if ($d !== 9) $down = false; }
    return $up || $down;
}
/* who does walks (2026-10-14, the walk desk): an admin ticks them in Accounts; the desk books walks only with them */
if ($action === 'walkerset') {
    if (!feature('walkdesk')) fail('Not here.', 404);
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $acctLock = @fopen(accountsFile() . '.lock', 'c');
    if (!$acctLock || !flock($acctLock, LOCK_EX)) fail('Could not save that. Try again.', 500);
    $acct = loadAccounts(); $rows = acctRows($basePeople, $acct, $sessionKey);
    $id = (string) ($body['id'] ?? '');
    if (!isset($rows[$id]) || $rows[$id]['off']) fail('No such account.', 404);
    if ($rows[$id]['role'] === 'super' || boardHidden($rows[$id]['name'])) fail('That sign-in does not do walks.');
    $acct['walker'] = (array) ($acct['walker'] ?? []);
    if (!empty($body['on'])) $acct['walker'][$id] = 1; else unset($acct['walker'][$id]);
    if (!saveAccounts($acct)) fail('Could not save that. Try again.', 500);
    accountLog(['by' => $me, 'what' => !empty($body['on']) ? 'does walks' : 'no walks', 'name' => $rows[$id]['name'], 'id' => $id]);
    out(['ok' => true]);
}
if (in_array($action, ['accounts', 'accountadd', 'accountedit', 'accountcode', 'accountremove', 'accountrestore', 'accountsignout', 'accountpins'], true)) {
    /* managers (Matthew 2026-10-11: "they can remove people right? they should be able to"): the crew on their own team only.
       They add crew (who join their team), give a new code, sign out and remove; roles, teams, PINs and everyone else stay with admins. */
    $isMgr = $role === 'manager';
    if ($role !== 'admin' && !($isMgr && in_array($action, ['accounts', 'accountadd', 'accountcode', 'accountremove', 'accountrestore', 'accountsignout'], true))) fail('Not allowed.', 403);
    if ($isMgr && $myTeam === '') fail('You are not on a team yet. Ask an admin to put you on one.', 403);
    $rows = acctRows($basePeople, $acct, $sessionKey);
    $myId = (string) ($session['c'] ?? '');
    $mgrMay = function (array $r) use ($myTeam): bool { global $acct; return $r['role'] === 'crew' && (string) ($acct['member'][$r['id']] ?? '') === $myTeam; };
    if ($action === 'accounts') {
        $sess = sessLoad(); $live = [];
        foreach ((array) ($sess['s'] ?? []) as $l) {
            $lid = (string) ($l[0] ?? ''); $kick = (int) ($acct['kick'][$lid] ?? 0);
            if ((int) ($l[1] ?? 0) < time() || ($kick && (int) $l[1] - $sessionDays * 86400 <= $kick)) continue;
            $live[$lid][] = ['device' => (string) ($l[3] ?? ''), 'seen' => (int) ($l[2] ?? 0), 'since' => (int) $l[1] - $sessionDays * 86400];
        }
        $outAt = function ($id) use ($sess, $acct) { return max((int) ($sess['o'][$id] ?? 0), (int) ($acct['kick'][$id] ?? 0)); };
        $list = array_map(function ($r) use ($myId, $live, $outAt, $acct) {
            $l = $live[$r['id']] ?? []; usort($l, fn($x, $y) => $y['seen'] <=> $x['seen']);
            return array_diff_key($r, ['code' => 1]) + ['you' => $r['id'] === $myId, 'live' => $l, 'out' => $outAt($r['id']), 'team' => (string) ($acct['member'][$r['id']] ?? ''), 'walker' => !empty($acct['walker'][$r['id']])];
        }, array_values($isMgr ? array_filter($rows, fn($r) => $r['id'] === $myId || $mgrMay($r)) : $rows));
        usort($list, fn($x, $y) => [$x['off'], mb_strtolower($x['name'])] <=> [$y['off'], mb_strtolower($y['name'])]);
        $tn = []; foreach ((array) ($acct['teams'] ?? []) as $tid => $t) if (!$isMgr || (string) $tid === $myTeam) $tn[] = ['id' => (string) $tid, 'name' => (string) ($t[0] ?? '')];
        usort($tn, fn($x, $y) => strcmp(mb_strtolower($x['name']), mb_strtolower($y['name'])));
        /* seats against the plan (2026-10-10), only where billing is on: the screen warns, nothing is blocked */
        $seatInfo = feature('billing') && !$isMgr ? array_intersect_key(billingState(billingConfig(__DIR__), $rows), ['seats' => 1, 'used' => 1, 'status' => 1, 'plan' => 1]) : null;
        out(['ok' => true, 'accounts' => $list, 'tracking' => (int) ($sess['since'] ?? 0), 'teams' => $tn, 'seats' => $seatInfo, 'manager' => $isMgr ? $myTeam : null]);
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
        $pins = []; foreach ($rows as $r) if (!$r['off'] && ($isSuper || $r['role'] !== 'super')) $pins[$r['id']] = $r['code'];
        accountLog(['by' => $me, 'what' => 'showed pins', 'n' => count($pins)]);
        out(['ok' => true, 'pins' => $pins]);
    }
    if ($action === 'accountadd') {
        $name = acctName((string) ($body['name'] ?? '')); $r = $isMgr ? 'crew' : (string) ($body['role'] ?? 'crew');
        if (!acctNameOk($name)) fail('Use a name of 2 to 40 letters (spaces, hyphens and apostrophes are fine).');
        if (acctNameReserved($name)) fail('That name is kept for Traverse\'s own sign-ins. Use another.');
        if (!in_array($r, ROLES, true)) fail(feature('walkdesk') ? 'Pick crew, office, manager or admin.' : 'Pick crew, manager or admin.');
        if (acctTaken($rows, $name)) fail('Someone already signs in as ' . $name . '. Use a different name (a last initial works).');
        $code = acctNewCode($basePeople, $acct);
        $acct['people'][$code] = [$name, $r, $me, time()];
        if ($isMgr) { $acct['member'] = (array) ($acct['member'] ?? []); $acct['member'][codeId($code, $sessionKey)] = $myTeam; }   /* a manager's new crew join their team */
        if (!saveAccounts($acct)) fail('Could not save that. Try again.', 500);
        accountLog(['by' => $me, 'what' => 'add', 'name' => $name, 'role' => $r, 'id' => codeId($code, $sessionKey)]);
        out(['ok' => true, 'id' => codeId($code, $sessionKey), 'name' => $name, 'role' => $r, 'code' => $code]);
    }
    $id = (string) ($body['id'] ?? '');
    if (!isset($rows[$id])) fail('No such account.', 404);
    $t = $rows[$id];
    if ($t['role'] === 'super' && !$isSuper) fail('That is Traverse\'s own sign-in. Only Traverse changes it.', 403);
    if ($isMgr && !$mgrMay($t)) fail('A manager changes the crew on their own team.', 403);
    if ($action === 'accountedit') {
        $name = array_key_exists('name', $body) ? acctName((string) $body['name']) : $t['name'];
        $r = array_key_exists('role', $body) ? (string) $body['role'] : $t['role'];
        if ($t['off']) fail('Turn the account back on first.');
        if (array_key_exists('name', $body) && !acctNameOk($name)) fail('Use a name of 2 to 40 letters (spaces, hyphens and apostrophes are fine).');
        if ($name !== $t['name'] && acctNameReserved($name)) fail('That name is kept for Traverse\'s own sign-ins. Use another.');   /* renaming into one; an existing one keeps its name */
        if (!in_array($r, ROLES, true)) fail(feature('walkdesk') ? 'Pick crew, office, manager or admin.' : 'Pick crew, manager or admin.');
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
        /* an admin may change their own (2026-10-11): the page signs straight back in with the new code */
        if ($id === $myId && $role !== 'admin') fail('Ask an admin for a new code.');
        $want = preg_replace('/\D/', '', (string) ($body['code'] ?? ''));
        if ($want !== '') {   /* a code the admin picks (2026-10-11) */
            if ($role !== 'admin') fail('Only an admin picks a code. Leave it blank for a new random one.', 403);
            /* review 2026-10-11: "taken" says a code exists, so a script could walk all 900,000 and find every code in use, the super
               admin's included. Ten picks an hour per admin, right or wrong, ends that; a random new code is never limited. */
            if (!throttleTake(rateFile('codepick|' . $myId), 10, 3600)) fail('Too many codes tried. Wait an hour, or leave it blank for a random one.', 429);
            if (!preg_match('/^\d{6}$/D', $want)) fail('A code is 6 digits.');
            if (acctWeakCode($want)) fail('Pick a code that is harder to guess: not one digit six times or a run like 123456.');
            if (isset($basePeople[$want]) || isset($acct['people'][$want])) fail('That code is taken. Pick another.');
            $code = $want;
        } else $code = acctNewCode($basePeople, $acct);
        $tidWas = (string) ($acct['member'][$id] ?? '');
        if ($t['source'] === 'app') { $p = $acct['people'][$t['code']]; unset($acct['people'][$t['code']]); $acct['people'][$code] = $p; }
        else { $acct['off'][$id] = ['by' => $me, 'at' => time(), 'why' => 'new code']; $acct['people'][$code] = [$t['name'], $t['role'], $me, time()]; }
        if ($tidWas !== '') { $acct['member'][codeId($code, $sessionKey)] = $tidWas; unset($acct['member'][$id]); }   /* the team goes with the person to their new code */
        if (!empty($acct['walker'][$id])) { $acct['walker'][codeId($code, $sessionKey)] = 1; unset($acct['walker'][$id]); }   /* and so does doing walks (2026-10-14) */
        if (!saveAccounts($acct)) fail('Could not save that. Try again.', 500);
        sessEnd($id);
        accountLog(['by' => $me, 'what' => 'new code', 'name' => $t['name'], 'id' => $id, 'new' => codeId($code, $sessionKey)]);
        out(['ok' => true, 'id' => codeId($code, $sessionKey), 'name' => $t['name'], 'role' => $t['role'], 'code' => $code, 'self' => $id === $myId]);
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

/* the board: per person, today / 7 days / 30 days / 90 days. Talked to = doors minus no-answers and
   no-soliciting. Won = jobs won on doors that person booked, credited when the job was won; value = their
   dollar amounts (the sales funnel, 2026-10-10). */
if ($action === 'board') {
    if (!boardOpen($role)) fail('Not allowed.', 403);
    $tz = new DateTimeZone(appTz());
    $today = (new DateTime('today', $tz));
    $from = ['today' => $today->format('Y-m-d'), 'week' => (clone $today)->modify('-6 days')->format('Y-m-d'), 'month' => (clone $today)->modify('-29 days')->format('Y-m-d'), 'quarter' => (clone $today)->modify('-89 days')->format('Y-m-d')];
    $zero = ['doors' => 0, 'talked' => 0, 'booked' => 0, 'won' => 0, 'value' => 0];
    $rows = [];
    foreach (teamDays(90, '') as $p) {
        if (boardHidden($p['name'])) continue;
        $r = ['name' => $p['name'], 'today' => $zero, 'week' => $zero, 'month' => $zero, 'quarter' => $zero];
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
        $ks = townKnockStats($rg['key']); if (!$ks) continue;   /* cached per town (2026-10-11): the same counts, without decoding every town */
        $assign = loadAssign($rg['key']);
        foreach ($ks['won'] as $wn) {
            $who = (string) $wn[0]; if ($who === '' || boardHidden($who)) continue;
            $day = (new DateTime('@' . (int) $wn[1]))->setTimezone($tz)->format('Y-m-d');
            if (!isset($rows[$who])) $rows[$who] = ['name' => $who, 'today' => $zero, 'week' => $zero, 'month' => $zero, 'quarter' => $zero];
            foreach ($from as $per => $since) if ($day >= $since) { $rows[$who][$per]['won']++; $rows[$who][$per]['value'] += (int) $wn[2]; }
        }
        foreach ($ks['areas'] as $ar) if (isset($assign[$ar[0]])) $terr[] = ['region' => $rg['key'], 'town' => $rg['label'], 'area' => $ar[0], 'who' => $assign[$ar[0]], 'total' => $ar[1], 'knocked' => $ar[2]];
    }
    $names = [];
    foreach ($people as $code => $pp) { $n = (string) ($pp[0] ?? ''); if ($n !== '' && !boardHidden($n)) $names[$n] = true; }   /* names only, never codes */
    ksort($names);
    if ($role === 'manager' && !BOARD_OPEN) {   /* a manager's board is their team's (2026-10-05) */
        $rows = array_filter($rows, fn($r) => $r['name'] === $me || sameTeam($r['name']));
        $terr = array_values(array_filter($terr, fn($t) => $t['who'] === $me || sameTeam($t['who'])));
    }
    out(['ok' => true, 'today' => $from['today'], 'open' => BOARD_OPEN, 'goals' => loadGoals(), 'pgoals' => loadPGoals(), 'people' => array_values($rows),
         'territories' => $terr, 'names' => $role === 'admin' ? array_keys($names) : ($role === 'manager' ? array_values(array_filter(array_keys($names), fn($n) => $n === $me || sameTeam($n))) : [])]);
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
    if ($role !== 'admin' && $role !== 'manager') fail('Not allowed.', 403);
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $towns = [];
    foreach (($idx['regions'] ?? []) as $rg) {
        $ks = townKnockStats($rg['key']); if (!$ks) continue;   /* cached per town (2026-10-11) */
        $assign = loadAssign($rg['key']); $aday = assignDays($rg['key']);
        $areas = [];
        foreach ($ks['areas'] as $ar) $areas[] = ['name' => $ar[0], 'total' => $ar[1], 'knocked' => $ar[2], 'who' => $assign[$ar[0]] ?? null, 'on' => $aday[$ar[0]] ?? null];
        $towns[] = ['key' => $rg['key'], 'label' => $rg['label'], 'areas' => $areas];
    }
    $names = [];
    foreach ($people as $pp) { $n = (string) ($pp[0] ?? ''); if ($n !== '' && !boardHidden($n) && ($role === 'admin' || $n === $me || sameTeam($n))) $names[$n] = true; }
    ksort($names);
    /* everyone who can sign in now, hidden ones included: an assignment to anyone else belongs to someone removed */
    $active = []; foreach ($people as $pp) { $n = (string) ($pp[0] ?? ''); if ($n !== '') $active[$n] = true; }
    out(['ok' => true, 'towns' => $towns, 'names' => array_keys($names), 'active' => array_keys($active), 'manager' => $role === 'manager']);
}
/* every neighbourhood one person holds, in every town, back to unassigned in one go (2026-10-04): when someone leaves,
   or their area changes. Works for people already removed from Accounts too. */
if ($action === 'unassignall') {
    if ($role !== 'admin' && $role !== 'manager') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $who = trim((string) ($body['who'] ?? ''));
    if ($who === '') fail('Whose neighbourhoods?');
    if (!mayAssign($who, '')) fail('A manager changes territories within their own team.', 403);
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
    if ($role !== 'admin' && $role !== 'manager') fail('Not allowed.', 403);
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
    $cur = loadAssign($key);
    foreach ($areas as $a) if (!mayAssign((string) ($cur[$a] ?? ''), $who)) fail('A manager changes territories within their own team: ' . $a . ' is someone else\'s.', 403);
    $on = $who === '' ? '' : assignDay($body['on'] ?? '');
    foreach ($areas as $a) if (!appendAssign($key, ['area' => $a, 'who' => $who, 'by' => $me, 'at' => time()] + ($on !== '' ? ['on' => $on] : []))) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'n' => count($areas)]);
}

if ($action === 'assign') {
    if ($role !== 'admin' && $role !== 'manager') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? ''); $area = (string) ($body['area'] ?? ''); $who = trim((string) ($body['who'] ?? ''));
    $data = loadRegion($key);
    if (!$data) fail('No such region.', 404);
    if (!in_array($area, array_column($data['areas'], 'name'), true)) fail('No such neighbourhood.', 404);
    if ($who !== '') {
        $known = false; foreach ($people as $pp) if ((string) ($pp[0] ?? '') === $who) $known = true;
        if (!$known || boardHidden($who)) fail('Pick someone with a sign-in code.');
    }
    if (!mayAssign((string) (loadAssign($key)[$area] ?? ''), $who)) fail('A manager changes territories within their own team.', 403);
    $on = $who === '' ? '' : assignDay($body['on'] ?? '');
    if (!appendAssign($key, ['area' => $area, 'who' => $who, 'by' => $me, 'at' => time()] + ($on !== '' ? ['on' => $on] : []))) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
/* doors to one person, from the desktop planning table (2026-10-08): up to 1,000 at a time, all or none.
   A manager moves only doors that are unassigned or their team's, to someone on their team. */
if ($action === 'doorassign') {
    if ($role !== 'admin' && $role !== 'manager') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? ''); $who = trim((string) ($body['who'] ?? ''));
    $ids = is_array($body['ids'] ?? null) ? array_values(array_unique(array_map('strval', $body['ids']))) : [];
    if (!regionAvailable($key)) fail('No such region.', 404);
    if (!$ids || count($ids) > 1000) fail('Pick the doors to assign (up to 1,000 at a time).');
    if ($who !== '') {
        $known = false; foreach ($people as $pp) if ((string) ($pp[0] ?? '') === $who) $known = true;
        if (!$known || boardHidden($who)) fail('Pick someone with a sign-in code.');
    }
    $home = [];
    foreach ($ids as $id) { if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.'); $home[$id] = doorHome($key, $id); }
    /* who holds each door now: its own person, else its neighbourhood's (Fable 2026-10-09: checking only the door's own let a
       manager take doors in another team's neighbourhood) */
    $cur = [];
    foreach (array_unique(array_values($home)) as $hk) {
        $own = loadDoorAssign($hk); $terr = loadAssign($hk); $data = loadRegion($hk);
        foreach (($data['areas'] ?? []) as $a) foreach ($a['doors'] as $d) {
            $id = (string) $d['id'];
            if (($home[$id] ?? null) === $hk) $cur[$id] = $own[$id] ?? ($terr[$a['name']] ?? '');
        }
    }
    foreach ($ids as $id) if (!mayAssign((string) ($cur[$id] ?? ''), $who)) fail('A manager assigns doors within their own team: one of these is someone else\'s.', 403);
    /* all or none: one write per town file */
    $at = time(); $lines = [];
    foreach ($ids as $id) $lines[$home[$id]][] = json_encode(stamped(['id' => $id, 'who' => $who, 'by' => $me, 'at' => $at]), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    foreach ($lines as $hk => $ls) if (@file_put_contents(DATA_DIR . '/dassign-' . $hk . '.log', implode("\n", $ls) . "\n", FILE_APPEND | LOCK_EX) === false) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'n' => count($ids)]);
}
/* ---- territories drawn on the desk map (2026-10-09) ----
 * An admin or manager draws an outline on the desktop map, names it and gives it to one person; the page assigns the doors
 * inside through doorassign (which keeps the team rules), then saves the outline here. territory-<town>.log, one line per
 * change, append-only like the other logs: {id, name, who, poly: [[lat, lon], ...], by, at}; {id, del: true, by, at} takes
 * an outline away. Deleting removes the outline only: the doors keep their person. Seen by whoever sees territories. */
const TERR_MAX_POINTS = 200;
function loadTerr(string $key): array {
    $out = [];
    foreach (logRows('territory', $key) as $r) {
        if (!is_array($r) || !isset($r['id']) || isset($r['_from'])) continue;   /* this town's own file only: an outline belongs to one town */
        $id = (string) $r['id'];
        if (!empty($r['del'])) { unset($out[$id]); continue; }
        $out[$id] = ['id' => $id, 'name' => (string) ($r['name'] ?? ''), 'who' => (string) ($r['who'] ?? ''), 'poly' => array_values((array) ($r['poly'] ?? [])),
                     'by' => (string) ($r['by'] ?? ''), 'at' => (int) ($r['at'] ?? 0)];
    }
    return $out;
}
function appendTerr(string $key, array $row): bool {
    return (bool) @file_put_contents(DATA_DIR . '/territory-' . $key . '.log', json_encode(stamped($row), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}
if ($action === 'terrlist') {
    if (!TERRITORIES_OPEN && $role !== 'admin' && $role !== 'manager') fail('Not allowed.', 403);
    $key = (string) ($_GET['region'] ?? '');
    if (!regionAvailable($key)) fail('No such region.', 404);
    /* 'del': may this person take the outline away (a manager only their team's) */
    $list = array_map(fn($t) => $t + ['del' => mayAssign($t['who'], '')], array_values(loadTerr($key)));
    out(['ok' => true, 'territories' => $list]);
}
if ($action === 'terrsave') {
    if ($role !== 'admin' && $role !== 'manager') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    if (!regionAvailable($key)) fail('No such region.', 404);
    if (!empty($body['del'])) {
        $id = (string) ($body['id'] ?? '');
        $cur = loadTerr($key)[$id] ?? null;
        if (!$cur) fail('That outline is not there any more.', 404);
        if (!mayAssign($cur['who'], '')) fail('A manager changes territories within their own team.', 403);
        if (!appendTerr($key, ['id' => $id, 'del' => true, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
        out(['ok' => true]);
    }
    $name = trim((string) preg_replace('/[\x00-\x1F\x7F\s]+/u', ' ', (string) ($body['name'] ?? '')));
    if ($name === '' || mb_strlen($name) > 60) fail('Give the territory a name (up to 60 characters).');
    $who = trim((string) ($body['who'] ?? ''));
    $known = false; foreach ($people as $pp) if ((string) ($pp[0] ?? '') === $who) $known = true;
    if ($who === '' || !$known || boardHidden($who)) fail('Pick someone with a sign-in code.');
    if (!mayAssign('', $who)) fail('A manager saves territories for their own team.', 403);
    $pts = $body['poly'] ?? null;
    if (!is_array($pts) || count($pts) < 3 || count($pts) > TERR_MAX_POINTS) fail('Draw an outline of 3 to ' . TERR_MAX_POINTS . ' points.');
    $poly = [];
    foreach ($pts as $p) {
        /* numbers only, as the page sends them (a string or a nested list is refused, not cast) */
        if (!is_array($p) || count($p) !== 2 || !array_key_exists(0, $p) || !array_key_exists(1, $p)) fail('That outline is not one the app drew.');
        if (!(is_int($p[0]) || is_float($p[0])) || !(is_int($p[1]) || is_float($p[1]))) fail('That outline is not one the app drew.');
        $la = (float) $p[0]; $lo = (float) $p[1];
        $mb = market()['box'];
        if ($la < $mb[0] || $la > $mb[2] || $lo < $mb[1] || $lo > $mb[3]) fail('The outline has to be in ' . market()['stateName'] . '.');   /* the state's rough box */
        $poly[] = [round($la, 6), round($lo, 6)];
    }
    $row = ['id' => 't' . bin2hex(random_bytes(6)), 'name' => $name, 'who' => $who, 'poly' => $poly, 'by' => $me, 'at' => time()];
    if (!appendTerr($key, $row)) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'territory' => $row + ['del' => true]]);
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
    if (!regionAvailable($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    $date = $body['date'] ?? null;                                  // null = no walk booked after all
    $time = (string) ($body['time'] ?? '');                         // '' = time still to agree
    if ($date !== null) {
        $date = (string) $date;
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $date, $mm) || !checkdate((int) $mm[2], (int) $mm[3], (int) $mm[1])) fail('That is not a real date.');
        $tz = new DateTimeZone(appTz());
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
    $tz = new DateTimeZone(appTz());
    $from = (string) ($_GET['from'] ?? ''); $to = (string) ($_GET['to'] ?? '');
    $ok = fn($d) => dateOk($d);   /* review 2026-10-06: a 13th month used to reach DateTime and end in a 500 (see calRange) */
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
    $tz = new DateTimeZone(appTz());
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
    $tz = new DateTimeZone(appTz()); $utc = new DateTimeZone('UTC');
    $town = regionLabel($key);
    $p = loadPhones($key)[$id] ?? null; $p = ($p && ($p['source'] ?? '') === 'door' && empty(ownerFlag($door, $p)['prev'])) ? $p : null;
    $n = loadNotes($key)[$id] ?? null; $n = ($n && empty(ownerFlag($door, $n)['prev'])) ? $n : null;
    /* the visit is the company's (company.json visit: "yard walk", "roof inspection"); review 2026-10-06, it said Yard walk in every edition */
    $visit = ucfirst((string) (company()['visit'] ?: 'visit'));
    $desc = $visit . ' for a quote. Booked at the door by ' . ($w['by'] ?: 'the crew') . '.';
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
    $L[] = 'SUMMARY:' . icsEsc($visit . ': ' . $door['address'] . ($w['time'] === '' ? ' (time to agree)' : ''));
    $L[] = 'LOCATION:' . icsEsc($door['address'] . ', ' . $town . ', ' . market()['state']);   /* the market's state (2026-10-13, Fable review) */
    if (isset($door['lat'], $door['lon'])) $L[] = 'GEO:' . $door['lat'] . ';' . $door['lon'];
    $L[] = 'DESCRIPTION:' . icsEsc($desc);
    /* the day before; and an hour before when there is a time (an all-day walk gets 9 am the day before) */
    foreach ($w['time'] !== '' ? ['-P1D', '-PT1H'] : ['-PT15H'] as $tr) {
        array_push($L, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' . icsEsc($visit . ': ' . $door['address']), 'TRIGGER:' . $tr, 'END:VALARM');
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
    if (!regionAvailable($key)) fail('No such region.', 404);
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
    if (!desk()) fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    if (!regionAvailable($key)) fail('No such region.', 404);
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
    if (!desk()) fail('Not allowed.', 403);
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
    if (!regionAvailable($key)) fail('No such region.', 404);
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
    if (!desk()) fail('Not allowed.', 403);
    $roofOn = feature('roof');
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $list = [];
    foreach (($idx['regions'] ?? []) as $r) {
        /* only towns with a booking (2026-10-11): the knocks first, the door file only when one is booked */
        $marks = loadMarks($r['key']);
        $anyBooked = false; foreach ($marks as $mk0) if (($mk0['outcome'] ?? '') === 'booked') { $anyBooked = true; break; }
        if (!$anyBooked) continue;
        $data = loadRegion($r['key']);
        if (!$data) continue;
        $phones = loadPhones($r['key']);
        $notes = loadNotes($r['key']);
        $quoted = loadQuoted($r['key']);
        $lfix = loadLawnFix($r['key']);
        $emails = loadEmails($r['key']);
        $photos = loadPhotos($r['key']);
        $work = loadWork($r['key']);
        $res = loadResults($r['key']);
        $walks = loadWalks($r['key']);
        $rjobs = $roofOn ? loadRoofJobs($r['key']) : [];
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
                    /* steps saved before this booking belong to an earlier one */
                    'roofjob' => $roofOn ? (array_filter($rjobs[$d['id']] ?? [], fn($st) => $st['at'] >= (int) $m['at']) ?: null) : null,
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

if ($action === 'roofjob') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    if (!feature('roof')) fail('Roofing is not turned on here.', 404);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    if (!regionAvailable($key)) fail('No such region.', 404);
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('Bad door id.');
    $key = doorHome($key, $id);
    $step = (string) ($body['step'] ?? '');
    if (!in_array($step, ROOF_STEPS, true)) fail('Unknown step.');
    $when = $body['when'] ?? null;
    if ($when !== null && $when !== '') {
        $when = (string) $when;
        $timed = in_array($step, ROOF_TIMED, true);
        if (!preg_match($timed ? '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/D' : '/^\d{4}-\d{2}-\d{2}$/D', $when)) fail($timed ? 'That step needs a date and a time.' : 'That step needs a date.');
        $dt = DateTime::createFromFormat($timed ? '!Y-m-d\TH:i' : '!Y-m-d', $when, new DateTimeZone(appTz()));
        if (!$dt || $dt->format($timed ? 'Y-m-d\TH:i' : 'Y-m-d') !== $when) fail('That is not a real date.');
        $yr = (int) $dt->format('Y'); $now = (int) date('Y');
        if ($yr < $now - 3 || $yr > $now + 2) fail('That date is too far from today.');
    } else $when = null;
    $row = ['id' => $id, 'step' => $step, 'when' => $when, 'by' => $me, 'at' => time()];
    if (!@file_put_contents(DATA_DIR . '/roofjob-' . $key . '.log', json_encode(stamped($row), JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX)) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

if ($action === 'quoted') {
    if (!desk()) fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? '');
    $id  = (string) ($body['id'] ?? '');
    if (!regionAvailable($key)) fail('No such region.', 404);
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
    if (!regionAvailable($key)) fail('No such region.', 404);
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
    exportLog(['what' => 'skip trace numbers', 'region' => $only]);
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
    if (!regionAvailable($key)) fail('No such region.', 404);
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
    exportLog(['what' => 'bookings for Jobber']);
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
                (string) $d['address'], (string) ($r['label'] ?? ''), market()['state'], 'United States', implode(' ', $noteBits), implode(', ', $tags), 'Other']), ',', '"', '');
        }
    }
    fclose($fh);
    exit;
}

/* ---- the Company screen (2026-10-08): a client install's own name, contact details and brand colour ----
 * Kept in company-local.json beside company.json in the data folder: the server makes it and a data refresh never ships one,
 * so an upload of new door data can't undo what the client's admin set. company() lays it over company.json. The brand
 * colour becomes the same set of colour variables build-editions.cjs writes (editions/clients.cjs, palette()), white on the
 * accent checked at 4.5:1. The home-screen icon, the app's home-screen name and the phone's bar colour are set when the
 * install is built (manifest and icons) and change only with a rebuild. Admins, in the editions and client installs (not Sixfold). */
function hexRgb(string $h): array { $n = hexdec(ltrim($h, '#')); return [($n >> 16) & 255, ($n >> 8) & 255, $n & 255]; }
function rgbHsl(array $c): array {
    [$r, $g, $b] = array_map(fn($v) => $v / 255, $c); $mx = max($r, $g, $b); $mn = min($r, $g, $b); $l = ($mx + $mn) / 2; $h = 0; $s = 0;
    if ($mx !== $mn) { $d = $mx - $mn; $s = $l > 0.5 ? $d / (2 - $mx - $mn) : $d / ($mx + $mn);
        $h = $mx === $r ? ($g - $b) / $d + ($g < $b ? 6 : 0) : ($mx === $g ? ($b - $r) / $d + 2 : ($r - $g) / $d + 4); $h /= 6; }
    return [$h, $s, $l];
}
function hslHex(float $h, float $s, float $l): string {
    $f = function ($n) use ($h, $s, $l) { $k = fmod($n + $h * 12, 12); $a = $s * min($l, 1 - $l); return $l - $a * max(-1, min($k - 3, 9 - $k, 1)); };
    return sprintf('#%02x%02x%02x', (int) round(max(0, min(1, $f(0))) * 255), (int) round(max(0, min(1, $f(8))) * 255), (int) round(max(0, min(1, $f(4))) * 255));
}
function relLum(string $hex): float { $c = array_map(function ($v) { $v /= 255; return $v <= 0.03928 ? $v / 12.92 : pow(($v + 0.055) / 1.055, 2.4); }, hexRgb($hex)); return 0.2126 * $c[0] + 0.7152 * $c[1] + 0.0722 * $c[2]; }
function contrastRatio(string $a, string $b): float { $x = relLum($a); $y = relLum($b); return (max($x, $y) + 0.05) / (min($x, $y) + 0.05); }
/** the colour variables for one brand colour, light and dark, as company.json "colors" (the page's paintCompany applies them) */
function brandColors(string $hex): array {
    [$h, $s0, $l0] = rgbHsl(hexRgb($hex)); $s = min($s0, 0.6); $at = fn($l, $sat = null) => hslHex($h, $sat ?? $s, $l);
    $accent = strtolower($hex); $la = $l0;
    while (contrastRatio($accent, '#ffffff') < 4.5 && $la > 0.05) { $la -= 0.02; $accent = hslHex($h, $s0, $la); }
    return ['light' => ['--bg' => $at(0.965, $s * 0.25), '--line' => $at(0.88, $s * 0.2), '--sunk' => $at(0.925, $s * 0.2), '--bar' => $at(0.2), '--bar-soft' => $at(0.85, $s * 0.45),
                        '--moss' => $at(0.55, $s * 0.6), '--moss-ink' => $at(0.2), '--accent' => $accent, '--signin' => $at(0.2), '--signin-deep' => $at(0.13),
                        '--signin-soft' => $at(0.85, $s * 0.45), '--key' => $at(0.28), '--key-down' => $at(0.35)],
            'dark' => ['--bg' => $at(0.06, $s * 0.5), '--card' => $at(0.1, $s * 0.45), '--line' => $at(0.2, $s * 0.35), '--sunk' => $at(0.08, $s * 0.45), '--bar' => $at(0.12, $s * 0.5),
                       '--moss-ink' => $at(0.75, $s * 0.55), '--accent' => $at(0.75, $s * 0.55)]];
}
const COMPANY_LOCAL = ['name', 'short', 'tagline', 'phone', 'email', 'site', 'review'];
if ($action === 'companyset') {
    if ($role !== 'admin' || !feature('company')) fail('Not allowed.', 403);   /* the Company screen: editions and clients (features.company), not Sixfold */
    if (!$isPost) fail('POST required', 405);
    $clean = fn($v, int $max) => trim(preg_replace('/[\x00-\x1f\x7f]+/', ' ', (string) $v));
    $loc = [];
    $loc['name'] = $clean($body['name'] ?? '', 60); $loc['short'] = $clean($body['short'] ?? '', 20);
    if ($loc['name'] === '' || mb_strlen($loc['name']) > 60) fail('The company name is needed (60 characters at most).');
    if ($loc['short'] === '' || mb_strlen($loc['short']) > 20) fail('The short name is needed (20 characters at most): it goes where space is tight.');
    $loc['tagline'] = $clean($body['tagline'] ?? '', 80); if (mb_strlen($loc['tagline']) > 80) fail('The tagline is 80 characters at most.');
    $loc['phone'] = $clean($body['phone'] ?? '', 30); if ($loc['phone'] !== '' && !preg_match('/^[0-9 ()+.\-]{7,30}$/', $loc['phone'])) fail('That phone number has characters a phone number does not.');
    $loc['email'] = $clean($body['email'] ?? '', 120); if ($loc['email'] !== '' && !filter_var($loc['email'], FILTER_VALIDATE_EMAIL)) fail('That email address does not look right.');
    $loc['site'] = strtolower($clean($body['site'] ?? '', 80)); if ($loc['site'] !== '' && !preg_match('#^(https?://)?[a-z0-9.-]+\.[a-z]{2,}(/[a-z0-9._~/-]*)?$#', $loc['site'])) fail('That website does not look right (like yourcompany.com).');
    $loc['review'] = $clean($body['review'] ?? '', 300); if ($loc['review'] !== '' && !preg_match('#^https://[^\s<>"]{8,300}$#D', $loc['review'])) fail('The review link should start with https://');   /* 2026-10-13 */
    $color = strtolower(trim((string) ($body['color'] ?? '')));
    if ($color !== '' && !preg_match('/^#[0-9a-f]{6}$/', $color)) fail('Pick a colour.');
    if ($color !== '') $loc['color'] = $color;
    $loc['by'] = $me; $loc['at'] = time();
    if (!writeJsonAtomic(DATA_DIR . '/company-local.json', $loc)) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}

/* ---- booked doors for JobNimbus (2026-10-08, TraverseRoofing) ----
 * Roofers commonly run their business in JobNimbus. Two ways in, both from the same facts (bookedLeads below):
 *   jobnimbus  GET   a JobNimbus contact import (CSV): columns named as its contact fields, "Contact Type" and "Status" filled
 *                    because its import requires both (Customer / Lead: change them to the company's own workflow while importing)
 *   jnset      POST  connect: the roofer's own JobNimbus API key (JobNimbus: Settings, API, New API key), tested against
 *                    JobNimbus before it is kept; plus the workflow, status, appointment type and lead source names to use
 *   jnstatus   GET   connected or not (the key's last four characters only, never the key), sent and waiting counts, last run
 *   jnsync     POST  send now: each booked door not yet sent becomes a JobNimbus contact, and its roof walk an appointment;
 *                    a walk booked after the door was sent goes up on the next run. Also run every 5 minutes by
 *                    traverse-tools/push-alerts.sh (CLI). Each door goes once: jobnimbus-sent.json remembers its JobNimbus id.
 * Names: the county's owner of record exactly as written, under last name, or under company for a trust, an estate or a
 * business; never split into first and last, because the county writes couples and trusts many ways and a guess would put a
 * wrong name in the roofer's system. The key and the sent list live in the private folder, never in public_html, never in git.
 * Admins, where the company has roofs on. JobNimbus API: https://app.jobnimbus.com/api1/ (Bearer token; contacts, tasks). */
function jnFile(string $f): string { return pushPrivDir() . '/' . $f; }
function jnConf(): array { $j = json_decode((string) @file_get_contents(jnFile('jobnimbus.json')), true); return is_array($j) ? $j : []; }
function jnBase(): string { return rtrim((string) (getenv('TRAVERSE_JOBNIMBUS_BASE') ?: 'https://app.jobnimbus.com/api1'), '/'); }   /* the override is for the test copy only */
/** one JobNimbus call: [HTTP status, decoded answer or null, error text] */
function jnCall(string $method, string $path, ?array $body, string $key): array {
    $url = jnBase() . $path;
    $hdr = ['Authorization: Bearer ' . $key, 'Content-Type: application/json', 'Accept: application/json', agentHeader()];
    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $hdr]);
        if ($body !== null) curl_setopt($c, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $raw = curl_exec($c); $code = (int) curl_getinfo($c, CURLINFO_HTTP_CODE); $err = $raw === false ? curl_error($c) : ''; curl_close($c);
    } else {
        $ctx = stream_context_create(['http' => ['method' => $method, 'header' => implode("\r\n", $hdr), 'content' => $body !== null ? json_encode($body) : '', 'timeout' => 25, 'ignore_errors' => true]]);
        $raw = @file_get_contents($url, false, $ctx); $code = 0; $err = $raw === false ? 'no answer' : '';
        foreach (($http_response_header ?? []) as $h) if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $mm)) $code = (int) $mm[1];
    }
    $j = is_string($raw) ? json_decode($raw, true) : null;
    return [$code, is_array($j) ? $j : null, $err];
}
/** every booked door this install shows, with what the card knew, for the CSV and for JobNimbus */
function bookedLeads(): array {
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $co = company(); $out = [];
    $in = fn($v) => rtrim(rtrim(number_format((float) $v, 2), '0'), '.') . ' in';
    $day = fn(string $ymd) => ($t = strtotime($ymd)) ? date('M j, Y', $t) : $ymd;
    foreach (($idx['regions'] ?? []) as $r) {
        $key = (string) $r['key'];
        $data = loadRegion($key);
        if (!$data) continue;
        $marks = loadMarks($key);
        $booked = [];
        foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) { $m = freshMark($d, $marks[$d['id']] ?? null); if ($m && $m['outcome'] === 'booked') $booked[(string) $d['id']] = [$d, $m]; }
        if (!$booked) continue;
        $phones = loadPhones($key); $emails = loadEmails($key); $notes = loadNotes($key); $walks = loadWalks($key); $placeOf = skipMail($key);
        $hailOf = loadSide('hail', $key, $booked); $windOf = loadSide('wind', $key, $booked); $roofOf = loadSide('roof', $key, $booked);
        $bldOf = loadSide('year', $key, $booked); $matOf = loadSide('material', $key, $booked); $permOf = loadSide('permit', $key, $booked);
        foreach ($booked as $id => [$d, $m]) {
            $p = $phones[$id] ?? null; if ($p && ownerAge($d, $p) === 'prev') $p = null;
            $em = $emails[$id] ?? null; if ($em && ownerAge($d, $em) === 'prev') $em = null;
            $n = $notes[$id] ?? null; if ($n && ownerAge($d, $n) === 'prev') $n = null;
            $owner = trim((string) ($d['owner'] ?? '')); if (preg_match('/^unavailable$/i', $owner)) $owner = '';
            $org = (bool) preg_match('/\b(LLC|L\.L\.C|INC|CORP|CORPORATION|COMPANY|LTD|LLLP|LP|PARTNERSHIP|TRUST|ESTATE|TRUSTEES?)\b/i', $owner);
            $pl = $placeOf[$id] ?? [];
            $walk = !empty($walks[$id]['date']) ? ['date' => (string) $walks[$id]['date'], 'time' => (string) ($walks[$id]['time'] ?? '')] : null;
            $bits = ['Booked at the door by ' . ($m['by'] ?: 'the rep') . ' on ' . date('M j, Y', (int) $m['at']) . '.'];
            if ($walk) $bits[] = 'Roof walk booked for ' . $day($walk['date']) . ($walk['time'] !== '' ? ' at ' . date('g:i a', strtotime('2000-01-01 ' . $walk['time'])) : '') . '.';
            $big = null; foreach ((array) ($hailOf[$id] ?? []) as $h) if (is_array($h) && (!$big || (float) $h[1] > (float) $big[1])) $big = $h;
            if ($big) $bits[] = 'Hail near the house: ' . $in($big[1]) . ' on ' . $day((string) $big[0]) . ' (NOAA radar estimate).';
            $wmax = null; foreach ((array) (windRows($windOf[$id] ?? null) ?? []) as $w) if ((float) ($w[1] ?? 0) >= 58 && (!$wmax || (float) $w[1] > (float) $wmax[1])) $wmax = $w;
            if ($wmax) $bits[] = 'Wind ' . (int) $wmax[1] . ' mph on ' . $day((string) $wmax[0]) . ', ' . $wmax[3] . ' mi away (NWS report).';
            $rf = $roofOf[$id] ?? null; if ($rf) $bits[] = 'Roof: about ' . number_format((float) ($rf['sq'] ?? 0)) . ' sq ft, ' . ($rf['sqs'] ?? '?') . ' squares, ' . (!empty($rf['flat']) ? 'flat or low slope' : ($rf['pitch'] ?? '?') . '/12 pitch') . ' (laser scan estimate).';
            $b = $bldOf[$id] ?? null; if ($b && !empty($b['yb'])) $bits[] = 'Built ' . $b['yb'] . (!empty($b['rm']) ? ', remodeled ' . $b['rm'] : '') . ' (county records).';
            $mt = $matOf[$id]['m'] ?? ($b['mat'] ?? null); if ($mt) $bits[] = 'Roof material: ' . strtolower((string) $mt) . (($matOf[$id]['src'] ?? '') === 'imagery' ? ' (from the aerial photo)' : '') . '.';
            $pm = $permOf[$id] ?? null; if ($pm && !empty($pm['r'])) $bits[] = 'Last re-roof permit: ' . date('M Y', strtotime($pm['r'] . '-01')) . '.';
            if (!empty($d['val'])) $bits[] = 'County value: $' . number_format((int) $d['val']) . '.';
            if ($owner !== '') $bits[] = 'Owner of record (county): ' . $owner . '.';
            if ($p && ($p['source'] ?? '') !== 'door') $bits[] = 'Phone was looked up, not given at the door: check the Do Not Call lists before calling.';
            if ($n) $bits[] = 'Door note: ' . $n['note'];
            $tags = ['Door knock', (string) ($r['label'] ?? $key)];
            if ($big && (float) $big[1] >= 1) $tags[] = 'Hail ' . $in($big[1]);
            if ($wmax) $tags[] = 'Wind ' . (int) $wmax[1] . ' mph';
            $out[] = ['key' => $key, 'id' => $id, 'owner' => $owner, 'org' => $org, 'address' => (string) $d['address'], 'city' => (string) ($pl['c'] ?? ($r['label'] ?? '')),
                      'zip' => (string) ($pl['z'] ?? ''), 'phone' => (string) ($p['phone'] ?? ''), 'email' => (string) ($em['email'] ?? ''), 'desc' => implode(' ', $bits), 'tags' => $tags,
                      'lat' => isset($d['lat']) && is_numeric($d['lat']) ? (float) $d['lat'] : null, 'lon' => isset($d['lon']) && is_numeric($d['lon']) ? (float) $d['lon'] : null, 'walk' => $walk];
        }
        unset($data);
    }
    return $out;
}
/** send what has not gone yet; [sent contacts, appointments, failures, errors] */
function jnSync(int $max = 60): array {
    $cf = jnConf(); $key = (string) ($cf['key'] ?? '');
    if ($key === '') return ['ok' => false, 'error' => 'JobNimbus is not connected.'];
    $sf = jnFile('jobnimbus-sent.json');
    $lk = @fopen($sf . '.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX | LOCK_NB)) return ['ok' => true, 'busy' => true, 'sent' => 0, 'tasks' => 0, 'failed' => 0];
    $sent = json_decode((string) @file_get_contents($sf), true) ?: [];
    $tz = new DateTimeZone(appTz()); $n = 0; $t = 0; $bad = 0; $errs = [];
    foreach (bookedLeads() as $L) {
        if ($n + $t >= $max) break;
        $sk = $L['key'] . '/' . $L['id']; $s = $sent[$sk] ?? null;
        if (!$s) {
            $c = ['first_name' => '', 'last_name' => $L['org'] ? '' : ($L['owner'] !== '' ? $L['owner'] : $L['address']), 'company' => $L['org'] ? $L['owner'] : '',
                  'record_type_name' => (string) ($cf['workflow'] ?? 'Customer'), 'status_name' => (string) ($cf['status'] ?? 'Lead'),
                  'address_line1' => $L['address'], 'city' => $L['city'], 'state_text' => market()['state'], 'zip' => $L['zip'],
                  'mobile_phone' => $L['phone'], 'email' => $L['email'], 'description' => $L['desc'], 'tags' => implode(',', $L['tags'])];
            if (!empty($cf['source'])) $c['source_name'] = (string) $cf['source'];
            if ($L['lat'] !== null && $L['lon'] !== null) $c['geo'] = ['lat' => $L['lat'], 'lon' => $L['lon']];
            [$code, $j, $err] = jnCall('POST', '/contacts', $c, $key);
            $jnid = (string) ($j['jnid'] ?? ($j['id'] ?? ''));
            if ($code < 200 || $code >= 300 || $jnid === '') { $bad++; $errs[] = $L['address'] . ': JobNimbus answered ' . ($code ?: 'nothing') . ($err ? ' (' . $err . ')' : '') . (isset($j['message']) ? ' ' . substr((string) $j['message'], 0, 120) : ''); if ($code === 401 || $code === 403) break; continue; }
            $s = $sent[$sk] = ['jnid' => $jnid, 'at' => time(), 'task' => null]; $n++;
        }
        if ($L['walk'] && empty($s['task'])) {
            $start = new DateTime($L['walk']['date'] . ' ' . ($L['walk']['time'] !== '' ? $L['walk']['time'] : '09:00'), $tz);
            $task = ['title' => 'Roof walk: ' . $L['address'] . ($L['walk']['time'] === '' ? ' (time to agree)' : ''), 'date_start' => $start->getTimestamp(), 'date_end' => $start->getTimestamp() + 3600,
                     'related' => [['id' => $s['jnid']]], 'record_type_name' => (string) ($cf['task'] ?? 'Appointment'), 'description' => $L['desc']];
            [$code, $j, $err] = jnCall('POST', '/tasks', $task, $key);
            $tid = (string) ($j['jnid'] ?? ($j['id'] ?? ''));
            if ($code >= 200 && $code < 300 && $tid !== '') { $sent[$sk]['task'] = $tid; $sent[$sk]['walk'] = $L['walk']['date'] . ' ' . $L['walk']['time']; $t++; }
            else { $bad++; $errs[] = $L['address'] . ' (appointment): JobNimbus answered ' . ($code ?: 'nothing') . ($err ? ' (' . $err . ')' : ''); }
        }
    }
    writeJsonAtomic($sf, $sent); @chmod($sf, 0600);
    /* "last send" is the last run that sent or failed something; a run with nothing new only notes when it checked */
    if ($n || $t || $bad) $cf['last'] = ['at' => time(), 'sent' => $n, 'tasks' => $t, 'failed' => $bad, 'error' => $errs[0] ?? null];
    $cf['checked'] = time(); writeJsonAtomic(jnFile('jobnimbus.json'), $cf); @chmod(jnFile('jobnimbus.json'), 0600);
    flock($lk, LOCK_UN); fclose($lk);
    return ['ok' => true, 'sent' => $n, 'tasks' => $t, 'failed' => $bad, 'errors' => array_slice($errs, 0, 5)];
}
if (in_array($action, ['jobnimbus', 'jnset', 'jnstatus', 'jnsync'], true)) {
    if ($role !== 'admin' || !feature('roof')) fail('Not allowed.', 403);
    if ($action === 'jobnimbus') {
        exportLog(['what' => 'bookings for JobNimbus']);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="booked-doors-for-jobnimbus-' . date('Y-m-d') . '.csv"');
        $fh = fopen('php://output', 'w');
        fputcsv($fh, ['First Name', 'Last Name', 'Company', 'Address Line 1', 'City', 'State', 'Zip', 'Mobile Phone', 'Email', 'Contact Type', 'Status', 'Source', 'Description', 'Tags'], ',', '"', '');
        $src = 'Door knocking (' . (company()['name'] ?: 'door app') . ')';
        foreach (bookedLeads() as $L) fputcsv($fh, array_map('csvSafe', ['', $L['org'] ? '' : $L['owner'], $L['org'] ? $L['owner'] : '', $L['address'], $L['city'], market()['state'], $L['zip'],
            $L['phone'], $L['email'], 'Customer', 'Lead', $src, $L['desc'], implode(', ', $L['tags'])]), ',', '"', '');
        fclose($fh);
        exit;
    }
    if ($action === 'jnstatus') {
        $cf = jnConf(); $sent = json_decode((string) @file_get_contents(jnFile('jobnimbus-sent.json')), true) ?: [];
        $key = (string) ($cf['key'] ?? ''); $waiting = 0;
        if ($key !== '') foreach (bookedLeads() as $L) { $s = $sent[$L['key'] . '/' . $L['id']] ?? null; if (!$s || ($L['walk'] && empty($s['task']))) $waiting++; }
        out(['ok' => true, 'connected' => $key !== '', 'tail' => $key !== '' ? substr($key, -4) : '', 'workflow' => $cf['workflow'] ?? 'Customer', 'status' => $cf['status'] ?? 'Lead',
             'task' => $cf['task'] ?? 'Appointment', 'source' => $cf['source'] ?? '', 'sent' => count($sent), 'waiting' => $waiting, 'last' => $cf['last'] ?? null]);
    }
    if (!$isPost && !defined('SIXFOLD_CLI')) fail('POST required', 405);
    if ($action === 'jnset') {
        $cf = jnConf();
        if (!empty($body['clear'])) { @unlink(jnFile('jobnimbus.json')); out(['ok' => true, 'connected' => false]); }
        $name = fn($v, $d) => ($v = trim((string) $v)) !== '' ? substr(preg_replace('/[\x00-\x1f]/', '', $v), 0, 60) : $d;
        $key = trim((string) ($body['key'] ?? ''));
        if ($key !== '') {
            if (!preg_match('/^[A-Za-z0-9._-]{8,200}$/D', $key)) fail('That does not look like a JobNimbus API key.');
            [$code, , $err] = jnCall('GET', '/contacts?size=1', null, $key);   /* proves the key before it is kept */
            if ($code === 401 || $code === 403) fail('JobNimbus refused that key. In JobNimbus: Settings, API, make a new key and paste it here.');
            if ($code < 200 || $code >= 300) fail('JobNimbus could not be reached (' . ($code ?: $err ?: 'no answer') . '). Try again in a minute.');
            $cf['key'] = $key; $cf['setBy'] = $me; $cf['setAt'] = time();
        } elseif (empty($cf['key'])) fail('Paste the JobNimbus API key first.');
        $cf['workflow'] = $name($body['workflow'] ?? '', $cf['workflow'] ?? 'Customer'); $cf['status'] = $name($body['status'] ?? '', $cf['status'] ?? 'Lead');
        $cf['task'] = $name($body['task'] ?? '', $cf['task'] ?? 'Appointment');
        if (array_key_exists('source', $body)) $cf['source'] = $name($body['source'] ?? '', '');
        if (!writeJsonAtomic(jnFile('jobnimbus.json'), $cf)) fail('Could not save that. Try again.', 500);
        @chmod(jnFile('jobnimbus.json'), 0600);
        out(['ok' => true, 'connected' => true, 'tail' => substr((string) $cf['key'], -4)]);
    }
    if ($action === 'jnsync') { @set_time_limit(120); out(jnSync()); }
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
    exportLog(['what' => 'doors worked']);
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
