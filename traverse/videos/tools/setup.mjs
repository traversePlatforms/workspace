// The demo crew member and a neighbourhood for the walkthrough, on the local test copy only. Saves demo.json (local test codes).
import { writeFileSync, existsSync, readFileSync } from 'node:fs'; import { api } from './lib.mjs';
const [API, ADMIN, TOWN] = process.argv.slice(2); const call = api(API);
const st = existsSync('demo.json') ? JSON.parse(readFileSync('demo.json', 'utf8')) : {};
let r = await call('admin', 'signin', {}, { code: ADMIN }); if (r.j?.role !== 'admin') throw new Error('admin sign-in');
const accts = (await call('admin', 'accounts')).j.accounts;
for (const [name, role] of [['Alex Rivera', 'crew']]) {
  if (accts.some((a) => a.name === name && !a.off) && st[name]) continue;
  r = await call('admin', 'accountadd', {}, { name, role }); if (!r.j?.ok) throw new Error('add ' + name + ': ' + r.j?.error);
  st[name] = { code: r.j.code, id: r.j.id };
}
const rg = (await call('admin', 'regions')).j.regions.find((x) => x.key === TOWN);
let best = null;
for (const a of rg.areas.filter((x) => x.total >= 14 && x.total <= 26 && !x.done && !x.booked && !x.noanswer)) {
  const ds = (await call('admin', 'area', { region: TOWN, area: a.name })).j.doors || [];
  if (!ds.every((d) => !d.mark && !d.note && !d.phone && !d.rep)) continue;
  const hail = ds.filter((d) => d.hail && d.hail.length >= 2).length, mat = ds.filter((d) => d.mat).length, roof = ds.filter((d) => d.roof).length;
  const score = hail * 2 + mat + roof; if (!best || score > best.score) best = { area: a.name, n: ds.length, hail, mat, roof, score, ids: ds.map((d) => d.id) };
}
console.log(JSON.stringify({ area: best.area, n: best.n, hail: best.hail, mat: best.mat, roof: best.roof }));
st.town = TOWN; st.area = best.area; st.ids = best.ids;
writeFileSync('demo.json', JSON.stringify(st, null, 1));
