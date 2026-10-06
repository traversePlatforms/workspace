/* The 2023 roof close-up for every house (Matthew 2026-10-05).
 * The material scan (fetch.mjs) already found, per house, a window on the roof and the USDA NAIP 2023 photo (0.3 m in
 * Colorado) that holds it. This turns that index into a small file per town the app reads:
 *   app/data/rounds/naip-<town>.json = { source, built, doors: { <id>: [item, minLon, minLat, maxLon, maxLat] } }
 * The window is widened 1.6x so the yard around the roof shows. The phone asks Microsoft Planetary Computer's public data
 * API for that window as a picture when someone taps "See the roof"; nothing is stored on our server.
 *   node build-naip-photos.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', '..', '..', 'app', 'data', 'rounds');
const TOWNS = ['black-forest', 'monument', 'palmer-lake', 'castle-rock', 'franktown', 'sedalia', 'larkspur', 'woodland-park', 'divide', 'florissant', 'cripple-creek'];
const GROW = 1.6;
let total = 0;
for (const town of TOWNS) {
  const f = join(HERE, 'cache', `crops-${town}.json`);
  if (!existsSync(f)) { console.log(town, 'no crop index'); continue; }
  const idx = JSON.parse(readFileSync(f, 'utf8')), doors = {};
  for (const [id, e] of Object.entries(idx)) {
    if (!e || !e.item || !e.bbox) continue;
    const [x0, y0, x1, y1] = e.bbox, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (x1 - x0) / 2 * GROW, hy = (y1 - y0) / 2 * GROW;
    doors[id] = [e.item, +(cx - hx).toFixed(6), +(cy - hy).toFixed(6), +(cx + hx).toFixed(6), +(cy + hy).toFixed(6)];
  }
  writeFileSync(join(OUT, `naip-${town}.json`), JSON.stringify({ source: 'USDA NAIP 2023, 0.3 m (Colorado), public domain, via Microsoft Planetary Computer; window from roofs/material/fetch.mjs', built: new Date().toISOString().slice(0, 10), doors }));
  total += Object.keys(doors).length;
  console.log(town, Object.keys(doors).length);
}
console.log('total', total);
