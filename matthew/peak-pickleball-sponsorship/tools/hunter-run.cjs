/* Hunter Domain Search for the regional sponsor leads: marketing, communication and executive staff (2026-10-21, Matthew: "both").
   One search each (counted only when it finds someone); the key is read from ~/.ssh/hunter.json and never printed. */
const fs = require('fs');
const KEY = require('C:/Users/Surge Inc/.ssh/hunter.json').api_key;
const T = [['Alpine Bank', { domain: 'alpinebank.com' }], ['Ent Credit Union', { domain: 'ent.com' }], ['UCHealth', { domain: 'uchealth.org' }],
  ['Swire Coca-Cola, USA', { domain: 'swirecc.com' }], ['Molson Coors', { domain: 'molsoncoors.com' }], ['Colorado Springs Chamber & EDC', { domain: 'coloradospringschamberedc.com' }],
  ['The Gazette', { domain: 'gazette.com' }], ['BOK Financial', { domain: 'bokf.com' }], ['Concept Restaurants', { company: 'Concept Restaurants' }],
  ['Laborjack', { company: 'Laborjack' }], ['Neon Pig', { company: 'Neon Pig' }]];
const out = fs.existsSync('hunter-results.json') ? JSON.parse(fs.readFileSync('hunter-results.json', 'utf8')) : {};
(async () => {
  for (const [name, q] of T) {
    if (out[name]) { console.log(name, ': already done'); continue; }
    const p = new URLSearchParams({ ...q, department: 'marketing,communication,executive', limit: '10', api_key: KEY });
    const r = await fetch('https://api.hunter.io/v2/domain-search?' + p); const j = await r.json();
    if (j.errors) { console.log(name, ': error', JSON.stringify(j.errors).slice(0, 160)); continue; }
    const d = j.data || {};
    out[name] = { domain: d.domain, org: d.organization, pattern: d.pattern, city: d.city, state: d.state, emails: (d.emails || []).map((e) => ({ v: e.value, first: e.first_name, last: e.last_name, pos: e.position, dept: e.department, seniority: e.seniority, conf: e.confidence, phone: e.phone_number, li: e.linkedin, srcN: (e.sources || []).length, lastSeen: (e.sources || []).map((s) => s.last_seen_on).sort().pop() || '' })) };
    fs.writeFileSync('hunter-results.json', JSON.stringify(out, null, 1));
    console.log(name, ':', out[name].emails.length, 'people', out[name].pattern ? '(email pattern ' + out[name].pattern + ')' : '', '|', out[name].emails.map((e) => e.pos || '?').slice(0, 6).join('; '));
  }
  const a = await (await fetch('https://api.hunter.io/v2/account?api_key=' + KEY)).json();
  console.log('left:', JSON.stringify(a.data.requests));
})();
