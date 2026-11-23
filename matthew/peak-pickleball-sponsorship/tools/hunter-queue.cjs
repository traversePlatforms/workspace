/* Run the saved Hunter queue for the Peak expo/venue leads (2026-11-22, Matthew: "yeah run the 41", after the free credits reset).
   Reads venue-rental-2026-11/hunter-queue-2026-11-22.csv; one call per row, in rank order: Email Finder for the first named person,
   else Domain Search with the row's department filter. Checks the month's searches before each call and stops when they run out.
   Writes venue-rental-2026-11/hunter-results-2026-11-22.json (resumable: rows already done are skipped). The key is never printed. */
const fs = require('fs'), path = require('path'), os = require('os');
const KEY = require(path.join(os.homedir(), '.ssh', 'hunter.json')).api_key;
const DIR = path.join(__dirname, '..', 'venue-rental-2026-11');
const Q = path.join(DIR, 'hunter-queue-2026-11-22.csv'), F = path.join(DIR, 'hunter-results-2026-11-22.json');
const out = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : {};

function parseCsv(t) {
  const rows = []; let row = [], cell = '', q = false;
  t = t.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [h, ...rest] = rows;
  return rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k.trim(), (r[i] || '').trim()])));
}
const api = async (p, q) => (await fetch('https://api.hunter.io/v2/' + p + '?' + new URLSearchParams({ ...q, api_key: KEY }))).json();
const left = async () => { const a = (await api('account', {})).data.requests; return { searches: a.searches.available - a.searches.used, credits: a.credits.available - a.credits.used }; };

(async () => {
  const rows = parseCsv(fs.readFileSync(Q, 'utf8'));
  console.log('rows:', rows.length, 'start:', JSON.stringify(await left()));
  for (const r of rows) {
    const id = r.rank + ' ' + r.organisation;
    if (out[id] && !out[id].error) continue;
    const call = r['suggested Hunter call'] || '';
    const dom = ((call.match(/@\s*([a-z0-9.-]+\.[a-z]{2,})/i) || call.match(/Domain Search:\s*([a-z0-9.-]+\.[a-z]{2,})/i) || [])[1] || (/\./.test(r.domain) ? r.domain : '')).toLowerCase();
    if (!dom) { out[id] = { skipped: 'no domain' }; console.log(r.rank + '.', r.organisation, ': skipped, no domain'); continue; }
    const l = await left();
    if (l.searches < 1 || l.credits < 1) { console.log('stopped at', r.rank, '(out of searches or credits)'); break; }
    const who = (call.match(/Email Finder:\s*([^@]+?)\s*@/i) || [])[1];
    let res;
    if (who) {
      const parts = who.replace(/\b[A-Z]\.\s*/g, '').trim().split(/\s+/);
      const j = await api('email-finder', { domain: dom, first_name: parts[0], last_name: parts.slice(1).join(' ') });
      const d = j.data || {};
      res = { how: 'finder', domain: dom, name: who, email: d.email || null, score: d.score ?? null, position: d.position || null, verification: d.verification && d.verification.status || null, error: j.errors ? JSON.stringify(j.errors).slice(0, 160) : undefined };
      console.log(r.rank + '.', r.organisation, ':', res.email ? 'found (' + who + ', score ' + res.score + ')' : 'not found (' + who + ')');
    } else {
      const dep = (r['department filter'] || '').match(/department=([a-z,]+)/i);
      const j = await api('domain-search', { domain: dom, limit: '10', ...(dep ? { department: dep[1] } : {}) });
      const d = j.data || {};
      res = { how: 'domain', domain: dom, pattern: d.pattern || null, emails: (d.emails || []).map((e) => ({ v: e.value, first: e.first_name, last: e.last_name, pos: e.position, dept: e.department, type: e.type, conf: e.confidence })), error: j.errors ? JSON.stringify(j.errors).slice(0, 160) : undefined };
      console.log(r.rank + '.', r.organisation, ':', res.emails.length, 'address(es)', res.emails.slice(0, 3).map((e) => e.pos || (e.first ? 'person' : 'general')).join('; '));
    }
    out[id] = res;
    fs.writeFileSync(F, JSON.stringify(out, null, 1));
  }
  console.log('left:', JSON.stringify(await left()));
})();
