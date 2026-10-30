/* Founding prices as real Stripe prices (Matthew 2026-10-29: "since the founder price is going to stay active for awhile we might as well
   on stripes end, make that price what the founders price is, but leave the full amount slashed through showing the discount on the
   website"). Beside each list price traverse_v2_<key>_<month|year> (stripe-setup.mjs) this makes traverse_v2f_<key>_<month|year> on the
   same product, at the founding figure billing.php shows: each part round(list x 0.75) in whole dollars; yearly = that per-month figure
   x 12, charged once a year. Safe to run again: prices are found by lookup_key, so nothing is made twice. Never prints the key.
     node traverse/ops/stripe-founding-prices.mjs                                   # test mode (~/.ssh/stripe-test.json)
     STRIPE_KEYFILE=~/.ssh/stripe-live.json node traverse/ops/stripe-founding-prices.mjs   # live
   Writes the ids to traverse/ops/stripe-founding-prices.<test|live>.json for billing-config.php ('prices_founding'). */
import { readFileSync, writeFileSync } from 'node:fs'; import { homedir } from 'node:os'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const keyFile = process.env.STRIPE_KEYFILE || join(homedir(), '.ssh', 'stripe-test.json');
const K = JSON.parse(readFileSync(keyFile, 'utf8')).secret;
if (!/^[sr]k_(test|live)_/.test(K)) throw new Error('no Stripe secret key in ' + keyFile);
const LIVE = /^[sr]k_live_/.test(K);
async function api(method, path, params) {
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const url = 'https://api.stripe.com/v1' + path + (method === 'GET' && body ? '?' + body : '');
  const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + K, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' }, body: method === 'GET' ? undefined : body });
  const j = await r.json(); if (j.error) throw new Error(path + ': ' + j.error.message); return j;
}
/* dollars per month, list (billing.php defaults) */
const LIST = { solo: [99, 79], crew: [249, 199], team: [549, 449], crew_extra: [45, 35], team_extra: [39, 29], addon: [99, 99] };
const PCT = 25;
const out = {};
for (const [key, [m, y]] of Object.entries(LIST)) {
  out[key] = {};
  for (const [iv, perMonth] of [['month', m], ['year', y]]) {
    const listKey = 'traverse_v2_' + key + '_' + iv, fKey = 'traverse_v2f_' + key + '_' + iv;
    const fMonth = Math.round(perMonth * (100 - PCT) / 100), cents = (iv === 'year' ? fMonth * 12 : fMonth) * 100;
    const found = (await api('GET', '/prices', { 'lookup_keys[]': fKey, active: 'true' })).data[0];
    if (found) {
      if (found.unit_amount !== cents) throw new Error(fKey + ' exists at ' + found.unit_amount + ' cents, expected ' + cents);
      out[key][iv] = found.id; console.log('kept   ', fKey, '$' + cents / 100, found.id); continue;
    }
    const list = (await api('GET', '/prices', { 'lookup_keys[]': listKey, active: 'true' })).data[0];
    if (!list) throw new Error('no list price ' + listKey + ': run stripe-setup.mjs first');
    const p = await api('POST', '/prices', { product: list.product, currency: 'usd', unit_amount: String(cents), 'recurring[interval]': iv,
      lookup_key: fKey, nickname: 'Founding ' + key + ' ' + iv + ' (' + PCT + '% off $' + (iv === 'year' ? perMonth * 12 : perMonth) + ')', 'metadata[founding]': '1', 'metadata[list_price]': list.id });
    out[key][iv] = p.id; console.log('made   ', fKey, '$' + cents / 100, p.id);
  }
}
const file = join(dirname(fileURLToPath(import.meta.url)), 'stripe-founding-prices.' + (LIVE ? 'live' : 'test') + '.json');
writeFileSync(file, JSON.stringify(out, null, 2) + '\n'); console.log((LIVE ? 'LIVE' : 'TEST') + ' ids written to', file);
