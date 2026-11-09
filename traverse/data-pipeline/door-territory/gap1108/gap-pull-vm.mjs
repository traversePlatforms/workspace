#!/usr/bin/env node
/* Gap plan 2026-11-08, step 1 (cloud machine only: a parcel-heavy pull of the whole state parcel layer, ~2.6M rows, ~1,300 pages).
   For every county on Colorado_Public_Parcels, writes out/<county>.tsv.gz with one line per parcel and NO owner names:
     oid  parcel  use  acres  asrc  situs  city  zip  occ  org  lat  lon
   use    landUseDsc as the county gives it
   acres  landAcres, else the parcel shape's planar area (asrc 's'), exactly as build-walklist-co.mjs works it out
   occ    Y owner lives here (build-walklist-co.mjs's test: same house number + street) · P PO box elsewhere · L PO box in the house's
          own town or ZIP (Group 3 stage B rule) · A owner mails elsewhere · N no mailing address on record
   org    1 when the owner name reads as an organisation (the walk-list PDF's NON_RESIDENTIAL test; family trusts kept)
   lat/lon  the mean of the first ring's points, the builders' own door point, so a door sits on the same spot
   Resumable: a county with out/<county>.done is skipped. Pages go one at a time, by OBJECTID (no offsets), 6 tries each.
   Usage (on the VM): node gap-pull-vm.mjs <outdir> [--counties=Denver,Jefferson]                                            */
import { createWriteStream, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { join } from 'node:path';

const LAYER = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; Traverse coverage count)' };
const OUT = process.argv[2];
if (!OUT || OUT.startsWith('--')) { console.error('usage: node gap-pull-vm.mjs <outdir> [--counties=A,B]'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };

async function getJSON(params, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(LAYER, { method: 'POST', headers: { ...UA, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 160));
      return j;
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
    }
  }
}

/* the counties, from the layer itself */
let counties = (arg('counties', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!counties.length) {
  const j = await getJSON({ where: '1=1', outStatistics: JSON.stringify([{ statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'n' }]), groupByFieldsForStatistics: 'countyName', f: 'json' });
  const list = j.features.map((f) => f.attributes).filter((a) => a.countyName).sort((a, b) => a.n - b.n);
  writeFileSync(join(OUT, 'counties.json'), JSON.stringify(list));
  counties = list.map((a) => a.countyName);
}

const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\b(ROAD|RD|STREET|ST|AVENUE|AVE|DRIVE|DR|LANE|LN|COURT|CT|CIRCLE|CIR|PLACE|PL|TRAIL|TRL|WAY|BOULEVARD|BLVD|POINT|PT|TERRACE|TER|PARKWAY|PKWY|HIGHWAY|HWY|NORTH|SOUTH|EAST|WEST|N|S|E|W)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const houseNo = (s) => (String(s || '').match(/\b(\d+)\b/) || [])[1] || '';
const ORG = /\b(LLC|INC|CORP|CORPORATION|COMPANY|LP|LLP|LTD|CHURCH|DISTRICT|METROPOLITAN|ASSOCIATION|ASSN|HOA|TOWN OF|CITY OF|COUNTY|STATE OF|UNITED STATES|SCHOOL|ACADEMY|MINISTR\w*|PARTNERS|PARTNERSHIP|HOLDINGS|PROPERTIES|DEVELOPMENT|INVESTMENTS|BANK|MOTEL|HOTEL|STORAGE|VILLAGE|SANITATION|WATER|UTILIT\w*|CEMETERY|FOUNDATION|HOUSING AUTHORITY)\b/i;
function areaM2(rings) {
  let total = 0;
  for (const ring of rings) {
    const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * Math.PI / 180;
    const R = 6378137, kx = R * Math.cos(lat0) * Math.PI / 180, ky = R * Math.PI / 180;
    let ar = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) ar += ring[j][0] * kx * (ring[i][1] * ky) - ring[i][0] * kx * (ring[j][1] * ky);
    total += Math.abs(ar / 2);
  }
  return total;
}
const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ').trim();
const zip5 = (z) => String(z || '').replace(/\D/g, '').slice(0, 5);

for (const county of counties) {
  const slug = county.toLowerCase().replace(/[^a-z]+/g, '-');
  if (existsSync(join(OUT, `${slug}.done`))) { console.log(`${county}: done before`); continue; }
  const gz = createGzip(); const ws = createWriteStream(join(OUT, `${slug}.tsv.gz`)); gz.pipe(ws);
  gz.write('oid\tparcel\tuse\tacres\tasrc\tsitus\tcity\tzip\tocc\torg\tlat\tlon\n');
  let last = 0, n = 0; const t0 = Date.now();
  for (;;) {
    const j = await getJSON({
      where: `countyName='${county.replace(/'/g, "''")}' AND OBJECTID>${last}`, orderByFields: 'OBJECTID',
      outFields: 'OBJECTID,parcel_id,landUseDsc,landAcres,situsAdd,sitAddCty,sitAddZip,owner,ownerAdd,ownAddCty,ownAddZip',
      returnGeometry: 'true', outSR: '4326', geometryPrecision: '6', resultRecordCount: '2000', f: 'json',
    });
    const fs = j.features || [];
    for (const f of fs) {
      const a = f.attributes; last = Math.max(last, a.OBJECTID);
      const rings = f.geometry?.rings;
      let lat = '', lon = '', acres = Number(a.landAcres), asrc = 'f';
      if (rings?.length) {
        const r0 = rings[0]; lon = (r0.reduce((s, p) => s + p[0], 0) / r0.length).toFixed(6); lat = (r0.reduce((s, p) => s + p[1], 0) / r0.length).toFixed(6);
        if (!(acres > 0)) { acres = areaM2(rings) / 4046.8564; asrc = 's'; }
      }
      if (!(acres > 0)) { acres = 0; asrc = '-'; }
      const situs = clean(a.situsAdd), mail = clean(a.ownerAdd);
      let occ = 'N';
      if (mail) {
        if (/\bP\s*O\s*BOX\b|\bPOBOX\b/i.test(mail)) occ = (zip5(a.ownAddZip) && zip5(a.ownAddZip) === zip5(a.sitAddZip)) || (norm(a.ownAddCty) && norm(a.ownAddCty) === norm(a.sitAddCty)) ? 'L' : 'P';
        else {
          const sameNum = houseNo(situs) && houseNo(situs) === houseNo(mail);
          const sn = norm(situs).replace(/^\d+\s*/, ''), mn = norm(mail).replace(/^\d+\s*/, '');
          occ = sameNum && sn && mn && (sn === mn || sn.startsWith(mn) || mn.startsWith(sn)) ? 'Y' : 'A';
        }
      }
      gz.write([a.OBJECTID, clean(a.parcel_id), clean(a.landUseDsc), acres.toFixed(3), asrc, situs, clean(a.sitAddCty), zip5(a.sitAddZip), occ, ORG.test(a.owner || '') ? 1 : 0, lat, lon].join('\t') + '\n');
      n++;
    }
    if (fs.length < 1 || (!j.exceededTransferLimit && fs.length < 2000)) break;
  }
  await new Promise((res) => { ws.on('finish', res); gz.end(); });
  writeFileSync(join(OUT, `${slug}.done`), `${n}\n`);
  console.log(`${county}: ${n} parcels in ${Math.round((Date.now() - t0) / 1000)} s`);
}
console.log('gap pull: every county done');
