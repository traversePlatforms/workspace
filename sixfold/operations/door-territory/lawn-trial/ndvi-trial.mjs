/* Lawn health trial (NDVI), large lawns only. 2026-10-03.

   Matthew asked for it as a test: "even if its just for 2000 large lawn properties it could
   just mean we prioritize the large lawns", and as a reference for what an app like this can
   do in other states.

   SOURCE. Sentinel-2 Level-2A (ESA Copernicus; free), the AWS copy indexed by Element 84's
   Earth Search STAC: https://earth-search.aws.element84.com/v1, collection sentinel-2-l2a.
   10 m pixels, a pass every ~5 days. Bands used: red (B04), near-infrared (B08), and the scene
   classification layer (SCL, 20 m) to drop cloud, shadow and snow pixel by pixel.
   ⚑ Values are stored with an offset: reflectance = DN * scale + offset, read per image from
   raster:bands (scale 0.0001, offset -0.1 on 2025-26 images). Ignoring it biases NDVI.

   METHOD, per door with a Large lawn level (>= 3,000 sq ft of lawn in the 2023 aerial):
     1. The lot (statewide parcels) and the house (Microsoft building outline), in UTM 13N.
     2. The yard = the 10 m pixels whose centre is on the lot and more than 4 m from the house.
        ⚑ A Large lawn is only ~3 pixels of lawn. So this is the YARD's greenness (lawn plus
        trees, beds, drive), not the lawn's. Trees and drives barely change between summers,
        so the year-on-year change is still mostly the lawn.
     3. The clearest images each summer (3 each in July and August, 1 each in June and
        September), read one 1024-px image tile at a time so towns share downloads: yard NDVI
        = mean over clear pixels, kept only if >= 60% of the yard is clear.
     4. Monthly median per door; "peak" = mean of July and August.
     5. Change = peak 2026 - peak 2025. Neighbourhood change = median change of the Large-lawn
        doors in the same neighbourhood (>= 3 of them; else the town). Relative = the door's
        change minus that. A neighbourhood-wide drop is watering rules or weather; a door
        that drops more than its neighbours is the signal.

   Output: ndvi-results.csv, ndvi-summary.json (cache: ndvi-cache.json, safe to delete).
   Run:    node ndvi-trial.mjs [--town=monument]                                             */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inRings, pickHouse, loadBuildings, townParcels } from '../tree-zones/zones.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUNDS = join(HERE, '..', '..', '..', 'site', 'data', 'rounds');
const BUILDINGS = join(HERE, '..', 'tree-zones', 'buildings');
const CACHE = join(HERE, 'ndvi-cache.json');
const STAC = 'https://earth-search.aws.element84.com/v1/search';
const YEARS = [2025, 2026], MONTHS = [6, 7, 8, 9], PER_MONTH = { 6: 1, 7: 3, 8: 3, 9: 1 };   /* July-August carry the comparison */
const CLEAR_SCL = new Set([4, 5, 7]);   /* vegetation, bare soil, unclassified */
const ONLY = (process.argv.find((a) => a.startsWith('--town=')) || '').split('=')[1];
proj4.defs('EPSG:32613', '+proj=utm +zone=13 +datum=WGS84 +units=m +no_defs');
const utm = (lon, lat) => proj4('EPSG:4326', 'EPSG:32613', [lon, lat]);

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const save = () => writeFileSync(CACHE, JSON.stringify(cache));

/* distance from a point to a ring's edges, metres (UTM) */
function ringDist(x, y, ring) {
  let d = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j], [x2, y2] = ring[i], dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
    d = Math.min(d, Math.hypot(x - x1 - t * dx, y - y1 - t * dy));
  }
  return d;
}

/* ---- the doors ---- */
const towns = {};
for (const f of readdirSync(ROUNDS).filter((x) => x.endsWith('.json') && !['index.json', 'money.json'].includes(x))) {
  const town = f.replace('.json', '');
  if (ONLY && town !== ONLY) continue;
  for (const a of JSON.parse(readFileSync(join(ROUNDS, f), 'utf8')).areas)
    for (const d of a.doors) if (d.lawn?.lv === 'L' && typeof d.lat === 'number') (towns[town] ||= []).push({ ...d, area: a.name, town });
}

async function stac(bbox, year) {
  const out = []; let next = null;
  const body = { collections: ['sentinel-2-l2a'], bbox, datetime: `${year}-06-01T00:00:00Z/${year}-09-30T23:59:59Z`, query: { 'eo:cloud_cover': { lt: 20 } }, limit: 100 };
  for (let page = 0; page < 5; page++) {
    const r = await fetch(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next || body) });
    const j = await r.json(); out.push(...(j.features || []));
    const n = (j.links || []).find((l) => l.rel === 'next'); if (!n || !n.body) break; next = n.body;
  }
  return out;
}

const results = [];
const T = 1024;   /* Sentinel-2 COG internal tile, pixels */

/* 1. yards, per town */
const groups = new Map();   // MGRS tile -> doors (every town whose doors it holds)
for (const [town, doors] of Object.entries(towns)) {
  const bbox = [Math.min(...doors.map((d) => d.lon)) - 0.003, Math.min(...doors.map((d) => d.lat)) - 0.003, Math.max(...doors.map((d) => d.lon)) + 0.003, Math.max(...doors.map((d) => d.lat)) + 0.003];
  const parcels = await townParcels(bbox);
  const blds = await loadBuildings(BUILDINGS, bbox);
  for (const d of doors) {
    d.key = `${town}/${d.id}`;
    const pc = parcels.find((c) => d.lon >= c.bb[0] && d.lon <= c.bb[2] && d.lat >= c.bb[1] && d.lat <= c.bb[3] && inRings(d.lon, d.lat, c.rings));
    if (!pc) { d.err = 'no parcel'; continue; }
    const cand = blds.filter((b) => b.c[0] >= pc.bb[0] - 0.001 && b.c[0] <= pc.bb[2] + 0.001 && b.c[1] >= pc.bb[1] - 0.001 && b.c[1] <= pc.bb[3] + 0.001);
    const house = pickHouse(pc.rings, cand);
    const lot = pc.rings.map((r) => r.map(([lo, la]) => utm(lo, la)));
    const hr = house ? house.ring.map(([lo, la]) => utm(lo, la)) : null;
    const xs = lot.flat().map((p) => p[0]), ys = lot.flat().map((p) => p[1]);
    d.px = [];
    for (let gx = Math.floor(Math.min(...xs) / 10); gx <= Math.floor(Math.max(...xs) / 10); gx++)
      for (let gy = Math.floor(Math.min(...ys) / 10); gy <= Math.floor(Math.max(...ys) / 10); gy++) {
        const cx = gx * 10 + 5, cy = gy * 10 + 5;
        if (!inRings(cx, cy, lot)) continue;
        if (hr && (inRings(cx, cy, [hr]) || ringDist(cx, cy, hr) <= 4)) continue;
        d.px.push([gx, gy]);
      }
    if (d.px.length < 3) d.err = `yard too small for 10 m pixels (${d.px.length})`;
  }
  const ok = doors.filter((d) => !d.err);
  console.log(`${town}: ${doors.length} large-lawn doors, ${ok.length} usable yards, median ${ok.map((d) => d.px.length).sort((a, b) => a - b)[ok.length >> 1]} pixels`);
  /* the tile: first, alphabetically, whose footprint holds every door of the town */
  const items = await stac(bbox, 2026);
  const holds = (it) => { const b = it.bbox; return b[0] <= bbox[0] && b[1] <= bbox[1] && b[2] >= bbox[2] && b[3] >= bbox[3]; };
  const tile = [...new Set(items.filter(holds).map((it) => it.properties['s2:mgrs_tile'] || it.id.split('_')[1]))].sort()[0];
  if (!tile) { console.log(`  ⚑ no single tile holds ${town}; skipped`); for (const d of doors) d.err = d.err || 'no single image tile'; continue; }
  if (!groups.has(tile)) groups.set(tile, { doors: [], bbox: [...bbox] });
  const g = groups.get(tile); g.doors.push(...ok);
  g.bbox = [Math.min(g.bbox[0], bbox[0]), Math.min(g.bbox[1], bbox[1]), Math.max(g.bbox[2], bbox[2]), Math.max(g.bbox[3], bbox[3])];
}

/* 2. images, per tile: read each internal 1024-px tile once per image, only those holding a yard */
async function tilesOf(href, needed, size) {
  const im = await (await fromUrl(href)).getImage();
  const W = im.getWidth(), H = im.getHeight(), out = new Map();
  for (const k of needed) {
    const [tx, ty] = k.split(',').map(Number);
    const win = [tx * T, ty * T, Math.min(W, (tx + 1) * T), Math.min(H, (ty + 1) * T)];
    const r = await im.readRasters({ window: win, samples: [0] });
    out.set(k, { a: r[0], w: win[2] - win[0] });
  }
  return { get: (c, r) => { const t = out.get(`${Math.floor(c / T)},${Math.floor(r / T)}`); return t ? t.a[(r % T) * t.w + (c % T)] : 0; } };
}
for (const [tile, g] of groups) {
  for (const year of YEARS) {
    const items = (await stac(g.bbox, year)).filter((it) => (it.properties['s2:mgrs_tile'] || it.id.split('_')[1]) === tile);
    const chosen = [];
    for (const m of MONTHS) {
      const inM = items.filter((it) => new Date(it.properties.datetime).getUTCMonth() + 1 === m).sort((a, b) => a.properties['eo:cloud_cover'] - b.properties['eo:cloud_cover']);
      const seen = new Set();
      for (const it of inM) { const day = it.properties.datetime.slice(0, 10); if (seen.has(day)) continue; seen.add(day); chosen.push(it); if (seen.size >= PER_MONTH[m]) break; }
    }
    console.log(`${tile} ${year}: ${chosen.length} images for ${g.doors.length} yards`);
    let next = 0;
    async function worker() {
      for (;;) {
        const it = chosen[next++]; if (!it) return;
        const key = `${tile}|${it.id}`;
        if (cache[key]) continue;
        const [, , x0, , , y0] = it.assets.red['proj:transform'];
        const need10 = new Set(), need20 = new Set();
        for (const d of g.doors) for (const [gx, gy] of d.px) {
          const c = gx - x0 / 10, r = y0 / 10 - 1 - gy;
          need10.add(`${Math.floor(c / T)},${Math.floor(r / T)}`); need20.add(`${Math.floor(c / 2 / T)},${Math.floor(r / 2 / T)}`);
        }
        const band = (k) => it.assets[k]['raster:bands']?.[0] || {};
        const t0 = Date.now();
        try {
          const [red, nir, scl] = await Promise.all([tilesOf(it.assets.red.href, need10), tilesOf(it.assets.nir.href, need10), tilesOf(it.assets.scl.href, need20)]);
          const rs = band('red'), ns = band('nir'), vals = {};
          for (const d of g.doors) {
            let sum = 0, n = 0;
            for (const [gx, gy] of d.px) {
              const c = gx - x0 / 10, r = y0 / 10 - 1 - gy;
              const s = scl.get(Math.floor(c / 2), Math.floor(r / 2)), R = red.get(c, r), N = nir.get(c, r);
              if (!CLEAR_SCL.has(s) || !R || !N) continue;
              const rr = R * (rs.scale ?? 1e-4) + (rs.offset ?? 0), nn = N * (ns.scale ?? 1e-4) + (ns.offset ?? 0);
              if (rr + nn <= 0) continue;
              sum += (nn - rr) / (nn + rr); n++;
            }
            if (n >= 0.6 * d.px.length) vals[d.key] = +(sum / n).toFixed(4);
          }
          cache[key] = { date: it.properties.datetime.slice(0, 10), vals };
          save();
          console.log(`  ${cache[key].date}  ${Object.keys(vals).length}/${g.doors.length} clear  ${need10.size} tiles  ${Math.round((Date.now() - t0) / 1000)} s`);
        } catch (e) { console.log(`  ${it.id} failed: ${e.message.slice(0, 100)}`); }
      }
    }
    await Promise.all(Array.from({ length: 3 }, worker));
  }
}

/* 3. per door: monthly medians, peak, change */
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const scenes = Object.values(cache);
for (const doors of Object.values(towns)) for (const d of doors) {
  const row = { id: d.id, town: d.town, area: d.area, address: d.address, lawnSq: d.lawn.sq, acres: d.acres, px: d.px?.length || 0, err: d.err || '' };
  for (const y of YEARS) for (const m of MONTHS) {
    const v = scenes.filter((s) => s.date.startsWith(`${y}-${String(m).padStart(2, '0')}`) && s.vals[d.key] !== undefined).map((s) => s.vals[d.key]);
    row[`${y}-${m}`] = med(v); row[`n${y}-${m}`] = v.length;
  }
  for (const y of YEARS) { const p = [row[`${y}-7`], row[`${y}-8`]].filter((v) => v !== null); row[`peak${y}`] = p.length ? p.reduce((s, v) => s + v, 0) / p.length : null; }
  row.change = row.peak2025 !== null && row.peak2026 !== null ? row.peak2026 - row.peak2025 : null;
  results.push(row);
}


/* neighbourhood baseline */
for (const r of results) {
  if (r.change === null) continue;
  const sameArea = results.filter((o) => o.town === r.town && o.area === r.area && o.change !== null);
  const pool = sameArea.length >= 3 ? sameArea : results.filter((o) => o.town === r.town && o.change !== null);
  r.base = sameArea.length >= 3 ? 'neighbourhood' : 'town';
  r.baseChange = med(pool.map((o) => o.change));
  r.relative = r.change - r.baseChange;
  r.basePeak2026 = med(pool.map((o) => o.peak2026).filter((v) => v !== null));
}
const f2 = (v) => (v === null || v === undefined ? '' : (+v).toFixed(3));
const head = ['id', 'town', 'neighbourhood', 'address', 'lawn_sq_ft_2023', 'yard_pixels', 'note',
  ...YEARS.flatMap((y) => MONTHS.map((m) => `ndvi_${y}_${String(m).padStart(2, '0')}`)), 'peak_2025', 'peak_2026', 'change', 'baseline', 'baseline_change', 'relative_change', 'baseline_peak_2026'];
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
writeFileSync(join(HERE, 'ndvi-results.csv'), [head.join(','), ...results.sort((a, b) => (a.relative ?? 9) - (b.relative ?? 9)).map((r) => [r.id, r.town, r.area, r.address, r.lawnSq, r.px, r.err,
  ...YEARS.flatMap((y) => MONTHS.map((m) => f2(r[`${y}-${m}`]))), f2(r.peak2025), f2(r.peak2026), f2(r.change), r.base || '', f2(r.baseChange), f2(r.relative), f2(r.basePeak2026)].map(esc).join(','))].join('\n') + '\n');

const valid = results.filter((r) => r.change !== null);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(3) : null; };
const byTown = {};
for (const t of Object.keys(towns)) { const v = valid.filter((r) => r.town === t); if (!v.length) continue;
  byTown[t] = { doors: v.length, peak2025: q(v.map((r) => r.peak2025), 0.5), peak2026: q(v.map((r) => r.peak2026), 0.5), change: q(v.map((r) => r.change), 0.5) }; }
const summary = {
  built: new Date().toISOString().slice(0, 10), doors: results.length, measured: valid.length,
  skipped: results.filter((r) => r.change === null).reduce((o, r) => { const k = r.err || 'not enough clear images'; o[k] = (o[k] || 0) + 1; return o; }, {}),
  peak2026: { p10: q(valid.map((r) => r.peak2026), 0.1), median: q(valid.map((r) => r.peak2026), 0.5), p90: q(valid.map((r) => r.peak2026), 0.9) },
  change: { p10: q(valid.map((r) => r.change), 0.1), median: q(valid.map((r) => r.change), 0.5), p90: q(valid.map((r) => r.change), 0.9) },
  relative: { p10: q(valid.map((r) => r.relative), 0.1), median: q(valid.map((r) => r.relative), 0.5), p90: q(valid.map((r) => r.relative), 0.9) },
  browningVsNeighbours: valid.filter((r) => r.relative <= -0.05).length, greeningVsNeighbours: valid.filter((r) => r.relative >= 0.05).length,
  byTown,
};
writeFileSync(join(HERE, 'ndvi-summary.json'), JSON.stringify(summary, null, 2));
console.log('\n' + JSON.stringify(summary, null, 2));
