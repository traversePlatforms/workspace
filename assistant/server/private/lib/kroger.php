<?php
/* King Soopers prices for the grocery list (2026-10-27, Matthew: "We shop at the one on federal and bellview"), through Kroger's public
   Products API with Matthew's own developer keys (data/kroger.json: client_id, client_secret; never sent to the page). Prices are per store,
   so every call carries the store's locationId. Token: client credentials, scope product.compact, cached in data/kroger-token.json.
   A picked product's price is refreshed when the list is opened and the price is over 6 hours old. */
declare(strict_types=1);

const KR_STORE = '62000109';
const KR_STORE_NAME = 'King Soopers, Federal & Belleview';

function krReady(): bool { $k = jget('kroger.json'); return !empty($k['client_id']) && !empty($k['client_secret']); }
function krStoreName(): string { return KR_STORE_NAME; }
function krHttp(string $method, string $url, array $headers, ?string $body = null): ?array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_HTTPHEADER => $headers, CURLOPT_CUSTOMREQUEST => $method]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    $r = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    $j = json_decode((string) $r, true);
    return $code >= 200 && $code < 300 && is_array($j) ? $j : null;
}
function krToken(): ?string {
    $t = jget('kroger-token.json');
    if (!empty($t['token']) && (int) ($t['exp'] ?? 0) > time() + 60) return (string) $t['token'];
    $k = jget('kroger.json'); if (empty($k['client_id']) || empty($k['client_secret'])) return null;
    $j = krHttp('POST', 'https://api.kroger.com/v1/connect/oauth2/token', ['Content-Type: application/x-www-form-urlencoded', 'Authorization: Basic ' . base64_encode($k['client_id'] . ':' . $k['client_secret'])], 'grant_type=client_credentials&scope=product.compact');
    if (!$j || empty($j['access_token'])) { alog('kroger token failed'); return null; }
    jput('kroger-token.json', ['token' => $j['access_token'], 'exp' => time() + (int) ($j['expires_in'] ?? 1800)]);
    return (string) $j['access_token'];
}
/** one product as the list keeps it */
function krShape(array $p): ?array {
    $it = $p['items'][0] ?? null; if (!is_array($it)) return null;
    $reg = (float) ($it['price']['regular'] ?? 0); $promo = (float) ($it['price']['promo'] ?? 0);
    return ['productId' => (string) ($p['productId'] ?? ''), 'desc' => (string) ($p['description'] ?? ''), 'size' => (string) ($it['size'] ?? ''),
        'price' => $reg > 0 ? round($reg, 2) : null, 'promo' => $promo > 0 && $promo < $reg ? round($promo, 2) : null, 'at' => time()];
}
function krGet(string $query): ?array {
    $tok = krToken(); if (!$tok) return null;
    return krHttp('GET', 'https://api.kroger.com/v1/products?' . $query . '&filter.locationId=' . KR_STORE, ['Authorization: Bearer ' . $tok, 'Accept: application/json']);
}
/* Kroger's search is literal (2026-10-27, Matthew: "chunky peanut butter" found 2; the jars say "crunchy", which finds 50). When a search
   comes back thin, it also tries the usual other words for the same thing and a broader search, then ranks by how many of the words
   asked for (or their other words) are in the product name. */
const KR_ALSO = ['chunky' => 'crunchy', 'crunchy' => 'chunky', 'soda' => 'pop', 'pop' => 'soda', 'hamburger' => 'ground beef', 'hamburger buns' => 'hamburger buns',
    'tp' => 'toilet paper', 'paper towels' => 'paper towel', 'chips' => 'potato chips', 'oj' => 'orange juice', 'pb' => 'peanut butter', 'mac and cheese' => 'macaroni cheese',
    'catsup' => 'ketchup', 'scallions' => 'green onions', 'green onions' => 'scallions', 'cilantro' => 'cilantro', 'garbanzo' => 'chickpeas', 'chickpeas' => 'garbanzo'];
function krFind(string $q, int $limit): array {
    $j = krGet('filter.term=' . rawurlencode($q) . '&filter.limit=' . $limit);
    return $j ? array_values(array_filter(array_map('krShape', (array) ($j['data'] ?? [])), fn($p) => $p && $p['productId'] !== '')) : [];
}
/** up to 12 matches at the store: closest name first, priced before unpriced */
function krSearch(string $q): ?array {
    if (!krToken()) return null;
    $q = trim(preg_replace('/\s+/', ' ', mb_strtolower($q)));
    $found = []; $order = 0;
    $add = function (array $list) use (&$found, &$order) { foreach ($list as $p) if (!isset($found[$p['productId']])) $found[$p['productId']] = $p + ['_o' => $order++]; };
    $add(krFind($q, 30));
    $words = array_values(array_filter(explode(' ', $q), 'strlen'));
    $alt = $q; foreach (KR_ALSO as $a => $b) if (preg_match('/\b' . preg_quote($a, '/') . '\b/u', $q)) $alt = preg_replace('/\b' . preg_quote($a, '/') . '\b/u', $b, $alt);
    if (count($found) < 8 && $alt !== $q) $add(krFind($alt, 30));
    if (count($found) < 8 && count($words) > 1) $add(krFind(implode(' ', array_slice($words, 1)), 30));   /* broader: without the first word */
    $want = []; foreach ($words as $w) { $want[] = [$w, KR_ALSO[$w] ?? $w]; }
    $score = function (array $p) use ($want, $q, $alt) {
        $d = mb_strtolower($p['desc']); $s = 0;
        foreach ($want as [$w, $x]) if (preg_match('/\b(' . preg_quote($w, '/') . '|' . preg_quote($x, '/') . ')/u', $d)) $s += 2;
        if (str_contains($d, $q) || str_contains($d, $alt)) $s += 1;   /* the words together, as asked */
        return $s;
    };
    $o = array_values($found);
    usort($o, fn($a, $b) => [$score($b), $b['price'] !== null, $a['_o']] <=> [$score($a), $a['price'] !== null, $b['_o']]);   /* ties keep Kroger's own order */
    return array_map(function ($p) { unset($p['_o']); return $p; }, array_slice($o, 0, 12));
}
function krProduct(string $pid): ?array { $j = krGet('filter.productId=' . rawurlencode($pid)); $p = $j['data'][0] ?? null; return is_array($p) ? krShape($p) : null; }
/** refresh picked prices older than 6 hours (one call for up to 50 products); the list as stored after */
function krRefresh(array $list): array {
    if (!krReady()) return $list;
    $stale = []; foreach ($list['items'] as $it) if (!empty($it['pick']['productId']) && (int) ($it['pick']['at'] ?? 0) < time() - 6 * 3600) $stale[$it['pick']['productId']] = true;
    if (!$stale) return $list;
    /* one try every 10 minutes at most (review 2026-10-27 evening): the page polls every 5 seconds, and a picked product Kroger no longer
       returns (or Kroger being down) meant a Kroger call on every poll, from every open phone, against the API's daily quota */
    if ((int) (jget('kroger-refresh.json')['at'] ?? 0) > time() - 600) return $list;
    jput('kroger-refresh.json', ['at' => time()]);
    $j = krGet('filter.productId=' . rawurlencode(implode(',', array_slice(array_keys($stale), 0, 50))) . '&filter.limit=50'); if (!$j) return $list;
    $fresh = []; foreach ((array) ($j['data'] ?? []) as $p) { $s = krShape($p); if ($s) $fresh[$s['productId']] = $s; }
    if (!$fresh) return $list;
    return groEdit(function ($items) use ($fresh) { foreach ($items as &$it) { $pid = (string) ($it['pick']['productId'] ?? ''); if ($pid !== '' && isset($fresh[$pid])) $it['pick'] = $fresh[$pid]; } unset($it); return $items; });
}
