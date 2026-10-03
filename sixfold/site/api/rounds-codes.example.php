<?php
/**
 * Template for sixfold-private/rounds-codes.php (the folder BESIDE public_html, SX-9e) — copy it, fill it in, never commit the copy.
 *
 * Same arrangement as secrets.php: the real file is gitignored and this tracked
 * example keeps the shape. It holds the sign-in codes for /rounds/ and the key
 * that signs session cookies.
 *
 * ⚑ EVERY CODE IS A KEY TO 2,656 HOME ADDRESSES. Treat this file like a password
 * list, because that is what it is.
 *
 * Roles:
 *   'crew'  — signs in, marks doors. Sees neighbourhoods and doors, nothing else.
 *   'admin' — all of the above, plus who marked what, the totals, and the export.
 *
 * To add someone: one line. To remove someone: delete their line. Their marks
 * stay in the log under their name; only their way in disappears.
 */
return [
    // Signs the session cookie. ANY long random string; changing it signs
    // everybody out, which is the emergency lever if a code gets loose.
    // Generate one with:  php -r "echo bin2hex(random_bytes(32));"
    'session_key' => 'REPLACE-WITH-64-RANDOM-HEX-CHARACTERS',

    // How long a sign-in lasts before the code must be typed again.
    'session_days' => 45,

    // The people. Codes are six digits so they can be typed on a phone keypad
    // at a front gate; they are checked server-side and rate-limited, so six
    // digits is enough here and a password would be worse — a crew member
    // cannot forget a code they keep in their wallet.
    'people' => [
        // code      => [name, role]
        '000000'     => ['Example Person', 'crew'],
    ],
];
