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

| Asset | Page | Why this frame |
|---|---|---|
| `crew-felling` | home, fire card | Two of the crew working a tree with a rope. The best crew-at-work frame in any folder — people, tools and product in one shot |
| `haul-truck` | home, clearing card | Truck bed loaded with slash. This is what "hauled off site" actually looks like |
| `beds` | home, landscaping card | Gravel bed with grasses and plantings. Landscaping as its own service, not a clean-up |
| `slash-line` | home, banner above the guide | The only frame wide enough to span the page |
| `chipper` | /what-we-do/ fire | The machine that defines the trade |
| `rounds` | /what-we-do/ clearing | Cut rounds — texture, reads well small |
| `trimming` | /what-we-do/ landscaping | Crew member in a hard hat cutting at a pine base. No property in frame |
| `limbing`, `stand` | not placed yet | Held in reserve — good frames, no slot that needed them |

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
