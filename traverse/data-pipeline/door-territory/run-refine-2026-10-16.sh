#!/bin/bash
# 2026-10-16 night: after run-fast-2026-10-16.sh, the compact lawn pass and the trees for every town it uploaded, then a re-upload.
# The neighbourhoods do not change, so assignments are untouched (no remap).
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
L=logs-refine; mkdir -p "$L"
step() { local name=$1; shift; until curl -s -m 10 -o /dev/null https://gis.colorado.gov/; do echo "$(date +%T) no internet, waiting"; sleep 60; done; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; local rc=$?; echo "$(date +%H:%M:%S) end   $name (exit $rc) $(tail -1 "$L/$name.log" | tr '\r' '\n' | tail -1 | cut -c1-150)"; return $rc; }
SSID=$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')
case "$SSID" in *iPhone*|*iphone*) echo "on the hotspot ($SSID) - not starting"; exit 1;; esac
echo "$(date +%T) network: ${SSID:-wired}"
bash hotspot-watchdog2.sh run-refine > "$L/watchdog.log" 2>&1 &
cat remap-assign.py | bash /c/Users/SURGEI~1/.ssh/sg.sh trav 'cat > ~/remap-assign.py && echo remap-ready'
rows() { [ -s "$1" ] && echo $(( $(wc -l < "$1") - 1 )) || echo 0; }
town() {   # town key, then the pull lines run by the caller
  :
}

# 2026-10-17: first the lawns the first ten towns could not read ("no parcel at the point": ~12,900 real houses in Denver alone short of a
# lot), then a re-upload; those towns already have compact + trees
for t in englewood south-denver sheridan cherry-hills-village littleton columbine-valley greenwood-village glendale denver; do
  echo "$(date +%T) == fill $t"
  step lawnfill-$t bash -c "cd lawn-trial && node lawn-fill.mjs --town=$t --conc=6"
  grep -q "nothing to fill" "$L/lawnfill-$t.log" && continue
  step rounds-$t node build-rounds-data.mjs
  bash upload-towns-sixfold.sh fill-$t $t
done
for t in $(grep -o "upload-towns-sixfold.sh allsizes-[a-z-]*" run-fast-2026-10-16.sh | sed 's/.*allsizes-//' | grep -v '^denver$'); do
  cat logs-fast-runner.log logs-fast2-runner.log logs-fast3-runner.log logs-fast4-runner.log logs-fast5-runner.log 2>/dev/null | grep -q "allsizes-$t uploaded" || continue
  echo "$(date +%T) == refine $t"
  step lawnfill-$t bash -c "cd lawn-trial && node lawn-fill.mjs --town=$t --conc=6"
  [ "$t" = broomfield ] && step value-broomfield node sample-value.mjs --only=broomfield
  step compact-$t bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=$t --conc=6"
  step trees-$t bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"
  step lookup-$t node build-lookup.mjs $t
  step rounds-$t node build-rounds-data.mjs
  bash upload-towns-sixfold.sh refine-$t $t
done
echo "$(date +%T) refine finished"
