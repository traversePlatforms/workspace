# Sixfold Quote Build — the auto-quoting app

**Built:** 2026-09-14 · **Status:** internal tool, draft-only. Nothing it produces has been sent.
**Live:** https://claude.ai/code/artifact/31b44b1b-38e8-4a19-8938-e1279c71883a
**Source:** [quote-engine.artifact.html](quote-engine.artifact.html) — hand-written, single file, no build step.

---

> ## RESUME HERE — repriced 2026-09-23, four things still open
>
> **Brandon and Brad's prices are in.** Source and full reconciliation:
> [rates-brandon-brad-2026-09-23.md](rates-brandon-brad-2026-09-23.md). **Rates v3.** The artifact has
> NOT been republished — the file is ahead of the published version.
>
> **The headline: the billable rate is now $100/man-hour, up from $70.** Matthew confirmed it is a
> man-hour, not a crew-hour. That is $200/hr for a two-person crew against Hawk's published $115–$143 in
> Colorado Springs, so Sixfold is now ~40% above the top of the only published rate in its own market,
> deliberately. A flag says so on every quote.
>
> | | |
> |---|---|
> | Job 2 calibration | **16.82 h predicted vs 16 recorded** — drift 0.82 h, still inside the 1 h threshold |
> | Job 2 price | **$1,700 → $2,250.** They actually charged $1,500. Worth his eye before this prices anything |
> | Their one-tree job | Engine returns **$550**; they said $450 cost-up, $600 to match market |
>
> ### ⚑ 2026-09-30 — the t30 source figure is contradicted, and the tool may be half
>
> **Matthew, 2026-09-30:** *"the metric was a 30 ft tree in about 30-35 minutes with 2 people."*
>
> The engine records the same line as **"complete fell, 15 minutes", two people → 30 man-min**.
> **The units conversion was right** (15 elapsed × 2 crew = 30 man-min); it is the underlying
> figure that disagrees. 30–35 elapsed × 2 crew is **60–70 man-minutes** — double what `t30` holds.
>
> | | man-min | at $100/man-hour |
> |---|---|---|
> | `t30` as the tool has it | 30 | **$50** a tree |
> | 30–35 min with two crew | **60–70** | **$100–$117** a tree |
>
> **⚑ Do not just double it — the scope question comes first, and it is the whole thing:**
> **does 30–35 minutes mean the tree is on the ground, or the tree is dealt with?** The engine
> bills **limbing separately at 28 man-min a tree**. If that figure already covers limbing and
> dragging to the pile, doubling `t30` *and* keeping the limb line bills the same work twice. If
> it is felling only, then "complete fell, 15 minutes" was optimistic and 60–70 is the number.
>
> **What it fixes, if 60–70 is right and the scope matches:**
> - **Open item 3 dissolves.** `sap` stays 30 and `t30` becomes about 65, so the sapling and the
>   small tree stop costing the same. No timing needed after all.
> - **Open item 2 gets much smaller.** The band jump goes from 30→330 (elevenfold) to about
>   65→330 (fivefold) — a plausible step for a genuinely bigger tree rather than a cliff.
> - **`htPerFt` moves 1.0 → about 2.0–2.33 man-min/ft**, taking the 4× contradiction against the
>   sapling line at 7 ft with it.
>
> **Nothing was changed in the engine.** It is a reprice, it needs the `config/rates-vN` bump,
> and the scope question is unresolved. **Meanwhile every tree under 30 ft quoted from the live
> tool may be priced at half its labour** — worth checking whether any went out.
>
> **Still open, and all four are Brandon's or Brad's call, not mine:**
>
> 1. **Limbing contradicts itself.** $600 for 13 trees now; $975 for the same 13 before, and Hawk's $75
>    floor × 13 corroborated that exactly. The newer figure is in, with the contradiction on the page.
> 2. **The tree bands do not line up.** Under 30 ft is their 30 man-min; 30–60 ft is still Wexford's 330
>    — an elevenfold jump across the band line. They gave nothing above 30 ft.
> 3. **Sapling and small-tree rates are now identical** at 30 man-min. A 10 ft sapling and a full 30 ft
>    tree cannot really cost the same; one of the two wants a real timing. **This is also what the
>    per-foot height model collides with** — it prices a 7 ft tree at 7 man-min against the sapling
>    line's 30. Timing one small tree settles both at once, and it is the single most useful
>    measurement anyone could take right now.
> 4. **Aeration has no Sixfold rate at all** — and it now leads Sixfold's positioning. The only figure is
>    Bryce's competitor price ($1,100–$1,400 for ¾ acre), which sits in the market check, never the price.
>    **Updated 2026-09-25: there is now a second anchor, and it is still not a rate.** Sixfold's own first
>    charged aeration price is **$1,100 for ¾ acre** — Kara, `agreements/kara-aeration-agreement`. Both
>    anchors land on **$1,467/acre**, which looks like agreement and is not: **Bryce's covers aeration
>    alone, Sixfold's has 200 lb of seed and 150 lb of fertilizer inside it.** Against the market check the
>    materials are being given away. A **Seed and fertilizer** cost line was added the same day so the two
>    can be separated; it deliberately ships with **no preset**, because no receipt has been put against it.
>    At $100/man-hour with two crew, every $200 of materials is an hour off the site time that $1,100 buys.
>
> **Also unresolved: fuel.** They put $20 of trailer gas inside their tree price. The engine still refuses
> to bill fuel, because the man-hour rate's overhead already carries it and billing it twice is the error.
> Reversing that is a decision, not a rate change, so it was left alone and flagged.
>
> ### What changed in the file, 2026-09-23
>
> - **Rates:** billable $70 → **$100**; tree under 30 ft 150 → **30**; limbing 20 → **28**; mow 150 →
>   **120**/acre; edge 60 → **40**/acre; plant removal 12 → **10**.
> - **Retired:** stump grinding (both lines) and planting, on "no stump grinding" and "not planting".
>   Marked *Not offered* rather than deleted, so the decision is visible and reversible. The 811 locate
>   warning went with them.
> - **New:** a **consumables** cost line (one chain $20); **dump presets** by what is in the trailer
>   (7×14 wood-heavy $269, mostly brush $110, one tree's share $125) because tipping is charged by weight;
>   **hire presets** (chipper $320/24h); a **trailer selector** driving a **haul floor** of $150 small /
>   $300 large per load; an **aeration** line carrying no Sixfold rate.
>
> ### Added 2026-09-25 — off the Kara aeration job
>
> - A **Seed and fertilizer** cost line (`turf`), billed, **no preset by design**. The engine had no
>   turf-materials slot at all, so the bags had nowhere to go but "anything else bought".
> - The **aeration line now carries both anchors** and says plainly that only one of them is aeration
>   alone. Its flag tells you what to capture to close the gap: time the pass, and put the bag receipts
>   through the new cost line.
> - **Matthew, 2026-09-25: Kara's number is the gauge.** *"Right now the aeration rate is just what we
>   have for Kara, that will be our value to gauge against for now. After this job is done we will have
>   a better idea about the actual cost of everything so we can have a better guess."* So the engine
>   quotes aeration against $1,100/¾ acre until that job closes out, and the close-out is what replaces
>   it. **Two measurements make the swap possible and only exist on the day: how long the pass takes,
>   and what the seed and fertilizer actually cost.** Without them the next guess is the same guess.
> - **No rates-version bump, and that is deliberate.** The rule is to bump `config/rates-vN` on a
>   *reprice*, so stale saved figures cannot win. **No existing rate changed here.** The snapshot handler
>   only applies saved keys where `rates[k] != null`, so a team member holding saved v3 state simply gains
>   the new line at its default rather than having their own figures reset. Bumping would have cost them
>   their customisations for nothing.
> - **REPUBLISHED 2026-09-25 — version 7**, to the same URL. The artifact had been behind this file
>   since the v3 reprice on 2026-09-23.
>   **⚑ What that release actually does to the team:** the live tool was still on `config/rates-v2`
>   at **$70/man-hour**, so every quote built in it since the 23rd used the old rate. Version 7 moves
>   the shared key to `rates-v3` and **$100/man-hour**. Any rate edits a teammate had saved under v2
>   are left behind — which is the point of a reprice, but it means **a price quoted from the tool
>   before today is 43% low on labour** and worth re-checking if one went out.
> - **Trees by height** — a line that takes `7, 12, 25` (or `4x7`) and prices each tree from the 30 ft
>   anchor. Model is `base + per-foot`, both editable, defaulting to **0 base + 1.00 man-min/ft** (their
>   30 min ÷ 30 ft). **Hard-stops at 30 ft** — 1 min/ft extrapolated gives a 70 ft tree 70 man-minutes
>   against the 570 on the books, an eight-fold underquote on the most dangerous work. Over-cap trees are
>   listed in amber, kept out of the price and flagged to the banded lines. Sits *beside* `sap`/`t30`, not
>   instead of them, because job 2's calibration and every saved job use those ids.
> - **A fifth badge, *Priced*** — Brandon and Brad's own price for one named line, divided by their own
>   $100/man-hour. It exists because *Allocated* means Matthew's share-out of job 2's 16 hours, and these
>   are not that. Five lines carry it.
> - **Two persistence keys bumped** — `config/rates-v2` → **`-v3`** and the local draft to **`-v3`**.
>   Without this the stored table wins over the file and the whole team keeps quoting the old prices.
> - An **8×14 trailer of rounds is deliberately unpriced.** "A lot more than that" is not a figure.
> - Fixed a pre-existing bug: `.notice{display:flex}` beat the `hidden` attribute, so the empty resume
>   bar rendered as a stray box on every load.
>
> ---
>
> ## The 2026-09-16 ruling — still stands
>
> Built, published and working. Four rounds of his review already; **don't rebuild any of it without
> asking.** The one open question was ruled on 2026-09-16:
>
> **The Sixfold badge is split into *Recorded* and *Allocated*.** Matthew chose that over leaving it alone
> or demoting haul loads to Unbacked. *Recorded* = Brandon wrote the figure down for that line (cash costs,
> the 16-hour total, handling, rounding, free hours). *Allocated* = the nine time rates, which are that
> 16-hour total shared out across the lines by Matthew — the total is his, the split is not. Same green,
> dashed border. A tick still upgrades a line to *Recorded ✓*. Haul loads at 110 man-min stays Allocated
> because its cash side has a receipt; it is the time side that is soft, and "Allocated" says exactly that.
>
> ### Hosting — settled 2026-09-14: it stays an artifact, as a proof of concept
>
> *"Just leave it as is for now… for right now I can just use it as a proof of concept."* **Do not start
> porting it.** What was established, so it is not worked out again:
>
> - **Declaring `db` makes an artifact organisation-internal.** It cannot be shared publicly, and every
>   viewer must be signed in to Matthew's Claude org — **no Claude account, no access.** His eventual goal
>   ("accessible to everyone on the team regardless of who has claude") cannot be met on this platform.
> - **The hosted version needs no backend.** He updates prices, the team consumes them — so the rate table
>   lives in the file. Redeploy, same URL, nothing re-sent.
> - **The trap:** rates persist in the browser today, so a returning user would keep their stored table and
>   never see the update. **Version-stamp the table, discard older stored copies, and print the version and
>   date on the page.**
> - **Split the views first** — the crew should not be looking at margin, break-even and cost floor.
> - **Cloudflare Pages**, limits already verified in `../../matthew/hosting-setup.md`. Cloudflare Access for
>   an email login — "free up to 50 users" is from their product page and **was not confirmed first-party**.

Type counts in — *5 trees, 1.5 loads, ¾ acre* — and it produces a price. It is the desk-side counterpart
to [../operations/quote-walk-sheet.md](../operations/quote-walk-sheet.md): **the walk sheet captures, this
prices.** They stay separate deliberately, because the sheet carries no prices and never goes to a
property with one on it.

---

## What it does, and what it refuses to do

**It does not use the rate card.** `../marketing/pricing-guide.md` would have quoted job 2 at $1,038
against ~$1,450 of real cost. The engine is the cost-up model Matthew ruled for on 2026-09-14:

```
price = man-hours × $70                        (SynkedUP startup band, first-party, 11 Aug 2026)
      + (dump + hire + purchases) × 1.15       (job-direct costs at cost + 15% handling)
      rounded DOWN to the nearest $50
```

**Truck fuel is not a line and the app will not make it one** — the man-hour rate's overhead already
carries vehicle and fuel. It is entered as a cost, counted against margin, and shown as *not billed*.

### The problem it had to solve, stated plainly

**Nothing in this repo says how long a tree takes.** "5 trees → a price" needs a minutes-per-unit table
that does not exist, and inventing one is the failure this project has already been burned by twice. So
every rate carries its provenance **on screen, next to the number**, in three states:

**The axis is whose number it is** — changed 2026-09-14 on Matthew's instruction, from a reliability
scale (sourced / fitted / guess) to an origin one:

| Badge | Means |
|---|---|
| **Recorded** | Brandon's own figure for that line: all recorded job costs, the handling percentage, the rounding, the free hours, the 16-hour total. A tick on any other line makes it **Recorded ✓** — Brandon confirmed it outright |
| **Allocated** | *(split from Recorded 2026-09-16)* The nine time rates — mobilisation, saplings, limbing, haul loads, mow, edge, plant removal, planting, blow-down. Brandon's recorded 16 man-hours on job 2 shared out across the lines by Matthew so the table reproduces the total. **The total is a measurement; the per-line share is not.** One job, one crew, one property — a starting point, replaced line by line as real jobs are timed |
| **Competitor** | Taken from outside the company, never from Sixfold: the $70/man-hour billable (SynkedUP), and the $28/hr crew + $20/man-hour overhead (ArboStar). All three stand in for figures Sixfold does not have |
| **Unbacked** | Nothing behind it. Lines job 2 never exercised — big timber, stumps, chipping, slash, bucking, rigging |

**One caveat carried on the page itself:** those Competitor figures are *trade cost models*, not a
competitor's price list. They are fine internally, but they are not evidence of what another firm charges
— which is the same objection `pricing-guide.md` already records against Brandon's unsourced
"market value $3,700" column. The sources card says so in as many words.

Tapping a badge marks it **Recorded ✓** (confirmed by Brandon), and that is shared to every device through the
artifact's `db`, so confirming a rate once confirms it for the crew. A quote that leans on an
**Unbacked** rate says so in a flag, on screen and in the exported draft.

### The calibration, which is the part worth keeping

Job 2 is the **only job on file with recorded man-hours** — 2 people × 1 day = 16. The app re-runs that
scope through the live rate table on every keystroke and prints the result against the 16.

| Job 2 scope, as recorded | Predicted |
|---|---|
| Mobilisation ×1 · 5 trees under 30ft · 13 limbed · 9 plants pulled · 0.75 acre mown · 0.75 acre edged · blow-down · 1.5 loads | **16.01 h** |
| Brandon recorded | 16 h |

Change any rate and the verdict re-checks. Drift past an hour and it says so in as many words: *either the
rate is wrong or job 2 was not typical — decide which, don't leave it.*

**The whole build reconciles to the repo:** load job 2's numbers and the app returns **$1,700**, the exact
cost-up figure in [walk-2026-09-14-job2.md](walk-2026-09-14-job2.md) §8, with Brandon's **$1,900** sitting
in the override.

### What persists, and what does not — changed 2026-09-14 on Matthew's ask

**It opens on a blank job, not on the last one.** The first build opened pre-loaded with job 2, which meant
landing on a named property with a price already on it. Now:

| | Where it lives | Survives |
|---|---|---|
| **The rate table** — every time rate, the badges, $70 billable, 15% handling, crew cost, overhead, rounding | `db`, doc `config/rates` | Every device, every session. Edit a rate on a phone and the desk has it |
| **An unfinished job** | `localStorage`, this browser | **Offered, never restored.** A line at the top says what was left unfinished and when — *bring it back* or *discard it* |
| **A finished job** | `db`, collection `jobs` | Saved by name, reopened from the list |

**Nothing loads a job on its own.** The first fix still restored the local draft automatically — and the
draft on Matthew's machine had been auto-saved *while job 2 was pre-loaded*, so it looked identical to the
bug it was meant to fix. The draft key was bumped to `-v2` (the v1 drafts are dropped, not migrated),
a draft now has to contain something actually typed to count as one, and it is **offered on a bar at the
top rather than applied**.

The standing rates apply **once, on open**, so a job you have loaded is never stomped by someone else's
later edit. The two job-specific settings — free man-hours and the man-hours override — belong to the job
in front of you and are deliberately not written back to the shared table. Job 2 is one tap away from the
calibration card whenever it is wanted.

### Brandon's price wins, and the app is built for that

He prices by instinct and drafts his own customer documents. The override takes his number and recomputes
everything beneath it — net, margin, break-even, and the delta against the build. Job 2: *$200 above the
build. Extra margin against a day that runs long.*

### What it flags before a price leaves the room

Unbacked rates carrying a count · a tree over 80 ft (call-in, not a quote) · stumps without the Colorado
811 three-day locate planned · **haul-off loads entered with no dump fee** — the line this business has
actually lost money on · landscaping work, which no Sixfold document prices · margin under 15% · an
override below the build.

### Output

- **Scope draft `.md`** — counts, price, the pre-send checklist and a fact-check log, for
  `build.mjs` → `../tools/html-to-pdf.mjs`. **No terms on it. It is not a sendable quote.**
- **Internal `.csv`** — the full build, cost floor, break-even. First cell reads `INTERNAL — DO NOT SEND`,
  and the filename is prefixed `INTERNAL-`.
- **Saved jobs** to the artifact's `db` (collection `jobs`), readable back from a session with `read_db` —
  the same route as the walk form. This is how quoted-vs-actual finally accumulates.

---

## Source re-check, 2026-09-14 — every rate re-read at source

Matthew: *"rewrite it including the real competitor rates. Also just do a double check to make sure all the
rates are accurate and relevant."* Every figure below was fetched first-party on 2026-09-14, not carried
forward from the August pass.

### Confirmed unchanged

| Source | Figure | Date on the page |
|---|---|---|
| **SynkedUP**, Weston Zimmerman | 2026 band $65–$145/man-hour; **lean startup $65–$75**; worked example $71.10 (labour $36 + overhead $24.44, ÷0.85) | Updated **11 Aug 2026** |
| **Hawk Tree Service**, Colorado Springs — removal | Under 30 ft $150–$500 · 30–60 $500–$1,000 · 60+ $1,000–$2,000+ · 80+ up to $4,000 · labour $65–$140/hr · per acre $733–$2,333 and $3,395–$6,155 | Published **12 Oct 2025** |
| **Hawk** — trimming | $200–$600 typical · under 30 ft **$75–$415** · 30–60 $215–$790 · 60+ $475–$1,800 · **two-person crew $115–$143/hr** | Published **9 Mar 2026** |
| **A Stump Man**, Denver suburbs | $5.00–$9.00 per diameter inch, grinding only | Still published; page itself undated |
| **Wexford / TreeGuard**, Nate Jones | Removal **2.0–3.5 / 4.0–7.0 / 7.0–12.0 / 12.0–24.0**; $190/crew-hour required rate; industry $90–$200/crew-hour; chipper $40–$70, grinder $50–$90, chip truck $50–$80; stump flat rates $75/$125/$200/$325/$475 | Published **6 May 2026** |

### Four corrections, and they are not cosmetic

**1 — Wexford's removal figures are MAN-hours, not crew-hours.** The source table is headed *"Man-Hours
Required"*. [../marketing/pricing-guide.md](../marketing/pricing-guide.md) §Sheet C records them as
*"4.0–7.0 crew-hours for a 30–50 ft tree"* and reasons from that. **Reading them as crew-hours doubles
every one**, and that reasoning is what the $120/hr crew rate was sanity-checked against. Not corrected in
that file — see the standing rule about not rewriting a record of what happened.

**2 — The tree band was too wide, and the rate was fitted off the bottom of it.** The app had one line,
*under 30 ft*, at 30 man-minutes — fitted to job 2, where Brandon's five trees are annotated **"under
10 feet"**. Wexford puts a genuine sub-30 ft removal at **2.0–3.5 man-hours**. Those are not the same job
by a factor of five. **The band is now split:** *saplings under 10 ft* keeps the 30-minute Sixfold figure,
and a new *10 to 30 ft* line carries Wexford's 150. The 30–60 and 60–80 lines move from invented guesses
(90 and 180) to **330 and 570**. A flag fires if four or more saplings are entered with nothing on the
line above.

**3 — Sixfold's billable rate is at the local ceiling, not under it.** $70/man-hour is **$140 for a
two-person crew**, against Hawk's published **$115–$143** in Colorado Springs. The cost-up rate was set
from a national cost model and nobody checked it against the one published crew rate in Sixfold's own
market. It is not undercutting anything. A flag fires above $71.50.

**4 — Hawk grinds stumps at $2–$5 an inch in Colorado Springs**, against A Stump Man's $5–$9 in Littleton,
Flatirons' $9 in Boulder and the $7–$9 four-state cluster. **The home market is the cheapest published in
the state** — and since the move to Monument, El Paso County *is* the home market. The rate card's §3
prices against Denver metro at $4.75–$8.55, which is above what the local competitor publishes.

### The caveat that inverted, and nobody noticed

`pricing-guide.md` §11 flags Hawk as *"Colorado Springs rather than Denver metro — a real caveat."* That
was written on 2026-08-24, while Sixfold was in **Englewood**. The company moved to **Monument on
2026-08-25 — the following day.** Hawk went from the worst-matched anchor on the sheet to the best-matched
one, and every figure keyed to Denver metro is now the one carrying the caveat.

### Still unbacked after the re-check

**Chipping** — checked again, no Colorado operator publishes a rate; the two figures found ("at least $70
an hour", "upwards of $200 an hour") are out-of-state, unattributed and contradict each other, so under the
research standard neither is used. **Stump grinding time** — published *prices* exist everywhere, published
*times* nowhere. **Rigging, bucking, slash piling, dead fall, brush.** These keep the UNBACKED badge.

### The market check, and why it is built the way it is

The app now carries a **Market check** panel: the same scope priced at the **low end of every published
Colorado Springs rate**, with Sixfold's own side of *only those same lines* beside it. Two rules make it
honest — it uses the bottom of every band, so it understates the comparison; and it compares like with
like rather than setting a whole job price against one line's market value, which is how a bogus saving
gets manufactured. It names every line it cannot cover.

**On job 2 it corroborates Brandon.** His unsourced quote column put *"Limb 13 trees — $975 typical"*.
Hawk publishes $75 as the floor for trimming a tree under 30 ft; **13 × $75 = $975, exactly.** That is the
first independent support for any figure in that column. The rest of it — mowing $200, edging $125, plant
removal $200, planting $450, haul $750 — still has nothing behind it.

## Fact-check log

| Figure in the app | Status |
|---|---|
| **$70/man-hour billable** | **Competitor.** SynkedUP, *Landscaping Cost Per Hour*, Weston Zimmerman, 11 Aug 2026 — 2026 startup band $65–$75, worked example $71.10. A trade cost model; **not evidence of what a competitor charges** |
| **15% handling, round down to $50** | **Sixfold**, carried from the job-2 build where both were used |
| Time rates marked **Allocated** | Allocated across job 2's recorded scope to total its recorded 16 man-hours. Defensible as a starting point, worthless as a measurement — **the allocation between lines is mine, not Brandon's**, and the tick is what distinguishes one he has confirmed himself |
| Time rates marked **Unbacked** | **Nothing backs them.** Shown as such, flagged when used, and they must be confirmed before they carry a quote |
| **$28/hr loaded crew, $20/man-hour overhead** | **Competitor.** ArboStar via the rate card, standing in. Sixfold's real loaded pay and own overhead remain the biggest unknown in the whole model — §10 of the job-2 sheet still lists them as outstanding |
| Job 2 reproduces at **$1,700** | **Verified by recomputation** against walk-2026-09-14-job2.md §8 |

### One discrepancy, left visible rather than tuned out

The job-2 sheet states net **$394 (20.7%)** and break-even **23.8 man-hours** at $1,900. The app, run on
the inputs that sheet names ($28 + $20 = $48/man-hour), returns **$457 (24.0%)** and **25.5 man-hours**.
Back-solving the sheet's own two data points ($1,700 → 19.8 h, $1,900 → 23.8 h) implies a combined
**$50/man-hour** and $710 of fixed cost, which is not the $48 the sheet states. **Roughly $60 of the
margin is unexplained.** It is small, it does not move any decision, and both figures rest on the same
placeholder pay rate — but it is not reconciled, so it is written down rather than quietly matched.

### Open

- **Brandon confirming the Guess rates**, one at a time. Until then the app is honest but half-armed.
- **Sixfold's real loaded crew cost and own overhead per man-hour.** Everything downstream of margin is
  provisional without them.
- **Timing a real job by line** — the first crew that records *"limbing took us 3 hours"* turns the whole
  Fitted column from an allocation into a measurement.
- **Recurring maintenance.** Brandon's plan note says "set monthly recurring" and the app prices one-off
  jobs only. The mow rate exists here; a monthly rate does not, and the lawn-care sources are all farms.
