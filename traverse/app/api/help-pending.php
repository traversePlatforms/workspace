<?php
/* J.A.R.V.I.S. (the Sixfold Help chat), the quick check (2026-11-01, Matthew: faster replies). The laptop's watcher asks this every few
   seconds instead of opening an SSH session: it answers only how many conversations are waiting ("new"), nothing else, and only with the
   key in sixfold-private/help-poll.key (the laptop keeps the same key, never printed). Tiny on purpose: it reads help.log directly and
   does not load rounds.php.   GET help-pending.php?k=<key>  ->  "0", "1", ... */
header('Content-Type: text/plain; charset=utf-8'); header('Cache-Control: no-store');
$base = dirname(__DIR__, 2);
$key = trim((string) @file_get_contents($base . '/sixfold-private/help-poll.key'));
if ($key === '' || !hash_equals($key, (string) ($_GET['k'] ?? ''))) { http_response_code(404); exit; }
/* b=1 (2026-11-19, the cloud J.A.R.V.I.S., TASKS X-15): the cloud watcher's beat, for the laptop's watcher: "<seconds since> <mode> <ready>"
   (mode live|shadow|practice|off, ready 1|0), or "none". The beat is jarvis-cloud/beat.txt beside public_html, written by the cloud each minute. */
if (($_GET['b'] ?? '') === '1') {
    $b = (string) @file_get_contents($base . '/jarvis-cloud/beat.txt');
    echo preg_match('/^(\d{10}) (live|shadow|practice|off) ([01])\s*$/D', $b, $m) ? (max(0, time() - (int) $m[1]) . ' ' . $m[2] . ' ' . $m[3]) : 'none';
    exit;
}
$st = [];
$inst = (string) ($_GET['i'] ?? '');   /* i=c-<slug>: a client install's own chat (2026-11-18, the Houston test install) */
if ($inst !== '' && !preg_match('/^c-[a-z0-9-]{1,40}$/D', $inst)) { http_response_code(404); exit; }
/* a=peak|posts (2026-11-21, TASKS JV-APPS): the Peak desk's and the post calendar's own J.A.R.V.I.S. chats (shared/jv-chat/jv-lib.php), same rows */
$app = (string) ($_GET['a'] ?? ''); $apps = ['peak' => '/peak-desk-data/jarvis/help.log', 'posts' => '/post-calendar-data/jarvis/help.log'];
if ($app !== '' && !isset($apps[$app])) { http_response_code(404); exit; }
$f = @fopen($base . ($app !== '' ? $apps[$app] : ($inst !== '' ? '/' . $inst . '-data/rounds/help.log' : (($_GET['p'] ?? '') === '1' ? '/sixfold-practice-data/rounds/help.log' : '/sixfold-data/rounds/help.log'))), 'r');   /* p=1: the practice copy's chat (2 Nov) */
if ($f) { while (($ln = fgets($f)) !== false) { $r = json_decode($ln, true); if (!is_array($r) || empty($r['id'])) continue;
    $t = (string) ($r['t'] ?? ''); $st[$r['id']] = $t === 'msg' ? 'new' : (string) ($r['status'] ?? ($st[$r['id']] ?? 'new')); } fclose($f); }
echo count(array_filter($st, fn($s) => $s === 'new'));
