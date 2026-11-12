// Yard v2 for every house in a town (2026-10-24, Matthew: "we need to prioritize getting the lawns as accurate as we can get it").
// Yard v2 (yard-scan-v2.mjs) beat the app's lawn sizes on 11 lawns it was never tuned on: median miss 22% against 71%.
// For each door: the lot line from the state parcel layer (fetched by area, the cells shared with drcog-turf-town.mjs), then yardSources
// + yardClassify with the V2 settings, several lots at a time. Run by the Wi-Fi queue (jobs/yardv2.sh), a slice per run; resumes.
//   node yard-v2-town.mjs --town=thornton [--mins=45] [--conc=6]     exit 0 = town finished, 3 = more left
// Output: yard-v2/<town>.json { built, settings, doors: { id: { l, s, u, o, t, dt, lot, sv, ph, pk, lk } | { big } | { shared } | null } }
//   l lawn (sq ft) · s seen in the photo · u filled under tree crowns · o open ground · t tree crown · dt DRCOG turf · lot · sv laser survey
//   ph photo date. null = no lot line at the door's point. Nothing reaches the app until build-yard-v2.mjs puts it in the door files.
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { yardSources, yardClassify, V2 } from './yard-scan-v2.mjs';
import { markShared } from './build-yard-v2.mjs';
/* tmp + rename (2026-10-25): the cloud disk filled overnight and left arvada.json cut short and 89 empty parcel files */
const writeSafe = (f, s) => { const tmp = new URL(f.href + '.tmp'); writeFileSync(tmp, s); renameSync(tmp, f); };
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const TOWN = arg('town'), MINS = +arg('mins', 45), CONC = +arg('conc', 6);
if (!TOWN) { console.error('--town= needed'); process.exit(1); }
const DATA = process.env.YV2_DATA || 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/app/data/rounds';   /* YV2_DATA: the cloud run's slim door files (2026-10-24) */
const OUTD = new URL((process.env.YV2_OUT || 'yard-v2') + '/', import.meta.url);   /* YV2_OUT (2026-11-11): the retuned re-measure writes yard-v3/ beside the live yard-v2/ */ mkdirSync(OUTD, { recursive: true });
const OUT = new URL(`${TOWN}.json`, OUTD);
const PCD = new URL('./drcog-turf/', import.meta.url); mkdirSync(PCD, { recursive: true });
const PCACHE = new URL(`parcels-${TOWN}.json`, PCD);   /* the same lot-line cells drcog-turf-town.mjs keeps */
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* 12 Nov 2026 (cloud-jobs review, finding 1): the state map sometimes answers HTTP 200 with an error body or no features list. That was
   saved as "no lots" for good and every door in the cell went out as null (yardv3: Thornton 571 readings, Westminster 314). Now an answer
   without a features list, or with an error, is a failed fetch: tried again with back-off (2 s .. 2 min, about 4 min in all), never saved.
   One request at a time to gis.colorado.gov from every town run on this machine (a lock folder beside the parcel caches), so three
   workers on the cloud machine count as one parcel job (the rule: one parcel-heavy job at a time on gis.colorado.gov). */
const LOCK = new URL('.gis-lock', PCD);
async function gisTurn(fn) {
  for (;;) {
    try { mkdirSync(LOCK); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - statSync(LOCK).mtimeMs > 240000) rmSync(LOCK, { recursive: true, force: true }); } catch {}   /* holder died */
      await sleep(200 + Math.random() * 300);
    }
  }
  try { return await fn(); } finally { await sleep(300); try { rmSync(LOCK, { recursive: true, force: true }); } catch {} }
}
async function gisGet(params) {
  const waits = [2, 5, 15, 30, 60, 120]; let last = '';
  for (let i = 0; ; i++) {
    try {
      const j = await gisTurn(async () => { const r = await fetch(PARCELS + '?' + new URLSearchParams(params), { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
      if (j && !j.error && (Array.isArray(j.features) || typeof j.count === 'number')) return j;
      last = j && j.error ? `error ${j.error.code || ''} ${String(j.error.message || '').slice(0, 60)}` : 'no features list in the answer';
    } catch (e) { last = String((e && e.message) || e).slice(0, 80); }
    if (i >= waits.length) throw new Error('gis.colorado.gov: ' + last);
    await sleep(waits[i] * 1000 * (+process.env.YV2_WAIT_SCALE || 1));   /* YV2_WAIT_SCALE: tests only */
  }
}
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
const S = 0.008; let minLat = Infinity, minLon = Infinity;
for (const d of doors) { if (d.lat < minLat) minLat = d.lat; if (d.lon < minLon) minLon = d.lon; }   /* a loop, not Math.min(...): the spread overflows the stack on Denver-sized lists (12 Nov) */
/* origin on a fixed 0.008° grid (2026-10-26): it was the town's lowest house, so new houses to the south or west (the 25 Oct gap fix)
   shifted every cell and the saved cells answered for the wrong ground. A cache saved on another origin starts again. */
const la0 = Math.floor((minLat - 0.002) / S) * S, lo0 = Math.floor((minLon - 0.002) / S) * S;
if (!pc.o || pc.o[0] !== la0 || pc.o[1] !== lo0) pc.cells = {}, pc.o = [la0, lo0];
const cellOf = (lat, lon) => Math.floor((lat - la0) / S) + ':' + Math.floor((lon - lo0) / S);
/* Only cells with doors in them are asked for, so a cell with no lots is suspect: it is asked for its count, and saved empty (with a
   mark in pc.zero) only when the map says 0. Otherwise nothing is saved and the cell's homes wait for the next run. An empty cell saved
   before 12 Nov has no mark and is fetched again. */
async function fetchCell(c) {
  const had = pc.cells[c];
  if (had && (had.length || (pc.zero && pc.zero[c]))) return had;
  const [i, k] = c.split(':').map(Number), env = [lo0 + k * S, la0 + i * S, lo0 + (k + 1) * S, la0 + (i + 1) * S];
  const base = { f: 'json', geometry: env.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects' };
  const feats = []; let off = 0;
  for (;;) {
    const j = await gisGet({ ...base, outSR: '4326', returnGeometry: 'true', outFields: 'OBJECTID', resultOffset: String(off), resultRecordCount: '2000', geometryPrecision: '7' });
    for (const f of j.features) if (f.geometry && f.geometry.rings) feats.push(f.geometry.rings);
    if (!j.exceededTransferLimit && j.features.length < 2000) break;
    if (!j.features.length) throw new Error(`area ${c}: the map says there is more but sent nothing`);
    off += j.features.length;
  }
  if (!feats.length) {
    const n = await gisGet({ ...base, returnCountOnly: 'true' });
    if (n.count !== 0) throw new Error(`area ${c}: no lot lines in the answer, but the map counts ${n.count} lots there`);
    (pc.zero = pc.zero || {})[c] = new Date().toISOString().slice(0, 10);
  }
  pc.cells[c] = feats; writeSafe(PCACHE, JSON.stringify(pc));
  return feats;
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timed out')), ms))]);
async function one(d, lots, pkCount) {
  const rings = lots.find((rr) => inRings(d.lon, d.lat, rr));
  if (!rings) { out.doors[d.id] = null; return 'nolot'; }
  const pk = rings[0][0].map((v) => v.toFixed(6)).join(',');
  /* lk (2026-10-29): the whole lot line. pk alone, the first corner, is shared by neighbouring lots drawn from the same corner */
  const lk = createHash('md5').update(JSON.stringify(rings)).digest('hex').slice(0, 16);
  if (acres(rings[0]) > 5) { out.doors[d.id] = { big: 1 }; return 'big'; }   /* acreage, open space, a park: not one yard, and slow to read */
  const S0 = await withTimeout(yardSources(rings), 180000), R = yardClassify(S0, V2);
  out.doors[d.id] = { l: R.lawn, s: R.seen, u: R.under, o: R.open, t: R.trees, dt: R.drcogTurf ?? null, lot: R.lot, sv: R.survey || null, ph: R.photo23 || null, pk, lk };
  return 'ok';
}
let done = 0, err = 0, nolot = 0, cellErr = 0; const t0 = Date.now();
const byCell = {}; for (const d of todo) (byCell[cellOf(d.lat, d.lon)] = byCell[cellOf(d.lat, d.lon)] || []).push(d);
const save = () => { out.built = new Date().toISOString().slice(0, 10); writeSafe(OUT, JSON.stringify(out)); };
for (const c of Object.keys(byCell)) {   /* area by area, saved after each: a stop loses at most one area */
  if (Date.now() - t0 > MINS * 60000) break;
  let lots; try { lots = await fetchCell(c); } catch (e) { cellErr++; console.log(`  area ${c}: lot lines not fetched (${String(e.message).slice(0, 110)}); its ${byCell[c].length} homes wait for the next run`); continue; }
  const q = byCell[c].slice();
  await Promise.all(Array.from({ length: CONC }, async () => {
    for (let d; (d = q.shift());) {
      try { const r = await one(d, lots); if (r === 'nolot') nolot++; done++; }
      catch (e) { err++; if (err < 20) console.log('  ' + d.id + ': ' + String(e.message).slice(0, 90)); }   /* left out: tried again next run */
    }
  }));
  save(); console.log(`area ${c}: ${byCell[c].length} homes · ${done} this run · ${(done / ((Date.now() - t0) / 1000)).toFixed(2)} a second · ${err} errors`);
}
/* homes sharing one lot (townhomes, condos): the yard is the complex's, not theirs (build-yard-v2.mjs markShared; until 29 Oct it was
   the first corner alone, which joined neighbouring houses) */
markShared(out.doors);
save();
const left = doors.filter((d) => !(d.id in out.doors)).length;
console.log(`slice done: ${done} (no lot ${nolot}, errors ${err}, areas not fetched ${cellErr}) in ${((Date.now() - t0) / 60000).toFixed(1)} min; ${left} left`);
process.exit(left ? 3 : 0);
