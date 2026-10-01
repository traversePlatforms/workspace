/* Sixfold — door-to-door walk list from El Paso County public records.
   Built 2026-09-29 (TASKS.md SX-9).

   Turns a map location into a street-ordered list of doors worth knocking, with
   the reason for each door already on the line. Nothing here is scraped or
   bought: every field comes from El Paso County's own public GIS services.

   ---- WHERE THE DATA COMES FROM, AND WHY THESE SERVICES --------------------

   1. PARCEL OWNERS — the spine.
      Public/MailingLabelParcels/MapServer/0 ("ParcelOwners")
      Gives parcel number, owner name, owner's MAILING address, and the parcel
      polygon. It is the county's own mailing-label layer, so the ownership side
      is exactly what they would use to post a legal notice.

   2. PROPERTY ADDRESS — reverse geocoded.
      Public/Composite_Locator_Pro/GeocodeServer/reverseGeocode
      ⚑ The parcel layer does NOT carry the property's own address, only the
      owner's mailing address. So the situs address is recovered by reverse
      geocoding the parcel centroid. Verified working: a Monument centroid
      returned "392 BEACON LITE, MONUMENT, CO, 80132".
      ⚑ Do not swap in Public/EPCPortalLocator2026 — that one reverse geocodes
      to the PARCEL NUMBER, not a street address. It was tried first.

   ---- TWO THINGS THAT WERE MEASURED, NOT ASSUMED ---------------------------

   ⚑ STArea__ IS IN SQUARE FEET. Checked by computing true ground area from the
   WGS84 geometry and dividing: the median ratio came out 10.7476 against the
   10.7639 sq ft per sq metre you would expect. Acres = STArea__ / 43560.
   This script still computes area from the geometry itself and only uses
   STArea__ as a cross-check, so a future change of projection cannot silently
   corrupt every lot size.

   ⚑ THE MAILING STREET IS `ADDRESS2`, NOT `ADDRESS1`. In a 40-parcel sample
   ADDRESS1 was populated once and ADDRESS2 thirty-nine times. Reading ADDRESS1
   would produce a list with almost no mailing addresses on it.

   ---- WHAT IT DOES NOT DO --------------------------------------------------

   No phone numbers, by design. Parcel records do not carry them, and appending
   them turns a walk list into a cold-call list, which brings the federal Do Not
   Call rules and per-call penalties with it. Knocking carries none of that.
   See the meeting sheet: operations/Sixfold-Door-Territory.pdf.

   Run:
     node build-walklist.mjs --place=monument --radius=1.5
     node build-walklist.mjs --lat=39.0917 --lon=-104.8722 --radius=2 \
                             --min-acres=0.2 --max-acres=2 --out=monument.csv   */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, '.address-cache.json');
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; Sixfold walk-list builder)' };

const PARCELS = 'https://gisservices.elpasoco.com/arcgis2/rest/services/Public/MailingLabelParcels/MapServer/0/query';
const GEOCODER = 'https://gisservices.elpasoco.com/arcgis2/rest/services/Public/Composite_Locator_Pro/GeocodeServer/reverseGeocode';

/* Places we actually serve. Centre points, not boundaries — the radius does the
   rest. Sixfold's service area is El Paso / Teller / southern Douglas, which is
   DERIVED (35 miles from Monument) and widening it is Brandon's call. */
const PLACES = {
  monument:        [39.0917, -104.8722],
  'palmer-lake':   [39.1222, -104.9169],
  'black-forest':  [39.0138, -104.7025],
  larkspur:        [39.2311, -104.8747],
  'gleneagle':     [39.0400, -104.8100],
  'woodmoor':      [39.1000, -104.8450],
};

/* ---- args ---------------------------------------------------------------- */
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const place = arg('place');
let lat = Number(arg('lat')), lon = Number(arg('lon'));
if (place) {
  if (!PLACES[place]) {
    console.error(`unknown place "${place}". known: ${Object.keys(PLACES).join(', ')}`);
    process.exit(1);
  }
  [lat, lon] = PLACES[place];
}
if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
  console.error('need --place=<name> or --lat= and --lon=');
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
const outFile = arg('out', `walklist-${place ?? 'area'}.csv`);
/* ⚑ RAISED 4000 -> 50000 on 2026-10-01, and the cap now SHOUTS when it bites.
   At 4000 it silently truncated Monument and Black Forest once their boxes grew: the
   pull stopped mid-stream and dropped whatever parcels came back last — 101 doors that
   crews may already have marked. A cap that drops data without saying so is worse than
   no cap. If this ever trips, raise --limit; never ship a truncated pull. */
const limit = Number(arg('limit', '50000'));

/* ---- geometry ------------------------------------------------------------ */
/* Planar area of a lat/lon ring in square metres, via a local equirectangular
   projection. Accurate to well under a percent at parcel scale, and it means
   lot size never depends on a field whose units could change. */
function areaM2(rings) {
  let total = 0;
  for (const ring of rings) {
    const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * Math.PI / 180;
    const R = 6378137, kx = R * Math.cos(lat0) * Math.PI / 180, ky = R * Math.PI / 180;
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      a += ring[j][0] * kx * (ring[i][1] * ky) - ring[i][0] * kx * (ring[j][1] * ky);
    }
    total += Math.abs(a / 2);
  }
  return total;
}
const centroid = (ring) => [
  ring.reduce((s, p) => s + p[0], 0) / ring.length,
  ring.reduce((s, p) => s + p[1], 0) / ring.length,
];

/* ---- fetch with retry ---------------------------------------------------- */
async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 160));
      return j;
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
}

/* ---- 1. pull the parcels ------------------------------------------------- */
const dLat = radiusMi / 69;
const dLon = radiusMi / (69 * Math.cos(lat * Math.PI / 180));
const envelope = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(',');

console.log(`\ncentre ${lat.toFixed(5)}, ${lon.toFixed(5)}   radius ${radiusMi} mi`);
console.log(`lot filter ${minAcres}–${maxAcres} acres\n`);

const parcels = [];
let offset = 0;
for (;;) {
  const p = new URLSearchParams({
    f: 'json', where: '1=1', geometry: envelope, geometryType: 'esriGeometryEnvelope',
    inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects',
    outFields: 'PARCEL,NAME1,NAME2,ADDRESS2,CITY,STATECODE,ZIPCODE,STArea__',
    returnGeometry: 'true', resultOffset: String(offset), resultRecordCount: '1000',
  });
  const r = await getJSON(`${PARCELS}?${p}`);
  const got = r.features ?? [];
  parcels.push(...got);
  process.stdout.write(`\r  parcels pulled: ${parcels.length}`);
  if (got.length < 1000) break;
  if (parcels.length >= limit) {
    console.error(`

  ⚑⚑ PARCEL CAP HIT at ${limit} — THIS PULL IS TRUNCATED. Doors past the cap are`);
    console.error(`  silently missing. Re-run with a higher --limit. Do NOT build from this CSV.
`);
    process.exit(2);
  }
  offset += got.length;
}
console.log('');

/* ---- 2. size filter, before anything expensive --------------------------- */
let areaMismatch = 0;
const sized = [];
for (const f of parcels) {
  if (!f.geometry?.rings?.length) continue;
  const acres = areaM2(f.geometry.rings) / 4046.8564224;
  /* cross-check against the county's own figure, treating it as square feet */
  const theirs = (f.attributes.STArea__ ?? 0) / 43560;
  if (theirs > 0 && Math.abs(theirs - acres) / acres > 0.15) areaMismatch++;
  if (acres < minAcres || acres > maxAcres) continue;
  sized.push({ f, acres, c: centroid(f.geometry.rings[0]) });
}
console.log(`  in size band:   ${sized.length}`);
if (areaMismatch > sized.length * 0.2 && sized.length) {
  console.log(`  ⚑ ${areaMismatch} parcels disagree with STArea__ by >15% — check the units assumption`);
}

/* ---- 3. does the owner live on the parcel? -------------------------------

   ⚑ THIS IS THE METHOD, AND IT REPLACED A WORSE ONE. The first build reverse
   geocoded each parcel centroid to get the property's address. That fails twice:
   this locator has no rooftop address points (featureTypes=PointAddress returns
   nothing), so it interpolates off street centrelines — and for odd or large
   parcels it snaps to the nearest road, producing rows like "0 0 INTERSTATE 25".

   The better method inverts it. For an owner-occupied home, the owner's MAILING
   address already IS the door address, and it comes straight from the county
   rather than being interpolated. So:

     forward geocode the mailing address  ->  how far is it from this parcel?

   ⚑ THE 150 m THRESHOLD IS MEASURED. On a 14-parcel Monument sample the
   distances came out cleanly bimodal, with nothing in between:

        on the parcel      24, 34, 37, 43, 45, 67, 70 m
        somewhere else     491 m … 7.8 km

   150 m sits in the middle of an empty gap, with more than double the margin on
   the near side. Re-measure it before trusting it in a different kind of area —
   dense townhouses or true ranch land may not separate as cleanly.           */

const NEAR_M = Number(arg('near-metres', '150'));
const GEOCODE = 'https://gisservices.elpasoco.com/arcgis2/rest/services/Public/Composite_Locator_Pro/GeocodeServer/findAddressCandidates';
const GEOCODE_BATCH = 'https://gisservices.elpasoco.com/arcgis2/rest/services/Public/Composite_Locator_Pro/GeocodeServer/geocodeAddresses';

const metres = (a, b) => {
  const lat0 = (a[1] + b[1]) / 2 * Math.PI / 180, R = 6378137;
  return Math.hypot((a[0] - b[0]) * Math.PI / 180 * R * Math.cos(lat0),
                    (a[1] - b[1]) * Math.PI / 180 * R);
};

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
let done = 0, fetched = 0;

/* ⚑ BATCH GEOCODING. The first version called findAddressCandidates once per
   door at a concurrency of 6 — about 1.3 doors a second. Monument at 0.7 mi took
   minutes, and Colorado Springs (121,709 parcels in a 6-mile box) would have been
   roughly TWELVE HOURS of requests against someone else's public server, which
   is both unusable and rude.

   The locator supports ArcGIS `geocodeAddresses`, which it does not advertise in
   its capabilities string. Measured 2026-09-29: 1,000 addresses returned in 0.9
   seconds — about 850x faster, and one request instead of a thousand. Chunked at
   500 to stay well inside whatever the real limit is.

   Matching is by ResultID, which echoes the OBJECTID sent. Never assume the
   locations come back in the order they were sent. */
const BATCH = 500;

const todoAddr = [];                       // [{ item, full }] needing a lookup
for (const item of sized) {
  const a = item.f.attributes;
  const street = (a.ADDRESS2 || '').trim();
  if (!street || /\bP\s*O\s*BOX\b|\bPOBOX\b/i.test(street)) { item.loc = { box: true }; done++; continue; }
  const full = [street, a.CITY, a.STATECODE || 'CO', a.ZIPCODE].filter(Boolean).join(', ');
  item._full = full;
  if (cache[full] !== undefined) {
    item.loc = cache[full] ? { pt: cache[full] } : { nogeo: true };
    done++;
    continue;
  }
  todoAddr.push(item);
}

/* one lookup per DISTINCT address — two parcels can share an owner's address */
const uniq = [...new Set(todoAddr.map((i) => i._full))];
for (let i = 0; i < uniq.length; i += BATCH) {
  const chunk = uniq.slice(i, i + BATCH);
  const records = { records: chunk.map((full, n) => ({ attributes: { OBJECTID: n + 1, SingleLine: full } })) };
  try {
    const p = new URLSearchParams({ f: 'json', addresses: JSON.stringify(records), outSR: '4326' });
    const r = await fetch(GEOCODE_BATCH, {
      method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: p,
    });
    const j = await r.json();
    if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 140));
    for (const loc of (j.locations ?? [])) {
      const at = loc.attributes ?? {};
      const full = chunk[(at.ResultID ?? 0) - 1];
      if (full === undefined) continue;
      /* ⚑ geocodeAddresses puts the point in attributes.X / attributes.Y — NOT in
         a `location` object the way findAddressCandidates does. Reading
         loc.location here silently produced zero usable matches. */
      const x = at.X ?? loc.location?.x, y = at.Y ?? loc.location?.y;
      const ok = (loc.score ?? at.Score ?? 0) >= 85 && Number.isFinite(x) && Number.isFinite(y);
      cache[full] = ok ? [x, y] : null;
    }
    for (const full of chunk) if (cache[full] === undefined) cache[full] = null;   // never re-ask forever
  } catch (e) {
    /* say so rather than quietly marking a whole chunk unresolvable */
    console.error(`\n  ⚑ geocode batch failed (${chunk.length} addresses): ${e.message}`);
    for (const full of chunk) if (cache[full] === undefined) cache[full] = null;
  }
  fetched += chunk.length;
  process.stdout.write(`\r  owner addresses: ${Math.min(i + BATCH, uniq.length)}/${uniq.length} looked up`);
}
for (const item of todoAddr) {
  item.loc = cache[item._full] ? { pt: cache[item._full] } : { nogeo: true };
  done++;
}
writeFileSync(CACHE, JSON.stringify(cache), 'utf8');
console.log(`\r  owner addresses: ${done}/${sized.length}  (${uniq.length} distinct looked up, rest cached)`);

/* ---- 4. build the rows --------------------------------------------------- */
const splitNum = (s) => {
  const m = (s || '').trim().match(/^(\d+)\s+(.*)$/);
  return m ? { num: m[1], street: m[2].trim() } : { num: '', street: (s || '').trim() };
};

const rows = [];
for (const it of sized) {
  const a = it.f.attributes;
  const mailStreet = (a.ADDRESS2 || '').trim();
  const { num, street } = splitNum(mailStreet);
  let occupied = null, why = '', dist = null;

  if (it.loc.box) { occupied = false; why = 'owner mails to a PO box'; }
  else if (it.loc.nogeo) { occupied = null; why = 'owner address would not geocode'; }
  else {
    dist = metres(it.loc.pt, it.c);
    occupied = dist <= NEAR_M;
    why = occupied
      ? `owner lives here (${Math.round(dist)} m)`
      : dist < 8000 ? `owner lives ${(dist / 1609).toFixed(1)} mi away` : 'owner is out of area';
  }

  rows.push({
    parcel: a.PARCEL, num, street,
    city: a.CITY || '', zip: (a.ZIPCODE || '').split('-')[0],
    acres: it.acres,
    owner: [a.NAME1, a.NAME2].filter(Boolean).join(' / ').replace(/\s*\/\s*$/, ''),
    mail: [mailStreet, a.CITY, a.STATECODE, a.ZIPCODE].filter(Boolean).join(', '),
    occupied, why, dist,
    /* the parcel centroid, carried through so the print step can cluster doors
       into neighbourhoods rather than leaving a rep to drive between lots */
    lon: it.c[0], lat: it.c[1],
  });
}

/* ---- 5. street order ----------------------------------------------------- */
/* A rep walks a street, not a spreadsheet: group by street, then by house
   number ascending, so the list is the route. */
rows.sort((a, b) => {
  const s = (a.street || 'ZZZ').localeCompare(b.street || 'ZZZ');
  return s !== 0 ? s : (Number(a.num) || 0) - (Number(b.num) || 0);
});

const knock = rows.filter((r) => r.occupied === true);
const post = rows.filter((r) => r.occupied === false);
const unknown = rows.filter((r) => r.occupied === null);

/* ---- 6. out -------------------------------------------------------------- */
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = [
  ['knock', 'address', 'city', 'zip', 'acres', 'owner', 'owner_mailing', 'why', 'parcel', 'lat', 'lon'].join(','),
  ...rows.map((r) => [
    r.occupied === true ? 'YES' : r.occupied === false ? 'no — post' : '?',
    `${r.num} ${r.street}`.trim(), r.city, r.zip, r.acres.toFixed(2),
    r.owner, r.mail, r.why, r.parcel, r.lat.toFixed(6), r.lon.toFixed(6),
  ].map(esc).join(',')),
].join('\n');
const outPath = join(HERE, outFile);
writeFileSync(outPath, csv, 'utf8');

const acresOf = (a) => a.length ? (a.reduce((s, r) => s + r.acres, 0) / a.length).toFixed(2) : '—';
console.log(`
  ── result ─────────────────────────────────
  doors to knock      ${String(knock.length).padStart(5)}   avg ${acresOf(knock)} acres
  post instead        ${String(post.length).padStart(5)}   owner not resident
  unresolved          ${String(unknown.length).padStart(5)}   no address came back
  ───────────────────────────────────────────
  streets covered     ${new Set(knock.map((r) => r.street)).size}

  written: ${outFile}`);

const byStreet = new Map();
for (const r of knock) byStreet.set(r.street, (byStreet.get(r.street) ?? 0) + 1);
const top = [...byStreet].sort((a, b) => b[1] - a[1]).slice(0, 8);
if (top.length) {
  console.log('\n  densest streets — start here:');
  for (const [s, n] of top) console.log(`    ${String(n).padStart(3)} doors   ${s}`);
}
