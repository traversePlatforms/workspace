/* Sixfold — MARK COLOUR STUDY proof sheet, six options, front and back. 2026-09-29.
   Generated from build-card-marks.mjs output. Same capture path as build-card-proof.mjs.

   The point of the four cards is to CHOOSE between them, and that cannot be done
   by opening four PDFs one at a time. This lays every face on one Pine sheet.

   Captures the two .page elements out of each generated card, so what you see is
   the real artwork at its real proportions, not a re-drawing of it.

   Run:  node sixfold/operations/business-card-print/build-card-proof.mjs        */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9382;
const PINE = { r: 14, g: 21, b: 18, alpha: 1 };
const CARDS = ['card-mark-0-flat','card-mark-1-twotone','card-mark-2-lighter-up','card-mark-3-darker-up','card-mark-4-grad-dark-up','card-mark-5-grad-light-up'];
const SCALE = 1.9;          // css px -> sheet px
const PAD = 34;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const prof = mkdtempSync(join(tmpdir(), 'cardproof-'));
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
// print media: drops the screen-only trim dashes and the grey studio background
await cmd('Emulation.setEmulatedMedia', { media: 'print' });

const shots = [];
for (const file of CARDS) {
  await cmd('Emulation.setDeviceMetricsOverride', { width: 900, height: 700, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: pathToFileURL(join(HERE, `${file}.html`)).href });
  await wait(800);
  const { result } = await cmd('Runtime.evaluate', {
    returnByValue: true,
    expression: `JSON.stringify([...document.querySelectorAll('.page')].map(p => { const r = p.getBoundingClientRect(); return {x:r.x, y:r.y, w:r.width, h:r.height}; }))`,
  });
  const rects = JSON.parse(result.value);
  if (rects.length !== 2) throw new Error(`${file}: expected 2 faces, found ${rects.length}`);
  for (const r of rects) {
    const { data } = await cmd('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: SCALE },
    });
    /* A hairline edge. Two of the four cards are Pine on a Pine sheet, so without
       this their boundary is invisible and the proof cannot show the trim. */
    shots.push(await sharp(Buffer.from(data, 'base64'))
      .extend({ top: 1, bottom: 1, left: 1, right: 1, background: { r: 122, g: 134, b: 128, alpha: 1 } })
      .png().toBuffer());
  }
  console.log(`  ${file}  front + back`);
}

ws.close(); ch.kill(); await wait(300);
try { rmSync(prof, { recursive: true, force: true }); } catch { /* windows lock */ }

const meta = await sharp(shots[0]).metadata();
const cw = meta.width, chh = meta.height;
const sheetW = cw * 2 + PAD * 3;
const sheetH = (chh + PAD) * CARDS.length + PAD;
const composite = shots.map((input, i) => ({
  input,
  left: PAD + (i % 2) * (cw + PAD),
  top: PAD + Math.floor(i / 2) * (chh + PAD),
}));
await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: PINE } })
  .composite(composite).png().toFile(join(HERE, 'card-marks-proof.png'));
console.log(`\ncard-marks-proof.png  ${sheetW}x${sheetH}  (rows, top to bottom: ${CARDS.join(', ')} — front left, back right)`);
