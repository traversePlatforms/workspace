# Sedalia — Option A service agreement (filled from the template)

**Built:** 2026-08-29
**Status:** Draft on disk. **Not signed, not sent, not attorney-reviewed.**
**Job:** Downed wood clearance, a homeowner in S Sedalia, Douglas County, CO.
**Quote she accepted:** Option A — hauled away — **$2,250** ([../quotes/sedalia-haul-off.src.html](../quotes/sedalia-haul-off.src.html)).

**Revised 2026-08-29 (Matthew), three changes:**
1. **Seller address is now Monument:** `17890 Sierra Way, Monument, CO 80132`, on Matthew's instruction. Replaces the Englewood registered address on page 1, both Notice of Cancellation copies, and every footer. **Still to do, not done here:** file a change of principal address with the CO Secretary of State (entity 20258292716 still shows Englewood), and confirm mail is actually collected at 17890 Sierra Way — the Notice of Cancellation address is where a mailed cancellation lands, and a bad address there is the defect that opens the three-year window.
2. **Payment schedule reworded:** first $1,125 due on or before the first day of work, payable by electronic transfer, cash or check; balance on completion. This reverses the earlier $0-deposit design (which kept all money out of the cancellation window). Every payment stays fully refundable within ten business days if she cancels under section 7 — that cannot be contracted around.
3. **Dates still blank** — see the rewritten "fill in by hand" section below. The cancellation deadline depends on the actual signing date and must be computed from it.

**Not done, and why:** the request to state that cancellation is no longer possible once work has begun, or once payment is taken, was not added — it is unenforceable and stating it is itself an FTC violation. The three-business-day right runs from signing regardless of payment or work starting; if she cancels in that window after work has started, section 5-3-405(3) bars any charge for the work done and every payment is still refunded. The protection is operational (do not start until the window closes), not contractual.

This is **the existing service-agreement pack** ([service-agreement.src.html](service-agreement.src.html)), filled in for this
job. Nothing in the legal structure was changed: **5 pages**, built to
16 CFR 429 and C.R.S. 5-3-401 to 5-3-405, pages 4 and 5 are the two Notice of
Cancellation copies **verbatim** from the reviewed template.

**Sheet 1 fit pass, 2026-08-30.** The filled Option A job carries more copy on
page 1 than the blank template, so page 1 was spilling onto a second physical
sheet. Fixed by tightening the vertical rhythm of **sheet 1 only** — 8.5pt body
and 1.2 line-height in place of 9.5pt, and smaller inter-element spacing (scoped
block at the end of the `<style>` in both `.html` and `.src.html`). **No wording
changed. Pages 3–5, the `.legal10` and `.noticeform` statutory type, and sheets
2–5 are untouched.** Verified at exactly 5 Letter pages by rendering and counting.

- **[sedalia-A-service-agreement.html](sedalia-A-service-agreement.html)** — standalone, open in a browser, print or save to PDF.
- **[sedalia-A-service-agreement.src.html](sedalia-A-service-agreement.src.html)** — source with the `<!--STYLE-->` marker. **Node is now installed** (`%LOCALAPPDATA%\nodejs`), but `build.mjs` does not list this job, so for now the `.src.html` and `.html` are kept in sync by hand.

### The three PDFs beside the source — pick per signing method

| File | For | Notes |
|---|---|---|
| `sedalia-A-service-agreement.pdf` | reference / print | Flat 5-page render, backgrounds on. |
| `sedalia-A-service-agreement-DocuSign.pdf` | upload to DocuSign / Dropbox Sign | Byte-identical to the flat render. The sender drops signature, initial, date and text tags onto the visible rules. Keep the two Notice of Cancellation pages (4–5) out of the electronic envelope, or the envelope has to run the full ESIGN consumer-consent disclosure (15 U.S.C. 7001(c)); safest is to deliver those two as paper. Give the oral notice of the 3-day right by phone and note that you did. |
| `sedalia-A-service-agreement-fillable.pdf` | email to her to fill and return | AcroForm, 30 text/signature fields on the same 5 pages, no visible field borders. Built by `scratchpad/fillable/make-fillable.mjs` (pdf-lib overlay on the flat render). She can type into it in any PDF reader and sign with Fill & Sign, or print, fill and scan. **This route has no audit trail, no tamper-evident record and no signing timestamp** — see the method comparison given to Matthew 2026-08-30. The rep still fills the transaction date and the "MIDNIGHT OF" deadline on pages 4–5 before it goes out; those are form fields too. |

Regenerate: flat PDF via `scratchpad/agreement-to-pdf.ps1` (Letter, 0.35in top/bottom + 0.5in side margins, scale 1, `preferCSSPageSize:false`); then `node scratchpad/fillable/make-fillable.mjs` for the AcroForm; then copy the flat PDF to `-DocuSign.pdf`. Field placement was eyeballed against `scratchpad/fillable/overlay-p*.png`.

---

## What was filled in, and where it came from

| Field | Value | Source |
|---|---|---|
| Sheet heading | "Downed wood clearance · S Sedalia, Colorado · Option A, hauled away" | The quote's own `sheetnum` |
| Section 2 — the work | The 7-step scope: walk and mark, photograph, buck to ~16in, load by hand, haul off (6 loads), pay tipping, rake and re-photograph | Quote A, "What we do, in the order we do it" — reproduced, not paraphrased |
| Section 2 — identification | "Material already on the ground… no standing tree is felled" | Quote A standfirst + exclusions |
| Section 3 — extra exclusions | Stump grinding; felling any standing tree; non-wood debris | Quote A, "What this price does not include" |
| Section 4 — material | **Hauled off site** ticked; firewood-retention-on-request note | Quote A scope + final term |
| Section 5 — price | Total **$2,250.00**, deposit today **$0**, balance **$2,250.00** | Quote A headline price |
| Section 5 + clause 11 — payment | **first $1,125.00 on or before the first day of work** (electronic transfer, cash or check), **$1,125.00 on completion**; every payment refundable within ten business days on cancellation | Matthew instruction 2026-08-29 |
| Clause 12 — damage window | 14 days (unchanged from template) | Template decision 2026-08-21 |
| Party name | **Sixfold, LLC** (with comma) | CO Secretary of State entity 20258292716 |
| Contractor address | **17890 Sierra Way, Monument, CO 80132** | Matthew instruction 2026-08-29 — **not yet filed with the SoS**, which still shows Englewood |
| Contact | (303) 915-1045 · Contact@SixfoldColorado.com | Sixfold README "Next up" §3 |

**The first payment can now fall inside the cancellation window.** Matthew's
instruction is to take the first half on or before the first day of work; if work
starts the day after the deadline, "the day before" is the deadline day itself,
still inside the window. This is legal but it reverses the earlier $0-deposit
design, whose whole point was to keep money out of the window. Section 5 and
clause 11 both now say every payment — including one made before the window
runs — comes back in full within ten business days on cancellation, which is the
statutory position (16 CFR 429.1(g), C.R.S. 5-3-404) and is not waivable.
**Cleanest version if Matthew wants it:** take the first half *on the day work
begins only* (which is after the deadline has passed), and there is no refund
exposure at all.

---

## Fill in by hand before it is signed

1. **Agreement no.** — top right of page 1. Pick a scheme for the filing system, e.g. `SF-2026-001`. Currently a blank rule.
2. **Date of this transaction** — page 1 standfirst. **The date she physically signs, nothing else.** The three-business-day cancellation clock runs from this date, so it cannot be set to the intended start date or to any date chosen for convenience. Do not backdate.
3. **Section 1** — owner full name(s), phone, property address, city/state/ZIP, email, mailing address if different. *(Left blank here — not on file. These are hers to complete.)*
4. **Section 4** — if any wood is being kept as firewood, note where it gets stacked.
5. **Page 2, section 6** — three dates, all derived from the signing date in item 2:
   - **Cancellation period ends (midnight)** — third business day after signing. Business day = every day except Sunday and federal holidays; **Saturday counts**. Worked example: sign on a Monday with no holiday in the way → deadline is midnight **Thursday**. Sign on a Friday → Saturday is day 1, Sunday skipped, Monday day 2, Tuesday day 3 → deadline midnight **Tuesday**.
   - **Work begins on or after** — the day after that deadline, unless she asks *in writing* to start sooner.
   - **Estimated completion** — about 1½ days after the start.
   - **All three dates are left blank in the draft** (signing date not settled as of 2026-08-29). Compute them from the real signing date. No federal holiday falls between 27 Aug and 7 Sept 2026 (Labor Day is Mon 7 Sept), so in this window only Sundays are skipped:

     | She signs | Cancellation deadline (midnight) | Work begins on or after | Est. completion |
     |---|---|---|---|
     | Thu 27 Aug | Mon 31 Aug | Tue 1 Sept | Wed 2 Sept |
     | Fri 28 Aug | Tue 1 Sept | Wed 2 Sept | Thu 3 Sept |
     | Sat 29 Aug | Wed 2 Sept | Thu 3 Sept | Fri 4 Sept |
     | Mon 31 Aug | Thu 3 Sept | Fri 4 Sept | Sat 5 Sept |
     | Tue 1 Sept | Fri 4 Sept | Sat 5 Sept | Mon 7 Sept |

     **The Tuesday 1 Sept start she has in mind only works if she signs on Thursday 27 Aug.** Filling in "midnight Mon 31 Aug" against any later signing date is the exact defect that extends the cancellation right to three years (C.R.S. 5-3-403(3)). If she wants a Tuesday start and signs later than the 27th, the start date moves — it is not negotiable down.
6. **Pages 4 and 5 (both Notice of Cancellation copies)** — the Sixfold rep completes, **before handing them over**: date of transaction, and "NOT LATER THAN MIDNIGHT OF ___" = the same deadline as section 6. Both copies. A blank or wrong date here is the defect that extends her cancellation right to **three years** (C.R.S. 5-3-403(3)).
7. **Initials** — page 1 and page 2 footers, both parties.
8. Give her a **signed copy of all 5 pages plus both cancellation notices** at signing, and **tell her out loud** she has three days to cancel (C.R.S. requires the oral notice too).

---

## Raise these before it goes in front of her — none are drafting fixes

1. **Not reviewed by an attorney.** The pack never has been. The agreements README lists what to put in front of one; item 1 is the insurance gap below.
2. **No general liability and no workers comp.** Clause 12 promises Sixfold is responsible for negligent damage by its crew — honest to sign, but there is no policy behind it, and this job is bucking and hauling heavy logs. This is the single largest exposure and it is a business decision, not wording.
3. **The address.** The agreement and both cancellation notices now carry **17890 Sierra Way, Monument, CO 80132** (Matthew's instruction, 2026-08-29). Two things must follow and neither is done: **(a)** file a change of principal address with the CO Secretary of State so the register matches the notice — until then the LLC's registered address is still Englewood, and a mismatch between the two is an argument that the notice is defective; **(b)** confirm mail is actually collected at 17890 Sierra Way. The Notice of Cancellation address is where a mailed cancellation physically lands — an address no one checks is the same three-year problem as a blank one.
4. **The masthead and the quote now agree** — both say Monument. Good, but see item 3: the SoS record does not yet.
5. **The quote's page 2 promised more than clause 1 does** — the insurer re-score drafting help. The quotes README flags that as an operational promise nobody has delivered yet. Clause 1 here is the narrower, safe version (scope, photos, itemised invoice). If the fuller help on the quote is real, it can be added as a written line in section 3's "added to scope"; if it is not going to happen, it should come off the quote before she signs anything.
6. **Deposit, liability cap, and venue (clause 13)** are still on the attorney list in the agreements README.

---

## Fact-check log

| Claim in the document | Source | Status |
|---|---|---|
| Price $2,250; crew 12h @ $95; 6 loads @ $185; travel not billed | [../quotes/README.md](../quotes/README.md) + Quote A sheet; every rate traces to Sheet A of [../marketing/pricing-guide.md](../marketing/pricing-guide.md) | **Matches the accepted quote.** Not re-derived here |
| Payment: first $1,125 on or before first work day (electronic transfer / cash / check), $1,125 on completion; all payments refundable within 10 business days on cancellation | Matthew instruction 2026-08-29; refund rule 16 CFR 429.1(g), C.R.S. 5-3-404 | **Instruction, not a verified fact.** Refund guarantee is statutory and stated in the document |
| Three business days to cancel, in writing, no fee, not waivable; all payments refunded; **cancellation right is not cut off by payment or by work starting** | 16 CFR 429.1; C.R.S. 5-3-402 to 5-3-405 — read first-party 2026-08-21, logged in [README.md](README.md) and [../FACT-CHECK-2026-08-21.md](../FACT-CHECK-2026-08-21.md) | **Verified** (carried from that review). Request to state the right ends once work begins was declined — unenforceable and a violation to state |
| Ten-point bold cancellation statement above the signature; Notice of Cancellation in duplicate, verbatim | 16 CFR 429.1(a)/(b); `.legal10` and `.noticeform` hold the type size | **Verified** — statutory wording reproduced unchanged, including the obsolete telegram line. **Must not be removed or shrunk** |
| Party name "Sixfold, LLC"; seller address on the instrument **17890 Sierra Way, Monument, CO 80132** | Party name: CO Secretary of State, entity 20258292716 (verified 2026-08-21). Address: Matthew instruction 2026-08-29 | Party name **verified**. Address **not yet on the SoS record** (still Englewood) and **mail collection at Sierra Way unconfirmed** — see blocker 3 |
| Contact@SixfoldColorado.com; (303) 915-1045 | [README.md](README.md), "Next up" §3 and funding one-pager contact | **Verified against project records**, not re-confirmed live |
| Colorado 811 locates before ground disturbance (clause 5) | C.R.S. 9-1.5-103 / 9-1.5-105 — read 2026-08-21 | **Verified**; the precise placement of the statutory duty is still an attorney item |
| No claim of licensed / insured / bonded / certified anywhere | Checked line by line | **Clean** — matches the standing prohibition in the Sixfold README and the quotes |

**Not verified here:** the road distance Monument → the property (the stated
reason for $185/load rather than $172), the crew-hour and load-count estimates,
and whether the tax-credit *purpose* test fits this job — all carried from the
quote, all listed in [../quotes/README.md](../quotes/README.md) "What has to be checked".
