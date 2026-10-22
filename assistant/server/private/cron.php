<?php
/* The 10-minute check (crontab: every 10 minutes, php .../assistant-private/cron.php). Command line only. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$vendor = __DIR__ . '/vendor/autoload.php';
if (is_file($vendor)) require $vendor;
foreach (['store', 'auth', 'google', 'mail', 'claude', 'sorter'] as $f) require __DIR__ . '/lib/' . $f . '.php';
$r = checkAll();
echo json_encode($r, JSON_UNESCAPED_SLASHES) . "\n";
