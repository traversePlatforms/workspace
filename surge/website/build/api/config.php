<?php
/**
 * Surge form handler — configuration.
 * Edit these values for the live site, then keep this file out of version control
 * if it ever holds anything sensitive. Nothing secret is required here.
 */
return [
    // Where submissions are emailed.
    'to'             => 'info@surgeftw.com',

    // Envelope/From address. For deliverability this MUST be a real mailbox or
    // alias on surgeftw.com (create website@surgeftw.com in Site Tools → Email).
    // If mail lands in spam, switch to SMTP or a service like Formspree — see
    // DEPLOY.md, "Forms".
    'from'           => 'website@surgeftw.com',

    'subject_prefix' => '[surgeftw.com] ',

    // Plain-text backup of every submission, one JSON line each. Lives next to
    // this file; .htaccess blocks it from being served. Rotate/clear as needed.
    'log_file'       => __DIR__ . '/submissions.log',

    // File uploads: a resume on the applicant form, an optional document on the
    // client form. The directory must exist and be writable by PHP;
    // api/uploads/.htaccess denies web access and disables execution. Retrieve
    // files by SFTP / File Manager. A failed upload never blocks the submission
    // — it is flagged in the notification instead.
    'upload_dir'      => __DIR__ . '/uploads',
    'max_upload'      => 5 * 1024 * 1024,           // 5 MB — applicant resume
    'allowed_ext'     => ['pdf', 'doc', 'docx'],
    'max_upload_doc'  => 10 * 1024 * 1024,          // 10 MB — client attachment
    'allowed_ext_doc' => ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'png', 'jpg', 'jpeg'],

    // Where a no-JavaScript submit is redirected on success.
    'thank_you'      => '/thank-you/',
];
