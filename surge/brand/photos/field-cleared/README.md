# Field photography, client marks removed

Created 2026-08-20. Three photographs out of the 55 in
`../client-branded-DO-NOT-PUBLISH/`, retouched so that no client is
identifiable, and cleared for publication.

**These are the only field photographs Surge can publish.** Everything else in
that folder is still restricted and the folder's own README explains why.

---

## What was done, and the rule it was done under

`RESTRICTED.md` Tier 4 restricts **client identity at any resolution, sector
only**, and the reason given is **consent** — no client hired Surge in order to
become marketing material. That reason is what set the standard here, because
it is stricter than "no logo is readable":

> **The test applied: after the edit, does anything in the frame point at a
> specific organization?** Not "is the wordmark legible" — a distinctive kiosk
> covered in an animal charity's photographs still names that charity to
> anyone in Denver who has walked past one, wordmark or no wordmark.

That test is why only three frames were rescued out of fifty-five. It is also
why the retouching is confined to marks that are **incidental** to the picture
— a logo on a cap, on a chest, on a flat tablecloth. Where the client's
branding **is** the subject, there is nothing to remove and the frame stays
restricted. Do not treat this folder as a precedent for blurring a kiosk.

## The three files

Each has a `-cleared.jpg` master at full working resolution and a `-web.jpg`
copy capped at 1800px on the long edge.

| File | What it shows | Marks removed |
|---|---|---|
| `canvassing-08` | A fundraiser at a staffed booth outside a convenience store, thumbs up. Sunny, warm, the strongest of the three. Master 3600x3600. | Chest emblem, org name and tagline on the shirt; the org name printed three times along the lanyard ribbon plus a logo; the ID badge; the printed sheet on the clipboard. The tablecloth logo was **cropped out**, not retouched. |
| `canvassing-24` | A rep outside a grocery frontage holding balloons, booth table beside him. Bright and friendly. 1200x1600. | Tablecloth logo and tagline; logo on the cap he is wearing; logo on the spare cap lying on the table; printed sheets. |
| `canvassing-25` | Two reps at a booth outside a garden centre, one carrying the other. Playful. 1200x1600. | Tablecloth logo and tagline; both cap logos; the daily-goal board, which named the org in handwriting; printed sheets; a badge. The open ledger was softened too — see below. |

**`canvassing-25` is cleared but unplaced.** It is genuinely funny and it is a
real booth, but the tone does not fit any page it could go on, and it is
bottom-heavy — the emptied tablecloth takes up a third of the frame. Cleared
so the option exists, not because there is a slot for it.

## Two things that were removed for reasons other than client identity

- **The open ledger in `canvassing-25`.** Handwritten canvassing notes. The
  page is illegible at any size this ships at, but a fundraiser's working page
  is the kind of document that carries **donor names and amounts**, and that
  is a different problem from client branding. Softened rather than gambled on.
- **The daily-goal board in `canvassing-25`, and the goal figures in
  `canvassing-32`** (not cleared). A handwritten `$1500 daily goal` is a KPI on
  a whiteboard, which is the same Tier 2 material that put seven office photos
  in `../restricted-boards-DO-NOT-PUBLISH/`. It happens to be the client's
  fundraising target rather than a Surge one, but it is not worth the argument.

## How it was done

`tools/Declient-Photo.py` in this project, run against the originals. The
originals are never written to. Three operations:

- **clone** — copy clean matching material over the mark, feathered. Keeps the
  real weave and fold shading, so nothing reads as a patch. Used on the shirt
  emblem in `08`.
- **ramp** — rebuild the area by interpolating across it row by row from clean
  columns either side, then add **real fabric texture** sampled from elsewhere
  on the same cloth. Used on the tablecloths.
- **blur** — only on small objects that have to stay legible *as objects*: a
  lanyard, a badge, a sheet of paper. Deleting those looks stranger than
  softening them.

### Four things that went wrong, so they are not repeated

1. **A feathered edge blends the original back in.** If the mask box hugs the
   mark, the feather zone re-introduces the outer few percent of it — which
   showed up as a red bar of tagline sitting in the middle of a cleaned
   tablecloth. **Every box must clear the mark by more than the feather
   width.** This was the single hardest bug to see and the easiest to ship.
2. **Clone sources get sampled before you check them.** The first pass on `08`
   pulled the orange sleeve and part of the emblem itself into the shirt.
3. **Texture samples get sampled before you check them too.** The first
   textured fill tiled a piece of the logo across both tablecloths.
4. **Rebuilding a large draped area leaves a rectangle** however it is
   blended, because the fill is smoother than real fabric. On `08` the crop was
   the better answer and it improved the composition as well. **Reach for the
   crop before the rebuild.**

### Verify by rendering, at two sizes

Source inspection proves nothing here. Every one of the four failures above
was invisible in the numbers and obvious on screen. Render the result **at the
size it will ship at** and again **at 2x**, and look at every mark.

## Where they are used

- `canvassing-08` → the Surge site, `/sectors/nonprofit/`, paired with "What
  the rep is actually doing". The first photograph any sector page has carried.
- `canvassing-24` → the Surge site, `/careers/`, next to the "Field sales
  representative" copy, replacing a training-room photo on a page whose subject
  is doors, events and booths.
- `canvassing-25` → unplaced.

**All three show nonprofit fundraising.** They cannot illustrate the roofing or
aeration pages, and evening those pages up by reusing one would be showing one
sector's work as another's.

## What this does not change

The upstream fix is still the upstream fix, and it is worth more than this
folder. **Unbranded Surge shirts on a shift**, or **written permission from a
client**, would make the other fifty-two usable without any of this. Retouching
three frames is a workaround for one afternoon, not a supply of photography.

See `../photos-notes.md` and `../client-branded-DO-NOT-PUBLISH/README.md`.
