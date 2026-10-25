<?php
/* Peak Sponsor Desk: looking a company up (2026-10-24, Matthew: "Build a way to take their added companies and run data pulls on them";
 * "run company scans more frequently so that peak leads updates").
 * - Their own website: the home page and up to three of its contact, sponsorship/community and about pages, for phones, emails (their
 *   own domain or a free mail address; a web designer's address in the footer is left out), the address, social pages and a
 *   sponsorship or giving page. robots.txt is obeyed.
 * - The miles from Peak, from the address (US Census geocoder, free, public domain), when the lead has none.
 * - For leads whose phone came from a page (callSrc): whether that page still shows the number.
 * - People from Hunter only when someone taps for it (free plan, 50 searches a month; the key lives in the data folder, never sent out).
 * Each look-up is compared with the last one; what changed is kept (12 most recent). Results go to scans.json beside the log, never
 * into the log: the log is what people did. Included by desk.php; nothing here runs on its own. */
if (!defined('DESK')) { http_response_code(404); exit; }

const UA = 'Mozilla/5.0 (compatible; PeakSponsorDesk/1.0; +https://traverseplatforms.com/)';
const PEAK = [38.9475, -104.7956];   /* Chapel Hills Mall */
const FREE_MAIL = '/@(gmail|yahoo|outlook|hotmail|aol|icloud|me|msn|live|comcast|protonmail)\.(com|net)$/';

/* GET a public web page. Every hop is checked: http(s) on the normal ports, a name that resolves to a public address only, and the
   connection pinned to the address that was checked. */
function scanFetch(string $url, int $max = 1500000): array {
    for ($hop = 0; $hop < 5; $hop++) {
        $p = parse_url($url);
        $sch = strtolower((string) ($p['scheme'] ?? ''));
        if (!$p || !in_array($sch, ['http', 'https'], true) || empty($p['host'])) return ['ok' => false, 'err' => 'not a web address'];
        $port = (int) ($p['port'] ?? ($sch === 'https' ? 443 : 80));
        if (!in_array($port, [80, 443], true)) return ['ok' => false, 'err' => 'not a normal web address'];
        $host = strtolower($p['host']); $ips = @gethostbynamel($host) ?: [];
        if (!$ips) return ['ok' => false, 'err' => 'the site was not found'];
        foreach ($ips as $ip) if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return ['ok' => false, 'err' => 'not a public site'];
        $body = ''; $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_FOLLOWLOCATION => false, CURLOPT_TIMEOUT => 12, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_ENCODING => '',
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS, CURLOPT_USERAGENT => UA, CURLOPT_RESOLVE => ["$host:$port:{$ips[0]}"],
            CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5', 'Accept-Language: en-US,en;q=0.8'],
            CURLOPT_WRITEFUNCTION => function ($c, $d) use (&$body, $max) { $body .= $d; return strlen($body) > $max ? 0 : strlen($d); }]);
        curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE); $loc = (string) curl_getinfo($ch, CURLINFO_REDIRECT_URL); $err = curl_errno($ch); unset($ch);
        if ($code >= 300 && $code < 400 && $loc !== '') { $url = $loc; continue; }
        if ($err && $err !== CURLE_WRITE_ERROR) return ['ok' => false, 'err' => 'the site did not answer'];
        if ($code !== 200) return ['ok' => false, 'err' => 'the site answered ' . $code];
        return ['ok' => true, 'url' => $url, 'body' => $body];
    }
    return ['ok' => false, 'err' => 'too many redirects'];
}
/* a JSON API at a fixed address (Hunter, the Census geocoder) */
function scanJson(string $url): ?array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_USERAGENT => UA, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS]);
    $s = curl_exec($ch); unset($ch);
    $j = is_string($s) ? json_decode($s, true) : null;
    return is_array($j) ? $j : null;
}

function scanAbs(string $href, string $base): string {
    $href = trim($href);
    if ($href === '' || $href[0] === '#' || preg_match('#^(javascript|data|sms|whatsapp):#i', $href)) return '';
    if (preg_match('#^https?://#i', $href)) return $href;
    $b = parse_url($base); if (!$b || empty($b['host'])) return '';
    $root = $b['scheme'] . '://' . $b['host'];
    if (substr($href, 0, 2) === '//') return $b['scheme'] . ':' . $href;
    if ($href[0] === '/') return $root . $href;
    $dir = preg_replace('#/[^/]*$#', '/', $b['path'] ?? '/');
    return $root . ($dir ?: '/') . $href;
}
function scanHost(string $u): string { return preg_replace('/^www\./', '', strtolower((string) (parse_url($u, PHP_URL_HOST) ?? ''))); }

function scanPhone(string $s): string {
    $d = preg_replace('/\D/', '', $s);
    if (strlen($d) === 11 && $d[0] === '1') $d = substr($d, 1);
    if (strlen($d) !== 10 || $d[0] < '2' || $d[3] < '2' || substr($d, 3, 3) === '555') return '';
    return '(' . substr($d, 0, 3) . ') ' . substr($d, 3, 3) . '-' . substr($d, 6);
}
function scanEmailOk(string $e, string $host): string {
    $e = strtolower(trim($e, " \t\n\r\0\x0B.,;:<>()[]'\""));
    if (!filter_var($e, FILTER_VALIDATE_EMAIL) || preg_match('/\.(png|jpe?g|gif|webp|svg|css|js)$/', $e)) return '';
    $dom = substr($e, strpos($e, '@') + 1);
    if (preg_match('/(^|\.)(sentry\.io|wixpress\.com|example\.com|domain\.com|email\.com|yourdomain\.com|sentry-next\.wixpress\.com)$/', $dom) || preg_match('/^[0-9a-f]{20,}@/', $e)) return '';
    $own = $host !== '' && ($dom === $host || substr($dom, -strlen('.' . $host)) === '.' . $host || substr($host, -strlen('.' . $dom)) === '.' . $dom);
    return ($own || preg_match(FREE_MAIL, $e)) ? $e : '';
}

/* walk JSON-LD (schema.org) for telephone, email, address, sameAs */
function scanLd($d, array &$o): void {
    if (!is_array($d)) return;
    foreach ($d as $k => $v) {
        if ($k === 'telephone' && is_string($v)) $o['phones'][] = $v;
        elseif ($k === 'email' && is_string($v)) $o['emails'][] = preg_replace('/^mailto:/i', '', $v);
        elseif ($k === 'sameAs') foreach ((array) $v as $u) { if (is_string($u)) $o['social'][] = $u; }
        elseif ($k === 'address' && is_array($v) && !empty($v['streetAddress']) && !$o['addr']) $o['addr'] = trim(implode(', ', array_filter([$v['streetAddress'] ?? '', $v['addressLocality'] ?? '', trim(($v['addressRegion'] ?? '') . ' ' . ($v['postalCode'] ?? ''))])));
        elseif (is_array($v)) scanLd($v, $o);
    }
}

function scanParse(string $html, string $base): array {
    $o = ['phones' => [], 'emails' => [], 'addr' => '', 'social' => [], 'links' => [], 'title' => ''];
    if (preg_match_all('/data-cfemail="([0-9a-f]{4,})"/i', $html, $m)) foreach ($m[1] as $h) {   /* Cloudflare hides emails this way */
        $k = hexdec(substr($h, 0, 2)); $e = ''; for ($i = 2; $i + 1 < strlen($h); $i += 2) $e .= chr(hexdec(substr($h, $i, 2)) ^ $k); $o['emails'][] = $e;
    }
    if (preg_match_all('#<script[^>]+application/ld\+json[^>]*>(.*?)</script>#is', $html, $m)) foreach ($m[1] as $j) { $d = json_decode(trim($j), true); if (is_array($d)) scanLd($d, $o); }
    if (preg_match_all('#<a\b[^>]*?href\s*=\s*["\']([^"\']+)["\'][^>]*>(.*?)</a>#is', $html, $m, PREG_SET_ORDER)) foreach ($m as $a) {
        $href = html_entity_decode(trim($a[1]), ENT_QUOTES | ENT_HTML5);
        if (stripos($href, 'tel:') === 0) { $o['phones'][] = rawurldecode(substr($href, 4)); continue; }
        if (stripos($href, 'mailto:') === 0) { $o['emails'][] = rawurldecode(explode('?', substr($href, 7))[0]); continue; }
        $abs = scanAbs($href, $base); if ($abs === '') continue;
        if (preg_match('#^https?://([a-z]+\.)?(facebook|instagram|linkedin|x|twitter|youtube|tiktok)\.com/#i', $abs)) { if (!preg_match('#/(sharer|share|intent|dialog|plugins|embed)[/?.]#i', $abs)) $o['social'][] = $abs; continue; }
        $o['links'][] = [$abs, mb_substr(trim(preg_replace('/\s+/', ' ', strip_tags($a[2]))), 0, 60)];
    }
    $t = preg_replace('#<(script|style|noscript|svg|template)\b.*?</\1>#is', ' ', $html);
    $t = html_entity_decode(strip_tags(preg_replace('#<br\s*/?>|</(p|div|li|h\d|td|address|span)>#i', "\n", $t)), ENT_QUOTES | ENT_HTML5);
    $t = preg_replace('/[ \t\x{00A0}]+/u', ' ', $t);
    if (preg_match_all('/(?<![\d-])(?:\+?1[ .-]?)?(?:\((\d{3})\)\s?|(\d{3})[ .-])(\d{3})[ .-](\d{4})(?![\d-])/', $t, $m, PREG_SET_ORDER)) foreach ($m as $x) $o['phones'][] = ($x[1] ?: $x[2]) . $x[3] . $x[4];
    if (preg_match_all('/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/', $t, $m)) foreach ($m[0] as $e) $o['emails'][] = $e;
    if (!$o['addr'] && preg_match('/\b\d{2,6}\s+(?:[NSEW]\.?\s+)?[A-Za-z0-9.\' -]{2,40}?\b(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Parkway|Pkwy|Court|Ct|Circle|Cir|Place|Pl|Highway|Hwy|Loop|Point|Pt|Trail|Trl|Grove|Heights|Hts)\b\.?(?:,?\s*(?:Suite|Ste|Unit|#)\.?\s*[\w-]+)?[,\s]+[A-Za-z .]{3,30},?\s+(?:CO|Colorado)\s+8\d{4}\b/', $t, $m)) $o['addr'] = trim(preg_replace('/\s+/', ' ', $m[0]));
    if (preg_match('#<title[^>]*>(.*?)</title>#is', $html, $m)) $o['title'] = mb_substr(trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5)), 0, 120);
    return $o;
}

/* robots.txt: the Disallow lines for every robot (or for this one); a longer Allow wins */
function scanRobots(string $site): array {
    $r = scanFetch(preg_replace('#^(https?://[^/]+).*$#i', '$1', $site) . '/robots.txt', 200000);
    if (!$r['ok']) return [];
    $rules = []; $mine = false; $inGroup = false;
    foreach (preg_split('/\r?\n/', $r['body']) as $ln) {
        $ln = trim(preg_replace('/#.*/', '', $ln)); if ($ln === '' || strpos($ln, ':') === false) continue;
        [$k, $v] = array_map('trim', explode(':', $ln, 2)); $k = strtolower($k);
        if ($k === 'user-agent') { if (!$inGroup) $mine = false; $inGroup = true; if ($v === '*' || stripos($v, 'peaksponsordesk') !== false) $mine = true; continue; }
        $inGroup = false;
        if ($mine && ($k === 'disallow' || $k === 'allow') && $v !== '') $rules[] = [$k === 'allow', $v];
    }
    return $rules;
}
function scanAllowed(array $rules, string $url): bool {
    $path = (string) (parse_url($url, PHP_URL_PATH) ?: '/'); $best = -1; $ok = true;
    foreach ($rules as [$allow, $p]) { $re = '#^' . str_replace(['\*', '\$'], ['.*', '$'], preg_quote($p, '#')) . '#'; if (preg_match($re, $path) && strlen($p) > $best) { $best = strlen($p); $ok = $allow; } }
    return $ok;
}

function siteOf(array $L): string {
    $s = trim((string) ($L['site'] ?? '')); if ($s === '') return '';
    return preg_match('#^https?://#i', $s) ? $s : 'https://' . $s;
}
function srcUrl(array $L): string { return preg_match('#https?://[^\s;,)\'"]+#', (string) ($L['callSrc'] ?? ''), $m) ? rtrim($m[0], '.') : ''; }

function milesTo(float $lat, float $lon): float {
    $r = M_PI / 180; $dl = ($lat - PEAK[0]) * $r; $dn = ($lon - PEAK[1]) * $r;
    $x = sin($dl / 2) ** 2 + cos(PEAK[0] * $r) * cos($lat * $r) * sin($dn / 2) ** 2;
    return round(3958.8 * 2 * atan2(sqrt($x), sqrt(1 - $x)), 1);
}
function geocode(string $addr): ?array {
    $j = scanJson('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?' . http_build_query(['address' => $addr, 'benchmark' => 'Public_AR_Current', 'format' => 'json']));
    $c = $j['result']['addressMatches'][0]['coordinates'] ?? null;
    return $c ? ['lat' => (float) $c['y'], 'lon' => (float) $c['x']] : null;
}

/* the website look-up for one lead; returns the fields that replace the last look-up's */
function scanSite(array $L, ?array $prev): array {
    $site = siteOf($L); $r = ['at' => time(), 'site' => $site, 'ok' => false, 'err' => '', 'phones' => [], 'emails' => [], 'addr' => '', 'social' => [], 'pages' => [], 'title' => ''];
    if ($site !== '') {
        $rules = scanRobots($site);
        if (!scanAllowed($rules, $site)) $r['err'] = 'the site asks robots not to read it';
        else {
            $home = scanFetch($site);
            if (!$home['ok']) $r['err'] = $home['err'];
            else {
                $host = scanHost($home['url']); $all = [[scanParse($home['body'], $home['url']), 'home page']];
                /* pick the contact, sponsorship/community and about pages from the home page's links (same site only) */
                $want = ['contact' => '/contact|reach-us|get-in-touch|locations?\b/i', 'sponsor' => '/sponsor|community|giving|give-back|donat|charit|outreach|partners?hip/i', 'about' => '/about|our-team|\bteam\b|staff|leadership|our-story/i'];
                $pick = [];
                foreach ($all[0][0]['links'] as [$u, $txt]) {
                    if (scanHost($u) !== $host || preg_match('/\.(pdf|jpe?g|png|zip|docx?)(\?|$)/i', $u)) continue;
                    $path = (string) parse_url($u, PHP_URL_PATH);
                    foreach ($want as $k => $re) if (!isset($pick[$k]) && (preg_match($re, $path) || preg_match($re, $txt)) && rtrim($u, '/') !== rtrim($home['url'], '/')) $pick[$k] = $u;
                }
                foreach ($pick as $k => $u) {
                    if (!scanAllowed($rules, $u)) continue;
                    $pg = scanFetch($u); if (!$pg['ok']) continue;
                    $all[] = [scanParse($pg['body'], $pg['url']), $k === 'contact' ? 'contact page' : ($k === 'sponsor' ? 'community page' : 'about page')];
                    if ($k !== 'about') $r['pages'][$k] = $pg['url'];
                }
                $seenP = []; $seenE = []; $soc = [];
                foreach ($all as [$o, $where]) {
                    foreach ($o['phones'] as $p) { $n = scanPhone($p); if ($n !== '' && !isset($seenP[$n]) && count($seenP) < 6) { $seenP[$n] = 1; $r['phones'][] = ['phone' => $n, 'where' => $where]; } }
                    foreach ($o['emails'] as $e) { $n = scanEmailOk($e, $host); if ($n !== '' && !isset($seenE[$n]) && count($seenE) < 6) { $seenE[$n] = 1; $r['emails'][] = ['email' => $n, 'where' => $where]; } }
                    if (!$r['addr'] && $o['addr']) $r['addr'] = $o['addr'];
                    foreach ($o['social'] as $u) { if (!preg_match('#^https?://([a-z]+\.)?(facebook|instagram|linkedin|x|twitter|youtube|tiktok)\.com/#i', $u, $sm)) continue; $k = strtolower($sm[2]); if (!isset($soc[$k])) $soc[$k] = $u; }
                }
                $r['social'] = array_values(array_slice($soc, 0, 6)); $r['title'] = $all[0][0]['title']; $r['ok'] = true;
            }
        }
    }
    /* the miles from Peak, when the lead has none */
    if (!isset($L['miles']) && $r['addr'] !== '') {
        if ($prev && ($prev['addr'] ?? '') === $r['addr'] && isset($prev['miles'])) $r['miles'] = $prev['miles'];
        elseif ($g = geocode($r['addr'])) $r['miles'] = milesTo($g['lat'], $g['lon']);
    }
    /* is the phone still on the page it came from */
    $src = srcUrl($L); $want = preg_replace('/\D/', '', (string) ($L['phone'] ?? ''));
    if ($src !== '' && strlen($want) >= 10) {
        $pg = scanFetch($src);
        /* anywhere in the page, its text or a tap-to-call link, with any separators (2026-10-24: tel: links were missed at first) */
        $w = substr($want, -10); $re = '/(?<!\d)' . substr($w, 0, 3) . '(?:[\s.()-]|%20)*' . substr($w, 3, 3) . '(?:[\s.-]|%20)*' . substr($w, 6) . '(?!\d)/';
        $r['srcCheck'] = ['url' => $src, 'ok' => $pg['ok'] ? (bool) preg_match($re, $pg['body']) : null, 'err' => $pg['ok'] ? '' : $pg['err']];
    }
    return $r;
}

/* what changed since the last look-up that read the site */
function scanChanges(?array $prev, array $now): array {
    $ch = $prev['changes'] ?? [];
    if ($prev && !empty($prev['ok']) && $now['ok']) {
        $a = array_column($prev['phones'] ?? [], 'phone'); $b = array_column($now['phones'], 'phone');
        foreach (array_diff($b, $a) as $x) $ch[] = ['at' => $now['at'], 'what' => 'New phone on their site: ' . $x];
        foreach (array_diff($a, $b) as $x) $ch[] = ['at' => $now['at'], 'what' => 'No longer on their site: ' . $x];
        $a = array_column($prev['emails'] ?? [], 'email'); $b = array_column($now['emails'], 'email');
        foreach (array_diff($b, $a) as $x) $ch[] = ['at' => $now['at'], 'what' => 'New email on their site: ' . $x];
        foreach (array_diff($a, $b) as $x) $ch[] = ['at' => $now['at'], 'what' => 'No longer on their site: ' . $x];
        if (($prev['addr'] ?? '') !== '' && $now['addr'] !== '' && $prev['addr'] !== $now['addr']) $ch[] = ['at' => $now['at'], 'what' => 'Address now reads: ' . $now['addr']];
    }
    if (isset($prev['srcCheck']['ok'], $now['srcCheck']['ok']) && $prev['srcCheck']['ok'] === true && $now['srcCheck']['ok'] === false) $ch[] = ['at' => $now['at'], 'what' => 'The phone is no longer on the page it came from'];
    return array_slice($ch, -12);
}

/* Hunter: people at the company's domain. Owners, managers and marketing first; when that finds nobody (free), any address there. */
function hunterKey(): string { $j = jread('hunter.json', []); return (string) ($j['api_key'] ?? ''); }
/* $fresh: ask Hunter (free); otherwise the count kept by the last ask (the hourly job asks), so opening the desk never waits on Hunter */
function hunterLeft(bool $fresh = false): ?int {
    if (hunterKey() === '') return null;
    $st = jread('hunter-state.json', []);
    if (!$fresh && isset($st['left'])) return (int) $st['left'];
    $j = scanJson('https://api.hunter.io/v2/account?api_key=' . rawurlencode(hunterKey()));
    $s = $j['data']['requests']['searches'] ?? null; if (!$s) return isset($st['left']) ? (int) $st['left'] : null;
    $left = max(0, (int) $s['available'] - (int) $s['used']); jwrite('hunter-state.json', ['left' => $left, 'at' => time()]);
    return $left;
}
function hunterDomain(array $L): string {
    $s = siteOf($L); if ($s !== '') return scanHost($s);
    foreach ((array) ($L['contacts'] ?? []) as $c) if (!empty($c['email']) && !preg_match(FREE_MAIL, strtolower($c['email']))) return strtolower(substr($c['email'], strpos($c['email'], '@') + 1));
    return '';
}
function hunterFind(string $domain): array {
    $out = ['at' => time(), 'domain' => $domain, 'people' => [], 'err' => ''];
    foreach (['executive,management,marketing,communication', ''] as $dept) {
        $q = ['domain' => $domain, 'limit' => '10', 'api_key' => hunterKey()]; if ($dept !== '') $q['department'] = $dept;
        $j = scanJson('https://api.hunter.io/v2/domain-search?' . http_build_query($q));
        if (!$j) { $out['err'] = 'Hunter did not answer'; break; }
        if (!empty($j['errors'])) { $out['err'] = 'Hunter: ' . mb_substr((string) ($j['errors'][0]['details'] ?? $j['errors'][0]['id'] ?? 'error'), 0, 120); break; }
        foreach ((array) ($j['data']['emails'] ?? []) as $e) $out['people'][] = ['name' => trim(($e['first_name'] ?? '') . ' ' . ($e['last_name'] ?? '')), 'pos' => (string) ($e['position'] ?? ''), 'email' => (string) ($e['value'] ?? ''), 'phone' => (string) ($e['phone_number'] ?? ''), 'conf' => (int) ($e['confidence'] ?? 0), 'from' => 'Hunter'];
        if ($out['people']) break;
    }
    hunterLeft(true);
    return $out;
}

/* The Colorado Secretary of State's business filings (2026-10-24, Matthew: "go ahead"): open data at data.colorado.gov, refreshed daily.
   Business entities (4ykn-tg5h) and trade names (u7sb-g482), matched on the exact name only (LLC, Inc and the like set aside): an
   active filing, and when several share the name, the one in the Springs area or none. The registered agent, when a person, is often
   the owner at a small business; that is all it is said to be. */
function regNorm(string $s): string {
    $s = strtoupper($s); $s = preg_replace('/,?\s*(DELINQUENT|DISSOLVED|EXPIRED|VOLUNTARILY|ADMINISTRATIVELY)\b.*$/', '', $s); $s = str_replace('&', ' AND ', $s);
    $s = preg_replace('/[^A-Z0-9 ]+/', ' ', $s); $s = preg_replace('/\b(THE|LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|PC|P C|PLLC|LLP|LP|DBA)\b/', ' ', $s);
    return trim(preg_replace('/\s+/', ' ', $s));
}
function regTitle(string $s): string { return ucwords(strtolower(trim(preg_replace('/\s+/', ' ', $s)))); }
function regFind(array $L): array {
    $out = ['at' => time()]; $n = regNorm(preg_replace('/\s*\(.*?\)\s*/', ' ', (string) $L['name']));
    if (strlen($n) < 4) return $out + ['none' => true];
    $first = str_replace("'", "''", implode(' ', array_slice(explode(' ', $n), 0, 2)));
    $q = fn(string $ds, string $where, string $sel) => scanJson("https://data.colorado.gov/resource/$ds.json?" . http_build_query(['$where' => $where, '$select' => $sel, '$limit' => '50']));
    $E = $q('4ykn-tg5h', "upper(entityname) like '$first%'", 'entityname,entitystatus,entityid,principalcity,entityformdate,agentfirstname,agentlastname,agentorganizationname');
    $T = $q('u7sb-g482', "upper(tradenamedescription) like '$first%'", 'tradenamedescription,entitystatus,entityid,registrantorganization,firstname,lastname,city');
    if ($E === null || $T === null) return ['at' => 0, 'err' => 'the state data did not answer'];   /* tried again next run */
    $local = '/colorado springs|monument|fountain|peyton|falcon|manitou|woodland park|security|widefield|black forest/i';
    $good = fn($x) => (bool) preg_match('/good|exists|active/i', (string) ($x['entitystatus'] ?? ''));
    $e = array_values(array_filter($E, fn($x) => regNorm((string) ($x['entityname'] ?? '')) === $n && $good($x)));
    $t = array_values(array_filter($T, fn($x) => regNorm((string) ($x['tradenamedescription'] ?? '')) === $n && $good($x)));
    $ent = count($e) === 1 ? $e[0] : null;
    if (!$ent && count($e) > 1) { $loc = array_values(array_filter($e, fn($x) => preg_match($local, (string) ($x['principalcity'] ?? '')))); if (count($loc) === 1) $ent = $loc[0]; else $out['many'] = count($e); }
    if ($ent) {
        $out += ['legal' => preg_replace('/,?\s*(Delinquent|Dissolved).*$/i', '', (string) $ent['entityname']), 'status' => (string) $ent['entitystatus'], 'id' => (string) $ent['entityid'], 'city' => regTitle((string) ($ent['principalcity'] ?? '')), 'formed' => substr((string) ($ent['entityformdate'] ?? ''), 0, 10)];
        $local2 = preg_match($local, (string) ($ent['principalcity'] ?? ''));
        if (!empty($ent['agentlastname']) && ($L['list'] !== 'new' || $local2)) $out['agent'] = regTitle(($ent['agentfirstname'] ?? '') . ' ' . $ent['agentlastname']);   /* a big company's agent sits at head office: no use to Brandon */
        elseif (!empty($ent['agentorganizationname'])) $out['agentOrg'] = true;
    }
    foreach ($t as $x) if (!empty($x['lastname']) && (empty($x['city']) || preg_match($local, (string) $x['city']))) $out['trade'][] = regTitle(($x['firstname'] ?? '') . ' ' . $x['lastname']);
    if (!$ent && empty($out['many']) && empty($out['trade'])) { $tr = array_values(array_filter($t, fn($x) => !empty($x['registrantorganization']))); if ($tr) $out += ['legal' => (string) $tr[0]['registrantorganization'], 'id' => (string) $tr[0]['entityid'], 'viaTrade' => true]; else $out['none'] = true; }
    return $out;
}
function regDue(?array $cur): bool { return empty($cur['reg']['at']) || $cur['reg']['at'] < time() - 30 * 86400; }

/* one look-up, merged into scans.json under a lock (the hourly job and a tap can meet); the state filing rides along once a month */
function scanAndSave(array $L, string $what = 'site'): array {
    $id = (string) $L['id']; $prev = jread('scans.json', [])[$id] ?? null;
    $new = $what === 'hunter' || (siteOf($L) === '' && srcUrl($L) === '') ? null : scanSite($L, $prev);
    $hun = $what === 'hunter' ? hunterFind(hunterDomain($L)) : null;
    $reg = $what !== 'hunter' && regDue($prev) ? regFind($L) : null;
    $fh = fopen(DATA_DIR . '/scans.lock', 'c'); flock($fh, LOCK_EX);
    $all = jread('scans.json', []); $cur = $all[$id] ?? null;
    if ($new) { $new['changes'] = scanChanges($cur, $new); foreach (['hunter', 'reg'] as $k) if (isset($cur[$k])) $new[$k] = $cur[$k]; $new['firstAt'] = !empty($cur['firstAt']) ? $cur['firstAt'] : $new['at']; $cur = $new; }
    if ($hun) { $cur = ($cur ?? ['at' => 0]); $cur['hunter'] = $hun; }
    if ($reg) { $cur = ($cur ?? ['at' => 0]); $cur['reg'] = $reg; }
    $all[$id] = $cur; jwrite('scans.json', $all);
    flock($fh, LOCK_UN); fclose($fh);
    return $cur;
}

/* the hourly job: the companies with a website or a phone source, the ones never looked up or not looked up in $ageH hours first */
function rescanDue(int $max, int $ageH = 20): int {
    $lk = fopen(DATA_DIR . '/rescan.lock', 'c');
    if (!flock($lk, LOCK_EX | LOCK_NB)) { echo date('c') . " rescan: one is already running\n"; return 0; }
    $S = state(); $sc = jread('scans.json', []); $due = [];
    foreach ($S['leads'] as $id => $L) {
        $web = siteOf($L) !== '' || srcUrl($L) !== ''; $at = (int) ($sc[$id]['at'] ?? 0);
        $webDue = $web && $at <= time() - $ageH * 3600;
        if (!$webDue && !regDue($sc[$id] ?? null)) continue;   /* every lead gets its state filing checked once a month, website or not */
        $due[] = [$webDue ? $at : (int) ($sc[$id]['reg']['at'] ?? 0), $L['list'] === 'added' ? 0 : 1, $id];
    }
    sort($due);
    $n = 0; $t0 = time();
    foreach (array_slice($due, 0, $max) as [, , $id]) {
        $r = scanAndSave($S['leads'][$id]); $n++;
        $rg = $r['reg'] ?? []; $rgs = !empty($rg['agent']) || !empty($rg['trade']) ? 'filing + person' : (!empty($rg['legal']) ? 'filing' : (!empty($rg['err']) ? 'filing not read' : 'no filing'));
        echo date('c') . " $id " . (!isset($r['site']) ? 'no website' : (!empty($r['ok']) ? count($r['phones']) . ' phones ' . count($r['emails']) . ' emails' : ($r['site'] !== '' ? 'not read: ' . $r['err'] : 'source page only'))) . " · $rgs\n";
        if (time() - $t0 > 600) break;
    }
    hunterLeft(true);
    echo date('c') . " rescan: $n looked up, " . max(0, count($due) - $n) . " still due\n";
    return 0;
}
