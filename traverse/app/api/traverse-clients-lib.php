<?php
declare(strict_types=1);
/**
 * Client installs made on the server (Matthew 2026-10-29: "For those who arent afraid to pay ... we need to make sure thats built out
 * automatically ... We really dont want people paying and getting access to nothing." Then: "Lets just forget a set up time, they pay. They
 * get access to the app's welcome screen, they get a check list option. It loads the information and populates that app.")
 * Not a page: opened directly it answers 404. Used by api/traverse-start.php (the website's checkout and welcome page), api/traverse-hook.php
 * (the one Stripe webhook for the website and every client install) and traverse-tools/clients.php (regen, relink, list, setup).
 *
 * ---- THE PATH OF A COMPANY ------------------------------------------------------------------------------------------------------------
 *   1. /start/ on the website: edition, plan, monthly or yearly, people; the founding price exactly as an install's Billing screen adds it
 *      up (billing.php, billingMonthly); the Terms of Use and Subscription Agreement accepted. tcCheckout() makes the client's id
 *      ('c' + 8 hex), keeps a pending record and opens Stripe Checkout with billing.php's own fields and per-checkout founding coupon.
 *   2. Stripe sends the buyer to /start/welcome/?c=<id>&cs=<session>. The session is checked with Stripe on every visit (tcWelcome).
 *      If they leave before finishing, the webhook's checkout.session.completed emails them that link, and Matthew hears of every payment.
 *   3. The welcome form (company, business address, service radius, colour, logo, admin name/email/mobile) -> tcProvision(): the install is
 *      made from its edition already on the server, in seconds, and released at once (live_at = now: the money-back guarantee starts).
 *      The buyer lands straight in their app (a one-use sign-in pass, rounds.php startin), on the welcome checklist, with the admin code on
 *      screen and by email.
 *   4. Their homes: every town of the edition whose centre, or any door, is within the radius of the business address (U.S. Census
 *      geocoder, see tcGeocode) is LINKED into the install (symlinks to the edition's own town and side files; never copied). The app shows
 *      "Loading your homes ..." until that is done. Outside Colorado, or no town in the radius: the app still opens (pipeline, customers,
 *      jobs, accounts all work), the checklist says door data for their area is being added, and Matthew is emailed.
 *   5. From then on Stripe's events reach the install through api/traverse-hook.php (routed by the id in the subscription's metadata), and
 *      its billing.json, past due, the 3-day lock, paid again and refunds work exactly as in an edition.
 *
 * ---- WHAT AN INSTALL IS MADE OF (id c3fa9b2c1 for example) ----------------------------------------------------------------------------
 *   public_html/<xx-6hex>/                       its page folder: the edition's template with the client's names (tcRender), the
 *                                                edition's icons, manifest and Spanish dictionary (its logo is the Company screen's
 *                                                upload: company-logo.* in its data folder, rounds.php logoTake)
 *   public_html/api/traverse-c3fa9b2c1-*.php      its API (rounds, billing, sms, webpush, skiptrace), from the template
 *   traverse-c3fa9b2c1-data/rounds/              company.json, company-local.json, billing.json, index.json (its towns only) and links to
 *                                                the edition's town and side files (.links.json lists every link this code made)
 *   traverse-c3fa9b2c1-private/                  rounds-codes.php (Traverse's super line(s) under the edition's names, the admin),
 *                                                billing-config.php (the shared Stripe config + its own id), start-pass.json
 *   traverse-shared/clients/                     registry.json (every client), pending/<id>.json (before and during setup), the shared
 *                                                billing-config.php, townbox-<edition data>.json (each town's door box, cached)
 *   traverse-shared/client-templates/<edition>/  made by traverse/editions/build-editions.cjs, sent by traverse/ops/deploy-app.sh
 * Client data never crosses installs: each has its own private folder, logs and cookie; only the public door data is shared, read-only.
 */
if (realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === realpath(__FILE__)) { http_response_code(404); exit; }

const TC_EDITIONS = ['roofing' => 'TraverseRoofing', 'yards' => 'Traverse Lawn & Landscape', 'solar' => 'TraverseSolar', 'pest' => 'TraversePest', 'security' => 'TraverseSecurity'];   /* what customers read; Yards is "Lawn & Landscape" (Matthew 2026-10-30), the key stays */
const TC_PLAN_NAMES = ['solo' => 'Duo', 'crew' => 'Team', 'team' => 'Company'];   /* the plans as customers read them (2026-10-30; Duo since the evening: an admin and one worker); the keys stay */
/* what customers read (2026-10-30, Matthew: the trade, not a Traverse product name; "Yards" is Lawn & Landscape) */
const TC_TRADES = ['roofing' => 'Roofing', 'yards' => 'Lawn & Landscape', 'solar' => 'Solar', 'pest' => 'Pest', 'security' => 'Security'];
function tcTrade(string $ed): string { return isset(TC_TRADES[$ed]) ? 'Traverse for ' . TC_TRADES[$ed] : 'Traverse'; }
const TC_PH = ['cid' => 'czzzzzzzz', 'CID' => 'CZZZZZZZZ', 'cookie' => 'cqqqq', 'folder' => 'qq-qqqqqq'];   /* build-editions.cjs TPL */
const TC_PAGE_FILES = ['index.html', 'version.txt', 'sw.js', 'q.html', 'sign.html'];
const TC_API_FILES = ['rounds', 'billing', 'sms', 'webpush', 'skiptrace'];
/* the per-town data an install links, by file prefix (<prefix>-<town>.json), as build-editions.cjs ships them in 2026-10; a town's own door file
   (<town>.json) and its lookup (<town>-lookup.json) always. A prefix not listed is never linked (relink reports it), so nothing of an
   edition's own business (its logs, caches, best-doors lists) can reach a client. */
const TC_TOWN_PREFIXES = ['census', 'hail', 'hailrep', 'hailmax', 'mail', 'material', 'moved', 'naip', 'nri', 'others', 'outline', 'permit', 'photo', 'roof',
    'wind', 'year', 'lawnmask', 'solar', 'house', 'pest', 'security', 'security-lot'];
/* statewide public data beside the towns (the storm lists, the permit index, the trade tables) */
const TC_STATEWIDE = ['hail-hours.json', 'hail-paths.json', 'hail-reports.json', 'hail-storms.json', 'wind-storms.json', 'permit-index.json', 'roof-damage-defaults.json',
    'sample-door.json', 'climate.json', 'cwpp.json', 'hoa-communities.json', 'solar-utilities.json', 'pest-season.json', 'security-areas.json', 'security-rates.json', 'docs'];
const TC_MARGIN_MI = 30;   /* a town whose centre is this far past the radius can still have doors inside it (checked door by door) */

/* ---------------------------------------------------------------- where things are */
function tcSite(): string { return dirname(__DIR__, 2); }
function tcPub(): string { return dirname(__DIR__); }
function tcShared(): string { return tcSite() . '/traverse-shared'; }
function tcDir(): string { $d = tcShared() . '/clients'; if (!is_dir($d)) @mkdir($d, 0700, true); return $d; }
function tcTplDir(string $ed): string { return tcShared() . '/client-templates/' . $ed; }
function tcSettings(): array {
    static $s = null; if ($s !== null) return $s;
    $s = ['app_base' => 'https://traverseplatforms.com', 'site_base' => 'https://traverseplatforms.com', 'notify' => 'm.sharpe@traverseplatforms.com',
          'miles_default' => 25, 'miles_min' => 5, 'miles_max' => 60, 'state' => 'CO'];
    $j = json_decode((string) @file_get_contents(tcDir() . '/settings.json'), true);   /* the test copy points app_base at itself */
    if (is_array($j)) $s = array_replace($s, array_intersect_key($j, $s));
    return $s;
}
function tcLog(array $row): void { @file_put_contents(tcDir() . '/clients.log', json_encode($row + ['at' => time()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); }
if (!function_exists('writeJsonAtomic')) {   /* billing.php's billingSave needs it; rounds.php has its own */
    function writeJsonAtomic(string $f, array $j): bool { return tcWrite($f, (string) json_encode($j, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)); }
}
/** the whole text or nothing, renamed into place */
function tcWrite(string $f, string $txt, ?int $mode = null): bool {
    $tmp = $f . '.tmp' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, $txt, LOCK_EX) !== strlen($txt)) { @unlink($tmp); return false; }
    if ($mode !== null) @chmod($tmp, $mode);
    if (!@rename($tmp, $f)) { @unlink($tmp); return false; }
    return true;
}
function tcJson(string $f): array { $j = json_decode((string) @file_get_contents($f), true); return is_array($j) ? $j : []; }

/* ---------------------------------------------------------------- the shared Stripe config (billing.php, unchanged code) */
/** billing.php's own config, read from traverse-shared/clients/billing-config.php; null until that file exists */
function tcBilling(): ?array {
    $f = tcDir() . '/billing-config.php';
    if (!is_readable($f)) return null;
    if (!defined('BILLING_CONFIG_FILE')) define('BILLING_CONFIG_FILE', $f);
    require_once __DIR__ . '/billing.php';
    $raw = (array) (require $f);
    if ((string) ($raw['install'] ?? '') === '' && !defined('DATA_DIR')) return null;   /* the file must name itself ('site'): billingConfig() would read DATA_DIR */
    $c = billingConfig(__DIR__);
    return billingConfigured($c) ? $c : null;
}
/** a client install's own view of it: the same keys and prices, its id */
function tcClientBilling(array $c, string $cid): array { $c['install'] = $cid; return $c; }

/* ---------------------------------------------------------------- registry and pending records */
function tcRegFile(): string { return tcDir() . '/registry.json'; }
function tcReg(): array { return (array) (tcJson(tcRegFile())['clients'] ?? []); }
function tcRegSave(callable $fn): array {
    $f = tcRegFile(); $lk = @fopen($f . '.lock', 'c'); if ($lk) flock($lk, LOCK_EX);
    $all = (array) (tcJson($f)['clients'] ?? []); $all = $fn($all);
    tcWrite($f, (string) json_encode(['clients' => $all], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 0600);
    if ($lk) { flock($lk, LOCK_UN); fclose($lk); }
    return $all;
}
function tcCidOk(string $cid): bool { return (bool) preg_match('/^c[0-9a-f]{8}$/D', $cid); }
function tcPendFile(string $cid): string { $d = tcDir() . '/pending'; if (!is_dir($d)) @mkdir($d, 0700, true); return $d . '/' . $cid . '.json'; }
function tcPend(string $cid): array { return tcCidOk($cid) ? tcJson(tcPendFile($cid)) : []; }
function tcPendSave(string $cid, callable $fn): array { $p = $fn(tcPend($cid)); tcWrite(tcPendFile($cid), (string) json_encode($p, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 0600); return $p; }
/** one company at a time: the webhook, the welcome form and relink all take this lock (held until the request ends) */
function tcLock(string $cid) { $h = @fopen(tcPendFile($cid) . '.lock', 'c'); if ($h) flock($h, LOCK_EX); return $h; }
/** the client a Stripe object belongs to: its id in metadata, else its customer or subscription as the registry or a pending record knows them */
function tcCidOf(array $o): string {
    foreach ([$o['metadata']['install'] ?? null, $o['client_reference_id'] ?? null, $o['subscription_details']['metadata']['install'] ?? null,
              $o['parent']['subscription_details']['metadata']['install'] ?? null] as $v) if (is_string($v) && tcCidOk($v)) return $v;
    $cus = (string) ($o['customer'] ?? ''); $sub = (string) ($o['object'] ?? '') === 'subscription' ? (string) ($o['id'] ?? '') : (string) ($o['subscription'] ?? '');
    if ($cus === '' && $sub === '') return '';
    foreach (tcReg() as $cid => $e) if (($cus !== '' && ($e['customer'] ?? '') === $cus) || ($sub !== '' && ($e['subscription'] ?? '') === $sub)) return (string) $cid;
    foreach (glob(tcDir() . '/pending/c*.json') ?: [] as $f) { $p = tcJson($f); if (($cus !== '' && ($p['customer'] ?? '') === $cus) || ($sub !== '' && ($p['subscription'] ?? '') === $sub)) return (string) ($p['cid'] ?? ''); }
    return '';
}

/* ---------------------------------------------------------------- plans and prices, from billing.php */
/** every price the checkout page shows: billing.php's display numbers and its founding rule (each part, rounded to whole dollars) */
function tcPlans(array $c): array {
    $on = billingFoundingOn($c); $pct = (int) $c['founding_pct']; $f = fn($v) => $on ? (int) round($v * (100 - $pct) / 100) : $v;
    $o = ['founding' => $on, 'foundingPct' => $on ? $pct : 0, 'guaranteeDays' => (int) $c['guarantee_days'], 'plans' => []];
    foreach (BILLING_PLANS as $p) foreach (['month', 'year'] as $iv) {
        if (($c['prices'][$p][$iv] ?? '') === '') continue;
        $base = (int) ($c['display'][$p][$iv] ?? 0); $ex = $p === 'solo' ? 0 : (int) ($c['display'][$p . '_extra'][$iv] ?? 0);
        $o['plans'][$p][$iv] = ['list' => $base, 'price' => $f($base), 'extraList' => $ex, 'extra' => $f($ex), 'included' => (int) ($c['included'][$p] ?? 1)];
    }
    return $o;
}
/** what a pick costs a month (list and founding), exactly as billingMonthly() makes it for an install's Billing screen and Stripe */
function tcQuote(array $c, string $plan, string $iv, int $seats): array {
    $seats = max($seats, (int) ($c['included'][$plan] ?? 1));
    $list = billingMonthly($c, $plan, $iv, $seats, false); $now = billingFoundingOn($c) ? billingMonthly($c, $plan, $iv, $seats, false, true) : $list;
    return ['plan' => $plan, 'interval' => $iv, 'seats' => $seats, 'list' => $list, 'monthly' => $now, 'dueToday' => $iv === 'year' ? $now * 12 : $now];
}

/* ---------------------------------------------------------------- 1. checkout */
function tcNewCid(): string {
    for ($i = 0; $i < 50; $i++) { $cid = 'c' . bin2hex(random_bytes(4)); if (!isset(tcReg()[$cid]) && !is_file(tcPendFile($cid)) && !is_dir(tcSite() . '/traverse-' . $cid . '-data')) return $cid; }
    throw new RuntimeException('no free id');
}
/** Stripe Checkout for one pick. $in: edition, plan, iv, seats, agree, terms, agreement (versions). Returns ['url', 'cid'] or ['error'] */
function tcCheckout(array $c, array $in, string $ip): array {
    $ed = (string) ($in['edition'] ?? ''); $plan = (string) ($in['plan'] ?? ''); $iv = (string) ($in['iv'] ?? ''); $seats = (int) ($in['seats'] ?? 0);
    if (!isset(TC_EDITIONS[$ed]) || !is_file(tcTplDir($ed) . '/edition.json')) return ['error' => 'Pick your trade.'];
    if (empty($in['agree'])) return ['error' => 'Tick the box to accept the Terms of Use and the Subscription Agreement.'];
    $cid = tcNewCid(); $c = tcClientBilling($c, $cid); $s = tcSettings();
    $back = rtrim($s['site_base'], '/') . '/start/';
    $r = billingCheckoutFields($c, [], $plan, $iv, max(1, $seats), false, $back);
    if (isset($r['error'])) return $r;
    $f = $r['fields'];
    $f['success_url'] = $back . 'welcome/?c=' . $cid . '&cs={CHECKOUT_SESSION_ID}';
    $f['cancel_url'] = $back . '?' . http_build_query(['edition' => $ed, 'plan' => $plan, 'iv' => $iv, 'people' => $seats, 'back' => 1]);
    $f['metadata'] += ['edition' => $ed, 'src' => 'site'];
    $f['subscription_data']['metadata'] += ['edition' => $ed, 'src' => 'site'];
    $f['billing_address_collection'] = 'required';   /* the business address on the welcome page starts from it */
    if (($e = billingFoundingCoupon($c, $f)) !== null) return ['error' => $e];
    $q = tcQuote($c, $plan, $iv, $seats);
    $res = stripeCall($c, 'POST', '/v1/checkout/sessions', $f);
    if (isset($res['error']) || empty($res['url']) || empty($res['id'])) return ['error' => $res['error'] ?? 'Stripe did not open the payment page. Try again.'];
    tcPendSave($cid, fn($p) => ['cid' => $cid, 'edition' => $ed, 'plan' => $plan, 'interval' => $iv, 'seats' => $q['seats'], 'cs' => (string) $res['id'], 'quote' => $q,
        'created' => time(), 'ip' => $ip, 'agreed' => ['terms' => (string) ($in['terms'] ?? ''), 'agreement' => (string) ($in['agreement'] ?? ''), 'at' => time(), 'ip' => $ip], 'events' => []]);
    tcLog(['what' => 'checkout', 'cid' => $cid, 'edition' => $ed, 'plan' => $plan, 'iv' => $iv, 'seats' => $q['seats'], 'monthly' => $q['monthly']]);
    return ['url' => (string) $res['url'], 'cid' => $cid];
}

/* ---------------------------------------------------------------- 2. the session, checked with Stripe */
function tcSessionGet(array $c, string $cs): ?array {
    if (!preg_match('/^cs_[A-Za-z0-9_]{8,200}$/D', $cs)) return null;
    /* tests only: canned sessions (the hosted payment page is the one step a test cannot drive); everything else may still be Stripe's TEST mode */
    if (!empty($c['mock_file']) || (PHP_SAPI === 'cli-server' && is_file(tcDir() . '/mock-sessions.json'))) { $m = tcJson(tcDir() . '/mock-sessions.json'); if (is_array($m[$cs] ?? null)) return $m[$cs]; if (!empty($c['mock_file'])) return null; }
    $s = stripeCall($c, 'GET', '/v1/checkout/sessions/' . rawurlencode($cs), ['expand' => ['subscription']]);
    return isset($s['error']) || empty($s['id']) ? null : $s;
}
function tcSessionPaid(?array $s, string $cid): bool {
    if (!$s || ($s['status'] ?? '') !== 'complete' || !in_array($s['payment_status'] ?? '', ['paid', 'no_payment_required'], true)) return false;
    return ($s['client_reference_id'] ?? '') === $cid || ($s['metadata']['install'] ?? '') === $cid;
}
/** what the welcome page shows for this company: not paid / the form (with what Stripe already knows) / ready */
function tcWelcome(array $c, string $cid, string $cs): array {
    $p = tcPend($cid);
    if (!$p || !hash_equals((string) ($p['cs'] ?? ''), $cs)) return ['error' => 'That link is not one we know. Use the link from your email, or email hello@traverseplatforms.com.', 'code' => 404];
    $reg = tcReg()[$cid] ?? null;
    if ($reg && ($reg['status'] ?? '') === 'live') return ['ready' => true] + tcReadyInfo($reg, null);
    $s = tcSessionGet($c, $cs);
    if (!tcSessionPaid($s, $cid)) return ['paid' => false, 'error' => 'We have not seen this payment go through yet. If you just paid, wait a moment and reload.'];
    $cd = (array) ($s['customer_details'] ?? []); $ad = (array) ($cd['address'] ?? []);
    return ['paid' => true, 'ready' => false, 'edition' => $p['edition'], 'editionName' => TC_EDITIONS[$p['edition']] ?? '', 'plan' => $p['plan'], 'interval' => $p['interval'], 'seats' => $p['seats'],
            'prefill' => ['email' => (string) ($cd['email'] ?? ''), 'name' => (string) ($cd['name'] ?? ''), 'phone' => (string) ($cd['phone'] ?? ''),
                          'address' => trim(implode(', ', array_filter([(string) ($ad['line1'] ?? ''), (string) ($ad['line2'] ?? ''), (string) ($ad['city'] ?? ''), trim((string) ($ad['state'] ?? '') . ' ' . (string) ($ad['postal_code'] ?? ''))])))],
            'miles' => (int) tcSettings()['miles_default'], 'milesMin' => (int) tcSettings()['miles_min'], 'milesMax' => (int) tcSettings()['miles_max'], 'counties' => tcCounties((string) $p['edition']),
            /* where they left off: 1 the service area, 2 the brand, 3 company and admin */
            'step' => empty($p['area']) ? 1 : (empty($p['brand']) ? 2 : 3), 'area' => !empty($p['area']) ? tcAreaPublic((array) $p['area']) + ['mode' => (string) ($p['area']['mode'] ?? 'radius')] : null,
            'brand' => !empty($p['brand']) ? ['color' => (string) $p['brand']['color'], 'logo' => !empty($p['brand']['logo'])] : null];
}
function tcReadyInfo(array $e, ?string $code): array {
    return ['name' => (string) $e['name'], 'url' => (string) $e['url'], 'edition' => (string) $e['edition'], 'area' => $e['area'] ?? null] + ($code !== null ? ['code' => $code] : []);
}

/* ---------------------------------------------------------------- geocoding (U.S. Census Bureau) */
/**
 * The business address to a point: the U.S. Census Bureau Geocoder (geocoding.geo.census.gov, onelineaddress, benchmark Public_AR_Current).
 * First-party (the Census Bureau's own TIGER address ranges), no key, a U.S. government service; its API terms (census.gov/data/developers/
 * about/terms-of-service.html, revised 2026-04-14) allow building a service on it and forbid implying the Bureau endorses it. No rate limit is
 * published for single addresses; we ask once per company. Returns [lat, lon, state, city, matched], null (no match) or ['error'].
 * TRAVERSE_GEOCODE_MOCK (a JSON file, address -> answer) stands in on the test server only.
 */
function tcGeocode(string $addr): ?array {
    $mock = getenv('TRAVERSE_GEOCODE_MOCK');
    if ($mock && in_array(PHP_SAPI, ['cli-server', 'cli'], true)) { $m = tcJson($mock); $hit = $m[strtolower(trim($addr))] ?? null; return is_array($hit) ? $hit : null; }
    $url = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?' . http_build_query(['address' => $addr, 'benchmark' => 'Public_AR_Current', 'format' => 'json']);
    $raw = null;
    if (function_exists('curl_init')) {
        $h = curl_init($url); curl_setopt_array($h, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_USERAGENT => 'TraversePlatforms/1.0 (hello@traverseplatforms.com)']);
        $b = curl_exec($h); $code = (int) curl_getinfo($h, CURLINFO_HTTP_CODE); curl_close($h); if ($b !== false && $code === 200) $raw = (string) $b;
    } else $raw = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 15]])) ?: null;
    if ($raw === null) return ['error' => 'The map lookup did not answer. Try again in a minute.'];
    $j = json_decode($raw, true); $m = $j['result']['addressMatches'][0] ?? null;
    if (!is_array($m) || !isset($m['coordinates']['x'], $m['coordinates']['y'])) return null;
    $ac = (array) ($m['addressComponents'] ?? []);
    return ['lat' => round((float) $m['coordinates']['y'], 6), 'lon' => round((float) $m['coordinates']['x'], 6), 'state' => strtoupper((string) ($ac['state'] ?? '')),
            'city' => ucwords(strtolower((string) ($ac['city'] ?? ''))), 'matched' => (string) ($m['matchedAddress'] ?? '')];
}
function tcMiles(float $la1, float $lo1, float $la2, float $lo2): float {
    $r = 3958.8; $p = M_PI / 180; $a = sin(($la2 - $la1) * $p / 2) ** 2 + cos($la1 * $p) * cos($la2 * $p) * sin(($lo2 - $lo1) * $p / 2) ** 2;
    return 2 * $r * asin(min(1, sqrt($a)));
}

/* ---------------------------------------------------------------- the towns in the radius */
/** a town file's door box [south, west, north, east], kept per edition until the file changes */
function tcBox(string $src, string $data, string $key): ?array {
    static $cache = [];
    $cf = tcDir() . '/townbox-' . $data . '.json';
    if (!isset($cache[$cf])) $cache[$cf] = tcJson($cf);
    $f = $src . '/' . $key . '.json'; $st = @stat($f); if (!$st) return null;
    $sig = $st['size'] . '-' . $st['mtime'];
    if (($cache[$cf][$key][0] ?? '') === $sig) return array_slice($cache[$cf][$key], 1);
    $pts = tcDoorPoints($f); if (!$pts) return null;
    $box = [min($pts[0]), min($pts[1]), max($pts[0]), max($pts[1])];
    $cache[$cf][$key] = array_merge([$sig], $box);
    tcWrite($cf, (string) json_encode($cache[$cf]));
    return $box;
}
/** every door's [lats, lons] in a town file, read as text (the door files carry "lat":..,"lon":.. on each door; no decode of 28 MB) */
function tcDoorPoints(string $f): array {
    $t = @file_get_contents($f); if ($t === false) return [];
    if (!preg_match_all('/"lat":(-?\d+(?:\.\d+)?),"lon":(-?\d+(?:\.\d+)?)/', $t, $m)) return [];
    return [array_map('floatval', $m[1]), array_map('floatval', $m[2])];
}
/** the towns to link: centre within the radius, or (within the margin) any door within it. Returns [key => ['why', 'miles', 'doors']] */
function tcTownsIn(string $src, string $data, float $lat, float $lon, float $miles): array {
    $idx = tcJson($src . '/index.json'); $out = [];
    foreach ((array) ($idx['regions'] ?? []) as $r) {
        if (!is_array($r) || empty($r['c']) || !empty($r['admin']) || !empty($r['metro'])) continue;
        $key = (string) $r['key']; $d = tcMiles($lat, $lon, (float) $r['c'][0], (float) $r['c'][1]);
        if ($d <= $miles) { $out[$key] = ['why' => 'centre', 'miles' => round($d, 1), 'doors' => (int) ($r['doors'] ?? 0)]; continue; }
        if ($d > $miles + TC_MARGIN_MI) continue;
        $b = tcBox($src, $data, $key); if (!$b) continue;
        /* the nearest corner or edge of the box first: a box wholly outside the radius has no door inside it */
        $nl = max($b[0], min($lat, $b[2])); $no = max($b[1], min($lon, $b[3]));
        if (tcMiles($lat, $lon, $nl, $no) > $miles) continue;
        $pts = tcDoorPoints($src . '/' . $key . '.json');
        foreach ($pts[0] ?? [] as $i => $la) if (tcMiles($lat, $lon, $la, $pts[1][$i]) <= $miles) { $out[$key] = ['why' => 'door', 'miles' => round($d, 1), 'doors' => (int) ($r['doors'] ?? 0)]; break; }
    }
    return $out;
}
/** the town a data file belongs to (longest key first, as build-editions.cjs townOfFile), and whether it is a kind an install may link */
function tcFileKind(string $f, array $keysLongFirst): array {
    if (!str_ends_with($f, '.json')) return ['', false];
    $b = substr($f, 0, -5);
    foreach ($keysLongFirst as $k) {
        if ($b === $k || $b === $k . '-lookup') return [$k, true];
        if (str_ends_with($b, '-' . $k)) { $pre = substr($b, 0, -strlen($k) - 1); return [$k, in_array($pre, TC_TOWN_PREFIXES, true), $pre]; }
    }
    return ['', false];
}
/** one link: a symlink (relative, so the site can move); Windows (the test copy only) cannot make one without admin rights, so a hard link */
function tcLinkOne(string $target, string $link, string $rel): bool {
    if (is_link($link)) { if (readlink($link) === $rel) return true; @unlink($link); }
    elseif (file_exists($link)) { if (PHP_OS_FAMILY === 'Windows' && is_file($target) && @fileinode($link) === @fileinode($target)) return true; @unlink($link); }
    if (@symlink($rel, $link)) return true;
    return PHP_OS_FAMILY === 'Windows' && is_file($target) && @link($target, $link);
}
/**
 * Link (or re-link) a client's towns: every town of its edition in its radius, with the side files of the kinds listed above, and the statewide
 * files. Links this code made before and no longer wants are removed; nothing else in the folder is ever touched. Writes index.json (its towns
 * only), the area's status in company.json and the registry. Safe to run again at any time (the daily relink, a new town, a radius change).
 */
function tcLinkTowns(string $cid): array {
    /* the install, or (before the welcome page's last step) the company's pending record: the area step links at once */
    $e = tcReg()[$cid] ?? null; $p = tcPend($cid);
    if (!$e && !empty($p['area'])) $e = ['edition' => $p['edition'], 'data' => 'traverse-' . $cid . '-data', 'area' => $p['area']];
    if (!$e) return ['error' => 'no such client'];
    $edj = tcJson(tcTplDir((string) $e['edition']) . '/edition.json'); if (!$edj) return ['error' => 'no template for ' . $e['edition']];
    $src = tcSite() . '/' . $edj['data'] . '/rounds'; $dst = tcSite() . '/' . $e['data'] . '/rounds';
    if (!is_dir($src) || !is_dir($dst)) return ['error' => 'missing data folder'];
    $a = (array) ($e['area'] ?? []); $want = []; $towns = [];
    $idx = tcJson($src . '/index.json');
    if (($a['mode'] ?? '') === 'counties') {   /* the counties picked: every town of the edition in them */
        $inState = true; $a['lat'] = $a['lat'] ?? null;
        foreach ((array) ($idx['regions'] ?? []) as $r) if (is_array($r) && !empty($r['c']) && empty($r['admin']) && empty($r['metro']) && in_array((string) ($r['county'] ?? ''), (array) ($a['counties'] ?? []), true))
            $towns[(string) $r['key']] = ['why' => 'county', 'doors' => (int) ($r['doors'] ?? 0)];
    } else {
        $inState = isset($a['lat'], $a['lon']) && strtoupper((string) ($a['state'] ?? '')) === tcSettings()['state'];
        if ($inState) $towns = tcTownsIn($src, (string) $edj['data'], (float) $a['lat'], (float) $a['lon'], (float) ($a['miles'] ?? 25));
    }
    $keys = array_map(fn($r) => (string) ($r['key'] ?? ''), (array) ($idx['regions'] ?? [])); usort($keys, fn($x, $y) => strlen($y) <=> strlen($x));
    $unknown = [];
    foreach (scandir($src) ?: [] as $f) {
        if ($f[0] === '.') continue;
        if ($towns && in_array($f, TC_STATEWIDE, true)) { $want[$f] = true; continue; }
        $k = tcFileKind($f, $keys);
        if ($k[0] !== '' && isset($towns[$k[0]])) { if ($k[1]) $want[$f] = true; elseif (isset($k[2]) && !preg_match('/^(best-|regions-cache)/', $f)) $unknown[$k[2]] = true; }
    }
    $mf = $dst . '/.links.json'; $had = tcJson($mf); $made = 0; $gone = 0; $bad = 0;
    foreach ($had as $f => $_) if (!isset($want[$f]) && (is_link($dst . '/' . $f) || is_file($dst . '/' . $f))) { @unlink($dst . '/' . $f); $gone++; }
    $keep = [];
    foreach ($want as $f => $_) {
        $rel = '../../' . $edj['data'] . '/rounds/' . $f;
        $mine = isset($had[$f]) || is_link($dst . '/' . $f) || !file_exists($dst . '/' . $f);   /* a file the install wrote itself is never replaced */
        $ok = $mine && tcLinkOne($src . '/' . $f, $dst . '/' . $f, $rel);
        if ($ok) { $keep[$f] = 1; if (!isset($had[$f])) $made++; } else $bad++;
    }
    tcWrite($mf, (string) json_encode($keep));
    $regions = array_values(array_filter((array) ($idx['regions'] ?? []), fn($r) => isset($towns[(string) ($r['key'] ?? '')])));
    $doors = array_sum(array_map(fn($r) => (int) ($r['doors'] ?? 0), $regions));
    $ix = ['regions' => $regions] + array_diff_key($idx, ['regions' => 1]);
    $old = (string) @file_get_contents($dst . '/index.json'); $new = (string) json_encode($ix, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($old !== $new) tcWrite($dst . '/index.json', $new);
    $status = ($a['mode'] ?? '') !== 'counties' && !isset($a['lat']) ? 'nomatch' : (!$inState ? 'outside' : ($regions ? 'ready' : 'none'));
    $area = array_replace($a, ['status' => $status, 'towns' => count($regions), 'doors' => $doors, 'linked' => time()]);
    if (($a['mode'] ?? '') === 'counties') unset($area['lat']);
    $cf = $dst . '/company.json'; $co = tcJson($cf); if ($co) { $co['area'] = tcAreaPublic($area); tcWrite($cf, (string) json_encode($co, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)); }
    if (isset(tcReg()[$cid])) tcRegSave(function ($all) use ($cid, $area) { if (isset($all[$cid])) $all[$cid]['area'] = $area; return $all; });
    if ($p) tcPendSave($cid, function ($x) use ($area) { $x['area'] = $area; return $x; });
    $r = ['cid' => $cid, 'status' => $status, 'towns' => count($regions), 'doors' => $doors, 'links' => count($keep), 'made' => $made, 'removed' => $gone, 'failed' => $bad, 'unknownKinds' => array_keys($unknown)];
    tcLog(['what' => 'link'] + $r);
    return $r;
}
/** what the app may show of the area (company.json is read before sign-in): the place and miles, never the street address or the point */
function tcAreaPublic(array $a): array { return array_intersect_key($a, ['status' => 1, 'towns' => 1, 'doors' => 1, 'miles' => 1, 'place' => 1, 'state' => 1, 'linked' => 1]); }

/* ---------------------------------------------------------------- the install's files, from its edition's template */
/** write (or rewrite, on every deploy) a client's page folder and API files from its edition's template; its logo and data are untouched */
function tcRender(array $e): array {
    $tpl = tcTplDir((string) $e['edition']); $edj = tcJson($tpl . '/edition.json');
    if (!$edj) return ['error' => 'no template for ' . $e['edition']];
    $cid = (string) $e['cid'];
    $map = [TC_PH['cid'] => $cid, TC_PH['CID'] => strtoupper($cid), TC_PH['cookie'] => (string) $e['cookie'], TC_PH['folder'] => (string) $e['folder']];
    $pg = tcPub() . '/' . $e['folder']; if (!is_dir($pg) && !@mkdir($pg, 0755, true)) return ['error' => 'cannot make the page folder'];
    $put = [];
    foreach (TC_PAGE_FILES as $f) $put[$pg . '/' . $f] = $tpl . '/' . $f;
    foreach (TC_API_FILES as $k) $put[tcPub() . '/api/' . $e['api'] . '-' . $k . '.php'] = $tpl . '/api-' . $k . '.php';
    $n = 0;
    foreach ($put as $to => $from) {
        $t = @file_get_contents($from); if ($t === false) return ['error' => 'template file missing: ' . basename($from)];
        $t = strtr($t, $map);
        foreach (TC_PH as $ph) if (strpos($t, $ph) !== false) return ['error' => 'a placeholder was left in ' . basename($to)];
        if ((string) @file_get_contents($to) !== $t) { if (!tcWrite($to, $t, 0644)) return ['error' => 'could not write ' . basename($to)]; $n++; }
    }
    /* the edition's own icons, manifest, Spanish dictionary and .htaccess, as they are live */
    $edPg = tcPub() . '/' . $edj['folder'];
    foreach (array_merge(['manifest.json', 'es.json', '.htaccess'], array_map('basename', glob($edPg . '/*.png') ?: [])) as $f) {
        if (!is_file($edPg . '/' . $f)) continue;
        $t = (string) file_get_contents($edPg . '/' . $f);
        if ($f === 'manifest.json') $t = tcManifest($t, $e);   /* the company's name on the home screen, not the edition's (2026-10-30) */
        if ((string) @file_get_contents($pg . '/' . $f) !== $t) { tcWrite($pg . '/' . $f, $t, 0644); $n++; }
    }
    return ['ok' => true, 'written' => $n];
}

/** the edition's manifest with the client company's name in it: the home-screen app is the company's, never Traverse's (2026-10-30, Matthew:
    zero branding for clients). The short name is cut to fit a phone's label. */
function tcManifest(string $json, array $e): string {
    $m = json_decode($json, true); if (!is_array($m)) return $json;
    $name = trim((string) ($e['name'] ?? '')); if ($name === '') return $json;
    $short = trim((string) ($e['short'] ?? '')) ?: $name;
    $m['name'] = $name; $m['short_name'] = mb_strlen($short) > 12 ? rtrim(mb_substr($short, 0, 12)) : $short; $m['description'] = $name;
    return json_encode($m, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
}

/* ---------------------------------------------------------------- 3. making the install */
function tcClean(string $v, int $max): string { return mb_substr(trim((string) preg_replace('/[\x00-\x1f\x7f]+/u', ' ', $v)), 0, $max); }
/** a six-digit code nobody could guess (rounds.php acctWeakCode: no digit six times, no run like 123456) */
function tcCode(array $taken): string {
    for ($i = 0; $i < 500; $i++) {
        $c = (string) random_int(100000, 999999);
        if (isset($taken[$c]) || preg_match('/^(\d)\1{5}$/D', $c)) continue;
        $up = $down = true; for ($k = 1; $k < 6; $k++) { $d = ((int) $c[$k] - (int) $c[$k - 1] + 10) % 10; if ($d !== 1) $up = false; if ($d !== 9) $down = false; }
        if (!$up && !$down) return $c;
    }
    throw new RuntimeException('no code');
}
/** the logo from the welcome page, checked only for what it claims to be (PNG, JPG or SVG, 500 KB at most). The install's own Company-screen
    upload code takes it the first time the install is asked for its company (rounds.php logoAdopt -> logoTake: the PNG/JPG checks, svgClean),
    so a welcome-page logo is kept exactly as an upload would be; this file only carries it there. Returns ['raw', 'ext'] | ['error'] | [] */
function tcLogo(string $dataUrl): array {
    if ($dataUrl === '') return [];
    if (!preg_match('#^data:image/(png|jpeg|svg\+xml);base64,([A-Za-z0-9+/=\s]+)$#D', $dataUrl, $m)) return ['error' => 'The logo must be a PNG, JPG or SVG file.'];
    $bin = base64_decode((string) preg_replace('/\s+/', '', $m[2]), true);
    if ($bin === false || $bin === '' || strlen($bin) > 500 * 1024) return ['error' => 'The logo must be under 500 KB.'];
    $ext = ['png' => 'png', 'jpeg' => 'jpg', 'svg+xml' => 'svg'][$m[1]];
    $ok = $ext === 'png' ? strncmp($bin, "\x89PNG\r\n\x1a\n", 8) === 0 : ($ext === 'jpg' ? strncmp($bin, "\xFF\xD8\xFF", 3) === 0 : (bool) preg_match('/<svg[\s>]/i', substr($bin, 0, 4096)));
    if (!$ok) return ['error' => 'That file is not the picture type its name says.'];
    if ($ext !== 'svg') { $sz = @getimagesizefromstring($bin); if (!$sz || $sz[0] < 16 || $sz[1] < 16 || $sz[0] > 4000 || $sz[1] > 4000) return ['error' => 'Use a logo between 16 and 4,000 pixels on each side.']; }
    return ['raw' => $bin, 'ext' => $ext];
}
/** the welcome page's last step (company and the admin), checked. Returns the clean values or ['error' => ..., 'field'] */
function tcForm(array $in): array {
    $v = ['company' => tcClean((string) ($in['company'] ?? ''), 60), 'short' => tcClean((string) ($in['short'] ?? ''), 20),
          'admin' => tcClean((string) ($in['admin'] ?? ''), 40), 'email' => strtolower(tcClean((string) ($in['email'] ?? ''), 120)), 'mobile' => tcClean((string) ($in['mobile'] ?? ''), 30),
          'password' => (string) ($in['password'] ?? '')];
    if (mb_strlen($v['company']) < 2) return ['error' => 'Type your company name.', 'field' => 'company'];
    if ($v['short'] === '') $v['short'] = mb_substr(trim((string) preg_replace('/\s+(LLC|Inc\.?|Co\.?|Company|Corp\.?)$/i', '', $v['company'])), 0, 20);
    $v['admin'] = trim((string) preg_replace("/[^\\p{L} '\\-]/u", '', $v['admin']));
    if (mb_strlen($v['admin']) < 2 || !str_contains($v['admin'], ' ')) return ['error' => 'Type your first and last name: it is your admin sign-in.', 'field' => 'admin'];
    if (preg_match('/^(Claude|Fable|Traverse)\b/i', $v['admin'])) return ['error' => 'That name is kept for Traverse\'s own sign-ins. Use yours.', 'field' => 'admin'];
    if (!filter_var($v['email'], FILTER_VALIDATE_EMAIL)) return ['error' => 'Type your email address: you sign in with it.', 'field' => 'email'];
    if (!preg_match('/^[0-9 ()+.\-]{10,30}$/', $v['mobile'])) return ['error' => 'Type a mobile number (10 digits).', 'field' => 'mobile'];
    if (mb_strlen($v['password']) < 10 || mb_strlen($v['password']) > 200) return ['error' => 'Pick a password of at least 10 characters.', 'field' => 'password'];
    return $v;
}
/* Colorado's counties as the app names them (index.html COUNTY_NAME, same keys: the editions' build lower-cases assessor/town-county.json) */
const TC_COUNTY = ['elpaso' => 'El Paso', 'douglas' => 'Douglas', 'teller' => 'Teller', 'adams' => 'Adams', 'arapahoe' => 'Arapahoe', 'jefferson' => 'Jefferson', 'weld' => 'Weld',
    'denver' => 'Denver', 'boulder' => 'Boulder', 'park' => 'Park', 'larimer' => 'Larimer', 'mesa' => 'Mesa', 'pueblo' => 'Pueblo', 'broomfield' => 'Broomfield', 'clearcreek' => 'Clear Creek',
    'elbert' => 'Elbert', 'laplata' => 'La Plata', 'garfield' => 'Garfield', 'summit' => 'Summit', 'grand' => 'Grand', 'routt' => 'Routt', 'montezuma' => 'Montezuma', 'gunnison' => 'Gunnison',
    'morgan' => 'Morgan', 'archuleta' => 'Archuleta', 'logan' => 'Logan', 'pitkin' => 'Pitkin', 'riogrande' => 'Rio Grande', 'huerfano' => 'Huerfano', 'sanmiguel' => 'San Miguel',
    'gilpin' => 'Gilpin', 'yuma' => 'Yuma', 'lake' => 'Lake', 'ouray' => 'Ouray', 'rioblanco' => 'Rio Blanco', 'dolores' => 'Dolores', 'hinsdale' => 'Hinsdale', 'sanjuan' => 'San Juan',
    'eagle' => 'Eagle', 'custer' => 'Custer', 'montrose' => 'Montrose', 'delta' => 'Delta', 'lasanimas' => 'Las Animas', 'alamosa' => 'Alamosa', 'conejos' => 'Conejos',
    'saguache' => 'Saguache', 'costilla' => 'Costilla', 'washington' => 'Washington', 'bent' => 'Bent', 'mineral' => 'Mineral', 'sedgwick' => 'Sedgwick', 'fremont' => 'Fremont',
    'chaffee' => 'Chaffee', 'moffat' => 'Moffat', 'otero' => 'Otero', 'prowers' => 'Prowers', 'kitcarson' => 'Kit Carson', 'lincoln' => 'Lincoln', 'phillips' => 'Phillips',
    'baca' => 'Baca', 'crowley' => 'Crowley', 'cheyenne' => 'Cheyenne', 'kiowa' => 'Kiowa', 'jackson' => 'Jackson'];
/** the counties an edition covers (the towns in its index), for the welcome page's "pick counties" */
function tcCounties(string $ed): array {
    $edj = tcJson(tcTplDir($ed) . '/edition.json'); if (!$edj) return [];
    $o = [];
    foreach ((array) (tcJson(tcSite() . '/' . $edj['data'] . '/rounds/index.json')['regions'] ?? []) as $r) {
        if (!is_array($r) || empty($r['c']) || !empty($r['admin']) || !empty($r['metro']) || empty($r['county'])) continue;
        $k = (string) $r['county']; $o[$k] = $o[$k] ?? ['key' => $k, 'name' => (TC_COUNTY[$k] ?? ucwords($k)) . ($k === 'denver' || $k === 'broomfield' ? '' : ' County'), 'towns' => 0, 'homes' => 0];
        $o[$k]['towns']++; $o[$k]['homes'] += (int) ($r['doors'] ?? 0);
    }
    usort($o, fn($x, $y) => strcmp($x['name'], $y['name']));
    return array_values($o);
}
/**
 * The welcome page's FIRST step (Matthew 2026-10-29: "ask for the SERVICE AREA FIRST ... and start linking their towns in the background as soon as
 * that step is submitted"): around the business address (radius in miles) or a set of counties. Kept in the pending record; the install's data
 * folder is made and its towns are linked by the caller right after answering. Returns the area or ['error', 'field'].
 */
function tcArea(array $c, string $cid, string $cs, array $in): array {
    $p = tcPend($cid);
    if (!$p || !hash_equals((string) ($p['cs'] ?? ''), $cs)) return ['error' => 'That link is not one we know.', 'code' => 404];
    if (!tcSessionPaid(tcSessionGet($c, $cs), $cid)) return ['error' => 'We have not seen this payment go through yet. Wait a moment and try again.', 'code' => 402];
    $S = tcSettings(); $mode = (string) ($in['mode'] ?? 'radius');
    if ($mode === 'counties') {
        $have = array_column(tcCounties((string) $p['edition']), 'name', 'key');
        $pick = array_values(array_intersect(array_map('strval', (array) ($in['counties'] ?? [])), array_keys($have)));
        if (!$pick) return ['error' => 'Tick at least one county.', 'field' => 'counties'];
        $area = ['mode' => 'counties', 'counties' => $pick, 'place' => implode(', ', array_map(fn($k) => $have[$k], array_slice($pick, 0, 3))) . (count($pick) > 3 ? ' and ' . (count($pick) - 3) . ' more' : ''), 'state' => $S['state'], 'miles' => 0];
    } else {
        $addr = tcClean((string) ($in['address'] ?? ''), 160); $mi = (int) ($in['miles'] ?? $S['miles_default']);
        if (mb_strlen($addr) < 8 || !preg_match('/\d/', $addr)) return ['error' => 'Type your business street address, city, state and ZIP.', 'field' => 'address'];
        if ($mi < $S['miles_min'] || $mi > $S['miles_max']) return ['error' => 'Pick a radius from ' . $S['miles_min'] . ' to ' . $S['miles_max'] . ' miles.', 'field' => 'miles'];
        $g = tcGeocode($addr);
        if (is_array($g) && isset($g['error'])) return $g + ['field' => 'address'];
        if ($g === null && empty($in['anyway'])) return ['error' => 'We could not find that address on the map. Check it (street, city, state, ZIP), or tick "Use it as typed" and we will place your area by hand.', 'field' => 'address', 'nomatch' => true];
        $area = ['mode' => 'radius', 'address' => $addr, 'matched' => $g['matched'] ?? '', 'state' => $g['state'] ?? '', 'place' => $g['city'] ?? '', 'miles' => $mi] + ($g ? ['lat' => $g['lat'], 'lon' => $g['lon']] : []);
    }
    $area += ['status' => 'linking', 'towns' => 0, 'doors' => 0, 'at' => time()];
    $d = tcSite() . '/traverse-' . $cid . '-data/rounds'; if (!is_dir($d)) @mkdir($d, 0700, true);
    tcPendSave($cid, function ($x) use ($area) { $x['area'] = $area; return $x; });
    if (isset(tcReg()[$cid])) tcRegSave(function ($all) use ($cid, $area) { $all[$cid]['area'] = $area; return $all; });
    return ['ok' => true, 'area' => tcAreaPublic($area)];
}
/** the SECOND step: the brand colour and the logo, kept for the install (and shown on the welcome page's preview at once) */
function tcBrand(array $c, string $cid, string $cs, array $in): array {
    $p = tcPend($cid);
    if (!$p || !hash_equals((string) ($p['cs'] ?? ''), $cs)) return ['error' => 'That link is not one we know.', 'code' => 404];
    /* paid first, as the area step (review 2026-10-31: the session id is in Stripe's own checkout address, so an unpaid visitor knew the link and could park logo files here) */
    if (empty($p['paid_at']) && !tcSessionPaid(tcSessionGet($c, $cs), $cid)) return ['error' => 'We have not seen this payment go through yet. Wait a moment and try again.', 'code' => 402];
    $color = strtolower(trim((string) ($in['color'] ?? '')));
    if (!preg_match('/^#[0-9a-f]{6}$/', $color)) return ['error' => 'Pick your brand color.', 'field' => 'color'];
    $logo = tcLogo((string) ($in['logo'] ?? '')); if (isset($logo['error'])) return $logo + ['field' => 'logo'];
    $brand = ['color' => $color, 'logo' => null];
    if (isset($logo['raw'])) { $f = tcDir() . '/pending/' . $cid . '-logo.' . $logo['ext']; foreach (['png', 'jpg', 'svg'] as $x) @unlink(tcDir() . '/pending/' . $cid . '-logo.' . $x); tcWrite($f, $logo['raw'], 0600); $brand['logo'] = ['file' => basename($f), 'ext' => $logo['ext']]; }
    elseif (!empty($in['keep']) && is_array($p['brand']['logo'] ?? null)) $brand['logo'] = $p['brand']['logo'];   /* the colour changed, the logo stays */
    tcPendSave($cid, function ($x) use ($brand) { $x['brand'] = $brand; return $x; });
    return ['ok' => true, 'brand' => ['color' => $color, 'logo' => $brand['logo'] ? $brand['logo']['ext'] : null]];
}
/**
 * Make the install for a paid checkout. Idempotent: a second submit, a retry after a failure part way, or a double click makes one install
 * (everything is named from the client's id and the folder kept in its pending record). Returns ['ok', 'url', 'code', 'pass', ...] |
 * ['error', 'field'?, 'code'?]. Does not link the towns (tcLinkTowns, run by the caller once the buyer has their answer).
 */
function tcProvision(array $c, string $cid, string $cs, array $in): array {
    $lock = tcLock($cid);
    $p = tcPend($cid);
    if (!$p || !hash_equals((string) ($p['cs'] ?? ''), $cs)) return ['error' => 'That link is not one we know.', 'code' => 404];
    $reg = tcReg()[$cid] ?? null;
    if ($reg && ($reg['status'] ?? '') === 'live') return ['ok' => true, 'again' => true] + tcReadyInfo($reg, null);
    $s = tcSessionGet($c, $cs);
    if (!tcSessionPaid($s, $cid)) return ['error' => 'We have not seen this payment go through yet. Wait a moment and try again.', 'code' => 402];
    $v = tcForm($in); if (isset($v['error'])) return $v;
    if (empty($p['area'])) return ['error' => 'Start with your service area.', 'field' => 'area', 'step' => 1];
    if (empty($p['brand'])) return ['error' => 'Pick your color first.', 'field' => 'color', 'step' => 2];
    $area = (array) $p['area']; $brand = (array) $p['brand']; $v['color'] = (string) $brand['color'];
    $logoFile = isset($brand['logo']['file']) && is_file(tcDir() . '/pending/' . $brand['logo']['file']) ? tcDir() . '/pending/' . $brand['logo']['file'] : '';
    $ed = (string) $p['edition']; $edj = tcJson(tcTplDir($ed) . '/edition.json');
    if (!$edj) return ['error' => 'That trade is not ready on our side. We have been told and will email you.', 'code' => 500];
    $S = tcSettings();

    /* names: kept in the pending record the first time, so a retry uses the same ones */
    if (empty($p['folder'])) {
        $taken = array_merge(array_column(tcReg(), 'cookie'), ['sfr', 'trv', 'tvy', 'tvs', 'tvp', 'tvg']);
        do { $cookie = 'c' . bin2hex(random_bytes(2)); } while (in_array($cookie, $taken, true));
        $words = preg_split('/\s+/', $v['company']) ?: [];
        $init = strtolower(substr((string) preg_replace('/[^a-z]/i', '', implode('', array_map(fn($w) => (string) ($w[0] ?? ''), $words))), 0, 3)) ?: 'c';
        do { $folder = $init . '-' . bin2hex(random_bytes(3)); } while (is_dir(tcPub() . '/' . $folder));
        $p = tcPendSave($cid, fn($x) => $x + ['folder' => $folder, 'cookie' => $cookie]);
    }
    $e = ['cid' => $cid, 'cookie' => (string) $p['cookie'], 'folder' => (string) $p['folder'], 'api' => 'traverse-' . $cid, 'data' => 'traverse-' . $cid . '-data', 'priv' => 'traverse-' . $cid . '-private',
          'edition' => $ed, 'name' => $v['company'], 'short' => $v['short'], 'url' => rtrim($S['app_base'], '/') . '/' . $p['folder'] . '/', 'created' => time()];
    $dst = tcSite() . '/' . $e['data'] . '/rounds'; $priv = tcSite() . '/' . $e['priv'];
    foreach ([$dst, $priv] as $d) if (!is_dir($d) && !@mkdir($d, 0700, true)) return ['error' => 'We could not make your app. We have been told.', 'code' => 500];

    /* the page and API */
    $r = tcRender($e); if (isset($r['error'])) { tcLog(['what' => 'render failed', 'cid' => $cid, 'why' => $r['error']]); return ['error' => 'We could not make your app. We have been told.', 'code' => 500]; }
    /* the logo goes to the install's own upload code (rounds.php logoAdopt -> logoTake), taken on its first company request */
    if ($logoFile !== '' && !is_file(tcSite() . '/' . $e['priv'] . '/logo-pending.' . $brand['logo']['ext'])) @copy($logoFile, tcSite() . '/' . $e['priv'] . '/logo-pending.' . $brand['logo']['ext']);   /* the pending copy is removed once the install is live (below) */

    /* sign-ins: Traverse's super line(s) under the names the edition uses (so the Edition and Clients pickers' hop finds them), and the admin */
    $supers = []; $ef = tcSite() . '/' . $edj['priv'] . '/rounds-codes.php';
    if (is_readable($ef)) { $ec = (array) (function ($f) { return require $f; })($ef); foreach ((array) ($ec['people'] ?? []) as $who) if (($who[1] ?? '') === 'super') $supers[] = (string) $who[0]; }
    if (!$supers) $supers = ['Matthew Sharpe'];
    $codesFile = $priv . '/rounds-codes.php';
    if (is_readable($codesFile)) { $cfg = (array) (function ($f) { return require $f; })($codesFile); $people = (array) $cfg['people']; $key = (string) $cfg['session_key']; }
    else {
        $key = bin2hex(random_bytes(32)); $people = [];
        foreach (array_unique($supers) as $sn) { do { $sc = (string) random_int(100000000000, 999999999999); } while (isset($people[$sc])); $people[$sc] = [$sn, 'super']; }   /* 12 digits nobody types: the hop signs it in */
    }
    $adminCode = '';
    foreach ($people as $code => $who) if (($who[1] ?? '') === 'admin') { $adminCode = (string) $code; $people[$code] = [$v['admin'], 'admin']; }
    if ($adminCode === '') { $adminCode = tcCode($people); $people[$adminCode] = [$v['admin'], 'admin']; }
    $php = "<?php\n/* Sign-in codes for " . str_replace('*/', '', $v['company']) . ' (made on the server by api/traverse-clients-lib.php, ' . date('Y-m-d') . ").\n   Never in git, never in public_html. People are added from the app's Accounts screen. */\nreturn " . var_export(['session_key' => $key, 'session_days' => 45, 'people' => $people], true) . ";\n";
    if (!tcWrite($codesFile, $php, 0600)) return ['error' => 'We could not make your app. We have been told.', 'code' => 500];
    /* the Terms of Use and Subscription Agreement were accepted on the checkout page: kept for the admin, so the app does not ask again
       (rounds.php termsState reads accounts "terms"; a newer version than the one accepted still asks) */
    $adminId = substr(hash_hmac('sha256', 'code|' . $adminCode, $key), 0, 20); $ag = (array) ($p['agreed'] ?? []);
    /* + the admin's email and password (2026-10-29, Matthew: "the admin who bought also gets email + password from the welcome page"): rounds.php pwsignin */
    $login = [$adminId => ['email' => $v['email'], 'hash' => password_hash($v['password'], PASSWORD_DEFAULT), 'at' => time()]];
    if (!is_file($priv . '/rounds-accounts.json')) {
        tcWrite($priv . '/rounds-accounts.json', (string) json_encode(['people' => new stdClass(), 'off' => new stdClass(), 'over' => new stdClass(), 'login' => $login]
            + (($ag['terms'] ?? '') !== '' ? ['terms' => [$adminId => ['t' => (string) $ag['terms'], 'a' => (string) ($ag['agreement'] ?? ''), 'at' => (int) ($ag['at'] ?? time())]]] : []), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), 0600);
        if (($ag['terms'] ?? '') !== '') @file_put_contents($priv . '/terms-accept.log', json_encode(['name' => $v['admin'], 'id' => $adminId, 'role' => 'admin', 'terms' => (string) $ag['terms'], 'agreement' => (string) ($ag['agreement'] ?? ''),
            'ip' => (string) ($ag['ip'] ?? ''), 'ua' => 'website checkout', 'at' => (int) ($ag['at'] ?? time())], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
    } else {   /* a retry after a failure part way: the email and password typed this time are the ones that sign in (review 2026-10-31; the admin's name is re-taken above the same way) */
        $acc = tcJson($priv . '/rounds-accounts.json'); $acc['login'] = (array) ($acc['login'] ?? []); $acc['login'][$adminId] = $login[$adminId];
        tcWrite($priv . '/rounds-accounts.json', (string) json_encode($acc, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), 0600);
    }
    tcWrite($priv . '/billing-config.php', "<?php\n/* this client install's Stripe config: the shared one (keys, prices, the central webhook's secret) under its own id (2026-10-29) */\n\$c = (array) (require dirname(__DIR__) . '/traverse-shared/clients/billing-config.php');\n\$c['install'] = " . var_export($cid, true) . ";\n\$c['return_url'] = " . var_export($e['url'], true) . ";\nreturn \$c;\n", 0600);

    /* the company: the edition's live company.json (its features, alerts and lists), the client's name, logo and area; billing on, never exempt */
    $co = tcJson(tcSite() . '/' . $edj['data'] . '/rounds/company.json');
    /* walkdesk: the quote, agreement and payments kit, on in every live edition (set in their server-owned company.json, not by the build) */
    $co['features'] = array_replace((array) ($co['features'] ?? []), ['billing' => true, 'clientstart' => true, 'crew' => true, 'company' => true, 'walkdesk' => true]);
    unset($co['features']['billexempt']);
    $co = array_replace($co, ['name' => $v['company'], 'short' => $v['short'], 'tagline' => '', 'phone' => $v['mobile'], 'email' => $v['email'], 'site' => '', 'appUrl' => $e['url']]);
    $co['logo'] = null;   /* the built mark stays out; the uploaded logo (company-local.json logo) is drawn instead */
    $co['area'] = tcAreaPublic($area);   /* as the area step left it: linking, or done (that step links under the same lock, so it has finished by now) */
    tcWrite($dst . '/company.json', (string) json_encode($co, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    tcWrite($dst . '/company-local.json', (string) json_encode(['name' => $v['company'], 'short' => $v['short'], 'tagline' => '', 'phone' => $v['mobile'], 'email' => $v['email'], 'site' => '',
        'color' => $v['color'], 'by' => 'Website checkout', 'at' => time()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    if (!is_file($dst . '/index.json')) tcWrite($dst . '/index.json', '{"regions":[]}');

    /* billing.json from what Stripe already said: the events the webhook kept for this company, then the session and its subscription as they
       stand now, through billing.php's own billingTakeEvent; then released at once (no setup time: Matthew 2026-10-29) */
    if (!defined('DATA_DIR')) define('DATA_DIR', $dst);
    if (DATA_DIR !== $dst) return ['error' => 'One company per request.', 'code' => 500];
    $cc = tcClientBilling($c, $cid);
    $evs = (array) ($p['events'] ?? []); usort($evs, fn($x, $y) => ((int) ($x['created'] ?? 0)) <=> ((int) ($y['created'] ?? 0)));
    foreach ($evs as $ev) if (is_array($ev)) billingTakeEvent($cc, $ev);
    $sub = $s['subscription'] ?? null;
    if (is_string($sub) && $sub !== '') { $x = stripeCall($cc, 'GET', '/v1/subscriptions/' . rawurlencode($sub)); $sub = isset($x['error']) ? null : $x; }
    billingTakeEvent($cc, ['id' => '', 'type' => 'checkout.session.completed', 'created' => time(), 'data' => ['object' => array_replace($s, ['subscription' => is_array($sub) ? (string) ($sub['id'] ?? '') : (string) ($s['subscription'] ?? '')])]]);
    if (is_array($sub)) billingTakeEvent($cc, ['id' => '', 'type' => 'customer.subscription.created', 'created' => time(), 'data' => ['object' => $sub]]);
    $b = billingLoad();
    if (empty($b['live_at'])) { $why = billingMarkLive($cc, 'Ready on payment'); if ($why !== null) tcLog(['what' => 'not released', 'cid' => $cid, 'why' => $why]); }
    /* founding prices step up to the list prices after 12 months: the schedule (made when the webhook saw the payment; here if it has not been) */
    if (($s['metadata']['founding'] ?? '') === '1' && empty($b['schedule'])) {
        $fs = !empty($p['schedule']) ? ['schedule' => $p['schedule']] : billingFoundingSchedule($cc, (string) ($b['subscription'] ?? ''));
        if (!empty($fs['schedule'])) billingSave(function (array $x) use ($fs) { $x['schedule'] = $fs['schedule']; return $x; });
        else tcMailMatthew('founding step-up NOT scheduled: ' . $v['company'], ['Client id' => $cid, 'Subscription' => (string) ($b['subscription'] ?? ''), 'Why' => (string) ($fs['error'] ?? '?'), 'Do' => 'set a subscription schedule in Stripe (12 months founding, then list prices)']);
    }
    $b = billingLoad();

    /* the one-use pass that signs the admin in from the welcome page (rounds.php startin), half an hour */
    $pass = bin2hex(random_bytes(24));
    tcWrite($priv . '/start-pass.json', (string) json_encode(['h' => hash('sha256', $pass), 'id' => substr(hash_hmac('sha256', 'code|' . $adminCode, $key), 0, 20), 'exp' => time() + 1800]), 0600);

    $e += ['status' => 'live', 'customer' => (string) ($b['customer'] ?? ($s['customer'] ?? '')), 'subscription' => (string) ($b['subscription'] ?? ''), 'plan' => (string) ($b['plan'] ?? $p['plan']),
           'interval' => (string) ($b['interval'] ?? $p['interval']), 'seats' => (int) ($b['seats'] ?? $p['seats']), 'admin' => $v['admin'], 'email' => $v['email'], 'area' => $area,
           'live_at' => (int) ($b['live_at'] ?? 0)];
    tcRegSave(function ($all) use ($cid, $e) { $all[$cid] = array_replace($all[$cid] ?? [], $e); return $all; });
    tcPendSave($cid, fn($x) => $x + ['provisioned_at' => time()]);
    if ($logoFile !== '') @unlink($logoFile);   /* the welcome page's copy has been handed to the install (review 2026-10-31: it was kept for good) */
    tcLog(['what' => 'provisioned', 'cid' => $cid, 'edition' => $ed, 'folder' => $e['folder'], 'live' => !empty($b['live_at'])]);
    if ($lock) { flock($lock, LOCK_UN); fclose($lock); }
    return ['ok' => true, 'code' => $adminCode, 'pass' => $pass] + tcReadyInfo($e, $adminCode);
}

/* ---------------------------------------------------------------- email from Traverse's mailbox */
/** one plain-text message through the website's Gmail sender (traverse-site-private/site-config.php, as the demo bookings); TRAV_MAIL_MOCK in tests */
function tcMail(string $to, string $subject, string $body): bool {
    $mock = getenv('TRAV_MAIL_MOCK');
    if ($mock) { @file_put_contents($mock, json_encode(['at' => time(), 'to' => $to, 'subject' => $subject, 'body' => $body], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); return true; }
    $lib = tcPub() . '/demo/_lib.php';
    if (!is_file($lib)) { tcLog(['what' => 'mail', 'to' => $to, 'ok' => false, 'why' => 'no demo/_lib.php']); return false; }
    require_once $lib;
    $r = send_mail(site_config(), $to, $subject, $body);
    tcLog(['what' => 'mail', 'subject' => $subject, 'ok' => $r['ok'], 'stage' => $r['stage']]);
    return (bool) $r['ok'];
}
function tcWelcomeUrl(array $p): string { return rtrim(tcSettings()['site_base'], '/') . '/start/welcome/?c=' . $p['cid'] . '&cs=' . rawurlencode((string) $p['cs']); }
function tcMoney(array $p): string { $q = (array) ($p['quote'] ?? []); return '$' . ($q['monthly'] ?? '?') . '/month' . (($p['interval'] ?? '') === 'year' ? ', billed yearly ($' . ($q['dueToday'] ?? '?') . ')' : ''); }
/** the buyer's email: their app is ready, with the address and their admin code */
function tcMailReady(array $e, string $code): bool {
    $a = (array) ($e['area'] ?? []);
    $body = "Hi " . explode(' ', (string) $e['admin'])[0] . ",\n\nYour Traverse is ready: " . $e['name'] . " on " . tcTrade((string) $e['edition']) . ".\n\n"
        . "Open it here (save it to your phone's home screen): " . $e['url'] . "\nSign in with " . $e['email'] . " and the password you picked. Your admin code, for a quick sign-in on a phone: " . $code . "\n\n"
        . "Keep both to yourself: they open the admin side of your company's app. The welcome checklist inside the app walks you through inviting your team (each person gets an email to set their own password), connecting your email and payments, and importing customers.\n\n"
        . (($a['mode'] ?? '') === 'counties' ? 'Your homes: every town we cover in ' . ($a['place'] ?? 'your counties') . '. You can change this later in the app.'
            : (isset($a['lat']) && strtoupper((string) ($a['state'] ?? '')) === tcSettings()['state'] ? 'Your homes: every town within ' . (int) ($a['miles'] ?? 0) . ' miles of ' . ($a['place'] ?: 'your business') . '. You can change this later in the app.' : 'Property data for your area is being added; we will email you when your homes are in. Everything else works now.'))
        . "\n\nYour 7-day money-back guarantee started today. Questions: reply to this email or call (303) 596-9515.\n\nMatthew Sharpe\nTraverse Platforms\n";
    return tcMail((string) $e['email'], 'Your Traverse is ready: ' . $e['name'], $body);
}
/** Matthew's note about a company: paid, ready, or needing door data by hand */
function tcMailMatthew(string $what, array $x): bool {
    $lines = []; foreach ($x as $k => $v) if ($v !== null && $v !== '') $lines[] = str_pad($k . ':', 12) . (is_scalar($v) ? (string) $v : json_encode($v, JSON_UNESCAPED_SLASHES));
    return tcMail(tcSettings()['notify'], 'Traverse: ' . $what, $what . "\n\n" . implode("\n", $lines) . "\n\n(traverse-tools/clients.php list shows every client.)\n");
}

/* ---------------------------------------------------------------- the webhook, before the install exists */
/** keep a Stripe event for a company that has no install yet (replayed into its billing.json when it is made); on payment, email the buyer
    the welcome link (in case they closed the tab) and Matthew */
function tcHookPending(string $cid, array $ev): string {
    $o = (array) ($ev['data']['object'] ?? []); $type = (string) ($ev['type'] ?? '');
    $p = tcPend($cid); if (!$p) { tcLog(['what' => 'event for unknown company', 'cid' => $cid, 'type' => $type]); return 'unknown'; }
    $first = false;
    $p = tcPendSave($cid, function ($p) use ($ev, $o, $type, &$first) {
        $ids = array_column((array) ($p['events'] ?? []), 'id');
        if (($ev['id'] ?? '') !== '' && in_array($ev['id'], $ids, true)) return $p;
        $p['events'] = array_slice(array_merge((array) ($p['events'] ?? []), [$ev]), -60);
        if ($type === 'checkout.session.completed') {
            $p['customer'] = (string) ($o['customer'] ?? ''); $p['subscription'] = (string) ($o['subscription'] ?? '');
            $p['email'] = (string) ($o['customer_details']['email'] ?? ''); $p['company_hint'] = (string) ($o['customer_details']['name'] ?? '');
            if (empty($p['paid_at'])) { $p['paid_at'] = time(); $first = true; }
        }
        return $p;
    });
    /* founding prices: the step-up to the list prices after 12 months, scheduled as soon as Stripe says it is paid (billing.php billingFoundingSchedule) */
    if ($type === 'checkout.session.completed' && ($o['metadata']['founding'] ?? '') === '1' && empty($p['schedule']) && ($c = tcBilling())) {
        $fs = billingFoundingSchedule(tcClientBilling($c, $cid), (string) ($o['subscription'] ?? ''));
        if (!empty($fs['schedule'])) $p = tcPendSave($cid, function ($x) use ($fs) { $x['schedule'] = $fs['schedule']; return $x; });
        tcLog(['what' => 'founding schedule', 'cid' => $cid] + $fs);
    }
    if ($first && empty($p['provisioned_at'])) {
        if (($p['email'] ?? '') !== '' && filter_var($p['email'], FILTER_VALIDATE_EMAIL))
            tcMail($p['email'], 'Finish setting up your Traverse', "Thanks for subscribing to " . tcTrade((string) $p['edition']) . ".\n\nIf you closed the page before finishing, pick up where you left off here (about two minutes: your company, your business address and your colour, and your app opens):\n" . tcWelcomeUrl($p) . "\n\nKeep this link to yourself. Questions: reply to this email or call (303) 596-9515.\n\nTraverse Platforms\n");
        tcMailMatthew('new paid company (' . (TC_EDITIONS[$p['edition']] ?? $p['edition']) . ')', ['Edition' => $p['edition'], 'Plan' => (TC_PLAN_NAMES[$p['plan']] ?? $p['plan']) . ', ' . $p['interval'] . ', ' . $p['seats'] . ' people', 'Price' => tcMoney($p),
            'Buyer' => $p['company_hint'] ?? '', 'Email' => $p['email'] ?? '', 'Client id' => $cid, 'Status' => 'paid; their app opens as soon as they fill in the welcome page']);
    }
    return $type;
}
/** reminders for companies that paid and never filled in the welcome page: once a day after the first, for up to three days */
function tcRemind(): int {
    $n = 0;
    foreach (glob(tcDir() . '/pending/c*.json') ?: [] as $f) {
        $p = tcJson($f);
        if (empty($p['paid_at']) && empty($p['events']) && empty($p['area']) && empty($p['provisioned_at']) && (int) ($p['created'] ?? 0) < time() - 14 * 86400) {   /* a checkout started and never paid: gone after two weeks, its logo too */
            @unlink($f); @unlink($f . '.lock'); foreach (['png', 'jpg', 'svg'] as $x) @unlink(substr($f, 0, -5) . '-logo.' . $x); continue;
        }
        if (empty($p['paid_at']) || !empty($p['provisioned_at']) || empty($p['email'])) continue;
        $sent = (array) ($p['reminded'] ?? []); $last = $sent ? max($sent) : (int) $p['paid_at'];
        if (count($sent) >= 3 || time() - $last < 86400) continue;
        tcMail((string) $p['email'], 'Your Traverse is waiting for you', "You subscribed to " . tcTrade((string) $p['edition']) . " but your app is not open yet: it needs your company name, business address and color (about two minutes).\n\n" . tcWelcomeUrl($p) . "\n\nTraverse Platforms\n");
        tcPendSave((string) $p['cid'], function ($x) { $x['reminded'] = array_merge((array) ($x['reminded'] ?? []), [time()]); return $x; }); $n++;
    }
    return $n;
}
