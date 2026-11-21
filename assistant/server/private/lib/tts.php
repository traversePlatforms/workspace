<?php
/* P-11 (2026-11-20, Matthew: "connect jarvis to eleven labs voice ai so that I can get a more natural feeling AI", then "go with daniel for now").
   J.A.R.V.I.S. speaks with an ElevenLabs voice; whenever that is off, capped or failing, the page and the Shortcut use the built-in voice
   instead, so J.A.R.V.I.S. never goes silent.
   The key: data/elevenlabs.json (0600), {"key": "sk_..."}; a restricted key, Text to Speech only. Never sent to a page or written to a log.
   The same file can override the settings below, one field each: voice, model, format, cap, resetDay, off (true turns it off).
   The cap: our own character count per ElevenLabs month (data/jarvis/tts-usage.json), because a restricted key cannot read the balance.
   Free plan, 20 Nov: 10,000 credits a month; Flash v2.5 costs "between 0.5 and 1 credit per character" (elevenlabs.io/pricing), so the cap
   assumes 1 a character and stops at 90%: 9,000 characters. ElevenLabs saying 401 or 402, or 429 with a quota, stops it for the rest of
   that month; a timeout, a 5xx or a busy 429 falls back for that one answer only.
   The cache: data/jarvis/tts-cache/<sha256 of voice|model|format|text>.mp3, at most TTS_CACHE_MB, oldest out first, so a phrase said
   before (a greeting, "Sent to the desk; I'll alert you when it's done.", a reminder) costs nothing. */
declare(strict_types=1);

const TTS_VOICE = 'onwK4e9ZLuTAKqWW03F9';   /* "Daniel", an ElevenLabs default voice (library voices need a paid plan through the API) */
const TTS_MODEL = 'eleven_flash_v2_5';      /* the fastest and cheapest (half the price of v2 Multilingual a character) */
const TTS_FORMAT = 'mp3_44100_64';          /* small, so the first words arrive quickly over a phone connection */
const TTS_CAP = 9000;                       /* characters per ElevenLabs month: 90% of the free 10,000 credits at 1 credit a character */
const TTS_RESET_DAY = 20;                   /* the day ElevenLabs' month starts (the account was made 20 Nov); set resetDay if it shows another */
const TTS_MAX = 600;                        /* characters per answer; a longer one is cut at a sentence */
const TTS_CACHE_MB = 60;
const TTS_BRIEF_RESERVE = 2000;             /* P-13: the full morning brief uses the natural voice only while the month keeps this many characters spare after it */

function ttsDir(string $sub = ''): string { $d = aDataDir() . '/jarvis' . ($sub !== '' ? '/' . $sub : ''); if (!is_dir($d)) @mkdir($d, 0700, true); return $d; }
/** the settings, with the key; never returned to a page */
function ttsCfg(): array {
    $j = jget('elevenlabs.json');
    return [
        'key' => trim((string) ($j['key'] ?? '')),
        'voice' => preg_match('/^[A-Za-z0-9]{10,40}$/', (string) ($j['voice'] ?? '')) ? (string) $j['voice'] : TTS_VOICE,
        'model' => preg_match('/^[a-z0-9_]{3,40}$/', (string) ($j['model'] ?? '')) ? (string) $j['model'] : TTS_MODEL,
        'format' => preg_match('/^mp3_\d{4,5}_\d{2,3}$/', (string) ($j['format'] ?? '')) ? (string) $j['format'] : TTS_FORMAT,
        'cap' => max(0, (int) ($j['cap'] ?? TTS_CAP)),
        'resetDay' => max(1, min(28, (int) ($j['resetDay'] ?? TTS_RESET_DAY))),
        'off' => !empty($j['off']),
    ];
}
function ttsBase(): string {
    $m = in_array(PHP_SAPI, ['cli-server', 'cli'], true) ? (string) getenv('ELEVENLABS_MOCK') : '';   /* tests only */
    return $m !== '' ? rtrim($m, '/') . '/' : 'https://api.elevenlabs.io/';
}
/** this ElevenLabs month: it starts on resetDay */
function ttsPeriod(?array $c = null): string {
    $c = $c ?? ttsCfg(); $now = new DateTime('now', jvTz());
    $start = (clone $now)->setDate((int) $now->format('Y'), (int) $now->format('n'), $c['resetDay'])->setTime(0, 0);
    if ($start > $now) $start->modify('-1 month');
    return $start->format('Y-m-d');
}
function ttsUsage(): array { $u = jget('jarvis/tts-usage.json'); $p = ttsPeriod(); return (array) ($u[$p] ?? []) + ['chars' => 0, 'calls' => 0, 'hits' => 0, 'stop' => null]; }
function ttsNote(callable $fn): void {
    ttsDir(); $p = ttsPeriod();
    jedit('jarvis/tts-usage.json', function ($u) use ($fn, $p) {
        $cur = (array) ($u[$p] ?? []) + ['chars' => 0, 'calls' => 0, 'hits' => 0, 'stop' => null];
        $u[$p] = $fn($cur);
        krsort($u); return array_slice($u, 0, 6, true);   /* the last six months */
    });
}
/** what the page may see: on, available, used and the cap; never the key */
function ttsState(): array {
    $c = ttsCfg(); $u = ttsUsage(); $on = $c['key'] !== '' && !$c['off'];
    $why = !$on ? 'off' : (is_array($u['stop']) ? 'stopped' : ((int) $u['chars'] >= $c['cap'] ? 'cap' : ''));
    $next = (new DateTime(ttsPeriod($c), jvTz()))->modify('+1 month')->format('Y-m-d');
    return ['on' => $on, 'avail' => $on && $why === '', 'why' => $why, 'used' => (int) $u['chars'], 'cap' => $c['cap'], 'since' => ttsPeriod($c), 'resets' => $next,
        'hits' => (int) $u['hits'], 'briefReserve' => TTS_BRIEF_RESERVE, 'stopNote' => is_array($u['stop']) ? (string) ($u['stop']['why'] ?? '') : '', 'max' => TTS_MAX];
}
/** the words, ready to say: no markdown or links, at most TTS_MAX characters, cut at a sentence */
function ttsText(string $t): string {
    $t = (string) preg_replace('/https?:\/\/\S+/u', 'the link', $t);
    $t = (string) preg_replace('/[*_`#>]+/u', '', $t);
    $t = trim((string) preg_replace('/\s+/u', ' ', (string) preg_replace('/[\x00-\x1F\x7F]/u', ' ', $t)));
    if (mb_strlen($t) > TTS_MAX) {
        $cut = mb_substr($t, 0, TTS_MAX - 25); $k = max(mb_strrpos($cut, '. ') ?: 0, mb_strrpos($cut, '? ') ?: 0, mb_strrpos($cut, '! ') ?: 0);
        $t = ($k > 200 ? mb_substr($cut, 0, $k + 1) : $cut . '…') . ' The rest is on screen.';
    }
    return $t;
}
function ttsHash(string $t, ?array $c = null): string { $c = $c ?? ttsCfg(); return hash('sha256', $c['voice'] . '|' . $c['model'] . '|' . $c['format'] . '|' . $t); }
function ttsIdOk(string $id): bool { return (bool) preg_match('/^[0-9a-f]{64}$/D', $id); }
function ttsCacheFile(string $id): string { return ttsDir('tts-cache') . '/' . $id . '.mp3'; }
function ttsPendFile(string $id): string { return ttsDir('tts-cache') . '/' . $id . '.txt'; }
/** oldest out first, until the cache is under its size; words waiting over an hour go too */
function ttsPrune(): void {
    $fs = []; $tot = 0;
    foreach (glob(ttsDir('tts-cache') . '/*') ?: [] as $f) {
        if (str_ends_with($f, '.txt')) { if (filemtime($f) < time() - 3600) @unlink($f); continue; }
        if (str_ends_with($f, '.tmp')) { if (filemtime($f) < time() - 600) @unlink($f); continue; }
        $s = (int) filesize($f); $fs[] = [filemtime($f), $f, $s]; $tot += $s;
    }
    if ($tot <= TTS_CACHE_MB * 1048576) return;
    sort($fs);
    foreach ($fs as [$m, $f, $s]) { @unlink($f); $tot -= $s; if ($tot <= TTS_CACHE_MB * 1048576 * 0.9) break; }
}
/** may these words be made now? '' yes, else why not (off, stopped, cap) */
function ttsCan(string $t): string {
    $st = ttsState(); if (!$st['avail']) return $st['why'];
    return $st['used'] + mb_strlen($t) > $st['cap'] ? 'cap' : '';
}
function ttsFallback(string $why, int $code = 503): never {
    out(['ok' => false, 'fallback' => true, 'why' => $why, 'state' => ttsState()], $code);
}

/** the page, step 1 (signed in): POST {text}. Keeps the words beside the cache and gives back where to play them (step 2, ttsplay), or
    says to use the built-in voice. The words never go in an address, so they never reach the web server's access log. */
function ttsPrep(string $text, int $left = 0): array {
    $t = ttsText($text); if ($t === '') return ['ok' => false, 'fallback' => true, 'why' => 'empty'];
    if (!ttsState()['on']) return ['ok' => false, 'fallback' => true, 'why' => 'off', 'state' => ttsState()];
    $c = ttsCfg(); $id = ttsHash($t, $c);
    if (is_file(ttsCacheFile($id))) return ['ok' => true, 'id' => $id, 'cached' => true, 'url' => 'api.php?action=ttsplay&id=' . $id];
    $why = ttsCan($t); if ($why !== '') return ['ok' => false, 'fallback' => true, 'why' => $why, 'state' => ttsState()];
    /* P-13: one piece of the morning brief, with $left = the characters of the brief still to say, this piece included. The natural voice
       only while the month keeps TTS_BRIEF_RESERVE spare after all of it; otherwise the page says the rest in the device voice. A piece
       already in the cache (above) costs nothing, so it still plays. */
    if ($left > 0) { $st = ttsState(); if ($st['used'] + max($left, mb_strlen($t)) + TTS_BRIEF_RESERVE > $st['cap']) return ['ok' => false, 'fallback' => true, 'why' => 'reserve', 'state' => $st]; }
    $f = ttsPendFile($id); $tmp = $f . '.' . bin2hex(random_bytes(3)) . '.w';
    file_put_contents($tmp, $t); @chmod($tmp, 0600); rename($tmp, $f);
    return ['ok' => true, 'id' => $id, 'cached' => false, 'url' => 'api.php?action=ttsplay&id=' . $id];
}
/** the page, step 2 (signed in): GET ttsplay&id. The cached file (with byte ranges), or the words from step 1 made now and streamed as they arrive. */
function ttsPlay(string $id): never {
    if (!ttsIdOk($id)) ttsFallback('bad', 404);
    if (is_file(ttsCacheFile($id))) ttsServeCached($id);
    $pf = ttsPendFile($id); $t = is_file($pf) ? (string) file_get_contents($pf) : '';
    if ($t === '') ttsFallback('gone', 404);
    ttsMake($t, true);
}
/** POST tts {text}, signed in or with a voice key: the whole answer as audio/mpeg (from the cache, or made now and streamed through) */
function ttsDirect(string $text): never {
    $t = ttsText($text); if ($t === '') ttsFallback('empty', 400);
    if (!ttsState()['on']) ttsFallback('off');
    $id = ttsHash($t); if (is_file(ttsCacheFile($id))) ttsServeCached($id);
    ttsMake($t, true);
}
function ttsServeCached(string $id): never {
    $p = ttsCacheFile($id); @touch($p);
    if (!isset($_SERVER['HTTP_RANGE']) || preg_match('/^bytes=0-/', (string) $_SERVER['HTTP_RANGE'])) ttsNote(function ($u) { $u['hits']++; return $u; });
    $size = (int) filesize($p); $from = 0; $to = $size - 1;
    header('Content-Type: audio/mpeg'); header('Cache-Control: private, no-store'); header('Accept-Ranges: bytes'); header('X-Tts: cache');
    if (preg_match('/^bytes=(\d*)-(\d*)$/D', trim((string) ($_SERVER['HTTP_RANGE'] ?? '')), $rg) && ($rg[1] !== '' || $rg[2] !== '')) {
        if ($rg[1] === '') $from = max(0, $size - (int) $rg[2]); else { $from = (int) $rg[1]; if ($rg[2] !== '') $to = min($to, (int) $rg[2]); }
        if ($from > $to || $from >= $size) { http_response_code(416); header('Content-Range: bytes */' . $size); exit; }
        http_response_code(206); header('Content-Range: bytes ' . $from . '-' . $to . '/' . $size);
    }
    header('Content-Length: ' . ($to - $from + 1));
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') { $fh = fopen($p, 'rb'); fseek($fh, $from); echo fread($fh, max(1, $to - $from + 1)); fclose($fh); }
    exit;
}
/** ElevenLabs makes the words; $stream: sent on to the caller as they come (headers go out with the first bytes, so a failure before then
    is still a clean fallback answer). Kept in the cache when whole. Returns the cache id when not streaming, or null. */
function ttsMake(string $t, bool $stream): ?string {
    $c = ttsCfg(); $id = ttsHash($t, $c);
    $why = ttsCan($t);
    if ($why !== '') { if ($stream) ttsFallback($why); return null; }
    $tmp = ttsCacheFile($id) . '.' . bin2hex(random_bytes(3)) . '.tmp'; $fh = fopen($tmp, 'wb'); @chmod($tmp, 0600);
    $status = 0; $err = ''; $sent = false; $bytes = 0;
    $h = curl_init(ttsBase() . 'v1/text-to-speech/' . rawurlencode($c['voice']) . '/stream?output_format=' . rawurlencode($c['format']));
    curl_setopt_array($h, [
        CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode(['text' => $t, 'model_id' => $c['model']], JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => ['xi-api-key: ' . $c['key'], 'Content-Type: application/json', 'Accept: audio/mpeg'],
        CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 30, CURLOPT_LOW_SPEED_LIMIT => 1, CURLOPT_LOW_SPEED_TIME => 8,
        CURLOPT_HEADERFUNCTION => function ($h, $line) use (&$status) { if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $line, $m)) $status = (int) $m[1]; return strlen($line); },
        CURLOPT_WRITEFUNCTION => function ($h, $chunk) use (&$status, &$err, &$sent, &$bytes, $fh, $stream) {
            if ($status !== 200) { if (strlen($err) < 4000) $err .= $chunk; return strlen($chunk); }
            if ($stream && !$sent) {
                $sent = true; while (ob_get_level() > 0) @ob_end_flush();
                header('Content-Type: audio/mpeg'); header('Cache-Control: private, no-store'); header('X-Accel-Buffering: no'); header('X-Tts: made');
            }
            fwrite($fh, $chunk); $bytes += strlen($chunk);
            if ($stream) { echo $chunk; @flush(); }
            return strlen($chunk);
        },
    ]);
    $ok = curl_exec($h) !== false; $cerr = curl_errno($h); curl_close($h); fclose($fh);
    if ($ok && $status === 200 && $bytes > 0) {
        rename($tmp, ttsCacheFile($id)); @unlink(ttsPendFile($id));
        $n = mb_strlen($t); ttsNote(function ($u) use ($n) { $u['chars'] += $n; $u['calls']++; return $u; });
        ttsPrune();
        if ($stream) exit;
        return $id;
    }
    @unlink($tmp);
    /* what went wrong, by its code only (never the body, which could hold the words) */
    $code = ''; $d = json_decode($err, true); if (is_array($d)) { $x = $d['detail'] ?? null; $code = is_array($x) ? (string) ($x['status'] ?? $x['code'] ?? '') : ''; }
    $code = substr((string) preg_replace('/[^a-z0-9_]/', '', strtolower($code)), 0, 40);
    $quota = $status === 401 || $status === 402 || ($status === 429 && preg_match('/quota|credit|limit_reached|payment/', $code . ' ' . strtolower($err)));
    if ($quota) ttsNote(function ($u) use ($status, $code) { $u['stop'] = ['at' => time(), 'status' => $status, 'why' => 'ElevenLabs said ' . $status . ($code !== '' ? ' (' . $code . ')' : '')]; return $u; });
    alog('tts failed', ['status' => $status, 'code' => $code, 'curl' => $cerr, 'stopped' => $quota, 'chars' => mb_strlen($t)]);
    if ($stream) { if ($sent) exit; ttsFallback($quota ? 'stopped' : ($cerr ? 'timeout' : 'failed')); }
    return null;
}

/* ---------------------------------------------------------------- the Shortcut's optional audio link */
function ttsSecret(): string {
    $j = jget('jarvis/tts-link.json');
    if (strlen((string) ($j['secret'] ?? '')) === 64) return (string) $j['secret'];
    ttsDir(); $s = bin2hex(random_bytes(32)); jput('jarvis/tts-link.json', ['secret' => $s, 'made' => time()]);
    return $s;
}
/** a link to audio already in the cache, good for 15 minutes; it can make nothing new, so it costs nothing */
function ttsLink(string $id, string $base): string {
    $e = time() + 900; $s = substr(hash_hmac('sha256', $id . '|' . $e, ttsSecret()), 0, 32);
    return $base . '?action=ttsget&id=' . $id . '&e=' . $e . '&s=' . $s;
}
function ttsGet(string $id, int $e, string $s): never {
    if (!ttsIdOk($id) || $e < time() || $e > time() + 960 || !hash_equals(substr(hash_hmac('sha256', $id . '|' . $e, ttsSecret()), 0, 32), $s)) ttsFallback('link', 403);
    if (!is_file(ttsCacheFile($id))) ttsFallback('gone', 404);
    ttsServeCached($id);
}
/** the voice door, with &audio=1: make the answer's audio now (or find it), and give the link; null when the built-in voice should speak */
function ttsForVoice(string $say, string $base): ?string {
    $t = ttsText($say); if ($t === '') return null;
    $id = ttsHash($t);
    if (!is_file(ttsCacheFile($id)) && ttsMake($t, false) === null) return null;
    @touch(ttsCacheFile($id));
    return ttsLink($id, $base);
}
