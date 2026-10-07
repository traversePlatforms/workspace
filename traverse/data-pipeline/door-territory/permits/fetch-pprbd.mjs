/* Re-roof and solar permits from Pikes Peak Regional Building Department (2026-10-07): Colorado Springs, El Paso County,
 * Fountain, Monument, Palmer Lake and the other towns it permits for. From its public permit map's service
 * (maps.pprbd.org/server/rest/services, Permits_Full_B_WM building and _E_ electrical layers): parcel number, permit date and the
 * project description. No names or addresses are kept. Residential permits since 2016.
 *
 * Kinds, from the description the permit was filed with:
 *   roof   a re-roof ("REROOF", "RE-ROOF", "ROOF REPLACEMENT", "TEAR OFF")
 *   solar  panels put on ("PV SOLAR (7480 WATTS)", "PHOTOVOLTAIC")
 *   rr     solar panels taken off and put back, which is done for a re-roof: the house has solar AND a new roof
 *   off    solar panels removed only
 * The bulk report files are sold by subscription; the public map service is free and states no reuse terms (checked
 * 2026-10-07). Paged politely, one request at a time.
 *
 *   node fetch-pprbd.mjs     writes pprbd-permits.json { through, fetched, permits: { permitNum: [parcel, 'YYYY-MM-DD', kind] } } */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://maps.pprbd.org/server/rest/services';
const SINCE = '2016-01-01', PAGE = 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function kindOf(desc) {
  const d = String(desc || '').toUpperCase();
  /* panels, not a solarium, a solar tube (a skylight), solar screens or a solar-powered attic fan */
  const solar = /\bPV\b|PHOTOVOLT/.test(d) || /SOLAR(?!IUM|\s*-?\s*TUBE|\s*SCREEN|\s*SHADE|\s*(ATTIC|POWERED)?\s*FAN|\s*LIGHT)/.test(d);
  if (solar && /REMOVE\s*(AND|&|\/)\s*(RE-?)?(REPLACE|REINSTALL|RESET)|R\s*&\s*R|DETACH\s*(AND|&)\s*RE/.test(d)) return 'rr';
  if (solar && /REMOVE ONLY|REMOVAL ONLY/.test(d)) return 'off';
  if (solar) return 'solar';
  if (/RE-?\s?ROOF|ROOF\s+REPLACE|REPLACE\s+ROOF|TEAR\s*-?\s*OFF/.test(d)) return 'roof';
  return null;
}

async function layer(code, where) {
  const out = []; let off = 0;
  for (;;) {
    const q = new URLSearchParams({ where, outFields: 'PermitNum,parcel,PermitDate,ProjectDesc', returnGeometry: 'false', orderByFields: 'OBJECTID',
      resultOffset: String(off), resultRecordCount: String(PAGE), f: 'json' });
    let j = null;
    for (let t = 0; t < 4 && !j; t++) {
      try { const r = await fetch(`${BASE}/Permits_Full_${code}_WM/MapServer/0/query`, { method: 'POST', body: q }); j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error)); }
      catch (e) { j = null; console.log(`  ${code} offset ${off}: ${e.message.slice(0, 120)}; retrying`); await sleep(5000 * (t + 1)); }
    }
    if (!j) throw new Error(`${code}: gave up at offset ${off}`);
    out.push(...j.features.map((f) => f.attributes));
    process.stdout.write(`\r  ${code}: ${out.length}`);
    if (j.features.length < PAGE && !j.exceededTransferLimit) break;
    off += j.features.length; await sleep(400);
  }
  process.stdout.write('\n');
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('fetch-pprbd.mjs')) {
  const since = `PermitDate >= DATE '${SINCE}' AND IsResidential = 1`;
  const rows = [
    ...await layer('B', `${since} AND (ProjectDesc LIKE '%ROOF%' OR ProjectDesc LIKE '%TEAR%OFF%' OR ProjectDesc LIKE '%SOLAR%' OR ProjectDesc LIKE '%PHOTOVOLT%' OR ProjectDesc LIKE '%PV %')`),
    ...await layer('E', `${since} AND (ProjectDesc LIKE '%SOLAR%' OR ProjectDesc LIKE '%PHOTOVOLT%' OR ProjectDesc LIKE '%PV %')`),
  ];
  const permits = {}, n = { roof: 0, solar: 0, rr: 0, off: 0 }; let through = '';
  for (const a of rows) {
    const k = kindOf(a.ProjectDesc), p = String(a.parcel || '').trim();
    if (!k || !/^\d{10}$/.test(p) || !a.PermitDate || permits[a.PermitNum]) continue;
    const day = new Date(a.PermitDate).toISOString().slice(0, 10);
    permits[a.PermitNum] = [p, day, k]; n[k]++;
    if (day > through) through = day;
  }
  writeFileSync(join(HERE, 'pprbd-permits.json'), JSON.stringify({ source: 'Pikes Peak Regional Building Department, public permit map service', since: SINCE, through, fetched: new Date().toISOString().slice(0, 10), permits }));
  console.log(`${Object.keys(permits).length} permits through ${through}: ${n.roof} re-roofs, ${n.solar} solar, ${n.rr} solar off-and-on (re-roof), ${n.off} solar removed`);
}
