/* Lead fixes, 12 Nov 2026 (Matthew): (1) a lead's address finds its house: "665, Ash St, Broomfield CO 80020" (Doug Farnham) and
   "12524 LAKE VIEW ST" against a rural list's "12524 LAKE VIEW ST FIRESTONE" (Keith Heavilin); (2) "Don't email" on lead and customer cards;
   (3) the Pipeline on a computer: the first click on a card's action counts, and after an action that moves the lead to another section the
   same lead stays open there. A throwaway Sixfold install from the source (traverse/app) on PHP's test server in a fresh temp folder, a hand-made
   search index, throwaway codes; headless Chrome with real mouse events. Run once per run (fresh data every time):
     node traverse/app/review-leadfix-1112/tests/leadfix-test.mjs */
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
const ONLY = process.argv[2] || '';   /* 'match', 'nomail', 'pipe' to run one part */
const TMP = mkdtempSync(join(tmpdir(), 'leadfix-')), PORT = 8881, ORIGIN = 'http://127.0.0.1:' + PORT, API = ORIGIN + '/api/rounds.php';
const CODES = { admin: '583931', office: '583932', crew: '583933', super: '583934' };
const WWW = join(TMP, 'www'), DATA = join(TMP, 'sixfold-data', 'rounds'), PRIV = join(TMP, 'sixfold-private');
mkdirSync(join(WWW, 'api'), { recursive: true }); mkdirSync(DATA, { recursive: true }); mkdirSync(PRIV, { recursive: true });
for (const f of readdirSync(join(APP, 'api'))) if (f.endsWith('.php')) cpSync(join(APP, 'api', f), join(WWW, 'api', f));
cpSync(join(APP, 'summit-de59ae83'), join(WWW, 'summit-de59ae83'), { recursive: true });
if (process.env.LEADFIX_PAGE) cpSync(process.env.LEADFIX_PAGE, join(WWW, 'summit-de59ae83', 'index.html'));   /* a baseline run on an older page (the server stays this copy's) */
{ const pg = join(WWW, 'summit-de59ae83', 'index.html'); writeFileSync(pg, readFileSync(pg, 'utf8').replace('  function customerView(id, back, backLabel) {', '  window.__cv = function (id) { return customerView(id); };\n  function customerView(id, back, backLabel) {')); }   /* a test door: the customer card straight from the test (this copy only) */
writeFileSync(join(DATA, 'company.json'), JSON.stringify({ name: 'Test Sixfold', short: 'Test', phone: '(555) 010-0100', features: { walkdesk: true, crew: true }, a365: { name: '365 Test Aeration', phone: '(555) 010-0199', base: [39.65, -104.99], radius: 45 } }, null, 2));
writeFileSync(join(DATA, 'index.json'), '{"regions":[]}');
/* the search index: region, town, area, door id, ADDRESS, fire, lawn lv, lawn yr, trees, L, occ */
const row = (reg, town, id, addr, L = '') => [reg, town, 'Area', id, addr, 0, '', '', '', L, ''].join('\t');
writeFileSync(join(DATA, 'search-index.txt'), [
  row('broomfield', 'Broomfield', '665-ash-st', '665 ASH ST'),
  row('denver', 'Denver', '665-ash-st-den', '665 ASH ST'),                            /* the same street address in another town */
  row('g1-johnstown-milliken-rural', 'Johnstown Milliken rural', '12524-lake-view-st-firestone', '12524 LAKE VIEW ST FIRESTONE'),
  row('g1-other-rural', 'Other rural', '12524-oak-ln-mead', '12524 OAK LN MEAD'),
  row('g1-other-rural', 'Other rural', '12524-oak-ln-erie', '12524 OAK LN ERIE'),       /* two rural rows: never guess */
  row('englewood', 'Englewood', '4990-s-inca-dr', '4990 S INCA DR'),
  row('englewood', 'Englewood', '11663-settlers-dr', '11663 SETTLERS DR'),
  row('englewood', 'Englewood', '300-main-st', '300 MAIN ST'),
  row('englewood', 'Englewood', '301-main', '301 MAIN'),
  row('littleton', 'Littleton', '77-elm-st', '77 ELM ST'), row('aurora', 'Aurora', '77-elm-st-a', '77 ELM ST'),
].join('\n') + '\n');
const people = { [CODES.admin]: ['Pat Admin', 'admin'], [CODES.office]: ['Jen Office', 'office'], [CODES.crew]: ['Brad Crew', 'crew'], [CODES.super]: ['Matt Super', 'super'] };
writeFileSync(join(PRIV, 'rounds-codes.php'), "<?php\nreturn ['session_key' => '" + randomBytes(32).toString('hex') + "', 'session_days' => 45, 'people' => " + JSON.stringify(people).replace(/\{/g, '[').replace(/\}/g, ']').replace(/":/g, '" =>') + "];\n");
const srv = spawn('php', ['-d', 'memory_limit=768M', '-S', '127.0.0.1:' + PORT, '-t', WWW], { stdio: 'ignore' });
const jars = {};
function req(url, { method = 'GET', body = null, cookie = '' } = {}) {
  return new Promise((res) => {
    const data = body == null ? null : JSON.stringify(body);
    const r = http.request(url, { method, headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...(cookie ? { Cookie: cookie } : {}) } }, (x) => {
      let s = ''; x.setEncoding('utf8'); x.on('data', (d) => (s += d)); x.on('end', () => { let j = {}; try { j = JSON.parse(s); } catch { j = { raw: s.slice(0, 300) }; } j._status = x.statusCode; j._cookies = x.headers['set-cookie'] || []; res(j); });
    });
    r.on('error', (e) => res({ _status: 0, error: String(e) })); if (data) r.write(data); r.end();
  });
}
async function call(who, action, body, q = '') {
  const j = await req(API + '?action=' + action + q, { method: body ? 'POST' : 'GET', body, cookie: jars[who] || '' });
  if (j._cookies.length) { const jar = Object.fromEntries((jars[who] || '').split('; ').filter(Boolean).map((c) => c.split('='))); for (const c of j._cookies) { const [k, v] = c.split(';')[0].split('='); jar[k] = v; } jars[who] = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '); }
  return j;
}
async function signin(who, dev = 'c') { const s = await call(who, 'signin', { code: CODES[who], dev }); if (s.terms && s.terms.due) await call(who, 'termsaccept', { terms: s.terms.terms, agreement: s.terms.agreement || '' }); return s; }
const leadOf = async (id) => ((await call('admin', 'leads')).leads || []).find((l) => l.id === id);
let n = 0; const phone = () => '30355501' + String(10 + (n++ % 89));
async function addLead(name, town, extra = {}) { return call('admin', 'leadadd', { name, phone: phone(), email: name.split(' ')[0].toLowerCase() + n + '@example.com', town, need: 'A quote', src: 'phone', ...extra }); }
let chrome, prof;
try {
  for (let i = 0; i < 60; i++) { if ((await req(API + '?action=kitbrand'))._status) break; await sleep(150); }
  for (const w of ['admin', 'office']) t((await signin(w)).ok, w + ' signs in');

  if (!ONLY || ONLY === 'match') {
    console.log('\nThe address matcher (leads added with an address)');
    const cases = [
      ['Doug Farnham', '665, Ash St, Broomfield CO 80020', 'broomfield/665-ash-st', 'house number before a comma, then the street (Doug)'],
      ['Keith Heavilin', '12524 LAKE VIEW ST', 'g1-johnstown-milliken-rural/12524-lake-view-st-firestone', 'a rural list\u2019s address with the town on the end (Keith)'],
      ['Kim Kittown', '12524 Lake View Street, Firestone', 'g1-johnstown-milliken-rural/12524-lake-view-st-firestone', 'the same with Street spelled out and the town given'],
      ['Ann Exact', '4990 S Inca Dr, Englewood', 'englewood/4990-s-inca-dr', 'exact, with the direction (unchanged)'],
      ['Ned Nodir', '11663 N Settlers Dr, Englewood', 'englewood/11663-settlers-dr', 'a direction the list leaves out (unchanged)'],
      ['Zed Zip', '300 Main St Englewood CO 80110', 'englewood/300-main-st', 'the town, state and zip on the end with no commas'],
      ['Bea Broom', '665 Ash St Broomfield CO 80020', 'broomfield/665-ash-st', 'two 665 ASH STs: the town on the end picks one'],
      ['Tie Town', '665 Ash St, Denver', 'denver/665-ash-st-den', 'two 665 ASH STs: the town given picks one (unchanged)'],
      ['Amy Ambig', '665 Ash St', null, 'two 665 ASH STs and no town: nothing (never a guess)'],
      ['Ola Oak', '12524 Oak Ln', null, 'two rural 12524 OAK LN rows: nothing'],
      ['Mo Mead', '12524 Oak Ln, Mead', 'g1-other-rural/12524-oak-ln-mead', 'two rural rows, the town given matches one\u2019s tacked-on town'],
      ['Sam Short', '665 Ash, Broomfield', null, 'no street type ("665 Ash"): not stretched to 665 ASH ST'],
      ['Ian Inner', '301 Main St, Englewood', null, 'a list address without a type ("301 MAIN") is not taken for 301 MAIN ST'],
      ['Eli Elm', '77 Elm St', null, 'two 77 ELM ST, no town: nothing (unchanged)'],
      ['Nina None', '999 Nowhere Rd, Englewood', null, 'not on the lists: nothing'],
    ];
    for (const [nm, town, want, label] of cases) {
      const r = await addLead(nm, town); const l = r.ok ? await leadOf(r.id) : null;
      const got = l && l.house && l.house.region ? l.house.region + '/' + l.house.door : null;
      t(r.ok && got === want, label + ': ' + JSON.stringify(town) + ' -> ' + (got || 'no house'));
    }
    const pp = await call('admin', 'proppull', { address: '665, Ash St, Broomfield' });
    t(pp.ok && pp.had && pp.house && pp.house.id === '665-ash-st' && pp.house.region === 'broomfield', 'Pull this property with "665, Ash St, Broomfield" finds it on the lists');
  }

  if (!ONLY || ONLY === 'nomail') {
    console.log('\nDon\u2019t email');
    const r = await addLead('Dina Donot', 'Englewood'); const L = await leadOf(r.id); const em = L.email;
    let s = await call('office', 'nomailset', { email: em.toUpperCase(), on: 1 });
    t(s.ok && s.entry && /^office: Jen Office$/.test(s.entry.how), 'the office marks it: how "office: Jen Office"');
    let u = JSON.parse(readFileSync(join(DATA, 'newsletter-unsub.json'), 'utf8'));
    t(u[em] && u[em].how === 'office: Jen Office' && u[em].at > 0 && Object.keys(u[em]).sort().join() === 'at,how', 'newsletter-unsub.json has it, same shape as the unsubscribe link writes (at, how), lowercased');
    let lst = await call('office', 'nomail'); t(lst.ok && lst.list[em] && lst.list[em].how === 'office: Jen Office', 'the list the cards read shows it');
    s = await call('office', 'nomailset', { email: em, on: 1 }); u = JSON.parse(readFileSync(join(DATA, 'newsletter-unsub.json'), 'utf8'));
    t(s.ok && Object.keys(u).length === 1, 'marking twice keeps one entry');
    s = await call('office', 'nomailset', { email: em, on: 0 }); u = JSON.parse(readFileSync(join(DATA, 'newsletter-unsub.json'), 'utf8'));
    t(s.ok && s.entry === null && !u[em], 'the office takes its own mark off');
    /* someone who unsubscribed themselves: only an admin brings them back */
    if (Array.isArray(u)) u = {};   /* PHP writes an empty list as [] */
    u['self@example.com'] = { at: 1700000000, how: 'link' }; writeFileSync(join(DATA, 'newsletter-unsub.json'), JSON.stringify(u));
    s = await call('office', 'nomailset', { email: 'self@example.com', on: 0 });
    t(!s.ok && s._status === 403 && /only an admin/.test(s.error || ''), 'the office cannot add back someone who unsubscribed themselves' + (s.ok ? '' : ' (' + s._status + ': ' + (s.error || '') + ')') + (s.ok ? ' GOT ok ' + JSON.stringify(s.entry) : ''));
    s = await call('admin', 'nomailset', { email: 'self@example.com', on: 0 });
    t(s.ok && !JSON.parse(readFileSync(join(DATA, 'newsletter-unsub.json'), 'utf8'))['self@example.com'], 'an admin can');
    await signin('crew');
    s = await call('crew', 'nomailset', { email: em, on: 1 }); t(!s.ok && s._status === 403, 'a crew account cannot (403)');
    s = await call('office', 'nomailset', { email: 'not-an-email', on: 1 }); t(!s.ok, 'a bad address is refused');
  }

  if (!ONLY || ONLY === 'nomail' || ONLY === 'pipe') {
    /* ---------------- the browser ---------------- */
    const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe', CP = 9493; prof = mkdtempSync(join(tmpdir(), 'cdp-leadfix-'));
    chrome = spawn(CH, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${CP}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
    let tg; for (let k = 0; k < 60 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${CP}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
    const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((x) => (ws.onopen = x));
    let cid = 0; const pend = new Map(), errs = [];
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result || {}); pend.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }); };
    const send = (m, p = {}) => new Promise((x) => { const i = ++cid; pend.set(i, x); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, userGesture: true })).result?.value;
    const until = async (e, ms = 15000) => { for (let x = 0; x < ms; x += 150) { if (await js(e)) return true; await sleep(150); } return false; };
    const shot = async (nm) => writeFileSync(join(TMP, nm), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    /* a real click: the mouse moves there, presses, releases (as a person's does), at the middle of what the selector finds */
    const click = async (sel, gap = 40) => {
      const r = await js(`(function(){var e=${sel};if(!e)return null;e.scrollIntoView({block:'center'});var b=e.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2];})()`);
      if (!r) return false; await sleep(120);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r[0], y: r[1] }); await sleep(60);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r[0], y: r[1], button: 'left', clickCount: 1 }); await sleep(gap);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r[0], y: r[1], button: 'left', clickCount: 1 });
      return true;
    };
    await send('Runtime.enable'); await send('Page.enable');
    const size = async (w, h, mobile) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
    const signBrowser = async (code) => {
      await send('Network.enable'); await send('Network.clearBrowserCookies');
      await send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/' }); await sleep(800);
      await js(`fetch('../api/rounds.php?action=signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'${code}',dev:'p'})}).then(r=>r.json()).then(j=>j.terms&&j.terms.due?fetch('../api/rounds.php?action=termsaccept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({terms:j.terms.terms,agreement:j.terms.agreement||''})}):null)`);
      await send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/' }); await sleep(1500);
    };
    const openPipe = async () => { await js(`(function(){var b=[...document.querySelectorAll('button,a')].find(x=>/^Pipeline$/.test((x.textContent||'').trim()));if(b)b.click();})()`); return until(`!!document.querySelector('.pipeseg button[data-st]')`, 20000); };
    const stageBtn = (st) => `document.querySelector('.pipeseg button[data-st="${st}"]')`;
    const cardBtn = (txt) => `[...document.querySelectorAll('${'${SCOPE}'} .ltrybtns button')].find(b=>b.textContent==='${txt}')`;

    if (!ONLY || ONLY === 'nomail') {
      console.log('\nDon\u2019t email on the lead card');
      const r = await addLead('Carl Cardtest', 'Englewood');
      const L = await leadOf(r.id); const cu = await call('admin', 'customersave', { name: 'Carl Cardtest', email: L.email, phone: L.phone, addr: '1 Test St', town: 'Englewood' });
      const cid2 = cu.id || (cu.customer && cu.customer.id) || (((await call('admin', 'customers')).customers || []).find((c) => c.email === L.email) || {}).id;
      t(cu.ok && !!cid2, 'a customer with the same email ' + (cu.ok ? '' : cu.error));
      await size(1400, 900, false); await signBrowser(CODES.admin);
      t(await openPipe(), 'the Pipeline opens');
      await click(stageBtn('call')); await until(`!!document.querySelector('.p2row')`);
      await js(`[...document.querySelectorAll('.p2row')].find(b=>/Carl Cardtest/.test(b.textContent)).click()`);
      t(await until(`!!document.querySelector('.p2det .nomail button')`), 'the lead card shows a "Don\u2019t email" button');
      await click(`[...document.querySelectorAll('.p2det .nomail button')].find(b=>/email/.test(b.textContent))`);
      t(await until(`/Not emailed/.test((document.querySelector('.p2det .nomail')||{}).textContent||'') && /Marked by Pat Admin/.test(document.querySelector('.p2det .nomail').textContent)`), 'after tapping it: "Not emailed", marked by Pat Admin');
      await shot('nomail-lead.png');
      await click(`[...document.querySelectorAll('.p2det .nomail button')].find(b=>/Email them again/.test(b.textContent))`);
      t(await until(`/Don.t email/.test((document.querySelector('.p2det .nomail')||{}).textContent||'')`), 'Email them again takes it off');
      await call('office', 'nomailset', { email: L.email, on: 1 });   /* the office marks it (the admin helper’s code is the browser’s now) */
      await js(`window.__cv('${cid2}')`);
      t(await until(`/Not emailed/.test((document.querySelector('.nomail')||{}).textContent||'') && /Marked by Jen Office/.test(document.querySelector('.nomail').textContent)`), 'the customer card shows "Not emailed" for the same address');
      await shot('nomail-customer.png');
    }

    if (!ONLY || ONLY === 'pipe') {
      /* office and admin on a computer, the office on a phone; the admin and phone runs with a network delay (the reloads then land while the
         next tap is on its way, as on the live server) and a human-speed click (press and release 150 ms apart) */
      for (const [who, wide, slow] of [['office', true, false], ['admin', true, true], ['office', false, true]]) {
        console.log('\nThe Pipeline, ' + who + ', ' + (wide ? 'computer (1400 px)' : 'phone (420 px)') + (slow ? ', 300 ms network delay' : ''));
        const nm = 'Pia ' + (who === 'office' ? 'Office' : 'Admin') + (wide ? 'wide' : 'phone');
        await signin('admin');   /* the browser’s sign-in with the same code signs the helper out */
        const tag = (who === 'office' ? 'O' : 'A') + (wide ? 'w' : 'p');
        const ad = [await addLead('Quinn Before' + tag, 'Englewood'), await addLead(nm, 'Englewood'), await addLead('Rae After' + tag, 'Englewood')];
        t(ad.every((x) => x.ok), 'three leads added' + (ad.every((x) => x.ok) ? '' : ': ' + ad.map((x) => x.error || x.why || 'ok').join(' / ')));
        await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
        await size(wide ? 1400 : 420, 900, !wide); await signBrowser(CODES[who]);
        if (slow) await send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: -1, uploadThroughput: -1 });
        t(await openPipe(), 'the Pipeline opens');
        await click(stageBtn('call'));
        if (wide) { await until(`!!document.querySelector('.p2row')`); await click(`[...document.querySelectorAll('.p2row')].find(b=>b.querySelector('b').textContent==='${nm}')`); await until(`(document.querySelector('.p2det .lhead .addr')||{}).textContent==='${nm}'`); }
        const cardSel = wide ? `document.querySelector('.p2det .door.lead')` : `[...document.querySelectorAll('.door.lead[data-id]')].find(c=>(c.querySelector('.lhead .addr')||{}).textContent==='${nm}')`;
        const inCard = (txt) => `(function(){var c=${cardSel};return c?[...c.querySelectorAll('.ltrybtns button')].find(b=>b.textContent==='${txt}'):null;})()`;
        const pressed = (txt) => js(`(function(){var b=${inCard(txt)};return !!b&&b.getAttribute('aria-pressed')==='true';})()`);
        if (process.env.LEADFIX_DEBUG) { await sleep(1500); console.log('    cards', await js(`[...document.querySelectorAll('.door.lead[data-id]')].map(c=>(c.querySelector('.lhead .addr')||{}).textContent+'('+c.querySelectorAll('.ltrybtns button').length+')').join(', ')`)); }
        t(await until(`!!${inCard('Texted them')}`), 'the card shows the call-try buttons');
        if (process.env.LEADFIX_DEBUG) { const pos = []; for (let i = 0; i < 16; i++) { pos.push(await js(`(function(){var b=${inCard('Texted them')};if(!b)return '-';var r=b.getBoundingClientRect();return Math.round(r.left)+','+Math.round(r.top)+'/'+Math.round(scrollY);})()`)); await sleep(150); } console.log('    pos', pos.join(' ')); }
        if (process.env.LEADFIX_DEBUG) { await js(`(function(){var c=${cardSel};if(c)c.__mark=1;})()`); }
        if (process.env.LEADFIX_DEBUG) await js(`(function(){window.__ev=[];['pointerdown','mousedown','mouseup','click'].forEach(function(t){document.addEventListener(t,function(e){window.__ev.push(t+':'+(e.target.tagName||'')+':'+((e.target.textContent||'').slice(0,14)))},true);});})()`);
        if (process.env.LEADFIX_DEBUG) console.log('    under', await js(`(function(){var b=${inCard('Texted them')};if(!b)return 'no button';b.scrollIntoView({block:'center'});var r=b.getBoundingClientRect();var e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return (e===b?'the button':(e?e.tagName+'.'+e.className+' '+(e.textContent||'').slice(0,40):'nothing'))+' at '+Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height)+' disabled='+b.disabled})()`));
        await click(inCard('Texted them'), 150);
        if (process.env.LEADFIX_DEBUG) { const seq = []; for (let i = 0; i < 10; i++) { seq.push(await js(`(function(){var c=${cardSel};var b=${inCard('Texted them')};return (c&&c.__mark?'same':'new')+':'+(b?b.getAttribute('aria-pressed'):'none')+':'+((document.querySelector('.pipeseg button[aria-pressed="true"]')||{}).textContent||'')})()`)); await sleep(250); } console.log('    debug', seq.join(' ')); console.log('    events', await js('JSON.stringify(window.__ev)')); }
        await sleep(slow ? 2500 : 300);
        t(await pressed('Texted them'), 'ONE click on "Texted them" ticks it, and it stays ticked after the loads land');
        const saveSel = `(function(){var c=${cardSel};return c?[...c.querySelectorAll('.ltrysave button.save')].find(b=>!b.closest('[hidden]')):null;})()`;
        t(await until(`!!${saveSel}`, 3000), 'and Save shows');
        await click(saveSel, 150);
        await until(`/Texted them/.test((document.getElementById('toast')||{}).textContent||'')`, 8000);
        /* the next tap at once, while the reload is still landing (a computer: the card stays put; a phone scrolls to the followed card, so it waits for that) */
        if (!wide) await sleep(2500);
        await until(`!!${inCard('Left voicemail')}`, 8000);
        if (process.env.LEADFIX_DEBUG) await js(`window.__ev=[]`);
        await click(inCard('Left voicemail'), 150);
        if (process.env.LEADFIX_DEBUG) { await sleep(300); console.log('    lv events', await js('JSON.stringify(window.__ev)'), await js(`(function(){var t=document.getElementById('toast');if(!t||t.hidden)return 'no toast';var r=t.getBoundingClientRect();return 'toast '+Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height);})()`)); }
        await sleep(slow ? 4000 : 1500);
        const stNow = await js(`(function(){var b=document.querySelector('.pipeseg button[aria-pressed="true"]');return b?b.getAttribute('data-st'):null;})()`);
        t(stNow === 'text', 'after Save the Pipeline follows the lead to Texted (on: ' + stNow + ')');
        if (wide) { const open = await js(`(document.querySelector('.p2det .lhead .addr')||{}).textContent+' | '+((document.querySelector('.p2row.on b')||{}).textContent||'')`); t(open === nm + ' | ' + nm, 'and the same lead is still open (' + open + ')'); }
        else t(await js(`(function(){var c=${cardSel};if(!c)return false;var b=c.getBoundingClientRect();return b.bottom>0&&b.top<innerHeight;})()`), 'and the same lead\u2019s card is on screen');
        t(await pressed('Left voicemail'), 'the tap made right after Save (while it reloaded) counted: Left voicemail is ticked');
        await shot('pipe-' + who + '-' + (wide ? 'wide' : 'phone') + '.png');
        /* a stage picked by hand is never overridden */
        await click(stageBtn('call')); await sleep(slow ? 2500 : 800);
        t(await js(`(document.querySelector('.pipeseg button[aria-pressed="true"]')||{getAttribute:()=>''}).getAttribute('data-st')==='call'`), 'picking another stage by hand still works');
      }
      await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    }
    t(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' / ') : ''));
  }
} catch (e) { t(false, 'test crashed: ' + (e.stack || e)); }
finally {
  try { srv.kill(); } catch {} if (chrome) try { chrome.kill(); } catch {}
  await sleep(500); if (prof) for (let i = 0; i < 50; i++) { try { rmSync(prof, { recursive: true, force: true }); break; } catch { await sleep(100); } }
  console.log(`\n${pass} passed, ${fail} failed  (screens and data in ${TMP})`);
  process.exit(fail ? 1 : 0);
}
