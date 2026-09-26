/* Sixfold Colorado — the photo-column sheet. 2026-09-25.

   Matthew: make something like the Land & Fire ad we posted to Facebook, using the
   images we have instead of the drawn cutaway.

   So this is that sheet's architecture, carried straight over:
     photo band with the mark and the three-verb spine
     statement + paragraph + tagline block
     THREE PHOTO COLUMNS, each with a labelled bar across the photo and a ticked list
     a five-service icon strip
     the orange call bar

   And these are the differences, each one deliberate:
     NO DRAWN CUTAWAY. The photographs do the work here; the drawing sheet is
       lawn-photo.png and it still exists for the version that teaches.
     NO "FREE ESTIMATES". Barred in this repo, and site/audit-links.mjs greps for it.
     NO STUMP GRINDING. Retired in the quote engine 2026-09-23.
     One type system, no grunge, no brush script, no shadowed type.

   ⚑ "LAND & FIRE" IS BACK, 2026-09-25 — Matthew's call, and it REVERSES the rule
     that stood here ("NO LAND & FIRE. The descriptor names the demoted service.").
     He asked for the full lockup: Sixfold Colorado / Land & Fire / "From the lawn to
     the treeline, all year long." This is a deliberate override, not a regression —
     do not "fix" it back without asking him.
     Worth knowing when it next comes up: brand/tagline-2026-09/ recommends retiring
     the descriptor, and Phase 1 of REBRAND-PATH-2026-09.md makes it Brandon's call.
     The tension is on the sheet itself — the descriptor says fire, the tagline says
     lawn-to-treeline. Nothing is printed, so it stays free to change.

   Words are the lawn-sheet-day copy, which is the set he picked.

   Run:  node build-columns.mjs
     lawn-columns-ad.{html,png}     1080x1350  (4:5, the Facebook ad)
     lawn-columns-flyer.{html,png}  1080x1620  (2:3, print and leave-behind)
*/

import { writeFileSync, readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const HERE = resolve('.');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const LIB = '../../site/assets/img';

/* ---- photo slots: same folder, same stem rule as build-photo.mjs ---------- */
mkdirSync(join(HERE, 'photos'), { recursive: true });
const POOL = readdirSync(join(HERE, 'photos'), { withFileTypes: true })
  .filter(e => e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name)).map(e => e.name);
const UNLICENSED = (() => {
  try {
    return new Set(readFileSync(join(HERE, 'photos/UNLICENSED.txt'), 'utf8')
      .split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')));
  } catch { return new Set(); }
})();
function slot(stem, fallback, focal = '50% 50%') {
  const hit = POOL.filter(n => n.toLowerCase().startsWith(stem) && !n.startsWith('_'))
    .sort((a, b) => a.length - b.length)[0];
  return { src: hit ? `photos/${hit}` : `${LIB}/${fallback}`, focal,
           real: Boolean(hit), comp: Boolean(hit) && UNLICENSED.has(stem) };
}
const HERO = slot('hero', 'trimming.jpg', '50% 58%');

const ICON = {
  tines: `<g stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round">
            <path d="M10 8v18M22 8v18M34 8v18"/><path d="M6 31h32"/><path d="M13 36h6M25 36h6"/></g>`,
  seed: `<g fill="currentColor"><ellipse cx="14" cy="11" rx="4" ry="6" transform="rotate(-20 14 11)"/>
           <ellipse cx="26" cy="16" rx="4" ry="6" transform="rotate(15 26 16)"/></g>
         <g stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round">
           <path d="M8 28h28"/><path d="M18 28v9M26 28v9"/></g>`,
  mow: `<g stroke="currentColor" stroke-width="3.2" fill="none" stroke-linejoin="round" stroke-linecap="round">
          <path d="M8 27h16l4-8h8v8h-4"/><path d="M32 19l4-9"/><circle cx="13" cy="33" r="5"/><circle cx="30" cy="33" r="4"/></g>`,
  core: `<rect x="15" y="7" width="14" height="30" rx="7" fill="currentColor"/>
         <rect x="15" y="7" width="14" height="10" rx="5" fill="#4FB878"/>`,
  feed: `<g stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round">
           <path d="M13 12h18l3 13H10z"/><path d="M8 31h28"/></g>
         <g fill="currentColor"><circle cx="16" cy="36" r="2"/><circle cx="23" cy="38" r="2"/><circle cx="30" cy="36" r="2"/></g>`,
  haul: `<g stroke="currentColor" stroke-width="3.2" fill="none" stroke-linejoin="round" stroke-linecap="round">
           <path d="M7 28V16h18v12"/><path d="M25 21h7l4 7v0h-11"/><path d="M7 28h29"/>
           <circle cx="14" cy="33" r="4"/><circle cx="29" cy="33" r="4"/></g>`,
};

const COLUMNS = [
  { key: 'Aerate', icon: ICON.tines, photo: slot('aerate', 'stand.jpg', '50% 55%'),
    kick: 'Open the ground.',
    bullets: ['Core aeration, plugs two to three inches deep',
              'Compacted lawns, worn paths, high-traffic ground',
              'Plugs left on the surface to break back down',
              'Walked and counted before anything is quoted'] },
  { key: 'Overseed', icon: ICON.seed, photo: slot('seed', 'beds.jpg', '50% 50%'),
    kick: 'Put seed where it works.',
    bullets: ['Overseeding straight after the pass',
              'Seed into open holes, not onto thatch',
              'Fertilizer down with it',
              'Thin patches and worn strips'] },
  { key: 'Maintain', icon: ICON.mow, photo: slot('mow', 'limbing.jpg', '50% 55%'),
    kick: 'Keep it that way.',
    bullets: ['Mowing and edging',
              'Seasonal clean-up and haul-away',
              'Brush, plants and trees taken out',
              'Land clearing when the lot needs it'] },
];

const GLYPH = {
  aeration: `<g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 9v13M17 9v13M25 9v13"/>
      <path d="M9 22h8M17 22h8"/>
      <path d="M5 30h34"/>
    </g>
    <g fill="#fff"><rect x="28" y="24" width="12" height="5" rx="2.5" transform="rotate(-12 34 26)"/>
      <rect x="30" y="31" width="11" height="5" rx="2.5" transform="rotate(8 35 33)"/></g>`,
  seed: `<g fill="#fff"><ellipse cx="13" cy="9" rx="3" ry="4.4" transform="rotate(-18 13 9)"/>
      <ellipse cx="22" cy="6" rx="3" ry="4.4" transform="rotate(10 22 6)"/>
      <ellipse cx="31" cy="10" rx="3" ry="4.4" transform="rotate(-8 31 10)"/></g>
    <g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">
      <path d="M6 26h32"/><path d="M14 26v9M27 26v9"/></g>
    <g fill="#fff"><circle cx="14" cy="20" r="2.4"/><circle cx="27" cy="19" r="2.4"/></g>`,
  feed: `<g fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M15 11h14l3 15a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2z"/>
      <path d="M17 11a5 5 0 0 1 10 0"/>
    </g>
    <g fill="#fff"><circle cx="13" cy="35" r="2.2"/><circle cx="22" cy="37" r="2.2"/><circle cx="31" cy="35" r="2.2"/></g>`,
  mow: `<g fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M7 27h13l4-9h9v9h-5"/>
      <path d="M33 18l5-9"/>
      <circle cx="12" cy="32" r="5"/><circle cx="29" cy="32" r="4"/>
      <path d="M4 39h36"/>
    </g>`,
  haul: `<g fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <path d="M6 27V15h17v12"/><path d="M23 19h6l5 8h-11"/><path d="M6 27h28"/>
      <circle cx="13" cy="32" r="4"/><circle cx="28" cy="32" r="4"/>
    </g>
    <g fill="#fff"><rect x="9" y="10" width="5" height="5" rx="1.6" transform="rotate(-14 11 12)"/>
      <rect x="15" y="8" width="5" height="5" rx="1.6" transform="rotate(10 17 10)"/></g>`,
};

const STRIP = [['Lawn aeration', GLYPH.aeration], ['Overseeding', GLYPH.seed],
               ['Fertilizing', GLYPH.feed], ['Mowing & edging', GLYPH.mow],
               ['Clean-up & haul', GLYPH.haul]];

const RIDGE = 'M18 84L18.3 83.4L18.3 84L18 84ZM25.7 83.1L28.65 83.1L28.26 84L25.7 84L25.7 83.1ZM28.73 62.53L36 48L40.23 56.46L33.11 72.83L29.17 68.1L32.53 68.1L28.73 62.53ZM30.86 75.6L31.91 75.6L31.59 76.33L30.86 75.6ZM30 84L30.39 83.1L38.36 83.1L32.81 77.54L33.65 75.6L35.42 75.6L34.26 74.21L50 38L55.2 49.96L42.29 84L30 84ZM44 84L66 26L70.71 38.42L58.34 84L44 84ZM60 84L79 14L98 84L60 84ZM9.5 81.5L17 74L12 74L18.25 66.5L14.5 66.5L22 55.5L29.5 66.5L25.75 66.5L32 74L27 74L34.5 81.5L24.1 81.5L24.1 84.5L19.9 84.5L19.9 81.5L9.5 81.5ZM4 86L96 86L96 91L4 91Z';

const comp = (p) => p.comp
  ? '<span class="ph">Comp &middot; not licensed &middot; do not publish</span>' : '';

function page({ H, bandH, shotH, bullets, strip, vertical = false, theme = 'day' }) {
  const dark = theme === 'dark';
  const T = dark ? `
  --ground:#0E1512; --ink:#EDE7DC; --muted:rgba(237,231,220,.76); --hair:rgba(237,231,220,.14);
  --card:#18211C; --card-edge:rgba(237,231,220,.12); --card-ink:#EDE7DC;
  --card-muted:rgba(237,231,220,.72); --head:#2F7A4F; --accent:#4FB878; --strip:#141C18;` : `
  --ground:#FBF7ED; --ink:#16211B; --muted:#4F5C53; --hair:rgba(22,33,27,.16);
  --card:#FFFFFF; --card-edge:#E7E0D1; --card-ink:#141A16;
  --card-muted:#4B554D; --head:#2F7A4F; --accent:#2F7A4F; --strip:#F1EADB;`;
  return `<!doctype html>
<!-- GENERATED by build-columns.mjs. Edit the script, not this file. -->
<html lang="en"><head><meta charset="utf-8">
<title>Sixfold Colorado — lawn aeration</title>
<style>
:root{
  ${T}
  --ember:#E4703A; --pine:#0E1512;
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
img{filter:saturate(.92);display:block}

/* ---- the band ---- */
.band{position:relative;height:${bandH}px;flex:none;overflow:hidden;background:var(--pine)}
.band>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${HERO.focal}}
.band .veil{position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(8,14,11,.80) 0%,rgba(8,14,11,.30) 48%,rgba(8,14,11,.88) 100%)}
.band .in{position:absolute;inset:0;padding:26px 60px;display:flex;flex-direction:column;
          justify-content:space-between;color:#EDE7DC}
.top{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center}
.top .mark{width:62px;color:#8FD6A9}
.top .mark svg{width:62px;height:59px}
.name{margin:0;font-family:var(--serif);font-size:38px;line-height:1}
.sub{margin:3px 0 0;font-family:var(--mono);font-size:12.5px;letter-spacing:.24em;
     text-transform:uppercase;color:#9ED8B4}
.where{margin:0;text-align:right;font-family:var(--mono);font-size:12px;letter-spacing:.16em;
       text-transform:uppercase;color:rgba(237,231,220,.74);line-height:1.8}
.offer{border-top:2px solid rgba(237,231,220,.28);padding-top:13px;display:grid;gap:9px}
.what{margin:0;text-align:center;font-family:var(--sans);font-size:19px;line-height:1.3;
      color:#F2EFE7;font-weight:600}
.spine{display:flex;gap:24px;justify-content:center;font-family:var(--mono);font-size:15px;
       letter-spacing:.28em;text-transform:uppercase;font-weight:700;color:rgba(237,231,220,.8)}
.spine i{font-style:normal;color:var(--ember)}
/* The tagline, added 2026-09-25. Serif italic so it reads as the brand line rather
   than a fourth list: .what is a service list and .spine is a process, both set in
   sans and mono. It closes the band, which is where a tagline belongs — with the
   identity, not in the deal slot. */
.tagline{margin:0;text-align:center;font-family:var(--serif);font-style:italic;
         font-size:${vertical ? 30 : 23}px;line-height:1.25;color:#EDE7DC;
         letter-spacing:.005em}

/* ---- statement ---- */
.say{padding:22px 60px 0;display:grid;grid-template-columns:1fr 300px;gap:28px;align-items:start}
.v .say{grid-template-columns:1fr;gap:20px}
.v h1{font-size:76px}
.v .say p{font-size:23px}
.v .tag{display:grid;grid-template-columns:1fr auto;gap:10px 26px;align-items:center}
.v .tag .eyebrow{grid-column:1/-1}
.v .tag b{font-size:44px;margin-top:0}
.v .tag .rates{justify-self:end;margin:0}
.v .tag .note{grid-column:1;font-size:17px}
.v .tag .call{grid-column:2;margin:0;font-size:46px;white-space:nowrap}
.v .strip{padding:20px 40px 22px}
.v .strip .disc{width:70px;height:70px}
.v .strip .disc svg{width:40px;height:40px}
.v .trust{font-size:17px}
.v .bar .tel{font-size:70px}
h1{margin:0 0 12px;font-family:var(--serif);font-weight:400;font-size:58px;line-height:.98;
   letter-spacing:-.028em}
h1 em{font-style:normal;color:var(--accent)}
.say p{margin:0;font-size:19.5px;line-height:1.42;color:var(--muted)}
/* The one element allowed to shout. Solid ember, white type, a shadow so it sits
   above the sheet rather than in it — it is the thing the whole ad is asking for. */
.tag{background:var(--ember);border-radius:16px;padding:18px 20px 20px;color:#fff;
     box-shadow:0 10px 26px rgba(196,85,31,.34)}
.tag .eyebrow{margin:0;font-family:var(--mono);font-size:12px;letter-spacing:.18em;
              text-transform:uppercase;color:rgba(255,255,255,.88);font-weight:700}
.tag b{display:block;margin-top:9px;font-family:var(--serif);font-weight:400;font-size:36px;
       line-height:1.02;letter-spacing:-.025em;color:#fff}
.tag .rates{margin:11px 0 0;display:inline-block;background:#fff;color:#B8501E;
            font-family:var(--mono);font-size:13px;letter-spacing:.1em;text-transform:uppercase;
            font-weight:700;padding:7px 12px;border-radius:999px}
.tag .note{margin:11px 0 0;font-size:15px;line-height:1.36;color:rgba(255,255,255,.92)}
.tag .call{margin:12px 0 0;font-family:var(--serif);font-size:32px;line-height:1;
           letter-spacing:-.01em;color:#fff}

/* ---- stacked rows, 9:16 only ---- */
.rows{padding:20px 60px 0;display:grid;gap:16px}
.rows .col{flex-direction:row;align-items:stretch}
.rows .shot{width:300px;height:auto;flex:none}
.rows .shot .label{padding:9px 12px}
.rows .shot .label b{font-size:18px;letter-spacing:.14em}
.rows .col .body{padding:16px 22px 18px;display:grid;align-content:center;gap:0}
.rows .col .kick{padding:0;font-size:27px}
.rows .col ul{margin:11px 0 0;padding:0;gap:8px}
.rows .col li{font-size:17px}

/* ---- the three photo columns ---- */
.cols{padding:22px 60px 0;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.col{background:var(--card);color:var(--card-ink);border:2px solid var(--card-edge);
     border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
.shot{position:relative;height:${shotH}px;flex:none;background:var(--pine)}
.shot img{width:100%;height:100%;object-fit:cover}
.shot .label{position:absolute;left:0;right:0;bottom:0;background:var(--head);color:#fff;
             padding:10px 14px;display:flex;align-items:center;gap:11px}
.shot .label svg{width:30px;height:30px;flex:none;color:#fff}
.shot .label b{font-family:var(--mono);font-size:21px;letter-spacing:.16em;text-transform:uppercase}
.col .body{display:contents}
.col .kick{margin:0;padding:14px 16px 0;font-family:var(--serif);font-size:23px;line-height:1.14}
.col ul{margin:11px 0 0;padding:0 16px 16px;list-style:none;display:grid;gap:8px}
.col li{position:relative;padding-left:25px;font-size:16px;line-height:1.33;color:var(--card-muted)}
.col li::before{content:"";position:absolute;left:1px;top:4px;width:12px;height:7px;
  border-left:3px solid var(--ember);border-bottom:3px solid var(--ember);transform:rotate(-45deg)}

/* ---- icon strip ---- */
.strip{margin-top:20px;padding:20px 60px 22px;background:var(--strip);border-top:2px solid var(--hair);
       display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.strip div{display:grid;justify-items:center;gap:11px;padding:0 4px}
.strip .disc{width:62px;height:62px;border-radius:50%;background:var(--head);display:grid;
             place-items:center;box-shadow:0 5px 14px rgba(28,74,48,.26)}
.strip .disc svg{color:#fff}
.strip .disc svg{width:36px;height:36px;display:block}
.strip span{font-family:var(--mono);font-size:12.5px;letter-spacing:.1em;text-transform:uppercase;
            color:var(--ink);font-weight:700;text-align:center;line-height:1.35}

.ph{position:absolute;left:0;right:0;top:0;z-index:2;background:#C22A1F;color:#FFF3EF;
    font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;
    font-weight:700;padding:5px 8px;text-align:center}

.trust{margin:0;padding:12px 60px;list-style:none;display:flex;justify-content:space-between;
       gap:20px;background:var(--head);color:#fff}
.trust li{position:relative;padding-left:26px;font-family:var(--sans);font-size:15.5px;
          font-weight:600;letter-spacing:.01em}
.trust li::before{content:"";position:absolute;left:0;top:5px;width:13px;height:7px;
  border-left:3px solid #fff;border-bottom:3px solid #fff;transform:rotate(-45deg)}

/* ---- call bar ---- */
.bar{margin-top:auto;background:var(--ember);color:#1A0C04;padding:18px 60px 20px;
     display:grid;grid-template-columns:auto 1fr auto;gap:24px;align-items:center}
.bar .tel{margin:0;font-family:var(--serif);font-size:62px;line-height:1;letter-spacing:-.02em;white-space:nowrap}
.bar .cta{margin:4px 0 0;font-family:var(--mono);font-size:14.5px;letter-spacing:.14em;
          text-transform:uppercase;font-weight:700;color:#2A1408}
.bar .rule{width:2px;height:66px;background:rgba(26,12,4,.3)}
.bar .right{text-align:right}
.bar .web{margin:0;font-family:var(--mono);font-size:20px;letter-spacing:.06em;font-weight:700}
.bar .mail{margin:5px 0 0;font-family:var(--mono);font-size:15.5px;letter-spacing:.04em;
           font-weight:700;color:#2A1408}
.bar .towns{margin:6px 0 0;font-family:var(--mono);font-size:12px;letter-spacing:.1em;
            text-transform:uppercase;color:rgba(26,12,4,.7);line-height:1.55}
</style></head>
<body>
<div class="sheet${vertical ? ' v' : ''}">

  <div class="band">
    <img src="${HERO.src}" alt="">
    <div class="veil"></div>
    <div class="in">
      <div class="top">
        <div class="mark"><svg viewBox="0 0 100 96" role="img" aria-label="Sixfold"><path fill="currentColor" fill-rule="evenodd" d="${RIDGE}"/></svg></div>
        <div><p class="name">Sixfold Colorado</p><p class="sub">Land &amp; Fire</p></div>
        <p class="where">Monument, Colorado<br>El Paso &middot; Teller &middot; S. Douglas</p>
      </div>
      <div class="offer">
        <p class="what">Core aeration &middot; Overseeding &middot; Fertilizing &middot; Mowing &amp; edging &middot; Clean-up</p>
        <div class="spine"><span>Aerate</span><i>&bull;</i><span>Overseed</span><i>&bull;</i><span>Maintain</span></div>
        <p class="tagline">From the lawn to the treeline, all year long.</p>
      </div>
    </div>
    ${comp(HERO)}
  </div>

  <div class="say">
    <div>
      <h1>Your lawn.<br><em>Our work.</em></h1>
      <p>Sixfold Colorado opens compacted ground with core aeration, seeds it while the holes
      are still open, and keeps it cut through the season &mdash; so the water you put on the
      lawn goes into it instead of off it.</p>
    </div>
    <!-- ⚑ THE DEAL SLOT. A bundle and a season, not a discount - there is still no
         aeration rate of Sixfold's own to discount from. Never "free estimate":
         the old sheet carried it and this repo bars it. -->
    <div class="tag">
      <p class="eyebrow">Booking fall aeration</p>
      <b>Free quote on<br>your lawn.</b>
      <p class="rates">Great end-of-summer rates</p>
      <p class="note">We walk the property with you, count what is actually there, and price
      it from that.</p>
      <p class="call">(303) 915-1045</p>
    </div>
  </div>

  <div class="${vertical ? 'rows' : 'cols'}">
    ${COLUMNS.map(c => `<div class="col">
      <div class="shot">
        <img src="${c.photo.src}" alt="" style="object-position:${c.photo.focal}">
        ${comp(c.photo)}
        <div class="label"><svg viewBox="0 0 44 44" aria-hidden="true">${c.icon}</svg><b>${c.key}</b></div>
      </div>
      <div class="body">
        <p class="kick">${c.kick}</p>
        <ul>${c.bullets.slice(0, bullets).map(b => `<li>${b}</li>`).join('')}</ul>
      </div>
    </div>`).join('')}
  </div>

  ${strip ? `<div class="strip">
    ${STRIP.map(([l, i]) => `<div><span class="disc"><svg viewBox="0 0 44 44" aria-hidden="true">${i}</svg></span><span>${l}</span></div>`).join('')}
  </div>` : ''}

  <!-- Every line here is a claim Sixfold can stand behind: where it is based, how it
       quotes, and what the customer is handed at the end. No "licensed", "insured",
       "certified" or "bonded" — none of those is true yet. -->
  <ul class="trust">
    <li>Monument-based</li>
    <li>We walk it before we price it</li>
    <li>Written scope, photos, itemised invoice</li>
  </ul>

  <div class="bar">
    <div><p class="tel">(303) 915-1045</p><p class="cta">Call or email for a free quote</p></div>
    <div class="rule"></div>
    <div class="right">
      <p class="web">SixfoldColorado.com</p>
      <p class="mail">Contact@SixfoldColorado.com</p>
      <p class="towns">Monument &middot; Colorado Springs &middot; Black Forest &middot; Palmer Lake</p>
    </div>
  </div>

</div>
</body></html>`;
}

const BUILDS = [
  { name: 'lawn-columns-ad',    H: 1350, bandH: 284, shotH: 182, bullets: 3, strip: true },
  { name: 'lawn-columns-flyer', H: 1620, bandH: 330, shotH: 226, bullets: 4, strip: true },
  /* Reels and Stories. Built 2026-09-25 — the 4:5 sheet cropped to 9:16 loses the
     call bar entirely, so it is a re-layout, not a crop. */
  { name: 'lawn-columns-story', H: 1920, bandH: 486, shotH: 0, bullets: 2, strip: true, vertical: true },
];

for (const b of [...BUILDS, ...BUILDS.map(b => ({ ...b, name: b.name + '-dark', theme: 'dark' }))]) {
  const html = join(HERE, b.name + '.html');
  writeFileSync(html, page(b));
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-color-profile=srgb', `--window-size=1080,${b.H}`, '--virtual-time-budget=1500',
    `--screenshot=${join(HERE, b.name + '.png')}`, 'file:///' + html.replace(/\\/g, '/')],
    { encoding: 'utf8' });
  console.log(r.status === 0 ? `${b.name}.png  1080x${b.H}` : `FAILED ${b.name}\n${r.stderr}`);
}
const comps = [HERO, ...COLUMNS.map(c => c.photo)].filter(p => p.comp).length;
if (comps) console.log(`\n  ⚑ ${comps} photo(s) flagged unlicensed — see photos/UNLICENSED.txt`);
