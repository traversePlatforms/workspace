/* Which lawn counts? Calibrates the "compact lawn" rule against Fable's blind estimates of the
   12 check lots (2026-10-03). For each lot: every lawn patch the classifier found, its size,
   and how far it is from the house; then the lawn total under a few rules.
   Run: node compact-calibrate.mjs <answers.json>                                             */
import proj4 from 'proj4';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure, STAC, json, patches } from './lawn-mask.mjs';
import { loadBuildings, pickHouse } from '../tree-zones/zones.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const answers = JSON.parse(readFileSync(process.argv[2], 'utf8'));
/* Fable, blind, from the photos alone (0 = no lawn) */
const FABLE = { '01': 0, '02': 6000, '03': 0, '04': 5500, '05': 3000, '06': 0, '07': 0 /* artificial turf, see notes */, '08': 0, '09': 4500, '10': 7500, '11': 5000, '12': 1000 };
const doors = new Map();
for (const f of ['black-forest', 'palmer-lake', 'monument']) for (const a of JSON.parse(readFileSync(join(HERE, '..', '..', '..', 'site', 'data', 'rounds', f + '.json'), 'utf8')).areas) for (const d of a.doors) doors.set(d.id, d);


const RULES = [[150, Infinity], [400, Infinity], [800, Infinity], [150, 40], [400, 40], [400, 30], [800, 40], [400, 60]];
const rows = [];
for (const a of answers) {
  const id = a.door.split('/')[1], d = doors.get(id);
  const pj = await json(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${d.lon},${d.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID' }));
  const rings = pj.features[0].geometry.rings;
  const st = await json(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], bbox: [d.lon - 0.0005, d.lat - 0.0005, d.lon + 0.0005, d.lat + 0.0005], query: { 'naip:year': { eq: '2023' } }, limit: 10 }) });
  const it = st.features.map((f) => ({ id: f.id, href: f.assets.image.href, date: f.properties.datetime.slice(0, 10), bb: f.bbox, gsd: f.properties.gsd })).filter((f) => d.lon >= f.bb[0] && d.lon <= f.bb[2] && d.lat >= f.bb[1] && d.lat <= f.bb[3]).sort((x, y) => x.gsd - y.gsd)[0];
  const m = await measure({ la: d.lat, lo: d.lon, detail: true }, rings, it);
  const D = m.detail;
  const xs = rings.flat().map((p) => p[0]), ys = rings.flat().map((p) => p[1]);
  const blds = await loadBuildings(join(HERE, '..', 'tree-zones', 'buildings'), [Math.min(...xs) - 0.001, Math.min(...ys) - 0.001, Math.max(...xs) + 0.001, Math.max(...ys) + 0.001]);
  const house = pickHouse(rings, blds);
  const houseLocal = house ? house.ring.map(([lo, la]) => { const [X, Y] = proj4('EPSG:4326', D.epsg, [lo, la]); return [(X - D.origin[0]) / D.res[0] - D.x0, (Y - D.origin[1]) / D.res[1] - D.y0]; }) : null;
  const ps = patches(D, houseLocal);
  const tot = (minSq, nearM) => Math.round(ps.filter((p) => p.sqft >= minSq && (nearM === Infinity || (p.distM ?? Infinity) <= nearM)).reduce((s, p) => s + p.sqft, 0));
  rows.push({ tag: a.tag, fable: FABLE[a.tag], vals: RULES.map(([s, n]) => tot(s, n)), patches: ps.length, house: !!house });
}
console.log('lot  fable   ' + RULES.map(([s, n]) => `${s}/${n === Infinity ? 'any' : n + 'm'}`.padStart(9)).join(''));
for (const r of rows) console.log(`${r.tag}  ${String(r.fable).padStart(5)}  ` + r.vals.map((v) => String(v).padStart(9)).join('') + `   (${r.patches} patches${r.house ? '' : ', NO HOUSE'})`);
/* error against Fable, ignoring lot 10 (the classifier missed its real lawn; no rule can fix that) */
console.log('\nmean abs error vs Fable, sq ft (lot 10 left out):');
RULES.forEach(([s, n], i) => { const e = rows.filter((r) => r.tag !== '10').map((r) => Math.abs(r.vals[i] - r.fable)); console.log(`  patch >= ${s} sq ft, ${n === Infinity ? 'anywhere' : 'within ' + n + ' m of the house'}: ${Math.round(e.reduce((a, b) => a + b, 0) / e.length)}`); });
