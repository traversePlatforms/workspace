/* Shared business card: Brandon + Jen (2026-10-29, Matthew: "Use brandons business card but add Jen Mcpherson, her number and
   contact@365aeration.com it leads to her inbox anyways. Keep all of brandons info on there. Make it so that the qr code leads to the same
   place the other business cards do. Put booking and quotes as jens title. and maybe business inquiries under brandon").
   Same print format as build-print.mjs's PRINT-READY cards (FedEx): two pages, 3.75 x 2.25 in (3.5 x 2 card + 0.125 in bleed), text
   3/16 in inside the trim, badge B (Sixfold dark) like Brandon's own card, root lines x1.6, reversed type 6.5 pt (0.09 in) or more.
   The QR is the cards' own address, https://365aeration.com/card/ (counted as 'card'), decoded again from the rendered back.
   Needs: QR_DEPS = a node_modules with qrcode, jsqr, pngjs.   node build-card-team.mjs */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const cdpDirs = []; const cdpDir = () => { const d = mkdtempSync(join(tmpdir(), 'cdp-')); cdpDirs.push(d); return d; };
process.on('exit', () => { for (const d of cdpDirs) try { rmSync(d, { recursive: true, force: true, maxRetries: 50, retryDelay: 200 }); } catch {} });
const HERE = dirname(fileURLToPath(import.meta.url)), PR = join(HERE, 'print-ready');
const req = createRequire(join(process.env.QR_DEPS || '', 'x.js'));
const QR = req('qrcode'), jsQR = req('jsqr'), { PNG } = req('pngjs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SITE = '365aeration.com', SERVICES = 'Core aeration \u00b7 Overseeding \u00b7 Fertilizer', GO = 'https://365aeration.com/card/';
const PEOPLE = [
  { name: 'Brandon Long', title: 'CEO \u00b7 Business inquiries', phone: '(303) 915-1045', email: 'B.Long@365Aeration.com' },
  { name: 'Jen McPherson', title: 'Booking & quotes', phone: '(720) 830-4553', email: 'contact@365aeration.com' },
];
/* the badge and the QR exactly as build-print.mjs draws them */
const bsrc = readFileSync(join(HERE, 'build.mjs'), 'utf8');
const ridge = eval(bsrc.slice(bsrc.indexOf('const ridge = '), bsrc.indexOf('`;', bsrc.indexOf('const ridge = ')) + 1).replace('const ridge = ', '(') + ')');
const withMark = (svg, light) => {
  const vb = +svg.match(/viewBox="0 0 (\d+) \d+"/)[1], pad = 9, x0 = (vb - pad) / 2, sc = (pad - 1.4) / 100;
  return svg.replace('</svg>', `<g shape-rendering="geometricPrecision"><rect x="${x0}" y="${x0}" width="${pad}" height="${pad}" rx="1.2" fill="${light}"/>`
    + `<g transform="translate(${x0 + (pad - 94 * sc) / 2 - 4 * sc} ${x0 + (pad - 99 * sc) / 2 - 14 * sc}) scale(${sc})">${ridge('#E4703A', '#4C7A3F')}</g></g></svg>`);
};
let uid = 0;
const badge = (k) => { const n = 'u' + (uid++); return readFileSync(join(HERE, `option-${k}.svg`), 'utf8').replace(/id="(top|bot|disc)-(\w)"/g, `id="$1-$2${n}"`).replace(/#(top|bot|disc)-(\w)\)?"/g, (m, a, b) => m.replace(`#${a}-${b}`, `#${a}-${b}${n}`)).replace(/width="1000" height="1000"/, 'width="100%" height="100%"'); };
const printBadge = (k) => badge(k).replace(/stroke-width="([\d.]+)"/g, (m, v) => (+v < 2 ? `stroke-width="${(+v * 1.6).toFixed(2)}"` : m));
const t = { bg: '#1F2A25', ink: '#EDE7DC', head: '#E4703A', acc: '#E4703A', soft: '#a9b3a7', qrD: '#0E1512', qrL: '#EDE7DC' };
const q = withMark(await QR.toString(GO, { type: 'svg', errorCorrectionLevel: 'H', margin: 4, color: { dark: t.qrD, light: t.qrL } }), t.qrL).replace('<svg ', '<svg width="100%" height="100%" ');
const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=DM+Sans:wght@400;500;700&display=block" rel="stylesheet">';
const person = (p) => `<div style="display:flex;flex-direction:column;gap:0.012in">
    <div class="o" style="font-weight:800;font-size:0.155in;color:${t.head};line-height:1.05;white-space:nowrap">${p.name}</div>
    <div style="font-size:0.09in;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${t.soft};white-space:nowrap">${p.title.replace('&', '&amp;')}</div>
    <div class="o" style="font-weight:700;font-size:0.125in;white-space:nowrap;margin-top:0.01in">${p.phone}</div>
    <div style="font-size:0.093in;white-space:nowrap">${p.email}</div></div>`;
const head = (only) => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
@page { size: 3.75in 2.25in; margin: 0; }
html, body { margin: 0; padding: 0; } * { box-sizing: border-box; }
body { font-family: 'DM Sans', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.o { font-family: Outfit, sans-serif; }
.page { width: 3.75in; height: 2.25in; background: ${t.bg}; color: ${t.ink}; position: relative; overflow: hidden; page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
.safe { position: absolute; inset: 0.3125in; }
${only ? `.page:not(.${only}){display:none}` : ''}
</style></head><body>`;
const pages = `<div class="page front"><div class="safe" style="display:flex;align-items:center;justify-content:center"><div style="width:1.62in;height:1.62in">${printBadge('b')}</div></div></div>
<div class="page back"><div class="safe" style="display:flex;align-items:center;gap:0.14in">
  <div style="flex:1;display:flex;flex-direction:column;gap:0.07in;min-width:0">
    ${PEOPLE.map(person).join('\n    ')}
    <div><div style="font-size:0.1in;font-weight:700;color:${t.acc}">${SITE}</div>
    <div style="font-size:0.09in;color:${t.soft};margin-top:0.015in;white-space:nowrap">${SERVICES}</div></div>
  </div>
  <div style="display:flex;flex-direction:column;align-items:center;gap:0.03in;flex:none"><div style="width:0.9in;height:0.9in">${q}</div><div class="o" style="font-weight:700;font-size:0.09in;color:${t.acc};text-align:center;line-height:1.15">Scan for more<br>information</div></div>
</div></div>
</body></html>`;
const f = join(PR, '365-Card-Brandon-Jen.html'), pdf = join(PR, '365-Card-Brandon-Jen.pdf');
writeFileSync(f, head('') + pages);
const url = (p) => 'file:///' + p.split('\\').join('/');
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${cdpDir()}`, '--virtual-time-budget=8000', `--print-to-pdf=${pdf}`, url(f)], { stdio: 'ignore' });
const n = (readFileSync(pdf, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
if (n !== 2) throw new Error('the card PDF has ' + n + ' pages, expected 2 (front, back)');
/* 300 dpi previews of each side, the same names as the fedex/ PNGs; the back's QR is decoded from its picture */
for (const [side, i] of [['front', 1], ['back', 2]]) {
  const h = join(PR, `365-Card-Brandon-Jen-${side}.tmp.html`), png = join(PR, 'fedex', `365-Card-Brandon-Jen-${i}.png`);
  writeFileSync(h, head(side) + pages);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${cdpDir()}`, '--window-size=360,216', '--force-device-scale-factor=3.125', '--virtual-time-budget=8000', `--screenshot=${png}`, url(h)], { stdio: 'ignore' });
  rmSync(h);
  if (side === 'back') {
    const im = PNG.sync.read(readFileSync(png)); const dec = jsQR(new Uint8ClampedArray(im.data), im.width, im.height);
    if (!dec || dec.data !== GO) throw new Error('the card back QR does not read back: ' + (dec && dec.data));
    console.log('back QR reads back as', dec.data);
  }
}
console.log('print-ready: 365-Card-Brandon-Jen.pdf (2 pages) + fedex/365-Card-Brandon-Jen-1.png, -2.png');
