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
@ini_set('serialize_precision', '-1');   /* the host sets 100: 10.4 went out as 10.40000000000000035... (2026-10-15) */

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
            'oneDevice' => true,
            /* 365 Aeration & Seeding (2026-10-14, Sixfold's aeration brand): its name and phone for what customers see, and the base and radius
               of its service area. null = no aeration brand (every other install) */
            'a365' => null];
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
    $a = is_array($c['a365']) ? $c['a365'] : null;
    $c['a365'] = $a ? ['name' => mb_substr((string) ($a['name'] ?? ''), 0, 60), 'phone' => mb_substr((string) ($a['phone'] ?? ''), 0, 30),
        'base' => (is_array($a['base'] ?? null) && count($a['base']) === 2) ? [(float) $a['base'][0], (float) $a['base'][1]] : null, 'radius' => (float) ($a['radius'] ?? 0),
        'web' => preg_match('/^[a-z0-9.-]{3,60}$/i', (string) ($a['web'] ?? '')) ? (string) $a['web'] : ''] : null;   /* the website, for email signatures (2026-10-16) */
    /* the name each person signs with, by account name (2026-10-16, Jen: "I usually go by Jenn"); never sent with the company, only to that person */
    $c['_signAs'] = [];
    foreach ((array) ($a['signAs'] ?? []) as $k => $v) if (is_string($k) && is_string($v) && trim($v) !== '') $c['_signAs'][mb_substr($k, 0, 40)] = mb_substr(trim($v), 0, 40);
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
/* ---- where an account is used (2026-10-15, Matthew: the office and quote-only accounts, "I worry she might send it to Bryce and his
 * wife in Houston") ----
 * The address each request comes from is placed with DB-IP's free "IP to City Lite" (CC BY 4.0, db-ip.com), cut to country and US
 * state and kept on this server (traverse-shared/geo, built by geo-build/geobuild.py); no address is sent anywhere to be looked up.
 * DATA_DIR/geo-guard.json: {"mode": "alert" | "block", "allow": ["US|Colorado"], "roles": ["office", "quote"]}. Alert: the admins get
 * a phone alert the first time an address outside the allowed places is used, and it is logged; nothing changes for the person.
 * Block: the same, and the request is refused (signed out). New devices (a long-lived marker cookie) are alerted too. */
function geoDir(): string { return dirname(__DIR__, 2) . '/traverse-shared/geo'; }
function geoOf(string $ip): ?array {
    static $keys = null;
    $bin = @inet_pton($ip); if ($bin === false) return null;
    if ($keys === null) { $j = json_decode((string) @file_get_contents(geoDir() . '/geo-keys.json'), true); $keys = is_array($j) ? ($j['keys'] ?? []) : []; }
    if (!$keys) return null;
    $v6 = strlen($bin) === 16; $rec = $v6 ? 34 : 10; $f = @fopen(geoDir() . ($v6 ? '/geo-v6.bin' : '/geo-v4.bin'), 'rb'); if (!$f) return null;
    $n = (int) (filesize(geoDir() . ($v6 ? '/geo-v6.bin' : '/geo-v4.bin')) / $rec); $lo = 0; $hi = $n - 1; $hit = null;
    while ($lo <= $hi) {
        $mid = intdiv($lo + $hi, 2); fseek($f, $mid * $rec); $r = fread($f, $rec);
        $a = substr($r, 0, $v6 ? 16 : 4); $b = substr($r, $v6 ? 16 : 4, $v6 ? 16 : 4);
        if (strcmp($bin, $a) < 0) $hi = $mid - 1; elseif (strcmp($bin, $b) > 0) $lo = $mid + 1; else { $hit = unpack('n', substr($r, $v6 ? 32 : 8, 2))[1]; break; }
    }
    fclose($f);
    if ($hit === null || !isset($keys[$hit])) return null;
    [$cc, $reg] = array_pad(explode('|', (string) $keys[$hit], 2), 2, '');
    return ['k' => (string) $keys[$hit], 'cc' => $cc, 'region' => $reg, 'place' => $reg !== '' ? $reg . ($cc === 'US' ? '' : ', ' . $cc) : ($cc === 'ZZ' ? 'a private or unknown network' : $cc)];
}
function geoGuard(): ?array {
    $j = json_decode((string) @file_get_contents(DATA_DIR . '/geo-guard.json'), true);
    if (!is_array($j) || !in_array($j['mode'] ?? '', ['alert', 'block'], true)) return null;
    return ['mode' => $j['mode'], 'allow' => array_values(array_filter((array) ($j['allow'] ?? ['US|Colorado']), 'is_string')), 'roles' => array_values(array_filter((array) ($j['roles'] ?? ['office', 'quote']), 'is_string'))];
}
function geoBrowser(): string { $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''); foreach (['Edg/' => 'Edge', 'OPR/' => 'Opera', 'Firefox/' => 'Firefox', 'CriOS' => 'Chrome', 'Chrome/' => 'Chrome', 'Safari/' => 'Safari'] as $k => $v) if (strpos($ua, $k) !== false) return $v; return 'a browser'; }
/** alert every admin's phones (the Traverse super admin too) */
function adminAlert(string $title, string $text, string $tag): void {
    global $basePeople, $acct, $sessionKey;
    try {
        $v = pushVapid(false); if (!$v) return;
        $subs = pushSubs(); $payload = json_encode(['title' => $title, 'body' => $text, 'url' => './', 'tag' => $tag, 'at' => time()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        foreach (acctRows($basePeople, $acct, $sessionKey) as $r) if (!$r['off'] && in_array($r['role'], ['admin', 'super'], true)) foreach (($subs[$r['id']] ?? []) as $d) webpushSend($d['sub'], $payload, $v, 86400, ['urgency' => 'high']);
    } catch (Throwable $e) { error_log('rounds admin alert: ' . $e->getMessage()); }
}
function geoSeenEdit(callable $fn) {
    $file = DATA_DIR . '/geo-seen.json'; $lk = @fopen($file . '.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX)) return null;
    $a = json_decode((string) @file_get_contents($file), true) ?: []; $r = $fn($a);
    @file_put_contents($file, json_encode($a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX); flock($lk, LOCK_UN); return $r;
}
/** each request from a guarded account: where is it? (an address is looked up once a day) */
function geoCheck(string $who, string $acctId, string $role): void {
    $g = geoGuard(); if (!$g || !in_array($role, $g['roles'], true) || $acctId === '') return;
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? ''); if ($ip === '') return;
    $res = geoSeenEdit(function (&$a) use ($ip, $acctId, $who, $g) {
        $row = $a[$acctId]['ip'][$ip] ?? null;
        if ($row && ($row['at'] ?? 0) > time() - 86400) { $a[$acctId]['ip'][$ip]['last'] = time(); return [$row, false]; }
        $p = geoOf($ip); $ok = !$p || $p['cc'] === 'ZZ' || in_array($p['k'], $g['allow'], true);
        $new = !$row || ($row['ok'] ?? true) !== $ok;
        $row = ['at' => time(), 'last' => time(), 'k' => $p ? $p['k'] : '', 'place' => $p ? $p['place'] : 'unknown', 'ok' => $ok];
        $a[$acctId]['ip'][$ip] = $row; $a[$acctId]['name'] = $who;
        if (count($a[$acctId]['ip']) > 200) { uasort($a[$acctId]['ip'], fn($x, $y) => ($y['last'] ?? 0) <=> ($x['last'] ?? 0)); $a[$acctId]['ip'] = array_slice($a[$acctId]['ip'], 0, 200, true); }
        return [$row, $new];
    });
    if (!$res) return;
    [$row, $new] = $res;
    if (!$row['ok']) {
        if ($new) {
            appendLine(DATA_DIR . '/geoalert.log', ['kind' => 'place', 'who' => $who, 'place' => $row['place'], 'ip' => $ip, 'device' => deviceName() . ', ' . geoBrowser(), 'mode' => $g['mode'], 'at' => time()]);
            adminAlert($who . '’s account used from ' . $row['place'], deviceName() . ', ' . geoBrowser() . ($g['mode'] === 'block' ? ' · signed out' : ' · not blocked (alerts only)'), 'geo-' . $acctId);
        }
        if ($g['mode'] === 'block') { http_response_code(401); header('Content-Type: application/json'); echo json_encode(['ok' => false, 'why' => 'place', 'error' => 'This account can only be used in Colorado. If you are in Colorado, call Matthew.']); exit; }
    }
}
/** at sign-in: a device this account has not used before (a marker cookie kept two years) */
function geoDevice(string $who, string $acctId, string $role): void {
    $g = geoGuard(); if (!$g || !in_array($role, $g['roles'], true) || $acctId === '') return;
    $did = (string) ($_COOKIE['sxdev'] ?? '');
    if (!preg_match('/^[0-9a-f]{24}$/D', $did)) {
        $did = bin2hex(random_bytes(12));
        setcookie('sxdev', $did, ['expires' => time() + 730 * 86400, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off')]);
    }
    $p = geoOf((string) ($_SERVER['REMOTE_ADDR'] ?? '')); $dev = deviceName() . ', ' . geoBrowser();
    $isNew = geoSeenEdit(function (&$a) use ($acctId, $did, $who, $dev) {
        $had = $a[$acctId]['dev'] ?? []; $new = !isset($had[$did]);
        $a[$acctId]['dev'][$did] = ['first' => $had[$did]['first'] ?? time(), 'last' => time(), 'what' => $dev]; $a[$acctId]['name'] = $who;
        return $new && count($had) > 0;   /* the first device recorded is not news */
    });
    if ($isNew) {
        appendLine(DATA_DIR . '/geoalert.log', ['kind' => 'device', 'who' => $who, 'place' => $p ? $p['place'] : 'unknown', 'ip' => (string) ($_SERVER['REMOTE_ADDR'] ?? ''), 'device' => $dev, 'mode' => $g['mode'], 'at' => time()]);
        adminAlert($who . ' signed in on a new device', $dev . ' · ' . ($p ? $p['place'] : 'place unknown'), 'geodev-' . $acctId);
    }
}
/** a lead the signed-in quote-only person made, or took on by phone or email (2026-10-15) */
/** this sign-in's name, and the names of other sign-ins linked to the same person (2026-10-21, Matthew: Jen moves to her office login
 *  "linked to her work" under her quote login, Jen): accounts file also[<id>] = [names]. Only an admin sets it. */
function meNames(): array { global $me, $acct, $session; $n = [(string) $me]; foreach ((array) ($acct['also'][(string) ($session['c'] ?? '')] ?? []) as $x) if (is_string($x) && $x !== '' && !in_array($x, $n, true)) $n[] = $x; return $n; }
function qMine(array $l): bool { $mine = meNames(); return in_array((string) ($l['by'] ?? ''), $mine, true) || (bool) array_intersect($mine, (array) ($l['qown'] ?? [])) || ((string) ($l['owner'] ?? '') !== '' && in_array((string) $l['owner'], $mine, true)); }   /* + linked sign-ins (2026-10-21) */   /* + a lead handed to her as its owner (2026-10-20) */
const QUOTE_INBOX_FROM = 1792189222;   /* quoteInbox()'s cut-off (2026-10-16); up here because the role gate below the session check calls it before line 3690 has run (2026-10-18, Fable review) */
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
/* the office lookup's extra homes (2026-10-14): <town>-lookup.json, homes not on the door list (rented ones, mostly). Read only by the
   search index (lines marked L, shown to the office's House lookup) and houseFacts; never a door list, never the crew's search. */
function lookupDoors(string $key): array {
    if (!preg_match('/^[a-z0-9-]{1,40}$/D', $key)) return [];
    static $memo = [];
    if (!isset($memo[$key])) { $j = json_decode((string) @file_get_contents(DATA_DIR . '/' . $key . '-lookup.json'), true); $memo[$key] = is_array($j['doors'] ?? null) ? $j['doors'] : []; }
    return $memo[$key];
}
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
/* ---- reading the logs once (review 2026-10-22) -----------------------------------------
 * Every loader re-opened and re-decoded its log on every call: leadsAll() 20-odd times for one Pipeline load, jobForLead() once per
 * ClickUp task, the marks and phones logs twice per door list. A file is now decoded once per request and kept by its size and mtime
 * (the stamp townSplit() keeps a town by), so a line appended in this request, or by another process, is seen on the next read, as
 * before. The logs are append-only, so the stamp cannot stay the same across a change. */
function fileSig(string $f): string { clearstatcache(true, $f); $s = @stat($f); return $s ? $s['size'] . ':' . $s['mtime'] : ''; }
/** the rows of one JSONL file that decode to arrays, in file order */
function jsonLines(string $f): array {
    static $c = [];
    $sig = fileSig($f); if ($sig === '') return [];
    if (isset($c[$f]) && $c[$f][0] === $sig) return $c[$f][1];
    $rows = [];
    if (is_readable($f) && ($fh = @fopen($f, 'r'))) { while (($line = fgets($fh)) !== false) { $r = json_decode(trim($line), true); if (is_array($r)) $rows[] = $r; } fclose($fh); }
    $c[$f] = [$sig, $rows];
    return $rows;
}
function logRows(string $kind, string $key): array {
    static $c = [];
    $partners = sharedWith($key);
    $files = array_map(fn($p) => DATA_DIR . '/' . $kind . '-' . $p . '.log', array_merge($partners, [$key]));
    $sig = implode('|', array_map('fileSig', $files)); $ck = $kind . '/' . $key;
    if (isset($c[$ck]) && $c[$ck][0] === $sig) return $c[$ck][1];
    $mine = $partners ? doorIds($key) : [];
    $all = []; $seq = 0;
    foreach ($partners as $i => $p) foreach (jsonLines($files[$i]) as $r) {
        $hit = isset($r['id']) ? isset($mine[$r['id']])
             : (isset($r['ids']) && array_intersect_key(array_flip((array) $r['ids']), $mine));   /* area flags carry a list */
        if ($hit) { $r['_from'] = $p; $all[] = [(int) ($r['at'] ?? 0), (float) ($r['rt'] ?? 0), $seq++, $r]; }
    }
    foreach (jsonLines(end($files)) as $r) $all[] = [(int) ($r['at'] ?? 0), (float) ($r['rt'] ?? 0), $seq++, $r];
    /* one total order (Fable): tap second, then unstamped before stamped, then receipt time,
       then file order — partner files first, because they hold the door's older history */
    usort($all, fn($a, $b) => $a[0] <=> $b[0] ?: ($a[1] > 0) <=> ($b[1] > 0) ?: $a[1] <=> $b[1] ?: $a[2] <=> $b[2]);
    $c[$ck] = [$sig, $rows = array_map(function ($x) { unset($x[3]['rt']); return $x[3]; }, $all)];
    return $rows;
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
/* ---- the lawn measured by hand (2026-10-21, Matthew: Jen measured 11663 N Settlers at 10,473 sq ft in Google Earth; the photo said
 * 226) ---- the size of record on that house: the quote starts from it and every card shows it. src: ge (Google Earth, traced by
 * hand), wheel (measuring wheel), other. incl: grass (grass only), trees (grass under the trees too), beds (grass and beds). Last line
 * per door wins; sq 0 clears it. Kept as the calibration data for the photo's estimate. */
function loadLawnHand(string $key): array {
    $out = [];
    foreach (logRows('lawnhand', $key) as $r) {
        if (!is_array($r) || !isset($r['id'])) continue;
        if (empty($r['sq'])) unset($out[$r['id']]);
        else $out[$r['id']] = ['sq' => (int) $r['sq'], 'src' => (string) ($r['src'] ?? ''), 'incl' => (string) ($r['incl'] ?? ''), 'by' => (string) ($r['by'] ?? ''), 'at' => (int) ($r['at'] ?? 0)];
    }
    return $out;
}
/** a lot under trees: its lawn range from the server's measure (lawn-range.mjs), cached for good (the photo does not change) */
function lawnRangeCache(): array { $j = json_decode((string) @file_get_contents(DATA_DIR . '/lawn-range.json'), true); return is_array($j) ? $j : []; }
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
function boardOpen(string $role): bool { return BOARD_OPEN || $role === 'admin' || $role === 'manager' || mgr(); }
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
const SEARCH_DIRS = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'NORTH', 'SOUTH', 'EAST', 'WEST'];   /* direction words a search tries again without (2026-10-21): a365NoDir() and 'search' */
function searchIndex(): array {
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $f = DATA_DIR . '/search-index.txt';
    $newest = 0; foreach (($idx['regions'] ?? []) as $r) { $rf = regionFile($r['key']); if ($rf) $newest = max($newest, (int) @filemtime($rf)); $newest = max($newest, (int) @filemtime(DATA_DIR . '/' . $r['key'] . '-lookup.json')); }
    if (!is_readable($f) || (int) @filemtime($f) < $newest) {
        $out = '';
        foreach (($idx['regions'] ?? []) as $r) {
            if (!empty($r['admin'])) continue;   /* the cached index is shared by everyone, so admin-only towns stay out of search */
            $data = loadRegion($r['key']); if (!$data) continue;
            foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
                $out .= implode("\t", [$r['key'], $r['label'], $a['name'], $d['id'], strtoupper((string) $d['address']), (int) ($d['fire'] ?? 0),
                    $d['lawn']['lv'] ?? '', $d['lawn']['yr'] ?? '', treeLevel($d) ?? '', '']) . "\n";
            }
            foreach (lookupDoors($r['key']) as $d) $out .= implode("\t", [$r['key'], ((string) ($d['town'] ?? '')) ?: $r['label'], $r['key'] === 'looked-up' ? 'Pulled in on request' : 'Not on the door lists',$d['id'], strtoupper((string) $d['address']), (int) ($d['fire'] ?? 0),
                $d['lawn']['lv'] ?? '', $d['lawn']['yr'] ?? '', treeLevel($d) ?? '', 'L']) . "\n";   /* the office lookup (2026-10-14) */
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
function custLines(string $name): array { return jsonLines(custDir() . '/' . $name); }   /* decoded once per request (review 2026-10-22) */
function loadCustomers(): array {
    $c = [];
    foreach (custLines('customers.log') as $r) {
        $id = (string) ($r['id'] ?? ''); if ($id === '' || !is_array($r['f'] ?? null)) continue;
        if (!isset($c[$id])) $c[$id] = ['id' => $id, 'created' => (int) ($r['at'] ?? 0), 'createdBy' => (string) ($r['by'] ?? '')];
        foreach ($r['f'] as $k => $v) $c[$id][$k] = $v;
        $c[$id]['updated'] = (int) ($r['at'] ?? 0); $c[$id]['updatedBy'] = (string) ($r['by'] ?? '');
    }
    if (webHide()) { $web = webLeadIds(); $c = array_filter($c, fn($x) => ($x['source'] ?? '') !== 'a365web' && !isset($web[(string) ($x['lead'] ?? '')])); }   /* a 365-website customer is Matthew's (2026-10-22) */
    return $c;
}
/** a customer from a lead (Won makes the customer, 2026-10-15; shared since 2026-10-21): the one already tied to the lead; or someone already
 *  a customer, not tied to a lead, with the same phone, email or name (Brian Skelton was a customer twice), now tied; or a new one from the
 *  lead as it is now (details, house, quote, service). null when there is no such lead. */
function custFromLead(string $lid, string $by): ?array {
    $L = leadsAll()[$lid] ?? null; if (!$L) return null;
    $cs = loadCustomers(); $today = (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d');
    foreach ($cs as $c) if (($c['lead'] ?? '') === $lid && ($c['status'] ?? 'active') !== 'ended') return ['id' => $c['id'], 'existing' => true];
    $ld = substr((string) preg_replace('/\D/', '', (string) ($L['phone'] ?? '')), -10); $le = strtolower(trim((string) ($L['email'] ?? ''))); $ln = mb_strtolower(trim((string) ($L['name'] ?? '')));
    foreach ($cs as $c) {
        if (!empty($c['lead']) || ($c['status'] ?? 'active') === 'ended') continue;
        $cd = substr((string) preg_replace('/\D/', '', (string) ($c['phone'] ?? '')), -10);
        if ((strlen($ld) === 10 && $cd === $ld) || ($le !== '' && strtolower(trim((string) ($c['email'] ?? ''))) === $le) || ($ln !== '' && mb_strtolower(trim((string) ($c['name'] ?? ''))) === $ln)) {
            appendLine(custDir() . '/customers.log', ['id' => $c['id'], 'by' => $by, 'at' => time(), 'f' => ['lead' => $lid]]);
            return ['id' => $c['id'], 'existing' => true, 'linked' => true];
        }
    }
    $LH = is_array($L['house'] ?? null) ? $L['house'] : null;
    $f = ['status' => 'active', 'plan' => 'oneoff', 'service' => custServices()[0], 'start' => $today,
          'name' => a365Clean($L['name'] ?? '', 120) ?: 'Customer', 'phone' => a365Clean($L['phone'] ?? '', 40), 'email' => a365Clean($L['email'] ?? '', 160),
          'town' => a365Clean($LH ? streetCaseServer((string) $LH['town']) : ($L['town'] ?? ''), 60), 'source' => (string) ($L['src'] ?? 'other'), 'lead' => $lid];
    if ($LH && !empty($LH['address'])) $f['address'] = streetCaseServer((string) $LH['address']);
    if ($LH && empty($LH['typed']) && preg_match('/^[a-z0-9-]{1,40}$/D', (string) ($LH['region'] ?? '')) && preg_match('/^[a-z0-9-]{1,80}$/D', (string) ($LH['door'] ?? ''))) $f['door'] = $LH['region'] . '/' . $LH['door'];   /* the lead's house becomes the customer's property (2026-10-16) */
    if (!empty($L['quote']['price'])) $f['price'] = (float) $L['quote']['price'];
    else foreach (jobsAll() as $j) if (!$j['off'] && (string) $j['lead'] === $lid && (int) $j['price'] > 0) { $f['price'] = (float) $j['price']; break; }   /* booked with no quote saved: the job's price */
    /* the service whose name the enquiry mentions ("Fire mitigation" -> fire), the most specific if several; else the first one */
    $bestLen = 0;
    foreach (company()['services'] as $sv) {
        $word = substr(strtolower(strtok((string) $sv[1], ' &')), 0, 5);
        if ($sv[0] !== 'other' && strlen($word) > 3 && strlen($word) > $bestLen && stripos((string) ($L['need'] ?? ''), $word) !== false) { $f['service'] = (string) $sv[0]; $bestLen = strlen($word); }
    }
    $id = 'c' . date('YmdHis') . bin2hex(random_bytes(3));
    if (!appendLine(custDir() . '/customers.log', ['id' => $id, 'by' => $by, 'at' => time(), 'f' => $f])) return null;
    return ['id' => $id];
}
/** every lead that is Won or has a job on the board, with no customer yet, gets one (2026-10-21, Matthew: Sreenivas and Joseph were booked
 *  through the form and missing from Customers). Lost leads and test names are left alone. Returns how many it made or tied. */
function ensureBookedCustomers(): int {
    if (!feature('walkdesk')) return 0;
    $has = []; foreach (loadCustomers() as $c) if (!empty($c['lead'])) $has[(string) $c['lead']] = 1;
    $job = []; foreach (jobsAll() as $j) if (!$j['off'] && !empty($j['lead'])) $job[(string) $j['lead']] = 1;
    $n = 0;
    foreach (leadsAll() as $l) {
        $id = (string) $l['id']; if (isset($has[$id]) || ($l['status'] ?? '') === 'lost' || preg_match('/\btest\b|claude/i', (string) ($l['name'] ?? ''))) continue;
        if (($l['status'] ?? '') !== 'won' && !isset($job[$id])) continue;
        if (custFromLead($id, 'the app (booked)')) $n++;
    }
    return $n;
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
/* the customer's next visit already happened (2026-10-19, Matthew: Eric and Russ said Overdue though their jobs were done): a visit, or a
   job for their lead, marked done on or after that date. A one-off customer's next date is the job day and nothing moves it on, so without
   this they show Overdue forever. "Could not do it" does not count. One-off customers only: a recurring plan's next date already moves on
   when a visit is logged, so a next date someone set by hand on a recurring customer stands (customers-test, 2026-10-19 night). */
function custNextDone(array $c, array $visits = []): bool {
    $n = (string) ($c['next'] ?? ''); if ($n === '' || ($c['plan'] ?? 'oneoff') !== 'oneoff') return false;
    foreach ($visits as $v) if (($v['status'] ?? 'done') === 'done' && (string) ($v['date'] ?? '') >= $n) return true;
    if (empty($c['lead'])) return false;
    static $doneByLead = null;
    if ($doneByLead === null) { $doneByLead = []; foreach (jobsAll() as $j) if (!$j['off'] && !empty($j['lead']) && (($j['done']['o'] ?? '') === 'done')) $doneByLead[(string) $j['lead']][] = (string) $j['date']; }
    foreach ($doneByLead[(string) $c['lead']] ?? [] as $d) if ($d >= $n) return true;
    return false;
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
/* Won or booked gives the customer (2026-10-21): after the requests that can book a job or win a lead, from the customer's side or ours */
if (($isPost && in_array($action, ['a365accept', 'a365signed', 'a365savecard', 'qwon', 'jobsave', 'leadstatus', 'squareconfirm', 'jobpaid'], true)) || in_array($action, ['clickuppoll', 'metapoll'], true))   /* the polls run as GET too */
    register_shutdown_function(function () use ($action) { try { ensureBookedCustomers(); } catch (Throwable $e) { error_log('rounds: booked customers: ' . $e->getMessage()); } if ($action === 'metapoll') { try { adSpendReminder(); } catch (Throwable $e) { error_log('rounds: ad spend reminder: ' . $e->getMessage()); } } });   /* + the 7 pm ad spend reminder, on the 5-minute poll */
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
if ($action === 'company') out(['ok' => true, 'company' => ['market' => company()['market'] ? market() : null] + array_diff_key(company(), ['appUrl' => 1, 'market' => 1, '_signAs' => 1])]);   /* the market checked (2026-10-11) */

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
    if (!defined('SIXFOLD_CLI') && in_array($payload['r'], ['office', 'quote'], true)) { geoCheck((string) $payload['n'], (string) $payload['c'], (string) $payload['r']); geoDevice((string) $payload['n'], (string) $payload['c'], (string) $payload['r']); }   /* 2026-10-15 */
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
    return ['ok' => true, 'name' => $payload['n'], 'sign' => (string) (company()['_signAs'][$payload['n']] ?? ''), 'role' => $payload['r'] === 'super' ? 'admin' : $payload['r'], 'super' => $payload['r'] === 'super', 'walker' => !empty($GLOBALS['acct']['walker'][(string) $payload['c']]), 'pays' => paysOn((string) $payload['c']), 'runsteam' => $payload['r'] === 'office' && acctFlag('runsteam', (string) $payload['c']), 'wonlost' => $payload['r'] === 'office' && acctFlag('wonlost', (string) $payload['c']), 'doors' => $payload['r'] === 'office' && acctFlag('doors', (string) $payload['c']), 'communities' => $payload['r'] === 'office' && acctFlag('communities', (string) $payload['c']), 'results' => $payload['r'] === 'office' && acctFlag('results', (string) $payload['c']), 'fq' => in_array($payload['r'], ['crew', 'manager'], true) && !empty(company()['a365']) && acctFlag('fq', (string) $payload['c']), 'mail' => (bool) a365MailCfg(), 'sid' => sessionTag($tok), 'avatar' => avatarVer((string) $payload['c'])];
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
if (PHP_SAPI === 'cli' && defined('SIXFOLD_CLI') && in_array($action, ['digest', 'skiptrace', 'skiplist', 'skipexport', 'pushcron', 'stormcron', 'jnsync', 'metapoll', 'metasetup', 'clickuppoll', 'squarenightly', 'squaresweep'], true)) {
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
        if ($e['kind'] === 'job') { $sum = 'Job: ' . $e['title']; $loc = (string) $e['addr']; $uid = 'job-' . $e['job']; $len = 'PT90M'; $e['note'] = trim($e['need'] . ($e['note'] !== '' ? "\n" . $e['note'] : '')); }
        elseif ($e['kind'] === 'walk' && !empty($e['dw'])) {   /* the walk desk (2026-10-14) */
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

/* ---- 365 Aeration & Seeding's website form (2026-10-14) ----
 * The quote / information form on 365aeration.com (aeration365.com forwards there) posts here from the visitor's browser. It becomes a lead in the Pipeline (source
 * "365 website"), its house is found from the address when it is one of ours (phone alerts only if leadAlertsOn). Only where the
 * company has the aeration brand and the walk desk. Spam: a hidden field, a minimum time on the page, 5 a day from one address and
 * 300 a day for the whole site. Nothing about the house is ever sent back to the visitor. */
/* ---- Square (SX-58, 2026-10-15, Matthew: "connect square to the app so everything is in one place") ----
 * Pay links from Square's Checkout API: the deposit on the one-page form (the customer pays on Square's page, comes back and signs),
 * the balance from the job card. Paid is read from the link's order (state COMPLETED, or tenders with nothing left due), on the sign
 * page, from "Check" buttons, and from Square's payment webhook once its signature key is in. Keys in sixfold-private/square.json
 * (env, token, location, sigKey), never shown, never in git; no file = off. Sandbox first: no real money. */
function squareCfg(): ?array {
    static $c = false;
    if ($c === false) { $j = json_decode((string) @file_get_contents(dirname(__DIR__, 2) . '/sixfold-private/square.json'), true);
        $c = is_array($j) && !empty($j['token']) && !empty($j['location']) && in_array($j['env'] ?? '', ['sandbox', 'production'], true) ? $j : null; }
    return $c;
}
function squareApi(string $method, string $path, ?array $body = null): array {
    $c = squareCfg(); if (!$c || !function_exists('curl_init')) return ['_status' => 0, 'errors' => [['detail' => 'Square is not connected.']]];
    $h = curl_init((!empty($c['api']) && $c['env'] === 'sandbox' ? rtrim((string) $c['api'], '/') : ($c['env'] === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com')) . $path);   /* api: a stand-in Square for the tests, sandbox only */
    curl_setopt_array($h, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $c['token'], 'Square-Version: 2025-01-23', 'Content-Type: application/json']]);
    if ($body !== null) curl_setopt($h, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_SLASHES));
    $raw = curl_exec($h); $code = (int) curl_getinfo($h, CURLINFO_HTTP_CODE); curl_close($h);
    $j = is_string($raw) ? (json_decode($raw, true) ?: []) : []; $j['_status'] = $code; return $j;
}
/** a pay link for an amount (cents), back to $back when paid; [id, url, order] or an error */
function squareLink(string $name, int $cents, string $back, string $email = ''): array {
    $c = squareCfg();
    $req = ['idempotency_key' => bin2hex(random_bytes(16)), 'quick_pay' => ['name' => $name, 'price_money' => ['amount' => $cents, 'currency' => 'USD'], 'location_id' => $c['location']]];
    if ($back !== '') $req['checkout_options'] = ['redirect_url' => $back];
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) $req['pre_populated_data'] = ['buyer_email' => $email];
    $r = squareApi('POST', '/v2/online-checkout/payment-links', $req);
    if (empty($r['payment_link']) && isset($req['pre_populated_data'])) { unset($req['pre_populated_data']); $req['idempotency_key'] = bin2hex(random_bytes(16)); $r = squareApi('POST', '/v2/online-checkout/payment-links', $req); }   /* Square refuses some addresses */
    $p = $r['payment_link'] ?? null;
    if (!$p || empty($p['url']) || empty($p['order_id'])) return ['err' => 'Square did not make the link' . (!empty($r['errors'][0]['detail']) ? ': ' . $r['errors'][0]['detail'] : '') . '.'];
    return ['id' => (string) $p['id'], 'url' => (string) $p['url'], 'order' => (string) $p['order_id'], 'amt' => intdiv($cents, 100), 'env' => (string) $c['env'], 'at' => time()];
}
/** has the order behind a link been paid? [paid, payment id] */
function squareOrderPaid(string $order): array {
    if (!preg_match('/^[A-Za-z0-9]{10,64}$/D', $order)) return [false, ''];
    $r = squareApi('GET', '/v2/orders/' . $order); $o = $r['order'] ?? null; if (!$o) return [false, ''];
    $due = (int) ($o['net_amount_due_money']['amount'] ?? -1); $tn = $o['tenders'] ?? [];
    $paid = ($o['state'] ?? '') === 'COMPLETED' || ($tn && $due === 0);
    return [$paid, $paid && $tn ? (string) ($tn[0]['payment_id'] ?? $tn[0]['id'] ?? '') : ''];
}
/** the deposit on a lead's form: paid by link? (a deposit taken any other way counts as paid). Checks Square once when it is not known yet. */
function a365DepositPaid(array $l, bool $ask = true): bool {
    $S2 = $l['sign'] ?? null; if (!$S2) return false;
    if (($S2['how'] ?? '') !== 'link') return true;
    $order = (string) ($S2['pay']['order'] ?? ''); if ($order === '') return false;
    if (($l['sqpaid']['order'] ?? '') === $order) return true;
    if (!$ask) return false;
    [$paid, $pid] = squareOrderPaid($order);
    if ($paid) { appendLine(leadsDir() . '/leadst.log', ['id' => $l['id'], 'sqpaid' => ['order' => $order, 'payment' => $pid, 'amt' => (int) $S2['deposit'], 'at' => time()], 'note' => 'Deposit $' . (int) $S2['deposit'] . ' paid by Square link.', 'by' => 'Square', 'at' => time()]); a365AfterPaid($l['id']); }
    if ($paid && !empty($S2['nosign'])) a365BookNoSign((string) $l['id'], 'Square');   /* no signature needed: paid is booked (2026-10-17) */
    return $paid;
}
/* the words they agree to when they tick the box (2026-10-15, Matthew: "is there a way for them to save their card on file, if they wanna use the card for the finished payment") */
function a365SaveText(int $bal): string { return 'Save this card with Square and charge the $' . number_format(max(0, $bal)) . ' balance to it on the day of the service.'; }
/* the customer in Square's customer list: found by email, then phone, else added (2026-10-15). Returns Square's customer id or ''. */
function squareCustomer(array $l): string {
    if (!empty($l['sqcust'])) return (string) $l['sqcust'];
    $em = strtolower(trim((string) ($l['email'] ?? ''))); if (!filter_var($em, FILTER_VALIDATE_EMAIL)) $em = '';
    $tel = preg_replace('/\D/', '', (string) ($l['phone'] ?? '')); if (strlen($tel) === 11 && $tel[0] === '1') $tel = substr($tel, 1); $e164 = strlen($tel) === 10 ? '+1' . $tel : '';
    foreach ([$em ? ['email_address' => ['exact' => $em]] : null, $e164 ? ['phone_number' => ['exact' => $e164]] : null] as $f) if ($f) {
        $r = squareApi('POST', '/v2/customers/search', ['query' => ['filter' => $f], 'limit' => 1]); if (!empty($r['customers'][0]['id'])) return (string) $r['customers'][0]['id']; }
    $nm = preg_split('/\s+/', trim((string) ($l['name'] ?? ''))) ?: ['']; $given = (string) array_shift($nm);
    $req = ['idempotency_key' => 'cust-' . $l['id'], 'given_name' => mb_substr($given, 0, 100), 'family_name' => mb_substr(implode(' ', $nm), 0, 100), 'reference_id' => (string) $l['id'], 'note' => 'Added by the 365 app when the deposit was paid.'];
    if ($em) $req['email_address'] = $em; if ($e164) $req['phone_number'] = $e164;
    $h = $l['house'] ?? null; if ($h && !empty($h['address'])) $req['address'] = ['address_line_1' => streetCaseServer((string) $h['address']), 'locality' => streetCaseServer(houseTown($h)), 'administrative_district_level_1' => 'CO', 'country' => 'US'];
    $r = squareApi('POST', '/v2/customers', $req);
    if (empty($r['customer']['id']) && isset($req['email_address'])) { unset($req['email_address']); $req['idempotency_key'] = 'cust2-' . $l['id']; $r = squareApi('POST', '/v2/customers', $req); }   /* Square refuses some addresses */
    return (string) ($r['customer']['id'] ?? '');
}
/* once per deposit payment: the customer list, then the card from that payment when they ticked the box (Square allows it within a day of the payment) */
function a365AfterPaid(string $lid): void {
    $l = leadsAll()[$lid] ?? null; $pid = (string) ($l['sqpaid']['payment'] ?? '');
    if (!$l || $pid === '' || ($l['sqafter']['payment'] ?? '') === $pid) return;
    $cid = squareCustomer($l); $card = null; $why = '';
    if ($cid !== '' && !empty($l['savecard']['yes'])) {
        $r = squareApi('POST', '/v2/cards', ['idempotency_key' => 'card-' . substr(sha1($pid), 0, 32), 'source_id' => $pid, 'card' => ['customer_id' => $cid, 'reference_id' => $lid]]);
        $c = $r['card'] ?? null;
        if ($c && !empty($c['id'])) $card = ['id' => (string) $c['id'], 'brand' => ucfirst(strtolower(str_replace('_', ' ', (string) ($c['card_brand'] ?? 'Card')))), 'last4' => (string) ($c['last_4'] ?? ''), 'exp' => sprintf('%02d/%02d', (int) ($c['exp_month'] ?? 0), (int) ($c['exp_year'] ?? 0) % 100), 'at' => time()];
        else $why = (string) ($r['errors'][0]['detail'] ?? 'Square did not save it');
    }
    $note = ($cid !== '' ? 'Added to Square\'s customer list.' : 'Could not add them to Square\'s customer list.') . ($card ? ' Card saved for the balance: ' . $card['brand'] . ' ending ' . $card['last4'] . '.' : (!empty($l['savecard']['yes']) ? ' They asked to save the card, but it was not saved (' . mb_substr($why, 0, 120) . '); take the balance another way.' : ''));
    $row = ['id' => $lid, 'sqafter' => ['payment' => $pid, 'at' => time()], 'note' => $note, 'by' => 'Square', 'at' => time()];
    if ($cid !== '') $row['sqcust'] = $cid; if ($card) $row['sqcard'] = $card;
    appendLine(leadsDir() . '/leadst.log', $row);
}
/* Square's payment webhook: a payment completed for one of our links marks it paid (signature checked with sigKey) */
if ($action === 'squarehook') {
    $c = squareCfg(); $raw = (string) file_get_contents('php://input');
    if (!$c || empty($c['sigKey']) || !$isPost) fail('Not here.', 404);
    if (!isset($TEAM)) $TEAM = teamInfo($basePeople, $acct, $sessionKey);   /* a paid no-signature form books the job here, and pushName needs the crew list: Brad got no "Job booked" (2026-10-18, Fable review) */
    $url = (string) ($c['hookUrl'] ?? ('https://' . ($_SERVER['HTTP_HOST'] ?? '') . ($_SERVER['REQUEST_URI'] ?? '')));
    $want = base64_encode(hash_hmac('sha256', $url . $raw, (string) $c['sigKey'], true));
    $ev = json_decode($raw, true) ?: []; $sigIn = (string) ($_SERVER['HTTP_X_SQUARE_HMACSHA256_SIGNATURE'] ?? '');
    /* also the address the event came to (2026-10-19): a second subscription without &env=live was failing every event; same key, other URL */
    $sigOk = hash_equals($want, $sigIn) || hash_equals(base64_encode(hash_hmac('sha256', 'https://' . ($_SERVER['HTTP_HOST'] ?? '') . ($_SERVER['REQUEST_URI'] ?? '') . $raw, (string) $c['sigKey'], true)), $sigIn);
    appendLine(DATA_DIR . '/squarehook.log', ['at' => time(), 'sig' => $sigOk, 'uri' => mb_substr((string) ($_SERVER['REQUEST_URI'] ?? ''), 0, 120), 'type' => mb_substr((string) ($ev['type'] ?? ''), 0, 40), 'event' => mb_substr((string) ($ev['event_id'] ?? ''), 0, 60), 'status' => mb_substr((string) ($ev['data']['object']['payment']['status'] ?? ''), 0, 20), 'ip' => (string) ($_SERVER['REMOTE_ADDR'] ?? '')]);   /* what arrived, never card details */
    if (!$sigOk) fail('Not allowed.', 403); $pay = $ev['data']['object']['payment'] ?? null;
    if ($pay && ($pay['status'] ?? '') === 'COMPLETED' && !empty($pay['order_id'])) {
        $order = (string) $pay['order_id'];
        foreach (leadsAll() as $l) if (($l['sign']['pay']['order'] ?? '') === $order && ($l['sqpaid']['order'] ?? '') !== $order) { a365DepositPaid($l); a365Alert('Deposit paid', trim((string) ($l['name'] ?? '')) . ' · $' . (int) $l['sign']['deposit'], false, false, ($l['src'] ?? '') === 'a365web'); }
        $cust0 = (string) ($pay['customer_id'] ?? '');   /* a payment made straight in Square for a customer whose job still owes (2026-10-19) */
        if ($cust0 !== '') foreach (leadsAll() as $l0) if (($l0['sqcust'] ?? '') === $cust0 && ($l0['sign']['pay']['order'] ?? '') !== $order && ($j0 = jobForLead((string) $l0['id'])) && jobOwed($j0) > 0 && ($j0['sqlink']['order'] ?? '') !== $order) { $f0 = squareBalancePaid($j0, $l0); if ($f0) jobSquareFound((string) $j0['id'], $f0, 'by the Square webhook'); }
        foreach (jobsAll() as $j) if (!$j['off'] && ($j['sqlink']['order'] ?? '') === $order && ($j['pay']['s'] ?? '') !== 'paid') appendLine(DATA_DIR . '/jobs.log', ['id' => $j['id'], 'pay' => ['s' => 'paid', 'how' => 'square'], 'sqpaid' => ['order' => $order, 'payment' => (string) ($pay['id'] ?? ''), 'at' => time()], 'by' => 'Square', 'at' => time()]);
    }
    out(['ok' => true]);
}
const A365_ORIGINS = ['https://365aeration.com', 'https://www.365aeration.com', 'https://aeration365.com', 'https://www.aeration365.com'];   /* 365aeration.com is the main address since 2026-10-14 */   /* https only: the site redirects http there (certificate on 2026-10-14) */
/* the 365 site's relay (2026-10-14): a visitor's browser posting straight here from 365aeration.com was stopped by SiteGround's
   bot check on this server ("Failed to fetch", found with a real browser), so the site's own server (api/lead.php there) passes the
   form and the quote page on, server to server, with a key (sixfold-private/a365-relay-key.txt here, a365-private/relay.php there)
   and the visitor's address, which the per-address limits then count instead of the relay's. */
function relayIp(): ?string {
    static $ip = false; if ($ip !== false) return $ip;
    $k = trim((string) @file_get_contents(dirname(__DIR__, 2) . '/sixfold-private/a365-relay-key.txt'));
    $ip = null;
    $sent = (string) ($_SERVER['HTTP_X_SITE_KEY'] ?? '');
    if (strlen($k) >= 32 && hash_equals($k, $sent)) { $c = trim((string) ($_SERVER['HTTP_X_CLIENT_IP'] ?? '')); $ip = filter_var($c, FILTER_VALIDATE_IP) ? $c : 'relay'; }
    elseif ($sent !== '' && isset($_SERVER['HTTP_X_CLIENT_IP'])) { error_log('rounds: 365 relay key missing or wrong'); fail('The site could not be checked. Please call or text us.', 403); }   /* Fable review 2026-10-14: never share one visitor bucket silently */
    return $ip;
}
function visitorKey(): string { $r = relayIp(); return $r !== null ? 'relay-' . $r : clientKey(); }
/** the same cleaning as $clean (defined further down, after the session check) */
function a365Clean($v, int $max): string { $t = trim((string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', str_replace("\r\n", "\n", (string) $v))); return mb_substr($t, 0, $max, 'UTF-8'); }
function a365Norm(string $a): string {
    $w = array_values(array_filter(explode(' ', (string) preg_replace('/[^A-Z0-9 ]+/', ' ', strtoupper($a))), fn($x) => $x !== ''));
    $out = []; foreach ($w as $x) { if (in_array($x, ['UNIT', 'APT', 'STE', 'SUITE', '#'], true)) break; $out[] = SEARCH_SYN[$x] ?? $x; }
    return implode(' ', $out);
}
/** an address without its direction words (N, S, E, W...): the door lists write "11663 SETTLERS DR" where people say "11663 N Settlers" (2026-10-21) */
function a365NoDir(string $norm): string { $w = explode(' ', $norm); return implode(' ', array_values(array_filter($w, fn($x, $i) => $i === 0 || !in_array($x, SEARCH_DIRS, true), ARRAY_FILTER_USE_BOTH))); }
/** the one house on our lists at this street address (the city they gave breaks a tie); null when none or unsure */
function a365Match(string $street, string $city): ?array {
    $want = a365Norm($street); if (!preg_match('/^\d+ \S+/', $want)) return null;
    $hits = [];
    foreach (searchIndex() as $line) { $p = explode("\t", $line); if (count($p) >= 5 && a365Norm($p[4]) === $want) $hits[] = $p; }
    if (!$hits) { $wd = a365NoDir($want); foreach (searchIndex() as $line) { $p = explode("\t", $line); if (count($p) >= 5 && a365NoDir(a365Norm($p[4])) === $wd) $hits[] = $p; } }   /* with or without N/S/E/W (2026-10-21) */
    $listed = array_values(array_filter($hits, fn($p) => ($p[9] ?? '') !== 'L')); if ($listed) $hits = $listed;   /* the door-list house over a pulled-in copy of it */
    if (count($hits) > 1 && $city !== '') { $c = strtoupper(trim($city)); $hits = array_values(array_filter($hits, fn($p) => str_contains(strtoupper($p[1]), $c) || str_contains($c, strtoupper($p[1])))); }
    return count($hits) === 1 ? ['region' => $hits[0][0], 'door' => $hits[0][3], 'address' => $hits[0][4], 'town' => $hits[0][1]] : null;
}
/** an alert to everyone with the office role (their phones and computers that took alerts) */
/* new-lead alerts are off (2026-10-14, Matthew: "I dont think that we should alert jens phone every time theres a new lead, that could
   alert 20 times per day"): a new lead shows on the office home and in the Pipeline count. A customer booking online or saying yes
   to a quote still alerts. company.json a365.leadAlerts: true turns new-lead alerts back on. */
function leadAlertsOn(): bool { return !empty(company()['a365']['leadAlerts']); }
function a365Alert(string $title, string $text, bool $super = false, bool $newLead = false, bool $web = false): void {   /* $web (2026-10-22): about a 365-website lead, so Matthew's phones only */   /* $newLead (2026-10-20): not to an office account that runs a team, which does not see new leads until someone has called */   /* $super: Matthew's phones too (2026-10-16: a push whenever someone signs on through the quote generator) */
    global $basePeople, $acct, $sessionKey;
    try {
        $v = pushVapid(false); if (!$v) return;
        $subs = pushSubs(); $payload = json_encode(['title' => $title, 'body' => $text, 'url' => './', 'tag' => 'a365-' . time(), 'at' => time()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        foreach (acctRows($basePeople, $acct, $sessionKey) as $r) if (!$r['off'] && (($r['role'] === 'office' && !$web && !($newLead && acctFlag('runsteam', $r['id']))) || (($super || $web) && $r['role'] === 'super'))) foreach (($subs[$r['id']] ?? []) as $d) webpushSend($d['sub'], $payload, $v, 86400, ['urgency' => 'high']);
    } catch (Throwable $e) { error_log('rounds a365 alert: ' . $e->getMessage()); }
}
/* where a website visitor came from (2026-10-20, Matthew: "go ahead and do the website lead tracking"): the page notes, when they arrive, the
   page that sent them (the browser's referrer, address only), the utm tags and whether the link carried Facebook's or Google's ad-click mark.
   No cookies, nothing sent anywhere else. A QR code on our printed things wins; then an ad click; then the sending site; else typed in. */
const A365_HEAR = ['facebook' => 'Facebook or Instagram', 'google' => 'Google search', 'nextdoor' => 'Nextdoor', 'friend' => 'A friend or neighbour', 'sign' => 'A yard sign', 'card' => 'A business card or flyer', 'truck' => 'Our truck', 'other' => 'Something else'];
function a365Trk($t): array {
    if (!is_array($t)) return [];
    $o = [];
    $ref = a365Clean($t['ref'] ?? '', 300); if ($ref !== '' && preg_match('#^https?://#i', $ref)) { $p = parse_url($ref); $o['ref'] = strtolower((string) ($p['host'] ?? '')) . (string) ($p['path'] ?? ''); }
    foreach (['us' => 60, 'um' => 60, 'uc' => 100, 'land' => 200] as $k => $max) { $v = a365Clean($t[$k] ?? '', $max); if ($v !== '') $o[$k] = $v; }
    if (!empty($t['fb'])) $o['fb'] = 1; if (!empty($t['g'])) $o['g'] = 1;
    return $o;
}
function a365Came(array $t, string $qr): string {
    if ($qr !== '') return 'QR code on our ' . (['card' => 'business card', 'yard' => 'yard sign', 'truck' => 'truck', 'car' => 'car'][$qr] ?? $qr);
    $us = strtolower((string) ($t['us'] ?? '')); $host = (string) preg_replace('#/.*$#', '', (string) ($t['ref'] ?? ''));
    /* Facebook puts its click tag (fbclid) on EVERY link tapped in its apps, not only ads (2026-10-21: Alberto came from the Facebook app,
       and the log cannot say ad, post or page button), so only a link we tagged as paid is called an ad */
    if (preg_match('/^(facebook|fb|instagram|ig|meta)/', $us) && preg_match('/cpc|paid|ad/', strtolower((string) ($t['um'] ?? '')))) return 'Facebook or Instagram ad link';
    if (!empty($t['fb']) || preg_match('/^(facebook|fb|instagram|ig|meta)/', $us)) return 'Facebook or Instagram link (an ad, a post or the page\'s button)';
    if (!empty($t['g']) || ($us === 'google' && preg_match('/cpc|paid|ad/', strtolower((string) ($t['um'] ?? ''))))) return 'Google ad';
    if ($host !== '' && !preg_match('/(^|\.)365aeration\.com$/', $host)) {
        if (preg_match('/(^|\.)(facebook|fb|messenger)\.com$/', $host)) return 'Facebook (a post, page or message link)';
        if (preg_match('/(^|\.)instagram\.com$/', $host)) return 'Instagram (a post or profile link)';
        if (preg_match('/(^|\.)google\./', $host)) return 'Google search';
        if (preg_match('/(^|\.)(bing|duckduckgo|yahoo|ecosia)\./', $host)) return 'Another search engine (' . $host . ')';
        if (preg_match('/(^|\.)nextdoor\.com$/', $host)) return 'Nextdoor';
        if (preg_match('/(^|\.)linktr\.ee$/', $host)) return 'Linktree';
        return 'A link on ' . $host;
    }
    if ($us !== '') return 'A link tagged ' . $us;
    return 'Typed the address, a bookmark, or an app that hides the link';
}
if ($action === 'a365lead') {
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if (in_array($origin, A365_ORIGINS, true) || (PHP_SAPI === 'cli-server' && preg_match('#^http://127\.0\.0\.1(:\d+)?$#D', $origin))) {
        header('Access-Control-Allow-Origin: ' . $origin); header('Vary: Origin'); header('Access-Control-Allow-Methods: POST'); header('Access-Control-Allow-Headers: Content-Type');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
    if (!feature('walkdesk') || !company()['a365']) fail('Not here.', 404);
    if (!$isPost) fail('POST required', 405);
    if (trim((string) ($body['hp'] ?? '')) !== '') out(['ok' => true]);   /* a bot filled the hidden field: thank it, keep nothing */
    if ((int) ($body['t'] ?? 0) < 3000) fail('That was very quick. Please try again.');
    $wants = ['aeration' => 'Aeration', 'both' => 'Aeration and overseeding', 'question' => 'A question',
              /* the merged Sixfold 365 site's form adds Sixfold's services (2026-10-20, Matthew: one site at 365aeration.com) */
              'lawn' => 'Lawn care', 'landscaping' => 'Landscaping', 'clearing' => 'Land clearing', 'fire' => 'Fire mitigation', 'multiple' => 'More than one service',
              /* the form's two groups (2026-10-23, Matthew: aeration, overseeding and lawn keeping in one; landscaping, clearing and fire in another) */
              'lawnall' => 'Aeration, overseeding or lawn keeping', 'land' => 'Landscaping, land clearing or fire mitigation'];
    $want = (string) ($body['want'] ?? ''); if (!isset($wants[$want])) fail('Choose what you are looking for.');
    $name = a365Clean($body['name'] ?? '', 120); $phone = a365Clean($body['phone'] ?? '', 40); $email = a365Clean($body['email'] ?? '', 160);
    $street = a365Clean($body['street'] ?? '', 120); $city = a365Clean($body['city'] ?? '', 60); $zip = a365Clean($body['zip'] ?? '', 10);
    $contact = in_array($body['contact'] ?? '', ['call', 'text', 'email'], true) ? (string) $body['contact'] : ''; $msg = a365Clean($body['msg'] ?? '', 1500);
    if ($name === '') fail('Add your name.');
    if ($phone === '' && $email === '') fail('Add a phone number or an email so we can reply.');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('That email does not look right.');
    if ($phone !== '' && strlen((string) preg_replace('/\D/', '', $phone)) < 10) fail('That phone number looks too short.');
    /* the address is optional since 2026-10-20 (Matthew: "add a way to put in the address on the website lead form as well make it optional") */
    if ($contact === 'email' && $email === '') fail('Add your email, or pick another way for us to reach you.');
    if (in_array($contact, ['call', 'text'], true) && $phone === '') fail('Add your phone number, or pick another way for us to reach you.');
    $hear = isset(A365_HEAR[(string) ($body['hear'] ?? '')]) ? (string) $body['hear'] : ''; $hearNote = $hear !== '' ? a365Clean($body['hearNote'] ?? '', 120) : '';
    if (!throttleTake(rateFile('a365lead|' . visitorKey()), 5, 86400) || !throttleTake(rateFile('a365lead|site'), 300, 86400)) fail('We have had a lot of requests from here today. Please call or text us instead.', 429);
    $lines = []; if ($msg !== '') $lines[] = $msg;   /* the way to reach them is its own field since 2026-10-20 (pref), shown on the card */
    $qrFrom = in_array($body['from'] ?? '', ['card', 'yard', 'truck', 'car'], true) ? (string) $body['from'] : '';   /* which printed QR code brought them (2026-10-19) */
    $trk = a365Trk($body['trk'] ?? null); $came = a365Came($trk, $qrFrom);
    $extra = array_filter(['pref' => $contact, 'hear' => $hear, 'hearNote' => $hearNote, 'came' => $came, 'trk' => $trk ?: null], fn($v) => $v !== '' && $v !== null);
    $said = array_filter([$contact !== '' ? 'prefers ' . ['call' => 'a call', 'text' => 'a text', 'email' => 'email'][$contact] : '', $hear !== '' ? 'heard about us: ' . A365_HEAR[$hear] . ($hearNote !== '' ? ' (' . $hearNote . ')' : '') : '', 'came from: ' . $came]);
    $row = ['id' => 'w' . date('YmdHis') . bin2hex(random_bytes(3)), 'src' => 'a365web', 'at' => time(), 'need' => $wants[$want], 'name' => $name, 'phone' => $phone, 'email' => $email,
            'town' => trim($street . ($city !== '' ? ', ' . $city : '') . ($zip !== '' ? ' ' . $zip : '')), 'msg' => implode("\n", $lines), 'by' => ''] + ($qrFrom !== '' ? ['qr' => $qrFrom] : []) + $extra;   /* kept with the lead; not shown in the Pipeline yet */
    /* someone already in the Pipeline (2026-10-20, Matthew: "double check when a website lead comes in that it hasnt been made via messenger or meta
       ad lead"): an open lead with the same phone, email or full name keeps them, Facebook and Messenger ones first; the form goes on it as a note,
       so the person stays where they are (Jen's Facebook flow) and is not doubled. A lost or finished lead does not count: that is a new enquiry. */
    $wd = substr((string) preg_replace('/\D/', '', $phone), -10); $we = strtolower($email); $wn = nameKey($name); $hits = [];
    foreach (leadsAll() as $x) {
        if (!in_array((string) ($x['status'] ?? 'new'), ['new', 'contacted', 'walk', 'quoted', 'hold', 'unreached'], true)) continue;   /* + Couldn't reach: they come back (2026-10-21) */
        $xd = substr((string) preg_replace('/\D/', '', (string) ($x['phone'] ?? '')), -10);
        if ((strlen($wd) === 10 && $xd === $wd) || ($we !== '' && strtolower((string) ($x['email'] ?? '')) === $we) || (substr_count($wn, ' ') >= 1 && nameKey((string) ($x['name'] ?? '')) === $wn)) $hits[] = $x;
    }
    usort($hits, fn($a, $b) => (int) !in_array($a['src'] ?? '', ['meta', 'messenger'], true) <=> (int) !in_array($b['src'] ?? '', ['meta', 'messenger'], true));
    if ($hits) {
        $x = $hits[0]; $now = time();
        appendLine(leadsDir() . '/leadst.log', ['id' => $x['id'], 'note' => 'Also sent the 365 website form: ' . $wants[$want] . ($street !== '' ? ', ' . $street . ($city !== '' ? ', ' . $city : '') : '') . ($lines ? '. ' . implode(' ', $lines) : '') . ($said ? '. ' . ucfirst(implode('; ', $said)) : '') . ' (as ' . ($name ?: 'no name') . ($phone !== '' ? ', ' . $phone : '') . ($email !== '' ? ', ' . $email : '') . ')', 'by' => 'website', 'at' => $now]);
        $fill = []; if (trim((string) ($x['phone'] ?? '')) === '' && $phone !== '') $fill['phone'] = $phone; if (trim((string) ($x['email'] ?? '')) === '' && $email !== '') $fill['email'] = $email;
        if ($fill) appendLine(leadsDir() . '/leadst.log', ['id' => $x['id'], 'contact' => $fill, 'by' => 'website', 'at' => $now]);
        if (empty($x['house']) && $street !== '') { $h = a365Match($street, $city); if ($h) appendLine(leadsDir() . '/leadst.log', ['id' => $x['id'], 'house' => $h, 'by' => 'website', 'at' => $now]); }
        if (($x['status'] ?? '') === 'unreached') leadRevive((string) $x['id'], 'sent the 365 website form', 'website');
        if (leadAlertsOn()) a365Alert('Website form from someone already here', ($x['name'] ?? $name) . ' · ' . (['meta' => 'Facebook', 'messenger' => 'Messenger', 'a365web' => '365 website'][$x['src'] ?? ''] ?? ($x['src'] ?? '')), true, true, ($x['src'] ?? '') === 'a365web');
        a365WebMail($row + ['want' => $wants[$want], 'said' => $said], 'already in the app as ' . (trim((string) ($x['name'] ?? '')) ?: 'a lead') . ' (' . (['meta' => 'Facebook ad', 'messenger' => 'Messenger', 'a365web' => 'website'][$x['src'] ?? ''] ?? ($x['src'] ?? '')) . '); the form went on that lead as a note');
        out(['ok' => true]);
    }
    if (!appendLine(leadsDir() . '/leads.log', $row)) fail('Something went wrong saving that. Please call or text us.', 500);
    if ($street !== '') { $h = a365Match($street, $city); if ($h) appendLine(leadsDir() . '/leadst.log', ['id' => $row['id'], 'house' => $h, 'by' => 'website', 'at' => time()]); }
    if (leadAlertsOn()) a365Alert('New quote request', $name . ($city !== '' ? ' · ' . $city : '') . ' · ' . $wants[$want], true, true, true);   /* Matthew's phones only: website leads are his (2026-10-23: the office was still getting this push) */
    a365WebMail($row + ['want' => $wants[$want], 'said' => $said], '');
    out(['ok' => true]);
}

/* every website form, also by email to Contact@SixfoldColorado.com (2026-10-23, Matthew: "we want the form to go to contact@sixfoldcolorado ...
   Since i am handling leads from the website it can go to me on my sixfold email. if it goes to the other then jen sees it"; only he has that
   mailbox). The form only queues it (weblead-mail-queue.jsonl), so the visitor never waits on Gmail; the 5-minute alerts job (pushcron) sends
   the queue through the same Gmail login as the morning email (api/config.php + smtp.php, server only) and logs each try to weblead-mail.log
   (the stage, never the password). A failed send stays queued and is tried again, for about a day. */
function a365WebMail(array $r, string $already): void {
    $line = fn($k, $v) => trim((string) $v) !== '' ? $k . ': ' . $v : '';
    $body = implode("\n", array_filter([
        'A new form on the website.',
        $line('Name', $r['name'] ?? ''), $line('Phone', $r['phone'] ?? ''), $line('Email', $r['email'] ?? ''), $line('Looking for', $r['want'] ?? ''),
        $line('Address', $r['town'] ?? ''), $line('Message', $r['msg'] ?? ''), ($r['said'] ?? []) ? 'Also: ' . implode('; ', (array) $r['said']) : '',
        $already !== '' ? 'Note: ' . $already . '.' : 'It is in the app as a website lead (you only).',
        'Open the app: https://traverseplatforms.com/summit-de59ae83/']));
    appendLine(DATA_DIR . '/weblead-mail-queue.jsonl', ['at' => time(), 'subject' => 'Website lead: ' . ($r['name'] ?? '') . ' · ' . ($r['want'] ?? ''), 'body' => $body, 'tries' => 0]);
}
function a365WebMailFlush(): int {
    $q = DATA_DIR . '/weblead-mail-queue.jsonl'; if (!is_file($q) || !filesize($q)) return 0;
    $cf = __DIR__ . '/config.php'; if (!is_readable($cf) || !is_readable(__DIR__ . '/smtp.php')) return 0;
    $lk = @fopen($q . '.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX | LOCK_NB)) return 0;
    $sent = 0; $keep = [];
    try {
        $cfg = require $cf; require_once __DIR__ . '/smtp.php';
        $rows = jsonLines($q); if (!$rows) { flock($lk, LOCK_UN); fclose($lk); return 0; }   /* jsonLines, not readLines: these rows have no id (fixed 2026-10-23) */
        foreach ($rows as $m) {
            $res = smtp_send((array) ($cfg['smtp'] ?? []), (string) ($cfg['to'] ?? ''), (string) ($m['subject'] ?? 'Website lead'), (string) ($m['body'] ?? ''), ['X-Mailer: sixfold-app']);
            @file_put_contents(DATA_DIR . '/weblead-mail.log', json_encode(['at' => time(), 'ok' => !empty($res['ok']), 'stage' => $res['stage'] ?? null, 'queued' => (int) ($m['at'] ?? 0)]) . "\n", FILE_APPEND | LOCK_EX);
            if (!empty($res['ok'])) { $sent++; continue; }
            $m['tries'] = (int) ($m['tries'] ?? 0) + 1; if ($m['tries'] < 288) $keep[] = $m;   /* every 5 minutes for about a day */
        }
        writeTextAtomic($q, $keep ? implode("\n", array_map(fn($m) => json_encode($m, JSON_UNESCAPED_UNICODE), $keep)) . "\n" : '');
    } catch (Throwable $e) { error_log('rounds weblead mail: ' . $e->getMessage()); }
    flock($lk, LOCK_UN); fclose($lk);
    return $sent;
}
/* ---- the customer's quote page (2026-10-14): 365aeration.com/q/?q=<lead>-<key> ----
 * Jen's quote text and email carry this link. The page shows their first name, the street, what is included and the price, and
 * the day Jen offered (Matthew: "have jen get dates before hand so it can be added into the quote so when they want the service
 * they can just click the one button"). One button books it: the job goes straight onto the jobs board for that crew, the lead is
 * Won, and the crew and the office get alerts. With no day offered, or when the day has gone, the button says yes and Jen calls
 * to set one. Never the lawn size, the seed, the photo or anything else we measured, and never Sixfold. The key is a keyed hash
 * of the lead, so the same link always shows that lead's latest quote; a yes counts only for the price it was given to. */
function a365QuoteKey(string $id): string { global $sessionKey; return substr(hash_hmac('sha256', 'a365quote|' . $id, $sessionKey), 0, 16); }
function a365QuoteLink(string $id): string { return 'https://365aeration.com/q/?q=' . $id . '-' . a365QuoteKey($id); }
function a365Arrive(string $slot): string { $w = ['s1' => 'between 9:30 and 10:00', 's2' => 'between 10:00 and 12:00', 's3' => 'between 12:00 and 2:00', 's4' => 'around 3:00'][$slot] ?? ''; if ($w === '' && ($sl = jobSlot($slot))) $w = 'at ' . $sl[1]; return $w; }
function a365Day(string $date): string { return (new DateTime($date . ' 12:00', new DateTimeZone(appTz())))->format('l, F j'); }
/** the live job for a lead, if any */
function jobForLead(string $lead): ?array { foreach (jobsAll() as $j) if ($j['lead'] === $lead && !$j['off']) return $j; return null; }
/** day offers held on the board: a quoted lead's offered day, until it is booked, passes, or the lead is won or lost */
/* a day offered with a quote (no deposit) is held 72 hours from when it was offered, then released (Matthew 2026-10-15); a day held after
   the deposit was taken (the one-page form) stays held until the day, because that customer has paid */
const OFFER_HOLD_SECS = 72 * 3600;
function offerUntil(array $l): ?int {
    $o = $l['quote']['offer'] ?? null; if (!is_array($o) || !empty($l['sign'])) return null;
    return (int) ($o['at'] ?? ($l['quote']['at'] ?? 0)) + OFFER_HOLD_SECS;
}
function jobHolds(?array $leads = null): array {
    /* the plain call once per request (review 2026-10-22): slotFree() asks for it per job, day and slot when the weather moves a day */
    static $c = null; $sig = $leads === null ? fileSig(leadsDir() . '/leads.log') . '|' . fileSig(leadsDir() . '/leadst.log') . '|' . fileSig(DATA_DIR . '/jobs.log') . '|' . (int) webHide() : null;
    if ($sig !== null && $c !== null && $c[0] === $sig) return $c[1];
    $today = (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d'); $out = [];
    $booked = []; foreach (jobsAll() as $j) if (!$j['off']) $booked[$j['lead']] = true;
    $pool = $leads ?? leadsAll(); $web = webHide() ? webLeadIds() : [];
    if ($web) foreach (leadsAllRaw() as $wid => $wl) if (isset($web[$wid])) $pool[$wid] = $wl;   /* a 365-website lead's held time stays held, unnamed (2026-10-22) */
    foreach ($pool as $l) {
        $o = $l['quote']['offer'] ?? null;
        /* held whatever the stage (2026-10-18, Fable review): the ClickUp pull moves a quoted lead to contacted / on hold / won every five
           minutes, and the day it still names was freed for anyone. Only lost, booked, released (72 h, taken off) or passed ends a hold. */
        if (!is_array($o) || $l['status'] === 'lost' || isset($booked[$l['id']]) || ($o['date'] ?? '') < $today) continue;
        $until = offerUntil($l); if ($until !== null && $until < time()) continue;   /* released after 72 hours */
        $out[] = ['lead' => $l['id'], 'name' => isset($web[$l['id']]) ? 'Held' : (trim((string) ($l['name'] ?? '')) ?: 'A customer'), 'crew' => (string) $o['crew'], 'date' => (string) $o['date'], 'slot' => (string) $o['slot'], 'until' => $until, 'paid' => !empty($l['sign'])];
    }
    if ($sig !== null) $c = [$sig, $out];
    return $out;
}
/** is this crew / day / slot free for this lead: no job there, and no other lead's offer holding it */
function slotFree(string $crew, string $date, string $slot, string $lead, string $exceptJob = ''): ?string {
    if ($bk = blockAt($crew, $date, $slot)) return strtok($crew, ' ') . ' is blocked off ' . blockPartText($bk) . ($bk['note'] !== '' ? ' (' . $bk['note'] . ')' : '') . '.';   /* 2026-10-21 */
    foreach (jobsAll() as $j) if (!$j['off'] && $j['id'] !== $exceptJob && $j['crew'] === $crew && $j['date'] === $date && $j['slot'] === $slot) return $crew . ' already has a job then: ' . $j['title'] . '.';
    foreach (jobHolds() as $h) if ($h['lead'] !== $lead && $h['crew'] === $crew && $h['date'] === $date && $h['slot'] === $slot) return 'That time is held for ' . $h['name'] . '\'s quote.';
    return null;
}
/** an offer the customer can still take: a day not gone, a crew still doing jobs, the slot still free */
function offerLive(array $l): ?array {
    $o = $l['quote']['offer'] ?? null; if (!is_array($o)) return null;
    if (($o['date'] ?? '') < (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d') || !in_array($o['crew'] ?? '', jobCrewList(), true)) return null;
    $until = offerUntil($l); if ($until !== null && $until < time()) return null;   /* the 72-hour hold has run out: the quote page asks them to say yes instead */
    return slotFree((string) $o['crew'], (string) $o['date'], (string) $o['slot'], (string) $l['id']) === null ? $o : null;
}
if ($action === 'a365quote' || $action === 'a365accept') {
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if (in_array($origin, A365_ORIGINS, true) || (PHP_SAPI === 'cli-server' && preg_match('#^http://127\.0\.0\.1(:\d+)?$#D', $origin))) {
        header('Access-Control-Allow-Origin: ' . $origin); header('Vary: Origin'); header('Access-Control-Allow-Methods: GET, POST'); header('Access-Control-Allow-Headers: Content-Type');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
    if (!feature('walkdesk') || !company()['a365']) fail('Not here.', 404);
    header('Cache-Control: no-store'); header('X-Robots-Tag: noindex');
    if (!isset($TEAM)) $TEAM = teamInfo($basePeople, $acct, $sessionKey);   /* the crew list (walkerList, pushName) is built after the session check; this page comes before it */
    if (!throttleTake(rateFile('a365quote|' . visitorKey()), 120, 3600)) fail('Too many tries from here. Please call or text us.', 429);
    $q = (string) ($_GET['q'] ?? ($body['q'] ?? ''));
    if (!preg_match('/^([wm]\d{14}[0-9a-f]{6})-([0-9a-f]{16})$/D', $q, $qm) || !hash_equals(a365QuoteKey($qm[1]), $qm[2])) fail('This link does not look right. Please call or text us and we will send it again.', 404);
    $all = leadsAll(); $l = $all[$qm[1]] ?? null; $Q = $l['quote'] ?? null;
    if (!$l || !$Q || $l['status'] === 'lost') fail('This quote is no longer open. Please call or text us for a fresh one.', 410);
    $phone = a365Phone($l);
    $today = (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d');
    $job = jobForLead($l['id']); if ($job && ($job['done'] || $job['date'] < $today)) $job = null;
    $bookedOut = fn($j) => ['day' => a365Day($j['date']), 'arrive' => a365Arrive((string) $j['slot'])];
    if ($action === 'a365quote') {
        $h = $l['house'] ?? null;
        $street = $h ? streetCaseServer((string) $h['address']) . ', ' . streetCaseServer(houseTown($h)) : trim((string) ($l['town'] ?? ''));
        $first = ucfirst(strtolower((string) (preg_split('/\s+/', trim((string) ($l['name'] ?? '')))[0] ?? '')));
        $acc = $l['accept'] ?? null; if ($acc && (int) ($acc['price'] ?? 0) !== (int) $Q['price']) $acc = null;   /* a yes to an older price */
        $off = $job ? null : offerLive($l);
        out(['ok' => true, 'first' => $first, 'street' => $street, 'pkg' => $Q['pkg'], 'price' => (int) $Q['price'], 'date' => date('F j, Y', (int) $Q['at']),
             'offer' => $off ? ['day' => a365Day($off['date']), 'arrive' => a365Arrive((string) $off['slot'])] : null,
             'accepted' => $acc && !$job ? true : false, 'booked' => $job ? $bookedOut($job) : null, 'phone' => $phone]);
    }
    if (!$isPost) fail('POST required', 405);
    if (!throttleTake(rateFile('a365accept|' . visitorKey()), 10, 86400)) fail('We have had a lot of answers from here today. Please call or text us.', 429);
    if ($job) out(['ok' => true, 'booked' => $bookedOut($job), 'phone' => $phone]);   /* already booked: say so again */
    $note = a365Clean($body['note'] ?? '', 300);
    $name = trim((string) ($l['name'] ?? '')) ?: 'A customer';
    $lk = @fopen(DATA_DIR . '/jobs.log.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX)) fail('Something went wrong. Please call or text us.', 500);
    /* Fable review 2026-10-14: read again inside the lock, so a second tap after the first booked says "booked", not "the day was gone" */
    $l = leadsAll()[$l['id']]; $Q = $l['quote'];
    $job = jobForLead($l['id']); if ($job && !$job['done'] && $job['date'] >= $today) { flock($lk, LOCK_UN); out(['ok' => true, 'booked' => $bookedOut($job), 'phone' => $phone]); }
    $hadOffer = is_array($Q['offer'] ?? null); $off = offerLive($l);
    $acc = ['price' => (int) $Q['price'], 'note' => $note];
    if ($off) {   /* the day Jen offered: book it */
        $h = $l['house'] ?? null;
        $addr = $h ? streetCaseServer((string) $h['address']) . ', ' . streetCaseServer(houseTown($h)) : (string) ($l['town'] ?? '');
        $jid = 'j' . bin2hex(random_bytes(6));
        $row = ['id' => $jid, 'lead' => $l['id'], 'title' => $name, 'crew' => (string) $off['crew'], 'date' => (string) $off['date'], 'slot' => (string) $off['slot'], 'price' => (int) $Q['price'],
                'pkg' => (string) $Q['pkg'], 'scope' => 'all', 'seedLb' => $Q['seedLb'] ?? null, 'fertLb' => $Q['fertLb'] ?? null, 'pay' => ['s' => 'unpaid'], 'card' => false, 'note' => $note, 'addr' => $addr ?: 'Ask the office',
                'by' => 'website', 'at' => time()];
        if (!appendLine(DATA_DIR . '/jobs.log', $row)) fail('Something went wrong saving that. Please call or text us.', 500);
        $acc['booked'] = $jid;
        appendLine(leadsDir() . '/leadst.log', ['id' => $l['id'], 'accept' => $acc, 'status' => 'won', 'note' => mb_substr('Booked online: ' . a365Day($off['date']) . ', arriving ' . a365Arrive((string) $off['slot']) . ', $' . $Q['price'] . '.' . ($note !== '' ? ' "' . $note . '"' : ''), 0, 500), 'by' => 'website', 'at' => time()]);
        flock($lk, LOCK_UN);
        $sl = jobSlot((string) $off['slot']);
        pushName((string) $off['crew'], 'Job booked: ' . deskWhen((string) $off['date'], '') . ($sl ? ', ' . $sl[1] : ''), $name . ' · ' . $addr . ' · $' . $Q['price'] . ' · booked online', './?job=' . $jid, 'job-' . $jid);
        a365Alert('Booked online', $name . ' · ' . deskWhen((string) $off['date'], '') . ($sl ? ', ' . $sl[1] : '') . ' with ' . $off['crew'] . ' · $' . $Q['price'], true, false, ($l['src'] ?? '') === 'a365web');
        out(['ok' => true, 'booked' => ['day' => a365Day($off['date']), 'arrive' => a365Arrive((string) $off['slot'])], 'phone' => $phone]);
    }
    flock($lk, LOCK_UN);
    if ($hadOffer) $acc['gone'] = 1;
    if (!appendLine(leadsDir() . '/leadst.log', ['id' => $l['id'], 'accept' => $acc, 'note' => mb_substr('Said yes to the $' . $Q['price'] . ' quote on the website' . ($hadOffer ? ', but the day offered was gone. Call them to set a day.' : '. Call them to set a day.') . ($note !== '' ? ' "' . $note . '"' : ''), 0, 500), 'by' => 'website', 'at' => time()])) fail('Something went wrong saving that. Please call or text us.', 500);
    a365Alert('Quote accepted: set a day', $name . ' · $' . $Q['price'] . ($hadOffer ? ' · the day offered was gone' : ''), true, false, ($l['src'] ?? '') === 'a365web');
    out(['ok' => true, 'gone' => $hadOffer, 'phone' => $phone]);
}

/* ---- the one-page agreement (2026-10-14; Matthew: "I draft it, Brandon reviews") ----
 * The customer opens 365aeration.com/sign/?s=<lead>-<key> (through the site's relay), reads what Jen agreed on the phone, types their
 * name and signs; that books the job on the jobs board with the deposit recorded, marks the lead Won, and alerts the crew and the
 * office. The wording is here, in one place, versioned: a signature keeps the version and a hash of exactly what was shown.
 * DRAFT wording until Brandon (or the attorney) approves it: facts from the call and the business only; no refund or cancellation
 * terms, because none are set. Never the lawn size, the seed or anything measured; never Sixfold. */
const A365_SIGN_VERSION = 'v4-draft-2026-10-16';   /* v4: their phone and email on it (Matthew 2026-10-16); v3: "not confirmed until the deposit is paid" (Matthew 2026-10-15) */   /* Matthew's answers to the seven questions; Brandon still to review */
/* the number a customer is told to call or text (2026-10-20, Matthew: "for josephs form in particular can u change the number to mine"):
   the lead's own form phone (fphone) when one is set, else 365's. And a house's town without an internal label: a property pulled in by
   itself carries one in brackets ("Brighton (Barnes)"), which reached Joseph's form. */
function a365Phone(array $l = []): string { $f = trim((string) ($l['fphone'] ?? '')); return $f !== '' ? $f : (string) (company()['a365']['phone'] ?? ''); }
function houseTown(array $h): string { return trim((string) preg_replace('/\s*\([^)]*\)\s*$/', '', (string) ($h['town'] ?? ''))); }
function a365SignKey(string $id, string $k): string { global $sessionKey; return substr(hash_hmac('sha256', 'a365sign|' . $id . '|' . $k, $sessionKey), 0, 16); }
function a365SignLink(string $id, string $k): string { return 'https://365aeration.com/sign/?s=' . $id . '-' . a365SignKey($id, $k); }
/** extra work on a quote (2026-10-21, Matthew: "an extra line where jen can type in what she wants ... a price ... automatically added into the price
    (the price should not be shown)"): up to 6 lines of {t: words, p: dollars or 0}; empty words are dropped */
function a365Extras($in): array { $out = []; foreach (is_array($in) ? $in : [] as $x) { if (!is_array($x)) continue; $t = a365Clean((string) ($x['t'] ?? ''), 120); if ($t === '') continue; $p = (int) round((float) ($x['p'] ?? 0)); $out[] = ['t' => $t, 'p' => max(0, min(100000, $p))]; if (count($out) >= 6) break; } return $out; }
/** the extra work in words, for the crew's job note: "Also: clear the front beds; haul the branches." (no prices) */
function a365ExtrasNote(array $Q): string { $t = array_map(fn($x) => (string) $x['t'], a365Extras($Q['extras'] ?? [])); return $t ? 'Also: ' . implode('; ', $t) . '.' : ''; }
function a365Agreement(array $l): array {
    $Q = $l['quote']; $S2 = $l['sign']; $o = $Q['offer'] ?? null;
    $h = $l['house'] ?? null;
    $addr = $h ? streetCaseServer((string) $h['address']) . ', ' . streetCaseServer(houseTown($h)) : trim((string) ($l['town'] ?? ''));
    $inc = $Q['pkg'] === 'aerate' ? ['Core aeration'] : ['Core aeration', 'Overseeding', 'Fertilizer'];
    foreach (a365Extras($Q['extras'] ?? []) as $x) $inc[] = $x['t'];   /* the extra work, in her words (2026-10-21); its price is in the Price */
    $how = ['square' => 'Square', 'link' => 'Square', 'card' => 'card', 'cash' => 'cash', 'zelle' => 'Zelle', 'venmo' => 'Venmo', 'check' => 'check', 'other' => 'other'][$S2['how']] ?? $S2['how'];
    $due = ($S2['how'] ?? '') === 'link' && !a365DepositPaid($l, false);
    $day = $o ? a365Day((string) $o['date']) . ', arriving ' . a365Arrive((string) $o['slot']) : 'to be set';
    $facts = [['Customer', trim((string) ($l['name'] ?? ''))]];
    /* their phone and email when we have them (2026-10-16, Matthew: "all agreements going forward should include the person phone number and email") */
    $pd = substr((string) preg_replace('/\D/', '', (string) ($l['phone'] ?? '')), -10);
    if (strlen($pd) === 10) $facts[] = ['Phone', '(' . substr($pd, 0, 3) . ') ' . substr($pd, 3, 3) . '-' . substr($pd, 6)];
    $em = trim((string) ($l['email'] ?? ''));
    if ($em !== '' && filter_var($em, FILTER_VALIDATE_EMAIL)) $facts[] = ['Email', $em];
    $facts = array_merge($facts, [['Address', $addr], ['Service', implode(', ', $inc)], ['Day', $day],
              ['Price', '$' . number_format((int) $Q['price'])], $due ? ['Deposit (non-refundable), to pay now', '$' . number_format((int) $S2['deposit'])] : ['Deposit paid (non-refundable)', '$' . number_format((int) $S2['deposit']) . ' (' . $how . ')'],
              ['Balance due when the work is done', '$' . number_format((int) $Q['price'] - (int) $S2['deposit'])]]);
    if (($S2['how'] ?? '') === 'link' && !empty($l['savecard']['yes'])) $facts[] = ['Card on file', a365SaveText((int) $Q['price'] - (int) $S2['deposit'])];   /* their choice when they paid (2026-10-15) */
    $ph = a365Phone($l);
    $terms = ['We will do the work listed above at this address on the day shown, arriving in the time shown.',
              'Please let us know if there are sprinklers, shallow pipes or invisible dog fences, so they can be marked before we start.',
              'On the day, please leave gates unlocked and keep pets inside.',
              'If the weather or the ground (frozen, waterlogged or very dry) stops us, we will contact you to move the day.',
              'To reschedule or cancel, call or text ' . $ph . ' at least 24 hours before your day.',
              'The appointment is not confirmed until the deposit is paid.',   /* Matthew 2026-10-15 */
              'The deposit is non-refundable.'];
    $consents = ['I have read this agreement and I agree to its terms.', 'I agree to sign it electronically by typing my name.'];
    $consent = implode(' ', $consents);
    $text = implode("\n", array_map(fn($x) => $x[0] . ': ' . $x[1], $facts)) . "\n" . implode("\n", $terms) . "\n" . $consent;
    return ['facts' => $facts, 'terms' => $terms, 'consent' => $consent, 'consents' => $consents, 'hash' => hash('sha256', A365_SIGN_VERSION . "\n" . $text)];
}
/* ---- the signed agreement by email (2026-10-15, Matthew: "it should also get sent to their email") ----
 * From 365's own Google Workspace mailbox (365aeration.com's mail is Google; SPF and DKIM are set), through Gmail with an app
 * password kept in sixfold-private/a365-mail.json {"user", "pass", "from_name", "bcc"}; never shown, never in git. No file = no email,
 * and signing still works. The office inbox gets a hidden copy (bcc). Sending is the same as the Traverse demo emails (demo/_lib.php). */
function a365MailCfg(): ?array {
    $j = json_decode((string) @file_get_contents(dirname(__DIR__, 2) . '/sixfold-private/a365-mail.json'), true);
    if (!is_array($j) || empty($j['user']) || empty($j['pass'])) return null;
    $j['pass'] = (string) preg_replace('/\s+/', '', (string) $j['pass']); return $j;
}
function a365MimeH(string $s): string { return preg_match('/[\x80-\xFF]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s; }
/** one message through Gmail as 365's mailbox, text and HTML; never throws. [ok, stage, error] */
function a365Mail(string $to, string $subject, string $text, string $html): array {
    $c = a365MailCfg(); $fail = fn($st, $e) => ['ok' => false, 'stage' => $st, 'error' => $e];
    if (!$c) return $fail('config', 'no 365 mailbox set up yet (sixfold-private/a365-mail.json)');
    $fp = @stream_socket_client('tcp://smtp.gmail.com:587', $errno, $errstr, 20); if (!$fp) return $fail('connect', trim($errno . ' ' . $errstr));
    stream_set_timeout($fp, 20);
    $read = function () use ($fp): array { $lines = []; while (true) { $l = @fgets($fp, 2048); if ($l === false) return [0, 'connection closed']; $lines[] = rtrim($l, "\r\n"); if (strlen($l) < 4 || $l[3] !== '-') break; } $last = (string) end($lines); return [(int) substr($last, 0, 3), implode(' | ', $lines)]; };
    $w = function (string $cmd) use ($fp) { @fwrite($fp, $cmd . "\r\n"); };
    $quit = function () use ($fp) { @fwrite($fp, "QUIT\r\n"); @fclose($fp); };
    [$code, $rep] = $read(); if ($code !== 220) { $quit(); return $fail('greeting', $rep); }
    $w('EHLO 365aeration.com'); [$code, $rep] = $read(); if ($code !== 250) { $quit(); return $fail('ehlo', $rep); }
    $w('STARTTLS'); [$code, $rep] = $read(); if ($code !== 220) { $quit(); return $fail('starttls', $rep); }
    $cm = STREAM_CRYPTO_METHOD_TLS_CLIENT; if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) $cm |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT; if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) $cm |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
    if (@stream_socket_enable_crypto($fp, true, $cm) !== true) { $quit(); return $fail('starttls', 'TLS negotiation failed'); }
    $w('EHLO 365aeration.com'); [$code, $rep] = $read(); if ($code !== 250) { $quit(); return $fail('ehlo-tls', $rep); }
    $w('AUTH LOGIN'); [$code, $rep] = $read(); if ($code !== 334) { $quit(); return $fail('auth', $rep); }
    $w(base64_encode((string) $c['user'])); [$code, $rep] = $read(); if ($code !== 334) { $quit(); return $fail('auth', $rep); }
    $w(base64_encode((string) $c['pass'])); [$code, $rep] = $read(); if ($code !== 235) { $quit(); return $fail('auth', $rep); }
    $w('MAIL FROM:<' . $c['user'] . '>'); [$code, $rep] = $read(); if ($code !== 250) { $quit(); return $fail('from', $rep); }
    $w('RCPT TO:<' . $to . '>'); [$code, $rep] = $read(); if ($code !== 250 && $code !== 251) { $quit(); return $fail('to', $rep); }
    $bcc = (string) ($c['bcc'] ?? ''); if ($bcc !== '' && filter_var($bcc, FILTER_VALIDATE_EMAIL) && strcasecmp($bcc, $to) !== 0) { $w('RCPT TO:<' . $bcc . '>'); $read(); }
    $w('DATA'); [$code, $rep] = $read(); if ($code !== 354) { $quit(); return $fail('data', $rep); }
    $eol = "\r\n"; $bd = 'a3' . bin2hex(random_bytes(8));
    $h = ['Date: ' . date('r'), 'From: ' . a365MimeH((string) ($c['from_name'] ?? (company()['a365']['name'] ?? '365 Aeration & Seeding'))) . ' <' . $c['user'] . '>', 'To: ' . $to, 'Subject: ' . a365MimeH($subject),
          'Message-ID: <' . bin2hex(random_bytes(12)) . '@365aeration.com>', 'MIME-Version: 1.0', 'Content-Type: multipart/alternative; boundary="' . $bd . '"'];
    $payload = implode($eol, $h) . $eol . $eol
        . '--' . $bd . $eol . 'Content-Type: text/plain; charset=UTF-8' . $eol . 'Content-Transfer-Encoding: base64' . $eol . $eol . chunk_split(base64_encode($text), 76, $eol)
        . '--' . $bd . $eol . 'Content-Type: text/html; charset=UTF-8' . $eol . 'Content-Transfer-Encoding: base64' . $eol . $eol . chunk_split(base64_encode($html), 76, $eol)
        . '--' . $bd . '--' . $eol;
    $payload = preg_replace('/^\./m', '..', $payload);
    @fwrite($fp, $payload . $eol . '.' . $eol); [$code, $rep] = $read(); $quit();
    return $code === 250 ? ['ok' => true, 'stage' => 'sent', 'error' => ''] : $fail('data', $rep);
}
/** the signed agreement to the customer: what they saw, who signed and when, the link to view or print it; a note on the lead either way */
function a365SendSigned(array $l, array $sg, string $by): array {
    $to = trim((string) ($l['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) return ['ok' => false, 'stage' => 'noemail', 'error' => 'No email on the lead.'];
    $co = company()['a365']; $name = (string) ($co['name'] ?? '365 Aeration & Seeding'); $ph = a365Phone($l);
    $first = ucfirst(strtolower((string) (preg_split('/\s+/', trim((string) ($l['name'] ?? '')))[0] ?? '')));
    $when = (new DateTime('@' . (int) $sg['at']))->setTimezone(new DateTimeZone(appTz()))->format('F j, Y \a\t g:i a');
    $link = a365SignLink((string) $l['id'], (string) $l['sign']['key']);
    $facts = (array) ($sg['facts'] ?? []); $terms = (array) ($sg['terms'] ?? []);
    $e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
    $text = 'Hi' . ($first !== '' ? ' ' . $first : '') . ",\n\nThanks for booking with " . $name . ". Here is a copy of the agreement you signed.\n\n"
          . implode("\n", array_map(fn($f) => $f[0] . ': ' . $f[1], $facts)) . "\n\n" . implode("\n", array_map(fn($t, $i) => ($i + 1) . '. ' . $t, $terms, array_keys($terms)))
          . "\n\nSigned electronically by " . $sg['name'] . ' on ' . $when . ".\n\nView or print it any time: " . $link . "\n\nQuestions or changes: call or text " . $ph . ".\n\n" . $name . "\n";
    $rows = implode('', array_map(fn($f) => '<tr><td style="padding:6px 12px 6px 0;color:#5a6858;vertical-align:top">' . $e($f[0]) . '</td><td style="padding:6px 0;font-weight:700">' . $e($f[1]) . '</td></tr>', $facts));
    $lis = implode('', array_map(fn($t) => '<li style="margin:0 0 6px">' . $e($t) . '</li>', $terms));
    $html = '<!doctype html><html><body style="margin:0;background:#fdf8ee;font-family:Arial,Helvetica,sans-serif;color:#1d2a1c">'
          . '<div style="max-width:600px;margin:0 auto;padding:24px 18px">'
          . '<div style="font-size:20px;font-weight:800;color:#21451f;margin-bottom:14px">' . $e($name) . '</div>'
          . '<p style="margin:0 0 14px">Hi' . ($first !== '' ? ' ' . $e($first) : '') . ',</p><p style="margin:0 0 18px">Thanks for booking with ' . $e($name) . '. Here is a copy of the agreement you signed.</p>'
          . '<div style="background:#fff;border:1px solid #dfe6da;border-radius:14px;padding:16px 18px;margin-bottom:14px"><div style="font-weight:800;color:#2e5e2c;margin-bottom:8px">What we agreed</div><table style="border-collapse:collapse;font-size:15px">' . $rows . '</table></div>'
          . '<div style="background:#fff;border:1px solid #dfe6da;border-radius:14px;padding:16px 18px;margin-bottom:14px"><div style="font-weight:800;color:#2e5e2c;margin-bottom:8px">The details</div><ol style="margin:0;padding-left:20px;font-size:15px">' . $lis . '</ol></div>'
          . '<div style="background:#eef6ea;border:1px solid #cfe3c6;border-radius:14px;padding:16px 18px;margin-bottom:18px"><div style="font-size:22px;font-style:italic;font-weight:700;color:#21451f">' . $e($sg['name']) . '</div><div style="color:#5a6858;font-size:14px;margin-top:4px">Signed electronically on ' . $e($when) . '.</div></div>'
          . '<p style="margin:0 0 14px"><a href="' . $e($link) . '" style="display:inline-block;background:#2e5e2c;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">View or print your agreement</a></p>'
          . '<p style="margin:0;color:#5a6858;font-size:14px">Questions or changes: call or text <a href="tel:' . $e(preg_replace('/\D/', '', $ph)) . '" style="color:#2e5e2c">' . $e($ph) . '</a>.</p>'
          . '</div></body></html>';
    $r = a365Mail($to, 'Your signed agreement with ' . $name, $text, $html);
    appendLine(DATA_DIR . '/a365-mail.log', ['at' => time(), 'lead' => (string) $l['id'], 'what' => 'signed', 'ok' => $r['ok'], 'stage' => $r['stage'], 'error' => mb_substr((string) $r['error'], 0, 300)]);
    appendLine(leadsDir() . '/leadst.log', ['id' => (string) $l['id'], 'note' => $r['ok'] ? 'Signed copy emailed to ' . $to . '.' : 'Signed copy NOT emailed (' . ($r['stage'] === 'config' ? 'the 365 mailbox is not set up yet' : $r['stage']) . ').', 'mailed' => $r['ok'] ? ['to' => $to, 'at' => time()] : null, 'by' => $by, 'at' => time()]);
    return $r + ['to' => $to];
}
if ($action === 'a365sign' || $action === 'a365signed' || $action === 'a365savecard') {
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if (in_array($origin, A365_ORIGINS, true)) { header('Access-Control-Allow-Origin: ' . $origin); header('Vary: Origin'); header('Access-Control-Allow-Methods: GET, POST'); header('Access-Control-Allow-Headers: Content-Type'); }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
    if (!feature('walkdesk') || !company()['a365']) fail('Not here.', 404);
    header('Cache-Control: no-store'); header('X-Robots-Tag: noindex');
    if (!isset($TEAM)) $TEAM = teamInfo($basePeople, $acct, $sessionKey);
    if (!throttleTake(rateFile('a365sign|' . visitorKey()), 120, 3600)) fail('Too many tries from here. Please call or text us.', 429);
    $sk = (string) ($_GET['s'] ?? ($body['s'] ?? ''));
    $all = leadsAll();
    if (!preg_match('/^([wm]\d{14}[0-9a-f]{6})-([0-9a-f]{16})$/D', $sk, $sm) || !isset($all[$sm[1]]) || empty($all[$sm[1]]['sign'])
        || !hash_equals(a365SignKey($sm[1], (string) $all[$sm[1]]['sign']['key']), $sm[2])) fail('This link does not look right, or a newer form was sent. Please call or text us.', 404);
    $l = $all[$sm[1]];
    if ($l['status'] === 'lost') fail('This form is no longer open. Please call or text us.', 410);
    if (empty($l['signed']) && ($l['sign']['how'] ?? '') === 'link' && a365DepositPaid($l)) $l = leadsAll()[$l['id']];   /* SX-58: back from Square */
    $payOut = ($l['sign']['how'] ?? '') === 'link' ? ['amount' => (int) $l['sign']['deposit'], 'paid' => a365DepositPaid($l, false), 'url' => a365DepositPaid($l, false) ? null : (string) ($l['sign']['pay']['url'] ?? '')] : null;
    $A = a365Agreement($l);
    $first = ucfirst(strtolower((string) (preg_split('/\s+/', trim((string) ($l['name'] ?? '')))[0] ?? '')));
    $signedOut = fn($sg) => $sg ? ['name' => (string) $sg['name'], 'when' => (new DateTime('@' . (int) $sg['at']))->setTimezone(new DateTimeZone(appTz()))->format('F j, Y \a\t g:i a')] : null;
    $sgd = $l['signed'] ?? null;   /* signed: the facts and terms as they were when signed (Fable review 2026-10-14) */
    $jn = jobForLead($l['id']); $moved = $jn && !empty($jn['wx']) && $jn['date'] >= (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d') ? ['day' => a365Day($jn['date']), 'arrive' => a365Arrive((string) $jn['slot'])] : null;   /* moved for weather (2026-10-15) */
    if ($action === 'a365savecard') {   /* ticked or not, recorded before they go to Square to pay (2026-10-15) */
        if (!$isPost) fail('POST required', 405);
        if (!empty($l['signview']['facts']) && empty($l['signed'])) out(['ok' => true, 'kept' => false]);   /* view only: no payment */
        if (!empty($l['signed']) || ($l['sign']['how'] ?? '') !== 'link' || a365DepositPaid($l, false)) out(['ok' => true, 'kept' => false]);
        $bal = (int) $l['quote']['price'] - (int) $l['sign']['deposit'];
        appendLine(leadsDir() . '/leadst.log', ['id' => $l['id'], 'savecard' => ['yes' => !empty($body['save']), 'text' => a365SaveText($bal), 'at' => time(), 'ip' => (string) (relayIp() ?? ($_SERVER['REMOTE_ADDR'] ?? '')), 'ua' => mb_substr((string) (relayIp() !== null ? ($_SERVER['HTTP_X_CLIENT_UA'] ?? '') : ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 200)], 'by' => 'website', 'at' => time()]);
        out(['ok' => true, 'kept' => true]);
    }
    /* the customer opened it (2026-10-15, Matthew: "is there a way to know if he opened the link"): a visit counts once per 10 minutes;
       opened from the app (staff=1) does not count. Link previews in a text or email do not run the page, so they do not count either. */
    if ($action === 'a365sign' && empty($l['signed']) && empty($_GET['staff'])) {
        $sn = (($l['seen']['key'] ?? '') === ($l['sign']['key'] ?? null)) ? $l['seen'] : null;
        if (!$sn || time() - (int) ($sn['last'] ?? 0) > 600) appendLine(leadsDir() . '/leadst.log', ['id' => $l['id'], 'seen' => ['key' => (string) $l['sign']['key'], 'first' => (int) ($sn['first'] ?? time()), 'last' => time(), 'n' => (int) ($sn['n'] ?? 0) + 1], 'by' => 'website', 'at' => time()]);
    }
    $sv = !empty($l['signview']['facts']) && empty($l['signed']) ? $l['signview'] : null;   /* view only (2026-10-16): the agreement as the office wrote it, nothing to pay or sign */
    if ($sv && $action === 'a365sign') out(['ok' => true, 'view' => true, 'moved' => null, 'first' => $first, 'facts' => $sv['facts'], 'terms' => $sv['terms'], 'consent' => '', 'consents' => [], 'pay' => null, 'save' => null]);
    if ($sv) fail('This agreement is for reading only. Please call or text us at ' . a365Phone($l) . '.', 409);
    if (!empty($l['sign']['nosign']) && empty($l['signed'])) {   /* no signature needed (2026-10-17): the agreement, the deposit when by link, booked once it is in */
        if (empty($l['confirmed']) && (($l['sign']['how'] ?? '') !== 'link' || a365DepositPaid($l, false))) { a365BookNoSign((string) $l['id'], 'website'); $l = leadsAll()[$l['id']]; }   /* catch-up */
        if ($action !== 'a365sign') fail('This form needs no signature. Questions? Call or text us at ' . a365Phone($l) . '.', 409);
        $cf = $l['confirmed'] ?? null; $jb = $cf && !empty($cf['job']) ? (jobsAll()[(string) $cf['job']] ?? null) : null;
        out(['ok' => true, 'nosign' => true, 'moved' => $moved, 'first' => $first, 'facts' => $cf['facts'] ?? $A['facts'], 'terms' => $cf['terms'] ?? $A['terms'], 'consent' => '',   /* the copy kept at booking (2026-10-18) */ 'consents' => [], 'pay' => $payOut,
             'save' => $payOut && !$payOut['paid'] ? ['text' => a365SaveText((int) $l['quote']['price'] - (int) $l['sign']['deposit']), 'on' => !empty($l['savecard']['yes'])] : null,
             'confirmed' => (bool) $cf, 'booked' => $jb && !$jb['off'] ? ['day' => a365Day((string) $jb['date']), 'arrive' => a365Arrive((string) $jb['slot'])] : null, 'phone' => a365Phone($l)]);
    }
    if ($action === 'a365sign') out(['ok' => true, 'moved' => $moved, 'first' => $first, 'facts' => ($sgd['facts'] ?? null) ?: $A['facts'], 'terms' => ($sgd['terms'] ?? null) ?: $A['terms'], 'consent' => $A['consent'], 'consents' => $A['consents'], 'pay' => $payOut, 'save' => $payOut && !$payOut['paid'] ? ['text' => a365SaveText((int) $l['quote']['price'] - (int) $l['sign']['deposit']), 'on' => !empty($l['savecard']['yes'])] : null, 'signed' => $signedOut($l['signed'] ?? null), 'phone' => a365Phone($l)]);
    if (!$isPost) fail('POST required', 405);
    if (!empty($l['signed'])) out(['ok' => true, 'signed' => $signedOut($l['signed'])]);   /* already signed: say so again */
    $name = a365Clean($body['name'] ?? '', 120);
    if (mb_strlen($name) < 3) fail('Type your full name to sign.');
    if (empty($body['agree'])) fail('Tick the box to agree.');
    if (empty($body['read'])) fail('Tick the box to say you have read it.');   /* v2: two boxes (Matthew 2026-10-15) */
    if (($l['sign']['how'] ?? '') === 'link' && !a365DepositPaid($l)) fail('Pay the deposit first (the green button above), then sign.', 402);
    if (($l['sign']['how'] ?? '') === 'link') { a365AfterPaid($l['id']); $l = leadsAll()[$l['id']]; }
    $lk = @fopen(DATA_DIR . '/jobs.log.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX)) fail('Something went wrong. Please call or text us.', 500);
    /* Fable review 2026-10-14: everything read again inside the lock. A second Sign (double tap, a retry) returns the first signature; a job
       already on the board for this lead (booked from the quote page) is linked and given the deposit, not reported as "set a new day". */
    $l = leadsAll()[$l['id']];
    if (!empty($l['signed'])) { flock($lk, LOCK_UN); out(['ok' => true, 'signed' => $signedOut($l['signed'])]); }
    $A = a365Agreement($l);
    $Q = $l['quote']; $S2 = $l['sign']; $o = $Q['offer'] ?? null; $jid = null; $had = false;
    $today0 = (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d');
    $ex = jobForLead($l['id']);
    if ($ex && !$ex['done']) {
        $jid = $ex['id']; $had = true; $o = ['crew' => $ex['crew'], 'date' => $ex['date'], 'slot' => $ex['slot']];
        appendLine(DATA_DIR . '/jobs.log', ['id' => $jid, 'pay' => ['s' => 'deposit', 'amt' => (int) $S2['deposit'], 'how' => $S2['how'] === 'link' ? 'square' : (string) $S2['how']], 'by' => 'website', 'at' => time()]);
    } elseif ($o && slotFree((string) $o['crew'], (string) $o['date'], (string) $o['slot'], (string) $l['id']) === null && (string) $o['date'] >= $today0) {
        $h = $l['house'] ?? null; $addr = $h ? streetCaseServer((string) $h['address']) . ', ' . streetCaseServer(houseTown($h)) : (string) ($l['town'] ?? '');
        $nj = 'j' . bin2hex(random_bytes(6));
        if (appendLine(DATA_DIR . '/jobs.log', ['id' => $nj, 'lead' => $l['id'], 'title' => trim((string) ($l['name'] ?? '')) ?: $name, 'crew' => (string) $o['crew'], 'date' => (string) $o['date'], 'slot' => (string) $o['slot'],
            'price' => (int) $Q['price'], 'pkg' => (string) $Q['pkg'], 'scope' => 'all', 'seedLb' => $Q['seedLb'] ?? null, 'fertLb' => $Q['fertLb'] ?? null,
            'pay' => ['s' => 'deposit', 'amt' => (int) $S2['deposit'], 'how' => $S2['how'] === 'link' ? 'square' : (string) $S2['how']], 'card' => false, 'note' => trim((string) ($S2['note'] ?? '') . ' ' . a365ExtrasNote($Q)), 'addr' => $addr ?: 'Ask the office', 'by' => 'website', 'at' => time()])) $jid = $nj;
    }
    /* what was shown is kept with the signature, so the signed page never changes if the quote does later */
    $sg = ['name' => $name, 'at' => time(), 'version' => A365_SIGN_VERSION, 'hash' => $A['hash'], 'facts' => $A['facts'], 'terms' => $A['terms'],
           'ip' => (string) (relayIp() ?? ($_SERVER['REMOTE_ADDR'] ?? '')), 'ua' => mb_substr((string) (relayIp() !== null ? ($_SERVER['HTTP_X_CLIENT_UA'] ?? '') : ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 200), 'job' => $jid];
    if (!appendLine(leadsDir() . '/leadst.log', ['id' => $l['id'], 'signed' => $sg, 'status' => 'won', 'note' => mb_substr('Signed by ' . $name . ($had ? '; it was already booked, deposit added to the job.' : ($jid ? '; job booked.' : '; the day was no longer free, so set a new one.')), 0, 500), 'by' => 'website', 'at' => time()])) { flock($lk, LOCK_UN); fail('Something went wrong saving that. Please call or text us.', 500); }
    flock($lk, LOCK_UN);
    $who = trim((string) ($l['name'] ?? '')) ?: $name;
    if ($jid && !$had) { $sl = jobSlot((string) $o['slot']); pushName((string) $o['crew'], 'Job booked: ' . deskWhen((string) $o['date'], '') . ($sl ? ', ' . $sl[1] : ''), $who . ' · $' . $Q['price'] . ' · deposit paid', './?job=' . $jid, 'job-' . $jid); }
    a365Alert($jid ? 'Signed and booked' : 'Signed: set a new day', $who . ' · $' . $Q['price'] . ($jid ? ' · ' . deskWhen((string) $o['date'], '') : ''), true, false, ($l['src'] ?? '') === 'a365web');
    $ml = a365SendSigned($l, $sg, 'website');   /* the signed copy by email (2026-10-15) */
    out(['ok' => true, 'signed' => $signedOut($sg), 'mailed' => $ml['ok'] ? $ml['to'] : null, 'booked' => $jid ? ['day' => a365Day((string) $o['date']), 'arrive' => a365Arrive((string) $o['slot'])] : null]);
}

/* ---- the Sixfold website's contact form (2026-10-14) ----
 * Matthew: "make sure the website contact forms lead to the app". sixfoldcolorado.com's form used to write the lead straight into
 * the app's files, which only worked while the app lived on the same server; since the move to traverseplatforms.com (2026-10-09)
 * its leads reached email only. Now the form's server posts each one here with a shared key (sixfold-private/site-lead-key.txt
 * here, app_lead_key in the site's secrets), and it lands in the Pipeline like the 365 site's (no phone alert: leadAlertsOn). */
function siteLeadKey(): string { $k = trim((string) @file_get_contents(dirname(__DIR__, 2) . '/sixfold-private/site-lead-key.txt')); return strlen($k) >= 32 ? $k : ''; }
if ($action === 'sitelead') {
    if (!$isPost) fail('POST required', 405);
    $k = siteLeadKey(); if ($k === '' || !hash_equals($k, (string) ($_SERVER['HTTP_X_SITE_KEY'] ?? ''))) fail('Not here.', 404);
    $src = (string) ($body['src'] ?? 'website'); if (!in_array($src, ['website', 'linktree', 'nextdoor', 'referral', 'phone', 'other'], true)) $src = 'website';   /* LEAD_SRC is defined further down */
    $row = ['id' => 'w' . date('YmdHis') . bin2hex(random_bytes(3)), 'src' => $src, 'at' => time(), 'need' => a365Clean($body['need'] ?? '', 60),
            'name' => a365Clean($body['name'] ?? '', 120), 'phone' => a365Clean($body['phone'] ?? '', 40), 'email' => a365Clean($body['email'] ?? '', 160),
            'town' => a365Clean($body['town'] ?? '', 160), 'msg' => a365Clean($body['msg'] ?? '', 2000), 'by' => ''];
    if ($row['name'] === '' && $row['phone'] === '' && $row['email'] === '') fail('Empty.');
    if (!appendLine(leadsDir() . '/leads.log', $row)) fail('Could not save that.', 500);
    if (preg_match('/^\d+ \S/', $row['town'])) { $parts = array_map('trim', explode(',', $row['town'])); $h = a365Match($parts[0], $parts[1] ?? ''); if ($h) appendLine(leadsDir() . '/leadst.log', ['id' => $row['id'], 'house' => $h, 'by' => 'website', 'at' => time()]); }
    if (leadAlertsOn()) a365Alert('New website enquiry', ($row['name'] ?: 'Someone') . ($row['need'] !== '' ? ' · ' . $row['need'] : ''), false, true);
    out(['ok' => true, 'id' => $row['id']]);
}

/* everything past here needs a session */
if (!$session) fail('Sign in first.', 401);
$me   = (string) $session['n'];
$role = (string) ($session['r'] ?? 'crew');
/* see through their eyes (2026-10-19, Matthew: "tabs similar to (view jens screen) where i can click office, worker, crew, manager, etc so
   i can just mess with the app through their eyes instead of having to logout and login to multiple accounts"). The super admin only.
   The X-View-As header names an account (its row id) and every request is answered AS that account: its name, role and Does walks, so
   each screen is exactly what they get, filtering included (the old See Jen's screen only changed what was drawn). Looking only:
   anything that would save is refused, so nothing is ever done in someone else's name; loading doors still works. */
$realMe = $me; $realC = (string) ($session['c'] ?? ''); $realSuper = $isSuper; $viewing = null;
$vaId = (string) ($_SERVER['HTTP_X_VIEW_AS'] ?? '');
if ($isSuper && $vaId !== '' && $action !== 'viewaslist') {
    $vaRow = acctRows($basePeople, $acct, $sessionKey)[$vaId] ?? null;
    if (!$vaRow || $vaRow['off'] || in_array($vaRow['role'], ['admin', 'super'], true)) out(['ok' => false, 'why' => 'viewgone', 'error' => 'That account is not there any more. Back to your own screen.'], 409);
    $viewing = ['by' => $realMe, 'name' => $vaRow['name'], 'role' => $vaRow['role']];
    $me = $vaRow['name']; $role = $vaRow['role']; $session['c'] = $vaId; $isSuper = false;
    if ($action === 'taplog') out(['ok' => true, 'kept' => 0]);   /* their tap log stays theirs */
    if ($isPost && !in_array($action, ['area', 'signout'], true)) out(['ok' => false, 'why' => 'viewing', 'error' => 'Looking only: this is ' . $me . '\'s screen, so nothing is saved. Go back to your own screen to make changes.'], 409);
}
if (!defined('SIXFOLD_CLI') && !$viewing && in_array($role, ['office', 'quote'], true)) geoCheck($me, (string) ($session['c'] ?? ''), $role);   /* where the account is used (2026-10-15) */
/* a 365-website lead, its job or its customer asked for by id from an account that does not see them: as if it were not there (2026-10-22) */
if (webHide()) {
    $wIds = webLeadIds(); $wJobs = []; foreach (jobsAll() as $wj) if (!empty($wj['web'])) $wJobs[(string) $wj['id']] = true;
    $wCust = []; foreach (custLines('customers.log') as $wr) { $wl = (string) ($wr['f']['lead'] ?? ''); if (($wr['f']['source'] ?? '') === 'a365web' || ($wl !== '' && isset($wIds[$wl]))) $wCust[(string) ($wr['id'] ?? '')] = true; }
    foreach (['id', 'lead', 'job', 'cid', 'customer'] as $wk) { $wv = $body[$wk] ?? ($_GET[$wk] ?? null); if (is_string($wv) && $wv !== '' && (isset($wIds[$wv]) || isset($wJobs[$wv]) || isset($wCust[$wv]))) fail('Not found.', 404); }
}
if ($role === 'quote' && in_array($action, ['leadquote', 'leadhouse', 'leadcontact', 'signsend', 'a365mailsigned', 'squarecheck'], true) && !($action === 'squarecheck' && !empty($body['job']))) {   /* only her own leads (2026-10-15); a job's pay link is checked against the job (2026-10-19) */
    $qlid = (string) ($body['id'] ?? ($body['lead'] ?? '')); $qL = leadsAll()[$qlid] ?? null;
    /* + her Leads to call (2026-10-18, Fable review): "They said yes" on a lead she did not make died here with Not allowed, while Reached out?
       and Not interested on the same lead were fine. Quoting it makes it hers (qown), as the Quick quote's own leadadd does. */
    if (!$qL || !(qMine($qL) || quoteInbox($qL, true))) fail('Not allowed.', 403);
    if (!qMine($qL) && $isPost && in_array($action, ['leadquote', 'leadhouse', 'leadcontact', 'signsend'], true)) appendLine(leadsDir() . '/leadst.log', ['id' => $qlid, 'qown' => $me, 'note' => 'Taken on by ' . $me . ' from Leads to call.', 'by' => $me, 'at' => time()]);
}
if ($role === 'quote' && !in_array($action, ['me', 'signout', 'search', 'holdset', 'qwon', 'customerfrom', 'leadtry', 'qdrop', 'a365house', 'a365pricing', 'a365calc', 'squarestate', 'leads', 'leadadd', 'leadquote', 'leadhouse', 'leadcontact', 'signsend', 'a365mailsigned', 'squarecheck', 'jobs', 'schedview', 'jobblockadd', 'jobblockdel', 'lawnhand', 'lawnrange', 'jobsave', 'leadtown', 'proppull', 'myjobs', 'jobcharge', 'jobpaylink', 'jobpaid', 'aftercare', 'jobdone', 'ridetime', 'squarelook'], true))   /* the schedule is back (Matthew 2026-10-15: "at least with the schedule there she can look back to see the appointments she's made"): her own jobs in full, everyone else's as Booked/Held */ fail('Not allowed.', 403);   /* quote-only accounts (2026-10-15) */
if (!defined('SIXFOLD_CLI') && ($cookieNow = (string) ($_COOKIE[COOKIE] ?? '')) !== '') {
    $tagNow = sessionTag($cookieNow);
    $sessNow = sessLoad();
    if (isset($sessNow['x'][$tagNow])) out(['ok' => false, 'why' => 'elsewhere', 'error' => 'Signed out: your code was used to sign in on another ' . (devClass() === 'm' ? 'phone or tablet' : 'computer') . '. Each code works on one phone and one computer at a time. If that was not you, tell your manager.'], 401);
    $lineNow = $sessNow['s'][$tagNow] ?? null;
    if (!is_array($lineNow) || (int) ($lineNow[2] ?? 0) < time() - SEEN_EVERY) {
        $fresh = [$realC, (int) ($session['exp'] ?? 0), time(), is_array($lineNow) ? (string) ($lineNow[3] ?? deviceName()) : deviceName(), is_array($lineNow) ? devClassOf($lineNow) : devClass()];
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
if ($action === 'geolog') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    $rows = []; foreach ((@file(DATA_DIR . '/geoalert.log', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []) as $ln) { $r = json_decode($ln, true); if (is_array($r)) $rows[] = $r; }   /* readLines() keeps only rows with an id */
    $rows = array_reverse(array_slice($rows, -300));
    $seen = json_decode((string) @file_get_contents(DATA_DIR . '/geo-seen.json'), true) ?: []; $people = [];
    foreach ($seen as $id => $x) { $ips = array_values($x['ip'] ?? []); usort($ips, fn($a, $b) => ($b['last'] ?? 0) <=> ($a['last'] ?? 0));
        $people[] = ['name' => (string) ($x['name'] ?? ''), 'places' => array_slice(array_map(fn($r) => ['place' => $r['place'], 'ok' => $r['ok'], 'last' => $r['last'] ?? $r['at']], $ips), 0, 12), 'devices' => array_values(array_map(fn($d) => ['what' => $d['what'], 'first' => $d['first'], 'last' => $d['last']], $x['dev'] ?? []))]; }
    out(['ok' => true, 'guard' => geoGuard(), 'rows' => $rows, 'people' => $people, 'src' => 'Locations: DB-IP IP to City Lite (CC BY 4.0, db-ip.com)']);
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
/* the accounts the super admin can look through (2026-10-19): everyone but admins, switched-off and check accounts. "Job crew" is a crew
   account named on the jobs board (Brad); the rest of the crew role are door reps. */
if ($action === 'viewaslist') {
    if (!$realSuper) fail('Not allowed.', 403);
    $onJobs = []; if (feature('walkdesk')) foreach (jobsAll() as $j) if (!$j['off']) $onJobs[(string) $j['crew']] = true;
    $list = [];
    foreach (acctRows($basePeople, $acct, $sessionKey) as $r) {
        if ($r['off'] || in_array($r['role'], ['admin', 'super'], true) || boardHidden($r['name']) || trim($r['name']) === '') continue;
        $list[] = ['id' => $r['id'], 'name' => $r['name'], 'role' => $r['role'], 'walker' => !empty($acct['walker'][$r['id']]), 'jobs' => isset($onJobs[$r['name']])];
    }
    usort($list, fn($a, $b) => strcasecmp($a['name'], $b['name']));
    out(['ok' => true, 'people' => $list]);
}
if ($action === 'me') out(['ok' => true, 'viewing' => $viewing, 'name' => $me, 'sign' => (string) (company()['_signAs'][$me] ?? ''), 'role' => $role, 'walker' => !empty($acct['walker'][(string) ($session['c'] ?? '')]), 'pays' => paysOn((string) ($session['c'] ?? '')), 'runsteam' => $role === 'office' && acctFlag('runsteam', (string) ($session['c'] ?? '')), 'wonlost' => $role === 'office' && acctFlag('wonlost', (string) ($session['c'] ?? '')), 'doors' => $role === 'office' && acctFlag('doors', (string) ($session['c'] ?? '')), 'communities' => $role === 'office' && acctFlag('communities', (string) ($session['c'] ?? '')), 'results' => $role === 'office' && acctFlag('results', (string) ($session['c'] ?? '')), 'fq' => $role !== 'admin' && fqOn(), 'mail' => (bool) a365MailCfg(), 'super' => $isSuper, 'sid' => sessionTag((string) ($_COOKIE[COOKIE] ?? '')), 'avatar' => avatarVer((string) ($session['c'] ?? ''))]);

/* the Sample door (Matthew 2026-10-05): one made-up door with every part of the card filled in, admins only. Kept in the
   private data folder because its address is a real one; the page holds no copy. Nothing the page does to it is sent back. */
/* teams (2026-10-05): who is on whose team, worked out once per request; the functions and actions are further down */
/* 'office' (2026-10-14, the walk desk): calls, emails and booking walks, nothing else of the admin's; only where features.walkdesk is on */
define('ROLES', feature('walkdesk') ? (company()['a365'] ? ['crew', 'office', 'quote', 'manager', 'admin'] : ['crew', 'office', 'manager', 'admin']) : ['crew', 'manager', 'admin']);
/* 'quote' (2026-10-15, Matthew: "an account that goes straight to the quote generator and only shows that"): the Quick quote and nothing else; the server refuses every other action */
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
        if (!$data || empty($data['areas'])) continue;   /* no neighbourhoods (the pulled-in houses, 2026-10-16): search only, not a town */
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
    $lfix = loadLawnFix($key); $lhand = loadLawnHand($key);   /* 2026-10-21 */
    $emails = loadEmails($key);
    $photos = loadPhotos($key);
    $work = loadWork($key);
    $fchk = loadFireChecks($key);
    $walks = loadWalks($key);
    $custDoors = customerDoors();   /* the crew see the tag on the door (plan and start date only, no contact details) */
    $repOf = (TERRITORIES_OPEN || $role === 'admin' || mgr()) ? loadDoorAssign($key) : [];   /* doors assigned to one person (2026-10-08) */
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
    /* everywhere else, only houses built in or after the aerial photo's year, so the lot preview can say why the house may not show
       (2026-10-20, Matthew: "if its builts after 2023 we should probably state that as a reason for not having imagery") */
    if (!roofDataOn($role)) { $photoYr = (int) (market()['naip']['year'] ?? 2023); $bldOf = array_filter(array_map(fn($v) => is_array($v) && (int) ($v['yb'] ?? 0) >= $photoYr ? ['yb' => (int) $v['yb']] : null, loadSide('year', $key, $only))); }
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
                'lawnfix' => $lfix[$d['id']] ?? null, 'hand' => $lhand[$d['id']] ?? null,
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
    if (mgr() && !empty($_REQUEST['team']) && trim((string) ($_REQUEST['who'] ?? '')) === '') $who = '';
    $list = teamDays($days, $who);
    if (($role === 'manager' || (mgr() && !empty($_REQUEST['team']))) && $who === '') $list = array_values(array_filter($list, fn($p) => $p['name'] === $me || sameTeam($p['name'])));
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
    $lines = preg_split('/\r?\n/', trim($csv)); $h = str_getcsv((string) array_shift($lines), ',', '"', '\\'); $ix = array_flip($h); $r = [];   /* the escape named: PHP 8.4 logs a deprecation on every call without it (review 2026-10-22: 1,500 lines in the test log) */
    foreach ($lines as $l) {
        $v = str_getcsv($l, ',', '"', '\\'); if (($v[$ix['TYPECODE'] ?? -1] ?? '') !== 'H') continue;
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
        $v = []; foreach (explode("\n", (string) $csv) as $l) { $p = str_getcsv(trim($l), ',', '"', '\\'); $x = isset($p[2]) ? (float) $p[2] : -999; if ($x > -100) $v[] = $x; }
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
    if ($role !== 'admin' && !($role === 'office' && (mgr() || acctFlag('communities', (string) ($session['c'] ?? ''))))) fail('Not allowed.', 403);   /* + an office account that runs a team (2026-10-20), or set to Communities (Cai, 2026-10-21) */
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
/* Jen's Leads to call (2026-10-16, Matthew: "starting now we should have non facebook message leads populate in her quick quote as people to
   reach out to"): open leads (new or contacted, not quoted) that came in from now on, except Messenger messages; any lead sent to her
   (tojen); and her own leads not quoted yet. $mine: count her own (the quote account asking). */
/* QUOTE_INBOX_FROM (16 Oct 2026) is declared beside qMine() near the top (2026-10-18) */
function quoteInbox(array $l, bool $mine = false): bool {
    if (!in_array((string) ($l['status'] ?? 'new'), ['new', 'contacted', 'hold'], true) || !empty($l['quote'])) return false;   /* + hold: On hold is our Pipeline's stage; her list shows them as before (2026-10-17, Matthew: Jim was on there) */
    if (!empty($l['tojen']) || ($mine && qMine($l))) return true;
    if (($l['src'] ?? '') === 'a365web') return false;   /* the 365 website's forms go only to Matthew (2026-10-20: "website form leads which should only go to my app"), unless he hands one over (Send to Jen, or Jen as owner, above) */
    return ($l['src'] ?? '') !== 'messenger' && (int) ($l['at'] ?? 0) >= QUOTE_INBOX_FROM;   /* new leads only, since 16 Oct: back as it was (2026-10-17, Matthew: don't send Jen anything she didn't populate herself unless it is a new lead) */
}
const LEAD_SRC = ['website', 'meta', 'nextdoor', 'phone', 'linktree', 'referral', 'other', 'messenger', 'a365web', 'inperson', 'door'];   /* + door: a house the crew added at the door (2026-10-16) */   /* + in person (2026-10-15) */   /* messenger + the 365 Aeration site (2026-10-14) */
const LEAD_STATUS = ['new', 'contacted', 'walk', 'quoted', 'won', 'lost', 'hold', 'unreached'];   /* + hold: on hold, parked on purpose (2026-10-17) */   /* + unreached: Couldn't reach (2026-10-21) */
function leadsDir(): string { return dirname(DATA_DIR) . '/leads'; }
function readLines(string $f): array { return array_values(array_filter(jsonLines($f), fn($r) => isset($r['id']))); }   /* the rows with an id; decoded once per request (review 2026-10-22) */
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
/* an Office account that also runs a team (2026-10-20, Matthew: Nneka is a sales rep who also does calls, doors and quotes, "she will manage a
   team for bria and christain"). Accounts ticks two options on an office account: "Runs a team" (runsteam) gives exactly a manager's powers
   over their own team; "Marks won and lost" (wonlost) shows the Won and Lost buttons the office screen otherwise hides. Everything else stays
   the office's: no pricing math, no Payments page, no other teams, no codes but their team's. */
function acctFlag(string $k, string $id): bool { global $acct; return feature('walkdesk') && $id !== '' && !empty($acct[$k][$id]); }
function mgr(): bool { global $role, $session; return $role === 'manager' || ($role === 'office' && acctFlag('runsteam', (string) ($session['c'] ?? ''))); }
function sameTeam(string $who): bool { global $TEAM, $myTeam; return $myTeam !== '' && ($TEAM['byName'][$who]['team'] ?? '') === $myTeam; }
/** may the signed-in person manage who's things (stats, calendar entries, goals, leads)? */
function canManage(string $who): bool { global $role, $me; return $who === $me || $role === 'admin' || (mgr() && sameTeam($who)); }
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
    if (!mgr()) return false;
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
/* 365-website leads are Matthew's alone (2026-10-22, Matthew: "I just dont want jen to see anyone thats come from 365 website. That should
   only be viewable by me, and when i move someone through the pipeline that are from the 365 website jen should still not see it"). For an
   office, quote or manager account, every lead whose source is the 365 website is left out wherever leads are read, whatever its stage,
   owner or hand-over (Send to Jen no longer shows one to her). Its jobs keep their time on the schedule, so nobody books over them, as
   "Booked" without the name, address or note; its customer record, its Square payments and its alerts are left out too, and asking for one
   by its id is refused. Admins (Matthew is the super admin) see everything; the crew still see their own jobs in full (Brad does the work);
   the command-line jobs (ClickUp, Square, the morning email to Contact@) see everything. View-as follows the account looked through. */
function webHide(): bool { global $role; return !defined('SIXFOLD_CLI') && is_string($role ?? null) && in_array($role, ['office', 'quote', 'manager'], true); }
function webLeadIds(): array { static $ids = null; if ($ids === null) { $ids = []; foreach (leadsAllRaw() as $id => $l) if (($l['src'] ?? '') === 'a365web') $ids[$id] = true; } return $ids; }
function leadsAll(): array { $all = leadsAllRaw(); return webHide() ? array_filter($all, fn($l) => ($l['src'] ?? '') !== 'a365web') : $all; }
function leadsAllRaw(): array {
    static $c = null; $sig = fileSig(leadsDir() . '/leads.log') . '|' . fileSig(leadsDir() . '/leadst.log');   /* built once per request, again after a write (review 2026-10-22) */
    if ($c !== null && $c[0] === $sig) return $c[1];
    $leads = [];
    foreach (readLines(leadsDir() . '/leads.log') as $l) $leads[$l['id']] = $l + ['status' => 'new', 'notes' => [], 'statusAt' => null, 'statusBy' => null, 'owner' => '', 'ownerBy' => null, 'follow' => null, 'tries' => [], 'house' => null, 'ask' => null, 'quote' => null, 'recall' => null];
    foreach (readLines(leadsDir() . '/leadst.log') as $u) {
        if (!isset($leads[$u['id']])) continue;
        if (!empty($u['status'])) { $leads[$u['id']]['status'] = $u['status']; $leads[$u['id']]['statusAt'] = $u['at']; $leads[$u['id']]['statusBy'] = $u['by']; }
        if (!empty($u['note'])) $leads[$u['id']]['notes'][] = ['note' => $u['note'], 'by' => $u['by'], 'at' => $u['at']];
        if (!empty($u['quote']) && is_array($u['quote'])) $leads[$u['id']]['quote'] = $u['quote'] + ['by' => (string) ($u['by'] ?? ''), 'at' => (int) ($u['at'] ?? 0), 'link' => a365QuoteLink((string) $u['id'])];   /* 2026-10-14, the quote generator; the link is the customer's quote page */
        if (!empty($u['accept']) && is_array($u['accept'])) $leads[$u['id']]['accept'] = $u['accept'] + ['at' => (int) ($u['at'] ?? 0)];   /* 2026-10-14, a yes on the customer's quote page */
        if (!empty($u['sign']) && is_array($u['sign'])) { $leads[$u['id']]['sign'] = $u['sign'] + ['by' => (string) ($u['by'] ?? ''), 'at' => (int) ($u['at'] ?? 0), 'link' => a365SignLink((string) $u['id'], (string) $u['sign']['key'])]; unset($leads[$u['id']]['signed']); }   /* 2026-10-14, the one-page form */
        if (!empty($u['sqpaid']) && is_array($u['sqpaid'])) $leads[$u['id']]['sqpaid'] = $u['sqpaid'];
        foreach (['sqcust', 'sqcard', 'sqafter', 'savecard', 'seen', 'signview', 'tojen', 'stown', 'cu', 'cus', 'cud', 'cutry', 'confirmed', 'wpay', 'mconv', 'fphone', 'src'] as $sk) if (array_key_exists($sk, $u)) $leads[$u['id']][$sk] = $u[$sk];   /* seen: the customer opened the form (2026-10-15) */   /* Square customer, saved card, consent (2026-10-15) */
        if (!empty($u['qown'])) $leads[$u['id']]['qown'][] = (string) $u['qown'];   /* a quote-only person took this lead on (2026-10-15) */
        if (!empty($u['mailed']) && is_array($u['mailed'])) $leads[$u['id']]['mailed'] = $u['mailed'];   /* the signed copy emailed (2026-10-15) */
        if (!empty($u['contact']) && is_array($u['contact'])) foreach (['name', 'phone', 'email'] as $ck) if (isset($u['contact'][$ck]) && is_string($u['contact'][$ck])) {
            if ($ck === 'name' && trim((string) ($leads[$u['id']]['name'] ?? '')) !== '' && $leads[$u['id']]['name'] !== $u['contact']['name']) $leads[$u['id']]['names'][] = (string) $leads[$u['id']]['name'];   /* earlier names kept for matching payments (2026-10-20: "Jeremy Kaplan" became "Jeremy") */
            $leads[$u['id']][$ck] = $u['contact'][$ck];
        }   /* 2026-10-15: changed details */   /* SX-58: the deposit paid by Square link */
        if (!empty($u['signed']) && is_array($u['signed'])) $leads[$u['id']]['signed'] = array_intersect_key($u['signed'], array_flip(['name', 'at', 'version', 'job', 'facts', 'terms']));
        if (array_key_exists('house', $u)) $leads[$u['id']]['house'] = is_array($u['house']) ? $u['house'] : null;   /* 2026-10-14, the house lookup */
        if (!empty($u['ask']) && is_array($u['ask'])) $leads[$u['id']]['ask'] = $u['ask'] + ['by' => (string) ($u['by'] ?? ''), 'at' => (int) ($u['at'] ?? 0)];
        /* back from Couldn't reach (2026-10-21): calls start again; the earlier ones are kept */
        if (!empty($u['back'])) { $leads[$u['id']]['oldTries'] = array_merge($leads[$u['id']]['oldTries'] ?? [], $leads[$u['id']]['tries']); $leads[$u['id']]['tries'] = []; $leads[$u['id']]['back'] = ['how' => (string) $u['back'], 'at' => (int) ($u['at'] ?? 0)]; $leads[$u['id']]['recall'] = null; }
        if (array_key_exists('recall', $u)) $leads[$u['id']]['recall'] = is_string($u['recall']) && $u['recall'] !== '' ? ['date' => $u['recall'], 'by' => (string) ($u['by'] ?? ''), 'at' => (int) ($u['at'] ?? 0)] : null;   /* the day to call back (2026-10-21) */
        if (!empty($u['untry'])) $leads[$u['id']]['tries'] = array_values(array_filter($leads[$u['id']]['tries'], fn($t) => !($t['at'] === (int) $u['untry'] && $t['by'] === (string) ($u['by'] ?? ''))));
        if (!empty($u['try'])) $leads[$u['id']]['tries'][] = ['o' => (string) $u['try'], 'by' => (string) ($u['by'] ?? ''), 'at' => (int) ($u['at'] ?? 0)];   /* call tries (2026-10-14) */
        if (array_key_exists('owner', $u)) { $leads[$u['id']]['owner'] = (string) $u['owner']; $leads[$u['id']]['ownerBy'] = $u['by'] ?? null; }
        if (array_key_exists('follow', $u)) $leads[$u['id']]['follow'] = is_array($u['follow']) ? ['date' => (string) $u['follow'][0], 'time' => (string) ($u['follow'][1] ?? '')] : null;
    }
    foreach ($leads as &$lx) if (!empty($lx['seen']) && ($lx['seen']['key'] ?? '') !== ($lx['sign']['key'] ?? null)) unset($lx['seen']); unset($lx);   /* opens of an older form do not count for a new one */
    $c = [$sig, $leads];
    return $leads;
}
function leadOk(string $id): bool { return (bool) preg_match('/^[wm]\d{14}[0-9a-f]{6}$/D', $id); }
/* ---- Recall and Couldn't reach (2026-10-21, Matthew: "Create a recall section, where voicemail people move to after jens set a date to
 * recall. Put up a notification if its there 3rd time that jen has called them, and ask her if she wants to remove the lead and if she does
 * store it into a Couldnt reach section thats hidden but stored in case they reconnect or redo an intake or messenger to our ad and their
 * info will pull up again") ----
 * Recall: {id, recall: 'YYYY-MM-DD' | ''} on leadst.log. The lead waits under Recall until that day; a call logged after it was set ends it.
 * Couldn't reach: status 'unreached', hidden from every list but its own. Anyone coming back with the same phone or email (the 365 website
 * form, a Facebook form or message, the crew's quick quote, a lead added by hand, a move in Jen's ClickUp) brings that lead back: status
 * new, calls counted afresh (the earlier ones kept as oldTries), and a note saying how. */
function contactKey(string $phone, string $email): array { return [substr((string) preg_replace('/\D/', '', $phone), -10), strtolower(trim($email))]; }
/** every Couldn't-reach lead by its contact: 'p' . ten digits and 'e' . email => lead id, for the Facebook form feeds (metapoll, leadimport) */
function unreachedWho(): array {
    $who = [];
    foreach (leadsAll() as $l) if (($l['status'] ?? '') === 'unreached') { [$ud, $ue] = contactKey((string) ($l['phone'] ?? ''), (string) ($l['email'] ?? '')); if (strlen($ud) === 10) $who['p' . $ud] = $l['id']; if ($ue !== '') $who['e' . $ue] = $l['id']; }
    return $who;
}
function unreachedMatch(string $phone, string $email): ?array {
    [$d, $e] = contactKey($phone, $email); if (strlen($d) !== 10 && $e === '') return null;
    foreach (leadsAll() as $l) {
        if (($l['status'] ?? '') !== 'unreached') continue;
        [$ld, $le] = contactKey((string) ($l['phone'] ?? ''), (string) ($l['email'] ?? ''));
        if ((strlen($d) === 10 && $ld === $d) || ($e !== '' && $le === $e)) return $l;
    }
    return null;
}
function leadRevive(string $id, string $how, string $by, string $extra = ''): bool {
    return appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'status' => 'new', 'back' => $how, 'note' => mb_substr('Back from Couldn\'t reach: ' . $how . '.' . ($extra !== '' ? ' ' . $extra : ''), 0, 500), 'by' => $by, 'at' => time()]);
}
function missRun(array $tries): int { $n = 0; foreach ($tries as $t) $n = ($t['o'] ?? '') === 'talk' ? 0 : (in_array($t['o'] ?? '', ['none', 'vm'], true) ? $n + 1 : $n); return $n; }   /* calls in a row with no answer, as the page counts them */
if ($action === 'leadrecall') {
    if (!feature('walkdesk') || !desk()) fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $l = leadOk($id) ? (leadsAll()[$id] ?? null) : null;
    if (!$l) fail('No such lead.', 404);
    $date = (string) ($body['date'] ?? '');
    if ($date !== '') {
        $tz = new DateTimeZone(appTz());
        if (!dateOk($date)) fail('That is not a real date.');
        if ($date < (new DateTime('today', $tz))->format('Y-m-d')) fail('Pick today or a day ahead.');
        if ($date > (new DateTime('today', $tz))->modify('+1 year')->format('Y-m-d')) fail('Pick a day within the year.');
    }
    if (!appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'recall' => $date, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'date' => $date]);
}
if ($action === 'leadunreach') {
    if (!feature('walkdesk') || !desk()) fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $l = leadOk($id) ? (leadsAll()[$id] ?? null) : null;
    if (!$l) fail('No such lead.', 404);
    if (!empty($body['back'])) {   /* Bring back, from the Couldn't reach list */
        if (($l['status'] ?? '') !== 'unreached') fail('That lead is not under Couldn\'t reach.');
        if (!leadRevive($id, 'brought back by ' . $me, $me)) fail('Could not save that. Try again.', 500);
        out(['ok' => true, 'status' => 'new']);
    }
    if (!in_array((string) ($l['status'] ?? 'new'), ['new', 'contacted', 'hold'], true)) fail('Only a lead still being called goes to Couldn\'t reach.');
    $n = missRun($l['tries']);
    if (!appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'status' => 'unreached', 'recall' => '', 'note' => 'Moved to Couldn\'t reach after ' . $n . ($n === 1 ? ' call' : ' calls') . ' with no answer.', 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'status' => 'unreached']);
}
/* Remove from leads (2026-10-22, Matthew: "we need to be able remove leads"): kept, never deleted. noreach and junk go under Couldn't reach
   (and come back by themselves if they get in touch again, see leadRevive); notint is Lost. A lead with a job keeps it. */
if ($action === 'leadremove') {
    if (!feature('walkdesk') || !desk()) fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $l = leadOk($id) ? (leadsAll()[$id] ?? null) : null;
    if (!$l) fail('No such lead.', 404);
    $W = ['noreach' => ['unreached', 'Removed from the leads: could not reach them'], 'notint' => ['lost', 'Removed from the leads: not interested'], 'junk' => ['unreached', 'Removed from the leads: spam or a duplicate']];
    $why = (string) ($body['why'] ?? ''); if (!isset($W[$why])) fail('Pick why.');
    if (!in_array((string) ($l['status'] ?? 'new'), ['new', 'contacted', 'hold', 'quoted'], true)) fail('Only a lead that is still open can be removed.');
    if (jobForLead($id)) fail('That lead has a job booked. Cancel the job first.');
    if (!appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'status' => $W[$why][0], 'recall' => '', 'note' => $W[$why][1] . '.', 'removed' => $why, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'status' => $W[$why][0]]);
}
if ($action === 'myleads') {
    $who = whoFor((string) ($_GET['who'] ?? '')) ?: $me;
    $whoAll = $who === $me ? meNames() : [$who];   /* leads handed to a linked sign-in are this person's too (2026-10-21) */
    $list = array_values(array_filter(leadsAll(), fn($l) => in_array($l['owner'], $whoAll, true)));
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
        $list[] = ['name' => (string) $n, 'role' => $x['role'], 'team' => $x['team'], 'lead' => $x['role'] === 'manager' || ($x['role'] === 'office' && acctFlag('runsteam', (string) $x['id'])), 'edit' => canManage((string) $n), 'me' => $n === $me, 'walker' => !empty($x['walker'])];
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
    if (feature('walkdesk')) foreach (jobsAll() as $jb) {   /* the jobs board (2026-10-14) */
        if ($jb['off'] || $jb['crew'] !== $who || $jb['date'] < $from || $jb['date'] > $to) continue;
        $sl = jobSlot((string) $jb['slot']);
        $ev[] = ['kind' => 'job', 'job' => $jb['id'], 'date' => $jb['date'], 'time' => $sl ? $sl[2] : '', 'mins' => 90, 'title' => (string) $jb['title'], 'town' => (string) $jb['addr'], 'addr' => (string) $jb['addr'],
                 'need' => ($jb['pkg'] === 'aerate' ? 'Aerate only' : ($jb['pkg'] === 'plan' ? 'Service plan' : 'Aerate, seed & feed')) . ($sl ? ' · arrive ' . $sl[1] : ''), 'phone' => '', 'by' => (string) $jb['by'], 'done' => $jb['done'], 'note' => (string) $jb['note']];
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

/* ---- the house lookup (2026-10-14, 365 Aeration & Seeding; Matthew: when Jen gets an address on a call she must see everything about
 * the property at once, with nobody measuring anything) ----
 * One house with what matters for aeration: the lawn measured from the 2023 photo, the tree cover that throws that measurement
 * (the page turns both into a range and a confidence), the lot, year built and house size where the county gives them. The office
 * only; never shown to customers (Matthew: customers must not know we hold this). A lead can be tied to its house, and keep what the
 * customer said about the lawn; Brad says on the day whether the size was right (lawncheck.log), which is how the ranges get better. */
function sideDoor(string $kind, string $key, string $id) { $f = DATA_DIR . '/' . $kind . '-' . $key . '.json'; if (!is_readable($f)) return null; $j = json_decode((string) file_get_contents($f), true); return is_array($j) ? (($j['doors'] ?? $j)[$id] ?? null) : null; }
/** the Census figures for a house's block group (census-<town>.json, ACS), or null (2026-10-21: shown on every house card) */
function censusFor(string $key, string $id): ?array {
    static $cache = [];
    if (!array_key_exists($key, $cache)) { $j = json_decode((string) @file_get_contents(DATA_DIR . '/census-' . basename($key) . '.json'), true); $cache[$key] = is_array($j) ? $j : null; }
    $c = $cache[$key]; $b = $c['doors'][$id] ?? null;
    return ($c && $b !== null && isset($c['bgs'][$b])) ? $c['bgs'][$b] + ['ver' => (string) ($c['ver'] ?? '')] : null;
}
function houseFacts(string $key, string $id): ?array {
    if (!regionAvailable($key) || !preg_match('/^[a-z0-9-]{1,80}$/D', $id)) return null;
    $k0 = $key; $isDoor = isset(doorIds($key)[$id]); if (!$isDoor) foreach (sharedWith($key) as $p) if (isset(doorIds($p)[$id])) { $isDoor = true; break; }
    if ($isDoor) { $key = doorHome($key, $id); $data = loadRegion($key); if (!$data) return null; } else $data = ['areas' => []];   /* not a door: the office lookup's list (2026-10-14) */
    foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
        if ($d['id'] !== $id) continue;
        $y = sideDoor('year', $key, $id);
        return ['region' => $key, 'id' => $id, 'address' => (string) $d['address'], 'town' => regionLabel($key), 'area' => (string) $a['name'], 'owner' => $d['owner'] ?? null,
                'acres' => $d['acres'] ?? null, 'lawn' => $d['lawn'] ?? null, 'trees' => $d['trees'] ?? null, 'val' => $d['val'] ?? null, 'lat' => $d['lat'] ?? null, 'lon' => $d['lon'] ?? null,
                'cen' => censusFor($key, $id),   /* 2026-10-21 */
                'hand' => loadLawnHand($key)[$id] ?? null, 'range' => (function ($r) { return $r && (int) ($r['v'] ?? 1) >= 2 ? $r : null; })(lawnRangeCache()[$key . '/' . $id] ?? null),   /* 2026-10-21 */
                'yb' => is_array($y) ? ($y['yb'] ?? null) : null, 'bsf' => is_array($y) ? ($y['bsf'] ?? null) : null,
                /* 2026-10-14 (Matthew: "is that all the information we have for the property?"): the rest the door lists carry */
                'fire' => $d['fire'] ?? null, 'cg' => !empty($d['cg']), 'os' => $d['os'] ?? null, 'place' => $a['place'] ?? null,
                'mark' => (function () use ($key, $d, $id) { $m = freshMark($d, loadMarks($key)[$id] ?? null); return $m ? ['o' => (string) ($m['outcome'] ?? ''), 'by' => (string) ($m['by'] ?? ''), 'at' => (int) ($m['at'] ?? 0)] : null; })(),
                'checks' => array_values(array_map(fn($r) => array_intersect_key($r, array_flip(['v', 'sq', 'by', 'at'])), array_filter(readLines(DATA_DIR . '/lawncheck.log'), fn($r) => ($r['region'] ?? '') === $key && $r['id'] === $id)))];
    }
    foreach (lookupDoors($k0) as $d) {   /* not on a door list (2026-10-14): rented, mostly */
        if ($d['id'] !== $id) continue;
        return ['region' => $k0, 'id' => $id, 'address' => (string) $d['address'], 'town' => ((string) ($d['town'] ?? '')) ?: regionLabel($k0), 'area' => $k0 === LOOKED_UP ? 'Pulled in on request' : 'Not on the door lists','owner' => $d['owner'] ?? null,
                'acres' => $d['acres'] ?? null, 'lawn' => $d['lawn'] ?? null, 'trees' => $d['trees'] ?? null, 'val' => $d['val'] ?? null, 'lat' => $d['lat'] ?? null, 'lon' => $d['lon'] ?? null,
                'yb' => null, 'bsf' => null, 'lookup' => true, 'rent' => !empty($d['rent']), 'hand' => loadLawnHand($k0)[$id] ?? null, 'range' => lawnRangeCache()[$k0 . '/' . $id] ?? null,
                'checks' => array_values(array_map(fn($r) => array_intersect_key($r, array_flip(['v', 'sq', 'by', 'at'])), array_filter(readLines(DATA_DIR . '/lawncheck.log'), fn($r) => ($r['region'] ?? '') === $key && $r['id'] === $id)))];
    }
    return null;
}
/* ---- a house pulled in on request (2026-10-16, Matthew: "build a one off search like we have for joe and just have it be a button
 * they can press and you'll pull that data and measure the lawns"; "we definitely need to prioritize getting as much properties in our
 * system as possible") ----
 * Search found nothing: Pull this property runs sixfold-tools/prop-pull/pull-property.mjs here on the server (the state parcel map,
 * the 2023 photo and the app's lawn classifier, the wildfire class; about 15 s) and keeps the house in the 'looked-up' town's lookup
 * list, so it is found by search and opens in the quote builder like any house, and is never a town on anyone's list (that town has
 * no neighbourhoods). An address already on our lists answers with that house instead. Each pull is logged in prop-pulls.log. */
const LOOKED_UP = 'looked-up';
if ($action === 'proppull') {
    if (!feature('walkdesk') || !$isPost || !in_array($role, ['admin', 'office', 'quote', 'manager', 'crew'], true)) fail('Not allowed.', 403);
    $street = $clean($body['address'] ?? '', 120); $town = $clean($body['town'] ?? '', 60);
    if ($town === '' && strpos($street, ',') !== false) { $pp = array_map('trim', explode(',', $street)); $street = $pp[0]; $town = $pp[1] ?? ''; }
    if (!preg_match('/^\d+\s+\S/', $street)) fail('Type the house number and the street.');
    if (!preg_match("/^\\p{L}[\\p{L} .'-]{1,59}$/u", $town)) fail('Add the town.');
    if ($h = a365Match($street, $town)) out(['ok' => true, 'had' => true, 'house' => ['region' => $h['region'], 'id' => $h['door'], 'address' => $h['address'], 'town' => $h['town']]]);
    if (!throttleTake(rateFile('proppull|' . $me), 40, 3600)) fail('That is a lot of lookups in an hour. Try again later.', 429);
    $script = dirname(__DIR__, 2) . '/sixfold-tools/prop-pull/pull-property.mjs';
    if (!is_file($script) || !function_exists('proc_open')) fail('Property lookups are not set up on this server.', 503);
    $node = is_file('/usr/local/bin/node') ? '/usr/local/bin/node' : 'node';
    @set_time_limit(115);
    $proc = @proc_open([$node, $script, '--address', $street, '--town', $town], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, dirname($script));
    if (!is_resource($proc)) fail('The lookup did not start. Try again.', 500);
    stream_set_blocking($pipes[1], false); $outTxt = ''; $t0 = time();
    while (time() - $t0 < 95) { $r = [$pipes[1]]; $w = null; $e = null; if (@stream_select($r, $w, $e, 1) > 0) { $chunk = fread($pipes[1], 65536); if ($chunk === '' || $chunk === false) { if (feof($pipes[1])) break; } else $outTxt .= $chunk; } elseif (!proc_get_status($proc)['running']) { $outTxt .= (string) stream_get_contents($pipes[1]); break; } }
    if (proc_get_status($proc)['running']) proc_terminate($proc);
    fclose($pipes[1]); fclose($pipes[2]); proc_close($proc);
    $lines = array_values(array_filter(explode("\n", trim($outTxt)))); $res = $lines ? json_decode((string) end($lines), true) : null;
    appendLine(DATA_DIR . '/prop-pulls.log', ['by' => $me, 'at' => time(), 'address' => $street, 'town' => $town, 'ok' => !empty($res['ok']), 'error' => is_array($res) ? ($res['error'] ?? null) : 'no answer']);
    if (!is_array($res)) fail('The lookup took too long. Try again in a minute.', 504);
    if (empty($res['ok']) || !is_array($res['door'] ?? null)) fail((string) ($res['error'] ?? 'The lookup failed.'));
    $D = $res['door']; $id = (string) ($D['id'] ?? '');
    if (!preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('The lookup came back without an address.');
    $lw = is_array($D['lawn'] ?? null) && in_array($D['lawn']['lv'] ?? '', ['N', 'S', 'M', 'L', 'T'], true) ? ['lv' => $D['lawn']['lv'], 'sq' => (int) ($D['lawn']['sq'] ?? 0), 'yr' => (int) ($D['lawn']['yr'] ?? 0)] : null;
    /* the laser tree reading (2026-10-22, pull-trees.mjs), the same shape as the towns' */
    $sh = fn($v) => is_numeric($v) && $v >= 0 && $v <= 1 ? round((float) $v, 2) : null; $T0 = $D['trees'] ?? null;
    $tr = is_array($T0) && $sh($T0['z2'] ?? null) !== null ? ['z1' => $sh($T0['z1'] ?? null), 'z2' => $sh($T0['z2']), 'z3' => $sh($T0['z3'] ?? null), 'h' => (int) ($T0['h'] ?? 0), 'src' => 'lidar', 'yr' => (int) ($T0['yr'] ?? 0), 'house' => 'laser'] : null;
    $door = ['id' => $id, 'address' => mb_substr((string) $D['address'], 0, 120), 'acres' => is_numeric($D['acres'] ?? null) ? (float) $D['acres'] : null, 'owner' => mb_substr((string) ($D['owner'] ?? ''), 0, 120),
             'lat' => (float) ($D['lat'] ?? 0), 'lon' => (float) ($D['lon'] ?? 0), 'fire' => is_numeric($D['fire'] ?? null) ? (int) $D['fire'] : null, 'lawn' => $lw, 'trees' => $tr,
             'val' => is_numeric($D['val'] ?? null) ? (int) $D['val'] : null, 'town' => mb_substr((string) (($D['town'] ?? '') ?: $town), 0, 60), 'pulled' => ['by' => $me, 'at' => time()]];
    $rf = DATA_DIR . '/' . LOOKED_UP . '.json';
    if (!is_file($rf)) writeJsonAtomic($rf, ['key' => LOOKED_UP, 'label' => 'Looked up', 'built' => date('Y-m-d'), 'areas' => []]);
    $lf = DATA_DIR . '/' . LOOKED_UP . '-lookup.json'; $fh = @fopen($lf, 'c+');
    if (!$fh || !flock($fh, LOCK_EX)) fail('Could not save that house. Try again.', 500);
    $cur = json_decode((string) stream_get_contents($fh), true); if (!is_array($cur) || !is_array($cur['doors'] ?? null)) $cur = ['key' => LOOKED_UP, 'doors' => []];
    $cur['doors'] = array_values(array_filter($cur['doors'], fn($d) => ($d['id'] ?? '') !== $id)); $cur['doors'][] = $door; $cur['built'] = date('Y-m-d');
    ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($cur, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)); fflush($fh); flock($fh, LOCK_UN); fclose($fh);
    $ixf = DATA_DIR . '/index.json'; $ix = json_decode((string) @file_get_contents($ixf), true);
    if (is_array($ix) && !in_array(LOOKED_UP, array_column((array) ($ix['regions'] ?? []), 'key'), true)) { $ix['regions'][] = ['key' => LOOKED_UP, 'label' => 'Looked up', 'c' => [round($door['lat'], 4), round($door['lon'], 4)], 'areas' => 0, 'doors' => 0]; writeJsonAtomic($ixf, $ix); }
    out(['ok' => true, 'house' => ['region' => LOOKED_UP, 'id' => $id, 'address' => $door['address'], 'town' => $door['town']], 'lawn' => $lw]);
}
if (in_array($action, ['a365house', 'leadhouse', 'leadask', 'lawncheck'], true) && !feature('walkdesk')) fail('Not here.', 404);
if ($action === 'a365house') {
    if (!desk() && $role !== 'quote') fail('Not allowed.', 403);
    $h = houseFacts((string) ($_GET['region'] ?? ''), (string) ($_GET['id'] ?? ''));
    if (!$h) fail('No such house.', 404);
    out(['ok' => true, 'house' => $h]);
}
/* change a lead's name, phone or email (2026-10-15: the Quick quote reused a lead by its phone number and sent the form to its old email);
   what changed goes on the lead as a note */
if ($action === 'a365mailsigned') {   /* "Email them the signed copy" on a signed lead */
    if (!feature('walkdesk') || (!desk() && $role !== 'quote') || !$isPost) fail('Not allowed.', 403);
    $l = leadsAll()[(string) ($body['id'] ?? '')] ?? null;
    if (!$l || empty($l['signed']) || empty($l['sign'])) fail('This lead has no signed form.', 404);
    $sg = $l['signed'] + ['facts' => [], 'terms' => []];
    $r = a365SendSigned($l, $sg, $me);
    if (!$r['ok']) fail($r['stage'] === 'noemail' ? 'There is no email on the lead. Add it first.' : ($r['stage'] === 'config' ? 'The 365 mailbox is not set up yet.' : 'It did not send (' . $r['stage'] . '). Try again.'));
    out(['ok' => true, 'to' => $r['to']]);
}
if ($action === 'leadcontact') {
    if (!feature('walkdesk') || (!desk() && $role !== 'quote')) fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $all = leadsAll();
    if (!leadOk($id) || !isset($all[$id])) fail('No such lead.', 404);
    $L = $all[$id]; $ch = []; $said = [];
    foreach (['name' => 120, 'phone' => 40, 'email' => 160] as $k => $max) {
        if (!array_key_exists($k, $body)) continue;
        $v = $clean($body[$k] ?? '', $max); if ($v === '' || $v === (string) ($L[$k] ?? '')) continue;
        if ($k === 'email' && !filter_var($v, FILTER_VALIDATE_EMAIL)) fail('That email does not look right.');
        if ($k === 'phone' && strlen((string) preg_replace('/\D/', '', $v)) < 10) fail('That phone number looks too short.');
        $ch[$k] = $v; $said[] = $k . ' ' . ((string) ($L[$k] ?? '') !== '' ? (string) $L[$k] . ' → ' : '') . $v;
    }
    if (!$ch) out(['ok' => true, 'same' => true]);
    if (!appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'contact' => $ch, 'note' => mb_substr('Changed: ' . implode('; ', $said), 0, 500), 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'changed' => array_keys($ch)]);
}
if ($action === 'leadhouse' || $action === 'leadask') {
    if (!desk() && !($role === 'quote' && $action === 'leadhouse')) fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $all = leadsAll();
    if (!leadOk($id) || !isset($all[$id])) fail('No such lead.', 404);
    if ($action === 'leadhouse') {
        if (!empty($body['clear'])) $row = ['id' => $id, 'house' => null, 'by' => $me, 'at' => time()];
        elseif (is_array($body['typed'] ?? null)) {   /* an address not on our property lists yet, typed by hand (2026-10-15, Matthew: Christopher's address) */
            $ta = $clean($body['typed']['address'] ?? '', 120); $tt = $clean($body['typed']['town'] ?? '', 60);
            if (!preg_match('/^\d{1,6}[A-Za-z]?\s+\S/', $ta)) fail('Type the house number and street, e.g. 1840 Ponderosa Dr.');
            if (mb_strlen($tt) < 2) fail('Type the town.');
            $row = ['id' => $id, 'house' => ['address' => $ta, 'town' => $tt, 'typed' => true], 'note' => 'Address added by hand (not on our property lists yet): ' . $ta . ', ' . $tt . '.', 'by' => $me, 'at' => time()];
        } else {
            $h = houseFacts((string) ($body['region'] ?? ''), (string) ($body['door'] ?? ''));
            if (!$h) fail('No such house.', 404);
            $row = ['id' => $id, 'house' => ['region' => $h['region'], 'door' => $h['id'], 'address' => $h['address'], 'town' => $h['town']], 'by' => $me, 'at' => time()];
        }
    } else {
        $ask = ['size' => $clean($body['size'] ?? '', 80), 'parts' => array_values(array_intersect((array) ($body['parts'] ?? []), ['front', 'back', 'side'])),
                'water' => in_array($body['water'] ?? '', ['yes', 'no', 'some'], true) ? $body['water'] : '', 'last' => $clean($body['last'] ?? '', 60), 'note' => $clean($body['note'] ?? '', 300)];
        if ($ask['size'] === '' && !$ask['parts'] && $ask['water'] === '' && $ask['last'] === '' && $ask['note'] === '') fail('Nothing to save.');
        $row = ['id' => $id, 'ask' => $ask, 'by' => $me, 'at' => time()];
    }
    if (!appendLine(leadsDir() . '/leadst.log', $row)) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
/* Brad on the day (or the office): was the lawn about the size we had? right / bigger / smaller, with his own figure if he has one */
if ($action === 'lawncheck') {
    if (!$isPost) fail('POST required', 405);
    if (!desk() && !in_array($me, walkerList(), true) && !array_filter(jobsAll(), fn($j) => !$j['off'] && $j['crew'] === $me)) fail('Not allowed.', 403);   /* walkers, and whoever has been given a job */
    $h = houseFacts((string) ($body['region'] ?? ''), (string) ($body['id'] ?? ''));
    if (!$h) fail('No such house.', 404);
    $v = (string) ($body['v'] ?? ''); if (!in_array($v, ['right', 'bigger', 'smaller'], true)) fail('Say whether it was right, bigger or smaller.');
    $sq = (int) ($body['sq'] ?? 0); if ($sq < 0 || $sq > 500000) fail('That lawn size does not look right.');
    $row = ['id' => $h['id'], 'region' => $h['region'], 'v' => $v, 'sq' => $sq ?: null, 'ours' => $h['lawn']['sq'] ?? null, 'trees' => $h['trees'] ?? null, 'by' => $me, 'at' => time()];
    if (!appendLine(DATA_DIR . '/lawncheck.log', $row)) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
/* ---- the quote generator (2026-10-14, 365 Aeration & Seeding; Brandon: "use Bryce's pricing, adjusted to Colorado") ----
 * The price follows Bryce's ladder: $399 for about 2,500 sq ft of lawn, scaling with the square root of the lawn (his $1,200 acre lot,
 * about 22,000 sq ft of grass, lands at $1,199), never under the minimum, rounded to his "...99" steps. Seed goes down at 2 to 4 lb per
 * 1,000 sq ft (Bryce's range; CSU says 3 to 4 after aeration), more seed when the customer pays more. Costs and margins show once the
 * bag prices are filled in. Kept in a365-pricing.json beside the door files: the office reads it, an admin changes it; never public. */
const A365_PRICING = ['minPrice' => 299, 'anchorSq' => 2500, 'anchorPrice' => 399, 'power' => 0.5, 'seedLow' => 2, 'seedBase' => 3, 'seedHigh' => 4,
    'seedBagCost' => 128.89, 'seedBagLb' => 50, 'seedName' => '', 'seedSrc' => 'his SiteOne receipt dated 24 Jul 2026',   /* no brand shown (2026-10-21, Matthew) */   /* SiteOne Englewood invoice 2026-07-24: 6 x LESCO Tuf-Turf 50 lb, $773.34 with tax */
    'fertBagCost' => null, 'fertBagLb' => null, 'fertRate' => null, 'aerateOnly' => null, 'deposit' => 50,
    /* 2026-10-15 (Matthew): fertilizer from the bag (price per lb x the lb its label says covers the lawn), Jen picks the brand of the day;
       Bryce gave no rate per sq ft, only "$25 in fertilizer" on a $399 job. Travel: the drive from the storage at 333 W Hampden Ave,
       there and back, at an 18 mpg truck and the week's Denver gas price (EIA). */
    'fertDefault' => 'fert', 'mpg' => 18, 'roadFactor' => 1.3,
    'crewShare' => 0.2,
    /* the aerator's gas (2026-10-21, Matthew): Bobcat AE26-HON, Honda GX120 at 1.0 L/h at full power (0.2642 gal; Honda's figure as its dealers
       publish it), up to 40,400 sq ft an hour (Bobcat). aerPace = the share of Bobcat's top rate a real job manages (1 = Bobcat's figure). */
    'aerGalHr' => 0.2642, 'aerSqHr' => 40400, 'aerPace' => 1.0];   /* the crew: 20% of every job's price (Matthew, 2026-10-21: "a 20% employee cost to every job") */
const A365_FERTS = [   /* one fertilizer at Brandon's price (2026-10-21, Matthew: "Remove the 3 fertilizers"); spread at the LESCO 24-0-11 label rate */
    ['k' => 'fert', 'name' => 'Fertilizer', 'bagLb' => 50, 'bagCost' => 40, 'coverSq' => 12000,
     'src' => 'Brandon’s price: $40 for a 50 lb bag (21 Oct 2026). Spread at 12,000 sq ft per bag, the LESCO 24-0-11 label rate.']];
function a365Pricing(): array {
    $j = json_decode((string) @file_get_contents(DATA_DIR . '/a365-pricing.json'), true);
    $o = A365_PRICING; if (is_array($j)) foreach ($o as $k => $v) if (array_key_exists($k, $j) && ($j[$k] === null || is_int($j[$k]) || is_float($j[$k]))) $o[$k] = $j[$k];
    if (is_array($j) && is_string($j['seedName'] ?? null) && trim($j['seedName']) !== '') $o['seedName'] = trim($j['seedName']);
    if (is_array($j) && is_string($j['seedSrc'] ?? null) && trim($j['seedSrc']) !== '') $o['seedSrc'] = trim($j['seedSrc']);   /* the seed in use, shown beside the fertilizer (2026-10-15) */
    $o['ferts'] = is_array($j) && !empty($j['ferts']) && is_array($j['ferts']) ? $j['ferts'] : A365_FERTS;
    if (is_array($j) && is_string($j['fertDefault'] ?? null)) $o['fertDefault'] = $j['fertDefault'];
    return $o;
}
/** the week's Denver regular gasoline price (EIA's weekly retail survey, public), kept a day; the last good one if EIA cannot be reached */
function a365Gas(): ?array {
    $f = DATA_DIR . '/gas-denver.json'; $c = json_decode((string) @file_get_contents($f), true);
    if (is_array($c) && ($c['fetched'] ?? 0) > time() - 86400) return $c;
    $html = null;
    if (function_exists('curl_init')) {
        $h = curl_init('https://www.eia.gov/dnav/pet/pet_pri_gnd_dcus_yden_w.htm');
        curl_setopt_array($h, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_FOLLOWLOCATION => true, CURLOPT_USERAGENT => 'Mozilla/5.0 (365 quote; gas price)']);
        $html = curl_exec($h); if ((int) curl_getinfo($h, CURLINFO_HTTP_CODE) !== 200) $html = null; curl_close($h);
    }
    $flat = is_string($html) ? preg_replace('/\|+/', '|', preg_replace('/\s+/', '|', strip_tags(str_replace('<', '|<', $html)))) : '';
    if ($flat !== '' && preg_match('/\|Regular\|((?:\d\.\d{3}\|){1,10})/', $flat, $m, PREG_OFFSET_CAPTURE)) {
        $vals = array_values(array_filter(explode('|', $m[1][0]), 'strlen'));
        preg_match_all('#\b(\d{2})/(\d{2})/(\d{2})\b#', substr($flat, 0, $m[0][1]), $d, PREG_SET_ORDER);
        $d = array_slice($d, -count($vals));
        $last = end($d);
        $o = ['price' => (float) end($vals), 'week' => $last ? '20' . $last[3] . '-' . $last[1] . '-' . $last[2] : null, 'fetched' => time(),
              'src' => 'U.S. Energy Information Administration, Denver regular gasoline, weekly'];
        if ($o['price'] > 1 && $o['price'] < 10) { @file_put_contents($f, json_encode($o), LOCK_EX); return $o; }
    }
    return is_array($c) ? $c : null;
}
if (in_array($action, ['a365pricing', 'a365pricingset', 'a365calc', 'leadquote'], true) && (!feature('walkdesk') || !company()['a365'])) fail('Not here.', 404);
if ($action === 'a365pricing') {
    if (!desk() && $role !== 'quote') fail('Not allowed.', 403);
    if ($role === 'office' || $role === 'quote') { $pp = a365Pricing(); out(['ok' => true, 'pricing' => ['hidden' => true, 'seedName' => $pp['seedName'], 'fertDefault' => $pp['fertDefault'], 'ferts' => array_map(fn($f) => ['k' => $f['k'], 'name' => $f['name']], $pp['ferts'])]]); }   /* the math stays here (Matthew 2026-10-15: "hide the internal math") */
    $j = json_decode((string) @file_get_contents(DATA_DIR . '/a365-pricing.json'), true);
    out(['ok' => true, 'pricing' => a365Pricing(), 'gas' => a365Gas(), 'by' => is_array($j) ? ($j['_by'] ?? null) : null, 'at' => is_array($j) ? ($j['_at'] ?? null) : null]);
}
/* the quote worked out here, for anyone who must not see how (the office, quote-only accounts, an admin looking as the office):
   the price for the lawn and the drive, and the seed and fertilizer pounds; never the costs or the formula */
function a365ListPrice(int $sq, array $P): int { $x = $P['anchorPrice'] * pow(max($sq, 1) / $P['anchorSq'], $P['power']); return (int) max($P['minPrice'], round($x / 100) * 100 - 1); }
if ($action === 'a365calc') {
    if (!desk() && $role !== 'quote') fail('Not allowed.', 403);
    $P = a365Pricing(); $sq = max(0, min(1000000, (int) ($_GET['sq'] ?? 0))); $pkg = ($_GET['pkg'] ?? 'full') === 'aerate' ? 'aerate' : 'full';
    $drive = 0.0; $hasDrive = false;
    $reg = (string) ($_GET['region'] ?? ''); $hid = (string) ($_GET['id'] ?? '');
    if ($reg !== '' && $hid !== '' && preg_match('/^[a-z0-9-]{1,80}$/D', $hid)) {
        $hf = houseFacts($reg, $hid); $B = company()['a365']['base'] ?? null; $gas = a365Gas();
        if ($hf && isset($hf['lat'], $hf['lon']) && $B && $gas && !empty($gas['price'])) {
            $rad = M_PI / 180; $dl = ($hf['lat'] - $B[0]) * $rad; $dn = ($hf['lon'] - $B[1]) * $rad;
            $a = sin($dl / 2) ** 2 + cos($B[0] * $rad) * cos($hf['lat'] * $rad) * sin($dn / 2) ** 2; $mi = 3958.8 * 2 * atan2(sqrt($a), sqrt(1 - $a));
            $drive = $mi * (float) ($P['roadFactor'] ?: 1.3) * 2 / (float) ($P['mpg'] ?: 18) * (float) $gas['price']; $hasDrive = true;
        }
    }
    $ladder = $pkg === 'aerate' ? 0 : a365ListPrice($sq, $P) + (int) ceil($drive);
    $want = (int) ($_GET['price'] ?? 0); $price = $want > 0 ? min($want, 100000) : $ladder;
    $seedLb = 0.0; $fertLb = 0.0; $fName = '';
    if ($pkg === 'full' && $sq > 0) {
        $rate = max($P['seedLow'], min($P['seedHigh'], $P['seedBase'] * $price / max($ladder, 1)));
        $seedLb = round($sq / 1000 * $rate, 1);
        $fk = (string) ($_GET['fert'] ?? ''); $F = null; foreach ($P['ferts'] as $f) if ($f['k'] === $fk) $F = $f; if (!$F) foreach ($P['ferts'] as $f) if ($f['k'] === $P['fertDefault']) $F = $f; if (!$F) $F = $P['ferts'][0] ?? null;
        if ($F && $F['coverSq'] > 0) { $fertLb = round($sq / 1000 * ($F['bagLb'] * 1000 / $F['coverSq']), 1); $fName = (string) $F['name']; }
    }
    /* what is left after seed, fertilizer, the drive and the crew's share (2026-10-21): the total only, never the parts (Matthew 2026-10-15) */
    $gasNow = a365Gas(); $aerGas = ($sq > 0 && $gasNow && !empty($gasNow['price']) && (float) $P['aerSqHr'] > 0) ? $sq / ((float) $P['aerSqHr'] * max(0.05, (float) $P['aerPace'])) * (float) $P['aerGalHr'] * (float) $gasNow['price'] : 0.0;   /* the aerator's gas (2026-10-21) */
    $cost = $drive + $aerGas + ($P['seedBagLb'] ? $seedLb * $P['seedBagCost'] / $P['seedBagLb'] : 0) + $price * (float) ($P['crewShare'] ?? 0);
    if ($fertLb > 0) foreach ($P['ferts'] as $f) if ($f['name'] === $fName && $f['bagLb'] > 0) $cost += $fertLb * $f['bagCost'] / $f['bagLb'];
    out(['ok' => true, 'ladder' => $ladder, 'price' => $price, 'seedLb' => $seedLb, 'fertLb' => $fertLb, 'fertName' => $fName, 'drive' => $hasDrive, 'crewPct' => (int) round(100 * (float) ($P['crewShare'] ?? 0)), 'aerGas' => round($aerGas, 2), 'left' => $price ? (int) round($price - $cost) : null]);
}
/* ---- the field quick quote (2026-10-21, Matthew: "Christian needs access to a quick quote system. he just needs it so that he can give the
 * person a accurate estimate, so it needs limited functions ... if the person approved have him click a button that says send to office. And
 * the leads will come up on our end so we can do the documentation and the payments. Give bris account the same functions.") ----
 * A crew account with the "Quick quote" setting (acctflag fq) finds the house, sees the lawn size we hold (and changes it if the lawn in front
 * of them is bigger or smaller) and the price, worked out here exactly as the office's quote builder does for Aerate, seed & feed; never the
 * costs. When the customer says yes: their name and phone, Send to office. That files (or finds) the lead, keeps the quote on it, marks it
 * said yes in person, and alerts the office; the office sends the form and takes the payment from there. */
function fqOn(): bool { global $role, $session; return !empty(company()['a365']) && ($role === 'admin' || (in_array($role, ['crew', 'manager'], true) && acctFlag('fq', (string) ($session['c'] ?? '')))); }
/** the lawn to quote: a hand measure if there is one, else the middle of the photo's range (the quote builder's lawnEstimate) */
function fqSize(array $h): array {
    if (!empty($h['hand']['sq'])) return ['sq' => (int) $h['hand']['sq'], 'say' => 'Measured by hand.'];
    $L = is_array($h['lawn'] ?? null) ? $h['lawn'] : []; $sq = (int) ($L['sq'] ?? 0); $tc = (float) ($h['trees']['z2'] ?? 0);
    if (($L['lv'] ?? '') === 'N' || !$sq) return ['sq' => 0, 'say' => ($L['lv'] ?? '') === 'N' ? 'No green lawn in the 2023 photo. Look at it and type the size.' : 'No lawn size on file. Pace it out or ask them, and type it.'];
    [$lo, $hi, $say] = (($L['lv'] ?? '') === 'T' || $tc >= 0.35) ? [0.95, 1.5, 'Lots of trees: the photo misses lawn under them. Look and change it if needed.'] : ($tc >= 0.2 ? [0.9, 1.25, 'Some trees over the lawn: check it.'] : [0.85, 1.0, 'Open lot: the photo is close.']);
    $r = fn($x) => max(100, (int) round($x / 100) * 100); $a = $r($sq * $lo); $b = $r($sq * $hi);
    if (!empty($h['yb']) && (int) $h['yb'] >= 2023) $say = 'The house is newer than the 2023 photo: check the lawn.';
    return ['sq' => $r(($a + $b) / 2), 'say' => $say];
}
/** the price for Aerate, seed & feed: the quote builder's ladder plus the drive from the storage (a365calc), with the seed and fertilizer pounds */
function fqPrice(int $sq, ?array $hf): array {
    $P = a365Pricing(); $drive = 0.0; $B = company()['a365']['base'] ?? null; $gas = a365Gas();
    if ($hf && isset($hf['lat'], $hf['lon']) && $B && $gas && !empty($gas['price'])) {
        $rad = M_PI / 180; $dl = ($hf['lat'] - $B[0]) * $rad; $dn = ($hf['lon'] - $B[1]) * $rad;
        $a = sin($dl / 2) ** 2 + cos($B[0] * $rad) * cos($hf['lat'] * $rad) * sin($dn / 2) ** 2; $mi = 3958.8 * 2 * atan2(sqrt($a), sqrt(1 - $a));
        $drive = $mi * (float) ($P['roadFactor'] ?: 1.3) * 2 / (float) ($P['mpg'] ?: 18) * (float) $gas['price'];
    }
    $price = a365ListPrice($sq, $P) + (int) ceil($drive);
    $seedLb = $sq > 0 ? round($sq / 1000 * max($P['seedLow'], min($P['seedHigh'], $P['seedBase'])), 1) : 0.0; $fertLb = 0.0;
    $F = null; foreach ($P['ferts'] as $f) if ($f['k'] === $P['fertDefault']) $F = $f; if (!$F) $F = $P['ferts'][0] ?? null;
    if ($F && $sq > 0 && $F['coverSq'] > 0) $fertLb = round($sq / 1000 * ($F['bagLb'] * 1000 / $F['coverSq']), 1);
    return ['price' => $price, 'seedLb' => $seedLb, 'fertLb' => $fertLb];
}
if (in_array($action, ['fqhouse', 'fqcalc', 'fqsend', 'fqmine'], true) && (!feature('walkdesk') || !fqOn())) fail('Not allowed.', 403);
if ($action === 'fqhouse') {
    $h = houseFacts((string) ($_GET['region'] ?? ''), (string) ($_GET['id'] ?? ''));
    if (!$h) fail('No such house.', 404);
    $sz = fqSize($h);
    out(['ok' => true, 'house' => ['region' => $h['region'], 'id' => $h['id'], 'address' => $h['address'], 'town' => $h['town']], 'sq' => $sz['sq'], 'say' => $sz['say'], 'price' => $sz['sq'] > 0 ? fqPrice($sz['sq'], $h)['price'] : null]);
}
if ($action === 'fqcalc') {
    $sq = (int) ($_GET['sq'] ?? 0); if ($sq < 100 || $sq > 500000) fail('Type the lawn size in square feet.');
    $reg = (string) ($_GET['region'] ?? ''); $hid = (string) ($_GET['id'] ?? '');
    $h = $reg !== '' && $hid !== '' ? houseFacts($reg, $hid) : null;
    out(['ok' => true, 'price' => fqPrice($sq, $h)['price']]);
}
if ($action === 'fqsend') {
    if (!$isPost) fail('POST required', 405);
    $sq = (int) ($body['sq'] ?? 0); if ($sq < 100 || $sq > 500000) fail('Type the lawn size in square feet.');
    $name = $clean($body['name'] ?? '', 120); $phone = $clean($body['phone'] ?? '', 40); $email = $clean($body['email'] ?? '', 160); $note = $clean($body['note'] ?? '', 300);
    if ($name === '') fail('Add their name.');
    if (strlen((string) preg_replace('/\D/', '', $phone)) < 10) fail('Add their phone number, so the office can reach them.');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('That email does not look right.');
    $reg = (string) ($body['region'] ?? ''); $hid = (string) ($body['id'] ?? ''); $h = null; $house = null;
    if ($reg !== '' || $hid !== '') {
        $h = houseFacts($reg, $hid); if (!$h) fail('No such house.', 404);
        $house = ['region' => $h['region'], 'door' => $h['id'], 'address' => $h['address'], 'town' => $h['town']]; $addr = streetCaseServer((string) $h['address']) . ', ' . streetCaseServer(houseTown($house));
    } else {
        $ta = $clean($body['address'] ?? '', 120); $tt = $clean($body['town'] ?? '', 60);
        if (!preg_match('/^\d{1,6}[A-Za-z]?\s+\S/', $ta)) fail('Type the house number and street.');
        if (mb_strlen($tt) < 2) fail('Type the town.');
        $house = ['address' => $ta, 'town' => $tt, 'typed' => true]; $addr = $ta . ', ' . $tt;
    }
    if (!throttleTake(rateFile('fqsend|' . $me), 60, 86400)) fail('That is a lot of quotes sent today. Call the office.', 429);
    $pr = fqPrice($sq, $h); $now = time();
    $q = ['price' => $pr['price'], 'pkg' => 'full', 'sq' => $sq, 'seedLb' => $pr['seedLb'], 'fertLb' => $pr['fertLb'], 'note' => '', 'sent' => false, 'field' => $me];
    $acc = ['price' => $pr['price'], 'note' => $note, 'by' => $me, 'field' => 1];
    $say = 'Said yes in person to ' . $me . ': $' . $pr['price'] . ' for Aerate, seed & feed, lawn about ' . number_format($sq) . ' sq ft, ' . $addr . '.' . ($note !== '' ? ' "' . $note . '"' : '');
    /* someone already here: the same phone or email on an open lead (or under Couldn't reach) keeps them, rather than a second lead */
    [$d, $e] = contactKey($phone, $email); $ex = null;
    foreach (leadsAll() as $x) {
        if (!in_array((string) ($x['status'] ?? 'new'), ['new', 'contacted', 'walk', 'quoted', 'hold', 'unreached'], true) || !empty($x['signed'])) continue;
        [$xd, $xe] = contactKey((string) ($x['phone'] ?? ''), (string) ($x['email'] ?? ''));
        if ((strlen($d) === 10 && $xd === $d) || ($e !== '' && $xe === $e)) { $ex = $x; break; }
    }
    if ($ex) {
        $id = (string) $ex['id'];
        if (($ex['status'] ?? '') === 'unreached') leadRevive($id, 'said yes in person to ' . $me, $me);
        $row = ['id' => $id, 'quote' => $q, 'accept' => $acc, 'status' => 'quoted', 'note' => mb_substr($say, 0, 500), 'by' => $me, 'at' => $now];
        if (empty($ex['house']) || !empty($ex['house']['typed'])) $row['house'] = $house;
        if (trim((string) ($ex['email'] ?? '')) === '' && $email !== '') $row['contact'] = ['email' => $email];
    } else {
        $id = 'm' . date('YmdHis') . bin2hex(random_bytes(3));
        if (!appendLine(leadsDir() . '/leads.log', ['id' => $id, 'src' => 'door', 'at' => $now, 'need' => 'Aerate, seed & feed', 'name' => $name, 'phone' => $phone, 'email' => $email, 'town' => $addr, 'msg' => $note, 'by' => $me])) fail('Could not save that. Try again.', 500);
        $row = ['id' => $id, 'house' => $house, 'quote' => $q, 'accept' => $acc, 'status' => 'quoted', 'note' => mb_substr($say, 0, 500), 'by' => $me, 'at' => $now];
    }
    if (!appendLine(leadsDir() . '/leadst.log', $row)) fail('Could not save that. Try again.', 500);
    a365Alert('Said yes to ' . $me, $name . ' · $' . $pr['price'] . ' · ' . $addr . ': send the form and take the deposit', true);
    out(['ok' => true, 'id' => $id, 'price' => $pr['price'], 'had' => (bool) $ex]);
}
if ($action === 'fqmine') {   /* what they have sent to the office, the last two weeks */
    $cut = time() - 14 * 86400; $jobOf = []; foreach (jobsAll() as $jj) if (!$jj['off']) $jobOf[(string) $jj['lead']] = $jj;
    $list = [];
    foreach (leadsAll() as $l) {
        $a = $l['accept'] ?? null; if (!is_array($a) || ($a['by'] ?? '') !== $me || (int) ($a['at'] ?? 0) < $cut) continue;
        $st = isset($jobOf[$l['id']]) ? 'Booked ' . deskWhen((string) $jobOf[$l['id']]['date'], '') : (!empty($l['signed']) ? 'Signed' : (!empty($l['sign']) ? 'Form sent' : (($l['status'] ?? '') === 'lost' ? 'Did not go ahead' : 'With the office')));
        $list[] = ['name' => (string) ($l['name'] ?? ''), 'price' => (int) ($a['price'] ?? 0), 'at' => (int) $a['at'], 'addr' => $l['house'] ? streetCaseServer((string) $l['house']['address']) : (string) ($l['town'] ?? ''), 'state' => $st];
    }
    usort($list, fn($x, $y) => $y['at'] <=> $x['at']);
    out(['ok' => true, 'sent' => array_slice($list, 0, 30)]);
}
if ($action === 'a365pricingset') {
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $lim = ['minPrice' => [1, 100000], 'anchorSq' => [100, 1000000], 'anchorPrice' => [1, 100000], 'power' => [0.1, 1], 'seedLow' => [0, 20], 'seedBase' => [0, 20], 'seedHigh' => [0, 20],
            'seedBagCost' => [0, 10000], 'seedBagLb' => [1, 1000], 'fertBagCost' => [0, 10000], 'fertBagLb' => [1, 1000], 'fertRate' => [0, 50], 'aerateOnly' => [1, 100], 'deposit' => [0, 100000], 'mpg' => [5, 60], 'roadFactor' => [1, 3], 'crewShare' => [0, 1], 'aerGalHr' => [0, 5], 'aerSqHr' => [1000, 500000], 'aerPace' => [0.05, 1]];
    $p = a365Pricing();
    foreach ($lim as $k => [$lo, $hi]) {
        if (!array_key_exists($k, $body)) continue;
        $v = $body[$k];
        if ($v === null || $v === '') { if (in_array($k, ['seedBagLb', 'fertBagCost', 'fertBagLb', 'fertRate', 'aerateOnly'], true)) { $p[$k] = null; continue; } fail('Give ' . $k . ' a number.'); }
        if (!is_numeric($v) || (float) $v < $lo || (float) $v > $hi) fail('That number for ' . $k . ' is out of range.');
        $p[$k] = (float) $v == (int) $v ? (int) $v : round((float) $v, 4);
    }
    if (!($p['seedLow'] <= $p['seedBase'] && $p['seedBase'] <= $p['seedHigh'])) fail('Seed rates must go low, base, high.');
    if (array_key_exists('ferts', $body)) {   /* the fertilizer brands: name, bag weight, bag price, what one bag covers */
        if (!is_array($body['ferts']) || count($body['ferts']) > 12) fail('Check the fertilizer list.');
        $fl = [];
        foreach ($body['ferts'] as $i => $x) {
            $nm = $clean($x['name'] ?? '', 60); if ($nm === '') continue;
            $lb = (float) ($x['bagLb'] ?? 0); $co = (float) ($x['bagCost'] ?? -1); $cv = (int) ($x['coverSq'] ?? 0);
            if ($lb <= 0 || $lb > 1000 || $co < 0 || $co > 10000 || $cv < 100 || $cv > 1000000) fail('Fill in the bag weight, price and coverage for ' . $nm . '.');
            $k = preg_replace('/[^a-z0-9]+/', '-', strtolower((string) ($x['k'] ?? '') ?: $nm)); $k = trim($k, '-') ?: 'f' . $i;
            $fl[] = ['k' => substr($k, 0, 30), 'name' => $nm, 'bagLb' => round($lb, 2), 'bagCost' => round($co, 2), 'coverSq' => $cv, 'src' => $clean($x['src'] ?? '', 200)];
        }
        if (!$fl) fail('Keep at least one fertilizer.');
        $p['ferts'] = $fl;
    }
    if (array_key_exists('fertDefault', $body)) $p['fertDefault'] = (string) $body['fertDefault'];
    if (array_key_exists('seedName', $body)) { $sn = $clean($body['seedName'] ?? '', 80); if ($sn !== '') $p['seedName'] = $sn; }
    if (!in_array($p['fertDefault'], array_column($p['ferts'], 'k'), true)) $p['fertDefault'] = $p['ferts'][0]['k'];
    $p['_by'] = $me; $p['_at'] = time();
    if (@file_put_contents(DATA_DIR . '/a365-pricing.json', json_encode($p, JSON_PRETTY_PRINT), LOCK_EX) === false) fail('Could not save that. Try again.', 500);
    accountLog(['by' => $me, 'what' => '365 pricing changed']);
    out(['ok' => true, 'pricing' => a365Pricing()]);
}
/* a quote kept on the lead; "sent" also moves an open lead to Quoted */
/* a held time that is not signed yet, moved or taken off the schedule (2026-10-16, Matthew: Jen "needs to move someone who hasnt sign to
   another spot, or remove him from the schedule because brandon is doing their lawn right now"). The hold is the quote's offered day:
   moving changes it (the new time must be free; the 72-hour clock starts again for a quote with no form), clear takes it off. Jen
   changes her own; the office and the admin any. Signed or booked: the Jobs board, not here. */
/* won without the form (2026-10-16, Matthew: a way for Jen "to make a customer ... for those that shes getting in person and over the
   phone that dont wanna sign"): their held day booked as a job (or their job given the payment), what they paid recorded on it, the
   lead marked won. The page then makes the customer (customerfrom). Jen's own leads; the desk any. */
if ($action === 'qwon') {
    if ((!desk() && $role !== 'quote') || !$isPost || !feature('walkdesk')) fail('Not allowed.', 403);
    $id = (string) ($body['id'] ?? ''); $l = leadOk($id) ? (leadsAll()[$id] ?? null) : null;
    if (!$l) fail('No such lead.', 404);
    if ($role === 'quote' && !qMine($l)) fail('Not allowed.', 403);
    if (($l['status'] ?? '') === 'lost') fail('This lead is marked lost.');
    $price = (int) ($l['quote']['price'] ?? 0); if ($price < 1) fail('Quote them first.');
    $pin = is_array($body['pay'] ?? null) ? $body['pay'] : []; $ps = in_array($pin['s'] ?? '', ['unpaid', 'deposit', 'paid'], true) ? $pin['s'] : 'unpaid';
    $pay = ['s' => $ps];
    if ($ps === 'deposit') { $pay['amt'] = (int) ($pin['amt'] ?? 0); if ($pay['amt'] < 1 || $pay['amt'] >= $price) fail('Give the deposit amount (less than the $' . $price . ' price).'); }
    if ($ps !== 'unpaid') $pay['how'] = in_array($pin['how'] ?? '', ['square', 'card', 'cash', 'zelle', 'venmo', 'check', 'other'], true) ? $pin['how'] : 'other';
    $payTxt = $ps === 'paid' ? 'Paid in full ($' . $price . ', ' . $pay['how'] . ').' : ($ps === 'deposit' ? 'Deposit $' . $pay['amt'] . ' (' . $pay['how'] . ').' : 'Not paid yet.');
    $lk = @fopen(DATA_DIR . '/jobs.log.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX)) fail('Could not save that. Try again.', 500);
    $jid = null; $ex = jobForLead($id);
    if ($ex) { appendLine(DATA_DIR . '/jobs.log', ['id' => $ex['id'], 'pay' => $pay, 'by' => $me, 'at' => time()]); $jid = $ex['id']; }
    elseif (!empty($body['book'])) {
        $o = $l['quote']['offer'] ?? null; if (!is_array($o)) fail('No day is held for them: set one on the schedule, or untick Book their day.');
        if ((string) $o['date'] < (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d')) fail('Their held day has passed: move it on the schedule first.');
        if (($why = slotFree((string) $o['crew'], (string) $o['date'], (string) $o['slot'], $id)) !== null) fail($why, 409);
        $h = $l['house'] ?? null; $addr = $h ? streetCaseServer((string) $h['address']) . (($h['town'] ?? '') !== '' ? ', ' . streetCaseServer(houseTown($h)) : '') : (string) ($l['town'] ?? '');
        $nj = 'j' . bin2hex(random_bytes(6)); $name = trim((string) ($l['name'] ?? '')) ?: 'Customer';
        if (!appendLine(DATA_DIR . '/jobs.log', ['id' => $nj, 'lead' => $id, 'title' => $name, 'crew' => (string) $o['crew'], 'date' => (string) $o['date'], 'slot' => (string) $o['slot'],
            'price' => $price, 'pkg' => (string) ($l['quote']['pkg'] ?? 'full'), 'scope' => 'all', 'seedLb' => $l['quote']['seedLb'] ?? null, 'fertLb' => $l['quote']['fertLb'] ?? null,
            'pay' => $pay, 'card' => false, 'note' => 'Won without the form (' . $me . ').', 'addr' => $addr !== '' ? $addr : 'Ask the office', 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
        $jid = $nj;
    }
    $wrow = ['id' => $id, 'status' => 'won', 'note' => 'Won without the form by ' . $me . '. ' . $payTxt . ($jid ? ' Job ' . ($ex ? 'updated' : 'booked') . '.' : ''), 'by' => $me, 'at' => time()];
    if (!$jid && is_array($l['quote']['offer'] ?? null)) { $wrow['quote'] = array_diff_key($l['quote'], ['offer' => 1, 'by' => 1, 'at' => 1, 'link' => 1]); $wrow['note'] .= ' Their held day was taken off the schedule (Book their day was unticked).'; }   /* a hold no longer ends with the stage (2026-10-18, Fable review): untick means release it */
    /* money taken with no job to carry it (2026-10-18, Fable review): it lived only in the note, so Payments received (taxes) and the Square
       check never saw it. Kept on the lead; paymentsAll lists it until a job carries it, and jobsave puts it on the job when the day is booked. */
    if (!$jid && $ps !== 'unpaid') { $wrow['wpay'] = $pay + ['amt' => $ps === 'paid' ? $price : (int) $pay['amt'], 'at' => time()]; $wrow['note'] .= ' The payment goes on their job when the day is booked.'; }
    appendLine(leadsDir() . '/leadst.log', $wrow);
    out(['ok' => true, 'job' => $jid]);
}
/* a town for the schedule (2026-10-16, Jen: "if there is no town listed can I add one? For Kirk"): kept on the lead, so a held time and the
   job it becomes both show it; the house's own town still wins when there is one. The desk, or the quote account on its own leads. */
if ($action === 'leadtown') {
    if ((!desk() && $role !== 'quote') || !$isPost) fail('Not allowed.', 403);
    $id = (string) ($body['id'] ?? ''); $l = leadOk($id) ? (leadsAll()[$id] ?? null) : null;
    if (!$l) fail('No such lead.', 404);
    if ($role === 'quote' && !qMine($l)) fail('Not allowed.', 403);
    $t = $clean($body['town'] ?? '', 40);
    if ($t !== '' && !preg_match("/^\\p{L}[\\p{L} .'-]{1,39}$/u", $t)) fail('Type the town name.');
    if (!appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'stown' => $t, 'note' => $t !== '' ? 'Town for the schedule: ' . $t . '.' : 'Town for the schedule cleared.', 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'town' => $t]);
}
if ($action === 'holdset') {
    if ((!desk() && $role !== 'quote') || !$isPost) fail('Not allowed.', 403);
    $id = (string) ($body['id'] ?? ''); $l = leadOk($id) ? (leadsAll()[$id] ?? null) : null;
    if (!$l || empty($l['quote']['offer'])) fail('That time is not held any more.', 404);
    if ($role === 'quote' && !qMine($l)) fail('Not allowed.', 403);
    if (!empty($l['signed'])) fail('They already signed: change it on the Jobs board.', 409);
    if (jobForLead($id)) fail('That one is booked as a job: change it on the Jobs board.', 409);
    $Q = $l['quote']; $was = $Q['offer']; $sl0 = jobSlot((string) $was['slot']);
    $wasTxt = deskWhen((string) $was['date'], '') . ($sl0 ? ', ' . $sl0[1] : '') . ' with ' . $was['crew'];
    if (!empty($body['clear'])) {
        unset($Q['offer']);
        $note = 'Taken off the schedule (was ' . $wasTxt . ').' . (($r = $clean($body['why'] ?? '', 200)) !== '' ? ' ' . $r : '');
    } else {
        $crew = (string) ($body['crew'] ?? ''); $date = (string) ($body['date'] ?? ''); $slot = (string) ($body['slot'] ?? '');
        if (!in_array($crew, jobCrewList(), true)) fail('Pick who does the job.');
        if (!dateOk($date) || $date < (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d')) fail('Pick today or a day ahead.');
        if (in_array((int) (new DateTime($date . ' 12:00', new DateTimeZone(appTz())))->format('w'), jobClosed(), true)) fail('That is a closed day.');
        $sl = jobSlot($slot); if (!$sl) fail('Pick an arrival time.');
        if (($why = slotFree($crew, $date, $slot, $id)) !== null) fail($why, 409);
        $Q['offer'] = ['crew' => $crew, 'date' => $date, 'slot' => $slot, 'at' => time()];
        $note = 'Held time moved: ' . $wasTxt . ' to ' . deskWhen($date, '') . ', ' . $sl[1] . ' with ' . $crew . '.';
    }
    if (!appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'quote' => $Q, 'note' => $note, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
if ($action === 'leadquote') {
    if (!desk() && $role !== 'quote') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $all = leadsAll();
    if (!leadOk($id) || !isset($all[$id])) fail('No such lead.', 404);
    if (!empty($all[$id]['signed']) && $role !== 'admin') fail('They already signed for this price. Change the job on the Jobs board.', 409);   /* Fable review 2026-10-14 */
    $price = (int) ($body['price'] ?? 0); if ($price < 1 || $price > 100000) fail('Give the quote a price.');
    $pkg = (string) ($body['pkg'] ?? ''); if (!in_array($pkg, ['full', 'aerate'], true)) fail('Pick the package.');
    $sq = (int) ($body['sq'] ?? 0); if ($sq < 0 || $sq > 2000000) fail('That lawn size does not look right.');
    $num = fn($k, $max) => isset($body[$k]) && is_numeric($body[$k]) && (float) $body[$k] >= 0 && (float) $body[$k] <= $max ? round((float) $body[$k], 1) : null;
    $q = ['price' => $price, 'pkg' => $pkg, 'sq' => $sq, 'seedLb' => $num('seedLb', 5000), 'fertLb' => $num('fertLb', 5000), 'note' => $clean($body['note'] ?? '', 200), 'sent' => !empty($body['sent'])];
    $ex = array_key_exists('extras', $body) ? a365Extras($body['extras']) : ($all[$id]['quote']['extras'] ?? []); if ($ex) $q['extras'] = $ex;   /* extra work (2026-10-21) */
    /* the day offered with the quote (2026-10-14): kept across re-saves unless changed or cleared; it holds that slot on the board */
    $prevOffer = $all[$id]['quote']['offer'] ?? null;
    if (array_key_exists('offer', $body)) {
        $o = $body['offer'];
        if (!is_array($o)) $q['offer'] = null;
        else {
            $oc = (string) ($o['crew'] ?? ''); $od = (string) ($o['date'] ?? ''); $os = (string) ($o['slot'] ?? '');
            if (!in_array($oc, jobCrewList(), true)) fail('Pick who does the job.');
            if (!dateOk($od) || $od < (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d')) fail('Pick today or a later day.');
            if (in_array((int) (new DateTime($od . ' 12:00', new DateTimeZone(appTz())))->format('w'), jobClosed(), true)) fail('That is a closed day (Sunday).');
            if (!jobSlot($os)) fail('Pick an arrival time.');
            if ($why = slotFree($oc, $od, $os, $id)) fail($why, 409);
            $q['offer'] = ['crew' => $oc, 'date' => $od, 'slot' => $os, 'at' => time()];   /* when it was offered: the 72-hour hold counts from here */
        }
    } elseif (is_array($prevOffer)) $q['offer'] = $prevOffer;
    $row = ['id' => $id, 'quote' => $q, 'by' => $me, 'at' => time()];
    /* Jen quotes on the phone (2026-10-16, Matthew: the app's Quote sent should match what she did): her saved price is a quote given */
    if (in_array($all[$id]['status'], ['new', 'contacted', 'walk'], true)) $row['status'] = 'quoted';   /* any saved quote, admins too (2026-10-21, Matthew: "quoted should automatically happen from the quote builder") */
    if (!appendLine(leadsDir() . '/leadst.log', $row)) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'status' => $row['status'] ?? $all[$id]['status'], 'link' => a365QuoteLink($id)]);
}
/* ---- the jobs board (2026-10-14, 365 Aeration & Seeding; Matthew: keep it in our app, borrowing the structure of Randy's sheet) ----
 * Randy's scheduling sheet: each day, each crew, four arrival times (9:30-10:00, 12:00, 12-2, 3:00), the town that crew is working that
 * day, and per job the name, address, price, what is included, payment (paid / deposit and how / service plan), card on file, notes and
 * where the lead came from; Sunday closed; the month's total at the top. Here: jobs.log beside the door files (append-only like the
 * walks; a booking line carries every field, later lines change it), jobdays.json for each crew's area of the day. The crew are the
 * people marked "Does walks"; each job goes on their calendar and their phones get an alert. Only where the walk desk is on. */
function jobSlots(): array { return [['s1', '9:30-10:00', '09:30'], ['s2', '10-12', '10:00'], ['s3', '12-2', '12:00'], ['s4', '3:00', '15:00']]; }   /* functions, not consts: the calendar feed runs above this line */
function jobClosed(): array { return [0]; }   /* Sunday */
function jobsAll(): array {
    static $c = null; $sig = fileSig(DATA_DIR . '/jobs.log');   /* the replay once per request, again after a write (review 2026-10-22); the hiding below runs every call, as it follows the role */
    if ($c !== null && $c[0] === $sig) $o = $c[1];
    else {
        $o = [];
        foreach (readLines(DATA_DIR . '/jobs.log') as $r) {
            $id = (string) $r['id'];
            if (!isset($o[$id])) { if (empty($r['crew']) || empty($r['date'])) continue; $o[$id] = $r + ['off' => false, 'done' => null, 'chg' => (int) ($r['at'] ?? 0)]; continue; }
            $moved = false;
            foreach (['crew', 'date', 'slot', 'price', 'pkg', 'scope', 'seedLb', 'fertLb', 'pay', 'card', 'note', 'addr', 'wx', 'sqlink', 'sqpaid', 'sqcharge', 'chgfail', 'aftercare', 'cudone', 'sqparts'] as $k) if (array_key_exists($k, $r)) { if (in_array($k, ['crew', 'date', 'slot'], true)) $moved = true; $o[$id][$k] = $r[$k]; }
            if ($moved) $o[$id]['chg'] = (int) ($r['at'] ?? 0);
            if (!empty($r['del'])) $o[$id]['off'] = true;
            if (array_key_exists('done', $r)) $o[$id]['done'] = $r['done'];
            if (is_array($r['ridet'] ?? null) && ($rn = (string) ($r['ridet']['name'] ?? '')) !== '') $o[$id]['ridet'][$rn] = ['mins' => (int) ($r['ridet']['mins'] ?? 0), 'at' => (int) ($r['at'] ?? 0)];   /* a rider's own time (2026-10-23) */
        }
        $c = [$sig, $o];
    }
    if (webHide()) { $web = webLeadIds(); foreach ($o as &$wj) if (isset($web[(string) ($wj['lead'] ?? '')])) { $wj['title'] = 'Booked'; $wj['addr'] = ''; $wj['note'] = ''; $wj['card'] = null; $wj['aftercare'] = null; $wj['web'] = true; } unset($wj); }   /* a 365-website job: its time, not who (2026-10-22) */
    return $o;
}
/** the Square payments and orders of 365-website leads and their jobs, for leaving them off the office's Square lists (2026-10-22) */
function webPays(): array {
    $s = []; $web = webLeadIds();
    foreach (jobsAll() as $j) { if (!isset($web[(string) ($j['lead'] ?? '')])) continue;
        foreach (['sqcharge', 'sqpaid'] as $k) if (!empty($j[$k]['payment'])) $s[(string) $j[$k]['payment']] = true;
        foreach ((array) ($j['sqparts'] ?? []) as $pp) if (!empty($pp['payment'])) $s[(string) $pp['payment']] = true;
        if (!empty($j['sqlink']['order'])) $s['o:' . $j['sqlink']['order']] = true; }
    foreach (leadsAllRaw() as $id => $l) { if (!isset($web[$id])) continue;
        foreach (['sqpaid', 'sqafter'] as $k) { if (!empty($l[$k]['payment'])) $s[(string) $l[$k]['payment']] = true; if (!empty($l[$k]['order'])) $s['o:' . $l[$k]['order']] = true; }
        if (!empty($l['sign']['pay']['order'])) $s['o:' . $l['sign']['pay']['order']] = true; }
    return $s;
}
function jobSlot(string $k): ?array {
    foreach (jobSlots() as $s) if ($s[0] === $k) return $s;
    /* an exact arrival time, 't' + HHMM, 6 am to 8 pm (2026-10-15, Matthew: Brian 10:30, Russ 1:00, Erik 2:15): its own time on the board */
    if (preg_match('/^t([01]\d|2[0-3])([0-5]\d)$/D', $k, $m) && (int) $m[1] >= 6 && (int) $m[1] <= 20) { $h = (int) $m[1]; return [$k, ($h % 12 ?: 12) . ':' . $m[2] . ($h < 12 ? ' am' : ' pm'), $m[1] . ':' . $m[2]]; }
    return null;
}
function jobDays(): array { $j = json_decode((string) @file_get_contents(DATA_DIR . '/jobdays.json'), true); return is_array($j) ? $j : []; }
/* blocked-out time for a crew (2026-10-21, Matthew: "a way for jen to block out dates for brad and brandon"): from / to (a day or a run of
   days), part = all | before | after a time ('time', HH:MM; "include a time slot"), an optional note. jobblocks.json beside jobdays.json.
   A window is blocked when any of it falls in the blocked time; an exact arrival time is a point. Old am / pm = before / after 12:00. */
function jobBlocks(): array { $j = json_decode((string) @file_get_contents(DATA_DIR . '/jobblocks.json'), true); return is_array($j) ? array_values(array_filter($j, 'is_array')) : []; }
function slotSpan(string $slot): array { $s = jobSlot($slot); $a = $s ? $s[2] : '00:00'; $e = ['s1' => '10:00', 's2' => '12:00', 's3' => '14:00', 's4' => '15:00'][$slot] ?? $a; return [$a, $e]; }
function blockNorm(array $b): array { $p = (string) ($b['part'] ?? 'all'); if ($p === 'am') { $p = 'before'; $b['time'] = '12:00'; } elseif ($p === 'pm') { $p = 'after'; $b['time'] = '12:00'; } $b['part'] = in_array($p, ['before', 'after'], true) ? $p : 'all'; $b['time'] = (string) ($b['time'] ?? ''); return $b + ['note' => '']; }
function blockHits(array $b, string $slot): bool { $b = blockNorm($b); if ($b['part'] === 'all') return true; [$a, $e] = slotSpan($slot); return $b['part'] === 'before' ? $a < $b['time'] : ($e > $b['time'] || $a >= $b['time']); }
function blockPartText(array $b): string { $b = blockNorm($b); if ($b['part'] === 'all') return 'that day'; $h = (int) substr($b['time'], 0, 2); $m = substr($b['time'], 3, 2); return $b['part'] . ' ' . ($h % 12 ?: 12) . ($m !== '00' ? ':' . $m : '') . ($h < 12 ? ' am' : ' pm') . ' that day'; }
function blockAt(string $crew, string $date, string $slot): ?array {
    foreach (jobBlocks() as $b) if (($b['crew'] ?? '') === $crew && $date >= ($b['from'] ?? '') && $date <= ($b['to'] ?? '') && blockHits($b, $slot)) return blockNorm($b);
    return null;
}
function blocksAhead(): array { $t = (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d'); $o = array_map('blockNorm', array_values(array_filter(jobBlocks(), fn($b) => ($b['to'] ?? '') >= $t))); usort($o, fn($a, $b) => [$a['from'], $a['crew']] <=> [$b['from'], $b['crew']]); return $o; }
function jobShow(array $j, ?array $leads = null): array {
    $o = array_intersect_key($j, array_flip(['id', 'lead', 'title', 'crew', 'date', 'slot', 'price', 'pkg', 'scope', 'seedLb', 'fertLb', 'pay', 'card', 'note', 'addr', 'by', 'at', 'chg', 'done', 'sqlink', 'sqcharge', 'aftercare', 'ridet']));
    $sl = jobSlot((string) $j['slot']); $o['slotLabel'] = $sl ? $sl[1] : (string) $j['slot'];
    $o['photos'] = jobPhotos((string) $j['id']);   /* 2026-10-19 */
    $l = ($leads ?? leadsAll())[$j['lead']] ?? null;
    if ($l) {
        if (!empty($l['sqcard']['id'])) { $o['cof'] = ['brand' => (string) ($l['sqcard']['brand'] ?? ''), 'last4' => (string) ($l['sqcard']['last4'] ?? ''), 'exp' => (string) ($l['sqcard']['exp'] ?? '')]; $o['card'] = true; }   /* saved on Square when they paid the deposit (2026-10-15) */
        $o['who'] = ['name' => (string) ($l['name'] ?? ''), 'phone' => (string) ($l['phone'] ?? ''), 'email' => (string) ($l['email'] ?? ''), 'src' => (string) ($l['src'] ?? ''), 'notes' => $l['notes'], 'ask' => $l['ask'] ?? null];
        if (!empty($l['house']['region'])) { $hf = houseFacts((string) $l['house']['region'], (string) $l['house']['door']); if ($hf) $o['house'] = $hf; }
    }
    return $o;
}
if (in_array($action, ['jobs', 'jobsave', 'jobday', 'myjobs', 'jobdone', 'ridetime', 'schedview', 'jobblockadd', 'jobblockdel'], true) && !feature('walkdesk')) fail('Not here.', 404);
/* paid, and what is left (2026-10-19): "Deposit $50 paid · $249 left", "Paid in full (card charged)" */
function payLine(array $j): string {
    $p = $j['pay'] ?? ['s' => 'unpaid']; $s0 = (string) ($p['s'] ?? 'unpaid');
    if ($s0 === 'paid') return 'Paid in full' . (!empty($j['sqcharge']) ? ' (card charged)' : (!empty($j['sqpaid']['found']) ? ' (paid in Square)' : (!empty($j['sqpaid']) ? ' (pay link)' : (($p['how'] ?? '') !== '' ? ' (' . $p['how'] . ')' : ''))));
    if ($s0 === 'plan') return 'Service plan';
    if ((int) ($j['price'] ?? 0) < 1) return 'Price to confirm';
    $owed = jobOwed($j);
    if ($s0 === 'deposit' && !empty($p['part'])) return 'Paid $' . (int) ($p['amt'] ?? 0) . ' so far · $' . $owed . ' left';   /* part payments (2026-10-20) */
    return $s0 === 'deposit' ? 'Deposit $' . (int) ($p['amt'] ?? 0) . ' paid · $' . $owed . ' left' : 'Not paid yet · $' . $owed . ' due';
}
function cardLine(array $j, ?array $l): string { $cc = $l['sqcard'] ?? null; if (!empty($cc['id'])) return 'Card on file (' . trim((string) ($cc['brand'] ?? 'card') . ' ' . (string) ($cc['last4'] ?? '')) . ')'; return !empty($j['card']) ? 'Card on file' : 'No card on file'; }
/* the schedule, to look at only (2026-10-15, Matthew: Jen on a quote-only account "needs a way to view scheduling"; she "has a strong
   attachment to that excel sheet"): each day's arrival times for each crew, booked / held / open, with the customer's name and town
   only: no prices, phones, emails or streets, and nothing can be changed or downloaded from here */
if ($action === 'schedview') {
    if (!desk() && $role !== 'quote') fail('Not allowed.', 403);
    $from = (string) ($_GET['from'] ?? ''); $to = (string) ($_GET['to'] ?? '');
    if (!dateOk($from) || !dateOk($to) || $to < $from || strtotime($to) - strtotime($from) > 31 * 86400) fail('Pick the dates.');
    $srcName = fn($s) => ['website' => 'Website', 'meta' => 'Facebook', 'nextdoor' => 'Nextdoor', 'phone' => 'Phone call', 'linktree' => 'Linktree', 'referral' => 'Referral', 'other' => 'Other', 'messenger' => 'Messenger', 'a365web' => 'Website'][$s] ?? '';
    $leads = leadsAll(); $town = function ($lid, $addr) use ($leads) { $l = $leads[$lid] ?? null; if ($l && !empty($l['house']['town'])) return (string) $l['house']['town']; if ($l && !empty($l['stown'])) return (string) $l['stown']; $p = array_map('trim', explode(',', (string) $addr)); return count($p) > 1 ? (string) end($p) : ''; };
    $rows = [];
    foreach (jobsAll() as $j) if (!$j['off'] && $j['date'] >= $from && $j['date'] <= $to)
        $rows[] = ['id' => $j['id'], 'date' => $j['date'], 'slot' => $j['slot'], 'crew' => $j['crew'], 'kind' => 'booked', 'name' => trim((string) ($leads[$j['lead']]['name'] ?? $j['title'] ?? '')) ?: 'A customer', 'town' => $town($j['lead'], $j['addr'] ?? ''),
            'what' => (($j['pkg'] ?? 'full') === 'aerate' ? 'Aerate only' : (($j['pkg'] ?? '') === 'plan' ? 'Service plan' : 'Full')) . (($j['scope'] ?? 'all') === 'front' ? ', front yard only' : (($j['scope'] ?? 'all') === 'back' ? ', back yard only' : '')),
            'pay' => payLine($j), 'owed' => jobOwed($j), 'src' => $srcName((string) ($leads[$j['lead']]['src'] ?? '')), 'card' => cardLine($j, $leads[$j['lead']] ?? null), 'done' => $j['done'] ? ($j['done']['o'] === 'done' ? 'Done' : 'Not done') : ''];
    foreach (jobHolds($leads) as $h) if ($h['date'] >= $from && $h['date'] <= $to)
        $rows[] = ['lead' => $h['lead'], 'date' => $h['date'], 'slot' => $h['slot'], 'crew' => $h['crew'], 'kind' => 'held', 'name' => $h['name'], 'town' => $town($h['lead'], ''), 'what' => '', 'pay' => $h['paid'] ? 'Held: form sent, waiting to sign' : 'Held: offered with a quote', 'src' => $srcName((string) ($leads[$h['lead']]['src'] ?? '')), 'card' => '', 'done' => ''];
    if ($role === 'quote') {   /* quote-only accounts: their own customers by name and movable; anyone else's slot only says taken (2026-10-15) */
        $rows = array_map(function ($r) use ($leads) {
            $lid = $r['kind'] === 'booked' ? (string) (jobsAll()[$r['id']]['lead'] ?? '') : (string) ($r['lead'] ?? '');
            if ($lid !== '' && qMine($leads[$lid] ?? [])) { if ($r['kind'] !== 'held') unset($r['lead']); else $r['hold'] = $lid; $r['mine'] = true; return $r; }   /* her own held time keeps a handle to move it (2026-10-16) */
            return ['date' => $r['date'], 'slot' => $r['slot'], 'crew' => $r['crew'], 'kind' => $r['kind'], 'name' => $r['kind'] === 'held' ? 'Held' : 'Booked', 'town' => '', 'what' => '', 'pay' => '', 'src' => '', 'card' => '', 'done' => ''];
        }, $rows);
    }
    $JA = jobsAll();   /* no town: 'tl' = the lead, to add one (2026-10-16, Jen); the quote account only on her own */
    foreach ($rows as &$rw) { if (($rw['town'] ?? '') !== '') continue; $lid = ($rw['kind'] ?? '') === 'booked' ? (string) ($JA[$rw['id'] ?? '']['lead'] ?? '') : (string) ($rw['lead'] ?? ($rw['hold'] ?? '')); if ($lid !== '' && isset($leads[$lid]) && ($role !== 'quote' || qMine($leads[$lid]))) $rw['tl'] = $lid; } unset($rw);
    foreach ($rows as &$rw) { if (desk() && ($rw['kind'] ?? '') === 'held' && !empty($rw['lead'])) $rw['hold'] = $rw['lead']; unset($rw['lead']); } unset($rw);   /* held: 'hold' = the lead, for move or take off (2026-10-16) */
    $days = []; foreach (jobDays() as $d => $v) if ($d >= $from && $d <= $to) $days[$d] = $v;
    out(['ok' => true, 'rows' => $rows, 'crews' => jobBoardCrews(), 'pick' => jobCrewList(), 'days' => $days, 'slots' => array_map(fn($s) => ['k' => $s[0], 'label' => $s[1]], jobSlots()), 'closed' => jobClosed(), 'blocks' => blocksAhead()]);
}
/* the board: jobs between two dates (at most two months), each crew's area per day, the crews, the slots, and the totals */
if ($action === 'jobs') {
    if (!desk() && $role !== 'quote') fail('Not allowed.', 403);
    $from = (string) ($_GET['from'] ?? ''); $to = (string) ($_GET['to'] ?? '');
    if (!dateOk($from) || !dateOk($to) || $to < $from) fail('Pick the dates.');
    if (strtotime($to) - strtotime($from) > 62 * 86400) fail('Ask for two months at most.');
    $leads = leadsAll(); $list = [];
    foreach (jobsAll() as $j) if (!$j['off'] && $j['date'] >= $from && $j['date'] <= $to) $list[] = jobShow($j, $leads);
    usort($list, fn($a, $b) => [$a['date'], $a['slot']] <=> [$b['date'], $b['slot']]);
    $days = []; foreach (jobDays() as $d => $v) if ($d >= $from && $d <= $to) $days[$d] = $v;
    $holds = array_values(array_filter(jobHolds($leads), fn($h) => $h['date'] >= $from && $h['date'] <= $to));
    if ($role === 'quote') {   /* the day picker only: a taken time, never whose or for how much (2026-10-15) */
        $list = array_map(fn($j) => ['id' => $j['id'], 'date' => $j['date'], 'crew' => $j['crew'], 'slot' => $j['slot'], 'slotLabel' => $j['slotLabel'] ?? '', 'title' => 'Booked', 'who' => ['name' => 'Booked'], 'price' => 0, 'pkg' => 'full', 'scope' => 'all', 'pay' => ['s' => 'unpaid'], 'card' => false, 'done' => null, 'lead' => qMine($leads[$j['lead']] ?? []) ? $j['lead'] : ''], $list);
        $holds = array_map(fn($h) => qMine($leads[$h['lead']] ?? []) ? $h : ['lead' => '', 'name' => 'Held', 'crew' => $h['crew'], 'date' => $h['date'], 'slot' => $h['slot'], 'until' => $h['until'], 'paid' => $h['paid']], $holds);
    }
    out(['ok' => true, 'jobs' => $list, 'holds' => $holds, 'days' => $days, 'crews' => jobBoardCrews(), 'pick' => jobCrewList(), 'slots' => array_map(fn($s) => ['k' => $s[0], 'label' => $s[1]], jobSlots()), 'closed' => jobClosed(), 'blocks' => blocksAhead()]);
}
/* each crew's area for a day ("the town of the day" in Randy's sheet) */
if ($action === 'jobday') {
    if (!desk()) fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $date = (string) ($body['date'] ?? ''); $crew = (string) ($body['crew'] ?? ''); $area = $clean($body['area'] ?? '', 40);
    if (!dateOk($date)) fail('That is not a real date.');
    if (!in_array($crew, jobCrewList(), true)) fail('Pick who does the jobs that day.');
    $lk = @fopen(DATA_DIR . '/jobdays.json.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX)) fail('Could not save that. Try again.', 500);
    $all = jobDays(); if ($area === '') unset($all[$date][$crew]); else $all[$date][$crew] = $area;
    if (isset($all[$date]) && !$all[$date]) unset($all[$date]);
    if (@file_put_contents(DATA_DIR . '/jobdays.json', json_encode($all, JSON_UNESCAPED_UNICODE), LOCK_EX) === false) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
/* block out time for a crew, or take a block off (2026-10-21): Jen (quote or office) and admins. Jobs already booked in the time stay
   booked and are counted back, so she can move them; the crew gets an alert. */
if ($action === 'jobblockadd' || $action === 'jobblockdel') {
    if (!desk() && $role !== 'quote') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $today = (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d');
    $lk = @fopen(DATA_DIR . '/jobblocks.json.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX)) fail('Could not save that. Try again.', 500);
    $all = jobBlocks(); $booked = []; $held = 0; $nb = null;
    if ($action === 'jobblockdel') {
        $id = (string) ($body['id'] ?? ''); $gone = null; foreach ($all as $b) if (($b['id'] ?? '') === $id) $gone = $b;
        if (!$gone) fail('That block is already gone.');
        $all = array_values(array_filter($all, fn($b) => ($b['id'] ?? '') !== $id));
    } else {
        $crew = (string) ($body['crew'] ?? ''); if (!in_array($crew, jobCrewList(), true)) fail('Pick who is off.');
        $from = (string) ($body['from'] ?? ''); $to = (string) ($body['to'] ?? '') ?: $from;
        if (!dateOk($from) || !dateOk($to)) fail('Pick the days.');
        if ($to < $from) fail('The last day is before the first.');
        if ($to < $today) fail('Those days are already gone.');
        if (strtotime($to) - strtotime($from) > 120 * 86400) fail('Block four months at most at a time.');
        $nb = blockNorm(['id' => bin2hex(random_bytes(6)), 'crew' => $crew, 'from' => $from, 'to' => $to, 'part' => (string) ($body['part'] ?? 'all'), 'time' => (string) ($body['time'] ?? ''), 'note' => $clean($body['note'] ?? '', 60), 'by' => $me, 'at' => time()]);
        if ($nb['part'] !== 'all' && !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D', $nb['time'])) fail('Pick the time.');
        if ($nb['part'] === 'all') $nb['time'] = '';
        $in = fn($d, $s) => $d >= $from && $d <= $to && blockHits($nb, (string) $s);
        $leads = leadsAll();
        foreach (jobsAll() as $j) if (!$j['off'] && $j['crew'] === $crew && $in($j['date'], $j['slot'])) $booked[] = ['date' => $j['date'], 'slot' => (string) (jobSlot((string) $j['slot'])[1] ?? $j['slot']), 'name' => ($role === 'quote' && !qMine($leads[$j['lead']] ?? [])) ? 'Booked' : (trim((string) ($leads[$j['lead']]['name'] ?? '')) ?: 'A customer')];
        foreach (jobHolds($leads) as $h) if ($h['crew'] === $crew && $in($h['date'], $h['slot'])) $held++;
        $all[] = $nb;
    }
    if (@file_put_contents(DATA_DIR . '/jobblocks.json', json_encode(array_values($all), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) === false) fail('Could not save that. Try again.', 500);
    flock($lk, LOCK_UN);
    $bb = blockNorm($nb ?? $gone); $when = deskWhen($bb['from'], '') . ($bb['to'] !== $bb['from'] ? ' to ' . deskWhen($bb['to'], '') : '') . ($bb['part'] !== 'all' ? ', ' . preg_replace('/ that day$/', '', blockPartText($bb)) : '');
    if ($bb['crew'] !== $me) pushName($bb['crew'], ($nb ? 'Blocked off: ' : 'Free again: ') . $when, ($bb['note'] !== '' ? $bb['note'] . ' · ' : '') . ($nb ? 'set' : 'taken off') . ' by ' . $me, './', 'block-' . $bb['id']);
    usort($booked, fn($a, $b) => strcmp($a['date'], $b['date']));
    out(['ok' => true, 'blocks' => blocksAhead(), 'booked' => $booked, 'held' => $held]);
}
/* book, change or cancel a job; one job per crew per slot; booking marks the lead Won */
if ($action === 'jobsave') {
    if (!desk() && $role !== 'quote') fail('Not allowed.', 403);
    if ($role === 'quote') {   /* from the schedule: move or cancel one of her own booked jobs, nothing else (2026-10-15) */
        $qj = jobsAll()[(string) ($body['id'] ?? '')] ?? null;
        if (!$qj || $qj['off'] || !qMine(leadsAll()[$qj['lead']] ?? [])) fail('Not allowed.', 403);
        $body = array_intersect_key($body, array_flip(['id', 'date', 'slot', 'crew', 'del']));
    }
    if (!$isPost) fail('POST required', 405);
    $lk = @fopen(DATA_DIR . '/jobs.log.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX)) fail('Could not save that. Try again.', 500);
    $all = jobsAll(); $leads = leadsAll(); $id = (string) ($body['id'] ?? ''); $have = null;
    if ($id !== '') { if (!preg_match('/^j[0-9a-f]{12}$/D', $id) || !isset($all[$id]) || $all[$id]['off']) fail('No such job.', 404); $have = $all[$id]; }
    if (!empty($body['del'])) {
        if (!$have) fail('No such job.', 404);
        if (!appendLine(DATA_DIR . '/jobs.log', ['id' => $id, 'del' => 1, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
        if (($leads[$have['lead']]['status'] ?? '') === 'won') appendLine(leadsDir() . '/leadst.log', ['id' => $have['lead'], 'status' => 'quoted', 'by' => $me, 'at' => time()]);
        $sgx = $leads[$have['lead']]['signed'] ?? null; if ($sgx && ($sgx['job'] ?? '') === $id) appendLine(leadsDir() . '/leadst.log', ['id' => $have['lead'], 'signed' => ['job' => null] + $sgx, 'by' => $me, 'at' => time()]);   /* Fable review 2026-10-14 */
        $sl = jobSlot((string) $have['slot']);
        if ($have['crew'] !== $me) pushName($have['crew'], 'Job cancelled: ' . deskWhen($have['date'], '') . ($sl ? ', ' . $sl[1] : ''), $have['title'] . ' · cancelled by ' . $me, './', 'job-' . $id);
        out(['ok' => true]);
    }
    $lead = $have ? (string) $have['lead'] : (string) ($body['lead'] ?? '');
    if (!leadOk($lead) || !isset($leads[$lead])) fail('Book a job from a lead.', 404);
    $crew = (string) ($body['crew'] ?? ($have['crew'] ?? ''));
    if (!in_array($crew, jobCrewList(), true)) fail('Pick who does the job.');
    $date = (string) ($body['date'] ?? ($have['date'] ?? '')); if (!dateOk($date)) fail('That is not a real date.');
    $tz = new DateTimeZone(appTz());
    if ($date < (new DateTime('today', $tz))->format('Y-m-d') && (!$have || $date !== $have['date'])) fail('That day has gone. Pick today or later.');
    if (in_array((int) (new DateTime($date . ' 12:00', $tz))->format('w'), jobClosed(), true) && empty($body['force'])) fail('That is a closed day (Sunday).');
    $slot = (string) ($body['slot'] ?? ($have['slot'] ?? '')); if (!jobSlot($slot)) fail('Pick an arrival time.');
    if ($why = slotFree($crew, $date, $slot, $lead, $id)) fail($why, 409);   /* a job there, or another quote's offered day (2026-10-14) */
    $price = (int) ($body['price'] ?? ($have['price'] ?? 0)); $tbd = desk() && $price === 0 && (!empty($body['tbd']) || ($have && (int) ($have['price'] ?? 0) === 0 && !array_key_exists('price', $body)));   /* price to confirm (2026-10-15, Russ and Erik: Brandon gives the price) */
    if (!$tbd && ($price < 1 || $price > 100000)) fail('Give the job a price.');
    $pkg = (string) ($body['pkg'] ?? ($have['pkg'] ?? 'full')); if (!in_array($pkg, ['full', 'aerate', 'plan'], true)) fail('Pick what is included.');
    $scope = (string) ($body['scope'] ?? ($have['scope'] ?? 'all')); if (!in_array($scope, ['all', 'front', 'back'], true)) fail('Pick front, back or all.');
    $num = fn($k) => array_key_exists($k, $body) ? (is_numeric($body[$k]) && (float) $body[$k] >= 0 && (float) $body[$k] <= 5000 ? round((float) $body[$k], 1) : null) : ($have[$k] ?? null);
    $payIn = is_array($body['pay'] ?? null) ? $body['pay'] : ($have['pay'] ?? ['s' => 'unpaid']);
    /* money taken on "They said yes" with no day booked (qwon, 2026-10-18 Fable review) rides onto the new job unless a payment is given here;
       full or part of this price by what was actually taken */
    $wp0 = (!$have && is_array($leads[$lead]['wpay'] ?? null) && ($payIn['s'] ?? 'unpaid') === 'unpaid' && (int) ($leads[$lead]['wpay']['amt'] ?? 0) > 0) ? $leads[$lead]['wpay'] : null;
    if ($wp0) $payIn = (int) $wp0['amt'] >= $price ? ['s' => 'paid', 'how' => $wp0['how'] ?? 'other'] : ['s' => 'deposit', 'amt' => (int) $wp0['amt'], 'how' => $wp0['how'] ?? 'other'];
    $pay = ['s' => in_array($payIn['s'] ?? '', ['unpaid', 'deposit', 'paid', 'plan'], true) ? $payIn['s'] : 'unpaid'];
    if ($pay['s'] === 'deposit') { $pay['amt'] = (int) ($payIn['amt'] ?? 0); if ($pay['amt'] < 1 || $pay['amt'] >= $price) fail('Give the deposit amount (less than the price).'); }
    if (in_array($pay['s'], ['deposit', 'paid'], true)) $pay['how'] = in_array($payIn['how'] ?? '', ['square', 'card', 'cash', 'zelle', 'venmo', 'check', 'other'], true) ? $payIn['how'] : 'other';
    $card = array_key_exists('card', $body) ? !empty($body['card']) : (bool) ($have['card'] ?? false);
    $note = array_key_exists('note', $body) ? $clean($body['note'], 300) : (string) ($have['note'] ?? '');
    $l = $leads[$lead]; $house = $l['house'] ?? null;
    $addr = array_key_exists('addr', $body) ? $clean($body['addr'], 160) : (string) ($have['addr'] ?? ($house ? streetCaseServer((string) $house['address']) . ', ' . $house['town'] : (string) ($l['town'] ?? '')));
    if ($addr === '') fail('Add the address.');
    $title = trim((string) ($l['name'] ?? '')) ?: (trim((string) ($l['phone'] ?? '')) ?: 'Job');
    $fields = ['crew' => $crew, 'date' => $date, 'slot' => $slot, 'price' => $price, 'pkg' => $pkg, 'scope' => $scope, 'seedLb' => $num('seedLb'), 'fertLb' => $num('fertLb'), 'pay' => $pay, 'card' => $card, 'note' => $note, 'addr' => $addr];
    if ($have) { $row = ['id' => $id]; foreach ($fields as $k => $v) if (json_encode($v) !== json_encode($have[$k] ?? null)) $row[$k] = $v; if (count($row) === 1) out(['ok' => true, 'id' => $id, 'same' => true]); $row += ['by' => $me, 'at' => time()]; }
    else { $id = 'j' . bin2hex(random_bytes(6)); $row = ['id' => $id, 'lead' => $lead, 'title' => $title] + $fields + ['by' => $me, 'at' => time()]; if ($wp0) $row['payat'] = (int) ($wp0['at'] ?? time()); }   /* payat: the day the money came in (2026-10-18) */
    if (!appendLine(DATA_DIR . '/jobs.log', $row)) fail('Could not save that. Try again.', 500);
    if ($wp0) appendLine(leadsDir() . '/leadst.log', ['id' => $lead, 'wpay' => null, 'note' => 'The payment taken when they said yes is on the job now.', 'by' => $me, 'at' => time()]);   /* counted once, on the job (2026-10-18) */
    if (!$have && in_array($l['status'], ['new', 'contacted', 'walk', 'quoted'], true)) appendLine(leadsDir() . '/leadst.log', ['id' => $lead, 'status' => 'won', 'by' => $me, 'at' => time()]);
    $sl = jobSlot($slot); $when = deskWhen($date, '') . ', ' . $sl[1];
    $al = null;
    if ($crew !== $me && (!$have || $crew !== $have['crew'] || $date !== $have['date'] || $slot !== $have['slot'])) $al = pushName($crew, ($have ? 'Job moved: ' : 'Job booked: ') . $when, $title . ' · ' . $addr . ' · $' . $price, './?job=' . $id, 'job-' . $id);
    if ($have && $have['crew'] !== $crew && $have['crew'] !== $me) pushName($have['crew'], 'Job handed to ' . $crew, $title . ' · ' . deskWhen($have['date'], ''), './', 'job-' . $id);
    out(['ok' => true, 'id' => $id, 'alert' => $al]);
}
/* the crew's own jobs, with everything for each */
if ($action === 'myjobs') {
    if ($role === 'quote') {   /* Jen opens one of her own customers' jobs from her schedule (2026-10-19) */
        $qj = jobsAll()[(string) ($_GET['id'] ?? '')] ?? null;
        if (!$qj || $qj['off'] || !qMine(leadsAll()[$qj['lead']] ?? [])) fail('Not allowed.', 403);
        out(['ok' => true, 'who' => $me, 'jobs' => [jobShow($qj)]]);
    }
    $who = trim((string) ($_GET['who'] ?? '')); if ($who === '' || !desk()) $who = $me;
    $from = (new DateTime('today', new DateTimeZone(appTz())))->modify('-14 days')->format('Y-m-d');
    $leads = leadsAll(); $list = [];
    $want = (string) ($_GET['id'] ?? '');   /* a link to one job opens it whatever its date (Fable review 2026-10-14) */
    /* the admin or the office opening one job by id: that job, whoever's crew it is (2026-10-20, Matthew: opening Jeremy's job said "not on
       the list any more": the schedule's "Open the job" asked for the opener's own jobs, and the job was Brad's) */
    if ($want !== '' && desk() && trim((string) ($_GET['who'] ?? '')) === '') { $wj = jobsAll()[$want] ?? null; if ($wj && !$wj['off']) out(['ok' => true, 'who' => (string) $wj['crew'], 'jobs' => [jobShow($wj, $leads)]]); }
    /* rides with (2026-10-22, Matthew: "Bria is also going out on some jobs with brad tomorrow can u give access to the crew portion. keep her current
       access as well"): accounts "rides" {account id: [crew names]} adds those crews' jobs to this person's own list, to look at; the job's own
       crew still marks it done (jobOpen is unchanged). Set on the server by the admin. */
    $rides = $who === $me ? array_values(array_filter((array) (($acct['rides'] ?? [])[(string) ($session['c'] ?? '')] ?? []), 'is_string')) : [];
    foreach (jobsAll() as $j) if (!$j['off'] && ($j['crew'] === $who || in_array($j['crew'], $rides, true)) && ($j['date'] >= $from || $j['id'] === $want)) $list[] = jobShow($j, $leads) + ($j['crew'] !== $who ? ['ride' => (string) $j['crew']] : []);
    usort($list, fn($a, $b) => [$a['date'], $a['slot']] <=> [$b['date'], $b['slot']]);
    out(['ok' => true, 'who' => $who, 'jobs' => $list]);
}
/* a rider's own time on a job (2026-10-23, Matthew: "on brias app since we gave her crew permissions. can you give her the option to input how
   long it took her to do the job"): someone set to ride with a crew (accounts "rides") saves how long THEY spent on one of that crew's jobs. It
   does not mark the job done; the crew still does that with their own time. mins 0 takes it back off. */
if ($action === 'ridetime') {
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $all = jobsAll();
    if (!preg_match('/^j[0-9a-f]{12}$/D', $id) || !isset($all[$id]) || $all[$id]['off']) fail('No such job.', 404);
    $rides = array_values(array_filter((array) (($acct['rides'] ?? [])[(string) ($session['c'] ?? '')] ?? []), 'is_string'));
    if (!in_array((string) $all[$id]['crew'], $rides, true)) fail('Not allowed.', 403);
    $mins = max(0, min(960, (int) ($body['mins'] ?? 0)));
    if ($mins > 0 && $mins < 5) fail('Add about how long it took, in hours and minutes.');
    if (!appendLine(DATA_DIR . '/jobs.log', ['id' => $id, 'ridet' => ['name' => $me, 'mins' => $mins], 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    $took = trim(($mins >= 60 ? intdiv($mins, 60) . ' h ' : '') . ($mins % 60 ? ($mins % 60) . ' min' : ''));
    if ($mins > 0) appendLine(leadsDir() . '/leadst.log', ['id' => $all[$id]['lead'], 'note' => 'Rode along on the job (' . $all[$id]['crew'] . '): about ' . $took, 'by' => $me, 'at' => time()]);
    out(['ok' => true]);
}
/* done, from the crew (or the office): done or could not; what was collected */
if ($action === 'jobforecast') {
    if (!feature('walkdesk') || !desk()) fail('Not allowed.', 403);
    out(['ok' => true] + wxForecast());
}
if ($action === 'jobweathersuggest') {
    if (!feature('walkdesk') || !desk()) fail('Not allowed.', 403);
    $date = (string) ($_GET['date'] ?? ''); if (!dateOk($date)) fail('Pick the day.');
    out(['ok' => true, 'date' => $date, 'jobs' => wxSuggest($date), 'slots' => array_map(fn($x) => ['k' => $x[0], 'label' => $x[1]], jobSlots()), 'crews' => jobCrewList(), 'forecast' => wxForecast()['days'][$date] ?? null]);
}
if ($action === 'jobweather') {
    if (!feature('walkdesk') || !desk()) fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $from = (string) ($body['from'] ?? ''); if (!dateOk($from)) fail('Pick the day being moved.');
    $moves = is_array($body['moves'] ?? null) ? $body['moves'] : []; if (!$moves) fail('Nothing to move.');
    $tz = new DateTimeZone(appTz()); $today = (new DateTime('today', $tz))->format('Y-m-d');
    $lk = @fopen(DATA_DIR . '/jobs.log.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX)) fail('Could not save that. Try again.', 500);
    $all = jobsAll(); $leads = leadsAll(); $done = []; $errs = []; $perCrew = [];
    foreach ($moves as $m) {
        $id = (string) ($m['id'] ?? ''); $nd = (string) ($m['date'] ?? ''); $ns = (string) ($m['slot'] ?? '');
        $j = $all[$id] ?? null;
        if (!$j || $j['off'] || $j['date'] !== $from) { $errs[] = $id . ': not a job on that day'; continue; }
        if (!dateOk($nd) || $nd < $today || !jobSlot($ns)) { $errs[] = $j['title'] . ': pick a day and time'; continue; }
        if (in_array((int) (new DateTime($nd . ' 12:00', $tz))->format('w'), jobClosed(), true)) { $errs[] = $j['title'] . ': that is a closed day'; continue; }
        if ($why = slotFree($j['crew'], $nd, $ns, (string) $j['lead'], $id)) { $errs[] = $j['title'] . ': ' . $why; continue; }
        $wx = ['from' => $from, 'fromSlot' => $j['slot'], 'at' => time(), 'by' => $me];
        if (!appendLine(DATA_DIR . '/jobs.log', ['id' => $id, 'date' => $nd, 'slot' => $ns, 'wx' => $wx, 'by' => $me, 'at' => time()])) { $errs[] = $j['title'] . ': not saved'; continue; }
        $all[$id]['date'] = $nd; $all[$id]['slot'] = $ns;   /* the next move on the list sees this one */
        appendLine(leadsDir() . '/leadst.log', ['id' => $j['lead'], 'note' => 'Moved for weather from ' . deskWhen($from, '') . ' to ' . deskWhen($nd, '') . ', ' . jobSlot($ns)[1] . '.', 'by' => $me, 'at' => time()]);
        $perCrew[$j['crew']][] = $nd;
        $L = $leads[$j['lead']] ?? [];
        $done[] = ['id' => $id, 'lead' => $j['lead'], 'name' => (string) ($L['name'] ?? $j['title']), 'phone' => (string) ($L['phone'] ?? ''), 'email' => (string) ($L['email'] ?? ''), 'src' => (string) ($L['src'] ?? ''),
                   'from' => $from, 'date' => $nd, 'slot' => $ns, 'day' => a365Day($nd), 'arrive' => a365Arrive($ns), 'fromDay' => a365Day($from)];
    }
    flock($lk, LOCK_UN);
    foreach ($perCrew as $crew => $ds) { $u = array_values(array_unique($ds)); if ($crew !== $me) pushName($crew, count($ds) . (count($ds) === 1 ? ' job' : ' jobs') . ' moved for weather', 'From ' . deskWhen($from, '') . ' to ' . implode(', ', array_map(fn($x) => deskWhen($x, ''), $u)), './', 'wx-' . $from); }
    out(['ok' => !$errs || $done, 'moved' => $done, 'errors' => $errs]);
}
/* ---- the field crew (2026-10-19, Matthew, looking through Brad's eyes) ----
 * Photos on a job; the crew's own week, to look at (only the office changes it); a walk added on the spot ("in case people get
 * approached to do something while working on something else"); and stats about the work instead of the doors. */
const JOB_PHOTO_MAX = 20;
function jobPhotosAll(): array {
    static $c = null; if ($c !== null) return $c; $c = [];
    foreach (readLines(DATA_DIR . '/jobphotos.log') as $r) {
        $j = (string) ($r['id'] ?? ''); $f = (string) ($r['f'] ?? '');   /* 'id' = the job: readLines keeps only lines with an id */ if ($j === '' || $f === '') continue;
        if (!empty($r['del'])) unset($c[$j][$f]); else $c[$j][$f] = ['f' => $f, 'by' => (string) ($r['by'] ?? ''), 'at' => (int) ($r['at'] ?? 0)];
    }
    return $c;
}
function jobPhotos(string $jid): array { return array_values(jobPhotosAll()[$jid] ?? []); }
function jobMine(array $j): bool { global $me; return $j['crew'] === $me || desk(); }
/* who may settle a job's balance and send its aftercare: the crew on it, the desk, or Jen on her own customer (2026-10-19) */
function jobOpen(array $j): bool { global $role; return jobMine($j) || ($role === 'quote' && qMine(leadsAll()[$j['lead']] ?? [])); }
/* a balance paid straight in Square (2026-10-19: Jen charged Kirk's card in the Square dashboard; the app only knew its own links and charges).
   Payments from this customer's Square profile, completed, that are not the deposit, not the job's pay link and not a charge the app already
   made; together they must cover what is owed. Returns the newest one, or null. */
function jobKnownPays(array $j, array $l): array {
    $ids = array_filter(array_merge([(string) ($l['sqpaid']['payment'] ?? ''), (string) ($l['sqafter']['payment'] ?? ''), (string) ($j['sqcharge']['payment'] ?? ''), (string) ($j['sqpaid']['payment'] ?? '')], array_map(fn($pp) => (string) ($pp['payment'] ?? ''), (array) ($j['sqparts'] ?? [])), array_keys(squareConfirmed())));
    $orders = array_filter([(string) ($l['sign']['pay']['order'] ?? ''), (string) ($j['sqlink']['order'] ?? '')]);
    return [$ids, $orders];
}
function squarePaymentsSince(int $from, int $pages = 4, bool $allLocs = false): ?array {   /* the payments at our location since a time; null when Square does not answer */
    /* $allLocs (2026-10-22, Matthew: Brian Skelton paid his $200 by an invoice made in the Square dashboard, which landed in the "Six Fold Colorado"
       location; the balance check only read the 365 location and never saw it): every location the account can see */
    $cfg = squareCfg(); if (!$cfg) return null;
    $since = gmdate('Y-m-d\TH:i:s\Z', $from); $cur = ''; $out = [];
    for ($pg = 0; $pg < $pages; $pg++) {
        $r = squareApi('GET', '/v2/payments?begin_time=' . rawurlencode($since) . ($allLocs ? '' : '&location_id=' . rawurlencode((string) $cfg['location'])) . '&limit=100' . ($cur !== '' ? '&cursor=' . rawurlencode($cur) : ''));
        if (($r['_status'] ?? 0) !== 200 && empty($r['payments'])) return $pg ? $out : null;
        foreach (($r['payments'] ?? []) as $py) $out[] = $py;
        $cur = (string) ($r['cursor'] ?? ''); if ($cur === '') break;
    }
    return $out;
}
/* ---- the name-and-amount match (2026-10-20, Matthew: "build out the system that can add the name and amount match so payments taken
 * straight in Square still get picked up within 15 minutes"). Randy Cruickshank paid $468 through a payment link made by hand in Square;
 * the app had never linked him to a Square customer, so the customer-id match above could not see it. A payment counts for a job only when
 * ALL of these hold: completed; its amount less refunds equals what the job owes, to the cent; the full name (first and last) on its Square
 * customer record or card matches the job's customer; it is not already counted anywhere in the app; and it is not older than the booking
 * less three days. Two candidate payments for one job, or a one-word name, and it is left to a person. ---- */
function nameKey(string $s): string { return trim((string) preg_replace('/\s+/', ' ', (string) preg_replace('/[^a-z ]/', '', strtolower(str_replace(['-', '.'], ' ', $s))))); }
function squareCustName(string $cid): string {
    static $c = [];
    if ($cid === '') return '';
    if (!array_key_exists($cid, $c)) { $r = squareApi('GET', '/v2/customers/' . rawurlencode($cid)); $cu = $r['customer'] ?? []; $c[$cid] = nameKey(trim((string) ($cu['given_name'] ?? '') . ' ' . (string) ($cu['family_name'] ?? ''))); }
    return $c[$cid];
}
/* every Square payment and order the app already counts, anywhere, so one payment is never counted for two jobs */
function squarePayUsed(): array {
    static $u = null; if ($u !== null) return $u;
    $ids = []; $orders = [];
    foreach (leadsAll() as $l) { foreach (['sqpaid', 'sqafter'] as $k) if (!empty($l[$k]['payment'])) $ids[(string) $l[$k]['payment']] = 1; if (!empty($l['sign']['pay']['order'])) $orders[(string) $l['sign']['pay']['order']] = 1; }
    foreach (jobsAll() as $j) { foreach (['sqcharge', 'sqpaid'] as $k) if (!empty($j[$k]['payment'])) $ids[(string) $j[$k]['payment']] = 1; if (!empty($j['sqlink']['order'])) $orders[(string) $j['sqlink']['order']] = 1; foreach ((array) ($j['sqparts'] ?? []) as $pp) if (!empty($pp['payment'])) $ids[(string) $pp['payment']] = 1; }
    foreach (squareConfirmed() as $pid => $r) if ($pid !== '') $ids[$pid] = 1;   /* confirmed or set aside by a person (2026-10-20) */
    return $u = [$ids, $orders];
}
/* a lead's full names, the one it has now and any it had before (2026-10-20: "Jeremy Kaplan" was shortened to "Jeremy" in the Quick quote) */
function leadNameKeys(array $l): array { return array_values(array_filter(array_unique(array_map(fn($n) => nameKey((string) $n), array_merge([(string) ($l['name'] ?? '')], (array) ($l['names'] ?? [])))), fn($k) => strpos($k, ' ') !== false)); }
function squareNameMatch(array $j, array $l, array $pays): ?array {
    static $claimed = [];
    $owed = jobOwed($j) * 100; $keys = leadNameKeys($l); $key = $keys[0] ?? '';
    if ($owed < 100 || $key === '') return null;
    $leads = leadsAll(); $twins = 0;   /* two jobs owing the same amount under the same name: no telling which one paid */
    foreach (jobsAll() as $o) if (!$o['off'] && jobOwed($o) * 100 === $owed && array_intersect(leadNameKeys($leads[$o['lead']] ?? []), $keys)) $twins++;
    if ($twins > 1) return null;
    [$used, $usedOrders] = squarePayUsed(); $from = (int) ($j['at'] ?? 0) - 3 * 86400; $hits = [];
    foreach ($pays as $py) {
        $id = (string) ($py['id'] ?? '');
        if (($py['status'] ?? '') !== 'COMPLETED' || $id === '' || isset($used[$id]) || isset($claimed[$id]) || isset($usedOrders[(string) ($py['order_id'] ?? '')])) continue;
        if ((int) strtotime((string) ($py['created_at'] ?? '')) < $from) continue;
        if ((int) ($py['amount_money']['amount'] ?? 0) - (int) ($py['refunded_money']['amount'] ?? 0) !== $owed) continue;
        $names = [nameKey((string) ($py['card_details']['card']['cardholder_name'] ?? ''))];
        if (!empty($py['customer_id'])) $names[] = squareCustName((string) $py['customer_id']);
        if (array_intersect($keys, $names)) $hits[] = $py;
    }
    if (count($hits) !== 1) return null;
    $hit = $hits[0]; $claimed[(string) $hit['id']] = 1;
    return ['payment' => (string) $hit['id'], 'amt' => intdiv($owed, 100), 'last4' => (string) ($hit['card_details']['card']['last_4'] ?? ''), 'brand' => (string) ($hit['card_details']['card']['card_brand'] ?? ''), 'when' => (string) $hit['created_at'], 'match' => 'name'];
}
function squareBalancePaid(array $j, array $l, ?array $pays = null): ?array {
    $cust = (string) ($l['sqcust'] ?? ''); $owed = jobOwed($j); $cfg = squareCfg();
    if ($owed < 1 || !$cfg) return null;
    if ($pays === null) $pays = squarePaymentsSince(max(0, (int) ($j['at'] ?? time()) - 3 * 86400), 4, true) ?? [];
    if ($cust === '') return squareNameMatch($j, $l, $pays);   /* no Square customer linked: the name-and-amount match only */
    [$ids, $orders] = jobKnownPays($j, $l);
    $sum = 0; $hit = null;
    for ($pg = 0; $pg < 1; $pg++) {
        foreach ($pays as $py) {
            if (($py['status'] ?? '') !== 'COMPLETED' || (string) ($py['customer_id'] ?? '') !== $cust) continue;
            if (in_array((string) $py['id'], $ids, true) || in_array((string) ($py['order_id'] ?? ''), $orders, true)) continue;
            $sum += (int) ($py['amount_money']['amount'] ?? 0) - (int) ($py['refunded_money']['amount'] ?? 0);
            if (!$hit || strcmp((string) $py['created_at'], (string) $hit['created_at']) > 0) $hit = $py;
        }
    }
    if (!$hit || $sum < $owed * 100) return squareNameMatch($j, $l, $pays);   /* nothing under their linked customer: try the name and amount */
    return ['payment' => (string) $hit['id'], 'amt' => intdiv($sum, 100), 'last4' => (string) ($hit['card_details']['card']['last_4'] ?? ''), 'brand' => (string) ($hit['card_details']['card']['card_brand'] ?? ''), 'when' => (string) $hit['created_at']];
}
/* the sweep: every job still owing from a customer in Square, against one fetch of Square's recent payments (2026-10-19) */
function squareSweep(): array {
    if (!squareCfg()) return ['ok' => false, 'error' => 'Square is not connected.'];
    $leads = leadsAll(); $owing = []; $from = time();
    foreach (jobsAll() as $j) { if ($j['off'] || jobOwed($j) < 1) continue; $l = $leads[$j['lead']] ?? null; if (!$l) continue; $owing[] = [$j, $l]; $from = min($from, (int) ($j['at'] ?? time())); }   /* every owing job now, not only Square-linked ones: the name-and-amount match covers the rest (2026-10-20) */
    if (!$owing) return ['ok' => true, 'owing' => 0, 'paid' => 0];
    $pays = squarePaymentsSince(max(time() - 45 * 86400, $from - 3 * 86400), 10, true);
    if ($pays === null) return ['ok' => false, 'error' => 'Square did not answer.'];
    $paid = 0;
    $took = [];
    foreach ($owing as [$j, $l]) { $f = squareBalancePaid($j, $l, $pays); if ($f) { jobSquareFound((string) $j['id'], $f, ($f['match'] ?? '') === 'name' ? 'by the Square check, matched by name and amount' : 'by the Square check'); $took[$f['payment']] = 1; $paid++; } }
    $conf = squareConfirmAlert(array_filter($pays, fn($p) => !isset($took[(string) ($p['id'] ?? '')]) && (int) strtotime((string) ($p['created_at'] ?? '')) >= time() - 14 * 86400));
    return ['ok' => true, 'owing' => count($owing), 'paid' => $paid, 'toconfirm' => $conf];
}
/* ---- Square payments to confirm (2026-10-20, Matthew: "obviously inputting stuff manually would be best but we need to determine how we can
 * automate it but do it with less errors"). The app counts a payment by itself only when it cannot be wrong: its own pay links and card
 * charges (the order is ours), a linked Square customer paying what is owed, or the full name with the exact amount. Every other completed
 * payment at our location in the last 14 days is offered here, with the jobs it most likely belongs to and why (same phone, same email, same
 * name, the amount owed), for the office to confirm: paid in full, a part payment, or not ours. Who confirmed is kept. Jeremy Kaplan paid $350
 * against $482 owed on 20 Oct and nothing said so; that is what this is for. ---- */
function squareConfirmFile(): string { return DATA_DIR . '/square-confirm.log'; }
function squareConfirmed(): array { $o = []; foreach (readLines(squareConfirmFile()) as $r) if (!empty($r['payment'])) $o[(string) $r['payment']] = $r; return $o; }
function squareCustInfo(string $cid): array {
    static $c = [];
    if ($cid === '') return ['name' => '', 'phone' => '', 'email' => ''];
    if (!isset($c[$cid])) { $cu = squareApi('GET', '/v2/customers/' . rawurlencode($cid))['customer'] ?? [];
        $c[$cid] = ['name' => trim((string) ($cu['given_name'] ?? '') . ' ' . (string) ($cu['family_name'] ?? '')), 'phone' => substr((string) preg_replace('/\D/', '', (string) ($cu['phone_number'] ?? '')), -10), 'email' => strtolower(trim((string) ($cu['email_address'] ?? '')))]; }
    return $c[$cid];
}
function squareToConfirm(array $pays): array {
    [$used, $usedOrders] = squarePayUsed(); $leads = leadsAll(); $out = [];
    $owing = []; foreach (jobsAll() as $j) if (!$j['off'] && jobOwed($j) > 0 && isset($leads[$j['lead']])) $owing[] = $j;
    /* jobs marked paid by Square or card by hand, never tied to a Square payment (2026-10-20, Carlos Perez): a payment of the same amount within
       three days of the job is offered as "already recorded", to link */
    $unlinked = []; foreach (jobsAll() as $j) if (!$j['off'] && ($j['pay']['s'] ?? '') === 'paid' && in_array((string) ($j['pay']['how'] ?? ''), ['square', 'card'], true) && empty($j['sqpaid']['payment']) && empty($j['sqcharge']['payment']) && isset($leads[$j['lead']])) $unlinked[] = $j;
    $d10 = fn($p) => substr((string) preg_replace('/\D/', '', (string) $p), -10);
    foreach ($pays as $p) {
        $id = (string) ($p['id'] ?? '');
        if (($p['status'] ?? '') !== 'COMPLETED' || $id === '' || isset($used[$id]) || isset($usedOrders[(string) ($p['order_id'] ?? '')])) continue;
        $net = (int) ($p['amount_money']['amount'] ?? 0) - (int) ($p['refunded_money']['amount'] ?? 0); if ($net < 100) continue;
        $cu = squareCustInfo((string) ($p['customer_id'] ?? ''));
        $name = $cu['name'] !== '' ? $cu['name'] : trim((string) ($p['card_details']['card']['cardholder_name'] ?? ''));
        $em = $cu['email'] !== '' ? $cu['email'] : strtolower(trim((string) ($p['buyer_email_address'] ?? '')));
        $nk = nameKey($name); $first = $nk !== '' ? explode(' ', $nk)[0] : ''; $cands = [];
        foreach ($owing as $j) {
            $l = $leads[$j['lead']]; $why = []; $sc = 0; $lk = nameKey((string) ($l['name'] ?? '')); $lks = leadNameKeys($l);
            if (strlen($cu['phone']) === 10 && $cu['phone'] === $d10($l['phone'] ?? '')) { $sc += 3; $why[] = 'same phone'; }
            if ($em !== '' && $em === strtolower(trim((string) ($l['email'] ?? '')))) { $sc += 3; $why[] = 'same email'; }
            if ($nk !== '' && substr_count($nk, ' ') >= 1 && in_array($nk, $lks, true)) { $sc += 3; $why[] = $lk === $nk ? 'same name' : 'same name as the lead had before'; }
            elseif ($first !== '' && $lk !== '' && explode(' ', $lk)[0] === $first) { $sc += 1; $why[] = 'same first name'; }
            if ($sc < 1) continue;
            $owed = jobOwed($j);
            if ($net === $owed * 100) { $sc += 2; $why[] = 'the exact $' . $owed . ' owed'; } elseif ($net < $owed * 100) $why[] = 'less than the $' . $owed . ' owed'; else $why[] = 'more than the $' . $owed . ' owed';
            $cands[] = ['job' => (string) $j['id'], 'name' => (string) ($l['name'] ?? ''), 'owed' => $owed, 'price' => (int) $j['price'], 'date' => (string) $j['date'], 'score' => $sc, 'why' => $why];
        }
        $pat = (int) strtotime((string) ($p['created_at'] ?? ''));
        foreach ($unlinked as $j) {
            $jd = (int) strtotime((string) $j['date'] . ' 12:00:00');
            if ($net !== (int) $j['price'] * 100 || abs($pat - $jd) > 4 * 86400) continue;
            $l = $leads[$j['lead']];
            $cands[] = ['job' => (string) $j['id'], 'name' => (string) ($l['name'] ?? ''), 'owed' => 0, 'price' => (int) $j['price'], 'date' => (string) $j['date'], 'score' => 2, 'done' => true, 'why' => ['already marked paid ($' . (int) $j['price'] . ', ' . ((string) ($j['pay']['how'] ?? '') === 'card' ? 'card' : 'Square') . ') with no Square payment tied to it', 'same amount, within days of the job']];
        }
        usort($cands, fn($a, $b) => $b['score'] <=> $a['score']);
        $card = trim((string) (($p['card_details']['card']['card_brand'] ?? '') . ' ' . ($p['card_details']['card']['last_4'] ?? '')));
        $out[] = ['payment' => $id, 'amt' => round($net / 100, 2), 'at' => (int) strtotime((string) ($p['created_at'] ?? '')), 'name' => $name, 'card' => $card, 'note' => mb_substr((string) ($p['note'] ?? ''), 0, 120), 'cands' => array_slice($cands, 0, 3)];
    }
    usort($out, fn($a, $b) => $b['at'] <=> $a['at']);
    return $out;
}
/* from the 15-minute sweep: a push to the office and Matthew for each new payment to confirm (once each) */
function squareConfirmAlert(array $pays): int {
    $list = squareToConfirm($pays); $f = DATA_DIR . '/square-confirm-seen.json';
    $seen = json_decode((string) @file_get_contents($f), true); if (!is_array($seen)) $seen = [];
    $new = array_values(array_filter($list, fn($x) => !isset($seen[$x['payment']])));
    foreach ($new as $x) { $seen[$x['payment']] = time(); a365Alert('Square payment to confirm', ($x['name'] !== '' ? $x['name'] : 'Someone') . ' paid $' . number_format($x['amt'], 2) . (!empty($x['cands']) ? ' · maybe ' . $x['cands'][0]['name'] . ' ($' . $x['cands'][0]['owed'] . ' owed)' : ''), true, false, !empty($x['cands']) && isset(webLeadIds()[(string) (jobsAll()[(string) $x['cands'][0]['job']]['lead'] ?? '')])); }
    if ($new) writeJsonAtomic($f, $seen);
    return count($list);
}
/* a part payment on a job: paid so far plus this; paid in full once it covers the price */
function jobAddPart(array $j, int $amt, string $how, string $by, ?array $sq = null): array {
    $prev = ($j['pay']['s'] ?? '') === 'deposit' ? (int) ($j['pay']['amt'] ?? 0) : 0; $tot = $prev + $amt; $price = (int) $j['price'];
    $pay = $tot >= $price ? ['s' => 'paid', 'how' => $how] : ['s' => 'deposit', 'amt' => $tot, 'how' => $how, 'part' => 1];
    $row = ['id' => (string) $j['id'], 'pay' => $pay, 'by' => $by, 'at' => time()];
    if ($sq) { $parts = (array) ($j['sqparts'] ?? []); $parts[] = $sq; $row['sqparts'] = $parts; }
    appendLine(DATA_DIR . '/jobs.log', $row);
    return ['tot' => $tot, 'left' => max(0, $price - $tot), 'paid' => $tot >= $price];
}
/* ---- the stats page (2026-10-20): admins and the office. Everything from the app's own records except ad spend, which Meta does not share
 * with the app yet: an admin types each ad's lifetime spend (ad-spend.json; the first three entries are Matthew's Meta screenshots of 20 Oct). ---- */
function adSpendFile(): string { return DATA_DIR . '/ad-spend.json'; }
function adSpend(): array {
    $j = json_decode((string) @file_get_contents(adSpendFile()), true);
    if (is_array($j) && isset($j['ads'])) return $j['ads'];
    return [   /* Matthew's Meta screenshots (19 and 20 Oct); replaced as soon as anyone saves new figures */
        ['key' => 'form1', 'label' => 'Instant Form ad (13-14 Oct, paused)', 'src' => 'meta', 'spend' => 169.28, 'results' => 21, 'asof' => '2026-10-19', 'by' => 'Matthew\'s Meta screenshot'],
        ['key' => 'form2', 'label' => 'Instant Form ad (since 19 Oct)', 'src' => 'meta', 'spend' => 134.84, 'results' => 9, 'asof' => '2026-10-20', 'by' => 'Matthew\'s Meta screenshot'],
        ['key' => 'msgr', 'label' => 'Messenger ad (since 15 Oct)', 'src' => 'messenger', 'spend' => 541.07, 'results' => 51, 'asof' => '2026-10-20', 'by' => 'Matthew\'s Meta screenshot'],
    ];
}
/** the printed QR codes' scan counts from the 365 site (2026-10-21), cached 10 minutes; null when the site does not answer */
function qrScans(): ?array {
    $cf = DATA_DIR . '/qr-scans-cache.json'; $c = json_decode((string) @file_get_contents($cf), true);
    if (is_array($c) && (int) ($c['at'] ?? 0) > time() - 600) return $c['pieces'] ?? [];
    $key = trim((string) @file_get_contents(dirname(__DIR__, 2) . '/sixfold-private/a365-relay-key.txt')); if (strlen($key) < 32) return null;
    $url = 'https://365aeration.com/api/scans.php';
    if (PHP_SAPI === 'cli-server' && is_file(dirname(__DIR__, 2) . '/sixfold-private/a365-scans-url.txt')) $url = trim((string) file_get_contents(dirname(__DIR__, 2) . '/sixfold-private/a365-scans-url.txt'));   /* the test server's stand-in */
    $h = curl_init($url); curl_setopt_array($h, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_HTTPHEADER => ['X-Site-Key: ' . $key], CURLOPT_USERAGENT => 'Sixfold app']);
    $r = curl_exec($h); $code = (int) curl_getinfo($h, CURLINFO_HTTP_CODE); curl_close($h);
    $j = is_string($r) ? json_decode($r, true) : null;
    if ($code !== 200 || !is_array($j) || empty($j['ok'])) return is_array($c) ? ($c['pieces'] ?? []) : null;
    @file_put_contents($cf, json_encode(['at' => time(), 'pieces' => $j['pieces'] ?? []]), LOCK_EX);
    return $j['pieces'] ?? [];
}
function jobPaidSoFar(array $j): int { $p = $j['pay'] ?? []; $s0 = (string) ($p['s'] ?? 'unpaid'); return $s0 === 'paid' ? (int) $j['price'] : ($s0 === 'deposit' ? (int) ($p['amt'] ?? 0) : 0); }
if ($action === 'statspage') {
    if (!feature('walkdesk') || !desk()) fail('Not allowed.', 403);
    $tz = new DateTimeZone(appTz()); $today = new DateTime('today', $tz);
    $mon = (clone $today)->modify('-' . (((int) $today->format('N')) - 1) . ' days');   /* this week's Monday */
    $d = fn(DateTime $x) => $x->format('Y-m-d');
    $thisFrom = $d($mon); $thisTo = $d((clone $mon)->modify('+6 days'));
    $lastFrom = $d((clone $mon)->modify('-7 days')); $lastTo = $d((clone $mon)->modify('-1 day'));
    $ts = fn(string $ymd, bool $end = false) => (new DateTime($ymd . ($end ? ' 23:59:59' : ' 00:00:00'), $tz))->getTimestamp();
    $leads = leadsAll(); $jobs = array_filter(jobsAll(), fn($j) => !$j['off'] && !preg_match('/\btest\b|claude/i', (string) ($leads[$j['lead']]['name'] ?? '')));
    $realLead = fn($l) => !preg_match('/\btest\b|claude/i', (string) ($l['name'] ?? ''));
    $jobOfLead = []; foreach ($jobs as $j) $jobOfLead[(string) $j['lead']] = $j;
    $row = function (array $j) use ($leads) { $l = $leads[$j['lead']] ?? []; return ['id' => (string) $j['id'], 'name' => trim((string) ($l['name'] ?? '')) ?: 'A customer', 'src' => (string) ($l['src'] ?? ''), 'date' => (string) $j['date'], 'slot' => (string) (jobSlot((string) $j['slot'])[1] ?? $j['slot']), 'crew' => (string) $j['crew'], 'price' => (int) $j['price'], 'paid' => jobPaidSoFar($j), 'owed' => jobOwed($j), 'done' => (string) ($j['done']['o'] ?? '')]; };
    /* 1. last week */
    /* quoted: in the app or in Jen's ClickUp (2026-10-21: the app alone showed 9 of 40; 21 were quoted) */
    $wasQuoted = fn($l) => !empty($l['quote']) || in_array($l['status'] ?? '', ['quoted', 'won'], true) || isset($jobOfLead[$l['id']]) || in_array(strtolower(trim((string) ($l['cus'] ?? ''))), ['quote sent', 'scheduled', 'completed'], true);
    $qPrice = fn($l) => (int) ($l['quote']['price'] ?? 0) ?: (int) ($l['cud'] ?? 0);   /* the app's quote, else ClickUp's deal value */
    $lw = ['from' => $lastFrom, 'to' => $lastTo, 'jobs' => [], 'leads' => [], 'quotes' => 0, 'booked' => 0];
    foreach ($jobs as $j) if ($j['date'] >= $lastFrom && $j['date'] <= $lastTo) $lw['jobs'][] = $row($j);
    foreach ($jobs as $j) if ((int) ($j['at'] ?? 0) >= $ts($lastFrom) && (int) ($j['at'] ?? 0) <= $ts($lastTo, true)) $lw['booked']++;
    foreach ($leads as $l) { if (!$realLead($l)) continue; $at = (int) ($l['at'] ?? 0); if ($at >= $ts($lastFrom) && $at <= $ts($lastTo, true)) $lw['leads'][(string) ($l['src'] ?? 'other')] = ($lw['leads'][(string) ($l['src'] ?? 'other')] ?? 0) + 1;
        if ($at >= $ts($lastFrom) && $at <= $ts($lastTo, true) && $wasQuoted($l)) $lw['quotes']++; }   /* last week's leads quoted so far */
    /* 2. this week */
    $tw = ['from' => $thisFrom, 'to' => $thisTo, 'jobs' => [], 'holds' => []];
    foreach ($jobs as $j) if ($j['date'] >= $thisFrom && $j['date'] <= $thisTo) $tw['jobs'][] = $row($j);
    usort($tw['jobs'], fn($a, $b) => [$a['date'], $a['slot']] <=> [$b['date'], $b['slot']]);
    $holds = jobHolds($leads);
    foreach ($holds as $h) if ($h['date'] >= $thisFrom && $h['date'] <= $thisTo) $tw['holds'][] = ['name' => $h['name'], 'date' => $h['date'], 'slot' => (string) (jobSlot((string) $h['slot'])[1] ?? $h['slot']), 'crew' => $h['crew'], 'price' => (int) ($leads[$h['lead']]['quote']['price'] ?? 0)];
    /* 3. ads: spend as typed, leads and jobs by the lead's source */
    $ads = adSpend(); $bySrc = [];
    foreach ($leads as $l) { if (!$realLead($l)) continue; $src = (string) ($l['src'] ?? ''); if (!in_array($src, ['meta', 'messenger'], true)) continue; $bySrc[$src]['leads'] = ($bySrc[$src]['leads'] ?? 0) + 1;
        if (isset($jobOfLead[$l['id']])) { $j = $jobOfLead[$l['id']]; $bySrc[$src]['jobs'] = ($bySrc[$src]['jobs'] ?? 0) + 1; $bySrc[$src]['booked'] = ($bySrc[$src]['booked'] ?? 0) + (int) $j['price']; $bySrc[$src]['paid'] = ($bySrc[$src]['paid'] ?? 0) + jobPaidSoFar($j); } }
    $adOut = [];
    foreach (['meta' => 'Instant Form', 'messenger' => 'Messenger'] as $src => $label) {
        $sp = 0.0; $res = 0; $asof = ''; foreach ($ads as $a) if (($a['src'] ?? '') === $src) { $sp += (float) $a['spend']; $res += (int) ($a['results'] ?? 0); $asof = max($asof, (string) ($a['asof'] ?? '')); }
        $b = $bySrc[$src] ?? []; $jn = (int) ($b['jobs'] ?? 0);
        $adOut[] = ['src' => $src, 'label' => $label, 'spend' => round($sp, 2), 'results' => $res, 'asof' => $asof, 'leads' => (int) ($b['leads'] ?? 0), 'jobs' => $jn, 'booked' => (int) ($b['booked'] ?? 0), 'paid' => (int) ($b['paid'] ?? 0), 'perJob' => $jn ? round($sp / $jn, 2) : null, 'perLead' => $res ? round($sp / $res, 2) : null];
    }
    /* 4. monthly plans: active customers on a recurring plan, and what they bring in a month */
    $plans = []; $mrr = 0.0; $per = ['monthly' => 1, 'quarterly' => 1 / 3, 'yearly' => 1 / 12];
    foreach (loadCustomers() as $c) { $pl = (string) ($c['plan'] ?? 'oneoff'); if (($c['status'] ?? 'active') !== 'active' || !isset($per[$pl])) continue;
        $m = round((float) ($c['price'] ?? 0) * $per[$pl], 2); $mrr += $m; $plans[] = ['name' => (string) ($c['name'] ?? ''), 'plan' => $pl, 'monthly' => $m]; }
    /* 5. six weeks: booked work + quoted leads x the close rate + plan income */
    $cut = time() - 60 * 86400; $quoted = 0; $won = 0;
    foreach ($leads as $l) { if (!$realLead($l) || (int) ($l['at'] ?? 0) < $cut || !$wasQuoted($l)) continue; $quoted++; if (isset($jobOfLead[$l['id']]) || ($l['status'] ?? '') === 'won') $won++; }   /* leads of the last 60 days that were quoted, and how many booked */
    $close = $quoted ? $won / $quoted : 0.0;
    $pipe = 0; $pipeN = 0; foreach ($leads as $l) { if (!$realLead($l) || isset($jobOfLead[$l['id']]) || in_array($l['status'] ?? '', ['lost', 'won'], true) || !$wasQuoted($l) || $qPrice($l) < 1) continue; $pipe += $qPrice($l); $pipeN++; }
    $weeks = [];
    for ($w = 0; $w < 6; $w++) {
        $f = $d((clone $mon)->modify('+' . (7 * $w) . ' days')); $t = $d((clone $mon)->modify('+' . (7 * $w + 6) . ' days'));
        $bk = 0; $bn = 0; foreach ($jobs as $j) if ($j['date'] >= $f && $j['date'] <= $t) { $bk += (int) $j['price']; $bn++; }
        $exp = round($pipe * $close / 6); $planW = round($mrr * 12 / 52);
        $weeks[] = ['from' => $f, 'to' => $t, 'booked' => $bk, 'jobs' => $bn, 'pipeline' => (int) $exp, 'plans' => (int) $planW, 'total' => (int) ($bk + $exp + $planW)];
    }
    /* 6. doors, the whole company: last week and this week */
    $doors = []; $td = array_filter(teamDays(15, ''), fn($p) => !boardHidden((string) $p['name']));   /* 15 days reach last Monday */
    foreach (['last' => [$lastFrom, $lastTo], 'this' => [$thisFrom, $thisTo]] as $k => [$f, $t]) {
        $sum = ['doors' => 0, 'talked' => 0, 'booked' => 0, 'people' => 0];
        foreach ($td as $p) { $any = false; foreach ($p['days'] as $r) if ($r['date'] >= $f && $r['date'] <= $t) { $sum['doors'] += (int) $r['doors']; $sum['talked'] += (int) $r['booked'] + (int) $r['later'];   /* as the Office dashboard counts it */ $sum['booked'] += (int) $r['booked']; if ((int) $r['doors'] > 0) $any = true; } if ($any) $sum['people']++; }
        $doors[$k] = $sum;
    }
    $web = ['n' => 0, 'came' => [], 'hear' => [], 'before' => 0];
    foreach ($leads as $l) { if (!$realLead($l) || ($l['src'] ?? '') !== 'a365web' || (string) ($l['by'] ?? '') === 'ClickUp') continue; $web['n']++;
        if (empty($l['came'])) { $web['before']++; continue; } $web['came'][$l['came']] = ($web['came'][$l['came']] ?? 0) + 1;
        if (!empty($l['hear'])) { $hl = A365_HEAR[$l['hear']] ?? $l['hear']; $web['hear'][$hl] = ($web['hear'][$hl] ?? 0) + 1; } }
    arsort($web['came']); arsort($web['hear']);
    /* the printed QR codes (2026-10-21): scans from the 365 site, leads and jobs from the form's from=<piece> */
    $qr = ['pieces' => [], 'answer' => true]; $sc = qrScans(); if ($sc === null) { $qr['answer'] = false; $sc = []; }
    foreach (['yard' => 'Yard signs', 'card' => 'Business cards', 'truck' => 'Truck magnets', 'car' => 'Car magnet'] as $pk => $plabel) {
        $ln = 0; $jn = 0; $bk = 0;
        foreach ($leads as $l) { if (!$realLead($l) || (string) ($l['qr'] ?? '') !== $pk) continue; $ln++; if (isset($jobOfLead[$l['id']])) { $jn++; $bk += (int) $jobOfLead[$l['id']]['price']; } }
        $s0 = $sc[$pk] ?? []; $qr['pieces'][] = ['key' => $pk, 'label' => $plabel, 'scans' => (int) ($s0['total'] ?? 0), 'week' => (int) ($s0['week'] ?? 0), 'last' => (int) ($s0['last'] ?? 0), 'leads' => $ln, 'jobs' => $jn, 'booked' => $bk];
    }
    out(['ok' => true, 'qr' => $qr, 'web' => $web, 'today' => $d($today), 'last' => $lw, 'this' => $tw, 'ads' => $adOut, 'adRows' => $ads, 'plans' => ['list' => $plans, 'mrr' => round($mrr, 2)],
         'proj' => ['weeks' => $weeks, 'close' => round($close, 3), 'quoted' => $quoted, 'won' => $won, 'pipe' => $pipe, 'pipeN' => $pipeN], 'doors' => $doors, 'canEdit' => $role === 'admin']);
}
/** the end-of-day reminder (2026-10-21): after 7 pm, once a day, a push to the admins when no one has typed the ad spend today */
function adSpendReminder(): void {
    global $basePeople, $acct, $sessionKey;
    if (!feature('walkdesk') || !company()['a365']) return;
    $tz = new DateTimeZone(appTz()); $now = new DateTime('now', $tz); if ((int) $now->format('G') < 19) return;
    $today = $now->format('Y-m-d'); $f = DATA_DIR . '/ad-spend-reminded.txt';
    if (trim((string) @file_get_contents($f)) === $today) return;
    $j = json_decode((string) @file_get_contents(adSpendFile()), true);
    if (is_array($j) && !empty($j['at']) && (new DateTime('@' . (int) $j['at']))->setTimezone($tz)->format('Y-m-d') === $today) { @file_put_contents($f, $today); return; }
    @file_put_contents($f, $today);
    $v = pushVapid(false); if (!$v) return;
    $subs = pushSubs(); $payload = json_encode(['title' => 'End of day: ad spend', 'body' => 'Type today\'s Meta spend in Stats \u2192 Update ad spend. The ad report updates from it.', 'url' => './', 'tag' => 'adspend-' . $today, 'at' => time()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    foreach (acctRows($basePeople, $acct, $sessionKey) as $r) if (!$r['off'] && in_array($r['role'], ['admin', 'super'], true) && !boardHidden((string) $r['name'])) foreach (($subs[$r['id']] ?? []) as $d) { try { webpushSend($d['sub'], $payload, $v, 43200, ['urgency' => 'normal']); } catch (Throwable $e) {} }
}
/* the ad report (2026-10-21): Instant Form vs Messenger, as on the sheets of 19 and 20 Oct, from the app's own records and the typed spend */
if ($action === 'adreport') {
    if (!feature('walkdesk') || !desk()) fail('Not allowed.', 403);
    $leads = leadsAll(); $real = fn($l) => !preg_match('/\btest\b|claude/i', (string) ($l['name'] ?? ''));
    $short = function ($n) { $p = preg_split('/\s+/', trim((string) $n)); return ($p[0] ?? 'Someone') . (isset($p[1]) && $p[1] !== '' ? ' ' . mb_substr($p[1], 0, 1) . '.' : ''); };
    $jobOf = []; foreach (jobsAll() as $j) if (!$j['off']) $jobOf[(string) $j['lead']] = $j;
    $today = (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d');
    $src = ['meta' => ['label' => 'Instant Form', 'jobs' => [], 'held' => [], 'leads' => 0], 'messenger' => ['label' => 'Messenger', 'jobs' => [], 'held' => [], 'leads' => 0]];
    $web = [];
    foreach ($leads as $l) {
        if (!$real($l)) continue; $s = (string) ($l['src'] ?? '');
        if ($s === 'a365web' && ($l['by'] ?? '') !== 'ClickUp') { $j = $jobOf[$l['id']] ?? null; $web[] = ['name' => $short($l['name']), 'came' => (string) ($l['came'] ?? ''), 'job' => $j ? ['price' => (int) $j['price'], 'date' => $j['date'], 'paid' => jobPaidSoFar($j), 'done' => ($j['done']['o'] ?? '') === 'done'] : null]; continue; }
        if (!isset($src[$s])) continue;
        $src[$s]['leads']++;
        if (isset($jobOf[$l['id']])) { $j = $jobOf[$l['id']]; $src[$s]['jobs'][] = ['name' => $short($l['name']), 'price' => (int) $j['price'], 'date' => $j['date'], 'paid' => jobPaidSoFar($j), 'owed' => jobOwed($j), 'done' => ($j['done']['o'] ?? '') === 'done', 'future' => $j['date'] >= $today]; }
        elseif (is_array($l['quote']['offer'] ?? null) && ($l['quote']['offer']['date'] ?? '') >= $today && ($l['status'] ?? '') !== 'lost') $src[$s]['held'][] = ['name' => $short($l['name']), 'price' => (int) ($l['quote']['price'] ?? 0), 'date' => (string) $l['quote']['offer']['date'], 'form' => !empty($l['sign'])];
    }
    foreach ($src as &$x) usort($x['jobs'], fn($a, $b) => strcmp($a['date'], $b['date'])); unset($x);
    out(['ok' => true, 'today' => $today, 'ads' => adSpend(), 'src' => $src, 'web' => $web, 'spendAt' => (int) (json_decode((string) @file_get_contents(adSpendFile()), true)['at'] ?? 0)]);
}
if ($action === 'adspendsave') {   /* an admin types each ad's lifetime spend from Meta (until Meta shares it with the app) */
    if (!feature('walkdesk') || $role !== 'admin' || !$isPost) fail('Not allowed.', 403);
    $in = is_array($body['ads'] ?? null) ? $body['ads'] : []; $out = [];
    foreach (array_slice($in, 0, 20) as $a) {
        $label = mb_substr(trim((string) ($a['label'] ?? '')), 0, 80); $src = in_array($a['src'] ?? '', ['meta', 'messenger'], true) ? (string) $a['src'] : '';
        if ($label === '' || $src === '') continue;
        $out[] = ['key' => preg_replace('/[^a-z0-9]/', '', strtolower((string) ($a['key'] ?? '')) ) ?: 'ad' . count($out), 'label' => $label, 'src' => $src, 'spend' => max(0, round((float) ($a['spend'] ?? 0), 2)), 'results' => max(0, (int) ($a['results'] ?? 0)), 'asof' => date('Y-m-d'), 'by' => $me];
    }
    if (!$out) fail('Add at least one ad with a name and where its leads come from.');
    if (!writeJsonAtomic(adSpendFile(), ['ads' => $out, 'at' => time(), 'by' => $me])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
function squarePageOk(): bool { global $role, $session; return feature('walkdesk') && ($role === 'admin' || $role === 'office' || paysOn((string) ($session['c'] ?? ''))); }
if ($action === 'squarepage') {   /* the Square page (2026-10-21) */
    if (!squarePageOk()) fail('Not allowed.', 403);
    $cfg = squareCfg();
    if (!$cfg) out(['ok' => true, 'connected' => false]);
    $pays = squarePaymentsSince(time() - 14 * 86400, 4);
    if ($pays === null) out(['ok' => true, 'connected' => true, 'env' => (string) $cfg['env'], 'answer' => false]);
    $leads = leadsAll(); $jobs = jobsAll(); $short = function ($n) { $p = preg_split('/\s+/', trim((string) $n)); return ($p[0] ?? '') . (isset($p[1]) && $p[1] !== '' ? ' ' . $p[1] : ''); };
    /* what each payment is tied to in the app */
    $tie = []; $tieOrder = [];
    foreach ($jobs as $j) { if ($j['off']) continue; $nm = $short($leads[$j['lead']]['name'] ?? ($j['title'] ?? '')); $t = ['kind' => 'job', 'name' => $nm, 'date' => (string) $j['date'], 'job' => (string) $j['id']];
        foreach (['sqcharge', 'sqpaid'] as $k) if (!empty($j[$k]['payment'])) $tie[(string) $j[$k]['payment']] = $t;
        foreach ((array) ($j['sqparts'] ?? []) as $pp) if (!empty($pp['payment'])) $tie[(string) $pp['payment']] = $t + ['part' => true];
        if (!empty($j['sqlink']['order'])) $tieOrder[(string) $j['sqlink']['order']] = $t; }
    foreach ($leads as $l) { $t = ['kind' => 'lead', 'name' => $short($l['name'] ?? '')]; foreach (['sqpaid', 'sqafter'] as $k) if (!empty($l[$k]['payment']) && !isset($tie[(string) $l[$k]['payment']])) $tie[(string) $l[$k]['payment']] = $t; if (!empty($l['sign']['pay']['order']) && !isset($tieOrder[(string) $l['sign']['pay']['order']])) $tieOrder[(string) $l['sign']['pay']['order']] = $t + ['deposit' => true]; }
    $conf = squareConfirmed(); $waiting = []; foreach (squareToConfirm($pays) as $x) $waiting[(string) $x['payment']] = $x;
    $tz = new DateTimeZone(appTz()); $t0 = (new DateTime('today', $tz))->getTimestamp(); $t7 = time() - 7 * 86400;
    $tot = ['today' => 0, 'week' => 0, 'all' => 0]; $list = []; $wPay = webHide() ? webPays() : [];
    foreach ($pays as $p) {
        $id = (string) ($p['id'] ?? ''); $at = (int) strtotime((string) ($p['created_at'] ?? ''));
        $amt = (int) ($p['amount_money']['amount'] ?? 0); $back = (int) ($p['refunded_money']['amount'] ?? 0); $st = (string) ($p['status'] ?? '');
        if ($amt === 0 && $back === 0) continue;   /* a $0 card check is not a payment (2026-10-21) */
        if ($st === 'COMPLETED') { $net = ($amt - $back) / 100; $tot['all'] += $net; if ($at >= $t7) $tot['week'] += $net; if ($at >= $t0) $tot['today'] += $net; }
        if ($wPay && (isset($wPay[$id]) || isset($wPay['o:' . ($p['order_id'] ?? '')]))) continue;   /* in the totals, not in the list (2026-10-22) */
        $cu = squareCustInfo((string) ($p['customer_id'] ?? ''));
        $who = $cu['name'] !== '' ? $cu['name'] : trim((string) ($p['card_details']['card']['cardholder_name'] ?? ''));
        $c = $p['card_details']['card'] ?? []; $card = trim((string) ($c['card_brand'] ?? '') . ' ' . (isset($c['last_4']) ? 'ending ' . $c['last_4'] : ''));
        $t = $tie[$id] ?? ($tieOrder[(string) ($p['order_id'] ?? '')] ?? null);
        if (!$t && isset($conf[$id])) $t = ($conf[$id]['act'] ?? '') === 'ignore' ? ['kind' => 'aside'] : ['kind' => 'job', 'name' => $short($leads[$jobs[(string) ($conf[$id]['job'] ?? '')]['lead'] ?? '']['name'] ?? ''), 'date' => (string) ($jobs[(string) ($conf[$id]['job'] ?? '')]['date'] ?? '')];
        if (!$t && isset($waiting[$id])) { $c0 = $waiting[$id]['cands'][0] ?? null; $t = ['kind' => 'confirm', 'name' => $c0 ? $short($c0['name']) : '']; }
        $list[] = ['id' => $id, 'at' => $at, 'amt' => $amt / 100, 'back' => $back / 100, 'status' => $st, 'who' => $who, 'card' => $card, 'note' => mb_substr((string) ($p['note'] ?? ''), 0, 100), 'receipt' => (string) ($p['receipt_url'] ?? ''), 'tie' => $t ?: ['kind' => 'none']];
    }
    usort($list, fn($a, $b) => $b['at'] <=> $a['at']);
    /* pay links sent and not paid */
    $links = []; foreach ($jobs as $j) if (!$j['off'] && !empty($j['sqlink']['url']) && jobOwed($j) > 0) $links[] = ['name' => $short($leads[$j['lead']]['name'] ?? ''), 'owed' => jobOwed($j), 'date' => (string) $j['date'], 'at' => (int) ($j['sqlink']['at'] ?? 0)];
    /* a deposit link stops counting once the job has money on it (2026-10-21, Matthew: Randy, Jeremy and Carlos paid, Jen took it another way): the job says what is owed */
    $jobOf = []; foreach ($jobs as $j) if (!$j['off'] && !isset($jobOf[$j['lead']])) $jobOf[$j['lead']] = $j;
    foreach ($leads as $l) if (($l['sign']['how'] ?? '') === 'link' && !empty($l['sign']['pay']['url']) && !a365DepositPaid($l, false) && !in_array($l['status'] ?? '', ['lost'], true) && ((($jobOf[$l['id']] ?? null)['pay']['s'] ?? 'unpaid') === 'unpaid')) $links[] = ['name' => $short($l['name'] ?? ''), 'owed' => (int) ($l['sign']['deposit'] ?? 0), 'date' => '', 'at' => (int) ($l['sign']['at'] ?? 0), 'deposit' => true];
    out(['ok' => true, 'connected' => true, 'env' => (string) $cfg['env'], 'answer' => true, 'totals' => array_map(fn($v) => round($v, 2), $tot), 'payments' => $list, 'waiting' => count($waiting), 'links' => $links, 'canConfirm' => desk()]);
}
if ($action === 'squareconfirmlist') {
    if (!feature('walkdesk') || !desk()) fail('Not allowed.', 403);
    if (!squareCfg()) out(['ok' => true, 'items' => [], 'note' => 'Square is not connected yet.']);
    $pays = squarePaymentsSince(time() - 14 * 86400, 4); if ($pays === null) fail('Square did not answer. Try again in a minute.');
    if (webHide() && ($wPay = webPays())) $pays = array_values(array_filter($pays, fn($p) => !isset($wPay[(string) ($p['id'] ?? '')]) && !isset($wPay['o:' . ($p['order_id'] ?? '')])));   /* 365-website payments are Matthew's (2026-10-22) */
    out(['ok' => true, 'items' => squareToConfirm($pays)]);
}
if ($action === 'squareconfirm') {
    if (!feature('walkdesk') || !desk() || !$isPost) fail('Not allowed.', 403);
    $pid = (string) ($body['payment'] ?? ''); $act = (string) ($body['act'] ?? '');
    if (!preg_match('/^[A-Za-z0-9]{4,64}$/D', $pid)) fail('No such payment.');
    if (!in_array($act, ['full', 'part', 'ignore', 'link'], true)) fail('Pick what to do with it.');
    $clk = @fopen(squareConfirmFile() . '.lock', 'c'); if (!$clk || !flock($clk, LOCK_EX)) fail('Could not save that. Try again.', 500);
    if (isset(squareConfirmed()[$pid])) fail('Someone already confirmed that payment.', 409);
    [$used] = squarePayUsed(); if (isset($used[$pid])) fail('That payment is already counted on a job.', 409);
    $p = squareApi('GET', '/v2/payments/' . rawurlencode($pid))['payment'] ?? null;
    if (!is_array($p) || ($p['status'] ?? '') !== 'COMPLETED' || (string) ($p['location_id'] ?? '') !== (string) (squareCfg()['location'] ?? '')) fail('Square does not show that payment here.', 404);
    $net = (int) round(((int) ($p['amount_money']['amount'] ?? 0) - (int) ($p['refunded_money']['amount'] ?? 0)) / 100);
    $row = ['id' => $pid, 'payment' => $pid, 'act' => $act, 'amt' => $net, 'by' => $me, 'at' => time()]; $res = ['ok' => true];   /* id: readLines() keeps only rows that have one */
    if ($act === 'link') {   /* the job was marked paid by hand: tie this payment to it, nothing owed changes (2026-10-20) */
        $jid = (string) ($body['job'] ?? ''); $j = jobsAll()[$jid] ?? null;
        if (!$j || $j['off']) fail('No such job.', 404);
        if (jobOwed($j) > 0) fail('That job still owes money: use Paid in full or Part payment.');
        if (!empty($j['sqpaid']['payment']) || !empty($j['sqcharge']['payment'])) fail('That job already has its Square payment.', 409);
        appendLine(DATA_DIR . '/jobs.log', ['id' => $jid, 'sqpaid' => ['payment' => $pid, 'amt' => $net, 'found' => 'linked by ' . $me, 'at' => time()], 'by' => $me, 'at' => time()]);
        appendLine(leadsDir() . '/leadst.log', ['id' => (string) $j['lead'], 'note' => 'Square payment of $' . $net . ' linked to this paid job by ' . $me . '.', 'by' => $me, 'at' => time()]);
        $row['job'] = $jid;
    } elseif ($act !== 'ignore') {
        $jid = (string) ($body['job'] ?? ''); $j = jobsAll()[$jid] ?? null;
        if (!$j || $j['off']) fail('No such job.', 404);
        $owed = jobOwed($j); if ($owed < 1) fail('That job is already paid.');
        $row['job'] = $jid; $who = trim((string) (leadsAll()[$j['lead']]['name'] ?? ''));
        if ($act === 'full') {
            appendLine(DATA_DIR . '/jobs.log', ['id' => $jid, 'pay' => ['s' => 'paid', 'how' => 'square'], 'sqpaid' => ['payment' => $pid, 'amt' => $net, 'found' => 'confirmed by ' . $me, 'at' => time()], 'by' => $me, 'at' => time()]);
            appendLine(leadsDir() . '/leadst.log', ['id' => (string) $j['lead'], 'note' => 'Square payment of $' . $net . ' confirmed as paid in full by ' . $me . ($net !== $owed ? ' (the job showed $' . $owed . ' owed)' : '') . '.', 'by' => $me, 'at' => time()]);
            jobAftercare($jid, 'paid'); $res['paid'] = true;
        } else {
            if ($net >= $owed) fail('That covers the whole $' . $owed . ' balance: use Paid in full.');
            $r = jobAddPart($j, $net, 'square', $me, ['payment' => $pid, 'amt' => $net, 'at' => time(), 'by' => $me]);
            appendLine(leadsDir() . '/leadst.log', ['id' => (string) $j['lead'], 'note' => 'Square part payment of $' . $net . ' confirmed by ' . $me . ': $' . $r['tot'] . ' paid so far, $' . $r['left'] . ' left.', 'by' => $me, 'at' => time()]);
            $res += $r;
        }
    }
    appendLine(squareConfirmFile(), $row);
    out($res);
}
/* a part payment taken another way (cash, check, Zelle...), by hand */
if ($action === 'jobpart') {
    if (!feature('walkdesk') || !$isPost) fail('Not allowed.', 403);
    $jid = (string) ($body['id'] ?? ''); $j = jobsAll()[$jid] ?? null;
    if (!$j || $j['off']) fail('No such job.', 404);
    if (!desk() && !($role === 'quote' && jobOpen($j))) fail('Not allowed.', 403);
    $owed = jobOwed($j); if ($owed < 1) fail('This job is already paid.');
    $amt = (int) ($body['amt'] ?? 0); if ($amt < 1) fail('Give the amount they paid.');
    if ($amt >= $owed) fail('That covers the whole $' . $owed . ' balance: use Mark it paid.');
    $how = in_array($body['how'] ?? '', ['cash', 'check', 'zelle', 'venmo', 'card', 'square', 'other'], true) ? (string) $body['how'] : 'other';
    $r = jobAddPart($j, $amt, $how, $me);
    appendLine(leadsDir() . '/leadst.log', ['id' => (string) $j['lead'], 'note' => 'Part payment of $' . $amt . ' (' . $how . ') recorded by ' . $me . ': $' . $r['tot'] . ' paid so far, $' . $r['left'] . ' left.', 'by' => $me, 'at' => time()]);
    out(['ok' => true] + $r);
}
/* record it: the job paid by Square, a note, the office told, the aftercare */
function jobSquareFound(string $jid, array $f, string $how): void {
    $j = jobsAll()[$jid] ?? null; if (!$j || $j['off'] || jobOwed($j) < 1) return;
    appendLine(DATA_DIR . '/jobs.log', ['id' => $jid, 'pay' => ['s' => 'paid', 'how' => 'square'], 'sqpaid' => ['payment' => $f['payment'], 'amt' => $f['amt'], 'found' => $how, 'at' => time()], 'by' => 'Square', 'at' => time()]);
    $who = trim((string) (leadsAll()[$j['lead']]['name'] ?? ($j['title'] ?? '')));
    appendLine(leadsDir() . '/leadst.log', ['id' => (string) $j['lead'], 'note' => 'Balance paid in Square: $' . $f['amt'] . ($f['last4'] !== '' ? ' on the ' . ($f['brand'] ?: 'card') . ' ending ' . $f['last4'] : '') . ' (found ' . $how . ').', 'by' => 'Square', 'at' => time()]);
    a365Alert('Balance paid in Square', $who . ' · $' . $f['amt'], false, false, isset(webLeadIds()[(string) $j['lead']]));
    jobAftercare($jid, 'paid');
}
function jobOwed(array $j): int { $p = $j['pay'] ?? ['s' => 'unpaid']; if (in_array($p['s'] ?? '', ['paid', 'plan'], true)) return 0; return max(0, (int) $j['price'] - (($p['s'] ?? '') === 'deposit' ? (int) ($p['amt'] ?? 0) : 0)); }
/* the aftercare email (2026-10-19, Matthew: "follow up with aftercare and a reminder to pay if he hasn't already ... how can we automate that
   email out"; "ask first" before any card is charged). Sent once per job, after it is marked Done, when the balance is settled: the card
   charged, marked paid, paid on Square, or a pay link made (the link goes in it); with nothing owed it goes at Done. A 365 job only, from the
   365 mailbox; until that mailbox is set up it records why it did not go. The tips are CSU Extension's own words, logged in
   sixfold/aeration365-site/FACT-CHECK.md: PlantTalk 1505 Lawn Aeration (leave the cores; water soon after) and 1516 Seeding a Lawn (keep the
   surface moist, up to two weeks, then less often and deeper); the seed lines only when seed went down. Nothing about mowing: CSU does not say. */
function jobIs365(array $j): bool {
    if (empty(company()['a365'])) return false;
    $l = leadsAll()[$j['lead']] ?? [];
    global $TEAM; $byQuote = (($TEAM['byName'][(string) ($l['by'] ?? '')]['role'] ?? '') === 'quote');   /* made in Jen's Quick quote */
    return in_array((string) ($l['src'] ?? ''), ['a365web', 'meta', 'messenger'], true) || !empty($l['sign']) || !empty($l['qown']) || !empty($l['quote']) || $byQuote;
}
function jobAftercare(string $jid, string $why, bool $again = false): array {
    global $me;
    $j = jobsAll()[$jid] ?? null;
    if (!$j || $j['off']) return ['ok' => false, 'stage' => 'nojob', 'error' => 'No such job.'];
    if (!$again && !empty($j['aftercare']['ok'])) return ['ok' => true, 'stage' => 'already', 'error' => ''];
    if (($j['done']['o'] ?? '') !== 'done') return ['ok' => false, 'stage' => 'notdone', 'error' => 'The job is not marked done yet.'];
    if (!jobIs365($j)) return ['ok' => false, 'stage' => 'brand', 'error' => 'This is not a 365 job.'];
    if (!a365MailCfg()) return ['ok' => false, 'stage' => 'config', 'error' => 'No 365 mailbox: aftercare goes from Jen\'s own email or phone.'];   /* 2026-10-19: nothing tried, nothing noted */
    $l = leadsAll()[$j['lead']] ?? [];
    $to = trim((string) ($l['email'] ?? ''));
    $rec = function (array $r) use ($jid, $j, $to, $why) {
        appendLine(DATA_DIR . '/jobs.log', ['id' => $jid, 'aftercare' => ['ok' => $r['ok'], 'stage' => $r['stage'], 'to' => $to, 'why' => $why, 'at' => time()], 'by' => 'aftercare', 'at' => time()]);
        appendLine(DATA_DIR . '/a365-mail.log', ['at' => time(), 'lead' => (string) $j['lead'], 'job' => $jid, 'what' => 'aftercare', 'ok' => $r['ok'], 'stage' => $r['stage'], 'error' => mb_substr((string) $r['error'], 0, 300)]);
        appendLine(leadsDir() . '/leadst.log', ['id' => (string) $j['lead'], 'note' => $r['ok'] ? 'Aftercare emailed to ' . $to . '.' : 'Aftercare NOT emailed (' . ($r['stage'] === 'config' ? 'the 365 mailbox is not set up yet' : ($r['stage'] === 'noemail' ? 'no email address' : $r['stage'])) . ').', 'by' => 'aftercare', 'at' => time()]);
        return $r + ['to' => $to];
    };
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) return $rec(['ok' => false, 'stage' => 'noemail', 'error' => 'No email address for them.']);
    $co = company()['a365']; $name = (string) ($co['name'] ?? '365 Aeration & Seeding'); $ph = a365Phone($l);
    $first = ucfirst(strtolower((string) (preg_split('/\s+/', trim((string) ($l['name'] ?? '')))[0] ?? '')));
    $owed = jobOwed($j); $cg = $j['sqcharge'] ?? null; $link = (string) ($j['sqlink']['url'] ?? '');
    $tips = ['Leave the plugs on the lawn. They work back into the grass on their own.', 'Give the lawn a good watering soon.'];
    if (($j['pkg'] ?? 'full') !== 'aerate') { $tips[] = 'While the new seed comes up, water lightly and often enough to keep the soil surface moist. That can take up to two weeks.'; $tips[] = 'Once the new grass is up and rooting, water less often but more deeply.'; }
    $bal = $cg && $owed < 1 ? 'Your $' . (int) $cg['amt'] . ' balance went on your ' . ((string) ($cg['brand'] ?? '') ?: 'card') . ' ending ' . (string) ($cg['last4'] ?? '') . ', so you are all set.'
         : ($owed < 1 ? 'Your balance is paid. Thank you!' : 'Your remaining balance is $' . $owed . '.' . ($link !== '' ? ' You can pay it here: ' . $link : ''));
    $e = fn($x) => htmlspecialchars((string) $x, ENT_QUOTES, 'UTF-8');
    $text = 'Hi' . ($first !== '' ? ' ' . $first : '') . ",\n\nThanks for having us! Your lawn is done. A few tips for the next couple of weeks:\n\n"
          . implode("\n", array_map(fn($t) => '- ' . $t, $tips)) . "\n\n" . $bal . "\n\nAny questions: call or text " . $ph . ".\n\n" . $name . "\n";
    $html = '<!doctype html><html><body style="margin:0;background:#fdf8ee;font-family:Arial,Helvetica,sans-serif;color:#1d2a1c">'
          . '<div style="max-width:600px;margin:0 auto;padding:24px 18px">'
          . '<div style="font-size:20px;font-weight:800;color:#21451f;margin-bottom:14px">' . $e($name) . '</div>'
          . '<p style="margin:0 0 14px">Hi' . ($first !== '' ? ' ' . $e($first) : '') . ',</p><p style="margin:0 0 18px">Thanks for having us! Your lawn is done. A few tips for the next couple of weeks:</p>'
          . '<div style="background:#fff;border:1px solid #dfe6da;border-radius:14px;padding:16px 18px;margin-bottom:14px"><ul style="margin:0;padding-left:20px;font-size:15px">' . implode('', array_map(fn($t) => '<li style="margin:0 0 8px">' . $e($t) . '</li>', $tips)) . '</ul></div>'
          . '<div style="background:#eef6ea;border:1px solid #cfe3c6;border-radius:14px;padding:14px 18px;margin-bottom:18px;font-size:15px">' . $e($cg || $owed < 1 || $link === '' ? $bal : 'Your remaining balance is $' . $owed . '.') . '</div>'
          . ($owed > 0 && $link !== '' ? '<p style="margin:0 0 18px"><a href="' . $e($link) . '" style="display:inline-block;background:#2e5e2c;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">Pay the $' . $owed . ' balance</a></p>' : '')
          . '<p style="margin:0;color:#5a6858;font-size:14px">Any questions: call or text <a href="tel:' . $e(preg_replace('/\D/', '', $ph)) . '" style="color:#2e5e2c">' . $e($ph) . '</a>.</p>'
          . '</div></body></html>';
    return $rec(a365Mail($to, 'Your lawn after today: a few tips from ' . $name, $text, $html));
}
/* marked paid another way (cash, check, Zelle): the desk, or Jen on her own customer */
if ($action === 'jobpaid') {
    if (!feature('walkdesk') || !$isPost) fail('Not allowed.', 403);
    $jid = (string) ($body['id'] ?? ''); $j = jobsAll()[$jid] ?? null;
    if (!$j || $j['off']) fail('No such job.', 404);
    if (!desk() && !($role === 'quote' && jobOpen($j))) fail('Not allowed.', 403);
    if (jobOwed($j) < 1) fail('This job is already paid.');
    $how = in_array($body['how'] ?? '', ['cash', 'check', 'zelle', 'venmo', 'card', 'square', 'other'], true) ? (string) $body['how'] : 'other';
    if (!appendLine(DATA_DIR . '/jobs.log', ['id' => $jid, 'pay' => ['s' => 'paid', 'how' => $how], 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    appendLine(leadsDir() . '/leadst.log', ['id' => (string) $j['lead'], 'note' => 'Balance of $' . jobOwed($j) . ' marked paid (' . $how . ') by ' . $me . '.', 'by' => $me, 'at' => time()]);
    $af = jobAftercare($jid, 'paid');
    out(['ok' => true, 'aftercare' => $af['stage']]);
}
/* Check Square for a payment: a balance paid straight in Square shows on the job (2026-10-19) */
if ($action === 'squarelook') {
    if (!feature('walkdesk') || !$isPost) fail('Not allowed.', 403);
    $jid = (string) ($body['id'] ?? ''); $j = jobsAll()[$jid] ?? null;
    if (!$j || $j['off']) fail('No such job.', 404);
    if (!jobOpen($j)) fail('Not allowed.', 403);
    if (jobOwed($j) < 1) out(['ok' => true, 'paid' => true, 'already' => true]);
    if (!squareCfg()) fail('Square is not connected yet.');
    $l = leadsAll()[$j['lead']] ?? [];
    $f = squareBalancePaid($j, $l);   /* without a linked Square customer it matches on name and amount (2026-10-20) */
    if (!$f && empty($l['sqcust'])) out(['ok' => true, 'paid' => false, 'why' => 'No Square payment of exactly $' . jobOwed($j) . ' under their full name. Mark it paid if they paid another way.']);
    if ($f) jobSquareFound($jid, $f, ($f['match'] ?? '') === 'name' ? 'by Check Square, matched by name and amount' : 'by Check Square');
    out(['ok' => true, 'paid' => (bool) $f, 'amt' => $f['amt'] ?? 0, 'last4' => $f['last4'] ?? '']);
}
/* send (or send again) the aftercare email by hand */
if ($action === 'aftercare') {
    if (!feature('walkdesk') || !$isPost) fail('Not allowed.', 403);
    $jid = (string) ($body['id'] ?? ''); $j = jobsAll()[$jid] ?? null;
    if (!$j || $j['off']) fail('No such job.', 404);
    if (!jobOpen($j)) fail('Not allowed.', 403);
    $r = jobAftercare($jid, 'by hand: ' . $me, true);
    out(['ok' => $r['ok'], 'stage' => $r['stage'], 'to' => $r['to'] ?? '', 'error' => $r['ok'] ? '' : ($r['stage'] === 'config' ? 'The 365 mailbox is not set up yet, so nothing was emailed.' : $r['error'])]);
}
if ($action === 'jobphoto') {
    if (!$isPost) fail('POST required', 405);
    $jid = (string) ($_GET['job'] ?? ''); $j = jobsAll()[$jid] ?? null;
    if (!preg_match('/^j[0-9a-f]{12}$/D', $jid) || !$j || $j['off']) fail('No such job.', 404);
    if (!jobMine($j)) fail('Not allowed.', 403);
    if (!throttleTake(rateFile('photo|' . (string) ($session['c'] ?? $me)), 120, 3600)) fail('That is a lot of photos in an hour. Wait a little and try again.', 429);
    $bin = $raw ?? '';
    if (strlen($bin) < 100) fail('No photo received.');
    if (strlen($bin) > PHOTO_MAX_BYTES) fail('That photo is too big to send.', 413);
    $info = @getimagesizefromstring($bin);
    if (!$info || ($info['mime'] ?? '') !== 'image/jpeg' || $info[0] > 6000 || $info[1] > 6000) fail('That is not a JPEG photo.');
    if (count(jobPhotos($jid)) >= JOB_PHOTO_MAX) fail('This job already has ' . JOB_PHOTO_MAX . ' photos. Remove one first.');
    $dir = DATA_DIR . '/jobphotos/' . $jid;
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) fail('Could not save that. Try again.', 500);
    $f = (new DateTime('now', new DateTimeZone(appTz())))->format('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.jpg';
    if (@file_put_contents($dir . '/' . $f, $bin, LOCK_EX) === false) fail('Could not save that. Try again.', 500);
    if (!appendLine(DATA_DIR . '/jobphotos.log', ['id' => $jid, 'f' => $f, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'f' => $f]);
}
if ($action === 'jobphotoget') {
    $jid = (string) ($_GET['job'] ?? ''); $f = (string) ($_GET['f'] ?? ''); $j = jobsAll()[$jid] ?? null;
    if (!$j || !jobMine($j) || !validPhotoName($f) || !isset(jobPhotosAll()[$jid][$f])) fail('No such photo.', 404);
    $path = DATA_DIR . '/jobphotos/' . $jid . '/' . $f;
    if (!is_readable($path)) fail('No such photo.', 404);
    header('Content-Type: image/jpeg'); header('Cache-Control: no-store'); header('Content-Length: ' . filesize($path));
    readfile($path); exit;
}
if ($action === 'jobphotodel') {
    if (!$isPost) fail('POST required', 405);
    $jid = (string) ($body['job'] ?? ''); $f = (string) ($body['f'] ?? ''); $j = jobsAll()[$jid] ?? null; $p = jobPhotosAll()[$jid][$f] ?? null;
    if (!$j || !$p) fail('No such photo.', 404);
    if ($p['by'] !== $me && !desk()) fail('Only whoever added it, or the office, removes a photo.', 403);
    if (!appendLine(DATA_DIR . '/jobphotos.log', ['id' => $jid, 'f' => $f, 'del' => 1, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
/* the crew's own week: their jobs and walks, nobody else's, nothing to change */
if ($action === 'myschedule') {
    if (!feature('walkdesk')) fail('Not here.', 404);
    $from = (string) ($_GET['from'] ?? ''); $to = (string) ($_GET['to'] ?? '');
    if (!dateOk($from) || !dateOk($to) || $to < $from || strtotime($to) - strtotime($from) > 31 * 86400) fail('Pick the dates.');
    $leads = leadsAll(); $rows = [];
    foreach (jobsAll() as $j) {
        if ($j['off'] || $j['crew'] !== $me || $j['date'] < $from || $j['date'] > $to) continue;
        $sl = jobSlot((string) $j['slot']); $l = $leads[$j['lead']] ?? null;
        $town = (string) ($l['house']['town'] ?? ($l['stown'] ?? ''));
        if ($town === '') { $p = array_map('trim', explode(',', (string) ($j['addr'] ?? ''))); $town = count($p) > 1 ? (string) end($p) : ''; }
        $rows[] = ['kind' => 'job', 'id' => $j['id'], 'date' => $j['date'], 'start' => $sl ? $sl[2] : '12:00', 'time' => $sl ? $sl[1] : (string) $j['slot'],
                   'name' => trim((string) ($l['name'] ?? ($j['title'] ?? ''))) ?: 'A customer', 'where' => $town,
                   'what' => (($j['pkg'] ?? 'full') === 'aerate' ? 'Aerate only' : (($j['pkg'] ?? '') === 'plan' ? 'Service plan' : 'Aerate, seed & feed')) . (($j['scope'] ?? 'all') === 'front' ? ', front only' : (($j['scope'] ?? 'all') === 'back' ? ', back only' : '')),
                   'pay' => payLine($j), 'done' => $j['done'] ? ($j['done']['o'] === 'done' ? 'Done' : 'Not done') : ''];
    }
    $vw = ucfirst((string) (company()['visitShort'] ?? 'Walk'));
    foreach (deskWalks() as $w) {
        if ($w['off'] || $w['walker'] !== $me || $w['date'] < $from || $w['date'] > $to) continue;
        $t = (string) ($w['time'] ?? '');
        $rows[] = ['kind' => 'walk', 'id' => $w['id'], 'date' => $w['date'], 'start' => $t !== '' ? $t : '23:59', 'time' => $t !== '' ? (new DateTime('2000-01-01 ' . $t))->format('g:i a') : 'Any time',
                   'name' => (string) $w['title'], 'where' => (string) ($w['addr'] ?? ''), 'what' => $vw . ', about ' . (int) ($w['mins'] ?? 60) . ' min', 'pay' => '', 'done' => !empty($w['done']) ? 'Done' : ''];
    }
    usort($rows, fn($a, $b) => [$a['date'], $a['start']] <=> [$b['date'], $b['start']]);
    out(['ok' => true, 'rows' => $rows, 'closed' => jobClosed()]);
}
/* a walk the crew adds on the spot: a lead (In person, by them) and the walk on their own day; the office gets an alert */
if ($action === 'crewwalk') {
    if (!feature('walkdesk') || !$isPost) fail('Not allowed.', 403);
    if (empty($acct['walker'][(string) ($session['c'] ?? '')])) fail('Only people who do walks add them. An admin marks them in Accounts.', 403);
    $name = $clean($body['name'] ?? '', 120); $phone = $clean($body['phone'] ?? '', 40); $addr = $clean($body['addr'] ?? '', 160); $note = $clean($body['note'] ?? '', 500);
    if ($name === '' && $phone === '') fail('Add their name or phone number.');
    if (!preg_match('/^\d+ \S/', $addr)) fail('Add the street address: the house number and the street.');
    $date = (string) ($body['date'] ?? ''); $time = (string) ($body['time'] ?? ''); $mins = (int) ($body['mins'] ?? 60);
    if (!dateOk($date)) fail('Pick the day.');
    $tz = new DateTimeZone(appTz());
    $diff = (int) round(((new DateTime($date . ' 00:00', $tz))->getTimestamp() - (new DateTime('today', $tz))->getTimestamp()) / 86400);
    if ($diff < 0) fail('That day has gone. Pick today or later.');
    if ($diff > 180) fail('Pick a date within the next six months.');
    if (!preg_match('/^(0[6-9]|1\d|20):(00|15|30|45)$/D', $time) && $time !== '') fail('Pick a time between 6 am and 8:45 pm.');
    if (!in_array($mins, [30, 45, 60, 90, 120], true)) fail('Pick how long it takes.');   /* DESK_MINS: that const is defined further down the file */
    if (empty($body['force']) && $time !== '') { $cl = deskClashes($me, $date, $time, $mins, '', ''); if ($cl) out(['ok' => false, 'clash' => $cl, 'error' => 'You already have something then.']); }
    $lid = 'm' . date('YmdHis') . bin2hex(random_bytes(3));
    if (!appendLine(leadsDir() . '/leads.log', ['id' => $lid, 'src' => 'inperson', 'at' => time(), 'need' => 'A walk', 'name' => $name, 'phone' => $phone, 'email' => '', 'town' => $addr, 'msg' => $note, 'by' => $me])) fail('Could not save that. Try again.', 500);
    $parts = array_map('trim', explode(',', $addr)); $h = a365Match($parts[0], $parts[1] ?? '');
    if ($h) appendLine(leadsDir() . '/leadst.log', ['id' => $lid, 'house' => $h, 'by' => $me, 'at' => time()]);
    $vid = 'v' . bin2hex(random_bytes(6)); $title = $name !== '' ? $name : $phone;
    if (!appendLine(DATA_DIR . '/deskwalks.log', ['id' => $vid, 'kind' => 'lead', 'lead' => $lid, 'title' => $title, 'walker' => $me, 'date' => $date, 'time' => $time, 'mins' => $mins, 'addr' => $addr, 'note' => $note, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    appendLine(leadsDir() . '/leadst.log', ['id' => $lid, 'status' => 'walk', 'note' => 'Walk added in the field by ' . $me . ': ' . deskWhen($date, $time) . '.', 'by' => $me, 'at' => time()]);
    if (!empty(company()['a365'])) a365Alert('Walk added by ' . $me, $title . ' · ' . deskWhen($date, $time));
    out(['ok' => true, 'id' => $vid, 'lead' => $lid]);
}
/* stats about the work (Matthew: "number of jobs done, number of hours worked, number of sq footage worked on, fun and cool stuff"):
   the lawn size is the crew's own measurement on the day when there is one, else our estimate; the time is their own estimate on Done */
if ($action === 'mystats') {
    if (!feature('walkdesk')) fail('Not here.', 404);
    $tz = new DateTimeZone(appTz()); $today = new DateTime('today', $tz);
    $mon = (clone $today)->modify('-' . (((int) $today->format('N')) - 1) . ' days')->format('Y-m-d'); $m1 = $today->format('Y-m-01');
    $leads = leadsAll(); $past = [];
    $st = ['done' => 0, 'week' => 0, 'month' => 0, 'not' => 0, 'mins' => 0, 'timed' => 0, 'sq' => 0, 'sqJobs' => 0, 'rateMins' => 0, 'rateSq' => 0, 'biggest' => 0, 'walks' => 0];
    foreach (jobsAll() as $j) {
        if ($j['off'] || $j['crew'] !== $me || !$j['done']) continue;
        $d = $j['done']; $l = $leads[$j['lead']] ?? null; $sq = 0;
        if ($l && !empty($l['house']['region'])) {
            $hf = houseFacts((string) $l['house']['region'], (string) $l['house']['door']);
            if ($hf) { $ck = $hf['checks'] ?? []; $last = $ck ? end($ck) : null; $sq = (int) ($last['sq'] ?? 0) ?: (int) ($hf['lawn']['sq'] ?? 0); }
        }
        $mn = (int) ($d['mins'] ?? 0);
        if ($d['o'] === 'done') {
            $st['done']++; if ($j['date'] >= $mon) $st['week']++; if ($j['date'] >= $m1) $st['month']++;
            if ($mn > 0) { $st['mins'] += $mn; $st['timed']++; }
            if ($sq > 0) { $st['sq'] += $sq; $st['sqJobs']++; $st['biggest'] = max($st['biggest'], $sq); if ($mn > 0) { $st['rateMins'] += $mn; $st['rateSq'] += $sq; } }
        } else $st['not']++;
        $past[] = ['id' => $j['id'], 'date' => $j['date'], 'name' => trim((string) ($l['name'] ?? ($j['title'] ?? ''))) ?: 'A customer', 'town' => (string) ($l['house']['town'] ?? ''), 'o' => (string) $d['o'], 'mins' => $mn, 'sq' => $sq];
    }
    foreach (deskWalks() as $w) if (!$w['off'] && $w['walker'] === $me && !empty($w['done'])) $st['walks']++;
    usort($past, fn($a, $b) => strcmp($b['date'], $a['date']));
    out(['ok' => true, 'stats' => $st, 'past' => array_slice($past, 0, 60)]);
}
if ($action === 'jobdone') {
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $all = jobsAll();
    if (!preg_match('/^j[0-9a-f]{12}$/D', $id) || !isset($all[$id]) || $all[$id]['off']) fail('No such job.', 404);
    $j = $all[$id]; if (!jobOpen($j)) fail('Not allowed.', 403);   /* + Jen on her own customer, from her schedule (2026-10-19) */
    $o = (string) ($body['outcome'] ?? ''); if (!in_array($o, ['done', 'could not', 'undo'], true)) fail('Say how it went.');
    $note = $clean($body['note'] ?? '', 1000); $got = (int) ($body['collected'] ?? 0); $mins = max(0, min(960, (int) ($body['mins'] ?? 0)));
    /* 2026-10-19 (Matthew): Done asks about how long it took ("this is going to help us track how long it takes to do the job, how long it
       takes to do certain sized lawns"); Could not do it needs what happened, "so we know exactly what happened, why and how". The office
       marking a job for someone may leave the time out. */
    if ($o === 'done' && !desk() && $role !== 'quote' && $mins < 5) fail('Add about how long the job took, in hours and minutes.');
    if ($o === 'could not' && $role !== 'quote' && mb_strlen($note) < 5) fail('Say what happened, so the office knows why and can rebook it.');
    $took = $mins > 0 ? trim(($mins >= 60 ? intdiv($mins, 60) . ' h ' : '') . ($mins % 60 ? ($mins % 60) . ' min' : '')) : '';
    $row = ['id' => $id, 'done' => $o === 'undo' ? null : ['o' => $o, 'note' => $note, 'collected' => max(0, $got), 'mins' => $o === 'done' ? $mins : 0, 'by' => $me, 'at' => time()], 'by' => $me, 'at' => time()];
    if (!appendLine(DATA_DIR . '/jobs.log', $row)) fail('Could not save that. Try again.', 500);
    if ($o !== 'undo') appendLine(leadsDir() . '/leadst.log', ['id' => $j['lead'], 'note' => mb_substr('Job ' . ($o === 'done' ? 'done' . ($took !== '' ? ' in about ' . $took : '') : 'not done') . ($note !== '' ? ': ' . $note : ''), 0, 1100), 'by' => $me, 'at' => time()]);
    if ($o === 'could not' && !empty(company()['a365'])) a365Alert('Job not done: ' . ((string) ($j['title'] ?? '') ?: 'a customer'), $me . ': ' . mb_substr($note, 0, 140));   /* the office rebooks it */
    $af = ($o === 'done' && (jobOwed($j) < 1 || $got >= jobOwed($j))) ? jobAftercare($id, 'done') : ['stage' => 'waiting'];   /* nothing owed: the aftercare email now */
    if ($o === 'done' && jobOwed($j) > 0 && $got < jobOwed($j)) {   /* a balance to collect: tell whoever quoted them (2026-10-19) */
        $L0 = leadsAll()[$j['lead']] ?? []; $own = '';
        if ((($TEAM['byName'][(string) ($L0['by'] ?? '')]['role'] ?? '') === 'quote')) $own = (string) $L0['by'];
        elseif (!empty($L0['qown'])) $own = (string) ((array) $L0['qown'])[0];
        if ($own !== '' && $own !== $me) pushName($own, 'Job done: balance to collect', explode(' ', $me)[0] . ' finished ' . (trim((string) ($L0['name'] ?? $j['title'] ?? '')) ?: 'a job') . ' · $' . (jobOwed($j) - max(0, $got)) . ' to collect', './?job=' . $id, 'jobowe-' . $id);
    }
    out(['ok' => true, 'aftercare' => $af['stage']]);
}
/* ---- weather (2026-10-15, Matthew: "go ahead and build the weather day button and forecast flag") ----
 * The forecast: the National Weather Service's 7-day forecast for the base (Englewood), cached an hour. A day is flagged when rain or snow
 * is likely (60% or more by day), possible (40-59% with rain, snow or storms), or the night before drops to 28 F or colder (frozen ground
 * in the morning; aeration needs ground that is not frozen, CSU Extension PlantTalk 1505). Jen decides; nothing moves by itself.
 * The weather day: every job on a day, each with a suggested new day and time (same crew, same arrival time if free, the next working
 * day on), moved together; one alert per crew; a note on each lead and job; the customers' texts come back for Jen to send. */
function wxForecast(): array {
    $cf = DATA_DIR . '/nws-forecast.json'; $c = json_decode((string) @file_get_contents($cf), true);
    if (is_array($c) && time() - (int) ($c['got'] ?? 0) < 3600) return $c;
    $b = company()['a365']['base'] ?? (company()['center'] ?? null);
    if (!is_array($b) || count($b) < 2) return ['days' => [], 'got' => time(), 'none' => true];
    $pt = httpJson('https://api.weather.gov/points/' . round((float) $b[0], 4) . ',' . round((float) $b[1], 4));
    $url = (string) ($pt['properties']['forecast'] ?? ''); $fc = $url !== '' ? httpJson($url) : null;
    if (!is_array($fc) || empty($fc['properties']['periods'])) return is_array($c) ? $c + ['stale' => true] : ['days' => [], 'got' => time(), 'down' => true];
    $days = []; $tz = new DateTimeZone(appTz());
    foreach ($fc['properties']['periods'] as $p) {
        $t = new DateTime((string) $p['startTime']); $t->setTimezone($tz);
        $pop = (int) ($p['probabilityOfPrecipitation']['value'] ?? 0); $sf = (string) ($p['shortForecast'] ?? ''); $temp = (int) ($p['temperature'] ?? 0);
        if (!empty($p['isDaytime'])) {
            $d = $t->format('Y-m-d'); $days[$d] = ($days[$d] ?? []) + ['hi' => $temp, 'pop' => $pop, 'sky' => $sf];
            $wet = preg_match('/rain|snow|shower|storm|sleet|drizzle/i', $sf);
            if ($pop >= 60 && $wet) $days[$d]['flag'] = ['k' => preg_match('/snow/i', $sf) ? 'snow' : 'rain', 'say' => $sf . ' (' . $pop . '%)'];
            elseif ($pop >= 40 && $wet) $days[$d]['flag'] = $days[$d]['flag'] ?? ['k' => 'maybe', 'say' => $sf . ' (' . $pop . '%)'];
        } else {
            $d = (clone $t)->modify('+1 day')->format('Y-m-d');   /* tonight's low is tomorrow morning's ground */
            $days[$d] = ($days[$d] ?? []) + ['lo' => $temp];
            if ($temp <= 28 && empty($days[$d]['flag'])) $days[$d]['flag'] = ['k' => 'freeze', 'say' => 'Hard freeze the night before (' . $temp . '°F): the ground may be frozen in the morning'];
        }
    }
    $out = ['days' => $days, 'got' => time()];
    @file_put_contents($cf, json_encode($out, JSON_UNESCAPED_UNICODE), LOCK_EX);
    return $out;
}
/** the next free slots for a day's jobs: same crew, same time first, from the next working day on (14 days at most) */
function wxSuggest(string $date): array {
    $tz = new DateTimeZone(appTz()); $taken = []; $pick = []; $leads = leadsAll();
    $jobs = array_values(array_filter(jobsAll(), fn($j) => !$j['off'] && !$j['done'] && $j['date'] === $date));
    usort($jobs, fn($a, $b) => strcmp($a['slot'], $b['slot']));
    $days = []; $d = new DateTime($date . ' 12:00', $tz);
    while (count($days) < 12) { $d->modify('+1 day'); if (!in_array((int) $d->format('w'), jobClosed(), true)) $days[] = $d->format('Y-m-d'); }
    $free = function ($j, $ds, $sl) use (&$taken) { return !isset($taken[$j['crew'] . '|' . $ds . '|' . $sl]) && slotFree($j['crew'], $ds, $sl, (string) $j['lead'], $j['id']) === null; };
    /* first everyone keeps their own arrival time on the next working day where it is free... */
    foreach ($jobs as $j) if ($free($j, $days[0], $j['slot'])) { $pick[$j['id']] = ['date' => $days[0], 'slot' => $j['slot']]; $taken[$j['crew'] . '|' . $days[0] . '|' . $j['slot']] = true; }
    /* ...then the rest take the earliest free time, their own time first on each day */
    foreach ($jobs as $j) {
        if (isset($pick[$j['id']])) continue;
        foreach ($days as $ds) {
            $order = array_merge([$j['slot']], array_values(array_diff(array_map(fn($x) => $x[0], jobSlots()), [$j['slot']])));
            foreach ($order as $sl) if ($free($j, $ds, $sl)) { $pick[$j['id']] = ['date' => $ds, 'slot' => $sl]; $taken[$j['crew'] . '|' . $ds . '|' . $sl] = true; break 2; }
        }
    }
    return array_map(fn($j) => jobShow($j, $leads) + ['suggest' => $pick[$j['id']] ?? null], $jobs);
}
function streetCaseServer(string $s): string { return (string) preg_replace_callback('/(^|[\s-])([a-z])/', fn($m) => $m[1] . strtoupper($m[2]), strtolower($s)); }
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
            if (!array_key_exists('walker', $r) || empty($r['kind'])) continue;   /* walker '' = not given to anyone yet (2026-10-15) */
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
/** who can be given a job. Sixfold's 365 flow (2026-10-15, Matthew: Brad does the jobs, not walks; quotes and deposits are taken by
    phone): anyone active who is not the office and not a check account, picked from a list. Everywhere else: whoever does walks. */
function jobCrewList(): array {
    global $TEAM;
    if (empty(company()['a365'])) return walkerList();
    $o = [];
    foreach ($TEAM['byName'] as $n => $x) if (!in_array($x['role'] ?? '', ['office', 'quote'], true) && stripos((string) $n, 'Claude Check') !== 0) $o[] = (string) $n;
    usort($o, fn($a, $b) => strcmp(mb_strtolower($a), mb_strtolower($b)));
    return $o;
}
/** the jobs board's rows: on the 365 flow, whoever has been given a job or a held day (until then, whoever does walks) */
function jobBoardCrews(): array {
    if (empty(company()['a365'])) return walkerList();
    $all = jobCrewList(); $had = [];
    foreach (jobsAll() as $j) if (!$j['off']) $had[(string) $j['crew']] = 1;
    foreach (jobHolds() as $h) $had[(string) $h['crew']] = 1;
    $o = array_values(array_filter($all, fn($n) => isset($had[$n])));
    return $o ?: array_values(array_intersect($all, walkerList()));
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
        if ($l && !empty($l['house']['region'])) { $hf = houseFacts((string) $l['house']['region'], (string) $l['house']['door']); if ($hf) $o['house'] = $hf; }
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
        if ($have['kind'] === 'door') {   /* Fable review 2026-10-14: the door's own walk goes too, so its card and calendars stop showing it */
            $cw = loadWalks((string) $have['region'])[(string) $have['door']] ?? null;
            if ($cw && $cw['date'] === (string) $have['date'] && $cw['time'] === (string) ($have['time'] ?? '')) appendWalk((string) $have['region'], ['id' => (string) $have['door'], 'date' => null, 'by' => $me, 'at' => time()]);
        }
        $al = $have['walker'] !== '' && $have['walker'] !== $me ? pushName($have['walker'], $vw . ' cancelled: ' . deskWhen($have['date'], $have['time']), $have['title'] . ' · cancelled by ' . $me, './', 'dw-' . $id) : null;
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
    /* 2026-10-15 (Matthew): a walk can be booked before anyone is given it ("Not given to anyone yet"), and for any time that day;
       whoever is picked later from the list gets the alert then */
    if ($walker !== '' && !in_array($walker, walkerList(), true)) fail('Pick someone who does walks. An admin marks them in Accounts.');
    $date = (string) ($body['date'] ?? ($have['date'] ?? '')); $time = (string) ($body['time'] ?? ($have['time'] ?? ''));
    if (!dateOk($date)) fail('That is not a real date.');
    $tz = new DateTimeZone(appTz());
    $diff = (int) round(((new DateTime($date . ' 00:00', $tz))->getTimestamp() - (new DateTime('today', $tz))->getTimestamp()) / 86400);
    if ($diff < 0 && (!$have || $date !== $have['date'])) fail('That day has gone. Pick today or later.');
    if ($diff > 180) fail('Pick a date within the next six months.');
    if (!preg_match('/^(0[6-9]|1\d|20):(00|15|30|45)$/D', $time) && $time !== '') fail('Pick a time between 6 am and 8:45 pm.');
    $mins = (int) ($body['mins'] ?? ($have['mins'] ?? 60)); if (!in_array($mins, DESK_MINS, true)) fail('Pick how long it takes.');
    $addr = array_key_exists('addr', $body) ? $clean($body['addr'], 160) : (string) ($have['addr'] ?? '');
    $note = array_key_exists('note', $body) ? $clean($body['note'], 500) : (string) ($have['note'] ?? '');
    if ($kind === 'door' && $addr === '') $addr = $title . ', ' . regionLabel($key);
    if ($addr === '') fail('Add the address, so ' . ($walker !== '' ? $walker : 'whoever goes') . ' knows where to go.');
    if (empty($body['force']) && $walker !== '' && $time !== '') {
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
        if ($time !== '' && (!$cur || $cur['date'] !== $date || $cur['time'] !== $time)) appendWalk($key, ['id' => $door, 'date' => $date, 'time' => $time, 'by' => $cur ? $cur['by'] : $me, 'at' => time()]);
    }
    /* the alerts: never to the person doing the booking */
    $when = deskWhen($date, $time); $where = $kind === 'lead' ? trim((string) ($leads[$lead]['town'] ?? '')) : '';
    $txt = $title . ($where !== '' ? ' · ' . $where : '') . ' · booked by ' . $me;
    $al = null;
    if ($walker === '') $al = null;
    elseif (!$have) $al = $walker !== $me ? pushName($walker, $vw . ' booked: ' . $when, $txt, './?walk=' . $nid, 'dw-' . $nid) : null;
    elseif ($walker !== $have['walker']) {
        if ($have['walker'] !== '' && $have['walker'] !== $me) pushName($have['walker'], $vw . ' handed to ' . $walker, $have['title'] . ' · ' . deskWhen($have['date'], $have['time']) . ' · by ' . $me, './', 'dw-' . $id);
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
    $want = (string) ($_GET['id'] ?? '');   /* a link to one walk opens it whatever its date (Fable review 2026-10-14) */
    foreach (deskWalks() as $w) if (!$w['off'] && $w['walker'] === $who && ($w['date'] >= $from || $w['id'] === $want)) $list[] = deskShow($w, $leads) + ['fresh' => $w['chg'] > $seen && ($w['by'] ?? '') !== $who];
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
    if (!$dry) a365WebMailFlush();   /* website forms by email to Contact@ (2026-10-23) */
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
    if (!desk() && $role !== 'manager' && $role !== 'quote') fail('Not allowed.', 403);
    $leads = leadsAll();
    if ($role === 'quote') $leads = array_filter($leads, fn($l) => qMine($l) || quoteInbox($l));   /* her own customers, and her Leads to call (2026-10-16) */
    foreach ($leads as &$ql) $ql['qinbox'] = quoteInbox($ql, $role === 'quote' || count(meNames()) > 1); unset($ql);   /* + a sign-in linked to a quote login (Jen's office, 2026-10-21) */   /* in the quote account's Leads to call */
    $jobOf = []; foreach (jobsAll() as $jj) if (!$jj['off']) $jobOf[$jj['lead']] = $jj;   /* each lead's job and its money (2026-10-19, Jen checks before charging) */
    foreach ($leads as &$ql) if (isset($jobOf[$ql['id']])) { $jj = $jobOf[$ql['id']]; $ql['job'] = ['id' => $jj['id'], 'date' => $jj['date'], 'crew' => $jj['crew'], 'price' => (int) $jj['price'], 'owed' => jobOwed($jj), 'pay' => payLine($jj), 'card' => cardLine($jj, $ql), 'done' => $jj['done'] ? (string) $jj['done']['o'] : '']; } unset($ql);
    /* a manager sees the leads nobody owns yet and their own team's */
    if (!desk() && $role === 'manager') $leads = array_filter($leads, fn($l) => $l['owner'] === '' || $l['owner'] === $me || sameTeam($l['owner']));
    /* an office account that runs a team (Nneka) sees the whole Pipeline except the people nobody has contacted yet: those are Jen's first
       call (2026-10-20, Matthew: "make sure that shes not seeing people (to call) that jen hasn't already contacted yet"). A lead shows once it
       has a call try (hers in the app, or her ClickUp status), or when it is this person's or their team's (added by or handed to them).
       Briefly narrowed to her own leads the same evening, then put back (Matthew: "lets leave the leads and pipeline in for nneka ... i want her
       to be able to at least do it"; she is told not to contact anyone until Brandon confirms). The 365 website's forms only when handed to her. */
    if ($role === 'office' && mgr()) $leads = array_filter($leads, fn($l) => (string) ($l['by'] ?? '') === $me || (string) ($l['owner'] ?? '') === $me || (($l['owner'] ?? '') !== '' && sameTeam((string) $l['owner'])) || (($l['by'] ?? '') !== '' && sameTeam((string) $l['by']))
        || ($l['src'] ?? '') !== 'a365web');   /* the whole list to call, untouched leads included (2026-10-21, Matthew: 'Nneka should still be able to see the list of people to call. She has just been notified by me and brandon to not make any calls yet. But allow her to see the list.'); website forms only when handed to her */
    /* the 365 website's forms are Matthew's (2026-10-20: "make sure website leads are not being forwarded to jen"): an office account sees one only
       when it is handed to them (owner), or sent to Jen (her office account; not a team lead's), or it came from Jen's own ClickUp list */
    if ($role === 'office') $leads = array_filter($leads, fn($l) => ($l['src'] ?? '') !== 'a365web' || in_array((string) ($l['owner'] ?? ''), meNames(), true) || (string) ($l['by'] ?? '') === $me || (string) ($l['by'] ?? '') === 'ClickUp' || (!empty($l['tojen']) && !mgr()) || (mgr() && ($l['owner'] ?? '') !== '' && sameTeam((string) $l['owner'])));
    $list = array_reverse(array_values($leads)); // later in the file = newer, for leads filed in the same second (usort is stable)
    usort($list, fn($a, $b) => ($b['at'] ?? 0) <=> ($a['at'] ?? 0));
    $new = count(array_filter($list, fn($l) => $l['status'] === 'new'));
    if (!empty($_REQUEST['count'])) out(['ok' => true, 'new' => $new]);
    out(['ok' => true, 'new' => $new, 'leads' => $list] + ($role === 'admin' ? ['cucheck' => cuCheckShown()] : []));   /* the ClickUp sync check (2026-10-17) */
}
if ($action === 'cucheckok') {   /* Leave it, on the Pipeline's ClickUp check */
    if ($role !== 'admin' || !$isPost) fail('Not allowed.', 403);
    $k = (string) ($body['key'] ?? ''); if (!preg_match('/^[a-z]+:[A-Za-z0-9:_ .\/-]{1,160}$/D', $k)) fail('Nothing to leave.');
    $keys = cuCheckOk(); if (!in_array($k, $keys, true)) $keys[] = $k;
    writeJsonAtomic(DATA_DIR . '/clickup-check-ok.json', ['keys' => array_slice($keys, -500), 'by' => $me, 'at' => time()]);
    out(['ok' => true, 'cucheck' => cuCheckShown()]);
}

/* a house that is not on our lists, added by the crew at the door (2026-10-16, Matthew: "is there a way for them to add a customer to
   the pipeline for when they hit a property that isnt on our list?"). It lands in the Pipeline under To call, source At the door,
   with who found it, the house matched if it is on a list after all, or typed. No alert (Matthew: Jen's alert tabled). */
if ($action === 'crewlead') {
    if (!feature('walkdesk') || !$isPost) fail('Not allowed.', 403);
    if (!in_array($role, ['crew', 'manager', 'admin', 'office'], true)) fail('Not allowed.', 403);
    if (!throttleTake(rateFile('crewlead|' . $me), 30, 3600)) fail('That is a lot of houses in an hour. Try again later.', 429);
    $addr = $clean($body['address'] ?? '', 120); $town = $clean($body['town'] ?? '', 60);
    if (!preg_match('/^\d+\s+\S/', $addr)) fail('Type the house number and the street.');
    $phone = $clean($body['phone'] ?? '', 40); $dg = preg_replace('/\D/', '', $phone);
    if ($phone !== '' && (strlen($dg) < 10 || strlen($dg) > 11)) fail('That phone number does not look right.');
    $wants = ['aeration' => 'Aeration', 'quote' => 'Wants a quote', 'later' => 'Call back later', 'other' => 'Something else'];
    $want = (string) ($body['want'] ?? 'quote'); if (!isset($wants[$want])) $want = 'quote';
    $row = ['id' => 'm' . date('YmdHis') . bin2hex(random_bytes(3)), 'src' => 'door', 'at' => time(), 'need' => $wants[$want], 'name' => $clean($body['name'] ?? '', 120),
            'phone' => $phone, 'email' => '', 'town' => $addr . ($town !== '' ? ', ' . $town : ''), 'msg' => $clean($body['note'] ?? '', 600), 'by' => $me];
    if (!appendLine(leadsDir() . '/leads.log', $row)) fail('Could not save that. Try again.', 500);
    $h = a365Match($addr, $town);
    appendLine(leadsDir() . '/leadst.log', ['id' => $row['id'], 'house' => $h ?: ['address' => $addr, 'town' => $town, 'typed' => true], 'note' => 'Found at the door by ' . $me . ($h ? '.' : ' (not on our lists yet).'), 'by' => $me, 'at' => time()]);
    out(['ok' => true, 'id' => $row['id'], 'onList' => (bool) $h]);
}
if ($action === 'leadadd') {
    if (!desk() && $role !== 'quote') fail('Not allowed.', 403);
    if ($role === 'quote') {
        $qd = substr((string) preg_replace('/\D/', '', (string) ($body['phone'] ?? '')), -10); $qe = strtolower(trim((string) ($body['email'] ?? '')));
        foreach (leadsAll() as $ex) if ($ex['status'] !== 'lost' && ((strlen($qd) === 10 && substr((string) preg_replace('/\D/', '', (string) ($ex['phone'] ?? '')), -10) === $qd) || ($qe !== '' && strtolower((string) ($ex['email'] ?? '')) === $qe))) {
            if (!qMine($ex)) appendLine(leadsDir() . '/leadst.log', ['id' => $ex['id'], 'qown' => $me, 'note' => 'Taken on by ' . $me . ' in the Quick quote.', 'by' => $me, 'at' => time()]);
            if (($ex['status'] ?? '') === 'unreached') leadRevive((string) $ex['id'], 'taken on again in the Quick quote by ' . $me, $me);
            out(['ok' => true, 'id' => $ex['id'], 'had' => true]);
        }
    }
    if (!$isPost) fail('POST required', 405);
    $src = (string) ($body['src'] ?? '');
    if (!in_array($src, LEAD_SRC, true) || $src === 'website' || $src === 'a365web') fail('Pick where the lead came from.');
    $row = ['id' => 'm' . date('YmdHis') . bin2hex(random_bytes(3)), 'src' => $src, 'at' => time(),
            'need' => $clean($body['need'] ?? '', 60), 'name' => $clean($body['name'] ?? '', 120), 'phone' => $clean($body['phone'] ?? '', 40),
            'email' => $clean($body['email'] ?? '', 160), 'town' => $clean($body['town'] ?? '', 160), 'msg' => $clean($body['msg'] ?? '', 2000), 'by' => $me];
    if ($row['name'] === '' && $row['phone'] === '' && $row['email'] === '') fail('Add at least a name, a phone number or an email.');
    if ($row['email'] !== '' && !filter_var($row['email'], FILTER_VALIDATE_EMAIL)) fail('That email does not look right.');
    /* someone under Couldn't reach, added again (2026-10-21): their lead comes back with everything on it, rather than a second one */
    if ($ux = unreachedMatch($row['phone'], $row['email'])) {
        $said = array_filter([$row['need'], $row['town'], $row['msg']]);
        leadRevive((string) $ux['id'], 'added again by ' . $me, $me, $said ? 'New details: ' . implode('; ', $said) : '');   /* LEAD_SRC_NAME is declared further down the file, after this runs */
        out(['ok' => true, 'id' => $ux['id'], 'back' => true]);
    }
    if (!appendLine(leadsDir() . '/leads.log', $row)) fail('Could not save that. Try again.', 500);
    /* an address typed in finds its house (2026-10-14), as the website and Facebook leads do */
    if (feature('walkdesk') && preg_match('/^\d+ \S/', $row['town'])) { $parts = array_map('trim', explode(',', $row['town'])); $h = a365Match($parts[0], $parts[1] ?? ''); if ($h) appendLine(leadsDir() . '/leadst.log', ['id' => $row['id'], 'house' => $h, 'by' => $me, 'at' => time()]); }
    out(['ok' => true, 'id' => $row['id']]);
}

/* ---- Facebook lead forms, automatically (2026-10-14, Matthew: "make sure theres a way to constantly export leads from meta to the app") ----
 * tools/meta-leads.php runs every 5 minutes (a SiteGround cron job) and asks the Graph API for each page's lead forms and the
 * leads since the last run, with page tokens kept in sixfold-private/meta-leads.json (never shown, never in git). Each lead keeps
 * Meta's id ('ext'), so it is never added twice, and someone already in the Pipeline by phone or email is not added again (the
 * same rules as the file import below, which stays as the fallback). No phone alert per lead (leadAlertsOn). Setting up: the page's admin makes
 * a Meta app (Business type), grants it leads_retrieval and the page permissions, and drops the app id, app secret and a user
 * token in a file; tools/meta-leads.php --setup=<file> swaps them for page tokens that do not expire, and deletes the file. */
function metaFile(): string { return dirname(__DIR__, 2) . '/sixfold-private/meta-leads.json'; }
function metaFields(array $fd, array $labels = []): array {
    $v = []; foreach ($fd as $x) { $k = strtolower(trim((string) ($x['name'] ?? ''))); if ($k !== '') $v[$k] = trim(implode(', ', array_map('strval', (array) ($x['values'] ?? [])))); }
    /* a form's own questions (2026-10-19, the 365 ZIP form): a custom question arrives under its key ("0"), so its label says what it is.
       A ZIP or postal question fills the zip; any other custom answer is labelled with its question, not the key */
    foreach ($labels as $lk => $lab) if (isset($v[$lk]) && preg_match('/\b(zip|postal)\b/i', $lab) && ($v['zip_code'] ?? '') === '') { $v['zip_code'] = $v[$lk]; unset($v[$lk]); }
    $pick = function (array $keys) use (&$v) { foreach ($keys as $k) if (($v[$k] ?? '') !== '') { $x = $v[$k]; return $x; } return ''; };
    $name = $pick(['full_name', 'name']); if ($name === '') $name = trim($pick(['first_name']) . ' ' . $pick(['last_name']));
    $known = ['full_name', 'name', 'first_name', 'last_name', 'phone_number', 'phone', 'email', 'street_address', 'address', 'city', 'zip_code', 'zip', 'post_code', 'postal_code', 'state', 'province', 'country'];
    $street = $pick(['street_address', 'address']); $city = $pick(['city']); $zip = $pick(['zip_code', 'zip', 'post_code', 'postal_code']);
    $extra = []; foreach ($v as $k => $x) if (!in_array($k, $known, true) && $x !== '') $extra[] = (isset($labels[$k]) ? rtrim(trim($labels[$k]), ' ?:') : ucfirst(str_replace('_', ' ', $k))) . ': ' . str_replace('_', ' ', $x);
    return ['name' => $name, 'phone' => preg_replace('/^p:/i', '', $pick(['phone_number', 'phone'])), 'email' => $pick(['email']), 'street' => $street, 'city' => $city,
            'town' => trim($street . ($city !== '' ? ', ' . $city : '') . ($zip !== '' ? ' ' . $zip : ''), ', '), 'extra' => $extra];
}
/* ---- Facebook Messenger into the Pipeline (2026-10-20, Matthew: build it "for our app ... and test it", not live; "i dont want it affect
 * the pipeline currently"). OFF unless the company feature 'fbmessenger' is on, and it needs the page key to carry pages_messaging (on
 * 2026-10-20 it did not: Meta answered "(#200) Requires permission: pages_messaging"). Every 5 minutes, with the form leads: the Page's
 * Messenger conversations updated since the last look. A message from someone new makes a New lead (source Messenger, "Facebook message",
 * what they wrote, a phone or email typed in the messages picked out); someone already in the Pipeline (open lead, same phone, email or full
 * name) gets the message as a note instead; later messages in a known conversation are notes on its lead. Only the customer's messages count,
 * never the Page's replies. Switched on, it starts from that moment: older chats are not brought in. A failure here never holds up form leads. */
function metaMsgContact(string $text): array {
    $ph = preg_match('/(?<!\d)(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})(?!\d)/', $text, $m) ? '(' . $m[1] . ') ' . $m[2] . '-' . $m[3] : '';
    $em = preg_match('/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/', $text, $m2) && filter_var($m2[0], FILTER_VALIDATE_EMAIL) ? strtolower($m2[0]) : '';
    return [$ph, $em];
}
function metaMessenger(string $g, callable $gget, array $P, callable $digits, bool $dry = false): array {   /* $dry: the preview, the same matching with nothing saved (2026-10-20) */
    $res = ['page' => $P, 'added' => [], 'notes' => 0, 'error' => '', 'plan' => [], 'skipped' => 0];
    $since = (int) ($P['mlast'] ?? 0);
    if ($since === 0) { $res['page']['mlast'] = time(); return $res; }   /* first run after switching on: start now, bring in no old chats */
    $pid = (string) $P['id']; $newest = $since; $convs = []; $seen = array_flip((array) ($P['mseen'] ?? [])); $took = [];   /* message ids already handled: the runs overlap a minute */
    $url = $g . '/' . rawurlencode($pid) . '/conversations?' . http_build_query(['platform' => 'messenger', 'fields' => 'id,updated_time,participants,messages.limit(15){id,message,from,created_time}', 'limit' => 25, 'access_token' => $P['token']]);
    for ($pg = 0; $pg < 8 && $url !== ''; $pg++) {
        $r = $gget($url);
        if (isset($r['error'])) { $res['error'] = (string) ($r['error']['message'] ?? '?'); return $res; }   /* mlast kept: tried again next run */
        $stop = false;
        foreach ((array) ($r['data'] ?? []) as $c) { $u = strtotime((string) ($c['updated_time'] ?? '')) ?: 0; if ($u <= $since) { $stop = true; break; } $convs[] = $c; $newest = max($newest, $u); }
        $url = $stop ? '' : (string) ($r['paging']['next'] ?? '');
    }
    $leads = leadsAll(); $byConv = []; $byPhone = []; $byEmail = []; $byName = [];
    foreach ($leads as $l) {
        if (!empty($l['mconv'])) $byConv[(string) $l['mconv']] = $l['id'];
        if (str_starts_with((string) ($l['ext'] ?? ''), 'mc:')) $byConv[substr((string) $l['ext'], 3)] = $l['id'];
        if (in_array($l['status'] ?? '', ['lost', 'won'], true)) continue;   /* a new chat from an old customer is a new enquiry */
        $d = $digits($l['phone'] ?? ''); if (strlen($d) === 10) $byPhone[$d] = $byPhone[$d] ?? $l['id'];
        $e = strtolower(trim((string) ($l['email'] ?? ''))); if ($e !== '') $byEmail[$e] = $byEmail[$e] ?? $l['id'];
        $n = cuName((string) ($l['name'] ?? '')); if (substr_count($n, ' ') >= 1) $byName[$n] = $byName[$n] ?? $l['id'];
    }
    foreach (array_reverse($convs) as $c) {   /* oldest first */
        $cid = substr((string) preg_replace('/[^0-9A-Za-z_:.-]/', '', (string) ($c['id'] ?? '')), 0, 80); if ($cid === '') continue;
        $who = null; foreach ((array) ($c['participants']['data'] ?? []) as $pp) if ((string) ($pp['id'] ?? '') !== $pid) { $who = $pp; break; }
        $name = a365Clean((string) ($who['name'] ?? ''), 120);
        $mine = []; $allText = '';
        foreach ((array) ($c['messages']['data'] ?? []) as $m) {
            if ((string) ($m['from']['id'] ?? '') === $pid) continue;   /* the Page's own replies */
            $txt = a365Clean((string) ($m['message'] ?? ''), 600); $allText .= ' ' . $txt;
            $at = strtotime((string) ($m['created_time'] ?? '')) ?: 0; $mid = (string) ($m['id'] ?? '');
            if ($at > $since - 120 && $txt !== '' && ($mid === '' || !isset($seen[$mid]))) { $mine[] = ['t' => $txt, 'at' => $at]; if ($mid !== '') $took[] = $mid; }
        }
        if (!$mine) { $res['skipped']++; continue; }   /* only the Page wrote, or a sticker or photo with no words */
        usort($mine, fn($a, $b) => $a['at'] <=> $b['at']);
        [$phone, $email] = metaMsgContact($allText);
        $lid = $byConv[$cid] ?? ''; $why = $lid !== '' ? 'this chat' : '';
        if ($lid === '' && strlen($digits($phone)) === 10) { $lid = $byPhone[$digits($phone)] ?? ''; $why = 'same phone'; }
        if ($lid === '' && $email !== '') { $lid = $byEmail[$email] ?? ''; $why = 'same email'; }
        if ($lid === '') { $n = cuName($name); if (substr_count($n, ' ') >= 1) { $lid = $byName[$n] ?? ''; $why = 'same name'; } }
        if ($dry) { $res['plan'][] = ['name' => $name, 'phone' => $phone, 'email' => $email, 'at' => end($mine)['at'], 'first' => $mine[0]['at'], 'texts' => array_map(fn($m) => $m['t'], array_slice($mine, -5)), 'do' => $lid !== '' ? 'note' : 'new', 'lead' => $lid, 'leadName' => $lid !== '' ? (string) ($leads[$lid]['name'] ?? '') : '', 'leadStatus' => $lid !== '' ? (string) ($leads[$lid]['status'] ?? '') : '', 'why' => $lid !== '' ? $why : '']; continue; }
        if ($lid !== '') {   /* someone we have: their messages as notes, the conversation tied to them */
            if (!isset($byConv[$cid])) { appendLine(leadsDir() . '/leadst.log', ['id' => $lid, 'mconv' => $cid, 'by' => 'Messenger', 'at' => time()]); $byConv[$cid] = $lid; }
            foreach (array_slice($mine, -5) as $m) { appendLine(leadsDir() . '/leadst.log', ['id' => $lid, 'note' => 'Facebook message: ' . $m['t'], 'by' => 'Messenger', 'at' => $m['at']]); $res['notes']++; }
            if (($leads[$lid]['status'] ?? '') === 'unreached') { leadRevive($lid, 'sent a Facebook message', 'Messenger'); $leads[$lid]['status'] = 'new'; }   /* Couldn't reach, then wrote to us (2026-10-21) */
            continue;
        }
        $row = ['id' => 'm' . date('YmdHis') . bin2hex(random_bytes(3)), 'src' => 'messenger', 'at' => $mine[0]['at'], 'need' => 'Facebook message', 'name' => $name, 'phone' => $phone, 'email' => $email,
                'town' => '', 'msg' => a365Clean(implode("\n", array_map(fn($m) => $m['t'], array_slice($mine, -5))), 2000), 'by' => 'Facebook', 'ext' => 'mc:' . $cid, 'page' => a365Clean((string) $P['name'], 80)];
        if (!appendLine(leadsDir() . '/leads.log', $row)) { $res['error'] = 'could not save a Messenger lead'; return $res; }
        $byConv[$cid] = $row['id']; $res['added'][] = ($name ?: 'Someone') . ' (Messenger)';
    }
    $res['page']['mlast'] = max($since, $newest - 60);
    $res['page']['mseen'] = array_slice(array_merge((array) ($P['mseen'] ?? []), $took), -500);
    return $res;
}
/* the Messenger preview (2026-10-20, Matthew: "show me this on our app but only for my account ... just so i can see what it looks like"):
   Traverse's own sign-in only. The last few days of the Page's Messenger chats, run through the same matching, showing what each would become
   (a New lead, or a note on a lead already here). Nothing is saved, nothing is marked handled. Uses its own key file,
   sixfold-private/meta-messenger.json (system_token; the system user's key WITH pages_messaging), so the live form-lead key is not touched. */
if ($action === 'msgpreview') {
    if (!$realSuper) fail('Not allowed.', 403);
    $S = json_decode((string) @file_get_contents(dirname(__DIR__, 2) . '/sixfold-private/meta-messenger.json'), true);
    if (!is_array($S) || empty($S['system_token'])) fail('The Messenger key is not on the server.');
    $g = rtrim((string) ($S['graph'] ?? 'https://graph.facebook.com/v23.0'), '/');
    $gget = function (string $url): array { $code = 0; $b = httpGetRaw($url, 25, $code); $j = $b !== null ? json_decode($b, true) : null; if (!is_array($j) && $code !== 200) { $raw = null; if (function_exists('curl_init')) { $c = curl_init($url); curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25]); $raw = curl_exec($c); curl_close($c); } $j = is_string($raw) ? json_decode($raw, true) : null; } return is_array($j) ? $j : ['error' => ['message' => 'no answer (HTTP ' . $code . ')']]; };
    $acc = $gget($g . '/me/accounts?' . http_build_query(['fields' => 'id,name,access_token', 'limit' => 50, 'access_token' => (string) $S['system_token']]));
    if (empty($acc['data'])) fail('Facebook did not answer: ' . (string) ($acc['error']['message'] ?? 'no pages'));
    $days = max(1, min(14, (int) ($_GET['days'] ?? 7)));
    $digits = fn($p) => substr((string) preg_replace('/\D/', '', (string) $p), -10);
    $plan = []; $skipped = 0; $errs = [];
    foreach ($acc['data'] as $p) {
        if (empty($p['access_token'])) continue;
        $r = metaMessenger($g, $gget, ['id' => (string) $p['id'], 'name' => (string) $p['name'], 'token' => (string) $p['access_token'], 'mlast' => time() - $days * 86400], $digits, true);
        if ($r['error'] !== '') $errs[] = $p['name'] . ': ' . $r['error'];
        foreach ($r['plan'] as $x) $plan[] = $x + ['page' => (string) $p['name']];
        $skipped += $r['skipped'];
    }
    usort($plan, fn($a, $b) => $b['at'] <=> $a['at']);
    out(['ok' => true, 'days' => $days, 'plan' => $plan, 'skipped' => $skipped, 'errors' => $errs, 'on' => feature('fbmessenger')]);
}
if ($action === 'metasetup' || $action === 'metapoll') {
    if (!(PHP_SAPI === 'cli' && defined('SIXFOLD_CLI'))) fail('Not here.', 404);
    $graphBase = fn($M) => rtrim((string) ($M['graph'] ?? 'https://graph.facebook.com/v23.0'), '/');
    $gget = function (string $url): array { $code = 0; $b = httpGetRaw($url, 25, $code); $j = $b !== null ? json_decode($b, true) : null; if (!is_array($j) && $code !== 200) { $raw = null; if (function_exists('curl_init')) { $c = curl_init($url); curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25]); $raw = curl_exec($c); curl_close($c); } $j = is_string($raw) ? json_decode($raw, true) : null; } return is_array($j) ? $j : ['error' => ['message' => 'no answer (HTTP ' . $code . ')']]; };
    if ($action === 'metasetup') {
        $sf = (string) ($_GET['file'] ?? ''); $S = json_decode((string) @file_get_contents($sf), true);
        /* a system user's token (Business Settings > System users, "never expires"; 2026-10-14, the Graph API Explorer would not give a
           user token) is used as it is; a user's token is first swapped for a long-lived one with the app id and secret */
        if (!is_array($S) || (empty($S['system_token']) && (empty($S['app_id']) || empty($S['app_secret']) || empty($S['user_token'])))) fail('The setup file needs system_token, or app_id, app_secret and user_token.');
        $M = ['graph' => (string) ($S['graph'] ?? 'https://graph.facebook.com/v23.0')]; $g = $graphBase($M);
        if (!empty($S['system_token'])) $x = ['access_token' => (string) $S['system_token']];
        else $x = $gget($g . '/oauth/access_token?' . http_build_query(['grant_type' => 'fb_exchange_token', 'client_id' => $S['app_id'], 'client_secret' => $S['app_secret'], 'fb_exchange_token' => $S['user_token']]));
        if (empty($x['access_token'])) fail('Meta did not swap the token: ' . (string) ($x['error']['message'] ?? 'no reason given'));
        $acc = $gget($g . '/me/accounts?' . http_build_query(['fields' => 'id,name,access_token,tasks', 'limit' => 100, 'access_token' => $x['access_token']]));
        if (empty($acc['data'])) fail('No pages came back: ' . (string) ($acc['error']['message'] ?? 'the token has no page permissions'));
        $want = array_map('strtolower', (array) ($S['pages'] ?? []));
        $M['pages'] = [];
        foreach ($acc['data'] as $p) if (!empty($p['access_token']) && (!$want || in_array(strtolower((string) $p['name']), $want, true)))
            $M['pages'][] = ['id' => (string) $p['id'], 'name' => (string) $p['name'], 'token' => (string) $p['access_token'], 'last' => time() - 30 * 86400];
        if (!$M['pages']) fail('None of the pages asked for came back.');
        $M['set'] = date('c');
        if (!writeJsonAtomic(metaFile(), $M)) fail('Could not save the page tokens.', 500);
        @chmod(metaFile(), 0600); @unlink($sf);
        out(['ok' => true, 'pages' => array_map(fn($p) => $p['name'], $M['pages'])]);
    }
    $M = json_decode((string) @file_get_contents(metaFile()), true);
    if (!is_array($M) || empty($M['pages'])) out(['ok' => true, 'added' => 0, 'note' => 'not set up']);
    $g = $graphBase($M);
    $digits = fn($p) => substr(preg_replace('/\D/', '', (string) $p), -10);
    $seenExt = []; $seenWho = [];
    foreach (readLines(leadsDir() . '/leads.log') as $l) {
        if (!empty($l['ext'])) $seenExt[preg_replace('/^l:/', '', (string) $l['ext'])] = true;   /* a file import keeps "l:<id>" */
        $d = $digits($l['phone'] ?? ''); if (strlen($d) === 10) $seenWho['p' . $d] = true;
        $e = strtolower(trim((string) ($l['email'] ?? ''))); if ($e !== '') $seenWho['e' . $e] = true;
    }
    $added = []; $errors = []; $mnotes = 0;
    $unWho = unreachedWho();   /* Couldn't reach, then a new Facebook form (2026-10-21) */
    foreach ($M['pages'] as $pi => $P) {
        $since = (int) ($P['last'] ?? (time() - 86400)); $newest = $since; $errBefore = count($errors);
        $forms = $gget($g . '/' . rawurlencode((string) $P['id']) . '/leadgen_forms?' . http_build_query(['fields' => 'id,name,status,questions{key,label}', 'limit' => 100, 'access_token' => $P['token']]));
        if (isset($forms['error'])) { $errors[] = $P['name'] . ': ' . (string) ($forms['error']['message'] ?? '?'); continue; }
        foreach ((array) ($forms['data'] ?? []) as $F) {
            $url = $g . '/' . rawurlencode((string) $F['id']) . '/leads?' . http_build_query(['fields' => 'id,created_time,field_data,ad_name', 'limit' => 100, 'access_token' => $P['token'],
                'filtering' => json_encode([['field' => 'time_created', 'operator' => 'GREATER_THAN', 'value' => $since]])]);
            for ($pg = 0; $pg < 10 && $url; $pg++) {
                $r = $gget($url);
                if (isset($r['error'])) { $errors[] = $P['name'] . ' / ' . (string) ($F['name'] ?? $F['id']) . ': ' . (string) ($r['error']['message'] ?? '?'); break; }
                foreach ((array) ($r['data'] ?? []) as $L) {
                    $ext = substr((string) preg_replace('/[^0-9A-Za-z_:.-]/', '', (string) ($L['id'] ?? '')), 0, 64); if ($ext === '') continue;
                    $at = strtotime((string) ($L['created_time'] ?? '')) ?: time(); $newest = max($newest, $at);
                    if (isset($seenExt[$ext])) continue;
                    $qLab = []; foreach ((array) ($F['questions'] ?? []) as $q) if (isset($q['key'])) $qLab[strtolower((string) $q['key'])] = (string) ($q['label'] ?? '');
                    $fv = metaFields((array) ($L['field_data'] ?? []), $qLab);
                    $name = a365Clean($fv['name'], 120); $phone = a365Clean($fv['phone'], 40); $email = a365Clean($fv['email'], 160); if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $email = '';
                    if ($name === '' && $phone === '' && $email === '') continue;
                    $d = $digits($phone); $who = strlen($d) === 10 ? 'p' . $d : ($email !== '' ? 'e' . strtolower($email) : '');
                    $seenExt[$ext] = true;
                    if ($who !== '' && isset($unWho[$who])) { leadRevive($unWho[$who], 'filled in a Facebook form again', 'Facebook'); $added[] = ($name ?: $phone) . ' (back)'; unset($unWho[$who]); continue; }
                    if ($who !== '' && isset($seenWho[$who])) continue;
                    $msg = implode("\n", array_merge($fv['extra'], !empty($L['ad_name']) ? ['Ad: ' . $L['ad_name']] : []));
                    $row = ['id' => 'm' . date('YmdHis') . bin2hex(random_bytes(3)), 'src' => 'meta', 'at' => $at, 'need' => a365Clean((string) ($F['name'] ?? ''), 60),
                            'name' => $name, 'phone' => $phone, 'email' => $email, 'town' => a365Clean($fv['town'], 160), 'msg' => a365Clean($msg, 2000), 'by' => 'Facebook', 'ext' => $ext, 'page' => a365Clean((string) $P['name'], 80)];
                    if (!appendLine(leadsDir() . '/leads.log', $row)) { $errors[] = 'could not save a lead'; continue; }
                    if ($who !== '') $seenWho[$who] = true;
                    if ($fv['street'] !== '') { $h = a365Match($fv['street'], $fv['city']); if ($h) appendLine(leadsDir() . '/leadst.log', ['id' => $row['id'], 'house' => $h, 'by' => 'Facebook', 'at' => time()]); }
                    $added[] = ($name ?: $phone) . ' (' . $P['name'] . ')';
                }
                $url = (string) ($r['paging']['next'] ?? '');
            }
        }
        if (count($errors) === $errBefore) $M['pages'][$pi]['last'] = max($since, $newest - 60);   /* a minute of overlap: Meta's clock and ours; the ids stop doubles. Fable review 2026-10-14: not past a form that failed */
        if (feature('fbmessenger')) { $mr = metaMessenger($g, $gget, $P, $digits); $M['pages'][$pi] = $mr['page']; $added = array_merge($added, $mr['added']); $mnotes += $mr['notes']; if ($mr['error'] !== '') $errors[] = $P['name'] . ' / Messenger: ' . $mr['error']; }
    }
    $M['ran'] = date('c'); $M['errors'] = $errors;
    writeJsonAtomic(metaFile(), $M); @chmod(metaFile(), 0600);
    if ($added && leadAlertsOn()) a365Alert(count($added) === 1 ? 'New Facebook lead' : count($added) . ' new Facebook leads', implode(', ', array_slice($added, 0, 4)), false, true);
    out(['ok' => true, 'added' => count($added), 'who' => $added, 'errors' => $errors, 'mnotes' => $mnotes]);
}
/* ---- ClickUp (2026-10-16, Matthew: "attach clickup to our app to take the leads [Jen] is filing into our app"; "run a scan for
 * duplicates after each pull") ----
 * sixfold-tools/clickup-leads.php asks for this every 5 minutes (started by the Facebook job). One way only: ClickUp into the app,
 * nothing is ever written back. Jen's list is named in sixfold-private/clickup.json (token, list, owner; never printed).
 * Each task is matched once and for good: by its ClickUp id ('cu' on the lead), else by the same phone, email or full name already
 * here, which is linked instead of added (so two tasks for one person make one lead). New people get a lead with her fields in the
 * message, the house when the address is on our lists, and are hers (qown). Her status moves a lead forward only when it changed in
 * ClickUp since the last look ('cus'), never back and never off Won, so a change made in the app is not undone. Then the whole
 * Pipeline is checked for doubles (same phone, same email or same full name) into leads/dupes.json, with a push to the super admin
 * when a new double appears. */
function cuFile(): string { return dirname(__DIR__, 2) . '/sixfold-private/clickup.json'; }
const LEAD_SRC_NAME = ['website' => 'Sixfold website', 'meta' => 'Facebook', 'nextdoor' => 'Nextdoor', 'phone' => 'phone', 'linktree' => 'Linktree', 'referral' => 'referral', 'other' => 'other', 'messenger' => 'Messenger', 'a365web' => '365 website', 'inperson' => 'in person', 'door' => 'at the door'];
if ($action === 'leadsrc') {   /* where a lead came from, corrected by an admin (2026-10-20, Matthew: Russ "comes off as a referral"); the ClickUp sync sets it only when it makes the lead */
    if (!feature('walkdesk') || $role !== 'admin' || !$isPost) fail('Not allowed.', 403);
    $id = (string) ($body['id'] ?? ''); $all = leadsAll();
    if (!leadOk($id) || !isset($all[$id])) fail('No such lead.', 404);
    $src = (string) ($body['src'] ?? ''); if (!in_array($src, LEAD_SRC, true) || $src === 'website') fail('Pick where they came from.');
    $was = (string) ($all[$id]['src'] ?? ''); if ($src === $was) out(['ok' => true, 'same' => true]);
    $why = $clean($body['why'] ?? '', 120);
    if (!appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'src' => $src, 'note' => 'Came from: ' . (LEAD_SRC_NAME[$was] ?? ($was ?: 'not set')) . ' → ' . (LEAD_SRC_NAME[$src] ?? $src) . ($why !== '' ? ' (' . $why . ')' : '') . '.', 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
function cuCheckOk(): array { $j = json_decode((string) @file_get_contents(DATA_DIR . '/clickup-check-ok.json'), true); return is_array($j['keys'] ?? null) ? $j['keys'] : []; }
/** the sync check for the Pipeline: what still does not match, less what was left as it is */
function cuCheckShown(): ?array {
    $j = json_decode((string) @file_get_contents(DATA_DIR . '/clickup-check.json'), true); if (!is_array($j)) return null;
    $ok = array_flip(cuCheckOk());
    return ['at' => (int) ($j['at'] ?? 0), 'items' => array_values(array_filter((array) ($j['items'] ?? []), fn($i) => !isset($ok[$i['key'] ?? '']))), 'quiet' => count(array_filter((array) ($j['items'] ?? []), fn($i) => isset($ok[$i['key'] ?? ''])))];
}
function cuName(string $n): string { return trim((string) preg_replace('/\s+/', ' ', (string) preg_replace('/[^a-z ]/', '', strtolower($n)))); }
function leadDupes(array $leads): array {
    $by = [];
    foreach ($leads as $l) {
        if (($l['status'] ?? '') === 'lost') continue;
        $d = substr((string) preg_replace('/\D/', '', (string) ($l['phone'] ?? '')), -10); if (strlen($d) === 10) $by['phone ' . $d][$l['id']] = (string) ($l['name'] ?? '');
        $e = strtolower(trim((string) ($l['email'] ?? ''))); if ($e !== '') $by['email ' . $e][$l['id']] = (string) ($l['name'] ?? '');
        $n = cuName((string) ($l['name'] ?? '')); if (substr_count($n, ' ') >= 1) $by['name ' . $n][$l['id']] = (string) ($l['name'] ?? '');
    }
    $out = [];
    foreach ($by as $k => $ids) if (count($ids) > 1) { ksort($ids); $out[implode(',', array_keys($ids))][] = ['why' => explode(' ', $k)[0], 'ids' => array_keys($ids), 'names' => array_values(array_unique($ids))]; }
    return array_map(fn($g) => ['ids' => $g[0]['ids'], 'names' => $g[0]['names'], 'why' => implode(', ', array_unique(array_column($g, 'why')))], array_values($out));
}
function superAlert(string $title, string $text): void {
    global $basePeople, $acct, $sessionKey;
    try {
        $v = pushVapid(false); if (!$v) return;
        $subs = pushSubs(); $payload = json_encode(['title' => $title, 'body' => $text, 'url' => './', 'tag' => 'dupes-' . time(), 'at' => time()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        foreach (acctRows($basePeople, $acct, $sessionKey) as $r) if (!$r['off'] && $r['role'] === 'super') foreach (($subs[$r['id']] ?? []) as $d) webpushSend($d['sub'], $payload, $v, 86400, ['urgency' => 'normal']);
    } catch (Throwable $e) { error_log('rounds super alert: ' . $e->getMessage()); }
}
if ($action === 'clickuppoll') {
    if (!(PHP_SAPI === 'cli' && defined('SIXFOLD_CLI'))) fail('Not here.', 404);
    @ini_set('memory_limit', '1024M');   /* matching an address can rebuild the search index after a town upload */
    $CU = json_decode((string) @file_get_contents(cuFile()), true);
    if (!is_array($CU) || empty($CU['token']) || empty($CU['list'])) out(['ok' => true, 'added' => 0, 'note' => 'not set up']);
    $base = rtrim((string) ($CU['api'] ?? 'https://api.clickup.com/api/v2'), '/');   /* the override is for the test copy only */
    $cget = function (string $path) use ($CU, $base): ?array {
        if (!function_exists('curl_init')) return null;
        $h = curl_init($base . $path);
        curl_setopt_array($h, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_HTTPHEADER => ['Authorization: ' . $CU['token'], 'Accept: application/json']]);
        $raw = curl_exec($h); $code = (int) curl_getinfo($h, CURLINFO_HTTP_CODE); curl_close($h);
        $j = is_string($raw) ? json_decode($raw, true) : null; return $code === 200 && is_array($j) ? $j : null;
    };
    $list = rawurlencode((string) $CU['list']); $owner = (string) ($CU['owner'] ?? '');
    $F = $cget('/list/' . $list . '/field'); if (!$F) out(['ok' => false, 'error' => 'ClickUp did not answer (the list or the token).']);
    $opt = []; foreach ((array) ($F['fields'] ?? []) as $f) foreach ((array) ($f['type_config']['options'] ?? []) as $o) $opt[$f['name']][(string) ($o['orderindex'] ?? '')] = (string) ($o['name'] ?? '');
    $tasks = [];
    for ($pg = 0; $pg < 20; $pg++) { $T = $cget('/list/' . $list . '/task?include_closed=true&subtasks=true&page=' . $pg); if (!$T) out(['ok' => false, 'error' => 'ClickUp did not send the tasks.']); $tasks = array_merge($tasks, (array) ($T['tasks'] ?? [])); if (!empty($T['last_page']) || count((array) ($T['tasks'] ?? [])) < 100) break; }
    /* her contact in ClickUp as a call try (2026-10-17, Matthew: "most of the people in our pipeline have been contacted via voicemail ... yet it
       doesnt show up that way in our pipeline"): the Pipeline's Left voicemail and Texted tabs come from tries, so a ClickUp status that says
       she left a voicemail or texted is logged once as one, dated when she changed it ('cutry' = the status it came from). Only while the lead
       is still at the calling stage, and never older than a try already on it. */
    $TRY = ['contacted - vm / sms' => 'vm', 'contacted - fb messenger' => 'text'];
    $cuTry = function (array $l, string $id, string $cst, array $t) use ($TRY, $owner): void {
        $now = time();
        if (!isset($TRY[$cst]) || (string) ($l['cutry'] ?? '') === $cst) return;
        $at = is_numeric($t['date_updated'] ?? null) ? min($now, intdiv((int) $t['date_updated'], 1000)) : $now;
        $last = 0; foreach ((array) ($l['tries'] ?? []) as $x) $last = max($last, (int) ($x['at'] ?? 0));
        $row = ['id' => $id, 'cutry' => $cst, 'by' => ($owner !== '' ? $owner : 'Jen') . ' (ClickUp)', 'at' => $at];
        if (in_array((string) ($l['status'] ?? 'new'), ['new', 'contacted'], true) && $at > $last) $row['try'] = $TRY[$cst];
        appendLine(leadsDir() . '/leadst.log', $row);
    };
    $SCHED_NOTE = 'Scheduled in Jen\'s ClickUp (a sale): no job on the board yet, book the day on the Jobs board.';
    $STATUS = ['contacted - vm / sms' => 'contacted', 'contacted - fb messenger' => 'contacted', 'on hold' => 'hold', 'quote sent' => 'quoted', 'scheduled' => 'won', 'completed' => 'won', 'lost' => 'lost'];
    $RANK = ['new' => 0, 'contacted' => 1, 'walk' => 2, 'quoted' => 3, 'won' => 4];
    $SRC = ['Referral' => 'referral', 'Website' => 'a365web', 'Facebook' => 'meta', 'Phone' => 'phone'];
    $digits = fn($p) => substr((string) preg_replace('/\D/', '', (string) $p), -10);
    $leads = leadsAll(); $byCu = []; $byPhone = []; $byEmail = []; $byName = [];
    /* a new task matches by contact only an OPEN lead (2026-10-18, Fable review): a returning customer or a second person on the same phone
       was linked to last year's lead (lost, or won with the job done), proof forced Won and the new enquiry never showed. Now it becomes a new
       lead and the duplicate scan flags the pair. A task already linked (cu) stays with its lead. */
    $doneLead = []; foreach (jobsAll() as $dj) if (!$dj['off'] && !empty($dj['done'])) $doneLead[(string) $dj['lead']] = true;
    $index = function (array $l) use (&$byCu, &$byPhone, &$byEmail, &$byName, $digits, $doneLead) {
        if (!empty($l['cu'])) $byCu[(string) $l['cu']] = $l['id'];
        if (($l['status'] ?? '') === 'lost' || (($l['status'] ?? '') === 'won' && isset($doneLead[(string) $l['id']]))) return;
        $d = $digits($l['phone'] ?? ''); if (strlen($d) === 10) $byPhone[$d] = $byPhone[$d] ?? $l['id'];
        $e = strtolower(trim((string) ($l['email'] ?? ''))); if ($e !== '') $byEmail[$e] = $byEmail[$e] ?? $l['id'];
        $n = cuName((string) ($l['name'] ?? '')); if (substr_count($n, ' ') >= 1) $byName[$n] = $byName[$n] ?? $l['id'];
    };
    foreach ($leads as $l) $index($l);
    $added = []; $linked = []; $moved = []; $now = time(); $syncState = []; $taskOf = []; $taskDup = [];
    foreach ($tasks as $t) {
        $tid = (string) ($t['id'] ?? ''); if (!preg_match('/^[A-Za-z0-9]{3,20}$/D', $tid)) continue;
        $cf = []; foreach ((array) ($t['custom_fields'] ?? []) as $c) $cf[(string) ($c['name'] ?? '')] = $c['value'] ?? null;
        $pick = fn($k) => isset($cf[$k]) && $cf[$k] !== null && $cf[$k] !== '' ? ($opt[$k][(string) $cf[$k]] ?? '') : '';
        $name = a365Clean((string) ($t['name'] ?? ''), 120); $phone = a365Clean((string) ($cf['Phone'] ?? ''), 40); $email = a365Clean((string) ($cf['Email'] ?? ''), 160);
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $email = '';
        $addr = is_array($cf['Address'] ?? null) ? trim((string) preg_replace('/,\s*USA$/', '', (string) ($cf['Address']['formatted_address'] ?? ''))) : '';
        $city = a365Clean((string) ($cf['City'] ?? ''), 60);
        $cst = strtolower(trim((string) ($t['status']['status'] ?? ''))); $want = $STATUS[$cst] ?? '';
        $deal = is_numeric($cf['Deal Value'] ?? null) ? (int) round((float) $cf['Deal Value']) : 0;
        /* who is it: this task before, else the same phone, email or full name (a name only when the phones do not disagree) */
        $id = $byCu[$tid] ?? '';
        if ($id === '') { $d = $digits($phone); if (strlen($d) === 10 && isset($byPhone[$d])) $id = $byPhone[$d]; }
        if ($id === '' && $email !== '' && isset($byEmail[strtolower($email)])) $id = $byEmail[strtolower($email)];
        if ($id === '') { $n = cuName($name); if (substr_count($n, ' ') >= 1 && isset($byName[$n])) { $o = $leads[$byName[$n]]; $od = $digits($o['phone'] ?? ''); $d = $digits($phone); if (strlen($od) !== 10 || strlen($d) !== 10 || $od === $d) $id = $byName[$n]; } }
        $lines = array_values(array_filter(['From Jen\'s ClickUp: ' . ($t['status']['status'] ?? ''), $deal ? 'Deal value $' . number_format($deal) : '', ($s = $pick('Service')) !== '' ? 'Service: ' . $s : '',
            is_numeric($cf['Service Date'] ?? null) ? 'Service date: ' . (new DateTime('@' . intdiv((int) $cf['Service Date'], 1000)))->setTimezone(new DateTimeZone(appTz()))->format('D j M') : '',
            ($s = $pick('Payment Status')) !== '' ? 'Payment: ' . $s : '', ($s = $pick('Card Status')) !== '' ? 'Card: ' . $s : '', ($s = a365Clean((string) ($cf['Next Step Summary'] ?? ''), 300)) !== '' ? 'Next step: ' . $s : '']));
        if ($id === '') {   /* someone new */
            if ($name === '' && $phone === '' && $email === '') continue;
            $src = $cst === 'contacted - fb messenger' ? 'messenger' : ($SRC[$pick('Lead Source')] ?? 'other');
            $at = is_numeric($t['date_created'] ?? null) ? intdiv((int) $t['date_created'], 1000) : $now;
            $row = ['id' => 'm' . date('YmdHis') . bin2hex(random_bytes(3)), 'src' => $src, 'at' => min($at, $now), 'need' => $pick('Service') ?: 'Aeration', 'name' => $name, 'phone' => $phone, 'email' => $email,
                    'town' => $addr !== '' ? a365Clean($addr, 160) : $city, 'msg' => a365Clean(implode("\n", $lines), 2000), 'by' => 'ClickUp'];
            if (!appendLine(leadsDir() . '/leads.log', $row)) continue;
            $u = ['id' => $row['id'], 'cu' => $tid, 'cus' => $cst, 'cud' => $deal, 'by' => 'ClickUp', 'at' => $now];
            if ($owner !== '') $u['qown'] = $owner;
            if ($want !== '' && $want !== 'new') { $u['status'] = $want; $u['note'] = 'From Jen\'s ClickUp (' . ($t['status']['status'] ?? '') . ').'; }
            if ($cst === 'scheduled') $u['note'] = $SCHED_NOTE;   /* a sale, nothing booked here yet: Won, and a note to book it (2026-10-17) */
            appendLine(leadsDir() . '/leadst.log', $u);
            if ($addr !== '' && preg_match('/^\s*\d+\s+[^,]+/', $addr, $m)) { $parts = array_map('trim', explode(',', $addr)); $h = a365Match($parts[0], $parts[1] ?? $city); if ($h) appendLine(leadsDir() . '/leadst.log', ['id' => $row['id'], 'house' => $h, 'by' => 'ClickUp', 'at' => $now]); }
            $row['cu'] = $tid; $row['status'] = $want ?: 'new'; $leads[$row['id']] = $row; $index($row);
            $cuTry(['status' => $row['status'], 'tries' => []], $row['id'], $cst, $t);
            $taskOf[$tid] = $row['id']; $added[] = $name ?: $phone; continue;
        }
        /* someone already here: link once, fill what is missing, her status forward only when it changed in ClickUp */
        $l = $leads[$id]; $u = ['id' => $id, 'by' => 'ClickUp', 'at' => $now]; $notes = [];
        if (($l['cu'] ?? '') === '') { $u['cu'] = $tid; $notes[] = 'Linked to Jen\'s ClickUp task.'; $linked[] = (string) ($l['name'] ?? $name); $byCu[$tid] = $id; $leads[$id]['cu'] = $tid; }
        if (($l['cu'] ?? '') !== '' && $l['cu'] !== $tid) { $taskDup[] = ['tid' => $tid, 'name' => $name, 'lead' => (string) ($l['name'] ?? '')]; continue; }   /* a second task for someone already linked: the sync check lists it */
        $taskOf[$tid] = $id;
        $ct = []; if (trim((string) ($l['phone'] ?? '')) === '' && $phone !== '') $ct['phone'] = $phone; if (trim((string) ($l['email'] ?? '')) === '' && $email !== '') $ct['email'] = $email;
        if ($ct) { $u['contact'] = $ct; $notes[] = 'From ClickUp: ' . implode(', ', array_values($ct)) . '.'; }
        if ($owner !== '' && !in_array($owner, (array) ($l['qown'] ?? []), true) && ($l['by'] ?? '') !== $owner) $u['qown'] = $owner;
        /* ClickUp decides the stage (2026-10-17, Matthew: "make sure everything is synced right in the meantime"): her status every pull, forward
           or back, so a stage changed some other way here comes back in line. What the app can prove wins: a signed form, a booking confirmed,
           a job on the board or a deposit paid make it Won whatever ClickUp says (the mismatch check lists those for her). A walk booked here
           is further along than her "contacted". "Scheduled" with nothing booked here stays a quote, with a note. */
        $st = (string) ($l['status'] ?? 'new'); $cusChanged = $cst !== '' && $cst !== (string) ($l['cus'] ?? '');
        if ($cusChanged) $u['cus'] = $cst;
        $proof = !empty($l['signed']) || !empty($l['confirmed']) || !empty($l['sqpaid']) || (bool) jobForLead($id);
        $tgt = $want;
        if ($cst === 'scheduled' && !jobForLead($id) && $cusChanged) $notes[] = $SCHED_NOTE;   /* a sale: Won, but nothing booked here yet */
        if ($proof && $tgt !== '') $tgt = 'won';
        if ($tgt === 'contacted' && $st === 'walk') $tgt = 'walk';
        /* Couldn't reach is set here, not in ClickUp (2026-10-21): it holds until her ClickUp status changes; a change brings the lead back */
        if ($st === 'unreached' && !$cusChanged && !$proof) $tgt = $st;
        if ($st === 'unreached' && $tgt !== '' && $tgt !== $st) { $u['back'] = 'moved in Jen\'s ClickUp'; $u['recall'] = ''; $notes[] = 'Back from Couldn\'t reach.'; }
        if ($tgt !== '' && $tgt !== $st) { $u['status'] = $tgt; $notes[] = 'ClickUp: ' . ($t['status']['status'] ?? '') . '.'; $moved[] = (string) ($l['name'] ?? $name) . ' (' . $tgt . ')'; }
        $syncState[$id] = ['cst' => $cst, 'proof' => $proof, 'tgt' => $tgt, 'name' => (string) ($l['name'] ?? $name)];
        if ($deal && $deal !== (int) ($l['cud'] ?? 0)) { $u['cud'] = $deal; $notes[] = 'ClickUp deal value $' . number_format($deal) . '.'; }
        if ((empty($l['house']) || !empty($l['house']['typed'])) && $addr !== ''   /* a typed address gives way to the house on our lists */ && preg_match('/^\s*\d+\s+[^,]+/', $addr)) { $parts = array_map('trim', explode(',', $addr)); $h = a365Match($parts[0], $parts[1] ?? $city); if ($h) $u['house'] = $h; }
        if (count($u) > 3) { if ($notes) $u['note'] = implode(' ', $notes); appendLine(leadsDir() . '/leadst.log', $u); }
        $cuTry(['status' => $u['status'] ?? ($l['status'] ?? 'new')] + $l, $id, $cst, $t);
        /* completed in her ClickUp: the job done here (2026-10-19, Matthew). Once per job ('cudone'), so an Undo here is not fought every pull;
           only a job whose day has come. The crew can still add their time to it. */
        if ($cst === 'completed' && ($cj = jobForLead($id)) && empty($cj['done']) && empty($cj['cudone']) && (string) $cj['date'] <= (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d')) {
            appendLine(DATA_DIR . '/jobs.log', ['id' => (string) $cj['id'], 'done' => ['o' => 'done', 'note' => 'Marked completed in Jen\'s ClickUp.', 'collected' => 0, 'mins' => 0, 'by' => 'ClickUp', 'at' => $now], 'cudone' => $now, 'by' => 'ClickUp', 'at' => $now]);
            appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'note' => 'Job done (completed in Jen\'s ClickUp).', 'by' => 'ClickUp', 'at' => $now]);
            if (jobOwed($cj) < 1) jobAftercare((string) $cj['id'], 'done');
            $moved[] = (string) ($l['name'] ?? $name) . ' (job done)';
        }
    }
    /* the sync check, every pull (2026-10-17): whatever still does not match between ClickUp and the app */
    $cuItems = []; $leadsNow = leadsAll();
    foreach ($tasks as $t) { $tid = (string) ($t['id'] ?? ''); if ($tid !== '' && !isset($taskOf[$tid]) && !in_array($tid, array_column($taskDup, 'tid'), true)) $cuItems[] = ['key' => 'cu:' . $tid, 'text' => 'In ClickUp, not in the app: ' . (a365Clean((string) ($t['name'] ?? ''), 80) ?: 'a task with no name') . ' (' . ($t['status']['status'] ?? '') . '). It has no name, phone or email the app can use.']; }
    foreach ($taskDup as $d) $cuItems[] = ['key' => 'dup:' . $d['tid'], 'text' => 'A second ClickUp task for ' . ($d['lead'] ?: $d['name']) . ': only the first is followed. Jen can delete the extra one.'];
    foreach ($syncState as $lid => $x) if ($x['cst'] === 'scheduled' && !jobForLead((string) $lid)) $cuItems[] = ['key' => 'nojob:' . $lid, 'text' => $x['name'] . ': scheduled in ClickUp, so Won here, but there is no job on the board yet. Book the day on the Jobs board.'];
    foreach ($syncState as $lid => $x) if ($x['proof'] && $x['cst'] !== '' && !in_array($x['cst'], ['scheduled', 'completed'], true)) $cuItems[] = ['key' => 'proof:' . $lid . ':' . $x['cst'], 'text' => $x['name'] . ': ClickUp says ' . $x['cst'] . ', but the app has them booked or paid, so they stay Won. Jen can move the ClickUp task on.'];
    foreach ($leadsNow as $l) if (empty($l['cu']) && !in_array((string) ($l['status'] ?? 'new'), ['lost', 'won', 'unreached'], true) && ($l['src'] ?? '') !== 'messenger') $cuItems[] = ['key' => 'app:' . $l['id'], 'text' => 'In the app, not in Jen\'s ClickUp: ' . (trim((string) ($l['name'] ?? '')) ?: (string) ($l['phone'] ?? 'a lead')) . ' (' . ((string) ($l['status'] ?? 'new')) . ', ' . (LEAD_SRC_NAME[$l['src'] ?? ''] ?? (string) ($l['src'] ?? '')) . ').'];
    $cf2 = DATA_DIR . '/clickup-check.json'; $old2 = json_decode((string) @file_get_contents($cf2), true); $oldK = array_column((array) ($old2['items'] ?? []), 'key');
    writeJsonAtomic($cf2, ['at' => $now, 'items' => $cuItems]);
    $okK = array_flip(cuCheckOk()); $newI = array_values(array_filter($cuItems, fn($i) => !in_array($i['key'], $oldK, true) && !isset($okK[$i['key']])));
    if ($newI && $old2) superAlert(count($newI) === 1 ? 'ClickUp and the app: one to look at' : 'ClickUp and the app: ' . count($newI) . ' to look at', $newI[0]['text']);
    /* the doubles check, every pull */
    $dupes = leadDupes(leadsAll()); $df = leadsDir() . '/dupes.json';
    $old = json_decode((string) @file_get_contents($df), true); $oldKeys = array_map(fn($g) => implode(',', $g['ids']), (array) ($old['groups'] ?? []));
    $new = array_values(array_filter($dupes, fn($g) => !in_array(implode(',', $g['ids']), $oldKeys, true)));
    writeJsonAtomic($df, ['at' => $now, 'groups' => $dupes]);
    if ($new) superAlert(count($new) === 1 ? 'Possible double in the Pipeline' : count($new) . ' possible doubles in the Pipeline', implode('; ', array_map(fn($g) => implode(' / ', $g['names']) . ' (same ' . $g['why'] . ')', array_slice($new, 0, 3))));
    out(['ok' => true, 'tasks' => count($tasks), 'added' => count($added), 'who' => $added, 'linked' => $linked, 'moved' => $moved, 'dupes' => $dupes]);
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
    $unWho = unreachedWho();   /* Couldn't reach (2026-10-21) */
    foreach ($rows as $r) {
        if (!is_array($r)) { $skipped++; continue; }
        $ext = substr((string) preg_replace('/[^0-9A-Za-z_:.-]/', '', (string) ($r['ext'] ?? '')), 0, 64);
        $phone = $clean(preg_replace('/^p:/i', '', (string) ($r['phone'] ?? '')), 40);
        $email = $clean($r['email'] ?? '', 160); if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $email = '';
        $name = $clean($r['name'] ?? '', 120);
        if ($name === '' && $phone === '' && $email === '') { $skipped++; continue; }
        $d = $digits($phone); $who = strlen($d) === 10 ? 'p' . $d : ($email !== '' ? 'e' . strtolower($email) : '');
        if (!($ext !== '' && isset($seenExt[$ext])) && $who !== '' && isset($unWho[$who])) { leadRevive($unWho[$who], 'filled in a Facebook form again', $me); unset($unWho[$who]); $already++; continue; }
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
/* Send to Jen (2026-10-16): any open lead into her Leads to call, or back out (on false) */
if ($action === 'tojen') {
    if (!desk() || !$isPost || !feature('walkdesk')) fail('Not allowed.', 403);
    $id = (string) ($body['id'] ?? ''); $l = leadOk($id) ? (leadsAll()[$id] ?? null) : null; if (!$l) fail('No such lead.', 404);
    if (($l['src'] ?? '') === 'a365web' && !empty($body['on'])) fail('A 365 website lead stays yours: Jen never sees these.');   /* 2026-10-22 */
    $on = !empty($body['on']);
    if (!appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'tojen' => $on, 'note' => $on ? 'Sent to the Quick quote\'s Leads to call.' : 'Taken back from the Quick quote\'s Leads to call.', 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
/* Not interested, from Jen's Leads to call (2026-10-16): the lead is lost, with a note */
if ($action === 'qdrop') {
    if ((!desk() && $role !== 'quote') || !$isPost || !feature('walkdesk')) fail('Not allowed.', 403);
    $id = (string) ($body['id'] ?? ''); $l = leadOk($id) ? (leadsAll()[$id] ?? null) : null; if (!$l) fail('No such lead.', 404);
    if ($role === 'quote' && !qMine($l) && !quoteInbox($l)) fail('Not allowed.', 403);
    $why = $clean($body['why'] ?? '', 200);
    if (!appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'status' => 'lost', 'note' => 'Not interested (' . $me . ')' . ($why !== '' ? ': ' . $why : '.'), 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
if ($action === 'leadtry') {
    if (!feature('walkdesk')) fail('Not here.', 404);
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $all = leadsAll();
    if (!leadOk($id) || !isset($all[$id])) fail('No such lead.', 404);
    $own = (string) $all[$id]['owner'];
    if (!desk() && !($own !== '' && canManage($own)) && !($role === 'quote' && (qMine($all[$id]) || quoteInbox($all[$id])))) fail('Not allowed.', 403);   /* + Jen's Leads to call (2026-10-16) */
    $o = (string) ($body['o'] ?? '');
    if ($o === 'undo') {
        $mine = array_values(array_filter($all[$id]['tries'], fn($t) => $t['by'] === $me && $t['at'] > time() - 3600));
        if (!$mine) fail('Nothing of yours to undo in the last hour.');
        if (!appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'untry' => end($mine)['at'], 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
        out(['ok' => true]);
    }
    if (!in_array($o, ['none', 'vm', 'talk', 'email', 'text'], true)) fail('Say how it went.');   /* + emailed, texted (2026-10-16) */
    $row = ['id' => $id, 'try' => $o, 'by' => $me, 'at' => time()];
    /* 2026-10-14 (Matthew: "If she left a voicemail she should leave a note as to what the voicemail says incase someone else picks up
       that lead later on"): required for a voicemail, and kept on the lead's notes */
    $tn = $clean($body['note'] ?? '', 400);
    if ($o === 'vm' && $tn === '') fail('Add what you said in the voicemail, for whoever calls next.');
    if ($tn !== '') $row['note'] = mb_substr(($o === 'vm' ? 'Voicemail: ' : ($o === 'talk' ? 'Talked: ' : ($o === 'email' ? 'Emailed: ' : ($o === 'text' ? 'Texted: ' : 'No answer: ')))) . $tn, 0, 500);
    if ($o === 'talk' && $all[$id]['status'] === 'new') $row['status'] = 'contacted';
    if (!appendLine(leadsDir() . '/leadst.log', $row)) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
/* ---- the phone quote (2026-10-14, Matthew: Jen calls; no answer, voicemail or talked; she quotes from our lawn data; "the customer
 * either denies it and nothing is sent over or that are good with the quote then she takes in half the deposit and sents over a short
 * one page form for them to sign"). After a talk: No (closes the lead as no sale) or Call back (stays open); both need a note.
 * Yes: signsend records the price, the deposit (half, taken by Jen herself) and the day held on the jobs board, and gives the
 * signing link; signing books the job (a365signed, before the session check). */
if ($action === 'leadoutcome') {
    if (!feature('walkdesk') || !desk()) fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $all = leadsAll();
    if (!leadOk($id) || !isset($all[$id])) fail('No such lead.', 404);
    $o = (string) ($body['o'] ?? ''); if (!in_array($o, ['no', 'later'], true)) fail('No, or call back later?');
    $note = $clean($body['note'] ?? '', 400); if ($note === '') fail($o === 'no' ? 'Say why it did not go ahead.' : 'Add a note: what they said, and when to call back.');
    $row = ['id' => $id, 'status' => $o === 'no' ? 'lost' : 'contacted', 'note' => mb_substr(($o === 'no' ? 'No sale: ' : 'Call back: ') . $note, 0, 500), 'by' => $me, 'at' => time()];
    $fd = (string) ($body['follow'] ?? ''); if ($o === 'later' && dateOk($fd)) $row['follow'] = [$fd, ''];
    if (!appendLine(leadsDir() . '/leadst.log', $row)) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'status' => $row['status']]);
}
/* a form that needs no signature (2026-10-17, Matthew: "when she sends out a quote she can choose to send one that requires signing and
   what that doesnt"): booked the moment the deposit is in (taken when it is sent, or paid by the Square link), the same job a signature
   would have booked; the lead gets 'confirmed' in place of 'signed' and is Won. Returns the job id, or null when nothing was booked. */
function a365BookNoSign(string $lid, string $by): ?string {
    $lk = @fopen(DATA_DIR . '/jobs.log.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX)) return null;
    $l = leadsAll()[$lid] ?? null;
    if (!$l || empty($l['sign']['nosign']) || !empty($l['confirmed']) || !empty($l['signed'])) { flock($lk, LOCK_UN); return null; }
    $Q = $l['quote']; $S2 = $l['sign']; $o = $Q['offer'] ?? null; $jid = null; $had = false;
    $dep = (int) $S2['deposit']; $howP = $S2['how'] === 'link' ? 'square' : (string) $S2['how'];
    $pay = $dep <= 0 ? ['s' => 'unpaid'] : ($dep >= (int) $Q['price'] ? ['s' => 'paid', 'how' => $howP] : ['s' => 'deposit', 'amt' => $dep, 'how' => $howP]);
    $today0 = (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d');
    $ex = jobForLead($lid);
    if ($ex && !$ex['done']) {
        $jid = $ex['id']; $had = true; $o = ['crew' => $ex['crew'], 'date' => $ex['date'], 'slot' => $ex['slot']];
        appendLine(DATA_DIR . '/jobs.log', ['id' => $jid, 'pay' => $pay, 'by' => $by, 'at' => time()]);
    } elseif ($o && slotFree((string) $o['crew'], (string) $o['date'], (string) $o['slot'], $lid) === null && (string) $o['date'] >= $today0) {
        $h = $l['house'] ?? null; $addr = $h ? streetCaseServer((string) $h['address']) . ', ' . streetCaseServer(houseTown($h)) : (string) ($l['town'] ?? '');
        $nj = 'j' . bin2hex(random_bytes(6));
        if (appendLine(DATA_DIR . '/jobs.log', ['id' => $nj, 'lead' => $lid, 'title' => trim((string) ($l['name'] ?? '')) ?: 'Customer', 'crew' => (string) $o['crew'], 'date' => (string) $o['date'], 'slot' => (string) $o['slot'],
            'price' => (int) $Q['price'], 'pkg' => (string) $Q['pkg'], 'scope' => 'all', 'seedLb' => $Q['seedLb'] ?? null, 'fertLb' => $Q['fertLb'] ?? null,
            'pay' => $pay, 'card' => false, 'note' => trim('Booked without a signature. ' . (string) ($S2['note'] ?? '') . ' ' . a365ExtrasNote($Q)), 'addr' => $addr ?: 'Ask the office', 'by' => $by, 'at' => time()])) $jid = $nj;
    }
    /* the agreement as it stood when they booked, kept like a signed form's (2026-10-18, Fable review): the page served it live, so a later
       price change showed on the "keep this for your records" page */
    $A0 = a365Agreement($l);
    appendLine(leadsDir() . '/leadst.log', ['id' => $lid, 'confirmed' => ['at' => time(), 'job' => $jid, 'facts' => $A0['facts'], 'terms' => $A0['terms'], 'hash' => $A0['hash'], 'version' => A365_SIGN_VERSION], 'status' => 'won',
        'note' => 'Booked with no signature needed' . ($had ? '; the job was already on the board, deposit added.' : ($jid ? '; job booked.' : '; the day was taken: set a new one on the Jobs board.')), 'by' => $by, 'at' => time()]);
    flock($lk, LOCK_UN);
    $who = trim((string) ($l['name'] ?? '')) ?: 'A customer';
    if ($jid && !$had && $o) { $sl = jobSlot((string) $o['slot']); pushName((string) $o['crew'], 'Job booked: ' . deskWhen((string) $o['date'], '') . ($sl ? ', ' . $sl[1] : ''), $who . ' · $' . $Q['price'], './?job=' . $jid, 'job-' . $jid); }
    a365Alert($jid ? 'Booked (no signature)' : 'Booked (no signature): set a new day', $who . ' · $' . $Q['price'] . ($jid && $o ? ' · ' . deskWhen((string) $o['date'], '') : ''), true);
    return $jid;
}
if ($action === 'signsend') {
    if (!feature('walkdesk') || (!desk() && $role !== 'quote')) fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $id = (string) ($body['id'] ?? ''); $all = leadsAll();
    if (!leadOk($id) || !isset($all[$id])) fail('No such lead.', 404);
    $L = $all[$id];
    if (!empty($L['signed'])) fail('They already signed. Change the job on the Jobs board instead.', 409);   /* Fable review 2026-10-14 */
    /* the deposit is already in (2026-10-18, Fable review): Change or send again used to mint a new Square order, so a customer who had paid
       was asked to pay again and the app said "not paid yet". A paid Square order (or a booking confirmed without a signature) is kept, with
       its amount and method; a deposit taken by hand cannot be turned into a pay link. The price and the day can still change. */
    $S0 = is_array($L['sign'] ?? null) ? $L['sign'] : null;
    $linkPaid = $S0 && ($S0['how'] ?? '') === 'link' && a365DepositPaid($L, false);
    $depIn = $S0 && (!empty($L['confirmed']) || $linkPaid);
    $byLink = $depIn ? ($S0['how'] ?? '') === 'link' : ($body['how'] ?? '') === 'link';   /* SX-58: the customer pays the deposit on the form, by Square link */
    if ($S0 && !$depIn && ($S0['how'] ?? '') !== 'link' && $byLink) fail('The $' . (int) $S0['deposit'] . ' deposit was already taken (' . ucfirst((string) $S0['how']) . '). Keep that; a Square link would ask them to pay it again.');
    if ($byLink && !$depIn && !squareFor()) fail('Square is not connected yet.');
    if (empty($body['taken']) && !$byLink && !$depIn) fail('The form goes out only after they said yes and you took the deposit.');
    $price = (int) ($body['price'] ?? 0); if ($price < 1 || $price > 100000) fail('Give the price you quoted.');
    $pkg = (string) ($body['pkg'] ?? 'full'); if (!in_array($pkg, ['full', 'aerate'], true)) fail('Pick what is included.');
    $how = $depIn ? (string) $S0['how'] : (string) ($body['how'] ?? ''); if (!in_array($how, ['link', 'square', 'card', 'cash', 'zelle', 'venmo', 'check', 'other'], true)) fail('Say how they paid the deposit.');
    $dep = (int) ceil($price / 2);   /* half the price (Matthew 2026-10-14) */
    if ($depIn) { $dep = (int) $S0['deposit']; if ($dep > $price) fail('The $' . $dep . ' deposit is already ' . ($linkPaid ? 'paid' : 'in') . '; the price cannot be less than that.'); }
    elseif (isset($body['deposit']) && $body['deposit'] !== '' && $body['deposit'] !== null) {   /* Jen can change it (Matthew 2026-10-15) */
        if (!is_numeric($body['deposit']) || (int) $body['deposit'] < 0 || (int) $body['deposit'] > $price) fail('The deposit has to be between $0 and the price.');
        $dep = (int) $body['deposit'];
    }
    $crew = (string) ($body['crew'] ?? ''); $date = (string) ($body['date'] ?? ''); $slot = (string) ($body['slot'] ?? '');
    if (!in_array($crew, jobCrewList(), true)) fail('Pick who does the job.');
    if (!dateOk($date) || $date < (new DateTime('today', new DateTimeZone(appTz())))->format('Y-m-d')) fail('Pick today or a later day.');
    if (in_array((int) (new DateTime($date . ' 12:00', new DateTimeZone(appTz())))->format('w'), jobClosed(), true)) fail('That is a closed day (Sunday).');
    if (!jobSlot($slot)) fail('Pick an arrival time.');
    /* booked without a signature already (2026-10-18): the job stays where it is; a new day is set on the Jobs board, as for a signed form */
    $exJob = !empty($L['confirmed']) ? jobForLead($id) : null;
    if ($exJob && !$exJob['done'] && ($exJob['crew'] !== $crew || $exJob['date'] !== $date || $exJob['slot'] !== $slot)) fail('They are booked already. Change the day on the Jobs board instead.', 409);
    if ($why = slotFree($crew, $date, $slot, $id, $exJob ? (string) $exJob['id'] : '')) fail($why, 409);
    $q0 = is_array($L['quote'] ?? null) ? $L['quote'] : [];
    $num = fn($k, $max) => isset($body[$k]) && is_numeric($body[$k]) && (float) $body[$k] >= 0 && (float) $body[$k] <= $max ? round((float) $body[$k], 1) : ($q0[$k] ?? null);
    $q = ['price' => $price, 'pkg' => $pkg, 'sq' => (int) ($body['sq'] ?? ($q0['sq'] ?? 0)), 'seedLb' => $num('seedLb', 5000), 'fertLb' => $num('fertLb', 5000), 'note' => '', 'sent' => true,
          'offer' => ['crew' => $crew, 'date' => $date, 'slot' => $slot, 'at' => time()]];
    $ex = array_key_exists('extras', $body) ? a365Extras($body['extras']) : ($q0['extras'] ?? []); if ($ex) $q['extras'] = $ex;   /* extra work: on the form's Service line (2026-10-21) */
    $sign = ['key' => bin2hex(random_bytes(6)), 'deposit' => $dep, 'how' => $how, 'note' => $clean($body['note'] ?? '', 300)];
    $nosign = !empty($body['nosign']); if ($nosign) $sign['nosign'] = true;   /* no signature needed (2026-10-17) */
    if ($byLink && $depIn && is_array($S0['pay'] ?? null)) $sign['pay'] = $S0['pay'];   /* the paid order stays, so sqpaid still matches it (2026-10-18) */
    elseif ($byLink) {
        if ($dep < 1) fail('A Square link needs a deposit of at least $1.');
        $pl = squareLink('Deposit: ' . (string) (company()['a365']['name'] ?? 'Aeration'), $dep * 100, a365SignLink($id, $sign['key']), (string) ($L['email'] ?? ''));
        if (!empty($pl['err'])) fail($pl['err'], 502);
        $sign['pay'] = $pl;
    }
    $row = ['id' => $id, 'quote' => $q, 'sign' => $sign, 'status' => 'quoted',
            'note' => mb_substr('Quoted $' . $price . ' by phone; deposit $' . $dep . ($byLink ? ($depIn ? ' already paid by Square link' : ' to pay by Square link on the form') : ($depIn ? ' already in (' : ' taken (') . ucfirst($how) . ')') . '. Form sent; ' . deskWhen($date, '') . ', ' . jobSlot($slot)[1] . ' held with ' . $crew . '.', 0, 500), 'by' => $me, 'at' => time()];
    if ($nosign) $row['note'] = str_replace('Form sent;', 'Form sent (no signature needed);', $row['note']);
    if (!appendLine(leadsDir() . '/leadst.log', $row)) fail('Could not save that. Try again.', 500);
    if (!empty($L['confirmed'])) { $A2 = a365Agreement(leadsAll()[$id]); appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'confirmed' => ['facts' => $A2['facts'], 'terms' => $A2['terms'], 'hash' => $A2['hash'], 'version' => A365_SIGN_VERSION] + $L['confirmed'], 'by' => $me, 'at' => time()]); }   /* sent again on purpose: the kept copy follows the new form (2026-10-18) */
    $bookedJob = $nosign && (!$byLink || $depIn) ? a365BookNoSign($id, $me) : null;   /* the deposit is in already: booked now */
    out(['ok' => true, 'link' => a365SignLink($id, $sign['key']), 'deposit' => $dep, 'balance' => $price - $dep, 'byLink' => $byLink && !$depIn, 'paid' => $depIn, 'nosign' => $nosign, 'booked' => (bool) $bookedJob]);
}
/** may this person make pay links? With SANDBOX keys only an admin (testing): a test link sent to a real customer takes no money */
function squareFor(): bool { global $role; $c = squareCfg(); return (bool) $c && ($c['env'] === 'production' || $role === 'admin'); }
/* is Square on, and has a lead's deposit or a job's balance been paid? (the office's Check button) */
if ($action === 'squarestate') {   /* anyone signed in: the crew's job card offers the balance link */
    if (!feature('walkdesk')) fail('Not here.', 404);
    $c = squareCfg(); out(['ok' => true, 'on' => squareFor(), 'env' => $c ? $c['env'] : null]);
}
if ($action === 'squarecheck') {
    if (!feature('walkdesk') || !$isPost) fail('Not allowed.', 403);
    if (!squareCfg()) fail('Square is not connected yet.');
    $lid = (string) ($body['lead'] ?? ''); $jid = (string) ($body['job'] ?? '');
    if ($lid !== '') {
        if (!desk() && $role !== 'quote') fail('Not allowed.', 403);
        $l = leadsAll()[$lid] ?? null; if (!$l || ($l['sign']['how'] ?? '') !== 'link') fail('No Square link on this lead.', 404);
        out(['ok' => true, 'paid' => a365DepositPaid($l)]);
    }
    $all = jobsAll(); $j = $all[$jid] ?? null;
    if (!$j || $j['off'] || empty($j['sqlink']['order'])) fail('No Square link on this job.', 404);
    if (!jobOpen($j)) fail('Not allowed.', 403);
    if (($j['pay']['s'] ?? '') === 'paid') out(['ok' => true, 'paid' => true]);
    [$paid, $pid] = squareOrderPaid((string) $j['sqlink']['order']);
    if ($paid) { appendLine(DATA_DIR . '/jobs.log', ['id' => $jid, 'pay' => ['s' => 'paid', 'how' => 'square'], 'sqpaid' => ['order' => (string) $j['sqlink']['order'], 'payment' => $pid, 'at' => time()], 'by' => 'Square', 'at' => time()]); jobAftercare($jid, 'paid'); }
    out(['ok' => true, 'paid' => $paid]);
}
/* charge what is left on a job to the card they saved with the deposit (2026-10-15): the office, or the crew on the job. One at a time
   (the jobs lock is held through Square's answer); a retry after no answer reuses the same key, so Square never charges twice. */
if ($action === 'jobcharge') {
    if (!feature('walkdesk') || !$isPost) fail('Not allowed.', 403);
    if (!canTakePay()) fail('Taking payments is switched on per person by an admin, in Accounts.', 403);
    if (!squareFor()) fail('Square is not connected yet.');
    $jid = (string) ($body['id'] ?? '');
    $lk = @fopen(DATA_DIR . '/jobs.log.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX)) fail('Could not do that. Try again.', 500);
    $j = jobsAll()[$jid] ?? null;
    if (!$j || $j['off']) fail('No such job.', 404);
    if (!jobOpen($j)) fail('Not allowed.', 403);
    if (($j['pay']['s'] ?? '') === 'paid') fail('This job is already paid.');
    $l = leadsAll()[$j['lead']] ?? null; $cc = $l['sqcard'] ?? null;
    if (!$l || empty($cc['id']) || empty($l['sqcust'])) fail('No card is saved for this customer.');
    $left = (int) $j['price'] - (($j['pay']['s'] ?? '') === 'deposit' ? (int) ($j['pay']['amt'] ?? 0) : 0);
    if ($left < 1) fail('Nothing is left to pay.');
    if ((int) ($body['amount'] ?? 0) !== $left) fail('The balance is now $' . $left . '. Open the job again.');
    if (!empty($j['sqlink']['order'])) {   /* 2026-10-19: a pay link sent earlier may already be paid; ask Square before charging the card */
        [$lp, $lpid] = squareOrderPaid((string) $j['sqlink']['order']);
        if ($lp) {
            appendLine(DATA_DIR . '/jobs.log', ['id' => $jid, 'pay' => ['s' => 'paid', 'how' => 'square'], 'sqpaid' => ['order' => (string) $j['sqlink']['order'], 'payment' => $lpid, 'at' => time()], 'by' => 'Square', 'at' => time()]);
            flock($lk, LOCK_UN); jobAftercare($jid, 'paid');
            fail('They already paid the balance on the pay link, so nothing was charged. The job now shows paid.', 409);
        }
    }
    if ($f = squareBalancePaid($j, $l)) {   /* already paid straight in Square (2026-10-19, Kirk) */
        flock($lk, LOCK_UN); jobSquareFound($jid, $f, 'before a card charge');
        fail('They already paid $' . $f['amt'] . ' in Square' . ($f['last4'] !== '' ? ' on the card ending ' . $f['last4'] : '') . ', so nothing was charged. The job now shows paid.', 409);
    }
    $tries = (int) ($j['chgfail']['n'] ?? 0);
    $r = squareApi('POST', '/v2/payments', ['idempotency_key' => 'chg-' . substr(sha1($jid . '|' . $left . '|' . $tries), 0, 32), 'source_id' => (string) $cc['id'], 'customer_id' => (string) $l['sqcust'],
        'amount_money' => ['amount' => $left * 100, 'currency' => 'USD'], 'location_id' => (string) squareCfg()['location'], 'autocomplete' => true, 'reference_id' => $jid,
        'note' => mb_substr('Balance: ' . trim((string) ($l['name'] ?? '')) . ', ' . (string) $j['date'], 0, 500)]);
    $p = $r['payment'] ?? null; $who = trim((string) ($l['name'] ?? ''));
    if (!$p || ($p['status'] ?? '') !== 'COMPLETED') {
        $why = (string) ($r['errors'][0]['detail'] ?? ($p ? 'Square says ' . strtolower((string) $p['status']) : 'No answer from Square'));
        if ($p || !empty($r['errors'])) appendLine(DATA_DIR . '/jobs.log', ['id' => $jid, 'chgfail' => ['n' => $tries + 1, 'why' => mb_substr($why, 0, 160), 'at' => time(), 'by' => $me], 'by' => $me, 'at' => time()]);   /* a real no: the next try is a new charge */
        flock($lk, LOCK_UN); fail('The card was not charged: ' . $why . '. Take the balance another way, or try again.', 402);
    }
    appendLine(DATA_DIR . '/jobs.log', ['id' => $jid, 'pay' => ['s' => 'paid', 'how' => 'square'], 'sqcharge' => ['payment' => (string) $p['id'], 'amt' => $left, 'last4' => (string) ($cc['last4'] ?? ''), 'brand' => (string) ($cc['brand'] ?? ''), 'at' => time(), 'by' => $me], 'by' => $me, 'at' => time()]);
    flock($lk, LOCK_UN);
    a365Alert('Balance charged', $who . ' · $' . $left . ' · ' . ($cc['brand'] ?? 'card') . ' ending ' . ($cc['last4'] ?? ''));
    $af = jobAftercare($jid, 'charged');   /* settled: the aftercare email, if the job is done (2026-10-19) */
    out(['ok' => true, 'amt' => $left, 'last4' => (string) ($cc['last4'] ?? ''), 'brand' => (string) ($cc['brand'] ?? ''), 'aftercare' => $af['stage']]);
}
/* a pay link for what is left on a job (the office, or the crew on the day) */
if ($action === 'jobpaylink') {
    if (!feature('walkdesk') || !$isPost) fail('Not allowed.', 403);
    if (!canTakePay()) fail('Taking payments is switched on per person by an admin, in Accounts.', 403);
    if (!squareFor()) fail('Square is not connected yet.');
    $jid = (string) ($body['id'] ?? ''); $all = jobsAll(); $j = $all[$jid] ?? null;
    if (!$j || $j['off']) fail('No such job.', 404);
    if (!jobOpen($j)) fail('Not allowed.', 403);
    if (($j['pay']['s'] ?? '') === 'paid') fail('This job is already paid.');
    $left = (int) $j['price'] - (in_array($j['pay']['s'] ?? '', ['deposit'], true) ? (int) ($j['pay']['amt'] ?? 0) : 0);
    if (isset($body['amount']) && is_numeric($body['amount'])) { $a = (int) $body['amount']; if ($a < 1 || $a > (int) $j['price']) fail('Pick an amount between $1 and the price.'); $left = $a; }
    if ($left < 1) fail('Nothing is left to pay.');
    if (!empty($j['sqlink']['url']) && (int) ($j['sqlink']['amt'] ?? 0) === $left) out(['ok' => true, 'url' => (string) $j['sqlink']['url'], 'amt' => $left, 'again' => true]);
    $l = leadsAll()[$j['lead']] ?? [];
    $pl = squareLink('Balance: ' . (string) (company()['a365']['name'] ?? 'Aeration'), $left * 100, '', (string) ($l['email'] ?? ''));
    if (!empty($pl['err'])) fail($pl['err'], 502);
    if (!appendLine(DATA_DIR . '/jobs.log', ['id' => $jid, 'sqlink' => $pl, 'by' => $me, 'at' => time()])) fail('Could not save that. Try again.', 500);
    $af = jobAftercare($jid, 'link');   /* the aftercare email carries the link, if the job is done (2026-10-19) */
    out(['ok' => true, 'url' => $pl['url'], 'amt' => $left, 'aftercare' => $af['stage']]);
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

/* a view-only form for one customer (2026-10-16, Matthew, Jeremy Kaplan: he pays Brandon in person, so his link shows the agreement
   as written, with no deposit, payment or signing). The admin writes the facts and terms; the price on the quote can be changed with
   it. clear: back to the normal form. */
if ($action === 'a365signview') {
    if ($role !== 'admin' || !$isPost || !feature('walkdesk')) fail('Not allowed.', 403);
    $id = (string) ($body['id'] ?? ''); $l = leadsAll()[$id] ?? null;
    if (!$l || empty($l['sign'])) fail('That lead has no form.', 404);
    if (!empty($l['signed'])) fail('This form is already signed.');
    if (!empty($body['clear'])) { appendLine(leadsDir() . '/leadst.log', ['id' => $id, 'signview' => null, 'note' => 'Form back to the normal one (sign and pay).', 'by' => $me, 'at' => time()]); out(['ok' => true]); }
    $facts = []; foreach ((array) ($body['facts'] ?? []) as $f) { if (!is_array($f) || count($f) !== 2) fail('Each line needs a label and a value.'); $a = a365Clean($f[0], 60); $b = a365Clean($f[1], 200); if ($a === '' || $b === '') fail('Each line needs a label and a value.'); $facts[] = [$a, $b]; }
    $terms = []; foreach ((array) ($body['terms'] ?? []) as $t) { $t = a365Clean($t, 400); if ($t !== '') $terms[] = $t; }
    if (count($facts) < 2 || count($facts) > 14 || count($terms) > 20) fail('Give 2 to 14 lines and up to 20 terms.');
    $row = ['id' => $id, 'signview' => ['facts' => $facts, 'terms' => $terms, 'at' => time(), 'by' => $me], 'note' => 'Form switched to view only (no deposit, payment or signing).', 'by' => $me, 'at' => time()];
    if (isset($body['price'])) { $p = (int) $body['price']; if ($p < 1 || $p > 100000) fail('The price should be a number of dollars.'); $row['quote'] = ['price' => $p] + (array) ($l['quote'] ?? []); $row['quote']['price'] = $p; $row['note'] .= ' Price $' . (int) ($l['quote']['price'] ?? 0) . ' changed to $' . $p . '.'; }
    if (!appendLine(leadsDir() . '/leadst.log', $row)) fail('Could not save that. Try again.', 500);
    out(['ok' => true]);
}
/* ---- payments, for the books (2026-10-16, Matthew: "I am just mainly thinking about taxes, and having documentation we can print out
   that can be used to do the taxes with") ----
   Every payment received, rebuilt from the job log: each change of a job's payment status is a payment (or a correction) dated when it
   was entered. Square references come from the job (balance charged to the saved card, a pay link paid) and from the lead (the deposit
   paid by link, dated when Square took it). A Square deposit on a lead with no job yet is listed on its own. A job cancelled after a
   deposit keeps the deposit (it is non-refundable) and says so. Square's fees are not taken off: Square's own reports list them. */
const PAY_HOW = ['square' => 'Square', 'card' => 'Card', 'cash' => 'Cash', 'zelle' => 'Zelle', 'venmo' => 'Venmo', 'check' => 'Check', 'other' => 'Other'];
function paymentsAll(): array {
    $leads = leadsAll(); $tz = new DateTimeZone(appTz()); $st = []; $used = []; $out = [];
    foreach (readLines(DATA_DIR . '/jobs.log') as $r) {
        $id = (string) $r['id'];
        if (!isset($st[$id])) { if (empty($r['crew']) || empty($r['date'])) continue; $st[$id] = ['lead' => (string) ($r['lead'] ?? ''), 'title' => (string) ($r['title'] ?? ''), 'date' => '', 'price' => 0, 'addr' => '', 'pay' => ['s' => 'unpaid'], 'got' => 0, 'off' => false, 'evs' => []]; }
        $j = &$st[$id];
        foreach (['date', 'addr'] as $k) if (isset($r[$k])) $j[$k] = (string) $r[$k];
        if (array_key_exists('price', $r)) $j['price'] = (int) $r['price'];
        if (!empty($r['del'])) $j['off'] = true;
        if (is_array($r['pay'] ?? null) || array_key_exists('price', $r)) {
            if (is_array($r['pay'] ?? null)) $j['pay'] = $r['pay'];
            $p = $j['pay']; $ps = (string) ($p['s'] ?? 'unpaid');
            $now = $ps === 'paid' ? $j['price'] : ($ps === 'deposit' ? (int) ($p['amt'] ?? 0) : ($ps === 'plan' ? $j['got'] : 0));
            $d = $now - $j['got'];
            if ($d !== 0) {
                $ref = (string) ($r['sqcharge']['payment'] ?? ($r['sqpaid']['payment'] ?? ''));
                $at = (int) ($r['sqcharge']['at'] ?? ($r['sqpaid']['at'] ?? ($r['payat'] ?? ($r['at'] ?? 0))));
                $kind = $d < 0 ? 'Correction' : ($ps === 'deposit' ? 'Deposit' : ($j['got'] > 0 ? 'Balance' : 'Paid in full'));
                $how = $d < 0 ? (string) ($j['lastHow'] ?? '') : (string) ($p['how'] ?? '');   /* a correction undoes the method it reverses */
                if ($d > 0) $j['lastHow'] = $how;
                $j['evs'][] = ['at' => $at, 'amt' => $d, 'how' => $how, 'kind' => $kind, 'ref' => $ref];
                $j['got'] = $now;
            }
        }
        unset($j);
    }
    $row = function (int $at, int $amt, string $how, string $kind, string $ref, string $name, string $addr, string $jid, string $jdate, bool $off, string $lead) use ($tz): array {
        $dt = (new DateTime('@' . max(0, $at)))->setTimezone($tz);
        return ['date' => $dt->format('Y-m-d'), 'at' => $at, 'customer' => $name, 'addr' => $addr, 'kind' => $kind, 'how' => $how, 'howL' => PAY_HOW[$how] ?? ($how !== '' ? ucfirst($how) : 'Not recorded'),
                'amt' => $amt, 'ref' => $ref, 'job' => $jid, 'jobDate' => $jdate, 'cancelled' => $off, 'lead' => $lead];
    };
    foreach ($st as $jid => $j) {
        $l = $j['lead'] !== '' ? ($leads[$j['lead']] ?? null) : null;
        $name = trim((string) ($l['name'] ?? '')) ?: ($j['title'] ?: 'Customer');
        foreach ($j['evs'] as $e) {
            /* the Square link payment behind it, so it is counted once: a deposit, or paid in full for the same amount (2026-10-16: Eric paid the whole $200 by the link) */
            if (($e['kind'] === 'Deposit' || ($e['kind'] === 'Paid in full' && (int) ($l['sqpaid']['amt'] ?? 0) === (int) $e['amt'])) && $e['how'] === 'square' && $e['ref'] === '' && $l && !empty($l['sqpaid']['payment']) && empty($used[$l['sqpaid']['payment']])) {
                $e['ref'] = (string) $l['sqpaid']['payment']; $e['at'] = (int) ($l['sqpaid']['at'] ?? $e['at']);
            }
            if ($e['ref'] !== '') $used[$e['ref']] = true;
            $out[] = $row($e['at'], $e['amt'], $e['how'], $e['kind'], $e['ref'], $name, $j['addr'], (string) $jid, $j['date'], $j['off'], $j['lead']);
        }
    }
    $jobLead = []; foreach ($st as $j) if (empty($j['off']) && $j['lead'] !== '') $jobLead[$j['lead']] = true;
    foreach ($leads as $l) {   /* money taken on "They said yes" with no day booked yet (2026-10-18, Fable review), until a job carries it */
        $w = $l['wpay'] ?? null; if (!is_array($w) || isset($jobLead[(string) $l['id']]) || (int) ($w['amt'] ?? 0) < 1) continue;
        $h = $l['house'] ?? null; $addr = $h ? streetCaseServer((string) $h['address']) . ', ' . streetCaseServer(houseTown($h)) : (string) ($l['town'] ?? '');
        $out[] = $row((int) ($w['at'] ?? 0), (int) $w['amt'], (string) ($w['how'] ?? ''), (($w['s'] ?? '') === 'paid' ? 'Paid in full' : 'Deposit') . ' (no job booked)', '', trim((string) ($l['name'] ?? '')) ?: 'Customer', $addr, '', '', false, (string) $l['id']);
    }
    foreach ($leads as $l) {   /* a deposit paid by link where no job was booked yet */
        $pid = (string) ($l['sqpaid']['payment'] ?? '');
        if ($pid === '' || !empty($used[$pid])) continue;
        $h = $l['house'] ?? null; $addr = $h ? streetCaseServer((string) $h['address']) . ', ' . streetCaseServer(houseTown($h)) : (string) ($l['town'] ?? '');
        $out[] = $row((int) ($l['sqpaid']['at'] ?? 0), (int) ($l['sqpaid']['amt'] ?? 0), 'square', 'Deposit (no job booked)', $pid, trim((string) ($l['name'] ?? '')) ?: 'Customer', $addr, '', '', false, (string) $l['id']);
    }
    usort($out, fn($a, $b) => $a['at'] <=> $b['at']);
    return $out;
}
if ($action === 'payments' || $action === 'paymentsexport') {
    if ($role !== 'admin') fail('Not allowed.', 403);   /* money records: the admin's */
    $y = (new DateTime('today', new DateTimeZone(appTz())))->format('Y');
    $from = (string) ($_GET['from'] ?? ''); $to = (string) ($_GET['to'] ?? '');
    if (!dateOk($from)) $from = $y . '-01-01';
    if (!dateOk($to)) $to = $y . '-12-31';
    if ($to < $from) [$from, $to] = [$to, $from];
    $rows = array_values(array_filter(paymentsAll(), fn($p) => $p['date'] >= $from && $p['date'] <= $to));
    if ($action === 'paymentsexport') {
        exportLog(['what' => 'payments', 'from' => $from, 'to' => $to]);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="payments-' . $from . '-to-' . $to . '.csv"');
        $fh = fopen('php://output', 'w');
        fputcsv($fh, ['Date', 'Customer', 'Address', 'For', 'Method', 'Amount', 'Square payment ID', 'Job date', 'Job cancelled'], ',', '"', '');
        foreach ($rows as $p) fputcsv($fh, array_map('csvSafe', [$p['date'], $p['customer'], $p['addr'], $p['kind'], $p['howL'], number_format($p['amt'], 2, '.', ''), $p['ref'], $p['jobDate'], $p['cancelled'] ? 'yes' : '']), ',', '"', '');
        fputcsv($fh, ['', '', '', '', 'Total', number_format(array_sum(array_column($rows, 'amt')), 2, '.', ''), '', '', ''], ',', '"', '');
        fclose($fh); exit;
    }
    $byHow = []; $byMonth = [];
    foreach ($rows as $p) { $byHow[$p['howL']] = ($byHow[$p['howL']] ?? 0) + $p['amt']; $m = substr($p['date'], 0, 7); $byMonth[$m] = ($byMonth[$m] ?? 0) + $p['amt']; }
    arsort($byHow); ksort($byMonth);
    out(['ok' => true, 'from' => $from, 'to' => $to, 'rows' => $rows, 'total' => array_sum(array_column($rows, 'amt')), 'count' => count($rows), 'byHow' => $byHow, 'byMonth' => $byMonth,
         'company' => (string) (company()['name'] ?? ''), 'made' => (new DateTime('now', new DateTimeZone(appTz())))->format('Y-m-d H:i'), 'sqcheck' => squareCheckShown()]);
}
/* ---- the nightly Square check (2026-10-16, Matthew: "run scans from square to see who's paid ... just in case it's not updating
 * properly"; "build the nightly square check") ----
 * Every Square payment of the last 45 days at every location (pay links, the Square app, invoices) against the app's own payment
 * records. Each payment is matched to a lead by its order or payment id, else Square's customer email or phone, else the full name;
 * then per person what Square kept (refunds taken off) is set against what the app records as paid by Square or card. Anything that
 * does not agree goes in square-check.json for the top of the Payments page, and a new one pushes to the super admin. Run once a
 * night (sixfold-tools/square-check.php, started by the Facebook job's 5-minute cron, after 2 am) or now from the Payments page.
 * Leave it keeps an item quiet (square-check-ok.json). Read only towards Square. */
function squareCheckFile(): string { return DATA_DIR . '/square-check.json'; }
function squareCheckOk(): array { $j = json_decode((string) @file_get_contents(DATA_DIR . '/square-check-ok.json'), true); return is_array($j['keys'] ?? null) ? $j['keys'] : []; }
function squareCheckShown(): ?array {
    $j = json_decode((string) @file_get_contents(squareCheckFile()), true); if (!is_array($j)) return null;
    $ok = array_flip(squareCheckOk());
    return ['at' => (int) ($j['at'] ?? 0), 'items' => array_values(array_filter((array) ($j['items'] ?? []), fn($i) => !isset($ok[$i['key'] ?? '']))), 'payments' => (int) ($j['payments'] ?? 0), 'quiet' => count(array_filter((array) ($j['items'] ?? []), fn($i) => isset($ok[$i['key'] ?? ''])))];
}
function squareNightly(): array {
    if (!squareCfg()) return ['ok' => false, 'error' => 'Square is not connected.'];
    $since = gmdate('Y-m-d\TH:i:s\Z', max(time() - 45 * 86400, strtotime('2026-10-01T06:00:00Z')));
    $locs = squareApi('GET', '/v2/locations'); if (($locs['_status'] ?? 0) !== 200) return ['ok' => false, 'error' => 'Square did not answer.'];
    $locName = []; $pays = [];
    foreach ((array) ($locs['locations'] ?? []) as $L) {
        $locName[(string) $L['id']] = (string) ($L['name'] ?? ''); $cur = '';
        for ($i = 0; $i < 20; $i++) {
            $r = squareApi('GET', '/v2/payments?' . http_build_query(array_filter(['begin_time' => $since, 'location_id' => (string) $L['id'], 'limit' => 100, 'cursor' => $cur], fn($v) => $v !== '')));
            if (($r['_status'] ?? 0) !== 200) return ['ok' => false, 'error' => 'Square did not send the payments.'];
            foreach ((array) ($r['payments'] ?? []) as $p) $pays[] = $p;
            $cur = (string) ($r['cursor'] ?? ''); if ($cur === '') break;
        }
    }
    $cust = [];
    foreach (array_unique(array_filter(array_map(fn($p) => (string) ($p['customer_id'] ?? ''), $pays))) as $cid) {
        $cu = squareApi('GET', '/v2/customers/' . rawurlencode($cid))['customer'] ?? [];
        $cust[$cid] = ['name' => trim(($cu['given_name'] ?? '') . ' ' . ($cu['family_name'] ?? '')), 'email' => strtolower(trim((string) ($cu['email_address'] ?? ''))), 'phone' => substr((string) preg_replace('/\D/', '', (string) ($cu['phone_number'] ?? '')), -10)];
    }
    $leads = leadsAll(); $rows = paymentsAll(); $d10 = fn($p) => substr((string) preg_replace('/\D/', '', (string) $p), -10);
    $byOrder = []; $byPay = []; $byEmail = []; $byPhone = []; $byName = [];
    foreach ($leads as $l) {
        foreach ([$l['sign']['pay']['order'] ?? '', $l['sqpaid']['order'] ?? '', $l['sqafter']['order'] ?? ''] as $o) if ((string) $o !== '') $byOrder[(string) $o] = $l['id'];
        if (!empty($l['sqpaid']['payment'])) $byPay[(string) $l['sqpaid']['payment']] = $l['id'];
        $e = strtolower(trim((string) ($l['email'] ?? ''))); if ($e !== '') $byEmail[$e] = $byEmail[$e] ?? $l['id'];
        $p = $d10($l['phone'] ?? ''); if (strlen($p) === 10) $byPhone[$p] = $byPhone[$p] ?? $l['id'];
        $n = cuName((string) ($l['name'] ?? '')); if (substr_count($n, ' ') >= 1) $byName[$n] = $byName[$n] ?? $l['id'];
    }
    foreach (jobsAll() as $j) foreach (['sqcharge', 'sqpaid'] as $k) if (is_array($j[$k] ?? null)) { if (!empty($j[$k]['order'])) $byOrder[(string) $j[$k]['order']] = (string) $j['lead']; if (!empty($j[$k]['payment'])) $byPay[(string) $j[$k]['payment']] = (string) $j['lead']; }
    foreach ($rows as $rw) if ($rw['ref'] !== '' && $rw['lead'] !== '') $byPay[$rw['ref']] = $rw['lead'];
    $tz = new DateTimeZone(appTz()); $day = fn($ts) => (new DateTime('@' . $ts))->setTimezone($tz)->format('D j M');
    $items = []; $sq = []; $n = 0;
    foreach ($pays as $p) {
        if (($p['status'] ?? '') !== 'COMPLETED') continue; $n++;
        $amt = ((int) ($p['amount_money']['amount'] ?? 0)) / 100; $back = ((int) ($p['refunded_money']['amount'] ?? 0)) / 100;
        $cu = $cust[(string) ($p['customer_id'] ?? '')] ?? ['name' => '', 'email' => '', 'phone' => ''];
        $em = $cu['email'] !== '' ? $cu['email'] : strtolower(trim((string) ($p['buyer_email_address'] ?? '')));
        $lid = $byOrder[(string) ($p['order_id'] ?? '')] ?? ($byPay[(string) $p['id']] ?? '');
        if ($lid === '' && $em !== '' && isset($byEmail[$em])) $lid = $byEmail[$em];
        if ($lid === '' && strlen($cu['phone']) === 10 && isset($byPhone[$cu['phone']])) $lid = $byPhone[$cu['phone']];
        if ($lid === '' && ($nm = cuName($cu['name'])) !== '' && isset($byName[$nm])) $lid = $byName[$nm];
        $at = (int) strtotime((string) ($p['created_at'] ?? '')); $card = trim((string) (($p['card_details']['card']['card_brand'] ?? '') . ' ' . ($p['card_details']['card']['last_4'] ?? '')));
        $where = $locName[(string) ($p['location_id'] ?? '')] ?? 'Square';
        if ($lid === '') { $items[] = ['key' => 'p:' . $p['id'], 'kind' => 'unmatched', 'text' => 'Square took $' . number_format($amt - $back, 2) . ' on ' . $day($at) . ' from ' . ($cu['name'] !== '' ? $cu['name'] : ($card !== '' ? 'a card ending ' . substr($card, -4) : 'someone')) . ' (' . $where . '), and nobody in the app matches it.']; continue; }
        $sq[$lid][] = ['amt' => $amt, 'back' => $back, 'at' => $at];
    }
    $app = []; foreach ($rows as $rw) if ($rw['lead'] !== '' && in_array($rw['how'], ['square', 'card'], true) && $rw['at'] >= strtotime($since)) $app[$rw['lead']] = ($app[$rw['lead']] ?? 0) + $rw['amt'];
    foreach (array_unique(array_merge(array_keys($sq), array_keys($app))) as $lid) {
        $kept = array_sum(array_map(fn($x) => $x['amt'] - $x['back'], $sq[$lid] ?? [])); $rec = (float) ($app[$lid] ?? 0);
        if (abs($kept - $rec) < 0.5) continue;
        $who = trim((string) ($leads[$lid]['name'] ?? '')) ?: 'A customer'; $refund = array_sum(array_column($sq[$lid] ?? [], 'back'));
        $items[] = ['key' => 'l:' . $lid . ':' . (int) round($kept * 100) . ':' . (int) round($rec * 100), 'kind' => $kept > $rec ? 'more' : 'less', 'lead' => $lid, 'name' => $who,
                    'text' => $who . ': Square kept $' . number_format($kept, 2) . ($refund > 0 ? ' (after $' . number_format($refund, 2) . ' refunded)' : '') . ', the app records $' . number_format($rec, 2) . ' paid by Square or card.'];
    }
    $old = json_decode((string) @file_get_contents(squareCheckFile()), true); $oldKeys = array_column((array) ($old['items'] ?? []), 'key');
    writeJsonAtomic(squareCheckFile(), ['at' => time(), 'payments' => $n, 'items' => $items]);
    $ok = array_flip(squareCheckOk()); $new = array_values(array_filter($items, fn($i) => !in_array($i['key'], $oldKeys, true) && !isset($ok[$i['key']])));
    if ($new) superAlert(count($new) === 1 ? 'Square check: one to look at' : 'Square check: ' . count($new) . ' to look at', implode(' ', array_map(fn($i) => $i['text'], array_slice($new, 0, 2))));
    return ['ok' => true, 'payments' => $n, 'items' => count($items), 'new' => count($new)];
}
if ($action === 'squarenightly') {   /* sixfold-tools/square-check.php, command line only */
    if (!(PHP_SAPI === 'cli' && defined('SIXFOLD_CLI'))) fail('Not here.', 404);
    @ini_set('memory_limit', '512M'); @set_time_limit(300);
    $sw = squareSweep();   /* balances paid straight in Square (2026-10-19) */
    out(squareNightly() + ['swept' => $sw]);
}
if ($action === 'squaresweep') {   /* sixfold-tools/square-check.php every 15 minutes, command line only (2026-10-19) */
    if (!(PHP_SAPI === 'cli' && defined('SIXFOLD_CLI'))) fail('Not here.', 404);
    @set_time_limit(120);
    out(squareSweep());
}
if ($action === 'squarecheckrun' || $action === 'squareok') {   /* the Payments page: Check now, Leave it */
    if ($role !== 'admin' || !$isPost) fail('Not allowed.', 403);
    if ($action === 'squarecheckrun') { @set_time_limit(110); $r = squareNightly(); if (empty($r['ok'])) fail((string) ($r['error'] ?? 'The check did not run.'), 502); out(['ok' => true, 'sqcheck' => squareCheckShown()]); }
    $k = (string) ($body['key'] ?? ''); if (!preg_match('/^[pl]:[A-Za-z0-9:_-]{1,120}$/D', $k)) fail('Nothing to leave.');
    $keys = squareCheckOk(); if (!in_array($k, $keys, true)) $keys[] = $k;
    writeJsonAtomic(DATA_DIR . '/square-check-ok.json', ['keys' => array_slice($keys, -500), 'by' => $me, 'at' => time()]);
    out(['ok' => true, 'sqcheck' => squareCheckShown()]);
}
if (in_array($action, ['customers', 'customersave', 'customerfrom', 'customerimport', 'visitsave', 'customersexport', 'backup', 'backups', 'backupget', 'custdoc', 'custdocadd', 'custdocdel'], true)) {
    /* the office (Jen, 2026-10-14, Matthew: "in case she needs to call one or edit something she forgot to put in"): the list, editing a
       customer, making one from a lead, adding and editing visits. Removing a visit, imports, the download and backups stay the admin's. */
    $officeCust = $role === 'office' && feature('walkdesk') && in_array($action, ['customers', 'customersave', 'customerfrom', 'visitsave', 'custdoc', 'custdocadd'], true);
    /* the quote account makes a customer from one of her own leads (2026-10-16, won without the form), nothing else here */
    $quoteCust = $role === 'quote' && feature('walkdesk') && $action === 'customerfrom' && qMine(leadsAll()[(string) ($body['lead'] ?? '')] ?? []);
    if ($role !== 'admin' && !$officeCust && !$quoteCust) fail('Not allowed.', 403);
    $tz = new DateTimeZone(appTz());
    $today = (new DateTime('today', $tz))->format('Y-m-d');
    /* the whole list, with each customer's visits and what is due */
    /* documents on a customer (2026-10-15, Matthew: "customers should have their signed service agreement that people can click and it
       can load up"): PDFs kept outside the web folder, shown only to people who may see customers */
    if (in_array($action, ['custdoc', 'custdocadd', 'custdocdel'], true)) {
        $cs = loadCustomers(); $cid = (string) ($_GET['id'] ?? ($body['id'] ?? '')); $c = $cs[$cid] ?? null;
        if (!$c) fail('No such customer.', 404);
        $dd = custDir() . '/docs'; if (!is_dir($dd)) @mkdir($dd, 0700, true);
        $docs = array_values(array_filter((array) ($c['docs'] ?? []), 'is_array'));
        if ($action === 'custdoc') {
            $did = (string) ($_GET['doc'] ?? ''); $d = null; foreach ($docs as $x) if (($x['id'] ?? '') === $did) $d = $x;
            if (!$d || !preg_match('/^d[0-9a-f]{10}$/D', $did)) fail('No such document.', 404);
            $p = $dd . '/' . $cid . '-' . $did . '.pdf'; if (!is_file($p)) fail('That file is missing.', 404);
            header('Content-Type: application/pdf'); header('Content-Disposition: inline; filename="' . preg_replace('/[^A-Za-z0-9 ._-]+/', '', (string) $d['name']) . '"'); header('Cache-Control: private, no-store'); header('X-Content-Type-Options: nosniff');
            header('Content-Length: ' . filesize($p)); readfile($p); exit;
        }
        if (!$isPost) fail('POST required', 405);
        if ($action === 'custdocadd') {
            $name = $clean($body['name'] ?? '', 120); if ($name === '') $name = 'Agreement';
            $bin = base64_decode((string) ($body['data'] ?? ''), true);
            if ($bin === false || strncmp($bin, '%PDF', 4) !== 0) fail('Pick a PDF file.');
            if (strlen($bin) > 15 * 1024 * 1024) fail('That PDF is over 15 MB.');
            if (count($docs) >= 30) fail('This customer has 30 documents already.');
            $did = 'd' . bin2hex(random_bytes(5));
            if (@file_put_contents($dd . '/' . $cid . '-' . $did . '.pdf', $bin, LOCK_EX) === false) fail('Could not save that. Try again.', 500);
            @chmod($dd . '/' . $cid . '-' . $did . '.pdf', 0600);
            $docs[] = ['id' => $did, 'name' => $name, 'size' => strlen($bin), 'at' => time(), 'by' => $me];
        } else {
            if ($role !== 'admin') fail('Not allowed.', 403);
            $did = (string) ($body['doc'] ?? ''); $keep = array_values(array_filter($docs, fn($x) => ($x['id'] ?? '') !== $did));
            if (count($keep) === count($docs)) fail('No such document.', 404);
            @unlink($dd . '/' . $cid . '-' . preg_replace('/[^a-z0-9]/', '', $did) . '.pdf'); $docs = $keep;
        }
        if (!appendLine(custDir() . '/customers.log', ['id' => $cid, 'by' => $me, 'at' => time(), 'f' => ['docs' => $docs]])) fail('Could not save that. Try again.', 500);
        out(['ok' => true, 'docs' => $docs]);
    }
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
            $c['due'] = ($c['status'] ?? 'active') === 'active' && !empty($c['next']) && $c['next'] <= $soon && !custNextDone($c, $mine);
            $c['overdue'] = $c['due'] && $c['next'] < $today;
            if (!empty($c['lead'])) {   /* their jobs and payments (2026-10-16, Matthew: no slot for deposits on the customer) */
                static $jByLead = null; if ($jByLead === null) { $jByLead = []; foreach (jobsAll() as $j) if (!$j['off'] && !empty($j['lead'])) $jByLead[(string) $j['lead']][] = $j; }
                $c['jobs'] = array_map(fn($j) => ['id' => (string) $j['id'], 'date' => (string) $j['date'], 'slot' => (string) $j['slot'], 'crew' => (string) $j['crew'], 'price' => (int) ($j['price'] ?? 0),
                    'pay' => $j['pay'] ?? ['s' => 'unpaid'], 'done' => $j['done'] ?? null, 'addr' => (string) ($j['addr'] ?? ''), 'sqcharge' => $j['sqcharge'] ?? null], $jByLead[(string) $c['lead']] ?? []);
                usort($c['jobs'], fn($a, $b) => strcmp($b['date'], $a['date']));
                /* a job marked Done counts as a visit (2026-10-22, Matthew: Randy showed his price but $0 logged and no last job): worked out here, so an
                   undone job drops out by itself; a visit logged by hand the same day is not counted twice */
                $vDay = array_flip(array_map(fn($v) => (string) ($v['date'] ?? ''), $done));
                foreach ($c['jobs'] as $jb) {
                    if (($jb['done']['o'] ?? '') !== 'done' || isset($vDay[$jb['date']])) continue;
                    $c['spent'] += (float) $jb['price'];
                    if ($c['last'] === null || $jb['date'] > $c['last']) $c['last'] = $jb['date'];
                }
            }
            if (!empty($c['lead'])) { static $lAll = null; $lAll = $lAll ?? leadsAll(); $cl = $lAll[$c['lead']] ?? null;
                if ($cl && !empty($cl['sqcard']['last4'])) $c['cof'] = ['brand' => (string) ($cl['sqcard']['brand'] ?? ''), 'last4' => (string) $cl['sqcard']['last4'], 'exp' => (string) ($cl['sqcard']['exp'] ?? '')];
                if ($cl && !empty($cl['sqcust'])) $c['inSquare'] = true; if ($cl && !empty($cl['signed']) && !empty($cl['sign']['key'])) $c['signedLink'] = a365SignLink((string) $c['lead'], (string) $cl['sign']['key']); }   /* their signed 365 form (2026-10-15) */
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
        $jDone = []; foreach (jobsAll() as $j) if (!$j['off'] && !empty($j['lead']) && (($j['done']['o'] ?? '') === 'done')) $jDone[(string) $j['lead']][] = $j;   /* done jobs count, as on the screen (2026-10-22) */
        foreach ($cs as $c) {
            $done = array_values(array_filter($vs, fn($v) => (string) $v['cid'] === $c['id'] && ($v['status'] ?? 'done') === 'done'));
            $vDay = array_flip(array_map(fn($v) => (string) ($v['date'] ?? ''), $done)); $nDone = count($done); $spent = array_sum(array_map(fn($v) => (float) ($v['price'] ?? 0), $done));
            foreach ($jDone[(string) ($c['lead'] ?? '')] ?? [] as $j) if (!isset($vDay[(string) $j['date']])) { $nDone++; $spent += (float) ($j['price'] ?? 0); }
            fputcsv($fh, array_map('csvSafe', [$c['name'] ?? '', $c['phone'] ?? '', $c['email'] ?? '', $c['address'] ?? '', $c['town'] ?? '', $c['service'] ?? '', $c['plan'] ?? '',
                $c['price'] ?? '', $c['start'] ?? '', $c['next'] ?? '', $c['status'] ?? 'active', $nDone, $spent,
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
        if (array_key_exists('door', $in)) {   /* their property, found by address on the customer page (2026-10-16, Matthew: a won job with no address, e.g. Kirk) */
            $dv = (string) $in['door'];
            if ($dv !== '') {
                if (!preg_match('/^([a-z0-9-]{1,40})\/([a-z0-9-]{1,80})$/D', $dv, $dm)) fail('That property is not on our list.');
                $rd = loadRegion($dm[1]); $hit = false; if ($rd) foreach ($rd['areas'] as $a) { foreach ($a['doors'] as $d) if ((string) $d['id'] === $dm[2]) { $hit = true; break; } if ($hit) break; }
                if (!$hit) fail('That property is not on our list.');
            }
            $f['door'] = $dv;
        }
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
        $jobsFixed = 0;   /* an address added to the customer fills in their open jobs that had none (2026-10-16) */
        $lead = (string) ($cs[$id]['lead'] ?? ''); $addr = trim((string) ($f['address'] ?? ''));
        if (!$isNew && $lead !== '' && $addr !== '') {
            $town = trim((string) ($f['town'] ?? ($cs[$id]['town'] ?? ''))); $full = $addr . ($town !== '' && stripos($addr, $town) === false ? ', ' . $town : '');
            foreach (jobsAll() as $j) if (($j['lead'] ?? '') === $lead && !$j['off'] && empty($j['done']) && in_array(trim((string) ($j['addr'] ?? '')), ['', 'Ask the office'], true)) { appendLine(DATA_DIR . '/jobs.log', ['id' => $j['id'], 'addr' => $full, 'by' => $me, 'at' => time()]); $jobsFixed++; }
        }
        out(['ok' => true, 'id' => $id, 'jobsFixed' => $jobsFixed]);
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
        if (!empty($body['lead'])) {   /* the shared maker since 2026-10-21 */
            $r = custFromLead((string) $body['lead'], $me); if (!$r) fail('No such lead.', 404);
            out(['ok' => true] + $r);
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
            if ($role !== 'admin') fail('An admin removes visits.', 403);
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
/* save a hand measurement, or clear it (2026-10-21) */
if ($action === 'lawnhand') {
    if (!desk() && $role !== 'quote') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $key = (string) ($body['region'] ?? ''); $id = (string) ($body['id'] ?? '');
    if (!regionAvailable($key) || !preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('No such house.', 404);
    $hf = houseFacts($key, $id); if (!$hf) fail('No such house.', 404); $key = (string) $hf['region'];
    $sq = (int) round((float) ($body['sq'] ?? 0));
    if ($sq !== 0 && ($sq < 100 || $sq > 400000)) fail('Type the lawn size in square feet, between 100 and 400,000.');
    $src = in_array($body['src'] ?? '', ['ge', 'wheel', 'other'], true) ? (string) $body['src'] : 'other';
    $incl = in_array($body['incl'] ?? '', ['grass', 'trees', 'beds'], true) ? (string) $body['incl'] : '';
    $row = ['id' => $id, 'sq' => $sq, 'src' => $src, 'incl' => $incl, 'by' => $me, 'at' => time()];
    if (!empty($hf['lawn']['sq'])) $row['photo'] = (int) $hf['lawn']['sq']; if (!empty($hf['range'])) $row['range'] = $hf['range']; if (!empty($hf['trees'])) $row['trees'] = $hf['trees']; if (isset($hf['acres'])) $row['acres'] = $hf['acres'];   /* the calibration row: what the photo said beside it */
    if (!@file_put_contents(DATA_DIR . '/lawnhand-' . basename($key) . '.log', json_encode($row, JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX)) fail('Could not save that. Try again.', 500);
    out(['ok' => true, 'hand' => $sq ? loadLawnHand($key)[$id] ?? null : null]);
}
/* a lot under trees: the range, measured on the server and cached (2026-10-21) */
if ($action === 'lawnrange') {
    if (!desk() && $role !== 'quote') fail('Not allowed.', 403);
    $key = (string) ($_GET['region'] ?? ''); $id = (string) ($_GET['id'] ?? '');
    if (!regionAvailable($key) || !preg_match('/^[a-z0-9-]{1,80}$/D', $id)) fail('No such house.', 404);
    $hf = houseFacts($key, $id); if (!$hf || !isset($hf['lat'], $hf['lon'])) fail('No such house.', 404);
    $ck = $hf['region'] . '/' . $id; $have = lawnRangeCache()[$ck] ?? null; if ($have && (int) ($have['v'] ?? 1) >= 2) out(['ok' => true, 'range' => $have]);   /* v2 (2026-10-21) adds DRCOG's turf */
    $script = dirname(__DIR__, 2) . '/sixfold-tools/prop-pull/lawn-range.mjs';
    if (PHP_SAPI === 'cli-server' && is_file(dirname(__DIR__, 2) . '/sixfold-private/lawn-range-stub.json')) { $res = json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/sixfold-private/lawn-range-stub.json'), true); }   /* the test server */
    else {
        if (!is_file($script) || !function_exists('proc_open')) fail('The range is not set up on this server.', 503);
        $node = is_file('/usr/local/bin/node') ? '/usr/local/bin/node' : 'node';
        @set_time_limit(90);
        $proc = @proc_open([$node, $script, '--lat', (string) $hf['lat'], '--lon', (string) $hf['lon']], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, dirname($script));
        if (!is_resource($proc)) fail('The measure did not start. Try again.', 500);
        stream_set_blocking($pipes[1], false); $outTxt = ''; $t0 = time();
        while (time() - $t0 < 70) { $r = [$pipes[1]]; $w = null; $e = null; if (@stream_select($r, $w, $e, 1) > 0) { $chunk = fread($pipes[1], 65536); if ($chunk === '' || $chunk === false) { if (feof($pipes[1])) break; } else $outTxt .= $chunk; } if (!proc_get_status($proc)['running'] && feof($pipes[1])) break; }
        if (proc_get_status($proc)['running']) proc_terminate($proc);
        fclose($pipes[1]); fclose($pipes[2]); proc_close($proc);
        $lines = array_values(array_filter(explode("\n", trim($outTxt)))); $res = $lines ? json_decode((string) end($lines), true) : null;
    }
    if (!is_array($res)) fail('The measure took too long. Try again in a minute.', 504);
    if (empty($res['ok'])) fail((string) ($res['error'] ?? 'The measure did not work.'));
    $rg = ['lo' => (int) $res['low'], 'hi' => (int) $res['high'], 'lot' => (int) ($res['lot'] ?? 0), 'd' => (string) ($res['d'] ?? ''), 'at' => time(), 'v' => 2,
           'turf' => isset($res['turf']) && $res['turf'] !== null ? (int) $res['turf'] : null, 'tt' => isset($res['turfTrees']) && $res['turfTrees'] !== null ? (int) $res['turfTrees'] : null, 'lulc' => $res['lulc'] ?? null];   /* DRCOG land cover where it covers (2026-10-21) */
    $lk = @fopen(DATA_DIR . '/lawn-range.json.lock', 'c'); if ($lk) flock($lk, LOCK_EX);
    $all = lawnRangeCache(); $all[$ck] = $rg; @file_put_contents(DATA_DIR . '/lawn-range.json', json_encode($all, JSON_UNESCAPED_SLASHES), LOCK_EX);
    if ($lk) { flock($lk, LOCK_UN); fclose($lk); }
    out(['ok' => true, 'range' => $rg]);
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
/* takes payments (2026-10-19, Matthew: "taking a payment should be a trusted feature for certain employees, the admin should overall
   decide as to who gets that permission"). Charging a saved card and making a Square pay link need it; the office and admins always have
   it. Until an admin first sets it for anyone, everyone who does walks has it (Brad: "he's a trusted worker"), so nothing changes the day
   it lands; the first change copies that list and from then on it is only what the admin set. Cash collected is still recorded by anyone. */
function paysOn(string $id): bool { global $acct; if (!isset($acct['pays'])) return !empty($acct['walker'][$id]); return !empty($acct['pays'][$id]); }
function canTakePay(): bool { global $session; return desk() || paysOn((string) ($session['c'] ?? '')); }
if ($action === 'paysset') {
    if (!feature('walkdesk')) fail('Not here.', 404);
    if ($role !== 'admin' || !$isPost) fail('Not allowed.', 403);
    $acctLock = @fopen(accountsFile() . '.lock', 'c');
    if (!$acctLock || !flock($acctLock, LOCK_EX)) fail('Could not save that. Try again.', 500);
    $acct = loadAccounts(); $rows = acctRows($basePeople, $acct, $sessionKey);
    $id = (string) ($body['id'] ?? '');
    if (!isset($rows[$id]) || $rows[$id]['off']) fail('No such account.', 404);
    if (!isset($acct['pays'])) $acct['pays'] = array_map(fn($v) => 1, (array) ($acct['walker'] ?? []));   /* the first change keeps everyone who had it */
    if (!empty($body['on'])) $acct['pays'][$id] = 1; else unset($acct['pays'][$id]);
    if (!saveAccounts($acct)) fail('Could not save that. Try again.', 500);
    accountLog(['by' => $me, 'what' => !empty($body['on']) ? 'takes payments' : 'no payments', 'name' => $rows[$id]['name'], 'id' => $id]);
    out(['ok' => true]);
}
/* who does walks (2026-10-14, the walk desk): an admin ticks them in Accounts; the desk books walks only with them */
if ($action === 'acctflag') {   /* "Runs a team" / "Marks won and lost" on an office account (2026-10-20) */
    if (!feature('walkdesk')) fail('Not here.', 404);
    if ($role !== 'admin') fail('Not allowed.', 403);
    if (!$isPost) fail('POST required', 405);
    $flag = (string) ($body['flag'] ?? ''); if (!in_array($flag, ['runsteam', 'wonlost', 'doors', 'communities', 'results', 'fq'], true)) fail('No such setting.');   /* + fq: the field quick quote, on a crew account (2026-10-21) */   /* + doors, communities, results (2026-10-21) */
    $acctLock = @fopen(accountsFile() . '.lock', 'c');
    if (!$acctLock || !flock($acctLock, LOCK_EX)) fail('Could not save that. Try again.', 500);
    $acct = loadAccounts(); $rows = acctRows($basePeople, $acct, $sessionKey);
    $id = (string) ($body['id'] ?? '');
    if (!isset($rows[$id]) || $rows[$id]['off']) fail('No such account.', 404);
    if ($flag === 'fq' ? !in_array($rows[$id]['role'], ['crew', 'manager'], true) : $rows[$id]['role'] !== 'office') fail($flag === 'fq' ? 'The quick quote is for crew accounts.' : 'Only an Office account takes this.');
    if ($flag === 'runsteam' && !empty($body['on']) && (string) ($acct['member'][$id] ?? '') === '') fail('Put them on a team first.');
    $acct[$flag] = (array) ($acct[$flag] ?? []);
    if (!empty($body['on'])) $acct[$flag][$id] = 1; else unset($acct[$flag][$id]);
    if (!saveAccounts($acct)) fail('Could not save that. Try again.', 500);
    accountLog(['by' => $me, 'what' => ($flag === 'runsteam' ? 'runs a team' : ($flag === 'fq' ? 'quick quote' : ($flag === 'wonlost' ? 'marks won and lost' : $flag))) . (!empty($body['on']) ? '' : ': off'), 'name' => $rows[$id]['name'], 'id' => $id]);
    out(['ok' => true]);
}
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
    $isMgr = mgr();   /* a manager, or an office account that runs a team (2026-10-20) */
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
            return array_diff_key($r, ['code' => 1]) + ['you' => $r['id'] === $myId, 'live' => $l, 'out' => $outAt($r['id']), 'team' => (string) ($acct['member'][$r['id']] ?? ''), 'walker' => !empty($acct['walker'][$r['id']]), 'pays' => paysOn($r['id']), 'runsteam' => acctFlag('runsteam', $r['id']), 'wonlost' => acctFlag('wonlost', $r['id']), 'doors' => acctFlag('doors', $r['id']), 'communities' => acctFlag('communities', $r['id']), 'results' => acctFlag('results', $r['id']), 'fq' => acctFlag('fq', $r['id'])];
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
        if (!in_array($r, ROLES, true)) fail(feature('walkdesk') ? 'Pick crew, office' . (company()['a365'] ? ', quote only' : '') . ', manager or admin.' : 'Pick crew, manager or admin.');
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
        if (!in_array($r, ROLES, true)) fail(feature('walkdesk') ? 'Pick crew, office' . (company()['a365'] ? ', quote only' : '') . ', manager or admin.' : 'Pick crew, manager or admin.');
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
        /* and every per-person setting (walks 2026-10-14; all of them 2026-10-21: Nneka's Runs a team and Marks won and lost stayed on her old
           code's id when she was given a new code on 20 Oct) */
        $nid = codeId($code, $sessionKey);
        foreach (['walker', 'pays', 'runsteam', 'wonlost', 'doors', 'communities', 'results', 'also', 'fq'] as $mk) if (isset($acct[$mk]) && is_array($acct[$mk]) && array_key_exists($id, $acct[$mk])) { $acct[$mk][$nid] = $acct[$mk][$id]; unset($acct[$mk][$id]); }
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
    if (mgr() && !BOARD_OPEN) {   /* a manager's board is their team's (2026-10-05) */
        $rows = array_filter($rows, fn($r) => $r['name'] === $me || sameTeam($r['name']));
        $terr = array_values(array_filter($terr, fn($t) => $t['who'] === $me || sameTeam($t['who'])));
    }
    out(['ok' => true, 'today' => $from['today'], 'open' => BOARD_OPEN, 'goals' => loadGoals(), 'pgoals' => loadPGoals(), 'people' => array_values($rows),
         'territories' => $terr, 'names' => $role === 'admin' ? array_keys($names) : (mgr() ? array_values(array_filter(array_keys($names), fn($n) => $n === $me || sameTeam($n))) : [])]);
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
/* a lot's property line through the server (2026-10-20): the door card, the aerial view and the house lookup ask here first. The state's
   parcel map (gis.colorado.gov) refuses some networks, phone hotspots among them, and then the cards had no line and no framing. Signed-in
   only, Colorado points only, one parcel per point, kept 90 days (a point with no parcel too). */
const PARCEL_CO = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
if ($action === 'parcelat') {
    if (market()['key'] !== 'co') fail('Not here.', 404);
    $lon = (float) ($_GET['lon'] ?? 0); $lat = (float) ($_GET['lat'] ?? 0); $bx = market()['box'];
    if ($lat < $bx[0] || $lat > $bx[2] || $lon < $bx[1] || $lon > $bx[3]) fail('That point is outside the area.');
    $pk = sprintf('%.6f,%.6f', $lon, $lat); $pdir = DATA_DIR . '/parcel-cache'; if (!is_dir($pdir)) @mkdir($pdir, 0700, true);
    $pf = $pdir . '/' . md5($pk) . '.json';
    if (is_file($pf) && time() - filemtime($pf) < 90 * 86400) { $c = json_decode((string) @file_get_contents($pf), true); if (is_array($c)) out(['ok' => true, 'rings' => $c['rings'] ?? null, 'kept' => true]); }
    if (!throttleTake(rateFile('parcelat|' . $me), 900, 3600)) fail('Too many lookups for now. Try again in a few minutes.', 429);
    $purl = PARCEL_CO; $pov = dirname(__DIR__, 2) . '/sixfold-private/parcel-api-test.txt';
    if (PHP_SAPI === 'cli-server' && is_file($pov)) $purl = trim((string) file_get_contents($pov));   /* the test copy's stand-in map; never on the host */
    $pcode = 0; $praw = httpGetRaw($purl . '?' . http_build_query(['f' => 'json', 'geometry' => $lon . ',' . $lat, 'geometryType' => 'esriGeometryPoint', 'inSR' => '4326', 'outSR' => '4326',
        'spatialRel' => 'esriSpatialRelIntersects', 'returnGeometry' => 'true', 'outFields' => 'OBJECTID', 'geometryPrecision' => '7']), 15, $pcode);
    $pj = $praw !== null ? json_decode($praw, true) : null;
    if (!is_array($pj) || isset($pj['error'])) fail('The parcel map did not answer.', 502);
    $pg = $pj['features'][0]['geometry'] ?? null;
    $rings = is_array($pg) && !empty($pg['rings']) && is_array($pg['rings']) ? $pg['rings'] : null;
    @file_put_contents($pf, json_encode(['rings' => $rings, 'at' => time()]), LOCK_EX);
    out(['ok' => true, 'rings' => $rings]);
}
if ($action === 'territories') {
    if ($role !== 'admin' && !mgr()) fail('Not allowed.', 403);
    $idx = json_decode((string) @file_get_contents(DATA_DIR . '/index.json'), true) ?: ['regions' => []];
    $towns = [];
    foreach (($idx['regions'] ?? []) as $rg) {
        $ks = townKnockStats($rg['key']); if (!$ks) continue;   /* cached per town (2026-10-11) */
        $assign = loadAssign($rg['key']); $aday = assignDays($rg['key']);
        $areas = [];
        $whoOf = function ($w) use ($role, $me) { if ($w === null || $w === '' || $role === 'admin' || $w === $me || sameTeam((string) $w)) return $w; return 'another team'; };   /* 2026-10-20: a team's manager sees only their team */
        foreach ($ks['areas'] as $ar) $areas[] = ['name' => $ar[0], 'total' => $ar[1], 'knocked' => $ar[2], 'who' => $whoOf($assign[$ar[0]] ?? null), 'on' => $aday[$ar[0]] ?? null];
        $towns[] = ['key' => $rg['key'], 'label' => $rg['label'], 'areas' => $areas];
    }
    $names = [];
    foreach ($people as $pp) { $n = (string) ($pp[0] ?? ''); if ($n !== '' && !boardHidden($n) && ($role === 'admin' || $n === $me || sameTeam($n))) $names[$n] = true; }
    ksort($names);
    /* everyone who can sign in now, hidden ones included: an assignment to anyone else belongs to someone removed */
    $active = []; foreach ($people as $pp) { $n = (string) ($pp[0] ?? ''); if ($n !== '') $active[$n] = true; }
    out(['ok' => true, 'towns' => $towns, 'names' => array_keys($names), 'active' => array_keys($active), 'manager' => mgr()]);
}
/* every neighbourhood one person holds, in every town, back to unassigned in one go (2026-10-04): when someone leaves,
   or their area changes. Works for people already removed from Accounts too. */
if ($action === 'unassignall') {
    if ($role !== 'admin' && !mgr()) fail('Not allowed.', 403);
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
    if ($role !== 'admin' && !mgr()) fail('Not allowed.', 403);
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
    if ($role !== 'admin' && !mgr()) fail('Not allowed.', 403);
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
    if ($role !== 'admin' && !mgr()) fail('Not allowed.', 403);
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
    if (!TERRITORIES_OPEN && $role !== 'admin' && !mgr()) fail('Not allowed.', 403);
    $key = (string) ($_GET['region'] ?? '');
    if (!regionAvailable($key)) fail('No such region.', 404);
    /* 'del': may this person take the outline away (a manager only their team's) */
    $list = array_map(fn($t) => $t + ['del' => mayAssign($t['who'], '')], array_values(loadTerr($key)));
    out(['ok' => true, 'territories' => $list]);
}
if ($action === 'terrsave') {
    if ($role !== 'admin' && !mgr()) fail('Not allowed.', 403);
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
    /* a line pasted from a lead list works too (2026-10-14: "Russ King: 7173 townsend dr 3039079919 rdkgoose@..."): emails and
       phone numbers go, and with a house number in it, whatever comes before the number (a name) goes */
    $raw = (string) ($_GET['q'] ?? '');
    $raw = (string) preg_replace(['/\S+@\S+/', '/\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/'], ' ', $raw);
    if (preg_match('/(?:^|[^0-9A-Za-z])(\d{1,6}[A-Za-z]?)\s+[A-Za-z]/', $raw, $hm, PREG_OFFSET_CAPTURE) && $hm[1][1] > 0) $raw = substr($raw, $hm[1][1]);
    $q = strtoupper(trim($raw));
    $q = (string) preg_replace('/[^A-Z0-9 ]+/', ' ', $q);
    $words = array_values(array_filter(explode(' ', $q), fn($w) => $w !== ''));
    if (strlen(implode('', $words)) < 3) out(['ok' => true, 'q' => $q, 'results' => []]);
    $words = array_slice(array_map(fn($w) => SEARCH_SYN[$w] ?? $w, $words), 0, 6);
    $LONGW = array_flip(SEARCH_SYN);   /* 2026-10-15: "point" became PT and missed CANYON POINT CIR; the long form in the records matches too */
    /* a street name has to be in it (Fable 2026-10-04): "DRIVE" or "100" alone matched a whole class of
       streets or house numbers, and a loop of them could pull every address in every town. A number with a
       street name ("1840 ponderosa") or a street name alone ("ponderosa") still works. Counted per person:
       60 searches in 10 minutes is far past what a driver needs, and far short of the whole list. */
    /* 2026-10-14 (Matthew: "7173 townsend dr" was there, "..., highlands ranch" found nothing): "CO", "Colorado" and a ZIP are dropped,
       and a word may match the town's name instead of the street */
    /* a ZIP is a Colorado one (80xxx or 81xxx) after the first word: a 5-digit house number leads, and stays (2026-10-17, Matthew:
       "14705 columbine st" listed every Columbine St because 14705 was taken for a ZIP) */
    $words = array_values(array_filter($words, fn($w, $i) => !in_array($w, ['CO', 'COLO', 'COLORADO', 'USA'], true) && !($i > 0 && preg_match('/^8[01]\d{3}$/D', $w)), ARRAY_FILTER_USE_BOTH));
    $named = array_filter($words, fn($w) => strlen($w) >= 3 && !ctype_digit($w) && !in_array($w, SEARCH_TYPES, true));
    if (!$named) out(['ok' => true, 'q' => $q, 'results' => [], 'need' => 'street']);
    $withLookup = !empty($_GET['lookup']) && feature('walkdesk') && (desk() || $role === 'quote' || fqOn());   /* + the field quick quote (2026-10-21) */
    if (!throttleTake(rateFile('search|' . (string) ($session['c'] ?? $me)), 150, 600)) fail('That is a lot of searches. Wait a few minutes.', 429);
    $find = function (array $words) use ($withLookup, $LONGW): array {
        $hits = [];
        foreach (searchIndex() as $line) {
            $p = explode("\t", $line); if (count($p) < 9) continue;
            $look = ($p[9] ?? '') === 'L'; if ($look && !$withLookup) continue;
            $aw = explode(' ', (string) preg_replace('/[^A-Z0-9 ]+/', ' ', $p[4]));
            $tw = explode(' ', (string) preg_replace('/[^A-Z0-9 ]+/', ' ', strtoupper($p[1])));
            $ok = true; $exactNo = false; $streetHit = false;
            foreach ($words as $w) {
                $m = false; foreach ($aw as $i => $x) { if ($x !== '' && (strncmp($x, $w, strlen($w)) === 0 || (isset($LONGW[$w]) && $x === $LONGW[$w]))) { $m = true; if (!ctype_digit($w)) $streetHit = true; if ($i === 0 && $x === $w && ctype_digit($w)) $exactNo = true; break; } }
                if (!$m && !ctype_digit($w)) foreach ($tw as $x) if ($x !== '' && $x === $w) { $m = true; break; }   /* the town's name */
                if (!$m) { $ok = false; break; }
            }
            if ($ok && !$streetHit) $ok = false;   /* the town alone is not an address */
            if (!$ok) continue;
            $hits[] = ['rank' => ($exactNo ? 0 : 1), 'region' => $p[0], 'town' => $p[1], 'area' => $p[2], 'id' => $p[3], 'address' => $p[4],
                       'fire' => (int) $p[5] ?: null, 'lawn' => $p[6] !== '' ? ['lv' => $p[6], 'yr' => (int) $p[7] ?: null] : null, 'tl' => $p[8] !== '' ? $p[8] : null, ...($look ? ['lookup' => true] : [])];
            if (count($hits) > 400) break;
        }
        return $hits;
    };
    $hits = $find($words);
    /* 2026-10-18 (Matthew: an address pasted from Facebook found nothing, typed it did): a paste often carries words that are
       not on our list: a flat ("Apt 2", "Unit B", "#5"), a mailing town that is not the town we file the house under
       ("Littleton" for a Columbine house), or the rest of the message. With nothing found, try again with only the house number
       and the street, up to its street type (DR, ST, AVE...). */
    if (!$hits) {
        $cut = []; $typed = false;
        foreach ($words as $w) {
            $cut[] = $w;
            if (in_array($w, SEARCH_TYPES, true) && !in_array($w, ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'], true) && array_filter($cut, fn($x) => strlen($x) >= 3 && !ctype_digit($x) && !in_array($x, SEARCH_TYPES, true))) { $typed = true; break; }
        }
        if ($typed && count($cut) < count($words)) $hits = $find($cut);
    }
    /* still nothing: without N / S / E / W (2026-10-21: "11663 N Settlers" against the list's "11663 SETTLERS DR") */
    if (!$hits) { $nd = array_values(array_filter($words, fn($w, $i) => $i === 0 || !in_array($w, SEARCH_DIRS, true), ARRAY_FILTER_USE_BOTH)); if (count($nd) < count($words) && array_filter($nd, fn($x) => strlen($x) >= 3 && !ctype_digit($x) && !in_array($x, SEARCH_TYPES, true))) $hits = $find($nd); }
    /* a pulled-in copy of a house that is on a door list stays out (the door-list house has the trees, the right lot and the history) */
    $onList = []; foreach ($hits as $h0) if (empty($h0['lookup'])) $onList[strtoupper($h0['address']) . '|' . strtolower($h0['region'])] = 1;
    $hits = array_values(array_filter($hits, fn($h0) => empty($h0['lookup']) || !isset($onList[strtoupper($h0['address']) . '|' . strtolower(str_replace(' ', '-', $h0['town']))])));
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
    $visByC = []; foreach (loadVisits() as $v) $visByC[(string) ($v['cid'] ?? '')][] = $v;
    foreach (loadCustomers() as $c) {
        if (($c['status'] ?? 'active') !== 'active' || empty($c['next']) || $c['next'] > $week || custNextDone($c, $visByC[$c['id']] ?? [])) continue;
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
    $blank = ['houses' => 0, 'knocked' => 0, 'leads' => 0, 'talked' => 0, 'booked' => 0, 'quoted' => 0, 'won' => 0, 'lost' => 0, 'value' => 0];
    $dims = ['src' => [], 'fire' => [], 'lawn' => [], 'trees' => [], 'value' => [], 'town' => [], 'work' => []];
    $total = $blank;
    $add = function (string $dim, string $k, array $row) use (&$dims, $blank) {
        $cur = $dims[$dim][$k] ?? $blank;
        foreach ($row as $f => $v) $cur[$f] += $v;
        $dims[$dim][$k] = $cur;
    };
    /* leads that came in some other way than a knock (ads, Messenger, the websites, a call, ClickUp), tied to their house so they are bucketed by the
       same facts as the doors (2026-10-22, Matthew: "we take the info from each door card that we land from ads so we can still determine which
       data turns into results"). The house saved on the lead first, else its address matched against the door lists; a lead with no house it can
       be tied to still counts in the totals and under where it came from, and the page says how many. Door-made leads (at the door, in person)
       are the knock itself, so they are not counted twice. */
    $leads = leadsAll(); $jobOf = []; foreach (jobsAll() as $j) if (!$j['off'] && !empty($j['lead'])) $jobOf[(string) $j['lead']] = $j;
    $leadAt = []; $unmatched = [];
    $homeOf = function (string $key, string $id): ?string { if ($key === '' || $id === '') return null; if (isset(doorIds($key)[$id])) return $key; foreach (sharedWith($key) as $p) if (isset(doorIds($p)[$id])) return $p; return null; };
    foreach ($leads as $l) {
        $src = (string) ($l['src'] ?? 'other');
        if (in_array($src, ['door', 'inperson'], true) || preg_match('/\btest\b|claude/i', (string) ($l['name'] ?? ''))) continue;
        $j = $jobOf[(string) $l['id']] ?? null; $st = (string) ($l['status'] ?? 'new');
        $won = $j !== null || $st === 'won';
        $row = ['houses' => 1, 'knocked' => 0, 'leads' => 1, 'talked' => (count($l['tries'] ?? []) > 0 || $st !== 'new') ? 1 : 0, 'booked' => $won ? 1 : 0,
                'quoted' => (!empty($l['quote']) || in_array($st, ['quoted', 'won'], true) || $won || in_array(strtolower(trim((string) ($l['cus'] ?? ''))), ['quote sent', 'scheduled', 'completed'], true)) ? 1 : 0,
                'won' => $won ? 1 : 0, 'lost' => $st === 'lost' ? 1 : 0, 'value' => $won ? ((int) ($j['price'] ?? 0) ?: (int) ($l['quote']['price'] ?? 0)) : 0];
        $h = is_array($l['house'] ?? null) ? $l['house'] : null; $key = null; $did = '';
        if ($h && empty($h['typed']) && !empty($h['region']) && !empty($h['door'])) { $key = $homeOf((string) $h['region'], (string) $h['door']); $did = (string) $h['door']; }
        if (!$key) foreach ([$h ? trim((string) ($h['address'] ?? '') . ', ' . (string) ($h['town'] ?? ''), ', ') : '', (string) ($j['addr'] ?? ''), (string) ($l['town'] ?? '')] as $txt) {
            if (!preg_match('/^\s*\d+\s+\S/', $txt)) continue;
            $p = array_map('trim', explode(',', $txt)); $m = a365Match($p[0], $p[1] ?? '');
            if ($m && ($key = $homeOf((string) $m['region'], (string) $m['door']))) { $did = (string) $m['door']; break; }
        }
        if ($key) $leadAt[$key][$did][] = ['src' => $src, 'row' => $row];
        else { foreach ($row as $f => $v) $total[$f] += $v; $add('src', $src, $row); $unmatched[$src] = ($unmatched[$src] ?? 0) + 1; }
    }
    foreach (($idx['regions'] ?? []) as $r) {
        $data = loadRegion($r['key']);
        if (!$data) continue;
        $marks = loadMarks($r['key']); $quoted = loadQuoted($r['key']); $res = loadResults($r['key']);
        $lfix = loadLawnFix($r['key']); $work = loadWork($r['key']); $here = $leadAt[$r['key']] ?? [];
        foreach ($data['areas'] as $a) foreach ($a['doors'] as $d) {
            $m = $marks[$d['id']] ?? null; $came = $here[$d['id']] ?? [];
            if ((!$m || $m['outcome'] === 'nosolicit') && !$came) continue;
            $row = $blank;
            if ($m && $m['outcome'] !== 'nosolicit') {
                $booked = $m['outcome'] === 'booked';
                $rs = $booked ? ($res[$d['id']] ?? null) : null;
                $row = ['houses' => 1, 'knocked' => 1, 'leads' => 0, 'talked' => ($booked || $m['outcome'] === 'later') ? 1 : 0, 'booked' => $booked ? 1 : 0,
                        'quoted' => ($booked && isset($quoted[$d['id']])) ? 1 : 0,
                        'won' => ($rs && $rs['result'] === 'won') ? 1 : 0, 'lost' => ($rs && $rs['result'] === 'lost') ? 1 : 0,
                        'value' => ($rs && $rs['result'] === 'won') ? (int) ($rs['value'] ?? 0) : 0];
            }
            foreach ($came as $x) foreach ($x['row'] as $f => $v) $row[$f] = $f === 'leads' ? 1 : max($row[$f], $v);   /* one house counts once, knocked and came in or not */
            foreach ($row as $f => $v) $total[$f] += $v;
            $add('src', $came ? ($row['knocked'] ? 'both' : (string) $came[0]['src']) : 'door', $row);
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
    out(['ok' => true, 'total' => $total, 'dims' => $dims, 'unmatched' => $unmatched, 'srcNames' => LEAD_SRC_NAME]);
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
