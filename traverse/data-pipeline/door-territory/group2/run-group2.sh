#!/bin/bash
# Group 2, stage A on the cloud machine (2026-10-28, Matthew's go): the door lists for Larimer, Mesa and Pueblo in
# GROUP2-PLAN-2026-10-28.md. For each target in targets.json, in order (Larimer, Mesa, then Pueblo): pull the parcels (the statewide
# layer with build-walklist-co.mjs; Pueblo with build-walklist-pueblo.mjs, which takes the property address from the state's address
# points), keep the ones inside the Census boundary that are not doors already (clip-group2.mjs), one target at a time (one
# parcel-heavy job at a time on gis.colorado.gov). Resumable: a finished target has out/<key>.csv and <key>.done.
# Stops at "door lists ready": registering the towns, lawn/trees/yard/roofs and any upload follow Matthew's look at the counts.
# Start: nohup bash ~/run/group2/run-group2.sh > ~/run-group2.log 2>&1 &     status: ~/run-status.txt     counts: out/summary.tsv
set -u
G="$HOME/run/group2"; cd "$G" || exit 1; mkdir -p raw out
st() { echo "$(date -u +%FT%TZ) group2: $*" | tee "$HOME/run-status.txt"; }
# never two parcel pulls at once: wait while another group's runner is still pulling. Anchored to the start of the command line
# (^node, ^bash): an ssh "bash -c ..." that merely mentions these names matched the unanchored pattern on 28 Oct.
while pgrep -f "^node [^ ]*build-walklist|^bash [^ ]*(run-group1|queue2)\.sh" > /dev/null; do st "waiting: another parcel job is running"; sleep 600; done
st "starting stage A (door lists)"
node -e "for (const t of require('./targets.json')) console.log([t.key, t.method, t.countyUpper, t.lat, t.lon, t.radius].join('\t'))" > queue.tsv
n=0; total=$(wc -l < queue.tsv)
while IFS=$'\t' read -r key method county lat lon radius; do
  n=$((n+1))
  [ -f "$key.done" ] && continue
  [ "$(df -k --output=avail / | tail -1)" -ge 5242880 ] || { st "STOPPED at $key: under 5 GB free"; exit 1; }
  for try in 1 2 3; do
    st "pull $key ($n/$total, $method, r $radius mi), try $try"
    if [ "$method" = co ]; then
      node build-walklist-co.mjs --county="$county" --lat="$lat" --lon="$lon" --radius="$radius" --min-acres=0 --pieces="pieces-$key.json" --out="raw/$key.csv" > "raw/$key.log" 2>&1
    elif [ "$method" = pueblo ]; then
      node build-walklist-pueblo.mjs --lat="$lat" --lon="$lon" --radius="$radius" --min-acres=0 --pieces="pieces-$key.json" --out="raw/$key.csv" > "raw/$key.log" 2>&1
    else
      echo "$key: unknown method $method"; break
    fi
    rc=$?; if [ $rc -eq 0 ] && [ -s "raw/$key.csv" ]; then node clip-group2.mjs "$key" "raw/$key.csv" && touch "$key.done" && break; fi
    echo "$(date -u +%T) $key pull exit $rc (try $try)"; tail -3 "raw/$key.log"; sleep 120
  done
done < queue.tsv
# counts for the review: key, county, Census houses, rows, owner lives here
node -e "
const fs = require('fs'); const out = ['key\tcounty\tcensus\trows\towner_lives_here'];
for (const t of require('./targets.json')) { const f = 'out/' + t.key + '.csv'; if (!fs.existsSync(f)) { out.push([t.key, t.county, t.census, 'MISSING', ''].join('\t')); continue; }
  const ls = fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).slice(1); out.push([t.key, t.county, t.census, ls.length, ls.filter((l) => l.startsWith('\"YES\"')).length].join('\t')); }
fs.writeFileSync('out/summary.tsv', out.join('\n') + '\n');"
missing=$(grep -c MISSING out/summary.tsv)
if [ "$missing" -gt 0 ]; then st "stage A ended with $missing targets MISSING: see ~/run-group2.log and ~/run/group2/out/summary.tsv"; exit 1; fi
st "stage A done: door lists ready in ~/run/group2/out (waiting for review; counts in out/summary.tsv)"; echo "stage A done"
