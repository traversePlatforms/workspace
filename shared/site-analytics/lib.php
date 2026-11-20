<?php
declare(strict_types=1);
/* Site analytics (2026-11-20, Matthew: "Lets track traverse and sixfold analytics as well. It was made for them but i still manage the site
 * so i need the data on it"). First-party, self-hosted, cookie-free visit counting for traverseplatforms.com (marketing pages, not the
 * apps) and 365aeration.com (Sixfold 365). One copy of this file per site, in a private folder beside public_html:
 *
 *   ~/www/<site>/site-analytics/      0700   lib.php, config.php (0600), report.php, data/ (0700: ev-YYYY-MM-DD.jsonl, salt.json, rate.json)
 *   ~/www/<site>/public_html/sv/      v.js (the page script) and c.php (the collector; on 365 it also answers the stats page's report call)
 *   traverseplatforms.com only:       public_html/stats-54b859/index.php, Matthew's stats page (code in ~/.ssh/site-stats-code.txt)
 *
 * What it keeps, per event (one JSON line): time, kind (pv page view, lv time on page, ev an event or conversion, bot), page path (never
 * the query string), referrer DOMAIN, utm source/medium/campaign, ad-click flag, device type and browser family from the user agent, the
 * browser's time zone, and a visitor key for the day.
 * What it never keeps: the IP address, the full user agent, cookies, anything typed, query strings. The IP is used only inside a request,
 * to make the day's visitor key (sha256 of a random salt that is replaced every day, the IP, the user agent and the site, cut to 16 hex)
 * and to check the excluded addresses; yesterday's salt is overwritten, so keys can never be linked across days or turned back into IPs.
 * Not counted at all: Do Not Track or Global Privacy Control (browser setting or header), pages shown inside a frame (the hub, the app),
 * a device opted out with ?sv_ignore=1, staff opens of the signing page (?staff=1), the excluded addresses in config.php. Bots are kept as
 * bare counts (kind "bot") and left out of every number except the bot count.
 * A user agent containing "sv-selfcheck" goes to data/check-*.jsonl instead (live deploy checks), never into the numbers.
 *
 * Tests: node shared/site-analytics/tests/sa-test.mjs (php -S on a temp copy).
 * Deploy (20 Nov 2026 the first time): lib.php (+ report.php on Traverse) to site-analytics/ 0600; config.php written straight to the server
 * from ~/.ssh/site-stats-code.txt + site-stats-sum-key.txt, 0600, never saved in the repo (shape: config.example.php); v.js minified
 * (shared/tools/minify-public.cjs) + c.php to public_html/sv/; stats.php to public_html/stats-54b859/index.php. Traverse pages get the script
 * tag from traverse/marketing-site/build-site.cjs; 365aeration.com pages carry it in sixfold/aeration365-site. Back up, md5, flush, then
 * check plain and busted. Live checks use a user agent with "sv-selfcheck" so they land in data/check-*.jsonl, not the numbers. */

const SV_EVENTS_BASE = ['outbound', 'app_link_request', 'quote_viewed', 'agreement_opened'];
const SV_MAX_BODY = 2048;

function svDir(): string { $e = getenv('SV_PRIVATE'); return $e !== false && $e !== '' ? rtrim($e, '/\\') : __DIR__; }
function svCfg(): array {
    static $c = null;
    if ($c === null) { $f = svDir() . '/config.php'; $c = is_readable($f) ? (array) (require $f) : []; }
    return $c + ['site' => 'site', 'label' => 'Site', 'hosts' => [], 'tz' => 'America/Denver', 'conversions' => [], 'events' => [],
        'goal_paths' => [], 'exclude_ips' => [], 'keep_days' => 400, 'max_day' => 20000, 'per_visitor' => 150, 'sum_key' => '',
        'remotes' => [], 'code_hash' => '', 'test_mode' => false];
}
function svTest(): bool { return (bool) svCfg()['test_mode']; }
function svNow(): int { if (svTest() && isset($_SERVER['HTTP_X_TEST_TIME']) && ctype_digit((string) $_SERVER['HTTP_X_TEST_TIME'])) return (int) $_SERVER['HTTP_X_TEST_TIME']; return time(); }
function svDay(int $t): string { $d = new DateTime('@' . $t); $d->setTimezone(new DateTimeZone((string) svCfg()['tz'])); return $d->format('Y-m-d'); }
function svIp(): string { if (svTest() && isset($_SERVER['HTTP_X_TEST_IP'])) return (string) $_SERVER['HTTP_X_TEST_IP']; return (string) ($_SERVER['REMOTE_ADDR'] ?? ''); }
function svData(): string { $d = svDir() . '/data'; if (!is_dir($d)) { @mkdir($d, 0700, true); } return $d; }

/** write a file whole, 0600 */
function svPut(string $f, string $s): void { $t = $f . '.tmp' . bin2hex(random_bytes(3)); file_put_contents($t, $s); @chmod($t, 0600); rename($t, $f); }
/** run $fn with an exclusive lock on data/<name>.lock */
function svLocked(string $name, callable $fn) {
    $fp = fopen(svData() . '/' . $name . '.lock', 'c'); if (!$fp) return $fn();
    @chmod(svData() . '/' . $name . '.lock', 0600);
    flock($fp, LOCK_EX); try { return $fn(); } finally { flock($fp, LOCK_UN); fclose($fp); }
}
/** the day's salt: random, replaced when the day changes (the old one is overwritten, never kept) */
function svSalt(string $day): string {
    return svLocked('salt', function () use ($day) {
        $f = svData() . '/salt.json'; $j = json_decode((string) @file_get_contents($f), true);
        if (is_array($j) && ($j['day'] ?? '') === $day && strlen((string) ($j['salt'] ?? '')) === 64) return (string) $j['salt'];
        $s = bin2hex(random_bytes(32)); svPut($f, json_encode(['day' => $day, 'salt' => $s])); return $s;
    });
}
function svVisitor(string $day, string $ip, string $ua): string { return substr(hash('sha256', svSalt($day) . '|' . $ip . '|' . $ua . '|' . svCfg()['site']), 0, 16); }

/** device, browser family and whether it is a bot, from the user agent (the agent itself is never stored) */
function svUa(string $ua, bool $touch): array {
    $bot = $ua === '' || (bool) preg_match('#bot|crawl|spider|slurp|preview|facebookexternalhit|meta-externalagent|curl|wget|python|go-http|node-fetch|undici|axios|okhttp|java/|libwww|httpclient|headless|lighthouse|pagespeed|gtmetrix|pingdom|monitor|uptime|scan|zgrab|semrush|ahrefs|mj12|dataforseo|petal|bytespider|gptbot|claude|anthropic|perplexity|ccbot|phantom|selenium|puppeteer|playwright#i', $ua);
    if (preg_match('#iPad|Tablet|PlayBook|Silk|Kindle#i', $ua) || (preg_match('#Android#i', $ua) && !preg_match('#Mobile#i', $ua)) || ($touch && preg_match('#Macintosh#', $ua))) $dev = 'tablet';
    elseif (preg_match('#Mobi|iPhone|iPod|Android|Windows Phone#i', $ua)) $dev = 'phone';
    else $dev = 'desktop';
    $b = 'Other';
    foreach (['Facebook app' => '#FBAN|FBAV|FB_IAB#', 'Instagram app' => '#Instagram#', 'Edge' => '#Edg(e|A|iOS)?/#', 'Opera' => '#OPR/|Opera#', 'Samsung Internet' => '#SamsungBrowser#',
        'Firefox' => '#Firefox|FxiOS#', 'Chrome' => '#Chrome/|CriOS#', 'Safari' => '#Safari/#'] as $name => $re) if (preg_match($re, $ua)) { $b = $name; break; }
    return [$dev, $b, $bot];
}

/** clean one field; null = invalid */
function svField($v, string $re, int $max) { if ($v === null || $v === '') return ''; if (!is_string($v) || strlen($v) > $max || !preg_match($re, $v)) return null; return $v; }

/** the request's own host from Origin, else Referer (same-origin beacons) */
function svOriginHost(): string {
    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $k) { $v = (string) ($_SERVER[$k] ?? ''); if ($v !== '' && $v !== 'null') { $h = parse_url($v, PHP_URL_HOST); return is_string($h) ? strtolower($h) : ''; } }
    return '';
}

function svOut(int $code, ?array $j = null): void {
    http_response_code($code); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff'); header('X-Robots-Tag: noindex, nofollow');
    if ($j !== null) { header('Content-Type: application/json; charset=utf-8'); echo json_encode($j, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); }
}

/** rate limit by the day's visitor key (never the IP) and a cap on the site's events per day; true = allowed */
function svRate(string $vk, string $day): bool {
    $c = svCfg(); $now = svNow();
    return svLocked('rate', function () use ($vk, $day, $c, $now) {
        $f = svData() . '/rate.json'; $j = json_decode((string) @file_get_contents($f), true); if (!is_array($j)) $j = [];
        $b = intdiv($now, 600);
        if (($j['b'] ?? null) !== $b) { $j['b'] = $b; $j['c'] = []; }
        if (($j['day'] ?? null) !== $day) { $j['day'] = $day; $j['total'] = 0; }
        $n = (int) ($j['c'][$vk] ?? 0);
        if ($n >= (int) $c['per_visitor'] || (int) $j['total'] >= (int) $c['max_day']) { svPut($f, json_encode($j)); return false; }
        $j['c'][$vk] = $n + 1; $j['total'] = (int) $j['total'] + 1; svPut($f, json_encode($j)); return true;
    });
}

function svAppend(string $file, array $row): void {
    $f = svData() . '/' . $file; $new = !is_file($f);
    file_put_contents($f, json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
    if ($new) { @chmod($f, 0600); if (mt_rand(1, 20) === 1) svPrune(); }
}
/** drop day files past keep_days */
function svPrune(): void {
    $cut = svDay(svNow() - 86400 * (int) svCfg()['keep_days']);
    foreach (glob(svData() . '/{ev,check}-*.jsonl', GLOB_BRACE) ?: [] as $f) if (preg_match('/-(\d{4}-\d{2}-\d{2})\.jsonl$/', $f, $m) && $m[1] < $cut) @unlink($f);
}

/** POST /sv/c.php: one event from the page script */
function svCollect(): void {
    $c = svCfg();
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { svOut(405); return; }
    /* Do Not Track / Global Privacy Control sent as headers: not counted (the page script also checks the browser setting) */
    if (($_SERVER['HTTP_DNT'] ?? '') === '1' || ($_SERVER['HTTP_SEC_GPC'] ?? '') === '1') { svOut(204); return; }
    $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($len > SV_MAX_BODY) { svOut(413); return; }
    $raw = (string) file_get_contents('php://input', false, null, 0, SV_MAX_BODY + 1);
    if (strlen($raw) > SV_MAX_BODY) { svOut(413); return; }
    $j = json_decode($raw, true);
    if (!is_array($j) || array_is_list($j)) { svOut(400); return; }
    $hosts = array_map('strtolower', (array) $c['hosts']);
    $h = strtolower((string) ($j['h'] ?? ''));
    if (!in_array($h, $hosts, true)) { svOut(400); return; }
    $oh = svOriginHost();
    if ($oh === '' || !in_array($oh, $hosts, true)) { svOut(403); return; }
    $k = (string) ($j['k'] ?? '');
    if (!in_array($k, ['pv', 'lv', 'ev'], true)) { svOut(400); return; }
    $p = svField($j['p'] ?? null, '#^/[A-Za-z0-9._~\-/%]*$#', 200);
    $id = svField($j['id'] ?? null, '/^[0-9a-f]{12}$/', 12);
    if ($p === null || $p === '' || $id === null || $id === '') { svOut(400); return; }
    $p = preg_replace('#/index\.html?$#', '/', $p); $p = preg_replace('#/{2,}#', '/', $p);
    $ip = svIp();
    if (in_array($ip, (array) $c['exclude_ips'], true)) { svOut(204); return; }   /* our own machines: dropped before anything is kept */
    $ua = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 400);
    $now = svNow(); $day = svDay($now);
    [$dev, $br, $bot] = svUa($ua, !empty($j['tp']));
    if (!empty($j['wd'])) $bot = true;   /* navigator.webdriver: an automated browser */
    $file = (stripos($ua, 'sv-selfcheck') !== false ? 'check-' : 'ev-') . $day . '.jsonl';
    $vk = svVisitor($day, $ip, $ua);
    if (!svRate($vk, $day)) { svOut(429); return; }
    if ($bot) { if ($k === 'pv') svAppend($file, ['t' => $now, 'k' => 'bot', 'p' => $p]); svOut(204); return; }
    $row = ['t' => $now, 'k' => $k, 'p' => $p, 'v' => $vk, 'id' => $id];
    if ($k === 'pv') {
        $r = svField(isset($j['r']) ? strtolower((string) $j['r']) : null, '/^[a-z0-9.-]{1,100}$/', 100);
        $utm = []; foreach (['us', 'um', 'uc'] as $u) { $x = svField($j[$u] ?? null, '/^[A-Za-z0-9 _.+\-]{1,60}$/', 60); if ($x === null) { svOut(400); return; } $utm[$u] = $x; }
        $ad = svField($j['ad'] ?? null, '/^(fb|g|ms)$/', 2);
        $z = svField($j['z'] ?? null, '#^[A-Za-z_]+(/[A-Za-z0-9_+\-]+){0,2}$#', 40);
        if ($r === null || $ad === null || $z === null) { svOut(400); return; }
        if ($r !== '' && in_array(preg_replace('/^www\./', '', $r), array_map(fn($x) => preg_replace('/^www\./', '', $x), $hosts), true)) $r = '';
        $row += ['e' => empty($j['e']) ? 0 : 1, 'r' => preg_replace('/^www\./', '', $r), 'us' => $utm['us'], 'um' => $utm['um'], 'uc' => $utm['uc'], 'ad' => $ad, 'd' => $dev, 'b' => $br, 'z' => $z];
        $row = array_filter($row, fn($x) => $x !== '');
        svAppend($file, $row);
        $goal = (string) (((array) $c['goal_paths'])[$p] ?? '');
        if ($goal !== '') svAppend($file, ['t' => $now, 'k' => 'ev', 'p' => $p, 'v' => $vk, 'id' => $id, 'n' => $goal]);
    } elseif ($k === 'lv') {
        $s = $j['s'] ?? null;
        if (!is_int($s) || $s < 0 || $s > 86400) { svOut(400); return; }
        $row['s'] = min($s, 1800);
        svAppend($file, $row);
    } else {
        $n = svField($j['n'] ?? null, '/^[a-z][a-z0-9_]{1,39}$/', 40);
        $allowed = array_merge((array) $c['conversions'], (array) $c['events'], SV_EVENTS_BASE);
        if ($n === null || $n === '' || !in_array($n, $allowed, true)) { svOut(400); return; }
        $x = svField(isset($j['x']) ? strtolower((string) $j['x']) : null, '/^[a-z0-9.-]{1,100}$/', 100);
        if ($x === null) { svOut(400); return; }
        $row['n'] = $n; if ($x !== '') $row['x'] = $x;
        svAppend($file, $row);
    }
    svOut(204);
}

/* ---------- reading the numbers ---------- */

function svSource(array $pv): string {
    $us = strtolower((string) ($pv['us'] ?? '')); $r = (string) ($pv['r'] ?? ''); $ad = (string) ($pv['ad'] ?? '');
    if ($us !== '') return $us === 'qr' ? 'QR code (print)' : (in_array($us, ['email', 'newsletter'], true) ? 'Email' : ucfirst($us));
    if ($ad === 'fb') return 'Facebook ad'; if ($ad === 'g') return 'Google ad'; if ($ad === 'ms') return 'Microsoft ad';
    if ($r === '') return 'Direct, typed or an app';
    foreach (['Google' => '#(^|\.)google\.#', 'Bing' => '#(^|\.)bing\.com$#', 'DuckDuckGo' => '#duckduckgo\.com$#', 'Yahoo' => '#yahoo\.#', 'Facebook' => '#(^|\.)(facebook\.com|fb\.com|fb\.me)$#',
        'Instagram' => '#instagram\.com$#', 'Nextdoor' => '#nextdoor\.#', 'LinkedIn' => '#(linkedin\.com|lnkd\.in)$#', 'X' => '#(^|\.)(t\.co|x\.com|twitter\.com)$#', 'Email' => '#(mail\.|outlook\.|proton\.)#',
        'ChatGPT' => '#chatgpt\.com|openai\.com#', 'Yelp' => '#yelp\.com$#'] as $name => $re) if (preg_match($re, $r)) return $name;
    return $r;
}

/** read the day files for [$from, $to] (Y-m-d, inclusive) */
function svRows(string $from, string $to): array {
    $out = [];
    for ($d = $from; $d <= $to; $d = date('Y-m-d', strtotime($d . ' +1 day'))) {
        $f = svData() . '/ev-' . $d . '.jsonl'; if (!is_file($f)) continue;
        foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $l) { $r = json_decode($l, true); if (is_array($r)) { $r['day'] = $d; $out[] = $r; } }
    }
    return $out;
}

/** every number the stats page shows, for one range */
function svSummary(string $from, string $to): array {
    $c = svCfg(); $conv = (array) $c['conversions'];
    $rows = svRows($from, $to);
    $views = 0; $bots = 0; $vd = []; $pages = []; $entries = []; $first = []; $dur = []; $durPage = []; $events = []; $outb = []; $convVd = []; $conversions = [];
    foreach ($rows as $r) {
        $k = $r['k'] ?? ''; $key = ($r['day'] ?? '') . '|' . ($r['v'] ?? '');
        if ($k === 'bot') { $bots++; continue; }
        if ($k === 'pv') {
            $views++; $vd[$key] = 1; $p = (string) $r['p'];
            $pages[$p]['views'] = ($pages[$p]['views'] ?? 0) + 1; $pages[$p]['vd'][$key] = 1; $durPage[$r['id']] = $p;
            if (!empty($r['e'])) $entries[$p] = ($entries[$p] ?? 0) + 1;
            if (!isset($first[$key]) || (!empty($r['e']) && empty($first[$key]['e']))) $first[$key] = $r;   /* the visit's first landing */
        } elseif ($k === 'lv') { $dur[$r['id']] = max((int) ($dur[$r['id']] ?? 0), (int) ($r['s'] ?? 0)); }
        elseif ($k === 'ev') {
            $n = (string) ($r['n'] ?? '');
            if (in_array($n, $conv, true)) { $conversions[$n]['count'] = ($conversions[$n]['count'] ?? 0) + 1; $conversions[$n]['vd'][$key] = 1; $convVd[$key] = 1; }
            else { $events[$n] = ($events[$n] ?? 0) + 1; if ($n === 'outbound' && !empty($r['x'])) $outb[$r['x']] = ($outb[$r['x']] ?? 0) + 1; }
        }
    }
    $visitors = count($vd);
    $tally = function (callable $label) use ($first, $convVd) { $o = []; foreach ($first as $key => $pv) { $l = $label($pv); if ($l === '') continue; $o[$l][0] = ($o[$l][0] ?? 0) + 1; $o[$l][1] = ($o[$l][1] ?? 0) + (isset($convVd[$key]) ? 1 : 0); } uasort($o, fn($a, $b) => $b[0] <=> $a[0]); return $o; };
    $sources = $tally('svSource');
    $campaigns = $tally(fn($pv) => (($pv['us'] ?? '') . ($pv['um'] ?? '') . ($pv['uc'] ?? '')) === '' ? '' : implode(' / ', [$pv['us'] ?? '-', $pv['um'] ?? '-', $pv['uc'] ?? '-']));
    $devices = $tally(fn($pv) => (string) ($pv['d'] ?? 'desktop'));
    $browsers = $tally(fn($pv) => (string) ($pv['b'] ?? 'Other'));
    $zones = $tally(fn($pv) => (string) ($pv['z'] ?? 'unknown'));
    $durs = array_values(array_filter($dur, fn($s) => $s > 0)); $avg = $durs ? (int) round(array_sum($durs) / count($durs)) : 0;
    $pd = []; foreach ($dur as $id => $s) if ($s > 0 && isset($durPage[$id])) $pd[$durPage[$id]][] = $s;
    $pageList = []; foreach ($pages as $p => $x) $pageList[] = [$p, $x['views'], count($x['vd']), isset($pd[$p]) ? (int) round(array_sum($pd[$p]) / count($pd[$p])) : 0];
    usort($pageList, fn($a, $b) => $b[1] <=> $a[1]);
    arsort($entries); arsort($events); arsort($outb);
    $convList = []; foreach ($conv as $n) if (isset($conversions[$n])) $convList[] = [$n, $conversions[$n]['count'], count($conversions[$n]['vd'])];
    usort($convList, fn($a, $b) => $b[1] <=> $a[1]);
    $pairs = fn(array $a, int $n) => array_slice(array_map(fn($k, $v) => array_merge([(string) $k], (array) $v), array_keys($a), $a), 0, $n);
    return ['from' => $from, 'to' => $to, 'visitors' => $visitors, 'views' => $views, 'bots' => $bots, 'avg_time' => $avg,
        'conv_visitors' => count($convVd), 'conv_rate' => $visitors ? round(100 * count($convVd) / $visitors, 1) : 0.0,
        'pages' => array_slice($pageList, 0, 15), 'entries' => $pairs($entries, 10), 'sources' => $pairs($sources, 12), 'campaigns' => $pairs($campaigns, 12),
        'devices' => $pairs($devices, 5), 'browsers' => $pairs($browsers, 8), 'zones' => $pairs($zones, 8), 'conversions' => $convList,
        'events' => $pairs($events, 10), 'outbound' => $pairs($outb, 10)];
}

/** daily visitors, views and conversions for the last $n days */
function svSeries(int $n): array {
    $c = svCfg(); $conv = (array) $c['conversions']; $today = svDay(svNow()); $from = date('Y-m-d', strtotime($today . ' -' . ($n - 1) . ' days'));
    $days = []; for ($d = $from; $d <= $today; $d = date('Y-m-d', strtotime($d . ' +1 day'))) $days[$d] = ['v' => [], 'pv' => 0, 'cv' => 0];
    foreach (svRows($from, $today) as $r) {
        $d = $r['day']; if (!isset($days[$d])) continue;
        if (($r['k'] ?? '') === 'pv') { $days[$d]['pv']++; $days[$d]['v'][$r['v']] = 1; }
        elseif (($r['k'] ?? '') === 'ev' && in_array($r['n'] ?? '', $conv, true)) $days[$d]['cv']++;
    }
    $o = []; foreach ($days as $d => $x) $o[] = [$d, count($x['v']), $x['pv'], $x['cv']]; return $o;
}

/** the whole report for one site: today, 7 and 30 days, and the 30-day series */
function svReport(): array {
    $c = svCfg(); $today = svDay(svNow());
    $ago = fn(int $n) => date('Y-m-d', strtotime($today . ' -' . $n . ' days'));
    return ['ok' => true, 'site' => $c['site'], 'label' => $c['label'], 'today' => $today, 'at' => svNow(),
        'ranges' => ['today' => svSummary($today, $today), 'yesterday' => svSummary($ago(1), $ago(1)), '7' => svSummary($ago(6), $today), '30' => svSummary($ago(29), $today)],
        'series' => svSeries(30)];
}

/** POST /sv/c.php?a=report with X-SV-Key: the report, for the stats page on the other server */
function svReportEndpoint(): void {
    $c = svCfg(); $key = (string) $c['sum_key']; $got = (string) ($_SERVER['HTTP_X_SV_KEY'] ?? '');
    if (strlen($key) < 32) { svOut(404); return; }
    $ipk = substr(hash('sha256', 'rep|' . svSalt(svDay(svNow())) . '|' . svIp()), 0, 16);
    if (!svAttempts('rep', $ipk, false)) { svOut(429); return; }
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !hash_equals($key, $got)) { svAttempts('rep', $ipk, true); svOut(403); return; }
    svOut(200, svReport());
}

/** failed-attempt counter by hashed address, 10 per 15 minutes; $fail=true records one; returns false when over */
function svAttempts(string $what, string $ipk, bool $fail): bool {
    return svLocked('att', function () use ($what, $ipk, $fail) {
        $f = svData() . '/attempts.json'; $j = json_decode((string) @file_get_contents($f), true); if (!is_array($j)) $j = [];
        $b = intdiv(svNow(), 900); if (($j['b'] ?? null) !== $b) $j = ['b' => $b, 'c' => []];
        $k = $what . '|' . $ipk; $n = (int) ($j['c'][$k] ?? 0);
        if ($fail) { $j['c'][$k] = $n + 1; svPut($f, json_encode($j)); }
        return $n < 10;
    });
}
