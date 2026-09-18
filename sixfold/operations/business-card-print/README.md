# Business card — print file for FedEx Office

**Built:** 2026-09-18. **Order:** 100 cards, option **A · Pine** (the house card), front
arrangement 2 ("both below"), under **Brandon Long**.

## Upload this

**`Sixfold-Business-Card-Brandon-Long-FedEx.pdf`** — two pages, page 1 front, page 2 back.
This is the file to give FedEx. PDF is their preferred format, and it is vector, so it
prints as sharp as their press allows.

Fallback if their uploader wants images: the two PNGs, `…-FRONT-300dpi.png` and
`…-BACK-300dpi.png`, each **1125 × 675 px = 3.75 × 2.25 in at 300 dpi**. Upload front and
back as two separate files.

## What FedEx asks for, and what this file is

Checked against office.fedex.com on 2026-09-18:

| FedEx wants | This file |
|---|---|
| 3.75 × 2.25 in — the 3.5 × 2 trim plus 0.125 in bleed all round | **3.750 × 2.250 in**, measured from the PDF, both pages |
| Design extends to the bleed edge | Pine ground fills the whole page |
| Nothing important within 0.125 in of the trim | Content is inset **0.22 in from the trim** (0.345 from the page edge) — the proof's own pad, kept |
| 300 dpi or better | PDF is vector; PNGs are exactly 300 dpi |
| Two pages or two files for double-sided | Two-page PDF, or the two PNGs |

## When ordering

- **Colour:** the files are RGB hex brand values. FedEx converts to CMYK; Ember will come
  back a touch duller and browner than on screen. That is normal and not a file fault.
  Same note as the vehicle magnets.
- **Stock:** the design is a solid dark ground with fine light type. **Choose a smooth or
  matte stock, not linen or textured** — texture breaks up 5–6 pt light-on-dark lettering.
  If they offer a coating, matte or soft-touch; gloss on a dark card shows fingerprints.
- **Do not let their template add anything.** No border, no badge, no "designed with"
  line. The proof in `../business-cards.html` says the same.
- **Check the proof they show you** for two things: the Ridge mark's roots are visible
  (they are 1–1.6 pt strokes and are the first thing a low-res preview drops), and the
  ember URL on the back is legible. If either looks wrong in their preview, it is their
  preview, not the file — but ask before approving.

## What is on it

**Front:** Ridge mark · *Sixfold* · LAND & FIRE · COLORADO.
**Back:** Brandon Long · Owner · (303) 915-1045 · Contact@SixfoldColorado.com ·
SixfoldColorado.com (ember) · FIRE MITIGATION · LAND CLEARING · LANDSCAPING.

Matthew's instruction: Brandon's name, the shared Contact@ email (not a personal one),
website and phone unchanged. **"Owner" is the title from the proof** — it was marked as a
placeholder there, so confirm it is what Brandon wants printed before ordering.

**The lockup reads *Sixfold / Land & Fire · Colorado*, not *Sixfold Colorado*.** That is
deliberate: the site says "Sixfold Colorado" as the customer-facing name; print carries
the mark. Recorded in `sixfold/site/README.md` under the 2026-09-18 review.

## Rebuilding

Edit `card-a-pine-brandon.html`, then from `sixfold/`:

```
node tools/html-to-pdf.mjs FedEx
```

The PNGs come from a CDP screenshot at deviceScaleFactor 3.125 (96 → 300 dpi) in print
media — `build-png.mjs` in this folder, run with the page URL and two output paths. **`scale: 1` on the JOBS entry must stay** — the tool defaults to 0.8, which
would print the card at 80% inside a full page.
