/* Teller County laser scans -> height grids (2026-10-08).

   Woodland Park, Divide, Florissant and Cripple Creek had no laser scan when the roof and solar figures were built: the
   cloud copy lidar.mjs reads (usgs-lidar-public) has none for Teller. USGS has since published CO_CONMGaps_D24 and
   CO_ArapahoRooseveltPikeNF_D23, but only as LAZ files (fetch-teller.sh downloads them). Each is a 1 km square in UTM
   zone 13N (NAD83(2011), metres) with 20 to 26 million points, so this streams it point by point and keeps only what
   lidar.mjs heightGrid needs, on a 0.6 m Web Mercator raster:
     top    the highest return that is not noise or water (classes 7, 9, 18 and withheld points left out)
     gnd    the lowest ground return (class 2)
     multi  1 where a non-ground, non-building return came from a pulse that split (canopy does that; a roof does not)
   Unlike the cloud surveys, these classify buildings (class 6). They count toward top, as the unclassified roofs of the
   other surveys do, so the roof and solar builds measure Teller roofs the same way; they never set multi.

   UTM to Web Mercator: each tile's four corners go through proj4 and the points in between are placed bilinearly (a
   1 km square is flat enough that this is millimetres off). The survey year comes from the points' GPS times.

   Out: lidar-cache/teller-grid/<tile>.grid, and index.json listing each grid's box and year (lidar.mjs reads both).
     node teller-grids.mjs        converts every downloaded tile that has no grid yet */
import { createLazPerf } from 'laz-perf';
import { Las } from 'copc';
import proj4 from './node_modules/proj4/dist/proj4-src.js';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'lidar-cache', 'teller-laz'), OUT = join(HERE, 'lidar-cache', 'teller-grid');
const R = 0.6;                       /* raster cell, Web Mercator units (about 0.47 m on the ground at 39 degrees) */
const NONE = 0xffff;                 /* no return in the cell */
const SKIP = new Set([7, 9, 18]);
proj4.defs('UTM13N', '+proj=utm +zone=13 +ellps=GRS80 +towgs84=0,0,0 +units=m +no_defs');
mkdirSync(OUT, { recursive: true });

const lp = await createLazPerf();
const idxF = join(OUT, 'index.json');
const index = existsSync(idxF) ? JSON.parse(readFileSync(idxF, 'utf8')) : {};
/* ONLY=<tile name> converts that one tile: the decoder's memory never shrinks, so a long run of big tiles ends in an uncatchable
   out-of-memory abort; one process per tile avoids it (2026-10-09; see teller-grids-each.sh) */
const files = readdirSync(SRC).filter((f) => f.endsWith('.laz') && (!process.env.ONLY || f === process.env.ONLY + '.laz')).sort();
let done = 0;
for (const f of files) {
  const name = f.replace(/\.laz$/, '');
  if (index[name] && existsSync(join(OUT, name + '.grid'))) continue;
  const t0 = Date.now(), buf = readFileSync(join(SRC, f)), h = Las.Header.parse(buf.subarray(0, 375));
  const [sx, sy, sz] = h.scale, [ox, oy, oz] = h.offset, [minX, minY, minZ] = h.min, [maxX, maxY, maxZ] = h.max;
  /* the tile's corners in Web Mercator, and the raster that covers them */
  const C = [[minX, minY], [maxX, minY], [minX, maxY], [maxX, maxY]].map((p) => proj4('UTM13N', 'EPSG:3857', p));
  const x0 = Math.min(...C.map((p) => p[0])), x1 = Math.max(...C.map((p) => p[0])), y0 = Math.min(...C.map((p) => p[1])), y1 = Math.max(...C.map((p) => p[1]));
  const w = Math.ceil((x1 - x0) / R), hh = Math.ceil((y1 - y0) / R);
  if (maxZ - minZ > 650) throw new Error(f + ': height range too big for centimetre grids');
  const top = new Uint16Array(w * hh).fill(NONE), gnd = new Uint16Array(w * hh).fill(NONE), multi = new Uint8Array(w * hh);
  const zb = Math.floor(minZ);
  const ptr = lp._malloc(buf.length); lp.HEAPU8.set(buf, ptr);
  const zip = new lp.LASZip(); zip.open(ptr, buf.length);
  const n = zip.getCount(), plen = zip.getPointLength(), pp = lp._malloc(plen);
  let dv = new DataView(lp.HEAPU8.buffer);   /* remade when the decoder's memory grows: the old buffer is then detached (2026-10-09) */
  const du = maxX - minX, dvv = maxY - minY;
  const gps = [];
  for (let i = 0; i < n; i++) {
    zip.getPoint(pp);
    if (dv.buffer !== lp.HEAPU8.buffer) dv = new DataView(lp.HEAPU8.buffer);
    const cls = lp.HEAPU8[pp + 16];
    if (SKIP.has(cls) || (lp.HEAPU8[pp + 15] & 4)) continue;   /* noise, water, withheld (flag bit 2) */
    const X = dv.getInt32(pp, true) * sx + ox, Y = dv.getInt32(pp + 4, true) * sy + oy, Z = dv.getInt32(pp + 8, true) * sz + oz;
    const u = (X - minX) / du, v = (Y - minY) / dvv;
    const mx = (1 - u) * (1 - v) * C[0][0] + u * (1 - v) * C[1][0] + (1 - u) * v * C[2][0] + u * v * C[3][0];
    const my = (1 - u) * (1 - v) * C[0][1] + u * (1 - v) * C[1][1] + (1 - u) * v * C[2][1] + u * v * C[3][1];
    const c = Math.floor((mx - x0) / R), r = Math.floor((y1 - my) / R);
    if (c < 0 || r < 0 || c >= w || r >= hh) continue;
    const o = r * w + c, zc = Math.round((Z - zb) * 100);
    if (top[o] === NONE || zc > top[o]) top[o] = zc;
    if (cls === 2) { if (gnd[o] === NONE || zc < gnd[o]) gnd[o] = zc; }
    else if (cls !== 6 && (lp.HEAPU8[pp + 14] >> 4) > 1) multi[o] = 1;
    if (i % 200003 === 0) gps.push(dv.getFloat64(pp + 22, true));
  }
  lp._free(pp); lp._free(ptr); if (zip.delete) zip.delete();
  /* adjusted GPS time is GPS seconds minus 1e9, counted from 6 January 1980 */
  gps.sort((a, b) => a - b);
  const yr = gps.length ? new Date(Date.UTC(1980, 0, 6) + (gps[gps.length >> 1] + 1e9) * 1000).getUTCFullYear() : null;
  /* .grid: a JSON header line, then top, gnd (Uint16, centimetres above zb) and multi (Uint8) */
  const head = Buffer.from(JSON.stringify({ x0, y1, R, w, h: hh, zb, yr }) + '\n');
  const body = Buffer.concat([head, Buffer.from(top.buffer), Buffer.from(gnd.buffer), Buffer.from(multi.buffer)]);
  writeFileSync(join(OUT, name + '.grid.tmp'), body); renameSync(join(OUT, name + '.grid.tmp'), join(OUT, name + '.grid'));
  index[name] = { box: [x0, y0, x1, y1], yr };
  writeFileSync(idxF, JSON.stringify(index));
  done++;
  console.log(`${name}: ${n.toLocaleString('en-US')} points, ${yr}, ${w}x${hh} grid, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
console.log(`${done} converted, ${Object.keys(index).length} grids in all`);
