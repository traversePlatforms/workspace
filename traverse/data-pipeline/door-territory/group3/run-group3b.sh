#!/bin/bash
# Group 3b, stage A on the cloud machine (2026-10-29, Matthew: "We need to add them in anyways ... by having it in the system people can
# input data that they have"): door lists from the state's address points for the 11 skipped counties that have them (targets-3b.json,
# GROUP3-PLAN-2026-10-29.md "Group 3b"). Per county one pull (build-walklist-pts.mjs: points, Census blocks, building outlines, and
# parcels where the county has them), then each place and rural sweep is cut from it in order by clip-group3.mjs (same house = same
# address, our doors within 5 m, a sweep never repeats a place). Resumable: raw3b/<county>.done, <key>.done. Stops under 5 GB free.
# One parcel-heavy job at a time on gis.colorado.gov: started by queue-after-g3a.sh once Group 3 stage A (and its Teller sweep) is over;
# refuses to start while another parcel runner is going. Ends at "group3b A: door lists ready" + g3b.vmdone; counts in out/summary-3b.tsv.
# Nothing registered or uploaded: stage B needs Matthew's go.
#   bash ~/run/group3/run-group3b.sh >> ~/run-group3.log 2>&1
set -u
G="$HOME/run/group3"; cd "$G" || exit 1; mkdir -p raw3b out
BLD="$HOME/run/tv/traverse/data-pipeline/door-territory/tree-zones/buildings"
st() { echo "$(date -u +%FT%TZ) group3b A: $*" | tee "$HOME/run-status.txt"; }
while pgrep -f "^node [^ ]*build-walklist|^bash [^ ]*(run-group1|run-group2|run-group3|queue2)\.sh" > /dev/null; do st "waiting: another parcel job is running"; sleep 300; done
st "starting (address-point door lists, $(node -e "console.log(new Set(require('./targets-3b.json').map(t=>t.county)).size)") counties)"
# building outline tiles first (Microsoft's store, not gis.colorado.gov; only the ones not on disk)
(cd "$BLD/.." && node --max-old-space-size=6144 fetch-buildings.mjs $(cat "$G/tiles-3b.txt") | grep -v "have it" | tail -5)
node -e "const s=new Set();for(const t of require('./targets-3b.json'))if(!s.has(t.county)){s.add(t.county);console.log(t.county+'\t'+t.method)}" > queue-3b.tsv
while IFS=$'\t' read -r county method; do
  c=$(echo "$county" | tr 'A-Z ' 'a-z-')
  [ -f "raw3b/$c.done" ] && continue
  [ "$(df -k --output=avail / | tail -1)" -ge 5242880 ] || { st "STOPPED at $county: under 5 GB free"; exit 1; }
  for try in 1 2 3; do
    st "pull $county ($method), try $try"
    node --max-old-space-size=8192 build-walklist-pts.mjs --county="$county" --buildings="$BLD" --out="raw3b/$c.csv" $([ "$method" = "pts+parcels" ] && echo --parcels) > "raw3b/$c.log" 2>&1
    rc=$?; cat "raw3b/$c.log" | grep -E "homes:|dropped:|address points:|Census blocks:|building outlines:|parcels:"
    if [ $rc -eq 0 ] && [ -s "raw3b/$c.csv" ]; then touch "raw3b/$c.done"; break; fi
    echo "$(date -u +%T) $county exit $rc (try $try)"; tail -3 "raw3b/$c.log"; sleep 120
  done
done < queue-3b.tsv
# cut each county into its targets, in order
node -e "for (const t of require('./targets-3b.json')) console.log(t.key + '\t' + t.county)" > queue-3b-targets.tsv
while IFS=$'\t' read -r key county; do
  c=$(echo "$county" | tr 'A-Z ' 'a-z-')
  [ -f "$key.done" ] && continue; [ -f "raw3b/$c.done" ] || continue
  node clip-group3.mjs "$key" "raw3b/$c.csv" && touch "$key.done"
done < queue-3b-targets.tsv
node summary-g3.mjs targets-3b.json summary-3b.tsv
missing=$(grep -c MISSING out/summary-3b.tsv)
if [ "$missing" -gt 0 ]; then st "ended with $missing targets MISSING: see ~/run-group3.log, raw3b/*.log and out/summary-3b.tsv"; exit 1; fi
touch "$G/g3b.vmdone"
st "door lists ready in ~/run/group3/out (waiting for Matthew's review; counts in out/summary-3b.tsv)"; echo "group 3b stage A done"
