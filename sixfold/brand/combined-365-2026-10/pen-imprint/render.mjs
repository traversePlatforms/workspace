// node render.mjs : imprint.html -> imprint-white.png and imprint-green.png at 768 dpi (8x of 96), clear background,
// and checks that the art stays inside the 1.5" x 0.75" imprint area.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
/* throwaway Chrome profiles are removed when the script ends (2026-10-25: 10,717 were left in Temp, about 170 GB) */
const cdpDirs = []; const cdpDir = () => { const d = mkdtempSync(join(tmpdir(), 'cdp-')); cdpDirs.push(d); return d; };
process.on('exit', () => { for (const d of cdpDirs) try { rmSync(d, { recursive: true, force: true, maxRetries: 50, retryDelay: 200 }); } catch {} });
const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9373;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${cdpDir()}`, 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
try {
  let tg; for (let k = 0; k < 60 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
  ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  await send('Page.enable');
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  for (const c of ['white', 'green']) {
    await send('Page.navigate', { url: pathToFileURL(join(HERE, 'imprint.html')).href + '?c=' + c });
    await sleep(2500);
    const box = await js(`(()=>{const a=document.getElementById('art').getBoundingClientRect();let l=1e9,t=1e9,r=0,b=0;document.querySelectorAll('#art svg,#art span').forEach(e=>{const x=e.getBoundingClientRect();l=Math.min(l,x.left);t=Math.min(t,x.top);r=Math.max(r,x.right);b=Math.max(b,x.bottom)});return {w:a.width,h:a.height,l,t,r,b,font:document.fonts.check('800 14px Outfit')}})()`);
    const inside = box.l >= 0 && box.t >= 0 && box.r <= 144 && box.b <= 72;
    console.log(c, 'area', box.w + 'x' + box.h, 'ink', Math.round(box.r - box.l) + 'x' + Math.round(box.b - box.t), '=', ((box.r - box.l) / 96).toFixed(2) + '" x ' + ((box.b - box.t) / 96).toFixed(2) + '"', inside ? 'inside' : 'OUTSIDE', 'Outfit loaded:', box.font);
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 144, height: 72, scale: 8 } });
    writeFileSync(join(HERE, `imprint-${c}.png`), Buffer.from(shot.data, 'base64'));
  }
} catch (e) { console.log('FAILED', e.message); }
try { ws && ws.close(); } catch {}
chrome.kill(); process.exit(0);
