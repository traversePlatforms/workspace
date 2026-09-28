<?php
/**
 * Sixfold Colorado — minimal authenticated SMTP client.
 *
 * WHY THIS EXISTS
 * ---------------
 * PHP's mail() hands the message to SiteGround's own mail server, which then has
 * to convince Google to accept mail claiming to be from a domain whose mailboxes
 * live at Google. It never managed it. Every submission from 2026-09-21 onward
 * logged "mail_accepted":true and was then refused by Google with
 * `550 High probability of spam` — a spam SCORE, not a single failed check, so
 * there was no one record to add to DNS that would fix it.
 *
 * This sends through Gmail instead, logged in as the mailbox itself. Google is
 * then the sender rather than an outsider claiming to be us, which removes the
 * whole problem at once: SPF already authorises Google, DKIM signing happens on
 * Google's side automatically, and the "external server, our domain" shape that
 * was driving the spam score no longer exists.
 *
 * WHY NOT PHPMailer
 * -----------------
 * It would work. It is also a vendored third-party library to keep updated, for
 * one fixed message shape sent a few times a week. This is ~120 lines doing
 * exactly that one job, and every byte of it is readable in one sitting.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * Attachments, HTML bodies, multiple recipients, connection reuse, queueing.
 * None of those are wanted here, and each one is a way to get this wrong.
 *
 * ⚑ It NEVER throws and NEVER emits output. The caller has already written the
 *    lead to submissions.log by the time this runs, and nothing here is allowed
 *    to jeopardise that or to leak a stack trace to the customer. Every failure
 *    comes back as a return value.
 */
declare(strict_types=1);

/**
 * Encode a header value that may contain non-ASCII.
 *
 * The subject line genuinely does: it is built as "<need> — <name>", with a real
 * UTF-8 em-dash in the middle. mail() was being handed that raw, which is not a
 * conformant header and is one more thing for a spam filter to notice.
 */
function smtp_mime_header(string $s): string {
    return preg_match('/[\x80-\xFF]/', $s)
        ? '=?UTF-8?B?' . base64_encode($s) . '?='
        : $s;
}

/**
 * Send one plain-text message.
 *
 * @param array $smtp  host, port, user, pass, from_name, timeout, ehlo
 * @param array $extraHeaders  additional raw header lines (Reply-To, X-Mailer)
 * @return array{ok:bool,stage:string,error:string}
 *
 * `stage` is the point it got to, and it is the whole diagnostic value of this
 * file. Each one means something different and points somewhere different:
 *
 *   connect  — could not open the socket at all. Most likely SiteGround blocking
 *              outbound port 587, which is a support ticket, not a code fix.
 *   starttls — connected but could not negotiate TLS. Host OpenSSL problem.
 *   auth     — Google refused the login. Wrong app password, or the app password
 *              was revoked, or 2SV was turned back off.
 *   from/to  — Google refused the envelope. Address wrong or mailbox suspended.
 *   data     — accepted the envelope, refused the message. Back to spam scoring,
 *              and this time the reply text says why.
 *   sent     — accepted. Google now owns delivery.
 */
function smtp_send(array $smtp, string $to, string $subject, string $body, array $extraHeaders = []): array {
    $host    = (string) ($smtp['host'] ?? '');
    $port    = (int)    ($smtp['port'] ?? 587);
    $user    = (string) ($smtp['user'] ?? '');
    $pass    = (string) ($smtp['pass'] ?? '');
    $timeout = (int)    ($smtp['timeout'] ?? 15);
    $ehlo    = (string) ($smtp['ehlo'] ?? 'localhost');

    $fail = static fn(string $stage, string $error): array =>
        ['ok' => false, 'stage' => $stage, 'error' => $error];

    if ($host === '' || $user === '' || $pass === '') {
        return $fail('config', 'smtp host, user or pass is empty — see api/secrets.php');
    }

    $fp = @stream_socket_client(
        'tcp://' . $host . ':' . $port,
        $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT
    );
    if (!$fp) {
        return $fail('connect', trim($errno . ' ' . $errstr));
    }
    stream_set_timeout($fp, $timeout);

    /**
     * Read one SMTP reply, which may be several lines. A continuation line has a
     * hyphen in the 4th character ("250-STARTTLS"); the final one has a space
     * ("250 OK"). Reading only the first line is the classic way to desynchronise
     * a hand-rolled SMTP client and then misreport what the server said.
     */
    $read = static function () use ($fp): array {
        $lines = [];
        while (true) {
            $line = @fgets($fp, 2048);
            if ($line === false) {
                $meta = stream_get_meta_data($fp);
                return [0, !empty($meta['timed_out']) ? 'timed out waiting for reply' : 'connection closed'];
            }
            $lines[] = rtrim($line, "\r\n");
            if (strlen($line) < 4 || $line[3] !== '-') { break; }
        }
        $last = (string) end($lines);
        return [(int) substr($last, 0, 3), implode(' | ', $lines)];
    };
    $write = static function (string $cmd) use ($fp): void { @fwrite($fp, $cmd . "\r\n"); };
    $quit  = static function () use ($fp): void { @fwrite($fp, "QUIT\r\n"); @fclose($fp); };

    [$code, $reply] = $read();
    if ($code !== 220) { $quit(); return $fail('greeting', $reply); }

    $write('EHLO ' . $ehlo);
    [$code, $reply] = $read();
    if ($code !== 250) { $quit(); return $fail('ehlo', $reply); }

    $write('STARTTLS');
    [$code, $reply] = $read();
    if ($code !== 220) { $quit(); return $fail('starttls', $reply); }

    // TLS 1.2 and 1.3 where the host has them. STREAM_CRYPTO_METHOD_TLS_CLIENT
    // alone has historically meant TLS 1.0 on some builds, which Google refuses.
    $crypto = STREAM_CRYPTO_METHOD_TLS_CLIENT;
    if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) { $crypto |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT; }
    if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) { $crypto |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT; }
    if (@stream_socket_enable_crypto($fp, true, $crypto) !== true) {
        $quit();
        return $fail('starttls', 'TLS negotiation failed');
    }

    // EHLO again: the server's capability list is re-issued after TLS and the
    // pre-TLS one is not to be trusted.
    $write('EHLO ' . $ehlo);
    [$code, $reply] = $read();
    if ($code !== 250) { $quit(); return $fail('ehlo-tls', $reply); }

    $write('AUTH LOGIN');
    [$code, $reply] = $read();
    if ($code !== 334) { $quit(); return $fail('auth', $reply); }
    $write(base64_encode($user));
    [$code, $reply] = $read();
    if ($code !== 334) { $quit(); return $fail('auth', $reply); }
    $write(base64_encode($pass));
    [$code, $reply] = $read();
    if ($code !== 235) { $quit(); return $fail('auth', $reply); }

    $write('MAIL FROM:<' . $user . '>');
    [$code, $reply] = $read();
    if ($code !== 250) { $quit(); return $fail('from', $reply); }

    $write('RCPT TO:<' . $to . '>');
    [$code, $reply] = $read();
    if ($code !== 250 && $code !== 251) { $quit(); return $fail('to', $reply); }

    $write('DATA');
    [$code, $reply] = $read();
    if ($code !== 354) { $quit(); return $fail('data', $reply); }

    $eol      = "\r\n";
    $fromName = (string) ($smtp['from_name'] ?? '');
    $domain   = substr(strrchr($user, '@') ?: '@localhost', 1);

    $headers = [
        'Date: ' . date('r'),
        'From: ' . ($fromName !== '' ? smtp_mime_header($fromName) . ' ' : '') . '<' . $user . '>',
        'To: ' . $to,
        'Subject: ' . smtp_mime_header($subject),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        // base64 rather than 8bit: it cannot produce an over-long line, cannot
        // produce a line that starts with a dot, and cannot be mangled by any
        // hop that is not 8-bit clean. The body is a few hundred bytes.
        'Content-Transfer-Encoding: base64',
    ];
    foreach ($extraHeaders as $h) {
        $h = trim(preg_replace('/[\r\n]+/', ' ', (string) $h));
        if ($h !== '') { $headers[] = $h; }
    }

    $payload = implode($eol, $headers) . $eol . $eol
             . chunk_split(base64_encode($body), 76, $eol);

    // Dot-stuffing. base64 output can never begin a line with a dot, so this is
    // belt and braces — but a bare "." on its own line ends DATA early and
    // truncates the message, and that is not a failure mode worth risking.
    $payload = preg_replace('/^\./m', '..', $payload);

    @fwrite($fp, $payload . $eol . '.' . $eol);
    [$code, $reply] = $read();
    $quit();

    return $code === 250
        ? ['ok' => true, 'stage' => 'sent', 'error' => '']
        : $fail('data', $reply);
}
