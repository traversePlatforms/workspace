# Team share — the Google Drive folder

**Built:** 2026-09-18, at Matthew's request — a Drive folder the crew can open
themselves instead of asking him for a file.

**Audience:** the Sixfold crew and team. Not customers, not Surge.

```
node sixfold/team-share/build-team-share.mjs
```

builds `files/`, then drag its contents into the Drive folder. **Re-run it after any
PDF rebuild** — that is the whole reason it is a script and not a one-off copy. A
hand-made copy in a share folder becomes the stale one everybody reads, silently.

`files/` is **gitignored**: 5.4 MB of pure copies, rebuilt in a second, and the
originals are already versioned. The generator and `index-sheet.html` are the real
artefacts here.

**Nothing was moved.** Every file exists in both places, as asked.

---

## What is in it

**31 files, eight numbered folders**, plus a two-page index that sorts to the top.
(Was 25 in eight; **2026-09-28 added the two short lawn forms to 07 and a new 09.**)

| | |
|---|---|
| `00 START HERE` | The index. **Page 2 is the one that matters** — see below. |
| `01 What we do` | Services Sheet D — the no-prices answer to "what do you do" |
| `02 Safety and compliance` | Crew safety & compliance, gear checklist, shirt spec |
| `03 Forms for a job` | Walk sheet (screen + print), close-out sheet, the two cost/time capture sheets, the door crib sheet |
| `04 Hand to the customer` | Pamphlet, funding sheet, referral packet template, Sheet D |
| `05 Talking about money` | Tax credit notebook + client forms, the script kit |
| `06 Look it up` | Debris disposal directory, mitigation funding directory |
| `07 Agreements` | The two five-page agreements + tablet version + two crib sheets, **and the two short lawn forms (job sheet, monthly)** |
| `08 Events` | Event sign-up sheet |
| `09 Pick the look` | **New.** Card and magnet proofs, and the season-colour study — the things the crew is being asked to choose between |

**⚑ 09 carries PROOFS, never print files.** The print-ready card and magnet PDFs stay
out, so nobody can order straight from the share. Nothing in it is ordered and the
descriptor on it still needs Brandon.

**⚑ Two things in here are now out of step with the aeration-led direction**, and both
ship as they are because fixing them is a copy job and not a share job:

- **Services Sheet D leads with fire mitigation** and it is the front-of-house sheet, in
  folders 01 and 04.
- **The index sheet's own lockup is the ember mark reading `LAND & FIRE · COLORADO`** —
  deliberately left alone, because folder 09 is asking the crew to choose between exactly
  that and the green one. Changing it would pre-empt the question.

Names are rewritten for a person browsing Drive — `Sixfold-Services-Sheet-D.pdf`
becomes `What Sixfold does - services, no prices.pdf`. The mapping is the `FILES`
table in the generator.

## The index sheet

`index-sheet.html` → `index-sheet.pdf` via `node tools/html-to-pdf.mjs index-sheet`.
Two pages **by content, not overflow**: page 1 is what is in the folder and when you
would reach for each thing; **page 2 is what is deliberately not in it and why.**

Page 2 exists because the dangerous failure here is not a missing file — it is
someone finding a file they should not use. It carries two warnings in a box:

1. **The blank service agreement is not in the folder and must not be printed from
   anywhere else.** Both copies still carry the Englewood address as the seller's
   place of business, including on the Notice of Cancellation. Under 16 CFR 429 and
   C.R.S. 5-3-401 a defective notice leaves the job cancellable for **three years**
   with no payment for work done. Blocked until the Monument street address exists,
   and **must not be part-changed**.
2. **There is no launch offer.** Two were drawn up, neither picked, no minimum job
   size behind either. Nobody should be quoting a percentage.

---

## What was corrected before anything was copied

All 60 PDFs in the workspace were text-extracted and checked for the old phone
number, the Englewood address, the Surge email address and the superseded domain.
Three documents were genuinely stale and were fixed **at source**, then rebuilt:

| Document | Was | Now |
|---|---|---|
| `marketing/funding-one-pager` | Printed `m.sharpe@surgeftw.com` — a **Surge** address on a Sixfold customer handout | `Contact@SixfoldColorado.com` |
| `marketing/funding-one-pager` | *"Thinning woody vegetation qualifies explicitly. That is the core of this work."* | **Overstated, and logged as an open correction in `sixfold/README.md` since 2026-08-26.** Thinning was already qualifying under C.R.S. 39-22-543(2)(d); HB26-1289 adds a narrower beetle-kill category. Rewritten, and the current-year income limit ($129,200 FTI for 2025) added — stating only the 2027 figure reads as a promise to someone the credit does not reach, which is the fault the pamphlet audit corrected as its item 4 |
| `marketing/launch-flyers` | Surge email in the fine print on both flyers, and a fix-list item recommending `sixfoldland.com` | Sixfold email; fix-list item rewritten — that domain was superseded on 2026-08-21 |
| `agreements/field-instructions` | Header read `Land & Fire · Englewood, CO` | `Land & Fire · Colorado`, the settled descriptor. **Cosmetic header only** — this file carries no legal seller address, which is why it was safe to change and the agreements were not |

**The one-pager went to two pages** when the corrections were added, which defeats a
one-pager. Tightened back to one and re-checked by counting, not by eye.

### Checked and correctly left alone

- **Six "licensed and insured" hits** across the ad kit, flyers, marketing plan,
  minimum-viable-start, platform sheet and tax notebook are all **prohibitions** —
  instructions *not* to say it. No claim anywhere.
- **`research/Sixfold-Crew-Safety-and-Compliance`** names Englewood as the **OSHA Area
  Office**. Nothing to do with Sixfold's address.
- **`marketing/marketing-plan`** describes the Secretary of State record as still
  showing Englewood. That is accurate, not stale.
- **The script kit's `sixfoldland.com` mention** is itself the correction notice —
  *"that name is superseded and must not be used."*
- **Four files carry no phone number**: crew safety, both directories, the script kit.
  All internal reference documents that do not need one.

### Still stale, and deliberately so

The two Sedalia agreement PDFs still carry **(720) 772-6146**. Rebuilding the fillable
one loses 30 form fields and the DocuSign one has no generator — see
`agreements/README.md`. They are excluded from the share folder as customer files
anyway, so the old number reaches nobody through it.

---

## Adding or removing a file

Edit the `FILES` table in the generator and re-run. The build **deletes and rebuilds**
`files/`, so removing a row actually removes the copy rather than leaving it behind.

If you add something, add it to page 1 of `index-sheet.html` too, and rebuild the
index — an unlisted file in a folder with an index reads as a file nobody meant to
include.

**The `EXCLUDED` table at the foot of the generator is the important half.** It is the
reasoning for every file a crew member might expect to find and won't. Read it before
adding anything back.
