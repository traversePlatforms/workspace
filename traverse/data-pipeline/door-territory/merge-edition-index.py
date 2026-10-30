# 2026-10-26: merge an edition's new towns into its LIVE index.json and company.json townGroups (never replace them).
# argv: <data dir> <local index.json path (uploaded to /tmp)> <local company.json path (uploaded to /tmp)>
# Keeps every live entry (admin-only and one-off towns included) as it is; adds the local entries whose town file is on the server;
# adds 'shared' entries for the added towns; adds missing town groups. Backups are taken by the caller.
import json, os, sys
d, li, lc = sys.argv[1], sys.argv[2], sys.argv[3]
os.chdir(d)
live = json.load(open('index.json')); loc = json.load(open(li))
have = {r['key'] for r in live['regions']}
add = [r for r in loc['regions'] if r['key'] not in have and os.path.exists(r['key'] + '.json')]
skipped = [r['key'] for r in loc['regions'] if r['key'] not in have and not os.path.exists(r['key'] + '.json')]
live['regions'].extend(add)
# 2026-10-29: a town already live keeps its entry, but when the local build's door count differs (a re-pulled town) the
# counts are re-read from the town file on the server, so the index never lags the files (see recount-index.py).
locd = {r['key']: r for r in loc['regions']}
recounted = []
for r in live['regions']:
    l = locd.get(r['key'])
    if l is None or l.get('doors') == r.get('doors') or not os.path.exists(r['key'] + '.json'): continue
    ar = json.load(open(r['key'] + '.json')).get('areas') or []
    n = sum(len(x.get('doors') or []) for x in ar)
    if n != r.get('doors') or len(ar) != r.get('areas'): recounted.append(r['key']); r['doors'] = n; r['areas'] = len(ar)
sh = live.setdefault('shared', {})
for k, v in (loc.get('shared') or {}).items():
    if k not in sh: sh[k] = v
json.dump(live, open('index.json.new', 'w'), separators=(',', ':')); os.replace('index.json.new', 'index.json')
co = json.load(open('company.json')); g = co.setdefault('townGroups', [])
newg = [x for x in (json.load(open(lc)).get('townGroups') or []) if x not in g]
g.extend(newg)
json.dump(co, open('company.json.new', 'w'), indent=2); os.replace('company.json.new', 'company.json')
print('added', len(add), 'towns,', sum(r.get('doors', 0) for r in add), 'doors | live now', len(live['regions']), '| groups added', len(newg), '| not on server (skipped):', skipped, '| recounted:', recounted)
