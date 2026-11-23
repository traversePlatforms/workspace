// Peak Pickleball: impact measurement (23 Nov 2026). Recomputes the before-vs-after numbers from the nightly pulls in data/pulls/.
// Reads the store only (no network). Writes data/pulls/<date>/impact.json and prints a summary (--quiet: one line).
// Definitions are spelled out in ../impact-measurement-2026-11-23.md; change them there and here together.
// Usage: node impact.mjs [--day=YYYY-MM-DD] [--quiet] [--json]
//        node impact.mjs --week-end=YYYY-MM-DD [--json]   the weekly club scorecard (Monday to Sunday, Colorado time; the date is a Sunday):
//        that week, the week before, the same week last year (364 days earlier) and the 12-month normal (baseline B). Prints only;
//        writes nothing. Day one of Matthew's work for Peak = 23 Nov 2026, so Week 0 is 16-22 Nov 2026 (see WEEK MODE below).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PULLS, readStore, readGz, writeJson, denverDate, addDays } from './pull-lib.mjs';

const arg = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=')[1];
const quiet = process.argv.includes('--quiet');
const today = arg('day') || denverDate();
const GO = '2026-11-11'; // Tyler's go-ahead on the six places to grow
const B = { from: '2025-11-11', to: '2026-11-10' }; // baseline: the 12 months before GO
const A = { from: GO, to: addDays(today, -1) }; // after: GO to yesterday (today is partial)
const LY = { from: addDays(A.from, -364), to: addDays(A.to, -364) }; // the same weeks a year earlier (seasonality check)
const inR = (d, r) => d >= r.from && d <= r.to;
const days = (r) => Math.max(0, (Date.parse(r.to) - Date.parse(r.from)) / 864e5 + 1);
const d10 = (s) => String(s || '').slice(0, 10);
const weekOf = (s) => { const d = new Date(d10(s) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }; // Monday
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
const round = (x, n = 1) => (x == null ? null : Math.round(x * 10 ** n) / 10 ** n);

// ---- load -------------------------------------------------------------------------------------------------------
const sales = readStore('courtreserve/sales');
const regs = readStore('courtreserve/eventreg-active');
const cancels = readStore('courtreserve/eventreg-cancelled');
const checkins = readStore('courtreserve/checkins');
const util = readStore('courtreserve/courtutilization');
const msgs = readStore('patch/messages');
const latestSnap = readdirSync(PULLS).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today && existsSync(join(PULLS, d, 'courtreserve', 'members.noname.json.gz'))).sort().pop();
const members = latestSnap ? readGz(join(PULLS, latestSnap, 'courtreserve', 'members.noname.json.gz')) : [];
if (!sales.length) { console.error('no sales in the store: run the backfill first'); process.exit(1); }

// ---- membership dues ----------------------------------------------------------------------------------------------
// A member "pays dues" in a month when a Membership Fee row (TransactionType Fee, amount > 0) is paid that month. Refund rows are
// subtracted from revenue. Rows mentioning a sponsor (item, revenue category or plan) are left out. Prepaid annual memberships are
// Misc. Fee rows: the member counts as active for 12 months from the payment and 1/12 of it counts as dues each month.
// CourtReserve labels every row with the member's CURRENT plan, so the plan named on old rows is not trusted (4 Nov correction).
const sponsor = (r) => /sponsor/i.test([r.ItemName, r.RevenueCategoryName, r.MembershipName].join(' '));
const isRefund = (r) => /refund/i.test(r.TransactionType || '');
const dues = sales.filter((r) => r.FeeCategoryName === 'Membership Fee' && !sponsor(r));
const annual = sales.filter((r) => /prepaid annual/i.test(r.ItemName || '') && !isRefund(r) && r.Amount > 0);
const month = (s) => d10(s).slice(0, 7);
const paidByMonth = new Map(); // month -> Set(member)
const firstPaid = new Map(); // member -> first dues date
const duesRev = {}; // month -> net dues $
for (const r of dues) {
  const m = month(r.PaidDate), id = r.OrgMemberId;
  duesRev[m] = (duesRev[m] || 0) + (isRefund(r) ? -Math.abs(r.Amount) : r.Amount);
  if (isRefund(r) || !(r.Amount > 0) || !id) continue;
  (paidByMonth.get(m) || paidByMonth.set(m, new Set()).get(m)).add(id);
  if (!firstPaid.has(id) || d10(r.PaidDate) < firstPaid.get(id)) firstPaid.set(id, d10(r.PaidDate));
}
for (const r of annual) {
  const id = r.OrgMemberId, start = d10(r.PaidDate);
  for (let k = 0; k < 12; k++) {
    const d = new Date(start.slice(0, 7) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + k); const m = d.toISOString().slice(0, 7);
    (paidByMonth.get(m) || paidByMonth.set(m, new Set()).get(m)).add(id); duesRev[m] = (duesRev[m] || 0) + r.Amount / 12;
  }
  if (id && (!firstPaid.has(id) || start < firstPaid.get(id))) firstPaid.set(id, start);
}
const monthsSorted = [...paidByMonth.keys()].sort();
const thisMonth = today.slice(0, 7);
const fullMonths = monthsSorted.filter((m) => m < thisMonth);
const membersByMonth = Object.fromEntries(monthsSorted.map((m) => [m, paidByMonth.get(m).size]));
// churn: paid dues in month M-1, then paid nothing in month M AND nothing in M+1 (a one-month gap is usually billing timing:
// a payment on the 31st then the 1st, or a failed card retried). The latest full month cannot be judged yet (needs M+1).
const churn = {};
for (let i = 1; i + 1 < fullMonths.length + (fullMonths.includes(thisMonth) ? 0 : 1) && i + 1 <= fullMonths.length; i++) {
  const prev = paidByMonth.get(fullMonths[i - 1]), cur = paidByMonth.get(fullMonths[i]), next = paidByMonth.get(fullMonths[i + 1]) || paidByMonth.get(thisMonth) || new Set();
  if (!fullMonths[i + 1]) continue;
  const gap1 = [...prev].filter((id) => !cur.has(id)).length;
  const lost = [...prev].filter((id) => !cur.has(id) && !next.has(id)).length;
  churn[fullMonths[i]] = { prev: prev.size, missedOneMonth: gap1, lost, rate: pct(lost, prev.size) };
}
// new members: first-ever dues payment. The store starts Sep 2024, so "first" is only trusted from Nov 2024 on.
const newByWeek = {};
for (const [, d] of firstPaid) if (d >= '2024-11-01') newByWeek[weekOf(d)] = (newByWeek[weekOf(d)] || 0) + 1;
const newIn = (r) => [...firstPaid.values()].filter((d) => inR(d, r)).length;

// current active members from today's member list (status Active on a plan that charges)
const freePlan = /drop in|employee|free|wellhub|sponsor|corporate|medallion|comp|staff|guest|public embed|non-member/i;
const activePaidNow = members.filter((m) => m.MembershipStatus === 'Active' && m.MembershipTypeName && !freePlan.test(m.MembershipTypeName));
const suspendedPaidNow = members.filter((m) => m.MembershipStatus === 'Suspended' && m.MembershipTypeName && !freePlan.test(m.MembershipTypeName)).length;
const noMembershipNow = members.filter((m) => m.MembershipStatus === 'No Membership').length;
const activeByPlan = {}; for (const m of activePaidNow) { const k = m.MembershipTypeName.trim(); activeByPlan[k] = (activeByPlan[k] || 0) + 1; }

// ---- free class (Learn to Play) to member --------------------------------------------------------------------------
// Attendee = a kept (not cancelled) registration in the "Learn to Play Pickleball" category. A conversion = the person's FIRST-EVER
// dues payment falls 0-60 days after their first free class. People who had paid dues before the class are counted separately.
const isFree = (r) => /learn to play/i.test(r.EventCategoryName || '');
const firstFree = new Map();
for (const r of regs) if (isFree(r) && r.OrganizationMemberId && !r.IsGuest) { const d = d10(r.StartTime); if (!firstFree.has(r.OrganizationMemberId) || d < firstFree.get(r.OrganizationMemberId)) firstFree.set(r.OrganizationMemberId, d); }
function freeClassCohort(r, windowDays = 60) {
  let people = 0, already = 0, conv = 0, conv7 = 0;
  for (const [id, d] of firstFree) {
    if (!inR(d, r)) continue; people++;
    const fp = firstPaid.get(id);
    if (fp && fp < d) { already++; continue; }
    if (fp && (Date.parse(fp) - Date.parse(d)) / 864e5 <= windowDays) { conv++; if ((Date.parse(fp) - Date.parse(d)) / 864e5 <= 7) conv7++; }
  }
  const eligible = people - already;
  return { people, alreadyMembers: already, eligible, joinedWithin60d: conv, rate60: pct(conv, eligible), joinedWithin7d: conv7, rate7: pct(conv7, eligible) };
}

// ---- entry points: what new people did first, and who went on to pay dues ----------------------------------------------
// Cohort = accounts created in the window (each has 60+ days of follow-up). First activity = earliest kept event registration,
// court booking (as a listed player) or check-in on or after the account was created. Joined = first-ever dues within 60 days
// of that first activity. People whose first dues came before (or on the day of) any activity are "joined before any visit".
const resv = readStore('courtreserve/reservations-active');
function entryKind(cat) {
  cat = (cat || '').trim();
  if (/learn to play/i.test(cat)) return 'Free class (Learn to Play)';
  if (/university|classes|training|lesson|youth/i.test(cat)) return 'Paid class / lesson (PPU 101-102, private)';
  if (/open play|senior play|social|women|dupr|early play|guided open/i.test(cat)) return 'Open Play / social play (drop-in)';
  if (/league|tournament|peak event|fundraiser|ernie/i.test(cat)) return 'League, tournament or event';
  if (/member hold/i.test(cat)) return "Member Hold group (a friend's standing court)";
  return 'Other event: ' + cat;
}
function entryPoints(win, followDays = 60) {
  const created = new Map(members.filter((m) => m.CreatedDate && inR(d10(m.CreatedDate), win)).map((m) => [m.OrganizationMemberId, d10(m.CreatedDate)]));
  const first = new Map(); const see = (id, d, kind) => { const c = created.get(id); if (!c || d < c) return; const f = first.get(id); if (!f || d < f.d) first.set(id, { d, kind }); };
  for (const r of regs) if (!r.IsGuest && r.OrganizationMemberId) see(r.OrganizationMemberId, d10(r.StartTime), entryKind(r.EventCategoryName));
  for (const r of resv) for (const id of r.PlayerIds || []) if (id) see(id, d10(r.StartTime), 'Court booking');
  const out = {};
  const add = (k, joined, kept) => { const o = (out[k] ||= { people: 0, joined60d: 0, stillPaying3moLater: 0 }); o.people++; if (joined) o.joined60d++; if (kept) o.stillPaying3moLater++; };
  const paying3mo = (id, fp) => { const d = new Date(fp.slice(0, 7) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 3); const m = d.toISOString().slice(0, 7); return m < thisMonth && paidByMonth.get(m)?.has(id); };
  for (const [id, c] of created) {
    const f = first.get(id), fp = firstPaid.get(id);
    if (fp && fp < c) continue; // paid before this account existed: data quirk, skip
    if (fp && (!f || fp <= f.d)) { add('Joined before any visit (paid first)', true, paying3mo(id, fp)); continue; }
    if (!f) { add('No visit recorded', false, false); continue; }
    const joined = fp && (Date.parse(fp) - Date.parse(f.d)) / 864e5 <= followDays;
    add(f.kind, joined, joined && paying3mo(id, fp));
  }
  for (const o of Object.values(out)) { o.rate60 = pct(o.joined60d, o.people); o.kept3moOfJoined = pct(o.stillPaying3moLater, o.joined60d); }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1].people - a[1].people));
}
// people who took the free class at ANY point vs never, among accounts created in the window
function freeVsNot(win) {
  const ids = members.filter((m) => m.CreatedDate && inR(d10(m.CreatedDate), win)).map((m) => [m.OrganizationMemberId, d10(m.CreatedDate)]);
  const r = { took: { people: 0, paidDues: 0 }, never: { people: 0, paidDues: 0 } };
  for (const [id, c] of ids) { const fp = firstPaid.get(id); if (fp && fp < c) continue; const k = firstFree.has(id) ? 'took' : 'never'; r[k].people++; if (fp) r[k].paidDues++; }
  r.took.rate = pct(r.took.paidDues, r.took.people); r.never.rate = pct(r.never.paidDues, r.never.people); return r;
}
const EPW = { from: B.from, to: addDays(today, -61) };

// free-class cohorts by month of first class, joined within 30 days (short enough to judge recent months)
function freeByMonth() {
  const o = {};
  for (const [id, d] of firstFree) {
    const m = d.slice(0, 7); if (m < '2024-11') continue;
    const e = (o[m] ||= { people: 0, eligible: 0, joined30d: 0, followUpDays: Math.round((Date.parse(today) - Date.parse(m + '-28')) / 864e5) });
    e.people++; const fp = firstPaid.get(id); if (fp && fp < d) continue; e.eligible++;
    if (fp && (Date.parse(fp) - Date.parse(d)) / 864e5 <= 30) e.joined30d++;
  }
  for (const e of Object.values(o)) { e.rate30 = pct(e.joined30d, e.eligible); if (e.followUpDays < 30) e.note = 'under 30 days of follow-up: not final'; }
  return Object.fromEntries(Object.entries(o).sort());
}

// ---- events, cancellations, check-ins ----------------------------------------------------------------------------
const past = (r) => d10(r.StartTime) < today;
const regsIn = (r) => regs.filter((x) => past(x) && inR(d10(x.StartTime), r)).length;
const cancelsIn = (r) => cancels.filter((x) => inR(d10(x.StartTime), r)).length;
const checkinsIn = (r) => checkins.filter((x) => inR(d10(x.CheckinDateTime || x.ReservationStartDateTime), r)).length;
const regsByCat = (r) => { const o = {}; for (const x of regs) if (past(x) && inR(d10(x.StartTime), r)) { const k = (x.EventCategoryName || '').trim(); o[k] = (o[k] || 0) + 1; } return o; };

// ---- court utilisation -------------------------------------------------------------------------------------------
// Each stored week is CourtReserve's Court Utilization report for up to 7 days: 16 hourly slots (5 am to 9 pm) with, per weekday,
// the % of court time booked. Utilisation for a period = the plain average over every (date, hour) in it, each hour weighted equally.
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function utilIn(r, hourFilter) {
  let sum = 0, n = 0;
  for (const w of util) {
    for (let d = d10(w.Start); d <= d10(w.End); d = addDays(d, 1)) {
      if (!inR(d, r)) continue;
      const dow = DOW[new Date(d + 'T00:00:00Z').getUTCDay()];
      for (const s of w.TimeSlots || []) {
        if (hourFilter && !hourFilter(+String(s.Start).slice(0, 2), dow)) continue;
        const u = (s.DailyUsage || []).find((x) => x.DayOfWeekName === dow); if (u) { sum += u.Usage; n++; }
      }
    }
  }
  return n ? round(sum / n) : null;
}

// ---- email engagement (Patch) --------------------------------------------------------------------------------------
function email(r, cls) {
  const xs = msgs.filter((m) => m.ev === 'message.out' && inR(d10(m.at), r) && (!cls || m.cls === cls));
  const n = xs.length, del = xs.filter((m) => m.stats?.delivered).length;
  return { sent: n, sms: xs.filter((m) => m.ch === 'SMS').length, openRate: pct(xs.filter((m) => m.stats?.opened).length, del), clickRate: pct(xs.filter((m) => m.stats?.clicked).length, del), unsubRate: pct(xs.filter((m) => m.stats?.unsubscribed).length, del) };
}

// ==== WEEK MODE: the weekly club scorecard (Matthew, 23 Nov 2026: "I am considering today the first day of work for peak ... track
// where they are at currently so that I can see how much they are growing week to week ... I need to be measuring whatever we can").
// The numbers go ONLY in his Sunday business report (shared/tools/eod/weekly.mjs runs this with --json). Same definitions as above:
// sponsorship rows left out, plan history never read from plan names (CourtReserve labels old rows with the CURRENT plan), annuals
// count as 12 months of dues. Week = Monday to Sunday, Colorado time (CourtReserve times are local; Patch times are UTC, converted).
const weekEnd = arg('week-end');
if (weekEnd) {
  const START_DAY = '2026-11-23'; // day one of Matthew's work for Peak
  if (!/^\d{4}-\d\d-\d\d$/.test(weekEnd) || new Date(weekEnd + 'T12:00:00Z').getUTCDay() !== 0) { console.error('--week-end=YYYY-MM-DD must be a Sunday'); process.exit(2); }
  const W = { from: addDays(weekEnd, -6), to: weekEnd }, WL = { from: addDays(weekEnd, -13), to: addDays(weekEnd, -7) }, WY = { from: addDays(W.from, -364), to: addDays(weekEnd, -364) };
  const weekNo = Math.round((Date.parse(weekEnd) - Date.parse(addDays(START_DAY, -1))) / (7 * 864e5)); // Week 0 = 16-22 Nov 2026
  const dataDay = latestSnap || today; // the newest nightly pull; a week is complete once a pull ran after its Sunday
  // holiday weeks are seasonal (Thanksgiving = 4th Thursday of November; Christmas; New Year)
  const thanks = (y) => { const d = new Date(Date.UTC(y, 10, 1)); const first = (4 - d.getUTCDay() + 7) % 7; return `${y}-11-${String(1 + first + 21).padStart(2, '0')}`; };
  const holiday = (r) => { const y = +r.to.slice(0, 4); const hs = [[thanks(y), 'Thanksgiving'], [thanks(y - 1), 'Thanksgiving'], [`${y}-12-25`, 'Christmas'], [`${y - 1}-12-25`, 'Christmas'], [`${y}-01-01`, 'New Year'], [`${y + 1}-01-01`, 'New Year']]; return (hs.find(([d]) => inR(d, r)) || [])[1] || ''; };

  // Patch times are UTC: the Colorado day, cached per UTC hour (offsets are whole hours)
  const dc = new Map(); const denDay = (iso) => { const k = String(iso).slice(0, 13); let v = dc.get(k); if (!v) { v = denverDate(new Date(k + ':00:00Z')); dc.set(k, v); } return v; };

  // dues cover: a monthly dues payment covers the 35 days from its paid day (a month plus a few days for billing timing and card
  // retries); a prepaid annual covers 365 days. Paying at day d = covered on d. Lapsed in a week = a cover ran out that week with no
  // new payment before it ran out, and none within the 30 days after (so a week is final 30 days after its Sunday).
  const pays = new Map(); // member -> [[day, coverDays]] sorted
  for (const r of dues) if (!isRefund(r) && r.Amount > 0 && r.OrgMemberId) (pays.get(r.OrgMemberId) || pays.set(r.OrgMemberId, []).get(r.OrgMemberId)).push([d10(r.PaidDate), 35]);
  for (const r of annual) if (r.OrgMemberId) (pays.get(r.OrgMemberId) || pays.set(r.OrgMemberId, []).get(r.OrgMemberId)).push([d10(r.PaidDate), 365]);
  for (const a of pays.values()) a.sort((x, y) => (x[0] < y[0] ? -1 : 1));
  const payingAt = (d) => { let n = 0; for (const a of pays.values()) if (a.some(([p, c]) => p <= d && addDays(p, c - 1) >= d)) n++; return n; };
  const lapsedIn = (r) => {
    let n = 0;
    for (const a of pays.values()) {
      let end = null; // last covered day so far
      for (const [p, c] of a) {
        if (end && p > end) { const out = addDays(end, 1); if (inR(out, r) && p > addDays(out, 30)) n++; end = addDays(p, c - 1); }
        else { const e = addDays(p, c - 1); if (!end || e > end) end = e; }
      }
      if (end && inR(addDays(end, 1), r)) n++; // ran out that week and nothing paid since
    }
    return n;
  };
  const sundays = (r) => { const o = []; for (let d = r.from; d <= r.to; d = addDays(d, 1)) if (new Date(d + 'T12:00:00Z').getUTCDay() === 0) o.push(d); return o; };
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  // dues collected: Membership Fee rows net of refunds by paid day, plus prepaid annuals paid that week (whole amount: cash in)
  const duesCash = (r) => { let fee = 0, ann = 0; for (const x of dues) if (inR(d10(x.PaidDate), r)) fee += isRefund(x) ? -Math.abs(x.Amount) : x.Amount; for (const x of annual) if (inR(d10(x.PaidDate), r)) ann += x.Amount; return { fee, ann, total: fee + ann }; };
  // free class: first-timers = people whose FIRST free class fell that week; attendance = kept free-class registrations that week
  const freeAttend = (r) => regs.filter((x) => isFree(x) && past(x) && inR(d10(x.StartTime), r)).length;
  const freeCohort = (r, win) => { let people = 0, eligible = 0, joined = 0; for (const [id, d] of firstFree) { if (!inR(d, r)) continue; people++; const fp = firstPaid.get(id); if (fp && fp < d) continue; eligible++; if (fp && (Date.parse(fp) - Date.parse(d)) / 864e5 <= win) joined++; } return { people, eligible, joined }; };
  const newAccounts = (r) => members.filter((m) => m.CreatedDate && inR(d10(m.CreatedDate), r)).length;
  // Open Play fill: "Open Play" category sessions that week (not cancelled, already started): booked places / places offered,
  // each session capped at 100%. Waitlist = people still waiting when the session list was pulled.
  const elSeen = new Set(); const eventlist = readStore('courtreserve/eventlist').filter((e) => { const k = e.EventId + '|' + e.StartDateTime; if (elSeen.has(k)) return false; elSeen.add(k); return true; });
  const openPlay = (r) => { let cap = 0, booked = 0, n = 0, full = 0, wait = 0; for (const e of eventlist) { if ((e.EventCategoryName || '').trim() !== 'Open Play' || e.IsCanceled || !(e.MaxRegistrants > 0)) continue; const d = d10(e.StartDateTime); if (!inR(d, r) || d >= today) continue; n++; cap += e.MaxRegistrants; booked += Math.min(e.RegisteredCount || 0, e.MaxRegistrants); if ((e.RegisteredCount || 0) >= e.MaxRegistrants) full++; wait += e.WaitlistCount || 0; } return { sessions: n, fill: pct(booked, cap), full, wait }; };
  const waitRows = readStore('courtreserve/eventreg-waitlist'); const waitIn = (r) => waitRows.filter((x) => inR(d10(x.StartTime), r)).length;
  // unique active players: anyone (not a guest) who checked in, was on a kept event registration that already happened, or was a
  // listed player on a court booking that week
  const players = (r) => { const s = new Set(); for (const x of checkins) if (x.IsGuest !== 'Yes' && x.OrganizationMemberId && inR(d10(x.CheckinDateTime || x.ReservationStartDateTime), r)) s.add(x.OrganizationMemberId); for (const x of regs) if (!x.IsGuest && x.OrganizationMemberId && past(x) && inR(d10(x.StartTime), r)) s.add(x.OrganizationMemberId); for (const x of resv) if (inR(d10(x.StartTime), r) && d10(x.StartTime) < today) for (const id of x.PlayerIds || []) if (id) s.add(id); return s.size; };
  // Patch: every message out, by Colorado day; blasts = CAMPAIGN, automations = AUTOMATION, rows with no class are one-off sends
  const blockNames = (() => { try { return JSON.parse(readFileSync(join(PULLS, 'store', 'patch', 'block-names.json'), 'utf8')); } catch { return {}; } })();
  const outMsgs = msgs.filter((m) => m.ev === 'message.out').map((m) => ({ m, d: denDay(m.at) }));
  const patch = (r) => {
    const xs = outMsgs.filter((x) => inR(x.d, r)).map((x) => x.m); const del = xs.filter((m) => m.stats?.delivered).length;
    const auto = {}, camp = {};
    for (const m of xs) { const nm = (m.subj || blockNames[m.seq + '|' + m.blk]?.subject || '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s+/g, ' ').trim() || 'unnamed (block ' + String(m.blk || '').slice(-6) + ')'; const safe = /@|\d{3}[\s.-]?\d{4}/.test(nm) ? '(subject withheld)' : nm; if (m.cls === 'AUTOMATION') auto[safe] = (auto[safe] || 0) + 1; else if (m.cls === 'CAMPAIGN') camp[safe] = (camp[safe] || 0) + 1; }
    return { sent: xs.length, email: xs.filter((m) => m.ch === 'EMAIL').length, sms: xs.filter((m) => m.ch === 'SMS').length, blasts: xs.filter((m) => m.cls === 'CAMPAIGN').length, automations: xs.filter((m) => m.cls === 'AUTOMATION').length, other: xs.filter((m) => m.cls !== 'CAMPAIGN' && m.cls !== 'AUTOMATION').length, delivered: del, openRate: pct(xs.filter((m) => m.stats?.opened).length, del), clickRate: pct(xs.filter((m) => m.stats?.clicked).length, del), unsubRate: pct(xs.filter((m) => m.stats?.unsubscribed).length, del), automationsSent: Object.entries(auto).sort((a, b) => b[1] - a[1]).map(([subject, sent]) => ({ subject, sent })), blastsSent: Object.entries(camp).sort((a, b) => b[1] - a[1]).map(([subject, sent]) => ({ subject, sent })) };
  };
  // member list (status now): only a snapshot taken within a day of the week's Sunday says where the week ended
  const snapNear = (d) => readdirSync(PULLS).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x) && x >= addDays(d, -1) && x <= addDays(d, 1) && existsSync(join(PULLS, x, 'courtreserve', 'members.noname.json.gz'))).sort().pop();
  const listAt = (d) => { const s = snapNear(d); if (!s) return null; const ms = s === latestSnap ? members : readGz(join(PULLS, s, 'courtreserve', 'members.noname.json.gz')); const paid = (m) => m.MembershipTypeName && !freePlan.test(m.MembershipTypeName); return { snapshot: s, active: ms.filter((m) => m.MembershipStatus === 'Active' && paid(m)).length, suspended: ms.filter((m) => m.MembershipStatus === 'Suspended' && paid(m)).length }; };

  const perWk = (n, r) => (n == null ? null : round((n / days(r)) * 7));
  const calc = (r, isBase) => {
    const dc$ = duesCash(r), f7 = freeCohort(r, 7), f60 = freeCohort(r, 60), op = openPlay(r), p = patch(r), kept = regsIn(r), canc = cancelsIn(r);
    const flow = (n) => (isBase ? perWk(n, r) : n);
    const list = isBase ? null : listAt(r.to);
    return {
      payingDues: isBase ? round(avg(sundays(r).map(payingAt)), 0) : payingAt(r.to),
      listActive: list ? list.active : null, listSuspended: list ? list.suspended : null, listSnapshot: list ? list.snapshot : null,
      newMembers: flow(newIn(r)), lapsed: flow(lapsedIn(r)),
      duesCollected: isBase ? Math.round((dc$.total / days(r)) * 7) : Math.round(dc$.total), duesFee: Math.round(dc$.fee), duesAnnual: Math.round(dc$.ann),
      freeFirstTimers: flow(f7.people), freeAttendance: flow(freeAttend(r)), freeEligible: f7.eligible, freeJoined7d: pct(f7.joined, f7.eligible), freeJoined7dCount: f7.joined, freeJoined60d: pct(f60.joined, f60.eligible), freeJoined60dCount: f60.joined,
      newAccounts: flow(newAccounts(r)),
      util: utilIn(r), util3to5: utilIn(r, (h, d) => h >= 15 && h < 17 && !/Sat|Sun/.test(d)), util5to8: utilIn(r, (h) => h < 8),
      openPlayFill: op.fill, openPlaySessions: flow(op.sessions), openPlayFull: flow(op.full), openPlayWaiting: flow(op.wait),
      eventRegs: flow(kept), eventCancels: flow(canc), cancelRate: pct(canc, canc + kept), waitlist: flow(waitIn(r)),
      checkins: flow(checkinsIn(r)), players: isBase ? null : players(r),
      patchSent: flow(p.sent), patchBlasts: flow(p.blasts), patchAutomations: flow(p.automations), patchOther: flow(p.other), patchSms: flow(p.sms),
      openRate: p.openRate, clickRate: p.clickRate, unsubRate: p.unsubRate,
      automationsSent: isBase ? undefined : p.automationsSent, blastsSent: isBase ? undefined : p.blastsSent,
    };
  };
  const T = calc(W), L = calc(WL), Y = calc(WY), N = calc(B, true);
  const final30 = dataDay > addDays(weekEnd, 30), final7 = dataDay > addDays(weekEnd, 7), complete = dataDay > weekEnd;
  // the scorecard rows: label, unit ('n', '$', '%'), better ('up' | 'down' | ''), the four values, and a note
  const M = [
    ['payingDues', 'Paying members (dues)', 'n', 'up', 'members whose dues cover the Sunday: a monthly payment covers 35 days, a prepaid annual 365. Normal = average of the baseline\'s Sundays'],
    ['listActive', 'Active on a paid plan (member list)', 'n', 'up', `CourtReserve member list${T.listSnapshot ? ' of ' + T.listSnapshot : ''}, status Active on a plan that charges (family members included). Only exists from the nightly pulls (first: 23 Nov 2026), so earlier weeks have none`],
    ['listSuspended', 'Suspended on a paid plan (member list)', 'n', 'down', 'the same member list, status Suspended'],
    ['newMembers', 'New members', 'n', 'up', 'first-ever dues payment (or prepaid annual) that week'],
    ['lapsed', 'Lapsed members', 'n', 'down', `a dues cover ran out that week with nothing paid before or within 30 days after.${final30 ? '' : ' Not final for this week until 30 days after its Sunday: a late payment takes people off, so it can fall'}`],
    ['duesCollected', 'Dues collected', '$', 'up', 'Membership Fee payments net of refunds, plus prepaid annuals paid that week in full (cash in that week, sponsorships left out). Normal = the baseline\'s cash per week'],
    ['freeFirstTimers', 'Free-class first-timers', 'n', 'up', 'people whose first-ever Learn to Play class was that week'],
    ['freeAttendance', 'Free-class attendance', 'n', 'up', 'kept Learn to Play registrations for classes that week'],
    ['freeJoined7d', 'Joined within 7 days of a free class', '%', 'up', `share of that week's first-timers (not already members) whose first dues came within 7 days of the class: ${T.freeJoined7dCount} of ${T.freeEligible} this week.${final7 ? '' : ' Not final until 7 days after the Sunday.'} The 60-day rate (${T.freeJoined60dCount} of ${T.freeEligible} so far; ${N.freeJoined60d}% in the baseline) lags 60 days`],
    ['newAccounts', 'New accounts', 'n', 'up', 'CourtReserve accounts created that week (from the current member list, so deleted accounts are not counted)'],
    ['util', 'Court utilisation, all hours', '%', 'up', 'CourtReserve Court Utilization report, 5 am to 9 pm, the plain average over every day and hour'],
    ['util3to5', 'Court utilisation, weekday 3-5 pm', '%', 'up', 'the same report, Monday to Friday, 3 to 5 pm (the quiet slot)'],
    ['util5to8', 'Court utilisation, 5-8 am', '%', 'up', 'the same report, every day, 5 to 8 am'],
    ['openPlayFill', 'Open Play fill', '%', 'up', '"Open Play" sessions that week: places booked / places offered, each session capped at 100% (CourtReserve event list)'],
    ['openPlayFull', 'Open Play sessions full', 'n', 'up', 'sessions booked to capacity (out of the week\'s Open Play sessions)'],
    ['eventRegs', 'Event registrations (kept)', 'n', 'up', 'kept registrations for events that week (Open Play, leagues, classes, socials, all categories)'],
    ['eventCancels', 'Event cancellations', 'n', 'down', 'cancelled registrations for events that week'],
    ['cancelRate', 'Event cancellation rate', '%', 'down', 'cancelled / (cancelled + kept)'],
    ['waitlist', 'Waitlist sign-ups', 'n', '', 'waitlist entries for events that week (whatever became of them)'],
    ['checkins', 'Check-ins', 'n', 'up', 'CourtReserve check-in report'],
    ['players', 'Unique active players', 'n', 'up', 'different people (not guests) who checked in, played a registered event or were listed on a court booking. No normal: a weekly count of different people does not average'],
    ['patchSent', 'Patch messages sent', 'n', '', 'every Patch message out that week (Colorado day)'],
    ['patchBlasts', 'Patch: blasts', 'n', '', 'campaign sends'],
    ['patchAutomations', 'Patch: automations', 'n', 'up', 'automation sends (welcomes, birthday, thank-you and the rest)'],
    ['openRate', 'Patch open rate', '%', 'up', 'opened / delivered (Apple Mail inflates opens: compare like with like)'],
    ['clickRate', 'Patch click rate', '%', 'up', 'clicked / delivered'],
    ['unsubRate', 'Patch unsubscribe rate', '%', 'down', 'unsubscribed / delivered'],
  ].map(([key, label, unit, better, note]) => ({ key, label, unit, better, this: T[key], last: L[key], lastYear: Y[key], normal: N[key], note }));
  const notAvailable = [
    { label: 'Website visitors and conversions (Google Analytics)', why: 'not available yet (waiting on access from Peak)' },
    { label: 'Meta ads (spend, reach, leads)', why: 'not available yet (waiting on access from Peak)' },
    { label: 'Membership Report and leagues from the API', why: 'CourtReserve answers 401 (not granted); leagues are counted inside event registrations' },
    { label: 'Monthly churn', why: 'a month rule (impact.json churn), readable two months after the month; weekly lapses above stand in for it' },
  ];
  const wk = {
    mode: 'week', startDay: START_DAY, weekEnd, week: W, weekNumber: weekNo, weekLabel: weekNo === 0 ? 'Week 0 (the starting point, before day one)' : weekNo > 0 ? `Week ${weekNo} since day one (${START_DAY})` : `${-weekNo} week${weekNo === -1 ? '' : 's'} before Week 0`,
    seasonal: holiday(W) ? `${holiday(W)} week: seasonal, read against the same week last year` : '', lastWeek: WL, sameWeekLastYear: WY, sameWeekLastYearSeasonal: holiday(WY) || '',
    normal: { ...B, what: '12-month normal: baseline B (12 months before Tyler\'s go), per week for counts, the rate over the 12 months for rates' },
    dataDay, complete, final7d: final7, final30d: final30, memberSnapshot: latestSnap,
    metrics: M, automationsThisWeek: T.automationsSent, blastsThisWeek: T.blastsSent, automationsLastWeek: L.automationsSent, automationsSameWeekLastYear: Y.automationsSent,
    breakdown: { duesFee: { this: T.duesFee, last: L.duesFee, lastYear: Y.duesFee }, duesAnnual: { this: T.duesAnnual, last: L.duesAnnual, lastYear: Y.duesAnnual }, freeEligible: { this: T.freeEligible, last: L.freeEligible, lastYear: Y.freeEligible }, freeJoined7dCount: { this: T.freeJoined7dCount, last: L.freeJoined7dCount, lastYear: Y.freeJoined7dCount }, freeJoined60d: { this: T.freeJoined60dCount, last: L.freeJoined60dCount, lastYear: Y.freeJoined60dCount, thisRate: T.freeJoined60d, normalRate: N.freeJoined60d }, openPlaySessions: { this: T.openPlaySessions, last: L.openPlaySessions, lastYear: Y.openPlaySessions, normal: N.openPlaySessions }, openPlayWaitingAtPull: { this: T.openPlayWaiting, last: L.openPlayWaiting }, patchOther: { this: T.patchOther, last: L.patchOther }, patchSms: { this: T.patchSms, last: L.patchSms, lastYear: Y.patchSms } },
    notAvailable,
  };
  if (process.argv.includes('--json')) console.log(JSON.stringify(wk, null, 1));
  else {
    const f = (v, u) => (v == null ? 'n/a' : u === '$' ? '$' + Math.round(v).toLocaleString('en-US') : u === '%' ? v + '%' : String(v));
    console.log(`Peak scorecard, ${wk.weekLabel}: ${W.from}..${W.to} (last week ${WL.from}..${WL.to}; same week last year ${WY.from}..${WY.to}; data to ${dataDay}${complete ? '' : ', WEEK NOT COMPLETE'})${wk.seasonal ? '\n' + wk.seasonal : ''}`);
    console.log(['metric'.padEnd(44), 'this'.padStart(9), 'last'.padStart(9), 'last yr'.padStart(9), 'normal'.padStart(9)].join(' '));
    for (const m of M) console.log([m.label.padEnd(44), f(m.this, m.unit).padStart(9), f(m.last, m.unit).padStart(9), f(m.lastYear, m.unit).padStart(9), f(m.normal, m.unit).padStart(9)].join(' '));
    console.log('automations that sent this week: ' + (T.automationsSent.map((a) => `${a.subject} (${a.sent})`).join('; ') || 'none'));
    console.log('blasts this week: ' + (T.blastsSent.map((a) => `${a.subject} (${a.sent})`).join('; ') || 'none'));
  }
  process.exit(0);
}

// ---- put it together ---------------------------------------------------------------------------------------------
const perWeek = (n, r) => round((n / days(r)) * 7);
const sumDues = (r) => Object.entries(duesRev).filter(([m]) => m >= r.from.slice(0, 7) && m <= r.to.slice(0, 7)).reduce((a, [, v]) => a + v, 0);
const lastFull = fullMonths[fullMonths.length - 1];
const out = {
  day: today, periods: { baseline: B, after: A, sameWeeksLastYear: LY }, memberSnapshot: latestSnap,
  activeMembers: { paidActiveNowFromMemberList: activePaidNow.length, suspendedPaidNow, noMembershipNow, byPlan: activeByPlan, payingByMonth: membersByMonth, lastFullMonth: lastFull, baselineStart: membersByMonth['2025-11'], baselineEnd: membersByMonth['2026-10'] },
  newMembers: { baselinePerWeek: perWeek(newIn(B), B), afterPerWeek: perWeek(newIn(A), A), sameWeeksLastYearPerWeek: perWeek(newIn(LY), LY), afterCount: newIn(A), byWeek: newByWeek },
  entryPoints: { window: EPW, byFirstActivity: entryPoints(EPW), tookFreeClassVsNever: freeVsNot(EPW), lastYearWindow: { from: '2024-11-11', to: '2025-09-12' }, lastYear: entryPoints({ from: '2024-11-11', to: '2025-09-12' }) },
  freeClass: { byMonth30d: freeByMonth(), baseline: freeClassCohort(B), afterSoFar: freeClassCohort(A), note: 'after-period cohorts have under 60 days of follow-up: rate60 is not final' },
  churn: (() => { const xs = Object.entries(churn).filter(([m]) => m >= '2025-12' && m <= '2026-10'); return { byMonth: churn, baselineAvgMonthlyRate: xs.length ? round(xs.reduce((a, [, v]) => a + v.rate, 0) / xs.length) : null, monthsAveraged: xs.map(([m]) => m) }; })(),
  duesRevenue: { byMonth: Object.fromEntries(Object.entries(duesRev).sort().map(([m, v]) => [m, Math.round(v)])), baseline12m: Math.round(sumDues({ from: '2025-11', to: '2026-10' })) },
  courtUtilisation: { baseline: utilIn(B), after: utilIn(A), sameWeeksLastYear: utilIn(LY), quietWeekday3to5pm: { baseline: utilIn(B, (h, d) => h >= 15 && h < 17 && !/Sat|Sun/.test(d)), after: utilIn(A, (h, d) => h >= 15 && h < 17 && !/Sat|Sun/.test(d)) }, early5to8am: { baseline: utilIn(B, (h) => h < 8), after: utilIn(A, (h) => h < 8) } },
  events: { baselineRegsPerWeek: perWeek(regsIn(B), B), afterRegsPerWeek: perWeek(regsIn(A), A), sameWeeksLastYearRegsPerWeek: perWeek(regsIn(LY), LY), baselineCancelRate: pct(cancelsIn(B), cancelsIn(B) + regsIn(B)), afterCancelRate: pct(cancelsIn(A), cancelsIn(A) + regsIn(A)), checkinsPerWeek: { baseline: perWeek(checkinsIn(B), B), after: perWeek(checkinsIn(A), A), sameWeeksLastYear: perWeek(checkinsIn(LY), LY) }, baselineByCategory: regsByCat(B) },
  email: { baseline: email(B), after: email(A), baselineAutomations: email(B, 'AUTOMATION'), afterAutomations: email(A, 'AUTOMATION') },
};
writeJson(join(PULLS, today, 'impact.json'), out);
if (quiet) { console.log(`impact ok day=${today} paid_active=${out.activeMembers.paidActiveNowFromMemberList} new_per_wk_after=${out.newMembers.afterPerWeek} baseline=${out.newMembers.baselinePerWeek}`); }
else if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else {
  const o = out; const L = (...a) => console.log(...a);
  L(`Peak impact, ${today} (baseline ${B.from}..${B.to}; after ${A.from}..${A.to}, ${days(A)} days)`);
  L(`active paid members now (member list): ${o.activeMembers.paidActiveNowFromMemberList}; paying dues Nov 2025 ${o.activeMembers.baselineStart} -> Oct 2026 ${o.activeMembers.baselineEnd}`);
  L(`new members/week: baseline ${o.newMembers.baselinePerWeek}, after ${o.newMembers.afterPerWeek}, same weeks last year ${o.newMembers.sameWeeksLastYearPerWeek}`);
  L(`free class -> member within 60 days: baseline ${o.freeClass.baseline.joinedWithin60d}/${o.freeClass.baseline.eligible} = ${o.freeClass.baseline.rate60}%`);
  L(`monthly churn (baseline average): ${o.churn.baselineAvgMonthlyRate}%; dues 12 months Nov 25-Oct 26: $${o.duesRevenue.baseline12m}`);
  L(`court utilisation: baseline ${o.courtUtilisation.baseline}%, after ${o.courtUtilisation.after}%, same weeks last year ${o.courtUtilisation.sameWeeksLastYear}%`);
  L(`event registrations/week: baseline ${o.events.baselineRegsPerWeek}, after ${o.events.afterRegsPerWeek}, last year ${o.events.sameWeeksLastYearRegsPerWeek}; cancel rate ${o.events.baselineCancelRate}% -> ${o.events.afterCancelRate}%`);
  L(`email open rate: baseline ${o.email.baseline.openRate}%, after ${o.email.after.openRate}%; click ${o.email.baseline.clickRate}% -> ${o.email.after.clickRate}%`);
}
