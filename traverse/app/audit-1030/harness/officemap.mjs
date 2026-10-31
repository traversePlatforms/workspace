/* The Office dashboard's map (30 Oct audit): how long it takes, what it loads, how many circles. node officemap.mjs <install> */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { signin, sleep, jars } from './lib1030.mjs';
const DIR = 'C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/ptest-audit';
const ORIGIN = 'http://127.0.0.1:8807';
const inst = process.argv[2] || 'roofing';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';
const VPS = { desk: { w: 1440, h: 900, touch: false, dev: 'c' }, tabP: { w: 820, h: 1180, touch: true, dev: 't' }, tabL: { w: 1180, h: 820, touch: true, dev: 't' } };
mkdirSync(DIR + '/shots/officemap', { recursive: true });
const port = 9800 + Math.floor(Math.random() * 100);
const ch = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdpo-'))}`, 'about:blank'], { stdio: 'ignore' });
let tg; for (let k = 0; k < 80 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const R = new Map(); let log = null;
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); return; }
  const P = m.params || {};
  if (m.method === 'Network.requestWillBeSent') R.set(P.requestId, { url: P.request.url, t0: Date.now() });
  if (m.method === 'Network.responseReceived') { const r = R.get(P.requestId); if (r) { r.status = P.response.status; r.cached = P.response.fromDiskCache || P.response.fromServiceWorker; } }
  if (m.method === 'Network.loadingFinished') { const r = R.get(P.requestId); if (r) { r.ms = Date.now() - r.t0; r.bytes = P.encodedDataLength; if (log) log.push(r); } }
  if (m.method === 'Network.loadingFailed') { const r = R.get(P.requestId); if (r) { r.failed = P.errorText; if (log) log.push(r); } } };
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
const out = [];
for (const [vk, v] of Object.entries(VPS)) {
  const j = await signin('o' + vk, '222222', v.dev); if (!j.ok) throw new Error('signin');
  const jar = jars['o' + vk];
  await send('Network.clearBrowserCache'); await send('Network.clearBrowserCookies');
  await send('Network.setCookie', { name: jar.split('=')[0], value: jar.slice(jar.indexOf('=') + 1), url: ORIGIN });
  await send('Emulation.setDeviceMetricsOverride', { width: v.w, height: v.h, deviceScaleFactor: 1, mobile: v.touch });
  await send('Emulation.setTouchEmulationEnabled', v.touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  await send('Emulation.setUserAgentOverride', { userAgent: v.touch ? IPAD : '' });
  for (const pass of ['first visit after sign-in (cold cache)', 'second visit (warm)']) {
    if (pass.startsWith('first')) {
      log = [];
      await send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/?r=' + Date.now() });
      for (let k = 0; k < 300; k++) { if (await js(`!!document.querySelector('#view .choose, #view .dhome')`)) break; await sleep(100); }
      await sleep(4000);   /* the home's own background loads (the towns list among them) */
    } else {
      await js(`(()=>{const b=[...document.querySelectorAll('#barin button.back, #dnav button')].find(x=>/home|field tools|back/i.test(x.innerText||x.getAttribute('aria-label')||''));if(b)b.click();return !!b})()`);
      await sleep(2500);
    }
    const homeReqs = log.length, homeRegions = log.filter((r) => /action=regions/.test(r.url)).map((r) => Math.round((r.bytes || 0) / 1024) + ' KB in ' + r.ms + ' ms'); log = [];
    const opened = await js(`(()=>{document.querySelectorAll('#view button[aria-expanded="false"]').forEach(b=>{if(/ogrp/.test(b.className))b.click()});const t=[...document.querySelectorAll('#view .tile, #view button, #dnav button')].find(x=>/^(Office dashboard|Office)$/.test(((x.querySelector('.tt b')||{}).innerText||x.innerText||'').trim()));if(!t)return false;t.click();return true})()`);
    if (!opened) { out.push({ inst, vk, pass, error: 'no Office tile' }); continue; }
    const t0 = Date.now(); let tMap = null, tDots = null, dots = 0, stable = 0, last = -1;
    while (Date.now() - t0 < 60000) {
      const s = await js(`(()=>{const m=document.querySelector('.omapel .leaflet-container, .omapel.leaflet-container');return {map:!!m,dots:m?m.querySelectorAll('path.leaflet-interactive').length:0,tiles:m?m.querySelectorAll('.leaflet-tile-loaded, canvas').length:0}})()`);
      if (s.map && tMap === null) tMap = Date.now() - t0;
      if (s.dots > 0 && tDots === null) tDots = Date.now() - t0;
      if (s.dots === last && s.dots > 0) stable++; else stable = 0; last = s.dots; dots = s.dots;
      if (stable >= 10) break;
      await sleep(100);
    }
    await sleep(2500);   /* the base map's tiles */
    const reqs = log.slice();
    const sum = (f) => reqs.filter(f).reduce((a, r) => a + (r.bytes || 0), 0);
    const api = reqs.filter((r) => /rounds\.php/.test(r.url)).map((r) => ({ a: (r.url.match(/action=([a-z0-9]+)/) || [])[1], kb: Math.round((r.bytes || 0) / 1024), ms: r.ms, st: r.status }));
    const rec = { inst, vk, pass, homeReqs, tMapMs: tMap, tDotsMs: tDots, dotsDoneMs: Date.now() - t0 - 2500 - 1000, circles: dots, requests: reqs.length, kb: Math.round(sum(() => true) / 1024), apiKb: Math.round(sum((r) => /rounds\.php/.test(r.url)) / 1024), tileReqs: reqs.filter((r) => /pmtiles|tile\.openstreetmap|mesonet|\.png/.test(r.url)).length, tileKb: Math.round(sum((r) => /pmtiles|tile\.openstreetmap|mesonet|\.png/.test(r.url)) / 1024), leafletKb: Math.round(sum((r) => /leaflet|protomaps/.test(r.url)) / 1024), api, homeRegions };
    out.push(rec); console.log(JSON.stringify(rec));
    const sh = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); writeFileSync(`${DIR}/shots/officemap/${inst}-${vk}-${pass.startsWith('first') ? 'cold' : 'warm'}.jpg`, Buffer.from(sh.data, 'base64'));
  }
}
writeFileSync(`${DIR}/results/officemap-${inst}.json`, JSON.stringify(out, null, 1));
ws.close(); ch.kill(); process.exit(0);
