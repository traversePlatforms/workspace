// The hub with the Outbox tab (2026-11-17): every tab opens, in order, with its Alt number, in headless Chrome. Each app's address is a
// stub page on a local test server (the real apps are not loaded), so this checks the hub itself: its tab list, frames and keys.
//   node assistant/outbox/tests/hub-tabs-test.mjs            (local copy of assistant/hub)
//   HUB_URL=https://traverseplatforms.com/hub-cc1f31de/ node ... (the live hub: only that the page parses and lists the tabs; it does not sign in)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HUB = path.resolve(HERE, '..', '..', 'hub');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const WANT = ['Field app', 'J.A.R.V.I.S.', 'Assistant', 'Peak desk', 'Prospects', 'Posts', 'Website', 'Outbox'];
let pass = 0, failN = 0; const ok = (c, w) => { if (c) pass++; else { failN++; console.log('FAIL:', w); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const live = process.env.HUB_URL || '';
const R = fs.mkdtempSync(path.join(os.tmpdir(), 'hubt-')); let srv = null; const PORT = 8797;
if (!live) {
  fs.cpSync(HUB, path.join(R, 'hub-cc1f31de'), { recursive: true });
  for (const p of ['summit-de59ae83', 'a-e018bb82', 'a-e018bb82/jarvis', 'peak-desk-28d38d', 'prospects-47bfe6', 'posts-ab8c57', 'outbox-092b0f']) { fs.mkdirSync(path.join(R, p), { recursive: true }); fs.writeFileSync(path.join(R, p, 'index.html'), '<!doctype html><title>stub ' + p + '</title><p>' + p); }
  fs.writeFileSync(path.join(R, 'index.html'), '<!doctype html><title>stub site</title>');
  srv = spawn('php', ['-S', '127.0.0.1:' + PORT, '-t', R], { stdio: 'ignore' }); await sleep(800);
}
const url = live || 'http://127.0.0.1:' + PORT + '/hub-cc1f31de/';
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'hubchrome-'));
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9233', '--user-data-dir=' + prof, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
let ws;
try {
  let ver = null; for (let i = 0; i < 40 && !ver; i++) { await sleep(250); try { ver = await (await fetch('http://127.0.0.1:9233/json/list')).json(); } catch {} }
  const pg = ver.find(t => t.type === 'page'); ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const wait = {}; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait[d.id]) { wait[d.id](d); delete wait[d.id]; } };
  const cdp = (method, params = {}) => new Promise(r => { const n = ++id; wait[n] = r; ws.send(JSON.stringify({ id: n, method, params })); });
  const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await cdp('Page.enable'); await cdp('Runtime.enable');
  const errs = []; ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.text); });
  await cdp('Page.navigate', { url }); await sleep(2500);
  const names = await ev('[...document.querySelectorAll(".tab")].map(t=>t.title)');
  ok(Array.isArray(names) && names.length === WANT.length, 'the hub lists ' + WANT.length + ' tabs (got ' + (names || []).length + ')');
  WANT.forEach((n, i) => ok((names || [])[i] === n + ' (Alt+' + (i + 1) + ')', 'tab ' + (i + 1) + ' is ' + n + ' with Alt+' + (i + 1)));
  ok(errs.length === 0, 'no script errors: ' + errs.join(' | '));
  if (!live) {
    for (let i = 0; i < WANT.length; i++) {
      await ev('document.querySelectorAll(".tab")[' + i + '].click()'); await sleep(700);
      const r = await ev('(()=>{const f=[...document.querySelectorAll("#frames iframe")].filter(x=>!x.hidden);let t="";try{t=f[0].contentDocument.title}catch(e){t="cross"}return {n:f.length,src:f[0]&&f[0].getAttribute("src"),t,sel:document.querySelector(".tab[aria-selected=true]").title}})()');
      ok(r && r.n === 1 && /^stub /.test(r.t) && r.sel.startsWith(WANT[i]), WANT[i] + ' opens in its frame (' + JSON.stringify(r) + ')');
    }
    await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"8",altKey:true,bubbles:true}))'); await sleep(500);
    ok((await ev('document.querySelector(".tab[aria-selected=true]").title')).startsWith('Outbox'), 'Alt+8 opens Outbox');
    await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"1",altKey:true,bubbles:true}))'); await sleep(500);
    ok((await ev('document.querySelector(".tab[aria-selected=true]").title')).startsWith('Field app'), 'Alt+1 still opens the field app');
    ok((await ev('document.querySelectorAll("#frames iframe").length')) === WANT.length, 'every opened tab stays loaded');
  }
} finally { try { ws && ws.close(); } catch {} ch.kill(); if (srv) srv.kill(); }
console.log('\n' + pass + ' passed, ' + failN + ' failed');
process.exit(failN ? 1 : 0);
