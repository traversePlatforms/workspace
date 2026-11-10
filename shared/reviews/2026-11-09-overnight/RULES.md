# Overnight review, 9–10 Nov 2026: rules for every agent

Matthew (going to bed, 9 Nov): "have fable do a deep dive of our code and find and errors and issues we have ... across the whole board ...
you dont need my permission to fix anything go ahead and do it all". Three agents, one area each. These rules hold for all three.

## Before you start
- Read the memory index `C:\Users\Matthew sharpe\.claude\projects\c--Users-Matthew-sharpe-Desktop-claude-test-2\memory\MEMORY.md` and every
  memory file that touches your area. They hold decisions Matthew made on purpose; something that looks like a bug may be his choice.
- Read the repo's CLAUDE.md (root) and the README of each project you touch.

## What to fix
Real defects: crashes, PHP errors/warnings (read the server's PHP error logs for real ones), broken pages or links, wrong results, security holes
(auth, injection, exposed secrets, open files), data-loss or race risks, failing builds, dead code paths that break a feature, accessibility
blockers, stale config that will break on a date. Prove each with a test, a reproduction or a log line; fix it; test again.

## What NOT to do (report these instead, in your report's "For Matthew" list)
- No redesigns, no rewording of customer or marketing copy, no voice changes, no price or business-rule changes.
- Jen's screens (Quick quote, Schedule, her Leads to call) keep their layout and flow (memory jen-side-is-source).
- No sending: no emails, texts, posts, pushes to customers or prospects. No queueing. The Prospect Desk follow-up batch is SENDING
  until ~12 Nov: never touch its queue, cron, send-after or events data.
- No DNS changes, no purchases, no account or billing changes, no Stripe/Square settings. Payment CODE: fix only a proven bug with a test.
- Never delete data. Never overwrite live data files (merge, as the memory notes say). Back up anything you replace on a server first
  (`cp -p f f.pre-review-20261109`, or the deploy script's own backup).
- Surge: staging.surgeftw.com ONLY. Never upload to live surgeftw.com. Surge copy is governed by surge/brand/notes/RESTRICTED.md.
- The Azure VM (20.91.198.101) is running the TR-58 property jobs: don't touch it or the scripts it runs (fill1031, gap1108).
- Never print codes, passwords, tokens or keys (codes files: whitelist output; see memory codes-file-read-whitelist).
- PowerShell 5.1 corrupts UTF-8 on read-modify-write: edit with Edit/Write or Node only.

## How to ship
- Use the existing build and deploy scripts named in memory (e.g. deploy-app.sh must end "all checks passed"; public pages go up as
  shared/tools/minify-public.cjs copies; verify by md5 and a fetch after upload; flush SiteGround cache where the memory says to).
- Uploads to the apps and the Sixfold/Traverse sites are allowed without asking (memory upload-standing-permission); Surge staging too.
- Commit only your own paths: `git add <paths>` then `git commit -m ...` (if `.git/index.lock` exists, wait 20 s and retry; another
  agent may be committing). No Co-Authored-By or Claude lines in commit messages (memory no-claude-attribution). Never push to GitHub.
- Be cost-aware (memory usage-cost-effective): run a heavy test suite once, not repeatedly.

## Report
Write `shared/reviews/2026-11-09-overnight/<your-area>.md`, plain English for Matthew (a basic programmer; flat, plain voice):
1. Fixed and live (what was wrong, what you changed, how you proved it, where it is live, backups).
2. Fixed but not live (and why).
3. For Matthew: things that need his decision, with your recommendation.
4. Checked and fine (one line each).
Then reply with a short summary.
