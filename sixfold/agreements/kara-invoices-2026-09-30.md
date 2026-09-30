# Kara — what the invoices say, and when they go out

**Written 2026-09-30. Nothing has been entered into Square and nothing has been sent.**
Neither agreement is signed yet, so none of these invoices can be raised.

Sixfold's invoices are produced in **Square**. There is no invoice document in this repo to
render — [../operations/invoice-spec.md](../operations/invoice-spec.md) is the spec the Square
template has to satisfy, and this file is that spec applied to Kara's two jobs.

---

## The rule that decides the shape of both

**Both of these are lawn work, so both get a plain invoice** — one total, no qualifying
subtotal, no standards line, and **no mention of the Colorado wildfire-mitigation tax credit**.

That is the landscaping-standalone rule applied to money, from §3 of the spec. A
"non-qualifying" subtotal on a lawn invoice implies there was qualifying work to compare it
against. Mowing, edging, aeration, seed and fertilizer are all on the spec's *does not qualify*
list. Nothing on either of these invoices qualifies, so nothing gets split.

**Do not print the word "deposit"** on either one. §5 of the spec, and it is the hard one.

---

## 1 · Aeration, overseeding and feeding — 12 October 2026

Per `kara-aeration-agreement`, section 5. **One fixed price, split as a payment schedule** —
the payment splits, the work does not.

| | |
|---|---|
| Agreement reference | *Per the service agreement dated \<date signed>, section 5.* |
| Property | 3846 Deboodt Ct, Colorado Springs, CO |
| Total | **$1,100.00** |
| Schedule | 50% first payment / 50% on completion |
| Split | None. Plain invoice |

### Line item — one line, and it is the only one

> **Core aeration, overseeding and feeding — $1,100.00**
> Core aeration of the open turf across the property; overseeding with 200 lb of grass seed;
> applying 150 lb of fertilizer; blowing hard surfaces clear. Seed and fertilizer supplied by
> Sixfold and included. Plugs remain on the surface. One day on site.

**Do not itemise this into seed / fertilizer / labour.** The agreement prices the job as one
fixed sum. Job 2 produced that rule: an invoice built from re-allocated line items bills tasks
as though they were the first payment's scope, when the agreement splits the *payment* only.

### 1a · First-payment invoice — $550.00

- **Issue:** any time after signing.
- **Due: on or before Monday 12 October 2026.** Not the issue date. The due date may not fall
  before the first day on site, and work may not start before the cancellation deadline.
- Carry clause 10's own sentence: *"Every payment is refundable in full, within ten business
  days, if you cancel under section 7 — including a payment made before the cancellation period
  has run."*
- **Never invent line items.** Nothing has been done yet. The line above describes the contract,
  not delivered work.
- In Square use **payment schedule / instalments**, not the deposit feature — check the customer
  preview, because Square's deposit feature labels the line *"Deposit due"*.

### 1b · Final invoice — $550.00

- On completion, with the handover: the written work record and the itemised invoice the
  agreement promises.
- Same line item, same wording. References the first: *"First payment invoiced on SF-2026-NNN."*

---

## 2 · Grounds maintenance — twelve months at $250.00

Per `kara-maintenance-agreement`, sections 5 and 6. **A recurring invoice**, not twelve
hand-raised ones — Square's recurring series, same amount, same day each month.

| | |
|---|---|
| Agreement reference | *Per the grounds maintenance agreement dated \<date signed>, section 5.* |
| Each month | **$250.00** |
| Number of months | 12 |
| Total over the term | **$3,000.00** |
| Due | The day of the month set at section 6 |
| Split | None. Plain invoice |

### Line item

> **Monthly grounds maintenance — $250.00**
> Mowing and edging on the third Thursday of each month; spot treatment of thin and bare areas
> every other month; core aeration twice a year; snow clearing up to five visits in any calendar
> month. Per the agreement, section 2.

**The monthly amount does not move with the number of visits.** A month with four snow visits
and a month with none are both $250.00. Do not raise a credit for a light month or a surcharge
for a heavy one — clause 17 says the price is set for the year rather than per visit.

### Two things that have to be right before the series is set up

1. **The first invoice's due date must fall on or after the cancellation deadline.** Section 6
   sets the first month to begin on or after it, and the recurring series takes its dates from
   that. Set the series start after the deadline, not after signing.
2. **The series must stop at twelve.** The agreement does not auto-renew and no payment is taken
   after the twelfth month. A Square recurring series with no end date would keep billing her
   into a thirteenth month the agreement does not cover, and that is a charge with no contract
   behind it. **Set the end explicitly; do not rely on remembering.**

If it ends early under clause 16, any month paid for in advance and not begun is refunded within
ten business days — cancel the remaining series, do not just stop collecting.

---

## ⚑ 3 · The aeration billing is undecided, and it changes this page

`kara-maintenance-agreement` section 2 carries a **tick box**: the two aeration visits are
either included in the $250.00 or invoiced separately at a per-visit price.

**That box is not marked, because the answer is not known.** Matthew was getting it on
2026-09-30.

| If the box is | The invoices are |
|---|---|
| **Included** | Exactly as section 2 above. Twelve invoices of $250.00, nothing else |
| **Separate** | Twelve of $250.00 **plus two more**, one per aeration visit, at the per-visit price written into the agreement. Each is a plain invoice, same shape as §1 above, referencing the maintenance agreement rather than the one-off |

**The per-visit price has to be in the signed agreement before it can be invoiced.** §7 of the
spec: every figure on an invoice must appear in a document the customer already holds. A price
agreed verbally and typed into Square is exactly the provenance failure that rule exists to stop.

---

## Numbering

Not decided. The spec proposes `SF-YYYY-NNN`, sequential, never reset, never reused, **one number
per invoice rather than per job** — so the aeration job takes two numbers and the maintenance
series takes twelve. If Square is left to auto-number, use Square's numbering and do not run a
second scheme beside it.

Matthew's call, and it is still open.

---

## Fact check

| Claim | Status |
|---|---|
| Lawn work gets a plain invoice with no qualifying split or standards line | **Verified** against `operations/invoice-spec.md` §3, which lists mowing, edging, beds, planting and general landscaping as not qualifying |
| "First payment", never "deposit" | **Verified** — spec §5 |
| Line items come from the agreement, not re-allocated | **Verified** — spec §2, and the job-2 precedent recorded there |
| A first-payment invoice's due date is not its issue date | **Verified** — spec §4a |
| $1,100.00, split $550 / $550 | **From the signed-shape agreement**, `kara-aeration-agreement` section 5 |
| $250.00 × 12 = $3,000.00 | **From** `kara-maintenance-agreement` section 5. Arithmetic checked |
| Square supports a recurring series with an explicit end | **Not verified first-party.** I have not opened Square and no account has been touched. Confirm in the product before relying on the end date holding |
| The per-visit aeration price | **Not known.** The tick box is blank by design |
| Whether Sixfold's cost is covered at either price | **Still open** — see `kara-2026-09-25.notes.md`, which carries the margin arithmetic. No material or machine cost is known for aeration |
