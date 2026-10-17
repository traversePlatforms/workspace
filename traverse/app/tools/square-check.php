<?php
declare(strict_types=1);
/* The nightly Square check (Matthew 2026-10-16: "build the nightly square check"). Lives OUTSIDE public_html, in sixfold-tools/.
 *
 * Started every 5 minutes by meta-leads.php (the Facebook job's own cron); it runs the check once a night, the first time it is
 * started after 2 am Denver time, and otherwise does nothing:
 *   php /home/customer/www/traverseplatforms.com/sixfold-tools/square-check.php          (once a night, after 2 am)
 *   php .../square-check.php --now                                                        (now, whatever the time)
 *
 * The work is done by the app itself (api/rounds.php, action squarenightly). Read only towards Square; prints counts only.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');
$scApi = getenv('SIXFOLD_API_DIR') ?: dirname(__DIR__) . '/public_html/api';   /* the override is for the test copy only */
$scData = getenv('SIXFOLD_DATA_DIR') ?: dirname(__DIR__) . '/sixfold-data/rounds';
$now = in_array('--now', array_slice($argv ?? [], 1), true);
if (!$now) {
    if ((int) date('G') < 2) exit(0);
    $last = json_decode((string) @file_get_contents($scData . '/square-check.json'), true);
    if (is_array($last) && date('Y-m-d', (int) ($last['at'] ?? 0)) === date('Y-m-d') && (int) date('G', (int) ($last['at'] ?? 0)) >= 2) exit(0);   /* already ran tonight */
}
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'squarenightly']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
$scOut = null;
try { require $scApi . '/rounds.php'; } catch (SixfoldOut $e) { $scOut = $e->body; }
if (!is_array($scOut) || empty($scOut['ok'])) { fwrite(STDERR, 'square check: ' . (is_array($scOut) ? ($scOut['error'] ?? '?') : 'nothing back') . "\n"); exit(1); }
echo 'square check: ', (int) $scOut['payments'], ' payments, ', (int) $scOut['items'], ' to look at (', (int) $scOut['new'], " new)\n";
exit(0);
