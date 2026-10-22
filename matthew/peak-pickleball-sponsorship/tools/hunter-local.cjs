/* Hunter for the best local lookalikes (2026-10-21, Matthew: "use some of the 41 remaining searching for best local businesses"):
   owners, managers and marketing at each small business's own domain. Counted only when someone is found; key never printed. */
const fs = require('fs');
const KEY = require('C:/Users/Surge Inc/.ssh/hunter.json').api_key;
const T = JSON.parse(fs.readFileSync('data/local-hunter-targets.json', 'utf8')).filter((x) => !/prudential\.com|cfbinsurance\.com/.test(x.domain));
const F = 'data/hunter-local-results.json';
const out = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : {};
(async () => {
  for (const t of T) {
    if (out[t.name]) continue;
    const p = new URLSearchParams({ domain: t.domain, department: 'executive,management,marketing', limit: '10', api_key: KEY });
    const j = await (await fetch('https://api.hunter.io/v2/domain-search?' + p)).json();
    if (j.errors) { console.log(t.name, ': error', JSON.stringify(j.errors).slice(0, 140)); continue; }
    const d = j.data || {};
    out[t.name] = { domain: t.domain, kind: t.kind, miles: t.miles, pattern: d.pattern, emails: (d.emails || []).map((e) => ({ v: e.value, first: e.first_name, last: e.last_name, pos: e.position, conf: e.confidence, type: e.type, srcN: (e.sources || []).length, lastSeen: (e.sources || []).map((s) => s.last_seen_on).sort().pop() || '' })) };
    fs.writeFileSync(F, JSON.stringify(out, null, 1));
    const e = out[t.name].emails;
    console.log(t.name, ':', e.length, e.length ? '| ' + e.slice(0, 3).map((x) => (x.pos || x.type || '?')).join('; ') : '');
  }
  const a = await (await fetch('https://api.hunter.io/v2/account?api_key=' + KEY)).json();
  console.log('left:', JSON.stringify(a.data.requests));
})();
