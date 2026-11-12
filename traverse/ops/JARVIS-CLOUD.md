# J.A.R.V.I.S. in the cloud — trial run 1 (practice copy only)

Started 12 Nov 2026 (11 Nov Mountain time) on Matthew's ask to "run 1": try the always-on J.A.R.V.I.S. on the Azure machine while it
is on free trial credit (ends ~23 Nov), so the move to a small paid machine is proven first. Plan: TASKS.md **X-15**.

**The trial answers PRACTICE tickets only.** The laptop watcher (`help-watch.sh`, Task Scheduler "Sixfold Help watcher") is unchanged
and still owns every live ticket.

## What runs where

| | Laptop (Hal_9000) | Azure VM `yardtest` (yard@20.91.198.101) |
|---|---|---|
| Watcher | `traverse/ops/help-watch.sh`, every 2 min via Task Scheduler, ~58-min loop | `~/jarvis/ops/help-watch-cloud.sh`, systemd **user** service `jarvis-cloud` (linger on: runs without a login, starts at boot, restarts 20 s after any exit) |
| Tickets | live (Jen, Matthew, office) **and** practice | **practice only** (guard in code, below) |
| Claude Code | VS Code extension's claude.exe, Matthew's plan | `~/.local/bin/claude` 2.1.322 (native installer, auto-updates), **not signed in until Matthew does it** |
| Server access | `~/.ssh/sg.sh trav` (laptop key `traverse_sg`) | its own key `~/jarvis/secrets/traverse_sg_cloud` (RSA 4096, made on the VM, **not yet added in SiteGround**) |
| Poll | `help-pending.php` live + practice counts every 5 s | `help-pending.php?...&p=1` (practice count only) every 5 s; checked from Azure 12 Nov: answers `200 0`, no captcha |
| Voice notes | whisper.cpp large-v3-turbo, 8 threads | whisper.cpp (built 12 Nov from ggml-org master d2c6f05) + **small.en-q5_1** by default, 4 threads; turbo also installed (`WHISPER_MODEL=large-v3-turbo-q5_0`) |
| Repo | full working copy | **no clone yet**: only `help-watch-cloud.sh` and `help-practice-prompt.md` were copied (the practice path needs nothing else) |

The VM's data-pipeline jobs under `~/run` (the idle `fill1031` queue) were left alone. No ports were opened: the VM still listens on 22 only,
and the watcher only makes outgoing connections (HTTPS to traverseplatforms.com, SSH to the SiteGround host, Claude's own sign-in/API).

### Files

- `traverse/ops/help-watch-cloud.sh` — the cloud watcher (copied to `~/jarvis/ops/` on the VM).
- `traverse/ops/jarvis-cloud.service` — the systemd unit (`~/.config/systemd/user/jarvis-cloud.service`).
- `traverse/ops/jarvis-cloud.sh` — run on the laptop in Git Bash: `signin`, `status`, `deploy`, `stop`, `start`, `log`, `pubkey`.
- On the VM: `~/jarvis/secrets/` (700): `help-poll-key.txt`, `traverse_sg_cloud` (+ `.pub`), `known_hosts` (only the Traverse host's
  ED25519 key, matched against the laptop's), `github_deploy` (+ `.pub`, for the later clone). `~/jarvis/state/`: log, lock, pause,
  replies, audio. `~/jarvis/tools/whisper.cpp/`. `~/jarvis/practice-cwd/` (empty folder the practice session runs in: no CLAUDE.md).
- The two public halves are on the laptop for pasting: `C:\Users\Surge Inc\.ssh\jarvis-cloud-traverse_sg.pub` and
  `C:\Users\Surge Inc\.ssh\jarvis-cloud-github-deploy.pub` (public keys; nothing secret in them).

## The guard (why the trial cannot touch live tickets)

In `help-watch-cloud.sh`, not in config:

1. **Every server command goes through `srv()`, which runs only what `allowed()` lists:** `help-next.php [--peek] --practice`,
   `help-reply.php <id> answered --practice`, `help-transcript.php <id> <note> [--failed] --practice`, and `cat` of a voice note under
   `sixfold-practice-data/rounds/help-files/`. Anything else (no `--practice`, chained commands, `..`, `$(`, redirects, other tools such
   as help-attach) is refused and logged as `GUARD:`. `--guard-test` checks 14 live/hostile commands are refused and 6 practice ones
   pass; `deploy` will not start the service unless it prints "all PASS".
2. **A taken ticket must carry the practice copy's own files folder** (`.../sixfold-practice-data/rounds/help-files/<id>`), or it is
   dropped untouched.
3. The HTTPS check only asks for the practice count, and there is **no live code path in the file at all** (no Matthew mode, no
   help-desk prompt, no tools in the session). Live tickets need a new version of the script (switch-over below), not a setting.
4. **No ticket is taken unless Claude Code is signed in** (`claude auth status`); `ANTHROPIC_API_KEY` and the other provider/token
   variables are cleared before every session, so it can only ever run on Matthew's plan.

During the trial **both** watchers answer practice tickets: whichever takes one first. That is safe: `help-next.php` marks a ticket
"working" under a file lock, so one ticket goes to one watcher only. No double replies.

## Start, stop, look

From the laptop (Git Bash, repo root):

```
bash traverse/ops/jarvis-cloud.sh status     # readiness + service + last log lines
bash traverse/ops/jarvis-cloud.sh stop       # or start
bash traverse/ops/jarvis-cloud.sh log
bash traverse/ops/jarvis-cloud.sh deploy     # after editing help-watch-cloud.sh or help-practice-prompt.md
```

On the VM: `systemctl --user status|stop|start jarvis-cloud`; pause without stopping: `touch ~/jarvis/state/pause`;
dry runs: `bash ~/jarvis/ops/help-watch-cloud.sh --peek` (next practice ticket, posts nothing) or
`--test-ticket ~/jarvis/test/practice-ticket.json --run` (no server at all; prints the reply it would send).

## What Matthew must do (each sign-in)

1. **Add the VM's server key in SiteGround (Traverse account).** Site Tools for traverseplatforms.com → **Devs → SSH Keys Manager** →
   **Import** tab. Key name `jarvis-cloud`. Public key: open `C:\Users\Surge Inc\.ssh\jarvis-cloud-traverse_sg.pub` in Notepad, copy the
   one line (starts `ssh-rsa`, ends `jarvis-cloud-yardtest-2026-11-12`), paste, **Import**. No passphrase to set (it has none).
2. **Sign Claude Code on the VM in to your Claude plan.** In the VS Code terminal (Git Bash), from the repo:
   `bash traverse/ops/jarvis-cloud.sh signin`. It prints a link: open it in Chrome, sign in with the Claude account that has the plan
   (choose the Claude subscription, not the Console/API), click Authorize, copy the code it shows, paste it into the terminal, Enter.
   It shows `"loggedIn": true` and restarts the service.
3. **Check:** `bash traverse/ops/jarvis-cloud.sh status` should show `SSH to the server: OK`, `Claude Code: signed in`, `guard: all PASS`.
4. **Test:** send a message (and one voice note) in the **practice** copy's chat. The log shows `practice h...: session started (cloud)`
   if the VM took it (the laptop may take some: either is fine).
5. **Later, for the repo clone (switch-over only):** GitHub → `traversePlatforms/workspace` → Settings → **Deploy keys** → Add deploy
   key, title `jarvis-cloud`, paste `C:\Users\Surge Inc\.ssh\jarvis-cloud-github-deploy.pub`, leave **Allow write access UNCHECKED**.

Untested until 1 and 2 are done: taking a real practice ticket from the server, posting the reply and transcript back, and a real
Claude session on the VM (timing).

## Switch-over plan (cloud takes live tickets, laptop becomes the fallback) — needs Matthew's go

1. **Repo on the VM:** read-only clone over the deploy key (step 5) to `~/workspace`; `git pull --ff-only` from GitHub before each
   session (the GitHub copy lags the laptop until the 6 PM `github-sync.sh`, so after a laptop change run the sync, never `git push`).
   Gitignored data the sessions need (app data copies, door data) is synced only where a ticket needs it, or read from the server.
2. **One owner at a time, decided on the server:** a one-word file, e.g. `sixfold-private/jarvis-owner` = `laptop` or `cloud`. Each
   watcher takes LIVE tickets only while that file names it; flipping it is the switch. The laptop watcher then needs a two-line check
   (its only change), and keeps running as the fallback: if the cloud watcher's heartbeat (a timestamp it writes each minute) is older
   than ~5 minutes, the laptop takes over until it is fresh again. The ticket-take lock in `help-next.php` already prevents two
   watchers taking the same ticket.
3. **A live `help-watch-cloud.sh`** = the laptop's `one_ticket` ported to Linux, from the **fixed** `help-watch.sh` (the 11 Nov review;
   carry over all five): Matthew mode only when **every** person-written message in the conversation is from "Matthew Sharpe" (not just
   the ticket's `by`); "no final reply" decided by a reply row (answered/matthew) written **after the session started**, not the last
   help.log line; office tickets read `jarvis-learned-office.md`, never `jarvis-learned.md`; after a quick-pass ANSWER, confirm the reply
   row landed before skipping the full session; any open-SSH stream waits at least 10 s before reopening. Plus photos (`get_photos`),
   PDFs (`help-reply.sh --pdf` on Linux), Chrome headless for PDFs, memory folder access (sync the memory dir or read it from GitHub).
4. **Server key scope:** the live path needs the server tools and `deploy-app.sh`, so the VM key then has the same reach as the laptop
   key. Keep it a separate key so it can be revoked alone.
5. **What stays laptop-only** (needs Tailscale, below): Desktop files, G:/H:/I: Drive letters, Notepad/Windows jobs, Task Scheduler.

## Laptop reach (design only; nothing installed)

**Tailscale** (free Personal plan; check the limits at sign-up; outbound-only, so no ports open on the VM or the laptop):

- Matthew: make a Tailscale account (sign in with Google as m.sharpe@traverseplatforms.com or his personal Google — his pick), install
  Tailscale for Windows on the laptop and sign in; then on the VM run `curl -fsSL https://tailscale.com/install.sh | sh` and
  `sudo tailscale up --ssh=false`, open the link it prints and approve the VM in the same account. In the admin console: disable key
  expiry for the VM only, and an ACL that lets `yardtest` reach the laptop on one port only.
- The laptop runs **Windows OpenSSH Server** (Settings → Optional features) bound to the tailnet address, with one key from the VM
  allowed for one command: a small "laptop job runner" script (`file-get <path under Desktop>`, `notepad-job <text>`, run a named
  scheduled task). The VM never gets a general shell on the laptop.
- **When the laptop is off**, the cloud J.A.R.V.I.S. writes the job to a queue (`~/jarvis/laptop-queue/<time>.json`) and replies "queued
  for when the laptop is on"; a laptop task at logon (and every 10 min) pulls and runs the queue over Tailscale, then posts a follow-up.

**rclone for Google Drive** (read-only):

- On the VM: `sudo apt install rclone` (or the static binary), `rclone config` → new remote `traverse-drive`, type `drive`, scope
  `drive.readonly`, "Use auto config? n" (headless). It prints an `rclone authorize "drive"` line: Matthew runs that on the laptop
  (`winget install Rclone.Rclone`), signs in to the right Google account in the browser, and pastes the token back. One remote per
  company account (Traverse, Surge, Sixfold), never copying between them (memory: Google Drives per company).
- The token lives in `~/.config/rclone/rclone.conf` (chmod 600). Revoke at myaccount.google.com → Security → Third-party access → rclone.

## Monthly cost after the trial

From the Azure retail price list (prices.azure.com, Sweden Central, checked 12 Nov 2026), pay-as-you-go:

| Item | Price | Month (730 h) |
|---|---|---|
| B2s Linux (2 vCPU, 4 GB) | $0.0432 / h | **$31.54** |
| OS disk: current 64 GB Standard SSD (E6) | $4.80 / mo | $4.80 (a new 32 GB E4 disk would be $2.40) |
| Public IPv4 (Standard, static) | $0.005 / h | $3.65 |
| Outbound data | first 100 GB/mo free | $0 |
| **Total** | | **≈ $40 / mo** (≈ $37.60 on a fresh VM with a 32 GB disk; disk transactions add cents) |

Claude usage is on Matthew's plan (no API cost). B2s is a burstable size: it builds CPU credits at idle (the watcher is idle almost all
the time), so whisper and session bursts run at full speed. Measured on this VM: small.en transcribes the test note in 7–8 s with
2 or 4 threads; large-v3-turbo takes 37–38 s, which is why the cloud default is small.en. Resizing this VM to B2s keeps everything
(Azure portal → VM → Size), but the data-pipeline work under `~/run` needs the 4-core size, so decide that first; a fresh B2s VM plus a
copy of `~/jarvis` is the cleaner split.

## Security notes

- **Secrets on the VM** (all in `~/jarvis/secrets/`, folder 700, files 600, user `yard` only): the help-poll key (copied; it only
  answers counts), the VM's own Traverse SSH key (made on the VM; the laptop's private keys were **not** copied), the GitHub deploy key
  (read-only once added), and, after sign-in, Claude Code's OAuth credentials in `~/.claude/.credentials.json` (600, written by Claude
  Code). No API key; the watcher clears API-key variables before each session.
- Who can get in: SSH to the VM is key-only for `yard` with `azure_yard` (laptop). Anyone with that key can reach everything above.
- **Revoke:** SiteGround SSH Keys Manager → delete `jarvis-cloud` (server access ends at once). GitHub Deploy keys → delete `jarvis-cloud`.
  Claude: on the VM `~/.local/bin/claude auth logout`, and/or claude.ai → Settings → sign out of other sessions. Help-poll key: replace
  `sixfold-private/help-poll.key` on the server (then update the laptop's `~/.ssh/help-poll-key.txt`). Stop everything:
  `systemctl --user disable --now jarvis-cloud`. Or delete the VM.
- Practice sessions run with no tools, no MCP servers and no user settings, from an empty folder; their only output is the chat text.
