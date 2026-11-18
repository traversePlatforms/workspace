#!/usr/bin/env node
/* Post calendar, the page in a real browser (2026-10-31): headless Chrome at phone size against a throwaway site (php -S), no Meta at all
 * (no runner here). Signs in, switches clients, opens a post, previews, approves, requests changes, and saves screenshots.
 *   node traverse/post-calendar/test/pc-ui-test.mjs [screenshot-folder] */
import { spawn, execFile } from 'node:child_process';
import http from 'node:http';
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
/* a LinkedIn stand-in that counts every request (2026-11-18): opening pages must not reach it; only Connect does */
const lihits = [];
const lisrv = http.createServer((req, res) => { const parts = []; req.on('data', (d) => parts.push(d)); req.on('end', () => {
  const u = new URL(req.url, 'http://x'), path = u.pathname.replace(/^\/+/, ''); lihits.push(req.method + ' ' + path);
  const send = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (path === 'oauth/authorization') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<p>stand-in LinkedIn consent</p>'); }
  if (path === 'oauth/accessToken') return send({ access_token: 'LI-AT-UI', expires_in: 5184000, refresh_token: 'LI-RT-UI', refresh_token_expires_in: 31536000, scope: 'r_basicprofile,r_organization_social,rw_organization_admin,w_organization_social' });
  if (path === 'v2/me') return send({ localizedFirstName: 'Matt', localizedLastName: 'Sharpe' });
  if (path === 'rest/organizationAcls') return send({ elements: [{ organization: 'urn:li:organization:111', role: 'ADMINISTRATOR', state: 'APPROVED' }] });
  if (path === 'rest/organizations/111') return send({ localizedName: 'Surge Inc' });
  res.writeHead(404); res.end('{}');
}); });
await new Promise((r) => lisrv.listen(0, '127.0.0.1', r)); const LIBASE = 'http://127.0.0.1:' + lisrv.address().port + '/';
writeFileSync(join(SITE, 'post-calendar-data', 'private', 'linkedin-app.json'), JSON.stringify({ client_id: 'LI-CLIENT', client_secret: 'LI-SECRET' }));
const env = { ...process.env, PC_SITE: SITE, PC_PUBLIC: PUB, PC_ORIGIN: ORIGIN, PC_GRAPH: 'http://127.0.0.1:9/', PC_LI_API: LIBASE + 'rest/', PC_LI_OAUTH: LIBASE + 'oauth/' };
const php = spawn('php', ['-S', '127.0.0.1:' + port, '-t', join(SITE, 'public_html')], { env, stdio: 'ignore' });
const runPhp = (args) => new Promise((r) => execFile('php', [join(SITE, 'post-calendar-tools', 'runner.php'), ...args], { env }, (e, so) => r(so)));
for (let i = 0; i < 50; i++) { try { await fetch(ORIGIN + '/'); break; } catch { await sleep(100); } }
const ADMIN = (await runPhp(['addaccount', 'Matthew Sharpe', 'admin', '--code-only'])).trim();
const EDITOR = (await runPhp(['addaccount', 'Claude drafts', 'editor', '--code-only'])).trim();
const JEN = (await runPhp(['addaccount', 'Jen Test', 'client', '--clients', 'sixfold', '--code-only'])).trim();   /* a client's own approver (2026-11-16) */
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
await runPhp(['hold', 'surge', 'fb,ig', 'Matthew 18 Nov: Surge Facebook on hold']);   /* as it is live */

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
await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
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
ok(await js(`document.querySelectorAll('.pic').length===2 && !document.getElementById('falbum') && document.getElementById('sheet').innerText.toLowerCase().indexOf('album')<0`), 'photo set: two pictures, no album name asked for');
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
/* LinkedIn for Surge (2026-11-18): Connect in Surge's client setup for Matthew; the LinkedIn target and fields on Surge posts; the hold */
{
  const hits0 = lihits.length;
  await click(`document.getElementById('pick')`); await sleep(200);
  await click(`[].find.call(document.querySelectorAll('#mbox button'),function(b){return b.textContent==='Manage clients'})`); await sleep(500);
  ok(await js(`[].some.call(document.querySelectorAll('.cl small'),function(x){return x.textContent==='LinkedIn: Not connected'}) && [].some.call(document.querySelectorAll('.cl small'),function(x){return x.textContent==='On hold: Facebook and Instagram'})`), 'Clients: Surge shows "LinkedIn: Not connected" and its hold');
  await click(`document.querySelector('[data-ed="sixfold"]')`); await sleep(500);
  ok(await js(`!document.getElementById('libox') && document.getElementById('sheet').textContent.indexOf('Connect LinkedIn')<0`), 'Sixfold\'s setup: no LinkedIn at all');
  await click(`document.getElementById('fback')`); await sleep(400);
  await click(`document.querySelector('[data-ed="surge"]')`); await sleep(600);
  ok(await js(`!!document.getElementById('liconnect') && document.getElementById('liconnect').textContent==='Connect LinkedIn' && document.getElementById('lisum').textContent==='Not connected'`), 'Surge\'s setup (Matthew): "Connect LinkedIn", status "Not connected"');
  ok(await js(`document.getElementById('sheet').textContent.indexOf('On hold: Facebook and Instagram')>=0`), 'Surge\'s setup shows the Facebook/Instagram hold');
  await shot('14-surge-linkedin-setup');
  ok(lihits.length === hits0, 'opening the calendar, the client list and Surge\'s setup sent nothing to LinkedIn');
  /* Connect: a new tab at LinkedIn's authorization page */
  { /* a real tap (a trusted mouse event), as on the phone: the new tab opens inside the tap, so no pop-up blocker */
    await js(`document.getElementById('liconnect').scrollIntoView({block:'center'})`); await sleep(200);
    const b = await js(`(function(){var r=document.getElementById('liconnect').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await sleep(1500); }
  ok(await js(`location.pathname`) === '/' + PUB + '/', 'the calendar stays where it was');
  const tabs = await (await fetch('http://127.0.0.1:' + dport + '/json')).json();
  const liTab = tabs.find((x) => x.type === 'page' && x.url.indexOf(LIBASE + 'oauth/authorization?') === 0);
  ok(!!liTab && /client_id=LI-CLIENT/.test(liTab.url) && /redirect_uri=/.test(liTab.url) && /w_organization_social/.test(liTab.url) && lihits.slice(hits0).filter((x) => !/favicon/.test(x)).join() === 'GET oauth/authorization', 'Connect LinkedIn opens LinkedIn\'s authorization page in a new tab (the only LinkedIn request)');
  /* LinkedIn's answer, as Matthew's browser would bring it back (his cookie), then pick the Page */
  const st = liTab && new URL(liTab.url).searchParams.get('state');
  const cookies = (await send('Network.getAllCookies')) || {}; const pc = (cookies.cookies || []).find((x) => x.name === 'postcal');
  const back = await fetch(ORIGIN + '/' + PUB + '/api/linkedin-oauth.php?code=GOOD&state=' + st, { headers: { Cookie: 'postcal=' + (pc ? pc.value : '') } }); const bh = await back.text();
  ok(back.status === 200 && /LinkedIn connected/.test(bh) && !/LI-AT-UI|LI-RT-UI|LI-SECRET/.test(bh), 'the return page: connected, no token');
  await js(`window.dispatchEvent(new Event('focus'))`); await sleep(700);
  ok(await js(`document.getElementById('lisum').textContent==='Connected as Matt Sharpe \\u00b7 pick the Page' && !!document.querySelector('[data-lio="111"]')`), 'back on the calendar: "Connected as Matt Sharpe · pick the Page", Surge Inc offered');
  await click(`document.querySelector('[data-lio="111"]')`); await sleep(700);
  ok(await js(`document.getElementById('lisum').textContent==='Connected as Matt Sharpe \\u00b7 Surge Inc' && document.getElementById('liconnect').textContent==='Connect LinkedIn again' && !!document.getElementById('lidisc')`), 'Surge Inc picked: "Connected as Matt Sharpe · Surge Inc"');
  await shot('15-surge-linkedin-connected');
  await js(`location.reload()`); await sleep(1500);
  /* a Surge post: LinkedIn target, its words, first comment, preview; Facebook on hold */
  await click(`document.getElementById('pick')`); await sleep(200);
  await click(`[].find.call(document.querySelectorAll('#mbox button'),function(b){return b.textContent==='Surge'})`); await sleep(800);
  ok(await js(`document.querySelector('.band .where').textContent.indexOf('LinkedIn: Surge Inc')>=0 && document.querySelector('.band .where').textContent.indexOf('(on hold)')>=0`), 'Surge lane: "LinkedIn: Surge Inc", Facebook on hold');
  await click(`document.querySelector('.card')`); await sleep(500);
  ok(await js(`!!document.querySelector('[data-t="li"]') && document.querySelector('[data-t="fb"]').textContent==='Facebook (on hold)' && document.getElementById('sheet').textContent.indexOf('Facebook is on hold for Surge')>=0`), 'Surge post: a LinkedIn button; Facebook marked on hold and listed as the reason it cannot be approved');
  await click(`document.querySelector('[data-t="fb"]')`); await sleep(200);
  await click(`document.querySelector('[data-t="li"]')`); await sleep(300);
  ok(await js(`!!document.getElementById('fli') && !!document.getElementById('flic') && document.querySelector('[data-t="fb"]').disabled`), 'LinkedIn ticked: the LinkedIn post and first comment boxes appear; held Facebook can no longer be ticked');
  await js(`(function(){var t=document.getElementById('fli');t.value='Building a sales team (part 1). See https://x.test';t.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(150);
  ok(await js(`/^52 \\/ 3,000 \\(a link: move it to the first comment\\)$/.test(document.getElementById('lic').textContent)`), 'the count uses LinkedIn\'s escaping and flags a link');
  await click(`document.getElementById('copyli')`); await sleep(150);
  await js(`(function(){var t=document.getElementById('flic');t.value='More: https://surgeftw.com/';t.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(150);
  await click(`document.querySelector('[data-pv="li"]')`); await sleep(200);
  ok(await js(`document.getElementById('pv').textContent.indexOf('Surge Inc')>=0 && document.getElementById('pv').textContent.indexOf('Building a sales team is its own job.')>=0 && !!document.querySelector('#pv a[href="https://surgeftw.com/"]')`), 'LinkedIn preview: as Surge Inc, the words, the first comment with its link');
  await js(`window.confirm=function(){return true}`); await click(`document.getElementById('save')`); await sleep(800);
  ok(await js(`!!document.getElementById('approve') && document.getElementById('approve').nextElementSibling.textContent.indexOf('Goes to LinkedIn as shown')>=0`), 'saved: LinkedIn only, ready to approve ("Goes to LinkedIn")');
  await shot('16-surge-linkedin-post');
  await click(`document.getElementById('back')`); await sleep(600);
  ok(lihits.filter((x) => x.indexOf('rest/posts') >= 0 || x.indexOf('images') >= 0).length === 0, 'nothing posted to LinkedIn from the page (only the runner posts)');
  /* the editor: no client setup, so no Connect */
  await click(`document.getElementById('pick')`); await sleep(200);
  await click(`[].find.call(document.querySelectorAll('#mbox button'),function(b){return b.textContent==='Sign out'})`); await sleep(700);
  await js(`document.getElementById('code').value=${JSON.stringify(EDITOR)};document.getElementById('sf').requestSubmit()`); await sleep(1200);
  await click(`document.getElementById('pick')`); await sleep(200);
  ok(await js(`[].every.call(document.querySelectorAll('#mbox button'),function(b){return b.textContent!=='Manage clients'}) && document.body.innerText.indexOf('Connect LinkedIn')<0`), 'the editor\'s menu: no Manage clients, no Connect LinkedIn');
  await click(`[].find.call(document.querySelectorAll('#mbox button'),function(b){return b.textContent==='Sign out'})`); await sleep(700);
  await js(`document.getElementById('code').value=${JSON.stringify(ADMIN)};document.getElementById('sf').requestSubmit()`); await sleep(1200);
}
/* a Sixfold-only sign-in (2026-11-16): straight to Sixfold 365, no client switcher, no client setup, Approve, and its posting days */
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await click(`document.getElementById('pick')`); await sleep(200);
await click(`[].find.call(document.querySelectorAll('#mbox button'),function(b){return b.textContent==='Sign out'})`); await sleep(700);
ok(await js(`!document.getElementById('signin').hidden`), 'signed out');
await js(`document.getElementById('code').value=${JSON.stringify(JEN)};document.getElementById('sf').requestSubmit()`); await sleep(1200);
ok(await js(`!!document.querySelector('.band h1') && document.querySelector('.band h1').textContent.indexOf('Sixfold 365')>=0 && !document.getElementById('toall')`), 'client sign-in: opens on Sixfold 365 (remembered Surge ignored), no "All clients"');
{ const t = await js(`document.body.textContent`); const i = t.indexOf('Surge'); ok(t.indexOf('Building a sales team') < 0 && i < 0, 'client sign-in: no Surge anywhere on the page' + (i >= 0 ? ' (found: ...' + t.slice(Math.max(0, i - 60), i + 40) + ')' : '')); ok((await js(`document.body.innerText`)).indexOf('LinkedIn') < 0, 'client sign-in: no LinkedIn anywhere on the page'); }
await click(`document.getElementById('pick')`); await sleep(200);
ok(await js(`(function(){var t=[].map.call(document.querySelectorAll('#mbox button'),function(b){return b.textContent});return t.indexOf('Posting days')>=0 && t.indexOf('Manage clients')<0 && !t.some(function(x){return /All clients|Surge|Sixfold/.test(x)})})()`), 'menu: Posting days, no client list, no Manage clients');
await shot('11-client-menu');
await click(`[].find.call(document.querySelectorAll('#mbox button'),function(b){return b.textContent==='Posting days'})`); await sleep(400);
ok(await js(`document.querySelectorAll('.slotrow').length===3 && !document.getElementById('cp') && !document.getElementById('ct') && !document.getElementById('cn')`), 'posting days: the three slots, no Page, token or name fields');
await shot('12-client-days');
await js(`(function(){var s=document.querySelector('[data-sd="0"]');s.value='1';s.dispatchEvent(new Event('change'))})()`);
await click(`document.getElementById('dsave')`); await sleep(900);
ok(await js(`document.getElementById('sheet').hidden && [].some.call(document.querySelectorAll('.open'),function(o){return o.textContent.indexOf('Mon')>=0})`), 'saved: the calendar offers Monday now');
await click(`[].find.call(document.querySelectorAll('.card'),function(c){return c.textContent.indexOf('Photo set')<0})`); await sleep(500);
ok(await js(`!!document.querySelector('.req') || !!document.getElementById('approve') || !!document.getElementById('withdraw')`), 'her post sheet offers the approver\'s buttons');
ok(await js(`document.body.textContent.indexOf('Only his sign-in')<0 && document.body.textContent.indexOf('Ready for Matthew')<0`), 'no "Matthew only" wording');
ok(await js(`/\\.mov/.test(document.getElementById('file').accept) && document.body.textContent.indexOf('Phone videos: record in 1080p, under 90 seconds')>=0`), 'a single post takes a phone video (.mov too) and says how to record it');
await shot('13-client-post');
ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
ws.close(); chrome.kill(); php.kill(); lisrv.close();
setTimeout(() => { try { rmSync(prof, { recursive: true, force: true }); rmSync(T, { recursive: true, force: true }); } catch {} }, 500);
console.log(`${pass} passed, ${failN} failed`); if (failN) process.exitCode = 1;
setTimeout(() => process.exit(), 800);
