/* Sixfold — season-colour study for the vehicle magnets.

   Asked for 2026-09-28: can the green carry the seasons, so the year-round offer
   shows in the mark? That want is recorded in REBRAND-PATH-2026-09.md ("he wants
   the colour to carry the seasons").

   This is a STUDY, not a new magnet. It renders the mark four ways at magnet
   scale so the treatment can be chosen before anything is applied.

   ⚑ Geometry note that decides the whole question: the FLAT mark
   (sixfold-mark-ridge-flat.svg) holds all four peaks in ONE path with fill-rule
   evenodd, so it cannot be coloured per peak. The LAYERED master has one triangle
   each. So a per-season treatment has to use the layered geometry — but at FULL
   opacity, one hue per peak. That is not the same as the layered master's
   translucency, which is what went muddy on the business card in single ink.

   Run:  node sixfold/brand/vehicle/build-season-study.mjs                        */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9381;

const PINE = '#0E1512';
const SAGE = '#A7BE93';
const MOSS = '#8AA07A';

/* Season hues, picked to stay inside the existing brand rather than beside it:
   AUTUMN is the old Ember. That is the neat part — the orange comes back as ONE
   SEASON instead of the whole identity, which is also what "Land & Fire" means
   now that fire is one of three services rather than the headline. */
const SPRING = '#B7D49A';
const SUMMER = '#6F9E5E';
const AUTUMN = '#D9853F';
const WINTER = '#A9C0C6';

/* Contrast against Pine, computed rather than eyeballed — a vehicle magnet is
   read at 30 ft and a peak that does not separate from the ground is a peak that
   is not there. WCAG relative luminance. */
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/* The LAYERED geometry: one triangle per peak, plus the conifer and ground bar. */
const PEAKS = [
  'M18 84 L36 48 L54 84 Z',
  'M30 84 L50 38 L70 84 Z',
  'M44 84 L66 26 L88 84 Z',
  'M60 84 L79 14 L98 84 Z',
];
const TREE = ['M22 69 L9.5 81.5 L34.5 81.5 Z', 'M22 62 L12 74 L32 74 Z', 'M22 55.5 L14.5 66.5 L29.5 66.5 Z'];
const GROUND = 'M4 86 L96 86 L96 91 L4 91 Z';

function mark(mode, i) {
  const gid = `g${i}`;
  let defs = '';
  let peaks;

  if (mode === 'flat') {
    peaks = PEAKS.map((d) => `<path d="${d}" fill="${SAGE}"/>`).join('');
  } else if (mode === 'seasons') {
    const cols = [SPRING, SUMMER, AUTUMN, WINTER];
    peaks = PEAKS.map((d, k) => `<path d="${d}" fill="${cols[k]}"/>`).join('');
  } else if (mode === 'seasons-green') {
    // autumn and winter pulled back toward the greens, for a quieter read
    const cols = [SPRING, SUMMER, '#C9A15C', '#93AFA8'];
    peaks = PEAKS.map((d, k) => `<path d="${d}" fill="${cols[k]}"/>`).join('');
  } else {
    // one smooth gradient across the whole ridge
    defs = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${SPRING}"/><stop offset=".38" stop-color="${SUMMER}"/>
      <stop offset=".72" stop-color="${AUTUMN}"/><stop offset="1" stop-color="${WINTER}"/>
    </linearGradient></defs>`;
    peaks = PEAKS.map((d) => `<path d="${d}" fill="url(#${gid})"/>`).join('');
  }

  return `<svg viewBox="0 0 100 96" width="100%" height="100%">${defs}
    ${peaks}
    <rect x="20.4" y="77" width="3.2" height="7" fill="${MOSS}"/>
    ${TREE.map((d) => `<path d="${d}" fill="${MOSS}"/>`).join('')}
    <path d="${GROUND}" fill="${MOSS}"/>
  </svg>`;
}

const CELLS = [
  ['A · single ink (what is built now)', 'flat',
   'Palette A as it stands. Nothing to decide, nothing to print-test.'],
  ['B · four seasons, full strength', 'seasons',
   'One hue per peak. Autumn IS the old Ember — the orange returns as one season rather than the whole brand.'],
  ['C · four seasons, pulled back', 'seasons-green',
   'Same idea, autumn and winter muted toward the greens. Reads as one family in four tones rather than four colours.'],
  ['D · one smooth gradient', 'gradient',
   'A single left-to-right ramp across all four peaks. Prettiest up close; the softest at 30 ft and the one that can band on a cheap press.'],
];

const rows = [SPRING, SUMMER, AUTUMN, WINTER, SAGE, MOSS]
  .map((h) => `${h}  ${ratio(h, PINE).toFixed(2)}:1`);
console.log('Contrast against Pine #0E1512:');
for (const r of rows) console.log('  ' + r);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box} body{margin:0;background:${PINE};color:#EDE7DC;
    font-family:"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;padding:46px 40px}
  h1{font-size:30px;margin:0 0 6px} .sub{font-family:Consolas,monospace;font-size:13px;
    color:${MOSS};letter-spacing:.14em;text-transform:uppercase;margin:0 0 30px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:34px}
  .cell{border:1px solid rgba(167,190,147,.28);padding:22px 22px 18px}
  .lab{font-family:Consolas,monospace;font-size:14px;letter-spacing:.1em;text-transform:uppercase;
    color:#EDE7DC;margin:0 0 4px}
  .note{font-size:14px;line-height:1.45;color:rgba(237,231,220,.66);margin:0 0 16px;min-height:62px}
  .lock{display:flex;align-items:center;gap:22px}
  .mk{width:210px;height:202px;flex:none}
  .nm{font-size:62px;line-height:.86}
  .bd{font-family:Consolas,monospace;font-size:13px;letter-spacing:.3em;color:${MOSS};margin-top:8px}
</style></head><body>
  <h1>Season colour — study for the vehicle magnets</h1>
  <p class="sub">Draft · nothing applied · read each at arm's length, then from across the room</p>
  <div class="grid">
    ${CELLS.map(([lab, mode, note], i) => `<div class="cell">
      <p class="lab">${lab}</p><p class="note">${note}</p>
      <div class="lock"><div class="mk">${mark(mode, i)}</div>
        <div><div class="nm">Sixfold</div><div class="bd">LAWN, LAND &amp; FIRE</div></div></div>
    </div>`).join('')}
  </div>
</body></html>`;

const htmlPath = join(HERE, 'season-study.html');
writeFileSync(htmlPath, html);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = mkdtempSync(join(tmpdir(), 'season-'));
const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${prof}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars',
  '--force-color-profile=srgb'], { stdio: 'ignore' });

let ws, id = 0;
const pending = new Map();
for (let i = 0; i < 60; i++) {
  try {
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const pg = t.find((x) => x.type === 'page');
    if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break; }
  } catch { /* not up yet */ }
  await wait(250);
}
await new Promise((r) => ws.addEventListener('open', r));
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
const cmd = (method, params = {}) => new Promise((r) => {
  const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params }));
});

await cmd('Page.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 1480, height: 1100, deviceScaleFactor: 1.5, mobile: false });
await cmd('Page.navigate', { url: pathToFileURL(htmlPath).href });
await wait(1100);
const { result } = await cmd('Runtime.evaluate', {
  returnByValue: true, expression: 'JSON.stringify({w: document.body.scrollWidth, h: document.body.scrollHeight})',
});
const { w, h } = JSON.parse(result.value);
const { data } = await cmd('Page.captureScreenshot', {
  format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1.5 },
});
writeFileSync(join(HERE, 'season-study.png'), Buffer.from(data, 'base64'));
ws.close(); ch.kill(); await wait(300);
try { rmSync(prof, { recursive: true, force: true }); } catch { /* windows lock */ }
console.log(`\nseason-study.png  ${Math.round(w * 1.5)}x${Math.round(h * 1.5)}`);
