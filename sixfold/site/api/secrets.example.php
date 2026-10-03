<?php
/**
 * Template for api/secrets.php — copy it, fill it in, never commit the copy.
 *
 * secrets.php is the ONLY file in this site that holds a live credential, and it
 * is gitignored. This example is the tracked version so the shape is not lost.
 *
 * ⚑ WHERE IT GOES (changed 2026-10-03, SX-9e): in `sixfold-private/secrets.php`, the folder
 *   BESIDE public_html (same level as sixfold-data/) — never inside public_html. A .php file
 *   inside public_html is protected only by PHP executing it. make-bundle.mjs refuses to ship
 *   secrets.php; api/config.php reads the private copy first.
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
