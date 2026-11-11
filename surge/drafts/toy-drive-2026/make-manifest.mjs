/* Post-calendar manifest for the toy drive (10 Nov 2026). Captions are copied exactly from posts.md (the > block under each
   "## N." heading); pictures from posts/. Everything loads as an unapproved draft for Matthew (Surge Inc Facebook page only).
     node make-manifest.mjs                       writes manifest.json
     node ../../../traverse/post-calendar/tools/pc.mjs import manifest.json --dry-run | --refresh                       */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const md = readFileSync(join(HERE, 'posts.md'), 'utf8');
const pngs = readdirSync(join(HERE, 'posts')).filter((f) => /^toy-drive-\d\d-.*\.png$/.test(f));
const SCHEDULE = { 1: '2026-11-11', 2: '2026-11-16', 3: '2026-11-18', 4: '2026-11-23', 5: '2026-11-25', 6: '2026-11-30', 7: '2026-12-02',
  8: '2026-12-07', 9: '2026-12-09', 10: '2026-12-14', 11: '2026-12-16', 12: '2026-12-21', 13: '2026-12-23', 14: '2026-12-28' };
const CHECK = {
  1: "The poster photo carries the event doc's QR code, and the doc opens for editing until Maya makes it view-only. Hold this one or cover the QR if that matters.",
  4: 'Where photo d was taken is still unconfirmed; run it only if it was this drive.',
  13: 'Says the boxes are out today (23 Dec): confirm, or cut that sentence to "Last chance to drop off a toy."',
  14: 'No count on purpose; a final count can be added later from a dated tally.',
};
const items = [];
for (let n = 1; n <= 14; n++) {
  const head = new RegExp('^## ' + n + '\\. (.*)$', 'm').exec(md);
  if (!head) throw new Error('post ' + n + ': heading not found');
  const rest = md.slice(head.index + head[0].length);
  const end = rest.search(/^---$/m);
  const sec = end < 0 ? rest : rest.slice(0, end);
  const start = sec.indexOf('**Facebook caption:**');
  const lines = sec.slice(start).split('\n').slice(1);
  const quote = [];
  for (const l of lines) { if (l.startsWith('>')) quote.push(l.replace(/^> ?/, '')); else if (quote.length && l.trim() === '') break; }
  const caption = quote.join('\n').trim();
  if (!caption || /\[[A-Z]/.test(caption)) throw new Error('post ' + n + ': caption missing or has a [SLOT]');
  const img = pngs.find((f) => f.startsWith('toy-drive-' + String(n).padStart(2, '0') + '-'));
  if (!img) throw new Error('post ' + n + ': picture missing');
  items.push({
    brand: 'surge', key: 'surge-toy-drive-2026-' + String(n).padStart(2, '0'), type: 'single', targets: ['fb'],
    date: SCHEDULE[n], time: n === 13 ? '09:00' : '15:00', image: 'posts/' + img, fb_caption: caption, ig_caption: caption,
    note: `NEEDS MATTHEW'S REVIEW. Toy drive post ${n} of 14 (${head[1].replace(/^[^:]*: /, '')}). Draft only. Facebook only (Surge's Instagram is not linked). No first comment. Matthew's 10 Nov calls applied: no counts, no box days, 12-6 pm, new or slightly used. Details and fact-check in surge/drafts/toy-drive-2026/posts.md.` + (CHECK[n] ? ' CHECK: ' + CHECK[n] : ''),
  });
}
writeFileSync(join(HERE, 'manifest.json'), JSON.stringify(items, null, 2) + '\n');
console.log(items.length + ' posts in manifest.json');
for (const i of items) console.log(i.key, i.date, i.time, i.image, i.fb_caption.split(/\s+/).length + ' words');
