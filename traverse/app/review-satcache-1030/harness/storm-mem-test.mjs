/* TR-37 (2026-10-31): the storm job's memory, old code (HEAD) against the one-town-at-a-time code, on Roofing's current data
   (editions/dist/traverse-data/rounds: 407 towns, 1,237,418 doors, 85 MB of hail files) with a stand-in NOAA archive.
     A  today's data; two new days: 10-29 = the 2023-06-22 storm (the biggest on record), 10-30 = another storm file
     B  A + an old minor storm day that the keep rule drops, so every town's hail file is opened (the 2027-04-22 case)
     C  B + a much larger history: six more kept storm days on EVERY door of every town (about 3.5x today's entries)
   Each run: php -d memory_limit=768M (the live limit), peak memory and time; old code is also run with room to spare to get the
   reference files, and the new code's files must equal them byte for byte. Door files are hard links to the dist copy (the job only
   reads them); every file the job or this test writes is a new file. node storm-mem-test.mjs [A|B|C ...] */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, copyFileSync, writeFileSync, readFileSync, readdirSync, existsSync, linkSync, unlinkSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const SP = 'C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/';
const S = SP + 'storm-mem/';
const SRC = 'C:/Users/Surge Inc/Desktop/claude test 2/traverse/editions/dist/traverse-data/rounds/';
const WT = 'C:/Users/Surge Inc/Desktop/claude test 2/.claude/worktrees/agent-a00ef635c1aa66ae6/traverse/app/';
const OLD = SP + 'ptest-satcache/base-satc/rounds.php', NEW = WT + 'api/rounds.php';
const CODES = SP + 'ptest-satcache/sixfold-private/rounds-codes.php';
const ARCH = 'http://127.0.0.1:8849';
const want = process.argv.slice(2).length ? process.argv.slice(2) : ['A', 'B', 'C'];
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; };
const idx = JSON.parse(readFileSync(SRC + 'index.json', 'utf8'));
const put = (f, s) => { if (existsSync(f)) unlinkSync(f); writeFileSync(f, s); };   /* never write through a hard link */
const md5 = (f) => createHash('md5').update(readFileSync(f)).digest('hex');

/* the stand-in archive: day D is in folder D+1 */
const A = S + 'archive/';
rmSync(A, { recursive: true, force: true });
const serve = (folder, file) => { const dir = A + folder + '/mrms/ncep/MESH_Max_1440min/'; mkdirSync(dir, { recursive: true });
  const name = 'MESH_Max_1440min_00.50_' + folder.replace(/\//g, '') + '-120000.grib2.gz'; copyFileSync(SP + 'meshtest/' + file, dir + name);
  writeFileSync(dir + 'index.html', `<a href="${name}">${name}</a>`); };
const hsSrc = JSON.parse(readFileSync(SRC + 'hail-storms.json', 'utf8'));
const ymd = (d) => d.toISOString().slice(0, 10);
const day1 = new Date(hsSrc.through + 'T12:00:00Z'); day1.setUTCDate(day1.getUTCDate() + 1);
const days = []; for (let d = new Date(day1); ymd(d) < new Date().toLocaleDateString('en-CA'); d.setUTCDate(d.getUTCDate() + 1)) days.push(ymd(d));
days.forEach((d, i) => { const f = new Date(d + 'T12:00:00Z'); f.setUTCDate(f.getUTCDate() + 1); serve(ymd(f).replace(/-/g, '/'), i === 0 ? 'big.grib2.gz' : 'storm.grib2.gz'); });
console.log(`archive: ${days.join(', ')} (first = the 2023-06-22 storm file)`);
const arch = spawn('php', ['-S', '127.0.0.1:8849', '-t', A], { stdio: 'ignore' });

function site(name, rounds, noLimit) {
  const dir = S + name + '/', D = dir + 'sixfold-data/rounds/';
  rmSync(dir, { recursive: true, force: true });
  for (const p of ['public_html/api', 'tools', 'sixfold-private', 'sixfold-data/rounds']) mkdirSync(dir + p, { recursive: true });
  for (const f of readdirSync(WT + 'api')) if (f.endsWith('.php')) copyFileSync(WT + 'api/' + f, dir + 'public_html/api/' + f);
  let code = readFileSync(rounds, 'utf8');
  if (noLimit) code = code.replace('@set_time_limit(120);', '@set_time_limit(0);');   /* the reference run only: room to finish */
  if (process.env.PROFILE) for (const [mark, lab] of [['    /* 1. the new days', 'doors packed'], ['    /* 2. the doors each day', 'days fetched'], ['    /* 3. each hail file', 'hits counted'], ['    if ($dropped) foreach ($dropped as $d) { unset', 'files written']])
    code = code.replace(mark, `    fwrite(STDERR, "${lab}: " . round(memory_get_usage() / 1048576) . " MB now, peak " . round(memory_get_peak_usage() / 1048576) . "\\n");\n` + mark);
  writeFileSync(dir + 'public_html/api/rounds.php', code);
  copyFileSync(WT + 'tools/storm-update.php', dir + 'tools/storm-update.php');
  copyFileSync(CODES, dir + 'sixfold-private/rounds-codes.php');
  for (const f of ['index.json', 'company.json', 'hail-storms.json', 'hail-paths.json']) copyFileSync(SRC + f, D + f);
  for (const r of idx.regions) {
    linkSync(SRC + r.key + '.json', D + r.key + '.json');
    if (existsSync(SRC + 'hail-' + r.key + '.json')) linkSync(SRC + 'hail-' + r.key + '.json', D + 'hail-' + r.key + '.json');
  }
  return { dir, D };
}
/* B: an old minor storm day on a few doors, which the keep rule drops: every town's file is opened */
const OLDDAY = '2023-08-15';
function prepB(D) {
  const hs = JSON.parse(readFileSync(D + 'hail-storms.json', 'utf8'));
  const towns = ['denver', 'aurora', 'monument'];
  hs.storms.push({ date: OLDDAY, max: 1.0, n1: 0, n34: 30, towns: Object.fromEntries(towns.map((k) => [k, { label: k, n1: 0, n34: 10, max: 1.0, areas: {} }])) });
  put(D + 'hail-storms.json', JSON.stringify(hs));
  for (const k of towns) {
    const h = JSON.parse(readFileSync(D + 'hail-' + k + '.json', 'utf8'));
    Object.keys(h.doors).slice(0, 10).forEach((id) => h.doors[id].push([OLDDAY, 1.0]));
    put(D + 'hail-' + k + '.json', JSON.stringify(h));
  }
}
/* C: six more kept storm days on every door of every town */
const SYN = ['2025-05-03', '2025-05-17', '2025-06-07', '2025-06-28', '2025-07-12', '2025-08-02'];
function prepC(D) {
  prepB(D);
  const hs = JSON.parse(readFileSync(D + 'hail-storms.json', 'utf8'));
  for (const d of SYN) if (!hs.storms.some((s) => s.date === d)) hs.storms.push({ date: d, max: 1.5, n1: 1, n34: 1, towns: {} });
  put(D + 'hail-storms.json', JSON.stringify(hs));
  let n = 0;
  for (const r of idx.regions) {
    const f = D + 'hail-' + r.key + '.json';
    const h = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : { doors: {} };
    if (Array.isArray(h.doors)) h.doors = {};
    const dd = JSON.parse(readFileSync(D + r.key + '.json', 'utf8'));
    for (const a of dd.areas || []) for (const x of a.doors || []) {
      const l = (h.doors[x.id] || []).filter((e) => !SYN.includes(e[0]));
      for (const d of SYN) l.push([d, 1.25]);
      l.sort((p, q) => (p[0] < q[0] ? 1 : -1)); h.doors[x.id] = l; n += SYN.length;
    }
    put(f, JSON.stringify(h));
  }
  return n;
}
function run(s, limit) {
  const r = spawnSync('php', ['-d', 'memory_limit=' + limit, S + 'memrun.php', s.dir.replace(/\/$/, '')], { env: { ...process.env, TRAVERSE_HAIL_ARCHIVE: ARCH }, encoding: 'utf8', timeout: 900000 });
  const m = /MEMRUN (\{.*\})/.exec(r.stderr || ''); const info = m ? JSON.parse(m[1]) : { fatal: 'no MEMRUN line: ' + (r.stderr || '').slice(0, 200) };
  info.out = (r.stdout || '').trim().slice(0, 300); info.err = (r.stderr || '').replace(/MEMRUN .*/, '').trim().slice(0, 300);
  return info;
}
const outFiles = (D) => readdirSync(D).filter((f) => /^hail-.*\.json$/.test(f) || f === 'storm-refresh.json').sort();
function same(a, b) {
  const fa = outFiles(a), fb = outFiles(b), diff = [];
  if (fa.join() !== fb.join()) diff.push('file lists differ: ' + fa.length + ' vs ' + fb.length);
  for (const f of fa) {
    if (!fb.includes(f)) continue;
    if (f === 'storm-refresh.json') { const x = JSON.parse(readFileSync(a + f, 'utf8')), y = JSON.parse(readFileSync(b + f, 'utf8')); delete x.at; delete y.at; if (JSON.stringify(x) !== JSON.stringify(y)) diff.push(f); continue; }
    if (statSync(a + f).size !== statSync(b + f).size || md5(a + f) !== md5(b + f)) diff.push(f);
  }
  return { n: fa.length, diff };
}
const changed = (D) => outFiles(D).filter((f) => f !== 'storm-refresh.json' && (!existsSync(SRC + f) || md5(D + f) !== md5(SRC + f))).length;
const fmt = (i) => `${i.fatal ? 'FAILED: ' + i.fatal.slice(0, 90) : 'ok'} · peak ${i.peakMB} MB · ${i.sec} s`;
const results = [];
try {
  for (let k = 0; k < 40; k++) { try { await fetch(ARCH + '/'); break; } catch { await new Promise((r) => setTimeout(r, 150)); } }
  for (const sc of want) {
    const prep = sc === 'A' ? () => 0 : sc === 'B' ? prepB : prepC;
    console.log(`\n== ${sc}`);
    const nw = site(sc + '-new', NEW); const extra = prep(nw.D);
    if (sc === 'C') console.log(`  synthetic history: ${extra.toLocaleString()} entries added (${SYN.length} kept days on each of ${idx.regions.length} towns' doors)`);
    const rn = run(nw, '768M'); console.log('  new code @768M: ' + fmt(rn) + (rn.out ? '\n    ' + rn.out : '') + (rn.err ? '\n    ' + rn.err.split('\n').join('\n    ') : ''));
    t(!rn.fatal && /hail through/.test(rn.out), `${sc}: the new code finishes under the live limit (peak ${rn.peakMB} MB of 768, ${rn.sec} s)`);
    t(rn.sec < 120, `${sc}: inside the job's own 120 s limit`);
    if (process.env.NEWONLY) { results.push({ sc, newPeak: rn.peakMB, newSec: rn.sec }); continue; }
    const od = site(sc + '-old', OLD); prep(od.D);
    const ro = run(od, '768M'); console.log('  old code @768M: ' + fmt(ro));
    const row = { sc, newPeak: rn.peakMB, newSec: rn.sec, oldPeak768: ro.peakMB, oldFatal768: ro.fatal ? ro.fatal.slice(0, 80) : null, oldSec768: ro.sec };
    if (sc !== 'C') {
      const rf = site(sc + '-ref', OLD, true); prep(rf.D);
      const rr = run(rf, '3500M'); console.log('  old code @3500M (reference): ' + fmt(rr) + (rr.out ? '\n    ' + rr.out : ''));
      Object.assign(row, { refPeak: rr.peakMB, refSec: rr.sec, refFatal: rr.fatal });
      t(!rr.fatal, `${sc}: reference run of the old code finished`);
      const cmp = same(rf.D, nw.D);
      row.files = cmp.n; row.diff = cmp.diff.length; row.changed = changed(nw.D);
      t(cmp.diff.length === 0, `${sc}: the new code's ${cmp.n} hail files + storm-refresh.json equal the old code's byte for byte (${row.changed} files changed by the run)` + (cmp.diff.length ? ': ' + cmp.diff.slice(0, 6).join(', ') : ''));
      rmSync(rf.dir, { recursive: true, force: true });
    } else {
      const hs = JSON.parse(readFileSync(nw.D + 'hail-storms.json', 'utf8'));
      const ds = hs.storms.map((s) => s.date);
      t(days.every((d) => ds.includes(d)) && SYN.every((d) => ds.includes(d)) && !ds.includes(OLDDAY), `C: new days in, synthetic kept days kept, the old minor day dropped (${ds.length} storm days)`);
      const den = JSON.parse(readFileSync(nw.D + 'hail-denver.json', 'utf8'));
      const ent = Object.values(den.doors).reduce((s, l) => s + l.length, 0);
      t(ent > 900000 && den.through === days[days.length - 1], `C: Denver's file now ${ent.toLocaleString()} entries, through ${den.through}`);
      row.denverEntries = ent;
    }
    results.push(row);
    rmSync(od.dir, { recursive: true, force: true }); if (!process.env.KEEP) rmSync(nw.dir, { recursive: true, force: true });
  }
} catch (e) { console.log('FAILED: ' + e.stack); fail++; }
finally { arch.kill(); }
writeFileSync(S + 'storm-mem-results.json', JSON.stringify({ at: new Date().toISOString(), days, results }, null, 1));
console.log(`\nstorm-mem-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
