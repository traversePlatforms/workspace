// Peak Pickleball pulls: shared helpers (23 Nov 2026). READ-ONLY by construction: the only network helpers here send GET.
// Data goes to matthew/clients/peak-pickleball/data/pulls/ (gitignored). Credentials are read from ~/.ssh and never printed.
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, readdirSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOLS = dirname(fileURLToPath(import.meta.url));
export const PULLS = join(TOOLS, '..', 'data', 'pulls');
export const STORE = join(PULLS, 'store');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const cred = (name) => JSON.parse(readFileSync(join(homedir(), '.ssh', name), 'utf8'));

// Peak is in Colorado: every "today" and month boundary is Mountain time.
export function denverDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export const ymd = (d) => d.toISOString().slice(0, 10);
// month windows [first, last] covering from..to (YYYY-MM-DD strings)
export function months(from, to) {
  const out = []; let y = +from.slice(0, 4), m = +from.slice(5, 7) - 1;
  for (;;) {
    const a = ymd(new Date(Date.UTC(y, m, 1))), b = ymd(new Date(Date.UTC(y, m + 1, 0)));
    if (a > to) break; out.push([a, b < to ? b : to, a.slice(0, 7)]); m++;
  }
  return out;
}
export function addDays(s, n) { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return ymd(d); }

export function writeAtomic(path, buf) { mkdirSync(dirname(path), { recursive: true }); const tmp = path + '.tmp'; writeFileSync(tmp, buf); renameSync(tmp, path); }
export const writeJson = (path, v) => writeAtomic(path, JSON.stringify(v, null, 1));
export const writeGz = (path, v) => writeAtomic(path, gzipSync(JSON.stringify(v)));
export const readGz = (path) => JSON.parse(gunzipSync(readFileSync(path)).toString('utf8'));
export function readStore(sub) { // every month file of one store series, concatenated
  const dir = join(STORE, sub); if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json.gz')).sort().flatMap((f) => readGz(join(dir, f)));
}

// GET with retry on 429/5xx. Returns { status, json, text }. No other HTTP method exists in this file.
export async function getJson(url, headers, { pace = 1100, tries = 5 } = {}) {
  let last = { status: 0, json: null, text: '' };
  for (let i = 0; i < tries; i++) {
    await sleep(pace);
    let r;
    try { r = await fetch(url, { method: 'GET', headers: { Accept: 'application/json', ...headers } }); }
    catch (e) { last = { status: 0, json: null, text: String(e) }; await sleep(3000 * (i + 1)); continue; }
    if (r.status === 429 || r.status >= 500) { last = { status: r.status, json: null, text: '' }; await sleep(1000 * (Number(r.headers.get('retry-after')) || 10 * (i + 1))); continue; }
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text };
  }
  return last;
}

// Personal data is dropped before anything is written. Ids (OrganizationMemberId, Patch contact id) are kept so people can be
// counted and followed over time without being named.
const PII_KEY = /^(First|Last|Middle|Full)?Name$|FirstName|LastName|FullName|(^|Member|Organization|Contact|Billing)Email(Address)?$|(^|Member|Organization|Contact|Billing)Phone(Number)?$|^Address|Address$|^City$|DateOfBirth|PinCode|Sso|MembershipNumber|MemberNumber|FamilyName|FamilyNumber|PartnersInfo|UserDefinedFields|Ratings|Instructors|InstructorNames|ScannedBy|CheckedinByName|ProfileImageUrl|ExternalId|^Description$|^Notes?$|Signature/i;
const KEEP_NAME = new Set(['EventName', 'EventCategoryName', 'MembershipName', 'MembershipTypeName', 'ItemName', 'FeeCategoryName', 'RevenueCategoryName', 'ReservationTypeName', 'TournamentName', 'DivisionName', 'AssignedCourtName', 'CourtLabels', 'OrganizationName', 'KioskName', 'TypeName', 'Name', 'Label', 'DisplayName', 'Category']);
const POSS_OK = /^(Valentine|Alzheimer|Women|Woman|Men|Man|Father|Mother|Mom|Dad|Pro|Kid|Kids|Peak|Children|Veteran|Patrick|Today|Year|Member|Player|Ladies|Girl|Boy|Senior)$/;
export function miscKind(t) {
  return /prepurch|annual/i.test(t) ? 'Misc. Fee: prepaid annual membership' + (/platinum/i.test(t) ? ' (Platinum)' : /unlimited/i.test(t) ? ' (Unlimited)' : /play/i.test(t) ? ' (Play)' : '') : /no.?show/i.test(t) ? 'Misc. Fee: no-show fee' : /name ?tag/i.test(t) ? 'Misc. Fee: name tag'
    : /credit|revers/i.test(t) ? 'Misc. Fee: credit adjustment' : /league/i.test(t) ? 'Misc. Fee: league' : /tournament|bowl/i.test(t) ? 'Misc. Fee: tournament' : t.trim() === '' ? 'Misc. Fee' : 'Misc. Fee: other (text removed)';
}
export function strip(v) {
  if (Array.isArray(v)) return v.map(strip);
  if (!v || typeof v !== 'object') return v;
  const o = {};
  for (const [k, x] of Object.entries(v)) {
    if (k === 'Players' && Array.isArray(x)) { o.PlayerIds = x.map((p) => p?.OrganizationMemberId ?? p?.OrgMemberId ?? null); continue; }
    if (k === 'DateOfBirth') { if (x) { o.BirthMonth = +String(x).slice(5, 7); const age = new Date().getUTCFullYear() - +String(x).slice(0, 4); o.AgeBand = age < 18 ? 'under 18' : age >= 70 ? '70+' : Math.floor(age / 10) * 10 + 's'; } continue; } // birth month + age decade only
    if (k === 'ZipCode') { o.Zip5 = x ? String(x).slice(0, 5) : null; continue; }
    if (!KEEP_NAME.has(k) && PII_KEY.test(k)) continue;
    o[k] = strip(x);
  }
  // "Member Hold" events are named after the member who holds the court ("Jane Doe's Group"): replace the name
  if (o.EventCategoryName === 'Member Hold' && 'EventName' in o) o.EventName = 'Member Hold group #' + (o.EventId ?? '');
  // the same names appear in check-in rows and sales item names, which carry no category: catch "<Name>'s [Social] Group" too
  const GROUP = /['\u2019]s\s+(\w+\s+)?(group|hold|crew)\b/i;
  for (const k of ['EventName', 'ItemName']) if (typeof o[k] === 'string' && GROUP.test(o[k])) o[k] = 'Member Hold group' + (o.EventId ? ' #' + o.EventId : '');
  // transactions/list "Category" is the item text, and staff type free notes into manual adjustments and lessons
  if (typeof o.Category === 'string') {
    if (/manual adjustment/i.test(o.Category)) o.Category = 'Manual Adjustment';
    else if (/^misc/i.test(o.Category)) o.Category = miscKind(o.Category);
    else if (/^(private lesson|semi-private)/i.test(o.Category)) o.Category = o.Category.split(/\s+-\s+/)[0].trim();
    else if (/^member hold/i.test(o.Category) && GROUP.test(o.Category)) o.Category = 'Member Hold - Member Hold group';
    if (/@/.test(o.Category) || o.Category.length > 120) o.Category = o.Category.split(/\s+-\s+/)[0].slice(0, 60) + ' (text removed)';
  }
  // first names used as possessives in event names ("Craig's League") become [name]'s; ordinary words are kept
  for (const k of ['EventName', 'ItemName', 'Category']) if (typeof o[k] === 'string') o[k] = o[k].replace(/\b([A-Z][a-z]+)(['\u2019]s)\b/g, (m, n, s) => (POSS_OK.test(n) ? m : '[name]' + s));
  // Misc. Fee item names are free text typed by staff and often name members: keep only what kind of fee it was
  if (/misc/i.test(o.FeeCategoryName || '') && typeof o.ItemName === 'string') o.ItemName = miscKind(o.ItemName);
  return o;
}
