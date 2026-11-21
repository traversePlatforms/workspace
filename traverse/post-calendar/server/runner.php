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
 *   php runner.php addaccount "Name" admin|editor|client [--clients id,..] [--code-only]   a sign-in code (printed once; --code-only prints
 *                                        just the code). client = a client's own approver, limited to the clients after --clients
 *   php runner.php removeaccount "Name" [role]   take a sign-in away and sign out its sessions
 *   php runner.php accounts              names, roles and client scopes (never codes)
 *   php runner.php migrate-queue <file>  bring the old social-queue.json posts in, approvals kept (see the end of this file)
 *   php runner.php hold <client> fb,ig "why"     put Facebook and/or Instagram on hold for a client (2026-11-18): those can't be approved and
 *                                        the runner never sends to them; approved posts that use them go back to draft
 *   php runner.php unhold <client> fb,ig  lift it (only on Matthew's word)
 *   php runner.php roll <client> on "why" | off    keep that client's waiting posts moving forward (2026-11-21): while on, whenever its
 *                                        earliest unposted dated post is less than a day away, every unposted dated post of that client
 *                                        moves forward by the same whole number of weeks (same weekday and clock time, gaps and order kept,
 *                                        nothing deleted; each move written in the post's history)
 *   php runner.php linkedin              read-only: each LinkedIn client's connection (state, Page, expiry; never tokens)
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
    $ci = array_search('--clients', $args, true); $clients = $ci !== false ? array_values(array_filter(array_map('trim', explode(',', (string) ($args[$ci + 1] ?? ''))))) : [];
    $usage = "usage: php runner.php addaccount \"Name\" admin|editor|client [--clients id1,id2] [--code-only]\n  (client: --clients is required; that sign-in sees and approves only those clients)\n";
    if ($name === '' || !in_array($role, PC_ROLES, true)) { fwrite(STDERR, $usage); exit(1); }
    if ($role === 'client') {
        $S = pcState(); $bad = array_filter($clients, fn($c) => !isset($S['clients'][$c]));
        if (!$clients || $bad) { fwrite(STDERR, ($bad ? 'no such client: ' . implode(', ', $bad) . "\n" : '') . $usage); exit(1); }
    } elseif ($clients) { fwrite(STDERR, "--clients is only for a client sign-in\n" . $usage); exit(1); }
    $code = pcAddAccount($name, $role, $clients);
    echo in_array('--code-only', $args, true) ? $code . "\n" : "Code for $name ($role" . ($clients ? ': ' . implode(', ', $clients) : '') . "): $code\n"; exit(0);
}
if ($cmd === 'removeaccount') {   /* by name (and role, if given); its sessions are signed out too */
    $name = (string) ($args[1] ?? ''); $role = (string) ($args[2] ?? '');
    if ($name === '') { fwrite(STDERR, "usage: php runner.php removeaccount \"Name\" [admin|editor|client]\n"); exit(1); }
    $n = pcRemoveAccount($name, $role); echo "removed $n account(s) named $name\n"; exit($n ? 0 : 1);
}
if ($cmd === 'accounts') { foreach (pcAccountsList() as $a) echo $a['name'], ' | ', $a['role'], $a['clients'] !== null ? ' | ' . implode(',', $a['clients']) : '', "\n"; exit(0); }   /* names and roles only, never codes */
if ($cmd === 'requests') { echo json_encode(pcRequestsOpen(pcState(), (string) ($args[1] ?? '')), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), "\n"; exit(0); }
if ($cmd === 'show') {
    $S = pcState();
    foreach ($S['posts'] as $p) {
        if (isset($args[1]) && $p['client'] !== $args[1]) continue;
        echo implode(' | ', [$p['id'], $p['client'], $p['status'], $p['at'] ? pcWall((int) $p['at']) : 'no time', $p['type'], implode('+', $p['targets']), count($p['images']) . ' pic', mb_substr(strtok((string) ($p['fb'] ?: ($p['ig'] ?: ($p['li'] ?? ''))), "\n") ?: '', 0, 40)]), "\n";
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
if ($cmd === 'hold' || $cmd === 'unhold') {
    $cid = (string) ($args[1] ?? ''); $tg = array_values(array_intersect(['fb', 'ig'], explode(',', (string) ($args[2] ?? '')))); $why = trim((string) ($args[3] ?? ''));
    if ($cid === '' || !$tg || ($cmd === 'hold' && $why === '')) { fwrite(STDERR, "usage: php runner.php hold <client> fb,ig \"why\"  |  unhold <client> fb,ig\n"); exit(1); }
    $n = pcSetHold($cid, $tg, $cmd === 'hold' ? $why : null, $cmd === 'hold' ? 'server (hold)' : 'server (unhold)');
    if ($n < 0) { fwrite(STDERR, "no such client\n"); exit(1); }
    echo ($cmd === 'hold' ? 'on hold: ' : 'hold lifted: '), $cid, ' ', implode(',', $tg), $cmd === 'hold' ? " ($n approved post(s) back to draft)" : '', "\n"; exit(0);
}
/* 21 Nov 2026, Matthew: "dont get rid of post that havent been posted yet, instead keep moving the schedule further and further to the next
   dates until we have the sign ins that we need" */
if ($cmd === 'roll') {
    $cid = (string) ($args[1] ?? ''); $on = (string) ($args[2] ?? ''); $why = trim((string) ($args[3] ?? ''));
    if ($cid === '' || !in_array($on, ['on', 'off'], true) || ($on === 'on' && $why === '')) { fwrite(STDERR, "usage: php runner.php roll <client> on \"why\"  |  roll <client> off\n"); exit(1); }
    $r = pcMutate(function (array &$S) use ($cid, $on, $why) {
        if (!isset($S['clients'][$cid])) return -1;
        if ($on === 'on') $S['clients'][$cid]['roll'] = ['why' => $why, 'by' => 'server (roll)', 'at' => pcNow()]; else unset($S['clients'][$cid]['roll']);
        pcEvent(['t' => 'client', 'id' => $cid, 'by' => 'server (roll)', 'what' => $on === 'on' ? 'waiting posts roll forward (' . $why . ')' : 'roll forward off']);
        return 0;
    });
    if ($r < 0) { fwrite(STDERR, "no such client\n"); exit(1); }
    $n = $on === 'on' ? pcRollForward(pcNow()) : 0;
    echo $on === 'on' ? 'rolling forward: ' . $cid . ' (' . $n . ' post(s) moved now)' : 'roll forward off: ' . $cid, "\n"; exit(0);
}
if ($cmd === 'linkedin') {   /* what the page shows, never tokens */
    $S = pcState(); echo 'LinkedIn app keys on the server: ', pcLiApp() ? 'yes' : 'no', "\n";
    foreach (PC_LI_CLIENTS as $cid) {
        $c = $S['clients'][$cid] ?? null; if (!$c) continue; $v = pcLiView($c);
        echo '  ', $c['name'], ': ', $v['state'], ($v['org_name'] !== '' ? ', Page ' . $v['org_name'] . ' (' . $v['org_id'] . ')' : ''),
            isset($v['member']) ? ', as ' . $v['member'] . ', sign-in to ' . pcWall((int) $v['access_exp'], 'j M Y') . ($v['refresh_exp'] ? ', renewable to ' . pcWall((int) $v['refresh_exp'], 'j M Y') : ', not renewable') : '',
            $v['last'] ? '; last: ' . $v['last']['text'] : '', "\n";
        foreach ((array) ($c['holds'] ?? []) as $k => $h) echo '    ', pcPlace((string) $k), ' on hold: ', $h['why'], "\n";
    }
    exit(0);
}
if ($cmd !== '') { fwrite(STDERR, "unknown command\n"); exit(1); }

/* ---- the run ---- */
$lk = fopen(pcDir() . '/runner.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX | LOCK_NB)) exit(0);
$now = pcNow();
pcRollForward($now);   /* 21 Nov: a client waiting on its sign-ins keeps its posts ahead of today (roll <client> on) */
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
    $tg = null;   /* Meta is asked only when a Facebook or Instagram part is really going (2026-11-18: a LinkedIn-only or held post never calls it) */
    $errors = [];
    $record = function (string $key, array $d) use ($id, $say, $p) {
        pcMutate(function (array &$S) use ($id, $key, $d) { $q = &$S['posts'][$id]; $q['done'][$key] = $d + ['at' => pcNow()]; pcLog($q, 'runner', pcPlace($key) . ' posted: ' . ($d['link'] ?? $d['id'])); });
        $say("$id {$p['client']} $key posted " . ($d['link'] ?? $d['id']));
    };
    foreach (['fb', 'ig', 'li'] as $where) {
        if (!in_array($where, (array) $p['targets'], true)) continue;
        if ($where === 'li') {   /* LinkedIn: the post once, then the first comment once (see linkedin.php) */
            if (!empty($p['done']['li']) && (trim((string) ($p['li_comment'] ?? '')) === '' || !empty($p['done']['lic']))) continue;
            $r = pcSendLinkedIn($p, $c, $record);
            if (!empty($r['error'])) { $errors['li'] = $r['error']; $say("$id {$p['client']} li FAILED " . $r['error']); }
            continue;
        }
        if (!empty($p['done'][$where])) continue;
        if ($h = pcHeld($c, $where)) { $errors[$where] = 'on hold for ' . $c['name'] . ' (' . $h['why'] . '), so nothing was sent there'; $say("$id {$p['client']} $where HELD, not sent"); continue; }
        if ($tg === null) {
            if ($live === null && ($c['conn'] ?? 'pipeline') === 'pipeline') $live = pcPipelinePages();
            $tg = pcTarget($c, ($c['conn'] ?? 'pipeline') === 'pipeline' ? $live : null);
        }
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
        $q['error'] = implode(' ', array_map(fn($k, $v) => pcPlace($k) . ': ' . $v . '.', array_keys($errors), $errors));
        pcLog($q, 'runner', 'Failed: ' . $q['error']); return true;
    });
    if ($failed) pcFailMail($id);
}
pcLiChores($say);   /* LinkedIn: keep the sign-in fresh, say once when it cannot be, read the numbers of recent posts (2026-11-18) */
flock($lk, LOCK_UN);
exit(0);

/* ---- Facebook: one photo (POST /{page}/photos with the picture's address), or a photo set as one post with several photos ----
   A photo set (2026-11-16): each photo goes up unpublished (POST /{page}/photos, published=false, with its own caption if it has one), then one
   feed post carries them all (POST /{page}/feed, message + attached_media[i]={"media_fbid":"<id>"}). It used to be a Page album, but Meta
   refuses this app album-making ("(#3) Application does not have the capability to make this API call", the first real photo set, 16 Nov 1:15
   pm). Unpublished photos show nowhere on their own, so a failure part-way leaves nothing on the Page and Facebook is simply not done: Back to
   draft + Approve tries Facebook again, and what already went (Instagram) is never sent twice. */
function pcSendFacebook(array $p, array $tg): array {
    $imgs = (array) $p['images']; $tok = $tg['token'];
    if ($p['type'] === 'photoset') {
        $ids = [];
        foreach ($imgs as $k => $im) {
            $f = ['url' => (string) $im['url'], 'published' => 'false', 'access_token' => $tok];
            if (trim((string) ($im['caption'] ?? '')) !== '') $f['caption'] = (string) $im['caption'];
            $r = pcGraph('POST', $tg['page'] . '/photos', $f);
            if ($e = pcErr($r)) return ['error' => 'photo ' . ($k + 1) . ' of ' . count($imgs) . ' was not uploaded, so nothing was posted: ' . $e];
            $id = (string) ($r['id'] ?? ''); if ($id === '') return ['error' => 'photo ' . ($k + 1) . ' of ' . count($imgs) . ': Facebook gave no photo id, so nothing was posted'];
            $ids[] = $id;
        }
        $q = ['message' => (string) $p['fb'], 'access_token' => $tok];
        foreach ($ids as $i => $id) $q['attached_media[' . $i . ']'] = json_encode(['media_fbid' => $id]);
        $r = pcGraph('POST', $tg['page'] . '/feed', $q);
        if ($e = pcErr($r)) return ['error' => 'the post with the ' . count($ids) . ' photos was not made: ' . $e];
        $pid = (string) ($r['id'] ?? ''); if ($pid === '') return ['error' => 'the post with the photos was not made: Facebook gave no post id'];
        $l = pcGraph('GET', $pid, ['fields' => 'permalink_url', 'access_token' => $tok]);
        return ['done' => ['id' => $pid, 'link' => (string) ($l['permalink_url'] ?? ''), 'photos' => count($ids) . ' of ' . count($imgs)]];
    }
    if (pcIsVideo($imgs[0])) {   /* a video goes up as a Facebook Reel (Matthew 2026-11-05): start an upload, send Meta the video, publish */
        $s = pcGraph('POST', $tg['page'] . '/video_reels', ['upload_phase' => 'start', 'access_token' => $tok]);
        if ($e = pcErr($s)) return ['error' => 'the Reel upload did not start: ' . $e];
        $vid = (string) ($s['video_id'] ?? ''); if ($vid === '') return ['error' => 'the Reel upload did not start: no video id came back'];
        $u = pcRupload($vid, $imgs[0], $tok);   /* sends the file's bytes from the server's copy (2026-11-06) */
        if ($e = pcErr($u)) return ['error' => 'the video was not handed to Facebook: ' . $e];
        $f = pcGraph('POST', $tg['page'] . '/video_reels', ['upload_phase' => 'finish', 'video_id' => $vid, 'video_state' => 'PUBLISHED', 'description' => (string) $p['fb'], 'access_token' => $tok]);
        if ($e = pcErr($f)) return ['error' => 'the Reel was not published: ' . $e];
        if (empty($f['success'])) return ['error' => 'the Reel was not published: Facebook did not confirm it'];
        $l = pcGraph('GET', $vid, ['fields' => 'permalink_url', 'access_token' => $tok]); $link = (string) ($l['permalink_url'] ?? '');   /* may be empty while Facebook is still processing */
        return ['done' => ['id' => $vid, 'link' => $link === '' ? 'https://www.facebook.com/reel/' . $vid : ($link[0] === '/' ? 'https://www.facebook.com' . $link : $link)]];
    }
    $r = pcGraph('POST', $tg['page'] . '/photos', ['url' => (string) $imgs[0]['url'], 'caption' => (string) $p['fb'], 'published' => 'true', 'access_token' => $tok]);
    if ($e = pcErr($r)) return ['error' => $e];
    $pid = (string) ($r['post_id'] ?? $r['id'] ?? '');
    $l = pcGraph('GET', $pid, ['fields' => 'permalink_url', 'access_token' => $tok]);
    return ['done' => ['id' => $pid, 'link' => (string) ($l['permalink_url'] ?? '')]];
}
/* ---- Instagram: POST /{ig}/media, wait until Meta has fetched the picture, POST /{ig}/media_publish; a photo set is a carousel ---- */
function pcIgReady(string $cid, string $tok, int $tries = 24): bool {   /* a Reel takes longer to process than a picture: 72 tries, about 6 minutes */
    $wait = getenv('PC_POLL_SLEEP'); $wait = $wait === false || $wait === '' ? 5 : (int) $wait;
    for ($i = 0; $i < $tries; $i++) { $s = pcGraph('GET', $cid, ['fields' => 'status_code', 'access_token' => $tok]); $c = (string) ($s['status_code'] ?? ''); if ($c === 'FINISHED') return true; if ($c === 'ERROR' || $c === 'EXPIRED') return false; if ($wait) sleep($wait); }
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
    } elseif (pcIsVideo($imgs[0])) {   /* a video goes up as a Reel, shown in the feed too */
        $c = pcGraph('POST', $ig . '/media', ['media_type' => 'REELS', 'video_url' => (string) $imgs[0]['url'], 'caption' => (string) $p['ig'], 'share_to_feed' => 'true', 'access_token' => $tok]);
    } else {
        $c = pcGraph('POST', $ig . '/media', ['image_url' => (string) $imgs[0]['url'], 'caption' => (string) $p['ig'], 'access_token' => $tok]);
    }
    if ($e = pcErr($c)) return ['error' => $e];
    if (!pcIgReady((string) $c['id'], $tok, pcIsVideo($imgs[0]) ? 72 : 24)) return ['error' => 'Instagram did not finish processing the ' . (pcIsVideo($imgs[0]) ? 'video' : 'post')];
    $r = pcGraph('POST', $ig . '/media_publish', ['creation_id' => (string) $c['id'], 'access_token' => $tok]);
    if ($e = pcErr($r)) return ['error' => $e];
    $l = pcGraph('GET', (string) $r['id'], ['fields' => 'permalink', 'access_token' => $tok]);
    return ['done' => ['id' => (string) $r['id'], 'link' => (string) ($l['permalink'] ?? '')]];
}
/* ---- one email per failure ---- */
function pcFailMail(string $id): void {
    $S = pcState(); $p = $S['posts'][$id] ?? null; if (!$p || !empty($p['emailed'])) return;
    $c = $S['clients'][$p['client']] ?? ['name' => $p['client']];
    $went = []; foreach ((array) $p['done'] as $k => $d) $went[] = pcPlace((string) $k) . ' went: ' . (($d['link'] ?? '') ?: ($d['id'] ?? ''));
    $text = "A post on the post calendar did not go out as approved.\n\n"
          . 'Client: ' . $c['name'] . "\n" . 'Time: ' . ($p['at'] ? pcWall((int) $p['at']) : '-') . "\n"
          . 'Where: ' . implode(' and ', array_map('pcPlace', (array) $p['targets'])) . "\n"
          . 'First line: ' . (strtok((string) ($p['fb'] ?: ($p['ig'] ?: ($p['li'] ?? ''))), "\n") ?: '-') . "\n\n"
          . 'What happened: ' . $p['error'] . "\n" . ($went ? implode("\n", $went) . "\n" : '') . "\n"
          . "Nothing is retried by itself. To try again: open the post, Back to draft, fix it if needed, Approve. Anything that already went is not sent twice.\n\n"
          . PC_ORIGIN . '/' . PC_PUBLIC . "/\n";
    $r = pcMail('Post calendar: a ' . $c['name'] . ' post failed', pcScrub($text));
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

/** 21 Nov 2026: for each client with roll on, when its earliest unposted dated post (draft, or approved but not yet sent) is under a day away,
    every unposted dated post of that client moves forward by the same whole number of weeks, in Colorado time (same weekday and clock time
    across daylight saving). Returns how many posts moved. Published, publishing and failed posts are never touched. */
function pcRollForward(int $now): int {
    return (int) pcMutate(function (array &$S) use ($now) {
        $moved = 0; $tz = new DateTimeZone(PC_TZ);
        foreach ($S['clients'] as $cid => $c) {
            if (empty($c['roll']) || !empty($c['archived'])) continue;
            $ids = []; $min = PHP_INT_MAX;
            foreach ($S['posts'] as $id => $p) if ($p['client'] === $cid && in_array($p['status'], ['draft', 'approved'], true) && (int) ($p['at'] ?? 0) > 0) { $ids[] = $id; $min = min($min, (int) $p['at']); }
            if (!$ids || $min >= $now + 86400) continue;
            $weeks = (int) ceil(($now + 86400 - $min) / (7 * 86400));
            foreach ($ids as $id) {
                $p = &$S['posts'][$id]; $from = (int) $p['at'];
                $p['at'] = (new DateTime('@' . $from))->setTimezone($tz)->modify('+' . $weeks . ' weeks')->getTimestamp();
                if ($p['status'] === 'approved') { $p['status'] = 'draft'; $p['approval'] = null; }
                pcLog($p, 'runner', 'Moved forward ' . $weeks . ' week' . ($weeks === 1 ? '' : 's') . ', from ' . pcWall($from, 'D j M') . ' to ' . pcWall((int) $p['at'], 'D j M') . ': ' . $c['roll']['why']);
                unset($p); $moved++;
            }
            pcEvent(['t' => 'client', 'id' => $cid, 'by' => 'runner', 'what' => 'rolled ' . count($ids) . ' waiting post(s) forward ' . $weeks . ' week(s)']);
        }
        return $moved;
    });
}
