# What the work takes — baseline rates sheet

**Filled in once, now.** The third sheet in the family and the one that unblocks the quote
generator today.

| Sheet | When | Unit |
|---|---|---|
| [`quote-walk-sheet`](quote-walk-sheet.md) | before a job | this property |
| **`work-rates`** | **once, now** | **one of these, typically** |
| [`job-closeout`](job-closeout.md) | after each job | this job, actual |

Built 2026-09-15 after Matthew read the close-out and said *"it reads for after a job is done, I want
to get data now. We can cross reference as jobs go on."* He was right and the close-out was the wrong
instrument for that need — it is per-job and backward-looking. This one asks the crew what a piece of
work **typically** takes, so the generator can stop running on estimates immediately; the close-outs
then correct it job by job.

Source: `work-rates.src.html` → `node build.mjs` → `work-rates.html` → `node ../tools/html-to-pdf.mjs work-rates` → `work-rates.pdf`.

## The confidence column is the point, as much as the numbers are

Every row carries **T / D / G** — timed it · done it often · best guess.

This is not decoration. The quote engine already badges its rates by how well-supported they are,
and this maps straight onto that: a G-marked figure ships flagged as an estimate, a T-marked one
ships as solid. **A number with no confidence attached is exactly what produced the pricing
rebuild** — `pricing-guide.md` reads as reconciled and sourced throughout, and four of its rates
turned out not to be.

It also makes the sheet answerable. Without the column, someone who has never timed a stump grind
either leaves it blank or invents a figure that then reads as fact. With it, a rough number is a
legitimate answer.

## Section 3 exists because of a real gap

**Landscaping — mow, trim and edge, beds, planting.** Job 2 was mostly this work and **none of it
appears on the walk sheet or in any rate anywhere**, so it is currently quoted on instinct. The
heading says so on the sheet deliberately; the crew will know it is true and it explains why they
are being asked.

## Section 4 covers the two multipliers nothing else captures

- **Coming down over a roof, fence, line or drive.** The walk sheet already *counts* these, which
  means someone knew it mattered — but there is no factor behind the count, so a hazardous fell
  currently prices identically to an open-field one. **This is the single largest remaining source
  of error in the quote.**
- **Bad access** — long drag to the truck, steep slope. Named in the field-sheet register as
  notes-box material for the walk sheet, which is right for one property; as a general multiplier it
  needs a number.

The small unit costs sit here too rather than in their own section — the walk sheet and close-out
already capture rentals and dump fees per job, so the only gaps are consumables.

## Fit

One page, first render, no trimming needed. One correction after looking at the contact sheet: the
label column was 3.15in and left roughly half the sheet empty, with everything bunched left. Widened
to 4.25in. **Answer cells keep a 12pt right pad** so the writing line cannot fuse with the
confidence boxes — that fusion is the defect `job-closeout` shipped on its first render, and this
sheet was built with the guard already in place.

## Fillable version — `Sixfold-What-The-Work-Takes-FILLABLE.pdf`

Built by `build-work-rates-pdf.mjs` (pdf-lib), following `build-walk-form-pdf.mjs`. **2 pages,
87 fields** — 24 text, 63 checkboxes, 0 read-only, not encrypted. A real AcroForm, so it fills and
saves with no account and no signal: Brad opens it, fills it, sends it back.

**Deliberately not a copy of the paper sheet.** The leading tick box per row is dropped — on paper it
marks "covered this", but in a form an empty field already says that, and keeping it would have been
a third of the taps on the sheet for no information. Row pitch is 30pt and fields 22pt, sized for a
fingertip rather than a pen.

**Two files now carry these rows** — `work-rates.src.html` and `build-work-rates-pdf.mjs` — and they
are hand-kept in step. A row added, dropped or reordered has to change in both.

### ⚑ The verification trap, and the tool built for it

**`pdf-contact-sheet.py` renders this form completely blank.** No field boxes, no ticks, none of the
typed values — the labels appear and nothing else. That is **pypdfium2 not drawing widget
annotations**, not a defect in the file: a structural probe found all 87 widgets present, all 87
carrying appearance streams, none zero-sized, and the shape identical to the walk-sheet form already
in field use.

**Use `pdf-contact-sheet.py` for print layout. Never use it to check a form** — it will tell you a
working form is broken.

The check that does work is Chrome's own PDF viewer, and it now has a tool:
`node tools/pdf-screenshot.mjs <file.pdf> <out.png> [--page=N]`. Verified this form through it —
every field renders, typed values appear, and the T/D/G ticks land in the right columns.

## Still open

- **Not tested on a real handset.** The file and its rendering were checked here; no iPhone or
  Android was involved. Worth one dry run before Brad relies on it. The known traps are in
  [[fillable-pdf-forms]]: filling inside an email preview silently loses the values, iOS Markup can
  flatten instead of saving, and Android's built-in Drive/Gmail viewer cannot fill forms at all
  (Acrobat Reader can). The sheet's footer carries the save-it-first warning.
- **Who fills it in.** Brad and Brandon at minimum; anyone else who swings a saw should get one
  too, and disagreement between two people's answers is information rather than a problem.
- Once returned, the numbers go into the quote engine and every G-marked row stays badged as an
  estimate until a close-out replaces it.
