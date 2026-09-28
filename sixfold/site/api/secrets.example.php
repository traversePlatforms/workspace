<?php
/**
 * Template for api/secrets.php — copy it, fill it in, never commit the copy.
 *
 * secrets.php is the ONLY file in this site that holds a live credential, and it
 * is gitignored. This example is the tracked version so the shape is not lost.
 *
 * ⚑ It IS uploaded to the server. make-bundle.mjs allows `.php`, so the real
 *   secrets.php ships with every bundle — which is what we want, since the form
 *   cannot send without it. `api/.htaccess` already blocks the directory from
 *   being served, and .php would be executed rather than printed in any case.
 *
 * To produce the app password:
 *   1. Sign in as Contact@SixfoldColorado.com
 *   2. myaccount.google.com -> Security -> 2-Step Verification -> on
 *      (take the backup codes: this is the tenant's only super admin)
 *   3. Same page -> App passwords -> create, named "Sixfold website"
 *   4. Paste the 16 characters below. Google shows them once.
 *
 * Spaces in the app password are cosmetic — Google displays it in groups of
 * four. Strip them or leave them; the code strips whitespace either way.
 */
return [
    'smtp_pass' => 'xxxxxxxxxxxxxxxx',
];
