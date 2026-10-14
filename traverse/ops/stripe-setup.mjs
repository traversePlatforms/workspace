/* Stripe setup for Traverse billing (2026-10-13): the products, prices, founding coupon and customer-portal settings that
   api/billing.php expects (see api/billing-config.example.php). Safe to run again: prices are found by lookup_key, the
   coupon by id, so nothing is made twice.
     node traverse/ops/stripe-setup.mjs            # test mode, key from ~/.ssh/stripe-test.json
     STRIPE_KEYFILE=<path> node traverse/ops/stripe-setup.mjs   # another key file (live mode later, same shape)
   Prints the price ids and coupon id as the 'prices' / 'founding_coupon' block for <install>-private/billing-config.php.
   Never prints the key. Prices match traverseplatforms.com (read 2026-10-13): Duo $129/mo or $99/mo billed yearly (per
   crew, up to 2 people); Crew $45 or $35 per person; Pro $89 or $69 per person; second edition $20 per person on Pro. */
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

const PLANS = [
  { key: 'duo', name: 'Traverse Duo', desc: 'For one- and two-person crews. Billed per crew.', unit: 'crew', month: 129, year: 99 },
  { key: 'crew', name: 'Traverse Crew', desc: 'The app on every phone in the team. Billed per person.', unit: 'person', month: 45, year: 35 },
  { key: 'pro', name: 'Traverse Pro', desc: 'Everything your trade\'s edition can do. Billed per person.', unit: 'person', month: 89, year: 69 },
  { key: 'addon', name: 'Traverse second edition', desc: 'A second trade edition on Pro. Billed per person.', unit: 'person', month: 20, year: 20 }
];

const out = { prices: {}, founding_coupon: '' }; const productIds = [];
for (const p of PLANS) {
  out.prices[p.key] = {};
  const lk = { month: 'traverse_' + p.key + '_month', year: 'traverse_' + p.key + '_year' };
  const found = await api('GET', '/prices', { 'lookup_keys[0]': lk.month, 'lookup_keys[1]': lk.year, active: 'true', limit: 10 });
  let product = found.data[0] ? found.data[0].product : null;
  if (!product) product = (await api('POST', '/products', { name: p.name, description: p.desc, metadata: { traverse_plan: p.key }, unit_label: p.unit })).id;
  productIds.push(product);
  for (const iv of ['month', 'year']) {
    const have = found.data.find((x) => x.lookup_key === lk[iv]);
    if (have) { out.prices[p.key][iv] = have.id; continue; }
    const cents = (iv === 'month' ? p.month : p.year * 12) * 100;   /* yearly: the per-month figure times 12, charged once a year */
    const pr = await api('POST', '/prices', { product, currency: 'usd', unit_amount: cents, recurring: { interval: iv }, lookup_key: lk[iv], nickname: p.name + (iv === 'month' ? ', monthly' : ', yearly'), metadata: { traverse_plan: p.key } });
    out.prices[p.key][iv] = pr.id;
  }
}

/* the founding coupon: 30% off for 12 months (applied to Pro by billing.php) */
const CID = 'traverse-founding-30';
try { out.founding_coupon = (await api('GET', '/coupons/' + CID)).id; }
catch (e) { out.founding_coupon = (await api('POST', '/coupons', { id: CID, name: 'Founding: 30% off Pro, first year', percent_off: 30, duration: 'repeating', duration_in_months: 12 })).id; }

/* the customer portal: card, plan and seat changes, cancelling, invoices */
const portalProducts = {};
PLANS.forEach((p, i) => { portalProducts[i] = { product: productIds[i], prices: { 0: out.prices[p.key].month, 1: out.prices[p.key].year } }; });
const confs = await api('GET', '/billing_portal/configurations', { limit: 20 });
const mine = confs.data.find((c) => c.metadata && c.metadata.traverse === '1');
const portal = {
  business_profile: { headline: 'Traverse: your plan, seats, card and invoices', privacy_policy_url: 'https://traverseplatforms.com/privacy/', terms_of_service_url: 'https://traverseplatforms.com/terms/' },   /* 2026-10-13 */
  features: {
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    customer_update: { enabled: true, allowed_updates: { 0: 'email', 1: 'address', 2: 'name' } },
    subscription_cancel: { enabled: true, mode: 'at_period_end' },
    subscription_update: { enabled: true, default_allowed_updates: { 0: 'price', 1: 'quantity' }, proration_behavior: 'create_prorations', products: portalProducts }
  },
  metadata: { traverse: '1' }
};
const conf = mine ? await api('POST', '/billing_portal/configurations/' + mine.id, portal) : await api('POST', '/billing_portal/configurations', portal);

console.log(LIVE ? 'LIVE MODE' : 'test mode');
console.log('portal configuration:', conf.id, conf.is_default ? '(default)' : '(not the default)');
console.log("'prices' => " + JSON.stringify(out.prices, null, 2).replace(/"/g, "'").replace(/:/g, ' =>').replace(/\{/g, '[').replace(/\}/g, ']') + ',');
console.log("'founding_coupon' => '" + out.founding_coupon + "',");
