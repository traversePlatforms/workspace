// Peak Pickleball: Google Business Profile pull (25 Nov 2026). READ-ONLY. The Google sign-in lives on the server (J.A.R.V.I.S., Traverse
// account, business.manage), so this runs assistant-private/gbp-fetch.php there over ssh (sg.sh trav) and keeps the store here.
// Kept: daily profile views (Search/Maps, mobile/desktop), calls, website clicks, direction requests, messages, bookings; reviews as
// stars, dates and replied yes/no (no reviewer names, no review text); monthly search terms. No token ever reaches this machine.
// Writes data/pulls/<date>/gbp/snapshot.json and data/pulls/store/gbp/<series>/YYYY-MM.json.gz (all gitignored).
// First run backfills (daily 540 days, every review, 12 months of search terms); later runs re-read the last 10 days (Google's numbers
// arrive a few days late), the newest 100 reviews and the last 2 finished months of search terms.
// Usage: node gbp-pull.mjs [--backfill]
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readStore, writeGz, writeJson, STORE, PULLS, denverDate, addDays } from './pull-lib.mjs';

const today = denverDate();
const first = readStore('gbp/daily').length === 0 || process.argv.includes('--backfill');
const from = addDays(today, first ? -540 : -10), to = addDays(today, -1);
const args = `${from} ${to} --reviews=${first ? 'all' : 'recent'} --keywords=${first ? 12 : 2}`;

let d;
try {
  const out = execFileSync('bash', [join(homedir(), 'jarvis', 'bin', 'sg.sh'), 'trav', `php ~/www/traverseplatforms.com/assistant-private/gbp-fetch.php ${args}`], { encoding: 'utf8', timeout: 300000, maxBuffer: 64 << 20 });
  d = JSON.parse(out.trim().split('\n').pop());
} catch (e) { console.error('gbp: fetch failed: ' + String(e.message).slice(0, 200)); process.exit(1); }
if (!d.ok) { console.error('gbp: ' + (d.error || JSON.stringify(d.errors))); process.exit(1); }

function upsert(series, rows, keyOf, dateOf) {
  const old = readStore('gbp/' + series), m = new Map(old.map((r) => [keyOf(r), r]));
  for (const r of rows) m.set(keyOf(r), { ...(m.get(keyOf(r)) || {}), ...r });
  const by = {};
  for (const r of m.values()) (by[dateOf(r).slice(0, 7)] ||= []).push(r);
  for (const [mo, xs] of Object.entries(by)) writeGz(join(STORE, 'gbp', series, mo + '.json.gz'), xs.sort((a, b) => keyOf(a).localeCompare(keyOf(b))));
  return m.size;
}
// short names for the daily metrics
const N = { BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 'views_desktop_maps', BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 'views_desktop_search', BUSINESS_IMPRESSIONS_MOBILE_MAPS: 'views_mobile_maps',
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 'views_mobile_search', CALL_CLICKS: 'calls', WEBSITE_CLICKS: 'website_clicks', BUSINESS_DIRECTION_REQUESTS: 'directions',
  BUSINESS_CONVERSATIONS: 'messages', BUSINESS_BOOKINGS: 'bookings' };
const daily = d.daily.map((r) => { const o = { date: r.date }; for (const [k, v] of Object.entries(r)) if (N[k]) o[N[k]] = v;
  o.views = (o.views_desktop_maps || 0) + (o.views_desktop_search || 0) + (o.views_mobile_maps || 0) + (o.views_mobile_search || 0); o.fetched = today; return o; });
const nd = upsert('daily', daily, (r) => r.date, (r) => r.date);
const nr = upsert('reviews', d.reviews.list.map((r) => ({ ...r, fetched: today })), (r) => r.id, (r) => r.date);
const nk = upsert('keywords', d.keywords.map((k) => ({ ...k, fetched: today })), (r) => r.month + '|' + r.keyword, (r) => r.month + '-01');

// snapshot: the totals the weekly report reads first
const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
const all = readStore('gbp/daily'), last28 = all.filter((r) => r.date > addDays(to, -28) && r.date <= to);
const revs = readStore('gbp/reviews');
const snap = { day: today, first, range: [from, to], reviews: { total: d.reviews.total, average: d.reviews.average, stored: revs.length,
    unreplied_last_100: d.reviews.list.slice(0, 100).filter((r) => !r.replied).length, newest: d.reviews.list[0] && d.reviews.list[0].date },
  last_28_days: Object.fromEntries(['views', 'calls', 'website_clicks', 'directions', 'messages', 'bookings'].map((k) => [k, sum(last28, k)])), errors: d.errors };
writeJson(join(PULLS, today, 'gbp', 'snapshot.json'), snap);
console.log(`gbp ok days ${nd} reviews ${nr} keywords ${nk} total_reviews ${d.reviews.total} avg ${d.reviews.average}` + (d.errors.length ? ' partial: ' + d.errors.join('; ') : ''));
