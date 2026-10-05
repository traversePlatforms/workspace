/* Lawn health trial (NDVI), large lawns only. 2026-10-03.

   Matthew asked for it as a test: "even if its just for 2000 large lawn properties it could
   just mean we prioritize the large lawns", and as a reference for what an app like this can
   do in other states.

   SOURCE. Sentinel-2 Level-2A (ESA Copernicus; free), the AWS copy indexed by Element 84's
   Earth Search STAC: https://earth-search.aws.element84.com/v1, collection sentinel-2-l2a.
   10 m pixels, a pass every ~5 days. Bands used: red (B04), near-infrared (B08), and the scene
   classification layer (SCL, 20 m) to drop cloud, shadow and snow pixel by pixel.
   ⚑ THE METADATA'S OFFSET IS WRONG FOR THESE FILES. Each image's raster:bands says
   reflectance = DN * 0.0001 - 0.1, and the first run applied it: Palmer Lake came out with
   NDVI above 1.0, which can't happen. Measured 2026-10-03 on S2A_13SED_20250718: Monument Lake
   (open water) reads near-infrared DN 37 and red 131, and 8% of red pixels over dry grassland
   sit under 1000. With the offset baked in, water would read about 1000 or more. So these
   copies are already offset-free: reflectance = DN * 0.0001, and the offset is NOT applied.

   METHOD, per door with a Large lawn level (>= 3,000 sq ft of lawn in the 2023 aerial):
     1. The lot (statewide parcels) and the 2023 aerial (NAIP, 30-60 cm).
     2. The lawn = the door app's own classifier (lawn-mask.mjs, lifted unchanged from
        sample-lawn.mjs), turned into the lawn share of each 10 m Sentinel pixel. Pixels at
        least 30% lawn count, weighted by that share.
        ⚑ The first version averaged the whole lot minus the house: a median 98 pixels on
        Palmer Lake for ~3 pixels of lawn, so it measured native grass and trees. Even now an
        edge pixel mixes lawn with whatever is next to it; trees and drives barely change
        between summers, so the year-on-year change is still mostly the lawn.
     3. The clearest images each summer (3 each in July and August, 1 each in June and
        September), read one 1024-px image tile at a time so towns share downloads: yard NDVI
        = lawn-weighted mean over clear pixels, kept only if >= 60% of the lawn is clear.
     4. Monthly median per door; "peak" = mean of July and August.
     5. Change = peak 2026 - peak 2025. Neighbourhood change = median change of the Large-lawn
        doors in the same neighbourhood (>= 3 of them; else the town). Relative = the door's
        change minus that. A neighbourhood-wide drop is watering rules or weather; a door
        that drops more than its neighbours is the signal.

   Output: ndvi-results.csv, ndvi-summary.json (cache: ndvi-cache.json, safe to delete).
   Run:    node ndvi-trial.mjs [--town=monument]

   ON A SCHEDULE (SX-42, Matthew 2026-10-03): every month or two in the growing season, always
   against the SAME month a year earlier, because lawns go dormant in summer heat and in winter.
     node ndvi-trial.mjs --month=2027-06     (June 2027 vs June 2026)
   Only May to September; winter and snow-covered images are skipped (the SCL mask also drops
   snow pixel by pixel). Writes ndvi-results-2027-06.csv and ndvi-summary-2027-06.json, then
     node build-lawn-outlines.mjs --green-only
   puts the newest comparison, with its image dates, on the app's lawn photos.                */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inRings, townParcels } from '../tree-zones/zones.mjs';
import { measure as measureLawn, STAC as NAIP_STAC, json } from './lawn-mask.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUNDS = join(HERE, '..', '..', '..', 'site', 'data', 'rounds');
const CACHE = join(HERE, 'ndvi-cache.json');
const STAC = 'https://earth-search.aws.element84.com/v1/search';
let YEARS = [2025, 2026], MONTHS = [6, 7, 8, 9], PER_MONTH = { 6: 1, 7: 3, 8: 3, 9: 1 };   /* July-August carry the comparison */
const MONTH_ARG = (process.argv.find((a) => a.startsWith('--month=')) || '').split('=')[1] || null;
let PEAK = [7, 8], TAG = '';
if (MONTH_ARG) {
  const mm = /^(\d{4})-(\d{2})$/.exec(MONTH_ARG);
  if (!mm) { console.log('Use --month=YYYY-MM, e.g. --month=2027-06'); process.exit(1); }
  const y = +mm[1], m = +mm[2];
  if (m < 5 || m > 9) { console.log('Lawn health is compared May to September only: the rest of the year lawns are dormant or under snow.'); process.exit(1); }
  YEARS = [y - 1, y]; MONTHS = [m]; PER_MONTH = { [m]: 3 }; PEAK = [m]; TAG = '-' + MONTH_ARG;
}
const [Y0, Y1] = YEARS;
const CLEAR_SCL = new Set([4, 5, 7]);   /* vegetation, bare soil, unclassified */
const ONLY = (process.argv.find((a) => a.startsWith('--town=')) || '').split('=')[1];
proj4.defs('EPSG:32613', '+proj=utm +zone=13 +datum=WGS84 +units=m +no_defs');
const utm = (lon, lat) => proj4('EPSG:4326', 'EPSG:32613', [lon, lat]);

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const save = () => writeFileSync(CACHE, JSON.stringify(cache));
const MASKS = join(HERE, 'lawnmask-cache.json');
const maskCache = existsSync(MASKS) ? JSON.parse(readFileSync(MASKS, 'utf8')) : {};
const MIN_SHARE = 0.3;   /* a 10 m pixel counts if at least 30% of it is lawn */
/* 2026-10-03: a photo download that times out inside the image library rejects a promise
   nobody awaits, and that killed the whole run (Castle Rock's outlines lost). Log and go on:
   the door it belonged to is simply measured again next run. */
process.on('unhandledRejection', (e) => { console.log('  (a download failed and was skipped: ' + String(e && e.message || e).slice(0, 90) + ')'); });

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
  const pad = (n) => String(n).padStart(2, '0'), m0 = Math.min(...MONTHS), m1 = Math.max(...MONTHS), last = new Date(Date.UTC(year, m1, 0)).getUTCDate();
  const body = { collections: ['sentinel-2-l2a'], bbox, datetime: `${year}-${pad(m0)}-01T00:00:00Z/${year}-${pad(m1)}-${last}T23:59:59Z`, query: { 'eo:cloud_cover': { lt: 20 } }, limit: 100 };
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
  /* ⚑ First version used the whole lot minus the house: on Palmer Lake that was a median
     98 pixels (2.4 acres) for ~3 pixels of lawn, i.e. it measured native grass and trees.
     Now: the door app's own lawn classifier on the 2023 aerial (lawn-mask.mjs) gives each
     10 m pixel's lawn share; only pixels >= MIN_SHARE lawn count, weighted by that share. */
  const missing = doors.filter((d) => !maskCache[`${town}/${d.id}`]);
  if (missing.length) {
    const parcels = await townParcels(bbox);
    const st = await json(NAIP_STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], bbox, query: { 'naip:year': { eq: '2023' } }, limit: 250 }) });
    const photos = (st.features || []).map((f) => ({ id: f.id, href: f.assets.image.href, date: f.properties.datetime.slice(0, 10), bb: f.bbox, gsd: f.properties.gsd }));
    let i = 0, doneMasks = 0;
    async function maskWorker() {
      for (;;) {
        const d = missing[i++]; if (!d) return;
        const k = `${town}/${d.id}`;
        const pc = parcels.find((c) => d.lon >= c.bb[0] && d.lon <= c.bb[2] && d.lat >= c.bb[1] && d.lat <= c.bb[3] && inRings(d.lon, d.lat, c.rings));
        const ph = photos.filter((it) => d.lon >= it.bb[0] && d.lon <= it.bb[2] && d.lat >= it.bb[1] && d.lat <= it.bb[3]).sort((a, b) => a.gsd - b.gsd)[0];
        if (!pc) { maskCache[k] = { err: 'no parcel' }; continue; }
        if (!ph) { maskCache[k] = { err: 'no 2023 photo' }; continue; }
        try { const m = await measureLawn({ la: d.lat, lo: d.lon }, pc.rings, ph); maskCache[k] = m.err ? { err: m.err } : { s: m.s, px10: m.px10 }; }
        catch (e) { if (!/fetch failed|timeout|ECONN/i.test(String(e && e.message))) maskCache[k] = { err: 'photo read failed' }; }   /* a network blip is retried next run, not recorded as a failure */
        if (++doneMasks % 25 === 0) writeFileSync(MASKS, JSON.stringify(maskCache));   /* saved as it goes, not only per town */
      }
    }
    await Promise.all(Array.from({ length: 4 }, maskWorker));
    writeFileSync(MASKS, JSON.stringify(maskCache));
  }
  for (const d of doors) {
    d.key = `${town}/${d.id}`;
    const m = maskCache[d.key];
    if (!m || m.err) { d.err = m?.err || 'no lawn outline'; continue; }
    d.px = m.px10.filter((p) => p[2] >= MIN_SHARE);
    d.w = d.px.reduce((s, p) => s + p[2], 0);
    if (d.w < 1) d.err = `lawn too broken up for 10 m pixels (${d.px.length} pixels at ${MIN_SHARE * 100}%+)`;
  }
  const ok = doors.filter((d) => !d.err);
  console.log(`${town}: ${doors.length} large-lawn doors, ${ok.length} usable, median ${ok.map((d) => d.px.length).sort((a, b) => a - b)[ok.length >> 1]} lawn pixels`);
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
            for (const [gx, gy, f] of d.px) {
              const c = gx - x0 / 10, r = y0 / 10 - 1 - gy;
              const s = scl.get(Math.floor(c / 2), Math.floor(r / 2)), R = red.get(c, r), N = nir.get(c, r);
              if (!CLEAR_SCL.has(s) || !R || !N) continue;
              const rr = R * (rs.scale ?? 1e-4), nn = N * (ns.scale ?? 1e-4);   /* no offset: see the header */
              if (rr + nn <= 0) continue;
              sum += f * (nn - rr) / (nn + rr); n += f;   /* weighted by lawn share */
            }
            if (n >= 0.6 * d.w) vals[d.key] = +(sum / n).toFixed(4);
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
  for (const y of YEARS) { const p = PEAK.map((m) => row[`${y}-${m}`]).filter((v) => v !== null && v !== undefined); row[`peak${y}`] = p.length ? p.reduce((s, v) => s + v, 0) / p.length : null; }
  row.change = row[`peak${Y0}`] !== null && row[`peak${Y1}`] !== null ? row[`peak${Y1}`] - row[`peak${Y0}`] : null;
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
  r.basePeakNew = med(pool.map((o) => o[`peak${Y1}`]).filter((v) => v !== null));
}
const f2 = (v) => (v === null || v === undefined ? '' : (+v).toFixed(3));
const head = ['id', 'town', 'neighbourhood', 'address', 'lawn_sq_ft_2023', 'yard_pixels', 'note',
  ...YEARS.flatMap((y) => MONTHS.map((m) => `ndvi_${y}_${String(m).padStart(2, '0')}`)), `peak_${Y0}`, `peak_${Y1}`, 'change', 'baseline', 'baseline_change', 'relative_change', `baseline_peak_${Y1}`];
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
writeFileSync(join(HERE, `ndvi-results${TAG}.csv`), [head.join(','), ...results.sort((a, b) => (a.relative ?? 9) - (b.relative ?? 9)).map((r) => [r.id, r.town, r.area, r.address, r.lawnSq, r.px, r.err,
  ...YEARS.flatMap((y) => MONTHS.map((m) => f2(r[`${y}-${m}`]))), f2(r[`peak${Y0}`]), f2(r[`peak${Y1}`]), f2(r.change), r.base || '', f2(r.baseChange), f2(r.relative), f2(r.basePeakNew)].map(esc).join(','))].join('\n') + '\n');

const valid = results.filter((r) => r.change !== null);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(3) : null; };
const byTown = {};
for (const t of Object.keys(towns)) { const v = valid.filter((r) => r.town === t); if (!v.length) continue;
  byTown[t] = { doors: v.length, ['peak' + Y0]: q(v.map((r) => r['peak' + Y0]), 0.5), ['peak' + Y1]: q(v.map((r) => r['peak' + Y1]), 0.5), change: q(v.map((r) => r.change), 0.5) }; }
const summary = {
  built: new Date().toISOString().slice(0, 10), compared: MONTH_ARG ? `${Y0} vs ${Y1}, month ${MONTHS[0]}` : `${Y0} vs ${Y1}, July-August`, months: PEAK, years: YEARS,
  images: [...new Set(Object.values(cache).map((s) => s.date))].filter((dd) => YEARS.some((y) => PEAK.some((m) => dd.startsWith(`${y}-${String(m).padStart(2, '0')}`)))).sort(),
  doors: results.length, measured: valid.length,
  skipped: results.filter((r) => r.change === null).reduce((o, r) => { const k = r.err || 'not enough clear images'; o[k] = (o[k] || 0) + 1; return o; }, {}),
  peakNew: { p10: q(valid.map((r) => r['peak' + Y1]), 0.1), median: q(valid.map((r) => r['peak' + Y1]), 0.5), p90: q(valid.map((r) => r['peak' + Y1]), 0.9) },
  change: { p10: q(valid.map((r) => r.change), 0.1), median: q(valid.map((r) => r.change), 0.5), p90: q(valid.map((r) => r.change), 0.9) },
  relative: { p10: q(valid.map((r) => r.relative), 0.1), median: q(valid.map((r) => r.relative), 0.5), p90: q(valid.map((r) => r.relative), 0.9) },
  browningVsNeighbours: valid.filter((r) => r.relative <= -0.05).length, greeningVsNeighbours: valid.filter((r) => r.relative >= 0.05).length,
  byTown,
};
writeFileSync(join(HERE, `ndvi-summary${TAG}.json`), JSON.stringify(summary, null, 2));
console.log('\n' + JSON.stringify(summary, null, 2));
