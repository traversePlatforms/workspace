/* Step 1 of going live with the 22 Nov low-green re-measure (CLOUD-JOBS-2026-11-22.md), ONLY on Matthew's go. Laptop files only: it
   uploads nothing. Lays the copied-back readings (yard-v4/<key>.json, overnight/lawn1122/pull-lawn1122.sh) over yard-v2/<key>.json,
   door by door: a door in yard-v4 with a reading replaces the yard-v2 one; every other door is left as it is. The subset run's own
   "shared" marks are dropped (build-yard-v2.mjs works shared lots out again over the whole town). Each yard-v2 file it changes is
   copied first to %LOCALAPPDATA%/ProjectBackup/lawn1122-before/yard-v2/ (once: a second run keeps the first copy).
     node merge-yard-v4.mjs --dry     counts only
     node merge-yard-v4.mjs           merge
   Then: build-yard-v2.mjs, build-rounds-data.mjs, the editions build, and the uploads (CLOUD-JOBS-2026-11-22.md, Going live). */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), DRY = process.argv.includes('--dry');
const BK = join(process.env.LOCALAPPDATA || join(HERE, '..'), 'ProjectBackup', 'lawn1122-before', 'yard-v2');
if (!DRY) mkdirSync(BK, { recursive: true });
let keys = 0, doors = 0, changed = 0;
for (const f of readdirSync(join(HERE, 'yard-v4')).filter((f) => f.endsWith('.json') && f !== 'compare.json')) {
  const live = join(HERE, 'yard-v2', f); if (!existsSync(live)) { console.log(f + ': no yard-v2 file, left out'); continue; }
  const nw = JSON.parse(readFileSync(join(HERE, 'yard-v4', f), 'utf8')), old = JSON.parse(readFileSync(live, 'utf8'));
  let n = 0, c = 0;
  for (const [id, v] of Object.entries(nw.doors || {})) {
    if (!v || typeof v.l !== 'number' || !(id in old.doors)) continue;
    const w = { ...v }; delete w.shared; n++; if (!old.doors[id] || old.doors[id].l !== w.l) c++;
    old.doors[id] = w;
  }
  keys++; doors += n; changed += c;
  if (DRY || !n) continue;
  if (!existsSync(join(BK, f))) copyFileSync(live, join(BK, f));
  old.low1122 = { doors: n, settings: nw.settings };
  writeFileSync(live + '.tmp', JSON.stringify(old)); renameSync(live + '.tmp', live);
}
console.log(`${DRY ? '(dry) ' : ''}${keys} keys, ${doors} doors from yard-v4, ${changed} with a different lawn reading${DRY ? '' : '; backups in ' + BK}`);
