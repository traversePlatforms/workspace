<?php
declare(strict_types=1);
/* Skip tracing from the command line (2026-10-04): owner phone numbers from the provider in
 * sixfold-private/skiptrace-config.php (BatchData first; api/skiptrace.php), for one town or one
 * neighbourhood, a limited number of doors at a time. The same code the app's Skip trace screen
 * runs (api/rounds.php, action=skiptrace), asked from the server's own command line, where there
 * is no two-minute web timeout: a 500-door run goes in one go, five provider calls of 100.
 *
 * Lives OUTSIDE public_html, in sixfold-tools/ beside nightly-backup.php and morning-email.php.
 * Never from a browser. Admin by definition: whoever has SSH to the server.
 *
 *   php sixfold-tools/skip-trace.php --town=monument                          DRY RUN: how many would be sent, the cost
 *   php sixfold-tools/skip-trace.php --town=monument --limit=500 --go         send up to 500 doors not looked up before
 *   php sixfold-tools/skip-trace.php --town=monument --area="Red Rock Ranch" --go
 *   php sixfold-tools/skip-trace.php --town=monument --go --force             look doors up AGAIN (costs again)
 *   php sixfold-tools/skip-trace.php --town=monument --export > cleared.csv   CSV of numbers NOT on the Do Not Call list
 *   php sixfold-tools/skip-trace.php --export --all > everything.csv          every town, every number, flagged (dnc / call_ok columns)
 *   php sixfold-tools/skip-trace.php --town=monument --list                   what is on file for the town
 *
 * Nothing is sent without --go. Doors already looked up are never sent again without --force.
 * Owners that are companies, trusts, HOAs, churches or government are flagged, not sent. Every
 * number that comes back is looked-up: the app and the export hide it until the provider says it
 * is not on the Do Not Call list.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');

$opt = getopt('', ['town:', 'area:', 'limit:', 'go', 'force', 'export', 'all', 'list', 'help']);
if (isset($opt['help']) || (!isset($opt['town']) && !isset($opt['export']))) {
    fwrite(STDERR, "usage: php skip-trace.php --town=<key> [--area=<name>] [--limit=500] [--go] [--force]\n" .
                   "       php skip-trace.php [--town=<key>] --export [--all]\n       php skip-trace.php --town=<key> --list\n" .
                   "Without --go nothing is sent: the dry run prints the counts and the estimated cost.\n");
    exit(isset($opt['help']) ? 0 : 2);
}
$stSite = dirname(__DIR__);
$stApi = getenv('SIXFOLD_API_DIR') ?: $stSite . '/public_html/api';   /* the override is for the test copy only */
if (!is_file($stApi . '/rounds.php')) { fwrite(STDERR, "sixfold skip-trace: no api at $stApi\n"); exit(1); }

final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$town = (string) ($opt['town'] ?? '');
if (isset($opt['export'])) {
    /* the CSV goes straight to stdout and rounds.php ends the process when it is written */
    $_REQUEST = ['action' => 'skipexport', 'all' => isset($opt['all']) ? '1' : '0'] + ($town !== '' ? ['region' => $town] : []);
    $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
    try { require $stApi . '/rounds.php'; } catch (SixfoldOut $e) { fwrite(STDERR, 'sixfold skip-trace: ' . ($e->body['error'] ?? 'no export') . "\n"); exit(1); }
    exit(0);
}
if (isset($opt['list'])) {
    $_REQUEST = ['action' => 'skiplist', 'region' => $town, 'area' => (string) ($opt['area'] ?? '')];
    $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
    $d = null;
    try { require $stApi . '/rounds.php'; } catch (SixfoldOut $e) { $d = $e->body; }
    if (!is_array($d) || empty($d['ok'])) { fwrite(STDERR, 'sixfold skip-trace: ' . (is_array($d) ? ($d['error'] ?? '?') : 'nothing back') . "\n"); exit(1); }
    $s = $d['sum'];
    echo "{$d['label']}" . ($d['area'] !== '' ? " · {$d['area']}" : '') . ": {$s['doors']} doors on file · {$s['matched']} matched, {$s['nomatch']} no match, {$s['error']} errors, {$s['skipped']} not people\n";
    echo "{$s['phones']} numbers: {$s['clear']} not on the DNC list, {$s['listed']} ON the list, {$s['unchecked']} not checked · {$s['emails']} emails\n";
    foreach ($d['rows'] as $r) {
        $nums = array_map(fn($p) => $p['n'] . ($p['type'] ? ' ' . $p['type'] : '') . ' [' . ($p['dnc'] === 'clear' ? 'ok' : ($p['dnc'] === 'listed' ? 'DNC' : 'not checked')) . ']', $r['phones']);
        echo '- ' . $r['address'] . ' · ' . $r['owner'] . ' · ' . $r['status'] . ($r['why'] ? ' (' . $r['why'] . ')' : '') . ($nums ? ' · ' . implode(', ', $nums) : '') . ($r['emails'] ? ' · ' . implode(', ', $r['emails']) : '') . "\n";
    }
    exit(0);
}

$_REQUEST = ['action' => 'skiptrace', 'region' => $town, 'area' => (string) ($opt['area'] ?? ''), 'limit' => (string) (int) ($opt['limit'] ?? 500),
             'dry' => isset($opt['go']) ? '0' : '1', 'force' => isset($opt['force']) ? '1' : '0', 'chunk' => 'all'];
$_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
$d = null;
try { require $stApi . '/rounds.php'; } catch (SixfoldOut $e) { $d = $e->body; }
if (!is_array($d) || empty($d['ok'])) { fwrite(STDERR, 'sixfold skip-trace: ' . (is_array($d) ? ($d['error'] ?? '?') : 'nothing back') . "\n"); exit(1); }

$money = fn(?float $v) => $v === null ? 'not estimated' : '$' . number_format($v, 2);
$skipped = [];
foreach ($d['skipped'] as $k => $n) $skipped[] = "$n " . (['noowner' => 'no owner on record', 'company' => 'companies', 'government' => 'government', 'community' => 'HOAs / districts', 'nonprofit' => 'churches / nonprofits', 'trust' => 'trusts / estates'][$k] ?? $k);
echo ($d['dry'] ? 'DRY RUN — nothing sent. ' : '') . "{$d['region']}" . ($d['area'] !== '' ? " · {$d['area']}" : '') . ": {$d['total']} doors. "
   . "Would send {$d['wouldSend']} (limit {$d['limit']}), {$d['withMail']} with a mailing address; already looked up: {$d['cached']}"
   . ($d['errorsRetried'] ? " ({$d['errorsRetried']} earlier errors retried)" : '') . "; not people: {$d['skippedTotal']}" . ($skipped ? ' (' . implode(', ', $skipped) . ')' : '') . ".\n";
echo 'Provider: ' . $d['provider'] . ($d['configured'] ? '' : ' (NOT CONFIGURED: add the key to sixfold-private/skiptrace-config.php)') . ' · estimated cost ' . $money($d['cost'])
   . ($d['pricePerRecord'] !== null ? ' at $' . $d['pricePerRecord'] . ' a record' : '') . '. ' . $d['costNote'] . "\n";
if ($d['dry']) { echo "Add --go to send.\n"; exit(0); }
echo "Sent {$d['sent']}: {$d['matched']} matched, {$d['nomatch']} no match, {$d['errors']} errors · {$d['phones']} numbers, {$d['cleared']} not on the DNC list"
   . ($d['remaining'] ? " · {$d['remaining']} still to send" : '') . ".\n";
echo "Numbers are in sixfold-data/rounds/skiptrace-{$d['region']}.log and on the app's Skip trace screen (admin). Export the cleared ones with --export.\n";
exit($d['errors'] > 0 ? 3 : 0);
