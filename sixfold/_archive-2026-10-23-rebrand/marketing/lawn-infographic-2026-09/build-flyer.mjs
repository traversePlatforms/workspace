/* Sixfold Colorado — lawn aeration sheet, built in the shape of the 2026
   "Land & Fire" CLEAR / PROTECT / RESTORE flyer. 2026-09-25.

   Matthew showed that flyer and said he likes the wording and the messaging, and
   wants this one more professional. So the STRUCTURE is carried over — spine,
   statement, tagline, three columns of ticked services, icon strip, orange bar —
   and the EXECUTION is not:

     - No grunge textures, no brush-script badge, no drop shadows on type. Those
       are what make the old sheet read as a template rather than a company.
     - One type system: serif for display, sans for reading, mono for labels.
       The old sheet runs five faces.
     - The drawing is generated (art.mjs), measured to the same depth scale as
       the ad board, and it is the only illustration. The old sheet leans on
       stock-looking photographs; there is still no photograph of a real Sixfold
       aeration job — PHOTOS.md §The turf gap.
     - Consistent icon weight: every icon is drawn on a 44-unit box at stroke 3.

   TWO THINGS FROM THE OLD SHEET ARE DELIBERATELY NOT CARRIED OVER:
     "FREE ESTIMATES"  — barred in this repo, and site/audit-links.mjs greps for it.
     "Stump grinding"  — retired in the quote engine 2026-09-23 on "no stump
                         grinding". The old sheet still sells it.
     "Land & Fire"     — the descriptor names the demoted service; the rebrand
                         path recommends retiring it rather than reprinting it.

   Run:  node build-flyer.mjs   ->  lawn-sheet-ad.{html,png}    1080x1350 (4:5, the ad)
                                    lawn-sheet-flyer.{html,png} 1080x1620 (2:3, the sheet)
*/

import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { cutaway } from './art.mjs';

const HERE = resolve('.');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const RIDGE = 'M18 84L18.3 83.4L18.3 84L18 84ZM25.7 83.1L28.65 83.1L28.26 84L25.7 84L25.7 83.1ZM28.73 62.53L36 48L40.23 56.46L33.11 72.83L29.17 68.1L32.53 68.1L28.73 62.53ZM30.86 75.6L31.91 75.6L31.59 76.33L30.86 75.6ZM30 84L30.39 83.1L38.36 83.1L32.81 77.54L33.65 75.6L35.42 75.6L34.26 74.21L50 38L55.2 49.96L42.29 84L30 84ZM44 84L66 26L70.71 38.42L58.34 84L44 84ZM60 84L79 14L98 84L60 84ZM9.5 81.5L17 74L12 74L18.25 66.5L14.5 66.5L22 55.5L29.5 66.5L25.75 66.5L32 74L27 74L34.5 81.5L24.1 81.5L24.1 84.5L19.9 84.5L19.9 81.5L9.5 81.5ZM4 86L96 86L96 91L4 91Z';

/* --- icons: one 44-unit box, one stroke weight, no exceptions --------------- */
const I = {
  core: `<rect x="15" y="7" width="14" height="30" rx="7" fill="currentColor"/>
         <rect x="15" y="7" width="14" height="10" rx="5" fill="#4FB878"/>`,
  tines: `<g stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round">
            <path d="M10 8v18M22 8v18M34 8v18"/><path d="M6 31h32"/><path d="M13 36h6M25 36h6"/></g>`,
  seed: `<g fill="currentColor"><ellipse cx="14" cy="11" rx="4" ry="6" transform="rotate(-20 14 11)"/>
           <ellipse cx="26" cy="16" rx="4" ry="6" transform="rotate(15 26 16)"/></g>
         <g stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round">
           <path d="M8 28h28"/><path d="M18 28v9M26 28v9"/></g>`,
  feed: `<g stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round">
           <path d="M13 12h18l3 13H10z"/><path d="M8 31h28"/></g>
         <g fill="currentColor"><circle cx="16" cy="36" r="2"/><circle cx="23" cy="38" r="2"/><circle cx="30" cy="36" r="2"/></g>`,
  mow: `<g stroke="currentColor" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round">
          <path d="M8 27h16l4-8h8v8h-4"/><path d="M32 19l4-9"/><circle cx="13" cy="33" r="5"/><circle cx="30" cy="33" r="4"/></g>`,
  haul: `<g stroke="currentColor" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round">
           <path d="M7 28V16h18v12"/><path d="M25 21h7l4 7v0h-11"/><path d="M7 28h29"/>
           <circle cx="14" cy="33" r="4"/><circle cx="29" cy="33" r="4"/></g>`,
  walk: `<g stroke="currentColor" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round">
           <rect x="9" y="7" width="26" height="30" rx="4"/><path d="M15 16h14M15 23h14M15 30h8"/></g>`,
};

/* --- content --------------------------------------------------------------- */
const COLUMNS = [
  { key: 'aerate', icon: I.tines, kicker: 'Open the ground.',
    bullets: ['Core aeration, plugs two to three inches deep',
              'Compacted lawns, worn paths, high-traffic ground',
              'Plugs left on the surface to break back down',
              'Walked and counted before anything is quoted',
              'Spring and fall are the windows'] },
  { key: 'overseed', icon: I.seed, kicker: 'Put seed where it works.',
    bullets: ['Overseeding straight after the pass',
              'Seed into open holes, not onto thatch',
              'Fertilizer down with it',
              'Thin patches and worn strips',
              'What to water, and when, before we leave'] },
  { key: 'maintain', icon: I.mow, kicker: 'Keep it that way.',
    bullets: ['Mowing and edging',
              'Seasonal clean-up and haul-away',
              'Brush, plants and trees taken out',
              'Land clearing when the lot needs it',
              'One crew, one invoice'] },
];

const STRIP = [
  ['Lawn aeration', I.core], ['Overseeding', I.seed], ['Fertilizing', I.feed],
  ['Mowing & edging', I.mow], ['Clean-up & haul', I.haul],
];

/* --- the page -------------------------------------------------------------- */
function page({ H, bullets, strip, artH, artScale, theme = 'dark' }) {
  const day = theme === 'day';
  const art = cutaway({ W: 960, H: artH, pxPerIn: artScale, surface: Math.round(artScale * 1.55),
                        badges: true, theme, idp: 'a' });

  /* One token set, two grounds. Nothing below this line knows which theme it is. */
  const T = day ? `
  --ground:#FBF7ED; --ink:#16211B; --muted:#4F5C53; --hair:rgba(22,33,27,.16);
  --card:#FFFFFF; --card-edge:#E7E0D1; --head:#2F7A4F; --onhead:#FFFFFF;
  --strip:#F1EADB; --accent:#2F7A4F; --label:#3E6B4E;` : `
  --ground:#0E1512; --ink:#EDE7DC; --muted:rgba(237,231,220,.76); --hair:rgba(237,231,220,.14);
  --card:#F4F0E7; --card-edge:transparent; --head:#18211C; --onhead:#EDE7DC;
  --strip:#18211C; --accent:#4FB878; --label:#A7BE93;`;

  return `<!doctype html>
<!-- GENERATED by build-flyer.mjs. Edit the script, not this file. -->
<html lang="en"><head><meta charset="utf-8">
<title>Sixfold Colorado — lawn aeration</title>
<style>
:root{
  ${T}
  --turf:#2F7A4F; --ember:#E4703A; --ink-soft:#4B554D;
  --serif:"Palatino Linotype","Book Antiqua",Palatino,"Iowan Old Style",Georgia,serif;
  --sans:"Segoe UI",ui-sans-serif,system-ui,Roboto,Helvetica,Arial,sans-serif;
  --mono:Consolas,"Cascadia Mono","Segoe UI Mono",ui-monospace,monospace;
}
@page{ size:11.25in ${(H / 96).toFixed(4)}in; margin:0 }
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:#202622;display:grid;place-items:start center;font-family:var(--sans)}
.sheet{width:1080px;height:${H}px;overflow:hidden;background:var(--ground);color:var(--ink);
       display:flex;flex-direction:column}

/* ---- masthead ---- */
.mast{padding:30px 60px 0;display:grid;grid-template-columns:auto 1fr auto;gap:22px;align-items:center}
.mast .mark{width:74px;color:var(--accent)}
.mast .mark svg{width:74px;height:71px;display:block}
.name{margin:0;font-family:var(--serif);font-size:46px;line-height:1;letter-spacing:-.015em}
.sub{margin:5px 0 0;font-family:var(--mono);font-size:14.5px;letter-spacing:.24em;
     text-transform:uppercase;color:var(--label)}
.where{margin:0;text-align:right;font-family:var(--mono);font-size:14px;letter-spacing:.16em;
       text-transform:uppercase;color:var(--muted);line-height:1.8}
.spine{margin:22px 60px 0;padding:13px 0;border-top:2px solid var(--hair);
       border-bottom:2px solid var(--hair);display:flex;justify-content:center;gap:34px;
       font-family:var(--mono);font-size:19px;letter-spacing:.3em;text-transform:uppercase;font-weight:700}
.spine i{font-style:normal;color:var(--ember)}

/* ---- statement ---- */
.say{padding:26px 60px 0;display:grid;grid-template-columns:1fr 348px;gap:34px;align-items:start}
h1{margin:0;font-family:var(--serif);font-weight:400;font-size:68px;line-height:.98;letter-spacing:-.025em}
h1 em{font-style:normal;color:var(--accent)}
.say p{margin:14px 0 0;font-size:21px;line-height:1.42;color:var(--muted)}
.tag{border:2px solid var(--ember);border-radius:14px;padding:20px 22px;background:rgba(228,112,58,.07)}
.tag b{display:block;font-family:var(--serif);font-weight:400;font-size:27px;line-height:1.24;color:var(--ink)}
.tag span{display:block;margin-top:10px;font-family:var(--mono);font-size:13.5px;letter-spacing:.16em;
          text-transform:uppercase;color:var(--ember);font-weight:700}

/* ---- drawing ---- */
.art{padding:24px 60px 0}
.art svg{display:block;width:960px;height:${artH}px}

/* ---- three columns ---- */
.cols{padding:24px 60px 0;display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.col{background:var(--card);color:#141A16;border:2px solid var(--card-edge);border-radius:16px;
     overflow:hidden;display:flex;flex-direction:column}
.col header{background:var(--head);color:var(--onhead);padding:14px 18px;display:flex;gap:12px;align-items:center}
.col header svg{width:34px;height:34px;flex:none;color:${day ? '#FFFFFF' : '#4FB878'}}
.col header b{font-family:var(--mono);font-size:22px;letter-spacing:.16em;text-transform:uppercase}
.col .kick{margin:0;padding:14px 18px 0;font-family:var(--serif);font-size:23px;line-height:1.16}
.col ul{margin:12px 0 0;padding:0 18px 18px;list-style:none;display:grid;gap:9px}
.col li{position:relative;padding-left:26px;font-size:16.5px;line-height:1.34;color:var(--ink-soft)}
.col li::before{content:"";position:absolute;left:1px;top:4px;width:13px;height:7px;
  border-left:3px solid var(--ember);border-bottom:3px solid var(--ember);transform:rotate(-45deg)}

/* ---- icon strip ---- */
.strip{margin-top:22px;padding:20px 60px;background:var(--strip);
       border-top:2px solid var(--hair);display:grid;grid-template-columns:repeat(5,1fr)}
.strip div{display:grid;justify-items:center;gap:10px;border-left:2px solid var(--hair);padding:0 8px}
.strip div:first-child{border-left:none}
.strip svg{width:40px;height:40px;color:var(--accent)}
.strip span{font-family:var(--mono);font-size:13px;letter-spacing:.11em;text-transform:uppercase;
            color:var(--muted);text-align:center}

/* ---- call bar ---- */
.bar{margin-top:auto;background:var(--ember);color:#1A0C04;padding:22px 60px 26px;
     display:grid;grid-template-columns:auto 1fr auto;gap:26px;align-items:center}
.bar .tel{margin:0;font-family:var(--serif);font-size:66px;line-height:1;letter-spacing:-.02em;white-space:nowrap}
.bar .cta{margin:4px 0 0;font-family:var(--mono);font-size:15.5px;letter-spacing:.14em;
          text-transform:uppercase;font-weight:700;color:#2A1408}
.bar .rule{width:2px;height:74px;background:rgba(26,12,4,.3)}
.bar .right{text-align:right}
.bar .web{margin:0;font-family:var(--mono);font-size:21px;letter-spacing:.06em;font-weight:700}
.bar .towns{margin:7px 0 0;font-family:var(--mono);font-size:12.5px;letter-spacing:.1em;
            text-transform:uppercase;color:rgba(26,12,4,.7);line-height:1.55}
</style></head>
<body>
<div class="sheet">

  <div class="mast">
    <div class="mark"><svg viewBox="0 0 100 96" role="img" aria-label="Sixfold"><path fill="currentColor" fill-rule="evenodd" d="${RIDGE}"/></svg></div>
    <div>
      <p class="name">Sixfold Colorado</p>
      <p class="sub">Lawn &amp; turf care</p>
    </div>
    <p class="where">Monument, Colorado<br>El Paso &middot; Teller &middot; S. Douglas</p>
  </div>

  <div class="spine"><span>Aerate</span><i>&bull;</i><span>Overseed</span><i>&bull;</i><span>Maintain</span></div>

  <div class="say">
    <div>
      <h1>Your lawn.<br><em>Our work.</em></h1>
      <p>Sixfold Colorado opens compacted ground with core aeration, seeds it while the holes are
      still open, and keeps it cut through the season &mdash; so the water you put on the lawn goes
      into it instead of off it.</p>
    </div>
    <!-- ⚑ THE DEAL SLOT. What is here is a bundle and a season, not a discount: there is
         still no aeration rate of Sixfold's own to discount from. One line to swap once
         there is. Never "free estimate" - barred, and the site auditor greps for it. -->
    <div class="tag">
      <b>Open ground.<br>Deeper roots.<br>Less runoff.</b>
      <span>Booking fall aeration</span>
    </div>
  </div>

  <div class="art">${art}</div>

  <div class="cols">
    ${COLUMNS.map(c => `<div class="col">
      <header><svg viewBox="0 0 44 44" aria-hidden="true">${c.icon}</svg><b>${c.key}</b></header>
      <p class="kick">${c.kicker}</p>
      <ul>${c.bullets.slice(0, bullets).map(b => `<li>${b}</li>`).join('')}</ul>
    </div>`).join('')}
  </div>

  ${strip ? `<div class="strip">
    ${STRIP.map(([label, icon]) => `<div><svg viewBox="0 0 44 44" aria-hidden="true">${icon}</svg><span>${label}</span></div>`).join('')}
  </div>` : ''}

  <div class="bar">
    <div>
      <p class="tel">(303) 915-1045</p>
      <p class="cta">Call and we will walk your lawn</p>
    </div>
    <div class="rule"></div>
    <div class="right">
      <p class="web">SixfoldColorado.com</p>
      <p class="towns">Monument &middot; Colorado Springs<br>Black Forest &middot; Palmer Lake &middot; Larkspur</p>
    </div>
  </div>

</div>
</body></html>`;
}

const BUILDS = [
  { name: 'lawn-sheet-ad',    H: 1350, bullets: 3, strip: false, artH: 428, artScale: 52 },
  { name: 'lawn-sheet-flyer', H: 1620, bullets: 5, strip: true,  artH: 498, artScale: 58 },
  /* Daylight cut of the ad, asked for 2026-09-25: "lighter palette, like sunshine
     and outdoors." Same structure, same words, sky over the cutaway and a sun in it. */
  { name: 'lawn-sheet-day',   H: 1350, bullets: 3, strip: false, artH: 428, artScale: 52, theme: 'day' },
  { name: 'lawn-sheet-day-flyer', H: 1620, bullets: 5, strip: true, artH: 498, artScale: 58, theme: 'day' },
];

for (const b of BUILDS) {
  const html = join(HERE, b.name + '.html');
  writeFileSync(html, page(b));
  const png = join(HERE, b.name + '.png');
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-color-profile=srgb', `--window-size=1080,${b.H}`, `--screenshot=${png}`,
    'file:///' + html.replace(/\\/g, '/')], { encoding: 'utf8' });
  console.log(r.status === 0 ? `${b.name}.png  1080x${b.H}` : `RENDER FAILED ${b.name}\n${r.stderr}`);
}
