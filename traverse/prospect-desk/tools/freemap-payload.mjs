// The free-map send (Matthew 6 Nov: "go ahead and start when its ready"): the package the server loader needs.
//   node traverse/prospect-desk/tools/freemap-payload.mjs  -> desk-data-local/freemap-payload.json (gitignored with desk-data-local)
// Holds: batch 1's companies (new on the register, not on the desk yet, a verified email and a town map) as desk leads, and every
// town's numbers by trade and city name for the message text. The loader (freemap-load.php) builds and queues the messages.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const P = join(ROOT, 'research', 'prospects');
const parse = (l) => { const o = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ',') { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const csv = (f) => { const L = readFileSync(f, 'utf8').trim().split(/\r?\n/); const h = parse(L[0]); return L.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [h[i], v]))); };

const st = JSON.parse(readFileSync(join(ROOT, 'prospect-desk', 'town-report', 'out', 'town-stats.json'), 'utf8'));
const stats = {};
for (const a of Array.isArray(st) ? st : Object.values(st)) stats[a.trade + '|' + a.label.toLowerCase()] = { homes: a.homes, n: a.headline, street: a.topStreet, window: a.window, label: a.label, town: a.town };

const reg = new Map(csv(join(P, 'prospects-new-since-20261011.csv')).map((r) => [r.company + '|' + r.city, r]));
const sites = JSON.parse(readFileSync(join(P, 'websites.json'), 'utf8'));
const leads = [];
for (const c of csv(join(P, 'new152-contacts.csv'))) {
  if (!c.email || !['valid', 'accept_all'].includes(c.verified) || !['yards', 'roofing'].includes(c.trade)) continue;
  const tr = c.trade === 'yards' ? 'lawn' : 'roofing';
  if (!stats[tr + '|' + c.city.toLowerCase()]) continue;   // no map for the town: no email (we only offer what we can send)
  const r = reg.get(c.company + '|' + c.city); if (!r) throw new Error('not on the register: ' + c.company);
  const m = r.record.match(/masterFileId=(\d+)/);
  const id = createHash('sha1').update('sos|' + (m ? m[1] : r.company + '|' + r.city)).digest('hex').slice(0, 10);   // build-seed.mjs's rule
  leads.push({ id, name: r.company, trade: r.trade, type: r.type, city: r.city, zip: r.zip, formed: r.formed, where: r.where, record: r.record,
    phone: c.phone || (sites[r.record] || {}).phone || '', email: c.email, emailSrc: c.email_from === 'hunter' ? 'hunter' : 'site', emailOk: c.verified === 'valid' ? 'yes' : '',
    site: c.website, place: '', cat: '', siteDead: false, siteWhy: '', socials: [], score: 0, grade: '', why: 'new on the register 4 Nov; free-map batch 1 (6 Nov)' });
}
mkdirSync(join(ROOT, 'prospect-desk', 'desk-data-local'), { recursive: true });
writeFileSync(join(ROOT, 'prospect-desk', 'desk-data-local', 'freemap-payload.json'), JSON.stringify({ made: new Date().toISOString(), batch1: leads, stats }));
console.log('batch 1 leads:', leads.length, '| towns with numbers:', Object.keys(stats).length);
