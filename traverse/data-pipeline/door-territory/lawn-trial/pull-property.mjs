// One house pulled in on request (2026-10-16, Matthew: "build a one off search like we have for joe and just have it be a button
// they can press and you'll pull that data and measure the lawns"). Run by the app on the server (api/rounds.php, action proppull)
// for an address that is not on our lists; prints one JSON line and nothing else.
//   node pull-property.mjs --address "2707 S Osceola Way" --town "Denver"        (or --lat 39.66 --lon -105.03 with the address)
// The same sources and rules as the towns: the state parcel layer (lot, acres, owner, county value), the 2023 NAIP photo and the
// app's lawn classifier (lawn-mask.mjs, unchanged; the compact rule with no house outline: patches of 400 sq ft or more), the USFS
// wildfire hazard class. No house outline and no trees: those need the big building and LiDAR files the towns are built from.
import { measure, STAC, json, patches, compactSqFt } from './lawn-mask.mjs';
const A = {}; for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
const WHP = 'https://imagery.geoplatform.gov/iipp/rest/services/Fire_Aviation/USFS_EDW_RMRS_WildfireHazardPotentialClassified/ImageServer/getSamples';
const done = (o) => { process.stdout.write(JSON.stringify(o) + '\n'); process.exit(0); };
const norm = (s) => String(s || '').toUpperCase().replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
const slug = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);
try {
  const street = String(A.address || '').trim(), town = String(A.town || '').trim();
  if (!/^\d+\s+\S/.test(street)) done({ ok: false, error: 'Type the house number and the street.' });
  /* 1. where it is: the Census Bureau's geocoder, unless the point came with it */
  let lat = +A.lat, lon = +A.lon, matched = '';
  if (!(lat && lon)) {
    const g = await json('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?' + new URLSearchParams({ address: `${street}, ${town}, CO`, benchmark: 'Public_AR_Current', format: 'json' }));
    const m = (g.result && g.result.addressMatches || [])[0];
    if (m) { lon = m.coordinates.x; lat = m.coordinates.y; matched = m.matchedAddress || ''; }
  }
  if (!(lat && lon)) {   /* newer homes the Census does not know yet: the parcel map by its own address text (house number + street name) */
    const words = norm(street).split(' '), num0 = words[0];
    const name = words.slice(1).find((w) => !/^(N|S|E|W|NE|NW|SE|SW|NORTH|SOUTH|EAST|WEST)$/.test(w)) || words[1] || '';
    if (/^\d+$/.test(num0) && /^[A-Z0-9]+$/.test(name)) {
      const pj = await json(PARCELS + '?' + new URLSearchParams({ f: 'json', where: `UPPER(situsAdd) LIKE '${num0} %${name}%'`, outSR: '4326', returnGeometry: 'true', outFields: 'situsAdd,sitAddCty', resultRecordCount: '20' }));
      const cand = (pj.features || []).filter((f) => norm(f.attributes.situsAdd).startsWith(num0 + ' '));
      const T = norm(town), best = cand.find((f) => norm(f.attributes.sitAddCty || '') === T) || (cand.length === 1 ? cand[0] : null);
      if (best && best.geometry && best.geometry.rings) { const ring = best.geometry.rings[0]; lon = ring.reduce((s, p) => s + p[0], 0) / ring.length; lat = ring.reduce((s, p) => s + p[1], 0) / ring.length; matched = `${best.attributes.situsAdd}, ${best.attributes.sitAddCty || town}`; }
    }
  }
  if (!(lat && lon)) done({ ok: false, error: 'That address was not found. Check the street and the town.' });
  /* 2. the lot: the parcel at the point, else the nearest one nearby with the same house number */
  const q = (geom, type) => json(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: geom, geometryType: type, inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'situsAdd,landAcres,owner,apprValTot,subName', geometryPrecision: '7', resultRecordCount: '60' }));
  let P = ((await q(`${lon},${lat}`, 'esriGeometryPoint')).features || [])[0];
  const num = street.match(/^\d+/)[0];
  if (!P || !norm(P.attributes.situsAdd).startsWith(num + ' ')) {
    const near = ((await q([lon - 0.0006, lat - 0.0005, lon + 0.0006, lat + 0.0005].join(','), 'esriGeometryEnvelope')).features || []).filter((f) => norm(f.attributes.situsAdd).startsWith(num + ' '));
    if (near.length) P = near[0];
  }
  if (!P) done({ ok: false, error: 'No property record at that address (the state parcel map has none there).' });
  const at = P.attributes, rings = P.geometry.rings;
  /* 3. the lawn: the 2023 photo (2021 when 2023 does not cover it), the app's classifier */
  let item = null;
  for (const yr of ['2023', '2021']) {
    const st = await json(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], intersects: { type: 'Point', coordinates: [lon, lat] }, query: { 'naip:year': { eq: yr } }, limit: 10 }) });
    const f = (st.features || []).map((x) => ({ id: x.id, href: x.assets.image.href, date: x.properties.datetime.slice(0, 10), gsd: x.properties.gsd })).sort((a, b) => a.gsd - b.gsd)[0];
    if (f) { item = f; break; }
  }
  let lawn = null;
  if (item) {
    const m = await measure({ la: lat, lo: lon, detail: true }, rings, item);
    if (!m.err) {
      const s = m.s >= 1200 ? compactSqFt(patches(m.detail, null), false) : m.s;   /* the compact rule, as the towns: Medium and Large only */
      const lv = m.t > 0.6 && s < 1500 ? 'T' : s < 300 ? 'N' : s < 1200 ? 'S' : s < 3000 ? 'M' : 'L';
      lawn = { lv, sq: Math.round(s / 100) * 100, yr: +String(m.d).slice(0, 4) };
    }
  }
  /* 4. wildfire hazard (USFS WHP 2023): 1 very low .. 5 very high, 6 non-burnable, 7 water */
  let fire = null;
  try { const wj = await json(WHP + '?' + new URLSearchParams({ f: 'json', geometry: JSON.stringify({ points: [[lon, lat]], spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryMultipoint', returnFirstValueOnly: 'true' })); fire = wj.samples && wj.samples[0] ? +wj.samples[0].value : null; } catch {}
  const address = norm(at.situsAdd) || norm(street);
  done({ ok: true, door: { id: slug(address), address, acres: at.landAcres != null ? +(+at.landAcres).toFixed(2) : null, owner: String(at.owner || '').trim(), lat: +(+lat).toFixed(6), lon: +(+lon).toFixed(6), fire, lawn, trees: null, val: at.apprValTot > 0 ? Math.round(at.apprValTot) : null, town: town || (matched.split(',')[1] || '').trim(), sub: at.subName ? String(at.subName).trim() : null } });
} catch (e) { done({ ok: false, error: 'The lookup failed: ' + String(e.message || e).slice(0, 160) }); }
