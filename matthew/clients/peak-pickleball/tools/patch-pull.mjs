// Peak Pickleball: Patch Retention pull, READ-ONLY (GET only, Peak's own API key in ~/.ssh/peak-patch.json, never printed).
// What the key can read (tested 13 and 23 Nov 2026): /v1/messages (every message sent or received, newest first, 1,000 a page with
// offset) and /v1/contacts (the 50 newest only; paging is ignored). Campaign, automation, segment and report endpoints do not exist
// for this key, and Patch's MCP connector needs a person to sign in (OAuth), so automation settings are rebuilt from the messages.
// Nightly: re-reads messages back to the start of the previous month (so opens and clicks recorded since are refreshed) and
// replaces those month files in the store. --full re-reads the whole history.
// Writes: data/pulls/store/patch/messages/<YYYY-MM>.json.gz (no names, no addresses, no message bodies),
//         data/pulls/store/patch/templates.json (one scrubbed copy of each email/text, personal words replaced by {var}),
//         data/pulls/<date>/patch/catalog.json + summary.json + contacts-aggregate.json.
// Usage: node patch-pull.mjs [--full] [--day=YYYY-MM-DD]
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cred, denverDate, getJson, writeGz, writeJson, readStore, PULLS, STORE } from './pull-lib.mjs';

const arg = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=')[1];
const full = process.argv.includes('--full');
const today = arg('day') || denverDate();
const c = cred('peak-patch.json');
const H = { Authorization: 'Bearer ' + c.secret };
const snapDir = join(PULLS, today, 'patch');
const cutoffMonth = (() => { const d = new Date(today.slice(0, 7) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit' });
const monthOf = (at) => fmt.format(new Date(at)).slice(0, 7);
const manifest = { system: 'patch', day: today, mode: full ? 'full' : 'nightly from ' + cutoffMonth, started: new Date().toISOString(), errors: [] };

// ---- scrubbing ------------------------------------------------------------------------------------------------------
// Links lose tracking strings first. Then two different people's copies are compared word by word: words that differ are
// personal and become {var}. Anything left that looks like an address or phone number is scrubbed unless it appeared in two
// people's copies (then it is Peak's own), and a greeting followed by a capitalised word becomes {first_name}.
const scrubLinks = (s) => String(s || '')
  .replace(/(https?:\/\/[^\s?#)\]]+)[?#][^\s)\]]*/g, '$1')
  .replace(/(https?:\/\/[^\s)\]]*\/)[A-Za-z0-9_-]{16,}/g, '$1{id}');
const scrubPersonal = (s) => s
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, (m) => (/@peakpickleball\./i.test(m) ? m : '{email}'))
  .replace(/\+?1?[\s.(-]*\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}\b/g, '{phone}');
const greet = (s) => s.replace(/\b(Hi|Hey|Hello|Dear|Happy [Bb]irthday|Congrats|Congratulations|Welcome),?\s+([A-Z][a-zA-Z'-]+)([,!.])/g, (m, g, n, p) => (/^(to|back|there|Peak)$/i.test(n) ? m : `${g} {first_name}${p}`));
function lcsTemplate(samples) {
  const toks = samples.map((s) => scrubLinks(s).split(/(\s+)/));
  if (toks.length < 2) return greet(scrubPersonal(toks[0]?.join('') ?? ''));
  const [a, b] = toks; if (a.length * b.length > 4e6) return greet(scrubPersonal(a.join('')));
  const L = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < a.length) {
    if (j < b.length && a[i] === b[j]) { out.push(a[i]); i++; j++; }
    else if (j < b.length && L[i][j + 1] >= L[i + 1][j]) j++;
    else { if (out[out.length - 1] !== '{var}') out.push('{var}'); i++; }
  }
  return greet(out.join('').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, (m) => (/@peakpickleball\./i.test(m) ? m : '{email}')));
}

// ---- 1. page through messages -----------------------------------------------------------------------------------
const byId = new Map(); const samples = new Map(); // block -> [{cid, subj, text}]
let pages = 0, oldest = null;
for (let offset = 0; ; offset += 1000) {
  const r = await getJson(`https://api.patchretention.com/v1/messages?limit=1000&offset=${offset}`, H, { pace: 350 });
  if (r.status !== 200 || !r.json) { manifest.errors.push(`${r.status} /v1/messages offset ${offset} ${String(r.text).slice(0, 120)}`); break; }
  const rows = Array.isArray(r.json) ? r.json : r.json.data || [];
  pages++;
  if (!rows.length) break;
  for (const m of rows) {
    const d = m.data || {};
    const blk = m.sequence_id ? m.sequence_id + '|' + m.block_id : null;
    if (m.event === 'message.out' && blk && d.content) {
      const s = samples.get(blk) || []; if (s.length < 3 && !s.some((x) => x.cid === m.contact_id)) s.push({ cid: m.contact_id, subj: d.content.subject || '', text: d.content.text || '', ch: d.channel });
      samples.set(blk, s);
    }
    byId.set(m.id || m._id, m.event === 'message.out'
      ? { id: m.id || m._id, at: m.at, ev: m.event, seq: m.sequence_id || null, blk: m.block_id || null, task: m.task_id || null, cls: d.sequence_class || null, ch: d.channel || null, cat: d.email_category || null, cid: m.contact_id, subj: d.content?.subject ?? null, stats: m.stats || {} }
      : { id: m.id || m._id, at: m.at, ev: m.event, cid: m.contact_id, ch: d.channel || null }); // replies: no content kept
  }
  oldest = rows[rows.length - 1].at;
  if (!full && monthOf(oldest) < cutoffMonth) break;
  if (pages % 50 === 0) console.log('patch pages', pages, 'at', oldest);
}
manifest.pages = pages; manifest.oldestRead = oldest; manifest.rowsRead = byId.size;
console.log('patch read', byId.size, 'rows in', pages, 'pages; oldest', oldest);

// subject: keep it only where it is the block's usual subject (a subject that varies by person may hold a first name)
const subjCount = new Map();
for (const m of byId.values()) if (m.blk && m.subj != null) { const k = m.seq + '|' + m.blk; const s = subjCount.get(k) || new Map(); s.set(m.subj, (s.get(m.subj) || 0) + 1); subjCount.set(k, s); }
const modal = new Map([...subjCount].map(([k, s]) => [k, [...s].sort((a, b) => b[1] - a[1])[0][0]]));
for (const m of byId.values()) if (m.blk && m.subj != null && m.subj !== modal.get(m.seq + '|' + m.blk)) { m.subj = null; m.subjVaried = true; }

// ---- 2. write month files (only months this run read completely) ---------------------------------------------------------
if (!manifest.errors.length) {
  const byMonth = new Map();
  for (const m of byId.values()) { const k = monthOf(m.at); if (!full && k < cutoffMonth) continue; (byMonth.get(k) || byMonth.set(k, []).get(k)).push(m); }
  for (const [k, rows] of byMonth) writeGz(join(STORE, 'patch', 'messages', k + '.json.gz'), rows.sort((a, b) => (a.at < b.at ? -1 : 1)));
  manifest.monthsWritten = [...byMonth.keys()].sort();
}

// templates: merge with the stored set so automations that did not send this month keep their copy
const tplPath = join(STORE, 'patch', 'templates.json');
const templates = existsSync(tplPath) ? JSON.parse(readFileSync(tplPath, 'utf8')) : {};
for (const [k, s] of samples) {
  if (templates[k] && templates[k].samples >= s.length && templates[k].samples >= 2) continue;
  templates[k] = { channel: s[0].ch, subject: lcsTemplate(s.map((x) => x.subj)), body: lcsTemplate(s.map((x) => x.text)), samples: s.length, seenAt: today };
}
writeJson(tplPath, templates);

// block names: Patch drops message content after a few weeks, so each block's usual subject is kept once seen
// (seeded on 23 Nov 2026 from the 13 Nov pull, data/patch-2026-11-13/messages-slim.json)
const namesPath = join(STORE, 'patch', 'block-names.json');
const names = existsSync(namesPath) ? JSON.parse(readFileSync(namesPath, 'utf8')) : {};
const seed = join(PULLS, '..', 'patch-2026-11-13', 'messages-slim.json');
if (!Object.keys(names).length && existsSync(seed)) {
  const cnt = {}; for (const x of JSON.parse(readFileSync(seed, 'utf8'))) if (x.blk && x.subj) { const k = x.seq + '|' + x.blk; (cnt[k] ||= {})[x.subj] = (cnt[k][x.subj] || 0) + 1; }
  for (const [k, v] of Object.entries(cnt)) { const top = Object.entries(v).sort((a, b) => b[1] - a[1])[0]; if (top[1] / Object.values(v).reduce((a, c) => a + c, 0) >= 0.9) names[k] = { subject: top[0], source: '13 Nov pull' }; }
}
for (const [k, subj] of modal) if (subj && !names[k]) names[k] = { subject: subj, source: 'pull ' + today };
writeJson(namesPath, names);

// ---- 3. catalog of every sequence/block over the whole store ------------------------------------------------------------
const all = readStore('patch/messages');
const cat = new Map();
for (const m of all) {
  if (m.ev !== 'message.out') continue;
  const k = (m.seq || 'none') + '|' + (m.blk || 'none');
  const e = cat.get(k) || { seq: m.seq, blk: m.blk, cls: m.cls, ch: m.ch, subject: null, first: m.at, last: m.at, sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, unsubscribed: 0, bounced: 0, dropped: 0, complained: 0, byMonth: {} };
  e.sent++; for (const s of ['delivered', 'opened', 'clicked', 'converted', 'unsubscribed', 'bounced', 'dropped', 'complained']) if (m.stats?.[s]) e[s]++;
  if (m.at < e.first) e.first = m.at; if (m.at > e.last) e.last = m.at;
  if (m.subj && !e.subject) e.subject = m.subj; const mo = monthOf(m.at); e.byMonth[mo] = (e.byMonth[mo] || 0) + 1;
  cat.set(k, e);
}
const catalog = [...cat.entries()].map(([k, e]) => ({ ...e, subject: e.subject || names[k]?.subject || null, template: templates[k] || null })).sort((a, b) => b.sent - a.sent);
writeJson(join(snapDir, 'catalog.json'), catalog);
const summary = { day: today, storeRows: all.length, out: all.filter((m) => m.ev === 'message.out').length, in: all.filter((m) => m.ev === 'message.in').length, byMonth: {} };
for (const m of all) { const mo = monthOf(m.at); const s = (summary.byMonth[mo] ||= { email: 0, sms: 0, automation: 0, campaign: 0, replies: 0 }); if (m.ev === 'message.in') s.replies++; else { if (m.ch === 'SMS') s.sms++; else s.email++; if (m.cls === 'AUTOMATION') s.automation++; if (m.cls === 'CAMPAIGN') s.campaign++; } }
writeJson(join(snapDir, 'summary.json'), summary);

// ---- 4. contacts: the API gives only the 50 newest, so keep counts only ------------------------------------------------
{
  const r = await getJson('https://api.patchretention.com/v1/contacts', H, { pace: 350 });
  if (r.status !== 200 || !r.json) manifest.errors.push(`${r.status} /v1/contacts`);
  else {
    const rows = Array.isArray(r.json) ? r.json : r.json.data || [];
    const count = (f) => rows.filter(f).length;
    writeJson(join(snapDir, 'contacts-aggregate.json'), { note: 'the 50 newest contacts only: the API ignores paging', n: rows.length, newest: rows[0]?.created_at, oldest: rows[rows.length - 1]?.created_at, smsOn: count((x) => x.sms_on), emailOn: count((x) => x.email_on), byChannel: rows.reduce((a, x) => ((a[x.channel] = (a[x.channel] || 0) + 1), a), {}), byMembershipStatus: rows.reduce((a, x) => ((a[x.membership_status] = (a[x.membership_status] || 0) + 1), a), {}) });
  }
}
manifest.catalogBlocks = catalog.length; manifest.finished = new Date().toISOString();
writeJson(join(snapDir, 'manifest.json'), manifest);
console.log('patch done; blocks', catalog.length, 'store rows', all.length, 'errors', manifest.errors.length);
if (manifest.errors.length) { for (const e of manifest.errors) console.error('  !', e); process.exit(1); }
