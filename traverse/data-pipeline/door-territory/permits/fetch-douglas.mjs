/* Re-roof and solar permits from Douglas County's own building division (2026-10-07): unincorporated Douglas County, which
 * holds Highlands Ranch, Sedalia, Franktown, Larkspur and the countryside. Castle Rock, Parker and Castle Pines permit for
 * themselves and are not in this layer. From the county's open data ("All Permits", services.arcgis.com/seTexOicoRXDvRsJ,
 * All_Permits_View), updated nightly. The layer has no parcel numbers, so doors are matched on the street address.
 *   roof: job type Roofing (its description is the material: Composition, Concrete Tile, ...)
 *   solar / rr / off: any permit whose description or scope names solar or photovoltaic (kinds as in fetch-pprbd.mjs)
 * and since 2026-10-29 (the editions' trades), building permits by the county's own description: new (RS - Stock, RS - Custom: a new
 * house), pool (AU - Private Pool), deck (AU - Deck, AU - Patio Cover), fence (Fencing), and an addition named in the scope of work.
 * Since 2016, issued permits only.
 * TRAVERSE_MAIN=<repo root>: that tree's permit files (from a worktree), as in fetch-pprbd.mjs.
 *
 *   node fetch-douglas.mjs     writes douglas-permits.json { through, permits: { permitNo: [address, 'YYYY-MM-DD', kind, material?] } } */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kindOf } from './fetch-pprbd.mjs';
import { textKind } from './kinds.mjs';

const HERE = process.env.TRAVERSE_MAIN ? join(process.env.TRAVERSE_MAIN, 'traverse', 'data-pipeline', 'door-territory', 'permits') : dirname(fileURLToPath(import.meta.url));
/* the county's building descriptions that name the kind outright */
const BLD = { 'RS - Stock': 'new', 'RS - Custom': 'new', 'AU - Private Pool': 'pool', 'AU - Deck': 'deck', 'AU - Patio Cover': 'deck', 'RS - Fencing': 'fence', 'CM - Fencing': 'fence' };
const URL0 = 'https://services.arcgis.com/seTexOicoRXDvRsJ/arcgis/rest/services/All_Permits_View/FeatureServer/0/query';
const SINCE = '2016-01-01', PAGE = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const normAddr = (a) => String(a || '').toUpperCase().replace(/[.,#]/g, ' ').replace(/\s+(UNIT|APT|STE)\s+\S+$/, '').replace(/\s+/g, ' ').trim();

async function pull(where) {
  const out = []; let off = 0;
  for (;;) {
    const q = new URLSearchParams({ where, outFields: 'PERMIT_NUMBER,PERMIT_JOB_TYPE,DESCRIPTION,SCOPE_OF_WORK,ISSUED_DATE,ORIGINAL_ADDRESS_1,STATUS_CURRENT',
      returnGeometry: 'false', orderByFields: 'OBJECTID', resultOffset: String(off), resultRecordCount: String(PAGE), f: 'json' });
    let j = null;
    for (let t = 0; t < 4 && !j; t++) {
      try { const r = await fetch(URL0, { method: 'POST', body: q }); j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error)); }
      catch (e) { j = null; console.log(`  offset ${off}: ${e.message.slice(0, 120)}; retrying`); await sleep(5000 * (t + 1)); }
    }
    if (!j) throw new Error(`gave up at offset ${off}`);
    out.push(...j.features.map((f) => f.attributes));
    process.stdout.write(`\r  ${out.length}`);
    if (j.features.length < PAGE && !j.exceededTransferLimit) break;
    off += j.features.length; await sleep(400);
  }
  process.stdout.write('\n');
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('fetch-douglas.mjs')) {
  const since = `ISSUED_DATE >= DATE '${SINCE}'`;
  const rows = [
    ...await pull(`${since} AND PERMIT_JOB_TYPE = 'Roofing'`),
    ...await pull(`${since} AND PERMIT_JOB_TYPE <> 'Roofing' AND (UPPER(DESCRIPTION) LIKE '%SOLAR%' OR UPPER(SCOPE_OF_WORK) LIKE '%SOLAR%' OR UPPER(DESCRIPTION) LIKE '%PHOTOVOLT%' OR UPPER(SCOPE_OF_WORK) LIKE '%PHOTOVOLT%')`),
    ...await pull(`${since} AND PERMIT_JOB_TYPE = 'Building' AND (DESCRIPTION IN (${Object.keys(BLD).map((x) => `'${x}'`).join(',')}) OR UPPER(SCOPE_OF_WORK) LIKE '%ADDITION%')`),
  ];
  const permits = {}, n = { roof: 0, solar: 0, rr: 0, off: 0, new: 0, add: 0, pool: 0, fence: 0, deck: 0 }; let through = '';
  for (const a of rows) {
    if (!a.ISSUED_DATE || !a.ORIGINAL_ADDRESS_1 || /VOID|CANCEL|WITHDRAW|EXPIRED|DENIED/i.test(a.STATUS_CURRENT || '')) continue;
    const text = `${a.DESCRIPTION || ''} ${a.SCOPE_OF_WORK || ''}`;
    const k = a.PERMIT_JOB_TYPE === 'Roofing' ? 'roof' : kindOf(text) || BLD[a.DESCRIPTION] || (a.PERMIT_JOB_TYPE === 'Building' && textKind(a.SCOPE_OF_WORK) === 'add' ? 'add' : null);
    if (!k || permits[a.PERMIT_NUMBER]) continue;
    const day = new Date(a.ISSUED_DATE).toISOString().slice(0, 10);
    const mat = k === 'roof' && a.DESCRIPTION ? String(a.DESCRIPTION).trim().slice(0, 40) : undefined;
    permits[a.PERMIT_NUMBER] = mat ? [normAddr(a.ORIGINAL_ADDRESS_1), day, k, mat] : [normAddr(a.ORIGINAL_ADDRESS_1), day, k]; n[k]++;
    if (day > through) through = day;
  }
  writeFileSync(join(HERE, 'douglas-permits.json'), JSON.stringify({ source: 'Douglas County building division, open data (All Permits)', since: SINCE, through, fetched: new Date().toISOString().slice(0, 10), permits }));
  console.log(`${Object.keys(permits).length} permits through ${through}: ${n.roof} re-roofs, ${n.solar} solar, ${n.rr} solar off-and-on, ${n.off} solar removed; ${n.new} new houses, ${n.add} additions, ${n.pool} pools, ${n.fence} fences, ${n.deck} decks or patio covers`);
}
