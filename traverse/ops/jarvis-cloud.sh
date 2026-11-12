#!/bin/bash
# The cloud J.A.R.V.I.S. from the laptop (11 Nov 2026, TASKS X-15; see JARVIS-CLOUD.md). Run in Git Bash (the VS Code terminal).
#   bash traverse/ops/jarvis-cloud.sh signin     Matthew: sign Claude Code on the VM in to your Claude plan (opens a link to paste back)
#   bash traverse/ops/jarvis-cloud.sh status     readiness check on the VM (--check) + the service state + the last log lines
#   bash traverse/ops/jarvis-cloud.sh deploy     copy the watcher + practice prompt to the VM and (re)start the service
#   bash traverse/ops/jarvis-cloud.sh stop|start the service      log   the last 40 log lines      pubkey   the VM's server key (public half)
set -u
VM="yard@20.91.198.101"; VK="/c/Users/SURGEI~1/.ssh/azure_yard"
OPS="$(cd "$(dirname "$0")" && pwd)"
v() { ssh -o BatchMode=yes -o ConnectTimeout=20 -i "$VK" "$VM" "$@"; }
case "${1:-status}" in
  signin) echo "A link appears below. Open it, sign in with your Claude account (the plan, not the Console), and paste the code back here."
          ssh -t -i "$VK" "$VM" '~/.local/bin/claude auth login --claudeai && ~/.local/bin/claude auth status | grep -E "loggedIn|subscriptionType"; systemctl --user restart jarvis-cloud';;
  status) v 'bash ~/jarvis/ops/help-watch-cloud.sh --check; echo; tail -n 8 ~/jarvis/state/help-watch.log';;
  # review 12 Nov: the new watcher goes up beside the old one (.new) and replaces it only after its guard test passes, so a copy that
  # fails the guard is never the file the service (or a reboot) would start; a failed test leaves the running service as it was
  deploy) scp -q -o BatchMode=yes -i "$VK" "$OPS/help-watch-cloud.sh" "$VM:jarvis/ops/help-watch-cloud.sh.new" &&
          v 'chmod 700 ~/jarvis/ops/help-watch-cloud.sh.new; bash -n ~/jarvis/ops/help-watch-cloud.sh.new && bash ~/jarvis/ops/help-watch-cloud.sh.new --guard-test | tail -1 | grep -q "all PASS" || { echo "guard test FAILED: the old watcher was left in place and running"; rm -f ~/jarvis/ops/help-watch-cloud.sh.new; exit 1; }; mv ~/jarvis/ops/help-watch-cloud.sh.new ~/jarvis/ops/help-watch-cloud.sh' &&
          scp -q -o BatchMode=yes -i "$VK" "$OPS/help-practice-prompt.md" "$VM:jarvis/ops/" &&
          scp -q -o BatchMode=yes -i "$VK" "$OPS/jarvis-cloud.service" "$VM:.config/systemd/user/jarvis-cloud.service" &&
          v 'systemctl --user daemon-reload; systemctl --user enable --now jarvis-cloud >/dev/null 2>&1; systemctl --user restart jarvis-cloud; sleep 2; systemctl --user is-active jarvis-cloud';;
  stop|start) v "systemctl --user $1 jarvis-cloud; systemctl --user is-active jarvis-cloud";;
  log) v 'tail -n 40 ~/jarvis/state/help-watch.log';;
  pubkey) v 'cat ~/jarvis/secrets/traverse_sg_cloud.pub';;
  *) echo "signin | status | deploy | stop | start | log | pubkey"; exit 2;;
esac
