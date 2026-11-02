<?php
/* J.A.R.V.I.S. (the Sixfold Help chat), the quick check (2026-11-01, Matthew: faster replies). The laptop's watcher asks this every few
   seconds instead of opening an SSH session: it answers only how many conversations are waiting ("new"), nothing else, and only with the
   key in sixfold-private/help-poll.key (the laptop keeps the same key, never printed). Tiny on purpose: it reads help.log directly and
   does not load rounds.php.   GET help-pending.php?k=<key>  ->  "0", "1", ... */
header('Content-Type: text/plain; charset=utf-8'); header('Cache-Control: no-store');
$base = dirname(__DIR__, 2);
$key = trim((string) @file_get_contents($base . '/sixfold-private/help-poll.key'));
if ($key === '' || !hash_equals($key, (string) ($_GET['k'] ?? ''))) { http_response_code(404); exit; }
$st = [];
$f = @fopen($base . (($_GET['p'] ?? '') === '1' ? '/sixfold-practice-data/rounds/help.log' : '/sixfold-data/rounds/help.log'), 'r');   /* p=1: the practice copy's chat (2 Nov) */
if ($f) { while (($ln = fgets($f)) !== false) { $r = json_decode($ln, true); if (!is_array($r) || empty($r['id'])) continue;
    $t = (string) ($r['t'] ?? ''); $st[$r['id']] = $t === 'msg' ? 'new' : (string) ($r['status'] ?? ($st[$r['id']] ?? 'new')); } fclose($f); }
echo count(array_filter($st, fn($s) => $s === 'new'));
