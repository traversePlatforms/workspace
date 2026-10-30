<?php
/* The editions' and client installs' end-of-day email (2026-10-30, Matthew: "END-OF-DAY REPORT, OPTIONAL"): asks each one whether it is
 * time (rounds.php action=eodcron), and each sends only if its admin turned it on, at the hour they picked, once a day. Sixfold's own 8 pm
 * report is eod-report.php and is not touched here (api/rounds.php, Sixfold's API, is never asked).
 * Started hourly by morning-email.php (there is no crontab command on this host). Each install runs in its own PHP process (their APIs
 * define the same functions), with a time limit, so one install's trouble never stops the others.
 *   php edition-eod.php                        every edition and client install, one after another
 *   php edition-eod.php <api file> [--force]   one install (used by the loop above); --force: now, whatever the hour (tests) */
if (PHP_SAPI !== 'cli') exit;
@ini_set('memory_limit', '1024M');
$api = dirname(__DIR__) . '/public_html/api';
if (empty($argv[1]) || $argv[1] === '--all') {
    foreach (glob($api . '/traverse*-rounds.php') ?: [] as $f) {
        $t = microtime(true);
        $out = []; @exec(escapeshellarg(PHP_BINARY) . ' -d max_execution_time=240 ' . escapeshellarg(__FILE__) . ' ' . escapeshellarg($f) . ' 2>&1', $out);
        $line = trim(implode(' ', $out)) ?: 'no output';
        if (!preg_match('/^(off|not the hour|sent today|not an edition)$/', $line)) echo date('Y-m-d H:i'), ' ', basename($f), ': ', $line, ' (', round(microtime(true) - $t, 1), " s)\n";   /* the quiet answers are most hours: not logged */
    }
    exit;
}
$f = $argv[1]; $force = in_array('--force', $argv, true);
/* an edition's API (traverse-<edition>-rounds.php), a client install's (traverse-c<8 hex>-rounds.php), or a test copy's rounds.php */
if (!preg_match('#/(rounds|traverse[a-z0-9-]*-rounds)\.php$#', $f) || !is_file($f)) { echo "not an install API\n"; exit(1); }
set_time_limit(240);
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'eodcron'] + ($force ? ['force' => '1'] : []); $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require $f; echo "no answer\n"; } catch (SixfoldOut $e) {
    $b = $e->body;
    if (empty($b['ok'])) { echo 'error: ', (string) ($b['error'] ?? '?'), "\n"; exit(1); }
    echo isset($b['why']) ? (string) $b['why'] : 'sent ' . (int) $b['sent'] . ((int) ($b['failed'] ?? 0) ? ', ' . (int) $b['failed'] . ' failed' : '') . ': ' . (string) ($b['subject'] ?? ''), "\n";
}
