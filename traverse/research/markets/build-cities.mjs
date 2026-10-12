// Which Colorado cities the companies are based in, trade by trade (2026-10-11). US Census County Business Patterns 2023 by ZIP
// code: business locations with paid employees, per NAICS industry; each ZIP carries the Postal Service's city name. Colorado ZIPs are
// 80xxx and 81xxx. Writes cities.json and cities.csv beside this file.
//   node traverse/research/markets/build-cities.mjs
import { readFileSync, writeFileSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), REPO = join(HERE, '..', '..', '..');
const KEY = readFileSync(join(REPO, 'traverse', 'data-pipeline', 'door-territory', 'census-key.txt'), 'utf8').trim();
const TRADES = [['yards', '561730'], ['roofing', '238160'], ['pest', '561710'], ['security', '561621'], ['solar', '238210']];
const cities = {};
for (const [ed, code] of TRADES) {
  const r = await fetch(`https://api.census.gov/data/2023/cbp?get=NAME,ESTAB&for=zip%20code:*&NAICS2017=${code}&key=${KEY}`);
  const j = await r.json(); const h = j[0], zi = h.indexOf('zip code'), ni = h.indexOf('NAME'), ei = h.indexOf('ESTAB');
  for (const row of j.slice(1)) {
    const z = row[zi]; if (!/^8[01]\d{3}$/.test(z)) continue;
    const m = /\(([^,]+), CO\)/.exec(row[ni]); const city = m ? m[1] : 'ZIP ' + z;
    const c = cities[city] || (cities[city] = { city, zips: new Set() }); c.zips.add(z); c[ed] = (c[ed] || 0) + (+row[ei] || 0);
  }
}
const list = Object.values(cities).map((c) => ({ ...c, zips: [...c.zips].sort(), all: TRADES.reduce((s, [ed]) => s + (c[ed] || 0), 0) })).sort((a, b) => (b.yards || 0) - (a.yards || 0));
writeFileSync(join(HERE, 'cities.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), source: 'US Census Bureau, County Business Patterns 2023 by ZIP code (api.census.gov/data/2023/cbp, zip code); city = the ZIP\'s Postal Service name', note: 'Counts business locations with paid employees; one-person shops without payroll are not counted. The electrical code stands in for solar and overstates it.', cities: list }, null, 1));
writeFileSync(join(HERE, 'cities.csv'), 'city,yards,roofing,pest,security,solar,zips\n' + list.map((c) => [c.city.includes(',') ? '"' + c.city + '"' : c.city, c.yards || 0, c.roofing || 0, c.pest || 0, c.security || 0, c.solar || 0, '"' + c.zips.join(' ') + '"'].join(',')).join('\n') + '\n');
console.log('cities', list.length);
for (const c of list.slice(0, 25)) console.log(c.city.padEnd(22), 'lawn', String(c.yards || 0).padStart(4), 'roof', String(c.roofing || 0).padStart(4), 'pest', String(c.pest || 0).padStart(3), 'sec', String(c.security || 0).padStart(3), 'elec', String(c.solar || 0).padStart(4));
