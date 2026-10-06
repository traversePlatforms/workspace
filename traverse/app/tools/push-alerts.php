<?php
declare(strict_types=1);
/* Phone alerts (Matthew 2026-10-05): every 5 minutes, push new National Weather Service storm and fire warnings to the
 * phones that turned alerts on. Lives OUTSIDE public_html, in sixfold-tools/ beside it (like morning-email.php).
 *
 * SiteGround cron job:   *\/5 * * * *   php /home/<account>/www/<site>/sixfold-tools/push-alerts.php
 * (the same path style as the morning email's job, with push-alerts.php in place of morning-email.php)
 *
 *   php .../push-alerts.php             push anything new (each warning once)
 *   php .../push-alerts.php --dry-run   print what would be pushed, to how many phones; sends and records nothing
 *
 * The work is done by the app itself (api/rounds.php, action=pushcron), asked from the command line, so the alerts
 * screen and the phones can't disagree. Design and tests: door-app/research/push/.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');
$paArgs = array_slice($argv ?? [], 1);
$paDry = in_array('--dry-run', $paArgs, true);
$paSite = dirname(__DIR__);
$paApi = getenv('SIXFOLD_API_DIR') ?: $paSite . '/public_html/api';   /* the override is for the test copy only */

final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'pushcron'] + ($paDry ? ['dry' => '1'] : []); $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
$paOut = null;
try { require $paApi . '/rounds.php'; } catch (SixfoldOut $e) { $paOut = $e->body; }
if (!is_array($paOut) || empty($paOut['ok'])) { fwrite(STDERR, 'sixfold alerts: ' . (is_array($paOut) ? ($paOut['error'] ?? '?') : 'nothing back') . "\n"); exit(1); }
if ($paDry || !empty($paOut['pushed'])) {
    if (!empty($paOut['note'])) echo $paOut['note'], "\n";
    foreach ((array) ($paOut['pushed'] ?? []) as $p) echo ($paDry ? 'would push ' : 'pushed ') . $p['event'] . ' (' . implode(', ', $p['towns']) . ') to ' . $p['to'] . ' phone(s)' . ($paDry ? '' : ', ' . $p['ok'] . ' accepted') . "\n";
    if (empty($paOut['pushed'])) echo "nothing new to push\n";
}
exit(0);
