/* Half-page ad for the Christmas concert programme (2026-10-29, Matthew: "we are also participating in a sponsoring a christmas concert.
   I need a half page ad that can go in their like brochure phamplet talking about our company that has our branding qr code etc.").
   Revised the same day (Matthew): "the concert ad can just have a qr code to the website ... it also needs to be Roughly 7.25" wide x 4.8"
   high ... landscape and give me a couple versions of it so that i can compare them for the best one. I think one of them should include
   photos of lawns we do just in case some people dont know what aeration is."
   Three versions, 7.25 x 4.8 in, no bleed (programme ads sit in a box; the printer can scale to fit):
     A  Clean     cream ground, green QR panel on the right, A-Green badge
     B  Photos    two of our own job photos (Brad aerating a backyard, from the drone; a finished lawn) with the site's one-line
                  explanation of aeration, for readers who don't know what it is
     C  Forest    all forest green, C-Light badge, cream type
   Sixfold 365 brand: Forest green #2F5D2C, Cream #FFF8EC, Ember #E4703A, Sun gold #F2C14E, Outfit + DM Sans (brand pack fonts).
   Words come from 365aeration.com (headline, "all over Colorado", the aeration line, phone). The QR is the plain website address,
   https://365aeration.com/ (no tracking), error correction H with the Ridge mark in the middle like the cards; each finished PNG is
   decoded again and the build fails if it does not read back.
   Needs: QR_DEPS = a node_modules with qrcode, jsqr, pngjs.   node build.mjs   -> concert-ad-<a|b|c>.html, .pdf, .png (300 dpi) */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRAND = join(HERE, '../../brand/combined-365-2026-10');
const PACK = join(BRAND, 'brand-pack/365-Sixfold-Brand-Pack');
const PHOTOS = join(HERE, 'photos');   /* two of Brad's job photos already on the Facebook page (PHOTO-LEDGER: Used), location data stripped; gitignored */
const req = createRequire(join(process.env.QR_DEPS || '', 'x.js'));
const QR = req('qrcode'), jsQR = req('jsqr'), { PNG } = req('pngjs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const cdpDirs = []; const cdpDir = () => { const d = mkdtempSync(join(tmpdir(), 'cdp-')); cdpDirs.push(d); return d; };
process.on('exit', () => { for (const d of cdpDirs) try { rmSync(d, { recursive: true, force: true, maxRetries: 50, retryDelay: 200 }); } catch {} });

const W = 7.25, H = 4.8;                       /* inches */
const GO = 'https://365aeration.com/';
const PHONE = '(720) 830-4553', SITE = '365aeration.com';
const HEAD = 'From the lawn to the treeline, all year long.';
const SVC = 'Core aeration, overseeding, fertilizing, landscaping and fire mitigation, all over Colorado.';
/* the greeting is said in person (2026-10-29, Matthew: the ad "has to soley be about the business and services"); this line is the
   site's "Keeping it" and "Land & trees" */
const MORE = '<b>Regular upkeep too:</b> fertilizer, mowing and edging, plus beds, brush and trees.';

/* the Ridge mark in the middle of the code, exactly as build-print.mjs puts it on the cards */
const bsrc = readFileSync(join(BRAND, 'build.mjs'), 'utf8');
const ridge = eval(bsrc.slice(bsrc.indexOf('const ridge = '), bsrc.indexOf('`;', bsrc.indexOf('const ridge = ')) + 1).replace('const ridge = ', '(') + ')');
const withMark = (svg, light) => {
  const vb = +svg.match(/viewBox="0 0 (\d+) \d+"/)[1], pad = 9, x0 = (vb - pad) / 2, sc = (pad - 1.4) / 100;
  return svg.replace('</svg>', `<g shape-rendering="geometricPrecision"><rect x="${x0}" y="${x0}" width="${pad}" height="${pad}" rx="1.2" fill="${light}"/>`
    + `<g transform="translate(${x0 + (pad - 94 * sc) / 2 - 4 * sc} ${x0 + (pad - 99 * sc) / 2 - 14 * sc}) scale(${sc})">${ridge('#E4703A', '#4C7A3F')}</g></g></svg>`);
};
const qr = withMark(await QR.toString(GO, { type: 'svg', errorCorrectionLevel: 'H', margin: 4, color: { dark: '#1D2A1C', light: '#FFF8EC' } }), '#FFF8EC');

const u = (p) => pathToFileURL(p).href;
const font = (n) => u(join(PACK, 'Fonts', n));
const badgeA = u(join(PACK, 'Full colour', '365-Badge-A-Green.png')), badgeC = u(join(PACK, 'Full colour', '365-Badge-C-Light.png'));
const photo = (n) => u(join(PHOTOS, n));

const BASE = `@font-face{font-family:Outfit;src:url("${font('Outfit.ttf')}")}
@font-face{font-family:'DM Sans';src:url("${font('DMSans.ttf')}")}
@page{size:${W}in ${H}in;margin:0}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{width:${W}in;height:${H}in;background:#FFF8EC;color:#1D2A1C;font-family:'DM Sans',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ad{position:relative;width:${W}in;height:${H}in;overflow:hidden}
.top{display:flex;align-items:center;gap:.15in}.top img{display:block;flex:none}
.name{font-family:Outfit,sans-serif;font-weight:700;line-height:1;margin:0;letter-spacing:-.01em}
.desc{font-size:7.4pt;letter-spacing:.2em;text-transform:uppercase;margin:4pt 0 0}
h1{font-family:Outfit,sans-serif;font-weight:600;line-height:1.1;margin:0;text-wrap:balance}
p{margin:0}.svc,.thanks{text-wrap:pretty}
.rule{width:.6in;height:2.4pt;background:#E4703A;border-radius:2pt}
.qr{background:#FFF8EC;border-radius:8pt}.qr svg{width:100%;height:100%;display:block}
.scan{font-family:Outfit,sans-serif;font-weight:600;line-height:1.15}
.phone{font-family:Outfit,sans-serif;font-weight:700;letter-spacing:.01em}`;

const V = {
  /* A: the first design, resized */
  a: `<style>${BASE}
.ad{display:grid;grid-template-columns:1fr 2.3in;border:1.2pt solid #2F5D2C}
.l{padding:.32in .3in .3in .34in;display:flex;flex-direction:column;justify-content:space-between}
.top img{width:1.2in;height:1.2in}.name{font-size:28pt;color:#2F5D2C}.desc{color:#4C7A3F}
h1{font-size:21pt}.svc{font-size:11.5pt;line-height:1.4;margin-top:6pt;color:#33402f}.rule{margin-bottom:7pt}.thanks{font-size:11.5pt;line-height:1.4}.thanks b{color:#2F5D2C}
.r{background:#2F5D2C;color:#FFF8EC;padding:.24in .2in;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.scan{font-size:15pt;margin-bottom:.12in}.qr{width:1.6in;height:1.6in}.or{font-size:8.6pt;opacity:.85;margin:.13in 0 2pt}.phone{font-size:17pt;color:#F2C14E}.site{font-size:10.6pt;margin-top:3pt}
</style><div class="ad">
<div class="l"><div class="top"><img src="${badgeA}" alt="Sixfold 365"><div><p class="name">Sixfold 365</p><p class="desc">Land · Aeration &amp; Seeding</p></div></div>
  <div><h1>${HEAD}</h1><p class="svc">${SVC}</p></div>
  <div><div class="rule"></div><p class="thanks">${MORE}</p></div></div>
<div class="r"><p class="scan">Scan for a<br>free quote</p><div class="qr">${qr}</div><p class="or">or call or text</p><p class="phone">${PHONE}</p><p class="site">${SITE}</p></div>
</div>`,
  /* B: two of our aeration photos with the site's explanation, for readers who don't know what aeration is */
  b: `<style>${BASE}
.ad{display:grid;grid-template-rows:1.95in 1fr;border:1.2pt solid #2F5D2C}
.ph{display:grid;grid-template-columns:1fr 1fr;gap:2pt;background:#FFF8EC;position:relative}
.ph figure{margin:0;position:relative;overflow:hidden}.ph img{width:100%;height:100%;object-fit:cover;display:block}
.ph figcaption{position:absolute;left:0;right:0;bottom:0;padding:16pt 9pt 6pt;font-size:8.6pt;font-weight:700;color:#FFF8EC;background:linear-gradient(transparent,rgba(14,21,18,.82))}
.bd{display:grid;grid-template-columns:1fr 1.55in;gap:.2in;padding:.18in .24in .18in .26in;align-items:center}
.top img{width:.78in;height:.78in}.name{font-size:20pt;color:#2F5D2C}.desc{font-size:6.6pt;color:#4C7A3F}
.what{font-size:10pt;line-height:1.38;margin-top:7pt;color:#33402f}.what b{color:#1D2A1C}
.thanks{font-size:9.6pt;line-height:1.35;margin-top:6pt}.thanks b{color:#2F5D2C}
.r{display:flex;flex-direction:column;align-items:center;text-align:center}
.scan{font-size:11.5pt;color:#2F5D2C;margin-bottom:4pt}.qr{width:1.18in;height:1.18in;outline:1pt solid #d9d2c3}.phone{font-size:13pt;color:#2F5D2C;margin-top:5pt}.site{font-size:9pt;margin-top:1pt}
</style><div class="ad">
<div class="ph"><figure><img src="${photo('aerating.jpg')}" alt=""><figcaption>Core aerating a backyard lawn</figcaption></figure>
  <figure><img src="${photo('finished-lawn.jpg')}" alt=""><figcaption>One of our recent lawns</figcaption></figure></div>
<div class="bd"><div><div class="top"><img src="${badgeA}" alt="Sixfold 365"><div><p class="name">Sixfold 365</p><p class="desc">Land · Aeration &amp; Seeding</p></div></div>
  <p class="what"><b>What is core aeration?</b> On compacted ground, water and fertilizer run off before they reach the roots. A machine pulls small plugs of soil to open the lawn back up, and we overseed while the holes are open.</p></div>
  <div class="r"><p class="scan">Scan for a free quote</p><div class="qr">${qr}</div><p class="phone">${PHONE}</p><p class="site">${SITE}</p></div></div>
</div>`,
  /* C: all forest green */
  c: `<style>${BASE}
body{background:#2F5D2C}.ad{background:#2F5D2C;color:#FFF8EC;display:grid;grid-template-columns:1fr 2.05in;gap:.25in;padding:.32in .34in .3in .36in}
.l{display:flex;flex-direction:column;justify-content:space-between}
.top img{width:1.2in;height:1.2in}.name{font-size:28pt;color:#FFF8EC}.desc{color:#F2C14E}
h1{font-size:21pt;color:#FFF8EC}.svc{font-size:11.5pt;line-height:1.4;margin-top:6pt;color:#e4e9dc}.rule{margin-bottom:7pt}.thanks{font-size:11.5pt;line-height:1.4;color:#e4e9dc}.thanks b{color:#F2C14E}
.r{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-left:1pt solid rgba(255,248,236,.25);padding-left:.22in}
.scan{font-size:15pt;margin-bottom:.12in}.qr{width:1.55in;height:1.55in}.or{font-size:8.6pt;opacity:.85;margin:.13in 0 2pt}.phone{font-size:16.5pt;color:#F2C14E}.site{font-size:10.6pt;margin-top:3pt}
</style><div class="ad">
<div class="l"><div class="top"><img src="${badgeC}" alt="Sixfold 365"><div><p class="name">Sixfold 365</p><p class="desc">Land · Aeration &amp; Seeding</p></div></div>
  <div><h1>${HEAD}</h1><p class="svc">${SVC}</p></div>
  <div><div class="rule"></div><p class="thanks">${MORE}</p></div></div>
<div class="r"><p class="scan">Scan for a<br>free quote</p><div class="qr">${qr}</div><p class="or">or call or text</p><p class="phone">${PHONE}</p><p class="site">${SITE}</p></div>
</div>`,
};

const run = (args) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--allow-file-access-from-files', `--user-data-dir=${cdpDir()}`, ...args], { stdio: 'pipe', timeout: 120000 });
for (const [k, body] of Object.entries(V)) {
  const f = join(HERE, `concert-ad-${k}.html`), pdf = join(HERE, `concert-ad-${k}.pdf`), png = join(HERE, `concert-ad-${k}.png`);
  writeFileSync(f, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sixfold 365 concert ad ${k.toUpperCase()}</title></head><body>${body}</body></html>`);
  run([`--print-to-pdf=${pdf}`, '--no-pdf-header-footer', '--virtual-time-budget=5000', u(f)]);
  run(['--screenshot=' + png, `--window-size=${Math.round(W * 96)},${Math.round(H * 96)}`, `--force-device-scale-factor=${300 / 96}`, '--hide-scrollbars', '--virtual-time-budget=5000', u(f)]);
  const n = (readFileSync(pdf, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  if (n !== 1) throw new Error(`concert-ad-${k}.pdf has ${n} pages, expected 1`);
  const im = PNG.sync.read(readFileSync(png)); const dec = jsQR(new Uint8ClampedArray(im.data), im.width, im.height);
  if (!dec || dec.data !== GO) throw new Error(`the QR on version ${k} does not read back: ` + (dec && dec.data));
  console.log(`concert-ad-${k}: 1 page, ${W} x ${H} in, ${im.width} x ${im.height} px; QR reads back as ${dec.data}`);
}
