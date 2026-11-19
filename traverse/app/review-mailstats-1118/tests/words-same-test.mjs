/* The built-in words are the old words, to the byte (2026-11-18, Sixfold email opens, clicks and words).
   rounds.php's four customer emails (aftercare, the 2-day follow-up, the deposit reminder, the signed copy) now take their words from
   a365WordsDefs(). With nothing saved, every email must be exactly what the code before the change built. This builds ~60 made-up emails
   (names with apostrophes, accents and <tags>; balances with and without pay links; card on file; every package; fresh and old jobs; crew
   notes; both reminder kinds; the logo header on and off) with the committed code (git HEAD, its builders lifted out as they were) and with
   the working copy, in two throwaway installs, and compares subject, text and HTML. Sends nothing (builders only).
     node traverse/app/review-mailstats-1118/tests/words-same-test.mjs [git ref, default HEAD] */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
const HERE = dirname(fileURLToPath(import.meta.url)), APP = join(HERE, '..', '..'), REPO = join(APP, '..', '..');
const REF = process.argv[2] || 'HEAD';
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; return ok; };
const TMP = mkdtempSync(join(tmpdir(), 'words-same-'));
function oldSource() {
  let s = execFileSync('git', ['show', REF + ':traverse/app/api/rounds.php'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (s.includes('function aftercareBuild(')) return s;   /* already the new code: nothing to lift */
  const cut = (from, to) => { const a = s.indexOf(from), b = s.indexOf(to, a); if (a < 0 || b < 0) throw new Error('old code: no ' + from.slice(0, 50)); return s.slice(a, b); };
  const af = cut("    $co = company()['a365']; $name = (string) ($co['name'] ?? (kitOn() ? company()['name'] : '365 Aeration & Seeding')); $ph = a365Phone($l);\n    $first = ucfirst(strtolower((string) (preg_split('/\\s+/', trim((string) ($l['name'] ?? '')))[0] ?? '')));\n    $owed = jobOwedNow($j);", "    return $rec(a365Mail($to, 'Your lawn after today: a few tips from ' . $name, $text, $html));");
  const sgStart = s.indexOf('function a365SendSigned(');
  const sa = s.indexOf("    $co = company()['a365'];", sgStart), sb = s.indexOf("    $r = a365Mail($to, 'Your signed agreement with ' . $name, $text, $html);", sa);
  if (sgStart < 0 || sa < 0 || sb < 0) throw new Error('old code: no signed copy');
  const sg = s.slice(sa, sb);
  return s + "\nfunction aftercareBuild(array $j, array $l): array {\n" + af + "    return ['Your lawn after today: a few tips from ' . $name, $text, $html];\n}\n"
           + "function a365SignedBuild(array $l, array $sg): array {\n" + sg + "    return ['Your signed agreement with ' . $name, $text, $html];\n}\n";
}
function install(name, src, emails2) {
  const T = join(TMP, name), API = join(T, 'www', 'api'), D = join(T, 'sixfold-data', 'rounds'), P = join(T, 'sixfold-private');
  for (const d of [API, D, P, join(T, 'sixfold-data', 'leads')]) mkdirSync(d, { recursive: true });
  for (const f of readdirSync(join(APP, 'api'))) if (f.endsWith('.php') && f !== 'rounds.php') cpSync(join(APP, 'api', f), join(API, f));   /* the libraries it loads beside it (unchanged by this work) */
  writeFileSync(join(API, 'rounds.php'), src);
  writeFileSync(join(D, 'company.json'), JSON.stringify({ name: 'Sixfold 365', short: 'Sixfold', phone: '(555) 010-0100', email: 'office@example.com', features: { walkdesk: true, crew: true }, best: null,
    links: { googleReview: 'https://g.page/r/TESTREVIEW123/review' }, a365: { name: 'Sixfold 365', phone: '(555) 010-0199', web: '365aeration.com', base: [39.6537, -104.9919], radius: 45 } }));
  writeFileSync(join(D, 'index.json'), '{"regions":[]}');
  writeFileSync(join(D, 'emails2.json'), JSON.stringify({ on: emails2, from: 0 }));
  writeFileSync(join(D, 'newsletter.json'), JSON.stringify({ issues: [], address: '333 Test Ave, Englewood, CO 80110' }));
  writeFileSync(join(P, 'rounds-codes.php'), "<?php\nreturn ['session_key' => '" + 'ab'.repeat(32) + "', 'session_days' => 45, 'people' => ['583921' => ['Pat Admin', 'admin']]];\n");
  return join(API, 'rounds.php');
}
const day = (n) => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); };
const NAMES = ['Alex Sample', '', "dan o'brien", 'MARÍA José Núñez', '<b>Bob</b> & Co', 'Kim'];
const fx = []; let i = 0;
const lead = (extra = {}) => ({ id: 'w2026111800000' + String(i).padStart(1, '0') + 'abc' + String(100 + i).slice(-3), name: NAMES[i % NAMES.length], email: 'x' + i + '@example.com', ...extra });
for (const [pkg, pay, price, sqlink, extra] of [
  ['full', { s: 'deposit', amt: 150 }, 400, { amt: 250, url: 'https://square.link/u/AbC123?x=1&y=2' }, {}],
  ['aerate', { s: 'paid' }, 300, null, {}],
  ['seed', { s: 'unpaid' }, 300, null, {}],
  ['seedfert', { s: 'paid' }, 450, null, { sqcharge: { amt: 250, brand: 'Visa', last4: '4242' } }],
  ['seedfert', { s: 'deposit', amt: 100 }, 350, { amt: 250, url: 'https://square.link/u/Card1' }, { sqcharge: { amt: 250, brand: '', last4: '0005' } }],
  ['fert', { s: 'deposit', amt: 50 }, 200, { amt: 100, url: 'https://square.link/u/Wrong' }, {}],
  ['full', { s: 'unpaid' }, 500, { amt: 400, url: 'https://square.link/u/Cash' }, { done: { o: 'done', at: Math.floor(Date.now() / 1000) - 86400, collected: 100 } }],
  ['plan', { s: 'plan' }, 74, null, {}],
  ['full', { s: 'paid' }, 499, null, {}],
]) for (const crew of ['Brad Smith', "O'Neil"]) for (const fresh of [true, false]) {
  i++;
  const l = lead(i % 3 === 0 ? { fphone: '(555) 010-0222' } : {});
  const j = { id: 'j' + i, lead: l.id, title: l.name, date: day(fresh ? -2 : -30), crew, price, pkg, pay, off: false, done: { o: 'done', at: Math.floor(Date.now() / 1000) - (fresh ? 2 : 30) * 86400 }, ...(sqlink ? { sqlink } : {}), ...extra };
  if (i % 4 === 1) { j.fuWant = "Edging along the walk & the drive's edge"; j.fuSuggest = 'Overseed in spring.\nAnd <maybe> trim.'; } else if (i % 4 === 2) j.fuWant = 'A quote for leaves';
  if (crew === 'Brad Smith') fx.push({ name: 'aftercare ' + i + ' ' + pkg, kind: 'aftercare', j, l });
  fx.push({ name: 'followup ' + i + ' ' + pkg + (fresh ? ' fresh' : ' old'), kind: 'followup', j, l });
}
for (const dk of ['d1', 'd2']) for (const slot of ['s1', 's2', 's3', 's4', 't1030']) for (const dep of [150, 99]) {
  i++; const l = lead({ quote: { offer: { date: day(7), slot } }, sign: { deposit: dep, key: 'k' + i, how: 'link' } });
  fx.push({ name: 'deposit ' + dk + ' ' + slot + ' ' + dep, kind: 'deposit', dk, l });
}
for (let k = 0; k < 6; k++) {
  i++; const l = lead({ sign: { key: 'key' + i } });
  fx.push({ name: 'signed ' + k, kind: 'signed', l, sg: { name: l.name || 'A Signer', at: 1795000000 + k * 3600, facts: [['Customer', l.name], ['Price', '$' + (300 + k)], ["Crew's note", 'Gate code & "dog"']], terms: ["We'll come back if it doesn't take.", 'Pay <the rest> when done.'] } });
}
const FX = join(TMP, 'fixtures.json'); writeFileSync(FX, JSON.stringify(fx));
const run = (api) => { const out = execFileSync('php', ['-d', 'memory_limit=768M', join(HERE, 'mt-cli.php'), api, 'build', FX], { encoding: 'utf8', maxBuffer: 64 << 20 }); try { return JSON.parse(out); } catch { throw new Error('bad output: ' + out.slice(0, 400)); } };
try {
  const oldSrc = oldSource(); const newSrc = (await import('node:fs')).readFileSync(join(APP, 'api', 'rounds.php'), 'utf8');
  t(!oldSrc.includes('a365WordsDefs') && newSrc.includes('a365WordsDefs'), 'the old code (' + REF + ') is the code before the change, the working copy has the words');
  for (const e2 of [true, false]) {
    const a = run(install('old-' + e2, oldSrc, e2)), b = run(install('new-' + e2, newSrc, e2));
    t(a.length === fx.length && b.length === fx.length, 'emails2 ' + (e2 ? 'on' : 'off') + ': ' + fx.length + ' emails built by both');
    let same = 0; const diffs = [];
    for (let k = 0; k < a.length; k++) { const ok = a[k].subject === b[k].subject && a[k].text === b[k].text && a[k].html === b[k].html; if (ok) same++; else diffs.push(a[k].name); }
    t(same === a.length, 'emails2 ' + (e2 ? 'on' : 'off') + ': ' + same + ' of ' + a.length + ' identical to the byte (subject, text and HTML)' + (diffs.length ? ': differ ' + diffs.slice(0, 6).join('; ') : ''));
    if (diffs.length) { const k = a.findIndex((x) => x.name === diffs[0]); for (const f of ['subject', 'text', 'html']) if (a[k][f] !== b[k][f]) { let p = 0; while (a[k][f][p] === b[k][f][p]) p++; console.log('    ' + f + ' old: ' + JSON.stringify(a[k][f].slice(Math.max(0, p - 60), p + 80)) + '\n    ' + f + ' new: ' + JSON.stringify(b[k][f].slice(Math.max(0, p - 60), p + 80))); } }
    const kinds = new Set(a.map((x) => x.name.split(' ')[0])); t(kinds.size === 4, 'all four emails covered: ' + [...kinds].join(', '));
    t(b.every((x) => !/\/m\/\?[co]=/.test(x.html + x.text)), 'a built email (preview, test) carries no tracked link or open image');
  }
} catch (e) { t(false, 'ran: ' + e.message); }
rmSync(TMP, { recursive: true, force: true });
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
