<?php
declare(strict_types=1);
/* The morning email to the office (Matthew 2026-10-04): leads still to call, today's and tomorrow's walks,
 * customers due this week, and yesterday at the doors, without opening the app.
 *
 * Lives OUTSIDE public_html, in sixfold-tools/ beside it (like nightly-backup.php). A SiteGround cron job
 * runs it EVERY HOUR; it sends once a day, at the first run at or after 6 am Colorado time, so it doesn't
 * matter which clock the server keeps. Sent to the website form's address (Contact@) through the same
 * Gmail login the form uses (public_html/api/config.php and smtp.php); this file never sees the password.
 *
 *   php nightly-path/morning-email.php            send if it's time and not sent today
 *   php .../morning-email.php --now               send now, whatever the time (to test the cron job)
 *   php .../morning-email.php --dry-run           print the email instead of sending it
 *
 * The figures come from the app itself (api/rounds.php, action=digest), asked from the command line,
 * so the email and the app can't disagree.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');

const SEND_HOUR = 6;
$mxArgs = array_slice($argv ?? [], 1);
$mxNow = in_array('--now', $mxArgs, true); $mxDry = in_array('--dry-run', $mxArgs, true);
/* the end-of-day report rides on this hourly cron job (2026-10-23): SiteGround's command line can list cron jobs but not add them.
   eod-report.php decides for itself whether it's time (8 pm, once a day) and exits at once otherwise. */
if (!$mxNow && !$mxDry && is_file(__DIR__ . '/eod-report.php')) @exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/eod-report.php') . ' >> ' . escapeshellarg(dirname(__DIR__) . '/sixfold-data/digest/eod-cron.log') . ' 2>&1');
/* the Peak Sponsor Desk's company look-ups ride on this hourly job too (2026-10-24, Matthew: "run company scans more frequently so that
   peak leads updates"): 15 companies a run, each looked up again once a day; in the background, so this email never waits on it. */
if (!$mxNow && !$mxDry && is_file(dirname(__DIR__) . '/public_html/peak-desk-28d38d/api/desk.php')) @exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(dirname(__DIR__) . '/public_html/peak-desk-28d38d/api/desk.php') . ' rescan 15 >> ' . escapeshellarg(dirname(__DIR__) . '/peak-desk-data/scan.log') . ' 2>&1 &');
/* the Traverse Prospect Desk's email queue rides on this hourly job as well (2026-10-26, TR-21): it sends only what Matthew queued on the
   desk, weekdays 8 am to 5 pm, within the desk's daily cap, up to 15 a run about 2 minutes apart (was 10; Matthew 1 Nov); in the background. */
if (!$mxNow && !$mxDry && is_file(dirname(__DIR__) . '/public_html/prospects-47bfe6/api/desk.php')) @exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(dirname(__DIR__) . '/public_html/prospects-47bfe6/api/desk.php') . ' sendqueue 15 >> ' . escapeshellarg(dirname(__DIR__) . '/traverse-prospects-data/send.log') . ' 2>&1 &');
/* every install's door-search index, rebuilt here when a town file changed instead of inside someone's first search (2026-10-27, code
   review item 9); in the background, so this email never waits on it */
if (!$mxNow && !$mxDry && is_file(__DIR__ . '/search-index-warm.php')) @exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/search-index-warm.php') . ' >> ' . escapeshellarg(dirname(__DIR__) . '/sixfold-data/digest/search-warm.log') . ' 2>&1 &');
/* client installs pick up towns that came into their radius (new towns, e.g. Group 3) once a day, at the 4 am run (2026-10-30: there is
   no crontab command on this host, so it rides on this hourly job) */
if (!$mxNow && !$mxDry && date('G') === '4' && is_file(dirname(__DIR__) . '/traverse-tools/clients.php')) @exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(dirname(__DIR__) . '/traverse-tools/clients.php') . ' relink >> ' . escapeshellarg(dirname(__DIR__) . '/sixfold-data/digest/clients-relink.log') . ' 2>&1 &');
/* and every install's towns answer, so the first phone after midnight or a settings save doesn't wait for all the towns (2026-10-29) */
if (!$mxNow && !$mxDry && is_file(__DIR__ . '/regions-warm.php')) @exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/regions-warm.php') . ' >> ' . escapeshellarg(dirname(__DIR__) . '/sixfold-data/digest/regions-warm.log') . ' 2>&1 &');
/* the weekly fuel prices for the quote's fuel cost (2026-10-30): fuel-prices.php asks EIA only when a new week is due; in the background */
if (!$mxNow && !$mxDry && is_file(__DIR__ . '/fuel-prices.php')) @exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/fuel-prices.php') . ' >> ' . escapeshellarg(dirname(__DIR__) . '/sixfold-data/digest/fuel-prices.log') . ' 2>&1 &');
/* plans and customer emails for every edition and client install (2026-10-30, care-sweep.php): follow-ups, aftercare and approved newsletter
   issues, each off until that install's admin turns it on; in the background */
if (!$mxNow && !$mxDry && is_file(__DIR__ . '/care-sweep.php')) @exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/care-sweep.php') . ' >> ' . escapeshellarg(dirname(__DIR__) . '/sixfold-data/digest/care-sweep.log') . ' 2>&1 &');
/* the editions' and client installs' end-of-day emails (2026-10-30): each install sends only if its admin turned it on, at its own hour;
   edition-eod.php asks each in turn, in the background (Sixfold's own report is the eod-report.php line above) */
if (!$mxNow && !$mxDry && is_file(__DIR__ . '/edition-eod.php')) @exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/edition-eod.php') . ' >> ' . escapeshellarg(dirname(__DIR__) . '/sixfold-data/digest/edition-eod.log') . ' 2>&1 &');
$mxSite = dirname(__DIR__);
$mxApi = getenv('SIXFOLD_API_DIR') ?: $mxSite . '/public_html/api';   /* the override is for the test copy only */
$mxState = $mxSite . '/sixfold-data/digest';
if (!is_dir($mxState) && !@mkdir($mxState, 0700, true)) { fwrite(STDERR, "sixfold morning: cannot create $mxState\n"); exit(1); }
$mxToday = date('Y-m-d');
if (!$mxNow && !$mxDry) {
    if ((int) date('G') < SEND_HOUR) exit(0);
    if (trim((string) @file_get_contents($mxState . '/last-sent.txt')) === $mxToday) exit(0);
}

/* ask the app for the digest */
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'digest']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
$mxD = null;
try { require $mxApi . '/rounds.php'; } catch (SixfoldOut $e) { $mxD = $e->body; }
if (!is_array($mxD) || empty($mxD['ok'])) { fwrite(STDERR, 'sixfold morning: no digest (' . (is_array($mxD) ? ($mxD['error'] ?? '?') : 'nothing back') . ")\n"); exit(1); }

/* 365-website leads are Matthew's only (2026-10-22), and this email goes to the shared Contact@ inbox: leave them out */
$mxWeb = array_filter($mxD['leads'], fn($l) => ($l['src'] ?? '') === 'a365web');
$mxD['leads'] = array_values(array_diff_key($mxD['leads'], $mxWeb)); $mxD['leadsNew'] = max(0, (int) $mxD['leadsNew'] - count($mxWeb));

/* the email, plain text */
$day =fn(string $iso) => $iso === '' ? '' : date('D j M', strtotime($iso . ' 12:00'));
$tel = function (string $p) { $d = preg_replace('/\D/', '', $p); if (strlen($d) === 11 && $d[0] === '1') $d = substr($d, 1); return strlen($d) === 10 ? '(' . substr($d, 0, 3) . ') ' . substr($d, 3, 3) . '-' . substr($d, 6) : $p; };
$src = ['website' => 'Website form', 'meta' => 'Meta ad', 'messenger' => 'Facebook Messenger', 'nextdoor' => 'Nextdoor', 'phone' => 'Phone call', 'linktree' => 'Linktree', 'referral' => 'Referral', 'other' => 'Other'];
$plan = ['oneoff' => 'one-off', 'monthly' => 'monthly', 'quarterly' => 'quarterly', 'yearly' => 'yearly', 'custom' => 'custom'];
$hm = function (string $t) { if ($t === '') return 'time to agree'; [$h, $m] = array_map('intval', explode(':', $t)); return ($h % 12 ?: 12) . ':' . str_pad((string) $m, 2, '0', STR_PAD_LEFT) . ($h < 12 ? ' am' : ' pm'); };
$walksToday = array_values(array_filter($mxD['walks'], fn($w) => $w['date'] === $mxD['today']));
$walksTom = array_values(array_filter($mxD['walks'], fn($w) => $w['date'] === $mxD['tomorrow']));
$L = [];
$L[] = 'Good morning. Here is where things stand, ' . $day($mxD['today']) . '.';
$L[] = '';
$L[] = 'LEADS TO CALL (' . $mxD['leadsNew'] . ')';
if (!$mxD['leads']) $L[] = '- None waiting.';
foreach ($mxD['leads'] as $l) $L[] = '- ' . implode(' · ', array_filter([$l['name'] ?: 'No name', $src[$l['src']] ?? $l['src'], $l['need'], $l['phone'] !== '' ? $tel($l['phone']) : '', $l['town'], 'came in ' . $day(date('Y-m-d', $l['at']))]));
if ($mxD['leadsNew'] > count($mxD['leads'])) $L[] = '- and ' . ($mxD['leadsNew'] - count($mxD['leads'])) . ' more in the Pipeline.';
$L[] = '';
foreach ([['WALKS TODAY', $walksToday], ['WALKS TOMORROW', $walksTom]] as [$h, $ws]) {
    $L[] = $h . ' (' . count($ws) . ')';
    if (!$ws) $L[] = '- None booked.';
    foreach ($ws as $w) $L[] = '- ' . $hm((string) $w['time']) . ' · ' . $w['address'] . ', ' . $w['town'] . ($w['by'] ? ' · booked by ' . $w['by'] : '');
    $L[] = '';
}
$L[] = 'CUSTOMERS DUE THIS WEEK (' . count($mxD['due']) . ')';
if (!$mxD['due']) $L[] = '- Nobody due.';
foreach ($mxD['due'] as $c) $L[] = '- ' . ($c['overdue'] ? 'OVERDUE since ' : '') . $day($c['next']) . ' · ' . $c['name'] . ' · ' . ($plan[$c['plan']] ?? $c['plan']) . ' ' . $c['service'] . ($c['price'] !== null ? ' · $' . number_format((float) $c['price']) : '');
$L[] = '';
$L[] = 'YESTERDAY AT THE DOORS (' . $day($mxD['yesterday']) . ')';
if (!$mxD['team']) $L[] = '- No doors marked.';
$tot = ['doors' => 0, 'talked' => 0, 'booked' => 0];
foreach ($mxD['team'] as $p) { $L[] = '- ' . $p['name'] . ': ' . $p['doors'] . ' doors, ' . $p['talked'] . ' talked to, ' . $p['booked'] . ($p['booked'] === 1 ? ' quote' : ' quotes') . ' booked'; foreach ($tot as $k => $_) $tot[$k] += $p[$k]; }
if (count($mxD['team']) > 1) $L[] = '- Everyone: ' . $tot['doors'] . ' doors, ' . $tot['talked'] . ' talked to, ' . $tot['booked'] . ($tot['booked'] === 1 ? ' quote' : ' quotes') . ' booked';
$L[] = '';
$mxCo = (array) ($mxD['company'] ?? []);
if (!empty($mxCo['appUrl'])) $L[] = 'Open the app: ' . $mxCo['appUrl'];
$L[] = '';
$L[] = '-- Sent every morning by the door app. Names and numbers here are customers\' details: keep this email inside ' . ($mxCo['short'] ?? 'the company') . '.';
$mxBody = implode("\n", $L);
$bits = [$mxD['leadsNew'] . ($mxD['leadsNew'] === 1 ? ' lead' : ' leads') . ' to call', count($walksToday) . (count($walksToday) === 1 ? ' walk' : ' walks') . ' today'];
if ($mxD['due']) $bits[] = count($mxD['due']) . ' due';
$mxSubject = 'Morning, ' . $day($mxD['today']) . ': ' . implode(' · ', $bits);

if ($mxDry) { echo "Subject: $mxSubject\n\n$mxBody\n"; exit(0); }

/* send through the website form's own mail setup */
$mxCfg = require $mxApi . '/config.php';
require_once $mxApi . '/smtp.php';
$mxRes = smtp_send((array) ($mxCfg['smtp'] ?? []), (string) $mxCfg['to'], '[' . ($mxCo['short'] ?? 'Door') . ' app] ' . $mxSubject, $mxBody, ['X-Mailer: sixfold-app']);
$mxOk = !empty($mxRes['ok']);
@file_put_contents($mxState . '/digest.log', json_encode(['at' => time(), 'ok' => $mxOk, 'stage' => $mxRes['stage'] ?? null, 'subject' => $mxSubject]) . "\n", FILE_APPEND | LOCK_EX);
if (!$mxOk) { fwrite(STDERR, 'sixfold morning: not sent (' . ($mxRes['stage'] ?? '?') . ': ' . ($mxRes['error'] ?? '') . ")\n"); exit(1); }
@file_put_contents($mxState . '/last-sent.txt', $mxToday);
echo "sixfold morning: sent \"$mxSubject\"\n";
