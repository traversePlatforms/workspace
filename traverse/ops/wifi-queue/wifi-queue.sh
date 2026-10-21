#!/bin/bash
# The Wi-Fi queue (2026-10-20, Matthew: "A lot of stuff needs solid wifi ... build a priority system"; "build the que out").
#
# One runner for every job that needs real Wi-Fi, in the order in queue.txt. It replaces the separate "wait for Wi-Fi" scripts.
#   - Never starts anything on Matthew's iPhone hotspot; a job already running is stopped by the hotspot watchdog (its downloads too).
#   - Jobs marked "parcel" need the state parcel map (gis.colorado.gov) to answer from this network; the office network has been refused
#     before, so there they wait and the next job that can run, runs.
#   - Jobs that rebuild and upload town files ("pipeline") take turns, one at a time: every rebuild rewrites all the town files.
#   - A job runs one unit at a time (one town) and says whether more is left (exit 3), it is finished (exit 0), or it failed (other).
#     After each unit of the first job, the next job down that can run gets a unit, so the small jobs are not stuck behind a 40-hour one.
#   - Three failures in a row and a job is parked (state/<id>.failed) for a person to look at.
# Started by the Windows task "Traverse Wi-Fi queue" (at logon and every 30 minutes); a second copy exits at once.
# Status: state/status.txt (the overnight check reads it). Logs: logs/.
Q="/c/Users/Surge Inc/Desktop/claude test 2/traverse/ops/wifi-queue"
DT="/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
cd "$Q" || exit 1
mkdir -p state logs
if [ -f state/runner.pid ] && kill -0 "$(cat state/runner.pid)" 2>/dev/null; then exit 0; fi
echo $$ > state/runner.pid
trap 'rm -f state/runner.pid' EXIT
log() { echo "$(date '+%m-%d %H:%M:%S') $*" >> logs/queue.log; }
ssid() { netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}'; }
online() { [ "$(curl -s -m 10 -o /dev/null -w '%{http_code}' https://www.google.com/generate_204)" = "204" ]; }
gis_ok() { [ "$(curl -s -m 20 -o /dev/null -w '%{http_code}' 'https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0?f=json')" = "200" ]; }
status() { { echo "$(date '+%Y-%m-%d %H:%M') network: ${NET:-?} | parcel map: ${GIS:-?}"; echo "now: $*"; while IFS='|' read -r id kind title; do
  [ -z "$id" ] || [ "${id:0:1}" = "#" ] && continue
  if [ -f "state/$id.done" ]; then s="done $(date -r "state/$id.done" '+%m-%d %H:%M')"; elif [ -f "state/$id.failed" ]; then s="PARKED after 3 failures (see logs/$id-*.log)"; else s="waiting${UNITS:+}"; [ -f "state/$id.units" ] && s="$s, $(cat "state/$id.units") unit(s) done"; fi
  echo "  $id ($kind): $title -- $s"; done < queue.txt; } > state/status.txt; }
LAST=""
log "runner started (pid $$)"
while true; do
  S=$(ssid); NET="${S:-wired}"
  case "$S" in *iPhone*|*iphone*) GIS="not checked"; status "paused: on the iPhone hotspot"; sleep 120; continue;; esac
  if ! online; then GIS="not checked"; NET="$NET (no internet)"; status "paused: no internet"; sleep 120; continue; fi
  if gis_ok; then GIS="answers"; else GIS="NOT answering from here"; fi
  # pick: eligible = not done, not parked, parcel jobs only when the map answers. After a unit of the first eligible job, the next
  # eligible job gets a turn (if there is one); otherwise the first.
  ELIG=()
  while IFS='|' read -r id kind title; do
    [ -z "$id" ] || [ "${id:0:1}" = "#" ] && continue
    [ -f "state/$id.done" ] || [ -f "state/$id.failed" ] && continue
    case "$kind" in *parcel*) [ "$GIS" = "answers" ] || continue;; esac
    ELIG+=("$id")
  done < queue.txt
  if [ ${#ELIG[@]} -eq 0 ]; then
    ALLDONE=1; PARKED=""; while IFS='|' read -r id kind title; do [ -z "$id" ] || [ "${id:0:1}" = "#" ] && continue; [ -f "state/$id.failed" ] && { PARKED="$PARKED $id"; continue; }; [ -f "state/$id.done" ] || ALLDONE=0; done < queue.txt
    if [ $ALLDONE = 1 ] && [ -z "$PARKED" ]; then status "everything in the queue is done"; log "all done"; exit 0; fi
    if [ $ALLDONE = 1 ]; then status "everything else is done; parked after 3 failures:$PARKED"; log "done except parked:$PARKED"; exit 0; fi
    status "waiting: nothing can run on this network right now"; sleep 300; continue
  fi
  PICK="${ELIG[0]}"; [ "$LAST" = "${ELIG[0]}" ] && [ ${#ELIG[@]} -gt 1 ] && PICK="${ELIG[1]}"
  STAMP=$(date +%Y%m%d-%H%M%S); OUT="logs/$PICK-$STAMP.log"
  status "running $PICK (log $OUT)"; log "start $PICK on $NET (parcel map: $GIS)"
  rm -f "$DT/logs-paused.flag"   # the watchdog leaves it on the hotspot; on Wi-Fi again, the work is running
  bash "jobs/$PICK.sh" > "$OUT" 2>&1 &
  JP=$!
  ( cd "$DT" && bash hotspot-watchdog2.sh "jobs/$PICK.sh" ) > "logs/watchdog-$STAMP.log" 2>&1 &
  wait $JP; RC=$?
  LAST="$PICK"
  case $RC in
    0) touch "state/$PICK.done"; rm -f "state/$PICK.fails"; log "end $PICK: finished"; echo $(( $(cat "state/$PICK.units" 2>/dev/null || echo 0) + 1 )) > "state/$PICK.units";;
    3) rm -f "state/$PICK.fails"; log "end $PICK: one unit done, more left"; echo $(( $(cat "state/$PICK.units" 2>/dev/null || echo 0) + 1 )) > "state/$PICK.units";;
    4) log "end $PICK: stopped (hotspot, network, or an older run still going) - will resume"; sleep 120;;
    *) F=$(( $(cat "state/$PICK.fails" 2>/dev/null || echo 0) + 1 )); echo $F > "state/$PICK.fails"; log "end $PICK: FAILED (exit $RC, $F in a row; log $OUT)"
       [ $F -ge 3 ] && { touch "state/$PICK.failed"; log "$PICK parked after 3 failures"; }; sleep 60;;
  esac
done
