// Batch 1 of the free-map email (Matthew 6 Nov: "start with the 152 new ones"): every new prospect with a lawn or roofing
// trade and a verified (or accept-all) email, written out in full with its town's numbers from the town report stats.
// Emails stay in new152-contacts.csv (gitignored); this review file shows company, town and the message only.
//   node traverse/research/prospects/build-new152-batch.mjs  -> ../../prospect-desk/drafts/new152-batch1-DRAFT.md
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const parse = (l) => { const o = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ',') { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const rows = readFileSync(join(HERE, 'new152-contacts.csv'), 'utf8').trim().split(/\r?\n/).slice(1).map(parse)
  .map(([company, trade, city, formed, website, phone, email, from, verified]) => ({ company, trade, city, formed, email, verified }))
  .filter((r) => r.email && ['valid', 'accept_all'].includes(r.verified) && ['yards', 'roofing'].includes(r.trade));
const st = JSON.parse(readFileSync(join(HERE, '../../prospect-desk/town-report/out/town-stats.json'), 'utf8'));
const stats = Array.isArray(st) ? st : Object.values(st);
const fmt = (n) => Number(n).toLocaleString('en-US');
const clean = (s) => s.replace(/,?\s*\b(l\.?\s?l\.?\s?c\.?|inc\.?|co\.?|corp\.?|ltd\.?)$/i, '').replace(/\b([A-Z])([A-Z]+)\b/g, (m, a, b) => a + b.toLowerCase()).trim();

function find(city, trade) {
  const c = city.toLowerCase();
  return stats.find((a) => a.trade === trade && a.label.toLowerCase() === c) || null;
}
const out = [`# Free-map email, batch 1: the new prospects (DRAFT, ${new Date().toISOString().slice(0, 10)})`, '',
  'Matthew 6 Nov: start with the 152 companies new on the register since 11 Oct. 18 of them have a website, 13 a phone, **16 an email** (Hunter-verified: 14 valid, 1 accept-all, 1 invalid). Lawn and roofing only below; the one solar company waits for a solar version.',
  '', '**Status: for Matthew\'s review. Nothing loaded into the Prospect Desk, nothing queued or sent.** Addresses are in `traverse/research/prospects/new152-contacts.csv` (gitignored). No names are known, so the greeting is "Hi there". Signature, postal address and unsubscribe line are added by the desk as usual.', ''];
let i = 0; const held = [];
for (const r of rows) {
  const trade = r.trade === 'yards' ? 'lawn' : 'roofing';
  const s = find(r.city, trade);
  if (!s) { held.push(`${clean(r.company)} (${trade}, ${r.city}): no ${trade} map for this town yet`); continue; }
  let subject, body;
  if (trade === 'lawn') {
    subject = `${r.city} lawn map`;
    body = s ? `I mapped ${fmt(s.homes)} homes in ${r.city} and found ${fmt(s.headline)} with lawns over 5,000 sq ft. The biggest cluster is on ${s.topStreet}.\n\nI put the best streets for lawn care on a one-page map. Want me to send you the ${r.city} one? It's free.`
      : `I've been mapping lawn sizes across Colorado, house by house, and I can put the best streets in ${r.city} for lawn care on a one-page map. Want me to send it to you? It's free.`;
  } else {
    subject = `hail map for ${r.city}`;
    body = s ? `Radar put hail an inch or larger over ${fmt(s.headline)} homes in ${r.city} in the last ${s.window}. ${s.topStreet} had the most.\n\nI put the hardest-hit streets on a one-page map. Want me to send you the ${r.city} one? It's free.`
      : `I've been mapping roofs and hail history across Colorado, house by house, and I can put the best streets in ${r.city} for roofing on a one-page map. Want me to send it to you? It's free.`;
  }
  out.push(`## ${++i}. ${clean(r.company)} (${trade}, ${r.city}, since ${r.formed})${r.verified === 'accept_all' ? ' · email domain accepts all, may not reach a person' : ''}`, '',
    `**Subject:** ${subject}`, '', '> Hi there,', '>', ...body.split('\n').map((l) => '> ' + l), '>', '> Matthew', '',
    `Map on hand: ${s ? `yes (${s.town}, data as of ${s.dataDate})` : 'no: ' + (trade === 'roofing' ? 'no hail data for this town, so the no-number version' : 'no lawn report for this town, so the no-number version') + (r.city.toLowerCase() === 'colorado springs' ? '. Colorado Springs is four quarters in our data; a combined Colorado Springs map is a small build if wanted' : '')}`, '');
}
if (held.length) out.push('## Held: no map for their town, so no email yet (we would be offering something we cannot send)', '', ...held.map((h) => '- ' + h), '');
out.push('## Follow-ups', '', 'Same two short follow-ups as in `free-map-sequence-DRAFT.md`, in the same thread, 3-4 days and then a week later.', '');
writeFileSync(join(HERE, '../../prospect-desk/drafts/new152-batch1-DRAFT.md'), out.join('\n'));
console.log(i, 'emails written');
