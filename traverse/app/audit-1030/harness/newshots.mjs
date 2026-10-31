/* Screenshots of the merged main's new screens (30 Oct audit): Plans, Customer emails, Facebook leads, Sync from another system,
   End-of-day email, the editions' Stats page, at phone / tablet / desktop, light and dark. node newshots.mjs <install> */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { signin, sleep, jars } from './lib1030.mjs';
const DIR = 'C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/ptest-audit';
const ORIGIN = 'http://127.0.0.1:8807';
const inst = process.argv[2] || 'roofing';
const OUT = DIR + '/shots/new-' + inst; mkdirSync(OUT, { recursive: true });
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const VPS = { phone: { w: 390, h: 844, touch: true, ua: IPHONE, dev: 'm' }, tabP: { w: 820, h: 1180, touch: true, ua: IPAD, dev: 't' }, tabL: { w: 1180, h: 820, touch: true, ua: IPAD, dev: 't' }, desk: { w: 1440, h: 900, touch: false, ua: '', dev: 'c' } };
const port = 9900 + Math.floor(Math.random() * 90);
const ch = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdpn-'))}`, 'about:blank'], { stdio: 'ignore' });
let tg; for (let k = 0; k < 80 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const errs = [];
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]); };
const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
await send('Page.enable'); await send('Runtime.enable');
const click = (t) => js(`(()=>{document.querySelectorAll('#view button[aria-expanded="false"]').forEach(b=>{if(/ogrp|cty/.test(b.className))b.click()});const vis=(el)=>{const r=el.getBoundingClientRect();return r.width>1&&r.height>1};const el=[...document.querySelectorAll('#view button, #view a[href], #view [role=button], #dnav button, .omenu button, .omenu a')].filter(vis).find(e=>((e.querySelector('.tt b')||e.querySelector('b')||{}).innerText||e.innerText||e.getAttribute('aria-label')||'').replace(/\\s+/g,' ').trim().replace(/^[✓•·]\\s*/,'').startsWith(${JSON.stringify(t)}));if(!el)return false;el.scrollIntoView({block:'center'});el.click();return true})()`);
const title = () => js(`((document.querySelector('#barin .ttl')||{}).innerText||'').replace(/\\s+/g,' ').trim()`);
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(r.data, 'base64')); };
const home = async () => { await send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/?r=' + Date.now() }); for (let k = 0; k < 200; k++) { if (await js(`!!document.querySelector('#view .choose, #view .dhome, #view .ohome')`)) break; await sleep(100); } await sleep(2500); };
/* [name, steps from Home] */
const SCREENS = [
  ['plans', ['Plans']], ['customer-emails', ['Customer emails']], ['facebook-leads', ['Facebook leads']],
  ['sync', ['Setup checklist', 'Sync from another system']], ['stats', ['Stats']], ['end-of-day', ['Stats', 'Set up the end-of-day']],
  ['setup-checklist', ['Setup checklist']]
];
const out = [];
for (const [vk, v] of Object.entries(VPS)) for (const theme of ['light', 'dark']) {
  if (theme === 'dark' && vk === 'tabL') continue;
  const j = await signin('n' + vk, '222222', v.dev); if (!j.ok) throw new Error('signin');
  const jar = jars['n' + vk];
  await send('Network.clearBrowserCookies'); await send('Network.setCookie', { name: jar.split('=')[0], value: jar.slice(jar.indexOf('=') + 1), url: ORIGIN });
  await send('Emulation.setDeviceMetricsOverride', { width: v.w, height: v.h, deviceScaleFactor: 1, mobile: v.touch });
  try { await send('Emulation.setTouchEmulationEnabled', v.touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false, maxTouchPoints: 1 }); } catch (e) {}
  await send('Emulation.setUserAgentOverride', { userAgent: v.ua });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'pointer', value: v.touch ? 'coarse' : 'fine' }] });
  for (const [name, steps] of SCREENS) {
    await home(); errs.length = 0; let ok = true;
    if (process.env.ONLYS && !new RegExp(process.env.ONLYS).test(name)) continue;
    for (const s of steps) { const c = await click(s); if (!c) { ok = false; break; } await sleep(1500); for (let k = 0; k < 60; k++) { const busy = await js(`/Loading…|Loading\\.\\.\\./.test((document.querySelector('#view')||{}).innerText||'')||!!document.querySelector('#view .skel')`); if (!busy) break; await sleep(250); } await sleep(700); }
    const t = await title(); const scrollY = await js('Math.round(scrollY)');
    const txt = await js(`(document.querySelector('#view')||{}).innerText||''`);
    const words = (txt.match(/\b(doors?|Sixfold|365|Jen|ClickUp|Messenger|Traverse|lawn|aeration)\b/gi) || []).reduce((a, w) => { a[w.toLowerCase()] = (a[w.toLowerCase()] || 0) + 1; return a; }, {});
    const f = `${vk}-${theme}-${name}`; await shot(f);
    const rec = { inst, vk, theme, screen: name, reached: ok, title: t, scrollY, errors: errs.slice(), words, textLen: txt.length, shot: f + '.jpg' };
    out.push(rec); console.log(JSON.stringify(rec));
  }
}
writeFileSync(`${DIR}/results/newshots-${inst}${process.env.ONLYS ? '-2' : ''}.json`, JSON.stringify(out, null, 1));
ws.close(); ch.kill(); process.exit(0);
