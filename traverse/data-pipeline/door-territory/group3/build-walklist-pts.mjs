/* Group 3b (2026-10-29, Matthew: "We need to add them in anyways. Even if we don't have enough data on the home itself, just make that
   note in the app ... by having it in the system people can input data that they have"). Doors for a county the statewide parcel
   layer cannot serve, from the state's ADDRESS POINTS: every home with an address, whether or not anyone is on record as its owner.
   See ../GROUP3-PLAN-2026-10-29.md, "Group 3b". One county per run, the whole county in one pull (light: Montrose, the biggest, is
   25,146 points, 13 pages); run-group3b.sh then splits the county into its places and rural sweeps with clip-group3.mjs.

   Sources (all public, no key):
     address points  gis.colorado.gov .../Address_and_Parcel/Colorado_Public_Addresses (AddrFull, Unit, Building, PlaceName, Zipcode,
                     Place_Type, Latitude/Longitude). No owner, no parcel number in these counties.
     Census blocks   TIGERweb tigerWMS_Census2020 layer 10: HU100 = housing units counted in the 2020 Census, per block.
     building outlines  Microsoft Global ML Building Footprints (the z9 tiles in tree-zones/buildings, fetch-buildings.mjs).
     parcels         the statewide parcel layer, where the county has rows there (Saguache, Washington, Sedgwick): owner, mailing
                     address and lot size, joined by which parcel the point falls in.

   A point is a home unless (each counted in the log):
     - type:      Place_Type names something else (COMMERCIAL, GOVERNMENT, UTILITY, CHURCH, EXEMPT, MILE MARKER, shared/multi ...).
                  Only Delta and Montrose fill it in; RESIDENTIAL, SFR, MH (mobile home), SEASONAL and blank pass;
     - unit:      it has a unit or building number (apartments, offices, a strip of shops);
     - several:   the same address appears more than once, spread over more than 15 m (a complex), or two different addresses sit
                  within 2 m of each other (stacked points: a multi-tenant building);
     - no homes:  its 2020 Census block has no housing units (HU100 = 0: business districts, industry, parks, fields);
     - big:       it sits in, or within 25 m of, a building outline over 1,000 m2 (about 10,800 sq ft: a store, school, apartments);
     - shared:    another kept address sits on the same building outline (duplex halves, a shop with a flat): both dropped;
     - no building: no building outline within 150 m (rural points sit at the driveway, so the radius is wide): vacant land, a gate;
     - parcel:    where parcels exist: lot over 10 acres, non-residential land use, or an organisation owner (the same lists as
                  build-walklist-ap.mjs).
   Then, per door:
     - owner and mailing address on record (Saguache): the usual owner-lives-here test, "YES" or "no — post", why as everywhere;
     - owner but no mailing address (Sedgwick): knock "YES", why "occupancy unknown: no mailing address on record", limited "no-occupancy";
     - no owner (the 8 address-point counties, Washington): knock "YES", why "no owner on record", limited "no-owner".
   CSV: the walk-list columns (knock,address,city,zip,acres,owner,owner_mailing,why,parcel,lat,lon) + limited. acres is blank where
   no parcel is known.
     node build-walklist-pts.mjs --county="Montrose" --buildings=<tree-zones/buildings dir> --out=raw3b/montrose.csv [--parcels]  */
import { writeFileSync, readFileSync, existsSync, createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

const UA = { 'user-agent': 'Mozilla/5.0 (compatible; Sixfold walk-list builder)' };
const BASE = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/';
const PARCELS = BASE + 'Colorado_Public_Parcels/FeatureServer/0/query', ADDRESSES = BASE + 'Colorado_Public_Addresses/FeatureServer/0/query';
const BLOCKS = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/10/query';
const FIPS = { Adams: '001', Alamosa: '003', Arapahoe: '005', Archuleta: '007', Baca: '009', Bent: '011', Boulder: '013', Broomfield: '014', Chaffee: '015', Cheyenne: '017', 'Clear Creek': '019', Conejos: '021', Costilla: '023', Crowley: '025', Custer: '027', Delta: '029', Denver: '031', Dolores: '033', Douglas: '035', Eagle: '037', Elbert: '039', 'El Paso': '041', Fremont: '043', Garfield: '045', Gilpin: '047', Grand: '049', Gunnison: '051', Hinsdale: '053', Huerfano: '055', Jackson: '057', Jefferson: '059', Kiowa: '061', 'Kit Carson': '063', Lake: '065', 'La Plata': '067', Larimer: '069', 'Las Animas': '071', Lincoln: '073', Logan: '075', Mesa: '077', Mineral: '079', Moffat: '081', Montezuma: '083', Montrose: '085', Morgan: '087', Otero: '089', Ouray: '091', Park: '093', Phillips: '095', Pitkin: '097', Prowers: '099', Pueblo: '101', 'Rio Blanco': '103', 'Rio Grande': '105', Routt: '107', Saguache: '109', 'San Juan': '111', 'San Miguel': '113', Sedgwick: '115', Summit: '117', Teller: '119', Washington: '121', Weld: '123', Yuma: '125' };
const arg = (k, d) => { const hit = process.argv.find((a) => a.startsWith(`--${k}=`)); return hit ? hit.split('=').slice(1).join('=') : d; };
const COUNTY = (arg('county', '') || '').trim(), BLD = arg('buildings', ''), OUT = arg('out', ''), WITH_PARCELS = process.argv.includes('--parcels');
if (!FIPS[COUNTY] || !BLD || !OUT) { console.error('need --county=<Title Case>, --buildings=<dir>, --out=<csv>'); process.exit(1); }
const MAX_ACRES = 10, BIG_M2 = 1000, NEAR_BIG_M = 25, NO_BUILDING_M = 150, SAME_ADDR_M = 15, STACK_M = 2;

async function getJSON(url, body) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(url, body ? { method: 'POST', headers: { ...UA, 'content-type': 'application/x-www-form-urlencoded' }, body } : { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 160)); return j;
    } catch (e) { if (i === 5) throw e; await new Promise((z) => setTimeout(z, 3000 * (i + 1))); }
  }
}
async function pull(url, params, page) {
  const out = [];
  for (let offset = 0; ; offset += page) {
    const p = new URLSearchParams({ f: 'json', outSR: '4326', orderByFields: 'OBJECTID', resultOffset: String(offset), resultRecordCount: String(page), ...params });
    const got = (await getJSON(url, p.toString())).features ?? [];
    out.push(...got);
    if (got.length < page) break;
    await new Promise((z) => setTimeout(z, 500));
  }
  return out;
}
const q1 = (s) => s.replace(/'/g, "''");
const M_LAT = 111320, mLon = (la) => 111320 * Math.cos(la * Math.PI / 180);
const dist = (a, b) => Math.hypot((a[1] - b[1]) * M_LAT, (a[0] - b[0]) * mLon(a[1]));
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inRings = (x, y, rings) => rings.filter((r) => inRing(x, y, r)).length % 2 === 1;
const bboxOf = (pts) => [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
function areaM2(rings) {   /* as build-walklist-ap.mjs: every ring's area added */
  let total = 0;
  for (const ring of rings) {
    const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length, kx = mLon(lat0), ky = M_LAT;
    let ar = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) ar += ring[j][0] * kx * (ring[i][1] * ky) - ring[i][0] * kx * (ring[j][1] * ky);
    total += Math.abs(ar / 2);
  }
  return total;
}
function quadkey(lon, lat, z) {   /* as tree-zones/zones.mjs */
  const s = Math.sin(lat * Math.PI / 180);
  const x = Math.floor((lon + 180) / 360 * 2 ** z), y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z);
  let q = ''; for (let i = z; i > 0; i--) { let dd = 0; const m = 1 << (i - 1); if (x & m) dd++; if (y & m) dd += 2; q += dd; }
  return q;
}
/* a grid index on bounding boxes: G cells per degree (500 = ~0.002 degrees for buildings and points; coarser for big blocks and parcels) */
function indexBoxes(items, G = 500) { const m = new Map(); m.G = G; for (const it of items) { const [x0, y0, x1, y1] = it.bb; for (let x = Math.floor(x0 * G); x <= Math.floor(x1 * G); x++) for (let y = Math.floor(y0 * G); y <= Math.floor(y1 * G); y++) { const k = `${x},${y}`; (m.get(k) || m.set(k, []).get(k)).push(it); } } return m; }
const near = (m, x, y, r = 0) => { const G = m.G || 500, out = new Set(); for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (const it of m.get(`${Math.floor(x * G) + i},${Math.floor(y * G) + j}`) || []) out.add(it); return out; };

console.log(`\n${COUNTY} county (address points${WITH_PARCELS ? ' + parcels' : ''})`);
/* 1. address points */
const pts = (await pull(ADDRESSES, { where: `County='${q1(COUNTY)}'`, outFields: 'OBJECTID,AddrFull,AddrNum,StreetName,Unit,Building,PlaceName,Zipcode,Place_Type,Latitude,Longitude', returnGeometry: 'false' }, 2000))
  .map((f) => f.attributes).filter((a) => Number.isFinite(a.Latitude) && Number.isFinite(a.Longitude) && (a.AddrFull || '').trim());
console.log(`  address points: ${pts.length}`);
const types = new Map(); for (const a of pts) { const t = (a.Place_Type || '').trim() || '(blank)'; types.set(t, (types.get(t) || 0) + 1); }
console.log(`  Place_Type: ${[...types].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t, n]) => `${t} ${n}`).join(' · ')}`);
/* 2. Census blocks */
const blocks = (await pull(BLOCKS, { where: `STATE='08' AND COUNTY='${FIPS[COUNTY]}'`, outFields: 'GEOID,HU100', returnGeometry: 'true', geometryPrecision: '5' }, 1000))
  .filter((f) => f.geometry?.rings?.length).map((f) => ({ hu: +f.attributes.HU100 || 0, rings: f.geometry.rings, bb: bboxOf(f.geometry.rings.flat()) }));
const blockIdx = indexBoxes(blocks, 50);
console.log(`  Census blocks: ${blocks.length} (${blocks.filter((b) => b.hu > 0).length} with homes)`);
/* 3. parcels, where the county has them */
let parcels = [], parcelIdx = new Map(), PLACEHOLDER = null;
if (WITH_PARCELS) {
  parcels = (await pull(PARCELS, { where: `countyName='${q1(COUNTY.toUpperCase())}'`, outFields: 'owner,owner2,ownerAdd,ownAddCty,ownAddStt,ownAddZip,landAcres,landUseDsc,parcel_id', returnGeometry: 'true', geometryPrecision: '6' }, 1000))
    .filter((f) => f.geometry?.rings?.length).map((f) => ({ a: f.attributes, rings: f.geometry.rings, bb: bboxOf(f.geometry.rings.flat()) }));
  parcelIdx = indexBoxes(parcels, 200);
  const freq = new Map(); for (const p of parcels) { const o = (p.a.owner || '').trim(); freq.set(o, (freq.get(o) || 0) + 1); }
  const [top, n] = [...freq].sort((a, b) => b[1] - a[1])[0] || ['', 0];
  if (parcels.length >= 50 && top && n > parcels.length / 2) PLACEHOLDER = top;
  console.log(`  parcels: ${parcels.length}${PLACEHOLDER ? ' (owner names withheld: one placeholder on most rows)' : ''}`);
}
/* 4. building outlines in the tiles under the points */
const cb = bboxOf(pts.map((a) => [a.Longitude, a.Latitude])), pad = 0.003;
const tiles = new Set(pts.map((a) => quadkey(a.Longitude, a.Latitude, 9)));
const buildings = [];
for (const qk of tiles) {
  const f = `${BLD}/${qk}.geojsonl.gz`;
  if (!existsSync(f)) { console.error(`  building tile ${qk} missing: run fetch-buildings.mjs ${[...tiles].join(' ')}`); process.exit(2); }
  const rl = createInterface({ input: createReadStream(f).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of rl) {
    const m = /"coordinates":\s*\[\[\[\s*(-?[\d.]+),\s*(-?[\d.]+)/.exec(line); if (!m) continue;
    const lon = +m[1], lat = +m[2]; if (lon < cb[0] - pad || lon > cb[2] + pad || lat < cb[1] - pad || lat > cb[3] + pad) continue;
    const g = JSON.parse(line).geometry, ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null; if (!ring) continue;
    const bb = bboxOf(ring); buildings.push({ ring, bb, c: [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2], m2: areaM2([ring]) });
  }
}
const bIdx = indexBoxes(buildings);
console.log(`  building outlines: ${buildings.length} in ${tiles.size} tiles`);

/* 5. the tests */
const DROP_TYPE = /COMMERC|GOVERN|UTILIT|CHURCH|EXEMPT|MILE|INDUSTR|SCHOOL|SHARED|MULTI|APART|CONDO|PARK|HOSPITAL|PUBLIC|BUSINESS|OFFICE|RETAIL|WAREHOUSE|STORAGE|HOTEL|MOTEL|CELL|TOWER|WELL|PUMP|GATE|PLACEHOLDER/i;
const NOT_RESIDENTIAL = /EXEMPT|COMMERCIAL|INDUSTRIAL|AGRICULT|VACANT|MINING|UTILIT|CHURCH|SCHOOL|GOVERNMENT|CONDO|APARTMENT|MOBILE/i;
const ORG = /\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|COMPANY|LTD|LP|LLP|PARTNERSHIP|BANK|CREDIT UNION|CHURCH|PARISH|DIOCESE|MINISTRIES|CONGREGATION|SCHOOL|DISTRICT|CITY OF|TOWN OF|COUNTY|STATE OF|UNITED STATES|HOUSING|AUTHORITY|ASSOCIATION|ASSN|HOA|HOMEOWNERS|CONDOMINIUM|APARTMENTS|PROPERTIES|INVESTMENTS|HOLDINGS|REALTY|RENTALS|ENTERPRISES|DEVELOPMENT|BUILDERS|HOMES|RAILROAD|RAILWAY|UTILITIES|CEMETERY|FOUNDATION|HOSPITAL)\b/i;
const drop = { type: 0, unit: 0, several: 0, noHomes: 0, big: 0, shared: 0, noBuilding: 0, parcelSize: 0, parcelUse: 0, parcelOrg: 0 };
const addrKey = (a) => `${(a.AddrFull || '').toUpperCase().replace(/\s+/g, ' ').trim()}|${(a.PlaceName || '').toUpperCase().trim()}`;
let cand = pts.filter((a) => { if (DROP_TYPE.test(a.Place_Type || '')) { drop.type++; return false; } if ((a.Unit || '').trim() || (a.Building || '').trim()) { drop.unit++; return false; } return true; });
/* several: the same address more than once */
const byAddr = new Map(); for (const a of cand) (byAddr.get(addrKey(a)) || byAddr.set(addrKey(a), []).get(addrKey(a))).push(a);
cand = [];
for (const list of byAddr.values()) {
  const p0 = [list[0].Longitude, list[0].Latitude];
  if (list.length > 1 && list.some((a) => dist(p0, [a.Longitude, a.Latitude]) > SAME_ADDR_M)) { drop.several += list.length; continue; }
  cand.push(list[0]);
}
/* several: different addresses stacked on one spot */
{
  const idx = indexBoxes(cand.map((a) => ({ a, bb: [a.Longitude, a.Latitude, a.Longitude, a.Latitude] })));
  const stacked = new Set();
  for (const a of cand) for (const it of near(idx, a.Longitude, a.Latitude, 1)) if (it.a !== a && dist([a.Longitude, a.Latitude], [it.a.Longitude, it.a.Latitude]) < STACK_M) { stacked.add(a); stacked.add(it.a); }
  drop.several += stacked.size; cand = cand.filter((a) => !stacked.has(a));
}
/* no homes in the Census block */
cand = cand.filter((a) => { for (const b of near(blockIdx, a.Longitude, a.Latitude)) if (a.Longitude >= b.bb[0] && a.Longitude <= b.bb[2] && a.Latitude >= b.bb[1] && a.Latitude <= b.bb[3] && inRings(a.Longitude, a.Latitude, b.rings)) { if (b.hu > 0) return true; drop.noHomes++; return false; } return true; });
/* buildings */
const onBuilding = new Map();   /* building -> [points] */
cand = cand.filter((a) => {
  const p = [a.Longitude, a.Latitude];
  let inside = null, nearest = null, nd = 1e9;
  for (const b of near(bIdx, p[0], p[1], 1)) if (p[0] >= b.bb[0] && p[0] <= b.bb[2] && p[1] >= b.bb[1] && p[1] <= b.bb[3] && inRing(p[0], p[1], b.ring)) { inside = b; break; }
  if (!inside) for (const b of near(bIdx, p[0], p[1], Math.ceil(NO_BUILDING_M / 220) + 1)) { const d = dist(p, b.c); if (d < nd) { nd = d; nearest = b; } }
  const b = inside || nearest, d = inside ? 0 : nd;
  if (!b || d > NO_BUILDING_M) { drop.noBuilding++; return false; }
  if (d <= NEAR_BIG_M && b.m2 > BIG_M2) { drop.big++; return false; }
  if (d <= NEAR_BIG_M) (onBuilding.get(b) || onBuilding.set(b, []).get(b)).push(a);
  return true;
});
const shared = new Set(); for (const list of onBuilding.values()) if (list.length > 1) for (const a of list) shared.add(a);
drop.shared = shared.size; cand = cand.filter((a) => !shared.has(a));

/* 6. parcels, the owner-lives-here test, rows */
const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\b(ROAD|RD|STREET|ST|AVENUE|AVE|DRIVE|DR|LANE|LN|COURT|CT|CIRCLE|CIR|PLACE|PL|TRAIL|TRL|WAY|BOULEVARD|BLVD|POINT|PT|TERRACE|TER|PARKWAY|PKWY|HIGHWAY|HWY|NORTH|SOUTH|EAST|WEST|N|S|E|W)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();
const houseNo = (s) => (String(s || '').match(/\b(\d+)\b/) || [])[1] || '';
const rows = []; let withParcel = 0;
for (const a of cand) {
  const situs = a.AddrFull.trim(), city = (a.PlaceName || '').trim() || `${COUNTY.toUpperCase()} COUNTY`, zip = String(a.Zipcode || '').replace(/\D/g, '').slice(0, 5);
  let acres = '', owner = '', mail = '', why = 'no owner on record', knock = true, limited = 'no-owner', parcel = '';
  if (WITH_PARCELS) {
    let hit = null; for (const p of near(parcelIdx, a.Longitude, a.Latitude)) if (a.Longitude >= p.bb[0] && a.Longitude <= p.bb[2] && a.Latitude >= p.bb[1] && a.Latitude <= p.bb[3] && inRings(a.Longitude, a.Latitude, p.rings)) { hit = p; break; }
    if (hit) {
      withParcel++;
      const pa = hit.a; let ac = Number(pa.landAcres); if (!(ac > 0)) ac = areaM2(hit.rings) / 4046.8564;
      if (ac > MAX_ACRES) { drop.parcelSize++; continue; }
      if ((pa.landUseDsc || '').trim() && NOT_RESIDENTIAL.test(pa.landUseDsc)) { drop.parcelUse++; continue; }
      const o = PLACEHOLDER && (pa.owner || '').trim() === PLACEHOLDER ? '' : [pa.owner, pa.owner2].filter(Boolean).join(' / ').trim();
      if (o && ORG.test(o)) { drop.parcelOrg++; continue; }
      acres = ac.toFixed(2); owner = o; parcel = pa.parcel_id ?? '';
      const m = (pa.ownerAdd || '').trim();
      if (m) {
        mail = [m, pa.ownAddCty, pa.ownAddStt, pa.ownAddZip].filter(Boolean).join(', '); limited = owner ? '' : 'no-owner-name';
        if (/\bP\s*O\s*BOX\b|\bPOBOX\b/i.test(m)) { knock = false; why = 'owner mails to a PO box'; }
        else {
          const sn = norm(situs).replace(/^\d+\s*/, ''), mn = norm(m).replace(/^\d+\s*/, '');
          knock = Boolean(houseNo(situs) && houseNo(situs) === houseNo(m) && sn && mn && (sn === mn || sn.startsWith(mn) || mn.startsWith(sn)));
          why = knock ? 'owner lives here' : norm(pa.ownAddCty) === norm(city) ? 'owner is local but lives elsewhere' : `owner is in ${(pa.ownAddCty || pa.ownAddStt || 'another area').trim()}`;
        }
      } else if (owner) { why = 'occupancy unknown: no mailing address on record'; limited = 'no-occupancy'; }
    }
  }
  rows.push([knock ? 'YES' : 'no — post', situs, city, zip, acres, owner, mail, why, parcel, a.Latitude.toFixed(6), a.Longitude.toFixed(6), limited]);
}
rows.sort((x, y) => x[1].replace(/^\d+\s*/, '').localeCompare(y[1].replace(/^\d+\s*/, '')) || (parseInt(x[1]) || 0) - (parseInt(y[1]) || 0));
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
writeFileSync(OUT, [['knock', 'address', 'city', 'zip', 'acres', 'owner', 'owner_mailing', 'why', 'parcel', 'lat', 'lon', 'limited'].join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n', 'utf8');
const by = (k) => rows.filter((r) => r[11] === k).length;
console.log(`  dropped: ${Object.entries(drop).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
console.log(`  homes: ${rows.length} (YES ${rows.filter((r) => r[0] === 'YES').length}; no owner on record ${by('no-owner')}, occupancy unknown ${by('no-occupancy')}${WITH_PARCELS ? `, in a parcel ${withParcel}` : ''}) -> ${OUT}`);
