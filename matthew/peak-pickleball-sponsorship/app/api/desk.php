<?php
/* Peak Sponsor Desk (2026-10-21, Matthew: "my job is to build this out"; "its own interface ... just making it into what we need soley to do
 * this job"). Brandon's team works the sponsor leads and the expo leads: who to reach, every call, voicemail, email and text, tours at
 * Peak, proposals and quotes, signed sponsors, a report.
 *
 * 2026-11-17 rebuild (Matthew: "treat it like a pipeline similiar to sixfold ... there no a spot to select emailed ... whatever we do with
 * the peak sponsor deck needs to happen in the expo section as well"): both lists are pipelines with the same tools.
 *   Sponsors: To contact, Called, Left voicemail, Emailed, Texted, Meeting / tour booked, Proposal sent, Signed; Not now (a day to come
 *             back), Lost (a reason).
 *   Expo:     To contact, Contacted, Tour booked, Quote sent, Booked; Not now, Lost.
 * Every touch is logged (how, who, when, how it went, a note, a follow-up) and moves a company along while it is still being reached. Each
 * company has an owner (one of the sellers) or is Open. The records live in desk.sqlite; the append-only logs stay the permanent record
 * (desk-store.php explains). The expo leads stay a world of their own: their own log, their own counts, never in the sponsor views.
 *
 * Sign-in: a 6-digit code per person, kept hashed. admin = Matthew; seller = Brandon, Nneka, Lance, Cai: the same screens and powers; expo =
 * the Expo leads only, enforced here; Claude Check reads and saves nothing. Who can sign in is changed on the server only:
 *   php desk.php addaccount "Name" admin|seller|expo     (prints the code once)
 *   php desk.php newcode "Name"                          (a lost code: a new one, same role)
 * Look-ups (2026-10-24): php desk.php rescan [15] (hourly, from the morning-email cron) | scan <lead id> [--hunter]
 * The records: php desk.php rebuild | check
 * The Peak email sender (2026-11-17): php desk.php servicekey "Peak email" (prints its key once) | emailed sponsor|expo <id> <to> [subject]
 *   | replied sponsor|expo <id> <from> [note]   (HTTP: actions emailed / emailreply with the X-Desk-Key header) */
declare(strict_types=1);
define('DESK', 1);
const BUILD = '2026-11-17.1';
$LOCAL = PHP_SAPI === 'cli-server' || PHP_SAPI === 'cli';
require __DIR__ . '/desk-store.php';
if (!is_dir(DATA_DIR)) { if ($LOCAL) @mkdir(DATA_DIR, 0770, true); else { http_response_code(500); exit('{"ok":false,"error":"No data folder."}'); } }
require __DIR__ . '/scan.php';

function codeHash(string $c): string { return hash('sha256', 'peakdesk|' . $c); }
function keyHash(string $c): string { return hash('sha256', 'peakdesk-service|' . $c); }
/* how long a sign-in lasts: 60 days, a rolling year for Matthew (2026-11-13, his account only) */
function sesDays(string $name): int { return strcasecmp($name, 'Matthew Sharpe') === 0 ? 365 : 60; }
function sesCookie(string $tok, string $name, int $now): void {
    setcookie('peakdesk', $tok, ['expires' => $now + sesDays($name) * 86400, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
}
/* who can own a company: the sellers and admins (and, for expo leads, the expo-only accounts); never the read-only check account */
function owners(string $w): array {
    $o = [];
    foreach (jread('accounts.json', ['codes' => []])['codes'] as $a) {
        $n = (string) ($a['name'] ?? ''); $r = (string) ($a['role'] ?? '');
        if ($n === '' || $n === 'Claude Check') continue;
        if (in_array($r, ['admin', 'seller'], true) || ($w === 'expo' && $r === 'expo')) $o[$n] = 1;
    }
    $o = array_keys($o); sort($o); return $o;
}

/* ---- the command line ---- */
if (PHP_SAPI === 'cli') {
    [$cmd, $name, $role] = [$argv[1] ?? '', $argv[2] ?? '', $argv[3] ?? 'seller'];
    $json = fn($v) => print(json_encode($v, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");
    if ($cmd === 'addaccount' && $name !== '' && in_array($role, ['admin', 'seller', 'expo'], true)) {
        $acc = jread('accounts.json', ['codes' => []]);
        do { $code = (string) random_int(100000, 999999); } while (isset($acc['codes'][codeHash($code)]));
        $acc['codes'][codeHash($code)] = ['name' => clean($name, 40), 'role' => $role, 'at' => time()];
        jwrite('accounts.json', $acc); echo "Code for $name ($role): $code\n"; exit(0);
    }
    /* a fresh code for someone who lost theirs (2026-11-13, Matthew): their old code stops working, their role stays, their sign-ins stay */
    if ($cmd === 'newcode' && $name !== '') {
        $acc = jread('accounts.json', ['codes' => []]); $old = null;
        foreach ($acc['codes'] as $h => $a) if (strcasecmp((string) $a['name'], $name) === 0) { $old = $a; unset($acc['codes'][$h]); }
        if (!$old) { fwrite(STDERR, "No account named $name.\n"); exit(1); }
        do { $code = (string) random_int(100000, 999999); } while (isset($acc['codes'][codeHash($code)]));
        $acc['codes'][codeHash($code)] = ['name' => $old['name'], 'role' => $old['role'], 'at' => time()];
        jwrite('accounts.json', $acc); echo "New code for {$old['name']} ({$old['role']}): $code\n"; exit(0);
    }
    /* a key for a program on this server that writes to the desk (the Peak email sender); kept hashed, printed once */
    if ($cmd === 'servicekey' && $name !== '') {
        $sk = jread('service-keys.json', []); $key = bin2hex(random_bytes(24));
        foreach ($sk as $h => $x) if (strcasecmp((string) $x['name'], $name) === 0) unset($sk[$h]);
        $sk[keyHash($key)] = ['name' => clean($name, 40), 'at' => time()]; jwrite('service-keys.json', $sk);
        echo "Key for $name: $key\n"; exit(0);
    }
    if ($cmd === 'rescan') exit(rescanDue(max(1, min(60, (int) ($name ?: 15)))));
    if ($cmd === 'scan' && $name !== '') {
        $L = recs('sponsor')[$name] ?? null; if (!$L) { fwrite(STDERR, "No such lead.\n"); exit(1); }
        $json(scanAndSave($L, in_array('--hunter', $argv, true) ? 'hunter' : 'site')); exit(0);
    }
    if ($cmd === 'rebuild') { foreach (['sponsor', 'expo'] as $w) echo "$w: rebuilt from the lists and " . rebuild($w) . " log rows\n"; exit(0); }
    /* the counts a migration or deploy is checked against */
    if ($cmd === 'check') {
        $o = [];
        foreach (['sponsor', 'expo'] as $w) {
            $R = recs($w); $st = []; $ct = 0; $tc = 0; $own = 0;
            foreach ($R as $r) { $st[$r['stage']] = ($st[$r['stage']] ?? 0) + 1; $ct += count($r['contacts'] ?? []) + count($r['added'] ?? []); $tc += count($r['touches'] ?? []); if ($r['owner'] !== '') $own++; }
            ksort($st);
            $o[$w] = ['companies' => count($R), 'removed' => count(array_filter($R, fn($r) => !empty($r['off']))), 'contacts' => $ct, 'touches' => $tc, 'owned' => $own, 'stages' => $st,
                'tours' => count(toursOf($w)), 'logRows' => count(logRows(W($w)['log']))];
        }
        $json($o); exit(0);
    }
    if (($cmd === 'emailed' || $cmd === 'replied') && in_array($name, ['sponsor', 'expo'], true) && ($argv[3] ?? '') !== '') {
        $r = $cmd === 'emailed' ? deskEmailed($name, (string) $argv[3], (string) ($argv[4] ?? ''), (string) ($argv[5] ?? '')) : deskReplied($name, (string) $argv[3], (string) ($argv[4] ?? ''), (string) ($argv[5] ?? ''));
        $json($r); exit($r['ok'] ? 0 : 1);
    }
    fwrite(STDERR, "usage: php desk.php addaccount \"Name\" admin|seller|expo | newcode \"Name\" | servicekey \"Name\" | rescan [n] | scan <lead id> [--hunter] | rebuild | check | emailed sponsor|expo <id> <to> [subject] | replied sponsor|expo <id> <from> [note]\n");
    exit(1);
}

/* ---- the web ---- */
final class DeskFail extends Exception {}
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
function out(array $a): void { echo json_encode($a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); exit; }
function fail(string $m, int $code = 400): void { throw new DeskFail($m, $code); }
$action = (string) ($_GET['action'] ?? '');
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$body = $isPost ? (json_decode((string) file_get_contents('php://input'), true) ?: []) : [];
try { out(handle($action, $isPost, is_array($body) ? $body : [])); }
catch (DeskFail $e) { http_response_code($e->getCode() ?: 400); out(['ok' => false, 'error' => $e->getMessage()]); }
catch (Throwable $e) { error_log('peak desk: ' . $e->getMessage() . ' @' . $e->getFile() . ':' . $e->getLine()); http_response_code(500); out(['ok' => false, 'error' => 'The desk hit a problem. Try again.']); }

function handle(string $action, bool $isPost, array $body): array {
    /* the Peak email sender: a key instead of a sign-in (2026-11-17) */
    $key = (string) ($_SERVER['HTTP_X_DESK_KEY'] ?? '');
    if ($key !== '' && in_array($action, ['emailed', 'emailreply'], true)) {
        if (!$isPost) fail('POST required', 405);
        $svc = jread('service-keys.json', [])[keyHash($key)] ?? null; if (!$svc) fail('That key did not work.', 401);
        return service($action, $body, (string) $svc['name']);
    }
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
        foreach ($ses as $k => $s) if (($s['at'] ?? 0) < $now - sesDays((string) ($s['name'] ?? '')) * 86400) unset($ses[$k]);
        $ses[hash('sha256', $tok)] = ['name' => $a['name'], 'role' => $a['role'], 'at' => $now]; jwrite('sessions.json', $ses);
        sesCookie($tok, (string) $a['name'], $now);
        return ['ok' => true, 'name' => $a['name'], 'role' => $a['role']];
    }
    $ses = jread('sessions.json', []); $tokH = hash('sha256', (string) ($_COOKIE['peakdesk'] ?? '')); $me = $ses[$tokH] ?? null;
    if (!$me) fail('Signed out.', 401);
    /* Matthew stays signed in (2026-11-13: "i also need to stay logged in"): a year from his last use, renewed at most once a day */
    if (sesDays((string) $me['name']) > 60 && (int) ($me['at'] ?? 0) < time() - 86400) {
        $ses[$tokH]['at'] = time(); jwrite('sessions.json', $ses); sesCookie((string) $_COOKIE['peakdesk'], (string) $me['name'], time());
    }
    $ME = (string) $me['name']; $ROLE = (string) ($me['role'] ?? '');
    if ($action === 'signout') { unset($ses[$tokH]); jwrite('sessions.json', $ses); setcookie('peakdesk', '', ['expires' => 1, 'path' => '/']); return ['ok' => true]; }
    if ($action === 'me') return ['ok' => true, 'name' => $ME, 'role' => $ROLE];

    /* which list an action works on; the old desk's action names still work (a page left open from before) */
    $ALIAS = ['status' => ['stage', 'sponsor'], 'lead' => ['add', 'sponsor'], 'leaddel' => ['del', 'sponsor'], 'leadback' => ['back', 'sponsor'],
        'xstage' => ['stage', 'expo'], 'xnote' => ['note', 'expo'], 'xnotedel' => ['notedel', 'expo'], 'xnext' => ['next', 'expo'], 'xcontact' => ['contact', 'expo'],
        'xlead' => ['add', 'expo'], 'xdel' => ['del', 'expo'], 'xback' => ['back', 'expo']];
    $BOTH = ['touch', 'touchdel', 'stage', 'owner', 'next', 'note', 'notedel', 'contact', 'add', 'del', 'back', 'tour', 'tourdel', 'tourmove', 'tourout', 'emailed', 'emailreply'];
    $SPONSOR = ['site', 'scan', 'proposal', 'signed', 'sponsor', 'todo', 'tododone', 'tododel', 'packages', 'pl'];
    $legacy = isset($ALIAS[$action]);
    if ($legacy) { [$op, $w] = $ALIAS[$action]; if ($action === 'status') $body['stage'] = $body['status'] ?? ''; }
    else { $op = $action; $w = ($body['world'] ?? '') === 'expo' ? 'expo' : 'sponsor'; }
    if (in_array($op, $SPONSOR, true)) $w = 'sponsor';
    /* the expo-only account (2026-11-13): the Expo leads and nothing else, read or write */
    if ($ROLE === 'expo' && $action !== 'data' && $w !== 'expo') fail('This account is for the Expo leads only.', 403);

    if ($action === 'data') return dataOut($ME, $ROLE);
    if ($ME === 'Claude Check') fail('This account only looks, so nothing is saved.', 403);   /* read-only check account (2026-10-26): everything below saves */
    if (!$isPost) fail('POST required', 405);
    if (!in_array($op, $BOTH, true) && !in_array($op, $SPONSOR, true)) fail('Unknown action.', 404);
    if ($op === 'emailed' || $op === 'emailreply') return service($op, $body + ['world' => $w], $ME);
    return withLock(fn() => act($op, $w, $body, $ME, $legacy));
}

/* ---- what the page gets ---- */
function people(string $w, array $R): array {
    $o = [];
    foreach (($R['contacts'] ?? []) as $c) {
        if ($w === 'expo') { $o[] = ['name' => (string) ($c['name'] ?? ''), 'role' => (string) ($c['role'] ?? ''), 'email' => (string) ($c['email'] ?? ''), 'phone' => (string) ($c['phone'] ?? ''), 'best' => !empty($c['best']),
            'src' => 'Venue research' . (!empty($c['sdate']) ? ', source dated ' . $c['sdate'] : ''), 'conf' => (string) ($c['conf'] ?? ''), 'estat' => (string) ($c['estat'] ?? ''), 'other' => (string) ($c['other'] ?? ''), 'notes' => (string) ($c['notes'] ?? ''), 'srcs' => (array) ($c['srcs'] ?? [])]; continue; }
        $hc = is_numeric($c['conf'] ?? null);
        $o[] = ['name' => (string) ($c['name'] ?? ''), 'role' => (string) ($c['pos'] ?? ''), 'email' => (string) ($c['email'] ?? ''), 'phone' => (string) ($c['phone'] ?? ''), 'best' => !empty($c['pick']),
            'src' => ($c['from'] ?? '') === 'peak' ? 'Peak’s sponsor tracker' : ($hc ? 'Hunter' : 'Our research'), 'conf' => $hc ? (int) $c['conf'] . '%' : ''];
    }
    foreach (($R['added'] ?? []) as $c) $o[] = ['name' => (string) ($c['name'] ?? ''), 'role' => (string) ($c['role'] ?? $c['pos'] ?? ''), 'email' => (string) ($c['email'] ?? ''), 'phone' => (string) ($c['phone'] ?? ''),
        'best' => false, 'src' => 'Added on the desk by ' . ($c['by'] ?? 'someone') . (!empty($c['at']) ? ', ' . date('M j', (int) $c['at']) : ''), 'conf' => '', 'notes' => (string) ($c['notes'] ?? ''), 'added' => true];
    foreach (($R['scan']['hunter']['people'] ?? []) as $c) $o[] = ['name' => (string) ($c['name'] ?? ''), 'role' => (string) ($c['pos'] ?? ''), 'email' => (string) ($c['email'] ?? ''), 'phone' => (string) ($c['phone'] ?? ''),
        'best' => false, 'src' => 'Hunter, ' . date('M j', (int) ($R['scan']['hunter']['at'] ?? time())), 'conf' => (int) ($c['conf'] ?? 0) . '%'];
    return $o;
}
function shape(string $w, array $R): array {
    $R['touches'] = array_values($R['touches'] ?? []); usort($R['touches'], fn($a, $b) => $a['when'] <=> $b['when']);
    $R['last'] = lastTouch($R); $R['tries'] = missCount($R); $R['people'] = people($w, $R);
    unset($R['log']);
    return $R;
}
function worldOut(string $w): array {
    $all = recs($w); if ($w === 'sponsor') { $sc = jread('scans.json', []); foreach ($all as $id => &$r) if (isset($sc[$id])) $r['scan'] = $sc[$id]; unset($r); }
    $live = []; $removed = [];
    foreach ($all as $R) { if (!empty($R['off'])) $removed[] = ['id' => $R['id'], 'name' => $R['name'], 'list' => $R['list'] ?? '', 'cat' => $R['cat'] ?? '', 'stage' => $R['stage'], 'at' => $R['off']['at'], 'by' => $R['off']['by']]; else $live[] = shape($w, $R); }
    $C = W($w); $st = []; foreach ($C['stages'] as $k => $v) $st[] = [$k, $v];
    return ['stages' => $st, 'path' => $C['path'], 'reach' => $C['reach'], 'recs' => $live, 'removed' => $removed, 'tours' => toursOf($w), 'owners' => owners($w),
        'week' => counts($w, weekStart()), 'weekFrom' => date('Y-m-d', weekStart()), 'team' => counts($w, 0)];
}
function dataOut(string $ME, string $ROLE): array {
    $base = ['ok' => true, 'build' => BUILD, 'me' => ['name' => $ME, 'role' => $ROLE], 'methods' => METHODS, 'outs' => OUTS, 'mouts' => MOUTS, 'today' => date('Y-m-d')];
    $X = worldOut('expo'); $xs = jread('expo-seed.json', []);
    $X += ['questions' => $xs['questions'] ?? [], 'venues' => $xs['venues'] ?? [], 'venueNote' => $xs['venueNote'] ?? '', 'built' => $xs['built'] ?? '', 'from' => $xs['from'] ?? ''];
    if ($ROLE === 'expo') return $base + ['expo' => $X];   /* the expo account: the Expo leads and nothing of the sponsors' */
    $S = worldOut('sponsor'); $sd = jread('seed.json', []);
    $S += ['proposals' => propsOf('sponsor'), 'packages' => settingOf('sponsor', 'packages', []), 'pl' => settingOf('sponsor', 'pl', null), 'offer' => $sd['offer'] ?? [], 'better' => $sd['better'] ?? [], 'hunterLeft' => hunterLeft()];
    return $base + ['sponsor' => $S, 'expo' => $X];
}

/* ---- the Peak email sender's actions (key or a seller's sign-in) ---- */
function service(string $op, array $body, string $by): array {
    $w = ($body['world'] ?? '') === 'expo' ? 'expo' : 'sponsor'; $id = (string) ($body['id'] ?? '');
    $r = $op === 'emailed'
        ? deskEmailed($w, $id, (string) ($body['to'] ?? ''), (string) ($body['subject'] ?? ''), $by, (string) ($body['ref'] ?? ''), (int) ($body['at'] ?? 0))
        : deskReplied($w, $id, (string) ($body['from'] ?? ''), (string) ($body['note'] ?? ''), $by, (string) ($body['ref'] ?? ''), !empty($body['stop']));
    if (!$r['ok']) fail($r['error'], (int) ($r['code'] ?? 400));
    unset($r['code']); return $r;
}

/* ---- the saves: each reads the records (with anything new in the log), checks, writes its rows, reads them in ---- */
function needRec(array $X, string $w, string $id, bool $removedOk = false): array {
    $ok = $w === 'expo' ? preg_match('/^x[0-9a-f]{9}$/', $id) : preg_match('/^[a-z0-9]{6,24}$/', $id);
    if (!$ok || !isset($X[$id])) fail($w === 'expo' ? 'No such expo lead.' : 'No such lead.', 404);
    if (!$removedOk && !empty($X[$id]['off'])) fail($w === 'expo' ? 'That lead was removed. Bring it back first.' : 'That company was removed. Bring it back first.', 409);
    return $X[$id];
}
function needTour(string $w, string $tid): array { foreach (toursOf($w) as $t) if ($t['tid'] === $tid) return $t; fail('No such tour.', 404); return []; }
function okSite(string $site): string {
    $site = clean($site, 160); if ($site !== '' && !preg_match('#^(https?://)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(/\S*)?$#i', $site)) fail('That website does not look right.');
    return $site;
}
function okMail(string $e): string { $e = clean($e, 120); if ($e !== '' && !filter_var($e, FILTER_VALIDATE_EMAIL)) fail('That email does not look right.'); return $e; }
function lines($in): array {   /* package lines for a proposal or a signed deal */
    $lines = [];
    foreach ((array) $in as $x) {
        if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 100); $pr = (int) round((float) ($x['price'] ?? 0)); $q = max(1, min(50, (int) ($x['qty'] ?? 1)));
        if ($nm === '' || $pr < 0 || $pr > 1000000) continue; $lines[] = ['name' => $nm, 'price' => $pr, 'qty' => $q, 'per' => clean($x['per'] ?? '', 20)];
    }
    return $lines;
}
function money0($v): ?int { return ($v === null || $v === '') ? null : max(0, min(10000000, (int) round((float) preg_replace('/[^\d.]/', '', (string) $v)))); }

function act(string $op, string $w, array $body, string $ME, bool $legacy): array {
    sync($w, true);
    $X = recs($w); $C = W($w); $T = $C['T']; $now = time(); $id = (string) ($body['id'] ?? $body['lead'] ?? '');
    $canOwn = in_array($ME, owners($w), true);
    $sameName = function (string $n) use ($X, $w): void {
        if ($n === '') fail($w === 'expo' ? 'Give the organisation name.' : 'Give the company name.');
        foreach ($X as $r) if (strtolower(trim((string) $r['name'])) === strtolower(trim($n)))
            fail($w === 'expo' ? (!empty($r['off']) ? 'That lead was removed. Bring it back from Removed.' : 'That organisation is already in the Expo leads.')
                : (!empty($r['off']) ? 'That company was removed. Bring it back from Removed companies.' : 'That company is already on the list.'));
    };
    $newLead = function () use ($body, $ME): array {   /* a sponsor company we add, as a lead or as a sponsor already signed */
        $site = okSite((string) ($body['site'] ?? '')); $n = clean($body['name'] ?? '', 100);
        return ['id' => substr(sha1('added|' . $n . '|' . microtime()), 0, 10), 'list' => 'added', 'name' => $n, 'kind' => clean($body['kind'] ?? '', 60), 'score' => null, 'why' => clean($body['why'] ?? '', 400), 'route' => '', 'phone' => clean($body['phone'] ?? '', 40), 'site' => $site, 'by' => $ME];
    };
    switch ($op) {
        /* one touch: how they were reached and how it went (2026-11-17) */
        case 'touch': {
            $R = needRec($X, $w, $id); $m = (string) ($body['m'] ?? ''); $o = (string) ($body['out'] ?? '');
            if (!isset(METHODS[$m]) || $m === 'other') fail('Pick how you reached them.');
            if (!in_array($o, MOUTS[$m], true)) fail('Pick how it went.');
            $when = (int) ($body['when'] ?? 0); if ($when === 0) $when = $now; elseif ($when > $now + 600 || $when < $now - 30 * 86400) fail('Pick a time in the last 30 days.');
            $fu = (string) ($body['fu'] ?? ''); if ($fu !== '' && (!okDay($fu) || $fu < date('Y-m-d'))) fail('Pick a follow-up day from today on.');
            $k = newKey();
            commit($w, touchRows($w, $R, $k, ['m' => $m, 'out' => $o, 'note' => clean($body['note'] ?? '', 600), 'when' => $when], $ME, $canOwn, $fu, clean($body['fuWhat'] ?? '', 160), $now));
            $R = recs($w)[$id]; return ['ok' => true, 'k' => $k, 'stage' => $R['stage'], 'owner' => $R['owner'], 'tries' => missCount($R)];
        }
        /* undo a touch: gone from the card (the log keeps it); the stage it moved to goes back if nothing has moved it since */
        case 'touchdel': {
            $R = needRec($X, $w, $id); $k = (string) ($body['k'] ?? ''); $t = null; foreach ($R['touches'] as $x) if ($x['k'] === $k) $t = $x;
            if (!$t) fail('No such touch.', 404);
            $rows = [['t' => $T['touchdel'], 'id' => $id, 'k' => $k, 'by' => $ME, 'at' => $now]];
            $h = end($R['hist']) ?: null;
            if ($h && ($h['tk'] ?? '') === $k && $R['stage'] === $h['to'] && isset($t['from'])) $rows[] = rowStage($w, $id, (string) $t['from'], $ME, $now, ['undo' => $k]);
            commit($w, $rows); return ['ok' => true, 'stage' => recs($w)[$id]['stage']];
        }
        case 'stage': {
            $R = needRec($X, $w, $id); $st = stageKey($w, (string) ($body['stage'] ?? '')); if (!isset($C['stages'][$st])) fail('Pick a stage.');
            $why = clean($body['why'] ?? '', 200); $extra = []; $rows = [];
            if ($st === 'notnow') {
                $back = (string) ($body['back'] ?? ''); if ($back === '' && $legacy) $back = date('Y-m-d', strtotime('+30 days'));
                if (!okDay($back) || $back < date('Y-m-d')) fail('Pick the day to come back to them.');
                $extra = ['back' => $back, 'why' => $why];
                $rows[] = rowStage($w, $id, $st, $ME, $now, $extra);
                $rows[] = rowNext($w, $id, ['date' => $back, 'what' => 'Come back to them' . ($why !== '' ? ': ' . $why : '')], $ME, $now);
            } elseif ($st === 'lost') {
                if ($why === '' && $legacy) $why = 'Said no';
                if ($why === '') fail('Say why it was lost.');
                $rows[] = rowStage($w, $id, $st, $ME, $now, ['why' => $why]);
                if (!empty($R['next'])) $rows[] = rowNext($w, $id, null, $ME, $now);
            } else {
                if ($st === $R['stage'] && !in_array($st, ['quote', 'booked'], true)) return ['ok' => true, 'stage' => $st];
                if ($w === 'expo' && $st === 'quote') $extra['quote'] = ['amount' => money0($body['amount'] ?? null), 'note' => clean($body['note'] ?? '', 300)];
                if ($w === 'expo' && $st === 'booked') { $d = (string) ($body['date'] ?? ''); if ($d !== '' && !okDay($d)) fail('Pick the event date.'); $extra['booked'] = ['date' => $d, 'amount' => money0($body['amount'] ?? null), 'note' => clean($body['note'] ?? '', 300)]; }
                $rows[] = rowStage($w, $id, $st, $ME, $now, $extra);
            }
            commit($w, $rows); return ['ok' => true, 'stage' => $st];
        }
        /* who works it: one of the sellers, or nobody (Open) */
        case 'owner': {
            needRec($X, $w, $id); $o = clean($body['owner'] ?? '', 60);
            if ($o !== '' && !in_array($o, owners($w), true)) fail('Pick someone on the desk.');
            commit($w, [rowOwner($w, $id, $o, $ME, $now)]); return ['ok' => true, 'owner' => $o];
        }
        case 'next': {
            needRec($X, $w, $id); $d = (string) ($body['date'] ?? ''); $wh = clean($body['what'] ?? '', 160);
            if ($d !== '' && !okDay($d)) fail('Pick a date.');
            commit($w, [rowNext($w, $id, $d === '' && $wh === '' ? null : ['date' => $d, 'what' => $wh], $ME, $now)]); return ['ok' => true];
        }
        case 'note': {
            needRec($X, $w, $id); $n = clean($body['note'] ?? '', 1000); if ($n === '') fail('Write the note first.');
            commit($w, [['t' => $T['note'], 'id' => $id, 'note' => $n, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        case 'notedel': {
            $R = needRec($X, $w, $id); $nk = (string) ($body['nk'] ?? ''); if (!in_array($nk, array_column($R['notes'], 'k'), true)) fail('No such note.', 404);
            commit($w, [['t' => $T['notedel'], 'id' => $id, 'nk' => $nk, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        case 'contact': {
            needRec($X, $w, $id);
            $role = clean($body['role'] ?? $body['pos'] ?? '', 80);
            $c = ['name' => clean($body['name'] ?? '', 80), 'email' => okMail((string) ($body['email'] ?? '')), 'phone' => clean($body['phone'] ?? '', 40)];
            $c = $w === 'expo' ? $c + ['role' => $role, 'notes' => clean($body['notes'] ?? '', 400)] : $c + ['pos' => $role];
            if ($c['name'] === '' && $c['email'] === '' && $c['phone'] === '') fail('Give a name, email or phone.');
            commit($w, [['t' => $T['contact'], 'id' => $id, 'contact' => $c, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        case 'add': {
            if ($w === 'sponsor') {
                $sameName(clean($body['name'] ?? '', 100)); $lead = $newLead(); $rows = [['t' => 'lead', 'id' => $lead['id'], 'lead' => $lead, 'by' => $ME, 'at' => $now]];
                if ($canOwn) $rows[] = rowOwner($w, $lead['id'], $ME, $ME, $now);
                commit($w, $rows); return ['ok' => true, 'id' => $lead['id']];
            }
            /* an expo lead added by hand: it lives in the Expo leads only */
            $n = clean($body['name'] ?? '', 100); $sameName($n);
            $site = okSite((string) ($body['site'] ?? '')); if ($site !== '' && !preg_match('#^https?://#i', $site)) $site = 'https://' . $site;
            $em = okMail((string) ($body['email'] ?? '')); $pri = (int) ($body['pri'] ?? 2); if ($pri < 1 || $pri > 3) $pri = 2;
            $nid = 'x' . substr(sha1('expo-added|' . $n . '|' . microtime()), 0, 9);
            $org = ['id' => $nid, 'pri' => $pri, 'cat' => clean($body['cat'] ?? '', 60), 'name' => $n, 'events' => clean($body['events'] ?? '', 400), 'venue' => clean($body['venue'] ?? '', 160),
                'size' => clean($body['size'] ?? '', 120), 'last' => '', 'why' => clean($body['why'] ?? '', 400), 'site' => $site, 'route' => '', 'srcs' => [], 'checked' => '', 'contacts' => [], 'by' => $ME, 'mine' => true];
            $c = ['name' => clean($body['cname'] ?? '', 80), 'role' => clean($body['crole'] ?? '', 80), 'email' => $em, 'phone' => clean($body['phone'] ?? '', 40), 'notes' => ''];
            $rows = [['t' => 'xlead', 'id' => $nid, 'org' => $org, 'by' => $ME, 'at' => $now]];
            if ($c['name'] !== '' || $c['email'] !== '' || $c['phone'] !== '') $rows[] = ['t' => 'xcontact', 'id' => $nid, 'contact' => $c, 'by' => $ME, 'at' => $now];
            if ($canOwn) $rows[] = rowOwner($w, $nid, $ME, $ME, $now);
            commit($w, $rows); return ['ok' => true, 'id' => $nid];
        }
        /* take a company off the desk (2026-10-24); everything stays in the log, and it can come back */
        case 'del': { needRec($X, $w, $id); commit($w, [['t' => $T['del'], 'id' => $id, 'by' => $ME, 'at' => $now]]); return ['ok' => true]; }
        case 'back': {
            $R = needRec($X, $w, $id, true); if (empty($R['off'])) fail($w === 'expo' ? 'That lead is in the Expo leads already.' : 'That company is on the desk already.');
            commit($w, [['t' => $T['back'], 'id' => $id, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        /* tours at Peak, for a sponsor or an expo lead: booking one moves it to its tour stage */
        case 'tour': {
            $R = needRec($X, $w, $id); $d = (string) ($body['date'] ?? ''); $tm = (string) ($body['time'] ?? '');
            if (!okDay($d) || $d < date('Y-m-d')) fail('Pick today or a later day.');
            if (!okTime($tm)) fail('Pick a time.');
            $tid = bin2hex(random_bytes(5));
            $rows = [['t' => $T['tour'], 'tid' => $tid, 'id' => $id, 'lead' => $id, 'date' => $d, 'time' => $tm, 'who' => clean($body['who'] ?? '', 120), 'note' => clean($body['note'] ?? '', 400), 'by' => $ME, 'at' => $now]];
            $to = forwardTo($w, (string) $R['stage'], $C['tourSt']); if ($to !== '') $rows[] = rowStage($w, $id, $to, $ME, $now);
            if ($canOwn && (string) $R['owner'] === '') $rows[] = rowOwner($w, $id, $ME, $ME, $now);
            commit($w, $rows); return ['ok' => true, 'tid' => $tid];
        }
        case 'tourdel': { $tid = (string) ($body['tid'] ?? ''); needTour($w, $tid); commit($w, [['t' => $T['tourdel'], 'tid' => $tid, 'by' => $ME, 'at' => $now]]); return ['ok' => true]; }
        case 'tourmove': {
            $tid = (string) ($body['tid'] ?? ''); needTour($w, $tid); $d = (string) ($body['date'] ?? ''); $tm = (string) ($body['time'] ?? '');
            if (!okDay($d) || $d < date('Y-m-d')) fail('Pick today or a later day.');
            if (!okTime($tm)) fail('Pick a time.');
            commit($w, [['t' => $T['tourmove'], 'tid' => $tid, 'date' => $d, 'time' => $tm, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        /* how a tour went: they came (an in-person touch) or did not show */
        case 'tourout': {
            $tid = (string) ($body['tid'] ?? ''); $t = needTour($w, $tid); $o = (string) ($body['out'] ?? '');
            if (!in_array($o, ['toured', 'noshow'], true)) fail('Pick how it went.');
            $rows = [['t' => $T['tourout'], 'tid' => $tid, 'out' => $o, 'by' => $ME, 'at' => $now]];
            $R = $X[(string) ($t['lead'] ?? '')] ?? null;
            if ($R && empty($R['off'])) {
                $when = (int) strtotime($t['date'] . ' ' . $t['time']); if ($when <= 0 || $when > $now) $when = $now;
                $rows[] = rowTouch($w, (string) $R['id'], newKey(), ['m' => 'inperson', 'out' => $o, 'note' => $o === 'toured' ? 'Came for the tour at Peak' : 'Did not come for the tour', 'when' => $when, 'tid' => $tid], $ME, $now);
            }
            commit($w, $rows); return ['ok' => true];
        }
        /* ---- sponsors only ---- */
        case 'site': {
            needRec($X, $w, $id); $site = clean($body['site'] ?? '', 160);
            if (!preg_match('#^(https?://)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(/\S*)?$#i', $site)) fail('That website does not look right.');
            commit($w, [['t' => 'site', 'id' => $id, 'site' => $site, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        case 'scan': {
            /* look a company up now: its website, or (hunter) the people Hunter knows at its domain */
            $L = needRec($X, $w, $id); $hun = !empty($body['hunter']);
            @set_time_limit(120);
            if ($hun) {
                if (hunterDomain($L) === '') fail('Add their website first: Hunter searches by it.');
                $left = hunterLeft(true); if ($left === null) fail('Hunter is not set up here.'); if ($left < 1) fail('No Hunter searches left this month.');
                $r = scanAndSave($L, 'hunter'); if ($r['hunter']['err'] !== '') fail($r['hunter']['err']);
                return ['ok' => true, 'found' => count($r['hunter']['people'])];
            }
            if (siteOf($L) === '' && srcUrl($L) === '') fail('Add their website first.');
            $prev = jread('scans.json', [])[$id] ?? null;
            if ($prev && ($prev['at'] ?? 0) > time() - 60) return ['ok' => true, 'scan' => $prev];   /* looked up a minute ago */
            return ['ok' => true, 'scan' => scanAndSave($L, 'site')];
        }
        case 'proposal': {
            $R = needRec($X, $w, $id); $lines = lines($body['lines'] ?? []);
            if (!$lines) fail('Add at least one package.');
            $pid = bin2hex(random_bytes(5)); $total = array_sum(array_map(fn($x) => $x['price'] * $x['qty'], $lines));
            $rows = [['t' => 'proposal', 'pid' => $pid, 'id' => $id, 'lead' => $id, 'company' => $R['name'], 'to' => clean($body['to'] ?? '', 120), 'lines' => $lines, 'total' => $total, 'note' => clean($body['note'] ?? '', 1200), 'by' => $ME, 'at' => $now]];
            $to = forwardTo($w, (string) $R['stage'], 'proposal'); if ($to !== '') $rows[] = rowStage($w, $id, $to, $ME, $now);
            commit($w, $rows); return ['ok' => true, 'pid' => $pid, 'total' => $total];
        }
        case 'signed':
        case 'sponsor': {
            /* signed: what they bought, from when, for how long (2026-10-24). sponsor: a sponsor we just got, in one step */
            $d = (string) ($body['start'] ?? ''); $m = (int) ($body['months'] ?? 12);
            if ($op === 'sponsor') $sameName(clean($body['name'] ?? '', 100)); else $R = needRec($X, $w, $id);
            if (!okDay($d)) fail('Pick the start date.');
            if ($m < 1 || $m > 60) fail('Give the length in months (1 to 60).');
            $lines = lines($body['lines'] ?? []);
            $sg = ['lines' => $lines, 'total' => array_sum(array_map(fn($x) => $x['price'] * $x['qty'], $lines)), 'start' => $d, 'months' => $m, 'who' => clean($body['who'] ?? '', 120), 'note' => clean($body['note'] ?? '', 600)];
            $rows = [];
            if ($op === 'sponsor') {
                $c = ['name' => clean($body['cname'] ?? '', 80), 'pos' => clean($body['cpos'] ?? '', 80), 'email' => okMail((string) ($body['cemail'] ?? '')), 'phone' => clean($body['cphone'] ?? '', 40)];
                $lead = $newLead(); $id = $lead['id']; $R = ['stage' => 'new', 'owner' => ''];
                $rows[] = ['t' => 'lead', 'id' => $id, 'lead' => $lead, 'by' => $ME, 'at' => $now];
                if ($c['name'] !== '' || $c['email'] !== '' || $c['phone'] !== '') $rows[] = ['t' => 'contact', 'id' => $id, 'contact' => $c, 'by' => $ME, 'at' => $now];
            }
            $rows[] = ['t' => 'signed', 'id' => $id, 'signed' => $sg, 'by' => $ME, 'at' => $now];
            if ($R['stage'] !== 'signed') $rows[] = rowStage($w, $id, 'signed', $ME, $now);
            if ($canOwn && (string) $R['owner'] === '') $rows[] = rowOwner($w, $id, $ME, $ME, $now);
            commit($w, $rows); return ['ok' => true, 'id' => $id];
        }
        case 'todo': {
            needRec($X, $w, $id); $tx = clean($body['text'] ?? '', 160); if ($tx === '') fail('Write the to-do first.');
            commit($w, [['t' => 'todo', 'id' => $id, 'k' => bin2hex(random_bytes(4)), 'text' => $tx, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        case 'tododone':
        case 'tododel': {
            $R = needRec($X, $w, $id); $k = (string) ($body['k'] ?? '');
            if (!in_array($k, array_column($R['todos'], 'k'), true)) fail('No such to-do.', 404);
            commit($w, [['t' => $op, 'id' => $id, 'k' => $k, 'done' => !empty($body['done']), 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        case 'packages': {
            /* the seller sets packages too (2026-10-21, Matthew: "brandons code gives as much permissions as mine does other then full control of the
               application"); what stays the admin's is who can sign in (accounts are made on the server only) */
            $pk = [];
            foreach ((array) ($body['packages'] ?? []) as $x) { if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 80); $pr = (int) round((float) ($x['price'] ?? 0)); if ($nm === '' || $pr < 0 || $pr > 1000000) continue; $pk[] = ['k' => substr(sha1($nm), 0, 6), 'name' => $nm, 'price' => $pr, 'per' => clean($x['per'] ?? 'year', 20), 'note' => clean($x['note'] ?? '', 160)]; }
            if (!$pk) fail('Keep at least one package.');
            commit($w, [['t' => 'packages', 'packages' => $pk, 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
        case 'pl': {
            /* profit and loss (2026-10-24): every figure is typed in by someone; the page does the sums */
            $per = fn($v, array $ok, string $def) => in_array($v, $ok, true) ? $v : $def;
            $money = fn($v) => ($v === null || $v === '') ? null : max(0, min(10000000, (int) round((float) $v)));
            $sv = []; foreach (array_slice((array) ($body['services'] ?? []), 0, 40) as $x) { if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 80); if ($nm === '') continue; $sv[] = ['name' => $nm, 'price' => $money($x['price'] ?? null), 'per' => $per($x['per'] ?? '', ['year', 'month', 'once'], 'year'), 'cost' => $money($x['cost'] ?? null), 'costPer' => $per($x['costPer'] ?? '', ['year', 'month', 'once'], 'year')]; }
            $rn = []; foreach (array_slice((array) ($body['running'] ?? []), 0, 40) as $x) { if (!is_array($x)) continue; $nm = clean($x['name'] ?? '', 80); if ($nm === '') continue; $rn[] = ['name' => $nm, 'amount' => $money($x['amount'] ?? null) ?? 0, 'per' => $per($x['per'] ?? '', ['month', 'year'], 'month')]; }
            commit($w, [['t' => 'pl', 'pl' => ['services' => $sv, 'running' => $rn], 'by' => $ME, 'at' => $now]]); return ['ok' => true];
        }
    }
    fail('Unknown action.', 404); return [];
}
