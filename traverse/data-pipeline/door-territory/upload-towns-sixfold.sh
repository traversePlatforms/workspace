#!/bin/bash
# Upload named towns to the Sixfold install (traverseplatforms.com/summit-de59ae83) after a build. Usage: upload-towns-sixfold.sh <label> <town...>
# Safe to run twice: a label that has already uploaded (logs-upload/<label>.done) is skipped, and a lock stops two copies at once.
# Backup first; uploads only those towns' files; in the live index.json each named town's entry is REPLACED by the local one (in
# place) or added; every other entry, admin-only ones included, is left alone. Groups added to company.json; search-index.txt cleared.
set -u
LABEL="$1"; shift; NEW="$*"
DT="/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"; mkdir -p "$DT/logs-upload"
[ -f "$DT/logs-upload/$LABEL.done" ] && { echo "$LABEL already uploaded"; exit 0; }
# overnight check 2026-11-10: the lock names its owner. An upload that was stopped from outside (the hotspot watchdog, a restart) never
# removed its lock, and from then on EVERY upload said "another upload is running" and ended with exit 0, sending nothing. A lock whose
# owner is gone is taken over; one with no owner written (the old kind) after 90 minutes.
LK="$DT/logs-upload/lock"
if [ -d "$LK" ]; then OWN=$(cat "$LK/pid" 2>/dev/null)
  if [ -n "$OWN" ]; then kill -0 "$OWN" 2>/dev/null || { echo "$LABEL: the upload that held the lock (pid $OWN) is gone; taking it over"; rm -f "$LK/pid"; rmdir "$LK"; }
  elif [ -n "$(find "$LK" -maxdepth 0 -mmin +90 2>/dev/null)" ]; then echo "$LABEL: lock older than 90 minutes with no owner; taking it over"; rmdir "$LK"; fi
fi
mkdir "$LK" 2>/dev/null || { echo "another upload is running"; exit 0; }
echo $$ > "$LK/pid"
trap 'rm -f "$LK/pid"; rmdir "$LK"' EXIT
RD="/c/Users/Surge Inc/Desktop/claude test 2/traverse/app/data/rounds"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
cd "$RD"
FILES=""; for t in $NEW; do [ -s "$t.json" ] && FILES="$FILES $t.json"; [ -s "$t-lookup.json" ] && FILES="$FILES $t-lookup.json"; done
echo "$(date +%T) $LABEL: files $(echo $FILES | wc -w)"
[ -z "$FILES" ] && exit 1
TMPI="$(mktemp)"; cp index.json "$TMPI"
$SG "cd ~/www/traverseplatforms.com/sixfold-data/rounds && tar -czf ~/upload-backups/before-$LABEL.tgz index.json company.json \$(for t in $NEW; do ls \$t.json \$t-lookup.json 2>/dev/null; done) && echo backed-up" < /dev/null || exit 1
tar -cf - $FILES | $SG '~/bin/safe-extract.sh ~/www/traverseplatforms.com/sixfold-data/rounds - > /dev/null && echo extracted' || exit 1   # rename into place (2026-10-27, code review item 9)
cat "$TMPI" | $SG "cat > /tmp/index-local.json && cd ~/www/traverseplatforms.com/sixfold-data/rounds && NEW='$NEW' python3 - <<'PY'
import json, os
new = set(os.environ['NEW'].split())
live = json.load(open('index.json')); loc = json.load(open('/tmp/index-local.json'))
locmap = {r['key']: r for r in loc['regions'] if r['key'] in new and os.path.exists(r['key'] + '.json')}
rep = 0
for i, r in enumerate(live['regions']):
    if r['key'] in locmap and not r.get('admin'):
        live['regions'][i] = locmap.pop(r['key']); rep += 1
add = list(locmap.values()); live['regions'].extend(add)
sh = live.setdefault('shared', {})
for k, v in (loc.get('shared') or {}).items():
    if k in new: sh[k] = v
live['built'] = loc.get('built', live.get('built'))
tmp = 'index.json.new'; json.dump(live, open(tmp, 'w'), separators=(',', ':')); os.replace(tmp, 'index.json')
co = json.load(open('company.json')); g = co.setdefault('townGroups', [])
for r in live['regions']:
    if r['key'] in new and r.get('group') and r['group'] not in g: g.append(r['group'])
tmp = 'company.json.new'; json.dump(co, open(tmp, 'w'), indent=1); os.replace(tmp, 'company.json')
print('replaced', rep, '| added', len(add), [r['key'] for r in add], '| live now', len(live['regions']), '| admin-only kept:', [r['key'] for r in live['regions'] if r.get('admin')], '| townGroups', len(g))
PY
rm -f search-index.txt /tmp/index-local.json; echo search-index-cleared" || exit 1
rm -f "$TMPI"
touch "$DT/logs-upload/$LABEL.done"; echo "$(date +%T) $LABEL uploaded"
