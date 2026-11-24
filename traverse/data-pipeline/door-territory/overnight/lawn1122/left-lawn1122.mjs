// lawn1122 doors not yet measured (24 Nov 2026, the finish on the cloud computer after yardtest was stopped).
//   node left-lawn1122.mjs <lawn-trial dir> [--keys=<file of "tier key" lines>]
// Reads each tier's door list (lawn-trial/yard-low-targets/t1..t4/<key>.json) and the results (lawn-trial/yard-v4/<key>.json) and
// prints one line per tier-town with doors left, "tier key left", most first, then "#total <targeted> <left>".
// --keys: only those tier-towns (quicker, for the progress readout).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const LT = process.argv[2];
const ka = process.argv.find((a) => a.startsWith('--keys='));
const only = ka ? new Set(readFileSync(ka.slice(7), 'utf8').split('\n').map((l) => l.trim().split(' ').slice(0, 2).join(' ')).filter(Boolean)) : null;
const outs = {}, rows = []; let total = 0, left = 0;
for (const t of ['t1', 't2', 't3', 't4']) {
  const dir = `${LT}/yard-low-targets/${t}`; if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const k = f.slice(0, -5); if (only && !only.has(`${t} ${k}`)) continue;
    const ids = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')).areas.flatMap((a) => a.doors).filter((d) => d.lat && d.lon).map((d) => d.id);
    if (!(k in outs)) { const p = `${LT}/yard-v4/${k}.json`; outs[k] = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).doors : {}; }
    const n = ids.filter((i) => !(i in outs[k])).length;
    total += ids.length; left += n; if (n) rows.push([t, k, n]);
  }
}
rows.sort((a, b) => b[2] - a[2]);
for (const r of rows) console.log(r.join(' '));
console.log(`#total ${total} ${left}`);
