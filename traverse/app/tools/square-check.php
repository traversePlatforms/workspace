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
$scAction = 'squarenightly';
if (!$now) {
    $last = json_decode((string) @file_get_contents($scData . '/square-check.json'), true);
    $nightDone = is_array($last) && date('Y-m-d', (int) ($last['at'] ?? 0)) === date('Y-m-d') && (int) date('G', (int) ($last['at'] ?? 0)) >= 2;
    if ((int) date('G') < 2 || $nightDone) {
        /* not the nightly check: the balance sweep, every 15 minutes (2026-10-19, Matthew: "is there a way to automate it") */
        $sf = $scData . '/square-sweep.json'; $sl = json_decode((string) @file_get_contents($sf), true);
        if (is_array($sl) && time() - (int) ($sl['at'] ?? 0) < 14 * 60) exit(0);   /* 14, not 15: started every 5 minutes, a 15-minute wait slipped to 20 (2026-10-20) */
        @file_put_contents($sf, json_encode(['at' => time()]), LOCK_EX);
        $scAction = 'squaresweep';
    }
}
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => $scAction]; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
$scOut = null;
try { require $scApi . '/rounds.php'; } catch (SixfoldOut $e) { $scOut = $e->body; }
if (!is_array($scOut) || empty($scOut['ok'])) { fwrite(STDERR, 'square check: ' . (is_array($scOut) ? ($scOut['error'] ?? '?') : 'nothing back') . "\n"); exit(1); }
if ($scAction === 'squaresweep') { echo 'square sweep: ', (int) ($scOut['owing'] ?? 0), ' owing, ', (int) ($scOut['paid'] ?? 0), " found paid\n"; exit(0); }
echo 'square check: ', (int) $scOut['payments'], ' payments, ', (int) $scOut['items'], ' to look at (', (int) $scOut['new'], ' new); swept: ', (int) ($scOut['swept']['paid'] ?? 0), " found paid\n";
exit(0);
