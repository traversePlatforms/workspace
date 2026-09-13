/*
  Sixfold — QR code for https://linktr.ee/SixFoldColorado

  Generates the QR locally (no third-party QR service is contacted, so nothing
  about this link is handed to an external generator, and nothing can expire or
  start redirecting through someone else's domain later — a real failure mode
  with free online QR builders).

  THEN IT VERIFIES ITSELF. Every PNG this writes is decoded back with jsQR and
  the decoded string is compared to the source URL, including at small sizes.
  A QR that does not scan is worse than no QR, and you cannot tell by looking.

  DEPENDENCIES LIVE OUTSIDE THIS FOLDER, ON PURPOSE. This directory is inside
  OneDrive, and a node_modules tree here would be synced file-by-file. Install
  somewhere outside it and point QR_DEPS at the node_modules directory:

    mkdir <scratch>/qrtool && cd <scratch>/qrtool
    npm init -y && npm i qrcode jsqr pngjs

    QR_DEPS=<scratch>/qrtool/node_modules node build-qr.mjs

  ESM ignores NODE_PATH, which is why this resolves them explicitly rather than
  with a bare import.
*/
import { createRequire } from 'node:module';

const DEPS = process.env.QR_DEPS;
if (!DEPS) throw new Error('Set QR_DEPS to the node_modules directory holding qrcode, jsqr and pngjs. See the header.');
const req = createRequire(DEPS.replace(/\/?$/, '/') + 'index.js');
const QRCode = req('qrcode');
const jsQRmod = req('jsqr');
const jsQR = jsQRmod.default ?? jsQRmod;
const { PNG } = req('pngjs');

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_TEXT = 'https://linktr.ee/SixFoldColorado';

const here = dirname(fileURLToPath(import.meta.url));
const tmp = join(here, '.build');
mkdirSync(tmp, { recursive: true });
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const PINE = '#0E1512';
const EMBER = '#E4703A';
const BONE = '#EDE7DC';

/* The Ridge crest, tight viewBox, for the centre knockout. Roots are omitted —
   they are sub-pixel at this size and would only muddy the reserve area. */
const RIDGE = `
  <path d="M18 84 L36 48 L54 84 Z" fill-opacity="0.42"/>
  <path d="M30 84 L50 38 L70 84 Z" fill-opacity="0.55"/>
  <path d="M44 84 L66 26 L88 84 Z" fill-opacity="0.7"/>
  <path d="M60 84 L79 14 L98 84 Z" fill-opacity="0.85"/>
  <rect x="20.4" y="77" width="3.2" height="7"/>
  <path d="M22 69 L9.5 81.5 L34.5 81.5 Z"/>
  <path d="M22 62 L12 74 L32 74 Z"/>
  <path d="M22 55.5 L14.5 66.5 L29.5 66.5 Z"/>
  <rect x="4" y="86" width="92" height="5"/>`;

/* --------------------------------------------------------------------------
   Build the SVG from the raw module matrix so finders and the logo reserve can
   be drawn deliberately. Error correction is fixed at H (~30% recoverable),
   which is what buys the centre knockout.
-------------------------------------------------------------------------- */
function buildSvg({ dark, light, finder, logo, quiet = 4, radius = 0.5 }) {
  const qr = QRCode.create(URL_TEXT, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const d = qr.modules.data;
  const total = n + quiet * 2;
  const at = (x, y) => d[y * n + x];

  const inFinder = (x, y) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);

  /* Centre reserve for the logo, in modules. Kept to ~19% of the linear
     dimension: at level H that sits well inside what the error correction can
     rebuild, and the decode check below is what actually proves it. */
  const reserve = logo ? Math.round(n * 0.19) : 0;
  const rLo = Math.floor((n - reserve) / 2);
  const rHi = rLo + reserve - 1;
  /* Cleared one module wider than the plate that covers it. Without the extra
     ring the plate lands on top of live modules and slices them into crescents
     around its edge — it still decoded, but it looks like a rendering fault. */
  const inReserve = (x, y) =>
    logo && x >= rLo - 1 && x <= rHi + 1 && y >= rLo - 1 && y <= rHi + 1;

  let cells = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!at(x, y) || inFinder(x, y) || inReserve(x, y)) continue;
      cells += `<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1" rx="${radius}"/>`;
    }
  }

  /* Finder patterns drawn as rounded rings rather than raw modules. The 7:5:3
     geometry and the 1-module ring width are preserved exactly — only the
     corners change — so the locator ratio a scanner looks for is intact. */
  const eye = (ox, oy) => `
    <rect x="${ox + quiet + 0.5}" y="${oy + quiet + 0.5}" width="6" height="6" rx="1.7"
          fill="none" stroke="${finder}" stroke-width="1"/>
    <rect x="${ox + quiet + 2}" y="${oy + quiet + 2}" width="3" height="3" rx="0.9" fill="${finder}"/>`;

  const logoSvg = !logo ? '' : (() => {
    const pad = 0.9;                    // module of clear space around the mark
    const bx = rLo + quiet - pad;
    const bw = reserve + pad * 2;
    const markW = reserve * 0.86;
    const markH = markW * (77 / 94);    // crest aspect from the tight viewBox
    const mx = rLo + quiet + (reserve - markW) / 2;
    const my = rLo + quiet + (reserve - markH) / 2;
    return `
      <rect x="${bx}" y="${bx}" width="${bw}" height="${bw}" rx="${bw * 0.16}" fill="${light}"/>
      <svg x="${mx}" y="${my}" width="${markW}" height="${markH}" viewBox="4 14 94 77">
        <g fill="${EMBER}">${RIDGE}</g>
      </svg>`;
  })();

  return {
    n, total,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="geometricPrecision">
  <rect width="${total}" height="${total}" fill="${light}"/>
  <g fill="${dark}">${cells}</g>
  ${eye(0, 0)}${eye(n - 7, 0)}${eye(0, n - 7)}
  ${logoSvg}
</svg>`,
  };
}

/* --------------------------------------------------------------------------
   Raster + verify.
-------------------------------------------------------------------------- */
function render(svg, px, out, tile) {
  /* `tile` wraps the code in a Bone plate on a Pine ground, for dropping onto
     dark collateral. A QR has to sit on a light field to scan — inverting it to
     match a dark brand is the classic way to make one that half of phones
     refuse, so the plate is the fix rather than recolouring the code. */
  const html = tile
    ? `<!doctype html><meta charset="utf-8">
      <style>*{margin:0;padding:0}html,body{background:${PINE}}
      body{width:${px}px;height:${px}px;display:flex;align-items:center;justify-content:center}
      .plate{background:${BONE};border-radius:${px * 0.055}px;padding:${px * 0.045}px;
             display:flex;box-shadow:0 ${px * 0.012}px ${px * 0.045}px rgba(0,0,0,.42)}
      svg{display:block;width:${px * 0.82}px;height:${px * 0.82}px}</style>
      <div class="plate">${svg}</div>`
    : `<!doctype html><meta charset="utf-8">
      <style>*{margin:0;padding:0}html,body{background:#fff}
      svg{display:block;width:${px}px;height:${px}px}</style>${svg}`;
  const src = join(tmp, `${out}.html`);
  writeFileSync(src, html, 'utf8');
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--virtual-time-budget=3000',
    `--window-size=${px},${px}`,
    `--screenshot=${join(here, out)}`,
    `file:///${src.replace(/\\/g, '/')}`,
  ], { stdio: 'ignore' });
}

/** Decode a PNG back and compare. Optionally at a reduced size, to model print. */
function verify(file, scaleTo) {
  let png = PNG.sync.read(readFileSync(join(here, file)));
  if (scaleTo && scaleTo < png.width) {
    // Nearest-neighbour downscale — harsher than a real camera, so passing here
    // is a conservative result.
    const s = scaleTo, src = png, out = new PNG({ width: s, height: s });
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const sx = Math.floor(x * src.width / s), sy = Math.floor(y * src.height / s);
      const si = (sy * src.width + sx) * 4, di = (y * s + x) * 4;
      out.data[di] = src.data[si]; out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2]; out.data[di + 3] = 255;
    }
    png = out;
  }
  const res = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return res && res.data === URL_TEXT;
}

/* -------------------------------------------------------------------------- */
const VARIANTS = [
  { out: 'sixfold-qr-print-black.png', px: 1200,
    opts: { dark: '#000000', light: '#FFFFFF', finder: '#000000', logo: false, radius: 0 } },
  { out: 'sixfold-qr-brand.png', px: 1200,
    opts: { dark: PINE, light: BONE, finder: PINE, logo: true, radius: 0.5 } },
  /* No Ember anywhere in the scannable geometry. Ember on Bone is about 2.7:1
     — it decodes here, but that is a lenient software decoder in perfect light,
     not a phone in a driveway at dusk. Ember earns its place in the centre mark
     only, where it carries no data. */
  { out: 'sixfold-qr-brand-nologo.png', px: 1200,
    opts: { dark: PINE, light: BONE, finder: PINE, logo: false, radius: 0.5 } },
  { out: 'sixfold-qr-on-dark-tile.png', px: 1200, tile: true,
    opts: { dark: PINE, light: BONE, finder: PINE, logo: true, radius: 0.5 } },
];

let allOk = true;
for (const v of VARIANTS) {
  const { svg, n, total } = buildSvg(v.opts);
  if (!v.tile) writeFileSync(join(here, v.out.replace('.png', '.svg')), svg, 'utf8');
  render(svg, v.px, v.out, v.tile);

  const checks = [null, 400, 240, 160].map((s) => [s || v.px, verify(v.out, s)]);
  const ok = checks.every(([, r]) => r);
  allOk = allOk && ok;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${v.out}  (${n} modules, ${total} incl. quiet zone)  ` +
    checks.map(([s, r]) => `${s}px:${r ? 'ok' : 'NO'}`).join('  ')
  );
}

console.log(allOk
  ? '\nAll variants decode back to the exact URL at every size tested.'
  : '\nAT LEAST ONE VARIANT FAILED TO DECODE — do not ship it.');
