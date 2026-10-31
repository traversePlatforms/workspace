// node shoot.mjs <url> <out.png> [w] [h] [dpr]: headless Chrome screenshot once the network is quiet
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [url, out, w = '1220', h = '980', dpr = '2'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 90);
const ch = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdps-'))}`, '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
let tg; for (let k = 0; k < 80 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); let inflight = 0, last = Date.now(), fails = [];
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); return; }
  if (m.method === 'Network.requestWillBeSent') { inflight++; last = Date.now(); }
  if (m.method === 'Network.loadingFinished') { inflight--; last = Date.now(); }
  if (m.method === 'Network.loadingFailed') { inflight--; last = Date.now(); fails.push(m.params.errorText); }
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) fails.push(m.params.response.status + ' ' + m.params.response.url.slice(0, 120)); };
await send('Network.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: +dpr, mobile: false });
await send('Page.navigate', { url });
const t0 = Date.now(); await sleep(1500);
while (Date.now() - t0 < 100000 && (inflight > 0 || Date.now() - last < 1500)) await sleep(200);
await sleep(500);
const r = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(r.data, 'base64'));
console.log(out, 'in', Date.now() - t0, 'ms', fails.length ? 'fails: ' + fails.slice(0, 5).join(' | ') : '');
ws.close(); ch.kill(); process.exit(0);
