#!/bin/bash
# Resume after the Claude Code session ended at 14:00 on 2026-10-07 and took its background jobs with it. Every step picks up from
# its saved cache. The rest of stage one, then stage two (run-new-towns-2026-10-07-b.sh) and stage three
# (run-edition-towns-2026-10-07-c.sh). Started detached from Claude Code, so a session restart cannot stop it; progress goes to
# logs-2026-10-07/_resume.out.
set -u
cd "$(dirname "$0")"
L=logs-2026-10-07; mkdir -p "$L"
NEW="highlands-ranch parker castle-pines"
step() { local name=$1; shift; echo "$(date +%H:%M:%S) start $name"; ( "$@" ) > "$L/$name.log" 2>&1; echo "$(date +%H:%M:%S) end   $name (exit $?) $(tail -1 "$L/$name.log" | cut -c1-140)"; }
echo "$(date '+%Y-%m-%d %H:%M:%S') resume"
step lawn-compact-castle-pines bash -c "cd lawn-trial && node sample-lawn-compact.mjs --town=castle-pines --conc=6"
step buildings bash -c "cd tree-zones && node fetch-buildings.mjs"
for t in $NEW; do step "trees-$t" bash -c "cd tree-zones && node sample-trees.mjs --town=$t --conc=6"; done
step value node sample-value.mjs
step hoa node sample-hoa.mjs
step mail node build-mail-sidecar.mjs $NEW
step rounds node build-rounds-data.mjs
echo "$(date +%H:%M:%S) stage one done; stage two"
bash run-new-towns-2026-10-07-b.sh
echo "$(date +%H:%M:%S) stage two done; stage three"
bash run-edition-towns-2026-10-07-c.sh
echo "$(date +%H:%M:%S) ALL STAGES DONE"
