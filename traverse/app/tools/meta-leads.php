<?php
declare(strict_types=1);
/* Facebook lead forms into the Pipeline (Matthew 2026-10-14: "make sure theres a way to constantly export leads from meta to the app").
 * Lives OUTSIDE public_html, in sixfold-tools/ beside it (like push-alerts.php).
 *
 * SiteGround cron job:   *\/5 * * * *   php /home/customer/www/traverseplatforms.com/sixfold-tools/meta-leads.php
 *
 *   php .../meta-leads.php                 fetch the leads since the last run (each lead once)
 *   php .../meta-leads.php --setup=<file>  one time: swap an app id, app secret and user token (a JSON file) for page tokens,
 *                                          saved in sixfold-private/meta-leads.json; the file is deleted after
 *
 * The work is done by the app itself (api/rounds.php, actions metapoll and metasetup), asked from the command line. Prints
 * only names and counts, never a token.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');
$mlArgs = array_slice($argv ?? [], 1);
/* Jen's ClickUp leads ride on this cron (2026-10-16): their own process first, so a Facebook failure never stops them */
if (!$mlArgs && is_file(__DIR__ . '/clickup-leads.php')) passthru(escapeshellarg(PHP_BINARY ?: 'php') . ' ' . escapeshellarg(__DIR__ . '/clickup-leads.php'));
$mlApi = getenv('SIXFOLD_API_DIR') ?: dirname(__DIR__) . '/public_html/api';   /* the override is for the test copy only */
$mlSetup = '';
foreach ($mlArgs as $a) if (strncmp($a, '--setup=', 8) === 0) $mlSetup = substr($a, 8);
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = $mlSetup !== '' ? ['action' => 'metasetup', 'file' => $mlSetup] : ['action' => 'metapoll']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
$mlOut = null;
try { require $mlApi . '/rounds.php'; } catch (SixfoldOut $e) { $mlOut = $e->body; }
if (!is_array($mlOut) || empty($mlOut['ok'])) { fwrite(STDERR, 'facebook leads: ' . (is_array($mlOut) ? ($mlOut['error'] ?? '?') : 'nothing back') . "\n"); exit(1); }
if ($mlSetup !== '') { echo 'facebook leads: set up for ', implode(', ', (array) $mlOut['pages']), "\n"; exit(0); }
if (!empty($mlOut['note'])) echo 'facebook leads: ', $mlOut['note'], "\n";
if (!empty($mlOut['added'])) echo 'facebook leads: added ', $mlOut['added'], ': ', implode(', ', (array) $mlOut['who']), "\n";
foreach ((array) ($mlOut['errors'] ?? []) as $e) fwrite(STDERR, 'facebook leads: ' . $e . "\n");
exit(empty($mlOut['errors']) ? 0 : 1);
