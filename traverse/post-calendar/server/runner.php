<?php
declare(strict_types=1);
/* Post calendar runner (2026-10-31): publishes APPROVED posts whose time has come, once each, to the Page and Instagram account assigned to
 * the post's client. Started every five minutes by sixfold-tools/meta-leads.php (the SiteGround every-5-minutes cron), in the background, so a post goes
 * out within about five minutes of its time whether or not anyone's laptop is on. Lives beside public_html in post-calendar-tools/.
 *
 *   php runner.php                       publish what is due (the cron job)
 *   php runner.php check                 read-only: the Pages and Instagram accounts the Meta token sees, and each client's connection
 *   php runner.php requests [client]     open change requests as JSON (no codes, no tokens)
 *   php runner.php show [client]         the posts, one line each
 *   php runner.php addaccount "Name" admin|editor [--code-only]   a sign-in code (printed once; --code-only prints just the code)
 *   php runner.php migrate-queue <file>  bring the old social-queue.json posts in, approvals kept (see the end of this file)
 *
 * Once each: a post is claimed ("publishing") under the state lock before any call to Meta, each platform is recorded the moment it goes,
 * a second runner cannot start while one is going (runner.lock), and a post that was published, or left half-way by a runner that died,
 * is never sent again by the runner. A failed post stays failed until Matthew moves it back to draft and approves it again; then only the
 * platforms that did not go are tried. On failure: one email to m.sharpe@traverseplatforms.com (the travMail path). Prints no tokens. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('PC', 1);
require __DIR__ . '/lib.php';

$args = array_slice($argv, 1); $cmd = $args[0] ?? '';
$say = function (string $m) { @file_put_contents(pcDir() . '/runner.log', date('Y-m-d H:i:s') . ' ' . $m . "\n", FILE_APPEND | LOCK_EX); };

if ($cmd === 'addaccount') {
    [$name, $role] = [$args[1] ?? '', $args[2] ?? 'admin'];
    if ($name === '' || !in_array($role, ['admin', 'editor'], true)) { fwrite(STDERR, "usage: php runner.php addaccount \"Name\" admin|editor [--code-only]\n"); exit(1); }
    $code = pcAddAccount($name, $role);
    echo in_array('--code-only', $args, true) ? $code . "\n" : "Code for $name ($role): $code\n"; exit(0);
}
if ($cmd === 'requests') { echo json_encode(pcRequestsOpen(pcState(), (string) ($args[1] ?? '')), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n"; exit(0); }
if ($cmd === 'show') {
    $S = pcState();
    foreach ($S['posts'] as $p) {
        if (isset($args[1]) && $p['client'] !== $args[1]) continue;
        echo implode(' | ', [$p['id'], $p['client'], $p['status'], $p['at'] ? pcWall((int) $p['at']) : 'no time', $p['type'], implode('+', $p['targets']), count($p['images']) . ' pic', mb_substr(strtok((string) ($p['fb'] ?: $p['ig']), "\n") ?: '', 0, 40)]), "\n";
    }
    exit(0);
}
if ($cmd === 'check') {
    $S = pcState(); $live = pcPipelinePages();
    if (isset($live['error'])) { echo 'Meta: ', $live['error'], "\n"; exit(1); }
    $v = pcPagesView($S, $live);
    echo "Pages the Meta token can post to:\n";
    foreach ($v['pages'] as $r) echo '  ', $r['page_name'], ' (', $r['page_id'], ') ', $r['ig_user'] !== '' ? 'Instagram @' . $r['ig_user'] : 'no Instagram', ' -> ', $r['client'] ?? 'not assigned', "\n";
    echo "Clients:\n";
    foreach ($S['clients'] as $c) {
        if (!empty($c['archived'])) { echo '  ', $c['name'], ": archived\n"; continue; }
        $t = pcTarget($c, $live);
        echo '  ', $c['name'], ': ', isset($t['error']) ? 'NOT READY: ' . $t['error'] : 'Facebook Page ' . $t['page'] . ', Instagram ' . ($t['ig'] !== '' ? $t['ig'] : 'none (' . $t['igWhy'] . ')'), "\n";
    }
    exit(0);
}
if ($cmd === 'migrate-queue') exit(pcMigrateQueue((string) ($args[1] ?? '')));
if ($cmd !== '') { fwrite(STDERR, "unknown command\n"); exit(1); }

/* ---- the run ---- */
$lk = fopen(pcDir() . '/runner.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX | LOCK_NB)) exit(0);
$now = pcNow();
/* the old runner (sixfold-tools/social-queue.php) owns its own posts until its queue file is retired: a post brought over from it is
   left alone while that file is still there, so the two can never both send one */
$legacyLive = is_file(PC_SITE . '/sixfold-private/social-queue.json');
[$claimed, $mailNow] = pcMutate(function (array &$S) use ($now, $legacyLive) {
    $claim = []; $mail = [];
    foreach ($S['posts'] as $id => &$p) {
        if ($p['status'] === 'publishing' && $now - (int) $p['claimed'] > PC_STUCK) {
            $p['status'] = 'failed'; $p['error'] = 'The runner stopped part way through this post. Check Facebook and Instagram before trying again: what went is listed below.';
            pcLog($p, 'runner', 'Failed: the runner stopped part way'); $mail[] = $id; continue;
        }
        if ($p['status'] !== 'approved' || !$p['at'] || (int) $p['at'] > $now) continue;
        if ($legacyLive && !empty($p['legacy'])) continue;
        if (($p['approval']['hash'] ?? '') !== pcFingerprint($p)) {   /* changed since the tap: never sent as approved */
            $p['status'] = 'draft'; $p['approval'] = null; pcLog($p, 'runner', 'Not sent: it changed after it was approved. Back to draft.'); continue;
        }
        $c = $S['clients'][$p['client']] ?? null;
        if (!$c || !empty($c['archived'])) { $p['status'] = 'draft'; $p['approval'] = null; pcLog($p, 'runner', 'Not sent: the client is archived. Back to draft.'); continue; }
        if ($now - (int) $p['at'] > PC_LATE) {
            $p['status'] = 'failed'; $p['error'] = 'Missed: more than 6 hours past its time when the runner saw it, so it was not posted.';
            pcLog($p, 'runner', 'Missed (over 6 hours late), not posted'); $mail[] = $id; continue;
        }
        $p['status'] = 'publishing'; $p['claimed'] = $now; $p['error'] = ''; pcLog($p, 'runner', 'Publishing'); $claim[] = $id;
    }
    unset($p);
    return [$claim, $mail];
});
foreach ($mailNow as $id) pcFailMail($id);
$live = null;
foreach ($claimed as $id) {
    $S = pcState(); $p = $S['posts'][$id]; $c = $S['clients'][$p['client']];
    if ($live === null && ($c['conn'] ?? 'pipeline') === 'pipeline') $live = pcPipelinePages();
    $tg = pcTarget($c, ($c['conn'] ?? 'pipeline') === 'pipeline' ? $live : null);
    $errors = [];
    foreach (['fb', 'ig'] as $where) {
        if (!in_array($where, (array) $p['targets'], true) || !empty($p['done'][$where])) continue;
        if (isset($tg['error'])) { $errors[$where] = $tg['error']; continue; }
        if ($where === 'ig' && $tg['ig'] === '') { $errors['ig'] = $tg['igWhy']; continue; }
        $r = $where === 'fb' ? pcSendFacebook($p, $tg) : pcSendInstagram($p, $tg);
        if (isset($r['done'])) {
            pcMutate(function (array &$S) use ($id, $where, $r) { $q = &$S['posts'][$id]; $q['done'][$where] = $r['done'] + ['at' => pcNow()]; pcLog($q, 'runner', ($where === 'fb' ? 'Facebook' : 'Instagram') . ' posted: ' . ($r['done']['link'] ?? $r['done']['id'])); });
            $say("$id {$p['client']} $where posted " . ($r['done']['link'] ?? $r['done']['id']));
        }
        if (!empty($r['error'])) { $errors[$where] = $r['error']; $say("$id {$p['client']} $where FAILED " . $r['error']); }
    }
    $failed = pcMutate(function (array &$S) use ($id, $errors) {
        $q = &$S['posts'][$id]; $q['errors'] = $errors;
        if (!$errors) { $q['status'] = 'published'; $q['error'] = ''; pcLog($q, 'runner', 'Published'); return false; }
        $q['status'] = 'failed';
        $q['error'] = implode(' ', array_map(fn($k, $v) => ($k === 'fb' ? 'Facebook' : 'Instagram') . ': ' . $v . '.', array_keys($errors), $errors));
        pcLog($q, 'runner', 'Failed: ' . $q['error']); return true;
    });
    if ($failed) pcFailMail($id);
}
flock($lk, LOCK_UN);
exit(0);

/* ---- Facebook: one photo (POST /{page}/photos with the picture's address), or a photo set as an album with a caption per photo ---- */
function pcSendFacebook(array $p, array $tg): array {
    $imgs = (array) $p['images']; $tok = $tg['token'];
    if ($p['type'] === 'photoset') {
        $a = pcGraph('POST', $tg['page'] . '/albums', ['name' => (string) $p['album'], 'message' => (string) $p['fb'], 'access_token' => $tok]);
        if ($e = pcErr($a)) return ['error' => 'the album was not made: ' . $e];
        $n = 0; $bad = [];
        foreach ($imgs as $k => $im) { $r = pcGraph('POST', $a['id'] . '/photos', ['url' => (string) $im['url'], 'caption' => (string) ($im['caption'] ?? ''), 'access_token' => $tok]); if ($e = pcErr($r)) $bad[] = 'photo ' . ($k + 1) . ': ' . $e; else $n++; }
        $l = pcGraph('GET', (string) $a['id'], ['fields' => 'link', 'access_token' => $tok]);
        $done = ['id' => (string) $a['id'], 'link' => (string) ($l['link'] ?? ''), 'photos' => $n . ' of ' . count($imgs)];
        /* the album exists now, so Facebook counts as done either way (a retry would make a second album); missing photos are the error */
        return $bad ? ['done' => $done, 'error' => 'the album went up with ' . $n . ' of ' . count($imgs) . ' photos; add the rest on Facebook by hand (' . implode('; ', $bad) . ')'] : ['done' => $done];
    }
    $r = pcGraph('POST', $tg['page'] . '/photos', ['url' => (string) $imgs[0]['url'], 'caption' => (string) $p['fb'], 'published' => 'true', 'access_token' => $tok]);
    if ($e = pcErr($r)) return ['error' => $e];
    $pid = (string) ($r['post_id'] ?? $r['id'] ?? '');
    $l = pcGraph('GET', $pid, ['fields' => 'permalink_url', 'access_token' => $tok]);
    return ['done' => ['id' => $pid, 'link' => (string) ($l['permalink_url'] ?? '')]];
}
/* ---- Instagram: POST /{ig}/media, wait until Meta has fetched the picture, POST /{ig}/media_publish; a photo set is a carousel ---- */
function pcIgReady(string $cid, string $tok): bool {
    $wait = getenv('PC_POLL_SLEEP'); $wait = $wait === false || $wait === '' ? 5 : (int) $wait;
    for ($i = 0; $i < 24; $i++) { $s = pcGraph('GET', $cid, ['fields' => 'status_code', 'access_token' => $tok]); $c = (string) ($s['status_code'] ?? ''); if ($c === 'FINISHED') return true; if ($c === 'ERROR' || $c === 'EXPIRED') return false; if ($wait) sleep($wait); }
    return false;
}
function pcSendInstagram(array $p, array $tg): array {
    $imgs = (array) $p['images']; $tok = $tg['token']; $ig = $tg['ig'];
    if ($p['type'] === 'photoset') {
        $kids = [];
        foreach ($imgs as $k => $im) {
            $c = pcGraph('POST', $ig . '/media', ['image_url' => (string) $im['url'], 'is_carousel_item' => 'true', 'access_token' => $tok]);
            if ($e = pcErr($c)) return ['error' => 'carousel picture ' . ($k + 1) . ': ' . $e];
            if (!pcIgReady((string) $c['id'], $tok)) return ['error' => 'carousel picture ' . ($k + 1) . ' was not processed by Instagram'];
            $kids[] = (string) $c['id'];
        }
        $c = pcGraph('POST', $ig . '/media', ['media_type' => 'CAROUSEL', 'children' => implode(',', $kids), 'caption' => (string) $p['ig'], 'access_token' => $tok]);
    } else {
        $c = pcGraph('POST', $ig . '/media', ['image_url' => (string) $imgs[0]['url'], 'caption' => (string) $p['ig'], 'access_token' => $tok]);
    }
    if ($e = pcErr($c)) return ['error' => $e];
    if (!pcIgReady((string) $c['id'], $tok)) return ['error' => 'Instagram did not finish processing the post'];
    $r = pcGraph('POST', $ig . '/media_publish', ['creation_id' => (string) $c['id'], 'access_token' => $tok]);
    if ($e = pcErr($r)) return ['error' => $e];
    $l = pcGraph('GET', (string) $r['id'], ['fields' => 'permalink', 'access_token' => $tok]);
    return ['done' => ['id' => (string) $r['id'], 'link' => (string) ($l['permalink'] ?? '')]];
}
/* ---- one email per failure ---- */
function pcFailMail(string $id): void {
    $S = pcState(); $p = $S['posts'][$id] ?? null; if (!$p || !empty($p['emailed'])) return;
    $c = $S['clients'][$p['client']] ?? ['name' => $p['client']];
    $went = []; foreach ((array) $p['done'] as $k => $d) $went[] = ($k === 'fb' ? 'Facebook' : 'Instagram') . ' went: ' . ($d['link'] ?: $d['id']);
    $text = "A post on the post calendar did not go out as approved.\n\n"
          . 'Client: ' . $c['name'] . "\n" . 'Time: ' . ($p['at'] ? pcWall((int) $p['at']) : '-') . "\n"
          . 'Where: ' . implode(' and ', array_map(fn($t) => $t === 'fb' ? 'Facebook' : 'Instagram', (array) $p['targets'])) . "\n"
          . 'First line: ' . (strtok((string) ($p['fb'] ?: $p['ig']), "\n") ?: '-') . "\n\n"
          . 'What happened: ' . $p['error'] . "\n" . ($went ? implode("\n", $went) . "\n" : '') . "\n"
          . "Nothing is retried by itself. To try again: open the post, Back to draft, fix it if needed, Approve. Anything that already went is not sent twice.\n\n"
          . PC_ORIGIN . '/' . PC_PUBLIC . "/\n";
    $r = pcMail('Post calendar: a ' . $c['name'] . ' post failed', $text);
    pcMutate(function (array &$S) use ($id, $r) { $q = &$S['posts'][$id]; $q['emailed'] = true; pcLog($q, 'runner', $r['ok'] ? 'Emailed Matthew about the failure' : 'Could not email Matthew (' . $r['stage'] . ')'); });
}

/* ---- the old runner's posts (sixfold-tools/social-queue.php, 27 Oct): each queue item becomes a post here with its status, approval and
   result kept; the pictures stay at the addresses they had. Run once, then retire the old queue file (rename it), which stops the old runner
   for good (it exits when its file is missing) and lets this runner take over the migrated posts. Items already brought over are skipped. ---- */
function pcMigrateQueue(string $file): int {
    $q = json_decode((string) @file_get_contents($file), true); if (!is_array($q)) { fwrite(STDERR, "no queue at that path\n"); return 1; }
    $pages = ['Sixfold 365' => 'sixfold', 'Surge Inc' => 'surge'];
    $n = pcMutate(function (array &$S) use ($q, $pages) {
        $have = []; foreach ($S['posts'] as $p) if (!empty($p['legacy'])) $have[$p['legacy']] = 1;
        $made = 0;
        foreach ($q as $it) {
            $lid = (string) ($it['id'] ?? ''); if ($lid === '' || isset($have[$lid])) continue;
            $client = $pages[(string) ($it['page'] ?? '')] ?? null; if (!$client) { echo "skipped $lid: unknown page\n"; continue; }
            $fb = $it['fb'] ?? null; $ig = $it['ig'] ?? null; $urls = []; $caps = [];
            if (is_array($fb) && ($fb['type'] ?? '') === 'album') foreach ((array) $fb['photos'] as $ph) { $urls[] = (string) $ph['image']; $caps[(string) $ph['image']] = (string) ($ph['caption'] ?? ''); }
            if (is_array($fb) && ($fb['type'] ?? '') === 'photo') $urls[] = (string) $fb['image'];
            if (is_array($ig) && ($ig['type'] ?? '') === 'carousel') foreach ((array) $ig['images'] as $u) $urls[] = (string) $u;
            if (is_array($ig) && ($ig['type'] ?? '') === 'image') $urls[] = (string) $ig['image'];
            $urls = array_values(array_unique($urls));
            $set = (is_array($fb) && ($fb['type'] ?? '') === 'album') || (is_array($ig) && ($ig['type'] ?? '') === 'carousel');
            $res = (array) ($it['result'] ?? []); $done = [];
            foreach (['fb', 'ig'] as $k) if (isset($res[$k]) && is_string($res[$k]) && strpos($res[$k], 'failed') !== 0) $done[$k] = ['id' => '', 'link' => $res[$k], 'at' => strtotime((string) ($res['at'] ?? '')) ?: 0];
            $status = ['approved' => 'approved', 'posted' => 'published', 'failed' => 'failed', 'missed' => 'failed', 'held' => 'draft'][(string) ($it['status'] ?? '')] ?? 'draft';
            $p = pcNewPost($client, ['type' => $set ? 'photoset' : 'single', 'status' => $status, 'at' => (int) $it['at'], 'targets' => array_keys(array_filter(['fb' => is_array($fb), 'ig' => is_array($ig)])),
                'fb' => (string) ($fb['caption'] ?? $fb['description'] ?? ''), 'ig' => (string) ($ig['caption'] ?? ''), 'album' => (string) ($fb['name'] ?? ''),
                'images' => array_map(fn($u) => ['file' => '', 'url' => $u, 'w' => null, 'h' => null, 'bytes' => null, 'name' => basename(parse_url($u, PHP_URL_PATH) ?: ''), 'caption' => $caps[$u] ?? ''], $urls),
                'note' => 'Brought over from the old posting queue (' . $lid . ').', 'src' => 'legacy:' . $lid, 'legacy' => $lid, 'done' => $done,
                'error' => $status === 'failed' ? 'From the old queue: ' . (string) ($it['status'] ?? '') . ' ' . json_encode($res, JSON_UNESCAPED_SLASHES) : ''], 'migration');
            if ($status === 'approved') $p['approval'] = ['by' => 'Matthew Sharpe', 'at' => (int) ($it['approvedAt'] ?? 0) ?: pcNow(), 'said' => (string) ($it['approved'] ?? ''), 'migrated' => pcNow(), 'hash' => pcFingerprint($p)];
            pcLog($p, 'migration', 'Brought over from the old queue as ' . $status . ($status === 'approved' ? ' (approval kept: ' . (string) ($it['approved'] ?? '') . ')' : ''));
            $S['posts'][$p['id']] = $p; $made++;
        }
        return $made;
    });
    echo "brought over $n\n"; return 0;
}
