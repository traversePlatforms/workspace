/* Put the 22 Nov Hunter results for the expo/venue leads on the Peak desk (2026-11-22, Matthew: "put the hunter contacts on the peak desk").
   Reads venue-rental-2026-11/hunter-results-2026-11-22.json and a compact list of the live expo cards (id, name, site, emails already on
   the card); matches each organisation to its card by website domain, then by name; plans one `contact` row per new person:
     - Email Finder hits: the named person, with their Hunter title if any.
     - Domain Search: people with a name or a position (up to 4, marketing/sponsorship/events/executive first), plus at most 1 general
       inbox when the card has no email at all.
   Skips any address already on the card. Prints the plan (organisation + role, never the addresses), writes the bodies to a JSON file
   for the server step. Nothing is sent to anyone: this only adds contacts to cards.
     node tools/hunter-to-desk.cjs <expo-cards.json> <out.json> */
const fs = require('fs'), path = require('path');
const [, , CARDS, OUT] = process.argv;
const cards = JSON.parse(fs.readFileSync(CARDS, 'utf8'));
const res = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'venue-rental-2026-11', 'hunter-results-2026-11-22.json'), 'utf8'));
const host = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];
const norm = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const findCard = (org, dom) => {
  const byDom = cards.filter((c) => dom && (host(c.site) === dom || host(c.site).endsWith('.' + dom)));
  if (byDom.length === 1) return byDom[0];
  const n = norm(org.replace(/^\d+\s+/, ''));
  const byName = cards.filter((c) => { const m = norm(c.name); return m === n || (m.length > 6 && (n.startsWith(m) || m.startsWith(n))); });
  if (byName.length === 1) return byName[0];
  if (byDom.length > 1) { const both = byDom.filter((c) => byName.includes(c)); if (both.length === 1) return both[0]; }
  return null;
};
const rank = (e) => { const p = (e.pos || '').toLowerCase() + ' ' + (e.dept || ''); return /sponsor|partner/.test(p) ? 0 : /event|exhibit|show/.test(p) ? 1 : /market|communic/.test(p) ? 2 : /exec|owner|president|director|ceo|founder/.test(p) ? 3 : 4; };
const plan = [], miss = [];
for (const [id, r] of Object.entries(res)) {
  const org = id.replace(/^\d+\s+/, '');
  if (r.skipped || r.error) { miss.push(org + ': ' + (r.skipped || 'Hunter error')); continue; }
  const card = findCard(org, r.domain);
  if (!card) { miss.push(org + ': no matching card on the desk'); continue; }
  const have = new Set(card.emails);
  const add = (c) => { if (!c.email || have.has(c.email.toLowerCase())) return false; have.add(c.email.toLowerCase()); plan.push({ card: card.name, body: { world: 'expo', id: card.id, ...c } }); return true; };
  if (r.how === 'finder') {
    if (!r.email) { miss.push(org + ': Hunter found no address for ' + r.name); continue; }
    add({ name: r.name, email: r.email, role: r.position || '', notes: 'Hunter Email Finder 22 Nov, confidence ' + r.score + (r.verification ? ', ' + r.verification : '') });
  } else {
    const ppl = (r.emails || []).filter((e) => e.first || e.pos).sort((a, b) => rank(a) - rank(b) || (b.conf || 0) - (a.conf || 0)).slice(0, 4);
    let n = 0;
    for (const e of ppl) if (add({ name: [e.first, e.last].filter(Boolean).join(' '), email: e.v, role: e.pos || '', notes: 'Hunter Domain Search 22 Nov, confidence ' + (e.conf ?? '?') })) n++;
    if (!card.emails.length && !n) { const g = (r.emails || []).filter((e) => !e.first && !e.pos).sort((a, b) => (b.conf || 0) - (a.conf || 0))[0]; if (g && add({ name: '', email: g.v, role: 'General inbox', notes: 'Hunter Domain Search 22 Nov, confidence ' + (g.conf ?? '?') })) n++; }
    if (!n) miss.push(org + ': nothing new (' + (r.emails || []).length + ' found, already on the card or general only)');
  }
}
fs.writeFileSync(OUT, JSON.stringify(plan));
console.log('contacts to add:', plan.length);
for (const p of plan) console.log('  +', p.card, '|', p.body.role || (p.body.name ? 'named person' : 'general inbox'));
console.log('not added:', miss.length); for (const m of miss) console.log('  -', m);
