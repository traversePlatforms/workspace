#!/bin/bash
# Reply to a Help desk ticket in the Sixfold app (2026-11-01). The reply text on stdin.
#   bash traverse/ops/help-reply.sh <ticket id> <answered|matthew|working> [refresh] [--pdf <file.pdf> ...] <<'EOF'
#   ...
#   EOF
# Runs sixfold-tools/help-reply.php on the server, which saves it and pings the writer's phone (and Matthew's for "matthew").
# --pdf (3 Nov, Matthew: "can jarvis create pdfs and launch them in the browser"): each PDF is stored for the ticket first
# (sixfold-tools/help-attach.php, outside the web folder) and the reply shows an Open button for it. The name shown is the file's own
# name with anything but letters, digits, dot, dash and underscore made a dash, so name the file the way it should read.
set -u
ID="${1:?ticket id}"; ST="${2:-answered}"; shift 2 || shift $#
case "$ST" in answered|matthew|working) ;; *) echo "status: answered, matthew or working"; exit 2;; esac
[[ "$ID" =~ ^h[0-9]{14}[0-9a-f]{4}$ ]] || { echo "bad ticket id"; exit 2; }
SG="bash /c/Users/SURGEI~1/.ssh/sg.sh trav"
RF=""; FILES=""
while [ $# -gt 0 ]; do
  case "$1" in
    refresh) RF=" refresh"; shift;;   # it changed something on screen, so the chat shows Refresh now (1 Nov)
    --pdf) P="${2:?--pdf needs a file}"; shift 2
      [ -f "$P" ] || { echo "no such file: $P"; exit 2; }
      N=$(basename "$P" | sed -E 's/[^A-Za-z0-9._-]+/-/g; s/^[^A-Za-z0-9]+//'); case "$N" in *.pdf|*.PDF) N="${N%.*}.pdf";; *) N="$N.pdf";; esac
      [ ${#N} -gt 84 ] && N="${N: -84}"; N=$(printf '%s' "$N" | sed -E 's/^[^A-Za-z0-9]+//')
      $SG "php \$HOME/www/traverseplatforms.com/sixfold-tools/help-attach.php $ID '$N'" < "$P" || { echo "could not store $P"; exit 1; }
      FILES="$FILES file=$N";;
    *) echo "unknown option: $1"; exit 2;;
  esac
done
$SG "php \$HOME/www/traverseplatforms.com/sixfold-tools/help-reply.php $ID $ST$RF$FILES"
