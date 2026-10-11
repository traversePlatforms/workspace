/* Hail history per door (2026-10-04), admin-only in the app.
 *
 * Source: NOAA/NSSL MRMS "MESH" (maximum estimated size of hail), the 24-hour maximum, as archived by Iowa
 * State University: https://mtarchive.geol.iastate.edu/YYYY/MM/DD/mrms/ncep/MESH_Max_1440min/
 * The file at 12:00 UTC on day D+1 covers 12:00 UTC D to 12:00 UTC D+1 (6 am to 6 am Colorado summer
 * time), so its storms are filed under day D. Complete from 2020: April to September up to 2024, all year from October 2024
 * (Matthew 2026-10-06: more recent storms). Storm days older than two years drop off, five for a major one (../storm-keep.mjs).
 *
 *   node build-hail.mjs fetch [2020-04-01] [2026-09-30]   download what is missing (resumes; polite, 3 at a time)
 *   node build-hail.mjs build                             door and storm files from what is downloaded
 *
 * fetch keeps only our corner of Colorado per day (days/<date>.json, gitignored, a few KB each): every
 * grid square inside the doors' bounding box with any hail, in tenths of a millimetre.
 * build writes, beside the door files (app/data/rounds/):
 *   hail-<town>.json   { through, doors: { id: [[date, inches], ...newest first] } }   storms of 0.75 in or more
 *   hail-storms.json   { through, from, days, storms: [{ date, max, n1, n34, towns: {key: {n1, n34, max, areas: {name: n1}}}}] }
 *   hail-paths.json    { lat1, lon1, dx, dy, r0, c0, paths: { date: [[row, col, inches x 100], ...] } }   for the hail map
 * "Near the house" = the largest value in the 3 x 3 squares around it (about 1 km each way).
 * It is a radar ESTIMATE: it runs smaller than ground reports for big stones (see research/ROOFING-DATA-CHECK). */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeMesh } from './mesh.mjs';
import { cutoffs, keepHailDay } from '../storm-keep.mjs';
import { metros } from '../metros/registry.mjs';
const ALL_YEAR_FROM = '2024-10-01';   /* before this, hail season only (April to September) */

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
/* the metro builder (2026-10-11): HAIL_METRO=<metro> builds that metro alone, from its own day files, into its own storm files */
const METRO = process.env.HAIL_METRO || '';
const METRO_GROUPS = new Set(metros().map((m) => m.group || m.key));
const DAYS = join(HERE, METRO ? 'days-' + METRO : 'days');
const SUFFIX = METRO ? '-' + METRO : '';
const ARCHIVE = 'https://mtarchive.geol.iastate.edu';
const MIN_STORE = 19.05;   /* 0.75 in: kept per door */
const BIG = 25.4;          /* 1 in: what a roofer calls a hail day */

function towns() {
  const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
  return (idx.regions || idx).map((r) => (typeof r === 'string' ? { key: r } : r)).filter((r) => r.key && (METRO ? r.group === METRO : !METRO_GROUPS.has(r.group)));
}
function doorsOf(key) {
  const d = JSON.parse(readFileSync(join(DATA, key + '.json'), 'utf8'));
  const out = []; for (const a of d.areas) for (const x of a.doors) if (x.lat && x.lon) out.push({ id: x.id, lat: x.lat, lon: x.lon, area: a.name });
  return out;
}
function bbox() {
  let s = 90, n = -90, w = 180, e = -180;
  for (const t of towns()) { let ds; try { ds = doorsOf(t.key); } catch { continue; } for (const d of ds) { s = Math.min(s, d.lat); n = Math.max(n, d.lat); w = Math.min(w, d.lon); e = Math.max(e, d.lon); } }
  return { s: s - 0.03, n: n + 0.03, w: w - 0.03, e: e + 0.03 };
}
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, k) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return iso(d); };

async function get(url, binary) {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'DoorApp-hail/1.0 (research; contact via sixfoldcolorado.com)' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return binary ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch (e) { if (t === 2) throw e; await new Promise((z) => setTimeout(z, 2000 * (t + 1))); }
  }
}
/** one day: the 24-hour file nearest 12:00 UTC the next morning, cut to our box */
async function fetchDay(day, box) {
  const nx = addDays(day, 1), [Y, M, D] = nx.split('-');
  const dir = `${ARCHIVE}/${Y}/${M}/${D}/mrms/ncep/MESH_Max_1440min/`;
  const html = await get(dir, false);
  if (!html) return { d: day, missing: 'no folder' };
  const files = [...new Set([...html.matchAll(/href="([^"]+?_(\d{8})-(\d{6})\.grib2\.gz)"/g)].map((m) => m[1] + '|' + m[3]))].map((s) => s.split('|'));
  if (!files.length) return { d: day, missing: 'no files' };
  /* nearest 12:00 first; a file stored another way (one day in 2021) falls through to the next nearest */
  const want = 120000, order = files.filter((f) => Math.abs(+f[1] - want) <= 10000).sort((a, b) => Math.abs(+a[1] - want) - Math.abs(+b[1] - want)).slice(0, 4);
  if (!order.length) return { d: day, missing: 'no file within an hour of 12:00 UTC' };
  let m = null, pick = null, why = 'file gone';
  for (const f of order) {
    const gz = await get(dir + f[0], true); if (!gz) continue;
    try { m = decodeMesh(gunzipSync(gz)); pick = f; break; } catch (e) { why = e.message; }
  }
  if (!m) return { d: day, missing: why };
  const r0 = m.row(box.n), r1 = m.row(box.s), c0 = m.col(box.w), c1 = m.col(box.e);
  const cells = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const v = m.mm(r, c); if (v > 0) cells.push([r - r0, c - c0, Math.round(v * 10)]); }
  return { d: day, file: pick[0], r0, c0, rows: r1 - r0 + 1, cols: c1 - c0 + 1, lat1: m.grid.lat1, lon1: m.grid.lon1, dx: m.grid.dx, dy: m.grid.dy, cells };
}

async function fetchAll(from, to) {
  mkdirSync(DAYS, { recursive: true });
  const box = bbox(), todo = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const mo = +d.slice(5, 7);
    if ((mo < 4 || mo > 9) && d < ALL_YEAR_FROM) continue;
    const f = join(DAYS, d + '.json');
    if (!existsSync(f)) { todo.push(d); continue; }
    /* a day kept for a smaller set of towns (2026-10-07: the north-Douglas towns sit above the old box) is fetched again */
    const o = JSON.parse(readFileSync(f, 'utf8'));
    if (o.missing || !o.dy) continue;
    const row = (lat) => Math.round((o.lat1 - lat) / o.dy), col = (lon) => Math.round((lon + 360 - o.lon1) / o.dx);
    if (row(box.n) < o.r0 || row(box.s) > o.r0 + o.rows - 1 || col(box.w) < o.c0 || col(box.e) > o.c0 + o.cols - 1) todo.push(d);
  }
  console.log(`box ${JSON.stringify(box)}; ${todo.length} days to fetch`);
  let done = 0, miss = 0, fail = 0;
  const worker = async () => {
    while (todo.length) {
      const d = todo.shift();
      try {
        const r = await fetchDay(d, box);
        const old = (Date.now() - Date.parse(d + 'T00:00:00Z')) / 86400000 > 30;
        if (!r.missing || old) writeFileSync(join(DAYS, d + '.json'), JSON.stringify(r));   /* a recent gap may fill in: try again next run */
        if (r.missing) miss++;
      }
      catch (e) { fail++; console.log(`  ${d}: ${e.message} (will retry next run)`); }
      if (++done % 50 === 0) console.log(`  ${done} done, ${miss} missing, ${fail} failed`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  console.log(`fetched ${done}: ${miss} with no file, ${fail} failed`);
}

function build() {
  const days = readdirSync(DAYS).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(DAYS, f), 'utf8')));
  const have = days.filter((d) => !d.missing);
  if (!have.length) throw new Error('nothing downloaded');
  const through = have[have.length - 1].d, from = have[0].d;
  const storms = {};
  let total = 0;
  const perTown = [];
  for (const t of towns()) {
    let ds; try { ds = doorsOf(t.key); } catch { continue; }
    const doors = {};
    for (const day of have) {
      const grid = new Map(); for (const [r, c, v] of day.cells) grid.set(r * 100000 + c, v / 10);
      if (!grid.size) continue;
      for (const d of ds) {
        const r = Math.round((day.lat1 - d.lat) / day.dy) - day.r0, c = Math.round((d.lon + 360 - day.lon1) / day.dx) - day.c0;
        let best = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const v = grid.get((r + dr) * 100000 + c + dc); if (v > best) best = v; }
        if (best < MIN_STORE) continue;
        const inch = Math.round(best / 25.4 * 100) / 100;
        (doors[d.id] = doors[d.id] || []).push([day.d, inch]);
        const s = storms[day.d] = storms[day.d] || { date: day.d, max: 0, n1: 0, n34: 0, towns: {} };
        const tw = s.towns[t.key] = s.towns[t.key] || { label: t.label || t.key, n1: 0, n34: 0, max: 0, areas: {} };
        s.max = Math.max(s.max, inch); tw.max = Math.max(tw.max, inch); s.n34++; tw.n34++;
        if (best >= BIG) { s.n1++; tw.n1++; tw.areas[d.area] = (tw.areas[d.area] || 0) + 1; }
      }
    }
    perTown.push({ t, n: ds.length, doors });
  }
  /* the keep rule, by storm day (the whole day, so door lists and the storm list agree) */
  const cut = cutoffs(), kept = new Set(Object.values(storms).filter((s) => keepHailDay(s.date, s.max, cut)).map((s) => s.date));
  for (const k of Object.keys(storms)) if (!kept.has(k)) delete storms[k];
  for (const { t, n, doors } of perTown) {
    for (const id of Object.keys(doors)) { doors[id] = doors[id].filter((e) => kept.has(e[0])).sort((a, b) => (a[0] < b[0] ? 1 : -1)); if (!doors[id].length) delete doors[id]; }
    writeFileSync(join(DATA, `hail-${t.key}.json`), JSON.stringify({ through, from, keep: cut, doors }));
    total += Object.keys(doors).length;
    console.log(`  ${t.key}: ${Object.keys(doors).length} of ${n} doors with a storm of 0.75 in or more`);
  }
  const list = Object.values(storms).sort((a, b) => (a.date < b.date ? 1 : -1));
  writeFileSync(join(DATA, `hail-storms${SUFFIX}.json`), JSON.stringify({ through, from, days: have.length, missing: days.length - have.length, storms: list }));
  /* the paths for the hail map (2026-10-05): per storm day, every grid square of 0.75 in or more, [row, col, inches x 100]
     on the day file's grid; the map draws each as a ~1 km square */
  const g0 = have[0], paths = {};
  for (const s of list) {
    const day = have.find((d) => d.d === s.date); if (!day) continue;
    paths[s.date] = day.cells.filter((c) => c[2] / 10 >= MIN_STORE).map(([r, c, v]) => [r + day.r0 - g0.r0, c + day.c0 - g0.c0, Math.round(v / 10 / 25.4 * 100)]);
  }
  writeFileSync(join(DATA, `hail-paths${SUFFIX}.json`), JSON.stringify({ lat1: g0.lat1, lon1: g0.lon1, dx: g0.dx, dy: g0.dy, r0: g0.r0, c0: g0.c0, paths }));
  console.log(`hail-storms.json: ${list.length} storm days (${list.filter((s) => s.n1).length} with a door at 1 in or more), ${have.length} days read, ${days.length - have.length} missing; ${total} doors`);
}

const [cmd, a1, a2] = process.argv.slice(2);
if (cmd === 'fetch') await fetchAll(a1 || '2020-04-01', a2 || addDays(iso(new Date()), -2));
else if (cmd === 'build') build();
else console.log('node build-hail.mjs fetch [from] [to] | build');
