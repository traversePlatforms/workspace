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
$adRows = [];
foreach (['meta' => 'Instant Form', 'messenger' => 'Messenger'] as $src => $label) {
    $sp = 0.0; foreach ($ads as $a) if (($a['src'] ?? '') === $src) $sp += (float) $a['spend'];
    $jn = 0; $bk = 0; foreach ($leads as $l) if (($l['src'] ?? '') === $src && isset($jobOf[$l['id']])) { $jn++; $bk += (int) $jobOf[$l['id']]['price']; }
    $back = $sp > 0 ? $bk / $sp : 0;
    $adRows[] = ['l' => $label, 'v' => $jn ? $usd(round($sp / $jn)) . ' per job' : 'no jobs yet', 's' => $usd(round($sp)) . ' spent · ' . $jn . ($jn === 1 ? ' job' : ' jobs') . ' worth ' . $usd($bk) . ' · ' . number_format($back, 2) . 'x back', 't' => $back >= 1 ? 'good' : 'bad'];
}

/* 4. the work: today's jobs and tomorrow's */
$todayJobs = array_values(array_filter($jobs, fn($j) => $j['date'] === $T)); usort($todayJobs, fn($a, $b) => strcmp((string) $a['slot'], (string) $b['slot']));
$tomJobs = array_values(array_filter($jobs, fn($j) => $j['date'] === $tomD)); usort($tomJobs, fn($a, $b) => strcmp((string) $a['slot'], (string) $b['slot']));
$doneN = 0; $doneVal = 0; $crewMins = 0; $couldNot = []; $openN = 0;
foreach ($todayJobs as $j) {
    $o = (string) ($j['done']['o'] ?? '');
    $m = (int) ($j['done']['mins'] ?? 0); foreach ((array) ($j['ridet'] ?? []) as $r) $m += (int) $r['mins'];
    if ($o === 'done') { $doneN++; $doneVal += (int) $j['price']; $crewMins += $m; }
    elseif ($o === 'could not') $couldNot[] = $j; else $openN++;
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

/* the report as data: the picture in the email and the plain-text copy are both drawn from this (2026-10-23, Matthew: "can we make
   that into an image that gets posted in the email so it opens up right away"). A row: l label, v value on the right, s small line
   under it, t tone (good / bad / warn) */
$day = fn(string $iso) => date('D j M', strtotime($iso . ' 12:00'));
$plural = fn(int $n, string $one, string $many) => $n . ' ' . ($n === 1 ? $one : $many);
$bookedVal = array_sum(array_map(fn($j) => (int) $j['price'], $bookedToday)); $tomVal = array_sum(array_map(fn($j) => (int) $j['price'], $tomJobs));
$R = ['date' => $day($T), 'kpis' => [
    ['Money in today', $money['answer'] ? $usd(round($money['today'])) : '?', $money['answer'] ? $plural($money['n'], 'payment', 'payments') : 'Square did not answer'],
    ['Jobs booked', (string) count($bookedToday), $bookedToday ? $usd($bookedVal) : 'none today'],
    ['Jobs done', (string) $doneN, $doneN ? $usd($doneVal) : ($todayJobs ? 'of ' . count($todayJobs) : 'none scheduled')],
    ['Tomorrow', (string) count($tomJobs), $tomJobs ? $usd($tomVal) : 'nothing booked'],
], 'sections' => []];
$sec = [];
if ($money['answer']) { $sec[] = ['l' => 'This week', 'v' => $usd(round($money['week']))]; $sec[] = ['l' => 'This month', 'v' => $usd(round($money['month']))]; }
$sec[] = ['l' => 'Owed on finished jobs', 'v' => $usd($owedDone), 's' => $plural($owedDoneN, 'job', 'jobs'), 't' => $owedDone ? 'warn' : ''];
$sec[] = ['l' => 'Deposits sent, not paid', 'v' => $usd($depOpen), 's' => $plural($depOpenN, 'customer', 'customers')];
$R['sections'][] = ['title' => 'Money', 'rows' => $sec];
$sec = $bookedToday ? [['l' => 'Booked today, by source', 'v' => $usd($bookedVal), 's' => implode(', ', array_map(fn($k, $v) => $k . ' ' . $v, array_keys($bookedBy), $bookedBy))]] : [];
$sec[] = ['l' => 'Quotes sent today', 'v' => (string) $quotedToday, 's' => $quotedVal ? 'worth ' . $usd($quotedVal) : ''];
$sec[] = ['l' => 'Close rate, last 60 days', 'v' => round($close * 100) . '%', 's' => $w60 . ' of ' . $q60 . ' quoted leads booked'];
$sec[] = ['l' => 'Open quotes', 'v' => $usd($pipe), 's' => $plural($pipeN, 'quote', 'quotes')];
$R['sections'][] = ['title' => 'Sales', 'rows' => $sec];
$R['sections'][] = ['title' => 'Ads', 'note' => 'Spend as last typed in Stats' . ($spendAt ? ', ' . date('D j M g:i a', $spendAt) : '') . ((!$spendAt || $spendAt < $t0) ? '. Today\'s spend not typed in yet.' : ''), 'rows' => $adRows];
$sec = [];
foreach ($todayJobs as $j) { $o = (string) ($j['done']['o'] ?? ''); $m = (int) ($j['done']['mins'] ?? 0); foreach ((array) ($j['ridet'] ?? []) as $r) $m += (int) $r['mins'];
    $sec[] = ['l' => $nameOfJob($j), 'v' => $usd((int) $j['price']), 's' => $j['crew'] . ' · ' . ($o === 'done' ? 'done' . ($m ? ' · ' . $dur($m) : '') : ($o === 'could not' ? 'not done: ' . mb_substr((string) ($j['done']['note'] ?? ''), 0, 90) : 'not marked yet')), 't' => $o === 'could not' ? 'bad' : ($o === 'done' ? '' : 'warn')]; }
if ($doneN && $crewMins) $sec[] = ['l' => 'Per crew hour', 'v' => $usd(round($doneVal / ($crewMins / 60))), 's' => $usd($doneVal) . ' of work in ' . $dur($crewMins)];
$R['sections'][] = ['title' => 'Today\'s jobs', 'rows' => $sec, 'empty' => 'None scheduled.'];
$sec = [];
foreach ($tomJobs as $j) $sec[] = ['l' => $nameOfJob($j), 'v' => $usd((int) $j['price']), 's' => (jobSlot((string) $j['slot'])[1] ?? $j['slot']) . ' · ' . $j['crew']];
foreach ($holdsTom as $h) $sec[] = ['l' => $short($h['name']), 'v' => 'held', 's' => 'not signed yet · ' . $h['crew'], 't' => 'warn'];
$R['sections'][] = ['title' => 'Tomorrow', 'rows' => $sec, 'empty' => 'Nothing booked.'];
$sec = [];
$list = fn(array $xs, callable $f) => implode(', ', array_map($f, array_slice($xs, 0, 8))) . (count($xs) > 8 ? ' and ' . (count($xs) - 8) . ' more' : '');
if ($stale) $sec[] = ['l' => 'Quotes, no answer in 3+ days', 'v' => (string) count($stale), 's' => $list($stale, fn($l) => $short($l['name'] ?? '') . ' ' . $usd($qPrice($l))), 't' => 'warn'];
if ($unsigned) $sec[] = ['l' => 'Agreements sent, not signed', 'v' => (string) count($unsigned), 's' => $list($unsigned, fn($l) => $short($l['name'] ?? '')), 't' => 'warn'];
if ($toConfirm) $sec[] = ['l' => 'Square payments not tied to a job', 'v' => (string) $toConfirm, 't' => 'warn'];
if ($couldNot) $sec[] = ['l' => 'Jobs not done today, to rebook', 'v' => (string) count($couldNot), 't' => 'bad'];
$R['sections'][] = ['title' => 'Needs attention', 'rows' => $sec, 'empty' => 'Nothing.'];
$R['sections'][] = ['title' => 'Next six weeks', 'rows' => [
    ['l' => 'Expected', 'v' => $usd($six), 's' => $usd($bk6) . ' booked in ' . $plural($bk6n, 'job', 'jobs') . ' + open quotes at the close rate' . ($planN ? ' + plans' : '')],
    ['l' => 'Customers on monthly plans', 'v' => (string) $planN]]];
$R['foot'] = 'TEST, sent to Matthew only. From the Sixfold 365 app, Square and the ad spend typed in Stats.';

/* the plain-text copy, for mail apps that show no pictures */
$L = ['End of day, ' . $R['date'] . '.', ''];
foreach ($R['kpis'] as [$k, $v, $s]) $L[] = $k . ': ' . $v . ' (' . $s . ')';
foreach ($R['sections'] as $s) {
    $L[] = ''; $L[] = strtoupper($s['title']);
    if (!empty($s['note'])) $L[] = $s['note'];
    if (!$s['rows']) $L[] = '- ' . ($s['empty'] ?? 'Nothing.');
    foreach ($s['rows'] as $r) $L[] = '- ' . $r['l'] . ': ' . $r['v'] . (($r['s'] ?? '') !== '' ? ' (' . $r['s'] . ')' : '');
}
$L[] = ''; $L[] = '-- ' . $R['foot'];
$body = implode("\n", $L);
$subject = 'TEST End of day, ' . $day($T) . ': ' . ($money['answer'] ? $usd(round($money['today'], 2)) . ' in · ' : '') . count($bookedToday) . ' booked · ' . $doneN . ' done · ' . count($tomJobs) . ' tomorrow';

require __DIR__ . '/eod-image.php';
$png = eodImage($R, __DIR__ . '/eod-assets');
if (in_array('--png', $eArgs, true)) { file_put_contents('php://stdout', $png); exit(0); }
if ($eDry) { echo "Subject: $subject\n\n$body\n\n[picture: " . strlen($png) . " bytes]\n"; exit(0); }

/* the email: the picture first (HTML with the picture attached inline, so it shows on opening), the plain text for the rest */
$alt = 'End of day ' . $R['date'] . ': ' . implode(' · ', array_map(fn($k) => $k[0] . ' ' . $k[1], $R['kpis']));
$b1 = 'alt' . bin2hex(random_bytes(8)); $b2 = 'rel' . bin2hex(random_bytes(8)); $cid = 'eod' . bin2hex(random_bytes(6)) . '@sixfold365';
$html = '<!doctype html><html><body style="margin:0;padding:0;background:#ffffff"><div style="max-width:600px;margin:0 auto">'
      . '<img src="cid:' . $cid . '" width="600" alt="' . htmlspecialchars($alt, ENT_QUOTES) . '" style="display:block;width:100%;max-width:600px;height:auto;border:0">'
      . '</div></body></html>';
$e = "\r\n"; $b64 = fn(string $s) => chunk_split(base64_encode($s), 76, "\r\n");
$mime = '--' . $b1 . $e . 'Content-Type: text/plain; charset=UTF-8' . $e . 'Content-Transfer-Encoding: base64' . $e . $e . $b64($body)
      . '--' . $b1 . $e . 'Content-Type: multipart/related; boundary="' . $b2 . '"' . $e . $e
      . '--' . $b2 . $e . 'Content-Type: text/html; charset=UTF-8' . $e . 'Content-Transfer-Encoding: base64' . $e . $e . $b64($html)
      . '--' . $b2 . $e . 'Content-Type: image/png; name="end-of-day.png"' . $e . 'Content-Transfer-Encoding: base64' . $e . 'Content-ID: <' . $cid . '>' . $e . 'Content-Disposition: inline; filename="end-of-day.png"' . $e . $e . $b64($png)
      . '--' . $b2 . '--' . $e . '--' . $b1 . '--' . $e;
$eCfg = require $eApi . '/config.php';
require_once $eApi . '/smtp.php';
$eRes = smtp_send((array) ($eCfg['smtp'] ?? []), (string) $eCfg['to'], '[Sixfold 365] ' . $subject, $mime, ['X-Mailer: sixfold-app', 'Content-Type: multipart/alternative; boundary="' . $b1 . '"']);
if (empty($eRes['ok'])) { fwrite(STDERR, 'eod: not sent (' . ($eRes['stage'] ?? '?') . ")\n"); exit(1); }
echo "eod: sent \"$subject\"\n";
exit(0);

