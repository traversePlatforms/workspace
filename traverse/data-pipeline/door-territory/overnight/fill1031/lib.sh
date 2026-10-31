#!/bin/bash
# Shared by the fill1031 stage scripts on the cloud machine (sourced). Paths, status line, disk guard, retries, the LiDAR-cache trim, and
# the one-time install of what the laptop sent (in/ and areas/), each with a backup in ~/run/fill1031/vm-backup first.
set -u
Q="$HOME/run/fill1031"; T="$HOME/run/tv/traverse"; DT="$T/data-pipeline/door-territory"; RD="$T/app/data/rounds"; LT="$HOME/run/lawn-trial"
M="$DT/roofs/material"; PY="$HOME/pyenv/bin/python"; LIDAR="$HOME/run/tree-zones/lidar-cache"; B="$Q/vm-backup"
mkdir -p "$B"
st() { echo "$(date -u +%FT%TZ) fill1031: $*" | tee "$HOME/run-status.txt"; }
room() { [ "$(df -k --output=avail / | tail -1)" -ge 5242880 ] || { st "STOPPED, under 5 GB free"; exit 1; }; }
prune() { while [ "$(du -sk "$LIDAR" | cut -f1)" -gt 26214400 ]; do old=$(find "$LIDAR" -name '*.bin' -printf '%A@ %p\n' | sort -n | head -n 3000 | cut -d' ' -f2-); [ -z "$old" ] && break; printf '%s\n' "$old" | xargs -r rm -f; done; }
tries() { local name=$1; shift; for t in 1 2 3 4 5; do prune; room; "$@" && return 0; echo "$(date -u +%T) $name failed (try $t)"; sleep 60; done; return 1; }
# put_cache <name in in/> <live path>: the laptop's merged cache replaces this machine's copy once (this machine's kept in vm-backup)
put_cache() {
  local n=$1 dst=$2
  [ -f "$Q/installed-$n" ] && return 0
  [ -f "$Q/in/$n" ] || { echo "no $n from the laptop"; return 1; }
  [ -f "$dst" ] && [ ! -f "$B/$n" ] && cp "$dst" "$B/$n"
  cp "$Q/in/$n" "$dst.fill-tmp" && mv "$dst.fill-tmp" "$dst" && touch "$Q/installed-$n"
}
# put_areas <town...>: the laptop's current <town>-areas.json (door lists) into the door-territory folder (old ones kept)
put_areas() {
  mkdir -p "$B/areas"
  for t in "$@"; do
    [ -f "$Q/areas/$t-areas.json" ] || continue
    [ -f "$Q/installed-areas-$t" ] && continue
    [ -f "$DT/$t-areas.json" ] && [ ! -f "$B/areas/$t-areas.json" ] && cp "$DT/$t-areas.json" "$B/areas/"
    cp "$Q/areas/$t-areas.json" "$DT/$t-areas.json" && touch "$Q/installed-areas-$t"
  done
}
# outlines: the building-outline tiles at the corners of the towns' door boxes (fetch-buildings.mjs fetches only tiles not on disk)
outlines() {
  local files=""; for t in "$@"; do [ -f "$Q/doors/$t.json" ] && files="$files $Q/doors/$t.json"; done
  [ -z "$files" ] && return 0
  local corners; corners=$(node "$HOME/run/group2/corner-tiles.mjs" "$DT/tree-zones" $files) || return 1
  (cd "$DT/tree-zones" && node --max-old-space-size=8192 fetch-buildings.mjs $corners)
}
