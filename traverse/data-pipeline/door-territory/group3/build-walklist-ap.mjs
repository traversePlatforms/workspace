/* Group 3 (2026-10-29) — walk lists for any county whose rows on the statewide parcel layer lack the property address. The Pueblo
   adapter (group2/build-walklist-pueblo.mjs) made general: same CSV out, same arguments plus --county.

   The statewide parcel layer (Colorado_Public_Parcels) gives the owner and the owner's mailing address. Where it has no property
   address (situsAdd), the address comes from the state's own address-point layer on the same server:
     https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Addresses/FeatureServer/0
   joined by parcel number (ParcelID = parcel_id; compared with punctuation and leading zeros stripped, because a county can write
   "R012345" in one layer and "R-012345" in the other). group3/coverage-g3.mjs measured the join for each county before use.

   Per parcel:
   - address points on it: exactly one address and no unit number, or it is dropped (apartments, duplexes, businesses);
   - no address point but a property address on the parcel row: that address is used (the same as build-walklist-co.mjs);
   - neither: vacant land, dropped;
   - lot size from landAcres, or from the parcel's own shape when that is empty; 0 to 10 acres as elsewhere;
   - land use: dropped when it reads as non-residential in words (the same list as build-walklist-co.mjs); a county's own codes
     cannot be read and pass;
   - owners that are plainly an organisation (LLC, INC, CHURCH, CITY OF, SCHOOL DISTRICT ...) are dropped, as in Pueblo. A family
     trust is a person and is kept.
   Then the same owner-lives-here test as build-walklist-co.mjs. Rows where the owner lives elsewhere stay as "no — post".

   Run (as group3/run-group3.sh does):
     node build-walklist-ap.mjs --county="Rio Grande" --lat=37.68 --lon=-106.35 --radius=1 --min-acres=0 --pieces=pieces-x.json --out=x.csv */

import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; Sixfold walk-list builder)' };
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const ADDRESSES = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Addresses/FeatureServer/0/query';

const arg = (k, d) => { const hit = process.argv.find((a) => a.startsWith(`--${k}=`)); return hit ? hit.split('=').slice(1).join('=') : d; };
async function getJSON(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 160));
      return j;
    } catch (e) { if (i === tries - 1) throw e; await new Promise((r) => setTimeout(r, 3000 * (i + 1))); }
  }
}

const COUNTY = (arg('county', '') || '').trim();
const lat = Number(arg('lat')), lon = Number(arg('lon'));
if (!COUNTY || !Number.isFinite(lat) || !Number.isFinite(lon)) { console.error('need --county=, --lat= and --lon='); process.exit(1); }
const countyTitle = COUNTY.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const radiusMi = Number(arg('radius', '1.5'));
const minAcres = Number(arg('min-acres', '0.18'));
const maxAcres = Number(arg('max-acres', '10'));   /* the same ceiling as build-walklist-co.mjs; read its note before lowering it */
const outFile = arg('out', `walklist-${COUNTY.toLowerCase().replace(/\W+/g, '-')}.csv`);
const PIECES = arg('pieces', '');
const pieces = PIECES ? JSON.parse(readFileSync(join(HERE, PIECES), 'utf8')) : null;
const inRingXY = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const inPieces = (x, y) => pieces.some((p) => x >= p.bb[0] && x <= p.bb[2] && y >= p.bb[1] && y <= p.bb[3] && (p.rings.filter((r) => inRingXY(x, y, r)).length % 2 === 1));

const dLat = radiusMi / 69, dLon = radiusMi / (69 * Math.cos(lat * Math.PI / 180));
const envelope = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(',');
console.log(`\n${COUNTY.toUpperCase()} county — centre ${lat.toFixed(5)}, ${lon.toFixed(5)}, radius ${radiusMi} mi${PIECES ? ', inside ' + PIECES : ''}`);
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
const q1 = (s) => s.replace(/'/g, "''");
const feats = await pull(PARCELS, `countyName='${q1(COUNTY.toUpperCase())}'`, 'owner,owner2,ownerAdd,ownAddCty,ownAddStt,ownAddZip,situsAdd,sitAddCty,sitAddZip,landAcres,landUseDsc,parcel_id', true, 1000);
console.log(`  parcels pulled: ${feats.length}`);
const pts = await pull(ADDRESSES, `County='${q1(countyTitle)}' OR County IS NULL OR County=''`, 'ParcelID,AddrFull,Unit,PlaceName,Zipcode', false, 2000);
console.log(`  address points pulled: ${pts.length}`);

const normId = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');
const byParcel = new Map();
for (const f of pts) {
  const a = f.attributes, id = normId(a.ParcelID); if (!id) continue;
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
const NOT_RESIDENTIAL = /EXEMPT|COMMERCIAL|INDUSTRIAL|AGRICULT|VACANT|MINING|UTILIT|CHURCH|SCHOOL|GOVERNMENT|CONDO|APARTMENT|MOBILE/i;
const ORG = /\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|COMPANY|LTD|LP|LLP|PARTNERSHIP|BANK|CREDIT UNION|CHURCH|PARISH|DIOCESE|MINISTRIES|CONGREGATION|SCHOOL|DISTRICT|CITY OF|TOWN OF|COUNTY|STATE OF|UNITED STATES|HOUSING|AUTHORITY|ASSOCIATION|ASSN|HOA|HOMEOWNERS|CONDOMINIUM|APARTMENTS|PROPERTIES|INVESTMENTS|HOLDINGS|REALTY|RENTALS|ENTERPRISES|DEVELOPMENT|BUILDERS|HOMES|RAILROAD|RAILWAY|UTILITIES|CEMETERY|FOUNDATION|HOSPITAL)\b/i;

/* Eagle (29 Oct smoke test) writes one placeholder in place of every owner name (the same 27 characters on every row, and it holds
   the word COUNTY, so the organisation test dropped every house). The mailing addresses are real. When one owner value covers over
   half the parcels pulled, it is a placeholder: the owner is left blank and the organisation test is skipped. */
const ownerFreq = new Map(); for (const f of feats) { const o = (f.attributes.owner || '').trim(); ownerFreq.set(o, (ownerFreq.get(o) || 0) + 1); }
const [topOwner, topN] = [...ownerFreq].sort((a, b) => b[1] - a[1])[0] || ['', 0];
const PLACEHOLDER = feats.length >= 50 && topOwner && topN > feats.length / 2 ? topOwner : null;
if (PLACEHOLDER) console.log(`  owner names withheld by the county (one placeholder on ${topN} of ${feats.length} parcels): owner left blank, organisation test skipped`);
let outside = 0, wrongSize = 0, notRes = 0, noSitus = 0, multi = 0, org = 0, dup = 0, fromPoint = 0, fromRow = 0;
const kept = [], seenParcel = new Set();
for (const f of feats) {
  const a = f.attributes;
  if (!f.geometry?.rings?.length) continue;
  const id = normId(a.parcel_id);
  if (id && seenParcel.has(id)) { dup++; continue; } if (id) seenParcel.add(id);
  const c = centroid(f.geometry.rings[0]);
  if (pieces && !inPieces(c[0], c[1])) { outside++; continue; }
  let acres = Number(a.landAcres); if (!(acres > 0)) acres = areaM2(f.geometry.rings) / 4046.8564;
  if (!(acres > 0) || acres < minAcres || acres > maxAcres) { wrongSize++; continue; }
  const use = (a.landUseDsc || '').trim();
  if (use && NOT_RESIDENTIAL.test(use)) { notRes++; continue; }
  const here = (id && byParcel.get(id)) || [];
  let pt;
  if (here.length) {
    const addrs = new Set(here.map((p) => (p.AddrFull || '').trim().toUpperCase()));
    if (addrs.size > 1 || here.some((p) => (p.Unit || '').trim())) { multi++; continue; }
    pt = { addr: (here[0].AddrFull || '').trim(), city: (here[0].PlaceName || '').trim() || (a.sitAddCty || '').trim(), zip: here[0].Zipcode || a.sitAddZip }; fromPoint++;
  } else if ((a.situsAdd || '').trim()) {
    pt = { addr: a.situsAdd.trim(), city: (a.sitAddCty || '').trim(), zip: a.sitAddZip }; fromRow++;
  } else { noSitus++; continue; }
  const owner = PLACEHOLDER && (a.owner || '').trim() === PLACEHOLDER ? '' : [a.owner, a.owner2].filter(Boolean).join(' / ').trim();
  if (owner && ORG.test(owner)) { org++; continue; }
  kept.push({ a, acres, c, pt, owner });
}
console.log(`  inside the area, in size band, one address: ${kept.length} (address from an address point ${fromPoint}, from the parcel row ${fromRow})`);
console.log(`  dropped: ${outside} outside the area · ${wrongSize} outside the lot band · ${notRes} non-residential land use · ${noSitus} with no address (vacant land) · ${multi} with several addresses or a unit · ${org} owned by an organisation${dup ? ' · ' + dup + ' repeated parcel rows' : ''}`);

/* ---- does the owner live there? (the same test as build-walklist-co.mjs) */
const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\b(ROAD|RD|STREET|ST|AVENUE|AVE|DRIVE|DR|LANE|LN|COURT|CT|CIRCLE|CIR|PLACE|PL|TRAIL|TRL|WAY|BOULEVARD|BLVD|POINT|PT|TERRACE|TER|PARKWAY|PKWY|HIGHWAY|HWY|NORTH|SOUTH|EAST|WEST|N|S|E|W)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const houseNo = (s) => (String(s || '').match(/\b(\d+)\b/) || [])[1] || '';
const FALLBACK = `${COUNTY.toUpperCase()} COUNTY`;
const rows = [];
for (const k of kept) {
  const a = k.a, situs = k.pt.addr, mail = (a.ownerAdd || '').trim(), city = k.pt.city || FALLBACK;
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
  rows.push({ knock: occupied, num: m ? m[1] : '', street: m ? m[2].trim() : situs, city, zip: String(k.pt.zip || '').replace(/\D/g, '').slice(0, 5),
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
