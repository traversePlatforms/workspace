#!/bin/bash
# Fix-up, second part (2026-10-08 morning). run-fixup-2026-10-07-d.sh was stopped during Parker's lawn outlines (about 0.3 doors a
# second, hours to go) so the shared builds could run first and the data refresh go up this morning. Here: Commerce City's missing
# building tile and its trees, the steps d had not reached, then the lawn outlines last (they pick up where they stopped; they feed
# no shared build). Progress in logs-2026-10-07/_fixup-e.out.
set -u
cd "$(dirname "$0")"
L=logs-2026-10-07; mkdir -p "$L"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/fixe-$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/fixe-$name.log" | cut -c1-140)"; }
echo "$(date '+%Y-%m-%d %H:%M:%S') fix-up e"
step buildings-tile bash -c "cd tree-zones && node fetch-buildings.mjs 023101013"
step trees-commerce-city bash -c "cd tree-zones && node sample-trees.mjs --town=commerce-city --conc=6"
step hoa bash -c "cd hoa-registry && node build-hoa-list.mjs"
step year bash -c "cd assessor && node build-year.mjs"
step value node sample-value.mjs
step rounds node build-rounds-data.mjs
step roofs-build bash -c "cd roofs && node sample-roofs.mjs --build"
step solar-build bash -c "cd solar && node utility-figures.mjs && node sample-solar.mjs --build"
step permits-build bash -c "cd permits && node build-permits.mjs"
step nri bash -c "cd nri && node build-nri.mjs"
step census bash -c "cd census && node build-census.mjs"
step climate bash -c "cd climate && node build-climate.mjs"
step pest bash -c "cd pest && node build-pest.mjs"
step security bash -c "cd security && node build-security.mjs"
step outlines bash -c "cd roofs && node outline-photos.mjs"
step hail-build bash -c "cd hail && node build-hail.mjs build"
step wind bash -c "cd wind && node build-wind.mjs build"
echo "$(date +%H:%M:%S) SHARED BUILDS DONE"
for t in parker castle-pines; do step "lawnmask-$t" bash -c "cd lawn-trial && node build-lawn-outlines.mjs --town=$t --conc=6"; done
echo "$(date +%H:%M:%S) FIX-UP E DONE"
