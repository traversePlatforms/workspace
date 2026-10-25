/* Brand pack for the apparel maker (2026-10-19, Matthew: "logos and branding so she can make shirts, hats, uniforms"). Builds
   brand-pack/365-Sixfold-Brand-Pack/ and a .zip of it: the picked badge ("Sixfold in the middle") in the three colourways as vector PDF,
   outlined SVG (no font needed) and 4000 px transparent PNG; one-colour versions for screen print and embroidery; the fonts; a brand sheet.
   Run after build.mjs:  node build-brand-pack.mjs   (needs the mupdf package in the scratchpad tools folder, for PDF -> outlined SVG) */
import { writeFileSync, readFileSync, mkdirSync, copyFileSync, rmSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
/* throwaway Chrome profiles are removed when the script ends (2026-10-25: 10,717 were left in Temp, about 170 GB) */
const cdpDirs = []; const cdpDir = () => { const d = mkdtempSync(join(tmpdir(), 'cdp-')); cdpDirs.push(d); return d; };
process.on('exit', () => { for (const d of cdpDirs) try { rmSync(d, { recursive: true, force: true, maxRetries: 50, retryDelay: 200 }); } catch {} });
const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TOOLS = process.env.BRANDPACK_TOOLS || 'C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/brandpack-tools';
const FONTSRC = process.env.BRANDPACK_FONTS || join(TOOLS, '..', 'fonts-dl');
const mupdf = await import(pathToFileURL(createRequire(join(TOOLS, 'x.js')).resolve('mupdf')).href);

const OUT = join(HERE, 'brand-pack'), PACK = join(OUT, '365-Sixfold-Brand-Pack');
rmSync(PACK, { recursive: true, force: true });
const D = { full: join(PACK, 'Full colour'), one: join(PACK, 'One colour'), fonts: join(PACK, 'Fonts') };
for (const d of Object.values(D)) mkdirSync(d, { recursive: true });
for (const f of ['Outfit.ttf', 'Outfit-OFL.txt', 'DMSans.ttf', 'DMSans-OFL.txt']) copyFileSync(join(FONTSRC, f), join(D.fonts, f));
const fontFace = `@font-face{font-family:Outfit;src:url("${pathToFileURL(join(D.fonts, 'Outfit.ttf')).href}") format("truetype");font-weight:100 900}
@font-face{font-family:'DM Sans';src:url("${pathToFileURL(join(D.fonts, 'DMSans.ttf')).href}") format("truetype");font-weight:100 1000}`;

/* ---- the one-colour badge: same geometry as build.mjs's badge(), no tints. The ring is drawn as two rules, the peaks keep a gap
   where one sits in front of another (clipped, so it stays vector), and the tree, ground and roots are kept (roots matter: see
   sixfold-printed-items memory). */
const C = 500, IN = 292, RIM = 16, TOP = 338, BOT = 432;
const S = 3.05, MX = C - 51 * S, MY = C + 268 - 113 * S;
const PEAKS = [[[18, 84], [36, 48], [54, 84]], [[30, 84], [50, 38], [70, 84]], [[44, 84], [66, 26], [88, 84]], [[60, 84], [79, 14], [98, 84]]];
const TREE = [[[22, 69], [9.5, 81.5], [34.5, 81.5]], [[22, 62], [12, 74], [32, 74]], [[22, 55.5], [14.5, 66.5], [29.5, 66.5]], [[20.4, 77], [23.6, 77], [23.6, 84], [20.4, 84]]];
const ROOTS = [['M94 91 L92.2 94.4 L94.6 98 L91.4 102 L93.4 106 L90 109.4 L89.8 113', 1.6], ['M90.5 91 L88.4 93.6 L85.4 95.2 L87.8 98.6 L82.4 101.4 L84.2 104.6 L79.6 108', 1.35],
  ['M86.5 91 L83.8 92.6 L85.8 95 L80.4 96.2 L77.6 99 L74 99.2 L71.5 101', 1.1], ['M96 91 L97.6 93.8 L95 96.2 L97.4 99.6 L94.8 102.4 L96 106', 1.15],
  ['M92.6 91 L90.6 94.6 L92.4 97.6 L89.4 100.6 L90.6 104.4 L88 107.4', 1.05], ['M87.8 98.6 L85.4 100.8 L86.6 103.4 L83 105.8 L83.8 109', 0.9],
  ['M91.4 102 L94.2 103.4 L93.4 106.2 L95.8 108.6', 0.85], ['M84.6 91 L82.4 92.6 L83.8 94.8 L78.4 95.6 L75.6 97.4 L72.4 97.6', 0.8],
  ['M85.8 95 L83.4 96.8 L84.4 99.4 L80.6 100.8', 0.75], ['M95 91 L96.6 94.2 L94.4 96.6 L96.4 100', 0.85]];
/* grow a convex polygon outward by d (the gap) */
function grow(pts, d) {
  const n = pts.length; let a = 0; for (let i = 0; i < n; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n]; a += x1 * y2 - x2 * y1; }
  const sg = a > 0 ? 1 : -1, lines = [];
  for (let i = 0; i < n; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n]; const L = Math.hypot(x2 - x1, y2 - y1); const nx = sg * (y2 - y1) / L, ny = -sg * (x2 - x1) / L; lines.push([x1 + nx * d, y1 + ny * d, x2 + nx * d, y2 + ny * d]); }
  return lines.map((l, i) => { const m = lines[(i + n - 1) % n]; const [x1, y1, x2, y2] = m, [x3, y3, x4, y4] = l; const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4); const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den; return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]; });
}
/* the outline around the whole tree (convex hull), so the gap round it is one clean edge, with no slivers between the tiers */
function hull(P) { const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = []; for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); } for (const q of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); } return lo.slice(0, -1).concat(up.slice(0, -1)); }
const TREE_HULL = hull(TREE.flat());
const poly = (p) => 'M' + p.map(([x, y]) => `${+x.toFixed(3)} ${+y.toFixed(3)}`).join(' L') + ' Z';
function mono(col, id) {
  const GAP = 1.8, clips = [];
  const peaks = PEAKS.map((p, i) => {
    const front = [...PEAKS.slice(i + 1), TREE_HULL];
    if (!front.length) return `<path d="${poly(p)}"/>`;
    let s = `<path d="${poly(p)}"/>`;
    front.forEach((f, k) => { const cid = `${id}-c${i}-${k}`; clips.push(`<clipPath id="${cid}"><path clip-rule="evenodd" d="M-200 -200 H300 V300 H-200 Z ${poly(grow(f, GAP))}"/></clipPath>`); s = `<g clip-path="url(#${cid})">${s}</g>`; });
    return s;
  }).join('\n      ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" role="img" aria-label="Sixfold 365 badge, one colour">
  <defs>
    <path id="top-${id}" d="M ${C - TOP} ${C} A ${TOP} ${TOP} 0 0 1 ${C + TOP} ${C}"/>
    <path id="bot-${id}" d="M ${C - BOT} ${C} A ${BOT} ${BOT} 0 0 0 ${C + BOT} ${C}"/>
    <clipPath id="disc-${id}"><circle cx="${C}" cy="${C}" r="${IN}"/></clipPath>
    ${clips.join('\n    ')}
  </defs>
  <circle cx="${C}" cy="${C}" r="463" fill="none" stroke="${col}" stroke-width="14"/>
  <circle cx="${C}" cy="${C}" r="${IN + RIM / 2}" fill="none" stroke="${col}" stroke-width="${RIM}"/>
  <g clip-path="url(#disc-${id})"><g transform="translate(${MX} ${MY}) scale(${S})" fill="${col}">
      ${peaks}
      ${TREE.map((t) => `<path d="${poly(t)}"/>`).join('')}
      <rect x="4" y="86" width="92" height="5"/>
      <g fill="none" stroke="${col}" stroke-linecap="round" stroke-linejoin="round">${ROOTS.map(([d, w]) => `<path d="${d}" stroke-width="${w}"/>`).join('')}</g>
  </g></g>
  <text x="${C}" y="${C - 118}" text-anchor="middle" font-family="Outfit, sans-serif" font-weight="800" font-size="74" letter-spacing="16" fill="${col}">SIXFOLD</text>
  <circle cx="${C - 388}" cy="${C}" r="20" fill="${col}"/>
  <circle cx="${C + 388}" cy="${C}" r="20" fill="${col}"/>
  <text font-family="Outfit, sans-serif" font-weight="800" font-size="150" letter-spacing="38" fill="${col}"><textPath href="#top-${id}" startOffset="50%" text-anchor="middle">365</textPath></text>
  <text font-family="Outfit, sans-serif" font-weight="700" font-size="56" letter-spacing="7" fill="${col}"><textPath href="#bot-${id}" startOffset="50%" text-anchor="middle">LAND · AERATION &amp; SEEDING</textPath></text>
</svg>`;
}

/* ---- the pieces */
const LOGOS = [
  { dir: D.full, name: '365-Badge-A-Green', svg: readFileSync(join(HERE, 'option-a.svg'), 'utf8'), dark: false },
  { dir: D.full, name: '365-Badge-B-Dark', svg: readFileSync(join(HERE, 'option-b.svg'), 'utf8'), dark: false },
  { dir: D.full, name: '365-Badge-C-Light', svg: readFileSync(join(HERE, 'option-c.svg'), 'utf8'), dark: true },
  { dir: D.one, name: '365-Badge-1colour-Black', svg: mono('#000000', 'k'), dark: false },
  { dir: D.one, name: '365-Badge-1colour-Green', svg: mono('#2F5D2C', 'g'), dark: false },
  { dir: D.one, name: '365-Badge-1colour-White', svg: mono('#FFFFFF', 'w'), dark: true },
];
const tmp = mkdtempSync(join(tmpdir(), 'bp-'));
const chrome = (args) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-pdf-header-footer', '--allow-file-access-from-files', `--user-data-dir=${cdpDir()}`, '--virtual-time-budget=8000', ...args], { stdio: 'ignore' });
function toSvgOutlined(pdfPath) {
  const doc = mupdf.Document.openDocument(readFileSync(pdfPath), 'application/pdf'), page = doc.loadPage(0);
  const buf = new mupdf.Buffer(), w = new mupdf.DocumentWriter(buf, 'svg', 'text=path'), dev = w.beginPage(page.getBounds());
  page.run(dev, mupdf.Matrix.identity); w.endPage(); w.close();
  return buf.asString();
}
for (const L of LOGOS) {
  const base = join(L.dir, L.name);
  const html = (sz) => `<!doctype html><html><head><meta charset="utf-8"><style>${fontFace}@page{size:${sz};margin:0}html,body{margin:0;background:transparent}svg{display:block;width:${sz.split(' ')[0]};height:${sz.split(' ')[1]}}</style></head><body>${L.svg}</body></html>`;
  const hp = join(tmp, L.name + '-pdf.html'), hs = join(tmp, L.name + '-png.html');
  writeFileSync(hp, html('10in 10in')); writeFileSync(hs, html('1000px 1000px'));
  chrome([`--print-to-pdf=${base}.pdf`, pathToFileURL(hp).href]);
  chrome(['--default-background-color=00000000', '--window-size=1000,1000', '--force-device-scale-factor=4', `--screenshot=${base}.png`, pathToFileURL(hs).href]);
  writeFileSync(base + '.svg', toSvgOutlined(base + '.pdf'));
  if (!existsSync(base + '.pdf') || !existsSync(base + '.png')) throw new Error('render failed: ' + L.name);
}

/* ---- the brand sheet */
const SW = [
  ['Forest green', '#2F5D2C', 'Ring on A; text on C; the main 365 colour'], ['Cream', '#FFF8EC', 'Text on A; ring on C'], ['Ember orange', '#E4703A', 'The Sixfold peaks; dots and outline on C'],
  ['Moss green', '#4C7A3F', 'Tree, ground and roots on A and C'], ['Sun gold', '#F2C14E', 'Dots on A'], ['Pine black', '#0E1512', 'Ring on B'], ['Bone', '#EDE7DC', 'Text on B'],
  ['Timber', '#1F2A25', 'Centre disc on B'], ['Sage', '#8AA07A', 'Tree, ground and roots on B'],
];
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const cmyk = (h) => { const [r, g, b] = rgb(h).map((v) => v / 255), k = 1 - Math.max(r, g, b); if (k >= 1) return [0, 0, 0, 100]; return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map((v) => Math.round(v * 100)); };
const tile = (L, bg) => `<div class="tile" style="background:${bg}">${L.svg.replace(/id="([a-z]+-[a-z0-9-]+)"/g, (m, i) => `id="${i}-${bg.slice(1)}"`).replace(/#([a-z]+-[a-z0-9-]+)\)/g, (m, i) => `#${i}-${bg.slice(1)})`).replace(/href="#([a-z]+-[a-z0-9-]+)"/g, (m, i) => `href="#${i}-${bg.slice(1)}"`)}</div>`;
const sheet = `<!doctype html><html><head><meta charset="utf-8"><title>365 Sixfold brand sheet</title><style>${fontFace}
@page{size:letter;margin:0.5in}*{box-sizing:border-box}body{margin:0;font:10.5pt/1.45 'DM Sans',sans-serif;color:#1D2A1C}
h1{font:800 24pt Outfit,sans-serif;margin:0;color:#2F5D2C;letter-spacing:.5px}h2{font:800 12.5pt Outfit,sans-serif;margin:16px 0 6px;color:#2F5D2C;text-transform:uppercase;letter-spacing:1.5px}
.sub{margin:2px 0 10px;color:#55635B}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.tile{border-radius:10px;padding:12px;border:1px solid #E3DCCF}.tile svg{width:100%;height:auto;display:block}
.cap{font-size:9pt;color:#55635B;margin-top:4px}.cap b{color:#1D2A1C}table{width:100%;border-collapse:collapse;font-size:9.5pt}td,th{padding:5px 6px;border-bottom:1px solid #E3DCCF;text-align:left;vertical-align:middle}th{font-size:8.5pt;text-transform:uppercase;letter-spacing:1px;color:#55635B}
.chip{width:26px;height:18px;border-radius:4px;border:1px solid rgba(0,0,0,.15)}.mono{font-family:Consolas,monospace;font-size:9pt}ul{margin:4px 0 0;padding-left:18px}li{margin:2px 0}.pb{break-before:page}
.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}.big{font:800 22pt Outfit,sans-serif}.note{background:#FFF8EC;border:1px solid #E9DFC9;border-radius:10px;padding:10px 12px;margin-top:10px}</style></head><body>
<h1>365 Aeration &amp; Seeding · Sixfold</h1><p class="sub">Brand sheet for shirts, hats and uniforms. The logo is the round badge: 365 across the top, SIXFOLD and the Ridge mark in the middle, LAND · AERATION &amp; SEEDING around the bottom.</p>
<h2>Full colour</h2><div class="row">
<div>${tile(LOGOS[0], '#FFFFFF')}<div class="cap"><b>A · Green.</b> Best on white, cream, grey or light shirts.</div></div>
<div>${tile(LOGOS[1], '#FFFFFF')}<div class="cap"><b>B · Dark.</b> Best on white, tan or light shirts.</div></div>
<div>${tile(LOGOS[2], '#1D2A1C')}<div class="cap"><b>C · Light.</b> Best on black, forest green, navy or dark shirts.</div></div></div>
<h2>One colour (screen print, embroidery, heat press)</h2><div class="row">
<div>${tile(LOGOS[3], '#FFFFFF')}<div class="cap"><b>Black.</b> Any light garment.</div></div>
<div>${tile(LOGOS[4], '#FFF8EC')}<div class="cap"><b>Forest green.</b> White, cream, tan, grey.</div></div>
<div>${tile(LOGOS[5], '#2F5D2C')}<div class="cap"><b>White.</b> Any dark garment.</div></div></div>
<div class="pb"></div>
<h2>Colours</h2><table><tr><th></th><th>Name</th><th>HEX</th><th>RGB</th><th>CMYK (approx.)</th><th>Where it's used</th></tr>
${SW.map(([n, h, w]) => `<tr><td><div class="chip" style="background:${h}"></div></td><td><b>${n}</b></td><td class="mono">${h}</td><td class="mono">${rgb(h).join(', ')}</td><td class="mono">${cmyk(h).join(' / ')}</td><td>${w}</td></tr>`).join('')}</table>
<p class="cap">Thread and ink: match to the HEX values above. Ask your supplier for the nearest Pantone or thread colour; none has been set yet.</p>
<div class="two"><div><h2>Fonts</h2><p><span class="big" style="font-weight:800">Outfit</span><br>Headings and the logo lettering (ExtraBold and Bold). Use it for names on uniforms, "CREW" on a sleeve, and so on.</p>
<p><span class="big" style="font-family:'DM Sans';font-weight:700;font-size:18pt">DM Sans</span><br>Smaller text, like a phone number or website.</p><p class="cap">Both are free Google fonts (Open Font License) and are in the Fonts folder. The logo files don't need them: the lettering is already shapes.</p></div>
<div><h2>Using the logo</h2><ul><li>Keep it round and in proportion. Don't stretch, squash or rotate it.</li><li>Don't recolour parts of it. Use one of the six versions as they are.</li><li>Leave clear space around it, at least the height of the "365".</li><li>Smallest size: about 2.5 in across for print. For hats and left-chest embroidery, the digitizer may need to simplify the thin roots under the ground line and the small lettering. Please send a proof before stitching.</li></ul></div></div>
<h2>Text for the back or sleeve (optional)</h2><p><b>365 Aeration &amp; Seeding</b> · <b>365aeration.com</b> · <b>(720) 830-4553</b></p>
<div class="note"><b>Which file to use:</b> PDF or SVG for anything printed or stitched (vector, any size). PNG (4000 px, transparent background) for mock-ups, DTF and quick previews.</div>
</body></html>`;
const shp = join(tmp, 'sheet.html'); writeFileSync(shp, sheet);
chrome([`--print-to-pdf=${join(PACK, '365-Brand-Sheet.pdf')}`, pathToFileURL(shp).href]);
chrome(['--window-size=1275,1650', `--screenshot=${join(OUT, 'brand-sheet-preview.png')}`, pathToFileURL(shp).href]);

writeFileSync(join(PACK, 'READ ME.txt'), `365 Aeration & Seeding / Sixfold: brand pack
=============================================

Start with 365-Brand-Sheet.pdf: it shows every logo version, the colours, the fonts and how to use them.

Full colour/   The badge in three colour versions.
               A-Green: for white or light shirts.
               B-Dark: for white or light shirts.
               C-Light: for black, green or dark shirts.
One colour/    The badge in a single colour (Black, Forest green, White), for screen printing, embroidery and heat press.
Fonts/         Outfit and DM Sans, the brand fonts (free, Open Font License).

Each logo comes as:
  .pdf  vector, any size. Best for printers and embroidery digitizers.
  .svg  vector, lettering already turned into shapes (no font needed).
  .png  4000 x 4000 pixels, transparent background. For mock-ups and DTF.

Colours (HEX):  Forest green #2F5D2C · Cream #FFF8EC · Ember orange #E4703A · Moss green #4C7A3F · Sun gold #F2C14E
                Pine black #0E1512 · Bone #EDE7DC · Timber #1F2A25 · Sage #8AA07A

Website: 365aeration.com    Phone: (720) 830-4553

Please send a proof before printing or stitching.
`);
/* zip it (PowerShell's Compress-Archive) */
const zip = join(OUT, '365-Sixfold-Brand-Pack.zip'); rmSync(zip, { force: true });
execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${PACK}' -DestinationPath '${zip}'`], { stdio: 'inherit' });
console.log('wrote', PACK, 'and', zip);
