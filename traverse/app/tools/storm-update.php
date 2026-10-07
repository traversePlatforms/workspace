<?php
declare(strict_types=1);
/* Storm update (Matthew 2026-10-06): bring the hail files up to date with NOAA's newest days and drop storm days past the keep
 * rule (two years; five when hail reached 2 in). The app does this by itself when an admin opens Hail or the Storm list and the
 * files are more than 12 hours old; this runs the same thing from the command line, by hand or from a cron job, so the morning's
 * storm is in before anyone looks. Lives OUTSIDE public_html, beside it (like push-alerts.php).
 *
 *   php .../storm-update.php           add any new days (at most 10 at a time) and apply the keep rule, if not done in 12 hours
 *   php .../storm-update.php --force   the same, now
 *
 * Optional SiteGround cron job, once a day after NOAA's 6 am file:   15 7 * * *   php /home/<account>/www/<site>/<tools folder>/storm-update.php
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');
$suArgs = array_slice($argv ?? [], 1);
$suSite = dirname(__DIR__);
$suApi = getenv('SIXFOLD_API_DIR') ?: $suSite . '/public_html/api';   /* the override is for the test copy only */

final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'stormcron'] + (in_array('--force', $suArgs, true) ? ['force' => '1'] : []); $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
$suOut = null;
try { require $suApi . '/' . (getenv('SIXFOLD_API_FILE') ?: 'rounds.php'); } catch (SixfoldOut $e) { $suOut = $e->body; }
if (!is_array($suOut) || empty($suOut['ok'])) { fwrite(STDERR, 'storm update: ' . (is_array($suOut) ? ($suOut['error'] ?? '?') : 'nothing back') . "\n"); exit(1); }
if (!empty($suOut['note'])) { echo $suOut['note'], "\n"; exit(0); }
if (!empty($suOut['skipped'])) { echo 'nothing to do (' . $suOut['skipped'] . '); hail through ' . ($suOut['through'] ?? '?') . "\n"; exit(0); }
echo 'hail through ' . $suOut['through'] . '; added ' . (count($suOut['added']) ? implode(', ', $suOut['added']) : 'no new days')
   . '; ' . $suOut['dropped'] . ' old storm day(s) dropped' . ($suOut['missing'] ? '; no file for ' . implode(', ', $suOut['missing']) : '') . (isset($suOut['written']) && !$suOut['written'] ? '; ⚑ a file could not be written' : '') . "\n";
exit(0);
