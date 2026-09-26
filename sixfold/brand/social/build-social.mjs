/*
  Sixfold Colorado — social profile and banner generator.

  One artwork definition, exported at every platform's exact upload pixel size by
  screenshotting an HTML page in headless Chrome at that window size with device
  scale factor 1. Change the composition here and the whole set re-exports so
  every platform stays consistent.

  Mark:     RIDGE, single colour, SAGE (#A7BE93) on Pine / TURF (#2F7A4F) on Bone.
            Was Ember until the palette A rebrand, 2026-09-25 — see the palette block.
            From ../sixfold-mark-ridge-mono.svg
            (currentColor, so colour is set on the wrapper, never in the path).
            If Sweep wins the open A/C call, swap RIDGE_* below and re-run.
  Wordmark: "Sixfold" — Palatino / Book Antiqua serif, -0.018em.
  Contact:  Monument · Front Range · (303) 915-1045

  Run:  node build-social.mjs
  Needs Chrome. Outputs .png into ./out, provenance into ./out/MANIFEST.json.
*/
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tmp = join(here, '.build');
const out = join(here, 'out');
mkdirSync(tmp, { recursive: true });
mkdirSync(out, { recursive: true });

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/* Palette — the agreed Sixfold five, plus the two greens palette A added.
   ---- REBRANDED TO PALETTE A, 2026-09-25 -------------------------------------
   Aeration leads, so green leads. Ember is now ABSENT from this kit entirely.
   Under palette A ember keeps exactly two jobs — the call to action, and fire
   mitigation — and a profile mark and a banner rule are neither. Removing it is
   the whole visible point of the rebrand at profile size: the old kit read as a
   fire company because the mark was orange.

   Ratios measured against Pine #0E1512 and Bone #EDE7DC in site/assets/site.css:
     SAGE #A7BE93 ... 9.19 on Pine  <- the mark on dark, and the one that carries
     MOSS #8AA07A ... 6.51 on Pine  <- the rule, descriptor and contact line
     TURF #2F7A4F ... 4.25 on Bone  <- the mark on the LIGHT alternate; Sage is
                                       1.64 on Bone and would vanish
   Two greens at different values, so the mark still separates from the rule
   without borrowing a second hue to do it. */
const PINE = '#0E1512';
const EMBER = '#E4703A';   // kept as a constant; deliberately UNUSED in this kit
const BONE = '#EDE7DC';
const MOSS = '#8AA07A';
const SAGE = '#A7BE93';
const TURF = '#2F7A4F';

/* Standing lines — reused, not reinvented. Fact-checked in
   ../../marketing/facebook-page-copy.md.

   DESCRIPTOR: Matthew's call 2026-09-25 — "Land & Fire" stays for now, alongside
   the new tagline. brand/tagline-2026-09/ recommends retiring it and Phase 1 of
   REBRAND-PATH-2026-09.md makes that Brandon's call; nothing here is uploaded, so
   it is free to change.

   BIO: replaced 2026-09-25. The old line — "We do the work and show you who pays
   for it." — was a FUNDING promise resting on the state tax credit and the
   HB25-1182 re-score, both of which apply to qualifying vegetation work. Nobody
   else pays for an aeration, so on the lead service it was not off-message, it
   was untrue. Reasoning and the candidates: brand/tagline-2026-09/.

   CONTACT: was "Fire mitigation · Front Range · (303) 915-1045", which led with
   the demoted service in the line under the bio. Now lawn-first and matching the
   descriptor already states the services directly above it, so repeating them read
   as a stutter on the render — this line carries the BASE TOWN and the phone, which
   is what a local-search profile actually wants under a lockup. */
const DESCRIPTOR = 'Land & Fire';
const BIO = 'From the lawn to the treeline, all year long.';
const CONTACT = 'Monument · Front Range · (303) 915-1045';
const PHONE_ONLY = '(303) 915-1045';

/* ---------------------------------------------------------------------------
   The Ridge mark, single colour. `crest` stops at the ground line; `roots`
   adds the ten strands (they turn to mush below ~96px, so crest is for small
   circular crops). viewBox is tight to the drawn artwork, not the 0 0 100 116
   source canvas — see README.
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

/* ---------------------------------------------------------------------------
   Profile mark. Circle-cropped everywhere, so the artwork sits inside a
   centred circle with margin and a 2% optical lift (roots weight it low).
--------------------------------------------------------------------------- */
const profile = ({ ground, ink, roots }) => `
<div class="art profile" style="background:${ground};color:${ink}">
  <div class="markwrap">${mark(roots)}</div>
</div>`;

/* Instagram highlight cover — one ember line icon, circle-cropped, no text. */
const HL = {
  tree: '<path d="M24 5 L15 21 h5 L13 34 h22 L28 21 h5 Z"/><line x1="24" y1="34" x2="24" y2="43"/>',
  flame: '<path d="M25 4 C 31 13 35 18 35 27 a11 11 0 0 1 -22 0 C 13 20 19 18 19 12 C 23 16 25 20 23 24 C 28 22 29 15 25 4 Z"/>',
  axe: '<path d="M13 41 L31 15"/><path d="M27 7 C 34 5 41 10 41 17 C 34 15 30 17 28 22 C 23 17 22 10 27 7 Z"/>',
  chipper: '<rect x="6" y="17" width="21" height="15"/><path d="M27 21 h6 l7 6 v5 h-13 Z"/><circle cx="13" cy="36" r="3"/><circle cx="34" cy="36" r="3"/><path d="M3 11 l6 4 M2 17 l7 1"/>',
  shield: '<path d="M24 4 L40 10 V24 C 40 34 32 42 24 44 C 16 42 8 34 8 24 V10 Z"/><path d="M17 25 L24 18 L31 25 V33 H17 Z"/>',
  doc: '<path d="M13 4 h14 l8 8 v32 h-30 Z"/><path d="M27 4 v8 h8"/><line x1="16" y1="22" x2="31" y2="22"/><line x1="16" y1="28" x2="31" y2="28"/><line x1="16" y1="34" x2="25" y2="34"/>',
};
const highlight = (icon) => `
<div class="art hl" style="background:${PINE}">
  <svg class="hlicon" viewBox="0 0 48 48" fill="none" stroke="${SAGE}" stroke-width="2.3"
       stroke-linecap="round" stroke-linejoin="round">${HL[icon]}</svg>
</div>`;

/* ---------------------------------------------------------------------------
   Banner. Centre-weighted and symmetric — several platforms crop the sides of
   a cover and none publish the crop, so what must survive lives in the middle.

     full    — Facebook, 16:9, Google cover: lockup · descriptor · rule · bio · contact
     compact — X, Nextdoor, LinkedIn personal, YouTube: lockup · descriptor · rule · contact
     slim    — LinkedIn company 5.9:1: one row — mark · Sixfold · | · phone
--------------------------------------------------------------------------- */
const banner = ({ w, h, variant = 'full' }) => {
  const fFont = { full: 0.072, compact: 0.085, slim: 0.056 }[variant];
  const f = Math.round(w * fFont);                 // wordmark font size, px
  const markW = Math.round(f * 0.82);

  if (variant === 'slim') {
    return `
<div class="art banner" style="background:${PINE};width:${w}px;height:${h}px">
  <div class="glow"></div>
  <div class="row" style="gap:${Math.round(f * 0.5)}px">
    <div class="markwrap" style="width:${markW}px;color:${SAGE}">${mark(true)}</div>
    <div class="wordmark" style="font-size:${f}px;color:${BONE}">Sixfold</div>
    <div class="div" style="height:${Math.round(f * 1.1)}px;background:${MOSS}"></div>
    <div class="phone" style="font-size:${Math.round(f * 0.34)}px;color:${MOSS}">${PHONE_ONLY}</div>
  </div>
</div>`;
  }

  return `
<div class="art banner" style="background:${PINE};width:${w}px;height:${h}px">
  <div class="glow"></div>
  <div class="stack">
    <div class="lockup" style="gap:${Math.round(f * 0.42)}px">
      <div class="markwrap" style="width:${markW}px;color:${SAGE}">${mark(true)}</div>
      <div class="wordmark" style="font-size:${f}px;color:${BONE}">Sixfold</div>
    </div>
    <div class="descriptor" style="font-size:${Math.round(f * 0.17)}px;margin-top:${Math.round(f * 0.3)}px;color:${MOSS}">${DESCRIPTOR}</div>
    <div class="rule" style="width:${Math.round(f * 2.3)}px;height:${Math.max(2, Math.round(f * 0.032))}px;background:${MOSS};margin-top:${Math.round(f * (variant === 'compact' ? 0.4 : 0.5))}px"></div>
    ${variant === 'full' ? `<div class="line" style="font-size:${Math.round(f * 0.32)}px;margin-top:${Math.round(f * 0.42)}px;color:${BONE}">${BIO}</div>` : ''}
    <div class="phone" style="font-size:${Math.round(f * 0.17)}px;margin-top:${Math.round(f * 0.4)}px;color:${MOSS}">${CONTACT}</div>
  </div>
</div>`;
};

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#000}
  body{display:flex;align-items:center;justify-content:center;overflow:hidden}
  .art{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
  svg{display:block}

  .profile{width:100%;height:100%}
  .profile .markwrap{width:62%;display:flex;align-items:center;justify-content:center;transform:translateY(-2%)}
  .profile .mark{width:100%;height:auto}

  .hl{width:100%;height:100%}
  .hl .hlicon{width:34%;height:34%}

  /* The glow was an EMBER wash (rgba(228,112,58,...)) until 2026-09-25. It was the
     last orange in the kit and the one nobody sees as orange — it just made every
     banner feel like a fire company. Moss, same geometry, so it now reads as light
     coming off grass rather than off a burn. */
  .banner .glow{position:absolute;inset:0;
    background:radial-gradient(120% 150% at 50% 118%, rgba(138,160,122,0.20) 0%, rgba(138,160,122,0.055) 38%, rgba(138,160,122,0) 66%)}
  .stack{position:relative;display:flex;flex-direction:column;align-items:center;width:100%;padding:0 6%}
  .row{position:relative;display:flex;align-items:center;justify-content:center;width:100%;padding:0 6%}
  .lockup{display:flex;align-items:center}
  .markwrap{display:flex;align-items:center;justify-content:center}
  .markwrap .mark{width:100%;height:auto}
  .wordmark{font-family:"Palatino Linotype","Book Antiqua",Palatino,"Iowan Old Style",Georgia,serif;
    line-height:0.84;letter-spacing:-0.018em;white-space:nowrap}
  .div{width:2px;opacity:.6}
  .descriptor{font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace;
    letter-spacing:0.34em;text-transform:uppercase;text-indent:0.34em;white-space:nowrap}
  .rule{opacity:0.95}
  .line{font-family:"Palatino Linotype","Book Antiqua",Palatino,"Iowan Old Style",Georgia,serif;
    line-height:1.16;text-align:center;text-wrap:balance;max-width:80%}
  .phone{font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,monospace;
    letter-spacing:0.2em;text-transform:uppercase;text-align:center;text-indent:0.2em;white-space:nowrap}
`;

/* ---------------------------------------------------------------------------
   Asset list. platform / field travel into out/MANIFEST.json + the guide.
--------------------------------------------------------------------------- */
const A = [];
const push = (file, w, h, html, platform, field, note = '') =>
  A.push({ file, w, h, html, platform, field, note });

const P_FULL = profile({ ground: PINE, ink: SAGE, roots: true });   // large / roomy crops
const P_CREST = profile({ ground: PINE, ink: SAGE, roots: false }); // small circular crops
const P_BONE = profile({ ground: BONE, ink: TURF, roots: true });   // light-ground alternate  (Sage is 1.64 on Bone)

/* -- Profile / logo: one artwork, one file named per destination ---------- */
push('sixfold-avatar-linkedin-400.png', 400, 400, P_CREST, 'LinkedIn (Sixfold Colorado page)',
  'Admin › Edit page › Page logo. Square, min 300px. Shown small — crest, no roots.');
push('sixfold-avatar-facebook-500.png', 500, 500, P_CREST, 'Facebook (Sixfold Colorado page)',
  'Settings › Page details › Profile picture. Circle crop, shown 176/196px — crest.');
push('sixfold-avatar-instagram-320.png', 320, 320, P_CREST, 'Instagram (Sixfold Colorado)',
  'Edit profile › Change profile photo. Circle crop — crest.');
push('sixfold-avatar-x-400.png', 400, 400, P_CREST, 'X (Sixfold Colorado)',
  'Profile › Edit profile. Circle crop — crest.');
push('sixfold-avatar-nextdoor-1200.png', 1200, 1200, P_FULL, 'Nextdoor (Sixfold Colorado business page)',
  'Business page › Edit › Business logo. Circle crop. Full mark with roots.');
push('sixfold-avatar-youtube-800.png', 800, 800, P_FULL, 'YouTube (Sixfold Colorado channel)',
  'Customise channel › Branding › Picture. Min 98px, 4MB max. Full mark.');
push('sixfold-logo-google-720.png', 720, 720, P_FULL, 'Google Business Profile (Sixfold Colorado)',
  'Photos › Logo. Google recommends exactly 720×720; min 250; 10KB–5MB. Logo shows only once the profile carries name, address, category, phone, hours.');
push('sixfold-avatar-on-bone-1024.png', 1024, 1024, P_BONE, '— light-ground alternate —',
  'Any placement that sits the avatar on dark chrome and needs a light tile.');
push('sixfold-avatar-master-1024.png', 1024, 1024, P_FULL, '— master —',
  'Fallback for any field not listed. Downscale as needed.');

/* -- Banners ------------------------------------------------------------------ */
push('sixfold-banner-linkedin-company-1128x191.png', 1128, 191,
  banner({ w: 1128, h: 191, variant: 'slim' }), 'LinkedIn (Sixfold Colorado page)',
  'Admin › Edit page › Cover image. 1128×191 min (~4:1). Keep lower-left ~180px clear — logo tile sits there.');
push('sixfold-banner-linkedin-personal-1584x396.png', 1584, 396,
  banner({ w: 1584, h: 396, variant: 'compact' }), 'LinkedIn (personal profile — optional)',
  'Profile › camera icon on the background › Add photo. 1584×396 (4:1). Lower-left covered by the profile photo.');
push('sixfold-banner-facebook-1640x624.png', 1640, 624,
  banner({ w: 1640, h: 624, variant: 'full' }), 'Facebook (Sixfold Colorado page)',
  'Page › Edit cover photo. Uploads 1640×624; desktop shows ~820×312, mobile crops toward centre — content is centred for that.');
push('sixfold-banner-x-1500x500.png', 1500, 500,
  banner({ w: 1500, h: 500, variant: 'compact' }), 'X (Sixfold Colorado)',
  'Profile › Edit profile › header photo. 1500×500 (3:1). Lower-left covered by the profile photo.');
push('sixfold-banner-nextdoor-1440x400.png', 1440, 400,
  banner({ w: 1440, h: 400, variant: 'compact' }), 'Nextdoor (Sixfold Colorado business page)',
  'Business page › Edit › Cover photo. 1440×400 working assumption (~3.6:1) — confirm the crop box in the dialog.');
push('sixfold-banner-youtube-2560x1440.png', 2560, 1440,
  banner({ w: 2560, h: 1440, variant: 'compact' }), 'YouTube (Sixfold Colorado channel)',
  'Customise channel › Branding › Banner image. Upload 2560×1440; only the centre 1546×423 shows on every device — the lockup is inside it.');
push('sixfold-banner-google-1024x576.png', 1024, 576,
  banner({ w: 1024, h: 576, variant: 'full' }), 'Google Business Profile (Sixfold Colorado)',
  'Photos › Cover. 16:9. Setting a cover does not guarantee it shows first.');
push('sixfold-banner-16x9-1920x1080.png', 1920, 1080,
  banner({ w: 1920, h: 1080, variant: 'full' }), '— general 16:9 —',
  'Any other 16:9 slot.');

/* -- Instagram highlight covers (optional) ------------------------------------ */
for (const [i, ic] of ['tree', 'flame', 'axe', 'chipper', 'shield', 'doc'].entries())
  push(`sixfold-ig-highlight-${i + 1}-${ic}.png`, 1080, 1080, highlight(ic),
    'Instagram (Sixfold Colorado) — Story Highlight cover',
    'Add to a Highlight › Edit › cover. Instagram shows the centre circle only.');

/* -- Render ---------------------------------------------------------------- */
const manifest = [];
for (const a of A) {
  const page = `<!doctype html><meta charset="utf-8"><style>${CSS}
    body{width:${a.w}px;height:${a.h}px}
    .art{width:${a.w}px;height:${a.h}px}</style>${a.html}`;
  const src = join(tmp, a.file.replace('.png', '.html'));
  writeFileSync(src, page, 'utf8');
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--force-prefers-reduced-motion',
    '--default-background-color=00000000', '--virtual-time-budget=3000',
    `--window-size=${a.w},${a.h}`,
    `--screenshot=${join(out, a.file)}`,
    `file:///${src.replace(/\\/g, '/')}`,
  ], { stdio: 'ignore' });
  manifest.push({ file: a.file, size: `${a.w}x${a.h}`, platform: a.platform, field: a.field, note: a.note });
  console.log(`${a.file}  ${a.w}x${a.h}  → ${a.platform}`);
}
writeFileSync(join(out, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));

/* Visual contact sheet — every asset at a legible size with its label. */
const groups = [
  ['Profile marks & logo  (one artwork — upload the file named for the platform)', /avatar|logo/],
  ['Banners / cover images', /banner/],
  ['Instagram Story Highlight covers  (optional)', /highlight/],
];
const card = (m) => `
  <figure>
    <div class="frame ${/avatar|logo|highlight/.test(m.file) ? 'sq' : 'wide'}"><img src="${m.file}" alt=""></div>
    <figcaption>
      <code>${m.file}</code><b>${m.platform}</b>
      <span>${m.size}px &middot; ${m.field}</span>
      ${m.note ? `<span class="note">${m.note}</span>` : ''}
    </figcaption>
  </figure>`;
const review = `<!doctype html><meta charset="utf-8"><title>Sixfold Colorado social kit — review</title>
<style>
  body{margin:0;background:#0b110e;color:#EDE7DC;padding:40px 32px;
    font:14px/1.5 ui-monospace,"Cascadia Mono",Consolas,monospace}
  h1{font:600 22px/1.2 Georgia,serif;margin:0 0 4px} h2{font:600 15px/1.4 system-ui;margin:44px 0 14px;color:#E4703A}
  p.lead{color:#8AA07A;margin:0 0 8px;max-width:70ch}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:22px}
  figure{margin:0;background:#141a17;border:1px solid #26302a;border-radius:8px;overflow:hidden}
  .frame{background:#000;display:flex;align-items:center;justify-content:center}
  .frame.sq{aspect-ratio:1/1;padding:26px} .frame.wide{padding:0}
  .frame img{max-width:100%;max-height:340px;display:block}
  figcaption{padding:12px 14px;display:flex;flex-direction:column;gap:3px}
  figcaption code{color:#E4703A;font-size:12px;word-break:break-all}
  figcaption b{font:600 13px system-ui} figcaption span{color:#8AA07A;font-size:12px}
  figcaption .note{color:#6f7f68}
</style>
<h1>Sixfold Colorado &mdash; social media kit</h1>
<p class="lead">Rendered by build-social.mjs. Draft &amp; stage only &mdash; no account created, nothing uploaded.
Contact line carries the new number (303) 915-1045. Field-by-field instructions in UPLOAD-GUIDE.md.</p>
${groups.map(([title, re]) => `<h2>${title}</h2><div class="grid">${manifest.filter((m) => re.test(m.file)).map(card).join('')}</div>`).join('')}`;
writeFileSync(join(out, 'review.html'), review);

console.log(`\n${A.length} files → ${out}   (open out/review.html)`);
