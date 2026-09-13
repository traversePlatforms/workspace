# Pricing Guide — Sixfold

**Built:** 2026-08-24
**Register:** Customer-facing. Written to be handed to a homeowner or read on a phone.
**Status:** Built, **not released.** Two gates below must close first — see §9.
**Source of truth.** The `.html` is presentation only and gets re-synced from this file.
**Published (private):** *Sixfold Rate Card* — https://claude.ai/code/artifact/1f542908-87cd-4853-808c-a3423e2a34d5
Republish to that same URL after any change; the artifact takes the unwrapped copy in `pricing-guide.artifact.html`.

**The sendable version is [Sixfold-Rate-Sheet-A.pdf](Sixfold-Rate-Sheet-A.pdf)** — one Letter page, print register, built 2026-08-24 from `pricing-onesheet.html`. It carries the prices from §2–§6 and §8–§9 of this document with a short explanation each, and **no internal apparatus**: no §10 gates, no §11 log, no comparable column. Every price on it is the same number as here — **change a price here and the one-sheet must be rebuilt and re-printed**, or the two will disagree in a customer's hands. Verified at exactly one page by printing to PDF and counting; screen height lies about page fit, so re-verify the same way after any edit.

### The PDFs — what to send, and how to rebuild them

Four PDFs, all Letter. **Named for a human, not for the build** — `pricing-onesheet-b.pdf` means nothing in an inbox or a Drive folder.

| File | Pages | Who it goes to |
|---|---|---|
| `Sixfold-Rate-Sheet-A.pdf` | 1 | **Customers.** Disposal included. |
| `Sixfold-Rate-Sheet-B.pdf` | 1 | **Customers.** Slash piling and rounds charged. |
| `Sixfold-Rate-Sheet-C.pdf` | 1 | **Customers.** A, repriced against the six-state comparison. |
| `Sixfold-Rate-Card-INTERNAL.pdf` | 9 | **Brandon and Matthew only.** Carries the comparable column, the two release gates, the held-back list and the full fact-check log. **INTERNAL is in the filename on purpose — it has to survive being forwarded.** |

**Rebuilding.** The PDF is the deliverable, not the HTML, so re-print after any edit — and for the one-sheets, re-count the pages, because a screen render says it fits when it does not.

```
chrome --headless --disable-gpu --no-pdf-header-footer --virtual-time-budget=8000 \
  --print-to-pdf="Sixfold-Rate-Sheet-A.pdf" "file:///.../pricing-onesheet.html"
```

Source → output: `pricing-onesheet.html` → A, `pricing-onesheet-b.html` → B, `pricing-onesheet-c.html` → C, `pricing-guide.html` → the internal card. **The output name is not the source stem** — write it out explicitly or you will end up with two copies under two names.

**The rate card prints light from a dark browser.** It is dark-first on screen and unusable on paper that way, so its `@media print` block redefines the palette tokens. Verified by printing the same page with `--force-dark-mode`: byte-identical output. Do not remove that block.

### Three sheets, for Brandon to pick between — 2026-08-24

The one-sheet exists in three versions, all one Letter page.

- **A vs B** is the *disposal* question — whether slash piling and rounds are included or charged.
- **A vs C** is the *pricing* question — whether to hold the Colorado-only anchor or reprice against the wider region. C is built on A, so nothing else differs.

A and B are identical except for two lines:

| | [Sixfold-Rate-Sheet-A.pdf](Sixfold-Rate-Sheet-A.pdf) — **A** | [Sixfold-Rate-Sheet-B.pdf](Sixfold-Rate-Sheet-B.pdf) — **B** |
|---|---|---|
| Left where it falls | Included | Included |
| **Stacked into slash piles** | **Included** | **$65 per pile** |
| **Cut to rounds and stacked** | **Included** | **$95 per cord** |
| Chipped on site | $118/hr | $118/hr |
| Hauled off site | $142–$190 per load | $142–$190 per load |

**Where B's two prices come from.** Neither is invented; both are derived from figures already on the sheet, so they hold up if a customer asks.

- **$65 per pile.** Haul-off is $142–$190 per truck load, which pays for gathering, loading, the drive, and the tip fee — and the Jefferson County SLASH tipping fee is $24 per 6-cubic-yard load. Piling is the gathering-and-stacking part alone, with no drive and no fee. $65 sits inside that share. The sub-label defines a pile as about a truck load, so the unit matches the haul-off line above it.
- **$95 per cord.** This is exactly the published two-person crew hour, on the basis that roughly a crew hour of bucking and stacking yields a cord of rounds from felled softwood. It is also well under half the $150–$300 a Front Range seller gets for a delivered *seasoned, split* cord — which is the answer if anyone argues the wood is worth more than the labour.

**The argument each way**, since that is the decision:

- **A** makes the free options the headline. Three of five disposal choices cost nothing, which is a real differentiator against a competitor who folds disposal into one number, and it makes the quote easy to say yes to. The labour is still being done — it is absorbed into the felling price.
- **B** recovers that labour and stops the cheapest disposal option being the one that costs the most crew time. It also makes every line an itemised choice, which is the same "we show you the number" argument the whole sheet is built on. The cost is that the sheet no longer has a free column, and the total on a big job goes up.

**If B is chosen, the felling prices should be revisited** — they were set at 5% under a competitor whose quotes bundle disposal. Charging separately for piling and rounds on top of an already-bundled-comparable price is a second bite, and a customer comparing quotes may notice.

**Whichever is picked, retire the other.** Two near-identical PDFs in circulation is how a customer gets quoted from the wrong one. The printed faces are identical by design — they are told apart by filename and by the PDF document title (*Sixfold Rate Sheet* vs *Sixfold Rate Sheet B*), which shows in a viewer's title bar but does not print.

### Sheet C — repriced against a six-state comparison, 2026-08-24

Built because the Colorado-only anchor was thin. **Correcting the premise it was raised on:** the prices were never taken from one company. Four Colorado operators supplied the figures actually used — **Hawk Tree Service** (removal by height, labour hourly, per-acre thinning), **A Stump Man** (per-inch grinding), **Flatirons Stump Removal** (stump minimum and adders) and **CSFS** via the legislature's tax-credit evaluation (per-acre defensible space). The "one of eight" line meant only one operator published a *complete tiered rate card* — Bear Claw, in the resort counties. Several others publish individual rates on cost pages. That line was loose and it has been removed from the sheets.

**[Sixfold-Rate-Sheet-C.pdf](Sixfold-Rate-Sheet-C.pdf)** is built on **A** (disposal included), so A vs C isolates the pricing question exactly as A vs B isolates the disposal question. A B+C combination is a two-line edit if it is wanted.

#### What the region actually charges

**Stump grinding, per diameter inch — every one of these read first-party:**

| Operator | Market | Per inch | Minimum |
|---|---|---|---|
| A Stump Man | Littleton, CO | $5.00 – $9.00 | — |
| Flatirons Stump Removal | Boulder, CO | $9.00 | $189 |
| Utah Stump Grinders | Salt Lake City, UT | $4.00 – $7.00 | — |
| Utah Stumps | Ogden / Layton, UT | $7.50 | $200 |
| Montana Stump Grinding | Bitterroot Valley, MT | $9.00 | — |
| Idaho Stump Guy | Magic Valley, ID | $7.00 (to 40 in) | — |

Six operators, four states, clustering **$7 – $9**. Sixfold's old floor of **$4.75 sat under every single one of them**, and the $179 minimum sat under both published minimums.

**Tree removal — no other state publishes a height table either.** What exists is retail totals: Cheyenne WY around **$1,100**, range **$400 – $1,800**; Casper WY **$1,000 – $1,200** for 60 ft and over; Albuquerque NM **$400 – $1,700**, typically about **$750**. Utah operators price by trunk diameter instead, at **$10 – $25 per inch**. Sixfold's bands sit inside all of these. **Nothing here justifies moving them.**

**Crew time — this is where the comparison bites.** Two independent 2026 trade sources, neither of them a content farm:

- **Wexford Insurance / TreeGuard**, published 6 May 2026 under a named author: a **two-person crew's required billing rate is $190 per crew-hour**, and the industry should bill **$90 – $200 per crew-hour in 2026**. Equipment hourly on top of labour: wood chipper **$40 – $70**, stump grinder **$50 – $90**, chip truck **$50 – $80**.
- **ArboStar**, 26 May 2026: a three-person crew **costs $180 – $200/hr to field** — climber $42/hr loaded, groundworkers $28/hr each, plus roughly $20/man-hour of overhead — against a 65% target gross margin.
- Corroborating retail: Cheyenne publishes **$190 – $240/hr for a three-person crew**, which is $63 – $80 per person-hour.

Sixfold was charging **$95/hr for two people** — about **$47 per person-hour**, half the regional retail rate and at the very floor of the trade's own recommended band.

#### What moved, and what did not

| Line | A / B | **C** | Why |
|---|---|---|---|
| Tree removal, all four bands | unchanged | **unchanged** | Regional retail brackets them. No evidence to move. |
| Per acre, all three lines | unchanged | **unchanged** | No first-party per-acre rate found anywhere in the region. CSFS stays the best anchor available. |
| Grinding, per diameter inch | $4.75 – $8.55 | **$5.70 – $8.55** | Floor raised to 5% under $6.00. The old floor undercut all six regional operators; the ceiling was already 5% under the $9.00 that three of them charge. |
| Stump minimum | $179 | **$185** | 5% under the mean of the two published regional minimums ($189 CO, $200 UT). |
| Two people with saws | $95/hr | **$120/hr** | 5% under Cheyenne's published three-person rate scaled to two people at its low end ($63/person-hour). |
| Crew with chipper | $118/hr | **$155/hr** | The saw crew plus 5% under the lowest published chipper equipment rate ($40/hr). |
| Chipped on site, in the disposal table | $118/hr | **$155/hr** | **Same crew, same machine** — it has to move with the line above or the sheet contradicts itself. This was missed on the first build of C and caught in the PDF check. |
| Full day, 8 hours | $895 | **$1,150** | Held about 7% under eight times the chipper hourly, so a booked day still beats buying hours piecemeal. |

#### Two things to weigh before choosing C

**C is a different commercial posture, not a tuned version of A.** A is "5% under published Colorado retail." C is "5% under regional retail and the trade's own cost model." The crew rate rises 26% and the chipper rate 31%. For a company with no track record, no reviews and no insurance, that is a real risk on the first ten jobs — the discount is what compensates for having no proof.

**The counter-argument is that C's hourly is the coherent one.** Wexford's man-hours per removal are 4.0–7.0 crew-hours for a 30–50 ft tree. Sixfold's own 30–60 ft band of $475–$950 implies **4 to 8 crew-hours at $120/hr**, which matches — and implies 5 to 10 hours at $95/hr, which does not. The per-tree prices and the old hourly were describing different businesses. C makes them agree.

#### Fact-check log — regional pass, 2026-08-24

| Claim | Source | Status |
|---|---|---|
| Utah Stump Grinders $4.00–$7.00 per inch, Salt Lake City | Own pricing page | **Verified first-party.** No minimum published. |
| Utah Stumps $7.50 per inch, $200 minimum, Ogden/Layton | Own pricing page | **Verified first-party**, with worked examples on the page (3 ft = $270). |
| Montana Stump Grinding $9.00 per inch, Bitterroot Valley, travel included locally | Own site | **Verified first-party.** No minimum published. |
| Idaho Stump Guy $7.00 per inch to 40 in, Magic Valley | Own services page | **Verified first-party.** Over 40 in needs an in-person estimate. |
| Two-person crew required rate $190/crew-hour; industry band $90–$200/crew-hour 2026; chipper $40–$70/hr, grinder $50–$90/hr; stump flat rates $75/$125/$200/$325/$475 by diameter band; removal 2.0–3.5 / 4.0–7.0 / 7.0–12.0 / 12.0–24.0 crew-hours by size | Wexford Insurance (TreeGuard), *How to Price Tree Service Jobs*, 6 May 2026, author named | **Verified first-party as a published trade guide.** Not a survey — a practitioner cost model. Treated as such: used to sanity-check coherence, not quoted to a customer. |
| Three-person crew costs $180–$200/hr to field; climber $42/hr, groundworker $28/hr loaded; overhead ~$20/man-hour; 65% target gross margin | ArboStar, 26 May 2026 | **Verified first-party.** Independent of the above and lands on the same number, which is why the finding is acted on. |
| Cheyenne WY tree removal ~$1,100, range $400–$1,800; $190–$240/hr for a three-person crew | HomeBlue | **Aggregator — weak.** Used only because two first-party trade sources point the same way. The $120/hr is set from the low end of its range, so the imprecision is absorbed. |
| Casper WY 60 ft+ around $1,000–$1,200; Albuquerque NM $400–$1,700, typically ~$750 | Aggregators | **Weak.** Directional only — used to confirm Sixfold's bands are not out of line, never to set a price. |
| Albuquerque stump grinding $3–$5 per inch | Aggregator | **Not used.** It sits below every first-party rate found in six states, the same pattern as the rejected Denver figure. |
| Utah tree removal $10–$25 per trunk inch | Advanced Tree Service, Utah | **Verified first-party as published**, but it is a different pricing model. Noted, not converted. |

**Rejected again — fourth appearance.** The **"$1,700 per acre average, $1,050–$2,100 range"** figure came back three more times in this pass, including from a consulting firm's 2026 blog post and from an Arizona search that had nothing to do with Colorado. It is still the CSFS Northeast-area *lodgepole pine* number with its context stripped. It has now been rejected on 2026-08-18, 2026-08-24 (first pass) and 2026-08-24 (regional pass). **Assume it will surface again.**

**Not found, and worth saying plainly:** no operator anywhere in the six states publishes a **chipping hourly**, a **slash-piling price**, or a **per-acre defensible space rate**. The chipping figure remains the weakest number on every sheet, and the per-acre lines still rest on CSFS alone. The regional search did not fix either gap.

### Held off the one-sheet on purpose — 2026-08-24

Five things were cut from the sendable sheet at Matthew's direction. **They are not errors and they are not gone** — each stays live in this document, and each has a stated place it belongs instead. Do not put them back without asking.

| Held back | Where it belongs instead |
|---|---|
| **"Every price is a Colorado competitor's published rate, minus 5%"** — and the eight-operators-checked line under it | A flyer. It is an *attention* argument, aimed at someone deciding whether to call. The sheet goes to someone who has already called, and there the number itself does the work. |
| **The note under tree removal** — what puts a tree at the top or bottom of its band | Said on the walk-round, where the specific tree is in front of both of you. |
| **The Colorado 811 locate** — that stump grinding is excavation and needs three business days | Said during contact, when the date is being set. It is a scheduling fact, and on paper it reads as a delay rather than as diligence. |
| **$2.85 a mile beyond 35 miles** | Internal until there is enough completed work and reputation to charge for travel without it costing the job. The sheet now says nothing about travel at all — a bare "free within 35 miles" would only raise the question it no longer answers. |
| **The whole "What we don't do" block** — mulching, pile burning, storm call-outs, Denver city limits | A conversation after the quote or consultation. |
| **"Money that isn't ours"** as the heading on the funding band — replaced with **"Help paying for it"** 2026-08-24, on all three sheets and in §8 of this document | Nowhere. It was another piece of cleverness, like the line below it, and it made the section about Sixfold rather than about the reader. The replacement is plain and reader-side. **If no heading at all is wanted there, it is a one-line deletion** — the three labelled cells read fine without one. |
| **"We would rather you saw the number before you called"** — removed 2026-08-24, from the one-sheets and from §1 of this document | Nowhere. Matthew's read is that it comes off arrogant, and he is right — it congratulates Sixfold for publishing rather than telling the reader anything. The one-sheet now runs headline straight into the tables with no standfirst at all; a neutral one-liner can go back if the gap ever reads oddly. |
| **`SixfoldColorado.com` as a website** — removed from both sheets 2026-08-24 | Nowhere, until something resolves there. The domain is owned but **there is no site and no hosting**, so printing the address sends people to nothing. `Contact@SixfoldColorado.com` stays on both sheets — that address works. Put the website back the day it is live, not before. |

**Two of those are still real constraints on what can be sold**, whether or not they are printed: the **811 locate** genuinely blocks same-day stump work, and the **Denver Tree Service Company licence** genuinely bars trading inside the city. Taking them off the sheet does not lift them — see §7 and §11.

The cuts freed enough space that the sheet regained a contact foot, and the layout was rebalanced: acreage moved to the left column with the trees and stumps (what you are buying), crew time to the right with the disposal choices (how it is finished).

---

## The pricing rule

**Every price on this sheet is a published Colorado competitor's own figure, minus 5%.**

Not a guess at the market, and not an average of guesses. Each line names the
operator whose published rate it was cut from, so the discount is checkable by
anyone who wants to open two tabs. Where a competitor publishes a band because
the job genuinely varies — tree height, stump diameter, acreage — both ends of
the band come down 5%. Where they publish a single rate, that rate comes down 5%.

Almost nobody in this market publishes prices at all. Of the eight Colorado
operators screened in the market research, one published a full rate card, and it
serves resort counties. Publishing a plain number is the differentiator; the 5%
is the margin of the argument, not the argument.

**Five percent is deliberately small.** It is enough to win a decision against a
named quote and not enough to signal that the work is cheap or that the crew is
learning on your property. Do not let it drift to 20%.

---

## 1 — What Sixfold does

Six things, on a Front Range property:

- **Fell trees** — hazard trees, standing dead, beetle-killed, thinning to spacing.
- **Grind stumps flat** — down to grade, so it mows over.
- **Build slash piles** — cut material stacked on site.
- **Chip on site** — brush and limbs through the chipper, chips spread or left.
- **Cut rounds** — the trunk bucked to stove length and stacked where you want it.
- **Haul it off, or leave it** — your call, priced separately, in §4.

That last one is the biggest single number in most quotes anyone gives you, and
most companies fold it into the price without saying so. Here it is a line item
you can decline.

---

## 2 — Cutting trees down

Priced per tree, by height. The comparable is Hawk Tree Service's published
Colorado table.

| Tree | Colorado published rate | **Sixfold** |
|---|---|---|
| Under 30 ft | $150 – $500 | **$142 – $475** |
| 30 – 60 ft | $500 – $1,000 | **$475 – $950** |
| 60 – 80 ft | $1,000 – $2,000 | **$950 – $1,900** |
| Over 80 ft | up to $4,000 | **up to $3,800** |

Where a tree lands inside its band comes down to what is underneath it. A pine in
open ground at the back of a lot is the bottom of the band. The same pine leaning
over a roof, a fence line or a neighbour's shed is the top of it, because it comes
down in pieces on ropes instead of in one cut.

**Standing dead and beetle-killed** price on the same table. They are usually
faster to cut and less predictable to drop, and those cancel out.

**Minimum charge for a visit: $179.** One small tree, one stump, or an hour of
saw work all clear it. Below that the drive costs more than the job.

---

## 3 — Grinding stumps

| | Colorado published rate | **Sixfold** |
|---|---|---|
| Grinding, per diameter inch | $5.00 – $9.00 | **$4.75 – $8.55** |
| Minimum, one stump up to 18 in | $189 | **$179** |
| Stumps over 36 in, add per inch | +$1.00 | **+$0.95** |
| Grindings hauled away, per inch | $4.00 | **$3.80** |
| Grindings raked flat and left | — | **No charge** |

Diameter is measured at the widest point where the stump meets the soil,
including the root flare — the same way both Denver-metro companies quoted here
measure it. A stump that looks like 14 inches at eye level is often 22 at the
ground, so measure low.

Softwood in open soil sits at the bottom of the per-inch band. Hard wood, tight
access, rock or landscaping packed around the stump, or visible surface roots
running out across a lawn sit at the top.

**Stump work cannot be booked same-day, and no honest company will offer it.**
Colorado 811 lists stump grinding by name as excavation. The locate has to be
requested and the lines marked before the grinder touches the ground — two
business days by statute, three in practice. Sixfold files the locate; it is free
and it is not billed to you. Book the felling now, the grinding for the following
week, or both at once and take the later date.

---

## 4 — What happens to the wood

The choice that moves the price most. All five are available on any job.

| | **Sixfold** |
|---|---|
| Left where it falls, cut down under 24 in | **Included** |
| Stacked into slash piles on site | **Included** |
| Cut to rounds and stacked where you want them | **Included** |
| Chipped on site, chips spread or left in a heap | **$118/hr**, one hour minimum |
| Hauled off site, disposal fees included | **$142 – $190 per truck load** |

The first three cost nothing because the material never leaves your property and
the saw is already running. Chipping costs money because it is a second machine
and second pass. Hauling costs money because it is a drive and a tipping fee.

**Rounds** are cut to 16 inches unless you name a different length. This is green
softwood off your own ground — it needs a season to dry before it burns well, and
Sixfold does not split it or season it. Front Range firewood sellers get $150 to
$300 for a delivered cord of softwood; rounds in a heap in your yard are not that,
and nobody should tell you they are.

**Slash piles** are built where you point, clear of structures and off the drip
line. If the pile is destined for a county slash site rather than your burn pile,
say so at the estimate — it changes how it is stacked.

**Burning** is not offered. Pile burning is permit-gated and seasonal and Sixfold
does not hold the permit.

---

## 5 — Crew time, for work that is not one tree

For clean-ups, an afternoon of limbing, chipping a pile you cut yourself, or
anything easier to price by the hour than by the trunk. The comparable is Hawk
Tree Service's published Colorado labour rate of $65 – $140/hr.

| | Comparable | **Sixfold** |
|---|---|---|
| Two-person crew with saws, per hour | $100 | **$95** |
| Crew with chipper, per hour | $125 | **$118** |
| Full day, 8 hours, saws and chipper | $1,000 | **$895** |

One hour minimum. A booked full day is cheaper than eight hours bought
piecemeal, because the truck is loaded once.

**Travel** is free within 35 miles of Monument, which covers El Paso, Teller and southern Douglas
and most of Jefferson County. Beyond that, **$2.85 per mile** each way, quoted in
the estimate before you agree to anything.

---

## 6 — Whole-property fire mitigation

Defensible space priced by the acre. The one-acre figure is the State Forest
Service's own cost for a defensible-space project around a home, as published in
the legislature's 2026 evaluation of the wildfire mitigation tax credit.

| | Colorado published figure | **Sixfold** |
|---|---|---|
| One acre of defensible space around a home, Zones 1–2 | $3,200 – $6,100 | **$3,040 – $5,795** |
| Thinning, lightly wooded acre | $733 – $2,333 | **$696 – $2,216** |
| Thinning, heavily forested acre | $3,395 – $6,155 | **$3,225 – $5,847** |

This is hand and saw work: felling, limbing, spacing, ladder-fuel removal,
clearing the first five feet around the structure, and whichever disposal option
from §4 you pick. It is not machine mulching — see §7.

**For scale:** the only Colorado operator publishing a full fire-mitigation rate
card charges $3,000, $4,500 and $9,000 per acre across three tiers. Those are
Pitkin, Eagle and Summit County prices — resort-county rates on resort-county
drive times. They are listed here for context and are not what Sixfold's numbers
were set against.

---

## 7 — What Sixfold does not do, and why

Each of these has a specific reason. None of them is a hint that the work is
harder than it looks.

- **Forestry mulching and mastication.** No masticator and no mulching head in
  the fleet. Acres of dense brush that want a machine rather than a saw get
  referred out rather than quoted badly.
- **Tree work inside the City and County of Denver.** Denver Revised Municipal
  Code Chapter 57 requires a Tree Service Company licence to prune or remove a
  tree for pay anywhere in the city. Sixfold works Arapahoe, Douglas, Jefferson
  and the foothills; Denver proper is a licence question, not a capability one.
- **Pile burning.** Permit-gated and seasonal. Sixfold cuts and stacks; the burn
  is between you and your fire district.
- **Emergency and storm call-outs.** A damaged tree resting on a structure is a
  different job with different risk, and Colorado companies charge 25–50% more
  for it. Sixfold does not take it.
- **Claim handling and tax advice.** §8 gives you the facts and the paperwork.
  Which of them applies to your return is a question for your accountant, and
  anyone in a truck who tells you otherwise is guessing at your tax position.

---

## 8 — Money that is not ours

Two of these exist whether or not you hire Sixfold. Almost nobody in the state is
told about either one.

**The Colorado wildfire mitigation tax credit.** It covers 100% of what you spend
on qualifying vegetation work, up to **$1,000**, subject to an income limit. From
tax year 2027 the cap rises to **$2,000** and the credit becomes refundable, with
the income limit at $300,000 AGI, and it runs through 2030. Roughly **450 people
in the entire state** claimed it in tax year 2023. It does not cover structural
work — roofs, vents, siding — only the vegetation.

Every Sixfold job comes with an itemised invoice separating qualifying work, plus
before-and-after photographs of the areas treated. That is the file your
accountant needs. Whether you qualify is their call, not ours.

**Your insurer.** Since **1 July 2026**, a Colorado insurer that uses a wildfire
risk score to price or non-renew your homeowners policy has to send you that score
in writing once a year, tell you what mitigation discounts are available, factor
parcel-level defensible space into the score, and give you a discount for
documented mitigation. You can appeal the score. The photographs and the invoice
are the documentation.

If you have had a risk-score letter or a non-renewal notice recently, bring it to
the estimate. It usually names the specific thing the model does not like.

---

## 9 — Terms

- **The estimate is free and written.** The price is fixed in writing before any
  saw starts. It does not move afterwards unless you add work.
- **Payment on completion** for jobs under $1,500. Above that, half at the start
  and half on completion.
- **If you sign at your home, you have three business days to cancel**, in
  writing, for any reason and with no fee. That is Colorado law and it is not
  waivable. Sixfold does not start work until the three days have run, unless you
  ask in writing for an earlier start.
- **Everything cut stays yours.** Wood Sixfold hauls away is disposed of; wood
  left on site is your firewood, your mulch or your pile.
- **Nothing on this sheet expires.** There is no launch window and no price that
  goes up if you wait. If dates matter for your job they are calendar facts — the
  county slash site's season, the fire restriction stage, your insurer's renewal —
  and they are stated as such.

---

## 10 — Before this is released

Two gates. Neither is a copy problem.

**Insurance is not in place.** No general liability and no workers compensation.
This sheet quotes felling trees over roofs and fence lines at up to $3,800 a tree.
Handing it to a homeowner advertises work that cannot be safely taken on
uninsured, and the first claim ends the company. The sheet is deliberately silent
on insurance rather than claiming it — but silence stops being enough the moment
the sheet is what wins the job. **Get the quotes, bind the policy, then release.**

**The launch offer and this sheet contradict each other.** The two flyer offers on
the table are "bring us your quote and we will halve it" and "first ten
properties, 40% off." Either one, printed next to a rate card that says 5% under
market, tells a customer the published number is fiction. Pick one:

1. **Publish the rate card, drop the percentage offer.** The card *is* the offer,
   and it is the harder one for a competitor to answer.
2. **Run the launch offer first, publish the card when it ends.** Ten discounted
   jobs is a budgeted cost with a known end date.
3. **Keep both and price the offer off the card** — "40% off our published rate"
   is coherent where "40% off" floating in space is not, and it makes the card do
   the work.

Recommendation is (1). A published number in a market of "call for a quote" is a
durable advantage; 40% off is a one-season one, and it sets an anchor the business
has to climb back from.

**Also unresolved before release:** the phone number on this sheet is
(720) 772-6146, which is a Surge line. If Sixfold is getting its own number, it
should be on the card before the card is printed.

---

## 11 — Fact-check log

| Claim | Source | Status |
|---|---|---|
| Tree removal by size — under 30 ft $150–$500; 30–60 ft $500–$1,000; 60 ft+ $1,000–$2,000+; 80 ft+ up to $4,000 | Hawk Tree Service, Colorado Springs, own published cost page | **Verified first-party.** Colorado Springs rather than Denver metro — a real caveat, noted below. The clearest published size table found in the state. |
| Tree work labour $65–$140/hr | Hawk Tree Service, same page | **Verified first-party.** Used as the anchor for §5. |
| Stump grinding $5.00–$9.00 per diameter inch, grinding only | A Stump Man Tree Services, Littleton CO, own published pricing page | **Verified first-party**, and the service area explicitly includes Englewood. Page carries a 2019 copyright, so the figure may be stale on the low side — which makes the 5% cut conservative, not generous. |
| Stump minimum $189 for one stump up to 18 in; $9/inch beyond; +$1/inch over 36 in; mulch haul-away $4/inch | Flatirons Stump Removal, own pricing page | **Verified first-party.** Their page also shows a $169 promotional price; the $189 standard rate is what was used, because pricing against someone's discount is not pricing against the market. |
| Stump grinding minimum $80 | A-Class Tree Service, Colorado Springs | **Verified first-party.** Not used — it is a floor for grinding alone with no travel included, and pricing to it would not cover a Front Range drive. |
| Defensible space around a home, one acre, $3,200–$6,100 | Colorado State Forest Service data as published in the General Assembly's 2026 tax expenditure evaluation | **Verified.** Carried forward from this project's market research, where it was extracted from the source PDF. The most recent CSFS-sourced per-home figure available. |
| Per-acre removal — lightly wooded $733–$2,333; heavily forested $3,395–$6,155 | Hawk Tree Service, same published page | **Verified first-party.** |
| Bear Claw tiers — $3,000 / $4,500 / $9,000 per acre | Bear Claw Fire Mitigation, own pricing page | **Verified first-party, re-checked 2026-08-24** and unchanged since the 2026-08-18 research. Service area confirmed as Pitkin, Eagle and Summit. Used as context only, never as the anchor. |
| Residential defensible space projects run roughly $1,500–$8,000 | Fire Mitigation Experts, Colorado, own services page | **Verified first-party.** Consistent with the CSFS band, which is why the CSFS figure was preferred — it is narrower and traceable to a primary source. |
| Chipping $100–$150/hr | HomeGuide and GoTreeQuotes cost guides | **Weakest number on the sheet.** No Colorado operator publishes a chipping rate — three were checked and all say "call." The $118 is set inside the overlap between this band and Hawk's first-party $65–$140/hr labour rate, so it is bounded on one side by a real figure. Re-anchor it the first time a competitor quote is seen. |
| Brush pile removal $150–$200 per pickup-truck load | HomeGuide brush pile removal cost guide, via search summary | **Unverified.** The page itself returns HTTP 403 to direct fetch, so the figure was not read at source. Used for the haul-away band only, where it is corroborated on the low side by the Jefferson County SLASH tipping fee below. Treat $142–$190 as provisional. |
| Jefferson County SLASH — $24 per 6-cubic-yard load, season 15 May – 25 Oct 2026 | Carried forward from this project's market research | **Verified previously.** Confirms disposal cost per load is small relative to the drive, which is what the haul-away price actually pays for. |
| Front Range delivered softwood cord $150–$300 | Carried forward from this project's market research | **Verified previously.** Used only to tell a customer what rounds are *not* worth. |
| Delivery beyond a radius at $3/mile | Firewood Factory, Wheat Ridge CO, own delivery pricing page | **Verified first-party.** A firewood delivery rate, not a tree service rate — used because no tree company publishes a mileage charge. The 5% cut gives $2.85. |
| Colorado 811: stump grinding is excavation; two business days' statutory notice, three in practice | Colorado 811, professional excavators page | **Verified first-party 2026-08-24.** The page lists "Tree Root Removal / Stump grinding" by name in its definition of excavation. This upgrades the project's earlier inference to a direct citation. |
| Denver requires a Tree Service Company licence to prune or remove trees for pay | City and County of Denver, Office of the City Forester; Denver Revised Municipal Code Ch. 57 | **Verified first-party as a requirement.** Licence classes, exam, insurance minimums and fees are in a PDF packet that could not be parsed — **needs a phone call to (720) 913-0651.** The requirement itself is not in doubt. |
| Emergency tree removal runs 25–50% above standard in Colorado | Knothead Tree & Lawn Care, Castle Rock CO, published 27 Mar 2026 | **Verified first-party as a published claim.** Used only to explain why emergency work is declined, not to price it. |
| Tax credit — 100% up to $1,000, income limited; $2,000 and refundable from TY2027, $300k AGI, through 2030; ~450 claims in TY2023; excludes structural work | Colorado General Assembly 2026 tax expenditure evaluation | **Verified previously in this project** from the source PDF. Deliberately excludes the "thinning woody vegetation" framing that the marketing plan overstates. |
| HB25-1182 — effective 1 July 2026; annual written risk score, disclosure of available discounts, parcel-level mitigation in scoring, discount for documented mitigation, right of appeal | Bill page and Colorado House Democrats release | **Verified previously in this project.** |
| Colorado door-to-door: three business days to cancel, in writing, not waivable | 16 CFR 429 and C.R.S. 5-3-401 to 5-3-405, read first-party for the service agreement | **Verified previously in this project.** The "no start until the period runs" term is Sixfold's own choice, not a legal requirement — the law gives the right, this sheet declines to race it. |

**Rejected outright:**

- **"Fire mitigation averages $1,700 per acre, range $1,050–$2,100."** Returned by
  search three separate ways in this session, attributed to CSFS. It is not a CSFS
  statewide average — it is the Northeast-area **lodgepole pine** figure, stripped
  of its context by aggregators. The same error was caught and rejected in this
  project's market research on 2026-08-18 and it is still circulating. **Not used.**
- **"Denver stump removal averages $96–$129."** A lead-generation aggregator
  figure. It is below the published minimum charge of every Colorado stump grinder
  found, including two whose minimums are $80 and $189. It describes no real
  transaction. **Not used.**
- **Wood chipper rental at $150–$300/day in Denver.** SEO-generated page, no named
  source, and a cost input rather than a customer price in any case. **Not used.**

**Unresolved, and deliberately left off the customer sheet:**

- **No Denver-metro published table for tree removal by size exists.** The §2 band
  is Colorado Springs pricing. Front Range metro rates are plausibly a little
  higher, which would mean the 5% understates the discount. Correct it the first
  time a competitor's written quote is seen on a job.
- **Douglas County cost-share is not mentioned anywhere on this sheet.** It pays
  50% up to $25,000 and it requires two bids from the county's approved contractor
  list, which Sixfold is not on. It goes on the sheet the day that changes and not
  before.
- **Escalation on the CSFS per-acre figures.** The underlying 2020 cost table is
  six years old and excludes 35–51% overhead. The §6 numbers use the newer
  per-home benchmark instead, which sidesteps the problem for residential work but
  not for anything quoted by the acre at volume.
- **Whether the $179 minimum covers a Douglas County or foothills drive.** It is
  set 5% under Flatirons' published minimum, and Flatirons is a stump-only
  operation with a different cost base. Watch it on the first ten jobs.
