/* Sixfold — business cards, ONE PER PERSON. 2026-10-01.  (SX-4b)

   `build-card-final.mjs` built the card that was printed: the cascade mark on
   Pine, Brandon Long / Owner. It stays exactly as it is — it is the record of
   a physical artefact that exists. This file is the same card with the person
   and the colourway lifted out as parameters, so Brad and Matthew can have one
   without the layout being re-decided.

   ⚑ BRANDON IS A REGRESSION TEST, NOT A REPRINT. He is in the roster below so
   that his output can be diffed against `card-cascade-final.html`. If the diff
   is empty, this file is a faithful generalisation of the printed card and the
   other two inherit a layout that has already been audited and sent to press.
   His cards are printed; nothing here reorders them.

   ⚑ THE ROOTS. The Ridge master carries ten stroked root paths below the ground
   bar; the FLAT master is cropped at y=96, above where they start, so building
   from the flat file alone silently deletes them. That has happened once. Both
   files are read here, as in the original, and the count is asserted.

   ⚑ ROOTS TAKE THE MOST CONTRAST, WHICH IS NOT THE SAME COLOUR ON EVERY GROUND.
   They are 0.15–0.32 mm hairlines. On Pine the most contrast is the LIGHTEST
   stop (Frost); on Bone it is the DARKEST (Timber). The cascade runs light to
   dark in both, but which end of it the roots borrow flips with the ground.
   Copying the Pine ramp onto a Bone card puts the hairlines at 2.5:1 and the
   press drops them.

   Run:  node sixfold/operations/business-card-print/build-card-person.mjs      */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRAND = join(HERE, '..', '..', 'brand');

const PINE = '#0E1512', BONE = '#EDE7DC';
const SAGE = '#A7BE93', MOSS = '#8AA07A', TURF = '#2F7A4F';
const FERN = '#6E8C61', FROST = '#DCE7D2';
/* Ember on a light ground. ⚑ EMBER ITSELF (#E4703A) IS NOT IN THIS RAMP: it is
   2.56:1 on Bone, under the 3:1 floor, which is why the older ember-on-Bone card
   used Ember Ink for its peaks too. The ramp is the ember family darkened until
   every stop clears the floor. */
const CLAY = '#C9561F', EMBER_INK = '#B84C15', DEEP = '#8A3A10', BARK = '#6E2E0C';
const TIMBER = '#1F2A25', STONE = '#5F6A62', RUST = '#A34312';

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

/* ⚑ TIGHT viewBox — a crop to this card's artwork, NOT a change to the mark.
   Do not copy it onto anything that expects the brand geometry. */
const VB = { x: 3.5, y: 13, w: 95, h: 101 };
const MARK_H = 90;
const MARK_W = Math.round(MARK_H * VB.w / VB.h);
function mark(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" width="${MARK_W}" height="${MARK_H}" role="img" aria-label="Sixfold mark, Ridge">`
    + `<path fill="${c.low}" fill-rule="evenodd" d="${LOW}"/>`
    + `<path fill="${c.mid}" fill-rule="evenodd" d="${MID}"/>`
    + `<path fill="${c.high}" fill-rule="evenodd" d="${HIGH}"/>`
    + `<path fill="${c.conifer}" fill-rule="evenodd" d="${conifer}"/>`
    + `<path fill="${c.bar}" d="${groundBar}"/>`
    + `<g fill="none" stroke="${c.roots}" stroke-linecap="round" stroke-linejoin="round">${ROOTS.join('')}</g>`
    + `</svg>`;
}

/* ---- the QR ---------------------------------------------------------------- */
const QR_IMG = 1.22;                // inches, the image itself
const QR_MODULE_FRACTION = 0.805;   // measured: modules span 80.5% of the PNG
const QR_PAD = 0.055;               // Bone plate drawn OUTSIDE the image, never a crop
const qrModulesMm = QR_IMG * 25.4 * QR_MODULE_FRACTION;

/* ---- colourways ------------------------------------------------------------ */
const COLOURWAYS = {
  /* exactly the printed card */
  'cascade-pine': {
    label: 'cascade on Pine — the printed card',
    bg: PINE, ink: BONE, ti: MOSS, band: MOSS, co: 'rgba(237,231,220,.6)',
    web: SAGE, svc: 'rgba(237,231,220,.5)', qrcap: 'rgba(237,231,220,.55)',
    plate: BONE,
    mark: { conifer: FROST, low: SAGE, mid: FERN, high: TURF, bar: FROST, roots: FROST },
    /* the ramp as the crew picked it, lightest stop first */
    ramp: [['conifer', FROST], ['low mass', SAGE], ['middle peak', FERN], ['tall peak', TURF],
      ['roots + bar', FROST]],
  },
  /* ⚑ the ground is inverted, so the roots move to the other end of the ramp */
  'ember-bone': {
    label: 'ember on Bone',
    bg: BONE, ink: PINE, ti: DEEP, band: DEEP, co: STONE,
    web: RUST, svc: STONE, qrcap: STONE,
    plate: BONE,
    mark: { conifer: CLAY, low: EMBER_INK, mid: DEEP, high: BARK, bar: TIMBER, roots: TIMBER },
    ramp: [['conifer', CLAY], ['low mass', EMBER_INK], ['middle peak', DEEP], ['tall peak', BARK],
      ['roots + bar', TIMBER]],
  },
};

/* ---- who gets a card ------------------------------------------------------- */
/* ⚑ EMAIL IS NOW PER PERSON, AND IT IS SPLIT. Answered 2026-10-01: Brandon and
   Brad keep the shared Contact@ — the original instruction, "not a personal one"
   — and Matthew takes M.Sharpe@. So the card family carries two conventions on
   purpose, not by oversight. Anyone adding a fourth card has to be told which
   one they are getting; the default here is the shared address.

   ⚑ THE DOMAIN IS CAMEL-CASED TO MATCH THE CARD, not as typed. `SixfoldColorado`
   reads better at 7pt than `sixfoldcolorado` and the local part is untouched.
   The domain half of an address is case-insensitive, so this changes nothing
   about where mail goes.

   ⚑ CONFIRM THE MAILBOX EXISTS BEFORE ORDERING. Contact@ is in use on 34
   documents; M.Sharpe@SixfoldColorado.com appears nowhere in this repo before
   today. Sixfold's Workspace tenant is real and Matthew is its only super admin,
   so creating it is a minute's work — but a printed address that bounces is the
   one error on a business card you cannot fix after the box arrives.

   ⚑ THE DESCRIPTOR IS `LAWN, LAND & FIRE` ON ALL THREE, INCLUDING THE EMBER ONE.
   The older `Sixfold-Card-Ember-Bone.pdf` reads `LAND & FIRE` and leads its
   service line with fire mitigation, and the README says not to migrate those
   cards to the new descriptor — they are the other option, not a half-migrated
   one. Matthew asked for the ember-bone COLOURWAY, and a card in his pocket that
   drops lawn would contradict the descriptor decision of 2026-09-28 and the
   cards already printed. The colourway moved; the copy did not. */
const SHARED_EMAIL = 'Contact@SixfoldColorado.com';
const PEOPLE = [
  { file: 'card-brandon', name: 'Brandon Long', title: 'Owner',
    phone: '(303) 915-1045', email: SHARED_EMAIL, colourway: 'cascade-pine',
    note: 'REGRESSION CHECK — diff against card-cascade-final.html. Printed; do not reorder.' },
  { file: 'card-brad', name: 'Brad McPherson', title: null,
    phone: '(303) 945-1514', email: SHARED_EMAIL, colourway: 'cascade-pine',
    note: 'Same card as the printed one, new name and number.' },
  { file: 'card-matthew', name: 'Matthew Sharpe', title: 'CTO',
    phone: '(803) 260-7359', email: 'M.Sharpe@SixfoldColorado.com', colourway: 'ember-bone',
    note: 'Ember on Bone, personal address, CTO. Asked for 2026-10-01.' },
];

function page(p) {
  const c = COLOURWAYS[p.colourway];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sixfold business card — ${p.name}, ${c.label}</title>
<style>
  /* 3.75 x 2.25 in = a 3.5 x 2 in card plus 0.125 in bleed on every side.
     Two pages: 1 front, 2 back. Render at scale 1 — see tools/html-to-pdf.mjs. */
  @page { size: 3.75in 2.25in; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: "Cascadia Mono", Consolas, "SFMono-Regular", monospace; }

  .page { position: relative; width: 3.75in; height: 2.25in; background: ${c.bg};
    overflow: hidden; page-break-after: always; break-after: page;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  /* 0.30in from the page edge = 0.175in inside the trim. FedEx asks for nothing
     important within 0.125in of the trim; this still clears the guard. */
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

  /* ---- FRONT ---- */
  .wordmark { font-family: "Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
    font-size: 21pt; letter-spacing: -.35pt; line-height: 1; color: ${c.ink}; }
  .band { font-size: 6.2pt; letter-spacing: 3.5pt; color: ${c.band}; margin-top: 5pt; }
  .co   { font-size: 6.2pt; letter-spacing: 3.9pt; color: ${c.co}; margin-top: 3pt; }

  /* ---- BACK ---- */
  .back { display: flex; gap: .13in; align-items: stretch; height: 100%; }
  .info { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column;
    justify-content: space-between; }
  .nm  { font-family: "Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
    font-size: 12pt; line-height: 1.1; color: ${c.ink}; }
  .ti  { font-size: 6.2pt; letter-spacing: 1.4pt; text-transform: uppercase; color: ${c.ti}; margin-top: 2pt; }
  .dt  { font-size: 7pt; line-height: 1.8; color: ${c.ink}; }
  .dt .web { color: ${c.web}; }
  .svc { font-size: 6.2pt; letter-spacing: 1.2pt; color: ${c.svc}; }

  .qrwrap { flex: 0 0 auto; display: flex; flex-direction: column;
    align-items: center; justify-content: center; }
  /* The plate is padding around the image. The image already carries the
     4-module quiet zone; this only ever adds to it. */
  .plate { background: ${c.plate}; padding: ${QR_PAD}in; border-radius: .055in;
    line-height: 0; }
  .plate img { display: block; width: ${QR_IMG}in; height: ${QR_IMG}in; }
  .qrcap { font-size: 6pt; letter-spacing: 1.1pt; text-transform: uppercase;
    color: ${c.qrcap}; margin-top: 3.5pt; text-align: center; }
</style>
</head>
<body>

<!-- PAGE 1 — FRONT -->
<div class="page">
  <div class="pad" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
    ${mark(c.mark)}
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
          <div class="nm">${p.name}</div>${p.title ? `
          <div class="ti">${p.title}</div>` : ''}
        </div>
        <div class="dt">
          ${p.phone}<br>
          ${p.email}<br>
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
}

/* ⚑ THE CONTACT COLUMN IS THE TIGHT DIMENSION, and the email is its longest
   line. Inner width 3.15in, less the QR plate (1.22 + 2x0.055) and the 0.13in
   gap, leaves ~1.69in. Cascadia Mono at 7pt advances 0.6em = 0.0583in a glyph,
   so the budget is about 29 characters. This is an estimate off the metric, not
   a measurement — it exists to catch a long address before the render, never
   instead of looking at the render. */
const COL_IN = 3.75 - 0.30 * 2 - (QR_IMG + QR_PAD * 2) - 0.13;
const CH_IN = 7 / 72 * 0.6;
for (const p of PEOPLE) {
  writeFileSync(join(HERE, `${p.file}.html`), page(p));
  console.log(`wrote ${p.file}.html  —  ${p.name}${p.title ? ', ' + p.title : ' (no title)'}  ·  ${p.phone}  ·  ${p.email}  ·  ${COLOURWAYS[p.colourway].label}`);
  const w = p.email.length * CH_IN;
  const pct = (w / COL_IN) * 100;
  console.log(`   email ${p.email.length} chars ≈ ${w.toFixed(3)}in of ${COL_IN.toFixed(3)}in (${pct.toFixed(0)}%)${pct > 100 ? '  ⚑ OVERFLOWS — it will wrap' : pct > 92 ? '  ⚑ within 8% of the edge — LOOK at the render' : ''}`);
}

/* ---- contrast, per colourway ----------------------------------------------- */
let failed = 0;
for (const key of [...new Set(PEOPLE.map((p) => p.colourway))]) {
  const c = COLOURWAYS[key];
  console.log(`\nMARK CASCADE — ${c.label}, each stop against its own ground`);
  for (const [what, hex] of c.ramp) {
    const r = contrast(hex, c.bg);
    const bad = r < 3;
    if (bad) failed++;
    console.log(`  ${what.padEnd(12)} ${hex}  ${r.toFixed(2).padStart(5)}:1${bad ? '  ⚑ UNDER 3:1' : ''}`);
  }
  const rootR = contrast(c.mark.roots, c.bg);
  console.log(`  ⚑ roots are hairlines (0.15–0.32 mm) and carry ${rootR.toFixed(2)}:1 — the most contrast in the ramp${rootR === Math.max(...c.ramp.map(([, h]) => contrast(h, c.bg))) ? '' : '  ⚑ NOT THE MAXIMUM — CHECK'}`);

  console.log(`  TYPE — name ${contrast(c.ink, c.bg).toFixed(2)}:1 · band ${contrast(c.band, c.bg).toFixed(2)}:1 · web ${contrast(c.web, c.bg).toFixed(2)}:1 · services ${contrast(c.svc.startsWith('rgba') ? '#EDE7DC' : c.svc, c.bg).toFixed(2)}:1`);
}

console.log('\nQR — identical on every card, so one code is in circulation, not three');
console.log(`  image placed at   ${QR_IMG}in = ${(QR_IMG * 25.4).toFixed(1)}mm`);
console.log(`  modules           ${qrModulesMm.toFixed(1)}mm  (80.5% of the image; the rest is the 4-module quiet zone)`);
console.log(`  floor 20mm: ${qrModulesMm >= 20 ? 'PASS' : 'FAIL'}   comfortable 25mm: ${qrModulesMm >= 25 ? 'PASS' : 'under — see the README trade-off'}`);
console.log(`\nroots carried: ${ROOTS.length}/10 on every card`);
if (failed) { console.error(`\n⚑ ${failed} stop(s) under 3:1 — do not send to print.`); process.exit(1); }
