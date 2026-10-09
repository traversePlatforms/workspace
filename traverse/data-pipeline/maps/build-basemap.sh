#!/bin/bash
# The basemap (2026-10-08): one PMTiles file of OpenStreetMap vector tiles for every town the installs cover, cut from
# Protomaps' daily world build, to zoom 15 (streets, buildings, house numbers; the app draws closer zooms from it).
# Hosted beside the app as a static file; the page reads it with HTTP range requests (no tile server, no map account).
# Map data © OpenStreetMap contributors (ODbL), as the map's attribution says.
#   bash build-basemap.sh [YYYYMMDD]      -> colorado.pmtiles (about 150 MB)
cd "$(dirname "$0")"
B=${1:-$(curl -s https://build-metadata.protomaps.dev/builds.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).slice(-1)[0].key.replace('.pmtiles','')))")}
# Cripple Creek and Fountain in the south to Windsor in the north; Woodland Park and Boulder to Black Forest and Falcon
# The extract cannot resume, and on a slow line the host has dropped the connection mid-way (2026-10-08, at 128 of 146 MB),
# so it runs with more threads and tries up to three times; a half-written file fails `show`.
for try in 1 2 3; do
  ./bin/pmtiles.exe extract "https://build.protomaps.com/$B.pmtiles" colorado.pmtiles --bbox=-105.40,38.60,-104.45,40.55 --maxzoom=15 --download-threads=8 \
    && ./bin/pmtiles.exe show colorado.pmtiles > /dev/null 2>&1 && break
  echo "try $try failed"; rm -f colorado.pmtiles
done
./bin/pmtiles.exe show colorado.pmtiles | head -20
