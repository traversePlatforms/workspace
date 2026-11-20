<?php
declare(strict_types=1);
/* One line of website numbers for the overnight check (2026-11-20): yesterday and today so far, Colorado time, for this site and every
   remote in config.php. Read only. Prints counts only.
     php ~/www/traverseplatforms.com/site-analytics/report.php --line */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/lib.php';
$C = svCfg();
$reps = [svReport()];
foreach ((array) $C['remotes'] as $r) {
    $ch = curl_init((string) $r['url'] . '?a=report');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => '', CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_HTTPHEADER => ['X-SV-Key: ' . (string) $r['key'], 'User-Agent: site-stats']]);
    $j = json_decode((string) curl_exec($ch), true); curl_close($ch);
    $reps[] = is_array($j) && !empty($j['ok']) ? $j : ['label' => (string) $r['label'], 'error' => true];
}
$part = function (array $s) { return $s['visitors'] . ' visitors, ' . $s['views'] . ' views, ' . $s['conv_visitors'] . ' converted'; };
$out = [];
foreach ($reps as $j) {
    if (!empty($j['error'])) { $out[] = $j['label'] . ': report not reachable'; continue; }
    $out[] = $j['label'] . ' yesterday ' . $part($j['ranges']['yesterday']) . ' (today so far ' . $j['ranges']['today']['visitors'] . ' visitors)';
}
echo 'site analytics: ' . implode('; ', $out) . "\n";
