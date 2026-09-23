# Logo rebrand — September 2026

**Status: one candidate, four core treatments, nothing decided.** No masters drawn, nothing published
or uploaded. The current Ridge mark and its four SVGs in `../` are untouched.

## Why this exists

Matthew, 23 Sep 2026: fire mitigation stops being what Sixfold leads with. **Aeration leads, general
landscaping sits beside it, and fire mitigation is still offered but is no longer the headline.**
Limbing, land clearing, brush removal and felling continue — they sit under landscaping now rather
than under fire.

He asked for logo concepts to review and take to the team.

## Where it got to

The board opened with six competing concepts. **It now carries one.** Matthew, 23 Sep 2026: *"I think
this is the ideal candidate, just about fine tuning what needs to be done."*

**"Ridge, aerated" is the candidate.** The remaining question is how the cores are drawn, so the board
is now four core treatments against identical geometry.

**The other five concepts are retired, not deleted** — Ridge retinted, Three strata, Ridge of cores,
Sixfold rosette and The tine. They are in git; the last commit that has them on the board is
`c617c99`. If one is wanted back, recover it from there rather than redrawing it.

## What is here

| File | What it is |
|---|---|
| `build-board.mjs` | **Generates the board.** Geometry lives at the top; each treatment only gets to draw a core. Run `node build-board.mjs`. |
| `concepts.html` | The generated board. Double-click to read. **Do not hand-edit — it is overwritten.** |
| `Sixfold-Rebrand-Concepts.pdf` | The board printed light, for the table at the meeting. Built by `../../tools/html-to-pdf.mjs`. |
| `Sixfold-Rebrand-Concepts.sheet.png` | Contact sheet of the PDF, so the print result can be looked at. |
| `concepts.artifact.html` | Unwrapped copy for the artifact at https://claude.ai/artifact/9USctbb7PFwhuFAQ9eorz5 |

**Why it is generated.** We are now iterating on one drawing, so what matters is that the spacing, the
depths and everything above the ground line stay *identical* between treatments — otherwise the
comparison is not a comparison. Putting the geometry in one place and letting each treatment draw only
a core makes that structural rather than a matter of care. Swapping a treatment in or out is a few
lines.

## Settled, and not up for grabs in this round

- **Five forms, five cores.** The Ridge mark has four peaks and one conifer above the ground line.
  One core per form, directly beneath it.
- **Each core is as deep as its form is tall.** Apex heights measured off the path data:
  **30.5 / 38 / 48 / 60 / 72**. The bottom edge is the skyline inverted.
- **The turf band and its five holes**, which is what a hollow tine leaves.
- **The ember is the conifer's core** — the one form that is not a peak, and the smallest of the five.
- **Every treatment keeps a lid of turf in the band's own colour.** A plug comes out with the lawn
  still attached, and it is the one feature that says "aeration core" rather than "shape". It takes
  the band colour because it *is* the same turf.

## The four treatments

| | Name | What it is | What it costs |
|---|---|---|---|
| 01 | Mirror wedge | Each core is the form above it turned upside down. | Cleanest and strongest at small size. Nothing about a wedge says *soil*. |
| 02 | Broken plug | The core in pieces, because a real plug crumbles. | Most honest to the material. Gaps close up in embroidery. |
| 03 | Section outline | Outline rather than fill, like a sample in a section drawing. | Keeps the weight in the peaks. Thin strokes die on a magnet or a receipt. |
| 04 | Soft taper | A slight taper to a rounded tip, one thatch seam. | Closest to a real core. Least distinctive — a row of pegs. |

## What core aeration actually is — verified

Checked first-party against UMass Amherst Extension on 23 Sep 2026, after Matthew asked whether the
drawing matched the real equipment. It did not.

- **It is a punch, not a drill.** A core aerator carries **hollow tines** — short open-ended steel
  tubes — on a rotating drum or a cam-driven head that pushes straight down.
- **Tine inside diameter is 1/4″ to 3/4″**, in grids from 2″×2″ to 4″×6″. A working head carries
  dozens of tines, not five.
- **Each tine pulls a plug 2–3″ long and drops it ON the surface**, where it stays and is broken up as
  topdressing. Only on golf greens are they swept off.
- Spike aerators and drill attachments exist but are not the standard commercial job.

**So this mark is a cross-section, not a photograph** — a real plug does not hang under the turf.
That is deliberate, the same device the retired "Three strata" concept used, and it is what buys the
mirrored ledge. The board says so outright rather than leaving someone in the trade to find it.

Sources: <https://www.umass.edu/agriculture-food-environment/home-lawn-garden/fact-sheets/management-of-compaction-coring>
and <https://ag.umass.edu/sites/ag.umass.edu/files/fact-sheets/pdf/management_of_compaction.pdf>

## Dead ends, so they are not repeated

- **The turf cap has to be the band colour.** The first capped version used Sage over a Moss body —
  `1.20:1`, the hue-only pairing this very document warns about — and the cap did not read at all.
- **Cores must stay slim (8.5 units) and one per form.** Widening them to 13 fused them into a brick
  wall and they stopped being countable.
- **Do not put plugs below a turf line and call it accurate.** They were first hung below the band
  with nothing to say for it, and read as tines pointing down. The cross-section framing is what
  makes the position defensible.
- **Do not add a sixth core without adding a sixth form above it.** A sixth was tried; it sat on a
  downslope, mirrored nothing, and looked like a mistake because it was one.
- **An earlier pass deleted the cores outright** when Matthew had only asked whether they were
  accurate. *"I liked the cores, I just wasn't sure if they looked the right way."* A question about
  accuracy is a question, not an instruction to cut.
- **Sample the geometry, do not eyeball it.** A hand-estimated height of 7 was really 12.
- Treatments already drawn and rejected: plain banded column with a rounded end; cap with grass blades
  standing proud (blades vanish into the band); mottled soil (reads as noise, mush below 30px); cap
  plus root threads (drawn, shown, not liked).

## Open decisions

- **Which core treatment**, and separately **which palette** (A demote the ember, B turf primary,
  C turf and wheat — all still on the board).
- **Should the mark encode six at all?** The Ridge mark has five forms and has never encoded the
  name. Making it genuinely six means adding a sixth form *above* the ground line — a change to the
  silhouette, not the cores. It is the one change that would make the drawing say "Sixfold" out loud.
- **The descriptor "Land & Fire."** Settled 15 Sep 2026 and already on the crew shirt and every
  business card option. It names the demoted service and misses both promoted ones.

## Before anything is committed to

- **Check the vehicle magnets have not been ordered.** The repo holds artwork for 24×12, 24×12 light
  and 24×18 plus an order sheet, and shows no order placed — but absence of a record is not
  confirmation. It is the one item on the rollout list that cannot be re-run.
- **The live site.** sixfoldcolorado.com has been live since 21 Sep 2026 and carries the mark in the
  favicon, the stylesheet and the wildfire guide. Re-bundle, re-upload, and cache-bust when verifying
  — the host serves a stale proxy cache after an upload.
- **Re-run the prior-use screen on the new drawing.** `../../research/logo-prior-use-screen.md`
  covered the Ridge mark only, and two of its checks were never run — reverse image search and the
  USPTO design-code search.

Rollout scale, counted in the repo 23 Sep 2026: **180** files carrying the ember hex or the Ridge path
data, **40** rendered brand PNGs, **84** PDFs, **3** vehicle magnet files. The September phone-number
sweep (57 files, 21 PDFs) is the precedent that this is doable.
