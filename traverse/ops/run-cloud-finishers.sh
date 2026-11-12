#!/bin/bash
# The cloud machine's finishing steps, run unattended (2026-10-26): the VM chains roofs/solar -> Group 1 stage A -> stage B -> roof
# material by itself, but each stage's results are copied back, built and uploaded from this laptop. The overnight check calls this
# every 30 minutes; each finisher checks its own stage is done (and refuses otherwise), runs once in the background, and is marked done
# only when it exits 0. At most 3 tries per stage, so a failing upload doesn't repeat all night. Prints one line.
set -u
DT="/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory"
ST="$LOCALAPPDATA/ProjectBackup/cloud-finish"; mkdir -p "$ST"
[ -f "$ST/running.lock" ] && kill -0 "$(cat "$ST/running.lock" 2>/dev/null)" 2>/dev/null && { echo "cloud finish: $(cat "$ST/running.name" 2>/dev/null) still running"; exit 0; }
rm -f "$ST/running.lock"
# g1fix (2026-10-28): the Group 1 re-clip's measuring of the doors the old 20 m rule had dropped (group1/fix-measure-vm.sh); its VM
# script also leaves ~/run/group1/g1fix.vmdone, so a later job overwriting the status line cannot hide it.
# g2b (2026-10-28): Group 2 stage B (group2/stageb-vm.sh, which waits for g1fix's VM work first); it leaves ~/run/group2/g2b.vmdone.
# photos (2026-10-28): the close-up roof photos for the towns whose roof material step was skipped (group2/photos-backfill-vm.sh, after
# g2b's VM work); it leaves ~/run/group2/photos.vmdone.
# g3hail (2026-10-29, Matthew: "run the storm history ... when group 3 is done"): storm history for the Group 3 towns
# (finish-g3hail-2026-10-29.sh). Ready when g3b is done here (not a VM flag: it stages the door points and starts its own cloud job).
# hailhours (2026-10-29, Matthew: "run it on the cloud computer once it is free"): when the hail fell, for every hail town and every day
# (finish-hailhours-2026-10-29.sh, hail/rebuild-hail-hours.mjs on the cloud machine). Ready when g3hail is done here, so the Group 3 towns' hail
# files are in its plan and the cloud machine is free; it starts its own cloud job, like g3hail.
# Every stage, g3hail and hailhours too, is behind the hotspot check below and the one running.lock: never two at once.
# A stage that failed 3 times is reported and skipped, so a later stage still runs (2026-10-28: g1fix and g2b push different towns).
FAILED=""
# never pull a stage back over the phone hotspot (2026-10-29: Group 3 copies back gigabytes; memory: SSID "iPhone" = no heavy downloads)
if netsh wlan show interfaces 2>/dev/null | tr -d "" | grep -qE "^ +SSID +: iPhone$"; then echo "cloud finish: on the phone hotspot, waiting for Wi-Fi"; exit 0; fi
# g2mat, centlawn, commercial (2026-10-31 overnight queue, traverse/data-pipeline/door-territory/overnight/queue-1031-vm.sh on the VM as
# ~/run/ovn1031/queue.sh): Larimer roof material to Roofing + Solar; Centennial's no-lot doors measured again with yard v2 (Sixfold +
# editions); the internal commercial building list (never uploaded). Each is ready only when ~/run/ovn1031/<stage>.vmdone exists.
# lawnfix, roofsolar, dougmat, newlidar, trees2, outlinefix, values (2026-10-31 day queue, Matthew: "Find more work for the cloud machine";
# traverse/data-pipeline/door-territory/overnight/fill1031/ on the VM as ~/run/fill1031/, from coverage-audit-2026-10-31.md): yard v2 lawn
# fixes; roofs + sun for never-measured doors; Douglas roof material; roofs, sun and laser trees on newly found surveys; trees for
# never-measured doors; home values for Groups 1 and 3; hail2min (1 Nov): the hail hours from every 2-minute radar file. Each is ready only when ~/run/fill1031/<stage>.vmdone exists; every finisher is
# finish-<stage>-2026-10-31.sh -> fill1031-finish.sh <stage>.
# A fill1031 stage the VM gave up on (~/run/fill1031/<stage>.failed, no .vmdone) is counted as failed here, so the later ones still run.
# yardv3 (11 Nov, Matthew "go ahead and run ... 3"): every yard v2 door re-measured with the retuned lawn settings (CLOUD-JOBS-2026-11-11.md);
# finish-yardv3-2026-11-11.sh checks, merges, builds and uploads every town to Sixfold and the five editions.
for name in layers group1 material g1fix g2b photos g3b g3hail hailhours g2mat centlawn commercial lawnfix roofsolar dougmat newlidar trees2 outlinefix values hail2min hail1023 yardv3; do
  [ -f "$ST/$name.done" ] && continue
  tries=$(cat "$ST/$name.tries" 2>/dev/null || echo 0)
  [ "$tries" -ge 3 ] && { FAILED="$FAILED $name"; continue; }
  case $name in
    layers) VMQ='layers: every town done|group1:';;
    group1) VMQ='measuring done|material';;
    material) VMQ='material done';;
    g1fix) VMQ='group1 fix: measuring done';;
    g2b) VMQ='group2 B: measuring done';;
    photos) VMQ='photos backfill: done';;
    g3b) VMQ='group3 B: measuring done';;   # Group 3 stage B (Matthew 29 Oct: "add the group 3"); finish-g3b-2026-10-29.sh
    g3hail) VMQ='';;   # storm history for the Group 3 towns (Matthew 29 Oct); finish-g3hail-2026-10-29.sh starts its own cloud job, so it waits for g3b here, not for the VM
    hailhours) VMQ='';;   # the hail hours for every town and day (Matthew 29 Oct); finish-hailhours-2026-10-29.sh starts its own cloud job, after g3hail here
    g2mat|centlawn|commercial) VMQ='^NEVER-MATCHES$';;   # the VM's .vmdone file only (below); finish-<stage>-2026-10-31.sh
    lawnfix|roofsolar|dougmat|newlidar|trees2|outlinefix|values|hail2min|hail1023|yardv3) VMQ='^NEVER-MATCHES$'   # ~/run/fill1031/<stage>.vmdone only (below)
      # yardv3 (12 Nov): its repair stage yardv3fix (lost readings, run after it on the VM) decides; yardv3 failing alone is not final
      VF=$name; [ $name = yardv3 ] && VF=yardv3fix
      if ssh -o ConnectTimeout=15 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101 "test -f ~/run/fill1031/$VF.failed && ! test -f ~/run/fill1031/$VF.vmdone" < /dev/null 2>/dev/null; then
        echo 3 > "$ST/$name.tries"; FAILED="$FAILED $name(cloud)"; continue
      fi;;
  esac
  if [ "$name" = g3hail ]; then
    [ -f "$ST/g3b.done" ] || { echo "cloud finish: waiting for g3hail (after g3b)${FAILED:+ (FAILED 3 times:$FAILED, see $DT/logs-finish-<stage>.log)}"; exit 0; }
  elif [ "$name" = yardv3 ]; then
    # 12 Nov: ready only when the VM repair stage yardv3fix is done too (the damaged towns re-run, yard-v3 tarred again)
    ssh -o ConnectTimeout=15 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101 "test -f ~/run/fill1031/yardv3fix.vmdone" < /dev/null 2>/dev/null || { echo "cloud finish: waiting for yardv3 (repair stage yardv3fix on the VM)${FAILED:+ (FAILED 3 times:$FAILED, see $DT/logs-finish-<stage>.log)}"; exit 0; }
  elif [ "$name" = hailhours ]; then
    [ -f "$ST/g3hail.done" ] || { echo "cloud finish: waiting for hailhours (after g3hail)${FAILED:+ (FAILED 3 times:$FAILED, see $DT/logs-finish-<stage>.log)}"; exit 0; }
  else
    ssh -o ConnectTimeout=15 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101 "grep -qE '$VMQ' ~/run-status.txt || test -f ~/run/group1/$name.vmdone || test -f ~/run/group2/$name.vmdone || test -f ~/run/ovn1031/$name.vmdone || test -f ~/run/fill1031/$name.vmdone || { [ $name = g3b ] && test -f ~/run/group3/g3stageb.vmdone; }" < /dev/null 2>/dev/null || { echo "cloud finish: waiting for $name${FAILED:+ (FAILED 3 times:$FAILED, see $DT/logs-finish-<stage>.log)}"; exit 0; }
  fi
  echo $((tries + 1)) > "$ST/$name.tries"
  (
    cd "$DT" && bash "$(ls finish-$name-2026-*.sh | head -1)" > "logs-finish-$name.log" 2>&1 && touch "$ST/$name.done"
    rm -f "$ST/running.lock" "$ST/running.name"
  ) &
  echo $! > "$ST/running.lock"; echo "$name" > "$ST/running.name"
  echo "cloud finish: started $name (try $((tries + 1)))"; exit 0
done
[ -n "$FAILED" ] && { echo "cloud finish: FAILED 3 times:$FAILED, see $DT/logs-finish-<stage>.log"; exit 0; }
echo "cloud finish: every stage uploaded"
