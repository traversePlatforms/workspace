# J.A.R.V.I.S. in the cloud (TASKS X-15)

Matthew, 19 Nov 2026: go ahead with the always-on J.A.R.V.I.S. on the Azure machine `yardtest` while its free credit lasts (~23 Nov),
then move to a small B2s ("can we keep it in the big one while we got it? then switch"). It answers his own J.A.R.V.I.S. desk and the
staff desks (Jen and Brad in the Sixfold app, the Houston test install), so answers do not depend on the laptop being awake. And (his
priority, ~10 pm): when Jen asks for an app change while the laptop is closed, the cloud does **the whole job**: code, build, deploy,
commit, reply.

History: 12 Nov trial run 1 answered the practice copy only. 19 Nov: the full watcher, the two-way sync and the deploy guards were built
and the cloud went into **shadow mode**. **Live needs Matthew's go** (below).

## Where it stands (19 Nov, night)

| | |
|---|---|
| Mode | **shadow**: reads the live queues, logs what it would do, runs the read-only quick pass on his messages, answers nothing live. The practice copy it answers for real (as the trial did). |
| Machine | **`Jarvis`, Standard_D2as_v7 (2 vCPU, 8 GB, $66.28/mo), (US) Central US, 128 GB Standard SSD, `yard@40.78.175.13`**, key `~/.ssh/azure_yard`; live since 22 Nov 2026 ~5:30 pm MT (moved by jarvis-cloud-move.sh, the copy itself done VM-to-VM with a temporary key, since removed, after the laptop route dropped on hotel Wi-Fi). Old: `yardtest` D4as_v5 Sweden Central 20.91.198.101, watcher off; it ran the 22 Nov lawn1122 job after the switch |
| Done by Matthew | SiteGround key `jarvis-cloud` imported; Claude Code on the VM signed in to his plan (claude.ai, Max) |
| Not needed | the GitHub deploy key (the laptop sends the repo straight to the VM; see "Repo copy") |
| Laptop | `help-watch.sh` unchanged in behaviour: it stands back only when the cloud says **live** |

## Design (chosen 19 Nov)

**One writer at a time; the laptop's history stays the truth; the cloud's work comes back as commits, never as files copied over.**

Rejected: (a) "cloud answers, laptop does all repo work" (Matthew: queueing staff app changes for a closed laptop is not acceptable);
(b) the VM as the only home of the repo right now (the laptop holds data, Windows jobs and Tier 1 notes the VM does not; that is the
target, below, not tonight); (c) file sync with last-writer-wins (loses work, and MEMORY.md is written by both sides).

### Repo copy

- `jarvis-cloud-sync.sh push` (laptop) clones the laptop repo, strips Surge's Tier 1 paths exactly as `github-sync.sh` does (`git
  filter-repo`, deterministic, ~30 s at nice 19), and `git push`es it over SSH to `~/jarvis/repo.git` on the VM, with the
  laptop-commit to filtered-commit map (`~/jarvis/incoming/commit-map`; a commit the filter emptied maps to its nearest kept ancestor).
  Runs from the laptop watcher's 2-minute cycle, at most every 10 minutes, only when HEAD changed. No GitHub in the loop.
- `~/workspace` on the VM is a clone of that, on branch **`cloud`** = the laptop's newest copy + the cloud's own commits the laptop has
  not merged yet. Before every session the watcher refreshes it: fetch, rebuild `cloud` from `origin/main`, cherry-pick the unmerged
  cloud commits back on top (by Cloud-Id), clean. A cloud commit that no longer applies is kept as a `stuck-*` branch, writes stop
  (`~/jarvis/state/stuck`) and Matthew is told; nothing is lost.
- `node_modules` by `npm ci` on the VM (Linux sharp). The VM has no door data (3.4 GB, personal data) and no codes files.

### The write turn: who may change the repo

The laptop's 5-minute beat (in `help-watch.sh`) writes `<time> <HEAD>` to `~/www/traverseplatforms.com/jarvis-cloud/laptop.txt` on the
server. Before each live session the cloud decides:

- **Laptop away** (beat over 15 minutes old) **and** the cloud's copy already holds that HEAD (commit map) **and** nothing stuck: the
  cloud holds the write turn (`~/jarvis/state/write-ok` for that session). The session may edit, build, commit, deploy.
- Otherwise (laptop on, or its last commit never reached the VM): the session answers and does server-only work (the office's leads,
  jobs, payments through the app's own server code) and queues repo work for the laptop (`~/jarvis/bin/laptop-job.sh`), which runs it
  within minutes because it is on.

Enforced in code, not just the prompt: the repo copy's `pre-commit` hook refuses without the write turn (and refuses Surge's restricted
paths); the deploy scripts refuse (below); `jarvis-status.sh` refuses everything but `alert` on the VM (its builds and Waiting lists are
the laptop's).

### The cloud's commits back to the laptop

Every cloud commit carries `Cloud-Id: c<time>-<4 hex>` (the repo copy's `commit-msg` hook). After each session the watcher captures what
the session left in `~/jarvis/outbox/changes/<time>-<ticket>/`: each new commit as a patch, uncommitted repo files and memory files as
base + cloud copies. The laptop's 2-minute cycle (`jarvis-cloud-sync.sh pull`) applies them **in order**:

- commits: `git am -3`, each Cloud-Id once; it waits (and retries every 2 min) while the index has staged changes, a `git am` is in
  progress, or a file it touches is mid-edit here; if it keeps failing, Matthew gets one alert. Nothing is ever dropped.
- `jarvis-learned*.md` and memory notes: `git merge-file --union` (line by line: both sides' lines kept; nothing overwritten). Memory
  deletions are not repeated (archive, never delete). Learned notes are committed unless the file was already being edited here.
- `TASKS.md`: a normal 3-way merge, applied only when clean; otherwise kept for review.
- any other file the session changed but did **not** commit: never applied; kept in `ProjectBackup/cloud-sync/review/` with an alert.

Then the laptop pushes its repo and memory back, and the bundle moves to `~/jarvis/outbox/merged/` on the VM (dropped there after 14 days).
Until the laptop merges, the VM lays its own unmerged notes back over each fresh copy (same union merge), so later cloud sessions see them.

**Memory** goes to the VM as Claude Code's own memory folder for `~/workspace` (`~/.claude/projects/-home-yard-workspace/memory/`, so it
loads by itself), minus `matthew-pay-review.md` and `story-tier1-restricted.md` (kept off the VM, like Tier 1 on GitHub).

### Deploys from two places (traverse/ops/cloud-guard.sh)

Sourced by `deploy-app.sh`, `deploy-practice.sh`, `deploy-client.sh`. Records on the server in `jarvis-cloud/` (beside public_html):
`deploy-cloud.txt` (every Cloud-Id the cloud deployed) and `deploy-laptop.json` (the laptop's last deploy: commit, label, and the git
blob of every build input that was **not committed** at that moment).

- **Laptop deploy refused** while the cloud has deployed commits the laptop has not merged ("run jarvis-cloud-sync.sh pull"). An unreachable
  server or no record never blocks the laptop.
- **Cloud deploy refused** unless: it holds the write turn; its tree is committed (build, commit, then deploy); its copy holds the laptop's
  last deployed commit; and each input the laptop deployed uncommitted is in the cloud's copy byte for byte, or changed by a later commit.
  ⚑ The laptop deploys with uncommitted data today (company.json, index.json, town-county.json, shared-towns.json,
  town-surveys-extra.json were dirty on 19 Nov): **the cloud cannot deploy until those are committed** (or the laptop redeploys clean).
- The 18 Nov stale-build check (source page newer than the built page) stays as it was.
- `JARVIS_GUARD_OFF=1` skips the guard: Matthew by hand only; the cloud's prompt forbids it.

### The build on Linux

`(cd traverse/app && node i18n/sync-es.cjs && TRAVERSE_CODE_ONLY=1 node ../editions/build-editions.cjs && node ../editions/minify-page.cjs)`.
Code-only (pages, APIs, client templates, tools) is all `deploy-app.sh`, `deploy-practice.sh` and `deploy-client.sh` (without `--first`
/ `--data`) send. `build-editions.cjs` now uses `bsdtar` off Windows (libarchive-tools; GNU tar cannot write zips) and, in code-only, no
longer makes practice sign-in codes. `php -l` needs php-cli (installed). The deploy scripts take `JARVIS_REPO` and `JARVIS_SG`.

### What cannot run on the VM (and what it would take)

| Job | Why | What it would take |
|---|---|---|
| Sixfold's website / email (`six`), Surge (`surge`), 365 Aeration (`a365`) | no SiteGround keys for those accounts on the VM | a VM key per account (Matthew imports each in SiteGround), kept per bot |
| Full data builds, door-data pushes (`push-edition.sh`, `deploy-client --data/--first`), new editions | the 3.4 GB door data and the codes files are not on the VM | copy `traverse/app/data/rounds` (personal data) + the 7 codes files + `~/.ssh/practice-codes.txt`; 64 GB disk |
| Desktop files, Drive letters, Windows tasks, opening things on his screen | Windows only | Tailscale + a laptop job runner (design below); or the VM-as-home move |
| Surge drafts that need RESTRICTED.md | Tier 1 notes kept off the VM | his decision to put them there |
| Deploys while the laptop's last deploy had uncommitted inputs | the cloud cannot rebuild what was never committed | commit data before deploying (habit) |
| Sending email/texts through the Outbox/Peak sender | those run on the server already; nothing needed | — |

### Two watchers

- **Claims**: both queues already take under a server-side lock: `help-next.php` (Sixfold, practice, installs) and `jvdesk.php next`
  (`jdNext`, `desk.lock`) mark the thread `working`; one ticket goes to one watcher. Nothing to add.
- **Beat**: the cloud writes `<time> <mode> <ready>` to `jarvis-cloud/beat.txt` every 60 s from its own background loop (a long session
  never stops it). `help-pending.php?b=1` returns `<age> <mode> <ready>` (deployed 19 Nov, key-protected).
- **Standing back**: the laptop reads it every 60 s (HTTPS, else SSH) and stands back only while mode=live, ready=1 and age < 4 min;
  otherwise it answers as before. `ProjectBackup/help/no-defer` = never stand back. It always runs jobs the cloud queued for it first.
- Edge kept from the 12 Nov review: a follow-up message during a hand-over can be taken by the other side (the take lock covers a
  ticket, not a conversation). With one side standing back that only happens in the minute around a beat going stale.

### Shadow mode

Each new ticket version (queue, id, message count) gets a row in `~/jarvis/state/shadow/shadow.tsv`: when the cloud saw it, who wrote
(matthew / office / install), what it would run, and whether it would hold the write turn (and why not). For his own messages it also
runs the quick pass (Sonnet, Read/Grep/Glob only) and keeps the answer in `shadow/<id>-<n>.quick`, never sent.
`bash traverse/ops/jarvis-cloud.sh shadow-report [hours]` lines that up with the laptop's own log (when the laptop started each session,
its quick-pass answer) and lists anything one side saw and the other did not.

## Switch-over (Matthew's go only)

1. Read the shadow report (`jarvis-cloud.sh shadow-report 24`).
2. Commit the laptop's dirty data files (else the cloud can answer and do server work but not deploy).
3. `bash traverse/ops/jarvis-cloud.sh mode live --matthew-said-go`. Within a minute the laptop logs "stands back".
4. Back to the laptop at any moment: `jarvis-cloud.sh mode shadow` (or `touch ProjectBackup/help/no-defer` on the laptop).

## Modes, files, commands

`~/jarvis/config`: `MODE=shadow|live|practice|off`. Laptop: `traverse/ops/jarvis-cloud.sh signin|status|init|deploy|mode|sync|test|
shadow-report|stop|start|log|pubkey`; `traverse/ops/jarvis-cloud-sync.sh push|pull|cycle|done|status`; `traverse/ops/jarvis-cloud-move.sh`.

| File | What |
|---|---|
| `traverse/ops/help-watch-cloud.sh` | the cloud watcher (`--check`, `--guard-test`, `--peek`, `--mode`) |
| `traverse/ops/jarvis-cloud-prompt.md` | appended last to every live session on the VM (paths, write turn, queueing) |
| `traverse/ops/cloud-bin/sg.sh`, `laptop-job.sh` | `~/jarvis/bin/` on the VM |
| `traverse/ops/cloud-guard.sh` | the two-place deploy guard |
| `traverse/ops/jarvis-cloud-sync.sh` | laptop side of the copies |
| `traverse/ops/tests/cloud-test.sh` | stand-in tests on the VM (`jarvis-cloud.sh test`) |
| `traverse/ops/jarvis-cloud.service` | systemd user unit |
| VM `~/jarvis/` | `secrets/` (700/600), `state/` (log, shadow, ready, write-ok), `outbox/` (changes, jobs, merged), `incoming/`, `repo.git`, `tools/whisper.cpp` |

## The guard and what it does not cover

Every server command the watcher itself sends goes through `srv()`/`allowed()`, per mode: practice = the practice copy's commands;
shadow = plus peeks, counts, the beat, the laptop's beat; live = plus take, reply, transcripts, the final-reply check, a ticket's own
files. `--guard-test` checks 40 hostile commands in every mode, every look in shadow, every live command refused outside live, and the
queue-folder checks (a ticket must come from its own queue's folder; a desk thread must be `desk: jarvis` and written only by Matthew).

Not covered: once live, sessions use `~/jarvis/bin/sg.sh` with the VM's key, which opens the whole Traverse account (same as the laptop's
key). Anyone with `azure_yard` (the laptop) can reach it. Closing it needs per-bot keys with `command=` restrictions (target design).

## Moving to the D2as_v5 (before ~23 Nov)

Matthew, 22 Nov 2026: picked option 3 ("lets do option 3"), a mid machine that can be the main home and hold every bot, over the
$40 B2s. yardtest was checked the same morning: about 1 GB of 16 GB memory in use, load 0.1.

**Matthew, in the Azure portal (needs his card):**

1. portal.azure.com → **Subscriptions** → the free trial → **Upgrade** → choose **Pay-As-You-Go**, card, confirm. (Without this,
   everything stops when the credit ends; the laptop watcher is not affected.)
2. **Virtual machines** → **+ Create** → **Azure virtual machine**.
3. **Basics**: Subscription: the upgraded one. Resource group: the same as `yardtest` (shown on yardtest's Overview). Name `jarvis`.
   Region **(Europe) Sweden Central**. Availability options: *No infrastructure redundancy required*. Security type: *Standard*.
   Image **Ubuntu Server 24.04 LTS - x64 Gen2**. Size: **See all sizes** → search `D2as_v5` → **Standard_D2as_v5** (2 vCPU, 8 GiB) → Select.
   Authentication: **SSH public key**; Username `yard`; SSH public key source: **Use existing public key**; paste the one line from
   `C:\Users\Matthew sharpe\.ssh\azure_yard.pub` (Notepad). Public inbound ports: **Allow selected ports**, **SSH (22)**.
4. **Disks**: OS disk size **128 GiB**, type **Standard SSD (locally-redundant storage)**, *Delete with VM* ticked.
5. **Networking**: leave the new virtual network and new public IP. **Management**: Auto-shutdown **off**.
6. **Review + create** → **Create**. When it says *Deployment is complete*: **Go to resource** → copy the **Public IP address**.
7. Give the IP to a session; it runs, from the laptop:
   `jarvis-cloud-move.sh check <ip>` → `prep <ip>` → `bash traverse/ops/jarvis-cloud-sync.sh push` is not needed (copy brings the repo)
   → `copy <ip>` → `switch <ip>` → Matthew: `bash traverse/ops/jarvis-cloud.sh signin` → `jarvis-cloud.sh status` and `test`.
   The same SiteGround key moves with `~/jarvis/secrets`, so no new import.
8. After a day or two on the new machine, and once the `~/run` data below is saved: **yardtest** → **Stop** (deallocate). Delete it later
   only when nothing on it is wanted (its disk costs while it exists).

Cost after the trial (Azure PAYG, Sweden Central, Linux, checked 19 Nov): D2as_v5 $67.16/mo; 128 GB Standard SSD (E10) $9.60/mo;
static IPv4 $3.65/mo; outbound under 100 GB free: **≈ $80/mo**. His own bot runs on his Claude plan; staff bots on an API key are
extra (≈ $15-60/mo, capped per bot). 128 GB because the VM becomes the main home (repo, builds, data jobs). (Earlier B2s plan: ≈ $40/mo.)

### `~/run` on yardtest (42 GB; disk 81% full). Inventory 19 Nov, nothing deleted

| Item | Size | Proposal |
|---|---|---|
| `tree-zones/lidar-cache` | 25 GB | leave behind: LiDAR downloads, re-downloadable; the laptop has the subsets it uses |
| `lawn-trial` (`drcog-turf` cache, yard v2/v3) | 7.3 GB | leave behind: yard v3 live 15 Nov; caches re-creatable |
| `tv` (an old repo copy), `fill1031` (vm-backup, inputs; every stage's result already on the laptop and live) | 6.2 GB | leave behind |
| **`hailfill/out` + `result.tgz` + `wind-storms.json`** | **~0.85 GB** | **copy to the laptop**: the 18 Nov hailwind rerun finished on the VM (13:07 MT) after the laptop's `finish-hailnew` had stopped (12:11 MT, "no hail/wind report"); then re-run that finisher |
| `~/prospects/places.db` + CSVs | 125 MB | **ask Matthew**: not found on the laptop; if the Prospect Desk's 9,019 companies came from it, copy to Drive (Traverse) |
| `gap1108` (El Paso, PO boxes, rented homes) | 342 MB | unsure whether every output was merged: copy (small) unless a session confirms |
| `hou`, `every1115`, groups 1-3, layers, trees-ovt, ovn1031, hail trials, old tgzs, logs | ~2 GB | leave behind (merged and live) |

Total worth keeping ≈ 1.3 GB; rclone is **not** installed on the VM (the Drive design below was never set up), so copy to the laptop
over SSH (`scp -r`; check the hotspot first: SSID "iPhone" = no heavy downloads), then into the weekly Drive backup if wanted.

## Target design (Matthew, 19 Nov ~10:15 pm; not built yet)

1. **The VM as the main home.** He does not want to be online around the clock. Next step: VS Code Remote-SSH into the VM, one main repo
   there, the laptop a client. This design gets there without rework: the VM already holds the history (filtered), a bare repo and a
   working copy with hooks; the switch is (a) the VM's repo becomes `origin` and the laptop clones it, (b) the write turn becomes "the
   VM always" (VS Code sessions run on the VM, in the same `~/workspace` or a sibling worktree), (c) memory lives on the VM (Claude Code
   there uses it natively), (d) the laptop keeps Windows-only jobs via Tailscale, (e) GitHub mirrors the VM. Open decisions: Tier 1
   notes and door data on the VM (personal data), and the laptop's Drive backup becoming a VM backup.
2. **A bot registry, so a new bot is config, not code.** `~/jarvis/bots.d/<bot>.conf`, one per bot: who (the writers that count as
   its owner), queue (Sixfold staff chat, his desk, an install's chat, the Peak desk), prompt files, working folder, allowed folders,
   allowed server commands (its `allowed()` list), tools and permission mode, model, daily cap, write turn (yes/no), and credentials.
   Bots: his own; Jen and Brad (Sixfold); Houston (restricted, read-only); a Peak desk bot for Cai and Nneka (Peak data only, never
   Sixfold or Surge). The watcher's loop already has the shape (one queue, one take function, one session builder); the per-queue
   branches in `help-watch-cloud.sh` become rows. Isolation: a Unix user per bot (own home, own `~/.claude`, own working copy or none,
   own SiteGround key with a `command=` restriction where SiteGround allows it), no sudo.
3. **Credentials per bot.** His bot on his Claude plan (as now). Staff bots probably on an Anthropic API key with a budget per bot later
   (not now). Today the watcher clears every API-key variable and requires a claude.ai sign-in; in the registry that becomes the bot's
   `credentials=plan|apikey:<file>` (and a monthly cap), checked the same way before each session.

## Laptop reach (design only; nothing installed)

Tailscale (free Personal plan) between the VM and the laptop, outbound only; the laptop runs Windows OpenSSH bound to the tailnet with one
VM key allowed one command (a small job runner: fetch a Desktop file, run a named task). When the laptop is off, jobs queue (as now).
rclone for the Drives (read-only, one remote per company account, never copying between them): `rclone config` on the VM with
`drive.readonly`, `rclone authorize "drive"` on the laptop. Not installed.

## Security notes

- VM secrets in `~/jarvis/secrets/` (700, files 600): help-poll key, the VM's own Traverse SSH key (`jarvis-cloud` in SiteGround),
  `known_hosts`, the unused GitHub deploy key. Claude's sign-in in `~/.claude/.credentials.json`. No API key. No laptop private keys,
  no desk key (the desk is read over SSH), no codes files, no door data.
- Revoke: SiteGround → SSH Keys Manager → delete `jarvis-cloud`. Claude: `~/.local/bin/claude auth logout` on the VM, or claude.ai →
  Settings → sign out other sessions. Stop: `jarvis-cloud.sh mode off` or `systemctl --user disable --now jarvis-cloud`.
- The VM listens on SSH (22) only.
