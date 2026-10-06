/* Check pictures for the lawn-health trial (2026-10-03): a blind second opinion on the lawn
   outline. For a sample of large-lawn doors whose outline is already worked out, draws:
     check/NN-photo.png    the 2023 aerial photo of the lot, lot line in yellow, 10 m scale bar
     check/NN-outline.png  the same, plus the lawn the classifier found (magenta) and the 10 m
                           satellite pixels the trial uses (cyan squares, >= 30% lawn)
   The classifier's own numbers go to a SEPARATE answers file (argv[2]) so a reviewer can look
   at the photos first without seeing them.
   Run:  node render-check.mjs <answers.json> [count]                                       */
import { PNG } from 'pngjs';
import proj4 from 'proj4';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure, STAC, json } from './lawn-mask.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUNDS = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const OUT = join(HERE, 'check');
const ANSWERS = process.argv[2];
const COUNT = +(process.argv[3] || 12);
if (!ANSWERS) { console.error('usage: node render-check.mjs <answers.json> [count]'); process.exit(2); }
const PARCELS = 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0/query';
proj4.defs('EPSG:32613', '+proj=utm +zone=13 +datum=WGS84 +units=m +no_defs');
for (const z of [12, 13, 14]) proj4.defs('EPSG:269' + z, `+proj=utm +zone=${z} +datum=NAD83 +units=m +no_defs`);

/* the doors, by town/id, wherever they live now */
const doors = new Map();
for (const f of readdirSync(ROUNDS).filter((x) => x.endsWith('.json') && !['index.json', 'money.json'].includes(x)))
  for (const a of JSON.parse(readFileSync(join(ROUNDS, f), 'utf8')).areas) for (const d of a.doors) doors.set(d.id, { ...d, town: f.replace('.json', '') });

/* the sample: half the trial could read (>= 1 pixel-equivalent of lawn in pixels >= 30% lawn), half it rejected */
const masks = JSON.parse(readFileSync(join(HERE, 'lawnmask-cache.json'), 'utf8'));
const scored = Object.entries(masks).filter(([, m]) => !m.err).map(([k, m]) => {
  const used = m.px10.filter((p) => p[2] >= 0.3);
  return { k, id: k.split('/')[1], s: m.s, w: used.reduce((a, p) => a + p[2], 0), used: used.length, cells: m.px10.length };
}).filter((x) => doors.has(x.id));
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = (arr, n) => arr.sort((a, b) => hash(a.k) - hash(b.k)).slice(0, n);
/* PICK=<json [{id,lawnSqFt,compact}]>: draw these doors instead of sampling the trial's lawns */
const PICKED = process.env.PICK ? JSON.parse(readFileSync(process.env.PICK, 'utf8')) : null;
const sample = PICKED ? PICKED.map((p) => ({ k: 'pick/' + p.id, id: p.id, s: p.lawnSqFt, w: 0, used: 0, cells: 0 })) : [...pick(scored.filter((x) => x.w >= 1), Math.ceil(COUNT / 2)), ...pick(scored.filter((x) => x.w < 1), Math.floor(COUNT / 2))]
  .sort((a, b) => hash(a.k + 'order') - hash(b.k + 'order'));

mkdirSync(OUT, { recursive: true });
const answers = [];
let n = 0;
for (const x of sample) {
  const d = doors.get(x.id);
  n++;
  const tag = String(n).padStart(2, '0');
  const pj = await json(PARCELS + '?' + new URLSearchParams({ f: 'json', geometry: `${d.lon},${d.lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'true', outFields: 'OBJECTID' }));
  const rings = pj.features?.[0]?.geometry?.rings;
  const st = await json(STAC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collections: ['naip'], bbox: [d.lon - 0.0005, d.lat - 0.0005, d.lon + 0.0005, d.lat + 0.0005], query: { 'naip:year': { eq: '2023' } }, limit: 10 }) });
  const it = (st.features || []).map((f) => ({ id: f.id, href: f.assets.image.href, date: f.properties.datetime.slice(0, 10), bb: f.bbox, gsd: f.properties.gsd }))
    .filter((f) => d.lon >= f.bb[0] && d.lon <= f.bb[2] && d.lat >= f.bb[1] && d.lat <= f.bb[3]).sort((a, b) => a.gsd - b.gsd)[0];
  if (!rings || !it) { console.log(`${tag} ${x.id}: no ${!rings ? 'parcel' : 'photo'}, skipped`); continue; }
  const m = await measure({ la: d.lat, lo: d.lon, detail: true }, rings, it);
  if (m.err) { console.log(`${tag} ${x.id}: ${m.err}`); continue; }
  const D = m.detail, k = Math.max(1, Math.ceil(Math.max(D.w, D.h) / 700));
  const W = Math.floor(D.w / k), H = Math.floor(D.h / k);
  const mPerPx = D.res[0] * k;
  const draw = (withOutline) => {
    const png = new PNG({ width: W, height: H });
    const set = (x2, y2, r, g, b, a = 1) => { if (x2 < 0 || y2 < 0 || x2 >= W || y2 >= H) return; const i = (y2 * W + x2) * 4; png.data[i] = png.data[i] * (1 - a) + r * a; png.data[i + 1] = png.data[i + 1] * (1 - a) + g * a; png.data[i + 2] = png.data[i + 2] * (1 - a) + b * a; png.data[i + 3] = 255; };
    for (let y2 = 0; y2 < H; y2++) for (let x2 = 0; x2 < W; x2++) {
      let r = 0, g = 0, b = 0, lawn = 0, c = 0;
      for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) { const i = (y2 * k + dy) * D.w + (x2 * k + dx); r += D.R[i]; g += D.G[i]; b += D.B[i]; if (D.cls[i] === 2) lawn++; c++; }
      const i = (y2 * W + x2) * 4;
      png.data[i] = r / c; png.data[i + 1] = g / c; png.data[i + 2] = b / c; png.data[i + 3] = 255;
      if (withOutline && lawn / c >= 0.5) set(x2, y2, 230, 40, 200, 0.45);
    }
    const line = (ax, ay, bx, by, col, thick = 1) => {
      const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) || 1;
      for (let s2 = 0; s2 <= steps; s2++) { const px = Math.round(ax + ((bx - ax) * s2) / steps), py = Math.round(ay + ((by - ay) * s2) / steps);
        for (let t = -thick + 1; t < thick; t++) { set(px + t, py, ...col); set(px, py + t, ...col); } }
    };
    if (withOutline) for (const [gx, gy, f] of m.px10) {
      if (f < 0.3) continue;
      const corner = (cx, cy) => { const [X, Y] = proj4('EPSG:32613', D.epsg, [cx, cy]); return [((X - D.origin[0]) / D.res[0] - D.x0) / k, ((Y - D.origin[1]) / D.res[1] - D.y0) / k]; };
      const c = [corner(gx * 10, gy * 10), corner(gx * 10 + 10, gy * 10), corner(gx * 10 + 10, gy * 10 + 10), corner(gx * 10, gy * 10 + 10)];
      for (let j = 0; j < 4; j++) line(...c[j], ...c[(j + 1) % 4], [40, 230, 240], 1);
    }
    for (const ring of D.local) for (let j = 0; j < ring.length - 1; j++) line(ring[j][0] / k, ring[j][1] / k, ring[j + 1][0] / k, ring[j + 1][1] / k, [255, 220, 0], 2);
    const bar = Math.round(10 / mPerPx);   /* 10 m scale bar, bottom left */
    for (let t = 0; t < 4; t++) line(12, H - 14 + t, 12 + bar, H - 14 + t, [255, 255, 255], 1);
    line(12, H - 22, 12, H - 8, [255, 255, 255], 1); line(12 + bar, H - 22, 12 + bar, H - 8, [255, 255, 255], 1);
    return PNG.sync.write(png);
  };
  writeFileSync(join(OUT, `${tag}-photo.png`), draw(false));
  writeFileSync(join(OUT, `${tag}-outline.png`), draw(true));
  answers.push({ tag, door: x.k, address: d.address, town: d.town, photo: it.date, metresPerPixel: +mPerPx.toFixed(3),
    lotSqFt: m.lot, lawnSqFt: m.s, treeShareOfLot: m.t, lawnLevelInApp: d.lawn?.lv, cellsWithAnyLawn: x.cells, cellsUsed: x.used,
    lawnPixelEquivUsed: +x.w.toFixed(2), trialCanRead: x.w >= 1 });
  console.log(`${tag} ${d.address} (${d.town}): lawn ${m.s} sq ft, ${x.used} pixels used, ${x.w >= 1 ? 'readable' : 'rejected'}  ${W}x${H}`);
}
writeFileSync(ANSWERS, JSON.stringify(answers, null, 2));
console.log(`\n${answers.length} doors drawn into check/. Answers (keep away from the reviewer): ${ANSWERS}`);
