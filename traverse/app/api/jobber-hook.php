<?php
/* Jobber's webhook (TR-46, 2026-10-31): APP_DISCONNECT, sent when a company's Jobber admin presses Disconnect on Traverse's app in Jobber.
 * Jobber's App Review asks for it; a draft app works without it. The body is checked against X-Jobber-Hmac-SHA256 (base64 HMAC-SHA256 of the
 * body under the app's client secret, as Jobber's "Setting up Webhooks" page says) before anything is read; then every install connected to
 * that Jobber account marks the connection disconnected and forgets its tokens (jobber-lib.php jbHook). Jobber wants an answer within a
 * second: this only reads two small files. Any other topic is answered 200 and ignored.
 * Register this address for the APP_DISCONNECT topic in Jobber's Developer Center: https://traverseplatforms.com/api/jobber-hook.php */
declare(strict_types=1);
header('Cache-Control: no-store'); header('X-Robots-Tag: noindex'); header('Content-Type: text/plain; charset=utf-8');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); echo 'POST only'; exit; }
require __DIR__ . '/jobber-lib.php';
$raw = (string) file_get_contents('php://input', false, null, 0, 65536);
[$code, $said] = jbHook($raw, (string) ($_SERVER['HTTP_X_JOBBER_HMAC_SHA256'] ?? ''));
http_response_code($code); echo $said;
