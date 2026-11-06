#!/usr/bin/env node
/* Post calendar tests (2026-10-31). Nothing reaches Meta: a stand-in for graph.facebook.com runs in this process and records every call;
 * failure emails go to a file (TRAV_MAIL_MOCK). A throwaway site folder is built in the system temp folder with the same layout as the server
 * (public_html/<path>/ + post-calendar-tools/ + post-calendar-data/), served by php -S.
 *   node traverse/post-calendar/test/pc-test.mjs */
import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = resolve(HERE, '..');
let pass = 0, failN = 0; const fails = [];
const ok = (c, m) => { if (c) { pass++; } else { failN++; fails.push(m); console.log('  FAIL ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- a PNG of any size (solid colour), for uploads ---- */
function png(w, h) {
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; ih[10] = 0; ih[11] = 0; ih[12] = 0;
  const row = Buffer.alloc(1 + w * 3); for (let i = 0; i < w; i++) { row[1 + i * 3] = 47; row[2 + i * 3] = 93; row[3 + i * 3] = 44; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* ---- the Graph API stand-in ---- */
const PAGES = [
  { name: 'Sixfold 365', id: '1418675127985724', access_token: 'PT-SIX', instagram_business_account: { id: '17841460337871226', username: '365aeration' } },
  { name: 'Surge Inc', id: '1323606360836132', access_token: 'PT-SURGE' },
  { name: 'Peak Pickleball', id: '555000', access_token: 'PT-PEAK', instagram_business_account: { id: '777000', username: 'peakpb' } },
];
const OWN = { 'OWN-VAA': { id: '888000', name: 'VAA Page', instagram_business_account: { id: '999000', username: 'vaa' } } };
let calls = [], failOn = {}, seq = 0; const reels = {};   /* reels: video id -> the address Meta was handed (Facebook Reels, 2026-11-05) */
const tokenPage = (t) => PAGES.find((p) => p.access_token === t) || (OWN[t] ? { ...OWN[t], access_token: t } : null);
const graph = http.createServer((req, res) => {
  const parts = []; req.on('data', (d) => parts.push(d)); req.on('end', () => {
    const raw = Buffer.concat(parts); const b = raw.toString('utf8');
    const u = new URL(req.url, 'http://x'); const path = u.pathname.replace(/^\/+/, '');
    const isRup = /^rup\//.test(path);
    const q = Object.fromEntries(req.method === 'POST' && !isRup ? new URLSearchParams(b) : u.searchParams);
    calls.push({ m: req.method, path, q, h: req.headers, body: isRup ? raw : null });
    const send = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    const err = (m) => send({ error: { message: m + ' (token ' + q.access_token + ')', type: 'OAuthException' } });
    const tp = tokenPage(q.access_token);
    if (path === 'me/accounts') return q.access_token === 'PIPE-TOKEN' ? send({ data: PAGES }) : err('bad system token');
    if (path === 'me') return OWN[q.access_token] ? send(OWN[q.access_token]) : err('bad page token');
    let m;
    if ((m = /^(\d+)\/photos$/.exec(path)) && req.method === 'POST') { if (!tp || tp.id !== m[1]) return err('token is not this page\'s'); if (failOn.fbphoto) return err('fb photo refused'); const id = 'ph' + ++seq; return send({ id, post_id: m[1] + '_' + id }); }
    if ((m = /^(\d+)\/albums$/.exec(path)) && req.method === 'POST') { if (!tp || tp.id !== m[1]) return err('token is not this page\'s'); return send({ id: 'alb' + ++seq }); }
    if ((m = /^(alb\d+)\/photos$/.exec(path)) && req.method === 'POST') { if (failOn.albumphoto && /bad/.test(q.caption || '')) return err('album photo refused'); return send({ id: 'ap' + ++seq }); }
    if ((m = /^(\d+)\/media$/.exec(path)) && req.method === 'POST') { if (!tp || (tp.instagram_business_account || {}).id !== m[1]) return err('token is not linked to this instagram'); if (failOn.igmedia) return err('ig media refused'); return send({ id: 'c' + ++seq }); }
    if ((m = /^(\d+)\/media_publish$/.exec(path)) && req.method === 'POST') { if (!tp || (tp.instagram_business_account || {}).id !== m[1]) return err('token is not linked to this instagram'); return send({ id: 'm' + ++seq }); }
    if ((m = /^(\d+)\/video_reels$/.exec(path)) && req.method === 'POST') {   /* Facebook Reels (2026-11-05): start, then finish once the video was handed over */
      if (!tp || tp.id !== m[1]) return err('token is not this page\'s');
      if (q.upload_phase === 'start') { const id = 'rv' + ++seq; return send({ video_id: id, upload_url: 'https://rupload.test/' + id }); }
      if (q.upload_phase === 'finish') return reels[q.video_id] ? send({ success: true }) : err('nothing uploaded for ' + q.video_id);
      return err('bad phase');
    }
    if ((m = /^rup\/(rv\d+)$/.exec(path)) && req.method === 'POST') { if (!tokenPage(String(req.headers.authorization || '').replace(/^OAuth /, ''))) return err('bad upload token'); if (failOn.rupload) return send({ debug_info: { type: 'FileUrlProcessingError', message: 'test refusal' } });
      if (raw.length) { if (String(req.headers.offset) !== '0' || Number(req.headers.file_size) !== raw.length) return send({ debug_info: { type: 'BadUpload', message: 'offset/file_size do not match the body' } }); reels[m[1]] = 'bytes:' + raw.length; return send({ success: true }); }
      if (!req.headers.file_url) return err('no file_url'); reels[m[1]] = req.headers.file_url; return send({ success: true }); }
    if (/^rv\d+$/.test(path)) return send({ permalink_url: '/reel/' + path });
    if (/^c\d+$/.test(path)) return send({ status_code: 'FINISHED', id: path });
    if (/^m\d+$/.test(path)) return send({ permalink: 'https://ig.test/p/' + path });
    if (/^alb\d+$/.test(path)) return send({ link: 'https://fb.test/album/' + path });
    if (/_ph\d+$/.test(path)) return send({ permalink_url: 'https://fb.test/' + path });
    return err('stand-in has no answer for ' + req.method + ' ' + path);
  });
});
await new Promise((r) => graph.listen(0, '127.0.0.1', r)); const GPORT = graph.address().port;

/* ---- the throwaway site ---- */
const T = mkdtempSync(join(tmpdir(), 'pctest-')); const SITE = join(T, 'site'); const PUB = 'posts-test';
mkdirSync(join(SITE, 'public_html', PUB, 'media'), { recursive: true });
cpSync(join(ROOT, 'app', 'api'), join(SITE, 'public_html', PUB, 'api'), { recursive: true });
cpSync(join(ROOT, 'app', 'index.html'), join(SITE, 'public_html', PUB, 'index.html'));
cpSync(join(ROOT, 'server'), join(SITE, 'post-calendar-tools'), { recursive: true });
mkdirSync(join(SITE, 'post-calendar-data', 'private'), { recursive: true });
writeFileSync(join(SITE, 'post-calendar-data', 'private', 'meta-token.json'), JSON.stringify({ system_token: 'PIPE-TOKEN' }));
const MAIL = join(T, 'mail.jsonl');
const port = 18000 + Math.floor(Math.random() * 2000);
const ORIGIN = 'http://127.0.0.1:' + port;
const env = { ...process.env, PC_SITE: SITE, PC_PUBLIC: PUB, PC_ORIGIN: ORIGIN, PC_GRAPH: 'http://127.0.0.1:' + GPORT + '/', PC_POLL_SLEEP: '0', TRAV_MAIL_MOCK: MAIL, PC_RUPLOAD: 'http://127.0.0.1:' + GPORT + '/rup/' };
const php = spawn('php', ['-S', '127.0.0.1:' + port, '-t', join(SITE, 'public_html')], { env, stdio: 'ignore' });
const runPhp = (args, extra = {}) => new Promise((r) => execFile('php', [join(SITE, 'post-calendar-tools', 'runner.php'), ...args], { env: { ...env, ...extra } }, (e, so, se) => r({ code: e ? e.code : 0, out: so, err: se })));
const runner = (nowIso) => runPhp([], { PC_NOW: String(Math.floor(Date.parse(nowIso) / 1000)) });
for (let i = 0; i < 50; i++) { try { await fetch(ORIGIN + '/'); break; } catch { await sleep(100); } }

const ADMIN = (await runPhp(['addaccount', 'Matthew Sharpe', 'admin', '--code-only'])).out.trim();
const EDITOR = (await runPhp(['addaccount', 'Claude drafts', 'editor', '--code-only'])).out.trim();
ok(/^\d{8}$/.test(ADMIN) && /^\d{8}$/.test(EDITOR), 'addaccount --code-only prints only an 8-digit code');

function client() {
  let cookie = '';
  const call = async (action, body, query = '') => {
    const o = { method: body ? 'POST' : 'GET', headers: { Cookie: cookie } };
    if (body instanceof FormData) { o.body = body; o.headers['X-PC'] = '1'; } else if (body) { o.body = JSON.stringify(body); o.headers['Content-Type'] = 'application/json'; o.headers['X-PC'] = '1'; }
    const r = await fetch(ORIGIN + '/' + PUB + '/api/cal.php?action=' + action + query, o);
    const sc = r.headers.get('set-cookie'); if (sc && /postcal=/.test(sc)) cookie = sc.split(';')[0];
    const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = { ok: false, error: 'not JSON', raw: txt.slice(0, 600) }; console.log('  (raw answer to ' + action + '): ' + txt.slice(0, 600)); }
    j._status = r.status; j._headers = r.headers; return j;
  };
  const up = (id, buf, extra = {}) => { const fd = new FormData(); fd.append('id', id); for (const [k, v] of Object.entries(extra)) fd.append(k, String(v)); fd.append('file', new Blob([buf], { type: 'image/png' }), 'pic.png'); return call('upload', fd); };
  return { call, up };
}
const A = client(), E = client(), X = client();
const state = () => JSON.parse(readFileSync(join(SITE, 'post-calendar-data', 'state.json'), 'utf8'));
const ts = (iso) => Math.floor(Date.parse(iso) / 1000);
const IMG = png(1080, 1350);

console.log('sign-in');
ok((await X.call('data'))._status === 401, 'signed out: data refused');
ok((await X.call('signin', { code: '12345678' }))._status === 401, 'wrong code refused');
const noHdr = await fetch(ORIGIN + '/' + PUB + '/api/cal.php?action=signin', { method: 'POST', body: JSON.stringify({ code: ADMIN }), headers: { 'Content-Type': 'application/json' } });
ok(noHdr.status === 400, 'a POST without the X-PC header is refused');
ok((await A.call('signin', { code: ADMIN })).role === 'admin', 'admin signs in');
ok((await E.call('signin', { code: EDITOR })).role === 'editor', 'editor signs in');
const d0 = await A.call('data', null, '&client=sixfold');
ok(d0._headers.get('x-frame-options') === 'SAMEORIGIN' && /frame-ancestors 'self'/.test(d0._headers.get('content-security-policy') || ''), 'framing: same-site only (the Traverse hub)');
ok(d0.clients.length === 2 && d0.posts.length === 0, 'two seeded clients, no posts');
ok(!JSON.stringify(d0).includes('PIPE-TOKEN') && !JSON.stringify(d0).includes('PT-SIX'), 'no token in the page data');

console.log('slots and the 1 Nov clock change');
let s = await A.call('slots', null, '&client=sixfold&n=5&from=' + ts('2026-10-28T12:00:00Z'));
ok(s.slots[0].at === ts('2026-10-29T21:00:00Z'), 'Thu 29 Oct 2026 3 pm MDT = 21:00 UTC');
ok(s.slots[1].at === ts('2026-10-31T20:00:00Z') && s.slots[1].type === 'photoset', 'Sat 31 Oct 2 pm MDT photo set slot = 20:00 UTC');
ok(s.slots[2].at === ts('2026-11-03T22:00:00Z'), 'Tue 3 Nov 2026 3 pm MST = 22:00 UTC (after the switch)');
ok(s.slots[4].at === ts('2026-11-07T21:00:00Z'), 'Sat 7 Nov 2 pm MST = 21:00 UTC');
s = await A.call('slots', null, '&client=surge&n=3&from=' + ts('2026-10-28T12:00:00Z'));
ok(s.slots.map((x) => x.at).join() === [ts('2026-10-29T21:00:00Z'), ts('2026-11-03T22:00:00Z'), ts('2026-11-05T22:00:00Z')].join(), 'Surge: Tue/Thu 3 pm only, no Saturday');

console.log('drafts, approve, unapprove, edits drop approval');
let c = await E.call('create', { client: 'sixfold', type: 'single', targets: ['fb', 'ig'], fb: 'FB words', ig: 'IG words', date: '2027-11-09', time: '15:00' });
const P1 = c.id; ok(!!P1, 'editor makes a draft');
let st = state().posts[P1]; ok(st.at === ts('2027-11-09T22:00:00Z'), 'Tue 9 Nov 2027 3 pm = 22:00 UTC (MST)');
let r = await A.call('approve', { id: P1 }); ok(r._status === 409 && /picture/i.test(r.error), 'approve refused without a picture');
r = await E.up(P1, IMG); ok(r.ok && r.post.images.length === 1 && r.post.images[0].w === 1080, 'picture uploaded and measured');
ok(existsSync(join(SITE, 'public_html', PUB, 'media', r.post.images[0].file)) && r.post.images[0].url.startsWith(ORIGIN + '/' + PUB + '/media/'), 'picture stored under media/ at a public address');
ok((await fetch(r.post.images[0].url)).status === 200, 'picture fetchable at that address');
r = await E.call('approve', { id: P1 }); ok(r._status === 403, 'editor cannot approve');
r = await A.call('approve', { id: P1, fingerprint: 'stale' }); ok(r._status === 409, 'approve refused when the screen was stale');
const fp = (await A.call('data', null, '&client=sixfold')).posts.find((p) => p.id === P1).fingerprint;
r = await A.call('approve', { id: P1, fingerprint: fp }); ok(r.ok && r.post.status === 'approved' && r.post.approval.by === 'Matthew Sharpe' && r.post.approval.at > 0, 'admin approves: who and when recorded');
r = await E.call('edit', { id: P1, fb: 'FB words changed' }); ok(r.ok && r.post.status === 'draft' && r.post.approval === null, 'an edit after approval drops it back to draft');
r = await A.call('approve', { id: P1 }); ok(r.ok && r.post.status === 'approved', 'approved again');
r = await A.call('edit', { id: P1, date: '2027-11-11', time: '15:00' }); ok(r.post.status === 'draft', 'moving the time drops the approval');
await A.call('approve', { id: P1 });
r = await E.up(P1, png(1080, 1080)); ok(r.post.status === 'draft', 'a new picture drops the approval');
await A.call('approve', { id: P1 });
r = await A.call('edit', { id: P1, note: 'just a note' }); ok(r.post.status === 'approved', 'a note alone does not drop it (never posted)');
r = await A.call('unapprove', { id: P1 }); ok(r.post.status === 'draft', 'unapprove');
r = await A.call('approve', { id: 'nope' }); ok(r._status === 404, 'approve takes one known post id (no bulk)');

console.log('change requests');
r = await E.call('request', { id: P1, text: 'x' }); ok(r._status === 403, 'only Matthew requests changes');
r = await A.call('request', { id: P1, text: 'Crop tighter and drop the second sentence.' }); ok(r.post.status === 'changes' && r.post.openRequest.text.startsWith('Crop'), 'request: status changes requested');
r = await A.call('approve', { id: P1 }); ok(r._status === 409, 'cannot approve with a request open');
const rq = JSON.parse((await runPhp(['requests'])).out); ok(rq.length === 1 && rq[0].post === P1 && rq[0].text.startsWith('Crop') && !JSON.stringify(rq).match(/\d{8}"/), 'runner requests: JSON, no codes');
r = await E.call('requests'); ok(r.requests.length === 1, 'requests readable by the editor sign-in');
r = await E.call('edit', { id: P1, fb: 'FB words, second sentence gone' }); ok(r.post.status === 'changes', 'an edit without answer keeps the request open');
r = await E.up(P1, IMG, { answer: 'true' }); ok(r.post.status === 'draft' && !r.post.openRequest && r.post.requests[0].answered.by === 'Claude drafts', 'answer with a new picture: back to draft, request answered');
ok(JSON.parse((await runPhp(['requests'])).out).length === 0, 'no open requests left');
await A.call('request', { id: P1, text: 'never mind test' }); r = await A.call('withdraw', { id: P1 }); ok(r.post.status === 'draft' && r.post.requests[1].answered.how === 'closed', 'Matthew can close his own request');

console.log('the runner');
await A.call('edit', { id: P1, date: '2027-11-09', time: '15:00' }); await A.call('approve', { id: P1 });
// B: draft due (never sent); C: approved, later; D: Surge approved FB only; F: changes requested; G: photo set
const mk = async (cl, extra, imgs = 1) => { const j = await E.call('create', { client: cl, ...extra }); for (let i = 0; i < imgs; i++) await E.up(j.id, IMG, extra.type === 'photoset' ? { caption: 'photo ' + (i + 1) } : {}); return j.id; };
const PB = await mk('sixfold', { fb: 'b', ig: 'b', targets: ['fb', 'ig'], date: '2027-11-09', time: '14:00' });
const PC = await mk('sixfold', { fb: 'c', ig: 'c', targets: ['fb', 'ig'], date: '2027-11-11', time: '15:00' }); await A.call('approve', { id: PC });
const PD = await mk('surge', { fb: 'Surge words', ig: '', targets: ['fb'], date: '2027-11-09', time: '15:00' }); r = await A.call('approve', { id: PD }); ok(r.ok, 'Surge post approved (Facebook only)');
r = await A.call('edit', { id: PD, targets: ['fb', 'ig'], ig: 'x' }); ok(r.post.problems.some((x) => /No Instagram account is assigned to Surge/.test(x)), 'Surge has no Instagram: approve blocked if Instagram is ticked');
await A.call('edit', { id: PD, targets: ['fb'], ig: '' }); await A.call('approve', { id: PD });
const PF = await mk('sixfold', { fb: 'f', ig: 'f', targets: ['fb', 'ig'], date: '2027-11-09', time: '13:00' }); await A.call('request', { id: PF, text: 'redo' });
const PG = await mk('sixfold', { type: 'photoset', album: 'Saturday jobs', fb: 'Album words', ig: 'Carousel words', targets: ['fb', 'ig'], date: '2027-11-13', time: '14:00' }, 3);
r = await A.call('approve', { id: PG }); ok(r.ok, 'photo set approved');
calls = [];
await runner('2027-11-09T21:59:00Z');   /* 2:59 pm MST: an MDT mistake would have sent the 3 pm posts an hour early */
ok(calls.filter((x) => x.m === 'POST').length === 0, 'nothing sent at 2:59 pm MST (time zone right after the switch)');
calls = [];
await runner('2027-11-09T22:01:00Z');
let S1 = state().posts;
ok(S1[P1].status === 'published' && S1[P1].done.fb.link.startsWith('https://fb.test/') && S1[P1].done.ig.link === 'https://ig.test/p/' + S1[P1].done.ig.id, 'approved due Sixfold post published to Facebook and Instagram, links kept');
ok(S1[PD].status === 'published' && S1[PD].done.fb && !S1[PD].done.ig, 'approved due Surge post published to Facebook only');
ok(S1[PB].status === 'draft' && S1[PF].status === 'changes' && S1[PC].status === 'approved' && S1[PG].status === 'approved', 'draft, change-requested and later posts untouched');
const posts = calls.filter((x) => x.m === 'POST');
ok(posts.filter((x) => x.path === '1418675127985724/photos').length === 1 && posts.find((x) => x.path === '1418675127985724/photos').q.access_token === 'PT-SIX', 'Sixfold post went to the Sixfold 365 Page with its Page token');
ok(posts.filter((x) => x.path === '1323606360836132/photos').length === 1 && posts.find((x) => x.path === '1323606360836132/photos').q.access_token === 'PT-SURGE', 'Surge post went to the Surge Inc Page with its own token');
ok(posts.find((x) => x.path === '1323606360836132/photos').q.caption === 'Surge words' && posts.find((x) => x.path === '1418675127985724/photos').q.caption === 'FB words, second sentence gone', 'each Page got its own caption (no blending)');
ok(posts.filter((x) => x.path === '17841460337871226/media').length === 1 && posts.filter((x) => x.path === '17841460337871226/media_publish').length === 1, 'Instagram: one /media and one /media_publish on @365aeration');
ok(!posts.some((x) => x.path.startsWith('555000')), 'nothing went to a Page no client... was due on (Peak)');
ok(posts.find((x) => x.path === '1418675127985724/photos').q.url === S1[P1].images[0].url, 'Facebook fetched the picture from its stored address');
calls = [];
await runner('2027-11-09T22:06:00Z'); await runner('2027-11-09T22:30:00Z');
ok(calls.filter((x) => x.m === 'POST').length === 0, 'run again: nothing sent twice');
r = await A.call('edit', { id: P1, fb: 'too late' }); ok(r._status === 409, 'a published post cannot be edited');
r = await A.call('request', { id: P1, text: 'x' }); ok(r._status === 409, 'no change request on a published post');

console.log('two runners at once');
const PH = await mk('sixfold', { fb: 'h', ig: 'h', targets: ['fb', 'ig'], date: '2027-11-10', time: '15:00' }); await A.call('approve', { id: PH });
calls = [];
await Promise.all([runner('2027-11-10T22:01:00Z'), runner('2027-11-10T22:01:00Z'), runner('2027-11-10T22:01:00Z')]);
ok(calls.filter((x) => x.m === 'POST' && x.path === '1418675127985724/photos').length === 1 && state().posts[PH].status === 'published', 'three runners started together: posted once');

console.log('photo set');
calls = [];
await runner('2027-11-13T21:01:00Z');
S1 = state().posts; const pp = calls.filter((x) => x.m === 'POST');
ok(S1[PG].status === 'published', 'photo set published');
ok(pp.filter((x) => x.path === '1418675127985724/albums').length === 1 && pp.find((x) => x.path === '1418675127985724/albums').q.name === 'Saturday jobs' && pp.filter((x) => /^alb\d+\/photos$/.test(x.path)).length === 3, 'Facebook: one album, three photos');
ok(pp.filter((x) => /^alb\d+\/photos$/.test(x.path)).map((x) => x.q.caption).join() === 'photo 1,photo 2,photo 3', 'per-photo captions in order');
const kids = pp.filter((x) => x.path === '17841460337871226/media' && x.q.is_carousel_item === 'true');
const car = pp.find((x) => x.path === '17841460337871226/media' && x.q.media_type === 'CAROUSEL');
ok(kids.length === 3 && car && car.q.children.split(',').length === 3 && car.q.caption === 'Carousel words', 'Instagram: carousel of three with the caption');
const PS1 = await mk('sixfold', { type: 'photoset', album: 'x', fb: 'x', ig: 'x', targets: ['fb', 'ig'], date: '2027-11-20', time: '14:00' }, 1);
r = await A.call('approve', { id: PS1 }); ok(r._status === 409 && /at least 2/.test(r.error), 'a photo set needs 2+ pictures');

console.log('failure path');
const PJ = await mk('sixfold', { fb: 'j', ig: 'j', targets: ['fb', 'ig'], date: '2027-11-16', time: '15:00' }); await A.call('approve', { id: PJ });
failOn = { igmedia: true }; calls = [];
await runner('2027-11-16T22:01:00Z');
let pj = state().posts[PJ];
ok(pj.status === 'failed' && pj.done.fb && !pj.done.ig && /ig media refused/.test(pj.error), 'Instagram refused: failed, Facebook kept as done, error kept');
ok(!pj.error.includes('PT-SIX') && pj.error.includes('[token]'), 'the error has the token scrubbed');
/* (post C, approved for 11 Nov and never run on that day, is correctly marked missed by this run and gets its own email) */
ok(state().posts[PC].status === 'failed' && /Missed/.test(state().posts[PC].error), 'an approved post the runner first sees 5 days late is missed, not sent');
const mailsFor = (first) => (existsSync(MAIL) ? readFileSync(MAIL, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []).filter((m) => m.body.includes('First line: ' + first + '\n'));
let mails = mailsFor('j');
ok(mails.length === 1 && mails[0].to === 'm.sharpe@traverseplatforms.com' && /Sixfold 365 post failed/.test(mails[0].subject) && !mails[0].body.includes('PT-SIX'), 'one email to Matthew, no token in it');
calls = []; await runner('2027-11-16T22:10:00Z'); await runner('2027-11-16T22:20:00Z');
mails = mailsFor('j');
ok(calls.filter((x) => x.m === 'POST').length === 0 && mails.length === 1, 'a failed post is never retried by itself, no second email');
r = await A.call('approve', { id: PJ }); ok(r._status === 409, 'a failed post cannot be approved straight away');
r = await A.call('todraft', { id: PJ }); ok(r.post.status === 'draft', 'Back to draft');
failOn = {}; await A.call('edit', { id: PJ, date: '2027-11-18', time: '15:00' }); await A.call('approve', { id: PJ }); calls = [];
await runner('2027-11-18T22:01:00Z'); pj = state().posts[PJ];
ok(pj.status === 'published' && calls.filter((x) => x.path.endsWith('/photos')).length === 0 && calls.filter((x) => x.path === '17841460337871226/media_publish').length === 1, 'after re-approval only Instagram went (Facebook not posted twice)');

console.log('missed, tampered, stuck, wrong Page');
const PK = await mk('sixfold', { fb: 'k', ig: 'k', targets: ['fb'], date: '2027-11-23', time: '15:00' }); await A.call('approve', { id: PK });
calls = []; await runner('2027-11-24T06:00:00Z');
ok(state().posts[PK].status === 'failed' && /Missed/.test(state().posts[PK].error) && calls.filter((x) => x.m === 'POST').length === 0, 'over 6 hours late: not posted, marked missed');
const PL = await mk('sixfold', { fb: 'l', ig: 'l', targets: ['fb'], date: '2027-11-25', time: '15:00' }); await A.call('approve', { id: PL });
let raw = state(); raw.posts[PL].fb = 'sneaked in after approval'; writeFileSync(join(SITE, 'post-calendar-data', 'state.json'), JSON.stringify(raw));
calls = []; await runner('2027-11-25T22:01:00Z');
ok(state().posts[PL].status === 'draft' && calls.filter((x) => x.m === 'POST').length === 0, 'changed behind the page after approval: not sent, back to draft');
const PM = await mk('sixfold', { fb: 'm', ig: 'm', targets: ['fb'], date: '2027-11-30', time: '15:00' }); await A.call('approve', { id: PM });
raw = state(); raw.posts[PM].status = 'publishing'; raw.posts[PM].claimed = ts('2027-11-30T22:00:00Z'); writeFileSync(join(SITE, 'post-calendar-data', 'state.json'), JSON.stringify(raw));
calls = []; await runner('2027-11-30T22:45:00Z');
ok(state().posts[PM].status === 'failed' && calls.filter((x) => x.m === 'POST').length === 0, 'left publishing by a dead runner: failed, never resent');
raw = state(); raw.clients.surge.page_id = '999999'; writeFileSync(join(SITE, 'post-calendar-data', 'state.json'), JSON.stringify(raw));
const PN = await mk('surge', { fb: 'n', targets: ['fb'], date: '2027-12-02', time: '15:00' }); await A.call('approve', { id: PN });
calls = []; await runner('2027-12-02T22:01:00Z');
ok(state().posts[PN].status === 'failed' && /not one the Meta token can post to/.test(state().posts[PN].error) && calls.filter((x) => x.m === 'POST').length === 0, 'a Page the token cannot reach: failed, nothing sent anywhere else');
raw = state(); raw.clients.surge.page_id = '1323606360836132'; writeFileSync(join(SITE, 'post-calendar-data', 'state.json'), JSON.stringify(raw));

console.log('clients');
r = await E.call('client', { name: 'Peak' }); ok(r._status === 403, 'editor cannot add clients');
r = await A.call('pages'); ok(r.ok && r.pages.length === 3 && r.pages.find((p) => p.page_id === '555000').client === null && r.pages.find((p) => p.page_id === '1418675127985724').client === 'sixfold' && !JSON.stringify(r).includes('PT-'), 'pages list: which are free, no tokens');
r = await A.call('client', { name: 'Peak Pickleball', color: '#0a7cff', conn: 'pipeline', page_id: '1418675127985724', slots: [] }); ok(r._status === 409 && /already assigned to Sixfold/.test(r.error), 'a Page already held by another client is refused');
r = await A.call('client', { name: 'Peak Pickleball', color: '#0a7cff', conn: 'pipeline', page_id: '555000', ig_id: '17841460337871226', slots: [] }); ok(r._status === 400, 'an Instagram account not linked to the Page is refused');
r = await A.call('client', { name: 'Peak Pickleball', color: '#0a7cff', conn: 'pipeline', page_id: '555000', ig_id: '777000', slots: [{ d: 3, t: '12:00', type: 'single' }], rules: 'Peak rules' });
ok(r.ok && r.client.id === 'peak-pickleball' && r.client.ig_user === 'peakpb', 'Peak added through the Pipeline token');
r = await A.call('client', { name: 'VAA', color: '#aa3300', conn: 'own', token: 'OWN-VAA', ig_id: 'linked', slots: [] });
ok(r.ok && r.client.page_id === '888000' && r.client.ig_id === '999000' && r.client.ownToken === true && !JSON.stringify(r).includes('OWN-VAA'), 'VAA added with its own Page token (stored, never sent back)');
ok(existsSync(join(SITE, 'post-calendar-data', 'private', 'client-vaa.json')), 'own token kept in the private folder');
const PV = await mk('vaa', { fb: 'vaa words', ig: 'vaa ig', targets: ['fb', 'ig'], date: '2027-12-01', time: '12:00' }); r = await A.call('approve', { id: PV }); ok(r.ok, 'VAA post approved');
const PP = await mk('peak-pickleball', { fb: 'peak words', ig: 'peak ig', targets: ['fb', 'ig'], date: '2027-12-01', time: '12:00' }); await A.call('approve', { id: PP });
calls = []; await runner('2027-12-01T19:01:00Z');
const pv = calls.filter((x) => x.m === 'POST');
ok(pv.find((x) => x.path === '888000/photos')?.q.access_token === 'OWN-VAA' && pv.find((x) => x.path === '999000/media_publish'), 'VAA posted with its own token to its own Page and Instagram');
ok(pv.find((x) => x.path === '555000/photos')?.q.caption === 'peak words' && pv.find((x) => x.path === '777000/media'), 'Peak posted to its own Page and Instagram');
let dv = await A.call('data', null, '&client=vaa'); ok(dv.posts.every((p) => p.client === 'vaa') && dv.posts.length === 1, 'one client at a time: VAA sees only VAA posts');
dv = await A.call('data'); ok(!dv.posts && dv.counts.sixfold && dv.counts.surge, 'all-clients view: counts only, no posts');
const PQ = await mk('peak-pickleball', { fb: 'q', targets: ['fb'], date: '2027-12-08', time: '12:00' }); await A.call('approve', { id: PQ });
r = await A.call('clientarchive', { id: 'peak-pickleball', archived: true }); ok(r.ok && state().posts[PQ].status === 'draft', 'archiving a client drops its approvals');
r = await A.call('create', { client: 'peak-pickleball', fb: 'x' }); ok(r._status === 409, 'no new posts for an archived client');

console.log('import (the laptop tool)');
const MD = join(T, 'manifest'); mkdirSync(MD); writeFileSync(join(MD, 'a.png'), IMG); writeFileSync(join(MD, 'b.png'), IMG); writeFileSync(join(MD, 'c.png'), IMG);
writeFileSync(join(T, 'editor-code.txt'), EDITOR + '\n');
writeFileSync(join(MD, 'manifest.json'), JSON.stringify([
  { brand: 'sixfold', date: '2027-12-14', time: '15:00', targets: ['fb', 'ig'], image: 'a.png', fb_caption: 'Imported FB', ig_caption: 'Imported IG', note: 'from a manifest' },
  { brand: 'surge', date: '2027-12-14', time: '15:00', targets: ['fb'], image: 'b.png', fb_caption: 'Surge imported', note: "NEEDS MATTHEW'S REVIEW" },
  { brand: 'sixfold', type: 'photoset', date: '2027-12-18', time: '14:00', targets: ['fb', 'ig'], images: [{ path: 'a.png', caption: 'one' }, 'b.png', 'c.png'], album: 'December jobs', fb_caption: 'Set', ig_caption: 'Set IG' },
  { client: 'vaa', targets: ['fb'], image: 'c.png', fb_caption: 'unscheduled one' },
  { brand: 'sixfold', image: 'missing.png', fb_caption: 'bad' },
]));
const tool = (args) => new Promise((res) => execFile('node', [join(ROOT, 'tools', 'pc.mjs'), ...args], { env: { ...process.env, PC_BASE: ORIGIN + '/' + PUB + '/api/cal.php', PC_CODE_FILE: join(T, 'editor-code.txt') } }, (e, so, se) => res({ code: e ? e.code : 0, out: so + se })));
let t1 = await tool(['import', join(MD, 'manifest.json')]);
ok(/4 loaded, 0 already there, 1 skipped/.test(t1.out), 'import: 4 loaded, the missing picture skipped');
ok(!t1.out.includes(EDITOR), 'the tool never prints the code');
const imp = Object.values(state().posts).filter((p) => p.src.startsWith('manifest:'));
ok(imp.length === 4 && imp.every((p) => p.status === 'draft' && p.approval === null), 'imported posts are unapproved drafts');
ok(imp.find((p) => p.client === 'surge').fb === 'Surge imported' && imp.find((p) => p.client === 'surge').targets.join() === 'fb', 'brand surge -> Surge client, Facebook only');
const ps = imp.find((p) => p.type === 'photoset'); ok(ps && ps.images.length === 3 && ps.images[0].caption === 'one' && ps.album === 'December jobs' && ps.at === ts('2027-12-18T21:00:00Z'), 'photo set imported with 3 pictures, caption, album, Saturday 2 pm MST');
ok(imp.find((p) => p.client === 'vaa').at === null, 'no date: not scheduled yet');
t1 = await tool(['import', join(MD, 'manifest.json')]); ok(/0 loaded, 4 already there/.test(t1.out), 'importing again adds nothing twice');
const sixSingle = imp.find((p) => p.client === 'sixfold' && p.type === 'single'); const oldFile = sixSingle.images[0].file;
writeFileSync(join(MD, 'a.png'), png(1080, 1080));   /* same name, new picture (the November rebuild) */
t1 = await tool(['import', join(MD, 'manifest.json'), '--refresh']);
ok(/0 loaded, 2 refreshed, 2 already there/.test(t1.out), '--refresh re-uploads only the changed picture (single + first photo of the set)');
const rs = state().posts[sixSingle.id], rp = state().posts[ps.id];
ok(rs.images[0].h === 1080 && rs.status === 'draft' && rs.approval === null && rp.images[0].h === 1080 && rp.images[0].caption === 'one' && rp.images[1].h === 1350, 'new pictures in place, caption kept, still unapproved');
ok(!existsSync(join(SITE, 'public_html', PUB, 'media', oldFile)), 'the replaced picture file is gone from the server');
t1 = await tool(['import', join(MD, 'manifest.json'), '--refresh']); ok(/0 refreshed, 4 already there/.test(t1.out), '--refresh again: nothing to do');
const surgeImp = imp.find((p) => p.client === 'surge');
await A.call('request', { id: surgeImp.id, text: 'Shorter please' });
t1 = await tool(['requests']); ok(JSON.parse(t1.out.slice(t1.out.indexOf('['))).some((x) => x.post === surgeImp.id), 'tool lists the open request');
writeFileSync(join(T, 'fb.txt'), 'Shorter.');
t1 = await tool(['answer', surgeImp.id, '--fb', join(T, 'fb.txt')]);
const sa = state().posts[surgeImp.id]; ok(sa.status === 'draft' && sa.fb === 'Shorter.' && sa.requests[0].answered, 'tool answers the request: new caption, back to draft');

console.log('old queue migration');
const OLDQ = join(SITE, 'sixfold-private'); mkdirSync(OLDQ, { recursive: true });
writeFileSync(join(OLDQ, 'social-queue.json'), JSON.stringify([
  { id: 's365-photos-test', at: ts('2027-12-04T21:00:00Z'), page: 'Sixfold 365', status: 'approved', approved: 'Matthew 27 Oct: schedule it for saturday at 2', fb: null, ig: { type: 'carousel', images: ['https://365.test/a.jpg', 'https://365.test/b.jpg'], caption: 'Old carousel' } },
  { id: 'old-posted', at: ts('2026-10-27T21:00:00Z'), page: 'Sixfold 365', status: 'posted', fb: { type: 'photo', image: 'https://365.test/c.png', caption: 'x' }, ig: { type: 'image', image: 'https://365.test/c.png', caption: 'y' }, result: { fb: 'https://fb.test/old', ig: 'https://ig.test/old', at: '2026-10-27T15:00:00-06:00' } },
]));
t1 = await runPhp(['migrate-queue', join(OLDQ, 'social-queue.json')]); ok(/brought over 2/.test(t1.out), 'old queue: 2 brought over');
const mg = Object.values(state().posts).filter((p) => p.legacy);
const mA = mg.find((p) => p.legacy === 's365-photos-test'), mB = mg.find((p) => p.legacy === 'old-posted');
ok(mA.status === 'approved' && mA.type === 'photoset' && mA.targets.join() === 'ig' && mA.approval.said.includes('Matthew 27 Oct') && mA.approval.hash, 'approved carousel kept as an approved photo set (approval record kept)');
ok(mB.status === 'published' && mB.done.fb.link === 'https://fb.test/old', 'posted item kept as published with its links');
t1 = await runPhp(['migrate-queue', join(OLDQ, 'social-queue.json')]); ok(/brought over 0/.test(t1.out), 'migrating again adds nothing');
calls = []; await runner('2027-12-04T21:01:00Z');
ok(state().posts[mA.id].status === 'approved' && calls.filter((x) => x.m === 'POST').length === 0, 'while the old queue file exists, the new runner leaves migrated posts to the old runner');
rmSync(join(OLDQ, 'social-queue.json'));
calls = []; await runner('2027-12-04T21:02:00Z');
ok(state().posts[mA.id].status === 'published' && calls.filter((x) => x.path === '17841460337871226/media' && x.q.media_type === 'CAROUSEL').length === 1, 'once the old file is retired, the new runner sends it, once');

console.log('video (2026-11-05)');
{
  const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(4000, 1)]);   /* an MP4 header is enough here: no ffprobe on the test machine, so the uploader's numbers stand */
  const upV = (id, extra = {}) => { const fd = new FormData(); fd.append('id', id); for (const [k, v] of Object.entries(extra)) fd.append(k, String(v)); fd.append('file', new Blob([MP4], { type: 'video/mp4' }), 'pov.mp4'); return E.call('upload', fd); };
  const v = await E.call('create', { client: 'sixfold', type: 'single', date: '2027-12-14', time: '15:00', targets: ['fb', 'ig'], fb: 'POV: a week of aerations.', ig: 'POV: a week of aerations. #LawnAeration' });
  let rv = await upV(v.id, { w: 1080, h: 1920, sec: 11 });
  ok(rv.ok && rv.post.images[0].kind === 'video' && /\.mp4$/.test(rv.post.images[0].file) && rv.post.images[0].h === 1920, 'a video uploads into a one-post item, kept as an .mp4 and marked as video');
  ok(rv.post.problems.length === 0, 'a tall 9:16 video passes the checks (the 4:5 limit is for pictures)');
  rv = await A.call('approve', { id: v.id }); ok(rv.ok && rv.post.status === 'approved', 'a video post is approved the same way, one tap by Matthew');
  calls = []; await runner('2027-12-14T22:01:00Z');
  const sv = state().posts[v.id];
  const fr = calls.filter((x) => x.path === '1418675127985724/video_reels'), up = calls.find((x) => /^rup\//.test(x.path)), igv = calls.find((x) => x.path === '17841460337871226/media');
  ok(sv.status === 'published' && fr.length === 2 && fr[0].q.upload_phase === 'start' && fr[1].q.upload_phase === 'finish' && fr[1].q.video_state === 'PUBLISHED' && fr[1].q.description === 'POV: a week of aerations.', 'Facebook gets it as a Reel: start, then publish with the caption');
  ok(up && !up.h.file_url && up.body && up.body.equals(MP4) && up.h.offset === '0' && up.h.file_size === String(MP4.length) && /^OAuth PT-SIX/.test(up.h.authorization || '') && up.path === 'rup/' + fr[1].q.video_id, 'the video\'s own bytes go to Meta\'s upload host (offset 0, file_size), with the Page token; no address to fetch (2026-11-06)');
  ok(!calls.some((x) => x.path === '1418675127985724/videos'), 'no plain Page video as well');
  ok(igv && igv.q.media_type === 'REELS' && igv.q.video_url === sv.images[0].url && igv.q.share_to_feed === 'true' && !igv.q.image_url, 'Instagram gets it as a Reel, shared to the feed');
  ok(sv.done.fb.link === 'https://www.facebook.com/reel/' + sv.done.fb.id, 'the Facebook link is made whole');
  calls = []; await runner('2027-12-14T22:06:00Z'); ok(calls.filter((x) => x.m === 'POST').length === 0, 'a published video is never sent again');
  const ps = await E.call('create', { client: 'sixfold', type: 'photoset', date: '2027-12-18', time: '14:00' });
  rv = await upV(ps.id, { w: 1080, h: 1920, sec: 11 }); ok(!rv.ok && /own post/.test(rv.error), 'a video cannot go into a photo set');
  const lg = await E.call('create', { client: 'sixfold', type: 'single', date: '2027-12-16', time: '15:00' });
  rv = await upV(lg.id, { w: 1080, h: 1920, sec: 120 }); ok(!rv.ok && /90 seconds/.test(rv.error), 'a video over 90 seconds is refused');
  /* 2026-11-06: if the server's copy of the video is gone, the address is handed over instead (the old way), so the post still has a chance */
  const fbk = await E.call('create', { client: 'sixfold', type: 'single', date: '2027-12-20', time: '15:00', targets: ['fb'], fb: 'Fallback video.' });
  rv = await upV(fbk.id, { w: 1080, h: 1920, sec: 11 }); const fk = rv.post.images[0];
  rv = await A.call('approve', { id: fbk.id }); ok(rv.ok, 'fallback video approved');
  rmSync(join(SITE, 'public_html', PUB, 'media', fk.file));
  calls = []; await runner('2027-12-20T22:01:00Z');
  const up2 = calls.find((x) => /^rup\//.test(x.path));
  ok(state().posts[fbk.id].status === 'published' && up2 && up2.h.file_url === fk.url && !(up2.body && up2.body.length), 'with the server copy missing, Meta is given the address instead');
  /* a refusal from the upload host keeps Meta's own words and fails only Facebook */
  const rf = await E.call('create', { client: 'sixfold', type: 'single', date: '2027-12-21', time: '15:00', targets: ['fb'], fb: 'Refused video.' });
  rv = await upV(rf.id, { w: 1080, h: 1920, sec: 11 }); rv = await A.call('approve', { id: rf.id });
  failOn.rupload = true; calls = []; await runner('2027-12-21T22:01:00Z'); failOn.rupload = false;
  const rfp = state().posts[rf.id];
  ok(rfp.status === 'failed' && /upload host said: test refusal \(FileUrlProcessingError\)/.test(JSON.stringify(rfp)), 'an upload-host refusal is kept in Meta\'s words and the post shows failed');
}

console.log('check (read-only)');
t1 = await runPhp(['check']);
ok(/Sixfold 365 \(1418675127985724\) Instagram @365aeration -> sixfold/.test(t1.out) && /Surge Inc \(1323606360836132\) no Instagram -> surge/.test(t1.out) && !/PT-|PIPE-TOKEN/.test(t1.out), 'check lists the Pages, which client holds each, no tokens');
calls = []; await runPhp(['check']); ok(calls.every((x) => x.m === 'GET'), 'check only reads');

php.kill(); graph.close();
try { rmSync(T, { recursive: true, force: true }); } catch {}
console.log(`\n${pass} passed, ${failN} failed`);
if (failN) { console.log(fails.map((f) => ' - ' + f).join('\n')); process.exitCode = 1; }
