<?php
/**
 * Template for sixfold-private/billing-config.php (each install's own private folder) — copy it, fill it in, never commit the copy.
 * Billing (api/billing.php). Stripe is the provider; nothing about cards touches this server.
 *
 * In Stripe (once, for all installs):
 *   1. Products and prices: Duo (per crew), Crew (per person), Pro (per person), Second edition (per person, Pro only),
 *      each with a monthly and a yearly price. Paste the price ids (price_...) below.
 *   2. A coupon for founding companies: 30% off, duration "repeating", 12 months. Paste its id below.
 *   3. Customer portal (Settings -> Billing -> Customer portal): allow updating the card, switching plans, changing the
 *      quantity and cancelling.
 * For this install:
 *   4. Developers -> Webhooks -> Add endpoint: this install's API URL with ?action=billinghook, e.g.
 *      https://traverseplatforms.com/api/traverse-rounds.php?action=billinghook
 *      Events: checkout.session.completed, customer.subscription.created, customer.subscription.updated,
 *      customer.subscription.deleted, invoice.paid, invoice.payment_failed. Paste its signing secret below.
 *   5. company.json: "features": {"billing": true} shows the Billing tile to admins.
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
    'prices' => [
        'duo'   => ['month' => 'price_...', 'year' => 'price_...'],
        'crew'  => ['month' => 'price_...', 'year' => 'price_...'],
        'pro'   => ['month' => 'price_...', 'year' => 'price_...'],
        'addon' => ['month' => 'price_...', 'year' => 'price_...'],
    ],
    // What the Billing screen shows, dollars per person (Duo: per crew) per month; "year" = per month, billed yearly.
    // Keep it equal to the Stripe prices.
    'display' => [
        'duo'   => ['month' => 129, 'year' => 99],
        'crew'  => ['month' => 45,  'year' => 35],
        'pro'   => ['month' => 89,  'year' => 69],
        'addon' => ['month' => 20,  'year' => 20],
    ],
    // A founding company: a free pilot of trial_days before the first charge (once), and founding_coupon on Pro.
    'founding'        => false,
    'trial_days'      => 14,
    'founding_coupon' => '',
    // Where Stripe sends people back after paying or managing billing. Empty = the app page they came from.
    'return_url'      => '',
];
