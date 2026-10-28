# 2026-10-28 (Group 1 re-clip): put the rebuilt towns' entries (door and area counts) into an edition's LIVE index.json. The edition
# merge (~/merge-edition-index.py) only ever adds towns, so a town whose door list was rebuilt kept its old counts. Here each named
# town's live entry is REPLACED in place by the local one (as upload-towns-sixfold.sh does for Sixfold); every other entry, admin-only
# and one-off towns included, is left exactly as it is; an admin-only entry is never replaced. The caller backs up index.json first.
# argv: <data dir> <local index.json> <file with one town key per line>
import json, os, sys
d, li, kf = sys.argv[1], sys.argv[2], sys.argv[3]
os.chdir(d)
keys = {l.strip() for l in open(kf) if l.strip()}
live = json.load(open('index.json')); loc = json.load(open(li))
locmap = {r['key']: r for r in loc['regions'] if r['key'] in keys}
rep, before, after = [], 0, 0
for i, r in enumerate(live['regions']):
    if r['key'] in locmap and not r.get('admin') and os.path.exists(r['key'] + '.json'):
        before += r.get('doors', 0); after += locmap[r['key']].get('doors', 0)
        live['regions'][i] = locmap[r['key']]; rep.append(r['key'])
missing = sorted(keys - set(rep))
json.dump(live, open('index.json.new', 'w'), separators=(',', ':')); os.replace('index.json.new', 'index.json')
json.load(open('index.json'))
print('  replaced', len(rep), 'entries | doors', before, '->', after, '| not replaced:', missing, '| live now', len(live['regions']), 'towns')
