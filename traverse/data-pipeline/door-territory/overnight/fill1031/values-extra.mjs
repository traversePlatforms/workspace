/* County appraised value for the towns sample-value.mjs never asked for (2026-10-31, fill1031 stage values): Group 1 (70,488 homes in
   Weld, Jefferson, Boulder, Adams, Arapahoe: their towns were never added to its county list) and Group 3 (the Group 3 stage B values
   step ran with no Group 3 county in that list, so it asked nothing). Same source and rule as sample-value.mjs: the statewide parcel
   composite's "Parcel Total Value" (apprValTot), asked by parcel number, 100 at a time, one request at a time with a pause; a county
   whose rows carry no value (Larimer, for one) is reported and skipped. Only parcel_id, apprValTot and dateReceived are read: no owner
   fields. Writes <out> keyed "lat,lon" like value-cache.json ({ v, d } or { v: null }); the laptop merges it (fills gaps only).
   Usage: node values-extra.mjs <towns file: "key county" lines> <folder with <key>.csv> <out.json>                              */
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const [, , LIST, CSV, OUT] = process.argv;
const LAYER = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function q(params) {
  for (let k = 0; k < 5; k++) {
    try {
      const r = await fetch(LAYER, { method: 'POST', body: new URLSearchParams({ f: 'json', ...params }), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(60000) });
      const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error)); return j;
    } catch (e) { if (k === 4) throw e; await sleep(2000 * (k + 1)); }
  }
}
function csvRows(file) {
  const lines = readFileSync(file, 'utf8').trim().split(/\r?\n/); const head = lines.shift().split(',').map((h) => h.replace(/^"|"$/g, ''));   /* Group 3 files quote the header */
  return lines.map((l) => { const cells = []; let cur = '', qq = false;
    for (let i = 0; i < l.length; i++) { const ch = l[i];
      if (qq) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') qq = false; else cur += ch; }
      else if (ch === '"' && cur === '') qq = true; else if (ch === ',') { cells.push(cur); cur = ''; } else cur += ch; }
    cells.push(cur); return Object.fromEntries(head.map((h, i) => [h, cells[i]])); });
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const names = (await q({ where: '1=1', outFields: 'countyName', returnDistinctValues: 'true', returnGeometry: 'false' })).features.map((f) => f.attributes.countyName).filter(Boolean);
const byNorm = new Map(names.map((n) => [norm(n), n]));
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const save = () => { writeFileSync(OUT + '.tmp', JSON.stringify(out)); renameSync(OUT + '.tmp', OUT); };
const byCounty = new Map();
for (const line of readFileSync(LIST, 'utf8').split(/\r?\n/).filter(Boolean)) { const [key, county] = line.split(/\s+/); (byCounty.get(county) || byCounty.set(county, []).get(county)).push(key); }
let got = 0, empty = 0;
for (const [county, towns] of byCounty) {
  const cn = byNorm.get(norm(county));
  if (!cn) { console.log(`${county}: not on the state layer (${towns.length} towns skipped)`); continue; }
  /* 1 Nov: apprValTot is a text field, so "apprValTot > 0" is refused (and a whole-county count is heavy): ask for one valued row instead */
  const has = ((await q({ where: `countyName='${cn}' AND apprValTot IS NOT NULL AND apprValTot <> '' AND apprValTot <> '0'`, outFields: 'parcel_id', returnGeometry: 'false', resultRecordCount: '1' })).features || []).length;
  if (!has) { console.log(`${cn}: the state layer carries no value here (${towns.length} towns skipped)`); continue; }
  const byParcel = new Map();
  for (const t of towns) {
    const f = join(CSV, `${t}.csv`); if (!existsSync(f)) { console.log(`  ${t}: no csv`); continue; }
    for (const r of csvRows(f)) { if (!r.parcel || !r.lat || !r.lon) continue; const k = `${parseFloat(r.lat)},${parseFloat(r.lon)}`; if (out[k] && out[k].v > 0) continue; (byParcel.get(r.parcel) || byParcel.set(r.parcel, []).get(r.parcel)).push(k); }
  }
  const ids = [...byParcel.keys()]; let cg = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const j = await q({ returnGeometry: 'false', outFields: 'parcel_id,apprValTot,dateReceived', where: `countyName='${cn}' AND parcel_id IN (${batch.map((x) => `'${x.replace(/'/g, "''")}'`).join(',')})` });
    const seen = new Set();
    for (const f of j.features || []) {
      const a = f.attributes || {}, v = parseInt(a.apprValTot, 10), m = String(a.dateReceived || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      const d = m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null; seen.add(a.parcel_id);
      for (const k of byParcel.get(a.parcel_id) || []) out[k] = Number.isFinite(v) && v > 0 ? { v, d } : { v: null, d };
      if (Number.isFinite(v) && v > 0) { got++; cg++; } else empty++;
    }
    for (const p of batch) if (!seen.has(p)) for (const k of byParcel.get(p)) if (!out[k]) out[k] = { v: null, d: null };
    if ((i / 100) % 20 === 0) save();
    await sleep(250);
  }
  save(); console.log(`${cn}: ${ids.length} parcels asked, ${cg} with a value (${towns.length} towns)`);
}
save(); console.log(`values-extra: ${got} parcels with a value, ${empty} without; ${Object.keys(out).length} doors in ${OUT}`);
