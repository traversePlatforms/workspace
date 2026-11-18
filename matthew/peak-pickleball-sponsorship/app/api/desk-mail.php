<?php
/* The desk's end-of-day email goes out through the server's own internal mail path (2026-11-18): the Traverse website's mailbox,
 * public_html/demo/_lib.php send_mail(), the same way the Peak email sender's booking heads-up goes. That file has its own out() and
 * fail(), like desk.php, so it is loaded here in a process of its own. Command line only: desk.php runs it with one JSON message on stdin
 * ({"to","subject","body"}) and reads one JSON answer ({"ok","stage"}). Never opened from the web. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$m = json_decode((string) stream_get_contents(STDIN), true);
$say = function (array $a) { echo json_encode($a, JSON_UNESCAPED_SLASHES), "\n"; exit($a['ok'] ? 0 : 1); };
if (!is_array($m) || !filter_var((string) ($m['to'] ?? ''), FILTER_VALIDATE_EMAIL) || trim((string) ($m['subject'] ?? '')) === '') $say(['ok' => false, 'stage' => 'bad message']);
$lib = dirname(__DIR__, 2) . '/demo/_lib.php';
if (!is_file($lib)) $say(['ok' => false, 'stage' => 'no mail code on this server']);
try {
    require $lib;
    $c = site_config();
    $r = send_mail($c, (string) $m['to'], (string) $m['subject'], (string) ($m['body'] ?? ''));
    $say(['ok' => (bool) ($r['ok'] ?? false), 'stage' => (string) ($r['stage'] ?? '') . (isset($r['error']) ? ': ' . mb_substr((string) $r['error'], 0, 160) : '')]);
} catch (Throwable $e) { $say(['ok' => false, 'stage' => mb_substr($e->getMessage(), 0, 160)]); }
