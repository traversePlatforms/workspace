#!/usr/bin/env node
/* Post calendar, the page in a real browser (2026-10-31): headless Chrome at phone size against a throwaway site (php -S), no Meta at all
 * (no runner here). Signs in, switches clients, opens a post, previews, approves, requests changes, and saves screenshots.
 *   node traverse/post-calendar/test/pc-ui-test.mjs [screenshot-folder] */
import { spawn, execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = resolve(HERE, '..'); const SHOTS = process.argv[2] || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('  FAIL ' + m); } };
function png(w, h, rgb) {
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const row = Buffer.alloc(1 + w * 3); for (let i = 0; i < w; i++) { row[1 + i * 3] = rgb[0]; row[2 + i * 3] = rgb[1]; row[3 + i * 3] = rgb[2]; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
}
const T = mkdtempSync(join(tmpdir(), 'pcui-')); const SITE = join(T, 'site'); const PUB = 'posts-test';
mkdirSync(join(SITE, 'public_html', PUB, 'media'), { recursive: true });
for (const f of ['index.html', 'manifest.json', 'sw.js', 'icon-192.png', 'apple-touch-icon.png']) cpSync(join(ROOT, 'app', f), join(SITE, 'public_html', PUB, f));
cpSync(join(ROOT, 'app', 'api'), join(SITE, 'public_html', PUB, 'api'), { recursive: true });
cpSync(join(ROOT, 'server'), join(SITE, 'post-calendar-tools'), { recursive: true });
mkdirSync(join(SITE, 'post-calendar-data', 'private'), { recursive: true });
const port = 20000 + Math.floor(Math.random() * 2000), ORIGIN = 'http://127.0.0.1:' + port;
const env = { ...process.env, PC_SITE: SITE, PC_PUBLIC: PUB, PC_ORIGIN: ORIGIN, PC_GRAPH: 'http://127.0.0.1:9/' };
const php = spawn('php', ['-S', '127.0.0.1:' + port, '-t', join(SITE, 'public_html')], { env, stdio: 'ignore' });
const runPhp = (args) => new Promise((r) => execFile('php', [join(SITE, 'post-calendar-tools', 'runner.php'), ...args], { env }, (e, so) => r(so)));
for (let i = 0; i < 50; i++) { try { await fetch(ORIGIN + '/'); break; } catch { await sleep(100); } }
const ADMIN = (await runPhp(['addaccount', 'Matthew Sharpe', 'admin', '--code-only'])).trim();
const EDITOR = (await runPhp(['addaccount', 'Claude drafts', 'editor', '--code-only'])).trim();
/* two drafts per client through the API as the editor */
let ck = ''; const call = async (a, b) => { const o = { method: b ? 'POST' : 'GET', headers: { Cookie: ck } }; if (b instanceof FormData) { o.body = b; o.headers['X-PC'] = '1'; } else if (b) { o.body = JSON.stringify(b); o.headers['Content-Type'] = 'application/json'; o.headers['X-PC'] = '1'; } const r = await fetch(ORIGIN + '/' + PUB + '/api/cal.php?action=' + a, o); const sc = r.headers.get('set-cookie'); if (sc) ck = sc.split(';')[0]; return r.json(); };
await call('signin', { code: EDITOR });
const up = (id, buf) => { const fd = new FormData(); fd.append('id', id); fd.append('file', new Blob([buf], { type: 'image/png' }), 'p.png'); return call('upload', fd); };
const s1 = await call('create', { client: 'sixfold', fb: 'Leave the plugs where they fall.\n\nAfter we aerate you will see little cores of soil all over the lawn.', ig: 'Leave the plugs where they fall.\n\n#lawnaeration', targets: ['fb', 'ig'], date: '2027-11-09', time: '15:00', note: '' });
await up(s1.id, png(1080, 1350, [47, 93, 44]));
const s2 = await call('create', { client: 'sixfold', type: 'photoset', album: 'Saturday jobs', fb: 'This week on the job.', ig: 'This week on the job.', targets: ['fb', 'ig'], date: '2027-11-13', time: '14:00' });
await up(s2.id, png(1080, 1350, [76, 122, 63])); await up(s2.id, png(1080, 1080, [228, 112, 58]));
const g1 = await call('create', { client: 'surge', fb: 'Building a sales team is its own job.', targets: ['fb'], date: '2027-11-11', time: '15:00', note: "NEEDS MATTHEW'S REVIEW: loaded from a draft." });
await up(g1.id, png(1080, 1350, [20, 20, 20]));

/* ---- Chrome ---- */
const prof = mkdtempSync(join(tmpdir(), 'pcui-chrome-')); const dport = 9600 + Math.floor(Math.random() * 300);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + dport, '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
let tg; for (let i = 0; i < 40 && !tg; i++) { await sleep(250); try { tg = (await (await fetch('http://127.0.0.1:' + dport + '/json')).json()).find((x) => x.type === 'page'); } catch {} }
const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let mid = 0; const pend = new Map(); const errors = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
const send = (m, p = {}) => new Promise((res) => { const i = ++mid; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const js = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) { errors.push(r.exceptionDetails.exception?.description || r.exceptionDetails.text); } return r.result?.value; };
const shot = async (name) => { if (!SHOTS) return; const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); mkdirSync(SHOTS, { recursive: true }); writeFileSync(join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64')); };
const click = (sel) => js(`(function(){var e=${sel};if(!e)return false;e.click();return true})()`);
const byText = (t) => `[].find.call(document.querySelectorAll('button'),function(b){return b.textContent.trim().indexOf(${JSON.stringify(t)})===0&&b.offsetParent!==null})`;
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: ORIGIN + '/' + PUB + '/' }); await sleep(1200);
ok(await js(`!document.getElementById('signin').hidden`), 'opens on the sign-in');
await shot('01-signin');
await js(`document.getElementById('code').value=${JSON.stringify(ADMIN)};document.getElementById('sf').requestSubmit()`); await sleep(1000);
ok(await js(`document.getElementById('app').hidden===false`), 'signed in');
await click(`document.getElementById('pick')`); await sleep(200);
await click(`[].find.call(document.querySelectorAll('#mbox button'),function(b){return b.textContent==='Sixfold 365'})`); await sleep(800);
ok(await js(`document.querySelector('.band h1').textContent.indexOf('Sixfold 365')>=0`), 'Sixfold 365 lane');
ok(await js(`document.querySelectorAll('.card').length===2 && document.body.textContent.indexOf('Building a sales team')<0`), 'only Sixfold posts on the Sixfold lane');
ok(await js(`document.querySelectorAll('.open').length>0`), 'open default slots shown');
ok(await js(`document.documentElement.scrollWidth<=390`), 'no sideways scroll at phone width');
await shot('02-sixfold-lane');
await click(`document.querySelector('.card')`); await sleep(500);
ok(await js(`!!document.getElementById('approve')`), 'a ready draft shows Approve');
ok(await js(`document.getElementById('approve').textContent.indexOf('Tue, Nov 9')>=0 && document.getElementById('approve').textContent.indexOf('MST')>=0`), 'Approve says the Mountain time');
ok(await js(`!!document.querySelector('#pv .pv img') && document.querySelector('#pv').textContent.indexOf('Leave the plugs')>=0`), 'Facebook preview shows picture and caption');
await shot('03-post');
await click(`document.querySelector('[data-pv="ig"]')`); await sleep(150);
ok(await js(`document.querySelector('#pv').textContent.indexOf('365aeration')>=0`), 'Instagram preview shows @365aeration');
await js(`document.getElementById('pv').scrollIntoView()`); await shot('04-preview-ig');
await js(`document.querySelector('.sheet').scrollTop=0`);
await click(`document.getElementById('approve')`); await sleep(700);
ok(await js(`document.querySelector('.good') && document.querySelector('.good').textContent.indexOf('Approved')>=0`), 'tapping Approve approves it (who and when shown)');
await shot('05-approved');
await js(`var t=document.getElementById('ffb');t.value=t.value+' Edited.';t.dispatchEvent(new Event('input',{bubbles:true}))`); await sleep(100);
ok(await js(`!document.getElementById('savebar').hidden && document.getElementById('save').textContent.indexOf('drops the approval')>=0`), 'editing an approved post warns that saving drops the approval');
await js(`window.confirm=function(){return true}`);
await click(`document.getElementById('save')`); await sleep(700);
ok(await js(`document.querySelector('.sheethead .pill').textContent==='Draft' && !!document.getElementById('approve')`), 'saved: back to draft, Approve offered again');
await js(`document.getElementById('rq').value='Crop tighter.'`); await click(`document.getElementById('rqgo')`); await sleep(700);
ok(await js(`document.querySelector('.req') && document.querySelector('.req').textContent.indexOf('Crop tighter.')>=0 && !document.getElementById('approve')`), 'change request shown; no Approve while it is open');
await shot('06-changes');
await click(`document.getElementById('back')`); await sleep(700);
ok(await js(`document.body.textContent.indexOf('Needs attention')>=0`), 'requested post listed under Needs attention');
await click(`[].find.call(document.querySelectorAll('.card'),function(c){return c.textContent.indexOf('Photo set')>=0})`); await sleep(500);
ok(await js(`document.querySelectorAll('.pic').length===2 && !!document.getElementById('falbum')`), 'photo set: two pictures and the album name');
await shot('07-photoset');
/* a picture full size (2026-11-03) */
await click(`document.querySelectorAll('.pic img')[1]`); await sleep(300);
ok(await js(`!!document.querySelector('.zoom') && document.querySelector('.zoom .zc').textContent==='2 of 2' && document.querySelector('.zoom img').src===document.querySelectorAll('.pic img')[1].src`), 'tapping a picture opens it full size (2 of 2)');
ok(await js(`(function(){var r=document.querySelector('.zoom').getBoundingClientRect();return r.width>=380&&r.height>=700})()`), 'full size covers the screen');
await shot('07b-zoom');
await click(`document.querySelector('.zoom .zn')`); await sleep(200);
ok(await js(`document.querySelector('.zoom .zc').textContent==='1 of 2'`), 'next steps round to picture 1');
await js(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})) || true`); await sleep(200);
ok(await js(`!document.querySelector('.zoom') && !document.getElementById('sheet').hidden`), 'Escape closes the picture, the post stays open');
await click(`document.querySelector('#pv img')`); await sleep(300);
ok(await js(`!!document.querySelector('.zoom') && document.querySelector('.zoom .zc').textContent.indexOf('of 2')>0`), 'a preview picture opens full size too');
await click(`document.querySelector('.zoom .zx')`); await sleep(200);
ok(await js(`!document.querySelector('.zoom')`), 'the X closes it');
await click(`document.getElementById('back')`); await sleep(500);
await click(`document.getElementById('pick')`); await sleep(200);
await click(`[].find.call(document.querySelectorAll('#mbox button'),function(b){return b.textContent==='Surge'})`); await sleep(800);
ok(await js(`document.querySelectorAll('.card').length===1 && document.body.textContent.indexOf('Leave the plugs')<0 && document.body.textContent.indexOf('Needs review')>=0`), 'Surge lane: only Surge, marked needs review');
ok(await js(`getComputedStyle(document.documentElement).getPropertyValue('--client').trim()==='#111111'`), 'Surge lane in Surge colour');
await shot('08-surge-lane');
await click(`document.getElementById('pick')`); await sleep(200);
await click(`[].find.call(document.querySelectorAll('#mbox button'),function(b){return b.textContent.indexOf('All clients')===0})`); await sleep(700);
ok(await js(`document.querySelectorAll('.ovc').length===2 && document.querySelectorAll('.card').length===0`), 'overview: counts only');
await shot('09-overview');
/* the way back to the client list (2026-10-31): a "‹ All clients" control on every client view, and the phone's Back */
const onList = `document.querySelectorAll('.ovc').length===2 && !document.getElementById('toall')`;
for (const width of [390, 1280]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: width === 390 ? 844 : 800, deviceScaleFactor: width === 390 ? 2 : 1, mobile: width === 390 });
  await send('Page.navigate', { url: ORIGIN + '/' + PUB + '/' }); await sleep(1200);   /* remembers the last client opened */
  await click(`[].find.call(document.querySelectorAll('.ovc'),function(b){return b.textContent.indexOf('Sixfold 365')===0})`); await sleep(800);
  const r = await js(`(function(){var b=document.getElementById('toall');if(!b)return null;var r=b.getBoundingClientRect();return {top:r.top,vis:r.width>0&&r.height>=40,text:b.textContent}})()`);
  ok(r && r.vis && r.top < 140 && /All clients/.test(r.text), width + ' px: "All clients" at the top of the client view, 44 px tall');
  ok(await js(`document.documentElement.scrollWidth<=${width}`), width + ' px: no sideways scroll');
  await shot('10-back-' + width);
  await click(`document.getElementById('toall')`); await sleep(700);
  ok(await js(onList), width + ' px: "All clients" opens the client list');
  await click(`[].find.call(document.querySelectorAll('.ovc'),function(b){return b.textContent.indexOf('Sixfold 365')===0})`); await sleep(700);
  await click(`document.querySelector('.card')`); await sleep(500);
  ok(await js(`!document.getElementById('sheet').hidden`), width + ' px: post open');
  await js(`history.back()`); await sleep(800);
  ok(await js(`document.getElementById('sheet').hidden && !!document.getElementById('toall') && document.querySelector('.band h1').textContent.indexOf('Sixfold 365')>=0`), width + ' px: Back closes the post, back on Sixfold 365');
  await js(`history.back()`); await sleep(800);
  ok(await js(onList), width + ' px: Back again reaches the client list');
}
/* a fresh open lands on the remembered client, and Back still reaches the list */
await click(`[].find.call(document.querySelectorAll('.ovc'),function(b){return b.textContent.indexOf('Surge')===0})`); await sleep(700);
await send('Page.navigate', { url: ORIGIN + '/' + PUB + '/' }); await sleep(1200);
ok(await js(`!!document.getElementById('toall') && document.querySelector('.band h1').textContent.indexOf('Surge')>=0`), 'reopened: lands on the remembered client (Surge)');
await js(`history.back()`); await sleep(800);
ok(await js(onList), 'reopened: Back reaches the client list');
ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
ws.close(); chrome.kill(); php.kill();
setTimeout(() => { try { rmSync(prof, { recursive: true, force: true }); rmSync(T, { recursive: true, force: true }); } catch {} }, 500);
console.log(`${pass} passed, ${failN} failed`); if (failN) process.exitCode = 1;
setTimeout(() => process.exit(), 800);
