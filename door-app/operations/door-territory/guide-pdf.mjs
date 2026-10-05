/* APP-GUIDE.html -> APP-GUIDE.pdf with headless Chrome (2026-10-05). The grouped contents are fold-outs on screen;
   they are opened before printing so the PDF shows every section, and printed in light colours. */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pathToFileURL(join(HERE, 'APP-GUIDE.html')).href, OUT = join(HERE, 'APP-GUIDE.pdf');
const PORT = 9411;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pend = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
try {
  let tg; for (let k = 0; k < 60 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
  ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia', { media: 'print', features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Page.navigate', { url: SRC }); await sleep(2500);
  await send('Runtime.evaluate', { expression: `document.querySelectorAll('details').forEach(d=>d.open=true); 1` });
  const pdf = await send('Page.printToPDF', { printBackground: true, scale: 0.86, paperWidth: 8.5, paperHeight: 11, marginTop: 0.5, marginBottom: 0.55, marginLeft: 0.5, marginRight: 0.5,
    displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="width:100%;font:8px Arial;color:#777;text-align:center">Sixfold Field Tools Guide · 5 Oct 2026 · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>' });
  writeFileSync(OUT, Buffer.from(pdf.data, 'base64'));
  console.log('wrote', OUT);
} finally { try { ws && ws.close(); } catch {} chrome.kill(); }
