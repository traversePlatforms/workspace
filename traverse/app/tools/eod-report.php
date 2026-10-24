<?php
declare(strict_types=1);
/* The end-of-day report for Brandon (Matthew 2026-10-23: "Brandon wants end of day reports, what can we include that a ceo might
 * wanna see"): money, sales, ads, the day's work and tomorrow, what needs attention, and the six weeks ahead, on one screen.
 *
 * Lives OUTSIDE public_html, in sixfold-tools/ beside morning-email.php, and works the same way: it loads the app (api/rounds.php)
 * from the command line so the report and the app can't disagree, and sends through the website form's mail setup.
 * TEST STAGE: no cron job yet, and it goes to the form's own inbox (config 'to', Matthew's) until he says who gets it.
 *
 *   php .../eod-report.php --now        send now (marked TEST)
 *   php .../eod-report.php --dry-run    print it instead of sending
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');

$eArgs = array_slice($argv ?? [], 1);
$eDry = in_array('--dry-run', $eArgs, true);
if (!$eDry && !in_array('--now', $eArgs, true)) { fwrite(STDERR, "eod: say --now or --dry-run (no schedule yet)\n"); exit(1); }
$eSite = dirname(__DIR__);
$eApi = getenv('SIXFOLD_API_DIR') ?: $eSite . '/public_html/api';

/* load the app as the morning email does; its functions stay usable after the digest answers */
final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'digest']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
$eD = null;
try { require $eApi . '/rounds.php'; } catch (SixfoldOut $e) { $eD = $e->body; }
if (!is_array($eD) || empty($eD['ok'])) { fwrite(STDERR, "eod: the app did not answer\n"); exit(1); }

$tz = new DateTimeZone(appTz());
$today = new DateTime('today', $tz); $T = $today->format('Y-m-d'); $t0 = $today->getTimestamp(); $now = time();
$tomD = (clone $today)->modify('+1 day')->format('Y-m-d');
$mon = (clone $today)->modify('-' . (((int) $today->format('N')) - 1) . ' days');
$m1 = new DateTime($today->format('Y-m-01'), $tz);
$real = fn($l) => !preg_match('/\btest\b|claude/i', (string) ($l['name'] ?? ''));
$short = function ($n) { $p = preg_split('/\s+/', trim((string) $n)); return ($p[0] ?? '') !== '' ? $p[0] . (isset($p[1]) && $p[1] !== '' ? ' ' . mb_substr($p[1], 0, 1) . '.' : '') : 'A customer'; };
$usd = fn($v) => '$' . number_format((float) $v, (float) $v == floor((float) $v) ? 0 : 2);
$dur = fn(int $m) => $m < 1 ? '' : trim(($m >= 60 ? intdiv($m, 60) . ' h ' : '') . ($m % 60 ? ($m % 60) . ' min' : ''));
$srcName = ['meta' => 'Instant Form', 'messenger' => 'Messenger', 'a365web' => 'Website', 'website' => 'Website', 'phone' => 'Phone', 'referral' => 'Referral', 'nextdoor' => 'Nextdoor', 'linktree' => 'Linktree', 'other' => 'Other'];

$leads = array_filter(leadsAll(), $real);
$jobs = array_filter(jobsAll(), fn($j) => !$j['off'] && $real($leads[$j['lead']] ?? ['name' => '']));
$jobOf = []; foreach ($jobs as $j) $jobOf[(string) $j['lead']] = $j;
$nameOfJob = fn($j) => $short($leads[$j['lead']]['name'] ?? ($j['title'] ?? ''));
$wasQuoted = fn($l) => !empty($l['quote']) || in_array($l['status'] ?? '', ['quoted', 'won'], true) || isset($jobOf[$l['id']]) || in_array(strtolower(trim((string) ($l['cus'] ?? ''))), ['quote sent', 'scheduled', 'completed'], true);
$qPrice = fn($l) => (int) ($l['quote']['price'] ?? 0) ?: (int) ($l['cud'] ?? 0);

/* 1. money: Square, net of refunds */
$money = ['today' => 0.0, 'week' => 0.0, 'month' => 0.0, 'n' => 0, 'answer' => true];
$pays = squareCfg() ? squarePaymentsSince(min($m1->getTimestamp(), $mon->getTimestamp()), 6) : null;
if ($pays === null) $money['answer'] = false;
foreach ((array) $pays as $p) {
    if (($p['status'] ?? '') !== 'COMPLETED') continue;
    $net = ((int) ($p['amount_money']['amount'] ?? 0) - (int) ($p['refunded_money']['amount'] ?? 0)) / 100; if ($net == 0) continue;
    $at = (int) strtotime((string) ($p['created_at'] ?? ''));
    if ($at >= $m1->getTimestamp()) $money['month'] += $net;
    if ($at >= $mon->getTimestamp()) $money['week'] += $net;
    if ($at >= $t0) { $money['today'] += $net; $money['n']++; }
}
$owedDone = 0; $owedDoneN = 0; foreach ($jobs as $j) if (($j['done']['o'] ?? '') === 'done' && ($o = jobOwed($j)) > 0) { $owedDone += $o; $owedDoneN++; }
$depOpen = 0; $depOpenN = 0;
foreach ($leads as $l) if (($l['sign']['how'] ?? '') === 'link' && !empty($l['sign']['pay']['url']) && !a365DepositPaid($l, false) && ($l['status'] ?? '') !== 'lost' && ((($jobOf[$l['id']] ?? null)['pay']['s'] ?? 'unpaid') === 'unpaid')) { $depOpen += (int) ($l['sign']['deposit'] ?? 0); $depOpenN++; }
$toConfirm = is_array($pays) ? count(squareToConfirm(array_values(array_filter($pays, fn($p) => (int) strtotime((string) ($p['created_at'] ?? '')) >= $now - 14 * 86400)))) : 0;

/* 2. sales today */
/* no lead counts (Matthew 2026-10-23): form leads come in by themselves but Messenger ones only when Jen types them in, so lead
   numbers mislead; leads count here once they are jobs */
$quotedToday = 0; $quotedVal = 0;
foreach ($leads as $l) if ((int) ($l['quote']['at'] ?? 0) >= $t0) { $quotedToday++; $quotedVal += (int) ($l['quote']['price'] ?? 0); }
$bookedToday = []; $bookedBy = [];
foreach ($jobs as $j) if ((int) ($j['at'] ?? 0) >= $t0) { $bookedToday[] = $j; $s = $srcName[$leads[$j['lead']]['src'] ?? 'other'] ?? 'Other'; $bookedBy[$s] = ($bookedBy[$s] ?? 0) + 1; }
arsort($bookedBy);
$cut = $now - 60 * 86400; $q60 = 0; $w60 = 0;
foreach ($leads as $l) { if ((int) ($l['at'] ?? 0) < $cut || !$wasQuoted($l)) continue; $q60++; if (isset($jobOf[$l['id']]) || ($l['status'] ?? '') === 'won') $w60++; }
$close = $q60 ? $w60 / $q60 : 0.0;
$pipe = 0; $pipeN = 0; foreach ($leads as $l) { if (isset($jobOf[$l['id']]) || in_array($l['status'] ?? '', ['lost', 'won'], true) || !$wasQuoted($l) || $qPrice($l) < 1) continue; $pipe += $qPrice($l); $pipeN++; }

/* 3. ads: lifetime spend as typed in Stats, against the leads and jobs each ad's leads became */
$ads = adSpend(); $spendAt = (int) (json_decode((string) @file_get_contents(adSpendFile()), true)['at'] ?? 0);
$adLines = [];
foreach (['meta' => 'Instant Form', 'messenger' => 'Messenger'] as $src => $label) {
    $sp = 0.0; foreach ($ads as $a) if (($a['src'] ?? '') === $src) $sp += (float) $a['spend'];
    $jn = 0; $bk = 0; foreach ($leads as $l) if (($l['src'] ?? '') === $src && isset($jobOf[$l['id']])) { $jn++; $bk += (int) $jobOf[$l['id']]['price']; }
    $adLines[] = '- ' . $label . ': ' . $usd(round($sp, 2)) . ' spent, ' . $jn . ($jn === 1 ? ' job' : ' jobs') . ' booked worth ' . $usd($bk) . ($jn ? ' (' . $usd(round($sp / $jn, 2)) . ' of ads per job, ' . number_format($bk / max(0.01, $sp), 2) . 'x back)' : '');
}

/* 4. the work: today's jobs and tomorrow's */
$todayJobs = array_values(array_filter($jobs, fn($j) => $j['date'] === $T)); usort($todayJobs, fn($a, $b) => strcmp((string) $a['slot'], (string) $b['slot']));
$tomJobs = array_values(array_filter($jobs, fn($j) => $j['date'] === $tomD)); usort($tomJobs, fn($a, $b) => strcmp((string) $a['slot'], (string) $b['slot']));
$doneN = 0; $doneVal = 0; $crewMins = 0; $couldNot = []; $openN = 0; $workLines = [];
foreach ($todayJobs as $j) {
    $o = (string) ($j['done']['o'] ?? '');
    $m = (int) ($j['done']['mins'] ?? 0); foreach ((array) ($j['ridet'] ?? []) as $r) $m += (int) $r['mins'];
    if ($o === 'done') { $doneN++; $doneVal += (int) $j['price']; $crewMins += $m; }
    elseif ($o === 'could not') $couldNot[] = $j; else $openN++;
    $workLines[] = '- ' . $nameOfJob($j) . ' · ' . $j['crew'] . ' · ' . $usd((int) $j['price']) . ' · ' . ($o === 'done' ? 'done' . ($m ? ', ' . $dur($m) . ' crew time' : '') : ($o === 'could not' ? 'NOT DONE: ' . mb_substr((string) ($j['done']['note'] ?? ''), 0, 120) : 'not marked yet'));
}
$holdsTom = array_values(array_filter(jobHolds($leads), fn($h) => $h['date'] === $tomD));

/* 5. needs attention */
$stale = array_values(array_filter($leads, fn($l) => !empty($l['quote']) && !isset($jobOf[$l['id']]) && !in_array($l['status'] ?? '', ['lost', 'won'], true) && (int) ($l['quote']['at'] ?? 0) < $now - 3 * 86400));
$unsigned = array_values(array_filter($leads, fn($l) => !empty($l['sign']) && empty($l['signed']) && !isset($jobOf[$l['id']]) && ($l['status'] ?? '') !== 'lost'));

/* 6. six weeks ahead: booked + open quotes x close rate + plans (the Stats page's formula) */
$mrr = 0.0; $planN = 0; $per = ['monthly' => 1, 'quarterly' => 1 / 3, 'yearly' => 1 / 12];
foreach (loadCustomers() as $c) { $pl = (string) ($c['plan'] ?? 'oneoff'); if (($c['status'] ?? 'active') !== 'active' || !isset($per[$pl])) continue; $mrr += (float) ($c['price'] ?? 0) * $per[$pl]; $planN++; }
$sixTo = (clone $mon)->modify('+41 days')->format('Y-m-d'); $bk6 = 0; $bk6n = 0;
foreach ($jobs as $j) if ($j['date'] >= $mon->format('Y-m-d') && $j['date'] <= $sixTo) { $bk6 += (int) $j['price']; $bk6n++; }
$six = $bk6 + round($pipe * $close) + round($mrr * 12 / 52 * 6);

/* the email */
$day = fn(string $iso) => date('D j M', strtotime($iso . ' 12:00'));
$L = [];
$L[] = 'End of day, ' . $day($T) . '.';
$L[] = '';
$L[] = 'MONEY';
if (!$money['answer']) $L[] = '- Square did not answer, so no payment figures tonight.';
else {
    $L[] = '- In today: ' . $usd(round($money['today'], 2)) . ' (' . $money['n'] . ($money['n'] === 1 ? ' payment' : ' payments') . ')';
    $L[] = '- This week: ' . $usd(round($money['week'], 2)) . ' · This month: ' . $usd(round($money['month'], 2));
}
$L[] = '- Owed on finished jobs: ' . $usd($owedDone) . ' (' . $owedDoneN . ($owedDoneN === 1 ? ' job' : ' jobs') . ')';
$L[] = '- Deposits sent, not paid yet: ' . $usd($depOpen) . ' (' . $depOpenN . ')';
$L[] = '';
$L[] = 'SALES TODAY';
$L[] = '- Jobs booked: ' . count($bookedToday) . ($bookedToday ? ' worth ' . $usd(array_sum(array_map(fn($j) => (int) $j['price'], $bookedToday))) . ' (' . implode(', ', array_map(fn($k, $v) => $k . ' ' . $v, array_keys($bookedBy), $bookedBy)) . ')' : '');
$L[] = '- Quotes sent: ' . $quotedToday . ($quotedVal ? ' worth ' . $usd($quotedVal) : '');
$L[] = '- Close rate, last 60 days: ' . round($close * 100) . '% (' . $w60 . ' of ' . $q60 . ' quoted leads booked)';
$L[] = '- Open quotes: ' . $pipeN . ' worth ' . $usd($pipe);
$L[] = '';
$L[] = 'ADS (spend as last typed in Stats' . ($spendAt ? ', ' . date('D j M g:i a', $spendAt) : '') . ')';
foreach ($adLines as $x) $L[] = $x;
if (!$spendAt || $spendAt < $t0) $L[] = '- Today\'s spend has not been typed in yet, so these are the figures from the last update.';
$L[] = '';
$L[] = 'TODAY\'S JOBS (' . count($todayJobs) . ': ' . $doneN . ' done, ' . count($couldNot) . ' not done, ' . $openN . ' not marked)';
if (!$todayJobs) $L[] = '- None scheduled.';
foreach ($workLines as $x) $L[] = $x;
if ($doneN) $L[] = '- Finished work: ' . $usd($doneVal) . ($crewMins ? ' for ' . $dur($crewMins) . ' of crew time (' . $usd(round($doneVal / ($crewMins / 60))) . ' per crew hour)' : '');
$L[] = '';
$L[] = 'TOMORROW (' . count($tomJobs) . ($tomJobs ? ' jobs worth ' . $usd(array_sum(array_map(fn($j) => (int) $j['price'], $tomJobs))) : ' jobs') . ')';
if (!$tomJobs && !$holdsTom) $L[] = '- Nothing booked.';
foreach ($tomJobs as $j) $L[] = '- ' . (jobSlot((string) $j['slot'])[1] ?? $j['slot']) . ' · ' . $nameOfJob($j) . ' · ' . $j['crew'] . ' · ' . $usd((int) $j['price']);
foreach ($holdsTom as $h) $L[] = '- Held (not signed yet): ' . $short($h['name']) . ' · ' . $h['crew'];
$L[] = '';
$L[] = 'NEEDS ATTENTION';
$any = false;
if ($stale) { $any = true; $L[] = '- ' . count($stale) . (count($stale) === 1 ? ' quote' : ' quotes') . ' with no answer after 3 days: ' . implode(', ', array_map(fn($l) => $short($l['name'] ?? '') . ' ' . $usd($qPrice($l)), array_slice($stale, 0, 8))) . (count($stale) > 8 ? ' and ' . (count($stale) - 8) . ' more' : ''); }
if ($unsigned) { $any = true; $L[] = '- ' . count($unsigned) . (count($unsigned) === 1 ? ' agreement' : ' agreements') . ' sent, not signed: ' . implode(', ', array_map(fn($l) => $short($l['name'] ?? ''), array_slice($unsigned, 0, 8))); }
if ($toConfirm) { $any = true; $L[] = '- ' . $toConfirm . ' Square ' . ($toConfirm === 1 ? 'payment' : 'payments') . ' not tied to a job yet'; }
if ($couldNot) { $any = true; $L[] = '- ' . count($couldNot) . (count($couldNot) === 1 ? ' job' : ' jobs') . ' not done today, to rebook'; }
if (!$any) $L[] = '- Nothing.';
$L[] = '';
$L[] = 'NEXT SIX WEEKS';
$L[] = '- Expected: about ' . $usd($six) . ' (' . $usd($bk6) . ' booked in ' . $bk6n . ($bk6n === 1 ? ' job' : ' jobs') . ', plus open quotes at the close rate' . ($planN ? ', plus ' . $planN . ' monthly plans' : '') . ')';
$L[] = '- Customers on monthly plans: ' . $planN;
$L[] = '';
$L[] = '-- TEST of the end-of-day report, sent to Matthew only. Figures come from the Sixfold 365 app, Square and the ad spend typed in Stats.';
$body = implode("\n", $L);
$subject = 'TEST End of day, ' . $day($T) . ': ' . ($money['answer'] ? $usd(round($money['today'], 2)) . ' in · ' : '') . count($bookedToday) . ' booked · ' . $doneN . ' done · ' . count($tomJobs) . ' tomorrow';

if ($eDry) { echo "Subject: $subject\n\n$body\n"; exit(0); }
$eCfg = require $eApi . '/config.php';
require_once $eApi . '/smtp.php';
$eRes = smtp_send((array) ($eCfg['smtp'] ?? []), (string) $eCfg['to'], '[Sixfold 365] ' . $subject, $body, ['X-Mailer: sixfold-app']);
if (empty($eRes['ok'])) { fwrite(STDERR, 'eod: not sent (' . ($eRes['stage'] ?? '?') . ")\n"); exit(1); }
echo "eod: sent \"$subject\"\n";
