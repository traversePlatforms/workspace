// Peak Pickleball: CourtReserve pull, READ-ONLY (GET only; Tyler's consent 4 Nov 2026, "as long as we arent changing anything").
// Nightly: re-pulls the previous month, this month and (for events) next month into the store, replacing those month files whole,
// so re-running is safe. Backfill: --from=2024-09-01 re-pulls every month from there.
// Also writes a dated snapshot (members without names, membership status counts, catalogs) to data/pulls/<date>/courtreserve/.
// Usage: node cr-pull.mjs [--from=YYYY-MM-DD] [--day=YYYY-MM-DD]
import { join } from 'node:path';
import { cred, denverDate, months, addDays, getJson, strip, writeGz, writeJson, PULLS, STORE } from './pull-lib.mjs';

const arg = (k) => (process.argv.find((a) => a.startsWith('--' + k + '=')) || '').split('=')[1];
const today = arg('day') || denverDate();
const c = cred('peak-courtreserve.json');
const H = { Authorization: 'Basic ' + Buffer.from(c.username + ':' + c.password).toString('base64') };
const prevMonthStart = (() => { const d = new Date(today.slice(0, 7) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); })();
const from = arg('from') || prevMonthStart;
const nextMonthEnd = (() => { const d = new Date(today.slice(0, 7) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 2); d.setUTCDate(0); return d.toISOString().slice(0, 10); })();
const snapDir = join(PULLS, today, 'courtreserve');
const manifest = { system: 'courtreserve', day: today, from, started: new Date().toISOString(), endpoints: {}, errors: [], notGranted: [] };

async function cr(path, params = {}) {
  const url = 'https://api.courtreserve.com' + path + '?' + new URLSearchParams(params);
  const r = await getJson(url, H);
  if (r.status === 401 || r.status === 403) return { denied: true };
  if (r.status !== 200 || !r.json || r.json.IsSuccessStatusCode === false) {
    return { error: `${r.status} ${path} ${JSON.stringify(params)} ${String(r.json?.ErrorMessage || r.text).slice(0, 140)}` };
  }
  return { data: r.json.Data };
}
const rowsOf = (d) => (Array.isArray(d) ? d : d?.DetailedRows ? d.DetailedRows : d ? [d] : []);

// ---- 1. month series into the store -------------------------------------------------------------------------------
// [store name, path, from-param, to-param, extra params, how far forward]
const SERIES = [
  ['sales', '/api/v1/transactions/salessummarydetailed', 'paymentStartDate', 'paymentEndDate', {}, 'today'],
  ['transactions', '/api/v1/transactions/list', 'transactionStartDate', 'transactionEndDate', {}, 'today'],
  ['eventreg-active', '/api/v1/eventregistrationreport/listactive', 'eventDateFrom', 'eventDateTo', { includeGuests: true }, 'next'],
  ['eventreg-cancelled', '/api/v1/eventregistrationreport/listcancelled', 'eventDateFrom', 'eventDateTo', {}, 'next'],
  ['eventreg-waitlist', '/api/v1/eventregistrationreport/listwaitlist', 'eventDateFrom', 'eventDateTo', {}, 'next'],
  ['eventlist', '/api/v1/eventcalendar/eventlist', 'startDate', 'endDate', { includeRegisteredPlayersCount: true, includePriceInfo: false, includeTags: true, status: 'All' }, 'next'],
  ['reservations-active', '/api/v1/reservationreport/listactive', 'reservationsFromDate', 'reservationsToDate', {}, 'next'],
  ['reservations-cancelled', '/api/v1/reservationreport/listcancelled', 'reservationsFromDate', 'reservationsToDate', {}, 'next'],
  ['checkins', '/api/v1/attendancereport/checkin', 'checkInStartDate', 'checkInEndDate', { includeCourtBooking: true, includeEvents: true }, 'today'],
  ['attendance', '/api/v1/attendancereport/detailed', 'attendedFrom', 'attendedTo', {}, 'today'],
];
for (const [name, path, f, t, extra, horizon] of SERIES) {
  const end = horizon === 'today' ? today : nextMonthEnd;
  let n = 0;
  for (const [a, b, ym] of months(from, end)) {
    const r = await cr(path, { [f]: a, [t]: b, ...extra });
    if (r.denied) { manifest.notGranted.push(path); break; }
    if (r.error) { manifest.errors.push(r.error); continue; } // keep last good month file
    const rows = strip(rowsOf(r.data));
    writeGz(join(STORE, 'courtreserve', name, ym + '.json.gz'), rows); n += rows.length;
  }
  manifest.endpoints[name] = n; console.log('cr', name, n);
}
// court utilisation: the API allows 7 days at a time; stored per month as the list of weekly results
{
  let n = 0;
  for (const [a, b, ym] of months(from, today)) {
    const weeks = [];
    for (let s = a; s <= b; s = addDays(s, 7)) {
      const e = addDays(s, 6) < b ? addDays(s, 6) : b;
      const r = await cr('/api/v1/reservationreport/courtutilization', { startDate: s, endDate: e });
      if (r.denied) { manifest.notGranted.push('courtutilization'); break; }
      if (r.error) { manifest.errors.push(r.error); weeks.length = 0; break; }
      weeks.push(strip(r.data));
    }
    if (weeks.length) { writeGz(join(STORE, 'courtreserve', 'courtutilization', ym + '.json.gz'), weeks); n += weeks.length; }
  }
  manifest.endpoints.courtutilization = n + ' weeks'; console.log('cr courtutilization', n, 'weeks');
}

// ---- 2. dated snapshot ---------------------------------------------------------------------------------------------
// members: every account, names/emails/phones/addresses/birth dates removed (birth month + age decade + 5-digit ZIP kept)
{
  let members = [], pages = 1;
  for (let p = 1; p <= pages; p++) {
    const r = await cr('/api/v1/member/get', { pageSize: 100, pageNumber: p, includeMarketingConsent: true, includeUserDefinedFields: true });
    if (r.denied) { manifest.notGranted.push('/api/v1/member/get'); break; }
    if (r.error) { manifest.errors.push(r.error); members = null; break; }
    pages = r.data.TotalPages || 1;
    // from the custom fields keep only two answers that name nobody: the "How did you hear about us?" dropdown, and whether
    // the "Referred By" box holds a referral (yes/no, never the name typed in)
    const udf = (m) => { const f = m.UserDefinedFields || []; const val = (re) => { const x = f.find((u) => re.test(u.Label || u.Name || '')); return x ? String(x.Value ?? '').trim() : ''; };
      const ref = val(/referred by/i); return { HeardAbout: val(/how did you hear/i) || null, Referred: ref ? !/^(none|no|n\/a|-)$/i.test(ref) : null, Partner: val(/^partner$/i) || null }; };
    const raw = r.data.Members || [];
    members = members.concat(strip(raw).map((m, i) => ({ ...m, ...udf(raw[i]), MarketingConsent: m.MarketingConsent ? { EmailOptedIn: m.MarketingConsent.EmailOptedIn, SmsOptedIn: m.MarketingConsent.SmsOptedIn, SmsAnswered: m.MarketingConsent.SmsAnswered } : null })));
  }
  if (members) {
    writeGz(join(snapDir, 'members.noname.json.gz'), members);
    const status = {};
    for (const m of members) { const k = (m.MembershipTypeName || '(none)').trim(); status[k] = status[k] || {}; status[k][m.MembershipStatus || '(none)'] = (status[k][m.MembershipStatus || '(none)'] || 0) + 1; }
    const consent = { accounts: members.length, emailOptedIn: members.filter((m) => m.MarketingConsent?.EmailOptedIn).length, smsOptedIn: members.filter((m) => m.MarketingConsent?.SmsOptedIn).length, unsubMarketingEmail: members.filter((m) => m.UnsubscribeFromMarketingEmails).length, linkedToPatch: members.filter((m) => m.PatchContactId).length };
    writeJson(join(snapDir, 'membership-status.json'), { day: today, byType: status, consent });
    manifest.endpoints.members = members.length; console.log('cr members', members.length);
  }
}
for (const [name, path, params] of [
  ['membershiptypes', '/api/v1/membershiptype/get'], ['event-categories', '/api/v1/eventcalendar/categories'], ['event-tags', '/api/v1/eventcalendar/tags'],
  ['courts', '/api/v1/reservation/courts'], ['reservation-types', '/api/v1/reservation/reservationtypes'], ['revenue-categories', '/api/v1/transactions/revenuecategories'],
  ['promocodes', '/api/v1/promocode/get'], ['member-custom-fields', '/api/v1/membercustomfield/get'], ['website-general', '/api/v1/websitesettings/general'],
  ['website-announcements', '/api/v1/websitesettings/announcements'], ['website-news', '/api/v1/websitesettings/news'], ['locations', '/api/v1/websitesettings/locations'],
  ['families', '/api/v1/family/get'], ['membershipreport', '/api/v1/membershipreport/list', { pageSize: 1, pageNumber: 1 }], ['leagues', '/api/v1/league/get', { pageSize: 100, pageNumber: 1, includeSessions: true }],
]) {
  const r = await cr(path, params || {});
  if (r.denied) { manifest.notGranted.push(path); continue; }
  if (r.error) { manifest.errors.push(r.error); continue; }
  const d = name === 'families' ? { count: rowsOf(r.data).length } : strip(r.data); // family names are surnames: count only
  writeJson(join(snapDir, name + '.json'), d); manifest.endpoints[name] = Array.isArray(d) ? d.length : 'saved';
}
// availability for the next 14 days (open court slots: the "quiet times" the ads would fill)
{
  const r = await cr('/api/v1/reservation/availability', { fromDate: today, toDate: addDays(today, 13) });
  if (r.error) manifest.errors.push(r.error); else if (!r.denied) { writeGz(join(snapDir, 'availability-next14.json.gz'), strip(r.data)); manifest.endpoints.availability = 'saved'; }
}

manifest.finished = new Date().toISOString();
writeJson(join(snapDir, 'manifest.json'), manifest);
console.log('cr done; errors', manifest.errors.length, 'not granted', manifest.notGranted.join(' ') || 'none');
if (manifest.errors.length) { for (const e of manifest.errors.slice(0, 10)) console.error('  !', e); process.exit(1); }
