/* Half-page ad for the Christmas concert programme (2026-10-29, Matthew: "we are also participating in a sponsoring a christmas concert.
   I need a half page ad that can go in their like brochure phamplet talking about our company that has our branding qr code etc.").
   Sixfold 365 brand: the A-Green badge from the brand pack (for light grounds), Forest green / Cream / Ember, Outfit + DM Sans.
   Size: 7.5 x 4.75 in, half of a letter page inside 0.5 in margins, no bleed (programme ads sit in a box). The programme's own ad size
   was not given; change W and H below when it is, and every measure follows.
   Words come from the 365 site (365aeration.com: the headline, "all over Colorado", phone) and the print set (build-print.mjs).
   The QR goes to https://365aeration.com/concert/ (api/go.php on the 365 site: counted, time + piece only, opens the quote form with
   ?from=concert), so where it leads can change without reprinting. Error correction H with the Ridge mark in the middle, like the
   cards and magnets; the finished PNG is decoded again below and the build fails if it does not read back.
   Needs: QR_DEPS = a node_modules with qrcode, jsqr, pngjs.   node build.mjs   -> concert-ad.html, .pdf, .png (300 dpi) */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRAND = join(HERE, '../../brand/combined-365-2026-10');
const PACK = join(BRAND, 'brand-pack/365-Sixfold-Brand-Pack');
const req = createRequire(join(process.env.QR_DEPS || '', 'x.js'));
const QR = req('qrcode'), jsQR = req('jsqr'), { PNG } = req('pngjs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const cdpDirs = []; const cdpDir = () => { const d = mkdtempSync(join(tmpdir(), 'cdp-')); cdpDirs.push(d); return d; };
process.on('exit', () => { for (const d of cdpDirs) try { rmSync(d, { recursive: true, force: true, maxRetries: 50, retryDelay: 200 }); } catch {} });

const W = 7.5, H = 4.75;                       /* inches */
const GO = 'https://365aeration.com/concert/';
const PHONE = '(720) 830-4553', SITE = '365aeration.com';

/* the Ridge mark in the middle of the code, exactly as build-print.mjs puts it on the cards */
const bsrc = readFileSync(join(BRAND, 'build.mjs'), 'utf8');
const ridge = eval(bsrc.slice(bsrc.indexOf('const ridge = '), bsrc.indexOf('`;', bsrc.indexOf('const ridge = ')) + 1).replace('const ridge = ', '(') + ')');
const withMark = (svg, light) => {
  const vb = +svg.match(/viewBox="0 0 (\d+) \d+"/)[1], pad = 9, x0 = (vb - pad) / 2, sc = (pad - 1.4) / 100;
  return svg.replace('</svg>', `<g shape-rendering="geometricPrecision"><rect x="${x0}" y="${x0}" width="${pad}" height="${pad}" rx="1.2" fill="${light}"/>`
    + `<g transform="translate(${x0 + (pad - 94 * sc) / 2 - 4 * sc} ${x0 + (pad - 99 * sc) / 2 - 14 * sc}) scale(${sc})">${ridge('#E4703A', '#4C7A3F')}</g></g></svg>`);
};
const qr = withMark(await QR.toString(GO, { type: 'svg', errorCorrectionLevel: 'H', margin: 4, color: { dark: '#1D2A1C', light: '#FFF8EC' } }), '#FFF8EC');

const font = (n) => pathToFileURL(join(PACK, 'Fonts', n)).href;
const badge = pathToFileURL(join(PACK, 'Full colour', '365-Badge-A-Green.png')).href;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sixfold 365 concert ad</title><style>
@font-face{font-family:Outfit;src:url("${font('Outfit.ttf')}")}
@font-face{font-family:'DM Sans';src:url("${font('DMSans.ttf')}")}
@page{size:${W}in ${H}in;margin:0}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{width:${W}in;height:${H}in;background:#FFF8EC;color:#1D2A1C;font-family:'DM Sans',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ad{position:relative;width:${W}in;height:${H}in;display:grid;grid-template-columns:1fr 2.35in;overflow:hidden;border:1.2pt solid #2F5D2C}
.l{padding:.3in .3in .3in .34in;display:flex;flex-direction:column;justify-content:space-between}
.top{display:flex;align-items:center;gap:.16in}
.top img{width:1.2in;height:1.2in;display:block;flex:none}
.name{font-family:Outfit,sans-serif;font-weight:700;font-size:28pt;line-height:1;color:#2F5D2C;margin:0;letter-spacing:-.01em}
.desc{font-size:7.4pt;letter-spacing:.2em;text-transform:uppercase;color:#4C7A3F;margin:4pt 0 0}
h1{font-family:Outfit,sans-serif;font-weight:600;font-size:21pt;line-height:1.1;margin:0;color:#1D2A1C;text-wrap:balance}
.svc{font-size:11.5pt;line-height:1.4;margin:6pt 0 0;color:#33402f;text-wrap:pretty}
.rule{width:.6in;height:2.4pt;background:#E4703A;border-radius:2pt;margin:0 0 7pt}
.thanks{font-size:11.5pt;line-height:1.4;margin:0;color:#1D2A1C;text-wrap:pretty}
.thanks b{color:#2F5D2C}
.r{background:#2F5D2C;color:#FFF8EC;padding:.24in .22in;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.scan{font-family:Outfit,sans-serif;font-weight:600;font-size:15pt;line-height:1.15;margin:0 0 .12in}
.qr{width:1.6in;height:1.6in;background:#FFF8EC;border-radius:8pt;padding:0}
.qr svg{width:100%;height:100%;display:block}
.or{font-size:8.6pt;opacity:.85;margin:.13in 0 2pt}
.phone{font-family:Outfit,sans-serif;font-weight:700;font-size:17pt;letter-spacing:.01em;margin:0;color:#F2C14E}
.site{font-size:10.6pt;margin:3pt 0 0;letter-spacing:.02em}
</style></head><body><div class="ad">
<div class="l">
  <div class="top"><img src="${badge}" alt="Sixfold 365">
    <div><p class="name">Sixfold 365</p><p class="desc">Land · Aeration &amp; Seeding</p></div></div>
  <div><h1>From the lawn to the treeline, all year long.</h1>
  <p class="svc">Core aeration, overseeding, fertilizing, landscaping and fire mitigation, all over Colorado.</p></div>
  <div><div class="rule"></div>
  <p class="thanks"><b>Proud to support this Christmas concert.</b> Merry Christmas from all of us at Sixfold 365.</p></div>
</div>
<div class="r">
  <p class="scan">Scan for a<br>free quote</p>
  <div class="qr">${qr}</div>
  <p class="or">or call or text</p>
  <p class="phone">${PHONE}</p>
  <p class="site">${SITE}</p>
</div>
</div></body></html>`;
writeFileSync(join(HERE, 'concert-ad.html'), html);

const src = pathToFileURL(join(HERE, 'concert-ad.html')).href;
const run = (args) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--allow-file-access-from-files', `--user-data-dir=${cdpDir()}`, ...args], { stdio: 'pipe', timeout: 120000 });
run([`--print-to-pdf=${join(HERE, 'concert-ad.pdf')}`, '--no-pdf-header-footer', '--virtual-time-budget=4000', src]);
const sc = 300 / 96;
run(['--screenshot=' + join(HERE, 'concert-ad.png'), `--window-size=${Math.round(W * 96)},${Math.round(H * 96)}`, `--force-device-scale-factor=${sc}`, '--hide-scrollbars', '--virtual-time-budget=4000', src]);

const pages = (readFileSync(join(HERE, 'concert-ad.pdf'), 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
if (pages !== 1) throw new Error('the PDF has ' + pages + ' pages, expected 1');
/* decode the code from the finished piece, not from the source */
const png = PNG.sync.read(readFileSync(join(HERE, 'concert-ad.png')));
const dec = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
if (!dec || dec.data !== GO) throw new Error('the QR on the finished ad does not read back: ' + (dec && dec.data));
console.log(`concert-ad.pdf 1 page, ${W} x ${H} in; concert-ad.png ${png.width} x ${png.height}; QR reads back as ${dec.data}`);
