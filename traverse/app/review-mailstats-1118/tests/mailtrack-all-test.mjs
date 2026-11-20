/* Opens and clicks for every automatic email (2026-11-20, Matthew: "I want to track everything we can data is key"): api/mailtrack-lib.php,
   the tracker m/index.php finding sends in every store, and the senders that use them (the client installs' care emails, the notes to Matthew,
   the website's demo emails, the post calendar alert). One throwaway copy of the server's layout in a temp folder; NOTHING is sent: the care
   email goes to a mock file, every other sender is pointed at a closed port on this computer (so its send fails and is noted as failed), and
   the message each would have sent is built by its own function and read here. Fresh data every run:
     node traverse/app/review-mailstats-1118/tests/mailtrack-all-test.mjs */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), APP = path.resolve(HERE, '..', '..'), REPO = path.resolve(APP, '..', '..');
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; return ok; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = fs.mkdtempSync(path.join(os.tmpdir(), 'mtall-')), PUB = path.join(R, 'public_html');
const PT = 18900 + Math.floor(Math.random() * 300), TR = 'http://127.0.0.1:' + PT;
const mk = (rel, s) => { const f = path.join(R, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const rd = (rel) => { try { return fs.readFileSync(path.join(R, rel), 'utf8'); } catch { return ''; } };
const jl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const lines = (rel) => rd(rel).split('\n').filter(Boolean).map((l) => JSON.parse(l));
const NOW = Math.floor(Date.now() / 1000);
const php = (code, env = {}) => { const r = spawnSync('php', ['-r', code], { encoding: 'utf8', env: { ...process.env, ...env } }); return (r.stdout || '') + (r.stderr || ''); };
const json = (s) => { try { return JSON.parse(s.slice(s.indexOf('{'))); } catch { return { raw: s.slice(0, 400) }; } };
const LIB = path.join(PUB, 'api', 'mailtrack-lib.php').replace(/\\/g, '/');
const MT = 'traverse-shared/mailtrack';
let srv = null;

/* ---- the layout ---- */
fs.mkdirSync(path.join(PUB, 'api'), { recursive: true });
for (const f of fs.readdirSync(path.join(APP, 'api'))) if (f.endsWith('.php')) fs.copyFileSync(path.join(APP, 'api', f), path.join(PUB, 'api', f));
mk('public_html/m/index.php', fs.readFileSync(path.join(APP, 'mailtrack', 'index.php')));
for (const f of ['_lib.php', 'api.php', 'manage.php']) mk('public_html/demo/' + f, fs.readFileSync(path.join(REPO, 'traverse', 'marketing-site', 'site-src', 'demo', f)));
for (const f of ['lib.php', 'linkedin.php']) mk('post-calendar-tools/' + f, fs.readFileSync(path.join(REPO, 'traverse', 'post-calendar', 'server', f)));
mk('post-calendar-tools/public-path.txt', 'posts-test');
mk('sixfold-data/rounds/company.json', JSON.stringify({ name: 'Test Lawn Co', short: 'Test Lawn', phone: '(555) 010-0100', email: 'office@example.com', features: { walkdesk: true } }));   /* an edition: a365 null */
mk('sixfold-data/rounds/index.json', '{"regions":[]}');
mk('sixfold-private/mail.json', JSON.stringify({ user: 'office@example.com', pass: 'not-a-password', host: '127.0.0.1', port: 1, from: 'office@example.com' }));
mk('sixfold-private/rounds-codes.php', "<?php\nreturn ['session_key' => '" + 'a'.repeat(64) + "', 'session_days' => 45, 'people' => ['583921' => ['Pat Admin', 'admin']]];\n");
mk('traverse-site-private/site-config.php', "<?php return ['smtp' => ['host' => '127.0.0.1', 'port' => 1, 'pass' => 'not-a-password', 'timeout' => 3]];");   /* a closed port: nothing can leave */
fs.mkdirSync(path.join(R, 'sixfold-data', 'digest'), { recursive: true });

try {
  /* 1. the library */
  let o = json(php(`require '${LIB}';
    $d = mtTraverseDir(); $text = "Finish here: https://traverseplatforms.com/start/welcome/?c=c1234abcd&cs=SECRETKEY\\nOur site: https://traverseplatforms.com/\\nThe app: https://traverseplatforms.com/hl-f98938/\\nUnsubscribe: https://x.example/api/r.php?action=nlunsub&t=1";
    $a = mtTrack($d, 'signup', $text, '', ['v' => 'finish', 'wrap' => 'mtSitePage']);
    $b = mtTrack($d, 'notes', "A note <b>x</b> & more", '', ['src' => 'trv']);
    $c = mtTrack('${LIB}' . '/cannot/be/a/folder', 'notes', 'plain', '');
    $e = mtTrack($d, 'eod', 'Report text', '<html><body><p>Hi</p></body></html>');
    [$mb, $ct] = mtMime('plain words', '<p>html words</p>');
    echo json_encode(['a' => $a, 'b' => $b, 'c' => $c, 'e' => $e, 'mb' => $mb, 'ct' => $ct, 'dir' => $d,
      'site' => [mtSitePage('https://traverseplatforms.com/'), mtSitePage('https://traverseplatforms.com/demo/'), mtSitePage('https://traverseplatforms.com/start/welcome/?c=1'), mtSitePage('https://traverseplatforms.com/hl-f98938/'), mtSitePage('https://traverseplatforms.com/demo/api.php'), mtSitePage('https://evil.example/'), mtSitePage('https://traverseplatforms.com/summit-de59ae83/')]]);`));
  t(o.dir && o.dir.replace(/\\/g, '/').endsWith('/traverse-shared/mailtrack'), 'Traverse\'s store is traverse-shared/mailtrack beside public_html');
  t(/^[0-9a-f]{20}$/.test(o.a.id) && o.a.html.includes('https://traverseplatforms.com/m/?o=' + o.a.id) && /<\/body><\/html>$/.test(o.a.html), 'a plain-text email gets an HTML copy with the open image at its end');
  t(o.a.text.includes('/start/welcome/?c=c1234abcd&cs=SECRETKEY') && o.a.html.includes('href="https://traverseplatforms.com/start/welcome/?c=c1234abcd&amp;cs=SECRETKEY"'), 'the setup link (with its key) is left exactly as it was, in both parts');
  t(o.a.text.includes('https://traverseplatforms.com/hl-f98938/') && !o.a.text.includes('?c=' + o.a.id + '.1'), 'the app\'s sign-in address is not wrapped');
  t(o.a.text.includes('Our site: https://traverseplatforms.com/m/?c=' + o.a.id + '.0') && o.a.html.includes('href="https://traverseplatforms.com/m/?c=' + o.a.id + '.0"') && o.a.html.includes('>https://traverseplatforms.com/</a>'), 'an ordinary website page is counted: the link goes through the tracker, the HTML still shows the plain address');
  t(o.a.text.includes('action=nlunsub&t=1') && !o.a.text.includes('.2'), 'an unsubscribe link is never wrapped');
  t(!o.b.html.includes('<b>x</b>') && o.b.html.includes('&lt;b&gt;x&lt;/b&gt; &amp; more') && o.b.text === 'A note <b>x</b> & more', 'the HTML copy escapes the words; the text part is unchanged');
  t(o.c.id === '' && o.c.html === '' && o.c.text === 'plain', 'when the note cannot be written nothing is changed (no image, no HTML copy)');
  t(o.e.html === '<html><body><p>Hi</p><img src="https://traverseplatforms.com/m/?o=' + o.e.id + '" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px"></body></html>', 'an HTML email keeps its HTML; the image goes just before </body>');
  t(/^Content-Type: multipart\/alternative; boundary="mta[0-9a-f]{16}"$/.test(o.ct) && o.mb.includes('Content-Type: text/plain') && o.mb.includes('Content-Type: text/html') && o.mb.includes(Buffer.from('<p>html words</p>').toString('base64')), 'mtMime: text + HTML alternative for smtp_send');
  t(JSON.stringify(o.site) === JSON.stringify([true, true, false, false, false, false, false]), 'mtSitePage: the site\'s own pages only (no setup, find, app, API or other host)');
  let S = lines(MT + '/mail-sends.log');
  const ra = S.find((r) => r.id === o.a.id), rb = S.find((r) => r.id === o.b.id);
  t(ra && ra.t === 'send' && ra.k === 'signup' && ra.v === 'finish' && JSON.stringify(ra.links) === JSON.stringify(['https://traverseplatforms.com/']) && !JSON.stringify(ra).includes('SECRETKEY'), 'the send is noted: kind, which one, the counted link only (never the setup key)');
  t(rb && rb.src === 'trv' && !('v' in rb) && JSON.stringify(rb.links) === '[]', 'a note: its install as src, no links');
  t(!rd(MT + '/mail-sends.log').includes('@'), 'no address in the log');

  /* 2. the tracker finds a send in every store */
  mk('c-acme-lawn-data/rounds/mail-sends.log', jl([{ t: 'send', id: 'c'.repeat(20), k: 'followup', at: NOW - 600, src: 'c9999', links: ['https://acme.example/tips'] }]));
  mk('sixfold-data/rounds/mail-sends.log', jl([{ t: 'send', id: 'f'.repeat(20), k: 'aftercare', at: NOW - 600, v: 'v0', links: ['https://365aeration.com/'] }]));
  fs.appendFileSync(path.join(R, MT, 'mail-sends.log'), jl([{ t: 'send', id: 'a'.repeat(20), k: 'demo-confirm', at: NOW - 600, links: ['https://traverseplatforms.com/demo/'] }]));
  srv = spawn('php', ['-S', '127.0.0.1:' + PT, '-t', PUB], { stdio: 'ignore' }); await sleep(900);
  const get = (p, ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120') => new Promise((res) => http.get(TR + p, { headers: { 'User-Agent': ua } }, (x) => { let b = ''; x.on('data', (d) => b += d); x.on('end', () => res({ status: x.statusCode, type: x.headers['content-type'] || '', loc: x.headers.location || '', text: b })); }));
  let r = await get('/m/?o=' + o.b.id); t(r.status === 200 && r.type.startsWith('image/gif'), 'open image answers for a Traverse send');
  r = await get('/m/?o=' + 'c'.repeat(20)); t(r.status === 200, 'open image answers for a client install send');
  r = await get('/m/?c=' + 'a'.repeat(20) + '.0'); t(r.status === 302 && r.loc === 'https://traverseplatforms.com/demo/', 'a counted link forwards to its own address');
  r = await get('/m/?c=' + 'c'.repeat(20) + '.0', 'Barracuda scanner'); t(r.status === 302 && r.loc === 'https://acme.example/tips', 'a scanner is forwarded too (and logged apart)');
  r = await get('/m/?c=' + 'f'.repeat(20) + '.0'); t(r.status === 302 && r.loc === 'https://365aeration.com/', 'Sixfold\'s own sends work as before');
  r = await get('/m/?c=' + 'a'.repeat(20) + '.7'); t(r.status === 404 && !/Sixfold|365/.test(r.text), 'a bad link number on a Traverse email: 404, a plain page naming no business');
  r = await get('/m/?c=' + 'b'.repeat(20) + '.0'); t(r.status === 404 && /Sixfold 365/.test(r.text), 'an id nobody sent: 404 as before');
  r = await get('/m/?c=https://evil.example/'); t(r.status === 404, 'no open redirect');
  const TE = lines(MT + '/mail-events.log'), CE = lines('c-acme-lawn-data/rounds/mail-events.log'), FE = lines('sixfold-data/rounds/mail-events.log');
  t(TE.some((e) => e.t === 'open' && e.id === o.b.id && e.k === 'notes' && e.src === 'trv') && TE.some((e) => e.t === 'click' && e.id === 'a'.repeat(20) && e.n === 0), 'Traverse events beside Traverse\'s sends (open with its src, click with its number)');
  t(CE.some((e) => e.t === 'open' && e.src === 'c9999') && CE.some((e) => e.t === 'scan' && e.k === 'followup') && !CE.some((e) => e.t === 'click'), 'a client install\'s events beside its own sends; the scanner is a scan, not a click');
  t(FE.length === 1 && FE[0].t === 'click' && FE[0].k === 'aftercare', 'Sixfold\'s events stay in Sixfold\'s log');
  t(![TE, CE, FE].flat().some((e) => 'ip' in e || 'ua' in e || JSON.stringify(e).includes('@')), 'no address, IP or browser in any event');

  /* 3. the app: client installs' care emails and the notes to Matthew */
  const CLI = path.join(HERE, 'mtall-cli.php'), API = path.join(PUB, 'api', 'rounds.php'), MOCK = path.join(R, 'care-mock.log');
  const app = (cmd, arg = '', env = {}) => json(spawnSync('php', ['-d', 'memory_limit=768M', CLI, API, cmd, arg], { encoding: 'utf8', env: { ...process.env, CARE_MAIL_MOCK: MOCK, ...env } }).stdout || '');
  o = app('installon'); t(o.on === false && o.edition === true, 'an edition that is not a client install: not counted');
  o = app('installon', '', { MAILTRACK_INSTALL: '1' }); t(o.on === true, 'a client install (the test copy says so): counted');
  const before = lines('sixfold-data/rounds/mail-sends.log').length;
  o = app('care', 'alex@example.com'); let M = fs.readFileSync(MOCK, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  t(o.ok === true && M.length === 1 && !M[0].html.includes('/m/?o=') && lines('sixfold-data/rounds/mail-sends.log').length === before, 'not a client install: the care email goes as it always did, nothing noted');
  o = app('care', 'alex@example.com', { MAILTRACK_INSTALL: '1' }); M = fs.readFileSync(MOCK, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const cs = lines('sixfold-data/rounds/mail-sends.log').filter((x) => x.k === 'followup').pop();
  t(o.ok === true && M.length === 2 && cs && M[1].html.includes('/m/?o=' + cs.id), 'a client install\'s follow-up carries the open image, noted in its own data folder');
  t(cs && cs.src === 'sfr' && cs.links.includes('https://example.com/lawn-tips') && cs.links.some((u) => u.includes('q.html?k=abc123')) && !cs.links.some((u) => u.includes('nlunsub')), 'its links are counted (the quote link and the site) as Sixfold\'s are; the unsubscribe is not');
  t(M[1].text.includes('/m/?c=' + cs.id + '.') && /action=nlunsub/.test(M[1].text) && /action=nlunsub/.test(M[1].html) && M[1].headers.some((h) => /^List-Unsubscribe: <[^>]*action=nlunsub/.test(h)), 'unsubscribe links and the List-Unsubscribe header untouched');
  t(M[1].subject === M[0].subject && M[1].text.replace(/https:\/\/traverseplatforms\.com\/m\/\?c=[0-9a-f]{20}\.\d+/g, 'L') === M[0].text.replace(/https:\/\/[^\s<>()"']+[^\s<>().,;:!?"']/g, (u) => /nlunsub/.test(u) ? u : 'L'), 'the words are the same; only the counted links changed');
  o = app('travmail');
  const ns = lines(MT + '/mail-sends.log').filter((x) => x.k === 'notes' && x.src === 'sfr').pop();
  t(o.ok === false && o.stage === 'connect' && ns && lines(MT + '/mail-sends.log').some((x) => x.t === 'fail' && x.id === ns.id), 'a note to Matthew is noted in Traverse\'s store; when it cannot send it is marked failed (left out of the counts)');

  /* 4. the website's demo emails and the sign-up mail */
  o = json(php(`define('X', 1); $_SERVER['SCRIPT_FILENAME'] = 'x'; require '${path.join(PUB, 'demo', '_lib.php').replace(/\\/g, '/')}';
    $c = site_config(); $b = ['id' => 'd1', 'key' => 'k123SECRET', 'date' => date('Y-m-d', time() + 5 * 86400), 'time' => '10:00', 'minutes' => 30, 'meet' => 'phone', 'phone' => '555', 'name' => 'Pat', 'company' => 'Pat Co', 'trade' => 'Lawn', 'team' => '3', 'towns' => 'X', 'email' => 'pat@example.com', 'notes' => ''];
    $ok = notify_booking($c, $b);
    require_once '${LIB}';
    $T = mtTrack(mtTraverseDir(), 'demo-confirm', "Cancel here: https://traverseplatforms.com/demo/api.php?action=cancel&id=d1&k=k123SECRET", '', ['v' => 'booked']);
    $p = mail_payload($c['smtp'], 'pat@example.com', 'Your Traverse demo', $T['text'], ['Reply-To: m@example.com'], ics($c, $b, 'REQUEST'), $T['html']);
    $q = mail_payload($c['smtp'], 'pat@example.com', 'Plain', 'Just words', [], null, null);
    echo json_encode(['ok' => $ok, 'id' => $T['id'], 'p' => $p, 'q' => $q]);`));
  S = lines(MT + '/mail-sends.log');
  const dn = S.filter((x) => x.k === 'demo-notify' && x.v === 'booked'), dc = S.filter((x) => x.k === 'demo-confirm' && x.v === 'booked');
  t(o.ok === false && dn.length === 1 && dc.length >= 1 && S.filter((x) => x.t === 'fail').length >= 3, 'a booking notes both emails (to Matthew, to the visitor); unsent ones are marked failed');
  t(!rd(MT + '/mail-sends.log').includes('k123SECRET') && dc.every((x) => x.links.length === 0), 'the cancel link (the booking key) is never wrapped or kept');
  t(/Content-Type: multipart\/mixed; boundary="tv[0-9a-f]{16}"/.test(o.p) && /Content-Type: multipart\/alternative; boundary="ta[0-9a-f]{16}"/.test(o.p) && /Content-Type: text\/calendar; charset=UTF-8; method=REQUEST/.test(o.p) && /filename="invite.ics"/.test(o.p), 'with the invite: text + HTML alternative inside the mixed message, the calendar parts as before');
  const htmlPart = (o.p.split('Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1] || '').split('--')[0].replace(/\s+/g, '');
  t(Buffer.from(htmlPart, 'base64').toString().includes('/m/?o=' + o.id), 'the HTML part carries the open image');
  t(/MIME-Version: 1.0\r\nContent-Type: text\/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n/.test(o.q) && !/multipart/.test(o.q), 'with no HTML: the plain message it always was');
  o = json(php(`require '${path.join(PUB, 'api', 'traverse-clients-lib.php').replace(/\\/g, '/')}'; $a = tcMail('buyer@example.com', 'Your Traverse is waiting for you', "Finish: https://traverseplatforms.com/start/welcome/?c=c1&cs=KEY99\\n"); $b = tcMail('m@example.com', 'Traverse: new paid company (x)', "x"); echo json_encode(['a' => $a, 'b' => $b]);`));
  S = lines(MT + '/mail-sends.log');
  t(o.a === false && S.some((x) => x.k === 'signup' && x.v === 'waiting' && x.links.length === 0) && S.some((x) => x.k === 'notes' && x.v === 'site') && !rd(MT + '/mail-sends.log').includes('KEY99'), 'sign-up mail: the buyer\'s ("waiting") and the note to Matthew noted apart; the welcome link never wrapped');

  /* 5. the post calendar's alert */
  o = json(php(`define('PC', 1); require '${path.join(R, 'post-calendar-tools', 'lib.php').replace(/\\/g, '/')}'; $r = pcMail('Post calendar: a test', "A post failed.\\nhttps://traverseplatforms.com/posts-test/\\n");
    $m = pcMailMsg(['from_name' => 'Traverse', 'user' => 'm@example.com'], 'S', 'words', '<p>words</p>'); $p = pcMailMsg(['from_name' => 'Traverse', 'user' => 'm@example.com'], 'S', 'words', '');
    echo json_encode(['r' => $r, 'm' => $m, 'p' => $p]);`, { PC_SITE: R, PC_DATA: path.join(R, 'post-calendar-data') }));
  S = lines(MT + '/mail-sends.log'); const ps = S.filter((x) => x.k === 'posts');
  t(o.r && o.r.ok === false && ps.length === 1 && S.some((x) => x.t === 'fail' && x.id === ps[0].id) && ps[0].links.length === 0, 'post calendar alert: noted as \'posts\', its link not counted, an unsent one marked failed');
  t(/Content-Type: multipart\/alternative; boundary="mta/.test(o.m) && /MIME-Version: 1.0\r\nContent-Type: text\/plain; charset=UTF-8/.test(o.p), 'its message: text + HTML with the image, or the plain text it was');

  /* 6. the Sixfold tools build their message with mtMime: checked in part 1; the hourly tools themselves need the live mail settings */
} finally {
  if (srv) srv.kill();
  try { fs.rmSync(R, { recursive: true, force: true }); } catch {}
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
