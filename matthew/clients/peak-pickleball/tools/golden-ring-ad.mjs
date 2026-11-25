// Golden Ring 2027 Meta ad: proof of concept tracking (25 Nov 2026, Matthew: "track the metrics for this facebook ad ... measure clicks and
// if we can connect that to who registers ... proof of concept with the ad to justify costs for ads going forward").
// READ ONLY. Every night:
//  1. Meta (GET only, Traverse token): the campaign's day rows since launch: spend, impressions, reach, link clicks, landing page views,
//     plus where it showed (state breakdown, to prove it stayed in Colorado).
//  2. pickleballtournaments.com (public page): the tournament's registered-player count and current entry fee.
// Registrations happen on pickleballtournaments.com, which we can't tag, so this measures timing (registrations before vs after the ad),
// not who clicked. The baseline is 4 players on 25 Nov 2026, before the ad first showed.
// Writes data/pulls/store/goldenring/daily.json (one row per day, upserted) and prints a one-line summary. Usage: node golden-ring-ad.mjs
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getJson, writeJson, STORE, denverDate } from './pull-lib.mjs';

const CAMPAIGN = '120252464355050751', LAUNCH = '2026-11-25';
const PT_URL = 'https://pickleballtournaments.com/tournaments/peak-pickleball-golden-ring-championship-2027';
const TOKEN = readFileSync(join(homedir(), '.ssh', 'traverse-meta-token.txt'), 'utf8').trim();
const FILE = join(STORE, 'goldenring', 'daily.json');
const today = denverDate();
const rows = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : [];
const byDay = new Map(rows.map((r) => [r.date, r]));
const num = (v) => (v == null || v === '' ? 0 : Number(v));
const act = (a, k) => num(((a || []).find((x) => x.action_type === k) || {}).value);

async function meta(path, q) {
  const u = new URL('https://graph.facebook.com/v21.0/' + path); for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  const r = await getJson(u.toString(), { Authorization: 'Bearer ' + TOKEN }, { pace: 300 });
  if (r.status !== 200 || !r.json || r.json.error) throw new Error('meta ' + path + ': ' + ((r.json && r.json.error && r.json.error.message) || r.status));
  return r.json;
}
// 1. day rows since launch
const d = await meta(CAMPAIGN + '/insights', { fields: 'spend,impressions,reach,frequency,inline_link_clicks,actions,ctr,cpc', time_increment: 1, time_range: JSON.stringify({ since: LAUNCH, until: today }), limit: 200 });
for (const x of d.data || []) {
  const o = byDay.get(x.date_start) || { date: x.date_start };
  Object.assign(o, { spend: num(x.spend), impressions: num(x.impressions), reach: num(x.reach), linkClicks: num(x.inline_link_clicks), landingViews: act(x.actions, 'landing_page_view'), ctr: num(x.ctr), cpc: num(x.cpc) });
  byDay.set(x.date_start, o);
}
// where it showed, since launch (Colorado share)
const reg = await meta(CAMPAIGN + '/insights', { fields: 'impressions', breakdowns: 'region', time_range: JSON.stringify({ since: LAUNCH, until: today }), limit: 100 });
const regions = Object.fromEntries((reg.data || []).map((x) => [x.region, num(x.impressions)]));
const tot = await meta(CAMPAIGN + '/insights', { fields: 'reach,frequency', time_range: JSON.stringify({ since: LAUNCH, until: today }) });
// 2. registrations from the public tournament page
let players = null, fee = null;
try {
  const r = await fetch(PT_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PeakReport/1.0)' } });
  const s = (await r.text()).replace(/\\"/g, '"');
  const m = s.match(/"numOfPlayers"\s*:\s*(\d+)/); players = m ? Number(m[1]) : null;
  const f = s.match(/"costRegistrationCurrent"\s*:\s*([\d.]+)/); fee = f ? Number(f[1]) : null;
} catch (e) { console.error('pickleballtournaments.com: ' + e.message); }
const t = byDay.get(today) || { date: today };
Object.assign(t, { players, fee, regions, reachToDate: num((tot.data || [{}])[0].reach), frequencyToDate: num((tot.data || [{}])[0].frequency) });
byDay.set(today, t);
if (!byDay.get('2026-11-25')?.players) byDay.set('2026-11-25', Object.assign(byDay.get('2026-11-25') || { date: '2026-11-25' }, { players: 4, playersNote: 'baseline, read 25 Nov 2026 before the ad first showed' }));
const out = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
writeJson(FILE, out);
const sum = (k) => out.reduce((n, r) => n + num(r[k]), 0);
const co = regions.Colorado || 0, all = Object.values(regions).reduce((a, b) => a + b, 0);
console.log(`golden ring ok spend $${sum('spend').toFixed(2)} impressions ${sum('impressions')} reach ${num((tot.data || [{}])[0].reach)} link_clicks ${sum('linkClicks')} landing_views ${sum('landingViews')} players ${players} (baseline 4) fee $${fee} colorado ${all ? Math.round(100 * co / all) : '-'}%`);
