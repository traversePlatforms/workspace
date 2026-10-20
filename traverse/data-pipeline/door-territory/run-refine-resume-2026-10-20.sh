#!/bin/bash
# 2026-10-20 RESUME of run-refine-2026-10-16.sh (made by make-refine-resume.cjs): skips done towns, stops itself on the iPhone hotspot.
# 2026-10-20 midday: gis.colorado.gov stopped answering from our addresses (fine from Europe) after the overnight pulls; the parcel steps (lawn fill, compact) run at --conc=3 instead of 6 to stay under its limits.
# The neighbourhoods do not change, so assignments are untouched (no remap).
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
L=logs-refine; mkdir -p "$L"
step() { local name=$1; shift; local W; W=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}'); case "$W" in *iPhone*|*iphone*) echo "$(date +%T) on the hotspot ($W) before $name - stopping"; touch logs-paused.flag; exit 3;; esac; until curl -s -m 10 -o /dev/null https://gis.colorado.gov/; do echo "$(date +%T) no internet, waiting"; sleep 60; done; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; local rc=$?; echo "$(date +%H:%M:%S) end   $name (exit $rc) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; return $rc; }
SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
case "$SSID" in *iPhone*|*iphone*) echo "on the hotspot ($SSID) - not starting"; exit 1;; esac
echo "$(date +%T) network: ${SSID:-wired}"
bash hotspot-watchdog2.sh run-refine > "$L/watchdog.log" 2>&1 &
cat remap-assign.py | bash /c/Users/SURGEI~1/.ssh/sg.sh trav 'cat > ~/remap-assign.py && echo remap-ready'
rows() { [ -s "$1" ] && echo $(( $(wc -l < "$1") - 1 )) || echo 0; }
town() {   # town key, then the pull lines run by the caller
  :
}

# (first-pass fills done 17 Oct: left out of the resume)
for t in $(grep -o "upload-towns-sixfold.sh allsizes-[a-z-]*" run-fast-2026-10-16.sh | sed 's/.*allsizes-//' | grep -v '^denver$'); do
  cat logs-fast-runner.log logs-fast2-runner.log logs-fast3-runner.log logs-fast4-runner.log logs-fast5-runner.log 2>/dev/null | grep -q "allsizes-$t uploaded" || continue
  cat logs-refine-runner*.log 2>/dev/null | grep -q "refine-$t uploaded" && continue   # resume: already refined
  echo "$(date +%T) == refine $t"
  step lawnfill-$t bash -c "cd lawn-trial && node lawn-fill.mjs --town=$t --conc=3"
  [ "$t" = broomfield ] && step value-broomfield node sample-value.mjs --only=broomfield
  step compact-$t bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=$t --conc=3"
  step trees-$t bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"
  step lookup-$t node build-lookup.mjs $t
  step rounds-$t node build-rounds-data.mjs
  bash upload-towns-sixfold.sh refine-$t $t
done
echo "$(date +%T) refine finished"
