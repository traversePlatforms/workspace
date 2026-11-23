#!/usr/bin/env node
// Sixfold 365 and Traverse Platforms: Facebook / Instagram follower counts, 7-day reach, and Sixfold's ad spend and leads (23 Nov 2026).
// READ-ONLY: GET requests to graph.facebook.com v21.0 only. Token ~/.ssh/traverse-meta-token.txt (system user "Traverse Claude"), read here and
// kept in memory; page tokens come from /me/accounts at run time. Nothing about a token is printed or written. Counts only: no names, no message text.
// Peak's numbers are NOT here (they live in matthew/clients/peak-pickleball/tools/meta-pull.mjs and Peak's data folder). Sixfold's lead-ads
// pipeline (traverse/app/tools/meta-leads.php) is not touched or read.
// Usage: node meta-social-snapshot.mjs [--end=YYYY-MM-DD]   (a Sunday is the usual end; default today, Colorado time)
//   Writes ~/jarvis/localappdata/ProjectBackup/meta/<end>.json and prints the same JSON. "this" = the 7 days ending --end, "last" = the 7 days before.
//   Followers at the end of a day: today's count, or for an earlier day Meta's daily page_follows (Page) / today's Instagram count less the net
//   new followers since (Instagram, Meta keeps 30 days of that). Reach = Meta's daily unique viewers added up (a person on two days counts twice).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const V = 'https://graph.facebook.com/v21.0/';
const TOKEN = readFileSync(join(homedir(), '.ssh', 'traverse-meta-token.txt'), 'utf8').trim();
const ASSETS = { sixfold: { page: '1418675127985724', ads: 'act_1388044742769528' }, traverse: { page: '1405686169302553', ads: null } };
const denver = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const add = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const today = denver();
const endArg = (process.argv.find((a) => a.startsWith('--end=')) || '').split('=')[1];
const END = endArg || today;
if (!/^\d{4}-\d\d-\d\d$/.test(END)) { console.error('--end=YYYY-MM-DD'); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dayOf = (end) => new Date(Date.parse(end) - 864e5).toISOString().slice(0, 10); // Meta's end_time is the end of the Pacific day

async function g(path, q = {}, tok = TOKEN) { // GET only; never echoes the URL or a token
  const u = new URL(V + path); for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  for (let i = 0; i < 3; i++) {
    await sleep(250);
    try {
      const r = await fetch(u, { method: 'GET', headers: { Authorization: 'Bearer ' + tok, Accept: 'application/json' } });
      const j = await r.json().catch(() => null);
      if (r.status === 429 || r.status >= 500) { await sleep(3000 * (i + 1)); continue; }
      if (!r.ok || !j || j.error) return { error: j && j.error ? `${j.error.code} ${String(j.error.message).slice(0, 100)}` : 'http ' + r.status };
      return j;
    } catch { await sleep(3000 * (i + 1)); }
  }
  return { error: 'no answer' };
}
const series = async (id, metric, since, until, tok) => { // { 'YYYY-MM-DD': value } or null when Meta refuses the metric
  const r = await g(id + '/insights', { metric, period: 'day', since, until }, tok);
  if (r.error || !r.data || !r.data[0]) return null;
  const o = {}; for (const v of r.data[0].values) if (v.end_time && typeof v.value === 'number') o[dayOf(v.end_time)] = v.value; return o;
};
const total = (o, a, b) => { if (!o) return null; let s = 0; for (let d = a; d <= b; d = add(d, 1)) s += o[d] || 0; return s; };

const acc = await g('me/accounts', { fields: 'id,name,access_token,instagram_business_account', limit: 50 });
if (acc.error || !acc.data) { console.error('meta-social: /me/accounts failed: ' + JSON.stringify(acc.error)); process.exit(1); }
const out = { end: END, savedAt: new Date().toISOString(), note: 'counts only; followers as of the end day, reach = sum of daily unique viewers, ads over the 7 days', sixfold: {}, traverse: {}, problems: [] };
const win = (end) => ({ from: add(end, -6), to: end });
const W = { this: win(END), last: win(add(END, -7)) };

for (const [ent, a] of Object.entries(ASSETS)) {
  const pg = acc.data.find((x) => x.id === a.page);
  if (!pg) { out.problems.push(`${ent}: Page not reachable`); continue; }
  const PT = pg.access_token, IG = pg.instagram_business_account && pg.instagram_business_account.id;
  const since = add(END, -30), until = add(today, 1);
  const pf = await g(a.page, { fields: 'followers_count' }, PT);
  const fol = await series(a.page, 'page_follows', since, until, PT);
  const reach = await series(a.page, 'page_total_media_view_unique', since, until, PT);
  const fbAt = (d) => (d >= today ? (pf.error ? null : pf.followers_count) : fol && fol[d] != null ? fol[d] : null);
  let igNow = null, igDelta = null, igReach = null;
  if (IG) {
    const ia = await g(IG, { fields: 'followers_count' }, PT); igNow = ia.error ? null : ia.followers_count;
    igDelta = await series(IG, 'follower_count', add(today, -29), until, PT);
    igReach = await series(IG, 'reach', add(today, -29), until, PT);
  }
  const igAt = (d) => { if (igNow == null || d > today) return null; if (d >= today) return igNow; if (!igDelta || d < add(today, -28)) return null; let v = igNow; for (let x = add(d, 1); x <= today; x = add(x, 1)) v -= igDelta[x] || 0; return v; };
  const one = (w) => ({ window: w, pageFollowers: fbAt(w.to), pageReach7d: total(reach, w.from, w.to), igFollowers: IG ? igAt(w.to) : null, igReach7d: IG ? total(igReach, w.from, w.to) : null });
  out[ent] = { page: a.page, hasInstagram: !!IG, this: one(W.this), last: one(W.last) };
  if (a.ads) { // Sixfold's ad account: spend and leads over each 7 days (counts and dollars only)
    for (const k of ['this', 'last']) {
      const r = await g(a.ads + '/insights', { fields: 'spend,impressions,clicks,actions', time_range: JSON.stringify({ since: W[k].from, until: W[k].to }) });
      if (r.error) { out.problems.push(`${ent} ads ${k}: ${r.error}`); out[ent][k].adSpend = null; continue; }
      const x = (r.data && r.data[0]) || {}, act = Object.fromEntries((x.actions || []).map((y) => [y.action_type, Number(y.value)]));
      out[ent][k].adSpend = x.spend ? Number(x.spend) : 0;
      out[ent][k].adLeads = (act.lead || 0) + (act['onsite_conversion.lead_grouped'] || 0);
      out[ent][k].adLinkClicks = act.link_click || 0;
    }
  }
}
const dir = join(process.env.JARVIS_LOCALAPPDATA || join(homedir(), 'jarvis', 'localappdata'), 'ProjectBackup', 'meta');
mkdirSync(dir, { recursive: true });
// Instagram keeps no follower history for accounts under 100 followers: last week's count then comes from last week's own saved file
try {
  const prev = JSON.parse(readFileSync(join(dir, add(END, -7) + '.json'), 'utf8'));
  for (const ent of Object.keys(ASSETS)) if (out[ent].last && out[ent].last.igFollowers == null && prev[ent] && prev[ent].this && prev[ent].this.igFollowers != null) out[ent].last.igFollowers = prev[ent].this.igFollowers;
} catch {}
writeFileSync(join(dir, END + '.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
if (out.problems.length) console.error('meta-social problems: ' + out.problems.join(' | '));
