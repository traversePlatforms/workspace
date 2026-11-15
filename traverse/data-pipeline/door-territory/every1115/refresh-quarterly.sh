#!/bin/bash
# New-construction refresh (Matthew 15 Nov 2026, item E: "a recurring new-construction refresh"; EVERY-HOME-2026-11-15.md).
#   bash every1115/refresh-quarterly.sh            (from door-territory; Windows task "Traverse new homes refresh", 15 Feb / May / Aug / Nov)
# Every quarter: today's doors are exported and sent to the cloud machine, and three dated stages are added to its fill1031 queue:
#   eq<date>pull   a fresh read of the state parcel layer (pull-state-vm.mjs; ~1-1.5 h, the only job on gis.colorado.gov meanwhile)
#   eq<date>list   the same recount and lists as 15 Nov (classify-vm.mjs, make-lists-vm.mjs): every house, townhome, mobile home and
#                  building on the layer that is not a door yet, so houses built (or first recorded) since the last run come in
#   eq<date>meas   the measuring (ehb-vm.sh)
# and the laptop finisher (finish-every-2026-11-15.sh with EH_RUN=every-<date>) is left to the Wi-Fi queue job "everyq" (state file
# every1115/refresh-run.txt names the run). The finisher stops before any upload if a town of ours loses a door.
# ⚑ Needs the cloud machine: if it does not answer (it was due to stop 22 Nov 2026), this writes that in logs-refresh-quarterly.log and
#   exits 4 without doing anything; restarting the VM (or moving the stages to another machine) is Matthew's call.
# Fremont, Chaffee, Otero (terms), Cheyenne, Phillips, Moffat (permission) stay out, as in pull-state-vm.mjs.
set -u
cd "$(dirname "$0")/.." || exit 1
D=$(date +%Y%m%d); RUN="every-$D"; S="$(cygpath -u "$(cygpath -d "$LOCALAPPDATA")")/ProjectBackup/push-tmp/$RUN"; mkdir -p "$S"
VM="ssh -o ConnectTimeout=20 -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard yard@20.91.198.101"
step() { echo "$(date '+%F %T') $*"; }
case "$(netsh wlan show interfaces 2>/dev/null | grep -E '^\s+SSID' | head -1)" in *iPhone*) step "on the iPhone hotspot: not starting (exit 4)"; exit 4;; esac
$VM 'true' < /dev/null 2>/dev/null || { step "the cloud machine does not answer: refresh not started (restart it or move the stages; Matthew's call)"; exit 4; }
$VM "test -d ~/run/$RUN" < /dev/null && { step "run $RUN already set up"; exit 0; }
step "export today's doors"
node --max-old-space-size=8192 gap1108/export-door-points.mjs "$S/door-points.tsv" || exit 1
gzip -c "$S/door-points.tsv" > "$S/door-points.tsv.gz" && rm -f "$S/door-points.tsv"
$VM "mkdir -p ~/run/$RUN/state" < /dev/null && scp -q -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard "$S/door-points.tsv.gz" "yard@20.91.198.101:run/$RUN/" || exit 1
for f in every1115/pull-state-vm.mjs every1115/classify-vm.mjs every1115/make-lists-vm.mjs every1115/ehb-vm.sh; do scp -q -o BatchMode=yes -i /c/Users/SURGEI~1/.ssh/azure_yard "$f" yard@20.91.198.101:run/every1115/code/ || exit 1; done
$VM "RUN=$RUN; D=$D; "'set -e; cd ~/run/$RUN && gunzip -f door-points.tsv.gz; Q=~/run/fill1031
cat > $Q/eq${D}pull.sh <<EOS
#!/bin/bash
. "\$HOME/run/fill1031/lib.sh"; room; st "eq${D}pull: reading the state parcel layer"
cd ~/run/$RUN && nice -n 10 node ../every1115/code/pull-state-vm.mjs state || exit 1
EOS
cat > $Q/eq${D}list.sh <<EOS
#!/bin/bash
. "\$HOME/run/fill1031/lib.sh"; room; st "eq${D}list: recount and lists"
E=~/run/$RUN; cd \$E && [ "\$(ls state/*.done | wc -l)" -ge 43 ] || exit 1
nice -n 10 node --max-old-space-size=11000 ../every1115/code/classify-vm.mjs state door-points.tsv cls --epc=\$HOME/run/gap1108/epc-parcel-data.txt --g3=\$HOME/run/group3/targets.json || exit 1
rm -rf lists && nice -n 10 node --max-old-space-size=8000 ../every1115/code/make-lists-vm.mjs cls lists --g3=\$HOME/run/group3/targets.json
EOS
cat > $Q/eq${D}meas.sh <<EOS
#!/bin/bash
EH_ROOT=~/run/$RUN bash ~/run/every1115/code/ehb-vm.sh
EOS
printf "%s\n" "eq${D}pull  # quarterly new-construction refresh $RUN (every1115/refresh-quarterly.sh)" "eq${D}list  # quarterly refresh $RUN: recount + lists" "eq${D}meas  # quarterly refresh $RUN: measuring; laptop finisher via Wi-Fi queue job everyq" >> $Q/stages.txt' < /dev/null || exit 1
echo "$RUN" > every1115/refresh-run.txt
step "queued $RUN on the cloud machine (eq${D}pull, eq${D}list, eq${D}meas); the Wi-Fi queue job everyq finishes it"
# the Wi-Fi queue marks a job done for good on exit 0: clear the quarterly job's marks so it runs for this run
rm -f ../../ops/wifi-queue/state/everyq.done ../../ops/wifi-queue/state/everyq.fails ../../ops/wifi-queue/state/everyq.failed
