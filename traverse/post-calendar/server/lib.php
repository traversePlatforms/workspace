<?php
declare(strict_types=1);
/* Post calendar: the shared code (2026-10-31, Matthew: "build the calendar and server runner, also set that up for surge as well"; later the
 * same day: any number of clients, a change-request box, photo sets for Saturdays, an import, and the old social-queue runner folded in).
 *
 * One private page (public_html/<path>/, the sign-in page and api/cal.php) and one runner (runner.php beside this file, started every five
 * minutes by sixfold-tools/meta-leads.php). Both read and write the same state through this file.
 *
 * THE RULE: nothing is published unless Matthew tapped Approve on that one post. Approve records who and when, and a fingerprint of what
 * was approved (client, time, targets, captions, pictures). Any later change drops the post back to draft, and the runner checks the
 * fingerprint again before it sends anything. Nothing approves itself, there is no bulk approve, and an "editor" sign-in (the account the
 * laptop uses to load drafts and answer change requests) can never approve.
 *
 * Clients are kept apart: every post belongs to one client for life, every client posts only to the Facebook Page (and Instagram account)
 * assigned to it, a Page can be assigned to only one active client, and the page never shows two clients' posts together.
 *
 * Layout on the server (all beside public_html, never inside it, except the pictures):
 *   post-calendar-tools/  lib.php, runner.php, public-path.txt (the hidden folder's name)
 *   post-calendar-data/   state.json (clients and posts), events.log (append-only history), accounts.json (hashed codes), sessions.json,
 *                         tries.json, pages.json (the last read of which Pages the token sees, no tokens), runner.log, *.lock
 *   post-calendar-data/private/  meta-token.json (Pipeline system token, chmod 600) and client-<id>.json (a client's own Page token);
 *                         when meta-token.json is absent the token is read from sixfold-private/meta-social.json (the same Pipeline token
 *                         the old social-queue runner used). Never printed, never sent to the page.
 *   public_html/<path>/media/  the pictures under random names, so Facebook and Instagram can fetch them at a stable public address.
 *
 * Test hooks (never set on the server): PC_SITE, PC_DATA, PC_PUBLIC, PC_ORIGIN, PC_GRAPH (a stand-in for graph.facebook.com), PC_NOW (the
 * runner's clock), PC_POLL_SLEEP (seconds between Instagram status checks), TRAV_MAIL_MOCK (failure emails to a file, as travMail). */
if (!defined('PC')) { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');
const PC_TZ = 'America/Denver';
define('PC_SITE', rtrim((string) (getenv('PC_SITE') ?: dirname(__DIR__)), '/\\'));
define('PC_DATA', (string) (getenv('PC_DATA') ?: PC_SITE . '/post-calendar-data'));
define('PC_PUBLIC', trim((string) (getenv('PC_PUBLIC') ?: @file_get_contents(__DIR__ . '/public-path.txt'))));
define('PC_MEDIA_DIR', PC_SITE . '/public_html/' . PC_PUBLIC . '/media');
define('PC_ORIGIN', rtrim((string) (getenv('PC_ORIGIN') ?: 'https://traverseplatforms.com'), '/'));
define('PC_GRAPH', (string) (getenv('PC_GRAPH') ?: 'https://graph.facebook.com/v21.0/'));
const PC_NOTE_TO = 'm.sharpe@traverseplatforms.com';
const PC_STATUSES = ['draft' => 'Draft', 'changes' => 'Changes requested', 'approved' => 'Approved', 'publishing' => 'Publishing', 'published' => 'Published', 'failed' => 'Failed', 'removed' => 'Removed'];
const PC_LATE = 6 * 3600;           /* an approved post more than 6 hours past its time is not sent (marked failed: missed) */
const PC_STUCK = 30 * 60;           /* a post left "publishing" this long by a runner that stopped is marked failed, never resent */
const PC_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PC_IG_MAX = 2200;             /* Instagram's caption limit */

function pcNow(): int { $n = getenv('PC_NOW'); return $n !== false && $n !== '' ? (int) $n : time(); }
function pcDir(string $sub = ''): string { $d = PC_DATA . ($sub !== '' ? '/' . $sub : ''); if (!is_dir($d)) { @mkdir($d, 0700, true); } return $d; }
function pcJread(string $f, $def) { $s = @file_get_contents(pcDir() . '/' . $f); if ($s === false) return $def; $j = json_decode($s, true); return $j === null ? $def : $j; }
function pcJwrite(string $f, $v, int $mode = 0640): bool {
    $p = pcDir() . '/' . $f; $t = $p . '.tmp' . bin2hex(random_bytes(3));
    if (file_put_contents($t, json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) === false) return false;
    @chmod($t, $mode); return rename($t, $p);
}
function pcEvent(array $row): void { $row += ['at' => pcNow()]; @file_put_contents(pcDir() . '/events.log', json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); }
function pcClean($v, int $max): string { $t = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) $v) ?? ''); return mb_substr($t, 0, $max); }
function pcText($v, int $max): string { $t = str_replace(["\r\n", "\r"], "\n", (string) $v); $t = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]+/u', ' ', $t) ?? ''; return mb_substr(trim($t), 0, $max); }
function pcId(string $prefix): string { return $prefix . bin2hex(random_bytes(5)); }

/* ---- the state: one file, every change under one lock (the page and the runner both write it) ---- */
function pcSeedClients(): array {
    /* the first two clients (Matthew 2026-10-27/31). Page and Instagram ids from the Pipeline token's own list, read 31 Oct: Sixfold 365 with
       @365aeration; Surge Inc with no Instagram linked yet (@surge.ftw waits on a 2FA code), assigned in Clients once it is. */
    return [
        'sixfold' => ['id' => 'sixfold', 'name' => 'Sixfold 365', 'color' => '#2F5D2C', 'page_id' => '1418675127985724', 'page_name' => 'Sixfold 365', 'ig_id' => '17841460337871226', 'ig_user' => '365aeration',
                      'conn' => 'pipeline', 'slots' => [['d' => 2, 't' => '15:00', 'type' => 'single'], ['d' => 4, 't' => '15:00', 'type' => 'single'], ['d' => 6, 't' => '14:00', 'type' => 'photoset']],
                      'rules' => "No house numbers, street signs, plates or faces on a picture. Nothing seasonal on the picture (season and deadlines go in the caption). Photos come from Brad's job photos with the customer's permission; designed posts get first pick (PHOTO-LEDGER.md). Phone (720) 830-4553.",
                      'archived' => false, 'created' => ['by' => 'setup', 'at' => 1793491200]],
        'surge' => ['id' => 'surge', 'name' => 'Surge', 'color' => '#111111', 'page_id' => '1323606360836132', 'page_name' => 'Surge Inc', 'ig_id' => '', 'ig_user' => '',
                    'conn' => 'pipeline', 'slots' => [['d' => 2, 't' => '15:00', 'type' => 'single'], ['d' => 4, 't' => '15:00', 'type' => 'single']],
                    'rules' => "Company register: surge/brand-voice-company.md and surge/brand/notes/RESTRICTED.md govern every word. No client named or shown (no logos, no client-branded gear), no Surge number without scope, date and source, never a unique or proprietary method. Close on a question.",
                    'archived' => false, 'created' => ['by' => 'setup', 'at' => 1793491200]],
    ];
}
function pcState(): array {
    $s = pcJread('state.json', null);
    if (!is_array($s)) $s = ['clients' => pcSeedClients(), 'posts' => []];
    $s += ['clients' => [], 'posts' => []];
    return $s;
}
/** change the state under the lock: $fn(&$S) returns anything; the state is written back when it returns without throwing */
function pcMutate(callable $fn) {
    $lk = fopen(pcDir() . '/state.lock', 'c'); flock($lk, LOCK_EX);
    try { $S = pcState(); $r = $fn($S); if (!pcJwrite('state.json', $S)) throw new RuntimeException('could not save'); return $r; }
    finally { flock($lk, LOCK_UN); fclose($lk); }
}
function pcLog(array &$p, string $by, string $what): void { $p['log'][] = ['at' => pcNow(), 'by' => $by, 'what' => $what]; if (count($p['log']) > 60) $p['log'] = array_slice($p['log'], -60); pcEvent(['t' => 'post', 'id' => $p['id'], 'client' => $p['client'], 'by' => $by, 'what' => $what]); }

/** what Approve vouches for: who it is for, when, where, the words and the pictures. Any difference afterwards means "not approved". */
function pcFingerprint(array $p): string {
    $t = (array) ($p['targets'] ?? []); sort($t);
    $imgs = array_map(fn($i) => [(string) ($i['file'] ?? ''), (string) ($i['url'] ?? ''), (string) ($i['caption'] ?? '')], (array) ($p['images'] ?? []));
    return hash('sha256', json_encode([(string) $p['client'], (int) ($p['at'] ?? 0), (string) ($p['type'] ?? 'single'), $t, (string) ($p['fb'] ?? ''), (string) ($p['ig'] ?? ''), (string) ($p['album'] ?? ''), $imgs], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
}
function pcNewPost(string $client, array $f, string $by): array {
    $p = ['id' => pcId('p'), 'client' => $client, 'type' => 'single', 'status' => 'draft', 'at' => null, 'targets' => ['fb', 'ig'], 'fb' => '', 'ig' => '', 'album' => '',
          'images' => [], 'note' => '', 'src' => '', 'approval' => null, 'requests' => [], 'done' => [], 'errors' => [], 'error' => '', 'emailed' => false,
          'claimed' => 0, 'log' => [], 'created' => ['by' => $by, 'at' => pcNow()]];
    return array_merge($p, $f);
}
function pcOpenRequest(array $p): ?array { foreach (array_reverse((array) ($p['requests'] ?? [])) as $r) if (empty($r['answered'])) return $r; return null; }

/* ---- time: everything is Mountain time on the wall clock; the page sends "2026-11-03" + "15:00", this turns it into a moment ---- */
function pcAt(string $date, string $time): ?int {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $time)) return null;
    $d = DateTime::createFromFormat('!Y-m-d H:i', $date . ' ' . $time, new DateTimeZone(PC_TZ));   /* "!": nothing taken from the current time */
    return $d && $d->format('Y-m-d H:i') === $date . ' ' . $time ? $d->getTimestamp() : null;   /* refuses 2026-02-31 and the like */
}
function pcWall(int $ts, string $fmt = 'D j M Y, g:i a T'): string { return (new DateTime('@' . $ts))->setTimezone(new DateTimeZone(PC_TZ))->format($fmt); }
/** the client's next default slots after $from (its days and times, Mountain wall clock, so 3 pm stays 3 pm across the 1 Nov clock change) */
function pcSlots(array $client, int $from, int $n = 8, string $type = ''): array {
    $out = []; $day = (new DateTime('@' . $from))->setTimezone(new DateTimeZone(PC_TZ)); $day->setTime(0, 0);
    for ($i = 0; $i < 120 && count($out) < $n; $i++) {
        $dow = (int) $day->format('w');
        foreach ((array) ($client['slots'] ?? []) as $s) {
            if ((int) $s['d'] !== $dow || ($type !== '' && ($s['type'] ?? 'single') !== $type)) continue;
            $ts = pcAt($day->format('Y-m-d'), (string) $s['t']);
            if ($ts !== null && $ts > $from) $out[] = ['at' => $ts, 'date' => $day->format('Y-m-d'), 'time' => (string) $s['t'], 'type' => $s['type'] ?? 'single'];
        }
        $day->modify('+1 day');
    }
    usort($out, fn($a, $b) => $a['at'] <=> $b['at']);
    return array_slice($out, 0, $n);
}
/** the first default slot after $from that none of this client's posts already holds */
function pcFreeSlot(array $S, string $client, int $from, string $type = 'single'): ?array {
    $taken = []; foreach ($S['posts'] as $p) if ($p['client'] === $client && $p['status'] !== 'removed' && $p['at']) $taken[(int) $p['at']] = 1;
    foreach (pcSlots($S['clients'][$client], $from, 40, $type) as $s) if (!isset($taken[$s['at']])) return $s;
    return null;
}

/* ---- checks before Approve: every reason a post could not go out as shown ---- */
function pcProblems(array $S, array $p): array {
    $c = $S['clients'][$p['client']] ?? null; $why = [];
    if (!$c || !empty($c['archived'])) $why[] = 'This client is archived.';
    if (!$p['at']) $why[] = 'Pick a date and time.';
    elseif ((int) $p['at'] < pcNow() + 60) $why[] = 'The time has passed. Pick a time in the future.';
    $t = (array) $p['targets']; if (!$t) $why[] = 'Pick Facebook, Instagram or both.';
    $n = count((array) $p['images']); $vid = pcHasVideo($p);
    if ($p['type'] === 'photoset' && $vid) $why[] = 'A photo set takes pictures only. Make the video its own post.';
    if ($p['type'] === 'photoset') {
        if ($n < 2) $why[] = 'A photo set needs at least 2 pictures.';
        if ($n > 10 && in_array('ig', $t, true)) $why[] = 'An Instagram carousel takes at most 10 pictures.';
        if (in_array('fb', $t, true) && trim((string) $p['album']) === '') $why[] = 'Give the Facebook album a name.';
    } elseif ($n !== 1) $why[] = 'Add the picture.';
    if (in_array('fb', $t, true) && trim((string) $p['fb']) === '') $why[] = 'Write the Facebook caption.';
    if (in_array('ig', $t, true)) {
        if (trim((string) $p['ig']) === '') $why[] = 'Write the Instagram caption.';
        if (mb_strlen((string) $p['ig']) > PC_IG_MAX) $why[] = 'The Instagram caption is over 2,200 characters.';
        if (preg_match_all('/(^|\s)#\w/u', (string) $p['ig']) > 30) $why[] = 'Instagram allows at most 30 hashtags.';
        foreach ((array) $p['images'] as $i) if (!pcIsVideo($i) && !empty($i['w']) && !empty($i['h'])) { $r = $i['w'] / $i['h'];   /* a Reel can be tall (9:16); the 4:5 limit is for pictures */ if ($r < 0.795 || $r > 1.915) { $why[] = 'Instagram needs pictures between 4:5 (tall) and 1.91:1 (wide); one is ' . $i['w'] . ' x ' . $i['h'] . '.'; break; } }
        if ($c && ($c['ig_id'] ?? '') === '') $why[] = 'No Instagram account is assigned to ' . $c['name'] . ' yet (Clients).';
    }
    if ($c && in_array('fb', $t, true) && ($c['page_id'] ?? '') === '') $why[] = 'No Facebook Page is assigned to ' . $c['name'] . ' yet (Clients).';
    if (pcOpenRequest($p)) $why[] = 'A change request is still open.';
    return $why;
}

/* ---- the Meta side ---- */
function pcScrub(string $s): string { foreach (pcTokensSeen() as $t) if ($t !== '') $s = str_replace($t, '[token]', $s); return preg_replace('/access_token=[^&\s"]+/', 'access_token=[token]', $s) ?? $s; }
function pcTokensSeen(?string $add = null): array { static $seen = []; if ($add !== null && $add !== '') $seen[$add] = $add; return array_values($seen); }
function pcPipelineToken(): string {
    foreach ([PC_DATA . '/private/meta-token.json', PC_SITE . '/sixfold-private/meta-social.json'] as $f) {
        $j = json_decode((string) @file_get_contents($f), true); $t = (string) ($j['system_token'] ?? '');
        if ($t !== '') { pcTokensSeen($t); return $t; }
    }
    return '';
}
function pcClientToken(string $id): string {
    $j = json_decode((string) @file_get_contents(PC_DATA . '/private/client-' . preg_replace('/[^a-z0-9-]/', '', $id) . '.json'), true);
    $t = (string) ($j['page_token'] ?? ''); pcTokensSeen($t); return $t;
}
function pcSaveClientToken(string $id, string $tok): bool {
    $d = pcDir('private'); @chmod($d, 0700); $f = $d . '/client-' . preg_replace('/[^a-z0-9-]/', '', $id) . '.json';
    $t = $f . '.tmp'; if (file_put_contents($t, json_encode(['page_token' => $tok, 'at' => pcNow()])) === false) return false; @chmod($t, 0600); return rename($t, $f);
}
/** one Graph API call; never throws, never returns or logs a token. ['error' => ['message' => ...]] on any failure */
function pcGraph(string $method, string $path, array $f = []): array {
    pcTokensSeen((string) ($f['access_token'] ?? ''));
    $ch = curl_init(); $url = PC_GRAPH . $path;
    if ($method === 'GET') $url .= (strpos($url, '?') === false ? '?' : '&') . http_build_query($f);
    else { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($f)); }
    curl_setopt_array($ch, [CURLOPT_URL => $url, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 120, CURLOPT_CONNECTTIMEOUT => 20]);
    $r = curl_exec($ch); $e = curl_error($ch); curl_close($ch);
    if ($r === false) return ['error' => ['message' => 'no answer from Meta: ' . pcScrub($e)]];
    $j = json_decode((string) $r, true);
    if (!is_array($j)) return ['error' => ['message' => 'unreadable answer from Meta']];
    if (isset($j['error'])) $j['error']['message'] = pcScrub((string) ($j['error']['message'] ?? 'error'));
    return $j;
}
function pcErr(array $r): string { return isset($r['error']) ? (string) ($r['error']['message'] ?? 'error') : ''; }
/* Facebook Reels (2026-11-05, Matthew: "lets do videos are reels for facebook"): the video goes to Meta's upload host, not the Graph host.
   The middle of the three steps sends the video's bytes (since 2026-11-06; before that it handed over the public address, header
   file_url, and Meta's fetch failed twice). PC_RUPLOAD: test hook. */
define('PC_RUPLOAD', (string) (getenv('PC_RUPLOAD') ?: 'https://rupload.facebook.com/video-upload/v21.0/'));
function pcRupload(string $videoId, array $media, string $tok): array {
    pcTokensSeen($tok);
    /* 2026-11-06: twice (5 Nov 5 pm and 10 pm) Meta's upload host failed to FETCH the video from its address (no request reached our
       server; then "502 Server reset stream before response", FileUrlProcessingError), while Instagram fetched the same file fine. So the
       bytes are now sent from the server's own copy (headers offset 0 + file_size, body = the file, streamed, not held in memory). The
       address (file_url) is only a fallback for when the copy is missing. */
    $path = PC_MEDIA_DIR . '/' . basename((string) ($media['file'] ?? ''));
    $ch = curl_init(PC_RUPLOAD . rawurlencode($videoId)); $fh = null;
    $opts = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 600, CURLOPT_CONNECTTIMEOUT => 20];
    if (($media['file'] ?? '') !== '' && is_file($path) && ($size = filesize($path)) > 0 && ($fh = fopen($path, 'rb'))) {
        $opts += [CURLOPT_UPLOAD => true, CURLOPT_CUSTOMREQUEST => 'POST', CURLOPT_INFILE => $fh, CURLOPT_INFILESIZE => $size,
            CURLOPT_HTTPHEADER => ['Authorization: OAuth ' . $tok, 'offset: 0', 'file_size: ' . $size, 'Content-Type: application/octet-stream', 'Expect:']];
    } else {
        $opts += [CURLOPT_POST => true, CURLOPT_POSTFIELDS => '', CURLOPT_HTTPHEADER => ['Authorization: OAuth ' . $tok, 'file_url: ' . (string) ($media['url'] ?? '')]];
    }
    curl_setopt_array($ch, $opts);
    $r = curl_exec($ch); $e = curl_error($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch); if ($fh) fclose($fh);
    if ($r === false) return ['error' => ['message' => 'no answer from Meta\'s upload host: ' . pcScrub($e)]];
    /* 2026-11-05: the first real Reel (p36f0744116) failed here with no reason kept. Keep Meta's own words: rupload reports errors as
       debug_info {type, message}, not Graph's error {message}; failing that, the HTTP status and the start of the reply (tokens scrubbed). */
    $said = 'HTTP ' . $code . ': ' . pcScrub(substr(trim(preg_replace('/\s+/', ' ', (string) $r) ?? ''), 0, 300));
    $j = json_decode((string) $r, true);
    if (!is_array($j)) return ['error' => ['message' => 'unreadable answer from Meta\'s upload host (' . $said . ')']];
    if (isset($j['error'])) $j['error']['message'] = pcScrub((string) ($j['error']['message'] ?? (is_string($j['error']) ? $j['error'] : 'error')));
    elseif (isset($j['debug_info']['message'])) $j['error'] = ['message' => 'Meta\'s upload host said: ' . pcScrub((string) $j['debug_info']['message'])
        . (isset($j['debug_info']['type']) ? ' (' . pcScrub((string) $j['debug_info']['type']) . ')' : '')];
    elseif (empty($j['success'])) $j['error'] = ['message' => 'Meta\'s upload host did not take the video (' . $said . ')'];
    return $j;
}
/** the Pages (and their Instagram accounts) the Pipeline token can post to, tokens included: for this file only, never sent anywhere */
function pcPipelinePages(): array {
    $tok = pcPipelineToken(); if ($tok === '') return ['error' => 'No Meta token on the server.'];
    $r = pcGraph('GET', 'me/accounts', ['fields' => 'name,id,access_token,instagram_business_account{id,username}', 'limit' => '100', 'access_token' => $tok]);
    if ($e = pcErr($r)) return ['error' => $e];
    $out = []; foreach ((array) ($r['data'] ?? []) as $pg) { pcTokensSeen((string) ($pg['access_token'] ?? '')); $out[(string) $pg['id']] = $pg; }
    return ['pages' => $out];
}
/** the same list without tokens, with which client holds each Page and Instagram account; kept in pages.json for the page */
function pcPagesView(array $S, ?array $live = null): array {
    $live = $live ?? pcPipelinePages();
    if (isset($live['error'])) return ['ok' => false, 'error' => $live['error'], 'at' => pcNow()];
    $held = []; $heldIg = [];
    foreach ($S['clients'] as $c) if (empty($c['archived'])) { if ($c['page_id'] !== '') $held[$c['page_id']] = $c['id']; if ($c['ig_id'] !== '') $heldIg[$c['ig_id']] = $c['id']; }
    $rows = [];
    foreach ($live['pages'] as $pg) {
        $ig = $pg['instagram_business_account'] ?? null;
        $rows[] = ['page_id' => (string) $pg['id'], 'page_name' => (string) $pg['name'], 'client' => $held[(string) $pg['id']] ?? null,
                   'ig_id' => $ig ? (string) $ig['id'] : '', 'ig_user' => $ig ? (string) ($ig['username'] ?? '') : '', 'ig_client' => $ig ? ($heldIg[(string) $ig['id']] ?? null) : null];
    }
    $v = ['ok' => true, 'pages' => $rows, 'at' => pcNow()]; pcJwrite('pages.json', $v); return $v;
}
/** where one client's post goes: its Page's id and token and its Instagram account; refuses anything not assigned to it */
function pcTarget(array $c, ?array $live = null): array {
    if (($c['page_id'] ?? '') === '') return ['error' => 'no Facebook Page assigned to ' . $c['name']];
    if (($c['conn'] ?? 'pipeline') === 'own') {
        $tok = pcClientToken((string) $c['id']); if ($tok === '') return ['error' => 'no Page token saved for ' . $c['name']];
        $me = pcGraph('GET', 'me', ['fields' => 'id,name,instagram_business_account{id,username}', 'access_token' => $tok]);
        if ($e = pcErr($me)) return ['error' => 'the Page token for ' . $c['name'] . ' did not work: ' . $e];
        if ((string) ($me['id'] ?? '') !== (string) $c['page_id']) return ['error' => 'the saved token belongs to a different Page than the one assigned to ' . $c['name']];
        $pg = $me + ['access_token' => $tok];
    } else {
        $live = $live ?? pcPipelinePages(); if (isset($live['error'])) return ['error' => 'could not read the Pages: ' . $live['error']];
        $pg = $live['pages'][(string) $c['page_id']] ?? null;
        if (!$pg) return ['error' => 'the Page assigned to ' . $c['name'] . ' is not one the Meta token can post to'];
    }
    $ig = (string) ($pg['instagram_business_account']['id'] ?? '');
    $igOk = $ig !== '' && $ig === (string) ($c['ig_id'] ?? '');
    return ['page' => (string) $pg['id'], 'token' => (string) $pg['access_token'], 'ig' => $igOk ? $ig : '', 'igWhy' => $igOk ? '' : (($c['ig_id'] ?? '') === '' ? 'no Instagram account assigned to ' . $c['name'] : 'the Instagram account linked to the Page is not the one assigned to ' . $c['name'])];
}

/* ---- failure email: the travMail path (traverse-site-private/site-config.php, the same Gmail sender and SMTP client as rounds.php) ---- */
function pcMail(string $subject, string $text): array {
    $mock = getenv('TRAV_MAIL_MOCK');
    if ($mock) { @file_put_contents($mock, json_encode(['at' => time(), 'to' => PC_NOTE_TO, 'subject' => $subject, 'body' => $text], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); return ['ok' => true, 'stage' => 'mock', 'error' => '']; }
    $c = ['host' => 'smtp.gmail.com', 'port' => 587, 'user' => 'm.sharpe@traverseplatforms.com', 'pass' => '', 'from_name' => 'Traverse', 'ehlo' => 'traverseplatforms.com'];
    $f = PC_SITE . '/traverse-site-private/site-config.php'; $own = is_file($f) ? (include $f) : [];
    if (is_array($own['smtp'] ?? null)) foreach (['host', 'port', 'user', 'pass', 'ehlo'] as $k) if (isset($own['smtp'][$k])) $c[$k] = $own['smtp'][$k];
    $c['pass'] = (string) preg_replace('/\s+/', '', (string) $c['pass']);
    if ($c['pass'] === '') return ['ok' => false, 'stage' => 'config', 'error' => 'no mail password in traverse-site-private/site-config.php'];
    $fail = fn($st, $e) => ['ok' => false, 'stage' => $st, 'error' => $e];
    $fp = @stream_socket_client(((int) $c['port'] === 465 ? 'ssl://' : 'tcp://') . $c['host'] . ':' . (int) $c['port'], $errno, $errstr, 20); if (!$fp) return $fail('connect', trim($errno . ' ' . $errstr));
    stream_set_timeout($fp, 20);
    $read = function () use ($fp): array { $lines = []; while (true) { $l = @fgets($fp, 2048); if ($l === false) return [0, 'connection closed']; $lines[] = rtrim($l, "\r\n"); if (strlen($l) < 4 || $l[3] !== '-') break; } $last = (string) end($lines); return [(int) substr($last, 0, 3), implode(' | ', $lines)]; };
    $w = function (string $cmd) use ($fp) { @fwrite($fp, $cmd . "\r\n"); };
    $quit = function () use ($fp) { @fwrite($fp, "QUIT\r\n"); @fclose($fp); };
    [$code, $rep] = $read(); if ($code !== 220) { $quit(); return $fail('greeting', $rep); }
    $w('EHLO ' . $c['ehlo']); [$code, $rep] = $read(); if ($code !== 250) { $quit(); return $fail('ehlo', $rep); }
    if ((int) $c['port'] !== 465) {
        $w('STARTTLS'); [$code, $rep] = $read(); if ($code !== 220) { $quit(); return $fail('starttls', $rep); }
        $cm = STREAM_CRYPTO_METHOD_TLS_CLIENT; if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) $cm |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT; if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) $cm |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
        if (@stream_socket_enable_crypto($fp, true, $cm) !== true) { $quit(); return $fail('starttls', 'TLS negotiation failed'); }
        $w('EHLO ' . $c['ehlo']); [$code, $rep] = $read(); if ($code !== 250) { $quit(); return $fail('ehlo-tls', $rep); }
    }
    $w('AUTH LOGIN'); [$code, $rep] = $read(); if ($code !== 334) { $quit(); return $fail('auth', $rep); }
    $w(base64_encode((string) $c['user'])); [$code, $rep] = $read(); if ($code !== 334) { $quit(); return $fail('auth', $rep); }
    $w(base64_encode((string) $c['pass'])); [$code, $rep] = $read(); if ($code !== 235) { $quit(); return $fail('auth', $rep); }
    $w('MAIL FROM:<' . $c['user'] . '>'); [$code, $rep] = $read(); if ($code !== 250) { $quit(); return $fail('from', $rep); }
    $w('RCPT TO:<' . PC_NOTE_TO . '>'); [$code, $rep] = $read(); if ($code !== 250 && $code !== 251) { $quit(); return $fail('to', $rep); }
    $w('DATA'); [$code, $rep] = $read(); if ($code !== 354) { $quit(); return $fail('data', $rep); }
    $h = fn(string $s) => preg_match('/[\x80-\xFF]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
    $msg = implode("\r\n", ['Date: ' . date('r'), 'From: ' . $h((string) $c['from_name']) . ' <' . $c['user'] . '>', 'To: ' . PC_NOTE_TO, 'Subject: ' . $h($subject),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@traverseplatforms.com>', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64'])
        . "\r\n\r\n" . chunk_split(base64_encode($text), 76, "\r\n");
    @fwrite($fp, $msg . "\r\n.\r\n"); [$code, $rep] = $read(); $quit();
    return $code === 250 ? ['ok' => true, 'stage' => 'sent', 'error' => ''] : $fail('data', $rep);
}

/* ---- accounts: a code per person, kept hashed. admin = Matthew (approves); editor = the laptop's loader (drafts, pictures, answers; never approves) ---- */
function pcCodeHash(string $c): string { return hash('sha256', 'postcal|' . $c); }
function pcAddAccount(string $name, string $role): string {
    $acc = pcJread('accounts.json', ['codes' => []]);
    do { $code = (string) random_int(10000000, 99999999); } while (isset($acc['codes'][pcCodeHash($code)]));
    $acc['codes'][pcCodeHash($code)] = ['name' => pcClean($name, 40), 'role' => $role, 'at' => pcNow()];
    pcJwrite('accounts.json', $acc, 0600); return $code;
}

/* ---- pictures: kept under public_html/<path>/media/ with random names (an address nobody can guess, stable for Meta to fetch) ---- */
function pcStoreImage(string $tmp, string $origName = ''): array {
    $sz = @filesize($tmp); if (!$sz) return ['error' => 'The picture did not arrive.'];
    if ($sz > 8 * 1024 * 1024) return ['error' => 'The picture is over 8 MB (Instagram\'s limit). Save it smaller.'];
    $info = @getimagesize($tmp); $type = $info[2] ?? 0;
    if (!in_array($type, [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)) return ['error' => 'Use a JPEG or PNG picture.'];
    [$w, $h] = [(int) $info[0], (int) $info[1]];
    if ($w < 320 || $h < 320) return ['error' => 'The picture is too small (at least 320 px each way).'];
    if (!is_dir(PC_MEDIA_DIR)) @mkdir(PC_MEDIA_DIR, 0755, true);
    $name = bin2hex(random_bytes(12)) . ($type === IMAGETYPE_PNG ? '.png' : '.jpg'); $dest = PC_MEDIA_DIR . '/' . $name;
    if (!(is_uploaded_file($tmp) ? move_uploaded_file($tmp, $dest) : copy($tmp, $dest))) return ['error' => 'Could not save the picture.'];
    @chmod($dest, 0644);
    return ['file' => $name, 'url' => PC_ORIGIN . '/' . PC_PUBLIC . '/media/' . $name, 'w' => $w, 'h' => $h, 'bytes' => (int) $sz, 'md5' => (string) md5_file($dest), 'name' => pcClean(basename($origName), 80), 'caption' => ''];
}
/* ---- video (2026-11-05, Matthew: "get this pov one posted for our thursday post. Add it to the post build in the hub so i can approve it"):
   a one-post item whose single file is an MP4 instead of a picture, marked kind "video". Facebook gets it as a Page video, Instagram as a
   Reel. Same approval, fingerprint and once-only rules as a picture. MP4 only (H.264 + AAC is what both accept everywhere: the laptop
   converts a phone .mov before loading it); at most 100 MB and 90 seconds, Instagram's Reel limits through the API. */
const PC_VIDEO_MAX = 100 * 1024 * 1024;
function pcIsVideo(array $im): bool { return ($im['kind'] ?? '') === 'video'; }
function pcHasVideo(array $p): bool { foreach ((array) ($p['images'] ?? []) as $im) if (pcIsVideo($im)) return true; return false; }
/** width, height and seconds from ffprobe when the server lets PHP run it; otherwise what the uploader said (or nothing) */
function pcProbeVideo(string $path, array $said): array {
    $w = (int) ($said['w'] ?? 0); $h = (int) ($said['h'] ?? 0); $sec = (float) ($said['sec'] ?? 0);
    if (function_exists('shell_exec') && is_executable('/usr/local/bin/ffprobe')) {
        $j = json_decode((string) @shell_exec('/usr/local/bin/ffprobe -v error -select_streams v:0 -show_entries stream=width,height:format=duration -of json ' . escapeshellarg($path) . ' 2>/dev/null'), true);
        if (is_array($j)) { $s = $j['streams'][0] ?? []; $w = (int) ($s['width'] ?? $w); $h = (int) ($s['height'] ?? $h); $sec = (float) ($j['format']['duration'] ?? $sec); }
    }
    return [$w ?: null, $h ?: null, $sec ?: null];
}
function pcStoreVideo(string $tmp, string $origName = '', array $said = []): array {
    $sz = @filesize($tmp); if (!$sz) return ['error' => 'The video did not arrive.'];
    if ($sz > PC_VIDEO_MAX) return ['error' => 'The video is over 100 MB. Save it smaller.'];
    $head = (string) @file_get_contents($tmp, false, null, 0, 12);
    if (substr($head, 4, 4) !== 'ftyp') return ['error' => 'Use an MP4 video.'];
    [$w, $h, $sec] = pcProbeVideo($tmp, $said);
    if ($sec !== null && $sec > 90.5) return ['error' => 'The video is over 90 seconds (the longest Reel Instagram takes from here).'];
    if (!is_dir(PC_MEDIA_DIR)) @mkdir(PC_MEDIA_DIR, 0755, true);
    $name = bin2hex(random_bytes(12)) . '.mp4'; $dest = PC_MEDIA_DIR . '/' . $name;
    if (!(is_uploaded_file($tmp) ? move_uploaded_file($tmp, $dest) : copy($tmp, $dest))) return ['error' => 'Could not save the video.'];
    @chmod($dest, 0644);
    return ['file' => $name, 'url' => PC_ORIGIN . '/' . PC_PUBLIC . '/media/' . $name, 'kind' => 'video', 'w' => $w, 'h' => $h, 'sec' => $sec, 'bytes' => (int) $sz, 'md5' => (string) md5_file($dest), 'name' => pcClean(basename($origName), 80), 'caption' => ''];
}
/** a picture or a video, told apart by what the file is (an MP4 starts with "ftyp" at byte 4), not by its name */
function pcStoreMedia(string $tmp, string $origName = '', array $said = []): array {
    $head = (string) @file_get_contents($tmp, false, null, 0, 12);
    return substr($head, 4, 4) === 'ftyp' ? pcStoreVideo($tmp, $origName, $said) : pcStoreImage($tmp, $origName);
}
/** a replaced picture's file goes too when nothing else uses it and the post never went anywhere (a published picture stays where Meta saw it) */
function pcDropUnused(array $S, array $p, array $old): void {
    $f = (string) ($old['file'] ?? ''); if ($f === '' || !empty($p['done'])) return;
    foreach ($S['posts'] as $q) foreach ((array) $q['images'] as $im) if (($im['file'] ?? '') === $f) return;
    if (preg_match('/^[0-9a-f]{24}\.(jpg|png|mp4)$/', $f)) @unlink(PC_MEDIA_DIR . '/' . $f);
}

/* ---- what the page and the CLI may see of a post and a client (no tokens; nothing else is secret in them) ---- */
function pcPostView(array $S, array $p): array {
    $p['problems'] = in_array($p['status'], ['draft'], true) ? pcProblems($S, $p) : [];
    $p['openRequest'] = pcOpenRequest($p);
    $p['fingerprint'] = pcFingerprint($p);
    $p['approvedNow'] = $p['status'] === 'approved' && ($p['approval']['hash'] ?? '') === pcFingerprint($p);
    return $p;
}
function pcClientView(array $c): array { $c['ownToken'] = ($c['conn'] ?? '') === 'own' && pcClientToken((string) $c['id']) !== ''; return $c; }
function pcRequestsOpen(array $S, string $client = ''): array {
    $out = [];
    foreach ($S['posts'] as $p) {
        if ($p['status'] === 'removed' || ($client !== '' && $p['client'] !== $client)) continue;
        $r = pcOpenRequest($p); if (!$r) continue;
        $out[] = ['post' => $p['id'], 'client' => $p['client'], 'clientName' => $S['clients'][$p['client']]['name'] ?? $p['client'], 'request' => $r['id'], 'text' => $r['text'], 'by' => $r['by'], 'at' => $r['at'],
                  'when' => $p['at'] ? pcWall((int) $p['at']) : null, 'type' => $p['type'], 'targets' => $p['targets'], 'fb' => $p['fb'], 'ig' => $p['ig'], 'album' => $p['album'],
                  'images' => array_map(fn($i) => ['url' => $i['url'] ?? '', 'caption' => $i['caption'] ?? '', 'w' => $i['w'] ?? null, 'h' => $i['h'] ?? null], (array) $p['images']), 'note' => $p['note'], 'src' => $p['src']];
    }
    return $out;
}
