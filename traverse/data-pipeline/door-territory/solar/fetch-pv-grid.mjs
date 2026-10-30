/* pv-grid.json: a year's output per installed kW for every part of the map that holds a measured solar door (2026-10-29).
 * Replaces the single Larkspur point in pvwatts.json for the production estimate (build-solar.mjs reads this file first).
 *
 * Source: NLR (formerly NREL) PVWatts v8, developer.nlr.gov, weather from the NSRDB typical meteorological year at the nearest
 * 4 km cell. Terms (developer.nlr.gov/terms, read 2026-10-29): the data "may be used for any purpose whatsoever"; the DOE/NLR
 * names may not be used to endorse or promote. So the card names the source as a fact and never as an endorsement.
 * PVWatts defaults: standard module, 14% system losses (which include 3% for shading), fixed roof mount.
 *
 * How the table is built, to stay inside the key's 1,000 calls an hour:
 *   1. every 0.25-degree cell holding measured doors gets ONE call: south-facing, 25 degrees, at the doors' own centre (mean
 *      latitude and longitude of the cell's measured doors, so a cell's figure is for its houses, not for a peak in the middle);
 *   2. every 1-degree block gets the full facing x slope table (E, SE, S, SW, W x 10, 20, 30, 40, 50 degrees) at its busiest
 *      0.25-degree cell. The table is kept as a share of that point's south/25 figure;
 *   3. build-solar.mjs gives a house: its cell's south/25 figure x its block's share for the facing and slope.
 *   The shares barely move across a block (sun angles change little in 100 km); --check=N fetches the full table at N more cells
 *   and prints how far the shortcut lands from PVWatts' own answer there (2026-10-29 run: see the README).
 *
 *   node fetch-pv-grid.mjs [--check=6]      (resumable: keeps what came back; delete pv-grid.json to fetch again)
 * Key: NLR_API_KEY, else data-gov-key.txt beside the door lists (never in git), else DEMO_KEY (a handful of calls an hour). */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
/* the door files and the measurement cache are data, not code: read from --data / --cache when run from a worktree */
const DATA = arg('data', join(DT, '..', '..', 'app', 'data', 'rounds'));
const CACHE = arg('cache', join(HERE, 'solar-cache.json'));
const KEYF = arg('keyfile', join(DT, 'data-gov-key.txt'));
const KEY = process.env.NLR_API_KEY || (existsSync(KEYF) ? readFileSync(KEYF, 'utf8').trim() : '') || 'DEMO_KEY';
const OUT = join(HERE, 'pv-grid.json');
const STEP = 0.25, REF = { tilt: 25, az: 180 };
const AZ = [90, 135, 180, 225, 270], TILT = [10, 20, 30, 40, 50];
const CHECK = +arg('check', 0);

const cellOf = (lat, lon) => `${Math.floor(lat / STEP) * STEP},${Math.floor(lon / STEP) * STEP}`;
const blockOf = (lat, lon) => `${Math.floor(lat)},${Math.floor(lon)}`;

let calls = 0;
async function pvwatts(lat, lon, tilt, az) {
  const u = `https://developer.nlr.gov/api/pvwatts/v8.json?api_key=${KEY}&lat=${lat}&lon=${lon}&system_capacity=1&module_type=0&losses=14&array_type=1&tilt=${tilt}&azimuth=${az}`;
  for (let tries = 0; ; tries++) {
    const r = await fetch(u); calls++;
    const j = await r.json().catch(() => ({}));
    if (j.outputs && j.outputs.ac_annual) return { ac: Math.round(j.outputs.ac_annual), st: j.station_info ? j.station_info.location : null, wx: j.station_info ? j.station_info.weather_data_source : null, left: r.headers.get('x-ratelimit-remaining') };
    if (r.status === 429 || tries >= 2) throw new Error(`PVWatts ${r.status}: ${JSON.stringify(j.error || j.errors || j).slice(0, 160)}`);
    await new Promise((ok) => setTimeout(ok, 2000));
  }
}

/* where the measured doors are */
const cache = JSON.parse(readFileSync(CACHE, 'utf8'));
const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
const cellPts = {};
for (const reg of idx.regions) {
  if (String(reg.key).startsWith('com-')) continue;
  const f = join(DATA, `${reg.key}.json`); if (!existsSync(f)) continue;
  for (const a of JSON.parse(readFileSync(f, 'utf8')).areas) for (const x of a.doors) {
    if (x.lat == null) continue;
    const r = cache[`${x.lat},${x.lon}`]; if (!r || r.err || !r.a) continue;
    const k = cellOf(x.lat, x.lon), c = cellPts[k] || (cellPts[k] = { n: 0, la: 0, lo: 0 });
    c.n++; c.la += x.lat; c.lo += x.lon;
  }
}
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {
  source: 'NLR (formerly NREL) PVWatts v8, developer.nlr.gov; NSRDB typical meteorological year',
  params: 'standard module, 14% system losses, fixed roof mount, DC to AC 1.2, inverter 96%',
  step: STEP, ref: REF, fetched: null, cells: {}, blocks: {}
};
const save = () => { out.fetched = new Date().toLocaleDateString('en-CA');   /* the local day (Colorado), not UTC */ writeFileSync(OUT, JSON.stringify(out, null, 1)); };
const cells = Object.entries(cellPts).map(([k, c]) => ({ k, n: c.n, lat: Math.round(c.la / c.n * 100) / 100, lon: Math.round(c.lo / c.n * 100) / 100 }));
console.log(`${cells.length} cells hold measured doors (${cells.reduce((s, c) => s + c.n, 0)} doors)`);

try {
  /* 1. one south/25 figure per cell */
  for (const c of cells) {
    if (out.cells[c.k]) { out.cells[c.k].n = c.n; continue; }
    const p = await pvwatts(c.lat, c.lon, REF.tilt, REF.az);
    out.cells[c.k] = { at: [c.lat, c.lon], n: c.n, ac: p.ac, st: p.st };
    if (!out.wx && p.wx) out.wx = p.wx;
    console.log(`cell ${c.k} (${c.n} doors): ${p.ac} kWh per kW · ${p.left} calls left this hour`);
  }
  save();
  /* 2. the full facing x slope table per 1-degree block, at its busiest cell */
  const busiest = {};
  for (const c of cells) { const b = blockOf(c.lat, c.lon); if (!busiest[b] || c.n > busiest[b].n) busiest[b] = c; }
  for (const [b, c] of Object.entries(busiest)) {
    const B = out.blocks[b] || (out.blocks[b] = { cell: c.k, at: [c.lat, c.lon], ac: {} });
    for (const [t, az] of [[REF.tilt, REF.az], ...TILT.flatMap((t) => AZ.map((az) => [t, az]))]) {
      if (B.ac[`${t}/${az}`]) continue;
      B.ac[`${t}/${az}`] = (await pvwatts(c.lat, c.lon, t, az)).ac;
    }
    save();
    console.log(`block ${b} at ${c.k}: south/25 ${B.ac['25/180']}, east/20 ${B.ac['20/90']}, west/20 ${B.ac['20/270']}`);
  }
  /* 3. the check: the full table at a few more cells, against the shortcut */
  if (CHECK) {
    const done = new Set(Object.values(out.blocks).map((B) => B.cell));
    const pick = cells.filter((c) => !done.has(c.k)).sort((a, b) => b.n - a.n).filter((_, i, a) => i % Math.max(1, Math.floor(a.length / CHECK)) === 0).slice(0, CHECK);
    out.check = out.check || {};
    for (const c of pick) {
      if (out.check[c.k]) continue;
      const B = out.blocks[blockOf(c.lat, c.lon)], ref = out.cells[c.k].ac, base = B.ac[`${REF.tilt}/${REF.az}`];
      const row = {};
      for (const t of [10, 30, 50]) for (const az of [90, 135, 180, 225, 270]) {
        const real = (await pvwatts(c.lat, c.lon, t, az)).ac, est = Math.round(ref * B.ac[`${t}/${az}`] / base);
        row[`${t}/${az}`] = [real, est];
      }
      out.check[c.k] = row; save();
      const errs = Object.values(row).map(([r, e]) => (e - r) / r * 100);
      console.log(`check ${c.k}: shortcut vs PVWatts, worst ${Math.max(...errs.map(Math.abs)).toFixed(1)}%, mean ${(errs.reduce((s, v) => s + v, 0) / errs.length).toFixed(2)}%`);
    }
  }
} finally { save(); console.log(`${calls} PVWatts calls`); }
