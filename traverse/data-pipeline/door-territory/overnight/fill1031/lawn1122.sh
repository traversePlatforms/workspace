#!/bin/bash
# Stage lawn1122 (fill1031, added 22 Nov 2026; Matthew 22 Nov "go ahead and run 1": the lawn accuracy pass before the cloud credit ends).
# The doors whose lawn reads under 1,200 sq ft (zero green, under-tree ranges, small readings) measured again with the 22 Nov low-green
# retune (yard-scan-v2.mjs V2_1122 = V2 + a second green line 0.18, despeckle 2, on lots reading under 1,200 sq ft; CLOUD-JOBS-2026-11-22.md).
# Door lists from the laptop (lawn-trial/yard-low-targets.mjs) in ~/run/lawn1122/lists/t1..t4/<key>.json, most useful first:
#   t1 owner-lived Check doors within 45 mi of Englewood, t2 other Check doors within 45 mi, t3 other low readings within 45 mi, t4 farther.
# Runs from ~/run/lawn-trial (its saved lot-line cells), with its own copies of the two scripts (yard-v2-town-1122.mjs,
# yard-scan-v2-1122.mjs) so nothing else in that folder changes; output ~/run/lawn-trial/yard-v4/ (the live yard-v2/ and yard-v3/ untouched).
# Every finished (tier, key) is gzipped to ~/run/lawn1122/out/<key>.json.gz and listed in ~/run/lawn1122/done.txt, so the laptop
# (overnight/lawn1122/pull-lawn1122.sh) copies results back town by town. NO laptop finisher: nothing here or there uploads anything;
# going live waits for Matthew.
. "$HOME/run/fill1031/lib.sh"
W="$HOME/run/lawn1122"
cd "$LT" || exit 1
export YV2_OUT=yard-v4 YV2_SETTINGS=1122 YV2_GRID_DATA="$LT/data"   # the whole town lists set the cell grid (yard-v2-town.mjs)
mkdir -p yard-v4 "$W/fin" "$W/out"
NW=6
work() {
  local w=$1 tier=$2 i=0 k ok try rc
  while read -r k; do
    [ -z "$k" ] && continue; [ -f "$W/lists/$tier/$k.json" ] || continue
    i=$((i + 1)); [ $(( (i - 1) % NW )) -eq "$w" ] || continue
    [ -f "$W/fin/$tier.$k" ] && continue
    [ -f "$LT/data/$k.json" ] || { echo "$tier $k (no whole door list)" >> "$W/skipped.txt"; continue; }
    [ -f "$W/stop" ] && return 0
    ok=0
    for try in $(seq 1 20); do
      prune; room
      st "lawn1122: $tier worker $w at $k ($(ls "$W/fin" | wc -l) tier-towns finished)"
      YV2_DATA="$W/lists/$tier" nice -n 10 node yard-v2-town-1122.mjs --town="$k" --mins=60 --conc=32 < /dev/null; rc=$?
      [ $rc -eq 0 ] && { ok=1; break; }
      [ $rc -eq 3 ] || { echo "$(date -u +%T) $tier $k exit $rc (try $try)"; sleep 60; }
    done
    if [ $ok = 1 ]; then
      gzip -c "yard-v4/$k.json" > "$W/out/$k.json.gz.tmp" && mv "$W/out/$k.json.gz.tmp" "$W/out/$k.json.gz"
      touch "$W/fin/$tier.$k"; echo "$(date -u +%FT%TZ) $tier $k" >> "$W/done.txt"
    else echo "$tier $k" >> "$W/skipped.txt"; fi
  done < "$W/keys.txt"
}
for tier in t1 t2 t3 t4; do
  [ -f "$W/stop" ] && break
  for w in $(seq 0 $((NW - 1))); do work "$w" "$tier" >> "$W/$tier-w$w.log" 2>&1 & done
  wait
  echo "$(date -u +%FT%TZ) $tier done" >> "$W/done.txt"
done
st "lawn1122: done, $(ls "$W/fin" | wc -l) tier-towns finished ($(cat "$W/skipped.txt" 2>/dev/null | wc -l) skipped); results ~/run/lawn1122/out"
