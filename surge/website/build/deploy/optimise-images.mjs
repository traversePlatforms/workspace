/* Surge site — photo pipeline. Camera originals in, web images out.
   Rebuilt in-repo 2026-09-16; the first version lived in a session scratchpad
   and was lost, which left DEPLOY.md pointing at a script that did not exist.

   What it does to every input:
     - decodes HEIC (iPhone) as well as JPEG / PNG
     - applies the EXIF rotation, then STRIPS all metadata (phone photos carry
       GPS coordinates; nothing in the output identifies where it was taken)
     - crops to the slot's aspect and resizes to the slot's size, picking the
       crop window by image content ("attention") rather than dead centre
     - writes <name>.jpg, and <name>.webp only if the WebP is actually smaller
       (the site's <picture> convention — WebP where it wins, not everywhere)
     - warns on the two things the shot list says make a frame unusable:
       portrait orientation, and a long edge under the slot width

   Usage:
     node deploy/optimise-images.mjs <file-or-folder>... [options]

   Options:
     --slot content      1440x1080, 4:3 — every content photo slot (default)
     --slot hero         1800x1013, 16:9 — the homepage hero background only
     --name <base>       output basename (single input only); default = slugified input name
     --out <dir>         output folder; default assets/img/ next to the site
     --gravity <g>       crop focus: attention (default) | entropy | centre | north | south | ...
     --focus <0..1>      centre the crop band on this fraction of the source height (portrait)
                         or width (landscape) — e.g. --focus 0.55 for a rep-behind-a-kiosk shot
                         where the faces sit just below the middle. Overrides --gravity.
     --force             overwrite an existing output
     --dry               report what would happen, write nothing

   Examples:
     node deploy/optimise-images.mjs ../../brand/photos/2026-09-20/           # a whole shoot
     node deploy/optimise-images.mjs ~/Desktop/IMG_8412.heic --name morning-block-c
     node deploy/optimise-images.mjs shot.jpg --slot hero --name hero-bg --force

   Headshots for /team/ are NOT this pipeline — they are cut out onto the
   studio grey by hand; see brand/photos/ notes. */
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { readFile, readdir, stat, mkdir, access } from 'node:fs/promises';
import { join, dirname, extname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(dirname(fileURLToPath(import.meta.url)));   // .../website/build

const SLOTS = {
  content: { w: 1440, h: 1080, label: '4:3 content slot' },
  hero:    { w: 1800, h: 1013, label: '16:9 hero background' },
};
const JPEG_Q = 80, WEBP_Q = 78;
const INPUT_EXT = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif']);

// ---- args -------------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = { slot: 'content', name: null, out: join(SITE, 'assets', 'img'), gravity: 'attention', focus: null, force: false, dry: false };
const inputs = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--slot') opt.slot = argv[++i];
  else if (a === '--name') opt.name = argv[++i];
  else if (a === '--out') opt.out = resolve(argv[++i]);
  else if (a === '--gravity') opt.gravity = argv[++i];
  else if (a === '--focus') opt.focus = Number(argv[++i]);
  else if (a === '--force') opt.force = true;
  else if (a === '--dry') opt.dry = true;
  else if (a.startsWith('--')) die(`unknown option ${a}`);
  else inputs.push(resolve(a));
}
if (!inputs.length) die('give at least one file or folder — see the header of this script');
if (!SLOTS[opt.slot]) die(`--slot must be one of: ${Object.keys(SLOTS).join(', ')}`);
if (opt.focus !== null && !(opt.focus >= 0 && opt.focus <= 1)) die('--focus must be a number between 0 and 1');
const slot = SLOTS[opt.slot];

function die(msg) { console.error(`optimise-images: ${msg}`); process.exit(1); }
const kb = (n) => `${Math.round(n / 1024)} KB`;
const slug = (s) => s.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- expand folders -----------------------------------------------------------
const files = [];
for (const p of inputs) {
  const s = await stat(p).catch(() => null);
  if (!s) die(`not found: ${p}`);
  if (s.isDirectory()) {
    for (const f of (await readdir(p)).sort()) {
      if (INPUT_EXT.has(extname(f).toLowerCase()) && !f.startsWith('.')) files.push(join(p, f));
    }
  } else files.push(p);
}
if (!files.length) die('no .jpg / .jpeg / .png / .heic files found');
if (opt.name && files.length > 1) die('--name only makes sense with a single input');

const gravity = ['attention', 'entropy'].includes(opt.gravity) ? sharp.strategy[opt.gravity] : opt.gravity;

// ---- run ----------------------------------------------------------------------
if (!opt.dry) await mkdir(opt.out, { recursive: true });
console.log(`${opt.dry ? 'DRY RUN — ' : ''}${files.length} file(s) → ${opt.out}   slot: ${opt.slot} (${slot.w}×${slot.h}, ${slot.label})\n`);

let warnings = 0;
for (const file of files) {
  const name = opt.name || slug(basename(file));
  const outJpg = join(opt.out, `${name}.jpg`);
  const outWebp = join(opt.out, `${name}.webp`);
  const notes = [];

  // decode — HEIC via libheif (WASM), everything else straight into sharp
  let buf = await readFile(file);
  const ext = extname(file).toLowerCase();
  if (ext === '.heic' || ext === '.heif') {
    buf = Buffer.from(await heicConvert({ buffer: buf, format: 'JPEG', quality: 1 }));
    notes.push('heic→jpeg');
  }

  // .rotate() with no argument applies the EXIF orientation; metadata is
  // stripped by default because withMetadata() is never called.
  const src = sharp(buf).rotate();
  const meta = await src.metadata();
  // after rotate(), width/height reflect the displayed orientation
  const swap = meta.orientation >= 5 && ext !== '.heic';
  const W = swap ? meta.height : meta.width, H = swap ? meta.width : meta.height;

  if (H > W) { notes.push('⚠ PORTRAIT — the crop keeps a 4:3 band out of the middle; most of the frame is lost'); warnings++; }
  if (Math.max(W, H) < slot.w) { notes.push(`⚠ SMALL — long edge ${Math.max(W, H)}px, slot wants ${slot.w}; it will be upscaled`); warnings++; }

  const exists = await access(outJpg).then(() => true, () => false);
  if (exists && !opt.force) { notes.push('exists — skipped (use --force)'); report(file, `${W}×${H}`, null, null, null, notes); continue; }

  if (opt.dry) { report(file, `${W}×${H}`, `${slot.w}×${slot.h}`, null, null, notes); continue; }

  let base;
  if (opt.focus !== null) {
    // Manual band: same aspect as the slot, as large as the source allows, centred on --focus.
    const ar = slot.w / slot.h;
    let bw = W, bh = Math.round(W / ar);
    if (bh > H) { bh = H; bw = Math.round(H * ar); }
    const portraitish = H / W > 1 / ar;   // band is height-limited -> focus moves vertically
    const left = portraitish ? Math.round((W - bw) / 2) : Math.min(Math.max(Math.round(opt.focus * W - bw / 2), 0), W - bw);
    const top  = portraitish ? Math.min(Math.max(Math.round(opt.focus * H - bh / 2), 0), H - bh) : Math.round((H - bh) / 2);
    base = src.clone().extract({ left, top, width: bw, height: bh }).resize(slot.w, slot.h);
    notes.push(`band ${bw}×${bh} at ${portraitish ? 'y' : 'x'}=${portraitish ? top : left} (focus ${opt.focus})`);
  } else {
    base = src.clone().resize(slot.w, slot.h, { fit: 'cover', position: gravity, withoutEnlargement: false });
  }
  const jpg = await base.clone().jpeg({ quality: JPEG_Q, progressive: true, mozjpeg: true }).toBuffer();
  const webp = await base.clone().webp({ quality: WEBP_Q, effort: 5 }).toBuffer();

  await sharp(jpg).toFile(outJpg);
  let webpNote;
  if (webp.length < jpg.length * 0.92) { await sharp(webp).toFile(outWebp); webpNote = `${kb(webp.length)} ✓ kept`; }
  else { webpNote = `${kb(webp.length)} — not smaller, not written`; }

  report(file, `${W}×${H}`, `${slot.w}×${slot.h}`, kb(jpg.length), webpNote, notes);
}

function report(file, inDims, outDims, jpgSize, webpNote, notes) {
  console.log(`${basename(file)}`);
  console.log(`   in  ${inDims}${outDims ? `   →  out ${outDims}` : ''}`);
  if (jpgSize) console.log(`   jpg ${jpgSize}   webp ${webpNote}`);
  for (const n of notes) console.log(`   ${n}`);
  console.log();
}

if (!opt.dry) console.log(`Done. Reference as /assets/img/<name>.jpg — and if a .webp was written, wrap it in <picture> with a <source type="image/webp"> like the existing slots.`);
if (warnings) console.log(`${warnings} warning(s) above — a portrait or undersized frame is still written, but the shot list says to reshoot it.`);
