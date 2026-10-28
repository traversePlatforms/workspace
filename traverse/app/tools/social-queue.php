<?php
/* Approved social posts, published at their time (2026-10-27, Matthew: Sixfold 365 and Surge every Tue/Thu 3 pm, Sixfold photos every
   Saturday 2 pm; "schedule it for saturday at 2 but it a carousel post"). Started by meta-leads.php (the SiteGround every-5-minutes cron) in the
   background, so it runs within five minutes of each post's time even when nobody's laptop is on.

   The queue is sixfold-private/social-queue.json: a list of posts, each
     { id, at (unix, when to publish), page ("Sixfold 365" | "Surge Inc"), status ("approved" | "posted" | "failed" | "missed" | "held"),
       approved: "who and when, in words", fb: {...} | null, ig: {...} | null, result: {...} }
   fb: { type: "photo", image, caption } | { type: "album", name, description, photos: [{ image, caption }] }
   ig: { type: "image", image, caption } | { type: "carousel", images: [..], caption }
   Images are public https URLs. Only "approved" posts go out: nothing is posted without Matthew's go for that post (the workspace's
   standing rule; scheduling counts as posting). A post more than 6 hours late is marked "missed", not posted.
   The Meta token (a system user's, never printed) is sixfold-private/meta-social.json { system_token }. Log: social-queue.log. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');
$priv = getenv('SIXFOLD_PRIVATE_DIR') ?: dirname(__DIR__) . '/sixfold-private';
$qf = $priv . '/social-queue.json'; $tf = $priv . '/meta-social.json'; $lf = $priv . '/social-queue.log';
if (!is_file($qf)) exit;
$lk = fopen($qf . '.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX | LOCK_NB)) exit;   /* one run at a time */
$say = function (string $m) use ($lf) { file_put_contents($lf, date('Y-m-d H:i:s') . ' ' . $m . "\n", FILE_APPEND); };
$q = json_decode((string) file_get_contents($qf), true); if (!is_array($q)) { $say('queue unreadable'); exit; }
$now = time(); $due = [];
foreach ($q as $i => $p) if (($p['status'] ?? '') === 'approved' && (int) ($p['at'] ?? 0) <= $now) $due[] = $i;
if (!$due) exit;
$tok = (string) (json_decode((string) @file_get_contents($tf), true)['system_token'] ?? ''); if ($tok === '') { $say('no token'); exit; }
$V = 'https://graph.facebook.com/v21.0/';
$call = function (string $method, string $path, array $f = []) use ($V) {
    if (($fk = getenv('SOCIAL_QUEUE_FAKE')) !== false && $fk !== '') {   /* the tests only (review 2026-10-27 evening): canned answers from a file, nothing reaches Meta; "die" = Meta hung */
        $fake = json_decode((string) file_get_contents($fk), true); if (!empty($fake['die'][$path])) throw new RuntimeException('fake: Meta hung on ' . $path);
        return (array) ($fake['by'][$path] ?? ['error' => ['message' => 'fake: no answer for ' . $path]]);
    }
    $ch = curl_init(); $url = $V . $path;
    if ($method === 'GET') { $url .= (strpos($url, '?') === false ? '?' : '&') . http_build_query($f); } else { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($f)); }
    curl_setopt_array($ch, [CURLOPT_URL => $url, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 120]);
    $r = curl_exec($ch); curl_close($ch); $j = json_decode((string) $r, true);
    return is_array($j) ? $j : ['error' => ['message' => 'no answer from Meta']];
};
$err = fn($r) => isset($r['error']) ? (string) ($r['error']['message'] ?? 'error') : '';
$acc = $call('GET', 'me/accounts', ['fields' => 'name,id,access_token,instagram_business_account', 'access_token' => $tok]);
$pages = []; foreach ((array) ($acc['data'] ?? []) as $pg) $pages[(string) $pg['name']] = $pg;
/* an Instagram container is usable once Meta has fetched the image */
$ready = function (string $id, string $pt) use ($call) {
    for ($i = 0; $i < 30; $i++) { $s = $call('GET', $id, ['fields' => 'status_code', 'access_token' => $pt]); $c = (string) ($s['status_code'] ?? ''); if ($c === 'FINISHED') return true; if ($c === 'ERROR') return false; sleep(4); }
    return false;
};
/* the file after each post, not once at the end (review 2026-10-27 evening): a run that died half way (killed, a restart, Meta hanging
   past the process limit) left every post "approved" and the next run posted the first ones again. Merged into the file as it is now, so
   a post added or held by hand while a run was going is kept: only the posts this run took out of "approved" are written over. */
$save = function () use ($qf, &$q) {
    $cur = json_decode((string) @file_get_contents($qf), true); if (!is_array($cur)) $cur = $q;
    $mine = []; foreach ($q as $x) if (isset($x['id']) && ($x['status'] ?? '') !== 'approved') $mine[(string) $x['id']] = $x;
    foreach ($cur as &$c) if (isset($c['id'], $mine[(string) $c['id']]) && ($c['status'] ?? '') === 'approved') { $c['status'] = $mine[(string) $c['id']]['status']; $c['result'] = $mine[(string) $c['id']]['result'] ?? null; } unset($c);
    $t = $qf . '.tmp'; file_put_contents($t, json_encode($cur, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)); rename($t, $qf);
};
foreach ($due as $i) {
    $p = &$q[$i]; $res = [];
    if ($now - (int) $p['at'] > 6 * 3600) { $p['status'] = 'missed'; $say("{$p['id']}: missed (more than 6 hours late), not posted"); unset($p); $save(); continue; }
    $pg = $pages[(string) ($p['page'] ?? '')] ?? null;
    if (!$pg) { $p['status'] = 'failed'; $p['result'] = ['error' => 'page not reachable: ' . ($p['page'] ?? '')]; $say("{$p['id']}: page not reachable"); unset($p); $save(); continue; }
    $pt = (string) $pg['access_token']; $ok = true;
    $fb = $p['fb'] ?? null;
    if (is_array($fb) && ($fb['type'] ?? '') === 'photo') {
        $r = $call('POST', $pg['id'] . '/photos', ['url' => $fb['image'], 'caption' => (string) ($fb['caption'] ?? ''), 'published' => 'true', 'access_token' => $pt]);
        if ($e = $err($r)) { $ok = false; $res['fb'] = 'failed: ' . $e; } else { $l = $call('GET', (string) ($r['post_id'] ?? $r['id']), ['fields' => 'permalink_url', 'access_token' => $pt]); $res['fb'] = (string) ($l['permalink_url'] ?? $r['post_id'] ?? $r['id']); }
    } elseif (is_array($fb) && ($fb['type'] ?? '') === 'album') {
        $a = $call('POST', $pg['id'] . '/albums', ['name' => (string) $fb['name'], 'message' => (string) ($fb['description'] ?? ''), 'access_token' => $pt]);
        if ($e = $err($a)) { $ok = false; $res['fb'] = 'album failed: ' . $e; } else {
            $n = 0; foreach ((array) $fb['photos'] as $ph) { $r = $call('POST', $a['id'] . '/photos', ['url' => $ph['image'], 'caption' => (string) ($ph['caption'] ?? ''), 'access_token' => $pt]); if ($err($r)) $ok = false; else $n++; }
            $l = $call('GET', (string) $a['id'], ['fields' => 'link', 'access_token' => $pt]);
            $res['fb'] = "album {$n}/" . count((array) $fb['photos']) . ' photos: ' . (string) ($l['link'] ?? $a['id']);
        }
    }
    $ig = $p['ig'] ?? null; $igId = (string) ($pg['instagram_business_account']['id'] ?? '');
    if (is_array($ig) && $igId === '') { $ok = false; $res['ig'] = 'failed: no Instagram linked to ' . $p['page']; }
    elseif (is_array($ig)) {
        $cid = '';
        if (($ig['type'] ?? '') === 'carousel') {
            $kids = [];
            foreach ((array) $ig['images'] as $img) { $c = $call('POST', $igId . '/media', ['image_url' => $img, 'is_carousel_item' => 'true', 'access_token' => $pt]); if ($err($c) || !$ready((string) $c['id'], $pt)) { $kids = null; $res['ig'] = 'failed: carousel image ' . ($err($c) ?: 'not processed'); break; } $kids[] = (string) $c['id']; }
            if ($kids) { $c = $call('POST', $igId . '/media', ['media_type' => 'CAROUSEL', 'children' => implode(',', $kids), 'caption' => (string) ($ig['caption'] ?? ''), 'access_token' => $pt]); if ($e = $err($c)) $res['ig'] = 'failed: ' . $e; else $cid = (string) $c['id']; }
        } else {
            $c = $call('POST', $igId . '/media', ['image_url' => $ig['image'], 'caption' => (string) ($ig['caption'] ?? ''), 'access_token' => $pt]); if ($e = $err($c)) $res['ig'] = 'failed: ' . $e; else $cid = (string) $c['id'];
        }
        if ($cid !== '' && $ready($cid, $pt)) {
            $r = $call('POST', $igId . '/media_publish', ['creation_id' => $cid, 'access_token' => $pt]);
            if ($e = $err($r)) $res['ig'] = 'failed: ' . $e; else { $l = $call('GET', (string) $r['id'], ['fields' => 'permalink', 'access_token' => $pt]); $res['ig'] = (string) ($l['permalink'] ?? $r['id']); }
        } elseif ($cid !== '') $res['ig'] = 'failed: not processed by Meta';
        if (strpos((string) ($res['ig'] ?? ''), 'failed') === 0) $ok = false;
    }
    $p['status'] = $ok ? 'posted' : 'failed'; $p['result'] = $res + ['at' => date('c')];
    $say("{$p['id']}: {$p['status']} " . json_encode($res, JSON_UNESCAPED_SLASHES));
    unset($p); $save();
}
