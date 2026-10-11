// One property, before a site walk: the lot (state parcel layer) and the trees on it from the Meta + WRI 1 m canopy-height
// map (imagery 2018-2020): tree tops, their heights in feet, and the share of the lot under canopy. No owner fields are read.
//   node one-lot.mjs <lat> <lon>
import { PARCELS, json, chm, inRings, merc } from './zones.mjs';
const [lat, lon] = process.argv.slice(2).map(Number);
const j = await json(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326',
  spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID', geometryPrecision: '7' }));
const f = (j.features || [])[0]; if (!f) { console.log('no parcel at that point'); process.exit(1); }
const k = Math.cos(lat * Math.PI / 180);
const P = f.geometry.rings.map((r) => r.map(([lo, la]) => merc(lo, la)));
const xs = P.flat().map((p) => p[0]), ys = P.flat().map((p) => p[1]);
const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
let area = 0; for (const r of P) for (let i = 0, n = r.length; i < n; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % n]; area += x1 * y2 - x2 * y1; }
area = Math.abs(area / 2) * k * k;
const { im, origin, res } = await chm(lon, lat);
const c0 = Math.floor((bb[0] - origin[0]) / res[0]), c1 = Math.ceil((bb[2] - origin[0]) / res[0]);
const r0 = Math.floor((bb[3] - origin[1]) / res[1]), r1 = Math.ceil((bb[1] - origin[1]) / res[1]);
const HT = (await im.readRasters({ window: [c0, r0, c1, r1] }))[0], w = c1 - c0, hgt = r1 - r0;
const inside = (c, r) => inRings(origin[0] + (c + c0 + 0.5) * res[0], origin[1] + (r + r0 + 0.5) * res[1], P);
let n = 0, tall = 0; const tops = [];
for (let r = 0; r < hgt; r++) for (let c = 0; c < w; c++) {
  if (!inside(c, r)) continue; n++; const h = HT[r * w + c]; if (h >= 2) tall++;
  if (h < 6) continue;
  let top = true; for (let dr = -2; dr <= 2 && top; dr++) for (let dc = -2; dc <= 2; dc++) { if (!dr && !dc) continue; const v = HT[(r + dr) * w + (c + dc)]; if (v !== undefined && v > h) { top = false; break; } }
  if (top) tops.push(h * 3.281);
}
tops.sort((a, b) => b - a);
const pct = (p) => tops.length ? Math.round(tops[Math.min(tops.length - 1, Math.floor(p * tops.length))]) : null;
console.log(JSON.stringify({ lotAcres: +(area / 4046.86).toFixed(2), canopyShare: +(tall / n).toFixed(2), treeTops6mPlus: tops.length,
  tallestFt: tops.slice(0, 8).map(Math.round), medianFt: pct(0.5), bands: { under30: tops.filter((h) => h < 30).length, '30to60': tops.filter((h) => h >= 30 && h < 60).length, '60to80': tops.filter((h) => h >= 60 && h < 80).length, over80: tops.filter((h) => h >= 80).length } }));
