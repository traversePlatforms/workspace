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
];
