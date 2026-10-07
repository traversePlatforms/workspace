#!/bin/bash
# Third stage (2026-10-07): the editions' own towns, each through its trade's heavy steps, then the shared builds again so every
# file includes them. After run-new-towns-2026-10-07-b.sh. Logs in logs-2026-10-07/.
#   Roofing: Colorado Springs NE/SE, Security-Widefield, Fountain   -> roofs, houses, close-up windows
#   Solar:   Arvada, Centennial, Thornton                           -> solar
#   Pest:    Windsor, Erie, Commerce City                           -> trees near the house
#   Security: Denver, Colorado Springs x4, Boulder                  -> owner lives elsewhere (mail sidecar)
set -u
cd "$(dirname "$0")"
L=logs-2026-10-07; mkdir -p "$L"
ROOF="cs-northeast cs-southeast security-widefield fountain"
SOLAR="arvada centennial thornton"
PEST="windsor erie commerce-city"
SEC="denver cs-northeast cs-southeast cs-northwest cs-southwest boulder"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | cut -c1-140)"; }
# Denver's and Commerce City's neighbourhoods if their door lists landed after the others
for t in denver commerce-city; do [ -f "$t.csv" ] && [ ! -f "$t-areas.json" ] && step "areas-$t" node build-walklist-pdf.mjs $t.csv --no-pdf; done
step rounds-c1 node build-rounds-data.mjs
step buildings-c bash -c "cd tree-zones && node fetch-buildings.mjs"
step mail-c node build-mail-sidecar.mjs $SEC
for t in $ROOF; do step "roofs-$t" bash -c "cd roofs && node sample-roofs.mjs --town=$t --conc=6"; done
step roofs-build-c bash -c "cd roofs && node sample-roofs.mjs --build"
for t in $ROOF; do step "houses-$t" bash -c "cd roofs/material && node houses.mjs --town=$t"; done
for t in $ROOF; do step "windows-$t" bash -c "cd roofs/material && node fetch.mjs --town=$t --index-only"; done
step naip-c bash -c "cd roofs/material && node build-naip-photos.mjs"
for t in $SOLAR; do step "solar-$t" bash -c "cd solar && node sample-solar.mjs --town=$t --conc=6"; done
step solar-build-c bash -c "cd solar && node sample-solar.mjs --build"
for t in $PEST; do step "trees-$t" bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; done
step year-c bash -c "cd assessor && node build-year.mjs"
# county values: the editions' counties and El Paso's assessor file (added 2026-10-07, after Denver's door list)
step value-c node sample-value.mjs
step rounds-c2 node build-rounds-data.mjs
# added 2026-10-07 evening, after the door files: re-roof and solar permits, FEMA tract ratings, power company figures
step permits-pprbd-c bash -c "cd permits && node fetch-pprbd.mjs"
step permits-douglas-c bash -c "cd permits && node fetch-douglas.mjs"
step permits-build-c bash -c "cd permits && node build-permits.mjs"
step nri-c bash -c "cd nri && node build-nri.mjs"
step utility-figures-c bash -c "cd solar && node utility-figures.mjs && node sample-solar.mjs --build"
step pest-c bash -c "cd pest && node build-pest.mjs"
step security-c bash -c "cd security && node build-security.mjs"
step hail-fetch-c bash -c "cd hail && node build-hail.mjs fetch 2021-10-01 $(date -d yesterday +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)"
step hail-build-c bash -c "cd hail && node build-hail.mjs build"
step wind-c bash -c "cd wind && node build-wind.mjs build"
step outlines-c bash -c "cd roofs && node outline-photos.mjs"
echo "$(date +%H:%M:%S) all done"
