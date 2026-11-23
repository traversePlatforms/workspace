#!/bin/bash
# Reply in an app's own J.A.R.V.I.S. chat (2026-11-21, TASKS JV-APPS): the Peak desk, the post calendar, or a client install (the Houston
# test install). The reply text on stdin; same options as help-reply.sh (which stays the Sixfold field app's):
#   bash traverse/ops/jv-reply.sh <peak|posts|c-<slug>> <ticket id> <answered|matthew|working> [refresh] [--pdf <file.pdf> ...] <<'EOF'
#   ...
#   EOF
# peak / posts: jv-tools/jv.php on the server (the app's own help.log; Peak tells the writer through the desk's own push and email alerts).
# c-<slug>: sixfold-tools/help-reply.php --install=<slug> (the install's own help.log and its own push).
# "matthew" also tells Matthew now, in his J.A.R.V.I.S. desk (assistant/jarvis/tools/jarvis-status.sh alert), with the first lines of the reply.
set -u
Q="${1:?queue: peak, posts or c-<slug>}"; ID="${2:?ticket id}"; ST="${3:-answered}"; shift 3 || shift $#
case "$Q" in peak|posts) ;; c-*) [[ "$Q" =~ ^c-[a-z0-9-]{1,40}$ ]] || { echo "bad install id"; exit 2; };; *) echo "queue: peak, posts or c-<slug>"; exit 2;; esac
case "$ST" in answered|matthew|working) ;; *) echo "status: answered, matthew or working"; exit 2;; esac
[[ "$ID" =~ ^h[0-9]{14}[0-9a-f]{4}$ ]] || { echo "bad ticket id"; exit 2; }
SG_DEF="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"; [ -f /c/Users/SURGEI~1/.ssh/sg.sh ] || SG_DEF="bash $HOME/jarvis/bin/sg.sh trav"   # off the laptop: the VM's own wrapper (VM-MAIN-WORKSPACE.md)
SG="$SG_DEF"
[ -n "${JARVIS_SG:-}" ] && SG="$JARVIS_SG"   # the cloud J.A.R.V.I.S. machine: its own key
JV='php $HOME/www/traverseplatforms.com/jv-tools/jv.php'; TOOLS='php $HOME/www/traverseplatforms.com/sixfold-tools'
RF=""; FILES=""; TXT=$(cat)
[ -n "$(printf '%s' "$TXT" | tr -d '[:space:]')" ] || { echo "empty reply"; exit 2; }
while [ $# -gt 0 ]; do
  case "$1" in
    refresh) RF=" refresh"; shift;;
    --pdf) P="${2:?--pdf needs a file}"; shift 2
      [ -f "$P" ] || { echo "no such file: $P"; exit 2; }
      N=$(basename "$P" | sed -E 's/[^A-Za-z0-9._-]+/-/g; s/^[^A-Za-z0-9]+//'); case "$N" in *.pdf|*.PDF) N="${N%.*}.pdf";; *) N="$N.pdf";; esac
      [ ${#N} -gt 84 ] && N="${N: -84}"; N=$(printf '%s' "$N" | sed -E 's/^[^A-Za-z0-9]+//')
      if [[ "$Q" == c-* ]]; then $SG "$TOOLS/help-attach.php $ID '$N' --install=$Q" < "$P" || { echo "could not store $P"; exit 1; }
      else $SG "$JV $Q attach $ID '$N'" < "$P" || { echo "could not store $P"; exit 1; }; fi
      FILES="$FILES file=$N";;
    *) echo "unknown option: $1"; exit 2;;
  esac
done
if [[ "$Q" == c-* ]]; then printf '%s' "$TXT" | $SG "$TOOLS/help-reply.php $ID $ST$RF$FILES --install=$Q"; RC=$?
else printf '%s' "$TXT" | $SG "$JV $Q reply $ID $ST$RF$FILES"; RC=$?; fi
if [ "$RC" = 0 ] && [ "$ST" = matthew ]; then
  case "$Q" in peak) L="Peak desk";; posts) L="Post calendar";; *) L="${Q#c-}";; esac
  R="$(cd "$(dirname "$0")/../.." && pwd)"
  bash "$R/assistant/jarvis/tools/jarvis-status.sh" alert "J.A.R.V.I.S. ($L chat, $ID) passed this to you: $(printf '%s' "$TXT" | tr -s '\r\n\t ' ' ' | cut -c1-300)" > /dev/null 2>&1 || echo "(the alert to Matthew did not go)"
fi
exit $RC
