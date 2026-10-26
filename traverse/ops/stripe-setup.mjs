/* Stripe setup for Traverse billing: the products, prices, founding coupon and customer-portal settings that api/billing.php
   expects (see api/billing-config.example.php). Safe to run again: prices are found by lookup_key, products by metadata, the
   coupon by id, so nothing is made twice.
     node traverse/ops/stripe-setup.mjs            # test mode, key from ~/.ssh/stripe-test.json
     STRIPE_KEYFILE=<path> node traverse/ops/stripe-setup.mjs   # another key file (live mode later, same shape)
   Prints the price ids and coupon id as the 'prices' / 'founding_coupon' block for <install>-private/billing-config.php.
   Never prints the key.

   The plans (Matthew 2026-10-26, traverse/research/pricing-2026-10-26/PRICING-RECOMMENDATION.md), per company with people
   included; yearly = the per-month figure times 12, charged once a year:
     Solo $99 / $79 (1 person) · Crew $249 / $199 (up to 5) · Team $549 / $449 (up to 12)
     extra person: Crew $45 / $35, Team $39 / $29 · Roofing and Solar uplift: $20 on Solo, $50 on Crew and Team
     second edition $99 · founding: 25% off the whole plan for 12 months.
   The first plans (2026-10-13: Duo, per-person Crew and Pro, second edition per person; lookup keys traverse_<plan>_<iv>) are
   switched off here (active=false), so nobody can be sold them again; a subscription already on them keeps running. */
import { readFileSync } from 'node:fs'; import { homedir } from 'node:os'; import { join } from 'node:path';
const keyFile = process.env.STRIPE_KEYFILE || join(homedir(), '.ssh', 'stripe-test.json');
const K = JSON.parse(readFileSync(keyFile, 'utf8')).secret;
if (!/^sk_(test|live)_/.test(K)) throw new Error('no Stripe secret key in ' + keyFile);
const LIVE = K.startsWith('sk_live_');

async function api(method, path, params) {
  const body = params ? new URLSearchParams(flat(params)).toString() : undefined;
  const url = 'https://api.stripe.com/v1' + path + (method === 'GET' && body ? '?' + body : '');
  const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + K, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' }, body: method === 'GET' ? undefined : body });
  const j = await r.json(); if (j.error) { const e = new Error(path + ': ' + j.error.message); e.code = j.error.code; throw e; } return j;
}
function flat(o, pre = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    const key = pre ? pre + '[' + k + ']' : k;
    if (v && typeof v === 'object') flat(v, key, out); else if (v !== undefined) out[key] = String(v);
  }
  return out;
}

/* key = billing.php's price key; month / year = dollars per month */
const PRICES = [
  { key: 'solo', name: 'Traverse Solo', desc: 'One person, with the trade edition\'s data.', month: 99, year: 79 },
  { key: 'crew', name: 'Traverse Crew', desc: 'Up to 5 people, with the trade edition\'s data.', month: 249, year: 199 },
  { key: 'team', name: 'Traverse Team', desc: 'Up to 12 people, with the trade edition\'s data.', month: 549, year: 449 },
  { key: 'crew_extra', name: 'Traverse Crew: extra person', desc: 'Each person past the 5 that Crew includes.', unit: 'person', month: 45, year: 35 },
  { key: 'team_extra', name: 'Traverse Team: extra person', desc: 'Each person past the 12 that Team includes.', unit: 'person', month: 39, year: 29 },
  { key: 'uplift_solo', name: 'Traverse Roofing or Solar edition (Solo)', desc: 'The Roofing or Solar edition\'s data on Solo.', month: 20, year: 20 },
  { key: 'uplift', name: 'Traverse Roofing or Solar edition', desc: 'The Roofing or Solar edition\'s data on Crew or Team.', month: 50, year: 50 },
  { key: 'addon', name: 'Traverse second edition', desc: 'A second trade edition on the same account.', month: 99, year: 99 }
];
const LK = (key, iv) => 'traverse_v2_' + key + '_' + iv;

const out = { prices: {}, founding_coupon: '' };
for (const p of PRICES) {
  out.prices[p.key] = {};
  const found = await api('GET', '/prices', { 'lookup_keys[0]': LK(p.key, 'month'), 'lookup_keys[1]': LK(p.key, 'year'), active: 'true', limit: 10 });
  let product = found.data[0] ? found.data[0].product : null;
  if (!product) {
    const s = await api('GET', '/products/search', { query: "metadata['traverse_v2']:'" + p.key + "'" });
    product = s.data[0] ? s.data[0].id : (await api('POST', '/products', { name: p.name, description: p.desc, metadata: { traverse_v2: p.key }, ...(p.unit ? { unit_label: p.unit } : {}) })).id;
  }
  for (const iv of ['month', 'year']) {
    const have = found.data.find((x) => x.lookup_key === LK(p.key, iv));
    if (have) { out.prices[p.key][iv] = have.id; continue; }
    const cents = (iv === 'month' ? p.month : p.year * 12) * 100;
    const pr = await api('POST', '/prices', { product, currency: 'usd', unit_amount: cents, recurring: { interval: iv }, lookup_key: LK(p.key, iv), nickname: p.name + (iv === 'month' ? ', monthly' : ', yearly'), metadata: { traverse_v2: p.key } });
    out.prices[p.key][iv] = pr.id;
  }
}

/* the first plans: off, so they can't be sold again */
let retired = 0;
for (const k of ['duo', 'crew', 'pro', 'addon']) for (const iv of ['month', 'year']) {
  const f = await api('GET', '/prices', { 'lookup_keys[0]': 'traverse_' + k + '_' + iv, active: 'true', limit: 1 });
  for (const pr of f.data) { await api('POST', '/prices/' + pr.id, { active: 'false' }); retired++; }
}

/* the founding coupon: 25% off the whole plan for 12 months */
const CID = 'traverse-founding-25';
try { out.founding_coupon = (await api('GET', '/coupons/' + CID)).id; }
catch (e) { out.founding_coupon = (await api('POST', '/coupons', { id: CID, name: 'Founding company: 25% off, first year', percent_off: 25, duration: 'repeating', duration_in_months: 12 })).id; }

/* the customer portal: card, invoices, cancelling. Plan and seat changes are off: Stripe's portal cannot change a subscription
   made of several prices, so they go through Traverse (billing@traverseplatforms.com). */
const confs = await api('GET', '/billing_portal/configurations', { limit: 20 });
const mine = confs.data.find((c) => c.metadata && c.metadata.traverse === '1');
const portal = {
  business_profile: { headline: 'Traverse: card and invoices. Plan changes: billing@', privacy_policy_url: 'https://traverseplatforms.com/privacy/', terms_of_service_url: 'https://traverseplatforms.com/terms/' },
  features: {
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    customer_update: { enabled: true, allowed_updates: { 0: 'email', 1: 'address', 2: 'name' } },
    subscription_cancel: { enabled: true, mode: 'at_period_end' },
    subscription_update: { enabled: false, products: '' }   /* '' clears the first plans' price list, which Stripe still checks */
  },
  metadata: { traverse: '1' }
};
const conf = mine ? await api('POST', '/billing_portal/configurations/' + mine.id, portal) : await api('POST', '/billing_portal/configurations', portal);

console.log(LIVE ? 'LIVE MODE' : 'test mode');
console.log('first plans switched off:', retired);
console.log('portal configuration:', conf.id, conf.is_default ? '(default)' : '(not the default)');
console.log("'prices' => " + JSON.stringify(out.prices, null, 2).replace(/"/g, "'").replace(/:/g, ' =>').replace(/\{/g, '[').replace(/\}/g, ']') + ',');
console.log("'founding_coupon' => '" + out.founding_coupon + "',");
