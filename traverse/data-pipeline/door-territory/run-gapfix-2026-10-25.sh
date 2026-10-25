#!/bin/bash
# The other towns the 2026-10-16 footprint filter cut down (2026-10-25, Matthew: "we cant afford to miss any"; Centennial was fixed first by
# run-centennial-west-2026-10-25.sh). A parcel-by-parcel check (scratchpad holes/verify-holes.mjs) found houses with no door near them:
# Denver ~39,200 + ~10,900 rowhouses (its Oct 16 pull had 133,597 doors to knock; the filter kept 48,663), Aurora ~1,380, Littleton ~690,
# Westminster ~420, Thornton ~390, Edgewater ~280, Arvada/Lakewood ~160, Greenwood Village ~110.
# Per town, smallest first: pull every county piece by the town's LEGAL boundary (--municipality, no lot minimum, 10-acre cap), merge with
# the current list (parcel id decides a duplicate, current rows win: nothing on the list now is lost), the usual steps, upload, remap the
# assignments. Denver drops any parcel South Denver already has. A town that comes back no bigger is put back and skipped.
# One parcel-heavy job at a time (2026-10-11 rule). Run from this folder:  bash run-gapfix-2026-10-25.sh > logs-gapfix.log 2>&1
set -u
cd "$(dirname "$0")"
L=logs-gapfix; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; local rc=$?; echo "$(date +%H:%M:%S) end   $name (exit $rc) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; return $rc; }
rows() { [ -s "$1" ] && echo $(( $(wc -l < "$1") - 1 )) || echo 0; }
pull() { node build-walklist-co.mjs --county="$1" --lat="$2" --lon="$3" --radius="$4" --min-acres=0 --municipality="$5" --out="$6"; }

fix() {   # fix <town> <Municipality> then "COUNTY lat lon radius" pieces
  local t=$1 muni=$2; shift 2
  echo "$(date +%T) == $t"
  cp "$t.csv" "$t.csv.bak-gapfix-2026-10-25"; cp "$t-areas.json" "$t-areas.json.bak-gapfix-2026-10-25" 2>/dev/null
  local OLD; OLD=$(rows "$t.csv.bak-gapfix-2026-10-25"); local outs="" i=0
  for piece in "$@"; do
    i=$((i + 1)); set -- $piece
    local o="$t-legal-$(echo "$1" | tr 'A-Z' 'a-z').csv"
    step "pull-$t-$i" pull "$1" "$2" "$3" "$4" "$muni" "$o" || { echo "$(date +%T) $t: pull $i failed, town skipped"; return 1; }
    [ -s "$o" ] && outs="$outs $o"
  done
  [ -n "$outs" ] || { echo "$(date +%T) $t: nothing pulled, skipped"; return 1; }
  step "merge-$t" node merge-walklists.mjs "$t.csv" "$t.csv.bak-gapfix-2026-10-25" $outs || { cp "$t.csv.bak-gapfix-2026-10-25" "$t.csv"; return 1; }
  if [ "$t" = denver ]; then step "denver-not-south" node -e "
    const fs=require('fs'),rd=(f)=>fs.readFileSync(f,'utf8').trim().split(/\r?\n/);
    const s=rd('south-denver.csv'),ip=s[0].split(',').indexOf('parcel'),key=(l)=>l.replace(/^\"|\"$/g,'').split('\",\"')[ip];
    const have=new Set(s.slice(1).map(key)),d=rd('denver.csv'),keep=[d[0]].concat(d.slice(1).filter((l)=>!have.has(key(l))));
    fs.writeFileSync('denver.csv',keep.join('\n')+'\n');console.log('denver kept',keep.length-1,'dropped',d.length-keep.length,'already in south-denver')"; fi
  local NEW; NEW=$(rows "$t.csv")
  echo "$(date +%T) $t: $OLD -> $NEW rows"
  if [ "$NEW" -le "$OLD" ]; then echo "$(date +%T) $t: not bigger, old files back"; cp "$t.csv.bak-gapfix-2026-10-25" "$t.csv"; cp "$t-areas.json.bak-gapfix-2026-10-25" "$t-areas.json" 2>/dev/null; return 1; fi
  step "areas-$t" node build-walklist-pdf.mjs "$t.csv" --no-pdf || return 1
  step "lawn-$t" bash -c "cd lawn-trial && node sample-lawn.mjs --town=$t --conc=16"
  step "compact-$t" bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=$t --conc=6"
  step "trees-$t" bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"
  step "value-$t" node sample-value.mjs --only=$t
  step "lookup-$t" node build-lookup.mjs $t
  step "rounds-$t" node build-rounds-data.mjs || return 1
  bash upload-towns-sixfold.sh "gapfix-$t-2026-10-25" $t || return 1
  [ -f "logs-upload/gapfix-$t-2026-10-25.done" ] || { echo "$(date +%T) $t: upload did not finish"; return 1; }
  bash /c/Users/SURGEI~1/.ssh/sg.sh trav "python3 ~/remap-assign.py $t ~/upload-backups/before-gapfix-$t-2026-10-25.tgz" < /dev/null
  echo "$(date +%T) $t done"
}

fix greenwood-village 'Greenwood Village' "ARAPAHOE 39.6163 -104.9100 6"
fix edgewater 'Edgewater' "JEFFERSON 39.7512 -105.0630 3"
fix lakewood 'Lakewood' "JEFFERSON 39.7032 -105.1060 9"
fix arvada 'Arvada' "JEFFERSON 39.8259 -105.1175 9" "ADAMS 39.8259 -105.1175 9"
fix thornton 'Thornton' "ADAMS 39.9183 -104.9417 8" "WELD 39.9183 -104.9417 8"
fix westminster 'Westminster' "ADAMS 39.8755 -105.0541 8" "JEFFERSON 39.8755 -105.0541 8"
fix littleton 'Littleton' "ARAPAHOE 39.5991 -105.0102 5" "JEFFERSON 39.5991 -105.0102 5" "DOUGLAS 39.5991 -105.0102 5"
fix aurora 'Aurora' "ARAPAHOE 39.6796 -104.7814 13" "ADAMS 39.6796 -104.7814 13" "DOUGLAS 39.6796 -104.7814 13"
fix denver 'Denver' "DENVER 39.7477 -104.8967 14"
echo "$(date +%T) all done"
