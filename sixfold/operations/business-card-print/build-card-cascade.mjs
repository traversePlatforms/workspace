/* Sixfold — business card, CASCADING MARK. 2026-09-29.

   Third study, and the one Matthew actually described: one tree starts off much
   lighter and the mark gets progressively darker as the ridge climbs.

   ⚑ THE MARK HAS FOUR MASSES, NOT THREE. build-card-marks.mjs stepped only the
   ridge and left the conifer out of the ramp, which is why that set never looked
   like a cascade. In height order, left to right:

       1. the conifer        the fir at the front, shortest        <- lightest
       2. the left mass      apex y=38
       3. the middle peak    apex y=26
       4. the tall peak      apex y=14                             <- darkest

   So the ramp has four stops, and the conifer is the "1 tree" that starts light.

   ⚑ HOW DARK THE LAST STOP MAY GO. On a Pine ground a shape exists only by being
   lighter than it. Measured against #0E1512, Turf #2F7A4F is 3.54:1 — clear of
   the 3:1 floor for a graphical mass, and the darkest brand green that is. The
   ramp therefore ends at Turf. Anything past it starts dissolving into the card.

   ⚑ ROOTS STAY AT THE LIGHTEST STOP, ALWAYS, and are never in the ramp. They are
   0.15-0.32 mm hairlines at card size — the first thing a press drops. They need
   the most contrast on the card, not the least, and they sit below the ground bar
   where the cascade is lightest anyway. Floor for them is 5:1, not 3:1.

   ⚑ GRADIENT VARIANTS USE userSpaceOnUse, DELIBERATELY. With the default
   objectBoundingBox each path gets its own copy of the ramp, so the conifer would
   run light-to-dark all by itself and the cascade would break into four separate
   fades. userSpaceOnUse makes one ramp span the whole mark.

   ⚑ ROOTS + the compound-path split: see build-card-marks.mjs for the split
   verification (41 bytes of 1,382,400, edge antialiasing only).

   Run:  node sixfold/operations/business-card-print/build-card-cascade.mjs      */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRAND = join(HERE, '..', '..', 'brand');

const PINE = '#0E1512', BONE = '#EDE7DC';
const SAGE = '#A7BE93', MOSS = '#8AA07A', TURF = '#2F7A4F';
const FERN = '#6E8C61';   // between Moss and Turf
const MIST = '#C3D4B4';   // a step lighter than Sage
const FROST = '#DCE7D2';  // lighter again — the "much lighter" start

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

/* ---- geometry -------------------------------------------------------------- */
const flat = readFileSync(join(BRAND, 'sixfold-mark-ridge-flat.svg'), 'utf8');
const ridgeD = flat.match(/<path fill="#E4703A"[^>]*d="([^"]+)"/)[1];
const subs = ridgeD.split(/(?=M)/).filter(Boolean);
if (subs.length !== 7) throw new Error(`ridge split: expected 7 subpaths, got ${subs.length}`);
const MASS = { low: [0, 1, 2, 3, 4].map((i) => subs[i]).join(''), mid: subs[5], high: subs[6] };
const conifer = flat.match(/<path fill="#8AA07A"[^>]*d="(M9\.5[^"]+)"/)[1];
const groundBar = flat.match(/<path fill="#8AA07A" d="(M4 86[^"]+)"/)[1];

const master = readFileSync(join(BRAND, 'sixfold-mark-ridge.svg'), 'utf8');
const rootGroup = master.slice(master.lastIndexOf('<g fill="none"'), master.lastIndexOf('</g>'));
const ROOTS = rootGroup.split('\n').filter((l) => l.includes('stroke-width')).map((l) => l.trim());
if (ROOTS.length !== 10) throw new Error(`expected 10 root strokes, got ${ROOTS.length}`);

/* stops: [conifer, lowMass, midPeak, tallPeak] lightest -> darkest
   grad:  {from:[x,y], to:[x,y], light, dark} in viewBox units, userSpaceOnUse */
function mark({ stops, grad, ground, root, id }) {
  let defs = '', ridge, tree, bar;
  if (grad) {
    defs = `<defs><linearGradient id="c${id}" gradientUnits="userSpaceOnUse"`
      + ` x1="${grad.from[0]}" y1="${grad.from[1]}" x2="${grad.to[0]}" y2="${grad.to[1]}">`
      + `<stop offset="0" stop-color="${grad.light}"/><stop offset="1" stop-color="${grad.dark}"/>`
      + `</linearGradient></defs>`;
    const f = `url(#c${id})`;
    ridge = `<path fill="${f}" fill-rule="evenodd" d="${ridgeD}"/>`;
    tree = `<path fill="${f}" fill-rule="evenodd" d="${conifer}"/>`;
    bar = `<path fill="${f}" d="${groundBar}"/>`;
  } else {
    const [c, lo, mi, hi] = stops;
    ridge = `<path fill="${lo}" fill-rule="evenodd" d="${MASS.low}"/>`
      + `<path fill="${mi}" fill-rule="evenodd" d="${MASS.mid}"/>`
      + `<path fill="${hi}" fill-rule="evenodd" d="${MASS.high}"/>`;
    tree = `<path fill="${c}" fill-rule="evenodd" d="${conifer}"/>`;
    bar = `<path fill="${ground}" d="${groundBar}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 116" width="76" height="88" role="img" aria-label="Sixfold mark, Ridge">`
    + defs + ridge + tree + bar
    + `<g fill="none" stroke="${root}" stroke-linecap="round" stroke-linejoin="round">${ROOTS.join('')}</g>`
    + `</svg>`;
}

const BAND = 'LAWN, LAND &amp; FIRE';
const SVC = 'AERATION &middot; LAWN CARE &middot; LANDSCAPING &middot; FIRE';

const variants = [
  { file: 'casc-1-brand', name: '1 — Four steps, brand shades',
    m: { stops: [MIST, SAGE, MOSS, TURF], ground: MIST, root: MIST },
    used: [MIST, SAGE, MOSS, TURF], root: MIST,
    note: 'Mist → Sage → Moss → Turf. Even spacing, every stop an existing brand green.' },

  { file: 'casc-2-wide', name: '2 — Four steps, wide start',
    m: { stops: [FROST, SAGE, FERN, TURF], ground: FROST, root: FROST },
    used: [FROST, SAGE, FERN, TURF], root: FROST,
    note: 'Starts much lighter and drops harder. The clearest read of the four at arm’s length.' },

  { file: 'casc-3-diagonal', name: '3 — One gradient, along the climb',
    m: { grad: { from: [4, 91], to: [98, 14], light: FROST, dark: TURF }, root: FROST },
    used: [FROST, TURF], root: FROST,
    note: 'A single ramp running low-left to high-right, the axis the ridge actually climbs.' },

  { file: 'casc-4-vertical', name: '4 — One gradient, bottom to top',
    m: { grad: { from: [0, 91], to: [0, 14], light: FROST, dark: TURF }, root: FROST },
    used: [FROST, TURF], root: FROST,
    note: 'Straight vertical. Every mass shares the height ramp, so short things stay light.' },
];

function page(v, i) {
  const markSvg = mark({ ...v.m, id: i });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sixfold business card — cascade ${v.name}</title>
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
  .pad { position: absolute; inset: 0.345in; }

  @media screen {
    body { background: #4A5550; padding: 24px; display: flex; gap: 24px; flex-wrap: wrap; }
    .page { box-shadow: 0 6px 24px rgba(0,0,0,.4); }
    .page::after { content: ""; position: absolute; inset: 0.125in;
      border: 0.4pt dashed rgba(255,255,255,.35); pointer-events: none; }
  }

  .wordmark { font-family: "Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
    font-size: 19pt; letter-spacing: -.3pt; line-height: 1; color: ${BONE}; }
  .nm  { font-family: "Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
    font-size: 12pt; line-height: 1.1; color: ${BONE}; }
  .ti  { font-size: 5.8pt; letter-spacing: 1.4pt; text-transform: uppercase; color: ${MOSS}; margin-top: 2pt; }
  .dt  { font-size: 6.6pt; line-height: 1.85; color: ${BONE}; }
  .dt .web { color: ${SAGE}; }
  .svc { font-size: 5.6pt; letter-spacing: 1.2pt; color: rgba(237,231,220,.5); }
  .band { font-size: 5.4pt; letter-spacing: 3.2pt; color: ${MOSS}; margin-top: 4pt; }
  .co   { font-size: 5.2pt; letter-spacing: 3.6pt; color: rgba(237,231,220,.55); margin-top: 2.5pt; }
</style>
</head>
<body>

<!-- PAGE 1 — FRONT -->
<div class="page">
  <div class="pad" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
    ${markSvg}
    <div class="wordmark" style="margin-top:3pt">Sixfold</div>
    <div class="band">${BAND}</div>
    <div class="co">COLORADO</div>
  </div>
</div>

<!-- PAGE 2 — BACK -->
<div class="page">
  <div class="pad" style="display:flex;flex-direction:column;justify-content:space-between">
    <div>
      <div class="nm">Brandon Long</div>
      <div class="ti">Owner</div>
    </div>
    <div class="dt">
      (303) 915-1045<br>
      Contact@SixfoldColorado.com<br>
      <span class="web">SixfoldColorado.com</span>
    </div>
    <div class="svc">${SVC}</div>
  </div>
</div>

</body>
</html>
`;
}

variants.forEach((v, i) => writeFileSync(join(HERE, `card-${v.file}.html`), page(v, i)));
console.log('wrote ' + variants.map((v) => `card-${v.file}.html`).join(', '));

const NAMES = { [FROST]: 'Frost', [MIST]: 'Mist', [BONE]: 'Bone', [SAGE]: 'Sage',
  [MOSS]: 'Moss', [FERN]: 'Fern', [TURF]: 'Turf' };
const MASS_FLOOR = 3, ROOT_FLOOR = 5;

console.log('\nTHE RAMP — each stop against the Pine ground #0E1512');
console.log('  variant            stops (light -> dark)                        darkest');
const bad = [];
for (const v of variants) {
  const ramp = v.used.map((h) => `${NAMES[h]} ${contrast(h, PINE).toFixed(1)}`).join('  ');
  const darkest = v.used.reduce((a, b) => (contrast(a, PINE) < contrast(b, PINE) ? a : b));
  const c = contrast(darkest, PINE);
  if (c < MASS_FLOOR) bad.push(`${v.file}: ${NAMES[darkest]} ${c.toFixed(2)}:1 under ${MASS_FLOOR}:1`);
  const rc = contrast(v.root, PINE);
  if (rc < ROOT_FLOOR) bad.push(`${v.file}: roots ${rc.toFixed(2)}:1 under ${ROOT_FLOOR}:1`);
  console.log(`  ${v.file.padEnd(17)}  ${ramp.padEnd(42)}  ${c.toFixed(2)}:1`);
}
console.log('\n  Masses need 3:1 against the ground. ROOTS need 5:1 — they are 0.15-0.32 mm');
console.log('  hairlines and are the first thing a press drops, so they never join the ramp.');
console.log(bad.length ? `\n⚑ ${bad.join(' · ')}` : '\n✅ every stop clears its floor; roots are at the lightest stop on all four.');
