/* 365 Aeration & Seeding: yard clean-up price card (2026-10-31, Brad via Matthew: "make an infographic for fall clean up ... start selling it").
   Brad's own price ranges by yard size and haul-away per load; 1080 x 1350, the 365 colours and fonts (forest green #2F5D2C, cream #FFF8EC,
   sun gold #F2C14E; Outfit and DM Sans) and the 365 badge, rendered by headless Chrome. The picture stays seasonless (standing rule: it can be
   reused in spring); "fall" goes in the caption. No photo, no people, no results. DRAFT ONLY: nothing posted.
     node build-cleanup.mjs                                                                                                   */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const HERE = dirname(fileURLToPath(import.meta.url)), TMP = join(HERE, '.render');
mkdirSync(TMP, { recursive: true });
const PACK = join(HERE, '../../brand/combined-365-2026-10/brand-pack/365-Sixfold-Brand-Pack');
const FONTS = pathToFileURL(join(PACK, 'Fonts')).href;
const BADGE = pathToFileURL(join(PACK, 'Full colour/365-Badge-A-Green.svg')).href;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PHONE = '(720) 830-4553', SITE = '365aeration.com';
const TIERS = [   /* sizes as square feet (1 acre = 43,560 sq ft): arithmetic, not a claim about which lots are typical */
  ['Up to 1/4 acre', 'Up to about 10,900 sq ft of lot', '$100–$300'],
  ['1/4 to 1/2 acre', 'About 10,900 to 21,800 sq ft', '$250–$600'],
  ['1/2 acre and up', 'Over about 21,800 sq ft', '$600–$1,000'],
];
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Outfit; src: url('${FONTS}/Outfit.ttf'); font-weight: 100 900; }
@font-face { font-family: DMSans; src: url('${FONTS}/DMSans.ttf'); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; } html, body { width: 1080px; height: 1350px; overflow: hidden; background: #2F5D2C; }
body { position: relative; color: #FFF8EC; font-family: DMSans, sans-serif; }
.leafbg { position: absolute; inset: 0; background: radial-gradient(1200px 700px at 85% -10%, rgba(242,193,78,.18), transparent 60%), radial-gradient(900px 600px at -10% 110%, rgba(255,248,236,.08), transparent 60%); }
.top { position: absolute; left: 76px; right: 76px; top: 70px; display: flex; justify-content: space-between; align-items: flex-start; }
.badge { width: 150px; height: 150px; }
.kicker { font: 700 30px DMSans, sans-serif; color: #F2C14E; letter-spacing: .08em; text-transform: uppercase; margin-top: 18px; }
h1 { position: absolute; left: 76px; right: 76px; top: 250px; font: 800 86px/1.0 Outfit, sans-serif; letter-spacing: -.012em; }
.sub { position: absolute; left: 76px; right: 120px; top: 440px; font: 500 34px/1.38 DMSans, sans-serif; color: #F1EADB; }
.tiers { position: absolute; left: 76px; right: 76px; top: 570px; display: flex; flex-direction: column; gap: 22px; }
.tier { background: #FFF8EC; color: #1E3D1C; border-radius: 26px; padding: 30px 38px; display: flex; justify-content: space-between; align-items: center; }
.tier .k { font: 800 44px/1.05 Outfit, sans-serif; }
.tier .d { font: 500 26px DMSans, sans-serif; color: #4C6A48; margin-top: 6px; }
.tier .p { font: 800 54px Outfit, sans-serif; color: #2F5D2C; white-space: nowrap; }
.haul { position: absolute; left: 76px; right: 76px; top: 1080px; display: flex; justify-content: space-between; align-items: center; border: 3px solid #F2C14E; border-radius: 22px; padding: 22px 36px; }
.haul .k { font: 700 34px DMSans, sans-serif; } .haul .p { font: 800 42px Outfit, sans-serif; color: #F2C14E; }
.foot { position: absolute; left: 76px; right: 76px; bottom: 56px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px solid rgba(255,248,236,.25); padding-top: 22px; }
.foot .q { font: 600 26px/1.35 DMSans, sans-serif; color: #F1EADB; max-width: 520px; }
.foot .c { text-align: right; } .foot .c b { display: block; font: 800 46px Outfit, sans-serif; color: #F2C14E; } .foot .c span { font: 700 26px DMSans, sans-serif; }
</style></head><body><div class="leafbg"></div>
<div class="top"><div class="kicker">Yard clean-up</div><img class="badge" src="${BADGE}" alt=""></div>
<h1>Your yard, cleaned up and hauled away.</h1>
<div class="sub">Clear prices by yard size, from the same crew that aerates your lawn.</div>
<div class="tiers">${TIERS.map(([k, d, p]) => `<div class="tier"><div><div class="k">${k}</div><div class="d">${d}</div></div><div class="p">${p}</div></div>`).join('')}</div>
<div class="haul"><div class="k">Haul-away and disposal</div><div class="p">$40\u2013$80 a load</div></div>
<div class="foot"><div class="q">Every yard is different. Call or text for a free quote and we\u2019ll confirm your price.</div><div class="c"><b>${PHONE}</b><span>${SITE}</span></div></div>
</body></html>`;
const f = join(TMP, 'cleanup.html'); writeFileSync(f, html);
const out = join(HERE, '365-yard-cleanup-prices.png');
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1080,1350', '--screenshot=' + out, pathToFileURL(f).href], { stdio: 'ignore' });
console.log('wrote', out);
