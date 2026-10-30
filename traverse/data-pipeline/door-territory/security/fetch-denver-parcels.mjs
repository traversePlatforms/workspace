/* Denver's own lot lines (2026-10-29), for the "backs onto a road" fact in an older grid city (the state parcel layer is cached
 * only for Highlands Ranch, Thornton and Westminster, and gis.colorado.gov is busy with another job).
 *   node fetch-denver-parcels.mjs    -> cache/parcels-denver.json  { built, src, cells: { all: [ [ring, ...], ... ] } }
 * (the same shape as the lawn work's lawn-trial/drcog-turf/parcels-<town>.json, so back-lot.mjs reads either.)
 * Source: City and County of Denver, "Parcels" (ODC_PROP_PARCELS_A, layer 245, ArcGIS item 7c53bd0894134e80ae1e478c0789bf49,
 * modified 2026-10-29), the city's open data. Terms on the item: provided as is, no warranty, the user holds the city harmless,
 * not for engineering or survey purposes; no limit on commercial use. The same publisher and terms as Denver's alleys and crime
 * layer already used. Only the geometry is kept (no owner, no account). Credit: "City and County of Denver". */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), CACHE = process.env.LOT_CACHE || join(HERE, 'cache');
const URL = 'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_PROP_PARCELS_A/FeatureServer/245/query';
mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function page(off) {
  const q = new URLSearchParams({ where: '1=1', outFields: 'OBJECTID', orderByFields: 'OBJECTID', returnGeometry: 'true', outSR: '4326', geometryPrecision: '7', f: 'json', resultOffset: String(off), resultRecordCount: '2000' });
  for (let i = 0; i < 5; i++) { try { const j = await (await fetch(URL + '?' + q)).json(); if (!j.error) return j; } catch {} await sleep(2000 * (i + 1)); }
  throw new Error('Denver parcels: page at ' + off + ' failed');
}
const all = [];
for (let off = 0; ; off += 2000) {
  const j = await page(off);
  for (const f of j.features || []) if (f.geometry && f.geometry.rings) all.push(f.geometry.rings);
  if (off % 20000 === 0) console.log('  ', off, all.length);
  if (!j.exceededTransferLimit && (j.features || []).length < 2000) break;
}
writeFileSync(join(CACHE, 'parcels-denver.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), src: 'City and County of Denver, Parcels (ODC_PROP_PARCELS_A)', cells: { all } }));
console.log('Denver parcels:', all.length);
