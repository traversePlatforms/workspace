#!/bin/bash
# Upload one client install built from editions/clients/<slug>.json to traverseplatforms.com (2026-11-16, first for the Houston test
# install, c-houston-lawn-test). deploy-app.sh sends Sixfold and the five editions only, so after an app deploy run this too, or the
# client install lags (the same as deploy-practice.sh for the practice copy).
#   bash traverse/ops/deploy-client.sh c-<slug>                 its page folder and its own API files (code only)
#   bash traverse/ops/deploy-client.sh c-<slug> --first         once: also its settings, town list, sign-in codes and every door file
#   bash traverse/ops/deploy-client.sh c-<slug> --data [regex]  changed data files only (push-edition.sh: never company.json, index.json
#                                                               merged, not replaced), e.g. --data '^hou-' after the Houston lawn finisher
# Build first: (cd traverse/app && node ../editions/build-editions.cjs c-<slug>)   (a full build-editions run builds it too)
# Sends ONLY that install's files: public_html/<folder>/, public_html/api/c-<slug>-*.php, and with --first/--data its <id>-data and
# <id>-private beside public_html. Never Sixfold's, an edition's or a shared file. Backup of what it replaces (~/upload-backups/), files renamed
# into place (~/bin/safe-extract.sh), md5 of every placed file, then checks fetched from the server: version stamp, page 200 with noindex,
# API 401 signed out.
set -u
exec < /dev/null
ID="${1:?usage: deploy-client.sh c-<slug> [--first | --data [regex]]}"; MODE="${2:-}"; ONLY="${3:-}"
case "$ID" in c-[a-z0-9]*) ;; *) echo "the install id is c-<slug>, as build-editions.cjs names it"; exit 1;; esac
R="/c/Users/Surge Inc/Desktop/claude test 2/traverse"; D="$R/editions/dist"; SLUG="${ID#c-}"
CF="$R/editions/clients/$SLUG.json"; [ -s "$CF" ] || { echo "no client file editions/clients/$SLUG.json"; exit 1; }
F=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).folder||'')" "$CF")
[[ "$F" =~ ^[a-z]{1,3}-[0-9a-f]{6}$ ]] || { echo "the client file has no folder yet: build it first"; exit 1; }
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"; SITE='~/www/traverseplatforms.com'
ST="$(mktemp -d)"; trap 'rm -rf "$ST"' EXIT
STAMP=$(date +%Y%m%d-%H%M%S)
[ -s "$D/public_html/$F/index.html" ] && [ -s "$D/public_html/api/$ID-rounds.php" ] || { echo "build it first: node ../editions/build-editions.cjs $ID"; exit 1; }

if [ "$MODE" = "--data" ]; then   # data only: the changed files, by push-edition.sh (backup, md5, index merge)
  bash "$R/data-pipeline/door-territory/push-edition.sh" "$ID-data" "$ONLY"; exit $?
fi

# ---- the code: page folder + its own API files
mkdir -p "$ST/code/$F" "$ST/code/api"
cp -r "$D/public_html/$F/." "$ST/code/$F/"
for k in rounds billing sms webpush skiptrace; do cp "$D/public_html/api/$ID-$k.php" "$ST/code/api/"; done
for f in "$ST"/code/api/*.php; do php -l "$f" > /dev/null 2>&1 || { echo "LINT FAIL $f"; exit 1; }; done
grep -q 'name="robots" content="noindex' "$ST/code/$F/index.html" || { echo "the page has no noindex tag"; exit 1; }
cd "$ST/code" || exit 1
find . -type f | sed 's#^\./##' | grep -v -E "^(api/$ID-[a-z]+\.php|$F/.+)$" && { echo "something outside this install is in the pack"; exit 1; }
find . -type f | sed 's#^\./##' | sort > ../files.txt; N=$(wc -l < ../files.txt)
while IFS= read -r f; do md5sum "$f"; done < ../files.txt | sed 's/ \*/  /' | sort -k2 > ../local.md5
tar czf ../code.tgz -T ../files.txt
echo "$ID code: $N files"
base64 -w0 ../files.txt | $SG "cd $SITE/public_html && base64 -d > /tmp/cl-$STAMP.txt && L=\$(while read f; do [ -f \"\$f\" ] && echo \"\$f\"; done < /tmp/cl-$STAMP.txt) && { [ -z \"\$L\" ] && echo 'nothing to back up (new)' || { tar czf ~/upload-backups/before-$ID-$STAMP.tgz \$L && echo backed-up; }; } ; rm -f /tmp/cl-$STAMP.txt" || { echo "backup FAILED"; exit 1; }
cat ../code.tgz | $SG "~/bin/safe-extract.sh $SITE/public_html -" | sed 's/ \*/  /' | sort -k2 > ../placed.md5 || { echo "upload FAILED"; exit 1; }
if diff -q ../local.md5 ../placed.md5 > /dev/null; then echo "MD5 MATCH ($N)"; else echo "MD5 MISMATCH"; diff ../local.md5 ../placed.md5 | head; exit 1; fi

# ---- once: settings, town list and codes, then the door files in batches (a long single upload drops on this connection)
if [ "$MODE" = "--first" ]; then
  $SG "test -e $SITE/$ID-private/rounds-codes.php || test -e $SITE/$ID-data/rounds/company.json" && { echo "$ID already has data on the server: --first is for the first install only"; exit 1; }
  mkdir -p "$ST/first/$ID-data/rounds" "$ST/first/$ID-private"
  cp "$D/$ID-data/rounds/company.json" "$D/$ID-data/rounds/index.json" "$ST/first/$ID-data/rounds/"
  cp "$D/$ID-private/rounds-codes.php" "$ST/first/$ID-private/"
  ( cd "$ST/first" && find . -type f | sed 's#^\./##' | sort > ../ffiles.txt && while IFS= read -r f; do md5sum "$f"; done < ../ffiles.txt | sed 's/ \*/  /' | sort -k2 > ../flocal.md5 && tar czf ../first.tgz -T ../ffiles.txt )
  $SG "mkdir -p $SITE/$ID-data/rounds $SITE/$ID-private && chmod 755 $SITE/$ID-data $SITE/$ID-private"
  cat "$ST/first.tgz" | $SG "~/bin/safe-extract.sh $SITE -" | sed 's/ \*/  /' | sort -k2 > "$ST/fplaced.md5" || { echo "settings upload FAILED"; exit 1; }
  if diff -q "$ST/flocal.md5" "$ST/fplaced.md5" > /dev/null; then echo "settings MD5 MATCH ($(wc -l < "$ST/fplaced.md5"))"; else echo "settings MD5 MISMATCH"; exit 1; fi
  $SG "chmod 600 $SITE/$ID-private/rounds-codes.php && echo '  codes file: 600'"
  # door and side files, a batch per kind and letter range, each retried: push-edition.sh skips what is already there and the same
  for rx in '^[a-z0-9]+-houston-[a-m]' '^[a-z0-9]+-houston-[n-z]' '^[a-z0-9]+-[a-h]' '^[a-z0-9]+-[i-z]' '^year-' '^(nri|census)-' '.'; do
    for i in 1 2 3; do
      bash "$R/data-pipeline/door-territory/push-edition.sh" "$ID-data" "$rx" > "$ST/push.txt" 2>&1
      grep -qE "MD5 MATCH|: 0 files to send" "$ST/push.txt" && grep -q "json ok" "$ST/push.txt" && { grep -E "files to send|MD5|package" "$ST/push.txt"; break; }
      echo "  batch $rx try $i did not match:"; tail -3 "$ST/push.txt"; [ $i = 3 ] && { echo "data upload FAILED at $rx"; exit 1; }; sleep $((i * 60))
    done
  done
fi

# ---- checks, fetched from the server (SiteGround's captcha can answer this laptop instead of the page)
bad=0
CHK=$($SG "U=https://traverseplatforms.com; echo \"v \$(curl -s \"\$U/$F/version.txt?x=\$RANDOM\" | head -c 40 | tr -d '\r\n')\"; echo \"a \$(curl -s -o /dev/null -w '%{http_code}' \"\$U/api/$ID-rounds.php?action=leads\")\"; echo \"p \$(curl -s -o /dev/null -w '%{http_code}' \"\$U/$F/\")\"; echo \"r \$(curl -s -I \"\$U/$F/\" | grep -ci 'x-robots-tag: noindex')\"")
chk() { printf '%s\n' "$CHK" | awk -v k="$1" '$1==k {print $2}'; }
live=$(chk v); want=$(cat "$ST/code/$F/version.txt")
[ "$live" = "$want" ] && echo "  version $live" || { echo "  VERSION live=$live want=$want"; bad=1; }
c=$(chk a); [ "$c" = 401 ] && echo "  api signed out: 401" || { echo "  api answered $c"; bad=1; }
c=$(chk p); [ "$c" = 200 ] && echo "  page: 200" || { echo "  page answered $c"; bad=1; }
[ "$(chk r)" = 1 ] && echo "  noindex header: yes" || { echo "  no X-Robots-Tag noindex header"; bad=1; }
# warm its towns answer now (2026-11-18: the first load after a deploy took 10 s), as admin and crew; the hourly run keeps it warm after
W=$($SG "cd $SITE && for r in admin crew; do php -d memory_limit=1024M sixfold-tools/regions-warm.php $SITE/public_html/api/$ID-rounds.php \$r 2>&1 | head -c 120; echo; done" 2>/dev/null)
printf '%s\n' "$W" | sed 's/^/  warm: /'
[ $bad = 0 ] && echo "deploy $ID: all checks passed" || { echo "deploy $ID: CHECK FAILED"; exit 1; }
