// The Prospect Desk's starting list (2026-10-26, TR-21): one company per row of the prospect list, with the phone, email and website
// found for it. Takes prospects-contacts-*.csv (the places match and the companies' own sites) or prospects-step3.csv (that plus the
// cloud look-up: found_site, found_phone, found_email, email_ok); the newer columns fill in what the older ones lack.
// Ids come from the state register's record number, so a rebuilt seed keeps every company's id and the desk's history replays onto it.
// The output holds company contact details: it goes to the server's data folder, never to git or a public folder.
//   node tools/build-seed.mjs <csv> [out.json]          default out: desk-data-local/seed.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const [, , IN, OUT = join(HERE, '..', 'desk-data-local', 'seed.json')] = process.argv;
if (!IN) { console.error('usage: node tools/build-seed.mjs <csv> [out.json]'); process.exit(1); }
const parse = (line) => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
const lines = readFileSync(IN, 'utf8').split(/\r?\n/).filter(Boolean);
const head = parse(lines[0]); const col = (r, k) => { const i = head.indexOf(k); return i < 0 ? '' : String(r[i] ?? '').trim(); };
const phoneFmt = (p) => { let d = String(p).replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') d = d.slice(1); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : ''; };
const okMail = (e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/i.test(e) ? e.toLowerCase() : '';
const TRADES = new Set(['roofing', 'roofing solar', 'solar', 'pest', 'security', 'yards']);
const seen = new Set(), leads = []; let dup = 0;
for (const r of lines.slice(1).map(parse)) {
  const rec = col(r, 'record'), m = rec.match(/masterFileId=(\d+)/);
  const id = createHash('sha1').update('sos|' + (m ? m[1] : col(r, 'company') + '|' + col(r, 'city'))).digest('hex').slice(0, 10);
  if (seen.has(id)) { dup++; continue; } seen.add(id);
  const trade = TRADES.has(col(r, 'trade')) ? col(r, 'trade') : 'roofing';
  const e1 = okMail(col(r, 'email')), e2 = okMail(col(r, 'site_email')), e3 = okMail(col(r, 'found_email'));
  const email = e1 || e2 || e3;
  const l = {
    id, name: col(r, 'company'), trade, type: col(r, 'type'), city: col(r, 'city'), zip: col(r, 'zip'), formed: col(r, 'formed'), where: col(r, 'where'), record: rec,
    phone: phoneFmt(col(r, 'phone')) || phoneFmt(col(r, 'found_phone')),
    email, emailSrc: email ? (e1 ? 'places' : e2 ? 'their site' : 'their site (found)') : '', emailOk: email ? col(r, 'email_ok') : '',
    site: col(r, 'website') || col(r, 'found_site'), place: col(r, 'place_name'), cat: col(r, 'cat')
  };
  Object.assign(l, rank(l, (k) => col(r, k) === 'yes'));
  leads.push(l);
}
/* The rank (2026-10-26, Matthew: "are we also able to rank these leads for the traverse leads like we did for peak?"): points for
   what makes a company likely to buy a door-knocking app, from what we can see. Our judgement, not a measurement: the weights are
   here to change. Signals come from the company's own website (the cloud look-up's sig_* columns): they say they knock doors or
   canvass, offer storm/free inspections, hire salespeople, or show size. Then where they work (our towns have the richest data),
   whether we can reach them, how long they have been in business, and the trade (door-to-door-heavy trades first). */
function rank(l, sig) {
  const why = []; let s = 0;
  const add = (n, t) => { s += n; why.push(t); };
  if (sig('sig_d2d')) add(30, 'their site mentions door-to-door or canvassing');
  if (sig('sig_storm')) add(15, 'storm or free-inspection work');
  if (sig('sig_hiring')) add(10, 'hiring salespeople');
  if (sig('sig_size')) add(5, 'several crews, trucks or locations');
  if (l.where === 'in our towns') add(20, 'in our towns'); else if (l.where === 'next to our towns') add(10, 'next to our towns');
  const mail = l.email && l.emailOk !== 'no';
  if (l.phone && mail) add(10, 'phone and email'); else if (l.phone || mail) add(5, l.phone ? 'phone' : 'email');
  const yr = parseInt(l.formed, 10), age = yr ? new Date().getFullYear() - yr : 0;
  if (age >= 3) add(5, `in business since ${yr}`);
  if (l.site) add(5, 'has a website');
  add(l.trade === 'yards' ? 10 : 15, l.trade === 'yards' ? 'lawn and yard' : 'a door-to-door trade');
  const score = Math.min(100, s);
  return { score, grade: score >= 60 ? 'A' : score >= 40 ? 'B' : 'C', why };
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ built: new Date().toISOString().slice(0, 10), from: IN.split(/[\\/]/).pop(), leads }));
const n = (f) => leads.filter(f).length;
console.log(`${leads.length} companies (${dup} repeats left out) -> ${OUT}`);
console.log(`phone ${n((l) => l.phone)}, email ${n((l) => l.email)}, either ${n((l) => l.phone || l.email)}, website ${n((l) => l.site)}, email cannot take mail ${n((l) => l.emailOk === 'no')}`);
console.log(`rank: A ${n((l) => l.grade === 'A')}, B ${n((l) => l.grade === 'B')}, C ${n((l) => l.grade === 'C')}; A with a phone or email ${n((l) => l.grade === 'A' && (l.phone || l.email))}`);
