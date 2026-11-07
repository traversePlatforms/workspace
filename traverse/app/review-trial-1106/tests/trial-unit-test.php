<?php
/* The free trial (Matthew 2026-11-06: 7 days free from go-live, card up front, replaces the 7-day money-back guarantee), billing.php and the
   website's client library against the mock Stripe (SIXFOLD_BILLING_MOCK: every call is logged, canned answers come back). No server, no
   network, no live keys. A fresh temp folder every run (copies of the two API files, so the client library's folders land there too).
   Run:  php traverse/app/review-trial-1106/tests/trial-unit-test.php */
declare(strict_types=1);
date_default_timezone_set('America/Denver');
$API = dirname(__DIR__, 2) . '/api';
$T = sys_get_temp_dir() . '/trial-unit-' . bin2hex(random_bytes(4));
foreach (['/site/public_html/api', '/site/traverse-shared/clients', '/site/traverse-shared/client-templates/roofing', '/data/rounds'] as $d) mkdir($T . $d, 0777, true);
copy($API . '/billing.php', $T . '/site/public_html/api/billing.php');
copy($API . '/traverse-clients-lib.php', $T . '/site/public_html/api/traverse-clients-lib.php');
file_put_contents($T . '/site/traverse-shared/client-templates/roofing/edition.json', '{"data":"traverse-data","folder":"tr-x","priv":"traverse-private"}');
define('DATA_DIR', $T . '/data/rounds');
$MOCK = $T . '/stripe-mock.json'; file_put_contents($MOCK, '{}');
putenv('SIXFOLD_BILLING_MOCK=' . $MOCK); putenv('SIXFOLD_BILLING_INSTALL=trial-test'); putenv('TRAV_MAIL_MOCK=' . $T . '/mail.log');
function writeJsonAtomic(string $f, array $j): bool { return file_put_contents($f, json_encode($j, JSON_UNESCAPED_SLASHES)) !== false; }
function feature(string $k): bool { return false; }
require $T . '/site/public_html/api/traverse-clients-lib.php';
require_once $T . '/site/public_html/api/billing.php';

$pass = 0; $fail = 0;
function t(bool $ok, string $m): void { global $pass, $fail; echo ($ok ? '  PASS  ' : '  FAIL  ') . $m . "\n"; $ok ? $pass++ : $fail++; }
function reqs(): array { global $MOCK; $o = []; foreach (@file($MOCK . '.requests.log', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $l) $o[] = json_decode($l, true); return $o; }
function fresh(array $billing = [], array $canned = []): void { global $MOCK; @unlink($MOCK . '.requests.log'); file_put_contents($MOCK, json_encode($canned)); file_put_contents(DATA_DIR . '/billing.json', json_encode($billing)); @unlink(DATA_DIR . '/billing.log'); }
function find(string $method, string $path): array { return array_values(array_filter(reqs(), fn($r) => $r['method'] === $method && $r['path'] === $path)); }
$c = billingConfig($T . '/x/api');   /* a folder with no private config: the defaults plus the mock */
$day = 86400; $now = time();
$plus12 = fn(int $ts) => (new DateTimeImmutable('@' . $ts))->modify('+12 months')->getTimestamp();
$back = 'https://app.test/tr-x/';

echo "Config\n";
t($c['free_days'] === 7 && $c['setup_days'] === 2 && $c['setup_push_days'] === 3 && $c['setup_cancel_days'] === 14 && $c['refund_days'] === 7, 'defaults: 7 free days, 2 business days setup, pushed 3 days ahead while not live, cancelled 14 days after sign-up, refund window 7 days');
t(!isset($c['trial_cap_days']), 'no 14-day ceiling any more');
t(!isset($c['guarantee_days']) && !isset($c['trial_days']), 'no guarantee_days or trial_days left in the defaults');

echo "Checkout (in the app)\n";
$r = billingCheckoutFields($c, [], 'crew', 'year', 5, false, $back); $f = $r['fields'] ?? [];
t(($f['subscription_data']['trial_period_days'] ?? null) === 7, 'a new company: subscription_data.trial_period_days = 7 (Stripe shows the earliest charge date)');
t(($f['payment_method_collection'] ?? '') === 'always', 'the card is collected up front (payment_method_collection always)');
t(($f['metadata']['trial'] ?? '') === '1', 'the session is marked as a trial');
$msg = (string) ($f['custom_text']['submit']['message'] ?? '');
t(str_contains($msg, 'Free for 7 days from the day your app is live') && str_contains($msg, 'Nothing is charged today') && str_contains($msg, 'It never comes earlier') && str_contains($msg, 'Subscription Agreement'), "Stripe's page says how the trial works (the charge only ever moves later), and still names the agreement");
t(!preg_match('/14 days|14-day|latest your first charge/i', $msg), 'the note says nothing of 14 days or a "latest" date');
t(strlen($f['custom_text']['submit']['message']) <= 1200, 'the note fits Stripe\'s 1,200-character limit (' . strlen($f['custom_text']['submit']['message']) . ')');
t(!empty($f['_founding']), 'the founding coupon still rides along (coupon path)');
fresh();
$e = billingFoundingCoupon($c, $f);
$cp = find('POST', '/v1/coupons')[0]['fields'] ?? [];
t($e === null && ($cp['duration'] ?? '') === 'repeating' && (int) ($cp['duration_in_months'] ?? 0) === 12 && (int) ($cp['amount_off'] ?? 0) === (199 - 149) * 12 * 100 && ($f['discounts'][0]['coupon'] ?? '') !== '', 'founding coupon: $50 a month x 12 off the yearly bill, 12 months, put on the checkout');
t(empty($f['subscription_data']['trial_end']), 'no fixed trial_end at checkout (trial_period_days only)');
foreach ([['had a subscription', ['subscription' => 'sub_old', 'status' => 'canceled']], ['had a trial', ['had_trial' => true]], ['paid before', ['paid_sub' => 'sub_old']], ['was released before', ['released_at' => $now - 9 * $day]]] as [$why, $b]) {
    $f2 = billingCheckoutFields($c, $b, 'crew', 'month', 5, false, $back)['fields'] ?? [];
    t(!isset($f2['subscription_data']['trial_period_days']) && !isset($f2['payment_method_collection']), 'no second trial: a company that ' . $why);
}
putenv('SIXFOLD_BILLING_MOCK_FOUNDING=1'); $cf = billingConfig($T . '/x/api'); putenv('SIXFOLD_BILLING_MOCK_FOUNDING');
$f3 = billingCheckoutFields($cf, [], 'team', 'month', 12, false, $back)['fields'] ?? [];
t(($f3['subscription_data']['trial_period_days'] ?? null) === 7 && ($f3['line_items'][0]['price'] ?? '') === 'price_mock_f_team_month', 'founding by real prices: the founding price on the line and the 7-day trial');

echo "Checkout (the website)\n";
fresh();
$w = tcCheckout($c, ['edition' => 'roofing', 'plan' => 'solo', 'iv' => 'month', 'seats' => 1, 'agree' => true, 'terms' => '2026-10-29', 'agreement' => '2026-11-06'], '127.0.0.1');
$cs = find('POST', '/v1/checkout/sessions')[0]['fields'] ?? [];
t(!empty($w['url']) && ($cs['subscription_data']['trial_period_days'] ?? null) === 7 && ($cs['payment_method_collection'] ?? '') === 'always', 'the website checkout opens the same 7-day trial with the card');
t(($cs['subscription_data']['metadata']['install'] ?? '') === ($w['cid'] ?? '?') && str_starts_with((string) ($cs['success_url'] ?? ''), 'https://traverseplatforms.com/start/welcome/?c='), 'it is the new client id, back to the welcome page');
$p = tcPlans($c); $q = tcQuote($c, 'crew', 'year', 5);
t(($p['freeDays'] ?? 0) === 7 && !isset($p['guaranteeDays']), 'the plans answer says freeDays 7, no guaranteeDays');
t($q['dueToday'] === 0 && $q['firstCharge'] === 149 * 12, 'quote: $0 due today; the first charge $1,788 (founding Team yearly)');
t(tcSessionPaid(['status' => 'complete', 'payment_status' => 'no_payment_required', 'client_reference_id' => 'c12345678'], 'c12345678'), "a trial checkout (payment_status no_payment_required) counts as done for the welcome page and provisioning");
t(!tcSessionPaid(['status' => 'open', 'payment_status' => 'unpaid', 'client_reference_id' => 'c12345678'], 'c12345678'), 'an unfinished checkout does not');
t(str_contains(tcMoney(['interval' => 'year', 'quote' => $q]), 'billed yearly ($1788)'), "Matthew's note still shows the yearly amount");

echo "Webhook: the trial starts, the app is set up\n";
$ceil = $now - 3600 + 7 * $day;   /* signed up an hour ago: Stripe's 7 days from then */
$sub = ['id' => 'sub_t1', 'object' => 'subscription', 'customer' => 'cus_t1', 'status' => 'trialing', 'trial_end' => $ceil, 'start_date' => $now, 'metadata' => ['install' => 'trial-test'],
        'items' => ['data' => [['price' => ['id' => 'price_mock_crew_year'], 'quantity' => 1, 'current_period_end' => $ceil]]]];
fresh();
billingTakeEvent($c, ['id' => 'evt_1', 'type' => 'checkout.session.completed', 'created' => $now, 'data' => ['object' => ['client_reference_id' => 'trial-test', 'customer' => 'cus_t1', 'subscription' => 'sub_t1', 'payment_status' => 'no_payment_required']]]);
$did = billingTakeEvent($c, ['id' => 'evt_2', 'type' => 'customer.subscription.created', 'created' => $now, 'data' => ['object' => $sub]]);
$b = billingLoad();
t($did === 'trialing' && !empty($b['paid_at']) && ($b['paid_sub'] ?? '') === 'sub_t1', 'a trialing subscription records paid_at (the setup clock), as an active one did');
t(!empty($b['had_trial']) && ($b['trial_end'] ?? 0) === $ceil, "had_trial is kept; trial_end is Stripe's 7 days from sign-up for now");
$L = billingLockState($b);
t($L['phase'] === 'setup' && $L['lock'] === 'setup', 'trialing and not released: setup mode (the app is still being set up)');
$S = billingState($c, []);
t($S['status'] === 'trialing' && $S['freeDays'] === 7 && $S['trialUntil'] === null && $S['nextCharge'] === null, 'Billing during setup: no trial-until date and no next-charge date yet (provisional while not live)');
t(!billingTrialOk($c, $b), 'that company can no longer start another trial');
t(billingRefundable($c, $b), "Traverse's Cancel is open during setup");

echo "Release to client (Mark live), no schedule\n";
fresh(billingLoad(), ['get' => ['/v1/subscriptions/sub_t1' => $sub]]);
$err = billingMarkLive($c, 'Matthew Sharpe'); $b = billingLoad(); $want = (int) $b['live_at'] + 7 * $day;
$up = find('POST', '/v1/subscriptions/sub_t1');
t($err === null && !empty($b['live_at']), 'released: live_at recorded');
t(count($up) === 1 && (int) $up[0]['fields']['trial_end'] === $want && ($up[0]['fields']['proration_behavior'] ?? '') === 'none' && $want > $ceil, 'Stripe: POST /v1/subscriptions/sub_t1 trial_end = live + 7 days (later than before), proration_behavior none');
t(($b['trial_end'] ?? 0) === $want && empty($b['trial_err']), 'billing.json: trial_end = live + 7 days, no error');
$S = billingState($c, []);
t($S['trialUntil'] === $want && $S['nextCharge'] === $want && $S['liveAt'] === $b['live_at'], 'Billing: free trial until live + 7, the next charge that day');
t(billingLockState($b)['phase'] === 'live', 'the whole app is open');
t(billingMarkLive($c, 'x') !== null && count(find('POST', '/v1/subscriptions/sub_t1')) === 1, 'a second Release is refused and moves nothing');
/* Stripe's own event after the change keeps the dates */
$sub2 = array_replace($sub, ['trial_end' => $want, 'items' => ['data' => [['price' => ['id' => 'price_mock_crew_year'], 'quantity' => 1, 'current_period_end' => $want]]]]);
billingTakeEvent($c, ['id' => 'evt_3', 'type' => 'customer.subscription.updated', 'created' => time(), 'data' => ['object' => $sub2]]);
$b = billingLoad();
t(($b['trial_end'] ?? 0) === $want && ($b['period_end'] ?? 0) === $want && !empty($b['live_at']) && ($b['paid_sub'] ?? '') === 'sub_t1', "Stripe's subscription.updated keeps trial_end, period end and live_at");
/* the trial ends: Stripe charges the first bill */
$sub3 = array_replace($sub2, ['status' => 'active', 'trial_end' => $now - $day, 'items' => ['data' => [['price' => ['id' => 'price_mock_crew_year'], 'quantity' => 1, 'current_period_end' => $now + 364 * $day]]]]);
billingTakeEvent($c, ['id' => 'evt_4', 'type' => 'customer.subscription.updated', 'created' => time(), 'data' => ['object' => $sub3]]);
$b = billingLoad();
t($b['status'] === 'active' && !empty($b['live_at']) && ($b['paid_sub'] ?? '') === 'sub_t1', 'trial over, active: still live, the setup clock does not restart');
t(billingRefundable($c, $b), "Traverse's Refund and cancel: open the week after the first charge");
$b['trial_end'] = $now - 8 * $day; file_put_contents(DATA_DIR . '/billing.json', json_encode($b));
t(!billingRefundable($c, billingLoad()), '... and shut after it');
/* extend, never shorten: a trial already later than live + 7 (the setup sweep pushed it) is kept and Stripe is not touched */
$late = $now + 10 * $day;
fresh(['subscription' => 'sub_k1', 'customer' => 'cus_k', 'status' => 'trialing', 'paid_at' => $now - 9 * $day, 'paid_sub' => 'sub_k1', 'trial_end' => $late, 'had_trial' => true], ['get' => ['/v1/subscriptions/sub_k1' => array_replace($sub, ['id' => 'sub_k1', 'trial_end' => $late])]]);
$err = billingMarkLive($c, 'Matthew Sharpe'); $bk = billingLoad();
t($err === null && count(find('POST', '/v1/subscriptions/sub_k1')) === 0 && count(reqs()) === 1, 'Release with a trial already later than live + 7: Stripe is only read, never changed');
t(($bk['trial_end'] ?? 0) === $late && billingTrialUntil($bk) === $late && empty($bk['trial_err']), 'the later date stands: free trial until ' . date('j M Y', $late) . ' (never shortened)');

echo "Release to client with the founding schedule\n";
$S0 = $now - 3600; $fsub = array_replace($sub, ['id' => 'sub_f1', 'schedule' => 'sub_sched_f1', 'start_date' => $S0, 'items' => ['data' => [['price' => ['id' => 'price_mock_f_crew_month'], 'quantity' => 1], ['price' => ['id' => 'price_mock_f_crew_extra_month'], 'quantity' => 2]]]]);
$sched = ['id' => 'sub_sched_f1', 'phases' => [
    ['start_date' => $S0, 'end_date' => $plus12($ceil), 'trial_end' => $ceil, 'items' => [['price' => 'price_mock_f_crew_month', 'quantity' => 1], ['price' => 'price_mock_f_crew_extra_month', 'quantity' => 2]]],
    ['start_date' => $plus12($ceil), 'end_date' => null, 'items' => [['price' => 'price_mock_crew_month', 'quantity' => 1], ['price' => 'price_mock_crew_extra_month', 'quantity' => 2]]]]];
fresh(['subscription' => 'sub_f1', 'customer' => 'cus_t1', 'status' => 'trialing', 'paid_at' => $now - 3600, 'paid_sub' => 'sub_f1', 'trial_end' => $ceil, 'had_trial' => true, 'schedule' => 'sub_sched_f1', 'founding_price' => true, 'start' => $S0],
      ['get' => ['/v1/subscriptions/sub_f1' => $fsub, '/v1/subscription_schedules/sub_sched_f1' => $sched]]);
$err = billingMarkLive($cf, 'Matthew Sharpe'); $b = billingLoad(); $want = (int) $b['live_at'] + 7 * $day;
$su = find('POST', '/v1/subscription_schedules/sub_sched_f1'); $ph = $su[0]['fields']['phases'] ?? [];
t($err === null && count($su) === 1 && count(find('POST', '/v1/subscriptions/sub_f1')) === 0, 'changed through the schedule (Stripe: use the Schedule API when one is attached), not the subscription');
t((int) ($ph[0]['trial_end'] ?? 0) === $want && (int) ($ph[0]['start_date'] ?? 0) === $S0, 'phase 1: trial_end = live + 7 days, its start date unchanged');
t((int) ($ph[0]['end_date'] ?? 0) === $plus12($want), 'phase 1 ends 12 months after the first real bill (trial end + 12 months)');
t(($ph[0]['items'] ?? []) === [['price' => 'price_mock_f_crew_month', 'quantity' => 1], ['price' => 'price_mock_f_crew_extra_month', 'quantity' => 2]] && ($ph[1]['items'] ?? []) === [['price' => 'price_mock_crew_month', 'quantity' => 1], ['price' => 'price_mock_crew_extra_month', 'quantity' => 2]], 'both phases keep their items: founding prices first, list prices after');
t(($su[0]['fields']['end_behavior'] ?? '') === 'release' && ($ph[0]['proration_behavior'] ?? '') === 'none' && !isset($ph[1]['trial_end']), 'released at the end, no proration, no trial on the list-price phase');
[$on, $step] = billingFoundingStep($b);
t($on && $step === $plus12($want), 'Billing: the founding price steps up 12 months after the trial ends (' . date('j M Y', (int) $step) . ')');

echo "The founding schedule made while the trial runs\n";
fresh(['subscription' => 'sub_f2'], ['get' => ['/v1/subscriptions/sub_f2' => array_replace($fsub, ['id' => 'sub_f2', 'schedule' => null, 'trial_end' => $ceil])]]);
$fs = billingFoundingSchedule($cf, 'sub_f2');
$sp = find('POST', '/v1/subscription_schedules/' . ($fs['schedule'] ?? '?'))[0]['fields'] ?? [];
t(!empty($fs['schedule']) && (int) ($sp['phases'][0]['trial_end'] ?? 0) === $ceil, 'the trial still running is sent again on phase 1 (a schedule update would otherwise end it and charge at once)');
t((int) ($sp['phases'][0]['end_date'] ?? 0) === $plus12($ceil), 'phase 1 runs 12 months past the trial');
fresh([], ['get' => ['/v1/subscriptions/sub_f3' => array_replace($fsub, ['id' => 'sub_f3', 'schedule' => null, 'status' => 'active', 'trial_end' => null])]]);
$fs = billingFoundingSchedule($cf, 'sub_f3'); $sp = find('POST', '/v1/subscription_schedules/' . ($fs['schedule'] ?? '?'))[0]['fields'] ?? [];
t(!isset($sp['phases'][0]['trial_end']) && (int) ($sp['phases'][0]['end_date'] ?? 0) === $plus12($S0), 'no trial: as before, 12 months from the start');

echo "Edge cases at go-live\n";
fresh(['subscription' => 'sub_e1', 'customer' => 'cus_e', 'status' => 'active', 'paid_at' => $now - 16 * $day, 'paid_sub' => 'sub_e1', 'trial_end' => $now - 2 * $day, 'had_trial' => true],
      ['get' => ['/v1/subscriptions/sub_e1' => array_replace($sub, ['id' => 'sub_e1', 'status' => 'active', 'trial_end' => $now - 2 * $day])]]);
$err = billingMarkLive($c, 'Matthew Sharpe'); $b = billingLoad();
t($err === null && !empty($b['live_at']) && count(find('POST', '/v1/subscriptions/sub_e1')) === 0, 'released after the trial ran out (the sweep did not run): still released, nothing changed in Stripe');
t(str_contains((string) ($b['trial_err']['why'] ?? ''), 'already ended'), 'and Traverse is told the first charge has gone through (trial_err)');
fresh(['subscription' => 'sub_e2', 'customer' => 'cus_e', 'status' => 'active', 'paid_at' => $now, 'paid_sub' => 'sub_e2'], ['get' => ['/v1/subscriptions/sub_e2' => array_replace($sub, ['id' => 'sub_e2', 'status' => 'active', 'trial_end' => null])]]);
$err = billingMarkLive($c, 'Matthew Sharpe'); $b = billingLoad();
t($err === null && empty($b['trial_err']) && count(find('POST', '/v1/subscriptions/sub_e2')) === 0, 'a plan with no trial (paid at checkout): released, nothing to move, no error');
fresh(['subscription' => 'sub_e3', 'customer' => 'cus_e', 'status' => 'trialing', 'paid_at' => $now, 'paid_sub' => 'sub_e3', 'trial_end' => $ceil], ['fail' => 'Stripe is down (test)']);
$err = billingMarkLive($c, 'Matthew Sharpe'); $b = billingLoad();
t($err === null && !empty($b['live_at']) && str_contains((string) ($b['trial_err']['why'] ?? ''), 'set the trial on sub_e3 to end') && (int) ($b['trial_err']['want'] ?? 0) === (int) $b['live_at'] + 7 * $day, 'Stripe refuses: the release stands, and trial_err says which date to set by hand');
t(($b['trial_end'] ?? 0) === $ceil, 'billing.json keeps the trial end Stripe really has');
fresh(['subscription' => 'sub_e4', 'customer' => 'cus_e', 'status' => 'trialing', 'paid_at' => $now, 'paid_sub' => 'sub_e4', 'trial_end' => $ceil, 'schedule' => 'sub_sched_odd'],
      ['get' => ['/v1/subscriptions/sub_e4' => array_replace($sub, ['id' => 'sub_e4', 'schedule' => 'sub_sched_odd']), '/v1/subscription_schedules/sub_sched_odd' => ['id' => 'sub_sched_odd', 'phases' => [['start_date' => $now, 'end_date' => $now + 99 * $day, 'items' => [['price' => 'price_x', 'quantity' => 1]]]]]]]);
billingMarkLive($c, 'Matthew Sharpe'); $b = billingLoad();
t(str_contains((string) ($b['trial_err']['why'] ?? ''), 'not the founding step-up') && count(find('POST', '/v1/subscription_schedules/sub_sched_odd')) === 0, "a schedule that is not ours is left alone and Traverse is told");

echo "Cancel during the trial; refund after it\n";
fresh(['subscription' => 'sub_c1', 'customer' => 'cus_c', 'status' => 'trialing', 'paid_at' => $now, 'paid_sub' => 'sub_c1', 'trial_end' => $now + 5 * $day, 'live_at' => $now - 2 * $day]);
$x = billingRefundCancel($c, 'Matthew Sharpe'); $b = billingLoad();
t(!empty($x['ok']) && !empty($x['trial']) && $x['amount'] === 0, 'in the trial: Cancel, nothing to refund');
t(count(find('GET', '/v1/charges')) === 0 && count(find('POST', '/v1/refunds')) === 0 && count(find('DELETE', '/v1/subscriptions/sub_c1')) === 1, 'Stripe: no charge lookup, no refund, one DELETE /v1/subscriptions/sub_c1');
t($b['status'] === 'canceled' && !empty($b['refunded']['trial']), 'billing.json: canceled in the trial');
$S = billingState($c, []);
t($S['refundedInTrial'] === true && $S['refundable'] === false, 'Billing: "Canceled by Traverse during the free trial", the button gone');
fresh(['subscription' => 'sub_c2', 'customer' => 'cus_c', 'status' => 'active', 'paid_at' => $now - 12 * $day, 'paid_sub' => 'sub_c2', 'trial_end' => $now - 2 * $day, 'live_at' => $now - 9 * $day],
      ['get' => ['/v1/charges' => ['data' => [['id' => 'ch_1', 'amount' => 24900, 'refunded' => false]]]]]);
$x = billingRefundCancel($c, 'Matthew Sharpe');
t(!empty($x['ok']) && empty($x['trial']) && $x['amount'] === 24900 && count(find('POST', '/v1/refunds')) === 1 && (find('POST', '/v1/refunds')[0]['fields']['charge'] ?? '') === 'ch_1', 'after the trial (2 days): the first charge refunded in full, then canceled');
t(!str_contains(json_encode(find('POST', '/v1/refunds')), 'money-back'), 'the refund is not labelled money-back');
fresh(['subscription' => 'sub_c3', 'customer' => 'cus_c', 'status' => 'active', 'paid_at' => $now - 30 * $day, 'paid_sub' => 'sub_c3', 'trial_end' => $now - 20 * $day, 'live_at' => $now - 27 * $day]);
$x = billingRefundCancel($c, 'Matthew Sharpe');
t(isset($x['error']) && $x['error'] === BILLING_REFUND_WINDOW && count(reqs()) === 0, 'three weeks after the first charge: refused, nothing sent to Stripe');

echo "Setup sweep: nobody is charged without an app (an install)\n";
$base = ['customer' => 'cus_s', 'status' => 'trialing', 'paid_sub' => 'sub_s1', 'subscription' => 'sub_s1', 'had_trial' => true];
$ssub = fn(array $o) => array_replace($sub, ['id' => 'sub_s1', 'schedule' => null], $o);
fresh($base + ['paid_at' => $now - 5 * $day, 'trial_end' => $now + 2 * $day], ['get' => ['/v1/subscriptions/sub_s1' => $ssub(['trial_end' => $now + 2 * $day])]]);
$r = billingSetupSweep($c, $now); $b = billingLoad(); $up = find('POST', '/v1/subscriptions/sub_s1');
t($r['did'] === 'push' && count($up) === 1 && (int) $up[0]['fields']['trial_end'] === $now + 3 * $day && ($up[0]['fields']['proration_behavior'] ?? '') === 'none', 'not live, 2 days left: pushed to 3 days ahead (POST trial_end, no proration)');
t(($b['trial_end'] ?? 0) === $now + 3 * $day && str_contains((string) @file_get_contents(DATA_DIR . '/billing.log'), '"setup push"'), 'billing.json follows; the push is in billing.log');
fresh($base + ['paid_at' => $now - 2 * $day, 'trial_end' => $now + 5 * $day], ['get' => ['/v1/subscriptions/sub_s1' => $ssub(['trial_end' => $now + 5 * $day])]]);
$r = billingSetupSweep($c, $now);
t($r['did'] === '' && count(reqs()) === 1, 'not live, 5 days left: nothing to do (Stripe only read)');
/* daily runs: the trial never comes within 3 days while not live */
fresh($base + ['paid_at' => $now, 'trial_end' => $now + 7 * $day]); $ok = true;
for ($d = 0; $d < 14; $d++) { $at = $now + $d * $day; $cur = (int) billingLoad()['trial_end']; file_put_contents($MOCK, json_encode(['get' => ['/v1/subscriptions/sub_s1' => $ssub(['trial_end' => $cur])]])); billingSetupSweep($c, $at); if ((int) billingLoad()['trial_end'] < $at + 3 * $day) $ok = false; }
t($ok && count(find('POST', '/v1/subscriptions/sub_s1')) >= 9, 'thirteen daily runs: the trial end is always at least 3 days ahead (' . count(find('POST', '/v1/subscriptions/sub_s1')) . ' pushes)');
fresh($base + ['paid_at' => $now - 5 * $day, 'trial_end' => $now + $day, 'schedule' => 'sub_sched_s1'],
      ['get' => ['/v1/subscriptions/sub_s1' => $ssub(['trial_end' => $now + $day, 'schedule' => 'sub_sched_s1']), '/v1/subscription_schedules/sub_sched_s1' => array_replace($sched, ['id' => 'sub_sched_s1'])]]);
$r = billingSetupSweep($cf, $now); $ph = find('POST', '/v1/subscription_schedules/sub_sched_s1')[0]['fields']['phases'] ?? [];
t($r['did'] === 'push' && $r['via'] === 'schedule' && (int) ($ph[0]['trial_end'] ?? 0) === $now + 3 * $day && (int) ($ph[0]['end_date'] ?? 0) === $plus12($now + 3 * $day) && count(find('POST', '/v1/subscriptions/sub_s1')) === 0, 'on the founding schedule: pushed through the schedule, phase 1 ends 12 months after the new trial end');
fresh($base + ['paid_at' => $now - 14 * $day - 60, 'trial_end' => $now + 3 * $day], ['get' => ['/v1/subscriptions/sub_s1' => $ssub(['trial_end' => $now + 3 * $day])]]);
$r = billingSetupSweep($c, $now); $b = billingLoad();
t($r['did'] === 'cancel' && count(find('DELETE', '/v1/subscriptions/sub_s1')) === 1 && count(find('POST', '/v1/refunds')) === 0 && count(find('POST', '/v1/subscriptions/sub_s1')) === 0, '14 days after sign-up, still not live: DELETE /v1/subscriptions/sub_s1, no refund (nothing was charged)');
t($b['status'] === 'canceled' && !empty($b['setup_canceled']['why']) && str_contains((string) @file_get_contents(DATA_DIR . '/billing.log'), '"setup cancel"'), 'billing.json: canceled, with why; the cancel is in billing.log');
fresh($base + ['paid_at' => $now - 20 * $day, 'trial_end' => $now + $day, 'live_at' => $now - 10 * $day]);
t(billingSetupSweep($c, $now)['did'] === '' && count(reqs()) === 0, 'a live company: never touched (no Stripe call), even past 14 days');
fresh(array_replace($base, ['status' => 'active']) + ['paid_at' => $now - 20 * $day, 'trial_end' => $now - 2 * $day]);
t(billingSetupSweep($c, $now)['did'] === '' && count(reqs()) === 0, 'a subscription that is not trialing: never touched (no Stripe call)');
fresh($base + ['paid_at' => $now - 20 * $day, 'trial_end' => $now + $day], ['get' => ['/v1/subscriptions/sub_s1' => $ssub(['status' => 'active'])]]);
t(billingSetupSweep($c, $now)['did'] === '' && count(reqs()) === 1, 'billing.json says trialing but Stripe says active: only read, nothing pushed or cancelled');
fresh($base + ['paid_at' => $now - 5 * $day, 'trial_end' => $now + $day], ['fail' => 'Stripe is down (test)']);
t(billingSetupSweep($c, $now)['did'] === 'error', 'Stripe down: reported as an error (the caller emails Matthew)');

echo "Setup sweep: website sign-ups with no install yet\n";
file_put_contents($T . '/site/traverse-shared/clients/billing-config.php', "<?php return ['install' => 'site'];\n");
file_put_contents($T . '/site/traverse-shared/clients/settings.json', '{"notify":"m.sharpe@traverseplatforms.com"}');
$pend = function (string $cid, array $o) use ($T) { file_put_contents($T . '/site/traverse-shared/clients/pending/' . $cid . '.json', json_encode(['cid' => $cid, 'cs' => 'cs_test_' . $cid, 'edition' => 'roofing', 'plan' => 'crew', 'interval' => 'month', 'seats' => 5, 'email' => 'buyer@example.test', 'company_hint' => 'Buyer ' . $cid] + $o)); };
@unlink($T . '/mail.log');
$pend('c00000001', ['paid_at' => $now - 3 * $day, 'subscription' => 'sub_p1']);
$pend('c00000002', ['paid_at' => $now - 15 * $day, 'subscription' => 'sub_p2']);
$pend('c00000003', ['paid_at' => $now - 15 * $day, 'subscription' => 'sub_p3', 'provisioned_at' => $now - 14 * $day]);
$pend('c00000004', ['paid_at' => $now - 2 * $day, 'subscription' => 'sub_p4']);
$pend('c00000005', ['paid_at' => $now - 1 * $day, 'subscription' => 'sub_p5']);
fresh([], ['get' => ['/v1/subscriptions/sub_p1' => array_replace($sub, ['id' => 'sub_p1', 'trial_end' => $now + $day]), '/v1/subscriptions/sub_p2' => array_replace($sub, ['id' => 'sub_p2', 'trial_end' => $now + 3 * $day]),
    '/v1/subscriptions/sub_p3' => array_replace($sub, ['id' => 'sub_p3']), '/v1/subscriptions/sub_p4' => array_replace($sub, ['id' => 'sub_p4', 'status' => 'active']), '/v1/subscriptions/sub_p5' => array_replace($sub, ['id' => 'sub_p5', 'trial_end' => $now + 6 * $day])]]);
$n = tcTrialSweepPending($now);
t($n === ['push' => 1, 'cancel' => 1, 'error' => 0], 'one pushed, one cancelled, nothing failed (' . json_encode($n) . ')');
$pp = find('POST', '/v1/subscriptions/sub_p1');
t(count($pp) === 1 && (int) $pp[0]['fields']['trial_end'] === $now + 3 * $day, 'unfinished 3 days, 1 day left: pushed to 3 days ahead');
t(count(find('DELETE', '/v1/subscriptions/sub_p2')) === 1 && !empty(tcPend('c00000002')['setup_canceled']), 'unfinished 15 days: cancelled in Stripe, the pending record marked');
$ml = (string) @file_get_contents($T . '/mail.log');
t(str_contains($ml, 'sign-up cancelled, no app after 14 days: Buyer c00000002') && str_contains($ml, 'm.sharpe@traverseplatforms.com') && str_contains($ml, 'nothing (cancelled during the free trial)'), 'Matthew is emailed: the company, why, and that nothing was charged');
t(!str_contains($ml, '"to":"buyer@example.test"'), 'the buyer is not emailed by the sweep');
t(count(find('GET', '/v1/subscriptions/sub_p3')) === 0, 'a provisioned company is skipped (its install has its own sweep)');
t(count(find('POST', '/v1/subscriptions/sub_p4')) === 0 && count(find('DELETE', '/v1/subscriptions/sub_p4')) === 0, 'not trialing: only read');
t(count(find('POST', '/v1/subscriptions/sub_p5')) === 0, '6 days left: nothing to do');
$wl = tcWelcome($c, 'c00000002', 'cs_test_c00000002');
t(($wl['code'] ?? 0) === 410 && $wl['error'] === TC_SETUP_CANCELED && !preg_match('/14 days/', TC_SETUP_CANCELED), "the cancelled sign-up's welcome link says so (no app, nothing charged) and makes nothing");
t(isset(tcProvision($c, 'c00000002', 'cs_test_c00000002', [])['error']) && isset(tcArea($c, 'c00000002', 'cs_test_c00000002', [])['error']), '... and its area and provision steps refuse too');
$cl = (string) @file_get_contents($T . '/site/traverse-shared/clients/clients.log');
t(str_contains($cl, '"setup push"') && str_contains($cl, '"setup cancel"'), 'both are in clients.log');
$mk = json_decode((string) file_get_contents($MOCK), true); $mk['get']['/v1/subscriptions/sub_p1']['trial_end'] = $now + 3 * $day; file_put_contents($MOCK, json_encode($mk));   /* Stripe now answers the pushed date */
t(tcTrialSweepPending($now) === ['push' => 0, 'cancel' => 0, 'error' => 0] && count(find('DELETE', '/v1/subscriptions/sub_p2')) === 1, 'a second run the same day does nothing more');

echo "The website's ready email\n";
t(str_contains(tcTrialLine(['trial_end' => $now + 7 * $day]), 'Your 7 free days started today. Your card is charged on ' . date('j M Y', $now + 7 * $day) . ' unless you cancel'), 'ready email: the free days and the charge date');
t(!str_contains(tcTrialLine(['trial_end' => 0]), 'money'), 'no trial on file: no promise at all');

echo "\n" . $pass . ' passed, ' . $fail . " failed\n";
exec('rm -rf ' . escapeshellarg($T));
exit($fail ? 1 : 0);
