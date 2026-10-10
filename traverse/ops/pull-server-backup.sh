#!/bin/bash
# Nightly copy of what exists ONLY on traverseplatforms.com, down to this computer (2026-10-10, X-9).
#
# The server holds two kinds of files. Most are built here and uploaded (door lists, hail, roofs, photos...): this
# computer already has them. The rest the app writes itself and nothing else has a copy of:
#   *-private/                 accounts, sessions, sign-in codes, phone-alert keys, profile photos
#   *-data/**/*.log            marks, notes, phone calls, assignments, walks, results, the calendar, roof jobs
#   leads/ customers/ digest/ backups/ photos/ avatars/
#   training.json goals*.json roof-settings.json company*.json push*.json   (settings the app writes whole)
# Caches the server rebuilds by itself (best-*, regions-cache-*, alerts-*, storms-*, ratelimit/, *.lock) are left out.
#
# Copies go to C:\Users\Surge Inc\TraverseBackups\ — OUTSIDE the repo: they hold sign-in data and must never be
# committed or opened. The newest 30 are kept. Run by Windows Task Scheduler ("Traverse server backup", nightly).
#   bash traverse/ops/pull-server-backup.sh
set -u
OUT="/c/Users/Surge Inc/TraverseBackups"
mkdir -p "$OUT"
STAMP=$(date +%Y-%m-%d)
F="$OUT/traverse-server-$STAMP.tgz"
LOG="$OUT/backup.log"
TMP="$F.part"
bash /c/Users/SURGEI~1/.ssh/sg.sh trav 'cd ~/www/traverseplatforms.com && { find *-private -type f; find *-data -type f \( -name "*.log" -o -path "*/leads/*" -o -path "*/customers/*" -o -path "*/digest/*" -o -path "*/backups/*" -o -path "*/photos/*" -o -path "*/avatars/*" -o -name "training.json" -o -name "goals*.json" -o -name "roof-settings.json" -o -name "company*.json" -o -name "push*.json" \) ! -name "*.lock"; } | tar czf - -T -' > "$TMP" 2>>"$LOG"
# a good copy: a non-empty archive that lists cleanly
if [ -s "$TMP" ] && tar tzf "$TMP" > /dev/null 2>&1; then
  mv -f "$TMP" "$F"
  echo "$(date '+%Y-%m-%d %H:%M') ok $(tar tzf "$F" | wc -l) files, $(du -h "$F" | cut -f1)" >> "$LOG"
  ls -1t "$OUT"/traverse-server-*.tgz 2>/dev/null | tail -n +31 | while read -r old; do rm -f "$old"; done
else
  rm -f "$TMP"
  echo "$(date '+%Y-%m-%d %H:%M') FAILED (no connection, or the server refused)" >> "$LOG"
  exit 1
fi
