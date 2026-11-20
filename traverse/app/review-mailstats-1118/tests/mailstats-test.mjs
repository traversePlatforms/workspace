/* Sixfold 365's customer emails: opens, clicks and words from Outbox (2026-11-18, Matthew: "I think that we also need to track the analytics
   for the emails we send out for sixfold. And id also like to see the analytics under each option in the outbox app so that I can see whats
   working and make changes if needed in the outbox app").
   One throwaway copy of the server's layout in a temp folder: the app's API, the tracker (m/index.php), Outbox, made-up leads and jobs, and a
   DRY-RUN 365 mailbox, so every "send" is written to a365-dryrun.log and nothing leaves this computer. Two PHP test servers (the app and the
   tracker on one, Outbox on the other, because Outbox asks the app server to server). The sends run through rounds.php's own functions from
   the command line (mt-cli.php). Fresh data every run, so it can be run again as it is:
     node traverse/app/review-mailstats-1118/tests/mailstats-test.mjs */
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), APP = path.resolve(HERE, '..', '..'), REPO = path.resolve(APP, '..', '..');
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; return ok; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = fs.mkdtempSync(path.join(os.tmpdir(), 'mailstats-')), PUB = path.join(R, 'public_html');
const PA = 8893, PO = 8894, A = 'http://127.0.0.1:' + PA, O = 'http://127.0.0.1:' + PO;
const mk = (rel, s) => { const f = path.join(R, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const rd = (rel) => { try { return fs.readFileSync(path.join(R, rel), 'utf8'); } catch { return ''; } };
const jl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const lines = (rel) => rd(rel).split('\n').filter(Boolean).map((l) => JSON.parse(l));
const NOW = Math.floor(Date.now() / 1000), DAY = 86400;
const day = (n) => new Date(Date.now() + n * DAY * 1000).toISOString().slice(0, 10);
const procs = [];

/* ---- the layout: Outbox as it goes up, the app's API, the tracker ---- */
const as = spawnSync('node', [path.join(REPO, 'assistant', 'outbox', 'tools', 'assemble.mjs'), PUB]);
t(as.status === 0, 'Outbox assembled');
fs.mkdirSync(path.join(PUB, 'api'), { recursive: true });
for (const f of fs.readdirSync(path.join(APP, 'api'))) if (f.endsWith('.php')) fs.copyFileSync(path.join(APP, 'api', f), path.join(PUB, 'api', f));
mk('public_html/m/index.php', fs.readFileSync(path.join(APP, 'mailtrack', 'index.php')));
const KEY = crypto.randomBytes(32).toString('hex'), CODE = 'MAILSTATS1234';
mk('sixfold-private/outbox-key.txt', KEY + '\n');
mk('sixfold-private/rounds-codes.php', "<?php\nreturn ['session_key' => '" + crypto.randomBytes(32).toString('hex') + "', 'session_days' => 45, 'people' => ['583921' => ['Pat Admin', 'admin']]];\n");
mk('sixfold-private/a365-mail.json', JSON.stringify({ user: 'tests@example.com', pass: 'not-a-password', from: 'hello@example.com', dryrun: true }));   /* DRY RUN: nothing is sent */
const CO = { name: 'Sixfold 365', short: 'Sixfold', phone: '(555) 010-0100', email: 'office@example.com', features: { walkdesk: true, crew: true }, best: null,
  links: { googleReview: 'https://g.page/r/TESTREVIEW123/review' }, a365: { name: 'Sixfold 365', phone: '(555) 010-0199', web: '365aeration.com', base: [39.6537, -104.9919], radius: 45 } };
mk('sixfold-data/rounds/company.json', JSON.stringify(CO));
mk('sixfold-data/rounds/index.json', '{"regions":[]}');
mk('sixfold-data/rounds/emails2.json', JSON.stringify({ on: true, from: 0 }));
mk('sixfold-data/rounds/followup.json', JSON.stringify({ on: true, at: NOW - 30 * DAY, from: 0 }));
mk('sixfold-data/rounds/deprem.json', JSON.stringify({ on: true, at: NOW - 30 * DAY, from: 0, no: {}, sent: {} }));
const ISSUE = 'ntest00001';
mk('sixfold-data/rounds/newsletter.json', JSON.stringify({ address: '333 Test Ave, Englewood, CO 80110', issues: [{ id: ISSUE, subject: 'Test lawn notes', pre: 'Hi', body: '# Test notes\n\nHello. See [our site](https://365aeration.com/) for more.\n\n## Watering\n\nWater [deeply](https://extension.colostate.edu/topic-areas/yard-garden/).', by: 'test', at: NOW - DAY, approved: { for: NOW - 60, by: 'test', at: NOW - 3600 }, sent: null }] }));
const L = (n) => 'w2026111800000' + n + 'abc00' + n;   /* leadOk: w + 14 digits + 6 hex */
const NAMES = ['', 'Alex Alpha', 'Bea Bravo', 'Cal Charlie', 'Dee Delta', 'Eve Echo', 'Fay Foxtrot', 'Gus Golf'];
mk('sixfold-data/leads/leads.log', jl([1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: L(n), name: NAMES[n], phone: '555010010' + n, email: NAMES[n].split(' ')[0].toLowerCase() + n + '@example.com', src: 'a365web', town: 'Testville', at: NOW - 40 * DAY, by: 'test' }))));
mk('sixfold-data/leads/leadst.log', jl([
  { id: L(4), sign: { how: 'link', deposit: 150, key: 'k4test', pay: {} }, quote: { offer: { date: day(3), slot: 's2' }, price: 400 }, by: 'test', at: NOW - 10 * DAY },
  { id: L(5), sign: { how: 'card', deposit: 100, key: 'k5test' }, by: 'test', at: NOW - 5 * DAY },
  { id: L(5), signed: { name: 'Eve Echo', at: NOW - 5 * DAY, facts: [['Customer', 'Eve Echo'], ['Price', '$350']], terms: ['A term.'] }, by: 'test', at: NOW - 5 * DAY }]));
const SQ1 = 'https://square.link/u/TESTPAY1?src=a&b=c', SQ7 = 'https://square.link/u/TESTPAY7';
const job = (id, lead, extra) => ({ id, lead, title: 'x', crew: 'Sam Crew', date: day(-2), slot: 's2', price: 400, pkg: 'full', pay: { s: 'paid' }, done: { o: 'done', at: NOW - 2 * DAY }, by: 'test', at: NOW - 3 * DAY, ...extra });
mk('sixfold-data/rounds/jobs.log', jl([
  job('jt1', L(1), { pay: { s: 'deposit', amt: 150 }, sqlink: { amt: 250, url: SQ1 } }),
  job('jt2', L(2), {}), job('jt3', L(3), { pay: { s: 'deposit', amt: 150 }, sqlink: { amt: 250, url: SQ1 } }), job('jt6', L(6), {}),
  job('jt7', L(7), { pay: { s: 'deposit', amt: 100 }, sqlink: { amt: 300, url: SQ7 } })]));
const cs = spawnSync('php', [path.join(PUB, 'outbox-092b0f', 'cli.php'), 'setcode'], { input: CODE }); t(cs.status === 0, 'Outbox sign-in code set (hashed)');

/* ---- the two test servers and the command-line door ---- */
procs.push(spawn('php', ['-d', 'memory_limit=768M', '-S', '127.0.0.1:' + PA, '-t', PUB], { stdio: 'ignore' }));
procs.push(spawn('php', ['-d', 'memory_limit=768M', '-S', '127.0.0.1:' + PO, '-t', PUB], { stdio: 'ignore', env: { ...process.env, OUTBOX_APP_API: A + '/api/rounds.php' } }));
const cli = (cmd, arg = '', dir = 'api') => { const o = execFileSync('php', ['-d', 'memory_limit=768M', path.join(HERE, 'mt-cli.php'), path.join(PUB, dir, 'rounds.php'), cmd, arg], { encoding: 'utf8', env: { ...process.env, A365_TRACK_BASE: A + '/m/' } }); try { return JSON.parse(o); } catch { return { raw: o.slice(0, 300) }; } };
function req(url, { method = 'GET', body = null, headers = {}, cookie = '' } = {}) {
  return new Promise((res) => {
    const data = body == null ? null : JSON.stringify(body);
    const r = http.request(url, { method, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36', ...headers, ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...(cookie ? { Cookie: cookie } : {}) } }, (x) => {
      const ch = []; x.on('data', (d) => ch.push(d)); x.on('end', () => { const raw = Buffer.concat(ch); let j = null; try { j = JSON.parse(raw.toString('utf8')); } catch {} res({ status: x.statusCode, headers: x.headers, raw, j }); });
    });
    r.on('error', (e) => res({ status: 0, error: String(e), headers: {}, raw: Buffer.alloc(0), j: null })); if (data) r.write(data); r.end();
  });
}
let jar = '';
const ob = async (action, body) => { const r = await req(O + '/outbox-092b0f/api.php?action=' + action, body === undefined ? { cookie: jar } : { method: 'POST', body, cookie: jar, headers: { 'X-OB': '1' } }); for (const c of r.headers['set-cookie'] || []) { const kv = c.split(';')[0]; if (kv.startsWith('outbox=')) jar = kv; } return r; };
const dry = () => lines('sixfold-private/a365-dryrun.log');
const sends = () => lines('sixfold-data/rounds/mail-sends.log');
const events = () => lines('sixfold-data/rounds/mail-events.log');
const trk = (s, kind) => [...s.matchAll(new RegExp(A.replace(/[.]/g, '\\.') + '/m/\\?' + kind + '=([0-9a-f.]+)', 'g'))].map((m) => m[1]);

try {
  for (let i = 0; i < 80; i++) { const a = await req(A + '/m/?o=x'), b = await req(O + '/outbox-092b0f/api.php?action=state'); if (a.status && b.status) break; await sleep(150); }

  /* ================= 1. the sends are counted ================= */
  t(cli('trackon').on === true, 'Sixfold 365 counts its customer emails (a365TrackOn)');
  const r1 = cli('aftercare', 'jt1'); t(r1.ok === true && /^[0-9a-f]{20}$/.test(r1.track || ''), 'aftercare (balance + pay link) "sent" to the dry-run log with a tracking id');
  let m = dry().at(-1); const s1 = sends().at(-1);
  t(s1.k === 'aftercare' && s1.id === r1.track && s1.v === 'v0' && s1.lead === L(1) && s1.job === 'jt1', 'mail-sends.log: kind, id, version v0 (built-in words), lead and job');
  t(s1.links.includes(SQ1), 'the pay link is kept exactly as it was (' + SQ1 + ')');
  t(trk(m.html, 'o').length === 1 && m.html.indexOf('/m/?o=' + r1.track) < m.html.indexOf('</body>'), 'one open image, at the end of the HTML');
  t(!/href="https:\/\//.test(m.html), 'no https link left untracked in the HTML');
  t(/href="tel:/.test(m.html), 'the phone link is left as it is');
  t(!m.text.includes(SQ1) && trk(m.text, 'c').length >= 1, 'the plain-text copy\'s pay link goes through the tracker too');
  const allUrls = [...trk(m.html, 'c'), ...trk(m.html, 'o')];
  t(allUrls.length >= 2 && allUrls.every((u) => /^[0-9a-f]{20}(\.\d+)?$/.test(u)), 'tracking addresses carry only the opaque id and a link number (no name, no email)');
  t(!/example\.com|Alpha/i.test(JSON.stringify(trk(m.html, 'c'))), '... no customer detail in them');
  const r3 = cli('followup', 'jt3'); m = dry().at(-1);
  t(r3.ok === true && sends().at(-1).k === 'followup', 'two-day follow-up counted');
  t(/action=nlunsub/.test(m.html) && /action=nlunsub/.test(m.text), 'its unsubscribe link is left alone (HTML and text)');
  t(!m.html.includes('g.page/r/TESTREVIEW123') && sends().at(-1).links.some((u) => u.includes('g.page/r/TESTREVIEW123')), 'the review link goes through the tracker');
  const r4 = cli('deposit', L(4)); m = dry().at(-1); const s4 = sends().at(-1);
  t(r4.ok === true && s4.k === 'deposit' && s4.v === 'v0', 'deposit reminder counted');
  const signLink = s4.links.find((u) => u.includes('/sign/?s='));
  t(!!signLink && /^https:\/\/365aeration\.com\/sign\/\?s=w\d{14}[0-9a-f]{6}-[0-9a-f]{16}$/.test(signLink), 'the deposit reminder\'s form link is kept exactly');
  const r5 = cli('signed', L(5)); t(r5.ok === true && sends().at(-1).k === 'signed', 'signed copy counted');
  const rn = cli('nlsweep'); const nlS = sends().filter((s) => s.k === 'newsletter');
  t(rn.sent >= 7 && nlS.length === rn.sent && nlS.every((s) => s.v === ISSUE && s.issue === ISSUE), 'newsletter: ' + nlS.length + ' sends counted under the issue id');
  const nlm = dry().filter((x) => x.subject === 'Test lawn notes');
  t(nlm.length === nlS.length && nlm.every((x) => (x.headers || []).some((h) => /^List-Unsubscribe: <http.*action=nlunsub/.test(h))), 'newsletter: the List-Unsubscribe header is unchanged');
  t(nlm.every((x) => /href="[^"]*action=nlunsub/.test(x.html) && !x.html.includes('href="https://extension.colostate.edu')), 'newsletter: its unsubscribe link left alone, its content links tracked');
  const d0 = dry().length;
  /* a preview and a test send are never counted (they call the builders and a365Mail, not a365SendTracked) */
  const pv = (await req(A + '/api/rounds.php?action=a365wordspreview', { method: 'POST', body: { kind: 'aftercare', lines: {} }, headers: { 'X-Outbox-Key': KEY } })).j;
  t(pv && pv.ok && !/\/m\/\?[co]=/.test(pv.html) && dry().length === d0, 'a preview carries no tracker and sends nothing');

  /* ================= 2. the tracker ================= */
  const n1 = s1.links.indexOf(SQ1);
  let c = await req(A + '/m/?c=' + r1.track + '.' + n1);
  t(c.status === 302 && c.headers.location === SQ1, 'a click on the pay link lands on exactly the pay link (302)');
  t(events().at(-1).t === 'scan', '... within 60 seconds of the send it counts as a mail scanner, not a click');
  /* the send an hour ago (throwaway data): now a click is a click */
  fs.writeFileSync(path.join(R, 'sixfold-data/rounds/mail-sends.log'), sends().map((s) => JSON.stringify(s.t === 'send' ? { ...s, at: s.at - 3600 } : s)).join('\n') + '\n');
  c = await req(A + '/m/?c=' + r1.track + '.' + n1); let ev = events().at(-1);
  t(c.status === 302 && c.headers.location === SQ1 && ev.t === 'click' && ev.id === r1.track && ev.k === 'aftercare' && ev.n === n1, 'an hour later: a click, logged with id, kind and link number');
  t(!JSON.stringify(ev).match(/example\.com|127\.0\.0\.1|Mozilla/), '... and nothing about the person (no address, IP or browser)');
  c = await req(A + '/m/?c=' + r1.track + '.' + n1, { method: 'HEAD' }); t(c.status === 302 && events().at(-1).t === 'scan', 'a HEAD request forwards but counts as a scanner');
  c = await req(A + '/m/?c=' + r1.track + '.' + n1, { headers: { 'User-Agent': 'curl/8.0' } }); t(c.status === 302 && events().at(-1).t === 'scan', 'a script (curl) counts as a scanner');
  c = await req(A + '/m/?c=' + r1.track + '.' + n1, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Microsoft SafeLinks)' } }); t(events().at(-1).t === 'scan', 'Safe Links counts as a scanner');
  const ns = s4.links.indexOf(signLink); c = await req(A + '/m/?c=' + s4.id + '.' + ns);
  t(c.status === 302 && c.headers.location === signLink, 'a click on the deposit reminder\'s form link lands on exactly that form link');
  const sk = new URL(c.headers.location).searchParams.get('s'); const sg = await req(A + '/api/rounds.php?action=a365sign&s=' + encodeURIComponent(sk));
  t(sg.status === 200 && sg.j && sg.j.ok === true, 'and that form link still opens the customer\'s form in the app (a365sign answers ok)');
  c = await req(A + '/m/?c=' + r1.track + '.' + n1 + '&u=https://evil.example/&to=https://evil.example/'); t(c.headers.location === SQ1, 'no open redirect: extra addresses in the link are ignored, only the email\'s own address is used');
  const evN = events().length;
  for (const [q, what] of [['c=nothex.0', 'a broken id'], ['c=' + 'ab'.repeat(10) + '.0', 'an id that was never sent'], ['c=' + r1.track + '.99', 'a link number the email never had'], ['c=' + r1.track, 'no link number'], ['c=' + r1.track + '.0x', 'junk after the number'], ['c[]=' + r1.track, 'an array']]) {
    c = await req(A + '/m/?' + q); t(c.status === 404 && !c.headers.location, what + ': refused (404, no redirect)'); }
  c = await req(A + '/m/?c=' + r1.track + '.' + n1 + '%0d%0aSet-Cookie:x=1'); t(c.status === 404 && !c.headers['set-cookie'], 'a line break smuggled into the link is refused');
  t(events().length === evN, 'refused links log nothing');
  c = await req(A + '/m/?o=nothex'); t(c.status === 200 && c.headers['content-type'] === 'image/gif' && events().length === evN, 'a broken open image still answers the image and logs nothing');
  c = await req(A + '/m/?o=' + r1.track, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)' } });
  ev = events().at(-1); t(c.status === 200 && c.raw.length > 30 && ev.t === 'open' && ev.id === r1.track && ev.via === 'gmail', 'an open through Gmail\'s image proxy: logged as an open, via gmail');
  t(c.headers['cache-control'] && /no-store/.test(c.headers['cache-control']), 'the open image is never cached');
  await req(A + '/m/?o=' + s4.id);   /* the deposit reminder opened, never clicked */
  /* a send that failed is not counted (as the app notes it) */
  const F = 'f'.repeat(20); fs.appendFileSync(path.join(R, 'sixfold-data/rounds/mail-sends.log'), jl([{ t: 'send', id: F, k: 'signed', at: NOW - 600, v: 'v0', links: ['https://365aeration.com/'] }, { t: 'fail', id: F, at: NOW - 600, stage: 'auth' }]));

  /* ================= 3. Outbox: the numbers under each email ================= */
  let r = await ob('state'); t(r.status === 401, 'Outbox: signed out, nothing');
  r = await req(O + '/outbox-092b0f/api.php?action=signin', { method: 'POST', body: { code: CODE } }); t(r.status === 400, 'Outbox: a POST without X-OB is refused');
  r = await ob('signin', { code: CODE }); t(r.status === 200 && jar, 'Outbox: signed in');
  r = await ob('state'); const SX = r.j && r.j.sixfold; const it = (id) => SX.items.find((x) => x.id === id);
  const af = it('aftercare'); t(af && af.track && af.track.sentAll === 1 && af.track.openedAll === 1 && af.track.clickedAll === 1 && af.track.sent30 === 1, 'aftercare card: 1 sent, 1 opened, 1 clicked');
  t(af.track.clickRate30 === 100 && af.track.scans30 === 4, 'aftercare card: clicked 100%; the 4 scanner visits are left out of the clicks');
  t(/Apple Mail/.test(af.opens) && /clicked in 30 days/.test(af.clicks), 'the Opens line warns about Apple Mail\'s automatic opens; the Clicks line counts clicks');
  t(af.track.links30.length === 1 && af.track.links30[0].what === 'pay link (Square)' && af.track.links30[0].clicks === 2, 'links clicked: the pay link, twice by the one customer (named by kind, never the address)');
  t(af.track.byVersion.length === 1 && af.track.byVersion[0].label === 'Built-in words' && af.track.byVersion[0].active === true, 'by wording: the built-in words, in use');
  t(af.track.recent.length === 1 && af.track.recent[0].opened === true && af.track.recent[0].clicked === true, 'last sends: one row, opened yes, clicked yes');
  const dp = it('deposit'); t(dp.track.sentAll === 1 && dp.track.openedAll === 1 && dp.track.clickedAll === 1, 'deposit reminder card: 1 sent, opened, clicked (the form link)');
  t(it('signed').track.sentAll === 1, 'signed copy card: 1 sent (the failed one is not counted)');
  t(it('followup').track.sentAll === 1 && it('followup').track.openedAll === 0, 'follow-up card: 1 sent, not opened');
  const nl = it('newsletter'); t(nl.track.sentAll === nlS.length && nl.track.byVersion[0].label === '"Test lawn notes"', 'newsletter card: counted per issue, by its subject');
  t(af.editable === true && it('newsletter').editable === false && !it('morning').editable && (it('morning').track || {}).opensOnly === true, 'the four customer emails can be reworded here; the newsletter (its own screen) and internal reports cannot (since 20 Nov an internal report shows its opens only)');
  const trackJson = JSON.stringify(SX.items.map((x) => x.track || null));
  t(!/example\.com|Alpha|Bravo|Echo|square\.link|\/sign\//.test(trackJson), 'the numbers name no customer and show no address');

  /* ================= 4. the words: preview, checks, save, versions, put back ================= */
  r = await ob('sxwords'); const W = r.j; t(W && W.ok && ['aftercare', 'followup', 'deposit', 'signed'].every((k) => W.kinds[k]) && W.kinds.aftercare.active === 'v0', 'Outbox reads the four emails\' words from the app (built-in words in use)');
  t(W.kinds.aftercare.lines.owed.need.includes('balance') && W.kinds.aftercare.lines.pay_text.link === true, 'each line says what it must keep');
  const lines0 = W.kinds.aftercare.now;
  r = await ob('sxpreview', { kind: 'aftercare', lines: { ...lines0, intro: 'Thanks, {first_name}! All done at your place.', subject: 'Lawn tips from {company}' } });
  t(r.j && r.j.ok && r.j.subject === 'Lawn tips from Sixfold 365' && r.j.html.includes('Thanks, Alex! All done at your place.'), 'preview: the made-up customer with the new words (subject and opening line)');
  t(/Pay the \$250 balance/.test(r.j.html) && r.j.text.includes('You can pay it here: https://square.link/u/SAMPLE'), 'preview: the balance, the pay button and the plain-text pay link');
  r = await ob('sxpreview', { kind: 'aftercare', lines: lines0, sample: 'b' }); t(r.j && /Your balance is paid/.test(r.j.html), 'preview, second customer: paid in full');
  r = await ob('sxpreview', { kind: 'nope', lines: {} }); t(r.status === 400, 'preview of an unknown email: refused');
  for (const [k, v, what] of [['pay_text', 'You can pay it here', 'the pay link\'s [brackets] taken out'], ['owed', 'You still owe us.', '{balance} taken out of the balance line'], ['intro', 'Hi {nickname}!', 'an unknown field'],
      ['closing', 'Call us.', '{phone} taken out of the closing'], ['subject', '', 'an empty subject'], ['pay_text', '[pay] or [here]', 'two links'], ['intro', 'Hello {first_name', 'a broken field']]) {
    r = await ob('sxsave', { kind: 'aftercare', lines: { ...lines0, [k]: v } });
    t(r.status === 400 && r.j && r.j.errors && r.j.errors[k], 'save refused: ' + what + ' ("' + (r.j && r.j.errors ? r.j.errors[k] : '') + '")');
  }
  t(!fs.existsSync(path.join(R, 'sixfold-data/rounds/a365-words.json')), 'nothing was saved by the refused saves');
  r = await ob('sxsave', { kind: 'aftercare', lines: lines0 }); t(r.status === 400 && /Nothing changed/.test(r.j.error), 'saving the words in use: "nothing changed"');
  const v1 = { ...lines0, subject: 'Lawn tips from {company}', intro: 'Thanks, {first_name}! All done at your place.', pay_text: '[Pay your balance here]', pay_button: 'Pay {balance} now' };
  r = await ob('sxsave', { kind: 'aftercare', lines: v1, note: 'Shorter opening' }); t(r.status === 200 && r.j.active === 'v1', 'save: version 1, in use');
  const wj = JSON.parse(rd('sixfold-data/rounds/a365-words.json')); const wl = lines('sixfold-data/rounds/a365-words.log').at(-1);
  t(wj.kinds.aftercare.active === 'v1' && wj.kinds.aftercare.versions[0].by === 'Matthew (Outbox)' && wj.kinds.aftercare.versions[0].note === 'Shorter opening', 'kept with who and the note');
  t(wl.by === 'Matthew (Outbox)' && wl.what === 'saved' && wl.v === 'v1' && wl.was === 'v0' && wl.kind === 'aftercare', 'the save is logged (who, which email, from v0 to v1)');
  /* Jen's next aftercare uses the new words */
  const r7 = cli('aftercare', 'jt7'); m = dry().at(-1); const s7 = sends().at(-1);
  t(r7.ok && m.subject === 'Lawn tips from Sixfold 365' && m.html.includes('Thanks, Gus! All done at your place.') && s7.v === 'v1', 'the next aftercare goes with version 1 (subject, opening), and its send says v1');
  t(/>Pay \$300 now<\/a>/.test(m.html) && m.text.includes('Pay your balance here: ' + A + '/m/?c=' + s7.id + '.'), 'the reworded pay button and pay link are there, tracked');
  c = await req(A + '/m/?c=' + s7.id + '.' + s7.links.indexOf(SQ7)); t(c.status === 302 && c.headers.location === SQ7, 'and the pay link in the reworded email lands on its pay link');
  r = await ob('sxwords'); t(r.j.kinds.aftercare.active === 'v1' && r.j.kinds.aftercare.versions.length === 1 && r.j.log.at(-1).v === 'v1', 'Outbox sees version 1 in use and the log');
  r = await ob('state'); const bv = r.j.sixfold.items.find((x) => x.id === 'aftercare').track.byVersion;
  t(bv.length === 2 && bv.find((b) => b.v === 'v1').active && /^Version 1 \(saved .* by Matthew \(Outbox\)\)$/.test(bv.find((b) => b.v === 'v1').label) && !bv.find((b) => b.v === 'v0').active, 'the card compares the two wordings, version 1 in use');
  r = await ob('sxrestore', { kind: 'aftercare', v: 'v9' }); t(r.status === 400, 'put back a version that does not exist: refused');
  r = await ob('sxrestore', { kind: 'aftercare', v: 'v1' }); t(r.status === 400, 'put back the version in use: refused');
  r = await ob('sxrestore', { kind: 'aftercare', v: 'v0' }); t(r.status === 200 && r.j.active === 'v0', 'put back the built-in words');
  t(lines('sixfold-data/rounds/a365-words.log').at(-1).what === 'put back', '... logged');
  const r6 = cli('aftercare', 'jt6'); m = dry().at(-1); t(r6.ok && m.subject === 'Your lawn after today: a few tips from Sixfold 365' && sends().at(-1).v === 'v0', 'the next aftercare after that has the built-in words again (v0)');
  r = await ob('sxrestore', { kind: 'aftercare', v: 'v1' }); t(r.status === 200 && r.j.active === 'v1', 'and version 1 can be put back again');
  r = await ob('sxrestore', { kind: 'aftercare', v: 'v0' });
  /* the other three emails save the same way */
  for (const k of ['followup', 'deposit', 'signed']) { const w = W.kinds[k].now; r = await ob('sxsave', { kind: k, lines: { ...w, greeting: 'Hello {first_name},' } }); t(r.status === 200 && r.j.active === 'v1', k + ': a reworded greeting saves'); }
  r = await ob('sxpreview', { kind: 'followup', lines: { ...W.kinds.followup.now, review: 'Got a minute? [Leave us a review].' } });
  t(r.j.html.includes('Got a minute? <a href="https://g.page/r/TESTREVIEW123/review">Leave us a review</a>.') && r.j.text.includes('Got a minute? Leave us a review: https://g.page/r/TESTREVIEW123/review'), 'follow-up preview: a reworded review line keeps its link (HTML and text)');
  r = await ob('sxsave', { kind: 'deposit', lines: { ...W.kinds.deposit.now, pay_text: 'Pay your deposit on your form.' } }); t(r.status === 400 && r.j.errors.pay_text, 'deposit reminder: a save that drops the form link is refused');
  r = await ob('sxpreview', { kind: 'signed', lines: { ...W.kinds.signed.now, view_text: 'no link here' } }); t(r.j.errors && r.j.errors.view_text && r.j.text.includes('View or print it any time: '), 'signed copy: a preview with a broken line flags it and uses the words in use');

  /* ================= 5. only with the key; never an edition or the practice copy ================= */
  r = await req(A + '/api/rounds.php?action=a365words'); t(r.status === 404, 'the app\'s words door without the key: 404');
  r = await req(A + '/api/rounds.php?action=a365words', { headers: { 'X-Outbox-Key': 'ab'.repeat(32) } }); t(r.status === 404, 'with the wrong key: 404');
  r = await req(A + '/api/rounds.php?action=a365wordssave', { method: 'POST', body: { kind: 'aftercare', lines: {} }, headers: { 'X-Outbox-Key': KEY.slice(0, 40) } }); t(r.status === 404, 'with part of the key: 404');
  fs.cpSync(path.join(PUB, 'api'), path.join(PUB, 'apipr'), { recursive: true });
  const pr = path.join(PUB, 'apipr', 'rounds.php'); fs.writeFileSync(pr, fs.readFileSync(pr, 'utf8').replace('const PRACTICE = false;', 'const PRACTICE = true;'));
  t(cli('trackon', '', 'apipr').on === false, 'the practice copy never counts (its emails are never sent anyway)');
  mk('sixfold-data/rounds/company.json', JSON.stringify({ ...CO, a365: null }));
  t(cli('trackon').on === false, 'an edition (no a365) never counts');
  r = await req(A + '/api/rounds.php?action=a365words', { headers: { 'X-Outbox-Key': KEY } }); t(r.status === 404, 'an edition answers the words door with 404, key or not');
  mk('sixfold-data/rounds/company.json', JSON.stringify(CO));
  /* ================= 6. the page itself, in headless Chrome: the numbers under the cards, the editor, a live preview ================= */
  const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  if (fs.existsSync(CHROME)) {
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'mschrome-')); const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9241', '--user-data-dir=' + prof, '--no-first-run', '--disable-gpu', '--window-size=1280,1400', 'about:blank'], { stdio: 'ignore' });
    let ws;
    try {
      let tl = null; for (let i = 0; i < 40 && !tl; i++) { await sleep(250); try { tl = await (await fetch('http://127.0.0.1:9241/json/list')).json(); } catch {} }
      const pg = tl.find((x) => x.type === 'page'); ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
      let id = 0; const wait = {}; const errs = [];
      ws.onmessage = (mm) => { const d = JSON.parse(mm.data); if (d.id && wait[d.id]) { wait[d.id](d); delete wait[d.id]; } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); };
      const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; wait[n] = r; ws.send(JSON.stringify({ id: n, method, params })); });
      const ev = async (e) => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
      const shot = async (name) => { const s = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); if (process.env.SHOTS && s.result) fs.writeFileSync(path.join(process.env.SHOTS, name), Buffer.from(s.result.data, 'base64')); };
      await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
      await cdp('Network.setCookie', { name: 'outbox', value: jar.split('=')[1], domain: '127.0.0.1', path: '/outbox-092b0f/' });
      await cdp('Page.navigate', { url: O + '/outbox-092b0f/?tab=sixfold' });
      let ready = false; for (let i = 0; i < 40 && !ready; i++) { await sleep(300); ready = await ev('!!document.querySelector("[data-ed=aftercare]")'); }
      t(ready, 'page: the Sixfold section shows a "Change the words" button on the aftercare card');
      const cardTxt = await ev('[...document.querySelectorAll("section.card")].find(s=>s.querySelector("[data-ed=aftercare]")).innerText');
      t(/opened, 30 days/.test(cardTxt) && /clicked, 30 days/.test(cardTxt) && /Apple Mail/.test(cardTxt) && /By wording/.test(cardTxt) && /Last \d+ sent/.test(cardTxt), 'page: the aftercare card shows sent, opened, clicked, the Apple Mail note, by wording and the last sends');
      t((await ev('document.querySelectorAll("[data-ed]").length')) === 4, 'page: four emails can be reworded (aftercare, follow-up, deposit reminder, signed copy)');
      await shot('outbox-sixfold.png');
      await ev('document.querySelector("[data-ed=aftercare]").click()');
      let open = false; for (let i = 0; i < 40 && !open; i++) { await sleep(300); open = await ev('!document.querySelector("#ed").classList.contains("hide") && (document.querySelector("#edfr")||{}).srcdoc?.length>500'); }
      t(open, 'page: the editor opens with a preview of the made-up customer');
      t(/Jen's customers/.test(await ev('document.querySelector("#ed .warn").innerText')), 'page: the editor says plainly that the words go to Jen\'s customers');
      t((await ev('document.querySelectorAll("#ed textarea").length')) === Object.keys(W.kinds.aftercare.lines).length, 'page: one box per line');
      await ev('(()=>{const a=document.querySelector("#ln-intro");a.value="Browser test opening, {first_name}.";a.dispatchEvent(new Event("input"));document.querySelector("#edpv").click()})()');
      let pv2 = false; for (let i = 0; i < 30 && !pv2; i++) { await sleep(300); pv2 = await ev('(document.querySelector("#edfr").srcdoc||"").includes("Browser test opening, Alex.")'); }
      t(pv2, 'page: a changed line shows in the preview after Update the preview');
      await ev('(()=>{const a=document.querySelector("#ln-owed");a.value="You owe us.";a.dispatchEvent(new Event("input"));document.querySelector("#edpv").click()})()');
      let er = ''; for (let i = 0; i < 30 && !er; i++) { await sleep(300); er = await ev('document.querySelector("[data-err=owed]").textContent'); }
      t(/must keep \{balance\}/.test(er), 'page: a line that drops a field it must keep is marked in red ("' + er + '")');
      await shot('outbox-editor.png');
      t((await ev('document.querySelectorAll("[data-rv]").length')) >= 1 && /Versions/.test(await ev('document.querySelector("#ed").innerText')), 'page: the versions table with Put this back');
      await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}))'); await sleep(300);
      t(await ev('document.querySelector("#ed").classList.contains("hide")'), 'page: Escape closes the editor (nothing saved)');
      t(JSON.parse(rd('sixfold-data/rounds/a365-words.json')).kinds.aftercare.active === 'v0', 'page: closing the editor saved nothing');
      t(errs.length === 0, 'page: no script errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
    } catch (e) { t(false, 'browser stage: ' + e.message); }
    finally { try { ws && ws.close(); } catch {} ch.kill(); await sleep(500); for (let i = 0; i < 50; i++) { try { fs.rmSync(prof, { recursive: true, force: true }); break; } catch { await sleep(200); } } }
  } else console.log('  (no Chrome: page stage skipped)');
  /* nothing in this run left the computer: every send went to the dry-run log */
  t(dry().length > 10 && dry().every((x) => /@example\.com$/.test(x.to)), 'every email of this run is in the dry-run log, to made-up @example.com addresses only');
} catch (e) { t(false, 'ran: ' + (e.stack || e.message)); }
finally {
  for (const p of procs) try { p.kill(); } catch {}
  await sleep(300); try { fs.rmSync(R, { recursive: true, force: true }); } catch {}
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
