# Vehicle magnets — order sheet

Built 2026-09-16. Asked for by the crew, spend green-lit by Brandon. **Nothing ordered yet.**

## What to send the printer

| File | Trim size | Ground | Use |
|---|---|---|---|
| `magnet-24x12.pdf` | 24 × 12 in | Pine (dark) | The standard car-door magnet. Order this first. |
| `magnet-24x18.pdf` | 24 × 18 in | Pine (dark) | Fills a full-size truck door. |
| `magnet-24x12-light.pdf` | 24 × 12 in | Bone (light) | Alternate for a dark-coloured vehicle. |

`proof.png` is all three rasterised from those PDFs — send that to the crew for a look;
send the PDFs to the vendor.

## The spec to give the vendor

- **Size:** 24 × 12 in or 24 × 18 in (stock sizes everywhere — Vistaprint, BuildASign, Signs.com,
  a local sign shop).
- **File:** PDF, one page, **includes 0.125 in bleed on every side** (page is 24.25 × 12.25 /
  24.25 × 18.25). Content sits ≥ 0.75 in inside the trim, so rounded corners of any radius up to
  about 1 in are safe.
- **Material:** **30 mil** magnetic sheet, vehicle grade. Not 20 mil — that is the fridge weight
  and it lifts at highway speed.
- **Corners:** rounded.
- **Colour:** files are RGB hex brand values; the vendor converts to CMYK. Sage and Turf will come back a
  touch duller and browner than the screen. That is normal and not a file fault.

## Before they go on a truck

- **Check the panel is steel.** Ford F-150 bodies (2015 on) and most new tailgates and hoods are
  aluminium; a magnet will not hold. Test the spot with a fridge magnet first.
- Flat panel only — not across a body line or door crease, and not on a recently repainted panel.
- Take them off weekly and wipe both surfaces, or grit underneath scratches the paint. Do not run
  them through a car wash.

## What is on them, and why

Mark / **Sixfold** / LAWN, LAND & FIRE / AERATION · LAWN CARE · LANDSCAPING · FIRE /
(303) 915-1045. That is the settled card lockup with the phone made the second-biggest thing,
because a vehicle is read at 30 ft. No web address (site not hosted), no street address, no
"licensed / insured / certified", no prices — the standing Sixfold copy rules.

The mark is the **flat Ridge** (`../sixfold-mark-ridge-flat.svg`), built the same day: solid
fills with knockout gaps instead of the master's transparency, roots dropped, trunk widened. It is
also the one-colour merch master for the crew shirt and the sticker.

## To change anything

Edit `build-magnets.mjs`, run it, then from `sixfold/`:

```
node tools/html-to-pdf.mjs magnet
```

and re-render `proof.png` (the snippet is in the session notes; it rasterises the PDFs with
pypdfium2 at 72 dpi).
