#!/bin/bash
# Roof material for the Larimer towns, to Roofing and Solar (2026-10-31 overnight queue, stage g2mat of traverse/ops/run-cloud-finishers.sh).
# Runs once the cloud machine leaves ~/run/ovn1031/g2mat.vmdone (overnight/queue-1031-vm.sh). By hand:
#   bash finish-g2mat-2026-10-31.sh > logs-finish-g2mat.log 2>&1
# Before it (done on the laptop 31 Oct): assessor/build-year.mjs read Larimer's improvement table (roof cover, roof type, year built,
# remodel, size; no owner fields) and Mesa's parcel layer (year built only) into app/data/rounds/year-<town>.json for the 28 Larimer
# and Mesa Group 2 towns and Berthoud (Weld + Larimer sides); those year files went to the cloud machine.
#   1. copies back material-<town>.json for the towns in ~/run/ovn1031/g2mat-towns.txt and merges their coverage.json entries;
#   2. the old local files are saved in the scratchpad first; material + year files go into app/data/rounds and into the Roofing and
#      Solar builds (the only editions carrying material-/year- files; build-editions.cjs keeps them out of the others);
#   3. push-edition.sh traverse-data and traverse-solar-data with an exact file filter (those towns' material- and year- files only);
#      MD5 MATCH required;
#   4. the server's copy of three towns' material files read back (md5 against local).
# Any failure stops with "STOP:" and exit 1 (the finisher loop tries a stage at most 3 times). Safe to re-run.
set -u
DT="/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"; cd "$DT" || exit 1
S0=/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad
S="$S0/g2mat"; RD=../../app/data/rounds; ED=../../editions/dist
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
step() { echo "$(date +%T) $*"; }
stop() { echo "$(date +%T) STOP: $*"; exit 1; }
wifi() { while netsh wlan show interfaces 2>/dev/null | tr -d '\r' | grep -qE "^ +SSID +: iPhone$"; do step "on the phone hotspot: waiting for Wi-Fi"; sleep 300; done; }

$VM 'test -f ~/run/ovn1031/g2mat.vmdone' < /dev/null || stop "the cloud machine has not finished g2mat: $($VM 'cat ~/run-status.txt' < /dev/null)"
wifi; mkdir -p "$S" || stop "scratchpad"
$VM 'cat ~/run/ovn1031/g2mat-towns.txt' < /dev/null | tr -d '\r' | grep -E '^[a-z0-9-]+$' > "$S/towns.txt" || stop "town list"
TOWNS=$(cat "$S/towns.txt"); step "towns: $(echo $TOWNS | wc -w)"
[ "$(echo $TOWNS | wc -w)" -ge 10 ] || stop "too few towns in the list"

## 1. copy back
$VM "cd ~/run/tv/traverse && tar czf - \$(for t in $(echo $TOWNS); do f=app/data/rounds/material-\$t.json; [ -f \$f ] && echo \$f; done) data-pipeline/door-territory/roofs/material/coverage.json" < /dev/null > "$S/back.tgz" || stop "copy back failed"
rm -rf "${S:?}/back" && mkdir -p "$S/back" && tar xzf "$S/back.tgz" -C "$S/back" || stop "unpack failed"
n=$(ls "$S/back/app/data/rounds" | grep -c '^material-'); step "material files copied back: $n"
[ "$n" -ge 10 ] || stop "only $n material files came back"
node -e "
const fs=require('fs'),[dir,...towns]=process.argv.slice(1);let bad=0,tot=0,county=0;
for(const t of towns){const f=dir+'/material-'+t+'.json';if(!fs.existsSync(f)){console.log('  '+t+': no file');continue}
const j=JSON.parse(fs.readFileSync(f));if(!j.doors||typeof j.doors!=='object'){bad++;continue}
const v=Object.values(j.doors);const c=v.filter(x=>x.src==='county').length;tot+=v.length;county+=c;
console.log('  '+t+': '+v.length+' doors with a material ('+c+' county record, '+v.filter(x=>x.src==='imagery').length+' photo, '+v.filter(x=>x.src==='guess').length+' probably)')}
console.log('all: '+tot+' ('+county+' county)');process.exit(bad||!county?1:0)" "$S/back/app/data/rounds" $TOWNS || stop "material files did not check out"

## 2. into place (old files saved first; a retry keeps the first try's backup)
if [ ! -f "$S/before.tgz" ]; then
  (cd "$RD" && tar czf "$S/before.tgz" $(for t in $TOWNS; do for p in material year; do [ -f $p-$t.json ] && echo $p-$t.json; done; done) 2>/dev/null) || true
  for d in traverse-data traverse-solar-data; do (cd "$ED/$d/rounds" && tar czf "$S/before-$d.tgz" $(for t in $TOWNS; do for p in material year; do [ -f $p-$t.json ] && echo $p-$t.json; done; done) 2>/dev/null) || true; done
fi
cp "$S"/back/app/data/rounds/material-*.json "$RD/" || stop "copy into app/data/rounds"
node -e "
const fs=require('fs'),[loc,vm,...towns]=process.argv.slice(1);const L=JSON.parse(fs.readFileSync(loc)),V=JSON.parse(fs.readFileSync(vm));let n=0;
for(const t of towns)if(V[t]){L[t]=V[t];n++}fs.writeFileSync(loc,JSON.stringify(L,null,1));console.log('coverage.json: '+n+' towns merged')" roofs/material/coverage.json "$S/back/data-pipeline/door-territory/roofs/material/coverage.json" $TOWNS || stop "coverage merge"
# Mesa's towns get their year files only (year built; Mesa publishes no roof cover)
MESA=$(node -e "console.log(require('./group2/registered.json').filter(t=>t.county==='Mesa').map(t=>t.key).join(' '))")
for d in traverse-data traverse-solar-data; do
  for t in $TOWNS $MESA; do
    grep -qE "\"key\": *\"$t\"" "$ED/$d/rounds/index.json" || { step "  $d has no $t: skipped"; continue; }
    for p in material year; do [ -f "$RD/$p-$t.json" ] && cp "$RD/$p-$t.json" "$ED/$d/rounds/"; done
  done
done
RX="^(material|year)-($(echo $TOWNS | tr ' ' '|'))\.json$|^year-($(echo $MESA | tr ' ' '|'))\.json$"
ALLN=$(( $(echo $TOWNS | wc -w) * 2 + $(echo $MESA | wc -w) ))

## 3. push
for d in traverse-data traverse-solar-data; do
  wifi
  DRY=1 bash ./push-edition.sh "$d" "$RX" > "$S/dry-$d.txt" || stop "dry run $d failed"
  n=$(grep -cE '^(material|year)-' "$S/dry-$d.txt"); step "$d: $n files to send"
  [ "$n" -le "$ALLN" ] || stop "$d would send $n files (at most $ALLN expected)"
  bash ./push-edition.sh "$d" "$RX" | tee "$S/push-$d.txt"
  grep -qE "MD5 MATCH|: 0 files to send" "$S/push-$d.txt" && grep -q "json ok" "$S/push-$d.txt" || stop "push $d did not match"
done

## 4. live check
for t in g2-fort-collins g2-loveland g1-berthoud; do
  [ -f "$RD/material-$t.json" ] || continue
  live=$($SG "md5sum ~/www/traverseplatforms.com/traverse-data/rounds/material-$t.json | cut -c1-32" < /dev/null)
  [ "$live" = "$(md5sum "$RD/material-$t.json" | cut -c1-32)" ] || stop "live material-$t.json differs from the build"
  step "live: material-$t.json md5 ${live:0:12} OK"
done
step "done: Larimer roof material live on Roofing and Solar; rollback $S/before*.tgz + the server's before-push backups; note in TASKS.md"
