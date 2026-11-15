#!/usr/bin/env node
/* TR-36 counties (Matthew, 15 Nov 2026: "We have permission for these counties"; EVERY-HOME-2026-11-15.md). None of them is on the state
   parcel layer with a property address, so each county's own public layer is read and written in pull-state-vm.mjs's row format
   (state/<county>.tsv.gz), and classify-vm.mjs treats them like every other county. Cloud machine; the rows hold owner names (VM only).
   Never read: Cheyenne's PHONE and EMAILADDRESS columns.
     cheyenne  CheyenneCO_Parcels (Cheyenne County, services6.arcgis.com/vhybbSS0snCEf2Qb): property + mailing address, owner, use
     phillips  PhillipsCountyParcels (Phillips County, services5.arcgis.com/UWXeShqi0BLIyN15): property + mailing address, owner, class
     chaffee   CHAFFEE_PARCELS_20250603 (Salida GIS for Chaffee County, services8.arcgis.com/fRzYA77NIM7odeAM): address, owner, mailing
     moffat    MC_Parcels (Moffat County GIS, services.arcgis.com/nG7uHX1mi3PRD2sK): address, owner, mailing; a confidential owner is left out
     fremont   FC Parcels + FC Addresses (Fremont County GIS Authority, AUT_AGOL_BASEMAP_DATA_Public, services7.arcgis.com/VQTb2SZvc9e8FiRH):
               address + owner, NO mailing address (occupancy "not known"); land use from the address points, joined on the site address
     otero     City of La Junta's parcels (lajunta_gis, services6.arcgis.com/1XjIDBVnDQpTiqmr): the city only. Otero County's own data is
               not published (viewer only), so the rest of the county needs a request or agreement and is not read
   Usage (VM): node tr36-pull-vm.mjs <state dir> [--only=cheyenne,phillips]                                                          */
import { createWriteStream, writeFileSync, mkdirSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { join } from 'node:path';

const OUT = process.argv[2]; if (!OUT) { console.error('usage: node tr36-pull-vm.mjs <state dir>'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const only = ((process.argv.find((a) => a.startsWith('--only=')) || '').slice(7)).split(',').filter(Boolean);
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; Traverse county parcels)' };
async function getJSON(url, params, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { ...UA, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 200)); return j;
    } catch (e) { if (i === tries - 1) throw e; await new Promise((res) => setTimeout(res, 3000 * (i + 1))); }
  }
}
async function* rows(layer, fields, geom = true) {
  for (let off = 0; ; off += 2000) {
    const j = await getJSON(`${layer}/query`, { where: '1=1', outFields: fields, returnGeometry: geom ? 'true' : 'false', outSR: '4326', geometryPrecision: '6', orderByFields: 'OBJECTID', resultOffset: String(off), resultRecordCount: '2000', f: 'json' })
      .catch(async () => getJSON(`${layer}/query`, { where: '1=1', outFields: fields, returnGeometry: geom ? 'true' : 'false', outSR: '4326', geometryPrecision: '6', orderByFields: 'FID', resultOffset: String(off), resultRecordCount: '2000', f: 'json' }));
    const fs = j.features || []; for (const f of fs) yield f;
    if (fs.length < 2000 && !j.exceededTransferLimit) break;
  }
}
const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
const zip5 = (z) => String(z || '').replace(/\D/g, '').slice(0, 5);
const ORG = /\b(LLC|INC|CORP|CORPORATION|COMPANY|LP|LLP|LTD|CHURCH|DISTRICT|METROPOLITAN|ASSOCIATION|ASSN|HOA|TOWN OF|CITY OF|COUNTY|STATE OF|UNITED STATES|SCHOOL|ACADEMY|MINISTR\w*|PARTNERS|PARTNERSHIP|HOLDINGS|PROPERTIES|DEVELOPMENT|INVESTMENTS|BANK|MOTEL|HOTEL|STORAGE|VILLAGE|SANITATION|WATER|UTILIT\w*|CEMETERY|FOUNDATION|HOUSING AUTHORITY)\b/i;
function areaAc(rings) { let t = 0; for (const ring of rings) { const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * Math.PI / 180, kx = 6378137 * Math.cos(lat0) * Math.PI / 180, ky = 6378137 * Math.PI / 180; let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * kx * (ring[i][1] * ky) - ring[i][0] * kx * (ring[j][1] * ky); t += Math.abs(a / 2); } return t / 4046.8564; }
const join_ = (...p) => p.map(clean).filter(Boolean).join(' ');
const HEAD = 'oid\tparcel\tuse\tacres\tasrc\tsitus\tcity\tzip\tocc\torg\tlat\tlon\tluc\tsub\trecv\towner\tmail\n';
async function write(slug, gen) {
  const gz = createGzip(); const ws = createWriteStream(join(OUT, `${slug}.tsv.gz`)); gz.pipe(ws); gz.write(HEAD); let n = 0;
  for await (const r of gen) {
    const ring = r.geom?.rings?.[0]; if (!ring) continue;
    const lon = (ring.reduce((s, p) => s + p[0], 0) / ring.length).toFixed(6), lat = (ring.reduce((s, p) => s + p[1], 0) / ring.length).toFixed(6);
    let acres = +r.acres, asrc = 'f'; if (!(acres > 0)) { acres = areaAc(r.geom.rings); asrc = 's'; }
    const mail = [clean(r.mstreet), clean(r.mcity), clean(r.mstate), zip5(r.mzip)].filter(Boolean).join(', ');
    /* occ: 'A' when there is a mailing line, else 'N'; classify-vm.mjs works out Y / L / P from the mailing line (occAgain) */
    gz.write([r.oid, clean(r.parcel), clean(r.use), acres.toFixed(3), asrc, clean(r.situs), clean(r.city), zip5(r.zip), r.mstreet ? 'A' : 'N', ORG.test(r.owner || '') ? 1 : 0, lat, lon, '', clean(r.sub), '', clean(r.owner), mail].join('\t') + '\n'); n++;
  }
  await new Promise((res) => { ws.on('finish', res); gz.end(); });
  writeFileSync(join(OUT, `${slug}.done`), `${n}\n`); console.log(`${slug}: ${n} parcels`);
}
const C = {
  cheyenne: () => (async function* () { for await (const f of rows('https://services6.arcgis.com/vhybbSS0snCEf2Qb/arcgis/rest/services/CheyenneCO_Parcels/FeatureServer/0',
    'OBJECTID,PARCELNO,PRIMARYUSEDESCRIPTION,LANDGROSSACRECOUNT,ADDRESS,CITY,ZIPCODE,NAME1,NAME2,MAILADDRESS1,MAILADDRESS2,MAILCITY,MAILSTATE,MAILZIPCODE,SUBDIVISIONNAME')) { const a = f.attributes;
    yield { oid: a.OBJECTID, parcel: a.PARCELNO, use: a.PRIMARYUSEDESCRIPTION, acres: a.LANDGROSSACRECOUNT, situs: a.ADDRESS, city: a.CITY, zip: a.ZIPCODE, owner: join_(a.NAME1, a.NAME2 ? '/ ' + a.NAME2 : ''), mstreet: join_(a.MAILADDRESS1, a.MAILADDRESS2), mcity: a.MAILCITY, mstate: a.MAILSTATE, mzip: a.MAILZIPCODE, sub: a.SUBDIVISIONNAME, geom: f.geometry }; } })(),
  phillips: () => (async function* () { for await (const f of rows('https://services5.arcgis.com/UWXeShqi0BLIyN15/arcgis/rest/services/PhillipsCountyParcels/FeatureServer/0',
    'OBJECTID,PIN,CLASSCD1_DESC,ACRES,STREETNO,DIRECTION,STREETNAME,SUFFIX,DIRECTIONSUFFIX,UNITNUMBER,LOCCITY,ZIPCODE_1,NAME,ADDRESS1,ADDRESS2,CITY,STATE,ZIPCODE,SUBNAME,CONDONAME')) { const a = f.attributes;
    const situs = +a.STREETNO > 0 ? join_(a.STREETNO, a.DIRECTION, a.STREETNAME, a.SUFFIX, a.DIRECTIONSUFFIX, a.UNITNUMBER ? '# ' + a.UNITNUMBER : '') : '';
    yield { oid: a.OBJECTID, parcel: a.PIN, use: a.CLASSCD1_DESC, acres: a.ACRES, situs, city: a.LOCCITY, zip: a.ZIPCODE_1, owner: a.NAME, mstreet: join_(a.ADDRESS1, a.ADDRESS2), mcity: a.CITY, mstate: a.STATE, mzip: a.ZIPCODE, sub: a.CONDONAME || a.SUBNAME, geom: f.geometry }; } })(),
  chaffee: () => (async function* () { for await (const f of rows('https://services8.arcgis.com/fRzYA77NIM7odeAM/arcgis/rest/services/CHAFFEE_PARCELS_20250603/FeatureServer/0',
    'FID,PARCEL,ACCT_TYPE,GIS_Acres,ADDRESS,PROPERTYCI,NAME1,NAME2,ADDRESS1,ADDRESS2,CITY,STATECODE,ZIPCODE,SUB')) { const a = f.attributes;
    yield { oid: a.FID, parcel: a.PARCEL, use: /RESID/i.test(a.ACCT_TYPE || '') ? '' : a.ACCT_TYPE, acres: a.GIS_Acres, situs: /^\d/.test(clean(a.ADDRESS)) ? a.ADDRESS : '', city: a.PROPERTYCI, zip: '', owner: join_(a.NAME1, a.NAME2 ? '/ ' + a.NAME2 : ''), mstreet: join_(a.ADDRESS1, a.ADDRESS2), mcity: a.CITY, mstate: a.STATECODE, mzip: a.ZIPCODE, sub: a.SUB, geom: f.geometry }; } })(),
  moffat: () => (async function* () { for await (const f of rows('https://services.arcgis.com/nG7uHX1mi3PRD2sK/arcgis/rest/services/MC_Parcels/FeatureServer/0',
    'FID,Pin_,Confidenti,GIS_ACRES,SiteAddres,SITECITY,SITEZIP,OWNERNAME,OWNERADDRE,OWNERCITY,OWNERSTATE,OWNERZIP')) { const a = f.attributes; const conf = /^(Y|YES|1|TRUE|T)$/i.test(String(a.Confidenti ?? '').trim());
    yield { oid: a.FID, parcel: a.Pin_, use: '', acres: a.GIS_ACRES, situs: a.SiteAddres, city: a.SITECITY, zip: a.SITEZIP, owner: conf ? '' : a.OWNERNAME, mstreet: conf ? '' : a.OWNERADDRE, mcity: conf ? '' : a.OWNERCITY, mstate: conf ? '' : a.OWNERSTATE, mzip: conf ? '' : a.OWNERZIP, sub: '', geom: f.geometry }; } })(),
  fremont: () => (async function* () {
    const S = 'https://services7.arcgis.com/VQTb2SZvc9e8FiRH/arcgis/rest/services/AUT_AGOL_BASEMAP_DATA_Public/FeatureServer';
    const use = new Map(); const key = (s) => clean(s).toUpperCase();
    for await (const f of rows(`${S}/1082516551`, 'OBJECTID,GL_ADR_FUL,asr_SITE_ADDR,asr_LUSE_DESC,asr_LUSE_TYPE,clc_RES_YN,edt_MHPARK_YN', false)) { const a = f.attributes;
      const u = /^Y/i.test(a.edt_MHPARK_YN || '') ? 'MOBILE HOME PARK' : (a.asr_LUSE_DESC || a.asr_LUSE_TYPE || (/^N/i.test(a.clc_RES_YN || '') ? 'COMMERCIAL' : ''));
      for (const k of [key(a.GL_ADR_FUL), key(a.asr_SITE_ADDR)]) if (k && !use.has(k)) use.set(k, u); }
    console.log(`fremont: land use for ${use.size} addresses`);
    for await (const f of rows(`${S}/1082516568`, 'OBJECTID,PARCELNUMBER,SITE_ADDR,GL_ADR_FUL,PO_NAME,PO_ZIP,OWNER_NAME,AUT_ACRES,SUBDESC')) { const a = f.attributes; const s = clean(a.GL_ADR_FUL || a.SITE_ADDR);
      yield { oid: a.OBJECTID, parcel: a.PARCELNUMBER, use: use.get(key(a.GL_ADR_FUL)) ?? use.get(key(a.SITE_ADDR)) ?? '', acres: a.AUT_ACRES, situs: /^\d/.test(s) ? s : '', city: a.PO_NAME, zip: a.PO_ZIP, owner: a.OWNER_NAME, mstreet: '', mcity: '', mstate: '', mzip: '', sub: a.SUBDESC, geom: f.geometry }; } })(),
  otero: () => (async function* () { for await (const f of rows('https://services6.arcgis.com/1XjIDBVnDQpTiqmr/arcgis/rest/services/Parcels/FeatureServer/1',
    'FID,PARCELID,PRCLADRS,NAME1,NAME2,ADRS1,ADRS2,CITY,ST,ZIPCODE,GISEXEMP')) { const a = f.attributes;
    yield { oid: a.FID, parcel: a.PARCELID, use: /^Y|EXEMPT/i.test(String(a.GISEXEMP || '')) ? 'EXEMPT' : '', acres: 0, situs: /^\d/.test(clean(a.PRCLADRS)) ? a.PRCLADRS : '', city: 'LA JUNTA', zip: '81050', owner: join_(a.NAME1, a.NAME2 ? '/ ' + a.NAME2 : ''), mstreet: join_(a.ADRS1, a.ADRS2), mcity: a.CITY, mstate: a.ST, mzip: a.ZIPCODE, sub: '', geom: f.geometry }; } })(),
};
for (const [slug, gen] of Object.entries(C)) { if (only.length && !only.includes(slug)) continue; await write(slug, gen()); }
console.log('tr36 pull: done');
