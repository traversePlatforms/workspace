# Photo slots — the lawn aeration sheet

Drop files in **this folder**, then run `node build-photo.mjs` from the folder above.
Nothing else has to change; the sheet re-renders with them in.

**Names only have to START with the slot word.** `hero`, `aerate`, `seed`, `mow` — and
`.jpg`, `.jpeg`, `.png` or `.webp` all work. So a file straight out of Adobe Stock can be
renamed `hero.jpeg` and left alone, and a second attempt can be `hero-2.jpg`. The build
prints which slot took which file, and names anything in the folder that matched no slot.

**Until a real file lands, each slot shows a frame from the site library under an orange
PLACEHOLDER ribbon.** Those stand-ins are trees, a gravel bed and a crew member at a pine —
the wrong service, deliberately, so a placeholder cannot ship by accident.

| File | Slot | What it has to show | Minimum size |
|---|---|---|---|
| `hero.*` | The band behind the masthead | **Plugs on the turf after a pass**, close and low, plugs sharp, turf behind. The single image that says core aeration and nothing else does | 1600 × 900 |
| `aerate.*` | AERATE card | A core aerator on grass — the machine, product visible if possible | 700 × 500 |
| `seed.*` | OVERSEED card | Seed going down: a spreader on a lawn, or seed in a hand | 700 × 500 |
| `mow.*` | MAINTAIN card | A mown lawn, stripes if you can get them | 700 × 500 |

The band crops to 1080 × 330 and the cards to about 320 × 152, both `object-fit: cover`.
Wide frames survive that; a tall portrait frame will lose its top and bottom. If a subject
sits off-centre, tell me and I will set the focal point per slot — it is one value each.

---

## ⚑ The line this folder exists to hold

**A bought photograph of turf, plugs, seed or a machine illustrates the service.** It is
doing the same job as the drawing: showing what the work produces.

**A bought photograph of a crew working reads as "this is our crew, on a lawn near you."**
It is not, and no licence makes that sentence true. So: **no stock people in Sixfold
marketing.** The same rule the repo already holds for before-and-after imagery — there is
none that is a real Sixfold job, so none is shown.

This is the whole reason the drawing stays on the sheet even when the photos arrive: a soil
profile with a tine in the ground **cannot be photographed**. The photos show the work; the
cutaway shows the part of it nobody can see.

## Where to buy, and what the licence has to cover

The ad runs as **paid social**, which is advertising use, not editorial.

| Source | Good for | Watch |
|---|---|---|
| **Adobe Stock**, **Shutterstock**, **iStock** | Everything here. Standard licence covers paid social | Buy the standard licence, not the editorial-only file — editorial licences forbid advertising |
| **Unsplash**, **Pexels** | Free, and fine for turf, soil and machine frames | The licence grants the photo, **not** model or property rights. No recognisable faces, no recognisable house frontages |

**Recognisable property matters here even at home.** The repo's own shooting rule is *show
the work, not a recognisable frontage, and no customer's house from the kerb without their
say-so* — the same standard applies to a bought frame.

## Search terms that actually return the right frames

- **hero** — `lawn aeration plugs`, `core aeration soil plugs grass`, `aerated lawn close up`
- **aerate** — `lawn aerator machine`, `core aerator grass`, `plug aerator lawn`
- **seed** — `overseeding lawn`, `grass seed spreader`, `broadcast spreader lawn`
- **mow** — `mowed lawn stripes`, `lawn mower grass close up`

Search `aeration` alone and you get septic tanks, ponds and brewing — the same collision the
ad kit's negative keyword list exists for.

## Downloading from Adobe Stock, specifically

1. **Licence the file, then download.** The free preview is a *comp* — visibly watermarked,
   and not publishable. If a watermark shows up in the render, that is what happened.
2. **Any size above the minimums in the table is fine.** Adobe's originals are often 5000px
   wide; that is more than this sheet can use and it bloats the repo. Around 2000px on the
   long edge is plenty. There is no need to crop — the sheet crops each slot itself.
3. **Record it in [LICENCES.md](LICENCES.md)** while the tab is still open.

## Git will track these files

This folder is **not** gitignored — only the big Surge photo tree is. So bought frames get
committed with the rest of the text, which is the right outcome: the sheet and the pictures
it needs stay together, and the OneDrive mirror carries them too.

Keep them reasonably sized for that reason. Four frames at ~2000px is a couple of MB and
nobody will notice; four 5000px originals is not.

## Treatment

`saturate(.92)` is applied to every photo in the sheet by the stylesheet, which is the
treatment the existing library uses so nine phone frames read as one company. Bought frames
get it too, and that is most of what stops stock looking like stock next to real work.

**Keep the receipts.** Put the licence confirmation for each file next to it here — a
one-line note with source, licence type, date and the asset ID is enough, and it is the
thing nobody can reconstruct two years later.
