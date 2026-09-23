# Logo rebrand — concepts, September 2026

**Status: concepts only.** No masters drawn, no decision taken, nothing published or uploaded.
The current Ridge mark and its four SVGs in `../` are untouched.

## Why this exists

Matthew, 23 Sep 2026: fire mitigation stops being what Sixfold leads with. **Aeration leads,
general landscaping sits beside it, and fire mitigation is still offered but is no longer the
headline.** Limbing, land clearing, brush removal and felling continue — they sit under
landscaping now rather than under fire.

He asked for logo concepts to review and take to the team.

## What is here

| File | What it is |
|---|---|
| `concepts.html` | The board. Six concepts, three palette directions, the small-size and one-colour tests, open decisions, rollout cost, fact-check log. Double-click to read. |
| `Sixfold-Rebrand-Concepts.pdf` | The same board printed light, **8 pages**, for the table at the meeting. Built by `../../tools/html-to-pdf.mjs` — job added to the list, so it re-renders with everything else. |
| `Sixfold-Rebrand-Concepts.sheet.png` | Contact sheet of the PDF, so the print result can be looked at without opening it. |

## Two things that were settled to make this

1. **Aeration means lawn / core aeration** — hollow tines, plugs pulled out of turf. Confirmed by
   Matthew, 23 Sep 2026. `sixfold/README.md` had this recorded as unestablished with a standing
   instruction not to write sector specifics; that entry has been corrected.
2. **The concepts span the full range** — 01 is palette-only, 06 is a clean sheet. That was
   deliberate, so the meeting is a choice rather than a yes/no on one drawing.

## The six

| # | Name | Move |
|---|---|---|
| 01 | Ridge, retinted | Palette only, no geometry change. **The control** — it shows how much of the fire read was just the orange. |
| 02 | Ridge, aerated | Perforated turf band; under each hole, a core as deep as the ridge above it is tall. Bottom edge repeats the ridgeline. One core ember. |
| 03 | Three strata | Cross-section: canopy, aerated turf, root zone. Peaks flattened to a ridgeline. |
| 04 | Ridge of cores | Six banded soil cores in a ridge profile. Keeps the old silhouette, loses the tree. |
| 05 | Sixfold rosette | Six tines radiating on 60°. The only one that fits a circle. |
| 06 | The tine | One hollow tine, the hole, the core, air going in. No fire at all. |

## Design decisions worth keeping

- **Every mark separates its parts by lightness, not hue.** Ember against Moss is `1.11:1`;
  green against green is `1.20:1`. Both are invisible to a red-green colourblind viewer and both
  collapse in one colour. The tonal ramp is what makes the mono tiles work.
- **The tiles recolour one SVG rather than holding three copies.** Each concept's artwork uses
  `var(--mk-1..4)`, `--mk-em`, `--mk-ln` and `--mk-bg`; `.t-dark` / `.t-bone` / `.t-mono` set them.
  Change the drawing once and all three tiles follow.
- **All contrast ratios in the document were computed**, not estimated. The new colours (Turf,
  Sage, Wheat) are proposals invented for this board and have no standing until someone picks one.

## What core aeration actually is — verified, because the first drawing got it wrong

Checked first-party against UMass Amherst Extension on 23 Sep 2026, after Matthew asked whether the
drawing matched the real equipment. It did not.

- **It is a punch, not a drill.** A core aerator carries **hollow tines** — short open-ended steel
  tubes — on a rotating drum or a cam-driven head that pushes straight down. No auger, no rotation
  into the soil.
- **Tine inside diameter is 1/4″ to 3/4″**, set in grids from 2″×2″ to 4″×6″. A working head carries
  dozens of tines, close together — not six.
- **Each tine pulls a plug 2–3″ long and drops it ON the surface.** For a lawn the plugs stay there
  and get broken up with a drag mat or a mower, acting as topdressing. Only on golf greens are they
  swept off.
- Spike/solid-tine aerators and drill attachments exist but are not the standard commercial job.
  "Aeration" in this trade means core/hollow-tine.

**Where this landed.** Concept 02's cores stay *below* the band, which is not where a real plug
ends up — and that is a deliberate call, not an oversight. **Matthew's direction: keep the cores and
let them mimic the ledge of the ridge across the bottom.** So each core is now as deep as the peak
silhouette above it is tall: shallow under the tree end, deepest under the tallest peak, shallower
again at the right. The bottom edge becomes the ridgeline repeated, and the mark rhymes with itself.

That makes it a **cross-section** — soil columns under the holes they came from — the same device
Concept 03 already uses. The caption says so outright rather than leaving someone in the trade to
find it. A surface-accurate version, with the cores lying on the grass, was drawn and set aside: it
was correct and it gave up the ledge.

The deepest core puts the canvas at 118 units, within a nose of the 116 the current Ridge uses.

**Four drawings were needed to get here, and the two dead ends are worth not repeating:**
cores deleted outright (an over-correction — *"I liked the cores, I just wasn't sure if they looked
the right way"*; a question about accuracy is a question, not an instruction to cut); then cores at
13 wide with 2.2 gaps, which fused into a brick wall and stopped being countable. **Slim cores,
aligned to the holes, with depth doing the work.**

**Concept 04 still stands its cores on end**, which is also not how plugs lie; that one is kept as a
deliberate abstraction and the caption now says so rather than leaving it to be found.

Sources: <https://www.umass.edu/agriculture-food-environment/home-lawn-garden/fact-sheets/management-of-compaction-coring>
and <https://ag.umass.edu/sites/ag.umass.edu/files/fact-sheets/pdf/management_of_compaction.pdf>

## Things that went wrong on the way, so they don't get re-introduced

- **Concept 4 read as a bar chart.** Three separate causes, all fixed: equal core widths, strata
  bands running the full width like gridlines, and a bright ground bar acting as an axis. The bands
  are now clipped to each core, widths and heights are irregular, and the ground line is deep turf
  rather than the brightest thing in the mark. **It can still read as a chart** and the board says
  so — do not quietly drop that caveat.
- **Concept 3's roots came out as hanging noodles** when the original corner fan was spread evenly
  across the width. They are now short and branching.
- **Concept 5's petals came out forked.** A single SVG arc sweep flag cannot be correct for all six
  rotations. The tips are flat lines now.
- **Concept 2's cores went through four drawings.** They must stay slim (8.5 units), aligned one
  per hole, and countable — widening them to 13 fused them into a wall. Their depths are not
  decorative: each one matches the peak silhouette above it.
- **Concept 1 exposed a real constraint:** retinting alone loses the conifer, because it was moss on
  ember and is now green on green. The tree and ground line have to move to bone or black.

## Open, and deliberately not decided here

- Which concept, or which two to develop.
- **The descriptor "Land & Fire."** Settled 15 Sep 2026 and already on the crew shirt and every
  business card option. It now names the demoted service and misses both promoted ones. Needs
  re-opening whether or not the mark changes.
- Ridge vs Sweep — never formally closed, and overtaken if the answer is a clean sheet.
- Whether the ember survives at all as a one-in-six accent.

## Before anything is committed to

- **Check the vehicle magnets have not been ordered.** The repo holds artwork for 24×12, 24×12
  light and 24×18 plus an order sheet, and shows no order placed — but absence of a record is not
  confirmation. It is the one item on the rollout list that cannot be re-run.
- **The live site.** sixfoldcolorado.com has been live since 21 Sep 2026 and carries the mark in the
  favicon, the stylesheet and the wildfire guide. Re-bundle, re-upload, and cache-bust when
  verifying — the host serves a stale proxy cache after an upload.
- **Re-run the prior-use screen on the new drawing.** `../../research/logo-prior-use-screen.md`
  covered the Ridge mark only, and two of its checks were never run — reverse image search and the
  USPTO design-code search.

Rollout scale, counted in the repo 23 Sep 2026: **180** files carrying the ember hex or the Ridge
path data, **40** rendered brand PNGs, **84** PDFs, **3** vehicle magnet files. The September
phone-number sweep (57 files, 21 PDFs) is the precedent that this is doable.
