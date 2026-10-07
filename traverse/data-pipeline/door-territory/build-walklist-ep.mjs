/* El Paso door lists from the county assessor's own file (2026-10-07), for towns too big for build-walklist.mjs, which reverse
 * geocodes every parcel one request at a time (Colorado Springs is tens of thousands of them).
 *
 *   - Attributes: assessor/raw/EPC Parcel Data.txt (El Paso County Assessor's public parcel file, tab-separated, refreshed
 *     weekly): PARCEL, LOCATION (the property address), LOCATIONZIP, Acreage, IMPSTATEDESCR, OWNER1-3, MAILADR/MAILCITY/
 *     MAILSTATE/MAILZIPCODE. Read by this script only; nothing from it is printed.
 *   - Where each parcel is: the county's parcel polygons (MailingLabelParcels, PARCEL and the shape only).
 *   - Which town: --municipality="Colorado Springs" (the state's municipal layer, inside ANY piece, as build-walklist-co.mjs),
 *     and optionally --min-lon / --max-lon to take one side of a big city.
 * Same CSV columns as the other builders, so build-walklist-pdf.mjs and build-rounds-data.mjs take it unchanged.
 *   node build-walklist-ep.mjs --lat=38.86 --lon=-104.76 --radius=9 --municipality="Colorado Springs" --min-lon=-104.78 --city="COLORADO SPRINGS" --out=cs-east.csv */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const lat = +arg('lat'), lon = +arg('lon'), radius = +arg('radius', '3'), MUNI = arg('municipality', ''), CITY = arg('city', 'EL PASO COUNTY').toUpperCase();
const minAcres = +arg('min-acres', '0.12'), maxAcres = +arg('max-acres', '10'), minLon = +arg('min-lon', '-999'), maxLon = +arg('max-lon', '999');
const out = arg('out'); if (!out || !Number.isFinite(lat) || !Number.isFinite(lon)) { console.error('need --lat --lon --out'); process.exit(1); }
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; Traverse walk-list builder)' };
async function getJSON(url, tries = 4) { for (let t = 0; ; t++) { try { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } catch (e) { if (t >= tries) throw e; await new Promise((z) => setTimeout(z, 2000 * (t + 1))); } } }

/* 1. the assessor file, keyed by parcel */
const raw = readFileSync(join(HERE, 'assessor', 'raw', 'EPC Parcel Data.txt'), 'latin1').split(/\r?\n/);
const cols = raw.shift().split('\t'), C = Object.fromEntries(cols.map((c, i) => [c, i]));
const asr = new Map();
for (const l of raw) { const r = l.split('\t'); if (r.length !== cols.length) continue; asr.set(r[C.PARCEL].trim(), r); }
console.log(`assessor file: ${asr.size} parcels`);

/* 2. the town's boundary */
let pieces = null;
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
if (MUNI) {
  pieces = [];
  for (let off = 0; ; off += 1000) {
    const q = new URLSearchParams({ where: `cityname = '${MUNI.replace(/'/g, "''")}'`, outFields: 'OBJECTID', outSR: '4326', f: 'json', resultOffset: String(off), resultRecordCount: '1000' });
    const j = await getJSON(`https://services3.arcgis.com/DgjqnJA1rgO92Soi/arcgis/rest/services/Municipal_Boundary/FeatureServer/0/query?${q}`);
    for (const f of j.features || []) if (f.geometry && f.geometry.rings) { const all = f.geometry.rings.flat(); pieces.push({ rings: f.geometry.rings, bb: [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))] }); }
    if (!j.exceededTransferLimit && (j.features || []).length < 1000) break;
  }
  if (!pieces.length) { console.error(`no municipal boundary "${MUNI}"`); process.exit(1); }
  console.log(`${MUNI}: ${pieces.length} boundary pieces`);
}
/* --cdp="Security-Widefield": an unincorporated place has no municipal boundary; the Census's own (TIGERweb, Census Designated Places) */
const CDP = arg('cdp', '');
if (CDP) {
  const q = new URLSearchParams({ where: `STATE='08' AND BASENAME='${CDP.replace(/'/g, "''")}'`, outFields: 'NAME', outSR: '4326', f: 'json', returnGeometry: 'true' });
  const j = await getJSON(`https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/5/query?${q}`);
  pieces = (j.features || []).filter((f) => f.geometry && f.geometry.rings).map((f) => { const all = f.geometry.rings.flat(); return { rings: f.geometry.rings, bb: [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))] }; });
  if (!pieces.length) { console.error(`no Census place "${CDP}"`); process.exit(1); }
  console.log(`${CDP}: ${pieces.length} Census boundary piece(s)`);
}
const inMuni = (x, y) => !pieces || pieces.some((p) => x >= p.bb[0] && x <= p.bb[2] && y >= p.bb[1] && y <= p.bb[3] && (p.rings.filter((r) => inRing(x, y, r)).length % 2 === 1));

/* 3. parcel shapes in the circle's box, from the county */
const dLat = radius / 69, dLon = radius / (69 * Math.cos(lat * Math.PI / 180));
const env = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(',');
const PARCELS = 'https://gisservices.elpasoco.com/arcgis2/rest/services/Public/MailingLabelParcels/MapServer/0/query';
const shapes = [];
for (let off = 0; ; off += 1000) {
  const p = new URLSearchParams({ f: 'json', where: '1=1', geometry: env, geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'PARCEL', returnGeometry: 'true', resultOffset: String(off), resultRecordCount: '1000' });
  const r = await getJSON(`${PARCELS}?${p}`); const got = r.features || [];
  for (const f of got) if (f.geometry && f.geometry.rings && f.geometry.rings.length) shapes.push(f);
  process.stdout.write(`\r  parcel shapes: ${shapes.length}`);
  if (got.length < 1000) break;
}
console.log('');

/* 4. filter and write */
const centroid = (ring) => [ring.reduce((s, q) => s + q[0], 0) / ring.length, ring.reduce((s, q) => s + q[1], 0) / ring.length];
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\b(ROAD|RD|STREET|ST|AVENUE|AVE|DRIVE|DR|LANE|LN|COURT|CT|CIRCLE|CIR|PLACE|PL|TRAIL|TRL|WAY|BOULEVARD|BLVD|POINT|PT|TERRACE|TER|PARKWAY|PKWY|HEIGHTS|HTS|VIEW|VW|LOOP|GROVE|GRV|NORTH|SOUTH|EAST|WEST|N|S|E|W)\b/g, ' ').replace(/\s+/g, ' ').trim();
const houseNo = (s) => (String(s || '').match(/\b(\d+)\b/) || [])[1] || '';
const RES = /^(SINGLE FAMILY RESIDENTIAL|FARM\/RANCH RESIDENCE)$/;
let noAsr = 0, notRes = 0, size = 0, off = 0, side = 0, noLoc = 0; const rows = []; const seen = new Set();
for (const f of shapes) {
  const pid = String(f.attributes.PARCEL || '').trim(); if (seen.has(pid)) continue; seen.add(pid);
  const a = asr.get(pid); if (!a) { noAsr++; continue; }
  if (!RES.test(a[C.IMPSTATEDESCR].trim())) { notRes++; continue; }
  const acres = parseFloat(a[C.Acreage]); if (!(acres >= minAcres && acres <= maxAcres)) { size++; continue; }
  const [cx, cy] = centroid(f.geometry.rings[0]);
  if (cx < minLon || cx > maxLon) { side++; continue; }
  if (!inMuni(cx, cy)) { off++; continue; }
  const loc = a[C.LOCATION].trim(); if (!/^\d+\s/.test(loc)) { noLoc++; continue; }
  const mail = a[C.MAILADR].trim(), po = /\bP\s*O\s*BOX\b|\bPOBOX\b/i.test(mail);
  const lives = !po && houseNo(loc) && houseNo(loc) === houseNo(mail) && (() => { const s = norm(loc).replace(/^\d+\s*/, ''), m = norm(mail).replace(/^\d+\s*/, ''); return s && m && (s === m || s.startsWith(m) || m.startsWith(s)); })();
  const why = po ? 'owner mails to a PO box' : lives ? 'owner lives here' : `owner is in ${(a[C.MAILCITY] || a[C.MAILSTATE] || 'another area').trim()}`;
  const m = loc.match(/^(\d+)\s+(.*)$/);
  rows.push({ knock: lives, num: m[1], street: m[2], zip: String(a[C.LOCATIONZIP] || '').replace(/\D/g, '').slice(0, 5), acres,
    owner: [a[C.OWNER1], a[C.OWNER2], a[C.OWNER3]].map((x) => (x || '').trim()).filter(Boolean).join(' / '),
    mail: [mail, a[C.MAILCITY], a[C.MAILSTATE], a[C.MAILZIPCODE]].map((x) => (x || '').trim()).filter(Boolean).join(', '), why, parcel: pid, lat: cy, lon: cx });
}
rows.sort((x, y) => x.street.localeCompare(y.street) || (+x.num - +y.num));
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = ['knock,address,city,zip,acres,owner,owner_mailing,why,parcel,lat,lon',
  ...rows.map((r) => [r.knock ? 'YES' : 'no — post', `${r.num} ${r.street}`, CITY, r.zip, r.acres.toFixed(2), r.owner, r.mail, r.why, r.parcel, r.lat.toFixed(6), r.lon.toFixed(6)].map(esc).join(','))];
writeFileSync(join(HERE, out), csv.join('\n') + '\n');
const knock = rows.filter((r) => r.knock).length;
console.log(`  dropped: ${noAsr} not in the assessor file · ${notRes} not a house · ${size} outside ${minAcres}-${maxAcres} acres · ${side} on the other side · ${off} outside the town · ${noLoc} no property address`);
console.log(`  doors to knock ${knock} · post instead ${rows.length - knock} · written ${out}`);
