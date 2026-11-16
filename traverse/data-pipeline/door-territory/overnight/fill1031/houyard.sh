#!/bin/bash
# Stage houyard (fill1031, added 16 Nov 2026; Matthew 16 Nov: a Texas edition, Houston, lawn care and aeration only): yard v2 lawn
# measuring for every Houston door (metros/hou.json), queued after ehb. Runs from its own folder ~/run/hou/ (code copied from
# ~/run/fill1031/hou/ when the stage starts), so nothing of the Colorado stages' code or data is touched:
#   ~/run/hou/lawn-trial/   yard-scan-v2.mjs (with the metro options: Texas photo years, laser surveys, UTM 15) + build-yard-v2.mjs
#   ~/run/hou/tree-zones/   lidar.mjs (the laptop's copy)            node_modules: links to the Colorado folders' modules
#   ~/run/hou/metros/       yard-metro.mjs + hou.json                 data/ slim door files, lots/ lot lines (from the county files)
# No parcel service is asked: the lot lines came from the county files. The laser tiles share ~/run/tree-zones/lidar-cache (prune
# keeps it under 25 GB). Three workers, as yardv3. Output ~/run/hou/lawn-trial/yard-metro/<town>.json, tarred to houyard-result.tgz.
# Laptop finisher (by hand, nothing uploaded): traverse/data-pipeline/door-territory/metros/finish-houyard.sh
. "$HOME/run/fill1031/lib.sh"
H="$HOME/run/hou"; IN="$Q/hou"
[ -f "$IN/towns.txt" ] || { echo "no $IN/towns.txt"; exit 1; }
mkdir -p "$H/lawn-trial/yard-metro" "$H/tree-zones" "$H/metros" "$H/data" "$H/lots"
cp "$IN/yard-scan-v2.mjs" "$IN/build-yard-v2.mjs" "$H/lawn-trial/" && cp "$IN/lidar.mjs" "$H/tree-zones/" && cp "$IN/yard-metro.mjs" "$IN/hou.json" "$H/metros/" || exit 1
[ -e "$H/lawn-trial/node_modules" ] || ln -s "$HOME/run/lawn-trial/node_modules" "$H/lawn-trial/node_modules"
[ -e "$H/tree-zones/node_modules" ] || ln -s "$HOME/run/tree-zones/node_modules" "$H/tree-zones/node_modules"
[ -f "$H/data/.unpacked" ] || { tar xzf "$IN/hou-data.tgz" -C "$H" && touch "$H/data/.unpacked"; } || exit 1
cd "$H" || exit 1
export YV2_DATA="$H/data" METRO_LOTS="$H/lots" LIDAR_CACHE="$LIDAR"
N=$(grep -c . "$IN/towns.txt")
work() {
  local w=$1 i=0 k ok try rc
  while read -r k; do
    [ -z "$k" ] && continue; i=$((i + 1)); [ $(( (i - 1) % 3 )) -eq "$w" ] || continue
    [ -f "lawn-trial/yard-metro/$k.finished" ] && continue
    ok=0
    for try in $(seq 1 40); do
      prune; room
      st "houyard: worker $w at $k (town $i of $N; $(ls lawn-trial/yard-metro/*.finished 2>/dev/null | wc -l) finished)"
      nice -n 5 node metros/yard-metro.mjs --metro=hou --town="$k" --mins=60 --conc=24 < /dev/null; rc=$?
      [ $rc -eq 0 ] && { touch "lawn-trial/yard-metro/$k.finished"; ok=1; break; }
      [ $rc -eq 3 ] || { echo "$(date -u +%T) $k exit $rc (try $try)"; sleep 60; }
    done
    [ $ok = 1 ] || echo "$k" >> "$Q/houyard-skipped.txt"
  done < "$IN/towns.txt"
}
work 0 > "$Q/houyard-w0.log" 2>&1 & work 1 > "$Q/houyard-w1.log" 2>&1 & work 2 > "$Q/houyard-w2.log" 2>&1 &
wait
[ -s "$Q/houyard-skipped.txt" ] && echo "skipped: $(tr '\n' ' ' < "$Q/houyard-skipped.txt")"
F=$(ls lawn-trial/yard-metro/*.finished | wc -l)
tar czf "$Q/houyard-result.tgz.tmp" lawn-trial/yard-metro/*.json && mv "$Q/houyard-result.tgz.tmp" "$Q/houyard-result.tgz" || exit 1
st "houyard: done, $F/$N towns finished (~/run/fill1031/houyard-result.tgz)"
