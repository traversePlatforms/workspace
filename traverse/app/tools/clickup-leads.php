<?php
declare(strict_types=1);
/* Jen's ClickUp leads into the Pipeline (Matthew 2026-10-16: "attach clickup to our app to take the leads [Jen] is filing into
 * our app"; "run a scan for duplicates after each pull"). Lives OUTSIDE public_html, in sixfold-tools/ beside it.
 *
 * Started every 5 minutes by meta-leads.php (the Facebook job's own cron), so it needs no cron of its own:
 *   php /home/customer/www/traverseplatforms.com/sixfold-tools/clickup-leads.php
 *
 * The work is done by the app itself (api/rounds.php, action clickuppoll), asked from the command line. One way only: nothing is
 * written to ClickUp. Prints only names and counts, never the token (sixfold-private/clickup.json).
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');
$cuApi = getenv('SIXFOLD_API_DIR') ?: dirname(__DIR__) . '/public_html/api';   /* the override is for the test copy only */
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'clickuppoll']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
$cuOut = null;
try { require $cuApi . '/rounds.php'; } catch (SixfoldOut $e) { $cuOut = $e->body; }
if (!is_array($cuOut) || empty($cuOut['ok'])) { fwrite(STDERR, 'clickup leads: ' . (is_array($cuOut) ? ($cuOut['error'] ?? '?') : 'nothing back') . "\n"); exit(1); }
if (!empty($cuOut['note'])) { echo 'clickup leads: ', $cuOut['note'], "\n"; exit(0); }
if (!empty($cuOut['added'])) echo 'clickup leads: added ', $cuOut['added'], ': ', implode(', ', (array) $cuOut['who']), "\n";
if (!empty($cuOut['linked'])) echo 'clickup leads: linked ', implode(', ', (array) $cuOut['linked']), "\n";
if (!empty($cuOut['moved'])) echo 'clickup leads: moved ', implode(', ', (array) $cuOut['moved']), "\n";
foreach ((array) ($cuOut['dupes'] ?? []) as $g) echo 'clickup leads: possible double: ', implode(' / ', (array) $g['names']), ' (same ', $g['why'], ")\n";
exit(0);
