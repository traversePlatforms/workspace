// J.A.R.V.I.S., the merged page (2026-11-18): end-to-end on a throwaway copy of the server's layout, in headless Chrome.
// NOTHING here reaches Google, Anthropic or the live site: Gmail is a mock on 127.0.0.1 (every call it gets is counted), the Assistant
// has no Anthropic key, and the Field app, the Houston install, Outbox and the Peak desk are small stub files that answer like them.
//   node assistant/jarvis/tests/jarvis-test.mjs            (SHOTS=<folder> to also save screenshots; default assistant/jarvis/shots)
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = process.env.SHOTS || path.join(REPO, 'assistant', 'jarvis', 'shots');
const PORT = +process.env.JT_PORT || 8803, GPORT = +process.env.JT_GPORT || 8804, CDP = +process.env.JT_CDP || 9241;   /* other builders' tests may hold the defaults */
const R = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-'));   // stands in for ~/www/traverseplatforms.com
const PUB = path.join(R, 'public_html'), PRIV = path.join(R, 'assistant-private'), DATA = path.join(PRIV, 'data');
let pass = 0, failN = 0;
const ok = (c, what) => { if (c) pass++; else { failN++; console.log('FAIL:', what); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mk = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const now = Math.floor(Date.now() / 1000);
const PASSWORD = 'jarvis-test-password-1';
const SECRETS = ['GOCSPX-TESTSECRET-9f8e7d', 'REFRESH-TESTSECRET-1a2b3c', 'ACCESS-TESTSECRET-4d5e6f', 'SETUPCODE-TESTSECRET', 'STATUS-TESTSECRET-zz'];

/* ---- the Assistant, as it sits on the server: public files (with jarvis/) and the private code ---- */
fs.cpSync(path.join(REPO, 'assistant', 'server', 'public'), path.join(PUB, 'a-e018bb82'), { recursive: true });
fs.cpSync(path.join(REPO, 'assistant', 'jarvis'), path.join(PUB, 'a-e018bb82', 'jarvis'), { recursive: true, filter: s => !/[\\/](tests|tools|shots|waiting\.json)([\\/]|$)/.test(s) });
fs.cpSync(path.join(REPO, 'assistant', 'server', 'private'), PRIV, { recursive: true });
const hash = spawnSync('php', ['-r', 'echo password_hash(stream_get_contents(STDIN), PASSWORD_DEFAULT);'], { input: PASSWORD }).stdout.toString();
mk(path.join(DATA, 'config.json'), JSON.stringify({ passwordHash: hash, googleClientId: 'test-client.apps.googleusercontent.com', googleClientSecret: SECRETS[0], setupCodeHashNote: SECRETS[3], stub: true }));
const ACCTS = { 'matthew.personal@example.test': 'Personal', 'm.sharpe@traverse.example.test': 'Traverse', 'contact@sixfold.example.test': 'Sixfold / 365', 'm.sharpe@surge.example.test': 'Surge' };
const accounts = {}; Object.entries(ACCTS).forEach(([e, l]) => { accounts[e] = { label: l, about: l + ' mail', signature: 'Matthew', on: true, refresh: SECRETS[1], access: SECRETS[2], accessUntil: now + 86400, lastCheck: now - 300 }; });
accounts['m.sharpe@traverse.example.test'].cal = true;   /* 18 Nov: the Traverse calendar is connected; its events come from the 5-minute cache below */
mk(path.join(DATA, 'accounts.json'), JSON.stringify(accounts));
{ const d = new Date(), y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0'), t2 = new Date(Date.now() + 86400000), y2 = t2.getFullYear(), m2 = String(t2.getMonth() + 1).padStart(2, '0'), d2 = String(t2.getDate()).padStart(2, '0');
  mk(path.join(DATA, 'jarvis', 'cal-cache.json'), JSON.stringify({ email: 'm.sharpe@traverse.example.test', at: now, out: { source: 'Traverse', events: [
    { title: 'Peak meeting with Tyler', start: y + '-' + m + '-' + dd + 'T14:30:00-07:00', end: y + '-' + m + '-' + dd + 'T15:30:00-07:00', allDay: false, where: 'Peak Pickleball' },
    { title: 'Nolan lunch', start: y2 + '-' + m2 + '-' + d2, end: y2 + '-' + m2 + '-' + d2, allDay: true, where: '' } ] } })); }
const CALEV = JSON.parse(fs.readFileSync(path.join(DATA, 'jarvis', 'cal-cache.json'), 'utf8')).out.events;   /* the calendar mock answers the same, once the cache runs out */
const it = (acct, id, cat, subj, from, minsAgo, draft, prio = 'normal') => ({ acct, id, threadId: 't' + id, from, fromAddr: from.toLowerCase().replace(/\s+/g, '.') + '@client.test', subject: subj, date: now - minsAgo * 60, category: cat, priority: prio, summary: 'Summary of ' + subj, todo: 'Reply', draftId: draft, status: 'open', at: now - minsAgo * 60 });
const ITEMS = [
  it('m.sharpe@traverse.example.test', 'm1', 'needs_reply', 'Can two of us share one login?', 'Dana Whitlock', 38, 'd1', 'high'),
  it('matthew.personal@example.test', 'm2', 'needs_reply', 'Saturday plans, and that recipe', 'Sam Ortega', 60, 'd2'),
  it('m.sharpe@traverse.example.test', 'm3', 'needs_reply', 'Pest edition: price for a 3-person team', 'Priya Nand', 120, null),
  it('contact@sixfold.example.test', 'm4', 'action', 'Aeration quote request, Black Forest', 'Website form', 180, null),
  it('m.sharpe@surge.example.test', 'm5', 'calendar', 'Invitation: Peak sponsor meeting Thu 2:30', 'Tyler', 240, null),
  it('matthew.personal@example.test', 'm6', 'newsletter', 'Weekly digest', 'News', 300, null),
  it('m.sharpe@surge.example.test', 'm7', 'needs_reply', '<img src=x onerror=window.__xss=1> Quote for booth', 'Event Co', 90, 'd7')
];
mk(path.join(DATA, 'items.json'), JSON.stringify(Object.fromEntries(ITEMS.map(i => [i.acct + ':' + i.id, i]))));
mk(path.join(DATA, 'usage.json'), JSON.stringify({ [new Date().toISOString().slice(0, 7)]: { usd: 23.4, calls: 300, by: {} } }));
mk(path.join(DATA, 'groceries.json'), JSON.stringify({ items: [{ id: 'g1', text: 'eggs', done: false, by: 'Matthew', at: now }, { id: 'g2', text: 'bread', done: true, by: 'Matthew', at: now }] }));
/* what the laptop pushes (jarvis-status.sh): plus a field the page must never see */
mk(path.join(DATA, 'jarvis', 'status.json'), JSON.stringify({ pushedAt: now - 600, secret: SECRETS[4], overnight: { at: now - 900, ok: 18, problems: [], token: SECRETS[4] },
  builds: [{ id: 'roof', name: 'Roof material, every-home doors', steps: 2, step: 1, pct: 68, note: '~25 min left', state: 'running', at: now - 300 },
    { id: 'yards', name: 'Yards v3 refresh', pct: 42, note: 'stage 4 of 7', state: 'running', at: now - 200 },
    { id: 'tests', name: 'Prospect Desk tracked links', note: '76 of 76 tests passed', state: 'done', at: now - 3000 }],
  /* 19 Nov (P-8): Waiting on you (one barred: a post approval never shows), and the money totals (with a key the page must never see) */
  waiting: [{ id: 'sixfold-followup-email-off', title: 'Turn off the Sixfold two-day follow-up email?', detail: 'On since 2 Nov (29 sent).', company: 'Sixfold', from: 'Outbox', kind: 'decision', at: now - 4000, token: SECRETS[4] },
    { id: 'surge-linkedin-mock-build', title: 'Start the Surge LinkedIn mock build?', detail: 'Nothing is posted.', company: 'Surge', from: 'LinkedIn', kind: 'decision', at: now - 3000 },
    { id: 'approve-fb-post', title: 'Approve the Surge Facebook post for Friday?', detail: 'x', company: 'Surge', kind: 'decision', at: now - 2000 },
    { id: 'send-newsletter', title: 'Newsletter', detail: 'y', company: 'Sixfold', kind: 'send', at: now - 2000 }],
  money: { ledger: { perMonth: 212.66, monthly: 145.17, yearly: 809.84, once: 1900, planned: 32.4, items: 11, byEntity: { surge: 104.84, sixfold: 65.26, a365: 11.73, traverse: 30.83 }, asOf: '2026-11-19', card: '4242424242424242' },
    stripe: { at: now - 600, available: 120.5, pending: 40, month: 399, charges: 3, key: SECRETS[4] } } }));
mk(path.join(DATA, 'jarvis', 'beat.txt'), String(now - 120));   /* help-watch.sh's heartbeat: awake */

/* ---- the other apps, as stubs that answer like them (each with its own cookie) ---- */
const T = (id, by, status, text, minsAgo, reply) => ({ id, by, at: now - minsAgo * 60, status, updated: now - minsAgo * 60 + 30, ctx: null,
  msgs: [{ from: by, text, at: now - minsAgo * 60, mine: true, photos: [], audio: [] }].concat(reply ? [{ from: 'J.A.R.V.I.S.', text: reply, at: now - minsAgo * 60 + 30, mine: false, refresh: false, files: [] }] : []) });
mk(path.join(R, 'help-sixfold.json'), JSON.stringify({
  h20261118090000aaaa: T('h20261118090000aaaa', 'Jen McPherson', 'working', 'Deposit link says "a newer form was sent"', 12, 'On it.'),
  h20261118080000bbbb: T('h20261118080000bbbb', 'Brad', 'matthew', "Tomorrow's route isn't on my phone", 25, 'Passed to Matthew.'),
  h20261117080000cccc: T('h20261117080000cccc', 'Matthew Sharpe', 'answered', 'Check the Peak expo list', 600, 'Done: 35 waiting.'),
  h20261116080000dddd: T('h20261116080000dddd', 'Jen McPherson', 'closed', 'Old one', 3000, 'Fixed.') }));
const ROUNDS = `<?php
header('Content-Type: application/json');
$who = $_COOKIE['sfr'] ?? ''; $root = dirname(__DIR__, 2);
if ($who === '') { http_response_code(401); echo '{"ok":false,"error":"Sign in first."}'; exit; }
$f = $root . '/help-sixfold.json'; $T = json_decode(file_get_contents($f), true);
$me = $who === 'matthew' ? 'Matthew Sharpe' : 'Jen McPherson'; $super = $who === 'matthew';
$a = $_GET['action'] ?? '';
if ($a === 'helplist') { $l = array_values(array_filter($T, fn($t) => $super || $t['by'] === $me)); echo json_encode(['ok' => true, 'admin' => $super, 'tickets' => $l]); exit; }
if ($a === 'helpsend') {
  $b = json_decode(file_get_contents('php://input'), true) ?: [];
  file_put_contents($root . '/helpsend.log', json_encode(['by' => $me, 'id' => $b['id'] ?? '', 'text' => $b['text'] ?? '']) . "\\n", FILE_APPEND);
  $id = ($b['id'] ?? '') ?: 'h20261118120000eeee';
  if (!isset($T[$id])) $T[$id] = ['id' => $id, 'by' => $me, 'at' => time(), 'status' => 'new', 'msgs' => [], 'ctx' => null];
  $T[$id]['msgs'][] = ['from' => $me, 'text' => (string) ($b['text'] ?? ''), 'at' => time(), 'mine' => true, 'photos' => [], 'audio' => []]; $T[$id]['status'] = 'new'; $T[$id]['updated'] = time();
  file_put_contents($f, json_encode($T)); echo json_encode(['ok' => true, 'ticket' => $T[$id]]); exit;
}
http_response_code(404); echo '{"ok":false}';`;
mk(path.join(PUB, 'api', 'rounds.php'), ROUNDS);
mk(path.join(PUB, 'api', 'c-houston-lawn-test-rounds.php'), `<?php header('Content-Type: application/json'); if (($_COOKIE['tvhou'] ?? '') === '') { http_response_code(401); echo '{"ok":false,"error":"Sign in first."}'; exit; } echo '{"ok":true,"admin":true,"tickets":[]}';`);
mk(path.join(PUB, 'outbox-092b0f', 'api.php'), `<?php header('Content-Type: application/json'); if (($_COOKIE['outbox'] ?? '') !== 'ok') { http_response_code(401); echo '{"ok":false,"error":"Sign in first.","signin":true}'; exit; }
echo json_encode(['ok' => true, 'summary' => ['sent' => ['peak' => 30, 'sixfold' => 5, 'traverse' => 2], 'waiting' => ['peak' => 12, 'sixfold' => 0, 'traverse' => 0], 'waitingPaused' => 0, 'failed' => ['peak' => 0, 'sixfold' => 1, 'traverse' => 0], 'attention' => []]]);`);
const today = new Date(); const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const back = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const DESK = { ok: true, today: ymd(today), sponsor: { recs: [
  { id: 'copperline', name: 'Copperline Physical Therapy', stage: 'called', next: { date: back(2), what: 'Call' } },
  { id: 'larkspur', name: 'Larkspur Auto Group', stage: 'emailed', next: { date: back(1), what: 'Email' } },
  { id: 'a1', name: 'A1', stage: 'new', next: { date: ymd(today), what: '' } }, { id: 'a2', name: 'A2', stage: 'new', next: { date: ymd(today), what: '' } },
  { id: 'done1', name: 'Signed Co', stage: 'signed', next: { date: back(5), what: '' } }, { id: 'later', name: 'Later Co', stage: 'new', next: { date: '2099-01-01', what: '' } }] },
  expo: { recs: [{ id: 'x000000001', name: 'Expo A', stage: 'contacted', next: { date: ymd(today), what: '' } }, { id: 'x000000002', name: 'Expo B', stage: 'contacted', next: { date: ymd(today), what: '' } }] } };
mk(path.join(PUB, 'peak-desk-28d38d', 'api', 'desk.php'), `<?php header('Content-Type: application/json'); if (($_COOKIE['peakdesk'] ?? '') === '') { http_response_code(401); echo '{"ok":false,"error":"Signed out."}'; exit; } echo ${JSON.stringify(JSON.stringify(DESK))};`);
for (const p of ['summit-de59ae83', 'hl-f98938', 'outbox-092b0f', 'peak-desk-28d38d']) mk(path.join(PUB, p, 'index.html'), '<!doctype html><title>stub ' + p + '</title><body style="background:#fff">stub ' + p);

/* ---- the Gmail mock: answers like Gmail, counts every call; a send is anything that would send ---- */
const G = { calls: [], sends: [] };
const b64u = s => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const gsrv = http.createServer((req, res) => {
  let body = ''; req.on('data', c => body += c); req.on('end', () => {
    const u = new URL(req.url, 'http://x'), p = u.pathname.replace(/^\/+/, ''), auth = req.headers.authorization || '';
    G.calls.push(req.method + ' ' + p);
    const J = (o, c = 200) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (auth !== 'Bearer ' + SECRETS[2]) return J({ error: { message: 'bad token' } }, 401);
    let m;
    if (req.method === 'GET' && (m = /^messages\/([^/]+)$/.exec(p))) {
      const i = ITEMS.find(x => x.id === m[1]); if (!i) return J({ error: { message: 'not found' } }, 404);
      return J({ id: i.id, threadId: i.threadId, labelIds: ['INBOX'], snippet: 'snippet', payload: { mimeType: 'text/plain', headers: [{ name: 'From', value: i.from + ' <' + i.fromAddr + '>' }, { name: 'To', value: i.acct }, { name: 'Subject', value: i.subject }, { name: 'Date', value: new Date(i.date * 1000).toUTCString() }, { name: 'Message-ID', value: '<' + i.id + '@client.test>' }], body: { data: b64u('Hi Matthew,\n\nThe full text of "' + i.subject + '".\n\nThanks') } } });
    }
    if (req.method === 'GET' && (m = /^drafts\/([^/]+)$/.exec(p))) return J({ id: m[1], message: { payload: { mimeType: 'text/plain', body: { data: b64u('Hi, thanks for coming back so quickly. (draft ' + m[1] + ')\n\nMatthew') } } } });
    if (req.method === 'PUT' && (m = /^drafts\/([^/]+)$/.exec(p))) return J({ id: m[1] });
    if (req.method === 'POST' && p === 'drafts') return J({ id: 'dnew' });
    if (req.method === 'POST' && (p === 'drafts/send' || p === 'messages/send')) { G.sends.push({ p, body }); return J({ id: 'sent' + G.sends.length }); }
    /* 19 Nov: Google Calendar (JARVIS_CAL_MOCK): the events read, and reminders added */
    if (req.method === 'GET' && p === 'calendars/primary/events') return J({ items: CALEV.map(e => ({ summary: e.title, location: e.where, start: e.allDay ? { date: e.start } : { dateTime: e.start }, end: e.allDay ? { date: e.end } : { dateTime: e.end } })) });
    if (req.method === 'POST' && p === 'calendars/primary/events') { G.events = (G.events || []).concat([JSON.parse(body)]); return J({ id: 'ev' + G.events.length }); }
    J({ error: { message: 'unexpected ' + p } }, 400);
  });
});
await new Promise(r => gsrv.listen(GPORT, '127.0.0.1', r));
/* 19 Nov: the phone alert a due reminder makes, as a stub that logs what it was given (the real one is jvpush.php, the Field app's alert) */
const PUSHLOG = path.join(R, 'push.log');
mk(path.join(R, 'push-stub.php'), `<?php file_put_contents(${JSON.stringify(PUSHLOG.replace(/\\/g, '/'))}, stream_get_contents(STDIN) . "\\n", FILE_APPEND); echo "pushed\\n";`);
const ENVX = { ASSISTANT_PRIVATE: PRIV, ASSISTANT_GMAIL_MOCK: 'http://127.0.0.1:' + GPORT + '/', JARVIS_CAL_MOCK: 'http://127.0.0.1:' + GPORT + '/', JARVIS_PUSH_CMD: 'php ' + JSON.stringify(path.join(R, 'push-stub.php').replace(/\\/g, '/')) };
const srv = spawn('php', ['-S', '127.0.0.1:' + PORT, '-t', PUB], { stdio: 'ignore', env: { ...process.env, ...ENVX } });
/* async: the calendar mock lives in this same process, so a blocking spawn would starve it */
const cronReminders = () => new Promise(res => { let o = ''; const p = spawn('php', [path.join(PRIV, 'cron.php'), '--reminders'], { env: { ...process.env, ...ENVX } }); p.stdout.on('data', d => o += d); p.on('close', () => { try { res(JSON.parse(o.trim().split('\n').pop() || '{}')); } catch { res({}); } }); });
await sleep(900);
const BASE = 'http://127.0.0.1:' + PORT, PAGE = BASE + '/a-e018bb82/jarvis/';
const hget = async (u, cookie = '') => { const r = await fetch(BASE + u, { headers: cookie ? { Cookie: cookie } : {} }); return [r.status, await r.text()]; };
const hpost = async (u, body, cookie = '') => { const r = await fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) }); return [r.status, await r.text()]; };

/* ================================================================ 1. sign-in required; staff cookies open nothing */
{
  for (const a of ['home', 'jvstatus', 'chatlog', 'gro']) { const [s] = await hget('/a-e018bb82/api.php?action=' + a); ok(s === 401, 'signed out: ' + a + ' answers 401 (got ' + s + ')'); }
  for (const a of ['chat', 'send', 'open', 'savedraft', 'write', 'jvremind', 'jvremindset', 'jvdecide']) { const [s] = await hpost('/a-e018bb82/api.php?action=' + a, { text: 'x', key: 'k', confirmed: true }); ok(s === 401, 'signed out: POST ' + a + ' answers 401 (got ' + s + ')'); }
  for (const c of ['sfr=staff', 'sfr=matthew', 'outbox=ok; peakdesk=x; tvhou=x']) { const [s] = await hget('/a-e018bb82/api.php?action=home', c); ok(s === 401, 'a Field app / Outbox / desk cookie alone does not open the Assistant (' + c.split('=')[0] + ')'); }
  const [s2, page] = await hget('/a-e018bb82/jarvis/');
  ok(s2 === 200 && /J\.A\.R\.V\.I\.S\./.test(page), 'the page itself loads (its data does not, signed out)');
  ok(!ITEMS.some(i => page.includes(i.subject)), 'the page file holds no email');
}
/* ================================================================ 2. no secrets in pages */
{
  const files = []; const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.(html|js|css|json|svg)$/.test(e.name)) files.push(f); });
  walk(path.join(REPO, 'assistant', 'jarvis')); files.push(path.join(REPO, 'assistant', 'hub', 'index.html'));
  const PAT = /sk-ant-[A-Za-z0-9_-]{8,}|GOCSPX-[A-Za-z0-9_-]{6,}|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|xox[bp]-[0-9A-Za-z-]{10,}|sq0[a-z]{3}-[0-9A-Za-z_-]{10,}|sk_live_[0-9A-Za-z]{10,}|\bpassword\s*[:=]\s*['"][^'"]{6,}/i;
  const bad = files.filter(f => !/tests[\\/]/.test(f) && PAT.test(fs.readFileSync(f, 'utf8')));
  ok(files.length >= 2 && bad.length === 0, 'no key, token or password in the J.A.R.V.I.S. files or the hub (' + bad.map(f => path.basename(f)).join(', ') + ')');
}

/* ================================================================ headless Chrome */
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvischrome-'));
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + CDP, '--user-data-dir=' + prof, '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
let ws; const reqs = []; const errs = [];
try {
  let list = null; for (let i = 0; i < 40 && !list; i++) { await sleep(250); try { list = await (await fetch('http://127.0.0.1:' + CDP + '/json/list')).json(); } catch {} }
  const pg = list.find(t => t.type === 'page'); ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const wait = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait[d.id]) { wait[d.id](d); delete wait[d.id]; }
    if (d.method === 'Network.requestWillBeSent') reqs.push(d.params.request.method + ' ' + d.params.request.url);
    if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); };
  const cdp = (method, params = {}) => new Promise(r => { const n = ++id; wait[n] = r; ws.send(JSON.stringify({ id: n, method, params })); });
  const ev = async e => { const r = await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value; };
  const click = async sel => ev('(()=>{const e=document.querySelector(' + JSON.stringify(sel) + ');if(!e)return false;e.click();return true})()');
  const until = async (expr, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(120); } return false; };
  const shot = async name => { fs.mkdirSync(SHOTS, { recursive: true }); const r = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64')); };
  const desk = async () => cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const phone = async () => cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable'); await desk();
  /* a stand-in for the browser's speech recognition, so "listening" can be tested without a microphone */
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__srText="Add milk to groceries";window.SpeechRecognition=window.webkitSpeechRecognition=function(){var s=this;s.start=function(){setTimeout(function(){s.onresult&&s.onresult({results:[[{transcript:window.__srText}]]});},400);window.__srStop=function(){s.onend&&s.onend();};};s.stop=function(){s.onend&&s.onend();};};' });
  const C = (name, value, p = '/') => cdp('Network.setCookie', { name, value, url: BASE + p, path: p });

  /* ---- a staff member signed in to the Field app, and nothing else: the page asks for the Assistant's password, shows nothing of his */
  await C('sfr', 'staff');
  /* 18 Nov: a stand-in for the device voice, so read-aloud replies can be counted */
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__said=[];window.SpeechSynthesisUtterance=function(t){this.text=t};Object.defineProperty(window,"speechSynthesis",{configurable:true,value:{speak:function(u){if(u.text&&u.text.trim())window.__said.push(u.text)},cancel:function(){},getVoices:function(){return[{name:"Daniel",lang:"en-GB"}]},addEventListener:function(){}}});' });
  await cdp('Page.navigate', { url: PAGE }); await sleep(1500);
  ok((await ev('window.__said.length')) === 0, 'Voice: loading the page never talks');
  await ev('document.dispatchEvent(new Event("click"))');   /* the person touching the page, which browsers need before sound */
  ok(await ev('!!document.querySelector(".signin input[type=password]")'), 'signed out (with a staff Field app cookie): the sign-in shows');
  ok(await ev('!document.querySelector(".ibr") && !document.body.innerText.includes("Dana")'), 'signed out: no inbox, no email on screen');
  ok(!reqs.some(r => /helplist|outbox-092b0f|desk.php/.test(r)), 'signed out: the page does not even ask the other apps');
  await ev('document.querySelector(".signin input").value="wrong-password-xyz"'); await click('.signin button'); await sleep(700);
  ok(/not right/.test(await ev('document.querySelector(".signin .err").textContent')), 'a wrong password is refused');

  /* ---- Matthew: the Assistant's password; he is also signed in to the Field app, Outbox and the Peak desk (not Houston) */
  await C('sfr', 'matthew'); await C('outbox', 'ok', '/outbox-092b0f/'); await C('peakdesk', 'tok');
  reqs.length = 0;
  await ev('document.querySelector(".signin input").value=' + JSON.stringify(PASSWORD)); await click('.signin button');
  ok(await until('!!document.querySelector(".desk .ibr") && document.querySelectorAll(".msg.ai").length>0', 9000), 'signed in: the Halo screen with the inboxes and a hello');
  ok(await ev('document.querySelectorAll(".acard").length===0 && /Good (morning|afternoon|evening), Matthew\./.test(document.querySelector(".msg.ai").innerText) && !/overnight check|waiting across|Right now/i.test(document.querySelector(".msg.ai").innerText)'), '19 Nov: opening is a one-line hello, no briefing card');
  await sleep(600);

  /* ================================================================ 3. no model call on load; only the expected reads */
  ok(!reqs.some(r => /action=(chat|write|send|savedraft|check|draft|helpsend|groadd)\b/.test(r)), 'page load makes no model call and sends nothing (' + reqs.filter(r => /action=(chat|write|send|check|draft)/.test(r)).join(', ') + ')');
  const allowed = /\/a-e018bb82\/(api\.php\?action=(signin|state|home|jvstatus|gro)$|jarvis\/)|\/api\/(rounds|c-houston-lawn-test-rounds)\.php\?action=helplist$|\/outbox-092b0f\/api\.php\?action=state$|\/peak-desk-28d38d\/api\/desk\.php\?action=data$|^data:/;
  const odd = reqs.filter(r => !allowed.test(r.split(' ')[1]));
  ok(odd.length === 0, 'the page reads only its own sources (' + odd.join(' | ') + ')');
  ok(!reqs.some(r => /googleapis|anthropic|fonts\.g/.test(r)), 'nothing leaves for Google or Anthropic from the page');
  ok(G.calls.length === 0, 'no Gmail call on load (' + G.calls.join(', ') + ')');
  ok(await ev('window.__xss===undefined'), 'an email subject with HTML in it is shown as text, never run');

  /* ================================================================ 4. the Halo pieces are there */
  ok(await ev('!!document.querySelector(".core svg .glob") && !!document.querySelector(".core .r-arc") && document.querySelectorAll(".core .rip").length===3'), 'the core: globe, inner arc and three ripples');
  ok(await ev('document.querySelectorAll(".desk .pnl .ph .n").length===8 && [...document.querySelectorAll(".ph .n")].map(n=>n.textContent).sort().join()==="01,02,03,05,06,07,08,09" && !!document.querySelector(".rail button[data-panel=brief]")'), 'eight panels open; the Morning brief (04) starts folded into its edge icon (19 Nov: "if i need a briefing I will ask for it")');
  ok(await ev('document.querySelector(".slbl").textContent==="Standing by" && document.getElementById("app").classList.contains("s-idle")'), 'idle state label');
  ok(/Laptop awake/i.test(await ev('document.querySelector(".top").innerText')), 'top bar: laptop awake (from the heartbeat)');
  ok(/API \$23\.40 \/ \$100/.test(await ev('document.querySelector(".top").innerText')), 'top bar: API spend');
  ok(await ev('[...document.querySelectorAll(".chip")].length>=5'), 'suggestion chips');

  /* ================================================================ 5. inboxes: one line each, collapsed; Needs you merges them */
  const rows = await ev('[...document.querySelectorAll(".ibr")].map(r=>({nm:r.querySelector(".nm").textContent,ct:r.querySelector(".ct").textContent,dr:(r.querySelector(".bdg.dr")||{}).textContent||"",open:r.classList.contains("open")}))');
  ok(rows.length === 4 && rows.map(r => r.nm).join() === 'Personal,Traverse,Sixfold / 365,Surge', 'four inbox rows, in order (' + JSON.stringify(rows) + ')');
  ok(rows.every(r => !r.open), 'every inbox row starts folded');
  ok(rows[0].ct === '1' && rows[1].ct === '2' && rows[2].ct === '1' && rows[3].ct === '2', 'each row has its waiting count (low priority left out)');
  ok(rows[0].dr === '1 draft ready' && rows[1].dr === '1 draft ready' && rows[2].dr === '' && rows[3].dr === '1 draft ready', 'draft-ready badges per inbox');
  const needs = await ev('[...document.querySelectorAll("#p-inbox .needs .li")].map(l=>l.querySelector(".lt").textContent)');
  ok(needs.length === 5 && needs[0] === 'Can two of us share one login?' && needs.includes("Tomorrow's route isn't on my phone") && !needs.includes('Aeration quote request, Black Forest'), 'Needs you: replies across inboxes (high first) plus the team request waiting on him (' + needs.join(' | ') + ')');
  await click('.ibr[data-inbox="m.sharpe@traverse.example.test"] .ibh');
  ok(await ev('document.querySelector(".ibr[data-inbox=\\"m.sharpe@traverse.example.test\\"]").classList.contains("open") && document.querySelectorAll(".ibr.open .ibb .li").length===2'), 'tapping a row opens it, showing its emails');
  await click('#p-team .ph .fold'); await sleep(200);
  ok(await ev('!document.getElementById("p-team") && !!document.querySelector(".colL .rail button[data-panel=team]")'), 'a side panel folds into an edge icon');
  ok(await ev('document.querySelector(".colL .rail button[data-panel=team] em").textContent==="1"'), 'the folded icon keeps a count (1 needs you)');
  for (const k of ['today', 'remind', 'cal', 'builds', 'money']) await click('#p-' + k + ' .ph .fold'); await sleep(200);
  const gc = await ev('getComputedStyle(document.getElementById("app")).gridTemplateColumns');
  ok(/^394px .* 44px$/.test(gc), 'a fully folded side shrinks to its icon strip and the middle widens (' + gc + ')');
  await cdp('Page.reload'); await until('!!document.querySelector(".desk .ibr")', 8000); await sleep(800); await ev('document.dispatchEvent(new Event("click"))');
  ok(await ev('document.querySelector(".ibr[data-inbox=\\"m.sharpe@traverse.example.test\\"]").classList.contains("open") && !document.getElementById("p-team") && !document.getElementById("p-today")'), 'open rows and folded panels are remembered on this device after a reload');
  for (const k of ['team', 'brief', 'today', 'remind', 'cal', 'builds', 'money']) await click('.rail button[data-panel=' + k + ']');
  await click('.ibr.open .ibh'); await sleep(200);
  ok(await ev('document.querySelectorAll(".pnl .ph .n").length===9 &&!document.querySelector(".rail button") && !document.querySelector(".ibr.open")'), 'unfolding brings every panel back');

  /* ================================================================ 6. Today, Builds, Calendar, Team from their sources */
  const today = await ev('document.getElementById("p-today").innerText');
  ok(/Overnight check passed/.test(today) && /18 of 18 checks/.test(today), 'Today: the overnight check from the laptop push');
  ok(/37\s+SENT/i.test(today) && /12\s+WAITING/i.test(today) && /1\s+FAILED/i.test(today), 'Today: Outbox sent, waiting, failed (from Outbox\'s own answer)');
  ok(/Peak desk: 6 follow-ups due/.test(today) && /2 late/.test(today), 'Today: Peak desk follow-ups due and late (signed and future ones left out)');
  const builds = await ev('document.getElementById("p-builds").innerText');
  ok(/Roof material/.test(builds) && /68%/.test(builds) && /Yards v3 refresh/.test(builds) && /done/.test(builds) && /2 ACTIVE/i.test(await ev('document.querySelector("#p-builds .ph").innerText')), 'Builds: running ones with progress, finished one done');
  /* 18 Nov: Check off a finished build; it stays gone after a fresh status read (saved on the server), running ones have no button */
  ok(await ev('document.querySelectorAll("#p-builds .bcheck").length') === 1, 'Builds: only the finished one has Check off');
  await click('#p-builds .bcheck');
  ok(await until('!/Prospect Desk tracked links/.test(document.getElementById("p-builds").innerText)'), 'Builds: Check off takes it off the panel');
  ok(await ev('fetch("../api.php?action=jvstatus",{credentials:"same-origin"}).then(r=>r.json()).then(j=>!j.builds.some(b=>/Prospect Desk/.test(b.name)) && j.builds.some(b=>/Roof material/.test(b.name)))'), 'Builds: checked off on the server too (every device), running ones kept');
  { const cal = await ev('document.getElementById("p-cal").innerText');
    ok(/Peak meeting with Tyler/.test(cal) && /2:30pm/.test(cal) && /TODAY/.test(cal) && /Nolan lunch/.test(cal) && /all day/i.test(cal) && !/Peak sponsor meeting/.test(cal) && !/not connected/i.test(cal), 'Calendar: events from the Traverse calendar by day, no invitations from the inboxes (18 Nov)'); }
  const team = await ev('document.getElementById("p-team").innerText');
  ok(/Deposit link says/.test(team) && /WORKING/i.test(team) && /NEEDS YOU/i.test(team) && !/Check the Peak expo list/.test(team) && !/Old one/.test(team), 'Team requests: open staff ones with their status (his own and closed ones tucked away)');
  ok(/Houston J\.A\.R\.V\.I\.S\.: sign in to its app once/.test(team), 'Team requests: Houston asks for its own sign-in (not shared)');
  ok(/2 OPEN/i.test(await ev('document.querySelector("#p-team .ph").innerText')), 'Team requests: open count');
  /* 18 Nov: Check off a team request: it leaves the panel, stays off after a fresh status read, and the staff thread itself is not closed */
  { const before = await ev('document.querySelectorAll("#p-team .titem").length');
    await click('#p-team .titem:has([data-ticket="h20261118080000bbbb"]) .tcheck');
    ok(await until('document.querySelectorAll("#p-team .titem").length === ' + (before - 1)), 'Team requests: Check off takes one off the panel');
    ok(await ev('fetch("../api.php?action=jvstatus",{credentials:"same-origin"}).then(r=>r.json()).then(j=>Object.keys(j.teamHidden||{}).length===1)'), 'Team requests: the check-off is saved on the server');
    ok(!reqs.some(r => /helpclose/.test(r)), 'Team requests: checking off never closes the staff chat'); }
  const status = JSON.parse((await (async () => { const r = await ev('fetch("../api.php?action=jvstatus").then(r=>r.text())'); return r; })()));
  ok(!JSON.stringify(status).includes(SECRETS[4]), 'jvstatus passes only its own fields, never what else the file holds');

  /* ================================================================ 7. email: open, draft, save, Send asks first, Cancel sends nothing */
  await click('#p-inbox .needs .li[data-key="m.sharpe@traverse.example.test:m1"]');
  ok(await until('document.getElementById("reply") && /draft d1/.test(document.getElementById("reply").value)'), 'the reply sheet opens with the Gmail draft');
  ok(/The full text of/.test(await ev('document.querySelector(".sheet .txt").textContent')), 'the email in full (read from Gmail)');
  await ev('document.getElementById("reply").value="Yes, two of you can share it. Matthew"');
  await click('#savedraft'); await until('/Saved as a draft/.test(document.querySelector(".said").textContent)');
  ok(G.calls.includes('PUT drafts/d1') && G.sends.length === 0, 'Save draft updates the Gmail draft and sends nothing');
  await click('#send'); await sleep(300);
  ok(await ev('!!document.getElementById("confirm") && /Send this reply to Dana Whitlock <dana\\.whitlock@client\\.test> from m\\.sharpe@traverse\\.example\\.test\\?/.test(document.getElementById("confirm").innerText)'), 'Send asks first: who it goes to and from which inbox');
  await sleep(1200);
  ok(G.sends.length === 0, 'while the question is open nothing is sent');
  await click('#cfno'); await sleep(500);
  ok(G.sends.length === 0 && await ev('!document.getElementById("confirm") && /Not sent/.test(document.querySelector(".said").textContent)'), 'Cancel: nothing sent, and it says so');
  await click('#send'); await sleep(200); await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))'); await sleep(500);
  ok(G.sends.length === 0 && await ev('!!document.getElementById("sheet")'), 'Escape on the question: nothing sent, the reply stays open');
  const [ns, nb] = await (async () => { const r = await ev('fetch("../api.php?action=send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:"m.sharpe@traverse.example.test:m1",text:"sneaky"})}).then(r=>r.text())'); return [0, r]; })();
  ok(/Not confirmed/.test(nb) && G.sends.length === 0, 'the server refuses a send without the confirm, even from the signed-in page');
  await click('#send'); await sleep(200); await click('#cfyes');
  ok(await until('!document.getElementById("sheet")', 5000), 'Yes: the sheet closes');
  ok(G.sends.length === 1 && G.sends[0].p === 'drafts/send' && /"id":"d1"/.test(G.sends[0].body), 'Yes: exactly one send, the saved draft, through Gmail');
  ok(await ev('!document.querySelector("[data-key=\\"m.sharpe@traverse.example.test:m1\\"]")'), 'the sent email leaves the list');
  ok(/reply sent/.test(fs.readFileSync(path.join(DATA, 'assistant.log'), 'utf8')), 'the send is in the Assistant\'s log');

  /* ================================================================ 8. which brain answers, named on the bar */
  ok(/Answering: Assistant, instant/.test(await ev('document.getElementById("brainlabel").textContent')), 'the bar says: Assistant, instant');
  reqs.length = 0;
  ok(await ev('(()=>{document.getElementById("ask").value="Anything from Jen this week?";document.querySelector(".cmdbar .snd").click();return document.getElementById("app").classList.contains("s-think") && /Thinking/.test(document.querySelector(".slbl").textContent)})()'), 'asking the Assistant: the core thinks');
  await until('!document.getElementById("app").classList.contains("s-think")', 6000);
  ok(reqs.filter(r => /action=chat\b/.test(r)).length === 1, 'one question, one Ask call');
  ok(/Anthropic key/.test(await ev('window.__said[window.__said.length-1] || ""')), 'Voice: the reply is read aloud');
  ok(/Voice on/.test(await ev('document.getElementById("voiceswitch").textContent')), 'Voice: on by default, named beside the desk switch');
  ok(/ASSISTANT · INSTANT/i.test(await ev('[...document.querySelectorAll(".msg.ai .who")].pop().textContent')) && /Anthropic key/.test(await ev('[...document.querySelectorAll(".msg.ai")].pop().textContent')), 'the answer is labelled Assistant, instant (here: no key, so it says so)');
  { await click('#voiceswitch'); const said0 = await ev('window.__said.length'); const mc = '[...document.querySelectorAll(".chip")].find(c=>/Morning check/.test(c.textContent)).click()';
    await ev(mc); await sleep(300);
    ok(/Voice off/.test(await ev('document.getElementById("voiceswitch").textContent')) && await ev('window.__said.length') === said0, 'Voice: off means silent');
    await ev(mc); await sleep(200);   /* tap the chip again to close its answer */
    /* 19 Nov: Brief me reads aloud even with Voice off (he asked for it) */
    await ev('[...document.querySelectorAll(".chip")].find(c=>/Brief me/.test(c.textContent)).click()'); await sleep(300);
    const said1 = await ev('window.__said[window.__said.length-1] || ""');
    ok(await ev('window.__said.length') === said0 + 1 && /Today on your calendar: 2:30pm Peak meeting with Tyler/.test(said1) && /Outbox: 37 sent today, 12 waiting, 1 failed/.test(said1) && /Peak desk: 6 follow-ups due, 2 late/.test(said1), 'Brief me: read aloud with Voice off, calendar, Outbox and Peak in it (' + said1.slice(0, 160) + ')');
    ok(!/click|repl|unsub|open rate/i.test(said1) && /2 decisions waiting on you/.test(said1) && /team request/.test(said1) && /build/.test(said1), 'Brief me: Outbox gives sent, waiting and failed only (no clicks, replies or unsubscribes); decisions, team and builds are in it');
    await ev('[...document.querySelectorAll(".chip")].find(c=>/Brief me/.test(c.textContent)).click()'); await sleep(150);
    await click('#voiceswitch'); }
  const brainH0 = await ev('Math.round(document.getElementById("brain").getBoundingClientRect().height)');
  await click('#brainswitch');
  ok(Math.abs(await ev('Math.round(document.getElementById("brain").getBoundingClientRect().height)') - brainH0) <= 2, 'switching to the desk does not move the screen (18 Nov: the bar grew 112 px)');
  ok(/Answering: J\.A\.R\.V\.I\.S\. desk, sent to your laptop, a few minutes/.test(await ev('document.getElementById("brainlabel").textContent')), 'switched: J.A.R.V.I.S. desk, sent to your laptop, a few minutes');
  reqs.length = 0;
  await ev('document.getElementById("ask").value="Check the Houston lot lines are live"'); await click('.cmdbar .snd');
  ok(await until('/Sent to J\\.A\\.R\\.V\\.I\\.S\\. desk/.test(document.querySelector(".chat").innerText)'), 'the desk: a card says it went to the laptop');
  const hs = fs.readFileSync(path.join(R, 'helpsend.log'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  ok(hs.length === 1 && hs[0].by === 'Matthew Sharpe' && hs[0].id === '' && hs[0].text === 'Check the Houston lot lines are live', 'the desk got one new ticket, as Matthew');
  ok(!reqs.some(r => /action=chat\b/.test(r)), 'a desk message makes no Ask call');
  /* the laptop answers: the page shows it, labelled as the desk */
  const tj = JSON.parse(fs.readFileSync(path.join(R, 'help-sixfold.json'), 'utf8')); tj.h20261118120000eeee.msgs.push({ from: 'J.A.R.V.I.S.', text: 'Live: 1,204 lots on the cards.', at: now + 5, mine: false }); tj.h20261118120000eeee.status = 'answered'; fs.writeFileSync(path.join(R, 'help-sixfold.json'), JSON.stringify(tj));
  ok(await until('/Live: 1,204 lots/.test(document.querySelector(".chat").innerText)', 22000), 'the desk\'s answer appears when the laptop replies');
  ok(/J\.A\.R\.V\.I\.S\. DESK · LAPTOP/i.test(await ev('[...document.querySelectorAll(".msg.ai .who")].pop().textContent')), 'and is labelled J.A.R.V.I.S. desk');
  await click('#brainswitch');
  ok(/Assistant, instant/.test(await ev('document.getElementById("brainlabel").textContent')), 'and back to the Assistant');

  /* ================================================================ 9. a team request: open, reply into it (with a yes) */
  await click('#p-team [data-ticket="h20261118090000aaaa"]');
  ok(await until('!!document.getElementById("threply")'), 'a team request opens as its thread');
  ok(/Jen McPherson’s J\.A\.R\.V\.I\.S\. chat/.test(await ev('document.querySelector(".sheet .warnline").textContent')), 'it says plainly where a reply goes');
  await ev('document.getElementById("threply").value="I will call the customer myself."'); await click('#thsend'); await sleep(300);
  ok(await ev('!!document.getElementById("confirm")'), 'replying into a staff thread asks first');
  await click('#cfno'); await sleep(300);
  ok(fs.readFileSync(path.join(R, 'helpsend.log'), 'utf8').trim().split('\n').length === 1, 'Cancel: nothing went to the thread');
  await click('#thsend'); await sleep(200); await click('#cfyes'); await until('!document.getElementById("sheet")');
  const hs2 = fs.readFileSync(path.join(R, 'helpsend.log'), 'utf8').trim().split('\n').map(l => JSON.parse(l)).pop();
  ok(hs2.id === 'h20261118090000aaaa' && hs2.text === 'Matthew: I will call the customer myself.' && hs2.by === 'Matthew Sharpe', 'Yes: one message into that thread, marked Matthew');

  /* ================================================================ 10. the chips answer from the screen, and voice */
  reqs.length = 0;
  await ev('[...document.querySelectorAll(".chip")].find(c=>/waiting/.test(c.textContent)).click()'); await sleep(400);
  ok(!reqs.some(r => /action=chat\b/.test(r)) && /need a reply/.test(await ev('document.querySelector(".chat").innerText')) && await ev('document.getElementById("app").classList.contains("s-answer")'), 'What\'s waiting? answers from the screen, no model call, answer state');
  await shot('jarvis-desktop-answer');
  /* 18 Nov: a chip toggles its answer, and another chip replaces it rather than stacking */
  { const count = re => ev('[...document.querySelectorAll(".chat > *")].filter(n=>' + re + '.test(n.innerText)).length');
    const tap = re => ev('[...document.querySelectorAll(".chip")].find(c=>' + re + '.test(c.textContent)).click()');
    await tap('/waiting/'); await sleep(200);   /* close What's waiting? first */
    await tap('/building/'); await sleep(300);
    ok(await count('/Roof material/') >= 1 && await ev('document.querySelectorAll(".chip.on").length === 1'), "Chips: What's building? shows its answer, the chip lit");
    await tap('/building/'); await sleep(300);
    ok(await count('/Roof material/') === 0 && await ev('document.querySelectorAll(".chip.on").length === 0'), 'Chips: tapped again, the answer closes (no copies)');
    await tap('/building/'); await sleep(300); await tap('/Team requests/'); await sleep(300);
    ok(await count('/Roof material/') === 0 && await count('/team request/i') >= 1, 'Chips: another chip replaces the last chip answer');
    await tap('/Team requests/'); await sleep(200); }
  await click('.ib.mic'); await sleep(150);
  ok(await ev('document.getElementById("app").classList.contains("s-listen") && /Listening/.test(document.querySelector(".slbl").textContent)'), 'the mic: the core listens');
  await sleep(500);
  ok((await ev('document.getElementById("ask").value')) === 'Add milk to groceries', 'speech becomes text in the bar (and nothing is sent by itself)');
  await shot('jarvis-desktop-listen');
  await ev('window.__srStop()'); await sleep(200);
  ok(!(await ev('document.getElementById("app").classList.contains("s-listen")')), 'stopping the mic goes back to idle');
  reqs.length = 0; await click('.cmdbar .snd');
  ok(await until('/Added to the grocery list: milk/.test(document.querySelector(".chat").innerText)'), '"Add milk to groceries" adds it to the list');
  ok(!reqs.some(r => /action=chat\b/.test(r)), 'without a model call');
  ok(errs.length === 0, 'no script errors on the desktop (' + errs.join(' | ') + ')');

  /* ================================================================ 13. the eight (19 Nov, P-8) */
  const hsAll = () => fs.readFileSync(path.join(R, 'helpsend.log'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
  const nodeUntil = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return true; } catch {} await sleep(120); } return false; };
  const apiPost = (a, b) => ev('fetch("../api.php?action=' + a + '",{method:"POST",headers:{"Content-Type":"application/json"},body:' + JSON.stringify(JSON.stringify(b)) + '}).then(r=>r.json())');
  const rems = () => JSON.parse(fs.readFileSync(path.join(DATA, 'jarvis', 'reminders.json'), 'utf8')).list;
  const denver = (t = Date.now()) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t)).map(x => [x.type, x.value])); return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute }; };
  const tomorrow = denver(Date.now() + 86400000).date;

  /* ---- 5. Waiting on you */
  { const wt = await ev('document.getElementById("p-waiting").innerText');
    ok(/Turn off the Sixfold two-day follow-up email/.test(wt) && /Start the Surge LinkedIn mock build/.test(wt) && !/Facebook post/.test(wt) && !/Newsletter/.test(wt), 'Waiting on you: the decisions show; a post approval and an email send never do');
    ok(/2 TO DECIDE/i.test(await ev('document.querySelector("#p-waiting .ph").innerText')) && /one item only/.test(wt), 'Waiting on you: the count, and the one-item rule on screen');
    const r1 = await apiPost('jvdecide', { id: 'approve-fb-post', at: now - 2000, decision: 'approve' });
    ok(!r1.ok && /post calendar/.test(r1.error), 'Waiting on you: the server refuses to approve a post (' + r1.error + ')');
    const r2 = await apiPost('jvdecide', { id: 'send-newsletter', at: now - 2000, decision: 'approve' }), r3 = await apiPost('jvdecide', { id: 'made-up', at: 1, decision: 'approve' });
    ok(!r2.ok && !r3.ok, 'Waiting on you: an email send and an item not on the list are refused too');
    const n0 = hsAll().length;
    await click('[data-wait="surge-linkedin-mock-build"] [data-act=decline]'); await sleep(300);
    ok(await ev('!!document.getElementById("confirm") && /this one item only/.test(document.getElementById("confirm").innerText)'), 'Waiting on you: a tap asks first, and says it covers this one item only');
    await click('#cfno'); await sleep(400);
    ok(hsAll().length === n0 && !fs.existsSync(path.join(DATA, 'jarvis', 'decisions.json')), 'Waiting on you: Cancel decides nothing and sends nothing');
    await ev('(()=>{const i=document.querySelector("[data-wait=\\"sixfold-followup-email-off\\"] input");i.value="turn it off today";i.dispatchEvent(new Event("input"))})()');
    await click('[data-wait="sixfold-followup-email-off"] [data-act=approve]'); await sleep(300); await click('#cfyes');
    ok(await nodeUntil(() => hsAll().length === n0 + 1), 'Waiting on you: Approve sends one message to the desk');
    const d1 = hsAll().pop();
    ok(d1.by === 'Matthew Sharpe' && d1.id === '' && /^\[DECISION\] sixfold-followup-email-off\n/.test(d1.text) && /APPROVED/.test(d1.text) && /His note: turn it off today/.test(d1.text) && /this one item only/.test(d1.text) && /waiting drop sixfold-followup-email-off/.test(d1.text), 'Waiting on you: the desk gets the item, APPROVED, his note, the one-item rule and how to take it off');
    ok(await nodeUntil(() => /h20261118120000eeee/.test(fs.readFileSync(path.join(DATA, 'jarvis', 'decisions.json'), 'utf8'))), 'Waiting on you: the decision is kept on the server with the desk ticket it went in');
    ok(await until('/Approved/.test(document.querySelector("[data-wait=\\"sixfold-followup-email-off\\"]").innerText) && /sent to the desk/.test(document.querySelector("[data-wait=\\"sixfold-followup-email-off\\"]").innerText) && !document.querySelector("[data-wait=\\"sixfold-followup-email-off\\"] [data-act]")'), 'Waiting on you: the item shows Approved, sent to the desk, with no buttons left');
    const r4 = await apiPost('jvdecide', { id: 'sixfold-followup-email-off', at: now - 4000, decision: 'decline' });
    ok(!r4.ok && /Already decided/.test(r4.error), 'Waiting on you: a second tap on the same item is refused'); }

  /* ---- 3. Reminders */
  { const SEEDS = ['2026-11-24T08:00:00-07:00', '2026-11-24T08:00:00-07:00', '2026-12-08T08:00:00-07:00', '2026-12-10T08:00:00-07:00', '2026-12-15T08:00:00-07:00', '2027-01-04T08:00:00-07:00', '2027-10-01T08:00:00-06:00'].filter(s => new Date(s) > new Date()).length;
    ok(rems().filter(r => r.by === 'seed').length === SEEDS && await ev('document.querySelectorAll("#p-remind [data-rem]").length') === SEEDS, 'Reminders: the dated ones from TASKS.md and memory are in, once (' + SEEDS + ')');
    ok(/reMarkable/.test(await ev('document.getElementById("p-remind").innerText')) || SEEDS < 6, 'Reminders: reMarkable is among them');
    ok(/Connect the calendar again/.test(await ev('document.getElementById("p-remind").innerText')), 'Reminders: the calendar is read-only for now, so it offers Connect again');
    reqs.length = 0;
    await ev('document.getElementById("ask").value="remind me tomorrow at 3pm to call Tyler"'); await click('.cmdbar .snd');
    ok(await until('/Reminder set for/.test(document.querySelector(".chat").innerText)'), 'Reminders: "remind me tomorrow at 3pm to call Tyler" is set from the bar');
    ok(!reqs.some(r => /action=(chat|helpsend)\b/.test(r)) && rems().some(r => r.text === 'Call Tyler' && r.date === tomorrow && r.time === '15:00' && r.state === 'open'), 'Reminders: read on the page with no model call; saved for tomorrow at 15:00');
    await click('#remadd'); await until('!!document.getElementById("remtext")');
    const later = denver(Date.now() + 10 * 86400000).date;
    await ev('document.getElementById("remtext").value="Renew the Peak domain";document.getElementById("remdate").value=' + JSON.stringify(later)); await click('#remsave');
    ok(await until('!document.getElementById("sheet") && /Renew the Peak domain/.test(document.getElementById("p-remind").innerText)'), 'Reminders: the Add form sets one and it shows in the panel');
    const tyler = rems().find(r => r.text === 'Call Tyler');
    await click('[data-rem="' + tyler.id + '"] [data-op=done]');
    ok(await until('!document.querySelector("[data-rem=\\"' + tyler.id + '\\"]")') && rems().find(r => r.id === tyler.id).state === 'done', 'Reminders: Done takes it off');
    const peak = rems().find(r => r.text === 'Renew the Peak domain');
    await click('[data-rem="' + peak.id + '"] [data-op=snooze]');
    ok(await nodeUntil(() => rems().find(r => r.id === peak.id).date === denver(Date.now() + 11 * 86400000).date), 'Reminders: +1 day moves it a day');
    /* the 10-minute check pushes what is due, once */
    const dn = denver(Date.now() - 10 * 60000);
    if (dn.date === denver().date) {
      const ad = await apiPost('jvremind', { text: 'Due now test', date: dn.date, time: dn.time });
      ok(ad.ok, 'Reminders: one due ten minutes ago can still be set');
      const c1 = await cronReminders(), log1 = fs.existsSync(PUSHLOG) ? fs.readFileSync(PUSHLOG, 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
      ok(c1.reminders && c1.reminders.pushed === 1 && log1.length === 1 && log1[0].text === 'Due now test' && log1[0].title === 'J.A.R.V.I.S. reminder' && log1[0].url === '/a-e018bb82/jarvis/', 'Reminders: the 10-minute check pushes the due one to his phone (' + JSON.stringify(c1) + ')');
      const c2 = await cronReminders();
      ok(c2.reminders.pushed === 0 && fs.readFileSync(PUSHLOG, 'utf8').trim().split('\n').length === 1 && rems().find(r => r.text === 'Due now test').pushedAt > 0, 'Reminders: and only once');
    } else { ok(true, 'skipped near midnight'); ok(true, 'skipped'); ok(true, 'skipped'); }
    ok(!(G.events || []).length, 'Reminders: nothing goes on the calendar while it is read-only');
    /* he connects the calendar again (write): the next check puts the open ones on it */
    const ac = JSON.parse(fs.readFileSync(path.join(DATA, 'accounts.json'), 'utf8')); ac['m.sharpe@traverse.example.test'].calWrite = true; fs.writeFileSync(path.join(DATA, 'accounts.json'), JSON.stringify(ac));
    const c3 = await cronReminders(), open = rems().filter(r => r.state === 'open' && r.due > Date.now() / 1000);
    ok(c3.reminders.calendar === open.length && (G.events || []).length === open.length && G.events.every(e => /^Reminder: /.test(e.summary)) && open.every(r => /^ev\d+$/.test(r.calId)), 'Reminders: with write access, each open one goes on the Traverse calendar once (' + JSON.stringify(c3.reminders) + ')');
    ok((await cronReminders()).reminders.calendar === 0, 'Reminders: and not twice'); }

  /* ---- 6. Money */
  { const mt = await ev('document.getElementById("p-money").innerText');
    ok(/\$212\.66/.test(mt) && /Surge \$104\.84/.test(mt) && /\$1,900/.test(mt) && /Spend Ledger/.test(mt), 'Money: the Spend Ledger totals, by company');
    ok(/\$399/.test(mt) && /3 payments/.test(mt) && /\$120\.50 · \$40/.test(mt) && /Read only/.test(mt), 'Money: Traverse Stripe, read only: this month, available and pending');
    ok(new Date('2026-12-10T08:00:00-07:00') < new Date() || (/Adobe Express trial/.test(mt) && /trial ends/i.test(mt) && /reMarkable subscription/.test(mt)), 'Money: renewals and trial ends from the reminders');
    const js = await ev('fetch("../api.php?action=jvstatus").then(r=>r.text())');
    ok(!js.includes('4242424242424242') && !js.includes(SECRETS[4]) && !/"card"|"key"|"token"/.test(js), 'Money: only numbers pass: no card, key or token reaches the page'); }

  /* ---- 2. Meeting notes */
  { await ev('[...document.querySelectorAll(".chip")].find(c=>/Meeting notes/.test(c.textContent)).click()'); await until('!!document.getElementById("meetnotes")');
    await ev('(()=>{const n=document.getElementById("meetnotes");n.value="Tyler wants the sponsor offer by Friday.\\nAsk: send him the expo rental price.";n.dispatchEvent(new Event("input"))})()');
    ok(await ev('document.getElementById("meetsend").disabled && document.querySelectorAll(".cos button").length===6'), 'Meeting notes: six companies to pick from, and Send waits until one is picked (never guessed)');
    await click('.cos [data-co=Other]');
    ok(await ev('document.getElementById("meetsend").disabled'), 'Meeting notes: Other needs a name too');
    await click('.cos [data-co=Peak]');
    const n1 = hsAll().length;
    ok(await ev('!document.getElementById("meetsend").disabled'), 'Meeting notes: picked, it can go');
    await click('#meetsend');
    ok(await nodeUntil(() => hsAll().length === n1 + 1), 'Meeting notes: one message to the desk');
    const mm = hsAll().pop();
    ok(/^\[MEETING NOTES\]\nCompany: Peak \(Matthew's own client work\)\nDate: \d{4}-\d\d-\d\d\n\nTyler wants the sponsor offer/.test(mm.text) && /never sent/.test(mm.text) && /TASKS\.md/.test(mm.text), 'Meeting notes: the company first, the date, the notes, and the rules (to-dos, drafts never sent)');
    ok(await until('/Meeting notes · Peak/.test(document.querySelector(".chat").innerText)'), 'Meeting notes: his bubble says what went'); }

  /* ---- 7. Remember this */
  { const n2 = hsAll().length;
    const txt = await ev('(()=>{const m=[...document.querySelectorAll(".msg.ai")].pop();const b=m.querySelector(".rmb");b.click();return m.innerText})()');
    ok(await until('!!document.getElementById("remember")') && txt.includes(await ev('document.getElementById("remember").value')) && (await ev('document.getElementById("remember").value')).length > 5, 'Remember: the button on an answer opens with its text');
    await ev('document.getElementById("remember").value="Peak sponsor offer is due to Tyler by Friday"'); await click('#remembersend');
    ok(await nodeUntil(() => hsAll().length === n2 + 1) && /^\[REMEMBER THIS\]\nPeak sponsor offer is due to Tyler by Friday\n/.test(hsAll().pop().text), 'Remember: it goes to the desk to be saved in memory');
    ok(await ev('document.querySelectorAll(".msg .rmb").length') >= 4 && await ev('[...document.querySelectorAll(".chip")].some(c=>/Remember this/.test(c.textContent))'), 'Remember: on every message, and as a chip'); }

  /* ---- 1. Laptop asleep */
  { await click('#brainswitch');
    ok(await ev('getComputedStyle(document.getElementById("lpline")).display!=="none" && /Laptop awake: desk requests run now/.test(document.getElementById("lpline").innerText)'), 'Laptop: beside the desk switch, awake');
    const sf = path.join(DATA, 'jarvis', 'status.json'), st0 = fs.readFileSync(sf, 'utf8'), stj = JSON.parse(st0); stj.pushedAt = now - 7200; fs.writeFileSync(sf, JSON.stringify(stj)); fs.writeFileSync(path.join(DATA, 'jarvis', 'beat.txt'), String(now - 5400));
    await ev('document.dispatchEvent(new Event("visibilitychange"))');
    ok(await until('/Laptop asleep since .+: desk requests will run when it wakes/.test(document.getElementById("lpline").innerText) && /Laptop asleep since/i.test(document.querySelector(".top").innerText)'), 'Laptop: asleep since the last heartbeat, said beside the desk switch and on top');
    await ev('document.getElementById("ask").value="Check the overnight log"'); await click('.cmdbar .snd');
    ok(await until('/desk requests will run when it wakes/.test([...document.querySelectorAll(".acard")].pop().innerText)'), 'Laptop: sending to the desk while it sleeps says so on the card');
    fs.writeFileSync(sf, st0); fs.writeFileSync(path.join(DATA, 'jarvis', 'beat.txt'), String(Math.floor(Date.now() / 1000)));
    await click('#brainswitch');
    ok(await ev('getComputedStyle(document.getElementById("lpline")).display==="none"'), 'Laptop: the line hides with the Assistant (it works either way)'); }

  /* ---- 8. Driving mode */
  { await click('#voiceswitch');   /* Voice off: driving mode reads aloud anyway */
    await click('#drivebtn'); await sleep(300);
    ok(await ev('document.getElementById("app").classList.contains("drive") && [...document.querySelectorAll(".dgrid button")].map(b=>b.getAttribute("data-drive")).join()==="Brief me,What’s new,Remind me,Talk" && !document.querySelector(".pnl")'), 'Driving: four big buttons and no panels');
    ok(await ev('(()=>{const b=document.querySelector(".dgrid button").getBoundingClientRect();return b.height>=90})()'), 'Driving: the buttons are big');
    const s0 = await ev('window.__said.length');
    await click('[data-drive="What’s new"]'); await sleep(300);
    ok(await ev('window.__said.length') === s0 + 1, 'Driving: replies are read aloud even with Voice off');
    reqs.length = 0;
    await ev('window.__srText="remind me tomorrow at 9am to check the trailer lights"'); await click('#drivetalk'); await sleep(600); await ev('window.__srStop()');
    ok(await nodeUntil(() => rems().some(r => r.text === 'Check the trailer lights' && r.date === tomorrow && r.time === '09:00'), 6000), 'Driving: Talk, then speaking a reminder sets it by itself (hands-free)');
    ok(!reqs.some(r => /action=chat\b/.test(r)), 'Driving: with no model call');
    ok(/off/.test(await ev('document.getElementById("relisten").textContent')), 'Driving: the mic does not reopen after a reply unless he turns that on');
    await click('#relisten'); await sleep(150);
    ok(/on/.test(await ev('document.getElementById("relisten").textContent')) && await ev('localStorage.getItem("jarvis.relisten")') === 'true', 'Driving: Listen again is a switch, kept on this device');
    await click('#relisten'); await sleep(100);
    ok(/ringer switch/.test(await ev('document.querySelector(".dopts").innerText')), 'Driving: the iPhone ringer-switch note is on screen');
    await shot('jarvis-drive');
    await click('#driveexit'); await sleep(300);
    ok(await ev('document.getElementById("app").classList.contains("desk") && document.querySelectorAll(".pnl").length===9'), 'Driving: Exit brings the full screen back');
    await click('#voiceswitch'); }
  ok(errs.length === 0, 'no script errors in the eight new parts (' + errs.join(' | ') + ')');

  /* ---- desktop idle shot: a fresh load */
  await cdp('Page.reload'); await until('document.querySelectorAll(".msg.ai").length>0', 9000); await sleep(1200);
  await shot('jarvis-desktop-idle');

  /* ================================================================ 11. the phone */
  await phone(); await cdp('Page.reload'); await until('!!document.querySelector(".phone .tabs")', 9000); await sleep(1400);
  ok(await ev('document.getElementById("app").classList.contains("phone") && document.querySelectorAll(".phone .tabs button").length===5'), 'phone: the Halo phone layout with five tabs');
  ok(await ev('!!document.querySelector(".phone .core svg") && document.querySelectorAll(".phone .tiles .pnl").length===3'), 'phone: the core and three tiles');
  ok(await ev('document.documentElement.scrollWidth<=390 && document.body.scrollWidth<=390'), 'phone: nothing wider than the screen');
  ok(await ev('(()=>{const b=document.querySelector(".cmdbar").getBoundingClientRect();return b.bottom<=844 && b.top>300})()'), 'phone: the command bar sits above the tabs, on screen');
  ok(/Answering: Assistant, instant/.test(await ev('document.getElementById("brainlabel").textContent')), 'phone: the brain is named on the bar');
  await shot('jarvis-phone-idle');
  await ev('[...document.querySelectorAll(".chip")].find(c=>/Peak/.test(c.textContent)).click()'); await sleep(500);
  ok(/Peak desk: 6 follow-ups due/.test(await ev('document.querySelector(".chat").innerText')), 'phone: an answer card');
  await shot('jarvis-phone-answer');
  await click('.tabs button[data-tab=inbox]'); await sleep(300);
  ok(await ev('document.querySelectorAll(".phone .ibr").length===4 && document.querySelectorAll(".phone .needs .li").length>=3'), 'phone Inbox tab: Needs you and the four folding rows');
  await click('.phone .ibr .ibh'); await sleep(200);
  ok(await ev('!!document.querySelector(".phone .ibr.open")'), 'phone: a row opens on tap');
  await shot('jarvis-phone-inbox');
  await click('.phone .needs .li'); await until('!!document.getElementById("reply")');
  ok(await ev('(()=>{const s=document.querySelector(".sheet").getBoundingClientRect();return s.width<=390 && s.left>=0})()'), 'phone: the reply sheet fills the screen');
  await ev('document.querySelector(".sheet .x").click()'); await sleep(200);
  await click('.tabs button[data-tab=team]'); await sleep(300);
  ok(/Deposit link says/.test(await ev('document.querySelector(".pscroll").innerText')) && await ev('!!document.getElementById("p-waiting")'), 'phone Team tab: Waiting on you, then the team requests');
  ok(await ev('!!document.querySelector(".phone .hd #drivebtn")'), 'phone: Drive is one tap away in the header');
  await click('.tabs button[data-tab=today]'); await sleep(300);
  ok(await ev('["today","remind","cal","builds","money"].every(k=>!!document.getElementById("p-"+k)) && !document.getElementById("p-brief")'), 'phone Today tab: Today, Reminders, Calendar, Builds, Money; no brief panel unless asked (19 Nov)');
  await click('.tabs button[data-tab=more]'); await sleep(300);
  ok(/Full inbox/.test(await ev('document.querySelector(".pscroll").innerText')) && /Groceries/.test(await ev('document.querySelector(".pscroll").innerText')) && /Settings/.test(await ev('document.querySelector(".pscroll").innerText')), 'phone More: the Assistant\'s own pages are reachable');
  await ev('[...document.querySelectorAll(".vlist button")].find(b=>/Full inbox/.test(b.textContent)).click()'); await sleep(1500);
  ok(await ev('(()=>{const f=document.querySelector("#view iframe");try{return f && /a-e018bb82\\/$/.test(f.contentWindow.location.pathname)}catch(e){return false}})()'), 'the full inbox opens inside, as a view');
  ok(errs.length === 0, 'no script errors on the phone (' + errs.join(' | ') + ')');
} finally { try { ws && ws.close(); } catch {} ch.kill(); srv.kill(); gsrv.close(); }

/* ================================================================ 12. the hub tab opens it; the staff J.A.R.V.I.S. has no way here */
{
  const hub = fs.readFileSync(path.join(REPO, 'assistant', 'hub', 'index.html'), 'utf8');
  ok(/\{ id: 'jarvis', name: 'J\.A\.R\.V\.I\.S\.', url: '\/a-e018bb82\/jarvis\/'/.test(hub), 'the hub\'s J.A.R.V.I.S. tab opens /a-e018bb82/jarvis/');
  ok(!/summit-de59ae83\/\?jarvis=1'/.test(hub), 'the hub no longer opens the field app\'s chat for J.A.R.V.I.S.');
  const staff = ['traverse/app/summit-de59ae83/index.html', 'traverse/app/api/rounds.php'].map(f => path.join(REPO, f)).filter(f => fs.existsSync(f));
  ok(staff.length === 2 && staff.every(f => !/a-e018bb82|assistant-private\/(data|lib|app\.php)/.test(fs.readFileSync(f, 'utf8'))), 'the staff app and its API never name the Assistant\'s page, code or data (rounds.php only loads the shared SDK from assistant-private/vendor)');
  const ed = path.join(REPO, 'traverse', 'editions', 'dist', 'public_html');
  const edPages = fs.existsSync(ed) ? fs.readdirSync(ed).map(d => path.join(ed, d, 'index.html')).filter(f => fs.existsSync(f)) : [];
  ok(edPages.every(f => !/a-e018bb82|assistant-private\/(data|lib|app\.php)/.test(fs.readFileSync(f, 'utf8'))), 'nor does any edition or install page, Houston\'s included (' + edPages.length + ')');
  /* 19 Nov: a due reminder's phone alert: jvpush.php, command line only, the Field app's own Matthew-only alert; it never writes into a chat thread */
  const jp = fs.readFileSync(path.join(REPO, 'assistant', 'server', 'private', 'jvpush.php'), 'utf8');
  ok(/PHP_SAPI !== 'cli'/.test(jp) && /helpAlertMatthew\(/.test(jp) && !/help-reply|helpsend|appendLine|helpFile\(|pushName|mail\(|curl_/.test(jp), 'jvpush.php: command line only, Matthew\'s own alert, no chat thread, no email');
  const lib = fs.readFileSync(path.join(REPO, 'assistant', 'server', 'private', 'lib', 'jarvis.php'), 'utf8');
  ok(!/sixfold-data|sixfold-private|help\.log|c-houston|outbox-data|peak-desk-data/.test(lib), 'the Assistant\'s J.A.R.V.I.S. code reads no other app\'s files');
}
console.log('\n' + pass + ' passed, ' + failN + ' failed' + (fs.existsSync(SHOTS) ? '  (screenshots in ' + SHOTS + ')' : ''));
process.exit(failN ? 1 : 0);
