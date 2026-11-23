// Peak Pickleball: impact measurement (23 Nov 2026). Recomputes the before-vs-after numbers from the nightly pulls in data/pulls/.
// Reads the store only (no network). Writes data/pulls/<date>/impact.json and prints a summary (--quiet: one line).
// Definitions are spelled out in ../impact-measurement-2026-11-23.md; change them there and here together.
// Usage: node impact.mjs [--day=YYYY-MM-DD] [--quiet] [--json]
import { existsSync, readdirSync } from 'node:fs';
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
