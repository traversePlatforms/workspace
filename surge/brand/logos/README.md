# Logos

## What's here

| File | Size | Background | Use it? |
|---|---|---|---|
| `surge-wordmark.svg` | vector | **Transparent**, `currentColor` | **Yes — this is the one** |
| `logooooo-e1757075328860.png` | 733 x 222 | **Transparent**, pure black glyphs | Yes — raster fallback |
| `Screenshot-2024-12-18-143607.webp` | — | Solid white, lots of padding | No |
| `cropped-Screenshot-2024-12-18-143607.webp` | — | Solid white | No |

All four are the same stepped SU / RGE wordmark with the two bars. The two screenshots have a white
box behind the glyphs, which shows on anything that isn't white — they should be retired.

Because the glyphs are pure black, dark mode is a clean `filter: invert(1)`. The SVG doesn't need
that: it takes `currentColor`, so it recolours from CSS.

## The SVG — read this before relying on it

**`surge-wordmark.svg` was traced from the 733px PNG on 2026-08-25, because no vector original
exists anywhere in this folder or in the website repo.** It overlays the source exactly at every
size the logo is actually used at. What it cannot recover is what a 733px raster never held: the
true curve on the S, U, R and G is approximated and shows above roughly 3x magnification. The two
bars are exact — they were measured and rebuilt as rectangles.

**If an original Illustrator, EPS or PDF file turns up, it replaces this file outright.**

Regenerate with `tools/Trace-Logo.py` (needs Python 3.12 + Pillow, neither on PATH — see the
`background-removal-rembg` note for the interpreter path).

## Measured geometry

Taken off the source bitmap. Everything is expressed against cap height so it scales.

| Measure | Source px | ÷ cap height |
|---|---|---|
| Cap height | 88 | 1.000 |
| Bar length | 219 | 2.489 |
| Bar thickness | 19 | 0.216 |
| Letter tracking | 42 | 0.477 |
| Row offset (SU → RGE) | 70 | 0.795 |
| Row overlap | 16 | 0.182 |
| Clear gap between the two bars | 32 | 0.364 |
| Full lockup | 598 × 162 | 3.69 : 1 |

Both bars are the same object, used twice. Each line fills the other line's empty half, and the two
bars never touch — there is a clear 32px channel between them. That interlock is the mark.

## Clear space and minimum size

Neither was ever supplied. **Proposed**, derived from the mark's own geometry:

- **Clear space:** twice the bar thickness on all four sides — 0.43 cap height, 38px at source size.
- **Minimum size:** 72px wide on screen, 25mm in print. Below that the bars fall under one device
  pixel and the channel closes up. Use a compact lockup or a mark from the kit instead.

## The kit — [kit/surge-logo-kit.html](kit/surge-logo-kit.html)

Built 2026-08-25. The mark documented properly, plus **seven candidate logomarks and three alternate
lockups for review**. Nothing in it has been adopted. Source SVGs in [kit/marks/](kit/marks/).

The gap it exists to fill: the wordmark is 3.69:1 and has no square form, so it cannot be a social
avatar, a favicon, or anything dropped on a photograph. That is not fixable by redrawing the
wordmark — it is the argument for a second mark beside it.

Rebuild the page with `kit/build.py` after editing `kit/surge-logo-kit.src.html`; the marks
themselves come from `tools/Build-Marks.py`.

## Still worth having

- **The original vector artwork**, if it exists anywhere. It replaces the trace.
- **The name of the typeface** the wordmark was set in, or who drew it. Closest match by proportion
  is Archivo Black; not confirmed.
- **A decision on which mark direction**, if any, to develop.

## How it gets used

Embedded as a base64 data URI or inlined as SVG, downscaled to ~440px wide first for raster.
Artifacts block external image requests, so linking to a file never works. One placement per asset —
a decal on the board surface for public pieces, a small plate on the marker tray for internal ones.

**Note for the website:** `public/favicon.svg` in the site repo is still Astro's default favicon —
the framework's own logo, not Surge's. Whichever mark gets chosen replaces it.
