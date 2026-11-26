# Traverse PDF kit

Matthew, 26 Nov 2026: "Make most of our pdf branded with traverse." This is the default look for PDFs from now on. The exceptions are Surge copy, which uses Surge's own brand, and Sixfold or 365 customer pieces, which use Sixfold's.

- `traverse-pdf.css`: fonts, colours (navy #13294b, flag #d6400c), the navy top band, headings with the flag bar, tables, callouts and numbered steps.
- `fonts/`: Familjen Grotesk 500/700 (headings) and Atkinson Hyperlegible 400/400i/700 (text), from Google Fonts (OFL).
- `traverse-mark-reverse.svg` / `traverse-mark-color.svg`: copies of traverse/brand/project/assets/Logos.

Print with `node shared/tools/traverse-pdf.mjs page.html [out.pdf]`. The script inlines the CSS and fonts, so the page itself carries only its content.

## Skeleton

```html
<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Title</title></head><body>
<header class="tv-top">
  <div><div class="tv-brand"><tv-mark></tv-mark><span class="tv-wm">Traverse</span></div>
    <div class="tv-kicker">Small label</div><h1>The title</h1></div>
  <div class="tv-meta"><b>For whom</b>Date or context</div>
</header><div class="tv-bar"></div>
<div class="tv-callout"><div class="tv-label">Bottom line</div>...</div>
<h2>Section</h2>
<ol class="tv-steps"><li><b>Item name</b>One-line description.</li></ol>
<div class="tv-foot"><span>left</span><span>right</span></div>
</body></html>
```

Classes: `tv-callout` + `tv-label`, `tv-warn`, `tv-steps` (navy numbered discs, with the first `<b>` as the item title), `tv-foot`. Plain `h2`, `table`, `ul` are styled already.
