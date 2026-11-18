<?php
/* traverseplatforms.com/go/<code> (2026-11-18, Matthew: "I want tracked links built into the plain traverse prospects emails").
 * Each web address in a Prospect Desk email is one of these. The desk looks the code up in its links.log, logs the click (or a mail
 * scanner's visit), and forwards to the page. Source traverse/prospect-desk/go/; it goes up as public_html/go/. DESK_FOLDER is for
 * the test harness only (the live desk folder is prospects-47bfe6, as in ../.public-path). */
$c = (string) ($_GET['c'] ?? '');
if ($c === '') $c = basename((string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH));   /* php -S, or no rewrite */
$_GET = ['action' => 'link', 'c' => $c];
require __DIR__ . '/../' . (getenv('DESK_FOLDER') ?: 'prospects-47bfe6') . '/api/desk.php';
