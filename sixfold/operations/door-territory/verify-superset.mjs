/* The gate for shipping a door rebuild. Marks are keyed on door id. Three ways a
   rebuild can corrupt them, and all three are checked:

     1. LOST    an old id is gone           -> its marks orphan
     2. MOVED   an old id now names a DIFFERENT address -> marks attach to the wrong house
     3. RENAMED an old address now has a different id    -> its marks orphan

   (2) is the dangerous one: it fails silently and puts a "not now" or a
   "quote booked" on a stranger's door. A pure superset passes all three.
   ⚑ RUN THIS BEFORE EVERY UPLOAD OF REBUILT DOOR DATA. On 2026-10-01 it caught 101
   doors silently dropped by a parcel cap in build-walklist.mjs — and in doing so exposed
   that Monument and Black Forest had been truncated since they were first built.

   Usage:
     1. BEFORE rebuilding:  cp -r sixfold/site/data/rounds  <somewhere>/rounds-before
     2. rebuild (builders -> build-walklist-pdf.mjs -> build-rounds-data.mjs)
     3. node verify-superset.mjs <somewhere>/rounds-before
   Exits 1 if any existing door would corrupt its marks. Do not upload on a 1. */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SNAP = process.argv[2];
if (!SNAP) { console.error('usage: node verify-superset.mjs <snapshot-of-rounds-before>'); process.exit(2); }
const NOW = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'site', 'data', 'rounds');

const load = (dir, f) => {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  const byId = new Map(), byAddr = new Map();
  for (const a of j.areas) for (const d of a.doors) { byId.set(d.id, d.address); byAddr.set(d.address, d.id); }
  return { byId, byAddr };
};

/* ⚑ 2026-10-03 (review): the gate used to pass ("PURE SUPERSET … Safe to upload", exit 0) when it
   compared NOTHING: an empty snapshot folder, or `cp -r rounds rounds-before` landing in
   rounds-before/rounds/. It also never read index.json, so a town missing from the new index
   (gone from the app) could pass on an untouched old file. Both now fail. */
const snapFiles = readdirSync(SNAP).filter((x) => x.endsWith('.json') && !['index.json', 'money.json'].includes(x)).sort();
if (!snapFiles.length) { console.error(`\u2691 ${SNAP} holds no door files. Nothing was compared, so nothing is proven. DO NOT UPLOAD.`); process.exit(1); }
let idx;
try { idx = JSON.parse(readFileSync(join(NOW, 'index.json'), 'utf8')); } catch { console.error('\u2691 The new index.json is missing or unreadable. DO NOT UPLOAD.'); process.exit(1); }
const listed = new Set((idx.regions || []).map((r) => r.key));
const shared = idx.shared || {};

/* every door in the NEW set, all towns: a door that left one town for a partner town is a move,
   not a loss, as long as it kept its id and address (2026-10-03: one town per door) */
const everywhere = new Map();
for (const k of listed) { try { for (const [id, addr] of load(NOW, `${k}.json`).byId) everywhere.set(id, { k, addr }); } catch {} }

let bad = 0, totOld = 0, totNew = 0, toTown = 0;
console.log('town            before   after   added   LOST  MOVED  RENAMED  to-town');
for (const f of snapFiles) {
  const key = f.replace('.json', '');
  if (!listed.has(key)) { console.log(`${key.padEnd(15)} \u2691 in the snapshot but NOT in the new index.json: the whole town would vanish from the app`); bad++; continue; }
  const o = load(SNAP, f), n = load(NOW, f);
  let lost = 0, moved = 0, renamed = 0, went = 0;
  const examples = [];
  for (const [id, addr] of o.byId) {
    if (!n.byId.has(id)) {
      const e = everywhere.get(id);
      if (e && e.addr === addr && (shared[key] || []).includes(e.k)) { went++; continue; }   /* now in its partner town: the server reads its old rows there */
      lost++; if (examples.length < 3) examples.push(`LOST ${id} (${addr})`); continue;
    }
    if (n.byId.get(id) !== addr) { moved++; if (examples.length < 3) examples.push(`MOVED ${id}: "${addr}" -> "${n.byId.get(id)}"`); }
  }
  for (const [addr, id] of o.byAddr) {
    if (n.byAddr.has(addr) && n.byAddr.get(addr) !== id) { renamed++; if (examples.length < 3) examples.push(`RENAMED "${addr}": ${id} -> ${n.byAddr.get(addr)}`); }
  }
  totOld += o.byId.size; totNew += n.byId.size; toTown += went;
  const flag = lost + moved + renamed;
  bad += flag;
  console.log(`${key.padEnd(15)} ${String(o.byId.size).padStart(6)}  ${String(n.byId.size).padStart(6)}  ${String(n.byId.size - o.byId.size).padStart(6)}   ${String(lost).padStart(4)}  ${String(moved).padStart(5)}  ${String(renamed).padStart(7)}  ${String(went).padStart(7)}${flag ? '   <-- ' : ''}`);
  for (const e of examples) console.log('      ' + e);
}
if (totOld === 0) { console.error('\u2691 The snapshot files hold no doors. Nothing was compared. DO NOT UPLOAD.'); process.exit(1); }
console.log(`\nTOTAL           ${String(totOld).padStart(6)}  ${String(totNew).padStart(6)}  ${String(totNew - totOld).padStart(6)}`);
if (toTown) console.log(`\n${toTown} door(s) now belong to a partner town only (same id, same address). Their marks follow them: index.json "shared" tells the server where to read.`);
console.log(bad ? `\n\u2691 ${bad} PROBLEM(S): DOORS WOULD CORRUPT MARKS OR A TOWN WOULD VANISH \u2014 DO NOT UPLOAD` : '\nSAFE \u2014 every existing door kept its id and its address (in its own town or its partner). Safe to upload.');
process.exit(bad ? 1 : 0);
