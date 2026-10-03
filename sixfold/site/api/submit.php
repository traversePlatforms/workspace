<?php
/**
 * Sixfold Colorado — form handler for /contact/.
 *
 * Trimmed from the Surge site's api/submit.php: one form, no uploads, the
 * "need" radio becomes the subject line so the inbox sorts itself.
 *
 * - Honeypot `_hp` must stay empty (bots fill it) -> silent success.
 * - Required: name, valid email, phone, message.
 * - JS submits get JSON back; plain submits get a 303 to /thank-you/.
 * - Every accepted submission is appended to submissions.log as a backup, so a
 *   mail() failure on the host does not lose the lead.
 */
declare(strict_types=1);

$cfg = require __DIR__ . '/config.php';

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$wantsJson = str_contains((string) ($_SERVER['HTTP_ACCEPT'] ?? ''), 'application/json');

function respond_ok(array $cfg, bool $json): void {
    if ($json) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => true]);
    } else {
        header('Location: ' . $cfg['thank_you'], true, 303);
    }
    exit;
}
function respond_bad(string $msg, bool $json, int $code = 422): void {
    http_response_code($code);
    if ($json) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => $msg]);
    } else {
        header('Content-Type: text/plain; charset=utf-8');
        echo $msg;
    }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond_bad('Method not allowed', $wantsJson, 405);
}

/* 2026-10-03 (security review): mb_scrub swaps invalid UTF-8 for "?". Without it, a post with
   broken bytes made json_encode return false, so an EMPTY line went to both logs and the lead
   survived only in the email. Every input passes through here, so this covers all of them. */
$field = static fn(string $k, int $max = 2000): string =>
    mb_substr(trim(mb_scrub((string) ($_POST[$k] ?? ''), 'UTF-8')), 0, $max);

/**
 * Honeypot. A filled field means a bot, so say yes and do nothing — telling it it
 * failed only teaches it to try again.
 *
 * ⚑ BUT IT MUST LEAVE A TRACE. On 2026-09-21 this silently discarded a real
 * submission on the live site: a password manager autofilled the hidden field, the
 * customer saw the success message, and nothing was written anywhere. There was no
 * way to tell "no enquiries this week" from "enquiries are being eaten".
 *
 * So rejections are logged now. Never to the customer — they still get success —
 * but to the same file, tagged, so the difference is visible. If real names start
 * appearing in these lines, the honeypot is misfiring again.
 */
$hp = $field('_confirm_url') . $field('_hp');   // _hp: the old name, still caught
if ($hp !== '') {
    @file_put_contents(
        $cfg['log_file'],
        json_encode([
            'at' => date('c'), 'rejected' => 'honeypot',
            'value' => mb_substr($hp, 0, 120),
            'name' => $field('name', 120), 'email' => $field('email', 160),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
        ], JSON_UNESCAPED_UNICODE) . "\n",
        FILE_APPEND | LOCK_EX
    );
    respond_ok($cfg, $wantsJson);
}

/**
 * Per-IP rate limit.
 *
 * Runs AFTER the honeypot and BEFORE validation, deliberately: a bot that fills
 * the honeypot costs nothing, and anything that gets past it should be counted
 * before we do any work on its input.
 *
 * One file per IP, holding submission timestamps. No database, because this site
 * has none and a throttle that needs one would not survive contact with a shared
 * host. The hash is there so the directory does not become a list of visitors'
 * IP addresses in plain text.
 *
 * Fails OPEN. If the directory cannot be created or written — read-only mount,
 * odd permissions — a real enquiry still gets through. A throttle that silently
 * eats leads is worse than one that occasionally misses a bot.
 */
function rate_limited(array $cfg): bool {
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if ($ip === '') return false;

    $dir = $cfg['rate_dir'];
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return false;

    $file = $dir . '/' . hash('sha256', $ip) . '.json';
    $now  = time();
    $long = (int) $cfg['rate_window_day'];

    $fh = @fopen($file, 'c+');
    if ($fh === false) return false;
    @flock($fh, LOCK_EX);

    $raw  = stream_get_contents($fh);
    $hits = json_decode($raw ?: '[]', true);
    if (!is_array($hits)) $hits = [];

    // drop anything outside the longest window, so the file cannot grow forever
    $hits = array_values(array_filter($hits, static fn($t) => is_int($t) && $t > $now - $long));

    $burst = count(array_filter($hits, static fn($t) => $t > $now - (int) $cfg['rate_window_burst']));
    $over  = $burst >= (int) $cfg['rate_max_burst'] || count($hits) >= (int) $cfg['rate_max_day'];

    // Count the attempt either way: hammering the endpoint extends the block
    // rather than being free.
    $hits[] = $now;
    @ftruncate($fh, 0);
    @rewind($fh);
    @fwrite($fh, json_encode($hits));
    @flock($fh, LOCK_UN);
    @fclose($fh);

    return $over;
}

if (rate_limited($cfg)) {
    // 429 with a human sentence — a real person hitting this is more likely to
    // have double-clicked than to be attacking anything, and the phone still works.
    respond_bad(
        'That is a few too many messages from this connection. Give it ten minutes, '
        . 'or call (303) 915-1045 and we will pick it up from there.',
        $wantsJson,
        429
    );
}

$need    = $field('need', 40);
$name    = $field('name', 200);
$email   = $field('email', 320);
$phone   = $field('phone', 60);
$town    = $field('town', 200);
$message = $field('message', 6000);

// Keys must match the radio values in contact/index.html AND the ?need= values the
// home page's three service cards link with. 'clearing' was added 2026-09-21: the
// site sells three services and this map only had two, so a land-clearing enquiry
// had nowhere to land. 'both' became 'multiple' at the same time — with three
// services "both" no longer says anything.
$needs = [
    // 'lawn' added 2026-10-03: the contact page's DEFAULT option since the aeration-led site
    // (2026-09-25), missing here, so most enquiries were arriving labelled just "Enquiry".
    'lawn'        => 'Lawn & turf care',
    'fire'        => 'Fire mitigation',
    'clearing'    => 'Land clearing',
    'landscaping' => 'Landscaping',
    'multiple'    => 'More than one service',
    'question'    => 'Question',
];
$needLabel = $needs[$need] ?? 'Enquiry';

$missing = [];
if ($name === '')  { $missing[] = 'a name'; }
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $missing[] = 'a valid email'; }
if ($phone === '') { $missing[] = 'a phone number'; }
if ($message === '') { $missing[] = 'a short message'; }
if ($missing) {
    respond_bad('Please include ' . implode(' and ', $missing) . '.', $wantsJson);
}

// Header-injection guard. EVERYTHING that reaches a mail header goes through
// this, which is what the previous version claimed and did not do: $name was
// stripped, $town was not, and $town lands in $title -> the Subject header.
// A town of "Monument\r\nBcc: someone@example.com" added a header to the
// outgoing mail. $email is safe by FILTER_VALIDATE_EMAIL, which rejects
// newlines, but it is stripped here too rather than resting on that.
$hdr = static fn(string $s): string => trim(preg_replace('/[\r\n\t]+/', ' ', $s));

/* capped at 80 for the Subject and Reply-To headers (second review): a long name in 4-byte
   characters could push a header line past the 998-character limit. The body keeps it whole. */
$safeName  = mb_substr($hdr($name), 0, 80);
$safeTown  = mb_substr($hdr($town), 0, 80);
$safeEmail = $hdr($email);

$title = $needLabel . ' — ' . $safeName . ($safeTown !== '' ? ' (' . $safeTown . ')' : '');

$lines = [
    'New enquiry: ' . $title,
    str_repeat('-', 40),
    'Need:    ' . $needLabel,
    'Name:    ' . $name,
    'Phone:   ' . $phone,
    'Email:   ' . $email,
];
if ($town !== '') { $lines[] = 'Town:    ' . $town; }
$lines[] = '';
$lines[] = $message;
$lines[] = '';
$lines[] = str_repeat('-', 40);
$lines[] = 'Sent ' . date('c')
    . ' — page ' . ($_SERVER['HTTP_REFERER'] ?? '?')
    . ' — IP ' . ($_SERVER['REMOTE_ADDR'] ?? '?');
$body = implode("\n", $lines);

// The door app's Leads screen (2026-10-03): the same lead, filed beside the door data and
// outside public_html, so it shows up in the app with a status. Only where sixfold-data
// exists (the host); a local checkout skips it. Never allowed to put the lead at risk.
$leadsHome = dirname(__DIR__, 2) . '/sixfold-data';
if (is_dir($leadsHome) && (is_dir($leadsHome . '/leads') || @mkdir($leadsHome . '/leads', 0750))) {
    @file_put_contents($leadsHome . '/leads/leads.log', json_encode([
        'id' => 'w' . date('YmdHis') . bin2hex(random_bytes(3)), 'src' => 'website', 'at' => time(),
        'need' => $needLabel, 'name' => $name, 'phone' => $phone, 'email' => $email, 'town' => $town, 'msg' => $message,
    ], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}

// Backup log first, so a mail() failure never loses the lead.
@file_put_contents(
    $cfg['log_file'],
    json_encode([
        'at' => date('c'), 'need' => $need, 'name' => $name, 'email' => $email,
        'phone' => $phone, 'town' => $town, 'message' => $message,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
    ], JSON_UNESCAPED_UNICODE) . "\n",
    FILE_APPEND | LOCK_EX
);

/**
 * Retention. The log holds names, emails, phone numbers and IP addresses, and
 * without this it keeps them forever — which is a growing liability for a file
 * whose only job is to survive a mail() failure.
 *
 * Pruned here rather than on a cron, because this site has no scheduler. It only
 * rewrites when something is actually old enough to drop, so the common case is
 * a read and nothing else. Anything unparseable is KEPT, not discarded: a line
 * this cannot read is exactly the line worth looking at by hand.
 */
$keepDays = (int) ($cfg['log_keep_days'] ?? 0);
if ($keepDays > 0 && is_readable($cfg['log_file'])) {
    $cut   = time() - $keepDays * 86400;
    $lines = @file($cfg['log_file'], FILE_IGNORE_NEW_LINES);
    if (is_array($lines)) {
        $keep = array_filter($lines, static function ($l) use ($cut) {
            if (trim($l) === '') return false;
            $row = json_decode($l, true);
            if (!is_array($row) || !isset($row['at'])) return true;   // unreadable: keep
            $t = strtotime((string) $row['at']);
            return $t === false || $t >= $cut;                        // undated: keep
        });
        if (count($keep) !== count($lines)) {
            @file_put_contents($cfg['log_file'], implode("\n", $keep) . "\n", LOCK_EX);
        }
    }
}

/**
 * Send, as of 2026-09-28, by authenticated SMTP to Gmail — not by mail().
 *
 * mail() worked in the sense that it always returned true and always failed to
 * deliver: SiteGround accepted the message and Google refused it downstream with
 * `550 High probability of spam`. See api/smtp.php for why that could not be
 * fixed with DNS, and DEPLOY.md for the record of what was tried.
 *
 * Reply-To is still the customer, so hitting reply in the inbox goes to them and
 * not to ourselves. That is the one header that has to survive this change.
 */
require_once __DIR__ . '/smtp.php';

$result = smtp_send(
    (array) ($cfg['smtp'] ?? []),
    $cfg['to'],
    $cfg['subject_prefix'] . $title,
    $body,
    [
        /* 2026-10-03 (review): "Smith, John" bare read as two addresses, and accented names went
           out as raw 8-bit header bytes. Plain ASCII: a quoted, escaped name. Anything else: the
           name alone as an encoded word, NOT quoted first, or mail clients show the quotes and
           backslashes literally (second review). Commas are safe inside an encoded word. */
        'Reply-To: ' . (preg_match('/[\x80-\xFF]/', $safeName)
            ? mb_encode_mimeheader($safeName, 'UTF-8', 'B', "\r\n")
            : '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $safeName) . '"') . ' <' . $safeEmail . '>',
        'X-Mailer: sixfold-site',
    ]
);

/**
 * ⚑ Record what actually happened to the send. This replaces the 2026-09-21
 * "mail_accepted" line, which could only ever say true or false and said true
 * for a week while nothing was being delivered.
 *
 * `stage` is the improvement. mail() returning true meant "SiteGround took it"
 * and nothing more — the real failure was two hops further on and invisible from
 * here. Now the log carries the point it reached and Google's own words for why
 * it stopped, so a future failure is read rather than guessed at:
 *
 *   "stage":"config"   — secrets.php has no app password in it yet
 *   "stage":"connect"  — outbound 587 blocked by the host. SiteGround ticket
 *   "stage":"auth"     — app password wrong, revoked, or 2SV turned back off
 *   "stage":"data"     — Google took the envelope and refused the message
 *   "stage":"sent"     — accepted. Google owns delivery from here
 *
 * Still a second line rather than folding it into the first, for the same reason
 * as before: the lead is written BEFORE any sending is attempted, and nothing in
 * the send path is allowed to put that at risk.
 */
@file_put_contents(
    $cfg['log_file'],
    json_encode([
        'at'    => date('c'),
        'sent'  => (bool) $result['ok'],
        'stage' => $result['stage'],
        // Truncated: an SMTP rejection can be verbose and this is a log line,
        // not a transcript. The first 400 characters carry the reply code and
        // the reason every time.
        'error' => mb_substr((string) $result['error'], 0, 400),
        'to'    => $cfg['to'],
        'from'  => $cfg['smtp']['user'] ?? null,
    ], JSON_UNESCAPED_UNICODE) . "\n",
    FILE_APPEND | LOCK_EX
);

// Report success either way: the customer should not be told to try again for a
// delivery problem that is ours to fix from the log.
respond_ok($cfg, $wantsJson);
