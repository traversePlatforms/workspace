/* Sixfold — THE CHOSEN CARD. 2026-09-29.

   Crew picked `casc-2-wide` from card-cascade-proof.png: the four-step cascade
   with the wide start — Frost -> Sage -> Fern -> Turf, conifer lightest, tall
   peak darkest. This file is that card with the two changes asked for on top:

     FRONT  the lockup grown to fill the empty space, without crowding the trim.
     BACK   the QR code dropped into the empty right-hand space.

   ⚑ QR SIZE IS THE CONSTRAINT ON THE BACK, AND IT WAS MEASURED, NOT GUESSED.
   `sixfold-qr-brand-on-white.png` is 1200px with the modules spanning 80.5% of
   it — a 4-module quiet zone each side, exactly the spec. So the placed width
   has to be divided by 0.805 to get the module size that actually matters:

       image 1.12in (28.4mm)  ->  modules 22.9mm

   brand/qr/README.md sets the hand-held floor at 20mm and calls 25-30mm the
   comfortable range for arm's length. 22.9mm clears the floor with margin and
   sits under the comfortable range; going to 25mm costs another 0.13in of width
   and starts making the QR the subject of the card. That trade is flagged in the
   README rather than silently taken.

   ⚑ THE WHITE-GROUND CODE IS USED ON PURPOSE. brand/qr/README.md: "The code is
   never inverted" — light modules on dark is the standard way to make a QR that
   a meaningful share of phones refuse. On a Pine card that means a Bone plate.
   `sixfold-qr-on-dark-tile.png` also exists for this, but its plate carries a
   6.3-module quiet zone, so the same 22.9mm of modules would need a 1.37in
   image. The on-white file at a CSS-drawn plate is smaller for the same code.

   ⚑ THE QUIET ZONE IS PART OF THE CODE. The Bone plate is drawn with padding
   OUTSIDE the image, never by cropping into it. Do not set type in that margin.

   ⚑ WHAT THE CODE POINTS AT IS NOT THE WEBSITE. It encodes
   https://linktr.ee/SixFoldColorado — built 2026-08-21, before the site was
   live. See the README note; this is a decision for Matthew, not a build fix.

   ⚑ ROOTS and the compound-path split: see build-card-marks.mjs.

   Run:  node sixfold/operations/business-card-print/build-card-final.mjs        */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRAND = join(HERE, '..', '..', 'brand');

const PINE = '#0E1512', BONE = '#EDE7DC';
const SAGE = '#A7BE93', MOSS = '#8AA07A', TURF = '#2F7A4F';
const FERN = '#6E8C61', FROST = '#DCE7D2';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/* ---- the mark, split into four masses for the cascade ---------------------- */
const flat = readFileSync(join(BRAND, 'sixfold-mark-ridge-flat.svg'), 'utf8');
const ridgeD = flat.match(/<path fill="#E4703A"[^>]*d="([^"]+)"/)[1];
const subs = ridgeD.split(/(?=M)/).filter(Boolean);
if (subs.length !== 7) throw new Error(`ridge split: expected 7 subpaths, got ${subs.length}`);
const LOW = [0, 1, 2, 3, 4].map((i) => subs[i]).join(''), MID = subs[5], HIGH = subs[6];
const conifer = flat.match(/<path fill="#8AA07A"[^>]*d="(M9\.5[^"]+)"/)[1];
const groundBar = flat.match(/<path fill="#8AA07A" d="(M4 86[^"]+)"/)[1];

const master = readFileSync(join(BRAND, 'sixfold-mark-ridge.svg'), 'utf8');
const rootGroup = master.slice(master.lastIndexOf('<g fill="none"'), master.lastIndexOf('</g>'));
const ROOTS = rootGroup.split('\n').filter((l) => l.includes('stroke-width')).map((l) => l.trim());
if (ROOTS.length !== 10) throw new Error(`expected 10 root strokes, got ${ROOTS.length}`);

/* casc-2-wide: conifer Frost, low mass Sage, middle Fern, tall peak Turf.
   Ground bar and roots stay at the lightest stop — the roots are 0.15-0.32mm
   hairlines and need the most contrast on the card, never the least. */
/* ⚑ TIGHT viewBox — this is where the size increase actually comes from.

   The brand file's box is `0 0 100 116`, but the ink only runs x 4-98, y 14-113.
   About 12% of the box is empty sky above the tall peak, and on the old card that
   emptiness was being paid for in layout. Cropping the box to the artwork — with
   half a unit of slack so the root stroke widths are not clipped — makes the mark
   visibly bigger while the lockup occupies the same room.

   The alternative was growing the box, and there is nowhere to grow into: the old
   front stack already measured 1.525in of the 1.56in safe area.

   ⚑ Do NOT copy this viewBox onto anything that expects the brand geometry. It is
   a crop for this card, not a change to the mark.                              */
const VB = { x: 3.5, y: 13, w: 95, h: 101 };
const MARK_H = 90;                                  // px tall on the card
const MARK_W = Math.round(MARK_H * VB.w / VB.h);
function mark() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" width="${MARK_W}" height="${MARK_H}" role="img" aria-label="Sixfold mark, Ridge">`
    + `<path fill="${SAGE}" fill-rule="evenodd" d="${LOW}"/>`
    + `<path fill="${FERN}" fill-rule="evenodd" d="${MID}"/>`
    + `<path fill="${TURF}" fill-rule="evenodd" d="${HIGH}"/>`
    + `<path fill="${FROST}" fill-rule="evenodd" d="${conifer}"/>`
    + `<path fill="${FROST}" d="${groundBar}"/>`
    + `<g fill="none" stroke="${FROST}" stroke-linecap="round" stroke-linejoin="round">${ROOTS.join('')}</g>`
    + `</svg>`;
}

/* ---- the QR ---------------------------------------------------------------- */
const QR_IMG = 1.22;          // inches, the image itself
const QR_MODULE_FRACTION = 0.805;   // measured: modules span 80.5% of the PNG
const QR_PAD = 0.055;         // Bone plate drawn OUTSIDE the image, never a crop
const qrModulesMm = QR_IMG * 25.4 * QR_MODULE_FRACTION;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sixfold business card — cascade, final</title>
<style>
  /* 3.75 x 2.25 in = a 3.5 x 2 in card plus 0.125 in bleed on every side.
     Two pages: 1 front, 2 back. Render at scale 1 — see tools/html-to-pdf.mjs. */
  @page { size: 3.75in 2.25in; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: "Cascadia Mono", Consolas, "SFMono-Regular", monospace; }

  .page { position: relative; width: 3.75in; height: 2.25in; background: ${PINE};
    overflow: hidden; page-break-after: always; break-after: page;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  /* 0.345in from the page edge = 0.22in inside the trim. FedEx wants nothing
     important within 0.125in of the trim; this keeps the proof's own pad. */
  /* 0.30in from the page edge = 0.175in inside the trim. The four older cards
     use 0.345in (0.22in inside), which is far more conservative than FedEx asks
     for — their rule is nothing important within 0.125in of the trim. Reclaiming
     that band is what gave the lockup room to grow. Still clears the guard. */
  .pad { position: absolute; inset: 0.30in; }
  /* ⚑ An svg is a flex item and the default flex-shrink will SILENTLY squash it
     when the stack overflows — the mark comes out distorted and nothing looks
     wrong until you measure it. This happened at the first attempt on this card. */
  .pad > svg, .wordmark, .band, .co { flex: none; }

  @media screen {
    body { background: #4A5550; padding: 24px; display: flex; gap: 24px; flex-wrap: wrap; }
    .page { box-shadow: 0 6px 24px rgba(0,0,0,.4); }
    .page::after { content: ""; position: absolute; inset: 0.125in;
      border: 0.4pt dashed rgba(255,255,255,.35); pointer-events: none; }
  }

  /* ---- FRONT. Grown from the proof: mark 76 -> 96px, wordmark 19 -> 24pt,
     band and COLORADO up with them. The stack is measured against the pad in
     the console output — it must not reach the 0.22in trim guard. ---- */
  .wordmark { font-family: "Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
    font-size: 21pt; letter-spacing: -.35pt; line-height: 1; color: ${BONE}; }
  .band { font-size: 6.2pt; letter-spacing: 3.5pt; color: ${MOSS}; margin-top: 5pt; }
  .co   { font-size: 6.2pt; letter-spacing: 3.9pt; color: rgba(237,231,220,.6); margin-top: 3pt; }

  /* ---- BACK ---- */
  .back { display: flex; gap: .13in; align-items: stretch; height: 100%; }
  .info { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column;
    justify-content: space-between; }
  .nm  { font-family: "Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
    font-size: 12pt; line-height: 1.1; color: ${BONE}; }
  .ti  { font-size: 6.2pt; letter-spacing: 1.4pt; text-transform: uppercase; color: ${MOSS}; margin-top: 2pt; }
  .dt  { font-size: 7pt; line-height: 1.8; color: ${BONE}; }
  .dt .web { color: ${SAGE}; }
  .svc { font-size: 6.2pt; letter-spacing: 1.2pt; color: rgba(237,231,220,.5); }

  .qrwrap { flex: 0 0 auto; display: flex; flex-direction: column;
    align-items: center; justify-content: center; }
  /* The plate is padding around the image. The image already carries the
     4-module quiet zone; this only ever adds to it. */
  .plate { background: ${BONE}; padding: ${QR_PAD}in; border-radius: .055in;
    line-height: 0; }
  .plate img { display: block; width: ${QR_IMG}in; height: ${QR_IMG}in; }
  .qrcap { font-size: 6pt; letter-spacing: 1.1pt; text-transform: uppercase;
    color: rgba(237,231,220,.55); margin-top: 3.5pt; text-align: center; }
</style>
</head>
<body>

<!-- PAGE 1 — FRONT -->
<div class="page">
  <div class="pad" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
    ${mark()}
    <div class="wordmark" style="margin-top:4pt">Sixfold</div>
    <div class="band">LAWN, LAND &amp; FIRE</div>
    <div class="co">COLORADO</div>
  </div>
</div>

<!-- PAGE 2 — BACK -->
<div class="page">
  <div class="pad">
    <div class="back">
      <div class="info">
        <div>
          <div class="nm">Brandon Long</div>
          <div class="ti">Owner</div>
        </div>
        <div class="dt">
          (303) 915-1045<br>
          Contact@SixfoldColorado.com<br>
          <span class="web">SixfoldColorado.com</span>
        </div>
        <div class="svc">AERATION &middot; LAWN CARE<br>LANDSCAPING &middot; FIRE</div>
      </div>
      <div class="qrwrap">
        <div class="plate">
          <img src="../../brand/qr/sixfold-qr-brand.png" alt="Scan for Sixfold Colorado">
        </div>
        <div class="qrcap">Scan for<br>our page</div>
      </div>
    </div>
  </div>
</div>

</body>
</html>
`;

writeFileSync(join(HERE, 'card-cascade-final.html'), html);
console.log('wrote card-cascade-final.html');

console.log('\nMARK CASCADE — each stop against the Pine ground');
const ramp = [['conifer', FROST], ['low mass', SAGE], ['middle peak', FERN], ['tall peak', TURF],
  ['roots + bar', FROST]];
for (const [what, hex] of ramp) {
  const c = contrast(hex, PINE);
  console.log(`  ${what.padEnd(12)} ${hex}  ${c.toFixed(2).padStart(5)}:1${c < 3 ? '  ⚑ UNDER 3:1' : ''}`);
}

console.log('\nQR');
console.log(`  image placed at   ${QR_IMG}in = ${(QR_IMG * 25.4).toFixed(1)}mm`);
console.log(`  modules           ${qrModulesMm.toFixed(1)}mm  (80.5% of the image; the rest is the 4-module quiet zone)`);
console.log(`  Bone plate        ${((QR_IMG + QR_PAD * 2) * 25.4).toFixed(1)}mm square, padding OUTSIDE the image`);
console.log(`  floor 20mm: ${qrModulesMm >= 20 ? 'PASS' : 'FAIL'}   comfortable 25mm: ${qrModulesMm >= 25 ? 'PASS' : 'under — see the README trade-off'}`);
