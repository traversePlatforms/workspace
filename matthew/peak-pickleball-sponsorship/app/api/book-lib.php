<?php
/* Booking links (2026-11-19, Matthew for Cai: "a calendar feature built out, so that when she emails people like this or when follow up
 * emails are sent they can click a link and book a time slot based on the availability"; then: availability is NOT per person, one shared
 * schedule for the whole Peak desk).
 *
 *   - One schedule for the whole desk, in desk-settings.json (key "book"): the days and time ranges (Mountain time), the slot length, the
 *     notice, how far ahead, and blocked dates. Admins change it in More, Settings. Seeded with Mon, Wed, Fri 2:00-4:00 pm and Tue, Thu
 *     8:00 am-4:00 pm, 30-minute slots (the last starts at 3:30, so it ends by 4).
 *   - One booking per slot across the whole desk: a slot is gone once any tour (either list, booked from a link or typed on the desk)
 *     overlaps it. The booking itself happens under the desk's lock with the slots worked out again inside it, so two people can never
 *     take the same one.
 *   - The links only say who it came from: each desk person has a personal link (?p=), a desk email carries a link for that email (?m=),
 *     the Peak email sender's {book} carries one for that person on its list (?o=), and there is one general link (?g=). The person whose
 *     link or email it was becomes the tour's host (and the company's owner when nobody owns it) and sees it on Today; a general link has no
 *     host and alerts Matthew. Matthew gets a heads-up email for every booking, as the sender's b.php did.
 *   - The page (book.php, public at /peak-book/) shows only the open times: no names of companies, no other bookings, nothing of the desk.
 *   - OFF until an admin turns "Booking links" on in More, Settings. While off every link answers "Not taking bookings right now".
 *   - book-links.json (0600) holds the secret the links are signed with and a salt per person; "Make a new link" changes the salt.
 *     book-events.log: the page's views (bots marked), opens of a desk email (when the open image is on) and bookings.
 * A booking makes the tour on the right card (Meeting / tour booked, or Tour booked on the Expo leads), a new lead "Booked from link" when
 * the visitor is not on the desk, and sends the tour confirmation email with its invite when that switch is on. */
declare(strict_types=1);
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }

const BK_BASE = 'https://traverseplatforms.com/peak-book/';
const BK_DAYS = [1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun'];
const BK_MINS = [15, 20, 30, 45, 60, 90];
const BK_PHONE = '(719) 377-4725';
const BK_ADDRESS = 'Peak Pickleball, 1730 Briargate Blvd, Colorado Springs, CO 80920';
const BK_GENERIC_HOST = 'The Peak Pickleball team';

function bkTest(): bool { return PHP_SAPI === 'cli' || PHP_SAPI === 'cli-server'; }
/** where the public page is (the tests point it at their own server) */
function bkBase(): string { $e = bkTest() ? (string) getenv('DESK_BOOK_BASE') : ''; return $e !== '' ? $e : BK_BASE; }
function bkNow(): int { $e = bkTest() ? (string) getenv('DESK_NOW') : ''; return ctype_digit($e) ? (int) $e : time(); }

/* ---- the shared schedule ---- */
function bkDefaults(): array {
    return ['on' => false, 'week' => [1 => ['14:00-16:00'], 2 => ['08:00-16:00'], 3 => ['14:00-16:00'], 4 => ['08:00-16:00'], 5 => ['14:00-16:00']],
        'mins' => 30, 'notice' => 24, 'ahead' => 14, 'blocked' => []];
}
function bkConf(): array {
    $s = jread('desk-settings.json', [])['book'] ?? []; $d = bkDefaults(); $o = [];
    foreach ($d as $k => $v) $o[$k] = array_key_exists($k, $s) && $s[$k] !== null ? $s[$k] : $v;
    $o['on'] = !empty($o['on']); $o['mins'] = in_array((int) $o['mins'], BK_MINS, true) ? (int) $o['mins'] : 30;
    $o['notice'] = max(0, min(336, (int) $o['notice'])); $o['ahead'] = max(1, min(60, (int) $o['ahead']));
    $w = []; foreach ((array) $o['week'] as $k => $v) if (isset(BK_DAYS[(int) $k])) $w[(int) $k] = array_values((array) $v); ksort($w); $o['week'] = $w;
    $o['blocked'] = array_values(array_filter((array) $o['blocked'], fn($x) => okDay((string) $x)));
    return $o + ['by' => (string) ($s['by'] ?? ''), 'at' => (int) ($s['at'] ?? 0)];
}
/** "Mon 14:00-16:00" lines <-> [day => ["14:00-16:00", ...]] */
function bkWeekText(array $w): string { $o = []; foreach (BK_DAYS as $d => $n) if (!empty($w[$d])) $o[] = $n . ' ' . implode(', ', (array) $w[$d]); return implode("\n", $o); }
function bkWeekParse(string $t): ?array {
    $w = []; $days = array_flip(array_map('strtolower', BK_DAYS));
    foreach (preg_split('/\R/', trim($t)) ?: [] as $line) {
        $line = trim($line); if ($line === '') continue;
        if (!preg_match('/^([A-Za-z]{3})[a-z]*\.?\s+(.+)$/', $line, $m) || !isset($days[strtolower($m[1])])) return null;
        foreach (preg_split('/\s*,\s*/', trim($m[2])) ?: [] as $r) {
            if (!preg_match('/^([01]?\d|2[0-3]):([0-5]\d)\s*-\s*([01]?\d|2[0-3]):([0-5]\d)$/', $r, $x) || (int) $x[1] * 60 + (int) $x[2] >= (int) $x[3] * 60 + (int) $x[4]) return null;
            $w[$days[strtolower($m[1])]][] = sprintf('%02d:%02d-%02d:%02d', $x[1], $x[2], $x[3], $x[4]);
        }
    }
    ksort($w); return $w;
}
/** the hours in words, for the page and Settings: "Mon, Wed, Fri 2:00-4:00 pm · Tue, Thu 8:00 am-4:00 pm" */
function bkHoursText(array $week): string {
    $t = fn(string $hm) => date('g:i a', (int) strtotime('2026-01-01 ' . $hm));
    $g = []; foreach ($week as $d => $rs) { $k = implode(', ', array_map(function ($r) use ($t) { [$a, $b] = explode('-', $r); $x = $t($a); $y = $t($b); return substr($x, -2) === substr($y, -2) ? substr($x, 0, -3) . '-' . $y : $x . '-' . $y; }, (array) $rs)); $g[$k][] = BK_DAYS[$d]; }
    $o = []; foreach ($g as $k => $ds) $o[] = implode(', ', $ds) . ' ' . $k;
    return implode(' · ', $o);
}
/** the settings as typed in Settings: the cleaned schedule, or the reason it can't be saved */
function bkConfIn(array $in, array $cur): array {
    $o = $cur;
    if (array_key_exists('week', $in)) { $w = bkWeekParse((string) $in['week']); if ($w === null) return ['error' => 'The hours do not read right. One day a line, like "Tue 08:00-16:00" or "Mon 14:00-16:00, 17:00-18:00".']; if (!$w) return ['error' => 'Give at least one day with hours.']; $o['week'] = $w; }
    if (array_key_exists('mins', $in)) { if (!in_array((int) $in['mins'], BK_MINS, true)) return ['error' => 'Pick a meeting length.']; $o['mins'] = (int) $in['mins']; }
    if (array_key_exists('notice', $in)) { $n = (int) $in['notice']; if ($n < 0 || $n > 336) return ['error' => 'Notice is 0 to 336 hours.']; $o['notice'] = $n; }
    if (array_key_exists('ahead', $in)) { $n = (int) $in['ahead']; if ($n < 1 || $n > 60) return ['error' => 'How far ahead is 1 to 60 days.']; $o['ahead'] = $n; }
    if (array_key_exists('blocked', $in)) {
        $b = [];
        foreach (preg_split('/[\s,;]+/', trim(is_array($in['blocked']) ? implode(' ', $in['blocked']) : (string) $in['blocked'])) ?: [] as $d) { if ($d === '') continue; if (!okDay($d)) return ['error' => '“' . $d . '” is not a date: write it as 2026-11-26.']; $b[$d] = 1; }
        $b = array_keys($b); sort($b); $o['blocked'] = $b;
    }
    foreach ($o['week'] as $d => $rs) foreach ($rs as $r) { [$a, $z] = explode('-', $r); if ((int) strtotime('2026-01-01 ' . $z) - (int) strtotime('2026-01-01 ' . $a) < $o['mins'] * 60) return ['error' => BK_DAYS[$d] . ' ' . $r . ' is shorter than one meeting.']; }
    return $o;
}

/* ---- the open slots ---- */
/** every tour on the desk (both lists, not cancelled) as [start, end] */
function bkBusy(): array {
    $o = [];
    foreach (['sponsor', 'expo'] as $w) foreach (toursOf($w) as $t) {
        if (!okDay((string) ($t['date'] ?? '')) || !okTime((string) ($t['time'] ?? ''))) continue;
        $s = (int) strtotime($t['date'] . ' ' . $t['time']); $m = (int) ($t['mins'] ?? 0); $o[] = [$s, $s + ($m > 0 ? $m : 30) * 60];
    }
    return $o;
}
/** the open times, soonest first, at most $max: [["2026-11-24", "14:00"], ...] */
function bkSlots(int $max = 500, ?array $c = null): array {
    $c ??= bkConf(); $mins = (int) $c['mins']; $busy = bkBusy(); $o = [];
    $now = bkNow(); $earliest = $now + $c['notice'] * 3600; $day0 = (int) strtotime(date('Y-m-d', $now) . ' 00:00'); $blocked = array_flip($c['blocked']);
    for ($i = 0; $i <= $c['ahead']; $i++) {
        $d = (int) strtotime('+' . $i . ' days', $day0); $ds = date('Y-m-d', $d); if (isset($blocked[$ds])) continue;
        foreach ((array) ($c['week'][(int) date('N', $d)] ?? []) as $r) {
            [$f, $t] = explode('-', $r); $a = (int) strtotime($ds . ' ' . $f); $z = (int) strtotime($ds . ' ' . $t);
            for ($s = $a; $s + $mins * 60 <= $z; $s += $mins * 60) {
                if ($s < $earliest) continue;
                foreach ($busy as [$bs, $be]) if ($s < $be && $s + $mins * 60 > $bs) continue 2;
                $o[] = [$ds, date('H:i', $s)]; if (count($o) >= $max) return $o;
            }
        }
    }
    return $o;
}

/* ---- the links ---- */
function bkKeys(?callable $edit = null): ?array {
    $lk = fopen(DATA_DIR . '/book-links.lock', 'c'); if (!$lk) return null; flock($lk, LOCK_EX);
    try {
        $all = jread('book-links.json', []); $was = $all;
        if (empty($all['secret'])) $all['secret'] = bin2hex(random_bytes(16));
        if (empty($all['g']['salt'])) $all['g'] = ['salt' => bin2hex(random_bytes(8)), 'at' => time()];
        if ($edit) $all = $edit($all);
        if ($all !== $was) { if (!jwrite('book-links.json', $all)) return null; @chmod(DATA_DIR . '/book-links.json', 0600); }
        return $all;
    } finally { flock($lk, LOCK_UN); fclose($lk); }
}
function bkSecret(): string { static $s = null; if ($s === null) $s = (string) (bkKeys()['secret'] ?? ''); return $s; }
function bkSig(string $what, int $n = 16): string { return substr(hash_hmac('sha256', 'peakbook|' . $what, bkSecret()), 0, $n); }
function bkPid(string $name): string { return substr(sha1('peakdesk-book|' . strtolower(trim($name))), 0, 12); }
/** everyone who can host a booking: the desk's sellers and admins (and expo accounts), never the read-only check account */
function bkHosts(): array { return array_values(array_unique(array_merge(owners('sponsor'), owners('expo')))); }
/** a person's own link; $renew makes a new one and the old link stops working */
function bkLink(string $name, bool $renew = false): ?array {
    if (!in_array($name, bkHosts(), true)) return null;
    $pid = bkPid($name);
    $all = bkKeys(function (array $a) use ($pid, $name, $renew) { if ($renew || empty($a['p'][$pid]['salt'])) $a['p'][$pid] = ['name' => $name, 'salt' => bin2hex(random_bytes(8)), 'at' => time()]; return $a; });
    if (!$all) return null; $p = $all['p'][$pid];
    return ['url' => bkBase() . '?p=' . $pid . '-' . bkSig('p|' . $pid . '|' . $p['salt']), 'at' => (int) $p['at']];
}
/** the general link (no host: Matthew is alerted) */
function bkGeneric(bool $renew = false): ?array {
    $all = bkKeys(function (array $a) use ($renew) { if ($renew) $a['g'] = ['salt' => bin2hex(random_bytes(8)), 'at' => time()]; return $a; });
    if (!$all) return null; return ['url' => bkBase() . '?g=' . bkSig('g|' . $all['g']['salt']), 'at' => (int) $all['g']['at']];
}
/** the link in one desk email (it knows the company, the person and who wrote it) */
function bkMsgUrl(string $ref): string { return bkBase() . '?m=' . $ref . '-' . bkSig('m|' . $ref, 12); }
/** the open image of one desk email (only when the admin setting is on) */
function bkPixelUrl(string $ref): string { return bkBase() . '?px=' . $ref . '-' . bkSig('px|' . $ref, 12); }
/** the link for one person on the Peak email sender's lists ({book}): who and which company, signed */
function bkOutreachUrl(array $p): string {
    $x = []; foreach (['w', 'org', 'to', 'n', 'c', 'l', 'r'] as $k) $x[$k] = mb_substr((string) ($p[$k] ?? ''), 0, 120);
    $b = rtrim(strtr(base64_encode((string) json_encode($x, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)), '+/', '-_'), '=');
    return bkBase() . '?o=' . $b . '.' . bkSig('o|' . $b);
}
/** the desk email a ?m= link names: [world, record, the email] or null */
function bkMsg(string $ref): ?array {
    foreach (['sponsor', 'expo'] as $w) foreach (recs($w) as $R) if (isset($R['dmails'][$ref])) return [$w, $R, $R['dmails'][$ref]];
    return null;
}
/** what a link says: src p|g|m|o, host ('' = none), and what is known of the visitor; null when it is not a link of ours */
function bkParse(array $q): ?array {
    $hosts = bkHosts();
    if (isset($q['p']) && preg_match('/^([0-9a-f]{12})-([0-9a-f]{16})$/', (string) $q['p'], $m)) {
        $p = bkKeys()['p'][$m[1]] ?? null;
        if (!$p || !hash_equals(bkSig('p|' . $m[1] . '|' . $p['salt']), $m[2]) || !in_array((string) $p['name'], $hosts, true)) return null;
        return ['src' => 'p', 'key' => 'p=' . $q['p'], 'host' => (string) $p['name'], 'w' => '', 'id' => '', 'email' => '', 'name' => '', 'company' => '', 'ref' => ''];
    }
    if (isset($q['g']) && preg_match('/^[0-9a-f]{16}$/', (string) $q['g'])) {
        $g = bkKeys()['g'] ?? null; if (!$g || !hash_equals(bkSig('g|' . $g['salt']), (string) $q['g'])) return null;
        return ['src' => 'g', 'key' => 'g=' . $q['g'], 'host' => '', 'w' => '', 'id' => '', 'email' => '', 'name' => '', 'company' => '', 'ref' => ''];
    }
    if (isset($q['m']) && preg_match('/^(dm[0-9a-f]{10})-([0-9a-f]{12})$/', (string) $q['m'], $m)) {
        if (!hash_equals(bkSig('m|' . $m[1], 12), $m[2])) return null; $x = bkMsg($m[1]); if (!$x) return null;
        [$w, $R, $d] = $x; $by = (string) ($d['by'] ?? '');
        return ['src' => 'm', 'key' => 'm=' . $q['m'], 'host' => in_array($by, $hosts, true) ? $by : '', 'w' => $w, 'id' => (string) $R['id'], 'email' => (string) ($d['to'] ?? ''),
            'name' => (string) ($d['name'] ?? ''), 'company' => (string) $R['name'], 'ref' => $m[1], 'sentAt' => (int) ($d['sentAt'] ?? 0), 'off' => !empty($R['off'])];
    }
    if (isset($q['o']) && preg_match('/^([A-Za-z0-9_-]{10,1200})\.([0-9a-f]{16})$/', (string) $q['o'], $m)) {
        if (!hash_equals(bkSig('o|' . $m[1]), $m[2])) return null;
        $x = json_decode((string) base64_decode(strtr($m[1], '-_', '+/') . str_repeat('=', (4 - strlen($m[1]) % 4) % 4), true), true); if (!is_array($x)) return null;
        $w = ($x['w'] ?? '') === 'expo' ? 'expo' : 'sponsor'; $R = recs($w)[(string) ($x['org'] ?? '')] ?? null;
        return ['src' => 'o', 'key' => 'o', 'host' => '', 'w' => $w, 'id' => $R ? (string) $R['id'] : '', 'email' => strtolower((string) ($x['to'] ?? '')), 'name' => (string) ($x['n'] ?? ''),
            'company' => $R ? (string) $R['name'] : (string) ($x['c'] ?? ''), 'ref' => '', 'o' => $x, 'off' => $R ? !empty($R['off']) : false];
    }
    return null;
}

/* ---- the record of the page ---- */
function bkLog(array $r): void { @file_put_contents(DATA_DIR . '/book-events.log', jline($r + ['at' => bkNow()]), FILE_APPEND | LOCK_EX); }
function bkBot(string $ua, int $sentAt = 0): bool {
    return $ua === '' || ($sentAt > 0 && bkNow() - $sentAt >= 0 && bkNow() - $sentAt < 60)
        || (bool) preg_match('/bot|crawler|spider|preview|scanner|safelinks|barracuda|mimecast|proofpoint|urldefense|google-?image|facebookexternalhit|slackbot|curl|wget|python|java\/|go-http|headless/i', $ua);
}
/** views and opens per desk email, views and bookings per person: for the cards and My booking link */
function bkStats(): array {
    static $o = null; if ($o !== null) return $o;
    $o = ['ref' => [], 'host' => []];
    $fh = @fopen(DATA_DIR . '/book-events.log', 'r'); if (!$fh) return $o;
    while (($l = fgets($fh)) !== false) {
        $r = json_decode($l, true); if (!is_array($r)) continue; $t = (string) ($r['t'] ?? ''); $ref = (string) ($r['ref'] ?? ''); $h = (string) ($r['host'] ?? '');
        if ($t === 'view' && empty($r['bot'])) { if ($ref !== '') $o['ref'][$ref]['views'] = ($o['ref'][$ref]['views'] ?? 0) + 1; if ($h !== '') $o['host'][$h]['views'] = ($o['host'][$h]['views'] ?? 0) + 1; }
        if ($t === 'open' && $ref !== '') $o['ref'][$ref]['opens'] = ($o['ref'][$ref]['opens'] ?? 0) + 1;
        if ($t === 'booked') { if ($ref !== '') $o['ref'][$ref]['booked'] = ($o['ref'][$ref]['booked'] ?? 0) + 1; if ($h !== '') $o['host'][$h]['booked'] = ($o['host'][$h]['booked'] ?? 0) + 1; }
    }
    fclose($fh); return $o;
}
/** what the desk page gets */
function bkOut(bool $admin, string $me): array {
    $c = bkConf(); $s = bkStats()['host'][$me] ?? [];
    $o = ['on' => $c['on'], 'hours' => bkHoursText($c['week']), 'mins' => $c['mins'], 'notice' => $c['notice'], 'ahead' => $c['ahead'], 'blocked' => $c['blocked'], 'open' => count(bkSlots(1000, $c)),
        'views' => (int) ($s['views'] ?? 0), 'booked' => (int) ($s['booked'] ?? 0), 'canHost' => in_array($me, bkHosts(), true)];
    if ($admin) $o += ['week' => bkWeekText($c['week']), 'by' => $c['by'], 'at' => $c['at'], 'lens' => BK_MINS, 'defaults' => ['week' => bkWeekText(bkDefaults()['week']), 'mins' => 30, 'notice' => 24, 'ahead' => 14]];
    return $o;
}

/* ---- a booking ---- */
/** the company a visitor from a ?p= or ?g= link is: their email on a card, else the same name, else null (a new lead) */
function bkFind(string $w, string $email, string $company): ?array {
    $X = recs($w); $e = strtolower($email); $n = normName($company);
    foreach ($X as $R) if (empty($R['off']) && $e !== '' && in_array($e, recEmails($R), true)) return $R;
    if ($n !== '') foreach ($X as $R) if (empty($R['off']) && normName((string) $R['name']) === $n) return $R;
    return null;
}
/** book one slot. $in: slot "Y-m-d H:i", name, company, email, note, topic (sponsor|expo). Returns ['ok' => true, ...] or ['ok' => false, 'code' => taken|mine|bad|closed, 'why'] */
function bkBook(array $ctx, array $in): array {
    $c = bkConf(); if (!$c['on']) return ['ok' => false, 'code' => 'closed', 'why' => 'Not taking bookings right now.'];
    if (!preg_match('/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/', (string) ($in['slot'] ?? ''), $sm) || !okDay($sm[1]) || !okTime($sm[2])) return ['ok' => false, 'code' => 'bad', 'why' => 'Pick one of the times.'];
    $name = clean($in['name'] ?? '', 80); $email = strtolower(clean($in['email'] ?? '', 160)); $company = clean($in['company'] ?? '', 100); $note = clean($in['note'] ?? '', 400);
    if ($name === '') return ['ok' => false, 'code' => 'bad', 'why' => 'Give your name.'];
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return ['ok' => false, 'code' => 'bad', 'why' => 'Give an email that works: the confirmation goes there.'];
    $known = $ctx['id'] !== '' && empty($ctx['off']);
    if (!$known && $company === '') return ['ok' => false, 'code' => 'bad', 'why' => 'Give your company or organisation.'];
    $w = $known ? $ctx['w'] : (in_array($ctx['w'], ['sponsor', 'expo'], true) && $ctx['w'] !== '' ? $ctx['w'] : (($in['topic'] ?? '') === 'expo' ? 'expo' : 'sponsor'));
    $host = (string) $ctx['host']; $by = $host !== '' ? $host : 'Booking link';
    $ref = 'bk-' . substr(sha1($ctx['key'] . '|' . $email . '|' . $sm[0]), 0, 16);
    $res = withLock(function () use ($c, $sm, $ctx, $w, $known, $name, $email, $company, $note, $host, $by, $ref) {
        foreach (['sponsor', 'expo'] as $x) sync($x, true);
        /* one at a time: the same visitor already booked, or the slot no longer free */
        foreach (['sponsor', 'expo'] as $x) foreach (toursOf($x) as $t) {
            if (($t['ref'] ?? '') === $ref) return ['ok' => true, 'dup' => true, 'tid' => $t['tid'], 'w' => $x, 'date' => $t['date'], 'time' => $t['time'], 'mins' => (int) ($t['mins'] ?? 30)];
            if (($t['src'] ?? '') === 'link' && strtolower((string) ($t['email'] ?? '')) === $email && (string) $t['date'] >= date('Y-m-d', bkNow()))
                return ['ok' => false, 'code' => 'mine', 'why' => 'You already have a time: ' . date('l, F j', (int) strtotime($t['date'])) . ' at ' . date('g:i a', (int) strtotime($t['date'] . ' ' . $t['time'])) . '.', 'date' => $t['date'], 'time' => $t['time']];
        }
        if (!in_array([$sm[1], $sm[2]], bkSlots(2000, $c), true)) return ['ok' => false, 'code' => 'taken', 'why' => 'That time was just taken. Pick another one.'];
        $T = W($w)['T']; $now = time(); $rows = []; $C = W($w); $X = recs($w);
        $R = $known ? ($X[$ctx['id']] ?? null) : bkFind($w, $email, $company);
        if (!$R) {
            /* someone new: a lead marked Booked from link */
            if ($w === 'sponsor') {
                $id = substr(sha1('added|' . $company . '|' . microtime()), 0, 10);
                $rows[] = ['t' => 'lead', 'id' => $id, 'lead' => ['id' => $id, 'list' => 'added', 'name' => $company, 'kind' => '', 'score' => null, 'why' => 'Booked from link', 'route' => '', 'phone' => '', 'site' => '', 'by' => $by, 'src' => 'link'], 'by' => $by, 'at' => $now];
                $rows[] = ['t' => 'contact', 'id' => $id, 'contact' => ['name' => $name, 'email' => $email, 'phone' => '', 'pos' => ''], 'by' => $by, 'at' => $now];
            } else {
                $id = 'x' . substr(sha1('expo-added|' . $company . '|' . microtime()), 0, 9);
                $rows[] = ['t' => 'xlead', 'id' => $id, 'org' => ['id' => $id, 'pri' => 2, 'cat' => '', 'name' => $company, 'events' => '', 'venue' => '', 'size' => '', 'last' => '', 'why' => 'Booked from link', 'site' => '', 'route' => '', 'srcs' => [], 'checked' => '', 'contacts' => [], 'by' => $by, 'mine' => true, 'src' => 'link'], 'by' => $by, 'at' => $now];
                $rows[] = ['t' => 'xcontact', 'id' => $id, 'contact' => ['name' => $name, 'role' => '', 'email' => $email, 'phone' => '', 'notes' => ''], 'by' => $by, 'at' => $now];
            }
            $stage = 'new'; $owner = ''; $isNew = true;
        } else {
            $id = (string) $R['id']; $stage = (string) $R['stage']; $owner = (string) $R['owner']; $isNew = false;
            if (!in_array($email, recEmails($R), true)) $rows[] = ['t' => $T['contact'], 'id' => $id, 'contact' => ['name' => $name, 'email' => $email, 'phone' => ''] + ($w === 'expo' ? ['role' => '', 'notes' => 'Booked from link'] : ['pos' => '']), 'by' => $by, 'at' => $now];
        }
        $mail = tmConf()['on'];
        $rows[] = ['t' => $T['tour'], 'tid' => $tid = bin2hex(random_bytes(5)), 'id' => $id, 'lead' => $id, 'date' => $sm[1], 'time' => $sm[2], 'who' => $name,
            'note' => 'Booked from ' . ($host !== '' ? $host . '’s booking link' : 'the Peak booking link') . ($note !== '' ? '. They wrote: ' . $note : ''),
            'email' => $email, 'mins' => (int) $c['mins'], 'mail' => $mail, 'by' => $by, 'at' => $now, 'auto' => 1, 'src' => 'link', 'host' => $host, 'ref' => $ref, 'from' => $ctx['src']];
        $to = forwardTo($w, $stage, $C['tourSt']); if ($to !== '') $rows[] = rowStage($w, $id, $to, $by, $now);
        if ($host !== '' && $owner === '' && in_array($host, owners($w), true)) $rows[] = rowOwner($w, $id, $host, $host, $now);
        commit($w, $rows);
        return ['ok' => true, 'dup' => false, 'tid' => $tid, 'w' => $w, 'id' => $id, 'new' => $isNew, 'date' => $sm[1], 'time' => $sm[2], 'mins' => (int) $c['mins'], 'mail' => $mail];
    });
    if (empty($res['ok']) || !empty($res['dup'])) return $res;
    bkLog(['t' => 'booked', 'src' => $ctx['src'], 'host' => $host, 'ref' => $ctx['ref'], 'tid' => $res['tid'], 'w' => $res['w'], 'id' => $res['id']]);
    /* the tour confirmation and its invite, when that switch is on */
    $res['tm'] = $res['mail'] ? tmSend($res['w'], $res['tid'], $host !== '' ? $host : BK_GENERIC_HOST, false) : ['state' => 'off', 'why' => '', 'to' => ''];
    /* from the Peak email sender's {book}: its own log hears of it too (its counts and rates) */
    if ($ctx['src'] === 'o' && tmLoad() === '') {
        $o = $ctx['o']; $dref = 'book:' . substr(sha1((string) ($o['r'] ?? '') . '|' . $res['date'] . ' ' . $res['time']), 0, 16);
        pmLog(['t' => 'booked', 'to' => $email, 'who' => $name, 'l' => (string) ($o['l'] ?? ''), 'date' => $res['date'], 'time' => $res['time'], 'kind' => 'tour', 'mins' => $res['mins'], 'note' => $note, 'desk' => 1, 'w' => $res['w'], 'org' => $res['id'], 'dref' => $dref]);
        pmLog(['t' => 'desk', 'ref' => $dref, 'op' => 'booked', 'w' => $res['w'], 'org' => $res['id'], 'ok' => true, 'final' => true, 'why' => 'booked on the desk\'s own page']);
    }
    /* Matthew hears of every booking */
    $R = recs($res['w'])[$res['id']] ?? ['name' => $company];
    $when = date('D M j', (int) strtotime($res['date'])) . ', ' . date('g:i a', (int) strtotime($res['date'] . ' ' . $res['time']));
    $from = ['p' => $host . '’s booking link', 'm' => 'the booking link in ' . $host . '’s email', 'o' => 'the Peak email ({book})', 'g' => 'the general Peak booking link'][$ctx['src']] ?? 'a booking link';
    $res['notify'] = bkNotify('Peak: ' . $R['name'] . ' booked a visit, ' . $when . ($host !== '' ? ' (with ' . $host . ')' : ''),
        $name . ' (' . $email . ') at ' . $R['name'] . ' booked from ' . $from . ".\n\n"
        . 'Visit to Peak: ' . $when . ' Mountain time, ' . $res['mins'] . " minutes.\n" . 'Host: ' . ($host !== '' ? $host : 'nobody yet (a general link): pick one on the desk') . "\n"
        . 'List: ' . ($res['w'] === 'expo' ? 'Expo leads' : 'Sponsors') . ($res['new'] ? ' (a new lead, marked Booked from link)' : '') . "\n" . ($note !== '' ? 'They wrote: ' . $note . "\n" : '')
        . 'Confirmation email: ' . (['sent' => 'sent to ' . $email, 'off' => 'not sent (tour confirmation emails are off)', 'failed' => 'NOT sent: ' . ($res['tm']['why'] ?? ''), 'blocked' => 'not sent: ' . ($res['tm']['why'] ?? ''), 'dup' => 'sent'][$res['tm']['state']] ?? 'not sent')
        . "\n\nIt is on the Peak desk as a tour: " . (defined('DESK_URL') ? DESK_URL : 'https://traverseplatforms.com/peak-desk-28d38d/') . "\n");
    return $res;
}
/** a short note to Matthew through the server's own mailbox (desk-mail.php, as the end-of-day email); DESK_MAIL_FILE catches it in tests */
function bkNotify(string $subject, string $body): array {
    $f = bkTest() ? (string) getenv('DESK_MAIL_FILE') : '';
    if ($f !== '') { file_put_contents($f, json_encode(['to' => '@notify', 'subject' => $subject, 'body' => $body], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); return ['ok' => true, 'stage' => 'test file']; }
    try {
        $p = proc_open([PHP_BINARY, __DIR__ . '/desk-mail.php'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        if (!is_resource($p)) return ['ok' => false, 'stage' => 'the mail helper did not start'];
        fwrite($pipes[0], (string) json_encode(['to' => '@notify', 'subject' => $subject, 'body' => $body])); fclose($pipes[0]);
        $o = (string) stream_get_contents($pipes[1]); fclose($pipes[1]); fclose($pipes[2]); proc_close($p);
        $j = json_decode(trim($o), true); $r = is_array($j) ? $j : ['ok' => false, 'stage' => 'no answer from the mail helper'];
    } catch (Throwable $e) { $r = ['ok' => false, 'stage' => mb_substr($e->getMessage(), 0, 100)]; }
    if (empty($r['ok'])) error_log('peak booking heads-up not sent: ' . ($r['stage'] ?? ''));
    return $r;
}
/** a calendar file for the "Add to my calendar" button on the page (METHOD:PUBLISH: nothing to answer) */
function bkIcs(array $t, string $host): string {
    $st = new DateTime($t['date'] . ' ' . $t['time'], new DateTimeZone('America/Denver')); $en = (clone $st)->modify('+' . ((int) ($t['mins'] ?? 30) ?: 30) . ' minutes');
    $L = ['BEGIN:VCALENDAR', 'PRODID:-//Peak Pickleball//Peak booking//EN', 'VERSION:2.0', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    array_push($L, ...TM_VTZ);
    array_push($L, 'BEGIN:VEVENT', 'UID:peak-tour-' . preg_replace('/[^a-z0-9]/', '', (string) $t['tid']) . '@traverseplatforms.com', 'DTSTAMP:' . gmdate('Ymd\THis\Z'),
        'DTSTART;TZID=America/Denver:' . $st->format('Ymd\THis'), 'DTEND;TZID=America/Denver:' . $en->format('Ymd\THis'),
        'SUMMARY:' . icsEsc('Visit to Peak Pickleball' . ($host !== '' && $host !== BK_GENERIC_HOST ? ' (meeting ' . $host . ')' : '')), 'LOCATION:' . icsEsc(BK_ADDRESS),
        'DESCRIPTION:' . icsEsc("Entrance: from the parking lot off Jamboree Drive (no way in from inside Chapel Hills Mall).\nPeak: " . BK_PHONE), 'END:VEVENT', 'END:VCALENDAR');
    return implode("\r\n", array_map('icsFold', $L)) . "\r\n";
}
