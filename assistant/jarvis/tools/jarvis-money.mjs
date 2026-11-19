// J.A.R.V.I.S. money panel (2026-11-19, P-8 step 6): totals only, kept on this laptop in %LOCALAPPDATA%/ProjectBackup/jarvis/ and sent up by
// jarvis-status.sh inside status.json. Never a card, a key, a customer's name, or Matthew's pay (personal/pay is private and never read here).
//
//   node assistant/jarvis/tools/jarvis-money.mjs ledger < expenses.json
//       the Spend Ledger (claude.ai artifact HkpfBRs3xfzaHUcYkymiw2, db "expenses"; the server cannot reach it): a Claude session reads the
//       collection (db_list) and pipes the documents in, as a JSON array of {data} or of the data itself. Writes money-ledger.json:
//       subscriptions a month (monthly + yearly/12, active only), one-off purchases, planned, a month per company. Run it after any ledger change.
//   node assistant/jarvis/tools/jarvis-money.mjs stripe [--force]
//       Traverse's Stripe, READ ONLY: GET /v1/balance and this month's charges, with the restricted key already on this laptop
//       (~/.ssh/stripe-live.json; STRIPE_KEYFILE to point elsewhere). At most every 25 minutes. Writes stripe.json: dollars only.
//   node assistant/jarvis/tools/jarvis-money.mjs show      what would go up
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.JARVIS_DIR || path.join(process.env.LOCALAPPDATA || '.', 'ProjectBackup', 'jarvis');
fs.mkdirSync(DIR, { recursive: true });
const LEDGER = path.join(DIR, 'money-ledger.json'), STRIPE = path.join(DIR, 'stripe.json');
const r2 = n => Math.round(n * 100) / 100;
const cmd = process.argv[2] || 'show';

if (cmd === 'ledger') {
  let raw = ''; for await (const c of process.stdin) raw += c;
  let docs = JSON.parse(raw); if (!Array.isArray(docs)) docs = docs.documents || docs.items || [];
  const rows = docs.map(d => d && d.data ? d.data : d).filter(d => d && typeof d === 'object');
  const out = { monthly: 0, yearly: 0, once: 0, planned: 0, items: 0, byEntity: {}, asOf: new Date().toISOString().slice(0, 10) };
  for (const d of rows) {
    const amt = typeof d.amount === 'number' ? d.amount : null; if (amt == null) continue;
    if (d.status === 'cancelled') continue;
    const perMonth = d.kind === 'monthly' ? amt : d.kind === 'yearly' ? amt / 12 : 0;
    if (d.status === 'planned') { out.planned += perMonth; continue; }
    out.items++;
    if (d.kind === 'monthly') out.monthly += amt; else if (d.kind === 'yearly') out.yearly += amt; else if (d.kind === 'once') out.once += amt;
    const e = ['surge', 'sixfold', 'a365', 'traverse'].includes(d.entity) ? d.entity : 'unsorted';
    if (perMonth) out.byEntity[e] = (out.byEntity[e] || 0) + perMonth;
  }
  out.perMonth = r2(out.monthly + out.yearly / 12);
  for (const k of ['monthly', 'yearly', 'once', 'planned']) out[k] = r2(out[k]);
  for (const k of Object.keys(out.byEntity)) out.byEntity[k] = r2(out.byEntity[k]);
  fs.writeFileSync(LEDGER, JSON.stringify(out));
  console.log('ledger summary saved: about $' + out.perMonth + ' a month in subscriptions, ' + out.items + ' items');
} else if (cmd === 'stripe') {
  let old = {}; try { old = JSON.parse(fs.readFileSync(STRIPE, 'utf8')); } catch {}
  if (!process.argv.includes('--force') && Date.now() / 1000 - (old.at || 0) < 25 * 60) process.exit(0);
  const kf = process.env.STRIPE_KEYFILE || path.join(process.env.USERPROFILE || '', '.ssh', 'stripe-live.json');
  let key = ''; try { key = String(JSON.parse(fs.readFileSync(kf, 'utf8')).secret || ''); } catch {}
  const out = { at: Math.floor(Date.now() / 1000) };
  if (!/^(rk|sk)_live_/.test(key)) { out.error = 'no Stripe key on this laptop'; }
  else {
    const get = async u => { const r = await fetch('https://api.stripe.com' + u, { headers: { Authorization: 'Bearer ' + key } }); const j = await r.json().catch(() => ({})); return [r.status, j]; };
    try {
      const [s1, b] = await get('/v1/balance');
      if (s1 === 200) { const usd = a => r2((a || []).filter(x => x.currency === 'usd').reduce((t, x) => t + x.amount, 0) / 100); out.available = usd(b.available); out.pending = usd(b.pending); }
      else out.error = s1 === 403 || s1 === 401 ? 'the key cannot read the balance' : 'Stripe answered ' + s1;
      const d = new Date(); const from = Math.floor(new Date(d.getFullYear(), d.getMonth(), 1).getTime() / 1000);
      let total = 0, n = 0, after = '', more = true, pages = 0;
      while (more && pages++ < 10) {
        const [s2, c] = await get('/v1/charges?limit=100&created[gte]=' + from + (after ? '&starting_after=' + after : ''));
        if (s2 !== 200) { out.error = out.error || (s2 === 403 || s2 === 401 ? 'the key cannot read charges' : 'Stripe answered ' + s2); break; }
        for (const x of c.data || []) { if (x.paid && x.status === 'succeeded' && x.currency === 'usd') { total += x.amount - (x.amount_refunded || 0); n++; } after = x.id; }
        more = !!c.has_more;
      }
      if (!out.error || out.available != null) { out.month = r2(total / 100); out.charges = n; }
    } catch (e) { out.error = 'Stripe did not answer'; }
  }
  fs.writeFileSync(STRIPE, JSON.stringify(out));
} else if (cmd === 'show') {
  const rd = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  console.log(JSON.stringify({ ledger: rd(LEDGER), stripe: rd(STRIPE) }, null, 1));
} else { console.log('usage: jarvis-money.mjs ledger < expenses.json | stripe [--force] | show'); process.exit(1); }
