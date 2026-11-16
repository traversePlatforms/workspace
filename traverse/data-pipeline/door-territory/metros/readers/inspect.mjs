// What a county file holds, before writing its reader (Houston market, 16 Nov 2026): field names, how often each is filled, and the
// commonest values of short code fields. Names, addresses and other personal fields print as fill rates only.
//   node metros/readers/inspect.mjs <file.dbf | file.shp | file.txt|.csv> [--rows=20000] [--sep=tab|pipe|comma] [--fields=A,B]
import { openDbf } from 'shapefile';
import { createReadStream, readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
const file = process.argv[2], arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const ROWS = +arg('rows', 20000), ONLY = arg('fields', '') ? arg('fields').split(',') : null;
const PRIVATE = /own|name|addr|mail|situs|street|str_|legal|dba|care|agent|attn|phone|email|in_care|nm|desc/i;
const stats = {}; let n = 0;
const add = (rec) => {
  n++;
  for (const [k, v0] of Object.entries(rec)) {
    if (ONLY && !ONLY.includes(k)) continue;
    const v = v0 == null ? '' : String(v0).trim(); const s = (stats[k] = stats[k] || { fill: 0, vals: new Map(), num: 0 });
    if (v !== '' && v !== '0') s.fill++;
    if (v !== '' && !isNaN(+v)) s.num++;
    if (!PRIVATE.test(k) && v.length <= 12) s.vals.set(v, (s.vals.get(v) || 0) + 1);
  }
};
if (/\.(shp|dbf)$/i.test(file)) {
  const dbf = file.replace(/\.shp$/i, '.dbf'), prj = file.replace(/\.(shp|dbf)$/i, '.prj');
  if (existsSync(prj)) console.log('prj:', readFileSync(prj, 'utf8').slice(0, 300));
  const src = await openDbf(dbf, { encoding: 'latin1' });
  for (let r; n < ROWS && !(r = await src.read()).done;) add(r.value);
} else {
  const sep = { tab: '\t', pipe: '|', comma: ',' }[arg('sep', 'tab')];
  const rl = createInterface({ input: createReadStream(file, { encoding: 'latin1' }) }); let head = null;
  for await (const line of rl) {
    const c = line.split(sep).map((x) => x.replace(/^"|"$/g, ''));
    if (!head) { head = c.map((x) => x.trim()); continue; }
    add(Object.fromEntries(head.map((h, i) => [h, c[i]]))); if (n >= ROWS) break;
  }
}
console.log(`${n} rows read`);
for (const [k, s] of Object.entries(stats)) {
  const top = [...s.vals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([v, c]) => `${v || "''"}:${c}`).join(' ');
  console.log(`  ${k.padEnd(14)} fill ${String(Math.round(100 * s.fill / n)).padStart(3)}%  num ${String(Math.round(100 * s.num / n)).padStart(3)}%  ${PRIVATE.test(k) ? '(private: values not shown)' : s.vals.size > 200 ? `(${s.vals.size}+ distinct)` : top}`);
}
