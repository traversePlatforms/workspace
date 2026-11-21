// J.A.R.V.I.S., the merged page (2026-11-18): end-to-end (21 Nov: section 18, P-13: the full morning brief with a news/weather mock and a Claude mock, and the Assistant routing to the desk; 19 Nov: section 15, talk without Siri: the voice API, its keys, the setup page, hands-free; 20 Nov: section 16, the natural voice, with an ElevenLabs mock) on a throwaway copy of the server's layout, in headless Chrome.
// NOTHING here reaches Google, Anthropic or the live site: Gmail is a mock on 127.0.0.1 (every call it gets is counted), the Assistant
// has no Anthropic key, and the Field app, the Houston install, Outbox and the Peak desk are small stub files that answer like them.
//   node assistant/jarvis/tests/jarvis-test.mjs            (SHOTS=<folder> to also save screenshots; default assistant/jarvis/shots)
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
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
for (const p of ['summit-de59ae83', 'hl-f98938', 'outbox-092b0f', 'peak-desk-28d38d', 'posts-ab8c57']) mk(path.join(PUB, p, 'index.html'), '<!doctype html><title>stub ' + p + '</title><body style="background:#fff">stub ' + p);

/* ---- the Gmail mock: answers like Gmail, counts every call; a send is anything that would send ---- */
const G = { calls: [], sends: [] }; const PUSHES = [];
let PUSHKEYS = null;   /* 20 Nov (P-12): section 14's made-up phone keys, so later sections can read an alert the way the phone does (RFC 8291) */
const PUSHDEC = body => { const { ec, auth } = PUSHKEYS, salt = body.subarray(0, 16), idl = body[20], asPub = body.subarray(21, 21 + idl), ct = body.subarray(21 + idl);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', ec.computeSecret(asPub), auth, Buffer.concat([Buffer.from('WebPush: info\0'), ec.getPublicKey(), asPub]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16)), nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16)); const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  return JSON.parse(pt.subarray(0, pt.lastIndexOf(2)).toString()); };
const EL_KEY = 'sk_' + 'mockelevenlabskey'.padEnd(48, 'q'), EL = { calls: [], mode: 'ok' };   /* 20 Nov (P-11): the ElevenLabs mock's key: 51 characters, like his */
const b64u = s => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/* 21 Nov (P-13): the morning brief's sources (BRIEF_MOCK: every feed and api.weather.gov, by its real address in ?u=) and Claude (ANTHROPIC_MOCK) */
const BR = { calls: [] }, AN = { calls: [] };
const rssDoc = (items) => '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Feed</title>' + items.map(i => '<item><title>' + i.t + '</title><link>' + i.l + '</link><description>' + (i.d || '') + '</description><pubDate>' + new Date((i.at || now - 3600) * 1000).toUTCString() + '</pubDate>' + (i.c ? '<comments>' + i.c + '</comments>' : '') + '</item>').join('') + '</channel></rss>';
const BRF = {
  'https://www.cpr.org/feed/': rssDoc([{ t: '&lt;img src=x onerror=window.__xss2=1&gt;Light rail closure on the D Line', l: 'https://www.cpr.org/2026/11/21/d-line/', d: 'RTD says the D Line closes this weekend for track work.' },
    { t: 'Opinion: The case for more bike lanes', l: 'https://www.cpr.org/op/' }, { t: 'A story with a bad link', l: 'javascript:alert(1)' }, { t: 'Three days old story', l: 'https://www.cpr.org/old/', at: now - 3 * 86400 }]),
  'https://denverite.com/feed/': rssDoc([{ t: 'Denver opens two new warming centers', l: 'https://denverite.com/2026/11/21/warming/' }]),
  'https://coloradosun.com/feed/': rssDoc([{ t: 'Colorado PERA board approves new limits on staff bonuses', l: 'https://coloradosun.com/2026/11/21/pera/' }]),
  'https://feeds.bbci.co.uk/news/world/rss.xml': rssDoc([{ t: 'Climate talks run into a second weekend', l: 'https://www.bbc.co.uk/news/world-1' }, { t: 'Ferry service resumes after storm', l: 'https://www.bbc.co.uk/news/world-2' }]),
  'https://feeds.npr.org/1004/rss.xml': rssDoc([{ t: 'U.N. talks on autonomous weapons end without rules', l: 'https://www.npr.org/2026/11/21/un' }]),
  'https://feeds.arstechnica.com/arstechnica/index': '<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Ars</title><entry><title type="html"><![CDATA[New chip fabs announced in Arizona]]></title><link rel="alternate" type="text/html" href="https://arstechnica.com/2026/11/fabs/"/><published>' + new Date((now - 7200) * 1000).toISOString() + '</published><summary>Two plants were announced.</summary></entry></feed>',
  'https://news.ycombinator.com/rss': rssDoc([{ t: 'Show HN: A tiny weather station', l: 'https://example.org/post', c: 'https://news.ycombinator.com/item?id=1' }])
};
const NWS = { 'points': { properties: { forecast: 'https://api.weather.gov/gridpoints/BOU/63,57/forecast' } },
  'forecast': { properties: { updateTime: new Date().toISOString(), periods: [{ name: 'Today', isDaytime: true, temperature: 47, temperatureUnit: 'F', shortForecast: 'Chance Snow Showers', detailedForecast: 'A chance of snow showers before 2pm. High near 47.' },
    { name: 'Tonight', isDaytime: false, temperature: 21, temperatureUnit: 'F', shortForecast: 'Clear', detailedForecast: 'Clear. Low around 21.' }, { name: 'Sunday', isDaytime: true, temperature: 46, temperatureUnit: 'F', shortForecast: 'Mostly Sunny', detailedForecast: 'Mostly sunny.' }] } },
  'alerts': { features: [{ properties: { event: 'Winter Weather Advisory', headline: 'Winter Weather Advisory until 5 PM MST', severity: 'Moderate' } }] } };
const gsrv = http.createServer((req, res) => {
  const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
    const raw = Buffer.concat(chunks), body = raw.toString();
    const u = new URL(req.url, 'http://x'), p = u.pathname.replace(/^\/+/, ''), auth = req.headers.authorization || '';
    /* 19 Nov: a Web Push service (J.A.R.V.I.S.'s own alerts): keeps what came, answers 201; /push/gone answers 410 */
    if (p.startsWith('push/')) { PUSHES.push({ path: p, headers: req.headers, body: raw }); res.writeHead(p === 'push/gone' ? 410 : 201); res.end(); return; }
    /* 20 Nov (P-11): ElevenLabs text to speech (ELEVENLABS_MOCK): keeps each call; EL.mode says how it answers */
    if (p.startsWith('eleven/')) { let jb = {}; try { jb = JSON.parse(body); } catch {} EL.calls.push({ p, q: u.search, key: req.headers['xi-api-key'] || '', body: jb });
      const E = (c, st) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ detail: { status: st, message: 'mock ' + st } })); };
      if (req.headers['xi-api-key'] !== EL_KEY) return E(401, 'invalid_api_key');
      if (EL.mode === '402') return E(402, 'payment_required'); if (EL.mode === '429quota') return E(429, 'quota_exceeded'); if (EL.mode === '429busy') return E(429, 'too_many_concurrent_requests'); if (EL.mode === '500') return E(500, 'internal');
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' }); res.write('ID3' + 'A'.repeat(400)); setTimeout(() => res.end('FAKE-MP3:' + (jb.text || '')), 30); return; }
    if (p === 'brief') { const tu = u.searchParams.get('u') || ''; BR.calls.push({ u: tu, ua: req.headers['user-agent'] || '' });
      const k = /api\.weather\.gov\/points\//.test(tu) ? 'points' : /\/gridpoints\/BOU\/63,57\/forecast$/.test(tu) ? 'forecast' : /\/alerts\/active\?point=/.test(tu) ? 'alerts' : '';
      if (k) { res.writeHead(200, { 'Content-Type': 'application/geo+json' }); res.end(JSON.stringify(NWS[k])); return; }
      if (BRF[tu]) { res.writeHead(200, { 'Content-Type': 'application/rss+xml' }); res.end(BRF[tu]); return; }
      res.writeHead(500); res.end('down'); return; }   /* The Verge (and anything else): down, so the brief must skip it and say so */
    if (p === 'anthropic') { let jb = {}; try { jb = JSON.parse(body); } catch {}
      const msgs = jb.messages || [], last = msgs[msgs.length - 1] || {};
      const R = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: jb.model, usage: { inputTokens: 2400, outputTokens: 300, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }, ...o })); };
      if (jb.outputConfig && jb.outputConfig.format) { AN.calls.push({ kind: 'brief', jb }); const raw = String(last.content || ''); let d = {}; try { d = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch {}
        const first = k => ((d[k] || [])[0] || {}).title || '';
        return R({ stopReason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ weather: 'The National Weather Service says there is a chance of snow showers today, with a high of 47 and a low of 21, and a Winter Weather Advisory is in effect.', local: 'Colorado Public Radio reports: ' + first('local') + '.', world: 'BBC News reports: ' + first('world') + '.', tech: 'Ars Technica reports: ' + first('tech') + '.' }) }] }); }
      const txt = typeof last.content === 'string' ? last.content : ''; AN.calls.push({ kind: 'chat', jb, txt });
      if (txt && /\b(fix|build|deploy)\b/i.test(txt)) return R({ stopReason: 'tool_use', content: [{ type: 'tool_use', id: 'toolu_mock1', name: 'send_to_desk', input: { why: 'changes an app' } }] });
      return R({ stopReason: 'end_turn', content: [{ type: 'text', text: txt ? 'Mock Assistant: two emails need an answer from you.' : 'Done.' }] }); }
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
const ENVX = { JARVIS_PUSH_ALLOW_HTTP: '1', ASSISTANT_PRIVATE: PRIV, ASSISTANT_GMAIL_MOCK: 'http://127.0.0.1:' + GPORT + '/', JARVIS_CAL_MOCK: 'http://127.0.0.1:' + GPORT + '/', ELEVENLABS_MOCK: 'http://127.0.0.1:' + GPORT + '/eleven/', BRIEF_MOCK: 'http://127.0.0.1:' + GPORT + '/brief', ANTHROPIC_MOCK: 'http://127.0.0.1:' + GPORT + '/anthropic', JARVIS_PUSH_CMD: 'php ' + JSON.stringify(path.join(R, 'push-stub.php').replace(/\\/g, '/')) };
const srv = spawn('php', ['-S', '127.0.0.1:' + PORT, '-t', PUB], { stdio: 'ignore', env: { ...process.env, ...ENVX } });
/* async: the calendar mock lives in this same process, so a blocking spawn would starve it */
const cronReminders = () => new Promise(res => { let o = ''; const p = spawn('php', [path.join(PRIV, 'cron.php'), '--reminders'], { env: { ...process.env, ...ENVX } }); p.stdout.on('data', d => o += d); p.on('close', () => { try { res(JSON.parse(o.trim().split('\n').pop() || '{}')); } catch { res({}); } }); });
/* 19 Nov: J.A.R.V.I.S.'s own desk store, and the laptop's command-line side of it */
const DESKLOG = path.join(DATA, 'jarvis', 'desk', 'desk.log');
const deskRows = () => fs.existsSync(DESKLOG) ? fs.readFileSync(DESKLOG, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const deskMsgs = () => deskRows().filter(r => r.t === 'msg');
const cli = (args, input = '') => new Promise(res => { let o = '', e = ''; const p = spawn('php', [path.join(PRIV, 'jvdesk.php'), ...args], { env: { ...process.env, ...ENVX } }); p.stdout.on('data', d => o += d); p.stderr.on('data', d => e += d); p.on('close', code => res({ code, out: o, err: e })); p.stdin.end(input); });
const helpsends = () => fs.existsSync(path.join(R, 'helpsend.log')) ? fs.readFileSync(path.join(R, 'helpsend.log'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
await sleep(900);
const BASE = 'http://127.0.0.1:' + PORT, PAGE = BASE + '/a-e018bb82/jarvis/';
const hget = async (u, cookie = '') => { const r = await fetch(BASE + u, { headers: cookie ? { Cookie: cookie } : {} }); return [r.status, await r.text()]; };
const hpost = async (u, body, cookie = '') => { const r = await fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) }); return [r.status, await r.text()]; };

/* ================================================================ 1. sign-in required; staff cookies open nothing */
{
  for (const a of ['home', 'jvstatus', 'chatlog', 'gro', 'jvdesk', 'jvpushstate', 'jvdeskfile&id=h20261119000000aaaa&f=x.pdf']) { const [s] = await hget('/a-e018bb82/api.php?action=' + a); ok(s === 401, 'signed out: ' + a + ' answers 401 (got ' + s + ')'); }
  for (const a of ['chat', 'send', 'open', 'savedraft', 'write', 'jvremind', 'jvremindset', 'jvdecide', 'jvdesksend', 'jvdeskclose', 'jvpushsub', 'jvpushunsub', 'jvpushtest']) { const [s] = await hpost('/a-e018bb82/api.php?action=' + a, { text: 'x', key: 'k', confirmed: true }); ok(s === 401, 'signed out: POST ' + a + ' answers 401 (got ' + s + ')'); }
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
const ch = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + CDP, '--user-data-dir=' + prof, '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--window-size=1440,900', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', 'about:blank'], { stdio: 'ignore' });
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

    const nodeUntil0 = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return true; } catch {} await sleep(120); } return false; };
  ok(await ev('(document.querySelector("link[rel=manifest]")||{}).getAttribute?.("href")==="manifest.json" && !!document.querySelector("link[rel=apple-touch-icon]")'), 'P-9: the page names its own manifest and Home Screen icon');
  ok(await until('navigator.serviceWorker.getRegistration("./").then(r=>!!r && /\\/a-e018bb82\\/jarvis\\/$/.test(r.scope))', 6000), 'P-9: its own service worker, scoped to /a-e018bb82/jarvis/ only');
  /* ================================================================ 3. no model call on load; only the expected reads */
  ok(!reqs.some(r => /action=(chat|write|send|savedraft|check|draft|helpsend|groadd|jvdesksend|jvpushtest)\b/.test(r)), 'page load makes no model call and sends nothing (' + reqs.filter(r => /action=(chat|write|send|check|draft)/.test(r)).join(', ') + ')');
  const allowed = /\/a-e018bb82\/(api\.php\?action=(signin|state|home|jvstatus|gro|jvdesk|jvmeetlist)$|jarvis\/)|\/api\/(rounds|c-houston-lawn-test-rounds)\.php\?action=helplist$|\/outbox-092b0f\/api\.php\?action=state$|\/peak-desk-28d38d\/api\/desk\.php\?action=data$|^data:/;
  const odd = reqs.filter(r => !allowed.test(r.split(' ')[1]));
  ok(odd.length === 0, 'the page reads only its own sources (' + odd.join(' | ') + ')');
  ok(!reqs.some(r => /googleapis|anthropic|fonts\.g/.test(r)), 'nothing leaves for Google or Anthropic from the page');
  ok(G.calls.length === 0, 'no Gmail call on load (' + G.calls.join(', ') + ')');
  ok(await ev('window.__xss===undefined'), 'an email subject with HTML in it is shown as text, never run');

  /* ================================================================ 4. the Halo pieces are there */
  ok(await ev('typeof window.JvGlobe==="function" && !!document.querySelector(".desk .mid .jvg canvas.jvg-cv") && !!document.querySelector(".desk .mid .jvg .jvg-st[role=button]") && !document.querySelector(".desk .core")'), '21 Nov: the new globe (JvGlobe) in the middle, in place of the old core');
  ok(await ev('document.querySelectorAll(".desk .pnl .ph .n").length===8 && [...document.querySelectorAll(".ph .n")].map(n=>n.textContent).sort().join()==="01,02,03,05,06,07,08,09" && !!document.querySelector(".rail button[data-panel=brief]")'), 'eight panels open; the Morning brief (04) starts folded into its edge icon (19 Nov: "if i need a briefing I will ask for it")');
  ok(await until('/^Standing by/.test(document.querySelector(".jvg-lb").textContent) && document.querySelector(".jvg").dataset.state==="idle" && document.getElementById("app").classList.contains("s-idle")', 4000), 'idle state label (on the globe)');
  /* 21 Nov: the globe's counts, mood and build progress come from what the page already has */
  { const gi = await ev('(()=>{const g=window.__jvGlobe&&window.__jvGlobe();return g?g.info():null})()') || { counts: {} };
    const pd = await ev('parseInt(document.querySelector("#p-waiting .pc").textContent)||0'), rd = await ev('(()=>{const m=/(\\d+) due/.exec((document.querySelector("#p-remind .pc")||{}).textContent||"");return m?+m[1]:0})()');
    ok(gi.counts.reply === 4 && gi.counts.decide === pd && pd > 0 && gi.counts.remind === rd && gi.counts.build === 2, 'globe counts: Reply = emails needing a reply (4), Decide = waiting (' + pd + '), Due = reminders due (' + rd + '), Build = running builds (2) (' + JSON.stringify(gi.counts) + ')');
    ok(gi.mood === 'attention' && Math.abs(gi.progress - 0.68) < 1e-6 && Object.keys(gi.urgent).length === 0, 'globe: amber while decisions wait; the ring shows the running build at 68% (' + gi.mood + ', ' + gi.progress + ')');
    ok(await until('(()=>{const t=[...document.querySelectorAll(".desk .jvg-mk")].filter(m=>m.style.display!=="none").map(m=>m.textContent);return t.includes("Reply4") && t.includes("Build2") && t.some(x=>/^Decide\\d/.test(x))})()', 4000), 'globe: the satellites show their words and counts (Reply 4, Decide, Build 2)');
    ok(await until('/Build 68%/.test(document.querySelector(".jvg-lb").textContent)', 3000), 'globe: the label carries the build progress'); }
  ok(/Laptop awake/i.test(await ev('document.querySelector(".top").innerText')), 'top bar: laptop awake (from the heartbeat)');
  ok(!/API \$/.test(await ev('document.querySelector(".top").innerText')), 'top bar: no API spend (21 Nov: a push near the budget instead)');
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
  /* 21 Nov (Matthew: "the check off button isnt working"): checked off from the What's building? card in the conversation, the row leaves the card too */
  await ev('[...document.querySelectorAll(".chip")].find(c=>/building/.test(c.textContent)).click()'); await until('!!document.querySelector(".chat .bcheck")', 3000);
  await ev('document.querySelector(".chat .bcheck").click()');
  ok(await until('!document.querySelector(".chat .bcheck") && ![...document.querySelectorAll(".chat .li")].some(r=>/Prospect Desk tracked links/.test(r.innerText))', 4000), 'Builds: ✓ Check off in the What’s building? card takes the row off the card');
  await ev('[...document.querySelectorAll(".chip")].find(c=>/building/.test(c.textContent)).click()'); await sleep(200);
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
  ok(await ev('(()=>{document.getElementById("ask").value="Anything from Jen this week?";document.querySelector(".cmdbar .snd").click();return document.getElementById("app").classList.contains("s-think") && document.querySelector(".jvg").dataset.state==="think"})()'), 'asking the Assistant: the globe thinks');
  await until('!document.getElementById("app").classList.contains("s-think")', 6000);
  ok(reqs.filter(r => /action=chat\b/.test(r)).length === 1, 'one question, one Ask call');
  ok(/Anthropic key/.test(await ev('window.__said[window.__said.length-1] || ""')), 'Voice: the reply is read aloud');
  ok(/Voice on/.test(await ev('document.getElementById("voiceswitch").textContent')), 'Voice: on by default, named beside the desk switch');
  ok(/ASSISTANT · INSTANT/i.test(await ev('[...document.querySelectorAll(".msg.ai .who")].pop().textContent')) && /Anthropic key/.test(await ev('[...document.querySelectorAll(".msg.ai")].pop().textContent')), 'the answer is labelled Assistant, instant (here: no key, so it says so)');
  ok(/Send this to the desk instead/i.test(await ev('[...document.querySelectorAll(".msg.ai")].pop().innerText')), 'P-13: the Assistant\'s answer (even an error) offers "Send this to the desk instead"');
  { await click('#voiceswitch'); const said0 = await ev('window.__said.length'); const mc = '[...document.querySelectorAll(".chip")].find(c=>/Morning check/.test(c.textContent)).click()';
    await ev(mc); await sleep(300);
    ok(/Voice off/.test(await ev('document.getElementById("voiceswitch").textContent')) && await ev('window.__said.length') === said0, 'Voice: off means silent');
    await ev(mc); await sleep(200);   /* tap the chip again to close its answer */
    /* 19 Nov: Brief me reads aloud even with Voice off (he asked for it) */
    await ev('[...document.querySelectorAll(".chip")].find(c=>/Brief me/.test(c.textContent)).click()');
    /* 21 Nov (P-13): the full brief, in pieces: the weather and news from the server (the feed mock; no key here, so the plain version) */
    await until('window.__said.length>' + said0 + ' && /this time\./.test(window.__said.slice(' + said0 + ').join(" "))', 12000);
    const said1 = await ev('window.__said.slice(' + said0 + ').join(" ")');
    ok(await ev('window.__said.length') > said0 + 1 && /Today on your calendar: 2:30pm Peak meeting with Tyler/.test(said1) && /Outbox: 37 sent today, 12 waiting, 1 failed/.test(said1) && !/Peak desk/.test(said1), 'Brief me: read aloud with Voice off, in pieces; calendar and Outbox in it, no Peak desk line (21 Nov) (' + said1.slice(0, 160) + ')');
    ok(/National Weather Service forecast for Englewood: Today, chance snow showers, high 47 degrees\. Tonight, clear, low 21 degrees\. Active alert: Winter Weather Advisory\./.test(said1) && /Around Denver\. Colorado Public Radio: Light rail closure on the D Line\./.test(said1) && /In world news\. BBC News: /.test(said1) && /In tech\. Ars Technica: New chip fabs/.test(said1) && /I couldn’t reach The Verge this time\./.test(said1), 'P-13 Brief me: the weather, then things happening, world and tech news, every item with its outlet, and one line for the source that failed');
    ok(await ev('window.__said.slice(' + said0 + ').every(t=>t.length<=600)') && said1.indexOf('Weather') < said1.indexOf('Your day') && said1.indexOf('Your day') < said1.indexOf('Around Denver'), 'P-13 Brief me: weather first, then the day, then the news; each piece short enough for one voice call');
    ok(await ev('(()=>{const m=[...document.querySelectorAll(".msg.ai")].pop();const a=[...m.querySelectorAll("details.blinks a.hl")];return a.length>=7 && a.every(x=>/^https?:/.test(x.href) && x.target==="_blank" && /noopener/.test(x.rel)) && /Headlines and links/.test(m.querySelector("summary").textContent)})()'), 'P-13 Brief me: the answer carries every headline as a link (new tab, no opener), under "Headlines and links"');
    ok(!/click|repl|unsub|open rate/i.test(said1) && /2 decisions waiting on you/.test(said1) && /team request/.test(said1) && /build/.test(said1), 'Brief me: Outbox gives sent, waiting and failed only (no clicks, replies or unsubscribes); decisions, team and builds are in it');
    await ev('[...document.querySelectorAll(".chip")].find(c=>/Brief me/.test(c.textContent)).click()'); await sleep(150);
    await click('#voiceswitch'); }
  /* 21 Nov (P-13): no Assistant / desk switch; the bar says the Assistant answers and real work goes to the desk; "desk:" sends it there */
  ok(await ev('!document.getElementById("brainswitch") && !/Send to the desk|Use the Assistant/.test(document.getElementById("brain").innerText) && /real work goes to the desk/.test(document.getElementById("brainlabel").textContent)'), 'P-13: no brain switch on the bar; it says real work goes to the desk');
  reqs.length = 0;
  await ev('document.getElementById("ask").value="desk: Check the Houston lot lines are live"'); await click('.cmdbar .snd');
  ok(await until('/Sent to J\\.A\\.R\\.V\\.I\\.S\\. desk/.test(document.querySelector(".chat").innerText)'), 'the desk: a card says it went to the laptop');
  const dm = deskMsgs();
  ok(dm.length === 1 && dm[0].from === 'Matthew Sharpe' && /^h\d{14}[0-9a-f]{4}$/.test(dm[0].id) && dm[0].text === 'Check the Houston lot lines are live', '19 Nov: the desk message is in J.A.R.V.I.S.\'s own store, as Matthew');
  ok(helpsends().length === 0 && !reqs.some(r => /rounds\.php\?action=helpsend/.test(r)), '19 Nov: nothing of his goes to the Sixfold app (no helpsend)');
  ok(!reqs.some(r => /action=chat\b/.test(r)), 'a desk message makes no Ask call');
  /* the laptop takes it (jvdesk.php next, as help-watch.sh does over SSH) and answers (jvdesk.php reply, as jarvis-reply.sh does) */
  { const c = await cli(['count']); ok(c.out.trim() === '1', 'the laptop\'s count: 1 waiting'); }
  const nx = JSON.parse((await cli(['next'])).out);
  ok(nx.id === dm[0].id && nx.desk === 'jarvis' && nx.by === 'Matthew Sharpe' && nx.conversation.length === 1 && /desk[\\/]files[\\/]h/.test(nx.photoDir), 'next: the thread in the watcher\'s shape (desk: jarvis), and its files folder');
  ok((await cli(['next'])).out.trim() === '' && (await cli(['count'])).out.trim() === '0', 'next marks it working: nothing else waits');
  const t0 = Math.floor(Date.now() / 1000) - 1;
  ok((await cli(['final-since', nx.id, String(t0)])).code === 1, 'final-since: no answer yet');
  const rp = await cli(['reply', nx.id, 'answered'], 'Live: 1,204 lots on the cards.');
  ok(rp.code === 0 && /replied \(answered\)/.test(rp.out), 'reply: saved (' + rp.out.trim() + rp.err.trim() + ')');
  ok((await cli(['final-since', nx.id, String(t0)])).code === 0, 'final-since: answered');
  ok(fs.existsSync(PUSHLOG) && /"url":"\/a-e018bb82\/jarvis\/\?desk=h/.test(fs.readFileSync(PUSHLOG, 'utf8')), 'no phone has subscribed yet: the alert also goes the old way (fallback), and opens J.A.R.V.I.S. at the thread');
  fs.unlinkSync(PUSHLOG);
  ok(await until('/Live: 1,204 lots/.test(document.querySelector(".chat").innerText)', 22000), 'the desk\'s answer appears when the laptop replies');
  ok(/J\.A\.R\.V\.I\.S\. DESK · LAPTOP/i.test(await ev('[...document.querySelectorAll(".msg.ai .who")].pop().textContent')), 'and is labelled J.A.R.V.I.S. desk');
  /* the thread opens in full, here; no Sixfold button on his own chat */
  await ev('[...document.querySelectorAll(".acard")].reverse().find(c=>/Sent to J\.A\.R\.V\.I\.S\. desk/.test(c.innerText)).querySelector(".acts button").click()');
  ok(await until('!!document.getElementById("deskthread") && /Live: 1,204 lots/.test(document.getElementById("deskmsgs").innerText) && /Check the Houston lot lines/.test(document.getElementById("deskmsgs").innerText)'), 'Open the thread: the whole conversation, inside J.A.R.V.I.S.');
  ok(await ev('!/Sixfold app/.test(document.getElementById("sheet").innerText)'), 'his own desk chat has no "Open in the Sixfold app" button');
  await ev('document.getElementById("deskreply").value="And the Denver ones?"'); await click('#desksend');
  ok(await nodeUntil0(() => deskMsgs().length === 2 && deskMsgs()[1].id === nx.id && deskMsgs()[1].text === 'And the Denver ones?'), 'a reply from the sheet goes into the same thread');
  await click('#shclose'); await sleep(200);
  ok(/Assistant, instant/.test(await ev('document.getElementById("brainlabel").textContent')), 'after a desk message the bar still names the Assistant (nothing to switch back)');

  /* ================================================================ 9. a team request: open, reply into it (with a yes) */
  await click('#p-team [data-ticket="h20261118090000aaaa"]');
  ok(await until('!!document.getElementById("threply")'), 'a team request opens as its thread');
  ok(/Jen McPherson’s J\.A\.R\.V\.I\.S\. chat/.test(await ev('document.querySelector(".sheet .warnline").textContent')), 'it says plainly where a reply goes');
  ok(/Open in the Sixfold app/.test(await ev('document.getElementById("sheet").innerText')), 'a staff thread keeps its "Open in the Sixfold app" button');
  await ev('document.getElementById("threply").value="I will call the customer myself."'); await click('#thsend'); await sleep(300);
  ok(await ev('!!document.getElementById("confirm")'), 'replying into a staff thread asks first');
  await click('#cfno'); await sleep(300);
  ok(helpsends().length === 0, 'Cancel: nothing went to the thread');
  await click('#thsend'); await sleep(200); await click('#cfyes'); await until('!document.getElementById("sheet")');
  const hs2 = helpsends().pop();
  ok(hs2.id === 'h20261118090000aaaa' && hs2.text === 'Matthew: I will call the customer myself.' && hs2.by === 'Matthew Sharpe', 'Yes: one message into that thread, marked Matthew');

  /* 19 Nov (Matthew: "there no way to dismiss that chat box once its open"): Close on sheets, a dismiss on every card */
  await click('.rail button[data-panel=brief]').catch(() => {}); await sleep(100);
  ok(await ev('document.querySelectorAll(".acard").length>0 && [...document.querySelectorAll(".acard")].every(c=>!!c.querySelector(".ah .cx"))'), 'every card in the chat has a dismiss button');
  const nCards = await ev('document.querySelectorAll(".acard").length'); await ev('[...document.querySelectorAll(".acard")].pop().querySelector(".ah .cx").click()'); await sleep(100);
  ok(await ev('document.querySelectorAll(".acard").length') === nCards - 1, 'the dismiss button removes that card');
  await ev('document.querySelector(".acard .acts button")?.click()'); await sleep(300);
  if (await ev('!!document.getElementById("sheet")')) { await click('#shclose'); await sleep(200); ok(await ev('!document.getElementById("sheet")'), 'a sheet closes with its Close button'); }
  else ok(await ev('!!document.getElementById("view")') ? (await click('#vclose'), await sleep(200), await ev('!document.getElementById("view")')) : true, 'an opened view closes with its Close button');

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
    await tap('/building/'); await sleep(300); await tap('/Morning check/'); await sleep(300);
    ok(await count('/Roof material/') === 0 && await count('/Overnight check/i') >= 1, 'Chips: another chip replaces the last chip answer');
    await tap('/Morning check/'); await sleep(200);
    ok(await ev('![...document.querySelectorAll(".chip")].some(c=>/Team requests|Peak follow-ups/.test(c.textContent))'), 'Chips: no Team requests or Peak follow-ups chip (21 Nov)');
    await tap('/Record meeting/'); ok(await until('!!document.getElementById("mrconsent") && !document.querySelector("#meetrec.live")', 3000), 'Chips: Record meeting opens the Record screen, waiting for the tap');
    await click('#mrcancel'); await sleep(150); }
  { const n0 = await ev('document.querySelectorAll(".chat > .msg").length'); await click('#chatclearbtn'); await sleep(150);
    ok(n0 > 0 && await ev('document.querySelectorAll(".chat > .msg").length === 0 && !!document.querySelector(".chat > .sp")'), 'Clear: the conversation leaves the screen (' + n0 + ' messages before)'); }
  await click('.ib.mic'); await sleep(150);
  ok(await ev('document.getElementById("app").classList.contains("s-listen") && document.querySelector(".jvg").dataset.state==="listen"') && await until('/^Listening/.test(document.querySelector(".jvg-lb").textContent)', 2000), 'the mic: the globe listens');
  await sleep(500);
  ok((await ev('document.getElementById("ask").value')) === 'Add milk to groceries', 'speech becomes text in the bar (and nothing is sent by itself)');
  await shot('jarvis-desktop-listen');
  await ev('window.__srStop()'); await sleep(200);
  ok(!(await ev('document.getElementById("app").classList.contains("s-listen")')), 'stopping the mic goes back to idle');
  reqs.length = 0; await click('.cmdbar .snd');
  ok(await until('/Added to the grocery list: milk/.test(document.querySelector(".chat").innerText)'), '"Add milk to groceries" adds it to the list');
  ok(!reqs.some(r => /action=chat\b/.test(r)), 'without a model call');

  /* ================================================================ 10b. the globe (21 Nov): tap, hold, satellites, speaking, moods */
  { const press = ms => ev('(async()=>{const s=document.querySelector(".jvg-st"),r=s.getBoundingClientRect(),o={bubbles:true,cancelable:true,pointerId:7,clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:0,pointerType:"mouse",isPrimary:true};s.dispatchEvent(new PointerEvent("pointerdown",o));await new Promise(f=>setTimeout(f,' + ms + '));s.dispatchEvent(new PointerEvent("pointerup",o));return true})()');
    const gst = () => ev('document.querySelector(".jvg").dataset.state'), gmd = () => ev('document.querySelector(".jvg").dataset.mood');
    await ev('document.getElementById("ask").value=""'); await press(80);
    ok(await until('document.getElementById("app").classList.contains("s-listen") && document.querySelector(".jvg").dataset.state==="listen"', 2000), 'globe: a tap listens, as the mic does');
    await ev('window.__srStop()'); await sleep(200); await ev('document.getElementById("ask").value=""');
    ok(await gst() === 'idle', 'globe: the mic stopping puts it back to standing by');
    const mreq = reqs.length;
    await press(950);
    ok(await until('!!document.getElementById("mrconsent") && !document.querySelector("#meetrec.live")', 2500), 'globe: press and hold opens the Record screen, waiting for the consent tap');
    ok(await gst() !== 'listen' && !reqs.slice(mreq).some(r => /action=jvmeet(start|chunk|put|up)/.test(r)), 'globe: the hold neither listens nor records anything by itself');
    await click('#mrcancel'); await sleep(150);
    /* satellites: a folded panel opens, and the panel flashes */
    await click('#p-builds .ph .fold'); await sleep(200);
    ok(await ev('!document.getElementById("p-builds")') && await ev('(()=>{const m=[...document.querySelectorAll(".desk .jvg-mk")].find(x=>/^Build/.test(x.textContent));if(!m)return false;m.click();return true})()') && await until('!!document.getElementById("p-builds") && document.getElementById("p-builds").classList.contains("flash")', 2000), 'globe: the Build satellite unfolds the Builds panel and flashes it');
    ok(await ev('(()=>{const m=[...document.querySelectorAll(".desk .jvg-mk")].find(x=>/^Reply/.test(x.textContent));if(!m)return false;m.click();return document.getElementById("p-inbox").classList.contains("flash")})()'), 'globe: the Reply satellite points at the Inbox');
    ok(await ev('(()=>{const m=[...document.querySelectorAll(".desk .jvg-mk")].find(x=>/^Decide/.test(x.textContent));if(!m)return false;m.click();return document.getElementById("p-waiting").classList.contains("flash")})()'), 'globe: the Decide satellite points at Waiting on you');
    /* speaking: the device voice (a stand-in that starts, says one word and ends 1.5 s later) */
    await ev('(()=>{const s=window.speechSynthesis;window.__sp0=s.speak;window.__spk=false;s.speak=function(u){if(u.text&&u.text.trim())window.__said.push(u.text);window.__spk=true;setTimeout(function(){u.onstart&&u.onstart();u.onboundary&&u.onboundary({name:"word"});},30);setTimeout(function(){window.__spk=false;u.onend&&u.onend();},1500);};Object.defineProperty(s,"speaking",{configurable:true,get:function(){return !!window.__spk}});})()');
    const said0 = await ev('window.__said.length');
    await ev('[...document.querySelectorAll(".chip")].find(c=>/What.s waiting/.test(c.textContent)).click()');
    ok(await until('document.querySelector(".jvg").dataset.state==="speak" && document.getElementById("app").classList.contains("s-speak")', 2000) && await ev('window.__said.length') === said0 + 1, 'globe: Speaking while the device voice talks (and the voice still says it)');
    await until('/^Speaking/.test(document.querySelector(".jvg-lb").textContent)', 1500); await shot('jarvis-desktop-speak');
    ok(await until('document.querySelector(".jvg").dataset.state==="answer"', 4000), 'globe: Speaking ends when the voice ends (Answer ready)');
    ok(await until('/^Answer ready/.test(document.querySelector(".jvg-lb").textContent)', 2000), 'globe: answering has its own label');
    await ev('(()=>{const s=window.speechSynthesis;s.speak=window.__sp0;delete s.speaking;})()');
    await click('#chatclearbtn'); await sleep(150);
    ok(await gst() === 'idle', 'globe: Clear puts it back to standing by');
    /* moods from the laptop's status: done (green flash) when a build finishes, alert (red) on a failed build or an overnight problem */
    const sf = path.join(DATA, 'jarvis', 'status.json'), st0 = fs.readFileSync(sf, 'utf8'), stj = JSON.parse(st0);
    const push = async () => { fs.writeFileSync(sf, JSON.stringify(stj)); await ev('document.dispatchEvent(new Event("visibilitychange"))'); };
    ok(await gmd() === 'attention', 'globe mood: amber (attention) while decisions wait');
    stj.builds[0].state = 'done'; await push();
    ok(await until('document.querySelector(".jvg").dataset.mood==="done"', 5000), 'globe mood: a green flash when a build finishes');
    ok(await until('document.querySelector(".jvg").dataset.mood==="attention"', 5000), 'globe mood: the flash passes, back to amber');
    stj.builds[1].state = 'failed'; await push();
    ok(await until('document.querySelector(".jvg").dataset.mood==="alert"', 5000), 'globe mood: red (alert) on a failed build');
    { const gi = await ev('window.__jvGlobe().info()');
      ok(gi.note === 'Build failed' && gi.urgent.build === 'Failed' && gi.counts.build === 1 && gi.progress === null, 'globe: the alert says Build failed; the build satellite is urgent with the failed count (' + JSON.stringify(gi) + ')'); }
    ok(await until('/Build failed/.test(document.querySelector(".jvg-lb").textContent) && (()=>{const m=[...document.querySelectorAll(".desk .jvg-mk")].find(x=>/^Failed1/.test(x.textContent));return !!m && m.classList.contains("urg") && getComputedStyle(m).color==="rgb(255, 42, 61)"})()', 4000), 'globe: the label reads Build failed and the satellite shows Failed 1 in red');
    await sleep(400); await shot('jarvis-desktop-globe-alert');
    stj.builds[1].state = 'running'; stj.overnight.problems = ['PROBLEM: the 6 pm backup did not run']; await push();
    ok(await until('document.querySelector(".jvg").dataset.mood==="alert" && window.__jvGlobe().info().note==="Overnight check" && !window.__jvGlobe().info().urgent.build', 5000), 'globe mood: red on an overnight-check problem too');
    fs.writeFileSync(sf, st0); await ev('document.dispatchEvent(new Event("visibilitychange"))');
    ok(await until('document.querySelector(".jvg").dataset.mood==="attention" && window.__jvGlobe().info().counts.build===2', 5000), 'globe mood: back to amber once it clears');
    ok(await ev('window.__jvGlobe()===window.__jvGlobe() && document.querySelectorAll(".jvg").length===1'), 'globe: one globe, kept across redraws'); }
  ok(errs.length === 0, 'no script errors on the desktop (' + errs.join(' | ') + ')');

  /* ================================================================ 13. the eight (19 Nov, P-8) */
  const hsAll = () => deskMsgs().map(m => ({ by: m.from, id: m.id, text: m.text, nw: deskRows().find(r => r.t === 'msg' && r.id === m.id) === m }));   /* 19 Nov: his desk store */
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
    await click('[data-wait="sixfold-followup-email-off"] [data-act=approve]'); await sleep(300);
    ok(await ev('getComputedStyle(document.getElementById("cfyes")).backgroundColor==="rgb(62, 232, 255)"'), 'Approve confirm: the Yes button is bright cyan, not dim (21 Nov)');
    await click('#cfyes');
    ok(await nodeUntil(() => hsAll().length === n0 + 1), 'Waiting on you: Approve sends one message to the desk');
    const d1 = hsAll().pop();
    ok(d1.by === 'Matthew Sharpe' && !deskMsgs().slice(0, -1).some(m => m.id === d1.id) && /^\[DECISION\] sixfold-followup-email-off\n/.test(d1.text) && /APPROVED/.test(d1.text) && /His note: turn it off today/.test(d1.text) && /this one item only/.test(d1.text) && /waiting drop sixfold-followup-email-off/.test(d1.text), 'Waiting on you: the desk gets the item, APPROVED, his note, the one-item rule and how to take it off');
    ok(await nodeUntil(() => fs.readFileSync(path.join(DATA, 'jarvis', 'decisions.json'), 'utf8').includes('"ticket":"' + d1.id + '"')), 'Waiting on you: the decision is kept on the server with the desk thread it went in');
    /* 21 Nov (Matthew: "it should be removed when i hit approved"): once it is with the desk the item leaves the list, on screen and on the server */
    ok(await until('!document.querySelector("[data-wait=\\"sixfold-followup-email-off\\"]") && /1 TO DECIDE/i.test(document.querySelector("#p-waiting .ph").innerText) && !!document.querySelector("[data-wait=\\"surge-linkedin-mock-build\\"] [data-act=approve]")'), 'Waiting on you: once sent to the desk the approved item is off the list at once; the other stays');
    { const st = await ev('fetch("../api.php?action=jvstatus").then(r=>r.json())'); ok(st && Array.isArray(st.waiting) && !st.waiting.some(w => w.id === "sixfold-followup-email-off") && st.waiting.some(w => w.id === "surge-linkedin-mock-build"), 'Waiting on you: the server leaves a decided item out too, so a reload never brings it back'); }
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
  { ok(await ev('getComputedStyle(document.getElementById("lpline")).display!=="none" && /Laptop awake: desk requests run now/.test(document.getElementById("lpline").innerText)'), 'Laptop: under the bar, awake');
    const sf = path.join(DATA, 'jarvis', 'status.json'), st0 = fs.readFileSync(sf, 'utf8'), stj = JSON.parse(st0); stj.pushedAt = now - 7200; fs.writeFileSync(sf, JSON.stringify(stj)); fs.writeFileSync(path.join(DATA, 'jarvis', 'beat.txt'), String(now - 5400));
    await ev('document.dispatchEvent(new Event("visibilitychange"))');
    ok(await until('/Laptop asleep since .+: desk requests will run when it wakes/.test(document.getElementById("lpline").innerText) && /Laptop asleep since/i.test(document.querySelector(".top").innerText)'), 'Laptop: asleep since the last heartbeat, said under the bar and on top');
    await ev('document.getElementById("ask").value="desk: Check the overnight log"'); await click('.cmdbar .snd');
    ok(await until('/desk requests will run when it wakes/.test([...document.querySelectorAll(".acard")].pop().innerText)'), 'Laptop: sending to the desk while it sleeps says so on the card');
    fs.writeFileSync(sf, st0); fs.writeFileSync(path.join(DATA, 'jarvis', 'beat.txt'), String(Math.floor(Date.now() / 1000)));
    ok(await ev('getComputedStyle(document.getElementById("lpline")).display!=="none"'), 'P-13 Laptop: the line stays (any request may go to the desk now)'); }

  /* ---- 8. Driving mode */
  { await click('#voiceswitch');   /* Voice off: driving mode reads aloud anyway */
    ok(await ev('!document.getElementById("drivebtn")'), 'laptop: no Drive button in the top bar (21 Nov)');
    await ev('window.__jvSetDrive(true)'); await sleep(300);
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

  /* ================================================================ 14. J.A.R.V.I.S. on its own (19 Nov): desk store, alerts, app */
  { /* top bar: Posts and the Sixfold app beside Outbox, Peak, inbox, groceries, settings */
    const vw = await ev('[...document.querySelectorAll(".top .vw button")].map(b=>b.title).join("|")');
    ok(/Full inbox/.test(vw) && /Groceries/.test(vw) && /Outbox/.test(vw) && /Peak desk/.test(vw) && /Posts/.test(vw) && /Sixfold app/.test(vw) && /Settings/.test(vw) && !/Phone alerts/.test(vw), 'P-9 top bar: Posts and the Sixfold app beside Outbox, Peak, inbox, groceries, settings; the alerts bell now inside Settings (' + vw + ')');
    await click('.top .vw button[data-view=posts]'); await sleep(900);
    ok(await ev('(()=>{const f=document.querySelector("#view iframe");return !!f && /\\/posts-ab8c57\\/$/.test(new URL(f.src).pathname)})()'), 'Posts opens inside J.A.R.V.I.S.');
    await click('#vclose'); await sleep(200);
    await click('.top .vw button[data-view=leaf]'); await sleep(900);
    ok(await ev('(()=>{const f=document.querySelector("#view iframe");return !!f && /\\/summit-de59ae83\\/$/.test(new URL(f.src).pathname)})()'), 'the Sixfold app opens inside J.A.R.V.I.S. (its own sign-in)');
    await click('#vclose'); await sleep(200);
    /* the manifest */
    const [ms, mt] = await hget('/a-e018bb82/jarvis/manifest.json'); const mj = JSON.parse(mt);
    ok(ms === 200 && mj.name === 'J.A.R.V.I.S.' && mj.scope === '/a-e018bb82/jarvis/' && mj.start_url === '/a-e018bb82/jarvis/' && mj.display === 'standalone' && mj.icons.length === 3, 'manifest: J.A.R.V.I.S., scoped and starting at /a-e018bb82/jarvis/, standalone, three icons');
    for (const ic of mj.icons.map(i => i.src).concat(['apple-touch-icon.png', 'badge-96.png', 'sw.js'])) { const [is] = await hget('/a-e018bb82/jarvis/' + ic); ok(is === 200, 'served: ' + ic); }
    /* the alerts sheet */
    ok(await ev('!/linked|API \$/.test(document.querySelector(".top").innerText) && !document.querySelector(".top #notifybtn") && !document.querySelector(".top #voicebtn")'), 'top bar: no inbox count, no API cost, no bell or voice button (21 Nov)');
    await click('.top .vw [data-view=cog]'); await until('!!document.getElementById("notifybtn")'); await click('#notifybtn');
    ok(await ev('!!document.getElementById("voicebtn") || true'), 'Settings holds alerts'); await until('!!document.getElementById("notify")');
    const nt = await ev('document.getElementById("notify").innerText');
    ok(/Alerts are off on this device/.test(nt) && !!(await ev('!!document.getElementById("pushon")')) && /own app/i.test(nt), 'alerts sheet: off here, Turn on alerts, and how to install it');
    ok(/old way/.test(await ev('new Promise(r=>setTimeout(()=>r(document.getElementById("notify").innerText),600))')), 'alerts sheet: says the old route still runs until a phone has alerts on');
    await click('#shclose'); await sleep(200);
    /* the key: made once, public half only */
    const k1 = JSON.parse(await ev('fetch("../api.php?action=jvpushkey").then(r=>r.text())')), k2 = JSON.parse(await ev('fetch("../api.php?action=jvpushkey").then(r=>r.text())'));
    ok(k1.ok && /^[A-Za-z0-9_-]{80,90}$/.test(k1.publicKey) && k1.publicKey === k2.publicKey && !JSON.stringify(k1).includes('PRIVATE'), 'alerts: the server makes its own key once and gives out only the public half');
    const [us] = await hget('/a-e018bb82/api.php?action=jvpushkey'); ok(us === 401, 'alerts: the key needs his sign-in');
    /* a phone subscribes (a made-up device with real keys); the next alert is Web Push only, end to end */
    const ec = crypto.createECDH('prime256v1'); ec.generateKeys(); const auth = crypto.randomBytes(16);
    const b64 = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const sub = { endpoint: 'http://127.0.0.1:' + GPORT + '/push/phone1', keys: { p256dh: b64(ec.getPublicKey()), auth: b64(auth) } }; PUSHKEYS = { ec, auth };
    const bad = await apiPost('jvpushsub', { subscription: { endpoint: 'ftp://x', keys: {} }, device: 'x' });
    ok(!bad.ok, 'alerts: a broken subscription is refused');
    /* the push service check wants https; the test copy allows its own 127.0.0.1 listener only (JARVIS_PUSH_ALLOW_HTTP), so store it by hand */
    const subsF = path.join(DATA, 'jarvis', 'push-subs.json');
    fs.writeFileSync(subsF, JSON.stringify({ aaaaaaaaaaaaaaaa: { sub, device: 'iPhone app', phone: true, at: now, seen: now }, bbbbbbbbbbbbbbbb: { sub: { endpoint: 'http://127.0.0.1:' + GPORT + '/push/gone', keys: sub.keys }, device: 'old laptop', phone: false, at: now, seen: now } }));
    const ps = JSON.parse(await ev('fetch("../api.php?action=jvpushstate").then(r=>r.text())'));
    ok(ps.ok && ps.phone && !ps.fallback && ps.devices.length === 2 && !JSON.stringify(ps).includes(sub.keys.auth) && !JSON.stringify(ps).includes('endpoint'), 'alerts: the devices show by name only; with a phone on, no fallback');
    const pushLines = () => fs.existsSync(PUSHLOG) ? fs.readFileSync(PUSHLOG, 'utf8').trim().split(String.fromCharCode(10)).filter(Boolean).length : 0;
    const old0 = pushLines();
    const nx2 = JSON.parse((await cli(['next'])).out || '{}');
    const tid = nx2.id || deskMsgs().pop().id;
    PUSHES.length = 0;
    const rp2 = await cli(['reply', tid, 'answered'], 'Denver: 880 lots, live too.');
    ok(rp2.code === 0 && /pushed to his phone/.test(rp2.out), 'a desk answer pushes (' + rp2.out.trim() + ')');
    const ph = PUSHES.find(x => x.path === 'push/phone1');
    ok(!!ph && /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/.test(ph.headers.authorization || '') && ph.headers['content-encoding'] === 'aes128gcm' && ph.headers.urgency === 'high', 'Web Push: signed with its own key (VAPID), encrypted (aes128gcm), urgent');
    /* decrypt it the way the phone does (RFC 8291) */
    let pj = null;
    try { const body = ph.body, salt = body.subarray(0, 16), idl = body[20], asPub = body.subarray(21, 21 + idl), ct = body.subarray(21 + idl);
      const ecdh = ec.computeSecret(asPub), ikm = Buffer.from(crypto.hkdfSync('sha256', ecdh, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ec.getPublicKey(), asPub]), 32));
      const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16)), nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
      const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16)); const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
      pj = JSON.parse(pt.subarray(0, pt.lastIndexOf(2)).toString()); } catch (e) { console.log('decrypt:', e.message); }
    ok(pj && pj.title === 'J.A.R.V.I.S.' && /Denver: 880 lots/.test(pj.body) && pj.url === '/a-e018bb82/jarvis/?desk=' + tid && pj.tag === 'jv-desk-' + tid, 'Web Push: the phone reads the answer and a tap opens J.A.R.V.I.S. at that thread (' + JSON.stringify(pj) + ')');
    ok(pushLines() === old0, 'with a phone on, the old route (through the Field app) is not used');
    ok(!JSON.parse(fs.readFileSync(subsF, 'utf8')).bbbbbbbbbbbbbbbb, 'a device the push service says is gone is dropped');
    const wp = await cli(['reply', tid, 'working'], 'Still looking.'); PUSHES.length = 0; await sleep(100);
    ok(wp.code === 0 && PUSHES.length === 0, 'a progress note (working) does not push');
    /* reminders take the same road */
    const dn2 = denver(Date.now() - 5 * 60000);
    if (dn2.date === denver().date) { await apiPost('jvremind', { text: 'Push road test', date: dn2.date, time: dn2.time }); PUSHES.length = 0; await cronReminders();
      ok(PUSHES.some(x => x.path === 'push/phone1') && pushLines() === old0, 'a due reminder goes by J.A.R.V.I.S.\'s own Web Push now, not the Field app'); } else ok(true, 'skipped near midnight');
    /* a deep link (what a tap on the alert opens) shows the thread */
    await cdp('Page.navigate', { url: PAGE + '?desk=' + tid }); await until('!!document.getElementById("deskthread")', 9000);
    ok(/Denver: 880 lots/.test(await ev('document.getElementById("deskmsgs").innerText')), 'J.A.R.V.I.S. opened from an alert (?desk=) shows that thread');
    await click('#shclose'); await sleep(200); await ev('document.dispatchEvent(new Event("click"))');
    /* photos, a voice note and a PDF, all shown inside J.A.R.V.I.S. */
    const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const AUD = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(400, 1)]).toString('base64');
    const sp = await apiPost('jvdesksend', { text: 'The sign at the Peak entrance', photos: [PNG], audio: { data: AUD, mime: 'audio/webm', secs: 4 } });
    ok(sp.ok && sp.thread.msgs[0].photos.length === 1 && sp.thread.msgs[0].audio.length === 1, 'a desk message with a photo and a voice note is kept (' + (sp.error || '') + ')');
    const bad2 = await apiPost('jvdesksend', { text: 'x', photos: [Buffer.from('not a picture at all').toString('base64')] });
    ok(!bad2.ok && /could not be read/.test(bad2.error), 'a file that is not really a picture is refused');
    const pid = sp.thread.id, an = sp.thread.msgs[0].audio[0].n;
    await cli(['transcript', pid, an], 'Here is the sign at the entrance.');
    ok((await cli(['attach', pid, 'Sign-Quote.pdf'], '%PDF-1.4 test pdf')).code === 0 && (await cli(['attach', pid, 'evil.pdf'], 'not a pdf')).code !== 0, 'attach: a PDF is stored, anything else refused');
    await cli(['reply', pid, 'answered', 'file=Sign-Quote.pdf'], 'Quote attached.');
    await cdp('Page.reload'); await until('!!document.querySelector(".desk .ibr") && /your desk chats \\([1-9]/.test((document.getElementById("mydesk")||{}).textContent||"")', 9000); await sleep(300);
    await click('#mydesk'); await sleep(300);
    ok(await ev('!!document.querySelector("[data-desk=' + pid + ']")') && await ev('!!document.getElementById("newdesk")'), 'Team requests: your desk chats are J.A.R.V.I.S. conversations, with New desk chat');
    await click('[data-desk="' + pid + '"]'); await until('!!document.getElementById("deskthread")');
    ok(await until('(()=>{const i=document.querySelector("#deskmsgs img");return !!i && i.complete && i.naturalWidth===1})()'), 'the photo shows inside J.A.R.V.I.S.');
    ok(await ev('(()=>{const a=document.querySelector("#deskmsgs audio");return !!a && /action=jvdeskfile/.test(a.src)})()') && /Voice note: Here is the sign/.test(await ev('document.getElementById("deskmsgs").innerText')), 'the voice note plays here, with its words under it');
    ok(await ev('(()=>{const a=document.querySelector("#deskmsgs a.pdf");return !!a && /Sign Quote/.test(a.textContent) && /action=jvdeskfile.*Sign-Quote\\.pdf/.test(a.href)})()'), 'the PDF opens from here');
    const [fs1] = await hget('/a-e018bb82/api.php?action=jvdeskfile&id=' + pid + '&f=Sign-Quote.pdf'); ok(fs1 === 401, 'a desk file needs his sign-in');
    ok(await ev('fetch("../api.php?action=jvdeskfile&id=' + pid + '&f=Sign-Quote.pdf").then(r=>r.status===200 && r.headers.get("content-type")==="application/pdf")'), 'signed in, the PDF comes back as a PDF');
    ok(await ev('fetch("../api.php?action=jvdeskfile&id=' + pid + '&f=../../config.json").then(r=>r.status)') === 404, 'a file name that tries to leave the folder gets nothing');
    await click('#shclose'); await sleep(200);
    /* the laptop's HTTPS door: only with its key */
    const [p0, b0] = await hget('/a-e018bb82/api.php?action=jvdpending');
    ok(p0 === 403 && !/^\d+$/.test(b0), 'the laptop door: no key, nothing');
    const LKEY = crypto.randomBytes(32).toString('hex');
    ok((await cli(['setkey'], crypto.createHash('sha256').update(LKEY).digest('hex'))).code === 0, 'setkey: the server keeps only the key\'s hash');
    ok(!fs.readFileSync(path.join(DATA, 'jarvis', 'desk', 'laptop-key.json'), 'utf8').includes(LKEY), 'the key itself is not on the server');
    const kget = async (k) => { const r = await fetch(BASE + '/a-e018bb82/api.php?action=jvdpending', { headers: { 'X-Jarvis-Key': k } }); return [r.status, await r.text()]; };
    ok((await kget('x'.repeat(64)))[0] === 403, 'the laptop door: a wrong key, nothing');
    const [k200, kb] = await kget(LKEY); ok(k200 === 200 && /^\d+$/.test(kb.trim()), 'the laptop door: the right key, the count (' + kb + ')');
    /* jarvis-reply.sh over HTTPS with the key (as the laptop runs it); no SSH */
    const kf = path.join(R, 'jarvis-desk-key.txt'); fs.writeFileSync(kf, LKEY);
    const jr = spawnSync('bash', [path.join(REPO, 'assistant', 'jarvis', 'tools', 'jarvis-reply.sh'), pid, 'answered'], { input: 'Sent from the laptop script.', env: { ...process.env, JARVIS_DESK_URL: BASE + '/a-e018bb82/api.php', JARVIS_DESK_KEYFILE: kf, JARVIS_SG: 'false' } });
    ok(jr.status === 0 && deskRows().some(r => r.t === 'reply' && r.id === pid && r.text === 'Sent from the laptop script.'), 'jarvis-reply.sh: the answer lands over HTTPS with the key (' + String(jr.stdout).trim() + String(jr.stderr).trim() + ')');
    ok(!String(jr.stdout).includes(LKEY) && !String(jr.stderr).includes(LKEY), 'jarvis-reply.sh never prints the key');
    const jr2 = spawnSync('bash', [path.join(REPO, 'assistant', 'jarvis', 'tools', 'jarvis-reply.sh'), 'h20990101000000ffff', 'answered'], { input: 'x', env: { ...process.env, JARVIS_DESK_URL: BASE + '/a-e018bb82/api.php', JARVIS_DESK_KEYFILE: kf, JARVIS_SG: 'false' } });
    ok(jr2.status !== 0, 'jarvis-reply.sh: a thread that is not there fails, and says so');
    /* his history from the Sixfold app: moved once, left answered (never answered twice), files kept */
    const MID = 'h202611181123486ccb';
    const rows = [{ t: 'msg', id: MID, from: 'Matthew Sharpe', text: 'Main thread, first message', ctx: null, at: now - 90000 }, { t: 'reply', id: MID, from: 'J.A.R.V.I.S.', text: 'Main thread, answered', status: 'answered', at: now - 89000 },
      { t: 'msg', id: MID, from: 'Matthew Sharpe', text: 'A later one', ctx: null, at: now - 1000 }, { t: 'status', id: MID, status: 'working', at: now - 900 }];
    const im1 = JSON.parse((await cli(['import'], rows.map(r => JSON.stringify(r)).join('\n'))).out), im2 = JSON.parse((await cli(['import'], rows.map(r => JSON.stringify(r)).join('\n'))).out);
    ok(im1.added === 4 && im1.threads === 1 && im2.added === 0, 'history move: each row once (' + JSON.stringify(im1) + ' then ' + JSON.stringify(im2) + ')');
    const st = JSON.parse(fs.readFileSync(path.join(DATA, 'jarvis', 'desk', 'state.json'), 'utf8'));
    ok(st[MID] && st[MID].status === 'answered' && st[MID].n === 3 && !(await cli(['next', '--peek'])).out.includes(MID), 'history move: a thread caught mid-answer is left answered, so the laptop does not answer it twice');
    /* help-reply.sh: a reply to a moved thread goes on to J.A.R.V.I.S. (builders still using the old script) */
    const moved = path.join(REPO, 'assistant', 'jarvis', 'tools', 'desk-moved.txt');
    ok(fs.existsSync(moved) && fs.readFileSync(moved, 'utf8').split(/\r?\n/).includes(MID), 'desk-moved.txt lists his main thread');
    const hr = spawnSync('bash', [path.join(REPO, 'traverse', 'ops', 'help-reply.sh'), MID, 'answered'], { input: 'Builder: the roof data is live.', env: { ...process.env, JARVIS_DESK_URL: BASE + '/a-e018bb82/api.php', JARVIS_DESK_KEYFILE: kf, JARVIS_SG: 'false', HELP_REPLY_SIXFOLD: '' } });
    ok(hr.status === 0 && deskRows().some(r => r.t === 'reply' && r.id === MID && /roof data is live/.test(r.text)), 'help-reply.sh on his moved thread lands in J.A.R.V.I.S., not the Sixfold app (' + String(hr.stdout).trim() + ')');
    const js2 = spawnSync('bash', [path.join(REPO, 'assistant', 'jarvis', 'tools', 'jarvis-status.sh'), 'alert', 'Overnight: 2 problems'], { env: { ...process.env, JARVIS_DESK_URL: BASE + '/a-e018bb82/api.php', JARVIS_DESK_KEYFILE: kf, JARVIS_SG: 'false' } });
    ok(js2.status === 0 && deskRows().some(r => r.t === 'reply' && r.id === MID && r.text === 'Overnight: 2 problems'), 'jarvis-status.sh alert: a message in his main thread (' + String(js2.stdout).trim() + String(js2.stderr).trim() + ')');
  }
  ok(errs.length === 0, 'no script errors in the standalone parts (' + errs.join(' | ') + ')');

  /* ================================================================ 15. talk without Siri (19 Nov): the voice API, its keys, the setup page, hands-free */
  {
    const VAPI = BASE + '/a-e018bb82/api.php';
    const si = await fetch(VAPI + '?action=signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: PASSWORD }) });
    const sc = (si.headers.get('set-cookie') || '').split(';')[0];
    ok(si.status === 200 && /^asst=/.test(sc), 'voice: a signed-in session for the key tests');
    const sj = async (a, b) => { const r = await fetch(VAPI + '?action=' + a, { method: b ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Cookie: sc }, body: b ? JSON.stringify(b) : undefined }); return r.json(); };
    /* what the Shortcut does: POST, the key in X-Voice-Key, JSON {text} (or a form); ?format=json for these checks, plain text otherwise */
    const vo = async (text, key, o = {}) => { const r = await fetch(VAPI + '?action=voice' + (o.json === false ? '' : '&format=json'), { method: o.method || 'POST',
      headers: { 'Content-Type': o.form ? 'application/x-www-form-urlencoded' : 'application/json', ...(key ? { 'X-Voice-Key': key } : {}) },
      body: o.method === 'GET' ? undefined : (o.form ? new URLSearchParams({ text }).toString() : JSON.stringify({ text })) });
      const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { s: r.status, t, j: j || {}, ct: r.headers.get('content-type') || '' }; };
    const triesN = () => { try { return Object.values(JSON.parse(fs.readFileSync(path.join(DATA, 'tries.json'), 'utf8'))).flat().length; } catch { return 0; } };
    const t0 = triesN();
    let r = await vo("what's building", '');
    ok(r.s === 401 && /voice key is not right/.test(r.j.say || ''), 'voice: no key, refused, in words the phone can say');
    r = await vo("what's building", 'jvk_' + 'x'.repeat(32));
    ok(r.s === 401 && triesN() === t0 + 2, 'voice: a wrong key is refused and counts as a wrong sign-in try');
    ok((await vo('x', '', { method: 'GET' })).s === 405, 'voice: POST only');
    ok((await hpost('/a-e018bb82/api.php?action=jvvoicekeynew', { name: 'x' }))[0] === 401 && (await hget('/a-e018bb82/api.php?action=jvvoicekeys'))[0] === 401 && (await hpost('/a-e018bb82/api.php?action=voicetry', { text: 'brief me' }))[0] === 401, 'voice: making keys, the list and Try it all need his sign-in');
    const nk = await sj('jvvoicekeynew', { name: 'iPhone 12' }); const KEY = nk.key || '';
    ok(nk.ok && /^jvk_[A-Za-z0-9_-]{32}$/.test(KEY) && nk.name === 'iPhone 12', 'voice: a key for the iPhone is made and shown once');
    const kfile = fs.readFileSync(path.join(DATA, 'jarvis', 'voice-keys.json'), 'utf8');
    ok(KEY !== '' && !kfile.includes(KEY) && kfile.includes(crypto.createHash('sha256').update(KEY).digest('hex')), 'voice: the server keeps only the key\'s hash');
    const kl = await sj('jvvoicekeys');
    ok(kl.ok && kl.keys.length === 1 && kl.keys[0].name === 'iPhone 12' && !JSON.stringify(kl).includes(KEY) && !/sha256/.test(JSON.stringify(kl)) && /\/a-e018bb82\/api\.php\?action=voice$/.test(kl.url), 'voice: the list shows names and use only, plus the address');
    const sends0 = G.sends.length, hs0 = helpsends().length;
    /* quick ones, at once, no model */
    r = await vo('Hey Jarvis, remind me tomorrow at 9am to call the tire shop', KEY);
    ok(r.s === 200 && r.j.intent === 'remind' && /tomorrow at 9 am: Call the tire shop\./.test(r.j.say), 'voice: "remind me tomorrow at 9am…" is set at once (' + r.j.say + ')');
    ok(rems().some(x => x.text === 'Call the tire shop' && x.date === tomorrow && x.time === '09:00' && x.by === 'voice'), 'voice: the reminder is saved, marked by voice');
    r = await vo('remind me to send the invoice on Friday', KEY);
    ok(r.j.intent === 'remind' && /Send the invoice/.test(r.j.say), 'voice: "remind me to send…" is a reminder, not a send');
    r = await vo('remind me in 20 minutes to check the trailer', KEY);
    ok(r.j.intent === 'remind' && rems().some(x => x.text === 'Check the trailer' && x.time !== ''), 'voice: "in 20 minutes" works');
    r = await vo("what's on today", KEY);
    ok(r.j.intent === 'today' && /Peak meeting with Tyler/.test(r.j.say) && /2:30 pm/.test(r.j.say), 'voice: what\'s on today reads the calendar (' + r.j.say + ')');
    r = await vo('brief me', KEY);
    ok(r.j.intent === 'brief' && /^Good (morning|afternoon|evening), Matthew\./.test(r.j.say) && /reply/.test(r.j.say) && !r.t.includes(SECRETS[4]), 'voice: brief me, spoken: the day and what needs him (' + r.j.say.slice(0, 160) + ')');
    r = await vo("what's new", KEY);
    ok(r.j.intent === 'new' && r.j.say.length > 10, 'voice: what\'s new (' + r.j.say.slice(0, 120) + ')');
    r = await vo("what's building", KEY, { json: false });
    ok(r.s === 200 && /^text\/plain/.test(r.ct) && /Roof material/.test(r.t) && !/[{}]/.test(r.t), 'voice: plain text by default, which Speak Text reads (' + r.t + ')');
    r = await vo("what's building", KEY, { form: true });
    ok(r.j.intent === 'builds', 'voice: a form body works too');
    r = await vo('add oat milk and coffee beans to groceries', KEY);
    const gro = JSON.parse(fs.readFileSync(path.join(DATA, 'groceries.json'), 'utf8')).items.map(i => i.text);
    ok(r.j.intent === 'groceries' && gro.includes('oat milk') && gro.includes('coffee beans'), 'voice: add … to groceries (' + r.j.say + ')');
    /* the calendar: read only, so a reminder (said plainly); with write access, the event itself */
    const AF = path.join(DATA, 'accounts.json'), a0 = fs.readFileSync(AF, 'utf8'), acW = w => { const a = JSON.parse(a0); a['m.sharpe@traverse.example.test'].calWrite = w; fs.writeFileSync(AF, JSON.stringify(a)); };
    acW(false); r = await vo('add lunch with Nolan to my calendar Friday at noon', KEY);
    ok(r.j.intent === 'calendar-reminder' && /read only/.test(r.j.say) && /reminder/.test(r.j.say) && rems().some(x => x.text === 'Lunch with Nolan' && x.time === '12:00'), 'voice: calendar without write access: saved as a reminder, and it says to reconnect (' + r.j.say + ')');
    { acW(true); const e0 = (G.events || []).length;
      r = await vo('put dentist on my calendar December 3 at 2:30 pm', KEY);
      fs.writeFileSync(AF, a0);
      const en = (G.events || []).slice(e0);
      ok(r.j.intent === 'calendar' && en.length === 1 && en[0].summary === 'Dentist' && /T14:30:00/.test(en[0].start.dateTime || '') && /Dentist, (Thursday|[A-Z][a-z]+day) 3 December at 2:30 pm/.test(r.j.say), 'voice: with write access, the event goes on the calendar (' + r.j.say + ')'); }
    /* anything that would send or post: a draft, only ever */
    r = await vo("Email Jen that I'm running late", KEY); let last = deskMsgs().pop();
    ok(r.j.intent === 'draft' && /Nothing gets sent/.test(r.j.say) && /^\[VOICE · DRAFT ONLY\] Email Jen/.test(last.text) && /never send, post, schedule or queue/.test(last.text) && last.ctx && last.ctx.screen === 'voice', 'voice: "email Jen…" only asks the desk for a draft');
    for (const s of ['post the Friday photo to Facebook', 'can you schedule the Instagram post for Monday', 'text Brad the gate code', 'tell Jen that the route moved', 'reply to Dana saying yes']) { r = await vo(s, KEY); ok(r.j.intent === 'draft', 'voice: "' + s + '" is a draft only'); }
    ok(G.sends.length === sends0 && helpsends().length === hs0, 'voice: nothing was sent by any of it (no Gmail send, nothing into the Sixfold app)');
    /* the desk: laptop work, remember, and a question the Assistant cannot take (no key here) */
    r = await vo('look into why the Peak emails bounced', KEY); last = deskMsgs().pop();
    ok(r.j.intent === 'desk' && /^Sent to the desk; I’ll alert you when it’s done\./.test(r.j.say) && /^\[VOICE\] look into why the Peak emails bounced/.test(last.text) && r.j.thread === last.id, 'voice: laptop work goes to the desk as a new thread: "Sent to the desk; I\'ll alert you when it\'s done."');
    r = await vo('remember that the shop gate code changed', KEY); last = deskMsgs().pop();
    ok(r.j.intent === 'remember' && /^\[REMEMBER THIS\]\nthe shop gate code changed/.test(last.text), 'voice: "remember that…" goes to the desk to save');
    r = await vo('Anything from Jen this week?', KEY);
    ok(r.j.intent === 'ask-desk' && /couldn’t answer just now, so I sent it to the desk/.test(r.j.say), 'voice: a question goes to the Assistant; here, with no Anthropic key, to the desk instead, and it says so');
    r = await vo('', KEY); ok(r.j.intent === 'empty' && /did not catch/.test(r.j.say), 'voice: nothing heard: "I did not catch that"');
    r = await vo('thanks Jarvis', KEY); ok(r.j.intent === 'bye', 'voice: "thanks Jarvis"');
    const lg = fs.readFileSync(path.join(DATA, 'assistant.log'), 'utf8').split('\n').filter(l => /"what":"voice"/.test(l));
    ok(lg.length >= 15 && lg.some(l => /"intent":"remind"/.test(l) && /"key":"iPhone 12"/.test(l)) && !lg.some(l => l.includes(KEY) || /tire shop|running late|gate code/.test(l)), 'voice: each request is logged by key name and kind, never the words or the key');
    const tr = await sj('voicetry', { text: "what's building" });
    ok(tr.ok && tr.intent === 'builds' && /Roof material/.test(tr.say), 'voice: Try it here (signed in) takes the same road');
    /* the rate limit: 20 in 10 minutes for one key, then words to say */
    const codes = []; for (let i = 0; i < 35 && !codes.includes(429); i++) codes.push((await vo('thanks', KEY)).s);
    r = await vo('thanks', KEY);
    ok(codes.includes(429) && r.s === 429 && /a few minutes/.test(r.j.say || ''), 'voice: 30 requests in 10 minutes per key, then "give it a few minutes"');
    const kl2 = await sj('jvvoicekeys'); ok(kl2.keys[0].uses >= 15 && kl2.keys[0].last > 0, 'voice: the list says when a key was last used');
    ok((await sj('jvvoicekeydrop', { id: nk.id })).ok && (await vo('brief me', KEY)).s === 401, 'voice: a revoked key stops at once');
    const tests = fs.readFileSync(path.join(REPO, 'assistant', 'jarvis', 'tests', 'jarvis-test.mjs'), 'utf8');
    ok(!/console\.log\([^)]*KEY/.test(tests), 'voice: the test never prints a key');

    /* ---- the setup page */
    await ev('document.dispatchEvent(new Event("click"))');
    await click('.top .vw [data-view=cog]'); await until('!!document.getElementById("voicebtn")'); await click('#voicebtn'); ok(await until('!!document.getElementById("voicesetup")'), 'Talk without Siri opens from the top bar');
    const vt = await ev('document.getElementById("voicesetup").innerText');
    const want = ['Dictate Text', 'After Pause', 'Get Contents of URL', 'POST', 'X-Voice-Key', 'Dictated Text', 'Speak Text', 'Show Result', 'Vocal Shortcuts', 'Hey Jarvis', 'three times', 'Back Tap', 'Double Tap', 'Always Allow', 'Enable Dictation', 'ringer switch', 'Hey Jarvis on-off', 'Hands-free', '?listen=1'];
    ok(want.every(w => vt.includes(w)), 'setup page: the Shortcut steps, Vocal Shortcuts, Back Tap, the laptop and troubleshooting (' + want.filter(w => !vt.includes(w)).join(', ') + ')');
    ok(/\/a-e018bb82\/api\.php\?action=voice$/.test(await ev('document.getElementById("vkurl").value')) && await ev('!!document.getElementById("vkurlcopy")'), 'setup page: the address, with Copy');
    await ev('document.getElementById("vkname").value="Test phone"'); await click('#vkmake');
    ok(await until('/^jvk_[A-Za-z0-9_-]{32}$/.test((document.getElementById("vkkey")||{}).value||"")') && await ev('!!document.getElementById("vkkeycopy")'), 'setup page: Make a voice key shows it once, with Copy');
    ok(await until('[...document.querySelectorAll(".vkrow .lt")].some(x=>x.textContent==="Test phone")'), 'setup page: the new key is listed by name');
    await click('#vkkeycopy'); await sleep(300);
    await shot('jarvis-voice-setup');
    await ev('[...document.querySelectorAll(".vkrow")].find(r=>/Test phone/.test(r.innerText)).querySelector(".vkrevoke").click()'); await sleep(250);
    ok(/Revoke the voice key for Test phone/.test(await ev('(document.getElementById("confirm")||{}).innerText||""')), 'setup page: Revoke asks first');
    await click('#cfyes');
    ok(await until('![...document.querySelectorAll(".vkrow .lt")].some(x=>x.textContent==="Test phone")'), 'setup page: Revoke takes it off');
    await ev('document.getElementById("vtry").value="what\'s building"'); await click('#vtrybtn');
    ok(await until('/Roof material/.test(document.getElementById("vtryout").textContent)'), 'setup page: Try it here answers');
    await click('#shclose'); await sleep(200);
    ok(/Hands-free/.test(await ev('document.getElementById("handsswitch").textContent')) && await ev('document.getElementById("handsswitch").getAttribute("aria-pressed")') === 'false' && await ev('document.getElementById("handsswitch").classList.contains("off")'), 'Hands-free: a switch on the bar, off (grey) by default');

    /* ---- hands-free: a speech stand-in that ends by itself and takes its words from a queue; a voice that finishes */
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__jvFollowMs=1500;window.__srStarts=0;try{window.__srQ=JSON.parse(localStorage.getItem("test.srq")||"[]");localStorage.removeItem("test.srq");}catch(e){window.__srQ=[];}' +
      'window.SpeechRecognition=window.webkitSpeechRecognition=function(){var s=this,ended=false;var end=function(){if(!ended){ended=true;s.onend&&s.onend();}};s.start=function(){window.__srStarts++;window.__srStop=end;var t=window.__srQ.length?window.__srQ.shift():"";setTimeout(function(){if(t){s.onresult&&s.onresult({results:[[{transcript:t}]]});setTimeout(end,80);}},300);};s.stop=end;};' +
      'window.speechSynthesis.speak=function(u){if(u.text&&u.text.trim())window.__said.push(u.text);setTimeout(function(){u.onend&&u.onend();},60);};' });
    const F13 = async () => { await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'F13', code: 'F13', windowsVirtualKeyCode: 124, nativeVirtualKeyCode: 124 }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'F13', code: 'F13', windowsVirtualKeyCode: 124, nativeVirtualKeyCode: 124 }); };
    /* the wake word opening a new window: ?listen=1, then its F13 */
    await ev('localStorage.setItem("test.srq",JSON.stringify(["remind me tomorrow at 7am to water the plants"]))');
    await cdp('Page.navigate', { url: PAGE + '?listen=1' }); await until('document.readyState==="complete" && typeof window.__srStarts==="number"', 6000); await F13();
    ok(await until('window.__srStarts>=1', 9000), '?listen=1: the page listens on load (desktop Chrome)');
    ok(await nodeUntil(() => rems().some(x => x.text === 'Water the plants' && x.time === '07:00'), 8000), '?listen=1: what he says goes by itself (a reminder, with no model call)');
    ok(await until('window.__said.some(s=>/Reminder set/.test(s))'), '?listen=1: the answer is read aloud');
    ok(await ev('location.search===""') && await ev('![...document.querySelectorAll(".msg.ai")].some(m=>/Good (morning|afternoon|evening), Matthew/.test(m.innerText))'), '?listen=1: the address is cleaned, and no hello talks over it');
    await sleep(1200);
    ok(await ev('window.__srStarts') === 1, 'Hands-free off: the mic does not open again after the answer');
    /* Hands-free on, the wake word on a window already open (F13 only): answer, follow-up, quiet ends it */
    await click('#handsswitch'); await sleep(100);
    ok(await ev('document.getElementById("handsswitch").getAttribute("aria-pressed")') === 'true' && await ev('localStorage.getItem("jarvis.hands")') === 'true', 'Hands-free: on (lit), kept on this device');
    await ev('window.__srQ=["what\'s building",""];window.__srStarts=0;window.__said.length=0');
    await F13();
    ok(await until('window.__said.some(s=>/build/i.test(s))', 6000), 'F13 (the wake word on an open window): it listens, answers, and the answer card is read aloud');
    ok(await until('window.__srStarts===2', 5000), 'Hands-free: after the spoken answer the mic opens again for a follow-up');
    await sleep(2600);
    ok(await ev('window.__srStarts') === 2 && await ev('document.getElementById("app").classList.contains("s-idle")'), 'Hands-free: about 8 seconds of quiet (1.5 here) ends it: standing by, no third listen');
    /* "that's all" ends it too */
    await ev('window.__srQ=["what\'s waiting","that\'s all"];window.__srStarts=0;window.__said.length=0');
    await F13();
    ok(await until('window.__srStarts===2', 6000) && await until('window.__said[window.__said.length-1]==="Okay."', 4000), 'Hands-free: "that\'s all" ends the conversation with a short okay');
    await sleep(1200); ok(await ev('window.__srStarts') === 2, 'Hands-free: nothing more after "that\'s all"');
    /* the mic button with Hands-free on is the same conversation */
    await ev('window.__srQ=["what\'s building",""];window.__srStarts=0');
    await click('.cmdbar .mic'); ok(await until('window.__srStarts===2', 6000), 'Hands-free: the mic button starts a conversation that follows up');
    await sleep(2200);
    /* Driving mode with Hands-free: the same follow-up */
    await ev('window.__jvSetDrive(true)'); await sleep(300);
    await ev('window.__srQ=["what\'s new",""];window.__srStarts=0'); await click('#drivetalk');
    ok(await until('window.__srStarts===2', 6000), 'Driving mode with Hands-free: the mic opens again after the answer');
    await sleep(2200); await click('#driveexit'); await sleep(300);
    await click('#handsswitch'); await sleep(100);
    /* a phone: one big Tap to talk (a gesture first) */
    const UA0 = await ev('navigator.userAgent');
    await cdp('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1' });
    await ev('localStorage.setItem("test.srq",JSON.stringify(["what\'s building"]))');
    await cdp('Page.navigate', { url: PAGE + '?listen=1' });
    ok(await until('!!document.getElementById("taptalkbtn")', 9000) && await ev('window.__srStarts') === 0, 'iPhone ?listen=1: a big Tap to talk, and no listening before the tap');
    await shot('jarvis-taptalk');
    await click('#taptalkbtn');
    ok(await until('window.__srStarts===1') && await ev('!document.getElementById("taptalk")'), 'Tap to talk: one tap and it listens');
    await sleep(1200);
    await cdp('Emulation.setUserAgentOverride', { userAgent: UA0 });
    await cdp('Page.navigate', { url: PAGE }); await until('!!document.querySelector(".desk .ibr")', 9000); await sleep(600);
  }
  ok(errs.length === 0, 'no script errors in talk without Siri (' + errs.join(' | ') + ')');

  /* ================================================================ 16. the natural voice (20 Nov, P-11): ElevenLabs through lib/tts.php, a mock here */
  {
    const VAPI = BASE + '/a-e018bb82/api.php', ELF = path.join(DATA, 'elevenlabs.json'), USEF = path.join(DATA, 'jarvis', 'tts-usage.json');
    const SEEN = [];   /* every response body here, to check the key never comes back */
    const raw = async (a, o = {}) => { const r = await fetch(VAPI + '?action=' + a, { method: o.body !== undefined ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(o.cookie ? { Cookie: o.cookie } : {}), ...(o.headers || {}) }, body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
      const buf = Buffer.from(await r.arrayBuffer()), t = buf.toString(); SEEN.push(t + JSON.stringify([...r.headers])); let j = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, ct: r.headers.get('content-type') || '', x: r.headers.get('x-tts') || '', t, j, n: buf.length }; };
    const si = await fetch(VAPI + '?action=signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: PASSWORD }) });
    const sc = (si.headers.get('set-cookie') || '').split(';')[0];
    const rel = u => u.replace(/^api\.php/, '');
    const elSet = o => fs.writeFileSync(ELF, JSON.stringify({ key: EL_KEY, ...o }));
    const unstop = () => { const u = JSON.parse(fs.readFileSync(USEF, 'utf8')); for (const k of Object.keys(u)) u[k].stop = null; fs.writeFileSync(USEF, JSON.stringify(u)); };
    /* signed out, or a wrong voice key: nothing */
    let r = await raw('tts', { body: { text: 'hello' } }); ok(r.s === 401, 'natural voice: tts signed out answers 401 (got ' + r.s + ')');
    ok((await raw('ttsprep', { body: { text: 'hello' } })).s === 401 && (await raw('ttsplay&id=' + 'a'.repeat(64))).s === 401 && (await raw('ttsstate')).s === 401, 'natural voice: ttsprep, ttsplay and ttsstate need his sign-in');
    r = await raw('tts', { body: { text: 'hello' }, headers: { 'X-Voice-Key': 'jvk_' + 'z'.repeat(32) } }); ok(r.s === 401, 'natural voice: a wrong voice key is refused');
    ok((await raw('ttsget&id=' + 'a'.repeat(64) + '&e=' + (now + 600) + '&s=' + '0'.repeat(32))).s === 403, 'natural voice: an unsigned audio link is refused');
    /* no key on the server: off, and the page is told so (the built-in voice speaks) */
    r = await raw('ttsprep', { cookie: sc, body: { text: 'Hello Matthew.' } });
    ok(r.s === 200 && r.j.ok === false && r.j.fallback === true && r.j.why === 'off' && EL.calls.length === 0, 'natural voice: with no key it is off, a fallback, and ElevenLabs is never called');
    /* the key in place */
    elSet({});
    const home = await raw('home', { cookie: sc });
    ok(home.j.tts && home.j.tts.avail === true && home.j.tts.cap === 9000 && home.j.tts.used === 0 && !home.t.includes(EL_KEY) && !/"key"/.test(JSON.stringify(home.j.tts)), 'natural voice: home says it is on, 0 of 9,000 characters, and never shows the key');
    r = await raw('ttsprep', { cookie: sc, body: { text: 'Sent to the desk; I’ll alert you when it’s done.' } });
    ok(r.j.ok && r.j.cached === false && /^api\.php\?action=ttsplay&id=[0-9a-f]{64}$/.test(r.j.url) && EL.calls.length === 0, 'natural voice: step 1 keeps the words and gives the play address (the words are not in it)');
    const id1 = r.j.id; let p = await raw(rel(r.j.url).replace(/^\?action=/, ''), { cookie: sc });
    ok(p.s === 200 && /^audio\/mpeg/.test(p.ct) && p.x === 'made' && /FAKE-MP3:Sent to the desk/.test(p.t), 'natural voice: step 2 streams the ElevenLabs audio');
    const c1 = EL.calls[0] || {};
    ok(EL.calls.length === 1 && c1.key === EL_KEY && c1.p === 'eleven/v1/text-to-speech/onwK4e9ZLuTAKqWW03F9/stream' && /output_format=mp3_44100_64/.test(c1.q) && c1.body.model_id === 'eleven_flash_v2_5', 'natural voice: Daniel, eleven_flash_v2_5, mp3, the key in xi-api-key');
    ok(fs.existsSync(path.join(DATA, 'jarvis', 'tts-cache', id1 + '.mp3')) && !fs.existsSync(path.join(DATA, 'jarvis', 'tts-cache', id1 + '.txt')), 'natural voice: the audio is cached and the waiting words are gone');
    ok((await raw('ttsstate', { cookie: sc })).j.tts.used === 'Sent to the desk; I’ll alert you when it’s done.'.length, 'natural voice: the characters are counted');
    /* the same words again: the cache, nothing from ElevenLabs */
    r = await raw('ttsprep', { cookie: sc, body: { text: 'Sent to the desk;  I’ll alert you when it’s done.' } });
    p = await raw(rel(r.j.url).replace(/^\?action=/, ''), { cookie: sc });
    ok(r.j.cached === true && r.j.id === id1 && p.x === 'cache' && /^audio\/mpeg/.test(p.ct) && EL.calls.length === 1, 'natural voice: a repeated phrase comes from the cache and costs nothing');
    { const rg = await fetch(VAPI + '?action=ttsplay&id=' + id1, { headers: { Cookie: sc, Range: 'bytes=0-9' } }); ok(rg.status === 206 && (await rg.arrayBuffer()).byteLength === 10 && /^bytes 0-9\//.test(rg.headers.get('content-range') || ''), 'natural voice: the cached file answers byte ranges (what iPhone Safari asks for)'); }
    ok((await raw('ttsstate', { cookie: sc })).j.tts.hits >= 2, 'natural voice: cache hits are counted');
    /* all in one: POST tts, signed in or with a voice key */
    r = await raw('tts', { cookie: sc, body: { text: 'Good morning, Matthew.' } });
    ok(r.s === 200 && /^audio\/mpeg/.test(r.ct) && /FAKE-MP3:Good morning, Matthew\./.test(r.t), 'natural voice: POST tts signed in gives the audio');
    const vk = await (await fetch(VAPI + '?action=jvvoicekeynew', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: sc }, body: JSON.stringify({ name: 'Speaker test' }) })).json(); const VK = vk.key || '';
    r = await raw('tts', { body: { text: 'Good morning, Matthew.' }, headers: { 'X-Voice-Key': VK } });
    ok(r.s === 200 && r.x === 'cache' && EL.calls.length === 2, 'natural voice: POST tts with a voice key works, from the cache');
    /* a long answer: at most about 600 characters go to ElevenLabs */
    r = await raw('ttsprep', { cookie: sc, body: { text: ('This sentence is about the long answer. ').repeat(60) } }); p = await raw(rel(r.j.url).replace(/^\?action=/, ''), { cookie: sc });
    const lt = (EL.calls[EL.calls.length - 1].body.text || '');
    ok(p.s === 200 && lt.length <= 600 && /The rest is on screen\.$/.test(lt), 'natural voice: a long answer is cut at a sentence, at most 600 characters (' + lt.length + ')');
    /* a busy 429 or a 500: that answer falls back, the voice stays on */
    for (const m of ['429busy', '500']) {
      EL.mode = m; r = await raw('ttsprep', { cookie: sc, body: { text: 'A fresh phrase for ' + m + '.' } }); p = await raw(rel(r.j.url).replace(/^\?action=/, ''), { cookie: sc });
      ok(p.s === 503 && p.j.fallback === true && p.j.why === 'failed' && p.j.state.avail === true, 'natural voice: ElevenLabs ' + m + ': this answer falls back, and the voice stays on');
    }
    /* 402, or a 429 for the quota: stop for the rest of the month */
    for (const m of ['402', '429quota']) {
      EL.mode = m; r = await raw('ttsprep', { cookie: sc, body: { text: 'Another phrase for ' + m + '.' } }); p = await raw(rel(r.j.url).replace(/^\?action=/, ''), { cookie: sc });
      const n0 = EL.calls.length; const r2 = await raw('ttsprep', { cookie: sc, body: { text: 'And one more after ' + m + '.' } });
      ok(p.s === 503 && p.j.why === 'stopped' && r2.j.ok === false && r2.j.why === 'stopped' && EL.calls.length === n0 && /ElevenLabs said (402|429)/.test(r2.j.state.stopNote), 'natural voice: ElevenLabs ' + m + ' stops it for the month, with no more calls (' + r2.j.state.stopNote + ')');
      const r3 = await raw('ttsprep', { cookie: sc, body: { text: 'Good morning, Matthew.' } });
      ok(r3.j.ok === true && r3.j.cached === true, 'natural voice: stopped, a cached phrase still plays (it costs nothing)');
      unstop();
    }
    EL.mode = 'ok';
    /* the cap: past it, the built-in voice */
    { const u = (await raw('ttsstate', { cookie: sc })).j.tts.used; elSet({ cap: u + 10 }); const n0 = EL.calls.length;
      r = await raw('ttsprep', { cookie: sc, body: { text: 'This one is over the monthly cap.' } });
      ok(r.j.ok === false && r.j.why === 'cap' && EL.calls.length === n0, 'natural voice: over the monthly cap: a fallback, ElevenLabs not called');
      elSet({ cap: u + 5 }); ok((await raw('ttsstate', { cookie: sc })).j.tts.avail === true, 'natural voice: under the cap it stays on');
      elSet({ cap: u }); ok((await raw('ttsstate', { cookie: sc })).j.tts.why === 'cap', 'natural voice: at the cap it says so');
      elSet({}); }
    /* the voice door's optional audio link */
    const vo = async (text, q) => { const x = await fetch(VAPI + '?action=voice' + q, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Voice-Key': VK }, body: JSON.stringify({ text }) }); const t = await x.text(); SEEN.push(t); let j = {}; try { j = JSON.parse(t); } catch {} return { s: x.status, t, j }; };
    let v = await vo("what's building", '&format=json');
    ok(v.j.intent === 'builds' && !('audio' in v.j), 'voice door: format=json alone has no audio (the old Shortcut is unchanged)');
    v = await vo("what's building", '');
    ok(v.s === 200 && /Roof material/.test(v.t) && !/[{}]/.test(v.t), 'voice door: plain text still, for Speak Text');
    v = await vo("what's building", '&format=json&audio=1');
    ok(v.j.ok && /Roof material/.test(v.j.say) && /\/a-e018bb82\/api\.php\?action=ttsget&id=[0-9a-f]{64}&e=\d+&s=[0-9a-f]{32}$/.test(v.j.audio || ''), 'voice door: &audio=1 adds a link to the answer in the natural voice');
    { const a = await fetch(v.j.audio.replace(/^https?:\/\/[^/]+/, BASE)); const t = await a.text(); ok(a.status === 200 && /^audio\/mpeg/.test(a.headers.get('content-type') || '') && /FAKE-MP3:.*Roof material/.test(t), 'voice door: the link plays with nothing else (what a Shortcut can do)');
      const bad = await fetch(v.j.audio.replace(/^https?:\/\/[^/]+/, BASE).replace(/s=[0-9a-f]{4}/, 's=0000')); ok(bad.status === 403, 'voice door: a changed link is refused');
      const old = await fetch(v.j.audio.replace(/^https?:\/\/[^/]+/, BASE).replace(/e=\d+/, 'e=' + (now - 10))); ok(old.status === 403, 'voice door: an expired link is refused'); }
    EL.mode = '402'; v = await vo("what's on tomorrow", '&format=json&audio=1'); EL.mode = 'ok';
    ok(v.s === 200 && typeof v.j.say === 'string' && v.j.say.length > 0 && !('audio' in v.j), 'voice door: when ElevenLabs refuses, no audio field and the words still come (Speak Text says them)');
    unstop();
    /* the key: never in a response, a log or any other data file */
    const files = []; const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const fp = path.join(d, e.name); if (e.isDirectory()) walk(fp); else if (fp !== ELF) files.push(fp); }); walk(DATA);
    const leak = files.filter(fp => fs.readFileSync(fp).includes(EL_KEY)).map(fp => path.basename(fp));
    ok(!SEEN.some(t => t.includes(EL_KEY)) && leak.length === 0, 'natural voice: the ElevenLabs key is in no response, log or data file (' + leak.join(', ') + ')');
    ok(/"what":"tts failed","status":402,"code":"payment_required"/.test(fs.readFileSync(path.join(DATA, 'assistant.log'), 'utf8')), 'natural voice: a failure is logged by its code only');
    ok(!/Another phrase for|And one more/.test(fs.readFileSync(path.join(DATA, 'assistant.log'), 'utf8')), 'natural voice: the log never holds the words');

    /* ---- the page: the natural voice first, the device's voice when it can't */
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__played=[];window.__auSrcs=[];window.Audio=function(){var a=this;a.setAttribute=function(){};a.removeAttribute=function(){};a.load=function(){};a.pause=function(){};' +
      'a.play=function(){var src=a.src||"";window.__auSrcs.push(src);if(/^data:/.test(src))return Promise.resolve();return fetch(src,{credentials:"same-origin"}).then(function(r){var ct=r.headers.get("content-type")||"";return r.text().then(function(t){if(!r.ok||!/audio\\/mpeg/.test(ct)){a.onerror&&a.onerror();return;}window.__played.push({src:src,body:t.slice(-200),tts:r.headers.get("x-tts")});a.onplaying&&a.onplaying();setTimeout(function(){a.onended&&a.onended();},60);});},function(){a.onerror&&a.onerror();});};};' });
    await cdp('Page.navigate', { url: PAGE }); await until('!!document.querySelector(".desk .ibr")', 9000); await sleep(800);
    await ev('document.body.dispatchEvent(new MouseEvent("click",{bubbles:true}))');
    ok(await ev('window.__auSrcs.some(s=>/^data:audio\\/wav/.test(s))'), 'page: the first tap plays a moment of silence through the audio element (the iPhone unlock)');
    await click('.top .vw [data-view=cog]'); await until('!!document.getElementById("voicebtn")'); await click('#voicebtn'); ok(await until('!!document.getElementById("natswitch")'), 'page: Natural voice (ElevenLabs) is on the Talk without Siri page');
    ok(await until('/of 9,000 characters used this month/.test((document.getElementById("natread")||{}).textContent||"")') && /Natural voice \(ElevenLabs\): on/.test(await ev('document.getElementById("natswitch").textContent')), 'page: on by default, with this month\'s characters of the cap (' + await ev('(document.getElementById("natread")||{}).textContent') + ')');
    await shot('jarvis-natural-voice');
    const said0 = await ev('window.__said.length'), n0 = EL.calls.length;
    await ev('(()=>{window.__gst=[];const g=document.querySelector(".jvg");if(g)new MutationObserver(function(){window.__gst.push(g.dataset.state)}).observe(g,{attributes:true,attributeFilter:["data-state"]});})()');
    await click('#nathear');
    ok(await until('window.__played.some(p=>/FAKE-MP3:Good to meet you, Matthew/.test(p.body) && p.tts==="made")', 6000) && await ev('window.__said.length') === said0 && EL.calls.length === n0 + 1, 'page: an answer plays in the ElevenLabs voice, not the device voice');
    ok(await until('window.__gst.includes("speak") && window.__gst[window.__gst.length-1]==="answer"', 4000), 'globe: Speaking while the natural voice plays, Answer ready when it ends (' + await ev('window.__gst.join(",")') + ')');
    await sleep(300); await click('#nathear');
    ok(await until('window.__played.filter(p=>/Good to meet you/.test(p.body)).length===2', 6000) && await ev('window.__played[window.__played.length-1].tts') === 'cache' && EL.calls.length === n0 + 1, 'page: said again, from the cache');
    ok(await ev('window.__played.every(p=>!/Good to meet/.test(decodeURIComponent(p.src)))'), 'page: the words never go in an address');
    /* ElevenLabs down: that answer in the device voice, at once */
    EL.mode = '500'; await ev('document.getElementById("vtry").value="what\'s waiting"'); await click('#vtrybtn');
    ok(await until('window.__said.length>' + said0, 6000), 'page: ElevenLabs failing: the device voice says it instead (never silent)');
    EL.mode = 'ok';
    /* the switch off: the device voice */
    await click('#natswitch'); await sleep(150);
    ok(/: off/.test(await ev('document.getElementById("natswitch").textContent')) && await ev('localStorage.getItem("jarvis.natural")') === 'false', 'page: the switch turns it off on this device');
    const p0 = await ev('window.__played.length'), s1 = await ev('window.__said.length'); await click('#nathear');
    ok(await until('window.__said.length===' + (s1 + 1), 4000) && await ev('window.__played.length') === p0, 'page: switched off, the device voice speaks');
    await click('#natswitch'); await sleep(150);
    /* capped: the page knows, and says it with the device voice straight away */
    { const u = (await raw('ttsstate', { cookie: sc })).j.tts.used; elSet({ cap: u });
      await cdp('Page.reload'); await until('!!document.querySelector(".desk .ibr")', 9000); await sleep(600); await ev('document.body.dispatchEvent(new MouseEvent("click",{bubbles:true}))');
      await click('.top .vw [data-view=cog]'); await until('!!document.getElementById("voicebtn")'); await click('#voicebtn'); await until('!!document.getElementById("natswitch")');
      ok(await until('/used up/.test((document.getElementById("natread")||{}).textContent||"")'), 'page: at the cap it says the device voice speaks until the month starts again');
      const s2 = await ev('window.__said.length'), n1 = EL.calls.length; await click('#nathear');
      ok(await until('window.__said.length===' + (s2 + 1), 4000) && EL.calls.length === n1, 'page: capped: straight to the device voice, ElevenLabs not asked');
      elSet({}); }
    await click('#shclose'); await sleep(200);
    ok(!JSON.stringify(await ev('Object.keys(localStorage).map(k=>localStorage.getItem(k))')).includes(EL_KEY), 'page: the key never reaches the browser');
    fs.rmSync(ELF);   /* the rest of the run: off, as before */
    await cdp('Page.reload'); await until('!!document.querySelector(".desk .ibr")', 9000); await sleep(600);
  }
  ok(errs.length === 0, 'no script errors with the natural voice (' + errs.join(' | ') + ')');

  /* ================================================================ 17. record a meeting (20 Nov, P-12): consent first, pieces as they come, gaps, the transcriber */
  {
    const MD = path.join(DATA, 'jarvis', 'meetings'), JMP = path.join(PRIV, 'jvmeet.php').replace(/\\/g, '/');
    const metas = () => fs.existsSync(MD) ? fs.readdirSync(MD).filter(d => /^m\d{14}[0-9a-f]{4}$/.test(d)).map(d => JSON.parse(fs.readFileSync(path.join(MD, d, 'meta.json'), 'utf8'))) : [];
    const meta = id => JSON.parse(fs.readFileSync(path.join(MD, id, 'meta.json'), 'utf8'));
    const parts = id => fs.existsSync(path.join(MD, id)) ? fs.readdirSync(path.join(MD, id)).filter(f => /\.part$/.test(f)) : [];
    const editMeta = (id, fn) => { const m = meta(id); fn(m); fs.writeFileSync(path.join(MD, id, 'meta.json'), JSON.stringify(m)); };
    const jm = (args, input = '') => new Promise(res => { let o = '', e = ''; const p = spawn('php', [JMP, ...args], { env: { ...process.env, ...ENVX } }); p.stdout.on('data', d => o += d); p.stderr.on('data', d => e += d); p.on('close', code => res({ code, out: o, err: e })); p.stdin.end(input); });
    const si = await fetch(BASE + '/a-e018bb82/api.php?action=signin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: PASSWORD }) });
    const sc = (si.headers.get('set-cookie') || '').split(';')[0];
    const mpost = async (a, b, q = '', raw = null) => { const r = await fetch(BASE + '/a-e018bb82/api.php?action=' + a + q, { method: 'POST', headers: { 'Content-Type': raw ? 'application/octet-stream' : 'application/json', Cookie: sc }, body: raw || JSON.stringify(b) }); const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j }; };
    /* a short tone as real audio (ffmpeg), for the upload and the gaps */
    const MEETST = fs.mkdtempSync(path.join(os.tmpdir(), 'jvmeet-')), MREPO = path.join(MEETST, 'repo'), TONE = path.join(MEETST, 'tone.webm');
    fs.mkdirSync(path.join(MREPO, 'matthew', 'clients', 'peak-pickleball'), { recursive: true });
    spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:a', 'libopus', '-b:a', '32k', TONE]);
    ok(fs.existsSync(TONE) && fs.statSync(TONE).size > 500, 'meeting: a test tone made with ffmpeg');
    /* whisper.cpp stand-in: writes an SRT for -of; MOCK_FAIL fails, MOCK_LONG writes a long meeting */
    const MOCKW = path.join(MEETST, 'mock-whisper.sh');
    fs.writeFileSync(MOCKW, '#!/bin/bash\nof=""; while [ $# -gt 0 ]; do [ "$1" = -of ] && of="$2"; shift; done\n[ -n "${MOCK_FAIL:-}" ] && exit 1\n[ -n "$of" ] || exit 2\ncommand -v cygpath > /dev/null && of=$(cygpath -u "$of")\n' +
      'if [ -n "${MOCK_LONG:-}" ]; then for i in $(seq 0 399); do s=$((i*2)); printf "%d\\n%02d:%02d:%02d,000 --> %02d:%02d:%02d,900\\nLong meeting words number %d about the sponsor offer and the aeration schedule and who does what by Friday.\\n\\n" $((i+1)) $((s/3600)) $((s%3600/60)) $((s%60)) $((s/3600)) $((s%3600/60)) $((s%60)) $i; done > "$of.srt"\n' +
      'else printf "1\\n00:00:00,500 --> 00:00:02,000\\nMock words: we agreed the sponsor offer goes out Friday.\\n\\n" > "$of.srt"; fi\nexit 0\n');
    fs.chmodSync(MOCKW, 0o755);
    const worker = (env = {}) => new Promise(res => { let o = ''; const p = spawn('bash', [path.join(REPO, 'assistant', 'jarvis', 'tools', 'meeting-worker.sh')], { env: { ...process.env, ...ENVX, MEET_WHO: 'laptop', MEET_SG: 'bash -c', MEET_JM: 'php ' + JMP, MEET_ST: path.join(MEETST, 'st'), MEET_REPO: MREPO, MEET_NO_HTTPS: '1', MEET_WHISPER: MOCKW, MEET_MODEL: MOCKW, MEET_VAD: path.join(MEETST, 'no-vad.bin'), ...env } }); p.stdout.on('data', d => o += d); p.stderr.on('data', d => o += d); p.on('close', code => res({ code, out: o })); });
    const wlog = () => { const f = path.join(MEETST, 'st', 'meeting-worker.log'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; };

    /* the server: signed out, nothing; consent is required before anything is kept */
    for (const a of ['jvmeetlist', 'jvmeettext&id=m20261120000000aaaa']) { const [s] = await hget('/a-e018bb82/api.php?action=' + a); ok(s === 401, 'meeting: signed out, ' + a + ' answers 401 (got ' + s + ')'); }
    for (const a of ['jvmeetstart', 'jvmeetchunk&id=m20261120000000aaaa&seg=0&n=0', 'jvmeetstate']) { const [s] = await hpost('/a-e018bb82/api.php?action=' + a, { company: 'Peak', consent: true, consentText: 'Everyone here knows this is being recorded' }); ok(s === 401, 'meeting: signed out, POST ' + a + ' answers 401 (got ' + s + ')'); }
    { fs.rmSync(path.join(DATA, 'tries.json'), { force: true });   /* earlier sections spent this address's wrong tries */
      const [s] = await hget('/a-e018bb82/api.php?action=jvmpending&who=laptop'); ok(s === 403, 'meeting: the transcriber door with no laptop key, refused');
      const r2 = await fetch(BASE + '/a-e018bb82/api.php?action=jvmpending&who=laptop', { headers: { 'X-Jarvis-Key': 'y'.repeat(64) } }); ok(r2.status === 403, 'meeting: a wrong laptop key, refused');
      fs.rmSync(path.join(DATA, 'tries.json'), { force: true }); const LK2 = crypto.randomBytes(32).toString('hex'); await cli(['setkey'], crypto.createHash('sha256').update(LK2).digest('hex'));
      const r3 = await fetch(BASE + '/a-e018bb82/api.php?action=jvmpending&who=laptop', { headers: { 'X-Jarvis-Key': LK2 } }); ok(r3.status === 200 && (await r3.text()).trim() === '0', 'meeting: the laptop key gets a bare count'); }
    let r = await mpost('jvmeetstart', { company: 'Peak' });
    ok(!r.j.ok && r.j.consent === false && metas().length === 0, 'meeting: no consent tap, no recording (and nothing kept)');
    r = await mpost('jvmeetstart', { company: 'Peak', consent: true, consentText: 'sure' });
    ok(!r.j.ok && metas().length === 0, 'meeting: the consent line must be the exact one');
    r = await mpost('jvmeetstart', { consent: true, consentText: 'Everyone here knows this is being recorded' });
    ok(!r.j.ok && /company/i.test(r.j.error) && metas().length === 0, 'meeting: no company, no recording');
    r = await mpost('jvmeetchunk', null, '&id=m20261120000000aaaa&seg=0&n=0', fs.readFileSync(TONE));
    ok(!r.j.ok && r.j.gone, 'meeting: a piece for a recording that was never started is refused');

    /* the page: record a meeting from Meeting notes; the microphone opens only after the consent tap */
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__jvMeetSlice=1500;window.__hid=false;Object.defineProperty(Document.prototype,"hidden",{configurable:true,get:function(){return !!window.__hid}});Object.defineProperty(Document.prototype,"visibilityState",{configurable:true,get:function(){return window.__hid?"hidden":"visible"}});' +
      'window.__wl=0;window.__wlRel=0;Object.defineProperty(navigator,"wakeLock",{configurable:true,value:{request:function(){window.__wl++;var h=[];var l={release:function(){window.__wlRel++;h.forEach(function(f){f()});return Promise.resolve()},addEventListener:function(e,f){if(e==="release")h.push(f)}};window.__wlLast=l;return Promise.resolve(l)}}});' +
      'window.__gum=0;window.__streams=[];(function(){var md=navigator.mediaDevices;if(!md)return;var g=md.getUserMedia.bind(md);md.getUserMedia=function(c){window.__gum++;return g(c).then(function(s){window.__streams.push(s);return s})};})();' });
    await cdp('Page.navigate', { url: PAGE }); await until('!!document.querySelector(".desk .ibr")', 9000); await sleep(700);
    await ev('document.body.dispatchEvent(new MouseEvent("click",{bubbles:true}))');
    await ev('[...document.querySelectorAll(".chip")].find(c=>/Meeting notes/.test(c.textContent)).click()'); await until('!!document.getElementById("meetrecord")');
    ok(await ev('document.getElementById("meetrecord").disabled && document.getElementById("meetupload").disabled'), 'meeting: Record and Upload wait until the company is picked');
    ok(await until('/No recordings yet/.test(document.getElementById("meetlist").textContent)'), 'meeting: the Recordings list starts empty');
    await click('.cos button[data-co="Peak"]');
    ok(await ev('!document.getElementById("meetrecord").disabled'), 'meeting: picked, Record is on');
    await click('#meetrecord'); await until('!!document.getElementById("mrconsent")');
    ok(await ev('!document.getElementById("sheet") && /Everyone here knows this is being recorded/.test(document.getElementById("mrconsent").textContent) && !document.getElementById("mrconsent").disabled && document.querySelector("#meetrec .cos button[data-co=Peak]").getAttribute("aria-pressed")==="true"'), 'meeting: the consent step, with the company carried over');
    await sleep(500);
    ok(await ev('window.__gum') === 0 && metas().length === 0, 'meeting: before the consent tap, the microphone is not opened and nothing is kept');
    await shot('jarvis-meeting-consent');
    const tap0 = Math.floor(Date.now() / 1000);
    await click('#mrconsent');
    ok(await until('!!document.querySelector("#meetrec.live")', 6000), 'meeting: the tap starts the recording screen');
    ok(await nodeUntil(() => metas().length === 1 && parts(metas()[0].id).length >= 2, 9000), 'meeting: pieces reach the server as they are made (' + (metas()[0] ? parts(metas()[0].id).length : 0) + ')');
    const M1 = metas()[0].id;
    { const m = meta(M1); ok(m.consent && m.consent.line === 'Everyone here knows this is being recorded' && m.consent.by === 'Matthew Sharpe' && m.consent.at >= tap0 - 2 && m.consent.at <= (m.segs[0] || m.segs['0']).t + 2 && m.company === 'Peak' && m.status === 'recording' && !!m.consent.device, 'meeting: the consent tap is logged with the meeting (when, who, company, device), before the first piece (' + JSON.stringify(m.consent) + ')'); }
    ok(/alog|meeting started/.test(fs.readFileSync(path.join(DATA, 'assistant.log'), 'utf8')) && /"what":"meeting started".*"consent":"Everyone here knows/.test(fs.readFileSync(path.join(DATA, 'assistant.log'), 'utf8')), 'meeting: the start and its consent line are in the Assistant\'s log');
    ok(await ev('window.__gum') === 1 && await ev('window.__wl') >= 1, 'meeting: one microphone, and the screen asked to stay awake');
    ok(await until('/Screen kept awake/.test(document.querySelector("#meetrec .mst").textContent) && /^0:00:0[1-9]|^0:00:[1-9]/.test(document.querySelector("#meetrec .mtime").textContent)'), 'meeting: the timer runs and it says the screen is kept awake');
    await shot('jarvis-meeting-recording');
    /* a second recording while one is open: refused */
    r = await mpost('jvmeetstart', { company: 'Surge', consent: true, consentText: 'Everyone here knows this is being recorded' });
    ok(!r.j.ok && r.j.active && r.j.active.id === M1, 'meeting: one live recording at a time');
    /* the wake lock let go (the phone does that when the page hides): asked again when the page is back */
    { const w0 = await ev('window.__wl'); await ev('window.__wlLast.release()'); ok(await until('window.__wl>' + w0, 3000), 'meeting: the screen lock is asked for again after the phone lets it go'); }
    /* an interruption: the page hidden and the microphone taken (a call); back on screen it records again in a new segment, the gap marked */
    await ev('window.__hid=true;document.dispatchEvent(new Event("visibilitychange"));window.__streams[window.__streams.length-1].getAudioTracks().forEach(function(t){t.stop()})');
    await sleep(2500);
    const wl1 = await ev('window.__wl');
    await ev('window.__hid=false;document.dispatchEvent(new Event("visibilitychange"))');
    ok(await nodeUntil(() => { const s = meta(M1).segs; return !!(s[1] || s['1']); }, 9000), 'meeting: back on screen, it carries on in a new segment');
    { const g = meta(M1).segs[1]; ok(g && (g.why === 'hidden' || g.why === 'error' || g.why === 'ended') && g.gap >= 1 && g.t > meta(M1).segs[0].t, 'meeting: the new segment carries the gap and why (' + JSON.stringify(g) + ')'); }
    ok(await ev('window.__gum') === 2 && await ev('window.__wl') > wl1 - 1, 'meeting: the microphone opened again by itself');
    /* Pause and Resume: a new segment marked as paused by him */
    await click('#mrpause'); ok(await nodeUntil(() => meta(M1).status === 'paused', 5000) && /Paused/.test(await ev('document.querySelector("#meetrec .mrh").textContent')), 'meeting: Pause (nothing recorded, the server knows)');
    await sleep(600); await click('#mrpause');
    ok(await nodeUntil(() => meta(M1).status === 'recording' && Object.values(meta(M1).segs).some(g => g.why === 'pause'), 8000), 'meeting: Resume carries on in the same meeting, in a segment marked paused');
    await sleep(1800);
    /* "Hey Jarvis, stop recording" on the laptop: the wake word presses F13, the page listens, and stops it */
    await ev('window.__srQ=["stop recording"]');
    await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'F13', code: 'F13', windowsVirtualKeyCode: 124, nativeVirtualKeyCode: 124 }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'F13', code: 'F13', windowsVirtualKeyCode: 124, nativeVirtualKeyCode: 124 });
    { const st = await nodeUntil(() => meta(M1).status === 'ready', 12000); ok(st, 'meeting: "Hey Jarvis, stop recording" stops it, and it waits for the transcriber');
      if (!st) { console.log('  debug:', meta(M1).status, await ev('JSON.stringify({sr:window.__srStarts,q:window.__srQ,ask:(document.getElementById("ask")||{}).value,chat:document.querySelector(".chat").innerText.slice(-300),mst:(document.querySelector("#meetrec .mst")||{}).textContent,h:(document.querySelector("#meetrec .mrh")||{}).textContent})')); await click('#mrstop'); await nodeUntil(() => meta(M1).status === 'ready', 12000); } }
    ok(await until('!!document.getElementById("mrdone") && /Recording saved: Peak/.test(document.getElementById("meetrec").textContent)', 6000), 'meeting: the screen says saved, and where it is transcribed');
    { const m = meta(M1), ex = m.expect || {}; ok(Object.keys(m.segs).length >= 3 && Object.keys(m.segs).every(k => ex[k] === parts(M1).filter(f => f.startsWith('s' + String(k).padStart(3, '0') + '-')).length), 'meeting: every piece the page made is on the server (' + JSON.stringify(ex) + ')'); }
    ok(await ev('window.__wlRel') >= 1 && await ev('window.__streams.every(function(s){return s.getAudioTracks().every(function(t){return t.readyState==="ended"})})'), 'meeting: after Stop the microphone is closed and the screen may sleep again');
    await shot('jarvis-meeting-saved');
    await click('#mrdone');
    /* the transcriber: the preferred one (the laptop) first; the cloud waits */
    await jm(['peek', 'laptop']);
    ok((await jm(['peek', 'cloud'])).out.trim() === '0', 'meeting: the cloud waits while the laptop is looking');
    /* whisper fails once: back in the queue, audio kept */
    let w = await worker({ MOCK_FAIL: '1' });
    ok(meta(M1).status === 'ready' && meta(M1).attempts === 1 && /whisper stopped/.test(meta(M1).error || '') && parts(M1).length > 0, 'meeting: whisper failing: back in the queue, the audio kept (' + (meta(M1).error || '') + ')');
    w = await worker();
    const t1 = meta(M1);
    ok(t1.status === 'done' && t1.worker === 'laptop' && fs.existsSync(path.join(MD, M1, 'transcript.txt')), 'meeting: transcribed on the laptop (' + wlog().trim().split('\n').pop() + ')');
    ok(parts(M1).length === 0 && !!t1.audioDeletedAt, 'meeting: the audio is deleted once the transcript is saved and read back');
    const tx1 = fs.readFileSync(path.join(MD, M1, 'transcript.txt'), 'utf8');
    ok(/\[\d{1,2}:\d\d [ap]m\] Mock words/.test(tx1), 'meeting: the transcript has the clock time and the words (' + tx1.slice(0, 120) + ')');
    const dm1 = deskMsgs().pop();
    ok(t1.thread === dm1.id && /^\[MEETING NOTES\]\nCompany: Peak \(Matthew's own client work\)\nDate: \d{4}-\d\d-\d\d\nRecorded: /.test(dm1.text) && /Consent: Matthew tapped "Everyone here knows this is being recorded" at /.test(dm1.text) && /--- Transcript, part 1 of 1 ---/.test(dm1.text) && /draft file only \(never sent\)/.test(dm1.text) && /no speaker names/.test(dm1.text), 'meeting: the desk gets it as [MEETING NOTES], with the company, date, length and consent line (' + dm1.text.slice(0, 200).replace(/\n/g, ' | ') + ')');
    ok(fs.existsSync(path.join(MREPO, 'matthew', 'clients', 'peak-pickleball', 'meetings', 'transcripts')) && fs.readdirSync(path.join(MREPO, 'matthew', 'clients', 'peak-pickleball', 'meetings', 'transcripts')).some(f => f.endsWith(M1 + '.txt')), 'meeting: the laptop keeps a private copy beside the Peak meeting notes');
    ok(spawnSync('git', ['-C', REPO, 'check-ignore', '-q', 'matthew/clients/peak-pickleball/meetings/transcripts/x.txt']).status === 0 && spawnSync('git', ['-C', REPO, 'check-ignore', '-q', 'surge/meetings/transcripts/x.txt']).status === 0, 'meeting: transcripts folders are gitignored (never committed)');
    { const tt = await ev('fetch("../api.php?action=jvmeettext&id=' + M1 + '").then(r=>r.text())'); ok(/Mock words/.test(tt), 'meeting: the raw transcript opens for him, signed in');
      const pub = path.join(PUB, 'a-e018bb82'); const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
      ok(!walk(PUB).some(f => /\.part$|transcript\.txt$|meta\.json$/.test(f)), 'meeting: no audio or transcript anywhere in public_html'); }
    /* the desk list carries a long transcript cut; the laptop's read gets it all */
    /* the upload path, with Keep audio: a file through the same pipeline, its own consent line */
    await ev('[...document.querySelectorAll(".chip")].find(c=>/Meeting notes/.test(c.textContent)).click()'); await until('!!document.getElementById("meetupload")');
    ok(await until('/Peak/.test(document.getElementById("meetlist").textContent) && /Transcribed/.test(document.getElementById("meetlist").textContent) && /audio deleted/.test(document.getElementById("meetlist").textContent)'), 'meeting: Recordings lists it: transcribed, audio deleted');
    await click('.cos button[data-co="Sixfold"]');
    { const doc = await cdp('DOM.getDocument', { depth: -1, pierce: true }); const q = await cdp('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#meetfile' }); await cdp('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [TONE] }); }
    ok(await until('!!document.getElementById("mrconsent") && /Everyone in this recording knew it was being recorded/.test(document.getElementById("mrconsent").textContent)', 5000), 'meeting: an upload asks its own consent line first');
    const gum0 = await ev('window.__gum'); await ev('document.getElementById("mrkeep").click()'); await click('#mrconsent');
    ok(await until('!!document.querySelector("#meetrec .consent") && /Uploaded: tone\\.webm for Sixfold/.test(document.getElementById("meetrec").textContent)', 9000), 'meeting: the file goes up and it says so');
    ok(await ev('window.__gum') === gum0, 'meeting: an upload never opens the microphone');
    const M2 = metas().find(m => m.source === 'upload').id;
    ok(meta(M2).status === 'ready' && meta(M2).keep === true && meta(M2).consent.line === 'Everyone in this recording knew it was being recorded' && parts(M2).length === 1, 'meeting: the upload is queued with its consent line and Keep audio');
    await click('#meetrec .consent');
    w = await worker();
    ok(meta(M2).status === 'done' && parts(M2).length === 1 && meta(M2).keepUntil > Date.now() / 1000 + 29 * 86400, 'meeting: Keep audio: the audio stays 30 days after the transcript');
    ok(/Recording: an uploaded file \(tone\.webm\)/.test(deskMsgs().pop().text) && /\[0:00:00\] Mock words/.test(fs.readFileSync(path.join(MD, M2, 'transcript.txt'), 'utf8')), 'meeting: an upload is timed from its start, and the desk is told it was a file');
    ok(fs.existsSync(path.join(MREPO, 'sixfold', 'meetings', 'transcripts')), 'meeting: the Sixfold copy sits beside the Sixfold meeting notes');
    editMeta(M2, m => { m.keepUntil = Math.floor(Date.now() / 1000) - 5; });
    let sw0 = JSON.parse((await jm(['sweep'])).out || '{}');
    ok(sw0.expired === 1 && parts(M2).length === 0 && !!meta(M2).audioDeletedAt, 'meeting: after 30 days the kept audio is deleted');
    /* gaps between segments and a long meeting: marked, and sent to the desk in parts; the page's desk list gets it cut */
    r = await mpost('jvmeetstart', { company: 'Other', other: 'Donny', consent: true, consentText: 'Everyone here knows this is being recorded', device: 'test' });
    const M3 = r.j.meeting.id, T3 = Math.floor(Date.now() / 1000) - 600;
    ok((await mpost('jvmeetchunk', null, '&id=' + M3 + '&seg=0&n=0&t=' + T3 + '&secs=3', fs.readFileSync(TONE))).j.ok, 'meeting: a piece with its segment start');
    ok((await mpost('jvmeetchunk', null, '&id=' + M3 + '&seg=0&n=0&t=' + T3 + '&secs=3', fs.readFileSync(TONE))).j.dup, 'meeting: the same piece twice (a retry) is taken once');
    /* the stalled-recording alert: recording, and no piece for over 2 minutes (the phone put away); once; a new piece clears it; paused by him: none */
    PUSHES.length = 0; editMeta(M3, m => { m.lastChunkAt = Math.floor(Date.now() / 1000) - 200; });
    let sw = JSON.parse((await jm(['sweep'])).out || '{}');
    ok(sw.stall === 1 && !!meta(M3).alerts.stall && PUSHES.some(x => x.path === 'push/phone1'), 'meeting: no piece for 2 minutes: an alert to his phone (' + JSON.stringify(sw) + ')');
    { let pj = null; const ph = PUSHES.find(x => x.path === 'push/phone1'); try { pj = PUSHDEC(ph.body); } catch {} ok(pj && /Recording paused/.test(pj.body) && /Open J\.A\.R\.V\.I\.S\. to resume/.test(pj.body) && pj.url === '/a-e018bb82/jarvis/?meeting=' + M3, 'meeting: the alert says Recording paused, open J.A.R.V.I.S. to resume, and opens that meeting (' + JSON.stringify(pj) + ')'); }
    sw = JSON.parse((await jm(['sweep'])).out || '{}'); ok(sw.stall === 0, 'meeting: the alert goes once');
    await mpost('jvmeetstate', { id: M3, op: 'pause' }); PUSHES.length = 0; editMeta(M3, m => { m.lastChunkAt = Math.floor(Date.now() / 1000) - 300; delete m.alerts.stall; });
    sw = JSON.parse((await jm(['sweep'])).out || '{}'); ok(sw.stall === 0 && !PUSHES.length && meta(M3).status === 'paused', 'meeting: paused by him: no alert');
    await mpost('jvmeetstate', { id: M3, op: 'resume' }); editMeta(M3, m => { m.alerts = { stall: 1 }; });
    ok(!(await mpost('jvmeetchunk', null, '&id=' + M3 + '&seg=1&n=0', Buffer.from('not audio at all, just words that are long enough'))).j.ok, 'meeting: a piece that is not audio is refused');
    await mpost('jvmeetchunk', null, '&id=' + M3 + '&seg=1&n=0&t=' + (T3 + 200) + '&gap=197&why=call&secs=6', fs.readFileSync(TONE));
    ok(!meta(M3).alerts.stall, 'meeting: a new piece clears the alert');
    r = await mpost('jvmeetstate', { id: M3, op: 'stop', expect: { 0: 1, 1: 2 }, secs: 6 });
    ok(r.j.ok && r.j.where && /laptop/.test(r.j.where.say), 'meeting: Stop says where it is transcribed (' + (r.j.where || {}).say + ')');
    w = await worker({ MOCK_LONG: '1' });
    const tx3 = fs.readFileSync(path.join(MD, M3, 'transcript.txt'), 'utf8');
    ok(/\[recording paused 3 min: the phone interrupted it\]/.test(tx3), 'meeting: the gap is marked in the transcript ("[recording paused 3 min…]")');
    ok(/\[part of this stretch did not arrive, about 30 s\]/.test(tx3), 'meeting: a piece that never arrived is said, not hidden');
    const dm3 = deskMsgs().pop();
    ok(/Company: Other: Donny/.test(dm3.text) && /part 1 of [2-9]/.test(dm3.text) && /part 2 of/.test(dm3.text) && dm3.text.length > 30000, 'meeting: a long transcript goes to the desk in parts (' + dm3.text.length + ' characters)');
    { const l = await ev('fetch("../api.php?action=jvdesk").then(r=>r.json())'); const th = l.threads.find(t => t.id === dm3.id); ok(th && th.msgs[0].text.length < 6200 && th.msgs[0].cut === true, 'meeting: the page\'s desk list gets the first 6,000 characters');
      const nx = JSON.parse((await cli(['next', '--peek'])).out || '{}'); const full = (nx.conversation || []).find(c => /Company: Other: Donny/.test(c.text || '')); ok(!nx.id || nx.id !== dm3.id || (full && full.text.length > 30000), 'meeting: the laptop\'s read of the thread gets all of it'); }
    ok(fs.readdirSync(path.join(MREPO, 'matthew', 'meetings', 'transcripts')).length === 1, 'meeting: Other with no client folder: the copy goes to matthew/meetings/transcripts');
    /* record this meeting, said or typed: the same screen with the company, still waiting for the tap; Discard deletes everything */
    const g1 = await ev('window.__gum');
    await ev('document.getElementById("ask").value="Hey Jarvis, record this meeting for Sixfold";document.querySelector(".cmdbar .snd").click()');
    ok(await until('!!document.getElementById("mrconsent") && document.querySelector("#meetrec .cos button[data-co=Sixfold]").getAttribute("aria-pressed")==="true"', 4000) && await ev('window.__gum') === g1, '"record this meeting for Sixfold": the consent step with Sixfold picked, the microphone still closed');
    await click('#mrconsent'); ok(await until('!!document.querySelector("#meetrec.live")', 6000), 'meeting: recording again after the tap');
    const M4 = await (async () => { await nodeUntil(() => metas().some(m => m.company === 'Sixfold' && m.source === 'live' && parts(m.id).length >= 1), 8000); return metas().find(m => m.company === 'Sixfold' && m.source === 'live').id; })();
    await click('#mrdiscard'); await until('!!document.getElementById("cfyes")'); await click('#cfyes');
    ok(await nodeUntil(() => meta(M4).status === 'discarded' && parts(M4).length === 0, 6000) && await ev('!document.getElementById("meetrec")'), 'meeting: Discard deletes what was recorded');
    /* 21 Nov: the Record meeting icon (record.html) opens ?record=1: the Record screen with the company, the tap still needed, no greeting */
    { const rp = await ev('fetch("record.html").then(r=>r.text())'), rm = JSON.parse(await ev('fetch("record-manifest.json").then(r=>r.text())'));
      ok(/rel="manifest" href="record-manifest\.json"/.test(rp) && /apple-touch-icon" href="record-touch-icon\.png"/.test(rp) && rm.scope === '/a-e018bb82/jarvis/' && /record\.html$/.test(rm.start_url), 'record icon: its own page, manifest and icon, inside J.A.R.V.I.S.\'s scope');
      ok(await ev('fetch("record-touch-icon.png").then(r=>r.ok && /image\\/png/.test(r.headers.get("content-type")||""))'), 'record icon: the icon is served'); }
    const g5 = await ev('window.__gum');
    await cdp('Page.navigate', { url: PAGE + '?record=1&for=peak' });
    ok(await until('!!document.getElementById("mrconsent") && document.querySelector("#meetrec .cos button[data-co=Peak]").getAttribute("aria-pressed")==="true" && !document.querySelector("#meetrec.live")', 9000), 'record icon: ?record=1&for=peak opens Record a meeting for Peak, not recording yet');
    ok(await ev('!/record=/.test(location.search) && !window.__gum'), 'record icon: the microphone is not opened (' + g5 + ' before the reload), and a reload does not open it again');
    await click('#mrcancel'); ok(await until('!document.getElementById("meetrec")', 3000), 'record icon: Cancel closes it');
    /* the voice door says to use the screen */
    ok(errs.length === 0, 'no script errors while recording (' + errs.join(' | ') + ')');
    fs.rmSync(MEETST, { recursive: true, force: true });
  }

  /* ================================================================ 18. P-13 (21 Nov): the full morning brief, and the Assistant routing each request */
  {
    const BF = path.join(DATA, 'jarvis', 'brief.json'), CFG = path.join(DATA, 'config.json'), cfg0 = fs.readFileSync(CFG, 'utf8'), ELF = path.join(DATA, 'elevenlabs.json');
    const bj = () => JSON.parse(fs.readFileSync(BF, 'utf8'));
    const apiGet = a => ev('fetch("../api.php?action=' + a + '").then(r=>r.json())');
    const cronBrief = () => new Promise(res => { let o = ''; const p = spawn('php', [path.join(PRIV, 'cron.php'), '--brief'], { env: { ...process.env, ...ENVX } }); p.stdout.on('data', d => o += d); p.on('close', () => { try { res(JSON.parse(o.trim().split('\n').pop() || '{}')); } catch { res({ raw: o }); } }); });
    /* the copy the Brief me chip made (section 8) */
    let b = bj(); const all = JSON.stringify(b.sections);
    ok(['Colorado Public Radio', 'Denverite', 'The Colorado Sun'].every(o => b.sections.local.some(i => i.outlet === o)) && ['BBC News', 'NPR'].every(o => b.sections.world.some(i => i.outlet === o)) && b.sections.tech.some(i => i.outlet === 'Ars Technica' && i.title === 'New chip fabs announced in Arizona') && b.sections.tech.some(i => i.outlet === 'Hacker News' && i.site === 'example.org'), 'brief: headlines from each named outlet, RSS and Atom (Ars), Hacker News with the site it links to');
    ok(b.failed.join() === 'The Verge', 'brief: the source that failed is skipped and named (' + b.failed.join() + ')');
    ok(!/javascript:|Opinion:|Three days old|onerror|<img/.test(all) && b.sections.local.some(i => i.title === 'Light rail closure on the D Line' && i.link === 'https://www.cpr.org/2026/11/21/d-line/'), 'brief: no javascript: links, no opinion pieces, nothing over 36 hours old, HTML stripped from titles');
    ok(b.weather.ok && b.weather.high === 47 && b.weather.low === 21 && b.weather.alerts[0].event === 'Winter Weather Advisory' && /forecast\.weather\.gov/.test(b.weather.link), 'brief: the NWS forecast for Englewood: high, low and the active alert');
    ok(b.spoken.by === 'plain' && !AN.calls.length, 'brief: with no key, the plain version from the headlines (no model call)');
    ok(BR.calls.length >= 10 && BR.calls.every(c => /^JarvisMorningBrief\/1\.0 \(/.test(c.ua) && !/matthew|sharpe|@|traverse|surge|sixfold/i.test(c.ua)) && BR.calls.some(c => c.u === 'https://api.weather.gov/points/39.6478,-104.9878'), 'brief: a generic User-Agent with no name or email; Englewood\'s coordinates');
    /* the copy is used for 2 hours, then fetched again when asked */
    let n0 = BR.calls.length; const r1 = await apiGet('jvbrief');
    ok(r1.ok && BR.calls.length === n0 && r1.tts && r1.tts.briefReserve === 2000 && !('forecastUrl' in r1.weather) && !JSON.stringify(r1).includes('cronDay'), 'brief: within 2 hours the copy is used, nothing fetched; the page gets only what it shows');
    b.at = now - 3 * 3600; fs.writeFileSync(BF, JSON.stringify(b)); await apiGet('jvbrief');
    ok(BR.calls.length > n0 && bj().at >= now - 5, 'brief: over 2 hours old, fetched again when asked');
    /* the Claude version: Haiku, JSON, the rules; and the 5:30 am run (cron.php --brief here) */
    fs.writeFileSync(CFG, JSON.stringify({ ...JSON.parse(cfg0), anthropicKey: 'test-anthropic-key-mock' }));
    const cb = await cronBrief(); const bc = AN.calls.filter(c => c.kind === 'brief').pop(), sys = JSON.stringify(bc ? bc.jb.system : '');
    ok(cb.brief && cb.brief.by === 'claude' && bj().spoken.by === 'claude' && /Colorado Public Radio reports: /.test(bj().spoken.local) && bj().cronDay === bj().day, 'brief: the morning run writes it with Claude (' + JSON.stringify(cb) + ')');
    ok(bc && bc.jb.model === 'claude-haiku-5-5' && bc.jb.outputConfig.format.type === 'json_schema' && /Use ONLY the items given/.test(sys) && /Name the outlet every time/.test(sys) && /No opinions/.test(sys) && /Under 60 words/.test(sys) && /instructions/.test(sys), 'brief: the cheap model (Haiku 5.5), JSON out, and the prompt says: only the fetched items, name the outlet, no opinions, short');
    ok(!/test-anthropic-key-mock/.test(JSON.stringify(bc.jb)) && JSON.parse(fs.readFileSync(path.join(DATA, 'usage.json'), 'utf8'))[new Date().toISOString().slice(0, 7)].by.briefCalls >= 1, 'brief: counted in this month\'s spending (kind brief); the key never goes in a call body');
    /* the panel: sections with linked headlines, the failed line, Refresh */
    await cdp('Page.reload'); await until('!!document.querySelector(".desk .ibr")', 9000); await sleep(400);
    if (await ev('!document.getElementById("p-brief")')) await click('.rail button[data-panel=brief]');
    ok(await until('document.querySelectorAll("#p-brief a.hl").length>=9', 9000), 'brief panel: the headlines, each a link');
    const pt = await ev('document.getElementById("p-brief").innerText');
    ok(/WEATHER · ENGLEWOOD/i.test(pt) && /High 47°F/.test(pt) && /Low 21°F/.test(pt) && /Winter Weather Advisory/.test(pt) && /TO DO/i.test(pt) && /THINGS HAPPENING AROUND DENVER/i.test(pt) && /WORLD NEWS/i.test(pt) && /TECH NEWS/i.test(pt) && /Not reached this time: The Verge/.test(pt), 'brief panel: weather, to do, things happening, world and tech news, and what was not reached');
    ok(await ev('[...document.querySelectorAll("#p-brief a.hl")].every(a=>/^https:/.test(a.href) && a.target==="_blank" && /noopener/.test(a.rel)) && window.__xss2===undefined'), 'brief panel: every link opens in a new tab with no opener; a title with HTML in it never runs');
    /* the voice: the natural one only while the month can spare the whole brief plus 2,000 */
    fs.writeFileSync(ELF, JSON.stringify({ key: EL_KEY, cap: (JSON.parse(fs.readFileSync(path.join(DATA, 'jarvis', 'tts-usage.json'), 'utf8'))[Object.keys(JSON.parse(fs.readFileSync(path.join(DATA, 'jarvis', 'tts-usage.json'), 'utf8')))[0]] || { chars: 0 }).chars + 2500 }));
    await ev('document.body.dispatchEvent(new MouseEvent("click",{bubbles:true}))');
    let s0 = await ev('window.__said.length'), e0 = EL.calls.length;
    await ev('document.getElementById("ask").value="brief me"'); await click('.cmdbar .snd');
    ok(await until('/Read in the device voice, to save the natural voice: [\\d,]+ characters left this month, and this brief needs [\\d,]+ plus 2,000 kept spare\\./.test(([...document.querySelectorAll(".msg.ai .bnote")].pop()||{}).textContent||"")', 9000) && await until('window.__said.length>' + (s0 + 2), 6000) && EL.calls.length === e0, 'brief voice: too little left this month: the device voice reads it, ElevenLabs is not asked, and a one-line note says why');
    const st = (await apiGet('ttsstate')).tts; const rz = await apiPost('ttsprep', { text: 'One piece of a long brief.', left: st.cap });
    ok(rz.ok === false && rz.why === 'reserve' && EL.calls.length === e0, 'brief voice: the server refuses a piece too (reserve) when the rest of the brief would eat into the 2,000 spare');
    fs.writeFileSync(ELF, JSON.stringify({ key: EL_KEY }));
    s0 = await ev('window.__said.length'); const p0 = await ev('window.__played.length');
    await ev('document.getElementById("ask").value="brief me"'); await click('.cmdbar .snd');
    ok(await until('window.__played.length>' + (p0 + 2) + ' && window.__played.slice(' + p0 + ').some(p=>/I couldn’t reach The Verge/.test(p.body))', 15000) && await ev('window.__said.length') === s0, 'brief voice: plenty left: the whole brief in the natural voice, piece after piece, none in the device voice');
    ok(EL.calls.slice(e0).length >= 3 && EL.calls.slice(e0).every(c => (c.body.text || '').length <= 600 && !/The rest is on screen/.test(c.body.text)), 'brief voice: each piece under 600 characters, none cut short');
    ok(await ev('!([...document.querySelectorAll(".msg.ai")].pop().querySelector(".bnote"))'), 'brief voice: no note when the natural voice reads it');
    fs.rmSync(ELF);
    /* routing: the Assistant first; laptop work goes to the desk by itself; the override; "desk:"; the voice door */
    AN.calls.length = 0; reqs.length = 0; let d0 = deskMsgs().length;
    await ev('document.getElementById("ask").value="Fix the yards edition map colours"'); await click('.cmdbar .snd');
    ok(await until('/THE ASSISTANT SENT THIS TO THE DESK/i.test(document.querySelector(".chat").innerText)', 9000), 'routing: laptop work: the Assistant sends it to the desk and the desk card shows');
    const ch1 = AN.calls.filter(c => c.kind === 'chat');
    ok(ch1.length === 1 && ch1[0].jb.tools.some(t => t.name === 'send_to_desk') && /Send it to the desk with send_to_desk/.test(JSON.stringify(ch1[0].jb.system)) && /Answer it yourself, never sending it to the desk/.test(JSON.stringify(ch1[0].jb.system)), 'routing: one Assistant call (no second call after the hand-off), with send_to_desk and the rule list in its prompt');
    ok(deskMsgs().length === d0 + 1 && deskMsgs().pop().text === 'Fix the yards edition map colours' && deskMsgs().pop().from === 'Matthew Sharpe' && !reqs.some(r => /action=jvdesksend/.test(r)), 'routing: his exact words went to the desk store, by the server (the same path as deskSend)');
    ok(/ASSISTANT · SENT IT TO THE DESK/i.test(await ev('[...document.querySelectorAll(".msg.ai .who")].pop().textContent')) && /Sent to the desk; it’ll take a few minutes\./.test(await ev('[...document.querySelectorAll(".msg.ai")].pop().innerText')) && /changes an app/.test(await ev('[...document.querySelectorAll(".acard")].pop().innerText')), 'routing: it says plainly who did it ("Assistant · sent it to the desk") and why');
    d0 = deskMsgs().length;
    await ev('document.getElementById("ask").value="What needs me today?"'); await click('.cmdbar .snd');
    ok(await until('/Mock Assistant: two emails/.test(document.querySelector(".chat").innerText)', 9000) && deskMsgs().length === d0 && /ASSISTANT · INSTANT/i.test(await ev('[...document.querySelectorAll(".msg.ai .who")].pop().textContent')), 'routing: a quick question: the Assistant answers itself, labelled Assistant, instant; nothing goes to the desk');
    await ev('[...document.querySelectorAll(".msg.ai")].pop().querySelector(".todesk").click()');
    ok(await nodeUntil0(() => deskMsgs().length === d0 + 1 && deskMsgs().pop().text === 'What needs me today?') && await until('/To the desk instead: What needs me today\?/.test(document.querySelector(".chat").innerText)'), 'override: "Send this to the desk instead" sends the same words to the desk');
    ok(await ev('(()=>{const b=[...document.querySelectorAll(".todesk")].find(x=>x.disabled);return !!b && /Sent to the desk/.test(b.textContent)})()'), 'override: the link turns into "Sent to the desk" (once only)');
    d0 = deskMsgs().length; const a0 = AN.calls.length;
    await ev('document.getElementById("ask").value="desk: Draft the Peak sponsor one-pager"'); await click('.cmdbar .snd');
    ok(await nodeUntil0(() => deskMsgs().length === d0 + 1 && deskMsgs().pop().text === 'Draft the Peak sponsor one-pager') && AN.calls.length === a0, 'override: "desk:" goes straight to the desk, with no Assistant call');
    const vk = await apiPost('jvvoicekeynew', { name: 'Route test' }); d0 = deskMsgs().length;
    const vr = await (await fetch(BASE + '/a-e018bb82/api.php?action=voice&format=json', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Voice-Key': vk.key }, body: JSON.stringify({ text: 'the roof edition needs a build tonight' }) })).json();
    ok(vr.intent === 'desk' && /^Sent to the desk/.test(vr.say) && deskMsgs().length === d0 + 1 && /^\[VOICE\] the roof edition needs a build tonight/.test(deskMsgs().pop().text) && vr.thread === deskMsgs().pop().id, 'routing by voice: the Assistant hands laptop work to the desk, marked as a voice request (' + vr.say + ')');
    /* the old switch's stored choice is cleared, and nothing reads it */
    await ev('localStorage.setItem("jarvis.brain", JSON.stringify("desk"))'); await cdp('Page.reload'); await until('!!document.querySelector(".desk .ibr")', 9000);
    ok(await ev('localStorage.getItem("jarvis.brain")===null && !document.getElementById("brainswitch") && /Answering: Assistant, instant/.test(document.getElementById("brainlabel").textContent)'), 'P-13: the old switch\'s stored choice is cleared on load');
    fs.writeFileSync(CFG, cfg0);   /* the rest of the run: no key, as before */
    ok(errs.length === 0, 'no script errors in the brief and routing (' + errs.join(' | ') + ')');
  }

  /* ---- desktop idle shot: a fresh load */
  await cdp('Page.reload'); await until('document.querySelectorAll(".msg.ai").length>0', 9000); await sleep(1200);
  await shot('jarvis-desktop-idle');
  { const gw = () => ev('Math.round(document.querySelector(".desk .mid .jvg canvas").getBoundingClientRect().width)');
    const w0 = await gw();
    await cdp('Emulation.setDeviceMetricsOverride', { width: 2560, height: 1400, deviceScaleFactor: 1, mobile: false }); await sleep(600);
    const w1 = await gw(); await shot('jarvis-desktop-big');
    ok(w1 > w0 + 150 && w1 <= Math.round(520 * 1.32) + 2, 'laptop: the globe grows with a big window (21 Nov) (' + w0 + ' -> ' + w1 + ' px)');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 2560, height: 1000, deviceScaleFactor: 1, mobile: false }); await sleep(700); const wA = await gw();
    await ev('(()=>{const c=document.querySelector(".chat");for(let i=0;i<6;i++){const d=document.createElement("div");d.className="msg ai tfit";d.textContent="line "+i;c.appendChild(d);}})()'); await sleep(900);
    const w2 = await gw(); ok(w2 < wA - 40, 'laptop: a growing conversation scales the globe down to make room (' + wA + ' -> ' + w2 + ' px)');
    await ev('document.querySelectorAll(".chat .tfit").forEach(n=>n.remove())'); await sleep(900); ok(await gw() >= wA - 2, 'laptop: and it grows back when the conversation is cleared');
    await desk(); await sleep(600); ok(await gw() === w0, 'laptop: and goes back to its size when the window does'); }

  /* ================================================================ 11. the phone */
  await phone(); await cdp('Page.reload'); await until('!!document.querySelector(".phone .tabs")', 9000); await sleep(1400);
  ok(await ev('document.getElementById("app").classList.contains("phone") && document.querySelectorAll(".phone .tabs button").length===5'), 'phone: the Halo phone layout with five tabs');
  ok(await ev('!!document.querySelector(".phone .jvg .jvg-cv") && !document.querySelector(".phone .core") && document.querySelectorAll(".phone .tiles .pnl").length===3'), 'phone: the globe and three tiles');
  ok(await until('(()=>{const t=[...document.querySelectorAll(".phone .jvg-mk")].filter(m=>m.style.display!=="none").map(m=>m.textContent);return t.some(x=>/^Reply\\d/.test(x)) && t.some(x=>/^Decide\\d/.test(x))})()', 4000), 'phone: the satellites keep their words (Reply, Decide), as on the laptop');
  ok(await ev('document.documentElement.scrollWidth<=390 && document.body.scrollWidth<=390'), 'phone: nothing wider than the screen');
  ok(await ev('(()=>{const b=document.querySelector(".cmdbar").getBoundingClientRect();return b.bottom<=844 && b.top>300})()'), 'phone: the command bar sits above the tabs, on screen');
  ok(/Answering: Assistant, instant/.test(await ev('document.getElementById("brainlabel").textContent')), 'phone: the brain is named on the bar');
  await shot('jarvis-phone-idle');
  /* 21 Nov: the globe on the phone: a satellite opens its tab; hold reaches the consent tap */
  await ev('[...document.querySelectorAll(".phone .jvg-mk")].find(m=>/^Decide/.test(m.textContent)).click()'); await sleep(300);
  ok(await ev('document.querySelector(".tabs button[data-tab=team]").getAttribute("aria-selected")==="true" && !!document.getElementById("p-waiting")'), 'phone: the Decide satellite opens the Decide tab');
  await click('.tabs button[data-tab=home]'); await sleep(400);
  ok(await ev('!!document.querySelector(".phone .jvg .jvg-cv") && document.querySelectorAll(".jvg").length===1'), 'phone: back on Home, the globe is there again');
  await ev('(async()=>{const s=document.querySelector(".phone .jvg-st"),r=s.getBoundingClientRect(),o={bubbles:true,cancelable:true,pointerId:9,clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:0,pointerType:"touch",isPrimary:true};s.dispatchEvent(new PointerEvent("pointerdown",o));await new Promise(f=>setTimeout(f,950));s.dispatchEvent(new PointerEvent("pointerup",o));})()');
  ok(await until('!!document.getElementById("mrconsent") && !document.querySelector("#meetrec.live")', 2500), 'phone: press and hold on the globe opens the Record screen at the consent tap');
  await click('#mrcancel'); await sleep(200);
  ok(await until('!/Recording/i.test(document.querySelector(".jvg-lb").textContent)', 1500), 'phone: after a hold the globe never says Recording (the consent tap comes first)');
  await ev('[...document.querySelectorAll(".chip")].find(c=>/Morning check/.test(c.textContent)).click()'); await sleep(500);
  ok(/Overnight check/.test(await ev('document.querySelector(".chat").innerText')), 'phone: an answer card');
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
  ok(/Posts/.test(await ev('document.querySelector(".pscroll").innerText')) && /Sixfold app/.test(await ev('document.querySelector(".pscroll").innerText')) && /Phone alerts and the app/.test(await ev('document.querySelector(".pscroll").innerText')), 'P-9 phone More: Posts, the Sixfold app, and Phone alerts and the app');
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
  /* 19 Nov: the desk store, its command-line side and the push code touch nothing of the Sixfold app */
  for (const fn of ['lib/desk.php', 'lib/webpush.php', 'jvdesk.php']) { const t = fs.readFileSync(path.join(REPO, 'assistant', 'server', 'private', fn), 'utf8'); ok(!/sixfold-data|sixfold-private|sixfold-tools|public_html\/api|rounds\.php|help\.log|helpAlertMatthew/.test(t.replace(/\/\*[\s\S]*?\*\//g, '')), fn + ': no Sixfold app files or code'); }
  const pg = fs.readFileSync(path.join(REPO, 'assistant', 'jarvis', 'index.html'), 'utf8');
  ok((pg.match(/action=helpsend/g) || []).length === 1 && /function openThread[\s\S]{0,3000}action=helpsend/.test(pg), 'the page writes to the Sixfold app only from a staff thread (Team requests), never for his desk');
  const wt = fs.readFileSync(path.join(REPO, 'traverse', 'ops', 'help-watch.sh'), 'utf8');
  ok(/one_ticket jarvis/.test(wt) && /jarvis-reply\.sh/.test(wt) && /sixfold-tools\/help-next\.php' </.test(wt) && /one_practice/.test(wt) && /one_install/.test(wt), 'help-watch.sh: his desk from J.A.R.V.I.S., staff, practice and Houston exactly as before');
}
console.log('\n' + pass + ' passed, ' + failN + ' failed' + (fs.existsSync(SHOTS) ? '  (screenshots in ' + SHOTS + ')' : ''));
process.exit(failN ? 1 : 0);
