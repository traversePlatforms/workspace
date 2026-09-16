# Crew shirt spec — orange body, black mark

`crew-shirt-spec.src.html` → `node operations/build-crew-shirt-spec.mjs` → `crew-shirt-spec.html`
→ `node tools/html-to-pdf.mjs crew-shirt-spec` → `crew-shirt-spec.pdf`. **Edit the `.src.html`.**

Answers Brandon and Brad's direction: *safety-jacket orange, without obviously being a hi-vis.*

## The finding

**⚑ The Ridge mark cannot be screen printed as it is drawn.** Its four mountains carry
`fill-opacity` of 0.42 / 0.55 / 0.70 / 0.85. Screen printing is ink or no ink. A printer either
halftones it — mud on a textured tee at chest size — or flattens every shape to solid, which merges
the four peaks into one silhouette and destroys the layering the mark is built from. **A one-colour
garment version has to be drawn before anything is ordered**, and it becomes the merch master for
every future piece.

## What the checks said

- **Contrast is a non-issue in black.** Ember 6.68:1 · safety orange 7.19:1 · hi-vis 8.40:1 · burnt
  4.58:1, against a 3.0:1 floor for a graphic. **Bone fails on all four** (2.03–3.73) — a light mark
  on orange is out, and it is the first thing people reach for.
- **Recommended body: Ember, the brand orange.** Warm rather than fluorescent, which is exactly the
  brief, and already owned.
- **The small tree at the base is the fragile part.** Its trunk is 3.2 units in a 94-unit mark —
  0.10 in at left-chest size, 0.027 in on a sleeve, under the ~0.03 in a screen holds. The wavy root
  strokes are finer still, which is why this repo's PDF builders already drop them.

## The mockups reuse the merch renderer

The tee is **imported from `site/merch/build-merch.mjs`**, not redrawn, so the spec and the concept
board stay one drawing. That file now exports `tee`, `DEFS` and `crest`, and its own `index.html`
write is guarded to run only when the file is executed directly — importing it must not silently
rewrite the concept board.

Prints are sized from a real ratio: the tee body spans ~196 viewBox units across a chest that
measures about 20 in flat, so **1 in ≈ 9.8 units**. The left-chest mark looks small on the page
because a 3 in print on a 20 in chest *is* small.

**Panels 2 and 3 are a deliberate A/B** — same garment, same yoke size, solid versus opacity-intact.
The first attempt put the opacity version at 3 in on the front, where it is indistinguishable from
the solid one, so the panel proved nothing. At yoke size the separation is visible, which is the
whole argument.

## Notes

- **Two pages by content, not overflow.** 0.68 scale did not save it, so the print scale sits at
  0.78 for readable type rather than shrinking to chase one page.
- **Hex values are screen references, not garment colours.** Blank catalogues are not verified here
  — match Ember against a physical swatch before ordering. Screens lie about orange.
- No web address on the garment: the site is not hosted.
