/* Sixfold 365 images for Square (2026-10-23, Matthew: "can u also rebrand the logo images etc on square?"). Square takes these only by upload
   in the Seller Dashboard (its API cannot set them), so this makes them at the sizes Square's current ones use, for him to upload:
     1 logo, square 400 x 400 (receipts, checkout)  ·  2 full-format logo 1024 x 518 (the wide logo)  ·  3 POS background 1024 x 640
   node sixfold/brand/combined-365-2026-10/build-square-logos.mjs   ->  square-logos/ beside this file */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const HERE = dirname(fileURLToPath(import.meta.url)), PACK = join(HERE, 'brand-pack/365-Sixfold-Brand-Pack'), OUT = join(HERE, 'square-logos');
mkdirSync(OUT, { recursive: true });
const u = (p) => pathToFileURL(p).href;
const GREEN = u(join(PACK, 'Full colour/365-Badge-A-Green.png')), LIGHT = u(join(PACK, 'Full colour/365-Badge-C-Light.png'));
const fonts = `@font-face{font-family:Outfit;src:url('${u(join(PACK, 'Fonts/Outfit.ttf'))}');font-weight:100 900}`;
const pieces = [
  ['1-Sixfold365-logo-400x400.png', 400, 400, `body{background:#fff;display:grid;place-items:center}img{width:372px;height:372px}`, `<img src="${GREEN}">`],
  ['2-Sixfold365-full-logo-1024x518.png', 1024, 518, `body{background:#fff;display:flex;align-items:center;justify-content:center;gap:36px;padding:0 50px}img{width:300px;height:300px}
     b{display:block;font:800 92px/1 Outfit,sans-serif;color:#2F5D2C;letter-spacing:-.01em;white-space:nowrap}small{display:block;margin-top:14px;font:700 24px Outfit,sans-serif;color:#C95A27;letter-spacing:.12em;white-space:nowrap}`,
   `<img src="${GREEN}"><div><b>Sixfold 365</b><small>LAND · AERATION &amp; SEEDING</small></div>`],
  ['3-Sixfold365-pos-background-1024x640.png', 1024, 640, `body{background:#2F5D2C;display:grid;place-items:center}img{width:420px;height:420px;filter:drop-shadow(0 12px 30px rgba(0,0,0,.35))}`, `<img src="${LIGHT}">`],
];
for (const [name, w, h, css, body] of pieces) {
  const f = join(OUT, '.tmp.html');
  writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}*{box-sizing:border-box;margin:0}html,body{width:${w}px;height:${h}px;overflow:hidden}${css}</style></head><body>${body}</body></html>`);
  execFileSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`, `--screenshot=${join(OUT, name)}`, '--virtual-time-budget=4000', u(f)], { stdio: 'ignore' });
  console.log(join(OUT, name));
}
