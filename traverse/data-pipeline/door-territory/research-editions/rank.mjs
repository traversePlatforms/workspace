/* Which Colorado towns suit each edition (2026-10-07, Matthew: "each edition should have whatever the best towns are for that
 * field in the state of Colorado"). One table, every place with 1,500+ owner-occupied homes:
 *   - ACS 2020-2024 five-year (Census Reporter): owner-occupied homes, share detached, median value, income, median year built
 *   - the county (TIGERweb county shapes), and whether its parcel records carry what a door list needs
 *   - hail: NWS Local Storm Reports (the wind build's cache, ../wind/cache/lsr-co-YYYY.csv), days from 1 Oct 2021 with a report
 *     of 1 in or more within 5 miles of the place's centre, and of 1.75 in or more. Reports follow people: towns get more than
 *     open country, so this ranks towns against towns, not against the plains.
 *   node rank.mjs   -> places-ranked.json */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const places = JSON.parse(readFileSync(join(HERE, 'places.json'), 'utf8'));
const CR = join(HERE, 'acs-places.json');
if (!existsSync(CR)) {
  const r = await fetch('https://api.censusreporter.org/1.0/data/show/latest?table_ids=B25003,B25077,B19013,B25024,B25035&geo_ids=160|04000US08');
  writeFileSync(CR, await r.text());
}
const acs = JSON.parse(readFileSync(CR, 'utf8'));
/* counties: shapes once */
const CF = join(HERE, 'counties.json');
if (!existsSync(CF)) {
  const q = new URLSearchParams({ where: "STATE='08'", outFields: 'NAME', returnGeometry: 'true', outSR: '4326', f: 'json', maxAllowableOffset: '0.002' });
  const j = await (await fetch('https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query?' + q)).json();
  writeFileSync(CF, JSON.stringify(j.features.map((f) => ({ name: f.attributes.NAME.replace(/ County$/, '').toUpperCase(), rings: f.geometry.rings }))));
}
const counties = JSON.parse(readFileSync(CF, 'utf8'));
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const countyOf = (lat, lon) => { for (const c of counties) { let n = 0; for (const r of c.rings) if (inRing(lon, lat, r)) n++; if (n % 2) return c.name; } return null; };
/* parcel fields per county (build-walklist-co.mjs --coverage, 2026-10-07) */
const DATA = { DOUGLAS: 'ready', TELLER: 'ready', JEFFERSON: 'ready', ADAMS: 'ready', BROOMFIELD: 'ready', WELD: 'ready', MESA: 'ready', ELBERT: 'ready',
  DENVER: 'lot size from shape', ARAPAHOE: 'lot size from shape', LARIMER: 'lot size from shape', BOULDER: 'no land use', 'EL PASO': 'El Paso builder', PUEBLO: 'no addresses' };
/* hail reports */
const reports = [];
for (let y = 2021; y <= 2026; y++) {
  const f = join(HERE, '..', 'wind', 'cache', `lsr-co-${y}.csv`); if (!existsSync(f)) continue;
  const lines = readFileSync(f, 'utf8').split(/\r?\n/); const h = lines.shift().split(',');
  const ix = (k) => h.indexOf(k), iV = ix('VALID2'), iLa = ix('LAT'), iLo = ix('LON'), iM = ix('MAG'), iT = ix('TYPETEXT');
  for (const l of lines) { const c = l.split(','); if (c[iT] !== 'HAIL') continue; const day = String(c[iV]).slice(0, 10).replace(/\//g, '-'); if (day < '2021-10-01') continue;
    const m = parseFloat(c[iM]); if (!(m >= 1)) continue; reports.push({ day, lat: +c[iLa], lon: +c[iLo], m }); }
}
const miles = (a, b, c, d) => { const p = Math.PI / 180, dLa = (c - a) * p, dLo = (d - b) * p; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin(dLo / 2) ** 2; return 7917.6 * Math.asin(Math.sqrt(x)); };
const rows = [];
for (const [g, d] of Object.entries(acs.data)) {
  const e = (t, k) => (d[t] && d[t].estimate && d[t].estimate[k]) || 0;
  const occ = e('B25003', 'B25003001'), own = e('B25003', 'B25003002'); if (own < 1500) continue;
  const p = places[g]; if (!p) continue;
  const units = e('B25024', 'B25024001'), det = e('B25024', 'B25024002');
  const days1 = new Set(), days175 = new Set();
  for (const r of reports) { if (Math.abs(r.lat - p.lat) > 0.08 || Math.abs(r.lon - p.lon) > 0.1) continue; if (miles(p.lat, p.lon, r.lat, r.lon) > 5) continue; days1.add(r.day); if (r.m >= 1.75) days175.add(r.day); }
  const county = countyOf(p.lat, p.lon);
  rows.push({ geo: g, name: (acs.geography[g] || {}).name || p.name, county, data: DATA[county] || 'unchecked', lat: p.lat, lon: p.lon,
    own, ownDet: Math.round(own * (units ? det / units : 0)), detPct: units ? Math.round(100 * det / units) : 0, value: e('B25077', 'B25077001'), income: e('B19013', 'B19013001'),
    yb: e('B25035', 'B25035001'), hail1: days1.size, hail175: days175.size });
}
writeFileSync(join(HERE, 'places-ranked.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), acs: acs.release, hailFrom: '2021-10-01', rows }, null, 1));
console.log(rows.length + ' places with 1,500+ owner-occupied homes; ' + reports.length + ' hail reports of 1 in+ since Oct 2021');
