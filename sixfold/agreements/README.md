# Sixfold service agreement — the pack, and what still needs a lawyer

**Built:** 2026-08-21
**Status:** Draft. **Not printed, not used, and not reviewed by an attorney.**

Two documents:

| File | Pages | Who sees it |
|---|---|---|
| [service-agreement.html](service-agreement.html) | **5** | The customer. Print the whole pack — pages 4 and 5 are legally part of it |
| [service-agreement-tablet.html](service-agreement-tablet.html) | **3** | **The fillable version.** Pages 1–3 only, typed on a tablet, prints to the identical document. Pages 4 and 5 stay paper — see below |
| [field-instructions.html](field-instructions.html) | **2** | **Internal.** Sheet 1, signing at the door. Sheet 2, starting the same day and the emergency exception. Kept a separate file on purpose so it cannot be handed over by accident |

Built from the same print register as the tax credit notebook. `node build.mjs` inlines `_style.css` into each `.src.html`. Both verified to print at exactly the page counts above — checked by printing to PDF and counting, not by eye.

**Price is blank by design**, as asked: three boxed fields on page 1 for total, deposit and balance.

---

## Read this before it is used

**I am not a lawyer and this has not been reviewed by one.** It is a careful draft built from the primary sources below, and it is considerably better than a generic template off the internet — but a service agreement decides what happens when a tree lands on a roof, and that is worth an hour of an attorney's time before the first one is signed. The specific things to put in front of them are listed at the bottom.

---

## The part that drove the whole design

Sixfold's channel is door-to-door. That makes almost every signing a regulated transaction under **two** overlapping regimes, and the penalties for getting the paperwork wrong are wildly out of proportion to the effort of getting it right.

**Verified — 16 CFR Part 429** (FTC rule on cooling-off for sales made at homes), read in full from eCFR on 2026-08-21:

- Applies to a personally solicited sale of consumer goods or services agreed **at the buyer's residence** with a purchase price of **$25 or more**. Fire mitigation sold at a door is squarely inside it.
- The seller must furnish a **fully completed copy of the contract** at the time of signing, showing the date of the transaction and the seller's name and address.
- **In immediate proximity to the buyer's signature**, in **bold face type of a minimum size of ten points**, the contract must carry the statutory sentence about the three-day right. → *page 3, in the boxed statement directly above the signature block.*
- The buyer must receive a completed **"Notice of Cancellation" in duplicate**, in ten point bold face, in the statutory wording. → *pages 4 and 5.*
- The seller must **complete both copies before handing them over** — seller name, seller address, date of the transaction, and the deadline date, which must be no earlier than the third business day after.
- The seller must **tell the buyer orally** about the right to cancel at the time of signing.
- **No confession of judgment and no waiver** of the cancellation right may appear in the contract. Asking for one is itself a violation.
- On cancellation, **all payments refunded within 10 business days**.
- **Business day** = any day except Sunday and federal holidays. Saturday counts.

**Verified — C.R.S. 5-3-401 to 5-3-405** (home solicitation sales), read from the Colorado Revised Statutes Title 5 official PDF, 2026-08-21:

- **5-3-402:** cancel until midnight of the third business day after signing.
- **5-3-403(3):** *until the seller has complied with the notice requirements, the buyer may cancel at any time* — and that right **expires three years after the transaction**, not three days. **A blank date on a cancellation form leaves the job voidable until 2029.**
- **5-3-404:** refund within ten days; a clause letting the seller keep any part of a payment is **unenforceable**.
- **5-3-405(3):** *"If a home solicitation sale is canceled, the seller is not entitled to compensation for any services the seller performed pursuant to it."*

That last one is the reason the pack is built around **not starting work until the cancellation period ends**. Start early, and a cancellation means the work was free and the deposit still goes back. There is no way to contract around it — the emergency exception in 5-3-402(5) needs a genuine emergency and a statement in the customer's own handwriting, and it is not something to reach for at a door.

Note the Colorado provisions are framed around a *consumer credit sale*, so on a straight pay-on-completion job the **federal rule is the one doing the work**. Both are built in, so the pack does not depend on which applies.

---

## The tablet version

[service-agreement-tablet.html](service-agreement-tablet.html) — open it in any browser on a tablet, fill it in, hit **Print / save PDF**. No install, no account, no internet.

**Pages 1 to 3 only, and that is deliberate.** The two Notice of Cancellation copies stay pre-printed paper the rep completes by hand. Delivering them electronically drags the whole signing into the ESIGN consumer-consent process — 15 U.S.C. 7001(c) requires affirmative consent, a statement of the right to a paper copy, a hardware and software statement, and consent given in a way that reasonably demonstrates the customer can open the format. The ESIGN exception list at 15 U.S.C. 7003 does **not** cover this notice, so the general rule applies and that consent ritual is real. Get it wrong at a doorstep and the notice is arguably defective, which reopens the three-year window. **The notices are static apart from two dates, so paper costs almost nothing and removes the question entirely.**

What it does beyond typing:

- **Calculates the cancellation deadline** — third business day, skipping Sundays and federal holidays — and shows its working so the rep can check it. That single date is the defect that opens the three-year window, and it is what a tired rep gets wrong at the sixth door. Juneteenth is included even though the 1972 rule text does not name it, because the definition says *any* federal holiday. Where a fixed-date holiday falls at a weekend, both the actual and the observed date are excluded — that can only push the deadline later, which is the safe direction.
- **Signature capture** for both parties, finger or stylus.
- **Balance** computed from total minus deposit.
- **Survives a refresh.** Everything is saved to the device as you type, so a dropped tablet at someone's front door does not lose the agreement. Local to that device only — nothing leaves it.
- **Flags empty required fields** before printing rather than after.

### What it is not

It is a **form filler, not an e-signature platform.** There is no audit trail, no tamper-evident record, no certificate of completion, no proof of when the customer signed. For a contract that can be unwound for three years, that record is the thing worth buying — so if Brandon wants a genuine e-signature workflow, the answer is a service like DocuSign or Dropbox Sign, which exist to run the ESIGN consent disclosure properly and produce that certificate. This file is the no-subscription option that makes the paperwork legible and gets the date arithmetic right.

**Both versions print the same document.** The paper version is 5 pages, the tablet version is 3 plus the paper notices. Verified by printing to PDF and counting.

---

## Three options that were asked for, and why none of them work

Raised 2026-08-21: could the cancellation right be replaced with a percentage refund based on job progress, dropped entirely, or made non-refundable once work begins? All three fail, and each one is worse than the thing it replaces.

| Proposal | What it actually produces |
|---|---|
| **Percentage refund by progress** | C.R.S. 5-3-404 — a provision letting the seller keep any part of a payment is **"in violation of this section and unenforceable."** 5-3-405(3) separately bars compensation for services performed. The clause collects nothing and adds a violation |
| **No cancellation process** | The right exists because of *how the sale was made*, not because the contract grants it. Omitting the notice does not remove it — C.R.S. 5-3-403(3) extends it to **three years**, and the omission is itself the FTC violation |
| **Non-refundable once begun** | 16 CFR 429.1(g) requires all payments refunded within 10 business days. Same unenforceability under 5-3-404 |

**The reframe that actually answers the business need:** nothing in either regime prohibits *starting work* the same day. It only controls what happens to the money if they cancel. So same-day start is a risk decision, not a permission problem — which is what sheet 2 of the field instructions is for.

**The only exemptions in 16 CFR 429.3** are motor vehicles sold at auctions or tent sales by a seller with a permanent place of business, and arts or crafts sold at fairs. Checked; neither is a route.

---

## About the telegram line

Both Notice of Cancellation forms say the buyer may "send a telegram." That is not a typo and it is not filler — it is the **verbatim statutory form** in 16 CFR 429.1(b), written in 1972 and last touched in 1995. Western Union ended US telegram service in 2006, so nobody will use it.

**It stays.** The rule requires the notice contain "the following information and statements," and Colorado punishes a defective notice with the three-year window. Trimming a line to look modern is not worth arguing about whether the form still complies. The substance is unaffected anyway: C.R.S. 5-3-402(4) says a cancellation "need not take a particular form and is sufficient if it indicates by any form of written expression" the buyer's intention — so an email or a text works, the telegram line simply sits there being obsolete.

Worth one question to the attorney, since 429.1(b) says the form shall "(where applicable)" contain the statements — but the conservative reading is to reproduce it as written.

---

## What is in the agreement

**Page 1 — the job.** Parties, property, service checkboxes matched to what the tools actually do, what is excluded, what happens to the material, and the three blank price boxes.

**Page 2 — dates and terms 1–8.** Cancellation deadline, start and completion estimates, then: what Sixfold hands over every job; that Sixfold gives no tax or insurance advice; that the work does not make a property fireproof; authority to authorise; boundaries and buried lines; clearing the way; HOA and permits; access and ground conditions.

**Page 3 — terms 9–14 and signatures.** Discovered conditions, written change orders, payment, damage, Colorado law, entire agreement. Then the right-to-cancel section, the statutory bold statement, and the signature blocks.

**Pages 4 and 5 — Notice of Cancellation, in duplicate.** The statutory wording, verbatim. **Do not paraphrase, shorten, or reset these smaller** — the ten-point bold floor is a legal requirement and `.legal10` in the stylesheet exists to hold it.

Three deliberate alignments with the rest of the project: clause 1 promises exactly the documentation set that Form B of the [tax credit notebook](../tax-credit-notebook/) produces; clause 2 repeats the no-tax-advice line in the customer's own copy; and the field sheet repeats the standing prohibitions on "licensed and insured" and on naming a county cost-share.

---

## Fill these in before anything is printed

- ~~**The ZIP code.**~~ **Done 2026-08-21 — 80110**, now printed on page 1, both cancellation forms and the page footers. Source is the **Colorado Secretary of State entity record for Sixfold, LLC** (ID 20258292716), principal address *333 W Hampden Ave Ste 300, Englewood, CO 80110*, as transcribed in [../research/name-clearance-screen.md](../research/name-clearance-screen.md). That is the LLC's own registered address, which is the right one for a notice — this is where a cancellation gets mailed, and an incomplete address is exactly the defect that opens the three-year window.
- ~~**The damage-notice window in clause 12.**~~ **Set to 14 days**, 2026-08-21. Seven is too short to be fair — a homeowner with acreage may not walk the whole property in a week, and a tight reporting window on a consumer contract reads as the drafter protecting itself and tends to be construed against them. Fourteen still does the job it exists for: the crew's memory is fresh, and damage from a later storm does not get attributed to the job. Note the clause is framed as *"tell us within 14 days so we can look at it"* — a reporting request, **not** a forfeiture of the claim. Keep it that way.
- ~~**The entity name.**~~ **Resolved 2026-08-21 — it is "Sixfold, LLC", with a comma.** Confirmed from the Colorado Secretary of State record itself (entity 20258292716), not from the transcription, which also independently confirmed the address as *333 W Hampden Ave Ste 300, Englewood, CO 80110, US*. The agreement and both cancellation forms now name the party exactly as registered, because that is the entity with capacity to contract. **The brand name stays "Sixfold" everywhere else** — this change belongs on legal instruments, not on banners or bios.
- **Agreement number** on page 1, if you want them sequenced. Still open, and cosmetic.

---

## What to put in front of an attorney

1. **The insurance gap, first.** Sixfold holds no general liability and no workers comp. Clause 12 promises Sixfold is responsible for damage its crew causes by negligence — which is the right thing to promise and the honest thing to sign, but there is **no policy behind it**. Felling trees near structures with an uninsured promise of responsibility is a business exposure, not a drafting problem, and no wording fixes it. It is the single largest risk in this document and it belongs at the top of the conversation.
2. **Whether a limitation of liability or damage cap should be added**, and whether it would survive as a consumer contract in Colorado.
3. **Deposits.** Whether to take one at all before the cancellation period runs, given it must be refunded in full.
4. **Clause 13 venue** — currently the county where the property is, which is consumer-fair but may not be what Sixfold wants.
5. **Whether any local licensing or permit rule applies** to tree removal in the specific jurisdictions being canvassed. Not researched — county and municipal rules vary and none were checked.
6. **The Colorado 811 statement in clause 5.** The practice described is right; whether the statutory duty sits where the clause implies was not verified against the excavation statute. The **two business days' notice** figure on field sheet 2 *was* verified — C.R.S. 9-1.5-103(3)(b), notice at least two business days before excavation begins, not counting the day of notice, except in emergencies.
7. **Whether the telegram line can be dropped** from the cancellation forms — see above.
8. **The 30-second identification rule.** C.R.S. 6-1-105(1)(p) makes it a deceptive trade practice to solicit door-to-door unless the rep identifies himself, whom he represents, and the purpose of the call within thirty seconds. Now on field sheet 1. Worth confirming there is no equivalent local ordinance stacked on top in the jurisdictions being canvassed.

---

## Not checked, and worth knowing

- **Local and municipal rules.** Some Front Range jurisdictions require a solicitor's permit for door-to-door work, and the platform sheet already flags confirming solicitation permits before canvassing. Nothing here covers that.
- **C.R.S. Article 6-22 (residential roofing) does not apply** — it governs roofing contracts, and this is vegetation work. Mentioned only because it is the Colorado contractor statute most likely to be reached for by mistake.
- **Nothing in this pack has been used, printed or reviewed.** No customer has seen it.

---

## Phone-number sweep — 2026-09-14

Sixfold's number changed to **(303) 915-1045** on 2026-09-08. Swept project-wide on
the 14th on Matthew's instruction. In this folder the sources, the generated HTML
and these PDFs were all rebuilt and verified at their original page counts
(service agreement 5, field instructions 2, tablet 3, Sedalia 5):

- `service-agreement`, `field-instructions`, `service-agreement-tablet` and
  `sedalia-A-service-agreement` — **done**, `.src.html` → `.html` → `.pdf`. PDF jobs
  for all four were added to `../tools/html-to-pdf.mjs`, which previously had none,
  which is why these had gone stale in the first place.

**Two files were deliberately NOT rebuilt, and both still carry the old number:**

| File | Why it was left | What it would take |
|---|---|---|
| `sedalia-A-service-agreement-fillable.pdf` | Carries **30 AcroForm fields**. Printing it from the HTML flattens every one of them, and there is no generator for it in this repo. Losing a working form filler to correct a phone number is a bad trade. | Rebuild it as a generated AcroForm, the way `../operations/build-walk-form-pdf.mjs` does — roughly an afternoon, and it would make the file reproducible for the first time. |
| `sedalia-A-service-agreement-DocuSign.pdf` | Flat (no fields), but no generator either, and it is a **differently-rendered export** of the same agreement — the text is identical in substance but flows differently, so it did not come from this toolchain. Guessing at how to reproduce it risks shipping a contract that differs from the one it replaces. | Confirm how it was produced. If it is just an export of the same source, it is redundant with `sedalia-A-service-agreement.pdf` and should be deleted rather than maintained. |

**Neither is urgent** — the whole Sedalia pack is a draft, not printed, not used, not
signed and not attorney-reviewed. But do not send either file as it stands.

**Unrelated, noticed in passing:** the agreement now prints a street address —
*17890 Sierra Way, Monument, Colorado 80132*. The top-level README still says the
street address is not on file and that the agreements are blocked until it exists.
One of the two is out of date. Worth reconciling before the pack goes anywhere,
because the cancellation notice depends on that address being right.

---

## Review, and the landscaping twin — 2026-09-18

Matthew asked for three things: check the service agreement is standard and meets the
requirements, make it work for any job without being re-read each time, and produce a
landscaping version with the fire and tax-credit content stripped out.

**Still not attorney-reviewed.** Everything at the top of this file about that still
stands, and the attorney list is unchanged. What follows is a check against the statutory
requirements this pack was built from — not legal advice, and not a substitute for item 1
on that list.

### What was checked and held

| Requirement | Where | Result |
|---|---|---|
| Statutory statement in bold, **min 10 point**, in immediate proximity to the signature | page 3, `.legal10` | **10.5pt bold.** Passes with 0.5pt to spare |
| Notice of Cancellation **in duplicate**, ten point bold, statutory wording | pages 4 and 5, `.noticeform p` | **10.5pt bold**, both copies, wording verbatim |
| No waiver of the cancellation right, no confession of judgment | whole document | **Zero occurrences.** Neither concept appears |
| "Business day" defined as the statute defines it | section 7 | *"any day except Sunday and federal holidays"* — correct, Saturday counts |
| Refund of everything, deposit included, on cancellation | section 5 and clause 11 | Present in both, and in the statutory text |
| Seller's name and address on the instrument and on both notices | page 1, pages 4–5, footers | **17890 Sierra Way, Monument, CO 80132** throughout since 2026-09-18 |
| Date-of-transaction designated as the signing date | page 1 standfirst | Present, with the reason in a source comment |

### ⚑ The one thing that was actually wrong

**Section 3 excluded landscaping** — *"this does not cover … landscaping, replanting or
reseeding"* — while landscaping has been a settled Sixfold service line since 2026-09-16,
and the company's own copy says it is **usually the same visit** as the clearing, not a
second one. On a combined job the agreement contradicted the work, which meant editing the
form at the door. That is the opposite of sign-and-go.

Fixed two ways: section 2 gained a **Landscaping / restoration** tick box, and section 3
now reads *"Unless **ticked in section 2** or written below"*. A fire job with a tidy-up at
the end is now one document with two boxes ticked.

### A trap that is not live but is one edit away

`.legal10` and `.noticeform p` are set at **10.5pt** against a **10pt** legal floor.
`html-to-pdf.mjs` defaults every job to **scale 0.8**, and 10.5 × 0.8 = **8.4pt**, which
would be a defective notice — the three-day clock never starts and the job stays cancellable
for three years.

Measured 2026-09-18: the widest ruled box renders **7.400 in on paper**, exactly the CSS
content width, so `preferCSSPageSize` with the explicit `@page` is winning and **nothing is
being scaled today**. Both agreements are nonetheless pinned to `scale: 1` in the JOBS table
with that reasoning written beside them. **Do not remove the pin, and do not drop these two
documents to a smaller type size to win space.**

### The landscaping agreement

`landscaping-agreement.src.html` → `.html` → `.pdf`. **Five pages, same as the fire
version.** Built from the same source so the parts that must not drift cannot: **pages 4
and 5 are byte-identical** between the two documents, and page 3 differs only in its header
label.

What differs, and only this:

| | Fire mitigation agreement | Landscaping agreement |
|---|---|---|
| **§2 the work** | Felling · stump grinding · slash and chipping · rounds · defensible space · fuel break · landscaping | Mowing · edging · beds · planting · sod or seed · shrub and hedge · brush · clean-up |
| **§3 excluded** | structural, irrigation repair, non-woody debris… | …plus **felling, stump grinding and fire-mitigation work**, pointed at the other agreement |
| **§4 material** | chipped / piled / rounds / hauled | **green waste** — hauled / piled / owner's bin / mulched on site |
| **Clause 1** | invoice separates *qualifying wildfire mitigation work* | plain itemised invoice |
| **Clause 2** | no tax or insurance advice, credit is the accountant's call | **"This is not wildfire mitigation work"** — states plainly that it does not qualify for the credit and is not defensible space |
| **Clause 3** | does not make a property fireproof | **plants, sod and seed** — no survival warranty, watering is the owner's, dead-on-arrival put right |
| **Clause 5** | 811 before stump grinding or ground disturbance | 811 before **digging, planting** or ground disturbance |
| **Clause 7** | HOA rules on removing trees | HOA rules on planting lists, turf, xeriscape, water restrictions |
| **Clause 9** | hidden rot, hazard lean, stump on a boulder | buried rubble, unmarked irrigation, ground too hard to plant |
| **§6 dates** | fire restrictions move them | watering restrictions move them |

**Clause 2 is the one worth reading before you send it.** A landscaping customer who has
heard about the tax credit will assume it applies. It does not, and the agreement says so
in the customer's own copy rather than leaving it to a conversation at the door.

**Clause 3 is new ground, not a rewrite.** The fire version's "does not make a property
fireproof" has no landscaping equivalent; what a landscaping customer actually wants to know
is whether the plants are guaranteed. The answer given is no — survival depends on watering
— with the honest carve-out that anything dead on arrival or plainly planted wrong gets put
right. **This is the clause most likely to need an attorney's eye**, because it is the only
one written from scratch rather than adapted.

### Still open, unchanged

Everything in *What to put in front of an attorney* above applies to **both** documents.
The insurance gap is still item 1 and still unsolved: clause 12 promises Sixfold is
responsible for negligent damage by its crew, and there is no policy behind that promise on
either agreement.
