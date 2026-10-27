#!/bin/bash
# Deploy the field app to traverseplatforms.com: Sixfold 365 + the five editions (2026-10-27, code review item 9).
#   bash traverse/ops/deploy-app.sh <label> [--check]   e.g. perf-regions; --check compares with live and sends nothing
# Run after building: (cd traverse/app && node i18n/sync-es.cjs && node ../editions/build-editions.cjs && node ../editions/minify-page.cjs)
# What it sends: Sixfold's page folder (index.html, version.txt, sw.js, es.json when present), api/rounds.php, billing.php, square-oauth.php,
# webpush.php; each edition's page folder (index.html, version.txt, q.html, sign.html, es.json when present) and its api/<name>-rounds,
# -billing, -sms, -webpush.php. Backup first (~/upload-backups/before-<label>-<stamp>.tgz), then ~/bin/safe-extract.sh renames every
# file into place (no half-written rounds.php ever served), md5 of every placed file against the local one, version stamps, and each
# API answering 401 to a signed-out request. Exits non-zero on any mismatch.
set -u
LABEL="${1:?usage: deploy-app.sh <label>}"
R="/c/Users/Surge Inc/Desktop/claude test 2/traverse"; D="$R/editions/dist/public_html"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
ST="$(mktemp -d)"; trap 'rm -rf "$ST"' EXIT
STAMP=$(date +%Y%m%d-%H%M%S)
cp_if() { [ -f "$1" ] && { mkdir -p "$ST/$2"; cp "$1" "$ST/$2/"; }; return 0; }
for f in index.html version.txt; do cp_if "$R/app/dist/summit-de59ae83/$f" summit-de59ae83; done
for f in sw.js es.json; do cp_if "$R/app/summit-de59ae83/$f" summit-de59ae83; done
for f in rounds.php billing.php square-oauth.php webpush.php; do cp_if "$R/app/api/$f" api; done
EDS="tr-cb2e8587 ty-25604fff ts-016064fc tq-9cf8d9de tg-3b0b89e7"
for e in $EDS; do for f in index.html version.txt q.html sign.html sw.js es.json; do cp_if "$D/$e/$f" "$e"; done; done
for a in traverse traverse-yards traverse-solar traverse-pest traverse-security; do for k in rounds billing sms webpush; do cp_if "$D/api/$a-$k.php" api; done; done
cd "$ST" || exit 1
for f in $(find api -name '*.php'); do php -l "$f" > /dev/null 2>&1 || { echo "LINT FAIL $f"; exit 1; }; done
find . -type f | sed 's#^\./##' | sort > files.txt
N=$(wc -l < files.txt)
while IFS= read -r f; do md5sum "$f"; done < files.txt | sed 's/ \*/  /' | sort -k2 > local.md5
tar czf pkg.tgz -T files.txt
echo "deploy $LABEL: $N files, $(( $(stat -c %s pkg.tgz) / 1024 )) KB"
if [ "${2:-}" = "--check" ]; then   # compare with what is live, send nothing
  base64 -w0 files.txt | $SG "cd ~/www/traverseplatforms.com/public_html && base64 -d | while read f; do [ -f \"\$f\" ] && md5sum \"\$f\" || echo \"none  \$f\"; done" | sort -k2 > live.md5
  join -1 2 -2 2 local.md5 live.md5 | awk '$2!=$3{print "  differs: "$1} END{}'; echo "check only: $(join -1 2 -2 2 local.md5 live.md5 | awk '$2!=$3' | wc -l) of $N differ from live"; exit 0
fi
base64 -w0 files.txt | $SG "cd ~/www/traverseplatforms.com/public_html && base64 -d > /tmp/dl-$STAMP.txt && tar czf ~/upload-backups/before-$LABEL-$STAMP.tgz \$(while read f; do [ -f \"\$f\" ] && echo \"\$f\"; done < /tmp/dl-$STAMP.txt) && rm -f /tmp/dl-$STAMP.txt && echo backed-up" || { echo "backup FAILED"; exit 1; }
cat pkg.tgz | $SG "~/bin/safe-extract.sh ~/www/traverseplatforms.com/public_html -" | sed 's/ \*/  /' | sort -k2 > placed.md5 || { echo "upload FAILED"; exit 1; }
if diff -q local.md5 placed.md5 > /dev/null; then echo "MD5 MATCH ($N)"; else echo "MD5 MISMATCH"; diff local.md5 placed.md5 | head; exit 1; fi
bad=0
for p in summit-de59ae83 $EDS; do
  [ -f "$p/version.txt" ] || continue
  live=$(curl -s "https://traverseplatforms.com/$p/version.txt?x=$RANDOM"); want=$(cat "$p/version.txt")
  [ "$live" = "$want" ] && echo "  $p version $live" || { echo "  $p VERSION live=$live want=$want"; bad=1; }
done
for a in rounds traverse-rounds traverse-yards-rounds traverse-solar-rounds traverse-pest-rounds traverse-security-rounds; do
  c=$(curl -s -o /dev/null -w '%{http_code}' "https://traverseplatforms.com/api/$a.php?action=leads"); [ "$c" = 401 ] || { echo "  api/$a.php answered $c"; bad=1; }
done
[ $bad = 0 ] && echo "deploy $LABEL: all checks passed (backup before-$LABEL-$STAMP.tgz)" || { echo "deploy $LABEL: CHECK FAILED"; exit 1; }
