<?php
declare(strict_types=1);
/* Sixfold 365 numbers for the weekly business report (shared/tools/eod/weekly.mjs, 2026-11-23). READ ONLY.
 * Not installed on the server: the generator pipes this file to php over sg.sh, so nothing new lives there.
 *   bash ~/jarvis/bin/sg.sh trav 'php -- <this-week-start> <this-week-end>' < shared/tools/eod/server/sixfold-week.php
 * It loads the Sixfold app exactly as sixfold-tools/eod-report.php does (action=digest, from the command line), so the figures use the
 * app's own functions and filters (test leads and their jobs left out, jobs taken off left out, Square net of refunds). It counts two
 * windows, this week and the 7 days before it, Colorado time, and prints ONE JSON object of counts and dollars. No names, no addresses,
 * nothing about a customer: only numbers leave the server. Writes nothing. */
if (PHP_SAPI !== 'cli') exit;
date_default_timezone_set('America/Denver');
@ini_set('memory_limit', '1024M');
$a0 = (string) ($argv[1] ?? ''); $a1 = (string) ($argv[2] ?? '');
if (!preg_match('/^\d{4}-\d\d-\d\d$/', $a0) || !preg_match('/^\d{4}-\d\d-\d\d$/', $a1)) { echo json_encode(['ok' => false, 'error' => 'usage: php -- <start> <end>']), "\n"; exit(1); }
$site = getenv('HOME') . '/www/traverseplatforms.com';
$api = $site . '/public_html/api';

final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'digest']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
$D = null;
ob_start();
try { require $api . '/rounds.php'; } catch (SixfoldOut $e) { $D = $e->body; }
ob_end_clean();
if (!is_array($D) || empty($D['ok'])) { echo json_encode(['ok' => false, 'error' => 'the Sixfold app did not answer']), "\n"; exit(1); }

$tz = new DateTimeZone('America/Denver');
$t0 = (new DateTime($a0 . ' 00:00', $tz))->getTimestamp();
$t1 = (new DateTime($a1 . ' 00:00', $tz))->modify('+1 day')->getTimestamp();   /* end of the end day */
$l0 = $t0 - 7 * 86400;   /* last week starts 7 days earlier */
$W = ['this' => [$t0, $t1, $a0, $a1], 'last' => [$l0, $t0, date('Y-m-d', $l0), date('Y-m-d', $t0 - 1)]];

$real = fn($l) => !preg_match('/\btest\b|claude/i', (string) ($l['name'] ?? ''));   /* eod-report.php's own rule */
$allLeads = leadsAll(); $leads = array_filter($allLeads, $real);
$jobs = array_filter(jobsAll(), fn($j) => empty($j['off']) && $real($allLeads[$j['lead']] ?? ['name' => '']));
$qFirst = []; foreach (readLines(leadsDir() . '/leadst.log') as $u) if (!empty($u['quote']) && !isset($qFirst[$u['id']])) $qFirst[$u['id']] = (int) ($u['at'] ?? 0);
$srcName = ['meta' => 'Facebook form', 'messenger' => 'Messenger (as entered)', 'a365web' => 'Website', 'website' => 'Website', 'phone' => 'Phone', 'referral' => 'Referral', 'nextdoor' => 'Nextdoor', 'linktree' => 'Linktree', 'other' => 'Other'];

$pays = squareCfg() ? squarePaymentsSince($l0, 6) : null;
$out = ['ok' => true, 'from' => 'Sixfold 365 app (rounds.php digest) + Square', 'at' => time(), 'square' => $pays !== null, 'weeks' => []];
foreach ($W as $k => [$s, $e, $ds, $de]) {
    $in = fn(int $t) => $t >= $s && $t < $e;
    $inD = fn(string $d) => $d >= $ds && $d <= $de;
    $r = ['from' => $ds, 'to' => $de, 'leads' => 0, 'leadsBySource' => [], 'quotes' => 0, 'quotesValue' => 0, 'booked' => 0, 'bookedValue' => 0, 'done' => 0, 'doneValue' => 0];
    foreach ($leads as $l) if ($in((int) ($l['at'] ?? 0))) { $r['leads']++; $sn = $srcName[$l['src'] ?? 'other'] ?? 'Other'; $r['leadsBySource'][$sn] = ($r['leadsBySource'][$sn] ?? 0) + 1; }
    foreach ($leads as $l) if (!empty($l['quote']) && $in((int) ($qFirst[$l['id']] ?? 0))) { $r['quotes']++; $r['quotesValue'] += (int) ($l['quote']['price'] ?? 0); }
    foreach ($jobs as $j) if ($in((int) ($j['at'] ?? 0))) { $r['booked']++; $r['bookedValue'] += (int) ($j['price'] ?? 0); }
    foreach ($jobs as $j) if ($inD((string) ($j['date'] ?? '')) && (($j['done']['o'] ?? '') === 'done')) { $r['done']++; $r['doneValue'] += (int) ($j['price'] ?? 0); }
    if ($pays !== null) {
        $m = 0.0; $n = 0;
        foreach ($pays as $p) {
            if (($p['status'] ?? '') !== 'COMPLETED') continue;
            $net = ((int) ($p['amount_money']['amount'] ?? 0) - (int) ($p['refunded_money']['amount'] ?? 0)) / 100; if ($net == 0) continue;
            if ($in((int) strtotime((string) ($p['created_at'] ?? '')))) { $m += $net; $n++; }
        }
        $r['collected'] = round($m, 2); $r['payments'] = $n;
    }
    arsort($r['leadsBySource']);
    $out['weeks'][$k] = $r;
}
/* ad spend: lifetime totals as last typed in the Stats page (the app cannot read the ad account), so a week's spend is the change between
   two weekly snapshots; the generator does that subtraction */
$sp = 0.0; foreach (adSpend() as $a) $sp += (float) ($a['spend'] ?? 0);
$out['adSpendLifetime'] = round($sp, 2);
$out['adSpendTypedAt'] = (int) (json_decode((string) @file_get_contents(adSpendFile()), true)['at'] ?? 0);
echo json_encode($out, JSON_UNESCAPED_SLASHES), "\n";
