#!/bin/bash
# Upload the practice copy of Sixfold 365 to traverseplatforms.com (2026-11-02).   bash traverse/ops/deploy-practice.sh [--first]
# Run after: (cd traverse/app && node ../editions/build-editions.cjs practice)   (a full build-editions run builds it too)
# Sends ONLY the practice copy's own files: public_html/practice-5dbe8f/ and public_html/api/sixfold-practice-*.php. Never Sixfold's or an
# edition's files, never sixfold-data or sixfold-private. Each upload: backup of what it replaces (~/upload-backups/before-practice-<stamp>.tgz),
# ~/bin/safe-extract.sh (renamed into place), md5 of every placed file against the local one, version stamp, the API answering 401 signed out
# and its company saying practice.
# --first (once): also its data and private folders beside public_html: settings, the made-up customers, the sign-in codes (never over an
# existing codes or accounts file), and the towns copied from sixfold-data on the server (traverse/ops/practice-towns.php, read-only there).
set -u
R="/c/Users/Surge Inc/Desktop/claude test 2/traverse"; D="$R/editions/dist/practice"; F=practice-5dbe8f
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"; SITE='~/www/traverseplatforms.com'
ST="$(mktemp -d)"; trap 'rm -rf "$ST"' EXIT
STAMP=$(date +%Y%m%d-%H%M%S)
[ -s "$D/public_html/$F/index.html" ] && [ -s "$D/public_html/api/sixfold-practice-rounds.php" ] || { echo "build it first: node ../editions/build-editions.cjs practice"; exit 1; }
grep -q "const PRACTICE = true;" "$D/public_html/api/sixfold-practice-rounds.php" || { echo "the practice switch is not on in the built API"; exit 1; }
for f in "$D"/public_html/api/*.php; do php -l "$f" > /dev/null 2>&1 || { echo "LINT FAIL $f"; exit 1; }; done
mkdir -p "$ST/code"; cp -r "$D/public_html/." "$ST/code/"
cd "$ST/code" || exit 1
find . -type f | sed 's#^\./##' | grep -v -E '^(api/sixfold-practice-[a-z-]+\.php|'"$F"'/[^/]+)$' && { echo "something outside the practice copy is in the pack"; exit 1; }
find . -type f | sed 's#^\./##' | sort > ../files.txt; N=$(wc -l < ../files.txt)
while IFS= read -r f; do md5sum "$f"; done < ../files.txt | sed 's/ \*/  /' | sort -k2 > ../local.md5
tar czf ../code.tgz -T ../files.txt
echo "practice code: $N files"
base64 -w0 ../files.txt | $SG "cd $SITE/public_html && base64 -d > /tmp/pr-$STAMP.txt && L=\$(while read f; do [ -f \"\$f\" ] && echo \"\$f\"; done < /tmp/pr-$STAMP.txt) && { [ -z \"\$L\" ] && echo 'nothing to back up (new)' || { tar czf ~/upload-backups/before-practice-$STAMP.tgz \$L && echo backed-up; }; } ; rm -f /tmp/pr-$STAMP.txt" || { echo "backup FAILED"; exit 1; }
cat ../code.tgz | $SG "~/bin/safe-extract.sh $SITE/public_html -" | sed 's/ \*/  /' | sort -k2 > ../placed.md5 || { echo "upload FAILED"; exit 1; }
if diff -q ../local.md5 ../placed.md5 > /dev/null; then echo "MD5 MATCH ($N)"; else echo "MD5 MISMATCH"; diff ../local.md5 ../placed.md5 | head; exit 1; fi
if [ "${1:-}" = "--first" ]; then
  $SG "test -e $SITE/sixfold-practice-private/rounds-accounts.json || test -e $SITE/sixfold-practice-data/leads/leads.log" < /dev/null && { echo "the practice copy already has data: --first is for the first install only"; exit 1; }
  mkdir -p "$ST/data"; cp -r "$D/sixfold-practice-data" "$D/sixfold-practice-private" "$ST/data/"
  ( cd "$ST/data" && find . -type f | sed 's#^\./##' | sort > ../dfiles.txt && while IFS= read -r f; do md5sum "$f"; done < ../dfiles.txt | sed 's/ \*/  /' | sort -k2 > ../dlocal.md5 && tar czf ../data.tgz -T ../dfiles.txt )
  $SG "mkdir -p $SITE/sixfold-practice-data/rounds $SITE/sixfold-practice-private && chmod 755 $SITE/sixfold-practice-data $SITE/sixfold-practice-private" < /dev/null
  cat "$ST/data.tgz" | $SG "~/bin/safe-extract.sh $SITE -" | sed 's/ \*/  /' | sort -k2 > "$ST/dplaced.md5" || { echo "data upload FAILED"; exit 1; }
  if diff -q "$ST/dlocal.md5" "$ST/dplaced.md5" > /dev/null; then echo "data MD5 MATCH ($(wc -l < "$ST/dplaced.md5"))"; else echo "data MD5 MISMATCH"; exit 1; fi
  $SG "chmod 600 $SITE/sixfold-practice-private/rounds-codes.php && echo 'codes file: 600'" < /dev/null
  cat "$R/ops/practice-towns.php" | $SG "cat > /tmp/practice-towns-$STAMP.php && php /tmp/practice-towns-$STAMP.php $SITE/sixfold-data/rounds $SITE/sixfold-practice-data/rounds; rm -f /tmp/practice-towns-$STAMP.php" | tail -2
fi
bad=0
live=$(curl -s "https://traverseplatforms.com/$F/version.txt?x=$RANDOM"); want=$(cat "$F/version.txt")
[ "$live" = "$want" ] && echo "  version $live" || { echo "  VERSION live=$live want=$want"; bad=1; }
c=$(curl -s -o /dev/null -w '%{http_code}' "https://traverseplatforms.com/api/sixfold-practice-rounds.php?action=leads"); [ "$c" = 401 ] && echo "  api signed out: 401" || { echo "  api answered $c"; bad=1; }
curl -s "https://traverseplatforms.com/api/sixfold-practice-rounds.php?action=company" | grep -q '"practice":true' && echo "  company: practice" || { echo "  company does not say practice"; bad=1; }
c=$(curl -s -o /dev/null -w '%{http_code}' "https://traverseplatforms.com/$F/"); [ "$c" = 200 ] && echo "  page: 200" || { echo "  page answered $c"; bad=1; }
[ $bad = 0 ] && echo "deploy practice: all checks passed" || { echo "deploy practice: CHECK FAILED"; exit 1; }
