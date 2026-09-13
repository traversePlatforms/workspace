/*
  Surge — social profile and banner generator.

  One artwork definition, exported at every platform's exact upload pixel size by
  screenshotting an HTML page in headless Chrome at that window size with device
  scale factor 1. Change the composition here and the whole set re-exports so
  every platform stays consistent.

  Identity (from brand/guidelines/README.md, the dark website ramp):
    ground  #0a0a0a   green  #4abe4a   text  #f4f4f4   grey  #ababab   line #333
  Wordmark: brand/logos/surge-wordmark.svg  (traced master, currentColor).
  Device:   three bars stepping up to the right — the wordmark's own interlocking
            bars, extended to a motion mark. Never touch (a clear channel between
            each), the rule the wordmark is built on.

  Run:  node build-social.mjs
  Needs Chrome. Outputs .png into ./out, provenance into ./out/MANIFEST.json.
*/
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tmp = join(here, '.build');
const out = join(here, 'out');
mkdirSync(tmp, { recursive: true });
mkdirSync(out, { recursive: true });

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/* Palette — the dark website ramp. */
const INK = '#0a0a0a';
const GREEN = '#4abe4a';
const TEXT = '#f4f4f4';
const GREY = '#ababab';

/* Descriptor line. Plain category label — cleared in brand/notes/RESTRICTED.md
   ("Clear to use"). Alternates that also clear: "HIRING · TRAINING · MANAGING
   SALES TEAMS", "FIELD SALES, HANDLED". No superiority or uniqueness claim. */
const DESCRIPTOR = 'Outsourced sales & marketing';

/* Wordmark path, lifted from the traced master so there is one file to maintain. */
const WM_SVG = readFileSync(join(here, '..', '..', 'brand', 'logos', 'surge-wordmark.svg'), 'utf8');
const WM_PATH = WM_SVG.match(/<path[^>]*\/>/)[0];
const WM_RATIO = 598 / 162; // from the master viewBox
const wordmark = (color) =>
  `<svg class="wm" viewBox="0 0 598 162" fill-rule="evenodd" style="color:${color}"
        role="img" aria-label="Surge">${WM_PATH}</svg>`;

/* ---------------------------------------------------------------------------
   The bars. viewBox 0 0 120 90. Three equal bars, thickness 18, stepping up
   and right, a clear 12-unit channel between each — they never touch.
--------------------------------------------------------------------------- */
const BARS = `
  <rect x="0"  y="72" width="80" height="18"/>
  <rect x="20" y="42" width="80" height="18"/>
  <rect x="40" y="12" width="80" height="18"/>`;
const bars = (color, cls = 'bars') =>
  `<svg class="${cls}" viewBox="0 0 120 90" role="img" aria-label="Surge" style="color:${color}">
     <g fill="currentColor">${BARS}</g>
   </svg>`;

/* ---------------------------------------------------------------------------
   Avatar. Square, but every platform crops it to a circle, so the mark sits
   inside a centred circle of 0.72×side with margin. Bars only — the wordmark
   is 3.69:1 and has no readable square form (brand/logos/README.md).
--------------------------------------------------------------------------- */
const avatar = ({ ground = INK, ink = GREEN } = {}) => `
<div class="art avatar" style="background:${ground}">
  <div class="lift"></div>
  <div class="bwrap">${bars(ink)}</div>
</div>`;

/* Instagram highlight cover. Circle-cropped by Instagram; a single green line
   icon on the ground, no text (Instagram clips it). */
const HL_ICONS = {
  door: '<rect x="15" y="7" width="18" height="34"/><circle cx="28" cy="24" r="1.8" fill="currentColor" stroke="none"/>',
  phone: '<rect x="16" y="4" width="16" height="40" rx="3"/><line x1="16" y1="36" x2="32" y2="36"/>',
  headset: '<path d="M11 26 a13 13 0 0 1 26 0"/><rect x="7" y="26" width="7" height="12" rx="2"/><rect x="34" y="26" width="7" height="12" rx="2"/><path d="M37 38 v3 a4 4 0 0 1 -4 4 h-7"/>',
  booth: '<path d="M8 20 L24 8 L40 20"/><line x1="10" y1="20" x2="10" y2="41"/><line x1="38" y1="20" x2="38" y2="41"/><line x1="6" y1="41" x2="42" y2="41"/><path d="M24 8 v-4 h6 v4"/>',
  team: '<circle cx="18" cy="19" r="6"/><circle cx="32" cy="19" r="6"/><path d="M8 40 c0-7 5-11 10-11 s10 4 10 11"/><path d="M22 40 c0-7 5-11 10-11 s10 4 10 11"/>',
  chart: '<line x1="9" y1="7" x2="9" y2="41"/><line x1="9" y1="41" x2="43" y2="41"/><polyline points="14,34 22,26 28,30 40,15"/><polyline points="33,15 40,15 40,22"/>',
};
const highlight = (icon) => `
<div class="art hl" style="background:${INK}">
  <div class="lift"></div>
  <svg class="hlicon" viewBox="0 0 48 48" fill="none" stroke="${GREEN}" stroke-width="2.4"
       stroke-linecap="round" stroke-linejoin="round">${HL_ICONS[icon]}</svg>
</div>`;

/* ---------------------------------------------------------------------------
   Banner. Wordmark + descriptor centred, a green floor rule the bars rise from
   on the right, a faint ghost of the bars behind. Centre-weighted: several
   platforms crop the sides of a cover and none publish the crop, so everything
   that must survive sits in the middle.

     variant 'full'    — roomy ratios (Facebook, YouTube, 16:9, GBP cover)
     variant 'compact' — 3:1–4:1 strips (X, Nextdoor, LinkedIn personal)
     variant 'slim'    — the LinkedIn company 5.9:1 strip: one row, no descriptor
     safe:true         — keep the lockup inside YouTube's 1546×423 all-device box
--------------------------------------------------------------------------- */
const banner = ({ w, h, variant = 'full', safe = false }) => {
  const F = safe ? 0.22 : { full: 0.34, compact: 0.42, slim: 0.26 }[variant];
  const wmW = Math.round(w * F);
  const wmH = wmW / WM_RATIO;
  const floorH = Math.max(3, Math.min(6, Math.round(h * 0.01)));

  if (variant === 'slim') {
    // one centred row: bars · wordmark. No descriptor — the strip is ~5.9:1.
    const rowH = Math.round(h * 0.46);
    const barsW = Math.round(rowH * (120 / 90));
    return `
<div class="art banner slim" style="background:${INK};width:${w}px;height:${h}px">
  <div class="glow"></div>
  <div class="row" style="gap:${Math.round(rowH * 0.55)}px">
    <div class="bwrap" style="width:${barsW}px;height:${rowH}px">${bars(GREEN, 'bars-svg')}</div>
    <div class="wm-wrap" style="width:${wmW}px">${wordmark(TEXT)}</div>
  </div>
  <div class="floor" style="height:${floorH}px;bottom:0;background:${GREEN}"></div>
</div>`;
  }

  // centred: [bars · wordmark] lockup, descriptor beneath, green baseline rule.
  const lockH = Math.round(wmH * 0.9);
  const barsW = Math.round(lockH * (120 / 90));
  const descF = Math.max(12, Math.round(wmH * (variant === 'compact' ? 0.15 : 0.17)));
  return `
<div class="art banner" style="background:${INK};width:${w}px;height:${h}px">
  <div class="glow"></div>
  <div class="stack">
    <div class="lock" style="gap:${Math.round(wmH * 0.32)}px">
      <div class="bwrap" style="width:${barsW}px;height:${lockH}px">${bars(GREEN, 'bars-svg')}</div>
      <div class="wm-wrap" style="width:${wmW}px">${wordmark(TEXT)}</div>
    </div>
    <div class="desc" style="font-size:${descF}px;color:${GREY};margin-top:${Math.round(wmH * 0.34)}px">${DESCRIPTOR}</div>
  </div>
  <div class="floor" style="height:${floorH}px;bottom:0;background:${GREEN}"></div>
</div>`;
};

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#000}
  body{display:flex;align-items:center;justify-content:center;overflow:hidden;
       font-family:ui-monospace,"Cascadia Mono","Segoe UI Mono",Consolas,"DejaVu Sans Mono",monospace}
  .art{position:relative;overflow:hidden}
  svg{display:block}

  /* avatar */
  .avatar{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
  .avatar .lift{position:absolute;inset:0;
    background:radial-gradient(120% 120% at 30% 0%, rgba(255,255,255,.05), rgba(255,255,255,0) 60%)}
  .avatar .bwrap{position:relative;width:50%;display:flex;align-items:center;justify-content:center;
    transform:translate(-1.5%,-3%)}
  .avatar .bars{width:100%;height:auto}

  /* instagram highlight */
  .hl{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
  .hl .lift{position:absolute;inset:0;
    background:radial-gradient(120% 120% at 30% 0%, rgba(255,255,255,.05), rgba(255,255,255,0) 60%)}
  .hl .hlicon{position:relative;width:34%;height:34%}

  /* banner */
  .banner .glow{position:absolute;inset:0;background:
    radial-gradient(120% 150% at 50% 118%, rgba(74,190,74,.16) 0%, rgba(74,190,74,.04) 40%, rgba(74,190,74,0) 68%)}
  .banner .bwrap .bars-svg{width:100%;height:100%}
  .floor{position:absolute;left:0;right:0}
  .stack{position:absolute;inset:0;display:flex;flex-direction:column;
         align-items:center;justify-content:center;padding:0 5%}
  .banner .lock{display:flex;align-items:center;justify-content:center}
  .banner .lock .bwrap{display:flex;align-items:center;justify-content:center}
  .banner .row{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
  .banner .row .bwrap{display:flex;align-items:center;justify-content:center}
  .wm-wrap{position:relative}
  .wm-wrap .wm{width:100%;height:auto;fill:currentColor}
  .desc{text-transform:uppercase;letter-spacing:.2em;text-indent:.2em;
        white-space:nowrap;font-weight:400}
`;

/* ---------------------------------------------------------------------------
   Asset list. `platform` / `field` travel into out/MANIFEST.json and the
   upload guide, so where every file goes is recorded with the file.
--------------------------------------------------------------------------- */
const A = [];
const push = (file, w, h, html, platform, field, note = '') =>
  A.push({ file, w, h, html, platform, field, note });

/* -- Avatars: one artwork, one file named per destination ------------------ */
const AV = avatar();
push('surge-avatar-linkedin-400.png', 400, 400, AV, 'LinkedIn (Surge company page)',
  'Admin view › Edit page › Page logo. Square, min 268px, shown ~60–130px.');
push('surge-avatar-facebook-500.png', 500, 500, AV, 'Facebook (Surge page)',
  'Settings › Page details › Profile picture. Circle crop, shown 176px desktop / 196px mobile.');
push('surge-avatar-instagram-320.png', 320, 320, AV, 'Instagram (Surge)',
  'Edit profile › Change profile photo. Circle crop, shown ~110–180px.');
push('surge-avatar-x-400.png', 400, 400, AV, 'X (Surge)',
  'Profile › Edit profile › profile photo. Circle crop, shown ~133px.');
push('surge-avatar-nextdoor-1200.png', 1200, 1200, AV, 'Nextdoor (Surge business page)',
  'Business page › Edit › Business logo / profile photo. Circle crop.');
push('surge-avatar-youtube-800.png', 800, 800, AV, 'YouTube (Surge channel)',
  'Customise channel › Branding › Picture. Min 98px, 4MB max. Circle crop.');
push('surge-logo-google-720.png', 720, 720, AV, 'Google Business Profile (Surge)',
  'Photos › Logo. Google recommends exactly 720×720; min 250×250; 10KB–5MB.');
push('surge-avatar-master-1024.png', 1024, 1024, AV, '— master —',
  'Fallback / any field not listed. Downscale as needed.');

/* -- Banners ------------------------------------------------------------------ */
push('surge-banner-linkedin-company-1128x191.png', 1128, 191,
  banner({ w: 1128, h: 191, variant: 'slim' }), 'LinkedIn (Surge company page)',
  'Admin view › Edit page › Cover image. 1128×191 min, ~4:1. Keep the lower-left ~180px clear — the page tucks the logo tile there.');
push('surge-banner-linkedin-personal-1584x396.png', 1584, 396,
  banner({ w: 1584, h: 396, variant: 'compact' }), 'LinkedIn (personal profile — optional)',
  'Profile › camera icon on the background › Add photo. 1584×396 (4:1). Lower-left is covered by the profile photo.');
push('surge-banner-facebook-1640x624.png', 1640, 624,
  banner({ w: 1640, h: 624, variant: 'full' }), 'Facebook (Surge page)',
  'Page › Edit cover photo. Uploads at 1640×624; desktop shows ~820×312, mobile crops to the centre ~640 wide — content is centred for that.');
push('surge-banner-x-1500x500.png', 1500, 500,
  banner({ w: 1500, h: 500, variant: 'compact' }), 'X (Surge)',
  'Profile › Edit profile › header photo. 1500×500 (3:1). Lower-left is covered by the profile photo.');
push('surge-banner-nextdoor-1440x400.png', 1440, 400,
  banner({ w: 1440, h: 400, variant: 'compact' }), 'Nextdoor (Surge business page)',
  'Business page › Edit › Cover photo. 1440×400 working assumption (~3.6:1) — confirm the crop box in the dialog.');
push('surge-banner-youtube-2560x1440.png', 2560, 1440,
  banner({ w: 2560, h: 1440, variant: 'full', safe: true }), 'YouTube (Surge channel)',
  'Customise channel › Branding › Banner image. Upload 2560×1440; only the centre 1546×423 is guaranteed on every device — the lockup is inside it.');
push('surge-banner-google-1024x576.png', 1024, 576,
  banner({ w: 1024, h: 576, variant: 'full' }), 'Google Business Profile (Surge)',
  'Photos › Cover. 16:9. Setting a cover does not guarantee it shows first.');
push('surge-banner-16x9-1920x1080.png', 1920, 1080,
  banner({ w: 1920, h: 1080, variant: 'full' }), '— general 16:9 —',
  'Any other 16:9 slot (event headers, slide backplate, etc.).');

/* -- Instagram highlight covers (optional) --------------------------------- */
for (const [i, ic] of ['door', 'phone', 'headset', 'booth', 'team', 'chart'].entries())
  push(`surge-ig-highlight-${i + 1}-${ic}.png`, 1080, 1080, highlight(ic),
    'Instagram (Surge) — Story Highlight cover',
    'Add to a Highlight › Edit › cover. Instagram shows the centre circle only; icons are centred for that.');

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
  ['Profile pictures & logo  (one artwork — upload the file named for the platform)', /avatar|logo/],
  ['Banners / cover images', /banner/],
  ['Instagram Story Highlight covers  (optional)', /highlight/],
];
const card = (m) => `
  <figure>
    <div class="frame ${/avatar|logo|highlight/.test(m.file) ? 'sq' : 'wide'}"><img src="${m.file}" alt=""></div>
    <figcaption>
      <code>${m.file}</code>
      <b>${m.platform}</b>
      <span>${m.size}px &middot; ${m.field}</span>
      ${m.note ? `<span class="note">${m.note}</span>` : ''}
    </figcaption>
  </figure>`;
const review = `<!doctype html><meta charset="utf-8"><title>Surge social kit — review</title>
<style>
  body{margin:0;background:#0d0d0d;color:#e8e8e8;padding:40px 32px;
    font:14px/1.5 ui-monospace,"Cascadia Mono",Consolas,monospace}
  h1{font:600 22px/1.2 system-ui;margin:0 0 4px} h2{font:600 15px/1.4 system-ui;margin:44px 0 14px;color:#4abe4a}
  p.lead{color:#9a9a9a;margin:0 0 8px;max-width:70ch}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:22px}
  figure{margin:0;background:#161616;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden}
  .frame{background:#000;display:flex;align-items:center;justify-content:center}
  .frame.sq{aspect-ratio:1/1;padding:26px} .frame.wide{padding:0}
  .frame img{max-width:100%;max-height:340px;display:block}
  figcaption{padding:12px 14px;display:flex;flex-direction:column;gap:3px}
  figcaption code{color:#4abe4a;font-size:12px;word-break:break-all}
  figcaption b{font:600 13px system-ui} figcaption span{color:#9a9a9a;font-size:12px}
  figcaption .note{color:#7a7a7a}
</style>
<h1>Surge &mdash; social media kit</h1>
<p class="lead">Rendered by build-social.mjs. Draft &amp; stage only &mdash; nothing here has been uploaded or posted.
Full field-by-field instructions in UPLOAD-GUIDE.md.</p>
${groups.map(([title, re]) => `<h2>${title}</h2><div class="grid">${manifest.filter((m) => re.test(m.file)).map(card).join('')}</div>`).join('')}`;
writeFileSync(join(out, 'review.html'), review);

console.log(`\n${A.length} files → ${out}   (open out/review.html)`);
