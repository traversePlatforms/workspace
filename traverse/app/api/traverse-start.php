<?php
declare(strict_types=1);
/**
 * The website's own checkout and welcome page (2026-10-29, Matthew: a company pays on the Traverse website and is using its own Traverse
 * within minutes, nothing manual). The pages are /start/ and /start/welcome/; everything they do is here, and the work is in
 * api/traverse-clients-lib.php. No session: each answer is about one checkout, named by its client id and Stripe session id.
 *
 *   plans      GET   the editions, plans and prices the checkout page shows (billing.php's numbers and founding rule)
 *   quote      POST  {plan, iv, seats}: what that pick costs, as Stripe will charge it
 *   checkout   POST  {edition, plan, iv, seats, agree, terms, agreement}: the Stripe Checkout address (a new client id)
 *   welcome    GET   ?c=&cs=: the welcome page's state (checked with Stripe every time): not paid / the form, prefilled / ready
 *   provision  POST  {c, cs, company, short?, address, miles, color, logo?, admin, email, mobile, anyway?}: makes the install, emails the
 *                    admin their code, answers with the app's address, the code and a one-use sign-in pass; then links the towns
 * Rate limited per address (the demo page's limiter). Reachable on its own: api/ is never behind the site password.
 */
require_once dirname(__DIR__) . '/demo/_lib.php';
require_once __DIR__ . '/traverse-clients-lib.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

$action = (string) ($_GET['action'] ?? '');
$isPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
$body = $isPost ? (array) (json_decode((string) file_get_contents('php://input'), true) ?: []) : [];
$c = tcBilling();
if (!$c) fail('Sign-up is not open yet. Book a demo instead, or email hello@traverseplatforms.com.', 503);

if ($action === 'plans') {
    $eds = []; foreach (TC_EDITIONS as $k => $n) if (is_file(tcTplDir($k) . '/edition.json')) $eds[] = ['key' => $k, 'name' => $n];
    out(['ok' => true, 'editions' => $eds, 'terms' => '2026-10-29', 'agreement' => '2026-11-06', 'seatsMax' => BILLING_SEATS_MAX] + tcPlans($c));
}
if ($action === 'quote') {
    if (!$isPost) fail('POST required', 405);
    $plan = (string) ($body['plan'] ?? ''); $iv = (string) ($body['iv'] ?? '');
    if (!in_array($plan, BILLING_PLANS, true) || !in_array($iv, ['month', 'year'], true)) fail('Pick a plan.');
    out(['ok' => true] + tcQuote($c, $plan, $iv, (int) ($body['seats'] ?? 1)));
}
if ($action === 'checkout') {
    if (!$isPost) fail('POST required', 405);
    rate_limit(20, 'start-checkout');
    $r = tcCheckout($c, $body, client_ip());
    if (isset($r['error'])) fail($r['error']);
    out(['ok' => true, 'url' => $r['url']]);
}
$cid = (string) ($_GET['c'] ?? ($body['c'] ?? '')); $cs = (string) ($_GET['cs'] ?? ($body['cs'] ?? ''));
if (!tcCidOk($cid)) fail('That link is not one we know.', 404);
if ($action === 'welcome') {
    rate_limit(120, 'start-welcome');
    $r = tcWelcome($c, $cid, $cs);
    if (isset($r['error']) && empty($r['paid']) && isset($r['code'])) fail($r['error'], (int) $r['code']);
    out(['ok' => true] + $r);
}
/* the answer first, the slow part after it: on the host the connection is closed (fastcgi_finish_request) and the buyer moves on; PHP's test
   server waits for the end */
function startAnswerThen(array $r): void {
    $txt = (string) json_encode($r, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    ignore_user_abort(true); @set_time_limit(300);
    header('Content-Length: ' . strlen($txt)); header('Connection: close');
    echo $txt;
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request(); else { @ob_flush(); flush(); }
}
$linkLater = PHP_SAPI === 'cli-server' && (getenv('TRAVERSE_LINK_LATER') === '1' || is_file(tcDir() . '/LINK_LATER'));   /* the test copy only: linking run by hand, to see the loading screen */
/* step 1, the service area: kept, then the towns are linked at once under the company's lock (Matthew: "start linking their towns in the background
   as soon as that step is submitted, so the homes are ready by the time they finish the rest") */
if ($action === 'area') {
    if (!$isPost) fail('POST required', 405);
    rate_limit(30, 'start-area');
    $lk = tcLock($cid);
    $r = tcArea($c, $cid, $cs, $body);
    if (isset($r['error'])) { http_response_code((int) ($r['code'] ?? 400)); out(['ok' => false] + array_diff_key($r, ['code' => 1])); }
    startAnswerThen($r);
    if ($linkLater) exit;
    tcLinkTowns($cid);
    exit;
}
/* step 2, the brand: kept for the install (the welcome page shows it on its preview at once) */
if ($action === 'brand') {
    if (!$isPost) fail('POST required', 405);
    rate_limit(40, 'start-brand');
    $r = tcBrand($c, $cid, $cs, $body);
    if (isset($r['error'])) { http_response_code((int) ($r['code'] ?? 400)); out(['ok' => false] + array_diff_key($r, ['code' => 1])); }
    out($r);
}
/* how far the area's linking has got (the welcome page shows it while the buyer types) */
if ($action === 'areastatus') {
    rate_limit(240, 'start-areastatus');
    $p = tcPend($cid); if (!$p || !hash_equals((string) ($p['cs'] ?? ''), $cs)) fail('That link is not one we know.', 404);
    out(['ok' => true, 'area' => !empty($p['area']) ? tcAreaPublic((array) $p['area']) : null]);
}
if ($action === 'provision') {
    if (!$isPost) fail('POST required', 405);
    rate_limit(30, 'start-provision');
    $r = tcProvision($c, $cid, $cs, $body);
    if (isset($r['error'])) { http_response_code((int) ($r['code'] ?? 400)); out(['ok' => false] + array_diff_key($r, ['code' => 1])); }
    if (!empty($r['again'])) out($r);
    $e = tcReg()[$cid] ?? [];
    tcMailReady($e, (string) $r['code']);
    startAnswerThen($r);
    /* the area step links under the same lock, so it has finished; one that never ran (the request died) is run now */
    $lk = tcLock($cid);
    $p = tcPend($cid);
    $l = ($p['area']['status'] ?? '') === 'linking' && !$linkLater ? tcLinkTowns($cid) : ['status' => (string) ($p['area']['status'] ?? ''), 'towns' => (int) ($p['area']['towns'] ?? 0), 'doors' => (int) ($p['area']['doors'] ?? 0)];
    $e = tcReg()[$cid] ?? $e; $a = (array) ($e['area'] ?? []); $p = tcPend($cid);
    if ($linkLater && ($l['status'] ?? '') === 'linking') exit;
    $hand = in_array($l['status'] ?? '', ['outside', 'none', 'nomatch'], true) || !empty($l['error']);
    tcMailMatthew(($hand ? 'NEEDS DOOR DATA: ' : 'new client live: ') . $e['name'] . ' (' . (TC_EDITIONS[$e['edition']] ?? $e['edition']) . ')', [
        'Company' => $e['name'], 'Edition' => $e['edition'], 'Plan' => $e['plan'] . ', ' . $e['interval'] . ', ' . $e['seats'] . ' people', 'Price' => tcMoney($p),
        'Admin' => $e['admin'] . ' <' . $e['email'] . '>', 'Address' => ($a['address'] ?? '') . (($a['matched'] ?? '') !== '' ? ' (map: ' . $a['matched'] . ')' : ''),
        'Area' => ($a['mode'] ?? '') === 'counties' ? 'counties: ' . ($a['place'] ?? '') : ($a['miles'] ?? '') . ' miles' . (($a['place'] ?? '') !== '' ? ' around ' . $a['place'] : ''),
        'Homes' => isset($l['towns']) ? $l['towns'] . ' towns, ' . number_format((int) $l['doors']) . ' homes' : ('link failed: ' . ($l['error'] ?? '?')),
        'Status' => $hand ? ($l['status'] === 'outside' ? 'outside Colorado: the app is open (pipeline, customers, jobs); add their towns' : ($l['status'] === 'nomatch' ? 'the address was not found on the map: set area.lat/lon in the registry, then clients.php relink ' . $cid : 'no towns in the radius yet: their towns need adding')) : 'live and released; free trial started' . (!empty($e['trial_end']) ? ' (first charge ' . date('j M Y', (int) $e['trial_end']) . ')' : ''),
        'App' => $e['url'], 'Client id' => $cid]);
    exit;
}
fail('Unknown action.', 404);
