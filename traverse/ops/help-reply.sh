#!/bin/bash
# Reply to a Help desk ticket in the Sixfold app (2026-11-01). The reply text on stdin.
#   bash traverse/ops/help-reply.sh <ticket id> <answered|matthew|working> [refresh] <<'EOF'
#   ...
#   EOF
# Runs sixfold-tools/help-reply.php on the server, which saves it and pings the writer's phone (and Matthew's for "matthew").
set -u
ID="${1:?ticket id}"; ST="${2:-answered}"
case "$ST" in answered|matthew|working) ;; *) echo "status: answered, matthew or working"; exit 2;; esac
[[ "$ID" =~ ^h[0-9]{14}[0-9a-f]{4}$ ]] || { echo "bad ticket id"; exit 2; }
RF=""; [ "${3:-}" = "refresh" ] && RF=" refresh"   # refresh: it changed something on screen, so the chat shows Refresh now (1 Nov)
bash /c/Users/SURGEI~1/.ssh/sg.sh trav "php \$HOME/www/traverseplatforms.com/sixfold-tools/help-reply.php $ID $ST$RF"
