/* Plan names and the yearly top plan (Matthew 2026-10-30): "Crew" is also a job role, so the plans read Solo / Team / Company
   (billing.php keys stay solo / crew / team: only the names customers see change); and "Pay yearly, save 20%" must be true on every
   plan, so the top plan's yearly price goes from $449 to $439 a month ($549 x 0.8), founding round(439 x 0.75) = $329.
   Renames the products, makes the two new yearly prices with the old lookup keys moved onto them (transfer_lookup_key), and turns
   the old two off. Safe to run again. Never prints the key.
     node traverse/ops/stripe-plans-1030.mjs                                         # test (~/.ssh/stripe-test.json)
     STRIPE_KEYFILE=~/.ssh/stripe-live.json node traverse/ops/stripe-plans-1030.mjs  # live
   Writes the new ids to traverse/ops/stripe-plans-1030.<test|live>.json. */
import { readFileSync, writeFileSync } from 'node:fs'; import { homedir } from 'node:os'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const keyFile = process.env.STRIPE_KEYFILE || join(homedir(), '.ssh', 'stripe-test.json');
const K = JSON.parse(readFileSync(keyFile, 'utf8')).secret;
if (!/^[sr]k_(test|live)_/.test(K)) throw new Error('no Stripe secret key in ' + keyFile);
const LIVE = /^[sr]k_live_/.test(K);
async function api(method, path, params) {
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const r = await fetch('https://api.stripe.com/v1' + path + (method === 'GET' && body ? '?' + body : ''), { method, headers: { Authorization: 'Bearer ' + K, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' }, body: method === 'GET' ? undefined : body });
  const j = await r.json(); if (j.error) throw new Error(path + ': ' + j.error.message); return j;
}
const price = async (key) => (await api('GET', '/prices', { 'lookup_keys[]': key, 'expand[]': 'data.product' })).data[0];
/* names: by the product behind each key, so a second run finds them renamed already */
const NAMES = { traverse_v2_crew_month: 'Traverse Team', traverse_v2_team_month: 'Traverse Company', traverse_v2_crew_extra_month: 'Traverse Team: extra person', traverse_v2_team_extra_month: 'Traverse Company: extra person' };
for (const [key, name] of Object.entries(NAMES)) {
  const p = await price(key); if (!p) throw new Error('no price ' + key);
  if (p.product.name === name) { console.log('name ok   ', name); continue; }
  await api('POST', '/products/' + p.product.id, { name }); console.log('renamed   ', p.product.name, '->', name);
}
const out = {};
for (const [key, cents, nick] of [['traverse_v2_team_year', 439 * 12 * 100, 'Company yearly ($439/mo x 12)'], ['traverse_v2f_team_year', 329 * 12 * 100, 'Founding Company yearly (25% off $439/mo x 12)']]) {
  const old = await price(key); if (!old) throw new Error('no price ' + key);
  if (old.unit_amount === cents) { out[key] = old.id; console.log('price ok  ', key, '$' + cents / 100, old.id); continue; }
  const p = await api('POST', '/prices', { product: old.product.id, currency: 'usd', unit_amount: String(cents), 'recurring[interval]': 'year', lookup_key: key, transfer_lookup_key: 'true', nickname: nick, ...(key.startsWith('traverse_v2f_') ? { 'metadata[founding]': '1' } : {}) });
  await api('POST', '/prices/' + old.id, { active: 'false' });
  out[key] = p.id; console.log('new price ', key, '$' + old.unit_amount / 100, '->', '$' + cents / 100, p.id, '(old turned off)');
}
const file = join(dirname(fileURLToPath(import.meta.url)), 'stripe-plans-1030.' + (LIVE ? 'live' : 'test') + '.json');
writeFileSync(file, JSON.stringify(out, null, 2) + '\n'); console.log((LIVE ? 'LIVE' : 'TEST') + ' ids written to', file);
