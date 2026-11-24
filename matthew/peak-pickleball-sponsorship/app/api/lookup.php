<?php
/* Peak desk: the look-up after a company is added (2026-11-24, Matthew: "whatever companies brandon added can you do a dive and pull more
 * information on them and populate what we normally have for that space. Anytime a company gets added we should automatically pull data on
 * them").
 * Adding a company (either list, or a Merge that brings a website) puts it in lookup-queue.json (lkQueue, desk-store.php); the add itself
 * looks nothing up. The 5-minute run (alertsFlush, from the Peak email's `cron.php inbox`) starts `php desk.php lookups` in the background
 * when the queue has anything in it (lkKick), so a company is looked up within about five minutes. One look-up (autoLookup):
 *   1. the Colorado Secretary of State filing (free, data.colorado.gov): legal name, standing, year formed, the principal office's address;
 *   2. no website on the card: likely addresses made from the name, and any business email domain on the card, each read and kept only
 *      when the page shows the name AND (one of the card's phones OR a Springs-area address, or the filing's street); when those find
 *      nothing, Hunter's company search (paid, so only then, and only while more than HUNTER_KEEP searches are left this month), checked the
 *      same way. Nothing matched: no website is saved and the note says "Website not found";
 *   3. the normal website read (scanSite): phones, emails, the address, contact / community / events pages, social pages, what they say
 *      they do;
 *   4. written through the desk's own rows, by "Looked up automatically": the website (only when the card has none), a "fill" row (only
 *      fields still blank: what they do, the kind / category), a general email or phone as a contact marked with where it came from (only
 *      when the card has no email / no phone), and one note saying what was found and where. Nothing a person typed is changed, and nobody
 *      is contacted.
 *   php desk.php lookups [n]                 the queue (the 5-minute run starts this)
 *   php desk.php lookups --backfill [--dry-run]   queue every company added by hand that has had no automatic look-up, then run */
if (!defined('DESK')) { http_response_code(404); exit; }

const HUNTER_KEEP = 5;   /* Hunter searches kept back for the sellers' own taps */
const LK_GENERIC_TYPES = ['Organization', 'LocalBusiness', 'Corporation', 'WebSite', 'WebPage', 'Place', 'Thing', 'Brand', 'Person', 'Store', 'ProfessionalService', 'Service', 'OnlineBusiness', 'OnlineStore'];

/* the description a site gives itself, unless it is a placeholder */
function lkDesc(string $d): string {
    $d = trim($d); if ($d === '' || preg_match('/just another wordpress|coming soon|under construction|lorem ipsum|domain (is )?for sale|buy this domain/i', $d)) return '';
    return mb_strlen($d) > 220 ? rtrim(mb_substr($d, 0, 217)) . '…' : $d;
}
/* a JSON-LD type that says what the business is ("SignShop" -> "Sign shop"); the general ones say nothing */
function lkKind(array $types): string {
    foreach ($types as $t) {
        $t = (string) $t; if (in_array($t, LK_GENERIC_TYPES, true) || !preg_match('/^[A-Z][A-Za-z]{3,40}$/', $t)) continue;
        if (!preg_match('/(Business|Shop|Store|Service|Restaurant|Clinic|Agency|Office|Center|Dealer|Contractor|Practice|Bank|Gym|Club|Church|School|Repair|Salon|Spa|Studio)$/', $t)) continue;
        return ucfirst(strtolower(trim(preg_replace('/(?<!^)([A-Z])/', ' $1', $t))));
    }
    return '';
}
function lkWords(string $name): array {
    $n = strtolower(str_replace('&', ' and ', preg_replace('/\s*\(.*?\)\s*/', ' ', $name)));
    $w = array_values(array_filter(preg_split('/[^a-z0-9]+/', $n), fn($x) => $x !== '' && !in_array($x, ['llc', 'inc', 'corp', 'co', 'company', 'ltd', 'the', 'pc', 'pllc', 'dba'], true)));
    return array_slice($w, 0, 6);
}
/* likely addresses for a company's website: a business email's domain first, then the name run together (with and without "and", each
   word as typed and with its plural flipped), .com then .net */
function lkCandidates(array $L): array {
    $o = [];
    foreach (array_merge((array) ($L['contacts'] ?? []), (array) ($L['added'] ?? [])) as $c) {
        $e = strtolower((string) ($c['email'] ?? '')); if ($e === '' || preg_match(FREE_MAIL, $e)) continue;
        $d = substr($e, strpos($e, '@') + 1); if ($d !== '' && !in_array($d, SHARED_HOSTS, true)) $o[$d] = 1;
    }
    $w = lkWords((string) $L['name']); if (!$w) return array_keys($o);
    $flip = fn($x) => strlen($x) > 3 ? (substr($x, -1) === 's' ? substr($x, 0, -1) : $x . 's') : $x;
    $sets = [$w]; foreach ($w as $i => $x) if ($flip($x) !== $x) { $v = $w; $v[$i] = $flip($x); $sets[] = $v; }
    $all = array_map($flip, $w); if ($all !== $w) $sets[] = $all;
    $bases = [];
    foreach ($sets as $v) { $bases[] = implode('', $v); $na = array_values(array_filter($v, fn($x) => $x !== 'and')); if ($na !== $v) $bases[] = implode('', $na); }
    if (count($w) >= 3) { $bases[] = $w[0] . $w[1]; if ($flip($w[1]) !== $w[1]) $bases[] = $w[0] . $flip($w[1]); }
    foreach (array_unique($bases) as $b) if (strlen($b) >= 5 && strlen($b) <= 60) $o[$b . '.com'] = 1;
    foreach (array_slice(array_unique($bases), 0, 2) as $b) if (strlen($b) >= 5 && strlen($b) <= 60) $o[$b . '.net'] = 1;
    return array_slice(array_keys($o), 0, 18);
}
function lkResolves(string $host): bool {
    $f = scanFakeHosts(); if ($f !== null) return isset($f[$host]) || isset($f['www.' . $host]);
    return (bool) @gethostbynamel($host);
}
/* is this site theirs: the name on the page AND (one of the card's phones OR a Springs-area address, or the filing's street) */
function lkVerify(string $url, array $L, ?array $reg): array {
    $no = ['ok' => false, 'site' => '', 'how' => ''];
    $rules = scanRobots($url); if (!scanAllowed($rules, $url)) return $no;
    $home = scanFetch($url); if (!$home['ok']) return $no;
    $host = scanHost($home['url']); if ($host === '' || in_array($host, SHARED_HOSTS, true)) return $no;
    $pages = [[scanParse($home['body'], $home['url']), $home['body'], 'home page']];
    foreach ($pages[0][0]['links'] as [$u, $txt]) {
        if (scanHost($u) !== $host || !(preg_match('/contact|about|location/i', (string) parse_url($u, PHP_URL_PATH)) || preg_match('/contact|about/i', $txt)) || !scanAllowed($rules, $u)) continue;
        $pg = scanFetch($u); if ($pg['ok']) { $pages[] = [scanParse($pg['body'], $pg['url']), $pg['body'], preg_match('/about/i', $u . $txt) ? 'about page' : 'contact page']; }
        if (count($pages) >= 3) break;
    }
    $text = strtolower(implode(' ', array_map(fn($p) => $p[0]['title'] . ' ' . $p[0]['text'], $pages)));
    $raw = implode(' ', array_map(fn($p) => $p[1], $pages));
    if (preg_match('/this domain (is|may be) for sale|buy this domain|domain parking|parked free/i', $text)) return $no;
    $toks = array_values(array_filter(lkWords((string) $L['name']), fn($x) => $x !== 'and' && strlen($x) >= 3));
    if (!$toks) return $no;
    foreach ($toks as $t) { $st = strlen($t) > 3 ? preg_replace('/s$/', '', $t) : $t; if (!preg_match('/\b' . preg_quote($st, '/') . '/', $text)) return $no; }
    $phone = '';
    foreach (recPhones($L) as $p) { $re = '/(?<!\d)' . substr($p, 0, 3) . '(?:[\s.()-]|%20)*' . substr($p, 3, 3) . '(?:[\s.-]|%20)*' . substr($p, 6) . '(?!\d)/'; if (preg_match($re, $raw)) { $phone = $p; break; } }
    $addr = ''; foreach ($pages as $p) if ($p[0]['addr'] !== '' && (preg_match(LOCAL_RE, $p[0]['addr']) || preg_match('/\b809\d\d\b/', $p[0]['addr']))) { $addr = $p[0]['addr']; break; }
    if ($addr === '' && !empty($reg['addr']) && preg_match('/^(\d+)\s+(?:[NSEW]\.?\s+)?(\w+)/', strtolower((string) $reg['addr']), $m) && preg_match('/\b' . $m[1] . '\s+(?:[nsew]\.?\s+)?' . preg_quote($m[2], '/') . '/', $text)) $addr = (string) $reg['addr'];
    if ($phone === '' && $addr === '') return $no;
    return ['ok' => true, 'site' => 'https://' . (string) parse_url($home['url'], PHP_URL_HOST) . '/', 'how' => 'the name and ' . ($phone !== '' ? 'this phone' : 'a Springs-area address (' . $addr . ')') . ' are on it'];
}
function lkFindSite(array $L, ?array $reg): array {
    $out = ['site' => '', 'how' => '', 'tried' => 0, 'hunter' => false];
    foreach (lkCandidates($L) as $d) {
        if ($out['tried'] >= 12) break;
        if (!lkResolves($d)) continue; $out['tried']++;
        $v = lkVerify('https://' . $d . '/', $L, $reg); if (!$v['ok']) $v = lkResolves('www.' . $d) ? lkVerify('https://www.' . $d . '/', $L, $reg) : $v;
        if ($v['ok']) return ['site' => $v['site'], 'how' => $v['how']] + $out;
    }
    /* Hunter's company search: only now, and only while searches are left over for the sellers */
    if (hunterKey() !== '' && ($left = hunterLeft(true)) !== null && $left > HUNTER_KEEP) {
        $out['hunter'] = true;
        $j = scanJson('https://api.hunter.io/v2/domain-search?' . http_build_query(['company' => (string) $L['name'], 'limit' => '1', 'api_key' => hunterKey()]));
        hunterLeft(true);
        $d = strtolower((string) ($j['data']['domain'] ?? ''));
        if ($d !== '' && !in_array($d, SHARED_HOSTS, true) && lkResolves($d)) {
            $out['tried']++; $out['hunterDomain'] = $d;
            $v = lkVerify('https://' . $d . '/', $L, $reg); if (!$v['ok'] && lkResolves('www.' . $d)) $v = lkVerify('https://www.' . $d . '/', $L, $reg);
            if ($v['ok']) return ['site' => $v['site'], 'how' => 'Hunter named it; ' . $v['how']] + $out;
        }
    } elseif (hunterKey() !== '') $out['hunterSkipped'] = true;
    return $out;
}

/* one company: look it up and write what was found (see the top of this file) */
function autoLookup(string $w, string $id): array {
    $R = recs($w)[$id] ?? null; if (!$R) return ['skip' => 'no such company'];
    if (!empty($R['off'])) return ['skip' => 'removed'];
    $L = $R; if ($w === 'expo') $L['list'] = 'expo';
    $now = time(); $day = date('M j', $now);
    $reg = regFind($L); if (!empty($reg['err'])) $reg = ['at' => 0] + $reg;
    $find = null;
    if (siteOf($L) === '') { $find = lkFindSite($L, $reg); if ($find['site'] !== '') $L['site'] = $find['site']; }
    $prev = jread('scans.json', [])[$id] ?? null;
    $scan = siteOf($L) !== '' ? scanSite($L, $prev) : null;
    $miles = null;
    if (!isset($L['miles']) && empty($scan['addr']) && !empty($reg['addr']) && !isset($prev['miles']) && ($g = geocode((string) $reg['addr']))) $miles = milesTo($g['lat'], $g['lon']);
    $auto = ['at' => $now, 'site' => $find ? $find['site'] : siteOf($L), 'found' => $find ? $find['site'] !== '' : null, 'how' => $find['how'] ?? '', 'tried' => $find['tried'] ?? 0, 'hunter' => $find['hunter'] ?? false];
    scanAndSave($L, 'auto', ['site' => $scan, 'reg' => $reg['at'] ? $reg : null, 'auto' => $auto] + ($miles !== null ? ['miles' => $miles] : []));

    /* the note: what was found and where */
    $N = []; $filled = [];
    if ($find) {
        if ($find['site'] !== '') $N[] = 'Website found: ' . $find['site'] . ' (' . $find['how'] . ').';
        else $N[] = 'Website not found: ' . ($find['tried'] ? $find['tried'] . ' likely address' . ($find['tried'] === 1 ? '' : 'es') . ' checked' : 'no likely address answered') . ($find['hunter'] ? ', and Hunter\'s company search' : '') . '; none showed the name with this phone or a Springs-area address, so none was saved.';
    }
    if ($scan) {
        if (!$scan['ok']) $N[] = 'Their website could not be read (' . $scan['err'] . ').';
        else {
            if ($scan['phones']) $N[] = 'Phones on their site: ' . implode(', ', array_map(fn($p) => $p['phone'] . ' (' . $p['where'] . ')', array_slice($scan['phones'], 0, 3))) . '.';
            if ($scan['emails']) $N[] = 'Email on their site: ' . implode(', ', array_map(fn($p) => $p['email'] . ' (' . $p['where'] . ')', array_slice($scan['emails'], 0, 2))) . '.';
            if ($scan['addr'] !== '') $N[] = 'Address on their site: ' . $scan['addr'] . '.';
            foreach (['contact' => 'Contact page', 'sponsor' => 'Community page', 'events' => 'Events page'] as $k => $lb) if (!empty($scan['pages'][$k])) $N[] = $lb . ': ' . $scan['pages'][$k] . '.';
            if (!$scan['phones'] && !$scan['emails']) $N[] = 'No phone or email shown on their site.';
        }
    }
    if (!empty($reg['legal'])) $N[] = 'Colorado state filing: ' . $reg['legal'] . (!empty($reg['status']) ? ', ' . $reg['status'] : '') . (!empty($reg['formed']) ? ', formed ' . substr((string) $reg['formed'], 0, 4) : '') . (!empty($reg['addr']) ? ', principal office ' . $reg['addr'] : '') . '.' . (!empty($reg['agent']) ? ' Registered agent: ' . $reg['agent'] . '.' : (!empty($reg['agentOrg']) ? ' The registered agent is a company, not a person.' : ''));
    elseif (!empty($reg['many'])) $N[] = 'Colorado state filing: ' . $reg['many'] . ' active filings share this name; none matched.';
    elseif (!empty($reg['none'])) $N[] = 'Colorado state filing: none active under this exact name.';
    elseif (!$reg['at']) $N[] = 'The Colorado state filings did not answer; tried again next month.';
    if ($miles !== null) $N[] = $miles . ' mi from Peak (from the filing\'s address).';

    $about = $scan && $scan['ok'] ? (string) ($scan['desc'] ?? '') : ''; $kind = $scan && $scan['ok'] ? lkKind((array) ($scan['types'] ?? [])) : '';
    $res = withLock(function () use ($w, $id, $find, $scan, $about, $kind, $N, $now, $day, &$filled) {
        sync($w, true); $R = recs($w)[$id] ?? null; if (!$R || !empty($R['off'])) return 'removed meanwhile';
        $T = W($w)['T']; $rows = [];
        if ($find && $find['site'] !== '' && trim((string) ($R['site'] ?? '')) === '') { $rows[] = ['t' => 'site', 'id' => $id, 'site' => $find['site'], 'by' => AUTO_BY, 'at' => $now]; $filled[] = 'website'; }
        $f = [];
        if ($about !== '' && trim((string) ($R['about'] ?? '')) === '') $f['about'] = $about;
        $kk = $w === 'expo' ? 'cat' : 'kind'; if ($kind !== '' && trim((string) ($R[$kk] ?? '')) === '') $f[$kk] = $kind;
        if ($f) { $rows[] = ['t' => 'fill', 'id' => $id, 'f' => $f, 'by' => AUTO_BY, 'at' => $now]; foreach (array_keys($f) as $k) $filled[] = ['about' => 'what they do', 'kind' => 'kind', 'cat' => 'category'][$k]; }
        if ($scan && $scan['ok']) {
            $src = fn($where) => 'Their website (' . $where . '), looked up automatically ' . $day;
            $mk = fn(array $c, string $role) => $w === 'expo' ? $c + ['name' => '', 'role' => $role, 'notes' => ''] : $c + ['name' => '', 'pos' => $role];
            if (!recEmails($R) && $scan['emails']) { $e = $scan['emails'][0]; $rows[] = ['t' => $T['contact'], 'id' => $id, 'contact' => $mk(['email' => $e['email'], 'phone' => '', 'src' => $src($e['where'])], 'General email'), 'by' => AUTO_BY, 'at' => $now]; $filled[] = 'general email'; }
            if (!recPhones($R) && $scan['phones']) { $p = $scan['phones'][0]; $rows[] = ['t' => $T['contact'], 'id' => $id, 'contact' => $mk(['email' => '', 'phone' => $p['phone'], 'src' => $src($p['where'])], 'Main phone'), 'by' => AUTO_BY, 'at' => $now]; $filled[] = 'main phone'; }
        }
        $rows[] = ['t' => $T['note'], 'id' => $id, 'note' => mb_substr('Looked up automatically: ' . ($N ? implode(' ', $N) : 'nothing found.'), 0, 1000), 'by' => AUTO_BY, 'at' => $now];
        commit($w, $rows); return 'ok';
    });
    return ['done' => $res, 'site' => $auto['site'], 'found' => $auto['found'], 'filled' => $filled, 'reg' => !empty($reg['legal']), 'note' => $N];
}

/* the queue, oldest first, at most $max companies or about four minutes; a company that throws is tried 3 times */
function lkRun(int $max = 10): array {
    $lk = fopen(DATA_DIR . '/lookup-run.lock', 'c'); if (!$lk || !flock($lk, LOCK_EX | LOCK_NB)) { echo date('c') . " lookups: one is already running\n"; return ['busy' => 1]; }
    $out = []; $t0 = time();
    try {
        $q = jread('lookup-queue.json', []); uasort($q, fn($a, $b) => ($a['at'] ?? 0) <=> ($b['at'] ?? 0));
        foreach (array_slice($q, 0, $max, true) as $k => $it) {
            $w = ($it['w'] ?? '') === 'expo' ? 'expo' : 'sponsor'; $id = (string) ($it['id'] ?? '');
            try { $r = autoLookup($w, $id); $drop = true; }
            catch (Throwable $e) { $r = ['error' => mb_substr($e->getMessage(), 0, 160)]; $drop = (int) ($it['tries'] ?? 0) >= 2; error_log('peak desk look-up: ' . $e->getMessage()); }
            lkUnqueue($k, (int) ($it['at'] ?? 0), $drop);
            $out[$k] = $r;
            echo date('c') . " $k " . (isset($r['error']) ? 'error: ' . $r['error'] : (isset($r['skip']) ? 'skipped: ' . $r['skip'] : 'website ' . ($r['found'] === null ? ($r['site'] !== '' ? 'already on the card' : 'none') : ($r['found'] ? 'found' : 'not found')) . ' · filled: ' . ($r['filled'] ? implode(', ', $r['filled']) : 'nothing blank to fill') . ' · filing ' . ($r['reg'] ? 'matched' : 'not matched'))) . "\n";
            if (time() - $t0 > 240) break;
        }
    } finally { flock($lk, LOCK_UN); fclose($lk); }
    return $out;
}
/* every company added by hand (sponsor list "added", expo leads added on the desk) with no automatic look-up yet */
function lkBackfill(bool $dry = false): array {
    $sc = jread('scans.json', []); $o = [];
    foreach (['sponsor', 'expo'] as $w) foreach (recs($w) as $id => $R) {
        if (!empty($R['off']) || !empty($sc[$id]['auto'])) continue;
        $hand = $w === 'sponsor' ? ($R['list'] ?? '') === 'added' : (!empty($R['mine']) || (string) ($R['by'] ?? '') !== '');
        if (!$hand) continue;
        $o[] = ['w' => $w, 'id' => (string) $id, 'name' => (string) $R['name'], 'by' => (string) ($R['by'] ?? '')];
        if (!$dry) lkQueue($w, (string) $id, 'backfill');
    }
    return $o;
}
