# The cloud machine as the main workspace (TASKS X-15, target design 1)

Matthew, 22 Nov 2026 (~6:15 pm MT): make the cloud J.A.R.V.I.S. machine (`Jarvis`, `yard@40.78.175.13`) the main workspace. VS Code on
the laptop connects to it with Remote-SSH, Claude Code runs there, and work carries on through laptop sleep and the hotel Wi-Fi drops.
His answers: **door data and customer files may live on the cloud machine; Surge's restricted Tier 1 notes stay laptop-only; start now,
data upload overnight.**

## Where it stands (22 Nov, night)

| | |
|---|---|
| Prep | **done**: `~/main` on the VM is a standby copy, with memory, settings, hooks, the sync timer and the VM's own CLAUDE.md. Code build there: 77 s. `deploy-app.sh --check` from `~/main`: 0 of 74 files differ from live. |
| Flip | **not run.** That's Matthew's call: one command, below. Until it runs, the laptop is still the main workspace and nothing about how it works has changed. |
| Watcher | the new watcher is live (mode live, write mode `laptop`, same behaviour as before). Cloud tests: **60/60** (42 old + 18 new for the VM mode and `vm-main-sync.sh`). |
| Data | Wi-Fi queue job `vmdata` running: 10.0 GB in 71 chunks (21,701 files), each md5-checked. See "Data". |

## Connect (VS Code on the laptop)

1. **Ctrl+Shift+P**, type `Remote-SSH: Connect to Host`, press Enter, and pick **jarvis-cloud**. A new window opens, and the bottom-left
   corner says `SSH: jarvis-cloud`. The first time, it installs its server on the VM, which takes about a minute.
2. **File > Open Folder...**, type `/home/yard/main`, then **OK**. If it asks whether you trust the authors, say **Yes**.
3. **Terminal > New Terminal** opens a terminal on the VM. Claude Code there is `claude` (it's already signed in to your plan). The
   Claude Code extension also works in that window (VS Code installs it on the remote side when asked).

Before the flip, that window is for looking around. Commits and deploys are refused there, with a message that says why.

## The flip (Matthew's moment)

From the **laptop**, in Git Bash (the laptop's own VS Code terminal), with no laptop session in the middle of a commit:

    bash traverse/ops/vm-main.sh flip --matthew-said-go

What it does, in order (it stops with a plain message, and changes nothing more, at the first problem):

1. Checks: the laptop has no uncommitted changes to tracked files (if it lists some, commit them first, or they stay on the laptop only),
   no git operation is in progress, and `~/main` is a clean standby copy.
2. Brings every cloud commit onto the laptop (`jarvis-cloud-sync.sh pull`), then sends the laptop's history to the VM one last time, and
   checks the VM's copy is exactly the laptop's newest (through the commit map).
3. The VM: `~/main` becomes the main copy (`git config jarvis.role main`). `~/jarvis/repo.git` refuses force-pushes and branch deletes
   from now on. `~/jarvis/config` gets `WRITE=vm`, the watcher restarts, and `~/workspace`'s memory folder becomes a link to `~/main`'s.
4. The laptop: the laptop's own history stays in its `.git` as `refs/before-vm/main`, with the Tier 1 history inside it. The repo now
   follows the VM (`git remote vm`, branch main tracks `vm/main`). Surge's restricted folders stay where they are as untracked files,
   excluded from git. A pre-commit hook refuses laptop commits, and `ProjectBackup/cloud-sync/vm-main` marks the flip.

Afterwards: `bash traverse/ops/vm-main.sh status` (both sides), `bash traverse/ops/jarvis-cloud.sh status`, then open `~/main` in VS Code.

## Rollback

    bash traverse/ops/vm-main.sh rollback --matthew-said-go

It runs a last client cycle (the VM's newest memory and commits come to the laptop) and stops `~/main` committing. It then replays the
VM's commits made since the flip onto the laptop's own history (`git rebase --onto refs/before-vm/main <flip point>`). Surge's
restricted notes are copied aside first and put back after, so edits made to them since the flip survive. It removes the laptop hook and
excludes, puts the VM back to standby (`WRITE=` removed, force-push allowed again for the laptop's mirror, the memory link undone, the
watcher restarted), and sends the laptop's history to the VM as before. If the replay hits a clash, it stops and says where.

## How it works after the flip

**One history.** `~/jarvis/repo.git` (branch `main`) on the VM is the truth, and three copies work against it:

| Copy | Who | How it gets there |
|---|---|---|
| `~/main` | Matthew's own sessions (VS Code Remote-SSH) | commits normally. The post-commit hook and a 2-minute timer (`jarvis-main-sync.timer`) run `traverse/ops/vm-main-sync.sh`, which pushes its commits and brings in the watcher's: a fast-forward, or a merge commit only when git's dry run shows no clash. It never rebases, stashes or touches uncommitted work. If a file it would change is mid-edit, it waits for the next run. |
| `~/workspace` | the cloud J.A.R.V.I.S. watcher | each session starts from the newest history. After the session, notes and `TASKS.md` it left are committed for it, its commits are rebased onto the newest history and pushed (retried if `~/main` pushed in between). Code it left uncommitted goes to `~/jarvis/outbox/review/` with an alert. |
| the laptop | Windows-only jobs, and Surge drafting | pulls only. `jarvis-cloud-sync.sh cycle` (every 2 minutes from `help-watch.sh`) fast-forwards from `vm/main` and never commits. |

Two writers never share one working copy: the watcher has `~/workspace` and Matthew has `~/main`. The watcher's own lock
(`~/jarvis/state/watch.lock`) still keeps it to one session at a time.

**Write turn.** With `WRITE=vm` the watcher always holds it (no more "the laptop is on"), so Jen's app changes are done end to end at any
hour. `laptop-job.sh` still exists for work only the laptop can do.

**Stuck.** If the watcher's commits clash with a newer `~/main` change, they're kept as a `stuck-*` branch in `~/workspace`,
`~/jarvis/state/stuck` stops further repo changes, and Matthew gets one alert. To fix it, a session in `~/main` runs `git fetch ~/workspace
stuck-<time>`, cherry-picks the commits and sorts out the clash, then runs `rm ~/jarvis/state/stuck`. If `vm-main-sync.sh` stops on a clash
instead, it says so in `~/jarvis/state/main-sync.log` and sends one alert. The fix is `git merge origin/main` in `~/main`, then sorting it out.

**Deploys.** Run from `~/main` as on the laptop: build, commit, then deploy. The scripts find the repo and the VM's server wrapper
(`~/jarvis/bin/sg.sh`, the Traverse account) by themselves. `cloud-guard.sh` still keeps the two deployers in order. A `~/main` deploy is
refused while the watcher has deployed commits that `~/main` hasn't merged yet. The fix is `bash traverse/ops/vm-main-sync.sh`, which the
timer does anyway. The watcher accepts `~/main`'s deploy record by its own commit ids.

**Memory.** It's one folder, `~/.claude/projects/-home-yard-main/memory/`, and Claude Code in `~/main` loads it by itself. The watcher
uses the same folder (`~/workspace`'s is a link to it). The laptop's memory folder becomes a synced copy. Each cycle, notes changed on
the laptop go up first and are merged line by line on the VM, then the VM's copy comes down, but only when it has changed (a signature
check, so there's no 600 KB download every 2 minutes). The two notes kept back (`matthew-pay-review.md`, `story-tier1-restricted.md`)
never leave the laptop. The VM's `MEMORY.md` leaves out their two index lines, which summarise them, and the laptop puts those lines back
into its own copy.

**Settings.** `~/main/.claude/settings.local.json` has the laptop's rules, minus the 9 Windows-only ones (PowerShell, `chrome.exe`,
`7z.exe`). The server wrapper's path is mapped to `/home/yard/jarvis/bin/sg.sh`. No rule was added or widened.

**The globe ring.** `jarvis-status.sh build ...` works in `~/main`. The VM keeps its own builds list, and a push from either side
replaces only its own builds in the server's `status.json` (VM builds carry `src: "vm"`). Beats and the overnight report are still the
laptop's. "Waiting on you" moves to the VM at the flip, because `assistant/jarvis/waiting.json` is in the history.

**GitHub.** It's unchanged and still runs from the laptop (`github-sync.sh` in the 5 pm Drive backup). The laptop's copy is the VM's
history, which is already filtered the same way, so the GitHub pushes stay fast-forwards.

## Surge and the Tier 1 notes

- `surge/brand/notes/` (RESTRICTED.md and the Tier 1 notes) and `surge/brand/photos/restricted-boards-DO-NOT-PUBLISH/` are **never on
  the VM**. They're not in its files or its history (`prep` checks both), the hooks in `~/main` and `~/workspace` refuse them, and the
  data upload refuses anything under `surge/`.
- `CLAUDE.md` (root) now says that **if RESTRICTED.md is missing, no Surge copy is drafted**: the session says it needs the laptop
  workspace or Matthew, and stops. The VM's own `~/.claude/CLAUDE.md` says the same, plus the VM's other rules.
- On the laptop they stay **in place** after the flip (no move, so every link and habit still works). They become untracked and excluded
  from git there. The Drive backup (`Backup-ToGoogleDrive.ps1`) now archives `surge/brand/notes` as files, because the git bundle no longer
  holds them after the flip. The restricted photo boards are in its weekly media mirror, as before.

## What stays on the laptop

| Job | After the flip |
|---|---|
| `help-watch.sh` (Sixfold Help watcher task): heartbeat, Hey Jarvis wake word, paystub watcher, cloud jobs | runs as now. It stands back while the cloud is live, its 2-minute cycle is the client cycle above, and it runs jobs the VM queues for the laptop. Those sessions can't commit (hook). |
| Overnight check | runs as now (reads laptop state, pushes the laptop's status, keeps the VM's builds) |
| Drive backup + GitHub sync (5 pm, weekly archive) | runs as now. It now also archives `surge/brand/notes`. The laptop's copy of the repo and memory is the VM's, so the VM's work is backed up there too. The VM also has its own nightly off-site server backup (`~/backup`, untouched). |
| Wi-Fi queue, Traverse permit / weekly / new-homes refresh, server backup pull | run as now, on the laptop's data copy (see "Data": the laptop stays the master for door data until those jobs move). |
| Post calendar requests, Drag guard | unchanged |
| Sixfold's site (`six`), Surge, 365 Aeration, Desktop files, Drive letters | the laptop's (no keys for those accounts on the VM) |

## Data

The `vmdata` Wi-Fi queue job (`traverse/ops/wifi-queue/jobs/vmdata.sh`) sends only files git ignores under traverse, sixfold, matthew,
assistant and shared, into the same paths in `~/main`. It sends nothing the VM can rebuild or fetch itself:

- **Sent (10.0 GB before compression, 21,701 files):**
  - `traverse/app/data` (the door data, 3.6 GB)
  - door-territory working data: metros 1.6, lawn-trial 1.2, owner history, value / tree / wildfire / lawn / solar caches, roofs'
    roof-cache, commercial, about 1.6 more in small files
  - the PMTiles map
  - Sixfold job photos and research, Peak client files, the prospect town reports
- **Not sent:**
  - county assessor downloads (23 GB), LiDAR / building / raw / cache folders, logs, PDFs
  - built editions (`traverse/editions/dist`, 7.6 GB: rebuilt there)
  - videos, `*.before-*` snapshots, `_archive`
  - **anything under `surge/`**, `personal/pay/`
  - any name with codes / secret / token / password / credential / accounts.json / .key / .pem / .env / finance, `-private/` folders,
    browser profiles (two `secrets.php`, `rounds-codes.php`, `noaa-token.txt`, a Peak `accounts.json` and a Chrome profile were filtered
    out by name)
  - `ProjectBackup` and `~/.ssh` (outside the repo, never read)
- One unit = one ~150 MB chunk. It's packed with tar.gz and sent to the VM as a `.part` file. The whole file is md5-checked, then unpacked
  into `~/main`, then every file is md5-checked. A drop costs one chunk, which goes again on the next run (exit 4), and the job pauses on
  the iPhone hotspot.
- The ring: build `vm-data` (a step per chunk).
- Run it again at any time with `VMDATA_AGAIN=1 bash traverse/ops/wifi-queue/jobs/vmdata.sh` (or reset `state/vmdata/pass.done`). A new
  pass sends only files whose size or time changed.
- ⚑ **Two copies of the door data.** Until the data jobs move to the VM, the laptop's copy is the master: the refresh tasks and the Wi-Fi
  queue's pipeline jobs keep updating it, and they upload to the server from there. Full data builds and door-data pushes stay on the
  laptop. On the VM the data is there for code builds, reading and checks, and it's refreshed by another `vmdata` pass.

## Known gaps (not done tonight)

- **Door-data pushes from the VM** (`push-edition.sh`, `deploy-client.sh --data/--first`, new editions) need the codes files, which are
  never uploaded. That stays on the laptop until Matthew decides otherwise.
- **First full (data) build on the VM** after the upload:
  `(cd traverse/app && node i18n/sync-es.cjs && node ../editions/build-editions.cjs && node ../editions/minify-page.cjs)`. Not tried
  yet. It writes about 7.6 GB to `editions/dist`, so check that `deploy-app.sh <label> --check` says 0 differ before trusting it.
- **Scripts still Windows-only** (hard-coded `/c/Users/Surge Inc/...`, `netsh`, `powershell.exe`, `tar.exe`, Windows tasks). Fixed
  tonight: the deploy and reply path (`deploy-app/-client/-practice.sh`, `help-reply.sh`, `jv-reply.sh`, `jarvis-reply.sh`,
  `jarvis-status.sh`, `push-edition.sh`) and `meeting-worker.sh` (it now tells Windows by `uname`). The VM also gets `LOCALAPPDATA`
  (`~/jarvis/localappdata`) and a `cygpath` stand-in (`~/jarvis/compat/bin`, login shells only: the services' PATH doesn't have it) for
  the long tail. Still to do, to run them on the VM:
  - the refresh jobs (`refresh-weekly.sh`, `refresh-permits.sh`, `refresh-new-homes.sh`)
  - the Wi-Fi queue and its jobs (`_common.sh`, `wifi-queue.sh`, `every.sh`, `yardgap.sh`, `rented.sh`, `yearbuilt.sh`, `onedrive.sh`, `cloudsync.sh`)
  - the door-territory finishers (`finish-*.sh`, `run-*.sh`, `resume*.sh`, `upload-towns-sixfold.sh`, `push-sixfold-side.sh`, `keep-oneoffs.sh`, `hotspot-watchdog*.sh`)
  - `run-cloud-finishers.sh`, `pull-server-backup.sh`, `pull-job-photos.sh`, `open-site.sh`, `launch-precheck-*.sh`
  - `traverse/post-calendar/tools/*.sh`, `traverse/prospect-desk/tools/push-seed.sh`
  - `traverse/marketing-site/build-site.cjs` (tar.exe)
  - `shared/tools/overnight-check.sh`, `github-sync.sh`, `paystub-watch.sh`
  - assorted test harnesses under `traverse/app/review-*` and `audit-1030`
  - the `lawn-trial` / `metros` readers with laptop paths
- **The EOD report** goes to the laptop's Desktop (`End of Day Reports`). A VM session can write `changelog/` and `CHANGELOG.md`, but not
  the Desktop copy: queue that part for the laptop, or write it on the laptop.
- **Laptop jobs that edit tracked files** after the flip make the laptop's copy dirty. The client cycle then waits and alerts once (the
  VM's copy is the real one).
- **Bundles left at the flip.** A watcher session that writes memory or notes in the minute between the flip's checks and the switch
  leaves a bundle in `~/jarvis/outbox/changes/`. After the flip nothing merges those. `ls ~/jarvis/outbox/changes` after the flip should
  be empty: if it isn't, a session merges it by hand.
- ⚑ **Seen while doing this.** Two memory notes that already reached the VM (since 19 Nov, through the watcher's copy) mentioned restricted
  topics by name: `three-entities-surge-sixfold-horizon.md` and `matthew-user.md`. **Trimmed 22 Nov on Matthew's OK**, on the laptop and
  in both VM copies (`~/.claude/projects/-home-yard-main/memory`, `~/jarvis/memory-base`). The pay note's `MEMORY.md` index line, which carries
  figures, was going to the VM until tonight. It's now left out of every copy sent (`jarvis-cloud-sync.sh` push and `vm-main.sh`), and the
  old copies on Jarvis were removed: `~/jarvis/incoming/memory.applied.tgz` deleted, the line deleted from `~/jarvis/memory-base/MEMORY.md`.
  The old machine yardtest was not touched and may still hold old copies.

## Files

| File | What |
|---|---|
| `traverse/ops/vm-main.sh` | laptop: `prep`, `status`, `flip --matthew-said-go`, `rollback --matthew-said-go` |
| `traverse/ops/vm-main-sync.sh` | VM: keeps `~/main` level with the one history (timer + post-commit hook); `status` |
| `traverse/ops/help-watch-cloud.sh` | the watcher: `WRITE=laptop|vm` in `~/jarvis/config`; `vm_notes`, `vm_push`; `--check` prints the write mode |
| `traverse/ops/jarvis-cloud-sync.sh` | laptop: before the flip as before; after it, the client cycle (`vm_pull_repo`, `vm_memsync`, `vm_jobs`) |
| `traverse/ops/cloud-guard.sh` | standby `~/main` may only `--check`; the VM history's own ids accepted |
| `traverse/ops/wifi-queue/jobs/vmdata.sh` | the data upload (state in `wifi-queue/state/vmdata/`) |
| `traverse/ops/tests/cloud-test.sh` | section 12: VM mode and main-sync (run: `bash traverse/ops/jarvis-cloud.sh test`) |
| VM `~/.claude/CLAUDE.md` | the VM's own rules (no Surge drafting there) |
| VM `~/main/.git/hooks/pre-commit`, `post-commit` | standby refuses commits; never Tier 1 or `personal/pay/`; after the flip, every commit pushed at once |
| VM `~/.config/systemd/user/jarvis-main-sync.{service,timer}` | every 2 minutes (does nothing before the flip) |
