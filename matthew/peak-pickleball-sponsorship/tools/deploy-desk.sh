#!/bin/bash
# Upload the Peak Sponsor Desk (2026-11-21, TASKS JV-APPS: written for J.A.R.V.I.S.'s own fixes, and used for its first deploy).
#   bash matthew/peak-pickleball-sponsorship/tools/deploy-desk.sh <label> [--check] [--base <git rev>]
# What goes: the page (index.html, sw.js and jv-chat.js, minified like before with shared/tools/minify-public.cjs), every api/*.php, the
# chat code api/jv-lib.php (from shared/jv-chat/), and the J.A.R.V.I.S. server tool jv-tools/jv.php (beside public_html, never served).
# Only files that differ from the live copy are sent. Before anything is sent, each live file must still be what git <base> (default HEAD)
# would have uploaded: if someone changed it since, it stops and sends nothing. Then each file is backed up
# (cp -p to ~/upload-backups/<name>.before-<label>), sent as X.new, checked (php -l), given the old file's mode, moved into place, and the
# md5 of every file is compared after. Ends "deploy: OK" or "deploy: FAILED ...". --check: compare only, send nothing.
# The data (peak-desk-data/) is never touched. On the cloud J.A.R.V.I.S. machine it refuses unless that machine holds the write turn.
set -u
LABEL="${1:?label, e.g. jv-h20261121...}"; shift
CHECK=0; BASE=HEAD
while [ $# -gt 0 ]; do case "$1" in --check) CHECK=1; shift;; --base) BASE="${2:?rev}"; shift 2;; *) echo "unknown option: $1"; exit 2;; esac; done
[[ "$LABEL" =~ ^[A-Za-z0-9._-]{1,60}$ ]] || { echo "label: letters, digits, dot, dash, underscore"; exit 2; }
if [ "${JARVIS_CLOUD:-}" = 1 ] && [ "$CHECK" = 0 ]; then
  W="${JARVIS_HOME:-$HOME/jarvis}/state/write-ok"
  [ -s "$W" ] && [ $(( $(date +%s) - $(stat -c %Y "$W") )) -lt 10800 ] || { echo "REFUSED (cloud): the laptop is on, so it does the deploys. Queue this for the laptop (laptop-job.sh)."; exit 1; }
fi
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"; P="$REPO/matthew/peak-pickleball-sponsorship"; cd "$REPO" || exit 1
SG="${JARVIS_SG:-bash /c/Users/SURGEI~1/.ssh/sg.sh trav}"; SITE='$HOME/www/traverseplatforms.com'; PUB="public_html/peak-desk-28d38d"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT; mkdir -p "$T/new" "$T/base/src" "$T/base/out" "$T/basejv"
# the list: <file as built here> <its source in git (for the base)> <where on the server, under the site> <how: min|copy>
node shared/tools/minify-public.cjs "$P/app" "$T/new" index.html sw.js > /dev/null && node shared/tools/minify-public.cjs shared/jv-chat "$T/new" jv-chat.js > /dev/null || { echo "deploy: FAILED (the minified build)"; exit 1; }
L=()
for f in index.html sw.js; do L+=("$T/new/$f|matthew/peak-pickleball-sponsorship/app/$f|$PUB/$f|min"); done
L+=("$T/new/jv-chat.js|shared/jv-chat/jv-chat.js|$PUB/jv-chat.js|min")
for f in "$P"/app/api/*.php; do b=$(basename "$f"); L+=("$f|matthew/peak-pickleball-sponsorship/app/api/$b|$PUB/api/$b|copy"); done
L+=("$REPO/shared/jv-chat/jv-lib.php|shared/jv-chat/jv-lib.php|$PUB/api/jv-lib.php|copy" "$REPO/shared/jv-chat/jv.php|shared/jv-chat/jv.php|jv-tools/jv.php|copy")
# what git <base> would have uploaded
for e in "${L[@]}"; do IFS='|' read -r loc src dst how <<< "$e"
  n=$(echo "$dst" | tr '/' '_')
  if git cat-file -e "$BASE:$src" 2>/dev/null; then
    if [ "$how" = min ]; then git show "$BASE:$src" > "$T/base/src/$(basename "$src")"; node shared/tools/minify-public.cjs "$T/base/src" "$T/base/out" "$(basename "$src")" > /dev/null; cp "$T/base/out/$(basename "$src")" "$T/basejv/$n"
    else git show "$BASE:$src" > "$T/basejv/$n"; fi
  fi
done
md5of() { [ -f "$1" ] && md5sum "$1" | cut -d' ' -f1 || echo none; }
REMOTE=""; for e in "${L[@]}"; do IFS='|' read -r loc src dst how <<< "$e"; REMOTE="$REMOTE $dst"; done
LIVE=$($SG "cd $SITE && for f in$REMOTE; do if [ -f \"\$f\" ]; then md5sum \"\$f\"; else echo \"none \$f\"; fi; done" < /dev/null) || { echo "deploy: FAILED (server not reachable)"; exit 1; }
SEND=(); STOP=0
for e in "${L[@]}"; do IFS='|' read -r loc src dst how <<< "$e"
  n=$(echo "$dst" | tr '/' '_'); new=$(md5of "$loc"); base=$(md5of "$T/basejv/$n"); live=$(printf '%s\n' "$LIVE" | awk -v d="$dst" '$2==d {print $1}' | head -1); live="${live:-none}"
  if [ "$new" = "$live" ]; then continue; fi
  if [ "$live" != "$base" ]; then echo "  $dst: the live copy ($live) is not what $BASE uploads ($base): changed by someone else since. Stopping."; STOP=1; continue; fi
  SEND+=("$e"); echo "  $dst: to send${CHECK:+}"
done
[ "$STOP" = 1 ] && { echo "deploy: FAILED (live differs from git $BASE; nothing sent)"; exit 1; }
[ ${#SEND[@]} = 0 ] && { echo "nothing to send: live is the same"; echo "deploy: OK"; exit 0; }
[ "$CHECK" = 1 ] && { echo "check only: ${#SEND[@]} file(s) would go"; exit 0; }
for e in "${SEND[@]}"; do IFS='|' read -r loc src dst how <<< "$e"
  bn=$(basename "$dst"); d=$(dirname "$dst"); lint=":"; case "$bn" in *.php) lint="php -l $bn.new > /dev/null";; esac
  cat "$loc" | $SG "cd $SITE && mkdir -p $d && cd $d && mkdir -p \$HOME/upload-backups && { [ ! -f $bn ] || cp -p $bn \$HOME/upload-backups/$(echo "$dst" | tr '/' '_').before-$LABEL; } && cat > $bn.new && $lint && { [ -f $bn ] && chmod --reference=$bn $bn.new || chmod 644 $bn.new; } && mv $bn.new $bn" \
    || { echo "deploy: FAILED at $dst (the files before it are live; backups are in ~/upload-backups/*.before-$LABEL)"; exit 1; }
done
AFTER=$($SG "cd $SITE && md5sum$REMOTE 2>/dev/null" < /dev/null)
BAD=0; for e in "${SEND[@]}"; do IFS='|' read -r loc src dst how <<< "$e"
  [ "$(printf '%s\n' "$AFTER" | awk -v d="$dst" '$2==d {print $1}')" = "$(md5of "$loc")" ] && echo "  $dst: sent, md5 match" || { echo "  $dst: md5 MISMATCH"; BAD=1; }
done
[ "$BAD" = 0 ] && echo "deploy: OK (${#SEND[@]} file(s); backups ~/upload-backups/*.before-$LABEL)" || { echo "deploy: FAILED (md5)"; exit 1; }
