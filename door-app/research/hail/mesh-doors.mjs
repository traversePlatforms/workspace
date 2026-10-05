/* Read one MRMS MESH_Max_1440min file (GRIB2, PNG packing, template 5.41) with Node only, and sample the
   estimated hail size at each of our doors. Feasibility check for the roofing data, 2026-10-04. */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
const HERE = process.env.HAIL_DIR || '.';   /* where the downloaded files are */
const DATA = 'C:/Users/Surge Inc/Desktop/claude test 2/door-app/site/data/rounds';
const b = readFileSync(`${HERE}/${process.argv[2] || 'mesh.grib2'}`);
let p = 16, g = {}, png = null;
while (p < b.length - 4 && b.toString('ascii', p, p + 4) !== '7777') {
  const len = b.readUInt32BE(p), sec = b[p + 4];
  if (sec === 3) g = { nx: b.readUInt32BE(p + 30), ny: b.readUInt32BE(p + 34), lat1: b.readInt32BE(p + 46) / 1e6, lon1: b.readUInt32BE(p + 50) / 1e6, dx: b.readUInt32BE(p + 63) / 1e6, dy: b.readUInt32BE(p + 67) / 1e6 };
  if (sec === 5) { g.R = b.readFloatBE(p + 11); g.E = b.readInt16BE(p + 15); g.D = b.readInt16BE(p + 17); g.tmpl = b.readUInt16BE(p + 9); }
  if (sec === 7) png = b.subarray(p + 5, p + len);
  p += len;
}
if (g.tmpl !== 41) throw new Error('not PNG packing: 5.' + g.tmpl);
/* PNG: IHDR, IDATs, unfilter */
let q = 8, idat = [], w, h, depth, ctype;
while (q < png.length) {
  const L = png.readUInt32BE(q), t = png.toString('ascii', q + 4, q + 8), d = png.subarray(q + 8, q + 8 + L);
  if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ctype = d[9]; }
  if (t === 'IDAT') idat.push(d);
  q += 12 + L;
}
if (ctype !== 0 || depth !== 16) throw new Error(`png type ${ctype} depth ${depth}`);
const raw = inflateSync(Buffer.concat(idat)), bpp = 2, stride = w * bpp, img = Buffer.alloc(h * stride);
for (let y = 0; y < h; y++) {
  const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, row = y * stride, up = row - stride;
  for (let x = 0; x < stride; x++) {
    const a = x >= bpp ? img[row + x - bpp] : 0, c = y ? img[up + x] : 0, ul = (x >= bpp && y) ? img[up + x - bpp] : 0, v = raw[src + x];
    let o;
    if (f === 0) o = v; else if (f === 1) o = v + a; else if (f === 2) o = v + c; else if (f === 3) o = v + ((a + c) >> 1);
    else { const pp = a + c - ul, pa = Math.abs(pp - a), pb = Math.abs(pp - c), pc = Math.abs(pp - ul); o = v + (pa <= pb && pa <= pc ? a : pb <= pc ? c : ul); }
    img[row + x] = o & 255;
  }
}
const mm = (lat, lon) => {   /* value in mm, or null for no data */
  const r = Math.round((g.lat1 - lat) / g.dy), c = Math.round((lon + 360 - g.lon1) / g.dx);
  const X = img.readUInt16BE(r * stride + c * 2), v = (g.R + X * 2 ** g.E) / 10 ** g.D;
  return v < 0 ? null : v;
};
/* the doors */
const idx = JSON.parse(readFileSync(`${DATA}/index.json`, 'utf8'));
const keys = (idx.regions || idx).map((r) => r.key || r).filter((k) => typeof k === 'string');
const out = {}; let n = 0, nodata = 0, bins = { none: 0, '<1in': 0, '1-1.75in': 0, '1.75-2.5in': 0, '>=2.5in': 0 }, maxIn = 0;
for (const k of keys) {
  let d; try { d = JSON.parse(readFileSync(`${DATA}/${k}.json`, 'utf8')); } catch { continue; }
  const t = out[k] = { doors: 0, hit1: 0, max: 0 };
  for (const a of d.areas) for (const x of a.doors) {
    if (!x.lat) continue; n++; t.doors++;
    const v = mm(x.lat, x.lon); if (v === null) { nodata++; continue; }
    const inch = v / 25.4; maxIn = Math.max(maxIn, inch); t.max = Math.max(t.max, inch);
    bins[inch <= 0 ? 'none' : inch < 1 ? '<1in' : inch < 1.75 ? '1-1.75in' : inch < 2.5 ? '1.75-2.5in' : '>=2.5in']++;
    if (inch >= 1) t.hit1++;
  }
}
console.log(`grid ${g.nx}x${g.ny}, ${g.dx} deg; doors ${n}, no radar data at ${nodata}`);
console.log('estimated hail at the door:', bins, 'largest', maxIn.toFixed(2), 'in');
for (const [k, t] of Object.entries(out)) console.log('  ', k.padEnd(15), `${t.hit1} of ${t.doors} doors at 1 in or more; largest ${t.max.toFixed(2)} in`);
/* the ground reports that day, against the radar at the same spot */
const pts = (process.argv[3] || '').split(';').filter(Boolean).map((s) => s.split(',').map(Number));
for (const [lat, lon, rep] of pts) { const v = mm(lat, lon); console.log(`  report ${rep} in at ${lat},${lon}: radar ${v === null ? 'no data' : (v / 25.4).toFixed(2) + ' in'}`); }
/* sanity: the largest value near each big report, and in the whole country */
const around = (lat, lon, r) => { let best = -1, at = null; for (let a = lat - r; a <= lat + r; a += 0.01) for (let o = lon - r; o <= lon + r; o += 0.01) { const v = mm(a, o); if (v !== null && v > best) { best = v; at = [a.toFixed(2), o.toFixed(2)]; } } return [best, at]; };
for (const [lat, lon] of [[38.61, -104.46], [38.75, -104.54], [38.87, -104.66]]) { const [v, at] = around(lat, lon, 0.15); console.log(`  within ~15 km of ${lat},${lon}: largest ${(v / 25.4).toFixed(2)} in at ${at}`); }
let gmax = 0, gat = null, neg = {}; for (let r = 0; r < g.ny; r += 2) for (let c = 0; c < g.nx; c += 2) { const X = img.readUInt16BE(r * stride + c * 2), v = (g.R + X * 2 ** g.E) / 10 ** g.D; if (v < 0) neg[v] = (neg[v] || 0) + 1; else if (v > gmax) { gmax = v; gat = [(g.lat1 - r * g.dy).toFixed(2), (g.lon1 - 360 + c * g.dx).toFixed(2)]; } }
console.log(`  whole grid: largest ${gmax} mm (${(gmax / 25.4).toFixed(2)} in) at ${gat}; negative codes`, neg);
