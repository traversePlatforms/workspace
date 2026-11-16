#!/usr/bin/env node
/* What Jen changes in the Sixfold posts Claude drafts (16 Nov 2026, Matthew: "learn from her edits and her vibe and what shes looking for so
 * going forward each month its more leaning towards what she wants"). Run before drafting each month; the findings go into
 * sixfold/content/jen-style.md, which the monthly drafts and the request helper (request-answer-prompt.md) follow.
 *   node traverse/post-calendar/tools/jen-learn.mjs baseline   record every Sixfold draft not yet in loaded.jsonl as handed over (as it is now)
 *   node traverse/post-calendar/tools/jen-learn.mjs report     for each post handed over: what changed before it went (or now), who did it,
 *                                                              her change requests, removed posts, moved dates, approved untouched
 * Signs in with the EDITOR code (read only here). Prints captions, never codes. */
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const LOADED = process.env.PC_LOADED || join(dirname(fileURLToPath(import.meta.url)), '..', 'loaded.jsonl');
const BASE = process.env.PC_BASE || 'https://traverseplatforms.com/posts-ab8c57/api/cal.php';
const CODE_FILE = process.env.PC_CODE_FILE || join(homedir(), '.ssh', 'post-calendar-editor-code.txt');
let cookie = '';
async function call(action, body, q = '') {
  const o = { method: body ? 'POST' : 'GET', headers: { Cookie: cookie } };
  if (body) { o.body = JSON.stringify(body); o.headers['Content-Type'] = 'application/json'; o.headers['X-PC'] = '1'; }
  const r = await fetch(BASE + '?action=' + action + q, o); const sc = r.headers.get('set-cookie'); if (sc && /postcal=/.test(sc)) cookie = sc.split(';')[0];
  const j = await r.json(); if (!j.ok) throw new Error(action + ': ' + (j.error || 'failed')); return j;
}
await call('signin', { code: readFileSync(CODE_FILE, 'utf8').replace(/\D/g, '') });
const posts = (await call('data', null, '&client=sixfold')).posts;
const seen = existsSync(LOADED) ? readFileSync(LOADED, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const byId = new Map(seen.map((s) => [s.id, s]));
const pics = (p) => p.images.map((i) => i.name || i.file);
const day = (t) => t ? new Date(t * 1000).toLocaleDateString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric' }) : 'unscheduled';
const cmd = process.argv[2];
if (cmd === 'baseline') {
  let n = 0;
  for (const p of posts) if (!byId.has(p.id) && p.status === 'draft') { appendFileSync(LOADED, JSON.stringify({ id: p.id, client: 'sixfold', at: p.at, type: p.type, fb: p.fb, ig: p.ig, pics: pics(p), note: p.note, loaded: new Date().toISOString(), baseline: true }) + '\n'); n++; }
  console.log('baseline: ' + n + ' Sixfold drafts recorded as handed over');
} else if (cmd === 'report') {
  for (const s of seen) {
    const p = posts.find((x) => x.id === s.id);
    if (!p) { console.log(`\n## ${s.id}: REMOVED (was ${day(s.at)}): ${String(s.fb).slice(0, 80)}`); continue; }
    const who = [...new Set((p.log || []).filter((l) => l.at > Date.parse(s.loaded) / 1000 && !/^(runner|Claude)/.test(l.by)).map((l) => l.by))];
    const out = [];
    if (p.fb !== s.fb) out.push('Facebook caption:\n  was: ' + s.fb.replace(/\n+/g, ' / ') + '\n  now: ' + p.fb.replace(/\n+/g, ' / '));
    if (p.ig !== s.ig) out.push('Instagram caption:\n  was: ' + s.ig.replace(/\n+/g, ' / ') + '\n  now: ' + p.ig.replace(/\n+/g, ' / '));
    if (JSON.stringify(pics(p)) !== JSON.stringify(s.pics)) out.push('pictures: ' + s.pics.length + ' -> ' + p.images.length + ' (' + pics(p).join(', ') + ')');
    if (s.at && p.at !== s.at) out.push('moved: ' + day(s.at) + ' -> ' + day(p.at));
    for (const r of p.requests || []) out.push('request by ' + r.by + ': "' + r.text + '"');
    const head = `\n## ${p.id} ${day(p.at)} ${p.type} [${p.status}${p.approval ? ', approved by ' + p.approval.by : ''}]` + (who.length ? ' touched by: ' + who.join(', ') : '');
    console.log(head + '\n' + (out.length ? out.join('\n') : (p.status === 'published' || p.approval ? 'approved as handed over' : 'not reviewed yet')));
  }
} else { console.log('usage: jen-learn.mjs baseline | report'); process.exitCode = 1; }
