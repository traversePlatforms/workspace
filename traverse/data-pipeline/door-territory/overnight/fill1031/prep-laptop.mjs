/* Builds the folder the cloud machine gets as ~/run/fill1031 (2026-10-31): the queue and stage scripts beside this file, the town lists,
   and what each stage reads from the laptop (house lists, door lists, the merged roof / sun / tree caches, Douglas year and roof files,
   the newlidar survey map and code). Door lists and caches already live on the cloud machine for earlier runs; nothing here is
   published anywhere. House lists sent for yard v2 and outlines carry id, lat, lon only.
   Usage: node prep-laptop.mjs <lists folder> <out folder> [--stages=a,b]   (lists folder: the *-towns.txt files the audit step wrote)
   Then:  tar czf fill1031.tgz -C <out folder> .  and copy it to the cloud machine (README in the stage scripts).                 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const [, , LISTS, OUT] = process.argv;
const MAIN = 'C:/Users/Surge Inc/Desktop/claude test 2/traverse';
const DT = join(MAIN, 'data-pipeline', 'door-territory'), RD = join(MAIN, 'app', 'data', 'rounds'), ED = join(MAIN, 'editions', 'dist', 'traverse-data', 'rounds');
const TZW = join(HERE, '..', '..', 'tree-zones');   /* this checkout's tree-zones (carries the newlidar code) */
const STAGES = ['lawnfix', 'roofsolar', 'dougmat', 'newlidar', 'trees2', 'outlinefix', 'values'];
const mk = (d) => { mkdirSync(join(OUT, d), { recursive: true }); return join(OUT, d); };
const list = (n) => readFileSync(join(LISTS, n), 'utf8').split(/\s+/).filter(Boolean);
const doorFile = (t) => [join(RD, `${t}.json`), join(ED, `${t}.json`)].find(existsSync);
const slim = (t) => { const f = doorFile(t); if (!f) return null; const j = JSON.parse(readFileSync(f, 'utf8'));
  return JSON.stringify({ key: t, areas: [{ doors: j.areas.flatMap((a) => a.doors).filter((d) => typeof d.lat === 'number').map((d) => ({ id: d.id, lat: d.lat, lon: d.lon })) }] }); };
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(HERE)) if (/\.(sh|mjs)$/.test(f) && f !== 'prep-laptop.mjs') copyFileSync(join(HERE, f), join(OUT, f));
writeFileSync(join(OUT, 'stages.txt'), '# fill1031 stages, in order (queue.sh reads this again after every stage)\n' + STAGES.join('\n') + '\n');
for (const n of ['lawnfix-towns.txt', 'roofsolar-towns.txt', 'roofsolar-fixparcel.txt', 'trees2-towns.txt', 'newlidar-towns.txt', 'outlinefix-towns.txt']) copyFileSync(join(LISTS, n), join(OUT, n));
const dougmat = ['highlands-ranch', 'parker', 'castle-pines', 'castle-rock'];
writeFileSync(join(OUT, 'dougmat-towns.txt'), dougmat.join('\n') + '\n');
/* values: Group 1 and Group 3 towns (not the address-point counties, whose rows have no parcel number on the state layer) */
const idx = JSON.parse(readFileSync(join(ED, 'index.json'), 'utf8')).regions;
const B3 = new Set(['montrose', 'delta', 'lasanimas', 'alamosa', 'conejos', 'costilla', 'mineral', 'bent', 'saguache', 'washington', 'sedgwick']);
writeFileSync(join(OUT, 'values-towns.txt'), idx.filter((r) => /^g[13]-/.test(r.key) && !B3.has(r.county)).map((r) => `${r.key} ${r.county}`).join('\n') + '\n');
let n = 0;
/* lawnfix: house lists and the laptop's yard v2 files (the live ones) */
const ld = mk('lawnfix-data'), ly = mk('lawnfix-yard');
for (const t of list('lawnfix-towns.txt')) { const s = slim(t); if (!s) { console.log('no door file for', t); continue; } writeFileSync(join(ld, `${t}.json`), s); n++;
  const y = join(DT, 'lawn-trial', 'yard-v2', `${t}.json`); if (existsSync(y)) copyFileSync(y, join(ly, `${t}.json`)); }
console.log('lawnfix house lists:', n);
/* house lists for outline tiles and houses.mjs; door lists for the measuring scripts */
const dd = mk('doors'), ad = mk('areas'); let na = 0, nd = 0;
const measured = [...new Set([...list('roofsolar-towns.txt'), ...list('trees2-towns.txt'), ...list('newlidar-towns.txt'), ...list('outlinefix-towns.txt'), ...dougmat])];
for (const t of measured) { const s = slim(t); if (s) { writeFileSync(join(dd, `${t}.json`), s); nd++; }
  const a = join(DT, `${t}-areas.json`); if (existsSync(a)) { copyFileSync(a, join(ad, `${t}-areas.json`)); na++; } }
console.log('house lists:', nd, 'door lists:', na, 'of', measured.length, 'towns (the rest use the cloud machine\'s own)');
/* the merged caches */
const id = mk('in');
for (const [src, name] of [[join(DT, 'roofs', 'roof-cache.json'), 'roof-cache.json'], [join(DT, 'solar', 'solar-cache.json'), 'solar-cache.json'], [join(DT, 'tree-cache.json'), 'tree-cache.json']]) copyFileSync(src, join(id, name));
/* Douglas material: year and roof files, LiDAR house centres */
const di = mk('dougmat-in');
for (const t of dougmat) { for (const p of ['year', 'roof']) { const f = join(RD, `${p}-${t}.json`); if (existsSync(f)) copyFileSync(f, join(di, `${p}-${t}.json`)); }
  const h = join(DT, 'roofs', `houses-${t}.json`); if (existsSync(h)) copyFileSync(h, join(di, `houses-${t}.json`)); }
/* newlidar: the survey map and the three files that read it */
const cd = mk('code');
for (const f of ['lidar.mjs', 'town-surveys.mjs', 'sample-trees.mjs', 'lidar-surveys-extra.json']) copyFileSync(join(TZW, f), join(cd, f));
console.log('bundle ready in', OUT);
