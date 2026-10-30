<?php
/* The weekly fuel prices for the quote's fuel cost (2026-10-30; what they are and where they come from: above prcFuelStarter() in
 * api/rounds.php). Lives OUTSIDE public_html, in sixfold-tools/ beside it, like morning-email.php, which starts it every hour (there is no
 * crontab on this host). It asks one install's API for action=fuelcron; the API asks the U.S. EIA only when a new week should be out
 * (fuelDue) and keeps the prices in traverse-shared/fuel/eia.json for every install. Prints a line only when EIA was asked.
 *   php fuel-prices.php            ask EIA if a new week is due
 *   php fuel-prices.php --force    ask EIA now (at most every 10 minutes)
 * SIXFOLD_API_DIR points it at another API folder (the test copy only). */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
@ini_set('memory_limit', '512M');
$api = getenv('SIXFOLD_API_DIR') ?: dirname(__DIR__) . '/public_html/api';
/* an edition's API (the copy is shared, so any install will do); Sixfold's own only when no edition is on the host */
$file = (glob($api . '/traverse*-rounds.php') ?: [])[0] ?? $api . '/rounds.php';
if (!is_file($file)) { fwrite(STDERR, "fuel prices: no API in $api\n"); exit(1); }
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'fuelcron', 'force' => in_array('--force', array_slice($argv ?? [], 1), true) ? '1' : '']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require $file; fwrite(STDERR, "fuel prices: no answer\n"); exit(1); } catch (SixfoldOut $e) {
    $b = $e->body;
    if (empty($b['ok'])) { fwrite(STDERR, 'fuel prices: ' . (string) ($b['error'] ?? '?') . "\n"); exit(1); }
    if (empty($b['asked'])) exit(0);
    $p = fn($x) => is_array($x) ? '$' . $x['gal'] . ' (' . $x['src'] . ')' : 'none';
    echo date('Y-m-d H:i'), ' asked EIA: ', $b['err'] !== '' ? 'trouble: ' . $b['err'] . '; ' : '', 'newest week ', $b['newest'] ?: 'none', '; regular ', $p($b['gas']), '; diesel ', $p($b['diesel']), "\n";
}
