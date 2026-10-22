<?php
/* Peak Sponsor Desk (2026-10-21, Matthew: "my job is to build this out"; "its own interface ... just making it into what we need soley to do
 * this job"). Brandon works the sponsor leads: status from Not contacted to Signed, notes, next steps, tours at Peak, proposals, a report.
 * Storage: plain files outside the public folder. The leads start from seed.json (built by tools/build_leads.py); everything after is an
 * append-only log (events.log), replayed on each read, so no change is ever lost.
 * Sign-in: a 6-digit code per person (admin = Matthew, seller = Brandon); codes are kept hashed. Make one from the command line:
 *   php desk.php addaccount "Brandon" seller      (prints the code once) */
declare(strict_types=1);
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

/* the command line: accounts */
if (PHP_SAPI === 'cli') {
    [$cmd, $name, $role] = [$argv[1] ?? '', $argv[2] ?? '', $argv[3] ?? 'seller'];
    if ($cmd === 'addaccount' && $name !== '' && in_array($role, ['admin', 'seller'], true)) {
        $acc = jread('accounts.json', ['codes' => []]);
        do { $code = (string) random_int(100000, 999999); } while (isset($acc['codes'][codeHash($code)]));
        $acc['codes'][codeHash($code)] = ['name' => clean($name, 40), 'role' => $role, 'at' => time()];
        jwrite('accounts.json', $acc); echo "Code for $name ($role): $code\n"; exit(0);
    }
    fwrite(STDERR, "usage: php desk.php addaccount \"Name\" admin|seller\n"); exit(1);
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
$ME = (string) $me['name']; $ADMIN = $me['role'] === 'admin';
if ($action === 'signout') { unset($ses[$tokH]); jwrite('sessions.json', $ses); setcookie('peakdesk', '', ['expires' => 1, 'path' => '/']); out(['ok' => true]); }
if ($action === 'me') out(['ok' => true, 'name' => $ME, 'role' => $me['role']]);

/* ---- the state: the seed, replayed with the log ---- */
const STATUSES = ['new' => 'Not contacted', 'contacted' => 'Contacted', 'tour' => 'Tour booked', 'toured' => 'Toured', 'proposal' => 'Proposal sent', 'signed' => 'Signed', 'notnow' => 'Not now', 'no' => 'No'];
function state(): array {
    $seed = jread('seed.json', ['leads' => [], 'packages' => []]);
    $L = []; foreach ($seed['leads'] as $l) $L[$l['id']] = $l + ['status' => 'new', 'notes' => [], 'next' => null, 'log' => [], 'added' => []];
    $tours = []; $props = []; $pk = $seed['packages'] ?? [];
    foreach (logRows() as $r) {
        $id = (string) ($r['id'] ?? '');
        switch ($r['t'] ?? '') {
            case 'lead': $L[$id] = $r['lead'] + ['status' => 'new', 'notes' => [], 'next' => null, 'log' => [], 'added' => [], 'contacts' => []]; break;
            case 'status': if (isset($L[$id])) { $L[$id]['status'] = $r['status']; $L[$id]['log'][] = ['at' => $r['at'], 'by' => $r['by'], 'what' => 'Status: ' . (STATUSES[$r['status']] ?? $r['status'])]; } break;
            case 'note': if (isset($L[$id])) $L[$id]['notes'][] = ['at' => $r['at'], 'by' => $r['by'], 'note' => $r['note']]; break;
            case 'next': if (isset($L[$id])) $L[$id]['next'] = $r['next']; break;
            case 'contact': if (isset($L[$id])) $L[$id]['added'][] = $r['contact'] + ['by' => $r['by']]; break;
            case 'tour': $tours[$r['tid']] = $r + ['off' => false]; break;
            case 'tourdel': if (isset($tours[$r['tid']])) $tours[$r['tid']]['off'] = true; break;
            case 'proposal': $props[$r['pid']] = $r; break;
            case 'packages': $pk = $r['packages']; break;
        }
    }
    return ['leads' => $L, 'tours' => array_values(array_filter($tours, fn($t) => !$t['off'])), 'proposals' => array_values($props), 'packages' => $pk];
}
function needLead(array $S, string $id): array { if (!preg_match('/^[a-z0-9]{6,24}$/', $id) || !isset($S['leads'][$id])) fail('No such lead.', 404); return $S['leads'][$id]; }
function setStatus(string $id, string $st, string $by): void { logAdd(['t' => 'status', 'id' => $id, 'status' => $st, 'by' => $by, 'at' => time()]); }

if ($action === 'data') { $S = state(); out(['ok' => true, 'me' => ['name' => $ME, 'role' => $me['role']], 'statuses' => STATUSES, 'leads' => array_values($S['leads']), 'tours' => $S['tours'], 'proposals' => $S['proposals'], 'packages' => $S['packages']]); }
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
    case 'next': {
        $id = (string) ($body['id'] ?? ''); needLead($S, $id); $d = (string) ($body['date'] ?? ''); $w = clean($body['what'] ?? '', 160);
        if ($d !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) fail('Pick a date.');
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
        $n = clean($body['name'] ?? '', 100); if ($n === '') fail('Give the company name.');
        foreach ($S['leads'] as $l) if (strtolower($l['name']) === strtolower($n)) fail('That company is already on the list.');
        $id = substr(sha1('added|' . $n . '|' . microtime()), 0, 10);
        $lead = ['id' => $id, 'list' => 'added', 'name' => $n, 'kind' => clean($body['kind'] ?? '', 60), 'score' => null, 'why' => clean($body['why'] ?? '', 400), 'route' => '', 'phone' => clean($body['phone'] ?? '', 40), 'site' => clean($body['site'] ?? '', 160), 'by' => $ME];
        logAdd(['t' => 'lead', 'id' => $id, 'lead' => $lead, 'by' => $ME, 'at' => time()]); out(['ok' => true, 'id' => $id]);
    }
    case 'tour': {
        $id = (string) ($body['lead'] ?? ''); $L = needLead($S, $id); $d = (string) ($body['date'] ?? ''); $tm = (string) ($body['time'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) || $d < date('Y-m-d')) fail('Pick today or a later day.');
        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $tm)) fail('Pick a time.');
        $tid = bin2hex(random_bytes(5));
        logAdd(['t' => 'tour', 'tid' => $tid, 'id' => $id, 'lead' => $id, 'date' => $d, 'time' => $tm, 'who' => clean($body['who'] ?? '', 120), 'note' => clean($body['note'] ?? '', 400), 'by' => $ME, 'at' => time()]);
        if (in_array($L['status'], ['new', 'contacted'], true)) setStatus($id, 'tour', $ME);   /* a tour booked moves the lead on */
        out(['ok' => true, 'tid' => $tid]);
    }
    case 'tourdel': {
        $tid = (string) ($body['tid'] ?? ''); $ok = false; foreach ($S['tours'] as $t) if ($t['tid'] === $tid) $ok = true; if (!$ok) fail('No such tour.', 404);
        logAdd(['t' => 'tourdel', 'tid' => $tid, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
    case 'proposal': {
        $id = (string) ($body['lead'] ?? ''); $L = needLead($S, $id); $lines = [];
        foreach ((array) ($body['lines'] ?? []) as $x) {
            if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 100); $pr = (int) round((float) ($x['price'] ?? 0)); $q = max(1, min(50, (int) ($x['qty'] ?? 1)));
            if ($nm === '' || $pr < 0 || $pr > 1000000) continue; $lines[] = ['name' => $nm, 'price' => $pr, 'qty' => $q, 'per' => clean($x['per'] ?? '', 20)];
        }
        if (!$lines) fail('Add at least one package.');
        $pid = bin2hex(random_bytes(5)); $total = array_sum(array_map(fn($x) => $x['price'] * $x['qty'], $lines));
        logAdd(['t' => 'proposal', 'pid' => $pid, 'id' => $id, 'lead' => $id, 'company' => $L['name'], 'to' => clean($body['to'] ?? '', 120), 'lines' => $lines, 'total' => $total, 'note' => clean($body['note'] ?? '', 1200), 'by' => $ME, 'at' => time()]);
        if (in_array($L['status'], ['new', 'contacted', 'tour', 'toured'], true)) setStatus($id, 'proposal', $ME);
        out(['ok' => true, 'pid' => $pid, 'total' => $total]);
    }
    case 'packages': {
        if (!$ADMIN) fail('Only an admin changes the packages.', 403); $pk = [];
        foreach ((array) ($body['packages'] ?? []) as $x) { if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 80); $pr = (int) round((float) ($x['price'] ?? 0)); if ($nm === '' || $pr < 0 || $pr > 1000000) continue; $pk[] = ['k' => substr(sha1($nm), 0, 6), 'name' => $nm, 'price' => $pr, 'per' => clean($x['per'] ?? 'year', 20), 'note' => clean($x['note'] ?? '', 160)]; }
        if (!$pk) fail('Keep at least one package.');
        logAdd(['t' => 'packages', 'packages' => $pk, 'by' => $ME, 'at' => time()]); out(['ok' => true]);
    }
}
fail('Unknown action.', 404);
