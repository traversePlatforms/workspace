// DRCOG turf for every house in a town (2026-10-21, Matthew: "lets schedule to run DRCOG turf scans over highlands ranch tonight").
// For each door: the lot line from the state parcel layer (fetched by area, not per house), then DRCOG's 2020 land cover inside it:
// turf/irrigated (class 6) and tree canopy (class 5), in sq ft. Run by the Wi-Fi queue (jobs/drcogturf.sh), a slice per run; resumes.
//   node drcog-turf-town.mjs --town=highlands-ranch --max=5000     exit 0 = town finished, 3 = more left
// Output: drcog-turf/turf-<town>.json { source, built, doors: { id: { turf, tt, lot } } }. Nothing goes to the app until it is checked.
// DRCOG's terms for commercial use are not stated (Matthew is sending the request); this is a trial layer.
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const TOWN = arg('town'), MAX = +arg('max', 5000);
if (!TOWN) { console.error('--town= needed'); process.exit(1); }
const DATA = 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/app/data/rounds';
const OUTD = new URL('./drcog-turf/', import.meta.url); mkdirSync(OUTD, { recursive: true });
const OUT = new URL(`turf-${TOWN}.json`, OUTD), PCACHE = new URL(`parcels-${TOWN}.json`, OUTD);
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
proj4.defs('EPSG:6428', '+proj=lcc +lat_0=37.8333333333333 +lon_0=-105.5 +lat_1=39.75 +lat_2=38.45 +x_0=914401.828803658 +y_0=304800.609601219 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u, o) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u, o); if (r.ok) return await r.json(); } catch {} await sleep(1500 * (i + 1)); } throw new Error('fetch failed ' + u.slice(0, 70)); };
const inRing = (x, y, ring) => { let ins = false; for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[k]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
const inRings = (x, y, rr) => { let n = 0; for (const r of rr) if (inRing(x, y, r)) n++; return n % 2 === 1; };
const doors = JSON.parse(readFileSync(`${DATA}/${TOWN}.json`, 'utf8')).areas.flatMap((a) => a.doors).filter((d) => d.lat && d.lon);
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { source: 'DRCOG 2020 Regional Land Use Land Cover (Planetary Computer drcog-lulc), class 6 turf/irrigated and class 5 tree canopy, inside the state parcel layer lot line', built: '', doors: {} };
const todo = doors.filter((d) => !(d.id in out.doors));
console.log(`${TOWN}: ${doors.length} doors, ${todo.length} to do`);
if (!todo.length) { process.exit(0); }
/* 1. lot lines by area: a grid of cells over the town, every parcel in each cell (paged), kept on disk */
const pc = existsSync(PCACHE) ? JSON.parse(readFileSync(PCACHE, 'utf8')) : { cells: {} };
const lats = doors.map((d) => d.lat), lons = doors.map((d) => d.lon), S = 0.008;
const la0 = Math.min(...lats) - 0.002, lo0 = Math.min(...lons) - 0.002, la1 = Math.max(...lats) + 0.002, lo1 = Math.max(...lons) + 0.002;
const cellOf = (lat, lon) => Math.floor((lat - la0) / S) + ':' + Math.floor((lon - lo0) / S);
const fetchCell = async (c) => {   /* every lot in one cell, paged, kept on disk */
  if (pc.cells[c]) return pc.cells[c];
  const [i, k] = c.split(':').map(Number), env = [lo0 + k * S, la0 + i * S, lo0 + (k + 1) * S, la0 + (i + 1) * S];
  const feats = []; let off = 0;
  for (;;) {
    const j = await get(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: env.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID', resultOffset: String(off), resultRecordCount: '2000', geometryPrecision: '7' }));
    for (const f of j.features || []) if (f.geometry && f.geometry.rings) feats.push(f.geometry.rings);
    if (!j.exceededTransferLimit && (j.features || []).length < 2000) break;
    off += (j.features || []).length;
  }
  pc.cells[c] = feats; writeFileSync(PCACHE, JSON.stringify(pc));
  return feats;
};
/* 2. DRCOG land cover: the 2020 tiles, opened once each, blocks cached by geotiff */
const tok = (await get('https://planetarycomputer.microsoft.com/api/sas/v1/token/drcog-lulc')).token;
const tiles = new Map();   /* item id -> { im, o, r, w, h } */
const tileFor = async (d) => {
  const ls = await get('https://planetarycomputer.microsoft.com/api/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['drcog-lulc'], intersects: { type: 'Point', coordinates: [d.lon, d.lat] }, limit: 10 }) });
  const li = (ls.features || []).filter((f) => /2020/.test(f.id))[0]; if (!li) return null;
  if (!tiles.has(li.id)) { const a = Object.values(li.assets).find((x) => /tif/.test(x.type || '') || /\.tif/.test(x.href)); const im = await (await fromUrl(a.href + '?' + tok, { cacheSize: 400 })).getImage(); if ('EPSG:' + im.geoKeys.ProjectedCSTypeGeoKey !== 'EPSG:6428') return null; tiles.set(li.id, { im, o: im.getOrigin(), r: im.getResolution(), w: im.getWidth(), h: im.getHeight(), bbox: li.bbox }); }
  return tiles.get(li.id);
};
const inBbox = (t, d) => t.bbox && d.lon >= t.bbox[0] && d.lon <= t.bbox[2] && d.lat >= t.bbox[1] && d.lat <= t.bbox[3];
let done = 0, noLot = 0, noCover = 0, t0 = Date.now();
const MINS = +arg('mins', 45), byCell = {}; for (const d of todo) (byCell[cellOf(d.lat, d.lon)] = byCell[cellOf(d.lat, d.lon)] || []).push(d);
const save = () => { out.built = new Date().toISOString().slice(0, 10); writeFileSync(OUT, JSON.stringify(out)); };
cellLoop: for (const c of Object.keys(byCell)) {   /* area by area, saved after each: a stop loses at most one area */
  if (done >= MAX || Date.now() - t0 > MINS * 60000) break;
  const lots = await fetchCell(c);
  for (const d of byCell[c]) {
  const rings = lots.find((rr) => inRings(d.lon, d.lat, rr));
  if (!rings) { out.doors[d.id] = null; noLot++; done++; continue; }
  if (process.env.DBG) console.log('  lot found', d.id, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  let t = [...tiles.values()].find((x) => inBbox(x, d)); if (!t) t = await tileFor(d);
  if (process.env.DBG) console.log('  tile', !!t, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  if (!t) { out.doors[d.id] = null; noCover++; done++; continue; }
  const lp = rings.map((r) => r.map(([a, b]) => { const [X, Y] = proj4('EPSG:4326', 'EPSG:6428', [a, b]); return [(X - t.o[0]) / t.r[0], (Y - t.o[1]) / t.r[1]]; }));
  const lx = lp.flat().map((p) => p[0]), ly = lp.flat().map((p) => p[1]);
  const a0 = Math.max(0, Math.floor(Math.min(...lx)) - 1), b0 = Math.max(0, Math.floor(Math.min(...ly)) - 1), a1 = Math.min(t.w, Math.ceil(Math.max(...lx)) + 1), b1 = Math.min(t.h, Math.ceil(Math.max(...ly)) + 1);
  if (a1 <= a0 || b1 <= b0) { out.doors[d.id] = null; noCover++; done++; continue; }
  if ((a1 - a0) * (b1 - b0) > 9e5) { out.doors[d.id] = { big: 1 }; done++; continue; }   /* over about 20 acres: open space or a golf course, not a yard (and slow to read) */
  const [Cl] = await t.im.readRasters({ window: [a0, b0, a1, b1] }); const lw = a1 - a0, loc = lp.map((r) => r.map(([a, b]) => [a - a0, b - b0]));
  let t6 = 0, t5 = 0, all = 0;
  for (let y = 0; y < b1 - b0; y++) for (let x = 0; x < lw; x++) { if (!inRings(x + 0.5, y + 0.5, loc)) continue; all++; const c = Cl[y * lw + x]; if (c === 6) t6++; else if (c === 5) t5++; }
  const ft2 = Math.abs(t.r[0] * t.r[1]) * (1200 / 3937) ** 2 * 10.7639, r100 = (n) => Math.round(n * ft2 / 100) * 100;   /* US survey feet */
  out.doors[d.id] = { turf: r100(t6), tt: r100(t6 + t5), lot: r100(all), pk: rings[0][0].map((v) => v.toFixed(6)).join(',') };   /* pk: the lot's first corner, to find homes sharing one lot */
  if (process.env.DBG) console.log(d.id, JSON.stringify(out.doors[d.id]), ((Date.now() - t0) / 1000).toFixed(1) + 's');
  ++done;
  }
  save(); console.log(`area ${c}: ${byCell[c].length} homes, ${done} this run, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}
/* homes sharing one lot (townhomes, condos): the turf is the whole complex's, not theirs */
const byPk = {}; for (const v of Object.values(out.doors)) if (v && v.pk) byPk[v.pk] = (byPk[v.pk] || 0) + 1;
for (const v of Object.values(out.doors)) if (v && v.pk) { if (byPk[v.pk] > 1) v.shared = byPk[v.pk]; else delete v.shared; }
out.built = new Date().toISOString().slice(0, 10); writeFileSync(OUT, JSON.stringify(out));
const left = doors.filter((d) => !(d.id in out.doors)).length;
console.log(`slice done: ${done} (no lot ${noLot}, no land cover ${noCover}); ${left} left`);
process.exit(left ? 3 : 0);
