# Home wildfire pamphlet — copy source and fact-check log

**Built:** 2026-08-25 · **rebuilt the same day** around drawings rather than prose
**Deliverable:** [Sixfold-Home-Wildfire-Pamphlet.pdf](Sixfold-Home-Wildfire-Pamphlet.pdf) — one Letter sheet, printed both sides, folded once. Finished size 5.5 × 8.5 in.
**Design source:** [home-wildfire-pamphlet.html](home-wildfire-pamphlet.html)
**Status:** On disk. Nothing printed at volume, nothing published, nothing posted.

An education piece, not a sales piece. It exists to be handed to a homeowner at a door, a booth, an HOA meeting or a chipping day and to be useful to them whether or not they ever call Sixfold. The company appears once, at the end, as the publisher.

---

## The rebuild, and why

The first version was a document with a fold in it — four panels of prose, ~1,400 words, one small diagram. It was accurate and unreadable at a door.

This version is built the other way round: **five drawings carry the content and the words are captions to them.** The printed copy is down to about **730 words, from roughly 1,400** — counted off the markup with the styles, the drawings and the screen-only proof lines stripped out. Body type went **up**, from 8.1pt to 9pt, because there was room for it once the prose came out.

What changed structurally:

- **The cover is the one dark surface in the piece** — Pine Black ground, ember mark, the fire drawn in the Ridge mark's own triangles. Everything else on the sheet stays white. One bold place, and the brand's dark-first register finally shows up in print.
- **Every panel now leads with a drawing.** Ember travel on the cover; a labelled house with seven numbered ignition points; a plan of the three zones with the trees actually drawn at the spacing the text specifies; a distance rail for firewood, propane and slash; plus two detail insets.
- **Three prose lists became one picture each.** Firewood, propane and slash were three separate bullet lists saying the same two numbers; they are now one diagram and two rule lines.
- **The two hardest things to picture got their own insets** — 1/4-inch rodent screen versus 1/8-inch ember mesh, and Zone 2 seen from the side with the crown gap and the pruning height marked.

**Print settings:** Letter, **landscape**, double-sided, **flip on short edge**. Fold ticks print just inside the trim at the top and bottom of the centre line — inset deliberately, because most office printers cannot put ink flush to the paper edge. Print one and fold it before running any quantity.

**The dark cover costs toner.** It is a quarter of one side, and an office laser will band it slightly on plain paper. On anything decent it looks like a printed brochure rather than a printout, which is the point. If a volume run comes back blotchy, the fix is better paper, not a lighter cover.

The cover's ground runs to the edge of its half of the sheet. A printer that cannot bleed will leave an even white frame around it, which reads as a border; "fit to printable area" scales the whole sheet down a few per cent and is also fine. Neither moves the fold line off centre.

**Two pages is the spec, and it was verified by generating the PDF and looking at every page**, not by looking at the screen. The first build came out **four** pages: the 26px screen gap between the two sheets survived into print, and on a sheet already exactly one page tall it spilled onto a page of its own. The `@media print` block now clears that margin and breaks *before* the second sheet rather than after the first. Re-count after any edit.

Printed light from a dark-mode browser too — the same page printed with `--force-dark-mode` produced a byte-identical PDF.

---

## Panel map

| Panel | Page | Position | Contents |
|---|---|---|---|
| 4 | Page 1 — the outside | left | **Back cover** — the distance rail, the four rules, who pays, Sixfold |
| 1 | Page 1 — the outside | right | **Front cover** — dark; the ember headline and the ember-travel drawing |
| 2 | Page 2 — the inside | left | **The house** — seven numbered ignition points, plus the mesh detail |
| 3 | Page 2 — the inside | right | **The zones** — the plan, the three zone bars, plus Zone 2 from the side |

Fold the left half of page 1 backward, behind the right half. The cover ends up on top, the back panel behind it, and opening the cover shows panels 2 and 3 side by side.

---

## Panel 1 — Front cover (dark)

**Masthead:** Ridge mark + Sixfold · **Land & Fire · Colorado's Front Range**

Changed from a city line to the region on 2026-08-25. The masthead names the **region the reader lives in**, not the town the company sits in — on a piece handed to a homeowner in the foothills, someone else's town reads as somewhere else. The town still appears once, in the back-panel contact block, where a business address belongs. This makes the masthead broader than the service line on panel 4 — deliberate, and the same relationship the rate sheet has: the region is who the piece is for, the counties are where the trucks go.

**Kicker:** Colorado wildfire · a homeowner's guide

**Headline:** Embers start most of the homes that burn

**Standfirst:** Wind carries burning debris **more than a mile ahead of a fire**. It lands in your gutter, under your deck, in the mulch against your wall. That is the part you can do something about.

**Drawing — ember travel.** A house at left, a fire front at right drawn as three ember triangles in the Ridge mark's own geometry, dashed trajectories arcing between them with embers riding along, and a measured span underneath reading MORE THAN A MILE. The trajectories deliberately land *on* the house, not near it.

**Three-way strip at the foot:**

- **Embers** — Land on anything that will take a spark. The usual cause.
- **Flame** — Reaches the wall when fuel sits within five feet of it.
- **Heat** — Lights a wall with nothing touching it at all.

**Source line:** Adapted from the Colorado State Forest Service *Home Ignition Zone* guide (2021) and checklists. CSFS does not endorse Sixfold or any contractor.

---

## Panel 2 — The house

**Kicker:** Start here, before anything outdoors
**Headline:** Seven places a house catches
**Lede:** Work outward from the wall, not inward from the property line. Every number on the drawing is a job you can do in a weekend.

**Drawing — house elevation**, with seven ember callout discs sitting directly on the feature. No leader lines: at print size a leader is the first thing to go astray.

The numbered key:

1. **Class A roof.** No wood or shake shingle.
2. **Clear gutters, roof and deck** of needles more than once a year.
3. **1/8-inch metal mesh** on every vent. Standard rodent screen is 1/4 and lets embers through.
4. **Screen under decks** and stilt foundations. Store nothing there.
5. **Tempered glass**, two panes or more. Windows fail before the building does.
6. **Six inches** of clearance between the ground and the bottom of the siding.
7. **Non-combustible fence** within five feet. A fence on the house is part of the house.
+ Fibre cement, brick and stucco beat wood siding under radiant heat.

**Inset — why the mesh size is the whole point.** Two screens side by side: an ember passes straight through the 1/4-inch grid, and is stopped by the 1/8-inch one — labelled STOPS MOST, because the IBHS source says 1/8-inch only minimises ember entry. Captioned with where the mesh belongs — attic, eave, foundation, under-deck. This is the item people most often think they have done.

**Closing note:** Firefighters may not be there. They engage only when it is safe for them to. Prepare the house to stand on its own.

---

## Panel 3 — The zones

**Kicker:** Then work outward
**Headline:** Three zones, measured from the wall
**Lede:** Build them around **every** structure — house, garage, shed, barn.

**Drawing — plan view.** Three nested bands with the house at the centre. Zone 1 is drawn as gravel. Zone 2 carries widely spaced trees with one crown gap called out at 10 ft. Zone 3 carries denser trees in clumps with real openings between them. The trees are placed at the spacing the text specifies, so the picture states the rule rather than illustrating it loosely.

| Zone | Distance | The instruction |
|---|---|---|
| **Zone 1** | 0–5 ft · strip it | Rock, gravel or bare earth. **No** shrubs, mulch, firewood or deck storage. Rake needles within 5 ft of every deck and structure. Clear 10 ft around the chimney. |
| **Zone 2** | 5–30 ft · thin it | Grass to **4 inches**. **10 ft between crowns** — or leave small groups of two or three, 30 ft apart. Prune up **6–10 ft**, or a third of the tree — whichever is less. Pull ladder fuels and ground juniper. Shrub clumps **2½× their mature height** apart. |
| **Zone 3** | 30–100 ft · open it | **6–10 ft** of crown spacing, with real gaps between clumps so fire has to drop to the ground. Take the woody debris away rather than scattering it. |

**Inset — Zone 2 from the side.** Two pruned trees with the 10 ft crown gap measured between them, the 6–10 ft pruning height measured on a trunk, and a shrub beneath a tree struck through and labelled LADDER FUELS. Crown spacing and pruning height are the two rules a number alone does not convey.

**Closing note:** These figures are for ponderosa, Douglas-fir and mixed conifer below 9,500 ft. Piñon-juniper, lodgepole, spruce-fir, Gambel oak and aspen all differ — aspen should generally not be thinned at all. On slopes, increase every spacing.

---

## Panel 4 — Back cover

**Kicker:** Off the wall and out to the road
**Headline:** Two numbers do most of the work

**Drawing — the distance rail.** The house at zero, a measured 30 ft span to a dashed line, and beyond it the firewood, the propane tank and the slash pile. **The firewood and the propane tank each sit inside a dashed 10 ft ring of cleared ground; the slash pile does not** — the source gives that clearance rule for woodpiles, tanks and gas meters only, and the ring was removed from the slash pile in the 2026-08-25 audit. This drawing replaced three separate bullet lists.

The five rules:

- **30 ft** — **Firewood, propane and slash** — all of it at least that far from the house.
- **Uphill** — Stack **firewood** uphill of the house or level with it, never below — and never between trees or under the deck. Propane: level with the house where you can.
- **10 ft** — Clear flammable vegetation that far around **woodpiles, propane tanks and gas meters**.
- **Burning?** — **Call the sheriff or your fire department first.** Restrictions change constantly.
- **Driveway** — Thin **30 ft back from each side**, house to main road. A house number at the road, noncombustible and reflective — a crew that cannot find you cannot defend you.

### Who pays for some of it

**$1,000 · state tax credit — Colorado pays your contractor's invoice.** 100% of what a contractor charges you for mitigation on land you own, up to $1,000 — **if your federal taxable income is under that year's limit** ($129,200 for 2025; 2026's is set at year end) and the work meets CSFS standards. Contractor invoices only; not your own labour, rented kit, or anything a grant covered. It cannot exceed your Colorado tax bill, and the excess is lost. **From 2027: $2,000, refundable, limit $300,000 AGI.** Claim on the DR 0104CR with receipts.

**10 / 30 · days to appeal a risk score — your insurer must show you its wildfire score.** Since 1 July 2026, an insurer using a wildfire score to price or decline a Colorado policy must tell you the score, the range it sits in, what drove it, and what each mitigation action would do to it. Done work since renewal? Ask for a re-score — 30 days. Disagree? Appeal: acknowledged in 10 calendar days, decided in 30.

*Not tax or insurance advice. Your accountant, and your own policy, are the authority.*

### Sixfold

Felling, stump grinding, slash piling, chipping and haul-off — in El Paso, Douglas and Teller counties and the Front Range foothills.

**(720) 772-6146** · Contact@SixfoldColorado.com
Sixfold, LLC · Monument, CO

QR code to `linktr.ee/SixFoldColorado` — the decode-verified print-black variant from [brand/qr/](../brand/qr/), inlined as SVG so it scales without resampling. Do not swap it for a generated one; that folder's build script decodes every code it writes and this one passes down to 160 px.

---

## Lines cut, and why

Keep these — they are the fastest way to lengthen the piece later without re-researching.

**Cut in the rebuild, for length rather than accuracy.** All of it is true and sourced; it lost to a drawing.

- **The Zone 1 rationale** — "use non-flammable surfaces such as rock, gravel, sand, cement, bare earth or stone pavers." Compressed to "rock, gravel or bare earth"; the diagram draws the gravel.
- **"Past five feet, raking does not meaningfully reduce ignition risk and can harm the trees."** A genuinely useful correction to a thing homeowners over-do, and the first casualty of the word cut. Worth restoring in any longer version.
- **The three ignition mechanisms in full** — each had a paragraph, now has one line on the cover strip. The detail that went: embers are most dangerous on flat and near-flat surfaces, and windows fail by glass breakage *or* frame melt.
- **Eaves.** "The wall below deflects hot air and gas straight up into them" — dropped entirely. The eave is still drawn, and callout 2 covers clearing it.
- **The maintenance cadence block** — needles, gutters, decks and grass more than once a year; Gambel oak every three to five years, mowed annually. The "more than once a year" survives inside key item 2; the Gambel oak line is gone.
- **The slash treatment detail** — lop and scatter under 24 inches, no deeper than 18, nothing over 4 inches scattered, and 3-foot gaps between chip accumulations. Too fine-grained for a handout, and it is the part a contractor does. **This is the largest single cut and the one most worth restoring** if the piece ever runs to six panels.
- **"Zone distances are measured from the house"** as a standalone sentence — now carried by the headline, "measured from the wall".

**Cut on judgement, and staying cut.**

- **"Book a free assessment before renewal season."** Urgency, and an ask. This tier of print asks nothing back. The phone number is the whole call to action.
- **"We can get your insurance score lowered."** The statute entitles a homeowner to a re-score, not a better one. Promising a score change or a premium change is not supportable.
- **"Licensed and insured."** Standing project rule: not until the insurance exists. It does not.
- **Any county cost-share programme by name.** Hard rule until Sixfold is on an approved contractor list. Also self-defeating here — grant-funded costs are excluded from the tax credit, so the two do not stack the way the sentence implies.
- **"A one-acre defensible space project runs $3,200–$6,100."** Real and CSFS-sourced, via the 2026 legislative evaluation. Cut because printing a job cost invites a quote Sixfold may not honour, and because a price on an education piece turns it into a sales piece.
- **Any percentage-off launch offer.** It contradicts the rate card, which prices at 5% under market. A homeowner holding both learns the published number is fiction.
- **"More than half of Colorado residents live in the wildland-urban interface."** True, CSFS WUI Risk Assessment 2017. Scene-setting; the ember fact does the cover's work better.
- **"Of 1,000 homes threatened in the 2016 Cold Springs Fire, only 8 burned."** CSFS caption, and the single most persuasive line available. Cut because the caption attributes it only "in part" to homeowner mitigation, and printing it without that qualifier claims more than the source does.
- **The IBHS "Wildfire Prepared Home" designation.** Named in HB25-1182's definition of a property-specific mitigation action. Cut because it points a homeowner at a certification Sixfold cannot supply or verify.
- **Premium-increase statistics from RMIIA.** Real, but hail-driven. Using them next to wildfire copy implies a causation the source does not support.
- **The 2026 federal-taxable-income limit for the credit.** Genuinely unpublished — the Department of Revenue table says "TBD". Left out rather than guessed.

---

## What the drawings claim, and what they do not

Every diagram is hand-authored SVG in the page. **No CSFS artwork or photography is reproduced** — the guide's illustrations are its own and are not ours to redraw closely.

- **The zone plan is schematic.** The bands are not to scale against each other; 0–5 ft has to be legible beside 30–100 ft. The trees inside Zone 2 *are* placed at the ratio the text gives, and the 10 ft crown gap is called out on the drawing rather than implied by it.
- **The distance rail is to scale in one direction only** — the 30 ft span is measured from the wall, and the 10 ft rings are drawn proportionally to it. Vertical scale is meaningless.
- **The mesh inset exaggerates both grids.** A 1/4-inch and a 1/8-inch screen printed at true size would be a grey smudge. The ratio between them is correct; the absolute size is not.
- **The house elevation is a generic house.** It is not any Colorado house style in particular, and the seven callouts are positions, not construction detail.

---

## Accuracy audit — 2026-08-25, every claim re-checked against source

Run after the drawing-led rebuild, on the grounds that this is fire-safety copy. Every figure and instruction on the printed piece was read back against a primary source. **Eleven corrections were made.** Nothing was found that would have made a house less safe, but four of the eleven would have misdirected a homeowner's effort, and one printed a promise the state does not make.

### Corrections that changed meaning

**1. The headline claimed something false.** "Embers burn houses down, not flames." Direct flame contact and radiant heat both ignite homes — the guide names all three mechanisms, and the cover's own strip listed them. CSFS says embers are "the most common source of home ignition", which is a different claim. **Now: "Embers start most of the homes that burn."** On a fire-safety piece a line that reads as "flames aren't the danger" is not a rhetorical flourish, it is a hazard.

**2. Firewood's placement rule was applied to propane and slash.** The piece said "Firewood, propane and slash — uphill of the house or level with it, never below. Never between trees, under the deck or on it." The checklists say that of **firewood only**. Propane is "at least 30 feet from the home, **preferably** on the same elevation" — softer, and not "uphill". Slash has **no elevation rule at all**, only the 30 ft distance. **Now split into two rows**: the 30 ft rule covers all three; the uphill/never-under-the-deck rule names firewood, with propane's weaker "level where you can" stated as such.

**3. The 10 ft clearance rule was extended to slash, and the diagram drew it.** The source gives 10 ft of vegetation clearance around **woodpiles, propane tanks and gas meters**. There is no such rule for slash piles. **The dashed ring around the slash pile has been removed from the drawing**, and the rule now names the three things it actually covers.

**4. The tax credit omitted its income limit entirely.** The piece said Colorado pays 100% of a contractor's invoice up to $1,000 and never mentioned that eligibility is capped by federal taxable income — $129,200 for tax year 2025, with 2026's figure not calculable until year end. A homeowner over the limit would have read a promise that does not apply to them. **Now stated on the piece**, along with the condition that the work must meet CSFS standards, and the 2027 limit of $300,000 AGI.

### Corrections of precision

**5. "Six inches of bare ground between the soil and the siding"** described a horizontal strip. The rule is a **vertical gap**: "create 6 inches of vertical clearance between the ground and home siding." **Now: "Six inches of clearance between the ground and the bottom of the siding."**

**6. The mesh inset said 1/8-inch mesh "STOPS" embers.** The IBHS fact sheet reproduced in the guide is explicit that "1/8-inch screening only **minimizes** the entry of embers", and the guide body says "**most** embers will be extinguished before making it inside." **Now: "1/8 IN · STOPS MOST."** Overstating a barrier is how someone stops checking it.

**7. "Flame — only reaches the wall if fuel is touching it."** The guide says fuels **adjacent to** the home, and that clearing within **five feet** "greatly minimizes" the possibility. "Only… if touching" is both false and dangerously reassuring. **Now: "Reaches the wall when fuel sits within five feet of it."**

**8. Zone 1 raking said "within 5 ft of every deck."** Source: "within 5 feet of all decks **and structures**." **Corrected.**

**9. Zone 2 crown spacing read as an either/or** — "10 ft between crowns, or 30 ft between small groups." It is not a choice: 10 ft between individual crowns, and *if* you leave small groups of two or three, 30 ft between those groups. **Reworded.**

**10. Shrub clumps "2½× their height"** — source says **mature** height. A shrub that is two feet tall today and six feet tall grown is a different spacing. **Corrected.**

**11. The insurance line promised a dollar figure.** "Must tell you the score, what drove it, and **what each fix is worth**." C.R.S. 10-4-124(6)(b)(V) requires "the impact, **if any**, that each property-specific or community-level mitigation action could have **on a wildfire risk score**" — an effect on the score, not a price. **Now: "what each mitigation action would do to it."** Also added the range disclosure, which the statute requires and the piece had dropped, and restored "calendar" to the 10-day appeal clock.

### Checked and correct, no change needed

Ember travel "more than a mile ahead of a fire" · the three ignition mechanisms · all three zone distances (0–5, 5–30, 30–100 ft) · Class A roof, no wood or shake · 1/8-inch metal mesh on vents and 1/4-inch as the rodent-screen default · tempered glass, two panes or more · noncombustible fence within five feet · the chimney's 10 ft · grass to 4 inches · 10 ft between crowns and 30 ft between groups · prune to 6–10 ft or one third of height, whichever is less · ladder fuels and common ground juniper · Zone 3's 6–10 ft crown spacing and the preference for removing woody material over scattering it · firewood and propane at 30 ft with 10 ft cleared · the driveway's 30 ft each side and the noncombustible reflective house number · "zones around every structure" · the 9,500 ft / forest-type caveat and aspen · "firefighters may not be there" · the credit at 100% and $1,000, contractor-invoices-only, grant exclusion, no refund and no carry-forward before 2027, DR 0104CR with receipts · the 2027 change to $2,000 refundable · the insurer's 30 days for a re-score and 10/30 calendar days for an appeal · the 1 July 2026 effective date.

### What this audit resolved that was previously open

The project's earlier fact-check left open **whether the 2027 income limit is federal AGI or federal taxable income**. It is **federal Adjusted Gross Income**, confirmed by the Office of the State Auditor's Exhibit 4 and its own technical note that FTI is generally the lower number. The switch from an FTI cap around $129,200 to a $300,000 AGI cap is therefore a much larger widening than the figures alone suggest.

It also confirmed the **$2,000 and $300,000 are real**. The General Assembly's own bill summary for HB26-1289 mentions only refundability and the beetle definition in its wildfire bullet, and separately raises an *unrelated* credit "from $1,000 to $2,000" — close enough to look like the source of a transcription error. It is not: the evaluation's Exhibit 4 states the wildfire credit's own maximum as $2,000 (refundable) for 2027. Worth knowing, because the bill summary alone would suggest the pamphlet was wrong.

---

## Fact-check log

### Verified — first-party, read in full this session

**Colorado State Forest Service, "Protect Your Home & Property from Wildfire"** — the page the request named, fetched and read in full. Source of the seven structural-ignitability items and the three zone distances.

**CSFS, *The Home Ignition Zone* guide, 2021** (2021_CSFS_HIZGuide_Web.pdf, 16 pp, downloaded and text-extracted). Source of everything the web page summarises but does not state:

- Ember travel "more than a mile ahead of a wildfire's flaming front"; embers named as "the most common source of home ignition during wildfires" (p. 4).
- The three ignition mechanisms — ember, surface fire / direct flame contact, radiant heat (p. 4).
- Zone 1 critical steps including the **10 feet of clearance around the chimney** and the raking caveat (p. 8).
- Zone 2: 4-inch grass, **10 ft between crowns measured outermost branch to nearest branch**, groups of two or three with **30 ft between groups**, prune to **6–10 ft or one third of height, whichever is less**, ground juniper removal, clump spacing **2½ × mature height** (pp. 8–9).
- Zone 3: mowing unnecessary, **6–10 ft crown spacing**, preference for treatments that remove woody material (p. 9).
- The scope caveat: guidelines are for "ponderosa pine, Douglas-fir and mixed-conifer forest types below 9,500 feet" (p. 5), with separate handling for piñon-juniper, lodgepole, Gambel oak, spruce-fir and aspen (pp. 14–15).
- Vents: 1/8-inch mesh, and that typical rodent screening is 1/4-inch — NFPA/IBHS Wildfire Research Fact Sheet reproduced at p. 6. **This is the source for the mesh inset**, and the reason it earns a diagram: the guide itself devotes a full page to it.
- Windows failing by glass breakage or frame melt; fencing attached to the house treated as an extension of it (p. 7).

**CSFS Home Ignition Zone Checklists page**, fetched and read in full. Source of the firewood, propane and driveway figures — the 30 ft placement, uphill-or-level, the 10 ft vegetation clearance, and the noncombustible reflective house number.

### Carried from earlier verification in this project

The two money items are not re-researched here. Both were verified against enacted statute in the content set on 2026-08-19 and re-checked in the 2026-08-21 review, and the wording is copied from those files rather than re-derived:

- **Tax credit** — **re-verified first-party 2026-08-25.** Department of Revenue *Income Tax Topics: Wildfire Mitigation Measures* (fetched with a browser user agent; it 403s to a plain fetch) for the credit table, the contractor-only rule, the grant and cost-share exclusions, and the DR 0104CR filing route. Office of the State Auditor evaluation **2026-TE4**, Exhibit 4, downloaded and read, for the limits by tax year: 2023 $120,000 FTI / 25% / $625; 2024 $126,300 / 25% / $625; 2025 $129,200 / 100% / $1,000; 2026 **TBD** / 100% / $1,000; 2027 **$300,000 federal AGI** / 100% / **$2,000, refundable**. The 2026 limit is genuinely uncomputable until year end — the DOR cannot set the inflation adjustment before then, which is why the piece names 2025's figure and says so. Credit extended through tax year 2030. Background in [content/02-tax-credit-post.md](../content/02-tax-credit-post.md).
- **Insurance** — **re-verified first-party 2026-08-25** against the enacted act PDF (HB25-1182, 7 pp, downloaded and text-extracted). §(6)(b)(I)–(V) notice contents including the range and the relative position within it; §(7)(d) revised score **no later than thirty days** after submission; §(8) appeal acknowledged **within ten calendar days** and decided **within thirty calendar days**; act takes effect **July 1, 2026** and applies to policies issued or renewed on or after that date. Background in [content/01-insurance-risk-score-post.md](../content/01-insurance-risk-score-post.md).

**One wording correction carried forward.** The 2026-08-21 review found the insurance discount duty overstated in two files. HB25-1182 §(4) requires a discount **only where the insurer does not incorporate mitigation into its own models**. This pamphlet therefore says the insurer must tell you "what each fix is worth" — which §(5) and §(6)(b)(V) require unconditionally — and does not say any homeowner is owed a discount.

**One figure dropped in the rebuild:** the **450 claims in tax year 2023** (General Assembly 2026 tax expenditure evaluation, 2026-TE4). It is the best argument in the whole piece for reading the tax credit paragraph, and it went for length. Restore it first if the money band ever gets a line back.

### Attribution and endorsement

The CSFS guide carries the line "No endorsement of products or services is intended." A pamphlet that reproduces CSFS guidance and carries a contractor's phone number can read as endorsement whether or not it says so. The cover therefore states the adaptation and states plainly that CSFS does not endorse Sixfold or any contractor, and the cover names the guide by title and year so a reader can find it. **The back-panel link to csfs.colostate.edu was removed 2026-08-25 at Brandon's request** — attribution still stands on the cover, but the reader no longer has a printed route to the source, so the cover line is now carrying that job alone.

The guide is a public education publication of a Colorado State University outreach agency. Adapting it with attribution is its intended use; the illustrations and photographs are **not** reproduced, and none of the copy is lifted verbatim at length.

### Unresolved

- **The domain is printed nowhere.** `SixfoldColorado.com` is owned but resolves to nothing — there is no hosting. A URL on a printed piece that returns an error is worse than no URL, so the panel carries the phone number, the email and the QR code to `linktr.ee/SixFoldColorado`, which is live. **Put the domain on the piece as soon as it resolves**; it will need a reprint.
- **Counties named.** The back panel says El Paso, Douglas and Teller "and the Front Range foothills" — rewritten 2026-08-25 when the base moved from Englewood to Monument, which put Arapahoe and Jefferson out of easy reach and brought El Paso and Teller in. That is a statement of where Sixfold works, not a boundary on what it will quote — the criterion is drive time from Monument, and a job outside those counties is a phone call, not a refusal. **The county strategy in the marketing plan was built around an Englewood base and needs Brandon's review**, not just a find-and-replace.
- **Whether the Division of Insurance has adopted implementing rules** under HB25-1182 §(11). Not checked, here or previously. It would affect notice formatting, not any figure printed here.

**Standing:** nothing published, posted, scheduled or printed at volume.
