# What things cost us — fillable cost-capture sheet

**`Sixfold-What-Things-Cost-FILLABLE.pdf`** — built by `build-cost-rates-pdf.mjs` (pdf-lib),
2026-09-15. The price companion to [`work-rates`](work-rates.md): same layout, same confidence idea,
but every answer is a dollar figure instead of a man-hour figure.

**3 pages, 135 fields** — 36 text, 99 checkboxes, 0 read-only, not encrypted. A real AcroForm:
Brandon or Brad opens it, fills it, sends it back. No account, no signal.

## The pair

| Sheet | Asks |
|---|---|
| `work-rates` | how long one of these takes — **man-hours** |
| **`cost-rates`** | **what we pay for a thing — dollars** |

Together they are the two halves of the cost-up model: `price = (man-hours × rate) + (job costs × 1.15)`.
Neither is per-job; both are filled in once, now. The per-job instrument is
[`job-closeout`](job-closeout.md).

## Confidence marks are different here, deliberately

Work-rates uses **T / D / G** — timed it, done it often, best guess.
This one uses **R / M / G** — **have a receipt**, from memory, best guess.

*Having a receipt* is the distinction that matters for money, and it is precisely what was missing
when the haul rate turned out to be built on a **homeowner** tip fee Sixfold cannot use. A figure
marked R can go straight into the engine; an M or G ships badged as an estimate.

## Scope — what is deliberately not on it

**Job-attributable costs only.** Per Matthew, 2026-09-15: *"I dont need the information in regards to
the financial structure of the company."* So **no wages, no payroll burden, no employee-vs-1099, no
insurance, phone, software, rent or vehicle payments.** Those answer *what is our margin*, not *what
does this job cost*, and including them makes the sheet read as an audit — which costs answers on the
part that is actually needed.

**Nothing we charge.** Same rule as every sheet in this family: costs come back, the price goes out
in writing.

## The seven sections

1. **Dumping and disposal** — first on purpose. It is the line currently losing money, and the only
   one with a receipt already contradicting the rate card. Includes the question that broke it:
   **which yards take commercial haulers, not just homeowners.**
2. **Fuel and fluids** — gas, diesel, two-stroke mix, bar and chain oil, truck per round trip.
3. **Saws and cutting** — chains, sharpenings, chains burned per job, bars, sprocket/filter/plug,
   grinder teeth.
4. **Mowing, trimming and planting** — blades, trimmer line, mulch, topsoil, shrubs, fertiliser.
   Exists because job 2 was mostly landscaping and none of it is priced anywhere.
5. **Machines — own or rent?** — chipper, grinder, trailer, skid steer, lift, mower, plus the
   delivery fee that rental quotes usually leave out.
6. **Safety gear** — chaps, helmet, gloves, boots, straps. Periodic rather than per-job, but real.
7. **Notes** — anything bought or hired that is not listed, and anything here that varies a lot.

## Build notes

**The bottom-margin guard earned its keep.** Page 3 overflowed by 27pt on the first build and the
guard threw rather than silently dropping the footer off the page. Space came out of the furniture
— section heading gap and the notes box — never out of the row pitch.

**Answer fields are 9.5pt, not 11.** Several rows want a short phrase rather than a number
("Only the Monument yard", "Rented, $210/day") and at 11pt those clip at rest. The value is never
lost — the field scrolls — but a form you cannot read back is a form people distrust.

**Verified** the way [[fillable-pdf-forms]] requires: filled programmatically, no missing fields, not
encrypted, 0 read-only, and screenshotted through Chrome's PDF viewer with
`node tools/pdf-screenshot.mjs`. Every field renders and the R/M/G ticks land in the right columns.
**Do not verify a form with `pdf-contact-sheet.py`** — pypdfium2 does not draw widget annotations and
renders a working form completely blank.

## Still open

- **No paper version.** `work-rates` has one; this does not. Easy to add if it wants to live on a
  shop wall, but this sheet is filled at a desk with receipts to hand, so the fillable is the
  natural form.
- **Not tested on a real handset** — same caveat as every fillable here. The traps are in
  [[fillable-pdf-forms]]: email-preview panes lose the values, iOS Markup can flatten instead of
  saving, and Android's built-in Drive/Gmail viewer cannot fill forms at all.
- **Page 2 has 138pt of slack and page 3 has 25.** Moving section 6 up would need it split across a
  page break, which is worse than the white space.
