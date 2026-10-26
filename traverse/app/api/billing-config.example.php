<?php
/**
 * Template for sixfold-private/billing-config.php (each install's own private folder) — copy it, fill it in, never commit the copy.
 * Billing (api/billing.php). Stripe is the provider; nothing about cards touches this server.
 *
 * In Stripe (once, for all installs):
 *   1. Products, prices, the founding coupon and the customer portal: run traverse/ops/stripe-setup.mjs (test key first). It
 *      prints the 'prices' and 'founding_coupon' blocks for below. The plans (2026-10-26): Solo, Crew and Team per company with
 *      people included, an extra-person price on Crew and Team, the Roofing/Solar uplift (Solo's and the others'), the second
 *      edition; each monthly and yearly. Coupon: 25% off the whole plan, 12 months.
 *   2. The portal takes the card, invoices and cancelling. Plan and seat changes are off there (Stripe cannot change a
 *      subscription made of several prices); they go through billing@traverseplatforms.com.
 * For this install:
 *   3. Developers -> Webhooks -> Add endpoint: this install's API URL with ?action=billinghook, e.g.
 *      https://traverseplatforms.com/api/traverse-rounds.php?action=billinghook
 *      Events: checkout.session.completed, customer.subscription.created, customer.subscription.updated,
 *      customer.subscription.deleted, invoice.paid, invoice.payment_failed. Paste its signing secret below.
 *   4. company.json: "features": {"billing": true} shows the Billing tile to admins.
 *
 * Leave 'display', 'included' and 'uplift_on' out unless they must differ from billing.php's defaults: this file is merged over
 * them, so an old copy here would win over a price change made there.
 *
 * Environment variables override this file: SIXFOLD_BILLING_KEY, SIXFOLD_BILLING_HOOK, SIXFOLD_BILLING_INSTALL,
 * SIXFOLD_BILLING_FOUNDING=1.
 */
return [
    // Stripe Dashboard -> Developers -> API keys. Start with the test key (sk_test_...) and test prices.
    'secret_key'      => 'sk_test_PASTE-HERE',
    // The signing secret of THIS install's webhook endpoint.
    'webhook_secret'  => 'whsec_PASTE-HERE',
    // This install's key (Stripe events carry it). Empty = the data folder's name, which is already unique per install.
    'install'         => '',
    // From stripe-setup.mjs.
    'prices' => [
        'solo'        => ['month' => 'price_...', 'year' => 'price_...'],
        'crew'        => ['month' => 'price_...', 'year' => 'price_...'],
        'team'        => ['month' => 'price_...', 'year' => 'price_...'],
        'crew_extra'  => ['month' => 'price_...', 'year' => 'price_...'],
        'team_extra'  => ['month' => 'price_...', 'year' => 'price_...'],
        'uplift_solo' => ['month' => 'price_...', 'year' => 'price_...'],
        'uplift'      => ['month' => 'price_...', 'year' => 'price_...'],
        'addon'       => ['month' => 'price_...', 'year' => 'price_...'],
    ],
    // A founding company: a free pilot of trial_days before the first charge (once), and founding_coupon on the whole plan.
    'founding'        => false,
    'trial_days'      => 14,
    'founding_coupon' => 'traverse-founding-25',
    // Where Stripe sends people back after paying or managing billing. Empty = the app page they came from.
    'return_url'      => '',
];
