# Overnight tidy-up — Claude's working notes and the task register

**Run 2026-10-06, early hours, while Matthew slept.** Scope: the memory folder
(`C:\Users\Surge Inc\.claude\projects\c--Users-Surge-Inc-Desktop-claude-test-2\memory\`, 86 notes +
`MEMORY.md`) and `TASKS.md` at the repo root. Ground truth: the git log, the files on disk,
`door-app/site/summit-de59ae83/DEPLOY-ROUNDS.md`, `surge/website/build/deploy/DEPLOY.md`, the Sixfold
agreement notes, `CLAUDE.md`. Nothing was published, uploaded, emailed or committed; the artifact and
its `tasks` database were not touched.

## Summary

- **Structure is sound.** Every `[[link]]` between notes resolves; every note has exactly one line in
  `MEMORY.md` (86 of 86) and no line points at a missing note. No note file was deleted.
- **The stale pattern is the 2026-10-04 move of the door app out of `sixfold/` into `door-app/`.** Seven
  notes still gave `sixfold/operations/door-territory/...` or `sixfold/site/data/...` as the current
  path. Fixed, with the move dated in each.
- **Three facts were still stated as current after the repo had moved on:** the Kara DocuSign envelope
  "needs voiding" (it was corrected, not voided, on 2026-10-01); the quote engine "at version 7 / rates v3
  with the artifact not republished" (version 11 / rates v4 since 2026-10-01, artifact retired 2026-10-03);
  the Surge team page "the ten on /team/" (eight since commit `550a0b2`, Ryan Conger and Jon Wallace
  removed). All three fixed at the index line and with a dated banner in the note.
- **TASKS.md had seven items marked open that the deploy log proves live** (SX-48..54, the competitor-audit
  batch, verified 19/19 on 2026-10-03), a `## Surge` heading stranded above twenty Sixfold items, two real
  jobs missing altogether (Brian Skelton, sign by Fri 9 Oct; the Training + calendar upload), and two
  blockers that had already cleared (SG-1 "staging two commits behind"; X-2a "needs the review link").
- **Not mine, and worth knowing before anything is committed:** `git status` shows eight files under
  `sixfold/site/` modified tonight (`index.html`, five `services/` pages, `sitemap.xml`, `who-pays/`). The
  session began on a clean tree and this review did not touch them, so another overnight process did. See
  NEEDS MATTHEW item 1.

## CHANGED

### Memory folder

| File | What was wrong | What proves it | Change |
|---|---|---|---|
| `MEMORY.md` — door-app line | Said "roof-material scan still pending" | DEPLOY-ROUNDS "✅ LIVE 2026-10-05 … Profile and roof materials … materials live in every town file"; the note's own last paragraph | Index line now says Profile + roof materials + 2023 roof close-up LIVE 2026-10-05; avatars added to the no-backup warning |
| `MEMORY.md` — Kara line | "a DocuSign envelope needed voiding — check what happened" | `sixfold/agreements/kara-docusign-setup.md` "✅ Done 2026-10-01 — the envelope was corrected … not voided"; TASKS SX-3a (1) and (2) done 2026-10-01 | Line now says corrected (not voided) + spoken notice given; still open: her signature by Wed 7 Oct and the Sept-2027 45-day call |
| `MEMORY.md` — Training line | Did not say the lessons are not yet live | DEPLOY-ROUNDS top section "⏳ TO UPLOAD — Training … calendar as a month grid"; commits `a3d2c7f`, `7675ff2` | Added: committed, NOT uploaded, goes up with the month-grid calendar, rounds.php + index.html before training.json |
| `MEMORY.md` — quote engine line | "v7 at $100/hr" | `sixfold/quotes/quote-engine.md` line 5 "version 11, 2026-10-01 — rates v4" and line 8 "2026-10-03 — THE ARTIFACT ABOVE IS RETIRED (SX-2b)"; TASKS SX-2b | Line now says rates v4 / version 11, artifact retired, generated `quote.html` is the live copy |
| `MEMORY.md` — team roster line | "the ten on /team/" | commit `550a0b2` deletes `team/ryan-conger/` and `team/jon-wallace/`; eight bio folders on disk | Line now says eight since `550a0b2`, Ryan + Jon removed with 301s |
| `door-app-product-roofing.md` | Commit `f139151` (county bars, Leaderboard tap) marked "AWAITING UPLOAD" | DEPLOY-ROUNDS "✅ LIVE 2026-10-05 (verified 8/8 …) — county bars on Colorado, tap a Leaderboard name" | Status word changed to LIVE + verified 8/8; nothing else in the paragraph touched |
| `kara-jobs-2026-10.md` | Description and loops 1–2 said the envelope still needed voiding and the spoken notice was unknown | As above (kara-docusign-setup.md, TASKS SX-3a) | Description rewritten; a dated "Update 2026-10-06" paragraph inserted at the top of the Open loops section saying which loops closed and which remain. Original loops left in place |
| `brian-skelton-job.md` | Description said "(date not agreed)" while the body said Thu 15 Oct | commits `1928cd0`, `6f8ec2c`; `sixfold/agreements/brian-skelton-2026-10-05.notes.md` | Description now carries job Thu 15 Oct, sign by Fri 9 Oct, nothing sent |
| `sixfold-quote-engine.md` | Description and body current only to version 7 / rates v3; said the artifact "is NOT republished" with no mention of the retirement | `quote-engine.md` lines 5 and 8; `sixfold-field-tools-site.md` SX-2b section | Description rewritten; a "Partly superseded" banner added above the first heading pointing at the current state and at `[[sixfold-field-tools-site]]`. Body untouched |
| `sixfold-field-tools-site.md` | Description said "Three copies of the quote engine can drift" while its own body says one source + one live copy since SX-2b | The note's own SX-2b section | Description only |
| `surge-team-roster.md` | Opened "Facts about the ten people on /team/"; carried the 2026-09-15 "Ryan stays" and the open Jon question as current | commit `550a0b2`; `surge-site-rebuild.md` 2026-10-05 section | One banner paragraph at the top; body untouched |
| `sixfold-lawn-size-trial.md` | Write-up path `sixfold/operations/door-territory/LAWN-SIZE.md` (gone); the RESUME RECIPE still read as live and relies on `git show HEAD:sixfold/site/data/rounds/<town>.json`, which no longer works (path moved, and the door files were untracked in `797ef34`) | File exists at `door-app/operations/door-territory/LAWN-SIZE.md`; TASKS SX-19 LIVE 2026-10-02; commit `797ef34` | Path corrected; one line under the RESUME RECIPE heading saying the run is done, the paths moved, and `git show HEAD:` will not work |
| `sixfold-trees-and-tags.md` | `sixfold/operations/door-territory/tree-zones/` | Folder is under `door-app/` | Path corrected, move dated |
| `sixfold-mail-and-hoa-lists.md` | `sixfold/operations/door-territory/mail/` | `door-app/operations/door-territory/mail/MAIL-LIST.md` exists | Path corrected, move dated |
| `sixfold-door-territory.md` | Opened with `sixfold/operations/door-territory/` as the tool's home | Commit `d018c5e` | Path corrected, move dated |
| `sixfold-crm-direction.md` | Same path, line 123 | Same | Path corrected |
| `sixfold-google-review-link.md` | `sixfold/site/data/rounds/docs/money.json` does not exist | `door-app/site/data/rounds/docs/money.json` exists and carries `links.googleReview` | Path corrected |

Not changed, deliberately: `sixfold-rounds-app.md` (its old `sixfold/site/...` paths sit under a dated
MOVED banner that already maps them to `door-app/`); the feedback/preference notes (none had a dead path);
the long historical sections of `surge-site-rebuild.md` (dated, and the RESUME HERE block at the top is
correct).

### TASKS.md (uncommitted — for review; mirror to the artifact's `tasks` DB afterwards)

| Item | What was wrong | What proves it | Change |
|---|---|---|---|
| `## Surge` heading | Sat at line 409, above SX-9f, SX-13..SX-19, SX-29..SX-54 — all Sixfold items; SG-1 was 400 lines further down | The IDs | Heading moved to immediately above SG-1. No item text changed by the move |
| SX-48 | `[ ]` "BUILT AND TESTED, next upload" | DEPLOY-ROUNDS "✅ LIVE 2026-10-03 — the whole competitor-audit list (SX-48..54), verified 19/19"; top of file "Live = the competitor-audit batch (commit `d917514`)" | Ticked; header now says LIVE, original wording kept after *Was:* |
| SX-49, 50, 51, 52, 53, 54 | `[ ]` while each line already said "✅ LIVE 2026-10-03 (verified)" | Same | Ticked. SX-53 gains one sentence: territories opened to the crew 2026-10-04 (`TERRITORIES_OPEN = true`, Matthew's call, per DEPLOY-ROUNDS) |
| SX-18 (already ticked) | Inner line said Nearest neighbourhood "awaiting upload" | Both files it lives in have been uploaded in every batch since 2026-10-03 | Inner line reworded; box unchanged |
| SG-1 | "staging is two commits behind local, so re-bundle" | Staging carries `550a0b2`, verified 60/60 on 2026-10-05 (memory note, DEPLOY-ROUNDS-style verification recorded in `surge-site-rebuild.md`) | Dated update appended; **not ticked** — see NEEDS MATTHEW 3 |
| X-2a | "Needs Sixfold's Place ID or g.page review link" | Link supplied 2026-10-04 and live in `money.json` | Dated "Unblocked" note appended; not ticked (the QR family is still to generate) |
| **SX-3b (new)** | Brian Skelton's $400 job was in the repo (three commits on 2026-10-05) and on no list, with a signing deadline this week | commits `283e7b4`, `1928cd0`, `6f8ec2c`; the notes file | New open item after SX-3a with the dates, files, hold on the $100/month, and the notes' open flags |
| **SX-55 (new)** | The only ⏳ batch in DEPLOY-ROUNDS (Training + month-grid calendar) was not on the register | DEPLOY-ROUNDS top section; commits `a3d2c7f`, `7675ff2` | New open item after SX-54, with the upload order warning. Its last sentence lists the 2026-10-04/05 door-app batches that are live but were never registered (hail, roofs, company.json, Roofing preview, maps, sample door, the big build, Profile + materials, commercial test + showcase) — recorded there rather than as nine back-dated ticked items |
| Dated reminders | No rows for Brian | As SX-3b | Rows added for 9 Oct (sign by) and 15 Oct (job) |
| "Suggested order — refreshed 2026-10-01" | Lists SX-9e as cheap/open and SX-9d, SX-2b as partly done; all three are ticked above | Their own lines | One dated staleness paragraph under the heading; the lists themselves left as written |

## NEEDS MATTHEW (ranked)

1. **Eight `sixfold/site/` files are modified in the working tree and this review did not touch them**
   (`index.html`, `services/index.html`, `services/aeration`, `fire-mitigation`, `land-clearing`,
   `landscaping`, `sitemap.xml`, `who-pays/index.html`, all written 23:05 on 2026-10-05). They belong to
   the parallel overnight Sixfold-site review, whose report is `reviews/2026-10-06/sixfold-site.md`.
   Read that before committing anything, so TASKS.md and those edits go in as separate commits.
2. **Kara — did she sign?** SX-3a says Wednesday 7 October is the last safe day for the 12 October start.
   Nothing in the repo records a signature or a certificate of completion. Also still to do from the
   DocuSign sheet: write the 2026-10-01 spoken notice into the job file with its date, and re-check
   pages 4–5 for stray tags if the document was swapped rather than a tag deleted.
3. **SG-1 — are "Brandon's and Lance's evaluations" the office's staging review document dated
   2026-09-29?** If yes, SG-1 is done apart from Brandon's out-the-mud wording and your own walkthrough,
   and can be ticked. If their notes are something separate, it is still blocked on them. I could not
   tell from the files.
4. **The 3 October reminder (SX-1b(2): PPE counts and sizes from Brandon and Brad) has passed** with
   nothing recorded. Did anything come back?
5. **Phone alerts: did a test push reach your iPhone?** The door-app note records that you found the
   Alerts row on 2026-10-05 but not whether a push arrived. Related and still open: `push-vapid.json`
   (the alerts key), `push-subscriptions.json`, `calendar.log`, `goals-people.json`, `training.json`,
   `roof-settings.json` and the avatars folder are server-made and in **no backup**. Downloading the key
   once via File Manager was suggested; whether it happened is not on record.
6. **SX-55 — the Training + calendar upload is the one batch waiting.** Order matters (`rounds.php` and
   `index.html` before `training.json`), and `training.json` replaces every live lesson — the live list
   was empty on 2026-10-05, so that is safe today and may not be later.
7. **The Surge "Call Us" button on live surgeftw.com still dials the wrong number** (`tel:7193157742`).
   Unchanged since 2026-09-20 because live is still WordPress; it stays wrong until launch. DEPLOY.md
   launch step 3 asks you to confirm 720-719-5495 before the go.
8. **SX-38..47 summary line** is still open as a bundle; SX-43 (yearly fuel-overgrowth check) has no line
   of its own and no commit I could find. SX-42 (first run May 2027), SX-46 (DNC registration, Sixfold's
   to do) and SX-47 (El Paso and Douglas CWPPs) are genuinely open. Nothing changed there.
9. **`surge-wordpress-backup.md`** still says the SiteGround restore from the July-2026 `.wpress` is
   "pending, waiting on Matthew (2026-09-04)". The note says not to probe the live site unasked, so I
   did not. If the restore happened, the note wants a one-line close; if the site is about to be
   replaced anyway, it does not matter.
10. **Three ticked TASKS lines carry contradictory wording inside them** — SX-19 ("LIVE … AWAITING UPLOAD
    of the 12 door files" in the same header), SX-28 ("LIVE … awaiting upload") and SX-14 ("awaiting
    upload … Ticks when it is live"). The boxes and the first clause are right; the tails are the
    original text. Left alone because the register's rule is to keep the lines; say the word and I will
    trim them.

## NOT CHECKED

- Anything on a live host. No request went to sixfoldcolorado.com, surgeftw.com or staging; "LIVE" above
  means what DEPLOY-ROUNDS.md / the memory notes record as verified, not a fresh probe.
- The artifact "The Working Register" and its `tasks` database — not read, not written. The TASKS.md
  changes above are the list to mirror.
- `sixfold-private/`, `assessor/raw/`, the owner CSVs, `commercial/out/`, secrets — not opened.
- Substance of the long notes (`surge-site-rebuild.md` 116 KB, `sixfold-rounds-app.md` 37 KB,
  `sixfold-site.md`, `sixfold-printed-items.md`, `personal-tacoma-deal.md`): the RESUME HERE / status
  blocks at the top were read against the repo; the dated history below them was not re-verified line
  by line.
- Preference and feedback notes (`matthew-*`, `own-my-refusals`, `state-sources-unprompted`,
  `tools-open-empty`, `accepted-gaps-stop-flagging`, `low-usage-day-playbook`): read for dead paths
  only; none found; not edited.
- Whether the P-1 Tacoma document or the Stringline items moved — no commits under `personal/` or
  `matthew/` since 2026-10-01, so the register lines were taken as current.
- The checker's remaining "path not found" hits are false positives (regex fragments, URL paths, Desktop
  SURGE folder contents, scratchpad files, pre-reorg paths inside dated history) and were left alone.
