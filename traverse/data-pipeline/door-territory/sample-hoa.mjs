/* Subdivision / district names and nearby Firewise communities, per door (2026-10-02).

   Names, by county — there is no single source:
     Teller   subdivision name on the statewide parcel record (subName; ~100% filled)
     Douglas  the county's "Property Subdivision Data" table, joined on the assessor
              account number (the statewide subName is 0% filled for Douglas)
     El Paso  no public subdivision names at all (its parcel layer carries only the parcel
              number). Used instead: the county's Metropolitan District boundaries, which
              cover many of the newer subdivisions. Older rural areas get no name.
   ⚑ A subdivision is not an HOA. Many have one, some don't, and the state HOA registry
     can only be searched by name — see HOA-RECORDS-REQUEST.md for getting the full list.

   Firewise: NFPA's own "Firewise sites In Good Standing 2026" layer (points, not
   boundaries — one dot per site). A door gets the nearest site within 600 m, labelled
   "nearby" so nobody tells a homeowner they are in it without checking.

   Writes hoa-cache.json: { "lat,lon": { sub?, metro?, fw?, fwd? } }. Then build-rounds-data.mjs.
   Run: node sample-hoa.mjs                                                              */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'hoa-cache.json');
const TOWNS = { monument: 'elpaso', 'palmer-lake': 'elpaso', 'black-forest': 'elpaso', 'castle-rock': 'douglas', larkspur: 'douglas', sedalia: 'douglas', franktown: 'douglas',
  'woodland-park': 'teller', divide: 'teller', florissant: 'teller', 'cripple-creek': 'teller', 'highlands-ranch': 'douglas', parker: 'douglas', 'castle-pines': 'douglas' };
const STATE = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const DOUGLAS_SUBS = 'https://services.arcgis.com/seTexOicoRXDvRsJ/arcgis/rest/services/OpenData/FeatureServer/6/query';
const EPC_METRO = 'https://gisservices.elpasoco.com/arcgis2/rest/services/HubPublic/MetropolitanDistricts/FeatureServer/0/query';
const FIREWISE = 'https://services1.arcgis.com/0V03GIVRCAoxbtdR/arcgis/rest/services/Firewise_sites_In_Good_Standing_2024/FeatureServer/0/query';
const FW_RADIUS = 600;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function json(url, body) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body } : undefined); if (r.ok) { const j = await r.json(); if (!j.error) return j; } } catch {}
    await sleep(1000 * (i + 1));
  }
  throw new Error('fetch failed: ' + url.slice(0, 90));
}
async function pages(url, params) {
  const out = []; let offset = 0;
  for (;;) {
    const j = await json(url, new URLSearchParams({ f: 'json', ...params, resultOffset: String(offset), resultRecordCount: '2000' }).toString());
    const fs = j.features || []; out.push(...fs);
    if (fs.length < 2000 && !j.exceededTransferLimit) break;
    offset += fs.length; if (!fs.length) break;
  }
  return out;
}
function inRing(x, y, r) { let s = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) s = !s; } return s; }
const inRings = (x, y, rings) => rings.filter((r) => inRing(x, y, r)).length % 2 === 1;
const metres = (a, b, c, d) => { const k = Math.cos(b * Math.PI / 180); return Math.hypot((c - a) * 111320 * k, (d - b) * 110540); };
const tidy = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const fw = (await pages(FIREWISE, { where: "State='CO'", outFields: 'Name,City,County,ResidentCount,ApprovalYear', returnGeometry: 'true', outSR: '4326' }))
  .filter((f) => f.geometry).map((f) => ({ name: tidy(f.attributes.Name), x: f.geometry.x, y: f.geometry.y }));
console.log(`Firewise: ${fw.length} Colorado sites`);

const cache = {};
for (const [town, county] of Object.entries(TOWNS)) {
  const p = join(HERE, `${town}-areas.json`);
  if (!existsSync(p)) continue;
  const doors = JSON.parse(readFileSync(p, 'utf8')).areas.flatMap((a) => a.doors).filter((d) => typeof d.la === 'number');
  const bbox = [Math.min(...doors.map((d) => d.lo)) - 0.003, Math.min(...doors.map((d) => d.la)) - 0.003, Math.max(...doors.map((d) => d.lo)) + 0.003, Math.max(...doors.map((d) => d.la)) + 0.003];
  const geo = { geometry: bbox.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', geometryPrecision: '6' };
  let named = 0, fwHits = 0;
  const lots = county === 'elpaso' ? [] : (await pages(STATE, { ...geo, outFields: 'account,subName' })).filter((f) => f.geometry);
  const metro = county === 'elpaso' ? (await pages(EPC_METRO, { ...geo, where: '1=1', outFields: 'NAME' })).filter((f) => f.geometry) : [];
  /* Douglas: account -> subdivision, fetched for the accounts we need, 150 at a time */
  const subByAcct = new Map();
  /* grid index: ~15,000 lots per town, so no door scans them all */
  const CELL = 0.004, gk = (x, y) => Math.floor(x / CELL) + "," + Math.floor(y / CELL), lotGrid = new Map();
  for (const f of lots) {
    const pts = f.geometry.rings.flat(), xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    for (let gx = Math.floor(Math.min(...xs) / CELL); gx <= Math.floor(Math.max(...xs) / CELL); gx++) for (let gy = Math.floor(Math.min(...ys) / CELL); gy <= Math.floor(Math.max(...ys) / CELL); gy++) {
      const k = gx + "," + gy; if (!lotGrid.has(k)) lotGrid.set(k, []); lotGrid.get(k).push(f);
    }
  }
  const lotOf = (d) => (lotGrid.get(gk(d.lo, d.la)) || []).find((f) => inRings(d.lo, d.la, f.geometry.rings));
  const doorLot = new Map(doors.map((d) => [d, lotOf(d)]));
  if (county === 'douglas') {
    const accts = [...new Set([...doorLot.values()].filter(Boolean).map((f) => tidy(f.attributes.account)).filter(Boolean))];
    for (let i = 0; i < accts.length; i += 150) {
      const batch = accts.slice(i, i + 150);
      const rows = await pages(DOUGLAS_SUBS, { where: `ACCOUNT_NO IN (${batch.map((a) => `'${a.replace(/'/g, '')}'`).join(',')})`, outFields: 'ACCOUNT_NO,SUBDIVISION_NAME', returnGeometry: 'false' });
      for (const r of rows) if (r.attributes.SUBDIVISION_NAME) subByAcct.set(tidy(r.attributes.ACCOUNT_NO), tidy(r.attributes.SUBDIVISION_NAME));
    }
  }
  for (const d of doors) {
    const rec = {};
    const lot = doorLot.get(d);
    if (county === 'teller' && lot && tidy(lot.attributes.subName)) rec.sub = tidy(lot.attributes.subName);
    if (county === 'douglas' && lot) { const s = subByAcct.get(tidy(lot.attributes.account)); if (s) rec.sub = s; }
    if (county === 'elpaso') { const m = metro.find((f) => inRings(d.lo, d.la, f.geometry.rings)); if (m) rec.metro = tidy(m.attributes.NAME); }
    let best = null, bd = Infinity;
    for (const s of fw) { if (Math.abs(s.y - d.la) > 0.01 || Math.abs(s.x - d.lo) > 0.013) continue; const m = metres(d.lo, d.la, s.x, s.y); if (m < bd) { bd = m; best = s; } }
    if (best && bd <= FW_RADIUS) { rec.fw = best.name; rec.fwd = Math.round(bd); fwHits++; }
    if (rec.sub || rec.metro) named++;
    if (Object.keys(rec).length) cache[`${d.la},${d.lo}`] = rec;
  }
  console.log(`${town.padEnd(14)} ${doors.length} doors · ${named} named (${Math.round(named / doors.length * 100)}%) · ${fwHits} near a Firewise site`);
}
writeFileSync(OUT, JSON.stringify(cache));
console.log(`wrote ${Object.keys(cache).length} records -> hoa-cache.json`);
