<?php
/* J.A.R.V.I.S. chat for apps outside the Traverse field app (2026-11-21, TASKS JV-APPS; Matthew: "I need Jarvis built into the post
 * application, I need it built into the peak application. That way everyone has access to a version of Jarvis they can use to make changes
 * that they need"). The same chat the Sixfold field app has (help.log in rounds.php), made app-neutral: the Peak Sponsor Desk and the post
 * calendar each load this file and keep their own chat in their own data folder:
 *     Peak desk        peak-desk-data/jarvis/        (help.log, help-files/<ticket>/, rate.json)
 *     post calendar    post-calendar-data/jarvis/
 * One source (shared/jv-chat/jv-lib.php in the repo); each app gets an identical copy beside its API, and the server tool
 * jv-tools/jv.php (shared/jv-chat/jv.php) loads the app's own copy, so the page and the watcher's tool always run the same code.
 *
 * help.log rows (one JSON per line, append only, never rewritten):
 *   {t:msg, id, from, text, ctx, role, scope?, acct?, photos?, audio?, at}     a person wrote (role/scope/acct: who they were when they wrote;
 *                                                                             acct is the post calendar's account key, never sent out)
 *   {t:reply, id, from:"J.A.R.V.I.S.", text, status, refresh?, files?, at}      the watcher or a session answered
 *   {t:status, id, status, by?, note?, at}                                     working / back to new / closed
 *   {t:transcript, id, n, text, failed?, at}                                   a voice note's text (the watcher made it)
 * status: new (waiting) · working · answered · matthew (waiting on Matthew) · closed. A message makes it new again.
 * Ticket ids: h + YmdHis + 4 hex (the same shape as the field app's, so the watchers' checks are the same).
 * Who sees what: your own chats; an app's admin sees everyone's (jvList's $all). The app decides who is an admin.
 * Nothing in here signs anyone in, sends a push or an email: the app does that around these calls. */
declare(strict_types=1);
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }
const JV_NAME = 'J.A.R.V.I.S.';
const JV_TID = '/^h[0-9]{14}[0-9a-f]{4}$/D';
const JV_TEXT_MAX = 2000;
const JV_REPLY_MAX = 4000;

function jvInit(string $dir, string $app): void { $GLOBALS['JV_CFG'] = ['dir' => rtrim($dir, '/\\'), 'app' => $app]; }
function jvApp(): string { return (string) ($GLOBALS['JV_CFG']['app'] ?? ''); }
function jvDir(string $sub = ''): string {
    $d = (string) ($GLOBALS['JV_CFG']['dir'] ?? ''); if ($d === '') throw new RuntimeException('jvInit first');
    $p = $d . ($sub !== '' ? '/' . $sub : ''); if (!is_dir($p)) @mkdir($p, 0700, true); return $p;
}
function jvLog(): string { return jvDir() . '/help.log'; }
function jvFilesDir(): string { return jvDir('help-files'); }
function jvTz(): DateTimeZone { return new DateTimeZone('America/Denver'); }
function jvNow(): int { $e = in_array(PHP_SAPI, ['cli', 'cli-server'], true) ? (string) getenv('JV_NOW') : ''; return ctype_digit($e) ? (int) $e : time(); }
function jvAppend(array $row): bool { return file_put_contents(jvLog(), json_encode($row + ['at' => jvNow()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX) !== false; }
function jvRows(): array { $o = []; $fh = @fopen(jvLog(), 'r'); if (!$fh) return $o; while (($l = fgets($fh)) !== false) { $r = json_decode($l, true); if (is_array($r)) $o[] = $r; } fclose($fh); return $o; }
function jvPhotoName(string $f): bool { return (bool) preg_match('/^p[0-9]{10}[0-9a-f]{6}\.(jpg|png|webp)$/D', $f); }
function jvAudioName(string $f): bool { return (bool) preg_match('/^a[0-9]{10}[0-9a-f]{6}\.(webm|ogg|m4a|mp3|aac)$/D', $f); }
function jvPdfName(string $f): bool { return (bool) preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}\.pdf$/D', $f) && strpos($f, '..') === false; }
function jvAudioMimes(): array { return ['webm' => 'audio/webm', 'ogg' => 'audio/ogg', 'm4a' => 'audio/mp4', 'mp3' => 'audio/mpeg', 'aac' => 'audio/aac']; }
/* the kind of a voice note, from its own first bytes (never the browser's word) */
function jvAudioSniff(string $b): string {
    if (strlen($b) < 12) return '';
    if (strncmp($b, "\x1A\x45\xDF\xA3", 4) === 0) return 'webm';
    if (strncmp($b, 'OggS', 4) === 0) return 'ogg';
    if (substr($b, 4, 4) === 'ftyp') return 'm4a';
    if (strncmp($b, 'ID3', 3) === 0) return 'mp3';
    $w = unpack('n', substr($b, 0, 2))[1];
    if (($w & 0xFFF6) === 0xFFF0) return 'aac';
    if (($w & 0xFFE0) === 0xFFE0 && ($w & 0x0006) !== 0) return 'mp3';
    return '';
}

/** every conversation, keyed by id, with its messages in order (internal fields kept: the app's own checks need role/scope/acct) */
function jvAll(): array {
    $T = [];
    foreach (jvRows() as $r) {
        $id = (string) ($r['id'] ?? ''); $k = (string) ($r['t'] ?? ''); if (!preg_match(JV_TID, $id)) continue;
        if ($k === 'transcript') {
            if (!isset($T[$id])) continue;
            foreach ($T[$id]['msgs'] as $i => $m) foreach (($m['audio'] ?? []) as $j => $a) if ((string) ($a['n'] ?? '') === (string) ($r['n'] ?? '-')) {
                $T[$id]['msgs'][$i]['audio'][$j]['text'] = (string) ($r['text'] ?? '');
                if (!empty($r['failed'])) $T[$id]['msgs'][$i]['audio'][$j]['failed'] = true; else unset($T[$id]['msgs'][$i]['audio'][$j]['failed']);
            }
            continue;
        }
        if (!isset($T[$id])) { if ($k !== 'msg') continue; $T[$id] = ['id' => $id, 'by' => (string) ($r['from'] ?? ''), 'role' => (string) ($r['role'] ?? ''), 'at' => (int) ($r['at'] ?? 0), 'status' => 'new', 'msgs' => [], 'ctx' => $r['ctx'] ?? null, 'updated' => 0]; }
        $t = &$T[$id];
        if ($k === 'msg') {
            $t['msgs'][] = ['from' => (string) ($r['from'] ?? ''), 'text' => (string) ($r['text'] ?? ''), 'at' => (int) ($r['at'] ?? 0), 'who' => 'person',
                'photos' => array_values(array_filter((array) ($r['photos'] ?? []), 'is_array')), 'audio' => array_values(array_filter((array) ($r['audio'] ?? []), 'is_array')),
                'role' => (string) ($r['role'] ?? '')] + (isset($r['scope']) ? ['scope' => $r['scope']] : []) + (isset($r['acct']) ? ['acct' => (string) $r['acct']] : []);
            $t['status'] = 'new';
        } elseif ($k === 'reply') {
            $t['msgs'][] = ['from' => JV_NAME, 'text' => (string) ($r['text'] ?? ''), 'at' => (int) ($r['at'] ?? 0), 'who' => 'jarvis', 'refresh' => !empty($r['refresh']), 'files' => array_values(array_filter((array) ($r['files'] ?? []), 'is_array'))];
            $t['status'] = (string) ($r['status'] ?? 'answered');
        } elseif ($k === 'status') $t['status'] = (string) ($r['status'] ?? $t['status']);
        $t['updated'] = (int) ($r['at'] ?? 0); unset($t);
    }
    return $T;
}
/** who may see a conversation: its writer, or an admin of the app */
function jvMay(array $t, string $me, bool $all): bool { return $all || strcasecmp((string) $t['by'], $me) === 0; }
/** one conversation as the page gets it: nothing internal (role, scope, acct); "mine" = written by the person looking */
function jvView(array $t, string $me): array {
    $msgs = array_map(function ($m) use ($me) {
        $o = ['from' => $m['from'], 'text' => $m['text'], 'at' => $m['at'], 'mine' => $m['who'] === 'person' && strcasecmp($m['from'], $me) === 0, 'jarvis' => $m['who'] === 'jarvis'];
        if ($m['who'] === 'jarvis') { $o['refresh'] = $m['refresh']; $o['files'] = $m['files']; }
        else { $o['photos'] = array_map(fn($p) => ['n' => (string) ($p['n'] ?? ''), 'w' => (int) ($p['w'] ?? 0), 'h' => (int) ($p['h'] ?? 0)], $m['photos']);
            $o['audio'] = array_map(fn($a) => ['n' => (string) ($a['n'] ?? ''), 'secs' => (int) ($a['secs'] ?? 0)] + (isset($a['text']) ? ['text' => (string) $a['text']] : []) + (!empty($a['failed']) ? ['failed' => true] : []), $m['audio']); }
        return $o;
    }, $t['msgs']);
    return ['id' => $t['id'], 'by' => $t['by'], 'status' => $t['status'], 'at' => $t['at'], 'updated' => $t['updated'], 'msgs' => $msgs];
}
/** the person's conversations (an admin: everyone's), newest first, at most 40 */
function jvList(string $me, bool $all): array {
    $L = array_values(array_filter(jvAll(), fn($t) => jvMay($t, $me, $all))); usort($L, fn($a, $b) => $b['updated'] <=> $a['updated']);
    return array_map(fn($t) => jvView($t, $me), array_slice($L, 0, 40));
}
/** at most $n messages an hour per person (a rate file in the chat's folder) */
function jvThrottle(string $me, int $n = 30): bool {
    $f = jvDir() . '/rate.json'; $lk = fopen($f . '.lock', 'c'); if (!$lk) return true; flock($lk, LOCK_EX);
    try {
        $j = json_decode((string) @file_get_contents($f), true); $j = is_array($j) ? $j : []; $now = jvNow(); $k = strtolower($me);
        foreach ($j as $who => $ts) { $j[$who] = array_values(array_filter((array) $ts, fn($t) => $t > $now - 3600)); if (!$j[$who]) unset($j[$who]); }
        if (count($j[$k] ?? []) >= $n) return false;
        $j[$k][] = $now; file_put_contents($f, json_encode($j)); @chmod($f, 0600); return true;
    } finally { flock($lk, LOCK_UN); fclose($lk); }
}
/** a message from the page: {text, id?, ctx?, photos?: [base64], audio?: {data, mime, secs}}. $who = [role, scope?, acct?] for the record.
    Returns ['ok' => true, 'ticket' => view, 'new' => bool] or ['error' => text, 'code' => http status]. */
function jvSend(string $me, bool $all, array $body, array $who = []): array {
    $text = trim((string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', str_replace("\r\n", "\n", (string) ($body['text'] ?? ''))));
    $raw = array_values(array_filter((array) ($body['photos'] ?? []), 'is_string'));
    if (count($raw) > 4) return ['error' => 'Up to 4 photos a message.', 'code' => 400];
    $bins = [];
    foreach ($raw as $b64) {
        $bin = base64_decode($b64, true); if ($bin === false || $bin === '') return ['error' => 'A photo did not come through. Try again.', 'code' => 400];
        if (strlen($bin) > 6 * 1024 * 1024) return ['error' => 'A photo is over 6 MB.', 'code' => 400];
        $gi = @getimagesizefromstring($bin); $ext = $gi ? ([IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$gi[2]] ?? '') : '';
        if ($ext === '' || $gi[0] < 1 || $gi[1] < 1) return ['error' => 'That photo could not be read. Try a JPEG or PNG.', 'code' => 400];
        $bins[] = [$bin, $ext, (int) $gi[0], (int) $gi[1]];
    }
    $voice = null;
    if (is_array($body['audio'] ?? null) && ($body['audio']['data'] ?? '') !== '') {
        $a = $body['audio']; $bin = base64_decode((string) $a['data'], true);
        if ($bin === false || strlen($bin) < 200) return ['error' => 'The voice note did not come through. Try again.', 'code' => 400];
        if (strlen($bin) > 6 * 1024 * 1024) return ['error' => 'That voice note is over 6 MB. Keep it under 2 minutes.', 'code' => 400];
        $cm = strtolower(trim(explode(';', (string) ($a['mime'] ?? ''))[0]));
        if ($cm !== '' && !in_array($cm, ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/x-m4a', 'audio/aac'], true)) return ['error' => 'That kind of recording can’t be sent. Type it instead.', 'code' => 400];
        $ext = jvAudioSniff($bin); if ($ext === '') return ['error' => 'That voice note could not be read. Try recording it again.', 'code' => 400];
        $voice = [$bin, $ext, max(1, min(120, (int) round((float) ($a['secs'] ?? 0))))];
    }
    if (mb_strlen($text) < 2 && !$bins && !$voice) return ['error' => 'Write what you need.', 'code' => 400];
    $text = mb_substr($text, 0, JV_TEXT_MAX);
    $T = jvAll(); $id = (string) ($body['id'] ?? ''); $isNew = $id === '';
    if (!$isNew && (!preg_match(JV_TID, $id) || !isset($T[$id]) || !jvMay($T[$id], $me, $all))) return ['error' => 'No such conversation.', 'code' => 404];
    if (!jvThrottle($me)) return ['error' => 'That is a lot of messages in an hour. Give it a few minutes.', 'code' => 429];
    if ($isNew) do { $id = 'h' . (new DateTime('@' . jvNow()))->setTimezone(jvTz())->format('YmdHis') . bin2hex(random_bytes(2)); } while (isset($T[$id]));
    $c = is_array($body['ctx'] ?? null) ? $body['ctx'] : []; $ctx = [];
    foreach (['screen' => 60, 'card' => 60, 'post' => 40, 'client' => 40, 'name' => 100] as $k => $max) if (isset($c[$k]) && is_string($c[$k]) && $c[$k] !== '') $ctx[$k] = mb_substr($c[$k], 0, $max);
    $d = jvFilesDir() . '/' . $id; $photos = []; $audio = [];
    if (($bins || $voice) && !is_dir($d) && !@mkdir($d, 0700, true)) return ['error' => 'Could not save that. Try again.', 'code' => 500];
    foreach ($bins as [$bin, $ext, $pw, $ph]) {
        $n = 'p' . jvNow() . bin2hex(random_bytes(3)) . '.' . $ext;
        if (@file_put_contents($d . '/' . $n, $bin, LOCK_EX) === false) return ['error' => 'Could not save the photo. Try again.', 'code' => 500];
        @chmod($d . '/' . $n, 0600); $photos[] = ['n' => $n, 'w' => $pw, 'h' => $ph, 'size' => strlen($bin)];
    }
    if ($voice) {
        [$bin, $ext, $secs] = $voice; $n = 'a' . jvNow() . bin2hex(random_bytes(3)) . '.' . $ext;
        if (@file_put_contents($d . '/' . $n, $bin, LOCK_EX) === false) return ['error' => 'Could not save the voice note. Try again.', 'code' => 500];
        @chmod($d . '/' . $n, 0600); $audio[] = ['n' => $n, 'size' => strlen($bin), 'mime' => jvAudioMimes()[$ext], 'secs' => $secs];
    }
    $row = ['t' => 'msg', 'id' => $id, 'from' => $me, 'text' => $text, 'ctx' => $ctx ?: null, 'role' => (string) ($who['role'] ?? '')];
    if (array_key_exists('scope', $who)) $row['scope'] = $who['scope'];
    if (!empty($who['acct'])) $row['acct'] = (string) $who['acct'];
    if (!jvAppend($row + ($photos ? ['photos' => $photos] : []) + ($audio ? ['audio' => $audio] : []))) return ['error' => 'Could not save that. Try again.', 'code' => 500];
    @chmod(jvLog(), 0600);
    return ['ok' => true, 'new' => $isNew, 'ticket' => jvView(jvAll()[$id], $me)];
}
function jvClose(string $me, bool $all, string $id): array {
    $T = jvAll(); if (!preg_match(JV_TID, $id) || !isset($T[$id]) || !jvMay($T[$id], $me, $all)) return ['error' => 'No such conversation.', 'code' => 404];
    jvAppend(['t' => 'status', 'id' => $id, 'status' => 'closed', 'by' => $me]); return ['ok' => true];
}
/** a photo, voice note or PDF of a conversation the person may see; sends it and exits, or returns the error */
function jvServeFile(string $me, bool $all, string $id, string $f): array {
    $T = jvAll(); if (!preg_match(JV_TID, $id) || !isset($T[$id]) || !jvMay($T[$id], $me, $all)) return ['error' => 'No such conversation.', 'code' => 404];
    $pic = jvPhotoName($f); $aud = !$pic && jvAudioName($f); if (!$pic && !$aud && !jvPdfName($f)) return ['error' => 'No such file.', 'code' => 404];
    $p = jvFilesDir() . '/' . $id . '/' . $f; if (!is_file($p)) return ['error' => 'That file is missing.', 'code' => 404];
    header_remove('Content-Type'); header('Cache-Control: private, no-store'); header('X-Content-Type-Options: nosniff');
    if ($aud) {   /* the audio player asks for byte ranges (an iPhone plays nothing without them) */
        $size = (int) filesize($p); $from = 0; $to = $size - 1;
        header('Content-Type: ' . jvAudioMimes()[pathinfo($f, PATHINFO_EXTENSION)]); header('Content-Disposition: inline; filename="' . $f . '"'); header('Accept-Ranges: bytes');
        if (preg_match('/^bytes=(\d*)-(\d*)$/D', trim((string) ($_SERVER['HTTP_RANGE'] ?? '')), $rg) && ($rg[1] !== '' || $rg[2] !== '')) {
            if ($rg[1] === '') $from = max(0, $size - (int) $rg[2]); else { $from = (int) $rg[1]; if ($rg[2] !== '') $to = min($to, (int) $rg[2]); }
            if ($from > $to || $from >= $size) { http_response_code(416); header('Content-Range: bytes */' . $size); exit; }
            http_response_code(206); header('Content-Range: bytes ' . $from . '-' . $to . '/' . $size);
        }
        header('Content-Length: ' . ($to - $from + 1));
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') { $fh = fopen($p, 'rb'); fseek($fh, $from); echo fread($fh, max(1, $to - $from + 1)); fclose($fh); }
        exit;
    }
    header('Content-Type: ' . ($pic ? ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][pathinfo($f, PATHINFO_EXTENSION)] : 'application/pdf'));
    header('Content-Disposition: inline; filename="' . $f . '"'); header('Content-Length: ' . filesize($p)); readfile($p); exit;
}

/* ---- the watcher's side (jv-tools/jv.php over SSH) ---- */
/** the oldest waiting conversation as JSON for the watcher, marked "working" (not with $peek); one left working 90 minutes goes back to new */
function jvNext(bool $peek): ?array {
    $lk = fopen(jvLog() . '.lock', 'c'); flock($lk, LOCK_EX);
    try {
        $now = jvNow();
        foreach (jvAll() as $t) if ($t['status'] === 'working' && $now - (int) $t['updated'] > 90 * 60) jvAppend(['t' => 'status', 'id' => $t['id'], 'status' => 'new', 'note' => 'back to new: no reply in 90 minutes']);
        $new = array_values(array_filter(jvAll(), fn($t) => $t['status'] === 'new')); usort($new, fn($a, $b) => $a['updated'] <=> $b['updated']);
        if (!$new) return null;
        $t = $new[0]; if (!$peek) jvAppend(['t' => 'status', 'id' => $t['id'], 'status' => 'working']);
    } finally { flock($lk, LOCK_UN); fclose($lk); }
    $tz = jvTz(); $dir = jvFilesDir() . '/' . $t['id'];
    $conv = array_map(fn($m) => ['from' => $m['from'], 'when' => (new DateTime('@' . $m['at']))->setTimezone($tz)->format('D j M g:i a'), 'text' => $m['text']]
        + (!empty($m['photos']) ? ['photos' => array_column($m['photos'], 'n')] : [])
        + (!empty($m['audio']) ? ['audio' => array_map(fn($a) => ['n' => (string) ($a['n'] ?? ''), 'secs' => (int) ($a['secs'] ?? 0)] + (isset($a['text']) ? ['text' => (string) $a['text']] : []) + (!empty($a['failed']) ? ['failed' => true] : []), $m['audio'])] : [])
        + (!empty($m['files']) ? ['files' => array_column($m['files'], 'n')] : []), $t['msgs']);
    return ['id' => $t['id'], 'app' => jvApp(), 'by' => $t['by'], 'role' => $t['role'], 'ctx' => $t['ctx'], 'waiting' => count($new), 'conversation' => $conv, 'photoDir' => $dir, 'audioDir' => $dir];
}
function jvCount(): int { return count(array_filter(jvAll(), fn($t) => $t['status'] === 'new')); }
/** a reply: status answered|matthew|working; files: PDFs jvAttach stored for this ticket. Returns the writer's name, or an error. */
function jvReply(string $id, string $status, string $text, bool $refresh, array $files): array {
    if (!in_array($status, ['answered', 'matthew', 'working'], true)) return ['error' => 'status: answered, matthew or working'];
    $T = jvAll(); if (!preg_match(JV_TID, $id) || !isset($T[$id])) return ['error' => 'no such ticket'];
    $text = trim($text); if ($text === '') return ['error' => 'empty reply'];
    $fl = [];
    foreach ($files as $n) { $p = jvFilesDir() . '/' . $id . '/' . $n; if (!jvPdfName($n) || !is_file($p)) return ['error' => "no stored file $n for this ticket: attach it first"]; $fl[] = ['n' => $n, 'size' => filesize($p)]; }
    jvAppend(['t' => 'reply', 'id' => $id, 'from' => JV_NAME, 'text' => mb_substr($text, 0, JV_REPLY_MAX), 'status' => $status] + ($refresh ? ['refresh' => true] : []) + ($fl ? ['files' => $fl] : []));
    return ['ok' => true, 'who' => $T[$id]['by'], 'short' => mb_substr((string) preg_replace('/\s+/', ' ', $text), 0, 140)];
}
function jvTranscript(string $id, string $n, string $text, bool $failed): array {
    $T = jvAll(); if (!preg_match(JV_TID, $id) || !isset($T[$id])) return ['error' => 'no such ticket'];
    $has = false; foreach ($T[$id]['msgs'] as $m) foreach (($m['audio'] ?? []) as $a) if ((string) ($a['n'] ?? '') === $n) $has = true;
    if (!jvAudioName($n) || !$has) return ['error' => "no voice note $n in this ticket"];
    $text = trim((string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', str_replace("\r\n", "\n", $text)));
    if ($text === '' && !$failed) return ['error' => 'empty transcript (use --failed if it could not be made)'];
    jvAppend(['t' => 'transcript', 'id' => $id, 'n' => $n, 'text' => mb_substr($text, 0, 4000)] + ($failed ? ['failed' => true] : []));
    return ['ok' => true];
}
function jvAttach(string $id, string $name, string $pdf): array {
    if (!preg_match(JV_TID, $id) || !isset(jvAll()[$id])) return ['error' => 'no such ticket'];
    if (!jvPdfName($name)) return ['error' => 'name: letters, digits, dot, dash or underscore, ending .pdf, up to 84 characters'];
    if (strncmp($pdf, '%PDF-', 5) !== 0) return ['error' => 'that is not a PDF'];
    if (strlen($pdf) > 20 * 1024 * 1024) return ['error' => 'over 20 MB'];
    $d = jvFilesDir() . '/' . $id; if (!is_dir($d) && !@mkdir($d, 0700, true)) return ['error' => 'could not make the folder'];
    $t = $d . '/.' . $name . '.tmp'; if (file_put_contents($t, $pdf) !== strlen($pdf)) { @unlink($t); return ['error' => 'could not save it']; }
    chmod($t, 0600); rename($t, $d . '/' . $name);
    return ['ok' => true, 'name' => $name, 'size' => strlen($pdf)];
}
/** a final reply (answered or matthew) since unix time $since (5 s of slack) */
function jvFinalSince(string $id, int $since): bool {
    foreach (jvRows() as $r) if (($r['t'] ?? '') === 'reply' && ($r['id'] ?? '') === $id && in_array($r['status'] ?? '', ['answered', 'matthew'], true) && (int) ($r['at'] ?? 0) >= $since - 5) return true;
    return false;
}
/** the conversation being worked on and its writer as recorded: [ticket, last person message] or null (not working, or none) */
function jvWorking(string $id): ?array {
    $T = jvAll(); if (!preg_match(JV_TID, $id) || !isset($T[$id]) || $T[$id]['status'] !== 'working') return null;
    $last = null; foreach ($T[$id]['msgs'] as $m) if ($m['who'] === 'person') $last = $m;
    return $last ? [$T[$id], $last] : null;
}

