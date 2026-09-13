/*
  Sixfold — Square (squareup.com) brand asset generator.

  Same method as ../social/build-social.mjs: one artwork definition, written to
  one HTML page per asset and screenshotted in headless Chrome at the exact
  upload pixel size with device scale factor 1. Change the composition here and
  every Square surface re-exports consistently.

  Mark: RIDGE, revised tree-and-roots version, from ../sixfold-mark-ridge-mono.svg
  (currentColor, so colour is set on the wrapper, never in the path data).
  Palette: the agreed Sixfold five.

  Every dimension in ASSETS is sourced in README.md — read that before trusting
  a number. Where Square publishes a spec it is used verbatim; where it does not
  (customer-display cover, booking-site cover) the asset is built to survive an
  unknown crop: centre-weighted, symmetric.

  Run:  node build-square.mjs
  Needs Chrome. Outputs .png beside this file.
*/
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tmp = join(here, '.build');
mkdirSync(tmp, { recursive: true });

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/* Palette — the agreed Sixfold five, plus the light-ground ember from the
   ridge-mark light theme for assets that sit on white Square chrome. */
const PINE = '#0E1512';
const EMBER = '#E4703A';
const EMBER_ON_LIGHT = '#B84C15';
const BONE = '#EDE7DC';
const MOSS = '#8AA07A';
const MOSS_ON_LIGHT = '#4F6640';

/* ---------------------------------------------------------------------------
   The Ridge mark. viewBox 0 0 100 116 in the master; reframed here to the
   drawn extents (x 4->98; y 14->113 with roots, 14->91 without) so a centred
   mark is the artwork centred, not the empty canvas.

   `full`  = tinted peaks + tree + ground + ten root strands (the master).
   `crest` = tinted peaks + tree + ground, no roots — for small square crops
             where the 0.75-1.6u strands fall below a pixel and dirty the
             silhouette (same call as the social set).
   `solid` = every shape one flat colour, no tints, no roots — for 1-bit
             thermal receipt printing, which cannot hold a tint.
--------------------------------------------------------------------------- */
const RIDGE_CREST = `
  <path d="M18 84 L36 48 L54 84 Z" fill-opacity="0.42"/>
  <path d="M30 84 L50 38 L70 84 Z" fill-opacity="0.55"/>
  <path d="M44 84 L66 26 L88 84 Z" fill-opacity="0.7"/>
  <path d="M60 84 L79 14 L98 84 Z" fill-opacity="0.85"/>
  <rect x="20.4" y="77" width="3.2" height="7"/>
  <path d="M22 69 L9.5 81.5 L34.5 81.5 Z"/>
  <path d="M22 62 L12 74 L32 74 Z"/>
  <path d="M22 55.5 L14.5 66.5 L29.5 66.5 Z"/>
  <rect x="4" y="86" width="92" height="5"/>`;

const RIDGE_CREST_SOLID = `
  <path d="M18 84 L36 48 L54 84 Z"/>
  <path d="M30 84 L50 38 L70 84 Z"/>
  <path d="M44 84 L66 26 L88 84 Z"/>
  <path d="M60 84 L79 14 L98 84 Z"/>
  <rect x="20.4" y="77" width="3.2" height="7"/>
  <path d="M22 69 L9.5 81.5 L34.5 81.5 Z"/>
  <path d="M22 62 L12 74 L32 74 Z"/>
  <path d="M22 55.5 L14.5 66.5 L29.5 66.5 Z"/>
  <rect x="4" y="86" width="92" height="5"/>`;

const RIDGE_ROOTS = `
  <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <path d="M94 91 L92.2 94.4 L94.6 98 L91.4 102 L93.4 106 L90 109.4 L89.8 113" stroke-width="1.6"/>
    <path d="M90.5 91 L88.4 93.6 L85.4 95.2 L87.8 98.6 L82.4 101.4 L84.2 104.6 L79.6 108" stroke-width="1.35"/>
    <path d="M86.5 91 L83.8 92.6 L85.8 95 L80.4 96.2 L77.6 99 L74 99.2 L71.5 101" stroke-width="1.1"/>
    <path d="M96 91 L97.6 93.8 L95 96.2 L97.4 99.6 L94.8 102.4 L96 106" stroke-width="1.15"/>
    <path d="M92.6 91 L90.6 94.6 L92.4 97.6 L89.4 100.6 L90.6 104.4 L88 107.4" stroke-width="1.05"/>
    <path d="M87.8 98.6 L85.4 100.8 L86.6 103.4 L83 105.8 L83.8 109" stroke-width="0.9"/>
    <path d="M91.4 102 L94.2 103.4 L93.4 106.2 L95.8 108.6" stroke-width="0.85"/>
    <path d="M84.6 91 L82.4 92.6 L83.8 94.8 L78.4 95.6 L75.6 97.4 L72.4 97.6" stroke-width="0.8"/>
    <path d="M85.8 95 L83.4 96.8 L84.4 99.4 L80.6 100.8" stroke-width="0.75"/>
    <path d="M95 91 L96.6 94.2 L94.4 96.6 L96.4 100" stroke-width="0.85"/>
  </g>`;

const mark = (roots) =>
  `<svg class="mark" viewBox="4 14 94 ${roots ? 99 : 77}" role="img" aria-label="Sixfold">
     <g fill="currentColor">${RIDGE_CREST}</g>${roots ? RIDGE_ROOTS : ''}
   </svg>`;

const markSolid = () =>
  `<svg class="mark" viewBox="4 14 94 77" role="img" aria-label="Sixfold">
     <g fill="currentColor">${RIDGE_CREST_SOLID}</g>
   </svg>`;

/* ---------------------------------------------------------------------------
   Compositions.
--------------------------------------------------------------------------- */

/** Square logo tile. Mark centred inside the frame; `frac` is its width as a
 *  percent of the side. 2% optical lift because the ground line and roots
 *  weight the mark low. Kept circle-safe (frac <= 66 with roots) because some
 *  Square placements — loyalty, Appointments — render the logo as a disc. */
const profile = ({ ground, ink, roots, frac = 62 }) => `
<div class="art profile" style="background:${ground};color:${ink}">
  <div class="markwrap" style="width:${frac}%">${mark(roots)}</div>
</div>`;

/** Centred lockup on Pine Black, with the ember floor-glow. Symmetric on
 *  purpose: Square does not publish the crop for the customer display or the
 *  booking-site cover, and a symmetric composition loses the same amount from
 *  both sides whatever it takes. `ref` is the width:height the unit scale is
 *  tuned against, so the lockup stays the same relative size at any ratio. */
const lockup = ({ w, h, ref = 2, descriptor = true, tagline = true, phone = true }) => {
  const u = Math.min(h, w / ref) / 100;
  return `
<div class="art banner" style="background:${PINE};width:${w}px;height:${h}px;--u:${u}px">
  <div class="glow"></div>
  <div class="stack">
    <div class="lockup">
      <div class="markwrap" style="color:${EMBER}">${mark(true)}</div>
      <div class="wordmark" style="color:${BONE}">Sixfold</div>
    </div>
    ${descriptor ? `<div class="descriptor" style="color:${MOSS}">Land &amp; Fire</div>` : ''}
    ${tagline ? `<div class="rule" style="background:${EMBER}"></div>
    <div class="line" style="color:${BONE}">We do the work and show you who pays for it.</div>` : ''}
    ${phone ? `<div class="phone" style="color:${MOSS}">Fire mitigation &middot; Front Range &middot; (720) 772-6146</div>` : ''}
  </div>
</div>`;
};

/** Printed thermal receipt. White ground, one flat ink, no tints, crest only.
 *  Horizontal so it survives a narrow 2:1 print frame. */
const receiptPrint = ({ w, h }) => {
  const u = Math.min(h, w / 2) / 100;
  return `
<div class="art rc" style="width:${w}px;height:${h}px;--u:${u}px">
  <div class="rcwrap">
    <div class="markwrap" style="color:${PINE}">${markSolid()}</div>
    <div class="rctext">
      <div class="rcword" style="color:${PINE}">SIXFOLD</div>
      <div class="rcsub" style="color:${PINE}">Fire mitigation &middot; Front Range</div>
    </div>
  </div>
</div>`;
};

/** Physical gift-card face, full bleed. CR80 proportion (85.6 x 54 mm).
 *  This is a proof: drop it into Square's official card template before
 *  ordering — the print partner owns trim and safe-area. */
const giftcard = ({ w, h }) => {
  const u = Math.min(h, w / 1.586) / 100;
  return `
<div class="art card" style="background:${PINE};width:${w}px;height:${h}px;--u:${u}px">
  <div class="glow"></div>
  <div class="cardwrap">
    <div class="markwrap" style="color:${EMBER}">${mark(true)}</div>
    <div>
      <div class="cardword" style="color:${BONE}">Sixfold</div>
      <div class="carddesc" style="color:${MOSS}">Land &amp; Fire</div>
    </div>
  </div>
  <div class="cardfoot" style="color:${MOSS}">Gift Card</div>
</div>`;
};

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#000}
  body{display:flex;align-items:center;justify-content:center;overflow:hidden}
  .art{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}

  /* --- square logo tile --- */
  .profile{width:100%;height:100%}
  .profile .markwrap{display:flex;align-items:center;justify-content:center;transform:translateY(-3%)}
  .profile .mark{width:100%;height:auto;display:block}

  /* --- lockup / banner --- */
  .banner .glow{
    position:absolute;inset:0;
    background:radial-gradient(120% 150% at 50% 118%, rgba(228,112,58,0.20) 0%, rgba(228,112,58,0.055) 38%, rgba(228,112,58,0) 66%);
  }
  .stack{position:relative;display:flex;flex-direction:column;align-items:center;width:100%;padding:0 6%}
  .lockup{display:flex;align-items:center;gap:calc(var(--u)*4.5)}
  .lockup .markwrap{width:calc(var(--u)*23)}
  .lockup .mark{width:100%;height:auto;display:block}
  .wordmark{
    font-family:"Palatino Linotype","Book Antiqua",Palatino,"Iowan Old Style",Georgia,serif;
    font-size:calc(var(--u)*30);line-height:0.84;letter-spacing:-0.018em;
  }
  .descriptor{
    font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace;
    font-size:calc(var(--u)*4.4);letter-spacing:0.34em;text-transform:uppercase;
    margin-top:calc(var(--u)*2.6);text-indent:0.34em;
  }
  .rule{width:calc(var(--u)*20);height:calc(var(--u)*0.85);opacity:0.95;margin-top:calc(var(--u)*5.5)}
  .line{
    font-family:"Palatino Linotype","Book Antiqua",Palatino,"Iowan Old Style",Georgia,serif;
    font-size:calc(var(--u)*8.8);line-height:1.16;text-align:center;text-wrap:balance;max-width:80%;
    margin-top:calc(var(--u)*5);
  }
  .phone{
    font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace;
    font-size:calc(var(--u)*3.6);letter-spacing:0.18em;text-transform:uppercase;text-align:center;
    white-space:nowrap;margin-top:calc(var(--u)*4.6);text-indent:0.18em;
  }

  /* --- printed receipt --- */
  .rc{background:#FFFFFF}
  .rcwrap{display:flex;align-items:center;gap:calc(var(--u)*7)}
  .rcwrap .markwrap{width:calc(var(--u)*44);display:flex}
  .rcwrap .mark{width:100%;height:auto;display:block}
  .rcword{
    font-family:"Palatino Linotype","Book Antiqua",Palatino,"Iowan Old Style",Georgia,serif;
    font-size:calc(var(--u)*30);line-height:1;letter-spacing:0.02em;
  }
  .rcsub{
    font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace;
    font-size:calc(var(--u)*6.4);letter-spacing:0.16em;text-transform:uppercase;
    margin-top:calc(var(--u)*3.4);
  }

  /* --- gift card --- */
  .card .glow{
    position:absolute;inset:0;
    background:radial-gradient(120% 150% at 50% 120%, rgba(228,112,58,0.22) 0%, rgba(228,112,58,0.06) 40%, rgba(228,112,58,0) 68%);
  }
  .cardwrap{position:relative;display:flex;align-items:center;gap:calc(var(--u)*6)}
  .cardwrap .markwrap{width:calc(var(--u)*24);display:flex}
  .cardwrap .mark{width:100%;height:auto;display:block}
  .cardword{
    font-family:"Palatino Linotype","Book Antiqua",Palatino,"Iowan Old Style",Georgia,serif;
    font-size:calc(var(--u)*30);line-height:0.86;letter-spacing:-0.018em;
  }
  .carddesc{
    font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace;
    font-size:calc(var(--u)*4.2);letter-spacing:0.32em;text-transform:uppercase;
    margin-top:calc(var(--u)*2.4);text-indent:0.32em;
  }
  .cardfoot{
    position:absolute;left:calc(var(--u)*7);bottom:calc(var(--u)*6);
    font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace;
    font-size:calc(var(--u)*3.4);letter-spacing:0.28em;text-transform:uppercase;
  }
`;

/* ---------------------------------------------------------------------------
   Asset list. `note` travels into README.md so the provenance of every
   dimension stays with the file.
--------------------------------------------------------------------------- */
const ASSETS = [
  /* Business logo + invoice/receipt FRAMED layout — square, Pine tile. */
  { file: 'sixfold-square-logo-framed-400.png', w: 400, h: 400,
    html: profile({ ground: PINE, ink: EMBER, roots: true, frac: 60 }) },
  { file: 'sixfold-square-logo-1024.png', w: 1024, h: 1024,
    html: profile({ ground: PINE, ink: EMBER, roots: true, frac: 60 }) },
  { file: 'sixfold-square-logo-on-bone-1024.png', w: 1024, h: 1024,
    html: profile({ ground: BONE, ink: EMBER_ON_LIGHT, roots: true, frac: 60 }) },

  /* Invoice / estimate FULL layout header — 2:1. */
  { file: 'sixfold-square-invoice-full-1280x648.png', w: 1280, h: 648,
    html: lockup({ w: 1280, h: 648, ref: 1.975, tagline: true, phone: false }) },
  { file: 'sixfold-square-invoice-full-2560x1296.png', w: 2560, h: 1296,
    html: lockup({ w: 2560, h: 1296, ref: 1.975, tagline: true, phone: false }) },

  /* Printed thermal receipt logo — white, flat ink, 2:1. */
  { file: 'sixfold-square-receipt-print-800x400.png', w: 800, h: 400,
    html: receiptPrint({ w: 800, h: 400 }) },

  /* Square Register / Stand idle customer display — 16:10. */
  { file: 'sixfold-square-customer-display-2560x1600.png', w: 2560, h: 1600,
    html: lockup({ w: 2560, h: 1600, ref: 1.6, tagline: true, phone: true }) },

  /* eGift card custom design — 8:5. */
  { file: 'sixfold-square-egift-640x400.png', w: 640, h: 400,
    html: lockup({ w: 640, h: 400, ref: 1.6, descriptor: true, tagline: false, phone: false }) },

  /* Square Online / booking-site hero / banner / background. */
  { file: 'sixfold-square-online-banner-2400x1200.png', w: 2400, h: 1200,
    html: lockup({ w: 2400, h: 1200, ref: 2, tagline: true, phone: true }) },

  /* Square Online favicon + app/site icon — crest only. */
  { file: 'sixfold-square-favicon-64.png', w: 64, h: 64,
    html: profile({ ground: PINE, ink: EMBER, roots: false, frac: 76 }) },
  { file: 'sixfold-square-appicon-512.png', w: 512, h: 512,
    html: profile({ ground: PINE, ink: EMBER, roots: false, frac: 72 }) },

  /* Physical gift-card artwork proof — CR80, full bleed. */
  { file: 'sixfold-square-giftcard-proof-1037x664.png', w: 1037, h: 664,
    html: giftcard({ w: 1037, h: 664 }) },
];

for (const a of ASSETS) {
  const page = `<!doctype html><meta charset="utf-8"><style>${CSS}
    body{width:${a.w}px;height:${a.h}px}
    .art{width:${a.w}px;height:${a.h}px}</style>${a.html}`;
  const src = join(tmp, a.file.replace('.png', '.html'));
  writeFileSync(src, page, 'utf8');

  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--force-prefers-reduced-motion',
    '--default-background-color=00000000',
    '--virtual-time-budget=3000',
    `--window-size=${a.w},${a.h}`,
    `--screenshot=${join(here, a.file)}`,
    `file:///${src.replace(/\\/g, '/')}`,
  ], { stdio: 'ignore' });

  console.log(`${a.file}  ${a.w}x${a.h}`);
}
