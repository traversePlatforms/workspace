/* Sixfold — wildfire hazard for every door. 2026-10-01 (SX-9b).

   Samples the USDA Forest Service's Wildfire Hazard Potential (2023, classified,
   270 m) at each door's parcel centroid and caches the class by coordinate in
   wildfire-cache.json. build-rounds-data.mjs reads that cache and puts the class
   on each door; the app shows it as a badge and sorts neighbourhoods by it.

   Classes — PROVEN on known places, not assumed (see WILDFIRE-HAZARD.md):
     1 very low · 2 low · 3 moderate · 4 high · 5 very high · 6 non-burnable · 7 water

   ⚑ CLASS 6 IS NOT "SAFE". It means the 270 m cell (~18 acres) is mapped as town
   or farmland. A wooded lot can sit inside one. The app shows it as "not rated",
   never as low risk, and never hides a door because of it.

   ⚑ 270 m rates NEIGHBOURHOODS, not lots — neighbouring doors share a value. The
   per-house check is the satellite link.

   Incremental: only coordinates missing from the cache are fetched, so a rebuild
   that adds doors asks about the new ones only. Delete the cache to re-sample all.

   Pipeline:  builder -> build-walklist-pdf.mjs -> sample-wildfire.mjs -> build-rounds-data.mjs
   Run:       node sample-wildfire.mjs                                                 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, 'wildfire-cache.json');
const SERVICE = 'https://imagery.geoplatform.gov/iipp/rest/services/Fire_Aviation/USFS_EDW_RMRS_WildfireHazardPotentialClassified/ImageServer/getSamples';
const BATCH = 400;
const NAME = { 1: 'very low', 2: 'low', 3: 'moderate', 4: 'high', 5: 'very high', 6: 'non-burnable', 7: 'water' };

/* not exported: importing this file would run the network sample. build-rounds-data
   repeats the one-line key instead. */
const coordKey = (la, lo) => `${la},${lo}`;

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const before = Object.keys(cache).length;

/* every coordinate in every sidecar */
const want = new Map();
for (const f of readdirSync(HERE).filter((x) => x.endsWith('-areas.json'))) {
  const j = JSON.parse(readFileSync(join(HERE, f), 'utf8'));
  for (const a of j.areas) for (const d of a.doors) {
    if (typeof d.la !== 'number' || typeof d.lo !== 'number') continue;
    const k = coordKey(d.la, d.lo);
    if (!(k in cache)) want.set(k, [d.lo, d.la]);
  }
}
console.log(`cache holds ${before} coordinates; ${want.size} new to sample`);

async function sample(pts) {
  const body = new URLSearchParams({
    geometry: JSON.stringify({ points: pts, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryMultipoint', returnFirstValueOnly: 'true', f: 'json',
  });
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const j = await (await fetch(SERVICE, { method: 'POST', body })).json();
      if (j.samples) return j.samples;
      if (attempt === 4) throw new Error(JSON.stringify(j.error || j).slice(0, 200));
    } catch (e) { if (attempt === 4) throw e; }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

const keys = [...want.keys()];
for (let i = 0; i < keys.length; i += BATCH) {
  const chunk = keys.slice(i, i + BATCH);
  const samples = await sample(chunk.map((k) => want.get(k)));
  /* getSamples returns locationId in input order */
  for (const s of samples) {
    const v = Number(String(s.value).split(' ')[0]);
    cache[chunk[s.locationId]] = v >= 1 && v <= 7 ? v : null;
  }
  process.stdout.write(`\r  sampled ${Math.min(i + BATCH, keys.length)} / ${keys.length}`);
}
if (keys.length) console.log('');

writeFileSync(CACHE, JSON.stringify(cache));

const tally = {};
for (const v of Object.values(cache)) tally[v] = (tally[v] || 0) + 1;
console.log(`wrote wildfire-cache.json — ${Object.keys(cache).length} coordinates`);
for (const c of [5, 4, 3, 2, 1, 6, 7, null]) if (tally[c]) console.log(`  ${String(tally[c]).padStart(6)}  ${c === null ? 'no value' : NAME[c]}`);
console.log('next: node build-rounds-data.mjs');
