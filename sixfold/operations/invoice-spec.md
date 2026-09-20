# Invoice template spec

**Built 2026-09-20.** The third output of the quote pipeline — quote → job plan → **invoice** —
and the last cheap item on the build order.

**This is a spec, not an invoice.** Sixfold's invoices are produced in **Square**, so what follows
is what the Square template has to be set up to say, plus the rules for filling it in on a job.
The worked examples in [invoice-example.html](invoice-example.html) exist so the Square preview can
be held beside something and compared line for line.

**Nothing here has been entered into Square.** No account has been touched — same standing rule as
every other Sixfold surface.

---

## ⚑ The one thing this document exists for

**The invoice is the document the customer claims the tax credit with.** Not the quote, not the
agreement, not the work record — the invoice. The referral packet says so in the customer's own
copy, twice, and so does `/who-pays/` on the site:

> *"A credit on your Colorado state income tax return for what you paid a contractor… claimed with
> your return, using the invoice in this folder."*
> *"Your invoice separates this work from anything that does not qualify."*

So an invoice that does not separate qualifying work is not merely untidy. **It is the one piece of
paper Sixfold promised and did not deliver**, and the customer finds out at tax time, months after
the crew has gone.

Everything below follows from that.

---

## 1 · What has to be on every invoice

| Block | Content | Why it is fixed |
|---|---|---|
| **Header** | Ridge mark + `Sixfold, LLC` | `brand/square/sixfold-square-invoice-full-1280x648.png` is already built for the full layout; `-logo-framed-400.png` for the framed one |
| **Issuer** | Sixfold, LLC · 17890 Sierra Way, Monument, CO 80132 · (303) 915-1045 · Contact@SixfoldColorado.com | The 2026-09-18 sweep. **Not Englewood** — the SoS register still shows it, the paperwork does not |
| **Invoice number** | See §6 | Must be unique and must not restart |
| **Dates** | Issue date, and a due date per §4 | A first-payment invoice's due date is **not** the issue date |
| **Property** | The service address, where it differs from the billing address | The credit is for work *on land you own*; the address is what ties the invoice to the parcel |
| **Agreement reference** | *"Per the service agreement dated \<date>, section 5."* | Ties the figure to a signed document rather than to an estimate |
| **Line items** | §2, traced line-for-line to the customer's quote | |
| **Qualifying subtotal** | §3 — **fire-mitigation jobs only** | |
| **Standard line** | §3 | The packet tells the customer to keep this line |
| **Payment terms** | §4 | |
| **Payment methods** | Electronic transfer, cash, or check payable to **Sixfold, LLC** | Agreement clause 10 — do not add a method the agreement does not list |
| **Disclaimer** | *"Sixfold does not prepare or file tax returns. Not tax or insurance advice — confirm your own position with your accountant and your carrier."* | Standing disclaimer on every Sixfold funding surface |

### What must NOT appear

- **The word "deposit."** See §5. This is the hard one.
- **Any credential.** No *licensed*, *insured*, *bonded*, *certified*, *Firewise*. None are held.
- **A credit amount, a cap, an income limit, or any statement that this customer qualifies.**
  The invoice's job is to *separate the work* so the customer's accountant can decide. Printing
  "$1,000 back" on an invoice is tax advice, and the cap and the limits are the customer's
  circumstances, not ours.
- **Any figure that is not in the signed agreement or its quote.** See §7.
- **A web address**, until SixfoldColorado.com resolves. Same rule as every other printed piece.

---

## 2 · Line items — they come from the quote, unchanged

**The invoice reprints the quote's lines, line for line, in the same order, with the same wording
and the same amounts.** The customer should be able to lay the two side by side and see the same
sheet twice.

That is not a stylistic preference. Job 2 produced the rule: a first-payment invoice built from
re-allocated line items would have billed two specific tasks as though they were the deposit's
scope, when the agreement prices the job as one fixed sum and splits the *payment*, not the work.
The arithmetic invited it — limbing $600 + plant removal $150 is exactly $750 — and it was wrong.

**Keep the $0.00 lines.** *"Edge and trim — included"* and *"Install 6 Russian sage — free"* are the
two lines that make the sheet persuasive. Dropping them because a tool dislikes zero makes the
invoice look more expensive than the quote the customer agreed to. If Square will not show a zero
line, fold them into the description of the line above rather than deleting them.

---

## 3 · The qualifying split — fire-mitigation jobs only

### Two invoice shapes, and which one a job gets

| Job | Invoice | Why |
|---|---|---|
| **Fire mitigation** (alone, or with anything else) | Qualifying subtotal + non-qualifying subtotal + total | The agreement's handover clause promises *"an itemised invoice that separates qualifying wildfire mitigation work from anything else on the bill"* |
| **Landscaping alone** | One total. **No split, no standards line, no mention of the credit** | The landscaping agreement promises *"an itemised invoice"* — full stop. It deliberately carries no fire or tax-credit content |

**This is the landscaping-standalone rule applied to money.** A landscaping-only invoice that
carries a "non-qualifying" subtotal implies there was qualifying work to compare it against, and
frames a standalone service as the leftover half of a fire job. Job 2 was landscaping only. It gets
a plain invoice.

### What goes in the qualifying column

Straight from the referral packet, which is itself from DOR guidance:

> Creating defensible space, building fuel breaks, thinning woody vegetation to protect structures,
> and treating the resulting slash — chipping, hauling, lop-and-scatter, piling — done to Colorado
> State Forest Service or Division of Fire Prevention & Control standards.

**Slash treatment qualifies, including the hauling**, when it is treating slash from qualifying
work. That matters: haul-off is usually the largest single line, and putting it in the wrong column
is the most expensive classification error available.

### What does not

- Mowing, edging, beds, planting, general landscaping
- Firewood processing and bucking for the customer's own use
- Cleanup of downed wood whose main purpose is not reducing risk to a structure — the packet
  already tells the customer to ask their accountant about the purpose test
- **Anything the customer supplied or did themselves**, and **anything a grant already covered** —
  neither is on a Sixfold invoice anyway, but the line is worth knowing

### The standards line

A qualifying invoice carries one sentence naming the standard the work was done to:

> **Standard:** *Work in the qualifying section was performed to Colorado State Forest Service
> defensible-space standards.*

The packet tells the customer to keep *"the 'standard the work was done to' line from page 2."*
This is that line, and it has to be on the invoice because the invoice is what they keep.

**Only write it if it is true of that job.** It is a statement about how the work was done, not a
template flourish.

### ⚑ The gap this spec found, and it is upstream

**Nothing in the quote pipeline tags a line as qualifying or not.** The walk sheet captures
billable units, the quote engine prices them, and the quote prints them — and at no point does any
of it record which side of the line a given item falls on. The Sedalia quotes do not even itemise
to that level: *"Two-person crew with saws — $1,140"* and *"Hauling and disposal — $1,110"* cannot
be split at invoicing time without someone re-deciding the job from memory.

**So the split has to be decided when the job is quoted, not when it is invoiced.** Two things
follow, and neither is done:

1. **The walk sheet and the quote engine need a qualifying flag per line** — one column, yes/no.
2. **A fire-mitigation quote must itemise finely enough to split.** A two-line quote cannot
   produce a three-column invoice.

Until that exists, a fire-mitigation invoice needs Brandon to classify the lines by hand before it
is sent, and the classification should be written into the job file so the next person can see it.
**This is the first real argument for the quote generator to carry the flag** — see
[../quotes/quote-engine.md](../quotes/quote-engine.md).

---

## 4 · The two invoices a job produces

### 4a · First-payment invoice — before any work

**Invoice the full contract, then take 50% as a payment schedule.** Square does this natively: build
the invoice at the full fixed price and set a schedule of 50% now / 50% on completion, or request a
50% deposit *with the label checked* (see §5). Square computes the halves, so they cannot drift from
the contract.

- **Never invent line items.** Nothing has been done yet. A line reading *"Limb 13 trees — $600"*
  asserts that limbing has been delivered.
- **Due date: on or before the first day of work.** Not the issue date. The agreement makes the
  first half due on or before the first day on site, and §7 keeps work from starting until the
  three-business-day cancellation period has run. The invoice may go out immediately; its due date
  may not precede the first day on site.
- **Repeat the refund line.** *"Every payment is refundable in full, within ten business days, if
  you cancel under section 7 — including a payment made before the cancellation period has run."*
  That is clause 10's own last sentence, and it is the single most useful thing to say when asking
  for money before any work has happened.

### 4b · Final invoice — on completion

- The balance, against the same line items.
- **Goes out with the handover**: the written work record, the before-and-after photographs, and —
  on a fire job — the qualifying split and the standards line. The agreement promises all of it
  together.
- **Do not hold the balance against an outstanding return visit** where the agreement says
  otherwise. Job 2's planting visit is included at no charge and the balance is explicitly not held
  against it.

### If a job is invoiced in one payment

Only where the agreement says so. The schedule is in §5 of the signed agreement; the invoice
follows the agreement, never the other way round.

---

## 5 · "First payment," never "deposit"

**The word `deposit` already means something else in the agreement, and it means $0.00.**

| Where | What it says |
|---|---|
| Agreement §5, page 1 | **"Deposit, if any, paid today — $0.00 — none"** |
| Agreement §5 / clause 10 | The first half is due *on or before the first day of work* |

§5's field is money handed over **at signing**. The first payment is due **later**. They are two
different moments, and the agreement deliberately takes nothing at the first one — which is the
safer structure for a sale solicited at a residence, because it puts every dollar on the far side
of the cancellation window.

An invoice reading *"Deposit $750"* beside a signed agreement reading *"Deposit … $0.00 — none"* is
one word meaning two amounts, on two documents the customer holds at the same time.

**Customer-facing label:**

> **First payment — 50% of the fixed price, due on or before the first day of work.**

Call it a deposit in conversation and internally as much as you like. Do not print it.

**In Square:** check the customer preview. If Square's deposit feature labels the line *"Deposit
due"*, use the **payment schedule / instalments** option instead, which labels them as instalments.

**⚑ The one thing that changes the paperwork:** if Sixfold ever decides to collect the first half
**at signing**, §5's field stops being $0.00 and **the agreement must be re-issued** reading
`Deposit $750.00 / Balance $750.00`. Do not collect at signing against the current wording.

---

## 6 · Numbering

Not previously decided. **Proposed:** `SF-YYYY-NNN` — `SF-2026-001`, sequential, never reset, never
reused.

- **One number per invoice, not per job.** A job with a first-payment invoice and a final invoice
  has two numbers. The final invoice references the first: *"First payment invoiced on SF-2026-014."*
- **Do not encode the customer or the job type into the number.** It leaks on anything forwarded.
- **A voided invoice keeps its number** and is replaced by a new one. Gaps are fine; reuse is not.
- If Square is left to auto-number, **use Square's numbering and do not run a second scheme
  alongside it.** Two numbering systems on one job is worse than either.

Matthew's call — this is a proposal, not a finding.

---

## 7 · Provenance — the rule that governs the figures

**Only promise what traces to the customer's own quote and signed agreement, never to planning
notes.** Every figure on an invoice must appear in a document the customer already holds:

| Figure | Traces to |
|---|---|
| Fixed price | Agreement §5 (Price), page 1 |
| First payment amount | Agreement §5 schedule **and** clause 10 — printed in the agreement, not derived at our end |
| Line items and amounts | The quote sheet, revision as sent |
| Payment methods | Agreement clause 10 |
| Refund terms | Agreement clause 10 / §7 |

**Before sending, check the customer is holding the current revision.** Job 2's near-miss: a $750
first-payment invoice was drafted against a $1,500 agreement while the packet in DocuSign was the
superseded $1,900 version saying $950/$950. Invoicing "per the service agreement" while the
agreement they hold says something else is the kind of mismatch that gets a contractor's paperwork
distrusted for the rest of a job.

**Order of operations: re-issue → they sign → then invoice.**

**Clause-number check.** "Paying" is clause **10** on page 3 of 5 in the corrected agreement. In the
superseded packet it rendered as clause **11**. If a customer quotes a different number back, they
are reading the old file.

---

## 8 · Before an invoice goes out

- [ ] The customer has signed the **current** revision, and its figures match this invoice
- [ ] Line items match the quote line for line, including the $0.00 lines
- [ ] Fire job: qualifying / non-qualifying split present, haul-off in the right column
- [ ] Fire job: the standards line is there **and is true of this job**
- [ ] Landscaping-only job: no split, no standards line, no credit mention
- [ ] The word "deposit" appears nowhere on the customer's copy
- [ ] First-payment invoice: no invented line items; due date not before the first day on site
- [ ] Monument address, 303 number, Contact@ — no Englewood, no old number
- [ ] No credential claim, no credit amount, no web address
- [ ] The disclaimer is on it
- [ ] Invoice number is new and unique

---

## Fact-check log

| Claim | Source | Status |
|---|---|---|
| The invoice is what the credit is claimed with | `marketing/referral-packet.html`, customer copy, twice; `site/who-pays/` | **Verified in the rendered files** |
| Fire agreement promises an invoice separating qualifying work | `agreements/service-agreement.src.html`, handover clause | **Verified** — exact wording quoted above |
| Landscaping agreement promises only "an itemised invoice" | `agreements/landscaping-agreement.src.html` | **Verified** — the difference between the two is deliberate |
| Qualifying work definition, incl. slash treatment and hauling | `marketing/referral-packet.html`, itself from DOR *Income Tax Topics: Wildfire Mitigation Measures* | **Verified as consistent with the packet.** The packet was fact-checked when built; this spec does not re-derive DOR guidance |
| "Deposit, if any, paid today — $0.00 — none" in §5 | Both agreements, rendered | **Verified** |
| First half due on or before the first day of work; work waits for the 3-business-day period | Agreement §5, clause 10, §7 | **Verified** |
| Payment methods: transfer, cash, check to Sixfold, LLC | Agreement clause 10 | **Verified** |
| Job 2 figures used in the worked example ($1,500; $750/$750; seven lines) | `quotes/job2-yard-clearance.src.html` rev 6; `quotes/kara-first-payment-message.md` | **Verified** — these are the real, repriced numbers |
| Nothing in the quote pipeline tags lines as qualifying | `operations/quote-walk-sheet.md`, `quotes/quote-engine.md`, the Sedalia quote sheets | **Verified by absence.** Searched all three; no qualifying/non-qualifying field exists anywhere |
| Sedalia quotes are too coarse to split | `quotes/sedalia-haul-off.src.html` — two labour/haul lines on a $2,250 fixed price | **Verified** |
| Monument address, 303 number, Contact@ | The 2026-09-18 contact sweep | **Verified** |

### Unresolved

- **The qualifying flag upstream** (§3). The real fix, and it is a change to the walk sheet and the
  quote engine, not to the invoice. Not started.
- **Numbering scheme** (§6) is a proposal awaiting Matthew's call.
- **Square's deposit label** — whether its deposit feature prints "Deposit due" on the customer's
  copy is unknown, because no Square account has been opened. Check the preview before the first
  real invoice.
- **No fire-mitigation job has ever been invoiced with a split.** The worked example's fire figures
  are **illustrative and invented for layout**, and say so on the sheet. The first real one should
  be checked against this spec line by line.
