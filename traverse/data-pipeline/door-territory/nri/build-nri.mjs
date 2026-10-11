/* nri-<town>.json for the app (2026-10-07): FEMA's National Risk Index for the census tract each door is in. Area facts from
 * FEMA, never a rating of the house. FEMA retired the Index's own website in 2025; the data is kept up (v1.20, December 2025)
 * and published on OpenFEMA and as FEMA's ArcGIS layer "National Risk Index Census Tracts"
 * (services.arcgis.com/XG15cJAlne2vxtgt/.../National_Risk_Index_Census_Tracts/FeatureServer/0), read here for Colorado only.
 * Per hazard: FEMA's risk rating (Very Low ... Very High, relative to all US tracts) and its annualized frequency (events a year).
 *   h hail, w strong wind, t tornado, f wildfire  ->  [rating, events a year]
 *   node build-nri.mjs     writes nri-cache.json (Colorado tracts) and app/data/rounds/nri-<town>.json { ver, tracts, doors: { id: tract } } */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { metros } from '../metros/registry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const LAYER = 'https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Census_Tracts/FeatureServer/0/query';
const HAZ = { h: 'HAIL', w: 'SWND', t: 'TRND', f: 'WFIR' };

/* the metro builder (2026-10-11): METRO=<metro> fetches that metro's counties into its own cache and writes only its towns */
const METRO = process.env.METRO || '';
const MDEF = METRO ? metros().find((m) => m.key === METRO) : null;
if (METRO && !MDEF) throw new Error('no metro ' + METRO);
const METRO_GROUPS = new Set(metros().map((m) => m.group || m.key));
const mineTown = (reg) => (METRO ? reg.group === METRO : !METRO_GROUPS.has(reg.group));
const MCOUNTIES = MDEF ? Object.values(MDEF.sources) : [];
const CACHE = join(HERE, METRO ? `nri-cache-${METRO}.json` : 'nri-cache.json');

if (!existsSync(CACHE) || process.argv.includes('--fetch')) {
  const fields = ['TRACTFIPS', 'COUNTY', 'NRI_VER', ...Object.values(HAZ).flatMap((h) => [`${h}_RISKR`, `${h}_AFREQ`])];
  const where = MDEF ? `STATEABBRV='${MDEF.state}' AND COUNTY IN (${MCOUNTIES.map((c) => `'${c.countyName}'`).join(',')})` : "STATEABBRV='CO'";
  const j = { type: 'FeatureCollection', features: [] };
  for (let off = 0; ; off += 2000) {   /* paged (2026-10-11): a big state has more tracts than one page */
    const q = new URLSearchParams({ where, outFields: fields.join(','), outSR: '4326', maxAllowableOffset: '0.0003', resultOffset: String(off), resultRecordCount: '2000', orderByFields: 'TRACTFIPS', f: 'geojson' });
    const p = await (await fetch(LAYER, { method: 'POST', body: q })).json();
    if (!p.features) throw new Error('NRI: ' + JSON.stringify(p).slice(0, 200));
    j.features.push(...p.features); if (p.features.length < 2000) break;
  }
  writeFileSync(CACHE, JSON.stringify(j));
  console.log(`fetched ${j.features.length} Colorado tracts (${j.features[0].properties.NRI_VER})`);
}
const fc = JSON.parse(readFileSync(CACHE, 'utf8'));
const r1 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);   /* tornado frequencies are tiny: three places */
const tracts = fc.features.map((f) => {
  const p = f.properties, polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const xs = polys.flatMap((pp) => pp[0].map((c) => c[0])), ys = polys.flatMap((pp) => pp[0].map((c) => c[1]));
  const rec = { c: p.COUNTY };
  for (const [k, h] of Object.entries(HAZ)) if (p[`${h}_RISKR`]) rec[k] = [p[`${h}_RISKR`], r1(p[`${h}_AFREQ`])];
  return { id: p.TRACTFIPS, ver: p.NRI_VER, rec, polys, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
});
const ver = tracts[0] ? tracts[0].ver : '';
function inRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const inPoly = (x, y, rings) => inRing(x, y, rings[0]) && !rings.slice(1).some((r) => inRing(x, y, r));
const tractAt = (lon, lat) => { for (const t of tracts) if (lon >= t.bb[0] && lon <= t.bb[2] && lat >= t.bb[1] && lat <= t.bb[3] && t.polys.some((p) => inPoly(lon, lat, p))) return t; return null; };

const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
let tot = 0, hit = 0;
for (const reg of idx.regions) {
  if (String(reg.key).startsWith('com-') || !mineTown(reg)) continue;
  const f = join(DATA, `${reg.key}.json`); if (!existsSync(f)) continue;
  const d = JSON.parse(readFileSync(f, 'utf8')), doors = {}, used = {};
  let n = 0, k = 0;
  for (const a of d.areas) for (const x of a.doors) {
    n++; if (x.lat == null) continue;
    const t = tractAt(x.lon, x.lat); if (!t) continue;
    doors[x.id] = t.id; used[t.id] = t.rec; k++;
  }
  writeFileSync(join(DATA, `nri-${reg.key}.json`), JSON.stringify({ built: new Date().toISOString().slice(0, 10), source: 'FEMA National Risk Index', ver, tracts: used, doors }));
  console.log(`  nri-${reg.key}.json: ${k} of ${n} doors in ${Object.keys(used).length} tracts`);
  tot += n; hit += k;
}
console.log(`${hit} of ${tot} doors placed in a tract (${ver})`);
