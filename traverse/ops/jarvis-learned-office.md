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
