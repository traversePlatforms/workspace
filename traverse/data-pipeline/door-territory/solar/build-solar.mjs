/* solar-<town>.json for the app (2026-10-06, TraverseSolar), from solar-cache.json, pvwatts.json and utilities.geojson.
 *   node sample-solar.mjs --build        (calls build() below)
 * Per door: { a: {S,SE,SW,E,W,N,F} sq ft, sd: median slope of the sun-facing roof (degrees), sh: open | some | heavy,
 *             pn: panels, kw, kwh: a year's output, yr: survey year, u: power company, ui: its EIA utility number }.
 * solar-utilities.json: each power company's EIA-861 figures (utility-figures.mjs), for the card (2026-10-07).
 * The system is an ESTIMATE on stated assumptions, shown as such on the card:
 *   - 60% of the sun-facing roof is usable once fire-code walkways along edges and ridges, vents and chimneys are kept clear;
 *   - a 400 W panel is about 20 sq ft;
 *   - each part produces what PVWatts gives for its facing and slope AT THIS HOUSE'S PART OF THE MAP (pv-grid.json, 2026-10-29:
 *     the 0.25-degree cell's south/25 figure x its 1-degree block's share for the facing and slope; fetch-pv-grid.mjs). Before
 *     2026-10-29 one Larkspur point (pvwatts.json) served every town; it is still the fallback when pv-grid.json is missing;
 *   - flat area counts only when the roof is mostly flat
 *     (panels tilted 10 degrees south), because on a pitched roof the cells reading flat are ridges and valleys;
 *   - it is the most that FITS, not a recommended system (that depends on the household's use);
 *   - shade (2026-10-29, Matthew's go for a production estimate): PVWatts' 14% losses already allow 3% for shading, which is
 *     taken as the open roof. Some tall canopy on the sunny side takes another 10% off, heavy canopy 20%. These two factors are
 *     OUR ASSUMPTION, not a measured shading loss: the scan counts tree cells as tall as the roof within 20 m to the south, it
 *     does not trace the sun's path. The card says so and shows how much was taken off (sf).
 * Per door, added 2026-10-29: ev: 2 (this method), sf: the shade factor when under 1, yk: kWh a year per installed kW here
 * before shade (location, facing and slope only). kwh is after shade from 2026-10-29 (before, it was the unshaded figure).
 * Teller towns have no LiDAR: their doors carry the power company only. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const USABLE = 0.6, PANEL_SQFT = 20, PANEL_KW = 0.4;
const FACING = { S: 180, SE: 135, SW: 225, E: 90, W: 270 };
const shadeOf = (n) => n == null ? null : n < 15 ? 'open' : n < 80 ? 'some' : 'heavy';
const SHADE_FACTOR = { open: 1, some: 0.9, heavy: 0.8 };

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
  /* by place (2026-10-29): the cell's own south/25 figure x the block's share for this facing and slope, between the two nearest
     slopes fetched. A door in a cell or block the grid lacks (measured after the fetch) takes the nearest one. */
  const GRID = existsSync(join(HERE, 'pv-grid.json')) ? JSON.parse(readFileSync(join(HERE, 'pv-grid.json'), 'utf8')) : null;
  const gStep = GRID ? GRID.step : 0.25, gRef = GRID ? `${GRID.ref.tilt}/${GRID.ref.az}` : null;
  const gCells = GRID ? Object.values(GRID.cells) : [], gBlocks = GRID ? Object.entries(GRID.blocks).filter(([, B]) => B.ac[gRef]) : [];
  const nearest = (list, lat, lon, at) => list.reduce((b, o) => { const d = (at(o)[0] - lat) ** 2 + ((at(o)[1] - lon) * Math.cos(lat * Math.PI / 180)) ** 2; return !b || d < b[0] ? [d, o] : b; }, null)[1];
  const gTilts = GRID ? [...new Set(gBlocks.flatMap(([, B]) => Object.keys(B.ac).map((k) => +k.split('/')[0])))].sort((a, b) => a - b) : [];
  const placeAt = (lat, lon) => {
    const c = GRID.cells[`${Math.floor(lat / gStep) * gStep},${Math.floor(lon / gStep) * gStep}`] || nearest(gCells, lat, lon, (o) => o.at);
    const B = GRID.blocks[`${Math.floor(lat)},${Math.floor(lon)}`];
    return { ac: c.ac, B: B && B.ac[gRef] ? B : nearest(gBlocks, lat, lon, ([, o]) => o.at)[1] };
  };
  const shareAt = (B, az, deg) => {
    const have = gTilts.filter((t) => B.ac[`${t}/${az}`]), v = (t) => B.ac[`${t}/${az}`] / B.ac[gRef];
    if (!have.length) throw new Error('no PVWatts figure for facing ' + az);
    if (deg <= have[0]) return v(have[0]);
    if (deg >= have[have.length - 1]) return v(have[have.length - 1]);
    for (let i = 0; i < have.length - 1; i++) if (deg <= have[i + 1]) { const f = (deg - have[i]) / (have[i + 1] - have[i]); return v(have[i]) * (1 - f) + v(have[i + 1]) * f; }
    return v(have[0]);
  };
  const yieldHere = (lat, lon) => {
    if (!GRID || lat == null) return yieldAt;
    const p = placeAt(lat, lon);
    return (az, deg) => p.ac * shareAt(p.B, az, deg);
  };
  console.log(GRID ? `sun figures by place: ${gCells.length} cells, ${gBlocks.length} blocks (${GRID.source}, fetched ${GRID.fetched})` : 'sun figures: one point, pvwatts.json (no pv-grid.json)');
  const util = JSON.parse(readFileSync(join(HERE, 'utilities.geojson'), 'utf8')).features.map((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const xs = polys.flatMap((p) => p[0].map((c) => c[0])), ys = polys.flatMap((p) => p[0].map((c) => c[1]));
    return { name: String(f.properties.LabelName || f.properties.NAME || '').trim(), id: f.properties.ID != null ? String(f.properties.ID) : null, full: String(f.properties.NAME || ''), polys, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], area: polys.reduce((s, p) => s + ringArea(p[0]), 0) };
  });
  /* the smallest service territory holding the house: a town's own utility sits inside a co-op's map */
  const utilityAt = (lon, lat) => {
    let best = null;
    for (const u of util) if (lon >= u.bb[0] && lon <= u.bb[2] && lat >= u.bb[1] && lat <= u.bb[3] && u.polys.some((p) => inPoly(lon, lat, p)) && (!best || u.area < best.area)) best = u;
    return best;
  };
  /* EIA-861 figures by utility number; a territory the map leaves without a number (United Power's) is matched on its name */
  const UF = existsSync(join(HERE, 'utility-figures.json')) ? JSON.parse(readFileSync(join(HERE, 'utility-figures.json'), 'utf8')) : null;
  const norm = (t) => String(t || '').toUpperCase().replace(/\(CO\)|\bINC\b|\bLLC\b|[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const byName = {}; if (UF) for (const [id, o] of Object.entries(UF.u)) byName[norm(o.name)] = id;
  const idOf = (b) => b.id && UF && UF.u[b.id] ? b.id : (byName[norm(b.full)] || byName[norm(b.name)] || null);
  const seenIds = {};
  const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
  let tot = 0, withRoof = 0, withUtil = 0, withEst = 0, kwhSum = 0; const byUtil = {};
  for (const reg of idx.regions) {
    if (String(reg.key).startsWith('com-')) continue;
    const f = join(DATA, `${reg.key}.json`); if (!existsSync(f)) continue;
    const d = JSON.parse(readFileSync(f, 'utf8')), doors = {};
    for (const a of d.areas) for (const x of a.doors) {
      tot++;
      const out = {};
      const ub = x.lat != null ? utilityAt(x.lon, x.lat) : null, u = ub ? ub.name : null;
      if (u) { out.u = u; withUtil++; byUtil[u] = (byUtil[u] || 0) + 1; const ui = idOf(ub); if (ui) { out.ui = ui; seenIds[ui] = true; } }
      const r = TOWNS[reg.key] ? cache[`${x.lat},${x.lon}`] : null;
      if (r && !r.err && r.a) {
        withRoof++;
        out.a = r.a; out.sd = r.sd; out.sh = shadeOf(r.shade); out.yr = r.yr;
        let panels = 0, kwh = 0;
        const yAt = yieldHere(x.lat, x.lon);
        for (const [p, az] of Object.entries(FACING)) { const n = Math.floor((r.a[p] || 0) * USABLE / PANEL_SQFT); panels += n; kwh += n * PANEL_KW * yAt(az, r.sd || 20); }
        /* flat area counts only on a flat or low roof: on a pitched roof the "flat" cells are its ridges and valleys */
        const sloped = ['S', 'SE', 'SW', 'E', 'W', 'N'].reduce((t, p) => t + (r.a[p] || 0), 0);
        if ((r.a.F || 0) > sloped) { const nf = Math.floor(r.a.F * USABLE / PANEL_SQFT); panels += nf; kwh += nf * PANEL_KW * yAt(180, 10); }
        if (panels > 0) {
          const sf = GRID ? (SHADE_FACTOR[out.sh] ?? 1) : 1;
          out.pn = panels; out.kw = Math.round(panels * PANEL_KW * 10) / 10; out.kwh = Math.round(kwh * sf / 100) * 100;
          if (GRID) { out.ev = 2; out.yk = Math.round(kwh / (panels * PANEL_KW)); if (sf < 1) out.sf = sf; withEst++; kwhSum += out.kwh; }
        }
      }
      if (Object.keys(out).length) doors[x.id] = out;
    }
    writeFileSync(join(DATA, `solar-${reg.key}.json`), JSON.stringify({ built: new Date().toISOString().slice(0, 10), assumptions: { usable: USABLE, panelSqft: PANEL_SQFT, panelKw: PANEL_KW, pvwatts: 'NREL/NLR PVWatts v8, 14% losses', ...(GRID ? { sun: 'by place: ' + GRID.step + '-degree cells, ' + GRID.source + ', fetched ' + GRID.fetched, shade: SHADE_FACTOR } : {}) }, doors }));
    console.log(`  solar-${reg.key}.json: ${Object.keys(doors).length} doors`);
  }
  if (UF) {
    const uOut = {}; for (const id of Object.keys(seenIds)) uOut[id] = UF.u[id];
    writeFileSync(join(DATA, 'solar-utilities.json'), JSON.stringify({ source: UF.source, year: UF.year, co: UF.co, u: uOut }));
    console.log(`  solar-utilities.json: ${Object.keys(uOut).length} power companies (EIA-861 ${UF.year})`);
  }
  console.log(`${withRoof} of ${tot} doors have a solar roof estimate; ${withUtil} have a power company`);
  if (withEst) console.log(`${withEst} doors have a production estimate by place and shade, mean ${Math.round(kwhSum / withEst).toLocaleString()} kWh a year`);
  console.log('power companies:', Object.entries(byUtil).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' | '));
}
