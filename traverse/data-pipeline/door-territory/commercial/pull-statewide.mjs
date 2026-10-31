/* Commercial building list, every county the state's parcel layer serves (2026-10-31 overnight; for later commercial roofing).
 * INTERNAL ONLY: the output goes to commercial/out/ (gitignored) and is never uploaded or published.
 *
 *   node pull-statewide.mjs <outdir>        one county at a time, one request at a time, a pause between pages
 *
 * Source: OIT's Colorado Public Parcels (gis.colorado.gov ... Colorado_Public_Parcels/FeatureServer/0), the same layer the door
 * lists come from. Only these fields are asked for: county, parcel id, property address, lot size, land use code and description,
 * zoning, appraised value. Never an owner, owner address or legal description. Geometry is asked for simplified and reduced to the
 * lot's centre and acreage here; the ring is not kept.
 * A parcel is kept when its land use reads apartment / commercial / industrial (the same words as pull-parcels.mjs, the 5 Oct test)
 * and not condo, church, school, exempt, park or vacant. El Paso carries no attributes on the state layer: see el-paso-list.mjs.
 * Resumable: a county with out/<county>.json is skipped. Writes <outdir>/summary.json (counts only) at the end.
 * gis.colorado.gov bans heavy use: run it alone (no other parcel job at the same time). */
import { writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2]; if (!OUT) { console.error('outdir needed'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const URL0 = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const FIELDS = 'OBJECTID,countyName,parcel_id,situsAdd,sitAddCty,sitAddZip,landAcres,landSqft,landUseCde,landUseDsc,zoningDesc,apprValTot';
const WORDS = ['COMMERC', 'OFFICE', 'WAREHOUSE', 'INDUSTR', 'MERCHAND', 'RETAIL', 'HOTEL', 'MOTEL', 'LODG', 'APART', 'MULTI', 'RESTAURANT', 'SHOPPING',
  'STORE', 'MEDICAL', 'BANK', 'MIXED', 'SPECIAL PURPOSE', 'FLEX', 'MANUFACT', 'AUTO', 'CAR WASH', 'NURSING', '4 TO 8', 'UNITS', 'HALL', 'MARKET',
  'BIG BOX', 'R&D', 'FACTORY', 'STORAGE'];
const USE_WHERE = '(' + WORDS.map((w) => `UPPER(landUseDsc) LIKE '%${w}%'`).join(' OR ') + ')';
const CO_IN = /commercial|office|merchandis|warehouse|industrial|special purpose|lodging|multi-unit|multi unit|apartment|4 to 8 units|retail|r&d|flex|auto service|auto dealer|restaurant|mixed use|factory|conv store|hotel|motel|shopping|bank|medical|nursing|recreation|mixed assessment|market|store|car wash|elderly|hall|big box|supermarket|converted res|storage|manufact|units/i;
const CO_OUT = /condo|church|school|religious|charitable|political|park|vacant|common element|^exempt|non taxable|state non|county non|land only|- ?land$/i;
const kind = (use) => { const u = String(use || '').toUpperCase(); if (/MULTI|APART|4 TO 8|UNITS/.test(u)) return 'apartments'; if (/WAREHOUSE|INDUSTRIAL|MANUFACTUR|FACTORY|FLEX|R&D|STORAGE/.test(u)) return 'industrial'; return 'commercial'; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function q(params) {
  for (let t = 0; t < 5; t++) {
    try {
      const r = await fetch(URL0, { method: 'POST', body: new URLSearchParams({ ...params, f: 'json' }), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Traverse-commercial-list/1.0' } });
      const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 200)); return j;
    } catch (e) { if (t === 4) throw e; await sleep(5000 * (t + 1)); }
  }
}
const centre = (g) => { const ring = ((g && g.rings) || []).slice().sort((a, b) => b.length - a.length)[0]; if (!ring || !ring.length) return [null, null];
  let a = 0, x = 0, y = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; a += f; x += (ring[j][0] + ring[i][0]) * f; y += (ring[j][1] + ring[i][1]) * f; }
  return a ? [+(y / (3 * a)).toFixed(6), +(x / (3 * a)).toFixed(6)] : [ring[0][1], ring[0][0]]; };
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

const stats = await q({ where: '1=1', groupByFieldsForStatistics: 'countyName', outStatistics: JSON.stringify([{ statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'n' }]) });
const counties = (stats.features || []).map((f) => f.attributes.countyName).filter(Boolean).sort();
console.log(`${counties.length} counties on the state layer`);
const summary = {};
for (const c of counties) {
  const slug = c.toLowerCase().replace(/[^a-z]+/g, '-'), f = join(OUT, `${slug}.json`);
  if (existsSync(f)) { console.log(`${c}: done before`); continue; }
  const where = `countyName='${c.replace(/'/g, "''")}' AND ${USE_WHERE}`;
  const total = (await q({ where, returnCountOnly: 'true' })).count || 0;
  const rows = []; let off = 0, seen = 0;
  while (off < total) {
    const j = await q({ where, outFields: FIELDS, orderByFields: 'OBJECTID', resultOffset: String(off), resultRecordCount: '1000', returnGeometry: 'true', outSR: '4326', maxAllowableOffset: '0.00005', geometryPrecision: '6' });
    const fs = j.features || []; if (!fs.length) break;
    for (const ft of fs) {
      seen++; const a = ft.attributes, use = clean(a.landUseDsc);
      if (!CO_IN.test(use) || CO_OUT.test(use)) continue;
      const [lat, lon] = centre(ft.geometry);
      rows.push({ county: c, parcel: clean(a.parcel_id), address: clean(a.situsAdd), city: clean(a.sitAddCty), zip: clean(a.sitAddZip), use, useCode: clean(a.landUseCde),
        kind: kind(use), zoning: clean(a.zoningDesc) || undefined, acres: a.landAcres ? +(+a.landAcres).toFixed(3) : undefined, value: a.apprValTot || undefined, lat, lon });
    }
    off += fs.length; await sleep(1200);
  }
  const tmp = f + '.tmp'; writeFileSync(tmp, JSON.stringify({ source: 'Colorado Public Parcels (OIT GIS), gis.colorado.gov', built: new Date().toISOString().slice(0, 10), county: c, rows })); renameSync(tmp, f);
  const by = {}; for (const r of rows) by[r.kind] = (by[r.kind] || 0) + 1;
  summary[c] = { matched: total, kept: rows.length, ...by };
  console.log(`${c}: ${total} matched the use words, ${rows.length} kept ${JSON.stringify(by)}`);
  await sleep(3000);
}
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
console.log('commercial list: done');
