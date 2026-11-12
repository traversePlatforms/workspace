<?php
/**
 * Surge site — form handler for /contact/, /book/ and the applicant form.
 * One endpoint for all of them; the `_form` field says which.
 *
 * - Honeypot field `_hp` must stay empty (bots fill it) -> silent success.
 * - Required: name + valid email (+ message, except on the booking form).
 * - JS submits get JSON back; plain submits get a 303 redirect to /thank-you/.
 * - Every accepted submission is appended to submissions.log as a backup.
 */
declare(strict_types=1);

$cfg = require __DIR__ . '/config.php';

function wants_json(): bool {
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $xrw    = strtolower($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '');
    return stripos($accept, 'application/json') !== false || $xrw === 'xmlhttprequest';
}

function finish(bool $ok, string $message, array $cfg, int $code = 200): void {
    if (wants_json()) {
        http_response_code($ok ? 200 : $code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'error' => $ok ? null : $message]);
    } elseif ($ok) {
        header('Location: ' . $cfg['thank_you'], true, 303);
    } else {
        http_response_code($code);
        header('Content-Type: text/plain; charset=utf-8');
        echo $message . "\n\nPlease go back and try again, or call 720-719-5495.";
    }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    finish(false, 'Method not allowed.', $cfg, 405);
}

// Honeypot: pretend it worked, send nothing.
if (trim((string) ($_POST['_hp'] ?? '')) !== '') {
    finish(true, '', $cfg);
}

$field = static function (string $key, int $max = 2000): string {
    $v = trim((string) ($_POST[$key] ?? ''));
    $v = str_replace("\0", '', $v);
    return mb_substr($v, 0, $max);
};
$oneLine = static fn (string $s): string => trim((string) preg_replace('/[\r\n\t]+/', ' ', $s));

$form    = preg_replace('/[^a-z-]/', '', strtolower($field('_form', 20))) ?: 'contact';
$name    = $oneLine($field('name', 120));
$email   = $oneLine($field('email', 160));
$phone   = $oneLine($field('phone', 60));
$company = $oneLine($field('company', 160));
$message = $field('message', 4000);

$missing = [];
if ($name === '') {
    $missing[] = 'a name';
}
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $missing[] = 'a valid email';
}
if ($message === '' && $form !== 'book') {
    $missing[] = 'a short message';
}
// 'book' added 2026-09-11 — the Book form now carries the same two consent
// checkboxes as both Contact forms, so the server gates on them too.
if ($form === 'job' || $form === 'client' || $form === 'book') {
    if (trim((string) ($_POST['contact_ok'] ?? '')) === '') {
        $missing[] = 'your agreement to be contacted';
    }
    if (trim((string) ($_POST['accurate'] ?? '')) === '') {
        $missing[] = 'confirmation that your details are accurate';
    }
}
if ($form === 'client' && trim((string) ($_POST['timeline'] ?? '')) === '') {
    $missing[] = 'a rough timeline';
}
if ($missing) {
    finish(false, 'Please include ' . implode(' and ', $missing) . '.', $cfg, 422);
}

$titles = [
    'contact'  => 'Contact form',
    'client'   => 'Client enquiry',
    'job'      => 'Job applicant',
    'book'     => 'Consultation request',
    'feedback' => 'Feedback or question',
];
$title = $titles[$form] ?? 'Website form';

// `topic` added 2026-09-11 for the feedback form's subject select.
$extra = [];
foreach (['role', 'title', 'start', 'links', 'timeline', 'heard', 'format', 'channel', 'date', 'time', 'topic'] as $k) {
    $v = $oneLine($field($k, 200));
    if ($v !== '') {
        $extra[$k] = $v;
    }
}

/**
 * Save one uploaded file safely, or say why it was not saved. Never throws — a
 * bad or missing upload is reported to the recipient, it does not block the
 * submission. Returns [human-readable note, stored filename or ''].
 */
function save_upload(array $cfg, string $key, array $exts, int $max): array {
    $up  = $_FILES[$key] ?? null;
    $err = (is_array($up) && !is_array($up['error'] ?? null)) ? ($up['error'] ?? UPLOAD_ERR_NO_FILE) : UPLOAD_ERR_NO_FILE;
    if (!is_array($up) || $err === UPLOAD_ERR_NO_FILE) {
        return ['(none attached)', ''];
    }
    if ($err !== UPLOAD_ERR_OK || !is_uploaded_file((string) $up['tmp_name'])) {
        return ['(upload failed — ask them to email it)', ''];
    }
    if ((int) $up['size'] > $max) {
        return ['(over ' . (int) round($max / 1048576) . ' MB — not saved)', ''];
    }
    $ext  = strtolower(pathinfo((string) $up['name'], PATHINFO_EXTENSION));
    $mime = '';
    if (function_exists('finfo_open') && ($fi = finfo_open(FILEINFO_MIME_TYPE))) {
        $mime = (string) finfo_file($fi, (string) $up['tmp_name']);
        finfo_close($fi);
    }
    $okMime = [
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv', 'image/png', 'image/jpeg',
        'application/zip', 'application/octet-stream', '',
    ];
    if (!in_array($ext, $exts, true) || !in_array($mime, $okMime, true)) {
        return ['(rejected — file type not accepted)', ''];
    }
    if (!is_dir($cfg['upload_dir'])) {
        @mkdir($cfg['upload_dir'], 0755, true);
    }
    $stored = date('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.' . $ext;
    if (is_dir($cfg['upload_dir'])
        && @move_uploaded_file((string) $up['tmp_name'], $cfg['upload_dir'] . '/' . $stored)) {
        return [$stored . '  (api/uploads/ — fetch by SFTP / File Manager)', $stored];
    }
    return ['(received but could not be saved — check folder permissions)', ''];
}

// Résumé on the applicant form, an optional document on the client form. A bad
// or missing upload is noted for the recipient but never blocks the submission.
$resumeNote = '(none)';
$resumeStored = '';
$docNote = '(none)';
$docStored = '';
if ($form === 'job') {
    [$resumeNote, $resumeStored] = save_upload($cfg, 'resume', (array) $cfg['allowed_ext'], (int) $cfg['max_upload']);
}
if ($form === 'client') {
    [$docNote, $docStored] = save_upload($cfg, 'document', (array) $cfg['allowed_ext_doc'], (int) $cfg['max_upload_doc']);
}

// 2026-11-11 (Matthew): the file goes to info@ as an attachment, named after the person, so the team opens it straight from the email.
// It is still kept in api/uploads/ as a backup copy.
$attach = [];
$friendly = function (string $label, string $stored) use ($name): string {
    $who = trim(preg_replace('/[^A-Za-z0-9 .\'-]+/', '', $name)) ?: 'applicant';
    return $label . ' - ' . mb_substr($who, 0, 60) . '.' . strtolower(pathinfo($stored, PATHINFO_EXTENSION));
};
if ($resumeStored !== '') {
    $attach[] = [$cfg['upload_dir'] . '/' . $resumeStored, $friendly('Resume', $resumeStored)];
    $resumeNote = 'attached: ' . end($attach)[1] . '  (also kept on the server as ' . $resumeStored . ')';
}
if ($docStored !== '') {
    $attach[] = [$cfg['upload_dir'] . '/' . $docStored, $friendly('Document', $docStored)];
    $docNote = 'attached: ' . end($attach)[1] . '  (also kept on the server as ' . $docStored . ')';
}

$lines = ['New: ' . $title, str_repeat('-', 40), 'Name:    ' . $name, 'Email:   ' . $email];
if ($phone !== '') {
    $lines[] = 'Phone:   ' . $phone;
}
if ($company !== '') {
    $lines[] = 'Company: ' . $company;
}
foreach ($extra as $k => $v) {
    $lines[] = str_pad(ucfirst($k) . ':', 9) . $v;
}
if ($form === 'job') {
    $lines[] = 'Resume:  ' . $resumeNote;
}
if ($form === 'client') {
    $lines[] = 'File:    ' . $docNote;
}
$lines[] = '';
$lines[] = $message !== '' ? $message : '(no message)';
$lines[] = '';
$lines[] = str_repeat('-', 40);
$lines[] = 'Sent ' . date('c')
    . ' — page ' . ($_SERVER['HTTP_REFERER'] ?? '?')
    . ' — IP ' . ($_SERVER['REMOTE_ADDR'] ?? '?');
$body = implode("\n", $lines);

@file_put_contents(
    $cfg['log_file'],
    date('c') . "\t" . json_encode(
        compact('form', 'name', 'email', 'phone', 'company', 'extra', 'message', 'resumeStored', 'docStored'),
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    ) . "\n",
    FILE_APPEND | LOCK_EX
);

// 2026-11-12 (review fix): a name with a comma or a quote ("Smith, John") used to break the Reply-To header,
// so it is quoted, and a name with accents is MIME-encoded.
$replyName = trim(str_replace(['"', '\\'], '', $name));
$replyName = preg_match('/[^\x20-\x7E]/', $replyName)
    ? mb_encode_mimeheader($replyName, 'UTF-8', 'B', "\r\n")
    : '"' . $replyName . '"';
$headBase = [
    'From: Surge website <' . $cfg['from'] . '>',
    'Reply-To: ' . $replyName . ' <' . $email . '>',
    'X-Mailer: surge-site',
];
$head = $headBase;
$mime = ['pdf' => 'application/pdf', 'doc' => 'application/msword', 'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls' => 'application/vnd.ms-excel', 'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt' => 'application/vnd.ms-powerpoint', 'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'csv' => 'text/csv', 'txt' => 'text/plain', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg'];
$parts = [];
foreach ($attach as [$path, $fname]) {
    $data = @file_get_contents($path);
    if ($data === false) {
        continue;
    }
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $parts[] = [$mime[$ext] ?? 'application/octet-stream', $fname, $data];
}
if ($parts) {
    $bnd = 'surge-' . bin2hex(random_bytes(12));
    $head[] = 'MIME-Version: 1.0';
    $head[] = 'Content-Type: multipart/mixed; boundary="' . $bnd . '"';
    // 2026-11-12 (review fix): the body uses plain \n. The server's mail program turns each \n into \r\n itself,
    // so the earlier \r\n arrived as \r\r\n (doubled line breaks in some mail apps).
    $mailBody = "--$bnd\nContent-Type: text/plain; charset=utf-8\nContent-Transfer-Encoding: 8bit\n\n" . $body . "\n";
    foreach ($parts as [$type, $fname, $data]) {
        $enc = '=?UTF-8?B?' . base64_encode($fname) . '?=';
        $mailBody .= "--$bnd\nContent-Type: $type; name=\"$enc\"\nContent-Transfer-Encoding: base64\nContent-Disposition: attachment; filename=\"$enc\"\n\n"
            . chunk_split(base64_encode($data), 76, "\n") . "\n";
    }
    $mailBody .= "--$bnd--\n";
} else {
    $head[] = 'Content-Type: text/plain; charset=utf-8';
    $mailBody = $body;
}
$headers = implode("\r\n", $head);

$sent = @mail($cfg['to'], $cfg['subject_prefix'] . $title, $mailBody, $headers);

// 2026-11-12 (review fix): if the email with the file attached fails (too big for the mail server, a rejected
// file type), send it again without the attachment, so the enquiry still reaches the inbox. The file stays in api/uploads/.
if (!$sent && $parts) {
    $kept = implode(', ', array_filter([$resumeStored, $docStored]));
    $plain = $body . "\n\n(The attached file could not be emailed. It is saved on the server in api/uploads/ as " . $kept . ".)";
    $sent = @mail($cfg['to'], $cfg['subject_prefix'] . $title, $plain, implode("\r\n", array_merge($headBase, ['Content-Type: text/plain; charset=utf-8'])));
}

// Logged above either way, so a mail failure never loses the enquiry.
finish($sent, $sent ? '' : "We couldn't send that just now.", $cfg, $sent ? 200 : 502);
