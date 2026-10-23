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
  /* the cover, brand only (2026-10-23, Matthew: "change it to a better photo ... we need to save those [photos] for content. It needs to be
     very brand heavy like our last one was"): badge, name, tagline, the website's six service pills, phone and site; the ridge peaks along
     the foot. Phones crop the sides, so it all sits in the middle ~1100 px. */
  ['sixfold365-cover-brand-1640x624.png', 1640, 624, `body{background:#2F5D2C;position:relative;overflow:hidden}
     .ridge{position:absolute;left:0;right:0;bottom:0;height:230px}
     .wrap{position:absolute;left:270px;right:270px;top:58px;display:flex;align-items:center;gap:56px}
     .wrap img{width:300px;height:300px;flex:none;filter:drop-shadow(0 14px 30px rgba(0,0,0,.35))}
     b{display:block;font:800 104px/1 Outfit,sans-serif;color:#FFF8EC;letter-spacing:-.01em}
     .sub{font:700 26px Outfit,sans-serif;color:#F3A77F;letter-spacing:.16em;margin-top:14px}
     .tag{font:italic 500 30px/1.3 DMSans,sans-serif;color:#E6EEE0;margin-top:20px}
     .pills{position:absolute;left:270px;right:270px;top:410px;display:flex;gap:10px}
     .pills span{flex:1;text-align:center;font:700 19px Outfit,sans-serif;color:#fff;border-radius:999px;padding:10px 0;white-space:nowrap}
     .c1{background:#244a22;box-shadow:inset 0 0 0 2px rgba(255,248,236,.35)}.c2{background:#4C7A3F}.c3{background:#6B7A23}.c4{background:#9C7420}.c5{background:#8A5A3B}.c6{background:#C95A27}
     .foot{position:absolute;left:270px;right:270px;bottom:44px;display:flex;justify-content:center;gap:40px;font:800 34px Outfit,sans-serif;color:#FFF8EC}
     .foot i{font-style:normal;color:#F2C14E}`,
   `<svg class="ridge" viewBox="0 0 1640 230" preserveAspectRatio="none"><path d="M0 230 L0 150 L180 70 L330 160 L520 40 L700 150 L860 60 L1040 170 L1220 50 L1400 150 L1640 80 L1640 230 Z" fill="#244a22"/><path d="M0 230 L0 190 L240 120 L420 200 L640 110 L820 200 L1010 120 L1200 205 L1420 115 L1640 180 L1640 230 Z" fill="#1E3D1C"/></svg>
    <div class="wrap"><img src="${LIGHT}"><div><b>Sixfold 365</b><div class="sub">LAND · AERATION &amp; SEEDING</div><div class="tag">From the lawn to the treeline, all year long.</div></div></div>
    <div class="pills"><span class="c1">Core aeration</span><span class="c2">Overseeding</span><span class="c3">Fertilizer</span><span class="c4">Landscaping</span><span class="c5">Land clearing</span><span class="c6">Fire mitigation</span></div>
    <div class="foot"><span><i>Call or text</i> (720) 830-4553</span><span>365aeration.com</span></div>`],
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
