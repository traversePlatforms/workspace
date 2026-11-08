/* Traverse Facebook Page images (2026-11-08, Matthew is making a new Traverse Page himself; this builds the files he uploads).
   Brand graphics only: the mark, the name, the product line, trade pills, site and phone. No photos, no generated pictures, no people.
   Same look as the Nextdoor and Google Ads kits (navy grid, white tile with the colour mark, Familjen Grotesk / Atkinson Hyperlegible /
   JetBrains Mono), so the brand reads the same everywhere.

   Sizes
   - Profile picture 720 x 720. Facebook crops it to a circle: the reverse mark on navy, full bleed, the mark inside the middle 70%
     so the circle never touches it.
   - Cover 1640 x 624, options A (navy) and B (light). Built for Facebook's CURRENT Page layout, measured from Matthew's own upload of
     the first cover A on 8 Nov 2026 (his Desktop Preview): the profile picture sits CENTRED over the bottom-middle of the cover (circle
     about x 660-980, from y 225 down), and the computer view crops the cover top and bottom, showing only about y 110-514 (17.5% off
     each). The first build put the headline at the top and the site and phone in the middle; Facebook cut the one and covered the other.
     So: every word and key mark sits inside y 130-490; the centre column x 620-1020 is empty from y 200 down; the headline and trade
     pills are a left block (x 150-600, clear of the far-left 100 px in case phones crop the sides) and the traverse motif, site and
     phone a right block (x 1050-1500). Facebook's help page "Facebook Page profile picture and cover photo dimensions" (read 8 Nov)
     says covers are cropped differently per screen; the preview PNGs draw the measured layout first, then the older bottom-left
     layout and a side-cropped phone as secondary checks.
   - Meta app icon 1024 x 1024: the mark on solid navy, no text (Meta's App settings > Basic asks for 1024 x 1024).
   - Posts 1080 x 1350 and 1080 x 1080 for the first "we're here" post. No offer or prices in the pictures (they change; the post text
     carries the offer), so the pictures stay good for later.
   Fonts load from Google Fonts at render time, as on the website, so it needs a connection.
     node traverse/brand/facebook/build-facebook-images.mjs   ->  out/ beside this file */
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'out');
mkdirSync(OUT, { recursive: true });
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const u = (n) => pathToFileURL(join(OUT, n)).href;
const NAVY = '#13294B', FLAG = '#D6400C', FLAG_DK = '#FF7A45', INK = '#0F1B2D', MUTED = '#566476', LINE = '#DCE2EA', SURFACE = '#F4F6F9';
const fonts = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Familjen+Grotesk:wght@600;700&family=JetBrains+Mono:wght@500&display=swap">`;
/* the reverse mark (traverse-mark-reverse.svg), stations filled navy */
const mark = (px) => `<svg width="${px}" height="${px}" viewBox="0 0 64 64"><polyline points="9,47 24,31 37,40 53,17" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="47" r="5.2" fill="${NAVY}" stroke="#fff" stroke-width="3.6"/><circle cx="24" cy="31" r="5.2" fill="${NAVY}" stroke="#fff" stroke-width="3.6"/><circle cx="37" cy="40" r="5.2" fill="${NAVY}" stroke="#fff" stroke-width="3.6"/><circle cx="53" cy="17" r="8" fill="${FLAG}"/></svg>`;
/* the colour mark (traverse-mark-color.svg) */
const colorMark = (px) => `<svg width="${px}" height="${px}" viewBox="0 0 64 64"><polyline points="9,47 24,31 37,40 53,17" fill="none" stroke="${NAVY}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="47" r="5.2" fill="#fff" stroke="${NAVY}" stroke-width="3.6"/><circle cx="24" cy="31" r="5.2" fill="#fff" stroke="${NAVY}" stroke-width="3.6"/><circle cx="37" cy="40" r="5.2" fill="#fff" stroke="${NAVY}" stroke-width="3.6"/><circle cx="53" cy="17" r="8" fill="${FLAG}"/></svg>`;
/* the colour mark on a white tile, as in the share image; navy tile with the reverse mark for light grounds */
const tile = (px) => `<div style="width:${px}px;height:${px}px;border-radius:${Math.round(px * 0.22)}px;background:#fff;display:grid;place-items:center;flex:none">${colorMark(Math.round(px * 0.74))}</div>`;
const navyTile = (px) => `<div style="width:${px}px;height:${px}px;border-radius:${Math.round(px * 0.22)}px;background:${NAVY};display:grid;place-items:center;flex:none">${mark(Math.round(px * 0.74))}</div>`;
const lock = (t, f, light) => `<div class="lock" style="display:flex;align-items:center;gap:${Math.round(t * 0.28)}px">${light ? navyTile(t) : tile(t)}<span class="word" style="font-size:${f}px">Traverse Platforms</span></div>`;
const grid = `background-color:${NAVY};background-image:linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);background-size:60px 60px;background-position:-1px -1px`;
const gridLight = `background-color:${SURFACE};background-image:linear-gradient(rgba(19,41,75,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(19,41,75,.07) 1px,transparent 1px);background-size:60px 60px;background-position:-1px -1px`;
const base = `*{box-sizing:border-box;margin:0}body{font-family:'Atkinson Hyperlegible',sans-serif;color:#fff}
  .word{font:700 52px/1 'Familjen Grotesk',sans-serif;letter-spacing:-.01em}
  .kicker{font:500 21px 'JetBrains Mono',monospace;letter-spacing:.2em;color:${FLAG_DK}}
  h1{font:700 74px/1.04 'Familjen Grotesk',sans-serif;letter-spacing:-.02em}
  .sub{font:400 27px/1.4 'Atkinson Hyperlegible',sans-serif;color:#D5DEEA}
  .pills{display:flex;flex-wrap:wrap;gap:12px}
  .pills span{font:700 21px/1 'Atkinson Hyperlegible',sans-serif;padding:11px 20px;border-radius:999px;white-space:nowrap;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.35);color:#fff}
  .site{font:500 22px 'JetBrains Mono',monospace;letter-spacing:.06em;color:#D5DEEA}
  .site b{font-weight:500;color:#fff}.site i{font-style:normal;color:${FLAG_DK};padding:0 14px}`;
const TRADES = ['Roofing', 'Lawn &amp; Landscape', 'Solar', 'Pest control', 'Home security'];
const pills = (extra = '') => `<div class="pills"${extra}>${TRADES.map((t) => `<span>${t}</span>`).join('')}</div>`;
const HEADLINE = 'The all-in-one<br>sales platform<br>for the field and office.';
/* the covers' right-block motif: the mark's three legs and four stations drawn large, closing on the flag station */
const motif = (x0, y0, w, ink, ground) => {
  const pts = [[9, 47], [24, 31], [37, 40], [53, 17]].map(([x, y]) => [x0 + (x - 9) * w / 44, y0 + (y - 17) * w / 44]);
  const st = pts.slice(0, -1).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${w * 0.042}" fill="${ground}" stroke="${ink}" stroke-width="${w * 0.026}"/>`).join('');
  const [fx, fy] = pts[pts.length - 1];
  return `<svg style="position:absolute;left:0;top:0" width="1640" height="624" viewBox="0 0 1640 624"><polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${ink}" stroke-width="${w * 0.032}" stroke-linecap="round" stroke-linejoin="round"/>${st}<circle cx="${fx}" cy="${fy}" r="${w * 0.066}" fill="${FLAG}"/></svg>`;
};
const STATIONS = ['Map your territory', 'Work every lead', 'Quote and sign', 'Run the jobs', 'Get paid and keep the customer'];
const stationList = (gap) => `<div class="stations" style="position:relative;display:flex;flex-direction:column;gap:${gap}px">
  <div style="position:absolute;left:21px;top:22px;bottom:22px;width:6px;background:rgba(255,255,255,.55);border-radius:3px"></div>
  ${STATIONS.map((s, i) => `<div style="display:flex;align-items:center;gap:26px;position:relative">${i === STATIONS.length - 1
    ? `<span style="width:48px;height:48px;border-radius:50%;background:${FLAG};flex:none"></span>`
    : `<span style="width:48px;height:48px;border-radius:50%;background:${NAVY};border:7px solid #fff;flex:none"></span>`}<span style="font:700 36px 'Atkinson Hyperlegible';color:#fff">${s}</span></div>`).join('')}</div>`;
const coverLeft = `.l{position:absolute;left:150px;top:134px;width:450px}h1{margin-top:20px;font-size:46px;line-height:1.06}
     .pills{margin-top:22px;gap:8px}.pills span{font-size:18px;padding:9px 15px}`;

const pieces = [
  ['traverse-fb-profile-720x720.png', 720, 720, `body{background:${NAVY};display:grid;place-items:center}`, mark(500)],
  ['traverse-meta-app-icon-1024x1024.png', 1024, 1024, `body{background:${NAVY};display:grid;place-items:center}`, mark(640)],
  /* A: navy. Left block: lockup, headline, trade pills. Right block: the traverse motif, site, phone. Centre column left empty under
     y 200 for the profile circle. */
  ['traverse-fb-cover-A-1640x624.png', 1640, 624, `body{${grid};position:relative;overflow:hidden}${coverLeft}
     .r{position:absolute;left:1070px;top:392px;width:430px}.r .site{font-size:25px;letter-spacing:.04em}
     .r .ph{font:500 34px 'JetBrains Mono',monospace;color:#fff;margin-top:8px}`,
   `${motif(1090, 160, 300, 'rgba(255,255,255,.85)', NAVY)}<div class="l">${lock(50, 34)}<h1>${HEADLINE}</h1>${pills()}</div>
    <div class="r"><div class="site"><b>traverseplatforms.com</b></div><div class="ph">(303) 596-9515</div></div>`],
  /* B: light map table. Same left block in navy; the right block is a white card with the colour motif, "Built in Colorado", site and
     phone. Centre column left empty under y 200. */
  ['traverse-fb-cover-B-1640x624.png', 1640, 624, `body{${gridLight};position:relative;overflow:hidden;color:${INK}}${coverLeft}
     .word{color:${NAVY}}h1{color:${NAVY}}.pills span{color:${NAVY};background:#fff;box-shadow:inset 0 0 0 2px ${LINE}}
     .card{position:absolute;left:1050px;top:134px;width:450px;height:354px;background:#fff;border-radius:28px;box-shadow:0 14px 40px rgba(19,41,75,.14);border-top:8px solid ${FLAG}}
     .r{position:absolute;left:1086px;top:356px;width:400px}.kicker{color:${FLAG};font-size:17px}
     .r .site{color:${NAVY};font-size:23px;letter-spacing:.04em;margin-top:12px}.r .site b{color:${NAVY}}
     .r .ph{font:500 32px 'JetBrains Mono',monospace;color:${NAVY};margin-top:6px}`,
   `<div class="card"></div>${motif(1104, 166, 236, NAVY, '#fff')}<div class="l">${lock(50, 34, true)}<h1>${HEADLINE}</h1>${pills()}</div>
    <div class="r"><div class="kicker">BUILT IN COLORADO</div><div class="site"><b>traverseplatforms.com</b></div><div class="ph">(303) 596-9515</div></div>`],
  /* first post, portrait: what Traverse is, the day as a traverse, the trades */
  ['traverse-fb-post-1080x1350.png', 1080, 1350, `body{${grid};padding:86px 90px 0;position:relative}
     .kicker{margin-top:58px;font-size:22px}h1{margin-top:16px;font-size:84px}.stations{margin-top:64px}
     .pills{margin-top:66px;gap:12px}.pills span{font-size:23px;padding:12px 22px}
     .every{margin-top:40px;font:700 30px 'Atkinson Hyperlegible';color:#fff}.every i{font-style:normal;display:inline-block;width:14px;height:14px;border-radius:50%;background:${FLAG};margin-right:14px;vertical-align:middle;position:relative;top:-2px}
     .foot{position:absolute;left:90px;right:90px;bottom:70px;display:flex;justify-content:space-between;font:500 22px 'JetBrains Mono',monospace;letter-spacing:.06em;color:#D5DEEA}.foot b{font-weight:500;color:#fff}`,
   `${lock(80, 54)}<div class="kicker">TERRITORY SALES PLATFORM</div><h1>${HEADLINE}</h1>${stationList(36)}${pills()}
    <div class="every"><i></i>Every plan has every feature.</div>
    <div class="foot"><b>traverseplatforms.com</b><span>BUILT IN COLORADO</span></div>`],
  /* first post, square */
  ['traverse-fb-post-1080x1080.png', 1080, 1080, `body{${grid};padding:84px 90px 0;position:relative}
     .kicker{margin-top:60px;font-size:22px}h1{margin-top:16px;font-size:84px}.sub{margin-top:30px;font-size:32px}
     .pills{margin-top:48px;gap:12px}.pills span{font-size:23px;padding:12px 22px}
     .every{margin-top:44px;font:700 30px 'Atkinson Hyperlegible';color:#fff}.every i{font-style:normal;display:inline-block;width:14px;height:14px;border-radius:50%;background:${FLAG};margin-right:14px;vertical-align:middle;position:relative;top:-2px}
     .foot{position:absolute;left:90px;right:90px;bottom:68px;display:flex;justify-content:space-between;font:500 22px 'JetBrains Mono',monospace;letter-spacing:.06em;color:#D5DEEA}.foot b{font-weight:500;color:#fff}`,
   `${lock(80, 54)}<div class="kicker">TERRITORY SALES PLATFORM</div><h1>${HEADLINE}</h1>
    <div class="sub">Properties, phone calls, quotes, jobs and the office in one app, set up for your trade.</div>${pills()}
    <div class="every"><i></i>Every plan has every feature.</div>
    <div class="foot"><b>traverseplatforms.com</b><span>BUILT IN COLORADO</span></div>`],
];

/* checks, drawn from the finished PNGs.
   Main: Facebook's current computer layout, measured from Matthew's upload 8 Nov: the cover cropped to y 110-514, the profile circle
     centred (x 660-980) from y 225 down. Shown as Facebook shows it, then the whole file with the cut-off bands shaded.
   Secondary: the older layout (whole cover, circle bottom-left, Meta's 176 of 820), and a phone that crops 100 px off each side with
     the same band and a centred circle (assumed, not measured). */
const cover = (n) => {
  const IMG = u('traverse-fb-cover-' + n + '-1640x624.png'), PF = u('traverse-fb-profile-720x720.png');
  const D = 1100, k = D / 1640, vh = (514 - 110) * k, dc = 320 * k, ct = (225 - 110) * k;
  const S = 520, sc = 176 * S / 820;
  const P = 520, kp = P / 1440, pvh = (514 - 110) * kp, pc = 320 * kp, pct = (225 - 110) * kp;
  return ['traverse-fb-cover-' + n + '-preview.png', 1240, 1500, `body{background:#E9EBEE;color:${INK};padding:36px 70px;font-family:'Atkinson Hyperlegible'}
    h2{font:700 30px 'Familjen Grotesk';margin-bottom:6px}h3{font:700 22px 'Familjen Grotesk';margin-bottom:4px}p{color:${MUTED};font-size:17px;margin-bottom:14px}
    .fb{background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.12);overflow:hidden;position:relative}
    .cv{position:relative;overflow:hidden}.pf{position:absolute;border-radius:50%;border:4px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25)}
    .name{font:700 28px 'Atkinson Hyperlegible';text-align:center}.cat{color:#65676B;font-size:16px;text-align:center}
    .cut{position:absolute;left:0;right:0;background:repeating-linear-gradient(45deg,rgba(214,64,12,.6) 0 10px,rgba(214,64,12,.35) 10px 20px)}
    .lab{position:absolute;font:500 14px 'JetBrains Mono';color:#fff;background:${FLAG};padding:2px 6px}
    .ring{position:absolute;border-radius:50%;border:4px dashed ${FLAG};box-shadow:0 0 0 2px #fff}`,
   `<h2>Cover ${n}: computer, Facebook's current layout</h2><p>As measured from Matthew's upload on 8 Nov: top and bottom cropped, profile picture centred.</p>
    <div class="fb" style="width:${D}px"><div class="cv" style="width:${D}px;height:${vh}px"><img src="${IMG}" style="display:block;width:${D}px;margin-top:${-110 * k}px"></div>
      <img class="pf" src="${PF}" style="width:${dc}px;height:${dc}px;left:${D / 2 - dc / 2}px;top:${ct}px">
      <div style="height:${dc - (vh - ct) + 80}px;position:relative"><div style="position:absolute;left:0;right:0;bottom:10px"><div class="name">Traverse</div><div class="cat">Software Company</div></div></div></div>
    <h3 style="margin-top:26px">The whole file</h3><p>Shaded: what the computer view cuts off. Dashed ring: where the profile picture sits.</p>
    <div class="fb" style="width:${D}px;height:${624 * k}px"><img src="${IMG}" style="display:block;width:${D}px">
      <div class="cut" style="top:0;height:${110 * k}px"></div><div class="cut" style="top:${514 * k}px;height:${110 * k}px"></div>
      <div class="lab" style="left:8px;top:6px">cut off</div><div class="lab" style="left:8px;top:${514 * k + 6}px">cut off</div>
      <div class="ring" style="width:${dc}px;height:${dc}px;left:${D / 2 - dc / 2}px;top:${225 * k}px"></div></div>
    <h2 style="margin-top:30px">Secondary checks</h2><div style="display:flex;gap:60px;align-items:flex-start;margin-top:10px">
    <div><h3>Older layout: circle bottom-left</h3><p>Whole cover; Meta's 176 of 820.</p>
      <div class="fb" style="width:${S}px"><img src="${IMG}" style="display:block;width:${S}px">
      <div style="position:relative;height:${sc / 2 + 16}px"><img class="pf" src="${PF}" style="width:${sc}px;height:${sc}px;left:10px;top:${-sc / 2}px"></div></div></div>
    <div><h3>Phone, sides cropped 100 px each</h3><p>Assumed: same top and bottom band, circle centred.</p>
      <div class="fb" style="width:${P}px"><div class="cv" style="width:${P}px;height:${pvh}px"><img src="${IMG}" style="display:block;width:${1640 * kp}px;max-width:none;margin-left:${-100 * kp}px;margin-top:${-110 * kp}px"></div>
      <img class="pf" src="${PF}" style="width:${pc}px;height:${pc}px;left:${P / 2 - pc / 2}px;top:${pct}px">
      <div style="height:${pc - (pvh - pct) + 50}px;position:relative"><div style="position:absolute;left:0;right:0;bottom:8px"><div class="name" style="font-size:22px">Traverse</div></div></div></div></div></div>`];
};
const circleCheck = ['traverse-fb-profile-circle-check.png', 1240, 560, `body{background:#fff;color:${INK};padding:36px 50px;font-family:'Atkinson Hyperlegible'}
   h2{font:700 28px 'Familjen Grotesk';margin-bottom:20px}.row{display:flex;align-items:flex-end;gap:40px}
   .row img{border-radius:50%;display:block}.dk{background:#18191A;padding:24px;border-radius:12px;display:flex;align-items:flex-end;gap:30px}
   .ap img{border-radius:22%}.row>div{min-width:120px}small{display:block;white-space:nowrap;text-align:center;color:${MUTED};font-size:15px;margin-top:8px}`,
  `<h2>Profile picture cropped to a circle, and the app icon rounded</h2><div class="row">
   <div><img src="${u('traverse-fb-profile-720x720.png')}" width="360" height="360"><small>720 shown at 360</small></div>
   <div><img src="${u('traverse-fb-profile-720x720.png')}" width="176" height="176"><small>176 (computer)</small></div>
   <div><img src="${u('traverse-fb-profile-720x720.png')}" width="40" height="40"><small>40 (comments)</small></div>
   <div class="dk"><img src="${u('traverse-fb-profile-720x720.png')}" width="120" height="120"><img src="${u('traverse-fb-profile-720x720.png')}" width="32" height="32"></div>
   <div class="ap"><img src="${u('traverse-meta-app-icon-1024x1024.png')}" width="150" height="150"><small>app icon, rounded</small></div></div>`];

const shoot = ([name, w, h, css, body]) => {
  const f = join(OUT, '.tmp.html');
  writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>${base}html,body{width:${w}px;height:${h}px;overflow:hidden}${css}</style></head><body>${body}</body></html>`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--allow-file-access-from-files', `--window-size=${w},${h}`, `--screenshot=${join(OUT, name)}`, '--virtual-time-budget=6000', pathToFileURL(f).href], { stdio: 'ignore' });
  console.log(join(OUT, name));
};
pieces.forEach(shoot);
[cover('A'), cover('B'), circleCheck].forEach(shoot);

/* contact sheet of everything above */
const sizeOf = (n) => { const m = n.match(/(\d+)x(\d+)/); return m ? [+m[1], +m[2]] : n.includes('circle') ? [1240, 560] : [1240, 1500]; };
const all = readdirSync(OUT).filter((n) => n.endsWith('.png') && !n.includes('contact-sheet')).sort();
const cell = (n) => { const [w, h] = sizeOf(n), s = Math.min(560 / w, 360 / h);
  return `<figure><div class="im"><img src="${u(n)}" width="${Math.round(w * s)}" height="${Math.round(h * s)}"></div><figcaption>${n}</figcaption></figure>`; };
shoot(['traverse-fb-contact-sheet.png', 1840, 80 + Math.ceil(all.length / 3) * 430 + 30, `body{background:${SURFACE};color:${INK};padding:30px 30px;font-family:'Atkinson Hyperlegible'}
   h2{font:700 30px 'Familjen Grotesk';margin-bottom:20px;display:flex;align-items:center;gap:14px}
   .g{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}figure{background:#fff;border:1px solid ${LINE};border-radius:12px;padding:14px;height:410px}
   .im{height:360px;display:grid;place-items:center}.im img{box-shadow:0 1px 4px rgba(0,0,0,.18)}figcaption{font:500 14px 'JetBrains Mono';color:${MUTED};margin-top:10px;text-align:center}`,
  `<h2>${navyTile(40)} Traverse Facebook Page kit, ${new Date().toISOString().slice(0, 10)}</h2><div class="g">${all.map(cell).join('')}</div>`]);
rmSync(join(OUT, '.tmp.html'), { force: true });
