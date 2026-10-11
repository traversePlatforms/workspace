#!/bin/bash
# The 56 houses restored by the same-address fix get their house centres and 2023 close-ups (2026-10-10).
set -u
cd "$(dirname "$0")"
L=logs-2026-10-07
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/g-$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/g-$name.log" | cut -c1-140)"; }
for t in parker castle-pines fountain arvada cs-northwest cs-southwest boulder denver; do step "houses-$t" bash -c "cd roofs/material && node houses.mjs --town=$t --redo"; done
for t in parker castle-pines fountain arvada cs-northwest cs-southwest boulder denver; do step "naipidx-$t" bash -c "cd roofs/material && node fetch.mjs --town=$t --index-only"; done
step naip     bash -c "cd roofs/material && node build-naip-photos.mjs"
step outlines bash -c "cd roofs && node outline-photos.mjs"
echo "$(date +%H:%M:%S) CLOSEUPS DONE"
