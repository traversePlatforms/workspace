# Sixfold Colorado — website (draft build on disk)

**Started:** 2026-09-01
**Status:** Draft. **Not deployed, no host, no domain resolves.** Same standing as
every other Sixfold asset — nothing published, posted, scheduled or uploaded.

This is the start of the Sixfold Colorado site, rebuilt in-repo as plain static
HTML. The earlier Astro build lived at `C:\Users\Surge Inc\dev\sixfold-site`
(outside OneDrive) and is gone with the machine that held it; this replaces it and
stays inside the workspace so it can be audited.

## Structure

```
sixfold/site/
  index.html            landing page (funding-led: the work, who pays, the paperwork, boards, contact)
  merch/
    index.html          merch & branding concept board — GENERATED, do not hand-edit
    build-merch.mjs      generator: one SVG renderer per product + the item copy + the page shell
  assets/site.css        shared stylesheet — palette is the agreed five
```

Clean-ish URLs: `/` and `/merch/`. Links between pages are relative so the site
opens by double-click from `file://` with no server.

**The merch board is generated.** Edit `merch/build-merch.mjs`, then
`"C:\Users\Surge Inc\AppData\Local\nodejs\node.exe" build-merch.mjs` (node is
installed there, not on PATH — see the `sixfold-brand-assets` memory), then
re-screenshot in headless Chrome. Every garment mockup is rendered vector — form
shading, blurred fold shadows, construction seams and topstitching,
puffed-embroidery ghosting, a fabric-displacement warp on screen prints, and a
contact shadow — no raster assets, no network, no licensing questions. The
landing page stays hand-authored HTML.

## Design

Dark-first, Pine Black ground. Wordmark and display lines in the Palatino / Book
Antiqua serif at `-0.018em`, same as every built Sixfold asset; labels and
descriptors in mono, tracked; body in a system sans. Mark is **Ridge** (Sweep is
still formally Brandon's call — swap the `<symbol>`/inline SVG if it changes).
"Land & Fire" is used as the descriptor and is an **accepted placeholder**, not a
locked tagline.

## Standing constraints honoured on every page

Per `sixfold/README.md` and `sixfold/marketing/facebook-page-copy.md`:

- **No web address printed anywhere.** `SixfoldColorado.com` is owned but not
  hosted. The day it resolves, add it to the footer and the merch contact pieces.
- No "licensed and insured", "certified", "bonded", "Firewise".
- No county cost-share by name (Douglas County included).
- No street address — service area only ("Monument, working across the Front Range").
- No price, offer, discount, or "free estimates" anywhere. **The merch board has
  no pricing and no order flow by design** — the launch offer and rate card are
  still open.
- No track record — no years in business, job counts, "trusted by", review counts.
- "We handle the paperwork for you" is banned. The landing page uses the approved
  framing: *"every job comes with the paperwork, whether or not you ask"*, and
  states where Sixfold stops (no returns filed, no carrier contact, no claims).
- No mention of Surge.
- Contact details are the standing ones: **(303) 915-1045**,
  **Contact@SixfoldColorado.com**, Monument CO.

## Merch board — what's on it

Concept directions only, each with placement / colorway / method:

Apparel — Ridge tee (primary), "Who pays for it" back tee, Ridge band tee,
crew hoodie, trucker cap, patch cap, cuffed beanie, "first five feet" field tee,
hi-vis crew shirt (*look only* — a real garment must meet the crew's actual
visibility spec).

Small goods — merrow-border patch, die-cut sticker set, enamel pin, canvas gear
tote.

On the truck / job site — truck door decal (carries the standing contact line
verbatim), coroplast job-site sign, enamel camp mug, plus a short list of further
ideas (magnetic door sign, hard-hat stickers, printed flagging tape, chip-truck
banner, water bottle, field notebook).

Slogans used, and why each is safe to print:

- **"We do the work and show you who pays for it."** — the fact-checked bio line
  from `marketing/facebook-page-copy.md`.
- **"Land & Fire"** — accepted placeholder descriptor.
- **"Slash · Chip · Haul"** — the actual work verbs from the bio.
- **"It starts in the first five feet"** — true, and the CSFS Home Ignition Zone
  guidance the pamphlet is built on; also the disarming, honest line from the ad
  script kit (the homeowner can do that zone without a crew).
- **"Fire mitigation · Front Range · (303) 915-1045"** — the standing contact line.

## Fact-check log

Claims on the landing page, all carried from already-verified Sixfold files:

| Claim | Source | Notes |
|---|---|---|
| Tax credit = 100% of contractor costs for qualifying vegetation work, up to a cap; no application, no waiting list; claimed on the state return; income limits apply | C.R.S. 39-22-543; Colorado DOR, *Income Tax Topics: Wildfire Mitigation Measures* | Verbatim posture from `facebook-page-copy.md` fact-check log |
| Through TY2026 any excess over state tax liability is lost (not refundable, no carry-forward); from TY2027 the cap rises, it becomes refundable, the income limit rises, extended through 2030 | HB26-1289; `sixfold/README.md` "strategic finding" + open-items correction | The site does **not** repeat the earlier overstatement that HB26-1289 "added thinning woody vegetation" — the bill adds a narrower beetle-kill category. Wording kept general. Recheck exact TY2027 cap/AGI figures against the enrolled bill before adding numbers |
| Since 1 July 2026, carriers using a wildfire risk score must disclose it in writing annually and give a discount for documented mitigation | Colorado HB25-1182, effective 1 July 2026 | Verbatim posture from `facebook-page-copy.md` |
| ~450 property owners claimed the credit statewide in TY2023; awareness is the binding constraint | 2026 legislative evaluation of C.R.S. 39-22-543 (cited in `sixfold/README.md`) | The Facebook copy explicitly parks this stat "in the landing page hero" |
| Work to Colorado State Forest Service standards | DOR guidance requires work to meet or exceed CSFS / DFPC standards | |
| Services list (fell, grind stumps, pile/chip slash, cut rounds, haul or stack; defensible space, fuel breaks, thinning) | `facebook-page-copy.md` long bio | No mastication claimed — Sixfold has no masticator/mulching head (equipment gap noted in `sixfold/README.md`) |
| "Not tax or insurance advice — confirm your own position with your accountant and your carrier." | Standing disclaimer on every Sixfold funding surface | |

**Unresolved / to revisit before this goes anywhere near a host:**

- Exact TY2027 credit cap and AGI limit — left as prose, needs the enrolled
  HB26-1289 text before any figure is printed.
- Forms/endpoint: there is **no contact form** — phone and email only, same as the
  reason the Surge site's forms are inert. Add a real endpoint before launch if a
  form is wanted.
- FRWRM / grant deadlines are deliberately not printed (they date fast); the
  boards band stays generic.
- `SixfoldColorado.com` on the footer + merch contact pieces the day hosting is live.
