<?php
declare(strict_types=1);
/* Post calendar, the page's API (2026-10-31). The rules and the storage are in post-calendar-tools/lib.php beside public_html; the runner
 * that publishes is post-calendar-tools/runner.php. Sign-in: an 8-digit code per person (admin = Matthew, the only one who can approve;
 * editor = the laptop's loader, which adds drafts, pictures and answers to change requests and can never approve). Every write is a POST
 * with the X-PC header (a form on another site cannot set it). Framed only by pages on this site (the Traverse hub), like the Prospect Desk. */
define('PC', 1);
require (getenv('PC_LIB') ?: dirname(__DIR__, 3) . '/post-calendar-tools/lib.php');

header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN'); header("Content-Security-Policy: frame-ancestors 'self'"); header('X-Robots-Tag: noindex, nofollow');
function out(array $a): void { echo json_encode($a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); exit; }
function fail(string $m, int $code = 400): void { http_response_code($code); out(['ok' => false, 'error' => $m]); }
$action = (string) ($_GET['action'] ?? '');
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$multipart = $isPost && stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data') === 0;
$body = $isPost && !$multipart ? (json_decode((string) file_get_contents('php://input'), true) ?: []) : ($multipart ? $_POST : []);
if ($isPost && ($_SERVER['HTTP_X_PC'] ?? '') !== '1') fail('Bad request.');

/* ---- sign-in ---- */
$cookiePath = '/' . PC_PUBLIC . '/';
if ($action === 'signin') {
    if (!$isPost) fail('POST required', 405);
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? ''); $now = time();
    $tries = pcJread('tries.json', []);
    $mine = array_values(array_filter((array) ($tries[$ip] ?? []), fn($t) => $t > $now - 900));
    if (count($mine) >= 10) fail('Too many tries. Wait 15 minutes.', 429);
    $recent = 0; foreach ($tries as $k => $ts) { $tries[$k] = array_values(array_filter((array) $ts, fn($t) => $t > $now - 3600)); if (!$tries[$k]) unset($tries[$k]); else $recent += count($tries[$k]); }
    if ($recent >= 100) fail('Sign-in is paused for a while after too many wrong codes. Try again later.', 429);
    $code = preg_replace('/\D/', '', (string) ($body['code'] ?? ''));
    $acc = pcJread('accounts.json', ['codes' => []]); $a = $acc['codes'][pcCodeHash($code)] ?? null;
    if (!$a || strlen($code) !== 8) { $mine[] = $now; $tries[$ip] = $mine; pcJwrite('tries.json', $tries); fail('That code did not work.', 401); }
    $tok = bin2hex(random_bytes(24)); $ses = pcJread('sessions.json', []);
    foreach ($ses as $k => $s) if (($s['at'] ?? 0) < $now - 60 * 86400) unset($ses[$k]);
    $ses[hash('sha256', $tok)] = ['name' => $a['name'], 'role' => $a['role'], 'at' => $now]; pcJwrite('sessions.json', $ses, 0600);
    setcookie('postcal', $tok, ['expires' => $now + 60 * 86400, 'path' => $cookiePath, 'httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
    pcEvent(['t' => 'signin', 'by' => $a['name']]);
    out(['ok' => true, 'name' => $a['name'], 'role' => $a['role']]);
}
$ses = pcJread('sessions.json', []); $tokH = hash('sha256', (string) ($_COOKIE['postcal'] ?? '')); $me = $ses[$tokH] ?? null;
if (!$me) fail('Signed out.', 401);
$ME = (string) $me['name']; $ADMIN = ($me['role'] ?? '') === 'admin';
if ($action === 'signout') { unset($ses[$tokH]); pcJwrite('sessions.json', $ses, 0600); setcookie('postcal', '', ['expires' => 1, 'path' => $cookiePath]); out(['ok' => true]); }
function needAdmin(): void { global $ADMIN; if (!$ADMIN) fail('Only Matthew\'s sign-in can do that.', 403); }
function needClient(array $S, string $id): array { $c = $S['clients'][$id] ?? null; if (!$c) fail('No such client.', 404); return $c; }
function needPost(array &$S, string $id): array { $p = $S['posts'][$id] ?? null; if (!$p || $p['status'] === 'removed') fail('No such post.', 404); return $p; }

/* ---- reading ---- */
if ($action === 'me') out(['ok' => true, 'name' => $ME, 'role' => $me['role']]);
if ($action === 'data') {
    $S = pcState(); $cid = (string) ($_GET['client'] ?? '');
    $clients = array_values(array_map('pcClientView', $S['clients']));
    $o = ['ok' => true, 'me' => ['name' => $ME, 'role' => $me['role']], 'clients' => $clients, 'statuses' => PC_STATUSES, 'now' => pcNow(), 'pages' => pcJread('pages.json', null)];
    if ($cid !== '' && isset($S['clients'][$cid])) {   /* one client at a time: the page never gets two clients' posts in one answer */
        $posts = []; foreach ($S['posts'] as $p) if ($p['client'] === $cid && $p['status'] !== 'removed') $posts[] = pcPostView($S, $p);
        usort($posts, fn($a, $b) => [$a['at'] === null, $a['at']] <=> [$b['at'] === null, $b['at']]);
        $o += ['client' => $cid, 'posts' => $posts, 'slots' => pcSlots($S['clients'][$cid], pcNow(), 16)];
    } else {   /* the overview: counts only */
        $cnt = []; foreach ($S['posts'] as $p) if ($p['status'] !== 'removed') { $k = $p['status']; if ($k === 'draft' && pcOpenRequest($p)) $k = 'changes'; $cnt[$p['client']][$k] = ($cnt[$p['client']][$k] ?? 0) + 1; }
        $o['counts'] = $cnt;
    }
    out($o);
}
if ($action === 'slots') {
    $S = pcState(); $c = needClient($S, (string) ($_GET['client'] ?? ''));
    out(['ok' => true, 'slots' => pcSlots($c, (int) ($_GET['from'] ?? 0) ?: pcNow(), max(1, min(40, (int) ($_GET['n'] ?? 8))), (string) ($_GET['type'] ?? ''))]);
}
if ($action === 'requests') out(['ok' => true, 'requests' => pcRequestsOpen(pcState(), (string) ($_GET['client'] ?? ''))]);
if ($action === 'pages') { needAdmin(); out(pcPagesView(pcState())); }   /* read-only call to Meta: which Pages and Instagram accounts the token sees */

if (!$isPost) fail('POST required', 405);
$id = (string) ($body['id'] ?? '');

/* ---- posts: fields a draft can change; anything that changes what was approved drops the approval ---- */
function applyFields(array &$p, array $b, array $S): ?string {
    if (array_key_exists('type', $b)) { $t = (string) $b['type']; if (!in_array($t, ['single', 'photoset'], true)) return 'Unknown post type.'; $p['type'] = $t; }
    if (array_key_exists('date', $b) || array_key_exists('time', $b)) {
        $d = (string) ($b['date'] ?? ''); $tm = (string) ($b['time'] ?? '');
        if ($d === '' && $tm === '') $p['at'] = null;
        else { $at = pcAt($d, $tm); if ($at === null) return 'That date or time does not look right.'; $p['at'] = $at; }
    }
    if (array_key_exists('targets', $b)) { $t = array_values(array_intersect(['fb', 'ig'], (array) $b['targets'])); $p['targets'] = $t; }
    foreach (['fb' => 5000, 'ig' => PC_IG_MAX + 200, 'album' => 120, 'note' => 1000] as $k => $max) if (array_key_exists($k, $b)) $p[$k] = $k === 'album' ? pcClean($b[$k], $max) : pcText($b[$k], $max);
    if (array_key_exists('images', $b)) {   /* reorder, remove or caption the pictures already stored; new ones come through upload */
        $byKey = []; foreach ($p['images'] as $im) $byKey[$im['file'] !== '' ? $im['file'] : $im['url']] = $im;
        $new = [];
        foreach ((array) $b['images'] as $x) { $k = (string) ($x['file'] ?? ''); if (!isset($byKey[$k])) return 'A picture in that list is not one of this post\'s.'; $im = $byKey[$k]; if (array_key_exists('caption', (array) $x)) $im['caption'] = pcText($x['caption'], 1000); $new[] = $im; unset($byKey[$k]); }
        $p['images'] = $new;
    }
    if ($p['type'] === 'single' && count($p['images']) > 1) $p['images'] = array_slice($p['images'], -1);
    return null;
}
/** after a change: approval dropped if what was approved changed; a change request answered if asked */
function afterChange(array &$p, string $before, string $ME, $answer): void {
    if ($p['status'] === 'approved' && pcFingerprint($p) !== $before) { $p['status'] = 'draft'; $p['approval'] = null; pcLog($p, $ME, 'Approval dropped: edited after it was approved'); }
    if ($answer && $p['status'] === 'changes') {
        $all = $answer === true || $answer === 'true' || $answer === '1';
        foreach ($p['requests'] as &$r) if (empty($r['answered']) && ($all || $r['id'] === $answer)) $r['answered'] = ['by' => $ME, 'at' => pcNow(), 'how' => 'changed'];
        unset($r);
        if (!pcOpenRequest($p)) { $p['status'] = 'draft'; pcLog($p, $ME, 'Change request answered: back to draft for Matthew to look at'); }
    }
}
function editable(array $p): void {
    if (in_array($p['status'], ['publishing', 'published'], true)) fail('This post has gone (or is going) out, so it cannot change. Facebook and Instagram posts cannot be edited from here.', 409);
    if ($p['status'] === 'failed') fail('Move it back to draft first.', 409);
}

switch ($action) {
    case 'create': {
        $cid = (string) ($body['client'] ?? '');
        $r = pcMutate(function (array &$S) use ($cid, $body, $ME) {
            $c = needClient($S, $cid); if (!empty($c['archived'])) fail('This client is archived.', 409);
            $src = pcClean($body['src'] ?? '', 120);
            if ($src !== '') foreach ($S['posts'] as $q) if ($q['client'] === $cid && $q['src'] === $src && $q['status'] !== 'removed') return ['dup' => $q['id']];
            $p = pcNewPost($cid, ['src' => $src], $ME);
            if (($e = applyFields($p, $body, $S)) !== null) fail($e);
            if (!array_key_exists('date', $body) && empty($body['unscheduled'])) { $s = pcFreeSlot($S, $cid, pcNow(), $p['type']); if ($s) $p['at'] = $s['at']; }
            pcLog($p, $ME, 'Made as a draft' . ($src !== '' ? ' (' . $src . ')' : ''));
            $S['posts'][$p['id']] = $p; return ['id' => $p['id']];
        });
        out(['ok' => true] + $r);
    }
    case 'edit': {
        $p = pcMutate(function (array &$S) use ($id, $body, $ME) {
            $p = needPost($S, $id); editable($p);
            $before = pcFingerprint($p); $note = $p['note'];
            if (($e = applyFields($p, $body, $S)) !== null) fail($e);
            if (pcFingerprint($p) !== $before || $p['note'] !== $note) pcLog($p, $ME, 'Edited');
            afterChange($p, $before, $ME, $body['answer'] ?? null);
            $S['posts'][$id] = $p; return pcPostView($S, $p);
        });
        out(['ok' => true, 'post' => $p]);
    }
    case 'upload': {   /* multipart: id, file, [replace = index], [answer = request id] */
        $f = $_FILES['file'] ?? null; if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK) fail('The picture did not arrive (or it is over the upload limit).');
        $S0 = pcState(); $p0 = needPost($S0, $id); editable($p0);
        $img = pcStoreImage((string) $f['tmp_name'], (string) ($f['name'] ?? '')); if (isset($img['error'])) fail($img['error']);
        $p = pcMutate(function (array &$S) use ($id, $img, $body, $ME) {
            $p = needPost($S, $id); editable($p); $before = pcFingerprint($p); $old = null;
            $rep = isset($body['replace']) && $body['replace'] !== '' ? (int) $body['replace'] : null;
            if (isset($body['caption'])) $img['caption'] = pcText($body['caption'], 1000);
            if ($p['type'] === 'single') { $old = $p['images'][0] ?? null; $p['images'] = [$img]; }
            elseif ($rep !== null && isset($p['images'][$rep])) { $old = $p['images'][$rep]; $img['caption'] = $img['caption'] ?: (string) ($old['caption'] ?? ''); $p['images'][$rep] = $img; }
            else { if (count($p['images']) >= 10) fail('A photo set holds at most 10 pictures.'); $p['images'][] = $img; }
            pcLog($p, $ME, 'Picture ' . ($old ? 'replaced' : 'added') . ($img['name'] !== '' ? ' (' . $img['name'] . ')' : ''));
            afterChange($p, $before, $ME, $body['answer'] ?? null);
            $S['posts'][$id] = $p;
            if ($old) pcDropUnused($S, $p, $old);
            return pcPostView($S, $p);
        });
        out(['ok' => true, 'post' => $p]);
    }
    case 'approve': {   /* one post, one tap, Matthew only */
        needAdmin();
        $p = pcMutate(function (array &$S) use ($id, $ME) {
            $p = needPost($S, $id);
            if ($p['status'] !== 'draft') fail($p['status'] === 'changes' ? 'A change request is still open.' : 'Only a draft can be approved.', 409);
            if (($fp = (string) ($GLOBALS['body']['fingerprint'] ?? '')) !== '' && $fp !== pcFingerprint($p)) fail('This post changed since you opened it. Look at it again before approving.', 409);
            if ($why = pcProblems($S, $p)) fail(implode(' ', $why), 409);
            $p['status'] = 'approved'; $p['approval'] = ['by' => $ME, 'at' => pcNow(), 'hash' => pcFingerprint($p)];
            pcLog($p, $ME, 'Approved for ' . pcWall((int) $p['at']));
            $S['posts'][$id] = $p; return pcPostView($S, $p);
        });
        out(['ok' => true, 'post' => $p]);
    }
    case 'unapprove': {
        needAdmin();
        $p = pcMutate(function (array &$S) use ($id, $ME) {
            $p = needPost($S, $id); if ($p['status'] !== 'approved') fail('It is not approved.', 409);
            $p['status'] = 'draft'; $p['approval'] = null; pcLog($p, $ME, 'Unapproved'); $S['posts'][$id] = $p; return pcPostView($S, $p);
        });
        out(['ok' => true, 'post' => $p]);
    }
    case 'request': {   /* "Request changes": what to change in the picture or the words; the post cannot be approved until it is answered */
        needAdmin(); $text = pcText($body['text'] ?? '', 2000); if ($text === '') fail('Say what should change.');
        $p = pcMutate(function (array &$S) use ($id, $text, $ME) {
            $p = needPost($S, $id); if (in_array($p['status'], ['publishing', 'published'], true)) fail('This post has gone out already.', 409);
            $p['requests'][] = ['id' => pcId('r'), 'text' => $text, 'by' => $ME, 'at' => pcNow(), 'answered' => null];
            if ($p['status'] === 'approved') pcLog($p, $ME, 'Approval dropped: changes requested');
            $p['status'] = 'changes'; $p['approval'] = null; pcLog($p, $ME, 'Changes requested: ' . mb_substr($text, 0, 140));
            $S['posts'][$id] = $p; return pcPostView($S, $p);
        });
        out(['ok' => true, 'post' => $p]);
    }
    case 'withdraw': {   /* Matthew closes his own request without a new version (he fixed it himself, or changed his mind) */
        needAdmin();
        $p = pcMutate(function (array &$S) use ($id, $ME) {
            $p = needPost($S, $id); if ($p['status'] !== 'changes') fail('No open change request.', 409);
            foreach ($p['requests'] as &$r) if (empty($r['answered'])) $r['answered'] = ['by' => $ME, 'at' => pcNow(), 'how' => 'closed'];
            unset($r); $p['status'] = 'draft'; pcLog($p, $ME, 'Change request closed'); $S['posts'][$id] = $p; return pcPostView($S, $p);
        });
        out(['ok' => true, 'post' => $p]);
    }
    case 'todraft': {
        needAdmin();
        $p = pcMutate(function (array &$S) use ($id, $ME) {
            $p = needPost($S, $id); if ($p['status'] !== 'failed') fail('Only a failed post goes back to draft this way.', 409);
            $p['status'] = 'draft'; $p['approval'] = null; $p['emailed'] = false; $p['errors'] = [];
            pcLog($p, $ME, 'Back to draft after the failure' . ($p['done'] ? ' (already went: ' . implode(', ', array_map(fn($k) => $k === 'fb' ? 'Facebook' : 'Instagram', array_keys($p['done']))) . '; not sent again)' : ''));
            $S['posts'][$id] = $p; return pcPostView($S, $p);
        });
        out(['ok' => true, 'post' => $p]);
    }
    case 'remove': {
        needAdmin();
        pcMutate(function (array &$S) use ($id, $ME) { $p = needPost($S, $id); if (in_array($p['status'], ['publishing', 'published', 'approved'], true)) fail($p['status'] === 'approved' ? 'Unapprove it first.' : 'It has gone out.', 409); $p['status'] = 'removed'; pcLog($p, $ME, 'Removed'); $S['posts'][$id] = $p; });
        out(['ok' => true]);
    }

    /* ---- clients (Matthew only): name, colour, the Page and Instagram account, the default days and times, the rules note ---- */
    case 'client': {
        needAdmin();
        $name = pcClean($body['name'] ?? '', 60); if ($name === '') fail('Give the client a name.');
        $color = preg_match('/^#[0-9a-fA-F]{6}$/', (string) ($body['color'] ?? '')) ? strtolower((string) $body['color']) : '#13294b';
        $conn = ($body['conn'] ?? 'pipeline') === 'own' ? 'own' : 'pipeline';
        $slots = []; foreach ((array) ($body['slots'] ?? []) as $s) { $d = (int) ($s['d'] ?? -1); $t = (string) ($s['t'] ?? ''); $ty = ($s['type'] ?? 'single') === 'photoset' ? 'photoset' : 'single'; if ($d >= 0 && $d <= 6 && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $t)) $slots[] = ['d' => $d, 't' => $t, 'type' => $ty]; }
        $pageId = preg_replace('/\D/', '', (string) ($body['page_id'] ?? '')); $igLinked = ($body['ig_id'] ?? '') === 'linked'; $igId = preg_replace('/\D/', '', (string) ($body['ig_id'] ?? ''));
        $token = trim((string) ($body['token'] ?? ''));
        /* where it posts, checked against Meta now: a Page the token sees (or the client's own Page token), and only the Instagram account linked to that Page */
        $pageName = ''; $igUser = '';
        if ($conn === 'own') {
            $tok = $token !== '' ? $token : ($id !== '' ? pcClientToken($id) : '');
            if ($tok === '') fail('Paste the client\'s Page access token.');
            $m = pcGraph('GET', 'me', ['fields' => 'id,name,instagram_business_account{id,username}', 'access_token' => $tok]);
            if ($e = pcErr($m)) fail('That Page token did not work: ' . $e);
            $pageId = (string) $m['id']; $pageName = (string) ($m['name'] ?? ''); $lig = $m['instagram_business_account'] ?? null;
            if ($igLinked) { if (!$lig) fail('No Instagram account is linked to that Page.'); $igId = (string) $lig['id']; }
        } elseif ($pageId !== '') {
            $live = pcPipelinePages(); if (isset($live['error'])) fail('Could not read the Pages from Meta: ' . $live['error']);
            $pg = $live['pages'][$pageId] ?? null; if (!$pg) fail('That Page is not one the Meta token can post to. The client adds Matthew\'s business as a partner on the Page first, or use the client\'s own Page token.');
            $pageName = (string) $pg['name']; $lig = $pg['instagram_business_account'] ?? null;
        } else $lig = null;
        if ($igId !== '') { if (!$lig || (string) $lig['id'] !== $igId) fail('That Instagram account is not the one linked to the Page.'); $igUser = (string) ($lig['username'] ?? ''); }
        $r = pcMutate(function (array &$S) use ($id, $name, $color, $conn, $slots, $pageId, $pageName, $igId, $igUser, $body, $ME, $token) {
            foreach ($S['clients'] as $o) if ($o['id'] !== $id && empty($o['archived'])) {
                if ($pageId !== '' && $o['page_id'] === $pageId) fail('That Page is already assigned to ' . $o['name'] . '.', 409);
                if ($igId !== '' && $o['ig_id'] === $igId) fail('That Instagram account is already assigned to ' . $o['name'] . '.', 409);
            }
            $new = $id === '';
            if ($new) { $base = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($name)), '-') ?: 'client'; $id = $base; $n = 2; while (isset($S['clients'][$id])) $id = $base . '-' . $n++; }
            elseif (!isset($S['clients'][$id])) fail('No such client.', 404);
            $c = $S['clients'][$id] ?? ['id' => $id, 'archived' => false, 'created' => ['by' => $ME, 'at' => pcNow()]];
            $moved = !$new && ($c['page_id'] !== $pageId || $c['ig_id'] !== $igId || ($c['conn'] ?? 'pipeline') !== $conn);
            $c = array_merge($c, ['name' => $name, 'color' => $color, 'conn' => $conn, 'slots' => $slots, 'page_id' => $pageId, 'page_name' => $pageName, 'ig_id' => $igId, 'ig_user' => $igUser, 'rules' => pcText($body['rules'] ?? '', 2000)]);
            $S['clients'][$id] = $c;
            if ($conn === 'own' && $token !== '' && !pcSaveClientToken($id, $token)) fail('Could not save the token.', 500);
            if ($moved) foreach ($S['posts'] as &$p) if ($p['client'] === $id && $p['status'] === 'approved') { $p['status'] = 'draft'; $p['approval'] = null; pcLog($p, $ME, 'Approval dropped: the client\'s Page or Instagram account changed'); }
            unset($p);
            pcEvent(['t' => 'client', 'id' => $id, 'by' => $ME, 'what' => $new ? 'added' : 'edited']);
            return pcClientView($c);
        });
        out(['ok' => true, 'client' => $r]);
    }
    case 'clientarchive': {
        needAdmin(); $on = !empty($body['archived']);
        $r = pcMutate(function (array &$S) use ($id, $on, $ME) {
            $c = needClient($S, $id);
            if (!$on) foreach ($S['clients'] as $o) if ($o['id'] !== $id && empty($o['archived']) && (($c['page_id'] !== '' && $o['page_id'] === $c['page_id']) || ($c['ig_id'] !== '' && $o['ig_id'] === $c['ig_id']))) fail('Its Page or Instagram account is now assigned to ' . $o['name'] . '.', 409);
            $S['clients'][$id]['archived'] = $on;
            if ($on) foreach ($S['posts'] as &$p) if ($p['client'] === $id && $p['status'] === 'approved') { $p['status'] = 'draft'; $p['approval'] = null; pcLog($p, $ME, 'Approval dropped: client archived'); }
            unset($p); pcEvent(['t' => 'client', 'id' => $id, 'by' => $ME, 'what' => $on ? 'archived' : 'restored']);
            return pcClientView($S['clients'][$id]);
        });
        out(['ok' => true, 'client' => $r]);
    }
}
fail('Unknown action.', 404);
