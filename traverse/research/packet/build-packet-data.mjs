// The data behind the Traverse work packet (2026-10-12, Matthew: "a super work packet that has my competitors, companies to sell to,
// operating and start-up costs, business model"). Merges the prospect list, the websites found on companies' own sites, Denver's
// alarm and tree-service licences, the market figures, and the researched competitor and cost tables (each line with its source and
// the date it was read). Writes packet-data.json to the folder given (outside git: company names include people's names).
//   node traverse/research/packet/build-packet-data.mjs <out-folder>
import { readFileSync, writeFileSync, existsSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), R = join(HERE, '..');
const out = process.argv[2]; if (!out) throw new Error('give an output folder');
const parse = (line) => { const o = []; let c = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ',') { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const csv = readFileSync(join(R, 'prospects', 'prospects.csv'), 'utf8').trim().split('\n'); const head = csv.shift().split(',');
const rows = csv.map((l) => Object.fromEntries(parse(l).map((v, i) => [head[i], v])));
const web = existsSync(join(R, 'prospects', 'websites.json')) ? JSON.parse(readFileSync(join(R, 'prospects', 'websites.json'), 'utf8')) : {};
const norm = (s) => String(s || '').toUpperCase().replace(/&/g, ' AND ').replace(/\b(L\.?L\.?C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|THE|DBA)\b\.?/g, ' ').replace(/[^A-Z0-9]+/g, ' ').trim();
const lic = existsSync(join(R, 'prospects', 'denver-licenses.json')) ? JSON.parse(readFileSync(join(R, 'prospects', 'denver-licenses.json'), 'utf8')) : [];
const licBy = new Map(); for (const l of lic) for (const n of [l.entity_name, l.trade_name]) if (n) licBy.set(norm(n), l.license_type);
const W = { 'in our towns': 0, 'next to our towns': 1, 'elsewhere in Colorado': 2 };
const seen = new Set();
const P = rows.map((r) => { const w = web[r.record] || {}; const k = norm(r.company); seen.add(k); const id = r.record.split('=').pop();
  return [r.trade, r.company, '', r.city, '', r.formed, W[r.where], id, w.website || '', w.phone || '', licBy.get(k) === 'Burglar Alarm Company' ? 'A' : licBy.get(k) === 'Tree Service Company' ? 'T' : '']; });
/* Denver-licensed companies whose names carry no trade word, added as their own rows */
let added = 0;
for (const l of lic) { const k = norm(l.entity_name); if (!k || seen.has(k) || (l.trade_name && seen.has(norm(l.trade_name)))) continue; seen.add(k);
  P.push([l.license_type === 'Burglar Alarm Company' ? 'security' : 'yards', l.trade_name || l.entity_name, 'Denver licence', 'Denver', '', '', 0, '', '', '', l.license_type === 'Burglar Alarm Company' ? 'A' : 'T']); added++; }
const markets = JSON.parse(readFileSync(join(R, 'markets', 'markets.json'), 'utf8'));
const cities = JSON.parse(readFileSync(join(R, 'markets', 'cities.json'), 'utf8'));
const data = {
  built: new Date().toISOString().slice(0, 10),
  prospectCols: ['trade', 'company', 'type', 'city', 'zip', 'formed', 'where', 'sosId', 'website', 'phone', 'denver'],
  prospects: P, addedFromDenver: added, websitesTried: Object.keys(web).length,
  counties: markets.counties.filter((c) => c.ownerHomes > 15000).map((c) => ({ county: c.county, homes: c.ownerHomes, yards: c.yards || 0, roofing: c.roofing || 0, pest: c.pest || 0, security: c.security || 0, solar: c.solar || 0, ours: c.ourTowns || [] })),
  cities: cities.cities.slice(0, 30).map((c) => ({ city: c.city, yards: c.yards || 0, roofing: c.roofing || 0, pest: c.pest || 0, security: c.security || 0, solar: c.solar || 0 })),
};
/* one company per line, so the file can be read through in parts before it is published */
writeFileSync(join(out, 'packet-data.json'), JSON.stringify(data).replace(/\],\[/g, '],\n['));
console.log('prospects', P.length, '(+' + added + ' from Denver licences) · with website', P.filter((p) => p[8]).length, '· websites tried', data.websitesTried);
