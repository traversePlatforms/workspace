// node agg.cjs <jsonl...>: findings grouped by class across runs
const fs = require('fs');
const L = process.argv.slice(2).flatMap((f) => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse));
const by = {}; const add = (cls, key, r, extra) => { const k = cls + ' | ' + key; (by[k] = by[k] || { cls, key, runs: [], extra: new Set(), shots: [] }); by[k].runs.push(`${r.inst}/${r.role}/${r.vp}/${r.theme}`); if (extra) by[k].extra.add(extra); if (r.shot && by[k].shots.length < 3) by[k].shots.push(r.shot); };
for (const r of L) {
  const it = (r.screen ? r.screen + ' > ' : '') + (r.item || (r.kind === 'home' ? '(home)' : ''));
  if (r.kind === 'skipped' || r.kind === 'link' || r.kind === 'sublink' || r.kind === 'subskipped') continue;
  for (const e of r.errors || []) add('console', it, r, e.replace(/http:\/\/127\.0\.0\.1:88\d7/g, '').slice(0, 160));
  for (const f of r.fails || []) add('failed-request', it, r, f);
  if ((r.overflow || []).length) add('overflow', it, r, r.overflow.slice(0, 2).join(' ; '));
  if ((r.clipped || []).length) add('clipped', it, r, r.clipped.slice(0, 2).join(' ; '));
  if ((r.white || []).length) add('white-in-dark', it, r, r.white.slice(0, 2).join(' ; '));
  if ((r.lowContrast || []).length) add('low-contrast', it, r, r.lowContrast.slice(0, 2).join(' ; '));
  if (r.covered) add('covered', it, r, r.covered);
  if (r.noop) add('no-op', it, r, r.title);
  if (r.found === false) add('not-found', it, r);
  if (r.back && r.back.landed !== 'home' && r.kind === 'item') add('back-not-home', it, r, 'label "' + r.back.label + '" landed ' + r.back.landed);
  if (r.back && r.kind === 'sub' && r.back.ok === false) add('sub-back-wrong', it, r, 'landed ' + r.back.landed);
  if (r.kind === 'item' && !r.home && r.viewText < 30 && !r.media) add('blank', it, r, 'text ' + r.viewText);
  if (r.kind === 'item' && r.scrollY > 40 && !r.home) add('opens-scrolled', it, r, 'scrollY ' + r.scrollY);
  if (r.inst !== 'sixfold') {
    for (const w of r.doorWords || []) add('door-word', it, r, w.trim());
    for (const w of r.sixWords || []) add('sixfold-word', it, r, w.trim());
    for (const w of r.routeWords || []) add('route-word', it, r, w.trim());
    if (r.inst !== 'yards') for (const w of r.lawnWords || []) add('lawn-word', it, r, w.trim());
    if (!/billing/i.test(it)) for (const w of r.travWords || []) add('traverse-word', it, r, w.trim());
  }
  if (r.kind === 'item' && (r.first > 3000 || r.first < 0)) add('slow', it, r, 'first paint ' + r.first + ' ms');
}
const want = process.env.CLS ? new RegExp(process.env.CLS) : null;
for (const v of Object.values(by).sort((a, b) => a.cls.localeCompare(b.cls) || b.runs.length - a.runs.length)) {
  if (want && !want.test(v.cls)) continue;
  const insts = [...new Set(v.runs.map((x) => x.split('/')[0]))].join(',');
  const roles = [...new Set(v.runs.map((x) => x.split('/')[1]))].join(',');
  const vps = [...new Set(v.runs.map((x) => x.split('/')[2] + '/' + x.split('/')[3]))].join(',');
  console.log(`[${v.cls}] ${v.key}  x${v.runs.length}  {${insts}} {${roles}} {${vps}}\n     ${[...v.extra].slice(0, 3).join(' || ').slice(0, 400)}${v.shots.length ? '\n     shot ' + v.shots[0] : ''}`);
}
