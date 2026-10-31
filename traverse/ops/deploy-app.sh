#!/bin/bash
# Deploy the field app to traverseplatforms.com: Sixfold 365 + the five editions (2026-10-27, code review item 9).
#   bash traverse/ops/deploy-app.sh <label> [--check]   e.g. perf-regions; --check compares with live and sends nothing
# Run after building: (cd traverse/app && node i18n/sync-es.cjs && node ../editions/build-editions.cjs && node ../editions/minify-page.cjs)
# What it sends: Sixfold's page folder (index.html, version.txt, sw.js, es.json when present), api/rounds.php, billing.php, square-oauth.php,
# webpush.php; each edition's page folder (index.html, version.txt, q.html, sign.html, es.json when present) and its api/<name>-rounds,
# -billing, -sms, -webpush.php. Backup first (~/upload-backups/before-<label>-<stamp>.tgz), then ~/bin/safe-extract.sh renames every
# file into place (no half-written rounds.php ever served), md5 of every placed file against the local one, version stamps, and each
# API answering 401 to a signed-out request. Exits non-zero on any mismatch.
# + (2026-10-29) the website's checkout and central Stripe webhook (api/traverse-start.php, traverse-hook.php, traverse-clients-lib.php), the five
# client templates (traverse-shared/client-templates/, from build-editions.cjs) and traverse-tools/clients.php; then on the server
# "clients.php regen" remakes every client install's page and API from the new templates.
set -u
LABEL="${1:?usage: deploy-app.sh <label>}"
R="/c/Users/Surge Inc/Desktop/claude test 2/traverse"; D="$R/editions/dist/public_html"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
ST="$(mktemp -d)"; trap 'rm -rf "$ST"' EXIT
STAMP=$(date +%Y%m%d-%H%M%S)
cp_if() { [ -f "$1" ] && { mkdir -p "$ST/$2"; cp "$1" "$ST/$2/"; }; return 0; }
# the Spanish dictionary lives beside each page since 2026-10-27: without it a Spanish phone shows English, so it must be there
for p in summit tr-cb2e8587 ty-25604fff ts-016064fc tq-9cf8d9de tg-3b0b89e7; do
  f="$D/$p/es.json"; [ "$p" = summit ] && f="$R/app/summit-de59ae83/es.json"
  [ -s "$f" ] || { echo "MISSING $f: run node i18n/sync-es.cjs and build-editions.cjs first"; exit 1; }; done
for f in index.html version.txt; do cp_if "$R/app/dist/summit-de59ae83/$f" summit-de59ae83; done
for f in sw.js es.json; do cp_if "$R/app/summit-de59ae83/$f" summit-de59ae83; done
for f in rounds.php billing.php square-oauth.php webpush.php; do cp_if "$R/app/api/$f" api; done
# Sign in with Google / Microsoft for Setup › Email (2026-10-30): the one callback and the library every install's rounds.php loads beside it
for f in mail-oauth.php mail-oauth-lib.php care-lib.php; do cp_if "$R/app/api/$f" api; done   # + plans and customer emails (care-lib.php, 2026-10-30), loaded the same way
# the editions' end-of-day email (2026-10-30): the shared drawing every install's rounds.php loads beside it
cp_if "$R/app/api/eod-lib.php" api
# the aerial photo tile cache (TR-52, 2026-10-31): one endpoint every install's page asks (../api/satcache.php), tiles kept in traverse-shared/satcache
cp_if "$R/app/api/satcache.php" api
# Facebook lead ads for the editions and client installs (2026-10-30): the one Connect Facebook callback and the library every install loads
for f in fb-oauth.php fb-leads-lib.php; do cp_if "$R/app/api/$f" api; done
# Jobber for Sync from another system (TR-46, 2026-10-31): the one Connect Jobber callback, the APP_DISCONNECT webhook and the library every install loads
for f in jobber-oauth.php jobber-hook.php jobber-lib.php; do cp_if "$R/app/api/$f" api; done
EDS="tr-cb2e8587 ty-25604fff ts-016064fc tq-9cf8d9de tg-3b0b89e7"
for e in $EDS; do for f in index.html version.txt q.html sign.html sw.js es.json; do cp_if "$D/$e/$f" "$e"; done; done
for a in traverse traverse-yards traverse-solar traverse-pest traverse-security; do for k in rounds billing sms webpush; do cp_if "$D/api/$a-$k.php" api; done; done
# the website's checkout, the central Stripe webhook and the client-install library (2026-10-29; the shared billing.php above is theirs too)
# + the website's find-my-app (traverse-findapp.php, 2026-10-30)
for f in traverse-clients-lib.php traverse-start.php traverse-hook.php traverse-findapp.php; do cp_if "$R/app/api/$f" api; done
# client installs made on the server (2026-10-29): each edition's client template goes to traverse-shared/client-templates/, and
# traverse-tools/clients.php with it; after the upload every client's page and API is remade from them (clients.php regen), so client
# installs get each deploy exactly when the editions do. Staged apart: they unpack beside public_html, not in it.
SH="$(mktemp -d)"; trap 'rm -rf "$ST" "$SH"' EXIT
TPL="$R/editions/dist/client-templates"
for e in roofing yards solar pest security; do [ -s "$TPL/$e/edition.json" ] || { echo "MISSING $TPL/$e: run build-editions.cjs first"; exit 1; }; done
mkdir -p "$SH/traverse-shared" "$SH/traverse-tools"; cp -r "$TPL" "$SH/traverse-shared/"; cp "$R/editions/dist/traverse-tools/clients.php" "$R/editions/dist/traverse-tools/push-alerts.sh" "$R/editions/dist/traverse-tools/fb-leads.php" "$SH/traverse-tools/"   # push-alerts.sh: + every client install's alerts; + fb-leads.php, the Facebook lead ads (2026-10-30)
mkdir -p "$SH/sixfold-tools"; cp "$R/app/tools/nightly-backup.php" "$R/app/tools/regions-warm.php" "$R/app/tools/fuel-prices.php" "$R/app/tools/morning-email.php" "$R/app/tools/edition-eod.php" "$R/app/tools/care-sweep.php" "$SH/sixfold-tools/"   # + plans and customer emails (care-sweep.php) + the editions' end-of-day emails (2026-10-30); backups and the towns warm-up include client installs; + the weekly EIA fuel prices (2026-10-30)
for f in $(find "$SH" -name '*.php'); do php -l "$f" > /dev/null 2>&1 || { echo "LINT FAIL $f"; exit 1; }; done
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
# the client templates and clients.php, then every client install remade from them (2026-10-29)
( cd "$SH" && find . -type f | sed 's#^\./##' | sort > ../sh-files.txt && while IFS= read -r f; do md5sum "$f"; done < ../sh-files.txt | sed 's/ \*/  /' | sort -k2 > ../sh-local.md5 && tar czf ../sh.tgz -T ../sh-files.txt )
cat "$SH/../sh.tgz" | $SG "~/bin/safe-extract.sh ~/www/traverseplatforms.com -" | sed 's/ \*/  /' | sort -k2 > sh-placed.md5 || { echo "template upload FAILED"; exit 1; }
if diff -q "$SH/../sh-local.md5" sh-placed.md5 > /dev/null; then echo "templates MD5 MATCH ($(wc -l < sh-placed.md5))"; else echo "templates MD5 MISMATCH"; exit 1; fi
rm -f "$SH/../sh.tgz" "$SH/../sh-files.txt" "$SH/../sh-local.md5"
$SG "cd ~/www/traverseplatforms.com && php traverse-tools/clients.php regen && { php traverse-tools/clients.php check || echo '  (check: see above; the shared config waits for clients.php setup)'; }" < /dev/null || { echo "client regen FAILED"; exit 1; }
bad=0
for p in summit-de59ae83 $EDS; do
  [ -f "$p/version.txt" ] || continue
  live=$(curl -s "https://traverseplatforms.com/$p/version.txt?x=$RANDOM"); want=$(cat "$p/version.txt")
  [ "$live" = "$want" ] && echo "  $p version $live" || { echo "  $p VERSION live=$live want=$want"; bad=1; }
done
for a in rounds traverse-rounds traverse-yards-rounds traverse-solar-rounds traverse-pest-rounds traverse-security-rounds; do
  c=$(curl -s -o /dev/null -w '%{http_code}' "https://traverseplatforms.com/api/$a.php?action=leads"); [ "$c" = 401 ] || { echo "  api/$a.php answered $c"; bad=1; }
done
# the tile cache refuses anything but a Colorado NAIP tile (400), without fetching (TR-52)
c=$(curl -s -o /dev/null -w '%{http_code}' "https://traverseplatforms.com/api/satcache.php?l=xx&z=1&x=0&y=0"); [ "$c" = 400 ] || { echo "  api/satcache.php answered $c"; bad=1; }
# Jobber's callback with no state answers 400 in plain words; its webhook refuses a GET (405) (TR-46)
c=$(curl -s -o /dev/null -w '%{http_code}' "https://traverseplatforms.com/api/jobber-oauth.php"); [ "$c" = 400 ] || { echo "  api/jobber-oauth.php answered $c"; bad=1; }
c=$(curl -s -o /dev/null -w '%{http_code}' "https://traverseplatforms.com/api/jobber-hook.php"); [ "$c" = 405 ] || { echo "  api/jobber-hook.php answered $c"; bad=1; }
[ $bad = 0 ] && echo "deploy $LABEL: all checks passed (backup before-$LABEL-$STAMP.tgz)" || { echo "deploy $LABEL: CHECK FAILED"; exit 1; }
# the towns answer rebuilt now, in the background on the server, so the first phone after a deploy doesn't wait 7-16 s (2026-10-29)
$SG "f=~/www/traverseplatforms.com/sixfold-tools/regions-warm.php; [ -f \$f ] && (nohup php \$f >> ~/www/traverseplatforms.com/sixfold-data/digest/regions-warm.log 2>&1 &) ; echo '  towns answer: warming in the background'" < /dev/null
