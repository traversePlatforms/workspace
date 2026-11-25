#!/usr/bin/env node
// Peak Pickleball weekly report for Matthew (25 Nov 2026, his words: "a weekly report every saturday or so that compares where we are at now
// to where we were at during that time. Launch by pdf" ... "keep the review on sunday"). For Matthew only: how his work since day one
// (Mon 23 Nov 2026) moves Peak's numbers. Every Sunday night: this week (Mon-Sun) against Week 0 (16-22 Nov 2026, the week before he
// started), the 12-month normal and the same week last year.
//
//   node tools/peak-weekly.mjs                 the week ending the latest Sunday (Colorado time), HTML + PDF in data/reports/ (gitignored)
//   node tools/peak-weekly.mjs --end 2026-11-29
//   node tools/peak-weekly.mjs --send          also put it on J.A.R.V.I.S.'s Reports shelf and post it in his main thread (phone alert)
//
// READ ONLY: everything comes from the local store the nightly pull keeps (data/pulls/store). The club numbers are impact.mjs's WEEK MODE
// (57 measures, definitions there and in impact-measurement-2026-11-23.md); Google Business Profile is added here from store/gbp.
// Google finishes its numbers about 3 days late, so the Google rows read the week BEFORE this one, and say so.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readStore, addDays } from './pull-lib.mjs';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(TOOLS, '..', '..', '..', '..');
const { page, esc, pdf, denverDate, longDay, shortDay } = await import(path.join(REPO, 'shared/tools/eod/lib.mjs'));
const argv = process.argv.slice(2), opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const START = '2026-11-23', W0END = '2026-11-22';
let END = opt('--end');
if (!END) { END = denverDate(); while (new Date(END + 'T12:00:00Z').getUTCDay() !== 0) END = addDays(END, -1); }
if (new Date(END + 'T12:00:00Z').getUTCDay() !== 0) { console.error('--end must be a Sunday'); process.exit(2); }

const week = (end) => JSON.parse(execFileSync('node', [path.join(TOOLS, 'impact.mjs'), `--week-end=${end}`, '--json'], { maxBuffer: 32 << 20, timeout: 300000 }).toString());
const T = week(END), Z = END === W0END ? T : week(W0END);
const z = Object.fromEntries(Z.metrics.map((m) => [m.key, m.this]));

// ---- Google Business Profile, from the store (counts per week; normal = average week over the same 12 months as the club's normal) -------
const g = readStore('gbp/daily'), rv = readStore('gbp/reviews');
const inR = (d, a, b) => d >= a && d <= b;
const gsum = (a, b, f) => g.filter((r) => inR(r.date, a, b)).reduce((s, r) => s + f(r), 0);
const NORM = T.normal, nWeeks = ((Date.parse(NORM.to) - Date.parse(NORM.from)) / 864e5 + 1) / 7;
const GW = { to: addDays(END, -7) }; GW.from = addDays(GW.to, -6);              // Google's latest finished week
const G0 = { from: addDays(W0END, -6), to: W0END };
const GLY = { from: addDays(GW.from, -364), to: addDays(GW.to, -364) };
const RW = { from: addDays(END, -6), to: END }, RLY = { from: addDays(RW.from, -364), to: addDays(END, -364) };
const gRow = (key, label, f, better = 'up') => ({ key, label, unit: 'n', better,
  this: gsum(GW.from, GW.to, f), w0: gsum(G0.from, G0.to, f), normal: Math.round(10 * gsum(NORM.from, NORM.to, f) / nWeeks) / 10, lastYear: gsum(GLY.from, GLY.to, f) });
const rIn = (a, b) => rv.filter((r) => inR(r.date, a, b));
const avgStars = (xs) => (xs.length ? Math.round(100 * xs.reduce((s, r) => s + (r.stars || 0), 0) / xs.length) / 100 : null);
const rRow = (key, label, f, unit = 'n', better = 'up') => ({ key, label, unit, better, this: f(rIn(RW.from, RW.to)), w0: f(rIn(G0.from, G0.to)),
  normal: unit === 'n' ? Math.round(10 * f(rIn(NORM.from, NORM.to)) / nWeeks) / 10 : f(rIn(NORM.from, NORM.to)), lastYear: f(rIn(RLY.from, RLY.to)) });
const google = [
  gRow('gViews', 'Profile views (Search and Maps)', (r) => r.views || 0),
  gRow('gSearch', 'Views from Google Search', (r) => (r.views_mobile_search || 0) + (r.views_desktop_search || 0)),
  gRow('gMaps', 'Views from Google Maps', (r) => (r.views_mobile_maps || 0) + (r.views_desktop_maps || 0)),
  gRow('gCalls', 'Calls from the profile', (r) => r.calls || 0),
  gRow('gWeb', 'Website clicks from the profile', (r) => r.website_clicks || 0),
  gRow('gDir', 'Direction requests', (r) => r.directions || 0),
  rRow('rNew', 'New Google reviews', (xs) => xs.length),
  rRow('rStars', 'Average stars of new reviews', avgStars, 's'),
  rRow('rReplied', 'New reviews Peak replied to', (xs) => xs.filter((r) => r.replied).length),
];
const allRev = rv.length, allAvg = avgStars(rv), allReplied = rv.filter((r) => r.replied).length;

// ---- sections ---------------------------------------------------------------------------------------------------------------------------
const SECTIONS = [
  ['Members and dues', ['payingDues', 'listActive', 'listSuspended', 'newMembers', 'lapsed', 'duesCollected', 'ret30', 'ret60', 'ret90', 'starterUpgrade90', 'winBack90']],
  ['New players and the free class', ['freeFirstTimers', 'freeAttendance', 'freeJoined7d', 'newAccounts', 'regulars', 'regJoin30', 'regJoin60']],
  ['Courts and play', ['checkins', 'players', 'util', 'util3to5', 'util5to8', 'openPlayFill', 'openPlayFull', 'eventRegs', 'eventCancels', 'cancelRate', 'waitlist']],
  ['Billing', ['duesLate', 'duesLateMedianDays', 'duesUnpaid', 'duesSuspended', 'duesRecovered', 'birthdayIndex', 'birthdayGearIndex']],
  ['Facebook, Instagram and ads', ['fbFollowers', 'fbFollowChange', 'fbPosts', 'fbReach', 'fbEngagement', 'igFollowers', 'igFollowChange', 'igPosts', 'igReach', 'igEngaged', 'adSpend', 'adLinkClicks', 'adLeads', 'adCpc', 'adCpl']],
  ['Member emails (Patch)', ['patchSent', 'patchBlasts', 'patchAutomations', 'openRate', 'clickRate', 'unsubRate']],
];
const byKey = Object.fromEntries(T.metrics.map((m) => [m.key, { ...m, w0: z[m.key] }]));
const used = new Set(SECTIONS.flatMap((s) => s[1]));
const extra = T.metrics.filter((m) => !used.has(m.key)).map((m) => m.key);   // a measure added to impact.mjs later still shows
if (extra.length) SECTIONS.push(['Other measures', extra]);

const fmt = (v, u) => {
  if (v == null || Number.isNaN(v)) return '<span class="dash">-</span>';
  if (u === '$') return '$' + Math.round(v).toLocaleString('en-US');
  if (u === '$2') return '$' + Number(v).toFixed(2);
  if (u === '%') return Number(v).toFixed(1) + '%';
  if (u === 's') return Number(v).toFixed(2) + '★';
  return Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 });
};
function change(m) {   // this week against Week 0: points for rates, percent for counts and money
  const a = m.this, b = m.w0; if (a == null || b == null || END === W0END) return '<span class="dash">-</span>';
  let d, txt;
  if (m.unit === '%' || m.unit === 's') { d = a - b; txt = (d > 0 ? '+' : '') + d.toFixed(m.unit === 's' ? 2 : 1) + (m.unit === '%' ? ' pts' : ''); }
  else { if (!b) return a ? '<span class="chg">new</span>' : '<span class="chg">0</span>'; d = a - b; txt = (d > 0 ? '+' : '') + Math.round((100 * d) / Math.abs(b)) + '%'; }
  const good = !m.better || d === 0 ? '' : (d > 0) === (m.better === 'up') ? 'up' : 'down';
  return `<span class="chg ${good}">${esc(txt)}</span>`;
}
const head = `<div class="mrow c6 th"><span>Measure</span><span class="n">This week</span><span class="n">Week 0</span><span class="n">Normal week</span><span class="n">Last year</span><span class="n">vs Week 0</span></div>`;
const rowH = (m) => `<div class="mrow c6"><span class="m">${esc(m.label)}</span><span class="n this">${fmt(m.this, m.unit)}</span><span class="n">${fmt(m.w0, m.unit)}</span><span class="n ly">${fmt(m.normal, m.unit)}</span><span class="n ly">${fmt(m.lastYear, m.unit)}</span><span class="n">${change(m)}</span></div>`;

const tiles = ['payingDues', 'checkins', 'newMembers', 'duesCollected'].map((k) => byKey[k]).filter(Boolean)
  .map((m) => `<div class="kpi"><b>${fmt(m.this, m.unit)}</b><span>${esc(m.label)}</span><small>Week 0: ${fmt(m.w0, m.unit)} · ${change(m)}</small></div>`).join('\n');
const seasonal = [T.seasonal, T.sameWeekLastYearSeasonal].filter(Boolean).map((s) => `<p class="note">${esc(s)}</p>`).join('');
const notFinal = !T.final7d ? '<p class="note">Some measures look a week or more past the week (sign-ups after a free class, lapses, late dues), so this week\'s values for those can still change. Each one is final once its follow-up time has passed.</p>' : '';
const defs = T.metrics.filter((m) => m.note).map((m) => `<li><b>${esc(m.label)}:</b> ${esc(m.note)}</li>`).join('');

const body = `
<div class="kpis k4">${tiles}</div>
<p class="note"><b>${esc(T.weekLabel)}</b>: ${esc(longDay(T.week.from, { day: 'numeric', month: 'short' }))} to ${esc(longDay(T.week.to, { day: 'numeric', month: 'short', year: 'numeric' }))}.
Week 0 is ${esc(shortDay(Z.week.from))} to ${esc(shortDay(Z.week.to))}, the week before you started (${esc(shortDay(START))}). Normal week = the average week over ${esc(longDay(NORM.from, { month: 'short', year: 'numeric' }))} to ${esc(longDay(NORM.to, { month: 'short', year: 'numeric' }))} (an average day for counts that are a level, like members). Last year = the same week, 364 days earlier.</p>
${seasonal}${notFinal}
${SECTIONS.map(([t, keys]) => `<div class="sec"><h2>${esc(t)}</h2><div class="card">${head}${keys.map((k) => byKey[k]).filter(Boolean).map(rowH).join('')}</div></div>`).join('\n')}
<div class="sec"><h2>Google listing</h2><div class="card">${head}${google.map(rowH).join('')}</div>
<p class="note">Views, calls, website clicks and directions are for ${esc(shortDay(GW.from))} to ${esc(shortDay(GW.to))}: Google finishes its counts about 3 days late, so they run one week behind the rest. Reviews are this week. All time: ${allRev} reviews, ${allAvg}★ average, Peak has replied to ${allReplied}.</p></div>
${(T.notAvailable || []).length ? `<div class="sec"><h2>Not in this report yet</h2><div class="card">${T.notAvailable.map((n) => `<div class="mrow c6"><span class="m">${esc(n.label)}</span><span class="txt">${esc(n.why)}</span></div>`).join('')}</div></div>` : ''}
<div class="sec defs"><h2>How each number is counted</h2><ul>${defs}<li><b>Google listing:</b> Google Business Profile API, read nightly (tools/gbp-pull.mjs). Reviews are stored as stars, dates and replied yes/no, no names.</li></ul></div>
<div class="foot">For Matthew only. Made ${esc(longDay(denverDate()))} from the nightly read-only pull (data through ${esc(T.dataDay)}) by tools/peak-weekly.mjs. Club definitions: impact-measurement-2026-11-23.md.</div>`;

const css = `<style>.mrow.c6{grid-template-columns:1fr 84px 84px 84px 84px 84px}.mrow.c6 .txt{grid-column:2 / 7}.kpis.k4{grid-template-columns:repeat(4,1fr)}
.note{color:var(--soft);font-size:12.5px;margin:6px 2px}.defs ul{font-size:11px;color:var(--soft);padding-left:18px;columns:2;column-gap:22px}.defs li{break-inside:avoid;margin-bottom:4px}
@media print{.mrow.c6{padding:5px 14px}.mrow.c6 .m{font-weight:600}.kpis.k4 .kpi b{font-size:24px}}</style>`;
let html = page({ title: `Peak weekly report, ${T.weekLabel}`, comment: 'Peak weekly report for Matthew.', tag: 'Peak Pickleball · for Matthew',
  h1: `Peak weekly report`, sub: `${T.weekLabel.replace(/ \(.*\)$/, '')} · ${shortDay(T.week.from)} to ${shortDay(T.week.to)}, compared with before you started`, body });
html = html.replace('</head>', css + '</head>').replaceAll("url('../traverse/", `url('file://${REPO}/traverse/`);
const OUT = path.join(TOOLS, '..', 'data', 'reports'); fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, `peak-weekly-${END}.html`); fs.writeFileSync(file, html);
const p = pdf(file);
console.log('wrote', p);

if (argv.includes('--send')) {
  const nice = path.join(OUT, `Peak-weekly-report-${END}.pdf`); fs.copyFileSync(p, nice);
  const msg = `Your Peak weekly report: ${T.weekLabel.replace(/ \(.*\)$/, '')}, ${shortDay(T.week.from)} to ${shortDay(T.week.to)}, against Week 0 (the week before you started). Open the PDF below.`;
  // 25 Nov: onto J.A.R.V.I.S.'s Reports shelf first (right-hand Reports button), then the message with the PDF in his main thread
  const title = `Peak weekly report · ${T.weekLabel.replace(/ \(.*\)$/, '')} · ${shortDay(T.week.from)} to ${shortDay(T.week.to)}`;
  const shelf = execFileSync('bash', [path.join(process.env.HOME, 'jarvis', 'bin', 'sg.sh'), 'trav', `php ~/www/traverseplatforms.com/assistant-private/jvreport-add.php ${path.basename(nice)} '${title.replace(/'/g, '')}' ${END}`], { input: fs.readFileSync(nice), timeout: 120000 }).toString().trim();
  console.log('reports shelf:', shelf);
  execFileSync('bash', [path.join(REPO, 'assistant/jarvis/tools/jarvis-reply.sh'), 'main', 'answered', '--pdf', nice], { input: msg, stdio: ['pipe', 'inherit', 'inherit'], timeout: 120000 });
}
