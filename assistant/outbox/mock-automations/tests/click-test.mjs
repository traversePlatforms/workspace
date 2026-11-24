// Clicks through the mock in headless Chrome (CDP) and checks each screen reacts. Usage: node click-test.mjs [url]  (default http://127.0.0.1:8787/)
// Live copy: CODE_FILE=~/.ssh/outbox-mock-code.txt node click-test.mjs https://traverseplatforms.com/<folder>/  (the code is typed into the form, never printed)
import {spawn} from 'node:child_process';
const URL0 = process.argv[2] || 'http://127.0.0.1:8787/';
const port = 9333, ch = spawn(process.env.CHROME || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`, '--user-data-dir=/tmp/omock-' + process.pid, 'about:blank'], {stdio: 'ignore'});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tabs; for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break } catch { await sleep(200) } }
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const wait = {}; const errs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait[m.id]) { wait[m.id](m); delete wait[m.id] } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description) };
const send = (method, params = {}) => new Promise(r => { const i = ++id; wait[i] = r; ws.send(JSON.stringify({id: i, method, params})) });
const ev = async x => (await send('Runtime.evaluate', {expression: /^const /.test(x) ? "{" + x + "}" : x, returnByValue: true, awaitPromise: true})).result.result.value;
const txt = s => ev(`(document.querySelector(${JSON.stringify(s)})||{}).innerText||''`);
const click = s => ev(`document.querySelector(${JSON.stringify(s)}).click()`);
const go = async h => { await ev(`location.hash=${JSON.stringify(h)}`); await sleep(350) };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
let fails = 0; const ok = (c, t) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if (!c) fails++ };
if (process.env.CODE_FILE) {
  const code = (await import('node:fs')).readFileSync(process.env.CODE_FILE, 'utf8').trim();
  await send('Page.navigate', {url: URL0}); await sleep(1500);
  ok(await ev("!!document.querySelector('input[name=code]') && !document.querySelector('#view')"), 'not signed in: only the sign-in form');
  await ev("document.querySelector('input[name=code]').value=" + JSON.stringify(code) + ";document.querySelector('form').submit()"); await sleep(2500);
}
await send('Page.navigate', {url: URL0 + '#/automations'}); await sleep(1500);

// list
const rows = "document.querySelectorAll('table.lt tbody tr:not(.grp)').length";
ok(await ev(rows) === 17, '17 automations listed');
ok((await ev("document.body.innerText")).includes('Mock: nothing here sends. Sample data.'), 'banner shown');
ok(await ev("[...document.querySelectorAll('table.lt thead th:not(.act)')].map(t=>t.innerText.replace(/[↕▲▼]/g,'').trim()).filter(Boolean).join('|')") === 'Name|Status|Last run|Next run|Sent|Clicked|Joined|Opt-outs', 'default columns: Name, Status, Last run, Next run, Sent, Clicked, Joined, Opt-outs');
ok(await ev("document.querySelector('.tw.lst').scrollWidth <= document.querySelector('.tw.lst').clientWidth"), 'nothing cut off at 1440 px');
ok(!(await txt('table.lt tbody')).includes('Triggered') && !(await txt('table.lt tbody')).includes('Text · later'), 'no repeated Triggered / Text labels on rows');
ok(await ev("document.querySelectorAll('.nums.desk > div').length") >= 6 && await ev("!document.querySelector('.strip,.sc')"), 'one compact numbers row, no stat cards');
ok((await txt('.nums.desk')).includes('Apple Mail') || (await ev("document.querySelector('.nums.desk .minor').title")).includes('Apple Mail'), 'Opened shown small with the Apple Mail note');
await click('#colsb'); ok(await ev("!document.querySelector('#colsp').classList.contains('hide')"), 'column chooser opens');
await ev("const c=document.querySelector('[data-col=open]');c.checked=true;c.onchange()"); await sleep(100);
ok((await txt('table.lt thead')).includes('Opened'), 'column chooser adds Opened');
await click('#colsr'); await sleep(100); ok(!(await txt('table.lt thead')).includes('Opened'), 'column chooser resets');
await ev("document.querySelector('#fst').value='Draft';document.querySelector('#fst').onchange({target:document.querySelector('#fst')})");
ok(await ev(rows) === 13, 'Status filter: 13 drafts');
await ev("document.querySelector('#fst').value='';document.querySelector('#fst').onchange({target:document.querySelector('#fst')})");
await ev("document.querySelector('#fty').value='Recurring';document.querySelector('#fty').onchange({target:document.querySelector('#fty')})");
ok(await ev(rows) === 1, 'Type filter: 1 recurring');
await ev("document.querySelector('#fty').value='';document.querySelector('#fty').onchange({target:document.querySelector('#fty')})");
await ev("document.querySelector('[data-sw=\"new-account\"]').click()"); await sleep(100);
ok((await ev("document.querySelector('[data-sw=\"new-account\"]').getAttribute('aria-checked')")) === 'true', 'status toggle: approved automation switches on');

// drawer + funnel
await ev("document.querySelector('[data-open=\"free-class\"]').click()"); await sleep(300);
ok(await ev("!document.querySelector('#dr').classList.contains('hide') && document.querySelector('#drt').textContent") === 'Free-class reminder and follow-up', 'drawer opens');
ok((await txt('#dr')).includes('WHEN') && (await txt('#dr')).includes('EXIT') && (await txt('#dr')).includes('Texts come later'), 'drawer: How it works and channel info');
await click('[data-dt=flow]'); ok((await txt('#dr')).includes('Have they joined?'), 'Flow tab');
await click('[data-dt=stats]'); const fs = await txt('.fnl');
ok(['Reminded', 'Attended', 'Got the follow-up', 'Joined within 7 days', '78', '60', '52', '11', '77%', '87%', '21%'].every(x => fs.includes(x)), 'funnel 78 → 60 → 52 → 11 with step conversions');
await click('#drx'); ok(await ev("document.querySelector('#dr').classList.contains('hide')"), 'drawer closes');

// block editor
await go('#/edit/free-class/day-7');
const nb = () => ev("document.querySelectorAll('#blocks .blk').length");
const b0 = await nb();
await click('[data-add=divider]'); await click('[data-add=spacer]'); await click('[data-add=image]'); await click('[data-add=button]'); await click('[data-add=text]');
ok(await nb() === b0 + 5, 'add Text, Image, Button, Divider, Spacer blocks');
ok(await ev("!!document.querySelector('#pv hr') && !!document.querySelector('#pv .spc') && document.querySelectorAll('#pv .im').length===1"), 'new blocks show in the preview');
const first = () => ev("document.querySelector('#blocks .blk .ty').textContent");
await ev("document.querySelectorAll('#blocks [data-mv][data-dir=\"1\"]')[0].click()"); ok((await first()) === 'Text', 'move a block down');
await ev("document.querySelectorAll('#blocks [data-mv][data-dir=\"-1\"]')[1].click()"); ok((await first()) === 'Text · heading', 'move a block up');
await ev("document.querySelectorAll('#blocks [data-rm]')[" + (b0 + 4) + "].click()"); ok(await nb() === b0 + 4, 'remove a block');
ok((await txt('.bk')).includes('Every email stays on-brand automatically') && (await txt('.panel .lock')) === 'Locked', 'locked brand kit panel');
await ev("const e=document.querySelector('#e-subject');e.value='Test subject {first_name}';e.oninput()");
ok((await txt('#pv')).includes('Test subject Alex'), 'preview follows the subject, merge field filled');
await ev("const p=document.querySelector('#pas');p.value='noname';p.onchange({target:p})");
ok((await txt('#pv')).includes('Hi there,'), 'no first name: fallback "there" used');
await ev("const f=document.querySelector('[data-fb=first_name]');f.value='friend';f.oninput()"); ok((await txt('#pv')).includes('Hi friend,'), 'fallback setting changes the preview');
await ev("const p=document.querySelector('#pas');p.value='alex';p.onchange({target:p})");
await ev("document.querySelector('#e-pre').focus()"); await ev("document.querySelector('.chip[data-mf=class_time]').click()");
ok((await ev("document.querySelector('#e-pre').value")).includes('{class_time}'), 'merge chip inserts where you are typing');
await click('[data-v=phone]'); ok(await ev("document.querySelector('#pv').classList.contains('phone')"), 'Phone preview');
await click('[data-v=desktop]'); ok(await ev("!document.querySelector('#pv').classList.contains('phone')"), 'Desktop preview');
await click('[data-d=full]'); ok(await ev("!!document.querySelector('#pv .em.full')") && (await txt('#pv .tabi')) === 'Likely: Promotions', 'Full design preview, Likely: Promotions');
await click('[data-d=light]'); ok(await ev("!!document.querySelector('#pv .em.light')"), 'Light preview of the same blocks');
// inbox checks
const chk = () => txt('#chk');
{ const c = await chk(); ok(['Images and text', 'Links', 'Unsubscribe link', 'Subject length', '[Brackets] to fill'].every(x => c.includes(x)), 'five inbox checks shown') }
ok(await ev("document.querySelector('#chk li.a.block') !== null") && await ev("document.querySelector('#appr [data-to=Approved]').disabled"), 'brackets left: amber, Approve blocked');
await ev("const e=document.querySelector('#e-subject');e.value='This subject line is far too long for most phones to show in full';e.oninput()");
{ const c = await chk(); ok(c.includes('may be cut off'), 'long subject turns amber' + (c.includes('may be cut off') ? '' : ': ' + c.slice(0, 300))) }
await ev("document.querySelectorAll('#blocks [data-k=v]').forEach(t=>{t.value=t.value.replace(/\\[[^\\]]*\\]/g,'');t.oninput()});document.querySelectorAll('#blocks [data-k=link]').forEach(t=>{t.value='https://example.com/x';t.oninput()})");
ok(!(await ev("document.querySelector('#appr [data-to=Approved]').disabled")), 'brackets filled: Approve unblocked (live)');
ok((await txt('#appr')).includes('Cammie gets an email'), 'note: Cammie gets an email (mock)');
await click('#test'); ok((await txt('#toast')).includes('no test was sent'), 'Test to me does nothing');
await click('#testc'); ok((await txt('#toast')).includes('Cammie'), 'Test to Cammie does nothing');
await click('#appr [data-to=Approved]'); ok((await txt('#appr')).includes('Switch on'), 'approve moves to Approved');
ok(await ev("document.querySelector('#nbA').textContent") === '2', 'approvals badge drops to 2');

// approvals with history
await go('#/approvals');
ok((await txt('#view')).includes('Approved by Cammie') || (await txt('#view')).includes('Cammie approved it'), 'approvals show who approved and when');
const gr = '[data-item="google-review/ask"]';
ok((await txt(gr + ' .diff')).includes('Review us on Google') && (await txt(gr + ' .diff')).includes('Leave a Google review'), 'what changed: before/after lines');
ok((await txt(gr + ' .thread')).includes('Cammie'), 'comment thread');
await ev(`document.querySelector('#rp-google-review\\\\/ask').value='Looks right now.'`); await click(gr + ' [data-post]');
ok((await txt(gr + ' .thread')).includes('Looks right now.'), 'add a comment');
ok(await ev("document.querySelector('[data-ok=\"new-member/day-3\"]').disabled"), 'Approve blocked while brackets remain');
await click('[data-chg="new-member/day-3"]'); ok((await txt('#toast')).includes('Say what to change'), 'Ask for changes needs a comment');
await click('[data-ok="google-review/ask"]'); await sleep(100);
ok(await ev("document.querySelector('#nbA').textContent") === '1' && (await txt('#view')).includes('Approved by Cammie, Just now'), 'Approve: badge 1, approved by Cammie, just now');

// results, settings
await go('#/results'); ok((await txt('#view')).includes('Free-class funnel') && (await txt('#view')).includes('Against Patch'), 'results: funnel and Patch line');
await go('#/settings');
ok((await txt('#rules')).includes('Emails per person') && (await txt('#rules')).includes('Quiet hours'), 'settings: sending rules');
await ev("const n=document.querySelector('#capN');n.value='2';n.oninput({target:n})"); ok((await txt('#eff')).includes('at most 2 marketing emails'), 'cap changes the summary');
await click('[data-tg=svcEx]'); ok((await txt('#eff')).includes('class reminders included'), 'service-email toggle');
await ev("const s=document.querySelector('#qTo');s.value='8';s.onchange({target:s})"); ok((await txt('#qnote')).includes('8:00 am'), 'quiet hours: queued emails go at the end time');
ok((await txt('#view')).includes('DMARC'), 'settings shows DMARC');

// phone
await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
await go('#/automations'); await sleep(200);
ok(await ev("document.querySelectorAll('.pcard').length") === 17 && await ev("getComputedStyle(document.querySelector('.tw.lst')).display") === 'none', 'phone: compact cards instead of the table');
ok(await ev("document.querySelector('.pcard').getBoundingClientRect().top < 300"), 'phone: the list is first below the tabs');
ok(await ev("document.documentElement.scrollWidth <= 390"), 'phone: no sideways scroll');
ok(errs.length === 0, 'no script errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
ws.close(); ch.kill(); process.exit(fails ? 1 : 0);
