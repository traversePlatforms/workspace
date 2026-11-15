<?php
declare(strict_types=1);
/* Sixfold profit check, for Matthew only (2026-11-15, Matthew: "I am currently just retaining a 5% profit share, once the company becomes
 * profitable. So I want us to still have access to the financials so we can determine when that is. Also alert me when we are profitable").
 *
 * Lives OUTSIDE public_html in sixfold-tools/, beside eod-report.php, and loads the app the same way, so the figures match the app.
 *   php .../profit-check.php            the month-by-month table
 *   php .../profit-check.php --line     one line (the laptop's overnight check prints it)
 *   php .../profit-check.php --alert    email Matthew ONCE when a finished month first nets positive (marker profit-alerted.txt)
 *
 * Per calendar month (Colorado time), from the first month with app jobs:
 *   revenue      = price of jobs marked done that month (what the business earned, whenever it was paid)
 *   crew         = revenue x the quote engine's crewShare (20%: Matthew's 21 Oct rule, the only crew pay on record)
 *   materials    = fertilizer and seed pounds on those jobs x the quote engine's own bag prices
 *   card fees    = Square's processing fees that month, every location
 *   ads          = profit-costs.json "ads" for the month if typed in; else worked out from the ad-spend snapshots (Meta lifetime totals)
 *   fixed        = profit-costs.json "fixed" (Matthew's 21 Oct monthly figures: truck, aerator, storage, trailer card)
 * Costs NOT seen anywhere (insurance, phone, gas, owner pay, anything paid outside Square or the app) are listed as unknown, never guessed.
 * Costs live in sixfold-private/profit-costs.json (made with Matthew's 21 Oct figures on first run; edit it, the script never overwrites it). */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('America/Denver');
$args = array_slice($argv ?? [], 1);
$site = dirname(__DIR__);
$api = getenv('SIXFOLD_API_DIR') ?: $site . '/public_html/api';
$priv = $site . '/sixfold-private'; $state = $site . '/sixfold-data/digest';
$costF = $priv . '/profit-costs.json';
if (!is_file($costF)) file_put_contents($costF, json_encode([
    'note' => 'Monthly costs for the profit check (sixfold-tools/profit-check.php). fixed = every month; ads = actual Meta spend per month (YYYY-MM) when known, else the script works it out from the ad-spend snapshots; unknown = costs nobody has given us yet.',
    'fixed' => ['Truck' => 1000, 'Aerator' => 325, 'Storage unit' => 414, 'Trailer credit card' => 500],
    'ads' => ['2026-09' => 406.85, '2026-10' => 2717.89],
    'adsNote' => '2026-09: 365 ad account (Messenger boosts 274.90 + Fall Aeration 131.95). 2026-10: form1 169.28 + Messenger boost 23.87 + the two running ads to 31 Oct (form 1,108.78 + Messenger 1,415.96). From Nov: lifetime totals minus 31 Oct.',
    'oct31' => ['form2' => 1108.78, 'msgr' => 1415.96],
    'unknown' => ['Business insurance', 'Phone and ClickUp', 'Gas (the quote engine estimates it per job but nothing records what was spent)', 'Any pay beyond the 20% crew share', 'Anything paid outside Square or the app'],
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
$C = json_decode((string) file_get_contents($costF), true) ?: [];

final class SixfoldOut extends Exception { public array $body; public function __construct(array $b) { parent::__construct('out'); $this->body = $b; } }
define('SIXFOLD_CLI', true);
$_REQUEST = ['action' => 'digest']; $_GET = $_REQUEST; $_SERVER['REQUEST_METHOD'] = 'GET';
try { require $api . '/rounds.php'; } catch (SixfoldOut $e) {}
$P = defined('A365_PRICING') ? A365_PRICING : [];
$crewShare = (float) ($P['crewShare'] ?? 0.2);
$fertLb = ($P['fertBagLb'] ?? 0) ? (float) $P['fertBagCost'] / (float) $P['fertBagLb'] : 0.0;
$seedLb = ($P['seedBagLb'] ?? 0) ? (float) $P['seedBagCost'] / (float) $P['seedBagLb'] : 0.0;

$real = fn($l) => !preg_match('/\btest\b|claude/i', (string) ($l['name'] ?? ''));
$all = leadsAll(); $M = [];
foreach (jobsAll() as $j) {
    if ($j['off'] || !$real($all[$j['lead']] ?? ['name' => '']) || ($j['done']['o'] ?? '') !== 'done') continue;
    $m = substr((string) $j['date'], 0, 7); $p = (float) $j['price'];
    $M[$m]['jobs'] = ($M[$m]['jobs'] ?? 0) + 1; $M[$m]['rev'] = ($M[$m]['rev'] ?? 0) + $p;
    $M[$m]['mat'] = ($M[$m]['mat'] ?? 0) + (float) ($j['fertLb'] ?? 0) * $fertLb + (float) ($j['seedLb'] ?? 0) * $seedLb;
}
$pays = squarePaymentsSince(strtotime('2026-08-01'), 20, true);
$feesOk = is_array($pays);
foreach ((array) $pays as $py) {
    if (($py['status'] ?? '') !== 'COMPLETED') continue; $m = date('Y-m', (int) strtotime((string) $py['created_at']));
    foreach ((array) ($py['processing_fee'] ?? []) as $f) $M[$m]['fee'] = ($M[$m]['fee'] ?? 0) + (int) ($f['amount_money']['amount'] ?? 0) / 100;
    $M[$m]['cash'] = ($M[$m]['cash'] ?? 0) + ((int) ($py['amount_money']['amount'] ?? 0) - (int) ($py['refunded_money']['amount'] ?? 0)) / 100;
}
/* ads from November on: Meta lifetime totals (ad-spend.json, kept up from Matthew's screenshots) minus the 31 Oct totals; the newest month gets
   whatever has been spent since the month before was closed, so a month is exact only once a snapshot from its last day exists */
$adNow = 0.0; $adAsof = '';
foreach ((array) (json_decode((string) @file_get_contents($site . '/sixfold-data/rounds/ad-spend.json'), true)['ads'] ?? []) as $a)
    if (in_array($a['key'] ?? '', ['form2', 'msgr'], true)) { $adNow += (float) $a['spend']; $adAsof = max($adAsof, (string) ($a['asof'] ?? '')); }
/* each month's closing lifetime total, kept in sixfold-data/digest/profit-ads-close.json: 31 Oct from the snapshot; a month without one gets
   the total as it stands at the first run after it ends (exact if the spend was updated on its last day, close otherwise) */
$closeF = $state . '/profit-ads-close.json';
$close = json_decode((string) @file_get_contents($closeF), true) ?: ['2026-10' => array_sum(array_map('floatval', (array) ($C['oct31'] ?? [])))];
$cur = date('Y-m'); $prevOf = fn($m) => (new DateTime($m . '-01'))->modify('-1 month')->format('Y-m');
for ($m = '2026-11'; $m < $cur; $m = (new DateTime($m . '-01'))->modify('+1 month')->format('Y-m')) if (!isset($close[$m])) $close[$m] = $adNow;
@file_put_contents($closeF, json_encode($close, JSON_PRETTY_PRINT));
$months = array_keys($M); if (!in_array($cur, $months, true)) $months[] = $cur; sort($months);
$typed = (array) ($C['ads'] ?? []);
$fixed = array_sum(array_map('floatval', (array) ($C['fixed'] ?? [])));
$rows = []; $cum = 0.0;
foreach ($months as $m) {
    if ($m < '2026-09') continue;
    $r = $M[$m] ?? [];
    $ads = isset($typed[$m]) ? (float) $typed[$m] : ($m > '2026-10' ? max(0.0, ($m === $cur ? $adNow : (float) ($close[$m] ?? $adNow)) - (float) ($close[$prevOf($m)] ?? $adNow)) : 0.0);
    /* a month before the app had jobs (Sep 2026: Kara's and Brian's first jobs) counts the money Square took as its revenue */
    $rev = isset($r['rev']) ? (float) $r['rev'] : (float) ($r['cash'] ?? 0); $crew = $rev * $crewShare; $mat = (float) ($r['mat'] ?? 0); $fee = (float) ($r['fee'] ?? 0);
    $fx = $m === $cur ? $fixed * ((int) date('j') / (int) date('t')) : $fixed;   /* this month: fixed costs so far, by day */
    $net = $rev - $crew - $mat - $fee - $ads - $fx; $cum += $net;
    $rows[] = ['m' => $m, 'done' => $m < $cur, 'jobs' => (int) ($r['jobs'] ?? 0), 'rev' => $rev, 'cash' => (float) ($r['cash'] ?? 0), 'crew' => $crew, 'mat' => $mat, 'fee' => $fee, 'ads' => $ads, 'fixed' => $fx, 'net' => $net, 'cum' => $cum];
}
$usd = fn($v) => ($v < 0 ? '-$' : '$') . number_format(abs($v), 0);
$label = fn($m) => (new DateTime($m . '-01'))->format('M Y');
$last = end($rows) ?: null; $done = array_values(array_filter($rows, fn($r) => $r['done']));
$firstPos = null; foreach ($done as $r) if ($r['net'] > 0) { $firstPos = $r; break; }

if (in_array('--line', $args, true)) {
    $ld = end($done) ?: null;
    echo 'Sixfold profit: ' . ($ld ? $label($ld['m']) . ' ' . $usd($ld['net']) . ', ' : '') . ($last ? $label($last['m']) . ' so far ' . $usd($last['net']) . ', ' : '')
        . 'since Sep ' . $usd($cum) . ($firstPos ? ' | first month positive on known costs: ' . $label($firstPos['m']) : ' | no month positive yet')
        . (is_numeric($C['unknownMonthly'] ?? null) ? '' : ' (insurance, gas, phone not counted yet)') . "\n";
    exit(0);
}
$lines = ['Sixfold profit check (' . date('j M Y') . '), known costs only', ''];
$lines[] = sprintf('%-9s %4s %9s %8s %8s %7s %7s %8s %8s %9s %10s', 'Month', 'Jobs', 'Revenue', 'Crew', 'Material', 'Fees', 'Ads', 'Fixed', 'Net', 'Since Sep', 'Square in');
foreach ($rows as $r) $lines[] = sprintf('%-9s %4d %9s %8s %8s %7s %7s %8s %8s %9s %10s', $label($r['m']) . ($r['done'] ? '' : '*'), $r['jobs'], $usd($r['rev']), $usd($r['crew']), $usd($r['mat']), $usd($r['fee']), $usd($r['ads']), $usd($r['fixed']), $usd($r['net']), $usd($r['cum']), $usd($r['cash']));
$lines[] = ''; $lines[] = '* this month so far (fixed costs counted to today).';
$lines[] = 'Revenue = jobs marked done that month. Crew = ' . round($crewShare * 100) . '% of it. Material = fertilizer and seed on those jobs at the quote engine\'s bag prices. Ads from November = Meta lifetime totals (ad spend as of ' . ($adAsof ?: '?') . ') minus 31 Oct.';
$lines[] = 'Not counted, because no figure exists: ' . implode('; ', (array) ($C['unknown'] ?? [])) . '.';
if (!$feesOk) $lines[] = 'Square did not answer, so card fees and Square money are missing.';
$text = implode("\n", $lines) . "\n";

if (in_array('--alert', $args, true)) {
    $mark = $state . '/profit-alerted.txt';
    /* no alert on partial costs: the costs nobody has given us (insurance, phone, gas...) must be set as one monthly figure first,
       profit-costs.json "unknownMonthly", and a month must still net positive after it. Until then Matthew sees the known-cost result. */
    if (!is_numeric($C['unknownMonthly'] ?? null)) { echo "profit: waiting for unknownMonthly in profit-costs.json; no alert\n"; exit(0); }
    $firstPos = null; foreach ($done as $r) if ($r['net'] - (float) $C['unknownMonthly'] > 0) { $firstPos = $r; break; }
    if (!$firstPos) { echo "profit: not profitable yet; no alert\n"; exit(0); }
    if (trim((string) @file_get_contents($mark)) === $firstPos['m']) { echo "profit: already alerted for " . $firstPos['m'] . "\n"; exit(0); }
    $cfg = require $api . '/config.php'; require_once $api . '/smtp.php';
    $subj = 'Sixfold was profitable in ' . $label($firstPos['m']) . ' (' . $usd($firstPos['net']) . ', known costs)';
    $res = smtp_send((array) ($cfg['smtp'] ?? []), (string) $cfg['to'], '[Sixfold 365] ' . $subj, "Matthew,\n\n" . $subj . ". This is the month your 5% profit share starts counting from, once the unknown costs below are checked.\n\n" . $text, ['X-Mailer: sixfold-app']);
    if (!empty($res['ok'])) { file_put_contents($mark, $firstPos['m']); echo "profit: alert sent\n"; } else { echo 'profit: alert NOT sent (' . ($res['stage'] ?? '?') . ")\n"; exit(1); }
    exit(0);
}
echo $text;
