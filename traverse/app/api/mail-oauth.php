<?php
/* Sign in with Google / Microsoft for Setup › Email: the address both send a company's admin back to (2026-10-30). One file for every install
 * on this server (the five editions and the client installs); the install is named inside the signed state. All of it is in
 * mail-oauth-lib.php (moCallback): state signature, age and single use, the browser cookie, PKCE, the code swapped for tokens, the scope and
 * address checked, the refresh token kept encrypted in that install's private folder. Then back to the app's page, which opens Setup › Email.
 * Nothing here ever prints a token.
 * Register this address with Google (Web client) and Microsoft (Entra app, Web platform): https://traverseplatforms.com/api/mail-oauth.php */
declare(strict_types=1);
header('Cache-Control: no-store'); header('X-Robots-Tag: noindex'); header('Referrer-Policy: no-referrer');
require __DIR__ . '/mail-oauth-lib.php';
$r = moCallback($_GET, $_COOKIE);
if ($r['cookie'] !== '') setcookie($r['cookie'], '', ['expires' => time() - 3600, 'path' => '/api/mail-oauth.php', 'httponly' => true, 'samesite' => 'Lax', 'secure' => ($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off']);
if ($r['back'] === '') { http_response_code(400); header('Content-Type: text/plain; charset=utf-8'); echo $r['msg']; exit; }
header('Location: ' . $r['back'] . '?mailoauth=' . rawurlencode($r['msg']) . ($r['as'] !== '' ? '&as=' . rawurlencode($r['as']) : ''), true, 302);
