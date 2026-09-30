# Sixfold quotes

> ## Kara — aeration, overseeding and feeding (2026-09-30)
>
> **$1,100.00 fixed, split $550 / $550. Job booked for Monday 12 October 2026.**
> Same customer as job 2. Every figure and every line of scope is taken from
> [../agreements/kara-aeration-agreement](../agreements/kara-aeration-agreement.html) sections 2
> and 5 — **if the agreement changes, this changes.**
>
> | File | Pages | For |
> |---|---|---|
> | `Sixfold-Quote-Aeration-Kara-Rosenstrauch.pdf` | 1 | The quote alone, to send on its own |
> | `Sixfold-Quote-and-Agreement-Aeration-Kara-Rosenstrauch.pdf` | 6 | Quote + agreement, for DocuSign |
>
> Same two-render arrangement as job 2: one source, one sentence different, switched by the
> `css` field on each JOBS entry. The packet half is `_part-quote-aeration.pdf` — **`_part-` means
> intermediate, never send.**
>
> ```
> node quotes/build.mjs && node agreements/build.mjs
> node tools/html-to-pdf.mjs quote-aeration Quote-Aeration kara-aeration
> py -3 tools/merge-pdf.py quotes/Sixfold-Quote-and-Agreement-Aeration-Kara-Rosenstrauch.pdf \
>   quotes/_part-quote-aeration.pdf agreements/kara-aeration-agreement.pdf
> ```
>
> **`py -3`, not `python`** — the Store stub shadows the real 3.13 on PATH.
>
> ### Two things this sheet deliberately does NOT do, unlike job 2
>
> **No "typical local rate" comparison column.** The only market figure on record for aeration
> is *"¾ of an acre. Bryce said 11-1400 for aeration"* in
> [rates-brandon-brad-2026-09-23.md](rates-brandon-brad-2026-09-23.md), and that file itself says
> Bryce appears nowhere else in the repo, the figure is unattributed, and **$1,100–1,400 for ¾
> acre "is high … it wants a second look."** It also covers **aeration only**, not the seed or
> the fertilizer, so it is not comparable to this job. A comparison column built on it would be
> an invented number on a customer-facing sheet. **Matthew confirmed 2026-09-30 that none is
> wanted.** Add one when there are sourced rates for all three services, not before.
>
> **No per-line prices.** The agreement prices this job as **one fixed sum**, so the scope lines
> read "Included" and only the total carries a figure. Splitting $1,100 across them would be an
> allocation nobody agreed — and
> [../operations/invoice-spec.md](../operations/invoice-spec.md) §2 records exactly that mistake
> from job 2, where re-allocated line items *"would have billed two specific tasks as though they
> were the deposit's scope, when the agreement prices the job as one fixed sum and splits the
> **payment**, not the work."* The invoice reprints these lines unchanged.
>
> **Sending it:** [../agreements/kara-docusign-setup.md](../agreements/kara-docusign-setup.md).
> Draft only — nothing has been sent.
>
> ---
>
> ### Kara — twelve-month grounds maintenance (2026-09-30)
>
> **$250.00 a month, November 2026 to October 2027, $3,000.00 over the term.** First visit
> **Thursday 19 November 2026**, first payment **1 November 2026**. Traces to
> [../agreements/kara-maintenance-agreement](../agreements/kara-maintenance-agreement.html)
> sections 2 to 6.
>
> | File | Pages | For |
> |---|---|---|
> | `Sixfold-Quote-Maintenance-Kara-Rosenstrauch.pdf` | 1 | The quote alone |
> | `Sixfold-Quote-and-Agreement-Maintenance-Kara-Rosenstrauch.pdf` | **7** | Quote + agreement, for DocuSign |
>
> Same two omissions as the aeration quote and for the same reasons: no comparison column, no
> per-line prices. **Two things this sheet does say out loud:** the snow cap — *up to five
> clearing visits in any one calendar month* — because it is a real limit on what she is buying
> and she should not find it in clause 14; and that **clearing snow does not make a surface
> safe**, which is the clause most worth an attorney's eye.
>
> **⚑ No ice treatment is mentioned anywhere, deliberately** — Matthew's call 2026-09-30.
> Neither confirmed nor denied, handled verbally if it comes up. **Do not add it back.**
>
> ```
> py -3 tools/merge-pdf.py quotes/Sixfold-Quote-and-Agreement-Maintenance-Kara-Rosenstrauch.pdf \
>   quotes/_part-quote-maintenance.pdf agreements/kara-maintenance-agreement.pdf
> ```

---

> ## Job 2 — yard clearance, trimming and planting (2026-09-14, revised 2026-09-15)
>
> **CURRENT: $1,500, three small tree removals.** Matthew's instruction 2026-09-15, replacing the
> $1,900 / five-tree revision 5 that went to DocuSign on 09-14. Typical-rate comparison moves with
> it, $3,700 → **$3,300**; the difference stays **$1,800** because both columns fell by $400.
> Reasoning, the margin table and the clause-numbering defect found in the re-check are in
> [walk-2026-09-14-job2.md](walk-2026-09-14-job2.md) **§8c**.
>
> **There are now TWO sendable files, not one:**
>
> | File | Pages | For |
> |---|---|---|
> | `Sixfold-Quote-Kara-Rosenstrauch.pdf` | 1 | The quote alone, to send on its own |
> | `Sixfold-Quote-and-Agreement-Kara-Rosenstrauch.pdf` | 6 | Quote + agreement, for DocuSign |
>
> They share one source and differ in one sentence — the standalone must not say the agreement
> "follows overleaf". Switched by the `css` field on each entry in `tools/html-to-pdf.mjs`.
>
> ```
> node quotes/build.mjs && node agreements/build.mjs
> node tools/html-to-pdf.mjs _part-                    # the two packet halves
> node tools/html-to-pdf.mjs Sixfold-Quote-Kara        # the standalone
> python tools/merge-pdf.py quotes/Sixfold-Quote-and-Agreement-Kara-Rosenstrauch.pdf \
>   quotes/_part-quote-only.pdf agreements/_part-service-agreement.pdf
> ```
>
> **The filter matches the OUT name, not the source** — `node tools/html-to-pdf.mjs job2-yard`
> throws "No jobs matched".
>
> ---
>
> Walked by Brandon, originally quoted at **$1,700**. **Priced cost-up, not off the rate card** — see
> [walk-2026-09-14-job2.md](walk-2026-09-14-job2.md), which carries the walk sheet, the cost model,
> the sourced billable rate and the fact-check log.
>
> **It is the first job in this repo with its own cost inputs recorded** (dump fee, fuel, rentals,
> crew days), and those numbers show the rate card **losing about $400 on this job** — the Sedalia
> pattern repeating. The haul-off line is underwater on its own: $278 of card revenue against a
> $260 tip fee and $50 of fuel. **Read §5 of that file before touching the rate card rebuild.**
>
> **There is exactly ONE file to send: `Sixfold-Quote-Kara-Rosenstrauch.pdf`** — 6 pages, the
> one-sheet quote followed by the five-page service agreement, so it can be read and signed in one
> go.
>
> **The two halves are build parts and are named `_part-*` on purpose.** Matthew opened the
> quote-only PDF on 2026-09-14 and reported the agreement missing, because the parts were then
> named like deliverables. Anything beginning `_part-` is an intermediate: never send one.
>
> Rebuild after any edit to either half:
>
> ```
> node quotes/build.mjs && node agreements/build.mjs
> node tools/html-to-pdf.mjs _part-
> python tools/merge-pdf.py quotes/Sixfold-Quote-Kara-Rosenstrauch.pdf \
>   quotes/_part-quote-only.pdf \
>   agreements/_part-service-agreement.pdf
> ```
>
> `tools/merge-pdf.py` is new (2026-09-14) and explains in its header why the PDFs are merged
> rather than the HTML: each document has its own `.sheet:first-of-type` print fit-pass — the
> agreement has sixteen such rules tuned to *its* page 1 — and combining the markup lands every one
> of them on the wrong page. Merging the rendered PDFs also preserves each document's own `scale`
> (quote 0.84, agreement 0.8).
>
> **The two halves keep their own page numbering on purpose** — the quote reads "Page 1 of 1" and
> the agreement "Page 1 of 5" through "5 of 5". Do not renumber them 1–6: the agreement's term 14
> and its cancellation section both cross-reference "pages 1, 2, 4 and 5", and renumbering would
> break those references inside a legal instrument.
>
> **ISSUED 2026-09-14 — uploaded to DocuSign, awaiting signature.** Brandon completes the
> cancellation dates, the signature and initial fields, and Kara's phone, email and ZIP at signing.

---

> ## ⚠ Everything below this line is priced off the rate card — 2026-09-16
>
> The Sedalia pack and its fact-check log reconcile to **Sheet A of the pricing guide, which is superseded**:
> the Sedalia job lost money on those rates, and job 2's recorded costs (above) show why. The "verified
> against the card" rows in the log below are true as written — they say the sheets match the card, not that
> the card was right. **Do not send either Sedalia option as it stands.** Re-price through the cost-up engine
> ([quote-engine.md](quote-engine.md)) before anything goes to that customer. The section is kept as the
> record of how the job was reasoned about on 2026-08-28.

## The Sedalia pack — S Sedalia, downed wood clearance

**Built:** 2026-08-27 · **Repriced and expanded 2026-08-28**
**Status:** Drafts on disk. **Not sent, not signed, not scheduled.** Nothing here has been in front of the customer.
**Job:** A homeowner in S Sedalia (Douglas County). A pile of already-felled logs and limbs she wants gone. Surveyed on site; photos and video taken.

| File | Who sees it |
|---|---|
| [Sixfold-Quote-Sedalia-A-Hauled-Away.pdf](Sixfold-Quote-Sedalia-A-Hauled-Away.pdf) | **The customer.** Two pages. **$2,250** — cut, load, haul off, dispose |
| [Sixfold-Quote-Sedalia-B-Chipped-On-Site.pdf](Sixfold-Quote-Sedalia-B-Chipped-On-Site.pdf) | **The customer.** Two pages. **$2,000** — cut, chip on site, chips and rounds stay |
| `sedalia-*.src.html` + `_style.css` + `build.mjs` | Sources. `node build.mjs`, then `node ../tools/html-to-pdf.mjs Sedalia` |

---

## What changed on 2026-08-28, and why

Matthew's direction: **bring the non-haul option up to $2,000 and put the haul option a little over $2,000**, make both sheets more descriptive about the work and the price breakdown, and put the tax-credit and insurer documentation help on the sheets as a named service.

| | Was (27 Aug) | **Now** |
|---|---|---|
| Option A — hauled away | $2,000 | **$2,250** |
| Option B — chipped on site | $1,350 | **$2,000** |
| The gap between them | $650 | **$250** |
| Pages each | 1 | **2** |
| Payment terms, Option B | On completion | **Half and half** — it is now over $1,500 |

Everything still reconciles to **Sheet A** of [../marketing/pricing-guide.md](../marketing/pricing-guide.md). No rate was invented and no rate was moved; the two totals are reached by changing the *quantities* the job is priced on, each for a reason that is written on the customer's sheet.

### Three consequences worth reading before either sheet goes out

1. **Option A is now above the $2,000 she has already been quoted.** The 27 Aug price was set to match that quote, deliberately, and the argument against Sheet C was precisely that it "would put Option A at roughly $2,270 — above the $2,000 she has already been quoted." **$2,250 is that position.** The sheets still never mention her other quote, so the pitch is now the description, the itemisation and the paperwork rather than the number. If the number has to win, this is the wrong price.
2. **Declining the hauling now saves her $250, not $650.** The pricing guide's §4 argument — that hauling is the big number most companies fold in silently, and Sixfold makes it the line you can decline — is much weaker at $250. Both sheets meet this head-on rather than hoping she does not notice: they say the gap is smaller than people expect and explain that the chipper needs a second full day where the trailer does not. **That is true and it is the honest version, but it is also the obvious question she will ask, so whoever hands the sheet over should have the sentence ready.**
3. **The two-day chip estimate is now committed in writing.** Open question 1 on the 27 Aug build was whether Option B is one and a half days or two. Pricing B at $2,000 answers it: **two booked days plus about two hours.** If the crew can genuinely do it in a day and a half, the sheet overstates the work and the margin sits in the difference. Decide it against the photographs before the sheet is handed over, not after.

---

## Where the numbers come from

Sheet A rates, unchanged: crew with saws **$95/hr**, crew with chipper **$118/hr**, booked full day with saws and chipper **$895**, haul off site **$142–$190 per load with disposal included**, and slash piling / rounds / left-where-it-falls **included**.

### Option A — hauled away, $2,250

| Line | Card rate | Quantity | |
|---|---|---|---|
| Two-person crew with saws | $95/hr (§5) | 12 hours | $1,140 |
| Haul off site, disposal included | $142–$190 per load (§4) | 6 loads at $185 | $1,110 |
| Site walk, photographs, invoice, work record | Included (§8) | — | — |
| | | | **$2,250** |

**The crew line has not moved.** Same 1½ days, same rate, same $1,140 as the 27 Aug sheet. The whole increase is in the disposal line, and it comes from two changes, both stated on the customer's face:

- **Six loads, not five.** Five was Matthew's site estimate and the 27 Aug sheet absorbed a sixth inside the fixed price. The sheet now **buys the sixth explicitly** and says so — *"We count the pile at five; the sixth is bought in advance so a miscount does not come back to you as an extra."* That is the honest description of a fixed price with a contingency in it, and it converts what was silent margin into a named benefit. A seventh load still eats the margin.
- **$185 a load, not $172.** $172 was the mid-band figure picked to land on $2,000. $185 sits in the top quarter of the published $142–$190 band, and the reason is the drive: **Sedalia is at or past the 35-mile free-travel line from Monument**, and the 2026-08-24 decision keeps `$2.85/mile` off customer sheets. Carrying the distance inside the haul rate — where the card already says the load price covers "a drive and a tipping fee" — is the coherent way to price it without adding a travel line the decision says not to add. **The road distance still has not been checked.** If it turns out to be inside 35 miles, $185 is defensible but no longer explained by anything, and $172 would be the better number.

### Option B — chipped on site, $2,000

| Line | Card rate | Quantity | |
|---|---|---|---|
| Booked full day, saws and chipper | $895 (§5) | Day one | $895 |
| Booked full day, saws and chipper | $895 (§5) | Day two | $895 |
| Crew with chipper, finishing hours | $118/hr (§5) | 2 hours | $236 |
| Rounds cut to 16in and stacked; chips left in one pile | Included (§4) | — | — |
| Site walk, photographs, invoice, work record | Included (§8) | — | — |
| | Arithmetic **$2,026**, **quoted** | | **$2,000** |

Rounded down, and the sheet says so — the same convention as the 27 Aug version.

**Chips go into one pile, and the sheet says nothing about spreading them.** Rate card §4 offers chips *"spread or left in a heap"*; **this quote offers only the heap**, at Matthew's direction on 2026-08-28. The scope bullet states it positively and then closes it — *"the chips stay in that pile and are yours to use or move — we do not spread them out"* — rather than adding it to the exclusions list. **That is a deliberate narrowing of a card option, not a contradiction of the card**, and it should not be read as a general change to what Sixfold offers: the next job can still be quoted either way.

**Burning came off both sheets on 2026-08-28**, at Matthew's direction. It was an exclusion — *"pile burning is permit-gated and seasonal, and Sixfold does not hold the permit"* — not an offer, so the sheets now simply say nothing about it. Two notes. **It is still true and still stands in the pricing guide** (§4 and §7); nothing about what Sixfold does has changed, only what this quote volunteers. And **the exclusions list is now the shorter for it** — three items on Option A, two on Option B — which is worth watching, because the list's job is to stop a customer assuming an adjacent service is included, and burning is the adjacent service a homeowner with a slash pile is most likely to be thinking about. If she raises it, the answer is the permit, and it has not changed.

**This is the two-day build the 27 Aug README already costed at "about $1,790" and flagged as the likely truth.** Its reasoning is now on the customer's sheet, inside the day-two row rather than in a separate block: a chipper is fast on brush and slow on a big log, there is enough oversized wood in this pile to make it two days, and *"better to quote two and be right than quote one and come back for a change order."*

---

## Two pages, deliberately

The 27 Aug build was verified at exactly one page each, on the rule that **a two-page quote puts the price on one sheet and the terms it is conditional on on another, which is the arrangement every complaint starts with.**

That rule is about *where the conditions sit*, not about the page count, and it is intact:

- **Page 1** carries the scope, the itemised price, the headline figure, the exclusions and every term — payment, the three-day cancellation right, the no-expiry line, who owns the wood. **Nothing that conditions the price is anywhere else.**
- **Page 2** carries the documentation service and the other option's price. Neither one changes what she pays or what she gets for it, and the page says so at the foot: *"Nothing on this page depends on which option you pick, and none of it is charged for either way."*

Both are verified at **exactly two pages**, by printing to PDF and counting. Option B needed five rounds of trimming to keep its page 1 whole; screen height does not predict the break, and it silently pushed the footer onto a page of its own for three of those rounds. **Re-count after any edit.**

---

## The documentation service, as it is now written

This is the substantive addition, and it is a **commitment to do work, not just to hand over files.** Everything named below already exists in [../tax-credit-notebook/](../tax-credit-notebook/) — nothing was invented for the quote — but the sheets now promise the crew will sit down and use it.

**Tax credit.** The sheets promise five things: fill in the eligibility record **with her, before the crew starts** (Form A — owner of record, how the land is held, and whether grant or cost-share money is paying part of the bill, which is the question that most often changes the answer); itemise the invoice by the state's own measure categories; write the work record (Form B); supply the photograph log (Form D); and hand over the accountant's checklist (Form C). Plus: **the whole file comes with the invoice, not weeks afterwards.**

**Insurer.** The sheets now lead with **the re-score right in §(7)(d) of HB25-1182** — after new mitigation work the homeowner can request a fresh score and the insurer has 30 calendar days — which is the actionable part of that statute and appears in no secondary coverage of it. Sixfold assembles the photographs, invoice and work record **as one package addressed to her insurer**, and **helps her put the re-score request together**.

### Where both blocks stop, in the copy itself

- *"Sixfold does not prepare or file returns and does not issue a certification — no contractor can."*
- *"You send it — we do not contact your insurer for you."*
- *"Nobody can tell you in advance what the discount is worth"*, because the act makes each insurer publish its own figures and sets no rate.
- The page-2 footer disclaimer on both sheets: **"Nothing on this sheet is tax advice or insurance advice."**

**The banned phrase is still banned.** "We handle the paperwork for you" appears nowhere and must not appear in conversation either — the notebook bans it on two sheets because said loosely it reads as tax preparation. What the sheets promise is documentation, plus help assembling and drafting. She files; she sends.

**This is now an operational promise, and it has to be deliverable.** Two things follow: the crew needs the four forms printed and in the truck on day one, and somebody has to actually be able to sit with a homeowner and draft a re-score request. Neither has been done yet. If that help is not going to happen, the wording has to come back off the sheet before it is handed over — an unmet promise on a quote is worse than a quote that never made it.

---

## Decisions carried forward from 27 Aug, unchanged

- **Sheet A, not Sheet C.** Both sheets are still built on Sheet A rates. **Note the tension:** Option A's total is now within $20 of what Sheet C would have produced, but it is reached with Sheet A rates and larger quantities. If C is adopted, these two sheets still do not automatically reprice, and the itemisation would need rebuilding rather than adjusting.
- **No percentage offer.** Neither sheet references her other quote at all.
- **Travel is not mentioned** as a line. See the $185 note above — it is now carried inside the haul rate rather than absorbed silently, which is a change in reasoning, not in what she is told.
- **811 left off both sheets** as a standing scheduling fact — but the stump exclusion on both now says grinding *"cannot be done the same day — utility locates have to be called in first"*, which is the same fact stated where it belongs: attached to work that is excluded, not presented as a delay to work that is included.
- **No Douglas County cost-share, anywhere.** Sixfold is not on the approved contractor list.
- **Nothing claims licensed, insured, bonded or certified.**

---

## What has to be checked before either sheet is handed over

1. **The two-day chip estimate.** Now committed in writing on Option B. See consequence 3 above.
2. **The load count and the road distance.** Six loads and $185 are both defensible; the distance from Monument to the property has still not been measured, and it is the stated reason for the $185.
3. **The crew-hour estimate.** ~1½ days for two people on Option A still comes from the ChatGPT read of the site photos, sanity-checked against the card. **I have not seen the photos or the video** — no visual verification of volume, access, slope or how much of the material is oversized was possible here, and the oversized proportion is exactly what the two-day chip estimate turns on.
4. **Whether the agreement can actually be signed.** [../agreements/](../agreements/) is not attorney-reviewed and has never been used. The cancellation notice carries the Englewood address, which is still the registered principal address at the Secretary of State and is therefore defensible — **the open question is operational: is mail at Hampden still being collected?** A cancellation that arrives somewhere nobody opens is a three-year problem, not a three-day one. And there is still **no general liability and no workers comp** behind clause 12's damage promise.
5. **Whether the documentation help is actually deliverable.** New, and see the block above.

---

## Fact-check log

| Claim on the sheets | Source | Status |
|---|---|---|
| Crew $95/hr; crew with chipper $118/hr; booked day $895; haul $142–$190 per load, disposal included; rounds and slash piling included; site walk and estimate free | [../marketing/pricing-guide.md](../marketing/pricing-guide.md) §4, §5, §8, §9, Sheet A | **Verified against the card.** Every rate on both sheets is a Sheet A figure, each derived from a named Colorado operator's published rate minus 5%. **The quantities changed on 2026-08-28; the rates did not** |
| Estimate free and written; price fixed unless work is added; **half at the start and half on completion above $1,500**; three business days to cancel; everything cut stays yours; nothing expires | Pricing guide §9 | **Verified, and corrected on Option B.** Both jobs are now over $1,500, so both correctly say half and half. Option B said "payment on completion, nothing due up front" at $1,350 and would have been wrong at $2,000 |
| Three business days to cancel, in writing, no fee, not waivable; all payments refunded; work does not start until the period runs | 16 CFR 429.1; C.R.S. 5-3-402 to 5-3-405, both read first-party 2026-08-21 and recorded in [../agreements/README.md](../agreements/README.md) | **Verified.** Both sheets say *"if you sign this at your home"* — the right conditional, since the right attaches to how the sale was made |
| Wildfire mitigation tax credit: 100% of qualifying costs, up to $1,000 for work done in 2026 | C.R.S. 39-22-543, via [../tax-credit-notebook/README.md](../tax-credit-notebook/README.md) | **Verified** |
| *"Secondary treatment of woody fuels — piling, chipping, or removing it from the site"* is one of the four qualifying measures | C.R.S. 39-22-543(2), transcribed in the tax credit notebook and [../content/02-tax-credit-post.md](../content/02-tax-credit-post.md) | **Verified, and it is the statute's own wording.** Both sheets stop at naming the measure and send the qualifying question to her accountant |
| The eligibility questions asked before work starts — owner of record, how the interest is held, whether grant or cost-share money is paying part of the bill | DOR *Income Tax Topics: Wildfire Mitigation Measures*, read in full 2026-08-21; Form A of the client forms | **Verified.** Ownership type and the grant/cost-share exclusion are both real disqualifiers, not sales furniture |
| Claimed on the individual credit schedule filed with the return, receipts attached | DOR guidance (DR 0104CR with the DR 0104, or the Revenue Online E-Filer Attachment) | **Verified.** The sheets deliberately say *"the schedule the credit is claimed on"* rather than printing form numbers a homeowner would have to act on |
| 2026 income limit not yet published | Colorado DOR table says TBD | **Verified as unknown.** Stated as unknown rather than guessed |
| From 1 January 2027 the cap doubles to $2,000 and the credit becomes refundable | HB26-1289 enacted text, §(4)(c), §(5)(b) | **Verified against the statute**, which beats the stale DOR guidance page. Deliberately printed even though it invites her to wait |
| Since 1 July 2026 an insurer using a wildfire risk score must disclose it annually, explain the property features that drove it, publish what each mitigation action is worth, and discount documented mitigation | HB25-1182 / C.R.S. 10-4-124, §(5), §(6)(b)(I)–(V), enacted text read in full and logged in [../content/01-insurance-risk-score-post.md](../content/01-insurance-risk-score-post.md) | **Verified** |
| **New 28 Aug — a re-score can be requested after new mitigation, and the insurer has 30 calendar days** | HB25-1182 §(7)(d) | **Verified against the statute.** It appears in no secondary write-up of the act; the sheets are right to call it the part most people are never told |
| **New 28 Aug — appeal acknowledged in writing within 10 calendar days, decided within 30** | HB25-1182 §(8) | **Verified against the statute**, which specifies **calendar** days. The widely-repeated "10 days / 30 days" from insurance-agency blogs is not the source used |
| **New 28 Aug — the chip pile does not go within five feet of the house; CSFS wants nothing combustible in that strip** | CSFS zone distances (Zone 1 is 0–5 ft) and the IBHS near-building guidance naming **wood mulch as "highly combustible"**, both logged in [../content/03-first-five-feet-post.md](../content/03-first-five-feet-post.md) | **Verified.** Note the zone number: **Colorado's 0–5 ft strip is Zone 1**, not California's "Zone 0". The sheet avoids the number entirely and describes the distance |
| Itemised invoice separating qualifying work, work record, photograph log and accountant's checklist, every job, at no charge | Pricing guide §8; Forms A–D of the tax credit notebook | **Verified as existing deliverables.** Every document the sheets promise exists as a built form |
| Stump grinding needs utility locates first, so it cannot be done the same day | Pricing guide §7; the 811 note in the 27 Aug build | **Verified** |

### The one caveat worth reading twice

**The credit is for wildfire mitigation, and this job is a homeowner clearing a pile.** The measure the statute names fits the *work* precisely; whether the *purpose* test and her own income and land qualify is a different question, and it is not one Sixfold can answer. Both sheets therefore name the measure and then hand the question to her accountant, alongside the standing no-tax-advice line. **Do not let this get shortened in conversation into "you'll get a thousand back."** It is not a certification, Sixfold does not issue one, and the file exists so her accountant can decide.

The 28 Aug expansion makes this caveat matter more, not less: the sheets now describe the paperwork help in five bullets and a full block each, which reads as confidence about the outcome. The wording is careful. **The conversation has to be as careful as the wording.**

### Not claimed, deliberately

Licensed · insured · bonded · certified · Firewise · any county cost-share · any unique or proprietary method · any figure from ChatGPT's estimate · any dollar or percentage value for an insurance discount · any promise that the credit or the discount will be granted.

---

## The ChatGPT estimate, and what was kept from it

The shared link was a **single assistant turn** — the original description and the photos are not in it, so only the model's own reasoning was recoverable. It read the job as *wood cleanup, bucking, loading, hauling* rather than tree removal, on **2 men, 2 saws, trailer, ~1.5 days**, and recommended quoting **$2,750–$3,250**, suggesting $3,000, with stumps excluded.

**Kept:** the scope read, the exclusion of stumps, and the ~1.5-day crew estimate, which is the only number in it that is about this property rather than about the market. It is still the basis of Option A's crew line.

**Not used:** the prices. Its labour line works out to **$100–$133 per crew-hour** against Sixfold's published $95, and its "$1,700–$2,575 direct cost" is a billing figure with a margin already inside it, not a cost. Its $75–$250 per dump trip came from an aggregator. Sixfold's card is built on named first-party Colorado rates and is the better instrument. **Worth noting after the 28 Aug reprice:** Option A at $2,250 is now closer to that model's $2,750 floor than it was, but it did not get there by adopting any of its numbers — every line still traces to the card.
