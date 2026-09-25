# Photographs on the site — 2026-09-19

Nine images, from three folders on Matthew's Desktop that are **not in this repo**:

- `New work photos/Photos to upload content/` — the Sedalia-area clearing work
- `New work photos/Work/Sixfold/` — the same job, mostly wide ground shots
- `kara photo dump/` — job 2, the trimming and landscaping job

**The selection and every crop live in `assets/img/build-photos.mjs`.** Re-run it to
rebuild; the originals are never modified. That file is the record of which frame became
which asset, so the choice survives the Desktop being tidied.

## ⚑ What is deliberately not in the set

**The Kara photos are a real customer's property**, and a good share of that folder shows
an identifiable house from the road — frontages, driveways, the building from the kerb.

**Everything chosen shows the work** — a crew member, a cut, a bed, loaded material — and
**not a recognisable frontage.** That is the careful default, not a judgement that the
rest could not be used. Widening it is the customer's permission to give and not ours to
assume, and the same reasoning the project already applies to naming clients.

If Matthew has her OK, there are better "after" frames in that folder — the trimmed pines
against the house read well and would make a genuine before/after pair. **Ask first.**

Also excluded: all `.MOV` and `.MP4` (several stills are Live Photos with a movie beside
them — only the still is used), and roughly a dozen frames in `Work/Sixfold/` that turned
out to be **screenshots of DNS records**, not photographs.

## Where each one is used

Reassigned 2026-09-24 for the aeration-led site. See §The turf gap below.

| Asset | Page | Why this frame |
|---|---|---|
| `crew-felling` | home, fire card | Two of the crew working a tree with a rope. The best crew-at-work frame in any folder — people, tools and product in one shot |
| `haul-truck` | home, clearing card | Truck bed loaded with slash. This is what "hauled off site" actually looks like |
| `beds` | home, landscaping card · /services/ landscaping | Gravel bed with grasses and plantings. **Moved off the lawn card 2026-09-24** — it is beds and planting, which is what the landscaping card now sells |
| `trimming` | home, **lawn card (PLACEHOLDER)** | Crew member in a hard hat cutting at a pine base. Picked for the lawn card only because it is the one frame with a real expanse of turf in it. **The work in it is not lawn care.** Replace |
| `slash-line` | home, banner above the guide | The only frame wide enough to span the page |
| `chipper` | /services/ fire | The machine that defines the trade |
| `rounds` | /services/ clearing | Cut rounds — texture, reads well small |
| `limbing`, `stand` | not placed yet | Held in reserve — good frames, no slot that needed them. **Both are in `DENY_UNUSED` in make-bundle.mjs** — placing one means taking it off that list too, or it will not ship |

## ⚑ The turf gap — 2026-09-24

**There is no lawn, turf or aeration photograph in the library.** Every frame is trees,
slash, cut rounds or cleared ground; the one landscaping shot is a gravel bed. The site
now leads with lawn and turf care, so the lead service is the one with no picture of
itself.

Two places are waiting on this, and both are commented in the HTML:

- **home, lawn card** — carries `trimming.jpg` as a marked placeholder, because a card
  in a row of four needs an image to hold its shape.
- **`/services/#lawn`** — deliberately has **no photo at all**. That section describes
  the service rather than teasing it, so a wrong picture costs more there than a gap.

### Shot list

Phone frames are fine — the whole set was shot that way. What is wanted, best first:

1. **Plugs on the lawn after a pass.** Close, low, plugs in focus with the turf behind.
   This is the one image that says "core aeration" and nothing else does.
2. **The aerator working**, crew member behind it, plugs visible on the ground already
   covered. Machine and product in one frame, the way `crew-felling` works for fire.
3. **Before and after on the same strip**, shot from the same position. Needs a marker
   in frame so the two line up.
4. **A wide of a finished lawn** — for the landscaping/lawn banner slot.

Same rules as the rest of the set: **show the work, not a recognisable frontage**, and
no customer's house from the kerb without their say-so. Add each one to `PHOTOS` in
`assets/img/build-photos.mjs` and re-run it rather than hand-cropping.

## Treatment

- **1000px for cards, 1600px for the banner.** The cards render about 480px wide, so 1000
  is a 2x asset. A first pass at 1400 everywhere was 3x of nothing.
- **webp + a jpg fallback**, `<picture>` with `loading="lazy"`. webp total is **1.8 MB
  across all nine**; the jpgs only serve browsers that cannot take webp. Foliage compresses
  badly — 120–200KB is where detailed greenery lands at this size, and pushing quality
  lower turns pine needles to porridge.
- **`saturate(.92)`** on every photo. The set was shot on phones across two jobs and two
  days; a light desaturation pulls the greens together so nine frames read as one company.
  At 0.92 nobody notices; at 0.8 the foliage goes grey.
- **The banner runs into the ridge.** `.banner + .ridge-rule` is pulled up by its own
  height, so the transparent part of the divider sits over the photo and the mountains rise
  out of the picture into the Pine band. Without it the Bone page showed through as a pale
  strip — photo, gap, mountains, Pine, four bands where the point was one.

## Adding more

Add a row to `PHOTOS` in `build-photos.mjs` and re-run. Aspect over 2 gets the banner
width automatically. Then place it with the same `<picture>` block the pages already use,
and **write real alt text** — every one here describes what is happening, not "photo of
tree".
