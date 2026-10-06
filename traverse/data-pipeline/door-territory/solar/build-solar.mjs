/* solar-<town>.json for the app (2026-10-06, TraverseSolar), from solar-cache.json, pvwatts.json and utilities.geojson.
 *   node sample-solar.mjs --build        (calls build() below)
 * Per door: { a: {S,SE,SW,E,W,N,F} sq ft, sd: median slope of the sun-facing roof (degrees), sh: open | some | heavy,
 *             pn: panels, kw, kwh: a year's output, yr: survey year, u: power company }.
 * The system is an ESTIMATE on stated assumptions, shown as such on the card:
 *   - 60% of the sun-facing roof is usable once fire-code walkways along edges and ridges, vents and chimneys are kept clear;
 *   - a 400 W panel is about 20 sq ft;
 *   - each part produces what PVWatts gives for its facing and slope; flat area counts only when the roof is mostly flat
 *     (panels tilted 10 degrees south), because on a pitched roof the cells reading flat are ridges and valleys;
 *   - it is the most that FITS, not a recommended system (that depends on the household's use);
 *   - shade is reported, not deducted: the card says how much tall canopy stands on the sunny side.
 * Teller towns have no LiDAR: their doors carry the power company only. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const USABLE = 0.6, PANEL_SQFT = 20, PANEL_KW = 0.4;
const FACING = { S: 180, SE: 135, SW: 225, E: 90, W: 270 };
const shadeOf = (n) => n == null ? null : n < 15 ? 'open' : n < 80 ? 'some' : 'heavy';

/* point in polygon (GeoJSON rings, lon/lat) */
function inRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function inPoly(x, y, rings) { if (!inRing(x, y, rings[0])) return false; for (let i = 1; i < rings.length; i++) if (inRing(x, y, rings[i])) return false; return true; }
function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }

export async function build(CACHE, TOWNS, DATA) {
  const cache = JSON.parse(readFileSync(CACHE, 'utf8'));
  const pv = JSON.parse(readFileSync(join(HERE, 'pvwatts.json'), 'utf8')).kwhPerKw;
  const tilts = [...new Set(Object.keys(pv).map((k) => +k.split('/')[0]))].sort((a, b) => a - b);
  /* a year's kWh per kW at this facing and slope: between the two nearest tilts fetched for that facing */
  const yieldAt = (az, deg) => {
    const have = tilts.filter((t) => pv[`${t}/${az}`]);
    if (!have.length) throw new Error('no PVWatts figure for facing ' + az);
    if (deg <= have[0]) return pv[`${have[0]}/${az}`];
    if (deg >= have[have.length - 1]) return pv[`${have[have.length - 1]}/${az}`];
    for (let i = 0; i < have.length - 1; i++) if (deg >= have[i] && deg <= have[i + 1]) { const f = (deg - have[i]) / (have[i + 1] - have[i]); return pv[`${have[i]}/${az}`] * (1 - f) + pv[`${have[i + 1]}/${az}`] * f; }
    return pv[`${have[0]}/${az}`];
  };
  const util = JSON.parse(readFileSync(join(HERE, 'utilities.geojson'), 'utf8')).features.map((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const xs = polys.flatMap((p) => p[0].map((c) => c[0])), ys = polys.flatMap((p) => p[0].map((c) => c[1]));
    return { name: String(f.properties.LabelName || f.properties.NAME || '').trim(), polys, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], area: polys.reduce((s, p) => s + ringArea(p[0]), 0) };
  });
  /* the smallest service territory holding the house: a town's own utility sits inside a co-op's map */
  const utilityAt = (lon, lat) => {
    let best = null;
    for (const u of util) if (lon >= u.bb[0] && lon <= u.bb[2] && lat >= u.bb[1] && lat <= u.bb[3] && u.polys.some((p) => inPoly(lon, lat, p)) && (!best || u.area < best.area)) best = u;
    return best ? best.name : null;
  };
  const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
  let tot = 0, withRoof = 0, withUtil = 0; const byUtil = {};
  for (const reg of idx.regions) {
    if (String(reg.key).startsWith('com-')) continue;
    const f = join(DATA, `${reg.key}.json`); if (!existsSync(f)) continue;
    const d = JSON.parse(readFileSync(f, 'utf8')), doors = {};
    for (const a of d.areas) for (const x of a.doors) {
      tot++;
      const out = {};
      const u = x.lat != null ? utilityAt(x.lon, x.lat) : null;
      if (u) { out.u = u; withUtil++; byUtil[u] = (byUtil[u] || 0) + 1; }
      const r = TOWNS[reg.key] ? cache[`${x.lat},${x.lon}`] : null;
      if (r && !r.err && r.a) {
        withRoof++;
        out.a = r.a; out.sd = r.sd; out.sh = shadeOf(r.shade); out.yr = r.yr;
        let panels = 0, kwh = 0;
        for (const [p, az] of Object.entries(FACING)) { const n = Math.floor((r.a[p] || 0) * USABLE / PANEL_SQFT); panels += n; kwh += n * PANEL_KW * yieldAt(az, r.sd || 20); }
        /* flat area counts only on a flat or low roof: on a pitched roof the "flat" cells are its ridges and valleys */
        const sloped = ['S', 'SE', 'SW', 'E', 'W', 'N'].reduce((t, p) => t + (r.a[p] || 0), 0);
        if ((r.a.F || 0) > sloped) { const nf = Math.floor(r.a.F * USABLE / PANEL_SQFT); panels += nf; kwh += nf * PANEL_KW * yieldAt(180, 10); }
        if (panels > 0) { out.pn = panels; out.kw = Math.round(panels * PANEL_KW * 10) / 10; out.kwh = Math.round(kwh / 100) * 100; }
      }
      if (Object.keys(out).length) doors[x.id] = out;
    }
    writeFileSync(join(DATA, `solar-${reg.key}.json`), JSON.stringify({ built: new Date().toISOString().slice(0, 10), assumptions: { usable: USABLE, panelSqft: PANEL_SQFT, panelKw: PANEL_KW, pvwatts: 'NREL/NLR PVWatts v8, 14% losses' }, doors }));
    console.log(`  solar-${reg.key}.json: ${Object.keys(doors).length} doors`);
  }
  console.log(`${withRoof} of ${tot} doors have a solar roof estimate; ${withUtil} have a power company`);
  console.log('power companies:', Object.entries(byUtil).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' | '));
}
