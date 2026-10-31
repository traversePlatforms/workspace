<?php
/* Connect Jobber for Setup › Sync from another system: the address Jobber sends a company's admin back to (TR-46, 2026-10-31). One file for
 * every install on this server (the five editions and the client installs); the install is named inside the signed state. All of it is in
 * jobber-lib.php (jbCallback): state signature, age and single use, the browser cookie, the code swapped for tokens with the PKCE verifier,
 * the account named, the tokens kept sealed in that install's private folder. Then back to the app's page, which opens Setup › Sync from
 * another system. Nothing here ever prints a token.
 * Register this address as the app's OAuth Callback URL in Jobber's Developer Center: https://traverseplatforms.com/api/jobber-oauth.php */
declare(strict_types=1);
header('Cache-Control: no-store'); header('X-Robots-Tag: noindex'); header('Referrer-Policy: no-referrer');
require __DIR__ . '/jobber-lib.php';
$r = jbCallback($_GET, $_COOKIE);
if ($r['cookie'] !== '') setcookie($r['cookie'], '', ['expires' => time() - 3600, 'path' => '/api/jobber-oauth.php', 'httponly' => true, 'samesite' => 'Lax', 'secure' => ($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off']);
if ($r['back'] === '') { http_response_code(400); header('Content-Type: text/plain; charset=utf-8'); echo $r['msg']; exit; }
header('Location: ' . $r['back'] . '?jobber=' . rawurlencode($r['msg']), true, 302);
