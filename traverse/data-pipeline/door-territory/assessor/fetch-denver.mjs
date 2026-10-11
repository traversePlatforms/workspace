/* Denver year built and last remodel per parcel (2026-10-10), for roof age and the material model.
 * Source: City and County of Denver open data, "Real Property Residential Characteristics" (updated weekly; 212,852 homes
 * on 2026-10-10), read through its public ArcGIS service. Only PARID, CCYRBLT (year built) and CCAGE_RM (year of the last
 * remodel) are asked for: no owner fields. Writes raw/denver/residential.json { parid: [yb, rm] } (raw/ is gitignored).
 *   node fetch-denver.mjs                                                                                          */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const U = 'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_real_property_residential_characteristics/FeatureServer/50/query';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function page(offset) {
  const q = new URLSearchParams({ where: '1=1', outFields: 'PARID,CCYRBLT,CCAGE_RM', returnGeometry: 'false', orderByFields: 'OBJECTID', resultOffset: String(offset), resultRecordCount: '2000', f: 'json' });
  for (let i = 0; i < 6; i++) {
    try { const j = await (await fetch(U + '?' + q)).json(); if (Array.isArray(j.features)) return j; } catch {}
    await sleep([1, 3, 8, 15, 30, 60][i] * 1000);
  }
  throw new Error('Denver service did not answer at offset ' + offset);
}
const out = {}; let offset = 0, n = 0;
for (;;) {
  const j = await page(offset);
  for (const f of j.features) {
    const a = f.attributes, p = String(a.PARID || '').trim(), yb = +a.CCYRBLT || 0, rm = +a.CCAGE_RM || 0;
    if (p && yb > 1800) { out[p] = rm > yb ? [yb, rm] : [yb]; n++; }
  }
  offset += j.features.length;
  if (!j.features.length || (!j.exceededTransferLimit && j.features.length < 2000)) break;
  if (offset % 20000 === 0) console.log(`  ${offset} read`);
}
mkdirSync(join(HERE, 'raw', 'denver'), { recursive: true });
writeFileSync(join(HERE, 'raw', 'denver', 'residential.json'), JSON.stringify(out));
console.log(`Denver: ${offset} rows read, ${Object.keys(out).length} parcels with a year built`);
