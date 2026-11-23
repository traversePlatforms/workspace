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

// ==== DAY-ONE MEASURES (added 23 Nov 2026): retention, regulars -> members, win-back, birthday month, missed payments ==============
// Shared by the nightly JSON and WEEK MODE. Same rules as above: sponsorship rows left out, a member's plan read from the amount paid
// (never the plan name), anonymous member ids only. "known" = the newest data day: a lagging measure only counts a person once their
// follow-up window has closed before it.
const known = latestSnap || today;
// dues cover: a monthly dues payment covers the 35 days from its paid day (a month plus a few days for billing timing and card retries);
// a prepaid annual covers 365 days. Paying at day d = covered on d.
const pays = new Map(); // member -> [[day, coverDays]] sorted
for (const r of dues) if (!isRefund(r) && r.Amount > 0 && r.OrgMemberId) (pays.get(r.OrgMemberId) || pays.set(r.OrgMemberId, []).get(r.OrgMemberId)).push([d10(r.PaidDate), 35]);
for (const r of annual) if (r.OrgMemberId) (pays.get(r.OrgMemberId) || pays.set(r.OrgMemberId, []).get(r.OrgMemberId)).push([d10(r.PaidDate), 365]);
for (const a of pays.values()) a.sort((x, y) => (x[0] < y[0] ? -1 : 1));
const coveredOn = (id, d) => (pays.get(id) || []).some(([p, c]) => p <= d && addDays(p, c - 1) >= d);
const paidBetween = (id, a, b) => (pays.get(id) || []).some(([p]) => p > a && p <= b); // a dues payment after day a, up to day b
const sundaysIn = (r) => { const o = []; for (let d = r.from; d <= r.to; d = addDays(d, 1)) if (new Date(d + 'T12:00:00Z').getUTCDay() === 0) o.push(d); return o; };
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };

// 1. New-member retention. Cohort = new members (first-ever dues payment or prepaid annual, from Nov 2024) whose first payment fell in
// the period. Still paying N days later = covered by dues on day N+5 after the first payment (the first payment's own 35-day cover runs
// out on day 35, so the check needs a renewal; the +5 lets a renewal be a few days late). Lagging: a person counts once day N+5 has passed.
function retention(r, N) {
  let cohort = 0, kept = 0, waiting = 0;
  for (const [id, f] of firstPaid) { if (f < '2024-11-01' || !inR(f, r)) continue; const chk = addDays(f, N + 5); if (chk >= known) { waiting++; continue; } cohort++; if (coveredOn(id, chk)) kept++; }
  return { cohort, stillPaying: kept, rate: pct(kept, cohort), followUpNotOver: waiting };
}
// Starter -> higher plan. Starter cohort = new members whose first day of dues totalled exactly $35 (the Starter price since Sep 2025).
// Upgraded = any later day within 90 days whose dues total $39 or more (Play $39 and up: Flex, Unlimited, Platinum). Senior Play ($29) is
// not counted as higher. A mid-month upgrade billed only as a small prorated difference under $39 is missed (see the impact doc).
const dayDues = new Map(); // member -> Map(day -> dues paid that day)
for (const r of dues) if (!isRefund(r) && r.Amount > 0 && r.OrgMemberId) { const m = dayDues.get(r.OrgMemberId) || dayDues.set(r.OrgMemberId, new Map()).get(r.OrgMemberId); const d = d10(r.PaidDate); m.set(d, (m.get(d) || 0) + r.Amount); }
function starterUpgrades(r, N = 90) {
  let cohort = 0, up = 0, waiting = 0;
  for (const [id, f] of firstPaid) {
    if (f < '2024-11-01' || !inR(f, r)) continue; const dd = dayDues.get(id); if (!dd || Math.round((dd.get(f) || 0) * 100) !== 3500) continue;
    if (addDays(f, N) >= known) { waiting++; continue; } cohort++;
    if ([...dd].some(([d, v]) => d > f && d <= addDays(f, N) && v >= 39)) up++;
  }
  return { starters: cohort, upgraded: up, rate: pct(up, cohort), followUpNotOver: waiting };
}

// 2. Non-member regulars -> members. A regular on day S = 3+ check-ins (check-in report rows, guest rows left out) in the 60 days to S,
// not covered by dues on S, and not on a staff, comp or family-of-a-member plan in today's member list (Employee, FREE, Wellhub, Corporate
// Medallion, sponsor plans, Play/Unlimited/Platinum/Starter Family): those people get member privileges without paying dues themselves.
// Joined = any dues payment (first-ever or a returning member) in the N days after S. Lagging: S + N must have passed.
const COMP = /employee|free|wellhub|medallion|sponsor|staff|(play|unlimited|platinum|starter) family/i;
const compNow = new Set(members.filter((m) => m.MembershipTypeName && COMP.test(m.MembershipTypeName)).map((m) => m.OrganizationMemberId));
const ciRows = checkins.filter((x) => x.OrganizationMemberId && x.IsGuest !== 'Yes').map((x) => [d10(x.CheckinDateTime || x.ReservationStartDateTime), x.OrganizationMemberId]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
const lowerBound = (d) => { let lo = 0, hi = ciRows.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (ciRows[mid][0] < d) lo = mid + 1; else hi = mid; } return lo; };
const regCache = new Map();
function regularsAt(S) {
  if (regCache.has(S)) return regCache.get(S);
  const c = new Map(); for (let i = lowerBound(addDays(S, -59)); i < ciRows.length && ciRows[i][0] <= S; i++) c.set(ciRows[i][1], (c.get(ciRows[i][1]) || 0) + 1);
  const ids = [...c].filter(([id, n]) => n >= 3 && !coveredOn(id, S) && !compNow.has(id)).map(([id]) => id);
  regCache.set(S, ids); return ids;
}
function regularsJoined(sundays, N) { // pooled over the Sundays whose N-day window has closed
  let people = 0, joined = 0, used = 0;
  for (const S of sundays) { if (addDays(S, N) >= known) continue; used++; for (const id of regularsAt(S)) { people++; if (paidBetween(id, S, addDays(S, N))) joined++; } }
  return { sundays: used, regulars: people, joined, rate: pct(joined, people) };
}

// 3. Win-back. A lapse = a dues cover ran out (day "out") with nothing paid before it ran out and nothing in the 30 days after (the same
// rule as the weekly lapsed count). Came back = paid dues again within 90 days of "out" (so on day 31-90). Lagging: out + 90 must have passed.
const lapses = []; // { id, out, next }
for (const [id, a] of pays) {
  let end = null;
  for (const [p, c] of a) {
    if (end && p > end) { const out = addDays(end, 1); if (p > addDays(out, 30)) lapses.push({ id, out, next: p }); end = addDays(p, c - 1); }
    else { const e = addDays(p, c - 1); if (!end || e > end) end = e; }
  }
  if (end) lapses.push({ id, out: addDays(end, 1), next: null });
}
function winBack(r, N = 90) {
  let lapsed = 0, back = 0, waiting = 0;
  for (const l of lapses) { if (!inR(l.out, r)) continue; if (addDays(l.out, N) >= known) { waiting++; continue; } lapsed++; if (l.next && l.next <= addDays(l.out, N)) back++; }
  return { lapsed, cameBack: back, rate: pct(back, lapsed), followUpNotOver: waiting };
}

// 4. Birthday month. Members = people paying dues in month M (paidByMonth: a Membership Fee payment that month, or a prepaid annual's
// 12 months) whose birth month (anonymous member list: month only) is M. Spend = every sales row on their account paid that month, net of
// refunds, sponsorship rows left out, prepaid annuals spread 1/12 a month. Their "average month" = their average spend over the months
// they paid dues in the 11 months before M (people with no such month are left out). Index = spend in the birthday month / the average
// month, summed over the people (100% = no difference). Control = the same index for members NOT born in M, in M: it carries the
// season, so lift = index / control. Gear = POS items in the Apparel/Pro Shop, Paddles/Gear and Shoes groups (Peak's birthday email
// offers 50% off gear); POS refund rows carry no item, so gear is before refunds. Full calendar months only.
const GEAR = /apparel|pro shop|paddles|gear|shoes/i;
const birthMonth = new Map(members.filter((m) => m.BirthMonth).map((m) => [m.OrganizationMemberId, m.BirthMonth]));
const spend = new Map(); // member -> { 'YYYY-MM': { all, gear, nonDues } }
const addSpend = (id, m, k, v) => { const o = spend.get(id) || spend.set(id, {}).get(id); const x = (o[m] ||= { all: 0, gear: 0, nonDues: 0 }); x[k] += v; };
for (const r of sales) {
  if (sponsor(r) || !r.OrgMemberId) continue; const m = month(r.PaidDate), id = r.OrgMemberId;
  if (/prepaid annual/i.test(r.ItemName || '') && !isRefund(r) && r.Amount > 0) { for (let k = 0; k < 12; k++) { const d = new Date(m + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + k); addSpend(id, d.toISOString().slice(0, 7), 'all', r.Amount / 12); } continue; }
  const v = isRefund(r) ? -Math.abs(r.Amount) : r.Amount;
  addSpend(id, m, 'all', v);
  if (r.FeeCategoryName !== 'Membership Fee') addSpend(id, m, 'nonDues', v);
  if (r.FeeCategoryName === 'POS' && !isRefund(r) && GEAR.test((r.ItemName || '').split(' - ')[0])) addSpend(id, m, 'gear', v);
}
const monthAdd = (m, k) => { const d = new Date(m + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + k); return d.toISOString().slice(0, 7); };
function birthdayMonth(ms) { // pooled over the months ms (full months only)
  const z = () => ({ people: 0, inMonth: { all: 0, gear: 0, nonDues: 0 }, avgMonth: { all: 0, gear: 0, nonDues: 0 }, gearBuyers: 0 });
  const B = z(), C = z(); let used = 0;
  for (const M of ms) {
    if (M >= thisMonth || !paidByMonth.get(M)) continue; used++; const mm = +M.slice(5, 7);
    for (const id of paidByMonth.get(M)) {
      const bm = birthMonth.get(id); if (!bm) continue;
      const other = []; for (let k = -11; k <= -1; k++) { const p = monthAdd(M, k); if (paidByMonth.get(p)?.has(id)) other.push(p); }
      if (!other.length) continue;
      const t = bm === mm ? B : C, s = spend.get(id) || {}; t.people++;
      for (const k of ['all', 'gear', 'nonDues']) { t.inMonth[k] += s[M]?.[k] || 0; t.avgMonth[k] += other.reduce((a, p) => a + (s[p]?.[k] || 0), 0) / other.length; }
      if ((s[M]?.gear || 0) > 0) t.gearBuyers++;
    }
  }
  const idx = (t, k) => (t.avgMonth[k] ? round((100 * t.inMonth[k]) / t.avgMonth[k]) : null);
  const R = (t) => ({ people: t.people, spendInMonth: Math.round(t.inMonth.all), avgMonth: Math.round(t.avgMonth.all), index: idx(t, 'all'), nonDuesIndex: idx(t, 'nonDues'), gearInMonth: Math.round(t.inMonth.gear), gearAvgMonth: Math.round(t.avgMonth.gear), gearIndex: idx(t, 'gear'), gearBuyersShare: pct(t.gearBuyers, t.people) });
  const b = R(B), c = R(C);
  return { months: used, birthday: b, notBirthday: c, lift: b.index && c.index ? round((100 * b.index) / c.index) : null, gearLift: b.gearIndex && c.gearIndex ? round((100 * b.gearIndex) / c.gearIndex) : null };
}

// 5. Missed payments (the transactions store: every Membership Fee charge, paid or not). Due = the charge's dues period start
// (ReservationStart; CourtReserve raises the charge up to ~5 days before and takes the card on the due day). Paid late = paid more than
// 24 hours after due; days late = whole days. Still unpaid = an open balance more than 24 hours past due at the start of the data day.
// Reached suspension = still unpaid 10 days after due (paid plans suspend at 10 days past due and auto-cancel at 11: CourtReserve plan
// settings). Recovered before cancel = of those, paid by day 11. Sponsorship charges left out. CourtReserve does not keep every failed
// charge (most accounts suspended on day one have no open charge), so suspensions read low: the member list's Suspended count is the
// true figure from 23 Nov 2026 on.
const tx = readStore('courtreserve/transactions');
const sponsorTx = new Set(), sponsorIds = new Set();
for (const r of sales) if (r.FeeCategoryName === 'Membership Fee' && sponsor(r)) { sponsorTx.add(r.TransactionId); if (r.OrgMemberId) sponsorIds.add(r.OrgMemberId); }
const nowMs = Date.parse(known + 'T00:00:00');
const charges = tx.filter((r) => r.TransactionType === 'Membership Fee' && r.Total > 0 && r.ReservationStart && !sponsorTx.has(r.TransactionId) && !sponsorIds.has(r.OrganizationMemberId)).map((r) => {
  const due = Date.parse(r.ReservationStart), open = r.UnpaidAmount > 0, paid = !open && r.PaidOn ? Date.parse(r.PaidOn) : null;
  return { dueDay: d10(r.ReservationStart), due, paid, hrs: paid != null ? (paid - due) / 36e5 : null, amt: r.Total, open: open ? r.UnpaidAmount : 0 };
});
function missed(r) {
  const xs = charges.filter((c) => inR(c.dueDay, r) && c.due < nowMs);
  const late = xs.filter((c) => c.hrs != null && c.hrs > 24), unpaid = xs.filter((c) => c.paid == null && nowMs - c.due > 24 * 36e5);
  const susp = xs.filter((c) => (c.paid == null && nowMs - c.due > 240 * 36e5) || (c.hrs != null && c.hrs > 240));
  const rec = susp.filter((c) => c.hrs != null && c.hrs <= 264), after = susp.filter((c) => c.hrs != null && c.hrs > 264);
  return { charges: xs.length, paidLate: late.length, paidLateShare: pct(late.length, xs.length), medianDaysLate: median(late.map((c) => Math.floor(c.hrs / 24))), stillUnpaid: unpaid.length, stillUnpaidDollars: Math.round(unpaid.reduce((a, c) => a + c.open, 0)), reachedSuspension: susp.length, recoveredBeforeCancel: rec.length, paidAfterCancelPoint: after.length, final: addDays(r.to, 11) < known };
}
const BMONTHS = Array.from({ length: 12 }, (_, k) => monthAdd('2025-11', k)); // the 12 full months of baseline B: Nov 2025 to Oct 2026
const B1 = { from: '2024-11-11', to: '2025-11-10' }; // the 12 months before B (same period last year); the store starts Sep 2024, so read with care
const B1MONTHS = Array.from({ length: 12 }, (_, k) => monthAdd('2024-11', k));
const monthR = (m) => ({ from: m + '-01', to: m + '-31' });
function dayOneSet(r, ms) {
  const per = (n) => round((n / days(r)) * 7);
  const mp = missed(r), regs = sundaysIn(r).map((S) => regularsAt(S).length);
  return {
    period: r, retention30: retention(r, 30), retention60: retention(r, 60), retention90: retention(r, 90), starterUpgrades90: starterUpgrades(r),
    regulars: { avgSunday: regs.length ? Math.round(regs.reduce((a, b) => a + b, 0) / regs.length) : null, joined30: regularsJoined(sundaysIn(r), 30), joined60: regularsJoined(sundaysIn(r), 60) },
    winBack90: winBack(r), missed: { ...mp, perWeek: { paidLate: per(mp.paidLate), stillUnpaid: per(mp.stillUnpaid), reachedSuspension: per(mp.reachedSuspension), recoveredBeforeCancel: per(mp.recoveredBeforeCancel) }, perMonth: { paidLate: round((mp.paidLate / days(r)) * 30.44), reachedSuspension: round((mp.reachedSuspension / days(r)) * 30.44) } },
    birthday: birthdayMonth(ms),
  };
}
function dayOneMonthly() {
  const ms = []; for (let m = '2024-11'; m <= known.slice(0, 7); m = monthAdd(m, 1)) ms.push(m);
  return Object.fromEntries(ms.map((m) => { const r = monthR(m); const rj = regularsJoined(sundaysIn(r), 30); return [m, { ret30: retention(r, 30).rate, ret60: retention(r, 60).rate, ret90: retention(r, 90).rate, newMembers: retention(r, 30).cohort + retention(r, 30).followUpNotOver, starterUpgrade90: starterUpgrades(r).rate, regularsOnLastSunday: (() => { const ss = sundaysIn(r); return ss.length && ss[ss.length - 1] < known ? regularsAt(ss[ss.length - 1]).length : null; })(), regularsJoined30: rj.rate, winBack90: winBack(r).rate, lapsed: winBack(r).lapsed + winBack(r).followUpNotOver, birthday: m < thisMonth ? (({ birthday: b, notBirthday: c, lift, gearLift }) => ({ people: b.people, index: b.index, controlIndex: c.index, lift, gearIndex: b.gearIndex, gearLift }))(birthdayMonth([m])) : null }]; }));
}
function missedByMonth() {
  const ms = [...new Set(charges.map((c) => c.dueDay.slice(0, 7)))].sort().filter((m) => m <= known.slice(0, 7));
  return Object.fromEntries(ms.map((m) => [m, missed({ from: m + '-01', to: m + '-31' })]));
}

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

  // dues cover (pays, defined above with the day-one measures): a monthly payment covers 35 days, a prepaid annual 365. Lapsed in a
  // week = a cover ran out that week with no new payment before it ran out, and none within the 30 days after (final 30 days after its Sunday).
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
  const sundays = sundaysIn;
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
  const sh = (r, w) => ({ from: addDays(r.from, -7 * w), to: addDays(r.to, -7 * w) }); // the same Monday-Sunday week, w weeks earlier
  const fmtW = (r) => `${r.from.slice(5)}..${r.to.slice(5)}`;
  const calc = (r, isBase) => {
    const dc$ = duesCash(r), f7 = freeCohort(r, 7), f60 = freeCohort(r, 60), op = openPlay(r), p = patch(r), kept = regsIn(r), canc = cancelsIn(r);
    const flow = (n) => (isBase ? perWk(n, r) : n);
    const list = isBase ? null : listAt(r.to);
    // day-one measures. Lagging ones read the cohort whose follow-up closed by this Sunday (the baseline pools its closed cohorts)
    const co = (w) => (isBase ? r : sh(r, w));
    const ret = { 30: retention(co(5), 30), 60: retention(co(10), 60), 90: retention(co(14), 90) }, upg = starterUpgrades(co(13));
    const rj = (N, w) => regularsJoined(isBase ? sundays(r) : [addDays(r.to, -7 * w)], N); const rj30 = rj(30, 5), rj60 = rj(60, 9);
    const wb = winBack(co(13)), mp = missed(co(2));
    const bm = birthdayMonth(isBase ? BMONTHS : [monthAdd(r.to.slice(0, 7), -1)]);
    const day1 = {
      ret30: ret[30].rate, ret60: ret[60].rate, ret90: ret[90].rate, starterUpgrade90: upg.rate,
      regulars: isBase ? round(avg(sundays(r).map((S) => regularsAt(S).length)), 0) : regularsAt(r.to).length, regJoin30: rj30.rate, regJoin60: rj60.rate,
      winBack90: wb.rate,
      birthdayIndex: bm.birthday.index, birthdayLift: bm.lift, birthdayGearIndex: bm.birthday.gearIndex, birthdayGearLift: bm.gearLift,
      duesLate: flow(mp.paidLate), duesLateMedianDays: mp.medianDaysLate, duesUnpaid: flow(mp.stillUnpaid), duesSuspended: flow(mp.reachedSuspension), duesRecovered: flow(mp.recoveredBeforeCancel),
      day1Detail: { retention: ret, starterUpgrades: upg, regularsJoined30: rj30, regularsJoined60: rj60, winBack: wb, missed: mp, birthday: bm },
    };
    return { ...day1,
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
    ['payingDues', 'Paying members (dues)', 'n', 'up', 'members whose dues cover the Sunday: a monthly payment covers 35 days, a prepaid annual 365. Normal = average of the baseline\'s Sundays', { normalIs: 'an average Sunday' }],
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
    ...(() => { // the day-one measures (23 Nov 2026). LAGGING rows read an earlier cohort, named in the note, once its follow-up is over
      const D = T.day1Detail, r = D.retention, u = D.starterUpgrades, w = D.winBack, mp = D.missed, bm = D.birthday, ND = N.day1Detail;
      const lag = { lagging: true };
      return [
        ['ret30', 'New members still paying 30 days later', '%', 'up', `New members of ${fmtW(sh(W, 5))} (${r[30].stillPaying} of ${r[30].cohort}) covered by dues on day 35 after their first payment (a renewal needed; 5 days' grace). Normal = the baseline's new members whose day 35 has passed`, lag],
        ['ret60', 'New members still paying 60 days later', '%', 'up', `New members of ${fmtW(sh(W, 10))} (${r[60].stillPaying} of ${r[60].cohort}), covered on day 65`, lag],
        ['ret90', 'New members still paying 90 days later', '%', 'up', `New members of ${fmtW(sh(W, 14))} (${r[90].stillPaying} of ${r[90].cohort}), covered on day 95`, lag],
        ['starterUpgrade90', 'Starter members who upgraded within 90 days', '%', 'up', `New members whose first dues were the $35 Starter price, ${fmtW(sh(W, 13))} (${u.upgraded} of ${u.starters}), who paid $39 or more in a day (Play and up) within 90 days. By amount paid, never the plan name. Baseline: ${ND.starterUpgrades.upgraded} of ${ND.starterUpgrades.starters}`, lag],
        ['regulars', 'Non-member regulars (3+ check-ins in 60 days)', 'n', '', 'people with 3 or more check-ins (guests left out) in the 60 days to the Sunday, not covered by dues that day and not on a staff, comp or family plan. The pool the drop-in-to-member automations work on. Normal = average of the baseline\'s Sundays', { normalIs: 'an average Sunday' }],
        ['regJoin30', 'Regulars who paid dues within 30 days', '%', 'up', `The regulars of Sunday ${addDays(W.to, -35).slice(5)} (${D.regularsJoined30.joined} of ${D.regularsJoined30.regulars}) who paid dues in the next 30 days. Normal = every baseline Sunday's regulars, pooled`, lag],
        ['regJoin60', 'Regulars who paid dues within 60 days', '%', 'up', `The regulars of Sunday ${addDays(W.to, -63).slice(5)} (${D.regularsJoined60.joined} of ${D.regularsJoined60.regulars}), next 60 days`, lag],
        ['winBack90', 'Lapsed members back within 90 days', '%', 'up', `Members whose dues cover ran out ${fmtW(sh(W, 13))} with nothing paid within 30 days (${w.cameBack} of ${w.lapsed}) who paid dues again within 90 days of running out`, lag],
        ['duesLate', 'Dues charges paid late', 'n', 'down', `Charges due ${fmtW(sh(W, 2))} (${mp.charges} due) paid more than 24 hours after the due day; median ${mp.medianDaysLate ?? 'n/a'} days late. From the transactions store`, lag],
        ['duesLateMedianDays', 'Dues paid late: median days late', 'n', 'down', `The same charges: whole days between due and paid`, { ...lag, normalIs: 'median over the 12 months' }],
        ['duesUnpaid', 'Dues charges still unpaid', 'n', 'down', `Charges due ${fmtW(sh(W, 2))} with an open balance at the data day ($${mp.stillUnpaidDollars})`, lag],
        ['duesSuspended', 'Dues charges unpaid at 10 days (suspension point)', 'n', 'down', `Charges due ${fmtW(sh(W, 2))} still unpaid 10 days after due, when CourtReserve suspends the plan. Reads low: CourtReserve does not keep every failed charge (the member-list Suspended row is the true count)`, lag],
        ['duesRecovered', 'Suspended charges paid by day 11 (before cancel)', 'n', 'up', `Of those, paid by 11 days after due, the auto-cancel point (${mp.paidAfterCancelPoint} more paid after it)`, lag],
        ['birthdayIndex', 'Birthday-month spend vs an average month', '%', 'up', `last full month (${monthAdd(W.to.slice(0, 7), -1)}): members paying dues that month whose birth month it is (${bm.birthday.people}): all their spend that month (net of refunds, no sponsorships) / their average month over the 11 before. 100% = no difference. Members not born that month: ${bm.notBirthday.index ?? 'n/a'}% (the season); lift ${bm.lift ?? 'n/a'}%. Baseline lift ${ND.birthday.lift ?? 'n/a'}%`, { monthly: true }],
        ['birthdayGearIndex', 'Birthday-month gear sales vs an average month', '%', 'up', `the same members: pro-shop gear (Apparel/Pro Shop, Paddles/Gear, Shoes) in the birthday month / their average month ($${bm.birthday.gearInMonth} against $${bm.birthday.gearAvgMonth}). Not born that month: ${bm.notBirthday.gearIndex ?? 'n/a'}%. Baseline gear lift ${ND.birthday.gearLift ?? 'n/a'}%`, { monthly: true }],
      ];
    })(),
    ['patchSent', 'Patch messages sent', 'n', '', 'every Patch message out that week (Colorado day)'],
    ['patchBlasts', 'Patch: blasts', 'n', '', 'campaign sends'],
    ['patchAutomations', 'Patch: automations', 'n', 'up', 'automation sends (welcomes, birthday, thank-you and the rest)'],
    ['openRate', 'Patch open rate', '%', 'up', 'opened / delivered (Apple Mail inflates opens: compare like with like)'],
    ['clickRate', 'Patch click rate', '%', 'up', 'clicked / delivered'],
    ['unsubRate', 'Patch unsubscribe rate', '%', 'down', 'unsubscribed / delivered'],
  ].map(([key, label, unit, better, note, x]) => ({ key, label, unit, better, this: T[key], last: L[key], lastYear: Y[key], normal: N[key], note, ...(x || {}) }));
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
    dayOneMeasures: { what: 'detail behind the day-one rows (counts and cohorts)', this: T.day1Detail, last: L.day1Detail, sameWeekLastYear: Y.day1Detail, normal: N.day1Detail },
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
  // the day-one measures (23 Nov 2026): definitions in the DAY-ONE MEASURES block above and impact-measurement §2.9-2.13. Lagging rates
  // count only people whose follow-up has closed by the data day (followUpNotOver = still waiting).
  dayOneMeasures: {
    dataDay: known, regularsNow: { day: addDays(today, -1), count: regularsAt(addDays(today, -1)).length },
    baseline: dayOneSet(B, BMONTHS), prior12Months: dayOneSet(B1, B1MONTHS), after: { missed: missed(A), retention30: retention(A, 30), winBack90: winBack(A) },
    suspendedNowByMissedPaymentMonth: (() => { const o = {}; for (const m of members) if (m.MembershipStatus === 'Suspended' && m.MembershipTypeName && !freePlan.test(m.MembershipTypeName)) { const k = d10(m.MembershipNextPaymentDate).slice(0, 7) || 'unknown'; o[k] = (o[k] || 0) + 1; } return Object.fromEntries(Object.entries(o).sort()); })(),
    missedByDueMonth: missedByMonth(), byMonth: dayOneMonthly(),
  },
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
