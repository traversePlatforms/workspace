<?php
declare(strict_types=1);
/* JobNimbus send (2026-10-08, TraverseRoofing): booked doors not yet in the roofer's JobNimbus go up as contacts, and their
 * roof walks as appointments. Run every 5 minutes by traverse-tools/push-alerts.sh, once per edition (--api=<edition>-rounds.php);
 * an edition without roofs, or not connected to JobNimbus, says nothing. Lives OUTSIDE public_html, beside it.
 *
 *   php .../crm-sync.php --api=traverse-rounds.php
 *
 * The work is done by the app itself (api/<edition>-rounds.php, action=jnsync), asked from the command line, so the Pipeline
 * screen's "Send now" and this can't disagree. Prints only when something was sent or failed. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');
$csArgs = array_slice($argv ?? [], 1);
$csSite = dirname(__DIR__);
$csApi = getenv('SIXFOLD_API_DIR') ?: $csSite . '/public_html/api';   /* the override is for the test copy only */
$csFile = 'rounds.php';
foreach ($csArgs as $a) if (strncmp($a, '--api=', 6) === 0) $csFile = substr($a, 6);
if (!preg_match('/^[a-z0-9-]*rounds\.php$/', $csFile) || !is_file($csApi . '/' . $csFile)) { fwrite(STDERR, 'crm sync: no API file ' . $csFile . "\n"); exit(1); }
$csWho = basename($csFile, '-rounds.php');

final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'jnsync']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
$csOut = null;
try { require $csApi . '/' . $csFile; } catch (SixfoldOut $e) { $csOut = $e->body; }
if (!is_array($csOut) || empty($csOut['ok'])) exit(0);   /* no roofs here, or not connected to JobNimbus: nothing to say */
if (!empty($csOut['sent']) || !empty($csOut['tasks']) || !empty($csOut['failed'])) {
    echo $csWho, ': JobNimbus: ', (int) $csOut['sent'], ' contact(s), ', (int) $csOut['tasks'], ' appointment(s) sent', !empty($csOut['failed']) ? ', ' . (int) $csOut['failed'] . ' failed: ' . implode(' | ', (array) ($csOut['errors'] ?? [])) : '', "\n";
}
exit(0);
