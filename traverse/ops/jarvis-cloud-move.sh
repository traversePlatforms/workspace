#!/bin/bash
# Move the cloud J.A.R.V.I.S. from the trial machine (yardtest, Standard_D4as_v5) to a small paid one (Standard_B2s) before the free
# credit ends (~23 Nov 2026). TASKS X-15; the clicks for making the machine are in JARVIS-CLOUD.md, "Moving to the B2s". Git Bash, laptop.
#   bash traverse/ops/jarvis-cloud-move.sh check  <new ip>   can the laptop reach it (same azure_yard key, user yard), what is installed
#   bash traverse/ops/jarvis-cloud-move.sh prep   <new ip>   packages (ffmpeg jq git node 22 php-cli bsdtar chrome), Claude Code, linger
#   bash traverse/ops/jarvis-cloud-move.sh copy   <new ip>   ~/jarvis from the old machine to the new one through the laptop (secrets,
#                                                            whisper + its model, the bare repo, outbox, shadow log, config); the old
#                                                            one keeps running and keeps its copy. Then init (clone + npm ci) there.
#   bash traverse/ops/jarvis-cloud-move.sh switch <new ip>   the old watcher to mode off (its service stopped, the machine left alone),
#                                                            the new one started in the old one's mode; the laptop's scripts now use the
#                                                            new address (ProjectBackup/cloud-sync/vm.txt). Then: jarvis-cloud.sh signin.
# Nothing is deleted anywhere. The old machine is not stopped or resized: that is Matthew's, in the portal, after the new one is checked.
set -u
OLD="yard@20.91.198.101"; VK="/c/Users/SURGEI~1/.ssh/azure_yard"
OPS="$(cd "$(dirname "$0")" && pwd)"; PB="$(cygpath -u "$LOCALAPPDATA" 2>/dev/null || echo "$LOCALAPPDATA")/ProjectBackup"
IP="${2:?the public IP of the new machine}"; [[ "$IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || { echo "give the IP, e.g. 20.91.1.2"; exit 2; }
NEW="yard@$IP"
o() { ssh -o BatchMode=yes -o ConnectTimeout=20 -i "$VK" "$OLD" "$@"; }
n() { ssh -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new -i "$VK" "$NEW" "$@"; }
case "${1:-}" in
  check) n 'echo "reached $(hostname): $(nproc) CPU, $(free -m | awk "/Mem/{print \$2}") MB, disk $(df -h / | awk "NR==2{print \$2\" (\"\$4\" free)\"}")"; for c in node jq git ffmpeg php bsdtar google-chrome; do printf "%s: %s\n" $c "$(command -v $c > /dev/null && echo ok || echo missing)"; done; [ -x ~/.local/bin/claude ] && echo "claude: $(~/.local/bin/claude --version)" || echo "claude: missing"; sudo -n true 2>/dev/null && echo "sudo: ok" || echo "sudo: NOT passwordless"';;
  prep) n 'set -e; export DEBIAN_FRONTEND=noninteractive
         sudo -n apt-get update -qq
         sudo -n apt-get install -y -qq ffmpeg jq git php-cli libarchive-tools curl ca-certificates > /dev/null
         if ! node --version 2>/dev/null | grep -q "^v22"; then curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -n -E bash - > /dev/null && sudo -n apt-get install -y -qq nodejs > /dev/null; fi
         if ! command -v google-chrome > /dev/null; then curl -fsSLo /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && sudo -n apt-get install -y -qq /tmp/chrome.deb > /dev/null; rm -f /tmp/chrome.deb; fi
         [ -x ~/.local/bin/claude ] || curl -fsSL https://claude.ai/install.sh | bash > /dev/null
         sudo -n loginctl enable-linger yard
         echo "prep: node $(node --version), claude $(~/.local/bin/claude --version | cut -d" " -f1), chrome $(google-chrome --version | cut -d" " -f3)"';;
  copy) echo "copying ~/jarvis (secrets stay inside the stream; nothing is written on the laptop)..."
        o 'tar -C ~ -czf - --exclude=jarvis/state/audio --exclude=jarvis/state/photos --exclude=jarvis/practice-cwd jarvis .config/systemd/user/jarvis-cloud.service' |
          n 'mkdir -p ~/.config/systemd/user && tar -C ~ -xzf - && chmod 700 ~/jarvis ~/jarvis/secrets && chmod 600 ~/jarvis/secrets/* && echo "copied: $(du -sh ~/jarvis | cut -f1)"' || { echo "copy FAILED"; exit 1; }
        n 'cd ~/jarvis/tools/whisper.cpp && ./build/bin/whisper-cli --help > /dev/null 2>&1 && echo "whisper.cpp runs here" || echo "whisper.cpp does not run here: rebuild it (cmake -B build && cmake --build build -j2 --config Release), see JARVIS-CLOUD.md"'
        JARVIS_VM="$NEW" bash "$OPS/jarvis-cloud.sh" init;;
  switch) M=$(o 'bash ~/jarvis/ops/help-watch-cloud.sh --mode' 2>/dev/null || echo shadow)
        n "bash ~/jarvis/ops/help-watch-cloud.sh --guard-test | tail -1" | grep -q "all PASS" || { echo "the new machine's guard test does not pass: not switched"; exit 1; }
        o 'echo MODE=off > ~/jarvis/config; systemctl --user stop jarvis-cloud; systemctl --user disable jarvis-cloud > /dev/null 2>&1; echo "old: $(systemctl --user is-active jarvis-cloud)"'
        n "echo MODE=$M > ~/jarvis/config; systemctl --user daemon-reload; systemctl --user enable jarvis-cloud > /dev/null 2>&1; systemctl --user restart jarvis-cloud; sleep 2; echo \"new: \$(systemctl --user is-active jarvis-cloud), mode $M\""
        mkdir -p "$PB/cloud-sync"; echo "$NEW" > "$PB/cloud-sync/vm.txt"
        echo "Switched. Next: bash traverse/ops/jarvis-cloud.sh signin   (Claude on the new machine), then jarvis-cloud.sh status.";;
  *) echo "check | prep | copy | switch  <new ip>"; exit 2;;
esac
