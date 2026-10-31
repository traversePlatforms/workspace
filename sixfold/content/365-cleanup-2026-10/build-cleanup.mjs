/* 365 Aeration & Seeding: yard clean-up price card (2026-10-31, Brad via Matthew: "make an infographic for fall clean up ... start selling it").
   Brad's own price ranges by yard size and haul-away per load; 1080 x 1350, the 365 colours and fonts (forest green #2F5D2C, cream #FFF8EC,
   sun gold #F2C14E; Outfit and DM Sans) and the 365 badge, rendered by headless Chrome. The kicker says Fall clean-up (Matthew 31 Oct, his call over the
   seasonless default: this card is for the fall season). No photo, no people, no results. DRAFT ONLY: nothing posted.
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
/* a real Sixfold 365 job photo (Brad's crew; the customer was asked at the job), cropped so no house number, car, plate or person shows;
   made into .render/job-photo.jpg from the job-photos folder (folder names hold addresses, so the photo and this picture stay local) */
const PHOTO = pathToFileURL(join(TMP, 'job-photo.jpg')).href;
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
.photo { position: absolute; left: 0; right: 0; top: 0; height: 500px; background: url('${PHOTO}') center 30% / cover no-repeat; }
.photo::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(20,40,19,.55) 0%, rgba(20,40,19,0) 28%, rgba(47,93,44,0) 46%, #2F5D2C 92%); }
.top { position: absolute; left: 76px; right: 76px; top: 56px; display: flex; justify-content: space-between; align-items: flex-start; }
.badge { width: 150px; height: 150px; filter: drop-shadow(0 4px 12px rgba(0,0,0,.35)); }
.kicker { font: 700 28px DMSans, sans-serif; color: #F2C14E; letter-spacing: .08em; text-transform: uppercase; margin-top: 18px; background: rgba(30,61,28,.92); border-radius: 999px; padding: 12px 24px; }
h1 { position: absolute; left: 76px; right: 76px; top: 330px; font: 800 76px/1.0 Outfit, sans-serif; letter-spacing: -.012em; text-shadow: 0 2px 18px rgba(0,0,0,.25); }
.incl { position: absolute; left: 76px; right: 90px; top: 500px; font: 500 31px/1.36 DMSans, sans-serif; color: #F1EADB; } .incl b { color: #F2C14E; font-weight: 700; }   /* Brad 31 Oct: what the clean-up covers */
.tiers { position: absolute; left: 76px; right: 76px; top: 612px; display: flex; flex-direction: column; gap: 16px; }
.tier { background: #FFF8EC; color: #1E3D1C; border-radius: 26px; padding: 21px 38px; display: flex; justify-content: space-between; align-items: center; }
.tier .k { font: 800 44px/1.05 Outfit, sans-serif; }
.tier .d { font: 500 26px DMSans, sans-serif; color: #4C6A48; margin-top: 6px; }
.tier .p { font: 800 54px Outfit, sans-serif; color: #2F5D2C; white-space: nowrap; }
.haul { position: absolute; left: 76px; right: 76px; top: 1052px; display: flex; justify-content: space-between; align-items: center; border: 3px solid #F2C14E; border-radius: 22px; padding: 18px 36px; }
.haul .k { font: 700 34px DMSans, sans-serif; } .haul .p { font: 800 42px Outfit, sans-serif; color: #F2C14E; }
.foot { position: absolute; left: 76px; right: 76px; bottom: 56px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px solid rgba(255,248,236,.25); padding-top: 22px; }
.foot .q { font: 600 25px/1.34 DMSans, sans-serif; color: #F1EADB; max-width: 560px; }
.foot .c { text-align: right; } .foot .c b { display: block; font: 800 46px Outfit, sans-serif; color: #F2C14E; } .foot .c span { font: 700 26px DMSans, sans-serif; }
</style></head><body><div class="leafbg"></div><div class="photo"></div>
<div class="top"><div class="kicker">Fall clean-up</div><img class="badge" src="${BADGE}" alt=""></div>
<h1>Your yard, cleaned up and hauled away.</h1>
<div class="incl"><b>We get it all:</b> leaves, pine needles and debris, anything that’s fallen onto your lawn.</div>
<div class="tiers">${TIERS.map(([k, d, p]) => `<div class="tier"><div><div class="k">${k}</div><div class="d">${d}</div></div><div class="p">${p}</div></div>`).join('')}</div>
<div class="haul"><div class="k">Haul-away and disposal</div><div class="p">$40\u2013$80 a load</div></div>
<div class="foot"><div class="q">Price depends on your yard’s size and how much debris there is. Every lawn is different: send us a picture of your lawn for a free quote.</div><div class="c"><b>${PHONE}</b><span>${SITE}</span></div></div>
</body></html>`;
const f = join(TMP, 'cleanup.html'); writeFileSync(f, html);
const out = join(HERE, '365-yard-cleanup-prices.png');
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1080,1350', '--screenshot=' + out, pathToFileURL(f).href], { stdio: 'ignore' });
console.log('wrote', out);
