#!/usr/bin/env node
// The daily "Changes" report (2026-11-23 redesign): what changed in the apps, sites, settings and tools that day, one plain line per item,
// grouped per company, then Running tonight and Waiting on you. The session writes a small JSON (examples/daily-example.json) and runs:
//
//   node shared/tools/eod/daily.mjs <day.json>               changelog/<date>.html + .pdf
//   node shared/tools/eod/daily.mjs <day.json> --changelog   also adds the day's entry at the top of CHANGELOG.md (once per date)
//   node shared/tools/eod/daily.mjs <day.json> --no-pdf
//
// Input (every list optional; an empty company is left out):
//   { "date": "2026-11-23", "dateTo": "2026-11-24" (catch-up only), "headline": "...",
//     "tiles": [{ "n": "12", "label": "...", "sub": "...", "warn": false }]   (left out: changes, companies touched, running, waiting),
//     "traverse": [item], "sixfold": [item], "peak": [item], "jarvis": [item], "personal": [item],
//     "surge": 3      a COUNT only: renders one line "Surge: 3 changes (see the laptop)". Surge wording is never drafted on this machine.
//     "running": [{ "k": "Lawn batch", "text": "..." }], "waiting": [{ "k": "Claire", "text": "..." }], "foot": "..." }
//   item = { "k": "short label", "when": "21 Nov" (optional), "pill": "live" | "off" | "posted" | "sent" | "run" | "starting", "text": "one plain line" }
import fs from 'node:fs';
import path from 'node:path';
import { REPO, OUTDIR, esc, longDay, page, tiles, pdf } from './lib.mjs';

const argv = process.argv.slice(2);
const inFile = argv.find((a) => !a.startsWith('--'));
if (!inFile) { console.error('usage: node shared/tools/eod/daily.mjs <day.json> [--changelog] [--no-pdf]'); process.exit(2); }
const D = JSON.parse(fs.readFileSync(inFile, 'utf8'));
if (!/^\d{4}-\d\d-\d\d$/.test(D.date || '')) { console.error('"date": "YYYY-MM-DD" is required'); process.exit(2); }

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
const running = Array.isArray(D.running) ? D.running : [], waiting = Array.isArray(D.waiting) ? D.waiting : [];
if (running.length) parts.push(sec('Running tonight', running.map((r) => itemRow({ ...r, pill: r.pill || 'run' }))));
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
  body: [tiles(T), ...parts, `<div class="foot">${esc(D.foot || 'Full detail of every change is in the workspace\'s git history. Business numbers are in the weekly report (Sundays).')}</div>`].join('\n\n'),
});
fs.mkdirSync(OUTDIR, { recursive: true });
const out = path.join(OUTDIR, `${D.date}.html`);
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
