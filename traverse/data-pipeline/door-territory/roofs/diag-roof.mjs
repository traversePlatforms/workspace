/* One door's roof, explained (2026-10-19, Matthew: "my roof scans are off on some properties", 3246 Lakefront Dr, Monument):
   its parcel, every Microsoft building outline near it with its size, and which one pickHouse() took as the house.
   Read-only.  node diag-roof.mjs <lat> <lon>  */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inRings, merc, loadBuildings, pickHouse } from '../tree-zones/zones.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TZ = join(HERE, '..', 'tree-zones');
const [lat, lon] = [+process.argv[2], +process.argv[3]];
const SQFT = 10.7639;
function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }
/* real ground area: Web Mercator stretches by 1/cos(lat) each way */
const sqftOf = (ring) => ringArea(ring.map(([lo, la]) => merc(lo, la))) * Math.cos(lat * Math.PI / 180) ** 2 * SQFT;

const url = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query?' + new URLSearchParams({
  f: 'json', geometry: lon + ',' + lat, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects',
  returnGeometry: 'true', outFields: 'OBJECTID', geometryPrecision: '7' });
const pj = await (await fetch(url)).json();
const lot = pj.features && pj.features[0] && pj.features[0].geometry.rings;
if (!lot) { console.log('no parcel at the point'); process.exit(0); }
console.log('parcel: ' + Math.round(sqftOf(lot[0])) + ' sq ft (' + (sqftOf(lot[0]) / 43560).toFixed(2) + ' acres)');
const d = 0.0012, bbox = [lon - d, lat - d, lon + d, lat + d];
const blds = await loadBuildings(join(TZ, 'buildings'), bbox);
const near = blds.filter((b) => Math.abs(b.c[0] - lon) < 0.0008 && Math.abs(b.c[1] - lat) < 0.0008)
  .map((b) => ({ sq: Math.round(sqftOf(b.ring)), onLot: inRings(b.c[0], b.c[1], lot), m: Math.round(Math.hypot((b.c[0] - lon) * 111320 * Math.cos(lat * Math.PI / 180), (b.c[1] - lat) * 111320)) }))
  .sort((a, b) => a.m - b.m);
console.log('Microsoft outlines within ~80 m (nearest first):');
for (const b of near.slice(0, 12)) console.log('  ' + String(b.sq).padStart(6) + ' sq ft  ' + String(b.m).padStart(3) + ' m from the door point  ' + (b.onLot ? 'ON THIS LOT' : ''));
const h = pickHouse(lot, blds);
console.log('picked as the house: ' + (h ? Math.round(sqftOf(h.ring)) + ' sq ft' : 'nothing'));

/* what the laser scan saw on the lot: roof-like cells (2.5 m+ above ground, single return) and the biggest connected patch */
const { heightGrid, PROJECT } = await import('../tree-zones/lidar.mjs');
const project = PROJECT[process.argv[4] || 'elpaso'];
const k = Math.cos(lat * Math.PI / 180), cell = 1 / k;
const lm = lot[0].map(([lo, la]) => merc(lo, la));
const xs = lm.map((p) => p[0]), ys = lm.map((p) => p[1]);
const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
const G = await heightGrid(project, box, cell, join(TZ, 'lidar-cache'));
const inLot = (c, r) => inRings(...[box[0] + (c + 0.5) * cell, box[3] - (r + 0.5) * cell], [lm]);
const roof = new Uint8Array(G.w * G.h);
let n = 0;
for (let r = 0; r < G.h; r++) for (let c = 0; c < G.w; c++) { const o = r * G.w + c; if (!Number.isNaN(G.hgt[o]) && G.hgt[o] >= 2.5 && G.multi[o] !== 1 && inLot(c, r)) { roof[o] = 1; n++; } }
let best = 0; const seen = new Uint8Array(G.w * G.h);
for (let o = 0; o < roof.length; o++) if (roof[o] && !seen[o]) { let size = 0; const st = [o]; seen[o] = 1;
  while (st.length) { const q = st.pop(); size++; const c = q % G.w, r = (q / G.w) | 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= G.w || rr >= G.h) continue; const qq = rr * G.w + cc; if (roof[qq] && !seen[qq]) { seen[qq] = 1; st.push(qq); } } }
  if (size > best) best = size; }
console.log('laser scan (' + project + '): roof-like ground on the lot ' + Math.round(n * SQFT) + ' sq ft; biggest single patch ' + Math.round(best * SQFT) + ' sq ft');
