/* Hunter for the rest of the 39, highest score first (2026-10-21, Matthew: "pull the emails from whatever companies have the highest
   ratings and work the way down"). Big companies by their main domain (marketing, communication, executive); small ones by name.
   Stops when the month's searches run out; a search that finds nobody is free. Key never printed. */
const fs = require('fs');
const KEY = require('C:/Users/Surge Inc/.ssh/hunter.json').api_key;
const seed = JSON.parse(fs.readFileSync('data/desk-seed.json', 'utf8'));
const F = 'data/hunter-results.json', out = JSON.parse(fs.readFileSync(F, 'utf8'));
const DOM = { 'OrangeTheory': 'orangetheory.com', 'Cheyenne Mountain Resort': 'cheyennemountain.com', 'Chord Energy': 'chordenergy.com', 'Climax Molybdenum': 'climaxmolybdenum.com',
  'Cumulus Media': 'cumulus.com', 'McLane Company': 'mclaneco.com', 'PCL Construction': 'pcl.com', 'Republic Services': 'republicservices.com', 'T. Rowe Price': 'troweprice.com',
  'iHeart Media': 'iheartmedia.com', 'Progressive': 'progressive.com', 'USAA': 'usaa.com' };
const todo = seed.leads.filter((l) => l.list === 'new' && !(l.contacts || []).some((c) => c.email) && !out[l.name]).sort((a, b) => a.rank - b.rank);
(async () => {
  for (const l of todo) {
    const acc = await (await fetch('https://api.hunter.io/v2/account?api_key=' + KEY)).json();
    if ((acc.data.requests.searches.available - acc.data.requests.searches.used) < 1) { console.log('out of searches at', l.name); break; }
    const q = DOM[l.name] ? { domain: DOM[l.name], department: 'marketing,communication,executive' } : { company: l.name.replace(/, LLC$/, ''), department: 'executive,management,marketing' };
    const j = await (await fetch('https://api.hunter.io/v2/domain-search?' + new URLSearchParams({ ...q, limit: '10', api_key: KEY }))).json();
    if (j.errors) { console.log(l.rank, l.name, ': error', JSON.stringify(j.errors).slice(0, 120)); out[l.name] = { domain: q.domain || '', emails: [], error: true }; fs.writeFileSync(F, JSON.stringify(out, null, 1)); continue; }
    const d = j.data || {};
    out[l.name] = { domain: d.domain, org: d.organization, pattern: d.pattern, emails: (d.emails || []).map((e) => ({ v: e.value, first: e.first_name, last: e.last_name, pos: e.position, dept: e.department, seniority: e.seniority, conf: e.confidence, phone: e.phone_number, li: e.linkedin, srcN: (e.sources || []).length, lastSeen: (e.sources || []).map((s) => s.last_seen_on).sort().pop() || '' })) };
    fs.writeFileSync(F, JSON.stringify(out, null, 1));
    console.log(l.rank + '.', l.name, ':', out[l.name].emails.length, out[l.name].emails.slice(0, 3).map((e) => e.pos || (e.first ? 'person' : 'general')).join('; '));
  }
  const a = await (await fetch('https://api.hunter.io/v2/account?api_key=' + KEY)).json();
  console.log('left:', JSON.stringify(a.data.requests));
})();
