#!/bin/bash
# The cloud J.A.R.V.I.S. from the laptop (11 Nov 2026, rebuilt 19 Nov; TASKS X-15; JARVIS-CLOUD.md). Run in Git Bash (the VS Code terminal).
#   bash traverse/ops/jarvis-cloud.sh signin      Matthew: sign Claude Code on the VM in to your Claude plan (opens a link to paste back)
#   bash traverse/ops/jarvis-cloud.sh status      readiness on the VM + the service + the last log lines + the sync both ways
#   bash traverse/ops/jarvis-cloud.sh init        once per machine: php-cli + bsdtar, the bare repo, ~/workspace, npm ci (idempotent)
#   bash traverse/ops/jarvis-cloud.sh deploy      watcher, prompts, bin wrappers, tests and the service to the VM; the watcher is swapped in
#                                                 only if its guard test prints all PASS; then the service restarts
#   bash traverse/ops/jarvis-cloud.sh mode shadow|live|practice|off    set the mode and restart (live = it answers: Matthew's go only)
#   bash traverse/ops/jarvis-cloud.sh sync        send the repo and memory now (jarvis-cloud-sync.sh push)
#   bash traverse/ops/jarvis-cloud.sh test        the stand-in tests on the VM (no live server, no Claude, no real ticket)
#   bash traverse/ops/jarvis-cloud.sh shadow-report [hours]    what the cloud would have done vs what the laptop did (default 24 h)
#   bash traverse/ops/jarvis-cloud.sh meetings    20 Nov (P-12): the meeting transcriber only (meeting-worker.sh, meeting-assemble.cjs, the Silero
#                                                 voice model, jarvis-meetings.timer); the watcher, its service and the mode are left alone
#   bash traverse/ops/jarvis-cloud.sh stop|start|log|pubkey
# JARVIS_VM=yard@<ip> for another machine (the B2s move: jarvis-cloud-move.sh).
set -u
VM="${JARVIS_VM:-$(cat "$(cygpath -u "$LOCALAPPDATA" 2>/dev/null)/ProjectBackup/cloud-sync/vm.txt" 2>/dev/null || echo yard@20.91.198.101)}"   # vm.txt: written by jarvis-cloud-move.sh switch
VK="${JARVIS_VK:-$HOME/.ssh/azure_yard}"
OPS="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$OPS/../.." && pwd)"
v() { ssh -o BatchMode=yes -o ConnectTimeout=20 -i "$VK" "$VM" "$@"; }
up() { scp -q -o BatchMode=yes -i "$VK" "$@"; }
case "${1:-status}" in
  signin) echo "A link appears below. Open it, sign in with your Claude account (the plan, not the Console), and paste the code back here."
          ssh -t -i "$VK" "$VM" '~/.local/bin/claude auth login --claudeai && ~/.local/bin/claude auth status | grep -E "loggedIn|subscriptionType"; systemctl --user restart jarvis-cloud';;
  status) v 'bash ~/jarvis/ops/help-watch-cloud.sh --check; echo; tail -n 10 ~/jarvis/state/help-watch.log'; echo; echo "--- sync (laptop side)"; bash "$OPS/jarvis-cloud-sync.sh" status;;
  init)   v 'set -e
          need=""; command -v php > /dev/null || need="$need php-cli"; command -v bsdtar > /dev/null || need="$need libarchive-tools"
          [ -z "$need" ] || { sudo -n apt-get update -qq && sudo -n DEBIAN_FRONTEND=noninteractive apt-get install -y -qq $need > /dev/null && echo "installed:$need"; }
          mkdir -p ~/jarvis/bin ~/jarvis/incoming ~/jarvis/outbox/changes ~/jarvis/outbox/jobs ~/jarvis/outbox/merged ~/jarvis/state; chmod 700 ~/jarvis
          [ -d ~/jarvis/repo.git ] || { git init -q --bare ~/jarvis/repo.git && echo "bare repo made"; }
          git -C ~/jarvis/repo.git symbolic-ref HEAD refs/heads/main   # 20 Nov: it said master, so a fresh clone of it came out empty
          git -C ~/jarvis/repo.git rev-parse -q --verify main > /dev/null || { echo "the bare repo is empty: run  bash traverse/ops/jarvis-cloud.sh sync  on the laptop, then init again"; exit 0; }
          if [ ! -d ~/workspace/.git ]; then git clone -q ~/jarvis/repo.git ~/workspace && echo "workspace cloned"; fi
          cd ~/workspace && git config core.autocrlf false && git config user.name "Matthew Sharpe" && git config user.email "m.sharpe@surgeftw.com"
          git checkout -q -B cloud origin/main
          [ -f node_modules/.package-lock.json ] && [ node_modules/.package-lock.json -nt package-lock.json ] || { nice -n 10 npm ci --no-audit --no-fund --loglevel=error > /dev/null && echo "npm ci done"; }
          node -e "require(\"sharp\"); require(\"terser\"); require(\"csso\"); console.log(\"node modules: OK\")"
          echo "init: OK"';;
  deploy) up "$OPS/help-watch-cloud.sh" "$VM:jarvis/ops/help-watch-cloud.sh.new" &&
          v 'chmod 700 ~/jarvis/ops/help-watch-cloud.sh.new; bash -n ~/jarvis/ops/help-watch-cloud.sh.new && bash ~/jarvis/ops/help-watch-cloud.sh.new --guard-test | tail -1 | grep -q "all PASS" || { echo "guard test FAILED: the old watcher was left in place and running"; rm -f ~/jarvis/ops/help-watch-cloud.sh.new; exit 1; }; mv ~/jarvis/ops/help-watch-cloud.sh.new ~/jarvis/ops/help-watch-cloud.sh; mkdir -p ~/jarvis/bin ~/jarvis/ops/tests' &&
          up "$OPS/help-practice-prompt.md" "$OPS/jarvis-cloud-prompt.md" "$VM:jarvis/ops/" &&
          up "$OPS/tests/cloud-test.sh" "$VM:jarvis/ops/tests/" &&
          up "$OPS/cloud-bin/sg.sh" "$OPS/cloud-bin/laptop-job.sh" "$VM:jarvis/bin/" &&
          up "$OPS/jarvis-cloud.service" "$VM:.config/systemd/user/jarvis-cloud.service" &&
          v 'chmod 700 ~/jarvis/bin/*.sh; [ -f ~/jarvis/config ] || echo MODE=shadow > ~/jarvis/config; systemctl --user daemon-reload; systemctl --user enable jarvis-cloud >/dev/null 2>&1; systemctl --user restart jarvis-cloud; sleep 2; echo "service: $(systemctl --user is-active jarvis-cloud), mode $(bash ~/jarvis/ops/help-watch-cloud.sh --mode)"';;
  mode)   case "${2:-}" in shadow|live|practice|off) ;; *) echo "mode shadow|live|practice|off"; exit 2;; esac
          [ "$2" = live ] && [ "${3:-}" != --matthew-said-go ] && { echo "live = the cloud answers Jen, Brad, Houston and your desk, and may change and deploy the app while the laptop is away. Only on Matthew's go: add --matthew-said-go"; exit 2; }
          v "echo MODE=$2 > ~/jarvis/config; systemctl --user restart jarvis-cloud; sleep 2; echo \"mode: \$(bash ~/jarvis/ops/help-watch-cloud.sh --mode), service \$(systemctl --user is-active jarvis-cloud)\"";;
  sync)   bash "$OPS/jarvis-cloud-sync.sh" push && echo "sent (sync.log: \$LOCALAPPDATA/ProjectBackup/cloud-sync/sync.log)"; tail -n 3 "$(cygpath -u "$LOCALAPPDATA")/ProjectBackup/cloud-sync/sync.log";;
  test)   v 'bash ~/jarvis/ops/tests/cloud-test.sh';;
  shadow-report)
          H="${2:-24}"; S=$(( $(date +%s) - H * 3600 )); T=$(mktemp -d)
          v "cat ~/jarvis/state/shadow/shadow.tsv 2>/dev/null; echo '@@QUICK'; cd ~/jarvis/state/shadow 2>/dev/null && for f in h*.quick; do [ -f \"\$f\" ] && { echo \"@@F \$f\"; head -c 1500 \"\$f\"; echo; }; done" > "$T/cloud.txt" 2>/dev/null || { echo "VM not reachable"; exit 1; }
          L="$(cygpath -u "$LOCALAPPDATA")/ProjectBackup/help"
          node -e '
            const fs = require("fs"), [cf, lf, ld, since] = process.argv.slice(1), S = +since;
            const [tsv, quick = ""] = fs.readFileSync(cf, "utf8").split("@@QUICK");
            const cloud = tsv.split("\n").filter(Boolean).map(l => l.split("\t")).filter(r => +r[0] >= S);
            const t = s => new Date(s * 1000).toLocaleString("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
            const lap = []; for (const l of (fs.existsSync(lf) ? fs.readFileSync(lf, "utf8") : "").split("\n")) {
              const m = l.match(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) (?:(c-[a-z0-9-]+|practice) )?(h\d{14}[0-9a-f]{4}): session started/); if (!m) continue;
              const at = Math.floor(new Date(m[1].replace(" ", "T") + "-07:00").getTime() / 1000); if (at >= S) lap.push({ at, id: m[3], q: m[2] || "" }); }
            console.log("Shadow report, last " + Math.round((Date.now() / 1000 - S) / 3600) + " h. Cloud saw " + cloud.length + " ticket version(s); the laptop started " + lap.length + " session(s).\n");
            const used = new Set();
            for (const r of cloud) {
              const [at, q, id, n, who, what, how, wt] = r;
              const l = lap.find((x, i) => !used.has(i) && x.id === id && Math.abs(x.at - at) < 900);
              const i = lap.indexOf(l); if (i >= 0) used.add(i);
              console.log("- " + t(at) + "  " + q + " " + id + " msg " + n + " (" + who + "): cloud would run " + what + "; may change repo: " + (wt || "?") +
                "\n    laptop: " + (l ? "took it " + (l.at - at >= 0 ? "+" : "") + (l.at - at) + " s from when the cloud saw it" : "no session found within 15 min"));
              const qf = quick.split("@@F ").find(b => b.startsWith(id + "-" + n + ".quick"));
              if (qf) { const qtxt = qf.split("\n").slice(2).join(" ").slice(0, 300); let lq = ""; try { lq = fs.readFileSync(ld + "/" + id + ".quick", "utf8").replace(/\s+/g, " ").slice(0, 300); } catch (e) {}
                console.log("    cloud quick pass: " + qtxt + (lq ? "\n    laptop quick pass: " + lq : "")); }
            }
            const missed = lap.filter((x, i) => !used.has(i));
            if (missed.length) { console.log("\nLaptop sessions the cloud did not see:"); for (const x of missed) console.log("- " + t(x.at) + " " + (x.q || "staff/desk") + " " + x.id); }
          ' "$T/cloud.txt" "$L/help-watch.log" "$L" "$S"; rm -rf "$T";;
  meetings) T="$REPO/assistant/jarvis/tools"
          up "$T/meeting-worker.sh" "$VM:jarvis/ops/meeting-worker.sh.new" && up "$T/meeting-assemble.cjs" "$VM:jarvis/ops/meeting-assemble.cjs" &&
          up "$OPS/jarvis-meetings.service" "$OPS/jarvis-meetings.timer" "$VM:.config/systemd/user/" &&
          v 'set -e; bash -n ~/jarvis/ops/meeting-worker.sh.new; mv ~/jarvis/ops/meeting-worker.sh.new ~/jarvis/ops/meeting-worker.sh; chmod 700 ~/jarvis/ops/meeting-worker.sh
          M=~/jarvis/tools/whisper.cpp/models; [ -s $M/ggml-silero-v6.2.0.bin ] || { curl -fsSL -o $M/ggml-silero-v6.2.0.bin.tmp https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin && mv $M/ggml-silero-v6.2.0.bin.tmp $M/ggml-silero-v6.2.0.bin; }
          ls -la $M/ggml-silero-v6.2.0.bin | cut -c1-60
          systemctl --user daemon-reload; systemctl --user enable --now jarvis-meetings.timer > /dev/null 2>&1
          echo "meetings timer: $(systemctl --user is-active jarvis-meetings.timer); watcher service: $(systemctl --user is-active jarvis-cloud), mode $(bash ~/jarvis/ops/help-watch-cloud.sh --mode)"';;
  stop|start) v "systemctl --user $1 jarvis-cloud; systemctl --user is-active jarvis-cloud";;
  log) v 'tail -n 40 ~/jarvis/state/help-watch.log';;
  pubkey) v 'cat ~/jarvis/secrets/traverse_sg_cloud.pub';;
  *) echo "signin | status | init | deploy | meetings | mode <m> | sync | test | shadow-report [h] | stop | start | log | pubkey"; exit 2;;
esac
