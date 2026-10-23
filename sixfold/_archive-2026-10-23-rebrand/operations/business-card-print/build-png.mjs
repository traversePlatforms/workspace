import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [url, outFront, outBack] = process.argv.slice(2);
const prof = mkdtempSync(join(tmpdir(), 'card-'));
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9377', `--user-data-dir=${prof}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb'], { stdio: 'ignore' });
const wait = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0, pending = new Map();
for (let i = 0; i < 60; i++) { try { const t = await (await fetch('http://127.0.0.1:9377/json/list')).json(); const pg = t.find(x => x.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break; } } catch {} await wait(250); }
await new Promise(r => ws.addEventListener('open', r));
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
const cmd = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
await cmd('Page.enable');
// print media so the screen-only guides and background do not appear; DSF 3.125 turns 96dpi into 300dpi
await cmd('Emulation.setEmulatedMedia', { media: 'print' });
await cmd('Emulation.setDeviceMetricsOverride', { width: 400, height: 500, deviceScaleFactor: 3.125, mobile: false });
await cmd('Page.navigate', { url });
await wait(1200);
const { result } = await cmd('Runtime.evaluate', { returnByValue: true, expression: `JSON.stringify([...document.querySelectorAll('.page')].map(p => { const r = p.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }))` });
const rects = JSON.parse(result.value);
const outs = [outFront, outBack];
for (let i = 0; i < 2; i++) {
  const r = rects[i];
  const { data } = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 }, captureBeyondViewport: true });
  writeFileSync(outs[i], Buffer.from(data, 'base64'));
  console.log(outs[i].split(/[\/]/).pop(), 'css', r.w + 'x' + r.h, '-> px', Math.round(r.w * 3.125) + 'x' + Math.round(r.h * 3.125));
}
ws.close(); ch.kill(); await wait(300); try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
