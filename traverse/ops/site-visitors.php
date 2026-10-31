<?php
/* Website visitors since the site opened (2026-10-31, Matthew: "how many website views have we had since we started with emails and
   messaging on next door", not counting him or Claude). Reads SiteGround's daily access logs (~/www/traverseplatforms.com/logs/
   traverseplatforms.com-<date>.gz, written once a day around 04:40 UTC, so the newest day shows up after about 10:40 pm Colorado time).
   Counts page views of the public pages only (/, editions, demo, find, start, terms, privacy, cancellation), status 200 or 304.
   Left out: bots and tools by user agent; the cloud machine and this server; and every address that also opened anything private that
   day or the day before (the Prospect Desk, an app, the hub, the assistant, an api), which is Matthew, Claude's checks, Jen and the crews.
   Read only. Prints names of nothing: counts, pages and where visitors came from.
     php ~/www/traverseplatforms.com/traverse-tools/site-visitors.php            all days since the site opened
     php .../site-visitors.php --line                                          one line for the overnight check */
$OPEN = strtotime(getenv('SV_FROM') ?: '2026-10-31T04:41:00Z');   /* open-site.sh ran 30 Oct 10:41 pm MT; SV_FROM only for testing on older days */
$dir = getenv('HOME') . '/www/traverseplatforms.com/logs';
$line = in_array('--line', $argv, true);
$PUBLIC = '#^/(|index\.html|editions/?|demo/?|find/?|start/?|start/welcome/?|terms/?|terms-of-use/?|privacy/?|cancellation/?)(\?.*)?$#';
$PRIVATE = '#^/(prospects-|tr-|ty-|ts-|tq-|tg-|summit-|a-e018bb82|peak-desk|hub|api/|traverse-tools)#';
$BOT = '#bot|crawl|spider|slurp|preview|facebookexternalhit|curl|wget|python|go-http|node-fetch|undici|axios|okhttp|java/|libwww|httpclient|headless|lighthouse|monitor|uptime|scan|zgrab|semrush|ahrefs|mj12|dataforseo|petal|bytespider|gptbot|claude|anthropic|perplexity|ccbot|^-$#i';
$OURS = ['20.91.198.101', '35.208.70.82', '127.0.0.1'];
$rows = [];
foreach (glob("$dir/traverseplatforms.com-*.gz") as $f) {
    if (filemtime($f) < $OPEN) continue;
    foreach (gzfile($f) as $l) {
        if (!preg_match('#^(\S+) \S+ \S+ \[([^\]]+)\] "(\w+) (\S+)[^"]*" (\d{3}) \S+ "([^"]*)" "([^"]*)"#', $l, $m)) continue;
        $t = strtotime(str_replace('/', ' ', preg_replace('#:#', ' ', $m[2], 1)));
        if ($t < $OPEN) continue;
        $rows[] = ['ip' => $m[1], 't' => $t, 'day' => date('Y-m-d', $t - 6 * 3600), 'm' => $m[3], 'p' => $m[4], 's' => (int) $m[5], 'ref' => $m[6], 'ua' => $m[7]];
    }
}
/* addresses that opened anything private, by Colorado day (also the day before, for a phone that kept its address overnight) */
$priv = [];
foreach ($rows as $r) if (preg_match($PRIVATE, $r['p'])) { $priv[$r['day']][$r['ip']] = 1; }
$isOurs = function ($r) use ($priv, $OURS) { if (in_array($r['ip'], $OURS, true)) return true; $prev = date('Y-m-d', strtotime($r['day'] . ' -1 day')); return isset($priv[$r['day']][$r['ip']]) || isset($priv[$prev][$r['ip']]); };
$days = []; $all = ['views' => 0, 'ips' => []];
foreach ($rows as $r) {
    if ($r['m'] !== 'GET' || !in_array($r['s'], [200, 304], true) || !preg_match($PUBLIC, $r['p']) || preg_match($BOT, $r['ua']) || $isOurs($r)) continue;
    $d = &$days[$r['day']];
    $d['views'] = ($d['views'] ?? 0) + 1; $d['ips'][$r['ip']] = 1;
    $page = strtok($r['p'], '?'); $d['pages'][$page] = ($d['pages'][$page] ?? 0) + 1;
    $h = parse_url($r['ref'], PHP_URL_HOST) ?: '';
    $src = $h === '' ? 'typed or an email link' : (preg_match('#traverseplatforms\.com$#', $h) ? null : (preg_match('#google\.#', $h) ? 'Google' : (preg_match('#nextdoor\.#', $h) ? 'Nextdoor' : (preg_match('#bing\.|duckduckgo|yahoo#', $h) ? 'other search' : $h))));
    if ($src !== null) $d['from'][$src] = ($d['from'][$src] ?? 0) + 1;
    $all['views']++; $all['ips'][$r['ip']] = 1;
    unset($d);
}
ksort($days);
$newest = $rows ? date('M j g:i a', max(array_column($rows, 't')) - 6 * 3600) : 'none yet';
if ($line) { echo 'site visitors since it opened: ' . count($all['ips']) . ' people, ' . $all['views'] . " page views (log up to $newest MT)\n"; exit(0); }
echo "Website visitors since the site opened (30 Oct 10:41 pm), bots and our own visits left out. Log up to $newest Colorado time.\n";
echo 'Total: ' . count($all['ips']) . ' people, ' . $all['views'] . " page views\n";
foreach ($days as $day => $d) {
    arsort($d['pages']); arsort($d['from']);
    echo "\n$day: " . count($d['ips']) . ' people, ' . $d['views'] . " page views\n";
    echo '  pages: ' . implode(', ', array_map(fn($p, $n) => ($p === '/' ? 'home' : trim($p, '/')) . " $n", array_keys($d['pages']), $d['pages'])) . "\n";
    if (!empty($d['from'])) echo '  from: ' . implode(', ', array_map(fn($s, $n) => "$s $n", array_keys($d['from']), $d['from'])) . "\n";
}
