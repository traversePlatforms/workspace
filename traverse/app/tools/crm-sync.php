<?php
declare(strict_types=1);
/* JobNimbus send (2026-10-08, TraverseRoofing): booked doors not yet in the roofer's JobNimbus go up as contacts, and their
 * roof walks as appointments. Run every 5 minutes by traverse-tools/push-alerts.sh, once per edition (--api=<edition>-rounds.php);
 * an edition without roofs, or not connected to JobNimbus, says nothing. Lives OUTSIDE public_html, beside it.
 *
 *   php .../crm-sync.php --api=traverse-rounds.php
 *   php .../crm-sync.php --api=traverse-rounds.php --pull     Sync from another system (2026-10-30): the company's Google Sheets and
 *                                                            connected CRMs read into the app (action=syncpoll); read-only over there
 *
 * The work is done by the app itself (api/<edition>-rounds.php, action=jnsync or syncpoll), asked from the command line, so the
 * screens' "Send now" and "Sync now" and this can't disagree. Prints only when something was sent, brought in or failed. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');
$csArgs = array_slice($argv ?? [], 1);
$csSite = dirname(__DIR__);
$csApi = getenv('SIXFOLD_API_DIR') ?: $csSite . '/public_html/api';   /* the override is for the test copy only */
$csFile = 'rounds.php';
foreach ($csArgs as $a) if (strncmp($a, '--api=', 6) === 0) $csFile = substr($a, 6);
if (!preg_match('/^[a-z0-9-]*rounds\.php$/', $csFile) || !is_file($csApi . '/' . $csFile)) { fwrite(STDERR, 'crm sync: no API file ' . $csFile . "\n"); exit(1); }
$csWho = basename($csFile, '-rounds.php');
$csPull = in_array('--pull', $csArgs, true);

final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => $csPull ? 'syncpoll' : 'jnsync']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
$csOut = null;
try { require $csApi . '/' . $csFile; } catch (SixfoldOut $e) { $csOut = $e->body; }
if (!is_array($csOut) || empty($csOut['ok'])) exit(0);   /* no roofs here, or not connected to JobNimbus: nothing to say */
if ($csPull) {   /* one line per source that brought something or failed; never a key, never a person */
    foreach ((array) ($csOut['ran'] ?? []) as $src => $r) {
        if (!is_array($r)) continue;
        if (!empty($r['err'])) echo $csWho, ': sync ', $src, ': ', $r['err'], "\n";
        elseif (!empty($r['added']) || !empty($r['updated']) || !empty($r['held'])) echo $csWho, ': sync ', $src, ': ', (int) $r['added'], ' added, ', (int) $r['updated'], ' updated', !empty($r['held']) ? ', ' . (int) $r['held'] . ' waiting' : '', "\n";
    }
    exit(0);
}
if (!empty($csOut['sent']) || !empty($csOut['tasks']) || !empty($csOut['failed'])) {
    echo $csWho, ': JobNimbus: ', (int) $csOut['sent'], ' contact(s), ', (int) $csOut['tasks'], ' appointment(s) sent', !empty($csOut['failed']) ? ', ' . (int) $csOut['failed'] . ' failed: ' . implode(' | ', (array) ($csOut['errors'] ?? [])) : '', "\n";
}
exit(0);
