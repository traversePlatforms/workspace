/* Sharp roof photos for the Roofing preview (2026-10-05): the Denver Regional Aerial Photography Project 2020
 * 3-inch orthophotos, published by the State of Colorado (OIT GIS) on AWS Open Data, public domain (CC0):
 *   https://registry.opendata.aws/colorado-imagery/   s3://colorado-public-imagery/DRAPP/DRAPP2020/Imagery/  (5,462 files;
 *   the 3in_UTM/ subfolder is only a 5-file sample). Each file is a 10560 x 10560 GeoTIFF, 0.0762 m (3 in) pixels, UTM 13N,
 *   with a world file (.tfw) beside it, stored in 128 px blocks, so the page can read just the blocks over one
 * house (about 1 MB) straight from the bucket (it allows cross-site reads). Covers the DRCOG region: Douglas, not El Paso.
 *
 *   node photo-index.mjs index    reads every file's header (bounds) -> photo-index.json here
 *   node photo-index.mjs build    per door: which file and which pixel -> app/data/rounds/photo-<town>.json   */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromUrl } from '../tree-zones/node_modules/geotiff/dist-node/geotiff.js';
import proj4 from '../tree-zones/node_modules/proj4/dist/proj4-src.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', '..', '..', 'app', 'data', 'rounds');
const BUCKET = 'https://colorado-public-imagery.s3.us-west-2.amazonaws.com';
const PREFIX = 'DRAPP/DRAPP2020/Imagery/';
const SIZE = 10560;   /* every file (checked on samples) */
const MAIN = /^DRAPP\/DRAPP2020\/Imagery\/[NS]\d+[EW]\d+[a-d]\.tif$/;
const INDEX = join(HERE, 'photo-index.json');
proj4.defs('EPSG:6342', '+proj=utm +zone=13 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');   /* NAD83(2011) / UTM 13N */
const TOWNS = ['castle-rock', 'larkspur', 'sedalia', 'franktown', 'monument', 'palmer-lake', 'black-forest', 'highlands-ranch', 'parker', 'castle-pines', 'thornton', 'centennial', 'erie', 'commerce-city', 'denver'];   /* + the Front Range Roofing towns (2026-10-10) */

async function listKeys() {
  const keys = []; let token = '';
  for (;;) {
    const u = `${BUCKET}/?list-type=2&prefix=${encodeURIComponent(PREFIX)}&max-keys=1000${token ? '&continuation-token=' + encodeURIComponent(token) : ''}`;
    const x = await (await fetch(u)).text();
    for (const m of x.matchAll(/<Key>([^<]+\.tif)<\/Key>/g)) if (MAIN.test(m[1])) keys.push(m[1]);
    const t = /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(x);
    if (!t) break; token = t[1];
  }
  return keys;
}
async function index() {
  const have = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : {};
  const keys = (await listKeys()).filter((k) => !have[k.slice(PREFIX.length)]);
  console.log(`${keys.length} files to read (${Object.keys(have).length} already indexed)`);
  let i = 0, done = 0;
  const worker = async () => {
    for (;;) {
      const k = keys[i++]; if (!k) return;
      for (let t = 0; t < 3; t++) {
        try {
          /* the world file: pixel size, then the centre of the top-left pixel */
          const tfw = (await (await fetch(`${BUCKET}/${k.replace(/\.tif$/, '.tfw')}`)).text()).trim().split(/\s+/).map(Number);
          if (tfw.length < 6 || !(tfw[0] > 0)) throw new Error('no world file');
          const rx = tfw[0], x0 = tfw[4] - rx / 2, y1 = tfw[5] + rx / 2;
          have[k.slice(PREFIX.length)] = [x0, y1 - rx * SIZE, x0 + rx * SIZE, y1, rx, SIZE, SIZE, 128];   /* xmin, ymin, xmax, ymax (UTM m), res, w, h, block */
          break;
        } catch (e) { if (t === 2) console.log('  ', k, e.message.slice(0, 80)); }
      }
      if (++done % 100 === 0) { writeFileSync(INDEX, JSON.stringify(have)); console.log(`  ${done} read`); }
    }
  };
  await Promise.all(Array.from({ length: 12 }, worker));
  writeFileSync(INDEX, JSON.stringify(have));
  console.log(`indexed ${Object.keys(have).length} files`);
}
function build() {
  const idx = JSON.parse(readFileSync(INDEX, 'utf8')), files = Object.entries(idx);
  let tot = 0, hit = 0;
  for (const town of TOWNS) {
    const f = join(DATA, `${town}.json`); if (!existsSync(f)) continue;
    const d = JSON.parse(readFileSync(f, 'utf8')), doors = {};
    /* framed on the house (sample-roofs.mjs --build writes houses-<town>.json): the parcel's centre point can sit
       out in a field on a big rural lot (854 Haystack Ct, Castle Rock, showed only grass) */
    const hf = join(HERE, `houses-${town}.json`), houses = existsSync(hf) ? JSON.parse(readFileSync(hf, 'utf8')) : {};
    for (const a of d.areas) for (const x of a.doors) {
      tot++;
      const h = houses[x.id];
      const [E, N] = proj4('EPSG:4326', 'EPSG:6342', h ? [h.c[1], h.c[0]] : [x.lon, x.lat]);
      /* the file where the house sits furthest from an edge (tiles overlap at seams) */
      let best = null, bestM = -1;
      for (const [name, b] of files) {
        if (E < b[0] || E > b[2] || N < b[1] || N > b[3]) continue;
        const m = Math.min(E - b[0], b[2] - E, N - b[1], b[3] - N);
        if (m > bestM) { bestM = m; best = [name, b]; }
      }
      if (!best) continue;
      const [name, b] = best;
      /* half-window in pixels: the house plus 6 m each side, between 160 and 330 px (24-50 m across at 3 in) */
      const half = h ? Math.max(160, Math.min(330, Math.round((h.ext / 2 + 6) / b[4]))) : 200;
      doors[x.id] = [name, Math.round((E - b[0]) / b[4]), Math.round((b[3] - N) / b[4]), half];   /* file, pixel x, pixel y, half-window */
      hit++;
    }
    writeFileSync(join(DATA, `photo-${town}.json`), JSON.stringify({ src: 'DRAPP 2020, 3 in', base: `${BUCKET}/${PREFIX}`, res: files.length ? files[0][1][4] : null, doors }));
    console.log(`  photo-${town}.json: ${Object.keys(doors).length} doors`);
  }
  console.log(`${hit} of ${tot} doors inside the 3-inch photos`);
}
const cmd = process.argv[2];
if (cmd === 'index') await index(); else if (cmd === 'build') build(); else console.log('node photo-index.mjs index | build');
