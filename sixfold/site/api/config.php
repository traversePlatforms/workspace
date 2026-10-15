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
// The one live credential, kept out of git. Missing file is not fatal: the form
// still logs every lead and simply records that it could not send.
// SX-9e (2026-10-03): kept ABOVE public_html in sixfold-private/; the copy beside this file is
// read only during the changeover and is then deleted from the host. make-bundle.mjs no longer
// ships it.
$secretsPath = dirname(__DIR__, 2) . '/sixfold-private/secrets.php';
if (!is_readable($secretsPath)) $secretsPath = __DIR__ . '/secrets.php';
$secrets = is_readable($secretsPath) ? (array) (require $secretsPath) : [];

return [
    // Where submissions are emailed.
    'to'             => 'Contact@SixfoldColorado.com',

    // Envelope/From. Changed 2026-09-21 from website@SixfoldColorado.com, which
    // was an instruction rather than a fact — nothing had ever created it, and
    // mail from an address that does not exist is a spam signal in its own right.
    //
    // Contact@ already exists, so the form now sends from the same address it
    // sends TO. That is normal for a contact form and costs nothing: Reply-To is
    // still the customer, so hitting reply goes to them, not to ourselves.
    //
    // A website@ alias in Google Workspace would also have worked — aliases are
    // free — but it is one more thing to create and keep straight for no gain.
    //
    // ⚑ RESOLVED 2026-09-28. The note that stood here said this did not fix SPF
    // and that the form had to move to authenticated SMTP through Google. It has.
    // See the 'smtp' block below — the message no longer leaves SiteGround's mail
    // server at all, so the SPF/spoofing problem this address once had is gone.
    'from'           => 'Contact@SixfoldColorado.com',

    'subject_prefix' => '[SixfoldColorado.com] ',

    // --- sending ---------------------------------------------------------
    // Authenticated SMTP to Gmail, as the mailbox itself. Replaces PHP mail(),
    // which handed the message to SiteGround and had it refused by Google with
    // `550 High probability of spam` every time between 2026-09-21 and 09-28.
    //
    // Nothing here is secret except the password, which lives in secrets.php.
    // 'user' is both the login and the envelope sender; Gmail will not let the
    // From differ from the authenticated account except for a registered alias,
    // so m.sharpe@ (an alias on this same account) is deliberately NOT used.
    'smtp' => [
        'host'      => 'smtp.gmail.com',
        'port'      => 587,
        'user'      => 'Contact@SixfoldColorado.com',
        // Whitespace stripped: Google displays app passwords in groups of four.
        'pass'      => preg_replace('/\s+/', '', (string) ($secrets['smtp_pass'] ?? '')),
        'from_name' => 'Sixfold Colorado website',
        'timeout'   => 15,
        // What the server announces itself as. Cosmetic to Gmail, which trusts
        // the login and not this, but a real name is better than "localhost".
        'ehlo'      => 'sixfoldcolorado.com',
    ],

    // Plain-text backup of every submission, one JSON line each. Lives next to
    // this file; .htaccess blocks it from being served.
    'log_file'       => __DIR__ . '/submissions.log',

    // The app's Pipeline (2026-10-14): each lead is posted to traverseplatforms.com with this key. Kept in secrets.php.
    'app_lead_key'   => (string) ($secrets['app_lead_key'] ?? ''),
    'app_lead_url'   => (string) ($secrets['app_lead_url'] ?? 'https://traverseplatforms.com/api/rounds.php?action=sitelead'),   /* the override is for the test copy only */

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
