#!/bin/bash
# Off-site nightly backup of what exists ONLY on traverseplatforms.com, run on the cloud J.A.R.V.I.S. machine (Jarvis, 40.78.175.13)
# into Matthew's Azure storage (account jarvisbackup4821, private container server-backups). 22 Nov 2026, Matthew: "go ahead and
# set up the backup storage" (the Azure free 12-month storage; the laptop-only backup, pull-server-backup.sh, skips nights the laptop
# is off and has no second copy). The laptop backup keeps running too.
#
# Same file set as pull-server-backup.sh: *-private (accounts, sessions, sign-in codes, alert keys, photos), the app-written logs and
# folders in *-data (leads, customers, notes, the Peak desk...), settings the apps write whole. NEVER: assistant-private/data/finance
# (the bank link) and nothing of Matthew's pay (it is not on the server).
#
# Each night's archive is ENCRYPTED with age to a public key (~/backup/recipient.txt) before it leaves this machine. The only key that
# opens it is on the laptop (~/.ssh/jarvis-backup-age.key), not here and not in Azure. Restore: traverse/ops/SERVER-BACKUP-CLOUD.md.
# Keeps daily/ for 30 days and monthly/ (the 1st of the month) for 13 months. Log: ~/backup/backup.log (one line per run).
# Install on the VM as ~/backup/server-backup.sh; cron 15 9 * * * (2:15 am Colorado).
set -u -o pipefail
B="$HOME/backup"; LOG="$B/backup.log"; D=$(date -u +%Y-%m-%d)
export AZURE_STORAGE_ACCOUNT=jarvisbackup4821 AZURE_STORAGE_KEY="$(cat "$B/secrets/storage.key")" AZURE_CORE_ONLY_SHOW_ERRORS=1
C=server-backups; R=$(cat "$B/recipient.txt"); W=$(mktemp -d /dev/shm/bk.XXXXXX); trap 'rm -rf "$W"' EXIT
log() { echo "$(date -u '+%Y-%m-%d %H:%M')Z $*" >> "$LOG"; }
ok=0
for try in 1 2 3; do
  bash "$HOME/jarvis/bin/sg.sh" trav 'cd ~/www/traverseplatforms.com && { find *-private -type f -not -path "assistant-private/data/finance/*"; find *-data -type f \( -name "*.log" -o -path "*/leads/*" -o -path "*/customers/*" -o -path "*/digest/*" -o -path "*/backups/*" -o -path "*/photos/*" -o -path "*/avatars/*" -o -name "training.json" -o -name "goals*.json" -o -name "roof-settings.json" -o -name "company*.json" -o -name "push*.json" \) ! -name "*.lock"; } | tar czf - -T -' > "$W/a.tgz" 2> "$W/err"
  if [ -s "$W/a.tgz" ] && tar tzf "$W/a.tgz" > "$W/list" 2>/dev/null; then ok=1; break; fi
  sleep 120
done
[ $ok = 1 ] || { log "FAILED: no good archive from the server ($(tail -c 200 "$W/err" | tr '\n' ' '))"; exit 1; }
if grep -q "assistant-private/data/finance/" "$W/list"; then log "FAILED: the bank folder got into the archive; nothing uploaded"; exit 1; fi
N=$(wc -l < "$W/list"); S=$(du -h "$W/a.tgz" | cut -f1)
age -r "$R" -o "$W/a.tgz.age" "$W/a.tgz" || { log "FAILED: encrypting"; exit 1; }
rm -f "$W/a.tgz"
up() { az storage blob upload -c "$C" -n "$1" -f "$W/a.tgz.age" --overwrite --no-progress -o none; }
up "daily/traverse-server-$D.tgz.age" || { log "FAILED: upload to Azure"; exit 1; }
[ "$(date -u +%d)" = "01" ] && up "monthly/traverse-server-$D.tgz.age"
# keep 30 days of daily copies and 13 months of monthly ones
cut30=$(date -u -d '30 days ago' +%Y-%m-%d); cut13=$(date -u -d '13 months ago' +%Y-%m-%d)
az storage blob list -c "$C" --prefix daily/ --query "[].name" -o tsv | while read -r n; do d=${n#daily/traverse-server-}; d=${d%%.*}; [[ "$d" < "$cut30" ]] && az storage blob delete -c "$C" -n "$n" -o none; done
az storage blob list -c "$C" --prefix monthly/ --query "[].name" -o tsv | while read -r n; do d=${n#monthly/traverse-server-}; d=${d%%.*}; [[ "$d" < "$cut13" ]] && az storage blob delete -c "$C" -n "$n" -o none; done
T=$(az storage blob list -c "$C" --query "length([])" -o tsv)
log "ok $N files, $S, encrypted and uploaded as daily/traverse-server-$D.tgz.age ($T copies in Azure)"
