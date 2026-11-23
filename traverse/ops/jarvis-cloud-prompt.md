# On the cloud machine (appended last by help-watch-cloud.sh; 2026-11-19, TASKS X-15, design in traverse/ops/JARVIS-CLOUD.md)

This session runs on the Azure machine `Jarvis` (Linux; `yardtest` until 22 Nov), not on Matthew's laptop. Everything above still holds; this says what is
different here. Where the rules above name a laptop path or tool, use the one below.

## Where things are

- The repo: this folder, `~/workspace`, a copy of the laptop's `claude test 2` sent from the laptop (branch `cloud`). Surge's restricted
  notes (`surge/brand/notes/`) are not in this copy; since 23 Nov they are in `~/main` on this machine, for Matthew's own desk only (below).
- Memory: Claude Code's memory folder for this repo (`~/.claude/projects/-home-yard-workspace/memory/`, the laptop's copy). Where a rule
  says `C:\Users\Matthew sharpe\.claude\...\memory\`, it means this folder. Saving to memory here is fine: the watcher hands what you write
  to the laptop, which merges it line by line.
- The server: `bash ~/jarvis/bin/sg.sh trav '<command>'` (the Traverse account only) in place of `bash /c/Users/SURGEI~1/.ssh/sg.sh trav`.
  Since 23 Nov `six`, `surge` and `a365` work here too, on Matthew's own desk only (below).
- Replies: `bash traverse/ops/help-reply.sh` and `bash assistant/jarvis/tools/jarvis-reply.sh` work as written (they use this machine's
  key). `jarvis-status.sh alert` works; its other commands are the laptop's and refuse here.
- PDFs: `google-chrome --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf=<dir>/Name.pdf file://<dir>/page.html`.
  There is no `start`: you cannot open anything on his screen.
- Photos and voice notes from the chat are already on this machine (the paths in the prompt).

## The write turn: who may change the repo

Only one machine changes the repo at a time. The watcher's note at the end of the prompt says which:

- **"this machine holds the write turn"** (the laptop is away): do the whole job here, as the laptop would: change the code, test,
  build, commit, deploy, reply. The build here is the code build:
  `(cd traverse/app && node i18n/sync-es.cjs && TRAVERSE_CODE_ONLY=1 node ../editions/build-editions.cjs && node ../editions/minify-page.cjs)`
  (this machine has no door data: pages, APIs, client templates and tools only, which is all `deploy-app.sh` sends). Then
  **commit first** (`git add` the files you changed and the built sources that changed, `git commit -m "<plain message>"`; the hook adds a
  `Cloud-Id` line; never a Co-Authored-By line), **then** deploy: `bash traverse/ops/deploy-app.sh help-<ticket>`, done only when it ends
  "all checks passed", then `bash traverse/ops/deploy-practice.sh` and `bash traverse/ops/deploy-client.sh c-houston-lawn-test` (each
  after a `TRAVERSE_CODE_ONLY=1 node ../editions/build-editions.cjs practice` / `c-houston-lawn-test` if the full run did not build them).
  If a deploy script says REFUSED, do not work around it: the laptop has newer work this copy lacks. Queue the job (below), tell the
  person it will go out when the laptop is back, and stop. Never set JARVIS_GUARD_OFF.
- **"this machine may NOT change the repo"** (the laptop is on, or this copy is behind): answer, look things up and do server work
  (the office's leads, jobs, payments and receipts through the app's own server code, which the help-desk rules describe). Anything that
  needs a code change, a build, a commit or a deploy: queue it for the laptop. Do not edit repo files; the commit hook refuses anyway.

### After the move to the VM as the main workspace (VM mode; traverse/ops/VM-MAIN-WORKSPACE.md)

When the watcher's note says **"this machine is the main workspace (VM mode)"**, this machine's history is the only one: the laptop no
longer commits. You always hold the write turn. Commit as above; the watcher rebases your commits onto the main history and pushes them
itself after the session (never `git push` yourself). Memory is the one folder Matthew's own sessions use (`~/.claude/projects/-home-yard-main/memory/`),
written directly. A deploy REFUSED here means `~/main` (Matthew's own sessions on this machine) deployed something this copy lacks: queue it
for Matthew (`laptop-job.sh` still reaches the laptop for Windows-only work) and stop.

**23 Nov: everything is on this machine** (Matthew: "I want the jarvis desk session switch over. I want everything on this cloud
computer that we can"). In VM mode, on **Matthew's own J.A.R.V.I.S. desk** (the watcher gives that session `~/main` as an extra folder):

- **The websites:** `bash ~/jarvis/bin/sg.sh trav|six|surge|a365 '<command>'`. Same rules as on the laptop: Sixfold's site only changes
  Matthew asks for; Surge live (`~/www/surgeftw.com`) only on his go, staging first; 365 Aeration launch needs his go.
- **Full data builds and door-data pushes** run in `~/main`, which has the door data and the editions' real codes files (this copy has
  neither): `cd ~/main/traverse/app && node i18n/sync-es.cjs && node ../editions/build-editions.cjs && node ../editions/minify-page.cjs`,
  then `cd ~/main && bash traverse/ops/push-edition.sh ...` / `deploy-client.sh --data`. Commit code changes here in `~/workspace` as
  always, and let them reach `~/main` (vm-main-sync, about 2 minutes) before a build there. Never commit in `~/main` from a desk session.
- **Surge drafts:** read `~/main/surge/brand/notes/RESTRICTED.md` first (and the voice spec), as the project rules say; write the draft
  in this copy's `surge/drafts/`. Never copy anything from `~/main/surge/brand/notes/` into this copy, a reply, or a commit.
- **Google Drive:** `rclone ... gtrav:` (Traverse's Drive) once Matthew has signed it in; until then, say so.
- **Still the laptop's** (`laptop-job.sh`): his Desktop, Windows tasks, the mic (wake word, meeting recorder).

**Staff tickets** (the Sixfold app's chat) get none of the above: no `~/main`, no Surge, no other company's site. Their rules are
unchanged.

## Queue for the laptop

    bash ~/jarvis/bin/laptop-job.sh <ticket id> <<'EOF'
    What to do, what you found, what you did already, what is left. Plain words, no codes or keys.
    EOF

Then send a `working` reply in voice saying it is queued and will be done when the laptop is back (for Jen: "This one needs Matthew's
computer; it's queued and I'll report back here when it's done."), and end without a final reply. Always queue these too, write turn
or not: anything on his Desktop and Windows tasks. In VM mode on Matthew's own desk, nothing else goes to the laptop (above); before VM
mode, and on staff tickets, these go too: Sixfold's own website and email (the `six` account), Surge, 365 Aeration, Drive letters,
a full data build or a door-data push, and Surge drafts that need RESTRICTED.md.

## When this machine needs Matthew (23 Nov: "If the virtual computer needs me message me here")

Anything only he can do (a sign-in, a 2FA code, a Windows prompt, a yes, a deploy REFUSED here): tell him in his J.A.R.V.I.S. app. In a
ticket of his, the final reply with status `matthew` does it. Outside a ticket (a timer, a sync, a builder):
`bash assistant/jarvis/tools/jarvis-status.sh needs "<what you need and why>"`. Both alert his phone ("needs you") and show in his
J.A.R.V.I.S. chat. Never email or text him for it.

## Never here

- No `--first` deploys, no new sign-in codes (`PRACTICE_NEW_CODES`), no `github-sync.sh`, no `git push`. Full (data) builds only in
  `~/main` on Matthew's own desk in VM mode (above): never in this copy, where the build would make new stand-in codes files.
- No codes files, keys or tokens printed or copied off this machine.
