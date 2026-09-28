# Rebrand path — aeration-led

**Status: updated 2026-09-25 — the Phase 0 gate is closed on equipment.** Written 2026-09-24 off the positioning change Matthew made
2026-09-23: **aeration leads, general landscaping sits beside it, fire mitigation is still offered
but is no longer the headline.**

The logo board in [brand/rebrand-2026-09/](brand/rebrand-2026-09/) was the first work off that change.
This file is the rest of it — what has to move, in what order, and who each decision belongs to.

Nothing here is published, ordered, filed or uploaded.

---

## What changed 2026-09-25

Matthew, answering the gate directly:

| | |
|---|---|
| **Aerator** | **Owned.** So is a **riding mower.** 0.1 is closed and the claim on the repositioned site now has something behind it |
| **Aeration rate** | **Kara's job is the interim gauge** — $1,100 for ¾ acre, seed and fertilizer inside it. His call: run against it, and rebuild off actuals when the job closes out |
| **What landscaping means** | **Lawn care.** Mowing, aerating, fertilizing, seeding, taking down trees and plants, land clearing, brush removal, and **some snow work**. **No planting** |
| **Magnets and business cards** | **Neither has been ordered.** The one irreversible item on the list is still reversible |
| **Descriptor** | Still open. He wants options — they are in Phase 1 below |
| **Mark** | **Ridge for now, new palette.** He wants the colour to carry the seasons, so the year-round offer shows in the brand |
| **GBP category** | **His, and he is doing it** |

**Done the same day:** the turf equipment is on
[operations/gear-checklist.md](operations/gear-checklist.md); **/services/aeration/ is built**
(no price on it); **planting is off the website** everywhere it was sold.

**Two things this opened, both new and neither written down anywhere else:**

1. **Snow is a service Sixfold is taking and does not appear in a single document** — not the
   agreement lines, not the site, not the quote engine, not the gear list. It also carries a
   slip-and-fall exposure that is a different conversation with the broker than falling trees.
2. **"No planting" and "sod and seed" collide.** Planting is off the copy. Sod is laying turf,
   which is arguably the same objection, and he listed seeding without it — so **sod came off
   too, pending his answer.** Putting it back is one line.

---

## The finding that sets the order

**~~Sixfold cannot currently deliver or price the service it wants to lead with.~~**
**Half-resolved 2026-09-25: it can deliver it. It still cannot price it from its own numbers.**

Counted in this repo 2026-09-24, before the answer above:

- **No aerator anywhere in the gear record.** [operations/gear-checklist.md](operations/gear-checklist.md)
  covers the six lines on the signed agreement — felling, stump grinding, slash and chipping, rounds,
  defensible space, fuel break, thinning — plus climbing. No aerator, no overseeder, no topdressing
  kit, no mower.
- **No aeration rate.** The quote engine has no aeration line at all
  ([quotes/quote-engine.md](quotes/quote-engine.md) §4). The only figure in the building is Bryce's
  *"11-1400 for aeration"* on ¾ of an acre, which Brandon placed as a **competitor's** price, so it
  is a market check and not a rate. It is also unverified and on the high side.
- Outside the logo board and that one rates note, **the string "aeration" does not appear in the
  site, the marketing set, the agreements or the team share.**

So the first move is not a drawing. Rebrand onto a service that has no machine behind it and no price
in front of it, and the brand writes a cheque the crew cannot cash on the first call.

**Phase 0 below is the gate. Phases 1–5 should not start until it closes.**

---

## The season, and what it means for the deadline

**Spring and fall are the best times to aerate**, and a lawn can be aerated whenever the ground is not
frozen, just not when it is extremely hot and dry — CSU PlantTalk, first-party.

No CSU source names months, so the exact length of the Front Range fall window stays unresolved here.
What is not in doubt: it is **24 September**, so whatever remains of fall 2026 is running now and is
short.

**The rebrand cannot land inside it.** Phase 0 alone is an equipment decision and a pricing round.

So the target is **spring 2027**, and fall 2026 is a proving run:

- Take aeration jobs now, under the brand as it stands, at a price you are willing to be wrong about.
- The point is actuals — how long ¼ acre really takes, what the machine costs to run, what the
  customer asks on the walk. Job 2 is the precedent: the first real numbers changed the pricing more
  than any estimate did.
- Rebrand in the winter, on those numbers, and open spring with it.

---

## Phase 0 — Close the capability gate

**Owner: Brandon, with Matthew's numbers.** Nothing downstream is safe until these three land.

| # | Decision | What it blocks |
|---|---|---|
| 0.1 | ✅ **CLOSED 2026-09-25 — Sixfold owns the aerator**, and a riding mower with it. Owning sets the rate floor, so the rate is now a cost question and not a sourcing one. **Not recorded: make, model, tine size, deck width** — the tine spec is what the copy describes and deck width sets mowing time per acre | *was:* every price, and whether the copy may say "we aerate" |
| 0.2 | 🟡 **INTERIM 2026-09-25 — Kara's $1,100 for ¾ acre is the gauge until that job closes out.** His call, and it is the right one: it is a real charged price, which Bryce's number never was. It is **not yet a rate** — it has 200 lb of seed and 150 lb of fertilizer inside it, so what it says about aeration alone is unknown. **Time the pass and keep the bag receipts** and it becomes one | Nothing any more — it unblocks on a gauge. Still blocks a *published* price, which is not wanted anyway |
| 0.3 | ✅ **ANSWERED 2026-09-25 — maintenance. "Landscaping to us is basically lawn care."** Mowing, aerating, fertilizing, seeding, tree and plant removal, brush removal, land clearing, some snow. **No planting.** So the recurring side is the business and the short-form paperwork below is needed, not optional | The service architecture in Phase 3, and the ops paperwork below |

### The ops paperwork problem, which is 0.3's real cost

The existing paperwork is built for **big occasional jobs**: a 6-page quote-and-agreement packet, a
site-walk sheet organised as CLEAR / PROTECT / RESTORE / HAUL, a close-out sheet. That is right for a
$2,250 mitigation job.

A $150 aeration job cannot carry it. If aeration leads, there has to be a short form — one page,
price, date, signature — and a decision about whether it is per-job or a season agreement.

This is the largest piece of work the rebrand pulls in behind it, and it is invisible if you only
look at the logo.

**0.3's answer makes this the top of the list.** Recurring lawn care is many small jobs, and
Kara's packet is the shape of the problem: an aeration job and a $250/month maintenance
agreement, both drafted at five pages.

✅ **DONE 2026-09-28 — both forms are built.** `agreements/lawn-job-sheet` (3 pages) and
`agreements/lawn-monthly-agreement` (4 pages), with the reasoning, the fact-check log and the
open decisions in [agreements/lawn-forms-2026-09-28.notes.md](agreements/lawn-forms-2026-09-28.notes.md).

**Matthew's answer on the monthly: rolling, month to month, regardless of season.** That put
it inside **C.R.S. 6-1-732**, which Kara's non-renewing fixed term sat outside — so the
renewal terms are now boxed in 10.5pt and the agreement promises a written reminder once a
year. **⚑ Nobody runs that reminder yet.** Attorney review of that box is Brandon's, and if
these get signed in DocuSign rather than on paper there is probably a one-step online
cancellation duty with no route built for it.

---

## Phase 1 — The descriptor, before the mark

**"Land & Fire" names the demoted service and misses both promoted ones.** It was settled 15 Sep 2026
and it is already on the crew shirt and every business card option. It now carries **123 files** in
this repo.

Fixing this is cheaper than the mark and worth more, because it is the words that tell someone what
you sell.

**Recommendation: retire the fixed descriptor and do not replace it with another one.**

- Keep **Sixfold Colorado** as the public name — it already does the geography.
- Carry the services as a line in copy underneath, not as part of the logo lockup. A line in copy
  costs nothing to change; a descriptor locked into the lockup has now been printed once and would be
  reprinted a second time.
- A mark filed with no descriptor is also the broader filing.

### If one is wanted anyway — the options, 2026-09-25

He asked for candidates. Ranked, with what each costs and what each gives up.

| | Candidate | For | Against |
|---|---|---|---|
| 1 | **No descriptor.** "Sixfold Colorado", services carried as a line of copy underneath | Nothing to reprint the next time the mix moves — and it has now moved twice in ten days. Broadest filing | A wordmark alone says nothing to someone who has never heard of you |
| 2 | **Lawn & Land** | **Cheapest possible switch.** Same shape, same length, same two-word-with-ampersand rhythm as "Land & Fire", so every lockup, card layout, shirt spec and magnet takes it without redrawing anything. Covers turf, landscaping and clearing | Drops fire entirely — and fire is still sold, still has the funding content, and is still the reason half the existing collateral exists |
| 3 | **Grounds Care** — or **Year-Round Grounds Care** | The only candidate that covers **snow**, and the only one that never needs changing when the mix moves again. Sits naturally with the seasonal colour idea: the words say all year, the palette shows all year | Bland. It describes a category, not this company, and "grounds" reads commercial/HOA more than residential |
| 4 | **Turf & Timber** | Most memorable of the lot, and it spans the actual range — a mower at one end, a felling saw at the other. Alliterative, and it sounds like a crew rather than a category | "Timber" reads logging to some ears. Snow is nowhere in it |
| 5 | **Lawn, Land & Fire** | Honest: it is literally the three | Three nouns is one too many for a lockup, and it still leads with the word "lawn" next to the word "fire", which is the pairing being untangled |
| 6 | **Yard & Acreage** | Describes **scale**, not service, so no change of service list can date it. Answers the question a customer actually has — will you do my quarter acre, will you do my twenty | Vague about what is done to it |

**If a descriptor is going to exist, the shortlist is 2 or 3**: Lawn & Land if the priority is
changing as little as possible, Grounds Care if the priority is never doing this again.

### ✅ DECIDED 2026-09-28 — candidate 5, `Lawn, Land & Fire`

Matthew's call, against the shortlist above. It leads with the promoted service, keeps the one he
has twice declined to drop, and reads as three equal services rather than fire-with-add-ons.

**The argument against it does not survive measurement.** "Three nouns is one too many for a
lockup" — but `LAWN, LAND & FIRE` is **17 characters against `LAND & FIRE · COLORADO` at 22**.
Dropping the state more than pays for the extra noun, and "Sixfold Colorado" carries the geography.
It fits every lockup with room, and nothing had to be redrawn.

**Already applied to the cards and magnets** — see
[brand/rebrand-2026-09/printed-items-rebuild-2026-09-28.md](brand/rebrand-2026-09/printed-items-rebuild-2026-09-28.md).
**⚑ Brandon owns this call and has not seen it.** Nothing is ordered.

**None of these is the trademark.** A descriptor of this kind is descriptive and would not be
registered on its own — the mark and "Sixfold Colorado" are what get filed. It costs nothing at
the USPTO to change a descriptor later; it costs a reprint.

**Owner: Brandon's call, Matthew's recommendation.**

---

## Phase 2 — The mark

Already in flight in [brand/rebrand-2026-09/](brand/rebrand-2026-09/). "Ridge, aerated" is the single
candidate; the board is now four core treatments against identical geometry.

Open on the board, unchanged by this file:

- **Which core treatment** (01 mirror wedge / 02 broken plug / 03 section outline / 04 soft taper)
- **Which palette** (A demote the ember / B turf primary / C turf and wheat)
- **Whether the mark should encode six at all**

Add these three, which the path forces:

1. **The one-ink drawing has to be made before anything is ordered.** In one ink the four peaks merge
   into a single mass and the first form disappears, in all four treatments. The tonal ramp is
   load-bearing and one ink is exactly what an embroiderer, a vinyl cutter and a thermal receipt
   printer receive. It is also the drawing that gets registered — black-and-white with no colour claim
   protects the mark in any colour.
2. **The house gets weaker, not stronger, under this positioning.** Four objections are already on the
   board. Aeration is a turf service, not a structure-protection service, so a house now argues for
   the thing being demoted. The compromise — house on the turf band as scenery, conifer still one of
   the five counted forms — is still undrawn and is still the version that does not fight the mark.
3. **Re-run the prior-use screen on the new drawing.**
   [research/logo-prior-use-screen.md](research/logo-prior-use-screen.md) covered the Ridge mark only,
   and two of its checks were never run — reverse image search and the USPTO design-code search.

**✅ Checked 2026-09-25: the vehicle magnets have NOT been ordered, and neither have the business
cards.** Matthew, direct answer, which is better than the repo's silence. Nothing irreversible has
happened — the descriptor and palette can still change for free. **Keep it that way until Phase 1
and 2 close.**

**Direction 2026-09-25 — Ridge stands, the palette moves.** Matthew: use the Ridge mark as it is
for now, with a different palette, and *"make the colors more distinguished seasonally to showcase
that we offer care across all seasons."*

That is a real idea and it belongs in a specific place:

- **The mark does not change colour.** One mark, one ink, on the magnet, the shirt, the card and
  the filing. A logo that changes with the season is four logos, and it is the four-colour problem
  the one-ink drawing exists to solve.
- **The seasonal set is an accent layer** — the band behind a social post, the header on a
  seasonal flyer, the accent on the site through the year. Four accents against one fixed core.
- **The ember already has a season.** It is autumn. Palette A demoted it to the call-to-action and
  fire mitigation; a seasonal set gives it a second honest job instead of retiring it.
- **Each accent has to clear contrast on both grounds**, the way `--turf` and `--sage` were
  measured on Bone and Pine. A winter accent that fails on Bone is a winter of unreadable links.

Nothing above changes which core treatment wins. It is the palette question, answered separately,
which is what he asked for.

---

## Phase 3 — The public surfaces, in risk order

These are the only things a customer actually sees. Everything in Phase 4 is internal by comparison.

**1. The website — the big one.** Live at sixfoldcolorado.com since 21 Sep 2026, nine pages. It leads
with fire in every slot that matters:

- `<title>` — *"Fire mitigation, land clearing, landscaping"*
- `<h1>` — *"Fire mitigation, land clearing and landscaping on Colorado's Front Range."*
- Services page — fire mitigation is the first of three
- **Two of the four nav items are fire** — "Mitigation funding" and "Wildfire guide"

What to do:

- Reorder the three services and rewrite the title, description and h1 so aeration leads. Keep the
  "three services, any one of them" frame — it is already the rule, and it is what stops landscaping
  reading as the after-job of fire mitigation.
- ~~**Add an aeration page.**~~ ✅ **Built 2026-09-25** at `/services/aeration/` — the equipment
  answer cleared it. No price on it, by the standing rule and by his instruction. `/services/landscaping/`
  handed the aeration paragraph over and points at it; the hub's lawn section points at it; it is in
  the sitemap. Both auditors clean: links all clear, runtime **40 renders, 0 failures, 0 warnings**.
- **Do not delete `/who-pays/` or `/wildfire-guide/`.** They are the most substantial content on the
  site and the tax-credit and funding material is a genuine reason for someone to call. Demote them
  out of the top nav and keep them reachable from the fire mitigation page.
- Re-bundle with `make-bundle.mjs`, re-run `audit-runtime.mjs` against the live URL, and cache-bust
  when verifying — the host serves a stale proxy cache after an upload. Never empty `public_html`;
  the submissions log lives there.

**Do this after Phase 0, not before.** An aeration page with no price and no machine is the same
cheque as before.

**2. Google Business Profile. — ⚑ MATTHEW IS DOING THIS, 2026-09-25.** The category is the single
highest-leverage field in local search and it is one dropdown. Changing the primary category from a tree/fire category to a lawn-care category
does more for aeration enquiries than the logo will.

**3. Nextdoor.** The page slug is `six-fold-colorado-englewood-co` — wrong town, Sixfold operates out
of Monument. **Renaming the page breaks the QR code**, which is decode-verified against that exact
string, and that QR is on printed collateral. Decide the rename and the QR reprint together or not at
all.

**4. Linktree, Facebook page copy, Square description.** Copy-only, cheap, do them in one sitting
after the site copy is settled so they all say the same thing.

**Do the social images need the mark settled first? No — 2026-09-25.** He asked, and the answer
splits by whether the thing can be changed for free:

| | Wait for the mark? |
|---|---|
| Facebook / Nextdoor profile image and banner, Square logo and invoice header | **No.** Changing them is a re-upload. Build them on the Ridge flat mark and palette A now, re-cut when the treatment lands — the generators in [brand/social/](brand/social/) and [brand/square/](brand/square/) already exist, so it is a re-render, not a rebuild |
| Vehicle magnets, business cards, crew shirts | **Yes.** They cost money once and again |

**Square invoices are the one with a deadline behind them**, because an invoice goes to a paying
customer with whatever mark is on it that day.

**The Nextdoor rename is still not free** — the slug says Englewood, Sixfold is in Monument, and
renaming breaks a QR that is decode-verified against the current string and already printed.

---

## Phase 4 — The collateral sweep

Counted 23 Sep 2026: **180 files** carrying the ember hex or the Ridge path data, **40** rendered
brand PNGs, **84** PDFs, **3** vehicle magnet files. Plus the **123** files carrying "Land & Fire".

This is doable — the September phone-number sweep moved 57 files and 21 PDFs and is the precedent.
Two traps it exposed, both of which apply again:

- **Thirteen PDFs had no job in [tools/html-to-pdf.mjs](tools/html-to-pdf.mjs)** and so could not be
  rebuilt from source, which is why they had gone stale silently. Jobs now exist for all thirteen,
  with expected page counts written in. Verify page counts after every rebuild.
- **Published artifacts drift behind local sources.** The rate card, three rate sheets, services sheet
  D, the pamphlet, the gear checklist, the tax-credit notebook and forms, the marketing plan, platform
  sheet, content set, minimum-viable-start sheet, funding one-pager and launch flyers are *already*
  behind on the phone number. A rebrand widens that gap. Republishing each one is a separate decision
  per URL.

**Order within the sweep:** anything a customer touches first (agreements, invoice, business cards,
door hanger, flyers), then the team share (25 PDFs — rebuild after any PDF change), then research and
internal reference last.

**Do not start this before Phase 1 and 2 are both settled.** Sweeping 180 files for a descriptor that
changes again is the one genuinely wasted week available here.

---

## Phase 5 — Open spring 2027 on it

Site live in the new shape, aeration page with a real price, GBP category changed, collateral swept,
magnets on the trucks. Fall 2026's actuals behind the pricing.

---

## Blocked on whom

| Item | Owner | Notes |
|---|---|---|
| ~~Aerator~~ | — | ✅ **Owned, 2026-09-25.** Closed |
| ~~Aeration rate~~ | — | 🟡 **Interim: Kara's $1,100/¾ acre is the gauge.** Rebuild off actuals at close-out |
| ~~What landscaping means~~ | — | ✅ **Lawn care, no planting, 2026-09-25.** Closed |
| **Sod — still sold or not?** | **Matthew** | Came off the site with planting. One line to put back |
| **Snow — is it a service or a favour?** | **Brandon** | Not in any document, and it carries its own insurance question |
| Aerator make, model, tine size; mower deck width | Either of them | The copy describes the tines; deck width sets mowing time per acre |
| Descriptor: retire "Land & Fire"? | **Brandon**, Matthew recommends retiring | Blocks the mark. **Six candidates now written up in Phase 1** |
| Core treatment + palette | **Brandon**, at the meeting | Board is built and printed. **Matthew 2026-09-25: Ridge as it stands, new palette, seasonal accents** |
| ~~Vehicle magnets — already ordered?~~ | — | ✅ **Not ordered. Nor the cards.** Confirmed 2026-09-25 |
| Widening the service area | **Brandon** | 35 mi of Monument is a derived figure applied across 5 documents; lawns are where the suburbs are |
| Insurance, attorney review, SoS address filing | **Brandon** | Already handed over 2026-09-18 — not on Matthew's list |
| Douglas County approved contractor list | A phone call | Still unmade; blocks the cost-share copy |

---

## What not to do yet

- **Do not order magnets, shirts or cards** until Phase 1 and 2 close. Check first whether the magnets
  already went.
- **Do not file the trademark** until the one-ink drawing exists and the prior-use screen has been
  re-run on it. Sixfold AI, Inc. is still the conflict worth an attorney's twenty minutes.
- **Do not put "licensed and insured" anywhere**, including platform bios, until the insurance exists.
- **Do not advertise the Douglas County cost-share** until Sixfold is on the approved list.
- **Do not quote from [marketing/pricing-guide.md](marketing/pricing-guide.md)** — the Sedalia job lost
  money against it and it carries a do-not-quote banner.
- **Do not reframe landscaping as the after-job of anything.** Three services, any one of them.

---

## If only three things get done

~~1. Settle the aerator.~~ ✅ Done 2026-09-25. ~~2. Change the GBP category.~~ Matthew is doing it.

**Rewritten 2026-09-25:**

1. **Retire "Land & Fire", or pick from the six.** Unchanged, and now the only thing blocking the
   mark. Candidates are in Phase 1.
2. **The one-page lawn job sheet.** 0.3's answer means recurring small jobs, and the paperwork on
   the shelf is built for $2,250 ones. Needs nobody.
3. **Time an aeration pass and keep the seed and fertilizer receipts.** Two numbers turn the gauge
   into a rate, and Kara's job is the one chance to take them.

---

## Fact-check log

| Claim | Status |
|---|---|
| Spring and fall are the best times to aerate; any time the ground is not frozen, not when hot and dry | **Verified** first-party, CSU PlantTalk 1505 and 1559 |
| Length of the Front Range fall aeration window | **Unresolved** — no CSU source names months. Left out rather than guessed. The practical point holds regardless: it is late September |
| Core aeration is a punch with hollow tines, 1/4″–3/4″ ID, 2–3″ plugs dropped on the surface | **Verified** 23 Sep 2026 against UMass Amherst Extension; recorded in full on the logo board |
| No aerator, overseeder, topdresser or mower in the gear record | ⚑ **SUPERSEDED 2026-09-25 — Sixfold owns an aerator and a riding mower.** Matthew, direct. The count was right about the *record* and wrong about the world, which is exactly the failure mode the row itself named. The record is fixed: [operations/gear-checklist.md](operations/gear-checklist.md) §Turf equipment. Overseeder and topdresser still not recorded |
| No aeration line in the quote engine | **Counted** — [quotes/quote-engine.md](quotes/quote-engine.md) §4 says so outright |
| $1,100–1,400 for ¾ acre | **Unverified**, single unattributed source, and Brandon placed it as a competitor's price. Market check only, never a rate |
| Kara: $1,100 for ¾ acre, Sixfold's own first charged aeration price | **Real, and it is the interim gauge by Matthew's call 2026-09-25.** Not a rate: it carries 200 lb seed and 150 lb fertilizer inside it. [quotes/quote-engine.md](quotes/quote-engine.md) §4 |
| 123 files carry "Land & Fire" | **Counted** 2026-09-24 |
| 180 files / 40 PNGs / 84 PDFs / 3 magnet files | **Counted** 23 Sep 2026, recorded on the logo board |
| Site leads with fire in title, h1, services order and two of four nav items | **Read** from [site/index.html](site/index.html) and [site/services/index.html](site/services/index.html) 2026-09-24 |
| Nextdoor slug says Englewood and the QR is decode-verified against it | From [brand/qr/README.md](brand/qr/README.md) — not re-checked against the live page |

Sources: [CSU PlantTalk 1505 — Lawn Aeration](https://planttalk.colostate.edu/topics/lawns/1505-lawn-aeration/),
[CSU PlantTalk 1559 — Proper Lawn Aeration](https://planttalk.colostate.edu/topics/lawns/1559-proper-lawn-aeration/)
