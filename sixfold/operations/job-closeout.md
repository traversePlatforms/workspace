# Job close-out sheet

**What it is.** The sibling to [`quote-walk-sheet`](quote-walk-sheet.md). The walk sheet goes out
before the job; this one comes back after it. Built 2026-09-15 at Matthew's direction, **ahead of
finishing the quote generator** — his call, and the right one: every job worked between now and the
generator being finished produces data that would otherwise be lost, and this form replaces the
"please stopwatch some tasks" favour with a routine that looks like the sheet the crew already uses.

Source: `job-closeout.src.html` → `node build.mjs` → `job-closeout.html` → `node ../tools/html-to-pdf.mjs job-closeout` → `job-closeout.pdf`.
**Edit the `.src.html`, never the generated `.html`.**

## Why the rows are what they are

**Deliberately the same rows, in the same order, as the walk sheet.** The whole value is the
comparison — quoted against actual, line by line. A crew that has filled in a walk sheet can fill
this in without reading it.

Two things the walk sheet does not carry, both added here:

- **Man-hours per line.** This is the point of the document. The walk sheet counts trees; nothing
  anywhere converts a count into hours, and that conversion is the largest remaining source of error
  in the quote. Every row therefore has two answer columns: how many, and how long.
- **A mowing / edging / beds / planting row.** Job 2 was mostly landscaping and **none of it appears
  on the walk sheet**, so that work is currently quoted on instinct with nothing behind it. Capturing
  it here starts the record even before the walk sheet gains matching rows.

The total man-hours strip sits above both tables because it is the one number nothing else on the
sheet can reconstruct, and because it cross-checks the per-line hours: they should roughly sum to it.

Section 3 is the ruled notes box, per the field-sheet register — everything that does not feed a
number goes there rather than earning its own row.

## Fit — measured, not eyeballed

**It spilled to two pages on the first render.** The space came back out of the furniture, never out
of the writing gap: the hours strip tightened (line-height 2.1 → 1.85), the notes box lost a ruled
line and some padding, and a standing "fill this in the day the job ends" paragraph was folded into
the hours strip. **Rows stay writable; chrome gives way.** The 7pt writing gap is inherited from the
walk sheet's 2026-09-14 measurement and was not touched.

## ⚑ The defect caught on the contact sheet

The first one-page render looked fine by page count and was wrong on the page. **The two answer
cells fused into one continuous rule**, so the sheet offered a single long line where it wanted two
numbers — nobody filling it in would know there were two things to write.

Cause: the walk sheet sets `padding-right: 0` on its answer cell *so that its single writing line
spans the column exactly*. Inherit that with two answer columns and it is precisely what welds them
together. Fixed by giving the first answer cell a 12pt right pad and leaving the last at zero.

**This is the second time this document family has shipped a writing-line defect that a page count
could not catch** — the first was the 2026-09-14 misaligned rules on the walk sheet. Render the
contact sheet and *look* at it; see [[print-fill-in-geometry]].

## Still open

- **No fillable companion yet.** The walk sheet has one (`quote-walk-sheet.artifact.html`), and the
  paper sheet was approved first last time. Offered, not built.
- **The "quoted" column.** Once the generator is finished it can pre-fill what was quoted next to
  each row, so the crew only writes the actual. That turns this from a capture form into a closed
  loop. Deliberately not built in yet — the sheet has to work standalone first.
- **The walk sheet still has no 15 ft height band**, which is the Colorado Springs licence trigger,
  and no landscaping rows. Both are changes to that sheet, not this one.
