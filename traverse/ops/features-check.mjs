// Storm report, voice notes and the sales funnel (2026-10-10) on the Roofing test copy, as a person would use them.
//   node features-check.mjs [port] [admin code]
import { spawn } from 'node:child_process'; import { mkdtempSync, writeFileSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
const PORT = process.argv[2] || 8791, ORIGIN = 'http://127.0.0.1:' + PORT, CODE = process.argv[3] || '333333', API = ORIGIN + '/api/traverse-rounds.php';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cdp = 9500 + Math.floor(Math.random() * 40);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${cdp}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'fc-'))}`, 'about:blank'], { stdio: 'ignore' });
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; };
async function attach(match) {
  for (let i = 0; i < 60; i++) { try { const l = await (await fetch(`http://127.0.0.1:${cdp}/json`)).json(); const p = l.find(match); if (p) return p; } catch {} await sleep(250); }
  return null;
}
function session(url) {
  const ws = new WebSocket(url); let id = 0; const pend = new Map(), errors = [];
  const ready = new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) { pend.get(x.id)(x.result); pend.delete(x.id); } if (x.method === 'Runtime.exceptionThrown') errors.push(x.params.exceptionDetails.exception?.description || x.params.exceptionDetails.text); };
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const js = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.exceptionDetails ? 'ERR ' + (r.exceptionDetails.exception?.description || '') : r.result?.value; };
  const until = async (e, ms = 20000) => { for (let k = 0; k < ms / 300; k++) { if ((await js(e)) === true) return true; await sleep(300); } return false; };
  const tap = async (sel) => { const r = await js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; e.scrollIntoView({block:'center'}); const b=e.getBoundingClientRect(); return [b.x+b.width/2,b.y+b.height/2]})()`);
    if (!r) return false; await sleep(150); for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: r[0], y: r[1], button: 'left', clickCount: 1 }); return true; };
  return { ready, send, js, until, tap, errors, ws };
}
/* api as the admin, for the funnel's data */
let jar = '';
const call = async (action, body) => { const r = await fetch(`${API}?action=${action}`, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(jar ? { Cookie: jar } : {}) }, body: body ? JSON.stringify(body) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) jar = sc.split(';')[0]; return r.json().catch(() => ({})); };

const page = await attach((x) => x.type === 'page'); const P = session(page.webSocketDebuggerUrl); await P.ready;
await P.send('Page.enable'); await P.send('Runtime.enable');
await P.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await P.send('Page.navigate', { url: ORIGIN + '/tr-cb2e8587/' }); await sleep(800);
await P.js(`fetch('../api/traverse-rounds.php?action=signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'${CODE}'}),credentials:'same-origin'}).then(r=>r.status)`);
await P.send('Page.navigate', { url: ORIGIN + '/tr-cb2e8587/' });
t(await P.until(`!!document.querySelector('.choose')`), 'the phone opens on the tools screen');

/* ---- storm report: a Castle Rock door with hail ---- */
await call('signin', { code: CODE });
const rg = (await call('regions')).regions.find((r) => r.key === 'castle-rock');
let AREA = null, DOOR = null;
for (const a of rg.areas.filter((x) => x.total >= 6 && x.total <= 40)) { const ds = (await (await fetch(`${API}?action=area&region=castle-rock&area=${encodeURIComponent(a.name)}`, { headers: { Cookie: jar } })).json()).doors || []; const d = ds.find((x) => x.hail && x.hail.length >= 2 && x.roof); if (d) { AREA = a.name; DOOR = d; break; } }
t(!!DOOR, 'a Castle Rock door with hail and a roof measurement found');
await P.js(`[...document.querySelectorAll('button.tile')].find(b=>/^Doors/.test(b.textContent.trim())).click()`);
await P.until(`document.querySelectorAll('#view .area').length>=5`, 60000);
await P.js(`[...document.querySelectorAll('#view .area')].find(b=>b.textContent.includes('Castle Rock')).click()`);
await P.until(`document.querySelectorAll('#view .area').length>0&&!document.querySelector('#view .town')`);
await P.js(`[...document.querySelectorAll('#view .area')].find(b=>b.querySelector('.nm')&&b.querySelector('.nm').textContent===${JSON.stringify(AREA)}).click()`);
await P.until(`!!document.querySelector('#view .door')`, 60000);
await P.js(`(()=>{const r=document.querySelector('#view .door[data-id=${JSON.stringify(DOOR.id)}]');if(r&&!r.classList.contains('open'))r.click();return 1})()`);
t(await P.until(`!!document.querySelector('#view .door.open .srbtn')`, 15000), 'the hail line on the card has a Storm report button');
const before = (await (await fetch(`http://127.0.0.1:${cdp}/json`)).json()).map((x) => x.id);
await P.send('Runtime.evaluate', { expression: "document.querySelector('#view .door.open .srbtn').click()", userGesture: true });
const rep = await attach((x) => x.type === 'page' && !before.includes(x.id));
t(!!rep, 'tapping it opens the report in its own tab');
if (rep) {
  const R = session(rep.webSocketDebuggerUrl); await R.ready; await R.send('Runtime.enable');
  await R.until(`document.body && /Storm report/.test(document.body.innerText)`, 8000);
  const txt = await R.js(`document.body.innerText`);
  t(/Storm report/.test(txt) && txt.includes(DOOR.address), 'the report names the house');
  t(/Hail at this address/i.test(txt) && /Largest:/.test(txt) && (txt.match(/ in\b/g) || []).length >= 2, 'it lists the hail storms with their sizes');
  t(/The roof/i.test(txt) && /Roof area/i.test(txt), 'it shows the roof');
  t(/radar estimates/.test(txt) && /not a damage inspection/.test(txt), 'it says what the numbers are and are not');
  t(await R.js(`document.querySelector('.bar button')?.textContent==='Print or save as PDF'`), 'it has a Print or save as PDF button');
  writeFileSync('storm-report-1.png', Buffer.from((await R.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  t(!R.errors.length, 'no errors in the report' + (R.errors.length ? ': ' + R.errors[0] : ''));
  R.ws.close();
}

/* ---- voice notes: the note editor has the Speak button ---- */
const hasSR = await P.js(`!!(window.SpeechRecognition||window.webkitSpeechRecognition)`);
await P.js(`(()=>{const b=[...document.querySelectorAll('#view .door.open button')].find(x=>/^Add info/.test(x.textContent.trim()));if(b)b.click();return !!b})()`); await sleep(400);
await P.js(`(()=>{const b=document.querySelector('#view .door.open button[data-cap=note]');if(b)b.click();return !!b})()`);
await P.until(`!!document.querySelector('#view .door.open textarea')`, 8000);
if (hasSR) t(await P.until(`!!document.querySelector('#view .door.open .mic')`, 5000), 'the note editor has a Speak the note button');
else t(await P.js(`!document.querySelector('#view .door.open .mic')`), 'no Speak button where the browser cannot listen');
writeFileSync('voice-1.png', Buffer.from((await P.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

/* ---- funnel: a booked door won at $12,000 shows on the Leaderboard ---- */
const D2 = (await (await fetch(`${API}?action=area&region=castle-rock&area=${encodeURIComponent(AREA)}`, { headers: { Cookie: jar } })).json()).doors.find((d) => !d.mark && d.id !== DOOR.id);
let r = await call('accountadd', { name: 'Test Rep', role: 'crew' }); const REP = r; t(!!r.ok, 'setup: a test rep account');
let rj = ''; { const rr = await fetch(API + '?action=signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: REP.code }) }); rj = (rr.headers.get('set-cookie') || '').split(';')[0]; }
r = await (await fetch(API + '?action=mark', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: rj }, body: JSON.stringify({ region: 'castle-rock', id: D2.id, outcome: 'booked' }) })).json(); t(!!r.ok, 'setup: the rep books a door');
r = await call('result', { region: 'castle-rock', id: D2.id, result: 'won', value: 12000 }); t(!!r.ok, 'setup: the job won at $12,000');
await P.send('Page.navigate', { url: ORIGIN + '/tr-cb2e8587/' }); await P.until(`!!document.querySelector('.choose')`, 20000);
await P.js(`(()=>{const b=[...document.querySelectorAll('button.tile')].find(x=>/^Leaderboard/.test(x.textContent.trim()));if(b)b.click();return !!b})()`);
t(await P.until(`!!document.querySelector('.funnel')`, 15000), 'the Leaderboard shows a Sales funnel card');
t(await P.js(`document.querySelectorAll('.bseg button').length===4 && [...document.querySelectorAll('.bseg button')].some(b=>b.textContent==='90 days')`), 'the periods include 90 days');
const ftxt = await P.js(`document.querySelector('.funnel')?.innerText||''`);
t(/\$12,000/.test(ftxt), 'the $12,000 job shows in the funnel');
t(/Close/.test(ftxt) && /Rep/.test(ftxt), 'the funnel has the per-rep table');
writeFileSync('funnel-1.png', Buffer.from((await P.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
/* tidy */
await call('result', { region: 'castle-rock', id: D2.id, result: null });
await fetch(API + '?action=mark', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: rj }, body: JSON.stringify({ region: 'castle-rock', id: D2.id, outcome: null }) });
if (REP.id) await call('accountremove', { id: REP.id });
t(!P.errors.length, 'no page errors' + (P.errors.length ? ': ' + P.errors.slice(0, 2).join(' | ') : ''));
console.log(`${pass} passed, ${fail} failed`);
chrome.kill(); process.exit(0);
