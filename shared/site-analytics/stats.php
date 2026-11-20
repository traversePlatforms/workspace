<?php
declare(strict_types=1);
/* Matthew's website stats (2026-11-20): traverseplatforms.com and 365aeration.com, from our own cookie-free counting (see lib.php).
   Live at traverseplatforms.com/stats-54b859/ (also the hub's "Site stats" tab). Sign-in code only in ~/.ssh/site-stats-code.txt on the laptop;
   the server keeps its sha256 (config.php code_hash). The 365 numbers come from 365aeration.com/sv/c.php?a=report with the shared key. */
$lib = (getenv('SV_PRIVATE') ?: dirname(__DIR__, 2) . '/site-analytics') . '/lib.php';
if (!is_readable($lib)) { http_response_code(503); exit('Not set up.'); }
require $lib;
header('Cache-Control: no-store'); header('X-Robots-Tag: noindex, nofollow'); header('X-Content-Type-Options: nosniff'); header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; form-action 'self'; frame-ancestors 'self'");
$C = svCfg();
$base = '/' . trim(dirname($_SERVER['SCRIPT_NAME'] ?? '/stats/'), '/') . '/';
$ck = 'sv_s';
$sessF = svData() . '/sessions.json';
$ipk = substr(hash('sha256', 'login|' . svSalt(svDay(svNow())) . '|' . svIp()), 0, 16);
$h = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');

function svSessions(string $f): array { $j = json_decode((string) @file_get_contents($f), true); $j = is_array($j) ? $j : []; $now = time(); return array_filter($j, fn($e) => (int) $e > $now); }
$signed = false; $tok = (string) ($_COOKIE[$ck] ?? '');
if ($tok !== '' && preg_match('/^[0-9a-f]{64}$/', $tok)) { $s = svSessions($sessF); $signed = isset($s[hash('sha256', $tok)]); }
$msg = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['out'])) {
    $s = svSessions($sessF); unset($s[hash('sha256', $tok)]); svPut($sessF, json_encode($s));
    setcookie($ck, '', ['expires' => 1, 'path' => $base, 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
    header('Location: ' . $base, true, 303); exit;
}
if (!$signed && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $code = trim((string) ($_POST['code'] ?? ''));
    if (!svAttempts('login', $ipk, false)) $msg = 'Too many tries. Wait 15 minutes.';
    elseif (strlen((string) $C['code_hash']) === 64 && $code !== '' && hash_equals((string) $C['code_hash'], hash('sha256', 'sv|' . $code))) {
        $t = bin2hex(random_bytes(32)); $s = svSessions($sessF); $s[hash('sha256', $t)] = time() + 86400 * 60; svPut($sessF, json_encode($s));
        setcookie($ck, $t, ['expires' => time() + 86400 * 60, 'path' => $base, 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
        header('Location: ' . $base, true, 303); exit;
    } else { svAttempts('login', $ipk, true); $msg = 'That code did not work.'; }
}
$LOOK = '<script>(function(){try{var t=localStorage.getItem("sixfold.theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();</script>';
$CSS = '<style>
:root{--bg:#f4f6f9;--card:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--line:#dfe3ea;--bar:#13294b;--flag:#d6400c;--s1:#2a78d6;--good:#0b7a0b;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0b1220;--card:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--line:#2e3442;--bar:#0f1f39;--s1:#3987e5;--good:#3fbf3f;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0b1220;--card:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--line:#2e3442;--bar:#0f1f39;--s1:#3987e5;--good:#3fbf3f;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
header{background:var(--bar);color:#fff;border-bottom:3px solid var(--flag);padding:12px 18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
header b{font-size:16px}header form{margin-left:auto}header button{background:transparent;color:#c9d5e6;border:1px solid #3a5280;border-radius:8px;padding:5px 10px;cursor:pointer;font:inherit}
main{max-width:1180px;margin:0 auto;padding:16px}
nav{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}nav a{padding:6px 12px;border-radius:999px;border:1px solid var(--line);color:var(--ink);text-decoration:none;background:var(--card)}
nav a[aria-current]{background:var(--s1);border-color:var(--s1);color:#fff}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 14px}
.tile,.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.tile b{display:block;font-size:26px;font-variant-numeric:tabular-nums}.tile span{color:var(--ink2);font-size:12.5px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px}
h2{font-size:14px;margin:0 0 8px}h1{font-size:18px;margin:4px 0 12px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}td,th{padding:4px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{color:var(--ink2);font-weight:600;font-size:12px}td.n,th.n{text-align:right;white-space:nowrap}td.p{word-break:break-all}
.muted{color:var(--ink2);font-size:12.5px}.chart{margin:0 0 14px}.chart svg{display:block;width:100%;height:auto}
.chart .b{fill:var(--s1)}.chart .b:hover{opacity:.75}.chart text{fill:var(--ink2);font-size:11px}.chart line{stroke:var(--line)}
details summary{cursor:pointer;color:var(--ink2);font-size:12.5px;margin-top:6px}
.login{max-width:360px;margin:60px auto}.login input{width:100%;font:inherit;padding:10px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);margin:8px 0}
.login button{font:inherit;padding:10px 16px;border-radius:8px;border:0;background:var(--s1);color:#fff;cursor:pointer}.err{color:#c0392b}
.warn{border-left:3px solid var(--flag);padding:8px 12px;background:var(--card);margin:0 0 12px}
</style>';
if (!$signed) {
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Site stats</title>' . $LOOK . $CSS . '</head><body>';
    echo '<main class="login"><h1>Site stats</h1><form method="post" autocomplete="off"><label>Sign-in code<input name="code" type="password" inputmode="numeric" autofocus></label><button>Open</button></form>';
    if ($msg) echo '<p class="err">' . $h($msg) . '</p>';
    echo '</main></body></html>'; exit;
}

/* the reports: this site from its own files, each other site from its collector */
$sites = [['id' => (string) $C['site'], 'label' => (string) $C['label'], 'host' => (string) (((array) $C['hosts'])[0] ?? ''), 'rep' => svReport(), 'err' => '']];
foreach ((array) $C['remotes'] as $r) {
    $rep = null; $err = '';
    if (function_exists('curl_init')) {
        $ch = curl_init((string) $r['url'] . '?a=report');
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => '', CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_HTTPHEADER => ['X-SV-Key: ' . (string) $r['key'], 'User-Agent: site-stats']]);
        $body = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        $j = is_string($body) ? json_decode($body, true) : null;
        if ($code === 200 && is_array($j) && !empty($j['ok'])) $rep = $j; else $err = 'Could not reach ' . $r['label'] . ' just now (' . ($code ?: 'no answer') . '). Reload to try again.';
    } else $err = 'This server cannot fetch the other site.';
    $sites[] = ['id' => (string) $r['id'], 'label' => (string) $r['label'], 'host' => (string) ($r['host'] ?? ''), 'rep' => $rep, 'err' => $err];
}
$sid = (string) ($_GET['s'] ?? $sites[0]['id']); $S = $sites[0]; foreach ($sites as $x) if ($x['id'] === $sid) $S = $x;
$RANGES = ['today' => 'Today', 'yesterday' => 'Yesterday', '7' => 'Last 7 days', '30' => 'Last 30 days'];
$rid = (string) ($_GET['r'] ?? '7'); if (!isset($RANGES[$rid])) $rid = '7';
$NAMES = ['demo_booked' => 'Demo booked', 'checkout_start' => 'Checkout started (Stripe opened)', 'signup_paid' => 'Paid sign-up (welcome page)', 'call_tap' => 'Call taps',
    'text_tap' => 'Text taps', 'email_tap' => 'Email taps', 'quote_request' => 'Quote requests (website form)', 'quote_accepted' => 'Quote accepted (quote page)',
    'agreement_signed' => 'Agreement signed', 'deposit_pay_tap' => 'Deposit: Pay tapped', 'outbound' => 'Links to other sites', 'app_link_request' => 'App link asked for (Find my app)',
    'quote_viewed' => 'Quote page opened', 'agreement_opened' => 'Agreement page opened'];
$nm = fn($n) => $NAMES[$n] ?? $n;
$secs = fn(int $s) => $s >= 60 ? intdiv($s, 60) . ' min ' . ($s % 60) . ' s' : $s . ' s';
$link = fn($s, $r) => $base . '?s=' . rawurlencode((string) $s) . '&r=' . rawurlencode((string) $r);

echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Site stats</title>' . $LOOK . $CSS . '</head><body>';
/* this device is Matthew's: never count it on this site (the opt-out flag the page script reads) */
echo '<script>try{localStorage.setItem("sv_ignore","1")}catch(e){}</script>';
echo '<header><b>Site stats</b><span class="muted" style="color:#c9d5e6">Our own counting: no cookies, no IP addresses kept, bots and Do Not Track left out</span><form method="post"><button name="out" value="1">Sign out</button></form></header><main>';
echo '<nav aria-label="Site">'; foreach ($sites as $x) echo '<a href="' . $h($link($x['id'], $rid)) . '"' . ($x['id'] === $S['id'] ? ' aria-current="page"' : '') . '>' . $h($x['label']) . '</a>'; echo '</nav>';
echo '<nav aria-label="Range">'; foreach ($RANGES as $k => $v) echo '<a href="' . $h($link($S['id'], $k)) . '"' . ((string) $k === $rid ? ' aria-current="page"' : '') . '>' . $h($v) . '</a>'; echo '</nav>';
if ($S['err'] !== '' || !$S['rep']) { echo '<p class="warn">' . $h($S['err'] ?: 'No report.') . '</p></main></body></html>'; exit; }
$R = $S['rep']['ranges'][$rid]; $series = $S['rep']['series'];
echo '<h1>' . $h($S['label']) . ' · ' . $h($RANGES[$rid]) . ' <span class="muted">(' . $h($R['from'] === $R['to'] ? $R['from'] : $R['from'] . ' to ' . $R['to']) . ', Colorado time)</span></h1>';
$tile = fn($v, $l) => '<div class="tile"><b>' . $h($v) . '</b><span>' . $h($l) . '</span></div>';
echo '<div class="tiles">' . $tile(number_format($R['visitors']), $rid === 'today' || $rid === 'yesterday' ? 'Visitors' : 'Visitors (each day\'s visitors added up)') . $tile(number_format($R['views']), 'Page views')
    . $tile(number_format($R['conv_visitors']), 'Visitors who converted') . $tile($R['conv_rate'] . '%', 'Conversion rate') . $tile($R['avg_time'] ? $secs((int) $R['avg_time']) : '-', 'Average time on a page')
    . $tile(number_format($R['bots']), 'Bot hits (left out)') . '</div>';

/* the daily chart: visitors per day, 30 days, one series (no legend: the title names it); hover a bar for the day's numbers; table below */
$max = max(1, max(array_map(fn($d) => $d[1], $series))); $W = 900; $H = 180; $pad = 26; $n = count($series); $bw = ($W - $pad) / $n;
$step = $max <= 5 ? 1 : (int) ceil($max / 4);
echo '<div class="card chart"><h2>Visitors per day, last 30 days</h2><svg viewBox="0 0 ' . $W . ' ' . ($H + 22) . '" role="img" aria-label="Visitors per day for the last 30 days">';
for ($g = 0; $g <= $max; $g += $step) { $y = $H - ($g / $max) * ($H - 10); echo '<line x1="' . $pad . '" x2="' . $W . '" y1="' . round($y, 1) . '" y2="' . round($y, 1) . '"/><text x="' . ($pad - 6) . '" y="' . round($y + 4, 1) . '" text-anchor="end">' . $g . '</text>'; }
foreach ($series as $i => [$d, $v, $pv, $cv]) {
    $x = $pad + $i * $bw + 1; $bh = $v ? max(2, ($v / $max) * ($H - 10)) : 0; $y = $H - $bh; $w = max(2, $bw - 2);
    $r = min(4, $w / 2, $bh / 2);
    /* hit target is the whole column, not just the bar */
    echo '<g><title>' . $h(date('D j M', strtotime($d)) . ': ' . $v . ' visitors, ' . $pv . ' page views, ' . $cv . ' conversions') . '</title><rect x="' . round($x, 1) . '" y="0" width="' . round($w, 1) . '" height="' . $H . '" fill="transparent"/>';
    if ($bh > 0) echo '<path class="b" d="M' . round($x, 1) . ',' . $H . 'V' . round($y + $r, 1) . 'Q' . round($x, 1) . ',' . round($y, 1) . ' ' . round($x + $r, 1) . ',' . round($y, 1) . 'H' . round($x + $w - $r, 1) . 'Q' . round($x + $w, 1) . ',' . round($y, 1) . ' ' . round($x + $w, 1) . ',' . round($y + $r, 1) . 'V' . $H . 'Z"/>';
    echo '</g>';
    if ($i % 5 === 0 || $i === $n - 1) echo '<text x="' . round($x + $w / 2, 1) . '" y="' . ($H + 16) . '" text-anchor="' . ($i === $n - 1 ? 'end' : ($i === 0 ? 'start' : 'middle')) . '">' . $h(date('j M', strtotime($d))) . '</text>';
}
echo '</svg><details><summary>Show as a table</summary><table><tr><th>Day</th><th class="n">Visitors</th><th class="n">Page views</th><th class="n">Conversions</th></tr>';
foreach (array_reverse($series) as [$d, $v, $pv, $cv]) echo '<tr><td>' . $h($d) . '</td><td class="n">' . $v . '</td><td class="n">' . $pv . '</td><td class="n">' . $cv . '</td></tr>';
echo '</table></details></div>';

$table = function (string $title, array $head, array $rows, callable $fmt, string $empty = 'Nothing yet.') use ($h) {
    $o = '<div class="card"><h2>' . $h($title) . '</h2>';
    if (!$rows) return $o . '<p class="muted">' . $h($empty) . '</p></div>';
    $o .= '<table><tr>'; foreach ($head as $i => $x) $o .= '<th' . ($i ? ' class="n"' : '') . '>' . $h($x) . '</th>'; $o .= '</tr>';
    foreach ($rows as $r) { $c = $fmt($r); $o .= '<tr>'; foreach ($c as $i => $x) $o .= '<td class="' . ($i ? 'n' : 'p') . '">' . $h($x) . '</td>'; $o .= '</tr>'; }
    return $o . '</table></div>';
};
$pct = fn($a, $b) => $b ? round(100 * $a / $b) . '%' : '-';
echo '<div class="grid">';
echo $table('Conversions', ['What', 'Times', 'Visitors'], $R['conversions'], fn($r) => [$nm($r[0]), $r[1], $r[2]], 'No conversions in this range.');
echo $table('Where visitors came from', ['Source', 'Visitors', 'Converted'], $R['sources'], fn($r) => [$r[0], $r[1], $r[2] . ' (' . $pct($r[2], $r[1]) . ')']);
echo $table('Top pages', ['Page', 'Views', 'Visitors', 'Avg time'], $R['pages'], fn($r) => [$r[0], $r[1], $r[2], $r[3] ? $secs((int) $r[3]) : '-']);
echo $table('Landing pages', ['Page', 'Visits started'], $R['entries'], fn($r) => [$r[0], $r[1]]);
echo $table('Campaigns (utm source / medium / campaign)', ['Campaign', 'Visitors', 'Converted'], $R['campaigns'], fn($r) => [$r[0], $r[1], $r[2]], 'No tagged links or QR codes in this range.');
echo $table('Devices', ['Device', 'Visitors', 'Converted'], $R['devices'], fn($r) => [ucfirst($r[0]), $r[1], $r[2]]);
echo $table('Browsers', ['Browser', 'Visitors'], $R['browsers'], fn($r) => [$r[0], $r[1]]);
echo $table('Time zone (rough location, from the browser)', ['Time zone', 'Visitors'], $R['zones'], fn($r) => [$r[0], $r[1]]);
echo $table('Other events', ['Event', 'Times'], $R['events'], fn($r) => [$nm($r[0]), $r[1]], 'None in this range.');
echo $table('Links to other sites', ['Site', 'Clicks'], $R['outbound'], fn($r) => [$r[0], $r[1]], 'None in this range.');
echo '</div>';
echo '<p class="muted" style="margin-top:14px">A visitor is one device on one day: the key that ties a day\'s visits together is replaced every night, so the same person on two days counts twice in a range. Conversions are visitors who did at least one of the things in the Conversions table that day. '
    . 'This device is not counted on traverseplatforms.com. To stop counting your devices on the other sites, open each once with <code>?sv_ignore=1</code> on the end';
foreach ($sites as $x) if ($x['host'] !== '' && $x['id'] !== $C['site']) echo ': <a href="https://' . $h($x['host']) . '/?sv_ignore=1" target="_blank" rel="noopener">' . $h($x['host']) . '</a>';
$at = new DateTime('@' . (int) $S['rep']['at']); $at->setTimezone(new DateTimeZone((string) $C['tz']));
echo '. Updated ' . $h($at->format('g:i a')) . '.</p>';
echo '</main></body></html>';
