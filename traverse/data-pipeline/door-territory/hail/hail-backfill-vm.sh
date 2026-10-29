#!/bin/bash
# Hail and wind history for the towns that have none (2026-10-29, Matthew). Runs on the cloud machine in ~/run/hailfill, beside a copy of
# hail/, wind/, storm-keep.mjs, metros/ and stormstage/ (door points with no owners, from `node backfill-hail.mjs stage`).
# Not gis.colorado.gov: the radar files come from Iowa State's archive, the reports from NOAA and Iowa Environmental Mesonet, so this
# may run beside Group 3's parcel pulls. Niced, three downloads at a time (build-hail.mjs's own pace).
#   1. the radar's daily hail maximum (MRMS MESH) for every day the keep rule can still hold (from 2021-10-01: five years for a storm of
#      2 in, two years otherwise), over the whole state (HAIL_BOX), into days/;
#   2. backfill-hail.mjs build: hail-<town>.json for every town + hail-storms-backfill.json, through THROUGH (the live storm job's date);
#   3. build-hail-reports.mjs: hailrep-<town>.json (ground reports within 2 mi);
#   4. build-wind.mjs: wind-<town>.json + wind-storms.json (wind reports within 10 mi);
#   5. result.tgz with the town files, the two storm lists and coverage.tsv; hailfill.vmdone.
# Start: THROUGH=2026-10-28 nohup bash ~/run/hailfill/hail-backfill-vm.sh > ~/run-hailfill.log 2>&1 &   status: ~/run-hailfill-status.txt
set -u
H="$HOME/run/hailfill"; cd "$H" || exit 1
THROUGH="${THROUGH:-$(date -u -d yesterday +%F)}"
st() { echo "$(date -u +%FT%TZ) hail backfill: $*" | tee "$HOME/run-hailfill-status.txt"; }
export ROUNDS_DATA="$H/stormstage" HAIL_DAYS="$H/days" HAIL_BOX="36.95,41.05,-109.1,-102.0"
mkdir -p days out
if [ ! -f fetch.done ]; then
  st "radar days 2021-10-01 to $THROUGH"
  for t in 1 2 3; do nice -n 10 node hail/build-hail.mjs fetch 2021-10-01 "$THROUGH" && break; sleep 120; done
  touch fetch.done
fi
st "hail per door"
nice -n 10 node --max-old-space-size=8192 hail/backfill-hail.mjs build "$H/out" "$THROUGH" || { st "STOPPED: backfill build failed"; exit 1; }
st "ground reports"
nice -n 10 node --max-old-space-size=8192 hail/build-hail-reports.mjs fetch build || { st "STOPPED: hail reports failed"; exit 1; }
st "wind"
(cd wind && nice -n 10 node --max-old-space-size=8192 build-wind.mjs all) || { st "STOPPED: wind failed"; exit 1; }
mv stormstage/hailrep-*.json stormstage/hail-reports.json stormstage/wind-*.json out/
(cd out && tar czf "$H/result.tgz" hail-*.json hailrep-*.json wind-*.json coverage.tsv)
touch "$H/hailfill.vmdone"
st "done: ~/run/hailfill/result.tgz (through $THROUGH)"
