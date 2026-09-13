# tools/ — PDF export

Two scripts. One turns the project's HTML documents into PDFs; the other turns a
PDF back into an image so the result can actually be checked.

Added 2026-08-26, when nine documents were wanted as downloads in Google Drive.

## Build the PDFs

```
node tools/html-to-pdf.mjs             # every document in the job list
node tools/html-to-pdf.mjs ridge-mark  # just the ones whose name matches
```

Prints through headless Chrome over CDP. Ten documents, each written as a
`.pdf` beside its source `.html`:

| Document | Mode | Pages |
|---|---|---|
| `marketing/Sixfold-Ad-Script-Kit.pdf` | light | 11 |
| `brand/social/review.pdf` | dark | 3 |
| `brand/ridge-lineage.pdf` | light | 4 |
| `brand/ridge-mark.pdf` | light | 3 |
| `marketing/funding-one-pager.pdf` | light | **1** |
| `marketing/launch-flyers.pdf` | light | 4 |
| `marketing/marketing-plan.pdf` | light | 16 |
| `marketing/minimum-viable-start.pdf` | light | 8 |
| `marketing/platform-sheet.pdf` | light | 7 |
| `research/logo-prior-use-screen.pdf` | light | 4 |

**The sources are mostly not edited.** Everything print-specific is injected at
render time, so these stay screen documents that happen to print, and no page
grows print furniture it does not use anywhere else. The one exception is the ad
script kit, which was written to be printed and carries its own `@media print`
block — including the grid-collapse fix below, applied pre-emptively to every
grid list on the page.

## Why the colour scheme is a per-document choice

Every document here is dark-first, and most define light tokens under
`prefers-color-scheme: light`. Those print light — ink on paper, which is what
the rest of the Sixfold print family does, and what someone downloading a sheet
from Drive will expect.

`brand/social/review.html` has **no light palette at all**. It is bone text on
pine, and it exists to show profile marks and banners on the ground they will
actually sit on. It prints dark, and backgrounds have to print or it comes out
as a blank page — which is why `printBackground` is on for everything.

## The two documents that needed a fix

Both are recorded on their entries in the job list, and both were found by
looking at the render, not by reading the source.

- **`funding-one-pager`** carries its own `@page` rule and an 8.5in sheet. At the
  default scale its footer disclaimer spilled onto a second page, which defeats
  the point of a one-pager. It builds at `scale: 0.76` and is **verified at one
  page by counting, not by eye**.
- **`logo-prior-use-screen`** lays its numbered next-steps list out as a CSS grid
  (`ol.next li`). A grid item that lands on a page boundary **collapses its `1fr`
  column to one word per line** in Chrome's print layout — the last two pages
  came out as a ribbon of single words. It is blocked out for print instead.

## Look at the result

```
python tools/pdf-contact-sheet.py marketing/marketing-plan.pdf out.png --cols=8 --scale=0.5
```

Rasterises every page and tiles them into one PNG. `pypdfium2` and Pillow are
already installed in the Python 3.12 at
`%LOCALAPPDATA%\Programs\Python\Python312\python.exe`; **poppler is not
installed and `pdftoppm` does not exist on this machine**, so the usual
`pdf2image` route is not available.

## After editing any source

Re-run the builder and **count the pages**. Screen height does not predict page
fit — that lesson is already written into `agreements/`, `operations/` and the
wildfire pamphlet, and it cost the pamphlet a silent four-page build.
