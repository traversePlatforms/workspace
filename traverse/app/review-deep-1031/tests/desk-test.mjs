/* Traverse Prospect Desk (2026-10-26), harness only: php -S with DESK_DATA (a throwaway data folder) and DESK_MAIL_MOCK (messages go
   to a file; nothing is ever sent). API, the send queue from the command line, then the page in headless Chrome at desktop and phone width. */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const HERE = 'C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/pdtest-deep';
const SRC = 'C:/Users/Surge Inc/Desktop/claude test 2/.claude/worktrees/agent-ad69e4f291364bf2e/traverse/prospect-desk';
const WWW = join(HERE, 'www'), APP = join(WWW, 'prospects-test'), DATA = join(HERE, 'data'), MOCK = join(HERE, 'mail-mock.jsonl');
const PORT = 8817, BASE = `http://127.0.0.1:${PORT}/prospects-test/api/desk.php`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  ok   ' : '  FAIL ') + m); ok ? pass++ : fail++; };
rmSync(WWW, { recursive: true, force: true }); rmSync(DATA, { recursive: true, force: true }); rmSync(MOCK, { force: true });
mkdirSync(WWW, { recursive: true }); cpSync(join(SRC, 'app'), APP, { recursive: true }); mkdirSync(DATA, { recursive: true });
/* the real seed, with one company's email marked as unable to take mail */
const seed = JSON.parse(readFileSync('C:/Users/Surge Inc/Desktop/claude test 2/traverse/prospect-desk/desk-data-local/seed.json', 'utf8'));
const withMail = seed.leads.filter((l) => l.email);
const badMail = withMail[5]; badMail.emailOk = 'no';
writeFileSync(join(DATA, 'seed.json'), JSON.stringify(seed));
const env = { ...process.env, DESK_DATA: DATA, DESK_MAIL_MOCK: MOCK };
const php = (args, extra = {}) => execFileSync('php', [join(APP, 'api', 'desk.php'), ...args], { env: { ...env, ...extra }, encoding: 'utf8' });
const code = (php(['addaccount', 'Test Matthew', 'admin']).match(/: (\d{6})/) || [])[1];
const srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', WWW], { env, stdio: 'ignore' });
for (let k = 0; k < 40; k++) { try { await (await fetch(BASE + '?action=me')).text(); break; } catch { await sleep(150); } }
let ck = '';
/* node:http, not fetch: Node 24's fetch trips (undici assert) on a big reply from php -S, which always closes the connection */
const http = await import('node:http');
function call(action, body, q = '') {
  return new Promise((res) => {
    const data = body ? JSON.stringify(body) : null;
    const rq = http.request(`${BASE}?action=${action}${q}`, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json', 'X-Desk': '1', 'Content-Length': Buffer.byteLength(data) } : {}), ...(ck ? { Cookie: ck } : {}) } }, (r) => {
      const sc = r.headers['set-cookie']; if (sc) ck = String(sc[0]).split(';')[0];
      let s = ''; r.setEncoding('utf8'); r.on('data', (d) => (s += d)); r.on('end', () => { let j = {}; try { j = JSON.parse(s); } catch {} j._status = r.statusCode; res(j); });
    });
    rq.on('error', () => res({ _status: 0 })); if (data) rq.write(data); rq.end();
  });
}
let chrome, prof;
try {
  /* ---- API ---- */
  t((await call('data'))._status === 401, 'signed out: the data is refused (401)');
  t((await call('signin', { code: '000000' }))._status === 401, 'a wrong code is refused');
  t((await call('signin', { code }))?.ok, 'sign in with the code');
  let D = await call('data');
  t(D.ok && D.leads.length === seed.leads.length, `all ${seed.leads.length} companies load`);
  const L0 = D.leads.find((l) => l.email && l.id !== badMail.id && l.where === 'in our towns');
  t(D.leads.find((l) => l.id === badMail.id).nomail === 'email address cannot take mail', 'an email that cannot take mail is marked so');
  await call('status', { id: L0.id, status: 'no' }); D = await call('data');
  t(D.leads.find((l) => l.id === L0.id).status === 'no', 'knock off: status No');
  await call('status', { id: L0.id, status: 'new' }); D = await call('data');
  t(D.leads.find((l) => l.id === L0.id).status === 'new', 'undo: back to Not contacted');
  await call('note', { id: L0.id, note: 'Talked to the office manager' }); D = await call('data');
  const nk = D.leads.find((l) => l.id === L0.id).notes[0]?.k;
  t(!!nk, 'a note is saved');
  await call('notedel', { id: L0.id, nk }); D = await call('data');
  t(!D.leads.find((l) => l.id === L0.id).notes.length, 'the note is removed');
  t((await call('edit', { id: L0.id, phone: '12' }))._status === 400, 'a bad phone number is refused');
  await call('edit', { id: L0.id, person: 'Dana Smith', phone: '720 555 0101' }); D = await call('data');
  t(D.leads.find((l) => l.id === L0.id).person === 'Dana Smith' && D.leads.find((l) => l.id === L0.id).phone === '(720) 555-0101', 'contact person and phone saved, phone tidied');
  const add = await call('lead', { name: 'Zz Test Roofing Co', trade: 'roofing', city: 'Englewood', where: 'in our towns', email: 'owner@zztestroofing.com' });
  t(add.ok, 'a company added by hand');
  t((await call('lead', { name: 'Zz Test Roofing Co', trade: 'roofing', city: 'Englewood' }))._status === 400, 'the same company twice is refused');
  /* templates and the preview */
  await call('template', { trade: 'roofing', subject: 'Hi from Traverse, {company}', body: 'Hi {first},\n\nA note for {company} in {city}.' });
  const pv = await call('preview', { ids: [add.id, L0.id, badMail.id], tpl: 'roofing' });
  const mAdd = pv.messages?.find((m) => m.id === add.id), mL0 = pv.messages?.find((m) => m.id === L0.id);
  t(pv.ok && pv.messages.length === 2 && pv.skipped['email address cannot take mail'] === 1, 'preview: 2 messages, the bad address left out');
  t(mAdd && mAdd.subject === 'Hi from Traverse, Zz Test Roofing' && /Hi there,/.test(mAdd.body) && /in Englewood\./.test(mAdd.body), 'merge fields: {company} (legal suffix off), {city}, {first} = there');
  t(mL0 && /^Hi Dana,/.test(mL0.body), '{first} = the contact\u2019s first name');
  t(mAdd && /unsubscribe|rather not get emails/i.test(mAdd.body) && /action=unsub&id=/.test(mAdd.body), 'every message ends with an unsubscribe link');
  /* a placeholder the editor let through is refused before anything is queued (review 2026-10-31) */
  await call('template', { trade: 'roofing', subject: 'Hi {Company}', body: 'Hi {first},\n\nA note for {company} in {city}.' });
  await call('settings', { address: '1 Test Way, Englewood, CO 80110' });
  const qph = await call('queue', { ids: [add.id], tpl: 'roofing' });
  t(qph._status === 400 && /\{Company\}/.test(qph.error || ''), 'a leftover {Company} refuses Queue: ' + (qph.error || '').slice(0, 60));
  await call('template', { trade: 'roofing', subject: 'Hi from Traverse, {company}', body: 'Hi {first},\n\nA note for {company} in {city}.' });
  const pvp = await call('preview', { ids: [badMail.id === L0.id ? add.id : L0.id], tpl: 'pest', style: 'phone' });
  t(pvp.ok && pvp.messages.length === 1 && pvp.messages[0].style === 'plain' && /no app picture/.test(pvp.messages[0].nomap || ''), 'App: phone for a pest template goes plain (no roofing picture): ' + (pvp.messages[0] && pvp.messages[0].nomap));
  await call('settings', { address: '' });
  const q0 = await call('queue', { ids: [add.id, L0.id], tpl: 'roofing' });
  t(q0._status === 400 && /postal address/i.test(q0.error || ''), 'no postal address: queueing refused (' + (q0.error || '').slice(0, 40) + '...)');
  t(!existsSync(join(DATA, 'queue.json')) || JSON.parse(readFileSync(join(DATA, 'queue.json'), 'utf8')).length === 0, 'and nothing is waiting');
  /* the page, before an address is set */
  const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe', CP = 9481; prof = mkdtempSync(join(tmpdir(), 'pd-'));
  chrome = spawn(CH, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${CP}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
  let tg; for (let k = 0; k < 60 && !tg; k++) { try { tg = (await (await fetch(`http://127.0.0.1:${CP}/json/list`)).json()).find((x) => x.type === 'page'); } catch {} if (!tg) await sleep(200); }
  const ws = new WebSocket(tg.webSocketDebuggerUrl); await new Promise((x) => (ws.onopen = x));
  let cid = 0; const pend = new Map(), errs = [];
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result || {}); pend.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
  const send = (m, p = {}) => new Promise((x) => { const i = ++cid; pend.set(i, x); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const js = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, userGesture: true })).result?.value;
  const until = async (e, ms = 15000) => { for (let x = 0; x < ms; x += 150) { if (await js(e)) return true; await sleep(150); } throw new Error('timeout: ' + e.slice(0, 80)); };
  const shot = async (n) => writeFileSync(join(HERE, n), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/prospects-test/` });
  await until(`!!document.querySelector('.signin input')`);
  t(true, 'the sign-in screen shows');
  await js(`(function(){var i=document.querySelector('.signin input');i.value='${code}';document.querySelector('.signin').dispatchEvent(new Event('submit',{cancelable:true}));})()`);
  await until(`!!document.querySelector('.row')`, 20000);
  const firstTxt = await js(`document.querySelector('.row').innerText`);
  const listN = await js(`document.querySelectorAll('.row').length`);
  t(listN === 150 && /Show more/.test(await js(`document.querySelector('.more')?.innerText||''`)), 'Prospects: the first 150 shown, Show more for the rest');
  t(await js(`[...document.querySelectorAll('.chips')].find(function(c){return /Reach/i.test((c.querySelector('.chiplab')||{}).textContent)}).querySelector('[aria-pressed=true]').textContent.startsWith('Any way in')`), 'default view: only companies with a phone, email or social page');
  t(await js(`(function(){var r=[...document.querySelectorAll('.row small')].slice(0,5).map(x=>x.textContent);return r.every(x=>!/next to our towns|elsewhere/.test(x));})()`), 'our towns first');
  await shot('pd-1-list.png');
  /* filter by trade */
  await js(`[...document.querySelectorAll('.chips')][0].querySelector('[data-k="pest"]').click()`); await sleep(300);
  const pestN = await js(`+([...document.querySelectorAll('.chips')][0].querySelector('[data-k="pest"] b').textContent)`), rowsN = await js(`document.querySelectorAll('.row').length`);
  t(pestN > 0 && rowsN === Math.min(pestN, 150) && await js(`[...document.querySelectorAll('.row .tr')].every(x=>x.textContent==='PEST')`), `trade filter: Pest shows ${rowsN} (count ${pestN}), all pest`);
  await js(`[...document.querySelectorAll('.chips')][0].querySelector('[data-k="all"]').click()`); await sleep(300);
  await js(`(function(){var q=document.querySelector('.search');q.value='Zz Test';q.dispatchEvent(new Event('input'));})()`); await sleep(200);
  t(await js(`document.querySelectorAll('.row').length===1 && /Zz Test Roofing/.test(document.querySelector('.row').innerText)`), 'search finds the added company');
  await js(`document.querySelector('.row').click()`); await until(`!!document.querySelector('.detail')`);
  t(await js(`/Zz Test Roofing Co/.test(document.querySelector('.detail h2').textContent)`), 'tap a company: its details open');
  /* knock off, then Undo from the toast */
  await js(`document.querySelector('.detail [data-st="no"]').click()`); await until(`!document.getElementById('toast').hidden && /knocked off/.test(document.getElementById('toast').innerText)`);
  t(true, 'knock off: the toast says so, with Undo');
  t(await js(`!document.querySelector('.detail') || document.querySelector('.detail [data-st="no"]').getAttribute('aria-pressed')==='true'`), 'the company is marked No');
  await js(`document.querySelector('#toast button').click()`); await sleep(900);
  D = await call('data');
  t(D.leads.find((l) => l.id === add.id).status === 'new', 'Undo puts it back to Not contacted');
  await js(`(function(){var q=document.querySelector('.search');q.value='Zz Test';q.dispatchEvent(new Event('input'));})()`); await sleep(200);
  await js(`document.querySelector('.row').click()`); await until(`!!document.querySelector('.detail textarea')`);
  await js(`(function(){var a=document.querySelector('.detail textarea');a.value='Left a voicemail with the owner';[...document.querySelectorAll('.detail button')].find(b=>b.textContent==='Save note').click();})()`);
  await until(`/Left a voicemail with the owner/.test(document.querySelector('.detail')?.innerText||'')`);
  t(true, 'a note saved from the page shows under Notes');
  await shot('pd-2-detail.png');
  /* the email page with no address: the warning, the preview, Queue off */
  await js(`document.querySelector('[data-tab="email"]').click()`); await until(`document.querySelector('main').dataset.section==='email'`);
  t(await js(`/Sending is off until you add your postal address/.test(document.querySelector('.warnbox')?.innerText||'')`), 'Email: says sending is off until the postal address is added');
  /* device QA D6 (2026-10-27): the Email tab opens with nothing ticked */
  t(await js(`document.querySelectorAll('.pick input:checked').length===0 && /Nothing ticked yet/.test(document.querySelector('main').innerText) && [...document.querySelectorAll('.btn')].find(b=>b.textContent==='Read every message').disabled`), 'Email tab opens with nothing ticked, and Read every message is off');
  await js(`(function(){[...document.querySelectorAll('.chips')][0].querySelector('[data-k="roofing"]').click();})()`); await sleep(300);
  t(await js(`document.querySelectorAll('.pick input:checked').length===0`), 'picking a trade still ticks nobody');
  await js(`[...document.querySelectorAll('.pick input')].slice(0,3).forEach(function(c){c.click()})`); await sleep(200);
  t(await js(`document.querySelectorAll('.pick input:checked').length===3 && /^3 of /.test(document.querySelector('.card p:not(.soft)')?.textContent||[...document.querySelectorAll('.card p')].map(p=>p.textContent).join('|'))`), 'ticking 3 companies counts 3');
  await js(`[...document.querySelectorAll('.btn')].find(b=>b.textContent==='Read every message').click()`);
  await until(`document.querySelectorAll('.msg').length>0`);
  t(await js(`[...document.querySelectorAll('.msg')].every(m=>/^To: \\S+@\\S+$/.test(m.querySelector('.mh').textContent))`), 'each previewed message has one address in To');
  t(await js(`document.querySelector('[data-act="queue"]').disabled===true`), 'Queue is off with no postal address');
  await shot('pd-3-email.png');
  /* phone width: no sideways scroll on any section */
  await send('Emulation.setDeviceMetricsOverride', { width: 400, height: 860, deviceScaleFactor: 2, mobile: true });
  for (const tab of ['list', 'due', 'email', 'settings']) {
    await js(`document.querySelector('[data-tab="${tab}"]').click()`); await sleep(500);
    const sw = await js(`document.documentElement.scrollWidth`), wide = await js(`[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>401&&!e.closest('.chips')).slice(0,2).map(e=>e.className||e.tagName).join(', ')`);
    t(sw <= 400, `phone 400 px, ${tab}: no sideways scroll (${sw}${wide ? '; wide: ' + wide : ''})`);
    if (tab === 'list') { await js(`document.querySelector('.row').click()`); await sleep(500); const sw2 = await js(`document.querySelector('.detail').scrollWidth<=document.querySelector('.detail').clientWidth+1 && document.documentElement.scrollWidth<=400`); t(sw2, 'phone: a company\u2019s details fit'); await shot('pd-4-phone-detail.png'); await js(`document.querySelector('.detail .close').click()`); await sleep(300); }
  }
  await shot('pd-5-phone-settings.png');
  /* set the address from Settings */
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await js(`(function(){var a=document.querySelector('.card textarea');a.value='Traverse Platforms LLC\\nPO Box 100, Denver, CO 80201';document.querySelector('[data-act="savesettings"]').click();})()`); await sleep(900);
  D = await call('data');
  t(/PO Box 100/.test(D.settings.address), 'the postal address is saved from Settings');
  /* device QA D6: "Email these" on a filtered list ticks exactly that filter, and the Queue confirm names count and filter */
  await js(`document.querySelector('[data-tab="list"]').click()`); await sleep(400);
  const listState = await js(`(function(){var q=document.querySelector('.search');var v=q.value;q.value='';q.dispatchEvent(new Event('input'));return v + ' | ' + [...document.querySelectorAll('.chips')].map(function(c){var p=c.querySelector('[aria-pressed=true]');return (c.querySelector('.chiplab')||{}).textContent+':'+(p?p.getAttribute('data-k'):'')}).join(' ')})()`); console.log('    list state before:', listState); await sleep(300);
  await js(`(function(){['Trade','Reach','Stage'].forEach(function(lab){var r=[...document.querySelectorAll('.chips')].find(function(c){return new RegExp(lab,'i').test((c.querySelector('.chiplab')||{}).textContent)});var k={Trade:'all',Reach:'any',Stage:'open'}[lab];var b=r&&r.querySelector('[data-k="'+k+'"]');if(b&&b.getAttribute('aria-pressed')!=='true')b.click();});})()`); await sleep(300);
  await js(`(function(){var r=[...document.querySelectorAll('.chips')].find(function(c){return /Fit/i.test((c.querySelector('.chiplab')||{}).textContent)});var b=r&&r.querySelector('[data-k="A"]');if(b)b.click();})()`); await sleep(300);
  await js(`(function(){var r=[...document.querySelectorAll('.chips')].find(function(c){return /Where/i.test((c.querySelector('.chiplab')||{}).textContent)});r.querySelector('[data-k="in our towns"]').click();})()`); await sleep(300);
  const mailN = await js(`(function(){var b=[...document.querySelectorAll('.btn')].find(function(x){return /^Email these/.test(x.textContent)});return +((b.textContent.match(/\\((\\d+)\\)/)||[])[1]||0)})()`);
  await js(`[...document.querySelectorAll('.btn')].find(function(x){return /^Email these/.test(x.textContent)}).click()`); await until(`document.querySelector('main').dataset.section==='email'`);
  const ticked = await js(`document.querySelectorAll('.pick input:checked').length`);
  t(mailN > 0 && ticked === Math.min(mailN, 200) , `Email these on Fit A + In our towns ticks exactly that list (${ticked} of ${mailN})`);
  await js(`[...document.querySelectorAll('.btn')].find(b=>b.textContent==='Read every message').click()`); await until(`!!document.querySelector('[data-act="queue"]')`);
  const confirmMsg = await js(`(function(){var m='';window.confirm=function(x){m=x;return false};document.querySelector('[data-act="queue"]').click();return m})()`);
  t(new RegExp('^Queue ' + mailN + ' emails? to A-ranked all-trade companies in our towns\\\\?').test(confirmMsg), 'the Queue confirm names the count and the filter (' + confirmMsg.slice(0, 70) + ')');
  t(!(await call('data')).queue.waiting, 'saying No to the confirm queues nothing');
  await js(`document.querySelector('[data-tab="settings"]').click()`); await sleep(400);
  /* the look (2026-10-26): Settings has Auto / Light / Dark, the field app's shared key */
  const bgSum = `(function(){var c=getComputedStyle(document.body).backgroundColor.match(/\\d+/g).map(Number);return c[0]+c[1]+c[2]})()`;
  t(await js(`!!document.querySelector('.look [data-look="dark"]')`), 'Settings shows the Look choice');
  await js(`document.querySelector('[data-look="dark"]').click()`); await sleep(300);
  t(await js(`document.documentElement.getAttribute('data-theme')==='dark' && localStorage.getItem('sixfold.theme')==='dark'`) && (await js(bgSum)) < 120, 'Look: Dark turns the desk dark and saves the shared setting');
  await js(`document.querySelector('[data-tab="list"]').click()`); await sleep(400); await shot('pd-6-dark-list.png');
  t(await js(`(function(){var g=document.querySelector('.grade');if(!g)return true;var c=getComputedStyle(g);return c.color!==c.backgroundColor})()`), 'dark: fit badges still read (text and background differ)');
  await js(`document.querySelector('[data-tab="settings"]').click()`); await sleep(400);
  await js(`document.querySelector('[data-look="auto"]').click()`); await sleep(300);
  t(await js(`!document.documentElement.hasAttribute('data-theme') && localStorage.getItem('sixfold.theme')===null`) && (await js(bgSum)) > 600, 'Look: Auto follows the device again (light here)');
  /* ---- the queue ---- */
  await call('settings', { cap: 2 });
  const L1 = D.leads.filter((l) => !l.nomail && l.id !== add.id && l.id !== L0.id)[0], L2 = D.leads.filter((l) => !l.nomail && l.id !== add.id && l.id !== L0.id)[1];
  await call('unsubmark', { id: L2.id });
  const q1 = await call('queue', { ids: [add.id, L0.id, L1.id, L2.id, badMail.id], tpl: 'auto' });
  t(q1.ok && q1.queued === 3 && q1.skipped['asked not to be emailed'] === 1 && q1.skipped['email address cannot take mail'] === 1, `queued 3; skipped the unsubscribed and the bad address (${JSON.stringify(q1.skipped)})`);
  t((await call('queue', { ids: [add.id] }))._status === 400, 'queueing the same company twice is refused');
  t((await call('signout', {})).ok && (await call('queue', { ids: [L1.id] }))._status === 401, 'signed out: queueing refused'); await call('signin', { code });
  const dowH = new Date(); const inHours = dowH.getDay() >= 1 && dowH.getDay() <= 5 && dowH.getHours() >= 8 && dowH.getHours() < 17;
  let out1 = inHours ? '' : php(['sendqueue', '10'], { DESK_HOURS: '1' });   /* the desk sends any hour since 30 Oct; DESK_HOURS=1 restores weekdays 8-5, checked only outside them */
  t(inHours || /not sending hours/.test(out1), 'with DESK_HOURS=1, outside weekday 8 am to 5 pm the job does not send' + (inHours ? ' (in hours now: not checked)' : ''));
  if (!inHours) rmSync(MOCK, { force: true });
  const t0 = Date.now(); out1 = php(['sendqueue', '10'], { DESK_ANYTIME: '1', DESK_GAP: '2' });
  const mails = existsSync(MOCK) ? readFileSync(MOCK, 'utf8').trim().split('\n').map((x) => JSON.parse(x)) : [];
  t(mails.length === 2 && /today's cap reached/.test(out1), `the daily cap: 2 sent, then it stops (${out1.trim().replace(/\n/g, ' / ')})`);
  t(Date.now() - t0 >= 1800, 'messages are spaced (2 s here; 120 s live)');
  t(mails.every((m) => !/[,;]/.test(m.to) && /@/.test(m.to)), 'each message goes to one address only');
  t(mails.every((m) => !m.headers.some((h) => /^List-Unsubscribe/.test(h))), 'no List-Unsubscribe headers (removed 29 Oct: a Promotions signal; the link in the body is the opt-out)');
  t(mails.every((m) => /PO Box 100, Denver/.test(m.body) && /Traverse Platforms LLC/.test(m.body)), 'each carries the postal address and the company name');
  D = await call('data');
  t(D.queue.sentToday === 2 && D.queue.waiting === 1, 'the desk shows 2 sent today, 1 waiting');
  t(mails.every((m) => ['new', 'emailed'].includes(D.leads.find((l) => l.email === m.to)?.status) && D.leads.find((l) => l.email === m.to)?.sent.length === 1), 'each emailed company shows the email sent');
  t(D.leads.find((l) => l.email === mails[0].to).status === 'emailed', 'a Not contacted company moves to Emailed');
  /* the unsubscribe link, no sign-in */
  const link = mails[0].body.match(/https?:\/\/\S+action=unsub\S+/)[0].replace(/^https:\/\/127\.0\.0\.1:8811/, `http://127.0.0.1:${PORT}`);
  const page = await (await fetch(link)).text();
  t(/Unsubscribe from Traverse emails\?/.test(page) && /<form method="post"/.test(page) && !/You are unsubscribed/.test(page), 'the unsubscribe link (a GET, as a mail scanner opens it) only shows the page with the button (review 2026-10-31)');
  let Dg = await call('data'); t(!Dg.leads.find((l) => l.email === mails[0].to).unsub, 'opening the link takes nobody off');
  const page2 = await (await fetch(link, { method: 'POST' })).text();
  t(/You are unsubscribed/.test(page2), 'the button (a POST) unsubscribes without signing in');
  t(/You are unsubscribed/.test(await (await fetch(link)).text()), 'the link afterwards says so');
  t(/That link did not work/.test(await (await fetch(link.replace(/t=[0-9a-f]+/, 't=0000'))).text()), 'a forged unsubscribe link does nothing');
  D = await call('data');
  const unsubbed = D.leads.find((l) => l.email === mails[0].to);
  t(unsubbed.unsub && unsubbed.nomail === 'asked not to be emailed', 'the company is marked never to be emailed again');
  /* tomorrow: the waiting one goes, unless it unsubscribed meanwhile */
  const qd = JSON.parse(readFileSync(join(DATA, 'queue.json'), 'utf8'));
  const waitingLead = D.leads.find((l) => l.id === qd[0].id);
  await call('unsubmark', { id: waitingLead.id });
  await call('settings', { cap: 40 });
  const out2 = php(['sendqueue', '10'], { DESK_ANYTIME: '1', DESK_GAP: '0' });
  const mails2 = readFileSync(MOCK, 'utf8').trim().split('\n');
  D = await call('data');
  t(mails2.length === 2 && D.queue.waiting === 0 && D.queue.recent.some((r) => r.t === 'skipped' && r.why === 'asked not to be emailed'), 'one that unsubscribed while waiting is skipped, not sent');
  /* stop the queue */
  await call('queue', { ids: [L1.id === waitingLead.id ? add.id : L1.id].filter((x) => !D.leads.find((l) => l.id === x).nomail) });
  const cl = await call('queueclear', {}); D = await call('data');
  t(cl.ok && D.queue.waiting === 0, 'Stop empties the queue');
  t(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
} catch (e) { t(false, 'stopped: ' + e.message); }
finally {
  if (chrome) chrome.kill(); srv.kill();
  if (prof) for (let k = 0; k < 30; k++) { try { rmSync(prof, { recursive: true, force: true }); break; } catch { await sleep(200); } }
  console.log(`\nprospect desk ${pass}/${pass + fail}`); process.exit(fail ? 1 : 0);
}
