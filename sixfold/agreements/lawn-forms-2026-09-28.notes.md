# The short lawn forms — built 2026-09-28

Two documents, built against `REBRAND-PATH-2026-09.md` §Phase 0.3, which names this as
**the largest piece of work the aeration-led reposition pulls in behind it** and the next
unblocked thing to do. Nothing here is signed, sent or reviewed.

| File | Pages | What it is |
|---|---|---|
| `lawn-job-sheet.src.html` | **3** | One lawn job. One side of contract, then the Notice of Cancellation twice |
| `lawn-monthly-agreement.src.html` | **4** | Rolling monthly lawn care. Two sides of contract, then the notice twice |

Both render at `scale: 1` and both are in `build.mjs` and `tools/html-to-pdf.mjs`.

---

## The problem they solve

The existing paperwork is built for **big occasional jobs**: a 6-page quote-and-agreement
packet, a CLEAR / PROTECT / RESTORE / HAUL walk sheet, a close-out sheet. That is right for
a $2,250 mitigation job. **A $150 aeration job cannot carry it**, and Kara's packet is the
shape of the problem — an aeration job and a $250/month maintenance agreement, both drafted
at five pages.

## Matthew's decision, 2026-09-28

> *"it is a rolling agreement to reoccuring monthly regardless of season"*

So the monthly one runs **month to month with no end date and no seasonal term**. It is not
a twelve-month agreement and not a season agreement. **Kara's existing twelve-month
document is untouched** — it is signed, and it stays as it is.

---

## ⚑ Rolling changes the law that applies, and that is the main finding

Kara's maintenance agreement was deliberately built as a **fixed term that does not renew**,
to stay clear of Colorado's automatic renewal statute. **A rolling agreement renews every
month by definition, so it is now inside that statute.**

**C.R.S. 6-1-732** covers any arrangement renewing *"on a continuous or recurring basis"*.
There is **no minimum initial term**, so month-to-month is covered where a non-renewing
fixed term was not.

**The good news, and it is the reason this is workable:** for renewal terms **under twelve
months**, the notice duty is not monthly. The statute modifies it to the renewal that
carries the contract **past each continuous twelve-month period**. So it is **one notice a
year**, not one a month. A monthly notice duty would have made rolling agreements
impractical for a crew of this size; an annual one is a calendar entry.

**What the document does about it:**

1. **Section 4 is in a box, in 10.5pt bold** (`.cancelbox` + `.legal10`) against 8.4–9.5pt
   body. That is the "clear and conspicuous" disclosure the statute requires *before*
   signing — set off from surrounding text and in larger type.
2. It states plainly that it continues until cancelled, how to cancel, that there is no fee,
   and that cancelling takes effect at the end of the paid month.
3. **It promises the annual reminder in writing**, 25–40 days before each twelve-month
   anniversary.

**⚑ Point 3 is an operational commitment that nobody currently runs.** The document now
promises a letter that no system sends. Whoever owns the calendar owns this.

---

## Fact-check log

| # | Claim | Status |
|---|---|---|
| 1 | C.R.S. 6-1-732 covers month-to-month; no minimum initial term | **Verified** — statute text, "continuous or recurring basis" |
| 2 | Renewals under 12 months → notice once per continuous 12-month period, not monthly | **Verified** — statute text |
| 3 | Standard notice window is 25–40 days before renewal | **Verified** — statute text |
| 4 | No exemption covers residential lawn services (exemptions are utilities, FCC/FERC, insurance, banks, credit unions, air carriers) | **Verified** — statute text |
| 5 | SB 25-145 adds a **one-step online cancellation** duty where the contract was signed "through an online medium" | **Medium confidence** — reported by a named law firm (Ogletree), **not read in the statute text**. Effective date not confirmed against a primary source. **Treat as real, confirm before relying on it** |
| 6 | The statute now covers business customers, not only consumers | **Medium confidence** — same source as 5 |
| 7 | 16 CFR 429.1(b) — notice in duplicate, ten point bold face | **Inherited, not re-verified.** Carried verbatim from the reviewed packet template |
| 8 | C.R.S. 5-3-403(3) — a defective notice leaves the sale cancellable for three years | **Inherited, not re-verified.** From the existing note in `tools/html-to-pdf.mjs` |
| 9 | No planting, no sod in scope | Matthew, 2026-09-25 |
| 10 | Rolling monthly, regardless of season | Matthew, 2026-09-28 |
| 11 | Any price | **None printed.** See below |

**Unresolved and deliberately left out:** nothing in either document states how many days'
notice a customer must give to cancel before the next billing date beyond "end of the month
already paid for". If a cleaner rule is wanted, it is one sentence.

---

## ⚑ No price is printed on either form

Sixfold still has **no aeration rate of its own**. Kara's $1,100 for ¾ acre is an *interim
gauge* with 200 lb of seed and 150 lb of fertilizer inside it — a real charged price, but
not a rate, and what it says about aeration alone is unknown. The $250/month was quoted for
one property.

So both price boxes are blank and filled in per job. **This is the last open gate on the
aeration ad set** — ads generate calls that ask "how much for a quarter acre," and that
answer does not exist yet.

---

## Open decisions

**Matthew's:**
- **Sod.** Still off both forms, following the 2026-09-25 "no planting" call. Putting it
  back is one tick box.
- **Job sheet pen room.** See the flag below.

**Brandon's / the attorney's** (Brandon owns attorney review):
- **The whole auto-renewal box.** It is written to the statute as read, by someone who is
  not a lawyer. It is the highest-risk block in either document.
- **One-step online cancellation.** If these are signed in DocuSign rather than on paper at
  the walk, fact 5 above probably bites, and Sixfold has **no online cancel route** — the
  box offers phone, email and post. A cancel link in the monthly receipt email is the
  obvious answer and is not built.

---

## ⚑ The job sheet's fill-in rows are tight, and this is a real trade-off

Getting the job sheet's agreement onto **one side** cost vertical rhythm. The fill-in rows
run at roughly a **4.8 mm pitch**, and the clear space above each rule is about **2 mm**
before the label of the row above. Typical handwriting wants 6–8 mm.

It fits, it is legible, and every rule is a real rule — but this is a form filled in **with
a pen, at a customer's door**, which is exactly the case where that matters. The monthly
agreement does not have this problem: it runs at the folder's normal 9.5pt because it was
allowed two sides.

**The one-line fix is to let the job sheet be two sides as well** (raise the sheet-1
`.grid-form` gap and `.field .line` height, drop the fit pass). That makes it 4 pages —
still two duplexed sheets, still nothing like the five-page packet. **Matthew asked for one
page and one page is what is built**, but the trade is his to make, not mine.

---

## Tool change this pulled in

`tools/html-to-pdf.mjs` had **margins hardcoded at 0.4in for every job**. A document's own
`@page { margin }` rule is *not* honoured — `preferCSSPageSize` takes the page **size** from
CSS and leaves those margins in charge — so an `@page` override in a source file is silently
a no-op. That cost a round of edits here that did nothing.

Margins are now **per-job and default to 0.4in**, so every existing document is unchanged.
The two lawn forms pass `margin: 0.32`.

---

## If you edit either file

- **Re-count the pages.** 3 for the job sheet, 4 for the monthly. The page labels are
  written in, in four places per document, and a spill makes every one of them a lie.
- **Never reduce the scale below 1** and never shrink `.legal10` or `.noticeform`. Both sit
  on a ten-point statutory floor.
- **The Notice of Cancellation pages are verbatim** from the reviewed template. Do not
  paraphrase, shorten, reset smaller, or try to fit both copies on one side — two will not
  fit at a conformant size, which is why each takes a page.
- Edit the `.src.html`, run `node build.mjs`, then
  `node ../tools/html-to-pdf.mjs lawn-job-sheet lawn-monthly-agreement`.
