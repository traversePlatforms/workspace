/* Spot-check the roof photo for one door: read the same window the page will, write a PNG.
   node photo-check.mjs <town> [doorIndex] [outfile]   (writes beside this file; PNGs are gitignored with *.png? no: delete after looking) */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromUrl } from '../tree-zones/node_modules/geotiff/dist-node/geotiff.js';
const HERE = dirname(fileURLToPath(import.meta.url));
const [town = 'castle-rock', nth = '0', out = 'photo-check.png'] = process.argv.slice(2);
const P = JSON.parse(readFileSync(join(HERE, '..', '..', '..', 'app', 'data', 'rounds', `photo-${town}.json`), 'utf8'));
const [id, [file, px, py, R]] = Object.entries(P.doors)[+nth];

const t0 = Date.now();
const im = await (await fromUrl(P.base + file)).getImage(0);
const rgba = await im.readRasters({ window: [px - R, py - R, px + R, py + R], interleave: true });
const W = 2 * R, H = 2 * R;
console.log(id, file, px, py, `read ${rgba.length} values in ${Date.now() - t0} ms`);
/* minimal RGBA PNG */
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; for (let x = 0; x < W * 4; x++) raw[y * (W * 4 + 1) + 1 + x] = (x & 3) === 3 ? 255 : rgba[y * W * 4 + x]; }   /* band 4 is infrared, not transparency */
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(join(HERE, out), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('wrote', out);
