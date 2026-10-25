// Peak's own sponsor tracker -> peak-records.json for the desk (2026-10-25, Matthew: "redo our current sponsor section with the information
// that Nneka gave us"). Reads the sheet's rows (as JSON, from the unzipped .xlsx) and the desk's lead list (id, list, name), matches by name,
// and writes one entry per sponsor: { id, name, kind, why, peak: [records], contacts }. New sponsors get an id from their name.
// The money figures stay out of git: write the output to desk-data-local/ (ignored) and upload it beside seed.json on the server.
//   node tools/peak-records.cjs <rows.json> <leads.tsv> <out.json>
const fs = require('fs'), crypto = require('crypto');
const [ROWS, LEADS, OUT] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(ROWS, 'utf8'));
const leads = fs.readFileSync(LEADS, 'utf8').split(/\r?\n/).map((l) => l.split('\t')).filter((p) => p.length === 3 && /^[0-9a-f]{10}$/.test(p[0]));
const norm = (s) => String(s).toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/\(.*?\)/g, ' ').replace(/\b(the|inc|llc|co|of colorado springs|of colorado|and trust|realtors|tech|pizzeria|pizzaria)\b/g, ' ').replace(/[^a-z0-9]+/g, '');
const ALIAS = { 'cutting edge': 'The Cutting Edge Realtors', roofcorp: 'Roof Corp of Colorado Springs', 'red rocks pizzeria': 'Red Rock Pizzaria', togetherwon: 'Together Won', 'whataburger (burgerworks)': 'Whataburger', 'think smart': 'Think Smart Tech', 'integrity bank': 'Integrity Bank & Trust' };
const day = (v) => { const s = String(v ?? '').trim(); if (/^\d{5}$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + +s * 864e5).toISOString().slice(0, 10); return s; };
const num = (v) => { const s = String(v ?? '').trim(); return /^\d+(\.\d+)?$/.test(s) ? +s : s; };
const okDate = (s) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(s + 'T12:00:00Z'); return d.toISOString().slice(0, 10) === s; };
const out = new Map();
for (const r of rows.slice(3)) {
  const g = (i) => String(r[i] ?? '').trim(); if (!g(0)) continue;
  const rec = { status: g(1), type: g(2), signage: g(3), planned: g(4), action: g(5), install: g(6), ops: g(7), start: day(r[9]), end: day(r[10]), value: num(r[11]), paid: num(r[12]), freq: g(13), invoice: g(14), history: g(15), verify: g(16), budget: g(17) };
  const checks = rec.verify ? [rec.verify] : [];
  for (const k of ['start', 'end']) if (rec[k] && !okDate(rec[k]) && !/unsure/i.test(rec[k]) && !checks.some((c) => c.includes(rec[k]))) checks.push(`${k === 'start' ? 'Start' : 'End'} date "${rec[k]}" isn't a real date`);
  if (okDate(rec.start) && okDate(rec.end) && rec.end < rec.start && !checks.some((c) => /precedes/i.test(c))) checks.push('End date is before the start date');
  rec.verify = checks.join('; ');
  for (const k of Object.keys(rec)) if (rec[k] === '') delete rec[k];
  const key = ALIAS[g(0).toLowerCase()] || g(0), hit = leads.find((l) => norm(l[2]) === norm(key));
  const id = hit ? hit[0] : crypto.createHash('sha1').update('peak-sponsor|' + norm(g(0))).digest('hex').slice(0, 10);
  const e = out.get(id) || { id, name: hit ? hit[2] : g(0), kind: rec.type || '', peak: [], contacts: [] };
  e.peak.push(rec);
  for (const m of g(8).replace(/^"[^"]*"\s*</, '').replace(/>$/, '').split(/[,;\s]+/)) if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(m) && !e.contacts.some((c) => c.email.toLowerCase() === m.toLowerCase())) e.contacts.push({ name: 'Contact on Peak’s tracker', pos: '', email: m, conf: null, pick: false, phone: '' });
  out.set(id, e);
}
const RANK = { active: 0, 'active tenant': 0, 'pending agreement': 1, inactive: 2 };
for (const e of out.values()) {
  e.peak.sort((a, b) => (RANK[String(a.status).toLowerCase()] ?? 3) - (RANK[String(b.status).toLowerCase()] ?? 3));   /* the live record first */
  e.kind = [...new Set(e.peak.map((p) => p.type).filter(Boolean))].join(' + ');
  const s = String(e.peak[0].status || '').toLowerCase();
  e.why = s.startsWith('active') ? 'Current Peak sponsor (Peak’s tracker, 25 Oct 2026)' : s.startsWith('pending') ? 'Agreement pending (Peak’s tracker, 25 Oct 2026)' : 'Former Peak sponsor (Peak’s tracker, 25 Oct 2026): ask about renewing';
}
fs.writeFileSync(OUT, JSON.stringify({ updated: '2026-10-25', source: 'Peak_Pickleball_Sponsorship_Tracker.xlsx (from Nneka)', leads: [...out.values()] }, null, 1));
const v = [...out.values()];
console.log(`${v.length} sponsors (${v.filter((e) => leads.some((l) => l[0] === e.id)).length} already on the desk, ${v.filter((e) => !leads.some((l) => l[0] === e.id)).length} new); ` +
  `active ${v.filter((e) => /^active/i.test(e.peak[0].status)).length}, pending ${v.filter((e) => /^pending/i.test(e.peak[0].status)).length}, inactive ${v.filter((e) => /^inactive/i.test(e.peak[0].status)).length}; ` +
  `${v.filter((e) => e.peak.some((p) => p.verify)).length} with something to check`);
