/* Print mockups for the three Sixfold x 365 badges (2026-10-15, Matthew: "business cards, yard signs, and car magnets made with the new
   logo ... So i can see how all 3 look with the 3 different branding. The car magnets will go on 2 trucks, the tacoma, one is a ev hummer
   truck thing. And then also on my tesla."). For each badge A/B/C: business card front + back (3.5 x 2 in), yard sign (24 x 18 in),
   truck magnet (24 x 12 in), car magnet for the Tesla (18 x 12 in). Rendered at 100 px per inch (cards 300) for review, plus one page with
   everything. Print-ready files with bleed come after a pick.
   Needs: QR_DEPS = a node_modules with qrcode, jsqr, pngjs.   node build-print.mjs */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'print');
mkdirSync(OUT, { recursive: true });
const req = createRequire(join(process.env.QR_DEPS || '', 'x.js'));
const QR = req('qrcode'), jsQR = req('jsqr'), { PNG } = req('pngjs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'https://365aeration.com', PHONE = '(720) 830-4553', SITE = '365aeration.com', EMAIL = 'contact@365aeration.com';
const SERVICES = 'Core aeration \u00b7 Overseeding \u00b7 Fertilizer';
/* the QR, checked: a PNG of it must read back as the address */
const QRS = {};
for (const [d, l] of [['#1D2A1C', '#FFF8EC'], ['#0E1512', '#EDE7DC'], ['#1D2A1C', '#EDE7DC']]) QRS[d + l] = await QR.toString(URL, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: d, light: l } });
const qrSvg = (dark, light) => QRS[dark + light];
const pngPath = join(OUT, 'qr-check.png');
await QR.toFile(pngPath, URL, { errorCorrectionLevel: 'M', margin: 4, width: 600 });
const png = PNG.sync.read(readFileSync(pngPath)); const dec = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
if (!dec || dec.data !== URL) throw new Error('QR does not read back: ' + (dec && dec.data));
console.log('QR reads back as', dec.data);
/* the badges as drawn by build.mjs, made safe to place more than once on a page */
let uid = 0;
const badge = (k) => { const n = 'u' + (uid++); return readFileSync(join(HERE, `option-${k}.svg`), 'utf8').replace(/id="(top|bot|disc)-(\w)"/g, `id="$1-$2${n}"`).replace(/#(top|bot|disc)-(\w)\)?"/g, (m, a, b) => m.replace(`#${a}-${b}`, `#${a}-${b}${n}`)).replace(/width="1000" height="1000"/, 'width="100%" height="100%"'); };
const T = {   /* per badge: the ground, the ink, the accent */
  a: { name: 'A \u00b7 365 green', bg: '#FFF8EC', ink: '#1D2A1C', head: '#2F5D2C', acc: '#2F5D2C', soft: '#5a6858', band: '#2F5D2C', bandInk: '#FFF8EC', qrD: '#1D2A1C', qrL: '#FFF8EC' },
  b: { name: 'B \u00b7 Sixfold dark', bg: '#1F2A25', ink: '#EDE7DC', head: '#E4703A', acc: '#E4703A', soft: '#a9b3a7', band: '#E4703A', bandInk: '#0E1512', qrD: '#0E1512', qrL: '#EDE7DC' },
  c: { name: 'C \u00b7 Light', bg: '#EDE7DC', ink: '#1D2A1C', head: '#2F5D2C', acc: '#E4703A', soft: '#5a6858', band: '#2F5D2C', bandInk: '#EDE7DC', qrD: '#1D2A1C', qrL: '#EDE7DC' },
};
const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=DM+Sans:wght@400;500;700&display=block" rel="stylesheet">';
const page = (w, h, body, t) => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>html,body{margin:0;padding:0}body{width:${w}px;height:${h}px;overflow:hidden;background:${t.bg};color:${t.ink};font-family:'DM Sans',sans-serif}*{box-sizing:border-box}.o{font-family:Outfit,sans-serif}</style></head><body>${body}</body></html>`;
/* each piece, in px at a scale (px per inch) */
/* "by Sixfold" (2026-10-16, Matthew: the name, not only the mark): under the badge on the card front, under the headline elsewhere */
const BY = (t, px) => `<div class="o" style="font-weight:700;font-size:${px}px;letter-spacing:.06em;color:${t.soft};white-space:nowrap">by <span style="color:${t.head}">SIXFOLD</span></div>`;
const card = (k, s) => { const t = T[k]; return page(3.5 * s, 2 * s, `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;padding:${0.12 * s}px;gap:${0.04 * s}px"><div style="width:${1.5 * s}px;height:${1.5 * s}px">${badge(k)}</div>${BY(t, 0.13 * s)}</div>`, t); };
const cardBack = (k, s) => { const t = T[k]; return page(3.5 * s, 2 * s, `<div style="display:flex;width:100%;height:100%;padding:${0.2 * s}px;gap:${0.16 * s}px;align-items:center">
  <div style="flex:1;display:flex;flex-direction:column;gap:${0.035 * s}px">
    <div class="o" style="font-weight:800;font-size:${0.2 * s}px;color:${t.head};line-height:1.05">Name Here</div>
    <div style="font-size:${0.095 * s}px;color:${t.soft};margin-bottom:${0.06 * s}px">Title</div>
    <div class="o" style="font-weight:700;font-size:${0.15 * s}px">${PHONE}</div>
    <div style="font-size:${0.1 * s}px">${EMAIL}</div>
    <div style="font-size:${0.1 * s}px;font-weight:700;color:${t.acc}">${SITE}</div>
    <div style="font-size:${0.082 * s}px;color:${t.soft};margin-top:${0.05 * s}px">${SERVICES}</div>
  </div>
  <div style="width:${0.95 * s}px;height:${0.95 * s}px;flex:none">${qrSvg(t.qrD, t.qrL).replace('<svg ', '<svg width="100%" height="100%" ')}</div>
</div>`, t); };
const yard = (k, s) => { const t = T[k]; return page(24 * s, 18 * s, `<div style="display:flex;width:100%;height:100%;align-items:center;padding:${1.1 * s}px;gap:${0.9 * s}px">
  <div style="width:${12.4 * s}px;height:${12.4 * s}px;flex:none">${badge(k)}</div>
  <div style="flex:1;display:flex;flex-direction:column;gap:${0.35 * s}px">
    <div class="o" style="font-weight:800;font-size:${1.45 * s}px;line-height:1.02;color:${t.head}">Aeration &amp;<br>Overseeding</div>
    ${BY(t, 0.62 * s)}
    <div style="font-size:${0.62 * s}px;color:${t.soft}">Core aeration, seed and fertilizer</div>
    <div style="margin-top:${0.25 * s}px;font-size:${0.55 * s}px;font-weight:700">Call or text</div>
    <div class="o" style="font-weight:800;font-size:${0.98 * s}px;line-height:1;color:${t.acc};white-space:nowrap">${PHONE}</div>
    <div style="display:flex;align-items:center;gap:${0.35 * s}px;margin-top:${0.3 * s}px"><div style="width:${2.6 * s}px;height:${2.6 * s}px;flex:none">${qrSvg(t.qrD, t.qrL).replace('<svg ', '<svg width="100%" height="100%" ')}</div><div class="o" style="font-weight:700;font-size:${0.7 * s}px">${SITE}</div></div>
  </div></div>`, t); };
const magnet = (k, s, w) => { const t = T[k]; const h = 12; return page(w * s, h * s, `<div style="display:flex;width:100%;height:100%;align-items:center;padding:${0.7 * s}px;gap:${0.6 * s}px">
  <div style="width:${(w > 20 ? 10.4 : 8.6) * s}px;height:${(w > 20 ? 10.4 : 8.6) * s}px;flex:none">${badge(k)}</div>
  <div style="flex:1;display:flex;flex-direction:column;gap:${0.2 * s}px">
    <div class="o" style="font-weight:800;font-size:${(w > 20 ? 1.25 : 0.95) * s}px;line-height:1.02;color:${t.head}">Aeration &amp;<br>Overseeding</div>
    ${BY(t, (w > 20 ? 0.6 : 0.46) * s)}
    <div class="o" style="font-weight:800;font-size:${(w > 20 ? 1.08 : 0.74) * s}px;line-height:1;color:${t.acc};margin-top:${0.25 * s}px;white-space:nowrap">${PHONE}</div>
    <div class="o" style="font-weight:700;font-size:${(w > 20 ? 0.7 : 0.55) * s}px">${SITE}</div>
    <div style="width:${(w > 20 ? 3.6 : 3) * s}px;height:${(w > 20 ? 3.6 : 3) * s}px;margin-top:${0.25 * s}px;flex:none">${qrSvg(t.qrD, t.qrL).replace('<svg ', '<svg width="100%" height="100%" ')}</div>
  </div></div>`, t); };   /* QR on the magnets (2026-10-16, Matthew): 3.6 in / 3 in reads from a few steps away */
const shots = [];
const render = (name, html, w, h) => {
  const f = join(OUT, name + '.html'), p = join(OUT, name + '.png');
  writeFileSync(f, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, `--window-size=${Math.round(w)},${Math.round(h)}`, '--virtual-time-budget=6000', `--screenshot=${p}`, 'file:///' + f.replace(/\\/g, '/')], { stdio: 'ignore' });
  shots.push(name);
};
for (const k of ['a', 'b', 'c']) {
  render(`card-front-${k}`, card(k, 300), 1050, 600);
  render(`card-back-${k}`, cardBack(k, 300), 1050, 600);
  render(`yard-sign-${k}`, yard(k, 100), 2400, 1800);
  render(`magnet-truck-24x12-${k}`, magnet(k, 100, 24), 2400, 1200);
  render(`magnet-tesla-18x12-${k}`, magnet(k, 100, 18), 1800, 1200);
}
/* one page with all of it */
const col = (k) => `<section><h2>${T[k].name}</h2>
  <div class="row"><figure><img src="card-front-${k}.png" class="card"><figcaption>Business card, front (3.5 \u00d7 2 in)</figcaption></figure><figure><img src="card-back-${k}.png" class="card"><figcaption>Business card, back</figcaption></figure></div>
  <figure><img src="yard-sign-${k}.png"><figcaption>Yard sign (24 \u00d7 18 in)</figcaption></figure>
  <figure><img src="magnet-truck-24x12-${k}.png"><figcaption>Truck magnet: Tacoma and Hummer EV (24 \u00d7 12 in)</figcaption></figure>
  <figure><img src="magnet-tesla-18x12-${k}.png" class="tesla"><figcaption>Car magnet: Tesla (18 \u00d7 12 in)</figcaption></figure></section>`;
writeFileSync(join(OUT, 'print-mockups.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>365 print mockups</title>${FONTS}
<style>body{margin:0;background:#ece7dd;color:#1d2a1c;font:15px/1.5 'DM Sans',sans-serif}.wrap{max-width:1500px;margin:0 auto;padding:24px 16px 60px}h1{font:800 28px Outfit,sans-serif;margin:0 0 6px}p.sub{margin:0 0 8px;color:#5a6858;max-width:900px}
.note{background:#fff4e5;border:1px solid #f3c9ad;border-radius:12px;padding:12px 14px;margin:12px 0 22px;max-width:900px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}@media (max-width:1000px){.grid{grid-template-columns:1fr}}
section{background:#fff;border-radius:16px;padding:14px;display:grid;gap:14px;align-content:start}h2{font:800 20px Outfit,sans-serif;margin:0}figure{margin:0}img{width:100%;display:block;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.15)}img.tesla{width:75%}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}figcaption{font-size:13px;color:#5a6858;margin-top:5px}</style></head><body><div class="wrap">
<h1>365 print mockups: cards, yard signs, magnets</h1>
<p class="sub">Each badge (A, B, C) on every piece, so you can compare them side by side. Phone ${PHONE}, website ${SITE}, email ${EMAIL}; the QR code opens the website (checked: it reads back). "Name Here" and "Title" on the card back are placeholders: tell me whose cards these are.</p>
<div class="note"><b>Before ordering magnets:</b> a magnet only holds on steel. Hold a fridge magnet against the spot on each vehicle first (front doors usually). Many newer vehicles, EVs especially, use aluminium or plastic panels in places, and a magnet sign will not stay on those; that would mean a vinyl decal there instead. These are drafts at true proportions; print-ready files with bleed come once you pick.</div>
<div class="grid">${col('a')}${col('b')}${col('c')}</div></div></body></html>`);
console.log('rendered', shots.length, 'pieces and print/print-mockups.html');
