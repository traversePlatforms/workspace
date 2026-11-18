<?php
declare(strict_types=1);
/* Post calendar: the shared code (2026-10-31, Matthew: "build the calendar and server runner, also set that up for surge as well"; later the
 * same day: any number of clients, a change-request box, photo sets for Saturdays, an import, and the old social-queue runner folded in).
 *
 * One private page (public_html/<path>/, the sign-in page and api/cal.php) and one runner (runner.php beside this file, started every five
 * minutes by sixfold-tools/meta-leads.php). Both read and write the same state through this file.
 *
 * THE RULE: nothing is published unless an approver tapped Approve on that one post (Matthew for every client; since 2026-11-16 a client's
 * own approver for that client only, see "accounts" below). Approve records who and when, and a fingerprint of what
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
    $a = [(string) $p['client'], (int) ($p['at'] ?? 0), (string) ($p['type'] ?? 'single'), $t, (string) ($p['fb'] ?? ''), (string) ($p['ig'] ?? ''), (string) ($p['album'] ?? ''), $imgs];
    /* LinkedIn (2026-11-18): its words and first comment count too, added only when there are any, so every post made before keeps its fingerprint */
    if (in_array('li', $t, true) || (string) ($p['li'] ?? '') !== '' || (string) ($p['li_comment'] ?? '') !== '') $a[] = ['li', (string) ($p['li'] ?? ''), (string) ($p['li_comment'] ?? '')];
    return hash('sha256', json_encode($a, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
}
function pcNewPost(string $client, array $f, string $by): array {
    $p = ['id' => pcId('p'), 'client' => $client, 'type' => 'single', 'status' => 'draft', 'at' => null, 'targets' => ['fb', 'ig'], 'fb' => '', 'ig' => '', 'album' => '', 'li' => '', 'li_comment' => '',
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
    $t = (array) $p['targets']; if (!$t) $why[] = $c && pcLiAllowed((string) $c['id']) ? 'Pick where it goes.' : 'Pick Facebook, Instagram or both.';
    foreach (['fb', 'ig'] as $w) if (in_array($w, $t, true) && ($h = pcHeld($c, $w))) $why[] = pcPlace($w) . ' is on hold for ' . $c['name'] . ' (' . $h['why'] . '). Untick it.';
    $n = count((array) $p['images']); $vid = pcHasVideo($p);
    $liOnly = $t === ['li'];   /* a LinkedIn-only post may be words alone (2026-11-18) */
    if ($p['type'] === 'photoset' && $vid) $why[] = 'A photo set takes pictures only. Make the video its own post.';
    if ($p['type'] === 'photoset') {
        if ($n < 2) $why[] = 'A photo set needs at least 2 pictures.';
        if ($n > 10 && in_array('ig', $t, true)) $why[] = 'An Instagram carousel takes at most 10 pictures.';
        /* no album name needed since 2026-11-16: Facebook gets a photo set as one post with several photos, not an album (see runner.php) */
    } elseif ($n !== 1 && !($liOnly && $n === 0)) $why[] = 'Add the picture.';
    if (in_array('fb', $t, true) && trim((string) $p['fb']) === '') $why[] = 'Write the Facebook caption.';
    if (in_array('ig', $t, true)) {
        if (trim((string) $p['ig']) === '') $why[] = 'Write the Instagram caption.';
        if (mb_strlen((string) $p['ig']) > PC_IG_MAX) $why[] = 'The Instagram caption is over 2,200 characters.';
        if (preg_match_all('/(^|\s)#\w/u', (string) $p['ig']) > 30) $why[] = 'Instagram allows at most 30 hashtags.';
        foreach ((array) $p['images'] as $i) if (!pcIsVideo($i) && !empty($i['w']) && !empty($i['h'])) { $r = $i['w'] / $i['h'];   /* a Reel can be tall (9:16); the 4:5 limit is for pictures */ if ($r < 0.795 || $r > 1.915) { $why[] = 'Instagram needs pictures between 4:5 (tall) and 1.91:1 (wide); one is ' . $i['w'] . ' x ' . $i['h'] . '.'; break; } }
        if ($c && ($c['ig_id'] ?? '') === '') $why[] = 'No Instagram account is assigned to ' . $c['name'] . ' yet (Clients).';
    }
    if ($c && in_array('fb', $t, true) && ($c['page_id'] ?? '') === '') $why[] = 'No Facebook Page is assigned to ' . $c['name'] . ' yet (Clients).';
    foreach (pcLiProblems($S, $p, $c) as $w) $why[] = $w;
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

/* ---- accounts: a code per person, kept hashed.
 *   admin  = Matthew: every client, approves, and the client setup (Pages, tokens, archive).
 *   editor = the laptop's loader: drafts, pictures, answers to change requests, every client; never approves.
 *   client = a client's own approver (2026-11-16, Matthew: "Create a sixfold only sign in for jen. I want her to be able to write, schedule,
 *            and approve the content"): writes, edits, approves, requests changes and removes posts, and changes the posting days, but only
 *            for the clients listed in its "clients"; every other client does not exist for it. Never the Pages, tokens or client setup. ---- */
const PC_ROLES = ['admin', 'editor', 'client'];
function pcCodeHash(string $c): string { return hash('sha256', 'postcal|' . $c); }
function pcAddAccount(string $name, string $role, array $clients = []): string {
    $acc = pcJread('accounts.json', ['codes' => []]);
    do { $code = (string) random_int(10000000, 99999999); } while (isset($acc['codes'][pcCodeHash($code)]));
    $a = ['name' => pcClean($name, 40), 'role' => $role, 'at' => pcNow()];
    if ($role === 'client') $a['clients'] = array_values(array_unique(array_map('strval', $clients)));
    $acc['codes'][pcCodeHash($code)] = $a;
    pcJwrite('accounts.json', $acc, 0600); return $code;
}
/** take accounts away by name (and role, if given) and sign out every session they had; returns how many accounts went */
function pcRemoveAccount(string $name, string $role = ''): int {
    $acc = pcJread('accounts.json', ['codes' => []]); $gone = [];
    foreach ($acc['codes'] as $h => $a) if (($a['name'] ?? '') === $name && ($role === '' || ($a['role'] ?? '') === $role)) { $gone[] = $h; unset($acc['codes'][$h]); }
    if (!$gone) return 0;
    pcJwrite('accounts.json', $acc, 0600);
    $ses = pcJread('sessions.json', []);
    foreach ($ses as $k => $s) if (in_array($s['acct'] ?? '', $gone, true) || (!isset($s['acct']) && ($s['name'] ?? '') === $name && ($role === '' || ($s['role'] ?? '') === $role))) unset($ses[$k]);
    pcJwrite('sessions.json', $ses, 0600);
    return count($gone);
}
/** the accounts without their codes: name, role and, for a client sign-in, its clients (never the hashes) */
function pcAccountsList(): array {
    $out = []; foreach ((array) (pcJread('accounts.json', ['codes' => []])['codes'] ?? []) as $a) $out[] = ['name' => (string) ($a['name'] ?? ''), 'role' => (string) ($a['role'] ?? ''), 'clients' => isset($a['clients']) ? (array) $a['clients'] : null];
    return $out;
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
   a one-post item whose single file is an MP4 instead of a picture, marked kind "video". Facebook gets it as a Reel, Instagram as a Reel.
   Same approval, fingerprint and once-only rules as a picture. At most 100 MB and 90 seconds, Instagram's Reel limits through the API.
   2026-11-16 (Matthew: "What if she wants to do a video, how will that work"): the page takes a phone video (mp4, mov or m4v) and the server
   makes it an MP4 both platforms take, checked again after:
   - with an ffmpeg that has an H.264 encoder (libx264): anything that is not H.264 video with AAC sound, or is over 1920 px on its long
     side, is converted to H.264 (CRF 23) + AAC, long side at most 1920, at most 60 frames a second, +faststart;
   - with an ffmpeg that has no H.264 encoder (the host's /usr/local/bin/ffmpeg, checked 16 Nov): the video is re-packed into MP4 without
     re-encoding when it is H.264 or HEVC (what phones record; Facebook and Instagram Reels take either) and at most 1920 px; the sound is
     made AAC when it is not. A video that would need a real conversion (4K, over 60 frames a second, another codec) is refused in plain words.
   Either way the location and other metadata are left out, and nothing is kept of the upload but the result. Which ffmpeg: the path in
   ffmpeg-path.txt beside this file if there is one, else /usr/local/bin/ffmpeg or /usr/bin/ffmpeg (test hooks PC_FFMPEG, PC_FFPROBE,
   PC_X264=0 to act as if there were no H.264 encoder, PC_VIDEO_MAX for the size limit). With no ffprobe at all, the uploader's numbers stand
   and an MP4 is kept as it came (the 5 Nov behaviour). */
define('PC_VIDEO_MAX', (int) (getenv('PC_VIDEO_MAX') ?: 100 * 1024 * 1024));
const PC_VIDEO_SEC = 90.5;          /* a 90-second clip often measures 90.0x */
const PC_VIDEO_EDGE = 1920;         /* Instagram: at most 1920 px across */
function pcIsVideo(array $im): bool { return ($im['kind'] ?? '') === 'video'; }
function pcHasVideo(array $p): bool { foreach ((array) ($p['images'] ?? []) as $im) if (pcIsVideo($im)) return true; return false; }
function pcNull(): string { return PHP_OS_FAMILY === 'Windows' ? 'NUL' : '/dev/null'; }
/** the ffmpeg and ffprobe this server can run, and whether that ffmpeg can make H.264 (asked once, kept in video-tools.json by path and file time) */
function pcVideoTools(): array {
    static $t = null; if ($t !== null) return $t;
    $t = ['ffmpeg' => '', 'ffprobe' => '', 'x264' => false];
    if (!function_exists('shell_exec')) return $t;
    $pick = function (string $env, array $cands): string { $e = getenv($env); foreach ($e !== false && $e !== '' ? [$e] : $cands as $c) if ($c !== '' && @is_file($c)) return $c; return ''; };
    $cfg = trim((string) @file_get_contents(__DIR__ . '/ffmpeg-path.txt'));
    $t['ffmpeg'] = $pick('PC_FFMPEG', [$cfg, '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg']);
    $t['ffprobe'] = $pick('PC_FFPROBE', ['/usr/local/bin/ffprobe', '/usr/bin/ffprobe']);
    if ($t['ffmpeg'] !== '' && getenv('PC_X264') !== '0') {
        $key = $t['ffmpeg'] . '|' . (int) @filemtime($t['ffmpeg']); $c = pcJread('video-tools.json', []);
        if (($c['key'] ?? '') === $key) $t['x264'] = !empty($c['x264']);
        else { $t['x264'] = strpos((string) @shell_exec(escapeshellarg($t['ffmpeg']) . ' -hide_banner -encoders 2>' . pcNull()), ' libx264 ') !== false; pcJwrite('video-tools.json', ['key' => $key, 'x264' => $t['x264']]); }
    }
    return $t;
}
/** what the page needs to know before an upload: whether the server can shrink or convert, and the size limits */
function pcVideoCaps(): array {
    $mb = function (string $v): int { $v = trim($v); $n = (float) $v; $u = strtoupper(substr($v, -1)); return (int) floor($u === 'G' ? $n * 1024 : ($u === 'M' ? $n : ($u === 'K' ? $n / 1024 : $n / 1048576))); };
    $T = pcVideoTools(); $up = min($mb((string) ini_get('upload_max_filesize')) ?: 2, $mb((string) ini_get('post_max_size')) ?: 8);
    return ['convert' => $T['x264'], 'repack' => $T['ffmpeg'] !== '', 'maxMB' => (int) floor(PC_VIDEO_MAX / 1048576), 'maxSec' => 90, 'edge' => PC_VIDEO_EDGE, 'uploadMB' => $up];
}
/** codecs, size as shown (a phone's turned video counted the way it plays), seconds and frame rate, from ffprobe; null when it cannot read it */
function pcVideoInfo(string $path): ?array {
    $T = pcVideoTools(); if ($T['ffprobe'] === '') return null;
    $j = json_decode((string) @shell_exec(escapeshellarg($T['ffprobe']) . ' -v error -show_entries stream=codec_type,codec_name,width,height,pix_fmt,avg_frame_rate:stream_side_data=rotation:format=duration -of json ' . escapeshellarg($path) . ' 2>' . pcNull()), true);
    if (!is_array($j) || !isset($j['streams'])) return null;
    $v = null; $a = null;
    foreach ((array) $j['streams'] as $s) {
        if (($s['codec_type'] ?? '') === 'video' && !$v && !in_array($s['codec_name'] ?? '', ['mjpeg', 'png'], true)) $v = $s;   /* not a cover picture */
        if (($s['codec_type'] ?? '') === 'audio' && !$a) $a = $s;
    }
    if (!$v) return ['video' => false];
    $w = (int) ($v['width'] ?? 0); $h = (int) ($v['height'] ?? 0); $rot = 0;
    foreach ((array) ($v['side_data_list'] ?? []) as $sd) if (isset($sd['rotation'])) $rot = (int) $sd['rotation'];
    if (abs($rot) % 180 === 90) [$w, $h] = [$h, $w];
    $fr = explode('/', (string) ($v['avg_frame_rate'] ?? '0/1')); $fps = (float) ($fr[0] ?? 0) / max(1, (float) ($fr[1] ?? 1));
    return ['video' => true, 'vcodec' => (string) ($v['codec_name'] ?? ''), 'acodec' => $a ? (string) ($a['codec_name'] ?? '') : '', 'w' => $w, 'h' => $h,
            'sec' => (float) ($j['format']['duration'] ?? 0), 'fps' => $fps, 'pix' => (string) ($v['pix_fmt'] ?? '')];
}
function pcDur(float $s): string { $s = (int) round($s); $m = intdiv($s, 60); $r = $s % 60; return $m ? $m . ' min' . ($r ? ' ' . $r . ' s' : '') : $r . ' s'; }
function pcTooLong(float $sec): string { return 'The video is ' . pcDur($sec) . '; Reels from here can be up to 90 seconds. Trim it on your phone and upload again.'; }
function pcTooBig(int $bytes, bool $converted): string { return 'The video is ' . round($bytes / 1048576) . ' MB' . ($converted ? ' after converting' : '') . '; the most is ' . (int) floor(PC_VIDEO_MAX / 1048576) . ' MB. Record it in 1080p, or shorter, and upload again.'; }
/** width, height and seconds: ffprobe's when it can read the file, otherwise what the uploader said (kept for the runner and older callers) */
function pcProbeVideo(string $path, array $said): array {
    $i = pcVideoInfo($path);
    if ($i && !empty($i['video'])) return [$i['w'] ?: null, $i['h'] ?: null, $i['sec'] ?: null];
    $w = (int) ($said['w'] ?? 0); $h = (int) ($said['h'] ?? 0); $sec = (float) ($said['sec'] ?? 0);
    return [$w ?: null, $h ?: null, $sec ?: null];
}
/** make the MP4 that is stored: converted, re-packed, or refused (['error' => plain words]) */
function pcMakeMp4(string $in, array $i): array {
    $T = pcVideoTools(); $long = max($i['w'], $i['h']);
    $encode = $i['vcodec'] !== 'h264' || $long > PC_VIDEO_EDGE || $i['fps'] > 60.5 || ($i['pix'] !== '' && $i['pix'] !== 'yuv420p' && $i['pix'] !== 'yuvj420p');
    if ($encode && !$T['x264']) {
        if ($long > PC_VIDEO_EDGE) return ['error' => 'This video is ' . $i['w'] . ' x ' . $i['h'] . ($long >= 3000 ? ' (4K)' : '') . '. Videos from here can be up to 1920 pixels on the long side: set the phone camera to record 1080p, record it again and upload that.'];
        if ($i['fps'] > 60.5) return ['error' => 'This video is ' . round($i['fps']) . ' frames a second (slow motion?). Videos from here can be up to 60: record it at 30 or 60 and upload that.'];
        if (!in_array($i['vcodec'], ['h264', 'hevc'], true)) return ['error' => 'This video\'s format (' . $i['vcodec'] . ') cannot be posted from here. Use a video recorded with the phone\'s camera (MP4 or MOV).'];
        $encode = false;   /* H.264 in another colour format, or HEVC (10-bit HDR included): both platforms take it as it is */
    }
    $out = pcDir('tmp') . '/v' . bin2hex(random_bytes(8)) . '.mp4';
    $cmd = escapeshellarg($T['ffmpeg']) . ' -nostdin -hide_banner -loglevel error -y -i ' . escapeshellarg($in) . ' -map 0:v:0 -map 0:a:0? -map_metadata -1 -dn -sn';
    if ($encode) $cmd .= ' -c:v libx264 -preset veryfast -crf 23 -profile:v high -pix_fmt yuv420p -fpsmax 60 -threads 4'
        . ' -vf ' . escapeshellarg('scale=if(gte(iw\,ih)\,min(' . PC_VIDEO_EDGE . '\,iw)\,-2):if(gte(iw\,ih)\,-2\,min(' . PC_VIDEO_EDGE . '\,ih))');
    else $cmd .= ' -c:v copy' . ($i['vcodec'] === 'hevc' ? ' -tag:v hvc1' : '');
    $cmd .= ($i['acodec'] === 'aac' ? ' -c:a copy' : ' -c:a aac -b:a 128k -ac 2') . ' -movflags +faststart -f mp4 ' . escapeshellarg($out);
    if (PHP_OS_FAMILY !== 'Windows' && is_executable('/usr/bin/timeout')) $cmd = '/usr/bin/timeout 600 ' . $cmd;
    @set_time_limit(900);
    $said = trim((string) @shell_exec($cmd . ' 2>&1'));
    if (!is_file($out) || !@filesize($out)) { @unlink($out); return ['error' => 'The video could not be ' . ($encode ? 'converted' : 'prepared') . ($said !== '' ? ' (' . mb_substr(strtok($said, "\n"), 0, 160) . ')' : '') . '. Use a video recorded with the phone\'s camera (MP4 or MOV).']; }
    return ['path' => $out, 'how' => $encode ? 'converted' : 'repacked'];
}
function pcStoreVideo(string $tmp, string $origName = '', array $said = []): array {
    $sz = (int) @filesize($tmp); if (!$sz) return ['error' => 'The video did not arrive.'];
    $T = pcVideoTools(); $i = pcVideoInfo($tmp); $src = $tmp; $how = '';
    if ($i === null && $T['ffprobe'] !== '') return ['error' => 'This video could not be read. Use a video recorded with the phone\'s camera (MP4 or MOV).'];
    if ($i !== null && empty($i['video'])) return ['error' => 'That file has no video in it.'];
    if ($i !== null) {
        if ($i['sec'] > PC_VIDEO_SEC) return ['error' => pcTooLong($i['sec'])];
        if ($T['ffmpeg'] !== '') { $m = pcMakeMp4($tmp, $i); if (isset($m['error'])) return $m; $src = $m['path']; $how = $m['how']; $i = pcVideoInfo($src) ?: $i; }
        elseif (!in_array($i['vcodec'], ['h264', 'hevc'], true) || max($i['w'], $i['h']) > PC_VIDEO_EDGE) return ['error' => 'This video cannot be posted from here as it is. Record it in 1080p with the phone\'s camera and upload that.'];
        [$w, $h, $sec] = [$i['w'] ?: null, $i['h'] ?: null, $i['sec'] ?: null];
    } else {   /* no ffprobe: the 5 Nov behaviour */
        $head = (string) @file_get_contents($tmp, false, null, 0, 12);
        if (substr($head, 4, 4) !== 'ftyp') return ['error' => 'Use an MP4 video.'];
        [$w, $h, $sec] = pcProbeVideo($tmp, $said);
    }
    $drop = function () use ($src, $tmp) { if ($src !== $tmp) @unlink($src); };
    if ($sec !== null && $sec > PC_VIDEO_SEC) { $drop(); return ['error' => pcTooLong((float) $sec)]; }
    $bytes = (int) @filesize($src);
    if ($bytes > PC_VIDEO_MAX) { $drop(); return ['error' => pcTooBig($bytes, $how === 'converted')]; }
    if (!is_dir(PC_MEDIA_DIR)) @mkdir(PC_MEDIA_DIR, 0755, true);
    $name = bin2hex(random_bytes(12)) . '.mp4'; $dest = PC_MEDIA_DIR . '/' . $name;
    $moved = $src !== $tmp ? (@rename($src, $dest) || (@copy($src, $dest) && @unlink($src))) : (is_uploaded_file($tmp) ? move_uploaded_file($tmp, $dest) : copy($tmp, $dest));
    if (!$moved) { $drop(); return ['error' => 'Could not save the video.']; }
    @chmod($dest, 0644);
    $im = ['file' => $name, 'url' => PC_ORIGIN . '/' . PC_PUBLIC . '/media/' . $name, 'kind' => 'video', 'w' => $w, 'h' => $h, 'sec' => $sec, 'bytes' => $bytes, 'md5' => (string) md5_file($dest), 'name' => pcClean(basename($origName), 80), 'caption' => ''];
    if ($how !== '') $im['prepared'] = $how;
    return $im;
}
/** a picture or a video, told apart by what the file is (an MP4, MOV or M4V has a box name such as "ftyp" at byte 4), not by its name */
function pcStoreMedia(string $tmp, string $origName = '', array $said = []): array {
    $head = (string) @file_get_contents($tmp, false, null, 0, 12);
    return in_array(substr($head, 4, 4), ['ftyp', 'wide', 'moov', 'mdat', 'free', 'skip'], true) ? pcStoreVideo($tmp, $origName, $said) : pcStoreImage($tmp, $origName);
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
function pcClientView(array $c): array { $c['ownToken'] = ($c['conn'] ?? '') === 'own' && pcClientToken((string) $c['id']) !== ''; $c['li'] = pcLiView($c); $c['holds'] = (object) ($c['holds'] ?? []); return $c; }
function pcRequestsOpen(array $S, string $client = ''): array {
    $out = [];
    foreach ($S['posts'] as $p) {
        if ($p['status'] === 'removed' || ($client !== '' && $p['client'] !== $client)) continue;
        $r = pcOpenRequest($p); if (!$r) continue;
        $out[] = ['post' => $p['id'], 'client' => $p['client'], 'clientName' => $S['clients'][$p['client']]['name'] ?? $p['client'], 'request' => $r['id'], 'text' => $r['text'], 'by' => $r['by'], 'at' => $r['at'],
                  'when' => $p['at'] ? pcWall((int) $p['at']) : null, 'type' => $p['type'], 'targets' => $p['targets'], 'fb' => $p['fb'], 'ig' => $p['ig'], 'li' => $p['li'] ?? '', 'li_comment' => $p['li_comment'] ?? '', 'album' => $p['album'],
                  'images' => array_map(fn($i) => ['url' => $i['url'] ?? '', 'caption' => $i['caption'] ?? '', 'w' => $i['w'] ?? null, 'h' => $i['h'] ?? null], (array) $p['images']), 'note' => $p['note'], 'src' => $p['src']];
    }
    return $out;
}

/** the signed-in account behind this request's cookie, read the same way as api/cal.php (for pages beside it, such as linkedin-oauth.php) */
function pcSessionMe(): ?array {
    $ses = pcJread('sessions.json', []); $me = $ses[hash('sha256', (string) ($_COOKIE['postcal'] ?? ''))] ?? null; if (!$me) return null;
    if (isset($me['acct'])) { $a = pcJread('accounts.json', ['codes' => []])['codes'][$me['acct']] ?? null; if (!$a) return null; $me = ['name' => (string) $a['name'], 'role' => (string) $a['role'], 'clients' => $a['clients'] ?? null]; }
    return in_array((string) ($me['role'] ?? ''), PC_ROLES, true) ? $me : null;
}

require __DIR__ . '/linkedin.php';   /* LinkedIn company-page posting and the Facebook/Instagram hold (2026-11-18) */
