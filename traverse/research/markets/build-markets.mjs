// Where the companies are and where the homes are, county by county in Colorado (2026-10-11, Matthew: "Determine where more
// companies are headquartered in the state, and match it to where there's a market to sell to").
//   Companies: US Census County Business Patterns 2023 (establishments by county and NAICS industry). An establishment is one
//              business location with paid employees: a one-person shop with no payroll is not counted, a branch is.
//   Homes:     Census ACS 5-year 2020-2024, owner-occupied homes (B25003_002E) and single-family detached homes (B25024_002E).
// One row per county: companies per trade, homes, homes per company, and which of our towns sit in it. Writes markets.csv and
// markets.json beside this file. The Census key is read from data-pipeline/door-territory/census-key.txt and never printed.
//   node traverse/research/markets/build-markets.mjs
import { readFileSync, writeFileSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), REPO = join(HERE, '..', '..', '..');
const KEY = readFileSync(join(REPO, 'traverse', 'data-pipeline', 'door-territory', 'census-key.txt'), 'utf8').trim();
const TRADES = [   // [edition, NAICS 2017 code, what the code covers]
  ['yards', '561730', 'Landscaping services (lawn care, landscaping, tree work)'],
  ['roofing', '238160', 'Roofing contractors'],
  ['pest', '561710', 'Exterminating and pest control services'],
  ['security', '561621', 'Security systems services (alarm install and monitoring)'],
  ['solar', '238210', 'Electrical contractors (solar installers are counted here; so is every other electrician, so it overstates solar)'],
];
const get = async (u) => { const r = await fetch(u + '&key=' + KEY); if (!r.ok) throw new Error(r.status + ' ' + u.replace(/key=.*/, '')); return r.json(); };
const rows = {};
for (const [ed, code] of TRADES) {
  const j = await get(`https://api.census.gov/data/2023/cbp?get=NAME,ESTAB,EMP&for=county:*&in=state:08&NAICS2017=${code}`);
  const h = j[0];
  for (const r of j.slice(1)) {
    const o = Object.fromEntries(h.map((k, i) => [k, r[i]]));
    const c = rows[o.county] || (rows[o.county] = { fips: o.county, county: o.NAME.replace(/, Colorado$/, '') });
    c[ed] = +o.ESTAB; c[ed + 'Emp'] = +o.EMP;
  }
}
const acs = await get('https://api.census.gov/data/2024/acs/acs5?get=NAME,B25003_002E,B25024_002E&for=county:*&in=state:08');
const ah = acs[0], ai = (k) => ah.indexOf(k);   /* by column name: the answer ends with state, county */
for (const r of acs.slice(1)) {
  const fp = r[ai('county')];
  const c = rows[fp] || (rows[fp] = { fips: fp, county: r[ai('NAME')].replace(/, Colorado$/, '') });
  c.ownerHomes = +r[ai('B25003_002E')]; c.detached = +r[ai('B25024_002E')];
}
/* our towns, by county (index.json carries each town's county) */
const idx = JSON.parse(readFileSync(join(REPO, 'traverse', 'app', 'data', 'rounds', 'index.json'), 'utf8')).regions.filter((r) => !r.metro && !r.key.startsWith('com-'));
const money = JSON.parse(readFileSync(join(REPO, 'traverse', 'app', 'data', 'rounds', 'docs', 'money.json'), 'utf8'));
const NAME = { elpaso: 'El Paso County', douglas: 'Douglas County', teller: 'Teller County', adams: 'Adams County', arapahoe: 'Arapahoe County', jefferson: 'Jefferson County', weld: 'Weld County', denver: 'Denver County', boulder: 'Boulder County', park: 'Park County', larimer: 'Larimer County', broomfield: 'Broomfield County' };
for (const t of idx) { const ck = t.county || money.counties[t.key]; const nm = NAME[ck]; const c = Object.values(rows).find((x) => x.county === nm); if (c) (c.ourTowns = c.ourTowns || []).push(t.label); }
const list = Object.values(rows).sort((a, b) => (b.ownerHomes || 0) - (a.ownerHomes || 0));
for (const c of list) for (const [ed] of TRADES) c[ed + 'HomesPer'] = c[ed] ? Math.round((c.ownerHomes || 0) / c[ed]) : null;
writeFileSync(join(HERE, 'markets.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), sources: { companies: 'US Census Bureau, County Business Patterns 2023 (api.census.gov/data/2023/cbp)', homes: 'US Census Bureau, ACS 5-year 2020-2024 (B25003_002E owner-occupied, B25024_002E single-family detached)' }, trades: TRADES, counties: list }, null, 1));
const cols = ['county', 'ownerHomes', 'detached', ...TRADES.flatMap(([ed]) => [ed, ed + 'HomesPer']), 'ourTowns'];
writeFileSync(join(HERE, 'markets.csv'), cols.join(',') + '\n' + list.map((c) => cols.map((k) => { const v = c[k]; return Array.isArray(v) ? '"' + v.join('; ') + '"' : v === undefined || v === null ? '' : typeof v === 'string' && v.includes(',') ? '"' + v + '"' : v; }).join(',')).join('\n') + '\n');
console.log('counties', list.length);
for (const c of list.slice(0, 15)) console.log(c.county.padEnd(22), String(c.ownerHomes).padStart(7), 'lawn cos', String(c.yards || 0).padStart(4), 'roof', String(c.roofing || 0).padStart(4), 'pest', String(c.pest || 0).padStart(3), 'sec', String(c.security || 0).padStart(3), ' towns:', (c.ourTowns || []).join(', '));
