#!/bin/bash
# Finish lawn1122 on the cloud computer (24 Nov 2026). yardtest was stopped by Matthew with ~64,000 t4 doors left: gis.colorado.gov had
# stopped answering yardtest (its towns came back with "lot lines not fetched ... wait for the next run"). Matthew: "can u finish the rest
# on traverse servers"; run HERE, straight to gis.colorado.gov, never through the Traverse server (its IP serves the live door cards'
# property lines, rounds.php parcelat).
# The same code as yardtest (lawn-trial/yard-v2-town.mjs with YV2_SETTINGS=1122, YV2_OUT=yard-v4) on only the doors not in yard-v4 yet;
# it adds to lawn-trial/yard-v4/<key>.json in place, the same files the copy-back filled, and each finished tier-town goes in pulled.txt.
# Gentle: 2 workers at nice 19, 8 lots at a time each; yard-v2-town.mjs asks gis.colorado.gov one request at a time across both workers
# (its lock folder, 0.3 s gap: at most ~3 a second) and backs off 2 s .. 2 min on a failure.
# If the state server stops answering here too (6 runs in a row with lot lines not fetched and nothing measured), it stops and says so.
# Nothing is merged into yard-v2, built or uploaded: going live waits for Matthew's check (CLOUD-JOBS-2026-11-22.md "Going live").
#   systemd-run --user --unit=lawn1122-finish -p Nice=19 -p MemoryMax=3G bash .../finish-lawn1122-vm.sh
# Log: lawn-trial/yard-v4/finish-vm.log (workers: ~/run/lawn1122-vm/w<n>.log)
set -u
R="$(cd "$(dirname "$0")/../../../../.." && pwd)"
D="$R/traverse/data-pipeline/door-territory"; LT="$D/lawn-trial"; H="$D/overnight/lawn1122"
W="$HOME/run/lawn1122-vm"; mkdir -p "$W/grid" "$W/fin"
LOG="$LT/yard-v4/finish-vm.log"; GOT="$LT/yard-v4/pulled.txt"
JS="$R/assistant/jarvis/tools/jarvis-status.sh"
NW=2; CONC=8
say() { echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }
cd "$LT" || exit 1
export YV2_OUT=yard-v4 YV2_SETTINGS=1122 YV2_GRID_DATA="$W/grid"
[ -f "$W/start.txt" ] || node "$H/left-lawn1122.mjs" "$LT" > "$W/start.txt"
grep -v '^#' "$W/start.txt" > "$W/todo.txt"
read -r _ TOTAL LEFT0 < <(grep '^#total' "$W/start.txt")
say "start: $(wc -l < "$W/todo.txt") tier-towns, $LEFT0 of $TOTAL doors left"
# the cell grid from the whole town's door list where this machine has one (app/data/rounds), else the tier list (no saved cells here)
while read -r t k n; do
  if [ -f "$D/../../app/data/rounds/$k.json" ]; then ln -sf "$D/../../app/data/rounds/$k.json" "$W/grid/$k.json"
  else ln -sf "$LT/yard-low-targets/$t/$k.json" "$W/grid/$k.json"; fi
done < "$W/todo.txt"
progress() {
  local out left done pct
  out=$(node "$H/left-lawn1122.mjs" "$LT" --keys="$W/todo.txt" 2>/dev/null | grep '^#total') || return
  left=$(echo "$out" | awk '{print $3}'); done=$((TOTAL - left))
  pct=$(( 30 + 50 * done / TOTAL ))
  bash "$JS" build pct lawn-tune-1122 "$pct" "Cloud computer finishing the low-lawn re-measure: $done of $TOTAL doors measured ($left left)" >/dev/null 2>&1
  say "$done/$TOTAL doors measured, $left left"
}
work() {
  local w=$1 i=0 t k n try rc ok res
  while read -r t k n; do
    i=$((i + 1)); [ $(( (i - 1) % NW )) -eq "$w" ] || continue
    [ -f "$W/fin/$t.$k" ] && continue
    ok=0
    for try in $(seq 1 20); do
      [ -f "$W/stop" ] && return 0
      YV2_DATA="$LT/yard-low-targets/$t" node yard-v2-town.mjs --town="$k" --mins=30 --conc=$CONC < /dev/null > "$W/w$w.run" 2>&1; rc=$?
      cat "$W/w$w.run" >> "$W/w$w.log"
      res=$(grep '^slice done' "$W/w$w.run" | tail -1)
      if [ $rc -eq 0 ]; then ok=1; break; fi
      if [ $rc -eq 3 ] && grep -q 'lot lines not fetched' "$W/w$w.run" && echo "$res" | grep -q '^slice done: 0 '; then
        echo x >> "$W/gisfail"; say "$t $k: lot lines not fetched, nothing measured (try $try; $(wc -l < "$W/gisfail") in a row)"
        [ "$(wc -l < "$W/gisfail")" -ge 6 ] && { touch "$W/stop"; say "gis.colorado.gov is not answering this machine: stopped"; return 0; }
        sleep 120
      else
        rm -f "$W/gisfail"
        [ $rc -eq 3 ] || { say "$t $k exit $rc (try $try)"; sleep 60; }
      fi
    done
    if [ $ok = 1 ]; then
      rm -f "$W/gisfail"; touch "$W/fin/$t.$k"; grep -qx "$t $k" "$GOT" || echo "$t $k" >> "$GOT"; say "$t $k finished"
    else say "$t $k skipped after 20 tries"; echo "$t $k" >> "$W/skipped.txt"; fi
  done < "$W/todo.txt"
}
for w in $(seq 0 $((NW - 1))); do work "$w" & done
( while sleep 300; do progress; done ) & PP=$!
wait $(jobs -p | grep -v "^$PP$")
kill $PP 2>/dev/null
out=$(node "$H/left-lawn1122.mjs" "$LT" | tee "$W/end.txt" | grep '^#total'); left=$(echo "$out" | awk '{print $3}'); all=$(echo "$out" | awk '{print $2}')
measured=$((all - left))
if [ -f "$W/stop" ]; then
  say "stopped: $left doors left"
  bash "$JS" build pct lawn-tune-1122 $(( 30 + 50 * measured / all )) "Stopped: gis.colorado.gov stopped answering the cloud computer; $left doors left" >/dev/null 2>&1
  bash "$JS" alert "lawn1122 finish stopped on the cloud computer: gis.colorado.gov stopped answering it, $left of $all doors are still unmeasured. Nothing was switched to the Traverse server. Going live with the readings so far waits for your check." >/dev/null 2>&1
elif [ "$left" -eq 0 ]; then
  say "finished: all $all doors measured"
  bash "$JS" build pct lawn-tune-1122 80 "All $all doors measured; going live waits for Matthew's check" >/dev/null 2>&1
  bash "$JS" alert "lawn1122 is finished: all $all doors measured. Going live with the new lawn readings waits for your check." >/dev/null 2>&1
else
  say "finished: $measured of $all doors measured, $left could not be read (see $W/end.txt)"
  bash "$JS" build pct lawn-tune-1122 80 "$measured of $all doors measured ($left could not be read); going live waits for Matthew's check" >/dev/null 2>&1
  bash "$JS" alert "lawn1122 is finished: $measured of $all doors measured ($left could not be read and keep their live reading). Going live with the new lawn readings waits for your check." >/dev/null 2>&1
fi
