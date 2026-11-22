#!/bin/bash
# Copy-back for VM stage lawn1122 (22 Nov 2026, CLOUD-JOBS-2026-11-22.md). Run on the laptop, in the background:
#   bash traverse/data-pipeline/door-territory/overnight/lawn1122/pull-lawn1122.sh [--once]
# Every 4 minutes: reads ~/run/lawn1122/done.txt on the cloud machine and copies each newly finished town's result
# (~/run/lawn1122/out/<key>.json.gz, a few hundred KB) to lawn-trial/yard-v4/<key>.json, so a shutdown loses at most the towns in
# progress. Skips a round on the phone hotspot (SSID "iPhone"). Moves the J.A.R.V.I.S. build ring (lawn-tune-1122, 30-80%) by doors done.
# Copies only: nothing is merged, built or uploaded. Stops when the VM writes "t4 done" (or the machine stops answering for 3 hours).
set -u
R="$(cd "$(dirname "$0")/../../../../.." && pwd)"
LT="$R/traverse/data-pipeline/door-territory/lawn-trial"
OUT="$LT/yard-v4"; mkdir -p "$OUT"
K="$HOME/.ssh/azure_yard"; V=yard@20.91.198.101
SSHO=(-i "$K" -o ConnectTimeout=25 -o ServerAliveInterval=15 -o BatchMode=yes)
LOG="$OUT/pull.log"; GOT="$OUT/pulled.txt"; touch "$GOT"
TOTAL=$(node -e "const s=require(process.argv[1]).total;console.log(s.t1+s.t2+s.t3+s.t4)" "$LT/yard-low-targets/summary.json")
fails=0
while :; do
  ssid=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ +SSID/{print $2; exit}')
  if [ "$ssid" = "iPhone" ]; then echo "$(date -u +%FT%TZ) hotspot: skipped" >> "$LOG"
  elif done_txt=$(ssh "${SSHO[@]}" $V 'cat ~/run/lawn1122/done.txt 2>/dev/null; echo "#status $(cat ~/run-status.txt)"' 2>>"$LOG"); then
    fails=0
    printf '%s\n' "$done_txt" > "$OUT/vm-done.txt"
    while read -r at tier key; do
      [ -z "${key:-}" ] && continue; [ "$key" = "done" ] && continue
      grep -qx "$tier $key" "$GOT" && continue
      if scp -q "${SSHO[@]}" "$V:run/lawn1122/out/$key.json.gz" "$OUT/$key.json.gz.part" 2>>"$LOG" && gzip -dc "$OUT/$key.json.gz.part" > "$OUT/$key.json.tmp" \
         && node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$OUT/$key.json.tmp"; then
        mv "$OUT/$key.json.tmp" "$OUT/$key.json"; rm -f "$OUT/$key.json.gz.part"; echo "$tier $key" >> "$GOT"
      else rm -f "$OUT/$key.json.tmp" "$OUT/$key.json.gz.part"; echo "$(date -u +%FT%TZ) $tier $key: copy failed, next round" >> "$LOG"; fi
    done < <(grep -v '^#' "$OUT/vm-done.txt" | awk 'NF==3')
    n=$(node -e "
      const fs=require('fs'),s=require(process.argv[1]).towns;let n=0;
      for(const l of fs.readFileSync(process.argv[2],'utf8').split('\n')){const [t,k]=l.trim().split(' ');if(k&&s[k])n+=s[k][t]||0;}
      console.log(n)" "$LT/yard-low-targets/summary.json" "$GOT")
    pct=$(( 30 + 50 * n / TOTAL ))
    tiers=$(grep -c ' done$' "$OUT/vm-done.txt")
    bash "$R/assistant/jarvis/tools/jarvis-status.sh" build pct lawn-tune-1122 "$pct" "Cloud machine re-measuring low lawns: $n of $TOTAL doors back on the laptop ($tiers of 4 passes done)" >/dev/null 2>&1
    echo "$(date -u +%FT%TZ) $n/$TOTAL doors pulled, tiers done $tiers" >> "$LOG"
    grep -q ' t4 done$' "$OUT/vm-done.txt" && { echo "$(date -u +%FT%TZ) VM finished" >> "$LOG"; exit 0; }
  else
    fails=$((fails + 1)); echo "$(date -u +%FT%TZ) VM not answering ($fails)" >> "$LOG"
    [ $fails -ge 45 ] && { echo "$(date -u +%FT%TZ) VM gone for 3 hours: stopping" >> "$LOG"; exit 2; }
  fi
  [ "${1:-}" = "--once" ] && exit 0
  sleep 240
done
