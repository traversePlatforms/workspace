/*
  Injects garment mockups into crew-shirt-spec.src.html and writes
  crew-shirt-spec.html beside it.

  The tee is NOT redrawn here — it is imported from the merch concept board's
  renderer (site/merch/build-merch.mjs), so the spec and the board stay one
  drawing rather than two that drift. That file now exports `tee` and `DEFS`
  and only writes its own index.html when it is RUN, not when imported.

  Run:  node operations/build-crew-shirt-spec.mjs
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tee, DEFS } from '../site/merch/build-merch.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/* Scale: the tee body spans ~196 viewBox units across the chest, and a flat-laid
   medium measures about 20 in across. So 1 in ≈ 9.8 units. Every print below is
   sized from that, which is why the left-chest lockup looks as small as it does
   — it is the real proportion, not a stylised one. */
const IN = 9.8;

const RIDGE_SOLID = `
  <path d="M18 84 L36 48 L54 84 Z"/><path d="M30 84 L50 38 L70 84 Z"/>
  <path d="M44 84 L66 26 L88 84 Z"/><path d="M60 84 L79 14 L98 84 Z"/>
  <rect x="20.4" y="77" width="3.2" height="7"/>
  <path d="M22 69 L9.5 81.5 L34.5 81.5 Z"/><path d="M22 62 L12 74 L32 74 Z"/>
  <path d="M22 55.5 L14.5 66.5 L29.5 66.5 Z"/>
  <rect x="4" y="86" width="92" height="5"/>`;

/* The mark exactly as it is drawn today, opacities intact. */
const RIDGE_OPACITY = `
  <path d="M18 84 L36 48 L54 84 Z" fill-opacity="0.42"/><path d="M30 84 L50 38 L70 84 Z" fill-opacity="0.55"/>
  <path d="M44 84 L66 26 L88 84 Z" fill-opacity="0.7"/><path d="M60 84 L79 14 L98 84 Z" fill-opacity="0.85"/>
  <rect x="20.4" y="77" width="3.2" height="7"/>
  <path d="M22 69 L9.5 81.5 L34.5 81.5 Z"/><path d="M22 62 L12 74 L32 74 Z"/>
  <path d="M22 55.5 L14.5 66.5 L29.5 66.5 Z"/>
  <rect x="4" y="86" width="92" height="5"/>`;

const mark = (x, y, inches, body) => {
  const w = inches * IN;
  return `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${(w * 99 / 94).toFixed(1)}" viewBox="4 14 94 99" fill="#0E1512">${body}</svg>`;
};

/* Ember, as a garment: lighter at the shoulder, deeper at the hem. */
const EMBER_TEE = { a: '#EC7E4C', b: '#CF5F2C', edge: 0.42, dark: true };

const SERIF = 'Palatino Linotype, Book Antiqua, Georgia, serif';
const MONO = 'ui-monospace, Consolas, monospace';
const INK = '#0E1512';

/* Left chest: mark to the left, name stacked to its right. A horizontal lockup
   uses the chest panel better than a stacked one at this width. */
function chestLockup(cx, y, inches) {
  const w = inches * IN;
  const mw = w * 0.30;
  const tx = cx - w / 2 + mw + w * 0.07;
  return '<g>'
    + mark(cx - w / 2, y, mw / IN, RIDGE_SOLID)
    + `<text x="${tx.toFixed(1)}" y="${(y + mw * 0.78).toFixed(1)}" font-family="${SERIF}" font-size="${(w * 0.235).toFixed(1)}" fill="${INK}" letter-spacing="-.2">Sixfold</text>`
    + `<text x="${(tx + 1).toFixed(1)}" y="${(y + mw * 1.10).toFixed(1)}" font-family="${MONO}" font-size="${(w * 0.090).toFixed(1)}" fill="${INK}" letter-spacing="${(w * 0.034).toFixed(2)}">COLORADO</text>`
    + '</g>';
}

/* Back: the billboard. Read from behind, across a yard, by somebody deciding
   whether to ask who you are — so the phone goes on it. */
function backLockup(cx, y, inches, body) {
  const w = inches * IN;
  const mw = w * 0.42;
  return '<g>'
    + mark(cx - mw / 2, y, mw / IN, body)
    + `<text x="${cx}" y="${(y + mw * 1.32).toFixed(1)}" text-anchor="middle" font-family="${SERIF}" font-size="${(w * 0.20).toFixed(1)}" fill="${INK}" letter-spacing="-.3">Sixfold</text>`
    + `<text x="${cx}" y="${(y + mw * 1.62).toFixed(1)}" text-anchor="middle" font-family="${MONO}" font-size="${(w * 0.068).toFixed(1)}" fill="${INK}" letter-spacing="${(w * 0.030).toFixed(2)}">COLORADO</text>`
    + `<text x="${cx}" y="${(y + mw * 2.00).toFixed(1)}" text-anchor="middle" font-family="${MONO}" font-size="${(w * 0.060).toFixed(1)}" fill="${INK}" letter-spacing="${(w * 0.010).toFixed(2)}">(303) 915-1045</text>`
    + '</g>';
}

/* Left chest sits on the WEARER's left, which on a front flat-lay is the
   viewer's right. Getting this backwards is the classic mockup error. */
const PANELS = [
  {
    cap: '<b>Left chest, 3.5 in</b>Mark and name together. The mark on its own does not tell a homeowner who is on their property.',
    svg: tee({
      label: 'Ember tee, front, Ridge mark with the Sixfold Colorado name on the left chest',
      ...EMBER_TEE, print: chestLockup(206, 104, 3.5),
    }).svg,
  },
  {
    cap: '<b>Back, 9 in</b>The billboard &mdash; read from behind, across a yard. Phone on it so a neighbour can act on it.',
    svg: tee({
      label: 'Ember tee, back, large Ridge mark over the Sixfold Colorado name and the phone number',
      ...EMBER_TEE, view: 'back', print: backLockup(170, 96, 9, RIDGE_SOLID),
    }).svg,
  },
  {
    /* Same garment, same size, opacity left in — a direct A/B with the panel
       before it. At left-chest size the two are indistinguishable, which is why
       the comparison is made on the back print. */
    cap: '<b>&#9873; Back, as the file is drawn</b>Opacity intact. Compare with the panel to the left: that separation is what a screen cannot hold.',
    svg: tee({
      label: 'Ember tee, back, the mark with its opacity values left in, which cannot be screen printed',
      ...EMBER_TEE, view: 'back', print: backLockup(170, 96, 9, RIDGE_OPACITY),
    }).svg,
  },
];

const block = `  <div class="mocks">
${PANELS.map((p) => `    <figure class="mock">${p.svg}<figcaption>${p.cap}</figcaption></figure>`).join('\n')}
  </div>
${DEFS}`;

const srcPath = join(here, 'crew-shirt-spec.src.html');
const src = readFileSync(srcPath, 'utf8');
if (!src.includes('<!--MOCKUPS-->')) throw new Error('no <!--MOCKUPS--> marker in crew-shirt-spec.src.html');
writeFileSync(join(here, 'crew-shirt-spec.html'), src.replace('<!--MOCKUPS-->', block), 'utf8');
console.log(`wrote crew-shirt-spec.html  (${PANELS.length} garment mockups)`);
