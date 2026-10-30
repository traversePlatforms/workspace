/* Building permits from the cities that publish them as open data (2026-10-29, Matthew: permits per trade in the editions).
 * One feed per city, each read from the city's own ArcGIS service, politely (one page at a time, a pause between), and kept as
 * [match key, 'YYYY-MM-DD', kind] like douglas-permits.json. Contractor, applicant and owner fields are never read.
 *
 *   denver    City and County of Denver, Residential Construction Permits (Accela RESCON, issued since 7 June 2015), licence CC BY 3.0
 *             ("City of Denver Open Data Catalog"). Matched on the parcel (SCHEDNUM = the county schedule number in the town list).
 *             Denver publishes the permit class only: New Building (a house, but also a garage or other new building) and Addition.
 *             No re-roof or solar layer is published.
 *   aurora    City of Aurora, Building Permits (OpenData MapServer layer 44), the city's open data site (CC BY-SA, with the city's
 *             no-warranty download disclaimer). Matched on the street address. Re-roof (Roofing-RT2), solar (Solar PV Residential),
 *             new house (Single-Family Detached), addition, pool, fence, deck and patio cover; issued permits only.
 *   boulder   City of Boulder, Construction Permits (open-data.bouldercolorado.gov), licence CC0 1.0. Matched on the Boulder County
 *             parcel (BOCOPIN). Re-roof (Roofing Replacement; "Existing Solar Panels" = solar off and on for it), solar (an electrical
 *             permit naming PV or solar, or with PV kilowatts), new single-family house, addition, fence and wall, pool, deck.
 *   longmont  City of Longmont permits as published by Boulder County (maps.bouldercounty.org PLANNING/LONGMONT_Permits), licence
 *             CC BY 4.0. Matched on the parcel. A rolling window (mostly 2024 on), so it never proves a house has no permit.
 *             Re-roofs sit inside combo permits and are read from the description.
 * TRAVERSE_MAIN=<repo root>: that tree's permit files (from a worktree), as in fetch-pprbd.mjs.
 *
 *   node fetch-open.mjs [denver aurora boulder longmont]     (all four when none named) writes <city>-permits.json */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kindOf } from './fetch-pprbd.mjs';
import { normAddr } from './fetch-douglas.mjs';
import { textKind } from './kinds.mjs';

const HERE = process.env.TRAVERSE_MAIN ? join(process.env.TRAVERSE_MAIN, 'traverse', 'data-pipeline', 'door-territory', 'permits') : dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SINCE = '2016-01-01';
const day = (v) => { if (v === null || v === undefined || v === '') return null; const d = typeof v === 'number' ? new Date(v) : /^\d{1,2}\/\d{1,2}\/\d{4}/.test(v) ? new Date(v.replace(/^(\d+)\/(\d+)\/(\d{4}).*/, '$3-$1-$2') + 'T12:00:00Z') : new Date(String(v).slice(0, 10) + 'T12:00:00Z'); return isNaN(d) ? null : d.toISOString().slice(0, 10); };
const pad = (s) => s.replace(/^(\d{4})-(\d)-/, '$1-0$2-').replace(/-(\d)$/, '-0$1');

const FEEDS = {
  denver: {
    url: 'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_DEV_RESIDENTIALCONSTPERMIT_P/FeatureServer/316/query',
    source: 'City and County of Denver, Residential Construction Permits (Denver Open Data Catalog, CC BY 3.0)',
    oid: 'OBJECTID', page: 2000,
    where: `DATE_ISSUED >= DATE '${SINCE}' AND CANCEL IS NULL AND UPPER(CLASS) IN ('NEW BUILDING', '1 - NEW BUILDING', 'ADDITION', '2 - ADDITION TO BUILDING')`,
    fields: 'PERMIT_NUM,DATE_ISSUED,SCHEDNUM,CLASS',
    row: (a) => { const c = String(a.CLASS || '').toUpperCase(); const k = /NEW BUILDING/.test(c) ? 'new' : /ADDITION/.test(c) ? 'add' : null;
      const p = String(a.SCHEDNUM || '').trim(); return k && /^\d{13}$/.test(p) ? [a.PERMIT_NUM, p, day(a.DATE_ISSUED), k] : null; },
  },
  aurora: {
    url: 'https://ags.auroragov.org/aurora/rest/services/OpenData/MapServer/44/query',
    source: 'City of Aurora, Building Permits (Aurora open data)',
    oid: 'OBJECTID', page: 2000,
    where: `IssueDate >= DATE '${SINCE}' AND SubDesc IN ('Roofing-RT2', 'Solar PV Residential Permit', 'Single-Family Detached', 'Residential Addition Permit', 'Residential Pool', 'Fence Permit', 'Residential Deck Permit', 'Residential Patio Cover')`,
    fields: 'Permit_,IssueDate,SubDesc,FolderDescription,Address',
    row: (a) => {
      const S = { 'Roofing-RT2': 'roof', 'Single-Family Detached': 'new', 'Residential Addition Permit': 'add', 'Residential Pool': 'pool', 'Fence Permit': 'fence', 'Residential Deck Permit': 'deck', 'Residential Patio Cover': 'deck' };
      const k = a.SubDesc === 'Solar PV Residential Permit' ? (kindOf(a.FolderDescription) || 'solar') : S[a.SubDesc];
      const s = normAddr(a.Address); return k && s && /^\d/.test(s) ? [a.Permit_, s, day(a.IssueDate), k] : null; },
  },
  boulder: {
    url: 'https://services.arcgis.com/ePKBjXrBZ2vEEgWd/arcgis/rest/services/Construction_Permits/FeatureServer/0/query',
    source: 'City of Boulder, Construction Permits (Boulder open data, CC0 1.0)',
    oid: 'ObjectId', page: 1000,
    where: `IssuedDate >= '${SINCE}' AND (PermitType IN ('Roofing Replacement Permit', 'Fence and Wall Permit', 'Building Permit - Single Family Detached Dwelling', 'Building Permit - Single Family Attached Dwelling')` +
      ` OR (PermitType = 'Electrical Permit' AND (PhotovoltaicKilowatt IS NOT NULL OR UPPER(Description) LIKE '%SOLAR%' OR UPPER(Description) LIKE '%PHOTOVOLT%' OR UPPER(Description) LIKE '%PV %'))` +
      ` OR (PermitType = 'Building Permit - Accessory' AND (UPPER(PermitWorkType) LIKE '%POOL%' OR UPPER(Description) LIKE '%POOL%' OR UPPER(Description) LIKE '%DECK%')))`,
    fields: 'PermitNum,IssuedDate,StatusCurrent,BOCOPIN,PermitType,PermitWorkType,Description,PhotovoltaicKilowatt',
    row: (a) => {
      if (/VOID|CANCEL|WITHDRAW|EXPIRED|DENIED|REVOKED/i.test(a.StatusCurrent || '')) return null;
      const t = a.PermitType, w = String(a.PermitWorkType || ''); let k = null;
      if (t === 'Roofing Replacement Permit') k = /solar/i.test(w) ? 'rr' : 'roof';
      else if (t === 'Fence and Wall Permit') k = 'fence';
      else if (t === 'Electrical Permit') k = kindOf(a.Description) || (parseFloat(a.PhotovoltaicKilowatt) > 0 ? 'solar' : null);
      else if (/^Building Permit - Single Family/.test(t)) k = /^New$|Modular/.test(w) ? 'new' : /Addition/.test(w) ? 'add' : null;
      else if (t === 'Building Permit - Accessory') k = /pool/i.test(w) ? 'pool' : textKind(a.Description) === 'pool' ? 'pool' : textKind(a.Description) === 'deck' ? 'deck' : null;
      const p = String(a.BOCOPIN || '').trim(); return k && /^\d{12}$/.test(p) ? [a.PermitNum, p, day(a.IssuedDate), k] : null; },
  },
  longmont: {
    url: 'https://maps.bouldercounty.org/arcgis/rest/services/PLANNING/LONGMONT_Permits/MapServer/1/query',
    source: 'City of Longmont permits, published by Boulder County (CC BY 4.0)',
    oid: 'OBJECTID', page: 2000,
    where: `Alias IN ('Fence', 'New Construction - Residential', 'PV System - Residential', 'Deck - Residential', 'Patio Cover - Residential', 'Addition - Residential')` +
      ` OR (Alias LIKE 'Combo Permit%' AND (UPPER(Description) LIKE '%REROOF%' OR UPPER(Description) LIKE '%RE-ROOF%' OR UPPER(Description) LIKE '%RE ROOF%' OR UPPER(Description) LIKE '%ROOF REPLACE%' OR UPPER(Description) LIKE '%REPLACE ROOF%' OR UPPER(Description) LIKE '%TEAR OFF%'))`,
    fields: 'Permit,Parcel,Alias,Status,Issued_Date,FinaledDate,Description',
    row: (a) => {
      if (/VOID|CANCEL|WITHDRAW|EXPIRED|DENIED/i.test(a.Status || '')) return null;
      const A = { Fence: 'fence', 'New Construction - Residential': 'new', 'PV System - Residential': 'solar', 'Deck - Residential': 'deck', 'Patio Cover - Residential': 'deck', 'Addition - Residential': 'add' };
      const k = /^Combo/.test(a.Alias || '') ? (kindOf(a.Description) === 'roof' || kindOf(a.Description) === 'rr' ? kindOf(a.Description) : null) : A[a.Alias];
      const d = day(a.Issued_Date) || day(a.FinaledDate);   /* the issue date is often blank; then the day it was finaled */
      const p = String(a.Parcel || '').trim(); return k && d && /^\d{12}$/.test(p) ? [a.Permit, p, pad(d), k] : null; },
  },
};

async function pull(F) {
  const out = []; let off = 0;
  for (;;) {
    const q = new URLSearchParams({ where: F.where, outFields: F.fields, returnGeometry: 'false', orderByFields: F.oid, resultOffset: String(off), resultRecordCount: String(F.page), f: 'json' });
    let j = null;
    for (let t = 0; t < 4 && !j; t++) {
      try { const r = await fetch(F.url, { method: 'POST', body: q }); j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error)); }
      catch (e) { j = null; console.log(`  offset ${off}: ${e.message.slice(0, 160)}; retrying`); await sleep(5000 * (t + 1)); }
    }
    if (!j) throw new Error(`gave up at offset ${off}`);
    out.push(...j.features.map((f) => f.attributes));
    process.stdout.write(`\r  ${out.length}`);
    if (j.features.length < F.page && !j.exceededTransferLimit) break;
    off += j.features.length; await sleep(400);
  }
  process.stdout.write('\n');
  return out;
}

const want = process.argv.slice(2).filter((x) => FEEDS[x]);
for (const city of want.length ? want : Object.keys(FEEDS)) {
  const F = FEEDS[city]; console.log(city);
  const rows = await pull(F), permits = {}, n = {}; let since = '', through = '';
  for (const a of rows) {
    const r = F.row(a); if (!r || !r[2] || r[2] < '2000') continue;
    const [num, key, d, k] = r; if (permits[num]) continue;
    permits[num] = [key, d, k]; n[k] = (n[k] || 0) + 1;
    if (d > through) through = d; if (!since || d < since) since = d;
  }
  if (!Object.keys(permits).length) throw new Error(`${city}: no permits kept (the feed changed?)`);
  writeFileSync(join(HERE, `${city}-permits.json`), JSON.stringify({ source: F.source, since: city === 'longmont' ? since : (since > SINCE ? since : SINCE), through, fetched: new Date().toISOString().slice(0, 10), permits }));
  console.log(`${city}-permits.json: ${Object.keys(permits).length} permits, ${since} to ${through}: ${Object.entries(n).map(([k, v]) => v + ' ' + k).join(', ')}`);
}
