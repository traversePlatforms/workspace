<?php
/**
 * Sixfold Colorado — form handler configuration.
 *
 * Same shape as the Surge site's api/config.php, minus uploads (nothing on the
 * Sixfold form takes a file). Edit for the live host. Nothing secret lives here.
 *
 * NOT HOSTED YET. Until SixfoldColorado.com resolves, this file is a draft on
 * disk and the dev server (serve.mjs) answers /api/submit.php by logging instead.
 */
return [
    // Where submissions are emailed.
    'to'             => 'Contact@SixfoldColorado.com',

    // Envelope/From. For deliverability this MUST be a real mailbox or alias on
    // SixfoldColorado.com — create website@SixfoldColorado.com on the host, or
    // mail from a Sixfold address will be treated as forged and land in spam.
    'from'           => 'website@SixfoldColorado.com',

    'subject_prefix' => '[SixfoldColorado.com] ',

    // Plain-text backup of every submission, one JSON line each. Lives next to
    // this file; .htaccess blocks it from being served.
    'log_file'       => __DIR__ . '/submissions.log',

    // Where a no-JavaScript submit is redirected on success.
    'thank_you'      => '/thank-you/',

    // --- rate limit -----------------------------------------------------
    // Per-IP throttle. The honeypot catches lazy bots; this catches the rest,
    // and it is what stops one script filling the inbox and the log overnight.
    // Two windows, because they stop different things: the short one stops a
    // burst, the long one stops a slow drip that would sit under it all day.
    'rate_max_burst' => 3,        // submissions per rate_window_burst
    'rate_window_burst' => 600,   // 10 minutes
    'rate_max_day'   => 12,       // submissions per rate_window_day
    'rate_window_day' => 86400,   // 24 hours

    // Where the throttle keeps its counters. Same directory as the log, so the
    // same .htaccess rule covers it.
    'rate_dir'       => __DIR__ . '/.ratelimit',

    // --- retention ------------------------------------------------------
    // submissions.log is personal data — names, emails, phone numbers and IPs.
    // Lines older than this are dropped when the log is next written, so the
    // backup stays a backup and does not become an indefinite archive.
    // Set to 0 to keep everything.
    'log_keep_days'  => 180,
];
