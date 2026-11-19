#!/usr/bin/env node
/* Post calendar from the laptop (2026-10-31): load drafts from a manifest, read open change requests, answer one with a new picture or
 * caption. Signs in with the EDITOR code (~/.ssh/post-calendar-editor-code.txt), which can add drafts and pictures but can never approve:
 * everything this loads arrives as an unapproved draft and waits for Matthew. Never prints a code.
 *
 *   node traverse/post-calendar/tools/pc.mjs import <manifest.json> [--dry-run] [--refresh]   (--refresh: posts already loaded get changed pictures, captions, album name and note from the manifest)
 *   node traverse/post-calendar/tools/pc.mjs requests [client]
 *   node traverse/post-calendar/tools/pc.mjs list [client]          (id, time, status, what still blocks Approve)
 *   node traverse/post-calendar/tools/pc.mjs answer <post-id> [--image a.png[,b.png]] [--replace N] [--fb fb.txt] [--ig ig.txt] [--album "Name"]
 *       designed card (19 Nov): [--card-bg photo.jpg|keep [--zoom 1..4] [--x 0..1] [--y 0..1] [--dim 0..0.9] [--card-out look.jpg]] or [--card-orig]
 *   node traverse/post-calendar/tools/pc.mjs card <post-id> <name.card.json> [--keep-orig]   (give a loaded card its recipe: picture, words, approval unchanged)
 *   node traverse/post-calendar/tools/pc.mjs photos <post-id> [--out dir]   (the open change request's photos, saved as request-photo-N.jpg)
 *   node traverse/post-calendar/tools/pc.mjs look <post-id> --card-bg photo.jpg [--zoom --x --y --dim] --card-out look.jpg   (draw only; nothing sent)
 *
 * A manifest is a JSON array; each item:
 *   { "brand": "sixfold" | "surge" | <client id>, "type": "single" | "photoset" (default single),
 *     "date": "YYYY-MM-DD", "time": "15:00" (Mountain; leave both out for "not scheduled yet"), "targets": ["fb", "ig"],
 *     "image": "<path>"  (single; a .mp4 here makes it a video post: Facebook video + Instagram Reel)   or   "images": ["<path>", ...] or [{ "path": "<path>", "caption": "..." }]  (photoset, 2-10),
 *     "fb_caption": "...", "ig_caption": "...", "album": "Facebook album name (photoset)", "note": "shown on the draft only", "key": "optional id",
 *     "li_caption": "...", "li_comment": "first comment, the place for links" (LinkedIn, Surge only; "targets": ["li"]; a LinkedIn-only post may have no image),
 *     "card": "<name>.card.json" (a designed card's recipe, so Change photo works on the calendar; 19 Nov) }
 * Relative image paths are read from the manifest's folder. An item already loaded (same key, or same client, time, pictures and caption)
 * is skipped, so a manifest can be imported again after it grows. Env for tests: PC_BASE (the api address), PC_CODE_FILE. */
import { readFileSync, existsSync, appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve, dirname, basename, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LOADED = process.env.PC_LOADED || join(dirname(fileURLToPath(import.meta.url)), '..', 'loaded.jsonl');   /* 16 Nov: every draft this tool loads */
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
    const src = m.key ? 'key:' + m.key : 'manifest:' + createHash('sha1').update([client, m.date || '', m.time || '', type, pics.map((x) => basename(x.path)).join(','), m.fb_caption || m.ig_caption || m.li_caption || ''].join('|')).digest('hex').slice(0, 16);
    const card = m.card ? (isAbsolute(m.card) ? m.card : join(dir, m.card)) : null; if (card && !existsSync(card)) missing.push(card);   /* 19 Nov: a designed card's recipe */
    return { n: n + 1, m, client, type, pics, missing, src, card };
  });
  let made = 0, skipped = 0, bad = 0, refreshed = 0;
  for (const it of plan) {
    const label = `#${it.n} ${it.client} ${it.m.date || 'unscheduled'} ${it.m.time || ''}`;
    if (!it.client) { console.log(label + ': no brand/client, skipped'); bad++; continue; }
    if (it.missing.length) { console.log(label + ': picture not found (' + it.missing.join(', ') + '), skipped'); bad++; continue; }
    if (it.type === 'single' && it.pics.length !== 1 && !(it.pics.length === 0 && JSON.stringify(it.m.targets || []) === '["li"]')) { console.log(label + ': a single post needs one image, skipped'); bad++; continue; }
    if (dry) { console.log(label + `: would load (${it.type}, ${it.pics.length} picture${it.pics.length === 1 ? '' : 's'}, ${(it.m.targets || []).join('+')})`); continue; }
    const body = { client: it.client, type: it.type, targets: it.m.targets || ['fb', 'ig'], fb: it.m.fb_caption || '', ig: it.m.ig_caption || '', li: it.m.li_caption || '', li_comment: it.m.li_comment || '', album: it.m.album || '', note: it.m.note || '', src: it.src };
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
      const patch = {}; for (const [k, v] of [['fb', body.fb], ['ig', body.ig], ['li', body.li], ['li_comment', body.li_comment], ['album', body.album], ['note', body.note]]) if ((p[k] || '') !== (v || '')) patch[k] = v;
      if (Object.keys(patch).length) { await call('edit', { id: j.dup, ...patch }); n++; }
      if (it.card) {   /* the recipe, when it is missing, its layer changed, or the card itself was just replaced */
        const lay = createHash('md5').update(readFileSync(readRecipe(it.card).overlay)).digest('hex'); const picsNew = n > (Object.keys(patch).length ? 1 : 0);
        if (!p.card || picsNew || (p.card.overlay && p.card.overlay.md5 !== lay)) { await setCard(j.dup, it.card, !!p.card && !picsNew); n++; }
      }
      if (n) { console.log(label + `: refreshed on ${j.dup}` + (Object.keys(patch).length ? ' (' + Object.keys(patch).join(', ') + ' updated)' : '') + ' (still a draft)'); refreshed++; } else { console.log(label + ': already loaded, unchanged'); skipped++; }
      continue;
    }
    if (j.dup) { console.log(label + ': already loaded (' + j.dup + '), skipped'); skipped++; continue; }
    for (const x of it.pics) await upload(j.id, x.path, { caption: x.caption || undefined, w: it.m.w, h: it.m.h, sec: it.m.sec });   /* w/h/sec: a video's size when the server can't read it */
    if (it.card) await setCard(j.id, it.card);   /* Change photo on the calendar (19 Nov) */
    console.log(label + ': loaded as draft ' + j.id); made++;
    /* 16 Nov: what was handed over, so jen-learn.mjs can compare it with what the approver changed and approved */
    appendFileSync(LOADED, JSON.stringify({ id: j.id, client: body.client || '', date: it.m.date || null, type: body.type, fb: body.fb || '', ig: body.ig || '', li: body.li || '', pics: it.pics.map((x) => basename(x.path)), note: body.note || '', loaded: new Date().toISOString() }) + '\n');
  }
  console.log(`done: ${made} loaded, ${refresh ? refreshed + ' refreshed, ' : ''}${skipped} already there, ${bad} skipped with a problem. Nothing is approved; Matthew approves each post on the calendar.`);
}

async function answer(id) {
  const body = { id, answer: true }; let any = false;
  if (arg('--fb')) { body.fb = readFileSync(arg('--fb'), 'utf8').trim(); any = true; }
  if (arg('--ig')) { body.ig = readFileSync(arg('--ig'), 'utf8').trim(); any = true; }
  if (arg('--album')) { body.album = arg('--album'); any = true; }
  if (arg('--li')) { body.li = readFileSync(arg('--li'), 'utf8').trim(); any = true; }   /* LinkedIn words and first comment (2026-11-18) */
  if (arg('--li-comment')) { body.li_comment = readFileSync(arg('--li-comment'), 'utf8').trim(); any = true; }
  if (arg('--note')) { body.note = arg('--note'); any = true; }   /* what changed, shown on the post (16 Nov) */
  if (arg('--keep')) {   /* 16 Nov: keep these pictures, in this order (1-based, as the post shows them now): removes and reorders */
    const d = await call('data', null, '&client=' + encodeURIComponent(arg('--client') || 'sixfold')); const p = d.posts.find((q) => q.id === id); if (!p) throw new Error('no such post: ' + id);
    const n = arg('--keep').split(',').map((x) => Number(x.trim())); if (!n.length || n.some((k) => !(k >= 1 && k <= p.images.length))) throw new Error('--keep takes picture numbers 1..' + p.images.length);
    body.images = n.map((k) => ({ file: p.images[k - 1].file })); any = true;
  }
  const imgs = (arg('--image') || '').split(',').filter(Boolean);
  /* 19 Nov: a designed card with a new photo behind its words (--card-bg photo.jpg, or "keep" to move the one it has), or its original back */
  if (arg('--card-bg') && (imgs.length || arg('--keep'))) throw new Error('--card-bg goes without --image and --keep.');
  if (process.argv.includes('--card-orig')) {
    if (arg('--card-bg') || imgs.length || arg('--keep')) throw new Error('--card-orig goes without --card-bg, --image and --keep.');
    await call('cardorig', { id, answer: any ? undefined : true });
  }
  if (arg('--card-bg')) {
    const { jpg, photo, pos, keepBg } = await drawCardFor(id);
    const fd = new FormData(); fd.append('id', id); fd.append('replace', '0'); fd.append('cardpos', JSON.stringify(pos)); if (!any) fd.append('answer', 'true');
    fd.append('file', new Blob([jpg], { type: 'image/jpeg' }), 'card.jpg'); if (!keepBg) fd.append('cardbg', new Blob([photo], { type: 'image/jpeg' }), 'card-photo.jpg');
    await call('upload', fd);
  }
  if (imgs.length) {
    const rep = arg('--replace');
    for (let i = 0; i < imgs.length; i++) await upload(id, imgs[i], { replace: rep !== undefined ? Number(rep) + i : undefined, answer: !any && i === imgs.length - 1 ? 'true' : undefined });
  }
  if (any) await call('edit', body);
  if (!any && !imgs.length && !arg('--card-bg') && !process.argv.includes('--card-orig')) throw new Error('Give --image, --card-bg, --card-orig, --fb, --ig, --li, --li-comment or --album.');
  console.log('answered: ' + id + ' is back to draft for the approver to look at');
}
/* ---- designed cards (2026-11-19): a card's recipe, and drawing a card with a new photo here the same way the page draws it ----
 * A recipe file (<card>.card.json, written by the month's build script beside the card): { tpl, title, src, w, h, box, base, tint, dim,
 * overlay: "<the see-through layer PNG>", card: "<the card PNG as loaded>" }; paths are relative to the recipe file. */
let SHARP = null;
function sharp() {
  if (!SHARP) { const req = createRequire(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'node_modules', 'x.js')); try { SHARP = req('sharp'); } catch { throw new Error('sharp is not installed in the repository (npm i sharp).'); } }
  return SHARP;
}
export function cardLayout(card, iw, ih, pos) {   /* the same sums as the page (index.html, cardLayout) */
  const [bx, by, bw, bh] = card.box || [0, 0, card.w, card.h]; const s = Math.max(bw / iw, bh / ih) * (pos.zoom || 1); const dw = iw * s, dh = ih * s;
  return { b: { x: bx, y: by, w: bw, h: bh }, dx: bx + (bw - dw) * pos.x, dy: by + (bh - dh) * pos.y, dw, dh };
}
/** the card drawn with a photo: the ground colour, the photo filling the box (cover, then zoom and position), the tint, the words layer on top */
export async function composeCard(card, layerBuf, photoBuf, pos) {
  const S = sharp(); const { data, info } = await S(photoBuf).rotate().toBuffer({ resolveWithObject: true });
  const L = cardLayout(card, info.width, info.height, pos); const { b } = L;
  const dw = Math.max(b.w, Math.round(L.dw)), dh = Math.max(b.h, Math.round(L.dh));
  const left = Math.min(dw - b.w, Math.max(0, Math.round(b.x - L.dx))), top = Math.min(dh - b.h, Math.max(0, Math.round(b.y - L.dy)));
  const crop = await S(data).resize(dw, dh, { fit: 'fill', kernel: 'lanczos3' }).extract({ left, top, width: b.w, height: b.h }).toBuffer();
  const hex = (card.base || '#000000').replace('#', ''); const t = card.tint || [0, 0, 0];
  const layers = [{ input: crop, left: b.x, top: b.y }];
  if (pos.dim > 0) layers.push({ input: { create: { width: b.w, height: b.h, channels: 4, background: { r: t[0], g: t[1], b: t[2], alpha: pos.dim } } }, left: b.x, top: b.y });
  layers.push({ input: layerBuf, left: 0, top: 0 });
  return S({ create: { width: card.w, height: card.h, channels: 3, background: { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) } } }).composite(layers).jpeg({ quality: 92 }).toBuffer();
}
/** a photo made ready to keep as a card's background: upright, at most 2160 px, a fresh JPEG without EXIF (so no location) */
async function bgJpeg(buf) { return sharp()(buf).rotate().resize(2160, 2160, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer(); }
function readRecipe(file) {
  const r = JSON.parse(readFileSync(file, 'utf8')); const dir = dirname(resolve(file));
  const p = (x) => (isAbsolute(x) ? x : join(dir, x));
  if (!r.overlay || !existsSync(p(r.overlay))) throw new Error('recipe ' + file + ': its layer PNG is missing');
  const recipe = { tpl: r.tpl, title: r.title || '', src: r.src || '', w: r.w, h: r.h, box: r.box, base: r.base, tint: r.tint, dim: r.dim };
  return { recipe, overlay: p(r.overlay), card: r.card ? p(r.card) : null };
}
/** give a post on the calendar its card recipe; refuses when the post's picture is not the card the recipe belongs to */
async function setCard(id, file, keep = false) {
  const { recipe, overlay, card } = readRecipe(file);
  const fd = new FormData(); fd.append('id', id); fd.append('recipe', JSON.stringify(recipe)); if (keep) fd.append('orig', 'keep');
  if (card && existsSync(card)) { const buf = readFileSync(card); fd.append('expect_md5', createHash('md5').update(buf).digest('hex')); fd.append('expect_bytes', String(buf.length)); }
  fd.append('overlay', new Blob([readFileSync(overlay)], { type: 'image/png' }), basename(overlay));
  return call('cardset', fd);
}
async function postById(id) {
  const d = await call('data', null, '&client=' + encodeURIComponent(arg('--client') || 'sixfold')); const p = d.posts.find((q) => q.id === id);
  if (!p) throw new Error('no such post: ' + id); return p;
}
const media = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error('could not fetch ' + url + ' (HTTP ' + r.status + ')'); return Buffer.from(await r.arrayBuffer()); };
/** the open request's photos, saved to a folder (default: the current one) */
/** the card of post <id> drawn with --card-bg (a photo, or "keep") and --x --y --zoom --dim; --card-out saves a copy to look at */
async function drawCardFor(id) {
  const p = await postById(id); if (!p.card || !p.card.overlay) throw new Error(id + ' is not a designed card with a recipe; use --image instead.');
  const keepBg = arg('--card-bg') === 'keep'; if (keepBg && !p.card.bg) throw new Error('the card has no photo yet to move: give --card-bg <photo>');
  const photo = keepBg ? await media(p.card.bg.url) : await bgJpeg(readFileSync(arg('--card-bg')));
  const was = keepBg && p.card.pos ? p.card.pos : {};
  const num = (k, d, lo, hi) => Math.max(lo, Math.min(hi, arg(k) !== undefined && isFinite(+arg(k)) ? +arg(k) : d));   /* the server's limits */
  const pos = { x: num('--x', was.x ?? 0.5, 0, 1), y: num('--y', was.y ?? 0.5, 0, 1), zoom: num('--zoom', was.zoom ?? 1, 1, 4), dim: num('--dim', was.dim ?? p.card.dim ?? 0.5, 0, 0.9) };
  const jpg = await composeCard(p.card, await media(p.card.overlay.url), photo, pos);
  if (arg('--card-out')) writeFileSync(arg('--card-out'), jpg);
  return { jpg, photo, pos, keepBg };
}
async function photos(id) {
  const out = resolve(arg('--out') || '.'); mkdirSync(out, { recursive: true });
  const r = (await call('requests', null, '&client=' + encodeURIComponent(arg('--client') || 'sixfold'))).requests.find((q) => q.post === id);
  if (!r) throw new Error('no open change request on ' + id);
  if (!r.photos || !r.photos.length) { console.log('the request has no photos'); return; }
  for (const [i, x] of r.photos.entries()) {
    const res = await fetch(BASE + '?action=reqphoto&post=' + encodeURIComponent(id) + '&f=' + encodeURIComponent(x.file), { headers: { Cookie: cookie } });
    if (!res.ok) throw new Error('photo ' + (i + 1) + ': HTTP ' + res.status);
    const f = join(out, `request-photo-${i + 1}${x.file.endsWith('.png') ? '.png' : '.jpg'}`); writeFileSync(f, Buffer.from(await res.arrayBuffer())); console.log(f);
  }
}
async function note(id) {   /* 16 Nov: a note on the post WITHOUT answering the request (e.g. why it could not be done) */
  if (!arg('--note')) throw new Error('Give --note "text".');
  await call('edit', { id, note: arg('--note') }); console.log('note set on ' + id + ' (request still open)');
}

const [cmd, a1] = process.argv.slice(2);
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) try {   /* run as a command (the card drawing above can also be imported) */
  await signIn();
  if (cmd === 'import' && a1) await importManifest(a1, process.argv.includes('--dry-run'), process.argv.includes('--refresh'));
  else if (cmd === 'requests') console.log(JSON.stringify((await call('requests', null, a1 ? '&client=' + encodeURIComponent(a1) : '')).requests, null, 2));
  else if (cmd === 'answer' && a1) await answer(a1);
  else if (cmd === 'note' && a1) await note(a1);
  else if (cmd === 'card' && a1 && process.argv[4]) { const j = await setCard(a1, process.argv[4], process.argv.includes('--keep-orig')); console.log('card recipe set on ' + a1 + ' (' + j.post.card.tpl + '); its picture, words and approval are unchanged'); }
  else if (cmd === 'photos' && a1) await photos(a1);
  else if (cmd === 'look' && a1 && arg('--card-bg') && arg('--card-out')) { await drawCardFor(a1); console.log('drawn (nothing sent): ' + arg('--card-out')); }
  else if (cmd === 'list') {   /* one client's posts: id, time (Mountain), status, what still blocks Approve */
    const d = await call('data', null, '&client=' + encodeURIComponent(a1 || 'sixfold'));
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    for (const p of d.posts) console.log([p.id, p.at ? fmt.format(new Date(p.at * 1000)) : 'unscheduled', p.openRequest ? 'changes' : p.status, p.type, p.targets.join('+'), p.problems.join(' ') || 'ready'].join(' | '));
  }
  else { console.log('usage: pc.mjs import <manifest.json> [--dry-run] | requests [client] | answer <post-id> [--image f] [--replace N] [--keep 1,3,2] [--card-bg photo|keep [--zoom Z --x X --y Y --dim D --card-out f]] [--card-orig] [--fb f] [--ig f] [--note text] | note <post-id> --note text | card <post-id> <recipe.card.json> [--keep-orig] | photos <post-id> [--out dir] | look <post-id> --card-bg f --card-out f'); process.exitCode = 1; }
} catch (e) { console.error(String(e.message || e)); process.exitCode = 1; }
