# J.A.R.V.I.S. cloud trial: review (night of 11-12 Nov 2026)

Reviewed: commit a288b4ad (`traverse/ops/help-watch-cloud.sh`, `jarvis-cloud.service`, `jarvis-cloud.sh`, `JARVIS-CLOUD.md`) and the
Azure VM as it stood at 06:06 UTC 12 Nov. The laptop watcher `help-watch.sh`, the laptop's scheduled tasks, the server's live data and
the VM's `~/run` jobs were not touched. Nothing was signed in to. No key, code or token is printed here.

State found: service `jarvis-cloud` active, 0 restarts, waiting for sign-in (takes nothing). The VM's server key is not yet added in
SiteGround and the GitHub deploy key is not yet added, so the trial has had no reach to the server so far.

## Bottom line

The script's practice-only guard holds: I found no way through it to live tickets or live files. The one thing Matthew should know
before he adds the key in SiteGround is that the guard lives in the script, not in the key (finding 1). Five low-risk fixes were made
in the cloud files, the guard test was re-run (26 refused, 6 allowed, both ticket checks pass) and the watcher was redeployed with the
helper. Two gaps in the switch-over plan are written into the doc for later (findings 2 and 3).

## Findings

### High

**1. The SSH key is not practice-only; only the script is.** `help-watch-cloud.sh:52-58` (`srv`) refuses everything but the practice
commands, but the key `~/jarvis/secrets/traverse_sg_cloud` is an ordinary SiteGround key with no passphrase. Once it is added in
SiteGround it opens the whole Traverse site account (live Sixfold data, every edition, the private folders) to anything running as
`yard` on the VM: the data jobs under `~/run`, another agent's job, anyone holding the laptop's `azure_yard` key. The doc's heading
"why the trial cannot touch live tickets" was true of the watcher and not of the machine. Nothing is exposed today, because the key
is not added yet. Not fixed (it needs a server-side restriction on that key, a `command=` line, and I do not know that SiteGround's
key manager keeps one). Written plainly into `JARVIS-CLOUD.md:53` and pointed to from step 1, so the choice is his.

**2. Switch-over plan: a read-only clone that lags the laptop could upload old code over new.** `JARVIS-CLOUD.md:108`. Live sessions
change code and run `deploy-app.sh`. The plan's clone is read-only from GitHub, which trails the laptop until the 6 PM sync, and
nothing a cloud session writes (fixes, `jarvis-learned*.md`) gets back. Trial not affected. Added to the doc with a holding rule:
until there is a two-way answer, cloud live sessions answer and look up only.

### Medium

**3. Switch-over plan: one-owner-at-a-time has two holes.** `JARVIS-CLOUD.md:115`. (a) The watcher loop is busy for a whole session,
so a heartbeat written by the loop goes stale during any session over 5 minutes and the laptop would take over while the cloud is
still working. (b) The server lock stops two watchers taking the same ticket, but a follow-up message makes the conversation new
again, so the other side can take the same conversation mid-session. On live tickets with full tools that is two sessions changing
things at once. Both written into the doc as must-close-first.

**4. Empty looks went straight round with no pause.** Was `help-watch-cloud.sh` loop, `one_practice; continue`. When the count said
"1" and the take came back empty or unreadable (the laptop got there first, or the quick count and the server disagree), the VM would
open a new SSH login every second or two for as long as it lasted, with a log line each time. From a data-centre address that is the
kind of thing SiteGround blocks. **Fixed:** `take()` at line 165 waits 5 s longer per empty look, up to a minute; an answered ticket
resets it. (The laptop watcher has the same pattern at `help-watch.sh:220-222,236-237`; not touched, per the rules. Worth the same fix.)

**5. A Console sign-in would have been accepted.** Was line 65: only `loggedIn == true`. A sign-in with `--console` is billed per
use. The helper does pass `--claudeai`, so this needed a wrong manual step. **Fixed:** line 66 also needs `authMethod == "claude.ai"`
(field checked against the laptop's own sign-in: it reads `claude.ai`).

### Low

**6. Deploy copied the new watcher over the old one before testing it.** `jarvis-cloud.sh` deploy. A copy that failed the guard was
left as the file the enabled service would start at the next reboot. **Fixed:** it uploads as `.new`, runs `bash -n` and the guard
test on that, and swaps it in only on "all PASS"; a failure leaves the old watcher in place and running.

**7. No limit on log growth; nothing at disk full.** The VM is at 72% (18 GB free) and shares the disk with `~/run`. **Fixed:**
`tidy()` (line 68) cuts the log and the session error file to their last 2,000 lines past 5 MB and drops voice notes and reply
copies after 14 days; `disk_ok()` (line 75) stops ticket-taking under 500 MB free and says so in the log. Before this, a full disk
would have marked a practice voice note "could not be transcribed" for good and sent the "lost my train of thought" line.

**8. A missing practice prompt would have run a session with no rules.** `session()` line 134. **Fixed:** no prompt file, no session.

**9. Two replies close together are possible in practice.** If a tester writes again while a reply is being made, the other watcher
can take the conversation, so two replies arrive (the first without the second message). Not a double reply to one message; the
lock itself is sound (`help-next.php:11-18`, exclusive lock around read and mark; the 90-minute requeue is far longer than the
5-minute session cap). Doc corrected from "No double replies" to say this.

**10. "Left untouched" is not quite true for a rejected ticket.** `help-watch-cloud.sh:151`. By the time the practice check runs,
`help-next.php` has already marked the ticket "working". It can only fire if the server handed a non-practice ticket to a
`--practice` call, which would be a server fault; the ticket would then sit for 90 minutes. Not changed (a peek-then-take would
double the SSH logins). Checked on the server: the practice API resolves its chat log and files under `sixfold-practice-data` and has
the PRACTICE switch on.

**11. Stopping the service mid-reply** leaves that practice ticket "working" for 90 minutes. Accept.

**12. Cosmetic:** test runs write a second "  log:" copy of some lines into the log. `help-watch-cloud.sh:39`. Not changed.

## What was checked and held

1. **Guard.** Tried: no `--practice`; `--practice` plus extra arguments (`working`, `matthew`, `refresh`, `file=`, `--live`,
   trailing words, `#`); chaining with `;`, `&&`, `|`, newline, backtick, `$(`, redirects; `..` and a second path in the `cat`;
   `help.log` itself; other tools (`help-attach.php`, `scp`); a leading space or double space; other audio extensions. All refused
   (12 of these added to `--guard-test`). Ticket id and note name are checked against fixed patterns before they reach a command;
   the files folder is checked and then checked again inside `allowed()`; transcript and reply text travel on stdin, never in the
   command. There is no `scp` or `rsync` in the file. `SGDEST`, `TOOLS` and the key path are set in the script, not read from the
   environment; `ssh` now also ignores any config file (`-F /dev/null`, line 56) and pins the host key. The HTTPS check can only
   return a count. The session has no tools, so chat text cannot make it do anything but write a reply.
2. **Lock.** Sound, as in finding 9.
3. **Secrets on the VM.** `~/jarvis` and `secrets/` are 700, private keys and the poll key 600, home 750, `yard` the only user, SSH
   key-only, port 22 the only listener. The poll key and private-key text appear 0 times in the watcher log, setup log, journald
   and shell history. No key material in the commit or the doc (public halves are only named by path). The service's environment
   has no Anthropic or Claude variable; the script clears them at start (the doc says "before every session"; same effect). State
   files are 664 from the VM's umask, but sit under a 700 folder.
4. **Service.** Restarts 20 s after any exit, no restart storm possible (20 s is outside systemd's burst window). Idle cost: 2.6 s
   of CPU in 6 minutes, about 1 MB of memory. Nice 5, so the `~/run` jobs win the CPU (one lawn job was at 87% during the check and
   was left alone). No memory cap is set; on this 16 GB machine there is no need, on a 4 GB B2s I would add `MemoryMax=2G`.
5. **Doc.** Steps are right and in order; I added the order, what to do when `status` says NOT YET, and how to turn it off. Cost is
   right: B2s Linux Sweden Central $0.0432/h, E6 disk $4.80, E4 $2.40, static IPv4 $0.005/h, re-pulled from prices.azure.com on
   12 Nov; about $40 a month. All five laptop fixes are carried into the switch-over plan (step 3). Not verified: the GitHub repo
   name in step 5, and that the SiteGround screen is worded as step 1 says.
6. **Send, post, charge.** Nothing found. The only write is a reply into the practice chat, whose pushes are logged, not sent
   (PRACTICE switch on). No Azure resource is created. Plan-only sign-in is now enforced (finding 5). The deploy key is read-only.

## What I changed

- `traverse/ops/help-watch-cloud.sh`: plan-only sign-in check; back-off on empty looks; log trim and 14-day clean-up; free-disk
  check; no session without the prompt; `ssh -F /dev/null`; 12 more refused cases in the guard test.
- `traverse/ops/jarvis-cloud.sh`: deploy tests the new watcher before it replaces the old one.
- `traverse/ops/JARVIS-CLOUD.md`: what the guard does not cover; the two-replies edge; step order and what to do on a failed check;
  the two switch-over gaps and the stale-clone risk; prices re-checked; what happens when the credit ends.
- Redeployed with `jarvis-cloud.sh deploy` after the guard passed on the VM (34 PASS lines). Service active, 0 restarts, still
  waiting for sign-in. Both dry-run tickets on the VM behave as before (live-shaped rejected, practice accepted).

Not tested, because it needs Matthew's two steps: a real practice ticket taken, answered and posted from the VM; the new back-off
and disk check under real conditions (the two helper functions were run on the VM on their own and returned cleanly).

## For Matthew

1. Decide on finding 1 before adding the key in SiteGround: adding it trusts the VM with the whole Traverse server.
2. Say if you want the same empty-look pause put into the laptop watcher (finding 4).
