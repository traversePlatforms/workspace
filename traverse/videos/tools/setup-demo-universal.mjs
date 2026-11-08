// The people and the demo house on the ONE local demo copy for the demo-universal video (7 Nov 2026; never a live install): the admin
// accepts the terms; made-up people are added (two reps, a technician who does the jobs) and accept theirs; then the one house the story
// opens is picked from the copy's own data (reads only): the house whose card shows the most of what the script lists (hail with its
// storms, the roof, a new owner, the lawn with its outline, the sun and a system that fits). Codes and picks go to <DEMO_DIR>/demo.json
// (local test codes, never committed).
//   node setup-demo-universal.mjs
import { writeFileSync, existsSync, readFileSync } from 'node:fs'; import { api } from './lib.mjs';
import { DEMO_DIR, ADMIN, ED, TOWN, origin, local } from './demo-universal-config.mjs';
const ST = DEMO_DIR + '/demo.json';
const st = existsSync(ST) ? JSON.parse(readFileSync(ST, 'utf8')) : {};
const PEOPLE = [['Alex Rivera', 'crew'], ['Sam Ortiz', 'crew'], ['Riley Chen', 'tech']];
const accept = async (call, who, j) => { const t = j?.terms; if (t && t.due) { const r = await call(who, 'termsaccept', {}, { terms: t.terms, agreement: t.agreement || '' }); if (!r.j?.ok) throw new Error('terms ' + who + ': ' + (r.j?.error || r.status)); } };
const recent = (ym, months) => { if (!ym) return false; const [y, m] = ym.split('-').map(Number), n = new Date(); return (n.getFullYear() - y) * 12 + (n.getMonth() + 1 - m) <= months; };
const ed = 'one', call = api(local(origin(ed) + '/api/' + ED[ed].api)), s = (st[ed] = st[ed] || {});
let r = await call('admin', 'signin', {}, { code: ADMIN }); if (r.j?.role !== 'admin') throw new Error('admin sign-in ' + (r.j?.error || r.status));
await accept(call, 'admin', r.j);
const accts = (await call('admin', 'accounts')).j?.accounts || [];
for (const [name, role] of PEOPLE) {
  if (!(s[name] && accts.some((a) => a.name === name && !a.off))) {
    r = await call('admin', 'accountadd', {}, { name, role }); if (!r.j?.ok) throw new Error('add ' + name + ': ' + r.j?.error);
    s[name] = { code: r.j.code, id: r.j.id };
  }
  r = await call(name, 'signin', {}, { code: s[name].code }); await accept(call, name, r.j); await call(name, 'signout', {}, {});
}
writeFileSync(ST, JSON.stringify(st, null, 1));   /* the codes kept at once, so a later failure leaves a run that can go on */
const reg = (await call('admin', 'regions')).j.regions.find((x) => x.key === TOWN); if (!reg) throw new Error('no town ' + TOWN);
s.town = reg.key; s.townLabel = reg.label;
/* the share of each lot drawn green (counted lawn) on the photo */
const LAWNMASK = new Map(), lmf = `${DEMO_DIR}/one/${ED.one.data}/rounds/lawnmask-${reg.key}.json`;
if (existsSync(lmf)) for (const [id, m] of Object.entries(JSON.parse(readFileSync(lmf, 'utf8')).doors || {})) {
  let c1 = 0, c2 = 0; for (const run of String(m.r || '').split(',')) { const [v, n] = run.split(':').map(Number); if (v === 1) c1 += n; else if (v === 2) c2 += n; }
  if (c1 + c2) LAWNMASK.set(id, c1 / (c1 + c2));
}
/* every fact the script lists on one card: hail (two storms or more, one of an inch or more), a pitched roof with its material, the lawn
   green on the photo at a usual size, a system that fits in open sun and no solar yet; a new owner and a re-roof on record count extra */
const PICK = (d) => {
  if (!((d.hail || []).length >= 2 && (d.hail || []).some((h) => h[1] >= 1) && d.roof && !d.roof.flat && d.mat)) return 0;
  if (!((LAWNMASK.get(d.id) || 0) >= 0.25 && d.lawn && d.lawn.sq >= 1500 && d.lawn.sq <= 9000)) return 0;
  if (!(d.solar && d.solar.kw >= 6 && d.solar.sh !== 'heavy' && !(d.permit && d.permit.s))) return 0;
  return 10 + (d.mv && recent(d.mv.s, 18) ? 8 : 0) + (d.permit && d.permit.r ? 3 : 0) + Math.min(4, d.solar.kw / 3) + 10 * LAWNMASK.get(d.id) + (d.solar.sh === 'open' ? 3 : 0) + ((d.hail || []).length >= 3 ? 2 : 0);
};
let best = null, solarArea = null;
for (const a of reg.areas.slice().sort((x, y) => (y.sc || 0) - (x.sc || 0) || y.total - x.total).slice(0, 60)) {
  const ds = (await call('admin', 'area', { region: reg.key, area: a.name })).j?.doors || [];
  const has = ds.filter((d) => d.permit && d.permit.s).length;
  for (const d of ds) { const sc = PICK(d); if (sc && (!best || sc > best.sc)) best = { sc, area: a.name, id: d.id, address: d.address, lat: d.lat, lon: d.lon, solarHere: has, newOwner: !!(d.mv && recent(d.mv.s, 18)), reroof: !!(d.permit && d.permit.r) }; }
  if (has >= 3 && (!solarArea || has > solarArea.n)) solarArea = { area: a.name, n: has, addr: ds.find((d) => d.permit && d.permit.s).address };
}
if (!best) throw new Error('no demo house found');
s.house = best; s.solarArea = solarArea;
/* the storm day that reached the most houses here with hail an inch or more */
const hf = JSON.parse(readFileSync(`${DEMO_DIR}/one/${ED.one.data}/rounds/hail-${reg.key}.json`, 'utf8')).doors, days = {};
for (const v of Object.values(hf)) for (const x of (typeof v === 'string' ? JSON.parse(v) : v)) if (x[1] >= 1) { const k = String(x[0]).slice(0, 10); days[k] = (days[k] || 0) + 1; }
s.stormISO = Object.entries(days).sort((a, b) => b[1] - a[1])[0][0];
/* and the one the phone's Hail list still carries (its last two years), at the ¾ inch view: the day that reached the most houses here */
const recentD = {}, cutISO = new Date(Date.now() - 700 * 86400000).toISOString().slice(0, 10);
for (const v of Object.values(hf)) for (const x of (typeof v === 'string' ? JSON.parse(v) : v)) { const k = String(x[0]).slice(0, 10); if (x[1] >= 0.75 && k >= cutISO) recentD[k] = (recentD[k] || 0) + 1; }
s.stormRecentISO = (Object.entries(recentD).sort((a, b) => b[1] - a[1])[0] || [s.stormISO])[0];
/* the demo leads, made the way the office adds one (Pipeline, Add a lead: an address typed in finds its house). Made-up people, 555-01xx
   numbers and example.com emails. Taylor Brooks is the homeowner quoted and signed at the door; Jamie Patel's quote is the one a rep saved
   in the field for the office to take on (scene "or send it back to your office team"). */
const have = ((await call('admin', 'leads')).j?.leads || []).map((l) => l.name);
const others = ((await call('admin', 'area', { region: reg.key, area: best.area })).j?.doors || []).filter((d) => d.id !== best.id).map((d) => d.address);
const LEADS = [['Taylor Brooks', 'door', 'Roof or storm damage', 'new'], ['Jamie Patel', 'door', 'Solar quote', 'new'], ['Morgan Ellis', 'phone', 'Lawn care', 'contacted'],
               ['Drew Carter', 'referral', 'Roof or storm damage', 'walk'], ['Avery Sullivan', 'door', 'Lawn care', 'quoted'], ['Quinn Harper', 'inperson', 'Solar quote', 'won']];
s.leads = s.leads || {};
for (const [i, [name, src, need, status]] of LEADS.entries()) {
  if (have.includes(name)) continue;
  const addr = i === 0 ? best.address : others[(i * 3) % Math.max(1, others.length)];
  const first = name.split(' ')[0].toLowerCase(), last = name.split(' ')[1].toLowerCase();
  r = await call('admin', 'leadadd', {}, { src, name, need, phone: `(303) 555-01${String(20 + i * 7).padStart(2, '0')}`, email: `${first}.${last}@example.com`, town: `${addr}, ${reg.label}` });
  if (!r.j?.ok) throw new Error('lead ' + name + ': ' + (r.j?.error || r.status));
  s.leads[name] = r.j.id;
  if (status !== 'new') { r = await call('admin', 'leadstatus', {}, { id: r.j.id, status }); if (!r.j?.ok) throw new Error('status ' + name + ': ' + r.j?.error); }
}
/* the leads the office gives the reps */
/* Taylor Brooks is Alex Rivera's lead (quoted and signed at the door on his phone); Jamie Patel's is Sam Ortiz's (quoted on his phone, taken on by the office) */
if (!s.assigned) for (const [lead, rep] of [['Taylor Brooks', 'Alex Rivera'], ['Jamie Patel', 'Sam Ortiz']]) { r = await call('admin', 'leadassign', {}, { id: s.leads[lead], owner: rep }); if (!r.j?.ok) throw new Error('assign ' + lead + ': ' + r.j?.error); s.assigned = 2; }
/* made-up knocks by the two made-up reps in the demo neighbourhood and the next ones, as a rep marks a door (for "who knocked what") */
if (!s.knocks) {
  const areas = reg.areas.slice().sort((x, y) => (y.sc || 0) - (x.sc || 0) || y.total - x.total).slice(0, 6).map((a) => a.name);
  if (!areas.includes(best.area)) areas.unshift(best.area);
  const OUT = ['miss', 'later', 'miss', 'booked', 'miss', 'later', 'nosolicit', 'miss'];
  let n = 0;
  for (const [k, area] of areas.entries()) {
    const who = k % 2 ? 'Sam Ortiz' : 'Alex Rivera';
    r = await call(who, 'signin', {}, { code: s[who].code });
    const ds = ((await call(who, 'area', { region: reg.key, area })).j?.doors || []).filter((d) => d.id !== best.id).slice(0, 9);
    for (const [i, d] of ds.entries()) { const m = await call(who, 'mark', {}, { region: reg.key, id: d.id, outcome: OUT[(i + k) % OUT.length] }); if (m.j?.ok) n++; }
    await call(who, 'signout', {}, {});
  }
  s.knocks = n;
}
console.log('people ready; house picked in', JSON.stringify(best.area), JSON.stringify({ newOwner: best.newOwner, reroof: best.reroof, sc: best.sc }), 'storm days', s.stormISO, s.stormRecentISO, 'solar area', JSON.stringify(solarArea));
await call('admin', 'signout', {}, {});
writeFileSync(ST, JSON.stringify(st, null, 1));
