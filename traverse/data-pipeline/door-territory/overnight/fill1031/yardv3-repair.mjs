// Stage yardv3fix's audit and repair (12 Nov 2026; Matthew 12 Nov: "repair and re-run those one at a time"; cloud-jobs review of
// 11-12 Nov, finding 1). Runs on the cloud machine from ~/run/lawn-trial:
//   node ~/run/fill1031/yardv3-repair.mjs --report     counts only, changes nothing
//   node ~/run/fill1031/yardv3-repair.mjs --prepare    makes the damaged towns ready to run again, writes ~/run/fill1031/yardv3fix-towns.txt
// Damage: before the 12 Nov fetchCell fix an empty or error answer from gis.colorado.gov was saved as a cell with no lots, so every door
// in it was written as null (no lot line). Per town key:
//   lost  = doors null in yard-v3 that had a reading in yard-v2;
//   bad cells = cells saved empty without the 12 Nov "map says 0" mark, and cells holding a lost door;
//   redo  = the lost doors and every null door in a bad cell.
// --prepare drops the bad cells from drcog-turf/parcels-<key>.json, the redo doors from yard-v3/<key>.json (both tmp + rename, a copy of
// each file first in ~/run/fill1031/vm-backup/yardv3fix/) and the key's .finished. Towns to run: those, plus any key not finished.
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, copyFileSync, unlinkSync } from 'node:fs';
const H = process.env.HOME, LT = H + '/run/lawn-trial', Q = H + '/run/fill1031', BK = Q + '/vm-backup/yardv3fix';
const PREP = process.argv.includes('--prepare');
const S = 0.008, isM = (v) => !!v && typeof v.l === 'number';
const rd = (f) => JSON.parse(readFileSync(f, 'utf8'));
const wr = (f, o) => { writeFileSync(f + '.tmp', JSON.stringify(o)); renameSync(f + '.tmp', f); };
const keep = (f) => { mkdirSync(BK, { recursive: true }); const b = BK + '/' + f.split('/').pop(); if (!existsSync(b)) copyFileSync(f, b); };
const keys = readFileSync(Q + '/yardv3-keys.txt', 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const towns = []; let totLost = 0, totRedo = 0, totBad = 0, unfinished = 0; const lines = [];
for (const k of keys) {
  const nf = `${LT}/yard-v3/${k}.json`, of = `${LT}/yard-v2/${k}.json`, pf = `${LT}/drcog-turf/parcels-${k}.json`, fin = `${LT}/yard-v3/${k}.finished`;
  const finished = existsSync(fin);
  if (!existsSync(nf)) { if (!finished) { towns.push(k); unfinished++; } continue; }
  const n = rd(nf), nd = n.doors || {}, od = existsSync(of) ? rd(of).doors || {} : {};
  const lost = new Set(Object.keys(nd).filter((id) => nd[id] === null && isM(od[id])));
  const pc = existsSync(pf) ? rd(pf) : null, bad = new Set(); let redo = new Set(lost);
  if (pc && pc.o) {
    const [la0, lo0] = pc.o, cellOf = (d) => Math.floor((d.lat - la0) / S) + ':' + Math.floor((d.lon - lo0) / S);
    for (const [c, v] of Object.entries(pc.cells || {})) if (!v.length && !(pc.zero && pc.zero[c])) bad.add(c);
    const doors = rd(`${LT}/data/${k}.json`).areas.flatMap((a) => a.doors).filter((d) => d.lat && d.lon);
    const cellById = new Map(doors.map((d) => [d.id, cellOf(d)]));
    for (const id of lost) if (cellById.has(id)) bad.add(cellById.get(id));
    redo = new Set([...lost, ...Object.keys(nd).filter((id) => nd[id] === null && bad.has(cellById.get(id)))]);
  }
  if (!redo.size && !bad.size) { if (!finished) { towns.push(k); unfinished++; } continue; }
  totLost += lost.size; totRedo += redo.size; totBad += bad.size;
  lines.push(`${k}${finished ? '' : ' (not finished)'}: ${lost.size} lost readings, ${redo.size} doors to measure again, ${bad.size} lot-line areas to fetch again`);
  if (redo.size) towns.push(k); else if (!finished) { towns.push(k); unfinished++; }
  if (PREP) {
    if (pc && bad.size) { keep(pf); for (const c of bad) delete pc.cells[c]; wr(pf, pc); }
    if (redo.size) { keep(nf); for (const id of redo) delete nd[id]; wr(nf, n); if (existsSync(fin)) unlinkSync(fin); }
  }
}
console.log(lines.join('\n'));
console.log(`${new Date().toISOString().slice(0, 16)}Z ${PREP ? 'prepared' : 'report'}: ${totLost} lost readings in ${lines.length} towns; ${totRedo} doors to measure again; ${totBad} lot-line areas to fetch again; ${unfinished} other keys not finished; towns to run: ${towns.length}`);
if (PREP) writeFileSync(Q + '/yardv3fix-towns.txt', towns.join('\n') + (towns.length ? '\n' : ''));
