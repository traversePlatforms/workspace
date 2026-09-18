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

$field = static fn(string $k, int $max = 2000): string =>
    mb_substr(trim((string) ($_POST[$k] ?? '')), 0, $max);

// Honeypot: a filled field means a bot. Say yes and do nothing.
if ($field('_hp') !== '') {
    respond_ok($cfg, $wantsJson);
}

$need    = $field('need', 40);
$name    = $field('name', 200);
$email   = $field('email', 320);
$phone   = $field('phone', 60);
$town    = $field('town', 200);
$message = $field('message', 6000);

$needs = [
    'fire'        => 'Fire mitigation',
    'landscaping' => 'Landscaping',
    'both'        => 'Fire mitigation + landscaping',
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

// Header-injection guard: nothing user-supplied goes into a mail header unescaped.
$safeName = str_replace(["\r", "\n"], ' ', $name);

$title = $needLabel . ' — ' . $safeName . ($town !== '' ? ' (' . $town . ')' : '');

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

$headers = implode("\r\n", [
    'From: Sixfold Colorado website <' . $cfg['from'] . '>',
    'Reply-To: ' . $safeName . ' <' . $email . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'X-Mailer: sixfold-site',
]);

$sent = @mail($cfg['to'], $cfg['subject_prefix'] . $title, $body, $headers);

// Logged either way; report success so the customer is not told to try again
// for a delivery problem that is ours to fix from the log.
respond_ok($cfg, $wantsJson);
