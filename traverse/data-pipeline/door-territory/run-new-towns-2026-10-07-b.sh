#!/bin/bash
# Second stage for the three north-Douglas towns (2026-10-07), after run-new-towns-2026-10-07.sh: roofs and year built,
# the roof photos and close-ups, solar, pest, security, hail (days re-fetched over the wider box, five years back for the
# keep rule) and wind, the photo outlines and the lawn outlines. Douglas carries roof material in the county record, so the
# photo model (roofs/material) is not needed for these towns.
set -u
cd "$(dirname "$0")"
L=logs-2026-10-07; mkdir -p "$L"
NEW="highlands-ranch parker castle-pines"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | cut -c1-140)"; }
step year bash -c "cd assessor && node build-year.mjs"
for t in $NEW; do step "roofs-$t" bash -c "cd roofs && node sample-roofs.mjs --town=$t --conc=6"; done
step roofs-build bash -c "cd roofs && node sample-roofs.mjs --build"
step photos bash -c "cd roofs && node photo-index.mjs build"
for t in $NEW; do step "houses-$t" bash -c "cd roofs/material && node houses.mjs --town=$t"; done
for t in $NEW; do step "windows-$t" bash -c "cd roofs/material && node fetch.mjs --town=$t --index-only"; done
step naip bash -c "cd roofs/material && node build-naip-photos.mjs"
for t in $NEW; do step "solar-$t" bash -c "cd solar && node sample-solar.mjs --town=$t --conc=6"; done
step solar-build bash -c "cd solar && node sample-solar.mjs --build"
step pest bash -c "cd pest && node build-pest.mjs"
step security bash -c "cd security && node build-security.mjs"
step hail-fetch bash -c "cd hail && node build-hail.mjs fetch 2021-10-01 $(date -d yesterday +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)"
step hail-build bash -c "cd hail && node build-hail.mjs build"
step wind bash -c "cd wind && node build-wind.mjs build"
step outlines bash -c "cd roofs && node outline-photos.mjs"
for t in $NEW; do step "lawnmask-$t" bash -c "cd lawn-trial && node build-lawn-outlines.mjs --town=$t --conc=6"; done
step hoa bash -c "cd hoa-registry && node build-hoa-list.mjs"
echo "$(date +%H:%M:%S) all done"
