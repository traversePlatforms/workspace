/* Phone screenshots of the desk (390 x 844, iPhone-size), for a readability check. */
import { spawn } from 'node:child_process'; import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const LD = 'C:/Users/Surge Inc/Desktop/claude test 2/matthew/peak-pickleball-sponsorship/desk-data-local';
const CODE = readFileSync(LD + '/test-seller-code.txt', 'utf8').match(/(\d{6})/)[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const PORT = 9399;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT, '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'cdp-')), 'about:blank'], { stdio: 'ignore' });
let tg; for (let i = 0; i < 60 && !tg; i++) { try { tg = (await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json()).find((y) => y.type === 'page'); } catch {} if (!tg) await sleep(200); }
const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r)); let k = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const send = (m, p = {}) => new Promise((res) => { const i = ++k; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
const shot = async (n, full) => { let p = { format: 'png' }; if (full) { const h = await js('Math.min(document.documentElement.scrollHeight, 3000)'); p = { format: 'png', clip: { x: 0, y: 0, width: 390, height: h, scale: 1 }, captureBeyondViewport: true }; } writeFileSync(n, Buffer.from((await send('Page.captureScreenshot', p)).data, 'base64')); };
await send('Page.enable'); await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: process.env.DARK ? 'dark' : 'light' }] }); await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: 'http://127.0.0.1:8790/' }); for (let i = 0; i < 60 && !(await js("!!document.querySelector('.signin input')")); i++) await sleep(150);
await shot((process.env.DARK?'d':'m')+'0-signin.png');
await js(`(()=>{const i=document.querySelector('.signin input');i.value='${CODE}';document.querySelector('.signin').dispatchEvent(new Event('submit',{cancelable:true}));return 1})()`);
for (let i = 0; i < 60 && !(await js("!!document.querySelector('.row')")); i++) await sleep(150);
await shot((process.env.DARK?'d':'m')+'1-list.png');
await js("document.querySelector('.row').click()"); await sleep(500);
await shot((process.env.DARK?'d':'m')+'2-company.png', true);
console.log('overflow list/company:', await js('document.documentElement.scrollWidth') + ' vs ' + await js('document.documentElement.clientWidth'));
await js("document.querySelector('.detail .close').click()"); await sleep(300);
await js("[...document.querySelectorAll('.tabs button')].find(b=>b.textContent==='Report').click()"); await sleep(300);
await js("[...document.querySelectorAll('main .btn')].find(b=>/Open the report/.test(b.textContent)).click()"); await sleep(400);
await shot((process.env.DARK?'d':'m')+'3-report.png', true);
console.log('overflow report:', await js('document.documentElement.scrollWidth'));
ws.close(); chrome.kill(); process.exit(0);
