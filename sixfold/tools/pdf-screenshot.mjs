/*
  Screenshots a PDF through Chrome's own PDF viewer.

  Why this exists: it is the ONLY way here to see whether a fillable AcroForm
  actually renders its fields and their typed values.

    - pdf-contact-sheet.py (pypdfium2) does NOT draw widget annotations. A
      perfectly good form comes out of it looking completely blank — no boxes,
      no ticks, no text. That is the rasteriser, not the file. Use it for print
      layout; never use it to check a form.
    - No poppler rasteriser is installed (pdftotext only, no pdftoppm).
    - headless=new DOES ship the PDF viewer, so navigating to the file:// URL
      and capturing the screenshot works.

  Run:  node tools/pdf-screenshot.mjs <file.pdf> <out.png> [--page=2] [--wait=2500]
*/
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith('--'));
const out = args.filter((a) => !a.startsWith('--'))[1];
if (!src || !out) { console.error('usage: node tools/pdf-screenshot.mjs <file.pdf> <out.png> [--page=N]'); process.exit(1); }
const pageNo = Number((args.find((a) => a.startsWith('--page=')) || '--page=1').split('=')[1]);
const waitMs = Number((args.find((a) => a.startsWith('--wait=')) || '--wait=2500').split('=')[1]);

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!CHROME) throw new Error('No Chrome or Edge found');

const profile = mkdtempSync(join(tmpdir(), 'sixfold-shot-'));
const PORT = 9337;
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--allow-file-access-from-files',
  '--window-size=1100,1500',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return (await r.json()).webSocketDebuggerUrl;
    } catch { await sleep(200); }
  }
  throw new Error('Chrome never opened its debugging port');
}

function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  let id = 0;
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const ready = new Promise((r) => ws.addEventListener('open', r));
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const msg = { id: ++id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    pending.set(msg.id, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
    ws.send(JSON.stringify(msg));
  });
  return { ready, send, close: () => ws.close() };
}

try {
  const cdp = connect(await endpoint());
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  const url = 'file:///' + resolve(src).replace(/\\/g, '/') + (pageNo > 1 ? `#page=${pageNo}` : '');
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Page.navigate', { url }, sessionId);
  /* The viewer is a plugin: no load event tells us the page is painted, so this
     waits rather than races. Raise --wait for a big document. */
  await sleep(waitMs);

  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log(`wrote ${out}  (page ${pageNo} of ${src})`);
  cdp.close();
} finally {
  chrome.kill();
}
