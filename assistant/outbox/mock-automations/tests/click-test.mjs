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
const ev = async x => (await send('Runtime.evaluate', {expression: x, returnByValue: true, awaitPromise: true})).result.result.value;
await send('Runtime.enable'); await send('Page.enable');
let fails = 0; const ok = (c, t) => { console.log((c ? 'ok   ' : 'FAIL ') + t); if (!c) fails++ };
if (process.env.CODE_FILE) {
  const code = (await import('node:fs')).readFileSync(process.env.CODE_FILE, 'utf8').trim();
  await send('Page.navigate', {url: URL0}); await sleep(1500);
  ok(await ev("!!document.querySelector('input[name=code]') && !document.querySelector('#view')"), 'not signed in: only the sign-in form');
  await ev("document.querySelector('input[name=code]').value=" + JSON.stringify(code) + ";document.querySelector('form').submit()"); await sleep(2500);
}
await send('Page.navigate', {url: URL0 + '#/automations'}); await sleep(1200);
ok(await ev("document.querySelectorAll('table.lt tbody tr:not(.grp)').length") === 17, '17 automations listed');
ok((await ev("document.body.innerText")).includes('Mock: nothing here sends. Sample data.'), 'banner shown');
await ev("document.querySelector('#fst').value='Draft';document.querySelector('#fst').onchange({target:document.querySelector('#fst')})");
ok(await ev("document.querySelectorAll('table.lt tbody tr:not(.grp)').length") === 13, 'Status filter: 13 drafts');
await ev("document.querySelector('#fst').value='';document.querySelector('#fst').onchange({target:document.querySelector('#fst')})");
await ev("document.querySelector('[data-open=\"free-class\"]').click()"); await sleep(300);
ok(await ev("!document.querySelector('#dr').classList.contains('hide') && document.querySelector('#drt').textContent") === 'Free-class reminder and follow-up', 'drawer opens');
await ev("document.querySelector('[data-dt=flow]').click()"); ok((await ev("document.querySelector('#dr').innerText")).includes('Have they joined?'), 'Flow tab');
await ev("document.querySelector('[data-dt=stats]').click()"); ok((await ev("document.querySelector('#dr').innerText")).includes('Joined'), 'Stats tab');
await ev("document.querySelector('#drx').click()"); ok(await ev("document.querySelector('#dr').classList.contains('hide')"), 'drawer closes');
await ev("document.querySelector('[data-sw=\"new-account\"]').click()"); await sleep(100);
ok((await ev("document.querySelector('[data-sw=\"new-account\"]').getAttribute('aria-checked')")) === 'true', 'Approved automation switches on');
await ev("location.hash='#/edit/free-class/day-7'"); await sleep(300);
await ev("const e=document.querySelector('#e-subject');e.value='Test subject {first_name}';e.oninput()");
ok((await ev("document.querySelector('#pv').innerText")).includes('Test subject Alex'), 'preview follows the subject, merge field filled');
await ev("document.querySelector('[data-d=full]').click()"); ok(await ev("!!document.querySelector('#pv .em.full')"), 'Full design preview');
await ev("document.querySelector('[data-d=light]').click()"); ok(await ev("!!document.querySelector('#pv .em.light')"), 'Light preview');
await ev("document.querySelector('#test').click()"); ok((await ev("document.querySelector('#toast').textContent")).includes('no test was sent'), 'Send me a test does nothing');
await ev("document.querySelector('#appr [data-to=Approved]').click()"); ok((await ev("document.querySelector('#appr').innerText")).includes('Switch on'), 'approve moves to Approved');
ok(await ev("document.querySelector('#nbA').textContent") === '2', 'approvals badge drops to 2');
for (const r of ['approvals', 'results', 'settings']) { await ev(`location.hash='#/${r}'`); await sleep(200); ok((await ev("document.querySelector('#view').innerText")).length > 200, r + ' page renders') }
ok((await ev("document.querySelector('#view').innerText")).includes('DMARC'), 'settings shows DMARC');
ok(errs.length === 0, 'no script errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
ws.close(); ch.kill(); process.exit(fails ? 1 : 0);
