#!/bin/bash
# Finish the editions' new-town layers once the cloud run says "layers: every town done" (2026-10-26). Run from this folder:
#   bash finish-layers-2026-10-26.sh > logs-finish-layers.log 2>&1
# 1. copies the cloud roof and solar caches back and merges them into the local ones (a cloud reading replaces a local error or gap;
#    a local reading is never overwritten; backups first), 2. writes roof-, houses-, solar- and photo- files for every town
#    (sample-roofs/sample-solar --build --all-towns, photo-index build --all-towns) and the outlines over the photos, 3. rebuilds the
#    editions' data, 4. pushes each edition's new and changed data files (backup, md5, index.json/company.json MERGED, never replaced;
#    hail-storms.json left to the server), 5. live-checks one new town per edition. Edition app pages are NOT uploaded here.
set -u
cd "$(dirname "$0")"
S=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
VM="ssh -o ConnectTimeout=20 -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
step() { echo "$(date +%T) $*"; }
$VM 'grep -q "layers: every town done\|group1:" ~/run-status.txt' < /dev/null || { step "the cloud run is not finished: $($VM 'cat ~/run-status.txt' < /dev/null)"; exit 1; }
for k in roofs/roof-cache solar/solar-cache; do
  step "copy back $k"
  scp -q -i /c/Users/SURGEI~1/.ssh/azure_yard "yard@20.91.198.101:run/layers/door-territory/$k.json" "$S/cloud-$(basename $k).json" || exit 1
  [ -f "$k.json" ] && cp "$k.json" "$k.before-cloud-20261026.json"
  node -e "
const fs=require('fs');const [loc,cl]=process.argv.slice(1);const L=fs.existsSync(loc)?JSON.parse(fs.readFileSync(loc)):{};const C=JSON.parse(fs.readFileSync(cl));
let add=0,fix=0;for(const [k,v] of Object.entries(C)){const o=L[k];if(!o){L[k]=v;add++}else if(o.err&&!v.err){L[k]=v;fix++}}
fs.writeFileSync(loc+'.tmp',JSON.stringify(L));fs.renameSync(loc+'.tmp',loc);console.log(loc,'+',add,'new,',fix,'errors replaced, now',Object.keys(L).length)" "$k.json" "$S/cloud-$(basename $k).json" || exit 1
done
step "build roof + houses files";   (cd roofs && node --max-old-space-size=8192 sample-roofs.mjs --build --all-towns) | tail -3
step "build solar files";           (cd solar && node --max-old-space-size=8192 sample-solar.mjs --build --all-towns) | tail -3
step "build roof photo files";      (cd roofs && node --max-old-space-size=8192 photo-index.mjs build --all-towns) | tail -3
step "build photo outlines";        (cd roofs && node --max-old-space-size=8192 outline-photos.mjs) | tail -3
step "rebuild the editions' data";  (cd ../../app && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror")
for d in traverse-data traverse-solar-data traverse-yards-data traverse-pest-data traverse-security-data; do bash ./push-edition.sh "$d" || { step "push $d failed"; exit 1; }; done
step "live check"
awk '$1=="traverse"{print $1,$2,"aurora"} $1=="traverse-solar"{print $1,$2,"aurora"}' "$USERPROFILE/.ssh/claude-check-codes.txt" | bash /c/Users/SURGEI~1/.ssh/sg.sh trav "$(cat ./elc2.sh)"
step "done"
