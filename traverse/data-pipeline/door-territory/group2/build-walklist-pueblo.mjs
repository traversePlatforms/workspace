/* Group 2 (2026-10-28) — walk lists for Pueblo County. Sibling to build-walklist-co.mjs: same CSV out, same arguments.

   ---- WHY PUEBLO NEEDS ITS OWN SCRIPT --------------------------------------
   The statewide parcel layer (Colorado_Public_Parcels) has Pueblo's owners but not the property address or a usable land use.
   Measured 2026-10-28 (--coverage=PUEBLO, 1,000 parcels): owner 100%, ownerAdd 100%, situsAdd 0%, landAcres 0%; landUseDsc is
   filled but with Pueblo's own short codes ("60B", "70E", "70L" ...), not words, so the residential test cannot read it.
   The City of Pueblo's address services (gisdata.pueblo.us City_Address_Points, Pueblo_Address_Points) answer "Token Required".

   ---- WHERE THE PROPERTY ADDRESS COMES FROM --------------------------------
   The state's own address-point layer, from the same OIT team and the same server as the parcel layer we already use:
     https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Addresses/FeatureServer/0
   Pueblo: 87,295 points, every one marked sharing "Public", updated 2026, and all but 27 carry ParcelID, which matches the
   parcel layer's parcel_id (checked on a sample: 524437002 -> 2121 WEST ST, 524300006 -> 2118 BLAKE ST). So the parcel's
   property address is the address point that names it. No geocoding, nothing guessed.

   ---- THE FILTERS, IN PLACE OF LAND USE -----------------------------------
   - exactly one address on the parcel and no unit number: a parcel with "APT 308" or several addresses is apartments, a duplex
     or a business, not a single door (11,815 Pueblo points carry a unit);
   - no address point at all: vacant land (most of Colorado City's paper lots) — dropped as "no property address";
   - lot size from the parcel's own shape (landAcres is empty), the same band as the other counties (0 to 10 acres here);
   - owner names that are plainly an organisation (LLC, INC, CHURCH, CITY OF, SCHOOL DISTRICT, HOUSING AUTHORITY ...) are dropped,
     standing in for the missing land use. A family trust is a person and is kept.
   Then the same owner-lives-here test as build-walklist-co.mjs (house number and street of the address point against the owner's
   mailing address). Rows where the owner lives elsewhere stay in the CSV as "no — post", as in every other county.

   Run (as group2/run-group2.sh does):
     node build-walklist-pueblo.mjs --lat=38.28 --lon=-104.61 --radius=1 --min-acres=0 --pieces=pieces-g2-blende.json --out=x.csv */

import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; Sixfold walk-list builder)' };
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const ADDRESSES = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Addresses/FeatureServer/0/query';

const arg = (k, d) => { const hit = process.argv.find((a) => a.startsWith(`--${k}=`)); return hit ? hit.split('=').slice(1).join('=') : d; };
async function getJSON(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 160));
      return j;
    } catch (e) { if (i === tries - 1) throw e; await new Promise((r) => setTimeout(r, 800 * (i + 1))); }
  }
}

const lat = Number(arg('lat')), lon = Number(arg('lon'));
if (!Number.isFinite(lat) || !Number.isFinite(lon)) { console.error('need --lat= and --lon='); process.exit(1); }
const radiusMi = Number(arg('radius', '1.5'));
const minAcres = Number(arg('min-acres', '0.18'));
const maxAcres = Number(arg('max-acres', '10'));   /* the same ceiling as build-walklist-co.mjs; read its note before lowering it */
const outFile = arg('out', 'walklist-pueblo.csv');
const PIECES = arg('pieces', '');
const pieces = PIECES ? JSON.parse(readFileSync(join(HERE, PIECES), 'utf8')) : null;
const inRingXY = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const inPieces = (x, y) => pieces.some((p) => x >= p.bb[0] && x <= p.bb[2] && y >= p.bb[1] && y <= p.bb[3] && (p.rings.filter((r) => inRingXY(x, y, r)).length % 2 === 1));

const dLat = radiusMi / 69, dLon = radiusMi / (69 * Math.cos(lat * Math.PI / 180));
const envelope = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(',');
console.log(`\nPUEBLO county — centre ${lat.toFixed(5)}, ${lon.toFixed(5)}, radius ${radiusMi} mi${PIECES ? ', inside ' + PIECES : ''}`);
console.log(`lot filter ${minAcres}–${maxAcres} acres\n`);

async function pull(url, where, outFields, geometry, page) {
  const out = [];
  for (let offset = 0; ; offset += page) {
    const p = new URLSearchParams({ f: 'json', where, geometry: envelope, geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', outFields, returnGeometry: String(geometry), orderByFields: 'OBJECTID', resultOffset: String(offset), resultRecordCount: String(page) });
    const got = (await getJSON(`${url}?${p}`)).features ?? [];
    out.push(...got);
    if (got.length < page) break;
  }
  return out;
}
const feats = await pull(PARCELS, "countyName='PUEBLO'", 'owner,owner2,ownerAdd,ownAddCty,ownAddStt,ownAddZip,parcel_id', true, 1000);
console.log(`  parcels pulled: ${feats.length}`);
const pts = await pull(ADDRESSES, "County='Pueblo'", 'ParcelID,AddrFull,Unit,PlaceName,Zipcode', false, 2000);
console.log(`  address points pulled: ${pts.length}`);

/* address points by parcel */
const byParcel = new Map();
for (const f of pts) {
  const a = f.attributes, id = String(a.ParcelID || '').trim(); if (!id) continue;
  (byParcel.get(id) || byParcel.set(id, []).get(id)).push(a);
}

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
const centroid = (ring) => [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
const ORG = /\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|COMPANY|LTD|LP|LLP|PARTNERSHIP|BANK|CREDIT UNION|CHURCH|PARISH|DIOCESE|MINISTRIES|CONGREGATION|SCHOOL|DISTRICT|CITY OF|TOWN OF|COUNTY|STATE OF|UNITED STATES|HOUSING|AUTHORITY|ASSOCIATION|ASSN|HOA|HOMEOWNERS|CONDOMINIUM|APARTMENTS|PROPERTIES|INVESTMENTS|HOLDINGS|REALTY|RENTALS|ENTERPRISES|DEVELOPMENT|BUILDERS|HOMES|RAILROAD|RAILWAY|UTILITIES|CEMETERY|FOUNDATION|HOSPITAL)\b/i;

let outside = 0, wrongSize = 0, noSitus = 0, multi = 0, org = 0, dup = 0;
const kept = [], seenParcel = new Set();
for (const f of feats) {
  const a = f.attributes;
  if (!f.geometry?.rings?.length) continue;
  const id = String(a.parcel_id || '').trim();
  if (seenParcel.has(id)) { dup++; continue; } seenParcel.add(id);
  const c = centroid(f.geometry.rings[0]);
  if (pieces && !inPieces(c[0], c[1])) { outside++; continue; }
  const acres = areaM2(f.geometry.rings) / 4046.8564;
  if (!(acres > 0) || acres < minAcres || acres > maxAcres) { wrongSize++; continue; }
  const here = byParcel.get(id) || [];
  if (!here.length) { noSitus++; continue; }
  const addrs = new Set(here.map((p) => (p.AddrFull || '').trim().toUpperCase()));
  if (addrs.size > 1 || here.some((p) => (p.Unit || '').trim())) { multi++; continue; }
  const owner = [a.owner, a.owner2].filter(Boolean).join(' / ').trim();
  if (ORG.test(owner)) { org++; continue; }
  kept.push({ a, acres, c, pt: here[0], owner });
}
console.log(`  inside the area, in size band, one address: ${kept.length}`);
console.log(`  dropped: ${outside} outside the area · ${wrongSize} outside the lot band · ${noSitus} with no address point (vacant land) · ${multi} with several addresses or a unit · ${org} owned by an organisation${dup ? ' · ' + dup + ' repeated parcel rows' : ''}`);

/* ---- does the owner live there? (the same test as build-walklist-co.mjs) */
const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\b(ROAD|RD|STREET|ST|AVENUE|AVE|DRIVE|DR|LANE|LN|COURT|CT|CIRCLE|CIR|PLACE|PL|TRAIL|TRL|WAY|BOULEVARD|BLVD|POINT|PT|TERRACE|TER|PARKWAY|PKWY|HIGHWAY|HWY|NORTH|SOUTH|EAST|WEST|N|S|E|W)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const houseNo = (s) => (String(s || '').match(/\b(\d+)\b/) || [])[1] || '';
const rows = [];
for (const k of kept) {
  const a = k.a, situs = (k.pt.AddrFull || '').trim(), mail = (a.ownerAdd || '').trim(), city = (k.pt.PlaceName || '').trim() || 'PUEBLO COUNTY';
  const isPOBox = /\bP\s*O\s*BOX\b|\bPOBOX\b/i.test(mail);
  let occupied = false, why = '';
  if (isPOBox) why = 'owner mails to a PO box';
  else {
    const sameNum = houseNo(situs) && houseNo(situs) === houseNo(mail);
    const sn = norm(situs).replace(/^\d+\s*/, ''), mn = norm(mail).replace(/^\d+\s*/, '');
    const sameStreet = sn && mn && (sn === mn || sn.startsWith(mn) || mn.startsWith(sn));
    occupied = Boolean(sameNum && sameStreet);
    why = occupied ? 'owner lives here' : norm(a.ownAddCty) === norm(city) ? 'owner is local but lives elsewhere' : `owner is in ${(a.ownAddCty || a.ownAddStt || 'another area').trim()}`;
  }
  const m = situs.match(/^\s*(\d+)\s+(.*)$/);
  rows.push({ knock: occupied, num: m ? m[1] : '', street: m ? m[2].trim() : situs, city, zip: String(k.pt.Zipcode || '').replace(/\D/g, '').slice(0, 5),
    acres: k.acres, owner: k.owner, mail: [mail, a.ownAddCty, a.ownAddStt, a.ownAddZip].filter(Boolean).join(', '), why, parcel: a.parcel_id ?? '', lat: k.c[1], lon: k.c[0] });
}
rows.sort((x, y) => { const s = (x.street || 'ZZZ').localeCompare(y.street || 'ZZZ'); return s !== 0 ? s : (Number(x.num) || 0) - (Number(y.num) || 0); });

const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = [
  ['knock', 'address', 'city', 'zip', 'acres', 'owner', 'owner_mailing', 'why', 'parcel', 'lat', 'lon'].join(','),
  ...rows.map((r) => [r.knock ? 'YES' : 'no — post', `${r.num} ${r.street}`.trim(), r.city, r.zip, r.acres.toFixed(2), r.owner, r.mail, r.why, r.parcel, r.lat.toFixed(6), r.lon.toFixed(6)].map(esc).join(',')),
].join('\n');
writeFileSync(join(HERE, outFile), csv, 'utf8');
const knock = rows.filter((r) => r.knock);
console.log(`\n  doors to knock ${knock.length} · post instead ${rows.length - knock.length} · written: ${outFile}`);
