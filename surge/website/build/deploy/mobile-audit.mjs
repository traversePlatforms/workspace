/* Surge site — phone-width audit over CDP. Added 2026-09-17 during the pre-staging
   audit, because `chrome --headless --window-size=390,…` silently clamps the window
   to ~504 px and then crops the screenshot to 390 — every page looked clipped and
   none of it was real. Device emulation is the only honest phone render.

   For every page the local server serves, at 390×844 (iPhone-class), it reports
     - horizontal overflow: document.scrollWidth vs 390, and the widest offending
       element's selector and width, if any
     - the h1 text and whether the hamburger nav button exists
   and writes a full-page PNG for each page named in --shots (or all with --shots=all).

   Run (server must be up on 8080):
     node deploy/mobile-audit.mjs                      # report only
     node deploy/mobile-audit.mjs --shots=/,/careers/  # plus screenshots to deploy/dist/mobile/
     node deploy/mobile-audit.mjs --width=360          # a narrower phone */
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const WIDTH = Number(opt('width', 390)), HEIGHT = 844, BASE = opt('base', 'http://localhost:8080');
const shots = opt('shots', '');
const OUT = join(SITE, 'deploy', 'dist', 'mobile'); mkdirSync(OUT, { recursive: true });

// every shipped page = every index.html under the site, plus 404.html
function pages(dir = SITE, base = '', acc = []) {
  for (const n of readdirSync(dir)) {
    if (n.startsWith('_') || n === 'deploy' || n === 'node_modules' || n === 'api' || n === 'assets') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) pages(p, `${base}${n}/`, acc);
    else if (n === 'index.html') acc.push(`/${base}`);
    else if (n === '404.html') acc.push('/404.html');
  }
  return acc.sort();
}

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!CHROME) throw new Error('No Chrome found');
const profile = mkdtempSync(join(tmpdir(), 'surge-mobile-'));
const PORT = 9338;
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--window-size=1100,1500',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function endpoint() {
  for (let i = 0; i < 100; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); return (await r.json()).webSocketDebuggerUrl; } catch { await sleep(200); } }
  throw new Error('Chrome never opened its debugging port');
}
function connect(url) {
  const ws = new WebSocket(url); const pending = new Map(); let id = 0;
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const ready = new Promise((r) => ws.addEventListener('open', r));
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const msg = { id: ++id, method, params }; if (sessionId) msg.sessionId = sessionId;
    pending.set(msg.id, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))); ws.send(JSON.stringify(msg));
  });
  return { ready, send, close: () => ws.close() };
}

const PROBE = `(() => {
  const w = ${WIDTH}; const sw = document.documentElement.scrollWidth;
  let worst = null;
  if (sw > w) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.right > w + 1 && r.width > 0 && (!worst || r.right > worst.right)) {
        const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : '');
        worst = { sel, right: Math.round(r.right), width: Math.round(r.width) };
      }
    }
  }
  const h1 = (document.querySelector('h1') || {}).textContent || '';
  const burger = !!document.querySelector('.nav-toggle, [aria-label*="menu" i], button[aria-controls*="nav" i]');
  return JSON.stringify({ sw, worst, h1: h1.trim().slice(0, 60), burger, height: document.documentElement.scrollHeight });
})()`;

try {
  const cdp = connect(await endpoint()); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true }, sessionId);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sessionId);
  const wanted = shots === 'all' ? null : new Set(shots.split(',').filter(Boolean));
  let bad = 0;
  console.log(`phone audit at ${WIDTH}×${HEIGHT} against ${BASE}\n`);
  for (const path of pages()) {
    await cdp.send('Page.navigate', { url: BASE + path }, sessionId);
    await sleep(900);
    const { result } = await cdp.send('Runtime.evaluate', { expression: PROBE, returnByValue: true }, sessionId);
    const r = JSON.parse(result.value);
    const over = r.sw > WIDTH;
    if (over) bad++;
    console.log(`${over ? '⚠' : '✓'} ${path.padEnd(28)} scrollWidth ${r.sw}${over ? `  OVERFLOW → ${r.worst?.sel} right=${r.worst?.right}px` : ''}${r.burger ? '' : '  (no nav toggle found)'}`);
    if (wanted === null || wanted.has(path)) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: Math.min(r.height, 12000), deviceScaleFactor: 1, mobile: true }, sessionId);
      await sleep(300);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
      const name = (path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/\//g, '-').replace('.html', '')) + `-${WIDTH}.png`;
      writeFileSync(join(OUT, name), Buffer.from(data, 'base64'));
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true }, sessionId);
    }
  }
  console.log(`\n${bad} page(s) with horizontal overflow at ${WIDTH}px.${wanted !== undefined && shots ? `  Screenshots in deploy/dist/mobile/` : ''}`);
  cdp.close();
} finally { chrome.kill(); }
