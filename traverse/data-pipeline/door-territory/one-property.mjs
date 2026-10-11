// One property as its own admin-only town, for a single job outside the built towns (2026-10-11: a tree quote in Bailey).
// Builds the door the same way the towns are built: the state parcel layer (lot, acres, owner, county value), the house
// from the Microsoft building outlines, the USFS wildfire hazard class, trees near the house from the canopy map, the
// 2023 NAIP photo, and wind reports within 10 miles. Writes into an output folder only (never app/data/rounds), so the
// town reaches the one install it is uploaded to and no edition build picks it up.
//   node one-property.mjs --key bailey --label "Bailey" --area "Old Corral Rd" --situs "156 OLD RRAL RD" \
//        --address "156 OLD CORRAL RD" --lat 39.445627 --lon -105.461233 --out ../../../sixfold/one-off/bailey
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'; import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path'; import { fileURLToPath } from 'node:url';
import { PARCELS, json, quadkey, loadBuildings, pickHouse, measure } from './tree-zones/zones.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const A = {}; for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const lat0 = +A.lat, lon0 = +A.lon, OUT = resolve(A.out); mkdirSync(OUT, { recursive: true });
const built = new Date().toISOString().slice(0, 10);
const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);
const log = (...a) => console.log(...a);

/* 1. the lot: the parcel near the point whose situs address matches (county spelling) */
const pj = await json(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: [lon0 - 0.004, lat0 - 0.003, lon0 + 0.004, lat0 + 0.003].join(','), geometryType: 'esriGeometryEnvelope',
  inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'situsAdd,landAcres,owner,apprValTot,subName,dateReceived', geometryPrecision: '7', resultRecordCount: '200' }));
const P = (pj.features || []).find((f) => String(f.attributes.situsAdd || '').trim().toUpperCase() === A.situs.toUpperCase());
if (!P) throw new Error('no parcel with that situs address near the point');
const lot = P.geometry.rings, at = P.attributes;
log('lot', at.landAcres, 'acres; subdivision', at.subName);

/* 2. the house: the largest building outline on the lot (the zoom-9 tile is downloaded once) */
const qk = quadkey(lon0, lat0, 9);
const bdir = join(HERE, 'tree-zones', 'buildings');
if (!existsSync(join(bdir, qk + '.geojsonl.gz')) && !existsSync(join(bdir, qk + '.geojson.gz'))) execFileSync('node', ['fetch-buildings.mjs', qk], { cwd: join(HERE, 'tree-zones'), stdio: 'inherit' });
const blds = await loadBuildings(bdir, [lon0 - 0.004, lat0 - 0.003, lon0 + 0.004, lat0 + 0.003]);
const house = pickHouse(lot, blds);
let lat = lat0, lon = lon0;
if (house) { const r = house.ring; lon = +(r.reduce((s, p) => s + p[0], 0) / r.length).toFixed(6); lat = +(r.reduce((s, p) => s + p[1], 0) / r.length).toFixed(6); log('house outline found; pin at', lat, lon); }
else { const r = lot[0]; lon = +(r.reduce((s, p) => s + p[0], 0) / r.length).toFixed(6); lat = +(r.reduce((s, p) => s + p[1], 0) / r.length).toFixed(6); log('no house outline; pin at the lot centre'); }

/* 3. wildfire hazard (USFS WHP 2023, 270 m): 1 very low .. 5 very high, 6 non-burnable, 7 water */
const WHP = 'https://imagery.geoplatform.gov/iipp/rest/services/Fire_Aviation/USFS_EDW_RMRS_WildfireHazardPotentialClassified/ImageServer/getSamples';
const wj = await json(WHP + '?' + new URLSearchParams({ f: 'json', geometry: JSON.stringify({ points: [[lon, lat]], spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryMultipoint', returnFirstValueOnly: 'true' }));
const fire = wj.samples && wj.samples[0] ? +wj.samples[0].value : null;
log('wildfire hazard class', fire);

/* 4. trees near the house (canopy map: Park County has no 3DEP LiDAR; the map undercounts tall conifers) */
let trees = null;
if (house) { const m = await measure(lat, lon, lot, house); if (!m.err && m.z2 != null) trees = { z1: m.z1 ?? 0, z2: m.z2, z3: m.z3 ?? null, h: m.h ?? 0, src: 'canopy', yr: null }; }
log('trees', JSON.stringify(trees));

/* 5. the 2023 NAIP photo over the house (as roofs/material: item + the outline's box grown 1.6x) */
const sj = await (await fetch('https://planetarycomputer.microsoft.com/api/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ collections: ['naip'], intersects: { type: 'Point', coordinates: [lon, lat] }, datetime: '2023-01-01/2023-12-31', limit: 5 }) })).json();
const item = (sj.features || [])[0];
let naip = null;
if (item) {
  const r = house ? house.ring : [[lon - 0.00025, lat - 0.0002], [lon + 0.00025, lat + 0.0002]];
  const xs = r.map((p) => p[0]), ys = r.map((p) => p[1]); const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const hx = Math.max((Math.max(...xs) - Math.min(...xs)) / 2 * 1.6, 0.00025), hy = Math.max((Math.max(...ys) - Math.min(...ys)) / 2 * 1.6, 0.0002);
  naip = [item.id, +(cx - hx).toFixed(6), +(cy - hy).toFixed(6), +(cx + hx).toFixed(6), +(cy + hy).toFixed(6)];
}
log('naip', naip && naip[0]);

/* 6. wind reports within 10 miles (wind/cache, as wind/build-wind.mjs: per Colorado day the strongest gust >= 50 mph, else the
   nearest damage report; ten kept, the strongest, newest first) */
const WC = join(HERE, 'wind', 'cache'); const wind = [];
{
  const TYPES = new Set(['G', 'D', 'N', 'O', 'A']), DAMAGE = new Set(['D', 'O']);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' });
  const mi = (a, b, c, d) => { const p = Math.PI / 180, x = Math.sin((c - a) * p / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin((d - b) * p / 2) ** 2; return 2 * 3958.8 * Math.asin(Math.sqrt(x)); };
  const byDay = new Map();
  for (let y = 2020; y <= new Date().getFullYear(); y++) {
    const f = join(WC, `lsr-co-${y}.csv`); if (!existsSync(f)) continue;
    const rows = readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split(','));
    const h = rows.shift(); const c = Object.fromEntries(h.map((k, i) => [k.trim(), i]));
    for (const r of rows) {
      const t = r[c.TYPECODE]; if (!TYPES.has(t) || r[c.STATE] !== 'CO' || /PIKES PEAK/i.test(r[c.CITY] || '')) continue;
      const la = +r[c.LAT], lo = +r[c.LON]; if (!la || !lo) continue; const d = mi(lat, lon, la, lo); if (d > 10) continue;
      const mag = parseFloat(r[c.MAG]), mph = mag > 0 ? Math.round(mag) : null, q = (r[c.QUALIFIER] || '').trim().toUpperCase();
      let kind; if (DAMAGE.has(t)) kind = 'damage'; else if (mph === null || mph < 50) continue; else kind = q === 'M' ? 'measured' : 'estimated';
      const day = fmt.format(new Date(r[c.VALID2].replace(' ', 'T').replace(/\//g, '-') + ':00Z'));
      const cur = byDay.get(day); const e = { day, mph: kind === 'damage' ? (mph || null) : mph, kind, d };
      if (!cur || (e.kind !== 'damage' && (cur.kind === 'damage' || e.mph > cur.mph)) || (e.kind === 'damage' && cur.kind === 'damage' && e.d < cur.d)) byDay.set(day, e);
    }
  }
  const all = [...byDay.values()].sort((a, b) => (b.mph ?? 58) - (a.mph ?? 58)).slice(0, 10).sort((a, b) => (a.day < b.day ? 1 : -1));
  for (const e of all) wind.push(`${e.day}|${e.mph ?? ''}|${e.kind}|${Math.round(e.d)}`);
}
log('wind days', wind.length);

/* 7. the files */
const id = slug(A.address);
const door = { id, address: A.address, acres: at.landAcres != null ? +(+at.landAcres).toFixed(2) : null, owner: String(at.owner || '').trim(), lat, lon, fire, lawn: null, trees, val: at.apprValTot > 0 ? Math.round(at.apprValTot) : null };
const town = { key: A.key, label: A.label, built, admin: true, areas: [{ name: A.area, avg: 10, place: at.subName ? { n: String(at.subName).trim(), k: 'sub', s: 1 } : null, fw: null, doors: [door] }] };
writeFileSync(join(OUT, `${A.key}.json`), JSON.stringify(town));
if (naip) writeFileSync(join(OUT, `naip-${A.key}.json`), JSON.stringify({ source: 'USDA NAIP 2023 via Microsoft Planetary Computer', built, doors: { [id]: naip } }));
writeFileSync(join(OUT, `wind-${A.key}.json`), JSON.stringify({ source: 'NWS Local Storm Reports (Iowa Environmental Mesonet archive)', radiusMi: 10, minMph: 50, built, from: '2020-01-01', through: built, keep: 10, cap: 10, capped: 0, format: 'date|mph|kind|miles', doors: wind.length ? { [id]: wind } : {} }));
writeFileSync(join(OUT, 'index-entry.json'), JSON.stringify({ key: A.key, label: A.label, c: [+lat.toFixed(4), +lon.toFixed(4)], areas: 1, doors: 1, admin: true, ...(A.county ? { county: A.county } : {}) }));   /* --county park: the app's county heading */
log('written to', OUT);
