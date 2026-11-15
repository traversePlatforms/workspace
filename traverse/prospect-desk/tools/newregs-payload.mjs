// The 152 companies new on the Colorado register since 11 Oct (Matthew 15 Nov 2026: "put companies on the prospect list").
//   node traverse/prospect-desk/tools/newregs-payload.mjs  -> desk-data-local/newregs-payload.json (gitignored with desk-data-local)
// Contacts from research/prospects/new152-contacts.csv (cloud website finder + Hunter-verified emails, 6 Nov). Ids follow build-seed.mjs's
// rule, so the 11 already added for the free-map batch are recognised and skipped by newregs-load.php. Adds companies only: no email is
// queued or sent from here.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const P = join(ROOT, 'research', 'prospects');
const parse = (l) => { const o = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ',') { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const csv = (f) => { const L = readFileSync(f, 'utf8').trim().split(/\r?\n/); const h = parse(L[0]); return L.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [h[i], v]))); };

const contacts = new Map(csv(join(P, 'new152-contacts.csv')).map((c) => [c.company + '|' + c.city, c]));
const sites = JSON.parse(readFileSync(join(P, 'websites.json'), 'utf8'));
const leads = [];
for (const r of csv(join(P, 'prospects-new-since-20261011.csv'))) {
  const c = contacts.get(r.company + '|' + r.city) || {};
  const m = r.record.match(/masterFileId=(\d+)/);
  const id = createHash('sha1').update('sos|' + (m ? m[1] : r.company + '|' + r.city)).digest('hex').slice(0, 10);   // build-seed.mjs's rule
  const email = ['valid', 'accept_all'].includes(c.verified) ? (c.email || '') : '';
  leads.push({ id, name: r.company, trade: r.trade, type: r.type, city: r.city, zip: r.zip, formed: r.formed, where: r.where, record: r.record,
    phone: c.phone || (sites[r.record] || {}).phone || '', email, emailSrc: email ? (c.email_from === 'hunter' ? 'hunter' : 'site') : '', emailOk: c.verified === 'valid' ? 'yes' : '',
    site: c.website || '', place: '', cat: '', siteDead: false, siteWhy: '', socials: [], score: 0, grade: '', why: 'new on the Colorado register (4 Nov refresh); added 15 Nov' });
}
mkdirSync(join(ROOT, 'prospect-desk', 'desk-data-local'), { recursive: true });
writeFileSync(join(ROOT, 'prospect-desk', 'desk-data-local', 'newregs-payload.json'), JSON.stringify({ made: new Date().toISOString(), leads }));
const n = (f) => leads.filter(f).length;
console.log(`companies ${leads.length} | email ${n((l) => l.email)} | phone ${n((l) => l.phone)} | website ${n((l) => l.site)} | none ${n((l) => !l.email && !l.phone && !l.site)}`);
