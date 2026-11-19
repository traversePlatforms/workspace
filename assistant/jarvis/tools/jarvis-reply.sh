#!/bin/bash
# Reply in Matthew's J.A.R.V.I.S. desk (2026-11-19: his desk chats left the Sixfold app; the store is the Assistant's own, lib/desk.php).
# Same shape as traverse/ops/help-reply.sh, which stays for the staff (Jen, Brad) and the Houston install. The reply text on stdin.
#   bash assistant/jarvis/tools/jarvis-reply.sh <thread id | main> <answered|matthew|working> [refresh] [--pdf <file.pdf> ...] <<'EOF'
#   ...
#   EOF
# main = his main thread (h202611181123486ccb, moved over from the Sixfold app with its history): builders, the overnight check and any
# session that needs to tell him something use it.
# answered: done or explained, and his phones get an alert (J.A.R.V.I.S.'s own Web Push). matthew: it needs him at the computer (alert
# titled "needs you"). working: a progress note in the thread, no alert.
# --pdf: each PDF is stored with the thread first (over SSH: jvdesk.php attach), and the reply shows an Open button for it. Name the file
# the way it should read (letters, digits, dash).
# The reply goes over HTTPS with the laptop's key (~/.ssh/jarvis-desk-key.txt, sent in a header, never printed); if HTTPS does not answer
# (SiteGround's bot check has blocked this laptop for hours before), over SSH instead (jvdesk.php reply). Exit 0 only when it landed.
set -u
MAIN=h202611181123486ccb
ID="${1:?thread id or main}"; ST="${2:-answered}"; shift 2 || shift $#
[ "$ID" = main ] && ID="$MAIN"
case "$ST" in answered|matthew|working) ;; *) echo "status: answered, matthew or working"; exit 2;; esac
[[ "$ID" =~ ^h[0-9]{14}[0-9a-f]{4}$ ]] || { echo "bad thread id"; exit 2; }
SG="${JARVIS_SG:-bash /c/Users/SURGEI~1/.ssh/sg.sh trav}"
TOOL='$HOME/www/traverseplatforms.com/assistant-private/jvdesk.php'
URL="${JARVIS_DESK_URL:-https://traverseplatforms.com/a-e018bb82/api.php}"
KEYF="${JARVIS_DESK_KEYFILE:-/c/Users/SURGEI~1/.ssh/jarvis-desk-key.txt}"
RF=0; FILES=()
while [ $# -gt 0 ]; do
  case "$1" in
    refresh) RF=1; shift;;
    --pdf) P="${2:?--pdf needs a file}"; shift 2
      [ -f "$P" ] || { echo "no such file: $P"; exit 2; }
      N=$(basename "$P" | sed -E 's/[^A-Za-z0-9._-]+/-/g; s/^[^A-Za-z0-9]+//'); case "$N" in *.pdf|*.PDF) N="${N%.*}.pdf";; *) N="$N.pdf";; esac
      [ ${#N} -gt 84 ] && N="${N: -84}"; N=$(printf '%s' "$N" | sed -E 's/^[^A-Za-z0-9]+//')
      $SG "php $TOOL attach $ID '$N'" < "$P" || { echo "could not store $P"; exit 1; }
      FILES+=("$N");;
    *) echo "unknown option: $1"; exit 2;;
  esac
done
TXT=$(cat)
[ -n "$(printf '%s' "$TXT" | tr -d '[:space:]')" ] || { echo "empty reply"; exit 2; }
# HTTPS first: the body is JSON made by node (the text never goes on a command line)
if [ -s "$KEYF" ]; then
  BODY=$(printf '%s' "$TXT" | ID="$ID" ST="$ST" RF="$RF" FL="${FILES[*]:-}" node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.stringify({id:process.env.ID,status:process.env.ST,refresh:process.env.RF==='1',files:(process.env.FL||'').split(' ').filter(Boolean),text:s})))")
  HF=$(mktemp); chmod 600 "$HF"; printf 'X-Jarvis-Key: %s\n' "$(tr -d '\r\n' < "$KEYF")" > "$HF"   # the key goes in a header file, never on a command line
  R=$(printf '%s' "$BODY" | curl -s -m 30 -A "jarvis-desk/1.0" -H "Content-Type: application/json" -H @"$(cygpath -w "$HF" 2>/dev/null || echo "$HF")" --data-binary @- "$URL?action=jvdreply" 2>/dev/null); rm -f "$HF"
  if printf '%s' "$R" | grep -q '"ok":true'; then
    echo "replied ($ST) in J.A.R.V.I.S.$(printf '%s' "$R" | grep -q '"pushed":true' && echo ', pushed to his phone')"; exit 0
  fi
  printf '%s' "$R" | grep -q '"ok":false' && printf '%s' "$R" | grep -q '"error":"\(no such\|empty\|status\|could not\|no stored\)' && { echo "not replied: $(printf '%s' "$R" | sed -E 's/.*"error":"([^"]*)".*/\1/')"; exit 1; }
fi
# SSH: the same reply, through jvdesk.php on the server
FA=""; for f in "${FILES[@]:-}"; do [ -n "$f" ] && FA="$FA file=$f"; done
RFA=""; [ "$RF" = 1 ] && RFA=" refresh"
printf '%s' "$TXT" | $SG "php $TOOL reply $ID $ST$RFA$FA"
