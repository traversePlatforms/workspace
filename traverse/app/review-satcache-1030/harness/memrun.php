<?php
/* php -d memory_limit=768M memrun.php <site>: the storm job (tools/storm-update.php --force) of that test site, then one line of JSON
   on stderr with the peak memory, the time and any fatal error */
$site = $argv[1];
$t0 = microtime(true);
register_shutdown_function(function () use ($t0) {
    $e = error_get_last();
    $fatal = $e && in_array($e['type'], [E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true);
    fwrite(STDERR, 'MEMRUN ' . json_encode(['peakMB' => round(memory_get_peak_usage(true) / 1048576, 1), 'sec' => round(microtime(true) - $t0, 1),
        'limit' => ini_get('memory_limit'), 'fatal' => $fatal ? $e['message'] : null]) . "\n");
});
$argv = [$site . '/tools/storm-update.php', '--force'];
require $site . '/tools/storm-update.php';
