<?php
/* Traverse Prospect Desk (2026-10-26, TR-21, Matthew: "build these leads out similar to how we did the peak app ... where i can input
 * information and knock people off the list"; "a way i can send emails to everyone at once"). The Colorado companies that could buy
 * Traverse (roofing, solar, pest, security, yards), worked like the Peak Sponsor Desk: status from Not contacted to Customer, notes,
 * next steps, contact details, knock a company off (No / Not now) and put it back.
 * Storage: plain files outside the public folder. The companies start from seed.json (tools/build-seed.mjs, from the prospect list);
 * everything after is an append-only log (events.log), replayed on each read, so a new seed never drops what was done on the desk.
 * Sign-in: a 6-digit code per person, kept hashed. Make one from the command line (prints the code once):
 *   php desk.php addaccount "Matthew Sharpe" admin
 * Email to many (2026-10-26): the desk writes one message per company from a template, Matthew previews them and queues them; the
 * hourly cron job (traverse/app/tools/morning-email.php starts it) drip-sends from his Traverse mailbox, one message per company,
 * any day and any hour (Matthew 2026-10-30: businesses run at all hours), about 2 minutes apart, at most the daily cap (default 40). Nothing is queued without his tap,
 * and nothing can be queued until a postal address is set (the law wants one in every commercial email). Each message carries an
 * unsubscribe link this file answers without a sign-in; an unsubscribed company is never emailed again.
 *   php desk.php sendqueue [max]     (the cron job: sends up to max, default 10, if it is time)
 * Test hooks (the harness only): DESK_DATA (data folder), DESK_MAIL_MOCK (a file: messages are written there, none are sent),
 * DESK_HOURS=1 (only weekdays 8 am to 5 pm, as before 30 Oct), DESK_GAP (seconds between messages; default 120). */
declare(strict_types=1);
define('DESK', 1);
date_default_timezone_set('America/Denver');
$LOCAL = PHP_SAPI === 'cli-server' || PHP_SAPI === 'cli';
$outside = dirname(__DIR__, 3) . '/traverse-prospects-data';
define('DATA_DIR', getenv('DESK_DATA') ?: (is_dir($outside) ? $outside : ($LOCAL ? dirname(__DIR__) . '/../desk-data-local' : $outside)));
if (!is_dir(DATA_DIR)) { if ($LOCAL) @mkdir(DATA_DIR, 0770, true); else { http_response_code(500); exit('{"ok":false,"error":"No data folder."}'); } }

function jread(string $f, $def) { $s = @file_get_contents(DATA_DIR . '/' . $f); if ($s === false) return $def; $j = json_decode($s, true); return $j === null ? $def : $j; }
function jwrite(string $f, $v): bool { $t = DATA_DIR . '/' . $f . '.tmp' . bin2hex(random_bytes(3)); if (file_put_contents($t, json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) === false) return false; return rename($t, DATA_DIR . '/' . $f); }
function logAdd(array $row): bool { return (bool) file_put_contents(DATA_DIR . '/events.log', json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); }
function logRows(): array { $out = []; $fh = @fopen(DATA_DIR . '/events.log', 'r'); if (!$fh) return $out; while (($l = fgets($fh)) !== false) { $r = json_decode($l, true); if (is_array($r)) $out[] = $r; } fclose($fh); return $out; }
function clean($v, int $max): string { $t = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) $v) ?? ''); return mb_substr($t, 0, $max); }
function cleanText($v, int $max): string { $t = str_replace(["\r\n", "\r"], "\n", (string) $v); $t = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]+/u', ' ', $t) ?? ''; return mb_substr(trim($t), 0, $max); }   /* keeps line breaks */
function codeHash(string $c): string { return hash('sha256', 'prospectdesk|' . $c); }
const STATUSES = ['new' => 'Not contacted', 'emailed' => 'Emailed', 'called' => 'Called / left voicemail', 'nextdoor' => 'Messaged on Nextdoor', 'talking' => 'Talking', 'demo' => 'Demo booked', 'pilot' => 'Pilot', 'customer' => 'Customer', 'notnow' => 'Not now', 'no' => 'No'];   /* nextdoor (31 Oct, Matthew): messaged by hand on Nextdoor; the desk never messages there */
const OFF = ['notnow', 'no'];   /* knocked off the list: hidden unless asked for */
const WAYS = ['emailed', 'called', 'nextdoor'];   /* ways we reached them (31 Oct, Matthew): ticks that can all be on at once; while a company is still at the first stage its status is the last one ticked, or Not contacted with none */
const TRADES = ['roofing' => 'Roofing', 'roofing solar' => 'Roofing and solar', 'solar' => 'Solar', 'pest' => 'Pest control', 'security' => 'Security', 'yards' => 'Lawn and yards'];
const CAP_MAX = 240;   /* 10 an hour around the clock (Matthew 31 Oct: "10 emails an hour", no daily stop); the hourly 10 is the pace */

/* the starting templates, one a trade (2026-10-26): drafts for Matthew to make his own in Settings. They say what the app does in
   plain words and make no claim about any company's results; no data source is named. */
function defaultTemplates(): array {
    $ask = "\n\nWould a 20-minute look be worth it? I can show it to you on a call this week.\n\nThanks,";
    $open = "Hi {first},\n\nI'm Matthew with Traverse, here in Colorado. We make an app for crews that sell door to door";
    return [
        'roofing' => ['subject' => 'Door-knocking app for {company}', 'body' => $open . ": it shows which streets around {city} had hail lately, which houses to knock first, and keeps every knock, quote and follow-up in one place." . $ask],
        'roofing solar' => ['subject' => 'Door-knocking app for {company}', 'body' => $open . ": it shows which streets around {city} had hail lately, which houses to knock first, and keeps every knock, quote and follow-up in one place, for roofing and solar." . $ask],
        'solar' => ['subject' => 'Door-knocking app for {company}', 'body' => $open . ": it picks which houses around {city} to knock first and keeps every knock, quote and follow-up in one place." . $ask],
        'pest' => ['subject' => 'Door-knocking app for {company}', 'body' => $open . ": it picks the houses worth knocking near the customers you already have and keeps every knock, quote and follow-up in one place." . $ask],
        'security' => ['subject' => 'Door-knocking app for {company}', 'body' => $open . ": it picks which streets around {city} to work and keeps every knock, quote and follow-up in one place." . $ask],
        'yards' => ['subject' => 'Door-knocking app for {company}', 'body' => $open . ": it shows lawn size house by house around {city}, picks the streets worth knocking, and keeps every knock, quote and follow-up in one place." . $ask],
    ];
}
function defaultSettings(): array { return ['address' => '', 'signature' => "Matthew Sharpe\nTraverse Platforms LLC\n(303) 596-9515", 'cap' => 40]; }

/* ---- the state: the seed, replayed with the log ---- */
function noteKey(array $r): string { return substr(sha1($r['at'] . '|' . $r['by'] . '|' . $r['note']), 0, 8); }
function state(): array {
    $seed = jread('seed.json', ['leads' => []]);
    $base = ['status' => 'new', 'reached' => [], 'notes' => [], 'next' => null, 'log' => [], 'person' => '', 'unsub' => false, 'sent' => []];
    $L = []; foreach ($seed['leads'] as $l) $L[$l['id']] = $l + $base;
    $tpl = defaultTemplates(); $set = defaultSettings(); $team = [];
    foreach (logRows() as $r) {
        $id = (string) ($r['id'] ?? ''); $t = (string) ($r['t'] ?? '');
        if (!empty($r['by'])) { $b = (string) $r['by']; $team[$b][$t] = ($team[$b][$t] ?? 0) + 1; }
        switch ($t) {
            case 'lead': $L[$id] = $r['lead'] + $base; break;
            case 'status': if (isset($L[$id])) { $L[$id]['status'] = $r['status']; if ($r['status'] === 'new') $L[$id]['reached'] = []; elseif (in_array($r['status'], WAYS, true) && !in_array($r['status'], $L[$id]['reached'], true)) $L[$id]['reached'][] = $r['status']; $L[$id]['log'][] = ['at' => $r['at'], 'by' => $r['by'], 'what' => 'Status: ' . (STATUSES[$r['status']] ?? $r['status'])]; } break;
            case 'reach': if (isset($L[$id]) && in_array($r['way'] ?? '', WAYS, true)) { $w = $r['way']; $R = array_values(array_diff($L[$id]['reached'], [$w])); if (!empty($r['on'])) $R[] = $w; $L[$id]['reached'] = $R;
                 if ($L[$id]['status'] === 'new' || in_array($L[$id]['status'], WAYS, true)) $L[$id]['status'] = $R ? end($R) : 'new';
                 $L[$id]['log'][] = ['at' => $r['at'], 'by' => $r['by'], 'what' => (!empty($r['on']) ? 'Ticked: ' : 'Unticked: ') . STATUSES[$w]]; } break;   /* 31 Oct */
            case 'note': if (isset($L[$id])) $L[$id]['notes'][] = ['k' => noteKey($r), 'at' => $r['at'], 'by' => $r['by'], 'note' => $r['note']]; break;
            case 'notedel': if (isset($L[$id])) $L[$id]['notes'] = array_values(array_filter($L[$id]['notes'], fn($n) => $n['k'] !== ($r['nk'] ?? ''))); break;
            case 'next': if (isset($L[$id])) $L[$id]['next'] = $r['next']; break;
            case 'edit': if (isset($L[$id])) foreach ((array) $r['f'] as $k => $v) if ($k === 'nextdoor') { $L[$id]['nextdoor'] = (string) $v; $so = array_values(array_filter((array) ($L[$id]['socials'] ?? []), fn($u) => stripos((string) $u, 'nextdoor.com') === false)); if ((string) $v !== '') array_unshift($so, (string) $v); $L[$id]['socials'] = $so; } elseif (in_array($k, ['phone', 'email', 'site', 'person', 'name'], true)) {   /* + nextdoor (31 Oct): their business page, first among the social links */
                 $L[$id][$k] = $v; if ($k === 'email') { $L[$id]['emailOk'] = ''; $L[$id]['emailSrc'] = 'desk'; } } break;
            case 'sent': if (isset($L[$id])) { $L[$id]['sent'][] = ['at' => $r['at'], 'subject' => $r['subject'], 'to' => $r['to']]; if (!in_array('emailed', $L[$id]['reached'], true)) $L[$id]['reached'][] = 'emailed'; $L[$id]['log'][] = ['at' => $r['at'], 'by' => $r['by'], 'what' => 'Emailed: ' . $r['subject']]; } break;
            case 'click': if (isset($L[$id])) { $L[$id]['clicks'] = ($L[$id]['clicks'] ?? 0) + 1; $L[$id]['log'][] = ['at' => $r['at'], 'by' => 'the company', 'what' => 'Clicked ' . (($r['to'] ?? '') === 'demo' ? 'Book a demo' : 'the website') . ' in the email']; } break;   /* 2026-10-30 */
            case 'bounce': if (isset($L[$id])) { $L[$id]['emailOk'] = 'no'; $L[$id]['emailWhy'] = 'the email to ' . ($r['to'] ?? 'it') . ' bounced'; $L[$id]['log'][] = ['at' => $r['at'], 'by' => $r['by'], 'what' => 'Email bounced: ' . ($r['to'] ?? '')]; } break;   /* 31 Oct: a bounce Matthew reports; the address is kept, the desk never emails it again */
            case 'unsub': if (isset($L[$id])) { $L[$id]['unsub'] = true; $L[$id]['log'][] = ['at' => $r['at'], 'by' => $r['by'], 'what' => 'Asked not to be emailed']; } break;
            case 'template': if (isset(TRADES[$r['trade'] ?? ''])) $tpl[$r['trade']] = ['subject' => $r['subject'], 'body' => $r['body']]; break;
            case 'settings': $set = array_merge($set, array_intersect_key((array) $r['s'], $set)); break;
        }
    }
    return ['leads' => $L, 'templates' => $tpl, 'settings' => $set, 'team' => $team];
}

/* ---- email ---- */
function secret(): string { $f = DATA_DIR . '/secret.key'; $s = @file_get_contents($f); if (!$s) { $s = bin2hex(random_bytes(32)); file_put_contents($f, $s); @chmod($f, 0600); } return trim($s); }
function goToken(string $id, string $to): string { return substr(hash_hmac('sha256', 'go|' . $id . '|' . $to, secret()), 0, 16); }   /* click tracking (2026-10-30) */
const GO_TO = ['home' => 'https://traverseplatforms.com/', 'demo' => 'https://traverseplatforms.com/demo/'];
/** the email's homepage and demo links routed through action=go for this company (done at send time, so queued messages get it too) */
function trackLinks(string $html, string $id): string {
    if ($html === '' || !preg_match('/^[a-z0-9]{6,24}$/', $id)) return $html;
    $go = fn($to) => 'https://traverseplatforms.com/prospects-47bfe6/api/desk.php?action=go&amp;id=' . $id . '&amp;to=' . $to . '&amp;t=' . goToken($id, $to);
    return preg_replace_callback('#href="https://traverseplatforms\.com(/demo/?)?/?"#', fn($m) => 'href="' . $go(!empty($m[1]) ? 'demo' : 'home') . '"', $html);
}
function unsubToken(string $id): string { return substr(hash_hmac('sha256', 'unsub|' . $id, secret()), 0, 20); }
function firstName(string $person): string { $p = preg_split('/\s+/', trim($person)) ?: []; $f = $p[0] ?? ''; return preg_match('/^[A-Za-z][A-Za-z\'-]{1,30}$/', $f) ? $f : ''; }
/* the name as people say it (2026-10-27, Matthew's review: "Colorado hail map for Verity Roofing LLC"): the register's legal suffix off
   (LLC, Inc, Corp, Co, Ltd, PLLC ...), and an ALL-CAPS name in normal case ("FULL CURL ROOFING LLC" -> "Full Curl Roofing"). A word of
   two or three capitals stays as written (2026-10-30: "AP LANDSCAPE" -> "AP Landscape", "JA-MAR ROOFING" -> "JA-MAR Roofing", not "Ap",
   "Ja-Mar"), unless it is an ordinary short word ("THE", "AND", "PRO" ...), which goes to normal case like the rest. */
const SHORT_WORDS = ['THE', 'AND', 'FOR', 'OF', 'ALL', 'TOP', 'NEW', 'ONE', 'TWO', 'PRO', 'BIG', 'SKY', 'SUN', 'RED', 'DRY', 'MAX', 'ACE', 'OAK', 'OUR', 'MY', 'GO', 'IN', 'ON', 'AT', 'TO', 'BY', 'UP', 'AN', 'NO', 'OR', 'DO', 'IT', 'WE', 'YOU', 'HIS', 'HER', 'OLD', 'HOT', 'AIR', 'ICE', 'ELK', 'FOX', 'BEE', 'OWL', 'PEAK', 'LOW', 'HIGH', 'MILE', 'ROOF', 'LAWN', 'YARD', 'TREE', 'CO'];
function spokenName(string $n): string {
    $n = trim(preg_replace('/[\s,.]+(l\.?\s?l\.?\s?c\.?|inc\.?|incorporated|corp\.?|corporation|co\.?|company|ltd\.?|limited|p\.?l\.?l\.?c\.?|l\.?l\.?l\.?p\.?|l\.?l\.?p\.?)\s*$/i', '', trim($n)), " ,.\t");
    if ($n !== '' && $n === strtoupper($n) && preg_match('/[A-Z]{3,}/', $n)) $n = preg_replace_callback('/\b([A-Z])([A-Z\']*)\b/', fn($m) => (strlen($m[0]) >= 2 && strlen($m[0]) <= 3 && !in_array($m[0], SHORT_WORDS, true)) ? $m[0] : $m[1] . strtolower($m[2]), $n);
    return $n;
}
function fill(string $s, array $l): string {
    return strtr($s, ['{company}' => spokenName((string) $l['name']), '{city}' => (string) ($l['city'] ?: 'your area'), '{trade}' => strtolower(TRADES[$l['trade']] ?? 'your trade'), '{first}' => firstName((string) $l['person']) ?: 'there']);
}
/** one company's message: the template filled in, the signature, the address, the unsubscribe line. $style 'map' adds the HTML
    version with the city's map when there is one ($mapTrade: the template's trade when everyone gets one trade's template) */
function render(array $l, array $tpl, array $set, string $unsubUrl, string $style = 'plain', ?string $mapTrade = null): array {
    $t = $tpl[$l['trade']] ?? reset($tpl);
    $main = rtrim(fill((string) $t['body'], $l));
    $body = $main . "\n\n" . trim((string) $set['signature'])   /* a blank line before the signature */ . ($set['address'] !== '' ? "\n" . trim((string) $set['address']) : '')
          . "\n\nUnsubscribe: " . $unsubUrl;   /* a plain line, not an apology (Matthew 2026-10-29: "reply no thanks" read as unconfident); the law needs a working opt-out, and this is it */
    $m = ['id' => $l['id'], 'to' => (string) $l['email'], 'subject' => fill((string) $t['subject'], $l), 'body' => $body, 'style' => 'plain'];
    if ($style === 'map') {
        $map = mapFor($mapTrade ?? (string) $l['trade'], (string) ($l['city'] ?? ''));
        if ($map) { $m['style'] = 'map'; $m['map'] = ['img' => $map['url'], 'text' => $map['text'], 'city' => $map['city']]; $m['html'] = mailHtml($main, $set, $map, $unsubUrl); }
        else $m['nomap'] = 'no map for ' . ((string) ($l['city'] ?? '') ?: 'a company with no city') . ': goes plain';
    } elseif (isset(APP_PICS[$style])) {   /* an app picture instead of the map (2026-10-30) */
        $pic = appPic($style, $mapTrade ?? (string) $l['trade']);
        if ($pic) { $m['style'] = $style; $m['map'] = ['img' => $pic['url'], 'text' => $pic['text'], 'city' => '']; $m['html'] = mailHtml($main, $set, $pic, $unsubUrl); }
        else $m['nomap'] = 'no app picture for ' . (TRADES[$l['trade']] ?? $l['trade']) . ': goes plain';
    }
    /* a placeholder the template editor let through ({Company}, {name}) would go out as typed (review 2026-10-31) */
    if (preg_match('/\{[a-z]+\}/i', $m['subject'] . "\n" . $m['body'], $ph)) $m['badph'] = $ph[0];
    return $m;
}

/* ---- "With map" (2026-10-30, Matthew: plain text "reads as a phishing scam or a don't-click-that-link type email ... I am fine with
   trying out a halfway"): the same message as a light HTML note beside the exact plain text (multipart/alternative): the Traverse
   wordmark, the same words, one map of the company's own city from our data, a business signature. No tracking pixel, no click
   tracking, no shortener: every link is the plain address it shows. The maps are made by tools/build-maps.mjs into ../m/ with their
   captions in m/maps.json (one picture per city and trade family, counts from our files); a city with no map goes plain. The
   pictures are hosted (not attached): a lighter message with no attachment, which Gmail shows inline through its image proxy. ---- */
const STYLES = ['plain' => 'Plain', 'map' => 'With map', 'phone' => 'App: phone', 'computer' => 'App: computer', 'both' => 'App: phone + computer'];
/* the app pictures (2026-10-30, Matthew: the map read pixelated; "we should be just showing the application images"): file, size, words under it */
const APP_PICS = [
    'phone' => ['roofing' => ['app-phone-roofing.jpg', 1120, 780, 'On the phone at the door: every property best first, with the hail, wind, roof size and year built that make it worth the knock.'],
                'yards' => ['app-phone-yards.jpg', 1120, 780, 'On the phone at the property: the lawn measured and outlined on the lot before you knock.']],
    'computer' => ['roofing' => ['app-computer-roofing.jpg', 1120, 730, 'On the computer: the neighborhood map, the list and the property card side by side.'],
                   'yards' => ['app-computer-yards.jpg', 1120, 730, 'On the computer: leads, estimates, jobs and money in, from the app\'s own records.']],
    'both' => ['roofing' => ['app-both-roofing.jpg', 1120, 700, 'The same app on the phone in the field and the computer in the office.'],
               'yards' => ['app-both-yards.jpg', 1120, 700, 'The same app on the phone in the field and the computer in the office.']],
];
/** the picture block for an app style and trade, in mapFor's shape (url, text, w, h, alt) */
function appPic(string $style, string $trade): ?array {
    $set = APP_PICS[$style] ?? null; if (!$set) return null;
    $p = $set[$trade] ?? null; if (!$p) return null;   /* a trade with no picture of its own goes plain (review 2026-10-31: pest, security and solar got the roofing picture and its roof caption) */
    return ['url' => deskBase() . '/m/' . $p[0], 'w' => $p[1], 'h' => $p[2], 'text' => $p[3], 'alt' => 'The Traverse app', 'city' => ''];
}
const MAP_FAMILY = ['roofing' => 'hail', 'roofing solar' => 'hail', 'solar' => 'hail', 'pest' => 'moved', 'security' => 'moved', 'yards' => 'lawn'];
function mapsIndex(): array { static $m = null; if ($m === null) { $j = json_decode((string) @file_get_contents(dirname(__DIR__) . '/m/maps.json'), true); $m = is_array($j['cities'] ?? null) ? $j['cities'] : []; } return $m; }
function citySlug(string $c): string { return trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower(trim($c))), '-'); }
/** where the desk is on the web: https://traverseplatforms.com/prospects-47bfe6 (images and the unsubscribe link hang off it) */
function deskOrigin(): string {
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'traverseplatforms.com');
    $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || !preg_match('/^(127\.|localhost)/', $host) ? 'https' : 'http';
    return $proto . '://' . $host;
}
function deskBase(): string { return deskOrigin() . rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/api/desk.php'), 2)), '/'); }
/** the map for a trade in a city, or null */
function mapFor(string $trade, string $city): ?array {
    $fam = MAP_FAMILY[$trade] ?? ''; $c = mapsIndex()[citySlug($city)] ?? null;
    if ($fam === '' || !$c || empty($c[$fam]['f']) || !is_file(dirname(__DIR__) . '/m/' . basename((string) $c[$fam]['f']))) return null;
    return $c[$fam] + ['city' => (string) $c['name'], 'url' => deskBase() . '/m/' . rawurlencode(basename((string) $c[$fam]['f']))];
}
/* text to HTML: escaped, with web addresses, emails and phone numbers as plain links (the address shown is the address it opens) */
function linkify(string $s, string $style): string {
    $s = htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return (string) preg_replace_callback('~\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b|\b((?:https?://)?(?:[a-z0-9-]+\.)+(?:com|net|org|us|co|io)(?:/[^\s<>()]*[^\s<>().,;:!?])?)|(\(\d{3}\)\s?\d{3}-\d{4})~i', function ($m) use ($style) {
        if (($m[1] ?? '') !== '') return '<a href="mailto:' . $m[1] . '" style="' . $style . '">' . $m[1] . '</a>';
        if (($m[2] ?? '') !== '') return '<a href="' . (preg_match('~^https?://~i', $m[2]) ? $m[2] : 'https://' . $m[2]) . '" style="' . $style . '">' . $m[2] . '</a>';
        return '<a href="tel:+1' . preg_replace('/\D/', '', $m[3]) . '" style="' . $style . '">' . $m[3] . '</a>';
    }, $s);
}
/** the HTML version: a personal note, not a newsletter (no banner, no buttons); reads the same with images off */
function mailHtml(string $main, array $set, array $map, string $unsubUrl): string {
    $font = 'font-family:Arial,Helvetica,sans-serif;';
    $a = 'color:#13294B;text-decoration:underline'; $blocks = []; $listAt = -1;
    foreach (preg_split("/\n{2,}/", trim($main)) as $p) {
        $lines = explode("\n", trim($p));
        if (count(array_filter($lines, fn($x) => preg_match('/^\s*[-*\x{2022}]\s+/u', $x))) === count($lines)) {
            $li = array_map(fn($x) => '<li style="margin:0 0 4px">' . linkify((string) preg_replace('/^\s*[-*\x{2022}]\s+/u', '', $x), $a) . '</li>', $lines);
            $blocks[] = '<ul style="margin:0 0 14px;padding:0 0 0 22px">' . implode('', $li) . '</ul>'; if ($listAt < 0) $listAt = count($blocks) - 1;
        } else $blocks[] = '<p style="margin:0 0 14px">' . implode('<br>', array_map(fn($x) => linkify($x, $a), $lines)) . '</p>';
    }
    $w = (int) ($map['w'] ?? 840); $h = (int) ($map['h'] ?? 588); $hh = (int) round(560 * $h / max(1, $w));
    $fig = '<div style="margin:4px 0 18px"><img src="' . htmlspecialchars((string) $map['url'], ENT_QUOTES) . '" width="560" height="' . $hh . '" alt="' . htmlspecialchars((string) $map['alt'], ENT_QUOTES) . '"'
         . ' style="display:block;width:100%;max-width:560px;height:auto;border:1px solid #DCE2EA;border-radius:8px;background:#F4F6F9;' . $font . 'font-size:13px;line-height:18px;color:#566476">'
         . '<div style="font-size:13px;line-height:18px;color:#566476;margin-top:6px">' . htmlspecialchars((string) $map['text'], ENT_QUOTES) . '</div></div>';
    $at = $listAt >= 0 ? $listAt + 1 : (count($blocks) >= 3 ? 2 : max(0, count($blocks) - 1));   /* under the list of what the house cards show, else after the second paragraph */
    array_splice($blocks, $at, 0, [$fig]);
    $sig = array_values(array_filter(array_map('trim', explode("\n", trim((string) $set['signature']))), 'strlen'));
    $sl = '';
    foreach ($sig as $i => $x) $sl .= $i === 0 ? '<div style="font-size:15px;font-weight:bold;color:#13294B;line-height:20px">' . htmlspecialchars($x, ENT_QUOTES) . '</div>'
                                             : '<div style="font-size:13px;color:#566476;line-height:19px">' . linkify($x, 'color:#13294B;text-decoration:none') . '</div>';
    if (trim((string) $set['address']) !== '') $sl .= '<div style="font-size:12px;color:#8590A0;line-height:18px">' . htmlspecialchars(trim((string) $set['address']), ENT_QUOTES) . '</div>';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title></title></head>'
         . '<body style="margin:0;padding:0;background:#FFFFFF">'
         . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF"><tr><td style="padding:16px">'
         . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;' . $font . 'font-size:15px;line-height:22px;color:#0F1B2D"><tr><td>'
         . '<img src="' . htmlspecialchars(deskBase() . '/m/traverse-wordmark.png', ENT_QUOTES) . '" width="128" height="24" alt="Traverse" style="display:block;border:0;margin:0 0 20px;' . $font . 'font-size:18px;font-weight:bold;color:#13294B">'
         . implode('', $blocks)
         . '<div style="margin:22px 0 0">' . $sl . '</div>'
         . '<img src="' . htmlspecialchars(deskBase() . '/m/traverse-wordmark.png', ENT_QUOTES) . '" width="112" height="21" alt="Traverse" style="display:block;border:0;margin:16px 0 0;' . $font . 'font-size:15px;font-weight:bold;color:#13294B">'   /* the logo under the signature (2026-10-30, Matthew: he missed it at the bottom) */   /* just his signature, once (Matthew 2026-10-30: the logo-and-bar block doubled the footer; he has his own signature) */
         . '<p style="margin:22px 0 0;font-size:12px;line-height:18px;color:#8590A0">Unsubscribe: <a href="' . htmlspecialchars($unsubUrl, ENT_QUOTES) . '" style="color:#8590A0;text-decoration:underline">' . htmlspecialchars($unsubUrl, ENT_QUOTES) . '</a></p>'
         . '</td></tr></table></td></tr></table></body></html>';
}
/** why a company cannot be emailed ('' = it can) */
function noMail(array $l): string {
    if (empty($l['email']) || !filter_var($l['email'], FILTER_VALIDATE_EMAIL)) return 'no email';
    /* 1 Nov: three bounces from round 3 passed the check above: a website's placeholder (sample@gmail.com) and a scraped "%20" in front */
    if (preg_match('/%[0-9a-f]{2}|^(sample|example|test|your|yourname|name|someone)@|@(example|domain|yourdomain)\./i', $l['email'])) return 'placeholder or broken address';
    if (!empty($l['unsub'])) return 'asked not to be emailed';
    if (($l['emailOk'] ?? '') === 'no') return 'email address cannot take mail';
    if (in_array($l['status'], OFF, true) || $l['status'] === 'customer') return 'knocked off or a customer';
    return '';
}
function sentToday(): int { $d = date('Y-m-d'); $n = 0; foreach (logRows() as $r) if (($r['t'] ?? '') === 'sent' && date('Y-m-d', (int) $r['at']) === $d) $n++; return $n; }
function mailCfg(): array {
    $c = ['host' => 'smtp.gmail.com', 'port' => 587, 'user' => 'm.sharpe@traverseplatforms.com', 'pass' => '', 'from_name' => 'Matthew Sharpe', 'timeout' => 15, 'ehlo' => 'traverseplatforms.com'];
    $f = dirname(__DIR__, 3) . '/traverse-site-private/site-config.php';   /* the same Gmail sender as the website's demo bookings */
    $own = is_file($f) ? (include $f) : [];
    if (is_array($own['smtp'] ?? null)) foreach (['host', 'port', 'user', 'pass', 'timeout', 'ehlo'] as $k) if (isset($own['smtp'][$k])) $c[$k] = $own['smtp'][$k];
    $c['pass'] = preg_replace('/\s+/', '', (string) $c['pass']);
    return $c;
}
function mimeH(string $s): string { return preg_match('/[\x80-\xFF]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s; }
/** the message as it goes over the wire (headers and body, before dot-stuffing): plain text alone, or with $html both parts as
    multipart/alternative, the plain text first and the HTML last (mail apps show the last part they can) */
function mailPayload(array $s, string $to, string $subject, string $body, array $extra, string $html): string {
    $eol = "\r\n";
    $h = ['Date: ' . date('r'), 'From: ' . mimeH($s['from_name']) . ' <' . $s['user'] . '>', 'To: ' . $to, 'Subject: ' . mimeH($subject),
          'Message-ID: <' . bin2hex(random_bytes(12)) . '@traverseplatforms.com>', 'MIME-Version: 1.0'];
    foreach ($extra as $x) { $x = trim(preg_replace('/[\r\n]+/', ' ', (string) $x)); if ($x !== '') $h[] = $x; }
    $part = fn(string $type, string $t) => 'Content-Type: ' . $type . '; charset=UTF-8' . $eol . 'Content-Transfer-Encoding: base64' . $eol . $eol . chunk_split(base64_encode($t), 76, $eol);
    if ($html === '') return implode($eol, $h) . $eol . $part('text/plain', $body);
    $bd = 'tv-' . bin2hex(random_bytes(12));
    return implode($eol, $h) . $eol . 'Content-Type: multipart/alternative; boundary="' . $bd . '"' . $eol . $eol
         . '--' . $bd . $eol . $part('text/plain', $body) . '--' . $bd . $eol . $part('text/html', $html) . '--' . $bd . '--' . $eol;
}
/** one message to one address (see mailPayload); never throws. DESK_MAIL_MOCK writes it to a file instead, with the raw message (tests). */
function mailSend(string $to, string $subject, string $body, array $extra, string $html = ''): array {
    $mock = getenv('DESK_MAIL_MOCK');
    if ($mock) { file_put_contents($mock, json_encode(['at' => time(), 'to' => $to, 'subject' => $subject, 'body' => $body, 'html' => $html, 'headers' => $extra, 'raw' => mailPayload(mailCfg(), $to, $subject, $body, $extra, $html)]) . "\n", FILE_APPEND | LOCK_EX); return ['ok' => true, 'stage' => 'mock', 'error' => '']; }
    $s = mailCfg(); $fail = fn($st, $e) => ['ok' => false, 'stage' => $st, 'error' => $e];
    if ($s['pass'] === '') return $fail('config', 'no Gmail app password in traverse-site-private/site-config.php');
    $fp = @stream_socket_client('tcp://' . $s['host'] . ':' . (int) $s['port'], $errno, $errstr, (int) $s['timeout']);
    if (!$fp) return $fail('connect', trim($errno . ' ' . $errstr));
    stream_set_timeout($fp, (int) $s['timeout']);
    $read = function () use ($fp): array { $lines = []; while (true) { $l = @fgets($fp, 2048); if ($l === false) return [0, 'connection closed']; $lines[] = rtrim($l, "\r\n"); if (strlen($l) < 4 || $l[3] !== '-') break; } $last = (string) end($lines); return [(int) substr($last, 0, 3), implode(' | ', $lines)]; };
    $w = function (string $cmd) use ($fp) { @fwrite($fp, $cmd . "\r\n"); };
    $quit = function () use ($fp) { @fwrite($fp, "QUIT\r\n"); @fclose($fp); };
    [$code, $rep] = $read(); if ($code !== 220) { $quit(); return $fail('greeting', $rep); }
    $w('EHLO ' . $s['ehlo']); [$code, $rep] = $read(); if ($code !== 250) { $quit(); return $fail('ehlo', $rep); }
    $w('STARTTLS'); [$code, $rep] = $read(); if ($code !== 220) { $quit(); return $fail('starttls', $rep); }
    $cm = STREAM_CRYPTO_METHOD_TLS_CLIENT; if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) $cm |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT; if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) $cm |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
    if (@stream_socket_enable_crypto($fp, true, $cm) !== true) { $quit(); return $fail('starttls', 'TLS negotiation failed'); }
    $w('EHLO ' . $s['ehlo']); [$code, $rep] = $read(); if ($code !== 250) { $quit(); return $fail('ehlo-tls', $rep); }
    $w('AUTH LOGIN'); [$code, $rep] = $read(); if ($code !== 334) { $quit(); return $fail('auth', $rep); }
    $w(base64_encode($s['user'])); [$code, $rep] = $read(); if ($code !== 334) { $quit(); return $fail('auth', $rep); }
    $w(base64_encode($s['pass'])); [$code, $rep] = $read(); if ($code !== 235) { $quit(); return $fail('auth', $rep); }
    $w('MAIL FROM:<' . $s['user'] . '>'); [$code, $rep] = $read(); if ($code !== 250) { $quit(); return $fail('from', $rep); }
    $w('RCPT TO:<' . $to . '>'); [$code, $rep] = $read(); if ($code !== 250 && $code !== 251) { $quit(); return $fail('to', $rep); }
    $w('DATA'); [$code, $rep] = $read(); if ($code !== 354) { $quit(); return $fail('data', $rep); }
    $eol = "\r\n";
    $payload = preg_replace('/^\./m', '..', mailPayload($s, $to, $subject, $body, $extra, $html));
    @fwrite($fp, $payload . $eol . '.' . $eol); [$code, $rep] = $read(); $quit();
    return $code === 250 ? ['ok' => true, 'stage' => 'sent', 'error' => ''] : $fail('data', $rep);
}
/** the cron job: send up to $max waiting messages, any day and hour (DESK_HOURS=1: weekdays 8 to 5 only), within today's cap; 0 = fine */
function sendQueue(int $max): int {
    $lk = fopen(DATA_DIR . '/queue.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX | LOCK_NB)) { echo "another run is sending\n"; return 0; }
    $h = (int) date('G'); $dow = (int) date('N');
    if (getenv('DESK_HOURS') && ($dow > 5 || $h < 8 || $h >= 17)) { echo "not sending hours\n"; return 0; }   /* any hour by default since 2026-10-30 (Matthew) */
    /* a one-off hold (2026-10-28, Matthew: "push traverse email send outs to 10am tomorrow"): send-after.txt holds a time; nothing goes before it */
    $hold = trim((string) @file_get_contents(DATA_DIR . '/send-after.txt'));
    if (ctype_digit($hold) && time() < (int) $hold) { echo 'held until ' . date('D j M g:i a', (int) $hold) . "\n"; return 0; }
    $gap = getenv('DESK_GAP') !== false ? max(0, (int) getenv('DESK_GAP')) : 120;
    $sentN = 0;
    for ($i = 0; $i < $max; $i++) {
        $S = state(); $set = $S['settings'];
        if (trim((string) $set['address']) === '') { echo "no postal address: not sending\n"; break; }
        if (sentToday() >= max(1, min(CAP_MAX, (int) $set['cap']))) { echo "today's cap reached\n"; break; }
        /* the pop under the same lock the desk's Queue and Clear take (review 2026-10-31: a Queue tap during a run could lose the new batch, or
           put a just-popped message back and send it twice) */
        $qa = fopen(DATA_DIR . '/queue.lock.add', 'c'); flock($qa, LOCK_EX);
        $Q = jread('queue.json', []); if (!$Q) { flock($qa, LOCK_UN); echo "nothing waiting\n"; break; }
        $m = array_shift($Q); jwrite('queue.json', $Q); flock($qa, LOCK_UN);
        $l = $S['leads'][$m['id']] ?? null;
        $why = $l ? noMail($l) : 'company gone';
        if ($l && $why === '' && strtolower((string) $l['email']) !== strtolower((string) $m['to'])) $why = 'email changed since it was queued';
        if ($why !== '') { logAdd(['t' => 'skipped', 'id' => $m['id'], 'why' => $why, 'by' => 'queue', 'at' => time()]); $i--; continue; }   /* a skip costs no send */
        if ($sentN > 0 && $gap) sleep($gap);
        $r = mailSend($m['to'], $m['subject'], $m['body'], [], trackLinks((string) ($m['html'] ?? ''), (string) $m['id']));   /* links counted (2026-10-30) */   /* no bulk-mail headers (2026-10-29): Gmail reads them as a newsletter (Promotions tab); they are only required from 5,000+ emails a day. html: queued "With map" (2026-10-30) */
        if ($r['ok']) {
            logAdd(['t' => 'sent', 'id' => $m['id'], 'to' => $m['to'], 'subject' => $m['subject'], 'by' => $m['by'], 'at' => time()]);
            if ($l['status'] === 'new') logAdd(['t' => 'status', 'id' => $m['id'], 'status' => 'emailed', 'by' => $m['by'], 'at' => time()]);
            $sentN++;
        } else {
            $m['tries'] = (int) ($m['tries'] ?? 0) + 1;
            logAdd(['t' => 'sendfail', 'id' => $m['id'], 'stage' => $r['stage'], 'error' => mb_substr((string) $r['error'], 0, 200), 'by' => 'queue', 'at' => time()]);
            if ($m['tries'] < 3 && in_array($r['stage'], ['connect', 'greeting', 'ehlo', 'starttls', 'ehlo-tls', 'data'], true)) { flock($qa, LOCK_EX); $Q = jread('queue.json', []); $Q[] = $m; jwrite('queue.json', $Q); flock($qa, LOCK_UN); }   /* the mail server, not the address: try later */
            if (in_array($r['stage'], ['config', 'auth'], true)) { echo "mail login problem: stopped\n"; flock($qa, LOCK_EX); $Q = jread('queue.json', []); array_unshift($Q, $m); jwrite('queue.json', $Q); flock($qa, LOCK_UN); break; }
        }
    }
    echo "sent $sentN\n"; flock($lk, LOCK_UN); return 0;
}

/* ---- the command line: accounts, the send job ---- */
if (PHP_SAPI === 'cli') {
    [$cmd, $name, $role] = [$argv[1] ?? '', $argv[2] ?? '', $argv[3] ?? 'admin'];
    if ($cmd === 'addaccount' && $name !== '' && in_array($role, ['admin', 'seller'], true)) {
        $acc = jread('accounts.json', ['codes' => []]);
        do { $code = (string) random_int(100000, 999999); } while (isset($acc['codes'][codeHash($code)]));
        $acc['codes'][codeHash($code)] = ['name' => clean($name, 40), 'role' => $role, 'at' => time()];
        jwrite('accounts.json', $acc); echo "Code for $name ($role): $code\n"; exit(0);
    }
    if ($cmd === 'sendqueue') exit(sendQueue(max(1, min(20, (int) ($name ?: 10)))));
    fwrite(STDERR, "usage: php desk.php addaccount \"Name\" admin|seller | sendqueue [max]\n"); exit(1);
}

$action = (string) ($_GET['action'] ?? '');
/* ---- unsubscribe: no sign-in (the link in every email, and the one-click button mail apps show) ---- */
if ($action === 'go') {   /* a click on the email's homepage or demo link (2026-10-30): log it, then forward at once */
    $id = (string) ($_GET['id'] ?? ''); $to = (string) ($_GET['to'] ?? ''); $tk = (string) ($_GET['t'] ?? '');
    $dest = GO_TO[$to] ?? GO_TO['home'];
    if (isset(GO_TO[$to]) && preg_match('/^[a-z0-9]{6,24}$/', $id) && hash_equals(goToken($id, $to), $tk)) {
        $S = state(); $l = $S['leads'][$id] ?? null;
        if ($l) {
            $sentAt = 0; foreach ((array) ($l['sent'] ?? []) as $x) $sentAt = max($sentAt, (int) (is_array($x) ? ($x['at'] ?? 0) : 0));
            $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
            $scan = ($sentAt && time() - $sentAt < 60) || $ua === '' || preg_match('/bot|crawler|spider|preview|scanner|safelinks|barracuda|mimecast|proofpoint|urldefense|google-?image|facebookexternalhit|slackbot|curl|wget|python|java\//i', $ua);
            logAdd(['t' => $scan ? 'scan' : 'click', 'id' => $id, 'to' => $to, 'by' => 'the company', 'at' => time()]);
        }
    }
    header('Location: ' . $dest . '?utm_source=email&utm_medium=prospect&utm_campaign=launch', true, 302); exit;
}
if ($action === 'unsub') {
    $id = (string) ($_GET['id'] ?? ''); $tk = (string) ($_GET['t'] ?? '');
    if ($id === 'testmsg' && hash_equals(unsubToken($id), $tk)) {   /* the link in a test email (2026-10-28): it works, and takes nobody off */
        if ($_SERVER['REQUEST_METHOD'] === 'POST') { header('Content-Type: text/plain; charset=utf-8'); echo 'Test: nobody unsubscribed.'; exit; }
        header('Content-Type: text/html; charset=utf-8'); header('X-Robots-Tag: noindex');
        echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Traverse</title><body style="margin:0;font:16px/1.5 system-ui,sans-serif;background:#f4f6f9;color:#0f1b2d;display:grid;place-items:center;min-height:100vh;padding:16px;text-align:center"><div><p style="font-size:20px;font-weight:700;margin:0 0 6px">The unsubscribe link works</p><p style="margin:0">This was a test email, so nobody was taken off the list. On a real email this page tells the company they are unsubscribed.</p></div>'; exit;
    }
    $S = state(); $ok = preg_match('/^[a-z0-9]{6,24}$/', $id) && isset($S['leads'][$id]) && hash_equals(unsubToken($id), $tk);
    /* the link itself only shows the page; the button on it (one tap, a POST) takes the company off. Review 2026-10-31: mail scanners
       (Safelinks, Proofpoint and the like) open every link in a message as it lands, and a GET that unsubscribed was taking companies off
       before anyone had read the email. */
    $post = $_SERVER['REQUEST_METHOD'] === 'POST';
    if ($post && $ok && empty($S['leads'][$id]['unsub'])) logAdd(['t' => 'unsub', 'id' => $id, 'by' => 'the company', 'at' => time()]);
    if ($post && !empty($_SERVER['HTTP_X_DESK'])) { header('Content-Type: text/plain; charset=utf-8'); echo $ok ? 'Unsubscribed.' : 'Link not recognised.'; exit; }
    header('Content-Type: text/html; charset=utf-8'); header('X-Robots-Tag: noindex');
    $h = fn(string $s) => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Traverse</title>'
       . '<body style="margin:0;font:16px/1.5 system-ui,sans-serif;background:#f4f6f9;color:#0f1b2d;display:grid;place-items:center;min-height:100vh;padding:16px;text-align:center"><div>'
       . (!$ok ? '<p style="font-size:20px;font-weight:700;margin:0 0 6px">That link did not work</p><p style="margin:0">Reply to the email with "no thanks" and we will take you off the list.</p>'
          : ($post || !empty($S['leads'][$id]['unsub']) ? '<p style="font-size:20px;font-weight:700;margin:0 0 6px">You are unsubscribed</p><p style="margin:0">Traverse will not email you again. Sorry for the bother.</p>'
             : '<p style="font-size:20px;font-weight:700;margin:0 0 6px">Unsubscribe from Traverse emails?</p><p style="margin:0 0 14px">One tap and we will not email you again.</p>'
               . '<form method="post" action="' . $h((string) ($_SERVER['SCRIPT_NAME'] ?? '/api/desk.php')) . '?action=unsub&amp;id=' . $h($id) . '&amp;t=' . $h($tk) . '">'
               . '<button type="submit" style="font:700 16px system-ui,sans-serif;background:#0f1b2d;color:#fff;border:0;border-radius:10px;padding:12px 22px">Unsubscribe</button></form>'))
       . '</div>';
    exit;
}

header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
function out(array $a): void {
    $j = (string) json_encode($a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    /* the full list is about 4 MB as text, 0.3 MB packed: packed here with its length, so no browser waits on a stream (2026-10-26) */
    if (strlen($j) > 20000 && function_exists('gzencode') && str_contains((string) ($_SERVER['HTTP_ACCEPT_ENCODING'] ?? ''), 'gzip')) { $j = (string) gzencode($j, 5); header('Content-Encoding: gzip'); header('Vary: Accept-Encoding'); }
    header('Content-Length: ' . strlen($j)); echo $j; exit;
}
function fail(string $m, int $code = 400): void { http_response_code($code); out(['ok' => false, 'error' => $m]); }
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$body = $isPost ? (json_decode((string) file_get_contents('php://input'), true) ?: []) : [];
if ($isPost && ($_SERVER['HTTP_X_DESK'] ?? '') !== '1') fail('Bad request.', 400);   /* a plain form post from another site cannot set this header */

/* ---- sign-in ---- */
$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
if ($action === 'signin') {
    if (!$isPost) fail('POST required', 405);
    $tries = jread('tries.json', []); $now = time();
    $mine = array_values(array_filter($tries[$ip] ?? [], fn($t) => $t > $now - 900));
    if (count($mine) >= 10) fail('Too many tries. Wait 15 minutes.', 429);
    $recent = 0; foreach ($tries as $k => $ts) { $tries[$k] = array_values(array_filter((array) $ts, fn($t) => $t > $now - 3600)); if (!$tries[$k]) unset($tries[$k]); else $recent += count($tries[$k]); }
    if ($recent >= 100) fail('Sign-in is paused for a while after too many wrong codes. Try again later.', 429);
    $code = preg_replace('/\D/', '', (string) ($body['code'] ?? ''));
    $acc = jread('accounts.json', ['codes' => []]); $a = $acc['codes'][codeHash($code)] ?? null;
    if (!$a || strlen($code) !== 6) { $mine[] = $now; $tries[$ip] = $mine; jwrite('tries.json', $tries); fail('That code did not work.', 401); }
    $tok = bin2hex(random_bytes(24)); $ses = jread('sessions.json', []);
    foreach ($ses as $k => $s) if (($s['at'] ?? 0) < $now - 60 * 86400) unset($ses[$k]);
    $ses[hash('sha256', $tok)] = ['name' => $a['name'], 'role' => $a['role'], 'at' => $now]; jwrite('sessions.json', $ses);
    setcookie('prospectdesk', $tok, ['expires' => $now + 60 * 86400, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
    out(['ok' => true, 'name' => $a['name'], 'role' => $a['role']]);
}
$ses = jread('sessions.json', []); $tokH = hash('sha256', (string) ($_COOKIE['prospectdesk'] ?? '')); $me = $ses[$tokH] ?? null;
if (!$me) fail('Signed out.', 401);
$ME = (string) $me['name'];
if ($action === 'signout') { unset($ses[$tokH]); jwrite('sessions.json', $ses); setcookie('prospectdesk', '', ['expires' => 1, 'path' => '/']); out(['ok' => true]); }
if ($action === 'me') out(['ok' => true, 'name' => $ME, 'role' => $me['role']]);

function needLead(array $S, string $id): array { if (!preg_match('/^[a-z0-9]{6,24}$/', $id) || !isset($S['leads'][$id])) fail('No such company.', 404); return $S['leads'][$id]; }
function okDay(string $d): bool { return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $d); }
function okPhone(string $p): string { $d = preg_replace('/\D/', '', $p); if ($p === '') return ''; if (strlen($d) === 11 && $d[0] === '1') $d = substr($d, 1); if (strlen($d) !== 10) fail('That phone number does not look right.'); return '(' . substr($d, 0, 3) . ') ' . substr($d, 3, 3) . '-' . substr($d, 6); }
function okSite(string $s): string { if ($s === '') return ''; if (!preg_match('#^(https?://)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(/\S*)?$#i', $s)) fail('That website does not look right.'); return $s; }
function unsubUrl(string $id): string { return deskOrigin() . (string) ($_SERVER['SCRIPT_NAME'] ?? '/api/desk.php') . '?action=unsub&id=' . $id . '&t=' . unsubToken($id); }
function queueView(array $S): array {
    $Q = jread('queue.json', []); $recent = [];
    foreach (array_reverse(logRows()) as $r) { $t = $r['t'] ?? ''; if (!in_array($t, ['sent', 'sendfail', 'skipped'], true)) continue; $recent[] = ['t' => $t, 'id' => $r['id'], 'name' => $S['leads'][$r['id']]['name'] ?? '', 'at' => $r['at'], 'subject' => $r['subject'] ?? '', 'why' => $r['why'] ?? ($r['stage'] ?? '')]; if (count($recent) >= 60) break; }
    return ['waiting' => count($Q), 'next' => array_map(fn($m) => ['id' => $m['id'], 'name' => $S['leads'][$m['id']]['name'] ?? '', 'to' => $m['to']], array_slice($Q, 0, 8)), 'sentToday' => sentToday(), 'recent' => $recent, 'mailbox' => mailCfg()['user']];
}

if ($action === 'data') {
    $S = state(); $queued = array_flip(array_column(jread('queue.json', []), 'id'));
    $leads = []; foreach ($S['leads'] as $l) { $l['queued'] = isset($queued[$l['id']]); $l['nomail'] = noMail($l); unset($l['log']); $leads[] = $l; }
    out(['ok' => true, 'me' => ['name' => $ME, 'role' => $me['role']], 'statuses' => STATUSES, 'trades' => TRADES, 'leads' => $leads, 'templates' => $S['templates'], 'settings' => $S['settings'], 'queue' => queueView($S), 'capMax' => CAP_MAX]);
}
if ($action === 'history') { $S = state(); $L = needLead($S, (string) ($_GET['id'] ?? '')); out(['ok' => true, 'log' => array_slice(array_reverse($L['log']), 0, 30)]); }
if ($ME === 'Claude Check') fail('This account only looks, so nothing is saved.', 403);
if (!$isPost) fail('POST required', 405);
$S = state();
switch ($action) {
    case 'status': {
        $id = (string) ($body['id'] ?? ''); needLead($S, $id); $st = (string) ($body['status'] ?? '');
        if (!isset(STATUSES[$st])) fail('Pick a status.');
        logAdd(['t' => 'status', 'id' => $id, 'status' => $st, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'reach': {   /* tick or untick a way we reached them (31 Oct) */
        $id = (string) ($body['id'] ?? ''); needLead($S, $id); $w = (string) ($body['way'] ?? '');
        if (!in_array($w, WAYS, true)) fail('Pick Emailed, Called or Messaged on Nextdoor.');
        logAdd(['t' => 'reach', 'id' => $id, 'way' => $w, 'on' => !empty($body['on']), 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'note': {
        $id = (string) ($body['id'] ?? ''); needLead($S, $id); $n = clean($body['note'] ?? '', 1000); if ($n === '') fail('Write the note first.');
        logAdd(['t' => 'note', 'id' => $id, 'note' => $n, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'notedel': {
        $id = (string) ($body['id'] ?? ''); $L = needLead($S, $id); $nk = (string) ($body['nk'] ?? '');
        if (!in_array($nk, array_column($L['notes'], 'k'), true)) fail('No such note.', 404);
        logAdd(['t' => 'notedel', 'id' => $id, 'nk' => $nk, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'next': {
        $id = (string) ($body['id'] ?? ''); needLead($S, $id); $d = (string) ($body['date'] ?? ''); $w = clean($body['what'] ?? '', 160);
        if ($d !== '' && !okDay($d)) fail('Pick a date.');
        logAdd(['t' => 'next', 'id' => $id, 'next' => $d === '' && $w === '' ? null : ['date' => $d, 'what' => $w], 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'edit': {
        /* the contact details, as Matthew learns them: who to ask for, phone, email, website */
        $id = (string) ($body['id'] ?? ''); $L = needLead($S, $id); $f = [];
        if (array_key_exists('person', $body)) $f['person'] = clean($body['person'], 80);
        if (array_key_exists('phone', $body)) $f['phone'] = okPhone(clean($body['phone'], 40));
        if (array_key_exists('email', $body)) { $e = strtolower(clean($body['email'], 120)); if ($e !== '' && !filter_var($e, FILTER_VALIDATE_EMAIL)) fail('That email does not look right.'); $f['email'] = $e; }
        if (array_key_exists('site', $body)) $f['site'] = okSite(clean($body['site'], 160));
        if (array_key_exists('nextdoor', $body)) { $u = clean($body['nextdoor'], 200); if ($u !== '' && !preg_match('#^https://(www\.)?nextdoor\.com/pages?/[A-Za-z0-9._~%-]+/?(\?\S*)?$#', $u)) fail('That is not a Nextdoor business page link (nextdoor.com/page/...).'); $f['nextdoor'] = $u; }   /* 31 Oct */
        foreach ($f as $k => $v) if ((string) ($L[$k] ?? '') === $v) unset($f[$k]);
        if (!$f) out(['ok' => true, 'same' => true]);
        logAdd(['t' => 'edit', 'id' => $id, 'f' => $f, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'lead': {
        /* a company added by hand */
        $n = clean($body['name'] ?? '', 100); if ($n === '') fail('Give the company name.');
        foreach ($S['leads'] as $x) if (strtolower(trim($x['name'])) === strtolower($n) && strtolower((string) $x['city']) === strtolower(clean($body['city'] ?? '', 60))) fail('That company is already on the list.');
        $tr = (string) ($body['trade'] ?? ''); if (!isset(TRADES[$tr])) fail('Pick the trade.');
        $e = strtolower(clean($body['email'] ?? '', 120)); if ($e !== '' && !filter_var($e, FILTER_VALIDATE_EMAIL)) fail('That email does not look right.');
        $id = substr(sha1('added|' . $n . '|' . microtime()), 0, 10);
        $lead = ['id' => $id, 'name' => $n, 'trade' => $tr, 'type' => '', 'city' => clean($body['city'] ?? '', 60), 'zip' => '', 'formed' => '', 'where' => clean($body['where'] ?? 'in our towns', 40),
                 'record' => '', 'phone' => okPhone(clean($body['phone'] ?? '', 40)), 'email' => $e, 'emailOk' => '', 'emailSrc' => $e !== '' ? 'desk' : '', 'site' => okSite(clean($body['site'] ?? '', 160)), 'place' => '', 'cat' => '', 'added' => true, 'person' => clean($body['person'] ?? '', 80)];
        logAdd(['t' => 'lead', 'id' => $id, 'lead' => $lead, 'by' => $ME, 'at' => time()]); out(['ok' => true, 'id' => $id]);
    }
    case 'template': {
        $tr = (string) ($body['trade'] ?? ''); if (!isset(TRADES[$tr])) fail('Pick the trade.');
        $sub = clean($body['subject'] ?? '', 160); $bd = cleanText($body['body'] ?? '', 4000);
        if ($sub === '' || $bd === '') fail('Give the template a subject and a message.');
        logAdd(['t' => 'template', 'trade' => $tr, 'subject' => $sub, 'body' => $bd, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'settings': {
        $s = [];
        if (array_key_exists('address', $body)) $s['address'] = cleanText($body['address'], 300);
        if (array_key_exists('signature', $body)) $s['signature'] = cleanText($body['signature'], 400);
        if (array_key_exists('cap', $body)) { $c = (int) $body['cap']; if ($c < 1 || $c > CAP_MAX) fail('Emails a day: 1 to ' . CAP_MAX . '.'); $s['cap'] = $c; }
        if (!$s) fail('Nothing to save.');
        logAdd(['t' => 'settings', 's' => $s, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'preview':
    case 'queue': {
        /* one message per company, exactly as it will go: the preview shows them, Queue puts them in line for the cron job */
        $ids = array_values(array_unique(array_filter(array_map('strval', (array) ($body['ids'] ?? [])), fn($x) => preg_match('/^[a-z0-9]{6,24}$/', $x))));
        if (!$ids) fail('Tick at least one company.');
        if (count($ids) > 2000) fail('At most 2,000 at a time.');
        $tplPick = (string) ($body['tpl'] ?? 'auto'); $tpl = $S['templates'];
        $style = (string) ($body['style'] ?? 'map'); if (!isset(STYLES[$style])) fail('Pick Plain or With map.');   /* per send (2026-10-30); With map unless Plain is picked (Matthew 30 Oct) */
        if ($tplPick !== 'auto') { if (!isset($tpl[$tplPick])) fail('Pick a template.'); $tpl = array_fill_keys(array_keys(TRADES), $tpl[$tplPick]); }
        $queued = array_flip(array_column(jread('queue.json', []), 'id')); $msgs = []; $skip = [];
        foreach ($ids as $id) {
            $l = $S['leads'][$id] ?? null; if (!$l) { $skip['not on the desk'] = ($skip['not on the desk'] ?? 0) + 1; continue; }
            $why = noMail($l); if ($why === '' && isset($queued[$id])) $why = 'already waiting to send';
            if ($why !== '') { $skip[$why] = ($skip[$why] ?? 0) + 1; continue; }
            $msgs[] = render($l, $tpl, $S['settings'], unsubUrl($id), $style, $tplPick !== 'auto' ? $tplPick : null);
        }
        if ($action === 'preview') out(['ok' => true, 'messages' => $msgs, 'skipped' => $skip, 'addressSet' => trim((string) $S['settings']['address']) !== '', 'style' => $style]);
        if (trim((string) $S['settings']['address']) === '') fail('Add your postal address in Settings first. The law wants it in every email like this, so sending stays off until it is there.');
        if (!$msgs) fail('None of those can be emailed.');
        foreach ($msgs as $m) if (!empty($m['badph'])) fail('The template still has ' . $m['badph'] . ' in it, which the email cannot fill. Fix it in Settings (the placeholders are {company}, {city}, {trade} and {first}).');
        $lk = fopen(DATA_DIR . '/queue.lock.add', 'c'); flock($lk, LOCK_EX);
        $Q = jread('queue.json', []);
        foreach ($msgs as $m) $Q[] = $m + ['unsub' => unsubUrl($m['id']), 'by' => $ME, 'at' => time()];
        jwrite('queue.json', $Q); flock($lk, LOCK_UN);
        logAdd(['t' => 'queued', 'n' => count($msgs), 'style' => $style, 'maps' => count(array_filter($msgs, fn($m) => $m['style'] === 'map')), 'by' => $ME, 'at' => time()]);
        out(['ok' => true, 'queued' => count($msgs), 'skipped' => $skip, 'waiting' => count($Q)]);
    }
    case 'sendtest': {
        /* one message to yourself, exactly as a company gets it (2026-10-28, Matthew: "how do i send myself an email from the prospects desk") */
        if ($me['role'] !== 'admin') fail('Only an admin can send a test.', 403);
        $to = strtolower(clean($body['to'] ?? '', 120)); if (!filter_var($to, FILTER_VALIDATE_EMAIL)) fail('Type the address to send the test to.');
        $tr = (string) ($body['trade'] ?? ''); if (!isset(TRADES[$tr], $S['templates'][$tr])) fail('Pick the trade whose message you want to see.');
        if (trim((string) $S['settings']['address']) === '') fail('Add your postal address in Settings first.');
        $n = 0; foreach (logRows() as $r) if (($r['t'] ?? '') === 'test' && (int) $r['at'] > time() - 86400) $n++;
        if ($n >= 20) fail('That is 20 tests in a day already. Try again tomorrow.');   /* 20 (was 10) while designs are being tried (2026-10-30, Matthew) */
        $style = (string) ($body['style'] ?? 'map'); if (!isset(STYLES[$style])) fail('Pick Plain or With map.');
        $city = clean($body['city'] ?? '', 60) ?: 'Denver';   /* the sample company's city (2026-10-30: the map is the city's) */
        $sample = ['id' => 'testmsg', 'name' => 'Sample ' . TRADES[$tr] . ' Co', 'city' => $city, 'trade' => $tr, 'person' => '', 'email' => $to];
        $u = unsubUrl('testmsg'); $m = render($sample, $S['templates'], $S['settings'], $u, $style);
        if (!empty($m['badph'])) fail('The template still has ' . $m['badph'] . ' in it, which the email cannot fill. Fix it in Settings (the placeholders are {company}, {city}, {trade} and {first}).');
        $m['subject'] .= isset(APP_PICS[$m['style']]) ? ' (' . strtolower(STYLES[$m['style']]) . ')' : ($m['style'] === 'map' ? ' (with map)' : ($style === 'map' ? ' (plain: no map for ' . $city . ')' : ' (plain)'));   /* a test says which version it is */
        $r = mailSend($to, $m['subject'], $m['body'], [], (string) ($m['html'] ?? ''));   /* as the queue sends it: no bulk-mail headers (2026-10-29) */
        logAdd(['t' => 'test', 'to' => $to, 'trade' => $tr, 'style' => $m['style'], 'city' => $city, 'ok' => $r['ok'], 'by' => $ME, 'at' => time()]);
        if (!$r['ok']) fail('The test did not go out (' . $r['stage'] . '): ' . mb_substr((string) $r['error'], 0, 160));
        out(['ok' => true, 'to' => $to, 'subject' => $m['subject'], 'style' => $m['style']]);
    }
    case 'queueclear': {
        /* stop: everything still waiting comes off; what was sent stays sent */
        $lk = fopen(DATA_DIR . '/queue.lock.add', 'c'); flock($lk, LOCK_EX);
        $n = count(jread('queue.json', [])); jwrite('queue.json', []); flock($lk, LOCK_UN);
        logAdd(['t' => 'queueclear', 'n' => $n, 'by' => $ME, 'at' => time()]); out(['ok' => true, 'cleared' => $n]);
    }
    case 'unsubmark': {
        /* someone replied "no thanks": Matthew marks it, the same as their own link */
        $id = (string) ($body['id'] ?? ''); $L = needLead($S, $id); if (!empty($L['unsub'])) out(['ok' => true]);
        logAdd(['t' => 'unsub', 'id' => $id, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
}
fail('Unknown action.', 404);
