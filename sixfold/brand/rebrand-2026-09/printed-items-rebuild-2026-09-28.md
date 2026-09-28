# Printed items rebuilt for the aeration-led positioning — 2026-09-28

Business cards and vehicle magnets, redrawn off the fire-led design. **Nothing is
ordered.** The rebrand path recorded the magnets and cards as the one irreversible item
on the list, still reversible — that is still true, and it stays true until Brandon says
go.

## The decision this turned on

**Descriptor: `Lawn, Land & Fire`.** Matthew's call, choosing from the ranked candidates
in [../../REBRAND-PATH-2026-09.md](../../REBRAND-PATH-2026-09.md) §Phase 1 — candidate 5
on that list.

It leads with the promoted service, keeps the one he has twice declined to drop, and
reads as **three equal services** rather than fire-with-add-ons, which is the standing
landscaping-is-standalone rule.

The written argument against candidate 5 was that three nouns is one too many for a
lockup. Measured rather than assumed: **it is shorter than what it replaces.**
`LAWN, LAND & FIRE` is 17 characters against `LAND & FIRE · COLORADO` at 22 — dropping
the state more than pays for the extra noun, and "Sixfold Colorado" carries the geography
anyway. It fits every lockup with room and nothing had to be redrawn.

**⚑ Per Phase 1 the descriptor is Brandon's call with Matthew's recommendation. He has
not seen this.** It wants his yes before anything is ordered.

## What changed

| | Was | Now |
|---|---|---|
| Descriptor | `LAND & FIRE · COLORADO` | `LAWN, LAND & FIRE` |
| Service line | `FIRE MITIGATION · LAND CLEARING · LANDSCAPING` | `AERATION · LAWN CARE · LANDSCAPING · FIRE` |
| Mark on Pine | Ember `#E4703A` + Moss two-tone | **single-ink Sage `#A7BE93`** |
| Mark on Bone | Ember-ink + Timber | **single-ink Turf `#2F7A4F`** |
| Phone | Ember | Bone on Pine, Pine on Bone |
| Card option B | "Ember — matches the crew shirt" | "Turf — the saturated option" |

Palette A, the same one the social kit moved to on 2026-09-25. **Ember is demoted, not
deleted**: `EMBER` is still a defined constant in `build-magnets.mjs` and a still-defined
CSS var in `business-cards.html`, both deliberately unused, exactly as `build-social.mjs`
keeps it. If orange reappears on a magnet, something reached past that line.

**Verified by raw-hex grep after the swap**, which is the check the palette-A memory
exists to force: `#E4703A` is at **0** occurrences in all three magnet files and in the
card artwork, and at 1 in `business-cards.html` — the unused var, which is the point.

## Two things found by looking at the render rather than the file

1. **The card was using the LAYERED master mark, not the flat print master.** Its peaks
   carry `fill-opacity` .42/.55/.7/.85, which reads as depth in two inks and as **mud in
   one**. Swapped to `sixfold-mark-ridge-flat.svg`, the same mark the magnets already
   used, so cards and magnets now match. Card now has 0 `fill-opacity` and 0 `stroke=`.
2. **The card carried the ember flame strokes**, which in green are just squiggles under
   the ridge. Gone with the flat mark.

Neither was visible in the source. Both were obvious in the PNG.

## The magnets get roots

Matthew's call later the same day. **A mirror was tried first and reverted** — he had
meant roots all along, and the mirrored ridge is gone from the files entirely.

Why roots belong here specifically: the mark is a ridgeline sitting on a ground bar, and
**aeration is the service that happens below that bar**. Hanging roots off it is the one
change that makes the mark say what the company now leads with, without touching the
peaks.

Drawn in the same language as the lawn cross-section in
`marketing/lawn-infographic-2026-09/art.mjs` — a filled taper with branches off the same
curve — but **solid, not gradient-filled**. That drawing is read at arm's length on a
printed sheet; this one is read at 30 ft off a moving vehicle, and 30 mil magnet stock
gets no benefit from a gradient it cannot resolve.

Four roots, set under the mass of the mark rather than spread evenly: the big peak sits
right of centre, so the deepest root does too. Depths are staggered so the silhouette
does not read as a comb.

**The shared mark file is NOT modified.** Roots are injected in `build-magnets.mjs`, so
this is a magnet lockup rather than a change to the logo. ⚑ The card, the site, the social
kit and the QR assets all still use the bare Ridge.

### It took two passes, and the first one was wrong in an instructive way

The first attempt used thin tapers with branches swept **outward**. Rendered, they read as
**spikes or barbs under the ground bar**, not as roots — the branch angle was doing the
damage more than the depth. Thicker mains and branches swept **downward** fixed it.
Nothing about that was visible in the path data.

### ⚑ The 24×18 silently paginated, and that is the trap worth remembering

Growing the viewBox to 126 without shrinking the mark pushed the 24×18 column layout past
its safe area. **`body` is `overflow:hidden`, so on screen it just clipped** — the artwork
looked fine and the bottom of the lockup was simply gone. The PDF is what caught it, by
coming out as **2 pages**.

**A magnet that renders as more than one page is a magnet whose lockup does not fit.**
Check the page count on every render, not just the picture.

`markH` was walked back until it held: **7.6in is the ceiling on the 24×18**, against 9.4in
on the 24×12, which has the room.

### The cost, stated plainly

On the 24×18 the mark box now holds ridge **and** roots in the height the ridge alone used
to have, so **the ridge itself is about a quarter smaller there** and the composition is
more text-heavy than before. The 24×12 does not have this problem.

If that reads as undersized on a truck door, the lever is the `svc` line — it is 50pt on
that variant, the largest thing after the phone, and dropping it would buy the mark back
most of what it lost. Not changed on my own initiative.

## Service line has a hard width ceiling

`.svc` is `white-space:nowrap` and sits beside a 7.5in mark. About **47 characters**
before it runs past the safe area on the 24×18, which is the tighter of the two shapes.
The line is 41.

**`LAND CLEARING` is deliberately not listed** — the descriptor above already carries the
word Land, and a fifth item pushes it over. If it has to go back, something else comes
out. **The overflow is silent: re-render and look.**

## Files

- `brand/vehicle/build-magnets.mjs` → the three magnet HTMLs → `tools/html-to-pdf.mjs magnet`
- **`brand/vehicle/build-proof.mjs` is new.** `proof.png` is what actually gets sent to
  the crew, and it was previously regenerated by "the snippet in the session notes". A
  snippet in a chat log is not a build step — it went stale the moment the magnets
  changed, and a proof showing the old orange artwork is worse than no proof. Now a
  committed script.
- `operations/business-cards.html` → the options sheet → `business-cards.pdf`
- `operations/business-card-print/card-a-pine-brandon.html` → the FedEx PDF, and
  `build-png.mjs <url> <front.png> <back.png>` for the 1125×675 300dpi PNGs
  (**it takes arguments — running it bare fails with an unhelpful `undefined` error**)

## Still open

- **Brandon's yes on the descriptor**, before anything is ordered.
- **The crew shirt is still ember and still says Land & Fire.** It is in the 123-file
  sweep and is now out of step with the cards rather than the other way round.
- **The mark itself is unchanged** — this is "Ridge for now, new palette", not Phase 2.
  The concept board in this folder is still open.
- Matthew reviews design by ratcheting louder and more commercial each pass. This set is
  at the **quiet** end: no warm accent anywhere, by palette. **If he wants it louder the
  cheapest lever is the phone number** — one constant per file.
