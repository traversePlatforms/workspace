#!/bin/bash
# Roof material for the every-home doors, part 1 of 2 (18 Nov 2026; finish-every's last line: "roof material pass for the added doors").
#   bash every1115/prep-matnew-2026-11-18.sh > logs-prep-matnew.log 2>&1        (from door-territory)
# Why it is needed:
#   - the doors every-home added to towns of ours came from <town>-add1115-areas.json, which carry no parcel number, so build-year.mjs
#     (address -> parcel through the town CSV) gave them no year built and no county roof record, and material-<town>.json has none of them;
#   - the 91 new towns were predicted on the cloud before their year files existed, so their material files are empty even where the
#     county records the roof (Adams, Boulder, Douglas, Larimer, Weld).
# Steps:
#   1. the towns of ours that gained doors since the every-home snapshot (push-tmp/every1115/ids-before.json), and the new towns;
#   2. year built + county roof records for the added doors: build-year.mjs --only=<those towns>, which now also reads
#      assessor/raw/add-parcels-1115.tsv (town, address, parcel from the cloud's candidate list; no names). STOPS if any existing door's
#      entry changes or goes;
#   3. the cloud pack (ids, points, year and LiDAR roof figures only): <town>-nd1118 = the added doors of each town whose year AND roof
#      files exist (the photo model needs both; elsewhere only county records apply, and finish-matnew writes those here), and the new
#      towns with both files (re-predicted with their year file);
#   4. sends it and appends fill1031 stage matnew (overnight/fill1031/matnew.sh). Part 2: every1115/finish-matnew-2026-11-18.sh.
set -u
exec < /dev/null
cd "$(dirname "$0")/.." || exit 1
S="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/push-tmp/matnew"; mkdir -p "$S"; SN=$(cygpath -m "$S")
EB="$(cygpath -m "$LOCALAPPDATA")/ProjectBackup/push-tmp/every1115/ids-before.json"
RD=../../app/data/rounds; DIST=../../editions/dist/traverse-data/rounds
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
step() { echo "$(date +%T) $*"; }
stop() { echo "$(date +%T) STOP: $*"; exit 1; }
offhot() { while netsh wlan show interfaces 2>/dev/null | grep SSID | grep -v BSSID | head -1 | grep -qi iphone; do step "on the iPhone hotspot: waiting"; sleep 120; done; }
onac() { local i=0; while [ "$(powershell.exe -NoProfile -Command '(Get-CimInstance Win32_Battery).BatteryStatus' 2>/dev/null | tr -d '\r ')" != "2" ]; do i=$((i+1)); [ $i -gt 72 ] && stop "not on AC power for 6 hours"; step "on battery: waiting for AC"; sleep 300; done; }
busy() { powershell.exe -NoProfile -Command "@(Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -match 'finish-gap|upload-gap|finish-rent|finish-yardv3|finish-yardgap|finish-every|rebuild-upload-all|refresh-permits|refresh-weekly|deploy-app|push-edition|push-sixfold-side|upload-towns-sixfold|finish-matnew' }).Count" 2>/dev/null | tr -d '\r'; }
offhot; onac
i=0; while [ "$(busy)" != "0" ]; do i=$((i + 1)); [ $i -gt 72 ] && stop "another upload or build has run for 6 hours"; step "another upload/build is running: waiting"; sleep 300; done
[ -s assessor/raw/add-parcels-1115.tsv ] || stop "assessor/raw/add-parcels-1115.tsv missing (the cloud's ~/run/every1115/cls/cand.tsv, join=add rows: town, address, parcel, county)"

## 1. towns and added doors
node --max-old-space-size=8192 -e "
const fs=require('fs');const R='$RD';const idx=new Set(JSON.parse(fs.readFileSync('$DIST/index.json')).regions.map(r=>r.key));
const keys=JSON.parse(fs.readFileSync('every1115/b/registered.json')).map(t=>t.key);const before=JSON.parse(fs.readFileSync('$EB'));
const nw={};let n=0;for(const [k,ids] of Object.entries(before)){if(!idx.has(k)||keys.includes(k))continue;const b=new Set(ids);const now=JSON.parse(fs.readFileSync(R+'/'+k+'.json')).areas.flatMap(a=>a.doors.map(d=>d.id));const add=now.filter(i=>!b.has(i));if(add.length){nw[k]=add;n+=add.length}}
fs.writeFileSync('$SN/keys.txt',keys.join('\n')+'\n');fs.writeFileSync('$SN/merge.txt',Object.keys(nw).join('\n')+'\n');fs.writeFileSync('$SN/newids.json',JSON.stringify(nw));
console.log('new towns',keys.length,'| towns of ours with added doors',Object.keys(nw).length,'| added doors',n)" || stop "could not list the towns"
MERGE=$(cat "$S/merge.txt")

## 2. year built + county roof records for the added doors
if [ -f "$S/year.ok" ]; then step "year files: done earlier ($(date -r "$S/year.ok" '+%m-%d %H:%M'))"; else
  mkdir -p "$S/year-before" && for k in $MERGE; do [ -f "$RD/year-$k.json" ] && [ ! -f "$S/year-before/year-$k.json" ] && cp "$RD/year-$k.json" "$S/year-before/"; done
  step "build-year for $(echo $MERGE | wc -w) towns"
  nice -n 19 node --max-old-space-size=8192 assessor/build-year.mjs --only="$(echo $MERGE | tr ' ' ',')" > "$S/build-year.out" 2>&1 || { tail -5 "$S/build-year.out"; stop "build-year.mjs failed"; }
  head -1 "$S/build-year.out"; tail -1 "$S/build-year.out"
  node --max-old-space-size=8192 -e "
const fs=require('fs');const R='$RD',B='$SN/year-before';const nw=JSON.parse(fs.readFileSync('$SN/newids.json'));let changed=[],gone=[],tw=0,yb=0,mat=0,nf=0;
for(const [k,ids] of Object.entries(nw)){const f=R+'/year-'+k+'.json';if(!fs.existsSync(f))continue;tw++;const N=JSON.parse(fs.readFileSync(f)).doors;
 const bf=B+'/year-'+k+'.json';if(fs.existsSync(bf)){const O=JSON.parse(fs.readFileSync(bf)).doors;for(const [i,v] of Object.entries(O)){if(!(i in N))gone.push(k+'/'+i);else if(JSON.stringify(N[i])!==JSON.stringify(v))changed.push(k+'/'+i)}}else nf++;
 for(const i of ids)if(N[i]){if(N[i].yb)yb++;if(N[i].mat)mat++}}
console.log('year files for '+tw+' towns ('+nf+' new); added doors now with year built '+yb+', with a county roof record '+mat);
if(changed.length||gone.length){console.error('existing entries changed '+changed.length+', gone '+gone.length+': '+changed.concat(gone).slice(0,8).join(' '));process.exit(1)}" || stop "build-year changed doors that were already there (old files in $S/year-before)"
  touch "$S/year.ok"
fi

## 3. the cloud pack
rm -rf "$S/in" && mkdir -p "$S/in/rounds" "$S/in/houses" || stop "scratch"
node --max-old-space-size=8192 -e "
const fs=require('fs');const R='$RD',O='$SN/in';const nw=JSON.parse(fs.readFileSync('$SN/newids.json'));const keys=fs.readFileSync('$SN/keys.txt','utf8').split(/\s+/).filter(Boolean);
const J=f=>JSON.parse(fs.readFileSync(f));const has=f=>fs.existsSync(f);const plan=['key\tkind\ttown\tn'];let na=0,nn=0,skipped=0;
for(const [t,ids] of Object.entries(nw)){const yf=R+'/year-'+t+'.json',rf=R+'/roof-'+t+'.json';if(!has(yf)||!has(rf)){skipped+=ids.length;continue}
 const mat=has(R+'/material-'+t+'.json')?(J(R+'/material-'+t+'.json').doors||{}):{};const want=new Set(ids.filter(i=>!mat[i]));if(!want.size)continue;
 const key=t+'-nd1118';const doors=J(R+'/'+t+'.json').areas.flatMap(a=>a.doors).filter(d=>want.has(d.id)&&typeof d.lat==='number').map(d=>({id:d.id,lat:d.lat,lon:d.lon}));if(!doors.length)continue;
 fs.writeFileSync(O+'/rounds/'+key+'.json',JSON.stringify({key,label:key,areas:[{name:'Added 15 Nov 2026',doors}]}));
 const sub=(f)=>{const j=J(f);const D={};for(const d of doors)if(j.doors&&j.doors[d.id])D[d.id]=j.doors[d.id];j.doors=D;return j};
 fs.writeFileSync(O+'/rounds/year-'+key+'.json',JSON.stringify(sub(yf)));fs.writeFileSync(O+'/rounds/roof-'+key+'.json',JSON.stringify(sub(rf)));
 const hf='roofs/houses-'+t+'.json';if(has(hf)){const h=J(hf);const D={};for(const d of doors)if(h[d.id])D[d.id]=h[d.id];fs.writeFileSync(O+'/houses/houses-'+key+'.json',JSON.stringify(D))}
 plan.push([key,'add',t,doors.length].join('\t'));na+=doors.length}
for(const k of keys){const yf=R+'/year-'+k+'.json',rf=R+'/roof-'+k+'.json';if(!has(yf)||!has(rf))continue;fs.copyFileSync(yf,O+'/rounds/year-'+k+'.json');fs.copyFileSync(rf,O+'/rounds/roof-'+k+'.json');
 const n=J(R+'/'+k+'.json').areas.reduce((s,a)=>s+a.doors.length,0);plan.push([k,'new',k,n].join('\t'));nn+=n}
fs.writeFileSync(O+'/plan.tsv',plan.join('\n')+'\n');
console.log('cloud pack: '+(plan.length-1)+' keys; added doors for the photo model '+na+' (in towns with year built + LiDAR), new-town doors re-predicted '+nn+'; added doors in towns without both files (county records only) '+skipped)" || stop "the cloud pack failed"
(cd "$S/in" && tar czf "$S/matnew-in.tgz" plan.tsv rounds houses) || stop "packing failed"
TAG="$(md5sum < "$S/matnew-in.tgz" | cut -c1-16) $(date +%Y%m%d)"
step "pack $(( $(stat -c %s "$S/matnew-in.tgz") / 1048576 )) MB, tag $TAG"

## 4. queue the stage
offhot
Q='~/run/fill1031'
state=$($VM "cd $Q || exit 1; if [ -f matnew.vmdone ] && [ \"\$(cat matnew-result.tag 2>/dev/null)\" = '$TAG' ]; then echo done; elif grep -q '^matnew' stages.txt && [ ! -f matnew.vmdone ] && [ ! -f matnew.failed ]; then echo queued; else echo start; fi") || stop "cloud machine not reachable"
step "cloud stage: $state"
[ "$state" = queued ] && [ "$($VM "cat $Q/matnew-tag.txt 2>/dev/null")" != "$TAG" ] && stop "matnew is queued or running with another pack: let it end (or move it aside) first"
if [ "$state" = start ]; then
  $VM "cat > $Q/matnew-in.tgz.part && mv $Q/matnew-in.tgz.part $Q/matnew-in.tgz" < "$S/matnew-in.tgz" || stop "could not send the pack"
  $VM "cat > $Q/matnew.sh.new && mv $Q/matnew.sh.new $Q/matnew.sh" < overnight/fill1031/matnew.sh || stop "could not send the stage script"
  $VM "cd $Q && echo '$TAG' > matnew-tag.txt && rm -f matnew.vmdone && { [ ! -f matnew.failed ] || mv matnew.failed vm-backup/matnew.failed.\$(date +%s); } && { grep -q '^matnew' stages.txt || echo 'matnew     # 18 Nov: roof material (county records + the photo model) for the every-home doors; laptop prep every1115/prep-matnew-2026-11-18.sh, finisher every1115/finish-matnew-2026-11-18.sh' >> stages.txt; } && echo queued" || stop "could not queue the stage"
fi
echo "$TAG" > "$S/tag.txt"
step "done: stage matnew queued on the cloud machine (after any stage before it); then bash every1115/finish-matnew-2026-11-18.sh > logs-finish-matnew.log 2>&1"
