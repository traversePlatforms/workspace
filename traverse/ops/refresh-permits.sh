#!/bin/bash
# Monthly permit refresh (Matthew 2026-10-11): re-roof and solar permits re-fetched from the three sources that publish them
# (Pikes Peak Regional Building, Douglas County, Centennial), the per-town permit files rebuilt, and the ones that changed
# uploaded to every Traverse install that carries permits (Roofing and Solar today), with a backup first and an md5 check.
# Parker and Thornton came from records requests (files, not a feed): they are rebuilt from the files already here and only
# change when a new request is answered.
#
# Safety: nothing is uploaded if a source or a town comes back noticeably smaller than last time (a site down or changed
# its format looks like that), or if any step fails. The previous source files are put back. One line per run in
# traverse/ops/logs/permit-refresh.log; the full output of the last run beside it.
# Run by Windows Task Scheduler ("Traverse permit refresh", 1st of each month, 4:10 am; runs when the laptop next wakes if
# it was off). By hand:  bash traverse/ops/refresh-permits.sh  [--no-upload]
set -u
export PATH="/c/Users/Surge Inc/AppData/Local/nodejs:/usr/bin:/mingw64/bin:$PATH"
REPO="/c/Users/Surge Inc/Desktop/claude test 2"
P="$REPO/traverse/data-pipeline/door-territory/permits"
DATA="$REPO/traverse/app/data/rounds"
ED="$REPO/traverse/editions"
LOGD="$REPO/traverse/ops/logs"; mkdir -p "$LOGD"
LOG="$LOGD/permit-refresh.log"; OUT="$LOGD/permit-refresh-last.out"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
UPLOAD=1; [ "${1:-}" = "--no-upload" ] && UPLOAD=0
STAMP=$(date +%Y-%m-%d)
LOCK="$LOGD/permit-refresh.lock"
if ! mkdir "$LOCK" 2>/dev/null; then echo "$STAMP skipped: another run holds the lock" >> "$LOG"; exit 0; fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT
exec > "$OUT" 2>&1
say() { echo "$(date +%H:%M:%S) $*"; }
fail() { say "STOPPED: $*"; echo "$STAMP STOPPED: $*" >> "$LOG"; restore; exit 1; }
SAVE=$(mktemp -d)
restore() { for f in pprbd douglas centennial; do [ -f "$SAVE/$f-permits.json" ] && cp "$SAVE/$f-permits.json" "$P/$f-permits.json"; done; for f in "$SAVE"/app-permit-*.json; do [ -f "$f" ] && cp "$f" "$DATA/$(basename "$f" | sed 's/^app-//')"; done; }

# counts before
count() { node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const o=j.permits||j.doors||{};console.log(Array.isArray(o)?o.length:Object.keys(o).length)" "$1" 2>/dev/null || echo 0; }
for f in pprbd douglas centennial; do cp "$P/$f-permits.json" "$SAVE/" 2>/dev/null; eval "BEFORE_$f=$(count "$P/$f-permits.json")"; done
for f in "$DATA"/permit-*.json; do cp "$f" "$SAVE/app-$(basename "$f")"; done

# 1. fetch
cd "$P" || fail "no permits folder"
for f in pprbd douglas centennial; do
  say "fetch $f"
  node "fetch-$f.mjs" || fail "fetch-$f.mjs failed"
  n=$(count "$P/$f-permits.json"); eval "b=\$BEFORE_$f"
  say "  $f: $b -> $n permits"
  [ "$n" -ge $(( b * 95 / 100 )) ] || fail "$f came back with $n permits, last time $b (more than 5% fewer)"
done

# 2. rebuild the per-town files, then compare each town with last time
say "build-permits"
node build-permits.mjs || fail "build-permits.mjs failed"
for f in "$SAVE"/app-permit-*.json; do
  t=$(basename "$f" | sed 's/^app-//'); [ "$t" = "permit-index.json" ] && continue
  b=$(count "$f"); n=$(count "$DATA/$t")
  if [ "$b" -ge 50 ] && [ "$n" -lt $(( b * 90 / 100 )) ]; then fail "$t has $n doors with permits, last time $b"; fi
done

# 3. the editions (their permit files are packed per install)
say "build-editions"
cd "$ED" && node build-editions.cjs > "$LOGD/permit-refresh-editions.out" 2>&1 || fail "build-editions.cjs failed (see permit-refresh-editions.out)"

# 4. upload what changed, install by install
TOTAL=0
if [ $UPLOAD = 1 ]; then
  for dd in "$ED"/dist/*-data; do
    d=$(basename "$dd"); ls "$dd/rounds"/permit-*.json >/dev/null 2>&1 || continue
    has=$($SG "ls ~/www/traverseplatforms.com/$d/rounds 2>/dev/null | grep -c '^permit-'" < /dev/null)
    [ "${has:-0}" -gt 0 ] || continue                                   # only installs that already carry permits
    cd "$dd/rounds" || continue
    md5sum permit-*.json | sed 's/ \*/  /' | LC_ALL=C sort -k2 > "$SAVE/loc.md5"
    $SG "cd ~/www/traverseplatforms.com/$d/rounds && md5sum permit-*.json" < /dev/null | LC_ALL=C sort -k2 > "$SAVE/srv.md5"
    CH=$(awk 'NR==FNR { s[$2] = $1; next } s[$2] != $1 { print $2 }' "$SAVE/srv.md5" "$SAVE/loc.md5" | tr '\n' ' ')   # new or different
    [ -n "${CH// /}" ] || { say "$d: no change"; continue; }
    say "$d: uploading $CH"
    $SG "cd ~/www/traverseplatforms.com/$d/rounds && tar -czf ~/upload-backups/permits-$d-before-$STAMP.tgz permit-*.json" < /dev/null || fail "$d: backup failed"
    tar -cf - $CH | $SG "cd ~/www/traverseplatforms.com/$d/rounds && tar -xf -" || fail "$d: upload failed"
    $SG "cd ~/www/traverseplatforms.com/$d/rounds && md5sum $CH" < /dev/null | LC_ALL=C sort -k2 > "$SAVE/after.md5"
    md5sum $CH | sed 's/ \*/  /' | LC_ALL=C sort -k2 > "$SAVE/want.md5"
    diff -q "$SAVE/want.md5" "$SAVE/after.md5" > /dev/null || fail "$d: md5 mismatch after upload (backup ~/upload-backups/permits-$d-before-$STAMP.tgz)"
    TOTAL=$(( TOTAL + $(echo $CH | wc -w) ))
  done
fi
SUM="pprbd $BEFORE_pprbd->$(count "$P/pprbd-permits.json"), douglas $BEFORE_douglas->$(count "$P/douglas-permits.json"), centennial $BEFORE_centennial->$(count "$P/centennial-permits.json")"
say "done: $SUM; $TOTAL files uploaded"
echo "$STAMP ok: $SUM; $TOTAL files uploaded$([ $UPLOAD = 0 ] && echo ' (no-upload run)')" >> "$LOG"
rm -rf "$SAVE"
