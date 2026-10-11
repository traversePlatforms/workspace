// Live trial as real users (Matthew 2026-10-10): admin makes a manager and two crew, the manager assigns and plans, crew knock,
// the admin follows up, crew try what they must not do, then everything is undone. One quiet neighbourhood, trial-named
// accounts, reserved 555-01xx phone numbers. Codes stay in this process (never printed). Prints step results only.
//   node live-trial.mjs <api url> <admin code> <edition label> [--keep]
const [API, ADMIN, LABEL] = process.argv.slice(2), KEEP = process.argv.includes('--keep');
const jar = {}; const res = []; let fails = 0;
async function call(who, action, params = {}, body) {
  let u = `${API}?action=${action}`; for (const [k, v] of Object.entries(params)) u += `&${k}=${encodeURIComponent(v)}`;
  const t0 = Date.now();
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(u, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(jar[who] ? { Cookie: jar[who] } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const sc = r.headers.get('set-cookie'); if (sc) jar[who] = sc.split(';')[0];
      const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch {}
      return { status: r.status, j, ms: Date.now() - t0 };
    } catch (e) { await new Promise((s) => setTimeout(s, 2000 * (i + 1))); }
  }
  return { status: 0, j: null, ms: Date.now() - t0 };
}
function check(name, ok, detail = '') { res.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); if (!ok) fails++; }
const err = (r) => (r.j && (r.j.error || r.j.message)) || ('HTTP ' + r.status);
const day = (n) => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10); };
const people = {}; const made = []; let team = '', calId = '', town = '', area = '', doors = [];

/* ---- admin: sign in, pick a quiet neighbourhood, make the accounts and the team ---- */
let r = await call('admin', 'signin', {}, { code: ADMIN }); check('admin signs in', r.status === 200 && r.j?.role === 'admin', r.j?.role);
r = await call('admin', 'regions'); const regions = r.j?.regions || []; check('admin sees the towns', regions.length > 0, `${regions.length} towns, ${r.ms} ms`);
for (const rg of regions) { if (/^com-/.test(rg.key)) continue;
  for (const a of rg.areas.filter((x) => x.total >= 8 && x.total <= 16 && !x.done && !x.booked && !x.noanswer)) {
    const ar = await call('admin', 'area', { region: rg.key, area: a.name });
    const ds = ar.j?.doors || []; if (ds.length >= 8 && ds.every((d) => !d.mark && !d.note && !d.phone && !d.rep && !d.work)) { town = rg.key; area = a.name; doors = ds.map((d) => d.id); break; }
  } if (town) break; }
check('a quiet neighbourhood with no history found', !!town, town ? `${town}, ${doors.length} doors` : '');
if (!town) { console.log(res.join('\n')); process.exit(1); }
for (const [name, role] of [['Trial Manager', 'manager'], ['Trial Crew A', 'crew'], ['Trial Crew B', 'crew']]) {
  r = await call('admin', 'accountadd', {}, { name, role }); check(`admin adds ${name} (${role})`, r.j?.ok && !!r.j.code, r.j?.ok ? '' : err(r));
  if (r.j?.ok) { people[name] = { code: r.j.code, id: r.j.id }; made.push(r.j.id); }
}
r = await call('admin', 'accounts'); check('the accounts list shows them', ['Trial Manager', 'Trial Crew A', 'Trial Crew B'].every((n) => (r.j?.accounts || []).some((a) => a.name === n)));
r = await call('admin', 'teamsave', {}, { name: 'Trial Team' }); team = r.j?.id || ''; check('admin makes a team', !!team, team ? '' : err(r));
for (const n of Object.keys(people)) { r = await call('admin', 'teammember', {}, { team, person: people[n].id }); check(`${n} joins the team`, !!r.j?.ok, r.j?.ok ? '' : err(r)); }

/* ---- manager ---- */
r = await call('mgr', 'signin', {}, { code: people['Trial Manager']?.code }); check('manager signs in', r.j?.role === 'manager', r.j?.role || err(r));
r = await call('mgr', 'regions'); check('manager sees the towns', (r.j?.regions || []).length > 0, `${r.ms} ms`);
r = await call('mgr', 'area', { region: town, area }); check('manager opens the neighbourhood', (r.j?.doors || []).length === doors.length, `${r.ms} ms`);
r = await call('mgr', 'doorassign', {}, { region: town, ids: doors.slice(0, 3), who: 'Trial Crew B' }); check('manager assigns 3 doors to Crew B', !!r.j?.ok, r.j?.ok ? '' : err(r));
r = await call('mgr', 'mygoal', {}, { who: 'Trial Crew A', doors: 20, talked: 5, booked: 1 }); check('manager sets Crew A a goal', !!r.j?.ok, r.j?.ok ? '' : err(r));
r = await call('mgr', 'calsave', {}, { who: 'Trial Crew A', date: day(1), time: '10:00', title: 'Trial ride-along', note: 'Trial, please ignore' }); calId = r.j?.id || ''; check('manager books Crew A a calendar slot', !!r.j?.ok, r.j?.ok ? '' : err(r));
r = await call('mgr', 'teams'); check('manager sees the team', JSON.stringify(r.j || {}).includes('Trial Crew A'), r.j?.ok ? '' : err(r));
r = await call('mgr', 'accounts'); check('manager is refused the accounts list', r.status === 403);

/* ---- crew A knocks ---- */
const [d0, d1, d2, d3, d4, d5] = doors;
r = await call('a', 'signin', {}, { code: people['Trial Crew A']?.code }); check('Crew A signs in', r.j?.role === 'crew', r.j?.role || err(r));
r = await call('a', 'area', { region: town, area }); check('Crew A opens the neighbourhood', (r.j?.doors || []).length === doors.length, `${r.ms} ms`);
r = await call('a', 'mark', {}, { region: town, id: d3, outcome: 'miss' }); check('Crew A: no answer', !!r.j?.ok, r.j?.ok ? '' : err(r));
r = await call('a', 'mark', {}, { region: town, id: d4, outcome: 'later', revisit: day(7) }); check('Crew A: not now, come back in a week', !!r.j?.ok, r.j?.ok ? '' : err(r));
r = await call('a', 'mark', {}, { region: town, id: d5, outcome: 'booked' }); check('Crew A: booked an estimate', !!r.j?.ok, r.j?.ok ? '' : err(r));
r = await call('a', 'phone', {}, { region: town, id: d5, phone: '303-555-0142', source: 'door' }); check('Crew A saves the phone number', !!r.j?.ok, r.j?.ok ? '' : err(r));
r = await call('a', 'note', {}, { region: town, id: d4, note: 'Trial note, please ignore' }); check('Crew A writes a note', !!r.j?.ok, r.j?.ok ? '' : err(r));
r = await call('a', 'area', { region: town, area }); const seen = Object.fromEntries((r.j?.doors || []).map((d) => [d.id, d]));
check('the card shows all three marks', seen[d3]?.mark?.outcome === 'miss' && seen[d4]?.mark?.outcome === 'later' && seen[d5]?.mark?.outcome === 'booked');
check('the come-back date and the phone stuck', seen[d4]?.mark?.revisit === day(7) && /0142/.test(seen[d5]?.phone?.phone || ''));
r = await call('a', 'mydoors'); check('Crew A opens My doors', r.status === 200, err(r));
r = await call('a', 'mark', {}, { region: town, id: d3, outcome: null }); check('Crew A undoes the no-answer', !!r.j?.ok, r.j?.ok ? '' : err(r));
r = await call('a', 'accounts'); check('Crew A is refused the accounts list', r.status === 403);
r = await call('a', 'doorassign', {}, { region: town, ids: [d0], who: 'Trial Crew A' }); check('Crew A is refused assigning doors', r.status === 403);
r = await call('a', 'result', {}, { region: town, id: d5, result: 'won' }); check('Crew A is refused marking a job won', r.status === 403);

/* ---- crew B sees the assignment ---- */
r = await call('b', 'signin', {}, { code: people['Trial Crew B']?.code }); check('Crew B signs in', r.j?.role === 'crew', r.j?.role || err(r));
r = await call('b', 'mydoors'); check('Crew B opens My doors', r.status === 200, err(r));
r = await call('mgr', 'area', { region: town, area }); { const by = Object.fromEntries((r.j?.doors || []).map((d) => [d.id, d.rep])); check('the 3 doors show as Crew B on the manager view', [d0, d1, d2].every((id) => by[id] === 'Trial Crew B' || by[id]?.name === 'Trial Crew B' || JSON.stringify(by[id] || '').includes('Trial Crew B')), JSON.stringify(by[d0] ?? null).slice(0, 60)); }

/* ---- admin follows up ---- */
r = await call('admin', 'quotes'); check('the booking reaches the office (Quotes)', JSON.stringify(r.j || {}).includes(d5), `${r.ms} ms`);
r = await call('admin', 'result', {}, { region: town, id: d5, result: 'won', value: 9500 }); check('admin marks the job won', !!r.j?.ok, r.j?.ok ? '' : err(r));
if (/traverse-rounds\.php$/.test(API)) { r = await call('admin', 'roofjob', {}, { region: town, id: d5, step: 'signed', when: new Date().toISOString().slice(0, 16) }); check('Roofing: the roof job is signed', !!r.j?.ok, r.j?.ok ? '' : err(r)); }
for (const a of ['board', 'stats', 'report', 'calendar', 'leads', 'results']) { r = await call('admin', a); check(`admin opens ${a}`, r.status === 200, r.status === 200 ? `${r.ms} ms` : err(r)); }

/* ---- clean up (unless --keep) ---- */
if (!KEEP) {
  if (/traverse-rounds\.php$/.test(API)) { r = await call('admin', 'roofjob', {}, { region: town, id: d5, step: 'signed', when: null }); check('clean: roof job step off', !!r.j?.ok, r.j?.ok ? '' : err(r)); }
  r = await call('admin', 'result', {}, { region: town, id: d5, result: null }); check('clean: result off', !!r.j?.ok, r.j?.ok ? '' : err(r));
  for (const id of [d4, d5]) { r = await call('a', 'mark', {}, { region: town, id, outcome: null }); check('clean: mark undone', !!r.j?.ok, r.j?.ok ? '' : err(r)); }
  r = await call('a', 'phone', {}, { region: town, id: d5, phone: '', source: 'door' }); check('clean: phone cleared', !!r.j?.ok, r.j?.ok ? '' : err(r));
  r = await call('a', 'note', {}, { region: town, id: d4, note: '' }); check('clean: note cleared', !!r.j?.ok, r.j?.ok ? '' : err(r));
  r = await call('mgr', 'doorassign', {}, { region: town, ids: [d0, d1, d2], who: '' }); check('clean: doors unassigned', !!r.j?.ok, r.j?.ok ? '' : err(r));
  if (calId) { r = await call('mgr', 'calsave', {}, { who: 'Trial Crew A', id: calId, del: 1 }); check('clean: calendar slot removed', !!r.j?.ok, r.j?.ok ? '' : err(r)); }
  r = await call('mgr', 'mygoal', {}, { who: 'Trial Crew A', doors: null, talked: null, booked: null }); check('clean: goal cleared', !!r.j?.ok, r.j?.ok ? '' : err(r));
  r = await call('admin', 'area', { region: town, area }); check('the neighbourhood is back to no history', (r.j?.doors || []).every((d) => !d.mark && !d.phone && !d.note && !d.rep));
  for (const who of ['mgr', 'a', 'b']) await call(who, 'signout', {}, {});
  if (team) { r = await call('admin', 'teamsave', {}, { id: team, del: 1 }); check('clean: team removed', !!r.j?.ok, r.j?.ok ? '' : err(r)); }
  for (const id of made) { r = await call('admin', 'accountremove', {}, { id }); check('clean: trial account removed', !!r.j?.ok, r.j?.ok ? '' : err(r)); }
}
await call('admin', 'signout', {}, {});
console.log(`== ${LABEL}: ${res.length - fails} passed, ${fails} failed (town ${town})`);
console.log(res.join('\n'));
