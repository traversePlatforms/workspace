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
/** up to 8 matches at the store, priced first */
function krSearch(string $q): ?array {
    $j = krGet('filter.term=' . rawurlencode($q) . '&filter.limit=12'); if (!$j) return null;
    $o = array_values(array_filter(array_map('krShape', (array) ($j['data'] ?? [])), fn($p) => $p && $p['productId'] !== ''));
    usort($o, fn($a, $b) => ($b['price'] !== null) <=> ($a['price'] !== null));
    return array_slice($o, 0, 8);
}
function krProduct(string $pid): ?array { $j = krGet('filter.productId=' . rawurlencode($pid)); $p = $j['data'][0] ?? null; return is_array($p) ? krShape($p) : null; }
/** refresh picked prices older than 6 hours (one call for up to 50 products); the list as stored after */
function krRefresh(array $list): array {
    if (!krReady()) return $list;
    $stale = []; foreach ($list['items'] as $it) if (!empty($it['pick']['productId']) && (int) ($it['pick']['at'] ?? 0) < time() - 6 * 3600) $stale[$it['pick']['productId']] = true;
    if (!$stale) return $list;
    $j = krGet('filter.productId=' . rawurlencode(implode(',', array_slice(array_keys($stale), 0, 50))) . '&filter.limit=50'); if (!$j) return $list;
    $fresh = []; foreach ((array) ($j['data'] ?? []) as $p) { $s = krShape($p); if ($s) $fresh[$s['productId']] = $s; }
    if (!$fresh) return $list;
    return groEdit(function ($items) use ($fresh) { foreach ($items as &$it) { $pid = (string) ($it['pick']['productId'] ?? ''); if ($pid !== '' && isset($fresh[$pid])) $it['pick'] = $fresh[$pid]; } unset($it); return $items; });
}
