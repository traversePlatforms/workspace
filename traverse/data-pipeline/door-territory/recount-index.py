# 2026-10-29: set each town's 'doors' and 'areas' in a LIVE index.json from the town file itself (runs on the server).
# Why: merge-edition-index.py keeps existing live entries as they are, so a re-pulled town (castle-rock, denver, centennial...)
# kept its old counts in the editions' indexes while the door files were current. Only those two numbers change; towns
# with no file (DFW on Sixfold) are left alone. argv: <rounds dir> [--apply] [key ...]; without --apply it only lists.
import json, os, sys
d = sys.argv[1]; apply = '--apply' in sys.argv; only = {a for a in sys.argv[2:] if a != '--apply'}
os.chdir(d)
idx = json.load(open('index.json'))
changed = []
for r in idx['regions']:
    k = r['key']
    if (only and k not in only) or not os.path.exists(k + '.json'): continue
    f = json.load(open(k + '.json'))
    areas = f.get('areas') or []
    doors = sum(len(a.get('doors') or []) for a in areas)
    if r.get('doors') != doors or r.get('areas') != len(areas):
        changed.append((k, r.get('doors'), doors))
        r['doors'] = doors; r['areas'] = len(areas)
for k, a, b in changed: print('  %s: %s -> %s doors' % (k, a, b))
print('%s: %d towns to correct, index total now %d doors' % (os.path.basename(os.path.dirname(os.path.abspath(d))) or d, len(changed), sum(r.get('doors', 0) for r in idx['regions'] if os.path.exists(r['key'] + '.json'))))
if apply and changed:
    json.dump(idx, open('index.json.new', 'w'), separators=(',', ':')); os.replace('index.json.new', 'index.json')
    json.load(open('index.json')); print('  written, json ok')
