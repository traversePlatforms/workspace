/* Sixfold — business card, GREEN GROUND STUDY. 2026-09-29.

   The crew picked `card-green-pine`. Matthew then asked for shades of green to
   choose between, and for versions where the green "cascades" darker toward the
   top. A colleague wants it darker; the stated fear is that it stops reading as
   green and just looks black.

   ⚑ THAT FEAR IS THE WHOLE POINT OF THIS FILE, so it is measured, not eyeballed.

   The existing card's ground is PINE #0E1512, which is HSL lightness ~7% — it is
   already, honestly, a black with a green cast. "Darker" is therefore the wrong
   axis: there is nowhere below it to go. What the colleague is asking for is a
   ground that reads as GREEN and is DEEP, which means going *up* in lightness
   from Pine while holding saturation.

   THE FLOOR, and why it is where it is:
     - Below about L=12% almost any hue reads as black at business-card size.
     - CMYK conversion on a digital press costs roughly another 3-5 points of
       lightness, and the README already warns the greens come back duller.
     - So the darkest ground here is L=15%, leaving headroom for that shift.
   Every ground is reported below with its lightness, its luminance, and its
   contrast against the Bone type. Nothing is chosen by eye.

   ⚑ ROOTS. The mark is assembled EXACTLY as in build-cards.mjs — flat master for
   the peaks, root group lifted verbatim from the layered master, viewBox 116.
   Swapping to the flat file alone silently deletes the ten root strokes. This
   has already happened once. Do not "simplify" the mark assembly below.

   Run:  node sixfold/operations/business-card-print/build-card-greens.mjs       */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRAND = join(HERE, '..', '..', 'brand');

const PINE = '#0E1512', BONE = '#EDE7DC';
const SAGE = '#A7BE93', MOSS = '#8AA07A';

/* ---- colour maths, so the "is it still green" question has an answer -------- */
const hsl = (h, s, l) => {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c);
  };
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
};
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
/* HSL lightness, the number the "fades to black" judgement actually rests on */
const light = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  return ((Math.max(r, g, b) + Math.min(r, g, b)) / 2) * 100;
};
const sat = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return 0;
  return ((mx - mn) / (1 - Math.abs(2 * l - 1))) * 100;
};

/* ---- the mark, assembled from the two brand files (see the ROOTS note) ----- */
const flat = readFileSync(join(BRAND, 'sixfold-mark-ridge-flat.svg'), 'utf8');
const flatBody = flat.slice(flat.indexOf('>', flat.indexOf('<svg')) + 1, flat.lastIndexOf('</svg>'))
  .replace(/<title>[\s\S]*?<\/title>\s*/, '').replace(/<!--[\s\S]*?-->\s*/, '').trim();

const master = readFileSync(join(BRAND, 'sixfold-mark-ridge.svg'), 'utf8');
const rootGroup = master.slice(master.lastIndexOf('<g fill="none"'), master.lastIndexOf('</g>'));
const ROOTS = rootGroup.split('\n').filter((l) => l.includes('stroke-width')).map((l) => l.trim());
if (ROOTS.length !== 10) throw new Error(`expected 10 root strokes, got ${ROOTS.length}`);

function mark({ peak, growth }) {
  const body = flatBody.split('#E4703A').join(peak).split('#8AA07A').join(growth);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 116" width="76" height="88" role="img" aria-label="Sixfold mark, Ridge">`
    + body
    + `<g fill="none" stroke="${growth}" stroke-linecap="round" stroke-linejoin="round">${ROOTS.join('')}</g>`
    + `</svg>`;
}

const BAND = 'LAWN, LAND &amp; FIRE';
const SVC = 'AERATION &middot; LAWN CARE &middot; LANDSCAPING &middot; FIRE';

/* ---- the grounds ----------------------------------------------------------
   Hue held near TURF's 146 so these are the brand's green, not a new one.
   Saturation rises slightly as they darken: a deep colour needs more chroma to
   keep reading as a hue rather than as a neutral.                             */
const G_DEEP  = hsl(152, 52, 19);   // the floor for a FLAT ground: L-4 still clears 15
const G_MID   = hsl(150, 48, 24);
const G_OPEN  = hsl(148, 44, 30);
/* A gradient top may go darker than a flat ground can. It is a narrow band read
   against the lighter foot below it, so the eye takes it as deep green rather
   than as black — which a whole card at that value would not survive. */
const G_CASC_TOP_A = hsl(154, 55, 15), G_CASC_BOT_A = hsl(148, 46, 26);
const G_CASC_TOP_B = hsl(156, 58, 15), G_CASC_BOT_B = hsl(146, 44, 30);

const variants = [
  { file: 'green-0-pine', name: '0 — Pine, the current card (control)',
    bg: PINE, flat: PINE, ink: BONE, bandCol: MOSS, ti: MOSS, web: SAGE,
    muted: 'rgba(237,231,220,.5)', co: 'rgba(237,231,220,.55)', markCol: SAGE,
    note: 'What was picked. Included only so the others are judged against it, not from memory.' },

  { file: 'green-1-deep', name: '1 — Deep, the floor',
    bg: G_DEEP, flat: G_DEEP, ink: BONE, bandCol: MOSS, ti: MOSS, web: SAGE,
    muted: 'rgba(237,231,220,.52)', co: 'rgba(237,231,220,.58)', markCol: SAGE,
    note: 'The darkest green here. Anything below this reads black in print.' },

  { file: 'green-2-mid', name: '2 — Mid',
    bg: G_MID, flat: G_MID, ink: BONE, bandCol: SAGE, ti: SAGE, web: SAGE,
    muted: 'rgba(237,231,220,.56)', co: 'rgba(237,231,220,.6)', markCol: SAGE,
    note: 'Unmistakably green at arm’s length. Accents lifted Moss → Sage to hold separation.' },

  { file: 'green-3-open', name: '3 — Open',
    bg: G_OPEN, flat: G_OPEN, ink: BONE, bandCol: SAGE, ti: SAGE, web: BONE,
    muted: 'rgba(237,231,220,.74)', co: 'rgba(237,231,220,.78)', markCol: BONE,
    note: 'The lightest that still carries Bone type. Mark and URL go Bone — Sage is too close here.' },

  { file: 'green-4-cascade', name: '4 — Cascade, dark at the top',
    bg: `linear-gradient(to top, ${G_CASC_BOT_A}, ${G_CASC_TOP_A})`,
    flat: G_CASC_TOP_A, alt: G_CASC_BOT_A, ink: BONE, bandCol: SAGE, ti: SAGE, web: SAGE,
    muted: 'rgba(237,231,220,.56)', co: 'rgba(237,231,220,.6)', markCol: SAGE,
    note: 'Darkest at the top, lighter at the foot — so the mark’s roots sit in the lighter ground.' },

  { file: 'green-5-cascade-wide', name: '5 — Cascade, wide',
    bg: `linear-gradient(to top, ${G_CASC_BOT_B}, ${G_CASC_TOP_B})`,
    flat: G_CASC_TOP_B, alt: G_CASC_BOT_B, ink: BONE, bandCol: SAGE, ti: SAGE, web: BONE,
    muted: 'rgba(237,231,220,.74)', co: 'rgba(237,231,220,.78)', markCol: BONE,
    note: 'The same idea with a much longer travel. Most likely of the six to band on press.' },
];

function page(v) {
  const markSvg = mark({ peak: v.markCol, growth: v.markCol });
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

  .page { position: relative; width: 3.75in; height: 2.25in; background: ${v.bg};
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
    font-size: 19pt; letter-spacing: -.3pt; line-height: 1; color: ${v.ink}; }
  .nm  { font-family: "Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
    font-size: 12pt; line-height: 1.1; color: ${v.ink}; }
  .ti  { font-size: 5.8pt; letter-spacing: 1.4pt; text-transform: uppercase; color: ${v.ti}; margin-top: 2pt; }
  .dt  { font-size: 6.6pt; line-height: 1.85; color: ${v.ink}; }
  .dt .web { color: ${v.web}; }
  .svc { font-size: 5.6pt; letter-spacing: 1.2pt; color: ${v.muted}; }
  .band { font-size: 5.4pt; letter-spacing: 3.2pt; color: ${v.bandCol}; margin-top: 4pt; }
  .co   { font-size: 5.2pt; letter-spacing: 3.6pt; color: ${v.co}; margin-top: 2.5pt; }
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

for (const v of variants) writeFileSync(join(HERE, `card-${v.file}.html`), page(v));
console.log('wrote ' + variants.map((v) => `card-${v.file}.html`).join(', '));

/* ---- the measurements, which are the actual deliverable --------------------

   ⚑ SHIFT IS AN ASSUMPTION, NOT A MEASUREMENT. Nobody here has run a CMYK proof
   of these greens. 4 points of lightness is a deliberately conservative
   allowance for what a digital press takes off a saturated dark green; the
   README's existing warning ("comes back duller and browner") is qualitative and
   gives no number. If FedEx returns a proof, measure it and correct this.      */
const FLOOR_FLAT = 15;   // a whole card at less than this reads black
const FLOOR_GRAD = 10;   // a gradient's top band may go lower — see the note above it
const SHIFT = 4;         // assumed lightness lost to CMYK. NOT measured.

/* the muted service line and the COLORADO line are rgba over the ground, so the
   only honest contrast figure is the composited colour, not the source. */
const over = (rgba, groundHex) => {
  const m = rgba.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if (!m) return rgba;
  const a = Number(m[4]), g = rgb(groundHex);
  const c = [1, 2, 3].map((i) => Math.round(Number(m[i]) * a + g[i - 1] * (1 - a)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};

console.log('\nGROUND COLOURS — "does it still read green, or has it gone black?"');
console.log('  variant                    hex       HSL-L  sat   after CMYK  floor  verdict');
let worst = [];
for (const v of variants) {
  const stops = v.alt ? [['top', v.flat], ['foot', v.alt]] : [['', v.flat]];
  for (const [where, hex] of stops) {
    const L = light(hex), S = sat(hex), after = L - SHIFT;
    const floor = where === 'top' ? FLOOR_GRAD : FLOOR_FLAT;
    const verdict = after < floor ? 'READS BLACK' : after < floor + 3 ? 'borderline' : 'reads green';
    if (verdict !== 'reads green') worst.push(`${v.file}${where ? ' ' + where : ''} (${verdict})`);
    const label = (v.name.split(' —')[0] + (where ? ` (${where})` : '')).padEnd(25);
    console.log(`  ${label}  ${hex}  ${L.toFixed(1).padStart(5)}% ${S.toFixed(0).padStart(3)}%  ${after.toFixed(1).padStart(7)}%   ${String(floor).padStart(4)}   ${verdict}`);
  }
}

console.log('\nTYPE CONTRAST — measured on the LIGHTEST part of each ground (worst case)');
console.log('  variant       ground    Bone body   accent/URL     service line');
for (const v of variants) {
  const ground = v.alt ?? v.flat;
  const svc = over(v.muted, ground);
  const bone = contrast(BONE, ground), acc = contrast(v.web, ground), mut = contrast(svc, ground);
  const flag = (n, min) => `${n.toFixed(1).padStart(4)}:1${n < min ? ' !' : '  '}`;
  console.log(`  ${v.name.split(' —')[0].padEnd(11)}  ${ground}  ${flag(bone, 4.5)}     ${v.web} ${flag(acc, 3)}  ${flag(mut, 3)}`);
}
console.log('\n  4.5:1 is the body-text threshold, 3:1 the floor for small incidental type.');
console.log('  ! marks anything under. These are screen values — CMYK will take a little off.');
console.log(worst.length
  ? `\n⚑ NOT CLEAN: ${worst.join(', ')}`
  : '\n✅ Every ground clears its floor with the CMYK allowance applied.');
