// Screenshots of the mock in headless Chrome (CDP), into tests/*.png (not in git). Usage: node shots.mjs [url]  (default http://127.0.0.1:8787/)
// Live copy: CODE_FILE=~/.ssh/outbox-mock-code.txt node shots.mjs https://traverseplatforms.com/<folder>/  (the code is typed into the form, never printed)
import {spawn} from 'node:child_process';
import {writeFileSync, readFileSync} from 'node:fs';
const URL0 = process.argv[2] || 'http://127.0.0.1:8787/', OUT = new URL('.', import.meta.url).pathname;
const port = 9334, ch = spawn(process.env.CHROME || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/omshot-' + process.pid, 'about:blank'], {stdio: 'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break } catch { await sleep(200) } }
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const wait = {};
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait[m.id]) { wait[m.id](m); delete wait[m.id] } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; wait[i] = r; ws.send(JSON.stringify({id: i, method, params})) });
const ev = async x => (await send('Runtime.evaluate', {expression: x, returnByValue: true, awaitPromise: true})).result.result?.value;
await send('Page.enable');
const size = async (w, h, mobile) => send('Emulation.setDeviceMetricsOverride', {width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile});
const shot = async (name, full) => {
  let clip;
  if (full) { const H = await ev('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)'); const W = await ev('window.innerWidth'); clip = {x: 0, y: 0, width: W, height: Math.min(H, 4000), scale: 1} }
  const r = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: !!full, ...(clip ? {clip} : {})});
  writeFileSync(OUT + name + '.png', Buffer.from(r.result.data, 'base64')); console.log('saved', name);
};
const go = async (hash, ms = 600) => { await ev(`location.hash=${JSON.stringify(hash)}`); await sleep(ms) };
await size(1440, 900);
if (process.env.CODE_FILE) {
  const code = readFileSync(process.env.CODE_FILE, 'utf8').trim();
  await send('Page.navigate', {url: URL0}); await sleep(1500);
  await ev("document.querySelector('input[name=code]').value=" + JSON.stringify(code) + ";document.querySelector('form').submit()"); await sleep(2500);
}
await send('Page.navigate', {url: URL0 + '#/automations'}); await sleep(1500);
await shot('desktop-list', 1);
await ev("document.querySelector('#colsb').click()"); await sleep(200); await shot('desktop-list-columns');
await ev("document.querySelector('#colsx').click()");
await go('#/automations/free-class/stats'); await shot('desktop-drawer-funnel');
await go('#/automations/free-class/flow'); await shot('desktop-drawer-flow');
await go('#/automations/free-class'); await shot('desktop-drawer');
await go('#/edit/free-class/reminder/light', 900); await shot('desktop-editor-light');
await go('#/edit/free-class/reminder/full', 900); await shot('desktop-editor-full');
await go('#/edit/free-class/day-7/light', 900); await ev("document.querySelector('#pas').value='noname';document.querySelector('#pas').onchange({target:document.querySelector('#pas')})"); await sleep(200); await shot('desktop-editor-checks-fallback');
await go('#/edit/birthday/draft/full', 900); await ev("document.querySelector('[data-v=phone]').click()"); await sleep(300); await shot('desktop-editor-phone-preview');
await go('#/approvals'); await shot('desktop-approvals', 1);
await go('#/results'); await shot('desktop-results', 1);
await go('#/settings'); await shot('desktop-settings', 1);
await size(390, 844, 1);
await go('#/automations'); await sleep(300); await shot('phone-list');
await shot('phone-list-full', 1);
await go('#/automations/free-class/stats'); await shot('phone-drawer-funnel');
await go('#/edit/free-class/reminder/light', 900); await shot('phone-editor', 1);
await go('#/approvals'); await shot('phone-approvals', 1);
await go('#/settings'); await shot('phone-settings', 1);
ws.close(); ch.kill(); process.exit(0);
