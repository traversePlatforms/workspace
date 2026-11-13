// The Expo leads seed for the Peak desk (2026-11-13, Matthew: "attach the expo leads to our current peak lead system. Make an
// additional system in there just for expo leads separate from the sponsor prospects but accessible in the same app").
// Reads the venue-rental research (prospects.csv, contacts.csv, and from README.md the questions for Peak and the competing venues)
// and writes data/expo-seed.json. On the server it goes beside the sponsor seed as peak-desk-data/expo-seed.json; the sponsor
// seed.json, peak-records.json and scans.json are never touched by it. Everything done to an expo lead after that is an
// append-only log of its own (expo-events.log), so a rebuild of this seed never loses a stage, note or follow-up.
//
//   node tools/build_expo.cjs            -> data/expo-seed.json (and desk-data-local/expo-seed.json when that folder exists)
//
// Ids are stable: 'x' + 9 hex of the organisation's name, so a rebuild keeps each lead's history.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'venue-rental-2026-11');

function csv(t) {
  t = t.replace(/^﻿/, '');
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const good = rows.filter((r) => r.length > 1 || r[0]);
  const head = good[0].map((h) => h.trim());
  return good.slice(1).map((r, n) => {
    if (r.length !== head.length) throw new Error(`row ${n + 2} has ${r.length} fields, the header ${head.length}`);
    const o = {}; head.forEach((h, i) => { o[h] = (r[i] || '').trim(); }); return o;
  });
}
const urls = (s) => [...new Set((String(s || '').match(/https?:\/\/[^\s;,)]+/g) || []).map((u) => u.replace(/[.]+$/, '')))];
const idOf = (name) => 'x' + crypto.createHash('sha1').update('expo|' + name).digest('hex').slice(0, 9);
const plain = (s) => String(s || '').replace(/\*\*/g, '').trim();

const P = csv(fs.readFileSync(path.join(SRC, 'prospects.csv'), 'utf8'));
const C = csv(fs.readFileSync(path.join(SRC, 'contacts.csv'), 'utf8'));
const byName = {};
const orgs = P.map((r) => {
  const o = {
    id: idOf(r.organisation), pri: +r.priority || 3, cat: r.category, name: r.organisation, events: r.events, venue: r['current venue'],
    size: r['typical size'], last: r['last held'], why: r['why Peak'], site: r.website, route: r['public contact route'],
    srcs: urls(r['source URL']), checked: r['checked date'], contacts: []
  };
  if (byName[o.name]) throw new Error('two rows for ' + o.name);
  byName[o.name] = o; return o;
});
C.forEach((r) => {
  const o = byName[r.organisation]; if (!o) throw new Error('contact for an organisation not in prospects.csv: ' + r.organisation);
  o.contacts.push({
    best: r['best contact'] === 'yes', name: r['contact name'], role: r.role, email: r['business email'], estat: r['email status'],
    phone: r['business phone'], other: r['other route'], srcs: urls(r['source URL(s)']), sdate: r['source date'], conf: r.confidence, notes: r.notes
  });
});
orgs.forEach((o) => o.contacts.sort((a, b) => (b.best ? 1 : 0) - (a.best ? 1 : 0)));   /* the best route first */

/* the README's questions for Peak and the competing venues, as written there */
const md = fs.readFileSync(path.join(SRC, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
const section = (title) => { const i = md.indexOf('\n## ' + title); if (i < 0) throw new Error('README has no section ' + title); const rest = md.slice(i + 4 + title.length); const j = rest.search(/\n## /); return j < 0 ? rest : rest.slice(0, j); };
const qs = section('Limits and questions for Peak').split('\n').map((l) => /^\d+\.\s+\*\*(.+?)\*\*\s*(.*)$/.exec(l)).filter(Boolean)
  .map((m) => ({ h: plain(m[1]).replace(/:$/, ''), p: plain(m[2]) }));
const vsec = section('Competing venues and published rates');
const vnote = plain((vsec.split('\n').find((l) => l.trim() && !l.startsWith('|')) || ''));
const venues = vsec.split('\n').filter((l) => l.startsWith('|')).slice(2).map((l) => l.split('|').slice(1, -1).map(plain))
  .map((c) => ({ venue: c[0], space: c[1], rate: c[2], src: c[3] }));

const seed = {
  built: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Denver' }),   /* Colorado's date, like the desk */
  from: 'venue-rental-2026-11: prospects.csv (checked 12 Nov 2026), contacts.csv (13 Nov 2026), README.md',
  orgs, questions: qs, venues, venueNote: vnote
};
const nC = orgs.reduce((n, o) => n + o.contacts.length, 0);
if (orgs.length !== 64 || nC !== 80 || qs.length !== 10 || venues.length < 8) throw new Error(`unexpected counts: ${orgs.length} orgs, ${nC} contacts, ${qs.length} questions, ${venues.length} venues`);
if (new Set(orgs.map((o) => o.id)).size !== orgs.length) throw new Error('two organisations share an id');
const json = JSON.stringify(seed);
fs.writeFileSync(path.join(ROOT, 'data', 'expo-seed.json'), json);
const local = path.join(ROOT, 'desk-data-local'); if (fs.existsSync(local)) fs.writeFileSync(path.join(local, 'expo-seed.json'), json);
console.log(`expo-seed.json: ${orgs.length} organisations, ${nC} contacts, ${qs.length} questions, ${venues.length} venues, ${json.length} bytes`);
