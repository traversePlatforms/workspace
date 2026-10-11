// The one-command builder for a market outside the hand-built Colorado towns (Matthew 2026-10-11).
//   node build-metro.mjs <metro> [town ...] [--from=<step>] [--only=<step>] [--dry]
// reads metros/<metro>.json (which towns, and where each county publishes its parcels) and runs every step that works there:
//   doors     owner-occupied single-family homes from the county's parcel service       metros/build-doors.mjs
//   areas     neighbourhoods of about 30 doors                                         build-walklist-pdf.mjs
//   values    the county's market value per door                                       metros/county-data.mjs --values
//   wildfire  USFS wildfire hazard, national                                           sample-wildfire.mjs
//   towns     the app's town files and index (every town, as always)                   build-rounds-data.mjs
//   years     year built and house size from the county                                metros/county-data.mjs --years
//   hail      NOAA radar hail per door since 2020, the metro's own storm list           hail/build-hail.mjs (HAIL_METRO)
//   wind      NWS storm wind reports within 10 miles, the metro's state                 wind/build-wind.mjs (WIND_METRO)
//   nri       FEMA National Risk Index by census tract                                  nri/build-nri.mjs (METRO)
//   census    Census ACS by block group                                                 census/build-census.mjs (METRO)
// Not yet for metros (each is Colorado-wired, listed in the summary as skipped): laser-scan roof size and pitch and solar
// (need a USGS survey that covers the town: none covers McKinney in the public copies, checked 2026-10-11), the aerial
// photo, building outline and roof material, lawn and trees, permits (city by city), crime (police data, city by city).
// Each step's output is logged in logs-metros/<metro>/<step>.log; a step that fails stops the run, and --from= picks it up.
// Nothing here uploads: the towns join an edition only when its company.json lists the metro's group in townGroups.
import { readFileSync, mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'; import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), opt = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
const metro = args[0]; if (!metro || metro.startsWith('--')) { console.log('usage: node build-metro.mjs <metro> [town ...] [--from=step] [--only=step] [--dry]'); process.exit(1); }
const M = JSON.parse(readFileSync(join(HERE, 'metros', metro + '.json'), 'utf8'));
const pick = args.slice(1).filter((a) => !a.startsWith('--')); const towns = pick.length ? M.towns.filter((t) => pick.includes(t.key)) : M.towns;
if (!towns.length) throw new Error('no such town in ' + metro);
const LOG = join(HERE, 'logs-metros', metro); mkdirSync(LOG, { recursive: true });
const STEPS = [
  ['doors', (t) => ['node', ['metros/build-doors.mjs', metro, t.key]], 'town'],
  ['areas', (t) => ['node', ['build-walklist-pdf.mjs', `${t.key}.csv`, '--no-pdf']], 'town'],
  ['values', (t) => ['node', ['metros/county-data.mjs', t.key, '--values']], 'town'],
  ['wildfire', () => ['node', ['sample-wildfire.mjs']], 'once'],
  ['towns', () => ['node', ['build-rounds-data.mjs']], 'once'],
  ['years', (t) => ['node', ['metros/county-data.mjs', t.key, '--years']], 'town'],
  ['hail', () => ['node', ['hail/build-hail.mjs', 'fetch', '2020-04-01', new Date().toISOString().slice(0, 10)], { HAIL_METRO: metro }], 'once'],
  ['hail-build', () => ['node', ['hail/build-hail.mjs', 'build'], { HAIL_METRO: metro }], 'once'],
  ['wind', () => ['node', ['wind/build-wind.mjs', 'all'], { WIND_METRO: metro }], 'once'],
  ['nri', () => ['node', ['nri/build-nri.mjs'], { METRO: metro }], 'once'],
  ['census', () => ['node', ['census/build-census.mjs', '--fetch'], { METRO: metro }], 'once'],
];
const SKIPPED = ['laser-scan roof size, pitch and solar (no public USGS survey reaches these towns yet)', 'aerial photo, building outline and roof material', 'lawn and trees', 'permits (city by city)', 'crime (police data, city by city)'];
const from = opt('from'), only = opt('only'), dry = args.includes('--dry');
let started = !from; const ran = [];
console.log(`${M.label}: ${towns.map((t) => t.label).join(', ')}`);
for (const [name, cmd, scope] of STEPS) {
  if (from && name === from) started = true;
  if (!started || (only && name !== only)) continue;
  const runs = scope === 'town' ? towns.map((t) => [name + ' ' + t.key, cmd(t)]) : [[name, cmd()]];
  for (const [label, [bin, argv, env]] of runs) {
    const cwd = argv[0].startsWith('hail/') || argv[0].startsWith('wind/') || argv[0].startsWith('nri/') || argv[0].startsWith('census/') ? join(HERE, argv[0].split('/')[0]) : HERE;
    const a = cwd === HERE ? argv : [argv[0].split('/').slice(1).join('/'), ...argv.slice(1)];
    const t0 = Date.now(); process.stdout.write(`  ${label.padEnd(18)} `);
    if (dry) { console.log(`(dry) ${bin} ${a.join(' ')}${env ? ' ' + JSON.stringify(env) : ''}`); continue; }
    const r = spawnSync(bin, a, { cwd, env: { ...process.env, ...(env || {}) }, encoding: 'utf8', maxBuffer: 1 << 28 });
    const out = (r.stdout || '') + (r.stderr || ''); writeFileSync(join(LOG, label.replace(/ /g, '-') + '.log'), out);
    const last = out.trim().split('\n').filter(Boolean).pop() || '';
    console.log(`${r.status === 0 ? 'ok  ' : 'FAIL'} ${((Date.now() - t0) / 1000).toFixed(0)} s  ${last.slice(0, 110)}`);
    ran.push({ step: label, ok: r.status === 0, seconds: Math.round((Date.now() - t0) / 1000), last: last.slice(0, 300) });
    if (r.status !== 0) { finish(false, label); process.exit(1); }
  }
}
finish(true);
function finish(ok, failed) {
  const summary = { metro, towns: towns.map((t) => t.key), at: new Date().toISOString(), ok, failed: failed || null, ran, skipped: SKIPPED };
  writeFileSync(join(LOG, 'last-run.json'), JSON.stringify(summary, null, 1));
  appendFileSync(join(LOG, 'runs.log'), `${summary.at} ${ok ? 'ok' : 'STOPPED at ' + failed} ${summary.towns.join(',')}\n`);
  console.log(ok ? `\ndone. Not built here yet: ${SKIPPED.join('; ')}.\nThe towns join an edition when its company.json lists "${M.group || M.key}" in townGroups.` : `\nstopped at ${failed}: see logs-metros/${metro}/${failed.replace(/ /g, '-')}.log, then rerun with --from=${failed.split(' ')[0]}`);
}
