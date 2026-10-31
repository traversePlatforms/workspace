/* TR-52 timings (2026-10-31): the photo tiles on the phone's door map + its aerial view, and the computer's door map + lot preview,
   each in a brand-new browser profile (no browser cache: a different phone). node satcache-ui-test.mjs <label>
   Appends one JSON line per screen to satc-timings.jsonl and writes satc-<label>-*.png into review-shots/. */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, appendFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const DIR = 'C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/ptest-satcache';
const ORIGIN = 'http://127.0.0.1:8814', R = 'monument', AREA = 'SIERRA WAY', ADDR = '17890 SIERRA WAY';
const LABEL = process.argv[2] || 'run';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CARDQ = (addr) => `[...document.querySelectorAll('#view .door, .msheet .door')].find(c=>c.querySelector('.addr')&&c.querySelector('.addr').textContent===${JSON.stringify(addr)})`;
const OPENADDR = (addr) => `(async()=>{const c=${CARDQ(addr)};if(c&&c.classList.contains('drow')){c.click();await new Promise(z=>setTimeout(z,450));}return true})()`;
const CLICK = (sel, txt) => `(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.textContent.includes(${JSON.stringify(txt)}));if(e){e.click();return true}return false})()`;
mkdirSync(join(DIR, 'review-shots'), { recursive: true });
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; };

/* the tiles of one kind on the page: mosaic = the door map's Photo look, item = one photo (lot preview, aerial view) */
const KIND = { mosaic: String.raw`/data\/v1\/mosaic\/[^/]+\/tiles\/|satcache\.php\?l=/`, item: String.raw`/data\/v1\/item\/tiles\/|satcache\.php\?i=/` };
const STATS = (k) => `(()=>{const re=${KIND[k]};const es=performance.getEntriesByType('resource').filter(e=>e.initiatorType==='img'&&re.test(e.name));
  if(!es.length)return {n:0};const st=Math.min(...es.map(e=>e.startTime)),en=Math.max(...es.map(e=>e.responseEnd)),d=es.map(e=>e.responseEnd-e.startTime).sort((a,b)=>a-b);
  const imgs=[...document.querySelectorAll('img.leaflet-tile')].filter(i=>re.test(i.src));
  return {n:es.length,fill:Math.round(en-st),median:Math.round(d[Math.floor(d.length/2)]),max:Math.round(d[d.length-1]),proxied:es.filter(e=>/satcache/.test(e.name)).length,
    pending:imgs.filter(i=>!i.complete).length,broken:imgs.filter(i=>i.complete&&!i.naturalWidth).length,last:Math.round(en)}})()`;

async function browser(port) {
  const prof = mkdtempSync(join(tmpdir(), 'cdp-'));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
  let tg; for (let k = 0; k < 80 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
  const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = new Map(), errors = [];
  ws.onmessage = (e) => { const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
  const waitFor = async (e, l, ms = 30000) => { for (let x = 0; x < ms; x += 150) { if (await js(e)) return; await sleep(150); } throw new Error('timeout: ' + l); };
  /* owner names never go in a picture that is committed: every "Owner: ..." on the page is blanked first */
  const MASK = `(()=>{const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){if(/Owner/i.test(n.nodeValue))n.nodeValue=n.nodeValue.replace(/(Owners?:\\s*)[^·\\n]+/gi,'$1(name hidden)');}return 1})()`;
  const shot = async (f) => (await js(MASK), writeFileSync(join(DIR, 'review-shots', f), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64')));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'try{performance.setResourceTimingBufferSize(5000)}catch(e){}' });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const close = () => { try { ws.close(); } catch {} chrome.kill(); setTimeout(() => { for (let i = 0; i < 50; i++) { try { rmSync(prof, { recursive: true, force: true }); break; } catch {} } }, 1500); };
  return { send, js, waitFor, shot, close, errors };
}
/* wait until every tile of the kind on the page has loaded and no new one has started for 2.5 s; then the numbers */
async function settle(b, k, ms = 120000) {
  let last = -1, quiet = 0;
  for (let x = 0; x < ms; x += 250) {
    const s = await b.js(STATS(k));
    if (s.n > 0 && s.pending === 0 && s.n === last) { quiet += 250; if (quiet >= 2500) return s; } else quiet = 0;
    last = s.n; await sleep(250);
  }
  return Object.assign(await b.js(STATS(k)), { timeout: true });
}
async function signIn(b, w, h, mobile) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  await b.send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/' });
  await b.waitFor(`!!document.querySelector('.keys') || !!document.querySelector('.choose') || document.querySelectorAll('button.area').length>3`, 'start');
  if (await b.js(`!!document.querySelector('.keys')`)) {
    await b.js(`localStorage.setItem('sixfold.rounds.sort','map');localStorage.setItem('sixfold.rounds.doorview','street');localStorage.removeItem('sixfold.rounds.sat2')`);
    await b.js(`(()=>{for(const k of '111111'){[...document.querySelectorAll('.keys button')].find(b=>b.getAttribute('aria-label')===k).click()}return true})()`);
  }
  await b.waitFor(`!!document.querySelector('.choose') || document.querySelectorAll('button.area').length>3 || [...document.querySelectorAll('button, a')].some(b=>b.textContent.trim()==='Doors') || (${!mobile}&&!!document.querySelector('input[placeholder="Find an address"]'))`, 'tools');
  if (!mobile && await b.js(`!!document.querySelector('input[placeholder="Find an address"]')`)) return;   /* the computer: the top bar's search is all it needs */
  if (await b.js(`!!document.querySelector('.choose')`)) await b.js(CLICK('button.tile', 'Routes'));
  else if (await b.js(`document.querySelectorAll('button.area').length<=3`)) await b.js(`(()=>{const b=[...document.querySelectorAll('button, a')].find(b=>b.textContent.trim()==='Doors');if(b)b.click();return true})()`);
}
const rec = (screen, s) => { const o = Object.assign({ label: LABEL, screen, at: new Date().toISOString() }, s); appendFileSync(join(DIR, 'satc-timings.jsonl'), JSON.stringify(o) + '\n'); console.log(`  ${screen}: ${s.n} tiles (${s.proxied} via satcache), screen filled in ${(s.fill / 1000).toFixed(2)} s, median tile ${s.median} ms, slowest ${s.max} ms${s.broken ? ', ' + s.broken + ' BROKEN' : ''}${s.timeout ? ' (TIMEOUT)' : ''}`); return o; };

try {
  console.log('Phone 390x844: door map (Photo), then See the lot');
  let b = await browser(8991);
  try {
    await signIn(b, 390, 844, true);
    await b.waitFor(`document.querySelectorAll('button.area').length>3`, 'areas');
    await b.js(`(()=>{const s=document.getElementById('region');s.value=${JSON.stringify(R)};s.dispatchEvent(new Event('change'));return true})()`);
    await b.waitFor(`[...document.querySelectorAll('button.area .nm')].some(n=>n.textContent===${JSON.stringify(AREA)})`, 'area');
    await b.js(`[...document.querySelectorAll('button.area')].find(b=>b.querySelector('.nm').textContent===${JSON.stringify(AREA)}).click()`);
    await b.waitFor(`!!(${CARDQ(ADDR)})`, 'doors');
    const DOCKMAP = `(()=>{const b=[...document.querySelectorAll('#dock button')].find(b=>b.textContent.trim()==='Map');if(b){b.click();return true}return false})()`;
    await b.js(`performance.clearResourceTimings();` + DOCKMAP);
    await b.waitFor(`!!document.querySelector('#view .leaflet-container')`, 'phone map');
    const m = rec('phone-map', await settle(b, 'mosaic'));
    t(m.n >= 4 && !m.broken && !m.timeout, 'phone map: photo tiles load');
    await b.shot(`satc-${LABEL}-phone-map.png`);
    await b.js(DOCKMAP);   /* back to the list */
    await b.waitFor(`!document.querySelector('#view .leaflet-container')&&!!(${CARDQ(ADDR)})`, 'list again');
    await b.js(`performance.clearResourceTimings();1`);
    await b.js(OPENADDR(ADDR));
    /* Sixfold's phone card has a See the lot button (the aerial view); an edition's list card shows the lot preview in the card */
    await b.waitFor(`(()=>{const c=${CARDQ(ADDR)};return !!c&&!!(c.querySelector('.lotbtn')||c.querySelector('.dkc-lot'))})()`, 'phone lot button or preview');
    if (await b.js(`!!(${CARDQ(ADDR)}).querySelector('.lotbtn')`)) {
      await b.js(`performance.clearResourceTimings();(${CARDQ(ADDR)}).querySelector('.lotbtn').click()`);
      await b.waitFor(`!!document.getElementById('aerial')`, 'aerial');
    } else await b.js(`(${CARDQ(ADDR)}).querySelector('.dkc-lot').scrollIntoView();1`);
    const a = rec('phone-lot', await settle(b, 'item'));
    t(a.n >= 1 && !a.broken && !a.timeout, 'phone lot photo: photo tiles load');
    await b.js(`(()=>{const l=document.querySelector(".dkc-lot");if(l)l.scrollIntoView({block:"center"});return 1})()`); await sleep(600); await b.shot(`satc-${LABEL}-phone-lot.png`);
    t(!b.errors.length, 'phone: no page errors' + (b.errors.length ? ': ' + b.errors.slice(0, 2).join(' | ') : ''));
  } catch (e) { try { await b.shot(`satc-${LABEL}-fail.png`); console.log("  view: " + (await b.js(`(document.querySelector("#view")||document.body).innerText.slice(0,300)`))); } catch {} throw e; } finally { b.close(); }
  await sleep(2000);

  console.log('Computer 1440x900: door map (Photo) + lot preview');
  b = await browser(8992);
  try {
    await signIn(b, 1440, 900, false);
    await b.waitFor(`!!document.querySelector('input[placeholder="Find an address"]')`, 'top search');
    await b.js(`(()=>{const i=document.querySelector('input[placeholder="Find an address"]');i.focus();i.value=${JSON.stringify(ADDR.toLowerCase())};i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true})()`);
    await b.waitFor(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes(${JSON.stringify(ADDR)})&&!b.closest('.dk-list'))`, 'search result');
    await b.js(`performance.clearResourceTimings();[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(ADDR)})&&!b.closest('.dk-list')).click()`);
    await b.waitFor(`[...document.querySelectorAll('.dkc-head h2')].some(a=>a.textContent===${JSON.stringify(ADDR)})`, 'door panel');
    const [dm, dl] = await Promise.all([settle(b, 'mosaic'), settle(b, 'item')]);
    rec('desktop-map', dm); rec('desktop-lot', dl);
    t(dm.n >= 4 && !dm.broken && !dm.timeout, 'computer map: photo tiles load');
    t(dl.n >= 1 && !dl.broken && !dl.timeout, 'computer lot preview: photo tiles load');
    await sleep(600); await b.shot(`satc-${LABEL}-desktop.png`);
    t(!b.errors.length, 'computer: no page errors' + (b.errors.length ? ': ' + b.errors.slice(0, 2).join(' | ') : ''));
  } catch (e) { try { await b.shot(`satc-${LABEL}-fail.png`); console.log("  view: " + (await b.js(`(document.querySelector("#view")||document.body).innerText.slice(0,300)`))); } catch {} throw e; } finally { b.close(); }
} catch (e) { console.log('FAILED: ' + e.message); fail++; }
console.log(`\n${pass} passed, ${fail} failed`);
await sleep(2500);
process.exit(fail ? 1 : 0);
