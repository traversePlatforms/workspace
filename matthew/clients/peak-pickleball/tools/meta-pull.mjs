// Peak Pickleball: Facebook / Instagram / Meta ads pull (23 Nov 2026). READ-ONLY: GET requests to graph.facebook.com only (pull-lib getJson).
// Token: ~/.ssh/traverse-meta-token.txt (system user "Traverse Claude"), read here and sent as a Bearer header; page tokens come from /me/accounts
// at run time and live in memory only. Nothing about a token is ever printed, logged or written. Peak only: Peak's Page, its Instagram account
// and its two ad accounts. No personal data: counts only (no commenter or reactor names, no comment or message text from the public).
// Writes data/pulls/<date>/meta/snapshot.json and the store data/pulls/store/meta/<series>/YYYY-MM.json.gz (all gitignored).
// First run backfills (Page insights 90 days, Instagram 28, ads from 2025-01-01); later runs re-read the last 2 days (ads: last 7).
// Usage: node meta-pull.mjs [--backfill]
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getJson, readStore, writeGz, writeJson, STORE, PULLS, denverDate, addDays } from './pull-lib.mjs';

const V = 'https://graph.facebook.com/v21.0/';
const PAGE_ID = '299821419887153';
const ADS = [['act_1188880533429803', 'Peak Pickleball'], ['act_3855284241380919', 'Social DFY']];
const TOKEN = readFileSync(join(homedir(), '.ssh', 'traverse-meta-token.txt'), 'utf8').trim();
const today = denverDate();
const rejected = new Set(), problems = [];

async function g(path, q = {}, tok = TOKEN) {
  const u = new URL(V + path); for (const [k, v] of Object.entries(q)) if (v != null) u.searchParams.set(k, v);
  const r = await getJson(u.toString(), { Authorization: 'Bearer ' + tok }, { pace: 250 });
  if (r.status !== 200 || !r.json || r.json.error) return { error: (r.json && r.json.error && `${r.json.error.code} ${String(r.json.error.message).slice(0, 120)}`) || `http ${r.status}` };
  return r.json;
}
async function paged(path, q, tok, max = 4) { // follow paging.next a few pages (GET only)
  const out = []; let r = await g(path, q, tok);
  for (let i = 0; i < max && r && !r.error; i++) {
    out.push(...(r.data || []));
    const nx = r.paging && r.paging.next; if (!nx) break;
    const u = new URL(nx); u.searchParams.delete('access_token');
    const x = await getJson(u.toString(), { Authorization: 'Bearer ' + tok }, { pace: 250 }); r = x.json && !x.json.error ? x.json : null;
  }
  return r && r.error ? { error: r.error } : out;
}
// Meta's daily values carry the END of the (Pacific) day in end_time: the day is end_time minus 24 hours.
const dayOf = (end) => new Date(Date.parse(end) - 864e5).toISOString().slice(0, 10);
const num = (v) => (v == null || v === '' ? null : Number(v));

// ---- store: month files of rows, upserted by key ----------------------------------------------------------------------------------------
function upsert(series, rows, keyOf, dateOf) {
  const old = readStore('meta/' + series), m = new Map(old.map((r) => [keyOf(r), r]));
  for (const r of rows) m.set(keyOf(r), { ...(m.get(keyOf(r)) || {}), ...r });
  const by = {};
  for (const r of m.values()) (by[dateOf(r).slice(0, 7)] ||= []).push(r);
  for (const [mo, xs] of Object.entries(by)) writeGz(join(STORE, 'meta', series, mo + '.json.gz'), xs.sort((a, b) => keyOf(a).localeCompare(keyOf(b))));
  return m.size;
}
const first = readStore('meta/page-daily').length === 0 || process.argv.includes('--backfill');

// ---- 0. page token (memory only) ---------------------------------------------------------------------------------------------------------
const acc = await g('me/accounts', { fields: 'id,name,access_token,instagram_business_account', limit: 50 });
const pg = acc.data && acc.data.find((a) => a.id === PAGE_ID);
if (!pg) { console.error('meta: Peak Page not reachable with this token: ' + JSON.stringify(acc.error || 'not in /me/accounts')); process.exit(1); }
const PT = pg.access_token, IG = pg.instagram_business_account && pg.instagram_business_account.id;
const snap = { day: today, first, page: {}, ig: {}, ads: {}, rejected: [] };

// ---- 1. Page followers + insights ----------------------------------------------------------------------------------------------------------
const pf = await g(PAGE_ID, { fields: 'followers_count,fan_count' }, PT);
if (pf.error) problems.push('page followers ' + pf.error); else snap.page = { followers: pf.followers_count, fans: pf.fan_count };
const pageDaily = {}; // date -> { metric: value }
const since = addDays(today, first ? -90 : -2), until = addDays(today, 1);
const PAGE_METRICS = ['page_follows', 'page_daily_follows', 'page_daily_follows_unique', 'page_daily_unfollows_unique', 'page_post_engagements', 'page_views_total', 'page_media_view', 'page_total_media_view_unique', 'page_impressions_unique', 'page_impressions', 'page_fan_adds'];
for (const m of PAGE_METRICS) {
  const r = await g(PAGE_ID + '/insights', { metric: m, period: 'day', since, until }, PT);
  if (r.error || !r.data || !r.data[0]) { rejected.add('page:' + m); continue; }
  for (const v of r.data[0].values) if (v.end_time && typeof v.value === 'number') (pageDaily[dayOf(v.end_time)] ||= {})[m] = v.value;
}
upsert('page-daily', Object.entries(pageDaily).map(([date, o]) => ({ date, ...o })), (r) => r.date, (r) => r.date);

// ---- 2. Page posts, last 30 days (counts only) ----------------------------------------------------------------------------------------------
const posts = await paged(PAGE_ID + '/posts', { fields: 'id,created_time,status_type,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),message,insights.metric(post_total_media_view_unique,post_media_view,post_clicks)', since: addDays(today, -30), limit: 25 }, PT);
let postRows = [];
if (posts.error) problems.push('posts ' + JSON.stringify(posts.error)); else {
  postRows = posts.map((p) => {
    const ins = Object.fromEntries(((p.insights && p.insights.data) || []).map((i) => [i.name, i.values && i.values[0] && i.values[0].value]));
    return { id: p.id, date: p.created_time.slice(0, 10), created: p.created_time, type: p.status_type || null, text: (p.message || '').replace(/\s+/g, ' ').slice(0, 80), reach: num(ins.post_total_media_view_unique), views: num(ins.post_media_view), clicks: num(ins.post_clicks), reactions: p.reactions ? p.reactions.summary.total_count : null, comments: p.comments ? p.comments.summary.total_count : null, shares: p.shares ? p.shares.count : 0, fetched: today };
  });
  upsert('posts', postRows, (r) => r.id, (r) => r.date);
}
snap.page.posts30d = postRows.length;

// ---- 3. Instagram -------------------------------------------------------------------------------------------------------------------------
const igDaily = {}; let igRows = [];
if (IG) {
  const ia = await g(IG, { fields: 'followers_count,media_count' }, PT);
  if (ia.error) problems.push('ig account ' + ia.error); else snap.ig = { followers: ia.followers_count, media: ia.media_count };
  const days = first ? 28 : 2;
  for (const m of ['reach', 'follower_count']) { // time series (follower_count = net new followers that day)
    const r = await g(IG + '/insights', { metric: m, period: 'day', since: addDays(today, -days), until: addDays(today, 1) }, PT);
    if (r.error || !r.data || !r.data[0]) { rejected.add('ig:' + m); continue; }
    for (const v of r.data[0].values) if (v.end_time) (igDaily[dayOf(v.end_time)] ||= {})[m] = v.value;
  }
  for (let i = days; i >= 1; i--) { // one-day totals for the rest
    const d = addDays(today, -i), r = await g(IG + '/insights', { metric: 'profile_views,accounts_engaged,views,total_interactions', metric_type: 'total_value', period: 'day', since: d, until: addDays(d, 1) }, PT);
    if (r.error || !r.data) { rejected.add('ig:totals ' + r.error); continue; }
    for (const x of r.data) (igDaily[d] ||= {})[x.name] = x.total_value && x.total_value.value;
  }
  upsert('ig-daily', Object.entries(igDaily).map(([date, o]) => ({ date, ...o })), (r) => r.date, (r) => r.date);
  const media = await paged(IG + '/media', { fields: 'id,timestamp,media_type,like_count,comments_count,insights.metric(reach)', limit: 30 }, PT, 2);
  if (media.error) problems.push('ig media ' + JSON.stringify(media.error)); else {
    igRows = media.filter((x) => x.timestamp.slice(0, 10) >= addDays(today, -30)).map((x) => ({ id: x.id, date: x.timestamp.slice(0, 10), created: x.timestamp, type: x.media_type, likes: x.like_count ?? null, comments: x.comments_count ?? null, reach: num(x.insights && x.insights.data && x.insights.data[0] && x.insights.data[0].values[0].value), fetched: today }));
    upsert('ig-media', igRows, (r) => r.id, (r) => r.date);
  }
  snap.ig.media30d = igRows.length;
}
// one follower line per pull day (the number as of the pull)
upsert('followers', [{ date: today, pageFollowers: snap.page.followers ?? null, pageFans: snap.page.fans ?? null, igFollowers: snap.ig.followers ?? null, igMedia: snap.ig.media ?? null }], (r) => r.date, (r) => r.date);

// ---- 4. Ads (Peak's two ad accounts): per-day rows + campaign list ------------------------------------------------------------------------
const adRows = [], camps = [];
for (const [id, name] of ADS) {
  const from = first ? '2025-01-01' : addDays(today, -7);
  for (let a = from; a <= today; a = addDays(a, 90)) { // 90-day windows keep each answer small
    const b = addDays(a, 89) < today ? addDays(a, 89) : today;
    const r = await paged(id + '/insights', { fields: 'spend,impressions,reach,clicks,ctr,actions', time_increment: 1, time_range: JSON.stringify({ since: a, until: b }), limit: 100 }, TOKEN);
    if (r.error) { problems.push(`ads ${id} ` + JSON.stringify(r.error)); continue; }
    for (const x of r) adRows.push({ key: id + ':' + x.date_start, date: x.date_start, account: id, accountName: name, spend: num(x.spend), impressions: num(x.impressions), reach: num(x.reach), clicks: num(x.clicks), ctr: num(x.ctr), actions: Object.fromEntries((x.actions || []).map((y) => [y.action_type, Number(y.value)])) });
  }
  const cs = await paged(id + '/campaigns', { fields: 'id,name,effective_status,daily_budget,lifetime_budget,start_time,stop_time', limit: 100 }, TOKEN);
  if (cs.error) problems.push(`campaigns ${id} ` + JSON.stringify(cs.error)); else for (const c of cs) camps.push({ account: id, accountName: name, id: c.id, name: c.name, status: c.effective_status, dailyBudget: c.daily_budget ? Number(c.daily_budget) / 100 : null, lifetimeBudget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null, start: c.start_time || null, stop: c.stop_time || null });
  const lt = await g(id, { fields: 'amount_spent' }); if (!lt.error) (snap.ads[id] ||= { name }).lifetimeSpend = Number(lt.amount_spent) / 100;
}
if (adRows.length) upsert('ads-daily', adRows, (r) => r.key, (r) => r.date);
writeGz(join(STORE, 'meta', 'campaigns.json.gz'), camps); // replaced whole each night: the current list
snap.campaigns = camps; snap.adDaysRead = adRows.length;
snap.rejected = [...rejected].sort(); snap.problems = problems;
writeJson(join(PULLS, today, 'meta', 'snapshot.json'), snap);
console.log(`meta ok day=${today} page=${snap.page.followers} ig=${snap.ig.followers} posts=${postRows.length} igmedia=${igRows.length} ad_days=${adRows.length} campaigns=${camps.length} rejected=[${snap.rejected.join(',')}] problems=${problems.length}`);
if (problems.length) { console.error('meta problems: ' + problems.join(' | ')); process.exit(1); }
