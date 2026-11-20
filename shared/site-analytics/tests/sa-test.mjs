// Site analytics collector + stats page tests (2026-11-20). Runs lib.php / c.php / stats.php from this folder under php -S on a temp copy,
// with a test config (test_mode lets a request set its IP and time with X-Test-IP / X-Test-Time). Nothing real is touched.
//   node shared/site-analytics/tests/sa-test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), SRC = path.resolve(HERE, '..');
let pass = 0, fail = 0; const ok = (c, w) => { if (c) pass++; else { fail++; console.log('FAIL:', w); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'sat-')), PRIV = path.join(T, 'site-analytics'), DOC = path.join(T, 'public_html');
fs.mkdirSync(PRIV); fs.mkdirSync(path.join(DOC, 'sv'), { recursive: true }); fs.mkdirSync(path.join(DOC, 'stats-x'));
fs.copyFileSync(path.join(SRC, 'lib.php'), path.join(PRIV, 'lib.php'));
fs.copyFileSync(path.join(SRC, 'c.php'), path.join(DOC, 'sv', 'c.php'));
fs.copyFileSync(path.join(SRC, 'stats.php'), path.join(DOC, 'stats-x', 'index.php'));
const PORT = 18813, CODE = '12345678', KEY = crypto.randomBytes(32).toString('hex');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
fs.writeFileSync(path.join(PRIV, 'config.php'), `<?php return ['site'=>'t','label'=>'Test site','hosts'=>['test.local'],'tz'=>'America/Denver',
'conversions'=>['demo_booked','call_tap'],'events'=>['outbound'],'goal_paths'=>['/start/welcome/'=>'demo_booked'],'exclude_ips'=>['9.9.9.9'],
'per_visitor'=>40,'max_day'=>100000,'test_mode'=>true,'sum_key'=>'${KEY}','code_hash'=>'${sha('sv|' + CODE)}',
'remotes'=>[['id'=>'r','label'=>'Remote','host'=>'remote.local','url'=>'http://127.0.0.1:${PORT + 1}/sv/c.php','key'=>'${KEY}']]];`);
const srv = spawn('php', ['-S', '127.0.0.1:' + PORT, '-t', DOC], { stdio: 'ignore', env: { ...process.env, SV_PRIVATE: PRIV, PHP_CLI_SERVER_WORKERS: '4' } });
const srv2 = spawn('php', ['-S', '127.0.0.1:' + (PORT + 1), '-t', DOC], { stdio: 'ignore', env: { ...process.env, SV_PRIVATE: PRIV } });   // the 'remote' site (php -S on Windows answers one request at a time)
await sleep(900);

function req(method, p, body, headers = {}) {
  return new Promise((res) => {
    const r = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers: { 'User-Agent': UA, ...headers } }, (x) => {
      let b = ''; x.on('data', c => b += c); x.on('end', () => res({ status: x.statusCode, body: b, headers: x.headers }));
    });
    r.on('error', e => res({ status: 0, body: String(e) })); if (body !== undefined) r.write(body); r.end();
  });
}
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DAY1 = Math.floor(Date.parse('2026-11-18T18:00:00Z') / 1000), DAY2 = DAY1 + 86400;
const pid = () => crypto.randomBytes(6).toString('hex');
const send = (o, { ip = '1.2.3.4', t = DAY1, ua = UA, origin = 'https://test.local', extra = {} } = {}) =>
  req('POST', '/sv/c.php', typeof o === 'string' ? o : JSON.stringify({ h: 'test.local', p: '/', id: pid(), ...o }), { 'Content-Type': 'text/plain', Origin: origin, 'X-Test-IP': ip, 'X-Test-Time': String(t), 'User-Agent': ua, ...extra });
const dataFiles = () => fs.existsSync(path.join(PRIV, 'data')) ? fs.readdirSync(path.join(PRIV, 'data')).map(f => [f, fs.readFileSync(path.join(PRIV, 'data', f), 'utf8')]) : [];
const lines = day => { const f = path.join(PRIV, 'data', 'ev-' + day + '.jsonl'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []; };

try {
  // a page view is kept, with no IP and no user agent
  let r = await send({ k: 'pv', p: '/demo/', e: 1, r: 'www.google.com', us: 'email', um: 'prospect', uc: 'launch', z: 'America/Denver' });
  ok(r.status === 204, 'page view accepted (' + r.status + ' ' + r.body + ')');
  let L = lines('2026-11-18');
  ok(L.length === 1 && L[0].k === 'pv' && L[0].p === '/demo/' && L[0].r === 'google.com' && L[0].us === 'email' && L[0].d === 'phone' && L[0].b === 'Safari', 'page view stored with path, referrer domain, utm, device, browser: ' + JSON.stringify(L[0]));
  ok(/^[0-9a-f]{16}$/.test(L[0].v || ''), 'visitor key is a 16-hex hash');
  const all = dataFiles().map(x => x[1]).join('\n');
  ok(!all.includes('1.2.3.4') && !/\b\d{1,3}(\.\d{1,3}){3}\b/.test(all), 'no IP address in any data file');
  ok(!all.includes('iPhone OS') && !all.includes('AppleWebKit'), 'the user agent itself is not stored');

  // same device same day = same key; another day = different key, old salt gone
  await send({ k: 'pv', p: '/' }); L = lines('2026-11-18');
  ok(L[1].v === L[0].v, 'same device, same day: same visitor key');
  await send({ k: 'pv', p: '/' }, { ip: '5.6.7.8' }); L = lines('2026-11-18');
  ok(L[2].v !== L[0].v, 'another address: another visitor');
  const salt1 = JSON.parse(fs.readFileSync(path.join(PRIV, 'data', 'salt.json'), 'utf8'));
  await send({ k: 'pv', p: '/' }, { t: DAY2 }); const L2 = lines('2026-11-19');
  const salt2 = JSON.parse(fs.readFileSync(path.join(PRIV, 'data', 'salt.json'), 'utf8'));
  ok(L2.length === 1 && L2[0].v !== L[0].v, 'next day: the same device gets a new key');
  ok(salt1.day === '2026-11-18' && salt2.day === '2026-11-19' && salt1.salt !== salt2.salt && !fs.readFileSync(path.join(PRIV, 'data', 'salt.json'), 'utf8').includes(salt1.salt), 'the salt rotates daily and the old one is not kept');

  // Do Not Track / GPC
  const before = lines('2026-11-18').length;
  r = await send({ k: 'pv', p: '/dnt/' }, { extra: { DNT: '1' } }); ok(r.status === 204, 'DNT answered 204');
  r = await send({ k: 'pv', p: '/gpc/' }, { extra: { 'Sec-GPC': '1' } }); ok(r.status === 204, 'GPC answered 204');
  ok(lines('2026-11-18').length === before, 'DNT and GPC requests are not stored');

  // excluded address
  r = await send({ k: 'pv', p: '/ours/' }, { ip: '9.9.9.9' }); ok(r.status === 204 && lines('2026-11-18').length === before, 'excluded address not stored');

  // bots
  r = await send({ k: 'pv', p: '/' }, { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', ip: '7.7.7.7' });
  r = await send({ k: 'pv', p: '/', wd: 1 }, { ip: '7.7.7.8' });
  L = lines('2026-11-18'); const bots = L.filter(x => x.k === 'bot');
  ok(r.status === 204 && bots.length === 2 && bots.every(b => !b.v && !b.b), 'bots (user agent or webdriver) kept only as bare bot rows');

  // conversions and events
  const id = pid();
  r = await send({ k: 'ev', n: 'demo_booked', id, p: '/demo/' }); ok(r.status === 204, 'conversion accepted');
  r = await send({ k: 'ev', n: 'outbound', x: 'www.facebook.com', p: '/' }); ok(r.status === 204, 'outbound event accepted');
  r = await send({ k: 'lv', s: 42, id, p: '/demo/' }); ok(r.status === 204, 'time on page accepted');
  r = await send({ k: 'pv', p: '/start/welcome/' }, { ip: '2.2.2.2' });
  L = lines('2026-11-18');
  ok(L.some(x => x.k === 'ev' && x.n === 'demo_booked' && x.p === '/demo/') && L.some(x => x.k === 'ev' && x.n === 'demo_booked' && x.p === '/start/welcome/'), 'conversions recorded (sent, and by goal page)');

  // malformed input
  const bad = [
    ['not json', 'xx{'], ['a list', '[1,2]'], ['wrong host', JSON.stringify({ h: 'evil.com', k: 'pv', p: '/', id: pid() })],
    ['bad kind', JSON.stringify({ h: 'test.local', k: 'zz', p: '/', id: pid() })], ['path with query', JSON.stringify({ h: 'test.local', k: 'pv', p: '/q/?q=secret', id: pid() })],
    ['path not absolute', JSON.stringify({ h: 'test.local', k: 'pv', p: 'demo', id: pid() })], ['bad id', JSON.stringify({ h: 'test.local', k: 'pv', p: '/', id: 'x' })],
    ['unknown event', JSON.stringify({ h: 'test.local', k: 'ev', n: 'made_up', p: '/', id: pid() })], ['utm with markup', JSON.stringify({ h: 'test.local', k: 'pv', p: '/', id: pid(), us: '<script>' })],
    ['negative time', JSON.stringify({ h: 'test.local', k: 'lv', p: '/', id: pid(), s: -1 })], ['referrer url not domain', JSON.stringify({ h: 'test.local', k: 'pv', p: '/', id: pid(), r: 'https://x.com/a?b' })],
  ];
  for (const [w, b] of bad) { r = await send(b); ok(r.status === 400, 'rejects ' + w + ' (' + r.status + ')'); }
  r = await send({ k: 'pv', p: '/' }, { origin: 'https://evil.com' }); ok(r.status === 403, 'rejects another site as Origin');
  r = await req('POST', '/sv/c.php', JSON.stringify({ h: 'test.local', k: 'pv', p: '/', id: pid() }), { 'X-Test-IP': '1.2.3.4', 'X-Test-Time': String(DAY1) }); ok(r.status === 403, 'rejects no Origin and no Referer');
  r = await send(JSON.stringify({ h: 'test.local', k: 'pv', p: '/', id: pid(), pad: 'x'.repeat(3000) })); ok(r.status === 413, 'rejects an oversize body (' + r.status + ')');
  r = await req('GET', '/sv/c.php'); ok(r.status === 405, 'GET refused');
  ok(!lines('2026-11-18').some(x => String(x.p).includes('?')), 'no query string ever stored');

  // rate limit (40 per 10 min per visitor key in the test config)
  let codes = []; for (let i = 0; i < 45; i++) codes.push((await send({ k: 'pv', p: '/rate/' }, { ip: '3.3.3.3' })).status);
  ok(codes.slice(0, 40).every(c => c === 204) && codes.slice(40).every(c => c === 429), 'rate limited after 40 in 10 minutes (' + codes.slice(38).join(',') + ')');
  ok((await send({ k: 'pv', p: '/' }, { ip: '3.3.3.4' })).status === 204, 'another visitor is not affected by the limit');
  ok((await send({ k: 'pv', p: '/rate/' }, { ip: '3.3.3.3', t: DAY1 + 700 })).status === 204, 'the limit resets in the next 10-minute window');
  for (let i = 0; i < 40; i++) await send({ k: 'pv', p: '/' }, { ip: '3.3.3.9', t: DAY1 + 1400 });   // fill this visitor's window too

  // self-check user agent goes to check-*.jsonl, not the numbers
  const n0 = lines('2026-11-18').length;
  await send({ k: 'pv', p: '/selfcheck/' }, { ua: UA + ' sv-selfcheck', ip: '4.4.4.4' });
  ok(lines('2026-11-18').length === n0 && fs.existsSync(path.join(PRIV, 'data', 'check-2026-11-18.jsonl')), 'self-check visits kept apart');

  // the report endpoint
  r = await req('POST', '/sv/c.php?a=report', '', { 'X-SV-Key': 'nope'.repeat(16), 'X-Test-Time': String(DAY1) }); ok(r.status === 403, 'report refuses a wrong key');
  r = await req('GET', '/sv/c.php?a=report', undefined, { 'X-SV-Key': KEY, 'X-Test-Time': String(DAY1) }); ok(r.status === 403, 'report refuses GET');
  r = await req('POST', '/sv/c.php?a=report', '', { 'X-SV-Key': KEY, 'X-Test-Time': String(DAY1) });
  let J = {}; try { J = JSON.parse(r.body); } catch {}
  const S = J.ranges && J.ranges.today;
  ok(r.status === 200 && S, 'report answers the right key');
  if (S) {
    ok(S.bots === 2, 'bots counted apart (' + S.bots + ')');
    ok(S.visitors === 6, 'visitors = distinct keys, bots left out (' + S.visitors + ')');
    ok(S.conv_visitors === 2 && S.conversions[0][0] === 'demo_booked' && S.conversions[0][1] === 2, 'conversions and converted visitors (' + JSON.stringify(S.conversions) + ')');
    ok(S.conv_rate === 33.3, 'conversion rate (' + S.conv_rate + ')');
    ok(S.sources.some(x => x[0] === 'Email'), 'utm source email shows as Email: ' + JSON.stringify(S.sources));
    ok(S.campaigns.some(x => x[0] === 'email / prospect / launch'), 'campaign listed');
    ok(S.devices[0][0] === 'phone' && S.browsers[0][0] === 'Safari', 'device and browser');
    ok(S.avg_time === 42, 'time on page (' + S.avg_time + ')');
    ok(S.outbound.some(x => x[0] === 'www.facebook.com'), 'outbound domain');
    ok(J.series.length === 30 && J.series[29][0] === '2026-11-18', 'daily series ends today');
    ok(!r.body.includes('1.2.3.4'), 'report carries no address');
  }
  for (let i = 0; i < 11; i++) await req('POST', '/sv/c.php?a=report', '', { 'X-SV-Key': 'bad', 'X-Test-IP': '6.6.6.6', 'X-Test-Time': String(DAY1) });
  r = await req('POST', '/sv/c.php?a=report', '', { 'X-SV-Key': KEY, 'X-Test-IP': '6.6.6.6', 'X-Test-Time': String(DAY1) }); ok(r.status === 429, 'report locks an address out after 10 wrong keys');

  // the stats page
  r = await req('GET', '/stats-x/', undefined, { 'X-Test-Time': String(DAY1) });
  ok(r.status === 200 && /Sign-in code/.test(r.body) && !/Visitors per day/.test(r.body), 'stats page asks for the code first');
  r = await req('POST', '/stats-x/', 'code=99999999', { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Test-Time': String(DAY1) });
  ok(/did not work/.test(r.body) && !r.headers['set-cookie'], 'a wrong code gets no session');
  r = await req('POST', '/stats-x/', 'code=' + CODE, { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Test-Time': String(DAY1) });
  const ck = (r.headers['set-cookie'] || []).map(c => c.split(';')[0]).find(c => c.startsWith('sv_s='));
  ok(r.status === 303 && ck && /HttpOnly/i.test(r.headers['set-cookie'].join(';')) && /SameSite=Strict/i.test(r.headers['set-cookie'].join(';')), 'the right code signs in (HttpOnly, SameSite=Strict)');
  r = await req('GET', '/stats-x/?r=today', undefined, { Cookie: ck, 'X-Test-Time': String(DAY1) });
  ok(r.status === 200 && /Visitors per day/.test(r.body) && /Demo booked/.test(r.body) && /Test site/.test(r.body), 'signed in: the numbers show (' + r.status + ' ' + r.body.slice(-400) + ')');
  r = await req('GET', '/stats-x/?s=r&r=today', undefined, { Cookie: ck, 'X-Test-Time': String(DAY1) });
  ok(r.status === 200 && /Remote/.test(r.body) && /Visitors per day/.test(r.body), 'the remote site report loads through its key');
  ok(!r.body.includes(KEY) && !r.body.includes(sha('sv|' + CODE)), 'the page never shows the key or the code hash');
  const sess = fs.readFileSync(path.join(PRIV, 'data', 'sessions.json'), 'utf8'); ok(!sess.includes(ck.slice(5)), 'sessions file keeps only a hash of the token');
  const modes = dataFiles().filter(([f]) => !f.endsWith('.lock')).map(([f]) => f);
  if (process.platform !== 'win32') ok(modes.every(f => (fs.statSync(path.join(PRIV, 'data', f)).mode & 0o077) === 0), 'data files are 0600');
} finally { srv.kill(); srv2.kill(); }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
