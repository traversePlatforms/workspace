#!/bin/bash
# New-construction refresh, ON THIS LAPTOP (Matthew 15 Nov 2026: "Go ahead and schedule that"; no cloud machine after 22 Nov).
# EVERY-HOME-2026-11-15.md. Every quarter the Windows task "Traverse new homes refresh" (traverse/ops/refresh-new-homes.sh: 15 Feb, May,
# Aug, Nov at 02:00) names a run in every1115/refresh-run.txt; the Wi-Fi queue job everyq then runs this, which stops with exit 4 on the
# iPhone hotspot or with no internet (the queue tries again later) and picks up where it stopped:
#   1. a fresh read of the state parcel layer (pull-state-vm.mjs; ~2-3 h; resumable per county)
#   2. today's doors exported; the recount and lists (classify-vm.mjs, make-lists-vm.mjs): every home on the layer that is not a door
#      yet, so houses built or first recorded since the last run come in, with the 15 Nov rules (kinds, eo, the 10-acre rule)
#   3. the measuring (ehb-laptop.sh)
#   4. the finisher (finish-every-2026-11-15.sh, EH_LOCAL=1): build, STOP if any town of ours loses a door, upload the changed towns
# Run folder: every1115/runs/<run>/ (gitignored: the lists hold owner names). Log: logs-refresh-quarterly.log (the overnight check reads
# its last line and the Wi-Fi queue's status).
#   bash every1115/refresh-quarterly.sh [<run>]        (from door-territory)
set -u
cd "$(dirname "$0")/.." || exit 1
RUN=${1:-$(cat every1115/refresh-run.txt 2>/dev/null)}; [ -n "$RUN" ] || { echo "no run named"; exit 0; }
E="every1115/runs/$RUN"; mkdir -p "$E"; EM=$(cygpath -m "$(pwd)/$E" 2>/dev/null || echo "$(pwd)/$E")   # 23 Nov: no cygpath on the VM
st() { echo "$(date '+%F %T') $RUN: $*" | tee -a logs-refresh-quarterly.log; }
net() { case "$(netsh wlan show interfaces 2>/dev/null | tr -d '\r' | awk -F': ' '/^ *SSID/{print $2; exit}')" in *iPhone*|*iphone*) st "on the iPhone hotspot: waiting (exit 4)"; exit 4;; esac
        curl -s -m 20 -o /dev/null https://gis.colorado.gov/ || { st "no internet: waiting (exit 4)"; exit 4; }; }
done_() { [ -f "$E/$1.done" ]; }; mark() { touch "$E/$1.done"; }
if ! done_ pull; then net; st "reading the state parcel layer"
  node every1115/pull-state-vm.mjs "$EM/state" || { net; st "pull stopped: will resume"; exit 4; }
  [ "$(ls "$E"/state/*.done 2>/dev/null | wc -l)" -ge 43 ] || { st "pull incomplete: will resume"; exit 4; }; mark pull; fi
if ! done_ lists; then st "recount and lists"
  node --max-old-space-size=8192 gap1108/export-door-points.mjs "$EM/door-points.tsv" > /dev/null || { st "FAILED: door export"; exit 1; }
  node --max-old-space-size=14000 every1115/classify-vm.mjs "$EM/state" "$EM/door-points.tsv" "$EM/cls" --epc="$(cygpath -m "$(pwd)/assessor/raw/EPC Parcel Data.txt" 2>/dev/null || echo "$(pwd)/assessor/raw/EPC Parcel Data.txt")" --g3=group3/targets.json > "$E/classify.log" 2>&1 || { st "FAILED: classify (see $E/classify.log)"; exit 1; }
  rm -rf "$E/lists" && node --max-old-space-size=8192 every1115/make-lists-vm.mjs "$EM/cls" "$EM/lists" --g3=group3/targets.json > "$E/lists.log" 2>&1 || { st "FAILED: lists"; exit 1; }
  rm -f "$E/door-points.tsv"; st "$(tail -1 "$E/lists.log" | cut -c1-200)"; mark lists; fi
if ! done_ ehb; then st "measuring"; bash every1115/ehb-laptop.sh "$E" >> "$E/ehb.log" 2>&1; rc=$?
  [ $rc -eq 4 ] && { st "measuring paused for the network"; exit 4; }; [ -f "$E/ehb.done" ] || { st "FAILED: measuring (see $E/ehb.log)"; exit 1; }; fi
if ! done_ finish; then net; st "finisher (build, checks, upload)"
  EH_LOCAL=1 EH_DIR="$E" EH_RUN="$RUN" bash every1115/finish-every-2026-11-15.sh > "logs-finish-$RUN.log" 2>&1
  tail -1 "logs-finish-$RUN.log" | grep -q "done: commit" || { st "FAILED or STOPPED: $(tail -1 "logs-finish-$RUN.log" | cut -c1-160)"; exit 1; }
  mark finish; fi
st "done: $(grep -E 'towns whose door files changed|doors gained' "logs-finish-$RUN.log" | tr '\n' ' ' | cut -c1-200)"
