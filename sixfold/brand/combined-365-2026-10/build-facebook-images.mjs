/* Sixfold 365 Facebook images (2026-10-23, Matthew: "add the appropriate images"). Profile picture 720 x 720 (Facebook shows it as a circle,
   so the round badge fills it) and cover 1640 x 624 (Facebook's recommended size; phones crop the sides, so everything that matters sits in
   the middle 1100 px). Photo: the lawn plugs already used on the website.
     node sixfold/brand/combined-365-2026-10/build-facebook-images.mjs   ->  facebook/ beside this file */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const HERE = dirname(fileURLToPath(import.meta.url)), PACK = join(HERE, 'brand-pack/365-Sixfold-Brand-Pack'), OUT = join(HERE, 'facebook');
mkdirSync(OUT, { recursive: true });
const u = (p) => pathToFileURL(p).href;
const GREEN = u(join(PACK, 'Full colour/365-Badge-A-Green.png')), LIGHT = u(join(PACK, 'Full colour/365-Badge-C-Light.png'));
const PHOTO = u(join(HERE, '../../aeration365-site/img/hero.png'));
const fonts = `@font-face{font-family:Outfit;src:url('${u(join(PACK, 'Fonts/Outfit.ttf'))}');font-weight:100 900}@font-face{font-family:DMSans;src:url('${u(join(PACK, 'Fonts/DMSans.ttf'))}');font-weight:100 900}`;
const pieces = [
  ['sixfold365-profile-720.png', 720, 720, `body{background:#fff;display:grid;place-items:center}img{width:700px;height:700px}`, `<img src="${GREEN}">`],
  ['sixfold365-cover-1640x624.png', 1640, 624, `body{background:#2F5D2C;position:relative}
     .pic{position:absolute;inset:0 0 0 auto;width:900px;background:url('${PHOTO}') center/cover}
     .fade{position:absolute;top:0;bottom:0;right:620px;width:320px;background:linear-gradient(to right,#2F5D2C,rgba(47,93,44,0))}
     .t{position:absolute;left:330px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;color:#FFF8EC}
     b{font:800 96px/1 Outfit,sans-serif;letter-spacing:-.01em}small{font:700 26px Outfit,sans-serif;color:#F3A77F;letter-spacing:.14em;margin-top:14px}
     p{font:500 30px/1.3 DMSans,sans-serif;color:#E6EEE0;margin-top:22px;max-width:560px}
     .bar{position:absolute;left:0;right:0;bottom:0;height:12px;background:#E4703A}`,
   `<div class="pic"></div><div class="fade"></div><div class="t"><b>Sixfold 365</b><small>LAND · AERATION &amp; SEEDING</small><p>Core aeration, overseeding, fertilizing and landscaping all over Colorado.</p></div><div class="bar"></div>`],
];
for (const [name, w, h, css, body] of pieces) {
  const f = join(OUT, '.tmp.html');
  writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}*{box-sizing:border-box;margin:0}html,body{width:${w}px;height:${h}px;overflow:hidden}${css}</style></head><body>${body}</body></html>`);
  execFileSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`, `--screenshot=${join(OUT, name)}`, '--virtual-time-budget=4000', u(f)], { stdio: 'ignore' });
  console.log(join(OUT, name));
}
