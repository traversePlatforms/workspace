<?php
/* Plans and customer emails, the timed part (2026-10-30, api/care-lib.php careSweep): the follow-ups after quotes with no answer, the
 * aftercare emails after jobs marked done, the approved newsletter issues whose time has come, and each plan customer's next visit kept in
 * step. Every one of them is off until that install's admin turns it on, so for most installs a run is a few file reads.
 * Lives outside public_html in sixfold-tools/, started EVERY HOUR by morning-email.php (this host has no crontab command). Editions and
 * client installs only: Sixfold 365 (rounds.php) has its own follow-up and newsletter on the 5-minute job, and careOn() refuses it anyway.
 * Each install runs in its own PHP process (their APIs define the same functions).
 *   php care-sweep.php                        every edition and client install, one after another
 *   php care-sweep.php <api file> [now]       one install (now: a Unix time, for the test copy only) */
if (PHP_SAPI !== 'cli') exit;
@ini_set('memory_limit', '1024M');
$api = getenv('SIXFOLD_API_DIR') ?: dirname(__DIR__) . '/public_html/api';   /* the override is for the test copy only */
if (empty($argv[1])) {
    foreach (glob($api . '/traverse*-rounds.php') ?: [] as $f) {
        $t = microtime(true); $out = [];
        @exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' ' . escapeshellarg($f) . ' 2>&1', $out);
        echo date('Y-m-d H:i'), ' ', basename($f), ': ', trim(implode(' ', $out)) ?: 'no output', ' (', round(microtime(true) - $t, 1), " s)\n";
    }
    exit;
}
$f = $argv[1];
if (!preg_match('#/(rounds|traverse[a-z0-9-]*-rounds)\.php$#', str_replace('\\', '/', $f)) || !is_file($f)) { echo "not an install API\n"; exit(1); }
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'caresweep'] + (isset($argv[2]) && ctype_digit($argv[2]) ? ['now' => $argv[2]] : []); $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require $f; echo 'no answer'; } catch (SixfoldOut $e) { echo json_encode($e->body, JSON_UNESCAPED_SLASHES); }
