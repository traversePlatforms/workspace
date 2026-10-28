#!/bin/bash
# Finish the close-up photo backfill once the cloud machine leaves ~/run/group2/photos.vmdone or says "photos backfill: done" (2026-10-28,
# Matthew: option 1, the doors live first and "See the roof" after). The overnight check runs it (traverse/ops/run-cloud-finishers.sh,
# stage photos). By hand: bash finish-photos-2026-10-28.sh > logs-finish-photos.log 2>&1
#   copies back naip-<town>.json (the close-up index) and roofs/houses-<town>.json for the towns in ~/run/group2/photos-towns.txt,
#   rebuilds the photo outlines and the editions' data, pushes the g1- and g2- files to every edition (push-edition.sh: backup, md5,
#   index.json / company.json merged; Sixfold does not carry these photos), then live-checks Roofing.
set -u
cd "$(dirname "$0")"
S=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
VM="ssh -o ConnectTimeout=20 -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"; RD=../../app/data/rounds
step() { echo "$(date +%T) $*"; }
$VM 'test -f ~/run/group2/photos.vmdone || grep -q "photos backfill: done" ~/run-status.txt' < /dev/null || { step "the backfill is not finished: $($VM 'cat ~/run-status.txt' < /dev/null)"; exit 1; }
mkdir -p "$S"
$VM 'cd ~/run/tv/traverse && L=$(cat ~/run/group2/photos-towns.txt); tar czf - $(for t in $L; do for f in app/data/rounds/naip-$t.json data-pipeline/door-territory/roofs/houses-$t.json; do [ -f $f ] && echo $f; done; done)' < /dev/null > "$S/photosback.tgz" || exit 1
rm -rf "$S/photosback" && mkdir -p "$S/photosback" && tar xzf "$S/photosback.tgz" -C "$S/photosback" || exit 1
n=0; for f in "$S"/photosback/app/data/rounds/naip-*.json; do [ -f "$f" ] || continue; cp "$f" "$RD/"; n=$((n+1)); done
cp "$S"/photosback/data-pipeline/door-territory/roofs/houses-*.json roofs/ 2>/dev/null
step "$n photo index files copied back"; [ "$n" -gt 0 ] || { step "STOP: no photo files came back"; exit 1; }
(cd roofs && node --max-old-space-size=8192 outline-photos.mjs | tail -1)
(cd ../../app && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror")
for d in traverse-data traverse-solar-data traverse-yards-data traverse-pest-data traverse-security-data; do
  for p in g1- g2-; do bash ./push-edition.sh "$d" "$p" || { step "push $d $p failed"; exit 1; }; done
done
awk '$1=="traverse"{print $1,$2,"g2-loveland"}' "$USERPROFILE/.ssh/claude-check-codes.txt" | bash /c/Users/SURGEI~1/.ssh/sg.sh trav "$(cat ./elc2.sh)"
step "done"
