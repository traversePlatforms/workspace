/* Half-page ad for the Christmas concert programme (2026-10-29, Matthew: "we are also participating in a sponsoring a christmas concert.
   I need a half page ad that can go in their like brochure phamplet talking about our company that has our branding qr code etc.").
   Revised the same day (Matthew): "the concert ad can just have a qr code to the website ... it also needs to be Roughly 7.25" wide x 4.8"
   high ... landscape and give me a couple versions of it so that i can compare them for the best one. I think one of them should include
   photos of lawns we do just in case some people dont know what aeration is."
   Versions (1 Nov 2026, Matthew: "Get rid of A, C is better. And make 2 more images, one using photos of our work and one without
   photos but a different style and format"; B to say how we do it and why it helps). No bleed (programme ads sit in a box; the printer
   can scale to fit). A (clean cream) was dropped; its last files are in superseded/.
     B  Photos    7.25 x 4.8 in: two of our own job photos, How we do it (3 steps) and Why it helps
     C  Forest    7.25 x 4.8 in: all forest green, C-Light badge, cream type
     D  Work      7.25 x 4.8 in: a wall of three of our job photos, forest green panel with the headline and QR
     E  Drawn     4.8 x 7.25 in PORTRAIT: no photos, a drawing of core aeration, the three steps, QR in a green footer
   Sixfold 365 brand: Forest green #2F5D2C, Cream #FFF8EC, Ember #E4703A, Sun gold #F2C14E, Outfit + DM Sans (brand pack fonts).
   Words come from 365aeration.com (headline, "all over Colorado", the aeration line, phone). The QR is the plain website address,
   https://365aeration.com/ (no tracking), error correction H with the Ridge mark in the middle like the cards; each finished PNG is
   decoded again and the build fails if it does not read back.
   Needs: QR_DEPS = a node_modules with qrcode, jsqr, pngjs.   node build.mjs   -> concert-ad-<b|c|d|e>.html, .pdf, .png (300 dpi) */
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

const BASE = (w, h) => `@font-face{font-family:Outfit;src:url("${font('Outfit.ttf')}")}
@font-face{font-family:'DM Sans';src:url("${font('DMSans.ttf')}")}
@page{size:${w}in ${h}in;margin:0}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{width:${w}in;height:${h}in;background:#FFF8EC;color:#1D2A1C;font-family:'DM Sans',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ad{position:relative;width:${w}in;height:${h}in;overflow:hidden}
.top{display:flex;align-items:center;gap:.15in}.top img{display:block;flex:none}
.name{font-family:Outfit,sans-serif;font-weight:700;line-height:1;margin:0;letter-spacing:-.01em}
.desc{font-size:7.4pt;letter-spacing:.2em;text-transform:uppercase;margin:4pt 0 0}
h1,h2{font-family:Outfit,sans-serif;font-weight:600;line-height:1.1;margin:0;text-wrap:balance}
p{margin:0}.svc,.thanks{text-wrap:pretty}
.rule{width:.6in;height:2.4pt;background:#E4703A;border-radius:2pt}
.qr{background:#FFF8EC;border-radius:8pt}.qr svg{width:100%;height:100%;display:block}
.scan{font-family:Outfit,sans-serif;font-weight:600;line-height:1.15}
.phone{font-family:Outfit,sans-serif;font-weight:700;letter-spacing:.01em}`;

/* how we do it and why it helps (1 Nov, Matthew: on the photo version, "include how we do it like this is what we do and why it helps").
   Every line is already on the site or in its fact-check: plugs 2-3 in deep and compaction shedding water and fertilizer (CSU PlantTalk
   1505); seed straight after aerating (CSU fact sheet 7.241); plugs left to break down (UMass Extension); root and soil conditioner and
   fertilizer are our own job steps (the aftercare, afParts in the app). */
const STEPS = [
  ['Pull plugs', 'Our machine pulls small plugs of soil, about 2 to 3 inches deep, all over the lawn.'],
  ['Seed the holes', 'We overseed straight after, while the holes are open, with a root and soil conditioner.'],
  ['Feed it', 'Fertilizer goes down to help the new grass come in.'],
];
const WHY = 'On compacted ground, water and fertilizer run off before they reach the roots. The holes let them soak in where the grass needs them, and the plugs break down back into the lawn.';

/* E's drawing: a slice of lawn and soil, three plug holes with seed in them, a pulled plug on top, water going down to the roots */
const diagram = `<svg viewBox="0 0 400 150" xmlns="http://www.w3.org/2000/svg" font-family="DM Sans, sans-serif">
  <rect x="0" y="52" width="400" height="98" rx="10" fill="#8a6a4a"/>
  <rect x="0" y="52" width="400" height="44" fill="#9c7a56"/>
  <rect x="0" y="40" width="400" height="16" rx="4" fill="#4C7A3F"/>
  ${Array.from({ length: 58 }, (_, i) => { const x = 4 + i * 6.9, hgt = 10 + (i * 37 % 9); return `<path d="M${x} 44 q2 -${hgt / 2} ${(i % 2 ? 3 : -2)} -${hgt}" stroke="#2F5D2C" stroke-width="2.2" fill="none" stroke-linecap="round"/>`; }).join('')}
  ${[78, 200, 322].map((x) => `<rect x="${x - 11}" y="42" width="22" height="66" rx="10" fill="#4a3624"/>
    <circle cx="${x - 4}" cy="96" r="3" fill="#F2C14E"/><circle cx="${x + 4}" cy="86" r="3" fill="#F2C14E"/><circle cx="${x - 2}" cy="76" r="3" fill="#F2C14E"/>
    <path d="M${x} 6 v26" stroke="#5b9bd5" stroke-width="3" stroke-linecap="round"/><path d="M${x - 6} 26 l6 8 l6 -8" stroke="#5b9bd5" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
  ${[40, 120, 160, 250, 285, 365].map((x, i) => `<path d="M${x} 58 q${i % 2 ? 8 : -8} 30 ${i % 2 ? -4 : 6} 70 M${x} 70 q${i % 2 ? -14 : 14} 18 ${i % 2 ? -20 : 18} 34" stroke="#e8dcc4" stroke-width="1.6" fill="none" opacity=".75"/>`).join('')}
  <g transform="rotate(-14 140 30)"><rect x="124" y="20" width="34" height="13" rx="6.5" fill="#6b4e33"/><rect x="124" y="20" width="9" height="13" rx="4.5" fill="#4C7A3F"/></g>
  <text x="200" y="140" text-anchor="middle" font-size="12.5" fill="#FFF8EC" font-weight="700">Holes about 2 to 3 inches deep</text>
</svg>`;

const V = {
  /* B: our photos, what we do in three steps and why it helps (revised 1 Nov) */
  b: { w: W, h: H, body: `<style>${BASE(W, H)}
.ad{display:grid;grid-template-rows:1.72in 1fr;border:1.2pt solid #2F5D2C}
.ph{display:grid;grid-template-columns:1fr 1fr;gap:2pt;background:#FFF8EC}
.ph figure{margin:0;position:relative;overflow:hidden}.ph img{width:100%;height:100%;object-fit:cover;display:block}
.ph figcaption{position:absolute;left:0;right:0;bottom:0;padding:14pt 9pt 5pt;font-size:8.2pt;font-weight:700;color:#FFF8EC;background:linear-gradient(transparent,rgba(14,21,18,.82))}
.bd{display:grid;grid-template-columns:1fr 1.42in;gap:.18in;padding:.13in .2in .13in .22in}
.top{gap:.1in}.top img{width:.52in;height:.52in}.name{font-size:15pt;color:#2F5D2C}.desc{font-size:5.8pt;color:#4C7A3F;margin-top:2pt}
.cols{display:grid;grid-template-columns:1.12fr 1fr;gap:.17in;margin-top:7pt}
h2{font-size:10.6pt;color:#2F5D2C;margin-bottom:4pt}
ol{list-style:none;margin:0;padding:0}li{display:grid;grid-template-columns:13pt 1fr;gap:4pt;font-size:8.1pt;line-height:1.33;margin-bottom:4pt;color:#33402f}
li i{font-style:normal;width:13pt;height:13pt;border-radius:50%;background:#E4703A;color:#FFF8EC;font-weight:700;font-size:7.4pt;display:flex;align-items:center;justify-content:center;margin-top:.5pt}
li b{color:#1D2A1C}
.why{font-size:8.3pt;line-height:1.38;color:#33402f}
.r{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-left:1pt solid #e2dacb;padding-left:.14in}
.scan{font-size:9.4pt;color:#2F5D2C;margin-bottom:5pt;white-space:nowrap}.qr{width:1.12in;height:1.12in;outline:1pt solid #d9d2c3}.phone{font-size:12pt;color:#2F5D2C;margin-top:5pt}.site{font-size:8.6pt;margin-top:1pt}
</style><div class="ad">
<div class="ph"><figure><img src="${photo('aerating.jpg')}" alt="" style="object-position:50% 12%"><figcaption>Core aerating a backyard lawn</figcaption></figure>
  <figure><img src="${photo('finished-lawn.jpg')}" alt=""><figcaption>One of our recent lawns</figcaption></figure></div>
<div class="bd"><div><div class="top"><img src="${badgeA}" alt="Sixfold 365"><div><p class="name">Sixfold 365</p><p class="desc">Land · Aeration &amp; Seeding</p></div></div>
  <div class="cols"><div><h2>How we do it</h2><ol>${STEPS.map(([t, d], i) => `<li><i>${i + 1}</i><span><b>${t}.</b> ${d}</span></li>`).join('')}</ol></div>
    <div><h2>Why it helps</h2><p class="why">${WHY}</p></div></div></div>
  <div class="r"><p class="scan">Scan for a free quote</p><div class="qr">${qr}</div><p class="phone">${PHONE}</p><p class="site">${SITE}</p></div></div>
</div>` },
  /* C: all forest green (Matthew 1 Nov: "C is better" than A, which is dropped) */
  c: { w: W, h: H, body: `<style>${BASE(W, H)}
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
</div>` },
  /* D: a photo wall of our work on the left, a forest green panel on the right (1 Nov: "one using photos of our work"). The three photos
     are from the Backyards and Front lawns sets, already cropped clear of plates, house numbers, faces and signs (PHOTO-LEDGER) */
  d: { w: W, h: H, body: `<style>${BASE(W, H)}
.ad{display:grid;grid-template-columns:3.95in 1fr;background:#2F5D2C}
.wall{display:grid;grid-template-columns:1.6fr 1fr;grid-template-rows:1fr 1fr;gap:2.5pt;background:#2F5D2C}
.wall img{width:100%;height:100%;object-fit:cover;display:block}.wall .big{grid-row:1 / 3}
.tag{position:absolute;left:.16in;bottom:.16in;background:#FFF8EC;color:#2F5D2C;font-family:Outfit,sans-serif;font-weight:700;font-size:9pt;padding:4pt 9pt;border-radius:20pt}
.p{color:#FFF8EC;padding:.26in .26in .24in .26in;display:flex;flex-direction:column;justify-content:space-between}
.top{gap:.1in}.top img{width:.7in;height:.7in}.name{font-size:18pt;color:#FFF8EC}.desc{font-size:5.9pt;color:#F2C14E;margin-top:3pt}
h1{font-size:15.5pt;color:#FFF8EC}.svc{font-size:8.9pt;line-height:1.38;margin-top:5pt;color:#e4e9dc}
.foot{display:grid;grid-template-columns:1.02in 1fr;gap:.14in;align-items:center}
.qr{width:1.02in;height:1.02in}.scan{font-size:10.5pt}.phone{font-size:12.5pt;color:#F2C14E;margin-top:4pt}.site{font-size:8.6pt;margin-top:1pt;color:#e4e9dc}
</style><div class="ad">
<div class="wall" style="position:relative"><img class="big" src="${photo('work-terraced.jpg')}" alt=""><img src="${photo('work-front.jpg')}" alt=""><img src="${photo('work-treeline.jpg')}" alt=""><span class="tag">Lawns we've aerated and seeded</span></div>
<div class="p"><div class="top"><img src="${badgeC}" alt="Sixfold 365"><div><p class="name">Sixfold 365</p><p class="desc">Land · Aeration &amp; Seeding</p></div></div>
  <div><h1>${HEAD}</h1><p class="svc">${SVC}</p></div>
  <div class="foot"><div class="qr">${qr}</div><div><p class="scan">Scan for a free quote</p><p class="phone">${PHONE}</p><p class="site">${SITE}</p></div></div></div>
</div>` },
  /* E: no photos, a different shape: PORTRAIT 4.8 x 7.25 in (the same half page stood up), with a drawing of core aeration in place of
     photos (1 Nov: "one without photos but a different style and format") */
  e: { w: H, h: W, body: `<style>${BASE(H, W)}
.ad{display:flex;flex-direction:column;border:1.2pt solid #2F5D2C}
.hd{padding:.2in .3in 0;text-align:center}.hd img{width:.7in;height:.7in;display:block;margin:0 auto 5pt}
.name{font-size:18pt;color:#2F5D2C}.desc{color:#4C7A3F;font-size:6.2pt}
h1{font-size:17pt;color:#1D2A1C;margin:.13in .25in 0;text-align:center}
.dg{margin:.1in .32in 0}.dg svg{width:100%;display:block}
.why{font-size:8.6pt;line-height:1.38;color:#33402f;margin:.09in .32in 0;text-align:center;text-wrap:pretty}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:.1in;margin:.12in .26in 0}
.st{border-top:2.4pt solid #E4703A;padding-top:5pt;font-size:7.8pt;line-height:1.32;color:#33402f}.st b{display:block;font-family:Outfit,sans-serif;font-size:9.6pt;color:#2F5D2C;margin-bottom:2pt}
.more{font-size:8pt;line-height:1.35;text-align:center;margin:.1in .32in .12in;color:#33402f}.more b{color:#2F5D2C}
.ft{margin-top:auto;background:#2F5D2C;color:#FFF8EC;display:grid;grid-template-columns:1.1in 1fr;gap:.2in;align-items:center;padding:.16in .34in}
.qr{width:1.1in;height:1.1in}.scan{font-size:12pt}.phone{font-size:15pt;color:#F2C14E;margin-top:5pt}.site{font-size:9.6pt;margin-top:2pt}
</style><div class="ad">
<div class="hd"><img src="${badgeA}" alt="Sixfold 365"><p class="name">Sixfold 365</p><p class="desc">Land · Aeration &amp; Seeding</p></div>
<h1>Pull a plug. Grow a lawn.</h1>
<div class="dg">${diagram}</div>
<p class="why">${WHY}</p>
<div class="steps">${STEPS.map(([t, d]) => `<div class="st"><b>${t}</b>${d}</div>`).join('')}</div>
<p class="more">Also: fertilizing, mowing and edging, landscaping and fire mitigation, all over Colorado.</p>
<div class="ft"><div class="qr">${qr}</div><div><p class="scan">Scan for a free quote</p><p class="phone">${PHONE}</p><p class="site">${SITE}</p></div></div>
</div>` },
};

const run = (args) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--allow-file-access-from-files', `--user-data-dir=${cdpDir()}`, ...args], { stdio: 'pipe', timeout: 120000 });
for (const [k, { w, h, body }] of Object.entries(V)) {
  const f = join(HERE, `concert-ad-${k}.html`), pdf = join(HERE, `concert-ad-${k}.pdf`), png = join(HERE, `concert-ad-${k}.png`);
  writeFileSync(f, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sixfold 365 concert ad ${k.toUpperCase()}</title></head><body>${body}</body></html>`);
  run([`--print-to-pdf=${pdf}`, '--no-pdf-header-footer', '--virtual-time-budget=5000', u(f)]);
  run(['--screenshot=' + png, `--window-size=${Math.round(w * 96)},${Math.round(h * 96)}`, `--force-device-scale-factor=${300 / 96}`, '--hide-scrollbars', '--virtual-time-budget=5000', u(f)]);
  const n = (readFileSync(pdf, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  if (n !== 1) throw new Error(`concert-ad-${k}.pdf has ${n} pages, expected 1`);
  const im = PNG.sync.read(readFileSync(png)); const dec = jsQR(new Uint8ClampedArray(im.data), im.width, im.height);
  if (!dec || dec.data !== GO) throw new Error(`the QR on version ${k} does not read back: ` + (dec && dec.data));
  console.log(`concert-ad-${k}: 1 page, ${w} x ${h} in, ${im.width} x ${im.height} px; QR reads back as ${dec.data}`);
}
