<?php
declare(strict_types=1);
/* The Peak email admin page's API (index.php). Everything needs the sign-in code except signin itself. A POST must carry X-PM: 1 (a form
   from another site cannot set it). Codes, tokens and the app secret never leave the server. */
require __DIR__ . '/lib.php';
header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff'); header('X-Robots-Tag: noindex');
function out(array $a): never { echo json_encode($a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); exit; }
function fail(string $m, int $code = 400, array $more = []): never { http_response_code($code); out(['ok' => false, 'error' => $m] + $more); }
if (!pmReady()) fail('The Peak email data folder is not set up on the server.', 500);

$action = (string) ($_GET['action'] ?? '');
$isPost = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST';
$body = $isPost ? (json_decode((string) file_get_contents('php://input'), true) ?: []) : [];
if ($isPost && ($_SERVER['HTTP_X_PM'] ?? '') !== '1') fail('Bad request.');
$https = ($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off';
$path = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? PM_PATH . '/api.php'))), '/') . '/';
$now = pmNow(); $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');

/* ---- inside Outbox (2026-11-17) Outbox's own sign-in is the only way in: this copy's code and cookie are not used ---- */
if (function_exists('pmSiteSignedIn')) {
    if ($action === 'signin' || $action === 'signout') fail('Sign in and out on the Outbox page.', 403);
    if (!pmSiteSignedIn()) fail('Sign in to Outbox first.', 401, ['signin' => true, 'outbox' => true]);
}
/* ---- sign-in: one code (Matthew's), kept hashed; ten wrong tries in 15 minutes from one place, or 50 in an hour anywhere, pause it ---- */
elseif ($action === 'signin') {
    if (!$isPost) fail('POST required', 405);
    $tries = pmJ('tries.json', []); $mine = array_values(array_filter((array) ($tries[$ip] ?? []), fn($t) => $t > $now - 900));
    $all = 0; foreach ($tries as $k => $ts) { $tries[$k] = array_values(array_filter((array) $ts, fn($t) => $t > $now - 3600)); if (!$tries[$k]) unset($tries[$k]); else $all += count($tries[$k]); }
    if (count($mine) >= 10) fail('Too many tries. Wait 15 minutes.', 429);
    if ($all >= 50) fail('Sign-in is paused for a while after too many wrong codes.', 429);
    $code = strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', (string) ($body['code'] ?? '')));
    $hash = trim((string) @file_get_contents(pmData() . '/code.hash'));
    if ($hash === '' || strlen($code) < 8 || !password_verify($code, $hash)) { $mine[] = $now; $tries[$ip] = $mine; pmW('tries.json', $tries); fail('That code did not work.', 401); }
    $tok = bin2hex(random_bytes(24)); $ses = pmJ('sessions.json', []);
    foreach ($ses as $k => $s) if ((int) ($s['last'] ?? 0) < $now - 365 * 86400) unset($ses[$k]);
    $ses[hash('sha256', $tok)] = ['at' => $now, 'last' => $now]; pmW('sessions.json', $ses);
    setcookie('peakmail', $tok, ['expires' => $now + 365 * 86400, 'path' => $path, 'httponly' => true, 'samesite' => 'Lax', 'secure' => $https]);
    out(['ok' => true]);
}
if (!function_exists('pmSiteSignedIn')) {
    $tok = (string) ($_COOKIE['peakmail'] ?? ''); $ses = pmJ('sessions.json', []); $tokH = $tok !== '' ? hash('sha256', $tok) : '';
    if ($tokH === '' || !isset($ses[$tokH])) fail('Sign in first.', 401, ['signin' => true]);
    if ((int) $ses[$tokH]['last'] < $now - 3600) { $ses[$tokH]['last'] = $now; pmW('sessions.json', $ses); }   /* a rolling year */
    if ($action === 'signout') { unset($ses[$tokH]); pmW('sessions.json', $ses); setcookie('peakmail', '', ['expires' => 1, 'path' => $path]); out(['ok' => true]); }
}
$BY = 'Matthew Sharpe';
$needList = function () use ($body): string { $l = (string) ($body['list'] ?? $_GET['list'] ?? ''); if (!isset(PM_LISTS[$l])) fail('Which list?'); return $l; };

/* ---- what the page shows ---- */
function pmWhat(array $r): string {
    $l = PM_LISTS[$r['l'] ?? ''] ?? ''; $to = (string) ($r['to'] ?? '');
    return match ((string) ($r['t'] ?? '')) {
        'sent' => 'Sent to ' . $to . ' (' . $l . ')',
        'fail' => 'Could not send to ' . $to . ': ' . ($r['why'] ?? '') . (!empty($r['final']) ? ' (will not try again)' : ''),
        'reply' => (!empty($r['stop']) ? 'STOP reply from ' : 'Reply from ') . $to . (!empty($r['before']) ? ' (wrote before we emailed: not emailed)' : '') . (is_array($r['mail'] ?? null) ? ' (in ' . (($r['mail']['mb'] ?? '') === PM_SHARED ? PM_SHARED_NAME : 'Matthew\'s mailbox') . ', on the Peak desk card)' : ''),
        'auto' => 'Auto-reply from ' . $to . (!empty($r['org']) ? ' (shown on the Peak desk card, not counted as a reply)' : ''),
        'fromwarn' => ($r['kind'] ?? '') === 'sendas' ? PM_SENDAS . ': ' . ($r['why'] ?? '') : 'Could not open ' . PM_SHARED_NAME . ': ' . ($r['why'] ?? ''),
        'bounce' => 'Bounced: ' . $to . ' (never emailed again)',
        'unsub' => 'Unsubscribed: ' . $to,
        'click' => 'Clicked a link: ' . $to,
        'booked' => 'Booked a time: ' . $to . (!empty($r['desk']) ? ' (on the Peak desk\'s booking page)' : '') . ', ' . date('D M j', (int) strtotime((string) ($r['date'] ?? ''))) . ' ' . ($r['time'] ?? '') . ' (on the Peak desk as a tour)',
        'notify' => empty($r['ok']) ? 'Could not email Matthew the heads-up (' . ($r['stage'] ?? '') . ')' : '',
        'desk' => empty($r['ok']) ? 'Could not update the Peak desk (' . ($r['why'] ?? '') . ')' . (!empty($r['final']) ? ': given up' : ': the next run tries again') : '',
        'start' => 'Started ' . $l . ' (' . ($r['by'] ?? '') . ')',
        'pause' => 'Paused ' . $l . ' (' . ($r['by'] ?? '') . (!empty($r['why']) ? ': ' . $r['why'] : '') . ')',
        'done' => $l . ' is done: everyone on it has been emailed',
        'template' => 'Saved the ' . $l . ' email',
        'settings' => 'Saved the settings',
        'import' => 'Brought the lists in from the Peak desk',
        'connected' => 'Microsoft connected: ' . ($r['as'] ?? ''),
        'disconnected' => 'Microsoft disconnected',
        'mslost' => 'The Microsoft sign-in stopped working: ' . ($r['why'] ?? ''),
        'msadmin' => 'Microsoft asked for Peak\'s admin to approve the app',
        'tourmail' => (!empty($r['test']) ? 'Test tour confirmation' : (($r['method'] ?? '') === 'CANCEL' ? 'Tour cancellation' : 'Tour confirmation')) . (!empty($r['ok']) ? ' sent to ' : ' NOT sent to ') . $to
            . ((string) ($r['company'] ?? '') !== '' ? ' (' . $r['company'] . ')' : '') . ', from the Peak desk by ' . ($r['by'] ?? '') . (empty($r['ok']) ? ': ' . ($r['why'] ?? '') : ''),
        'deskmail' => 'Desk email ' . (!empty($r['re']) ? '(a reply) ' : '') . (!empty($r['ok']) ? 'sent to ' : 'NOT sent to ') . $to . ((string) ($r['company'] ?? '') !== '' ? ' (' . $r['company'] . ')' : '') . ', from the Peak desk by ' . ($r['by'] ?? '') . (empty($r['ok']) ? ': ' . ($r['why'] ?? '') : ''),
        'suppress' => 'Added to do-not-email: ' . $to,
        'unsuppress' => 'Taken off do-not-email: ' . $to,
        default => '',
    };
}
function pmView(): array {
    $S = pmState(); $lj = pmJ('lists.json', null); $st = pmStats($S); $L = [];
    foreach (PM_LISTS as $k => $n) $L[$k] = ['name' => $n, 'template' => $S['templates'][$k], 'draft' => pmIsDraft($S['templates'][$k]), 'blocks' => pmStartBlocks($S, $k), 'by' => $S['lists'][$k]['by'], 'started' => $S['lists'][$k]['started']] + $st[$k];
    $act = []; foreach (array_reverse(array_slice(pmRows(), -400)) as $r) { if (in_array($r['t'] ?? '', ['scan'], true)) continue; $w = pmWhat($r); if ($w !== '') $act[] = ['at' => (int) $r['at'], 'what' => $w]; if (count($act) >= 40) break; }
    $sup = []; foreach ($S['suppressed'] as $a => $why) $sup[] = ['to' => $a, 'why' => $why];
    $rl = @file(pmData() . '/run.log', FILE_IGNORE_NEW_LINES) ?: [];
    $first = $S['firstSent']; $today = date('Y-m-d', pmNow());
    return ['ok' => true, 'conn' => pmConn(), 'from' => pmFromStatus($S['settings']), 'shared' => ['email' => PM_SHARED, 'name' => PM_SHARED_NAME], 'oauth' => pmJ('oauth-last.json', null), 'settings' => $S['settings'], 'window' => pmWindowText($S['settings']), 'inWindow' => pmInWindow($S['settings'], pmNow()),
        'rampToday' => !empty($S['settings']['ramp']) && (!$first || date('Y-m-d', $first) === $today), 'rampMax' => PM_RAMP, 'rateMax' => PM_RATE_MAX,
        'lists' => $L, 'imported' => (int) ($lj['at'] ?? 0), 'activity' => $act, 'suppressed' => array_slice($sup, 0, 300), 'suppressedCount' => count($sup),
        'runs' => array_slice($rl, -6), 'book' => ['week' => pmWeekText((array) $S['settings']['book']['week']), 'kinds' => PM_BOOK_KINDS, 'open' => count(pmBookSlots($S, 500)), 'next' => pmBookSlots($S, 3)],
        'deskPending' => !empty($S['settings']['deskNotes']) ? count(pmDeskPending()) : 0, 'dns' => pmJ('dns.json', null), 'adminHelp' => PM_ADMIN_HELP, 'now' => pmNow()];
}
if ($action === 'state') out(pmView());

if ($action === 'people') {
    $l = $needList(); $S = pmState(); $lj = pmJ('lists.json', ['lists' => [], 'left' => []]); $fresh = pmImport($S['settings']);
    $ok = []; foreach ($fresh['lists'][$l] ?? [] as $p) if ($p['hold'] === '') $ok[$p['to']] = 1;
    $rows = [];
    foreach ((array) ($lj['lists'][$l] ?? []) as $p) {
        $x = $S['people'][$p['to']] ?? null; $b = pmBlocked($S, $p['to']);
        $state = $p['hold'] !== '' ? 'held: ' . $p['hold'] : ($x && $x['sent'] ? 'sent ' . date('M j g:i a', $x['sent']) : ($b !== '' ? $b : (!isset($ok[$p['to']]) ? 'no longer on the desk list' : 'waiting')));
        $tags = []; if ($x) { if ($x['booked']) $tags[] = 'booked ' . date('M j', (int) strtotime($x['booked']['date'])) . ' ' . $x['booked']['time']; if ($x['reply']) $tags[] = 'replied'; if ($x['bounce']) $tags[] = 'bounced'; if ($x['unsub']) $tags[] = 'unsubscribed'; if ($x['clicks']) $tags[] = 'clicked'; if ($x['auto']) $tags[] = 'auto-reply'; }
        $rows[] = ['to' => $p['to'], 'person' => $p['person'], 'role' => $p['role'], 'company' => $p['company'], 'town' => $p['town'], 'flags' => $p['flags'], 'state' => $state, 'tags' => $tags, 'src' => $p['src'], 'on' => $p['hold'] === '',
            'opens' => $x ? $x['opens'] : 0, 'open1' => $x ? $x['open1'] : 0, 'openLast' => $x ? $x['openLast'] : 0, 'clicks' => $x ? $x['clicks'] : 0, 'sent' => $x ? $x['sent'] : 0];
    }
    out(['ok' => true, 'people' => $rows, 'left' => (array) ($lj['left'][$l] ?? [])]);
}
if ($action === 'preview') {
    $l = $needList(); $S = pmState(); $q = array_slice(pmQueue($S, $l), 0, 3); $o = [];
    foreach ($q as $p) { $m = pmRender($p, $S['templates'][$l], $S['settings'], false); $o[] = $m + ['flags' => $p['flags'], 'company' => $p['company']]; }
    out(['ok' => true, 'messages' => $o, 'draft' => pmIsDraft($S['templates'][$l])]);
}

if (!$isPost) fail('POST required', 405);
switch ($action) {
    case 'connect': {
        $r = pmAuthStart($BY); if (isset($r['error'])) fail($r['error'], 500);
        setcookie(pmCookieName(), $r['cookie'], ['expires' => $now + PM_TTL, 'path' => pmCookiePath(), 'httponly' => true, 'samesite' => 'Lax', 'secure' => $https]);   /* sent back to wherever Microsoft returns */
        @unlink(pmData() . '/oauth-last.json');
        out(['ok' => true, 'url' => $r['url']]);
    }
    case 'disconnect': {
        $c = pmConn(); @unlink(pmData() . '/ms.json'); pmLog(['t' => 'disconnected', 'by' => $BY, 'as' => (string) ($c['email'] ?? '')]);
        foreach (PM_LISTS as $k => $n) if (pmState()['lists'][$k]['status'] === 'running') pmLog(['t' => 'pause', 'l' => $k, 'by' => $BY, 'why' => 'Microsoft disconnected']);
        out(['ok' => true, 'note' => 'To remove the app from the Microsoft account too: myapps.microsoft.com, signed in as that mailbox.']);
    }
    case 'settings': {
        $S = pmState(); $s = $S['settings']; $in = (array) ($body['s'] ?? []);
        if (isset($in['rate'])) { $r = (int) $in['rate']; if ($r < 1 || $r > PM_RATE_MAX) fail('Per hour: 1 to ' . PM_RATE_MAX . '.'); $s['rate'] = $r; }
        if (isset($in['days'])) { $d = array_values(array_unique(array_filter(array_map('intval', (array) $in['days']), fn($x) => $x >= 1 && $x <= 7))); sort($d); if (!$d) fail('Pick at least one day.'); $s['days'] = $d; }
        if (isset($in['from']) || isset($in['to'])) { $f = (int) ($in['from'] ?? $s['from']); $t = (int) ($in['to'] ?? $s['to']); if ($f < 0 || $t > 24 || $f >= $t) fail('The window must start before it ends (hours 0 to 24).'); $s['from'] = $f; $s['to'] = $t; }
        if (isset($in['ramp'])) $s['ramp'] = (bool) $in['ramp'];
        if (isset($in['deskNotes'])) $s['deskNotes'] = (bool) $in['deskNotes'];
        if (isset($in['deskSkip'])) $s['deskSkip'] = (bool) $in['deskSkip'];
        if (isset($in['opens'])) $s['opens'] = (bool) $in['opens'];
        if (isset($in['book']) && is_array($in['book'])) {
            $bi = $in['book']; $bk = $s['book'];
            if (isset($bi['on'])) $bk['on'] = (bool) $bi['on'];
            if (isset($bi['kind'])) { if (!isset(PM_BOOK_KINDS[$bi['kind']])) fail('Pick a tour or a call.'); $bk['kind'] = (string) $bi['kind']; }
            if (isset($bi['mins'])) { $v = (int) $bi['mins']; if ($v < 15 || $v > 120) fail('A booking is 15 to 120 minutes.'); $bk['mins'] = $v; }
            if (isset($bi['ahead'])) { $v = (int) $bi['ahead']; if ($v < 1 || $v > 60) fail('Show 1 to 60 days ahead.'); $bk['ahead'] = $v; }
            if (isset($bi['notice'])) { $v = (int) $bi['notice']; if ($v < 0 || $v > 168) fail('Notice: 0 to 168 hours.'); $bk['notice'] = $v; }
            if (isset($bi['week'])) { $wk = pmWeekParse((string) $bi['week']); if ($wk === null) fail('Times look like: Tue 10:00-12:00, 13:00-16:00 (one day a line).'); $bk['week'] = $wk; }
            $s['book'] = $bk;
        }
        if (isset($in['perOrg'])) { $p = (int) $in['perOrg']; if ($p < 1 || $p > 3) fail('People per organisation: 1 to 3.'); $s['perOrg'] = $p; }
        if (isset($in['skip'])) { $k = []; foreach ((array) $in['skip'] as $d) { $d = trim((string) $d); if ($d === '') continue; if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) fail('Days off look like 2026-11-26.'); $k[] = $d; } $s['skip'] = array_values(array_unique($k)); }
        if (isset($in['address'])) { $a = pmClean($in['address'], 200); if ($a !== '' && !pmAddressOk($a)) fail('That does not look like a full postal address.'); $s['address'] = $a; }
        if (isset($in['signature'])) $s['signature'] = pmText($in['signature'], 400);
        /* who the emails go out as (2026-11-19): Peak Partnerships, or the connected mailbox; nothing else */
        if (isset($in['sendFrom'])) { $v = strtolower(trim((string) $in['sendFrom'])); if (!in_array($v, [PM_SHARED, 'me'], true)) fail('Send from ' . PM_SHARED . ' or the connected mailbox.'); $s['sendFrom'] = $v; }
        pmLog(['t' => 'settings', 's' => $s, 'by' => $BY]);
        if (((int) $s['perOrg'] !== (int) $S['settings']['perOrg'] || (bool) $s['deskSkip'] !== (bool) $S['settings']['deskSkip']) && is_file(pmData() . '/lists.json')) pmImportSave($BY);   /* who is queued per organisation changed */
        out(pmView());
    }
    case 'template': {
        $l = $needList(); $sub = pmClean($body['subject'] ?? '', 200); $txt = pmText($body['body'] ?? '', 8000);
        if ($sub === '' || $txt === '') fail('Give the subject and the email.');
        if (preg_match_all('/\{([a-z_]+)\}/i', $sub . "\n" . $txt, $m)) foreach ($m[1] as $f) if (!in_array($f, ['first', 'company', 'town', 'book'], true)) fail('{' . $f . '} is not a merge field. Use {first}, {company}, {town} or {book}.');
        $S = pmState(); pmLog(['t' => 'template', 'l' => $l, 'subject' => $sub, 'body' => $txt, 'by' => $BY]);
        if ($S['lists'][$l]['status'] === 'running') pmLog(['t' => 'pause', 'l' => $l, 'by' => $BY, 'why' => 'the email changed: check the preview and press Start again']);
        out(pmView());
    }
    case 'start': {
        $l = $needList(); $S = pmState(); $b = pmStartBlocks($S, $l); if ($b) fail('Not started: ' . implode(' ', $b), 409);
        if ($S['lists'][$l]['status'] === 'running') out(pmView());
        pmLog(['t' => 'start', 'l' => $l, 'by' => $BY]); out(pmView());
    }
    case 'pause': { $l = $needList(); if (pmState()['lists'][$l]['status'] === 'running') pmLog(['t' => 'pause', 'l' => $l, 'by' => $BY]); out(pmView()); }
    case 'import': { $d = pmImportSave($BY); if (isset($d['error'])) fail($d['error'], 503); out(pmView() + ['diff' => $d]); }
    case 'suppress': {
        $a = strtolower(pmClean($body['address'] ?? '', 160)); if (!filter_var($a, FILTER_VALIDATE_EMAIL)) fail('That email does not look right.');
        pmLog(['t' => 'suppress', 'to' => $a, 'why' => pmClean($body['why'] ?? '', 120), 'by' => $BY]); out(pmView());
    }
    case 'unsuppress': {
        $a = strtolower(pmClean($body['address'] ?? '', 160)); $S = pmState();
        if (!str_starts_with((string) ($S['suppressed'][$a] ?? ''), 'added by hand')) fail('Only addresses added by hand can be taken off. Unsubscribes, bounces and STOP replies stay.');
        pmLog(['t' => 'unsuppress', 'to' => $a, 'by' => $BY]); out(pmView());
    }
    /* look at Peak Partnerships now (read only: can it be opened, and its name as Microsoft has it); nothing is sent */
    case 'fromcheck': { pmFromProbe(true); out(pmView()); }
    case 'dns': {
        $c = pmConn(); $d = !empty($c['email']) ? substr((string) strrchr((string) $c['email'], '@'), 1) : 'peakpickleball.us';
        pmW('dns.json', pmDns($d)); out(pmView());
    }
}
fail('Unknown action.', 404);
