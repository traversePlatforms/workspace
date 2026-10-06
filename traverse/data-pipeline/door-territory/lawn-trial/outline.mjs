/* The official lot line drawn over the 2023 photo — no lawn colouring, so a person
   measuring by hand isn't steered by the method's answer. Usage:
     ADDR="1648 MARSH HAWK CIR" TOWN=castle-rock node outline.mjs out.png */
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DATA = 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/app/data/rounds';
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);
const j = JSON.parse(readFileSync(`${DATA}/${process.env.TOWN}.json`, 'utf8'));
const d = j.areas.flatMap((a) => a.doors).find((x) => x.address === process.env.ADDR);
if (!d) throw new Error('door not found');
const get = async (u, o) => (await fetch(u, o)).json();
const pq = await get(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${d.lon},${d.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'situsAdd' }));
const rings = pq.features[0].geometry.rings;
const stac = await get('https://planetarycomputer.microsoft.com/api/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ collections: ['naip'], intersects: { type: 'Point', coordinates: [d.lon, d.lat] }, query: { 'naip:year': { eq: '2023' } }, limit: 3 }) });
const item = stac.features.sort((a, b) => a.properties.gsd - b.properties.gsd)[0];
const token = (await get('https://planetarycomputer.microsoft.com/api/sas/v1/token/naip')).token;
const im = await (await fromUrl(item.assets.image.href + '?' + token)).getImage();
const epsg = 'EPSG:' + im.geoKeys.ProjectedCSTypeGeoKey, origin = im.getOrigin(), res = im.getResolution();
const px = rings.map((r) => r.map(([lon, lat]) => { const [X, Y] = proj4('EPSG:4326', epsg, [lon, lat]); return [(X - origin[0]) / res[0], (Y - origin[1]) / res[1]]; }));
const xs = px.flat().map((p) => p[0]), ys = px.flat().map((p) => p[1]), pad = 45;
const x0 = Math.floor(Math.min(...xs)) - pad, y0 = Math.floor(Math.min(...ys)) - pad, x1 = Math.ceil(Math.max(...xs)) + pad, y1 = Math.ceil(Math.max(...ys)) + pad;
const [R, G, B] = await im.readRasters({ window: [x0, y0, x1, y1], interleave: false });
const w = x1 - x0, h = y1 - y0, S = 4, png = new PNG({ width: w * S, height: h * S + 70 });
for (let i = 0; i < png.data.length; i += 4) { png.data[i] = png.data[i + 1] = png.data[i + 2] = 255; png.data[i + 3] = 255; }
for (let y = 0; y < h * S; y++) for (let x = 0; x < w * S; x++) {
  const i = Math.floor(y / S) * w + Math.floor(x / S), o = (y * png.width + x) * 4;
  png.data[o] = R[i]; png.data[o + 1] = G[i]; png.data[o + 2] = B[i];
}
const dot = (x, y, c, r) => { for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const X = Math.round(x) + a, Y = Math.round(y) + b; if (X < 0 || Y < 0 || X >= png.width || Y >= png.height) continue; const o = (Y * png.width + X) * 4; png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; } };
const line = (a, b, c, r) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let k = 0; k <= n; k++) dot(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, c, r); };
for (const ring of px) for (let k = 0; k < ring.length - 1; k++) {
  const a = [(ring[k][0] - x0) * S, (ring[k][1] - y0) * S], b = [(ring[k + 1][0] - x0) * S, (ring[k + 1][1] - y0) * S];
  line(a, b, [0, 0, 0], 4); line(a, b, [255, 230, 0], 2);
}
/* scale bar: 30 ft, and a north tick */
const ftPx = 30 / 3.28084 / res[0] * S, by = h * S + 30;
line([20, by], [20 + ftPx, by], [20, 20, 20], 3); line([20, by - 10], [20, by + 10], [20, 20, 20], 2); line([20 + ftPx, by - 10], [20 + ftPx, by + 10], [20, 20, 20], 2);
writeFileSync(process.argv[2], PNG.sync.write(png));
console.log(`wrote ${process.argv[2]} — ${item.properties.datetime.slice(0, 10)} photo, north up; bar = 30 ft (${ftPx.toFixed(0)} px)`);
