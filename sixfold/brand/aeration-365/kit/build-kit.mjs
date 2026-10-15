/* 365 Aeration & Seeding: the social and Square brand kit (2026-10-14).
   One set of artwork, rendered by headless Chrome at each platform's exact upload size, the same method as Surge's social kit.
   Run from this folder:  node build-kit.mjs   ->  out/ (PNGs) + out/MANIFEST.json + out/review.html
   Colours are sampled from the logo files (../365-logo-icon-transparent.png). Contact: (720) 830-4553 (Matthew, 2026-10-14). */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'out'), TMP = join(HERE, '.tmp');
const LOGO = (f) => pathToFileURL(join(HERE, '..', f)).href;
const C = { green: '#2F5D2C', greenD: '#21451F', leaf: '#4C9A3F', sky: '#CDE9F6', soil: '#8A5A3B', plug: '#6E4329', cream: '#FFF8EC', sun: '#F2C14E', ink: '#1D2A1C' };
const PHONE = '(720) 830-4553', SITE = '365aeration.com', NAME = '365 Aeration & Seeding';
const BADGE = LOGO('365-logo-badge-transparent.png'), ICON = LOGO('365-logo-icon-transparent.png'), HORIZ = LOGO('365-logo-horizontal-transparent.png');
const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=DM+Sans:wght@500;700&display=block" rel="stylesheet">';
const BASE = `*{box-sizing:border-box;margin:0}body{overflow:hidden;font-family:'DM Sans',sans-serif;color:${C.ink}}.o{font-family:Outfit,sans-serif}`;

/* the scene: sky, a strip of grass and soil with plugs pulled; content sits in the sky */
function ground(w, h, frac) {
  const gh = Math.round(h * frac), pw = Math.max(14, Math.round(gh * 0.34)), ph = Math.round(pw * 1.75);
  const xs = w > h * 2.2 ? [0.08, 0.2, 0.8, 0.92] : [0.12, 0.3, 0.7, 0.88];
  return `<div style="position:absolute;left:0;right:0;bottom:0;height:${gh}px;background:${C.soil}">
    <div style="position:absolute;left:-2%;right:-2%;top:-${Math.round(gh * 0.12)}px;height:${Math.round(gh * 0.2)}px;background:${C.leaf};border-radius:50% 50% 0 0/100% 100% 0 0"></div>
    ${xs.map((x) => `<i style="position:absolute;left:${x * 100}%;top:${Math.round(gh * 0.28)}px;width:${pw}px;height:${ph}px;border-radius:${pw / 2}px;background:${C.plug}"></i>`).join('')}</div>`;
}
function banner({ w, h, mode = 'full', safe = null, groundFrac = 0.2 }) {
  const box = safe || { w, h: Math.round(h * (1 - groundFrac)) };
  const s = Math.min(box.w / 1400, box.h / 420);   /* one scale for the type, from the space the words have */
  const head = Math.round((mode === 'slim' ? 0 : mode === 'compact' ? 78 : 92) * s), sub = Math.round(30 * s), pill = Math.round(30 * s);
  const inner = mode === 'slim'
    ? `<img src="${HORIZ}" style="height:${Math.round(h * 0.62)}px"><div class="o" style="font-weight:700;font-size:${Math.round(h * 0.17)}px;color:${C.greenD};margin-left:${Math.round(h * 0.25)}px;white-space:nowrap">Call or text ${PHONE}<div style="font:500 ${Math.round(h * 0.11)}px 'DM Sans';color:${C.ink};margin-top:4px">${SITE}</div></div>`
    : `<div style="text-align:center"><div class="o" style="font-weight:800;font-size:${head}px;line-height:1.02;color:${C.greenD};letter-spacing:-.01em">Pull a plug. Grow a lawn.</div>
       ${mode === 'full' ? `<div style="font-weight:500;font-size:${sub}px;margin-top:${Math.round(14 * s)}px;color:#2d3b2c">Core aeration &amp; overseeding · Denver metro</div>` : ''}
       <div class="o" style="display:inline-block;margin-top:${Math.round(22 * s)}px;background:${C.green};color:#fff;font-weight:700;font-size:${pill}px;padding:${Math.round(14 * s)}px ${Math.round(36 * s)}px;border-radius:999px">Get a quote · ${PHONE}</div>
       <div style="font-weight:700;font-size:${Math.round(22 * s)}px;margin-top:${Math.round(12 * s)}px;color:${C.greenD}">${SITE}</div></div>`;
  return `<div style="position:relative;width:${w}px;height:${h}px;background:${C.sky};overflow:hidden">
    <div style="position:absolute;left:0;right:0;top:0;bottom:${mode === 'slim' ? 0 : Math.round(h * groundFrac)}px;display:flex;align-items:center;justify-content:center">${inner}</div>
    ${mode === 'slim' ? '' : ground(w, h, groundFrac)}</div>`;
}
const avatar = (w, bg = C.cream, img = BADGE, pad = 0.07) => `<div style="width:${w}px;height:${w}px;background:${bg};display:flex;align-items:center;justify-content:center"><img src="${img}" style="width:${Math.round(w * (1 - 2 * pad))}px"></div>`;
/* Instagram/Facebook posts: a headline card and three sourced tips */
function post({ w, h, kicker, title, body, cta = true, tip = null }) {
  return `<div style="position:relative;width:${w}px;height:${h}px;background:${C.sky};overflow:hidden">
    <img src="${BADGE}" style="position:absolute;top:70px;left:70px;width:150px">
    ${tip ? `<div class="o" style="position:absolute;top:96px;right:70px;width:96px;height:96px;border-radius:50%;background:${C.green};color:#fff;font-weight:800;font-size:52px;display:flex;align-items:center;justify-content:center">${tip}</div>` : ''}
    <div style="position:absolute;left:80px;right:80px;top:300px">
      <div style="font-weight:700;font-size:34px;letter-spacing:.12em;text-transform:uppercase;color:${C.green}">${kicker}</div>
      <div class="o" style="font-weight:800;font-size:96px;line-height:1.02;color:${C.greenD};margin-top:22px">${title}</div>
      <div style="font-weight:500;font-size:40px;line-height:1.4;color:#2d3b2c;margin-top:30px">${body}</div>
    </div>
    ${cta ? `<div style="position:absolute;left:80px;right:80px;bottom:${Math.round(h * 0.17) + 50}px;display:flex;align-items:center;gap:22px">
      <div class="o" style="background:${C.green};color:#fff;font-weight:700;font-size:40px;padding:18px 38px;border-radius:999px">${PHONE}</div>
      <div style="font-weight:700;font-size:36px;color:${C.greenD}">${SITE}</div></div>` : ''}
    ${ground(w, h, 0.17)}</div>`;
}
function story({ w, h }) {
  return `<div style="position:relative;width:${w}px;height:${h}px;background:${C.sky};overflow:hidden;text-align:center">
    <img src="${BADGE}" style="position:absolute;top:250px;left:50%;transform:translateX(-50%);width:420px">
    <div style="position:absolute;left:80px;right:80px;top:760px">
      <div class="o" style="font-weight:800;font-size:118px;line-height:1.02;color:${C.greenD}">Pull a plug.<br>Grow a lawn.</div>
      <div style="font-weight:500;font-size:46px;margin-top:30px;color:#2d3b2c">Core aeration &amp; overseeding<br>across the Denver metro</div>
      <div class="o" style="display:inline-block;margin-top:56px;background:${C.green};color:#fff;font-weight:700;font-size:50px;padding:24px 54px;border-radius:999px">Get a quote</div>
      <div class="o" style="font-weight:700;font-size:54px;margin-top:34px;color:${C.greenD}">${PHONE}</div>
      <div style="font-weight:700;font-size:40px;margin-top:10px;color:${C.greenD}">${SITE}</div>
    </div>${ground(w, h, 0.14)}</div>`;
}
const highlight = (label, w = 1080, h = 1920) => `<div style="width:${w}px;height:${h}px;background:${C.green};display:flex;align-items:center;justify-content:center">
  <div style="width:620px;height:620px;border-radius:50%;background:${C.cream};display:flex;flex-direction:column;align-items:center;justify-content:center">
  <img src="${ICON}" style="width:330px"><div class="o" style="font-weight:800;font-size:64px;color:${C.greenD};margin-top:10px">${label}</div></div></div>`;
const wordmarkPrint = (w, h) => `<div style="width:${w}px;height:${h}px;background:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#000">
  <div class="o" style="font-weight:800;font-size:${Math.round(Math.min(h * 0.3, w / 6.1))}px;line-height:1;white-space:nowrap">365 Aeration</div>
  <div style="font-weight:700;font-size:${Math.round(h * 0.12)}px;letter-spacing:.24em;margin-top:${Math.round(h * 0.07)}px;white-space:nowrap">&amp; SEEDING</div></div>`;
const wideLogo = (w, h, bg) => `<div style="width:${w}px;height:${h}px;background:${bg};display:flex;align-items:center;justify-content:center"><img src="${HORIZ}" style="width:${Math.round(w * 0.86)}px;transform:translateX(5.5%)"></div>`;   /* the source file has empty space on its right */
function display(w, h) {
  return `<div style="position:relative;width:${w}px;height:${h}px;background:${C.sky};overflow:hidden;text-align:center">
    <div style="position:absolute;left:0;right:0;top:0;bottom:${Math.round(h * 0.2)}px;display:flex;flex-direction:column;align-items:center;justify-content:center">
      <img src="${BADGE}" style="width:${Math.round(h * 0.36)}px">
      <div class="o" style="font-weight:800;font-size:${Math.round(h * 0.058)}px;color:${C.greenD};margin-top:${Math.round(h * 0.03)}px">Thanks for choosing ${NAME}</div>
      <div style="font-weight:700;font-size:${Math.round(h * 0.035)}px;color:${C.greenD};margin-top:${Math.round(h * 0.015)}px">${PHONE} · ${SITE}</div></div>
    ${ground(w, h, 0.2)}</div>`;
}

const A = [];
const add = (file, w, h, html, where, how, opts = {}) => A.push({ file, w, h, html, where, how, ...opts });
/* profile pictures: one design, each platform's size */
add('social/profile-1080.png', 1080, 1080, avatar(1080), 'Facebook, Instagram, TikTok, Nextdoor, Google Business Profile', 'Profile picture / logo. Shows as a circle; the badge is sized to sit inside it.');
add('social/profile-x-400.png', 400, 400, avatar(400), 'X', 'Edit profile › profile photo.');
add('social/profile-youtube-800.png', 800, 800, avatar(800), 'YouTube', 'Customise channel › Branding › Picture.');
add('social/profile-linkedin-400.png', 400, 400, avatar(400, '#ffffff'), 'LinkedIn page', 'Edit page › Logo.');
/* banners */
add('social/facebook-cover-1702x630.png', 1702, 630, banner({ w: 1702, h: 630 }), 'Facebook page', 'Edit cover photo › Upload. Phones crop the sides; the words sit in the middle so they stay.');
add('social/x-header-1500x500.png', 1500, 500, banner({ w: 1500, h: 500, mode: 'compact' }), 'X', 'Edit profile › header photo (3:1). The profile photo covers the lower left; nothing important is there.');
add('social/linkedin-cover-1128x191.png', 1128, 191, banner({ w: 1128, h: 191, mode: 'slim' }), 'LinkedIn page', 'Edit page › Cover image (about 4:1).');
add('social/youtube-banner-2560x1440.png', 2560, 1440, banner({ w: 2560, h: 1440, safe: { w: 1546, h: 423 }, groundFrac: 0.26 }), 'YouTube', 'Customise channel › Branding › Banner. Only the middle 1546×423 shows on every device; the words are inside it.');
add('social/nextdoor-cover-1440x400.png', 1440, 400, banner({ w: 1440, h: 400, mode: 'compact' }), 'Nextdoor business page', 'Page › Edit › Cover photo.');
add('social/google-business-cover-1024x576.png', 1024, 576, banner({ w: 1024, h: 576 }), 'Google Business Profile', 'Photos › Cover photo.');
add('social/share-image-1200x630.png', 1200, 630, banner({ w: 1200, h: 630 }), 'Links shared anywhere (365aeration.com)', 'Used by the website as its share picture.');
/* posts, story, highlights */
add('social/post-intro-1080x1350.png', 1080, 1350, post({ w: 1080, h: 1350, kicker: 'Denver metro', title: 'Pull a plug.<br>Grow a lawn.', body: 'Core aeration and overseeding. Ask for a quote online, or call or text us.' }), 'Instagram / Facebook post', 'Feed post (4:5).');
add('social/post-tip1-water-1080x1350.png', 1080, 1350, post({ w: 1080, h: 1350, tip: 1, kicker: 'Good to know', title: 'Water if you can', body: 'A little water a day or two before helps the machine go deeper. If you can\u2019t, no problem: we can run your sprinklers for a few minutes when we arrive.' }), 'Instagram / Facebook post', 'Feed post (4:5). Source: CSU Extension PlantTalk 1505.');
add('social/post-tip2-plugs-1080x1350.png', 1080, 1350, post({ w: 1080, h: 1350, tip: 2, kicker: 'Good to know', title: 'The plugs stay on the lawn', body: 'They look a little messy for a week or two, then break down back into the grass. That\u2019s part of the benefit.' }), 'Instagram / Facebook post', 'Feed post (4:5). Source: UMass Amherst Extension.');
add('social/post-tip3-season-1080x1350.png', 1080, 1350, post({ w: 1080, h: 1350, tip: 3, kicker: 'Good to know', title: 'Spring and fall work best', body: 'Any time the ground isn\u2019t frozen, but not when it\u2019s hot and dry.' }), 'Instagram / Facebook post', 'Feed post (4:5). Source: CSU Extension PlantTalk 1505.');
add('social/story-quote-1080x1920.png', 1080, 1920, story({ w: 1080, h: 1920 }), 'Instagram / Facebook story', 'Story (9:16). Add a link sticker to 365aeration.com when posting.');
for (const l of ['Quotes', 'Tips', 'About']) add(`social/highlight-${l.toLowerCase()}-1080x1920.png`, 1080, 1920, highlight(l), 'Instagram story highlight cover', 'Edit highlight › Edit cover › pick from camera roll.');
/* Square (Dashboard › Settings › Account & Settings › My business › About › Branding) */
add('square/square-logo-small-400x400.png', 400, 400, avatar(400, '#ffffff', BADGE, 0.04), 'Square: small logo', 'Branding set › Small logo. Square asks for 400×400.');
add('square/square-logo-full-1280x648.png', 1280, 648, wideLogo(1280, 648, '#ffffff'), 'Square: full logo', 'Branding set › Full logo. Square asks for at least 1280×648.');
add('square/square-logo-full-transparent-1280x648.png', 1280, 648, wideLogo(1280, 648, 'transparent'), 'Square: full logo (clear background)', 'Use instead of the white one if a page behind it is coloured.', { transparent: true });
add('square/square-logo-print-400x200.png', 400, 200, wordmarkPrint(400, 200), 'Square: printed receipt logo', 'Printed receipts are black only, so this is black type on white. Square asks for at least 400×200.');
add('square/square-logo-print-800x400.png', 800, 400, wordmarkPrint(800, 400), 'Square: printed receipt logo (sharper)', 'The same at twice the size, if Square accepts it.');
add('square/square-customer-display-2560x1600.png', 2560, 1600, display(2560, 1600), 'Square Register: customer display', 'Square recommends 2560×1600 for the customer-facing screen.');

mkdirSync(join(OUT, 'social'), { recursive: true }); mkdirSync(join(OUT, 'square'), { recursive: true }); mkdirSync(TMP, { recursive: true });
const PORT = 9390;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'kit-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
try {
  let tg; for (let k = 0; k < 60 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
  ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  for (const a of A) {
    const f = join(TMP, 'a.html');
    writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}html,body{width:${a.w}px;height:${a.h}px;background:${a.transparent ? 'transparent' : '#fff'}}</style></head><body>${a.html}</body></html>`);
    await send('Emulation.setDeviceMetricsOverride', { width: a.w, height: a.h, deviceScaleFactor: 1, mobile: false });
    if (a.transparent) await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    await send('Page.navigate', { url: pathToFileURL(f).href + '?' + id });
    for (let k = 0; k < 50; k++) { if (await js(`document.readyState==='complete'&&document.fonts.status==='loaded'&&[...document.images].every(i=>i.complete&&i.naturalWidth>0)`)) break; await sleep(150); }
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: a.w, height: a.h, scale: 1 } });
    writeFileSync(join(OUT, a.file), Buffer.from(shot.data, 'base64'));
    if (a.transparent) await send('Emulation.setDefaultBackgroundColorOverride', {});
    console.log('  ' + a.file);
  }
} finally { try { ws && ws.close(); } catch {} chrome.kill(); rmSync(TMP, { recursive: true, force: true }); }
writeFileSync(join(OUT, 'MANIFEST.json'), JSON.stringify(A.map(({ html, ...r }) => r), null, 2));
writeFileSync(join(OUT, 'review.html'), `<!doctype html><meta charset="utf-8"><title>365 kit review</title><style>body{font:14px system-ui;background:#eee;margin:20px}figure{background:#fff;padding:12px;margin:0 0 18px;border-radius:10px}img{max-width:100%;height:auto;border:1px solid #ccc;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/16px 16px}figcaption{margin-top:6px}</style>
${A.map((a) => `<figure><img src="${a.file}" loading="lazy"><figcaption><b>${a.file}</b> · ${a.w}×${a.h} · ${a.where}<br>${a.how}</figcaption></figure>`).join('')}`);
console.log(A.length + ' files -> out/');
