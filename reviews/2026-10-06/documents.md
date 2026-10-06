# Documents written 2026-10-05 — overnight fact-check, 2026-10-06

**Scope:** (1) `sixfold/training/` (31 crew lessons, README, build script) against their stated sources, the primary law texts and the live app's code; (2) Brian Skelton's aeration packet (quote, agreement, DocuSign setup, notes, built PDF); (3) `door-app/operations/door-territory/commercial/README.md` and its four scripts. Nothing sent, uploaded or committed. `commercial/out/`, `assessor/raw/`, `sixfold-private/` and the owner CSVs were not opened. The only writes were to the training `.md` files, the training README and the regenerated `training.json`.

## Summary

The three sets of documents are in good order. The law citations the training and the packet rest on were read in primary text (LII for 16 CFR 429 and 47 CFR 64.1200; colorado.public.law for C.R.S. 6-1-105, 5-3-401 to 5-3-405, 9-1.5-102 and 9-1.5-103) and every one checks out: the 30-second rule, the oral notice, the seller-completed forms, the business-day definition (Sunday and federal holidays excluded), the three-year exposure, "no compensation for services performed", the ten-day refund, the 8 am to 9 pm calling hours, and 811's two business days. Columbus Day 2026 is Monday 12 October (OPM), so Brian's deadline table is right in every row and Friday 9 October is the last safe signing day for a 15 October start.

Five things in the training were wrong enough to fix, all small: two lessons told the crew to do things in the app that only an admin can do or that the app does not do (add a lead; show a Do Not Call "answer" for a looked-up number); one line repeated the 55/38/7 claim the README says was dropped; one line said the agreement contains words it does not ("no deposit is taken at signing"); and the Safety lesson stated as fact a first-aider and kit that its own source lists as not yet in place. Fixed, build rerun, 31 lessons, same counts per heading.

Brian's packet is internally consistent (every clause cross-reference resolves, dates match across quote, agreement, setup and notes, six pages as stated). Nothing to fix; two things to raise with Matthew before it goes out (whether mid-October seeding in Castle Rock is honest to sell, and one stale row in the notes' fact-check log). The commercial README's numbers all reconcile with the run logs and the storm-report cache; its one real inaccuracy is the opening line "Not in the app, nothing uploaded", which git history says is no longer true.

## FIXED

All in `sixfold/training/`; `node sixfold/training/build-training.mjs` rerun afterwards (31 lessons: door 4, sales 8, quote 4, phone 4, paper 4, safety 3, app 4).

### 1. `04-phones.md`, "Answering the phone" and "Where leads come in": "+ Add a lead" is admin-only

**Claim:** "Add them in the app with + Add a lead" (to whoever answers the phone) and "Phone calls, Nextdoor messages and referrals: add them by hand with + Add a lead."
**What was wrong:** `+ Add a lead` lives in the Pipeline, which `summit-de59ae83/index.html` and APP-GUIDE both make admin-only. A crew member following the lesson would look for a button that is not there.
**Source:** `door-app/site/summit-de59ae83/index.html` (Pipeline view, `drawPipe`, "Admin only"); APP-GUIDE "The office tools".
**Fix:** both lines now say an admin adds them in the Pipeline, and the phone lesson tells a non-admin to pass the five things to the office the same day.

### 2. `04-phones.md`, "Do Not Call: whose number is it?": the app does not give an answer for looked-up numbers

**Claim:** "We looked the number up ourselves: the app shows its Do Not Call answer. If it says do not call, don't."
**What was wrong:** for a number found with Look up number the app shows a warning, not an answer: `dncMark()` renders "Looked up, not given — check the Do Not Call lists before calling." Only a skip-traced number (BatchData, built but switched off) carries a provider verdict. A crew member reading "no answer shown" as "cleared" would cold-call an unchecked number.
**Source:** `index.html` `dncMark()`; APP-GUIDE "Sign-in, privacy and security" (phone numbers).
**Fix:** the lesson now says the app marks the number "looked up" and warns that it must clear the national and Colorado lists, that the app does not check them, and not to call until the office has.

### 3. `02-sales.md`, GIFTS "T: tone": the dropped 55/38/7 claim had survived in softer words

**Claim:** "Your body and your voice carry most of the message."
**What was wrong:** README point 6 says the 55/38/7 figure was dropped because it is a misreading of Mehrabian; this sentence is the same claim without the numbers.
**Source:** `sixfold/training/README.md` §What changed, item 6.
**Fix:** "The same words land differently said calm, warm and sure than said fast and loud."

### 4. `05-paperwork.md`, "Getting paid", and README point 4: the agreement does not say "no deposit is taken at signing"

**Claim:** "The agreement says no deposit is taken at signing."
**What was wrong:** neither aeration agreement (Kara's or Brian's) contains that sentence or the word "deposit"; they put a first payment on or before the first day of work. The blank tree-job template (`service-agreement.src.html`) still has a "Deposit, if any, paid today" box, so "the agreement" is not one thing.
**Source:** `sixfold/agreements/brian-aeration-agreement.src.html` §5 and clause 10; `kara-aeration-agreement.src.html`; `service-agreement.src.html` §5.
**Fix:** lesson and README now say the aeration agreements never use the word and take nothing at signing; README notes the template box.

### 5. `06-safety.md`, "First aid": stated as fact what the source says Sixfold does not yet have

**Claim:** "At least one person on every crew holds current first-aid training. A stocked first-aid kit is on the truck..."
**What was wrong:** `crew-safety-and-compliance.md` Part E item 4 lists "a designated, trained first-aider on each crew, and a real kit" as required and not in place (as of 2026-09-18).
**Fix:** reworded as rules ("Every crew must have...", "must be on the truck") with "if yours doesn't, say so before the job starts."

### 6. `README.md` fact-check log

Rows for the 30-second rule, oral notice and forms, business days, three years, 5-3-405(3), the emergency exception, 811, calling hours and the lead flow updated from "carried" / "general knowledge" to verified, with the primary text quoted and the date. Two rows added (looked-up numbers; No answer / Not now / no-soliciting behaviour, checked against `rounds.php` `MISS_REST_DAYS = 2` and `index.html`). A short "Review 2026-10-06" section lists the changes.

## RECOMMENDED / UNVERIFIED (ranked)

### Brian Skelton's packet (report only, not edited)

1. **Is a 15 October overseed in Castle Rock honest to sell?** The water research's own open item 5 ("whether 12 October is too late to seed at all... not researched") was raised for Kara's Colorado Springs job and applies at least as strongly to Brian's, three days later and in Castle Rock. The agreement disclaims germination, so the legal position is fine; the customer-satisfaction risk the research names ("we take money for seed that does not come up") is live. One line from Brandon on dormant seeding or a spring return would settle it. Not a document error.
2. **The notes' fact-check log has a stale row.** `brian-skelton-2026-10-05.notes.md` still logs "Castle Rock Water temporary irrigation exemption ... Used, conditional on the provider", but the same file's Revision section records that line was removed from the quote. The built PDF confirms it is gone. The row should read "removed 2026-10-05; goes in the in-person packet".
3. **Lost from Kara's sibling: the "who solicited whom" note.** Kara's agreement comment and notes carry a paragraph that the whole three-day analysis assumes Sixfold personally solicited the sale (C.R.S. 5-3-401 also needs a consumer credit sale), and to treat it as covered regardless because the downside is asymmetric. Brian's agreement comment drops it, and nothing records how Brian came to Sixfold. The conclusion (treat as covered) is the same either way, so nothing in the packet is wrong; the record is thinner.
4. **"At signing" versus "before sending" for the Notice of Cancellation dates.** Notes flag 5 says Brandon fills the dates "at signing" (the in-person division of labour); the DocuSign setup correctly says they must be on the page before Brian opens it. Both are right for their channel, but whoever sends should read the setup file, not the notes.
5. **Minor:** the setup's fact-check cites "16 CFR 429 / C.R.S. 5-3-401" for the business-day rule; the definition is in 16 CFR 429.0 and Colorado's statute does not define the term. Kara's setup file cites 429.1(b) for "the seller completes the forms"; the completing duty is 429.1(c) (b is the duty to furnish them in duplicate, ten-point bold). Neither affects the packet.
6. **Verified, for the record:** six pages (pypdf); quote p1, agreement pp2-6; dates on pages 1, 2, 3 and 4 as the setup says; clause cross-references 4, 7, 9, 10, 11 and sections 2 to 7 all resolve; clause list starts at 8 on page 3; the Notice text matches 16 CFR 429.1(b) wording; "ten business days" in §5 and clause 10 matches 429.1(g); $400 / $200 / $200 consistent across all five documents; descriptor "Lawn, Land & Fire" throughout. Deadline table re-derived: Mon 5 → Thu 8, Tue 6 → Fri 9, Wed 7 → Sat 10, Thu 8 → Tue 13 (Sunday and Columbus Day skipped), Fri 9 → Wed 14, Sat 10 → Thu 15 (too late). Columbus Day is on the FTC's own holiday list in 429.0, so it counts under both regimes.

### Training (judgement calls, not edited)

7. **The 811 promise on aeration jobs.** "Walking a lawn" tells the crew "we request utility locates through Colorado 811 before the job", which is what clause 4 of the aeration agreement promises. C.R.S. 9-1.5-102 excludes routine landscape maintenance no deeper than 4 inches by mechanical means from "excavation", so a core-aeration pass almost certainly does not require a locate. The promise is Sixfold's own; either the office actually files it for every aeration (and builds the two business days into the date) or the clause should be narrowed to stump grinding and digging. Flag for Brandon, not a training error.
8. **"Sixfold provides the protective gear."** True to the OSHA rule (1910.132(h), employer pays), and nothing in the safety guide says PPE is missing, but it is a promise to the crew that nobody in this repo has confirmed Sixfold keeps. Left as is.
9. **Contractor framing versus employer rules.** README point 5 rewrote "work 8 hours" because the crew are contractors; the Safety lessons then apply employer-only OSHA duties (PPE at no cost, hearing programme, OSHA reporting). The safety guide's own finding is that Colorado would presume these workers employees. Both are consistent with the guide; the tension is Sixfold's, already in `brandon-owns-these`. Noted, not changed.
10. **"We aren't licensed to apply them" (Quotes, pesticides).** Accurate and internal, but it is the one place the lessons use "licensed" about Sixfold. If a crew member repeats it at a door it sounds worse than "we don't apply pesticides." Wording preference.
11. **"Never say we'll beat someone's price, or quote a competitor's."** No source in the stated list; harmless and consistent with the no-price rule. Noted as unsourced.
12. **Emergency exception.** The lesson's three conditions are the federal ones (16 CFR 429.0(a)(3)); Colorado's 5-3-402(5) does not require that the customer made first contact but does require a substantial beginning of performance before any cancellation. Meeting all of them is the safe reading, which the lesson's "if you're talking someone into it, it isn't one" already produces. Logged in the README.
13. **Calling hours.** 47 CFR 64.1200(c)(1) verified. Its definition of "telephone solicitation" excludes calls made with prior express invitation, so a call-back to a form lead is not legally bound by 8 to 9; the lesson applies it as a house rule, which is fine. Logged.
14. **The live training list.** README says it was empty on 2026-10-05 and to check before each upload. Not checkable offline; the upload still replaces whatever is there.

### Commercial README and scripts (report only, not edited)

15. **"Test only. Not in the app, nothing uploaded." is stale.** `build-app-data.mjs` writes `com-<spot>.json`, hail/wind/NAIP files and three admin-only regions into `site/data/rounds/index.json`, and commits `e363611`, `cbe51f9`, `32b1fb5` and `ea560be` ("Commercial showcase live and verified") record them in the app and live. The README's run order also omits `build-app-data.mjs`. Worth a two-line update so the README matches what shipped.
16. **"Register matches must agree word for word" overstates the rule.** `compare()` in `resolve-owners.mjs` accepts prefix matches (COLO ~ COLORADO, ASSOC ~ ASSOCIATES, rated "abbreviated") and, for county names of 30+ characters, a truncated match where the county roll cut the name short. Only the refiling of long "person" names as companies requires an exact match, as the README says. The method is sound; the sentence should say "word for word or by a recognised abbreviation or truncation".
17. **"Churches, schools and exempt owners are left out" holds for the Denver spots, not fully for Springs.** The composite filter drops `church|school|religious|charitable|^exempt`; the El Paso pull keeps everything in twelve improvement classes including "SPECIAL PURPOSE", and `pull.log` shows "Partially Exempt Commercial" (12) kept in the south spot. Tier 5 (public) catches government owners afterwards; a church under "SPECIAL PURPOSE" would land in tier 3 or 4. Small, and the README could say "mostly left out".
18. **"About half of all buildings reach a named person."** Tier 1 + 2 = 2,369 of 5,082 = 47%. "About half" is fair; the memory note's 51% predates the same-day revision. The "1 in 5" (160 of 790 = 20%) is exact.
19. **Verified:** every number in the results table sums across rows and columns and matches `enrich.log`; the three "why this spot" counts were recomputed from `wind/cache/lsr-co-2020..2025.csv` and match exactly (Springs 24 days of 1-inch-plus within 6 km; Centennial 19 hail days and 15 wind-damage days within 15 km; Lakewood 5 days of 1.75-inch-plus and 16 wind-damage days within 15 km). The SoS dataset `4ykn-tg5h` exists on data.colorado.gov with the fields the script reads (entity status, type, jurisdiction of formation, agent first/last/organization name, principal address) and no member or manager fields, which supports "Colorado does not require LLC members or managers in the register" (not independently verified against SoS filing rules). Tier rules, the 25-entity professional-agent threshold, the c/o three-way split, the 10-mile / 50 mph wind rule, the 3x3 MESH window and the NAIP 2023 STAC source all match the code.
20. **Not verified:** the hail-day counts per building (would need `out/`), the statewide composite's and El Paso's paging behaviour (taken from the code comments), and the claim that Logan County publishes no land use.

## NOT CHECKED

- The built `training.json` on the live server, and whether the office has typed lessons there since 2026-10-05.
- Whether a first-aider, kit, extinguisher or PPE actually exist on Sixfold's truck; whether the office files 811 locates for aeration jobs.
- Brian's lot data in the notes (0.35 acres, about $740k) — would need `assessor/raw/`, which is off limits.
- Whether Castle Rock Water serves Starflower Ct (the notes already mark it unconfirmed, and the line is no longer in the packet).
- 29 CFR 1910 and 1904 texts: osha.gov and eCFR refused automated fetches; the safety lessons were checked against `crew-safety-and-compliance.md`, whose own log records first-party reads on 2026-09-16 and 2026-09-18.
- Colorado SoS filing rules (whether articles or periodic reports name members or managers) — only the open-data field list was checked.
- Anything in `commercial/out/`, the owner CSVs or `sixfold-private/`.
- `sixfold/site/*` and `TASKS.md` show as modified in `git status`; those are another review's changes (see `reviews/2026-10-06/sixfold-site.md`), not this one's.

## Files changed

- `sixfold/training/02-sales.md`
- `sixfold/training/04-phones.md`
- `sixfold/training/05-paperwork.md`
- `sixfold/training/06-safety.md`
- `sixfold/training/README.md`
- `door-app/site/data/rounds/training.json` (regenerated by the build; not uploaded)
- `reviews/2026-10-06/documents.md` (this report)

Not committed.
