<?php
declare(strict_types=1);
/**
 * Billing (Matthew 2026-10-10): a company pays Traverse for its install with Stripe. Included by api/rounds.php;
 * nothing here answers a request on its own.
 *
 * ---- WHAT IT DOES ------------------------------------------------------------------------
 * The install's admin opens Billing, picks a plan (Solo, Crew or Team; monthly or yearly; how many people; a second
 * edition if wanted) and is sent to Stripe Checkout to pay. Stripe tells this install what happened through its webhook
 * (rounds.php ?action=billinghook, the Stripe-Signature checked), and the plan, seats, status and renewal date are kept
 * in sixfold-data/rounds/billing.json. The card, invoices and cancelling happen in Stripe's own customer portal
 * ("Manage billing"). Plan and seat changes go through Traverse (billing@): the portal cannot change a subscription
 * made of several prices.
 *
 * ---- THE PLANS (Matthew 2026-10-26, traverse/research/pricing-2026-10-26/PRICING-RECOMMENDATION.md) ------------------
 * Per company, users included: Solo 1 person, Crew up to 5, Team up to 12; each person past that is an extra seat.
 * Roofing and Solar installs carry the edition uplift (+$20 on Solo, +$50 on Crew and Team). A second edition is a flat
 * add-on. One subscription = the plan's base price (quantity 1) + extra seats (quantity = people past the included) +
 * the uplift (quantity 1, where it applies) + the second edition (quantity 1, if picked). Founding companies: a coupon
 * on the whole subscription (25% off for 12 months) and the free pilot once.
 *
 * ---- WHAT IT DOES NOT DO ------------------------------------------------------------------
 *   - It never locks anyone out. Past due, cancelled or more people than paid seats: the admin sees a warning and
 *     nothing else changes. Whether to enforce anything is Matthew's call, later.
 *   - No card details touch this server: Stripe's pages take them.
 *   - The Company plan (custom) is not sold here.
 *
 * ---- WHERE THINGS LIVE ---------------------------------------------------------------------
 *   sixfold-private/billing-config.php   the Stripe keys and price ids (api/billing-config.example.php is the shape)
 *   sixfold-data/rounds/billing.json     this install's subscription as Stripe last reported it
 *   sixfold-data/rounds/billing.log      one JSON line per webhook event taken (type, id, at) and per checkout started
 * Environment variables SIXFOLD_BILLING_* override the file.
 *
 * One Stripe account can serve every install: each install has its own webhook endpoint and secret, and only takes
 * events that carry its own install key (client_reference_id / subscription metadata) or its own customer.
 *
 * ---- TESTS ---------------------------------------------------------------------------------
 * 'mock_file' (config or SIXFOLD_BILLING_MOCK) calls nothing: each Stripe request is appended to
 * <mock_file>.requests.log and a canned answer comes back; the webhook secret is then 'whsec_mock'.
 */

const BILLING_PLANS = ['solo', 'crew', 'team'];
const BILLING_PRICE_KEYS = ['solo', 'crew', 'team', 'crew_extra', 'team_extra', 'uplift_solo', 'uplift', 'addon'];
const BILLING_GOOD = ['active', 'trialing'];
const BILLING_SEATS_MAX = 500;

function billingConfigDefaults(): array {
    $two = fn($m, $y) => ['month' => $m, 'year' => $y];
    return [
        'secret_key' => '',              /* sk_live_... or sk_test_... */
        'webhook_secret' => '',          /* whsec_... from this install's webhook endpoint */
        'install' => '',                 /* this install's key; empty = the data folder's name */
        /* Stripe price ids, one per key and interval (traverse/ops/stripe-setup.mjs prints them): the three plans' base prices,
           the extra seat on Crew and on Team, the edition uplift (Solo's and the others'), the second edition */
        'prices' => array_fill_keys(BILLING_PRICE_KEYS, $two('', '')),
        /* what the Billing screen shows, US dollars per month (year = per month, billed yearly). Keep it equal to Stripe. */
        'display' => ['solo' => $two(99, 79), 'crew' => $two(249, 199), 'team' => $two(549, 449),
                      'crew_extra' => $two(45, 35), 'team_extra' => $two(39, 29),
                      'uplift_solo' => $two(20, 20), 'uplift' => $two(50, 50), 'addon' => $two(99, 99)],
        'included' => ['solo' => 1, 'crew' => 5, 'team' => 12],   /* people each plan covers before extra seats */
        'uplift_on' => null,             /* the Roofing/Solar uplift: null = from the edition (features roof, solar or hail) */
        /* a founding company: a free pilot before the first charge, and a coupon on the whole plan (25% off for the first year) */
        'founding' => false, 'trial_days' => 14, 'founding_coupon' => '',
        'return_url' => '',              /* where Stripe sends people back; empty = the page they came from */
        'timeout' => 20,
        'mock_file' => null,
    ];
}
function billingConfig(?string $apiDir = null): array {
    $apiDir = $apiDir ?? __DIR__;
    $cfg = billingConfigDefaults();
    $priv = dirname($apiDir, 2) . '/sixfold-private/billing-config.php';
    if (is_readable($priv)) $cfg = array_replace_recursive($cfg, (array) (require $priv));
    foreach (['secret_key' => 'SIXFOLD_BILLING_KEY', 'webhook_secret' => 'SIXFOLD_BILLING_HOOK', 'install' => 'SIXFOLD_BILLING_INSTALL',
              'mock_file' => 'SIXFOLD_BILLING_MOCK'] as $k => $name) {
        $v = getenv($name); if ($v !== false && $v !== '') $cfg[$k] = $v;
    }
    if (getenv('SIXFOLD_BILLING_FOUNDING') === '1') $cfg['founding'] = true;
    if ($cfg['install'] === '') $cfg['install'] = basename(dirname(DATA_DIR));
    if (!empty($cfg['mock_file'])) {
        if ($cfg['webhook_secret'] === '') $cfg['webhook_secret'] = 'whsec_mock';
        foreach (BILLING_PRICE_KEYS as $p) foreach (['month', 'year'] as $i)
            if (($cfg['prices'][$p][$i] ?? '') === '') $cfg['prices'][$p][$i] = 'price_mock_' . $p . '_' . $i;
    }
    return $cfg;
}
function billingConfigured(array $c): bool {
    if (!empty($c['mock_file'])) return true;
    if ($c['secret_key'] === '' || $c['webhook_secret'] === '') return false;
    foreach (BILLING_PLANS as $p) if (($c['prices'][$p]['month'] ?? '') === '' && ($c['prices'][$p]['year'] ?? '') === '') return false;
    return true;
}
function billingFile(): string { return DATA_DIR . '/billing.json'; }
function billingLoad(): array { return (array) (json_decode((string) @file_get_contents(billingFile()), true) ?: []); }
function billingSave(callable $fn): array {
    $f = billingFile(); $lock = @fopen($f . '.lock', 'c');
    if ($lock) flock($lock, LOCK_EX);
    $b = $fn(billingLoad());
    writeJsonAtomic($f, $b);
    if ($lock) { flock($lock, LOCK_UN); fclose($lock); }
    return $b;
}
function billingLog(array $row): void {
    @file_put_contents(DATA_DIR . '/billing.log', json_encode($row + ['at' => time()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}
/** which plan, interval and add-on a Stripe price id is, from the config */
function billingPriceOf(array $c, string $price): ?array {
    foreach ((array) $c['prices'] as $plan => $ivs) foreach ((array) $ivs as $iv => $id) if ($id !== '' && $id === $price) return [$plan, $iv];
    return null;
}
/** one Stripe API call: form-encoded, Bearer key. Returns the decoded answer, or ['error' => message] */
function stripeCall(array $c, string $method, string $path, array $fields = []): array {
    if (!empty($c['mock_file'])) {
        @file_put_contents($c['mock_file'] . '.requests.log', json_encode(['method' => $method, 'path' => $path, 'fields' => $fields], JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
        $canned = json_decode((string) @file_get_contents($c['mock_file']), true) ?: [];
        if (!empty($canned['fail'])) return ['error' => (string) $canned['fail']];
        if ($path === '/v1/checkout/sessions') return ['id' => 'cs_mock_' . bin2hex(random_bytes(6)), 'url' => 'https://checkout.stripe.test/c/pay/mock'];
        if ($path === '/v1/billing_portal/sessions') return ['id' => 'bps_mock', 'url' => 'https://billing.stripe.test/p/session/mock'];
        return ['id' => 'mock'];
    }
    $url = 'https://api.stripe.com' . $path;
    $q = http_build_query($fields);
    if ($method === 'GET' && $q !== '') { $url .= '?' . $q; $q = ''; }
    $ctx = stream_context_create(['http' => ['method' => $method, 'timeout' => (int) $c['timeout'], 'ignore_errors' => true,
        'header' => "Content-Type: application/x-www-form-urlencoded\r\nAuthorization: Bearer " . $c['secret_key'] . "\r\n",
        'content' => $q]]);
    $raw = @file_get_contents($url, false, $ctx);
    $code = 0; foreach (($http_response_header ?? []) as $h) if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $code = (int) $m[1];
    if ($raw === false || $code === 0) return ['error' => 'Could not reach Stripe. Try again.'];
    $j = json_decode((string) $raw, true);
    if (!is_array($j)) return ['error' => 'Stripe sent back something unreadable.'];
    if ($code >= 300) return ['error' => 'Stripe refused it' . (!empty($j['error']['message']) ? ': ' . $j['error']['message'] : '.')];
    return $j;
}
/** Stripe-Signature: "t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">" (one or more v1), within five minutes */
function stripeSigValid(string $secret, string $payload, string $header, ?int $now = null, int $tolerance = 300): bool {
    if ($secret === '' || $header === '') return false;
    $t = null; $sigs = [];
    foreach (explode(',', $header) as $part) {
        [$k, $v] = array_pad(explode('=', trim($part), 2), 2, '');
        if ($k === 't' && ctype_digit($v)) $t = (int) $v;
        if ($k === 'v1' && $v !== '') $sigs[] = $v;
    }
    if ($t === null || !$sigs || abs(($now ?? time()) - $t) > $tolerance) return false;
    $want = hash_hmac('sha256', $t . '.' . $payload, $secret);
    foreach ($sigs as $s) if (hash_equals($want, $s)) return true;
    return false;
}
/** the people who count as seats: every sign-in that is on, except the test sign-ins (names starting Claude or Fable) */
function billingSeatsUsed(array $rows): int {
    $n = 0;
    foreach ($rows as $r) if (empty($r['off']) && !preg_match('/^(Claude|Fable)\b/i', (string) ($r['name'] ?? ''))) $n++;
    return $n;
}
/** seats the plan pays for: the people it includes plus the extra seats (kept together in billing.json 'seats') */
function billingSeatsPaid(array $b, array $c): int {
    if (!in_array($b['status'] ?? '', BILLING_GOOD, true) && ($b['status'] ?? '') !== 'past_due') return 0;
    return max((int) ($b['seats'] ?? 0), (int) ($c['included'][$b['plan'] ?? ''] ?? 0));
}
/** does this install carry the edition uplift? Roofing and Solar (their data: hail, roofs, sun), unless the config says */
function billingUplift(array $c): bool {
    if ($c['uplift_on'] !== null) return (bool) $c['uplift_on'];
    return function_exists('feature') && (feature('roof') || feature('solar') || feature('hail'));
}
/** what a plan costs a month for this many people, in dollars, as the Billing screen and Stripe add it up */
function billingMonthly(array $c, string $plan, string $iv, int $seats, bool $addon): int {
    $d = $c['display']; $extra = max(0, $seats - (int) ($c['included'][$plan] ?? 0));
    $m = (int) ($d[$plan][$iv] ?? 0) + ($plan !== 'solo' ? $extra * (int) ($d[$plan . '_extra'][$iv] ?? 0) : 0);
    if (billingUplift($c)) $m += (int) ($d[$plan === 'solo' ? 'uplift_solo' : 'uplift'][$iv] ?? 0);
    if ($addon) $m += (int) ($d['addon'][$iv] ?? 0);
    return $m;
}
/** what the admin sees: the subscription, seats used against seats paid, and the one warning that applies */
function billingState(array $c, array $rows): array {
    $b = billingLoad(); $used = billingSeatsUsed($rows); $paid = billingSeatsPaid($b, $c);
    $st = (string) ($b['status'] ?? '');
    $warn = null;
    if ($st === 'past_due' || $st === 'unpaid') $warn = 'The last payment did not go through. Update the card in Manage billing.';
    elseif ($st === 'canceled') $warn = 'The plan was cancelled' . (!empty($b['ended']) ? ' on ' . date('j M Y', (int) $b['ended']) : '') . '. Pick a plan to carry on.';
    elseif (in_array($st, BILLING_GOOD, true) && $used > $paid) $warn = $used . ' people can sign in and the plan covers ' . $paid . '. Email billing@traverseplatforms.com to add seats, or remove people in Accounts.';
    elseif (!empty($b['cancel_at_end']) && !empty($b['period_end'])) $warn = 'The plan ends on ' . date('j M Y', (int) $b['period_end']) . ' (cancelled in Stripe). Manage billing turns it back on.';
    return [
        'ready' => billingConfigured($c), 'mock' => !empty($c['mock_file']),
        'plan' => $b['plan'] ?? null, 'interval' => $b['interval'] ?? null, 'seats' => $paid, 'used' => $used,
        'addon' => !empty($b['addon']), 'status' => $st ?: null, 'trialEnd' => $b['trial_end'] ?? null, 'periodEnd' => $b['period_end'] ?? null,
        'cancelAtEnd' => !empty($b['cancel_at_end']), 'portal' => !empty($b['customer']), 'pending' => !empty($b['pending']) && !$st,
        'warn' => $warn, 'founding' => !empty($c['founding']), 'trialDays' => !empty($c['founding']) ? (int) $c['trial_days'] : 0,
        'display' => $c['display'], 'included' => $c['included'], 'uplift' => billingUplift($c),
        'monthly' => in_array($b['plan'] ?? '', BILLING_PLANS, true) ? billingMonthly($c, (string) $b['plan'], (string) ($b['interval'] ?? 'month'), $paid, !empty($b['addon'])) : null,
        'offer' => array_values(array_filter(BILLING_PLANS, fn($p) => ($c['prices'][$p]['month'] ?? '') !== '' || ($c['prices'][$p]['year'] ?? '') !== '')),
        'intervals' => array_values(array_filter(['month', 'year'], function ($i) use ($c) { foreach (BILLING_PLANS as $p) if (($c['prices'][$p][$i] ?? '') !== '') return true; return false; })),
    ];
}
/** where Stripe sends people back: the config's return_url, else the page they came from on this same host (no query) */
function billingBack(array $c, string $from): ?string {
    if ($c['return_url'] !== '') return (string) $c['return_url'];
    $u = parse_url($from);
    if (!is_array($u) || !in_array($u['scheme'] ?? '', ['http', 'https'], true) || empty($u['host'])) return null;
    $host = strtolower((string) preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
    if ($host === '' || strtolower((string) $u['host']) !== $host) return null;
    return $u['scheme'] . '://' . $u['host'] . (isset($u['port']) ? ':' . $u['port'] : '') . ($u['path'] ?? '/');
}
/** the Checkout Session fields for a plan; returns [fields] or ['error' => ...] */
function billingCheckoutFields(array $c, array $b, string $plan, string $iv, int $seats, bool $addon, string $back): array {
    if (!in_array($plan, BILLING_PLANS, true)) return ['error' => 'Pick a plan.'];
    if (!in_array($iv, ['month', 'year'], true)) return ['error' => 'Pick monthly or yearly.'];
    $ivWord = $iv === 'year' ? 'yearly' : 'monthly';
    $price = (string) ($c['prices'][$plan][$iv] ?? '');
    if ($price === '') return ['error' => 'That plan is not offered ' . $ivWord . ' yet.'];
    if ($seats < 1 || $seats > BILLING_SEATS_MAX) return ['error' => 'People: 1 to ' . BILLING_SEATS_MAX . '.'];
    $inc = (int) ($c['included'][$plan] ?? 1);
    if ($plan === 'solo' && $seats > $inc) return ['error' => 'Solo is for one person. Crew covers up to ' . (int) $c['included']['crew'] . '.'];
    $f = ['mode' => 'subscription', 'client_reference_id' => $c['install'],
          'success_url' => $back . (str_contains($back, '?') ? '&' : '?') . 'billing=done',
          'cancel_url' => $back . (str_contains($back, '?') ? '&' : '?') . 'billing=cancel',
          'line_items' => [['price' => $price, 'quantity' => 1]],
          'metadata' => ['install' => $c['install'], 'plan' => $plan, 'interval' => $iv, 'seats' => (string) max($seats, $inc)],
          'subscription_data' => ['metadata' => ['install' => $c['install']]]];
    /* the agreement, on Stripe's page under the pay button (2026-10-13; draft pages until the review is done) */
    $f['custom_text'] = ['submit' => ['message' => 'By subscribing you agree to the Traverse Subscription Agreement (traverseplatforms.com/terms) and Privacy Policy (traverseplatforms.com/privacy).']];
    $add = function (string $key, int $qty) use (&$f, $c, $iv, $ivWord): ?string {
        $p = (string) ($c['prices'][$key][$iv] ?? '');
        if ($p === '') return $key;
        $f['line_items'][] = ['price' => $p, 'quantity' => $qty];
        return null;
    };
    if ($seats > $inc && $add($plan . '_extra', $seats - $inc)) return ['error' => 'Extra people are not offered ' . $ivWord . ' yet.'];
    if (billingUplift($c) && $add($plan === 'solo' ? 'uplift_solo' : 'uplift', 1)) return ['error' => 'This edition is not offered ' . $ivWord . ' yet.'];
    if ($addon && $add('addon', 1)) return ['error' => 'The second edition is not offered ' . $ivWord . ' yet.'];
    if (!empty($b['customer'])) $f['customer'] = (string) $b['customer'];
    /* the pilot only once: a company that has had a subscription here does not get another free trial */
    if (!empty($c['founding']) && (int) $c['trial_days'] > 0 && empty($b['subscription']) && empty($b['had_trial'])) $f['subscription_data']['trial_period_days'] = (int) $c['trial_days'];
    /* Stripe takes a coupon or a promotion-code box, not both; the founding coupon covers the whole plan (2026-10-26) */
    if (!empty($c['founding']) && $c['founding_coupon'] !== '') $f['discounts'] = [['coupon' => (string) $c['founding_coupon']]];
    else $f['allow_promotion_codes'] = 'true';
    return ['fields' => $f];
}
/** take one Stripe event; returns what was done, for the log ('' = not ours or nothing to do) */
function billingTakeEvent(array $c, array $ev): string {
    $type = (string) ($ev['type'] ?? ''); $o = (array) ($ev['data']['object'] ?? []); $id = (string) ($ev['id'] ?? '');
    $b = billingLoad();
    if ($id !== '' && in_array($id, (array) ($b['events'] ?? []), true)) return 'repeat';
    $ours = function (array $o) use ($c, $b): bool {
        if (($o['client_reference_id'] ?? null) === $c['install']) return true;
        if (($o['metadata']['install'] ?? null) === $c['install']) return true;
        if (($o['subscription_details']['metadata']['install'] ?? null) === $c['install']) return true;
        return !empty($b['customer']) && ($o['customer'] ?? null) === $b['customer'];
    };
    if (!$ours($o)) return '';
    $did = '';
    billingSave(function (array $b) use ($c, $type, $o, $id, &$did) {
        if ($type === 'checkout.session.completed') {
            $b['customer'] = (string) ($o['customer'] ?? ($b['customer'] ?? ''));
            if (!empty($o['subscription'])) $b['subscription'] = (string) $o['subscription'];
            $b['pending'] = true; $did = 'checkout';
        } elseif (in_array($type, ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'], true)) {
            /* an older subscription's late event never overwrites the newer one */
            if (!empty($b['subscription']) && ($o['id'] ?? '') !== $b['subscription'] && in_array($b['status'] ?? '', BILLING_GOOD, true) && $type !== 'customer.subscription.created') { $did = 'old subscription'; return $b; }
            $b['subscription'] = (string) ($o['id'] ?? ''); $b['customer'] = (string) ($o['customer'] ?? ($b['customer'] ?? ''));
            $b['status'] = $type === 'customer.subscription.deleted' ? 'canceled' : (string) ($o['status'] ?? '');
            $plan = null; $iv = null; $extra = 0; $addon = false; $uplift = false; $end = null;
            foreach ((array) ($o['items']['data'] ?? []) as $it) {
                $p = billingPriceOf($c, (string) ($it['price']['id'] ?? ''));
                if (!$p) continue;
                if ($p[0] === 'addon') { $addon = true; continue; }
                if (str_starts_with($p[0], 'uplift')) { $uplift = true; continue; }
                if (str_ends_with($p[0], '_extra')) { $extra = (int) ($it['quantity'] ?? 0); continue; }
                [$plan, $iv] = $p;
                if (!empty($it['current_period_end'])) $end = (int) $it['current_period_end'];   /* newer API versions keep it on the item */
            }
            if ($plan) { $b['plan'] = $plan; $b['interval'] = $iv; $b['seats'] = (int) ($c['included'][$plan] ?? 1) + $extra; $b['addon'] = $addon; $b['uplift'] = $uplift; }
            $b['period_end'] = (int) ($o['current_period_end'] ?? $end ?? 0) ?: null;
            $b['trial_end'] = !empty($o['trial_end']) ? (int) $o['trial_end'] : null;
            if (!empty($o['trial_end'])) $b['had_trial'] = true;
            $b['cancel_at_end'] = !empty($o['cancel_at_period_end']);
            if ($type === 'customer.subscription.deleted') $b['ended'] = (int) ($o['ended_at'] ?? time());
            unset($b['pending']); $did = $b['status'];
        } elseif ($type === 'invoice.payment_failed' || $type === 'invoice.paid') {
            $b['last_invoice'] = ['paid' => $type === 'invoice.paid', 'amount' => (int) ($o['amount_due'] ?? 0), 'at' => time()];
            $did = $type === 'invoice.paid' ? 'paid' : 'payment failed';
        } else { $did = ''; return $b; }
        $b['updated'] = time();
        if ($id !== '') { $b['events'] = array_slice(array_merge((array) ($b['events'] ?? []), [$id]), -100); }
        return $b;
    });
    return $did;
}
