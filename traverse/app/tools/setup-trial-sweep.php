<?php
/* Nobody is charged without an app (Matthew 2026-11-06, billing.php billingSetupSweep): for every edition and client install, a free trial
 * whose company signed up but is not live yet is pushed so it stays 3 days ahead; 14 days after sign-up with no go-live the subscription is
 * cancelled in Stripe with no charge and Matthew is emailed. Live or non-trialing subscriptions are never touched. Each push and cancel is in
 * that install's billing.log. Website sign-ups that never finished the welcome page (no install yet) are swept by traverse-tools/clients.php
 * relink (tcTrialSweepPending).
 * Lives outside public_html in sixfold-tools/, started ONCE A DAY by morning-email.php at the 4 am run (this host has no crontab command).
 * Each install runs in its own PHP process (their APIs define the same functions), like care-sweep.php.
 *   php setup-trial-sweep.php                        every edition and client install, one after another
 *   php setup-trial-sweep.php <api file> [now]       one install (now: a Unix time, for the test copy only) */
if (PHP_SAPI !== 'cli') exit;
@ini_set('memory_limit', '512M');
$api = getenv('SIXFOLD_API_DIR') ?: dirname(__DIR__) . '/public_html/api';   /* the override is for the test copy only */
if (empty($argv[1])) {
    foreach (glob($api . '/traverse*-rounds.php') ?: [] as $f) {
        $out = [];
        @exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' ' . escapeshellarg($f) . ' 2>&1', $out);
        echo date('Y-m-d H:i'), ' ', basename($f), ': ', trim(implode(' ', $out)) ?: 'no output', "\n";
    }
    exit;
}
$f = $argv[1];
if (!preg_match('#/(rounds|traverse[a-z0-9-]*-rounds)\.php$#', str_replace('\\', '/', $f)) || !is_file($f)) { echo "not an install API\n"; exit(1); }
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'trialsweep'] + (isset($argv[2]) && ctype_digit($argv[2]) ? ['now' => $argv[2]] : []); $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require $f; echo 'no answer'; } catch (SixfoldOut $e) { echo json_encode($e->body, JSON_UNESCAPED_SLASHES); }
