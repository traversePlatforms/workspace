<?php
/* J.A.R.V.I.S.: record a meeting (20 Nov 2026, P-12). Matthew: "can i get jarvis to record audio from meetings like i said hey jarvis record
   this meeting" ... "Its only going to be used in colorado with brandon nneka and everyone i work with ... i will let everyone know before i
   start it that I am going to be recording. It will never be used without everyones acknowledgment".
   The order is fixed: the company (the Meeting notes list), then ONE tap "Everyone here knows this is being recorded" (logged with the
   meeting: when, by whom, which device; no attendee names), and only then does the page start recording. Nothing is kept before that tap.
   Where it lives (all in the Assistant's private data, never in public_html, never in git):
     data/jarvis/meetings/<id>/meta.json        the meeting: company, consent, status, segments, retention (0600)
     data/jarvis/meetings/<id>/sNNN-cNNNNN.part the audio as it arrived, ~30 s pieces (a segment = one recorder run; its pieces joined in
                                                order make one playable file). Deleted as soon as the transcript is saved and read back,
                                                unless he tapped Keep audio: then 30 days, then deleted (the sweep).
     data/jarvis/meetings/<id>/transcript.txt   the raw transcript (one running text, no speaker names), shown only to his session
     data/jarvis/meetings/workers.json          when each transcriber last looked (laptop, cloud)
   The transcriber is assistant/jarvis/tools/meeting-worker.sh, on the laptop (whisper.cpp large-v3-turbo) and on the cloud machine
   (small.en), over SSH with jvmeet.php. The preferred one (the laptop: about three times faster) takes a meeting at once; the other only
   when it has waited 3 minutes or the preferred one has not looked in 3 minutes. The transcript then goes to his desk as [MEETING NOTES]
   (company, date, length, the consent line), the same path as typed meeting notes. Status:
     recording · paused · uploading (a file) · ready (waiting for a transcriber) · transcribing · done · failed · discarded */
declare(strict_types=1);

const MT_COMPANIES = ['Surge', 'Sixfold', 'Traverse', 'Peak', 'Personal', 'Other'];
const MT_CONSENT = 'Everyone here knows this is being recorded';
const MT_CONSENT_FILE = 'Everyone in this recording knew it was being recorded';
const MT_MAX_SECS = 10800;            /* 3 hours of sound; the page stops there */
const MT_CHUNK_MAX = 8388608;         /* one piece, 8 MB */
const MT_LIVE_MAX = 314572800;        /* a live recording, 300 MB (Opus at 32 kbps is about 45 MB for 3 hours; Safari's AAC more) */
const MT_FILE_MAX = 419430400;        /* an uploaded file, 400 MB */
const MT_STALL = 120;                 /* recording, and no piece for 2 minutes: push "Recording paused" */
const MT_IDLE_STOP = 1800;            /* recording, no piece for 30 minutes: stopped by itself and transcribed */
const MT_PAUSE_STOP = 7200;           /* paused for 2 hours: the same */
const MT_KEEP_DAYS = 30;
const MT_HOLD = 600;                  /* a transcriber's claim lapses 10 minutes after its last "still working" */
const MT_LATE = 600;                  /* waiting 10 minutes with no transcriber looking: tell him it is queued */
const MT_TAKE_AFTER = 180;            /* the other transcriber takes it after 3 minutes */

function mtDir(string $id = ''): string { $d = aDataDir() . '/jarvis/meetings' . ($id !== '' ? '/' . $id : ''); if (!is_dir($d)) @mkdir($d, 0700, true); return $d; }
function mtIdOk(string $id): bool { return (bool) preg_match('/^m[0-9]{14}[0-9a-f]{4}$/D', $id); }
function mtNewId(): string { return 'm' . (new DateTime('now', jdTz()))->format('YmdHis') . bin2hex(random_bytes(2)); }
function mtWho(string $w): bool { return in_array($w, ['laptop', 'cloud'], true); }
function mtGet(string $id): ?array {
    if (!mtIdOk($id)) return null; $f = aDataDir() . '/jarvis/meetings/' . $id . '/meta.json';
    if (!is_file($f)) return null; $j = json_decode((string) file_get_contents($f), true); return is_array($j) ? $j : null;
}
function mtPut(array $m): bool {
    $f = mtDir($m['id']) . '/meta.json'; $t = $f . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (@file_put_contents($t, json_encode($m, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) === false) return false;
    @chmod($t, 0600); return @rename($t, $f);
}
/** read-modify-write one meeting under its lock; $fn returns the new meta, or null to leave it */
function mtEdit(string $id, callable $fn): ?array {
    if (!mtIdOk($id) || !is_dir(aDataDir() . '/jarvis/meetings/' . $id)) return null;
    $lk = fopen(mtDir($id) . '/meta.lock', 'c'); flock($lk, LOCK_EX);
    try { $m = mtGet($id); if (!$m) return null; $n = $fn($m); if (is_array($n)) { mtPut($n); return $n; } return $m; }
    finally { flock($lk, LOCK_UN); fclose($lk); }
}
function mtAll(): array {
    $o = []; foreach (glob(mtDir() . '/m*', GLOB_ONLYDIR) ?: [] as $d) { $m = mtGet(basename($d)); if ($m) $o[] = $m; }
    usort($o, fn($a, $b) => ($b['at'] ?? 0) <=> ($a['at'] ?? 0)); return $o;
}
function mtLabel(string $co, string $other): string {
    return $co === 'Other' ? 'Other: ' . $other : ($co === 'Peak' ? 'Peak (Matthew\'s own client work)' : ($co === 'Personal' ? 'Personal (keep out of git)' : $co));
}
function mtWhen(int $t, string $f = 'g:i a'): string { return (new DateTime('@' . $t))->setTimezone(jdTz())->format($f); }
function mtLen(int $s): string { $s = max(0, $s); $h = intdiv($s, 3600); $m = intdiv($s % 3600, 60); return $h ? $h . ' h ' . $m . ' min' : ($m ? $m . ' min' : $s . ' s'); }
function mtParts(string $id): array { $p = glob(mtDir($id) . '/s[0-9][0-9][0-9]-c[0-9][0-9][0-9][0-9][0-9].part') ?: []; sort($p, SORT_STRING); return $p; }
function mtAudioBytes(string $id): int { $n = 0; foreach (mtParts($id) as $p) $n += (int) @filesize($p); return $n; }
function mtDropAudio(string $id): int { $n = 0; foreach (mtParts($id) as $p) if (@unlink($p)) $n++; return $n; }
/** the kind of audio from its own first bytes (the desk's sniff, plus WAV and FLAC for an uploaded file) */
function mtSniff(string $b): string {
    if (strlen($b) >= 12 && strncmp($b, 'RIFF', 4) === 0 && substr($b, 8, 4) === 'WAVE') return 'wav';
    if (strncmp($b, 'fLaC', 4) === 0) return 'flac';
    return jdAudioSniff($b);
}
/** what the page may see of a meeting */
function mtPublic(array $m): array {
    $o = [];
    foreach (['id', 'source', 'company', 'other', 'label', 'status', 'at', 'startedAt', 'stoppedAt', 'lastChunkAt', 'bytes', 'secs', 'keep', 'keepUntil', 'thread', 'error', 'endedBy', 'transcriptAt', 'transcriptChars', 'worker', 'audioDeletedAt', 'device'] as $k) if (array_key_exists($k, $m)) $o[$k] = $m[$k];
    $o['consentAt'] = (int) ($m['consent']['at'] ?? 0);
    $o['segs'] = count((array) ($m['segs'] ?? []));
    $o['nextSeg'] = $m['segs'] ? max(array_map('intval', array_keys((array) $m['segs']))) + 1 : 0;
    $o['audio'] = empty($m['audioDeletedAt']) && in_array($m['status'], ['recording', 'paused', 'uploading', 'ready', 'transcribing', 'failed', 'done'], true) && mtAudioBytes($m['id']) > 0;
    $o['hasText'] = is_file(mtDir($m['id']) . '/transcript.txt');
    return $o;
}
function mtWorkers(): array { $f = mtDir() . '/workers.json'; $j = is_file($f) ? json_decode((string) file_get_contents($f), true) : []; return is_array($j) ? $j : []; }
function mtSeen(string $who): void {
    $f = mtDir() . '/workers.json'; $j = mtWorkers(); $j[$who] = time();
    $t = $f . '.' . bin2hex(random_bytes(4)) . '.tmp'; if (@file_put_contents($t, json_encode($j), LOCK_EX) !== false) { @chmod($t, 0600); @rename($t, $f); }
}
function mtPrefer(): string { $c = jget('jarvis/meetings/config.json'); return mtWho((string) ($c['prefer'] ?? '')) ? (string) $c['prefer'] : 'laptop'; }
/** where the transcription will happen, in words for the page and his phone */
function mtWhere(): array {
    $w = mtWorkers(); $now = time(); $lap = $now - (int) ($w['laptop'] ?? 0) < 240; $cl = $now - (int) ($w['cloud'] ?? 0) < 240;
    if ($lap) return ['where' => 'laptop', 'say' => 'Transcribing on your laptop now.'];
    if ($cl) return ['where' => 'cloud', 'say' => 'Your laptop is away, so the cloud machine is transcribing it.'];
    return ['where' => 'queued', 'say' => 'Saved and queued: your laptop is asleep and the cloud machine is not answering, so the transcript starts when the laptop wakes.'];
}

/* ---------------------------------------------------------------- the page (his session only) */
function mtHttp(string $action, array $body, bool $isPost): never {
    if ($action === 'jvmeetlist') out(['ok' => true, 'meetings' => array_map('mtPublic', array_slice(mtAll(), 0, 30)), 'where' => mtWhere(), 'max' => MT_MAX_SECS]);
    if ($action === 'jvmeettext') {   /* the raw transcript, to his session only */
        $id = (string) ($_GET['id'] ?? ''); $f = mtIdOk($id) ? aDataDir() . '/jarvis/meetings/' . $id . '/transcript.txt' : '';
        if ($f === '' || !is_file($f)) out(['ok' => false, 'error' => 'No transcript for that meeting.'], 404);
        header('Cache-Control: private, no-store'); header('Content-Type: text/plain; charset=utf-8'); header('Content-Disposition: inline; filename="transcript-' . $id . '.txt"');
        readfile($f); exit;
    }
    if (!$isPost) out(['ok' => false], 405);
    if ($action === 'jvmeetstart') out(mtStart($body));
    if ($action === 'jvmeetchunk') { @set_time_limit(120); session_write_close(); out(mtChunk((string) ($_GET['id'] ?? ''), (int) ($_GET['seg'] ?? -1), (int) ($_GET['n'] ?? -1), (string) file_get_contents('php://input'), $_GET)); }
    if ($action === 'jvmeetstate') out(mtState((string) ($body['id'] ?? ''), (string) ($body['op'] ?? ''), $body));
    out(['ok' => false, 'error' => 'No such action.'], 404);
}
/** a new meeting, only with the consent tap; one live recording at a time */
function mtStart(array $b): array {
    $co = (string) ($b['company'] ?? ''); $other = jdClean((string) ($b['other'] ?? ''), 60); $src = ($b['source'] ?? 'live') === 'upload' ? 'upload' : 'live';
    if (!in_array($co, MT_COMPANIES, true)) return ['ok' => false, 'error' => 'Pick the company first.'];
    if ($co === 'Other' && mb_strlen($other) < 2) return ['ok' => false, 'error' => 'Say who or what it is for.'];
    $line = $src === 'upload' ? MT_CONSENT_FILE : MT_CONSENT;
    if (($b['consent'] ?? null) !== true || (string) ($b['consentText'] ?? '') !== $line) return ['ok' => false, 'error' => 'Recording needs the tap first: “' . $line . '”.', 'consent' => false];
    $lk = fopen(mtDir() . '/start.lock', 'c'); flock($lk, LOCK_EX);
    try {
        if ($src === 'live') foreach (mtAll() as $x) if (in_array($x['status'], ['recording', 'paused'], true))
            return ['ok' => false, 'error' => 'A recording is already open (' . $x['label'] . ', started ' . mtWhen((int) $x['startedAt']) . '). Resume or stop it first.', 'active' => mtPublic($x)];
        $id = mtNewId(); $now = time();
        $fn = jdClean((string) ($b['fileName'] ?? ''), 80); $fs = (int) ($b['fileSize'] ?? 0);
        if ($src === 'upload' && ($fs < 200 || $fs > MT_FILE_MAX)) return ['ok' => false, 'error' => $fs > MT_FILE_MAX ? 'That file is over 400 MB.' : 'That file is empty.'];
        $m = ['id' => $id, 'source' => $src, 'company' => $co, 'other' => $co === 'Other' ? $other : '', 'label' => mtLabel($co, $other),
            'consent' => ['line' => $line, 'at' => $now, 'by' => JD_ME, 'device' => jdClean((string) ($b['device'] ?? ''), 40)],
            'status' => $src === 'upload' ? 'uploading' : 'recording', 'at' => $now, 'startedAt' => $now, 'lastChunkAt' => $now, 'segs' => (object) [],
            'bytes' => 0, 'secs' => 0, 'keep' => !empty($b['keep']), 'keepUntil' => 0, 'device' => jdClean((string) ($b['device'] ?? ''), 40), 'attempts' => 0, 'alerts' => (object) []]
            + ($src === 'upload' ? ['file' => ['name' => $fn, 'size' => $fs]] : []);
        mtDir($id); if (!mtPut($m)) return ['ok' => false, 'error' => 'Could not start it here. Try again.'];
    } finally { flock($lk, LOCK_UN); fclose($lk); }
    alog('meeting started', ['id' => $id, 'company' => $co, 'source' => $src, 'consent' => $line]);
    return ['ok' => true, 'meeting' => mtPublic(mtGet($id))];
}
/** one piece of audio. Safe to send twice (same piece, same size: ok). Accepted while recording, paused, uploading, or stopped and not yet
    taken by a transcriber (a late retry). Segment 0 piece 0 of each segment carries the segment's start time and the gap before it. */
function mtChunk(string $id, int $seg, int $n, string $bin, array $q): array {
    $m = mtGet($id); if (!$m) return ['ok' => false, 'error' => 'No such recording.', 'gone' => true];
    if ($seg < 0 || $seg > 499 || $n < 0 || $n > 19999) return ['ok' => false, 'error' => 'Bad piece number.'];
    $len = strlen($bin); if ($len < 1) return ['ok' => false, 'error' => 'That piece was empty.'];
    if ($len > MT_CHUNK_MAX) return ['ok' => false, 'error' => 'That piece is over 8 MB.'];
    $okSt = $m['source'] === 'upload' ? ['uploading'] : ['recording', 'paused', 'ready'];
    if (!in_array($m['status'], $okSt, true)) return ['ok' => false, 'error' => $m['status'] === 'discarded' ? 'That recording was discarded.' : 'That recording is already being transcribed.', 'gone' => true];
    $ext = '';
    if ($n === 0) { $ext = mtSniff($bin); if ($ext === '' || ($m['source'] === 'live' && !in_array($ext, ['webm', 'ogg', 'm4a', 'aac', 'mp3'], true))) return ['ok' => false, 'error' => 'That is not audio J.A.R.V.I.S. can read (try m4a, mp3, wav or webm).', 'bad' => true]; }
    $name = sprintf('s%03d-c%05d.part', $seg, $n); $p = mtDir($id) . '/' . $name;
    if (is_file($p) && filesize($p) === $len) return ['ok' => true, 'dup' => true, 'bytes' => (int) $m['bytes']];
    $cap = $m['source'] === 'upload' ? MT_FILE_MAX + MT_CHUNK_MAX : MT_LIVE_MAX;
    if ((int) $m['bytes'] + $len > $cap) return ['ok' => false, 'error' => 'This recording has reached its size limit.', 'full' => true];
    $tmp = $p . '.' . bin2hex(random_bytes(3)) . '.tmp';
    if (@file_put_contents($tmp, $bin, LOCK_EX) !== $len) { @unlink($tmp); return ['ok' => false, 'error' => 'The server could not save that piece (disk?). It will try again.']; }
    @chmod($tmp, 0600); if (!@rename($tmp, $p)) { @unlink($tmp); return ['ok' => false, 'error' => 'Could not save that piece. It will try again.']; }
    $now = time();
    $m = mtEdit($id, function ($m) use ($seg, $n, $len, $ext, $q, $now) {
        $s = (array) ($m['segs'] ?? []); $k = (string) $seg; $g = (array) ($s[$k] ?? ['n' => 0, 'bytes' => 0]);
        $g['n'] = max((int) $g['n'], $n + 1); $g['bytes'] = (int) $g['bytes'] + $len;
        if ($n === 0) {
            $g['ext'] = $ext;
            $t = (int) ($q['t'] ?? 0); if ($t > $now - 86400 && $t <= $now + 300) $g['t'] = $t;
            $g['gap'] = max(0, min(86400, (int) ($q['gap'] ?? 0)));
            $w = (string) ($q['why'] ?? ''); $g['why'] = in_array($w, ['pause', 'call', 'hidden', 'ended', 'muted', 'error', 'reload', 'rotate'], true) ? $w : '';
        }
        $s[$k] = $g; ksort($s, SORT_NUMERIC); $m['segs'] = $s;
        $m['bytes'] = (int) $m['bytes'] + $len; $m['lastChunkAt'] = $now;
        $sec = (int) ($q['secs'] ?? 0); if ($sec > 0) $m['secs'] = max((int) $m['secs'], min(MT_MAX_SECS + 900, $sec));
        $a = (array) ($m['alerts'] ?? []); if (!empty($a['stall'])) { unset($a['stall']); $m['resumedAfterAlert'] = $now; } $m['alerts'] = (object) $a;
        return $m;
    });
    return ['ok' => true, 'bytes' => (int) ($m['bytes'] ?? 0)];
}
/** pause, resume, stop (also: an upload is complete), keep audio on or off, discard */
function mtState(string $id, string $op, array $b): array {
    $m = mtGet($id); if (!$m) return ['ok' => false, 'error' => 'No such recording.'];
    $now = time(); $err = '';
    if ($op === 'discard') {
        if ($m['status'] === 'transcribing') return ['ok' => false, 'error' => 'It is being transcribed right now. Try again when it is done.'];
        mtEdit($id, function ($m) use ($now) { $m['status'] = 'discarded'; $m['discardedAt'] = $now; $m['audioDeletedAt'] = $now; return $m; });
        mtDropAudio($id); @unlink(mtDir($id) . '/transcript.txt');
        alog('meeting discarded', ['id' => $id]);
        return ['ok' => true, 'meeting' => mtPublic(mtGet($id))];
    }
    if ($op === 'keep') {
        $keep = !empty($b['keep']);
        $m = mtEdit($id, function ($m) use ($keep, $now) {
            $m['keep'] = $keep;
            if ($m['status'] === 'done') $m['keepUntil'] = $keep && empty($m['audioDeletedAt']) ? (int) ($m['transcriptAt'] ?? $now) + MT_KEEP_DAYS * 86400 : 0;
            return $m;
        });
        if (!$keep && $m['status'] === 'done' && empty($m['audioDeletedAt'])) { mtDropAudio($id); $m = mtEdit($id, function ($m) use ($now) { $m['audioDeletedAt'] = $now; return $m; }); }
        return ['ok' => true, 'meeting' => mtPublic($m)];
    }
    $m = mtEdit($id, function ($m) use ($op, $b, $now, &$err) {
        $live = $m['source'] === 'live';
        if ($op === 'pause' && $live && $m['status'] === 'recording') { $m['status'] = 'paused'; $m['pausedAt'] = $now; return $m; }
        if ($op === 'resume' && $live && in_array($m['status'], ['paused', 'recording'], true)) { $m['status'] = 'recording'; $m['lastChunkAt'] = $now; unset($m['pausedAt']); return $m; }
        if ($op === 'stop' && in_array($m['status'], $live ? ['recording', 'paused'] : ['uploading'], true)) {
            $exp = []; foreach ((array) ($b['expect'] ?? []) as $k => $v) if (preg_match('/^\d{1,3}$/', (string) $k)) $exp[(string) (int) $k] = max(0, min(20000, (int) $v));
            $m['expect'] = $exp ?: (object) []; $m['status'] = 'ready'; $m['stoppedAt'] = $now; $m['readyAt'] = $now; $m['endedBy'] = 'you';
            $sec = (int) ($b['secs'] ?? 0); if ($sec > 0) $m['secs'] = max((int) $m['secs'], min(MT_MAX_SECS + 900, $sec));
            if (array_key_exists('keep', $b)) $m['keep'] = !empty($b['keep']);
            return $m;
        }
        if (in_array($op, ['pause', 'resume', 'stop'], true)) { $err = $m['status'] === 'discarded' ? 'That recording was discarded.' : 'It is already ' . $m['status'] . '.'; return null; }
        $err = 'Unknown step.'; return null;
    });
    if ($err !== '') return ['ok' => false, 'error' => $err, 'meeting' => mtPublic($m)];
    if ($op === 'stop') { alog('meeting stopped', ['id' => $id, 'bytes' => (int) $m['bytes'], 'secs' => (int) $m['secs']]); $w = mtWhere(); return ['ok' => true, 'meeting' => mtPublic($m), 'where' => $w]; }
    return ['ok' => true, 'meeting' => mtPublic($m)];
}

/* ---------------------------------------------------------------- the transcribers (jvmeet.php, over SSH) */
/** may $who take this ready meeting now? the preferred one at once; the other after MT_TAKE_AFTER, or when the preferred one is away */
function mtMayTake(array $m, string $who, array $w, int $now): bool {
    if ($m['status'] !== 'ready') return false;
    $pref = mtPrefer(); if ($who === $pref) return true;
    return $now - (int) ($m['readyAt'] ?? $m['stoppedAt'] ?? 0) >= MT_TAKE_AFTER || $now - (int) ($w[$pref] ?? 0) > MT_TAKE_AFTER;
}
function mtPeek(string $who): int {
    mtSeen($who); mtSweep(); $w = mtWorkers(); $now = time();
    return count(array_filter(mtAll(), fn($m) => mtMayTake($m, $who, $w, $now)));
}
/** the oldest meeting $who may take, claimed for it, as the job: segments with their start times, gaps and piece counts */
function mtNext(string $who): ?array {
    mtSeen($who); mtSweep(); $w = mtWorkers(); $now = time();
    $c = array_values(array_filter(mtAll(), fn($m) => mtMayTake($m, $who, $w, $now)));
    usort($c, fn($a, $b) => ($a['readyAt'] ?? 0) <=> ($b['readyAt'] ?? 0));
    foreach ($c as $x) {
        $got = false;
        $m = mtEdit($x['id'], function ($m) use ($who, $now, &$got) {
            if ($m['status'] !== 'ready') return null;
            $m['status'] = 'transcribing'; $m['claim'] = ['who' => $who, 'at' => $now, 'hold' => $now]; $m['attempts'] = (int) ($m['attempts'] ?? 0) + 1; $got = true; return $m;
        });
        if (!$got) continue;
        $segs = [];
        foreach ((array) $m['segs'] as $k => $g) {
            $have = []; foreach (mtParts($m['id']) as $p) if (str_starts_with(basename($p), sprintf('s%03d-', (int) $k))) $have[] = (int) substr(basename($p), 6, 5);
            $exp = (int) (((array) ($m['expect'] ?? []))[(string) $k] ?? $g['n'] ?? 0);
            $miss = 0; $top = max($exp, $have ? max($have) + 1 : 0); for ($i = 0; $i < $top; $i++) if (!in_array($i, $have, true)) $miss++;
            if (!$have || !in_array(0, $have, true)) { $segs[] = ['seg' => (int) $k, 'skip' => true, 'missing' => max(1, $miss), 't' => (int) ($g['t'] ?? 0), 'gap' => (int) ($g['gap'] ?? 0), 'why' => (string) ($g['why'] ?? '')]; continue; }
            $segs[] = ['seg' => (int) $k, 'ext' => (string) ($g['ext'] ?? 'webm'), 'pieces' => count($have), 'missing' => $miss, 't' => (int) ($g['t'] ?? 0), 'gap' => (int) ($g['gap'] ?? 0), 'why' => (string) ($g['why'] ?? '')];
        }
        alog('meeting transcribing', ['id' => $m['id'], 'who' => $who, 'segs' => count($segs)]);
        return ['id' => $m['id'], 'source' => $m['source'], 'company' => $m['company'], 'other' => $m['other'], 'label' => $m['label'], 'startedAt' => (int) $m['startedAt'],
            'secs' => (int) $m['secs'], 'tz' => 'America/Denver', 'segs' => $segs, 'attempt' => (int) $m['attempts']];
    }
    return null;
}
/** "still working on it": keeps the claim alive (every 2 minutes from the transcriber) */
function mtHold(string $id, string $who): bool {
    $ok = false; mtEdit($id, function ($m) use ($who, &$ok) { if ($m['status'] !== 'transcribing' || ($m['claim']['who'] ?? '') !== $who) return null; $m['claim']['hold'] = time(); $ok = true; return $m; });
    if ($ok) mtSeen($who); return $ok;
}
/** one segment, its pieces joined in order (what the recorder made, as one file) */
function mtSegBytes(string $id, int $seg, $outFh): int {
    $n = 0; foreach (mtParts($id) as $p) if (str_starts_with(basename($p), sprintf('s%03d-', $seg))) { $fh = fopen($p, 'rb'); $n += (int) stream_copy_to_stream($fh, $outFh); fclose($fh); }
    return $n;
}
/** the transcript: saved, read back, then the audio goes (unless kept), then the desk gets it as [MEETING NOTES] */
function mtDone(string $id, string $who, string $text, string $model = ''): array {
    $text = str_replace("\r\n", "\n", trim($text)); $text = (string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text);
    if ($text === '') return ['ok' => false, 'error' => 'empty transcript'];
    $text = mb_substr($text, 0, 800000);
    $m = mtGet($id); if (!$m) return ['ok' => false, 'error' => 'no such meeting'];
    if ($m['status'] === 'done') return ['ok' => false, 'error' => 'already done'];
    if (!in_array($m['status'], ['transcribing', 'ready'], true) || ($m['status'] === 'transcribing' && ($m['claim']['who'] ?? '') !== $who)) return ['ok' => false, 'error' => 'not yours: ' . $m['status'] . ' by ' . ($m['claim']['who'] ?? '-')];
    $f = mtDir($id) . '/transcript.txt'; $t = $f . '.tmp';
    if (@file_put_contents($t, $text . "\n", LOCK_EX) === false) return ['ok' => false, 'error' => 'could not write the transcript'];
    @chmod($t, 0600); @rename($t, $f);
    $back = (string) @file_get_contents($f);
    if (!hash_equals(hash('sha256', $text . "\n"), hash('sha256', $back))) return ['ok' => false, 'error' => 'the transcript did not read back the same'];
    $now = time();
    $m = mtEdit($id, function ($m) use ($now, $who, $model, $text) {
        $m['status'] = 'done'; $m['transcriptAt'] = $now; $m['transcriptChars'] = mb_strlen($text); $m['transcriptSha'] = hash('sha256', $text . "\n");
        $m['worker'] = $who; $m['model'] = jdClean($model, 60); unset($m['claim'], $m['error']);
        $m['keepUntil'] = !empty($m['keep']) ? $now + MT_KEEP_DAYS * 86400 : 0; return $m;
    });
    $dropped = 0; if (empty($m['keep'])) { $dropped = mtDropAudio($id); $m = mtEdit($id, function ($m) use ($now) { $m['audioDeletedAt'] = $now; return $m; }); }
    alog('meeting transcribed', ['id' => $id, 'who' => $who, 'chars' => mb_strlen($text), 'audio' => empty($m['keep']) ? 'deleted' : 'kept 30 days']);
    $d = mtToDesk($id);
    return ['ok' => true, 'audioDeleted' => empty($m['keep']), 'pieces' => $dropped, 'thread' => $d['thread'] ?? null] + (!empty($d['error']) ? ['deskError' => $d['error']] : []);
}
function mtFail(string $id, string $who, string $why): array {
    $why = jdClean($why, 300) ?: 'unknown'; $out = null;
    $m = mtEdit($id, function ($m) use ($who, $why, &$out) {
        if ($m['status'] !== 'transcribing' || ($m['claim']['who'] ?? '') !== $who) { $out = 'not yours'; return null; }
        unset($m['claim']); $m['error'] = $why;
        if ((int) ($m['attempts'] ?? 0) >= 3) { $m['status'] = 'failed'; $m['keep'] = true; $m['keepUntil'] = time() + MT_KEEP_DAYS * 86400; }
        else { $m['status'] = 'ready'; $m['readyAt'] = time(); }
        return $m;
    });
    if ($out) return ['ok' => false, 'error' => $out];
    alog('meeting transcript failed', ['id' => $id, 'who' => $who, 'why' => $why]);
    if ($m['status'] === 'failed') jvPush('J.A.R.V.I.S.: meeting not transcribed', 'The ' . $m['label'] . ' recording could not be turned into text (' . mb_substr($why, 0, 80) . '). The audio is kept for 30 days.', '/a-e018bb82/jarvis/?meeting=' . $id, 'jv-meet-' . $id);
    return ['ok' => true, 'status' => $m['status']];
}
/** the transcript into his desk, as [MEETING NOTES]: one message, the transcript in parts of about 25,000 characters at paragraph breaks */
function mtToDesk(string $id): array {
    $m = mtGet($id); if (!$m || $m['status'] !== 'done') return ['ok' => false, 'error' => 'not done'];
    if (!empty($m['thread'])) return ['ok' => true, 'thread' => $m['thread']];
    if (!empty($m['test'])) return ['ok' => true, 'thread' => null, 'test' => true];   /* a live check's synthetic clip (made over SSH): never to the desk */
    $text = (string) @file_get_contents(mtDir($id) . '/transcript.txt'); if (trim($text) === '') return ['ok' => false, 'error' => 'no transcript'];
    $st = (int) $m['startedAt']; foreach ((array) $m['segs'] as $g) if ((int) ($g['t'] ?? 0) > 0 && (int) $g['t'] < $st) $st = (int) $g['t'];
    $en = (int) ($m['stoppedAt'] ?? $m['lastChunkAt'] ?? $st);
    $gaps = 0; foreach ((array) $m['segs'] as $k => $g) if ((int) $k > 0 && (int) ($g['gap'] ?? 0) >= 20) $gaps++;
    $c = (array) $m['consent'];
    $head = "[MEETING NOTES]\nCompany: " . $m['label'] . "\nDate: " . mtWhen($st, 'Y-m-d') . "\n" .
        ($m['source'] === 'upload'
            ? 'Recording: an uploaded file (' . ($m['file']['name'] ?? 'audio') . '), about ' . mtLen((int) $m['secs']) . " of sound\n"
            : 'Recorded: ' . mtWhen($st) . ' to ' . mtWhen($en) . ' MT, ' . mtLen((int) $m['secs']) . ' of sound' . ($gaps ? ' (' . $gaps . ' gap' . ($gaps > 1 ? 's' : '') . ', marked in the transcript)' : '') . "\n") .
        'Consent: Matthew tapped "' . ($c['line'] ?? MT_CONSENT) . '" at ' . mtWhen((int) ($c['at'] ?? $st), 'g:i a \o\n D j M Y') . ' MT' . (!empty($c['device']) ? ' (' . $c['device'] . ')' : '') . ", before anything was recorded.\n" .
        'Transcript: whisper.cpp on the ' . ($m['worker'] ?? 'laptop') . ', one running text with no speaker names; a word here and there may be off. Meeting ' . $id . ".\n" .
        'Audio: ' . (empty($m['keep']) ? 'deleted once this transcript was saved.' : 'kept 30 days (he tapped Keep audio), then deleted.') . "\n" .
        "Raw transcript: kept privately in J.A.R.V.I.S. (Meetings) and on the laptop under that company's meetings/transcripts/ folder (gitignored). Never commit it or quote long stretches of it.\n";
    $paras = preg_split("/\n{2,}/", trim($text)) ?: [trim($text)]; $parts = []; $cur = '';
    foreach ($paras as $p) { if ($cur !== '' && mb_strlen($cur) + mb_strlen($p) > 25000) { $parts[] = $cur; $cur = ''; } $cur .= ($cur === '' ? '' : "\n\n") . $p; }
    if ($cur !== '') $parts[] = $cur;
    $body = ''; $total = count($parts); $cut = false;
    foreach ($parts as $i => $p) { if (mb_strlen($body) > 400000) { $cut = true; break; } $body .= "\n--- Transcript, part " . ($i + 1) . ' of ' . $total . " ---\n" . $p . "\n"; }
    if ($cut) $body .= "\n[The transcript is longer than this message; the rest is in the raw transcript in J.A.R.V.I.S. Meetings.]\n";
    $tail = "\n(Meeting mode, from a recording: read every part, then file NOTES (not the raw transcript) under that company only, turn the asks into to-dos in TASKS.md, draft any follow-up as a draft file only (never sent), and reply with a short summary. No speaker names unless the words say who. Rules: \"Meeting notes\" in your prompt.)";
    $msg = $head . $body . $tail;
    $tid = ''; $lk = jdLock();
    try { $tid = jdNewId(); $ok = jdAppend(['t' => 'msg', 'id' => $tid, 'from' => JD_ME, 'text' => $msg, 'ctx' => ['screen' => 'meeting', 'name' => $id], 'at' => time()]); }
    finally { jdUnlock($lk); }
    if (!$ok) { mtEdit($id, function ($m) { $m['deskTries'] = (int) ($m['deskTries'] ?? 0) + 1; return $m; }); return ['ok' => false, 'error' => 'the desk did not take it']; }
    mtEdit($id, function ($m) use ($tid) { $m['thread'] = $tid; return $m; });
    alog('meeting to desk', ['id' => $id, 'thread' => $tid, 'chars' => mb_strlen($msg)]);
    return ['ok' => true, 'thread' => $tid];
}
/** the clock work: the stalled-recording alert, stopping a recording left open, lapsed claims, kept audio past 30 days, a desk send that
    did not land, and "queued" when no transcriber has looked for a while. Runs from the transcribers' looks, the 10-minute check and (at
    most every 30 s) his signed-in page. */
function mtSweep(): array {
    $now = time(); $out = ['stall' => 0, 'auto' => 0, 'lapsed' => 0, 'expired' => 0, 'desk' => 0, 'queued' => 0];
    $w = mtWorkers();
    foreach (mtAll() as $m) {
        $id = $m['id']; $st = $m['status']; $last = (int) ($m['lastChunkAt'] ?? 0); $al = (array) ($m['alerts'] ?? []);
        if ($st === 'recording' && $now - $last >= MT_STALL && empty($al['stall'])) {
            mtEdit($id, function ($m) use ($now) { $a = (array) $m['alerts']; $a['stall'] = $now; $m['alerts'] = (object) $a; return $m; });
            jvPush('J.A.R.V.I.S.: recording paused', 'Recording paused: no sound has reached J.A.R.V.I.S. for ' . intdiv($now - $last, 60) . ' minutes. Open J.A.R.V.I.S. to resume.', '/a-e018bb82/jarvis/?meeting=' . $id, 'jv-meet-' . $id);
            alog('meeting stalled', ['id' => $id, 'quiet' => $now - $last]); $out['stall']++;
        }
        $auto = ($st === 'recording' && $now - $last >= MT_IDLE_STOP) ? 'auto-idle' : (($st === 'paused' && $now - (int) ($m['pausedAt'] ?? $last) >= MT_PAUSE_STOP) ? 'auto-pause'
            : (in_array($st, ['recording', 'paused'], true) && $now - (int) $m['startedAt'] > MT_MAX_SECS + 1800 ? 'auto-cap' : ''));
        if ($st === 'uploading' && $now - $last >= 6 * 3600) { mtEdit($id, function ($m) use ($now) { $m['status'] = 'discarded'; $m['discardedAt'] = $now; $m['error'] = 'the upload never finished'; $m['audioDeletedAt'] = $now; return $m; }); mtDropAudio($id); continue; }
        if ($auto !== '') {
            $m = mtEdit($id, function ($m) use ($now, $auto) { if (!in_array($m['status'], ['recording', 'paused'], true)) return null; $m['status'] = 'ready'; $m['stoppedAt'] = (int) $m['lastChunkAt']; $m['readyAt'] = $now; $m['endedBy'] = $auto; return $m; });
            $why = $auto === 'auto-idle' ? 'no sound arrived for 30 minutes' : ($auto === 'auto-pause' ? 'it was paused for 2 hours' : 'it passed 3 hours');
            jvPush('J.A.R.V.I.S.: recording stopped', 'The ' . $m['label'] . ' recording stopped by itself (' . $why . '). What was recorded is being transcribed.', '/a-e018bb82/jarvis/?meeting=' . $id, 'jv-meet-' . $id);
            alog('meeting stopped by itself', ['id' => $id, 'why' => $auto]); $out['auto']++; $st = 'ready';
        }
        if ($st === 'transcribing' && $now - (int) ($m['claim']['hold'] ?? $m['claim']['at'] ?? 0) > MT_HOLD) {
            mtEdit($id, function ($m) use ($now) { if ($m['status'] !== 'transcribing') return null; $m['error'] = 'the ' . ($m['claim']['who'] ?? 'transcriber') . ' stopped answering'; unset($m['claim']); $m['status'] = (int) ($m['attempts'] ?? 0) >= 4 ? 'failed' : 'ready'; $m['readyAt'] = $now; return $m; });
            $out['lapsed']++;
        }
        if (!empty($m['keepUntil']) && (int) $m['keepUntil'] < $now && empty($m['audioDeletedAt']) && in_array($st, ['done', 'failed'], true)) {
            mtDropAudio($id); mtEdit($id, function ($m) use ($now) { $m['audioDeletedAt'] = $now; $m['keepUntil'] = 0; return $m; }); $out['expired']++;
        }
        if ($st === 'done' && empty($m['thread']) && empty($m['test']) && (int) ($m['deskTries'] ?? 0) < 5) { mtToDesk($id); $out['desk']++; }
        if ($st === 'ready' && empty($al['queued']) && $now - (int) ($m['readyAt'] ?? $now) >= MT_LATE && $now - max((int) ($w['laptop'] ?? 0), (int) ($w['cloud'] ?? 0)) >= MT_LATE) {
            mtEdit($id, function ($m) use ($now) { $a = (array) $m['alerts']; $a['queued'] = $now; $m['alerts'] = (object) $a; return $m; });
            jvPush('J.A.R.V.I.S.: meeting queued', 'The ' . $m['label'] . ' recording is saved. Your laptop is asleep and the cloud machine is off, so the transcript starts when the laptop wakes.', '/a-e018bb82/jarvis/?meeting=' . $id, 'jv-meet-' . $id);
            $out['queued']++;
        }
    }
    @touch(mtDir() . '/sweep.stamp');
    return $out;
}
/** at most every 30 s, from his signed-in page */
function mtSweepMaybe(): void {
    $f = aDataDir() . '/jarvis/meetings/sweep.stamp';
    if (!is_dir(dirname($f))) return;   /* no meeting ever: nothing to do */
    if (is_file($f) && time() - (int) @filemtime($f) < 30) return;
    try { mtSweep(); } catch (\Throwable $e) { alog('meeting sweep failed', ['error' => mb_substr($e->getMessage(), 0, 160)]); }
}
/** finished transcripts, for the laptop's private copy beside the meeting notes */
function mtDoneList(): array {
    $o = []; foreach (mtAll() as $m) if ($m['status'] === 'done' && empty($m['test']) && is_file(mtDir($m['id']) . '/transcript.txt'))
        $o[] = ['id' => $m['id'], 'company' => $m['company'], 'other' => $m['other'], 'date' => mtWhen((int) $m['startedAt'], 'Y-m-d'), 'at' => (int) $m['transcriptAt']];
    return $o;
}
