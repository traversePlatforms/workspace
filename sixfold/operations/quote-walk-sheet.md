# Sixfold LLC — Quote walk sheet

**Written:** 2026-09-13 · rewritten three times the same day, see below
**Status:** Internal. Draft on disk. Nothing here is customer-facing and nothing has been sent.
**Printable version:** [quote-walk-sheet.html](quote-walk-sheet.html) → [quote-walk-sheet.pdf](quote-walk-sheet.pdf) — **one page, verified at 1.**

One sheet on a clipboard. **Section 1 is what can be counted and charged for. Section 2 is what the job burns or needs. Section 3 is a notes box for everything else.** It carries no prices.

**There is also a fillable version** for a phone, tablet or laptop — [quote-walk-form.artifact.html](quote-walk-form.artifact.html), published at https://claude.ai/code/artifact/033bdc08-544e-47e5-acf0-323e2a3ccc35. Same fields, same order, same palette. It saves each walk to a shared log the desk can open, keeps a local draft while you type, and exports a walk as CSV. **It is a separate hand-written file, not generated from the print source** — a change to the fields has to be made in both.

---

## What it went through, and why

| Build | What it was | Why it changed |
|---|---|---|
| **First** | Four pages, built on Brandon's three-circle diagram. Sheet 1 the frame, 2 property and access, 3 the fifteen items, 4 a price-build table using the rate card. | — |
| **Second** | Pricing stripped out. **The Sedalia job came in under cost** — under-valued and under-quoted badly enough to lose money. Pricing is being rebuilt, so no figure from the old card belongs in a driveway. | Matthew, 2026-09-13 |
| **Third** | Cut to two pages of pure capture list. Customer name, address, phone, insurer, tax-credit eligibility questions and the close-out routine all came off — none of it feeds a price, and the agreement and tax-credit forms already ask for it. | *"Mainly just a checklist of everything they need to document to produce a price."* |
| **Fourth — current** | **One page, reorganised around money rather than around the diagram.** Billable units first, job costs second, notes box third. | *"What we can make money off and charge them for right now… how many trees, how tall, how much brush, how many logs to buck, how many chains, gas, chipper rental, trailer rental."* |

### What the fourth build dropped, deliberately

Acres, gate width, drag distance to the truck, slope, round-trip mileage as its own row, the photograph list, and the separate conditions section. **They are not gone — they are the prompt line above the notes box**, which is exactly what Matthew asked for: a place for the things worth noting that are not themselves billable.

### One thing worth raising with Brandon

**His three circles are no longer on the sheet.** CLEAR / PROTECT / RESTORE were the organising frame of the first three builds; the current sheet is organised by *what earns and what costs* instead, because that is what was asked for. His fifteen items all survive — trees, brush, dead fall, logs, slash, stumps, debris, haul — they are just grouped by money rather than by buyer motive. **If he wants his frame visible, it goes back as three sub-headings inside section 1 at the cost of about 40px**, which the page currently has.

---

## What is on it

**Section 1 — the work, what gets counted and charged.** Trees to take down in four height bands; how many of those come down over a roof, fence, line or drive; trees to limb rather than remove; logs to be bucked and the round length; dead fall; brush, branches and twigs; chipper feeding hours; slash piles to build; stumps with count and diameter inches measured at the ground; loads to haul off, counted twice; what stays on site instead.

**Section 2 — what it takes.** Crew people × days; chains and sharpenings; gas, mix and bar oil; chipper, trailer and stump grinder with *ours or rented* and the rental cost; anything else hired or bought; dump fees per load, called and confirmed; truck fuel by round trips; and whether a second trip is needed, with the 811 three-day locate named as the usual reason.

**Section 3 — additional notes.** Four ruled lines and a prompt.

**Foot of the sheet.** No price is given on the property. And the stop rule: over 80ft, on a structure, under tension, or near a line.

---

## Decisions worth keeping

- **No prices, anywhere.** Until the rebuild is done, the failure mode is somebody helpfully remembering a rate.
- **"Ours, or rented?" is on every machine row.** A rented chipper is a cost that shows up on the job; an owned one is a cost that shows up as wear and does not get counted at all. Both need to be visible before a rate can be built.
- **Dump fees are call-and-confirm.** Today's figure, not last year's.
- **"Count the pile twice, both counts."** The load count moves cost most and is got wrong most.
- **Stump diameter at the ground, root flare included.** One that looks 14in at eye level is often 22 at the soil.
- **"How many come down over a roof, fence, line or drive"** is its own row. It is the single thing that turns a one-cut tree into a rigged, piece-by-piece removal, and it is not visible in a tree count.

---

## Two records elsewhere that are now wrong, and are not mine to correct

- **[../quotes/README.md](../quotes/README.md)** opens with *"Drafts on disk. Not sent, not signed, not scheduled. Nothing here has been in front of the customer."* **No longer true** — the job was quoted and worked. Its reconciliation of how the number was built is intact, and is now also the record of how it came up short.
- **[../marketing/pricing-guide.md](../marketing/pricing-guide.md)** presents its rates as sound, each a named Colorado operator's published figure minus 5%. **The method itself may be the fault:** undercutting a competitor's published rate assumes that rate covers Sixfold's costs, and one real job says it did not. The suspects are the ones the quote README had already flagged as unverified — the crew-hour estimate, the load count, the drive, and the two-day chip call.

**Neither file has been edited.** Correcting a record of what happened needs the facts of what happened.

---

## Rebuilding

```
node build.mjs && node artifact-copy.mjs
node ../tools/html-to-pdf.mjs quote-walk-sheet
```

Then **count the pages.** Screen height does not predict page fit — this went out at five pages on its first print. The `.src.html` head carries a small spacing block pulling in section margins and table padding; the shared register is unchanged for every other document.

**Current headroom: −28px against a 1200px budget.** About one more row, or one more notes line. Anything bigger needs something else to come off.

---

## Fact-check log

No price appears on the sheet, so there is nothing here to reconcile against the pricing card. What remains is operational.

| Claim on the sheet | Source | Status |
|---|---|---|
| Stump diameter is measured at the widest point where the stump meets the soil, root flare included | Pricing guide §3, citing how both Denver-metro comparables measure | **Verified as a measurement convention**, independent of what the rate turns out to be |
| Stumps cannot be ground the same day — the 811 locate comes first, three business days in practice | C.R.S. 9-1.5-103(3)(b) and colorado811.org, logged in [gear-checklist.md](gear-checklist.md) §1.6 | **Verified.** Statute sets two business days not counting the day of notice; Colorado 811's own pages say two in one place and three in another, so the sheet plans on three |
| The estimate is written up and sent rather than given on the property | Pricing guide §9 — the estimate is free and **written** | **Verified.** The no-number-on-the-lawn rule matches what the terms already promise |
| A tree over 80ft, on a structure, under tension, or near a line is a call-in | Gear checklist §2.1 on climbing and aloft work; pricing guide §7 on storm call-outs | **Verified as consistent with both.** Neither document sets 80ft as the threshold — **that line is a judgement, and Brandon should confirm it** |
| Licensed · insured · bonded · certified — none may be said | [../README.md](../README.md); gear-checklist.md | **Verified as still true.** No general liability and no workers comp are in force |

### Open

- **What the Sedalia job actually cost** — hours, loads, days, fuel, tip fees. Until those exist as numbers the rebuild has nothing to build on.
- **Whether the minus-5%-of-a-competitor method survives.**
- **Whether the 80ft call-in threshold is the right one.**
- **What a chipper, trailer and grinder actually cost per day** when they are owned rather than rented — the number section 2 is collecting but nobody has yet.
