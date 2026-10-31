// node circles.mjs: time circles.html for N circles at desktop and tablet sizes, with and without 4x CPU throttling
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9500 + Math.floor(Math.random() * 90);
const ch = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdpc-'))}`, 'about:blank'], { stdio: 'ignore' });
let tg; for (let k = 0; k < 80 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
await send('Page.enable'); await send('Runtime.enable');
const F = 'file:///C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/radar-audit/circles.html';
for (const [label, w, h, rate] of [['desktop 1440x900', 1440, 900, 1], ['tablet 820x1180', 820, 1180, 1], ['tablet 820x1180, CPU 4x slower', 820, 1180, 4]]) {
  for (const n of [8619, 49662]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 1000 });
    await send('Emulation.setCPUThrottlingRate', { rate });
    await send('Page.navigate', { url: F + '?n=' + n });
    let r = null; for (let k = 0; k < 600 && !r; k++) { await sleep(250); r = (await send('Runtime.evaluate', { expression: 'window.RESULT||null', returnByValue: true })).result?.value; }
    console.log(label.padEnd(32), JSON.stringify(r));
  }
}
ws.close(); ch.kill(); process.exit(0);
