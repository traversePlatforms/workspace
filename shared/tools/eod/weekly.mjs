#!/usr/bin/env node
// The weekly "Business numbers" report (2026-11-23, Matthew: "I need to really redo my whole end of day recap, just because there is
// multiple companies now and multiple data points"; he picked changes daily, numbers weekly). Every Sunday, per company: each metric with
// last week, this week and the change. README.md in this folder lists every metric's source.
//
//   node shared/tools/eod/weekly.mjs                     the 7 days ending today (Colorado time): collect, save the snapshot, render, PDF
//   node shared/tools/eod/weekly.mjs --end 2026-11-29    the 7 days ending that day
//   node shared/tools/eod/weekly.mjs --render-only       re-render from the saved snapshot for --end (no server calls)
//   node shared/tools/eod/weekly.mjs --no-pdf            skip the PDF
//
// READ ONLY everywhere: server numbers come over bash ~/jarvis/bin/sg.sh trav with two read scripts piped to php (server/*.php: they are
// never installed there) and the existing profit-check.php --line; Stripe through jarvis-money.mjs (GET only); Peak's club scorecard from
// matthew/clients/peak-pickleball/tools/impact.mjs --week-end=<end> --json on this machine (the nightly pulls' local store; day one 23 Nov
// 2026, Week 0 = 16-22 Nov; these club numbers go only in this report). Nothing is sent, nothing on the server changes.
// Rule: no number without a source. A metric with no source yet shows "not available yet (why)".
// Snapshot: $LOCALAPPDATA/ProjectBackup/eod/weekly-<end>.json (~/jarvis/localappdata on this machine), so next week can compare.
// Output: changelog/weekly-<end>.html and .pdf (the laptop's sync copies weekly-*.html/pdf to the Desktop's End of Day Reports).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO, OUTDIR, SNAPDIR, HERE, esc, denverDate, addDays, longDay, shortDay, page, tiles, pdf } from './lib.mjs';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const END = opt('--end') || denverDate();
if (!/^\d{4}-\d\d-\d\d$/.test(END)) { console.error('--end YYYY-MM-DD'); process.exit(2); }
const START = addDays(END, -6), LAST_START = addDays(END, -13), LAST_END = addDays(END, -7);
const SG = process.env.JARVIS_SG_SH || path.join(process.env.HOME || '', 'jarvis', 'bin', 'sg.sh');
const SNAP = path.join(SNAPDIR, `weekly-${END}.json`);
fs.mkdirSync(SNAPDIR, { recursive: true });

// Facts the numbers depend on, with where they come from (memory notes and commit history; update them here if they change)
const FACTS = {
  siteCountingFrom: '2026-11-20',   // site analytics went live 20 Nov 2026 (shared/site-analytics, commit f57b62f5)
  peakBlastsFrom: '2026-11-23',     // the Peak lists' first sends: Mon 23 Nov 2026 9 am (Matthew started them 21 Nov)
};

// ---------------------------------------------------------------------------------------------------------------- collect
function sg(script, args) {
  const cmd = `php -- ${args.join(' ')}`;
  const input = script ? fs.readFileSync(path.join(HERE, 'server', script)) : '';
  const out = execFileSync('bash', [SG, 'trav', script ? cmd : args.join(' ')], { input, timeout: 300000, maxBuffer: 16 << 20 }).toString();
  return out.trim().split('\n').pop();
}
function tryJson(label, fn) {
  try { const j = JSON.parse(fn()); if (j && j.ok === false) return { error: j.error || label + ' answered not ok' }; return j; }
  catch (e) { return { error: `${label}: ${String(e.message || e).split('\n')[0].slice(0, 160)}` }; }
}
function collect() {
  const raw = { collectedAt: new Date().toISOString() };
  raw.sixfold = tryJson('Sixfold app', () => sg('sixfold-week.php', [START, END]));
  raw.reads = tryJson('server reads', () => sg('reads.php', [START, END]));
  try { raw.profitLine = sg(null, ['cd ~/www/traverseplatforms.com/sixfold-tools && php profit-check.php --line']); } catch (e) { raw.profitLine = { error: 'profit-check.php did not answer' }; }
  // Stripe: the J.A.R.V.I.S. money summary's own read (GET /v1/balance and this month's charges), into the eod folder so the Assistant's
  // copy is not touched. The key stays in ~/.ssh; only dollars come back.
  const mdir = path.join(SNAPDIR, 'money');
  try {
    fs.mkdirSync(mdir, { recursive: true });
    const env = { ...process.env, JARVIS_DIR: mdir };
    if (!env.STRIPE_KEYFILE) env.STRIPE_KEYFILE = path.join(process.env.HOME || '', '.ssh', 'stripe-live.json');
    execFileSync('node', [path.join(REPO, 'assistant/jarvis/tools/jarvis-money.mjs'), 'stripe', '--force'], { env, timeout: 90000, stdio: 'ignore' });
    raw.stripe = JSON.parse(fs.readFileSync(path.join(mdir, 'stripe.json'), 'utf8'));
  } catch (e) { raw.stripe = { error: 'the money summary could not read Stripe' }; }
  // Peak club scorecard: matthew/clients/peak-pickleball/tools/impact.mjs --week-end (reads the local store the nightly pulls keep; no
  // network, writes nothing). Monday-to-Sunday weeks, so it only runs when the report ends on a Sunday.
  if (new Date(END + 'T12:00:00Z').getUTCDay() !== 0) raw.peakScore = { error: `the club scorecard runs for Monday-to-Sunday weeks; this report ends on a ${longDay(END, { weekday: 'long' })}` };
  else raw.peakScore = tryJson('Peak scorecard', () => execFileSync('node', [path.join(REPO, 'matthew/clients/peak-pickleball/tools/impact.mjs'), `--week-end=${END}`, '--json'], { timeout: 180000, maxBuffer: 16 << 20, stdio: ['ignore', 'pipe', 'pipe'] }).toString());
  return raw;
}

// ---------------------------------------------------------------------------------------------------------------- previous week
function previous() {
  let files = []; try { files = fs.readdirSync(SNAPDIR).filter((f) => /^weekly-\d{4}-\d\d-\d\d\.json$/.test(f) && f.slice(7, 17) < END).sort(); } catch {}
  if (!files.length) return null;
  const f = files.pop(); const d = f.slice(7, 17);
  try { return { day: d, exact: d === LAST_END, ...JSON.parse(fs.readFileSync(path.join(SNAPDIR, f), 'utf8')) }; } catch { return null; }
}

// ---------------------------------------------------------------------------------------------------------------- metrics
// A metric: { label, src, last, this, unit ('n' | '$'), better ('up' | 'down' | ''), na: 'why' (both weeks), lastNa: 'why', text }
const usd = (v) => (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US');
const num = (v, u) => (v == null ? '' : u === '$' ? usd(v) : u === '%' ? Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 }));
function build(raw, prev) {
  const S = { sixfold: [], traverse: [], peak: [] };
  const err = (x) => x && x.error;
  const P = prev && prev.raw ? prev.raw : null;
  const prevNote = prev ? (prev.exact ? '' : ` (compared with the ${shortDay(prev.day)} snapshot)`) : '';
  const noSnap = 'first weekly snapshot: the change shows from next week';

  // ---- Sixfold 365
  const sx = raw.sixfold;
  if (err(sx)) S.sixfold.push({ label: 'Sixfold app numbers', src: 'Sixfold 365 app over sg.sh', na: `not available yet (${sx.error})` });
  else {
    const t = sx.weeks.this, l = sx.weeks.last;
    const bySrc = (w) => Object.entries(w.leadsBySource || {}).map(([k, v]) => `${k} ${v}`).join(', ');
    S.sixfold.push({ label: 'New leads', src: `Sixfold 365 app, leads by the day they came in. Facebook form leads arrive by themselves; Messenger only when typed in. This week: ${bySrc(t) || 'none'}`, last: l.leads, this: t.leads, better: 'up' });
    S.sixfold.push({ label: 'Quotes sent', src: 'Sixfold 365 app, a quote counts on the day it was first sent (eod-report.php rule)', last: l.quotes, this: t.quotes, better: 'up' });
    S.sixfold.push({ label: 'Quotes sent, value', src: 'the same quotes, their prices', last: l.quotesValue, this: t.quotesValue, unit: '$', better: 'up' });
    S.sixfold.push({ label: 'Jobs booked', src: 'Sixfold 365 app, by the day the job was booked', last: l.booked, this: t.booked, better: 'up' });
    S.sixfold.push({ label: 'Jobs booked, value', src: 'the same jobs, their prices', last: l.bookedValue, this: t.bookedValue, unit: '$', better: 'up' });
    S.sixfold.push({ label: 'Jobs done', src: 'Sixfold 365 app, jobs dated that week and marked done', last: l.done, this: t.done, better: 'up' });
    S.sixfold.push({ label: 'Jobs done, value', src: 'the same jobs, their prices', last: l.doneValue, this: t.doneValue, unit: '$', better: 'up' });
    if (sx.square) S.sixfold.push({ label: 'Money collected', src: `Square, completed payments net of refunds (the same count as Brandon's end-of-day report). ${t.payments} payment${t.payments === 1 ? '' : 's'} this week, ${l.payments} last week`, last: l.collected, this: t.collected, unit: '$', better: 'up' });
    else S.sixfold.push({ label: 'Money collected', src: 'Square', na: 'not available yet (Square did not answer)' });
    const typed = sx.adSpendTypedAt ? `typed in ${shortDay(denverDate(new Date(sx.adSpendTypedAt * 1000)))}` : 'never typed in';
    const pAd = P && P.sixfold && !P.sixfold.error ? P.sixfold.adSpendLifetime : null;
    S.sixfold.push({ label: 'Ad spend, all time', src: `Stats page "Update ad spend" (lifetime Meta totals, ${typed}; the app cannot read the ad account)`, last: pAd, this: sx.adSpendLifetime, unit: '$', better: '', lastNa: pAd == null ? noSnap : '' });
    if (pAd != null) S.sixfold.push({ label: 'Ad spend this week', src: `the change in the all-time total since last week's snapshot${prevNote}; only as fresh as the last time spend was typed in`, this: Math.round((sx.adSpendLifetime - pAd) * 100) / 100, unit: '$', better: '', lastNa: 'needs two snapshots before last week' });
    else S.sixfold.push({ label: 'Ad spend this week', src: 'the change in the all-time total between two weekly snapshots', na: 'not available yet (the app keeps only the all-time total typed in Stats; the first weekly figure comes next week)' });
  }
  const pl = typeof raw.profitLine === 'string' ? raw.profitLine : '';
  const pm = /Sixfold profit: (.*?) \|/.exec(pl);
  if (pm) S.sixfold.push({ label: 'Profit, by month (known costs)', src: 'sixfold-tools/profit-check.php --line: jobs done less crew share, materials, card fees, ads and fixed costs; insurance, phone, gas and owner pay are not seen anywhere and not counted', text: pm[1] });
  else S.sixfold.push({ label: 'Profit, by month', src: 'sixfold-tools/profit-check.php', na: 'not available yet (profit-check did not answer)' });
  const site = (key, label, rows) => {
    const s = raw.reads && raw.reads.sites && raw.reads.sites[key];
    if (!s || s.error || (raw.reads && raw.reads.error)) { rows.push({ label: `${label} website visitors`, src: 'site analytics', na: `not available yet (${(s && s.error) || (raw.reads && raw.reads.error) || 'no answer'})` }); return; }
    const before = LAST_END < FACTS.siteCountingFrom ? `counting began ${shortDay(FACTS.siteCountingFrom)}` : '';
    const part = START < FACTS.siteCountingFrom ? ` This week counts from ${shortDay(FACTS.siteCountingFrom)} (counting began then).` : '';
    rows.push({ label: `${label} website visitors`, src: `our cookie-free site counting, a visitor counted once a day; bots and our own visits left out.${part}`, last: before ? null : s.last.visitors, this: s.this.visitors, lastNa: before, better: 'up' });
    rows.push({ label: `${label} page views`, src: 'the same counting', last: before ? null : s.last.views, this: s.this.views, lastNa: before, better: 'up' });
    const ce = (w) => (w.conversions ? Object.values(w.conversions).reduce((a, c) => a + c.events, 0) : w.convEvents);
    const kinds = s.this.conversions && Object.keys(s.this.conversions).length ? ' This week: ' + Object.entries(s.this.conversions).map(([k, c]) => `${k.replace(/_/g, ' ')} ${c.events}`).join(', ') : '';
    rows.push({ label: `${label} website conversions`, src: `conversion events counted on the site (${key === 'traverse' ? 'demo booked, checkout started, paid sign-up, call, text, email' : 'quote request, quote accepted, agreement signed, deposit tap, call, text'}).${kinds}`, last: before ? null : ce(s.last), this: ce(s.this), lastNa: before, better: 'up' });
  };
  site('sixfold365', 'Sixfold 365 (365aeration.com)', S.sixfold);

  // ---- Traverse
  site('traverse', 'traverseplatforms.com', S.traverse);
  const rd = raw.reads || {};
  if (rd.demos && !rd.demos.error) S.traverse.push({ label: 'Demo bookings', src: `the website's /demo/ page bookings, by the day booked (cancelled: ${rd.demos.this.cancelled} this week, ${rd.demos.last.cancelled} last week; ${rd.demos.allTime} ever)`, last: rd.demos.last.booked, this: rd.demos.this.booked, better: 'up' });
  else S.traverse.push({ label: 'Demo bookings', src: 'traverse-site-private/bookings.json', na: `not available yet (${(rd.demos && rd.demos.error) || rd.error || 'no answer'})` });
  if (rd.installs && !rd.installs.error) {
    const I = rd.installs, by = I.byStatus || {};
    const pIn = P && P.reads && P.reads.installs && !P.reads.installs.error ? P.reads.installs.byStatus || {} : null;
    const lastOf = (k) => (pIn ? pIn[k] || 0 : null);
    S.traverse.push({ label: 'Installs in a Stripe trial', src: `every install's billing.json, status "trialing" (${I.billingFiles} install${I.billingFiles === 1 ? ' has' : 's have'} a billing record)`, last: lastOf('trialing'), this: by.trialing || 0, lastNa: pIn ? '' : noSnap, better: 'up' });
    S.traverse.push({ label: 'Paying installs', src: 'every install\'s billing.json, status "active" (Stripe webhooks write it)', last: lastOf('active'), this: by.active || 0, lastNa: pIn ? '' : noSnap, better: 'up' });
    S.traverse.push({ label: 'New paying installs', src: 'billing.json first-payment day (paid_at) in the week', last: I.firstPaid.last, this: I.firstPaid.this, better: 'up' });
    S.traverse.push({ label: 'Website sign-ups', src: 'the /start/ checkout\'s client registry (traverse-shared/clients/registry.json), all time', last: P && P.reads && P.reads.installs && !P.reads.installs.error ? P.reads.installs.websiteSignups : null, this: I.websiteSignups, lastNa: P ? '' : noSnap, better: 'up' });
  } else S.traverse.push({ label: 'Trials and paying installs', src: 'billing.json', na: `not available yet (${(rd.installs && rd.installs.error) || rd.error || 'no answer'})` });
  const st = raw.stripe || {};
  if (st.error || st.month == null) S.traverse.push({ label: 'Stripe charges', src: 'J.A.R.V.I.S. money summary (jarvis-money.mjs stripe)', na: `not available yet (${st.error || 'no month total'})` });
  else {
    const pS = P && P.stripe && !P.stripe.error && P.stripe.month != null ? P.stripe : null;
    const sameMonth = pS && prev.day.slice(0, 7) === END.slice(0, 7);
    S.traverse.push({ label: 'Stripe charges, month so far', src: `J.A.R.V.I.S. money summary, read only: succeeded charges net of refunds since the 1st (${st.charges} charge${st.charges === 1 ? '' : 's'}); balance $${st.available} available, $${st.pending} pending`, last: sameMonth ? pS.month : null, this: st.month, unit: '$', lastNa: sameMonth ? '' : pS ? 'last snapshot was in another month' : noSnap, better: 'up' });
  }
  if (rd.prospects && !rd.prospects.error) {
    const t = rd.prospects.this, l = rd.prospects.last;
    const quiet = rd.prospects.lastEventDay && rd.prospects.lastEventDay < START ? ` Nothing on the desk since ${shortDay(rd.prospects.lastEventDay)}.` : '';
    S.traverse.push({ label: 'Prospect emails sent', src: `Prospect Desk events.log (sent rows; send failures: ${t.sendfail} this week, ${l.sendfail} last).${quiet}`, last: l.sent, this: t.sent, better: '' });
    S.traverse.push({ label: 'Prospect bounces', src: 'Prospect Desk events.log', last: l.bounce, this: t.bounce, better: 'down' });
    S.traverse.push({ label: 'Prospect unsubscribes', src: 'Prospect Desk events.log', last: l.unsub, this: t.unsub, better: 'down' });
    S.traverse.push({ label: 'Prospect link clicks', src: 'Prospect Desk events.log (clicks; mail scanners kept apart)', last: l.click, this: t.click, better: 'up' });
    S.traverse.push({ label: 'Prospects added', src: 'Prospect Desk events.log (lead rows)', last: l.lead, this: t.lead, better: '' });
    S.traverse.push({ label: 'Prospect replies', src: 'the desk does not record replies (they land in m.sharpe@ and the Assistant)', na: 'not available yet (no reply count is kept anywhere readable)' });
  } else S.traverse.push({ label: 'Prospect desk', src: 'events.log', na: `not available yet (${(rd.prospects && rd.prospects.error) || rd.error || 'no answer'})` });

  // ---- Peak Pickleball
  if (rd.peakmail && !rd.peakmail.error) {
    const t = rd.peakmail.this, l = rd.peakmail.last;
    const lastNa = LAST_END < FACTS.peakBlastsFrom ? `lists started ${shortDay(FACTS.peakBlastsFrom)}` : '';
    const L = (k) => (lastNa ? null : l[k]);
    const lists = Object.entries(rd.peakmail.byList || {}).map(([k, v]) => `${k} ${(v.this && v.this.sent) || 0}`).join(', ');
    S.peak.push({ label: 'Outreach emails sent', src: `the Peak sender's events.log (what cron.php stats counts). This week by list: ${lists || 'none'}`, last: L('sent'), this: t.sent, lastNa, better: '' });
    S.peak.push({ label: 'People who replied', src: 'the same log, first reply per person (STOP replies included)', last: L('reply'), this: t.reply, lastNa, better: 'up' });
    S.peak.push({ label: 'Bookings from the emails', src: 'the same log, booked rows (the booking link)', last: L('booked'), this: t.booked, lastNa, better: 'up' });
    S.peak.push({ label: 'Bounces', src: 'the same log', last: L('bounce'), this: t.bounce, lastNa, better: 'down' });
    S.peak.push({ label: 'Unsubscribes', src: 'the same log', last: L('unsub'), this: t.unsub, lastNa, better: 'down' });
    S.peak.push({ label: 'People who opened', src: 'the same log, first open per person (Apple Mail opens every email, Outlook often blocks: a rough signal)', last: L('open'), this: t.open, lastNa, better: 'up' });
  } else S.peak.push({ label: 'Outreach email', src: 'peak-mail-data/events.log', na: `not available yet (${(rd.peakmail && rd.peakmail.error) || rd.error || 'no answer'})` });
  if (rd.peakdesk && !rd.peakdesk.error && rd.peakdesk.sponsor) {
    const pd = P && P.reads && P.reads.peakdesk && !P.reads.peakdesk.error ? P.reads.peakdesk : null;
    const moved = (w) => { const s = (w && w.stages) || {}; return Object.entries(s).filter(([k]) => k !== 'new').reduce((a, [, v]) => a + v, 0); };
    const stg = (w) => Object.entries((w && w.stages) || {}).map(([k, v]) => `${k} ${v}`).join(', ');
    for (const [w, nm] of [['sponsor', 'Sponsor desk'], ['expo', 'Expo desk']]) {
      const x = rd.peakdesk[w]; if (!x) continue;
      S.peak.push({ label: `${nm}: companies past "new"`, src: `php desk.php check (stages now: ${stg(x)}; ${x.companies} companies, ${x.tours} tour${x.tours === 1 ? '' : 's'})`, last: pd ? moved(pd[w]) : null, this: moved(x), lastNa: pd ? '' : noSnap, better: 'up' });
    }
    const mt = (w) => ((w && w.stages) || {}).meeting || 0;
    S.peak.push({ label: 'Sponsor desk: in "meeting"', src: 'php desk.php check', last: pd ? mt(pd.sponsor) : null, this: mt(rd.peakdesk.sponsor), lastNa: pd ? '' : noSnap, better: 'up' });
    S.peak.push({ label: 'Tours on the desk', src: 'php desk.php check (sponsor + expo)', last: pd ? (pd.sponsor?.tours || 0) + (pd.expo?.tours || 0) : null, this: (rd.peakdesk.sponsor.tours || 0) + (rd.peakdesk.expo?.tours || 0), lastNa: pd ? '' : noSnap, better: 'up' });
  } else S.peak.push({ label: 'Desk pipeline', src: 'php desk.php check', na: `not available yet (${(rd.peakdesk && rd.peakdesk.error) || rd.error || 'no answer'})` });
  // tours and signed deals, from the desk's own logs (reads.php peakwins)
  const pw = rd.peakwins;
  if (pw && !pw.error && pw.sponsor) {
    const sum = (w, k) => (pw.sponsor[w][k] || 0) + ((pw.expo && pw.expo[w][k]) || 0);
    const at = pw.sponsor.allTime, ax = (pw.expo && pw.expo.allTime) || { tours: 0, held: 0, signed: 0, signedDollars: 0 };
    S.peak.push({ label: 'Tours booked', src: `the desk's logs, sponsor + expo, by the day the tour was booked (cancelled: ${sum('this', 'toursCancelled')} this week, ${sum('last', 'toursCancelled')} last; ${at.tours + ax.tours} on the books ever)`, last: sum('last', 'toursBooked'), this: sum('this', 'toursBooked'), better: 'up' });
    S.peak.push({ label: 'Tours held', src: `tours marked "Toured Peak", by the tour's date (${sum('this', 'toursOnCalendar')} on the calendar this week, ${sum('this', 'toursNoShow')} no-show${sum('this', 'toursNoShow') === 1 ? '' : 's'}; ${at.held + ax.held} held ever)`, last: sum('last', 'toursHeld'), this: sum('this', 'toursHeld'), better: 'up' });
    S.peak.push({ label: 'Sponsors signed', src: `the desk's "signed" rows, by the day written (${at.signed} ever, ${usd(at.signedDollars)})`, last: pw.sponsor.last.signed, this: pw.sponsor.this.signed, better: 'up' });
    S.peak.push({ label: 'Sponsors signed, value', src: 'the signed totals (each line\'s price x quantity, for the whole term)', last: pw.sponsor.last.signedDollars, this: pw.sponsor.this.signedDollars, unit: '$', better: 'up' });
    if (pw.expo) {
      S.peak.push({ label: 'Expos booked', src: `expo desk moved to "Booked", by the day written (${ax.signed} ever, ${usd(ax.signedDollars)})`, last: pw.expo.last.signed, this: pw.expo.this.signed, better: 'up' });
      S.peak.push({ label: 'Expos booked, value', src: 'the amount typed on the booking', last: pw.expo.last.signedDollars, this: pw.expo.this.signedDollars, unit: '$', better: 'up' });
    }
  } else S.peak.push({ label: 'Tours and signed deals', src: 'peak-desk-data logs', na: `not available yet (${(pw && pw.error) || rd.error || 'no answer'})` });

  // ---- Peak Pickleball: the club scorecard (impact.mjs --week-end; day one 23 Nov 2026, Week 0 = 16-22 Nov). Only in this report.
  const sc = raw.peakScore || {};
  S.peakClub = [];
  if (sc.error || !Array.isArray(sc.metrics)) S.peakClub.push({ label: 'Club scorecard', src: 'matthew/clients/peak-pickleball/tools/impact.mjs --week-end (the nightly CourtReserve and Patch pulls)', na: `not available yet (${sc.error || 'no answer'})` });
  else {
    const pSc = P && P.peakScore && Array.isArray(P.peakScore.metrics) ? P.peakScore : null;
    for (const m of sc.metrics) {
      let last = m.last, lastNa = '';
      // the member list only exists from the nightly pulls: last week's value comes from last Sunday's report
      if (last == null && m.key.startsWith('list')) { const pm = pSc && pSc.metrics.find((x) => x.key === m.key); last = pm ? pm.this : null; lastNa = last == null ? 'the member list is only kept from 23 Nov 2026' : ''; }
      S.peakClub.push({ label: m.label, src: m.note, last, this: m.this, lastYear: m.lastYear, normal: m.normal, unit: m.unit === 'n' ? undefined : m.unit, better: m.better, lastNa, lastYearNa: m.lastYear == null ? 'no member list a year ago' : '' });
    }
    const aw = (xs) => (xs && xs.length ? xs.map((a) => `${a.subject} (${a.sent})`).join('; ') : 'none');
    S.peakClub.push({ label: 'Patch automations that sent anything', src: `last week: ${aw(sc.automationsLastWeek)}. Same week last year: ${aw(sc.automationsSameWeekLastYear)}`, text: aw(sc.automationsThisWeek) });
    S.peakClub.push({ label: 'Patch blasts', src: 'campaign subjects and how many people each went to', text: aw(sc.blastsThisWeek) });
  }
  S.peakClub.push({ label: 'Website visitors and conversions', src: 'Google Analytics on Peak\'s site', na: 'not available yet (waiting on access from Peak)' });
  S.peakClub.push({ label: 'Meta ads', src: 'Peak\'s ad account (spend, reach, leads)', na: 'not available yet (waiting on access from Peak)' });
  return S;
}

// ---------------------------------------------------------------------------------------------------------------- render
function change(m) {
  if (m.na || m.text != null || m.this == null || m.last == null) return '<span class="dash">–</span>';
  const d = Math.round((m.this - m.last) * 100) / 100;
  if (d === 0) return '<span class="chg">no change</span>';
  const tone = !m.better ? '' : (d > 0) === (m.better === 'up') ? ' up' : ' down';
  if (m.unit === '%') return `<span class="chg${tone}">${d > 0 ? '+' : '−'}${Math.abs(Math.round(d * 10) / 10)} pts</span>`;
  const pc = m.last ? Math.round((100 * d) / Math.abs(m.last)) : null;
  const pct = pc != null && Math.abs(pc) < 1000 ? ` (${d > 0 ? '+' : ''}${pc}%)` : '';
  return `<span class="chg${tone}">${d > 0 ? '+' : '−'}${num(Math.abs(d), m.unit)}${m.unit === '$' ? '' : pct}</span>`;
}
function rowHtml(m) {
  const lab = `<div class="m">${esc(m.label)}<i>${esc(m.src)}</i></div>`;
  if (m.na) return `<div class="mrow">${lab}<div class="na">${esc(m.na)}</div></div>`;
  if (m.text != null) return `<div class="mrow">${lab}<div class="txt">${esc(m.text)}</div></div>`;
  const last = m.last == null ? `<span class="dash" title="${esc(m.lastNa || '')}">${esc(m.lastNa ? 'n/a' : '–')}</span>` : esc(num(m.last, m.unit));
  return `<div class="mrow">${lab}<div class="n">${last}</div><div class="n this">${esc(num(m.this, m.unit))}</div><div class="n">${change(m)}</div></div>`;
}
function section(title, list) {
  const notes = [...new Set(list.filter((m) => m.last == null && m.lastNa && !m.na).map((m) => m.lastNa))];
  return `<div class="sec">
<h2>${esc(title)} <span class="n">${list.length}</span></h2>
<div class="card">
<div class="mrow th"><div>Metric and source</div><div class="n">Last week</div><div class="n">This week</div><div class="n">Change</div></div>
${list.map(rowHtml).join('\n')}
</div>${notes.length ? `\n<div class="foot" style="margin-top:6px;border:0;padding-top:0">n/a last week: ${esc(notes.join('; '))}.</div>` : ''}
</div>`;
}
// the club scorecard: one more column, the same week last year; the 12-month normal is named under each metric
function clubRow(m) {
  const norm = m.normal != null ? `<i class="norm">12-month normal: ${esc(num(m.normal, m.unit))}${m.unit === '%' ? '' : ' a week'}</i>` : '';
  const lab = `<div class="m">${esc(m.label)}<i>${esc(m.src)}</i>${norm}</div>`;
  if (m.na) return `<div class="mrow c5">${lab}<div class="na">${esc(m.na)}</div></div>`;
  if (m.text != null) return `<div class="mrow c5">${lab}<div class="txt">${esc(m.text)}</div></div>`;
  const cell = (v, why) => (v == null ? `<span class="dash" title="${esc(why || '')}">${why ? 'n/a' : '–'}</span>` : esc(num(v, m.unit)));
  return `<div class="mrow c5">${lab}<div class="n">${cell(m.last, m.lastNa)}</div><div class="n this">${esc(num(m.this, m.unit))}</div><div class="n">${change(m)}</div><div class="n ly">${cell(m.lastYear, m.lastYearNa)}</div></div>`;
}
function clubSection(list, sc) {
  const wk = sc && sc.weekLabel ? `${sc.weekNumber > 0 ? `Week ${sc.weekNumber} since day one (23 Nov)` : sc.weekLabel}` : '';
  const notes = [];
  if (sc && sc.seasonal) notes.push(sc.seasonal);
  if (sc && sc.sameWeekLastYear) notes.push(`Same week last year: ${shortDay(sc.sameWeekLastYear.from)} to ${shortDay(sc.sameWeekLastYear.to)} ${sc.sameWeekLastYear.from.slice(0, 4)}${sc.sameWeekLastYearSeasonal ? ' (' + sc.sameWeekLastYearSeasonal + ' week)' : ''}.`);
  if (sc && sc.dataDay) notes.push(`From the nightly CourtReserve and Patch pull of ${shortDay(sc.dataDay)}${sc.complete ? '' : ': THIS WEEK IS NOT COMPLETE in the data yet'}.`);
  if (sc && !sc.final30d) notes.push('Lapsed members settle 30 days after the Sunday and the 7-day join rate after 7 days.');
  notes.push('Starting point: matthew/clients/peak-pickleball/peak-scorecard-start-2026-11-23.md. These numbers are for this report only.');
  return `<div class="sec">
<h2>Peak Pickleball: club scorecard <span class="n">${list.length}</span>${wk ? ` <small style="font:600 13px 'DM Sans',sans-serif;color:var(--orange)">${esc(wk)}${sc.seasonal ? ' · seasonal' : ''}</small>` : ''}</h2>
<div class="card">
<div class="mrow c5 th"><div>Metric and source</div><div class="n">Last week</div><div class="n">This week</div><div class="n">Change</div><div class="n">Same week last year</div></div>
${list.map(clubRow).join('\n')}
</div>
<div class="foot" style="margin-top:6px;border:0;padding-top:0">${esc(notes.join(' '))}</div>
</div>`;
}
function render(snap) {
  const S = snap.metrics, f = (k, lab) => (S[k].find((m) => m.label === lab) || {});
  const t = (m, unit, label, sub) => ({ n: m.na || m.this == null ? 'n/a' : num(m.this, unit), label, sub: m.na ? m.na : m.last == null ? sub : `${num(m.last, unit)} last week; ${sub}` });
  const T = [
    t(f('sixfold', 'Money collected'), '$', 'Sixfold 365 money in', 'Square, net of refunds'),
    t(f('sixfold', 'New leads'), 'n', 'Sixfold 365 new leads', 'in the app'),
    t(f('peak', 'Outreach emails sent'), 'n', 'Peak outreach emails sent', `${(f('peak', 'People who replied').this ?? 'n/a')} replied`),
    t(f('traverse', 'traverseplatforms.com website visitors'), 'n', 'Traverse website visitors', `${(f('traverse', 'Demo bookings').this ?? 'n/a')} demo bookings`),
  ];
  const na = Object.values(S).flat().filter((m) => m.na).length;
  const body = [
    tiles(T),
    section('Sixfold 365', S.sixfold),
    section('Traverse', S.traverse),
    section('Peak Pickleball: outreach and sponsor desk', S.peak),
    S.peakClub ? clubSection(S.peakClub, snap.raw.peakScore && !snap.raw.peakScore.error ? snap.raw.peakScore : null) : '',
    `<div class="foot">Week ${esc(longDay(snap.start, { weekday: 'short', day: 'numeric', month: 'short' }))} to ${esc(longDay(snap.end, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}, compared with the 7 days before it, Colorado time. Every number above comes from the source named under it, read only; ${na} metric${na === 1 ? ' has' : 's have'} no source yet and ${na === 1 ? 'says' : 'say'} why. Collected ${esc(new Date(snap.raw.collectedAt).toLocaleString('en-US', { timeZone: 'America/Denver', dateStyle: 'medium', timeStyle: 'short' }))} MT by shared/tools/eod/weekly.mjs; snapshot weekly-${esc(snap.end)}.json in ProjectBackup/eod. Sixfold figures are company numbers: keep this inside the company. Surge's numbers are not in this report.</div>`,
  ].join('\n\n');
  return page({
    title: `Business numbers: week to ${longDay(snap.end, { day: 'numeric', month: 'long', year: 'numeric' })}`,
    comment: `Matthew's weekly business numbers, week ${snap.start} to ${snap.end}.`,
    tag: 'Business numbers · weekly',
    h1: `Week to ${longDay(snap.end, { weekday: 'long', day: 'numeric', month: 'long' })}`,
    sub: `${shortDay(snap.start)} to ${shortDay(snap.end)}, against ${shortDay(snap.lastStart)} to ${shortDay(snap.lastEnd)}`,
    right: 'Sixfold 365 · Traverse · Peak',
    body,
  });
}

// ---------------------------------------------------------------------------------------------------------------- main
let snap;
if (argv.includes('--render-only')) {
  snap = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
} else {
  const raw = collect();
  const prev = previous();
  snap = { end: END, start: START, lastStart: LAST_START, lastEnd: LAST_END, comparedWith: prev ? prev.day : null, raw, metrics: build(raw, prev) };
  fs.writeFileSync(SNAP, JSON.stringify(snap, null, 1));
}
fs.mkdirSync(OUTDIR, { recursive: true });
const html = path.join(OUTDIR, `weekly-${END}.html`);
fs.writeFileSync(html, render(snap));
console.log('snapshot ' + SNAP);
console.log('html     ' + html);
if (!argv.includes('--no-pdf')) console.log('pdf      ' + pdf(html));
const na = Object.values(snap.metrics).flat().filter((m) => m.na);
console.log(`${Object.values(snap.metrics).flat().length} metrics, ${na.length} not available yet: ${na.map((m) => m.label).join('; ')}`);
