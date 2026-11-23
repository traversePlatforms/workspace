#!/usr/bin/env node
// The daily "Changes" report (2026-11-23 redesign): what changed in the apps, sites, settings and tools that day, one plain line per item,
// grouped per company, then Running tonight and Waiting on you. The session writes a small JSON (examples/daily-example.json) and runs:
//
//   node shared/tools/eod/daily.mjs <day.json>               changelog/<date>.html + .pdf
//   node shared/tools/eod/daily.mjs <day.json> --changelog   also adds the day's entry at the top of CHANGELOG.md (once per date)
//   node shared/tools/eod/daily.mjs <day.json> --no-pdf
//   node shared/tools/eod/daily.mjs <day.json> --auto       also gathers, read only: Tomorrow (meetings from the Assistant's calendar cache,
//                                                          TASKS.md dated reminders due in the next 7 days), the day's numbers per company,
//                                                          and Team activity (what each person asked J.A.R.V.I.S. for in the three apps)
//
// Input (every list optional; an empty company is left out):
//   { "date": "2026-11-23", "dateTo": "2026-11-24" (catch-up only), "headline": "...",
//     "tiles": [{ "n": "12", "label": "...", "sub": "...", "warn": false }]   (left out: changes, companies touched, running, waiting),
//     "traverse": [item], "sixfold": [item], "peak": [item], "jarvis": [item], "personal": [item],
//     "surge": 3      a COUNT only: renders one line "Surge: 3 changes (see the laptop)". Surge wording is never drafted on this machine.
//     "running": [{ "k": "Lawn batch", "text": "..." }], "waiting": [{ "k": "Claire", "text": "..." }], "foot": "..." }
//   item = { "k": "short label", "when": "21 Nov" (optional), "pill": "live" | "off" | "posted" | "sent" | "run" | "starting", "text": "one plain line" }
//   Filled by --auto when the JSON leaves them out (the JSON wins when it has them):
//   "numbers": [{ "co": "Sixfold 365", "stats": [{ "n": 44, "label": "leads" }], "note": "..." }],
//   "team": [{ "who": "Jen McPherson", "app": "Sixfold app help desk", "n": 2, "items": [{ "text": "...", "status": "answered" }] }],
//   "tomorrow": { "meetings": [{ "time": "8:00 am to 8:30 am", "title": "..." }], "deadlines": [{ "date": "2026-11-24", "text": "..." }], "note": "..." }
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO, OUTDIR, HERE, esc, addDays, longDay, shortDay, page, tiles, pdf } from './lib.mjs';

const argv = process.argv.slice(2);
const inFile = argv.find((a) => !a.startsWith('--'));
if (!inFile) { console.error('usage: node shared/tools/eod/daily.mjs <day.json> [--changelog] [--no-pdf]'); process.exit(2); }
const D = JSON.parse(fs.readFileSync(inFile, 'utf8'));
if (!/^\d{4}-\d\d-\d\d$/.test(D.date || '')) { console.error('"date": "YYYY-MM-DD" is required'); process.exit(2); }
if (argv.includes('--auto')) Object.assign(D, autoGather(D));

const COMPANIES = [
  ['traverse', 'Traverse', 'the field app, editions, website'],
  ['sixfold', 'Sixfold 365', 'app, websites, email'],
  ['peak', 'Peak Pickleball', 'sponsor desk, Outbox and email, data work'],
  ['jarvis', 'J.A.R.V.I.S. and workspace', 'cloud computer, backups, automations'],
  ['personal', 'Personal', ''],
];
const PILL = { live: ['live', 'Live'], off: ['off', 'Built, off'], posted: ['posted', 'Posted'], sent: ['posted', 'Sent'], run: ['run', 'Running'], starting: ['run', 'Starting'] };
const surgeN = Number.isFinite(+D.surge) ? +D.surge : 0;

const itemRow = (it) => {
  const p = PILL[it.pill] ? `<span class="pill ${PILL[it.pill][0]}">${PILL[it.pill][1]}</span>` : '';
  return `  <div class="row"><div class="k">${esc(it.k)}${it.when ? `<i>${esc(it.when)}</i>` : ''}</div><div class="v">${p}${esc(it.text)}</div></div>`;
};
const sec = (title, rows, cls = '', sub = '') => `<div class="sec${cls ? ' ' + cls : ''}">
<h2>${esc(title)} <span class="n">${rows.length}</span>${sub ? ` <small style="font:400 13px 'DM Sans',sans-serif;color:var(--soft)">${esc(sub)}</small>` : ''}</h2>
<div class="card">
${rows.join('\n')}
</div>
</div>`;

const parts = [];
let changes = 0, touched = 0;
for (const [key, name, sub] of COMPANIES) {
  const list = Array.isArray(D[key]) ? D[key] : [];
  if (!list.length) continue;
  changes += list.length; touched++;
  parts.push(sec(name, list.map(itemRow), '', sub));
}
if (surgeN > 0) {
  changes += surgeN; touched++;
  parts.push(sec('Surge', [`  <div class="row"><div class="k">Surge</div><div class="v">Surge: ${surgeN} change${surgeN === 1 ? '' : 's'} (see the laptop)</div></div>`]).replace('<span class="n">1</span>', `<span class="n">${surgeN}</span>`));
}
// Team activity: what each person got done through J.A.R.V.I.S. that day (one line per person and app)
const STATUS = { new: 'waiting', working: 'being worked on', answered: 'answered', matthew: 'waiting on Matthew', closed: 'done' };
const team = Array.isArray(D.team) ? D.team : null;
if (team) parts.push(sec('Team activity', team.length ? team.map((p) => `  <div class="row"><div class="k">${esc(p.who)}<i>${esc(p.app)}</i></div><div class="v"><b>${p.n} request${p.n === 1 ? '' : 's'}:</b> ${esc(p.items.map((x) => `${x.text} (${STATUS[x.status] || x.status})`).join('; '))}</div></div>`)
  : [`  <div class="row"><div class="k">Nobody</div><div class="v"><em>No one asked J.A.R.V.I.S. for anything in the Sixfold app, the post calendar or the Peak desk today.</em></div></div>`], '', 'J.A.R.V.I.S. in the Sixfold app, post calendar and Peak desk').replace(/<span class="n">\d+<\/span>/, `<span class="n">${team.reduce((a, p) => a + p.n, 0)}</span>`));
const running = Array.isArray(D.running) ? D.running : [], waiting = Array.isArray(D.waiting) ? D.waiting : [];
if (running.length) parts.push(sec('Running tonight', running.map((r) => itemRow({ ...r, pill: r.pill || 'run' }))));
// Tomorrow: tomorrow's meetings, then the dated reminders due in the next 7 days
const tm = D.tomorrow && typeof D.tomorrow === 'object' ? D.tomorrow : null;
if (tm) {
  const rows = [];
  const tday = addDays(D.dateTo || D.date, 1);
  if (tm.meetingsError) rows.push(`  <div class="row"><div class="k">Meetings</div><div class="v"><em>Calendar not read: ${esc(tm.meetingsError)}</em></div></div>`);
  else if (!(tm.meetings || []).length) rows.push(`  <div class="row"><div class="k">Meetings</div><div class="v"><em>Nothing on the calendar for ${esc(shortDay(tday))}.</em></div></div>`);
  for (const m of tm.meetings || []) rows.push(`  <div class="row"><div class="k">${esc(m.time)}<i>${esc(shortDay(tday))}</i></div><div class="v">${esc(m.title)}</div></div>`);
  for (const d of tm.deadlines || []) rows.push(`  <div class="row dl"><div class="k">${esc(shortDay(d.date))}<i>due${d.date === tday ? ' tomorrow' : ''}</i></div><div class="v">${esc(d.text)}</div></div>`);
  if (tm.deadlinesError) rows.push(`  <div class="row"><div class="k">Deadlines</div><div class="v"><em>${esc(tm.deadlinesError)}</em></div></div>`);
  else if (!(tm.deadlines || []).length) rows.push(`  <div class="row"><div class="k">Deadlines</div><div class="v"><em>No dated reminders in TASKS.md for the next 7 days.</em></div></div>`);
  parts.push(sec('Tomorrow', rows, 'tmrw', tm.note || '').replace(/<span class="n">\d+<\/span>/, `<span class="n">${(tm.meetings || []).length + (tm.deadlines || []).length}</span>`));
}
if (waiting.length) parts.push(sec('Waiting on you', waiting.map((r) => `  <div class="row"><div class="k">${esc(r.k)}</div><div class="v">${esc(r.text)}</div></div>`), 'wait'));

const T = D.tiles && D.tiles.length ? D.tiles : [
  { n: String(changes), label: 'Changes today', sub: `across ${touched} compan${touched === 1 ? 'y' : 'ies'} and the workspace` },
  { n: String(COMPANIES.filter(([k]) => (D[k] || []).length).length + (surgeN ? 1 : 0)), label: 'Areas touched', sub: COMPANIES.filter(([k]) => (D[k] || []).length).map(([, n]) => n).concat(surgeN ? ['Surge'] : []).join(' · ') },
  { n: String(running.length), label: 'Running tonight', sub: running.map((r) => r.k).join(' · ') || 'nothing' },
  { n: String(waiting.length), label: 'Waiting on you', sub: 'Listed at the bottom', warn: waiting.length > 0 },
];
const span = D.dateTo && D.dateTo !== D.date;
const h1 = span ? `${longDay(D.date, { weekday: 'long', day: 'numeric' })} to ${longDay(D.dateTo)}` : longDay(D.date);
const html = page({
  title: `End of day: ${h1}`,
  comment: `Matthew's daily changes report for ${D.date}${span ? ' to ' + D.dateTo : ''}.`,
  tag: span ? 'End of day · catch-up' : 'End of day · changes',
  h1,
  sub: D.headline || 'What changed today in the apps, sites, settings and tools',
  right: COMPANIES.filter(([k]) => (D[k] || []).length).map(([, n]) => n.split(' ')[0]).join(' · '),
  body: [tiles(T), numbersStrip(D.numbers), ...parts, `<div class="foot">${esc(D.foot || 'Full detail of every change is in the workspace\'s git history. Business numbers are in the weekly report (Sundays).')}</div>`].join('\n\n'),
});
fs.mkdirSync(OUTDIR, { recursive: true });
const out = path.join(OUTDIR, `${D.date}.html`);
if (D._autoErrors && D._autoErrors.length) console.log('auto: ' + D._autoErrors.join('; '));
fs.writeFileSync(out, html);
console.log('html ' + out);
if (!argv.includes('--no-pdf')) console.log('pdf  ' + pdf(out));

// CHANGELOG.md: one bullet per company, the items joined; inserted after the header's "---", once per date
if (argv.includes('--changelog')) {
  const f = path.join(REPO, 'CHANGELOG.md'); const md = fs.readFileSync(f, 'utf8');
  const head = `## ${D.date}${span ? ' to ' + D.dateTo : ''} (${longDay(D.date, { weekday: 'long' })}${span ? ' to ' + longDay(D.dateTo, { weekday: 'long' }) + ', catch-up' : ''})`;
  if (md.includes(`\n## ${D.date}`)) console.log('CHANGELOG.md already has ' + D.date + ': left as it is');
  else {
    const lines = [head, ''];
    for (const [key, name] of COMPANIES) if ((D[key] || []).length) lines.push(`- **${name}:** ${D[key].map((i) => `${i.k}: ${i.text.replace(/\.$/, '')}`).join('; ')}.`);
    if (surgeN) lines.push(`- **Surge:** ${surgeN} change${surgeN === 1 ? '' : 's'} (see the laptop).`);
    if (running.length) lines.push(`- **Running tonight:** ${running.map((r) => r.k).join('; ')}.`);
    if (waiting.length) lines.push(`- **Waiting on you:** ${waiting.map((r) => r.k).join('; ')}.`);
    const at = md.indexOf('\n---\n'); if (at < 0) { console.error('CHANGELOG.md: no --- line to insert after'); process.exit(1); }
    fs.writeFileSync(f, md.slice(0, at + 5) + '\n' + lines.join('\n') + '\n' + md.slice(at + 5));
    console.log('CHANGELOG.md: entry added for ' + D.date);
  }
}

// ---------------------------------------------------------------------------------------------------------------- the day's numbers
// a small strip per company: counts only, the same sources as the weekly report for a 1-day window
function numbersStrip(list) {
  if (!Array.isArray(list) || !list.length) return '';
  const card = (c) => `<div class="nc"><div class="co">${esc(c.co)}</div><div class="st">${c.error ? `<em>${esc(c.error)}</em>` : c.stats.map((x) => `<span><b>${esc(x.n == null ? 'n/a' : Number(x.n).toLocaleString('en-US'))}</b> ${esc(x.label)}</span>`).join('')}</div>${c.note ? `<small>${esc(c.note)}</small>` : ''}</div>`;
  return `<div class="sec"><h2>The day's numbers <small style="font:400 13px 'DM Sans',sans-serif;color:var(--soft)">counts only; the weekly report has the rest</small></h2>
<div class="nstrip">${list.map(card).join('')}</div></div>`;
}

// ---------------------------------------------------------------------------------------------------------------- --auto
// READ ONLY. Server numbers over bash ~/jarvis/bin/sg.sh trav with the read scripts in server/ piped to php (never installed there):
// day.php (calendar cache + J.A.R.V.I.S. chats), sixfold-week.php and reads.php for a 1-day window. TASKS.md is read locally.
function autoGather(D) {
  const day = D.dateTo || D.date, tom = addDays(day, 1), errs = [];
  const SG = process.env.JARVIS_SG_SH || path.join(process.env.HOME || '', 'jarvis', 'bin', 'sg.sh');
  const sg = (script, args) => {
    try {
      const out = execFileSync('bash', [SG, 'trav', `php -- ${args.join(' ')}`], { input: fs.readFileSync(path.join(HERE, 'server', script)), timeout: 300000, maxBuffer: 16 << 20 }).toString();
      const j = JSON.parse(out.trim().split('\n').pop()); if (j && j.ok === false) throw new Error(j.error || 'not ok'); return j;
    } catch (e) { errs.push(`${script}: ${String(e.message || e).split('\n')[0].slice(0, 120)}`); return null; }
  };
  const got = {};
  const dj = sg('day.php', [day, tom]);
  // ---- Tomorrow
  if (!D.tomorrow) {
    const tmw = { meetings: [], deadlines: [] };
    const cal = dj && dj.calendar;
    if (!cal) tmw.meetingsError = 'the server did not answer';
    else if (cal.error) tmw.meetingsError = cal.error;
    else { tmw.meetings = cal.events; tmw.note = `${cal.source || 'Traverse'} calendar, as the Assistant last read it (${new Date(cal.cachedAt * 1000).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} MT)`; }
    try { tmw.deadlines = datedReminders(day, 7); } catch (e) { tmw.deadlinesError = 'TASKS.md could not be read'; }
    got.tomorrow = tmw;
  }
  // ---- Team activity
  if (!D.team) {
    if (dj && dj.team) {
      const T = [];
      for (const a of Object.values(dj.team)) for (const [who, items] of Object.entries(a.people || {})) T.push({ who, app: a.label, n: items.length, items });
      T.sort((x, y) => y.n - x.n || x.who.localeCompare(y.who));
      got.team = T;
    } else errs.push('team activity: no answer');
  }
  // ---- the day's numbers
  if (!D.numbers) {
    const sx = sg('sixfold-week.php', [day, day]), rd = sg('reads.php', [day, day]);
    const N = [];
    const st = sx && sx.weeks && sx.weeks.this;
    N.push(st ? { co: 'Sixfold 365', stats: [{ n: st.leads, label: 'leads' }, { n: st.quotes, label: 'quotes sent' }, { n: st.booked, label: 'jobs booked' }], note: 'Sixfold 365 app' } : { co: 'Sixfold 365', error: 'the app did not answer' });
    const pm = rd && rd.peakmail && !rd.peakmail.error ? rd.peakmail.this : null, pw = rd && rd.peakwins && !rd.peakwins.error ? rd.peakwins : null;
    N.push(pm || pw ? { co: 'Peak Pickleball', stats: [{ n: pm ? pm.sent : null, label: 'emails sent' }, { n: pm ? pm.reply : null, label: pm && pm.reply === 1 ? 'reply' : 'replies' }, { n: pw ? (pw.sponsor.this.toursBooked || 0) + ((pw.expo && pw.expo.this.toursBooked) || 0) : null, label: 'tours booked' }], note: 'outreach sender and desk logs' } : { co: 'Peak Pickleball', error: 'the server did not answer' });
    const ts = rd && rd.sites && rd.sites.traverse && !rd.sites.traverse.error ? rd.sites.traverse.this : null;
    N.push(ts ? { co: 'Traverse', stats: [{ n: ts.visitors, label: 'site visitors' }, { n: rd.demos && !rd.demos.error ? rd.demos.this.booked : null, label: 'demos booked' }], note: 'cookie-free site counting' } : { co: 'Traverse', error: 'site counting did not answer' });
    got.numbers = N;
  }
  got._autoErrors = errs;
  return got;
}

// TASKS.md "Dated reminders": rows whose When names a day from tomorrow to `days` ahead. Struck-through and DONE rows are left out; a
// row listing several days (a repeating reminder) counts by its next one. Surge rows show as a count only (no Surge wording here).
function datedReminders(day, days) {
  const md = fs.readFileSync(path.join(REPO, 'TASKS.md'), 'utf8');
  const a = md.indexOf('Dated reminders'); if (a < 0) throw new Error('no section');
  const sec = md.slice(a, md.indexOf('\n## ', a + 10) > 0 ? md.indexOf('\n## ', a + 10) : undefined);
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const from = addDays(day, 1), to = addDays(day, days), y0 = +day.slice(0, 4);
  const out = []; let surge = 0, surgeAt = '';
  for (const line of sec.split('\n')) {
    const m = /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/.exec(line); if (!m || /^-+$/.test(m[1].replace(/\s/g, '')) || /^when$/i.test(m[1])) continue;
    const when = m[1], what = m[2];
    if (/^~~/.test(when) || /\bDONE\b|\bDROPPED\b|\bREMOVED\b/.test(when)) continue;
    const ds = [];
    for (const x of when.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?(?:\s+(20\d\d))?/gi)) {
      const mo = MON[x[2].slice(0, 3).toLowerCase()], d = +x[1];
      const cands = x[3] ? [+x[3]] : [y0, y0 + 1];
      for (const y of cands) ds.push(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    const next = ds.filter((d) => d >= from && d <= to).sort()[0];
    if (!next) continue;
    const bold = /\*\*(.+?)\*\*/.exec(what);
    if (/\bsurge\b|\bSG-\d/i.test(bold ? bold[1] : what.slice(0, 80))) { surge++; if (!surgeAt || next < surgeAt) surgeAt = next; continue; }
    let text = (bold ? bold[1] : what).replace(/\*\*|~~|`/g, '').replace(/\s+/g, ' ').trim();
    if (text.length > 140) text = text.slice(0, 138).replace(/\s+\S*$/, '') + '…';
    out.push({ date: next, text });
  }
  if (surge) out.push({ date: surgeAt, text: `Surge: ${surge} dated item${surge === 1 ? '' : 's'} (see the laptop)` });
  return out.sort((p, q) => (p.date < q.date ? -1 : p.date > q.date ? 1 : 0));
}
