/* Claire's first Traverse outreach lists (2026-11-21). Reads the live Prospect Desk through her own outreach sign-in (read only; the code
   comes from the codes file and is never printed), works out four lists and writes them WITHOUT contact details (names, towns, trade,
   fit and why only: the phones, emails and pages stay on the desk, which she opens to reach them). Signs out at the end.
     node outreach-lists.mjs <codes file> <out.json>
   Skipped everywhere: asked not to be emailed, a bounced or dead email, knocked off (No / Not now), customers and anyone further along
   (Talking, Demo, Pilot), anyone messaged or emailed in the last 14 days, a Nextdoor page marked not usable (ndBad), and the companies
   Matthew messaged on Nextdoor on 31 Oct (the Nextdoor tick). Best fit first: roofing and lawn, small (young) companies first, then
   the desk's fit score. */
import { readFileSync, writeFileSync } from 'node:fs';
import https from 'node:https';
const [, , CODES, OUT] = process.argv;
const code = readFileSync(CODES, 'utf8').split('\n').find((l) => l.startsWith('Traverse Prospect Desk |')).split(' | ')[3].trim();
const API = 'https://traverseplatforms.com/prospects-47bfe6/api/desk.php';
let ck = '';
const call = (action, body) => new Promise((res) => {
  const data = body ? JSON.stringify(body) : null;
  const rq = https.request(API + '?action=' + action, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json', 'X-Desk': '1', 'Content-Length': Buffer.byteLength(data) } : {}), ...(ck ? { Cookie: ck } : {}), 'Accept-Encoding': 'identity' } }, (r) => {
    const sc = r.headers['set-cookie']; if (sc) { const c = sc.find((x) => /prospectdesk=/.test(x)); if (c) ck = c.split(';')[0]; }
    let s = ''; r.setEncoding('utf8'); r.on('data', (d) => (s += d)); r.on('end', () => { let j = {}; try { j = JSON.parse(s); } catch {} j._status = r.statusCode; res(j); });
  });
  rq.on('error', () => res({ _status: 0 })); if (data) rq.write(data); rq.end();
});
const si = await call('signin', { code }); if (!si.ok) { console.error('sign-in failed'); process.exit(1); }
const D = await call('data'); await call('signout', {});
if (!D.ok) { console.error('no data'); process.exit(1); }
const now = Date.now() / 1000, D14 = now - 14 * 86400;
const fb = (l) => (l.socials || []).find((u) => /facebook\.com|fb\.com/i.test(u)) || '';
const nd = (l) => (l.nextdoor || (l.socials || []).find((u) => /nextdoor\.com/i.test(u)) || '');
const lastTouch = (l) => Math.max(0, ...(l.sent || []).map((x) => +x.at || 0), ...(l.touches || []).map((x) => +x.at || 0));
const young = (l) => +String(l.formed || '').slice(0, 4) >= 2016;
const rlawn = (l) => l.trade === 'roofing' || l.trade === 'yards' || l.trade === 'roofing solar';
const skip = (l) => {
  if (l.unsub) return 'asked not to be emailed';
  if (['no', 'notnow', 'customer', 'talking', 'demo', 'pilot'].includes(l.status)) return 'knocked off or further along';
  if (lastTouch(l) >= D14) return 'messaged in the last 14 days';
  if (l.ndBad) return 'Nextdoor page not usable';
  if ((l.reached || []).includes('nextdoor')) return 'Matthew messaged on Nextdoor';
  if ((l.clicks || 0) > 0) return 'clicked an email: Matthew follows up himself';
  if ((l.reached || []).includes('called')) return 'Matthew has called them';
  return '';
};
const bounced = (l) => l.emailOk === 'no';
const rank = (a, b) => (rlawn(b) - rlawn(a)) || (young(b) - young(a)) || ((b.score || 0) - (a.score || 0)) || a.name.localeCompare(b.name);
const ok = D.leads.filter((l) => !skip(l));
const emailedNoReply = (l) => (l.sent || []).length > 0 && (l.status === 'emailed' || (l.reached || []).includes('emailed')) && !(l.clicks > 0 && false);
const LISTS = {
  nextdoor: ok.filter((l) => nd(l) && !(l.touches || []).some((t) => t.way === 'nextdoor')).sort(rank),
  facebook: ok.filter((l) => fb(l) && !(l.touches || []).some((t) => t.way === 'facebook')).sort(rank),
  calls: ok.filter((l) => l.phone).sort((a, b) => (emailedNoReply(b) - emailedNoReply(a)) || rank(a, b)),
  email: ok.filter((l) => rlawn(l) && l.email && !bounced(l) && young(l) && ((l.sent || []).length === 0 || emailedNoReply(l))).sort((a, b) => (((a.sent || []).length === 0) ? 0 : 1) - (((b.sent || []).length === 0) ? 0 : 1) || rank(a, b))
};
/* one company, one list (Nextdoor, then Facebook, then calls, then email): a first batch never reaches a company two ways in one week.
   Also skipped: anyone who clicked an email, or whom Matthew has called (his own follow-ups). */
const used = new Set(); const FIRST = {};
for (const k of ['nextdoor', 'facebook', 'calls', 'email']) { FIRST[k] = []; for (const l of LISTS[k]) { if (FIRST[k].length >= 20) break; if (used.has(l.id)) continue; used.add(l.id); FIRST[k].push(l); } }
const TR = D.trades;
const row = (l, kind) => ({ name: l.name, city: l.city || '', trade: TR[l.trade] || l.trade, grade: l.grade || '', score: l.score || 0, formed: String(l.formed || '').slice(0, 4),
  why: kind === 'calls' ? ((l.sent || []).length ? 'Emailed ' + new Date(Math.max(...l.sent.map((x) => x.at)) * 1000).toISOString().slice(0, 10) + ', no reply yet: a follow-up call' : 'Not emailed yet: a first call')
     : kind === 'email' ? ((l.sent || []).length ? 'Emailed by the desk, no reply: a personal follow-up' : 'Not emailed by the desk yet')
     : kind === 'nextdoor' ? 'Has a Nextdoor business page, not messaged yet' : 'Has a Facebook page link on its website' });
const counts = { companies: D.leads.length, skippedByRule: D.leads.length - ok.length, facebookLinks: D.leads.filter((l) => fb(l)).length, nextdoorPages: D.leads.filter((l) => nd(l)).length,
  pool: Object.fromEntries(Object.entries(LISTS).map(([k, v]) => [k, v.length])), why: {} };
for (const l of D.leads) { const w = skip(l); if (w) counts.why[w] = (counts.why[w] || 0) + 1; }
writeFileSync(OUT, JSON.stringify({ built: new Date().toISOString(), counts, lists: Object.fromEntries(Object.entries(FIRST).map(([k, v]) => [k, v.map((l) => row(l, k))])) }, null, 1));
console.log(JSON.stringify(counts));
