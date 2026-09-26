# Tagline — the decision, September 2026

**Status: draft, nothing changed.** No file has been swept, nothing published, posted or printed.
This is the sheet for the meeting.

Built 2026-09-25, off Matthew: *"i need a new tagline instead of we do the work then shows you who
pays for it. Since fire mitigation is in the back burner currently. What about something that says
like clear protect restore."*

| File | What it is |
|---|---|
| `README.md` | This. Source of record — the reasoning, the candidates, the fact-check log |
| `tagline.html` | The designed sheet. **Bone print register, palette A.** Do not hand-edit the artifact copy to fix this one; this is the source |
| `Sixfold-Tagline-Decision.pdf` | **5 pages**, printed light, for the table beside the concept board |
| `tagline.artifact.html` | Published copy for https://claude.ai/artifact/8w7mxwgSbMuKv37gKk3bNi — same content, theme-aware so it reads on a phone at the meeting |

Rebuild the PDF with `node tools/html-to-pdf.mjs tagline` from `sixfold/`. **Expect 5 pages** — four
tables and the fact-check log. Sections are deliberately not held whole in print: the first render
did that and lost 40% of page 1 keeping one section together.

**Palette note.** Both copies are set in palette A, which makes the sheet partly its own argument —
green carries every rule, mark and link, and ember appears exactly twice, on the two things that are
genuinely warnings. Ratios are the measured ones from `site/assets/site.css`, not estimates: Turf
`#2F7A4F` is 4.25 on Bone, so it carries rules and never type.

---

## The verdict

**Retire "We do the work and show you who pays for it."** Not because fire is on the back burner —
because the sentence is **untrue on three of the four services**.

**Recommended replacement: "From the lawn to the treeline."**

**Owner: Brandon**, the same as the descriptor, and it should be decided in the same sitting.

---

## Why the current line has to go

"We do the work and show you who pays for it" is a **funding promise**. It works because of two
things, and both are fire-specific:

- the Colorado state tax credit, which covers what a homeowner pays a contractor for **qualifying
  vegetation work**
- the HB25-1182 insurer re-score, which applies to **wildfire risk**

Nobody else pays for an aeration. Nobody else pays for mowing, edging, or a bed clean-up. On the
service that now leads, and on two of the three beside it, the line is not merely off-message — it
promises something that does not exist.

### ⚑ The deadline nobody set

It is hardcoded at [`brand/square/build-square.mjs:129`](../square/build-square.mjs), which means it
is on the **Square invoice template** and on the customer display. Kara's aeration invoice would go
out carrying a promise about who pays for it.

The rebrand path already flags the invoice as *"the one with a deadline behind them, because an
invoice goes to a paying customer with whatever mark is on it that day."* This is that deadline
arriving, on the copy rather than the mark.

---

## Clear / Protect / Restore — heard, and why not

**Whose it is, stated plainly:** these are **Brandon's three circles**. They were the organising
frame of the first three builds of the site-walk sheet
([`operations/quote-walk-sheet.md`](../../operations/quote-walk-sheet.md)), and they are the spine of
the 2026 **Land & Fire** flyer Matthew sent on 2026-09-25 — *"I like the wording and the messaging."*

The frame has real buy-in and it is not being dismissed. Two objections, both about the
repositioning rather than the writing:

**1. All three are fire verbs in this business.** CLEAR is fuel reduction. PROTECT is defensible
space — it is the CSFS term verbatim. RESTORE is putting the property back after the clearing.
**Aeration is none of the three.** It would tagline an aeration-led brand with a phrase that
describes every service except the one now leading.

**2. As a sequence it re-creates the framing swept out in September.** Clear → protect → restore
makes restore the after-job of the clearing. That is the *"landscaping is the after-job of fire
mitigation"* framing that was deliberately removed from every document. It would come back in as the
tagline.

It is the same objection as the house on the logo board: **it re-centres the thing being demoted.**

**What survives:** the three-verb spine, which is the part that actually reads well. Candidate 2
keeps it.

---

## The candidates

Best first.

| # | Candidate | For | Against |
|---|---|---|---|
| **1** | **From the lawn to the treeline** ← **recommended** | Spans all four services **without naming one**, so the next change of mix does not date it — and the mix has moved twice in ten days. **"Lawn" is the first word.** Answers the question the logo board already identified as the customer's real one: *will you do my quarter acre, will you do my twenty.* And **"treeline" is the mark's own word** — the README says the conifer is what makes the four peaks read as a treeline rather than mountains, so copy and logo would finally say the same thing | Names no service, so someone who has never heard of Sixfold learns the range but not the work. Needs the service line under it — which every surface already carries |
| **2** | **Feed it, clear it, defend it** | Keeps **Brandon's three-verb spine**, so his frame survives the reposition instead of being dropped. Lawn first, fire last — the new order, stated. Drops into the same lockups the old line sits in, at the same length | Names services by implication, so a mix change still touches it. "Defend" leans fire, just less than "protect" does |
| **3** | **Your ground, all four seasons** | The only candidate that covers **snow** if Brandon takes it, and the only one that says **recurring** — which is what actually changed when lawn care became the business. Pairs directly with the seasonal-palette direction: the words say all year, the palette shows all year | Says nothing about what is done to the ground. Closest of the six to a slogan rather than a description |
| **4** | **Lawn to treeline, all year** | 1 and 3 together: the range and the recurrence | Two ideas in one line is one more than a magnet carries at 40 mph |
| **5** | **Aerate · Mow · Clear · Thin** | Uses the dot device already in the family — "Slash · Chip · Haul" is on the merch board. Literal, nothing to interpret | Four service verbs is four things to reprint. It is the "Land & Fire" problem with more words in it |
| **6** | **Clear / Protect / Restore** — keep it | Brandon's, already liked, already printed once | See above. Describes every service except the one now leading, and the sequence re-creates the banned framing |

**If a three-verb line is wanted, it is 2. If the priority is never doing this again, it is 1 or 3.**

---

## What changing it costs

**Nine files, and the website is not one of them.** The site never carried the tagline — `/who-pays/`
uses "Who pays for it" as a **page kicker**, which is correct in its own context and should stay.

| File | What is there |
|---|---|
| [`brand/social/build-social.mjs:40`](../social/build-social.mjs) | the `BIO` const — **one line**, regenerates every banner |
| [`brand/square/build-square.mjs:129`](../square/build-square.mjs) | hardcoded in the template — invoice, customer display, online banner |
| [`marketing/facebook-page-copy.md:18`](../../marketing/facebook-page-copy.md) | the page bio |
| [`marketing/square-business-description.md:24`](../../marketing/square-business-description.md) | the business description |
| [`marketing/flyers.html:178`](../../marketing/flyers.html) | it is the `<h1>` |
| `brand/social/README.md`, `brand/social/UPLOAD-GUIDE.md`, `brand/square/README.md` | documented as fixed copy |
| [`site/README.md:462`](../../site/README.md) | listed under "slogans used, and why each is safe to print" |
| `site/_tabled/merch/` | the "Who pays for it" back tee — off the site, still buildable |

The `.build/` HTML files regenerate; they are outputs, not sources.

**Do this in the same sweep as the descriptor.** The tagline and "Land & Fire" live in mostly the
same files, and Phase 4 of the rebrand path names sweeping twice for a line that changes again as
*"the one genuinely wasted week available here."*

---

## What this does not decide

Three, kept short on purpose.

| Open | Owner | Why it touches the tagline |
|---|---|---|
| **The descriptor** — retire "Land & Fire", or pick from the six | **Brandon** | Six candidates are written up in `REBRAND-PATH-2026-09.md` §Phase 1. Same sweep, same sitting |
| **Snow — a service or a favour?** | **Brandon** | If snow is in, candidate 3 gets stronger and candidate 5 becomes wrong on the day it is answered |
| **Sod — still sold?** | **Matthew** | One line. Does not change the tagline, but it changes the service line printed under it |

---

## Fact-check log

| Claim | Status |
|---|---|
| The current line is the bio line from `marketing/facebook-page-copy.md` | **Read** 2026-09-25, and `site/README.md:462` names it as the fact-checked bio line |
| It is on the Square **invoice** template and customer display | **Read** 2026-09-25 — `build-square.mjs:129`, and three generated `.build/` invoice and display HTMLs carry it |
| The state tax credit covers what a homeowner pays a contractor for qualifying vegetation work; HB25-1182 gives an insurer 30 days on a re-score | **Carried over, not re-verified today.** Both were verified first-party when `tax-credit-notebook/` was built and audited. The argument here does not turn on the detail, only on the scope being vegetation and wildfire |
| CLEAR / PROTECT / RESTORE are Brandon's three circles | **Read** — `operations/quote-walk-sheet.md`, §"One thing worth raising with Brandon" |
| They are the spine of the Land & Fire flyer Matthew sent, and he liked the wording | **Read** — `marketing/lawn-infographic-2026-09/README.md`, quoted directly |
| "Landscaping as the after-job of fire mitigation" is a standing banned framing | **Standing rule**, swept across the repo 2026-09-18 |
| "Treeline" is the mark's own word for the four peaks plus conifer | **Read** — `brand/rebrand-2026-09/README.md`, the fourth objection to the house |
| The website does not carry the tagline | **Grepped** 2026-09-25 — zero hits across the ten page HTMLs; the only match is the `/who-pays/` kicker |
| Nine files carry it | **Counted** 2026-09-25, excluding generated `.build/` outputs |
| The mix has moved twice in ten days | **Counted** — descriptor settled 2026-09-16, positioning changed 2026-09-23, landscaping defined as lawn care 2026-09-25 |
