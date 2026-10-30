#!/usr/bin/env python3
"""Hail backfill, the live side (2026-10-29; ../BACKFILL-HAIL-2026-10-29.md). Runs ON THE SERVER in an edition's rounds folder, once,
before push-edition.sh sends the new towns' hail files.

Why it exists: the server's storm job (api/rounds.php stormRefresh) owns hail-storms.json and hail-paths.json and, whenever a storm day
passes the keep rule, filters EVERY town's hail-<town>.json down to the days still in hail-storms.json. A backfilled storm day that is
not in hail-storms.json would be wiped from the doors at the next such drop. So the backfilled days and towns are added to the storm
list here, under the storm job's own lock, never replacing what the server wrote:
  - hail-storms.json: a backfill day the list lacks is added whole; on a day it has, a town it lacks is added, and a town whose
    backfill count is higher (doors added to the town since the first build) takes the backfill's figures; the day's max, n1, n34
    are worked out again from its towns. "through", "from", "days", "keep" stay the server's. Nothing is dropped.
  - hail-paths.json: the hail map's squares for each added day, and the missing squares on days it has (moved onto its r0/c0).
  - hail-<town>.json for towns the server already has a file for: each door's storms joined (a day the door lacks is added; a day it
    has is left as the server wrote it); only days in the merged storm list. Towns with no file are left to push-edition.sh.
A backup of every file it changes goes to ~/upload-backups/before-hailfill-<time>.tgz first.

  python3 merge-storms.py <rounds dir> <backfill dir> [--dry]
  <backfill dir>: hail-storms-backfill.json, hail-paths-add.json and hail-<town>.json for the towns to join (backfill-hail.mjs build)
Prints counts only (no addresses, no names)."""
import fcntl, json, os, sys, tarfile, time

rd, bd = sys.argv[1], sys.argv[2]
dry = '--dry' in sys.argv
J = lambda p: json.load(open(p, encoding='utf-8'))

def write(path, obj):
    tmp = path + '.tmp-hailfill'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(json.dumps(obj, separators=(',', ':'), ensure_ascii=False))
    os.chmod(tmp, os.stat(path).st_mode & 0o777 if os.path.exists(path) else 0o644)
    os.replace(tmp, path)

lockf = open(os.path.join(rd, 'storm-refresh.json.lock'), 'a')
for _ in range(60):   # the storm job holds it for at most ~2 minutes
    try:
        fcntl.flock(lockf, fcntl.LOCK_EX | fcntl.LOCK_NB); break
    except BlockingIOError:
        time.sleep(5)
else:
    sys.exit('storm job busy for 5 minutes: not merged')

sf, pf = os.path.join(rd, 'hail-storms.json'), os.path.join(rd, 'hail-paths.json')
hs, bs = J(sf), J(os.path.join(bd, 'hail-storms-backfill.json'))
through = hs.get('through') or ''
storms = {s['date']: s for s in hs.get('storms', [])}
added_days, towns_added, towns_raised = [], 0, 0
for b in bs['storms']:
    d = b['date']
    if d > through: continue
    if d not in storms:
        storms[d] = b; added_days.append(d); continue
    s = storms[d]; tw = s.setdefault('towns', {})
    if isinstance(tw, list): tw = s['towns'] = {}
    for k, t in b['towns'].items():
        if k not in tw: tw[k] = t; towns_added += 1
        elif t.get('n34', 0) > tw[k].get('n34', 0): tw[k] = t; towns_raised += 1
    s['max'] = max([s.get('max', 0)] + [t.get('max', 0) for t in tw.values()])
    s['n1'] = sum(t.get('n1', 0) for t in tw.values()); s['n34'] = sum(t.get('n34', 0) for t in tw.values())
kept = set(storms)

# the map's squares
paths = J(pf) if os.path.exists(pf) else None
sq_added = 0
if paths is not None:
    pa = J(os.path.join(bd, 'hail-paths-add.json'))
    same = all(abs(pa[k] - paths[k]) < 1e-9 for k in ('lat1', 'lon1', 'dx', 'dy'))
    if not same: sys.exit('hail-paths grid differs: not merged')
    r0, c0 = int(paths['r0']) - int(pa.get('r0', 0)), int(paths['c0']) - int(pa.get('c0', 0))
    P = paths.setdefault('paths', {})
    for d, cells in pa['paths'].items():
        if d not in kept or d > through: continue
        have = {(c[0], c[1]) for c in P.get(d, [])}
        new = [[r - r0, c - c0, v] for r, c, v in cells if (r - r0, c - c0) not in have]
        if new: P[d] = P.get(d, []) + new; sq_added += len(new)

# the towns that already have a file
idx = J(os.path.join(rd, 'index.json'))
keys = [r['key'] for r in idx.get('regions', [])]
joined = {}
for k in keys:
    lf, bf = os.path.join(rd, 'hail-%s.json' % k), os.path.join(bd, 'hail-%s.json' % k)
    if not (os.path.exists(lf) and os.path.exists(bf)): continue
    L, B = J(lf), J(bf)
    doors = L.setdefault('doors', {}); before = len(doors); ent = 0
    for i, rows in B.get('doors', {}).items():
        cur = doors.get(i, []); have = {e[0] for e in cur}
        add = [e for e in rows if e[0] not in have and e[0] in kept and e[0] <= through]
        if add:
            doors[i] = sorted(cur + add, key=lambda e: e[0], reverse=True); ent += len(add)
    joined[k] = (L, before, len(doors), ent)

print('server through %s; storm days %d -> %d (+%d added: %s); towns added to existing days %d, raised %d; map squares +%d'
      % (through, len(hs.get('storms', [])), len(storms), len(added_days), ' '.join(sorted(added_days)[:40]), towns_added, towns_raised, sq_added))
for k, (L, b, a, e) in joined.items():
    print('  hail-%s: doors with storms %d -> %d (+%d storm entries)' % (k, b, a, e))
missing = [k for k in keys if not os.path.exists(os.path.join(rd, 'hail-%s.json' % k))]
print('towns with no hail file on the server (for push-edition.sh): %d' % len(missing))
if dry:
    print('dry run: nothing written'); sys.exit(0)

bk = os.path.expanduser('~/upload-backups/before-hailfill-%s.tgz' % time.strftime('%Y%m%d-%H%M%S'))
with tarfile.open(bk, 'w:gz') as t:
    for f in ['hail-storms.json', 'hail-paths.json'] + ['hail-%s.json' % k for k in joined]:
        if os.path.exists(os.path.join(rd, f)): t.add(os.path.join(rd, f), arcname=f)
print('backed up to ' + bk)
hs['storms'] = [storms[d] for d in sorted(storms, reverse=True)]
write(sf, hs)
if paths is not None: write(pf, paths)
for k, (L, b, a, e) in joined.items():
    if e: write(os.path.join(rd, 'hail-%s.json' % k), L)
for f in ['hail-storms.json', 'hail-paths.json']:
    if os.path.exists(os.path.join(rd, f)): J(os.path.join(rd, f))   # review 2026-10-30: no hail-paths.json on the server made the check crash after a good merge
print('merged; json ok')
