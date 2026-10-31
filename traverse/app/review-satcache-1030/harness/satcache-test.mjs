/* TR-52: api/satcache.php against a stand-in Planetary Computer (satc-mock.php). Its own two servers (mock 8847, satcache 8848) and
   a throwaway cache folder, so it runs on any data and leaves nothing behind. node satcache-test.mjs */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync, statSync, utimesSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const DIR = 'C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/ptest-satcache';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const t = (ok, m) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + m); ok ? pass++ : fail++; };
const CACHE = mkdtempSync(join(tmpdir(), 'satc-')), MOCK = mkdtempSync(join(tmpdir(), 'satcm-'));
const env = { ...process.env, SATCACHE_DIR: CACHE, SATCACHE_UPSTREAM: 'http://127.0.0.1:8847', SATCACHE_CAP_MB: '1', SATCACHE_RL_MAX: '40', SATC_MOCK_DIR: MOCK };
const mock = spawn('php', ['-S', '127.0.0.1:8847', join(DIR, 'satc-mock.php')], { env, stdio: 'ignore' });
const srv = spawn('php', ['-d', 'memory_limit=768M', '-S', '127.0.0.1:8848', '-t', join(DIR, 'www')], { env, stdio: 'ignore' });
const B = 'http://127.0.0.1:8848/api/satcache.php';
const calls = () => (existsSync(join(MOCK, 'calls.log')) ? readFileSync(join(MOCK, 'calls.log'), 'utf8').trim().split('\n').filter(Boolean) : []);
const get = async (q) => { const r = await fetch(B + '?' + q); const b = Buffer.from(await r.arrayBuffer()); return { s: r.status, h: r.headers, b }; };
const tiles = () => { const out = []; const walk = (d) => { if (!existsSync(d)) return; for (const f of readdirSync(d)) { const p = join(d, f), st = statSync(p); if (st.isDirectory()) walk(p); else out.push({ p, size: st.size, m: st.mtimeMs }); } }; walk(join(CACHE, 't')); return out; };
const usage = () => JSON.parse(readFileSync(join(CACHE, 'usage.json'), 'utf8'));
const M = (y, x = 27310, z = 17) => `l=co2023&z=${z}&x=${x}&y=${y}`;
try {
  for (let i = 0; i < 60; i++) { try { await fetch(B); await fetch('http://127.0.0.1:8847/'); break; } catch { await sleep(150); } }

  console.log('Refused without fetching');
  const n0 = calls().length;
  for (const [q, code, why] of [['l=sc2023&z=17&x=27310&y=49744', 400, 'another state'], ['l=co1999&z=17&x=27310&y=49744', 400, 'a year outside 2010-2039'],
    ['i=wa_m_4712201_ne_10_060_20230601&z=17&x=27310&y=49744', 400, 'a photo outside Colorado'], ['i=../../etc/passwd&z=17&x=1&y=1', 400, 'a path'],
    ['l=co2023&z=11&x=420&y=777', 400, 'zoom 11'], ['l=co2023&z=20&x=1&y=1', 400, 'zoom 20'], ['l=co2023&z=17&x=131072&y=1', 400, 'x off the world'],
    ['l=co2023&z=17&x=36000&y=49744', 404, 'a tile outside Colorado'], ['l=co2023&z=17&x=27310', 400, 'no y'], ['l=co2023&i=co_m_3910417_nw_13_030_20230925_20240104&z=17&x=27310&y=49744', 400, 'both kinds']]) {
    const r = await get(q); t(r.s === code, `${why}: ${r.s}`);
  }
  t(calls().length === n0, 'none of them reached Planetary Computer');
  t((await fetch(B + '?' + M(49744), { method: 'POST' })).status === 405, 'POST refused');

  console.log('Miss, then hit');
  const a = await get(M(49744));
  t(a.s === 200 && a.h.get('x-satcache') === 'miss' && a.h.get('content-type') === 'image/png', 'first request: fetched (miss), image/png');
  t(/max-age=31536000/.test(a.h.get('cache-control') || '') && /immutable/.test(a.h.get('cache-control') || ''), 'a year-long, immutable browser cache header');
  const regs1 = calls().filter((c) => c.includes('/mosaic/register')).length;
  t(regs1 === 1, 'the server registered the statewide search once');
  await sleep(300);
  const b = await get(M(49744));
  t(b.s === 200 && b.h.get('x-satcache') === 'hit' && Buffer.compare(a.b, b.b) === 0, 'second request: from disk (hit), the same bytes');
  t(calls().filter((c) => /tiles\/WebMercatorQuad\/17\/27310\/49744/.test(c)).length === 1, 'Planetary Computer asked for that tile once');
  const it = await get('i=co_m_3910417_nw_13_030_20230925_20240104&z=17&x=27310&y=49744');
  await sleep(300);
  const it2 = await get('i=co_m_3910417_nw_13_030_20230925_20240104&z=17&x=27310&y=49744');
  t(it.h.get('x-satcache') === 'miss' && it2.h.get('x-satcache') === 'hit' && Buffer.compare(it.b, it2.b) === 0, 'one photo (lot preview): miss, then hit');
  t(calls().some((c) => /item\/tiles\/WebMercatorQuad\/17\/27310\/49744@1x\?collection=naip&assets=image&asset_bidx=image%7C1%2C2%2C3&format=png&item=co_m_3910417/.test(c)), 'the photo request upstream carries the page\'s own query and item');
  t(existsSync(join(CACHE, 't/m-co2023/17/27310/49744.png')) && existsSync(join(CACHE, 't/i-co_m_3910417_nw_13_030_20230925_20240104/17/27310/49744.png')), 'kept under the layer and the photo id, by z/x/y');
  t(!tiles().some((f) => /\.part$/.test(f.p)), 'no half-written file left');

  console.log('Several phones asking for the same new tile at once');
  const par = await Promise.all([0, 1, 2, 3, 4, 5].map(() => get(M(49745))));
  t(par.every((r) => r.s === 200 && Buffer.compare(r.b, par[0].b) === 0), 'all six get the same picture');
  t(!tiles().some((f) => /\.part$/.test(f.p)) && statSync(join(CACHE, 't/m-co2023/17/27310/49745.png')).size === par[0].b.length, 'one whole file on disk');

  console.log('No photo here (404)');
  const nf = await get(M(49999));
  t(nf.s === 404, 'Planetary Computer\'s 404 passes on as 404');
  const before404 = calls().length;
  const nf2 = await get(M(49999));
  t(nf2.s === 404 && calls().length === before404, 'remembered: the second ask does not go upstream');

  console.log('The kept id expires early (410)');
  const kept = JSON.parse(readFileSync(join(CACHE, 'mosaic-co2023.json'), 'utf8')).id;
  writeFileSync(join(MOCK, 'expired.txt'), kept + '\n');
  const ex = await get(M(49746));
  const now2 = JSON.parse(readFileSync(join(CACHE, 'mosaic-co2023.json'), 'utf8')).id;
  t(ex.s === 200 && ex.h.get('x-satcache') === 'miss' && now2 !== kept, `410 -> registered again (${calls().filter((c) => c.includes('/mosaic/register')).length} registers) and the tile still came`);

  console.log('Register down: the 9 Oct id');
  writeFileSync(join(MOCK, 'expired.txt'), now2 + '\n'); writeFileSync(join(MOCK, 'regdown'), '1');
  unlinkSync(join(CACHE, 'mosaic-co2023.json'));
  const fb = await get(M(49747));
  t(fb.s === 200 && calls().some((c) => c.includes('/mosaic/fe04cec383767467e9a31d04fab20050/tiles/WebMercatorQuad/17/27310/49747')), 'the tile came through SAT_FALLBACK');
  unlinkSync(join(MOCK, 'regdown'));

  console.log('Planetary Computer down');
  writeFileSync(join(MOCK, 'down'), '1');
  const dn = await get(M(49748));
  t(dn.s === 502 && /no-store/.test(dn.h.get('cache-control') || ''), 'new tile: 502, not cached by the browser');
  t(!existsSync(join(CACHE, 't/m-co2023/17/27310/49748.png')), 'nothing stored');
  const old = await get(M(49744));
  t(old.s === 200 && old.h.get('x-satcache') === 'hit', 'tiles already kept still serve');
  t(/upstream m-co2023 17\/27310\/49748: HTTP 500/.test(readFileSync(join(CACHE, 'satcache.log'), 'utf8')), 'the failure is in satcache.log');
  unlinkSync(join(MOCK, 'down'));

  console.log('Disk cap (1 MB in this test; tiles here are 200 KB): oldest-used first');
  /* age the tiles kept so far by an hour, one second apart; 49744 was read last, so it is made the newest of them */
  const kept1 = tiles().filter((f) => f.p.endsWith('.png'));
  const base = Date.now() / 1000 - 3600;
  kept1.forEach((f, i) => utimesSync(f.p, base + i, base + i));
  utimesSync(join(CACHE, 't/m-co2023/17/27310/49744.png'), base + 100, base + 100);
  const sizeBefore = usage().bytes;
  t(sizeBefore > 0 && sizeBefore === tiles().filter((f) => f.p.endsWith('.png')).reduce((s, f) => s + f.size, 0), `usage.json matches the disk (${(sizeBefore / 1048576).toFixed(2)} MB, ${usage().files} tiles)`);
  for (let y = 49750; y < 49754; y++) await get(M(y));
  await sleep(500);
  const after = tiles().filter((f) => f.p.endsWith('.png')), bytes = after.reduce((s, f) => s + f.size, 0);
  t(bytes <= 1048576 && after.length < kept1.length + 4, `under the cap after the clean-ups (${(bytes / 1048576).toFixed(2)} MB, ${after.length} tiles; each clean-up goes to 85%)`);
  t(usage().bytes === bytes && usage().files === after.length, 'usage.json recounted to the disk');
  t(existsSync(join(CACHE, 't/m-co2023/17/27310/49753.png')) && existsSync(join(CACHE, 't/m-co2023/17/27310/49752.png')), 'the newest tiles stay');
  t(!existsSync(join(CACHE, 't/m-co2023/17/27310/49745.png')), 'the oldest-used went first');
  t(/clean: \d+ of \d+ tiles removed/.test(readFileSync(join(CACHE, 'satcache.log'), 'utf8')), 'the clean-up is in satcache.log');

  console.log('A visitor fetching too much');
  let got429 = false, lastOk = 0; for (let y = 49800; y < 49850 && !got429; y++) { const r = await get(M(y)); if (r.s === 429) got429 = true; else if (r.s === 200) lastOk = y; }
  t(got429, 'more than the limit of new tiles in 5 minutes: 429');
  const h429 = await get(M(lastOk));
  t(h429.s === 200 && h429.h.get('x-satcache') === 'hit', 'tiles on disk are never limited');

  console.log('Numbers');
  const u = JSON.parse(execFileSync('php', [join(DIR, 'www/api/satcache.php'), 'usage'], { env, encoding: 'utf8' }));
  const day = Object.values(u.days)[0] || {};
  t(u.capMb === 1 && u.files > 0 && day.hit >= 5 && day.miss >= 8 && day.none >= 2 && day.error >= 1, `php satcache.php usage: ${u.mb} MB, ${u.files} tiles, today ${JSON.stringify(day)}`);
} catch (e) { console.log('FAILED: ' + e.message); fail++; }
finally {
  mock.kill(); srv.kill(); await sleep(800);
  for (const d of [CACHE, MOCK]) for (let i = 0; i < 20; i++) { try { rmSync(d, { recursive: true, force: true }); break; } catch { await sleep(200); } }
}
console.log(`\nsatcache-test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
