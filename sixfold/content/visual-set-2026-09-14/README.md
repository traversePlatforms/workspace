# Visual set — 2026-09-14

Four social boards for **Sixfold Colorado**, built as send-ready PDFs.

**Status: all four are drafts. Nothing published, posted, scheduled or staged.** No platform account
exists to post them from, which the platform sheet already records. Standing rule in
`sixfold/README.md` and `CLAUDE.md`.

**Open [index.html](index.html) in a browser** to see all four together.

---

## The four

| # | Board | Visual form | Ground | Pairs with |
|---|---|---|---|---|
| 1 | The five feet that decide it | Annotated section, true 0–10 ft scale | Light | [`../03-first-five-feet-post.md`](../03-first-five-feet-post.md) |
| 2 | The state covers this work | Emphasis column chart | Dark | [`../02-tax-credit-post.md`](../02-tax-credit-post.md) |
| 3 | Your house has a score | Two steppers + contents list (**not a chart**) | Light | [`../01-insurance-risk-score-post.md`](../01-insurance-risk-score-post.md) |
| 4 | The beetles keep a calendar too | 12-month range chart | Dark | [`../04-when-you-cut-post.md`](../04-when-you-cut-post.md) |

Four topics, four different visual forms, two light and two dark, alternating. Each `.pdf` is **one
borderless page at 1080×1350 (4:5)** — the portrait frame Nextdoor, Facebook and Instagram all take.
The `.png` beside it is the same board flat.

**The written posts already exist and are not duplicated here.** Each board is the picture for a post
in `content/`, all five of which carry their own copy, alternate hooks, cut lines and fact-check
logs. This file records only what is specific to the boards.

## Register

Friendly neighbourhood, information-first — the register the content set established. Every board
gives something away before it asks for anything, and board 1 gives away the work itself. That is
deliberate and it is the strongest position Sixfold has: a homeowner who clears their own Zone 1 and
then looks at the juniper line at twenty feet is a better conversation than one who was sold at.

**Sixfold is not Surge.** The Surge voice specs and `brand/notes/RESTRICTED.md` do not govern this.
What carries across is the research standard and the no-publishing rule.

## What is deliberately absent from all four

- **No prices, no rates, no quote.** Pricing is being rebuilt after the Sedalia job came in under
  cost; no figure from the old card belongs on a public graphic.
- **"Licensed and insured" appears nowhere**, in any wording. There is no general liability and no
  workers comp.
- **No county cost-share named**, including Douglas County — hard rule until Sixfold is on the
  approved contractor list.
- **No promise about a premium or a score.** Board 3 says in print that the statute entitles a
  homeowner to a re-score, not to a better one.
- **No "we handle the paperwork for you."** Boards 2 and 3 both state where Sixfold stops.
- **No service-area claim.** The four rate sheets still disagree about the region after the Monument
  move; the boards say "Monument, CO" and nothing more.
- **No domain.** `SixfoldColorado.com` resolves to nothing, so it is not printed — same call as the
  pamphlet.
- **No before-and-after imagery.** There is none that is a real Sixfold job.
- **No aeration.** Which kind is still not established.

## Four numbers that were checked and left off

1. **"90% of homes lost in wildfires ignite from embers."** The most-repeated statistic in this
   trade. Not traceable to a source that survives checking. Board 1 describes the mechanism with no
   number attached.
2. **"Clearing five feet cuts your risk in half."** How IBHS headlined its own study, and looser than
   the finding underneath. The board prints the actual comparison — 78%, against nearly twice the
   rate — rather than a promise about one specific house.
3. **"Only cut October to April."** Returned confidently by search, reads as CSFS guidance, and is
   **not in either beetle fact sheet**. Board 4 says so in print and argues the same seasonal point
   from published flight periods instead.
4. **The $3,200–$6,100 one-acre defensible space benchmark.** Real and CSFS-sourced, but publishing a
   job cost before Sixfold has priced ten real jobs invites a quote it may not honour.

## Two source conflicts, and which way they were resolved

- **The 2027 tax credit.** The Department of Revenue's guidance page still shows 2027 at $1,000 with
  a "TBD" income limit, and the bill's own fiscal note says the credit "may be carried forward for
  five years." **The enacted act says $2,000, a $300,000 AGI limit, and that excess may not be
  carried forward and is refunded.** Board 2 follows the statute and says on the board that it does.
- **Zone 0 against Zone 1.** Most articles on the first five feet use California's "Zone 0". Colorado
  numbers the same ground **Zone 1**, and board 1 uses Colorado's numbering with a footnote, because
  the imported vocabulary is what makes a post feel imported in a Colorado group.

## Build notes

- **Palette is the agreed five** from `sixfold/README.md`. Type is the site's own stack — a serif
  for headlines, system sans for body, Consolas for labels — and **no webfont**, so nothing about
  the render depends on the network.
- **The mark is the revised Ridge** (tree and roots, `viewBox="0 0 100 116"`), inlined from
  `brand/sixfold-mark-ridge-mono.svg`. Note that eleven copies of the **pre-revision** mark are still
  inlined across `marketing/` and `content/`; these boards are not among them.
- **Ember and moss are never used as two data series.** As a pair they fail CVD separation — deutan
  ΔE 7.9 on the dark ground, protan 6.6 on light, which is the classic orange-against-green
  confusion. Checked with the palette validator rather than by eye. Where a board needs two series
  (board 4) it uses **one hue in two steps plus direct row labels**; moss is ground and framing only.
  The de-emphasis greys `#7C8880` (dark) and `#5F6A61` (light) were picked the same way.
- **Board 1's scale is linear and honest.** The 0–5 ft strip is half the rail because it is half the
  distance. The 30 ft callout is an arrow off the edge with its distance written on it, not a
  squeezed axis.
- **Rebuild:** the boards are the `.html` files; the PDFs and PNGs are exports. Render with headless
  Chrome — emulate **print** media for the proof as well as the PDF, so what gets checked is what
  gets printed, and check `scrollHeight − clientHeight` on `.board` is 0 before trusting a render.
  Board 2 took four passes to fit.
- **Do not round-trip these through PowerShell `Get-Content -Raw`** — the em-dashes and `·` will
  double-encode. `CLAUDE.md`, environment traps.

## Before any of this goes out

1. **There is still no account to post from.** The platform sheet is the blocker, not the artwork —
   and the linktree and Nextdoor page that *do* exist are recorded in `brand/qr/README.md`.
2. **Board 2's 2026 income limit is genuinely unpublished.** The board does not state one for 2026,
   which is correct. If a neighbour asks, the honest answer is that it has not been announced.
3. **Board 2 says "AGI up to $300k".** That is the statute's own word. Whether "adjusted gross
   income" there means *federal* AGI is an open question worth an accountant's read — it is a
   different number for some filers.
