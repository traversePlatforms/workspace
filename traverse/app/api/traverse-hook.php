<?php
declare(strict_types=1);
/**
 * One Stripe webhook for the website's checkouts and every client install made on the server (2026-10-29). Stripe allows 16 endpoints an
 * account, so client installs cannot each have their own; Traverse's five editions keep theirs (and ignore these events, as these ignore
 * theirs: each install takes only events carrying its own id or customer).
 *
 * Stripe endpoint (live mode): https://traverseplatforms.com/api/traverse-hook.php, events checkout.session.completed,
 * customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.paid, invoice.payment_failed.
 * Its signing secret is webhook_secret in traverse-shared/clients/billing-config.php, which every client install's own billing-config.php reads.
 *
 * Each event: the Stripe-Signature is checked here; the client is found by the id in the object's metadata (client_reference_id,
 * subscription metadata, an invoice's subscription details) or else by its customer or subscription. Then, under that client's lock:
 *   - an install that exists: this request becomes that install's own ?action=billinghook (its API file is run in place, with the same body
 *     and signature), so billing.json, past due, the 3-day lock, paid again, refunds and the seat note work exactly as in an edition;
 *   - not made yet (paid, welcome page not filled in): the event is kept in its pending record and replayed into its billing.json when the
 *     install is made; on payment the buyer is emailed the welcome link and Matthew is told (traverse-clients-lib.php tcHookPending).
 * Anything else (an edition's own customer, an unknown id) answers 200 and is ignored, so Stripe does not retry it.
 */
@ini_set('display_errors', '0');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') { http_response_code(405); exit; }
$tvhRaw = (string) file_get_contents('php://input');
$tvhDir = dirname(__DIR__, 2) . '/traverse-shared/clients';
$tvhCfg = is_readable($tvhDir . '/billing-config.php') ? (array) (require $tvhDir . '/billing-config.php') : [];
$tvhSecret = (string) ($tvhCfg['webhook_secret'] ?? '');
if ($tvhSecret === '' && !empty($tvhCfg['mock_file'])) $tvhSecret = 'whsec_mock';
/** Stripe-Signature "t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<body>">", within five minutes (the same rule as billing.php stripeSigValid) */
function tvhSigOk(string $secret, string $payload, string $header): bool {
    if ($secret === '' || $header === '') return false;
    $t = null; $sigs = [];
    foreach (explode(',', $header) as $part) { [$k, $v] = array_pad(explode('=', trim($part), 2), 2, ''); if ($k === 't' && ctype_digit($v)) $t = (int) $v; if ($k === 'v1' && $v !== '') $sigs[] = $v; }
    if ($t === null || !$sigs || abs(time() - $t) > 300) return false;
    $want = hash_hmac('sha256', $t . '.' . $payload, $secret);
    foreach ($sigs as $s) if (hash_equals($want, $s)) return true;
    return false;
}
function tvhOut(int $code, array $a): never { http_response_code($code); header('Content-Type: application/json'); echo json_encode($a); exit; }
if ($tvhSecret === '') tvhOut(404, ['ok' => false]);
if (!tvhSigOk($tvhSecret, $tvhRaw, (string) ($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? ''))) tvhOut(400, ['ok' => false, 'error' => 'bad signature']);
$tvhEv = json_decode($tvhRaw, true);
if (!is_array($tvhEv) || empty($tvhEv['type'])) tvhOut(400, ['ok' => false, 'error' => 'not an event']);

/* the client: by metadata first (no file read), else the registry and pending records (the library) */
$tvhO = (array) ($tvhEv['data']['object'] ?? []); $tvhCid = '';
foreach ([$tvhO['metadata']['install'] ?? null, $tvhO['client_reference_id'] ?? null, $tvhO['subscription_details']['metadata']['install'] ?? null,
          $tvhO['parent']['subscription_details']['metadata']['install'] ?? null] as $tvhV) if (is_string($tvhV) && preg_match('/^c[0-9a-f]{8}$/D', $tvhV)) { $tvhCid = $tvhV; break; }
$tvhReg = (array) ((json_decode((string) @file_get_contents($tvhDir . '/registry.json'), true) ?: [])['clients'] ?? []);
if ($tvhCid === '') {
    $tvhCus = (string) ($tvhO['customer'] ?? '');
    foreach ($tvhReg as $tvhK => $tvhE) if ($tvhCus !== '' && ($tvhE['customer'] ?? '') === $tvhCus) { $tvhCid = (string) $tvhK; break; }
    if ($tvhCid === '' && $tvhCus !== '') foreach (glob($tvhDir . '/pending/c*.json') ?: [] as $tvhF) { $tvhP = json_decode((string) @file_get_contents($tvhF), true); if (is_array($tvhP) && ($tvhP['customer'] ?? '') === $tvhCus) { $tvhCid = (string) $tvhP['cid']; break; } }
}
if ($tvhCid === '') tvhOut(200, ['ok' => true, 'ignored' => true]);
if (!is_dir($tvhDir . '/pending')) @mkdir($tvhDir . '/pending', 0700, true);
$tvhLock = @fopen($tvhDir . '/pending/' . $tvhCid . '.json.lock', 'c'); if ($tvhLock) flock($tvhLock, LOCK_EX);   /* the same lock as provisioning (tcLock) */
$tvhReg = (array) ((json_decode((string) @file_get_contents($tvhDir . '/registry.json'), true) ?: [])['clients'] ?? []);   /* read again under the lock */
$tvhE = $tvhReg[$tvhCid] ?? null;
if (is_array($tvhE) && ($tvhE['status'] ?? '') === 'live' && preg_match('/^traverse-c[0-9a-f]{8}$/D', (string) ($tvhE['api'] ?? '')) && is_file(__DIR__ . '/' . $tvhE['api'] . '-rounds.php')) {
    /* the install's own webhook, run in place: the same body and signature, which its billing-config.php checks with the same secret */
    $_GET = ['action' => 'billinghook']; $_REQUEST = $_GET;
    $tvhApi = __DIR__ . '/' . $tvhE['api'] . '-rounds.php';
    unset($tvhRaw, $tvhCfg, $tvhSecret, $tvhEv, $tvhO, $tvhReg, $tvhE, $tvhV, $tvhK, $tvhF, $tvhP, $tvhCus, $tvhDir);
    require $tvhApi;   /* answers and exits */
    exit;
}
require_once __DIR__ . '/traverse-clients-lib.php';
$tvhDid = tcHookPending($tvhCid, $tvhEv);
tvhOut(200, ['ok' => true, 'kept' => $tvhDid]);
