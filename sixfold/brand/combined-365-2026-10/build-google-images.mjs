/* Sixfold 365 Google Business Profile images (2026-10-25, Matthew: "trying to switch them over so i was trying to get accurate sized photos").
   Google's own rule for every profile photo (support.google.com/business/answer/6103862, read 2026-10-25): JPG or PNG, 10 KB to 5 MB,
   720 x 720 px recommended, 250 x 250 px minimum. It gives no separate cover size, so:
     - logo 720 x 720: the green badge on white, as the Facebook profile picture
     - cover 1280 x 720: 720 tall, 16:9 for the wide header; brand only (photos are kept for content), and everything that matters sits
       in the middle 720 x 720, so a square crop (Maps thumbnails) still reads. No phone or web address on it: Google shows those beside it.
     node sixfold/brand/combined-365-2026-10/build-google-images.mjs   ->  google/ beside this file */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const HERE = dirname(fileURLToPath(import.meta.url)), PACK = join(HERE, 'brand-pack/365-Sixfold-Brand-Pack'), OUT = join(HERE, 'google');
mkdirSync(OUT, { recursive: true });
const u = (p) => pathToFileURL(p).href;
const GREEN = u(join(PACK, 'Full colour/365-Badge-A-Green.png')), LIGHT = u(join(PACK, 'Full colour/365-Badge-C-Light.png'));
const fonts = `@font-face{font-family:Outfit;src:url('${u(join(PACK, 'Fonts/Outfit.ttf'))}');font-weight:100 900}@font-face{font-family:DMSans;src:url('${u(join(PACK, 'Fonts/DMSans.ttf'))}');font-weight:100 900}`;
const pieces = [
  ['sixfold365-google-logo-720x720.png', 720, 720, `body{background:#fff;display:grid;place-items:center}img{width:680px;height:680px}`, `<img src="${GREEN}">`],
  ['sixfold365-google-cover-1280x720.png', 1280, 720, `body{background:#2F5D2C;position:relative;overflow:hidden}
     .ridge{position:absolute;left:0;right:0;bottom:0;height:200px}
     .mid{position:absolute;left:280px;width:720px;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding-bottom:40px}
     .mid img{width:300px;height:300px;filter:drop-shadow(0 14px 30px rgba(0,0,0,.35))}
     b{display:block;font:800 84px/1 Outfit,sans-serif;color:#FFF8EC;letter-spacing:-.01em;margin-top:22px}
     .sub{font:700 22px Outfit,sans-serif;color:#F3A77F;letter-spacing:.16em;margin-top:12px}
     .tag{font:italic 500 26px/1.3 DMSans,sans-serif;color:#E6EEE0;margin-top:14px}`,
   `<svg class="ridge" viewBox="0 0 1280 200" preserveAspectRatio="none"><path d="M0 200 L0 130 L140 60 L260 140 L410 35 L550 130 L670 50 L810 150 L950 45 L1090 130 L1280 70 L1280 200 Z" fill="#244a22"/><path d="M0 200 L0 165 L190 105 L330 175 L500 95 L640 175 L790 105 L940 180 L1110 100 L1280 160 L1280 200 Z" fill="#1E3D1C"/></svg>
    <div class="mid"><img src="${LIGHT}"><b>Sixfold 365</b><div class="sub">LAND · AERATION &amp; SEEDING</div><div class="tag">From the lawn to the treeline, all year long.</div></div>`],
];
for (const [name, w, h, css, body] of pieces) {
  const f = join(OUT, '.tmp.html');
  writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}*{box-sizing:border-box;margin:0}html,body{width:${w}px;height:${h}px;overflow:hidden}${css}</style></head><body>${body}</body></html>`);
  execFileSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`, `--screenshot=${join(OUT, name)}`, '--virtual-time-budget=4000', u(f)], { stdio: 'ignore' });
  console.log(join(OUT, name));
}
rmSync(join(OUT, '.tmp.html'), { force: true });
