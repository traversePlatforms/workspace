/* Denver's own alley centre lines (2026-10-29), because TIGER draws only 45 alleys in all of Denver County.
 *   node fetch-denver-alleys.mjs    -> cache/denver-alleys.json  [[[lon, lat], ...], ...]   (one line per alley piece)
 * Source: City and County of Denver, Technology Services / GIS, "Alleys" (ODC_PWTRN_TRN_ALLEY_L, layer 116, ArcGIS item
 * c8644edb9f414bd8a438fc55f6bdcd7a), the city's open data. Terms on the item: provided as is, no warranty, the user holds the city
 * harmless, not for engineering purposes; no limit on commercial use. The same publisher and terms as the Denver crime layer
 * build-security.mjs already reads. Credit: "City and County of Denver". */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), CACHE = process.env.LOT_CACHE || join(HERE, 'cache');
const URL = 'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_PWTRN_TRN_ALLEY_L/FeatureServer/116/query';
mkdirSync(CACHE, { recursive: true });
const out = [];
for (let off = 0; ; off += 2000) {
  const q = new URLSearchParams({ where: '1=1', outFields: 'OBJECTID', returnGeometry: 'true', outSR: '4326', f: 'json', resultOffset: String(off), resultRecordCount: '2000' });
  const j = await (await fetch(URL + '?' + q)).json();
  if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 200));
  for (const f of j.features || []) if (f.geometry && f.geometry.paths) for (const p of f.geometry.paths) out.push(p.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]));
  if (!j.exceededTransferLimit && (j.features || []).length < 2000) break;
}
writeFileSync(join(CACHE, 'denver-alleys.json'), JSON.stringify(out));
console.log('Denver alley lines:', out.length);
