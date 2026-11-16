#!/bin/bash
# Laptop finisher for the cloud stage houyard (16 Nov 2026, Houston lawn sizes; overnight/fill1031/houyard.sh). Run by hand once the VM's
# status says "houyard: done" (~/run/fill1031/houyard.vmdone). Nothing is uploaded anywhere: the Houston towns are in no install yet.
#   bash metros/finish-houyard.sh
# 1. copies ~/run/fill1031/houyard-result.tgz back and checks it unpacks
# 2. unpacks the readings into lawn-trial/yard-metro/ (the old readings kept in lawn-trial/yard-metro.before-<stamp>.tgz)
# 3. node build-metro.mjs hou --from=lawn: the readings into lawn-trial/yard-metro/hou-lawn.json, then the Houston door files again
#    (build-rounds-data ROUNDS_METRO=hou: Colorado's door files are not touched)
# 4. prints how many doors carry a lawn size, per town
set -eu
cd "$(dirname "$0")/.."
KEY="$HOME/.ssh/azure_yard"; VM=yard@20.91.198.101; STAMP=$(date +%Y%m%d-%H%M)
T="$LOCALAPPDATA/ProjectBackup/houyard"; mkdir -p "$T"
ssh -i "$KEY" -o BatchMode=yes "$VM" 'test -f ~/run/fill1031/houyard.vmdone' < /dev/null || { echo "houyard not done on the VM yet"; exit 4; }
scp -i "$KEY" -o BatchMode=yes "$VM:run/fill1031/houyard-result.tgz" "$T/houyard-result.tgz" < /dev/null
tar tzf "$T/houyard-result.tgz" > /dev/null
[ -d lawn-trial/yard-metro ] && tar czf "lawn-trial/yard-metro.before-$STAMP.tgz" lawn-trial/yard-metro || true
tar xzf "$T/houyard-result.tgz" -C . lawn-trial/yard-metro
node build-metro.mjs hou --from=lawn
node -e '
const fs=require("fs"),M=require("./metros/hou.json");let all=0,lawn=0;
for(const t of M.towns){const f="../../app/data/rounds/"+t.key+".json";if(!fs.existsSync(f))continue;const d=JSON.parse(fs.readFileSync(f,"utf8")).areas.flatMap(a=>a.doors);const n=d.filter(x=>x.lawn&&x.lawn.y).length;all+=d.length;lawn+=n;console.log(t.key.padEnd(34),String(n).padStart(7),"of",d.length)}
console.log("Houston doors with a measured lawn:",lawn,"of",all)'
