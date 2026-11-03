#!/usr/bin/env node
/* The drafts that existed before the calendar, as an import manifest (2026-10-31). Words are copied exactly as written in the draft files;
 * nothing is rewritten. Everything loads unscheduled and unapproved, for Matthew to place and approve.
 *   node traverse/post-calendar/tools/existing-manifest.mjs <main-checkout> <out.json> [--skip-like <other-manifest.json> ...]
 * <main-checkout> is where the gitignored pictures are (the job-photo PNGs are not in git). --skip-like leaves out any old draft whose
 * first caption line already appears in another manifest (the November sets reuse some of these posts), so nothing loads twice.
 *   Sixfold 365: sixfold/content/365-social-2026-10/job-photo-posts/post-02..09 (post 01 went out 27 Oct)
 *   Surge: surge/drafts/fb-ig-set-2026-10/ posts 1-5, layout B pictures (post 6 went out on Facebook 27 Oct) */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [MAIN, OUT] = process.argv.slice(2);
if (!MAIN || !OUT) { console.log('usage: existing-manifest.mjs <main-checkout> <out.json> [--skip-like other.json ...]'); process.exit(1); }
/* the opening words of a caption (the November sets reworded some of these posts after the first sentence) */
const opening = (t) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 45);
const skipFirst = new Set();
process.argv.forEach((a, i) => { if (a === '--skip-like') for (const m of JSON.parse(readFileSync(process.argv[i + 1], 'utf8'))) skipFirst.add(opening(m.fb_caption || m.ig_caption)); });
const items = []; const left = [];
const between = (s, a, b) => { const i = s.indexOf(a); if (i < 0) return ''; const j = s.indexOf(b, i + a.length); return s.slice(i + a.length, j < 0 ? undefined : j).trim(); };

/* Sixfold 365 job-photo posts 02-09 */
const JP = 'sixfold/content/365-social-2026-10/job-photo-posts';
for (let n = 2; n <= 9; n++) {
  const nn = String(n).padStart(2, '0'); const md = readFileSync(join(MAIN, JP, `post-${nn}-caption-draft.md`), 'utf8');
  const fb = between(md, '## Facebook', '## Instagram'); const ig = between(md, '## Instagram', '\n---');
  const img = join(MAIN, JP, `post-${nn}.png`);
  if (!fb || !ig || !existsSync(img)) { left.push(`Sixfold post ${nn}: caption or picture missing`); continue; }
  if (skipFirst.has(opening(fb))) { left.push(`Sixfold post ${nn}: already in another manifest`); continue; }
  items.push({ brand: 'sixfold', key: `sixfold-job-photo-${nn}`, type: 'single', targets: ['fb', 'ig'], image: img, fb_caption: fb, ig_caption: ig,
    note: `Loaded as written from ${JP}/post-${nn}-caption-draft.md (written 26 Oct; its fact-check log is in that file). Not scheduled yet: CALENDAR.md has a suggested order.` });
}

/* Surge fb-ig set, posts 1-5 (layout B) */
const SD = 'surge/drafts/fb-ig-set-2026-10';
const smd = readFileSync(join(MAIN, SD, 'fb-ig-set-draft.md'), 'utf8');
const pics = { 1: 'surge-post-1-we-run-your-team-b.png', 2: 'surge-post-2-field-channels-b.png', 3: 'surge-post-3-training-first-b.png', 4: 'surge-post-4-rehearse-b.png', 5: 'surge-post-5-day-one-last-b.png' };
for (let n = 1; n <= 5; n++) {
  const head = new RegExp('^## ' + n + '\\. .*$', 'm').exec(smd); if (!head) { left.push(`Surge post ${n}: section not found`); continue; }
  const rest = smd.slice(head.index + head[0].length); const end = rest.search(/^## |^---$/m);
  const cap = (end < 0 ? rest : rest.slice(0, end)).split('\n').filter((l) => !/^Photo: /.test(l)).join('\n').trim();
  const img = join(MAIN, SD, 'posts', pics[n]);
  if (!cap || !existsSync(img)) { left.push(`Surge post ${n}: caption or picture missing`); continue; }
  if (skipFirst.has(opening(cap))) { left.push(`Surge post ${n}: already in the November manifest`); continue; }
  items.push({ brand: 'surge', key: `surge-fb-ig-set-${n}`, type: 'single', targets: ['fb'], image: img, fb_caption: cap, ig_caption: cap,
    note: `NEEDS MATTHEW'S REVIEW. Loaded as written from ${SD}/fb-ig-set-draft.md, post ${n} (company register, RESTRICTED.md checked when drafted 22 Oct; flags are listed in that file). Facebook only: @surge.ftw is not connected yet. On Facebook, a link goes in the first comment.` });
}
writeFileSync(OUT, JSON.stringify(items, null, 2));
console.log(`${items.length} drafts in the manifest`); for (const l of left) console.log('left out: ' + l);
