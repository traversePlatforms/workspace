/* Sixfold Colorado — the photo cut of the lawn aeration sheet. 2026-09-25.

   Matthew: "can you make our current one using licensed stock?"

   I cannot buy or download stock — a licence has to be bought against his account,
   and nothing here can pull an image into the repo. So this builds the sheet
   PHOTO-READY: four slots, exact crops, and a shopping list in photos/README.md.
   Drop the files in photos/ and re-run; no layout work is left.

   Until a real file exists, each slot renders a frame from the existing library
   under a PLACEHOLDER ribbon. Those frames are trees and gravel beds — they are
   the wrong service on purpose, so nobody mistakes this for finished artwork.

   THE HONESTY LINE, and it is the whole reason this file has a README:
     A library photograph of TURF, PLUGS, SEED or a MACHINE illustrates the
     service, the same way the drawing does.
     A library photograph of A CREW WORKING reads as "this is our crew on your
     neighbour's lawn", and it is not. Stock people are where this stops.
   Same rule the repo already holds for before-and-after imagery: there is none
   that is a real Sixfold job, so none is shown.

   Run:  node build-photo.mjs   ->  lawn-photo.{html,png}  1080x1350
*/

import { writeFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { cutaway } from './art.mjs';

const HERE = resolve('.');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const LIB = '../../site/assets/img';      // the real library, for placeholders only

/* Each slot: where the file goes, what it has to show, and what it stands in as
   until then. `focal` is the object-position, because a 3:2 stock frame cropped
   to a band loses its subject unless it is told where the subject is. */
const SLOTS = {
  hero:  { stem: 'hero',   fallback: `${LIB}/trimming.jpg`, focal: '50% 62%',
           want: 'Plugs on the turf after a pass, close and low' },
  card1: { stem: 'aerate', fallback: `${LIB}/stand.jpg`,    focal: '50% 55%',
           want: 'A core aerator on grass' },
  card2: { stem: 'seed',   fallback: `${LIB}/beds.jpg`,     focal: '50% 50%',
           want: 'Grass seed going down — spreader or hand' },
  card3: { stem: 'mow',    fallback: `${LIB}/limbing.jpg`,  focal: '50% 55%',
           want: 'A mown lawn with stripes' },
};

/* Match on the STEM, not the exact filename. A file straight out of Adobe Stock
   is called AdobeStock_1234567890.jpeg, and making someone rename to an exact
   extension is a step that gets skipped and then blamed on the build. Any of
   .jpg .jpeg .png .webp works, and so does a suffixed name like hero-2.jpg —
   newest wins, so re-downloading a better frame just works. */
mkdirSync(join(HERE, 'photos'), { recursive: true });
const POOL = readdirSync(join(HERE, 'photos'), { withFileTypes: true })
  .filter(e => e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name))
  .map(e => e.name);

/* A slot listed in photos/UNLICENSED.txt has a file but not a licence — a comp,
   a screenshot, a preview. It renders, because that is what comps are FOR: judging
   a layout. It renders under a red ribbon, because the one thing that must never
   happen is one of them reaching a live ad. Delete the line when the licensed
   download replaces it. */
const UNLICENSED = (() => {
  try {
    return new Set(readFileSync(join(HERE, 'photos/UNLICENSED.txt'), 'utf8')
      .split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')));
  } catch { return new Set(); }
})();

for (const s of Object.values(SLOTS)) {
  const hit = POOL.filter(n => n.toLowerCase().startsWith(s.stem) && !n.startsWith('_'))
    .sort((a, b) => a.length - b.length)[0];
  s.real = Boolean(hit);
  s.src = hit ? `photos/${hit}` : s.fallback;
  s.comp = s.real && UNLICENSED.has(s.stem);
}

/* Anything in the folder that matched no slot is almost always a good frame with
   the wrong name — say so rather than silently ignoring it. */
const claimed = new Set(Object.values(SLOTS).filter(s => s.real).map(s => s.src.slice(7)));
const orphans = POOL.filter(n => !claimed.has(n));

const RIDGE = 'M18 84L18.3 83.4L18.3 84L18 84ZM25.7 83.1L28.65 83.1L28.26 84L25.7 84L25.7 83.1ZM28.73 62.53L36 48L40.23 56.46L33.11 72.83L29.17 68.1L32.53 68.1L28.73 62.53ZM30.86 75.6L31.91 75.6L31.59 76.33L30.86 75.6ZM30 84L30.39 83.1L38.36 83.1L32.81 77.54L33.65 75.6L35.42 75.6L34.26 74.21L50 38L55.2 49.96L42.29 84L30 84ZM44 84L66 26L70.71 38.42L58.34 84L44 84ZM60 84L79 14L98 84L60 84ZM9.5 81.5L17 74L12 74L18.25 66.5L14.5 66.5L22 55.5L29.5 66.5L25.75 66.5L32 74L27 74L34.5 81.5L24.1 81.5L24.1 84.5L19.9 84.5L19.9 81.5L9.5 81.5ZM4 86L96 86L96 91L4 91Z';

const COLUMNS = [
  { key: 'aerate', slot: 'card1', kick: 'Open the ground.',
    bullets: ['Core aeration, plugs two to three inches deep',
              'Compacted lawns, worn paths, high-traffic ground',
              'Plugs left on the surface to break back down'] },
  { key: 'overseed', slot: 'card2', kick: 'Put seed where it works.',
    bullets: ['Overseeding straight after the pass',
              'Seed into open holes, not onto thatch',
              'Fertilizer down with it'] },
  { key: 'maintain', slot: 'card3', kick: 'Keep it that way.',
    bullets: ['Mowing and edging',
              'Seasonal clean-up and haul-away',
              'Brush, plants and trees taken out'] },
];

const art = cutaway({ W: 960, H: 296, pxPerIn: 38, surface: 60, theme: 'day', badges: false, idp: 'p' });

const ribbon = (s) =>
  s.comp ? '<span class="ph comp">Comp &middot; not licensed &middot; do not publish</span>'
         : s.real ? ''
         : `<span class="ph">Placeholder &middot; not licensed &middot; ${s.want}</span>`;

const html = `<!doctype html>
<!-- GENERATED by build-photo.mjs. Edit the script, not this file. -->
<html lang="en"><head><meta charset="utf-8">
<title>Sixfold Colorado — lawn aeration, photo cut</title>
<style>
:root{
  --ground:#FBF7ED; --ink:#16211B; --muted:#4F5C53; --hair:rgba(22,33,27,.16);
  --card:#FFFFFF; --card-edge:#E7E0D1; --head:#2F7A4F; --accent:#2F7A4F; --label:#3E6B4E;
  --ember:#E4703A;
  --serif:"Palatino Linotype","Book Antiqua",Palatino,"Iowan Old Style",Georgia,serif;
  --sans:"Segoe UI",ui-sans-serif,system-ui,Roboto,Helvetica,Arial,sans-serif;
  --mono:Consolas,"Cascadia Mono","Segoe UI Mono",ui-monospace,monospace;
}
@page{ size:11.25in 14.0625in; margin:0 }
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:#202622;display:grid;place-items:start center;font-family:var(--sans)}
.sheet{width:1080px;height:1350px;overflow:hidden;background:var(--ground);color:var(--ink);
       display:flex;flex-direction:column}

/* every photo carries the library treatment so bought frames and shot frames
   read as one company — PHOTOS.md §Treatment */
img{filter:saturate(.92);display:block}

/* ---- the band ---- */
.band{position:relative;height:330px;flex:none;overflow:hidden;background:#0E1512}
.band img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.band .veil{position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(8,14,11,.78) 0%,rgba(8,14,11,.35) 46%,rgba(8,14,11,.86) 100%)}
.band .in{position:absolute;inset:0;padding:30px 60px;display:flex;flex-direction:column;
          justify-content:space-between;color:#EDE7DC}
.top{display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center}
.top .mark{width:64px;color:#8FD6A9}
.top .mark svg{width:64px;height:61px}
.name{margin:0;font-family:var(--serif);font-size:40px;line-height:1}
.sub{margin:4px 0 0;font-family:var(--mono);font-size:13px;letter-spacing:.24em;
     text-transform:uppercase;color:#9ED8B4}
.where{margin:0;text-align:right;font-family:var(--mono);font-size:12.5px;letter-spacing:.16em;
       text-transform:uppercase;color:rgba(237,231,220,.72);line-height:1.8}
.band h1{margin:0;font-family:var(--serif);font-weight:400;font-size:72px;line-height:.96;
         letter-spacing:-.03em;text-shadow:0 2px 24px rgba(0,0,0,.45)}
.band h1 em{font-style:normal;color:#8FD6A9}

.spine{padding:12px 60px;border-bottom:2px solid var(--hair);display:flex;justify-content:center;
       gap:28px;font-family:var(--mono);font-size:16px;letter-spacing:.3em;text-transform:uppercase;
       font-weight:700;flex:none}
.spine i{font-style:normal;color:var(--ember)}

.say{padding:20px 60px 0;display:grid;grid-template-columns:1fr 292px;gap:26px;align-items:start}
.say p{margin:0;font-size:20px;line-height:1.42;color:var(--muted)}
.say .lead{font-family:var(--serif);font-size:27px;line-height:1.2;color:var(--ink);margin:0 0 10px}
.tag{border:2px solid var(--ember);border-radius:13px;padding:14px 16px;background:rgba(228,112,58,.08)}
.tag b{display:block;font-family:var(--serif);font-weight:400;font-size:21px;line-height:1.22}
.tag span{display:block;margin-top:7px;font-family:var(--mono);font-size:12px;letter-spacing:.16em;
          text-transform:uppercase;color:#B8501E;font-weight:700}

.art{padding:18px 60px 0}
.art svg{display:block;width:960px;height:296px;border-radius:18px}

.cols{padding:18px 60px 0;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.col{background:var(--card);border:2px solid var(--card-edge);border-radius:14px;overflow:hidden;
     display:flex;flex-direction:column;position:relative}
.col .shot{position:relative;height:138px;flex:none;background:#0E1512}
.col .shot img{width:100%;height:100%;object-fit:cover}
.col header{background:var(--head);color:#fff;padding:10px 14px;font-family:var(--mono);
            font-size:18px;letter-spacing:.16em;text-transform:uppercase;font-weight:700}
.col .kick{margin:0;padding:11px 14px 0;font-family:var(--serif);font-size:20px;line-height:1.15}
.col ul{margin:8px 0 0;padding:0 14px 14px;list-style:none;display:grid;gap:6px}
.col li{position:relative;padding-left:22px;font-size:15px;line-height:1.3;color:#4B554D}
.col li::before{content:"";position:absolute;left:1px;top:4px;width:11px;height:6px;
  border-left:3px solid var(--ember);border-bottom:3px solid var(--ember);transform:rotate(-45deg)}

/* the stand-in stamp — loud on purpose, so an unlicensed frame cannot ship by accident */
.ph{position:absolute;left:0;right:0;bottom:0;z-index:2;background:rgba(228,112,58,.94);
    color:#1A0C04;font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;
    font-weight:700;padding:5px 8px;text-align:center;line-height:1.3}
.band .ph{font-size:13px;padding:7px 10px}
.ph.comp{background:#C22A1F;color:#FFF3EF}

.bar{margin-top:auto;background:var(--ember);color:#1A0C04;padding:16px 60px 20px;
     display:grid;grid-template-columns:auto 1fr auto;gap:22px;align-items:center}
.bar .tel{margin:0;font-family:var(--serif);font-size:54px;line-height:1;letter-spacing:-.02em;white-space:nowrap}
.bar .cta{margin:3px 0 0;font-family:var(--mono);font-size:13.5px;letter-spacing:.14em;
          text-transform:uppercase;font-weight:700;color:#2A1408}
.bar .rule{width:2px;height:58px;background:rgba(26,12,4,.3)}
.bar .right{text-align:right}
.bar .web{margin:0;font-family:var(--mono);font-size:18px;letter-spacing:.06em;font-weight:700}
.bar .towns{margin:5px 0 0;font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;
            text-transform:uppercase;color:rgba(26,12,4,.7);line-height:1.5}
</style></head>
<body>
<div class="sheet">

  <div class="band">
    <img src="${SLOTS.hero.src}" alt="" style="object-position:${SLOTS.hero.focal}">
    <div class="veil"></div>
    <div class="in">
      <div class="top">
        <div class="mark"><svg viewBox="0 0 100 96" role="img" aria-label="Sixfold"><path fill="currentColor" fill-rule="evenodd" d="${RIDGE}"/></svg></div>
        <div><p class="name">Sixfold Colorado</p><p class="sub">Lawn &amp; turf care</p></div>
        <p class="where">Monument, Colorado<br>El Paso &middot; Teller &middot; S. Douglas</p>
      </div>
      <h1>Your lawn.<br><em>Our work.</em></h1>
    </div>
    ${ribbon(SLOTS.hero)}
  </div>

  <div class="spine"><span>Aerate</span><i>&bull;</i><span>Overseed</span><i>&bull;</i><span>Maintain</span></div>

  <div class="say">
    <div>
      <p>Sixfold Colorado opens compacted ground with core aeration, seeds it while the
      holes are still open, and keeps it cut through the season &mdash; so the water you put
      on the lawn goes into it instead of off it.</p>
    </div>
    <!-- ⚑ THE DEAL SLOT. A bundle and a season, not a discount. Never "free estimate". -->
    <div class="tag"><b>Open ground.<br>Deeper roots.<br>Less runoff.</b>
      <span>Booking fall aeration</span></div>
  </div>

  <!-- The cutaway stays, and it is not a nostalgia keep: a soil profile with the tine
       in the ground CANNOT be photographed. The photos show the work; the drawing
       shows the part of it nobody can see. -->
  <div class="art">${art}</div>

  <div class="cols">
    ${COLUMNS.map(c => `<div class="col">
      <div class="shot"><img src="${SLOTS[c.slot].src}" alt="" style="object-position:${SLOTS[c.slot].focal}">${ribbon(SLOTS[c.slot])}</div>
      <header>${c.key}</header>
      <p class="kick">${c.kick}</p>
      <ul>${c.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
    </div>`).join('')}
  </div>

  <div class="bar">
    <div><p class="tel">(303) 915-1045</p><p class="cta">Call and we will walk your lawn</p></div>
    <div class="rule"></div>
    <div class="right">
      <p class="web">SixfoldColorado.com</p>
      <p class="towns">Monument &middot; Colorado Springs<br>Black Forest &middot; Palmer Lake &middot; Larkspur</p>
    </div>
  </div>

</div>
</body></html>`;

const htmlPath = join(HERE, 'lawn-photo.html');
writeFileSync(htmlPath, html);
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--force-color-profile=srgb', '--window-size=1080,1350', '--virtual-time-budget=1500',
  `--screenshot=${join(HERE, 'lawn-photo.png')}`, 'file:///' + htmlPath.replace(/\\/g, '/')],
  { encoding: 'utf8' });
console.log(r.status === 0 ? 'lawn-photo.png  1080x1350' : 'FAILED\n' + r.stderr);

for (const [k, s] of Object.entries(SLOTS)) {
  const state = s.comp ? 'COMP, unlicensed  ' : s.real ? 'licensed          ' : 'PLACEHOLDER       ';
  console.log(`  ${k.padEnd(6)} ${state} ${s.real ? s.src.slice(7) : 'wants: ' + s.want}`);
}
const comps = Object.values(SLOTS).filter(s => s.comp).length;
if (comps) console.log(`\n  ⚑ ${comps} slot(s) carry unlicensed comps. Draft only — see photos/UNLICENSED.txt`);
if (orphans.length) {
  console.log(`\n  ⚑ in photos/ but matching no slot: ${orphans.join(', ')}`);
  console.log('    rename so it starts with hero / aerate / seed / mow');
}
