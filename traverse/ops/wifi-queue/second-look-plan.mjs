/* The second look's next piece of work (2026-10-20, Matthew: "go ahead and run it" ... "prioritize properies that we are visiting").
   Prints one line:
     priority <town> <count>              houses we are visiting (state/visiting.json) that read no green and have not had a second look:
                                          houses tied to a lead or walk, doors handed to someone, every door in an assigned neighbourhood or
                                          one knocked in the last 30 days. Biggest such town first.
     town <town> <count>                  then whole towns, nearest Englewood first (the 45-mile focus)
     done                                 nothing left
   Reads the town files and lawn-cache.json; writes the ids file into state/. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const Q = 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/ops/wifi-queue', DT = 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory';
const R = 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/app/data/rounds';
const cache = JSON.parse(readFileSync(join(DT, 'lawn-cache.json'), 'utf8'));
const V = existsSync(join(Q, 'state/visiting.json')) ? JSON.parse(readFileSync(join(Q, 'state/visiting.json'), 'utf8')) : { first: {}, areas: {}, knocked: {} };
const idx = JSON.parse(readFileSync(join(R, 'index.json'), 'utf8'));
const ENG = [39.6478, -104.9878];
const need = (d) => { const c = cache[`${d.lat},${d.lon}`]; return c && !c.err && !(+c.s > 0) && !c.sl; };
const pri = [], towns = [];
for (const r of idx.regions || []) {
  if (/^(plano|frisco|mckinney)/.test(r.key)) continue;
  const f = join(R, r.key + '.json'); if (!existsSync(f)) continue;
  const j = JSON.parse(readFileSync(f, 'utf8'));
  const first = new Set((V.first || {})[r.key] || []), areaSet = new Set((V.areas || {})[r.key] || []), knocked = new Set((V.knocked || {})[r.key] || []);
  for (const a of j.areas || []) if (a.doors.some((d) => knocked.has(d.id))) areaSet.add(a.name);
  const p = [], all = []; let la = 0, lo = 0, n = 0;
  for (const a of j.areas || []) for (const d of a.doors) {
    if (typeof d.lat !== 'number') continue; la += d.lat; lo += d.lon; n++;
    if (!need(d)) continue; all.push(d.id);
    if (first.has(d.id) || areaSet.has(a.name)) p.push(d.id);
  }
  if (p.length) pri.push([r.key, p]);
  if (all.length) towns.push([r.key, all.length, n ? Math.hypot(la / n - ENG[0], (lo / n - ENG[1]) * 0.77) : 9]);
}
if (pri.length) {
  pri.sort((a, b) => b[1].length - a[1].length);
  const [t, ids] = pri[0], file = join(Q, `state/visiting-${t}.json`);
  writeFileSync(file, JSON.stringify(ids)); console.log(`priority ${t} ${ids.length}`);   /* the ids are in state/visiting-<town>.json */
} else if (towns.length) {
  towns.sort((a, b) => a[2] - b[2]); console.log(`town ${towns[0][0]} ${towns[0][1]}`);
} else console.log('done');
