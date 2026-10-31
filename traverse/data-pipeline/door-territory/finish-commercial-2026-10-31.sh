#!/bin/bash
# The internal commercial building list (2026-10-31 overnight queue, stage commercial of traverse/ops/run-cloud-finishers.sh), for later
# commercial roofing. NOTHING IS UPLOADED OR PUBLISHED: the list stays in commercial/out/statewide-2026-10-31/ (commercial/out/ is
# gitignored). Runs once the cloud machine leaves ~/run/ovn1031/commercial.vmdone. By hand:
#   bash finish-commercial-2026-10-31.sh > logs-finish-commercial.log 2>&1
#   1. copies back the per-county files commercial/pull-statewide.mjs wrote (state parcel layer: address, use, lot, value; no owners);
#   2. adds El Paso from the assessor's weekly file (commercial/el-paso-list.mjs; the state layer has no El Paso attributes);
#   3. writes counts.json beside them (counts only) and prints the totals.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"   # this script's own folder (main checkout, or a worktree before the merge): commercial/el-paso-list.mjs
DT="/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"; cd "$DT" || exit 1
OUT="$DT/commercial/out/statewide-2026-10-31"
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
step() { echo "$(date +%T) $*"; }
stop() { echo "$(date +%T) STOP: $*"; exit 1; }
git -C "$DT" check-ignore -q "commercial/out/x.json" || stop "commercial/out is not gitignored here"
$VM 'test -f ~/run/ovn1031/commercial.vmdone' < /dev/null || stop "the cloud machine has not finished the commercial list: $($VM 'cat ~/run-status.txt' < /dev/null)"
mkdir -p "$OUT" || stop "out folder"
$VM 'cd ~/run/ovn1031/commercial-out && tar czf - *.json' < /dev/null | tar xzf - -C "$OUT" || stop "copy back failed"
TRAVERSE_ROOT="/c/Users/Surge Inc/Desktop/claude test 2/traverse" node "$HERE/commercial/el-paso-list.mjs" "$OUT" || stop "El Paso list failed"
node -e "
const fs=require('fs'),dir=process.argv[1];const by={},tot={apartments:0,commercial:0,industrial:0};let n=0;
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&!/^(summary|counts)\.json$/.test(f))){const j=JSON.parse(fs.readFileSync(dir+'/'+f));
const c={};for(const r of j.rows){c[r.kind]=(c[r.kind]||0)+1;tot[r.kind]=(tot[r.kind]||0)+1;n++}by[j.county]={rows:j.rows.length,...c}}
fs.writeFileSync(dir+'/counts.json',JSON.stringify({built:new Date().toISOString().slice(0,10),total:n,kinds:tot,counties:by},null,1));
console.log('commercial list: '+n+' parcels in '+Object.keys(by).length+' counties '+JSON.stringify(tot))" "$OUT" || stop "counting failed"
step "done: internal list in commercial/out/statewide-2026-10-31/ (gitignored, not uploaded)"
