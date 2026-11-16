#!/bin/bash
# Brazoria CAD's own public download links (brazoriacad.org/public-gis-and-property-data-downloads/) are pCloud share
# links; this asks pCloud's public-link API for each file's download address. Into assessor/raw/hou/brazoria (gitignored).
#   bash metros/fetch-hou-brazoria.sh
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; D="$HERE/assessor/raw/hou/brazoria"; mkdir -p "$D"
get() { # get <publink code> <fileid> <name>
  local u
  for i in 1 2 3 4 5; do
    u=$(curl -sS -m 60 "https://api.pcloud.com/getpublinkdownload?code=$1&fileid=$2" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(j.result)process.exit(1);console.log("https://"+j.hosts[0]+j.path)})') &&
      curl -sS -L --retry 3 --retry-delay 10 -o "$D/$3" "$u" && { echo "ok  brazoria/$3 $(stat -c %s "$D/$3")"; return 0; }
    echo "retry $i $3"; sleep $((i * 20))
  done
  echo "FAIL $3"; return 1
}
get kZoNOV7ZOPpNSuilWqzXtn2DVMVYTuQWx1tV 90101996601 PARCELS_W_OWNER.zip
get kZYMUV7ZD6GgiyP3moR0gLKHGc1l5Qd0c9xV 92286624172 2026_BRAZORIA_COUNTY_CERTIFIED.zip
get kZoNOV7ZOPpNSuilWqzXtn2DVMVYTuQWx1tV 13432523929 EXAMPLE_OF_DATA_USAGE_FOR_GIS.pdf
echo "fetch done"
