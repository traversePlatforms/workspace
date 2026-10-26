// Yard v2 for every house in a town (2026-10-24, Matthew: "we need to prioritize getting the lawns as accurate as we can get it").
// Yard v2 (yard-scan-v2.mjs) beat the app's lawn sizes on 11 lawns it was never tuned on: median miss 22% against 71%.
// For each door: the lot line from the state parcel layer (fetched by area, the cells shared with drcog-turf-town.mjs), then yardSources
// + yardClassify with the V2 settings, several lots at a time. Run by the Wi-Fi queue (jobs/yardv2.sh), a slice per run; resumes.
//   node yard-v2-town.mjs --town=thornton [--mins=45] [--conc=6]     exit 0 = town finished, 3 = more left
// Output: yard-v2/<town>.json { built, settings, doors: { id: { l, s, u, o, t, dt, lot, sv, ph } | { big } | { shared } | null } }
//   l lawn (sq ft) · s seen in the photo · u filled under tree crowns · o open ground · t tree crown · dt DRCOG turf · lot · sv laser survey
//   ph photo date. null = no lot line at the door's point. Nothing reaches the app until build-yard-v2.mjs puts it in the door files.
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { yardSources, yardClassify, V2 } from './yard-scan-v2.mjs';
/* tmp + rename (2026-10-25): the cloud disk filled overnight and left arvada.json cut short and 89 empty parcel files */
const writeSafe = (f, s) => { const tmp = new URL(f.href + '.tmp'); writeFileSync(tmp, s); renameSync(tmp, f); };
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const TOWN = arg('town'), MINS = +arg('mins', 45), CONC = +arg('conc', 6);
if (!TOWN) { console.error('--town= needed'); process.exit(1); }
const DATA = process.env.YV2_DATA || 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/app/data/rounds';   /* YV2_DATA: the cloud run's slim door files (2026-10-24) */
const OUTD = new URL('./yard-v2/', import.meta.url); mkdirSync(OUTD, { recursive: true });
const OUT = new URL(`${TOWN}.json`, OUTD);
const PCD = new URL('./drcog-turf/', import.meta.url); mkdirSync(PCD, { recursive: true });
const PCACHE = new URL(`parcels-${TOWN}.json`, PCD);   /* the same lot-line cells drcog-turf-town.mjs keeps */
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch {} await sleep(1500 * (i + 1)); } throw new Error('fetch failed ' + u.slice(0, 70)); };
const inRing = (x, y, ring) => { let ins = false; for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[k]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
const inRings = (x, y, rr) => { let n = 0; for (const r of rr) if (inRing(x, y, r)) n++; return n % 2 === 1; };
const acres = (ring) => { const k = Math.cos(ring[0][1] * Math.PI / 180) * 111320, m = 110540; let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] * k) * (ring[i][1] * m) - (ring[i][0] * k) * (ring[j][1] * m); return Math.abs(a / 2) / 4046.86; };
const doors = JSON.parse(readFileSync(`${DATA}/${TOWN}.json`, 'utf8')).areas.flatMap((a) => a.doors).filter((d) => d.lat && d.lon);
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { built: '', settings: V2, doors: {} };
/* --redo-nodt: measure again the lots that went without DRCOG land cover (2026-10-24: a refused token left it out on 27-48% of the
   lots in the first three towns). Only for towns DRCOG covers (Denver region); El Paso has none, so there it stays empty. */
if (process.argv.includes('--redo-nodt')) for (const [id, v] of Object.entries(out.doors)) if (v && v.l != null && v.dt == null) delete out.doors[id];
const todo = doors.filter((d) => !(d.id in out.doors));
console.log(`${TOWN}: ${doors.length} doors, ${todo.length} to do, ${CONC} at a time`);
if (!todo.length) process.exit(0);
const pc = existsSync(PCACHE) ? JSON.parse(readFileSync(PCACHE, 'utf8')) : { cells: {} };
const lats = doors.map((d) => d.lat), lons = doors.map((d) => d.lon), S = 0.008;
/* origin on a fixed 0.008° grid (2026-10-26): it was the town's lowest house, so new houses to the south or west (the 25 Oct gap fix)
   shifted every cell and the saved cells answered for the wrong ground. A cache saved on another origin starts again. */
const la0 = Math.floor((Math.min(...lats) - 0.002) / S) * S, lo0 = Math.floor((Math.min(...lons) - 0.002) / S) * S;
if (!pc.o || pc.o[0] !== la0 || pc.o[1] !== lo0) pc.cells = {}, pc.o = [la0, lo0];
const cellOf = (lat, lon) => Math.floor((lat - la0) / S) + ':' + Math.floor((lon - lo0) / S);
async function fetchCell(c) {
  if (pc.cells[c]) return pc.cells[c];
  const [i, k] = c.split(':').map(Number), env = [lo0 + k * S, la0 + i * S, lo0 + (k + 1) * S, la0 + (i + 1) * S];
  const feats = []; let off = 0;
  for (;;) {
    const j = await get(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: env.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID', resultOffset: String(off), resultRecordCount: '2000', geometryPrecision: '7' }));
    for (const f of j.features || []) if (f.geometry && f.geometry.rings) feats.push(f.geometry.rings);
    if (!j.exceededTransferLimit && (j.features || []).length < 2000) break;
    off += (j.features || []).length;
  }
  pc.cells[c] = feats; writeSafe(PCACHE, JSON.stringify(pc));
  return feats;
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timed out')), ms))]);
async function one(d, lots, pkCount) {
  const rings = lots.find((rr) => inRings(d.lon, d.lat, rr));
  if (!rings) { out.doors[d.id] = null; return 'nolot'; }
  const pk = rings[0][0].map((v) => v.toFixed(6)).join(',');
  if (acres(rings[0]) > 5) { out.doors[d.id] = { big: 1 }; return 'big'; }   /* acreage, open space, a park: not one yard, and slow to read */
  const S0 = await withTimeout(yardSources(rings), 180000), R = yardClassify(S0, V2);
  out.doors[d.id] = { l: R.lawn, s: R.seen, u: R.under, o: R.open, t: R.trees, dt: R.drcogTurf ?? null, lot: R.lot, sv: R.survey || null, ph: R.photo23 || null, pk };
  return 'ok';
}
let done = 0, err = 0, nolot = 0; const t0 = Date.now();
const byCell = {}; for (const d of todo) (byCell[cellOf(d.lat, d.lon)] = byCell[cellOf(d.lat, d.lon)] || []).push(d);
const save = () => { out.built = new Date().toISOString().slice(0, 10); writeSafe(OUT, JSON.stringify(out)); };
for (const c of Object.keys(byCell)) {   /* area by area, saved after each: a stop loses at most one area */
  if (Date.now() - t0 > MINS * 60000) break;
  const lots = await fetchCell(c), q = byCell[c].slice();
  await Promise.all(Array.from({ length: CONC }, async () => {
    for (let d; (d = q.shift());) {
      try { const r = await one(d, lots); if (r === 'nolot') nolot++; done++; }
      catch (e) { err++; if (err < 20) console.log('  ' + d.id + ': ' + String(e.message).slice(0, 90)); }   /* left out: tried again next run */
    }
  }));
  save(); console.log(`area ${c}: ${byCell[c].length} homes · ${done} this run · ${(done / ((Date.now() - t0) / 1000)).toFixed(2)} a second · ${err} errors`);
}
/* homes sharing one lot (townhomes, condos): the yard is the complex's, not theirs */
const byPk = {}; for (const v of Object.values(out.doors)) if (v && v.pk) byPk[v.pk] = (byPk[v.pk] || 0) + 1;
for (const v of Object.values(out.doors)) if (v && v.pk) { if (byPk[v.pk] > 1) v.shared = byPk[v.pk]; else delete v.shared; }
save();
const left = doors.filter((d) => !(d.id in out.doors)).length;
console.log(`slice done: ${done} (no lot ${nolot}, errors ${err}) in ${((Date.now() - t0) / 60000).toFixed(1)} min; ${left} left`);
process.exit(left ? 3 : 0);
