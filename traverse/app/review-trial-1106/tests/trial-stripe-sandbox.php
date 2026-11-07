<?php
/* Stripe TEST MODE run of the 7-day trial (6 Nov 2026), through the worktree's real billing.php functions. No live key, no real card.
   php trial-sandbox.php <path to billing.php> <path to stripe-test.json> */
require $argv[1];
$k = json_decode((string) file_get_contents($argv[2]), true);
$key = (string) ($k['secret'] ?? '');
if (!preg_match('/^(sk|rk)_test_/', $key)) exit("not a TEST key: stopping\n");
$c = ['secret_key' => $key, 'timeout' => 40];
$ok = 0; $bad = 0;
$check = function (string $what, bool $pass, string $more = '') use (&$ok, &$bad) { $pass ? $ok++ : $bad++; echo ($pass ? 'PASS ' : 'FAIL ') . $what . ($more !== '' ? "  ($more)" : '') . "\n"; };
$need = function (array $r, string $what) { if (isset($r['error'])) { echo "STOP at $what: {$r['error']}\n"; exit(1); } return $r; };
$day = 86400; $now = time();

/* set-up: a throwaway product, a founding and a list price, a customer with Stripe's test Visa */
$prod = $need(stripeCall($c, 'POST', '/v1/products', ['name' => 'Traverse trial sandbox ' . date('YmdHis')]), 'product');
$pf = $need(stripeCall($c, 'POST', '/v1/prices', ['product' => $prod['id'], 'unit_amount' => 5900, 'currency' => 'usd', 'recurring' => ['interval' => 'month']]), 'founding price');
$pl = $need(stripeCall($c, 'POST', '/v1/prices', ['product' => $prod['id'], 'unit_amount' => 7900, 'currency' => 'usd', 'recurring' => ['interval' => 'month']]), 'list price');
$cus = $need(stripeCall($c, 'POST', '/v1/customers', ['email' => 'trial-sandbox@example.com', 'payment_method' => 'pm_card_visa', 'invoice_settings' => ['default_payment_method' => 'pm_card_visa']]), 'customer');
$paid = function (string $subId) use ($c): int { $iv = stripeCall($c, 'GET', '/v1/invoices', ['subscription' => $subId, 'limit' => 10]); $t = 0; foreach ((array) ($iv['data'] ?? []) as $i) $t += (int) ($i['amount_paid'] ?? 0); return $t; };

/* A: a plain trial (what checkout makes: 7 days, card saved, nothing charged) */
$a = $need(stripeCall($c, 'POST', '/v1/subscriptions', ['customer' => $cus['id'], 'items' => [['price' => $pf['id']]], 'trial_period_days' => 7]), 'sub A');
$check('A: checkout-style trial is trialing with nothing charged', $a['status'] === 'trialing' && $paid($a['id']) === 0, 'status ' . $a['status']);
$check('A: Stripe shows 7 days', abs((int) $a['trial_end'] - ($now + 7 * $day)) < 600);
$want = $now + 10 * $day;   // go-live 3 days in: the trial moves LATER to live + 7
$r = billingTrialSet($c, $a, $want);
$a2 = stripeCall($c, 'GET', '/v1/subscriptions/' . $a['id']);
$check('A: billingTrialSet moves the first charge later (direct)', ($r['via'] ?? '') === 'subscription' && (int) $a2['trial_end'] === $want && $a2['status'] === 'trialing', json_encode($r));
$check('A: still nothing charged after the move', $paid($a['id']) === 0);
$push = $now + 13 * $day;  // the setup sweep pushing again while not live
$r = billingTrialSet($c, $a2, $push);
$a3 = stripeCall($c, 'GET', '/v1/subscriptions/' . $a['id']);
$check('A: a second push also lands', (int) $a3['trial_end'] === $push && $a3['status'] === 'trialing');
$del = stripeCall($c, 'DELETE', '/v1/subscriptions/' . $a['id']);
$check('A: cancel during the trial ends it with nothing charged', ($del['status'] ?? '') === 'canceled' && $paid($a['id']) === 0, 'status ' . ($del['status'] ?? $del['error'] ?? '?'));

/* B: a trial on the founding schedule (founding price for 12 months of bills after the trial, then the list price) */
$b = $need(stripeCall($c, 'POST', '/v1/subscriptions', ['customer' => $cus['id'], 'items' => [['price' => $pf['id']]], 'trial_period_days' => 7]), 'sub B');
$s = $need(stripeCall($c, 'POST', '/v1/subscription_schedules', ['from_subscription' => $b['id']]), 'schedule');
$u = stripeCall($c, 'POST', '/v1/subscription_schedules/' . $s['id'], billingSchedulePhases([['price' => $pf['id'], 'quantity' => 1]], [['price' => $pl['id'], 'quantity' => 1]], (int) $s['phases'][0]['start_date'], (int) $b['trial_end']));
$check('B: founding schedule set over a running trial', !isset($u['error']), $u['error'] ?? '');
$b2 = stripeCall($c, 'GET', '/v1/subscriptions/' . $b['id']);
$check('B: the schedule did NOT end the trial or charge', $b2['status'] === 'trialing' && (int) $b2['trial_end'] === (int) $b['trial_end'] && $paid($b['id']) === 0, 'status ' . $b2['status']);
$want = $now + 11 * $day;
$r = billingTrialSet($c, $b2, $want);
$b3 = stripeCall($c, 'GET', '/v1/subscriptions/' . $b['id']);
$s3 = stripeCall($c, 'GET', '/v1/subscription_schedules/' . $s['id']);
$p1 = $s3['phases'][0] ?? []; $p2 = $s3['phases'][1] ?? [];
$p1price = is_array($p1['items'][0]['price'] ?? null) ? $p1['items'][0]['price']['id'] : ($p1['items'][0]['price'] ?? '');
$p2price = is_array($p2['items'][0]['price'] ?? null) ? $p2['items'][0]['price']['id'] : ($p2['items'][0]['price'] ?? '');
$twelve = (new DateTimeImmutable('@' . $want))->modify('+12 months')->getTimestamp();
$check('B: billingTrialSet moves the trial through the schedule', ($r['via'] ?? '') === 'schedule' && (int) $b3['trial_end'] === $want && $b3['status'] === 'trialing', json_encode($r));
$check('B: phase 1 = founding price, trial to the new date, ends 12 months after it', $p1price === $pf['id'] && (int) ($p1['trial_end'] ?? 0) === $want && (int) ($p1['end_date'] ?? 0) === $twelve);
$check('B: phase 2 = list price, then released', $p2price === $pl['id'] && ($s3['end_behavior'] ?? '') === 'release');
$check('B: still nothing charged', $paid($b['id']) === 0);
$del = stripeCall($c, 'DELETE', '/v1/subscriptions/' . $b['id']);
$s4 = stripeCall($c, 'GET', '/v1/subscription_schedules/' . $s['id']);
$check('B: cancelling the subscription cancels it with nothing charged', ($del['status'] ?? '') === 'canceled' && $paid($b['id']) === 0, 'status ' . ($del['status'] ?? $del['error'] ?? '?'));
$check('B: and the schedule is no longer active', in_array($s4['status'] ?? '', ['canceled', 'released', 'completed'], true), 'schedule status ' . ($s4['status'] ?? '?'));

/* tidy the sandbox */
stripeCall($c, 'DELETE', '/v1/customers/' . $cus['id']);
stripeCall($c, 'POST', '/v1/prices/' . $pf['id'], ['active' => 'false']); stripeCall($c, 'POST', '/v1/prices/' . $pl['id'], ['active' => 'false']);
stripeCall($c, 'POST', '/v1/products/' . $prod['id'], ['active' => 'false']);
echo "\n$ok passed, $bad failed (Stripe TEST mode)\n";
exit($bad ? 1 : 0);
