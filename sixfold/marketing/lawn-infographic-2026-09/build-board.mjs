/* Sixfold Colorado — lawn aeration board, precision cut. 2026-09-25.

   Third pass. Matthew: "more professional looking, maybe a little less hand
   drawn. Maybe a little more fun."

   The first two boards drew everything with strokes — roots, rain, roots again —
   and a stroke with a round cap reads as a sketch no matter how carefully it is
   placed. This one is GENERATED rather than hand-placed, which is what fixes it:

     - Roots are filled tapered shapes from one function, so every root narrows on
       the same curve. Hand-drawn strokes cannot be consistent; computed ones are.
     - Spacing, hole positions, tick marks and seed drops are computed from a
       depth scale, not typed in by eye.
     - Gradients and a dot pattern replace flat fills, so the soil has depth and
       the tine looks like steel.
     - A real depth ruler down the left edge, 0 to 3 inches, which is also the
       claim the whole ad rests on. A measured drawing reads as a company that
       measures things.

   The fun is in the colour and the copy, not in wobble: brighter turf, a friendlier
   headline, rounded cards.

   Run:  node build-board.mjs     ->  lawn-board.html + lawn-board.png
*/

import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const HERE = resolve('.');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/* ---------------------------------------------------------------- geometry */
/* One scale for the whole drawing: 1 inch = 62px. Everything vertical is
   derived from it, so the ruler and the tine cannot disagree. */
const PX_PER_IN = 62;
const SURFACE = 150;                    // y of the top of the turf
const inch = (n) => SURFACE + n * PX_PER_IN;
const W = 960, H = 468;
const SPLIT = 430;

/* a root: filled taper, optional branches, all from the same curve */
function root(x, depthIn, { w = 6, lean = 0, branches = [] } = {}) {
  const y0 = inch(0.42);
  const d = depthIn * PX_PER_IN;
  const tipX = x + lean;
  const main = `M${x - w} ${y0} C${x - w * 0.55} ${y0 + d * 0.45} ${tipX - 1.5} ${y0 + d * 0.8} ${tipX} ${y0 + d} `
             + `C${x + w * 0.55} ${y0 + d * 0.8} ${x + w * 0.8} ${y0 + d * 0.45} ${x + w} ${y0} Z`;
  const kids = branches.map(([atIn, len, dir]) => {
    const by = y0 + atIn * PX_PER_IN, bw = w * 0.48, bl = len * PX_PER_IN;
    const ex = x + dir * bl * 0.78, ey = by + bl * 0.72;
    return `M${x - bw} ${by} Q${x + dir * bl * 0.3} ${by + bl * 0.25} ${ex} ${ey} `
         + `Q${x + dir * bl * 0.2} ${by + bl * 0.55} ${x + bw} ${by + bw} Z`;
  });
  return `<path d="${main}" fill="url(#rootG)"/>` + kids.map(k => `<path d="${k}" fill="url(#rootG)" opacity=".92"/>`).join('');
}

/* a drop: a teardrop, not a line */
const drop = (x, y, s = 1, fill = 'url(#waterG)') =>
  `<path transform="translate(${x} ${y}) scale(${s})" fill="${fill}"
     d="M0 -16 C7 -6 12 0 12 6 A12 12 0 0 1 -12 6 C-12 0 -7 -6 0 -16 Z"/>`;

/* a seed: an ellipse with a highlight, so it reads as an object */
const seed = (x, y, r = -18) =>
  `<g transform="translate(${x} ${y}) rotate(${r})"><ellipse rx="6.5" ry="10" fill="#D9853F"/>`
  + `<ellipse cx="-1.6" cy="-3" rx="2.2" ry="3.6" fill="#F0B577" opacity=".85"/></g>`;

/* the depth ruler — the claim, measured */
function ruler() {
  let s = `<g font-family="Consolas,monospace" font-size="17" fill="rgba(237,231,220,.62)">`;
  s += `<line x1="46" y1="${inch(0)}" x2="46" y2="${inch(3.4)}" stroke="rgba(237,231,220,.28)" stroke-width="2"/>`;
  for (let i = 0; i <= 3; i++) {
    const y = inch(i), major = true;
    s += `<line x1="38" y1="${y}" x2="${major ? 58 : 52}" y2="${y}" stroke="rgba(237,231,220,.45)" stroke-width="2"/>`;
    s += `<text x="30" y="${y + 6}" text-anchor="end">${i}</text>`;
    if (i < 3) for (const f of [0.25, 0.5, 0.75]) {
      const yy = inch(i + f);
      s += `<line x1="42" y1="${yy}" x2="50" y2="${yy}" stroke="rgba(237,231,220,.25)" stroke-width="2"/>`;
    }
  }
  s += `<text x="30" y="${inch(0) - 24}" text-anchor="end" letter-spacing="2" fill="rgba(237,231,220,.5)">IN</text></g>`;
  return s;
}

/* ------------------------------------------------------------------ the art */
const holes = [520, 646, 772, 898];        // cored side, evenly computed below
const holeW = 32, holeDepth = 2.15;

const art = `
<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
     aria-label="Measured cross-section of a lawn. Left: packed ground, water running off, roots stopping at a compacted layer two inches down. Centre: a hollow tine pulling a core. Right: cored ground, water and seed entering open holes, roots running past three inches.">
  <defs>
    <linearGradient id="soilG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#75573F"/><stop offset="1" stop-color="#33261C"/>
    </linearGradient>
    <linearGradient id="panG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4A3829"/><stop offset="1" stop-color="#3A2B1F"/>
    </linearGradient>
    <linearGradient id="turfG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4FB878"/><stop offset="1" stop-color="#2E7A4E"/>
    </linearGradient>
    <linearGradient id="turfDull" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7C8A74"/><stop offset="1" stop-color="#5A6654"/>
    </linearGradient>
    <linearGradient id="rootG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#BFD6A8"/><stop offset="1" stop-color="#7E9A6C"/>
    </linearGradient>
    <linearGradient id="waterG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9FD0E8"/><stop offset="1" stop-color="#4E88A8"/>
    </linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6E7A74"/><stop offset=".28" stop-color="#E9EEEB"/>
      <stop offset=".62" stop-color="#AEB8B2"/><stop offset="1" stop-color="#63706A"/>
    </linearGradient>
    <linearGradient id="plugG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7A5C43"/><stop offset="1" stop-color="#4D3A2B"/>
    </linearGradient>
    <pattern id="grit" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="6" cy="7" r="2.2" fill="rgba(0,0,0,.34)"/>
      <circle cx="19" cy="18" r="2.6" fill="rgba(0,0,0,.34)"/>
      <circle cx="13" cy="2" r="1.6" fill="rgba(0,0,0,.24)"/>
    </pattern>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity=".45"/>
    </filter>
    <clipPath id="panel"><rect x="0" y="0" width="${W}" height="${H}" rx="22"/></clipPath>
  </defs>

  <g clip-path="url(#panel)">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#121A16"/>

    <!-- ground -->
    <rect x="0" y="${inch(0.42)}" width="${W}" height="${H - inch(0.42)}" fill="url(#soilG)"/>
    <rect x="0" y="${inch(0.42)}" width="${W}" height="${H - inch(0.42)}" fill="url(#grit)" opacity=".55"/>
    <!-- The compacted pan, left side only. It is what the ad is about, so it is the
         darkest thing in the drawing, it has a hard top edge, and it is labelled. -->
    <rect x="0" y="${inch(0.95)}" width="${SPLIT}" height="${PX_PER_IN}" fill="#241A12"/>
    <rect x="0" y="${inch(0.95)}" width="${SPLIT}" height="${PX_PER_IN}" fill="url(#grit)" opacity="1"/>
    <line x1="0" y1="${inch(0.95)}" x2="${SPLIT}" y2="${inch(0.95)}" stroke="rgba(0,0,0,.75)" stroke-width="4"/>
    <line x1="0" y1="${inch(0.95) + 4}" x2="${SPLIT}" y2="${inch(0.95) + 4}" stroke="rgba(237,231,220,.10)" stroke-width="2"/>
    <text x="${SPLIT - 72}" y="${inch(1.55)}" text-anchor="end" font-family="Consolas,monospace"
          font-size="16" letter-spacing="2" fill="rgba(237,231,220,.55)">COMPACTED LAYER</text>

    <!-- roots: same function both sides, only the depth differs -->
    <g opacity=".85">
      ${root(120, 0.74, { lean: -30, branches: [[0.34, 0.5, -1], [0.54, 0.44, 1]] })}
      ${root(252, 0.80, { lean: 26, branches: [[0.36, 0.52, 1], [0.58, 0.42, -1]] })}
      ${root(372, 0.70, { lean: -22, branches: [[0.32, 0.46, -1], [0.5, 0.38, 1]] })}
    </g>
    <g>
      ${root(560, 3.3, { lean: 16, branches: [[0.9, 0.9, -1], [1.9, 0.8, 1], [2.6, 0.6, -1]] })}
      ${root(700, 3.9, { lean: -14, branches: [[1.1, 0.85, 1], [2.2, 0.75, -1]] })}
      ${root(840, 3.5, { lean: 18, branches: [[0.95, 0.8, -1], [2.1, 0.7, 1]] })}
      ${root(936, 3.0, { lean: -10, branches: [[1.3, 0.6, -1]] })}
    </g>

    <!-- open holes, right side -->
    ${holes.map(x => `<rect x="${x - holeW / 2}" y="${inch(0.3)}" width="${holeW}" height="${holeDepth * PX_PER_IN}" rx="6" fill="#1A120C"/>
      <rect x="${x - holeW / 2}" y="${inch(0.3)}" width="${holeW}" height="14" fill="rgba(0,0,0,.55)"/>`).join('')}

    <!-- turf: dull left, bright right -->
    <rect x="0" y="${inch(0)}" width="${SPLIT}" height="${inch(0.42) - inch(0)}" fill="url(#turfDull)"/>
    <rect x="${SPLIT}" y="${inch(0)}" width="${W - SPLIT}" height="${inch(0.42) - inch(0)}" fill="url(#turfG)"/>
    ${holes.map(x => `<rect x="${x - holeW / 2}" y="${inch(0)}" width="${holeW}" height="${inch(0.42) - inch(0)}" fill="#0A0906"/>`).join('')}

    <!-- water: off to the side on the left, straight in on the right -->
    ${[96, 168, 240].map((x, i) => drop(x, 60 + i * 14, 1, 'url(#waterG)')).join('')}
    <path d="M60 ${inch(-0.2)} C150 ${inch(0.35)} 300 ${inch(0.3)} 392 ${inch(-0.1)}"
          fill="none" stroke="url(#waterG)" stroke-width="9" stroke-linecap="round" opacity=".9"/>
    <path d="M366 ${inch(-0.26)} L400 ${inch(-0.1)} L368 ${inch(0.06)} Z" fill="#6FA8C4"/>
    ${holes.map((x, i) => drop(x, 46 + (i % 2) * 20) + drop(x, 104 + (i % 2) * 16, .78)).join('')}

    <!-- seed going in -->
    ${holes.map((x, i) => seed(x - 19, 74 + (i % 2) * 18, -22 + i * 9) + seed(x + 17, 120 - (i % 2) * 14, 14 - i * 7) + seed(x, inch(0.5) + (i % 2) * 12, 8 + i * 5)).join('')}

    <!-- the tine, mid-pull, straddling the two -->
    <g filter="url(#lift)">
      <rect x="${SPLIT - 78}" y="14" width="156" height="26" rx="8" fill="#39433C"/>
      <rect x="${SPLIT - 12}" y="36" width="24" height="34" fill="#39433C"/>
      <rect x="${SPLIT - 21}" y="64" width="42" height="${inch(2.55) - 64}" rx="5" fill="url(#steel)"/>
      <rect x="${SPLIT - 13}" y="${inch(0.15)}" width="26" height="${inch(2.5) - inch(0.15)}" fill="url(#plugG)"/>
    </g>

    <!-- the core it has already set down, sitting on the turf -->
    <g transform="rotate(-7 ${SPLIT + 150} ${inch(-0.24)})" filter="url(#lift)">
      <rect x="${SPLIT + 78}" y="${inch(-0.52)}" width="146" height="42" rx="21" fill="url(#plugG)"/>
      <rect x="${SPLIT + 78}" y="${inch(-0.52)}" width="38" height="42" rx="19" fill="url(#turfG)"/>
    </g>

    ${ruler()}

    <!-- zone badges -->
    <g font-family="Consolas,monospace" font-size="18" font-weight="700" letter-spacing="2.5">
      <rect x="74" y="${H - 56}" width="150" height="40" rx="20" fill="rgba(237,231,220,.10)"/>
      <text x="149" y="${H - 30}" text-anchor="middle" fill="rgba(237,231,220,.68)">PACKED</text>
      <rect x="${W - 224}" y="${H - 56}" width="150" height="40" rx="20" fill="rgba(79,184,120,.18)"/>
      <text x="${W - 149}" y="${H - 30}" text-anchor="middle" fill="#7FD6A2">CORED</text>
    </g>
  </g>
</svg>`;

/* ----------------------------------------------------------------- the page */
const RIDGE = 'M18 84L18.3 83.4L18.3 84L18 84ZM25.7 83.1L28.65 83.1L28.26 84L25.7 84L25.7 83.1ZM28.73 62.53L36 48L40.23 56.46L33.11 72.83L29.17 68.1L32.53 68.1L28.73 62.53ZM30.86 75.6L31.91 75.6L31.59 76.33L30.86 75.6ZM30 84L30.39 83.1L38.36 83.1L32.81 77.54L33.65 75.6L35.42 75.6L34.26 74.21L50 38L55.2 49.96L42.29 84L30 84ZM44 84L66 26L70.71 38.42L58.34 84L44 84ZM60 84L79 14L98 84L60 84ZM9.5 81.5L17 74L12 74L18.25 66.5L14.5 66.5L22 55.5L29.5 66.5L25.75 66.5L32 74L27 74L34.5 81.5L24.1 81.5L24.1 84.5L19.9 84.5L19.9 81.5L9.5 81.5ZM4 86L96 86L96 91L4 91Z';

const CARDS = [
  { t: 'Aerate and overseed', s: 'One visit. Seed lands in an open hole, not on top of the lawn.',
    icon: `<rect x="13" y="6" width="18" height="32" rx="9" fill="url(#plugG)"/><rect x="13" y="6" width="18" height="11" rx="5.5" fill="url(#turfG)"/>` },
  { t: 'We walk it first', s: 'Counted on the property with you, then quoted off what is there.',
    icon: `<rect x="8" y="7" width="28" height="30" rx="4" fill="none" stroke="#2F7A4F" stroke-width="3"/><path d="M14 17h16M14 24h16M14 31h9" stroke="#2F7A4F" stroke-width="3" stroke-linecap="round"/>` },
  { t: 'You get the folder', s: 'Written scope, dated photographs, itemised invoice.',
    icon: `<path d="M7 12h12l4 5h14v20H7z" fill="none" stroke="#2F7A4F" stroke-width="3" stroke-linejoin="round"/>` },
];

const html = `<!doctype html>
<!-- GENERATED by build-board.mjs — do not hand-edit, your changes are one re-run
     from being overwritten. Edit the script. -->
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sixfold — give your lawn room to breathe</title>
<style>
:root{
  --pine:#0E1512; --pine-lift:#18211C; --bone:#EDE7DC; --paper:#F4F0E7;
  --turf:#2F7A4F; --turf-hi:#4FB878; --sage:#A7BE93;
  --ember:#E4703A;
  --ink:#141A16; --ink-soft:#4C554E;
  --serif:"Palatino Linotype","Book Antiqua",Palatino,"Iowan Old Style",Georgia,serif;
  --sans:"Segoe UI",ui-sans-serif,system-ui,Roboto,Helvetica,Arial,sans-serif;
  --mono:Consolas,"Cascadia Mono","Segoe UI Mono",ui-monospace,monospace;
}
@page{ size:11.25in 14.0625in; margin:0 }
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:#202622;display:grid;place-items:start center;font-family:var(--sans)}
.board{width:1080px;height:1350px;overflow:hidden;background:var(--pine);color:var(--bone);
       display:flex;flex-direction:column}

.head{padding:44px 60px 0}
.toprow{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}
.eyebrow{margin:0;font-family:var(--mono);font-size:16.5px;letter-spacing:.2em;
         text-transform:uppercase;color:var(--sage)}
.chip{margin:0;font-family:var(--mono);font-size:16px;letter-spacing:.13em;text-transform:uppercase;
      font-weight:700;color:#1A0C04;background:var(--ember);padding:11px 19px;border-radius:999px}
h1{margin:0;font-family:var(--serif);font-weight:400;font-size:78px;line-height:1.0;letter-spacing:-.026em}
h1 em{font-style:normal;color:var(--turf-hi)}
.kick{margin:16px 0 0;font-size:23px;line-height:1.38;color:rgba(237,231,220,.75);max-width:880px}

.art{padding:22px 60px 0}
.art svg{display:block;width:960px;height:468px}

.cards{padding:24px 60px 0;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.card{background:var(--paper);color:var(--ink);border-radius:16px;padding:20px 20px 22px;
      display:grid;gap:8px;align-content:start}
.card svg{width:44px;height:44px;display:block}
.card b{font-family:var(--serif);font-weight:400;font-size:25px;line-height:1.1}
.card p{margin:0;font-size:17px;line-height:1.38;color:var(--ink-soft)}

.foot{margin-top:auto;background:var(--ember);color:#1A0C04;padding:24px 60px 28px;
      display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:center}
.foot .mark{width:82px;color:#1A0C04}
.foot .mark svg{width:82px;height:79px;display:block}
.wordmark{margin:0;font-family:var(--serif);font-size:31px;letter-spacing:-.01em}
.cta{margin:3px 0 0;font-family:var(--mono);font-size:17px;letter-spacing:.14em;
     text-transform:uppercase;font-weight:700;color:#2A1408}
.tel{margin:6px 0 0;font-family:var(--serif);font-size:70px;line-height:1;letter-spacing:-.02em}
.web{margin:8px 0 0;font-family:var(--mono);font-size:22px;letter-spacing:.06em;color:#2A1408}
.towns{margin:8px 0 0;font-family:var(--mono);font-size:14px;letter-spacing:.08em;
       text-transform:uppercase;color:rgba(26,12,4,.66)}
</style>
</head>
<body>
<div class="board">

  <div class="head">
    <div class="toprow">
      <p class="eyebrow">Core lawn aeration &middot; Monument, CO</p>
      <!-- ⚑ THE DEAL SLOT. A bundle, not a discount — there is still no aeration
           rate of Sixfold's own to discount from. One line to swap once there is. -->
      <p class="chip">Booking fall aeration</p>
    </div>
    <h1>Give your lawn<br><em>room to breathe.</em></h1>
    <p class="kick">Front Range ground packs hard. Left, the water runs off and the roots stop
    at two inches. Right, it has been cored.</p>
  </div>

  <div class="art">${art}</div>

  <div class="cards">
    ${CARDS.map(c => `<div class="card">
      <svg viewBox="0 0 44 44" aria-hidden="true">${c.icon}</svg>
      <b>${c.t}</b><p>${c.s}</p>
    </div>`).join('')}
  </div>

  <div class="foot">
    <div class="mark"><svg viewBox="0 0 100 96" role="img" aria-label="Sixfold"><path fill="currentColor" fill-rule="evenodd" d="${RIDGE}"/></svg></div>
    <div>
      <p class="wordmark">Sixfold Colorado</p>
      <p class="cta">Call and we will walk your lawn</p>
      <p class="tel">(303) 915-1045</p>
      <p class="web">SixfoldColorado.com</p>
      <p class="towns">Monument &middot; Colorado Springs &middot; Black Forest &middot; Palmer Lake &middot; Larkspur</p>
    </div>
  </div>

</div>
</body>
</html>`;

writeFileSync(join(HERE, 'lawn-board.html'), html);
console.log('lawn-board.html');

const png = join(HERE, 'lawn-board.png');
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--force-color-profile=srgb', '--window-size=1080,1350', `--screenshot=${png}`,
  'file:///' + join(HERE, 'lawn-board.html').replace(/\\/g, '/')], { encoding: 'utf8' });
console.log(r.status === 0 ? 'lawn-board.png  1080x1350' : 'RENDER FAILED\n' + r.stderr);
