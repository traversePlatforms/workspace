/* Sixfold — mailing list of owners who do NOT live at the property. 2026-10-03.

   The walk lists keep only owner-occupied doors and mark the rest "no — post". This turns
   those rows into a mailing list: landlords, second-home owners, investors, family trusts
   holding a house for someone else. They are reached by letter, not by knocking.

   Input:  the 11 town CSVs written by build-walklist.mjs / build-walklist-co.mjs.
   Output (in ./mail/):
     mail-recipients.csv   one row per MAILING ADDRESS: one letter, however many properties
     mail-properties.csv   one row per property, with the recipient it belongs to
     communities.csv       parcels owned by HOAs / property owners' associations / metro
                           districts: common land, a different pitch, kept apart
     summary.json          the counts MAIL-LIST.md quotes

   ⚑ EL PASO'S PARCEL LAYER HAS NO PROPERTY ADDRESS. Its CSV "address" column holds the
   owner's MAILING street, which is right for a resident and wrong for everyone here. So
   El Paso properties get theirs from the state address-point layer, matched by point-in-
   parcel (see the measured note at that step). Cached in .situs-cache.json, asked once.

   Wildfire hazard is sampled for every property not already in wildfire-cache.json
   (same service and cache as sample-wildfire.mjs).

   Run:  node build-mail-list.mjs                                                            */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'mail');
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; Sixfold mailing-list builder)' };
const TOWNS = { monument: 'El Paso', 'palmer-lake': 'El Paso', 'black-forest': 'El Paso',
  'castle-rock': 'Douglas', larkspur: 'Douglas', sedalia: 'Douglas', franktown: 'Douglas',
  'woodland-park': 'Teller', divide: 'Teller', florissant: 'Teller', 'cripple-creek': 'Teller' };
const REVERSE = 'https://gisservices.elpasoco.com/arcgis2/rest/services/Public/Composite_Locator_Pro/GeocodeServer/reverseGeocode';
const WHP = 'https://imagery.geoplatform.gov/iipp/rest/services/Fire_Aviation/USFS_EDW_RMRS_WildfireHazardPotentialClassified/ImageServer/getSamples';
const FIRE = { 1: 'very low', 2: 'low', 3: 'moderate', 4: 'high', 5: 'very high', 6: 'not rated', 7: 'water' };

/* ---- read the CSVs ------------------------------------------------------- */
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...body] = rows;
  return body.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}

/* ---- who owns it --------------------------------------------------------- */
/* Order matters: "SMITH FAMILY TRUST" is a trust, "TRUST COMPANY OF AMERICA" is a company. */
const OWNER_TYPES = [
  /* a bank's legal name ends 'National Association': it is a lender, not an HOA */
  ['company', /\b(BANK|NATIONAL ASSOCIATION|SAVINGS|CREDIT UNION|FEDERAL HOME LOAN|FANNIE MAE|FREDDIE MAC)\b/],
  ['government', /\b(TOWN OF|CITY OF|COUNTY OF|COUNTY|STATE OF|STATE BOARD|UNITED STATES|USA\b|BOARD OF|SCHOOL DIST|SCHOOL DISTRICT|WATER (AND|&) SANITATION|SANITATION DIST|FIRE (PROTECTION )?DIST|WATER DIST|HEALTH SERVICE DISTRICT|LIBRARY|HOUSING AUTHORITY|DEPT OF|DEPARTMENT OF|REGIONAL BUILDING)\b/],
  ['community', /\b(HOMEOWNERS?|HOME OWNERS?|OWNERS ASS|OWNERS ASSN|PROPERTY OWNERS|ASSOCIATION|ASSN|HOA|POA|METROPOLITAN DIST|METRO DIST|MASTER ASSOC|COMMUNITY ASSOC|CIVIC ASSOC|IMPROVEMENT ASSOC|LAKE ASSOC)\b/],
  ['church / nonprofit', /\b(CHURCH|PARISH|MINISTR|DIOCESE|CONGREGATION|BIBLE|FELLOWSHIP|TEMPLE|FOUNDATION|SOCIETY|CAMP|SCOUTS|YMCA|CONSERVANCY|LAND TRUST)\b/],
  ['trust', /\b(TRUST|TRUSTEE|TRUSTEES|TR|LIVING TR|REV TR|REVOCABLE|IRREVOCABLE|ESTATE OF)\b/],
  ['company', /\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|CO\b|COMPANY|LP|LLP|LTD|PARTNERS|PARTNERSHIP|HOLDINGS|PROPERTIES|INVESTMENTS?|ENTERPRISES|VENTURES|GROUP|CAPITAL|REALTY|HOMES|BUILDERS|DEVELOPMENT|MANAGEMENT|RENTALS?|BANK|MORTGAGE|FUND)\b/],
];
const ownerType = (name) => { const n = ` ${name.toUpperCase().replace(/[^A-Z0-9& ]/g, ' ')} `; for (const [t, re] of OWNER_TYPES) if (re.test(n)) return t; return 'person'; };

/* ---- where the owner is -------------------------------------------------- */
const stateOf = (mail) => { const m = mail.toUpperCase().match(/,\s*([A-Z]{2})\s*,\s*\d{5}/); return m ? m[1] : ''; };
function whereOwner(why, mail) {
  if (/PO box/i.test(why)) return 'PO box';
  const st = stateOf(mail);
  if (st && st !== 'CO') return 'out of state';
  const mi = why.match(/lives ([\d.]+) mi away/);
  if (mi) return Number(mi[1]) <= 0.3 ? 'very close (may live on the lot)' : 'elsewhere in Colorado';
  if (/local but lives elsewhere/.test(why)) return 'elsewhere in Colorado';
  if (/would not geocode/.test(why)) return 'unknown';
  return 'elsewhere in Colorado';
}

/* ---- mailing address, tidied --------------------------------------------- */
/* "2107 ABIGAIL LN, CASTLE ROCK, CO, 801047959" -> street / city / state / zip (ZIP+4 hyphenated) */
function splitMail(mail) {
  const parts = mail.split(',').map((s) => s.trim()).filter(Boolean);
  let zip = '', state = '', city = '';
  if (parts.length && /^\d{5}(-?\d{4})?$/.test(parts[parts.length - 1].replace(/\s/g, ''))) zip = parts.pop().replace(/\s/g, '');
  if (parts.length && /^[A-Z]{2}$/i.test(parts[parts.length - 1])) state = parts.pop().toUpperCase();
  if (parts.length > 1) city = parts.pop();
  if (/^\d{9}$/.test(zip)) zip = zip.endsWith('0000') ? zip.slice(0, 5) : `${zip.slice(0, 5)}-${zip.slice(5)}`;
  return { street: parts.join(', '), city, state, zip };
}
const mailKey = (m) => `${m.street} ${m.zip.slice(0, 5)}`.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\b(ROAD|RD|STREET|ST|AVENUE|AVE|DRIVE|DR|LANE|LN|COURT|CT|CIRCLE|CIR|PLACE|PL|TRAIL|TRL|WAY|BOULEVARD|BLVD|PARKWAY|PKWY|HIGHWAY|HWY|NORTH|SOUTH|EAST|WEST|N|S|E|W|UNIT|APT|STE|SUITE)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

/* ---- gather -------------------------------------------------------------- */
const props = [];
let residents = 0;
for (const [town, county] of Object.entries(TOWNS)) {
  const p = join(HERE, `${town}.csv`);
  if (!existsSync(p)) { console.log(`  ${town}: no CSV, skipped`); continue; }
  for (const r of parseCSV(readFileSync(p, 'utf8'))) {
    if (r.knock === 'YES') { residents++; continue; }
    props.push({
      town, county, parcel: r.parcel, acres: Number(r.acres), lat: Number(r.lat), lon: Number(r.lon),
      owner: r.owner.trim(), type: ownerType(r.owner), mailRaw: r.owner_mailing.trim(), why: r.why,
      where: whereOwner(r.why, r.owner_mailing),
      /* Douglas/Teller: the CSV address IS the property. El Paso: filled below. */
      situs: county === 'El Paso' ? '' : [r.address, r.city, 'CO', r.zip].filter(Boolean).join(', '), situsQ: county === 'El Paso' ? '' : 'county record',
    });
  }
}
/* neighbouring towns' search circles overlap, so one parcel can sit in two CSVs: keep it once */
{ const seen = new Set(); const before = props.length; for (let i = props.length - 1; i >= 0; i--) { const k = `${props[i].county}|${props[i].parcel}`; if (seen.has(k)) props.splice(i, 1); else seen.add(k); } console.log(`  ${before - props.length} parcels listed under two towns, kept once`); }
console.log(`${props.length} non-resident properties across ${Object.keys(TOWNS).length} towns (${residents} owner-occupied doors are the walk lists)`);

/* ---- El Paso: the property address --------------------------------------

   ⚑ MEASURED 2026-10-03, against 219 owner-occupied El Paso doors whose address is known:
   the county locator's reverse geocode got the house number right on 6 of 7 "Parcel" hits
   but only 18 of 212 "StreetAddress" hits (167 right street wrong number, 27 wrong street).
   Street-range interpolation is useless for a letter. So the primary source is the STATE
   address-point layer (Colorado_Public_Addresses, 342,821 El Paso points, no parcel ids),
   joined by point-in-parcel against the county's own parcel polygons. The reverse geocode
   is kept only as the fallback where it returns a parcel point.                          */
const ADDR = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Addresses/FeatureServer/0/query';
const PARCELS = 'https://gisservices.elpasoco.com/arcgis2/rest/services/Public/MailingLabelParcels/MapServer/0/query';
const getJSON = async (url, body) => {
  for (let t = 1; t <= 4; t++) {
    try { const r = await fetch(url, body ? { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body } : { headers: UA }); const j = await r.json(); if (!j.error) return j; if (t === 4) throw new Error(JSON.stringify(j.error).slice(0, 160)); }
    catch (e) { if (t === 4) throw e; }
    await new Promise((r) => setTimeout(r, 800 * t));
  }
};
const inRing = (x, y, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inRings = (x, y, rings) => rings.reduce((c, r) => (inRing(x, y, r) ? !c : c), false);   /* holes flip it back */

const SCACHE = join(HERE, '.situs-cache.json');
const scache = existsSync(SCACHE) ? JSON.parse(readFileSync(SCACHE, 'utf8')) : {};
const ep = props.filter((p) => p.county === 'El Paso');
const need = ep.filter((p) => !scache[`pip:${p.parcel}`]);
console.log(`El Paso property addresses: ${ep.length - need.length} cached, ${need.length} to match`);
if (need.length) {
  /* 1. parcel polygons, 100 ids a request */
  const rings = new Map();
  for (let i = 0; i < need.length; i += 100) {
    const ids = need.slice(i, i + 100).map((p) => `'${p.parcel}'`).join(',');
    const j = await getJSON(PARCELS, new URLSearchParams({ f: 'json', where: `PARCEL IN (${ids})`, outFields: 'PARCEL', returnGeometry: 'true', outSR: '4326' }));
    for (const f of j.features || []) if (f.geometry?.rings) rings.set(f.attributes.PARCEL, f.geometry.rings);
    process.stdout.write(`\r  parcel outlines ${rings.size}`);
  }
  /* 2. address points over the same ground, paged */
  const bb = [Math.min(...need.map((p) => p.lon)) - 0.01, Math.min(...need.map((p) => p.lat)) - 0.01, Math.max(...need.map((p) => p.lon)) + 0.01, Math.max(...need.map((p) => p.lat)) + 0.01];
  const pts = []; let off = 0;
  for (;;) {
    const j = await getJSON(ADDR, new URLSearchParams({ f: 'json', where: "County='El Paso'", geometry: bb.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'AddrFull,Unit,PlaceName,Zipcode', returnGeometry: 'true', resultOffset: String(off), resultRecordCount: '2000' }));
    const got = j.features || []; for (const f of got) pts.push({ x: f.geometry.x, y: f.geometry.y, a: f.attributes });
    process.stdout.write(`\r  parcel outlines ${rings.size} · address points ${pts.length}`);
    if (got.length < 2000) break; off += got.length;
  }
  console.log('');
  const cell = 0.002, grid = new Map(); for (const q of pts) { const k = `${Math.floor(q.x / cell)},${Math.floor(q.y / cell)}`; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(q); }
  /* 3. point in parcel; several points = pick the one with no unit, nearest the centroid */
  for (const p of need) {
    const rs = rings.get(p.parcel); if (!rs) { scache[`pip:${p.parcel}`] = { none: 'no outline' }; continue; }
    const xs = rs.flat().map((v) => v[0]), ys = rs.flat().map((v) => v[1]);
    const hits = [];
    for (let gx = Math.floor(Math.min(...xs) / cell); gx <= Math.floor(Math.max(...xs) / cell); gx++) for (let gy = Math.floor(Math.min(...ys) / cell); gy <= Math.floor(Math.max(...ys) / cell); gy++)
      for (const q of grid.get(`${gx},${gy}`) || []) if (inRings(q.x, q.y, rs)) hits.push(q);
    if (!hits.length) { scache[`pip:${p.parcel}`] = { none: 'no address point on the lot' }; continue; }
    hits.sort((a, b) => (a.a.Unit ? 1 : 0) - (b.a.Unit ? 1 : 0) || Math.hypot(a.x - p.lon, a.y - p.lat) - Math.hypot(b.x - p.lon, b.y - p.lat));
    const h = hits[0].a;
    scache[`pip:${p.parcel}`] = { a: h.AddrFull, c: h.PlaceName || '', z: h.Zipcode || '', n: new Set(hits.map((q) => q.a.AddrFull)).size };
  }
  writeFileSync(SCACHE, JSON.stringify(scache));
}
/* fallback: the county locator, only where it answers with its own parcel point */
const fb = ep.filter((p) => scache[`pip:${p.parcel}`]?.none && scache[`rev:${p.lat},${p.lon}`] === undefined);
let k = 0;
async function revWorker() {
  for (;;) {
    const p = fb[k++]; if (!p) return;
    try {
      const j = await getJSON(`${REVERSE}?f=json&outSR=4326&distance=60&location=${p.lon},${p.lat}`);
      const a = j.address; scache[`rev:${p.lat},${p.lon}`] = a && a.Addr_type === 'Parcel' && a.Address ? { a: a.Address, c: a.City || '', z: a.Postal || '' } : null;
    } catch { /* asked again next run */ }
  }
}
await Promise.all(Array.from({ length: 4 }, revWorker));
writeFileSync(SCACHE, JSON.stringify(scache));
for (const p of ep) {
  const s = scache[`pip:${p.parcel}`], r = scache[`rev:${p.lat},${p.lon}`];
  if (s && s.a) { p.situs = [s.a, s.c, 'CO', s.z].filter(Boolean).join(', '); p.situsQ = s.n > 1 ? `state address point (lot has ${s.n})` : 'state address point'; }
  else if (r) { p.situs = [r.a, r.c, 'CO', r.z].filter(Boolean).join(', '); p.situsQ = 'county parcel point'; }
  else { p.situs = ''; p.situsQ = s?.none || 'not found'; }
}


/* ---- wildfire hazard ----------------------------------------------------- */
const WCACHE = join(HERE, 'wildfire-cache.json');
const wcache = existsSync(WCACHE) ? JSON.parse(readFileSync(WCACHE, 'utf8')) : {};
const wtodo = [...new Set(props.map((p) => `${p.lat},${p.lon}`))].filter((c) => wcache[c] === undefined);
console.log(`wildfire hazard: ${wtodo.length} new coordinates to sample`);
for (let i = 0; i < wtodo.length; i += 400) {
  const chunk = wtodo.slice(i, i + 400);
  const pts = chunk.map((c) => { const [la, lo] = c.split(',').map(Number); return [lo, la]; });
  const body = new URLSearchParams({ f: 'json', geometryType: 'esriGeometryMultipoint',
    geometry: JSON.stringify({ points: pts, spatialReference: { wkid: 4326 } }), returnFirstValueOnly: 'true' });
  try {
    const j = await (await fetch(WHP, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body })).json();
    for (const s of j.samples || []) { const c = chunk[s.locationId]; const v = Number(String(s.value).split(' ')[0]); if (c !== undefined) wcache[c] = v >= 1 && v <= 7 ? v : null; }
  } catch (e) { console.log(`  ⚑ hazard batch failed: ${e.message}`); }
}
writeFileSync(WCACHE, JSON.stringify(wcache));
for (const p of props) { const v = wcache[`${p.lat},${p.lon}`]; p.fire = v ? FIRE[v] || '' : ''; p.fireN = v && v <= 5 ? v : 0; }

/* trees near the house, from tree-zones/sample-trees.mjs --mail (same thresholds as the door app) */
const TCACHE = join(HERE, 'tree-cache.json');
const tcache = existsSync(TCACHE) ? JSON.parse(readFileSync(TCACHE, 'utf8')) : {};
const TREE = ['', 'clear', 'some', 'heavy', 'against house'];
const treeN = (t) => (!t || t.err || typeof t.z2 !== 'number') ? 0 : (t.z1 >= 0.25 && t.z2 >= 0.25) ? 4 : t.z2 >= 0.35 ? 3 : t.z2 >= 0.10 ? 2 : 1;
for (const p of props) { const t = tcache[`${p.lat},${p.lon}`]; p.treeN = treeN(t); p.trees = TREE[p.treeN] + (p.treeN && t.src === 'canopy' ? ' (canopy map)' : ''); }

/* ---- split, group, write ------------------------------------------------- */
const communities = props.filter((p) => p.type === 'community');
const mailable = props.filter((p) => p.type !== 'government' && p.type !== 'community');
const dropped = props.length - communities.length - mailable.length;

const groups = new Map();
for (const p of mailable) {
  const m = splitMail(p.mailRaw);
  p.mail = m;
  const key = mailKey(m) || `?${p.parcel}`;
  p.key = key;
  if (!groups.has(key)) groups.set(key, { m, owners: new Set(), props: [] });
  const g = groups.get(key); g.owners.add(p.owner); g.props.push(p);
}
let id = 0;
const recipients = [...groups.values()].map((g) => {
  const ps = g.props.sort((a, b) => b.fireN - a.fireN || b.acres - a.acres);
  const types = [...new Set(ps.map((p) => p.type))];
  return {
    id: `M${String(++id).padStart(5, '0')}`, name: [...g.owners].join(' / '), ...g.m,
    type: types.length === 1 ? types[0] : types.join(' + '), where: ps[0].where,
    n: ps.length, acres: ps.reduce((s, p) => s + p.acres, 0), fire: ps[0].fire, fireN: ps[0].fireN, trees: TREE[Math.max(...ps.map((p) => p.treeN))],
    towns: [...new Set(ps.map((p) => p.town))].join('; '), props: ps,
  };
}).sort((a, b) => b.fireN - a.fireN || b.n - a.n || b.acres - a.acres);
for (const r of recipients) for (const p of r.props) p.rid = r.id;

mkdirSync(OUT, { recursive: true });
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = (head, rows) => [head.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n';
writeFileSync(join(OUT, 'mail-recipients.csv'), csv(
  ['id', 'name', 'mail_street', 'mail_city', 'mail_state', 'mail_zip', 'owner_type', 'where_owner_is', 'properties', 'total_acres', 'highest_fire_hazard', 'most_trees', 'towns', 'property_addresses'],
  recipients.map((r) => [r.id, r.name, r.street, r.city, r.state, r.zip, r.type, r.where, r.n, r.acres.toFixed(2), r.fire, r.trees, r.towns, r.props.map((p) => p.situs || `parcel ${p.parcel}`).join('; ')])));
writeFileSync(join(OUT, 'mail-properties.csv'), csv(
  ['recipient_id', 'property_address', 'address_source', 'town', 'county', 'acres', 'fire_hazard', 'trees_near_house', 'owner', 'owner_type', 'where_owner_is', 'parcel', 'lat', 'lon'],
  recipients.flatMap((r) => r.props.map((p) => [r.id, p.situs, p.situsQ, p.town, p.county, p.acres.toFixed(2), p.fire, p.trees, p.owner, p.type, p.where, p.parcel, p.lat, p.lon]))));
writeFileSync(join(OUT, 'communities.csv'), csv(
  ['owner', 'owner_mailing', 'property_address', 'town', 'county', 'acres', 'fire_hazard', 'parcel', 'lat', 'lon'],
  communities.sort((a, b) => a.owner.localeCompare(b.owner)).map((p) => [p.owner, p.mailRaw, p.situs, p.town, p.county, p.acres.toFixed(2), p.fire, p.parcel, p.lat, p.lon])));

const count = (arr, f) => arr.reduce((o, x) => { const k2 = f(x); o[k2] = (o[k2] || 0) + 1; return o; }, {});
const summary = {
  built: new Date().toISOString().slice(0, 10), nonResident: props.length, government: dropped,
  communityParcels: communities.length, communityOwners: new Set(communities.map((p) => p.owner)).size,
  mailableProperties: mailable.length, recipients: recipients.length,
  multiProperty: recipients.filter((r) => r.n > 1).length,
  byType: count(recipients, (r) => r.type), byWhere: count(recipients, (r) => r.where),
  byFire: count(recipients, (r) => r.fire || 'no reading'), byTrees: count(mailable, (p) => TREE[p.treeN] || 'no reading'), byTown: count(mailable, (p) => p.town),
  addressSource: count(mailable, (p) => p.situsQ.replace(/ \(lot has \d+\)/, ' (lot has several)')),
};
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
