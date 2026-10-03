# Tax credit notebook — source, reasoning, and fact-check log

**Built:** 2026-08-21
**Status:** Draft. Nothing published to a platform, nothing printed, nothing distributed.
**Audience:** the reference section is internal (Brandon, crew). The four client forms are customer-facing.

Two printable documents, designed to be run off and put in a ring binder. The designed HTML is the deliverable; this file holds the reasoning, the things deliberately left out, and the provenance for every figure.

---

## The files

| File | What it is |
|---|---|
| [reference-notebook.html](reference-notebook.html) | **7 Letter sheets, internal.** Cover and contents · who qualifies · what work counts and what it costs · the money by tax year · how a homeowner claims it · crew briefing on what may and may not be said · sources and open questions. |
| [client-forms.html](client-forms.html) | **4 Letter sheets, customer-facing.** Form A landowner eligibility record · Form B work record and cost breakdown · Form C homeowner's claim file checklist · Form D photograph log. One set per job. |
| `_style.css` | The shared print register. **Single source of truth for both documents.** |
| `*.src.html` | The page content, with a `<!--STYLE-->` marker where the CSS is spliced in. **Edit these, not the generated `.html`.** |
| `build.mjs` | `node build.mjs` inlines `_style.css` into each `.src.html` and writes the standalone `.html`. |

Print with **Letter, portrait, margins set by the document, background graphics ON** — the tinted blocks and the ember rules carry the structure and a printer set to "no backgrounds" will drop them.

---

## Why it is two documents rather than one

The reference sheets get printed once and live in the binder. The client forms get printed repeatedly, one set per job. Putting them in one file would mean re-printing seven pages to get four, so they are separated at the file level rather than at the page level.

Both are verified to fit **exactly** one printed page per sheet — 7 pages and 4 pages, checked by printing to PDF and counting, not by eye. See "The pagination trap" below.

---

## What the client actually fills in, and what Sixfold cannot do

There is no state form that Sixfold hands a customer. The homeowner claims the credit themselves on **DR 0104CR**, filed with their **DR 0104**, with copies of receipts attached or uploaded through Revenue Online. Sixfold's role is documentation and nothing else.

So the four forms are Sixfold's own, not the state's, and each says so on its face:

- **Form A** captures the facts that decide eligibility *before* work starts — owner of record, ownership type, which single person in an ownership group is claiming, and whether grant or cost-share money is covering part of the bill. That last question is the one that most often changes the answer, and it is much cheaper to ask at the walk than to discover at invoicing.
- **Form B** is the invoice companion: qualifying measures itemised by category code, non-mitigation work totalled separately, and a statement of the standard the crew worked to. **It is explicitly not a certification** — Sixfold does not issue one, and inspection or certification fees would not qualify for the credit anyway.
- **Form C** is the homeowner's own file checklist, written to be handed to whoever prepares their return.
- **Form D** is the photograph log, which serves the insurance channel rather than the tax one.

**The banned phrase, stated on two sheets: "we handle the paperwork for you."** Sixfold supplies documentation. It does not prepare or file returns, and saying it loosely reads as tax preparation.

---

## What is deliberately absent

- **The Douglas County cost-share.** *(Superseded 2026-10-02: the county list is preferred, not required — residents may use any qualified contractor. See the refresh in `../research/mitigation-funding-directory.md`. Sheets 3, 6 and 7 were updated to v1.1, the PDF rebuilt (still 7 pages) and the artifact republished the same day.)* Was: standing prohibition until Sixfold is on the county's approved contractor list. The programme needs two bids from that list, so naming it now sends a homeowner after money we cannot help them claim.
- **Any form of "licensed, insured, certified, Firewise."** None of it is true yet.
- **Prices, or any job cost range.** Not until Sixfold has priced its own completed work.
- **A percentage figure for the insurance discount.** HB25-1182 requires a discount; it does not set a rate. Any number would be invention.
- **A 2026 income limit.** Genuinely unpublished — the Department of Revenue table says TBD. The sheets say so rather than guessing.
- **The one-acre $3,200–$6,100 benchmark**, and the RMIIA premium figures. Both real, both excluded for the reasons already recorded in `../marketing/funding-one-pager.md`.

---

## Fact-check log

**Verified — Colorado Department of Revenue, *Income Tax Topics: Wildfire Mitigation Measures*, read in full 2026-08-21** (the page 403s to a plain fetch; retrieved with a browser user agent):

- Qualifying taxpayer is **a landowner who is an owner of record of private land in Colorado**. Interest may be fee, easement, right-of-way, or a **lease, provided evidence of the lease is properly recorded**. Held solely, jointly or in common.
- **Tenants in common and joint tenants: the credit is allowed to only one individual of the ownership group.** Two filing jointly share one cap; where two who could file jointly file separately, only one may claim.
- **Publicly owned land never qualifies**, regardless of any easement, right-of-way or lease held on it. Work on a neighbour's land does not qualify unless the taxpayer holds a qualifying interest in it.
- **The four qualifying measures**, which must meet or exceed Colorado State Forest Service or Division of Fire Prevention and Control standards: creation of defensible space around structures; establishment of fuel breaks; thinning of woody vegetation for the primary purpose of reducing risk to structures from wildland fire; secondary treatment of woody fuels by lopping and scattering, piling, chipping, removing from the site, or prescribed burning.
- **Non-qualifying:** the purchase price of any property; equipment purchase or rental for the landowner's own use; inspection or certification fees; in-kind contributions and donations in either direction; cost-sharing arrangements between landowners; and **any cost paid from, or reimbursed by, a grant or incentive**.
- **Credit table:** 2023 — $120,000 FTI limit, 25%, $625 · 2024 — $126,300, 25%, $625 · 2025 — $129,200, 100%, $1,000 · 2026 — TBD, 100%, $1,000 · 2027 — TBD, 100%, $1,000. Excess over tax liability is **neither refunded nor carried forward**.
- **Claimed on the Individual Credit Schedule (DR 0104CR) with the DR 0104**, plus copies of receipts, attached to the return or via the **E-Filer Attachment** function in Revenue Online.
- **The retired subtraction:** 100% for 2017–2019, **50% for 2020–2024**, capped at $2,500 or federal taxable income, whichever is less; **wildland-urban interface property only**; claimed on **DR 0104AD**. For 2023 and 2024 a qualifying landowner could claim both it and the credit.

**Verified — Colorado Department of Revenue, *Wildfire Tax Benefits*, 2026-08-21:** confirms both claiming routes and repeats the receipt requirement. (This page also carries the unrelated HB23-1240 sales and use tax refund for rebuilding after a declared wildfire disaster 2020–2022 — **not** relevant to mitigation work and deliberately not in the notebook.)

**Verified — enacted statute, carried forward from [../content/02-tax-credit-post.md](../content/02-tax-credit-post.md)** (HB26-1289 Final Act, amending C.R.S. 39-22-543, read in full 2026-08-19):

- Tax years 2027–2030: credit up to **$2,000**, landowner **AGI at or below $300,000**, inflation-adjusted thereafter — §(4)(c).
- Excess **neither refunded nor carried forward before 1 Jan 2027**; **not carried forward but refunded on or after** — §(5)(a), §(5)(b).
- New defined term **"infestation mitigation measures"** — thinning of woody vegetation at risk of or killed by mountain pine beetle or spruce beetle — §(2)(a.5).
- Statutory repeal moved from 1 Jan 2030 to **1 Jan 2040** — §(6). Credit amounts are specified only through tax year 2030.

**Verified — Colorado General Assembly 2026 tax expenditure evaluation (2026-TE4):** ~450 claims in tax year 2023; about $200,000 reimbursed to 457 landowners; survey of 360 responses, fewer than 50% aware of the credit beforehand, over 70% saying landowners are generally unaware. Since August 2024 (HB24-1036) only costs paid to a third-party service provider qualify.

**Verified — Colorado HB25-1182, effective 1 July 2026:** annual written risk-score disclosure, disclosure of available discounts, parcel-level mitigation counted in scoring and pricing, a discount for documented mitigation even absent a formal model, and a right of appeal.

### Corrected while building this

1. **"Thinning woody vegetation was added as qualifying work in 2027."** Wrong, and it overstates the change in Sixfold's favour — thinning has qualified under §(2)(d) since well before. Still present in **[../research/fire-mitigation-market-research.md](../research/fire-mitigation-market-research.md)**, **[../marketing/marketing-plan.md](../marketing/marketing-plan.md)** and **[../marketing/funding-one-pager.md](../marketing/funding-one-pager.md)**. **✅ Fixed 2026-10-02** in all three `.md` files; the marketing-plan HTML, PDF and artifact were rebuilt and republished the same day. (The one-pager HTML had already been corrected 2026-09-18.)
2. **Non-refundability through tax year 2026** is missing from the market research file and the marketing plan entirely. It is the single most likely thing to disappoint a customer, and it is now on two sheets of this notebook and on Form C.
3. **The DOR guidance page is stale for 2027** — still $1,000 with a TBD limit, where the statute says $2,000 at $300,000 AGI and refundable. Notebook sheet 4 states which source wins and why.
4. **The HB26-1289 fiscal note's five-year carry-forward** describes a version of the bill that did not survive. Enacted text wins.

### New in this notebook, not previously recorded anywhere in the project

- The **one-claimant rules** for tenants in common, joint tenants and separate filers.
- The **recorded-lease requirement**, and that lessor and lessee are both landowners for this purpose.
- **The credit has no wildland-urban-interface test.** The retired subtraction did; the credit says only "real property located in Colorado." Worth knowing before telling anyone they are outside the zone.
- The **DR 0104AD / DR 0104CR distinction**, which is easy to confuse and points at two different programmes.

### Unresolved

- **The 2026 federal taxable income limit.** Not published.
- **Whether "adjusted gross income" in §(4)(c) means federal AGI.** The statute says AGI where the earlier subsection says federal taxable income — a different number for some filers. Worth an accountant's read before any of this goes to print in volume.
- **Whether entity-owned land still qualifies from tax year 2026.** DOR guidance describes a narrow pass-through route requiring a dwelling designated for residential occupancy; the 2026 evaluation indicates eligibility narrows to individual taxpayers. **Genuine conflict — the notebook advises neither way and sends it to an accountant.**
- **Douglas County's approved contractor list.** Requirements unknown; the county site refuses automated requests; reported windows conflict. Still needs the phone call.

---

## The pagination trap, for whoever edits this next

Both documents are built as a sequence of `.sheet` divs, one per printed page. **A sheet that overruns silently becomes two pages**, and you cannot see it in the browser, because the on-screen sheet has `min-height: 11in` and the footer's `margin-top: auto` absorbs the slack — so a sheet that is 40px too tall looks identical to one that fits.

Two things caught this during the build, both worth repeating:

1. **The measurement has to run with the print rules active and the print geometry forced** — 7.4in content width, no padding, no min-height. Measuring the on-screen box measures the box, not the content.
2. **`@media (max-width: 8.9in)` was matching during print** and silently rendering the whole thing at 10pt instead of 9.5pt. That alone doubled the page count. It is now scoped to `@media screen and (...)`. **Never leave a bare `max-width` media query in a print stylesheet** — the printed page is narrow and will match it.

The check that actually settles it: print to PDF and count the pages. It should be **7** and **4**.
