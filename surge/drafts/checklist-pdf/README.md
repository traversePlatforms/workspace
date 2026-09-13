# checklist-pdf — fillable PDF generator

Builds the two fillable PDFs from one shared content file:

| Output (in `drafts/`) | From |
|---|---|
| `charity-partner-quick-screen-fillable.pdf` | the short checklist |
| `charity-partner-standards-review-fillable.pdf` | the detailed checklist |

Both carry real AcroForm fields — text fields, checkboxes and radio groups — so
they can be filled in and **saved** in any PDF reader on phone, tablet or
computer. Standard Helvetica, no embedded fonts, for the widest mobile-reader
support. `NeedAppearances` is set so mobile viewers regenerate the field visuals.

```
node build.mjs
```

## Keeping it in sync

`content.mjs` holds every criterion's wording and mirrors the two HTML checklists
(`drafts/charity-partner-standards-review.html` and `-quick-screen.html`). **If the
HTML wording changes, edit `content.mjs` to match and re-run `build.mjs`.** The
layout engine is in `build.mjs`; nothing else needs touching for a text edit.

## Saving a completed form (put this in front of whoever fills it)

- **iPhone / iPad** — open in Files or Books, fill, then Share → *Save to Files*.
- **Android** — open in Adobe Acrobat or a PDF editor, fill, then *Save a copy*.
- **Desktop** — Acrobat/Reader, Preview, or a browser's PDF viewer: fill, then
  *Save As* / download.
- **Google Drive preview is read-only** — download the file and open it in a PDF
  editor first.
