#!/bin/bash
# P-15 (21 Nov 2026; Matthew: "yeah do stub reading with the money build, id rahter drop in a folder then email").
# Pay stubs (PDFs from Paychex Flex) dropped in Desktop\paystubs go to J.A.R.V.I.S.: each new PDF is sent over SSH to
# assistant-private/jvstub.php (kept 0600 in data/finance/stubs/, read by the cheap model, matched to its deposit), then moved to
# paystubs\Done\. Once per file, by its hash (sent.txt), so a re-dropped stub is never sent twice. A file still being written (changed in
# the last 30 s) waits for the next round. Run from traverse/ops/help-watch.sh's 5-minute beat; by hand: bash assistant/jarvis/tools/paystub-watch.sh
# Logs names and the outcome only (never a number from a stub). PAYSTUB_DIR / PAYSTUB_SG / PAYSTUB_ST: the test's stand-ins.
set -u
DIR="${PAYSTUB_DIR:-/c/Users/Matthew sharpe/Desktop/paystubs}"
SG="${PAYSTUB_SG:-bash /c/Users/SURGEI~1/.ssh/sg.sh trav}"
ST="${PAYSTUB_ST:-$(cygpath -u "$LOCALAPPDATA" 2>/dev/null || echo "$LOCALAPPDATA")/ProjectBackup/paystubs}"
[ -d "$DIR" ] || exit 0
mkdir -p "$ST" "$DIR/Done"; LOG="$ST/paystubs.log"; SEEN="$ST/sent.txt"; touch "$SEEN"
log() { echo "$(date '+%F %T') $*" >> "$LOG"; }
LK="$ST/lock.d"; mkdir "$LK" 2>/dev/null || { [ $(( $(date +%s) - $(stat -c %Y "$LK" 2>/dev/null || date +%s) )) -gt 1800 ] && rmdir "$LK" && mkdir "$LK" 2>/dev/null || exit 0; }
trap 'rmdir "$LK" 2>/dev/null' EXIT
shopt -s nullglob nocaseglob
done_move() { local f="$1" b; b=$(basename "$f"); if [ -e "$DIR/Done/$b" ]; then mv "$f" "$DIR/Done/${b%.*}-$(date +%s).${b##*.}"; else mv "$f" "$DIR/Done/"; fi; }
for f in "$DIR"/*.pdf; do
  [ -f "$f" ] || continue
  [ $(( $(date +%s) - $(stat -c %Y "$f") )) -lt 30 ] && continue
  h=$(sha256sum "$f" | cut -c1-16); name=$(basename "$f" | tr -c 'A-Za-z0-9._ ()\n-' '_')
  if grep -q "^$h " "$SEEN"; then done_move "$f"; log "already sent: $name ($h), moved to Done"; continue; fi
  out=$($SG "php ~/www/traverseplatforms.com/assistant-private/jvstub.php add '$name'" < "$f" 2>>"$LOG" | tail -1)
  if printf '%s' "$out" | grep -q '"ok":true'; then
    echo "$h $(date '+%F_%T') $name" >> "$SEEN"; done_move "$f"
    log "sent: $name ($h) $(printf '%s' "$out" | grep -o '"status":"[a-z]*"\|"dup":true' | tr '\n' ' ')"
  else log "not sent: $name ($h): $(printf '%s' "$out" | cut -c1-160)"; fi
done
exit 0
