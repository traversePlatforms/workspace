<?php
/* J.A.R.V.I.S. desk (2026-11-19, Matthew: "go ahead with moving the desk chats off sixfold app completely. Jarvis for me needs to be in stand
   alone thing entirely. So we need to make sure that it doesnt have any connect with sixfold. Jens still can obviously.")
   His desk chats live here, in the Assistant's own private data, and nowhere in the Sixfold app:
     data/jarvis/desk/desk.log        append-only, one JSON row a line:
                                      {t:msg, id, from, text, ctx, at, photos?, audio?} | {t:reply, id, from, text, status, at, refresh?, files?}
                                      | {t:status, id, status, at, note?} | {t:transcript, id, n, text, failed?, at}
     data/jarvis/desk/state.json      each thread's status, times and message count, rewritten after every row (quick looks)
     data/jarvis/desk/files/<id>/     the photos, voice notes and PDFs of that thread (0700 folders, 0600 files), served only to his session
     data/jarvis/desk/laptop-key.json the SHA-256 of the laptop's key (the key itself is only in the laptop's ~/.ssh)
   Status: new (waiting for the laptop) · working · answered · matthew (needs him at the computer) · closed.
   The laptop (traverse/ops/help-watch.sh) takes the next new thread over SSH (jvdesk.php next), runs the same session as before and answers
   with assistant/jarvis/tools/jarvis-reply.sh (HTTPS with the laptop key, or SSH). A reply pushes to his phones (lib/jarvis.php jvPush).
   Same limits as the Field app's chat: up to 4 photos (6 MB each, really JPEG, PNG or WebP), one voice note (6 MB, 2 minutes), 2,000
   characters, 60 messages an hour. */
declare(strict_types=1);

const JD_ME = 'Matthew Sharpe';
function jdDir(): string { $d = aDataDir() . '/jarvis/desk'; if (!is_dir($d)) @mkdir($d, 0700, true); return $d; }
function jdLogFile(): string { return jdDir() . '/desk.log'; }
function jdFilesDir(string $id): string { return jdDir() . '/files/' . $id; }
function jdIdOk(string $id): bool { return (bool) preg_match('/^h[0-9]{14}[0-9a-f]{4}$/D', $id); }
function jdPhotoName(string $f): bool { return (bool) preg_match('/^p[0-9]{10}[0-9a-f]{6}\.(jpg|png|webp)$/D', $f); }
function jdAudioName(string $f): bool { return (bool) preg_match('/^a[0-9]{10}[0-9a-f]{6}\.(webm|ogg|m4a|mp3|aac)$/D', $f); }
function jdPdfName(string $f): bool { return (bool) preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}\.pdf$/D', $f) && strpos($f, '..') === false; }
function jdAudioMimes(): array { return ['webm' => 'audio/webm', 'ogg' => 'audio/ogg', 'm4a' => 'audio/mp4', 'mp3' => 'audio/mpeg', 'aac' => 'audio/aac']; }
/** the kind of a recording from its own first bytes, never from what the browser said */
function jdAudioSniff(string $b): string {
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
function jdTz(): DateTimeZone { return new DateTimeZone('America/Denver'); }
function jdNewId(): string { return 'h' . (new DateTime('now', jdTz()))->format('YmdHis') . bin2hex(random_bytes(2)); }

/** every row, in order */
function jdRows(): array {
    $f = jdLogFile(); if (!is_file($f)) return [];
    $out = [];
    foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $l) { $r = json_decode($l, true); if (is_array($r)) $out[] = $r; }
    return $out;
}
/** the threads, built from the rows (the same way the Field app reads its help.log) */
function jdAll(): array {
    $T = [];
    foreach (jdRows() as $r) {
        $id = (string) ($r['id'] ?? ''); if (!jdIdOk($id)) continue;
        $t0 = (string) ($r['t'] ?? '');
        if ($t0 === 'transcript') {
            if (!isset($T[$id])) continue;
            foreach ($T[$id]['msgs'] as $i => $m) foreach (($m['audio'] ?? []) as $k => $a) if ((string) ($a['n'] ?? '') === (string) ($r['n'] ?? '-')) {
                $T[$id]['msgs'][$i]['audio'][$k]['text'] = (string) ($r['text'] ?? '');
                if (!empty($r['failed'])) $T[$id]['msgs'][$i]['audio'][$k]['failed'] = true; else unset($T[$id]['msgs'][$i]['audio'][$k]['failed']);
            }
            continue;
        }
        if (!isset($T[$id])) $T[$id] = ['id' => $id, 'by' => (string) ($r['from'] ?? JD_ME), 'at' => (int) ($r['at'] ?? 0), 'status' => 'new', 'msgs' => [], 'ctx' => $r['ctx'] ?? null, 'updated' => 0];
        $t = &$T[$id];
        if (!empty($r['src'])) $t['moved'] = (string) $r['src'];   /* history moved in from the Sixfold app (19 Nov) */
        if ($t0 === 'msg') { $t['msgs'][] = ['from' => (string) ($r['from'] ?? ''), 'text' => (string) ($r['text'] ?? ''), 'at' => (int) ($r['at'] ?? 0), 'mine' => true,
            'photos' => array_values(array_filter((array) ($r['photos'] ?? []), 'is_array')), 'audio' => array_values(array_filter((array) ($r['audio'] ?? []), 'is_array'))]; $t['status'] = 'new'; }
        elseif ($t0 === 'reply') { $t['msgs'][] = ['from' => (string) ($r['from'] ?? 'J.A.R.V.I.S.'), 'text' => (string) ($r['text'] ?? ''), 'at' => (int) ($r['at'] ?? 0), 'mine' => false,
            'refresh' => !empty($r['refresh']), 'files' => array_values(array_filter((array) ($r['files'] ?? []), 'is_array'))]; $t['status'] = (string) ($r['status'] ?? 'answered'); }
        elseif ($t0 === 'status') $t['status'] = (string) ($r['status'] ?? $t['status']);
        $t['updated'] = max((int) $t['updated'], (int) ($r['at'] ?? 0)); unset($t);
    }
    return $T;
}
/** one row on the end of the log, then the per-thread state */
function jdAppend(array $row): bool {
    $f = jdLogFile(); $new = !is_file($f);
    $ok = @file_put_contents($f, json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX) !== false;
    if ($new) @chmod($f, 0600);
    if ($ok) jdStateWrite();
    return $ok;
}
function jdStateWrite(): void {
    $s = []; foreach (jdAll() as $id => $t) $s[$id] = ['status' => $t['status'], 'at' => $t['at'], 'updated' => $t['updated'], 'n' => count($t['msgs'])];
    $f = jdDir() . '/state.json'; $tmp = $f . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (@file_put_contents($tmp, json_encode($s, JSON_UNESCAPED_SLASHES), LOCK_EX) !== false) { @chmod($tmp, 0600); @rename($tmp, $f); }
}
function jdLock() { $lk = fopen(jdDir() . '/desk.lock', 'c'); flock($lk, LOCK_EX); return $lk; }
function jdUnlock($lk): void { flock($lk, LOCK_UN); fclose($lk); }
/** the page's list: newest first, the last 40 */
function jdList(): array {
    $l = array_values(jdAll()); usort($l, fn($a, $b) => $b['updated'] <=> $a['updated']);
    return array_slice($l, 0, 40);
}
function jdPending(): int { return count(array_filter(jdAll(), fn($t) => $t['status'] === 'new')); }
function jdClean(string $s, int $n): string { return mb_substr(trim((string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', str_replace("\r\n", "\n", $s))), 0, $n); }

/** Matthew's message (the page), a new thread or more in one: ['ok'=>true,'thread'=>...] or ['ok'=>false,'error'=>...] */
function jdSend(array $b): array {
    $text = jdClean((string) ($b['text'] ?? ''), 4000);
    $raw = array_values(array_filter((array) ($b['photos'] ?? []), 'is_string'));
    if (count($raw) > 4) return ['ok' => false, 'error' => 'Up to 4 photos a message.'];
    $bins = [];
    foreach ($raw as $b64) {
        $bin = base64_decode($b64, true); if ($bin === false || $bin === '') return ['ok' => false, 'error' => 'A photo did not come through. Try again.'];
        if (strlen($bin) > 6 * 1024 * 1024) return ['ok' => false, 'error' => 'A photo is over 6 MB.'];
        $gi = @getimagesizefromstring($bin); $ext = $gi ? ([IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$gi[2]] ?? '') : '';
        if ($ext === '' || $gi[0] < 1 || $gi[1] < 1) return ['ok' => false, 'error' => 'That photo could not be read. Try a JPEG or PNG.'];
        $bins[] = [$bin, $ext, (int) $gi[0], (int) $gi[1]];
    }
    $voice = null;
    if (is_array($b['audio'] ?? null) && ($b['audio']['data'] ?? '') !== '') {
        $a = $b['audio']; $bin = base64_decode((string) $a['data'], true);
        if ($bin === false || strlen($bin) < 200) return ['ok' => false, 'error' => 'The voice note did not come through. Try again.'];
        if (strlen($bin) > 6 * 1024 * 1024) return ['ok' => false, 'error' => 'That voice note is over 6 MB. Keep it under 2 minutes.'];
        $ext = jdAudioSniff($bin); if ($ext === '') return ['ok' => false, 'error' => 'That voice note could not be read. Try recording it again.'];
        $voice = [$bin, $ext, max(1, min(120, (int) round((float) ($a['secs'] ?? 0))))];
    }
    if (mb_strlen($text) < 2 && !$bins && !$voice) return ['ok' => false, 'error' => 'Write what you need first.'];
    $hour = 0; foreach (jdRows() as $r) if (($r['t'] ?? '') === 'msg' && (int) ($r['at'] ?? 0) > time() - 3600) $hour++;
    if ($hour >= 60) return ['ok' => false, 'error' => 'That is a lot of desk messages in an hour. Give it a few minutes.'];
    $id = (string) ($b['id'] ?? '');
    $lk = jdLock();
    try {
        if ($id !== '') { if (!jdIdOk($id) || !isset(jdAll()[$id])) return ['ok' => false, 'error' => 'No such desk chat.']; }
        else $id = jdNewId();
        $c = is_array($b['ctx'] ?? null) ? $b['ctx'] : []; $ctx = [];
        foreach (['screen' => 40, 'name' => 80] as $k => $max) if (isset($c[$k]) && is_string($c[$k]) && $c[$k] !== '') $ctx[$k] = mb_substr($c[$k], 0, $max);
        $photos = []; $audio = [];
        if ($bins || $voice) { $d = jdFilesDir($id); if (!is_dir($d) && !@mkdir($d, 0700, true)) return ['ok' => false, 'error' => 'Could not save the file. Try again.']; }
        foreach ($bins as [$bin, $ext, $pw, $ph]) {
            $n = 'p' . time() . bin2hex(random_bytes(3)) . '.' . $ext;
            if (@file_put_contents(jdFilesDir($id) . '/' . $n, $bin, LOCK_EX) === false) return ['ok' => false, 'error' => 'Could not save the photo. Try again.'];
            @chmod(jdFilesDir($id) . '/' . $n, 0600); $photos[] = ['n' => $n, 'w' => $pw, 'h' => $ph, 'size' => strlen($bin)];
        }
        if ($voice) {
            [$bin, $ext, $secs] = $voice; $n = 'a' . time() . bin2hex(random_bytes(3)) . '.' . $ext;
            if (@file_put_contents(jdFilesDir($id) . '/' . $n, $bin, LOCK_EX) === false) return ['ok' => false, 'error' => 'Could not save the voice note. Try again.'];
            @chmod(jdFilesDir($id) . '/' . $n, 0600); $audio[] = ['n' => $n, 'size' => strlen($bin), 'mime' => jdAudioMimes()[$ext], 'secs' => $secs];
        }
        if (!jdAppend(['t' => 'msg', 'id' => $id, 'from' => JD_ME, 'text' => $text, 'ctx' => $ctx ?: null, 'at' => time()] + ($photos ? ['photos' => $photos] : []) + ($audio ? ['audio' => $audio] : [])))
            return ['ok' => false, 'error' => 'Could not save that. Try again.'];
    } finally { jdUnlock($lk); }
    return ['ok' => true, 'thread' => jdAll()[$id]];
}
function jdClose(string $id): array {
    if (!jdIdOk($id) || !isset(jdAll()[$id])) return ['ok' => false, 'error' => 'No such desk chat.'];
    jdAppend(['t' => 'status', 'id' => $id, 'status' => 'closed', 'at' => time()]);
    return ['ok' => true];
}

/* ---------------------------------------------------------------- the laptop's side */
/** the oldest thread waiting, marked working (not with peek), in the shape help-next.php gives; null when nothing waits.
    A thread left working for 90 minutes (the session died) goes back to new first. */
function jdNext(bool $peek = false): ?array {
    $lk = jdLock();
    try {
        $now = time();
        foreach (jdAll() as $t) if ($t['status'] === 'working' && $now - (int) $t['updated'] > 90 * 60) jdAppend(['t' => 'status', 'id' => $t['id'], 'status' => 'new', 'note' => 'back to new: no reply in 90 minutes', 'at' => $now]);
        $new = array_values(array_filter(jdAll(), fn($t) => $t['status'] === 'new')); usort($new, fn($a, $b) => $a['updated'] <=> $b['updated']);
        if (!$new) return null;
        $t = $new[0];
        if (!$peek) jdAppend(['t' => 'status', 'id' => $t['id'], 'status' => 'working', 'at' => $now]);
    } finally { jdUnlock($lk); }
    $conv = array_map(fn($m) => ['from' => $m['from'], 'when' => (new DateTime('@' . $m['at']))->setTimezone(jdTz())->format('D j M g:i a'), 'text' => $m['text']]
        + (!empty($m['photos']) ? ['photos' => array_column($m['photos'], 'n')] : [])
        + (!empty($m['audio']) ? ['audio' => array_map(fn($a) => ['n' => (string) ($a['n'] ?? ''), 'secs' => (int) ($a['secs'] ?? 0)] + (isset($a['text']) ? ['text' => (string) $a['text']] : []) + (!empty($a['failed']) ? ['failed' => true] : []), $m['audio'])] : [])
        + (!empty($m['files']) ? ['files' => array_column($m['files'], 'n')] : []), $t['msgs']);
    return ['id' => $t['id'], 'by' => $t['by'], 'desk' => 'jarvis', 'ctx' => $t['ctx'], 'waiting' => count($new), 'conversation' => $conv, 'photoDir' => jdFilesDir($t['id']), 'audioDir' => jdFilesDir($t['id'])];
}
/** the laptop's answer; pushes to his phones unless it is a progress note */
function jdReply(string $id, string $status, string $text, bool $refresh = false, array $fileNames = []): array {
    if (!in_array($status, ['answered', 'matthew', 'working'], true)) return ['ok' => false, 'error' => 'status: answered, matthew or working'];
    $T = jdAll(); if (!jdIdOk($id) || !isset($T[$id])) return ['ok' => false, 'error' => 'no such desk chat'];
    $text = mb_substr(trim($text), 0, 8000); if ($text === '') return ['ok' => false, 'error' => 'empty reply'];
    $files = [];
    foreach ($fileNames as $n) { $p = jdFilesDir($id) . '/' . $n; if (!jdPdfName($n) || !is_file($p)) return ['ok' => false, 'error' => "no stored file $n for this chat: attach it first"]; $files[] = ['n' => $n, 'size' => filesize($p)]; }
    if (!jdAppend(['t' => 'reply', 'id' => $id, 'from' => 'J.A.R.V.I.S.', 'text' => $text, 'status' => $status, 'at' => time()] + ($refresh ? ['refresh' => true] : []) + ($files ? ['files' => $files] : [])))
        return ['ok' => false, 'error' => 'could not save the reply'];
    $pushed = false;
    if ($status !== 'working') $pushed = jvPush($status === 'matthew' ? 'J.A.R.V.I.S.: needs you' : 'J.A.R.V.I.S.', mb_substr(preg_replace('/\s+/', ' ', $text), 0, 140), '/a-e018bb82/jarvis/?desk=' . $id, 'jv-desk-' . $id);
    return ['ok' => true, 'pushed' => $pushed];
}
/** a PDF for a reply (the bytes from the laptop); returns the stored name */
function jdAttach(string $id, string $name, string $bin): array {
    if (!jdIdOk($id) || !isset(jdAll()[$id])) return ['ok' => false, 'error' => 'no such desk chat'];
    if (!jdPdfName($name)) return ['ok' => false, 'error' => 'bad file name'];
    if (strncmp($bin, '%PDF', 4) !== 0) return ['ok' => false, 'error' => 'not a PDF'];
    if (strlen($bin) > 20 * 1024 * 1024) return ['ok' => false, 'error' => 'over 20 MB'];
    $d = jdFilesDir($id); if (!is_dir($d)) @mkdir($d, 0700, true);
    if (@file_put_contents($d . '/' . $name, $bin, LOCK_EX) === false) return ['ok' => false, 'error' => 'could not store it'];
    @chmod($d . '/' . $name, 0600);
    return ['ok' => true, 'name' => $name];
}
function jdTranscript(string $id, string $n, string $text, bool $failed): array {
    if (!jdIdOk($id) || !isset(jdAll()[$id]) || !jdAudioName($n)) return ['ok' => false, 'error' => 'no such voice note'];
    jdAppend(['t' => 'transcript', 'id' => $id, 'n' => $n, 'text' => $failed ? '' : mb_substr(trim($text), 0, 8000), 'at' => time()] + ($failed ? ['failed' => true] : []));
    return ['ok' => true];
}
/** a final reply (answered or matthew) to $id written at or after $since (a few seconds' slack for clocks) */
function jdFinalSince(string $id, int $since): bool {
    foreach (jdRows() as $r) if (($r['id'] ?? '') === $id && ($r['t'] ?? '') === 'reply' && in_array($r['status'] ?? '', ['answered', 'matthew'], true) && (int) ($r['at'] ?? 0) >= $since - 5) return true;
    return false;
}
/** his history from the Sixfold app (19 Nov): the rows of his own tickets, read from help.log on the server by the move script and fed in
    here. Each row once (its hash is kept), marked src=sixfold; files come separately. A thread left new or working is set answered, so the
    laptop does not answer it a second time. */
function jdImport(array $rows): array {
    $hf = jdDir() . '/imported.json'; $seen = is_file($hf) ? (json_decode((string) file_get_contents($hf), true) ?: []) : [];
    $added = 0; $ids = [];
    $lk = jdLock();
    try {
        foreach ($rows as $r) {
            if (!is_array($r) || !jdIdOk((string) ($r['id'] ?? '')) || !in_array($r['t'] ?? '', ['msg', 'reply', 'status', 'transcript'], true)) continue;
            $h = sha1(json_encode($r, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)); if (isset($seen[$h])) continue;
            if (jdAppend($r + ['src' => 'sixfold'])) { $seen[$h] = (int) ($r['at'] ?? 0); $added++; $ids[$r['id']] = true; }
        }
        $T = jdAll();
        foreach (array_keys($ids) as $id) if (isset($T[$id]) && in_array($T[$id]['status'], ['new', 'working'], true)) jdAppend(['t' => 'status', 'id' => $id, 'status' => 'answered', 'note' => 'moved from the Sixfold app', 'at' => time()]);
    } finally { jdUnlock($lk); }
    $tmp = $hf . '.tmp'; file_put_contents($tmp, json_encode($seen)); @chmod($tmp, 0600); rename($tmp, $hf);
    return ['ok' => true, 'added' => $added, 'threads' => count($ids)];
}
/* the laptop's key: only its SHA-256 is kept here (setkey, over SSH); the laptop sends the key in an X-Jarvis-Key header */
function jdKeyOk(string $k): bool {
    $j = jget('jarvis/desk/laptop-key.json'); $h = (string) ($j['sha256'] ?? '');
    return $h !== '' && strlen($k) >= 32 && hash_equals($h, hash('sha256', $k));
}
function jdSetKeyHash(string $hex): bool {
    if (!preg_match('/^[0-9a-f]{64}$/D', $hex)) return false;
    jdDir(); return jput('jarvis/desk/laptop-key.json', ['sha256' => $hex, 'at' => time()]);
}
/** a file of a thread, to his signed-in session only; voice notes with byte ranges (an iPhone will not play one without them) */
function jdServeFile(string $id, string $f, bool $dl = false): void {
    $T = jdAll();
    if (!jdIdOk($id) || !isset($T[$id])) { http_response_code(404); exit; }
    $pic = jdPhotoName($f); $aud = !$pic && jdAudioName($f); if (!$pic && !$aud && !jdPdfName($f)) { http_response_code(404); exit; }
    $p = jdFilesDir($id) . '/' . $f; if (!is_file($p)) { http_response_code(404); exit; }
    header('Cache-Control: private, no-store'); header('X-Content-Type-Options: nosniff');
    if ($aud) {
        $size = (int) filesize($p); $from = 0; $to = $size - 1;
        header('Content-Type: ' . jdAudioMimes()[pathinfo($f, PATHINFO_EXTENSION)]); header('Content-Disposition: inline; filename="' . $f . '"'); header('Accept-Ranges: bytes');
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
    header('Content-Disposition: ' . ($dl ? 'attachment' : 'inline') . '; filename="' . $f . '"');
    header('Content-Length: ' . filesize($p)); readfile($p); exit;
}
