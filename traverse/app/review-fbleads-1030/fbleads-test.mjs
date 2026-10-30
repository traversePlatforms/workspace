/* Facebook lead ads into the Pipeline (2026-10-30): Setup › Facebook leads on an edition, against a local stand-in for Facebook (fbmock/router.php
   on 8813; the harness server must run with TRAV_META_MOCK=http://127.0.0.1:8813). Connect (Facebook Login for Business: dialog, code, token,
   debug_token, long-lived swap, Pages), forms and matching, who gets leads, the 5-minute run from the command line (new leads, dedupe, paging,
   assignment in turns, alerts), a dead token, Check now, disconnect, the token paste (Traverse only), permissions, Claude Check, backups, and
   Sixfold untouched. Throwaway harness codes only, never printed; made-up people only. Screenshots to traverse/app/review-fbleads-1030/. */
import { readFileSync, writeFileSync, existsSync, copyFileSync, unlinkSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { DIR, ORIGIN, R, t, call, signin, mode, browser, sleep, jars } from './lib1030.mjs';
const SHOTS = 'C:/Users/Surge Inc/Desktop/claude test 2/.claude/worktrees/agent-a49eade0b67c09067/traverse/app/review-fbleads-1030';
const MOCK = DIR + '/fbmock', PRIV = DIR + '/sixfold-private', DATA = DIR + '/sixfold-data/rounds', LEADS = DIR + '/sixfold-data/leads', SHARED = DIR + '/traverse-shared';
const post = (w, a, b) => call(w, a, null, b);
const lines = (f) => existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const calls = () => lines(MOCK + '/calls.log');
const ago = (min) => new Date(Date.now() - min * 60000).toISOString().replace(/\.\d+Z$/, '+0000');
const fd = (o) => Object.entries(o).map(([name, v]) => ({ name, values: [v] }));
/* the cron's command, stdout and stderr together (what SiteGround would email) */
const poll = () => { const r = spawnSync('php', ['-d', 'memory_limit=2048M', DIR + '/sixfold-tools/fb-leads.php', '--api=rounds.php'], { encoding: 'utf8', env: { ...process.env, TRAV_META_MOCK: 'http://127.0.0.1:8813', SIXFOLD_API_DIR: DIR + '/www/api', SIXFOLD_PRIVATE_DIR: PRIV } }); return (r.status ? 'EXIT ' + r.status + ' ' : '') + (r.stdout || '') + (r.stderr || ''); };
const VER = (readFileSync(DIR + '/www/api/rounds.php', 'utf8').match(/const TERMS_VERSION = '([^']*)'/) || [])[1];
const QS = [{ key: 'full_name', label: 'Full name', type: 'FULL_NAME' }, { key: 'phone_number', label: 'Phone number', type: 'PHONE' }, { key: 'email', label: 'Email', type: 'EMAIL' },
  { key: 'street_address', label: 'Street address', type: 'STREET_ADDRESS' }, { key: 'city', label: 'City', type: 'CITY' }, { key: 'roof_age', label: 'How old is your roof?', type: 'CUSTOM' }, { key: 'budget', label: 'Budget?', type: 'CUSTOM' }];
function freshState() {
  return { pages: {
    1110001: { name: 'Acme Roofing (test)', token: 'PAGETOK1', forms: {
      9001: { name: 'Free roof inspection', questions: QS, leads: [
        { id: 'L1', created_time: ago(50), ad_name: 'Hail fall 2026 A', campaign_name: 'Hail fall', form_id: '9001', field_data: fd({ full_name: 'Ann Example', phone_number: '+13035550101', email: 'ann@example.com', street_address: '1 Test Way', city: 'Testville', roof_age: '15 years', budget: 'secret budget' }) },
        { id: 'L2', created_time: ago(40), ad_name: 'Hail fall 2026 B', campaign_name: 'Hail fall', form_id: '9001', field_data: fd({ full_name: 'Bob Sample', phone_number: '+13035550102', email: 'bob@example.com', roof_age: '8', budget: 'x' }) },
        { id: 'L3', created_time: ago(30), ad_name: 'Hail fall 2026 A', campaign_name: 'Hail fall', form_id: '9001', field_data: fd({ full_name: 'Old Lead Again', phone_number: '+13035550103', email: 'old@example.com', roof_age: '20' }) },
        { id: 'L4', created_time: ago(20), is_organic: true, form_id: '9001', field_data: fd({ full_name: 'Cara Test', phone_number: '(303) 555-0104', email: 'cara@example.com' }) }] },
      9002: { name: 'Old offer (archived)', status: 'ARCHIVED', questions: QS.slice(0, 3), leads: [{ id: 'L9', created_time: ago(10), field_data: fd({ full_name: 'Never Comes', phone_number: '3035550199' }) }] } } },
    2220002: { name: 'Acme Gutters (test)', token: 'PAGETOK2', tasks: ['ANALYZE'], forms: { 9100: { name: 'Gutter quote', questions: QS.slice(0, 3), leads: [{ id: 'G1', created_time: ago(15), field_data: fd({ full_name: 'Gus Gutter', phone_number: '3035550201' }) }] } } } } };
}
const setState = (fn) => { const s = JSON.parse(readFileSync(MOCK + '/state.json', 'utf8')); fn(s); writeFileSync(MOCK + '/state.json', JSON.stringify(s, null, 1)); };
async function shot(B, n) {
  mkdirSync(SHOTS, { recursive: true });
  const hgt = await B.js('Math.min(document.documentElement.scrollHeight, 5000)'), wd = await B.js('document.documentElement.clientWidth');
  writeFileSync(`${SHOTS}/${n}.png`, Buffer.from((await B.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: wd, height: hgt, scale: 1 }, captureBeyondViewport: true })).data, 'base64'));
}
const openFb = async (B, who, w, h) => {
  await B.openAs(who, w, h); await B.waitFor(`!!document.querySelector('#barin') && document.querySelector('#barin').textContent.length > 0`, 'app up', 20000); await sleep(800);
  await B.send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/?fbleads=lost' }); await B.waitFor(`!!document.querySelector('.fbset') && !document.querySelector('.fbset .skel')`, 'fb screen', 15000); await sleep(300);
};

/* ---------------------------------------------------------------- setup */
mode('edition'); execFileSync('node', [DIR + '/preaccept.cjs']);
for (const f of ['fb-leads.json', 'fb-leads-state.json', 'fb-leads-oauth.json']) rmSync(PRIV + '/' + f, { force: true });
rmSync(DATA + '/fb-leads.json', { force: true }); rmSync(DATA + '/fbleads.log', { force: true });
mkdirSync(SHARED, { recursive: true }); rmSync(SHARED + '/meta-app.json', { force: true });
const madeKey = !existsSync(SHARED + '/mail-oauth.key'); if (madeKey) writeFileSync(SHARED + '/mail-oauth.key', '7'.repeat(64));
writeFileSync(MOCK + '/state.json', JSON.stringify(freshState(), null, 1)); writeFileSync(MOCK + '/calls.log', '');
/* someone already in the Pipeline with L3's phone */
mkdirSync(LEADS, { recursive: true });
writeFileSync(LEADS + '/leads.log', JSON.stringify({ id: 'w20261001120000abc123', src: 'phone', at: Math.floor(Date.now() / 1000) - 86400 * 20, need: 'A quote', name: 'Old Lead', phone: '303-555-0103', email: '', town: '', msg: '', by: 'Test Admin' }) + '\n');
const B = await browser(10391);
try {
  const a = await signin('admin', '222222'); t(a.ok && a.role === 'admin', 'the admin signs in'); let SESS = jars.admin;   /* call() keeps the last Set-Cookie: the Connect cookie would replace the session */
  await signin('super', '777777');

  /* ---- not set up on the server yet ---- */
  console.log('Before the Meta app is on the server');
  let j = await call('admin', 'fbleads'); t(j.ok && j.conn.ready === false && j.conn.on === false, 'fbleads answers: not ready, not connected');
  j = await post('admin', 'fboauth', {}); jars.admin = SESS; t(j.ok && j.ready === false, 'Connect Facebook says not ready (no meta-app.json)');
  await openFb(B, 'admin', 1280, 900); await shot(B, '01-not-connected-desktop');
  t(await B.js(`[...document.querySelectorAll('.fbset button')].some(b=>/Connect Facebook/.test(b.textContent))`), 'the screen offers Connect Facebook');
  t(!(await B.js(`!!document.querySelector('.fbset details.mailmore')`)), 'no token box for a client admin');
  await B.js(`[...document.querySelectorAll('.fbset button')].find(b=>/Connect Facebook/.test(b.textContent)).click()`); await sleep(800);
  t(/Not available yet/.test(await B.js(`(document.querySelector('#toast')||document.body).textContent`)), 'pressing it says not available yet');

  /* ---- Connect Facebook (Facebook Login for Business) ---- */
  console.log('Connect Facebook');
  writeFileSync(SHARED + '/meta-app.json', JSON.stringify({ app_id: '1234567890', app_secret: 'abcdef0123456789abcdef0123456789', config_id: '555000111' }));
  j = await call('admin', 'fbleads'); t(j.conn.ready === true, 'ready once meta-app.json and the key are there');
  j = await post('admin', 'fboauth', {}); jars.admin = SESS; t(j.ok && j.ready && /^http:\/\/127\.0\.0\.1:8813\/dialog\?/.test(j.url), 'fboauth gives the dialog address');
  const u = new URL(j.url);
  t(u.searchParams.get('config_id') === '555000111' && u.searchParams.get('response_type') === 'code' && u.searchParams.get('override_default_response_type') === 'true' && !u.searchParams.get('scope'), 'Facebook Login for Business: config_id, response_type=code, no scope list');
  t(u.searchParams.get('redirect_uri') === ORIGIN + '/api/fb-oauth.php' && u.searchParams.get('client_id') === '1234567890', 'redirect_uri is the one callback; client_id is the app');
  const browserCookie = jars.admin; const oauthCk = (await (await fetch(ORIGIN + '/api/rounds.php?action=fboauth', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: jars.admin }, body: '{}' })).headers.get('set-cookie') || '');
  t(/trav_fb_[0-9a-f]{10}=/.test(oauthCk) && /path=\/api\/fb-oauth\.php/i.test(oauthCk) && /httponly/i.test(oauthCk), 'a browser cookie only the callback sees');
  /* the second fboauth replaced the first record: the first link no longer works */
  const d1 = await fetch(j.url, { redirect: 'manual' }); const back1 = d1.headers.get('location');
  const ckv = oauthCk.split(';')[0];
  let cb = await fetch(back1, { redirect: 'manual', headers: { Cookie: ckv } }); t(cb.status === 400 && /run out|already used/.test(await cb.text()), 'an older Connect link is refused (one at a time, used once)');
  j = await post('admin', 'fboauth', {}); jars.admin = SESS; const ck2 = '';
  const r2 = await fetch(ORIGIN + '/api/rounds.php?action=fboauth', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: jars.admin }, body: '{}' }); const j2 = await r2.json(); const ck = (r2.headers.get('set-cookie') || '').split(';')[0];
  const d2 = await fetch(j2.url, { redirect: 'manual' }); const back2 = d2.headers.get('location');
  t(/\/api\/fb-oauth\.php\?code=CODE/.test(back2), 'Facebook sends them back with a code');
  cb = await fetch(back2, { redirect: 'manual' }); t(cb.status === 302 && /fbleads=browser/.test(cb.headers.get('location') || ''), 'without the browser cookie: back with fbleads=browser, nothing saved');
  t(!existsSync(PRIV + '/fb-leads.json'), 'no connection saved');
  const r3 = await fetch(ORIGIN + '/api/rounds.php?action=fboauth', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: jars.admin }, body: '{}' }); const j3 = await r3.json(); const ck3 = (r3.headers.get('set-cookie') || '').split(';')[0];
  const back3 = (await fetch(j3.url, { redirect: 'manual' })).headers.get('location');
  cb = await fetch(back3, { redirect: 'manual', headers: { Cookie: ck3 } }); const loc = cb.headers.get('location') || '';
  t(cb.status === 302 && loc === ORIGIN + '/summit-de59ae83/?fbleads=connected&n=2', 'connected: back to the app with fbleads=connected&n=2 (' + loc.replace(ORIGIN, '') + ')');
  cb = await fetch(back3, { redirect: 'manual', headers: { Cookie: ck3 } }); t(cb.status === 400, 'the same link a second time is refused');
  const cl = calls(); const swap = cl.find((c) => c.p === 'graph/oauth/access_token' && c.q.code); const ll = cl.find((c) => c.p === 'graph/oauth/access_token' && c.q.grant_type === 'fb_exchange_token');
  t(swap && swap.q.redirect_uri === ORIGIN + '/api/fb-oauth.php' && swap.q.client_secret, 'the code is swapped server to server with the app secret');
  t(!!ll, 'a short user token is swapped for a long-lived one');
  t(cl.some((c) => c.p === 'graph/debug_token' && c.q.input_token === 'SHORTUSER'), 'debug_token checks the token type and permissions');
  const privTxt = readFileSync(PRIV + '/fb-leads.json', 'utf8');
  t(!/LONGUSER|PAGETOK|SHORTUSER/.test(privTxt) && /"tok":"f1\./.test(privTxt), 'tokens are sealed in the private folder, never plain');
  j = await call('admin', 'fbleads');
  t(j.conn.on && j.conn.pages.length === 2 && j.conn.who === 'Pat Admin' && j.conn.kind === 'USER' && j.conn.via === 'login', 'fbleads: connected as Pat Admin, 2 Pages, a user token' + (j.conn.on ? '' : ' ' + JSON.stringify(j).slice(0, 300)));
  t(!JSON.stringify(j).match(/PAGETOK|LONGUSER|f1\./), 'the screen gets no token');
  t(j.set.pages['1110001'] && j.set.pages['1110001'].on === false && j.set.pages['2220002'].on === false, 'two Pages found: both start off until ticked');
  t(j.conn.pages.find((p) => p.id === '2220002').leads === false, 'a Page where the role has no leads task is flagged');

  /* ---- the screen after connecting, back from Facebook ---- */
  await B.openAs('admin', 1280, 900); await B.waitFor(`!!document.querySelector('#barin') && document.querySelector('#barin').textContent.length > 0`, 'app', 20000);
  await B.send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/?fbleads=connected&n=2' });
  await B.waitFor(`!!document.querySelector('.fbset .fbpage')`, 'back from Facebook opens the screen', 20000); await sleep(500);
  t(/Facebook connected/.test(await B.js(`(document.querySelector('#toast')||document.body).textContent`)), 'back from Facebook: "Facebook connected" and the screen opens');
  t((await B.js(`location.search`)) === '', 'the ?fbleads= is taken off the address');
  await shot(B, '02-connected-desktop');

  /* ---- forms and matching ---- */
  console.log('Forms and matching');
  j = await call('admin', 'fbforms', { page: '1110001' });
  t(j.ok && j.forms.length === 2 && j.forms[0].questions.length === 7, 'fbforms lists the Page\'s forms with their questions');
  const qf = Object.fromEntries(j.forms[0].questions.map((x) => [x.key, x.field]));
  t(qf.full_name === 'name' && qf.phone_number === 'phone' && qf.email === 'email' && qf.street_address === 'address' && qf.city === 'address' && qf.roof_age === 'notes', 'a sensible match is filled in: name, phone, email, address, notes');
  j = await call('admin', 'fbforms', { page: '9999999' }); t(!j.ok, 'a Page outside the connection is refused');
  /* the UI: tick the Page, show the forms, pick Leave out for Budget */
  await B.js(`document.querySelector('.fbpage input[type=checkbox]').click()`);
  await B.js(`[...document.querySelectorAll('.fbpage button.lnk')].find(b=>/Show the forms/.test(b.textContent)).click()`);
  await B.waitFor(`document.querySelectorAll('.fbq select').length >= 7`, 'questions shown', 15000);
  await B.js(`(()=>{const l=[...document.querySelectorAll('.fbq')].find(x=>/Budget/.test(x.textContent));const s=l.querySelector('select');s.value='skip';s.dispatchEvent(new Event('change'));})()`);
  await B.js(`[...document.querySelectorAll('.fbset .dwlen button')].find(b=>b.textContent==='Take turns').click()`); await sleep(200);
  await B.js(`[...document.querySelectorAll('.fbwho .permrow')].forEach(r=>{ if (/Test Crew|Test Admin/.test(r.textContent)) r.querySelector('input').click(); })`);
  await B.js(`[...document.querySelectorAll('.fbset .lookrow .aseg button')].find(b=>b.textContent==='On').click()`);
  await shot(B, '03-forms-and-turns-desktop');
  await B.js(`[...document.querySelectorAll('.fbset button.save')].find(b=>b.textContent==='Save').click()`); await sleep(1200);
  j = await call('admin', 'fbleads');
  t(j.set.pages['1110001'].on === true && j.set.pages['1110001'].all === true && j.set.pages['2220002'].on === false, 'Save keeps the ticked Page (all its forms)');
  t(j.set.pages['1110001'].forms['9001'].map.budget === 'skip' && j.set.pages['1110001'].forms['9001'].map.roof_age === 'notes', 'Save keeps the matching (Budget left out)');
  t(j.set.assign.mode === 'rr' && j.set.assign.pool.length === 2 && j.set.alert === true, 'Save keeps Take turns between two people and alerts on');
  /* validation */
  j = await post('admin', 'fbleadsset', { assign: { mode: 'rr', pool: ['Test Crew'] } }); t(!j.ok && /two people/.test(j.error), 'taking turns needs two people');
  j = await post('admin', 'fbleadsset', { assign: { mode: 'one', who: 'Nobody Here' } }); t(!j.ok, 'one person must have a sign-in');
  j = await post('admin', 'fbleadsset', { pages: { 1110001: { on: true, forms: { 9001: { on: true, map: { budget: 'password' } } } } } }); t(!j.ok, 'a field that is not on the list is refused');
  j = await post('admin', 'fbleadsset', { pages: { 3330003: { on: true } } }); t(j.ok && !j.set.pages['3330003'], 'a Page outside the connection is ignored');

  /* ---- the 5-minute run ---- */
  console.log('The 5-minute run');
  let out = poll(); t(/1 noted|3 new/.test(out), 'fb-leads.php: ' + out.trim().replace(/\n/g, ' | '));
  const L = lines(LEADS + '/leads.log'); const fb = L.filter((x) => x.src === 'meta');
  t(fb.length === 3, '3 new leads (L1, L2, L4); L3 has a phone already in the Pipeline; the archived form is skipped: ' + fb.map((x) => x.name).join(', '));
  const ann = fb.find((x) => x.name === 'Ann Example');
  t(ann && ann.by === 'Facebook ad' && ann.ext === 'L1' && ann.need === 'Free roof inspection' && ann.form === 'Free roof inspection' && ann.ad === 'Hail fall 2026 A', 'source Meta ad, by "Facebook ad", form and ad names kept');
  t(ann && /Facebook ad: Hail fall 2026 A/.test(ann.msg) && /Campaign: Hail fall/.test(ann.msg) && /How old is your roof: 15 years/.test(ann.msg) && !/secret budget/.test(ann.msg), 'notes: the ad, campaign, the roof-age answer; Budget left out');
  t(ann && ann.town === '1 Test Way, Testville' && ann.phone === '+13035550101' && ann.email === 'ann@example.com', 'address, phone and email filled from the matching');
  const cara = fb.find((x) => x.name === 'Cara Test'); t(cara && /not from an ad/.test(cara.msg), 'an organic form fill says it was not from an ad');
  const st = lines(LEADS + '/leadst.log');
  const owners = fb.map((x) => (st.find((s) => s.id === x.id && 'owner' in s) || {}).owner);
  t(owners.filter(Boolean).length === 3 && new Set(owners).size === 2, 'taking turns: the three leads alternate between the two people (' + owners.join(', ') + ')');
  t(st.some((s) => s.id === 'w20261001120000abc123' && /Filled in a Facebook form again/.test(s.note || '')), 'the existing lead with L3\'s phone gets a note, not a second lead');
  t(!fb.some((x) => x.name === 'Gus Gutter'), 'the unticked Page brings nothing');
  t(calls().some((c) => /after=2/.test(JSON.stringify(c.q)) || c.q.after === '2'), 'paging: the second page of leads is fetched');
  const feedOf = () => readdirSync(DATA + '/alerts').filter((x) => x.endsWith('.json')).map((x) => { try { return JSON.parse(readFileSync(DATA + '/alerts/' + x, 'utf8')); } catch { return null; } });
  const allFeed = JSON.stringify(feedOf());
  t((allFeed.match(/New Facebook lead for you/g) || []).length >= 3, 'alerts on: each person is alerted for their lead');
  out = poll(); t(lines(LEADS + '/leads.log').filter((x) => x.src === 'meta').length === 3, 'a second run adds nothing (the same lead ids)');
  const log1 = lines(DATA + '/fbleads.log'); t(log1.some((x) => x.what === 'run' && x.added === 3) && !JSON.stringify(log1).match(/Ann|example\.com/), 'fbleads.log keeps counts and lead ids, no names or contacts');
  /* a new lead arrives; Check now */
  setState((s) => s.pages['1110001'].forms['9001'].leads.push({ id: 'L5', created_time: ago(1), ad_name: 'Hail fall 2026 A', field_data: fd({ full_name: 'Dee New', phone_number: '3035550105' }) }));
  j = await post('admin', 'fbpollnow', {}); t(j.ok && j.added === 1, 'Check now brings the new lead in at once');
  /* the "one person" mode and no alert */
  j = await post('admin', 'fbleadsset', { assign: { mode: 'one', who: 'Test Crew' }, alert: false }); t(j.ok && j.set.assign.mode === 'one' && !j.set.alert, 'One person, alerts off');
  setState((s) => s.pages['1110001'].forms['9001'].leads.push({ id: 'L6', created_time: ago(1), field_data: fd({ full_name: 'Eve One', email: 'eve@example.com' }) }));
  const feedBefore = (JSON.stringify(feedOf()).match(/Eve One/g) || []).length;
  poll(); const eve = lines(LEADS + '/leads.log').find((x) => x.name === 'Eve One');
  t(eve && lines(LEADS + '/leadst.log').some((s) => s.id === eve.id && s.owner === 'Test Crew'), 'one person: the lead is theirs');
  t((JSON.stringify(feedOf()).match(/Eve One/g) || []).length === feedBefore, 'alerts off: nobody is alerted');
  /* the newest lead is someone already here: noted once, not again in the next run's minute of overlap */
  setState((s) => s.pages['1110001'].forms['9001'].leads.push({ id: 'L8', created_time: ago(0), field_data: fd({ full_name: 'Old Lead Third Time', phone_number: '303.555.0103' }) }));
  poll(); poll();
  t(lines(LEADS + '/leadst.log').filter((s) => s.id === 'w20261001120000abc123' && /Facebook form again/.test(s.note || '')).length === 2, 'a repeat form fill is noted once, even when the next run looks at it again');
  /* a field Meta refuses: the plain fields */
  setState((s) => { s.badfield = true; s.pages['1110001'].forms['9001'].leads.push({ id: 'L7', created_time: ago(-2), field_data: fd({ full_name: 'Fay Plain', phone_number: '3035550107' }) }); });
  poll(); t(lines(LEADS + '/leads.log').some((x) => x.name === 'Fay Plain'), 'when Meta refuses an extra field, the run asks again with the plain ones');
  setState((s) => { delete s.badfield; s.leadsErr = true; });
  out = poll(); t(/Leads Access/.test(out), 'a leads permission error is said once on the command line');
  out = poll(); t(!/Leads Access/.test(out), '...and not again the next run');
  j = await call('admin', 'fbleads'); t(j.run.errors.length === 1 && /Leads Access/.test(j.run.errors[0]), 'the screen shows Facebook\'s error');
  setState((s) => { delete s.leadsErr; });
  poll();
  /* the token dies */
  setState((s) => { s.dead = true; });
  out = poll(); t(/needs reconnecting/.test(out), 'a dead token: the command line says so once');
  j = await call('admin', 'fbleads'); t(!j.conn.on && j.conn.lost, 'the screen says Needs reconnecting');
  t(/Facebook leads need reconnecting/.test(JSON.stringify(feedOf())), 'the admins get an alert in the app');
  out = poll(); t(!/needs reconnecting/.test(out), 'not said again every 5 minutes');
  await openFb(B, 'admin', 390, 844); await shot(B, '04-needs-reconnect-phone');
  t(await B.js(`[...document.querySelectorAll('.fbset button')].some(b=>/Connect Facebook again/.test(b.textContent))`), 'the screen offers Connect Facebook again');
  setState((s) => { delete s.dead; });

  /* ---- the token paste (Traverse only) and a business integration token ---- */
  console.log('Token paste and system-user tokens');
  j = await post('admin', 'fbleadstoken', { token: 'SYSTEMTOK' + 'x'.repeat(40) }); t(j._status === 403, 'a client admin cannot paste a token');
  j = await post('super', 'fbleadstoken', { token: 'short' }); t(!j.ok, 'a token that does not look like one is refused');
  j = await post('super', 'fbleadstoken', { token: 'BADTOKEN' + 'z'.repeat(40) }); t(!j.ok && /did not accept/.test(j.error), 'a token Facebook refuses is not saved');
  j = await post('super', 'fbleadstoken', { token: 'PAGETOK1' + 'y'.repeat(40) });
  t(j.ok && j.pages === 1 && j.conn.kind === 'PAGE' && j.conn.via === 'token', 'one Page\'s own token: that Page');
  j = await post('super', 'fbleadstoken', { token: 'SYSTEMTOK' + 'x'.repeat(40) });
  t(j.ok && j.pages === 2 && j.conn.kind === 'SYSTEM_USER' && j.conn.who === 'Traverse system user', 'a system user\'s token: its Pages');
  t(!calls().slice(-4).some((c) => c.proof), 'a pasted token is sent without appsecret_proof (it may be another app\'s)');
  out = poll(); t(/1 new|new/.test(out) || lines(LEADS + '/leads.log').some((x) => x.name === 'Gus Gutter') === false, 'the pasted connection runs: ' + out.trim());
  await openFb(B, 'super', 1280, 900);
  t(await B.js(`!!document.querySelector('.fbset details.mailmore')`), 'Traverse sees "Connect with a token"');
  await shot(B, '05-super-token-desktop');
  /* disconnect */
  console.log('Disconnect');
  const rvBefore = (JSON.parse(readFileSync(MOCK + '/state.json', 'utf8')).revoked || []).length;
  j = await post('admin', 'fbleadsoff', {}); t(j.ok && !j.conn.on, 'Disconnect');
  t(!existsSync(PRIV + '/fb-leads.json') && !existsSync(PRIV + '/fb-leads-state.json'), 'every token and the run state are deleted');
  t((JSON.parse(readFileSync(MOCK + '/state.json', 'utf8')).revoked || []).length === rvBefore + 1, 'Traverse\'s permissions are removed at Facebook (DELETE /me/permissions)');
  t(existsSync(DATA + '/fb-leads.json'), 'the choices stay for a reconnect');
  out = poll(); t(out.trim() === '', 'not connected: the 5-minute run says nothing (and does not load the app)');
  /* a business integration system user token (FLfB "System-user access token" configuration) */
  setState((s) => { s.bisu = true; });
  const r4 = await fetch(ORIGIN + '/api/rounds.php?action=fboauth', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: jars.admin }, body: '{}' }); const j4 = await r4.json(); const ck4 = (r4.headers.get('set-cookie') || '').split(';')[0];
  const b4 = (await fetch(j4.url, { redirect: 'manual' })).headers.get('location'); cb = await fetch(b4, { redirect: 'manual', headers: { Cookie: ck4 } });
  j = await call('admin', 'fbleads'); t(/connected/.test(cb.headers.get('location') || '') && j.conn.kind === 'SYSTEM_USER' && j.set.pages['1110001'].on === true, 'a business integration token connects; the earlier choices come back');
  t(!calls().slice(-12).some((c) => c.q.grant_type === 'fb_exchange_token'), 'a system-user token is not swapped (it never expires)');
  /* permission refused on Facebook's screen */
  setState((s) => { delete s.bisu; s.scopes = ['pages_show_list']; });
  const r5 = await fetch(ORIGIN + '/api/rounds.php?action=fboauth', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: jars.admin }, body: '{}' }); const j5 = await r5.json(); const ck5 = (r5.headers.get('set-cookie') || '').split(';')[0];
  cb = await fetch((await fetch(j5.url, { redirect: 'manual' })).headers.get('location'), { redirect: 'manual', headers: { Cookie: ck5 } });
  t(/fbleads=noscope/.test(cb.headers.get('location') || ''), 'leads_retrieval not granted: back with fbleads=noscope');
  j = await call('admin', 'fbleads'); t(j.conn.kind === 'SYSTEM_USER', '...and the working connection is kept');
  setState((s) => { delete s.scopes; s.deny = true; });
  const r6 = await fetch(ORIGIN + '/api/rounds.php?action=fboauth', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: jars.admin }, body: '{}' }); const j6 = await r6.json(); const ck6 = (r6.headers.get('set-cookie') || '').split(';')[0];
  cb = await fetch((await fetch(j6.url, { redirect: 'manual' })).headers.get('location'), { redirect: 'manual', headers: { Cookie: ck6 } });
  t(/fbleads=denied/.test(cb.headers.get('location') || ''), 'Cancel on Facebook: back with fbleads=denied');
  setState((s) => { delete s.deny; });

  /* ---- permissions, Claude Check, view-as ---- */
  console.log('Permissions');
  const U = 'abcdefghij'.split('').sort(() => Math.random() - 0.5).slice(0, 4).join('');
  const mg = await post('admin', 'accountadd', { name: 'Fb Manager ' + U, role: 'manager' });
  await signin('mgr', mg.code); if (VER) await post('mgr', 'termsaccept', { terms: VER, agreement: VER });
  j = await call('mgr', 'fbleads'); t(j._status === 403, 'a manager does not have it by default' + (j._status === 403 ? '' : ' ' + JSON.stringify(j).slice(0, 200) + ' accountadd ok=' + mg.ok + ' ' + (mg.error || '')));
  j = await post('admin', 'permset', { role: 'manager', perms: { 'set.fbleads': true } }); t(j.ok, 'the admin gives managers "Facebook lead ads"');
  j = await call('mgr', 'fbleads'); t(j.ok && j.conn.on, 'now the manager opens it');
  j = await post('mgr', 'fbleadsoff', {}); t(j.ok, '...and can disconnect');
  j = await post('mgr', 'fbleadstoken', { token: 'x'.repeat(50) }); t(j._status === 403, 'the token paste stays Traverse\'s');
  await post('admin', 'permset', { role: 'manager', reset: 1 });
  const cat = await call('admin', 'perms'); t(cat.ok && cat.list.some((p) => p.k === 'set.fbleads' && p.admin), 'Roles and permissions lists Facebook lead ads');
  await signin('cc', '444444');
  j = await call('cc', 'fbleads'); t(j.ok, 'Claude Check can look');
  j = await post('cc', 'fbleadsset', { alert: true }); t(j._status === 403 && j.why === 'readonly', 'Claude Check cannot save');
  j = await call('crew0', 'fbleads'); t(j._status === 401 || j._status === 403, 'signed out or crew: no');

  /* ---- backups ---- */
  console.log('Backups');
  j = await post('super', 'fbleadstoken', { token: 'SYSTEMTOK' + 'x'.repeat(40) }); t(j.ok, 'connected again (token) for the rest');
  await post('admin', 'fbleadsset', { alert: true });
  const bk = await fetch(ORIGIN + '/api/rounds.php?action=backup', { headers: { Cookie: jars.admin } }); const bj = await bk.json();
  t(bj.files && bj.files['sixfold-data/rounds/fb-leads.json'] && bj.files['sixfold-data/rounds/fbleads.log'], 'the app backup has the Facebook choices and the log');
  t(!JSON.stringify(bj).includes('"tok"') && !/PAGETOK|f1\./.test(JSON.stringify(bj.files['sixfold-data/rounds/fb-leads.json'])), 'never the tokens');
  const nb = readFileSync(DIR + '/sixfold-tools/nightly-backup.php', 'utf8'); t(nb.includes("'/fb-leads.json'"), 'the nightly backup lists fb-leads.json too');

  /* ---- the screen on a phone, connected ---- */
  await openFb(B, 'admin', 390, 844); await shot(B, '06-connected-phone');
  await B.js(`[...document.querySelectorAll('.fbpage button.lnk')].find(b=>/Show the forms/.test(b.textContent))?.click()`);
  await B.waitFor(`document.querySelectorAll('.fbq select').length >= 7`, 'questions (phone)', 15000); await shot(B, '07-forms-phone');
  t(await B.js(`document.documentElement.scrollWidth <= 392`), 'no sideways scroll on a phone');
  await B.openAs('admin', 1440, 900); await B.waitFor(`!!document.querySelector('.dnav .dnl button')`, 'side menu', 20000);
  await B.click('.dnav .dnl button', 'Office'); await B.waitFor(`!!document.querySelector('.omenu')`, 'office menu');
  await B.click('.omenu button', 'Setup'); await B.waitFor(`!!document.querySelector('button.kitstep[data-k="fbleads"]')`, 'Setup lists Facebook lead ads', 15000);
  t(true, 'the Setup checklist lists Facebook lead ads'); await shot(B, '08-setup-list-desktop');
  t(B.errors.length === 0, 'no page errors' + (B.errors.length ? ': ' + B.errors.slice(0, 2).join(' | ') : ''));

  /* ---- Sixfold untouched ---- */
  console.log('Sixfold');
  mode('sixfold'); execFileSync('node', [DIR + '/preaccept.cjs']);
  await signin('admin', '222222'); SESS = jars.admin;
  j = await call('admin', 'fbleads'); t(j._status === 404, 'Sixfold: fbleads answers 404');
  j = await post('admin', 'fboauth', {}); jars.admin = SESS; t(j._status === 404, 'Sixfold: Connect Facebook answers 404');
  out = poll(); t(out.trim() === '' || /not this install/.test(out) || !/new/.test(out), 'Sixfold: the 5-minute run brings nothing in');
  await B.openAs('admin', 1280, 900); await B.waitFor(`!!document.querySelector('#barin') && document.querySelector('#barin').textContent.length > 0`, 'app', 20000); await sleep(800);
  await B.send('Page.navigate', { url: ORIGIN + '/summit-de59ae83/?fbleads=lost' }); await sleep(4000);
  t(await B.js(`!document.querySelector('.fbset')`), 'Sixfold: the Facebook leads screen never opens');
} catch (e) { t(false, 'crashed: ' + (e && e.stack || e)); }
finally {
  rmSync(SHARED + '/meta-app.json', { force: true }); if (madeKey) rmSync(SHARED + '/mail-oauth.key', { force: true });   /* the harness as it was: other suites read the mail key */
  mode('edition');
  for (const f of ['fb-leads.json', 'fb-leads-state.json', 'fb-leads-oauth.json']) rmSync(PRIV + '/' + f, { force: true });
  B.close();
  console.log(`fbleads-test: ${R.pass} passed, ${R.fail} failed`);
  process.exit(R.fail ? 1 : 0);
}
