# rebuild-brief/ — two documents about the site rebuild

Built 2026-09-20, for circulating to the team and to Matthew's boss.

| File | Who it is for |
|---|---|
| [rebuild-brief.pdf](rebuild-brief.pdf) — 4 pages | The team and the boss. Before/after with screenshots: what the live site says, what the new one says, and why. |
| [seo-explained.pdf](seo-explained.pdf) — 3 pages | **The boss specifically.** Explains the search work in plain terms — what was done, what was deliberately not done, and what to expect. No jargon, no promises. |

**Rebuild after any edit:**

```
node build.mjs      # inlines _doc.css into each .src.html -> .html
node print.mjs      # .html -> .pdf, and CHECKS pages == sheets
```

`print.mjs` prints `** MISMATCH **` if a sheet has spilled onto a second page.
That is the check — do not skip it.

## Why print.mjs and not shared/tools/Print-Pdf.mjs

The shared printer injects its own header and footer and passes explicit page
margins. Both fight these documents: they carry their own `.foot-note` with the
page number, and the injected margins override the `@page` rule the sheets are
sized against. Using it produced 7 pages from 4 sheets and 5 from 3.

## ⚑ Measuring a sheet: two traps, both of which cost a pass here

1. **Measure at the print column width, not the paper width.** The page is
   8.5in but the text column is 8.5 − 1.4 = **7.1in / 682px**. Measuring at
   816px gives a wider column, fewer wrapped lines, and every sheet reads
   shorter than it prints.
2. **`.foot-note` is `position:absolute` on screen and `static` in print**, so
   in print it *adds* its height to the sheet. A screen measurement has it out
   of flow and reads ~30px light per page.

Both were wrong at first, which is why the first PDF came out at 7 pages while
the measurement insisted everything fitted. `print.mjs`'s page-count assertion
is the check that cannot be fooled by either.

## Sources

Everything in both documents was measured on 2026-09-20 from the live
surgeftw.com and from the build in `../build/`, not carried from notes.
Screenshots in `img/` are unretouched full-page captures at 1280px, cropped to
the top of each page and scaled to 820px wide.

**The live-site figures will go stale the moment the new site is uploaded** —
at that point these documents become a record of the change rather than a
description of the present, and the tense should be checked before reusing them.

## ⚑ One finding in here that is not about the rebuild

The **"Call Us" button on the live homepage dials `tel:7193157742`**, which is
not Surge's number, while the same page displays the correct 720 number. Found
while gathering the before/after material. It is fixable in WordPress in a
minute and does not need to wait for the launch.
