<?php
declare(strict_types=1);
/**
 * In-app texting (Matthew 2026-10-10). Included by api/rounds.php; nothing here answers a request on its own.
 *
 * ---- WHAT IT DOES ------------------------------------------------------------------------
 * A person texts a homeowner from inside the app, one message at a time, and the thread (what was sent, what came back)
 * is kept with the door, lead or customer. Replies arrive through Twilio's webhook (rounds.php ?action=smsin).
 *
 * ---- THE RULES (built in, not left to the crew) -------------------------------------------
 *   - Only numbers the homeowner GAVE: a door phone saved as "given at the door", a lead (they filled in the form), or a
 *     customer. A looked-up number (skip trace, people search) is never texted from the app.
 *   - Quiet hours: nothing is sent before 8 am or after 9 pm local time (the federal rule's window; the install's clock, Colorado unless company.json names a market).
 *   - STOP, UNSUBSCRIBE, CANCEL, END, QUIT (and the like) opt the number out at once; START opts it back in. An opted-out
 *     number cannot be texted from the app. Twilio's own opt-out handling stays on as well.
 *   - The first text the app sends to a number names the sender and the company and says "Reply STOP to opt out".
 *   - One message at a time, typed or picked by a person: no bulk sends, no schedules.
 * Each company is responsible for its own carrier registration (A2P 10DLC) and for following the TCPA and state rules.
 *
 * ---- WHERE THINGS LIVE ---------------------------------------------------------------------
 *   sixfold-data/rounds/sms.log          one JSON line per message, in and out: {num, dir, body, by?, at, sid?, status?, ref?}
 *   sixfold-data/rounds/sms-optout.json  { "+13035550142": {at, how} } numbers that said STOP
 *   sixfold-private/sms-config.php       the Twilio keys (api/sms-config.example.php is the shape; never committed)
 * Environment variables SIXFOLD_SMS_* override the file.
 *
 * ---- TESTS ---------------------------------------------------------------------------------
 * 'mock_file' (config or SIXFOLD_SMS_MOCK) sends nothing: each request is appended to <mock_file>.requests.log and the
 * answer is a canned Twilio-shaped reply, so the whole path runs with no network and no cost.
 */

const SMS_STOP_WORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT'];
const SMS_START_WORDS = ['START', 'UNSTOP', 'YES'];
const SMS_MAX = 640;   /* characters a person may type (four SMS segments) */

function smsConfigDefaults(): array {
    return [
        'provider' => 'twilio',
        'account_sid' => '', 'auth_token' => '',
        'from' => '',                    /* the company's Twilio number, +1XXXXXXXXXX; or a Messaging Service below */
        'messaging_service_sid' => '',   /* MG...; preferred once the A2P 10DLC campaign is registered */
        'public_url' => '',              /* the exact webhook URL set in Twilio (signatures are checked against it) */
        'quiet_start' => 8, 'quiet_end' => 21,
        'timeout' => 20,
        'mock_file' => null,
    ];
}
function smsConfig(?string $apiDir = null): array {
    $apiDir = $apiDir ?? __DIR__;
    $cfg = smsConfigDefaults();
    $priv = dirname($apiDir, 2) . '/sixfold-private/sms-config.php';
    if (is_readable($priv)) $cfg = array_replace($cfg, (array) (require $priv));
    foreach (['account_sid' => 'SIXFOLD_SMS_SID', 'auth_token' => 'SIXFOLD_SMS_TOKEN', 'from' => 'SIXFOLD_SMS_FROM',
              'messaging_service_sid' => 'SIXFOLD_SMS_SERVICE', 'public_url' => 'SIXFOLD_SMS_URL', 'mock_file' => 'SIXFOLD_SMS_MOCK'] as $k => $name) {
        $v = getenv($name); if ($v !== false && $v !== '') $cfg[$k] = $v;
    }
    return $cfg;
}
function smsConfigured(array $c): bool {
    if (!empty($c['mock_file'])) return true;
    return $c['account_sid'] !== '' && $c['auth_token'] !== '' && ($c['from'] !== '' || $c['messaging_service_sid'] !== '');
}
/** US numbers only: +1 and ten digits, or null */
function smsE164(string $p): ?string {
    $d = preg_replace('/\D/', '', $p) ?? '';
    if (strlen($d) === 10 && $d[0] !== '0' && $d[0] !== '1') return '+1' . $d;
    if (strlen($d) === 11 && $d[0] === '1') return '+' . $d;
    return null;
}
function smsQuiet(array $c, ?int $now = null): bool {
    $h = (int) (new DateTime('@' . ($now ?? time())))->setTimezone(new DateTimeZone(function_exists('appTz') ? appTz() : 'America/Denver'))->format('G');
    return $h < (int) $c['quiet_start'] || $h >= (int) $c['quiet_end'];
}
function smsLogFile(): string { return DATA_DIR . '/sms.log'; }
function smsOptFile(): string { return DATA_DIR . '/sms-optout.json'; }
function smsOptOuts(): array { return (array) (json_decode((string) @file_get_contents(smsOptFile()), true) ?: []); }
function smsOptedOut(string $num): bool { return isset(smsOptOuts()[$num]); }
function smsSetOpt(string $num, bool $out, string $how): bool {
    $f = smsOptFile(); $lock = @fopen($f . '.lock', 'c');
    if ($lock) flock($lock, LOCK_EX);
    $all = smsOptOuts();
    if ($out) $all[$num] = ['at' => time(), 'how' => $how]; else unset($all[$num]);
    $ok = writeJsonAtomic($f, $all);
    if ($lock) { flock($lock, LOCK_UN); fclose($lock); }
    return $ok;
}
function smsLog(array $row): bool {
    return (bool) @file_put_contents(smsLogFile(), json_encode(stamped($row), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}
/** every row of sms.log (readLines() keeps only rows with an id; messages have none) */
function smsRows(): array {
    $out = []; $f = smsLogFile();
    if (!is_readable($f) || !($fh = @fopen($f, 'r'))) return $out;
    while (($line = fgets($fh)) !== false) { $r = json_decode(trim($line), true); if (is_array($r) && isset($r['num'])) $out[] = $r; }
    fclose($fh);
    return $out;
}
/** every message to and from one number, oldest first */
function smsThread(string $num): array {
    $out = [];
    foreach (smsRows() as $r) if (($r['num'] ?? '') === $num) $out[] = $r;
    usort($out, fn($a, $b) => ((float) ($a['rt'] ?? $a['at'] ?? 0)) <=> ((float) ($b['rt'] ?? $b['at'] ?? 0)));
    return $out;
}
function smsSentBefore(string $num): bool {
    foreach (smsRows() as $r) if (($r['num'] ?? '') === $num && ($r['dir'] ?? '') === 'out' && ($r['status'] ?? '') !== 'failed') return true;
    return false;
}
/** Twilio's request signature: base64 HMAC-SHA1 of the URL followed by every POST field name and value, sorted by name */
function smsSignature(string $token, string $url, array $params): string {
    ksort($params, SORT_STRING);
    $s = $url; foreach ($params as $k => $v) $s .= $k . (is_array($v) ? implode('', $v) : $v);
    return base64_encode(hash_hmac('sha1', $s, $token, true));
}
function smsValid(array $c, string $url, array $params, string $sig): bool {
    if ($sig === '') return false;
    $token = (string) ($c['auth_token'] !== '' ? $c['auth_token'] : (!empty($c['mock_file']) ? 'mock-token' : ''));
    return $token !== '' && hash_equals(smsSignature($token, $url, $params), $sig);
}
/** send one message; returns ['ok' => bool, 'sid' => ?, 'status' => ?, 'error' => ?] */
function smsSend(array $c, string $to, string $body): array {
    $fields = ['To' => $to, 'Body' => $body];
    if ($c['messaging_service_sid'] !== '') $fields['MessagingServiceSid'] = $c['messaging_service_sid']; else $fields['From'] = $c['from'];
    if (!empty($c['mock_file'])) {
        @file_put_contents($c['mock_file'] . '.requests.log', json_encode($fields) . "\n", FILE_APPEND | LOCK_EX);
        $canned = json_decode((string) @file_get_contents($c['mock_file']), true) ?: [];
        if (!empty($canned['fail'])) return ['ok' => false, 'error' => (string) $canned['fail']];
        return ['ok' => true, 'sid' => 'SM' . bin2hex(random_bytes(16)), 'status' => (string) ($canned['status'] ?? 'queued')];
    }
    $url = 'https://api.twilio.com/2010-04-01/Accounts/' . rawurlencode((string) $c['account_sid']) . '/Messages.json';
    $ctx = stream_context_create(['http' => ['method' => 'POST', 'timeout' => (int) $c['timeout'], 'ignore_errors' => true,
        'header' => "Content-Type: application/x-www-form-urlencoded\r\nAuthorization: Basic " . base64_encode($c['account_sid'] . ':' . $c['auth_token']) . "\r\n",
        'content' => http_build_query($fields)]]);
    $raw = @file_get_contents($url, false, $ctx);
    $code = 0; foreach (($http_response_header ?? []) as $h) if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $code = (int) $m[1];
    $j = json_decode((string) $raw, true);
    if ($raw === false || $code === 0) return ['ok' => false, 'error' => 'Could not reach the texting service. Try again.'];
    if ($code >= 300 || !is_array($j) || empty($j['sid'])) return ['ok' => false, 'error' => 'The texting service refused it' . (is_array($j) && !empty($j['message']) ? ': ' . $j['message'] : '.')];
    return ['ok' => true, 'sid' => (string) $j['sid'], 'status' => (string) ($j['status'] ?? 'queued')];
}
/** what a reply word means: 'stop', 'start' or '' */
function smsKeyword(string $body): string {
    $w = strtoupper(trim(preg_replace('/[^A-Za-z]/', ' ', $body) ?? ''));
    if (in_array($w, SMS_STOP_WORDS, true)) return 'stop';
    if (in_array($w, SMS_START_WORDS, true)) return 'start';
    return '';
}
