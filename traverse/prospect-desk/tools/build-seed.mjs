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
/* where (2026-10-26, Matthew: "what do we define as towns next to us?"): the prospect list set it on 11 Oct, when we covered far fewer
   towns, so Lakewood, Aurora, Westminster and others were "next to" us. Now: "in our towns" = the company's city is a town in the app
   today (app/data/rounds/index.json, plus Colorado Springs for its four parts); "next to our towns" = the old list's nearby cities that
   are still not covered (Peyton, Falcon, Severance, Timnath, ...); everything else "elsewhere in Colorado". */
const COVERED = new Set(JSON.parse(readFileSync(join(HERE, '..', '..', 'app', 'data', 'rounds', 'index.json'), 'utf8')).regions
  .map((r) => String(r.label).toUpperCase().replace(/ (NORTHEAST|NORTHWEST|SOUTHEAST|SOUTHWEST)$/, '')).concat(['COLORADO SPRINGS']));
/* social pages (2026-10-26, Matthew: "is it possible we can attach socials to these prospects"): prospects-socials.csv beside the input
   (record, socials: space-separated links), from Overture's open places data and the links on each company's own website */
const SOCIALS = new Map();
{ const f = join(dirname(IN), 'prospects-socials.csv'); try { for (const line of readFileSync(f, 'utf8').split(/\r?\n/).slice(1)) { if (!line.trim()) continue; const [rec, s] = parse(line); if (rec && s) SOCIALS.set(rec, s.split(' ').filter(Boolean).slice(0, 8)); } } catch {} }
const whereNow = (city, old) => COVERED.has(String(city).toUpperCase()) ? 'in our towns' : (old === 'elsewhere in Colorado' || !old ? 'elsewhere in Colorado' : 'next to our towns');
const seen = new Set(), leads = []; let dup = 0;
for (const r of lines.slice(1).map(parse)) {
  const rec = col(r, 'record'), m = rec.match(/masterFileId=(\d+)/);
  const id = createHash('sha1').update('sos|' + (m ? m[1] : col(r, 'company') + '|' + col(r, 'city'))).digest('hex').slice(0, 10);
  if (seen.has(id)) { dup++; continue; } seen.add(id);
  const trade = TRADES.has(col(r, 'trade')) ? col(r, 'trade') : 'roofing';
  const e1 = okMail(col(r, 'email')), e2 = okMail(col(r, 'site_email')), e3 = okMail(col(r, 'found_email'));
  const email = e1 || e2 || e3;
  const l = {
    id, name: col(r, 'company'), trade, type: col(r, 'type'), city: col(r, 'city'), zip: col(r, 'zip'), formed: col(r, 'formed'), where: whereNow(col(r, 'city'), col(r, 'where')), record: rec,
    phone: phoneFmt(col(r, 'phone')) || phoneFmt(col(r, 'found_phone')),
    email, emailSrc: email ? (e1 ? 'places' : e2 ? 'their site' : 'their site (found)') : '', emailOk: email ? col(r, 'email_ok') : '',
    site: col(r, 'website') || col(r, 'found_site'), place: col(r, 'place_name'), cat: col(r, 'cat')
  };
  /* the website check (2026-10-26, Matthew saw dead links): site_alive no = it did not load, with why */
  if (l.site && col(r, 'site_alive') === 'no') { l.siteDead = true; l.siteWhy = col(r, 'site_why'); }
  /* an email on the dead site's own domain (2026-10-26, Matthew: "if a companies website is down, its likely that their email attached to
     the domain is probably down"): a parked, suspended or vanished domain = do not email; otherwise it may bounce, so call first */
  const host = (u) => { try { return new URL(/^https?:/i.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
  if (l.siteDead && l.email && l.email.split('@')[1] === host(l.site)) {
    if (/parked|suspended|no such domain/.test(l.siteWhy || '')) { l.emailOk = 'no'; l.emailWhy = 'their website’s domain is parked or gone'; }
    else l.emailWarn = true;
  }
  const soc = SOCIALS.get(rec); if (soc) l.socials = soc;
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
  /* dead site, dead or doubtful email (2026-10-26, Matthew: "make sure their rating is adjusted for it"): an email that cannot take mail
     or may bounce earns nothing; a website that no longer loads takes points off (they may have closed) */
  const mail = l.email && l.emailOk !== 'no' && !l.emailWarn;
  if (l.siteDead) add(-10, 'website down' + (l.siteWhy ? ' (' + l.siteWhy + ')' : '') + ': may have closed');
  if (l.email && !mail) why.push(l.emailWarn ? 'email may bounce (no points)' : 'email cannot take mail (no points)');
  if (l.phone && mail) add(10, 'phone and email'); else if (l.phone || mail) add(5, l.phone ? 'phone' : 'email');
  const yr = parseInt(l.formed, 10), age = yr ? new Date().getFullYear() - yr : 0;
  if (age >= 3) add(5, `in business since ${yr}`);
  if (l.site && !l.siteDead) add(5, 'has a website');
  add(l.trade === 'yards' ? 10 : 15, l.trade === 'yards' ? 'lawn and yard' : 'a door-to-door trade');
  const score = Math.max(0, Math.min(100, s));
  return { score, grade: score >= 60 ? 'A' : score >= 40 ? 'B' : 'C', why };
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ built: new Date().toISOString().slice(0, 10), from: IN.split(/[\\/]/).pop(), leads }));
const n = (f) => leads.filter(f).length;
console.log(`${leads.length} companies (${dup} repeats left out) -> ${OUT}`);
console.log(`phone ${n((l) => l.phone)}, email ${n((l) => l.email)}, either ${n((l) => l.phone || l.email)}, website ${n((l) => l.site)}, email cannot take mail ${n((l) => l.emailOk === 'no')}`);
console.log(`where: in our towns ${n((l) => l.where === 'in our towns')}, next to ${n((l) => l.where === 'next to our towns')}, elsewhere ${n((l) => l.where === 'elsewhere in Colorado')}; websites that did not load ${n((l) => l.siteDead)}; emails skipped (domain parked/gone) ${n((l) => l.emailWhy)}, emails that may bounce ${n((l) => l.emailWarn)}; with social pages ${n((l) => l.socials)}`);
console.log(`rank: A ${n((l) => l.grade === 'A')}, B ${n((l) => l.grade === 'B')}, C ${n((l) => l.grade === 'C')}; A with a phone or email ${n((l) => l.grade === 'A' && (l.phone || l.email))}`);
