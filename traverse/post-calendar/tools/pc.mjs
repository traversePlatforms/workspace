#!/usr/bin/env node
/* Post calendar from the laptop (2026-10-31): load drafts from a manifest, read open change requests, answer one with a new picture or
 * caption. Signs in with the EDITOR code (~/.ssh/post-calendar-editor-code.txt), which can add drafts and pictures but can never approve:
 * everything this loads arrives as an unapproved draft and waits for Matthew. Never prints a code.
 *
 *   node traverse/post-calendar/tools/pc.mjs import <manifest.json> [--dry-run] [--refresh]   (--refresh: posts already loaded get changed pictures, captions, album name and note from the manifest)
 *   node traverse/post-calendar/tools/pc.mjs requests [client]
 *   node traverse/post-calendar/tools/pc.mjs list [client]          (id, time, status, what still blocks Approve)
 *   node traverse/post-calendar/tools/pc.mjs answer <post-id> [--image a.png[,b.png]] [--replace N] [--fb fb.txt] [--ig ig.txt] [--album "Name"]
 *
 * A manifest is a JSON array; each item:
 *   { "brand": "sixfold" | "surge" | <client id>, "type": "single" | "photoset" (default single),
 *     "date": "YYYY-MM-DD", "time": "15:00" (Mountain; leave both out for "not scheduled yet"), "targets": ["fb", "ig"],
 *     "image": "<path>"  (single; a .mp4 here makes it a video post: Facebook video + Instagram Reel)   or   "images": ["<path>", ...] or [{ "path": "<path>", "caption": "..." }]  (photoset, 2-10),
 *     "fb_caption": "...", "ig_caption": "...", "album": "Facebook album name (photoset)", "note": "shown on the draft only", "key": "optional id" }
 * Relative image paths are read from the manifest's folder. An item already loaded (same key, or same client, time, pictures and caption)
 * is skipped, so a manifest can be imported again after it grows. Env for tests: PC_BASE (the api address), PC_CODE_FILE. */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, dirname, basename, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';

const BASE = process.env.PC_BASE || 'https://traverseplatforms.com/posts-ab8c57/api/cal.php';
const CODE_FILE = process.env.PC_CODE_FILE || join(homedir(), '.ssh', 'post-calendar-editor-code.txt');
const BRANDS = { sixfold: 'sixfold', 'sixfold365': 'sixfold', 'sixfold 365': 'sixfold', surge: 'surge' };
let cookie = '';

async function call(action, body, query = '') {
  const o = { method: body ? 'POST' : 'GET', headers: { Cookie: cookie } };
  if (body instanceof FormData) { o.body = body; o.headers['X-PC'] = '1'; }
  else if (body) { o.body = JSON.stringify(body); o.headers['Content-Type'] = 'application/json'; o.headers['X-PC'] = '1'; }
  const r = await fetch(BASE + '?action=' + action + query, o);
  const sc = r.headers.get('set-cookie'); if (sc && /postcal=/.test(sc)) cookie = sc.split(';')[0];
  let j; try { j = await r.json(); } catch { j = { ok: false, error: 'HTTP ' + r.status }; }
  if (!j.ok) throw new Error(action + ': ' + (j.error || 'failed'));
  return j;
}
async function signIn() {
  if (!existsSync(CODE_FILE)) throw new Error('No editor code file at ' + CODE_FILE);
  const code = readFileSync(CODE_FILE, 'utf8').replace(/\D/g, '');
  const j = await call('signin', { code });
  if (j.role !== 'editor') console.log('note: signed in as ' + j.role + ' (' + j.name + ')');
}
async function upload(id, path, extra = {}) {
  const buf = readFileSync(path); const png = /\.png$/i.test(path); const mp4 = /\.mp4$/i.test(path);   /* + an MP4 video for a one-post item (2026-11-05) */
  const fd = new FormData(); fd.append('id', id); for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null) fd.append(k, String(v));
  fd.append('file', new Blob([buf], { type: mp4 ? 'video/mp4' : png ? 'image/png' : 'image/jpeg' }), basename(path));
  return call('upload', fd);
}
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };

async function importManifest(file, dry, refresh = false) {
  const dir = dirname(resolve(file)); const items = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(items)) throw new Error('The manifest must be a JSON array.');
  const plan = items.map((m, n) => {
    const client = BRANDS[String(m.brand || m.client || '').toLowerCase()] || String(m.client || m.brand || '');
    const type = m.type === 'photoset' ? 'photoset' : 'single';
    const pics = (type === 'photoset' ? (m.images || []) : [m.image]).filter(Boolean).map((x) => (typeof x === 'string' ? { path: x } : x)).map((x) => ({ ...x, path: isAbsolute(x.path) ? x.path : join(dir, x.path) }));
    const missing = pics.filter((x) => !existsSync(x.path)).map((x) => x.path);
    const src = m.key ? 'key:' + m.key : 'manifest:' + createHash('sha1').update([client, m.date || '', m.time || '', type, pics.map((x) => basename(x.path)).join(','), m.fb_caption || m.ig_caption || ''].join('|')).digest('hex').slice(0, 16);
    return { n: n + 1, m, client, type, pics, missing, src };
  });
  let made = 0, skipped = 0, bad = 0, refreshed = 0;
  for (const it of plan) {
    const label = `#${it.n} ${it.client} ${it.m.date || 'unscheduled'} ${it.m.time || ''}`;
    if (!it.client) { console.log(label + ': no brand/client, skipped'); bad++; continue; }
    if (it.missing.length) { console.log(label + ': picture not found (' + it.missing.join(', ') + '), skipped'); bad++; continue; }
    if (it.type === 'single' && it.pics.length !== 1) { console.log(label + ': a single post needs one image, skipped'); bad++; continue; }
    if (dry) { console.log(label + `: would load (${it.type}, ${it.pics.length} picture${it.pics.length === 1 ? '' : 's'}, ${(it.m.targets || []).join('+')})`); continue; }
    const body = { client: it.client, type: it.type, targets: it.m.targets || ['fb', 'ig'], fb: it.m.fb_caption || '', ig: it.m.ig_caption || '', album: it.m.album || '', note: it.m.note || '', src: it.src };
    if (it.m.date && it.m.time) { body.date = it.m.date; body.time = it.m.time; } else body.unscheduled = true;
    const j = await call('create', body);
    if (j.dup && refresh) {   /* already loaded: put up any picture whose bytes changed (same file name, new card) */
      const d = await call('data', null, '&client=' + encodeURIComponent(it.client)); const p = d.posts.find((q) => q.id === j.dup);
      if (!p) { console.log(label + ': already loaded (' + j.dup + ') but not readable, skipped'); skipped++; continue; }
      if (['publishing', 'published'].includes(p.status)) { console.log(label + ': already ' + p.status + ', pictures left as they went'); skipped++; continue; }
      let n = 0;
      for (let i = 0; i < it.pics.length; i++) {
        const buf = readFileSync(it.pics[i].path); const md5 = createHash('md5').update(buf).digest('hex');
        if (p.images[i] && (p.images[i].md5 ? p.images[i].md5 === md5 : p.images[i].bytes === buf.length)) continue;   /* pictures stored before md5 was kept: same size = same file */
        await upload(j.dup, it.pics[i].path, p.images[i] ? { replace: i } : (it.pics[i].caption ? { caption: it.pics[i].caption } : {})); n++;
      }
      /* the words too, when the manifest's differ (the note is never posted; captions and album name as the manifest has them) */
      const patch = {}; for (const [k, v] of [['fb', body.fb], ['ig', body.ig], ['album', body.album], ['note', body.note]]) if ((p[k] || '') !== (v || '')) patch[k] = v;
      if (Object.keys(patch).length) { await call('edit', { id: j.dup, ...patch }); n++; }
      if (n) { console.log(label + `: refreshed on ${j.dup}` + (Object.keys(patch).length ? ' (' + Object.keys(patch).join(', ') + ' updated)' : '') + ' (still a draft)'); refreshed++; } else { console.log(label + ': already loaded, unchanged'); skipped++; }
      continue;
    }
    if (j.dup) { console.log(label + ': already loaded (' + j.dup + '), skipped'); skipped++; continue; }
    for (const x of it.pics) await upload(j.id, x.path, { caption: x.caption || undefined, w: it.m.w, h: it.m.h, sec: it.m.sec });   /* w/h/sec: a video's size when the server can't read it */
    console.log(label + ': loaded as draft ' + j.id); made++;
  }
  console.log(`done: ${made} loaded, ${refresh ? refreshed + ' refreshed, ' : ''}${skipped} already there, ${bad} skipped with a problem. Nothing is approved; Matthew approves each post on the calendar.`);
}

async function answer(id) {
  const body = { id, answer: true }; let any = false;
  if (arg('--fb')) { body.fb = readFileSync(arg('--fb'), 'utf8').trim(); any = true; }
  if (arg('--ig')) { body.ig = readFileSync(arg('--ig'), 'utf8').trim(); any = true; }
  if (arg('--album')) { body.album = arg('--album'); any = true; }
  const imgs = (arg('--image') || '').split(',').filter(Boolean);
  if (imgs.length) {
    const rep = arg('--replace');
    for (let i = 0; i < imgs.length; i++) await upload(id, imgs[i], { replace: rep !== undefined ? Number(rep) + i : undefined, answer: !any && i === imgs.length - 1 ? 'true' : undefined });
  }
  if (any) await call('edit', body);
  if (!any && !imgs.length) throw new Error('Give --image, --fb, --ig or --album.');
  console.log('answered: ' + id + ' is back to draft for Matthew to look at');
}

const [cmd, a1] = process.argv.slice(2);
try {
  await signIn();
  if (cmd === 'import' && a1) await importManifest(a1, process.argv.includes('--dry-run'), process.argv.includes('--refresh'));
  else if (cmd === 'requests') console.log(JSON.stringify((await call('requests', null, a1 ? '&client=' + encodeURIComponent(a1) : '')).requests, null, 2));
  else if (cmd === 'answer' && a1) await answer(a1);
  else if (cmd === 'list') {   /* one client's posts: id, time (Mountain), status, what still blocks Approve */
    const d = await call('data', null, '&client=' + encodeURIComponent(a1 || 'sixfold'));
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    for (const p of d.posts) console.log([p.id, p.at ? fmt.format(new Date(p.at * 1000)) : 'unscheduled', p.openRequest ? 'changes' : p.status, p.type, p.targets.join('+'), p.problems.join(' ') || 'ready'].join(' | '));
  }
  else { console.log('usage: pc.mjs import <manifest.json> [--dry-run] | requests [client] | answer <post-id> [--image f] [--replace N] [--fb f] [--ig f] [--album name]'); process.exitCode = 1; }
} catch (e) { console.error(String(e.message || e)); process.exitCode = 1; }
