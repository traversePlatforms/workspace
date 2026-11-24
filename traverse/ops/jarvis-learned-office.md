# J.A.R.V.I.S.: what past OFFICE tickets taught (Jen, Cai, Brad; read at the start of every office ticket; add one entry per useful ticket)

Kept apart from jarvis-learned.md, which holds Matthew's own work across his companies (overnight review, 11 Nov 2026). Same rules: one
dated entry per ticket that taught something reusable, short, no customer contact details or codes.

## Lessons
- 2026-11-05 · Jen: "are aftercare emails set up for fall clean-up only jobs?": the automatic aftercare email is switched OFF; check the
  switch before explaining the rules.
- 2026-11-06 · Jen: changing a past job's price made the form book a second visit: fix the ORIGINAL job's price and make a fresh pay link
  on it; remove the duplicate booking; never email the customer, the link is hers to send.
- 2026-11-01 · "How do I record a part payment?": answer from the job card (Balance, the way they paid, amount, Save).
- 2026-11-01 · Removing a lead made by mistake: use the app's Remove lead (closed as a mistake), never delete rows.
- 2026-11-14 · Jen: an address in the quote builder gave "server did not answer properly": the search index file (search-index.txt in the
  rounds data folder) goes stale whenever a house is pulled in, and the rebuild needed ~900 MB, over the 768 MB limit, so every search
  answered 500 until it was rebuilt by hand. Fixed by raising the limit inside the rebuild (deploy help-h202611051110161407). If it
  recurs: check search-index.txt age and leftover .tmp files; rebuild with `php -d memory_limit=3G` loading rounds.php and calling searchIndexFile().
- 2026-11-18 · Jen: "Another service" button missing on Deposit and form page though source had it: deploy-app.sh ships app/dist (minified),
  which was stale (12:28) because the build step (sync-es, build-editions, minify-page; ~4 min) wasn't re-run after the edit. Always run the
  build before deploying and grep dist for the change; don't tell her it's her browser until dist is proven current.
- 2026-11-24 · Jen: Pipeline filter "contacted once / twice / 3+": added a Times contacted dropdown beside Last contacted (pipeFindRow in the summit index.html; counts logged call/text/email tries). Same pattern as the 29 Oct search + Last contacted filter.
- 2026-11-24 · Jen: a removed lead still showed under Texted: the ClickUp sync (rounds.php, "ClickUp decides the stage") put the lead back to her old ClickUp status on the next pull. Fixed: a removed (lost) lead stays removed unless her ClickUp status changes. Check leadst.log for a later by:ClickUp status line after the removal.
