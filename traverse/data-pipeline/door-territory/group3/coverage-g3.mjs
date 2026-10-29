/* Group 3 (2026-10-29): which counties' public data can make doors. Run ON THE CLOUD MACHINE (gis.colorado.gov refuses the laptop's
   hotspot), one county after another, small queries only. For every county in candidates.json (group3-targets.mjs):
     - the statewide parcel layer's row count for the county (0 = the county does not share parcels with the state);
     - a 1,000-row sample by OBJECTID (as build-walklist-co.mjs --coverage) and a sample inside a box around the county's biggest
       place (0.75 mi): share of rows with owner, owner mailing address, property address (situsAdd), lot size, land use, and the
       commonest land-use values (words, or a county's own codes);
     - the state's address points (Colorado_Public_Addresses) in the same box: how many parcels in the box carry an address point
       naming their parcel number (as Pueblo's adapter joins them), raw and with punctuation stripped.
   Writes coverage.json next to it and prints one line per county. Owner names are never printed or saved: only shares.
     node coverage-g3.mjs                                                                                                        */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; Sixfold walk-list builder)' };
const BASE = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/';
const PARCELS = BASE + 'Colorado_Public_Parcels/FeatureServer/0/query', ADDRESSES = BASE + 'Colorado_Public_Addresses/FeatureServer/0/query';
async function getJSON(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`HTTP ${r.status}`); const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 160)); return j; }
    catch (e) { if (i === tries - 1) throw e; await new Promise((z) => setTimeout(z, 3000 * (i + 1))); }
  }
}
const q = (u, p) => getJSON(`${u}?${new URLSearchParams({ f: 'json', ...p })}`);
const cands = JSON.parse(readFileSync(join(HERE, 'candidates.json'), 'utf8'));
const counties = [...new Set(cands.map((t) => t.county))];
const only = process.argv[2] ? process.argv[2].split(',') : null;
const FIELDS = 'parcel_id,owner,ownerAdd,situsAdd,sitAddCty,landAcres,landUseDsc';
const normId = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');
const share = (rows, fn) => rows.length ? Math.round(100 * rows.filter(fn).length / rows.length) : null;
const fieldShares = (rows) => ({ n: rows.length, owner: share(rows, (a) => (a.owner || '').trim()), ownerAdd: share(rows, (a) => (a.ownerAdd || '').trim()), situsAdd: share(rows, (a) => (a.situsAdd || '').trim()), landAcres: share(rows, (a) => a.landAcres > 0), landUse: share(rows, (a) => (a.landUseDsc || '').trim()) });
const topUses = (rows) => { const m = new Map(); for (const a of rows) { const u = (a.landUseDsc || '').trim(); if (u) m.set(u, (m.get(u) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([u, n]) => `${u} (${n})`); };
const out = {};
for (const county of counties) {
  if (only && !only.includes(county)) continue;
  const where = `countyName='${county.toUpperCase().replace(/'/g, "''")}'`;
  const r = { county };
  try {
    r.parcels = (await q(PARCELS, { where, returnCountOnly: 'true' })).count ?? 0;
    r.points = (await q(ADDRESSES, { where: `County='${county.replace(/'/g, "''")}'`, returnCountOnly: 'true' })).count ?? 0;
    if (r.parcels) {
      r.sample = fieldShares(((await q(PARCELS, { where, outFields: FIELDS, returnGeometry: 'false', resultRecordCount: '1000', orderByFields: 'OBJECTID' })).features || []).map((f) => f.attributes));
      const c = cands.filter((t) => t.county === county).sort((a, b) => (a.kind === 'rural') - (b.kind === 'rural') || b.census - a.census)[0];
      const rad = 0.75, dLat = rad / 69, dLon = rad / (69 * Math.cos(c.lat * Math.PI / 180));
      const geo = { geometry: [c.lon - dLon, c.lat - dLat, c.lon + dLon, c.lat + dLat].join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'false', resultRecordCount: '2000' };
      const box = ((await q(PARCELS, { where, outFields: FIELDS, ...geo })).features || []).map((f) => f.attributes);
      r.boxAround = c.label; r.box = fieldShares(box); r.uses = topUses(box);
      const pts = ((await q(ADDRESSES, { where: '1=1', outFields: 'ParcelID,AddrFull,Unit,County', ...geo })).features || []).map((f) => f.attributes);
      const raw = new Set(pts.map((p) => String(p.ParcelID || '').trim()).filter(Boolean)), nrm = new Set([...raw].map(normId));
      r.boxPoints = pts.length; r.pointsWithParcel = share(pts, (p) => String(p.ParcelID || '').trim());
      r.joinRaw = share(box, (a) => raw.has(String(a.parcel_id || '').trim()));
      r.joinNorm = share(box, (a) => nrm.has(normId(a.parcel_id)));
      const noSitus = box.filter((a) => !(a.situsAdd || '').trim());
      r.noSitusJoined = share(noSitus, (a) => nrm.has(normId(a.parcel_id)));
      r.idExamples = { parcel: box.slice(0, 2).map((a) => a.parcel_id), point: [...raw].slice(0, 2) };
    }
  } catch (e) { r.error = String(e.message || e).slice(0, 200); }
  out[county] = r;
  const s = r.box || {};
  console.log(`${county} | parcels ${r.parcels ?? '-'} | points ${r.points ?? '-'} | box(${r.boxAround || '-'}) n ${s.n ?? '-'} owner ${s.owner ?? '-'}% ownerAdd ${s.ownerAdd ?? '-'}% situs ${s.situsAdd ?? '-'}% acres ${s.landAcres ?? '-'}% use ${s.landUse ?? '-'}% | sample situs ${(r.sample || {}).situsAdd ?? '-'}% | pts ${r.boxPoints ?? '-'} withParcel ${r.pointsWithParcel ?? '-'}% join ${r.joinRaw ?? '-'}/${r.joinNorm ?? '-'}% noSitusJoined ${r.noSitusJoined ?? '-'}% | uses ${(r.uses || []).slice(0, 5).join('; ')}${r.error ? ' | ERROR ' + r.error : ''}`);
  writeFileSync(join(HERE, 'coverage.json'), JSON.stringify(out, null, 1));
}
