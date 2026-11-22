<?php
/* The 10-minute check (crontab: every 10 minutes, php .../assistant-private/cron.php). Command line only.
   19 Nov: J.A.R.V.I.S. reminders go first (push what is due to Matthew's phone, lib/jarvis.php jvRemindersRun), so a slow Gmail check never
   holds them up. --reminders: only the reminders (the test copy uses it).
   21 Nov (P-13): then the morning brief's weather and news, once a morning from 5:25 am Denver (lib/brief.php brCronMaybe; the host has no
   crontab, so this rides the same check). --brief: make it now (the test copy, or by hand). */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$vendor = __DIR__ . '/vendor/autoload.php';
if (is_file($vendor)) require $vendor;
foreach (['store', 'auth', 'google', 'mail', 'claude', 'sorter', 'jarvis', 'desk', 'meet', 'brief', 'money', 'paystub'] as $f) require __DIR__ . '/lib/' . $f . '.php';
try { $mt = mtSweep(); } catch (Throwable $e) { $mt = ['error' => mb_substr($e->getMessage(), 0, 200)]; }   /* 20 Nov (P-12): recordings left open, stalled, kept past 30 days */
try { $rm = jvRemindersRun(); } catch (\Throwable $e) { $rm = ['error' => mb_substr($e->getMessage(), 0, 200)]; }
if (in_array('--reminders', $argv ?? [], true)) { echo json_encode(['reminders' => $rm], JSON_UNESCAPED_SLASHES) . "\n"; exit; }
if (in_array('--brief', $argv ?? [], true)) { $b = brRefresh('cron'); echo json_encode(['brief' => ['at' => (int) ($b['at'] ?? 0), 'failed' => $b['failed'] ?? [], 'by' => $b['spoken']['by'] ?? '']], JSON_UNESCAPED_SLASHES) . "\n"; exit; }
/* 21 Nov (P-15): money. --money: pull now (counts only); --money-report: what is stored, counts and categories only (no names, no amounts);
   --obligations-import < list.json: the Bills & debts register's one-time import (each name once; never overwrites) */
if (in_array('--money', $argv ?? [], true)) { $s = mnSync('cli'); echo json_encode(['ok' => $s['ok'], 'error' => $s['error'] ?? '', 'counts' => $s['counts'] ?? null, 'simplefin' => $s['errors'] ?? []], JSON_UNESCAPED_SLASHES) . "\n"; exit; }
if (in_array('--money-report', $argv ?? [], true)) { echo json_encode(mnReport(), JSON_UNESCAPED_SLASHES) . "\n"; exit; }
if (in_array('--obligations-import', $argv ?? [], true)) { $l = json_decode((string) stream_get_contents(STDIN), true); echo json_encode(is_array($l) ? obImport($l) : ['error' => 'not a list']) . "\n"; exit; }
if (in_array('--income-import', $argv ?? [], true)) { $l = json_decode((string) stream_get_contents(STDIN), true); echo json_encode(is_array($l) ? mnProfileImport($l) : ['error' => 'not a profile']) . "\n"; exit; }
if (in_array('--money-cron', $argv ?? [], true)) { echo json_encode(['money' => mnCron()], JSON_UNESCAPED_SLASHES) . "\n"; exit; }   /* the money part of the check alone (the test copy, or by hand) */
try { $mn = mnCron(); } catch (Throwable $e) { $mn = ['error' => mb_substr($e->getMessage(), 0, 120)]; }
try { $br = brCronMaybe(); } catch (\Throwable $e) { $br = ['error' => mb_substr($e->getMessage(), 0, 200)]; }
try { $sa = spendAlertMaybe(); } catch (Throwable $e) { $sa = ['error' => mb_substr($e->getMessage(), 0, 200)]; }   /* 21 Nov: a push at 75/90/100% of the API budget */
$r = checkAll();
echo json_encode(['reminders' => $rm, 'money' => $mn, 'brief' => $br, 'spendAlert' => $sa] + $r, JSON_UNESCAPED_SLASHES) . "\n";
