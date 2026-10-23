/* Sixfold Colorado — aeration video frames.

   Builds:
     frames.html          review page, every frame at 9:16 with the Reels safe
                          areas drawn over it
     out/9x16/NN-*.png    1080x1920 — Reels, Stories, and the vertical feed cut
     out/4x5/NN-*.png     1080x1350 — the 4:5 feed cut, same content reflowed

   Run:  node build-frames.mjs

   The frame TEXT lives here and nowhere else. README.md quotes it; if the two
   ever disagree, this file is right and the README is stale.

   Why frames and not footage: no aeration footage exists, none is being shot
   before the weekend, and every photograph in the library is trees, slash or
   cleared ground. Matthew, 2026-09-25. Drawings are the honest substitute —
   they illustrate rather than pretend to document, which a stock lawn photo
   would not. */

import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HERE = resolve('.');

/* ---------------------------------------------------------------- drawings */
/* Proportion matters more than polish here. A real core is about 3/4 in across
   and 2-3 in long, so the plug is drawn near 1:3.3. Matthew has asked before
   whether a drawn core matched the real tool; it does. */

const plug = (h) => `
<svg viewBox="0 -14 240 774" height="${h}" role="img" aria-label="A soil core, grass on top">
  <g stroke="var(--moss)" stroke-width="8" stroke-linecap="round" fill="none">
    <path d="M72 56 C60 24 48 10 34 0"/><path d="M98 48 C92 20 88 8 84 -6"/>
    <path d="M120 44 C122 18 124 6 126 -10"/><path d="M144 48 C152 20 160 8 172 -2"/>
    <path d="M168 58 C182 30 196 18 210 10"/>
  </g>
  <path d="M25 70 L25 636 Q25 702 120 716 Q215 702 215 636 L215 70 Z" fill="var(--soil)"/>
  <path d="M120 70 L215 70 L215 636 Q215 702 120 716 Z" fill="rgba(0,0,0,.20)"/>
  <g stroke="rgba(0,0,0,.20)" stroke-width="5" stroke-linecap="round">
    <path d="M34 250 L206 236"/><path d="M30 430 L210 418"/><path d="M40 588 L200 578"/>
  </g>
  <ellipse cx="120" cy="70" rx="95" ry="34" fill="var(--turf)"/>
  <ellipse cx="120" cy="70" rx="95" ry="34" fill="none" stroke="var(--moss)" stroke-width="4"/>
  <g fill="rgba(237,231,220,.13)">
    <circle cx="70" cy="330" r="9"/><circle cx="150" cy="500" r="7"/><circle cx="95" cy="640" r="8"/>
  </g>
</svg>`;

const tines = (h) => `
<svg viewBox="0 0 900 470" height="${h}" role="img" aria-label="Hollow tines punching into turf, plugs dropped on the surface">
  <rect x="0" y="176" width="900" height="26" fill="var(--turf)"/>
  <rect x="0" y="202" width="900" height="268" fill="rgba(107,83,64,.5)"/>
  <rect x="150" y="18" width="470" height="30" rx="6" fill="var(--d-line)" stroke="rgba(237,231,220,.5)" stroke-width="3"/>
  <g stroke="var(--bone)" stroke-width="6" fill="none">
    <path d="M208 48 L208 352 M252 48 L252 352 M208 352 L252 352"/>
    <path d="M362 48 L362 352 M406 48 L406 352 M362 352 L406 352"/>
    <path d="M516 48 L516 352 M560 48 L560 352 M516 352 L560 352"/>
  </g>
  <g fill="rgba(0,0,0,.45)">
    <rect x="64" y="176" width="44" height="176"/><rect x="668" y="176" width="44" height="176"/>
  </g>
  <g fill="var(--soil)" stroke="var(--moss)" stroke-width="3">
    <rect x="690" y="136" width="140" height="40" rx="18" transform="rotate(-5 760 156)"/>
    <rect x="748" y="92"  width="140" height="40" rx="18" transform="rotate(7 818 112)"/>
  </g>
  <g stroke="var(--sage)" stroke-width="4" fill="none">
    <path d="M862 352 L862 202 M852 212 L862 198 L872 212 M852 342 L862 356 L872 342"/>
  </g>
  <text x="840" y="288" text-anchor="end" fill="var(--sage)" font-family="Consolas,monospace" font-size="34">2-3 in</text>
</svg>`;

const water = (h) => `
<svg viewBox="0 0 900 440" role="img" height="${h}" aria-label="Water running off compacted ground, and soaking into cored ground">
  <g>
    <rect x="0" y="230" width="420" height="20" fill="var(--turf)"/>
    <rect x="0" y="250" width="420" height="120" fill="rgba(107,83,64,.5)"/>
    <g stroke="var(--sage)" stroke-width="7" fill="none" stroke-linecap="round">
      <path d="M120 80 L120 190"/><path d="M200 60 L200 190"/><path d="M280 88 L280 190"/>
      <path d="M96 196 C150 236 250 250 392 226"/><path d="M370 210 L396 226 L368 240"/>
    </g>
    <text x="0" y="418" fill="rgba(237,231,220,.62)" font-family="Consolas,monospace" font-size="32" letter-spacing="3">COMPACTED</text>
  </g>
  <g transform="translate(480 0)">
    <rect x="0" y="230" width="420" height="20" fill="var(--turf)"/>
    <rect x="0" y="250" width="420" height="120" fill="rgba(107,83,64,.5)"/>
    <g fill="var(--pine)"><rect x="74" y="240" width="30" height="104" rx="8"/>
      <rect x="194" y="240" width="30" height="104" rx="8"/><rect x="314" y="240" width="30" height="104" rx="8"/></g>
    <g stroke="var(--sage)" stroke-width="7" fill="none" stroke-linecap="round">
      <path d="M89 70 L89 320"/><path d="M209 50 L209 320"/><path d="M329 78 L329 320"/>
      <path d="M77 300 L89 326 L101 300"/><path d="M197 300 L209 326 L221 300"/><path d="M317 300 L329 326 L341 300"/>
    </g>
    <text x="0" y="418" fill="rgba(237,231,220,.62)" font-family="Consolas,monospace" font-size="32" letter-spacing="3">CORED</text>
  </g>
</svg>`;

const scatter = (h) => `
<svg viewBox="0 0 900 400" height="${h}" role="img" aria-label="Soil cores lying on a cut lawn">
  <rect x="0" y="286" width="900" height="24" fill="var(--turf)"/>
  <rect x="0" y="310" width="900" height="90" fill="rgba(107,83,64,.5)"/>
  <g fill="var(--soil)" stroke="var(--moss)" stroke-width="3">
    <rect x="60"  y="222" width="152" height="42" rx="20" transform="rotate(-7 136 243)"/>
    <rect x="258" y="248" width="152" height="42" rx="20" transform="rotate(5 334 269)"/>
    <rect x="456" y="214" width="152" height="42" rx="20" transform="rotate(-3 532 235)"/>
    <rect x="636" y="250" width="152" height="42" rx="20" transform="rotate(9 712 271)"/>
    <rect x="180" y="150" width="152" height="42" rx="20" transform="rotate(4 256 171)"/>
    <rect x="520" y="140" width="152" height="42" rx="20" transform="rotate(-9 596 161)"/>
  </g>
</svg>`;

const RIDGE = 'M18 84L18.3 83.4L18.3 84L18 84ZM25.7 83.1L28.65 83.1L28.26 84L25.7 84L25.7 83.1ZM28.73 62.53L36 48L40.23 56.46L33.11 72.83L29.17 68.1L32.53 68.1L28.73 62.53ZM30.86 75.6L31.91 75.6L31.59 76.33L30.86 75.6ZM30 84L30.39 83.1L38.36 83.1L32.81 77.54L33.65 75.6L35.42 75.6L34.26 74.21L50 38L55.2 49.96L42.29 84L30 84ZM44 84L66 26L70.71 38.42L58.34 84L44 84ZM60 84L79 14L98 84L60 84ZM9.5 81.5L17 74L12 74L18.25 66.5L14.5 66.5L22 55.5L29.5 66.5L25.75 66.5L32 74L27 74L34.5 81.5L24.1 81.5L24.1 84.5L19.9 84.5L19.9 81.5L9.5 81.5ZM4 86L96 86L96 91L4 91Z';
const mark = () => `<svg viewBox="0 0 100 96" role="img" aria-label="Sixfold"><path fill="currentColor" fill-rule="evenodd" d="${RIDGE}"/></svg>`;

/* ------------------------------------------------------------------ frames */
/* secs: how long the frame holds. short: is it in the 20-second cut.
   vo: the line to read IF a voiceover gets recorded — every one of them is a
   line the ad kit already cleared against the fact check. */

const FRAMES = [
  { id: 'core', secs: 3.5, short: true, art: plug, artH: 640,
    head: 'This is what comes<br>out of a lawn.',
    sub: 'A soil core. Two to three inches of it.',
    vo: 'This came out of a lawn about ten seconds ago.' },

  { id: 'tines', secs: 3.5, short: true, art: tines, artH: 430, eyebrow: 'Core aeration',
    head: 'Hollow tines,<br>straight down.',
    sub: 'Two to three inches deep, two to four inches apart.',
    vo: "It's called core aeration. Hollow tines, straight down, two to three inches." },

  { id: 'water', secs: 4, short: true, art: water, artH: 400,
    head: 'Compacted ground sheds water instead of taking it.',
    sub: "It's the patch that goes brown first every year.",
    vo: "Compacted soil sheds water instead of taking it. That's why the same patch goes brown first every year." },

  { id: 'water-it', secs: 4, short: true, eyebrow: 'Before anyone turns up',
    head: 'Water it a couple<br>of days before.',
    sub: "Dry ground won't give up a deep plug.",
    vo: "One thing worth doing before anyone turns up - water it a couple of days beforehand. Dry ground won't give up a deep plug." },

  { id: 'plugs-stay', secs: 4, short: true, art: scatter, artH: 360,
    head: 'The plugs stay<br>on the lawn.',
    sub: 'They look untidy for a couple of weeks, then they break down back into the turf.',
    vo: "The plugs stay. They look untidy for a couple of weeks and then they're gone back into the turf." },

  { id: 'seed', secs: 3.5, short: false,
    head: 'Seed goes down straight after, while the holes are open.',
    sub: "That's the part that thickens it.",
    vo: "Seed goes down straight after, while the holes are open. That's the part that thickens it." },

  { id: 'when', secs: 3.5, short: false, eyebrow: 'When',
    head: 'Spring and fall<br>are the windows.',
    sub: "Any time the ground isn't frozen or baked hard.",
    vo: "Spring and fall are the best windows, and it can be done any time the ground isn't frozen or baked hard." },

  { id: 'cta', secs: 4.5, short: true, cta: true,
    head: "We'll walk it with you<br>and tell you what it needs.",
    vo: "We'll walk it with you and tell you what it needs. Sixfold Colorado." },
];

/* -------------------------------------------------------------- rendering */

function frameBody(f, ratio) {
  if (f.cta) return `
      <div class="stage cta">
        <div class="mark">${mark()}</div>
        <h1>${f.head}</h1>
        <p class="wordmark">Sixfold Colorado</p>
        <p class="phone">(303) 915-1045</p>
        <span class="chip">Book a lawn walk</span>
        <p class="towns">Monument &middot; Colorado Springs<br>Black Forest &middot; Palmer Lake &middot; Larkspur</p>
      </div>`;
  const scale = ratio === '4x5' ? 0.78 : 1;
  return `
      <div class="stage">
        ${f.eyebrow ? `<p class="eyebrow">${f.eyebrow}</p>` : ''}
        ${f.art ? `<div class="art">${f.art(Math.round(f.artH * scale))}</div>` : ''}
        <h1>${f.head}</h1>
        ${f.sub ? `<p class="sub">${f.sub}</p>` : ''}
      </div>`;
}

const page = (inner, extraCss = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Sixfold - aeration video frames</title>
<link rel="stylesheet" href="_frames.css">${extraCss}</head><body>${inner}</body></html>`;

/* one frame, alone, for the screenshot */
function single(f, ratio) {
  const cls = ratio === '4x5' ? 'frame--45' : 'frame--916';
  return page(`<div class="frame ${cls}">${frameBody(f, ratio)}</div>`,
    '<style>body{background:var(--pine)}</style>');
}

/* the review sheet */
const review = page(`<div class="sheet">` + FRAMES.map((f, i) => `
  <figure class="slot">
    <div class="frame frame--916">${frameBody(f, '9x16')}</div>
    <div class="safe"><i class="t"></i><i class="b"></i></div>
    <figcaption><span class="n">${String(i + 1).padStart(2, '0')}</span> &middot; ${f.secs}s &middot; ${f.short ? '20s cut + 30s cut' : '30s cut only'}<br>
    VO: ${f.vo}</figcaption>
  </figure>`).join('') + `</div>`);

writeFileSync(join(HERE, 'frames.html'), review);
console.log('frames.html  (review sheet, safe areas drawn)');

/* ------------------------------------------------- preview.html, the player */
/* There is no ffmpeg on this machine, so the clip cannot be muxed here. This
   plays the same frames on the same timings in a browser, which is what you
   actually need before spending fifteen minutes in CapCut: does the thing read
   at speed, and does the hook survive the first second.

   It is a preview, NOT the deliverable. The file Meta gets is exported from
   CapCut off the PNGs in out/. */

const previewData = FRAMES.map((f, i) => ({
  n: String(i + 1).padStart(2, '0'), secs: f.secs, short: !!f.short, vo: f.vo,
}));

const preview = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sixfold - aeration clip preview</title>
<link rel="stylesheet" href="_frames.css">
<style>
  body{background:#151916;display:flex;flex-direction:column;align-items:center;
       gap:18px;padding:22px 16px 40px;min-height:100vh;color:#E7EBE6;font-family:var(--sans);
       overflow-x:hidden}
  .stagewrap{position:relative;overflow:hidden;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.6);
             background:var(--pine);flex:none;max-width:100%}
  .stagewrap .frame{position:absolute;inset:0;display:none;transform-origin:top left}
  .stagewrap .frame.on{display:flex}
  /* the Reels furniture, so the safe areas can be judged in motion rather than argued about */
  .ui{position:absolute;inset:0;pointer-events:none;display:none}
  .ui.on{display:block}
  .ui .top,.ui .bot{position:absolute;left:0;right:0;background:linear-gradient(rgba(0,0,0,.55),transparent)}
  .ui .top{top:0;height:13%}
  .ui .bot{bottom:0;height:22%;background:linear-gradient(transparent,rgba(0,0,0,.65))}
  .ui .cap{position:absolute;left:5%;right:22%;bottom:9%;color:#fff;font-size:13px;line-height:1.45;opacity:.92}
  .ui .who{position:absolute;left:5%;bottom:17%;color:#fff;font-size:14px;font-weight:700}
  .ui .rail{position:absolute;right:4%;bottom:12%;width:34px;height:150px;
            background:repeating-linear-gradient(transparent 0 8px,rgba(255,255,255,.55) 8px 34px);
            border-radius:18px;opacity:.5}
  .bar{width:100%;max-width:420px;height:5px;background:rgba(255,255,255,.14);border-radius:3px;overflow:hidden}
  .bar i{display:block;height:100%;width:0;background:var(--ember)}
  .controls{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center;width:100%}
  button{font-family:var(--mono);font-size:13px;letter-spacing:.1em;text-transform:uppercase;
         background:#212A25;color:#E7EBE6;border:1px solid rgba(255,255,255,.18);border-radius:999px;
         padding:11px 18px;cursor:pointer}
  button:hover{background:#2C3730}
  button[aria-pressed="true"]{background:var(--ember);color:#160B05;border-color:transparent;font-weight:700}
  .meta{font-family:var(--mono);font-size:12.5px;color:#9BA79E;text-align:center;line-height:1.7;width:100%;max-width:520px}
  .vo{font-size:15px;color:#C9D2CB;width:100%;max-width:520px;text-align:center;min-height:3.2em;line-height:1.5}
</style></head>
<body>
  <div class="stagewrap" id="wrap">
    ${FRAMES.map((f, i) => `<div class="frame frame--916" data-i="${i}">${frameBody(f, '9x16')}</div>`).join('')}
    <div class="ui" id="ui">
      <div class="top"></div><div class="bot"></div>
      <div class="who">Sixfold Colorado &middot; Sponsored</div>
      <div class="cap">Water the lawn a couple of days before anyone aerates it&hellip;</div>
      <div class="rail"></div>
    </div>
  </div>

  <div class="bar"><i id="fill"></i></div>
  <p class="vo" id="vo"></p>

  <div class="controls">
    <button id="play">Pause</button>
    <button id="restart">Restart</button>
    <button id="cut" aria-pressed="false">30s cut</button>
    <button id="ratio" aria-pressed="false">9:16</button>
    <button id="chrome" aria-pressed="false">Reels UI</button>
  </div>
  <p class="meta" id="meta"></p>

<script>
const DATA = ${JSON.stringify(previewData)};
const wrap = document.getElementById('wrap');
const frames = [...wrap.querySelectorAll('.frame')];
const fill = document.getElementById('fill'), voEl = document.getElementById('vo'), metaEl = document.getElementById('meta');

let ratio = '9x16', shortCut = false, playing = true, idx = 0, t0 = 0, raf = 0;

/* The frames are authored at 1080 wide. Scale to whatever the window allows and
   keep the aspect exact - a preview that quietly changes the crop is worse than
   no preview. */
function layout() {
  const h = ratio === '9x16' ? 1920 : 1350;
  const maxH = Math.min(window.innerHeight - 260, 760);
  const maxW = Math.min(window.innerWidth - 32, 430);
  const s = Math.min(maxW / 1080, maxH / h);
  wrap.style.width = (1080 * s) + 'px';
  wrap.style.height = (h * s) + 'px';
  for (const f of frames) {
    f.classList.toggle('frame--916', ratio === '9x16');
    f.classList.toggle('frame--45', ratio === '4x5');
    f.style.width = '1080px'; f.style.height = h + 'px';
    f.style.transform = 'scale(' + s + ')';
  }
}

const order = () => DATA.map((d, i) => ({ ...d, i })).filter(d => !shortCut || d.short);

function show(k) {
  const seq = order();
  const cur = seq[k % seq.length];
  frames.forEach(f => f.classList.toggle('on', +f.dataset.i === cur.i));
  voEl.textContent = cur.vo;
  const total = seq.reduce((a, d) => a + d.secs, 0);
  metaEl.textContent = 'frame ' + cur.n + ' of ' + seq.length + '  \\u00b7  ' + cur.secs + 's  \\u00b7  '
    + (shortCut ? 'short cut ' : 'full cut ') + total + 's  \\u00b7  ' + (ratio === '9x16' ? '1080x1920' : '1080x1350');
}

function tick(ts) {
  if (!playing) return;
  if (!t0) t0 = ts;
  const seq = order();
  const cur = seq[idx % seq.length];
  const p = (ts - t0) / (cur.secs * 1000);
  fill.style.width = Math.min(p, 1) * 100 + '%';
  if (p >= 1) { idx = (idx + 1) % seq.length; t0 = ts; show(idx); }
  raf = requestAnimationFrame(tick);
}

function start() { playing = true; t0 = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
                   document.getElementById('play').textContent = 'Pause'; }
function stop() { playing = false; cancelAnimationFrame(raf); document.getElementById('play').textContent = 'Play'; }

document.getElementById('play').onclick = () => playing ? stop() : start();
document.getElementById('restart').onclick = () => { idx = 0; show(0); start(); };
document.getElementById('cut').onclick = e => {
  shortCut = !shortCut; e.target.setAttribute('aria-pressed', shortCut);
  e.target.textContent = shortCut ? '20s cut' : '30s cut';
  idx = 0; show(0); start();
};
document.getElementById('ratio').onclick = e => {
  ratio = ratio === '9x16' ? '4x5' : '9x16'; e.target.setAttribute('aria-pressed', ratio === '4x5');
  e.target.textContent = ratio === '9x16' ? '9:16' : '4:5';
  layout(); show(idx);
};
document.getElementById('chrome').onclick = e => {
  const on = document.getElementById('ui').classList.toggle('on');
  e.target.setAttribute('aria-pressed', on);
};
window.addEventListener('resize', layout);
layout(); show(0); start();
</script>
</body></html>`;

writeFileSync(join(HERE, 'preview.html'), preview);
console.log('preview.html  (plays the clip at the real timings - no ffmpeg needed)');

/* ------------------------------------------- preview.artifact.html, for a phone */
/* Same player, published as a private Claude artifact so the clip can be judged on
   the device it will actually be watched on. Two differences forced by the artifact
   runtime: the page ships with no doctype/head/body of its own, and it cannot link
   a stylesheet, so _frames.css is inlined. Single dark theme on purpose - it is a
   video player showing dark frames, and a light mode would misreport the ad. */

const frameCss = readFileSync(join(HERE, '_frames.css'), 'utf8');
const playerCss = preview.slice(preview.indexOf('<style>') + 7, preview.indexOf('</style>'));
const playerBody = preview.slice(preview.indexOf('<body>') + 6, preview.lastIndexOf('</body>'));

const artifact = `<title>Aeration Ad Preview</title>
<style>
:root{color-scheme:dark}
${frameCss}
${playerCss}
  body{padding-block:20px 40px}
  .head{text-align:center;width:100%;max-width:520px;display:flex;flex-direction:column;gap:6px}
  .head .k{font-family:var(--mono);font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--ember)}
  .head h1{font-family:var(--serif);font-size:27px;line-height:1.15;margin:0;color:#EDE7DC;letter-spacing:-.01em}
  .head p{margin:0;font-size:13.5px;line-height:1.55;color:#9BA79E}
  @media (prefers-reduced-motion:reduce){ .bar i{transition:none} }
</style>
<div class="head">
  <p class="k">Sixfold Colorado &middot; draft, not placed</p>
  <h1>Lawn aeration &mdash; Facebook video</h1>
  <p>Eight frames on their real timings. Toggle the short cut, the feed crop, and the Reels furniture to see what survives it.</p>
</div>
${playerBody}`;

writeFileSync(join(HERE, 'preview.artifact.html'), artifact);
console.log('preview.artifact.html  (self-contained, for publishing)');

const RATIOS = { '9x16': [1080, 1920], '4x5': [1080, 1350] };
let n = 0;
for (const [ratio, [w, h]] of Object.entries(RATIOS)) {
  mkdirSync(join(HERE, 'out', ratio), { recursive: true });
  for (const [i, f] of FRAMES.entries()) {
    const tmp = join(HERE, `_tmp-${ratio}-${f.id}.html`);
    writeFileSync(tmp, single(f, ratio));
    const out = join(HERE, 'out', ratio, `${String(i + 1).padStart(2, '0')}-${f.id}.png`);
    const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
      '--force-color-profile=srgb', `--window-size=${w},${h}`, `--screenshot=${out}`,
      'file:///' + tmp.replace(/\\/g, '/')], { encoding: 'utf8' });
    rmSync(tmp);
    if (r.status !== 0) { console.error('FAILED ' + out + '\n' + (r.stderr || '')); process.exitCode = 1; }
    else { n++; }
  }
}
const total = FRAMES.reduce((a, f) => a + f.secs, 0);
const short = FRAMES.filter(f => f.short).reduce((a, f) => a + f.secs, 0);
console.log(`${n} PNGs written to out/`);
console.log(`full cut ${total}s over ${FRAMES.length} frames - short cut ${short}s over ${FRAMES.filter(f => f.short).length} frames`);
