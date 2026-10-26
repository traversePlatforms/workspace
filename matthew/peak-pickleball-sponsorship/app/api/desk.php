<?php
/* Peak Sponsor Desk (2026-10-21, Matthew: "my job is to build this out"; "its own interface ... just making it into what we need soley to do
 * this job"). Brandon works the sponsor leads: status from Not contacted to Signed, notes, next steps, tours at Peak, proposals, a report.
 * Storage: plain files outside the public folder. The leads start from seed.json (built by tools/build_leads.py); everything after is an
 * append-only log (events.log), replayed on each read, so no change is ever lost.
 * Sign-in: a 6-digit code per person (admin = Matthew, seller = Brandon: the same screens and powers; only the admin controls who
 * can sign in, and that is done on the server). Codes are kept hashed. Make one from the command line:
 *   php desk.php addaccount "Brandon" seller      (prints the code once)
 * 2026-10-24 (Matthew): companies are looked up from their own website (scan.php) when one is added, when someone taps Look up, and
 * every hour for the ones not looked up in a day:
 *   php desk.php rescan [15]          (started by the hourly morning-email cron job; 15 companies a run)
 *   php desk.php scan <lead id> [--hunter]
 * Also: signed sponsors with what they bought, renewal dates and to-dos; tour outcomes and moves; notes that can be removed (the log
 * keeps them, the desk stops showing them); a profit and loss page. */
declare(strict_types=1);
define('DESK', 1);
$LOCAL = PHP_SAPI === 'cli-server' || PHP_SAPI === 'cli';
$outside = dirname(__DIR__, 3) . '/peak-desk-data';
define('DATA_DIR', getenv('DESK_DATA') ?: (is_dir($outside) ? $outside : ($LOCAL ? dirname(__DIR__) . '/../desk-data-local' : $outside)));
if (!is_dir(DATA_DIR)) { if ($LOCAL) @mkdir(DATA_DIR, 0770, true); else { http_response_code(500); exit('{"ok":false,"error":"No data folder."}'); } }

function jread(string $f, $def) { $s = @file_get_contents(DATA_DIR . '/' . $f); if ($s === false) return $def; $j = json_decode($s, true); return $j === null ? $def : $j; }
function jwrite(string $f, $v): bool { $t = DATA_DIR . '/' . $f . '.tmp' . bin2hex(random_bytes(3)); if (file_put_contents($t, json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) === false) return false; return rename($t, DATA_DIR . '/' . $f); }
function logAdd(array $row): bool { return (bool) file_put_contents(DATA_DIR . '/events.log', json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); }
function logRows(): array { $out = []; $fh = @fopen(DATA_DIR . '/events.log', 'r'); if (!$fh) return $out; while (($l = fgets($fh)) !== false) { $r = json_decode($l, true); if (is_array($r)) $out[] = $r; } fclose($fh); return $out; }
function clean($v, int $max): string { $t = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) $v) ?? ''); return mb_substr($t, 0, $max); }
function codeHash(string $c): string { return hash('sha256', 'peakdesk|' . $c); }
const STATUSES = ['new' => 'Not contacted', 'contacted' => 'Contacted', 'tour' => 'Tour booked', 'toured' => 'Toured', 'proposal' => 'Proposal sent', 'signed' => 'Signed', 'notnow' => 'Not now', 'no' => 'No'];
require __DIR__ . '/scan.php';

/* ---- the state: the seed, replayed with the log ---- */
function noteKey(array $r): string { return substr(sha1($r['at'] . '|' . $r['by'] . '|' . $r['note']), 0, 8); }
function state(): array {
    $seed = jread('seed.json', ['leads' => [], 'packages' => []]);
    $base = ['status' => 'new', 'notes' => [], 'next' => null, 'log' => [], 'added' => [], 'todos' => [], 'signed' => null];
    $L = []; foreach ($seed['leads'] as $l) $L[$l['id']] = $l + $base;
    /* Peak's own sponsor records (2026-10-25, Nneka's tracker: active, pending and inactive sponsors, signage, contract dates and money).
       Kept in peak-records.json beside the seed, so a seed rebuild never drops them; a record's lead moves to the Peak sponsors list, a
       sponsor the desk lacked is added there, and its tracker emails join the contacts once. */
    foreach ((jread('peak-records.json', ['leads' => []])['leads'] ?? []) as $p) {
        $id = (string) ($p['id'] ?? ''); if (!preg_match('/^[0-9a-f]{10}$/', $id) || !is_array($p['peak'] ?? null)) continue;
        if (!isset($L[$id])) $L[$id] = ['id' => $id, 'list' => 'renew', 'name' => (string) ($p['name'] ?? ''), 'kind' => '', 'score' => null, 'why' => '', 'route' => '', 'contacts' => []] + $base;
        $L[$id]['list'] = 'renew'; $L[$id]['peak'] = $p['peak'];
        if (!empty($p['kind'])) $L[$id]['kind'] = (string) $p['kind'];
        if (isset($p['why'])) $L[$id]['why'] = (string) $p['why'];
        $have = array_map(fn($c) => strtolower((string) ($c['email'] ?? '')), $L[$id]['contacts'] ?? []);
        foreach (($p['contacts'] ?? []) as $c) if (!empty($c['email']) && !in_array(strtolower($c['email']), $have, true)) { $L[$id]['contacts'][] = $c; $have[] = strtolower($c['email']); }
    }
    $tours = []; $props = []; $pk = $seed['packages'] ?? []; $pl = null; $team = [];
    foreach (logRows() as $r) {
        $id = (string) ($r['id'] ?? ''); $t = (string) ($r['t'] ?? '');
        if (!empty($r['by'])) { $b = (string) $r['by']; $team[$b][$t] = ($team[$b][$t] ?? 0) + 1; $team[$b]['last'] = max($team[$b]['last'] ?? 0, (int) ($r['at'] ?? 0)); }
        switch ($t) {
            case 'lead': $L[$id] = $r['lead'] + $base + ['contacts' => []]; break;
            case 'status': if (isset($L[$id])) { $L[$id]['status'] = $r['status']; $L[$id]['log'][] = ['at' => $r['at'], 'by' => $r['by'], 'what' => 'Status: ' . (STATUSES[$r['status']] ?? $r['status'])]; } break;
            case 'note': if (isset($L[$id])) $L[$id]['notes'][] = ['k' => noteKey($r), 'at' => $r['at'], 'by' => $r['by'], 'note' => $r['note']]; break;
            case 'notedel': if (isset($L[$id])) $L[$id]['notes'] = array_values(array_filter($L[$id]['notes'], fn($n) => $n['k'] !== ($r['nk'] ?? ''))); break;
            case 'next': if (isset($L[$id])) $L[$id]['next'] = $r['next']; break;
            case 'contact': if (isset($L[$id])) $L[$id]['added'][] = $r['contact'] + ['by' => $r['by']]; break;
            case 'site': if (isset($L[$id])) $L[$id]['site'] = $r['site']; break;
            case 'leaddel': if (isset($L[$id])) $L[$id]['off'] = ['at' => $r['at'], 'by' => $r['by']]; break;   /* removed from the desk; the log keeps it (2026-10-24) */
            case 'leadback': if (isset($L[$id])) unset($L[$id]['off']); break;
            case 'signed': if (isset($L[$id])) $L[$id]['signed'] = $r['signed'] + ['by' => $r['by'], 'at' => $r['at']]; break;
            case 'todo': if (isset($L[$id])) $L[$id]['todos'][] = ['k' => $r['k'], 'text' => $r['text'], 'done' => false, 'by' => $r['by'], 'at' => $r['at']]; break;
            case 'tododone': if (isset($L[$id])) foreach ($L[$id]['todos'] as &$x) { if ($x['k'] === $r['k']) $x['done'] = (bool) $r['done']; } unset($x); break;
            case 'tododel': if (isset($L[$id])) $L[$id]['todos'] = array_values(array_filter($L[$id]['todos'], fn($x) => $x['k'] !== $r['k'])); break;
            case 'tour': $tours[$r['tid']] = $r + ['off' => false, 'out' => '']; break;
            case 'tourdel': if (isset($tours[$r['tid']])) $tours[$r['tid']]['off'] = true; break;
            case 'tourout': if (isset($tours[$r['tid']])) $tours[$r['tid']]['out'] = $r['out']; break;
            case 'tourmove': if (isset($tours[$r['tid']])) { $tours[$r['tid']]['date'] = $r['date']; $tours[$r['tid']]['time'] = $r['time']; $tours[$r['tid']]['out'] = ''; } break;
            case 'proposal': $props[$r['pid']] = $r; break;
            case 'packages': $pk = $r['packages']; break;
            case 'pl': $pl = $r['pl']; break;
        }
    }
    foreach (jread('scans.json', []) as $id => $s) if (isset($L[$id])) $L[$id]['scan'] = $s;
    return ['leads' => $L, 'tours' => array_values(array_filter($tours, fn($t) => !$t['off'])), 'proposals' => array_values($props), 'packages' => $pk, 'pl' => $pl, 'team' => $team];
}

/* ---- the command line: accounts, look-ups ---- */
if (PHP_SAPI === 'cli') {
    [$cmd, $name, $role] = [$argv[1] ?? '', $argv[2] ?? '', $argv[3] ?? 'seller'];
    if ($cmd === 'addaccount' && $name !== '' && in_array($role, ['admin', 'seller'], true)) {
        $acc = jread('accounts.json', ['codes' => []]);
        do { $code = (string) random_int(100000, 999999); } while (isset($acc['codes'][codeHash($code)]));
        $acc['codes'][codeHash($code)] = ['name' => clean($name, 40), 'role' => $role, 'at' => time()];
        jwrite('accounts.json', $acc); echo "Code for $name ($role): $code\n"; exit(0);
    }
    if ($cmd === 'rescan') exit(rescanDue(max(1, min(60, (int) ($name ?: 15)))));
    if ($cmd === 'scan' && $name !== '') {
        $L = state()['leads'][$name] ?? null; if (!$L) { fwrite(STDERR, "No such lead.\n"); exit(1); }
        echo json_encode(scanAndSave($L, in_array('--hunter', $argv, true) ? 'hunter' : 'site'), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n"; exit(0);
    }
    fwrite(STDERR, "usage: php desk.php addaccount \"Name\" admin|seller | rescan [n] | scan <lead id> [--hunter]\n"); exit(1);
}

header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
function out(array $a): void { echo json_encode($a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); exit; }
function fail(string $m, int $code = 400): void { http_response_code($code); out(['ok' => false, 'error' => $m]); }
$action = (string) ($_GET['action'] ?? '');
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
    /* the whole desk pauses after 100 wrong codes in an hour from anywhere, so many addresses can't share the guessing (security check 2026-10-25) */
    $recent = 0; foreach ($tries as $k => $ts) { $tries[$k] = array_values(array_filter((array) $ts, fn($t) => $t > $now - 3600)); if (!$tries[$k]) unset($tries[$k]); else $recent += count($tries[$k]); }
    if ($recent >= 100) fail('Sign-in is paused for a while after too many wrong codes. Try again later.', 429);
    $code = preg_replace('/\D/', '', (string) ($body['code'] ?? ''));
    $acc = jread('accounts.json', ['codes' => []]); $a = $acc['codes'][codeHash($code)] ?? null;
    if (!$a || strlen($code) !== 6) { $mine[] = $now; $tries[$ip] = $mine; jwrite('tries.json', $tries); fail('That code did not work.', 401); }
    $tok = bin2hex(random_bytes(24)); $ses = jread('sessions.json', []);
    foreach ($ses as $k => $s) if (($s['at'] ?? 0) < $now - 60 * 86400) unset($ses[$k]);
    $ses[hash('sha256', $tok)] = ['name' => $a['name'], 'role' => $a['role'], 'at' => $now]; jwrite('sessions.json', $ses);
    setcookie('peakdesk', $tok, ['expires' => $now + 60 * 86400, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
    out(['ok' => true, 'name' => $a['name'], 'role' => $a['role']]);
}
$ses = jread('sessions.json', []); $tokH = hash('sha256', (string) ($_COOKIE['peakdesk'] ?? '')); $me = $ses[$tokH] ?? null;
if (!$me) fail('Signed out.', 401);
$ME = (string) $me['name'];   /* the role is sent back to the page but gates nothing here: admin and seller have the same powers (2026-10-21) */
if ($action === 'signout') { unset($ses[$tokH]); jwrite('sessions.json', $ses); setcookie('peakdesk', '', ['expires' => 1, 'path' => '/']); out(['ok' => true]); }
if ($action === 'me') out(['ok' => true, 'name' => $ME, 'role' => $me['role']]);

function needLead(array $S, string $id, bool $removedOk = false): array {
    if (!preg_match('/^[a-z0-9]{6,24}$/', $id) || !isset($S['leads'][$id])) fail('No such lead.', 404);
    if (!$removedOk && !empty($S['leads'][$id]['off'])) fail('That company was removed. Bring it back first.', 409);
    return $S['leads'][$id];
}
function sameName(array $S, string $n): ?array { foreach ($S['leads'] as $l) if (strtolower(trim($l['name'])) === strtolower(trim($n))) return $l; return null; }
function newLead(string $ME, array $body): array {   /* a company we add, as a lead or as a sponsor already signed */
    $site = clean($body['site'] ?? '', 160); if ($site !== '' && !preg_match('#^(https?://)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(/\S*)?$#i', $site)) fail('That website does not look right.');
    $n = clean($body['name'] ?? '', 100);
    $id = substr(sha1('added|' . $n . '|' . microtime()), 0, 10);
    return ['id' => $id, 'list' => 'added', 'name' => $n, 'kind' => clean($body['kind'] ?? '', 60), 'score' => null, 'why' => clean($body['why'] ?? '', 400), 'route' => '', 'phone' => clean($body['phone'] ?? '', 40), 'site' => $site, 'by' => $ME];
}
function nameFree(array $S, string $n): void {
    if ($n === '') fail('Give the company name.');
    $x = sameName($S, $n); if ($x) fail(!empty($x['off']) ? 'That company was removed. Bring it back from Removed companies.' : 'That company is already on the list.');
}
function needTour(array $S, string $tid): array { foreach ($S['tours'] as $t) if ($t['tid'] === $tid) return $t; fail('No such tour.', 404); return []; }
function setStatus(string $id, string $st, string $by): void { logAdd(['t' => 'status', 'id' => $id, 'status' => $st, 'by' => $by, 'at' => time()]); }
function lines($in): array {   /* package lines for a proposal or a signed deal */
    $lines = [];
    foreach ((array) $in as $x) {
        if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 100); $pr = (int) round((float) ($x['price'] ?? 0)); $q = max(1, min(50, (int) ($x['qty'] ?? 1)));
        if ($nm === '' || $pr < 0 || $pr > 1000000) continue; $lines[] = ['name' => $nm, 'price' => $pr, 'qty' => $q, 'per' => clean($x['per'] ?? '', 20)];
    }
    return $lines;
}
function okDay(string $d): bool { return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $d); }
function okTime(string $t): bool { return (bool) preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $t); }

if ($action === 'data') {
    $S = state(); $sd = jread('seed.json', []);
    /* who can sign in (names only) with what each has done; the read-only check account is left out */
    $people = []; foreach (jread('accounts.json', ['codes' => []])['codes'] as $a) if ($a['name'] !== 'Claude Check') $people[$a['name']] = $S['team'][$a['name']] ?? [];
    $removed = []; foreach ($S['leads'] as $l) if (!empty($l['off'])) $removed[] = ['id' => $l['id'], 'name' => $l['name'], 'list' => $l['list'], 'status' => $l['status'], 'at' => $l['off']['at'], 'by' => $l['off']['by']];
    out(['ok' => true, 'me' => ['name' => $ME, 'role' => $me['role']], 'statuses' => STATUSES, 'leads' => array_values(array_filter($S['leads'], fn($l) => empty($l['off']))), 'removed' => $removed, 'tours' => $S['tours'], 'proposals' => $S['proposals'], 'packages' => $S['packages'], 'offer' => $sd['offer'] ?? [], 'better' => $sd['better'] ?? [], 'pl' => $S['pl'], 'team' => $people, 'hunterLeft' => hunterLeft()]);
}
if ($ME === 'Claude Check') fail('This account only looks, so nothing is saved.', 403);   /* read-only check account (2026-10-26): everything below saves */
if (!$isPost) fail('POST required', 405);
$S = state();
switch ($action) {
    case 'status': {
        $id = (string) ($body['id'] ?? ''); needLead($S, $id); $st = (string) ($body['status'] ?? '');
        if (!isset(STATUSES[$st])) fail('Pick a status.');
        setStatus($id, $st, $ME); out(['ok' => true]);
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
    case 'contact': {
        $id = (string) ($body['id'] ?? ''); needLead($S, $id);
        $c = ['name' => clean($body['name'] ?? '', 80), 'pos' => clean($body['pos'] ?? '', 80), 'email' => clean($body['email'] ?? '', 120), 'phone' => clean($body['phone'] ?? '', 40)];
        if ($c['name'] === '' && $c['email'] === '' && $c['phone'] === '') fail('Give a name, email or phone.');
        if ($c['email'] !== '' && !filter_var($c['email'], FILTER_VALIDATE_EMAIL)) fail('That email does not look right.');
        logAdd(['t' => 'contact', 'id' => $id, 'contact' => $c, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'lead': {
        nameFree($S, clean($body['name'] ?? '', 100)); $lead = newLead($ME, $body);
        logAdd(['t' => 'lead', 'id' => $lead['id'], 'lead' => $lead, 'by' => $ME, 'at' => time()]); out(['ok' => true, 'id' => $lead['id']]);
    }
    case 'sponsor': {
        /* a sponsor we just got, in one step: the company, who to deal with, what they bought (2026-10-24, Matthew: "Add function to add
           sponsors as we get them") */
        nameFree($S, clean($body['name'] ?? '', 100));
        $d = (string) ($body['start'] ?? ''); if (!okDay($d)) fail('Pick the start date.');
        $m = (int) ($body['months'] ?? 12); if ($m < 1 || $m > 60) fail('Give the length in months (1 to 60).');
        $c = ['name' => clean($body['cname'] ?? '', 80), 'pos' => clean($body['cpos'] ?? '', 80), 'email' => clean($body['cemail'] ?? '', 120), 'phone' => clean($body['cphone'] ?? '', 40)];
        if ($c['email'] !== '' && !filter_var($c['email'], FILTER_VALIDATE_EMAIL)) fail('That email does not look right.');
        $lead = newLead($ME, $body); $id = $lead['id']; $lines = lines($body['lines'] ?? []); $now = time();
        logAdd(['t' => 'lead', 'id' => $id, 'lead' => $lead, 'by' => $ME, 'at' => $now]);
        if ($c['name'] !== '' || $c['email'] !== '' || $c['phone'] !== '') logAdd(['t' => 'contact', 'id' => $id, 'contact' => $c, 'by' => $ME, 'at' => $now]);
        logAdd(['t' => 'signed', 'id' => $id, 'signed' => ['lines' => $lines, 'total' => array_sum(array_map(fn($x) => $x['price'] * $x['qty'], $lines)), 'start' => $d, 'months' => $m, 'who' => clean($body['who'] ?? '', 120), 'note' => clean($body['note'] ?? '', 600)], 'by' => $ME, 'at' => $now]);
        setStatus($id, 'signed', $ME);
        out(['ok' => true, 'id' => $id]);
    }
    case 'leaddel': {
        /* take a company or sponsor off the desk (2026-10-24, Matthew: "Add function to remove sponsors/ companies"); its notes, history
           and proposals stay in the log, and it can be brought back */
        $id = (string) ($body['id'] ?? ''); needLead($S, $id);
        logAdd(['t' => 'leaddel', 'id' => $id, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'leadback': {
        $id = (string) ($body['id'] ?? ''); $L = needLead($S, $id, true); if (empty($L['off'])) fail('That company is on the desk already.');
        logAdd(['t' => 'leadback', 'id' => $id, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'site': {
        $id = (string) ($body['id'] ?? ''); needLead($S, $id); $site = clean($body['site'] ?? '', 160);
        if (!preg_match('#^(https?://)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(/\S*)?$#i', $site)) fail('That website does not look right.');
        logAdd(['t' => 'site', 'id' => $id, 'site' => $site, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'scan': {
        /* look a company up now: its website, or (hunter) the people Hunter knows at its domain */
        $id = (string) ($body['id'] ?? ''); $L = needLead($S, $id); $hun = !empty($body['hunter']);
        @set_time_limit(120);
        if ($hun) {
            if (hunterDomain($L) === '') fail('Add their website first: Hunter searches by it.');
            $left = hunterLeft(true); if ($left === null) fail('Hunter is not set up here.'); if ($left < 1) fail('No Hunter searches left this month.');
            $r = scanAndSave($L, 'hunter'); if ($r['hunter']['err'] !== '') fail($r['hunter']['err']);
            out(['ok' => true, 'found' => count($r['hunter']['people'])]);
        }
        if (siteOf($L) === '' && srcUrl($L) === '') fail('Add their website first.');
        $prev = jread('scans.json', [])[$id] ?? null;
        if ($prev && ($prev['at'] ?? 0) > time() - 60) out(['ok' => true, 'scan' => $prev]);   /* looked up a minute ago */
        out(['ok' => true, 'scan' => scanAndSave($L, 'site')]);
    }
    case 'tour': {
        $id = (string) ($body['lead'] ?? ''); $L = needLead($S, $id); $d = (string) ($body['date'] ?? ''); $tm = (string) ($body['time'] ?? '');
        if (!okDay($d) || $d < date('Y-m-d')) fail('Pick today or a later day.');
        if (!okTime($tm)) fail('Pick a time.');
        $tid = bin2hex(random_bytes(5));
        logAdd(['t' => 'tour', 'tid' => $tid, 'id' => $id, 'lead' => $id, 'date' => $d, 'time' => $tm, 'who' => clean($body['who'] ?? '', 120), 'note' => clean($body['note'] ?? '', 400), 'by' => $ME, 'at' => time()]);
        if (in_array($L['status'], ['new', 'contacted'], true)) setStatus($id, 'tour', $ME);   /* a tour booked moves the lead on */
        out(['ok' => true, 'tid' => $tid]);
    }
    case 'tourdel': {
        $tid = (string) ($body['tid'] ?? ''); needTour($S, $tid);
        logAdd(['t' => 'tourdel', 'tid' => $tid, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'tourmove': {
        $tid = (string) ($body['tid'] ?? ''); needTour($S, $tid); $d = (string) ($body['date'] ?? ''); $tm = (string) ($body['time'] ?? '');
        if (!okDay($d) || $d < date('Y-m-d')) fail('Pick today or a later day.');
        if (!okTime($tm)) fail('Pick a time.');
        logAdd(['t' => 'tourmove', 'tid' => $tid, 'date' => $d, 'time' => $tm, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'tourout': {
        /* how a tour went: toured (the lead moves to Toured) or did not show */
        $tid = (string) ($body['tid'] ?? ''); $t = needTour($S, $tid); $o = (string) ($body['out'] ?? '');
        if (!in_array($o, ['toured', 'noshow'], true)) fail('Pick how it went.');
        logAdd(['t' => 'tourout', 'tid' => $tid, 'out' => $o, 'by' => $ME, 'at' => time()]);
        $L = $S['leads'][$t['lead']] ?? null;
        if ($o === 'toured' && $L && in_array($L['status'], ['new', 'contacted', 'tour'], true)) setStatus($L['id'], 'toured', $ME);
        out(['ok' => true]);
    }
    case 'proposal': {
        $id = (string) ($body['lead'] ?? ''); $L = needLead($S, $id); $lines = lines($body['lines'] ?? []);
        if (!$lines) fail('Add at least one package.');
        $pid = bin2hex(random_bytes(5)); $total = array_sum(array_map(fn($x) => $x['price'] * $x['qty'], $lines));
        logAdd(['t' => 'proposal', 'pid' => $pid, 'id' => $id, 'lead' => $id, 'company' => $L['name'], 'to' => clean($body['to'] ?? '', 120), 'lines' => $lines, 'total' => $total, 'note' => clean($body['note'] ?? '', 1200), 'by' => $ME, 'at' => time()]);
        if (in_array($L['status'], ['new', 'contacted', 'tour', 'toured'], true)) setStatus($id, 'proposal', $ME);
        out(['ok' => true, 'pid' => $pid, 'total' => $total]);
    }
    case 'signed': {
        /* a sponsor signed: what they bought, from when, for how long (2026-10-24, Matthew: "Add a signed on section") */
        $id = (string) ($body['id'] ?? ''); $L = needLead($S, $id); $lines = lines($body['lines'] ?? []);
        $d = (string) ($body['start'] ?? ''); if (!okDay($d)) fail('Pick the start date.');
        $m = (int) ($body['months'] ?? 12); if ($m < 1 || $m > 60) fail('Give the length in months (1 to 60).');
        $sg = ['lines' => $lines, 'total' => array_sum(array_map(fn($x) => $x['price'] * $x['qty'], $lines)), 'start' => $d, 'months' => $m, 'who' => clean($body['who'] ?? '', 120), 'note' => clean($body['note'] ?? '', 600)];
        logAdd(['t' => 'signed', 'id' => $id, 'signed' => $sg, 'by' => $ME, 'at' => time()]);
        if ($L['status'] !== 'signed') setStatus($id, 'signed', $ME);
        out(['ok' => true]);
    }
    case 'todo': {
        $id = (string) ($body['id'] ?? ''); needLead($S, $id); $tx = clean($body['text'] ?? '', 160); if ($tx === '') fail('Write the to-do first.');
        logAdd(['t' => 'todo', 'id' => $id, 'k' => bin2hex(random_bytes(4)), 'text' => $tx, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'tododone':
    case 'tododel': {
        $id = (string) ($body['id'] ?? ''); $L = needLead($S, $id); $k = (string) ($body['k'] ?? '');
        if (!in_array($k, array_column($L['todos'], 'k'), true)) fail('No such to-do.', 404);
        logAdd(['t' => $action, 'id' => $id, 'k' => $k, 'done' => !empty($body['done']), 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'packages': {
        /* the seller sets packages too (2026-10-21, Matthew: "brandons code gives as much permissions as mine does other then full control of the
           application"); what stays the admin's is who can sign in (accounts are made on the server only) */
        $pk = [];
        foreach ((array) ($body['packages'] ?? []) as $x) { if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 80); $pr = (int) round((float) ($x['price'] ?? 0)); if ($nm === '' || $pr < 0 || $pr > 1000000) continue; $pk[] = ['k' => substr(sha1($nm), 0, 6), 'name' => $nm, 'price' => $pr, 'per' => clean($x['per'] ?? 'year', 20), 'note' => clean($x['note'] ?? '', 160)]; }
        if (!$pk) fail('Keep at least one package.');
        logAdd(['t' => 'packages', 'packages' => $pk, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'pl': {
        /* profit and loss (2026-10-24, Matthew: "based on services we offer and how much it costs to run vs what are charge"): every figure
           is typed in by someone; the page does the sums */
        $per = fn($v, array $ok, string $def) => in_array($v, $ok, true) ? $v : $def;
        $money = fn($v) => ($v === null || $v === '') ? null : max(0, min(10000000, (int) round((float) $v)));
        $sv = []; foreach (array_slice((array) ($body['services'] ?? []), 0, 40) as $x) { if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 80); if ($nm === '') continue; $sv[] = ['name' => $nm, 'price' => $money($x['price'] ?? null), 'per' => $per($x['per'] ?? '', ['year', 'month', 'once'], 'year'), 'cost' => $money($x['cost'] ?? null), 'costPer' => $per($x['costPer'] ?? '', ['year', 'month', 'once'], 'year')]; }
        $rn = []; foreach (array_slice((array) ($body['running'] ?? []), 0, 40) as $x) { if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 80); if ($nm === '') continue; $rn[] = ['name' => $nm, 'amount' => $money($x['amount'] ?? null) ?? 0, 'per' => $per($x['per'] ?? '', ['month', 'year'], 'month')]; }
        logAdd(['t' => 'pl', 'pl' => ['services' => $sv, 'running' => $rn], 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
}
fail('Unknown action.', 404);
