<?php
declare(strict_types=1);
/* The end-of-day report for Brandon (Matthew 2026-10-23: "Brandon wants end of day reports, what can we include that a ceo might
 * wanna see"): money, sales, ads, the day's work and tomorrow, what needs attention, and the six weeks ahead, on one screen.
 *
 * Lives OUTSIDE public_html, in sixfold-tools/ beside morning-email.php, and works the same way: it loads the app (api/rounds.php)
 * from the command line so the report and the app can't disagree, and sends through the website form's mail setup.
 * A SiteGround cron job runs it every hour; it sends once a day, at the first run at or after 8 pm Colorado time (an hour after
 * the 7 pm ad-spend reminder, so the day's spend is usually in). Two separate emails, so neither sees the other's address:
 * Brandon (Bincline@gmail.com) and Matthew's copy to the website form's inbox (config 'to', Contact@SixfoldColorado.com).
 * Matthew 2026-10-23: "i want a copy of it, sent to my sixfold website, and do it to Bincline@gmail.com".
 *
 *   php .../eod-report.php                send if it's time and not sent today
 *   php .../eod-report.php --now          send now, to both (whatever the time)
 *   php .../eod-report.php --test         send now, to Matthew's copy only, marked TEST
 *   php .../eod-report.php --now --brandon   send now, to Brandon only
 *   php .../eod-report.php --dry-run      print it instead of sending (--dry-run --png: the picture)
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');

const EOD_HOUR = 20;
const EOD_BRANDON = 'Bincline@gmail.com';
$eArgs = array_slice($argv ?? [], 1);
$eDry = in_array('--dry-run', $eArgs, true); $eTest = in_array('--test', $eArgs, true);
$eSite = dirname(__DIR__);
$eApi = getenv('SIXFOLD_API_DIR') ?: $eSite . '/public_html/api';
$eState = $eSite . '/sixfold-data/digest';
if (!$eDry && !$eTest && !in_array('--now', $eArgs, true)) {
    if ((int) date('G') < EOD_HOUR) exit(0);
    if (trim((string) @file_get_contents($eState . '/eod-last-sent.txt')) === date('Y-m-d')) exit(0);
}

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
$short = function ($n) { $p = preg_split('/\s+/', trim((string) $n)); return ($p[0] ?? '') !== '' ? $p[0] . (isset($p[1]) && $p[1] !== '' ? ' ' . mb_strtoupper(mb_substr($p[1], 0, 1)) . '.' : '') : 'A customer'; };
$usd = fn($v) => '$' . number_format((float) $v, (float) $v == floor((float) $v) ? 0 : 2);
$dur = fn(int $m) => $m < 1 ? '' : trim(($m >= 60 ? intdiv($m, 60) . ' h ' : '') . ($m % 60 ? ($m % 60) . ' min' : ''));
$srcName = ['meta' => 'Instant Form', 'messenger' => 'Messenger', 'a365web' => 'Website', 'website' => 'Website', 'phone' => 'Phone', 'referral' => 'Referral', 'nextdoor' => 'Nextdoor', 'linktree' => 'Linktree', 'other' => 'Other'];

$allLeads = leadsAll(); $leads = array_filter($allLeads, $real);
$jobs = array_filter(jobsAll(), fn($j) => !$j['off'] && $real($allLeads[$j['lead']] ?? ['name' => '']));   /* a test lead's job is a test job too (review 2026-10-25: looked up in the filtered list, it was kept) */
$jobOf = []; foreach ($jobs as $j) $jobOf[(string) $j['lead']] = $j;
$nameOfJob = fn($j) => $short($leads[$j['lead']]['name'] ?? ($j['title'] ?? ''));
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
/* a quote counts on the day it was first sent; a revised one is not new (audit 2026-10-23: Pat S. was quoted the day before) */
$qFirst = []; foreach (readLines(leadsDir() . '/leadst.log') as $u) if (!empty($u['quote']) && !isset($qFirst[$u['id']])) $qFirst[$u['id']] = (int) ($u['at'] ?? 0);
foreach ($leads as $l) if (!empty($l['quote']) && ($qFirst[$l['id']] ?? 0) >= $t0) { $quotedToday++; $quotedVal += (int) ($l['quote']['price'] ?? 0); }
$bookedToday = []; $bookedBy = [];
foreach ($jobs as $j) if ((int) ($j['at'] ?? 0) >= $t0) { $bookedToday[] = $j; $s = $srcName[$leads[$j['lead']]['src'] ?? 'other'] ?? 'Other'; $bookedBy[$s] = ($bookedBy[$s] ?? 0) + 1; }
arsort($bookedBy);
/* close rates, ad leads and the rest apart, the app's own closeRates() so the report and the Stats page agree (2026-10-24) */
$CR = closeRates($leads, $jobOf); $pipe = $CR['pipe']; $pipeN = $CR['pipeN'];
$crLine = fn(array $g) => $g['quoted'] ? $g['won'] . ' of ' . $g['quoted'] . ' quoted booked' : 'none quoted yet';

$wk0 = $now - 7 * 86400;   /* the last 7 days, for the Messenger count below and the leads further on */
/* Messenger chats started, read from Facebook itself (2026-10-26, Matthew: "It needs to pull from all the leads on facebook not just what was
   added in the pipeline manually"): the Sixfold 365 page's conversations; a chat counts on the day its first message came in. Form leads
   need nothing extra: the app already takes every one from Facebook every 5 minutes. */
$msgr = null;
$mf = json_decode((string) @file_get_contents(metaFile()), true);
if (is_array($mf) && !empty($mf['pages'][0]['token'])) {
    $pg = $mf['pages'][0]; $tok = (string) $pg['token'];
    $gget = function (string $u) { $ctx = stream_context_create(['http' => ['timeout' => 15, 'ignore_errors' => true]]); $r = @file_get_contents($u, false, $ctx); return is_string($r) ? (json_decode($r, true) ?: []) : []; };
    $cv = $gget($mf['graph'] . '/' . rawurlencode((string) $pg['id']) . '/conversations?' . http_build_query(['platform' => 'messenger', 'fields' => 'updated_time', 'limit' => 100, 'access_token' => $tok]));
    if (isset($cv['data'])) {
        $msgr = ['today' => 0, 'week' => 0, 'all' => count($cv['data'])];
        foreach ($cv['data'] as $c) {
            if ((int) strtotime((string) ($c['updated_time'] ?? '')) < $wk0) continue;   /* nothing new in it this week, so not started this week */
            $ms = $gget($mf['graph'] . '/' . rawurlencode((string) $c['id']) . '/messages?' . http_build_query(['fields' => 'created_time', 'limit' => 100, 'access_token' => $tok]));
            if (!isset($ms['data']) || !$ms['data'] || !empty($ms['paging']['next'])) continue;   /* a long chat: it started before this week */
            $first = min(array_map(fn($m) => (int) strtotime((string) ($m['created_time'] ?? '')), $ms['data']));
            if ($first >= $wk0) $msgr['week']++; if ($first >= $t0) $msgr['today']++;
        }
    }
}
/* 3. ads: lifetime spend as typed in Stats, against the leads and jobs each ad's leads became */
$ads = adSpend(); $spendAt = (int) (json_decode((string) @file_get_contents(adSpendFile()), true)['at'] ?? 0);
$adRows = [];
foreach (['meta' => 'Instant Form', 'messenger' => 'Messenger'] as $src => $label) {
    $sp = 0.0; $mres = 0; foreach ($ads as $a) if (($a['src'] ?? '') === $src) { $sp += (float) $a['spend']; $mres += (int) ($a['results'] ?? 0); }   /* Meta's own results beside the spend (2026-10-26) */
    $jn = 0; $bk = 0; foreach ($leads as $l) if (($l['src'] ?? '') === $src && isset($jobOf[$l['id']])) { $jn++; $bk += (int) $jobOf[$l['id']]['price']; }
    $ln = 0; $lw = 0; foreach ($leads as $l) if (($l['src'] ?? '') === $src) { $ln++; if ((int) ($l['at'] ?? 0) >= $now - 7 * 86400) $lw++; }
    if ($src === 'messenger' && $msgr !== null) { $ln = $msgr['all']; $lw = $msgr['week']; }
    if ($mres > 0) $ln = $mres;   /* the count Meta shows with that spend, so the cost each matches Meta's */   /* the chats on Facebook, not only those typed in (2026-10-26) */   /* leads and cost per lead (2026-10-26) */
    $back = $sp > 0 ? $bk / $sp : 0;
    $adRows[] = ['l' => $label, 'v' => $jn ? $usd(round($sp / $jn)) . ' per job' : 'no jobs yet', 's' => $usd(round($sp)) . ' spent · ' . $ln . ($src === 'messenger' ? ($ln === 1 ? ' conversation' : ' conversations') : ($ln === 1 ? ' lead' : ' leads')) . ($mres > 0 ? ' on Meta' : '') . ($ln && $sp > 0 ? ' (' . $usd(round($sp / $ln, 2)) . ' each)' : '') . ', ' . $lw . ' in the last 7 days' . ($src === 'messenger' ? ($msgr !== null ? ' (chats on Facebook)' : ' (as typed in)') : '') . ' · ' . $jn . ($jn === 1 ? ' job' : ' jobs') . ' worth ' . $usd($bk) . ' · ' . number_format($back, 2) . 'x back', 't' => $back >= 1 ? 'good' : 'bad'];
}
/* referrals on their own line, not in an ad's figures (Matthew 2026-10-23: Russ and Carlos, Eric's referrals, "make it a different subject") */
const EOD_NOT_REFERRAL = ['m20261016192625ffe257'];   /* Kara R.: not counted with the ad referrals (Matthew 2026-10-23) */
$refJ = []; foreach ($leads as $l) if (($l['src'] ?? '') === 'referral' && isset($jobOf[$l['id']]) && !in_array($l['id'], EOD_NOT_REFERRAL, true)) $refJ[] = $l;
if ($refJ) $adRows[] = ['l' => 'Referrals', 'v' => $usd(array_sum(array_map(fn($l) => (int) $jobOf[$l['id']]['price'], $refJ))), 's' => count($refJ) . (count($refJ) === 1 ? ' job' : ' jobs') . ', no ad spend · ' . implode(', ', array_map(fn($l) => $short($l['name'] ?? ''), $refJ)), 't' => 'good'];

/* 3b. leads, quotes waiting and content posted (2026-10-26, Brandon via Matthew: "ad results and leads, content posted, he wants to know how
   many quotes we have that are just sitting in the pipeline/text/email etc"). This brings back the lead counts left out on 23 Oct; the
   Messenger number is only the chats Jen typed in, and says so. */
$wk0 = $now - 7 * 86400; $srcOf = fn($l) => $srcName[$l['src'] ?? 'other'] ?? 'Other';
$inToday = []; $inWeek = []; $srcAll = [];
foreach ($leads as $l) { $at = (int) ($l['at'] ?? 0); $s = $srcOf($l); $srcAll[$l['src'] ?? 'other'] = ($srcAll[$l['src'] ?? 'other'] ?? 0) + 1;
    if ($at >= $t0) $inToday[$s] = ($inToday[$s] ?? 0) + 1; if ($at >= $wk0) $inWeek[$s] = ($inWeek[$s] ?? 0) + 1; }
arsort($inToday); arsort($inWeek);
/* waiting on us: open leads not quoted yet, by where the last try left them */
$wait = ['Not contacted yet' => 0, 'Left a voicemail' => 0, 'Texted, no reply yet' => 0, 'Emailed, no reply yet' => 0, 'Call back on a set day' => 0, 'Talked, not booked' => 0];
foreach ($leads as $l) {
    if (!in_array($l['status'] ?? 'new', ['new', 'contacted'], true) || !empty($l['quote']) || isset($jobOf[$l['id']])) continue;
    $lt = end($l['tries']) ?: null; $o = (string) ($lt['o'] ?? '');
    $k = !empty($l['recall']['date']) ? 'Call back on a set day' : ($o === '' ? 'Not contacted yet' : ($o === 'vm' ? 'Left a voicemail' : ($o === 'text' ? 'Texted, no reply yet' : ($o === 'email' ? 'Emailed, no reply yet' : 'Talked, not booked'))));
    $wait[$k]++;
}
$waitN = array_sum($wait);
/* quotes waiting on a yes: the same open quotes as the Sales line (closeRates), by how far they got and how long they have waited */
$qw = ['form' => [0, 0], 'sent' => [0, 0], 'phone' => [0, 0]]; $qAge = [0, 0, 0]; $formList = [];
foreach ($leads as $l) {
    $was = !empty($l['quote']) || in_array($l['status'] ?? '', ['quoted', 'won'], true) || in_array(strtolower(trim((string) ($l['cus'] ?? ''))), ['quote sent', 'scheduled', 'complete', 'completed'], true);
    if (!$was || isset($jobOf[$l['id']]) || in_array($l['status'] ?? '', ['lost', 'won'], true) || $qPrice($l) <= 0) continue;
    $k = (!empty($l['sign']) && empty($l['signed'])) ? 'form' : (!empty($l['quote']['sent']) ? 'sent' : 'phone');
    $qw[$k][0]++; $qw[$k][1] += $qPrice($l); if ($k === 'form') $formList[] = $l;
    $qa = $now - (int) ($qFirst[$l['id']] ?? ($l['statusAt'] ?? ($l['at'] ?? $now))); $qAge[$qa < 3 * 86400 ? 0 : ($qa < 8 * 86400 ? 1 : 2)]++;
}
/* where follow-up slips (2026-10-26, Brandon via Matthew: "find the holes in our system process ... for example how many quotes we have sent out
   that havent been double backed on"). Counted from the calls, texts and emails logged in the app; one not logged counts as not done. */
$tryAfter = function (array $l, int $since): bool { foreach ((array) ($l['tries'] ?? []) as $t) if ((int) ($t['at'] ?? 0) > $since) return true; return false; };
$noFollow = []; $vmOld = []; $txtOld = []; $speed = ['hour' => 0, 'day' => 0, 'later' => 0, 'never' => 0]; $saidNo = []; $gaveUp = 0;
foreach ($leads as $l) {
    $st = (string) ($l['status'] ?? 'new');
    /* quotes given 2+ days ago with no call, text or email logged since */
    $was = !empty($l['quote']) || $st === 'quoted' || in_array(strtolower(trim((string) ($l['cus'] ?? ''))), ['quote sent', 'scheduled', 'complete', 'completed'], true);
    if ($was && !isset($jobOf[$l['id']]) && !in_array($st, ['lost', 'won'], true) && $qPrice($l) > 0 && empty($l['signed'])) {
        $qt = (int) ($qFirst[$l['id']] ?? ($l['statusAt'] ?? ($l['at'] ?? $now)));
        if ($qt < $now - 2 * 86400 && !$tryAfter($l, $qt)) $noFollow[] = $l;
    }
    /* open leads: a voicemail not tried again within a day, a text or email with no next step in two */
    if (in_array($st, ['new', 'contacted'], true) && empty($l['quote']) && !isset($jobOf[$l['id']]) && empty($l['recall']['date'])) {
        $lt = end($l['tries']) ?: null;
        if ($lt && $lt['o'] === 'vm' && (int) $lt['at'] < $now - 86400) $vmOld[] = $l;
        if ($lt && in_array($lt['o'], ['text', 'email'], true) && (int) $lt['at'] < $now - 2 * 86400) $txtOld[] = $l;
    }
    /* said no or gave up, in the last 7 days (2026-10-26, Matthew: "include a lost section or people that said no") */
    if ((int) ($l['statusAt'] ?? 0) >= $wk0) {
        if ($st === 'lost') { $why = ''; foreach (array_reverse((array) ($l['notes'] ?? [])) as $n) { $tx = (string) ($n['note'] ?? ($n['t'] ?? '')); if (preg_match('/not interested[^:]*:s*(.+)$/i', $tx, $mm)) { $why = trim($mm[1], ' .'); break; } } $saidNo[] = [$l, $why]; }
        elseif ($st === 'unreached') $gaveUp++;
    }
    /* how fast the online leads of the last 7 days got their first call, text or email */
    if (in_array($l['src'] ?? '', ['meta', 'a365web'], true) && (int) ($l['at'] ?? 0) >= $wk0) {
        $ft = null; foreach ((array) ($l['tries'] ?? []) as $t) $ft = $ft === null ? (int) $t['at'] : min($ft, (int) $t['at']);
        $gap = $ft === null ? null : $ft - (int) $l['at'];
        $speed[$gap === null ? 'never' : ($gap <= 3600 ? 'hour' : ($gap <= 86400 ? 'day' : 'later'))]++;
    }
}

/* 4. the work: today's jobs and tomorrow's */
$todayJobs = array_values(array_filter($jobs, fn($j) => $j['date'] === $T)); usort($todayJobs, fn($a, $b) => strcmp((string) $a['slot'], (string) $b['slot']));
$tomJobs = array_values(array_filter($jobs, fn($j) => $j['date'] === $tomD)); usort($tomJobs, fn($a, $b) => strcmp((string) $a['slot'], (string) $b['slot']));
$doneN = 0; $doneVal = 0; $crewMins = 0; $timedVal = 0; $couldNot = []; $openN = 0;
foreach ($todayJobs as $j) {
    $o = (string) ($j['done']['o'] ?? '');
    $m = (int) ($j['done']['mins'] ?? 0); foreach ((array) ($j['ridet'] ?? []) as $r) $m += (int) $r['mins'];
    if ($o === 'done') { $doneN++; $doneVal += (int) $j['price']; $crewMins += $m; if ($m > 0) $timedVal += (int) $j['price']; }   /* per crew hour: only jobs with time logged (2026-10-26) */
    elseif ($o === 'could not') $couldNot[] = $j; else $openN++;
}
$holdsTom = array_values(array_filter(jobHolds($leads), fn($h) => $h['date'] === $tomD));

/* 5. needs attention */
$stale = array_values(array_filter($leads, fn($l) => !empty($l['quote']) && !isset($jobOf[$l['id']]) && !in_array($l['status'] ?? '', ['lost', 'won'], true) && (int) ($l['quote']['at'] ?? 0) < $now - 3 * 86400));
$unsigned = array_values(array_filter($leads, fn($l) => !empty($l['sign']) && empty($l['signed']) && !isset($jobOf[$l['id']]) && ($l['status'] ?? '') !== 'lost'));

/* 6. six weeks ahead: booked + open quotes x close rate + plans (the Stats page's formula) */
$mrr = 0.0; $planN = 0; $per = ['monthly' => 1, 'quarterly' => 1 / 3, 'yearly' => 1 / 12];
foreach (loadCustomers() as $c) { $pl = (string) ($c['plan'] ?? 'oneoff'); if (($c['status'] ?? 'active') !== 'active' || !isset($per[$pl])) continue; $mrr += (float) ($c['price'] ?? 0) * $per[$pl]; $planN++; }
/* from tomorrow on: work already done this week isn't ahead (audit 2026-10-23) */
$sixTo = (clone $today)->modify('+42 days')->format('Y-m-d'); $bk6 = 0; $bk6n = 0;
foreach ($jobs as $j) if ($j['date'] > $T && $j['date'] <= $sixTo) { $bk6 += (int) $j['price']; $bk6n++; }
$six = $bk6 + $CR['expected'] + round($mrr * 12 / 52 * 6);

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
$R['sections'][] = ['title' => 'Money', 'rows' => $sec];
$sec = $bookedToday ? [['l' => 'Booked today, by source', 'v' => $usd($bookedVal), 's' => implode(', ', array_map(fn($k, $v) => $k . ' ' . $v, array_keys($bookedBy), $bookedBy))]] : [];
$sec[] = ['l' => 'Quotes sent today', 'v' => (string) $quotedToday, 's' => $quotedVal ? 'worth ' . $usd($quotedVal) : ''];

$sec[] = ['l' => 'Open quotes', 'v' => $usd($pipe), 's' => $plural($pipeN, 'quote', 'quotes')];
$R['sections'][] = ['title' => 'Sales', 'rows' => $sec];
$qwN = $qw['form'][0] + $qw['sent'][0] + $qw['phone'][0]; $qwV = $qw['form'][1] + $qw['sent'][1] + $qw['phone'][1];
/* how each open quote went out, in two plain lines (Matthew 2026-10-26: "make the number more simplified in terms of how it was sent") */
$R['sections'][] = ['title' => 'Quotes waiting on a yes', 'rows' => $qwN ? [
    ['l' => 'Signing form sent, waiting for them to sign', 'v' => (string) $qw['form'][0], 's' => $usd($qw['form'][1])],
    ['l' => 'Price given, no signing form sent yet', 'v' => (string) ($qw['sent'][0] + $qw['phone'][0]), 's' => $usd($qw['sent'][1] + $qw['phone'][1])],
    ['l' => 'How long they have waited', 'v' => (string) $qwN, 's' => $qAge[0] . ' under 3 days, ' . $qAge[1] . ' 3 to 7 days, ' . $qAge[2] . ' over a week · ' . $usd($qwV) . ' in all', 't' => $qAge[2] ? 'warn' : '']] : [], 'empty' => 'None.'];
/* leads: the Facebook form and Messenger as Facebook counts them, the rest as entered */
/* said no, last 7 days (2026-10-26) */
$noVal = array_sum(array_map(fn($x) => $qPrice($x[0]), $saidNo));
$R['sections'][] = ['title' => 'Said no, last 7 days', 'rows' => array_merge($saidNo ? [['l' => 'Not interested', 'v' => (string) count($saidNo), 's' => ($noVal ? $usd($noVal) . ' in quotes · ' : '') . implode(', ', array_map(fn($x) => $short($x[0]['name'] ?? '') . ($x[1] !== '' ? ' (' . mb_substr($x[1], 0, 40) . ')' : ''), array_slice($saidNo, 0, 8))) . (count($saidNo) > 8 ? ' and ' . (count($saidNo) - 8) . ' more' : '')]] : [], $gaveUp ? [['l' => 'Gave up, could not reach', 'v' => (string) $gaveUp]] : []), 'empty' => 'Nobody said no this week.'];
$typed = fn(array $by) => array_diff_key($by, ['Instant Form' => 1, 'Messenger' => 1]);
$leadLine = function (string $when, array $by) use ($msgr) {
    $parts = ['Facebook form ' . (int) ($by['Instant Form'] ?? 0)];
    $parts[] = 'Messenger chats ' . ($msgr !== null ? (int) $msgr[$when] : (int) ($by['Messenger'] ?? 0) . ' (as entered)');
    foreach (array_diff_key($by, ['Instant Form' => 1, 'Messenger' => 1]) as $k => $v) $parts[] = $k . ' ' . $v;
    return [array_sum(array_map(fn($p) => (int) preg_replace('/\D.*$/', '', (string) preg_replace('/^\D+/', '', $p)), $parts)), implode(', ', $parts)];
};
[$nT, $sT] = $leadLine('today', $inToday); [$nW, $sW] = $leadLine('week', $inWeek);
$rowsL = [['l' => 'New leads today', 'v' => (string) $nT, 's' => $sT], ['l' => 'New leads, last 7 days', 'v' => (string) $nW, 's' => $sW]];
$rowsL[] = ['l' => 'Waiting on us to reach them', 'v' => (string) $waitN, 's' => implode(', ', array_map(fn($k, $v) => $k . ' ' . $v, array_keys(array_filter($wait)), array_filter($wait))), 't' => $wait['Not contacted yet'] ? 'warn' : ''];
$R['sections'][] = ['title' => 'Leads', 'note' => 'Facebook form and Messenger counted from Facebook itself' . ($msgr === null ? ' (Messenger could not be read today, so as entered)' : '') . '; phone, website and referrals as they came into the app.', 'rows' => $rowsL];
$R['sections'][] = ['title' => 'Ads and referrals', 'note' => 'Spend as last typed in Stats' . ($spendAt ? ', ' . date('D j M g:i a', $spendAt) : '') . '. The app cannot read the ad account these ads run on yet, so spend is only as fresh as the last time it was typed in.', 'rows' => $adRows];

$sec = [];
foreach ($todayJobs as $j) { $o = (string) ($j['done']['o'] ?? ''); $m = (int) ($j['done']['mins'] ?? 0); foreach ((array) ($j['ridet'] ?? []) as $r) $m += (int) $r['mins'];
    $sec[] = ['l' => $nameOfJob($j), 'v' => $usd((int) $j['price']), 's' => $j['crew'] . ' · ' . ($o === 'done' ? 'done' . ($m ? ' · ' . $dur($m) : '') : ($o === 'could not' ? 'not done: ' . mb_substr((string) ($j['done']['note'] ?? ''), 0, 90) : 'not marked yet')), 't' => $o === 'could not' ? 'bad' : ($o === 'done' ? '' : 'warn')]; }
if ($doneN && $crewMins) $sec[] = ['l' => 'Per crew hour', 'v' => $usd(round($timedVal / ($crewMins / 60))), 's' => $usd($timedVal) . ' of work in ' . $dur($crewMins) . ($timedVal < $doneVal ? ' (jobs with time logged)' : '')];
$R['sections'][] = ['title' => 'Today\'s jobs', 'rows' => $sec, 'empty' => 'None scheduled.'];
$sec = [];
foreach ($tomJobs as $j) $sec[] = ['l' => $nameOfJob($j), 'v' => $usd((int) $j['price']), 's' => (jobSlot((string) $j['slot'])[1] ?? $j['slot']) . ' · ' . $j['crew']];
foreach ($holdsTom as $h) $sec[] = ['l' => $short($h['name']), 'v' => 'held', 's' => 'not signed yet · ' . $h['crew'], 't' => 'warn'];
$R['sections'][] = ['title' => 'Tomorrow', 'rows' => $sec, 'empty' => 'Nothing booked.'];
$sec = [];
$list = fn(array $xs, callable $f) => implode(', ', array_map($f, array_slice($xs, 0, 8))) . (count($xs) > 8 ? ' and ' . (count($xs) - 8) . ' more' : '');
$names = fn(array $xs, bool $price = false) => $list($xs, fn($l) => $short($l['name'] ?? '') . ($price ? ' ' . $usd($qPrice($l)) : ''));
$spTot = array_sum($speed);
if ($noFollow) $sec[] = ['l' => 'Quotes with no follow-up', 'v' => (string) count($noFollow), 's' => 'price given 2+ days ago, no call, text or email logged since · ' . $names($noFollow, true), 't' => 'warn'];
if ($vmOld) $sec[] = ['l' => 'Voicemails not followed up in a day', 'v' => (string) count($vmOld), 's' => $names($vmOld), 't' => 'warn'];
if ($txtOld) $sec[] = ['l' => 'Texts or emails with no reply, no next try', 'v' => (string) count($txtOld), 's' => 'two days or more · ' . $names($txtOld), 't' => 'warn'];
if ($depOpenN) $sec[] = ['l' => 'Deposit links sent, not paid', 'v' => $usd($depOpen), 's' => $plural($depOpenN, 'customer has', 'customers have') . ' the deposit link and ' . ($depOpenN === 1 ? 'has' : 'have') . ' not paid yet', 't' => 'warn'];
if ($owedDoneN) $sec[] = ['l' => 'Jobs done, not paid in full', 'v' => $usd($owedDone), 's' => $plural($owedDoneN, 'job', 'jobs'), 't' => 'warn'];
if ($couldNot) $sec[] = ['l' => 'Jobs not done today, to rebook', 'v' => (string) count($couldNot), 't' => 'bad'];
$R['sections'][] = ['title' => 'Where follow-up slips', 'note' => 'From the calls, texts and emails logged in the app: one not logged counts as not done.', 'rows' => $sec, 'empty' => 'Nothing slipping today.'];
$R['sections'][] = ['title' => 'Next six weeks', 'rows' => [
    ['l' => 'Expected', 'v' => $usd($six), 's' => $usd($bk6) . ' booked in ' . $plural($bk6n, 'job', 'jobs') . ' + open quotes at each group\'s close rate' . ($planN ? ' + plans' : '')],
    ['l' => 'Customers on monthly plans', 'v' => (string) $planN]]];
$R['foot'] = ($eTest ? 'TEST, sent to Matthew only. ' : '') . 'From the Sixfold 365 app, Square and the ad spend typed in Stats. Customer names are private: keep this inside the company.';

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
$subject = ($eTest ? 'TEST ' : '') . 'End of day, ' . $day($T) . ': ' . ($money['answer'] ? $usd(round($money['today'], 2)) . ' in · ' : '') . count($bookedToday) . ' booked · ' . $doneN . ' done · ' . count($tomJobs) . ' tomorrow';

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
$to = $eTest ? [(string) $eCfg['to']] : (in_array('--brandon', $eArgs, true) ? [EOD_BRANDON] : [EOD_BRANDON, (string) $eCfg['to']]);   /* --brandon: his copy only (a resend) */
$fails = 0;
foreach ($to as $addr) {
    $eRes = smtp_send((array) ($eCfg['smtp'] ?? []), $addr, '[Sixfold 365] ' . $subject, $mime, ['X-Mailer: sixfold-app', 'Content-Type: multipart/alternative; boundary="' . $b1 . '"']);
    $ok = !empty($eRes['ok']); if (!$ok) $fails++;
    @file_put_contents($eState . '/eod.log', json_encode(['at' => time(), 'to' => $addr, 'ok' => $ok, 'stage' => $eRes['stage'] ?? null, 'subject' => $subject]) . "\n", FILE_APPEND | LOCK_EX);
    echo $ok ? "eod: sent to $addr\n" : 'eod: NOT sent to ' . $addr . ' (' . ($eRes['stage'] ?? '?') . ")\n";
}
if (!$eTest && $fails < count($to)) @file_put_contents($eState . '/eod-last-sent.txt', date('Y-m-d'));   /* one got through: no resend to the other at the next hour */
exit($fails ? 1 : 0);

