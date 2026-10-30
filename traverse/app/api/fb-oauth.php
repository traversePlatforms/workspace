<?php
/* Connect Facebook for Setup › Facebook leads: the address Facebook Login for Business sends a company's admin back to (2026-10-30). One file
 * for every install on this server (the five editions and the client installs); the install is named inside the signed state. All of it is
 * in fb-leads-lib.php (flCallback): state signature, age and single use, the browser cookie, the code swapped for a token, the permissions
 * checked, the Pages listed, the tokens kept sealed in that install's private folder. Then back to the app's page, which opens Setup ›
 * Facebook leads. Nothing here ever prints a token.
 * Register this address in the Meta app (Facebook Login for Business > Settings > Valid OAuth Redirect URIs): https://traverseplatforms.com/api/fb-oauth.php */
declare(strict_types=1);
header('Cache-Control: no-store'); header('X-Robots-Tag: noindex'); header('Referrer-Policy: no-referrer');
require __DIR__ . '/fb-leads-lib.php';
$r = flCallback($_GET, $_COOKIE);
if ($r['cookie'] !== '') setcookie($r['cookie'], '', ['expires' => time() - 3600, 'path' => '/api/fb-oauth.php', 'httponly' => true, 'samesite' => 'Lax', 'secure' => ($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off']);
if ($r['back'] === '') { http_response_code(400); header('Content-Type: text/plain; charset=utf-8'); echo $r['msg']; exit; }
header('Location: ' . $r['back'] . '?fbleads=' . rawurlencode($r['msg']) . ($r['n'] > 0 ? '&n=' . (int) $r['n'] : ''), true, 302);
