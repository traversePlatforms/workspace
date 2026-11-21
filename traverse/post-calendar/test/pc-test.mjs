#!/usr/bin/env node
/* Post calendar tests (2026-10-31). Nothing reaches Meta: a stand-in for graph.facebook.com runs in this process and records every call;
 * failure emails go to a file (TRAV_MAIL_MOCK). A throwaway site folder is built in the system temp folder with the same layout as the server
 * (public_html/<path>/ + post-calendar-tools/ + post-calendar-data/), served by php -S.
 *   node traverse/post-calendar/test/pc-test.mjs */
import http from 'node:http';
import { spawn, execFile, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
const fs_rm = (f) => { try { rmSync(f); } catch {} };
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
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
    if ((m = /^(\d+)\/photos$/.exec(path)) && req.method === 'POST') { if (!tp || tp.id !== m[1]) return err('token is not this page\'s'); if (failOn.fbphoto) return err('fb photo refused'); if (q.published === 'false') { if (failOn.unpub && failOn.unpub === q.caption) return err('unpublished photo refused'); return send({ id: 'up' + ++seq }); } const id = 'ph' + ++seq; return send({ id, post_id: m[1] + '_' + id }); }
    if ((m = /^(\d+)\/feed$/.exec(path)) && req.method === 'POST') { if (!tp || tp.id !== m[1]) return err('token is not this page\'s'); if (failOn.fbfeed) return err('feed post refused');
      const att = Object.keys(q).filter((k) => /^attached_media\[\d+\]$/.test(k)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]).map((k) => JSON.parse(q[k]).media_fbid);
      if (!att.length || att.some((x) => !/^up\d+$/.test(x))) return err('attached_media must be unpublished photo ids'); const id = m[1] + '_fp' + ++seq; return send({ id }); }
    if ((m = /^(\d+)\/albums$/.exec(path)) && req.method === 'POST') return err('(#3) Application does not have the capability to make this API call.');   /* as Meta answered live, 16 Nov */
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
    if (/_fp\d+$/.test(path)) return send({ permalink_url: 'https://fb.test/' + path });
    if (/_ph\d+$/.test(path)) return send({ permalink_url: 'https://fb.test/' + path });
    return err('stand-in has no answer for ' + req.method + ' ' + path);
  });
});
await new Promise((r) => graph.listen(0, '127.0.0.1', r)); const GPORT = graph.address().port;

/* ---- the LinkedIn stand-in (2026-11-18): OAuth (www.linkedin.com/oauth/v2/), the versioned API (api.linkedin.com/rest/), v2/me, and
   the image upload host. Records every call; liFail switches refusals on. Its error messages echo the token, to prove they are scrubbed. ---- */
let licalls = [], liFail = {}, liSeq = 9000, liImg = 0; const liUp = {}; const LIVALID = new Set(['LI-AT-1', 'LI-AT-2']);
const lisrv = http.createServer((req, res) => {
  const parts = []; req.on('data', (d) => parts.push(d)); req.on('end', () => {
    const raw = Buffer.concat(parts); const u = new URL(req.url, 'http://x'); const path = u.pathname.replace(/^\/+/, '');
    const ct = String(req.headers['content-type'] || ''); let body = null; let q = Object.fromEntries(u.searchParams);
    if (/json/.test(ct)) { try { body = JSON.parse(raw.toString('utf8')); } catch {} } else if (/x-www-form-urlencoded/.test(ct)) q = { ...q, ...Object.fromEntries(new URLSearchParams(raw.toString('utf8'))) };
    licalls.push({ m: req.method, path, q, search: u.search, h: req.headers, body, raw });
    const send = (code, o, hdr = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...hdr }); res.end(o === null ? '' : JSON.stringify(o)); };
    const tok = String(req.headers.authorization || '').replace(/^Bearer /, '');
    let m;
    if (path === 'oauth/authorization') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<p>stand-in LinkedIn consent</p>'); }
    if (path === 'oauth/accessToken') {
      if (q.client_id !== 'LI-CLIENT' || q.client_secret !== 'LI-SECRET') return send(401, { error: 'invalid_client', error_description: 'bad client' });
      if (q.grant_type === 'authorization_code') {
        if (q.redirect_uri !== ORIGIN + '/' + PUB + '/api/linkedin-oauth.php') return send(400, { error: 'invalid_redirect_uri', error_description: 'redirect uri does not match' });
        if (q.code === 'GOOD') return send(200, { access_token: 'LI-AT-1', expires_in: 5184000, refresh_token: 'LI-RT-1', refresh_token_expires_in: 31536000, scope: 'r_basicprofile,r_organization_social,rw_organization_admin,w_organization_social' });
        if (q.code === 'NOPOST') return send(200, { access_token: 'LI-AT-X', expires_in: 5184000, scope: 'r_basicprofile' });
        return send(400, { error: 'invalid_request', error_description: 'Unable to retrieve access token: authorization code not found' });
      }
      if (q.grant_type === 'refresh_token') {
        if (liFail.refresh || q.refresh_token !== 'LI-RT-1') return send(400, { error: 'invalid_request', error_description: 'The provided authorization grant or refresh token is invalid, expired or revoked' });
        return send(200, { access_token: 'LI-AT-2', expires_in: 5184000, refresh_token: 'LI-RT-1', refresh_token_expires_in: 26000000 });
      }
      return send(400, { error: 'invalid_request', error_description: 'A required parameter "grant_type" is missing' });
    }
    if ((m = /^li-up\/(\d+)$/.exec(path)) && req.method === 'PUT') { if (!LIVALID.has(tok)) return send(401, { message: 'upload refused' }); liUp['urn:li:image:IMG' + m[1]] = raw; return send(201, null); }
    if (!LIVALID.has(tok)) return send(401, { message: 'Invalid access token ' + tok, status: 401, serviceErrorCode: 65600 });
    if (path.startsWith('rest/') && (req.headers['linkedin-version'] !== '202611' || req.headers['x-restli-protocol-version'] !== '2.0.0')) return send(426, { message: 'version headers missing', status: 426 });
    if (path === 'v2/me') return send(200, { id: 'abc', localizedFirstName: 'Matt', localizedLastName: 'Sharpe' });
    if (path === 'rest/organizationAcls' && q.q === 'roleAssignee') return send(200, { elements: [{ organization: 'urn:li:organization:111', role: 'ADMINISTRATOR', state: 'APPROVED', roleAssignee: 'urn:li:person:abc' }, { organizationTarget: 'urn:li:organization:222', role: 'ANALYST', state: 'APPROVED', roleAssignee: 'urn:li:person:abc' }], paging: { count: 10, start: 0 } });
    if ((m = /^rest\/organizations\/(\d+)$/.exec(path))) return send(200, { id: +m[1], localizedName: m[1] === '111' ? 'Surge Inc' : 'Other Co' });
    if (path === 'rest/images' && q.action === 'initializeUpload' && req.method === 'POST') { const n = ++liImg; if (!body || body.initializeUploadRequest?.owner !== 'urn:li:organization:111') return send(403, { message: 'not the owner' }); return send(200, { value: { uploadUrl: LIBASE + 'li-up/' + n, image: 'urn:li:image:IMG' + n, uploadUrlExpiresAt: 1 } }); }
    if ((m = /^rest\/images\/(.+)$/.exec(path)) && req.method === 'GET') { const urn = decodeURIComponent(m[1]); return send(200, { id: urn, status: liUp[urn] ? 'AVAILABLE' : 'WAITING_UPLOAD' }); }
    if (path === 'rest/posts' && req.method === 'POST') {
      if (liFail.post) return send(422, { message: 'post refused (token ' + tok + ')', status: 422 });
      const b = body || {}; if (b.author !== 'urn:li:organization:111' || !b.distribution || b.lifecycleState !== 'PUBLISHED' || b.visibility !== 'PUBLIC') return send(400, { message: 'MISSING_FIELD', status: 400 });
      const ids = b.content?.media ? [b.content.media.id] : (b.content?.multiImage?.images || []).map((x) => x.id);
      if (ids.some((i) => !liUp[i])) return send(400, { message: 'image not uploaded', status: 400 });
      return send(201, null, { 'x-restli-id': 'urn:li:share:' + ++liSeq });
    }
    if ((m = /^rest\/socialActions\/([^/]+)\/comments$/.exec(path)) && req.method === 'POST') { if (liFail.comment) return send(403, { message: 'comment refused (token ' + tok + ')', status: 403 }); const id = String(++liSeq); return send(201, { id, object: body && body.object }, { 'x-restli-id': id }); }
    if (path === 'rest/organizationalEntityShareStatistics') {
      const sh = (/shares=List\(([^)]*)\)/.exec(u.search) || [])[1] || ''; const urns = sh.split(',').filter(Boolean).map(decodeURIComponent);
      return send(200, { elements: urns.filter((x) => x !== liFail.noStatsFor).map((x) => ({ organizationalEntity: 'urn:li:organization:111', share: x, totalShareStatistics: { likeCount: 7, commentCount: 2, shareCount: 1, impressionCount: 300, uniqueImpressionsCount: 250, clickCount: 9, engagement: 0.06 } })), paging: { count: 10, start: 0 } });
    }
    return send(404, { message: 'stand-in has no answer for ' + req.method + ' ' + path });
  });
});
await new Promise((r) => lisrv.listen(0, '127.0.0.1', r)); const LIBASE = 'http://127.0.0.1:' + lisrv.address().port + '/';

/* ---- the throwaway site ---- */
const T = mkdtempSync(join(tmpdir(), 'pctest-')); const SITE = join(T, 'site'); const PUB = 'posts-test';
mkdirSync(join(SITE, 'public_html', PUB, 'media'), { recursive: true });
cpSync(join(ROOT, 'app', 'api'), join(SITE, 'public_html', PUB, 'api'), { recursive: true });
cpSync(join(ROOT, 'app', 'index.html'), join(SITE, 'public_html', PUB, 'index.html'));
cpSync(join(ROOT, 'server'), join(SITE, 'post-calendar-tools'), { recursive: true });
/* J.A.R.V.I.S. (2026-11-21): the chat code beside lib.php and the watcher's tool in jv-tools/, as deploy.sh puts them */
cpSync(join(ROOT, '..', '..', 'shared', 'jv-chat', 'jv-lib.php'), join(SITE, 'post-calendar-tools', 'jv-lib.php'));
mkdirSync(join(SITE, 'jv-tools')); cpSync(join(ROOT, '..', '..', 'shared', 'jv-chat', 'jv.php'), join(SITE, 'jv-tools', 'jv.php'));
mkdirSync(join(SITE, 'post-calendar-data', 'private'), { recursive: true });
writeFileSync(join(SITE, 'post-calendar-data', 'private', 'meta-token.json'), JSON.stringify({ system_token: 'PIPE-TOKEN' }));
const MAIL = join(T, 'mail.jsonl');
const port = 18000 + Math.floor(Math.random() * 2000);
const ORIGIN = 'http://127.0.0.1:' + port;
const env = { ...process.env, PC_SITE: SITE, PC_PUBLIC: PUB, PC_ORIGIN: ORIGIN, PC_GRAPH: 'http://127.0.0.1:' + GPORT + '/', PC_POLL_SLEEP: '0', TRAV_MAIL_MOCK: MAIL, PC_RUPLOAD: 'http://127.0.0.1:' + GPORT + '/rup/', PC_LI_API: LIBASE + 'rest/', PC_LI_OAUTH: LIBASE + 'oauth/' };
const php = spawn('php', ['-d', 'upload_max_filesize=2M', '-d', 'post_max_size=8M', '-S', '127.0.0.1:' + port, '-t', join(SITE, 'public_html')], { env, stdio: 'ignore' });
const runPhp = (args, extra = {}) => new Promise((r) => execFile('php', [join(SITE, 'post-calendar-tools', 'runner.php'), ...args], { env: { ...env, ...extra } }, (e, so, se) => r({ code: e ? e.code : 0, out: so, err: se })));
const runner = (nowIso) => runPhp([], { PC_NOW: String(Math.floor(Date.parse(nowIso) / 1000)) });
for (let i = 0; i < 50; i++) { try { await fetch(ORIGIN + '/'); break; } catch { await sleep(100); } }

const ADMIN = (await runPhp(['addaccount', 'Matthew Sharpe', 'admin', '--code-only'])).out.trim();
const EDITOR = (await runPhp(['addaccount', 'Claude drafts', 'editor', '--code-only'])).out.trim();
ok(/^\d{8}$/.test(ADMIN) && /^\d{8}$/.test(EDITOR), 'addaccount --code-only prints only an 8-digit code');

function client(origin = ORIGIN) {
  let cookie = '';
  const call = async (action, body, query = '') => {
    const o = { method: body ? 'POST' : 'GET', headers: { Cookie: cookie } };
    if (body instanceof FormData) { o.body = body; o.headers['X-PC'] = '1'; } else if (body) { o.body = JSON.stringify(body); o.headers['Content-Type'] = 'application/json'; o.headers['X-PC'] = '1'; }
    const r = await fetch(origin + '/' + PUB + '/api/cal.php?action=' + action + query, o);
    const sc = r.headers.get('set-cookie'); if (sc && /postcal=/.test(sc)) cookie = sc.split(';')[0];
    const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = { ok: false, error: 'not JSON', raw: txt.slice(0, 600) }; console.log('  (raw answer to ' + action + '): ' + txt.slice(0, 600)); }
    j._status = r.status; j._headers = r.headers; return j;
  };
  const up = (id, buf, extra = {}) => { const fd = new FormData(); fd.append('id', id); for (const [k, v] of Object.entries(extra)) fd.append(k, String(v)); fd.append('file', new Blob([buf], { type: 'image/png' }), 'pic.png'); return call('upload', fd); };
  return { call, up, ck: () => cookie };
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
const unpub = pp.filter((x) => x.path === '1418675127985724/photos' && x.q.published === 'false'), feed = pp.filter((x) => x.path === '1418675127985724/feed');
ok(!pp.some((x) => /albums/.test(x.path)) && unpub.length === 3 && feed.length === 1 && feed[0].q.message === 'Album words', 'Facebook: three unpublished photos, then one feed post with the caption (no album)');
ok(unpub.map((x) => x.q.caption).join() === 'photo 1,photo 2,photo 3', 'per-photo captions in order');
const att = [0, 1, 2].map((i) => JSON.parse(feed[0].q['attached_media[' + i + ']'] || '{}').media_fbid || '');
ok(new Set(att).size === 3 && att.every((x) => /^up\d+$/.test(x)) && att.map((x) => +x.slice(2)).every((n, i, a) => !i || n > a[i - 1]), 'the feed post attaches the three photos, in order');
ok(S1[PG].done.fb.link === 'https://fb.test/' + S1[PG].done.fb.id && /_fp\d+$/.test(S1[PG].done.fb.id) && S1[PG].done.fb.photos === '3 of 3', 'the post\'s link is kept');
const kids = pp.filter((x) => x.path === '17841460337871226/media' && x.q.is_carousel_item === 'true');
const car = pp.find((x) => x.path === '17841460337871226/media' && x.q.media_type === 'CAROUSEL');
ok(kids.length === 3 && car && car.q.children.split(',').length === 3 && car.q.caption === 'Carousel words', 'Instagram: carousel of three with the caption');
const PS1 = await mk('sixfold', { type: 'photoset', album: 'x', fb: 'x', ig: 'x', targets: ['fb', 'ig'], date: '2027-11-20', time: '14:00' }, 1);
r = await A.call('approve', { id: PS1 }); ok(r._status === 409 && /at least 2/.test(r.error), 'a photo set needs 2+ pictures');

console.log('photo set: Facebook fails, Instagram went (the 16 Nov 1:15 pm case)');
{
  const PX = await mk('sixfold', { type: 'photoset', fb: 'Set words', ig: 'Set ig', targets: ['fb', 'ig'], date: '2027-11-27', time: '14:00' }, 3);
  let rx = await A.call('approve', { id: PX }); ok(rx.ok && rx.post.album === '', 'a photo set is approved with no album name');
  failOn = { fbfeed: true }; calls = [];
  await runner('2027-11-27T21:01:00Z'); failOn = {};
  let px = state().posts[PX];
  ok(px.status === 'failed' && px.done.ig && !px.done.fb && /photos was not made: feed post refused/.test(px.error), 'feed post refused: failed, Instagram kept as done, Facebook not done');
  const igCalls = (cs) => cs.filter((x) => x.m === 'POST' && x.path.startsWith('17841460337871226/')).length;
  calls = []; await runner('2027-11-27T21:10:00Z'); ok(calls.filter((x) => x.m === 'POST').length === 0, 'a failed photo set is not retried by itself');
  rx = await A.call('todraft', { id: PX }); ok(rx.ok && rx.post.status === 'draft' && rx.post.done.ig, 'Back to draft: Instagram still recorded as done');
  await A.call('edit', { id: PX, date: '2027-11-28', time: '14:00' }); rx = await A.call('approve', { id: PX }); ok(rx.ok, 'approved again');
  calls = []; await runner('2027-11-28T21:01:00Z'); px = state().posts[PX];
  ok(px.status === 'published' && igCalls(calls) === 0 && calls.filter((x) => x.path === '1418675127985724/feed').length === 1 && calls.filter((x) => x.path === '1418675127985724/photos' && x.q.published === 'false').length === 3, 'after re-approval only Facebook went: three photos and one post; Instagram not sent again');
  /* a photo refused part-way: nothing posted, Facebook not done */
  const PY = await mk('sixfold', { type: 'photoset', fb: 'Y words', ig: '', targets: ['fb'], date: '2027-11-29', time: '14:00' }, 3);
  await A.call('approve', { id: PY }); failOn = { unpub: 'photo 2' }; calls = [];
  await runner('2027-11-29T21:01:00Z'); failOn = {};
  const py = state().posts[PY];
  ok(py.status === 'failed' && !py.done.fb && /photo 2 of 3 was not uploaded, so nothing was posted/.test(py.error) && calls.filter((x) => x.path === '1418675127985724/feed').length === 0, 'a photo refused part-way: no feed post, Facebook not done, plain error');
}

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
const tool = (args) => new Promise((res) => execFile('node', [join(ROOT, 'tools', 'pc.mjs'), ...args], { env: { ...process.env, PC_BASE: ORIGIN + '/' + PUB + '/api/cal.php', PC_CODE_FILE: join(T, 'editor-code.txt'), PC_LOADED: join(T, 'loaded.jsonl') } }, (e, so, se) => res({ code: e ? e.code : 0, out: so + se })));
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

console.log('client sign-in, one client only (2026-11-16)');
{
  ok((await runPhp(['addaccount', 'No Scope', 'client', '--code-only'])).code !== 0, 'a client sign-in without --clients is refused');
  ok((await runPhp(['addaccount', 'Bad Scope', 'client', '--clients', 'nope', '--code-only'])).code !== 0, 'a client sign-in for a client that does not exist is refused');
  ok((await runPhp(['addaccount', 'Bad Editor', 'editor', '--clients', 'sixfold', '--code-only'])).code !== 0, '--clients only goes with a client sign-in');
  const JCODE = (await runPhp(['addaccount', 'Jen Test', 'client', '--clients', 'sixfold', '--code-only'])).out.trim();
  ok(/^\d{8}$/.test(JCODE), 'client sign-in made: an 8-digit code');
  const acl = await runPhp(['accounts']);
  ok(/Jen Test \| client \| sixfold/.test(acl.out) && !acl.out.includes(JCODE) && !acl.out.includes(ADMIN), 'accounts lists names, roles and scope, never codes');
  const J = client();
  let j = await J.call('signin', { code: JCODE }); ok(j.ok && j.role === 'client' && JSON.stringify(j.clients) === '["sixfold"]', 'client sign-in: role client, scope sixfold');
  /* a Surge post with a picture, a Surge post with an open request, and a Sixfold post, made by Matthew and the editor */
  const SG1 = await mk('surge', { fb: 'Surge secret words', targets: ['fb'], date: '2028-01-11', time: '15:00' });
  const SG2 = await mk('surge', { fb: 'Surge second', targets: ['fb'], date: '2028-01-13', time: '15:00' }); await A.call('request', { id: SG2, text: 'Surge-only request text' });
  const before = JSON.stringify(state().posts[SG1]) + JSON.stringify(state().posts[SG2]) + JSON.stringify(state().clients.surge);
  /* reading */
  let d = await J.call('data'); ok(d.ok && d.clients.length === 1 && d.clients[0].id === 'sixfold' && d.me.role === 'client', 'data: only Sixfold in the client list');
  ok(d.pages === null && Object.keys(d.counts).join() === 'sixfold', 'overview: Sixfold counts only, no Meta Pages list');
  ok(!JSON.stringify(d).includes('Surge') && !JSON.stringify(d).includes('surge'), 'nothing about Surge anywhere in her data');
  d = await J.call('data', null, '&client=surge'); ok(!d.posts && !JSON.stringify(d).includes('Surge secret'), 'asking for Surge by name gives no Surge posts');
  d = await J.call('data', null, '&client=sixfold'); ok(d.posts.length > 0 && d.posts.every((p) => p.client === 'sixfold'), 'Sixfold calendar: her posts');
  ok((await J.call('slots', null, '&client=surge'))._status === 404, 'slots for Surge: no such client');
  j = await J.call('requests'); ok(j.ok && j.requests.every((r) => r.client === 'sixfold') && !JSON.stringify(j).includes('Surge-only'), 'requests: Sixfold only');
  ok((await J.call('requests', null, '&client=surge')).requests.length === 0, 'requests asked for Surge: none');
  ok((await J.call('pages'))._status === 403, 'Meta Pages list refused');
  /* every post action on a Surge post: no such post */
  const refused = [];
  for (const [a, b] of [['edit', { id: SG1, fb: 'hacked' }], ['edit', { id: SG1, date: '2028-01-12', time: '09:00' }], ['approve', { id: SG1 }], ['unapprove', { id: SG1 }], ['request', { id: SG1, text: 'x' }],
    ['withdraw', { id: SG2 }], ['todraft', { id: SG1 }], ['remove', { id: SG1 }], ['edit', { id: SG2, fb: 'answer', answer: 'true' }]]) {
    const r = await J.call(a, b); if (r._status !== 404) refused.push(a + ' ' + r._status);
  }
  ok(!refused.length, 'every post action on a Surge post answers 404' + (refused.length ? ': ' + refused.join(', ') : ''));
  const media0 = readdirSync(join(SITE, 'public_html', PUB, 'media')).length;
  j = await J.up(SG1, IMG); ok(j._status === 404 && readdirSync(join(SITE, 'public_html', PUB, 'media')).length === media0, 'upload to a Surge post: 404 and no file kept');
  ok((await J.call('create', { client: 'surge', fb: 'x' }))._status === 404, 'a new Surge post: no such client');
  ok((await J.call('client', { id: 'surge', slots: [{ d: 1, t: '09:00', type: 'single' }] }))._status === 404, 'Surge posting days: no such client');
  ok((await J.call('client', { name: 'New Co', slots: [] }))._status === 403, 'cannot add a client');
  ok((await J.call('clientarchive', { id: 'surge', archived: true }))._status === 403 && (await J.call('clientarchive', { id: 'sixfold', archived: true }))._status === 403, 'cannot archive Surge or her own client');
  ok(JSON.stringify(state().posts[SG1]) + JSON.stringify(state().posts[SG2]) + JSON.stringify(state().clients.surge) === before, 'Surge posts and client exactly as they were');
  /* her own client: everything a post needs */
  const c1 = await J.call('create', { client: 'sixfold', type: 'single', targets: ['fb', 'ig'], fb: 'Jen words', ig: 'Jen ig', date: '2028-01-18', time: '15:00' });
  ok(!!c1.id, 'she writes a new Sixfold post');
  j = await J.up(c1.id, IMG); ok(j.ok && j.post.images.length === 1, 'she uploads its picture');
  j = await J.up(c1.id, png(1080, 1080), { replace: 0 }); ok(j.ok && j.post.images[0].h === 1080, 'she replaces the picture');
  j = await J.call('edit', { id: c1.id, fb: 'Jen words, edited', date: '2028-01-20', time: '10:30' }); ok(j.ok && j.post.fb === 'Jen words, edited' && j.post.at === ts('2028-01-20T17:30:00Z'), 'she edits the caption and moves the date and time');
  j = await J.call('approve', { id: c1.id, fingerprint: j.post.fingerprint }); ok(j.ok && j.post.status === 'approved' && j.post.approval.by === 'Jen Test', 'she approves a Sixfold post; the approval says it was her');
  ok(state().posts[c1.id].log.some((l) => l.by === 'Jen Test' && /^Approved for/.test(l.what)), 'the post log shows her approval');
  ok((await A.call('data', null, '&client=sixfold')).posts.find((p) => p.id === c1.id).approval.by === 'Jen Test', 'Matthew sees who approved it');
  j = await J.call('unapprove', { id: c1.id }); ok(j.ok && j.post.status === 'draft', 'she unapproves');
  j = await J.call('request', { id: c1.id, text: 'Brighter picture please' }); ok(j.ok && j.post.status === 'changes', 'she requests changes');
  j = await J.call('withdraw', { id: c1.id }); ok(j.ok && j.post.status === 'draft', 'she withdraws the request');
  await J.call('request', { id: c1.id, text: 'New caption' });
  j = await J.call('edit', { id: c1.id, fb: 'New caption', answer: 'true' }); ok(j.ok && j.post.status === 'draft' && !j.post.openRequest, 'she answers a change request by editing');
  const c2 = await J.call('create', { client: 'sixfold', type: 'photoset', targets: ['fb', 'ig'], album: 'Jen set', fb: 'set', ig: 'set', date: '2028-01-22', time: '14:00' });
  await J.up(c2.id, IMG, { caption: 'one' }); j = await J.up(c2.id, png(1080, 1080), { caption: 'two' });
  const files = j.post.images.map((im) => im.file);
  j = await J.call('edit', { id: c2.id, album: 'Jen set renamed', images: [{ file: files[1], caption: 'two' }, { file: files[0], caption: 'one' }] });
  ok(j.ok && j.post.album === 'Jen set renamed' && j.post.images[0].file === files[1], 'she renames the album and reorders the pictures');
  j = await J.call('edit', { id: c2.id, images: [{ file: files[1], caption: 'two' }] }); ok(j.ok && j.post.images.length === 1, 'she removes a picture');
  let raw2 = state(); raw2.posts[c1.id].status = 'failed'; raw2.posts[c1.id].error = 'test failure'; writeFileSync(join(SITE, 'post-calendar-data', 'state.json'), JSON.stringify(raw2));
  j = await J.call('todraft', { id: c1.id }); ok(j.ok && j.post.status === 'draft', 'she moves a failed post back to draft');
  j = await J.call('remove', { id: c2.id }); ok(j.ok && state().posts[c2.id].status === 'removed', 'she removes a post');
  /* posting days: the slots of her own client, nothing else */
  const six0 = state().clients.sixfold; calls = [];
  j = await J.call('client', { id: 'sixfold', slots: [{ d: 1, t: '10:00', type: 'single' }, { d: 3, t: '16:30', type: 'single' }, { d: 6, t: '09:00', type: 'photoset' }] });
  const six1 = state().clients.sixfold;
  ok(j.ok && six1.slots.map((s) => s.d + s.t + s.type).join() === '110:00single,316:30single,609:00photoset', 'she changes Sixfold\'s posting days and times');
  ok(six1.page_id === six0.page_id && six1.ig_id === six0.ig_id && six1.name === six0.name && six1.conn === six0.conn && six1.color === six0.color && six1.rules === six0.rules, 'nothing else about Sixfold changed');
  j = await J.call('slots', null, '&client=sixfold&n=3&from=' + ts('2028-02-01T12:00:00Z')); ok(j.slots[0].at === ts('2028-02-02T23:30:00Z'), 'the new days are what the calendar offers (Wed 4:30 pm)');
  for (const [what, extra] of [['its Page', { page_id: '555000' }], ['its Instagram', { ig_id: '777000' }], ['its token', { conn: 'own', token: 'OWN-VAA' }], ['its name', { name: 'Renamed' }], ['its connection', { conn: 'own' }]]) {
    j = await J.call('client', { id: 'sixfold', slots: [{ d: 2, t: '15:00', type: 'single' }], ...extra });
    ok(j._status === 403, 'she cannot change ' + what);
  }
  const six2 = state().clients.sixfold;
  ok(six2.page_id === six0.page_id && six2.ig_id === six0.ig_id && six2.conn === six0.conn && six2.slots.length === 3 && !existsSync(join(SITE, 'post-calendar-data', 'private', 'client-sixfold.json')), 'after the refusals: Page, Instagram, connection and slots as she left them, no token saved');
  ok(calls.length === 0, 'no call to Meta for her posting days or the refused changes');
  /* Matthew and the editor are as they were */
  const eP = await E.call('create', { client: 'sixfold', fb: 'editor draft', targets: ['fb'], date: '2028-01-25', time: '15:00' }); await E.up(eP.id, IMG);
  ok((await E.call('approve', { id: eP.id }))._status === 403, 'the editor still cannot approve');
  ok((await E.call('client', { id: 'sixfold', slots: [] }))._status === 403, 'the editor cannot change posting days');
  ok((await A.call('data')).clients.length >= 2 && (await A.call('data', null, '&client=surge')).posts.some((p) => p.id === SG1), 'Matthew still sees every client, Surge included');
  ok((await A.call('client', { id: 'sixfold', name: 'Sixfold 365', color: six0.color, conn: 'pipeline', page_id: six0.page_id, ig_id: six0.ig_id, slots: six0.slots, rules: six0.rules })).ok, 'Matthew still edits the client setup (and puts the days back)');
  /* taking the sign-in away signs it out at once */
  ok((await runPhp(['removeaccount', 'Jen Test'])).code === 0, 'removeaccount');
  ok((await J.call('data'))._status === 401, 'a removed client sign-in is signed out on its next call');
  ok((await A.call('data'))._status === 200, 'Matthew still signed in');
}

console.log('phone videos: converted or re-packed on the server (2026-11-16)');
{
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffprobe'], { encoding: 'utf8' });
  const FFPROBE = (which.stdout || '').split(/\r?\n/)[0].trim(); const FFMPEG = FFPROBE ? join(dirname(FFPROBE), process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg') : '';
  if (!FFPROBE || !existsSync(FFMPEG)) console.log('  SKIPPED: no ffmpeg/ffprobe on this machine');
  else {
    const V = join(T, 'videos'); mkdirSync(V);
    const ff = (args) => spawnSync(FFMPEG, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
    const probe = (f) => JSON.parse(spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,codec_tag_string,width,height:stream_side_data=rotation:format=duration:format_tags', '-of', 'json', f], { encoding: 'utf8' }).stdout);
    const src = (size, sec, rate = 30) => ['-f', 'lavfi', '-i', 'testsrc2=size=' + size + ':rate=' + rate + ':duration=' + sec, '-f', 'lavfi', '-i', 'sine=frequency=440:duration=' + sec];
    const x265 = ['-c:v', 'libx265', '-preset', 'ultrafast', '-x265-params', 'log-level=error', '-tag:v', 'hvc1', '-c:a', 'aac', '-shortest'];
    ff([...src('1080x1920', 4), ...x265, '-metadata', 'location=+39.6500-104.9900/', join(V, 'phone.mov')]);
    ff([...src('1920x1080', 3), ...x265, join(V, 'sideways-raw.mov')]); ff(['-display_rotation', '90', '-i', join(V, 'sideways-raw.mov'), '-c', 'copy', join(V, 'turned.mov')]);
    ff([...src('2160x3840', 1), ...x265, join(V, 'four-k.mov')]);
    ff([...src('180x320', 91, 5), ...x265, join(V, 'long.mov')]);
    ff([...src('640x1136', 2), '-c:v', 'mpeg4', '-c:a', 'aac', '-shortest', join(V, 'old-codec.mp4')]);
    ff(['-f', 'lavfi', '-i', 'testsrc2=size=720x1280:rate=30:duration=3', '-vf', 'noise=alls=80:allf=t', '-c:v', 'libx265', '-preset', 'ultrafast', '-x265-params', 'log-level=error:crf=8', '-tag:v', 'hvc1', join(V, 'big.mov')]);
    ok(['phone.mov', 'turned.mov', 'four-k.mov', 'long.mov', 'old-codec.mp4', 'big.mov'].every((f) => existsSync(join(V, f))), 'test videos made (HEVC .mov, turned, 4K, 91 s, MPEG-4 part 2, a noisy one)');
    ok(probe(join(V, 'phone.mov')).format.tags.location && probe(join(V, 'phone.mov')).streams[0].codec_name === 'hevc', 'the phone-style clip is HEVC in a .mov with a location tag');
    /* the page's way in, against a second php -S that has ffmpeg with an H.264 encoder */
    const port2 = port + 1, ORIGIN2 = 'http://127.0.0.1:' + port2;
    const php2 = spawn('php', ['-d', 'upload_max_filesize=256M', '-d', 'post_max_size=256M', '-S', '127.0.0.1:' + port2, '-t', join(SITE, 'public_html')], { env: { ...env, PC_ORIGIN: ORIGIN2, PC_FFMPEG: FFMPEG, PC_FFPROBE: FFPROBE }, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) { try { await fetch(ORIGIN2 + '/'); break; } catch { await sleep(100); } }
    const E2 = client(ORIGIN2); await E2.call('signin', { code: EDITOR });
    const upF = (id, f, type = 'video/quicktime') => { const fd = new FormData(); fd.append('id', id); fd.append('file', new Blob([readFileSync(f)], { type }), basename(f)); return E2.call('upload', fd); };
    ok((await E2.call('data')).video.convert === true && (await E.call('data')).video.convert === false, 'the page is told whether the server can convert');
    const v1 = await E2.call('create', { client: 'sixfold', type: 'single', targets: ['fb', 'ig'], fb: 'phone video', ig: 'phone video', date: '2028-02-08', time: '15:00' });
    let t0 = Date.now(); let r = await upF(v1.id, join(V, 'phone.mov')); const took = Date.now() - t0;
    const im = r.post && r.post.images[0];
    ok(r.ok && im.kind === 'video' && /\.mp4$/.test(im.file) && im.prepared === 'converted' && im.w === 1080 && im.h === 1920 && Math.round(im.sec) === 4, 'an HEVC .mov from a phone becomes a one-video post (converted, 1080 x 1920, 4 s)');
    const stored = join(SITE, 'public_html', PUB, 'media', im.file), sp = probe(stored), buf = readFileSync(stored);
    ok(sp.streams.find((s) => s.codec_type === 'video').codec_name === 'h264' && sp.streams.find((s) => s.codec_type === 'audio').codec_name === 'aac', 'stored as H.264 video with AAC sound');
    ok(buf.indexOf('moov') > 0 && buf.indexOf('moov') < buf.indexOf('mdat'), 'faststart: the index comes before the video data');
    ok(!(sp.format.tags || {}).location, 'the location tag is gone');
    ok(r.post.problems.length === 0 && (await A.call('approve', { id: v1.id })).ok, 'a converted video post can be approved like any other');
    await A.call('unapprove', { id: v1.id });
    console.log('    (4 s clip converted in ' + took + ' ms)');
    const v2 = await E2.call('create', { client: 'sixfold', type: 'single', date: '2028-02-10', time: '15:00' });
    r = await upF(v2.id, join(V, 'turned.mov')); ok(r.ok && r.post.images[0].w === 1080 && r.post.images[0].h === 1920 && probe(join(SITE, 'public_html', PUB, 'media', r.post.images[0].file)).streams[0].width === 1080, 'a phone\'s turned video comes out upright (1080 x 1920)');
    r = await upF(v2.id, join(V, 'four-k.mov')); ok(r.ok && r.post.images[0].w === 1080 && r.post.images[0].h === 1920, '4K is brought down to 1920 on the long side');
    r = await upF(v2.id, join(V, 'long.mov')); ok(!r.ok && r.error === 'The video is 1 min 31 s; Reels from here can be up to 90 seconds. Trim it on your phone and upload again.', 'over 90 seconds: refused in plain words');
    r = await upF(v2.id, join(V, 'old-codec.mp4'), 'video/mp4'); ok(r.ok && probe(join(SITE, 'public_html', PUB, 'media', r.post.images[0].file)).streams[0].codec_name === 'h264', 'another codec is converted to H.264');
    { const fd = new FormData(); fd.append('id', v2.id); fd.append('file', new Blob([readFileSync(join(V, 'long.mov'))], { type: 'video/quicktime' }), 'long.mov'); const r1 = await E.call('upload', fd);
      ok(r1._status === 413 && /over the upload limit \(2 MB\)\. Phone videos: record in 1080p, under 90 seconds\./.test(r1.error), 'over PHP\'s upload limit: said in plain words with the limit'); }
    const ps2 = await E2.call('create', { client: 'sixfold', type: 'photoset', date: '2028-02-12', time: '14:00' });
    r = await upF(ps2.id, join(V, 'phone.mov')); ok(!r.ok && /own post/.test(r.error), 'a photo set still refuses a video');
    ok(readdirSync(join(SITE, 'post-calendar-data', 'tmp')).length === 0, 'nothing left behind in the work folder');
    php2.kill();
    /* the host's case: an ffmpeg with no H.264 encoder (PC_X264=0): re-pack what phones record, refuse what would need converting */
    writeFileSync(join(T, 'store.php'), "<?php define('PC', 1); require getenv('PC_LIB'); echo json_encode(pcStoreMedia($argv[1], basename($argv[1])), JSON_UNESCAPED_SLASHES);");
    const store = (f, extra = {}) => new Promise((res) => execFile('php', [join(T, 'store.php'), f], { env: { ...env, PC_LIB: join(SITE, 'post-calendar-tools', 'lib.php'), PC_FFMPEG: FFMPEG, PC_FFPROBE: FFPROBE, ...extra } }, (e, so) => { try { res(JSON.parse(so)); } catch { res({ error: 'not JSON: ' + so.slice(0, 300) }); } }));
    const nox = { PC_X264: '0' };
    r = await store(join(V, 'phone.mov'), nox); let rp = r.file && probe(join(SITE, 'public_html', PUB, 'media', r.file));
    ok(r.prepared === 'repacked' && rp.streams[0].codec_name === 'hevc' && rp.streams[0].codec_tag_string === 'hvc1' && rp.format.tags.major_brand === 'isom' && !rp.format.tags.location, 'no H.264 encoder: HEVC re-packed into MP4 (hvc1), location gone');
    r = await store(join(V, 'turned.mov'), nox); rp = r.file && probe(join(SITE, 'public_html', PUB, 'media', r.file));
    ok(r.w === 1080 && r.h === 1920 && (rp.streams[0].side_data_list || []).some((x) => Math.abs(x.rotation) === 90), 'no H.264 encoder: a turned video keeps its turn and is counted upright');
    r = await store(join(V, 'four-k.mov'), nox); ok(/2160 x 3840 \(4K\)/.test(r.error || '') && /1080p/.test(r.error), 'no H.264 encoder: 4K refused, asking for 1080p');
    r = await store(join(V, 'old-codec.mp4'), nox); ok(/format \(mpeg4\) cannot be posted/.test(r.error || ''), 'no H.264 encoder: another codec refused in plain words');
    r = await store(join(V, 'long.mov'), nox); ok(/^The video is 1 min 31 s; Reels/.test(r.error || ''), 'no H.264 encoder: over 90 seconds refused');
    r = await store(join(V, 'big.mov'), { ...nox, PC_VIDEO_MAX: String(1024 * 1024) }); ok(/^The video is \d+ MB; the most is 1 MB\. Record it in 1080p/.test(r.error || ''), 'over the size limit: refused (re-packed)');
    r = await store(join(V, 'big.mov'), { PC_VIDEO_MAX: String(1024 * 1024) }); ok(/^The video is \d+ MB after converting; the most is 1 MB/.test(r.error || ''), 'over the size limit after converting: refused');
    ok(readdirSync(join(SITE, 'post-calendar-data', 'tmp')).length === 0, 'refused conversions leave nothing behind');
  }
}

console.log('LinkedIn company-page posting and the Surge Facebook hold (2026-11-18)');
{
  const PRIV = join(SITE, 'post-calendar-data', 'private');
  const sv = (dd) => dd.clients.find((c) => c.id === 'surge').li;
  const NOW = Math.floor(Date.now() / 1000);
  const iso = (t) => new Date(t * 1000).toISOString();
  const mt = (t) => { const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t * 1000)); const g = (k) => f.find((x) => x.type === k).value; return { date: g('year') + '-' + g('month') + '-' + g('day'), time: g('hour') + ':' + g('minute') }; };
  const TOK = /LI-AT-|LI-RT-|LI-SECRET/;
  const mails = () => (existsSync(MAIL) ? readFileSync(MAIL, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

  /* before the app keys are on the server */
  let d = await A.call('data', null, '&client=surge');
  ok(sv(d).state === 'noapp' && d.clients.find((c) => c.id === 'sixfold').li === null, 'no app keys yet: Surge says so; Sixfold has no LinkedIn at all');
  ok((await A.call('liconnect', { id: 'surge' }))._status === 409, 'Connect LinkedIn refused while the app keys are missing');
  writeFileSync(join(PRIV, 'linkedin-app.json'), JSON.stringify({ client_id: 'LI-CLIENT', client_secret: 'LI-SECRET' }));
  /* who may */
  ok((await E.call('liconnect', { id: 'surge' }))._status === 403 && (await E.call('lipick', { id: 'surge', org: '111' }))._status === 403 && (await E.call('lidisconnect', { id: 'surge' }))._status === 403 && (await E.call('listatus', null, '&client=surge'))._status === 403, 'the editor can neither connect, pick, disconnect nor read the LinkedIn status');
  ok((await A.call('liconnect', { id: 'sixfold' }))._status === 404, 'LinkedIn is Surge only: Sixfold refused');
  r = await A.call('create', { client: 'sixfold', targets: ['fb', 'li'], fb: 'x', li: 'x' }); ok(r.ok && state().posts[r.id].targets.join() === 'fb', 'a Sixfold post cannot carry a LinkedIn target (dropped)');
  licalls = []; d = await A.call('data', null, '&client=surge'); await A.call('listatus', null, '&client=surge'); await A.call('data');
  ok(licalls.length === 0 && sv(d).state === 'none', 'reading the page and the status calls LinkedIn not at all (pressing nothing changes nothing)');

  /* Connect: the address LinkedIn gets */
  const start = async () => { const j = await A.call('liconnect', { id: 'surge' }); const u = new URL(j.url); return { j, u, st: u.searchParams.get('state') }; };
  let s1 = await start(); let sc = s1.u.searchParams.get('scope').split(' ');
  ok(s1.u.origin + s1.u.pathname === LIBASE + 'oauth/authorization' && s1.u.searchParams.get('response_type') === 'code' && s1.u.searchParams.get('client_id') === 'LI-CLIENT' && s1.u.searchParams.get('redirect_uri') === ORIGIN + '/' + PUB + '/api/linkedin-oauth.php' && /^[0-9a-f]{32}$/.test(s1.st), 'Connect: LinkedIn\'s authorization page with the app id, the registered return address and a fresh state');
  ok(['w_organization_social', 'r_organization_social', 'rw_organization_admin', 'r_basicprofile'].every((x) => sc.includes(x)) && /scope=[a-z_]+%20/.test(s1.j.url), 'scopes: w_organization_social r_organization_social rw_organization_admin r_basicprofile, space-separated');
  ok(!s1.j.url.includes('LI-SECRET'), 'the app secret is never in the address');
  const cb = async (qs, cl = A) => { const rr = await fetch(ORIGIN + '/' + PUB + '/api/linkedin-oauth.php?' + qs, { headers: { Cookie: cl.ck() }, redirect: 'manual' }); return { status: rr.status, html: await rr.text(), h: rr.headers }; };
  const tokenCalls = () => licalls.filter((x) => x.path === 'oauth/accessToken');
  /* refused before approval (what LinkedIn does until the Development tier is approved) */
  licalls = [];
  r = await cb('error=unauthorized_scope_error&error_description=' + encodeURIComponent('Scope "w_organization_social" is not authorized for your application') + '&state=' + s1.st);
  ok(r.html.includes('LinkedIn hasn&#039;t approved posting yet') && r.html.includes('w_organization_social') && licalls.length === 0, 'refused before approval: "LinkedIn hasn\'t approved posting yet" with LinkedIn\'s own words; nothing sent to LinkedIn');
  ok(r.h.get('x-frame-options') === 'DENY' && r.h.get('referrer-policy') === 'no-referrer', 'the return page cannot be framed and leaks no address');
  d = await A.call('data', null, '&client=surge'); ok(sv(d).state === 'refused' && /hasn't approved posting yet/.test(sv(d).last.text), 'the client setup shows the refusal');
  r = await cb('code=GOOD&state=' + s1.st); ok(r.status === 400 && tokenCalls().length === 0, 'a state works once: used again, refused, no code swapped');
  r = await cb('code=GOOD&state=' + 'ab'.repeat(16)); ok(r.status === 400 && tokenCalls().length === 0, 'a state this server never gave: refused');
  s1 = await start(); r = await cb('error=unauthorized_scope_error&error_description=' + encodeURIComponent('Scope "r_basicprofile" is not authorized for your application') + '&state=' + s1.st);
  ok(/Press Connect LinkedIn again/.test(r.html) && /an extra, not needed to post/.test(r.html), 'an optional scope refused: said plainly, Connect again');
  s1 = await start(); sc = s1.u.searchParams.get('scope').split(' ');
  ok(!sc.includes('r_basicprofile') && sc.includes('w_organization_social'), 'the next Connect leaves the refused extra out');
  r = await cb('error=user_cancelled_authorize&error_description=x&state=' + s1.st); ok(/Nothing changed/.test(r.html) && /stopped at LinkedIn/.test(r.html), 'cancelled at LinkedIn: nothing changed');
  fs_rm(join(PRIV, 'linkedin-surge.json'));   /* start clean again, extras asked for */
  s1 = await start(); r = await cb('code=GOOD&state=' + s1.st, E); ok(r.status === 403 && tokenCalls().length === 0, 'the editor\'s cookie cannot finish a Connect (no code swapped)');
  r = await cb('code=GOOD&state=' + s1.st, { ck: () => '' }); ok(r.status === 403 && tokenCalls().length === 0, 'no sign-in at all: refused');
  s1 = await start(); r = await cb('code=NOPOST&state=' + s1.st);
  ok(r.html.includes('LinkedIn hasn&#039;t approved posting yet') && sv(await A.call('data', null, '&client=surge')).state === 'refused', 'signed in but without permission to post: "hasn\'t approved posting yet", nothing kept');
  /* success */
  s1 = await start(); licalls = []; r = await cb('code=GOOD&state=' + s1.st);
  ok(r.status === 200 && r.html.includes('LinkedIn connected') && r.html.includes('Connected as <b>Matt Sharpe</b>') && r.html.includes('Surge Inc') && /Other Co<small>Analyst \(cannot post for this Page\)/.test(r.html), 'connected: his name, his Pages listed; a Page he cannot post for is shown but not pickable');
  const tc = tokenCalls()[0];
  ok(tc && tc.q.grant_type === 'authorization_code' && tc.q.code === 'GOOD' && tc.q.client_secret === 'LI-SECRET' && tc.q.redirect_uri === ORIGIN + '/' + PUB + '/api/linkedin-oauth.php' && /x-www-form-urlencoded/.test(tc.h['content-type']), 'the code is swapped server to server with the app secret (form post)');
  ok(licalls.filter((x) => x.path.startsWith('rest/')).length >= 3 && licalls.filter((x) => x.path.startsWith('rest/')).every((x) => x.h['linkedin-version'] === '202611' && x.h['x-restli-protocol-version'] === '2.0.0' && x.h.authorization === 'Bearer LI-AT-1'), 'versioned calls carry LinkedIn-Version 202611 and Rest.li 2.0.0');
  ok(!TOK.test(r.html), 'no token or secret in the return page');
  const rawConn = readFileSync(join(PRIV, 'linkedin-surge.json'), 'utf8');
  ok(!/LI-AT-|LI-RT-/.test(rawConn) && /"sealed"/.test(rawConn) && existsSync(join(PRIV, 'linkedin.key')), 'access and refresh tokens kept sealed (encrypted) on the server');
  d = await A.call('data', null, '&client=surge');
  ok(sv(d).state === 'pick' && sv(d).member === 'Matt Sharpe' && sv(d).orgs.length === 2 && sv(d).refresh_exp > NOW + 300 * 86400 && !TOK.test(JSON.stringify(d)), 'the page: connected as Matt Sharpe, pick the Page, renewable for a year; no token in the data');
  ok((await A.call('lipick', { id: 'surge', org: '222' }))._status === 409, 'a Page he cannot post for cannot be picked');
  r = await A.call('lipick', { id: 'surge', org: '111' }); ok(r.ok && r.li.state === 'ok' && r.li.org_name === 'Surge Inc' && r.li.org_id === '111', 'Surge Inc picked: connected as Matt Sharpe, Surge Inc');

  /* the Surge Facebook hold */
  const T1 = Math.floor((NOW + 2 * 86400) / 60) * 60;
  const HB = await mk('surge', { fb: 'approved before the hold', targets: ['fb'], ...mt(T1 + 7200) }); ok((await A.call('approve', { id: HB })).ok, 'a Surge Facebook post approved before the hold');
  let hr = await runPhp(['hold', 'surge', 'fb,ig', 'Matthew 11 and 18 Nov: Surge Facebook on hold until he has access to the right Surge account']);
  ok(hr.code === 0 && /1 approved post/.test(hr.out) && state().posts[HB].status === 'draft', 'hold surge fb,ig: on, and the approved Facebook post went back to draft');
  d = await A.call('data', null, '&client=surge'); const sc0 = d.clients.find((c) => c.id === 'surge');
  ok(sc0.holds.fb && /on hold until/.test(sc0.holds.fb.why) && sc0.holds.ig && !Object.keys(d.clients.find((c) => c.id === 'sixfold').holds).length, 'the page shows Surge\'s hold; Sixfold has none');
  r = await A.call('approve', { id: HB }); ok(r._status === 409 && /Facebook is on hold for Surge/.test(r.error), 'a Surge Facebook post cannot be approved while the hold is on');
  { const fp1 = d.posts.find((p) => p.id === HB).fingerprint; const raw = state(); raw.posts[HB].status = 'approved'; raw.posts[HB].approval = { by: 'behind the page', at: 1, hash: fp1 }; writeFileSync(join(SITE, 'post-calendar-data', 'state.json'), JSON.stringify(raw)); }
  calls = []; licalls = []; await runner(iso(T1 + 7260));
  ok(state().posts[HB].status === 'failed' && /Facebook: on hold for Surge/.test(state().posts[HB].error) && calls.length === 0, 'approved behind the page anyway: the runner sends nothing to Meta (not even a look-up) and marks it failed');
  ok(mails().some((m) => /Surge post failed/.test(m.subject) && /on hold/.test(m.body)), 'and Matthew gets the failure email');
  ok((await runPhp(['linkedin'])).out.includes('Facebook on hold: Matthew 11 and 18 Nov') && !TOK.test((await runPhp(['linkedin'])).out), 'runner linkedin: state and holds, no tokens');

  /* a LinkedIn text post with a first comment */
  const LTXT = 'Hiring a sales team (part 1) is its own job. #sales #hiring';
  const L1 = (await E.call('create', { client: 'surge', targets: ['fb', 'li'], li: LTXT, li_comment: 'More: https://surgeftw.com/', ...mt(T1) })).id;
  let p1 = (await A.call('data', null, '&client=surge')).posts.find((p) => p.id === L1);
  ok(p1.targets.join() === 'fb,li' && p1.problems.some((x) => /Facebook is on hold/.test(x)), 'Facebook ticked on a Surge post: blocked by the hold');
  r = await E.call('edit', { id: L1, targets: ['li'] }); ok(r.post.problems.length === 0, 'LinkedIn only, words alone: ready to approve');
  r = await E.call('edit', { id: L1, li: 'See https://surgeftw.com now' }); ok(r.post.problems.some((x) => /Links go in the first comment/.test(x)), 'a link in the LinkedIn post: "links go in the first comment"');
  r = await E.call('edit', { id: L1, li: 'x'.repeat(2990) + '((((((' }); ok(r.post.problems.some((x) => /over 3,000/.test(x)), 'over 3,000 characters once LinkedIn\'s escaping is counted');
  r = await E.call('edit', { id: L1, li: LTXT, li_comment: 'y'.repeat(1251) }); ok(r.post.problems.some((x) => /first comment is over 1,250/.test(x)), 'a first comment over 1,250 characters');
  r = await E.call('edit', { id: L1, li_comment: 'More: https://surgeftw.com/' }); ok(r.post.problems.length === 0, 'back to ready');
  ok((await E.call('approve', { id: L1 }))._status === 403, 'the editor cannot approve a LinkedIn post either');
  r = await A.call('approve', { id: L1, fingerprint: r.post.fingerprint }); ok(r.ok && r.post.status === 'approved', 'approved, one tap');
  r = await E.call('edit', { id: L1, li_comment: 'More: https://surgeftw.com/about' }); ok(r.post.status === 'draft', 'changing the first comment drops the approval (it is in the fingerprint)');
  r = await E.call('edit', { id: L1, li_comment: 'More: https://surgeftw.com/' }); r = await A.call('approve', { id: L1 }); ok(r.ok, 'approved again');
  calls = []; licalls = []; await runner(iso(T1 - 60)); ok(!licalls.some((x) => x.path === 'rest/posts'), 'nothing sent before its time');
  licalls = []; await runner(iso(T1 + 60));
  let q1 = state().posts[L1]; const pc = licalls.find((x) => x.path === 'rest/posts'); const cc = licalls.find((x) => /^rest\/socialActions\//.test(x.path));
  ok(q1.status === 'published' && /^urn:li:share:\d+$/.test(q1.done.li.id) && q1.done.li.link === 'https://www.linkedin.com/feed/update/' + q1.done.li.id + '/', 'published; the post\'s LinkedIn address recorded');
  ok(pc && pc.body.author === 'urn:li:organization:111' && pc.body.commentary === 'Hiring a sales team \\(part 1\\) is its own job. #sales #hiring' && pc.body.visibility === 'PUBLIC' && pc.body.distribution.feedDistribution === 'MAIN_FEED' && pc.body.lifecycleState === 'PUBLISHED' && !pc.body.content, 'a text post as urn:li:organization:111; LinkedIn\'s reserved characters escaped, hashtags kept');
  ok(cc && decodeURIComponent(cc.path) === 'rest/socialActions/' + q1.done.li.id + '/comments' && cc.body.actor === 'urn:li:organization:111' && cc.body.object === q1.done.li.id && cc.body.message.text === 'More: https://surgeftw.com/' && licalls.indexOf(cc) > licalls.indexOf(pc) && q1.done.lic, 'the first comment goes up as the Page, right after the post, with the link');
  ok(calls.length === 0, 'a LinkedIn-only post never calls Meta');
  licalls = []; await runner(iso(T1 + 400)); await runner(iso(T1 + 900)); ok(!licalls.some((x) => x.m === 'POST'), 'run again: nothing sent twice');
  r = await A.call('edit', { id: L1, li: 'too late' }); ok(r._status === 409, 'a published LinkedIn post cannot be edited');

  /* pictures: one (content.media) and a set (content.multiImage) */
  const L2 = await mk('surge', { targets: ['li'], li: 'One picture.', ...mt(T1 + 3600) });
  const L3 = await mk('surge', { type: 'photoset', targets: ['li'], li: 'Three pictures.', ...mt(T1 + 3900) }, 3);
  ok((await A.call('approve', { id: L2 })).ok && (await A.call('approve', { id: L3 })).ok, 'a one-picture and a three-picture LinkedIn post approved');
  licalls = []; await runner(iso(T1 + 3960));
  const inits = licalls.filter((x) => x.path === 'rest/images' && x.q.action === 'initializeUpload'), puts = licalls.filter((x) => x.m === 'PUT');
  const posts2 = licalls.filter((x) => x.path === 'rest/posts');
  const q2 = state().posts[L2], q3 = state().posts[L3];
  ok(q2.status === 'published' && q3.status === 'published' && inits.length === 4 && inits.every((x) => x.body.initializeUploadRequest.owner === 'urn:li:organization:111'), 'four pictures registered with the Images API, owned by the Page');
  ok(puts.length === 4 && puts.every((x) => x.h.authorization === 'Bearer LI-AT-1') && puts[0].raw.equals(readFileSync(join(SITE, 'public_html', PUB, 'media', q2.images[0].file))), 'each picture\'s own bytes PUT to the upload address');
  ok(licalls.filter((x) => x.m === 'GET' && x.path.startsWith('rest/images/')).length >= 4, 'each picture checked AVAILABLE before the post');
  ok(posts2.length === 2 && posts2[0].body.content.media.id === 'urn:li:image:IMG' + (liImg - 3) && posts2[1].body.content.multiImage.images.map((x) => x.id).join() === ['IMG' + (liImg - 2), 'IMG' + (liImg - 1), 'IMG' + liImg].map((x) => 'urn:li:image:' + x).join(), 'one picture: content.media; a set: content.multiImage, in order');
  ok(q3.done.li.pictures === 3, 'the set\'s picture count kept');

  /* a refused post: failed, email, never retried by itself */
  const L4 = (await E.call('create', { client: 'surge', targets: ['li'], li: 'Refused one.', li_comment: 'link here', ...mt(T1 + 5400) })).id; await A.call('approve', { id: L4 });
  liFail = { post: true }; licalls = []; const m0 = mails().length; await runner(iso(T1 + 5460)); liFail = {};
  let q4 = state().posts[L4];
  ok(q4.status === 'failed' && /LinkedIn: the post was not made: LinkedIn said: post refused/.test(q4.error) && !q4.done.li && !licalls.some((x) => /socialActions/.test(x.path)), 'LinkedIn refuses the post: failed in LinkedIn\'s words, no comment tried');
  ok(!TOK.test(q4.error) && q4.error.includes('[token]'), 'the token in LinkedIn\'s answer is scrubbed');
  const fm = mails().slice(m0).filter((m) => /Surge post failed/.test(m.subject));
  ok(fm.length === 1 && /Where: LinkedIn/.test(fm[0].body) && /First line: Refused one\./.test(fm[0].body) && !TOK.test(fm[0].body), 'one failure email to Matthew, LinkedIn named, no token');
  licalls = []; await runner(iso(T1 + 5700)); ok(!licalls.some((x) => x.m === 'POST') && mails().length === m0 + 1, 'a failed LinkedIn post is not retried by itself, no second email');
  /* the post goes, the comment is refused: Back to draft + Approve sends only the comment */
  const L5 = (await E.call('create', { client: 'surge', targets: ['li'], li: 'Comment refused.', li_comment: 'Link: https://surgeftw.com/', ...mt(T1 + 7000) })).id; await A.call('approve', { id: L5 });
  liFail = { comment: true }; licalls = []; await runner(iso(T1 + 7060)); liFail = {};
  let q5 = state().posts[L5];
  ok(q5.status === 'failed' && q5.done.li && !q5.done.lic && /the post went up \(https:\/\/www\.linkedin\.com\/feed\/update\/urn:li:share:\d+\/\) but the first comment was not added/.test(q5.error), 'the comment refused: failed, the post kept as gone, said plainly');
  r = await A.call('todraft', { id: L5 }); ok(r.ok && /already went: LinkedIn/.test(state().posts[L5].log.slice(-1)[0].what), 'Back to draft: LinkedIn recorded as gone');
  await A.call('edit', { id: L5, ...mt(T1 + 8000) }); ok((await A.call('approve', { id: L5 })).ok, 'approved again');
  licalls = []; await runner(iso(T1 + 8060)); q5 = state().posts[L5];
  ok(q5.status === 'published' && q5.done.lic && !licalls.some((x) => x.path === 'rest/posts') && licalls.filter((x) => /socialActions/.test(x.path)).length === 1, 'after re-approval only the comment went: the post was not made twice');

  /* numbers: about 2 hours, 1 day, 3 days and 7 days after it went */
  const L8 = (await E.call('create', { client: 'surge', targets: ['li'], li: 'Numbers post.', ...mt(T1 + 20000) })).id; await A.call('approve', { id: L8 });
  liFail = { noStatsFor: state().posts[L2].done.li.id };
  await runner(iso(T1 + 20060)); ok(state().posts[L8].status === 'published', 'a post for the numbers published');
  { const l2 = state().posts[L2].li_stats; ok(l2 && l2.n === 1 && l2.likes === 0 && l2.impressions === 0 && l2.at, 'a post LinkedIn leaves out of the answer counts 0 (no actions yet)'); }
  const went = state().posts[L8].done.li.at;
  licalls = []; await runner(iso(went + 7200 - 120)); ok(!licalls.some((x) => x.path === 'rest/organizationalEntityShareStatistics'), 'no numbers read before 2 hours');
  licalls = []; await runner(iso(went + 7260));
  const stc = licalls.find((x) => x.path === 'rest/organizationalEntityShareStatistics');
  ok(stc && /q=organizationalEntity&organizationalEntity=urn%3Ali%3Aorganization%3A111/.test(stc.search) && stc.search.includes(encodeURIComponent(state().posts[L8].done.li.id)) && stc.h['linkedin-version'] === '202611', 'Page analytics: organizationalEntityShareStatistics for the post, as the Page');
  let st1 = state().posts[L8].li_stats;
  ok(st1 && st1.n === 1 && st1.likes === 7 && st1.comments === 2 && st1.shares === 1 && st1.impressions === 300 && st1.clicks === 9 && st1.unique === 250 && st1.at === Math.floor(Date.parse(iso(went + 7260)) / 1000), 'likes, comments, shares, impressions and clicks stored on the post');
  licalls = []; await runner(iso(went + 9000)); ok(!licalls.some((x) => x.path === 'rest/organizationalEntityShareStatistics'), 'not read again until a day after');
  await runner(iso(went + 86460)); ok(state().posts[L8].li_stats.n === 2, 'read again a day after');
  liFail = {};
  { const pv = (await A.call('data', null, '&client=surge')).posts.find((p) => p.id === L8); ok(pv.li_stats.likes === 7 && !TOK.test(JSON.stringify(pv)), 'the numbers reach the page with the post'); }
  await runner(iso(went + 4 * 86400)); await runner(iso(went + 8 * 86400)); await runner(iso(went + 9 * 86400));
  ok(state().posts[L8].li_stats.n === 4, 'four reads in all, then it stops');

  /* the sign-in renews itself with under 7 days left */
  licalls = []; await runner(iso(NOW + 54 * 86400));
  const rf = licalls.find((x) => x.path === 'oauth/accessToken');
  ok(rf && rf.q.grant_type === 'refresh_token' && rf.q.refresh_token === 'LI-RT-1' && rf.q.client_secret === 'LI-SECRET', 'with under 7 days left the runner refreshes the access token by itself');
  ok(!/LI-AT-|LI-RT-/.test(readFileSync(join(PRIV, 'linkedin-surge.json'), 'utf8')), 'the new token is sealed too');
  const L6 = (await E.call('create', { client: 'surge', targets: ['li'], li: 'After the refresh.', ...mt(NOW + 54 * 86400 + 3600) })).id; await A.call('approve', { id: L6 });
  licalls = []; await runner(iso(NOW + 54 * 86400 + 3660));
  ok(state().posts[L6].status === 'published' && licalls.find((x) => x.path === 'rest/posts').h.authorization === 'Bearer LI-AT-2' && !licalls.some((x) => x.path === 'oauth/accessToken'), 'the next post uses the new token (no second refresh)');
  /* a refused refresh: Needs reconnecting, one email */
  liFail = { refresh: true }; const m1 = mails().length; licalls = [];
  await runner(iso(NOW + 109 * 86400)); await runner(iso(NOW + 109 * 86400 + 300)); liFail = {};
  d = await A.call('data', null, '&client=surge');
  ok(sv(d).state === 'reconnect' && /refresh was refused/.test(sv(d).last.text), 'refresh refused: the page says "Needs reconnecting"');
  const rm = mails().slice(m1).filter((m) => /LinkedIn needs reconnecting for Surge/.test(m.subject));
  ok(rm.length === 1 && /Connect LinkedIn/.test(rm[0].body) && !TOK.test(rm[0].body), 'one email to Matthew to reconnect, no token');
  const L7 = (await E.call('create', { client: 'surge', targets: ['li'], li: 'Needs a sign-in.', ...mt(T1 + 9000) })).id;
  r = await A.call('approve', { id: L7 }); ok(r._status === 409 && /LinkedIn needs reconnecting/.test(r.error), 'a LinkedIn post cannot be approved until it is reconnected');

  /* the laptop loader: a LinkedIn-only manifest item, words alone */
  writeFileSync(join(MD, 'li.json'), JSON.stringify([{ brand: 'surge', targets: ['li'], ...mt(T1 + 30000), li_caption: 'Loaded for LinkedIn.', li_comment: 'Link: https://surgeftw.com/', note: 'from a manifest' }]));
  t1 = await tool(['import', join(MD, 'li.json')]);
  { const lp = Object.values(state().posts).find((p) => p.li === 'Loaded for LinkedIn.'); ok(/1 loaded/.test(t1.out) && lp && lp.targets.join() === 'li' && lp.li_comment === 'Link: https://surgeftw.com/' && lp.status === 'draft' && !lp.images.length, 'pc.mjs import: a LinkedIn-only item loads as a draft with its words and first comment'); }
  t1 = await tool(['import', join(MD, 'li.json')]); ok(/0 loaded, 1 already there/.test(t1.out), 'imported again: nothing twice');
  /* nothing secret anywhere */
  const files = ['state.json', 'events.log', 'runner.log'].map((f) => existsSync(join(SITE, 'post-calendar-data', f)) ? readFileSync(join(SITE, 'post-calendar-data', f), 'utf8') : '');
  ok(files.every((t) => !TOK.test(t)) && !TOK.test(readFileSync(MAIL, 'utf8')) && !TOK.test(JSON.stringify(await A.call('data', null, '&client=surge'))) && !TOK.test(JSON.stringify(await E.call('data', null, '&client=surge'))), 'no LinkedIn token or secret in the state, the logs, the emails or any page data');
  /* disconnect */
  r = await A.call('lidisconnect', { id: 'surge' }); ok(r.ok && r.li.state === 'none' && JSON.parse(readFileSync(join(PRIV, 'linkedin-surge.json'), 'utf8')).conn === null, 'Disconnect: the tokens are deleted from the server');
  ok((await runPhp(['unhold', 'surge', 'fb,ig'])).code === 0 && !Object.keys(state().clients.surge.holds).length, 'unhold lifts it (Matthew\'s word only, from the server)');
}

console.log('designed cards: Change photo, and photos on a change request (2026-11-19)');
{
  const MEDIA = join(SITE, 'public_html', PUB, 'media'), REQD = join(SITE, 'post-calendar-data', 'reqphotos');
  const inMedia = (f) => !!f && existsSync(join(MEDIA, f)); const pcOpen = (p) => (p.requests || []).some((r) => !r.answered);
  const JC = (await runPhp(['addaccount', 'Jen Cards', 'client', '--clients', 'sixfold', '--code-only'])).out.trim();
  const J = client(); await J.call('signin', { code: JC });
  const recipe = { tpl: 'sixfold-card', title: 'Test card', src: 'test', w: 1080, h: 1350, box: [0, 0, 1080, 1350], base: '#2F5D2C', tint: [20, 40, 19], dim: 0.5 };
  const LAYER = png(1080, 1350);
  const cardset = (who, id, rec = recipe, layer = LAYER, extra = {}) => { const fd = new FormData(); fd.append('id', id); fd.append('recipe', typeof rec === 'string' ? rec : JSON.stringify(rec)); for (const [k, v] of Object.entries(extra)) fd.append(k, String(v)); fd.append('overlay', new Blob([layer], { type: 'image/png' }), 'layer.png'); return who.call('cardset', fd); };
  const cardup = (who, id, pos, bg) => { const fd = new FormData(); fd.append('id', id); fd.append('replace', '0'); fd.append('cardpos', JSON.stringify(pos)); fd.append('file', new Blob([png(1080, 1350)], { type: 'image/png' }), 'card.png'); if (bg) fd.append('cardbg', new Blob([bg], { type: 'image/png' }), 'photo.png'); return who.call('upload', fd); };
  const CP = await mk('sixfold', { fb: 'card words', ig: 'card ig', targets: ['fb', 'ig'], date: '2028-02-08', time: '15:00' });
  const SGc = await mk('surge', { fb: 'Surge card', targets: ['fb'], date: '2028-02-08', time: '15:00' });
  const cp0 = state().posts[CP], fp0 = (await A.call('data', null, '&client=sixfold')).posts.find((p) => p.id === CP).fingerprint;
  /* setting a recipe: the editor or Matthew only, checked, picture and approval untouched */
  let j = await cardset(J, CP); ok(j._status === 403 && !state().posts[CP].card, 'a client sign-in cannot set up a card recipe');
  j = await cardset(E, CP, '{"tpl":"Bad Name!"}'); ok(j._status === 400, 'a recipe that does not look right is refused');
  j = await cardset(E, CP, recipe, png(800, 1000)); ok(j._status === 400 && /size of the card/.test(j.error), 'a layer that is not the card\'s size is refused');
  j = await cardset(E, CP, recipe, LAYER, { expect_md5: '0'.repeat(32) }); ok(j._status === 409 && !state().posts[CP].card, 'a recipe for a different picture is refused');
  await A.call('approve', { id: CP, fingerprint: fp0 });
  j = await cardset(E, CP, recipe, LAYER, { expect_md5: cp0.images[0].md5 });
  let cp = state().posts[CP];
  ok(j.ok && cp.card && cp.card.tpl === 'sixfold-card' && cp.card.orig.file === cp0.images[0].file && inMedia(cp.card.overlay.file), 'the editor sets the recipe: the layer stored, the original card remembered');
  ok(cp.status === 'approved' && j.post.fingerprint === fp0 && cp.images[0].file === cp0.images[0].file, 'setting a recipe changes no picture, no words and no approval');
  ok((await cardset(A, SGc, recipe)).ok, 'Matthew can set a recipe too (a Surge card)');
  /* Change photo: a picture change like any other */
  const BG1 = png(1600, 1200);
  j = await cardup(J, CP, { x: 0.3, y: 2, zoom: 9, dim: 0.4 }, BG1); cp = state().posts[CP];
  ok(j.ok && cp.status === 'draft' && !cp.approval && cp.images[0].file !== cp0.images[0].file, 'she saves the card with her photo: the picture is replaced and the approval drops');
  ok(cp.card.bg && inMedia(cp.card.bg.file) && cp.card.bg.w === 1600 && cp.card.made === cp.images[0].md5, 'the photo is kept with the card');
  ok(cp.card.pos.x === 0.3 && cp.card.pos.y === 1 && cp.card.pos.zoom === 4 && cp.card.pos.dim === 0.4, 'where the photo sits is kept, inside its limits');
  ok(inMedia(cp0.images[0].file), 'the original card\'s file stays on the server');
  ok(cp.log.some((l) => l.by === 'Jen Cards' && l.what === 'Card photo changed') && cp.log.some((l) => /Approval dropped/.test(l.what)), 'the log says who changed the card photo and that the approval dropped');
  const bg1 = cp.card.bg.file, made1 = cp.images[0].file;
  j = await cardup(J, CP, { x: 0.5, y: 0.6, zoom: 1.2, dim: 0.5 }); cp = state().posts[CP];
  ok(j.ok && cp.card.bg.file === bg1 && cp.card.pos.zoom === 1.2 && !inMedia(made1), 'moving the photo keeps it; the card drawn before goes');
  j = await cardup(J, CP, { x: 0.5, y: 0.5, zoom: 1, dim: 0.5 }, png(1200, 1600)); cp = state().posts[CP];
  ok(j.ok && cp.card.bg.file !== bg1 && !inMedia(bg1), 'a new photo replaces the old one, and the old photo\'s file goes');
  const fd0 = new FormData(); fd0.append('id', CP); fd0.append('replace', '0'); fd0.append('cardpos', '{}'); fd0.append('file', new Blob([png(1080, 1350)], { type: 'image/png' }), 'c.png'); fd0.append('cardbg', new Blob([Buffer.from('not a picture')], { type: 'image/png' }), 'x.png');
  const files0 = readdirSync(MEDIA).length; j = await J.call('upload', fd0); ok(j._status === 400 && /^The photo:/.test(j.error) && readdirSync(MEDIA).length === files0, 'a photo that is not a picture is refused, nothing kept');
  /* a plain Replace keeps the recipe and the original; then Put the original card back */
  j = await J.up(CP, png(1080, 1080), { replace: 0 }); ok(j.ok && j.post.card && inMedia(cp0.images[0].file), 'a plain Replace leaves the recipe and the original card');
  const bg2 = state().posts[CP].card.bg.file, plain = state().posts[CP].images[0].file;
  await A.call('approve', { id: CP, fingerprint: j.post.fingerprint });
  j = await J.call('cardorig', { id: CP }); cp = state().posts[CP];
  ok(j.ok && cp.images[0].file === cp0.images[0].file && cp.card.bg === null && cp.status === 'draft' && !cp.approval, 'Put the original card back: the first card again, back to draft');
  ok(!inMedia(bg2) && !inMedia(plain) && cp.log.some((l) => l.what === 'Original card put back'), 'the photo and the replaced picture go; the log says so');
  ok((await J.call('cardorig', { id: CP }))._status === 409, 'the original is already there: refused');
  /* scope and refusals */
  ok((await cardup(J, SGc, { x: 0.5 }, BG1))._status === 404 && (await J.call('cardorig', { id: SGc }))._status === 404, 'Change photo on a Surge card: no such post for her');
  const PNC = await mk('sixfold', { fb: 'plain', ig: 'plain', targets: ['fb', 'ig'], date: '2028-02-10', time: '15:00' });
  j = await cardup(J, PNC, { x: 0.5 }, BG1); ok(j._status === 409 && /no designed card/.test(j.error), 'a post without a recipe has no Change photo');
  /* photos on a change request */
  const rqfd = (id, text, bufs) => { const fd = new FormData(); fd.append('id', id); fd.append('text', text); bufs.forEach((b, i) => fd.append('photos[]', new Blob([b], { type: 'image/png' }), 'p' + i + '.png')); return fd; };
  j = await J.call('request', rqfd(CP, 'Use my photo as the background', [png(1400, 1050), png(900, 1200)])); cp = state().posts[CP];
  const rph = cp.requests[cp.requests.length - 1].photos || [];
  ok(j.ok && cp.status === 'changes' && rph.length === 2 && rph.every((x) => existsSync(join(REQD, x.file)) && !inMedia(x.file)), 'she sends a request with 2 photos: kept privately, not in the public folder');
  ok(cp.log.some((l) => /\(\+2 photos\)$/.test(l.what)), 'the log counts the photos');
  let res = await fetch(ORIGIN + '/' + PUB + '/api/cal.php?action=reqphoto&post=' + CP + '&f=' + rph[0].file, { headers: { Cookie: J.ck() } });
  ok(res.status === 200 && /image\/png/.test(res.headers.get('content-type')) && Buffer.from(await res.arrayBuffer()).length === rph[0].bytes, 'she (and anyone who can see the post) can open a request photo');
  res = await fetch(ORIGIN + '/' + PUB + '/api/cal.php?action=reqphoto&post=' + CP + '&f=' + rph[0].file); ok(res.status === 401, 'signed out: no request photo');
  res = await fetch(ORIGIN + '/' + PUB + '/api/cal.php?action=reqphoto&post=' + PNC + '&f=' + rph[0].file, { headers: { Cookie: J.ck() } }); ok(res.status === 404, 'a photo asked for through another post: no such photo');
  ok(!existsSync(join(SITE, 'public_html', PUB, 'reqphotos')) && !readdirSync(join(SITE, 'public_html', PUB)).some((f) => rph.some((x) => x.file === f)), 'request photos are nowhere under public_html');
  const rqj = JSON.parse((await runPhp(['requests', 'sixfold'])).out).find((x) => x.post === CP);
  ok(rqj && rqj.photos.length === 2 && /action=reqphoto&post=/.test(rqj.photos[0].path) && rqj.card && rqj.card.tpl === 'sixfold-card' && rqj.card.hasPhoto === false, 'the open request lists its photos and the card recipe for the watcher');
  await A.call('request', { id: SGc, text: 'Surge request' });
  const media1 = readdirSync(MEDIA).length, req1 = existsSync(REQD) ? readdirSync(REQD).length : 0;
  j = await J.call('request', rqfd(SGc, 'x', [png(400, 400)])); ok(j._status === 404 && readdirSync(REQD).length === req1, 'a request with photos on a Surge post: 404 and no photo kept');
  j = await J.call('request', rqfd(PNC, 'too many', [png(400, 400), png(400, 400), png(400, 400), png(400, 400)])); ok(j._status === 400 && /at most 3/.test(j.error) && readdirSync(REQD).length === req1, 'more than 3 photos: refused, nothing kept');
  j = await J.call('request', rqfd(PNC, 'bad', [png(400, 400), Buffer.from('nope')])); ok(j._status === 400 && readdirSync(REQD).length === req1 && readdirSync(MEDIA).length === media1, 'a request photo that is not a picture: refused, nothing kept');
  ok((await E.call('request', rqfd(PNC, 'x', [png(400, 400)])))._status === 403, 'the editor cannot request changes, photos or not');
  /* the laptop: pc.mjs photos, answer --card-bg, card, import with a recipe */
  writeFileSync(join(T, 'editor-code.txt'), EDITOR);
  const OUTD = join(T, 'reqout');
  t1 = await tool(['photos', CP, '--out', OUTD]);
  ok(t1.code === 0 && readdirSync(OUTD).length === 2 && readFileSync(join(OUTD, 'request-photo-1.png')).length === rph[0].bytes, 'pc.mjs photos saves the request\'s photos');
  writeFileSync(join(T, 'bg.png'), png(1600, 1200));
  t1 = await tool(['answer', CP, '--card-bg', join(T, 'bg.png'), '--zoom', '1.5', '--x', '0.2', '--dim', '0.6', '--card-out', join(T, 'look.jpg'), '--note', 'Your photo is on the card']); cp = state().posts[CP];
  ok(t1.code === 0 && cp.status === 'draft' && !pcOpen(cp) && cp.card.bg && cp.card.pos.zoom === 1.5 && cp.card.pos.x === 0.2 && cp.card.pos.dim === 0.6 && cp.note === 'Your photo is on the card', 'pc.mjs answer --card-bg: the card drawn with the photo, the request answered, back to draft' + (t1.code ? ': ' + t1.out : ''));
  ok(cp.images[0].w === 1080 && cp.images[0].h === 1350 && existsSync(join(T, 'look.jpg')) && cp.card.bg.w === 1600, 'the card is 1080 x 1350; the photo kept as it came, at most 2160 px');
  { const before = JSON.stringify(state().posts[CP]); t1 = await tool(['look', CP, '--card-bg', 'keep', '--zoom', '2', '--card-out', join(T, 'look2.jpg')]);
    ok(t1.code === 0 && existsSync(join(T, 'look2.jpg')) && JSON.stringify(state().posts[CP]) === before, 'pc.mjs look draws the card to a file and sends nothing'); }
  await J.call('request', { id: CP, text: 'Put the old card back' });
  t1 = await tool(['answer', CP, '--card-orig']); cp = state().posts[CP];
  ok(t1.code === 0 && cp.images[0].file === cp0.images[0].file && !pcOpen(cp) && cp.status === 'draft', 'pc.mjs answer --card-orig puts the original back and answers');
  t1 = await tool(['answer', PNC, '--card-bg', join(T, 'bg.png')]); ok(t1.code !== 0 && /not a designed card/.test(t1.out), 'pc.mjs answer --card-bg on a post with no recipe: refused');
  /* a recipe file, as the build scripts write it, on an existing post (backfill) and through import */
  writeFileSync(join(MD, 'k.png'), IMG); writeFileSync(join(MD, 'k.layer.png'), LAYER);
  writeFileSync(join(MD, 'k.card.json'), JSON.stringify({ ...recipe, overlay: 'k.layer.png', card: 'k.png' }));
  t1 = await tool(['card', PNC, join(MD, 'k.card.json')]); const pn = state().posts[PNC];
  ok(t1.code === 0 && pn.card && pn.card.orig.file === pn.images[0].file && pn.status === 'draft', 'pc.mjs card sets a recipe on a loaded post (same picture bytes)');
  writeFileSync(join(MD, 'other.png'), png(1080, 1349)); writeFileSync(join(MD, 'o.card.json'), JSON.stringify({ ...recipe, overlay: 'k.layer.png', card: 'other.png' }));
  const PNO = await mk('sixfold', { fb: 'o', ig: 'o', targets: ['fb'], date: '2028-02-12', time: '15:00' });
  t1 = await tool(['card', PNO, join(MD, 'o.card.json')]); ok(t1.code !== 0 && !state().posts[PNO].card, 'pc.mjs card refuses when the post\'s picture is not the recipe\'s card');
  writeFileSync(join(MD, 'card-manifest.json'), JSON.stringify([{ brand: 'sixfold', date: '2028-02-15', time: '15:00', targets: ['fb', 'ig'], image: 'k.png', card: 'k.card.json', fb_caption: 'imported card', ig_caption: 'imported card' }]));
  t1 = await tool(['import', join(MD, 'card-manifest.json')]); const ic = Object.values(state().posts).find((p) => p.fb === 'imported card');
  ok(/1 loaded/.test(t1.out) && ic && ic.card && ic.card.tpl === 'sixfold-card' && ic.status === 'draft', 'import: a manifest item with a recipe loads with Change photo set up');
  /* nothing approved itself */
  ok(!Object.values(state().posts).some((p) => [CP, PNC, PNO, ic && ic.id].includes(p.id) && p.status === 'approved'), 'none of these posts is approved by the tools');
}

/* 21 Nov: roll forward (Matthew: "dont get rid of post that havent been posted yet, instead keep moving the schedule further and further") */
console.log('roll forward');
{
  const now = Math.floor(Date.now() / 1000), W = 7 * 86400;
  const PA = await mk('surge', { fb: 'roll A', targets: ['fb'] }), PB = await mk('surge', { fb: 'roll B', targets: ['fb'] }), PU = await mk('surge', { fb: 'roll undated', targets: ['fb'] });
  const raw = state(); const A0 = now - 3 * 86400, B0 = now + 4 * 86400; raw.posts[PA].at = A0; raw.posts[PB].at = B0; raw.posts[PU].at = 0;
  writeFileSync(join(SITE, 'post-calendar-data', 'state.json'), JSON.stringify(raw));
  const fixed = Object.values(raw.posts).filter((p) => p.client !== 'surge' || !['draft', 'approved'].includes(p.status)).map((p) => [p.id, p.at, p.status]);
  ok((await runPhp(['roll', 'surge', 'on'])).code !== 0, 'roll on needs a reason');
  const rr = await runPhp(['roll', 'surge', 'on', 'Matthew 21 Nov: waiting on the Surge sign-ins'], { PC_NOW: String(now) });
  const s1 = state(), dA = s1.posts[PA].at - A0, dB = s1.posts[PB].at - B0;
  ok(rr.code === 0 && /rolling forward: surge/.test(rr.out) && dA > 0 && dA === dB && Math.abs(dA % W) <= 3600 && s1.posts[PA].at >= now + 86400 - 3600, 'roll on: the waiting posts move forward together by whole weeks, the earliest past tomorrow (' + rr.out.trim() + ')');
  ok(s1.posts[PU].at === 0 && Object.values(s1.posts).length === Object.values(raw.posts).length, 'nothing deleted; an undated draft stays undated');
  ok(fixed.every(([id, at, st]) => s1.posts[id].at === at && s1.posts[id].status === st), 'other clients and published, failed or publishing posts are never moved');
  ok(/Moved forward \d+ weeks?, from .* to .*: Matthew 21 Nov: waiting on the Surge sign-ins/.test(s1.posts[PA].log.at(-1).what), 'each move is written in the post\'s history');
  await runner(new Date(now * 1000).toISOString()); ok(state().posts[PA].at === s1.posts[PA].at, 'the next run: already ahead, nothing moves');
  await runner(new Date((s1.posts[PA].at - 3600) * 1000).toISOString()); const s2 = state();
  ok(s2.posts[PA].at - s1.posts[PA].at === s2.posts[PB].at - s1.posts[PB].at && s2.posts[PA].at > s1.posts[PA].at && s2.posts[PA].status === 'draft', 'the runner keeps moving them as each date comes close, never posting them');
  { const pr = await runPhp(['pin', PB, 'on', 'Matthew 21 Nov: keep the Thanksgiving posts for Thanksgiving']); const pb0 = state().posts[PB].at, pa0 = state().posts[PA].at;
    await runner(new Date((pa0 - 3600) * 1000).toISOString()); const s3 = state();
    ok(pr.code === 0 && s3.posts[PB].at === pb0 && s3.posts[PA].at > pa0 && /Keeps its date/.test(s3.posts[PB].log.map((l) => l.what).join('|')), 'a pinned post keeps its date while the rest roll on');
    ok((await runPhp(['pin', PB, 'on'])).code !== 0 && (await runPhp(['pin', 'pnope', 'on', 'x'])).code !== 0 && (await runPhp(['pin', PB, 'off'])).code === 0 && !state().posts[PB].pinned, 'pin needs a reason and a real post; off un-pins'); }
  ok((await runPhp(['roll', 'surge', 'off'])).code === 0, 'roll off');
  { const pa1 = state().posts[PA].at; await runner(new Date((pa1 - 3600) * 1000).toISOString()); ok(state().posts[PA].at === pa1, 'off: they stay where they are'); }
}

console.log('J.A.R.V.I.S. chat (2026-11-21)');
{
  const jv = (args, input = '', extra = {}) => new Promise((r) => { const p = execFile('php', [join(SITE, 'jv-tools', 'jv.php'), 'posts', ...args], { env: { ...env, JV_SITE: SITE, PC_LIB: join(SITE, 'post-calendar-tools', 'lib.php'), ...extra } }, (e, so, se) => r({ code: e ? e.code : 0, out: so, err: se })); p.stdin.end(input); });
  const JVC = (await runPhp(['addaccount', 'Jen Chat', 'client', '--clients', 'sixfold', '--code-only'])).out.trim();
  const JJ = client(); await JJ.call('signin', { code: JVC });
  const AA = client(); await AA.call('signin', { code: ADMIN });
  const EE = client(); await EE.call('signin', { code: EDITOR });
  ok((await X.call('jvlist'))._status === 401, 'chat: signed out is refused');
  let j = await JJ.call('jvsend', { text: 'Please change the Facebook words on the Fallen leaves post' });
  ok(j.ok && /^h\d{14}[0-9a-f]{4}$/.test(j.ticket.id) && j.ticket.msgs[0].mine === true && j.ticket.status === 'new', 'chat: a client sign-in starts a conversation');
  const TJ = j.ticket.id;
  ok(!JSON.stringify(j).includes('acct') && !JSON.stringify(j).includes('scope'), 'chat: the page never gets the account key or scope');
  ok((await JJ.call('jvsend', { text: 'x' }))._status === 400, 'chat: an empty message is refused');
  j = await EE.call('jvsend', { text: 'Editor question' }); const TE = j.ticket.id;
  ok((await JJ.call('jvlist')).tickets.map((t) => t.id).join() === TJ, 'chat: Jen sees only her own conversation');
  ok((await EE.call('jvlist')).tickets.map((t) => t.id).join() === TE, 'chat: the editor sees only its own');
  const al = await AA.call('jvlist'); ok(al.admin === true && [TJ, TE].every((id) => al.tickets.some((t) => t.id === id)), "chat: Matthew's admin sign-in sees everyone's");
  ok((await JJ.call('jvsend', { id: TE, text: 'sneaking into another chat' }))._status === 404, "chat: writing into someone else's conversation answers no such");
  ok((await JJ.call('jvclose', { id: TE }))._status === 404, "chat: closing someone else's conversation answers no such");
  const PHOTO = IMG.toString('base64');
  j = await JJ.call('jvsend', { id: TJ, text: 'Use this photo', photos: [PHOTO] }); const pn = j.ticket.msgs.at(-1).photos[0].n;
  ok(j.ok && /^p\d{10}[0-9a-f]{6}\.png$/.test(pn), 'chat: a photo goes with a message');
  let r = await fetch(ORIGIN + '/' + PUB + '/api/cal.php?action=jvfile&id=' + TJ + '&f=' + pn, { headers: { Cookie: JJ.ck() } });
  ok(r.status === 200 && r.headers.get('content-type') === 'image/png', 'chat: the writer opens her photo');
  r = await fetch(ORIGIN + '/' + PUB + '/api/cal.php?action=jvfile&id=' + TJ + '&f=' + pn, { headers: { Cookie: EE.ck() } });
  ok(r.status === 404, "chat: someone else can't open it");
  ok((await JJ.call('jvsend', { text: 'bad', photos: ['bm90IGEgcGljdHVyZQ=='] }))._status === 400, 'chat: a file that is not a picture is refused');
  /* the watcher's side */
  ok((await jv(['count'])).out.trim() === '2', 'jv.php count: two waiting');
  const pk = JSON.parse((await jv(['next', '--peek'])).out); ok(pk.app === 'posts' && pk.conversation.length >= 1 && !JSON.stringify(pk).includes('acct'), 'jv.php next --peek: the oldest, no account key');
  ok((await jv(['act', TJ, 'list'])).code === 3, 'act: refused while the conversation is not being worked on');
  let nx = JSON.parse((await jv(['next'])).out); if (nx.id !== TJ) nx = JSON.parse((await jv(['next'])).out);
  ok(nx.id === TJ, 'jv.php next: takes it (working)');
  let L = JSON.parse((await jv(['act', TJ, 'list'])).out);
  ok(L.person === 'Jen Chat' && L.posts.length > 0 && L.posts.every((p) => p.client === 'sixfold'), "act list: only the writer's own client's posts");
  const sur = Object.values(state().posts).find((p) => p.client === 'surge' && p.status !== 'removed');
  ok(sur && (await jv(['act', TJ, 'show', sur.id])).code === 3, "act: another client's post answers no such");
  const six = Object.values(state().posts).find((p) => p.client === 'sixfold' && p.status === 'draft' && !p.card && !(p.images || []).some((i) => i.kind === 'video'));
  r = await jv(['act', TJ, 'edit', six.id, 'fb'], 'New words from the chat');
  let st = state().posts[six.id];
  ok(r.code === 0 && st.fb === 'New words from the chat' && /Jen Chat \(by J\.A\.R\.V\.I\.S\.\)/.test(st.log.at(-1).by), 'act edit: the words change, the history says by J.A.R.V.I.S.');
  r = await jv(['act', TJ, 'date', six.id, '2027-12-07', '15:00']); st = state().posts[six.id];
  ok(r.code === 0 && st.at === ts('2027-12-07T15:00:00-07:00'), 'act date: the date and time change (Colorado time)');
  ok((await jv(['act', TJ, 'date', six.id, '2020-01-01', '15:00'])).code === 3, 'act date: a time in the past is refused');
  r = await jv(['act', TJ, 'photo', six.id, pn]); st = state().posts[six.id];
  ok(r.code === 0 && st.images.length === 1 && /sent in the J\.A\.R\.V\.I\.S\. chat/.test(st.log.at(-1).what), 'act photo: a photo from the chat becomes the picture');
  ok((await jv(['act', TJ, 'photo', six.id, 'p1234567890abcdef.png'])).code === 3, 'act photo: a photo not from this conversation is refused');
  for (const bad of ['approve', 'publish', 'remove', 'hold', 'roll', 'pin', 'connect']) ok((await jv(['act', TJ, bad, six.id])).code === 3, 'act: ' + bad + ' is refused (goes to Matthew)');
  /* an approved post: an edit drops the approval, never approves */
  const raw = state(); raw.posts[six.id].status = 'approved'; raw.posts[six.id].approval = { by: 'Jen Chat', at: 1, hash: 'x' }; writeFileSync(join(SITE, 'post-calendar-data', 'state.json'), JSON.stringify(raw));
  r = await jv(['act', TJ, 'edit', six.id, 'ig'], 'IG from the chat'); st = state().posts[six.id];
  ok(r.code === 0 && st.status === 'draft' && st.approval === null && JSON.parse(r.out).approvalDropped === true, 'act on an approved post: back to draft for her tap (never approves)');
  const raw2 = state(); raw2.posts[six.id].pinned = { why: 'test', at: 1 }; writeFileSync(join(SITE, 'post-calendar-data', 'state.json'), JSON.stringify(raw2));
  ok((await jv(['act', TJ, 'date', six.id, '2027-12-08', '15:00'])).code === 3, "act date: a pinned post's date is refused");
  const raw3 = state(); delete raw3.posts[six.id].pinned; raw3.posts[six.id].status = 'published'; writeFileSync(join(SITE, 'post-calendar-data', 'state.json'), JSON.stringify(raw3));
  ok((await jv(['act', TJ, 'edit', six.id, 'fb'], 'late')).code === 3, 'act: a published post is refused');
  const raw4 = state(); raw4.posts[six.id].status = 'draft'; writeFileSync(join(SITE, 'post-calendar-data', 'state.json'), JSON.stringify(raw4));
  /* the reply */
  const t0 = Math.floor(Date.now() / 1000);
  r = await jv(['reply', TJ, 'answered', 'refresh'], 'Done. Refresh the page.');
  ok(r.code === 0 && (await jv(['final-since', TJ, String(t0)])).code === 0, 'jv.php reply + final-since');
  j = await JJ.call('jvlist'); const last = j.tickets[0].msgs.at(-1);
  ok(j.tickets[0].status === 'answered' && last.jarvis && last.refresh && last.text === 'Done. Refresh the page.', 'chat: the reply shows with Refresh now');
  ok((await jv(['act', TJ, 'list'])).code === 3, 'act: refused once the conversation is answered');
  ok((await jv(['reply', TJ, 'approved'], 'x')).code !== 0, 'jv.php reply: only answered, matthew or working');
  ok((await JJ.call('jvclose', { id: TJ })).ok && (await JJ.call('jvlist')).tickets[0].status === 'closed', 'chat: Clear closes it');
  /* Surge is held: dates on a held client are Matthew's */
  j = await AA.call('jvsend', { text: 'Move a Surge post' }); const TA = j.ticket.id; await jv(['next']); await jv(['next']);
  const sd = Object.values(state().posts).find((p) => p.client === 'surge' && p.status === 'draft');
  const hs = state(); hs.clients.surge.holds = { fb: { why: 'test' } }; writeFileSync(join(SITE, 'post-calendar-data', 'state.json'), JSON.stringify(hs));
  ok(!sd || (await jv(['act', TA, 'date', sd.id, '2027-12-09', '15:00'])).code === 3, "act date: a held client's dates are refused even for Matthew's sign-in");
  const hs2 = state(); delete hs2.clients.surge.holds; writeFileSync(join(SITE, 'post-calendar-data', 'state.json'), JSON.stringify(hs2));
}

console.log('check (read-only)');
t1 = await runPhp(['check']);
ok(/Sixfold 365 \(1418675127985724\) Instagram @365aeration -> sixfold/.test(t1.out) && /Surge Inc \(1323606360836132\) no Instagram -> surge/.test(t1.out) && !/PT-|PIPE-TOKEN/.test(t1.out), 'check lists the Pages, which client holds each, no tokens');
calls = []; await runPhp(['check']); ok(calls.every((x) => x.m === 'GET'), 'check only reads');

php.kill(); graph.close(); lisrv.close();
try { rmSync(T, { recursive: true, force: true }); } catch {}
console.log(`\n${pass} passed, ${failN} failed`);
if (failN) { console.log(fails.map((f) => ' - ' + f).join('\n')); process.exitCode = 1; }
