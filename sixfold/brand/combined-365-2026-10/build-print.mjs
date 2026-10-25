/* Print mockups for the three Sixfold x 365 badges (2026-10-15, Matthew: "business cards, yard signs, and car magnets made with the new
   logo ... So i can see how all 3 look with the 3 different branding. The car magnets will go on 2 trucks, the tacoma, one is a ev hummer
   truck thing. And then also on my tesla."). For each badge A/B/C: business card front + back (3.5 x 2 in), yard sign (24 x 18 in),
   truck magnet (24 x 12 in), car magnet for the Tesla (18 x 12 in). Rendered at 100 px per inch (cards 300) for review, plus one page with
   everything. Print-ready files with bleed come after a pick.
   Needs: QR_DEPS = a node_modules with qrcode, jsqr, pngjs.   node build-print.mjs */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
/* throwaway Chrome profiles are removed when the script ends (2026-10-25: 10,717 were left in Temp, about 170 GB) */
const cdpDirs = []; const cdpDir = () => { const d = mkdtempSync(join(tmpdir(), 'cdp-')); cdpDirs.push(d); return d; };
process.on('exit', () => { for (const d of cdpDirs) try { rmSync(d, { recursive: true, force: true, maxRetries: 50, retryDelay: 200 }); } catch {} });
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'print');
mkdirSync(OUT, { recursive: true });
const req = createRequire(join(process.env.QR_DEPS || '', 'x.js'));
const QR = req('qrcode'), jsQR = req('jsqr'), { PNG } = req('pngjs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'https://365aeration.com', PHONE = '(720) 830-4553', SITE = '365aeration.com', EMAIL = 'contact@365aeration.com';
const SERVICES = 'Core aeration \u00b7 Overseeding \u00b7 Fertilizer';
/* the QR, checked: a PNG of it must read back as the address */
/* 2026-10-16 (Matthew): the Ridge mark (no wording, roots kept) in the middle of every QR. Error correction H (~30% of the code can be
   lost); the mark's pad covers 9 x 9 modules, about a tenth of the code. Every finished piece is decoded again below. */
const bsrc = readFileSync(join(HERE, 'build.mjs'), 'utf8');
const ridge = eval(bsrc.slice(bsrc.indexOf('const ridge = '), bsrc.indexOf('`;', bsrc.indexOf('const ridge = ')) + 1).replace('const ridge = ', '(') + ')');
const withMark = (svg, light) => {
  const vb = +svg.match(/viewBox="0 0 (\d+) \d+"/)[1], pad = 9, x0 = (vb - pad) / 2, sc = (pad - 1.4) / 100;
  return svg.replace('</svg>', `<g shape-rendering="geometricPrecision"><rect x="${x0}" y="${x0}" width="${pad}" height="${pad}" rx="1.2" fill="${light}"/>`
    + `<g transform="translate(${x0 + (pad - 94 * sc) / 2 - 4 * sc} ${x0 + (pad - 99 * sc) / 2 - 14 * sc}) scale(${sc})">${ridge('#E4703A', '#4C7A3F')}</g></g></svg>`);
};
const QRS = {};
/* one address per piece (2026-10-16): each forwards from 365aeration.com/<piece>/ (api/go.php on the 365 site, counted), so where a
   printed code leads can change later without reprinting. /sign is taken (the agreement page), hence /yard. */
const GO = { card: URL + '/card/', yard: URL + '/yard/', truck: URL + '/truck/', car: URL + '/car/' };
for (const u of Object.values(GO)) for (const [d, l] of [['#1D2A1C', '#FFF8EC'], ['#0E1512', '#EDE7DC'], ['#1D2A1C', '#EDE7DC']]) QRS[u + d + l] = withMark(await QR.toString(u, { type: 'svg', errorCorrectionLevel: 'H', margin: 4, color: { dark: d, light: l } }), l);
const qrSvg = (dark, light, url) => QRS[url + dark + light];
const pngPath = join(OUT, 'qr-check.png');
await QR.toFile(pngPath, GO.yard, { errorCorrectionLevel: 'H', margin: 4, width: 600 });
const png = PNG.sync.read(readFileSync(pngPath)); const dec = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
if (!dec || dec.data !== GO.yard) throw new Error('QR does not read back: ' + (dec && dec.data));
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
/* the Sixfold name is inside the badge (build.mjs). "Scan for a quote" beside every code (2026-10-16): true today (the homepage quote
   request form) and after the link pages, whose top button is the quote. */
const SCAN = (t, px) => `<div class="o" style="font-weight:800;font-size:${px}px;line-height:1.05;color:${t.acc}">Scan for<br>a quote</div>`;
const card = (k, s) => { const t = T[k]; return page(3.5 * s, 2 * s, `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;padding:${0.12 * s}px;gap:${0.04 * s}px"><div style="width:${1.62 * s}px;height:${1.62 * s}px">${badge(k)}</div></div>`, t); };
const cardBack = (k, s) => { const t = T[k]; return page(3.5 * s, 2 * s, `<div style="display:flex;width:100%;height:100%;padding:${0.2 * s}px;gap:${0.16 * s}px;align-items:center">
  <div style="flex:1;display:flex;flex-direction:column;gap:${0.035 * s}px">
    <div class="o" style="font-weight:800;font-size:${0.2 * s}px;color:${t.head};line-height:1.05">Name Here</div>
    <div style="font-size:${0.095 * s}px;color:${t.soft};margin-bottom:${0.06 * s}px">Title</div>
    <div class="o" style="font-weight:700;font-size:${0.15 * s}px">${PHONE}</div>
    <div style="font-size:${0.1 * s}px">${EMAIL}</div>
    <div style="font-size:${0.1 * s}px;font-weight:700;color:${t.acc}">${SITE}</div>
    <div style="font-size:${0.082 * s}px;color:${t.soft};margin-top:${0.05 * s}px">${SERVICES}</div>
  </div>
  <div style="display:flex;flex-direction:column;align-items:center;gap:${0.03 * s}px;flex:none"><div style="width:${0.95 * s}px;height:${0.95 * s}px">${qrSvg(t.qrD, t.qrL, GO.card).replace('<svg ', '<svg width="100%" height="100%" ')}</div><div class="o" style="font-weight:700;font-size:${0.075 * s}px;color:${t.acc};text-align:center;line-height:1.15">Scan for more<br>information</div></div>
</div>`, t); };
/* o: the band, headline and line under it (2026-10-18: a second sign for while the crew is working there) */
const yard = (k, s, tt, o = {}) => { const t = tt || T[k]; o = { band: 'Another lawn aerated by 365', head: 'Aeration &amp;<br>Overseeding', sub: 'Core aeration, seed and fertilizer', ...o }; return page(24 * s, 18 * s, `<div style="display:flex;width:100%;height:100%;align-items:center;padding:${1.1 * s}px;gap:${0.9 * s}px">
  <div style="width:${12.4 * s}px;height:${12.4 * s}px;flex:none">${badge(k)}</div>
  <div style="flex:1;display:flex;flex-direction:column;gap:${0.35 * s}px">
    <div class="o" style="align-self:flex-start;font-weight:800;font-size:${0.6 * s}px;line-height:1;padding:${0.18 * s}px ${0.32 * s}px;border-radius:${0.14 * s}px;background:${t.band};color:${t.bandInk};white-space:nowrap">${o.band}</div>   <!-- 2026-10-18, Matthew: say why the sign is in this yard -->
    <div class="o" style="font-weight:800;font-size:${(o.hs || 1.45) * s}px;line-height:1.02;color:${t.head};white-space:nowrap">${o.head}</div>
    <div style="font-size:${0.62 * s}px;color:${t.soft}">${o.sub}</div>
    <div style="margin-top:${0.25 * s}px;font-size:${0.55 * s}px;font-weight:700">Call or text</div>
    <div class="o" style="font-weight:800;font-size:${0.98 * s}px;line-height:1;color:${t.acc};white-space:nowrap">${PHONE}</div>
    <div style="display:flex;align-items:center;gap:${0.35 * s}px;margin-top:${0.3 * s}px"><div style="width:${4 * s}px;height:${4 * s}px;flex:none">${qrSvg(t.qrD, t.qrL, GO.yard).replace('<svg ', '<svg width="100%" height="100%" ')}</div><div style="display:flex;flex-direction:column;gap:${0.25 * s}px">${SCAN(t, 0.62 * s)}<div class="o" style="font-weight:700;font-size:${0.45 * s}px;white-space:nowrap">${SITE}</div></div></div>
  </div></div>`, t); };
const magnet = (k, s, w) => { const t = T[k]; const h = 12; return page(w * s, h * s, `<div style="display:flex;width:100%;height:100%;align-items:center;padding:${0.7 * s}px;gap:${0.6 * s}px">
  <div style="width:${(w > 20 ? 10.4 : 8.6) * s}px;height:${(w > 20 ? 10.4 : 8.6) * s}px;flex:none">${badge(k)}</div>
  <div style="flex:1;display:flex;flex-direction:column;gap:${0.2 * s}px">
    <div class="o" style="font-weight:800;font-size:${(w > 20 ? 1.25 : 0.95) * s}px;line-height:1.02;color:${t.head}">Aeration &amp;<br>Overseeding</div>
    <div class="o" style="font-weight:800;font-size:${(w > 20 ? 1.08 : 0.74) * s}px;line-height:1;color:${t.acc};margin-top:${0.25 * s}px;white-space:nowrap">${PHONE}</div>
    <div class="o" style="font-weight:700;font-size:${(w > 20 ? 0.7 : 0.55) * s}px">${SITE}</div>
    <div style="display:flex;align-items:center;gap:${0.3 * s}px;margin-top:${0.25 * s}px"><div style="width:${(w > 20 ? 3.6 : 3) * s}px;height:${(w > 20 ? 3.6 : 3) * s}px;flex:none">${qrSvg(t.qrD, t.qrL, w > 20 ? GO.truck : GO.car).replace('<svg ', '<svg width="100%" height="100%" ')}</div>${SCAN(t, (w > 20 ? 0.6 : 0.48) * s)}</div>
  </div></div>`, t); };   /* QR on the magnets (2026-10-16, Matthew): 3.6 in / 3 in reads from a few steps away */
const shots = [];
const render = (name, html, w, h) => {
  const f = join(OUT, name + '.html'), p = join(OUT, name + '.png');
  writeFileSync(f, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${cdpDir()}`, `--window-size=${Math.round(w)},${Math.round(h)}`, '--virtual-time-budget=6000', `--screenshot=${p}`, 'file:///' + f.replace(/\\/g, '/')], { stdio: 'ignore' });
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

/* PRINT-READY business cards for FedEx (2026-10-16, Matthew). Same format as the Sixfold cards that printed: a two-page PDF (front,
   back), 3.75 x 2.25 in = the 3.5 x 2 in card plus 0.125 in bleed all round; text kept 0.1875 in inside the trim. Brandon and Brad on
   B (Sixfold dark), Matthew on C (light), his choice. Root lines thickened 1.6x on the card badge only: at 1.62 in the finest root is
   ~0.09 mm, under the ~0.15 mm a digital press holds; x1.6 brings it to ~0.15 mm. Reversed type kept at 6.5 pt or more. */
const PEOPLE = [
  { file: 'Brandon-Long', k: 'b', name: 'Brandon Long', title: 'CEO', phone: '(303) 915-1045', email: 'B.Long@365Aeration.com' },
  { file: 'Brad-McPherson', k: 'b', name: 'Brad McPherson', title: '', phone: '(303) 945-1514', email: 'B.McPherson@365Aeration.com' },
  { file: 'Matthew-Sharpe', k: 'c', name: 'Matthew Sharpe', title: 'Chief Technology Officer', phone: '(303) 596-9515', email: 'M.Sharpe@SixfoldColorado.com' },
];
const PR = join(HERE, 'print-ready'); mkdirSync(PR, { recursive: true });
const printBadge = (k) => badge(k).replace(/stroke-width="([\d.]+)"/g, (m, v) => (+v < 2 ? `stroke-width="${(+v * 1.6).toFixed(2)}"` : m));
for (const p of PEOPLE) {
  const t = T[p.k], q = qrSvg(t.qrD, t.qrL, GO.card).replace('<svg ', '<svg width="100%" height="100%" ');
  const html = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
@page { size: 3.75in 2.25in; margin: 0; }
html, body { margin: 0; padding: 0; } * { box-sizing: border-box; }
body { font-family: 'DM Sans', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.o { font-family: Outfit, sans-serif; }
.page { width: 3.75in; height: 2.25in; background: ${t.bg}; color: ${t.ink}; position: relative; overflow: hidden; page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
.safe { position: absolute; inset: 0.3125in; }   /* 3/16 in inside the trim, not 1/8 (2026-10-18, Matthew: move it in slightly to be safe at FedEx) */
</style></head><body>
<div class="page"><div class="safe" style="display:flex;align-items:center;justify-content:center"><div style="width:1.62in;height:1.62in">${printBadge(p.k)}</div></div></div>
<div class="page"><div class="safe" style="display:flex;align-items:center;gap:0.16in">
  <div style="flex:1;display:flex;flex-direction:column;gap:0.035in;min-width:0">
    <div class="o" style="font-weight:800;font-size:0.2in;color:${t.head};line-height:1.05;white-space:nowrap">${p.name}</div>
    ${p.title ? `<div style="font-size:0.09in;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${t.soft};margin-bottom:0.05in">${p.title}</div>` : '<div style="height:0.04in"></div>'}
    <div class="o" style="font-weight:700;font-size:0.15in;white-space:nowrap">${p.phone}</div>
    <div style="font-size:0.1in;white-space:nowrap">${p.email}</div>
    <div style="font-size:0.1in;font-weight:700;color:${t.acc}">${SITE}</div>
    <div style="font-size:0.09in;color:${t.soft};margin-top:0.04in">${SERVICES}</div>
  </div>
  <div style="display:flex;flex-direction:column;align-items:center;gap:0.03in;flex:none"><div style="width:0.95in;height:0.95in">${q}</div><div class="o" style="font-weight:700;font-size:0.09in;color:${t.acc};text-align:center;line-height:1.15">Scan for more<br>information</div></div>
</div></div>
</body></html>`;
  const f = join(PR, `365-Card-${p.file}.html`), pdf = join(PR, `365-Card-${p.file}.pdf`);
  writeFileSync(f, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${cdpDir()}`, '--virtual-time-budget=8000', `--print-to-pdf=${pdf}`, 'file:///' + f.split('\\').join('/')], { stdio: 'ignore' });
}
console.log('print-ready cards:', PEOPLE.map((p) => `365-Card-${p.file}.pdf`).join(', '));

/* PRINT-READY yard sign (2026-10-16, Matthew picked C; the phone number in dark green, not orange: orange on bone measured 2.6:1,
   too faint from the sidewalk; green is 6.3:1). 24 x 18 in plus 0.125 in bleed all round = 24.25 x 18.25 in; the sign laid out at 96 px
   per inch so the PDF is true size. The same file serves both faces of a two-sided sign. */
/* Two signs (2026-10-18): C, left in the yard after the job ("Another lawn aerated by 365"), and Working, out while the crew is there
   (Matthew: "this property is currently being aerated by 365 or something along those lines"). Same layout, colours and QR. */
for (const [file, o] of [['365-Yard-Sign-C', {}],
  ['365-Yard-Sign-Working', { band: 'Aeration in progress', head: 'We\u2019re aerating<br>this lawn today', hs: 1.0, sub: 'Want yours done next? Core aeration, seed and fertilizer' }]]) {
  const tC = { ...T.c, acc: T.c.head };
  let html = yard('c', 96, tC, o);
  html = html.replace('<style>', '<style>@page{size:24.25in 18.25in;margin:0}html{background:' + tC.bg + ';-webkit-print-color-adjust:exact;print-color-adjust:exact}');
  html = html.replace('html,body{margin:0;padding:0}', 'html,body{padding:0}html{margin:0}body{margin:0.125in}');
  const f = join(PR, file + '.html'), pdf = join(PR, file + '.pdf');
  writeFileSync(f, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${cdpDir()}`, '--virtual-time-budget=8000', `--print-to-pdf=${pdf}`, 'file:///' + f.split('\\').join('/')], { stdio: 'ignore' });
  console.log('print-ready yard sign: ' + file + '.pdf');
  /* exactly 24 x 18 in, no bleed (2026-10-18: FedEx's sign tool fitted the 24.25 x 18.25 file inside its 24 x 18 and filled the gaps white) */
  const fx = html.replace('@page{size:24.25in 18.25in;margin:0}', '@page{size:24in 18in;margin:0}').replace('body{margin:0.125in}', 'body{margin:0}');
  const f2 = join(PR, file + '-24x18.html'), pdf2 = join(PR, file + '-24x18.pdf');
  writeFileSync(f2, fx);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${cdpDir()}`, '--virtual-time-budget=8000', `--print-to-pdf=${pdf2}`, 'file:///' + f2.split('\\').join('/')], { stdio: 'ignore' });
  console.log('print-ready yard sign: ' + file + '-24x18.pdf');
  /* the 12 x 18 in sign, FedEx's smaller size (2026-10-18, Matthew): the same layout at two thirds (16 x 12 in), centred on an 18 x 12 in
     page with the ground colour running edge to edge */
  let h12 = yard('c', 64, tC, o);
  h12 = h12.replace('<style>', '<style>@page{size:18in 12in;margin:0}html{background:' + tC.bg + ';-webkit-print-color-adjust:exact;print-color-adjust:exact}');
  h12 = h12.replace('html,body{margin:0;padding:0}', 'html,body{padding:0}html{margin:0}body{margin:0 auto}');
  const f3 = join(PR, file + '-18x12.html'), pdf3 = join(PR, file + '-18x12.pdf');
  writeFileSync(f3, h12);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${cdpDir()}`, '--virtual-time-budget=8000', `--print-to-pdf=${pdf3}`, 'file:///' + f3.split('\\').join('/')], { stdio: 'ignore' });
  console.log('print-ready yard sign: ' + file + '-18x12.pdf');
}
