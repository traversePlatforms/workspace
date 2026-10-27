#!/bin/bash
# Nightly copy of the crews' job photos (2026-10-26, Matthew: "go ahead and set up the nightly copy"): the server groups every job photo
# into a folder per job ("YYYY-MM-DD street, town", sixfold-tools/job-photo-export.php), then only the photos this laptop doesn't have yet
# come down into sixfold/brand/job-photos (gitignored; the Google Drive backup carries it), plus photos.csv. Once a day: the overnight
# check calls it every 30 minutes and it runs only after 1 am when today's copy hasn't happened. Prints counts only.
#   bash traverse/ops/pull-job-photos.sh [--now]
set -u
REPO="/c/Users/Surge Inc/Desktop/claude test 2"; DEST="$REPO/sixfold/brand/job-photos"
STAMP="$LOCALAPPDATA/ProjectBackup/job-photos-last.txt"; SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
TODAY=$(date +%F)
if [ "${1:-}" != "--now" ]; then
  [ "$(cat "$STAMP" 2>/dev/null)" = "$TODAY" ] && { echo "job photos: already copied today"; exit 0; }
  [ "$(date +%H)" -lt 1 ] && { echo "job photos: waits until after 1 am"; exit 0; }
fi
mkdir -p "$DEST"
$SG 'rm -rf ~/job-photos-export && php ~/www/traverseplatforms.com/sixfold-tools/job-photo-export.php' < /dev/null || { echo "job photos: export FAILED"; exit 1; }
REMOTE=$($SG 'cd ~/job-photos-export && find . -type f -name "*.jpg" | sed "s#^\./##" | sort' < /dev/null)
HAVE=$(cd "$DEST" && find . -type f -name "*.jpg" | sed 's#^\./##' | sort)
MISSING=$(comm -23 <(printf '%s\n' "$REMOTE" | grep -v '^$') <(printf '%s\n' "$HAVE" | grep -v '^$'))
N=$(printf '%s\n' "$MISSING" | grep -c . || true)
if [ "$N" -gt 0 ]; then
  printf '%s\n' "$MISSING" | base64 -w0 | $SG 'cd ~/job-photos-export && base64 -d > /tmp/jp-list.txt && tar czf - -T /tmp/jp-list.txt photos.csv | base64 -w0; rm -f /tmp/jp-list.txt' | base64 -d | tar xzf - -C "$DEST" || { echo "job photos: download FAILED"; exit 1; }
else
  $SG 'cat ~/job-photos-export/photos.csv' < /dev/null > "$DEST/photos.csv"
fi
echo "$TODAY" > "$STAMP"
echo "job photos: $N new, $(printf '%s\n' "$REMOTE" | grep -c .) on the server, folders $(find "$DEST" -mindepth 1 -maxdepth 1 -type d | wc -l)"
