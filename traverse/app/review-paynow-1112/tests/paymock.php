<?php
/* A stand-in for Square and Stripe for the Pay now (optional) tests (2026-11-12). Run as php -S 127.0.0.1:<port> paymock.php with
   PAYMOCK_STATE=<file>. Square answers the paths rounds.php uses (payment links, orders, customers, payments); Stripe the Checkout sessions.
   /_pay?order=<order or session> marks one paid, as a customer paying would; /_state returns everything made, paid and turned off. */
$F = getenv('PAYMOCK_STATE') ?: __DIR__ . '/paymock-state.json';
$st = json_decode((string) @file_get_contents($F), true) ?: ['n' => 0, 'links' => [], 'orders' => [], 'sessions' => [], 'log' => []];
$m = $_SERVER['REQUEST_METHOD']; $u = parse_url($_SERVER['REQUEST_URI']); $p = $u['path']; parse_str($u['query'] ?? '', $q);
$raw = (string) file_get_contents('php://input'); $b = json_decode($raw, true) ?: [];
if (str_starts_with($p, '/v1/') && $m === 'POST' && !$b) parse_str($raw, $b);
$st['log'][] = [$m, $p];
$save = function () use (&$st, $F) { file_put_contents($F, json_encode($st, JSON_PRETTY_PRINT)); };
$out = function ($code, $j) use ($save) { $save(); http_response_code($code); header('Content-Type: application/json'); echo json_encode($j); exit; };
if ($p === '/_state') $out(200, $st);
if ($p === '/_pay') {
    $k = (string) ($q['order'] ?? '');
    if (isset($st['orders'][$k])) { $st['orders'][$k]['state'] = 'COMPLETED'; $st['orders'][$k]['payment'] = 'PAY' . (++$st['n']); $out(200, ['ok' => true]); }
    if (isset($st['sessions'][$k])) { $st['sessions'][$k]['paid'] = true; $out(200, ['ok' => true]); }
    $out(404, ['ok' => false]);
}
/* Square */
if ($m === 'POST' && $p === '/v2/online-checkout/payment-links') {
    $n = ++$st['n']; $id = 'PLINK' . $n . 'AAAA'; $order = 'ORDER' . $n . 'BBBBBBBB';
    $st['links'][$id] = ['order' => $order, 'amount' => (int) ($b['quick_pay']['price_money']['amount'] ?? 0), 'name' => (string) ($b['quick_pay']['name'] ?? ''), 'redirect' => (string) ($b['checkout_options']['redirect_url'] ?? ''), 'deleted' => false];
    $st['orders'][$order] = ['state' => 'OPEN', 'amount' => $st['links'][$id]['amount'], 'link' => $id];
    $out(200, ['payment_link' => ['id' => $id, 'url' => 'https://pay.example.test/' . $id, 'order_id' => $order]]);
}
if ($m === 'DELETE' && preg_match('#^/v2/online-checkout/payment-links/(\w+)$#', $p, $mm)) { if (isset($st['links'][$mm[1]])) $st['links'][$mm[1]]['deleted'] = true; $out(200, ['deleted_payment_link_id' => $mm[1]]); }
if ($m === 'GET' && preg_match('#^/v2/orders/(\w+)$#', $p, $mm)) {
    $o = $st['orders'][$mm[1]] ?? null; if (!$o) $out(404, ['errors' => [['detail' => 'no such order']]]);
    $paid = $o['state'] === 'COMPLETED';
    $out(200, ['order' => ['id' => $mm[1], 'state' => $o['state'], 'net_amount_due_money' => ['amount' => $paid ? 0 : $o['amount']], 'tenders' => $paid ? [['id' => 'T' . $o['payment'], 'payment_id' => $o['payment']]] : []]]);
}
if ($m === 'GET' && str_starts_with($p, '/v2/payments')) $out(200, ['payments' => []]);
if ($m === 'POST' && $p === '/v2/customers/search') $out(200, ['customers' => []]);
if ($m === 'POST' && $p === '/v2/customers') $out(200, ['customer' => ['id' => 'CUST' . (++$st['n'])]]);
if ($m === 'GET' && $p === '/v2/locations') $out(200, ['locations' => [['id' => 'LTEST', 'name' => 'Test', 'status' => 'ACTIVE']]]);
/* Stripe */
if ($m === 'POST' && $p === '/v1/checkout/sessions') {
    $n = ++$st['n']; $id = 'cs_test_paynow' . $n . 'xxxxxxxxxx';
    $st['sessions'][$id] = ['amount' => (int) ($b['line_items'][0]['price_data']['unit_amount'] ?? 0), 'name' => (string) ($b['line_items'][0]['price_data']['product_data']['name'] ?? ''), 'success' => (string) ($b['success_url'] ?? ''), 'paid' => false, 'expired' => false];
    $out(200, ['id' => $id, 'url' => 'https://checkout.example.test/' . $id, 'livemode' => false]);
}
if ($m === 'GET' && preg_match('#^/v1/checkout/sessions/(cs_\w+)$#', $p, $mm)) { $s = $st['sessions'][$mm[1]] ?? null; if (!$s) $out(404, ['error' => ['message' => 'no such session']]); $out(200, ['id' => $mm[1], 'payment_status' => $s['paid'] ? 'paid' : 'unpaid', 'payment_intent' => $s['paid'] ? 'pi_' . $mm[1] : null]); }
if ($m === 'POST' && preg_match('#^/v1/checkout/sessions/(cs_\w+)/expire$#', $p, $mm)) { if (isset($st['sessions'][$mm[1]])) $st['sessions'][$mm[1]]['expired'] = true; $out(200, ['id' => $mm[1], 'status' => 'expired']); }
$out(404, ['errors' => [['detail' => 'paymock: not handled ' . $m . ' ' . $p]]]);
