# Vehicle magnets — order sheet

Built 2026-09-16. Asked for by the crew, spend green-lit by Brandon. **Nothing ordered yet.**

## ⚑ TWO LAYOUTS TO CHOOSE BETWEEN — 2026-09-28

There are now **two complete families**, and the crew picks one before anything is
ordered. Same sizes, same print spec, same phone number; **the palette and the copy are
what differ.**

| | **GREEN** — aeration-led | **EMBER** — fire-led |
|---|---|---|
| Descriptor | `LAWN, LAND & FIRE` | `LAND & FIRE · COLORADO` |
| Service line | `AERATION · LAWN CARE · LANDSCAPING · FIRE` | `FIRE MITIGATION · LAND CLEARING · LANDSCAPING` |
| Mark | Single ink — Sage on Pine, Turf on Bone | Two-tone — ember ridge, moss tree and ground |
| Phone | Bone on Pine, Pine on Bone | Ember |
| Matches | The site, the social kit, the new cards | The crew shirt and the older collateral |

**The green set is the current direction** — it is the one that matches what the company
now leads with. The ember set is kept because it is what everything printed before it
looks like, and switching both at once is a bigger decision than a magnet order.

**Send `proof.png` and `proof-fire.png` together** — that is the choice, side by side.

## What to send the printer

| File | Trim size | Ground | Use |
|---|---|---|---|
| `magnet-24x12.pdf` | 24 × 12 in | Pine (dark) | **Green.** The standard car-door magnet. |
| `magnet-24x18.pdf` | 24 × 18 in | Pine (dark) | **Green.** Fills a full-size truck door. |
| `magnet-24x12-light.pdf` | 24 × 12 in | Bone (light) | **Green.** Alternate for a dark-coloured vehicle. |
| `magnet-24x12-fire.pdf` | 24 × 12 in | Pine (dark) | **Ember.** Same, fire-led. |
| `magnet-24x18-fire.pdf` | 24 × 18 in | Pine (dark) | **Ember.** Same, fire-led. |
| `magnet-24x12-fire-light.pdf` | 24 × 12 in | Bone (light) | **Ember.** Same, fire-led. |

`proof.png` (green) and `proof-fire.png` (ember) are those rasterised — send the proofs to
the crew, the PDFs to the vendor.

**Rebuilding:** `node build-magnets.mjs` writes all six HTML files ·
`node ../../tools/html-to-pdf.mjs magnet` renders all six PDFs ·
`node build-proof.mjs` and `node build-proof.mjs fire` write the two proof sheets.

**⚑ Do not quietly update the ember files to the new descriptor.** The whole point of
keeping them is that they are the *other* option, not a half-migrated one.

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
