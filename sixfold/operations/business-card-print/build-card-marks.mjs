/* Sixfold — business card, MARK COLOUR STUDY. 2026-09-29.

   Follows build-card-greens.mjs. Matthew's instruction: leave the ground BLACK
   and put the shades into the trees instead.

   ⚑ THE FINDING THAT SHAPES THE WHOLE SET. On a Pine ground, "darker as it goes
   up" fights the ground. The card is nearly black, so a shape only exists to the
   eye by being LIGHTER than it — take a peak down toward Turf and it stops being
   a peak and becomes a hole. Every shade below is therefore measured against
   Pine, with a visibility floor, and the set carries BOTH directions so the
   difference can be seen rather than argued:

     3  steps DARKER toward the top — the literal request
     2  steps LIGHTER toward the top — the same idea, inverted, which is also
        what a real ridge does at dawn

   ⚑ THE RIDGE IS ONE COMPOUND PATH and is split here into three masses so the
   peaks can take separate colours. That split was verified before use: rendered
   against the unsplit original at 600px, 41 bytes of 1,382,400 differ, max delta
   2 — edge antialiasing only, no fill-rule change. If the geometry in
   build-mark-flat.mjs ever changes, re-run that check before trusting the split.

   ⚑ ROOTS. Same assembly as build-cards.mjs — flat master for the peaks, root
   group lifted verbatim from the layered master, viewBox 116. Swapping to the
   flat file alone silently deletes the ten root strokes. Do not "simplify" it.

   Run:  node sixfold/operations/business-card-print/build-card-marks.mjs        */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRAND = join(HERE, '..', '..', 'brand');

const PINE = '#0E1512', BONE = '#EDE7DC';
const SAGE = '#A7BE93', MOSS = '#8AA07A', TURF = '#2F7A4F';
/* two extra steps so a three-stop ramp does not have to reuse a brand value */
const FERN = '#6E8C61';   // between Moss and Turf
const MIST = '#C3D4B4';   // one step lighter than Sage

/* ---- colour maths ---------------------------------------------------------- */
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

/* ---- the mark, split so the three ridge masses can be coloured apart ------- */
const flat = readFileSync(join(BRAND, 'sixfold-mark-ridge-flat.svg'), 'utf8');
const ridgeD = flat.match(/<path fill="#E4703A"[^>]*d="([^"]+)"/)[1];
const subs = ridgeD.split(/(?=M)/).filter(Boolean);
if (subs.length !== 7) throw new Error(`ridge split: expected 7 subpaths, got ${subs.length}`);
/* 0,1,2,3,4 are the left mass and its slivers · 5 the middle peak · 6 the tall one */
const MASS = { low: [0, 1, 2, 3, 4].map((i) => subs[i]).join(''), mid: subs[5], high: subs[6] };

const conifer = flat.match(/<path fill="#8AA07A"[^>]*d="(M9\.5[^"]+)"/)[1];
const groundBar = flat.match(/<path fill="#8AA07A" d="(M4 86[^"]+)"/)[1];

const master = readFileSync(join(BRAND, 'sixfold-mark-ridge.svg'), 'utf8');
const rootGroup = master.slice(master.lastIndexOf('<g fill="none"'), master.lastIndexOf('</g>'));
const ROOTS = rootGroup.split('\n').filter((l) => l.includes('stroke-width')).map((l) => l.trim());
if (ROOTS.length !== 10) throw new Error(`expected 10 root strokes, got ${ROOTS.length}`);

/* grad: optional {top, bottom} painted across the whole ridge instead of per-mass */
function mark({ low, mid, high, tree, ground, root, grad, id }) {
  const defs = grad
    ? `<defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">`
      + `<stop offset="0" stop-color="${grad.top}"/><stop offset="1" stop-color="${grad.bottom}"/>`
      + `</linearGradient></defs>`
    : '';
  const ridgeFill = grad ? `url(#g${id})` : null;
  const ridge = grad
    ? `<path fill="${ridgeFill}" fill-rule="evenodd" d="${ridgeD}"/>`
    : `<path fill="${low}" fill-rule="evenodd" d="${MASS.low}"/>`
      + `<path fill="${mid}" fill-rule="evenodd" d="${MASS.mid}"/>`
      + `<path fill="${high}" fill-rule="evenodd" d="${MASS.high}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 116" width="76" height="88" role="img" aria-label="Sixfold mark, Ridge">`
    + defs + ridge
    + `<path fill="${tree}" fill-rule="evenodd" d="${conifer}"/>`
    + `<path fill="${ground}" d="${groundBar}"/>`
    + `<g fill="none" stroke="${root}" stroke-linecap="round" stroke-linejoin="round">${ROOTS.join('')}</g>`
    + `</svg>`;
}

const BAND = 'LAWN, LAND &amp; FIRE';
const SVC = 'AERATION &middot; LAWN CARE &middot; LANDSCAPING &middot; FIRE';

const variants = [
  { file: 'mark-0-flat', name: '0 — Sage throughout (the current card)',
    m: { low: SAGE, mid: SAGE, high: SAGE, tree: SAGE, ground: SAGE, root: SAGE },
    shades: { ridge: [SAGE], tree: SAGE },
    note: 'The control. One ink, one value — included so the rest are judged against it.' },

  { file: 'mark-1-twotone', name: '1 — Two-tone: ridge Sage, growth Moss',
    m: { low: SAGE, mid: SAGE, high: SAGE, tree: MOSS, ground: MOSS, root: MOSS },
    shades: { ridge: [SAGE], tree: MOSS },
    note: 'Separates rock from growth without stepping the peaks. The quietest change here.' },

  { file: 'mark-2-lighter-up', name: '2 — Stepped, LIGHTER toward the top',
    m: { low: FERN, mid: MOSS, high: MIST, tree: MOSS, ground: FERN, root: FERN },
    shades: { ridge: [FERN, MOSS, MIST], tree: MOSS },
    note: 'Back mass darkest, tall peak lightest. Reads as depth and as light hitting the ridge.' },

  { file: 'mark-3-darker-up', name: '3 — Stepped, DARKER toward the top (as asked)',
    m: { low: MIST, mid: MOSS, high: TURF, tree: SAGE, ground: MIST, root: MIST },
    shades: { ridge: [MIST, MOSS, TURF], tree: SAGE },
    note: 'The literal request. Watch the tall peak against Pine — it is the one at risk.' },

  { file: 'mark-4-grad-dark-up', name: '4 — Gradient, dark at the top',
    m: { tree: SAGE, ground: SAGE, root: SAGE, grad: { top: TURF, bottom: MIST } },
    shades: { ridge: [TURF, MIST], tree: SAGE },
    note: 'The same idea as 3 but smooth instead of stepped. Gradient, so see the banding note.' },

  { file: 'mark-5-grad-light-up', name: '5 — Gradient, light at the top',
    m: { tree: MOSS, ground: MOSS, root: MOSS, grad: { top: MIST, bottom: FERN } },
    shades: { ridge: [MIST, FERN], tree: MOSS },
    note: 'Inverted. On a black ground this is the one that holds its shape at arm’s length.' },
];

function page(v, i) {
  const markSvg = mark({ ...v.m, id: i });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sixfold business card — ${v.name}</title>
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

/* ---- visibility against the black ground ----------------------------------
   A shape on a dark ground is only visible by being lighter than it. 3:1 is the
   accepted floor for a graphical element; below about 2:1 a peak stops reading
   as a peak at card size. These are screen values — CMYK will take a little off,
   same unmeasured caveat as the ground study.                                 */
const FLOOR = 3;
console.log('\nSHADES vs the Pine ground #0E1512 — can you still see it?');
console.log('  shade          hex       contrast   verdict');
const NAMES = { [MIST]: 'Mist', [SAGE]: 'Sage', [MOSS]: 'Moss', [FERN]: 'Fern', [TURF]: 'Turf' };
for (const [hex, nm] of Object.entries(NAMES)) {
  const c = contrast(hex, PINE);
  const verdict = c < 2 ? 'DISAPPEARS' : c < FLOOR ? 'weak — only for a large mass' : 'clear';
  console.log(`  ${nm.padEnd(13)}  ${hex}  ${c.toFixed(2).padStart(6)}:1   ${verdict}`);
}

console.log('\nPER VARIANT — the weakest element on the card');
let flagged = [];
for (const v of variants) {
  const used = [...v.shades.ridge, v.shades.tree];
  const worstHex = used.reduce((a, b) => (contrast(a, PINE) < contrast(b, PINE) ? a : b));
  const c = contrast(worstHex, PINE);
  if (c < FLOOR) flagged.push(`${v.file} (${NAMES[worstHex]} at ${c.toFixed(2)}:1)`);
  console.log(`  ${v.name.split(' —')[0].padEnd(4)} ${v.file.padEnd(20)} weakest ${NAMES[worstHex] ?? worstHex} ${c.toFixed(2).padStart(5)}:1`);
}
console.log(flagged.length
  ? `\n⚑ BELOW THE ${FLOOR}:1 FLOOR: ${flagged.join(', ')}  — expected on the darker-upward ones; that is the point of showing them.`
  : `\n✅ every element clears ${FLOOR}:1 against Pine.`);
