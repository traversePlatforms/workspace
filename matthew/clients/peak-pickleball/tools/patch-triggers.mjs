// Peak Pickleball: work out what starts each Patch automation (23 Nov 2026). Patch's API does not expose automation settings, so
// each send is timed against what the same person did in CourtReserve (Patch contact id = CourtReserve PatchContactId).
// Reads the store only. Writes data/pulls/<date>/patch/triggers.json and prints a table.
// For each automation block: median hours from the nearest check-in before the send, to the next event the person is booked on,
// from account creation, from first-ever dues, from last dues, from last free class; and the share within 26 hours of each.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PULLS, readStore, readGz, writeJson, denverDate } from './pull-lib.mjs';

const today = denverDate();
const snap = readdirSync(PULLS).filter((d) => /^\d{4}-/.test(d) && existsSync(join(PULLS, d, 'courtreserve', 'members.noname.json.gz'))).sort().pop();
const members = readGz(join(PULLS, snap, 'courtreserve', 'members.noname.json.gz'));
const byPatch = new Map(members.filter((m) => m.PatchContactId).map((m) => [m.PatchContactId, m]));
const t = (s) => Date.parse(String(s).length <= 19 ? s + (String(s).includes('T') ? '' : 'T00:00:00') : s); // CourtReserve local times treated as-is
const H = 36e5;
const idx = (rows, idKey, timeKey, filter) => { const m = new Map(); for (const r of rows) { if (filter && !filter(r)) continue; const id = r[idKey]; if (!id) continue; (m.get(id) || m.set(id, []).get(id)).push(t(r[timeKey])); } for (const a of m.values()) a.sort((x, y) => x - y); return m; };
const checkins = idx(readStore('courtreserve/checkins'), 'OrganizationMemberId', 'CheckinDateTime');
const regs = readStore('courtreserve/eventreg-active');
const regStart = idx(regs, 'OrganizationMemberId', 'StartTime');
const freeEnd = idx(regs, 'OrganizationMemberId', 'EndTime', (r) => /learn to play/i.test(r.EventCategoryName || ''));
const freeStart = idx(regs, 'OrganizationMemberId', 'StartTime', (r) => /learn to play/i.test(r.EventCategoryName || ''));
const dues = idx(readStore('courtreserve/sales'), 'OrgMemberId', 'PaidDate', (r) => r.FeeCategoryName === 'Membership Fee' && r.TransactionType === 'Fee' && r.Amount > 0);
const before = (a, x) => { if (!a) return null; let best = null; for (const v of a) { if (v <= x) best = v; else break; } return best == null ? null : (x - best) / H; };
const after = (a, x) => { if (!a) return null; for (const v of a) if (v >= x) return (v - x) / H; return null; };
const median = (xs) => { const a = xs.filter((x) => x != null).sort((p, q) => p - q); return a.length ? Math.round(a[Math.floor(a.length / 2)] * 10) / 10 : null; };
const share = (xs, f) => { const a = xs.filter((x) => x != null); return a.length ? Math.round((100 * a.filter(f).length) / xs.length) : 0; };

const msgs = readStore('patch/messages').filter((m) => m.ev === 'message.out' && m.cls === 'AUTOMATION');
const names = existsSync(join(PULLS, 'store', 'patch', 'block-names.json')) ? JSON.parse((await import('node:fs')).readFileSync(join(PULLS, 'store', 'patch', 'block-names.json'), 'utf8')) : {};
const blocks = new Map();
for (const m of msgs) (blocks.get(m.seq + '|' + m.blk) || blocks.set(m.seq + '|' + m.blk, []).get(m.seq + '|' + m.blk)).push(m);
const out = [];
for (const [k, list] of [...blocks].sort((a, b) => b[1].length - a[1].length)) {
  const f = { checkinBefore: [], nextEvent: [], sinceCreated: [], sinceFirstDues: [], sinceLastDues: [], sinceFreeClassEnd: [], untilFreeClass: [], birthMonthMatch: [], plan: {}, sendHourDenver: {} };
  let matched = 0;
  const sample = list.length > 3000 ? list.filter((_, i) => i % Math.ceil(list.length / 3000) === 0) : list;
  for (const m of sample) {
    const p = byPatch.get(m.cid); if (!p) continue; matched++;
    const id = p.OrganizationMemberId; const x = Date.parse(m.at) - 7 * H; // UTC -> roughly Mountain (MST), good to the hour
    f.checkinBefore.push(before(checkins.get(id), x)); f.nextEvent.push(after(regStart.get(id), x));
    f.sinceCreated.push(p.CreatedDate ? (x - t(p.CreatedDate)) / H : null);
    const d = dues.get(id); f.sinceFirstDues.push(d ? (x - d[0]) / H : null); f.sinceLastDues.push(before(d, x));
    f.sinceFreeClassEnd.push(before(freeEnd.get(id), x)); f.untilFreeClass.push(after(freeStart.get(id), x));
    f.birthMonthMatch.push(p.BirthMonth ? (p.BirthMonth === new Date(m.at).getUTCMonth() + 1 ? 1 : 0) : null);
    const pl = (p.MembershipTypeName || '(none)').trim(); f.plan[pl] = (f.plan[pl] || 0) + 1;
    const h = new Date(x).getUTCHours(); f.sendHourDenver[h] = (f.sendHourDenver[h] || 0) + 1;
  }
  const n = sample.length;
  const row = {
    block: k, name: names[k]?.subject || null, ch: list[0].ch, sent: list.length, first: list[0].at.slice(0, 10), last: list[list.length - 1].at.slice(0, 10), matchedToCourtReserve: Math.round((100 * matched) / n) + '%',
    medianHours: { checkinBefore: median(f.checkinBefore), nextEvent: median(f.nextEvent), sinceCreated: median(f.sinceCreated), sinceFirstDues: median(f.sinceFirstDues), sinceLastDues: median(f.sinceLastDues), sinceFreeClassEnd: median(f.sinceFreeClassEnd), untilFreeClass: median(f.untilFreeClass) },
    within26h: { checkinBefore: share(f.checkinBefore, (v) => v <= 26), nextEvent: share(f.nextEvent, (v) => v <= 26), created: share(f.sinceCreated, (v) => v <= 26), firstDues: share(f.sinceFirstDues, (v) => v <= 26), freeClassEnd: share(f.sinceFreeClassEnd, (v) => v <= 26), untilFreeClass: share(f.untilFreeClass, (v) => v <= 26) },
    noDuesFor45dPlus: share(f.sinceLastDues, (v) => v > 45 * 24), birthMonthMatch: share(f.birthMonthMatch, (v) => v === 1),
    topPlans: Object.entries(f.plan).sort((a, b) => b[1] - a[1]).slice(0, 4), topHours: Object.entries(f.sendHourDenver).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h, c]) => h + 'h:' + c),
  };
  out.push(row);
}
writeJson(join(PULLS, today, 'patch', 'triggers.json'), out);
for (const r of out) console.log([r.block.split('|').map((s) => s.slice(-6)).join('|'), r.ch, r.sent, r.first + '..' + r.last, 'match ' + r.matchedToCourtReserve, JSON.stringify(r.within26h), 'lapsed45d ' + r.noDuesFor45dPlus + '%', 'bday ' + r.birthMonthMatch + '%', 'med ' + JSON.stringify(r.medianHours), r.topHours.join(','), (r.name || '').slice(0, 50)].join(' | '));
