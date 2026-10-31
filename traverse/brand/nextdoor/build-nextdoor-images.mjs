/* Traverse Platforms Nextdoor business page images (2026-10-31, Matthew: "I need logos for nextdoor branding for traverseplatforms").
   Sizes from Nextdoor's help article "Edit your business page information" (help.nextdoor.com, read 2026-10-25 for Sixfold 365):
   logo 500 x 500, PNG or JPEG, a rectangle is cropped to a square; cover "recommended image ratio is 5:2", so 1500 x 600.
   The logo is the parent app icon run full bleed (navy, white traverse, flag-orange close) with the mark inside the middle 60%, so a
   circle crop keeps it whole. Two covers, brand only and centred for tighter phone crops: A the lockup and headline, B the share-image
   layout with the sample property card. No phone or web address on the cover: the page lists them.
   Fonts load from Google Fonts at render time, as on the website.
     node traverse/brand/nextdoor/build-nextdoor-images.mjs   ->  out/ beside this file */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'out');
mkdirSync(OUT, { recursive: true });
const NAVY = '#13294B', FLAG = '#D6400C', FLAG_SOFT = '#FDE6DC';
const fonts = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Familjen+Grotesk:wght@600;700&family=JetBrains+Mono:wght@500&display=swap">`;
/* the reverse mark (traverse-mark-reverse.svg), stations filled navy */
const mark = (px) => `<svg width="${px}" height="${px}" viewBox="0 0 64 64"><polyline points="9,47 24,31 37,40 53,17" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="47" r="5.2" fill="${NAVY}" stroke="#fff" stroke-width="3.6"/><circle cx="24" cy="31" r="5.2" fill="${NAVY}" stroke="#fff" stroke-width="3.6"/><circle cx="37" cy="40" r="5.2" fill="${NAVY}" stroke="#fff" stroke-width="3.6"/><circle cx="53" cy="17" r="8" fill="${FLAG}"/></svg>`;
/* the colour mark on a white tile, as in the share image */
const tile = (px) => `<div style="width:${px}px;height:${px}px;border-radius:${Math.round(px * 0.22)}px;background:#fff;display:grid;place-items:center;flex:none"><svg width="${Math.round(px * 0.74)}" height="${Math.round(px * 0.74)}" viewBox="0 0 64 64"><polyline points="9,47 24,31 37,40 53,17" fill="none" stroke="${NAVY}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="47" r="5.2" fill="#fff" stroke="${NAVY}" stroke-width="3.6"/><circle cx="24" cy="31" r="5.2" fill="#fff" stroke="${NAVY}" stroke-width="3.6"/><circle cx="37" cy="40" r="5.2" fill="#fff" stroke="${NAVY}" stroke-width="3.6"/><circle cx="53" cy="17" r="8" fill="${FLAG}"/></svg></div>`;
const grid = `background-color:${NAVY};background-image:linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);background-size:60px 60px;background-position:-1px -1px`;
const base = `*{box-sizing:border-box;margin:0}body{font-family:'Atkinson Hyperlegible',sans-serif;color:#fff}
  .word{font:700 52px/1 'Familjen Grotesk',sans-serif;letter-spacing:-.01em}
  .kicker{font:500 21px 'JetBrains Mono',monospace;letter-spacing:.2em;color:#FF7A45}
  h1{font:700 74px/1.02 'Familjen Grotesk',sans-serif;letter-spacing:-.02em}
  .sub{font:400 27px/1.4 'Atkinson Hyperlegible',sans-serif;color:#D5DEEA}`;
const pieces = [
  ['traverse-nextdoor-logo-500x500.png', 500, 500, `body{background:${NAVY};display:grid;place-items:center}`, mark(300)],
  ['traverse-nextdoor-cover-A-1500x600.png', 1500, 600, `body{${grid};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:0}
     .lock{display:flex;align-items:center;gap:22px}.kicker{margin-top:34px}h1{margin-top:16px}.sub{margin-top:18px}`,
   `<div class="lock">${tile(76)}<span class="word">Traverse Platforms</span></div><div class="kicker">TERRITORY SALES PLATFORM</div><h1>Stop guessing. Work the real territory.</h1><div class="sub">Properties, phone calls, quotes, jobs and the office in one app.</div>`],
  ['traverse-nextdoor-cover-B-1500x600.png', 1500, 600, `body{${grid};display:flex;align-items:center;justify-content:center;gap:70px}
     .l{width:700px}.lock{display:flex;align-items:center;gap:18px}.word{font-size:40px}.kicker{margin-top:30px;font-size:18px}h1{margin-top:14px;font-size:66px}.sub{margin-top:16px;font-size:23px}
     .card{width:430px;background:#fff;border-radius:22px;padding:28px 30px;color:#0F1B2D;box-shadow:0 24px 60px rgba(0,0,0,.35)}
     .pill{display:inline-flex;align-items:center;gap:9px;background:${FLAG_SOFT};color:#9A3008;font:700 17px 'Atkinson Hyperlegible';padding:8px 15px;border-radius:999px}
     .pill i{width:9px;height:9px;border-radius:50%;background:${FLAG}}
     .addr{font:600 27px 'Familjen Grotesk';margin-top:20px}.small{color:#566476;font-size:16px;margin-top:4px}
     .row{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #DCE2EA;padding:15px 0;font-size:17px}.small{margin-bottom:18px}
     .row b{font:500 19px 'JetBrains Mono',monospace}
     .btns{display:flex;gap:10px;margin-top:6px}.btns div{flex:1;text-align:center;font:700 18px 'Atkinson Hyperlegible';padding:14px 0;border-radius:10px}
     .b1{background:${FLAG};color:#fff}.b2{border:2px solid #DCE2EA}`,
   `<div class="l"><div class="lock">${tile(62)}<span class="word">Traverse Platforms</span></div><div class="kicker">TERRITORY SALES PLATFORM</div><h1>Stop guessing. Work the real territory.</h1><div class="sub">Properties, phone calls, quotes, jobs and the office in one app.</div></div>
    <div class="card"><span class="pill"><i></i>Inspection booked</span><div class="addr">1840 Benchmark Dr</div><div class="small">Sample property</div>
    <div class="row"><span>Roof</span><b>31 sq · asphalt · 2009</b></div><div class="row"><span>Hail at the house</span><b>1.75 in</b></div>
    <div class="btns"><div class="b1">Book inspection</div><div class="b2">Not now</div></div></div>`],
];
for (const [name, w, h, css, body] of pieces) {
  const f = join(OUT, '.tmp.html');
  writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>${base}html,body{width:${w}px;height:${h}px;overflow:hidden}${css}</style></head><body>${body}</body></html>`);
  execFileSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`, `--screenshot=${join(OUT, name)}`, '--virtual-time-budget=6000', pathToFileURL(f).href], { stdio: 'ignore' });
  console.log(join(OUT, name));
}
rmSync(join(OUT, '.tmp.html'), { force: true });
