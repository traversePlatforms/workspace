#!/bin/bash
# The cloud machine's overnight queue, 31 Oct 2026 (Matthew asleep; queue set by the session that night). Copy on the VM:
# ~/run/ovn1031/queue.sh, started with  nohup bash ~/run/ovn1031/queue.sh > ~/run-ovn1031.log 2>&1 &
# One job after another, in priority order; each leaves ~/run/ovn1031/<job>.vmdone, which the laptop's overnight check sees
# (traverse/ops/run-cloud-finishers.sh stages g2mat, centlawn, commercial) and then runs that stage's finisher. Resumable: a job with
# its .vmdone is skipped; a job that fails is noted (<job>.failed) and the queue moves on to the next one.
#   g2mat      roof material for the Larimer towns (Group 2 + Berthoud's Larimer side): the year files built on the laptop from the
#              Larimer assessor's improvement table (roof cover, year built; no owner fields) are already in app/data/rounds here.
#              Per town: NAIP 2023 crops (Planetary Computer, not gis.colorado.gov), features, predict (county record where Larimer
#              has one, the photo model's call elsewhere at the usual 90% bar), crops deleted. Mesa: no roof cover published, no laser
#              roof file, so nothing to run. Pueblo: no bulk source.
#   centlawn   yard v2 again for the 8,880 Centennial doors that read "no lot" (their lot cells were saved on the old grid origin;
#              yard-v2-town.mjs since e8cf845 starts the cells again). gis.colorado.gov: the only parcel job running.
#   commercial the internal commercial building list (commercial/pull-statewide.mjs): gis.colorado.gov again, so after centlawn.
set -u
Q="$HOME/run/ovn1031"; T="$HOME/run/tv/traverse"; DT="$T/data-pipeline/door-territory"; M="$DT/roofs/material"; LT="$HOME/run/lawn-trial"
PY="$HOME/pyenv/bin/python"
st() { echo "$(date -u +%FT%TZ) ovn1031: $*" | tee "$HOME/run-status.txt"; }
room() { [ "$(df -k --output=avail / | tail -1)" -ge 5242880 ] || { st "STOPPED, under 5 GB free"; exit 1; }; }
tries() { local name=$1; shift; for t in 1 2 3; do room; "$@" && return 0; echo "$(date -u +%T) $name failed (try $t)"; sleep 60; done; return 1; }

## g2mat
if [ ! -f "$Q/g2mat.vmdone" ]; then
  st "g2mat: roof material for the Larimer towns"
  ok=1
  for town in $(cat "$Q/g2mat-towns.txt"); do
    [ -f "$Q/g2mat-$town.done" ] && continue
    st "g2mat: $town"
    if [ "$town" = g1-berthoud ]; then   # features table already made (26 Oct); only the county and year columns are re-filled
      (cd "$M" && "$PY" features.py --struct "$town" && "$PY" predict.py "$town") && touch "$Q/g2mat-$town.done" || { echo "g2mat: $town failed"; ok=0; }
      continue
    fi
    [ -f "$M/cache/houses-$town.json" ] || tries "houses $town" bash -c "cd '$M' && node houses.mjs --town='$town'" || { ok=0; continue; }
    tries "crops $town" bash -c "cd '$M' && node fetch.mjs --town='$town' --conc=12" || { ok=0; continue; }
    (cd "$M" && "$PY" features.py "$town" && "$PY" predict.py "$town") && { rm -rf "${M:?}/cache/crops/${town:?}"; touch "$Q/g2mat-$town.done"; } || { echo "g2mat: $town failed"; ok=0; }
  done
  if [ $ok = 1 ]; then touch "$Q/g2mat.vmdone"; st "g2mat: done"; else touch "$Q/g2mat.failed"; st "g2mat: FAILED for some towns (see ~/run-ovn1031.log); moving on"; fi
fi

## centlawn
if [ ! -f "$Q/centlawn.vmdone" ]; then
  st "centlawn: yard v2 for Centennial's no-lot doors"
  Y="$LT/yard-v2/centennial.json"
  [ -f "$Q/centennial.before.json" ] || cp "$Y" "$Q/centennial.before.json"
  if [ ! -f "$Q/centlawn.cleared" ]; then
    node -e "const fs=require('fs'),f=process.argv[1],y=JSON.parse(fs.readFileSync(f));let n=0;for(const [k,v] of Object.entries(y.doors))if(v===null){delete y.doors[k];n++}fs.writeFileSync(f+'.tmp',JSON.stringify(y));fs.renameSync(f+'.tmp',f);console.log('cleared',n,'no-lot doors')" "$Y" && touch "$Q/centlawn.cleared"
  fi
  rc=1
  for t in $(seq 1 30); do
    room; (cd "$LT" && YV2_DATA="$LT/data" node yard-v2-town.mjs --town=centennial --mins=60 --conc=16); rc=$?
    [ $rc -eq 0 ] && break; [ $rc -eq 3 ] || sleep 60
  done
  if [ $rc -eq 0 ] || [ $rc -eq 3 ]; then   # 3 after 30 slices = a few doors that keep failing: the rest still goes up
    [ $rc -eq 3 ] && echo "centlawn: some doors still failing after 30 slices (left out)"
    node -e "const y=require(process.argv[1]).doors;const v=Object.values(y);console.log('centennial now:',v.length,'doors,',v.filter(x=>x&&x.lot).length,'with a lot,',v.filter(x=>x===null).length,'no lot')" "$Y"
    touch "$Q/centlawn.vmdone"; st "centlawn: done"
  else touch "$Q/centlawn.failed"; st "centlawn: FAILED (rc $rc); moving on"; fi
fi

## commercial
if [ ! -f "$Q/commercial.vmdone" ]; then
  st "commercial: building list"
  if tries "commercial" node "$Q/pull-statewide.mjs" "$Q/commercial-out"; then touch "$Q/commercial.vmdone"; st "commercial: done"
  else touch "$Q/commercial.failed"; st "commercial: FAILED; moving on"; fi
fi
st "queue done: the laptop finishes each stage (run-cloud-finishers.sh)"
