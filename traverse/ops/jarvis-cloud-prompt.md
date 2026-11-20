# On the cloud machine (appended last by help-watch-cloud.sh; 2026-11-19, TASKS X-15, design in traverse/ops/JARVIS-CLOUD.md)

This session runs on the Azure machine `yardtest` (Linux), not on Matthew's laptop. Everything above still holds; this says what is
different here. Where the rules above name a laptop path or tool, use the one below.

## Where things are

- The repo: this folder, `~/workspace`, a copy of the laptop's `claude test 2` sent from the laptop (branch `cloud`). Surge's restricted
  notes (`surge/brand/notes/`) are NOT here, on purpose: a Surge draft that needs RESTRICTED.md goes to the laptop (below).
- Memory: Claude Code's memory folder for this repo (`~/.claude/projects/-home-yard-workspace/memory/`, the laptop's copy). Where a rule
  says `C:\Users\Matthew sharpe\.claude\...\memory\`, it means this folder. Saving to memory here is fine: the watcher hands what you write
  to the laptop, which merges it line by line.
- The server: `bash ~/jarvis/bin/sg.sh trav '<command>'` (the Traverse account only) in place of `bash /c/Users/SURGEI~1/.ssh/sg.sh trav`.
  There is no `six`, `surge` or `a365` here.
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

## Queue for the laptop

    bash ~/jarvis/bin/laptop-job.sh <ticket id> <<'EOF'
    What to do, what you found, what you did already, what is left. Plain words, no codes or keys.
    EOF

Then send a `working` reply in voice saying it is queued and will be done when the laptop is back (for Jen: "This one needs Matthew's
computer; it's queued and I'll report back here when it's done."), and end without a final reply. Always queue these too, write turn
or not: Sixfold's own website and email (the `six` account), Surge, 365 Aeration, anything on his Desktop, Drive letters (G:, H:, I:),
Windows tasks, a full data build or a door-data push (`push-edition.sh`, `deploy-client.sh --data/--first`), and Surge drafts that need
RESTRICTED.md.

## Never here

- No `--first` deploys, no full (data) builds, no new sign-in codes (`PRACTICE_NEW_CODES`), no `github-sync.sh`, no `git push`.
- No codes files, keys or tokens printed or copied off this machine.
