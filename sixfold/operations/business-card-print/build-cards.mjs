/* Sixfold — business cards, all four options.

   Replaces the hand-written card-a-pine-brandon.html. Four files now, because
   there are two live questions and they are independent:

     palette   GREEN (palette A, aeration-led)  vs  EMBER (the fire-led original)
     ground    PINE (black)                     vs  BONE (white)

   so: card-green-pine · card-green-bone · card-fire-pine · card-fire-bone.
   Nothing is ordered. The crew picks one combination.

   ⚑ ROOTS — the correction this file exists to carry.

   The canonical Ridge mark (brand/sixfold-mark-ridge.svg, viewBox 0 0 100 116)
   has a ROOT SYSTEM: ten stroked paths descending from under the ground bar to
   y=113. On 2026-09-28 the card's mark was swapped to the FLAT master, which is
   cropped at y=96 — above where the roots begin — so the card silently lost
   them. They had been there, reduced to the three heaviest.

   They are lifted VERBATIM from the master here rather than redrawn, and the
   viewBox goes back to 116 so they are inside it.

   Peaks still come from the FLAT mark: solid fills, no opacity. The layered
   master's translucency is what went muddy in single ink, and the roots are a
   separate group, so both can be true at once.

   ⚑ HAIRLINES. At 76px wide the finest root (0.75 units) prints about 0.15 mm.
   That clears a digital press but not by much. If the printer's proof shows them
   dropping out, cut to the heaviest few — the widths are in the console output.

   Run:  node sixfold/operations/business-card-print/build-cards.mjs           */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRAND = join(HERE, '..', '..', 'brand');

const PINE = '#0E1512', BONE = '#EDE7DC';
const SAGE = '#A7BE93', MOSS = '#8AA07A', TURF = '#2F7A4F';
const EMBER = '#E4703A', EMBER_INK = '#B84C15', TIMBER = '#1F2A25';

/* --- the mark, assembled from the two brand files ------------------------- */
const flat = readFileSync(join(BRAND, 'sixfold-mark-ridge-flat.svg'), 'utf8');
const flatBody = flat.slice(flat.indexOf('>', flat.indexOf('<svg')) + 1, flat.lastIndexOf('</svg>'))
  .replace(/<title>[\s\S]*?<\/title>\s*/, '').replace(/<!--[\s\S]*?-->\s*/, '').trim();

const master = readFileSync(join(BRAND, 'sixfold-mark-ridge.svg'), 'utf8');
const rootGroup = master.slice(master.lastIndexOf('<g fill="none"'), master.lastIndexOf('</g>'));
const ROOTS = rootGroup.split('\n').filter((l) => l.includes('stroke-width')).map((l) => l.trim());

/* peaks take one ink, everything rooted in the ground takes the other; on the
   green cards those are the same colour, which is what single-ink means. */
function mark({ peak, growth }) {
  const body = flatBody
    .split('#E4703A').join(peak)      // the ridge path
    .split('#8AA07A').join(growth);   // the conifer and the ground bar
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 116" width="76" height="88" role="img" aria-label="Sixfold mark, Ridge">`
    + body
    + `<g fill="none" stroke="${growth}" stroke-linecap="round" stroke-linejoin="round">${ROOTS.join('')}</g>`
    + `</svg>`;
}

const GREEN = {
  band: 'LAWN, LAND &amp; FIRE',
  svc: 'AERATION &middot; LAWN CARE &middot; LANDSCAPING &middot; FIRE',
};
const FIRE = {
  band: 'LAND &amp; FIRE',
  svc: 'FIRE MITIGATION &middot; LAND CLEARING &middot; LANDSCAPING',
};

const variants = [
  { file: 'card-green-pine', ...GREEN, name: 'green on Pine',
    bg: PINE, ink: BONE, band: GREEN.band, bandCol: MOSS, ti: MOSS, web: SAGE,
    muted: 'rgba(237,231,220,.5)', co: 'rgba(237,231,220,.55)',
    mark: mark({ peak: SAGE, growth: SAGE }) },
  { file: 'card-green-bone', ...GREEN, name: 'green on Bone',
    bg: BONE, ink: PINE, band: GREEN.band, bandCol: '#5F7A55', ti: '#5F7A55', web: TURF,
    muted: '#5F6A62', co: '#5F6A62',
    mark: mark({ peak: TURF, growth: TURF }) },
  { file: 'card-fire-pine', ...FIRE, name: 'ember on Pine',
    bg: PINE, ink: BONE, band: FIRE.band, bandCol: MOSS, ti: MOSS, web: EMBER,
    muted: 'rgba(237,231,220,.5)', co: 'rgba(237,231,220,.55)',
    mark: mark({ peak: EMBER, growth: MOSS }) },
  { file: 'card-fire-bone', ...FIRE, name: 'ember on Bone',
    bg: BONE, ink: PINE, band: FIRE.band, bandCol: '#5F7A55', ti: '#5F7A55', web: EMBER_INK,
    muted: '#5F6A62', co: '#5F6A62',
    mark: mark({ peak: EMBER_INK, growth: TIMBER }) },
];

function page(v) {
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
    overflow: hidden; page-break-after: always; break-after: page; }
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
    ${v.mark}
    <div class="wordmark" style="margin-top:3pt">Sixfold</div>
    <div class="band">${v.band}</div>
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
    <div class="svc">${v.svc}</div>
  </div>
</div>

</body>
</html>
`;
}

for (const v of variants) writeFileSync(join(HERE, `${v.file}.html`), page(v));
console.log('wrote ' + variants.map((v) => `${v.file}.html`).join(', '));

console.log(`\nroots per card: ${ROOTS.length} (the master's full set; the card previously carried 3)`);
console.log('stroke width at card size — 76px mark, 96 css px per inch:');
for (const r of ROOTS) {
  const w = Number(r.match(/stroke-width="([\d.]+)"/)[1]);
  const mm = (w * 0.76 / 96) * 25.4;
  console.log(`  ${w.toFixed(2).padStart(4)} units -> ${mm.toFixed(3)} mm${mm < 0.16 ? '  <- thinnest' : ''}`);
}
