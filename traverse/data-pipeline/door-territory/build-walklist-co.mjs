/* Sixfold — walk lists for Teller, Douglas and the rest of Colorado. 2026-09-29.

   Sibling to build-walklist.mjs. Same CSV out, same PDF step — different source,
   because the two are genuinely different problems.

   ---- WHY THIS IS A SEPARATE SCRIPT ----------------------------------------

   `build-walklist.mjs` talks to El Paso County's own GIS services and has to
   work for its living: the parcel layer carries no property address, so it
   forward-geocodes every owner's mailing address and measures the distance back
   to the parcel.

   This one uses the STATEWIDE layer, which already carries both addresses:

     https://gis.colorado.gov/public/rest/services/Address_and_Parcel/
       Colorado_Public_Parcels/FeatureServer/0

   So occupancy is a string comparison, lot size is a field, and land use is a
   field. No geocoding at all — which makes it far faster than the El Paso run.

   ⚑ AND EL PASO CANNOT USE IT. Measured 2026-09-29 over a 1,000-parcel sample
   per county, the share of rows carrying each field:

                      El Paso   Teller   Douglas
        owner              0%      99%      100%
        ownerAdd           0%      99%      100%
        situsAdd           0%      79%       82%
        landAcres          0%      99%       98%
        landUseDsc         0%      65%      100%

   El Paso contributes geometry and nothing else. That is the whole reason the
   other script exists. **Re-run that coverage check before trusting this for a
   county nobody has used it for yet** — `--coverage` does it.

   Run:
     node build-walklist-co.mjs --place=castle-rock --radius=1.5
     node build-walklist-co.mjs --county=TELLER --lat=39.0 --lon=-105.057 --radius=2
     node build-walklist-co.mjs --coverage=DOUGLAS                                   */

import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; Sixfold walk-list builder)' };
const LAYER = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';

/* Towns inside, or just outside, the derived service area. The radius does the
   rest. ⚑ Widening where Sixfold actually sells is Brandon's call, not a
   consequence of a town being listed here. */
const PLACES = {
  /* Douglas */
  'castle-rock': ['DOUGLAS', 39.3722, -104.8561],
  sedalia:       ['DOUGLAS', 39.4386, -104.9614],
  larkspur:      ['DOUGLAS', 39.2311, -104.8747],
  franktown:     ['DOUGLAS', 39.3894, -104.7519],
  /* north Douglas (2026-10-07, Matthew: three more high-lawn places, for the Traverse lawn edition): drawn by the situs
     city with --cities, not by the circle alone. ⚑ Outside Sixfold's area: they go to the editions only. */
  'highlands-ranch': ['DOUGLAS', 39.540, -104.985],
  parker:            ['DOUGLAS', 39.515, -104.765],
  'castle-pines':    ['DOUGLAS', 39.455, -104.895],
  /* Teller */
  'woodland-park': ['TELLER', 39.0000, -105.0569],
  divide:          ['TELLER', 38.9469, -105.1636],
  florissant:      ['TELLER', 38.9469, -105.2911],
  'cripple-creek': ['TELLER', 38.7466, -105.1783],
};

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};

async function getJSON(url, tries = 6)   /* Group 2 copy: 6 tries, 3 s steps (gis.colorado.gov answered a Larimer page with HTTP 500 on 28 Oct) */ {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 160));
      return j;
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
}

/* ---- --coverage: the check to run before trusting a new county ------------ */
const coverage = arg('coverage');
if (coverage) {
  const county = coverage.toUpperCase();
  const cnt = await getJSON(`${LAYER}?${new URLSearchParams({ f: 'json', where: `countyName='${county}'`, returnCountOnly: 'true' })}`);
  const s = await getJSON(`${LAYER}?${new URLSearchParams({
    f: 'json', where: `countyName='${county}'`, returnGeometry: 'false',
    outFields: 'owner,ownerAdd,situsAdd,landAcres,landUseDsc', resultRecordCount: '1000', orderByFields: 'OBJECTID',
  })}`);
  const rows = (s.features ?? []).map((f) => f.attributes);
  if (!rows.length) { console.log(`${county}: no rows returned — is the name right?`); process.exit(1); }
  const pct = (fn) => `${Math.round(100 * rows.filter(fn).length / rows.length)}%`;
  console.log(`\n${county} — ${(cnt.count ?? 0).toLocaleString()} parcels, sampled ${rows.length}\n`);
  console.log(`   owner       ${pct((a) => (a.owner || '').trim())}`);
  console.log(`   ownerAdd    ${pct((a) => (a.ownerAdd || '').trim())}`);
  console.log(`   situsAdd    ${pct((a) => (a.situsAdd || '').trim())}`);
  console.log(`   landAcres   ${pct((a) => a.landAcres > 0)}`);
  console.log(`   landUseDsc  ${pct((a) => (a.landUseDsc || '').trim())}`);
  console.log('\n   Anything at 0% means the county shares geometry only — this script cannot use it.');
  process.exit(0);
}

/* ---- args ---------------------------------------------------------------- */
const place = arg('place');
let county = (arg('county') || '').toUpperCase(), lat = Number(arg('lat')), lon = Number(arg('lon'));
if (place) {
  if (!PLACES[place]) {
    console.error(`unknown place "${place}". known: ${Object.keys(PLACES).join(', ')}`);
    process.exit(1);
  }
  [county, lat, lon] = PLACES[place];
}
if (!county || !Number.isFinite(lat) || !Number.isFinite(lon)) {
  console.error('need --place=<name>, or --county= with --lat= and --lon=');
  process.exit(1);
}
const radiusMi = Number(arg('radius', '1.5'));
const minAcres = Number(arg('min-acres', '0.18'));
/* Raised 2.5 -> 10 on 2026-10-01 (SX-9d). 2.5 was clipping Black Forest, Larkspur,
   Divide and Florissant, where RR-5 zoning makes ~5 acres the normal lot -- exactly the
   big wooded lots the fire and land work is built for. 10 sits well under Colorado's
   35-acre ranch threshold, and the owner-lives-here filter still drops absentee land.
   ⚑ WIDENING IS SAFE, NARROWING IS NOT: marks survive a rebuild that adds doors, but
   a door that drops out orphans its mark. Do not lower this without reading SX-13. */
const maxAcres = Number(arg('max-acres', '10'));
/* --cities=PARKER,AURORA keeps only parcels whose property address is in those cities; --city-zip=CASTLE ROCK:80108 also keeps
   that city within that ZIP (Castle Pines Village is addressed Castle Rock 80108). Both empty = the whole circle, as before. */
const CITIES = (arg('cities', '') || '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
const CITY_ZIP = (arg('city-zip', '') || '').split(',').map((c) => c.trim().toUpperCase().split(':')).filter((p) => p.length === 2);
const outFile = arg('out', `walklist-${place ?? county.toLowerCase()}.csv`);
/* used when the county leaves the situs city blank — see the note at its use */
const REGION_FALLBACK = (place ?? `${county} COUNTY`).replace(/-/g, ' ').toUpperCase();

/* --municipality="Centennial" (2026-10-07): keep only parcels whose centre is inside the town's legal boundary, from the state's
   municipal layer (DOLA, as security/build-security.mjs reads Colorado Springs). Better than the postal city where a town's
   homes carry neighbours' city names (Centennial: Englewood, Littleton, Aurora). The layer holds the town as its original area
   plus every annexation, pieces that can overlap: inside ANY piece counts. */
const MUNI = arg('municipality', '');
let muniPieces = null;
/* --pieces=file.json: the same test against shapes saved beforehand ([{ rings, bb }], e.g. a city's chosen neighbourhoods) */
const PIECES = arg('pieces', '');
if (PIECES) {
  muniPieces = JSON.parse(readFileSync(join(HERE, PIECES), 'utf8'));
  console.log(`${PIECES}: ${muniPieces.length} shapes`);
} else if (MUNI) {
  muniPieces = [];
  for (let off = 0; ; off += 1000) {
    const q = new URLSearchParams({ where: `cityname = '${MUNI.replace(/'/g, "''")}'`, outFields: 'OBJECTID', outSR: '4326', f: 'json', resultOffset: String(off), resultRecordCount: '1000' });
    const j = await getJSON(`https://services3.arcgis.com/DgjqnJA1rgO92Soi/arcgis/rest/services/Municipal_Boundary/FeatureServer/0/query?${q}`);
    if (j.error) throw new Error('municipal boundary: ' + JSON.stringify(j.error).slice(0, 200));
    for (const f of j.features || []) if (f.geometry && f.geometry.rings) {
      const rings = f.geometry.rings, all = rings.flat();
      muniPieces.push({ rings, bb: [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))] });
    }
    if (!j.exceededTransferLimit && (j.features || []).length < 1000) break;
  }
  if (!muniPieces.length) { console.error(`no municipal boundary named "${MUNI}"`); process.exit(1); }
  console.log(`${MUNI}: ${muniPieces.length} boundary pieces`);
}
const inRingXY = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const inMuni = (x, y) => muniPieces.some((p) => x >= p.bb[0] && x <= p.bb[2] && y >= p.bb[1] && y <= p.bb[3] && (p.rings.filter((r) => inRingXY(x, y, r)).length % 2 === 1));

/* ---- pull ---------------------------------------------------------------- */
const dLat = radiusMi / 69;
const dLon = radiusMi / (69 * Math.cos(lat * Math.PI / 180));
const envelope = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(',');

console.log(`\n${county} county — centre ${lat.toFixed(5)}, ${lon.toFixed(5)}, radius ${radiusMi} mi`);
console.log(`lot filter ${minAcres}–${maxAcres} acres\n`);

const feats = [];
let offset = 0;
for (;;) {
  const p = new URLSearchParams({
    f: 'json', where: `countyName='${county}'`, geometry: envelope,
    geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'owner,owner2,ownerAdd,ownAddCty,ownAddStt,ownAddZip,situsAdd,sitAddCty,sitAddZip,landAcres,landUseDsc,parcel_id',
    returnGeometry: 'true', resultOffset: String(offset), resultRecordCount: '1000',
  });
  const r = await getJSON(`${LAYER}?${p}`);
  const got = r.features ?? [];
  feats.push(...got);
  process.stdout.write(`\r  parcels pulled: ${feats.length}`);
  if (got.length < 1000) break;
  offset += got.length;
}
console.log('');

/* ---- filter -------------------------------------------------------------- */
/* Land use is a field here, so residential is a real filter rather than the
   owner-name guessing the El Paso build has to fall back on. Blank is KEPT —
   Teller only fills this on about two thirds of rows, and dropping blanks would
   quietly throw away a third of the county. */
const NOT_RESIDENTIAL = /EXEMPT|COMMERCIAL|INDUSTRIAL|AGRICULT|VACANT|MINING|UTILIT|CHURCH|SCHOOL|GOVERNMENT|CONDO|APARTMENT|MOBILE/i;
const centroid = (ring) => [
  ring.reduce((s, p) => s + p[0], 0) / ring.length,
  ring.reduce((s, p) => s + p[1], 0) / ring.length,
];

let noAcres = 0, wrongSize = 0, notRes = 0, noSitus = 0, offCity = 0, shapeAcres = 0;
/* planar area of lat/lon rings in square metres (the same as build-walklist.mjs's areaM2) */
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
const kept = [];
for (const f of feats) {
  const a = f.attributes;
  if (!f.geometry?.rings?.length) continue;
  /* Denver, Arapahoe and Larimer leave landAcres empty (coverage 0%, 2026-10-07): the lot size then comes from the parcel's own
     shape, as build-walklist.mjs does for El Paso (planar area, under a percent off at parcel scale) */
  let acres = Number(a.landAcres);
  if (!(acres > 0) && f.geometry.rings.length) { acres = areaM2(f.geometry.rings) / 4046.8564; shapeAcres++; }
  if (!(acres > 0)) { noAcres++; continue; }
  if (acres < minAcres || acres > maxAcres) { wrongSize++; continue; }
  const use = (a.landUseDsc || '').trim();
  if (use && NOT_RESIDENTIAL.test(use)) { notRes++; continue; }
  if (!(a.situsAdd || '').trim()) { noSitus++; continue; }
  if (muniPieces) { const [cx, cy] = centroid(f.geometry.rings[0]); if (!inMuni(cx, cy)) { offCity++; continue; } }
  if (CITIES.length || CITY_ZIP.length) {
    const cty = (a.sitAddCty || '').trim().toUpperCase(), zip = String(a.sitAddZip || '').replace(/\D/g, '').slice(0, 5);
    if (!CITIES.includes(cty) && !CITY_ZIP.some(([c, z]) => c === cty && z === zip)) { offCity++; continue; }
  }
  kept.push({ a, acres, c: centroid(f.geometry.rings[0]) });
}
console.log(`  in size band:   ${kept.length + noSitus + notRes}`);
console.log(`  dropped:        ${notRes} non-residential land use · ${noSitus} with no property address · ${noAcres} with no acreage${offCity ? ' · ' + offCity + ' outside the cities asked for' : ''}${shapeAcres ? ' · ' + shapeAcres + ' lot sizes from the parcel shape' : ''}`);

/* ---- does the owner live there? -----------------------------------------

   No geocoding needed: both addresses are on the record. Normalise hard,
   because the two are entered by different people — "1270 FAWNWOOD RD" against
   "1270 FAWNWOOD ROAD" is the same door.                                     */
const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\b(ROAD|RD|STREET|ST|AVENUE|AVE|DRIVE|DR|LANE|LN|COURT|CT|CIRCLE|CIR|PLACE|PL|TRAIL|TRL|WAY|BOULEVARD|BLVD|POINT|PT|TERRACE|TER|PARKWAY|PKWY|HIGHWAY|HWY|NORTH|SOUTH|EAST|WEST|N|S|E|W)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const houseNo = (s) => (String(s || '').match(/\b(\d+)\b/) || [])[1] || '';

const rows = [];
for (const k of kept) {
  const a = k.a;
  const situs = (a.situsAdd || '').trim();
  const mail = (a.ownerAdd || '').trim();
  const isPOBox = /\bP\s*O\s*BOX\b|\bPOBOX\b/i.test(mail);

  let occupied = false, why = '';
  if (isPOBox) { why = 'owner mails to a PO box'; }
  else {
    const sameNum = houseNo(situs) && houseNo(situs) === houseNo(mail);
    const sn = norm(situs).replace(/^\d+\s*/, ''), mn = norm(mail).replace(/^\d+\s*/, '');
    const sameStreet = sn && mn && (sn === mn || sn.startsWith(mn) || mn.startsWith(sn));
    occupied = Boolean(sameNum && sameStreet);
    why = occupied ? 'owner lives here'
      : norm(a.ownAddCty) === norm(a.sitAddCty) ? 'owner is local but lives elsewhere'
      : `owner is in ${(a.ownAddCty || a.ownAddStt || 'another area').trim()}`;
  }

  const m = situs.match(/^\s*(\d+)\s+(.*)$/);
  rows.push({
    knock: occupied, num: m ? m[1] : '', street: m ? m[2].trim() : situs,
    /* ⚑ Teller populates sitAddCty on 0% of rows; Douglas on 100%. Without a
       fallback every Teller sheet came out headed "Unknown". Falls back to the
       place asked for, then to the county. */
    city: (a.sitAddCty || '').trim() || REGION_FALLBACK,
    /* the statewide layer right-pads zips to nine digits ("801040000") */
    zip: String(a.sitAddZip || '').replace(/\D/g, '').slice(0, 5),
    acres: k.acres, owner: [a.owner, a.owner2].filter(Boolean).join(' / ').trim(),
    mail: [mail, a.ownAddCty, a.ownAddStt, a.ownAddZip].filter(Boolean).join(', '),
    why, use: (a.landUseDsc || '').trim(), parcel: a.parcel_id ?? '',
    lat: k.c[1], lon: k.c[0],
  });
}

rows.sort((x, y) => {
  const s = (x.street || 'ZZZ').localeCompare(y.street || 'ZZZ');
  return s !== 0 ? s : (Number(x.num) || 0) - (Number(y.num) || 0);
});

/* ---- out — identical columns to build-walklist.mjs ----------------------- */
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = [
  ['knock', 'address', 'city', 'zip', 'acres', 'owner', 'owner_mailing', 'why', 'parcel', 'lat', 'lon'].join(','),
  ...rows.map((r) => [
    r.knock ? 'YES' : 'no — post',
    `${r.num} ${r.street}`.trim(), r.city, r.zip, r.acres.toFixed(2),
    r.owner, r.mail, r.why, r.parcel, r.lat.toFixed(6), r.lon.toFixed(6),
  ].map(esc).join(',')),
].join('\n');
writeFileSync(join(HERE, outFile), csv, 'utf8');

const knock = rows.filter((r) => r.knock);
const avg = knock.length ? (knock.reduce((s, r) => s + r.acres, 0) / knock.length).toFixed(2) : '—';
console.log(`
  ── result ─────────────────────────────────
  doors to knock      ${String(knock.length).padStart(5)}   avg ${avg} acres
  post instead        ${String(rows.length - knock.length).padStart(5)}   owner not resident
  ───────────────────────────────────────────
  streets covered     ${new Set(knock.map((r) => r.street)).size}

  written: ${outFile}
  next:    node build-walklist-pdf.mjs ${outFile}`);
