/* Sixfold 365 Nextdoor business page images (2026-10-25, Matthew: "Do we have an image set for nextdoor?"; the only set was the old
   Aeration 365 look, its cover 1440 x 400, wider than Nextdoor's ratio). Nextdoor's help article "Edit your business page information"
   (help.nextdoor.com, read 2026-10-25): logo 500 x 500, PNG or JPEG, a rectangle is cropped to a square; cover "recommended image ratio
   is 5:2". So: logo 500 x 500 (the green badge on white, as Facebook and Google), cover 1500 x 600, brand only (photos are kept for
   content), everything in the middle so a tighter crop on phones keeps it. No phone or web address: the page lists them.
     node sixfold/brand/combined-365-2026-10/build-nextdoor-images.mjs   ->  nextdoor/ beside this file */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const HERE = dirname(fileURLToPath(import.meta.url)), PACK = join(HERE, 'brand-pack/365-Sixfold-Brand-Pack'), OUT = join(HERE, 'nextdoor');
mkdirSync(OUT, { recursive: true });
const u = (p) => pathToFileURL(p).href;
const GREEN = u(join(PACK, 'Full colour/365-Badge-A-Green.png')), LIGHT = u(join(PACK, 'Full colour/365-Badge-C-Light.png'));
const fonts = `@font-face{font-family:Outfit;src:url('${u(join(PACK, 'Fonts/Outfit.ttf'))}');font-weight:100 900}@font-face{font-family:DMSans;src:url('${u(join(PACK, 'Fonts/DMSans.ttf'))}');font-weight:100 900}`;
const pieces = [
  ['sixfold365-nextdoor-logo-500x500.png', 500, 500, `body{background:#fff;display:grid;place-items:center}img{width:472px;height:472px}`, `<img src="${GREEN}">`],
  ['sixfold365-nextdoor-cover-1500x600.png', 1500, 600, `body{background:#2F5D2C;position:relative;overflow:hidden}
     .ridge{position:absolute;left:0;right:0;bottom:0;height:190px}
     .wrap{position:absolute;left:0;right:0;top:0;bottom:60px;display:flex;align-items:center;justify-content:center;gap:48px}
     .wrap img{width:290px;height:290px;flex:none;filter:drop-shadow(0 14px 30px rgba(0,0,0,.35))}
     b{display:block;font:800 96px/1 Outfit,sans-serif;color:#FFF8EC;letter-spacing:-.01em}
     .sub{font:700 24px Outfit,sans-serif;color:#F3A77F;letter-spacing:.16em;margin-top:14px}
     .tag{font:italic 500 28px/1.3 DMSans,sans-serif;color:#E6EEE0;margin-top:18px}`,
   `<svg class="ridge" viewBox="0 0 1500 190" preserveAspectRatio="none"><path d="M0 190 L0 125 L165 55 L300 135 L475 30 L640 125 L780 45 L945 140 L1110 40 L1275 125 L1500 65 L1500 190 Z" fill="#244a22"/><path d="M0 190 L0 158 L220 100 L385 168 L585 90 L750 168 L925 100 L1100 172 L1300 95 L1500 152 L1500 190 Z" fill="#1E3D1C"/></svg>
    <div class="wrap"><img src="${LIGHT}"><div><b>Sixfold 365</b><div class="sub">LAND · AERATION &amp; SEEDING</div><div class="tag">From the lawn to the treeline, all year long.</div></div></div>`],
];
for (const [name, w, h, css, body] of pieces) {
  const f = join(OUT, '.tmp.html');
  writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}*{box-sizing:border-box;margin:0}html,body{width:${w}px;height:${h}px;overflow:hidden}${css}</style></head><body>${body}</body></html>`);
  execFileSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`, `--screenshot=${join(OUT, name)}`, '--virtual-time-budget=4000', u(f)], { stdio: 'ignore' });
  console.log(join(OUT, name));
}
rmSync(join(OUT, '.tmp.html'), { force: true });
