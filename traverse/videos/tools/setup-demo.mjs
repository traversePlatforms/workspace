// The people and the demo houses on the LOCAL demo copies for the demo-editions video (never a live install): the admin accepts the
// terms; made-up people are added (two reps and a technician who does the jobs) and accept theirs; then the houses the story uses are
// picked from the copy's own data (reads only). Codes and picks go to <DEMO_DIR>/demo.json (local test codes, never committed).
//   node setup-demo.mjs [roofing yards solar]
import { writeFileSync, existsSync, readFileSync } from 'node:fs'; import { api } from './lib.mjs';
import { DEMO_DIR, ADMIN, ED, origin, local } from './demo-config.mjs';
const ST = DEMO_DIR + '/demo.json';
const st = existsSync(ST) ? JSON.parse(readFileSync(ST, 'utf8')) : {};
const PEOPLE = [['Alex Rivera', 'crew'], ['Sam Ortiz', 'crew'], ['Riley Chen', 'tech']];
const accept = async (call, who, j) => { const t = j?.terms; if (t && t.due) { const r = await call(who, 'termsaccept', {}, { terms: t.terms, agreement: t.agreement || '' }); if (!r.j?.ok) throw new Error('terms ' + who + ': ' + (r.j?.error || r.status)); } };
let LAWNMASK = new Set();
const recent = (ym, months) => { if (!ym) return false; const [y, m] = ym.split('-').map(Number), n = new Date(); return (n.getFullYear() - y) * 12 + (n.getMonth() + 1 - m) <= months; };
/* the house each edition's story opens: the most of what the script says the card shows */
const PICK = {
  roofing: (d) => (d.hail || []).length >= 3 && (d.hail || []).some((h) => h[1] >= 1) && (d.wind || []).length && d.roof && !d.roof.flat && d.mat ? 10 + (d.permit && d.permit.r ? 5 : 0) + (d.mv && recent(d.mv.s, 18) ? 6 : 0) + (d.hail || []).length : 0,
  yards: (d) => LAWNMASK.has(d.id) && d.lawn && d.lawn.sq >= 2500 && d.lawn.sq <= 9000 && d.trees && d.trees.z1 >= 0.15 ? 10 + Math.min(5, d.lawn.sq / 1500) + (d.trees.z1 >= 0.3 ? 2 : 0) : 0,
  solar: (d) => d.solar && d.solar.kw >= 7 && d.solar.sh === 'open' && !(d.permit && d.permit.s) ? 10 + Math.min(6, d.solar.kw / 2) : 0,
};
for (const ed of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ED)) {
  const call = api(local(origin(ed) + '/api/' + ED[ed].api)); const s = (st[ed] = st[ed] || {});
  let r = await call('admin', 'signin', {}, { code: ADMIN }); if (r.j?.role !== 'admin') throw new Error(ed + ': admin sign-in ' + (r.j?.error || r.status));
  await accept(call, 'admin', r.j);
  const accts = (await call('admin', 'accounts')).j?.accounts || [];
  for (const [name, role] of PEOPLE) {
    if (!(s[name] && accts.some((a) => a.name === name && !a.off))) {
      r = await call('admin', 'accountadd', {}, { name, role }); if (!r.j?.ok) throw new Error(ed + ': add ' + name + ': ' + r.j?.error);
      s[name] = { code: r.j.code, id: r.j.id };
    }
    r = await call(name, 'signin', {}, { code: s[name].code }); await accept(call, name, r.j); await call(name, 'signout', {}, {});
  }
  /* the demo house: the best fit in the 40 best neighbourhoods; for Solar, a neighbourhood that also has houses with solar already */
  const reg = (await call('admin', 'regions')).j.regions[0]; s.town = reg.key; s.townLabel = reg.label;
  /* Lawn: only a house with its lawn outline on the photo */
  const lmf = DEMO_DIR + '/' + ed + '/' + ED[ed].data + '/rounds/lawnmask-' + reg.key + '.json';
  LAWNMASK = new Set(existsSync(lmf) ? Object.keys(JSON.parse(readFileSync(lmf, 'utf8')).doors || {}) : []);
  let best = null;
  for (const a of reg.areas.slice().sort((x, y) => (y.sc || 0) - (x.sc || 0) || y.total - x.total).slice(0, 40)) {
    const ds = (await call('admin', 'area', { region: reg.key, area: a.name })).j?.doors || [];
    const has = ds.filter((d) => d.permit && d.permit.s).length;
    if (ed === 'solar' && !has) continue;
    for (const d of ds) { const sc = PICK[ed](d); if (sc && (!best || sc > best.sc)) best = { sc, area: a.name, id: d.id, address: d.address, lat: d.lat, lon: d.lon, solarHere: has }; }
  }
  if (!best) throw new Error(ed + ': no demo house found');
  s.house = best;
  /* the demo leads, made the way the office adds one (Pipeline, Add a lead: an address typed in finds its house). Made-up people,
     555-01xx numbers and example.com emails; the first is the homeowner the story quotes and signs. Only on a fresh copy. */
  const have = ((await call('admin', 'leads')).j?.leads || []).map((l) => l.name);
  const others = ((await call('admin', 'area', { region: reg.key, area: best.area })).j?.doors || []).filter((d) => d.id !== best.id).map((d) => d.address);
  const LEADS = { yards: [['Taylor Brooks', 'door', 'Aeration', 'new'], ['Jamie Patel', 'nextdoor', 'Lawn care plan', 'new'], ['Morgan Ellis', 'phone', 'Yard cleanup', 'contacted'],
                          ['Drew Carter', 'referral', 'Aeration', 'walk'], ['Avery Sullivan', 'door', 'Lawn care plan', 'quoted'], ['Quinn Harper', 'inperson', 'Trees or shrubs', 'won']],
                  solar: [['Casey Morgan', 'door', 'Solar quote', 'new']], roofing: [] }[ed];
  s.leads = s.leads || {};
  for (const [i, [name, src, need, status]] of LEADS.entries()) {
    if (have.includes(name)) continue;
    const addr = i === 0 ? best.address : others[(i - 1) % Math.max(1, others.length)];
    const first = name.split(' ')[0].toLowerCase(), last = name.split(' ')[1].toLowerCase();
    r = await call('admin', 'leadadd', {}, { src, name, need, phone: `(303) 555-01${String(20 + i * 7).padStart(2, '0')}`, email: `${first}.${last}@example.com`, town: `${addr}, ${reg.label}` });
    if (!r.j?.ok) throw new Error(ed + ': lead ' + name + ': ' + (r.j?.error || r.status));
    s.leads[name] = r.j.id;
    if (status !== 'new') { r = await call('admin', 'leadstatus', {}, { id: r.j.id, status }); if (!r.j?.ok) throw new Error(ed + ': status ' + name + ': ' + r.j?.error); }
  }
  console.log(ed, 'people ready;', 'house picked in', JSON.stringify(best.area), best.solarHere ? `(${best.solarHere} with solar already)` : '');
  await call('admin', 'signout', {}, {});
}
writeFileSync(ST, JSON.stringify(st, null, 1));
