/* Sixfold training -> the door app's Training section (2026-10-05).
 *
 *   node sixfold/training/build-training.mjs     writes door-app/site/data/rounds/training.json
 *
 * Each 0N-*.md file is one heading in the app; each "## " in it is one lesson. "Source:" lines are kept out of the app.
 * The lesson id comes from the file and the title, so editing a lesson's text keeps its id; renaming it makes a new one.
 * Upload: training.json goes to sixfold-data/rounds/ (beside public_html). It REPLACES whatever lessons are live, including
 * any the office added in the app, so read the live list first (the office's own lessons would need adding to a file here).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'door-app', 'site', 'data', 'rounds', 'training.json');
const KIND = { '01-doors.md': 'door', '02-sales.md': 'sales', '03-quotes.md': 'quote', '04-phones.md': 'phone', '05-paperwork.md': 'paper', '06-safety.md': 'safety', '07-using-the-app.md': 'app' };

const lessons = [];
for (const f of readdirSync(HERE).filter((f) => KIND[f]).sort()) {
  const lines = readFileSync(join(HERE, f), 'utf8').replace(/\r/g, '').split('\n');
  let cur = null;
  const done = () => { if (!cur) return; const text = cur.body.join('\n').replace(/\n{3,}/g, '\n\n').trim(); lessons.push({ id: 'l' + createHash('sha1').update(f + '|' + cur.title).digest('hex').slice(0, 8), title: cur.title, kind: KIND[f], text }); };
  for (const l of lines) {
    if (/^## /.test(l)) { done(); cur = { title: l.slice(3).trim(), body: [] }; continue; }
    if (!cur || /^Source:/.test(l)) continue;
    if (/\*\*|`/.test(l)) throw new Error(`${f} "${cur.title}": bold or code marks show as raw characters in the app: ${l.slice(0, 80)}`);
    cur.body.push(l.replace(/^### /, '# '));
  }
  done();
}
for (const l of lessons) {
  if (l.title.length > 120) throw new Error('title over 120: ' + l.title);
  if (l.text.length > 20000) throw new Error('lesson over 20,000 characters: ' + l.title);
  if (!l.text) throw new Error('empty lesson: ' + l.title);
}
if (new Set(lessons.map((l) => l.id)).size !== lessons.length) throw new Error('duplicate lesson id');
writeFileSync(OUT, JSON.stringify({ lessons, by: 'Sixfold training files (sixfold/training)', at: Math.floor(Date.now() / 1000) }, null, 0));
const by = lessons.reduce((m, l) => ((m[l.kind] = (m[l.kind] || 0) + 1), m), {});
console.log(`${lessons.length} lessons -> ${OUT}`);
console.log(JSON.stringify(by), '| longest', Math.max(...lessons.map((l) => l.text.length)), 'characters');
