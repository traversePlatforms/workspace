#!/bin/bash
# Weekly refresh (Matthew 2026-10-12: "You can do a weekly crime refresh also"): crime near each door (Colorado Springs, Denver and
# Boulder police open data; FBI town figures once a month), and the hail ground reports (NOAA Storm Events + NWS spotter reports)
# with the hourly radar timing for any new storm day. The changed files go to every install that already carries them (Security
# for crime; Roofing for hail), backup first, md5 after. Modelled on refresh-permits.sh.
#
# Safety: nothing is uploaded if the crime file for the neighbourhoods comes back much smaller than last week (a police site down or
# changed looks like that), or if a step fails; last week's files are put back. One line per run in traverse/ops/logs/weekly.log.
# Run by Windows Task Scheduler ("Traverse weekly refresh", Mondays 4:40 am; runs when the laptop next wakes if it was off).
# By hand:  bash traverse/ops/refresh-weekly.sh [--no-upload]
set -u
export PATH="/c/Users/Surge Inc/AppData/Local/nodejs:/usr/bin:/mingw64/bin:$PATH"
REPO="/c/Users/Surge Inc/Desktop/claude test 2"
DT="$REPO/traverse/data-pipeline/door-territory"
DATA="$REPO/traverse/app/data/rounds"
ED="$REPO/traverse/editions"
LOGD="$REPO/traverse/ops/logs"; mkdir -p "$LOGD"
LOG="$LOGD/weekly.log"; OUT="$LOGD/weekly-last.out"
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
UPLOAD=1; [ "${1:-}" = "--no-upload" ] && UPLOAD=0
STAMP=$(date +%Y-%m-%d)
LOCK="$LOGD/weekly.lock"
if ! mkdir "$LOCK" 2>/dev/null; then echo "$STAMP skipped: another run holds the lock" >> "$LOG"; exit 0; fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT
exec > "$OUT" 2>&1
say() { echo "$(date +%H:%M:%S) $*"; }
SAVE=$(mktemp -d)
restore() { for f in "$SAVE"/keep-*.json; do [ -f "$f" ] && cp "$f" "$DATA/$(basename "$f" | sed 's/^keep-//')"; done; }
fail() { say "STOPPED: $*"; echo "$STAMP STOPPED: $*" >> "$LOG"; restore; exit 1; }
for f in "$DATA"/security-*.json "$DATA"/hailrep-*.json "$DATA"/hail-reports.json "$DATA"/hail-hours.json; do [ -f "$f" ] && cp "$f" "$SAVE/keep-$(basename "$f")"; done
size() { stat -c %s "$1" 2>/dev/null || echo 0; }

# 1. crime: today's police data (the cache is per day); the FBI figures again once they are 28 days old
cd "$DT/security" || fail "no security folder"
find cache -name 'fbi-rates.json' -mtime +28 -delete 2>/dev/null
B=$(size "$DATA/security-areas.json")
say "build-security"
node build-security.mjs > "$LOGD/weekly-security.out" 2>&1 || fail "build-security.mjs failed (see weekly-security.out)"
N=$(size "$DATA/security-areas.json")
[ "$B" -lt 1000 ] || [ "$N" -ge $(( B * 80 / 100 )) ] || fail "security-areas.json came back at $N bytes, last week $B (a police site may be down)"
find cache -name '*-20??-??-??.json' -mtime +21 -delete 2>/dev/null   # old daily police downloads

# 2. hail: ground reports, then the hours of any storm day not yet timed
cd "$DT/hail" || fail "no hail folder"
say "build-hail-reports"
node build-hail-reports.mjs > "$LOGD/weekly-hailrep.out" 2>&1 || fail "build-hail-reports.mjs failed (see weekly-hailrep.out)"
say "build-hail-hours"
node build-hail-hours.mjs --conc=4 > "$LOGD/weekly-hailhours.out" 2>&1 || say "build-hail-hours.mjs failed; the hours already built stand"

# 3. the editions (their files are packed per install)
say "build-editions"
cd "$ED" && node build-editions.cjs > "$LOGD/weekly-editions.out" 2>&1 || fail "build-editions.cjs failed (see weekly-editions.out)"

# 4. upload what changed, install by install, only kinds of file the install already carries
TOTAL=0
if [ $UPLOAD = 1 ]; then
  for dd in "$ED"/dist/*-data; do
    d=$(basename "$dd"); cd "$dd/rounds" || continue
    for pat in 'security-*.json' 'hailrep-*.json' 'hail-reports.json' 'hail-hours.json'; do
      ls $pat >/dev/null 2>&1 || continue
      md5sum $pat | sed 's/ [ *]*/  /' | LC_ALL=C sort -k2 > "$SAVE/loc.md5"
      $SG "cd ~/www/traverseplatforms.com/$d/rounds && md5sum $pat 2>/dev/null" < /dev/null | sed 's/ [ *]*/  /' | LC_ALL=C sort -k2 > "$SAVE/srv.md5"
      CH=$(awk 'NR==FNR { s[$2] = $1; next } s[$2] != $1 { print $2 }' "$SAVE/srv.md5" "$SAVE/loc.md5" | tr '\n' ' ')
      [ -n "${CH// /}" ] || continue
      $SG "cd ~/www/traverseplatforms.com/$d/rounds && tar -czf ~/upload-backups/weekly-$d-$(echo $pat | tr -dc a-z)-before-$STAMP.tgz \$(ls $pat 2>/dev/null) 2>/dev/null; true" < /dev/null
      tar -cf - $CH | $SG "~/bin/safe-extract.sh ~/www/traverseplatforms.com/$d/rounds - > /dev/null" || fail "$d: upload failed"   # rename into place (2026-10-27)
      $SG "cd ~/www/traverseplatforms.com/$d/rounds && md5sum $CH" < /dev/null | sed 's/ [ *]*/  /' | LC_ALL=C sort -k2 > "$SAVE/after.md5"
      md5sum $CH | sed 's/ [ *]*/  /' | LC_ALL=C sort -k2 > "$SAVE/want.md5"
      diff -q "$SAVE/want.md5" "$SAVE/after.md5" > /dev/null || fail "$d: md5 mismatch after upload"
      say "$d: $(echo $CH | wc -w) $pat files"; TOTAL=$(( TOTAL + $(echo $CH | wc -w) ))
    done
  done
fi
say "done: $TOTAL files uploaded"
echo "$STAMP ok: $TOTAL files uploaded$([ $UPLOAD = 0 ] && echo ' (no-upload run)')" >> "$LOG"
rm -rf "$SAVE"
