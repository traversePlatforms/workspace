# Sending Kara's agreements through DocuSign

**Written 2026-09-30. Nothing has been uploaded and nothing has been sent.**
Companion to [remote-signing](remote-signing.pdf), which still governs. Read that first —
this file is only the field-by-field setup for one document.

---

## ⚑ Send the packet, and every page number moves by one

Both documents now go out as a **packet with the quote in front**, which is what Matthew asked
for on 2026-09-30 after sending the bare agreement first. **That shifts every page number in
this file by one.** Work from the right-hand column:

| | Aeration | Maintenance |
|---|---|---|
| Packet file | [Sixfold-Quote-and-Agreement-Aeration-Kara-Rosenstrauch.pdf](../quotes/Sixfold-Quote-and-Agreement-Aeration-Kara-Rosenstrauch.pdf) | [Sixfold-Quote-and-Agreement-Maintenance-Kara-Rosenstrauch.pdf](../quotes/Sixfold-Quote-and-Agreement-Maintenance-Kara-Rosenstrauch.pdf) |
| Pages | **6** (1 quote + 5) | **7** (1 quote + 6) |
| Quote | page 1 | page 1 |
| Agreement page 1 | packet page **2** | packet page **2** |
| Signature page | packet page **4** | packet page **5** |
| Cancellation forms | packet pages **5 and 6** | packet pages **6 and 7** |

**The quote page takes no tags.** It is an estimate bound in front of the contract, not a
document anyone signs.

## The PDF needs no separate version

Upload **[kara-aeration-agreement.pdf](kara-aeration-agreement.pdf)** as it is. Five pages, flat,
no form fields to conflict with DocuSign's own.

There is a `sedalia-A-service-agreement-DocuSign.pdf` in this folder and it is **byte-identical to
the ordinary flat render** — the README already flags it as redundant and says it should be
deleted rather than maintained. **Do not make a `kara-...-DocuSign.pdf`.** A second copy of the
same contract under a second name is how the wrong one gets sent.

---

## ⚑ Three values go in *before* you upload

These are the seller's to complete, and they must be on the page **when she receives it** —
not added when it comes back. 16 CFR 429.1(b) puts that on the seller, and a notice that was
blank on arrival is the defect that keeps the sale cancellable for **three years**.

| Value | Appears | How many places |
|---|---|---|
| **Date of the transaction** | Page 1 standfirst; pages 4 and 5 under the heading | **3** |
| **Cancellation deadline** | Page 2 §6 "Cancellation period ends"; pages 4 and 5 after *"NOT LATER THAN MIDNIGHT OF"* | **3** |
| **Agreement no.** | Page 1 masthead | 1 |

**All three dates on pages 4 and 5 must match page 1 and page 2 exactly.** Two different
deadlines on one contract is worse than none.

### Which deadline to write

Agree an actual signing day with her first, then take it from this table. For the **12 October**
start she has to sign on or before **Wednesday 7 October**.

| She signs | Deadline to write in | Work may begin |
|---|---|---|
| Mon 5 Oct | midnight **Thu 8 Oct** | Fri 9 Oct |
| Tue 6 Oct | midnight **Fri 9 Oct** | Sat 10 Oct |
| Wed 7 Oct | midnight **Sat 10 Oct** | Sun 11 Oct |

Sundays and federal holidays do not count; Saturday does. **If she signs later than the day you
wrote, the window is shorter than the law requires — void the envelope and reissue.** A window
that is too long is compliant; too short is not.

---

## ⚑ Do not put recipient tags on pages 4 and 5

Those two pages are **her** Notice of Cancellation forms. They carry a date line and a signature
line because she fills them in **only if she decides to cancel**.

**Tag them and DocuSign will require her to sign her own cancellation notice in order to complete
the envelope.** She would be signing the form that unwinds the job, as a condition of agreeing to
it. Leave both pages with no tags at all.

---

## The tags to place

**22 fields are open on the document. Six of them you fill before upload (above). Tag the rest
like this:**

### Kara — signer 1

| Page | Field | Type |
|---|---|---|
| 1 | Mailing address, if different from the property | Text, **optional** |
| 1 | Owner's initials (footer) | Initial |
| 2 | Owner's initials (footer) | Initial |
| 3 | Property owner — signature | Signature |
| 3 | Print name | Text (or Name, auto-filled) |
| 3 | Date signed | Date Signed, auto |

### Sixfold — signer 2, after her

| Page | Field | Type |
|---|---|---|
| 1 | Sixfold representative's initials (footer) | Initial |
| 2 | Sixfold representative's initials (footer) | Initial |
| 3 | Sixfold representative — signature | Signature |
| 3 | Print name | Text |
| 3 | Date | Date Signed, auto |

**Pages 4 and 5: nothing.**

**Tip — AutoPlace.** The footer strings *"Owner's initials"* and *"Sixfold representative's
initials"* are identical on pages 1 and 2, so an AutoPlace anchor on each places both initial
boxes in one step. Do **not** anchor anything that also appears on pages 4 or 5.

---

## The maintenance packet — what differs

Seven pages, and **25 open fields rather than 22**. Everything above applies, with these changes:

**Burn in before upload** — the same two dates, in the same six places (agreement pages 1, 2, 5
and 6 = packet pages 2, 3, 6 and 7), plus the agreement number. **No payment dates need adding:
the 1st of the month and November 2026 are already printed.**

**One extra text field on agreement page 1 (packet page 2):** the snow line reads *"…and the path
to the front door, and any other surface written here: ______"*. Fill it at the walk or leave it
blank deliberately — **do not tag it for her to complete**, because what Sixfold clears is
Sixfold's commitment to make, not the customer's to write in.

**Initials run across three pages, not two** — agreement pages 1, 2 and 3 (packet pages 2, 3 and
4), because the terms run longer in this document.

| Page (packet) | Field | Type | Who |
|---|---|---|---|
| 2, 3, 4 | Owner's initials | Initial | Kara |
| 2, 3, 4 | Sixfold representative's initials | Initial | Sixfold |
| 2 | Mailing address, if different | Text, optional | Kara |
| 5 | Property owner — signature / print name / date signed | Signature, Text, Date Signed | Kara |
| 5 | Sixfold representative — signature / print name / date | Signature, Text, Date Signed | Sixfold |
| **6 and 7** | **nothing** | | |

**There is no "first payment books the date" on this one** — it is billed monthly, so there is no
date being held and nothing to say about it.

## The part DocuSign cannot do

**Tell her out loud, at the time she signs, that she can cancel.** 16 CFR 429.1(e) requires it
spoken, and a signing ceremony in a browser is not a conversation. Be on the phone while she
signs, say it plainly, and write in the job file that you did and when.

---

## ⚑ Unresolved: whether pages 4 and 5 can go electronically at all

**The existing position in this folder is that they should not.**
`sedalia-A-service-agreement.notes.md` says to keep the two cancellation pages **out of the
electronic envelope** and deliver them on paper, because sending a statutorily-required written
notice electronically engages the **ESIGN consumer-consent requirements** at 15 U.S.C. 7001(c).

**DocuSign arguably answers that**, and this folder's own README says so — a service like
DocuSign exists *"to run the ESIGN consent disclosure properly."* Every envelope presents the
Electronic Record and Signature Disclosure and records her acceptance in the certificate.

**I could not resolve which reading is right, and it is a real question rather than a formality.**
So:

- **Send all five pages in the envelope**, with the Electronic Record and Signature Disclosure
  switched on, and keep the certificate showing she accepted it; **and**
- **Give or post her a paper set of pages 4 and 5 as well.**

Doing both costs an envelope and a stamp. Doing neither correctly costs a three-year cancellation
right. **This is the specific question to put to the attorney** — it is narrow, and it applies to
every agreement Sixfold ever sends this way, not just this one.

---

## After it comes back

1. **Download the signed PDF *and* the certificate of completion.** The certificate is the proof
   of when she signed — the record this pack never had before. File both in the job folder.
2. **Check the date she actually signed** against the deadline you wrote. If she signed later,
   reissue.
3. **Do not schedule the crew inside the window.** Cancel after work has started and Sixfold is
   owed nothing — C.R.S. 5-3-405(3).
4. First payment **$550.00**, due on or before the first day of work. It books the date; it does
   not affect her right to cancel.

---

## Fact check

| Claim | Status |
|---|---|
| The existing `-DocuSign.pdf` is byte-identical to the flat render and is flagged redundant | **Verified** — `sedalia-A-service-agreement.notes.md` line 36 and README line 192 |
| The seller completes the notice before the buyer receives it | **Verified** — 16 CFR 429.1(b), read in full 2026-08-21 and recorded in the README |
| A defective notice leaves the sale cancellable for three years | **Verified** — C.R.S. 5-3-403(3) |
| Oral notice of the right to cancel is required | **Verified** — 16 CFR 429.1(e) |
| Business day excludes Sunday and federal holidays; Saturday counts | **Verified** — same reading; deadline table re-derived 2026-09-30 |
| Tagging pages 4–5 would require her to sign her own cancellation notice | **My reasoning** from how DocuSign required fields work, not a tested envelope. **Test with an envelope sent to yourself before sending hers** |
| Whether the cancellation notice may be delivered electronically under ESIGN | **Unresolved.** Two readings in this folder conflict. Belt-and-braces above; attorney question |
| DocuSign presents an ESIGN disclosure and records acceptance in the certificate | **Not verified first-party** — no DocuSign account has been opened here. Confirm in the product |
