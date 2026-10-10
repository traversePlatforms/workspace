#!/bin/bash
# Overnight 2026-10-10: side data for the 56 houses build-rounds-data.mjs restored (the same-address fix), from the caches.
# Nothing here downloads storms or re-measures roofs; it rebuilds each per-town file from what is already cached, then the
# house centres and photo windows for the eight towns that gained doors. Progress in logs-2026-10-07/_fixup-f.out.
set -u
cd "$(dirname "$0")"
L=logs-2026-10-07; mkdir -p "$L"
TOWNS="parker castle-pines fountain arvada denver cs-northwest cs-southwest boulder"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/fixf-$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/fixf-$name.log" | cut -c1-140)"; }
echo "$(date '+%Y-%m-%d %H:%M:%S') fix-up f"
step roofs     bash -c "cd roofs && node sample-roofs.mjs --build"
step solar     bash -c "cd solar && node sample-solar.mjs --build"
step year      bash -c "cd assessor && node build-year.mjs"
step permits   bash -c "cd permits && node build-permits.mjs"
step nri       bash -c "cd nri && node build-nri.mjs"
step census    bash -c "cd census && node build-census.mjs"
step pest      bash -c "cd pest && node build-pest.mjs"
step security  bash -c "cd security && node build-security.mjs"
step hail      bash -c "cd hail && node build-hail.mjs build"
step wind      bash -c "cd wind && node build-wind.mjs build"
for t in $TOWNS; do step "houses-$t" bash -c "cd roofs/material && node houses.mjs --town=$t"; done
for t in $TOWNS; do step "naipidx-$t" bash -c "cd roofs/material && node fetch.mjs --town=$t --index-only"; done
step photos    bash -c "cd roofs && node photo-index.mjs build"
step naip      bash -c "cd roofs/material && node build-naip-photos.mjs"
step outlines  bash -c "cd roofs && node outline-photos.mjs"
echo "$(date +%H:%M:%S) FIXUP F DONE"
