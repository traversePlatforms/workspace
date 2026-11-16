#!/bin/bash
# Houston market (16 Nov 2026): the county appraisal districts' own public bulk files, each read for terms first
# (metros/hou.json "terms"). Into assessor/raw/hou/ (gitignored). Montgomery CAD is NOT here: its data is marked
# "Redistribution or commercial use of this data is prohibited without prior authorization" (see hou.json).
#   bash metros/fetch-hou-raw.sh [harris|fortbend|galveston|brazoria ...]
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; RAW="$HERE/assessor/raw/hou"; mkdir -p "$RAW"
get() { # get <dir> <url>
  local d="$RAW/$1" u="$2" f; f="$(basename "${u%%\?*}")"; mkdir -p "$d"
  for i in 1 2 3 4 5; do
    curl -sS -L -A "Mozilla/5.0" --retry 3 --retry-delay 10 -C - -o "$d/$f" "$u" && { echo "ok  $1/$f $(stat -c %s "$d/$f")"; return 0; }
    echo "retry $i $1/$f"; sleep $((i * 20))
  done
  echo "FAIL $1/$f"; return 1
}
want="${*:-harris fortbend galveston}"
for c in $want; do case $c in
  harris)
    get harris https://download.hcad.org/data/GIS/Parcels.zip
    get harris https://download.hcad.org/data/CAMA/2026/Real_acct_owner.zip
    get harris https://download.hcad.org/data/CAMA/2026/Real_jur_exempt.zip
    get harris https://download.hcad.org/data/CAMA/2026/Code_description_real.zip ;;
  fortbend)
    get fortbend https://www.fbcad.org/wp-content/uploads/2026/07/FBCAD2026CertifiedGISData-ParcelsShapefiles.zip
    get fortbend https://www.fbcad.org/wp-content/uploads/2026/10/October2026-PropertyDataExport.zip
    get fortbend https://www.fbcad.org/wp-content/uploads/2026/10/WebsiteResidentialSegments-October.zip ;;
  galveston)
    get galveston https://galvestoncad.org/wp-content/uploads/2026/10/parcels.zip ;;
esac; done
echo "fetch done"
