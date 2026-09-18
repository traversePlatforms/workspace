# Sixfold Colorado — website (draft build on disk)

**Started:** 2026-09-01
**Landing page re-cut 2026-09-17** — Bone register, and the copy brought up to date with
everything settled since 1 September. See §What changed 2026-09-17.
**Status:** Draft. **Not deployed, no host, no domain resolves.** Same standing as
every other Sixfold asset — nothing published, posted, scheduled or uploaded.

This is the start of the Sixfold Colorado site, rebuilt in-repo as plain static
HTML. The earlier Astro build lived at `C:\Users\Surge Inc\dev\sixfold-site`
(outside OneDrive) and is gone with the machine that held it; this replaces it and
stays inside the workspace so it can be audited.

## Structure

**Multipage as of 2026-09-18.**

```
sixfold/site/
  index.html                  /                  home — a hub
  what-we-do/index.html       /what-we-do/       the three service lines, how a job
                                                 goes, the handover packet
  who-pays/index.html         /who-pays/         the credit and the insurer, in full
  wildfire-guide/index.html   /wildfire-guide/   the printed pamphlet, as a page
  merch/
    index.html                /merch/            concept board — GENERATED
    build-merch.mjs                              its generator
  assets/site.css                                one file, two registers (see §Design)
  serve.mjs                                      local preview on :8090
  audit-links.mjs                                links, chrome drift, copy rules
```

**Home is a hub, not the whole site.** It states the position, shows the three service
lines and the ~450 stat, points at the guide, and hands off. What used to be `#how`,
`#packet` and `#zone1` on the one-pager moved to `/what-we-do/` and `/wildfire-guide/`.

### /wildfire-guide/ — the pamphlet, as a page

The printed home wildfire pamphlet, in reading order rather than fold order (the print
piece runs 4-1-2-3 because of how it folds; here it is embers → the house → the zones →
the distances). **Copy and all six drawings are lifted from
`marketing/home-wildfire-pamphlet.html` unmodified.**

That file was rebuilt drawing-led on 2026-08-25 and then **accuracy-audited the same
day — eleven corrections**, four of which would have misdirected a homeowner's effort
and one of which printed a promise the state does not make. **This is fire-safety copy.
Do not reword a number, a distance or a mechanism on that page without reading the audit
in `home-wildfire-pamphlet.md` first.** Several phrasings that look fussy are the
corrections: *"stops most"* not "stops", *"within five feet"* not "touching", *"mature
height"* not "height", *"embers start most of the homes that burn"* not "embers burn
houses down, not flames".

The drawings were drawn against print grounds, so each sits on a plate that reproduces
what it was drawn for — the ember figure on Pine (it was the pamphlet's dark cover), the
other five on near-white — **rather than the artwork being re-coloured, which would mean
re-auditing it.**

Not carried over from the print piece: the QR code (it points at a linktree, and the
page it would sit on is the website), and the back-cover contact block (the site has a
footer).

**Links are root-absolute** (`/assets/site.css`, `/who-pays/`), the same as the Surge
site. That is what a multipage site wants, and it means **this site needs the server**:

```
node sixfold/site/serve.mjs      →  http://localhost:8090/
```

`file://` will not work any more — not the page links, not the stylesheet. That is a
deliberate trade, not a regression: the earlier "opens by double-click" claim was
already only half true, because a bare directory link cannot resolve to `index.html`
without a server.

### Keeping the pages in step

Pages are hand-authored, one directory each, **no generator** — again following Surge.
The cost of that is a duplicated header and footer, so there is an auditor:

```
node sixfold/site/audit-links.mjs
```

It checks three things and exits 1 on any failure, so it can gate a commit:

1. **Links** — every internal href resolves to a file on disk, and every `#anchor`
   exists on the page it points at, including cross-page ones.
2. **Chrome drift** — the `<!-- CHROME:MARKS -->`, `CHROME:HEAD` and `CHROME:FOOT`
   blocks must be byte-identical across pages. `aria-current="page"` is normalised
   away before comparing, since it is per-page by definition.
3. **Standing copy rules** — as greps: a web address before the domain is hosted,
   "licensed and insured", a named county cost-share, a price or free-estimate offer,
   the old phone number, a mention of Surge, the banned paperwork phrasing.

A page waives a rule for itself with `<!-- AUDIT-ALLOW: <rule-id> — why -->`, which
keeps every exception visible in the file it applies to. An unknown rule id is itself
a failure, so a typo cannot quietly switch a check off. **Two live waivers**, both
listed in the auditor's own header comment.

**The merch board is generated.** Edit `merch/build-merch.mjs`, then
`"C:\Users\Surge Inc\AppData\Local\nodejs\node.exe" build-merch.mjs` (node is
installed there, not on PATH — see the `sixfold-brand-assets` memory), then
re-screenshot in headless Chrome. Every garment mockup is rendered vector — form
shading, blurred fold shadows, construction seams and topstitching,
puffed-embroidery ghosting, a fabric-displacement warp on screen prints, and a
contact shadow — no raster assets, no network, no licensing questions. The
landing page stays hand-authored HTML.

## Design

Wordmark and display lines in the Palatino / Book Antiqua serif at `-0.018em`, same as
every built Sixfold asset; labels and descriptors in mono, tracked; body in a system
sans. Mark is **Ridge** (Sweep is still formally Brandon's call — swap the `<symbol>`
if it changes). **"Land & Fire" is the settled descriptor** as of 2026-09-16 — it is
printed on the business cards and the vehicle magnets, so the site no longer hedges it.

### Two registers from one stylesheet

**The landing page is Bone. The merch board stays Pine.** Matthew's call 2026-09-17:
the Surge site is dark, so Sixfold reads lighter and the two are not mistaken for each
other.

Every component in `site.css` now reads a semantic token (`--ground`, `--text`,
`--label`, `--accent`, `--edge` …). `:root` holds the **dark** values, unchanged from
the 1 September build, so the merch board's colours did not move. `body.paper`
reassigns the same tokens to the Bone set. **To flip a page, add `class="paper"` to its
`<body>` — nothing else.**

### Dark accents — Pine is not only at the bottom

Added 2026-09-17 on Matthew's note that the page needed some. Six inversions, spaced so
the eye meets dark roughly every screen rather than once at the foot:

| | |
|---|---|
| **The header bar** | Pine, blurred — bookends with the footer and reads as chrome, not page |
| **The `~450` card** | Pine, in the hero |
| **The `78%` card** | Pine, in `#zone1` — **figures live on dark** is now a rule, not a one-off. It was the long light stretch in the middle third |
| **The secondary CTA** | Pine solid, so the pair is Ember + Pine — the card and magnet lockup, rather than a button and a ghost of one |
| **`01 / 02 / 03`** | Pine tiles, three beats down the left of `#how` |
| **The ridge divider** | Pine and 34px, so the peaks read as the boards band rising into the page instead of a rule balanced on top of it |

Plus the two regions that invert against whichever register the page is in: the
**HOA/boards band** (Pine on the Bone page, Bone on the dark one) and the **footer**,
a dark anchor in both.

**Every inverted region re-declares the dark tokens locally** rather than hard-coding
colours, so the components inside keep working off the same names and nothing is
special-cased. Copy that pattern for any new one.

### Contrast — measured, not eyeballed

Against Bone `#EDE7DC`:

| Value | Ratio | Used for |
|---|---|---|
| `--ink #16201C` | 14.6:1 | headings |
| `--ink-body #2C3A33` | 11.0:1 | body |
| `--ink-soft #4C5A53` | 5.9:1 | secondary, `.fine` |
| `--ember-text #A64211` | 5.0:1 | **links and small ember type** |
| `--moss-text #4E6142` | 5.5:1 | kickers, labels |
| Pine on solid Ember `#E4703A` | 5.9:1 | the primary CTA |

**Ember `#E4703A` (2.6:1) and Moss `#8AA07A` (2.3:1) are decorative only on Bone** —
rules, fills, marks, borders, never type. The pre-existing `--ember-ink #B84C15` is
**4.18:1 and fails** as a body-size link colour, which is why `--ember-text` was added;
`#B84C15` is kept only where it is a large-text or graphic value (the small marks).

### Mark usage on the page

- **Flat Ridge** (`brand/sixfold-mark-ridge-flat-mono.svg`, the print/merch master) in
  the header at 26px and the footer at 30px. Solid fills with real knockout gaps, so it
  holds at small sizes where the master's layered opacity turns to mud.
- **Layered master** in the hero at 78px, where the receding opacity ramp is the point.
  Its floor was drawn for a Pine ground — at `.42` the furthest ridge all but vanishes
  on Bone — so `body.paper` raises the ramp to `.50 / .66 / .82` and keeps the
  progression. 78px rather than 62px because the roots are 0.75–1.6-unit strokes in a
  94-unit box and they went spidery at the smaller size.
- Both are `<symbol>`s defined once at the top of the document and `<use>`d.

### ⚑ A layout bug this surfaced, and the fix

Every content section is `<section class="wrap">`. `.wrap { padding: 0 24px }` is a
**class** and `section { padding: 84px 0 }` is a **type**, so the class won the whole
`padding` shorthand and **every section on both pages was rendering with zero vertical
padding** — the 84px had been thrown away since 1 September. The dark register hid it,
because the divider sits at 0.14 alpha; on Bone the rules land hard against the kickers
and it is obvious.

Fixed by splitting the groups — `.wrap` sets `padding-inline`, `section` sets
`padding-block` — which cannot collide. Same trap caught on `.hero`. **This also
changed the merch board**, which gained the spacing it was always meant to have;
re-rendered and checked.

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
- **Service region is the post-Monument set**: "El Paso, Teller and southern Douglas
  counties and the Front Range foothills", with "further out is a phone call, not a
  refusal". The 1 September page said "working across the Front Range", which overclaims
  from a Monument base — 35 miles does not reach Arapahoe or Jefferson. Wording matches
  the pamphlet and Sheet D, not sheets A/B/C, which are still stale.
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

## What changed 2026-09-17

Everything settled since 1 September, brought onto the page.

| Change | Where it comes from |
|---|---|
| **Bone register** | Matthew, 2026-09-17 — the Surge site is dark, Sixfold reads lighter |
| **The service line is three things, not one**: fire mitigation · land clearing · landscaping. Title, meta description, hero, `#work` and the footer all carry it | Settled 2026-09-16 (`operations/business-cards.html`), printed on the cards and the vehicle magnets (`brand/vehicle/README.md`) |
| **"Land & Fire · Colorado"** as the header/footer descriptor, no longer hedged | Same — settled, on durable print |
| **`#work` rebuilt as three service lines** with the Sheet D working-list framing underneath | `marketing/services-onesheet-d.md` |
| **New `#how`: walk → work → handover**, and the quote comes off a counted sheet | `operations/quote-walk-sheet.md`, `operations/job-closeout.md` |
| **`#paperwork` → `#packet`**, now the real handover folder, item by item | `marketing/referral-packet.html` (six pages, built 2026-09-15) |
| **New `#zone1`** — the highest-value work is the part the homeowner does alone | `content/03-first-five-feet-post.md` |
| **Service region corrected** to the post-Monument counties | `sixfold/README.md` §The move to Monument |
| **Flat Ridge at small sizes** | `brand/build-mark-flat.mjs`, built 2026-09-16 |
| **The `~450` stat now shows its source** on the page | Already in this log; it was uncited in the markup |
| **Merch board nav re-pointed** to `#how` / `#packet` and its descriptor updated | The landing page's anchors were renamed, which broke `../#paperwork`. Generator edited and re-run — the board is generated, never hand-edited |

### ⚑ Three things for Matthew to decide — not decided here

1. **Stump grinding.** It is on the page (`Stumps` in the fire-mitigation tags), as it
   was on 1 September, and it is in the **facebook/Square bio** and priced as a line in
   the **quote engine** (badged *Unbacked*). But Brandon instructed on 2026-08-25 that it
   come **off Sheet D entirely** — "do not re-add it". That instruction was recorded as
   scoped to that document, so it was **not** applied here. **The two surfaces now
   disagree.** Either it is a service or it is not; the site should follow whichever.
2. **The Colorado Springs 15 ft licence is not mentioned on the page.** Standing crew
   rule is to stop and call in on any tree 15 ft or taller inside city limits, and the
   licence is blocked on GL and workers comp Sixfold does not hold. Disclosing that on a
   public page is honest and also advertises a gap in the home market — **Matthew's
   call, deliberately left off** rather than decided quietly. El Paso County is named as
   a service region, which is what every other file does.
3. **The referral packet prints `SixfoldColorado.com`** on its footer, against the
   standing "no web address anywhere until it resolves" rule. Not touched — it is a
   different document and out of scope for this pass — but it is a live exception.

Also still open, unchanged: the **landscaping and land-clearing detail** is written from
Brandon's 2026-08-25 list, which he called provisional (*"once I know for sure what we
are limited to I'll update you"*). The page's wording is deliberately capability-shaped
rather than a boundary, but the detail should be re-read when he confirms.

---

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
| **Zone 1 is the ground from the wall out to five feet**, and nothing in it should burn — needles off the foundation and deck, wood mulch swapped for gravel, firewood out to 30 ft, combustible fencing removed within 5 ft | Colorado State Forest Service Home Ignition Zone checklists (csfs.colostate.edu), via `content/03-first-five-feet-post.md` | **Colorado numbers this strip Zone 1; California's scheme calls it Zone 0.** The page says so explicitly — using the wrong set in local copy is an immediate tell |
| **71,000+ properties, 2016–2019; buildings with a lot of vegetation within 5 ft were destroyed 78% of the time, close to twice the rate** of those with little | IBHS news release 8 April 2021, *"Nearly Doubling a Property's Wildfire Survival Rate"* — Zesty.ai study with IBHS | Deliberately **not** phrased as IBHS's own headline "cuts your risk in half": that reads as a promise about one specific house, and the underlying finding is a comparison of destruction rates between two groups |
| **Service line: fire mitigation · land clearing · landscaping** | Settled by Matthew 2026-09-16; printed on `operations/business-cards.pdf` and all three vehicle magnets | "Defensible space" was dropped rather than added as a fourth — it restates fire mitigation |
| **Landscaping = mowing, edging, beds, planting** | Brandon's 2026-08-25 list (Sheet D); the mowing/edging/beds/planting row on `operations/job-closeout.md`, added because **job 2 was mostly landscaping** and nothing on the walk sheet captured it | Brandon called the list provisional — see the open item above |
| **The handover folder's six contents** | `marketing/referral-packet.html`, the six-page template built 2026-09-15 | "Programs in your county" names **no** county and no program, and states that all of them need approval *before* work starts — which is the opposite of implying Sixfold is on an approved list. The Douglas County hard rule is intact |
| **The quote comes off a counted sheet, not an impression** | `operations/quote-walk-sheet.md` (site-walk capture sheet) and `quotes/quote-engine.md` | No price, rate or mechanism is stated — only that the count exists |
| **Photographs from fixed positions before anything comes down** | Referral packet p.2 and the standing paperwork posture | |

**Unresolved / to revisit before this goes anywhere near a host:**

- ~~Exact TY2027 credit cap and AGI limit~~ — **CLOSED 2026-09-18, and this entry was
  stale.** The pamphlet's accuracy audit of 2026-08-25 already resolved it: the figures
  are **$2,000, refundable, $300,000 AGI**, confirmed against the Office of the State
  Auditor's Exhibit 4, and the audit also confirmed the limit is **federal AGI**, not
  federal taxable income. It flags a trap worth keeping: the General Assembly's own
  bill summary for HB26-1289 mentions only refundability and the beetle definition,
  and separately raises an *unrelated* credit from $1,000 to $2,000 — close enough to
  look like a transcription error. Reading the bill summary alone would suggest the
  figures are wrong. They are not. `/who-pays/` prints them.
  <br>*(The superseded entry read: "left as prose, needs the enrolled HB26-1289 text
  before any figure is printed." It had been overtaken by the audit for three weeks.)*
- Forms/endpoint: there is **no contact form** — phone and email only, same as the
  reason the Surge site's forms are inert. Add a real endpoint before launch if a
  form is wanted.
- FRWRM / grant deadlines are deliberately not printed (they date fast); the
  boards band stays generic.
- `SixfoldColorado.com` on the footer + merch contact pieces the day hosting is live.
