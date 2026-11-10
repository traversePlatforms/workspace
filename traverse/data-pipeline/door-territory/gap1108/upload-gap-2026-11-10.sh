#!/bin/bash
# 10 Nov 2026: the upload half of finish-gap-2026-11-08.sh (steps 5), for a batch whose build already finished on the laptop.
# The 10 Nov run built both batches, then lost the connection to SiteGround mid-upload (laptop moved networks).
#   bash gap1108/upload-gap-2026-11-10.sh <ep|g3po>
set -u
cd "$(dirname "$0")/.." || exit 1
NAME=${1:?batch: ep or g3po}
[ -f "gap1108/GO-$NAME" ] || { echo "HELD: gap1108/GO-$NAME does not exist"; exit 1; }
S="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/push-tmp/gap-$NAME"; BB="$S/back/gap1108/$NAME"
KEYS=$(cat "$BB/b-towns.txt"); MERGE=$(cat "$BB/merge-towns.txt")
step() { echo "$(date +%T) $*"; }
step "upload to Sixfold: $(echo $KEYS $MERGE | wc -w) towns"
set -- $KEYS $MERGE; while [ $# -gt 0 ]; do batch="$1 ${2:-} ${3:-} ${4:-} ${5:-} ${6:-} ${7:-} ${8:-}"; shift 8 2>/dev/null || shift $#; bash upload-towns-sixfold.sh "gap-$NAME-$(echo $batch | cut -d' ' -f1)-$(date +%Y%m%d)" $batch || { step "Sixfold upload failed at $batch"; exit 1; }; done
step "editions"; (cd ../../app && node ../editions/build-editions.cjs 2>&1 | grep -E "built|rror")   # 10 Nov: the first version of this script left it out, so its pushes sent the 9 Nov build
step "push to each edition"
RX="^((census|hailrep|naip|nri|others|pest|photo|roof|solar|wind|year|permit|material|outline|security|lawnmask|com)-)?($(echo $KEYS $MERGE | tr ' ' '|'))\.json\$"
for d in traverse-yards-data traverse-pest-data traverse-security-data traverse-solar-data traverse-data; do bash ./push-edition.sh "$d" "$RX" || { step "push $d failed"; exit 1; }; done
step "done"
