<?php
declare(strict_types=1);
/* Facebook lead ads into the Pipeline (2026-10-30), for the editions and the client installs: each install connected in Setup › Facebook leads
 * gets its chosen forms' new leads every 5 minutes. Run by traverse-tools/push-alerts.sh, once per install (--api=<install>-rounds.php),
 * on the 5-minute cron that is already there; lives OUTSIDE public_html, beside it. An install that is not connected says nothing.
 * Sixfold 365 is not run through this: its own Facebook job (sixfold-tools/meta-leads.php, action metapoll) is unchanged.
 *
 *   php .../fb-leads.php --api=traverse-rounds.php
 *
 * The work is done by the app itself (api/<install>-rounds.php, action=fbpoll; fb-leads-lib.php), asked from the command line, so Setup's
 * "Check now" and this can't disagree. Prints only counts and errors, never a person's details or a token. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');
$flArgs = array_slice($argv ?? [], 1);
$flApi = getenv('SIXFOLD_API_DIR') ?: dirname(__DIR__) . '/public_html/api';   /* the override is for the test copy only */
$flFile = '';
foreach ($flArgs as $a) if (strncmp($a, '--api=', 6) === 0) $flFile = substr($a, 6);
if (!preg_match('/^[a-z0-9-]*rounds\.php$/', $flFile) || !is_file($flApi . '/' . $flFile)) { fwrite(STDERR, 'facebook leads: no API file ' . $flFile . "\n"); exit(1); }
$flWho = $flFile === 'rounds.php' ? 'sixfold' : basename($flFile, '-rounds.php');
/* not connected: done before loading the app at all (every install, every 5 minutes: the host's CPU seconds are shared) */
$flPriv = getenv('SIXFOLD_PRIVATE_DIR') ?: dirname(__DIR__) . '/' . $flWho . '-private';   /* the override is for the test copy only */
if (!is_file($flPriv . '/fb-leads.json')) exit(0);

final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'fbpoll']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
$flOut = null;
try { require $flApi . '/' . $flFile; } catch (SixfoldOut $e) { $flOut = $e->body; }
if (!is_array($flOut) || empty($flOut['ok'])) exit(0);   /* an older API without Facebook leads: nothing to say */
if (!empty($flOut['added']) || !empty($flOut['notes']) || !empty($flOut['back'])) echo $flWho, ': facebook leads: ', (int) $flOut['added'], ' new, ', (int) ($flOut['notes'] ?? 0), ' noted on leads already here, ', (int) ($flOut['back'] ?? 0), " back from Couldn't reach\n";
if (!empty($flOut['lostNow'])) fwrite(STDERR, $flWho . ": facebook leads: needs reconnecting (Setup, Facebook leads); the admins were told in the app\n");   /* once, the run it happened */
foreach ((array) ($flOut['fresh'] ?? []) as $e) fwrite(STDERR, $flWho . ': facebook leads: ' . $e . "\n");   /* a new error once, not every 5 minutes */
exit(0);
