/* The measure-only role (21 Nov 2026, Matthew picked option 1: "A small 'measure' account type on Traverse Yards: she can only search, open a
   house and save a measure"; for Claire's hand lawn measures). Two throwaway edition installs from the source (traverse/app), each on PHP's test
   server in a fresh temp folder with throwaway codes and one made-up town of three houses:
     yards   features.measure on (as Traverse Yards): the role is offered in Accounts; a measure account searches, opens a house (trimmed) and
             saves a hand measure, and is refused every other kind of action
     other   features.measure off (every other install): the role is not offered; a measure line put straight into its codes file is just as
             shut in, and the other roles answer as before
   Then headless Chrome on the yards install: a measure sign-in opens on the one screen (search, the house, Save my measure), with none of the
   rest of the app on it, on a computer and on a phone. Nothing real is called: the lot line comes from a stub file on the test server.
   Run once per run (fresh data every time):   node traverse/app/review-measure-1121/tests/measure-test.mjs */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
const HERE = dirname(fileURLToPath(import.meta.url)), APP = join(HERE, '..', '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; return ok; };
const TMP = mkdtempSync(join(tmpdir(), 'measure-'));
const CODES = { admin: '637101', crew: '637102', office: '637103', measure: '637104', other: '637105' };
const procs = [];
const LON = -104.9501, LAT = 39.6001;
function install(name, port, measureOn) {
  const T = join(TMP, name), WWW = join(T, 'www'), DATA = join(T, 'sixfold-data', 'rounds'), PRIV = join(T, 'sixfold-private');
  mkdirSync(join(WWW, 'api'), { recursive: true }); mkdirSync(DATA, { recursive: true }); mkdirSync(PRIV, { recursive: true });
  for (const f of readdirSync(join(APP, 'api'))) if (f.endsWith('.php')) cpSync(join(APP, 'api', f), join(WWW, 'api', f));
  cpSync(join(APP, 'summit-de59ae83'), join(WWW, 'summit-de59ae83'), { recursive: true });
  const co = { name: 'Test Lawn ' + name, short: 'Test Lawn', phone: '(555) 010-0100', email: 'office@example.com', best: 'yards',
    features: { walkdesk: true, crew: true, company: true, billexempt: true, ...(measureOn ? { measure: true } : {}) } };
  writeFileSync(join(DATA, 'company.json'), JSON.stringify(co, null, 2));
  writeFileSync(join(DATA, 'index.json'), JSON.stringify({ regions: [{ key: 'testtown', label: 'Testtown', c: [LAT, LON], areas: 1, doors: 4 }] }));
  const door = (n, sq) => ({ id: 'tt-' + n, address: (1836 + 4 * n) + ' PONDEROSA DR', lat: LAT + n * 0.0001, lon: LON, acres: 0.21, owner: 'JANE OWNER ' + n, val: 512000, fire: 2, lawn: { sq, lv: 'M', yr: 2023 } });
  writeFileSync(join(DATA, 'testtown.json'), JSON.stringify({ areas: [{ name: 'MAPLE AREA', doors: [door(1, 3100), door(2, 2800), door(3, 4200), door(4, 2800)] }] }));
  /* the lot line: the parcel map's answer, from a file on the test server (the API reads this only on PHP's test server) */
  writeFileSync(join(WWW, 'parcel-stub.json'), JSON.stringify({ features: [{ geometry: { rings: [[[LON - 0.0003, LAT - 0.0002], [LON + 0.0003, LAT - 0.0002], [LON + 0.0003, LAT + 0.0006], [LON - 0.0003, LAT + 0.0006], [LON - 0.0003, LAT - 0.0002]]] } }] }));
  writeFileSync(join(PRIV, 'parcel-api-test.txt'), 'http://127.0.0.1:' + (port + 100) + '/parcel-stub.json');   /* its own little server: PHP's test server answers one request at a time, so it cannot ask itself */
  const stub = readFileSync(join(WWW, 'parcel-stub.json')); const ps = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(stub); }).listen(port + 100, '127.0.0.1'); procs.push({ kill: () => ps.close() });
  /* the measure line straight in the codes file in both: in "other" that is the only way one could exist (Accounts does not offer it there) */
  const people = { [CODES.admin]: ['Pat Admin', 'admin'], [CODES.crew]: ['Brad Crew', 'crew'], [CODES.office]: ['Jen Office', 'office'], [CODES.measure]: ['Claire Measure', 'measure'] };
  writeFileSync(join(PRIV, 'rounds-codes.php'), "<?php\nreturn ['session_key' => '" + randomBytes(32).toString('hex') + "', 'session_days' => 45, 'people' => " + JSON.stringify(people).replace(/\{/g, '[').replace(/\}/g, ']').replace(/":/g, '" =>') + "];\n");
  procs.push(spawn('php', ['-d', 'memory_limit=768M', '-S', '127.0.0.1:' + port, '-t', WWW], { stdio: 'ignore' }));
  return { ORIGIN: 'http://127.0.0.1:' + port, API: 'http://127.0.0.1:' + port + '/api/rounds.php', DATA };
}
function req(url, { method = 'GET', body = null, cookie = '' } = {}) {
  return new Promise((res) => {
    const data = body == null ? null : JSON.stringify(body);
    const r = http.request(url, { method, headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...(cookie ? { Cookie: cookie } : {}) } }, (x) => {
      let s = ''; x.setEncoding('utf8'); x.on('data', (d) => (s += d)); x.on('end', () => { let j = {}; try { j = JSON.parse(s); } catch { j = { raw: s.slice(0, 300) }; } j._status = x.statusCode; j._cookies = x.headers['set-cookie'] || []; res(j); });
    });
    r.on('error', (e) => res({ _status: 0, error: String(e) })); if (data) r.write(data); r.end();
  });
}
function client(I) {
  const jars = {};
  const call = async (who, action, body, q = '') => {
    const j = await req(I.API + '?action=' + action + q, { method: body ? 'POST' : 'GET', body, cookie: jars[who] || '' });
    if (j._cookies.length) { const jar = Object.fromEntries((jars[who] || '').split('; ').filter(Boolean).map((c) => c.split('='))); for (const c of j._cookies) { const [k, v] = c.split(';')[0].split('='); jar[k] = v; } jars[who] = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '); }
    return j;
  };
  const signin = async (who, code) => { const s = await call(who, 'signin', { code: code || CODES[who], dev: 'c' }); if (s.terms && s.terms.due) s.accepted = await call(who, 'termsaccept', { terms: s.terms.terms, agreement: s.terms.agreement || '' }); return s; };
  return { call, signin };
}
const logRows = (I, f) => existsSync(join(I.DATA, f)) ? readFileSync(join(I.DATA, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
/* every other kind of action, with how it is asked (GET, or POST with a small body): doors, marks, towns, leads, quotes, customers, jobs, money,
   team and accounts, settings, alerts, help, photos, exports, the lawn tools that are not the hand measure */
const OTHERS = [
  ['regions'], ['regionsig'], ['regionareas'], ['area', null, '&region=testtown&area=0'], ['streets'], ['mark', { region: 'testtown', id: 'tt-1', outcome: 'nothome' }],
  ['note', { region: 'testtown', id: 'tt-1', note: 'x' }], ['mydoors'], ['walk', {}], ['others'],
  ['leads'], ['myleads'], ['leadadd', { name: 'Ann Lead', phone: '3035550100' }], ['leadstatus', { id: 'x', status: 'won' }], ['teamleads'],
  ['kit'], ['kitquote', {}], ['quotes'], ['a365pricing'], ['a365calc', {}], ['signsend', {}],
  ['customers'], ['customersave', {}], ['customersexport'],
  ['jobs'], ['schedview'], ['myjobs'], ['jobsave', {}], ['calendar'],
  ['payments'], ['squarepage'], ['billing'], ['receipt', {}],
  ['accounts'], ['accountadd', { name: 'Sneaky One', role: 'admin' }], ['teams'], ['teamsave', {}], ['viewaslist'],
  ['companyset', { name: 'Hacked' }], ['perms'], ['stats'], ['mystats'], ['board'], ['statspage'],
  ['alertlist'], ['alertcount'], ['pushsubscribe', {}], ['helplist'], ['helpsend', { text: 'hi' }],
  ['photo', {}], ['photoget'], ['training'], ['money'], ['climate'], ['hoursall'], ['pwmine'],
  ['lawnrange', null, '&region=testtown&id=tt-1'], ['lawnmask', null, '&region=testtown'], ['lawncheck', {}], ['lawnfix', {}], ['proppull', { address: '1 Main St', town: 'Testtown' }],
  ['planexport'], ['skiptrace', {}], ['taplog', { taps: [] }], ['backup']
];

const YARDS = install('yards', 8711, true), OTHER = install('other', 8712, false);
let chrome = null, prof = null;
try {
  for (const I of [YARDS, OTHER]) for (let i = 0; i < 80; i++) { if ((await req(I.API + '?action=company'))._status === 200) break; await sleep(150); }
  const Y = client(YARDS), O = client(OTHER);

  console.log('\nSigning in as measure only (Traverse Yards)');
  let s = await Y.signin('measure');
  t(s.ok && s.role === 'measure' && s.name === 'Claire Measure', 'the measure code signs in, role measure');
  t(!s.terms || !s.terms.due || (s.accepted && s.accepted.ok), 'the terms can be read and agreed (' + (s.accepted ? s.accepted._status : 'not due') + ')');
  let me = await Y.call('measure', 'me'); t(me.ok && me.role === 'measure', '"me" answers as measure');

  console.log('\nSearch and the house, trimmed');
  let sr = await Y.call('measure', 'search', null, '&q=' + encodeURIComponent('1840 ponderosa') + '&lookup=1');
  const hit = (sr.results || [])[0] || {};
  t(sr.ok && hit.id === 'tt-1' && hit.address === '1840 PONDEROSA DR', 'search finds 1840 Ponderosa Dr');
  t(sr.ok && (sr.results || []).every((r) => !('lawn' in r) && !('fire' in r) && !('tl' in r)), 'the results carry the address only: no lawn level, fire or trees');
  let srA = await Y.call('admin', 'search', null, '&q=' + encodeURIComponent('1840 ponderosa'));
  if (!srA.ok && srA._status === 401) { await Y.signin('admin'); srA = await Y.call('admin', 'search', null, '&q=' + encodeURIComponent('1840 ponderosa')); }
  t(srA.ok && srA.results[0] && srA.results[0].lawn && srA.results[0].lawn.lv === 'M', 'an admin\u2019s search is as before (lawn level kept)');
  let hs = await Y.call('measure', 'a365house', null, '&region=testtown&id=tt-1');
  t(hs.ok && hs.house && hs.house.address === '1840 PONDEROSA DR' && hs.house.lat && hs.house.lon && hs.house.acres === 0.21, 'the house opens: address, where it is, lot size');
  t(hs.ok && !('owner' in hs.house) && !('lawn' in hs.house) && !('val' in hs.house) && !('mark' in hs.house) && !('range' in hs.house) && !('fire' in hs.house), 'and nothing else: no owner, value, marks, fire or our lawn figure');
  let ha = await Y.call('admin', 'a365house', null, '&region=testtown&id=tt-1');
  t(ha.ok && ha.house.owner && ha.house.lawn && ha.house.lawn.sq === 3100, 'an admin still gets the whole house');
  let pa = await Y.call('measure', 'parcelat', null, '&lon=' + LON.toFixed(6) + '&lat=' + (LAT + 0.0001).toFixed(6));
  t(pa.ok && Array.isArray(pa.rings) && pa.rings.length === 1, 'the lot line answers (for the photo) ' + (pa.ok ? '' : JSON.stringify(pa).slice(0, 200)));

  console.log('\nSaving a hand measure');
  let lh = await Y.call('measure', 'lawnhand', { region: 'testtown', id: 'tt-1', sq: 2950, src: 'ge', incl: 'grass' });
  t(lh.ok && lh.hand && lh.hand.sq === 2950 && lh.hand.by === 'Claire Measure', 'measure saves a hand measure (2,950 sq ft)');
  let rows = logRows(YARDS, 'lawnhand-testtown.log');
  t(rows.length === 1 && rows[0].id === 'tt-1' && rows[0].sq === 2950 && rows[0].by === 'Claire Measure' && rows[0].src === 'ge' && rows[0].incl === 'grass' && rows[0].photo === 3100, 'it lands in lawnhand-testtown.log with the photo figure beside it (the calibration row)');
  hs = await Y.call('measure', 'a365house', null, '&region=testtown&id=tt-1');
  t(hs.ok && hs.house.hand && hs.house.hand.sq === 2950, 'the house now shows her measure');
  lh = await Y.call('measure', 'lawnhand', { region: 'testtown', id: 'tt-1', sq: 3010, src: 'ge', incl: 'trees' });
  t(lh.ok && lh.hand.sq === 3010, 'she can change her own measure');
  let get = await Y.call('measure', 'lawnhand', null, '&region=testtown&id=tt-2');
  t(get._status === 405, 'a GET does not save (405)');
  let bad = await Y.call('measure', 'lawnhand', { region: 'testtown', id: 'tt-2', sq: 40, src: 'ge', incl: 'grass' });
  t(!bad.ok && bad._status === 400, 'a size under 100 sq ft is refused');
  let adm = await Y.call('admin', 'lawnhand', { region: 'testtown', id: 'tt-3', sq: 4000, src: 'wheel', incl: 'grass' });
  t(adm.ok, 'an admin saves one too, as before');
  let over = await Y.call('measure', 'lawnhand', { region: 'testtown', id: 'tt-3', sq: 4500, src: 'ge', incl: 'grass' });
  t(!over.ok && over._status === 403, 'measure cannot change someone else\u2019s measure (403)');
  let clr = await Y.call('measure', 'lawnhand', { region: 'testtown', id: 'tt-3', sq: 0 });
  t(!clr.ok && clr._status === 403, 'nor clear it');
  await Y.signin('crew'); let cr = await Y.call('crew', 'lawnhand', { region: 'testtown', id: 'tt-2', sq: 2000, src: 'ge', incl: 'grass' });
  t(!cr.ok && cr._status === 403, 'a sales rep still cannot save one (unchanged)');

  console.log('\nRefused: every other kind of action (' + OTHERS.length + ')');
  const notRefused = [];
  for (const [a, body, q] of OTHERS) { const j = await Y.call('measure', a, body || null, q || ''); if (!(j._status === 403 && j.error === 'Not allowed.')) notRefused.push(a + ' ' + j._status); }
  t(!notRefused.length, 'each one answers 403 Not allowed.' + (notRefused.length ? ' NOT: ' + notRefused.join(', ') : ''));
  me = await Y.call('measure', 'me'); t(me.ok && me.role === 'measure', 'and she is still signed in after all that');
  const adminOk = [];
  for (const a of ['leads', 'customers', 'accounts', 'regions', 'stats']) { const j = await Y.call('admin', a); if (!j.ok) adminOk.push(a + ' ' + j._status); }
  t(!adminOk.length, 'the admin opens leads, customers, accounts, towns and stats as before' + (adminOk.length ? ': ' + adminOk.join(', ') : ''));
  const crewOk = await Y.call('crew', 'regions'); t(crewOk.ok, 'a sales rep opens the towns as before');

  console.log('\nAccounts: offered where features.measure is on, only there');
  let ac = await Y.call('admin', 'accountadd', { name: 'Claire Two', role: 'measure' });
  t(ac.ok && ac.role === 'measure' && /^\d{6}$/.test(ac.code || ''), 'Yards: an admin adds a measure-only account in Accounts');
  const Y2 = client(YARDS); s = await Y2.signin('x', ac.code);
  t(s.ok && s.role === 'measure', 'and it signs in as measure');
  let lst = await Y.call('admin', 'accounts'); const cRow = (lst.accounts || []).find((a) => a.name === 'Claire Two');
  t(cRow && cRow.role === 'measure', 'Accounts lists it as measure');
  await O.signin('admin');
  let oa = await O.call('admin', 'accountadd', { name: 'Claire Three', role: 'measure' });
  t(!oa.ok && oa._status === 400, 'another install: the role is not offered ("' + (oa.error || '') + '")');
  s = await O.signin('measure');
  t(s.ok && s.role === 'measure', 'another install: a measure line typed into its codes file signs in');
  const oNot = [];
  for (const a of ['regions', 'leads', 'customers', 'accounts', 'jobs']) { const j = await O.call('measure', a); if (j._status !== 403) oNot.push(a + ' ' + j._status); }
  t(!oNot.length, 'and is just as shut in' + (oNot.length ? ': ' + oNot.join(', ') : ''));
  let oh = await O.call('measure', 'a365house', null, '&region=testtown&id=tt-2');
  t(oh.ok && !('owner' in oh.house), 'and gets the same trimmed house');
  const oCo = await O.call('admin', 'company'); t(oCo.ok && !(oCo.company.features || {}).measure, 'that install\u2019s company says no measure feature');

  /* ---------------- the browser ---------------- */
  const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe', CP = 9541; prof = mkdtempSync(join(tmpdir(), 'cdp-measure-'));
  chrome = spawn(CH, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${CP}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
  let tg; for (let k = 0; k < 60 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${CP}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
  const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((x) => (ws.onopen = x));
  let cid = 0; const pend = new Map(), errs = [], calls = [];
  const send = (m, p = {}) => new Promise((x) => { const i = ++cid; pend.set(i, x); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result || {}); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true });
    if (m.method === 'Network.requestWillBeSent') { const u = m.params.request.url, a = /rounds\.php\?action=([a-z0-9]+)/.exec(u); if (a) calls.push(a[1]); }
  };
  const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, userGesture: true })).result?.value;
  const until = async (e, ms = 20000) => { for (let x = 0; x < ms; x += 150) { if (await js(e)) return true; await sleep(150); } return false; };
  const shot = async (nm) => writeFileSync(join(TMP, nm), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  const btn = (re) => `[...document.querySelectorAll('button,a')].find(b=>${re}.test((b.textContent||'').trim()) && b.offsetParent)`;
  const click = async (sel) => {
    const r = await js(`(function(){var e=${sel};if(!e)return null;e.scrollIntoView({block:'center'});var b=e.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2];})()`);
    if (!r) return false; await sleep(120);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[0], y: r[1] }); await sleep(60);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r[0], y: r[1], button: 'left', clickCount: 1 }); await sleep(40);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r[0], y: r[1], button: 'left', clickCount: 1 });
    return true;
  };
  const type = async (sel, text) => { await js(`(function(){var i=${sel};i.focus();i.value='';})()`); await send('Input.insertText', { text }); await js(`(function(){var i=${sel};i.dispatchEvent(new Event('input',{bubbles:true}));})()`); };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  const signBrowser = async (I, code) => {
    await send('Network.clearBrowserCookies');
    await send('Page.navigate', { url: I.ORIGIN + '/summit-de59ae83/' }); await sleep(900);
    await js(`localStorage.clear()`);   /* the last round's Sign out leaves its signed-out flag */
    await js(`fetch('../api/rounds.php?action=signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'${code}',dev:'c'})}).then(r=>r.json()).then(j=>j.terms&&j.terms.due?fetch('../api/rounds.php?action=termsaccept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({terms:j.terms.terms,agreement:j.terms.agreement||''})}):null)`);
    await send('Page.navigate', { url: I.ORIGIN + '/summit-de59ae83/' }); await sleep(1800);
  };
  for (const [nm, w, h, mobile, no] of [['computer', 1400, 1000, false, '1844'], ['phone', 390, 844, true, '1852']]) {
    console.log('\nThe page, measure only, on a ' + nm);
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
    calls.length = 0; errs.length = 0;
    await signBrowser(YARDS, CODES.measure);
    t(await until(`!!document.getElementById('measureq')`), 'it opens on the measure screen: one address box');
    t(await js(`document.body.textContent.indexOf('Save a lawn measure') >= 0`), 'with the four steps on top');
    const rest = await js(`(function(){var v=function(s){var e=document.querySelector(s);return !!(e && !e.hidden && e.offsetParent!==null);};return {dock:v('#dock'),tabs:v('#tabnav'),dnav:v('#dnav'),bell:v('.bellbtn'),avatar:v('.avbtn,.avatar'),help:v('#helpfab'),tiles:document.querySelectorAll('.tile,.tgrid button').length};})()`);
    t(rest && !rest.dock && !rest.tabs && !rest.dnav && !rest.bell && !rest.help && !rest.tiles, 'none of the rest of the app: no dock, menu, top bar, alerts bell, help chat or tiles ' + JSON.stringify(rest));
    await type(`document.getElementById('measureq')`, no + ' ponderosa');
    t(await until(btn('/' + no + ' PONDEROSA DR/')), 'typing the address lists the house');
    t(await js(`!document.querySelector('.sres .lchip,.sres .chip')`), 'with no lawn figure beside it');
    await click(btn('/' + no + ' PONDEROSA DR/'));
    t(await until(btn('/^Save my measure$/')), 'opening it shows the measure box, already open, with Save my measure');
    t(await js(`document.querySelector('.mcard').textContent.indexOf('JANE OWNER') < 0 && document.querySelector('.mcard').textContent.indexOf('2,800') < 0 && document.querySelector('.mcard').textContent.indexOf('2800') < 0`), 'the card shows no owner and none of our lawn figure (2,800)');
    t(await js(`/39\\.600\\d+, -104\\.950\\d+/.test(document.querySelector('.mpoint').textContent)`), 'it gives the point for Google Earth\u2019s search box');
    await shot(nm + '-house.png');
    await type(`document.querySelector('.handrow input')`, nm === 'computer' ? '2650' : '2700');
    await click(btn('/^Grass only$/'));
    await click(btn('/^Save my measure$/'));
    t(await until(`document.querySelector('.mcard') && /Measured by hand/.test(document.querySelector('.mcard').textContent)`), 'Save my measure saves it and the card says Measured by hand');
    await shot(nm + '-saved.png');
    rows = logRows(YARDS, 'lawnhand-testtown.log').filter((r) => r.id === (no === '1844' ? 'tt-2' : 'tt-4'));
    t(rows.length && rows[rows.length - 1].sq === (nm === 'computer' ? 2650 : 2700) && rows[rows.length - 1].by === 'Claire Measure', 'the row is in the log under her name');
    const extra = [...new Set(calls)].filter((a) => !['me', 'signin', 'signout', 'termsaccept', 'search', 'a365house', 'parcelat', 'lawnhand', 'company', 'pushkey', 'kitbrand', 'logo'].includes(a));
    t(!extra.length, 'the page asked the server only for what the role may use' + (extra.length ? ': also ' + extra.join(', ') : ''));
    t(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await click(btn('/^Sign out$/'));
    t(await until(`!!document.querySelector('.signin, .pad, .boxes')`), 'Sign out goes to the sign-in screen');
  }
} catch (e) { console.log('ERROR', e && e.stack || e); fail++; }
finally {
  try { chrome && chrome.kill(); } catch {}
  for (const p of procs) try { p.kill(); } catch {}
  await sleep(600);
  if (prof) for (let i = 0; i < 50; i++) { try { rmSync(prof, { recursive: true, force: true }); break; } catch { await sleep(200); } }
  console.log('\nScreenshots: ' + TMP);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
