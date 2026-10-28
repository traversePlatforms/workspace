#!/bin/bash
# Group 2 live check (2026-10-28): every install's live index.json against the build. For Sixfold and each edition that got Group 1,
# per Group 2 town: present, and its door count equal to group2/built-counts.json (written by finish-g2b-2026-10-28.sh from the local
# index.json); also that the town's door file on the server holds that many doors. Prints one line per install; exit 1 on any mismatch.
# Usage (from door-territory): bash group2/verify-live-g2.sh
set -u
cd "$(dirname "$0")/.." || exit 1
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
[ -f group2/built-counts.json ] || { echo "no group2/built-counts.json"; exit 1; }
cat group2/built-counts.json | $SG "cat > /tmp/g2-built.json && python3 - <<'PY'
import json, os
want = json.load(open('/tmp/g2-built.json'))
bad_all = 0
for inst in ['sixfold-data', 'traverse-yards-data', 'traverse-pest-data', 'traverse-security-data', 'traverse-solar-data', 'traverse-data']:
    d = os.path.expanduser('~/www/traverseplatforms.com/' + inst + '/rounds')
    idx = {r['key']: r for r in json.load(open(d + '/index.json'))['regions']}
    miss, wrong, filebad, tot = [], [], [], 0
    for k, n in want.items():
        r = idx.get(k)
        if not r: miss.append(k); continue
        if r.get('doors') != n: wrong.append('%s %s!=%s' % (k, r.get('doors'), n))
        f = d + '/' + k + '.json'
        try:
            fd = sum(len(a['doors']) for a in json.load(open(f))['areas'])
            if fd != n: filebad.append('%s file %s' % (k, fd))
        except Exception as e:
            filebad.append('%s file %s' % (k, type(e).__name__))
        tot += r.get('doors') or 0
    bad = len(miss) + len(wrong) + len(filebad); bad_all += bad
    print(inst, '| towns', len(want) - len(miss), 'of', len(want), '| doors', tot, '|', 'OK' if not bad else 'MISSING %s WRONG %s FILE %s' % (miss, wrong, filebad))
os.remove('/tmp/g2-built.json')
raise SystemExit(1 if bad_all else 0)
PY"
