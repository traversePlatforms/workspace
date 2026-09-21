# Sixfold Colorado — website (draft build on disk)

**Started:** 2026-09-01
**Landing page re-cut 2026-09-17** — Bone register, and the copy brought up to date with
everything settled since 1 September. See §What changed 2026-09-17.
**Status:** Draft. **Not deployed, no host, no domain resolves.** Same standing as
every other Sixfold asset — nothing published, posted, scheduled or uploaded.
**Full-site audit 2026-09-19** — see §Audit 2026-09-19. Everything it found that
cannot be done on disk is in **[LAUNCH.md](LAUNCH.md)**, which is the file to open
the day this goes on a host.

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

**⚑ Why the header has no roots, asked and re-tested 2026-09-20.** The header renders at
26px across a 94-unit viewBox, so the root strokes — 0.9 to 1.6 units as drawn — land at
**0.25 to 0.44 CSS pixels**. They were proofed at 26 / 34 / 44px and at ×1.9 and ×2.8
stroke weights, in isolation and in a simulated header bar: at 26px they read as a smudge
below and right of the mark at every weight, and thickening them far enough to register
stops them looking like roots. The layered opacity ramp merges into one orange mass at
that size as well. **The flat mark is the legible one in the header**, and that is the
whole reason the flat master exists. Roots belong where they are already: the hero, at 78px.

### The hero mark animates in

Lifted from `brand/ridge-mark.html`, where the mark was drawn and where this timing was
worked out: the ridges rise furthest-first over ~0.6s, the pine last of the five, then the
ten roots delve by `stroke-dashoffset` once the range has settled. Once, on load.

- **Hero only.** The header is the flat mark and has nothing to animate.
- `transform-box: fill-box` is load-bearing — without it `transform-origin` resolves
  against the SVG viewport rather than each shape, and the peaks scale from off-mark
  instead of up out of the ground.
- Fill mode is `both`, so **the end state is the static mark**. If the animation never
  runs, nothing is missing.
- Wrapped in `prefers-reduced-motion: no-preference`. Verified under emulated `reduce`:
  the mark is complete and still at every frame.
- Class names are `grow` / `rootline` / `g1–g5` / `r1–r10`, all scoped under `.lockup`
  and checked against the stylesheet first — see the `.money` collision recorded in
  `operations/README.md` for why that check now happens before the markup is written.

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
- ~~Forms/endpoint: there is no contact form~~ — **STALE, closed 2026-09-18.**
  /contact/ exists, with a real form posting to `api/submit.php` on the Surge
  pattern. What is still open is that **the PHP has never run** — the dev server
  answers that path by logging — so the mailbox, SPF/DKIM and spam-filing all
  have to be proved on the host. That moved to [LAUNCH.md](LAUNCH.md) §3, with
  the rate-limit and log-retention questions the audit raised alongside it.
- FRWRM / grant deadlines are deliberately not printed (they date fast); the
  boards band stays generic.
- `SixfoldColorado.com` on the footer + merch contact pieces the day hosting is live.

---

## Matthew's first review — 2026-09-18 evening

Five things, all done except the colour change on the tabled merch board, which was
his call to leave.

### 1. Merch — tabled

**Off the site.** Moved to `_tabled/merch/` (generator and output together, so it still
builds). Removed from the header and footer nav on every page. `serve.mjs` refuses to
serve anything under `_tabled/`, and `audit-links.mjs` skips it, so it can neither be
reached nor break the link audit while parked.

Matthew: *"I 100% plan on putting it back on but we don't currently have vendors or
suppliers for that part of the business yet."*

**When it comes back — the colour is the work.** The board is still the dark register.
Flipping it is *not* just adding `class="paper"` to the generator's body tag: every
garment mockup sits on a dark radial gradient (`.card .mock`) and the dark-shirt renders
were tuned against it. On Bone the mocks will need a lighter plate (there is already a
`.card.light .mock` gradient to start from) and the dark garments will need their
shadow/highlight passes re-checked. Budget a proper render-and-look session, not a
one-line edit. To preview it in the meantime: `git mv` it back out of `_tabled/`, or
temporarily drop `_tabled` from the `BLOCKED` regex in `serve.mjs`.

### 2. Contact is a page: `/contact/`

Was a `#contact` anchor at the foot of the home page. Now its own page, built the way
the Surge site's contact page is built, minus the parts Sixfold does not need:

- **One form, not three.** A chooser at the top — *Fire mitigation · Landscaping · Both ·
  Just a question* — sets a hidden `need` field and swaps the prompt above the message
  box (a landscaping customer is not asked how many trees they have). The fields are
  the same for everyone because what we need in order to come and look is the same
  for everyone: who, where, how to reach you.
- **Phone and email sit beside the form the whole time.** The form is the option, not
  the gate. Matthew: *"unless they would rather just contact us via email or phone."*
- **Submits to `/api/submit.php`** — the same mechanism Surge uses on its host: a PHP
  `mail()` handler with a honeypot, a JSON-line backup log, JSON back to a fetch submit
  and a 303 to `/thank-you/` for a no-JS submit. `api/config.php` holds the mailbox
  (`Contact@SixfoldColorado.com`) and needs a real `website@SixfoldColorado.com` sender
  created on the host, or the mail is treated as forged. **`.htaccess` denies the log
  and the config.**
- **The dev server answers the same path** by logging to `%TEMP%\sixfold-submissions.log`,
  so the form works end to end locally. Exercised with curl: valid submit → `{"ok":true}`;
  missing phone → 422 with the message; honeypot filled → silent ok; no-JS submit →
  303 to `/thank-you/`.
- **`assets/site.js`** is the only script on the site and only `/contact/` loads it.
  Progressive: without it the chooser still works (default radio) and the form still
  posts natively.

The home page keeps a short `#contact` section — CTA to the page, plus phone and
email — so old links still land somewhere sensible.

### 3. "Sixfold" → "Sixfold Colorado"

Matthew asked whether the site should say *Sixfold Colorado* rather than *Sixfold*,
since Nextdoor, Facebook and the domain all do. **Yes — on the site.** Header wordmark,
hero lockup and footer now read *Sixfold Colorado*, with the descriptor shortened to
*Land & Fire* so "Colorado" does not appear twice. Body copy that named the company
("Sixfold works as the contractor…") now says *Sixfold Colorado*.

**What did not change, on purpose:** the printed lockup on the business cards, the
vehicle magnets and the agreements still reads *Sixfold* / *Land & Fire · Colorado*.
That is the logo, it is on durable print, and the legal party on the agreements is
*Sixfold, LLC* regardless. The site is the customer-facing name; print is the mark.
If Matthew wants print to follow, that is a separate pass through `business-cards.html`,
`brand/vehicle/build-magnets.mjs` and the agreement mastheads.

### 4. The home page addresses both audiences

It was fire-only from the first line: *"Fire mitigation on Colorado's Front Range"*,
the ~450 stat in the hero, *"Two parties will help cover this"* as the second section.
Matthew: *"I want the home page to read as if it's being addressed to both parties.
And the individual characteristic should be page dependent."*

- **Hero** is now *Fire mitigation and landscaping on Colorado's Front Range*, with
  *One crew for the clearing, and for putting the ground back afterwards* under it.
  The stat came out of the hero; the right column is now the service area.
- **Two doors** replace the fire-only money section: *If it's fire mitigation* (the
  two-parties hook and the ~450 card, pointing at `/who-pays/`) beside *If it's
  landscaping* (same-crew, own agreement, and — stated plainly — not eligible for the
  credit, pointing at `/what-we-do/#landscaping`).
- The fire specifics live in full on `/who-pays/` and `/wildfire-guide/`, which is
  where they belonged.

### 5. The ridge divider

Matthew liked the mountains, asked about the white line, and floated larger peaks,
a dirt-coloured line, or snow caps.

**The white line was a bug** — the `.band` section's own `border-top` hairline, which
on the Bone register renders light and sliced the peaks off from the band below.
`.ridge-rule + .band { border-top: 0 }` removes it; the mountains now sit flush on
their ground.

**Rebuilt as two ridges, 60px (was 26px):** a far ridge in Timber behind a near ridge
in Pine — receding peaks, which is the Ridge mark's own idea, so the divider and the
logo share a language. Snow caps were considered and not done: on a Bone sky a Bone
cap is invisible and a grey one reads as a truncated peak, not snow. If a snow-capped
version is wanted it needs a different sky. Same SVG on all four pages that use it.

### Checked

`audit-links.mjs` clear across six pages (contact and thank-you added). No horizontal
overflow at 320 / 390 / 768 / 1280 on `/contact/`. The chooser cards needed two fixes
found by rendering, both recorded in the stylesheet: `.form label` and `.form input`
were reaching into them.


---

## Audit 2026-09-19

A full pass: the file-level auditor, plus a new runtime one that drives a real
browser over **six pages at 390/768/1280/1600** and checks what only exists once
the page is laid out — contrast composited against the actual painted
background, broken images, console errors, tap targets, heading order, form
semantics. Findings and fixes:

**Security — a real one.** `api/submit.php` built the mail Subject from the
town field, which was never stripped of carriage returns, while the comment
directly above claimed "nothing user-supplied goes into a mail header
unescaped". `$name` was stripped; `$town` was not. A town of
`Monument\r\nBcc: …` added a header to the outgoing mail. All three
header-bound values now go through one `$hdr()` helper. Never exploitable on
disk — the dev server does not run PHP — but it would have shipped.

**Printing the wildfire guide.** That page tells the reader it is a weekend's
work, so it gets printed. Browsers drop background colours when printing, and
the ember drawing is Bone and sage **on** a Pine plate: it printed washed out,
the house body a barely-there tint on white. There is now a print stylesheet
that forces the plates with `print-color-adjust: exact` and drops the site
chrome. **It does not re-colour any artwork** — each drawing was made for a
specific ground, and re-colouring means re-running the pamphlet's accuracy
audit.

**The `<head>` was unguarded.** `CHROME:HEAD` is the `<header>` *element*;
the actual head was hand-maintained on six pages with nothing watching it. There
is now a `CHROME:META` block and `audit-links.mjs` compares it like the
others — one line, because `BLOCKS` was already a list.

**Added:** a favicon (a reduction of the Ridge mark — two peaks and the ground
bar, since the pine and the four peak slivers turn to mush at 16px; proofed at
16/32/64), an apple-touch icon, a 1200×630 share image, `role="status"` and
`role="alert"` on the form messages (the form is `novalidate` and submits by
fetch, so a screen reader user was told nothing at all), and phone padding on
the footer links and header CTA — 20px tall with 8px gaps passes WCAG 2.2 2.5.8
on the spacing exception, but it is fiddly with a thumb.

**Corrected:** two meta descriptions ran 187 and 190 characters and truncate in
a result page; `/thank-you/` had none. And the `/who-pays/` link added two
commits earlier said "a quote that itemises it" — a quote cannot itemise a tax
credit, and the site's own promise, stated twice elsewhere, is an *invoice* that
separates the mitigation work. It now says that.

**Clean, and worth recording as checked:** contact details across all six pages
(28 × the Contact@ address, 17 × the 303 number, 9 × `tel:+13039151045`, zero
hits for the old 720 number), HTML structure, heading order, duplicate ids, alt
text, the landscaping-standalone copy rule, `body.paper` everywhere, and —
once the auditor composited translucent backgrounds properly — **every text
colour on the site passes its WCAG ratio**.

### ⚑ Two false alarms, recorded so they are not re-reported

The first run of the runtime auditor claimed four header contrast failures and a
missing form label. Both were bugs in the auditor. `--head-bg` is
`rgba(14,21,18,0.9)` and the background walker skipped anything under alpha
0.95, so it compared light header text against the Bone page behind it; it now
composites the whole stack. The honeypot already carries `aria-hidden` and
`tabindex="-1"`, which is correct, and the probe now skips controls that are
deliberately out of the accessibility tree. It also reported three photographs
as broken — they were `loading="lazy"` and below the fold when it looked.

### Running it again

```
node sixfold/site/serve.mjs            # must be up first
node sixfold/site/audit-runtime.mjs    # needs Chrome at the path at the top of the file
```

It is **kept in the repo** rather than left in a scratchpad because it found the
Subject-header bug, and a session folder is not somewhere a finding like that
should live. It is the slow one — 24 full renders, a couple of minutes — so
`audit-links.mjs` stays the one that runs before every commit and this one runs
before a launch or after a change to the chrome, the stylesheet or the form.

It exits non-zero on a failure, so it can gate something later. Two traps are
already handled in it and should stay handled: every CDP call is raced against a
timeout (two runs deadlocked on a reply that never came), and each page is
scrolled top to bottom before probing, or `loading="lazy"` photographs below the
fold get reported as broken.

---

## Matthew's review — 2026-09-20

Two layout fixes on the home page, then a copy pass driven by one theme: **the
three services are three services.** Nothing here changed a fact, a number or a
distance.

### Layout

**The lockup was out of alignment, and it was real.** "Land & Fire" sat about
**13px below** the wordmark's baseline. The two spans were siblings in the 78px
lockup row — the wordmark centred, the descriptor `align-self: flex-end` with
`padding-bottom: 8px` — so the descriptor was pinned to the row's bottom rather
than to the wordmark. They are now nested in `.names`, baseline-aligned to each
other, and that pair is centred against the mark. **Measured after the fix: 0px
drop at 768, 1280 and 1600.** At 390 it is 20.6px, which is correct — the phone
rule drops the descriptor onto its own line.

Nesting is what makes this work. `align-items: baseline` on `.lockup` itself
would have baseline-aligned the SVG too, and an SVG's baseline is its bottom
edge, so the mark would have dropped relative to the text.

**The h1 moved above `.hero-grid`.** Inside the grid's 1.12fr left cell at
`max-width: 18ch` it broke over four short lines against an empty right half.
Full column width now, `max-width: none`, and the clamp tops out at 52px rather
than 60px so the longer three-service headline lands on **two lines at 1280 and
1600** (1032px wide) instead of three. It also now names **all three** services;
it said "Fire mitigation and landscaping" and dropped land clearing, while the
`<title>` and the service line both carried all three.

**⚑ Moving the h1 broke something else, which is why this got rendered rather
than just measured.** `.hero-aside` was `align-self: end`, added when the left
cell was four stacked blocks and a short note left a void beneath it. With the
h1 gone the left cell is three blocks, so bottom-aligning put the void **above**
instead — the rule and "Based in Monument" started ~60px below the pull quote
they sit beside. Now `align-self: start`.

`.say` also got `text-wrap: balance`; unbalanced it broke mid-clause
("Book one," / "two, or all three").

### The alignment scan

Every block in `main .wrap` on five pages at 390/768/1280/1600. Result: exactly
**two left edges per page per width** — the section containers, and the 24px
gutter every one of their children shares. No stragglers, nothing half-indented.
The hero wordmark sits inboard of that gutter by the width of the mark, which is
the lockup working as intended, not drift.

### Copy — what came out, and why

- **"One crew for all three"** (hero and the meta description). It reads as a
  headcount, and the company is hiring. Now "Each service stands on its own.
  Book one, two, or all three."
- **Every "by the acre"** — the home cards, the `By the acre` tag, and both
  `/what-we-do/` sections. **Pricing and unit are still being worked out and the
  site should not state one.** Removed, not softened.
- **"the same crew does both" / "one crew does both"** (home landscaping card,
  home landscaping door, `/what-we-do/` landscaping). Same headcount problem,
  and it framed landscaping through the other two. Each service now describes
  itself and only itself.
- **"Same crew, same walk, same paperwork"** (`/what-we-do/` lede) → each is
  quoted on its own agreement and priced on its own.
- **"Same disposal question as above"** (`/what-we-do/` land clearing) — a
  cross-reference that made the section depend on the one before it. Rewritten
  to stand alone.
- **"What we take on, and what we don't"** → "Everything landscaping covers".
  The old wording advertised a boundary.
- **The `.scope` block** said "what the current crew and kit can take on … not
  from what we are willing to quote" — headcount *and* a limit. Now "The lists
  above are where we start, not where we stop. If what you need is not on one of
  them, ask."
- **"It is not wildfire mitigation and it does not qualify for the credit — we
  say so up front rather than let anyone assume."** Cut. The
  telling-you-we're-being-transparent register reads as condescension. **The
  fact itself is not lost** — what qualifies is defined on `/who-pays/`, which
  is the page that carries the credit. A site-wide grep for the same register
  found only one other hit, and it went with the disposal rewrite above.
- **"Free to read, nothing asked for"** → "A homeowner's guide".
- **"Most of it is a weekend's work and none of it needs us"**, and the two
  `/wildfire-guide/` variants, and "the parts you can do yourself in a weekend"
  on `/what-we-do/`. These turned work away. The guide still hands the homeowner
  everything; it now says "Work through it yourself, or hand any of it to us"
  rather than "none of it needs us".

**On the guide edits:** all three touched framing sentences only. **No number,
distance or mechanism on that page was altered** — the 2026-08-25 accuracy audit
still stands unmodified.

### ⚑ One thing deliberately not written

The landscaping door needed a second sentence and the obvious one would have
described a service cadence — weekly, seasonal, annual. **There is no source for
what Sixfold actually offers there**, so it says "Tell us how you want the ground
kept and we'll walk it with you" instead. Worth settling with Brandon.

### Checked after

`audit-links.mjs` all clear. `audit-runtime.mjs` **0 failures**, the one standing
warning being the pre-launch canonical link. A first run also printed
`net::ERR_ABORTED` on `/ @390`; it did not reproduce on a clean run and no
resource was added in this pass — it is the first navigation of the run racing
Chrome's startup, not a page fault.

### Service area — the county list came out, same day

Matthew: don't list counties, say it's all around Colorado, and convey "further
out is fine" **without** a sentence saying so. The list and its disclaimer were
in **six places across five pages**, in three shapes — all changed together,
because changing one and leaving five is how a site starts contradicting itself:

| Where | Was | Is |
|---|---|---|
| home hero aside | "El Paso, Teller and southern Douglas counties, and the Front Range foothills. Further out is a phone call, not a refusal." | "Working across Colorado — the Front Range, the foothills, and out from there. Tell us where the property is." |
| `/contact/` "Where we work" | same, prefixed "Based in Monument." | "Based in Monument, working across Colorado. Tell us where the property is and we'll set a time to come and look at it." |
| `/what-we-do/` `.scope` | "…working El Paso, Teller and southern Douglas counties and the Front Range foothills; further out is a phone call, not a refusal." | "…Based in Monument, working across Colorado." |
| 3 × contact blocks (home, `/who-pays/`, `/wildfire-guide/`) | "Monument, Colorado — El Paso, Teller and southern Douglas counties" | "Monument, Colorado — working across the state" |

The reach is now carried by an **invitation** ("tell us where the property is")
instead of a **negation** ("not a refusal"), which was the actual ask.

Two more that had to move with it, or the site would disagree with itself:

- **The shared footer** said `Front Range · (303) 915-1045` on all six pages.
  Now `Colorado · …`. It is inside `CHROME:FOOT`, so all six had to change
  identically anyway — the drift auditor enforces it.
- **`/what-we-do/`'s meta description** still read "what the crew and kit can
  take on" — the exact phrase removed from that page's body an hour earlier. A
  body edit that leaves the `<meta>` behind is easy to miss because nothing on
  the rendered page shows it.

### ⚑ Two things this leaves open

1. **The home `<h1>` and the home meta description still say "on Colorado's
   Front Range."** That is now the most place-limiting sentence left on the
   site, and it is the headline — **not changed without Matthew, because it is
   positioning, not a list.**
2. **Local SEO.** Place names are most of how a local trade business is found,
   and "El Paso", "Teller", "Douglas", "Monument" (×3) and "Woodland Park" were
   doing that work. "Monument" survives in the hero kicker, the contact blocks
   and the town-field placeholder; the county names are gone. Worth deciding
   deliberately rather than discovering after launch — a "where we work" page,
   or the counties in schema rather than in copy, gets both.

### And back again — place names restored, 2026-09-20

Matthew, on being told the SEO cost: go with place names, he can explain it to
the team that way — and asked whether to list **more** counties.

**The answer to that was no, and the reason was in this repo.** The three
counties are not a cautious guess: [`sixfold/README.md`](../README.md) records
*"35 miles from Monument does not reach Arapahoe or Jefferson"* — the area was
deliberately **narrowed** from Arapahoe · Douglas · Jefferson when the company
left Englewood, and that narrower list was then applied across the rate card,
marketing plan, platform sheet, minimum-viable-start sheet and the pamphlet.
Widening it on the website alone would have put the site out of step with five
documents and quietly reversed a decision that the same file says still **needs
Brandon's review**. Sheets A/B/C are already stale in the other direction.

**And more counties is not where the SEO is.** A stacked county list reads as
keyword stuffing. What ranks a local trade business is town names in ordinary
sentences, a Google Business Profile, and `areaServed` schema — and the schema
can carry a wider, more precise area than the prose, which is the split worth
having. So: same three counties, towns back in the copy, schema added.

| Where | Now |
|---|---|
| home hero aside | counties, then Colorado Springs, Black Forest, Palmer Lake, Woodland Park, Larkspur, Castle Rock |
| `/contact/` "Where we work" | the fullest list — adds Gleneagle, Divide, Florissant, Sedalia |
| `/what-we-do/` `.scope` | counties only; the section is about scope of work, not geography |
| 3 × contact blocks | back to "Monument, Colorado — El Paso, Teller and southern Douglas counties" |
| shared footer (6 pages) | `El Paso · Teller · Douglas · (303) 915-1045` — was `Front Range` |

`/what-we-do/`'s meta description came back to the counties too, and was then
**cut again at 164 characters** — inside the auditor's 165 limit but close
enough to the truncation line to lose the tail in a result page.

### The schema

`LocalBusiness` in `index.html`, between `<!-- SEO:SCHEMA -->` markers, **home
page only**. Three counties as `AdministrativeArea`, eleven towns as `City`.

It sits **outside** `CHROME:META` on purpose — that block is compared byte for
byte across all six pages, and this one is per-page.

**⚑ Written down because each was a judgement, not an oversight:**

1. **It went on `/contact/` too, then came off.** Two `LocalBusiness` blocks
   with no shared `@id` can be read as two businesses. At launch, `@id` goes in
   and then it can live on both — `LAUNCH.md` §6.
2. **`url`, `@id` and `image` are absent** — all three need the domain, and the
   `web-address` copy rule blocks it until it resolves. §6 has the exact keys.
3. **`streetAddress` is absent, and it costs something.** Sierra Way is on the
   agreements because a cancellation notice needs an address post is collected
   at; publishing it is a different act. Google wants a full address for the
   local pack. **Matthew's call — not made here.**
4. **`areaServed` says Douglas County where the copy says *southern* Douglas.**
   Schema cannot say "southern". The town entries are what pin it down.

**And the thing that matters more than any of this:** a Google Business Profile
outranks anything in the markup for a local trade. The schema supports a
profile; it does not substitute for one.

## robots.txt and sitemap.xml — 2026-09-20

The last two buildable items from `LAUNCH.md` §4. Both are **uploaded** files,
unlike everything in §2's do-not-upload list.

**Five URLs in the sitemap, not six.** `/thank-you/` is `noindex`, and listing a
noindex URL is a contradiction Search Console reports as an error. LAUNCH.md's
own note said six — it was counting pages rather than indexable ones, and is
corrected.

**`lastmod` is each page's last commit date from git**, not today's date stamped
across all five. A sitemap whose `lastmod` moves every time anything is rebuilt
teaches crawlers to ignore the field. **No `<priority>`, no `<changefreq>`** —
Google has ignored both for years and they are two more things to fall out of
step.

**These two carry the absolute domain, and nothing else on the site does.** A
sitemap `<loc>` has no relative form, so this is the one place the rule gives
way. Settled while writing it: the domain is **`SixfoldColorado.com`**, owned
since 2026-08-21 — `sixfoldland.com` was **never registered**, and the
references to it in `marketing/funding-one-pager.md` are a struck-through
historical note, not a second domain.

### The auditor now checks the sitemap

Fourth check in `audit-links.mjs`, against the same `pages` list the other three
use: every page is listed **except** the ones declaring `noindex`, every noindex
page is **absent**, every `<loc>` is absolute https, none points at
`index.html` instead of its directory, and all of them share one host.

**It was tested by breaking it, not by watching it pass.** A check that has
never failed proves nothing. Dropping `/contact/`, adding `/thank-you/`, adding
a `/gallery/` that does not exist, pointing a `<loc>` at `index.html` and
mixing in a second host produced **six findings, one per fault**, and the file
was restored afterwards.

### ⚑ Two things found while wiring it up

1. **`serve.mjs` had no `.xml` MIME type.** `sitemap.xml` fell through to
   `application/octet-stream`, which a browser offers as a download — so the one
   thing you would open it to check, that it is well-formed XML, was the one
   thing you could not see. Added. Confirmed over HTTP afterwards:
   `robots.txt` → `text/plain`, `sitemap.xml` → `application/xml`, while
   `README.md`, `audit-links.mjs` and `api/submit.php` still return **403**.
2. **The port was held by a stale `serve.mjs` from an earlier session**, which
   answered the first check with the *old* MIME map and made the fix look like
   it had not worked. Worth remembering: a 200 from :8090 does not prove the
   server is running the code you just edited. Byte-compare against disk, or
   restart it.

## Per-service booking links — 2026-09-21

Matthew: under each of the three cards on the home page, a link to where they can
book or fill out the form.

Each card now ends with one, pushed to the bottom of its own card so the three
line up across the row regardless of how much text sits above them — `margin-top:
auto`, which needs `.lines3 > div` to be a **flex column**, because a grid item
stretches but its children do not. Measured after: all three at the same `y`.
`auto` beats `.more`'s 28px, so the breathing room is `padding-top` instead, or a
short card would close up on its link.

### ⚑ The ask exposed a real gap

**The site sells three services. The contact chooser offered two.** Fire,
landscaping, both — **no land clearing**. Anyone wanting it had to file themselves
under fire mitigation or "both", which flatly contradicts the 2026-09-20 pass that
made the three stand on their own. A "Book a land clearing walk" link would have
pointed at an option that did not exist, so this had to be fixed for the ask to
work at all:

- `/contact/` gains a **Land clearing** radio and its own message prompt.
- **"Both" became "More than one"** (`both` → `multiple`). With three services
  "both" no longer says which two.
- `api/submit.php`'s `$needs` map gains `clearing` and the renamed `multiple`.
  **The keys in that map, the radio values and the home page's `?need=` values are
  one set** — a comment in the PHP now says so.

### The links preselect

They point at `/contact/?need=fire|clearing|landscaping`, and `site.js` selects the
matching radio on load, so someone who clicked "Book a landscaping walk" is not
asked to pick landscaping again. It **only ever selects a radio already on the
page** — nothing from the query string is written into the DOM.

Verified in a real browser, not by reading the code: each value selects its radio
**and** swaps the message prompt; `?need=bogus` and `?need=<img src=x onerror=…>`
both fall back to the default radio, and the injected markup does not reach the
DOM. Without JS the link still works, it just lands on the default.

### Two auditor changes

1. **`audit-links.mjs` was resolving the query string as part of the path**, so it
   called all three new links dead. It now splits the hash off first, then the
   query — `"?a=b#c"` puts the hash last, so that order leaves a clean query.
2. **New check: a `?need=` value that the target page has no radio for.** The link
   would work and the chooser would silently ignore it — the same class of drift as
   the missing land-clearing option. Tested by pointing one at
   `?need=stumpgrinding`, which failed as it should.

### What is NOT proved

The `$needs` change is **unexecuted**. `serve.mjs` answers `/api/submit.php` with
its own logger, so posting all five values returned `{"ok":true}` from the **dev
stand-in**, not from PHP. Real behaviour is still gated on a host — LAUNCH.md §3.

`audit-links.mjs` all clear (108 links). `audit-runtime.mjs` 0 failures.

## DIY framing out of the guide — 2026-09-21

Matthew, reversing part of yesterday's fix: *"Dont say that, we want the work we
dont need to be encouraning people to do it themselves."* Yesterday's edit replaced
"none of it needs us" with "work through it yourself, or hand any of it to us" —
he wants the first half of that gone too. Four places, all removed.

### ⚑ Neither "you can do this" nor "we do all of this"

The obvious swap is "**we** do all of this", and the `#house` seven are a **Class A
roof, clearing gutters, 1/8-inch vent mesh, screening under decks, tempered glass,
six inches of siding clearance and a non-combustible fence** — roofing, glazing,
carpentry, fencing. A blanket "every number on the drawing is a job we take on"
promises trades the company has not said it has.

**Matthew's ruling when that was put to him settles the pattern**, and it is not
the one I first wrote: *"We wont know if 'we do all of this' until we actually have
a conversation with them. But the last thing we need to do is encourage others to
do it themselves."* So the page must do **three** things at once — no DIY
encouragement, no promise it cannot keep, **and no boundary**, because whether
Sixfold takes a given job is settled in the conversation, not on the page.

**My first attempt failed the third.** It cut the `#house` sentence to silence and
put *"This is the work we do"* on `#zones` — which reads as a contrast against the
section above it, i.e. an advertised limit. Corrected:

- `#house` ends **"Ask us about any of it."** — an invitation, which claims
  nothing and rules out nothing.
- `#zones` states the trade **plainly rather than contrastively**: "Felling,
  thinning, spacing and clearing to these distances is what we do."

Both carry comments explaining the constraint, so the next pass does not helpfully
add back either the DIY line or the blanket promise.

| Where | Was | Is |
|---|---|---|
| home band | "Work through it yourself, or hand any of it to us." | "Read it, then have us walk the property." |
| guide, page lede | "Everything on this page is yours to do, or to hand to us." | "Have us walk it and tell you where your property actually stands." |
| guide, `#house` | "…a job you can take on yourself, or have us take on." | "Ask us about any of it." |
| guide, `#zones` | — | *(added)* "Felling, thinning, spacing and clearing to these distances is what we do." |
| `/what-we-do/` | "…including the parts you can do yourself, and the parts you can hand to us." | *(clause cut)* |

**No number, distance or mechanism was touched** — the 2026-08-25 accuracy audit
still stands. Every edit here is a framing sentence.

Auditors: links all clear, runtime 0 failures.

## Contact routes are parallel, not either/or — 2026-09-21

Matthew on "Or skip the form and just call": *"I think it should be offered as
another option not as a do one or the other."*

"Skip the form" framed the phone as an **escape** from the form — it disparages the
thing it sits under and makes the reader choose a side. The routes are now listed
flat, in the same breath, with no preferred one.

| Where | Was | Is |
|---|---|---|
| home `#contact` | "…Or skip the form and just call." | "Form, phone or email — all three reach us." |
| `/contact/` lede | "…and we'll set a time — or skip the form and call." | "Fill in the form, call, or email — whichever suits you — tell us what's on the property, and we'll set a time." |
| `/contact/` aside kicker | "Or just reach us" | "Phone or email" |
| `/contact/` meta description | "…Or just call (303) 915-1045." | "…Form, phone or email." (149 chars) |

The aside kicker mattered as much as the sentences: **"Or just reach us" makes the
whole panel an afterthought** to the form beside it.

### ⚑ Caught while rewriting these: two services, not three

Both sentences said **"whether it's fire mitigation or landscaping"** — **land
clearing was missing from both**, on the home page and on `/contact/`. Same defect
as the contact chooser fixed earlier today, in the prose rather than the form, and
it survived the whole 2026-09-20 three-services pass.

Rather than extend the list to three, the sentences now ask **"what's on the
property"** — which needs no list, cannot fall out of step with the services again,
and does not make the reader sort themselves into a category before they have
spoken to anyone. The three are named where naming them is the point: the meta
description, the service cards, the chooser.

**Worth a sweep next time anything changes the service list**: the site names the
three in nine or so places and each one is an opportunity to name two.

Auditors: links all clear, runtime 0 failures.

## Redundancy scan, and the four cuts it produced — 2026-09-21

Asked for a scan for repetition. Done by extracting the visible copy from all six
pages with chrome stripped (it repeats by design), then looking for sentences
repeated across pages, sentences repeated within a page, shared 7-word phrases,
and every place the three services are named.

**Result: 8 cross-page repeated sentences before, 3 after** — and all three that
remain are legitimate (the contact block, the C.R.S. citation, and the form's
"if it's urgent" message, which also appears on `/thank-you/` in a different
context). Nothing was ever repeated within a single section.

### 1. Each service card printed its own list twice

The card prose enumerated the service, and the `.tags` line underneath enumerated
it again — **three times over on the home page for landscaping**, once in the card
prose, once in the tags, once in the landscaping door. The prose was rewritten to
say what the service *is*, letting **the tags carry the enumeration**.

**⚑ Landscaping was reverted the same day, on Matthew's call** — he prefers the
enumerating version: *"Mowing, edging, beds and planting, sod and seed, shrub and
hedge trimming. Booked on its own, quoted on its own, and priced on its own."*
So **fire mitigation and land clearing characterise, landscaping enumerates**, and
that card's prose and tags do overlap by choice. Do not "fix" it back.

The landscaping door was restored too (§2), so the list does still appear three
times on the home page. **That is the settled state, not an outstanding finding.**

### 2. ⚑ The two doors were not parallel, and one of them said nothing

The fire door earns its place: it adds the tax credit, the insurer duty and the
~450 stat. The landscaping door **restated the card a few hundred pixels above it**
and included a sentence copied **word for word** from `/what-we-do/` ("Tell us how
you want the ground kept and we'll walk it with you").

I replaced it with the **handover packet**, and **that was wrong — reverted the
same day.**

**⚑ The packet must not go on the home page.** It was on the one-pager and came
off in `df5fb7a`; I re-added it without checking why it had left. Matthew:
*"you replaced the landscaping with the folder thing we already removed before
because its agressive."* The register is the problem — *"whether or not you ask
for it"*, *"the same folder every time"* — and it sits on the same sensitive ground
as the banned "we handle the paperwork for you" phrasing. **The packet belongs on
`/what-we-do/#packet`, where someone has gone looking for it.** There is now a
comment in `index.html` saying so, at the exact spot where it is tempting.

**So the landscaping door is back as it was**, restating the card above it and
sharing one sentence with `/what-we-do/` verbatim. **That redundancy is accepted,
not outstanding** — the same call as the card's own wording in §1. The lesson that
survives this section is not about the door: it is **check why something was
removed before reinstating it**, which a scan for repetition will not tell you.

### 3. `/who-pays/` opened by repeating the home page

The home door's `<h2>` and that page's `<h1>` were near-identical ("Two parties
will help pay for it / cover this. Most people are never told about either."), and
**the ~450 stat block was duplicated verbatim, commentary and source line
included**. Clicking through showed you the headline and the number a second time.
The home door now has its own headline and keeps the number **without** the
interpretation, which belongs on the page that discusses the source.

### 4. ⚑ The page-end contact block was one block on four pages — and wrong on one

Same `<h2>` on home, `/what-we-do/`, `/who-pays/` and `/wildfire-guide/`, and three
shared the paragraph verbatim. **`/what-we-do/` ended with "talk through what it
qualifies for"** — tax-credit language copy-pasted from `/who-pays/`, at the foot
of the page that covers **landscaping, which qualifies for nothing.** A content
error, not a style one. Each block now fits its page:

| Page | Heading |
|---|---|
| home | We'll come and walk the property. |
| `/what-we-do/` | It starts with the walk. |
| `/who-pays/` | Find out what your property qualifies for. |
| `/wildfire-guide/` | Have us walk your zones. |

**Visible word count, chrome excluded:** guide 975 · who-pays 826 · what-we-do 737
· home 566 · contact 290 · thank-you 39.

Auditors: links all clear, runtime 0 failures.

## `/what-we-do/` lede trimmed — 2026-09-21

Matthew on *"the walk and the written record at the end are the same either way"*:
*"i just dont like the phrasing of it. theres gotta be a better way to say it or
remove it."* Removed.

It was also doing the thing he cuts every single time — **explaining why the
sentence before it mattered** ([[matthew-copy-edit-patterns]] is full of these).
"Book one or all three" is the point; "and here is why that is fine" is the
justification, and he takes the justification off every draft.

**A second clause went with it.** "Book a single service, or book all three" is
what the `<h1>` directly above it already says — *"Three services. Any one of them,
or all three."* The lede was restating its own heading.

| | |
|---|---|
| Was | "Each one is quoted on its own agreement and priced on its own. Book a single service, or book all three — the walk and the written record at the end are the same either way." |
| Is | "Each one is quoted on its own agreement and priced on its own." |

The lede now **supports** the heading instead of repeating it and then defending
it. Rendered and checked at 1280 and 768: two lines against the three-line
headline, and the split header still balances.

Auditors: links all clear, runtime 0 failures.

## The trailing gloss — a sweep, not a fix — 2026-09-21

Matthew, on *"Left where it falls is the third option and it is what happens by
default"*: he disliked it, connected it to *"the same either way"* cut an hour
earlier, and then said the thing that mattered:

> *"idk what that term of phrasing is but i noticed its present a lot in this site
> but was also present a lot in the surge site, and I had to get you to remove a
> lot of then and I am having to do it again on this site"*

**So this was treated as a sweep, not a sentence.** It is a writing habit of mine,
not a local defect, and it is now named in the `matthew-copy-edit-patterns` memory
so the next draft does not start with it.

**The shape:** a clause appended to a statement that **comments on the statement
instead of adding anything.** Delete it and no fact is lost — it was there to make
the previous sentence feel safer, fairer or cleverer. Five forms: back-reference
("that is what…"), meta-label ("is the third option", "the same either way"),
pre-emptive reassurance ("whether or not you ask"), definition by contrast
("rather than a handshake"), and the editorialising "which is…".

Scanned all six pages for those constructions: **21 candidates, 7 cut.**

| Page | Cut |
|---|---|
| `/what-we-do/` | "Left where it falls is the third option and it is what happens by default." |
| `/what-we-do/` | "It is the same folder every time, and it is handed over whether or not you asked for it." |
| `/what-we-do/` | h2 "Every job comes with the paperwork**, whether or not you ask**." |
| `/what-we-do/` | "…**which is why** they are in here for next time **rather than this time**." → "…so they are in here for next time." |
| `/who-pays/` | "That is why every Sixfold job ends with a folder **rather than a handshake**, and why it is handed over **whether or not anyone asked for it**." |
| `/who-pays/` | "…and **that is the part a contractor can actually do for you**." |
| home + `/who-pays/` | "**which is usually what a board has to show its funder**" — and it was near-duplicated across the two pages, which the redundancy scan had missed |

### ⚑ The 14 that survived, and why — do not re-cut these

The grep catches the construction, not the intent. These add a fact, not an
attitude:

- **Fire-safety instructions** — "Take the woody debris away rather than
  scattering it." **Do not touch; accuracy-audited.**
- **A measurement rule** — "Prune up 6–10 ft, or a third of the tree, whichever is
  less." Same.
- **Offers** — "whichever suits you", "whichever of the three you need". These were
  written *on his instruction* to make the contact routes parallel.
- **Substantive safety points** — "All three are real, which is why 'clear the
  trees back' on its own is not a plan"; "This is the item people most often think
  they have already done."

### Two left deliberately, for him to call

1. **"the quote comes off that sheet rather than off an impression formed in the
   driveway"** (`/what-we-do/`) — textbook definition-by-contrast, and it is also
   the best line on the page. Kept pending his view.
2. **"Filing a return is a licensed activity… which is a conflict of interest as
   well as a competence question"** (`/who-pays/`) — an editorialising "which is",
   but on regulated ground where the reasoning is the point.

Auditors: links all clear, runtime 0 failures.
