/* Sixfold training kit (2026-10-02): the logo as printed on Brandon's business card,
   plus a one-page palette sheet, for internal documents and new-hire packets.

   ⚑ Two logo versions, both already in the card family, nothing new invented:
     - CASCADE on dark  — exactly the printed card (Frost -> Sage -> Fern -> Turf, Frost roots).
     - SOLID TURF on light — the card-green-bone option. The cascade cannot go on white:
       its lightest stop (Frost) is ~1.1:1 there and the conifer and roots disappear.
   Run: node build.mjs   (needs Chrome; writes PNGs + the sheet PDF next to this file) */
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const BUILD = join(HERE, '.build'); mkdirSync(BUILD, { recursive: true });
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/* the card's colours, named as the crew picked them */
const C = {
  pine:  ['Pine',  '#0E1512', 'Card background; dark pages and covers'],
  bone:  ['Bone',  '#EDE7DC', 'Wordmark and text on dark; warm paper colour'],
  frost: ['Frost', '#DCE7D2', 'Mark: the small tree, the ground bar and the roots'],
  sage:  ['Sage',  '#A7BE93', 'Mark: the low ridge; web address on the card'],
  fern:  ['Fern',  '#6E8C61', 'Mark: the middle peak'],
  turf:  ['Turf',  '#2F7A4F', 'Mark: the tall peak; the whole mark on light pages'],
  moss:  ['Moss',  '#8AA07A', '"LAWN, LAND & FIRE" and job titles'],
};

/* the Ridge mark, lifted verbatim from card-brandon.html (the printed press file) */
const PEAKS = {
  low: 'M18 84L18.3 83.4L18.3 84L18 84ZM25.7 83.1L28.65 83.1L28.26 84L25.7 84L25.7 83.1ZM28.73 62.53L36 48L40.23 56.46L33.11 72.83L29.17 68.1L32.53 68.1L28.73 62.53ZM30.86 75.6L31.91 75.6L31.59 76.33L30.86 75.6ZM30 84L30.39 83.1L38.36 83.1L32.81 77.54L33.65 75.6L35.42 75.6L34.26 74.21L50 38L55.2 49.96L42.29 84L30 84Z',
  mid: 'M44 84L66 26L70.71 38.42L58.34 84L44 84Z',
  high: 'M60 84L79 14L98 84L60 84Z',
  conifer: 'M9.5 81.5L17 74L12 74L18.25 66.5L14.5 66.5L22 55.5L29.5 66.5L25.75 66.5L32 74L27 74L34.5 81.5L24.1 81.5L24.1 84.5L19.9 84.5L19.9 81.5L9.5 81.5Z',
  bar: 'M4 86L96 86L96 91L4 91Z',
};
const ROOTS = [['M94 91 L92.2 94.4 L94.6 98 L91.4 102 L93.4 106 L90 109.4 L89.8 113', 1.6], ['M90.5 91 L88.4 93.6 L85.4 95.2 L87.8 98.6 L82.4 101.4 L84.2 104.6 L79.6 108', 1.35],
  ['M86.5 91 L83.8 92.6 L85.8 95 L80.4 96.2 L77.6 99 L74 99.2 L71.5 101', 1.1], ['M96 91 L97.6 93.8 L95 96.2 L97.4 99.6 L94.8 102.4 L96 106', 1.15],
  ['M92.6 91 L90.6 94.6 L92.4 97.6 L89.4 100.6 L90.6 104.4 L88 107.4', 1.05], ['M87.8 98.6 L85.4 100.8 L86.6 103.4 L83 105.8 L83.8 109', 0.9],
  ['M91.4 102 L94.2 103.4 L93.4 106.2 L95.8 108.6', 0.85], ['M84.6 91 L82.4 92.6 L83.8 94.8 L78.4 95.6 L75.6 97.4 L72.4 97.6', 0.8],
  ['M85.8 95 L83.4 96.8 L84.4 99.4 L80.6 100.8', 0.75], ['M95 91 L96.6 94.2 L94.4 96.6 L96.4 100', 0.85]];
function mark(c, w) {
  const h = Math.round(w * 101 / 95);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="3.5 13 95 101" width="${w}" height="${h}">` +
    `<path fill="${c.low}" fill-rule="evenodd" d="${PEAKS.low}"/><path fill="${c.mid}" d="${PEAKS.mid}"/><path fill="${c.high}" d="${PEAKS.high}"/>` +
    `<path fill="${c.conifer}" d="${PEAKS.conifer}"/><path fill="${c.bar}" d="${PEAKS.bar}"/>` +
    `<g fill="none" stroke="${c.roots}" stroke-linecap="round" stroke-linejoin="round">${ROOTS.map(([d, sw]) => `<path d="${d}" stroke-width="${sw}"/>`).join('')}</g></svg>`;
}
const CASCADE = { conifer: C.frost[1], low: C.sage[1], mid: C.fern[1], high: C.turf[1], bar: C.frost[1], roots: C.frost[1] };
const SOLID = { conifer: C.turf[1], low: C.turf[1], mid: C.turf[1], high: C.turf[1], bar: C.turf[1], roots: C.turf[1] };
const SERIF = `'Palatino Linotype','Book Antiqua',Palatino,Georgia,serif`;   /* single quotes: these go inside style="..." attributes */
const MONO = `'Cascadia Mono',Consolas,monospace`;
/* the card front's own proportions, against the mark's width (85 px = 63.75 pt on the card):
   wordmark 21 pt, 4 pt below; LAWN, LAND & FIRE 6.2 pt / 3.5 pt tracking, 5 pt below;
   COLORADO 6.2 pt / 3.9 pt tracking at 60%, 3 pt below */
function lockup(dark, w) {
  const k = w / 63.75, ink = dark ? C.bone[1] : C.pine[1], band = dark ? C.moss[1] : C.turf[1];
  const co = dark ? 'rgba(237,231,220,.6)' : 'rgba(14,21,18,.6)';
  const cap = (size, track, color, top, text) => `<div style="font-family:${MONO};font-size:${size * k}px;letter-spacing:${track * k}px;margin-right:${-track * k}px;color:${color};margin-top:${top * k}px;line-height:1.2">${text}</div>`;
  return `<div style="display:inline-flex;flex-direction:column;align-items:center;text-align:center">${mark(dark ? CASCADE : SOLID, w)}` +
    `<div style="font-family:${SERIF};font-size:${21 * k}px;letter-spacing:${-0.35 * k}px;line-height:1;color:${ink};margin-top:${4 * k}px">Sixfold</div>` +
    cap(6.2, 3.5, band, 5, 'LAWN, LAND &amp; FIRE') + cap(6.2, 3.9, co, 3, 'COLORADO') + `</div>`;
}
function shoot(name, body, w, h) {
  const f = join(BUILD, name + '.html');
  writeFileSync(f, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}body{width:${w}px;height:${h}px;display:grid;place-items:center}</style>${body}`);
  const out = join(HERE, name + '.png');
  if (existsSync(out)) unlinkSync(out);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=4', '--default-background-color=00000000',
    `--window-size=${w},${h}`, `--screenshot=${out}`, pathToFileURL(f).href], { stdio: 'ignore' });
  console.log('  ' + name + '.png');
}

/* ---- logo PNGs: transparent, 4x for print ---- */
shoot('sixfold-logo-for-dark-backgrounds', lockup(true, 200), 520, 440);
shoot('sixfold-logo-for-light-backgrounds', lockup(false, 200), 520, 440);
shoot('sixfold-mark-for-dark-backgrounds', mark(CASCADE, 300), 340, 340);
shoot('sixfold-mark-for-light-backgrounds', mark(SOLID, 300), 340, 340);

/* ---- the one-page sheet ---- */
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ');
const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const swatches = Object.values(C).map(([n, hex, use]) => `<div class="sw"><div class="chip" style="background:${hex};color:${lum(hex) > 0.4 ? '#0E1512' : '#EDE7DC'}">${n}</div>
  <div class="meta"><b>${hex.toUpperCase()}</b><span>RGB ${rgb(hex)}</span><em>${use}</em></div></div>`).join('');
const sheet = `<!doctype html><html><head><meta charset="utf-8"><title>Sixfold logo and colours</title><style>
@page{size:8.5in 11in;margin:0}*{box-sizing:border-box}html,body{margin:0}
body{font-family:Segoe UI,Arial,sans-serif;color:#16201C;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:8.5in;height:11in;padding:.55in .6in;display:flex;flex-direction:column;gap:.24in}
h1{font:400 26pt/1 ${SERIF};margin:0;letter-spacing:-.01em} .sub{font-size:10pt;color:#55635B;margin-top:4pt}
h2{font:700 8.5pt ${MONO};letter-spacing:.18em;text-transform:uppercase;color:#4E6142;margin:0 0 7pt}
.logos{display:grid;grid-template-columns:1fr 1fr;gap:.18in}
.tile{border-radius:10pt;height:2.15in;display:grid;place-items:center;position:relative}
.tile.dark{background:#0E1512} .tile.light{background:#fff;border:1px solid #DCD3C3}
.cap{font:normal 7.5pt ${MONO};letter-spacing:.04em;color:#55635B;margin-top:4pt}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:9pt 14pt}
.sw{display:flex;gap:9pt;align-items:center}
.chip{width:1.05in;height:.62in;border-radius:7pt;display:grid;place-items:center;font:400 12pt ${SERIF};flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
.meta{display:flex;flex-direction:column;font-size:8.5pt;line-height:1.35}.meta b{font:700 10pt ${MONO}}.meta span{color:#55635B;font-family:${MONO};font-size:8pt}.meta em{font-style:normal;color:#16201C}
.rules{display:grid;grid-template-columns:1fr 1fr;gap:4pt 18pt;font-size:9pt;line-height:1.45;margin:0;padding:0;list-style:none}
.rules li{padding-left:12pt;position:relative}.rules li::before{content:"";position:absolute;left:0;top:.55em;width:5pt;height:5pt;border-radius:50%;background:#2F7A4F}
.type{display:grid;grid-template-columns:1fr 1fr;gap:14pt;font-size:9pt;color:#55635B}
.type b{display:block;color:#16201C;font-size:15pt;font-weight:400;margin-bottom:2pt}
.foot{margin-top:auto;font-size:7.5pt;color:#7A857E;border-top:1px solid #E6E0D3;padding-top:6pt}
</style></head><body><div class="page">
<div><h1>Sixfold logo &amp; colours</h1><div class="sub">For training packets and internal documents. The same logo and colours as the printed business cards.</div></div>
<div><h2>Logo — pick by background</h2><div class="logos">
  <div><div class="tile dark">${lockup(true, 78)}</div><div class="cap">sixfold-logo-for-dark-backgrounds.png</div></div>
  <div><div class="tile light">${lockup(false, 78)}</div><div class="cap">sixfold-logo-for-light-backgrounds.png</div></div></div></div>
<div><h2>Colours</h2><div class="grid">${swatches}</div></div>
<div class="type"><div><b style="font-family:${SERIF}">Palatino Linotype</b>The "Sixfold" wordmark and headings. Book Antiqua is the same design if Palatino is missing.</div>
<div><b style="font-family:${MONO};font-size:12pt">CASCADIA MONO</b>Small capital labels like "LAWN, LAND &amp; FIRE", widely spaced. Consolas works too.</div></div>
<div><h2>Using the logo</h2><ul class="rules">
  <li><b>White or light page:</b> the solid green logo. The multi-green one disappears on white.</li>
  <li><b>Dark page or photo:</b> the multi-green logo, exactly as on the business cards.</li>
  <li>Don't stretch, squash, recolour or add effects. Resize from the corner.</li>
  <li>Leave clear space around it about the height of the small tree.</li>
  <li>In print, keep it at least the size it is on the business card (just under 1 in wide), so the fine roots under the ground line still show.</li>
  <li>The name is <b>Sixfold</b>; the public name is <b>Sixfold Colorado</b>.</li></ul></div>
<div class="foot">Files: sixfold/brand/training-kit/ — logo and mark PNGs (transparent, high resolution) for dark and light backgrounds. Colours and mark from the printed card, card-brandon.html.</div>
</div></body></html>`;
const sf = join(HERE, 'sixfold-logo-and-colours.html');
writeFileSync(sf, sheet);
const pdf = join(HERE, 'sixfold-logo-and-colours.pdf');
if (existsSync(pdf)) unlinkSync(pdf);
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, pathToFileURL(sf).href], { stdio: 'ignore' });
console.log('  sixfold-logo-and-colours.pdf');
const png = join(HERE, 'sixfold-logo-and-colours.png');
if (existsSync(png)) unlinkSync(png);
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', '--window-size=816,1056', `--screenshot=${png}`, pathToFileURL(sf).href], { stdio: 'ignore' });
console.log('  sixfold-logo-and-colours.png');
