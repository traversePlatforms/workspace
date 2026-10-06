/* Sixfold — the state HOA roster, cut to our ground and matched to our neighbourhoods. 2026-10-03.

   SOURCE. The Division of Real Estate's own roster generator (no fee, no records request):
     apps2.colorado.gov/dre/licensing/Lookup/GenerateRoster.aspx
       -> "HOA - Home Owner's Association - Active" -> Download -> CSV
   The Division's open-records page says it is regularly asked for HOA lists and points
   there instead of CORA. Saved as hoa-roster-active-<date>.csv; refresh it the same way.

   WHAT IT HAS: name, designated agent, mailing address, units, self- or professionally
   managed, management company, renewal dates, and (since HB25-1043) delinquency figures.
   WHAT IT DOES NOT: phone or email, and no map boundary. The page says "This is the only
   information we collect on HOAs" and that the Division cannot verify what HOAs submit.

   ⚑ COUNTY IS BLANK ON MOST ROWS (7,015 of 8,597 on 2026-10-03; only recent registrations
   fill it). So an HOA is in scope if ANY of:
     match   its name matches a subdivision on our door lists, or an HOA that owns land in
             our towns (../mail/communities.csv)        <- the strong signal
     county  its county is El Paso, Douglas or Teller
     zip     its MAILING zip is in one of those counties <- weak: a manager's office can be
             anywhere, and some zips cross county lines
   Every row says which, so nobody mistakes a zip guess for a match.

   Output: hoa-sixfold.csv, management-companies.csv, summary.json
   Run:    node build-hoa-list.mjs                                                          */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROSTER = readdirSync(HERE).filter((f) => /^hoa-roster-active-\d{4}-\d{2}-\d{2}\.csv$/.test(f)).sort().pop();
const ROUNDS = join(HERE, '..', '..', '..', 'site', 'data', 'rounds');
const COUNTIES = ['El Paso', 'Douglas', 'Teller'];
/* mailing zips by county — approximate, see the header */
const ZIPS = {
  'El Paso': /^(809\d\d|80132|80133|80808|80809|80817|80819|80829|80831|80832|80833|80840|80864)$/,
  Douglas: /^(80104|80108|80109|80116|80118|80124|80125|80126|80129|80130|80131|80134|80135|80138)$/,
  Teller: /^(80813|80814|80816|80860|80863|80866)$/,
};

const METRO = /^(DENVER|AURORA|LAKEWOOD|GREENWOOD VILLAGE|CENTENNIAL|ENGLEWOOD|LITTLETON|WESTMINSTER|ARVADA|BROOMFIELD|THORNTON|GOLDEN|LONE TREE|HIGHLANDS RANCH|PARKER|WHEAT RIDGE|LOUISVILLE|NORTHGLENN|COMMERCE CITY|CHERRY HILLS VILLAGE|GLENDALE)$/i;

function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    /* a quote only opens a quoted field at its START: the roster has names like  Bob "Jr" Smith
       unquoted, and treating that quote as an opener swallowed ~1,000 rows on the first run */
    else if (c === '"' && f === '') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...body] = rows; const head = h.map((s) => s.trim());
  return body.filter((r) => r.length >= 10).map((r) => Object.fromEntries(head.map((k, i) => [k, (r[i] || '').trim()])));
}

/* the distinctive part of a name: "Castle Oaks Estates Master Association" -> "CASTLE OAKS" */
const FILLER = /\b(HOMEOWNERS?|HOME|OWNERS?|ASSOCIATIONS?|ASSOC|ASSN|ASSO|INC|INCORPORATED|THE|AT|OF|AND|MASTER|COMMUNITY|PROPERTY|PROPERTIES|POA|HOA|FILING|NO|NUMBER|CONDOMINIUMS?|CONDOS?|TOWNHOMES?|TOWNHOUSES?|METROPOLITAN|METRO|DISTRICT|DIST|ESTATES?|SUBDIVISION|LLC|CORP|CORPORATION|UNITS?|RESIDENTIAL|PHASE|CIVIC|IMPROVEMENT|NONPROFIT|NON PROFIT|CO|COLORADO|\d+[A-Z]?)\b/g;
const core = (s) => ` ${s.toUpperCase().replace(/\bC\/O\b.*$/, '').replace(/[^A-Z0-9 ]/g, ' ')} `.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
const matches = (a, b) => {
  if (!a || !b || a.length < 4 || b.length < 4) return false;
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length >= 8 && s.includes(' ') && ` ${l} `.includes(` ${s} `);   /* multi-word core, whole words */
};

/* our neighbourhoods: subdivision / metro names on the door lists */
const places = new Map();   // core -> { name, towns:Set, doors }
for (const f of readdirSync(ROUNDS).filter((x) => x.endsWith('.json') && !['index.json', 'money.json'].includes(x))) {
  const town = f.replace('.json', '');
  for (const a of JSON.parse(readFileSync(join(ROUNDS, f), 'utf8')).areas) {
    if (!a.place?.n) continue;
    const k = core(a.place.n); if (!k) continue;
    if (!places.has(k)) places.set(k, { name: a.place.n, towns: new Set(), doors: 0 });
    const p = places.get(k); p.towns.add(town); p.doors += a.doors.length;
  }
}
/* HOAs that own land in our towns */
const landRows = parseCSV(readFileSync(join(HERE, '..', 'mail', 'communities.csv'), 'utf8'));
const land = new Map();     // core -> { name, parcels, acres, fire }
const FIRE_RANK = { 'very high': 5, high: 4, moderate: 3, low: 2, 'very low': 1 };
for (const r of landRows) {
  const k = core(r.owner.split(' / ')[0]); if (!k) continue;
  if (!land.has(k)) land.set(k, { name: r.owner.split(' / ')[0], parcels: 0, acres: 0, fire: '' });
  const l = land.get(k); l.parcels++; l.acres += Number(r.acres) || 0;
  if ((FIRE_RANK[r.fire_hazard] || 0) > (FIRE_RANK[l.fire] || 0)) l.fire = r.fire_hazard;
}

const roster = parseCSV(readFileSync(join(HERE, ROSTER), 'utf8'));
const out = [];
for (const r of roster) {
  const name = r.BusinessName.replace(/^\s+/, '');
  const k = core(name);
  const zip5 = (r.ZipCode || '').slice(0, 5);
  const pm = [...places].filter(([pk]) => matches(k, pk)).map(([, p]) => p);
  const lm = [...land].filter(([lk]) => matches(k, lk)).map(([, l]) => l);
  const why = [];
  if (pm.length || lm.length) why.push('match');
  if (COUNTIES.includes(r.County)) why.push('county');
  const zc = Object.entries(ZIPS).find(([, re]) => re.test(zip5));
  if (zc) why.push('zip');
  if (!why.length) continue;
  /* ⚑ A NAME ALONE IS WEAK. Checked 2026-10-03: of 106 name-only matches, most mailed from
     Keystone, Crested Butte, Breckenridge, Durango ("Red Hawk", "The Meadows" are common
     names). Some are real local HOAs run by a Denver-area manager (Crystal Valley Ranch).
     So a name-only match is kept only when it mails from the Denver metro, and labelled. */
  if (why.length === 1 && why[0] === 'match') {
    if (!METRO.test(r.City)) continue;
    why[0] = 'name only, manager in Denver metro: confirm';
  }
  out.push({
    name, k, why: why.join('+'), units: Number(r.Units) || 0, managed: r.Managed, manager: /^none$/i.test(r['Management Company']) ? '' : r['Management Company'],
    agent: r['Designated Agent'], attention: r.Attention,
    address: [r['Address Line 1'], r['Address Line 2']].filter(Boolean).join(', '), city: r.City, state: r.State, zip: r.ZipCode,
    county: r.County || (zc ? `${zc[0]}? (by zip)` : ''), renewed: r['License Last Renewed Date'], expires: r['License Expiration Date'],
    neighbourhoods: pm.map((p) => `${p.name} (${[...p.towns].join('/')}, ${p.doors} doors)`).join('; '),
    doors: pm.reduce((s, p) => s + p.doors, 0),
    land: lm.map((l) => `${l.parcels} parcels, ${l.acres.toFixed(1)} ac${l.fire ? `, ${l.fire} fire hazard` : ''}`).join('; '),
  });
}
const rank = (o) => (o.why.startsWith('match') ? 3 : o.why.startsWith('name only') ? 2 : o.why.includes('county') ? 1 : 0);
out.sort((a, b) => rank(b) - rank(a) || b.doors - a.doors || b.units - a.units);

const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = (head, rows) => [head.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n';
writeFileSync(join(HERE, 'hoa-sixfold.csv'), csv(
  ['hoa', 'why_in_scope', 'our_neighbourhoods', 'our_doors', 'owns_land_in_our_towns', 'units', 'managed', 'management_company', 'designated_agent', 'attention', 'mail_address', 'mail_city', 'mail_state', 'mail_zip', 'county', 'last_renewed', 'expires'],
  out.map((o) => [o.name, o.why, o.neighbourhoods, o.doors || '', o.land, o.units || '', o.managed, o.manager, o.agent, o.attention, o.address, o.city, o.state, o.zip, o.county, o.renewed, o.expires])));

/* one manager can open the door to many HOAs */
const mgr = new Map();
for (const o of out) { if (!o.manager) continue; const m = o.manager.replace(/\s+/g, ' '); const key = m.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14); if (!mgr.has(key)) mgr.set(key, { name: m, hoas: [], units: 0, matched: 0 }); const g = mgr.get(key); g.hoas.push(o.name); g.units += o.units; if (o.why.includes('match')) g.matched++; }
const mrows = [...mgr.values()].sort((a, b) => b.hoas.length - a.hoas.length || b.units - a.units);
writeFileSync(join(HERE, 'management-companies.csv'), csv(['management_company', 'hoas', 'matched_to_our_neighbourhoods', 'total_units', 'hoa_names'], mrows.map((m) => [m.name, m.hoas.length, m.matched, m.units, m.hoas.join('; ')])));

const summary = {
  roster: ROSTER, rosterRows: roster.length, countyBlank: roster.filter((r) => !r.County).length, inScope: out.length,
  byWhy: out.reduce((o, x) => ((o[x.why] = (o[x.why] || 0) + 1), o), {}),
  matched: out.filter((o) => o.why.startsWith('match')).length, matchedUnits: out.filter((o) => o.why.startsWith('match')).reduce((s, o) => s + o.units, 0),
  ourPlaces: places.size, placesMatched: [...places.keys()].filter((pk) => out.some((o) => matches(o.k, pk))).length,
  landOwners: land.size, landOwnersMatched: [...land.keys()].filter((lk) => out.some((o) => matches(o.k, lk))).length,
  managed: out.reduce((o, x) => ((o[x.managed || '?'] = (o[x.managed || '?'] || 0) + 1), o), {}), managers: mrows.length,
};
writeFileSync(join(HERE, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log('\nTop matches:'); for (const o of out.filter((x) => x.why.includes('match')).slice(0, 15)) console.log(`  ${o.name}  <->  ${o.neighbourhoods || o.land}`);
