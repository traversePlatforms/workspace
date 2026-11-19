<?php
/* The 10-minute check (crontab: every 10 minutes, php .../assistant-private/cron.php). Command line only.
   19 Nov: J.A.R.V.I.S. reminders go first (push what is due to Matthew's phone, lib/jarvis.php jvRemindersRun), so a slow Gmail check never
   holds them up. --reminders: only the reminders (the test copy uses it). */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$vendor = __DIR__ . '/vendor/autoload.php';
if (is_file($vendor)) require $vendor;
foreach (['store', 'auth', 'google', 'mail', 'claude', 'sorter', 'jarvis'] as $f) require __DIR__ . '/lib/' . $f . '.php';
try { $rm = jvRemindersRun(); } catch (\Throwable $e) { $rm = ['error' => mb_substr($e->getMessage(), 0, 200)]; }
if (in_array('--reminders', $argv ?? [], true)) { echo json_encode(['reminders' => $rm], JSON_UNESCAPED_SLASHES) . "\n"; exit; }
$r = checkAll();
echo json_encode(['reminders' => $rm] + $r, JSON_UNESCAPED_SLASHES) . "\n";
