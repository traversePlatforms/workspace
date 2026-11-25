<?php
/* Peak Pickleball's Google Business Profile, read only (25 Nov 2026; API approved for project 808186776004, case 0-9004000042336).
   Command line only. Uses the Traverse account's Google sign-in (business.manage, granted on the J.A.R.V.I.S. calendar connect) and prints
   one JSON object on stdout; nothing is stored here. The nightly pull on the cloud computer (matthew/clients/peak-pickleball/tools/gbp-pull.mjs)
   runs it over ssh and keeps the store.
   php gbp-fetch.php <from YYYY-MM-DD> <to YYYY-MM-DD> [--reviews=all|recent] [--keywords=<months back>]
   Out: { ok, location, daily:[{date, <metric>: n}], reviews:{total, average, list:[{id, date, updated, stars, replied}]}, keywords:[{month, keyword, impressions|threshold}] (one row per keyword per finished month) }
   No reviewer names and no review text: stars, dates and whether Peak replied. Never prints a token. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
foreach (['store', 'auth', 'google'] as $f) require __DIR__ . '/lib/' . $f . '.php';

const GBP_ACCOUNT = 'accounts/107280456793948659363';
const GBP_LOCATION = '17233438753133451747';   /* Peak Pickleball */
const GBP_METRICS = ['BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    'CALL_CLICKS', 'WEBSITE_CLICKS', 'BUSINESS_DIRECTION_REQUESTS', 'BUSINESS_CONVERSATIONS', 'BUSINESS_BOOKINGS'];

function fail(string $why): never { echo json_encode(['ok' => false, 'error' => $why]), "\n"; exit(1); }
$from = (string) ($argv[1] ?? ''); $to = (string) ($argv[2] ?? '');
if (!preg_match('/^\d{4}-\d\d-\d\d$/', $from) || !preg_match('/^\d{4}-\d\d-\d\d$/', $to)) fail('usage: gbp-fetch.php <from> <to>');
$opt = []; foreach (array_slice($argv, 3) as $a) if (preg_match('/^--(\w+)=(.*)$/', $a, $m)) $opt[$m[1]] = $m[2];

$acct = null; foreach (jget('accounts.json') as $e => $a) if (is_array($a) && !empty($a['gbp']) && !empty($a['refresh'])) $acct = (string) $e;
if (!$acct) fail('no account has granted business.manage (J.A.R.V.I.S. Calendar: Connect again)');
$tok = gToken($acct); if (!$tok) fail('token refresh failed: reconnect in J.A.R.V.I.S.');
$H = ['Authorization: Bearer ' . $tok];
$get = function (string $url) use ($H): array { for ($i = 0; $i < 4; $i++) { $r = http('GET', $url, null, null, $H); if (!in_array($r['_status'], [429, 500, 502, 503], true)) return $r; sleep(2 + 3 * $i); } return $r; };
$errs = [];

/* daily performance */
[$fy, $fm, $fd] = array_map('intval', explode('-', $from)); [$ty, $tm, $td] = array_map('intval', explode('-', $to));
$q = implode('&', array_map(fn($m) => 'dailyMetrics=' . $m, GBP_METRICS)) . "&dailyRange.startDate.year=$fy&dailyRange.startDate.month=$fm&dailyRange.startDate.day=$fd&dailyRange.endDate.year=$ty&dailyRange.endDate.month=$tm&dailyRange.endDate.day=$td";
$p = $get('https://businessprofileperformance.googleapis.com/v1/locations/' . GBP_LOCATION . ':fetchMultiDailyMetricsTimeSeries?' . $q);
$daily = [];
if (isset($p['error'])) $errs[] = 'performance ' . $p['_status'] . ' ' . mb_substr((string) ($p['error']['message'] ?? ''), 0, 150);
foreach ($p['multiDailyMetricTimeSeries'] ?? [] as $grp) foreach ($grp['dailyMetricTimeSeries'] ?? [] as $s) {
    $metric = (string) $s['dailyMetric'];
    foreach ($s['timeSeries']['datedValues'] ?? [] as $v) {
        $d = sprintf('%04d-%02d-%02d', $v['date']['year'], $v['date']['month'], $v['date']['day']);
        $daily[$d]['date'] = $d; $daily[$d][$metric] = (int) ($v['value'] ?? 0);
    }
}
ksort($daily);

/* reviews: newest first; "recent" stops after 2 pages (100), "all" reads every page */
$rv = ['total' => null, 'average' => null, 'list' => []]; $tokp = ''; $pages = ($opt['reviews'] ?? 'recent') === 'all' ? 40 : 2;
for ($i = 0; $i < $pages; $i++) {
    $r = $get('https://mybusiness.googleapis.com/v4/' . GBP_ACCOUNT . '/locations/' . GBP_LOCATION . '/reviews?pageSize=50&orderBy=updateTime%20desc' . ($tokp ? '&pageToken=' . rawurlencode($tokp) : ''));
    if (isset($r['error'])) { $errs[] = 'reviews ' . $r['_status'] . ' ' . mb_substr((string) ($r['error']['message'] ?? ''), 0, 150); break; }
    $rv['total'] = $r['totalReviewCount'] ?? $rv['total']; $rv['average'] = isset($r['averageRating']) ? round((float) $r['averageRating'], 2) : $rv['average'];
    $stars = ['ONE' => 1, 'TWO' => 2, 'THREE' => 3, 'FOUR' => 4, 'FIVE' => 5];
    foreach ($r['reviews'] ?? [] as $x) $rv['list'][] = ['id' => substr(hash('sha256', (string) $x['reviewId']), 0, 16), 'date' => substr((string) ($x['createTime'] ?? ''), 0, 10),
        'updated' => substr((string) ($x['updateTime'] ?? ''), 0, 10), 'stars' => $stars[$x['starRating'] ?? ''] ?? null, 'replied' => !empty($x['reviewReply'])];
    $tokp = (string) ($r['nextPageToken'] ?? ''); if ($tokp === '') break;
}

/* search keywords people used to find the profile, monthly */
$kw = []; $back = (int) ($opt['keywords'] ?? 0);   /* one call per finished month, newest last */
for ($i = $back; $i >= 1; $i--) {
    $mo = new DateTime($to); $mo->modify('first day of this month')->modify('-' . $i . ' months');
    $kq = sprintf('monthlyRange.startMonth.year=%1$d&monthlyRange.startMonth.month=%2$d&monthlyRange.endMonth.year=%1$d&monthlyRange.endMonth.month=%2$d&pageSize=100', $mo->format('Y'), $mo->format('n'));
    $k = $get('https://businessprofileperformance.googleapis.com/v1/locations/' . GBP_LOCATION . '/searchkeywords/impressions/monthly?' . $kq);
    if (isset($k['error'])) { $errs[] = 'keywords ' . $mo->format('Y-m') . ' ' . $k['_status'] . ' ' . mb_substr((string) ($k['error']['message'] ?? ''), 0, 150); continue; }
    foreach ($k['searchKeywordsCounts'] ?? [] as $x) $kw[] = ['month' => $mo->format('Y-m'), 'keyword' => (string) $x['searchKeyword'],
        'impressions' => isset($x['insightsValue']['value']) ? (int) $x['insightsValue']['value'] : null, 'threshold' => isset($x['insightsValue']['threshold']) ? (int) $x['insightsValue']['threshold'] : null];
}

echo json_encode(['ok' => !$errs || $daily || $rv['list'], 'errors' => $errs, 'location' => 'Peak Pickleball', 'daily' => array_values($daily), 'reviews' => $rv, 'keywords' => $kw]), "\n";
