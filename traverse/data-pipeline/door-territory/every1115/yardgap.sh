#!/bin/bash
# Stage yardgap (fill1031, 15 Nov 2026; EVERY-HOME-2026-11-15.md; main session: "So many of these lawns are still check before
# quoting"): the doors that have NO yard reading at all (about 215,000, mostly towns added since the last yard run: El Paso, PO-box,
# rented batches), measured with the 11 Nov settings (yard-scan-v2.mjs V2: green line 0.33, despeckle 4, roof buffer 1 m), the yardv3
# stage's own way (three workers, one town run per core). Slim lists from the laptop (every1115/yardgap-lists.mjs) in
# ~/run/lawn-trial/data-gap/<town>.json; readings into ~/run/lawn-trial/yard-gap/<town>.json; keys in ~/run/fill1031/yardgap-keys.txt,
# most owner-lived doors first. Laptop finisher: every1115/finish-yardgap-2026-11-15.sh (merges, never over an existing reading).
. "$HOME/run/fill1031/lib.sh"
cd "$LT" || exit 1
export YV2_DATA="$LT/data-gap" YV2_OUT=yard-gap
mkdir -p yard-gap
N=$(grep -c . "$Q/yardgap-keys.txt")
work() {
  local w=$1 i=0 k ok try rc
  while read -r k; do
    [ -z "$k" ] && continue; i=$((i + 1)); [ $(( (i - 1) % 3 )) -eq "$w" ] || continue
    [ -f "yard-gap/$k.finished" ] && continue
    ok=0
    for try in $(seq 1 40); do
      prune; room
      st "yardgap: worker $w at $k (key $i of $N; $(ls yard-gap/*.finished 2>/dev/null | wc -l) finished)"
      nice -n 5 node yard-v2-town.mjs --town="$k" --mins=60 --conc=32 < /dev/null; rc=$?
      [ $rc -eq 0 ] && { touch "yard-gap/$k.finished"; ok=1; break; }
      [ $rc -eq 3 ] || { echo "$(date -u +%T) $k exit $rc (try $try)"; sleep 60; }
    done
    [ $ok = 1 ] || echo "$k" >> "$Q/yardgap-skipped.txt"
  done < "$Q/yardgap-keys.txt"
}
work 0 > "$Q/yardgap-w0.log" 2>&1 & work 1 > "$Q/yardgap-w1.log" 2>&1 & work 2 > "$Q/yardgap-w2.log" 2>&1 &
wait
[ -s "$Q/yardgap-skipped.txt" ] && echo "skipped: $(tr '\n' ' ' < "$Q/yardgap-skipped.txt")"
F=$(ls yard-gap/*.finished | wc -l)
tar czf "$Q/yardgap-result.tgz.tmp" yard-gap/*.json && mv "$Q/yardgap-result.tgz.tmp" "$Q/yardgap-result.tgz" || exit 1
st "yardgap: done, $F/$N keys finished (~/run/fill1031/yardgap-result.tgz)"
