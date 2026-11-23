# Off-site server backup (cloud machine → Azure storage)

Set up 22 Nov 2026 (Matthew: "go ahead and set up the backup storage"). A second, off-site copy of everything that exists only on
traverseplatforms.com, on top of the laptop's nightly `pull-server-backup.sh`.

| | |
|---|---|
| Runs on | the cloud J.A.R.V.I.S. machine `Jarvis` (yard@40.78.175.13), `~/backup/server-backup.sh` = `traverse/ops/cloud-server-backup.sh` |
| When | cron `15 9 * * *` UTC = 2:15 am Colorado, every night |
| What | the same files as the laptop backup: `*-private` (except `assistant-private/data/finance`, the bank link), the app-written logs and folders in `*-data`, settings the apps write whole. About 30 MB a night |
| Where | Azure storage account `jarvisbackup4821` (Central US, LRS, Azure subscription 1, resource group yard-v2), private container `server-backups`: `daily/` 30 days, `monthly/` (the 1st) 13 months |
| Encrypted | with age, to the public key in `~/backup/recipient.txt` on the VM. **The only key that opens a backup is on the laptop: `~/.ssh/jarvis-backup-age.key`** (and wherever Matthew keeps his second copy). Not on the VM, not in Azure |
| Storage key | `~/backup/secrets/storage.key` on the VM (0600); the laptop's copy is `~/.ssh/azure-backup-storage-key.txt`. Never printed |
| Cost | Azure's free 12 months (5 GB Blob); after that, pennies a month |
| Watched by | the laptop's overnight check (2c): a problem if the last run isn't "ok" or is over 30 hours old; it turns the J.A.R.V.I.S. globe red |
| Log | `~/backup/backup.log` on the VM, one line per night |

Verified 22 Nov: the first backup (4,690 files, 32 MB) was downloaded from Azure and decrypted with the laptop key, and all 4,690 files listed.

## Restore (a day's backup, to look at or to put back)

On the cloud machine, with the key piped from the laptop so it never sits on the VM:

```
ssh -i ~/.ssh/azure_yard yard@40.78.175.13 'export AZURE_STORAGE_ACCOUNT=jarvisbackup4821 AZURE_STORAGE_KEY="$(cat ~/backup/secrets/storage.key)";
  az storage blob list -c server-backups --query "[].name" -o tsv'                                  # which days there are
ssh -i ~/.ssh/azure_yard yard@40.78.175.13 'export AZURE_STORAGE_ACCOUNT=jarvisbackup4821 AZURE_STORAGE_KEY="$(cat ~/backup/secrets/storage.key)";
  W=$(mktemp -d /dev/shm/rs.XXXX); az storage blob download -c server-backups -n daily/traverse-server-<YYYY-MM-DD>.tgz.age -f $W/x.age --no-progress -o none;
  age -d -i /dev/stdin $W/x.age; rm -rf $W' < ~/.ssh/jarvis-backup-age.key > restore-<YYYY-MM-DD>.tgz
```

That leaves a normal `.tgz` on the laptop (outside the repo: it holds sign-in data). Putting files back on the server follows the
usual deploy rule: back up the live file first, one file at a time, never a blind untar over `~/www`.

If the cloud machine is gone: any Linux machine with `az` and `age` works the same way, using the laptop's storage key and age key.
If the laptop is gone: the age key must come from Matthew's second copy. Without the age key the backups cannot be opened by anyone.
