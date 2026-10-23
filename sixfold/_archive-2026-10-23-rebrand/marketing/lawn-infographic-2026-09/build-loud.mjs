/* Sixfold Colorado — the loud cut, still and moving. 2026-09-25.

   Matthew asked what would make the sheet more eye-popping. Four answers were on
   the table; this builds the three I can do without a camera:

     1. MOTION. In a paid feed, movement beats a still. The drawing is generated,
        so it can be animated by a stylesheet rather than redrawn: the tine
        punches, the core lands on the turf, seed drops into the open holes, the
        deep roots grow, and the runoff sweeps off the packed side.
     2. BREAK THE FRAME. One big soil core, foreground, overlapping the top edge
        of the illustration panel and carrying the measurement. Nothing else on
        the sheet crosses a boundary, so the one thing that does draws the eye.
     3. TYPE SCALE. The headline goes to 96px and everything around it stays
        quiet. The earlier sheets were evenly weighted, which is why they read as
        calm rather than loud.

   The fourth answer is still the best one and it is not mine to do: a photograph
   of a real aeration job. PHOTOS.md §The turf gap.

   Run:  node build-loud.mjs
     lawn-loud.{html,png}   1080x1350, the still
     motion.html            the same sheet, animated, looping - open it to watch
     motion/frame-NN.png    8 frames of that loop for CapCut
*/

import { writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { cutaway } from './art.mjs';

const HERE = resolve('.');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const LOOP = 6;                       // seconds, one full cycle
const FRAMES = 8;                     // beats captured out of that cycle

const RIDGE = 'M18 84L18.3 83.4L18.3 84L18 84ZM25.7 83.1L28.65 83.1L28.26 84L25.7 84L25.7 83.1ZM28.73 62.53L36 48L40.23 56.46L33.11 72.83L29.17 68.1L32.53 68.1L28.73 62.53ZM30.86 75.6L31.91 75.6L31.59 76.33L30.86 75.6ZM30 84L30.39 83.1L38.36 83.1L32.81 77.54L33.65 75.6L35.42 75.6L34.26 74.21L50 38L55.2 49.96L42.29 84L30 84ZM44 84L66 26L70.71 38.42L58.34 84L44 84ZM60 84L79 14L98 84L60 84ZM9.5 81.5L17 74L12 74L18.25 66.5L14.5 66.5L22 55.5L29.5 66.5L25.75 66.5L32 74L27 74L34.5 81.5L24.1 81.5L24.1 84.5L19.9 84.5L19.9 81.5L9.5 81.5ZM4 86L96 86L96 91L4 91Z';

const ICON = {
  tines: `<g stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round">
            <path d="M10 8v18M22 8v18M34 8v18"/><path d="M6 31h32"/><path d="M13 36h6M25 36h6"/></g>`,
  seed: `<g fill="currentColor"><ellipse cx="14" cy="11" rx="4" ry="6" transform="rotate(-20 14 11)"/>
           <ellipse cx="26" cy="16" rx="4" ry="6" transform="rotate(15 26 16)"/></g>
         <g stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round">
           <path d="M8 28h28"/><path d="M18 28v9M26 28v9"/></g>`,
  mow: `<g stroke="currentColor" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round">
          <path d="M8 27h16l4-8h8v8h-4"/><path d="M32 19l4-9"/><circle cx="13" cy="33" r="5"/><circle cx="30" cy="33" r="4"/></g>`,
};

const COLUMNS = [
  { key: 'aerate', icon: ICON.tines, kick: 'Open the ground.',
    bullets: ['Core aeration, plugs two to three inches deep',
              'Compacted lawns, worn paths, high-traffic ground',
              'Plugs left on the surface to break back down'] },
  { key: 'overseed', icon: ICON.seed, kick: 'Put seed where it works.',
    bullets: ['Overseeding straight after the pass',
              'Seed into open holes, not onto thatch',
              'Fertilizer down with it'] },
  { key: 'maintain', icon: ICON.mow, kick: 'Keep it that way.',
    bullets: ['Mowing and edging',
              'Seasonal clean-up and haul-away',
              'Brush, plants and trees taken out'] },
];

/* The frame breaker: one core, foreground, carrying the measurement. It is the
   only element on the sheet that crosses a boundary, which is what makes it
   read. Drawn at the same 1:3.3 proportion as everything else. */
const heroPlug = `
<svg class="hero" viewBox="0 0 470 470" role="img" aria-label="A soil core, two to three inches long, held against a measure">
  <defs>
    <linearGradient id="hp" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#8A6A4C"/><stop offset=".45" stop-color="#6F5339"/>
      <stop offset="1" stop-color="#43321F"/></linearGradient>
    <linearGradient id="ht" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#63C98A"/><stop offset="1" stop-color="#2E7A4E"/></linearGradient>
    <filter id="hs" x="-40%" y="-20%" width="200%" height="150%">
      <feDropShadow dx="10" dy="16" stdDeviation="16" flood-color="#2A1C0E" flood-opacity=".42"/></filter>
  </defs>
  <g filter="url(#hs)" transform="translate(178 0) rotate(-9 150 235)">
    <g stroke="#63C98A" stroke-width="9" stroke-linecap="round" fill="none">
      <path d="M118 92 C104 58 88 40 68 26"/><path d="M146 84 C140 52 136 34 132 14"/>
      <path d="M176 86 C186 54 200 36 216 24"/>
    </g>
    <path d="M78 104 L78 388 Q78 424 150 432 Q222 424 222 388 L222 104 Z" fill="url(#hp)"/>
    <g stroke="rgba(0,0,0,.22)" stroke-width="6" stroke-linecap="round">
      <path d="M86 196 L214 186"/><path d="M84 286 L216 278"/><path d="M90 368 L210 360"/>
    </g>
    <ellipse cx="150" cy="104" rx="72" ry="26" fill="url(#ht)"/>
    <ellipse cx="150" cy="104" rx="72" ry="26" fill="none" stroke="#8FD6A9" stroke-width="4"/>
  </g>
  <g stroke="#16211B" stroke-width="4" fill="none" opacity=".72">
    <path d="M222 104 L222 432 M210 104 L234 104 M210 432 L234 432"/>
  </g>
  <text x="196" y="250" text-anchor="end" font-family="Palatino Linotype,Georgia,serif"
        font-size="62" fill="#16211B">2&ndash;3&Prime;</text>
  <text x="196" y="284" text-anchor="end" font-family="Consolas,monospace" font-size="17"
        letter-spacing="2.4" fill="rgba(22,33,27,.66)">EVERY PLUG</text>
</svg>`;

function sheet({ anim }) {
  const art = cutaway({ W: 960, H: 428, pxPerIn: 52, surface: 81, theme: 'day', badges: true, anim, idp: 'a' });

  const motionCss = `
/* ---- motion ------------------------------------------------------------
   One 6s loop, and every animation is exactly 6s so a single offset freezes
   the whole drawing at the same instant. That is what lets the frames come
   out of the same file the preview plays. */
.m-tine{animation:punch ${LOOP}s cubic-bezier(.5,0,.3,1) infinite}
@keyframes punch{
  0%,6%   {transform:translateY(-130px)}
  20%,30% {transform:translateY(0)}
  46%,100%{transform:translateY(-130px)}
}
.m-plug{animation:land ${LOOP}s ease-out infinite}
@keyframes land{
  0%,30%  {opacity:0;transform:translateY(-26px) scale(.9)}
  40%,100%{opacity:1;transform:translateY(0) scale(1)}
}
.m-seed{animation:sow ${LOOP}s ease-in infinite}
@keyframes sow{
  0%,42%  {opacity:0;transform:translateY(-34px)}
  56%,100%{opacity:1;transform:translateY(0)}
}
.m-roots{transform-box:fill-box;transform-origin:50% 0;animation:grow ${LOOP}s ease-out infinite}
@keyframes grow{ 0%,48%{transform:scaleY(.3)} 82%,100%{transform:scaleY(1)} }
.m-rain{animation:fall ${LOOP}s linear infinite}
@keyframes fall{
  0%  {transform:translateY(-46px);opacity:0}
  8%  {opacity:1}
  26% {transform:translateY(54px);opacity:0}
  100%{transform:translateY(54px);opacity:0}
}
.m-rain:nth-of-type(2n){animation-delay:-1.4s}
.m-rain:nth-of-type(3n){animation-delay:-2.6s}
.m-runoff{animation:sweep ${LOOP}s ease-in-out infinite}
@keyframes sweep{
  0%  {stroke-dashoffset:420;opacity:.2}
  18% {stroke-dashoffset:0;opacity:.95}
  40% {stroke-dashoffset:-420;opacity:0}
  100%{stroke-dashoffset:-420;opacity:0}
}
/* Freezing: one variable moves every animation to the same instant, and pausing
   makes the screenshot deterministic instead of a race with the renderer. */
.frozen .m-tine,.frozen .m-plug,.frozen .m-seed,.frozen .m-roots,
.frozen .m-rain,.frozen .m-runoff{
  animation-play-state:paused !important;
  animation-delay:calc(var(--t, 0) * -1s) !important;
}
@media (prefers-reduced-motion:reduce){
  .m-tine,.m-plug,.m-seed,.m-roots,.m-rain,.m-runoff{animation:none}
}`;

  return `<!doctype html>
<!-- GENERATED by build-loud.mjs. Edit the script, not this file. -->
<html lang="en"><head><meta charset="utf-8">
<title>Sixfold Colorado — lawn aeration</title>
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
       display:flex;flex-direction:column;position:relative}

.mast{padding:28px 60px 0;display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center}
.mast .mark{width:66px;color:var(--accent)}
.mast .mark svg{width:66px;height:63px;display:block}
.name{margin:0;font-family:var(--serif);font-size:40px;line-height:1;letter-spacing:-.015em}
.sub{margin:4px 0 0;font-family:var(--mono);font-size:13.5px;letter-spacing:.24em;
     text-transform:uppercase;color:var(--label)}
.where{margin:0;text-align:right;font-family:var(--mono);font-size:13px;letter-spacing:.16em;
       text-transform:uppercase;color:var(--muted);line-height:1.8}
.spine{margin:18px 60px 0;padding:11px 0;border-top:2px solid var(--hair);border-bottom:2px solid var(--hair);
       display:flex;justify-content:center;gap:30px;font-family:var(--mono);font-size:17px;
       letter-spacing:.3em;text-transform:uppercase;font-weight:700}
.spine i{font-style:normal;color:var(--ember)}

/* the type scale is the point: one very large thing, everything else quiet */
.say{padding:24px 60px 0;display:grid;grid-template-columns:1fr 300px;gap:30px;align-items:start}
h1{margin:0;font-family:var(--serif);font-weight:400;font-size:96px;line-height:.92;letter-spacing:-.035em}
h1 em{font-style:normal;color:var(--accent)}
.say p{margin:14px 0 0;font-size:19.5px;line-height:1.4;color:var(--muted);max-width:540px}
.tag{border:2px solid var(--ember);border-radius:14px;padding:16px 18px;background:rgba(228,112,58,.08)}
.tag b{display:block;font-family:var(--serif);font-weight:400;font-size:24px;line-height:1.22}
.tag span{display:block;margin-top:8px;font-family:var(--mono);font-size:12.5px;letter-spacing:.16em;
          text-transform:uppercase;color:#B8501E;font-weight:700}

.art{padding:18px 60px 0;position:relative}
/* scoped: .art svg would also catch the hero core and stretch it to panel size */
.art > svg:not(.hero){display:block;width:960px;height:428px;border-radius:22px}

/* the frame breaker */
.hero{position:absolute;right:6px;top:-132px;width:306px;height:306px;z-index:3;overflow:visible}

.cols{padding:22px 60px 0;position:relative;z-index:1;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.col{background:var(--card);border:2px solid var(--card-edge);border-radius:16px;overflow:hidden;
     display:flex;flex-direction:column}
.col header{background:var(--head);color:#fff;padding:13px 16px;display:flex;gap:11px;align-items:center}
.col header svg{width:32px;height:32px;flex:none;color:#fff}
.col header b{font-family:var(--mono);font-size:20px;letter-spacing:.16em;text-transform:uppercase}
.col .kick{margin:0;padding:13px 16px 0;font-family:var(--serif);font-size:22px;line-height:1.16}
.col ul{margin:10px 0 0;padding:0 16px 16px;list-style:none;display:grid;gap:8px}
.col li{position:relative;padding-left:24px;font-size:16px;line-height:1.32;color:#4B554D}
.col li::before{content:"";position:absolute;left:1px;top:4px;width:12px;height:6px;
  border-left:3px solid var(--ember);border-bottom:3px solid var(--ember);transform:rotate(-45deg)}

.bar{margin-top:auto;background:var(--ember);color:#1A0C04;padding:20px 60px 24px;
     display:grid;grid-template-columns:auto 1fr auto;gap:24px;align-items:center}
.bar .tel{margin:0;font-family:var(--serif);font-size:62px;line-height:1;letter-spacing:-.02em;white-space:nowrap}
.bar .cta{margin:4px 0 0;font-family:var(--mono);font-size:14.5px;letter-spacing:.14em;
          text-transform:uppercase;font-weight:700;color:#2A1408}
.bar .rule{width:2px;height:68px;background:rgba(26,12,4,.3)}
.bar .right{text-align:right}
.bar .web{margin:0;font-family:var(--mono);font-size:20px;letter-spacing:.06em;font-weight:700}
.bar .towns{margin:6px 0 0;font-family:var(--mono);font-size:12px;letter-spacing:.1em;
            text-transform:uppercase;color:rgba(26,12,4,.7);line-height:1.55}
${anim ? motionCss : ''}
</style></head>
<body>
<div class="sheet">

  <div class="mast">
    <div class="mark"><svg viewBox="0 0 100 96" role="img" aria-label="Sixfold"><path fill="currentColor" fill-rule="evenodd" d="${RIDGE}"/></svg></div>
    <div><p class="name">Sixfold Colorado</p><p class="sub">Lawn &amp; turf care</p></div>
    <p class="where">Monument, Colorado<br>El Paso &middot; Teller &middot; S. Douglas</p>
  </div>

  <div class="spine"><span>Aerate</span><i>&bull;</i><span>Overseed</span><i>&bull;</i><span>Maintain</span></div>

  <div class="say">
    <div>
      <h1>Your lawn.<br><em>Our work.</em></h1>
      <p>Core aeration opens compacted ground, seed goes in while the holes are still open, and
      we keep it cut through the season.</p>
    </div>
    <!-- ⚑ THE DEAL SLOT. A bundle and a season, not a discount - there is still no
         aeration rate of Sixfold's own to discount from. Never "free estimate". -->
    <div class="tag">
      <b>Open ground.<br>Deeper roots.<br>Less runoff.</b>
      <span>Booking fall aeration</span>
    </div>
  </div>

  <div class="art">
    ${art}
    ${heroPlug}
  </div>

  <div class="cols">
    ${COLUMNS.map(c => `<div class="col">
      <header><svg viewBox="0 0 44 44" aria-hidden="true">${c.icon}</svg><b>${c.key}</b></header>
      <p class="kick">${c.kick}</p>
      <ul>${c.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
    </div>`).join('')}
  </div>

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

const shot = (html, png, extra = []) => spawnSync(CHROME, ['--headless=new', '--disable-gpu',
  '--hide-scrollbars', '--force-color-profile=srgb', '--window-size=1080,1350',
  ...extra, `--screenshot=${png}`, 'file:///' + html.replace(/\\/g, '/')], { encoding: 'utf8' });

/* --- the still ----------------------------------------------------------- */
const stillHtml = join(HERE, 'lawn-loud.html');
writeFileSync(stillHtml, sheet({ anim: false }));
let r = shot(stillHtml, join(HERE, 'lawn-loud.png'));
console.log(r.status === 0 ? 'lawn-loud.png  1080x1350' : 'FAILED still\n' + r.stderr);

/* --- the loop, and frames out of it -------------------------------------- */
const motion = sheet({ anim: true });
writeFileSync(join(HERE, 'motion.html'), motion);
console.log('motion.html  (open it to watch the loop)');

mkdirSync(join(HERE, 'motion'), { recursive: true });
for (let i = 0; i < FRAMES; i++) {
  const t = (i * LOOP / FRAMES).toFixed(3);
  const frozen = motion
    .replace('<div class="sheet">', `<div class="sheet frozen" style="--t:${t}">`)
    .replace('<body>', '<body>');
  const tmp = join(HERE, `_f${i}.html`);
  writeFileSync(tmp, frozen);
  const out = join(HERE, 'motion', `frame-${String(i + 1).padStart(2, '0')}.png`);
  r = shot(tmp, out, ['--virtual-time-budget=900']);
  spawnSync('cmd', ['/c', 'del', tmp.replace(/\//g, '\\')]);
  if (r.status !== 0) console.error('FAILED frame ' + i + '\n' + r.stderr);
}
console.log(`motion/  ${FRAMES} frames at ${(LOOP / FRAMES).toFixed(2)}s each`);
