/* DRCOG's 2020 land cover (1 ft; Planetary Computer collection drcog-lulc) on the lots measured by hand (2026-10-21, Matthew: "Could you use
   it against the measurements we took by hand when we started and by the one jen just took"). Counts each class inside the lot line:
   1 structures, 2 impervious, 3 water, 4 prairie/grassland, 5 tree canopy, 6 turf/irrigated, 7 barren, 8 cropland. Licence: DRCOG's legal
   terms (drcog.org/legal-terms), checked before any use in the app; this is a trial. Run: node lulc-trial.mjs */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { readFileSync } from 'node:fs';
const DATA = 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/app/data/rounds';
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
proj4.defs('EPSG:6428', '+proj=lcc +lat_0=37.8333333333333 +lon_0=-105.5 +lat_1=39.75 +lat_2=38.45 +x_0=914401.828803658 +y_0=304800.609601219 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs');   /* NAD83(2011) Colorado Central, US feet */
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);
const get = async (u, o) => (await fetch(u, o)).json();
const inRings = (x, y, rr) => { let ins = false; for (const ring of rr) for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[k]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
const LOTS = [['11663 SETTLERS DR', 'parker', 10473, 'Jen, Google Earth, Oct 2026'], ['2787 RUSSET SKY CT', 'castle-rock', 3898, 'Matthew, Google Maps, Oct 2026'], ['1648 MARSH HAWK CIR', 'castle-rock', 2344, 'Matthew'], ['7378 UPTON CT', 'franktown', 2595, 'Matthew (watered lawn only)'], ['9554 PENSTEMON CT', 'black-forest', 5746, 'Matthew (upper bound)']];
const tok = (await get('https://planetarycomputer.microsoft.com/api/sas/v1/token/drcog-lulc')).token;
const NAME = { 1: 'roofs', 2: 'paved', 3: 'water', 4: 'grassland', 5: 'trees', 6: 'turf', 7: 'barren', 8: 'crop' };
for (const [addr, town, hand, who] of LOTS) {
  const d = JSON.parse(readFileSync(`${DATA}/${town}.json`, 'utf8')).areas.flatMap((a) => a.doors).find((x) => x.address === addr);
  if (!d) { console.log(addr, 'not found'); continue; }
  const st = await get('https://planetarycomputer.microsoft.com/api/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['drcog-lulc'], intersects: { type: 'Point', coordinates: [d.lon, d.lat] }, limit: 10 }) });
  const items = (st.features || []).sort((a, b) => String(b.properties.datetime || b.properties.start_datetime || '').localeCompare(String(a.properties.datetime || a.properties.start_datetime || '')));
  if (!items.length) { console.log(addr.padEnd(22), 'hand', hand, '| not covered by the DRCOG land cover'); continue; }
  const it = items[0], asset = Object.values(it.assets).find((a) => /tif/.test(a.type || '') || /\.tif/.test(a.href));
  const im = await (await fromUrl(asset.href + '?' + tok)).getImage();
  const epsg = 'EPSG:' + (im.geoKeys.ProjectedCSTypeGeoKey || 0), origin = im.getOrigin(), res = im.getResolution();
  if (!proj4.defs(epsg)) { console.log(addr, 'unknown projection', epsg); continue; }
  const pq = await get(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${d.lon},${d.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID' }));
  const rings = pq.features[0].geometry.rings;
  const px = rings.map((r) => r.map(([lo, la]) => { const [X, Y] = proj4('EPSG:4326', epsg, [lo, la]); return [(X - origin[0]) / res[0], (Y - origin[1]) / res[1]]; }));
  const xs = px.flat().map((p) => p[0]), ys = px.flat().map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - 2, y0 = Math.floor(Math.min(...ys)) - 2, x1 = Math.ceil(Math.max(...xs)) + 2, y1 = Math.ceil(Math.max(...ys)) + 2;
  const [C] = await im.readRasters({ window: [x0, y0, x1, y1] });
  const w = x1 - x0, h = y1 - y0, local = px.map((r) => r.map(([a, b]) => [a - x0, b - y0]));
  const cnt = {}; let inside = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!inRings(x + 0.5, y + 0.5, local)) continue; inside++; const c = C[y * w + x]; cnt[c] = (cnt[c] || 0) + 1; }
  const unitM = epsg === 'EPSG:6428' ? 1200 / 3937 : 1;   /* US survey feet */
  const m2 = Math.abs(res[0] * res[1]) * unitM * unitM, sf = (n) => Math.round((n || 0) * m2 * 10.7639);
  const parts = Object.keys(NAME).map((k) => NAME[k] + ' ' + sf(cnt[k])).join(' · ');
  console.log(addr.padEnd(22), '| hand', hand, '(' + who + ') | lot', sf(inside), '| TURF', sf(cnt[6]), '| turf+grassland', sf((cnt[6] || 0) + (cnt[4] || 0)), '| turf+grass+trees', sf((cnt[6] || 0) + (cnt[4] || 0) + (cnt[5] || 0)), '|', parts, '| item', it.id, '| px', res[0].toFixed(3), unitM === 1 ? 'm' : 'ft');
}
