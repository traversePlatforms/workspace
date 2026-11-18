#!/bin/bash
# Stage hailwind (fill1031, added 18 Nov 2026): the last step of stage hailnew, again. hailnew's run (16:43Z 18 Nov) built the radar hail
# per door and the ground reports for 1,882,990 doors, then wind/build-wind.mjs ran out of its 8 GB heap (it holds every town's lists until
# the keep rule is applied; 1.24 million doors fitted on 29 Oct). This runs only that step with a 12 GB heap (the machine has 16 GB; queued
# after matnew so the two never share it), then finishes as hail-backfill-vm.sh does: the town files into out/, result.tgz, hailfill.vmdone,
# and marks hailnew done with its tag (its .failed kept in vm-backup) so every1115/finish-hailnew-2026-11-18.sh picks it up.
. "$HOME/run/fill1031/lib.sh"
H="$HOME/run/hailfill"; cd "$H" || exit 1
TAG=$(cat hailnew-in/tag.txt 2>/dev/null)
[ -n "$TAG" ] && [ -s out/hail-storms-backfill.json ] && [ -s out/coverage.tsv ] && ls stormstage/hailrep-*.json > /dev/null 2>&1 || { st "hailwind: hailnew's hail and ground-report files are not there"; exit 1; }
room
export ROUNDS_DATA="$H/stormstage" HAIL_DAYS="$H/days" HAIL_BOX="36.95,41.05,-109.1,-102.0"
echo "$(date -u +%FT%TZ) hail backfill: wind (hailwind, 12 GB heap)" | tee "$HOME/run-hailfill-status.txt"
st "hailwind: wind for $(ls stormstage/*.json | grep -vcE '/(index|hail-reports)\.json$|/hailrep-') towns, 12 GB heap"
(cd wind && nice -n 10 node --max-old-space-size=12288 build-wind.mjs all) >> "$HOME/run-hailfill.log" 2>&1 || { st "hailwind: wind failed again (see ~/run-hailfill.log)"; exit 1; }
mv stormstage/hailrep-*.json stormstage/hail-reports.json stormstage/wind-*.json out/ || exit 1
(cd out && tar czf "$H/result.tgz" hail-*.json hailrep-*.json wind-*.json coverage.tsv) || exit 1
touch "$H/hailfill.vmdone"; echo "$TAG" > "$H/hailnew.tag"
echo "$(date -u +%FT%TZ) hail backfill: done: ~/run/hailfill/result.tgz (hailnew + hailwind)" | tee "$HOME/run-hailfill-status.txt"
[ -f "$Q/hailnew.failed" ] && mv "$Q/hailnew.failed" "$B/hailnew/hailnew.failed.wind-oom"
touch "$Q/hailnew.vmdone"
st "hailwind: done; hailnew marked done (laptop: every1115/finish-hailnew-2026-11-18.sh)"
