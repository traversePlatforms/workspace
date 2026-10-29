/* One-off, 2026-10-29: re-key owner-history.json from '<door id>' to '<town>|<door id>' (owner-names.mjs historyKey).
   Keyed by the id alone, the same street address in two towns shared one entry and every rebuild flagged both doors as a new
   owner (1,545 doors flagged on 28 Oct). Which town an entry belongs to comes from the door files the last build wrote (app/data/rounds):
     - id on exactly one town's list: the entry moves to that town's key. If its history shows the collision (an owner who comes
       back after a "sale", two sales the same day, or a last owner that is not this town's), it restarts clean: owner = this
       town's, no flag. A clean single sale is real history and is kept as it is;
     - id on two or more towns' lists: ambiguous, dropped, not guessed (each town starts fresh at the next build: no flag until a
       real change);
     - id on no list (the door left the lists): dropped.
   Prints counts only, never names. Writes owner-history.json in place (tmp + rename); refuses a file already migrated.
   Back up first: cp -p owner-history.json owner-history.json.before-ownerfix-<date>
   Run: node --max-old-space-size=8192 migrate-owner-history-2026-10-29.mjs [--dry]                                        */
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSale, historyKey, isHistoryKey } from './owner-names.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OWNERS = join(HERE, 'owner-history.json'), RD = join(HERE, '..', '..', 'app', 'data', 'rounds');
const DRY = process.argv.includes('--dry');
const hist = JSON.parse(readFileSync(OWNERS, 'utf8'));
if (Object.keys(hist).some(isHistoryKey)) { console.error('already migrated (keys carry a town): nothing done'); process.exit(1); }

const where = new Map();   /* id -> [[town, owner]] */
const idx = JSON.parse(readFileSync(join(RD, 'index.json'), 'utf8'));
for (const r of idx.regions) {
  const p = join(RD, r.key + '.json'); if (!existsSync(p)) { console.error('missing door file ' + r.key); process.exit(1); }
  for (const a of JSON.parse(readFileSync(p, 'utf8')).areas) for (const d of a.doors) (where.get(d.id) || where.set(d.id, []).get(d.id)).push([r.key, d.owner]);
}

const out = {}, c = { entries: 0, moved: 0, movedFlag: 0, restarted: 0, restartedFlag: 0, droppedMany: 0, droppedManyFlag: 0, droppedNone: 0, droppedNoneFlag: 0 };
for (const [id, h] of Object.entries(hist)) {
  c.entries++;
  const w = where.get(id) || [], flagged = !!h.since;
  if (w.length === 0) { c.droppedNone++; if (flagged) c.droppedNoneFlag++; continue; }
  if (w.length > 1) { c.droppedMany++; if (flagged) c.droppedManyFlag++; continue; }
  const [town, owner] = w[0];
  const names = [...(h.prev || []).map((p) => p.o), h.o];
  let comesBack = false;
  for (let i = 0; i < names.length && !comesBack; i++) for (let j = i + 2; j < names.length; j++) if (!isSale(names[i], names[j])) { comesBack = true; break; }
  const untils = (h.prev || []).map((p) => p.until), sameDay = new Set(untils).size < untils.length;
  if (comesBack || sameDay || isSale(h.o, owner)) {
    out[historyKey(town, id)] = { o: owner, since: null, seen: h.seen };
    c.restarted++; if (flagged) c.restartedFlag++;
  } else {
    out[historyKey(town, id)] = h;
    c.moved++; if (flagged) c.movedFlag++;
  }
}
console.log(JSON.stringify(c));
console.log(`kept ${Object.keys(out).length} entries; flags kept ${c.movedFlag}, cleared ${c.restartedFlag + c.droppedManyFlag + c.droppedNoneFlag}`);
if (DRY) { console.log('--dry: nothing written'); process.exit(0); }
writeFileSync(OWNERS + '.tmp', JSON.stringify(out), 'utf8'); renameSync(OWNERS + '.tmp', OWNERS);
console.log('owner-history.json written');
