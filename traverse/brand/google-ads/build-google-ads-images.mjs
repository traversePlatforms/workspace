/* Traverse Platforms Google Ads images (2026-10-31, Matthew building a Smart campaign; Google offered generated pictures of people, which the
   brand and the 31 Oct rule rule out: real photos or designed cards only). Google Ads sizes: logo 1:1 (1200 x 1200), square 1:1 (1200 x 1200),
   landscape 1.91:1 (1200 x 628), portrait 4:5 (960 x 1200). Same look as the Nextdoor set and the website share image; the property is the
   website's sample (made-up figures, "Sample property"). No data-source words, no phone or address.
     node traverse/brand/google-ads/build-google-ads-images.mjs   ->  out/ beside this file */
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
/* the website's sample property card */
const cardCss = `.card{background:#fff;border-radius:22px;padding:28px 30px;color:#0F1B2D;box-shadow:0 24px 60px rgba(0,0,0,.35);flex:none}
  .pill{display:inline-flex;align-items:center;gap:9px;background:${FLAG_SOFT};color:#9A3008;font:700 17px 'Atkinson Hyperlegible';padding:8px 15px;border-radius:999px}
  .pill i{width:9px;height:9px;border-radius:50%;background:${FLAG}}
  .addr{font:600 27px 'Familjen Grotesk';margin-top:20px}.small{color:#566476;font-size:16px;margin-top:4px;margin-bottom:18px}
  .row{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #DCE2EA;padding:15px 0;font-size:17px}
  .row b{font:500 19px 'JetBrains Mono',monospace}
  .btns{display:flex;gap:10px;margin-top:6px}.btns div{flex:1;text-align:center;font:700 18px 'Atkinson Hyperlegible';padding:14px 0;border-radius:10px}
  .b1{background:${FLAG};color:#fff}.b2{border:2px solid #DCE2EA}`;
const card = (w, zoom) => `<div class="card" style="width:${w}px;zoom:${zoom}"><span class="pill"><i></i>Inspection booked</span><div class="addr">1840 Benchmark Dr</div><div class="small">Sample property</div>
  <div class="row"><span>Roof</span><b>31 sq · asphalt · 2009</b></div><div class="row"><span>Hail at the house</span><b>1.75 in</b></div>
  <div class="btns"><div class="b1">Book inspection</div><div class="b2">Not now</div></div></div>`;
const lock = (t, f) => `<div class="lock" style="display:flex;align-items:center;gap:${Math.round(t * 0.28)}px">${tile(t)}<span class="word" style="font-size:${f}px">Traverse Platforms</span></div>`;
const pieces = [
  ['traverse-gads-logo-1200x1200.png', 1200, 1200, `body{background:${NAVY};display:grid;place-items:center}`, mark(720)],
  ['traverse-gads-square-1200x1200.png', 1200, 1200, `body{${grid};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}${cardCss}
     .kicker{margin-top:44px;font-size:24px}h1{margin-top:18px;font-size:84px}.card{margin-top:56px;text-align:left}`,
   `${lock(84, 56)}<div class="kicker">TERRITORY SALES PLATFORM</div><h1>Stop guessing.<br>Work the real territory.</h1>${card(470, 1.25)}`],
  ['traverse-gads-landscape-1200x628.png', 1200, 628, `body{${grid};display:flex;align-items:center;justify-content:center;gap:44px}${cardCss}
     .l{width:600px}.kicker{margin-top:26px;font-size:16px}h1{margin-top:12px;font-size:56px}.sub{margin-top:14px;font-size:20px}`,
   `<div class="l">${lock(54, 34)}<div class="kicker">TERRITORY SALES PLATFORM</div><h1>Stop guessing. Work the real territory.</h1><div class="sub">Properties, phone calls, quotes, jobs and the office in one app.</div></div>${card(430, 1)}`],
  ['traverse-gads-portrait-960x1200.png', 960, 1200, `body{${grid};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 60px}${cardCss}
     .kicker{margin-top:40px;font-size:21px}h1{margin-top:16px;font-size:72px}.sub{margin-top:18px;font-size:26px}.card{margin-top:52px;text-align:left}`,
   `${lock(72, 46)}<div class="kicker">TERRITORY SALES PLATFORM</div><h1>Stop guessing. Work the real territory.</h1><div class="sub">Properties, phone calls, quotes, jobs and the office in one app.</div>${card(430, 1.15)}`],
];
for (const [name, w, h, css, body] of pieces) {
  const f = join(OUT, '.tmp.html');
  writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>${base}html,body{width:${w}px;height:${h}px;overflow:hidden}${css}</style></head><body>${body}</body></html>`);
  execFileSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${w},${h}`, `--screenshot=${join(OUT, name)}`, '--virtual-time-budget=6000', pathToFileURL(f).href], { stdio: 'ignore' });
  console.log(join(OUT, name));
}
rmSync(join(OUT, '.tmp.html'), { force: true });
