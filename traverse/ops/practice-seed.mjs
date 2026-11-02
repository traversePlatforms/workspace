// The practice copy's made-up customers, and its end-to-end check (2026-11-02). Everything goes through the practice API itself, so every row
// has the shape the app writes. Names are obviously made up, phones are 555-01xx, emails are @example.com, streets are invented.
//
//   node practice-seed.mjs seed <base> --name "Office Tester"      makes the leads, quotes, jobs, customers and plans; prints the job ids to backdate
//   node practice-seed.mjs test <base> --name "Practice Check"     adds a lead, quotes it, sends the agreement with a Square deposit link, books the
//                                                                   job, marks it Done, sends aftercare and the follow-up, makes a pay link; checks
//                                                                   that each went to practice-sends.log instead
//   <base> = http://127.0.0.1:8799 (local) or https://traverseplatforms.com.   The code is read from ~/.ssh/practice-codes.txt by name (never
//   printed), or --code <throwaway> for a local copy.
import fs from 'node:fs';
import path from 'node:path';

const [mode, base0, ...rest] = process.argv.slice(2);
const arg = (k) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : ''; };
if (!['seed', 'test'].includes(mode) || !base0) { console.log('usage: practice-seed.mjs seed|test <base> --name <account> | --code <code>'); process.exit(1); }
const BASE = base0.replace(/\/$/, ''), API = BASE + '/api/sixfold-practice-rounds.php';
let code = arg('code');
if (!code) {
  const f = path.join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'practice-codes.txt'), want = arg('name');
  const line = fs.readFileSync(f, 'utf8').split(/\r?\n/).map((l) => l.split('\t')).find((p) => p[0] === want);
  if (!line) { console.log('no account named ' + JSON.stringify(want) + ' in the codes file'); process.exit(1); }
  code = line[2];
}
let cookie = '';
async function api(action, body, params) {
  let url = API + '?action=' + encodeURIComponent(action);
  for (const [k, v] of Object.entries(params || {})) url += '&' + k + '=' + encodeURIComponent(v);
  const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) practice-check' }, body ? { 'Content-Type': 'application/json' } : {}, cookie ? { Cookie: cookie } : {}), body: body ? JSON.stringify(body) : undefined });
  for (const c of r.headers.getSetCookie ? r.headers.getSetCookie() : []) { const m = /^(sfp=[^;]*)/.exec(c); if (m) cookie = m[1]; }
  let j; try { j = await r.json(); } catch { j = { ok: false, error: 'not JSON (' + r.status + ')' }; }
  j._status = r.status; return j;
}
const must = (j, what) => { if (!j || !j.ok) throw new Error(what + ': ' + (j && (j.error || j.why)) + ' (' + (j && j._status) + ')'); return j; };

/* the days the board takes: today on, never Sunday (jobClosed), in Denver's calendar */
const denver = (d) => new Date(d.toLocaleString('en-US', { timeZone: 'America/Denver' }));
function openDay(ahead) {
  const d = denver(new Date()); d.setDate(d.getDate() + ahead);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function signIn() {
  const s = await api('signin', { code });
  must(s, 'sign in'); const me = await api('me'); must(me, 'me');
  console.log('signed in as ' + me.name + ' (' + me.role + ')');
  return me;
}

/* made-up people: [name, phone, street, town, need, source] */
const P = [
  ['Pat Practice', '(303) 555-0101', '1201 Example Ave', 'Englewood', 'Lawn & turf care', 'phone'],
  ['Sam Sample', '(303) 555-0102', '88 Sample St', 'Englewood', 'Lawn & turf care', 'meta'],
  ['Dana Demo', '(303) 555-0103', '4410 Demo Dr', 'Sheridan', 'Lawn & turf care', 'nextdoor'],
  ['Terry Testcase', '(303) 555-0104', '19 Testcase Ct', 'Englewood', 'Lawn & turf care', 'referral'],
  ['Morgan Mockup', '(303) 555-0105', '702 Mockup Ln', 'Greenwood Village', 'Lawn & turf care', 'phone'],
  ['Riley Rehearsal', '(303) 555-0106', '3300 Rehearsal Rd', 'Cherry Hills Village', 'Lawn & turf care', 'meta'],
  ['Casey Pretend', '(303) 555-0107', '55 Pretend Pl', 'Englewood', 'Fire mitigation', 'phone'],
  ['Jordan Dummy', '(303) 555-0108', '910 Dummy Way', 'Sheridan', 'Lawn & turf care', 'meta'],
  ['Alex Example', '(303) 555-0109', '1450 Example Ave', 'Englewood', 'Landscaping', 'nextdoor'],
  ['Quinn Placeholder', '(303) 555-0110', '27 Placeholder Pkwy', 'Columbine Valley', 'More than one service', 'referral'],
  ['Taylor Trial', '(303) 555-0111', '600 Trial Trl', 'Englewood', 'Lawn & turf care', 'phone'],
  ['Jamie Makebelieve', '(303) 555-0112', '8 Makebelieve Blvd', 'Greenwood Village', 'Question', 'meta'],
  ['Robin Roleplay', '(303) 555-0113', '1777 Roleplay Cir', 'Englewood', 'Lawn & turf care', 'phone'],
  ['Chris Testerson', '(303) 555-0114', '245 Testerson St', 'Sheridan', 'Lawn & turf care', 'nextdoor'],
  ['Lee Fakename', '(303) 555-0115', '3100 Fakename Dr', 'Cherry Hills Village', 'Land clearing', 'phone'],
];
const email = (n) => n.toLowerCase().replace(/[^a-z ]/g, '').trim().split(' ').join('.') + '@example.com';

async function addLead(p, note) {
  const j = must(await api('leadadd', { src: p[5], name: p[0], phone: p[1], email: email(p[0]), town: p[2] + ', ' + p[3], need: p[4], msg: note || '' }), 'lead ' + p[0]);
  return j.id;
}

async function seed() {
  const me = await signIn();
  const crew = 'Crew Tester';
  const ids = {}; for (const p of P) ids[p[0]] = await addLead(p, 'Made-up customer for the practice copy.');
  console.log('leads: ' + Object.keys(ids).length);
  const st = async (n, s) => must(await api('leadstatus', { id: ids[n], status: s }), 'status ' + n);
  const quote = async (n, price, sq) => must(await api('leadquote', { id: ids[n], price, pkg: 'full', sq, seedLb: Math.round(sq / 1000 * 3), fertLb: Math.round(sq / 1000 * 4), note: 'Made-up quote' }), 'quote ' + n);
  const job = async (n, ahead, slot, price, pay) => must(await api('jobsave', { lead: ids[n], crew, date: openDay(ahead), slot, price, pkg: 'full', scope: 'all', pay, note: 'Made-up job for the practice copy' }), 'job ' + n).id;
  const back = {};   /* job id -> days ago, for practice-backdate.php */
  // done and paid, three weeks ago
  await quote('Pat Practice', 349, 4200); let j = await job('Pat Practice', 1, 's2', 349, { s: 'paid', how: 'cash' }); must(await api('jobdone', { id: j, outcome: 'done', collected: 0, mins: 75 }), 'done Pat'); back[j] = 21;
  // done, a balance owing (deposit in), ten days ago
  await quote('Sam Sample', 399, 5600); j = await job('Sam Sample', 1, 's3', 399, { s: 'deposit', amt: 150, how: 'zelle' }); must(await api('jobdone', { id: j, outcome: 'done', collected: 0, mins: 90 }), 'done Sam'); back[j] = 10;
  // done, nothing paid yet, five days ago
  await quote('Dana Demo', 299, 2600); j = await job('Dana Demo', 2, 's1', 299, { s: 'unpaid' }); must(await api('jobdone', { id: j, outcome: 'done', collected: 0, mins: 50 }), 'done Dana'); back[j] = 5;
  // done and paid, a monthly plan customer, a month ago
  await quote('Robin Roleplay', 329, 3800); j = await job('Robin Roleplay', 2, 's2', 329, { s: 'paid', how: 'card' }); must(await api('jobdone', { id: j, outcome: 'done', collected: 0, mins: 70 }), 'done Robin'); back[j] = 30;
  // could not do it, two days ago (to rebook)
  await quote('Lee Fakename', 459, 7800); j = await job('Lee Fakename', 3, 's4', 459, { s: 'unpaid' }); must(await api('jobdone', { id: j, outcome: 'could not', note: 'Gate locked and nobody home (made up).', collected: 0, mins: 0 }), 'could not Lee'); back[j] = 2;
  // coming up
  await quote('Terry Testcase', 349, 4000); await job('Terry Testcase', 3, 's2', 349, { s: 'unpaid' });
  await quote('Morgan Mockup', 449, 6900); await job('Morgan Mockup', 8, 's3', 449, { s: 'deposit', amt: 200, how: 'venmo' });
  // the rest of the pipeline
  await quote('Riley Rehearsal', 379, 5000);
  await st('Casey Pretend', 'walk');
  await st('Alex Example', 'contacted');
  await st('Quinn Placeholder', 'hold');
  await st('Taylor Trial', 'lost');
  await st('Jamie Makebelieve', 'unreached');
  must(await api('leadtry', { id: ids['Chris Testerson'], steps: ['vm'], note: 'Left a voicemail about aeration (made up).' }), 'voicemail Chris');
  // a plan on Robin, and one more customer added by hand, paused
  const cl = must(await api('customers'), 'customers');
  const robin = (cl.customers || []).find((c) => c.name === 'Robin Roleplay');
  if (robin) must(await api('customersave', { id: robin.id, plan: 'monthly', price: 79, every: 4, planName: 'Monthly lawn plan (made up)', status: 'active' }), 'plan Robin');
  must(await api('customersave', { name: 'Avery Imaginary', phone: '(303) 555-0116', email: 'avery.imaginary@example.com', address: '12 Imaginary Ave', town: 'Englewood', service: 'aeration', plan: 'yearly', price: 299, status: 'paused', notes: 'Made-up customer for the practice copy.' }), 'customer Avery');
  console.log('customers: ' + ((must(await api('customers'), 'customers').customers || []).length));
  console.log('BACKDATE ' + JSON.stringify(back));
}

async function test() {
  await signIn();
  const before = must(await api('practicelog'), 'practice log').rows.length;
  const fo = await api('followupset', { on: true }); console.log('  follow-up email switched on: ' + (fo.ok ? 'ok' : fo.error));   /* as live Sixfold has it */
  const tag = Array.from({ length: 4 }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('');   /* each run its own made-up person and day */
  const p = ['Morgan Checkrun' + tag[0].toUpperCase() + tag.slice(1), '(303) 555-0199', '4 Checkrun Ct', 'Englewood', 'Lawn & turf care', 'phone'];
  const id = await addLead(p, 'Practice check ' + new Date().toISOString());
  console.log('  lead added');
  const q = must(await api('leadquote', { id, price: 359, pkg: 'full', sq: 4300, note: 'check' }), 'quote');
  console.log('  quote saved, link ' + (q.link && q.link.indexOf(BASE + '/practice-') === 0 ? 'on the practice copy' : 'ELSEWHERE: ' + q.link));
  const day = openDay(5 + Math.floor(Math.random() * 40)), slot = ['s1', 's2', 's3', 's4'][Math.floor(Math.random() * 4)];
  const s = await api('signsend', { id, price: 359, pkg: 'full', how: 'link', date: day, slot, crew: 'Crew Tester', email: email(p[0]) });
  console.log('  agreement + deposit link: ' + (s.ok ? 'ok, signing link ' + (String(s.link).indexOf(BASE + '/practice-') === 0 ? 'on the practice copy' : 'ELSEWHERE: ' + s.link) + ', deposit $' + s.deposit : 'refused: ' + s.error));
  const jl = must(await api('jobs', null, { from: openDay(0), to: openDay(50) }), 'jobs'); let job = (jl.jobs || []).find((x) => x.lead === id);
  if (!job) { const jid = must(await api('jobsave', { lead: id, crew: 'Crew Tester', date: day, slot: 's2', price: 359, pkg: 'full', scope: 'all', pay: { s: 'unpaid' } }), 'book').id; job = { id: jid }; console.log('  job booked by hand'); }
  else console.log('  job on the board');
  const d = must(await api('jobdone', { id: job.id, outcome: 'done', collected: 0, mins: 60 }), 'done');
  console.log('  marked Done, aftercare: ' + d.aftercare);
  const pl = await api('jobpaylink', { id: job.id }); console.log('  pay link: ' + (pl.ok ? 'ok' + (pl.url ? (pl.url.indexOf('/practice-pay.html') > 0 ? ' (practice page)' : ' ELSEWHERE') : '') : 'refused: ' + pl.error));
  const af = await api('aftercare', { id: job.id }); console.log('  aftercare by hand: ' + (af.ok ? 'ok, ' + af.stage : 'refused: ' + af.error));
  const fu = await api('followupsend', { id: job.id }); console.log('  follow-up: ' + (fu.ok ? 'ok, ' + fu.stage : 'refused: ' + fu.error));
  const pt = await api('pushtest', {}); console.log('  test alert: ' + (pt.ok ? 'ok' : 'refused: ' + pt.error));
  const hs = await api('helpsend', { text: 'Practice check: does the help desk stay here?' }); console.log('  help desk: ' + (hs.ok ? 'kept, reply: ' + ((hs.ticket && hs.ticket.msgs || []).slice(-1)[0] || {}).from : 'refused: ' + hs.error));
  const sh = await api('squareoauth', {}); console.log('  connect Square: ' + (sh._status === 404 ? 'shut (404)' : 'ANSWERED ' + sh._status));
  const after = must(await api('practicelog'), 'practice log').rows;
  const fresh = after.slice(0, after.length - before);
  const kinds = {}; for (const r of fresh) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
  console.log('practice log: ' + fresh.length + ' new lines ' + JSON.stringify(kinds));
  for (const r of fresh) console.log('   ' + r.kind + (r.to ? ' to ' + r.to : '') + (r.subject ? ': ' + r.subject : '') + (r.method ? ': ' + r.method + ' ' + (r.path || r.url || '') : '') + (r.title ? ': ' + r.title : ''));
  must(await api('signout', {}), 'sign out');
}
(mode === 'seed' ? seed() : test()).catch((e) => { console.log('FAILED: ' + e.message); process.exit(1); });
