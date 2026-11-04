// Peak Pickleball: pull a year of CourtReserve data, READ-ONLY (GET only; Tyler's consent, 4 Nov 2026). Saves raw JSON under
// data/courtreserve-api/<today>/ (gitignored). Paced at about 1 request every 1.2 s (the API allows 60 a minute).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const cred = JSON.parse(readFileSync(join(homedir(), '.ssh', 'peak-courtreserve.json'), 'utf8'));
const auth = 'Basic ' + Buffer.from(cred.username + ':' + cred.password).toString('base64');
const dir = join(here, '..', 'data', 'courtreserve-api', new Date().toISOString().slice(0, 10)); mkdirSync(dir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path, params) {
  const url = 'https://api.courtreserve.com' + path + '?' + new URLSearchParams(params);
  for (let i = 0; i < 5; i++) {
    await sleep(1200);
    const r = await fetch(url, { method: 'GET', headers: { Authorization: auth, Accept: 'application/json' } });
    if (r.status === 429) { await sleep(1000 * (Number(r.headers.get('retry-after')) || 10)); continue; }
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    if (r.status !== 200 || !j) { console.log('  !', r.status, path, JSON.stringify(params), t.slice(0, 160)); return null; }
    if (j.IsSuccessStatusCode === false) console.log('  ! not ok', path, JSON.stringify(params), String(j.ErrorMessage).slice(0, 160));
    return j;
  }
  return null;
}
// names, emails, phones and member numbers are dropped before anything is written (4 Nov: only ids and counts are kept)
const PII = ['FirstName', 'LastName', 'Email', 'Phone', 'PartnersInfo', 'UserDefinedFields', 'MemberUserDefinedFields', 'Ratings', 'Players', 'ReservationPinCode', 'SsoUrl', 'Instructors', 'InstructorsInfo', 'PublicBookingId', 'MemberFullName', 'FamilyName', 'MembershipNumber', 'InstructorNames'];
const strip = (v) => Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !PII.includes(k)).map(([k, x]) => [k, strip(x)])) : v;
const save = (name, data) => { data = strip(data); writeFileSync(join(dir, name + '.noname.json'), JSON.stringify(data)); console.log(name, Array.isArray(data) ? data.length + ' rows' : ''); };
// month windows, 1 Nov 2025 .. 31 Oct 2026 (the API caps most ranges at 31 days)
const months = []; for (let m = 0; m < 12; m++) { const a = new Date(Date.UTC(2025, 10 + m, 1)); const b = new Date(Date.UTC(2025, 11 + m, 0)); months.push([a.toISOString().slice(0, 10), b.toISOString().slice(0, 10)]); }

// 1. membership report: every membership type except the 13,755 free Peak Drop In accounts
const types = (JSON.parse(readFileSync(join(dir, 'membershiptype-get.json'), 'utf8')).Data || []).filter((t) => !/drop in/i.test(t.Name)).map((t) => t.Id);
let rows = [];
for (let p = 1; p < 200; p++) { const j = await get('/api/v1/membershipreport/list', { membershipTypeIds: types.join(','), pageSize: 500, pageNumber: p }); const d = j?.Data; const list = Array.isArray(d) ? d : d?.Records || d?.Items || []; rows = rows.concat(list); if (list.length < 500) break; }
save('membershipreport', rows);

// 2. per month: event registrations (active + cancelled + waitlist), sales summary, cancelled court reservations
for (const [k, path, f, t, extra] of [
  ['eventreg-active', '/api/v1/eventregistrationreport/listactive', 'eventDateFrom', 'eventDateTo', { includeGuests: true }],
  ['eventreg-cancelled', '/api/v1/eventregistrationreport/listcancelled', 'eventDateFrom', 'eventDateTo', {}],
  ['eventreg-waitlist', '/api/v1/eventregistrationreport/listwaitlist', 'eventDateFrom', 'eventDateTo', {}],
  ['sales-summary', '/api/v1/transactions/salessummarydetailed', 'paymentStartDate', 'paymentEndDate', {}],
  ['reservations-cancelled', '/api/v1/reservationreport/listcancelled', 'reservationsFromDate', 'reservationsToDate', {}],
]) {
  let all = [];
  for (const [a, b] of months) { const j = await get(path, { [f]: a, [t]: b, ...extra }); const d = j?.Data; all = all.concat(Array.isArray(d) ? d : d ? [d] : []); }
  save(k, all);
}
// 3. the event list with registered counts and prices
let ev = [];
for (const [a, b] of months) { const j = await get('/api/v1/eventcalendar/eventlist', { startDate: a, endDate: b, includeRegisteredPlayersCount: true, includePriceInfo: true, includeTags: true, status: 'All' }); const d = j?.Data; ev = ev.concat(Array.isArray(d) ? d : []); }
save('eventlist', ev);
console.log('done');
