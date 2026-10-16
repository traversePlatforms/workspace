# Runs ON THE SERVER after a town is re-uploaded with redrawn neighbourhoods (2026-10-16, the all-lot-sizes rebuild).
# Neighbourhood names carry house-number ranges, so a redraw renames them and an assignment to the old name points nowhere. For each
# assignment whose neighbourhood name is gone, this finds the new neighbourhood holding most of the old one's doors (door ids are the
# address, so they survive) and assigns it to the same person, with the same day if it had one. Through the app's own API as Claude Check.
#   python3 remap-assign.py <town> <backup.tgz with the old <town>.json>
import json, sys, tarfile, urllib.request, http.cookiejar, os
town, tgz = sys.argv[1], sys.argv[2]
D = os.path.expanduser('~/www/traverseplatforms.com/sixfold-data/rounds')
old = None
with tarfile.open(tgz) as t:
    for m in t.getmembers():
        if m.name.endswith('/' + town + '.json') or m.name == town + '.json':
            old = json.load(t.extractfile(m)); break
if not old: print(town, ': no old copy in the backup, nothing to remap'); sys.exit(0)
new = json.load(open(os.path.join(D, town + '.json')))
newNames = {a['name'] for a in new['areas']}
doorArea = {}
for a in new['areas']:
    for d in a['doors']: doorArea[d['id']] = a['name']
cur, day = {}, {}
p = os.path.join(D, 'assign-' + town + '.log')
if os.path.exists(p):
    for line in open(p):
        try: r = json.loads(line)
        except Exception: continue
        if 'area' not in r: continue
        if r.get('who', '') == '': cur.pop(r['area'], None); day.pop(r['area'], None)
        else: cur[r['area']] = r['who']; day[r['area']] = r.get('on', '')
gone = {a: w for a, w in cur.items() if a not in newNames}
if not gone: print(town, ': assignments', len(cur), '- none renamed'); sys.exit(0)
oldDoors = {a['name']: [d['id'] for d in a['doors']] for a in old['areas']}
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(a, body=None):
    req = urllib.request.Request('https://traverseplatforms.com/api/rounds.php?action=' + a, data=json.dumps(body).encode() if body is not None else None, headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 ClaudeCheck'})
    try: return json.loads(op.open(req, timeout=60).read())
    except urllib.error.HTTPError as e: return json.loads(e.read() or b'{}')
call('signin', {'code': '512618'})
for a, w in gone.items():
    votes = {}
    for d in oldDoors.get(a, []):
        n = doorArea.get(d)
        if n: votes[n] = votes.get(n, 0) + 1
    if not votes: print(town, ':', a, '(', w, ') - none of its doors found in the new list'); continue
    best = max(votes, key=votes.get)
    taken = cur.get(best)
    if taken and taken != w: print(town, ':', a, '->', best, 'already', taken, '- left for the office'); continue
    body = {'region': town, 'area': best, 'who': w}
    if day.get(a): body['on'] = day[a]
    r = call('assign', body)
    if not r.get('ok') and 'on' in body: body.pop('on'); r = call('assign', body)   # a past day: assign without it
    print(town, ':', a, '->', best, '(', w, ')', 'ok' if r.get('ok') else r)
    cur[best] = w
