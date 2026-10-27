#!/bin/bash
# Finish the roof material scan once the cloud machine says "material done" (2026-10-26, Matthew: "you can que the roof material scan
# as well"). Run from this folder:  bash finish-material-2026-10-26.sh > logs-finish-material.log 2>&1
#   copies back material-<town>.json (the model's calls, written only where it clears the 90% bar), naip-<town>.json (the close-up
#   photo index), roof-<town>.json and roofs/houses-<town>.json for every town the scan covered, rebuilds the photo outlines, the
#   editions' data, and pushes every edition (backup, md5, index.json/company.json merged), then live-checks Roofing.
set -u
cd "$(dirname "$0")"
S=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
VM="ssh -o ConnectTimeout=20 -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"; RD=../../app/data/rounds
step() { echo "$(date +%T) $*"; }
$VM 'grep -q "material done" ~/run-status.txt' < /dev/null || { step "the material scan is not finished: $($VM 'cat ~/run-status.txt' < /dev/null)"; exit 1; }
$VM 'cd ~/run/tv/traverse && L=$(cat ~/run/group1/mat-all.txt); tar czf - $(for t in $L; do for f in app/data/rounds/material-$t.json app/data/rounds/naip-$t.json app/data/rounds/roof-$t.json data-pipeline/door-territory/roofs/houses-$t.json; do [ -f $f ] && echo $f; done; done) data-pipeline/door-territory/roofs/material/coverage.json' < /dev/null > "$S/matback.tgz" || exit 1
rm -rf "$S/matback" && mkdir -p "$S/matback" && tar xzf "$S/matback.tgz" -C "$S/matback" || exit 1
n=0; for f in "$S"/matback/app/data/rounds/*.json; do cp "$f" "$RD/"; n=$((n+1)); done; cp "$S"/matback/data-pipeline/door-territory/roofs/houses-*.json roofs/ 2>/dev/null
cp "$S/matback/data-pipeline/door-territory/roofs/material/coverage.json" roofs/material/coverage.json
step "$n files copied back"
(cd roofs && node --max-old-space-size=8192 outline-photos.mjs | tail -1)
(cd ../../app && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror")
for d in traverse-data traverse-solar-data traverse-yards-data traverse-pest-data traverse-security-data; do bash ./push-edition.sh "$d" || { step "push $d failed"; exit 1; }; done
awk '$1=="traverse"{print $1,$2,"aurora"}' "$USERPROFILE/.ssh/claude-check-codes.txt" | bash /c/Users/SURGEI~1/.ssh/sg.sh trav "$(cat ./elc2.sh)"
step "done"
