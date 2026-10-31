#!/bin/bash
# Stage newlidar (fill1031, priority b, c and d: roofs, sun and trees where the pipeline had no laser survey). group2/probe-lidar-g2.mjs
# was run on 31 Oct over the 279 towns that read "no LiDAR here" or had no survey: 3DEP surveys in the same public bucket (EPSG:3857)
# cover 113 of them, ~133,000 homes (Longmont, Lafayette, Louisville, Superior, Mead, Niwot: DRCOG 2020, which drcog1's map left out;
# Greeley, Windsor and Weld's Group 1 towns: Eastern B2 / North Priority 2018; Durango, Cortez, Pagosa Springs: Southwest NRCS 2018;
# Sterling, Fort Morgan, Brush, Yuma, Elizabeth, Leadville, Telluride, Meeker, ...). Surveys older than 2015 and the address-point
# counties (no lot lines) are left out. The mapping is tree-zones/lidar-surveys-extra.json (read by lidar.mjs, town-surveys.mjs and
# sample-trees.mjs, all three sent with it). Not found: Fort Collins, Pueblo, Grand Junction / Mesa, Steamboat, Montrose, Delta.
# Per town: the "no LiDAR here" roof and sun readings and the canopy-map tree readings are taken out, then roofs, sun, trees.
# gis.colorado.gov: lots per town, the only parcel job running. Leaves newlidar-ok.txt for finish-newlidar-2026-10-31.sh.
. "$HOME/run/fill1031/lib.sh"
TOWNS=$(cat "$Q/newlidar-towns.txt")
put_cache roof-cache.json "$DT/roofs/roof-cache.json" || exit 1
put_cache solar-cache.json "$DT/solar/solar-cache.json" || exit 1
put_cache tree-cache.json "$DT/tree-cache.json" || exit 1
put_areas $TOWNS
if [ ! -f "$Q/newlidar.prepped" ]; then
  mkdir -p "$B/code"
  TZR="$HOME/run/tree-zones"   # lidar.mjs's real folder (the tv copy is a symlink to it)
  for f in "$TZR/lidar.mjs" "$DT/tree-zones/town-surveys.mjs" "$DT/tree-zones/sample-trees.mjs"; do [ -f "$B/code/$(basename "$f")" ] || cp "$f" "$B/code/"; done
  cp "$Q/code/lidar.mjs" "$TZR/lidar.mjs" && cp "$Q/code/lidar-surveys-extra.json" "$TZR/" && cp "$Q/code/lidar-surveys-extra.json" "$DT/tree-zones/" \
    && cp "$Q/code/town-surveys.mjs" "$Q/code/sample-trees.mjs" "$DT/tree-zones/" || exit 1
  (cd "$DT/tree-zones" && node -e "import('./town-surveys.mjs').then(async (s)=>{const {PROJECT}=await import('./lidar.mjs');const t=process.argv[1];const l=s.SURVEY[t];if(!l||!PROJECT[l]){console.log('mapping missing for',t);process.exit(1)}console.log('mapping ok:',t,'->',PROJECT[l])})" longmont) || exit 1
  for c in roofs/roof-cache.json solar/solar-cache.json; do node "$Q/cache-prep.mjs" --cache="$DT/$c" --areas="$DT" --towns="$Q/newlidar-towns.txt" --err='^no LiDAR here$' || exit 1; done
  node "$Q/cache-prep.mjs" --cache="$DT/tree-cache.json" --areas="$DT" --towns="$Q/newlidar-towns.txt" --canopy --err='^no LiDAR' || exit 1
  tries outlines outlines $TOWNS || exit 1
  touch "$Q/newlidar.prepped"
fi
bad=0
for t in $TOWNS; do
  for pass in roof solar trees; do
    [ -f "$Q/newlidar-$t.$pass.done" ] && continue
    st "newlidar: $pass $t"
    case $pass in
      roof)  cmd="cd '$DT/roofs' && node --max-old-space-size=6144 sample-roofs.mjs --all-towns --buildings=buildings --town='$t' --conc=12" ;;
      solar) cmd="cd '$DT/solar' && node --max-old-space-size=6144 sample-solar.mjs --all-towns --buildings=buildings --town='$t' --conc=12" ;;
      trees) cmd="cd '$DT/tree-zones' && node --max-old-space-size=6144 sample-trees.mjs --town='$t' --conc=12" ;;
    esac
    tries "$pass $t" bash -c "$cmd" && touch "$Q/newlidar-$t.$pass.done" || bad=$((bad + 1))
  done
done
for t in $TOWNS; do [ -f "$Q/newlidar-$t.roof.done" ] && [ -f "$Q/newlidar-$t.solar.done" ] && [ -f "$Q/newlidar-$t.trees.done" ] && echo "$t"; done > "$Q/newlidar-ok.txt"
echo "newlidar: $(wc -l < "$Q/newlidar-ok.txt") towns finished, $bad steps failed"
[ "$(wc -l < "$Q/newlidar-ok.txt")" -gt 0 ]
