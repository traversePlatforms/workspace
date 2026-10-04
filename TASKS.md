# Matthew — the working register

**Opened 2026-09-29** from a brain dump. Not a plan, a **place to put things** so they stop
living in a notes app. Ordered inside each lane by what unblocks the most, not by urgency.

**How to use it:** each item has an ID. Say *"let's do SX-2"* and we do that one. Tick the box
when it's done; leave the line in place — a finished item is a record of what was decided.

**Four lanes, kept apart** — see [CLAUDE.md](CLAUDE.md). Nothing here blends them; the
cross-cutting section is admin that happens to touch more than one.

**⚑ Two items in the dump were the same thing** — "content plan and schedule" and "posting
schedule" are merged into X-6. Twenty-seven lines in, twenty-six items out.

---

## ⚑ Read this before X-1 (passwords)

**I won't write passwords into this repo**, and you shouldn't either. It's a git repository
*and* it's mirrored to OneDrive, so a plaintext list becomes two synced copies immediately and
a permanent entry in git history that surviving deletion doesn't remove. That's not caution —
it's that a single file would hold every account for three businesses.

**What actually solves it: a password manager with a shared vault per entity.** Bitwarden's
free tier covers this; 1Password Business if you want proper per-person access control. Either
gives you the thing you're really after — Brandon getting into the Sixfold accounts without you
texting him a password.

**What I can build, and what's genuinely missing: an account inventory with no secrets in it.**
Which accounts exist, which entity owns each, which email it's tied to, who has access, whether
2FA is on, and what the recovery method is. That's the document that makes the migration
possible, and right now nobody could list those accounts from memory. That's X-1 below.

---

## Sixfold

- [x] **SX-1 — Equipment list.** ✅ **Given 2026-09-30:** riding mower, aerator, edger, leaf
      blower, power washer, chain saws, axes, PPE gear, two trucks, two trailers. Recorded in
      `operations/gear-checklist.md`. **Three flags came out of it, all still open** — see SX-1b.
- [ ] **SX-1a — Port the gear checklist into its printable version.** The `.md` and the
      `.src.html` are parallel documents and the designed one has been stale since 2026-09-25:
      **the 7-page PDF has never mentioned the aerator or the riding mower**, and it still lists
      a stump grinder. It is the crew-facing copy. **Do not hand it out until this is done.**
- [ ] **SX-1b — Three questions the inventory raised**, none of them cosmetic:
      **(1)** ✅ **Answered 2026-09-30: the chipper and grinder are RENTED, not owned.** The
      service list stands; the ownership claim in the gear checklist was false. **What is left is
      the pricing half:** every chipping or stump-grinding quote must carry the rental, fuel and
      collection trip as line costs. **Check the quote engine cannot price either service without
      them** — rentals are precisely what job 2 proved the old rate card was missing.
      **✅ Checked 2026-10-01, and the answer is half good.** The engine *has* the line —
      `hire`, "Equipment hire", billed, tagged `all`, with a **Chipper, 24 h · $320** preset
      sitting right there. **But nothing forces it.** Tick *Chipper feeding* with hire at zero
      and the quote prices out silently, carrying the labour and none of the machine. **What is
      left is a guard**, not a new line: chipping on the sheet with no hire recorded should
      refuse to price, the way the $0 bug now does.
      **(2) What is in “PPE gear”?** The checklist prices PPE per person against named standards.
      With no workers’ comp and no general liability on file, the PPE is the whole protection.
      **▶ In motion 2026-10-01 — Matthew is asking Brandon and Brad what they actually have.**
      **Ask for counts and sizes, not categories** — “we have hard hats” is not an answer the
      checklist can price or a crew can rely on.
      **⏰ REMIND HIM 2026-10-03 to hand over what he has got back.**
      **(3) ✅ Snow, partly answered 2026-10-01. Shovels ARE owned** — the inventory was wrong.
      **A snow blower is believed to be coming from Brandon but Matthew is not certain and
      nobody has confirmed it — unconfirmed until Brandon says so.** His call: the gear will be
      in place by the time that part of Kara’s contract has to be fulfilled.
      **⚑ Still not owned and not covered by either: a spreader, and salt or ice melt.** Five
      visits a month across a winter is not a shovel job. **Work back from November 2026** — if
      the blower is unconfirmed by late October there is still time to rent or subcontract;
      there is not time in December.
      Plus the numbers pricing needs: aerator tine spec and type, mower deck width, trailer
      capacity. And no overseeder is recorded, though 200 lb of seed goes down on 12 October.

- [ ] **SX-2 — Finalise the quote program** as far as the information allows. **Now artifact
      version 11, rates v4** (reconciled 2026-10-01) — not v7. Since this line was written: the
      `t30` reprice to 65 man-min, the job-type split, the silent $0 that split introduced, and
      a provenance audit that added a sixth **Timed** badge and moved `dump` and the drive blow
      to `all`. Changelog: [quote-engine.md](sixfold/quotes/quote-engine.md).
      **✅ THE PRICING REFERENCE SET IS SETTLED — Matthew, 2026-10-01**, and it corrects a
      conflation that had been sitting in the file:
      **⚑ There are TWO different $2,250s.** One is the engine’s repriced output for job 2
      (whose real price was $1,500). The other is the **Sedalia** pack’s Option A quote, to a
      **different customer**. They are a coincidence, and treating them as one number is what
      made “the gap has never been resolved” look like a mystery.
      **The references, in his order of authority:**
      • **$1,500 — Kara, tree removal + planting. The PRIMARY one**: the most recent
      **completed** job, so price from it first.
      • **$1,100 — Kara, aeration.** The aeration anchor.
      • **$250/mo — Kara**: mowing, edging, spot treatment, snow removal, aeration revisit. The
      recurring/maintenance anchor.
      • **$2,250 — Sedalia (Shannon). A WARNING, NOT A TARGET** — *“grossly under estimated …
      under priced”*, the work could not be finished, only the $1,125 half was paid. It is
      evidence to price **above** $2,250, not at it.
      **None of this moves a rate** — $100/man-hour and rates v4 stand. It changes what the
      engine gets sanity-checked against. **Cheap to apply: the figures live in
      `quote-engine.md` only, not in the artifact or the live site copy.** Partly blocked by
      SX-1.
- [x] **SX-2a — Put the quote engine on the site, beside the doors app.** ✅ **LIVE 2026-09-30**,
      uploaded and confirmed on the host 2026-10-01. `/summit-de59ae83/` asks for a code, then
      offers **Door rounds** (everyone) or **Quote build** (admins). `api/quote.php`,
      `summit-de59ae83/quote.html`, generated by `build-quote-page.mjs`.
      **Two of the three decisions were taken in the build. (1) Data outside the web root —
      done:** `quote.php` writes to `sixfold-data/quote/`, beside the door JSON. **(3) Admin
      only — done, and as a role not a code:** checked twice, the tile is not rendered for crew
      *and* `quote.php` returns 403, because a crew sign-in produces a valid session so hiding
      the button alone would protect nothing. Brad becomes admin by one line in
      `rounds-codes.php` — which also gives him the doors admin view.
      **⚑ Decision (2), retire the artifact, was NOT taken — carried out to SX-2b.**
      **The cache bit on upload:** both files were correct and the chooser still did not appear,
      because the plain URL served the previous day’s `index.html`. Flush first, then compare
      plain against busted — [DEPLOY-ROUNDS.md](sixfold/site/summit-de59ae83/DEPLOY-ROUNDS.md).
      **The original line, kept because the reasoning is the record** — Matthew’s idea
      2026-09-30: `/summit-de59ae83/` asks for a code, then offers **Doors** or **Quote**.
      **The argument is already on record** — doors moved to the site because the Claude artifact
      “needs a Claude seat per crew member, so it is your view, not theirs”. That is truer of a
      quote, which gets built at a kitchen table by whoever is standing there.
      **Smaller than it looks:** the engine is 1,271 lines but touches storage in exactly two
      places — `config/rates-v3` and the `jobs` collection. A small `api/quote.php` on the session
      cookie the doors app already issues replaces both. The CSV export drops the artifact
      `downloads` capability for an ordinary link, which works better. **None of the pricing logic
      changes.**
      **⚑ Three decisions first. (1)** This puts the cost model and saved customer quotes on a
      shared host behind a 6-digit code — heavier than door addresses. Keep the data outside the
      web root the way the door JSON turned out to be. **(2) Retire the artifact rather than run
      both** — the version trap already bit once, when the live tool sat on v2 at $70/man-hour
      while the file said v3 at $100 and every quote in between was 43% low on labour. **(3) Can a
      crew code edit rates, or only build quotes?** The rounds app already separates admin from
      crew.

- [x] **SX-2b — ✅ DECIDED AND DONE 2026-10-03: the artifact is retired.** Matthew left the call to me. Its
      database held ONE saved job (Kara, 15 Sep, $350 on the old $70 rate) and nothing since — the
      door app's quote page is the copy in use. The artifact now shows a "retired, use the door app"
      notice with that job's figures; its database is kept. One source
      (`quote-engine.artifact.html`), one live copy (`quote.html`). A reprice is edit → `node
      sixfold/site/build-quote-page.mjs` → upload → flush, and **`make-bundle.mjs` now refuses to
      build if quote.html is stale** (`build-quote-page.mjs --check`, proven both ways).
      *Original note:* **Three copies of the quote engine can now drift.** Split out of SX-2a
      2026-10-01, because the decision that line called for — *retire the artifact rather than
      run both* — was not taken, and the build added a third copy rather than a second: the
      **artifact** (version 11), **`quote-engine.artifact.html`** as its source, and the
      generated **`summit-de59ae83/quote.html`** on the live host. They are in step today. The
      version trap has already bitten once, when the live tool sat on v2 at $70/man-hour while
      the file said v3 at $100 and every quote built in between was 43% low on labour.
      **A reprice is now four steps, not one:** edit the artifact source → publish → `node
      sixfold/site/build-quote-page.mjs` → upload `quote.html` and flush the cache.
      **The decision is still the decision.** Retiring the artifact leaves one source and one
      live copy. Keeping both means the four steps have to run every time, by someone who
      remembers all four.

- [ ] **SX-12 — Sedalia (Shannon and Lonnie): unfinished, and the return is a GOODWILL
      arrangement with no date and nothing in writing.** Surfaced 2026-10-01 while correcting
      the pricing references — **it was on nobody’s list.**
      **What happened.** Quoted **$2,250** to haul everything away. In the field it became too
      expensive and there was too much material, so the crew **chipped some on the property
      instead** and could not finish. **Only the $1,125 half has been paid.**
      **⚑ Brandon met Lonnie on the property and Lonnie is letting Sixfold come back later** —
      deliberately giving them room to take other jobs first and build up income for equipment
      and staff. **That is generosity, not a contract.**
      *Provenance: Matthew’s account of Brandon’s account — he was not there and said so.*
      **What this needs, cheapest first:**
      **(1) ▶ ASSIGNED 2026-10-01 — Brandon is writing down what he and Lonnie agreed and
      signing off on it.** Matthew's call, and the right owner: Brandon was the one on the
      property. **Not ticked until the document exists** — an intention to write something
      down protects nothing.
      **Three things it has to say, or it is just a note:** what work is outstanding, roughly
      **when** Sixfold returns, and what is still owed. A date or even a month beats “later”.
      **(2) A date, or at least a month.** Open-ended goodwill has a half-life. It survives
      Brandon; it may not survive Lonnie moving, or a winter passing with no contact.
      **(3) What is left, in hours**, against the cost-up engine at $100/man-hour — not against
      the original quote, which is the number that already failed.
      **(4) Does the paperwork match what was delivered?** Option A was *hauled away*; chips
      were left on her property. **Billing the Option A balance for an Option B outcome is a
      dispute waiting to happen**, and the chips are a deliverable she never agreed to.
      **⚑ Nothing in `sixfold/quotes/` carries either name** — every document says only
      “Sedalia”. Shannon and Lonnie confirmed by Matthew 2026-10-01.

- [x] **SX-3 — ✅ LIVE 2026-10-03, verified. Was: rides with the upload (`quote.html` + `index.html`).** Fire jobs
      in Quote build show the tax-credit ceiling for the price, the county's grant position and the
      insurance rules, with say / don't-say lines, all from `money.json`; the scope draft carries
      them with sources; Quotes to build cards link straight in with address + county. 14 checks.
      *Original:* **SX-3 — Fire-mitigation funding inside the quote generator.** *(Half answered 2026-10-02 by SX-23: the money sheets are on every door card. The quote-build half is still open, and it can reuse `money.json`.)* When a fire quote is
      selected, surface the tax credit / grant / insurer re-score material. **This one is
      genuinely good** — the funding research already exists and currently only lives in a
      pamphlet nobody reads at quote time. Build after SX-2.
- [ ] **SX-3a — Kara: get both agreements signed.** **Drafting is done.** Aeration $1,100
      (5pp) and maintenance $250/mo (6pp), both signed-shape, both with a quote and a DocuSign
      packet. Field map and sending rules in `agreements/kara-docusign-setup.md`.
      **⚑ Two things left. (1) is done.**
      **(1) ✅ DONE 2026-10-01 — Matthew changed out the document and the tags.** The stray
      signature tags on the two Notice of Cancellation pages are dealt with.
      **⚑ One check follows from HOW it was done, and it is the one the setup doc insists on.**
      If the DOCUMENT was swapped rather than a tag simply deleted, **every page shifts by one
      and every existing tag moves with it** — so re-open the envelope and confirm no recipient
      tag has landed on **pages 4 and 5**, because a signature box arriving there is the exact
      fault being fixed. A straight tag delete moves nothing and needs no re-check.
      **Either way she was not emailed**, as long as her name, email and routing order were not
      touched — those are what trigger a fresh notification, not a document change.
      **(2) ✅ DONE 2026-10-01 — Matthew spoke to her on the phone about the cancellation
      policy.** 16 CFR 429.1(e) wants it spoken and it was. **⚑ Write it into the job file with
      the date** — the spoken notice only helps later if there is a record that it happened,
      and right now the only record is this line.
      **(3) The one thing left: her signature.** **Wednesday 7 October** keeps the 12 October
      start. Later is not fatal,
      the job just moves. Download the certificate of completion, not just the signed PDF.
      Maintenance has no deadline pressure — first payment 1 Nov, first visit Thu 19 Nov.
- [ ] **SX-4 — Kara end-of-work email**, carrying the relevant packet material. **The only item
      on the list with a real customer waiting.** No template exists — what exists is the
      referral packet (customer-facing) and the job close-out sheet (crew-facing, internal).
- [ ] **SX-4a — Build the end-of-work email standard** as a reference doc (.md + designed .html
      + PDF), so Kara's email is the first use of it rather than a one-off. Covers what every
      close-out email carries: what was done, what was left, what the customer does next, the
      referral ask, the review ask.
- [x] **SX-4b — Business cards for Matthew and Brad.** **✅ ORDERED 2026-10-01.** Print files
      built and verified the same day.
      `Sixfold-Card-Brad-McPherson.pdf` and `Sixfold-Card-Matthew-Sharpe.pdf`, two pages each,
      front then back, from the new `build-card-person.mjs`.
      **Two of the three questions are answered by what he asked for:** **titles** — none, left
      empty on both, Brandon keeps "Owner"; **phone** — individual, Brad (303) 945-1514 and
      Matthew (803) 260-7359.
      **✅ The third is answered too, 2026-10-01, and it splits. Email** — Brandon and Brad keep
      the shared `Contact@SixfoldColorado.com`; **Matthew’s carries `M.Sharpe@SixfoldColorado.com`**
      and the title **Chief Technology Officer**, spelled out — `CTO` read as a hole in the block
      rather than a line of type. Two conventions in one card family, on purpose — a fourth card
      has to be told which one it gets.
      **⚑ The title no longer fits at the card’s tracking, so the tracking is solved for.**
      24 characters at 1.4 pt is 1.71 in against a 1.69 in column and would wrap. `titleTracking()`
      keeps 1.4 pt for anything short (Brandon’s `OWNER`, so **his card stays byte-identical**)
      and otherwise closes it to fill 95% — 1.096 pt here. Title and email now end within
      0.019 in of each other. **The type size did not change**; if it still wants presence, size
      is the lever and that is a change to the scale, not to one line.
      **✅ The mailbox question is closed — confirmed 2026-10-01: `M.Sharpe@` is an ALIAS on
      `Contact@`, not a separate mailbox.** It will not bounce, and it costs no extra Workspace
      seat.
      **⚑ But an alias means the card address lands in the shared inbox.** Academic today —
      Matthew is the only person on the tenant — and **not academic the moment Brandon is added**,
      which is an open item: mail to the address on Matthew’s card becomes readable by whoever
      else is in `Contact@`. Making it a real mailbox later is a Workspace change, not a
      reprint, but it has to happen **before** the second person joins.
      **⚑ Still to do, now that the box is coming. Set "Send mail as" for the alias** (Gmail →
      Settings → Accounts) before the cards are handed out, or a reply to the card address
      arrives from `Contact@` instead. **And check the roots survived the press** — ten
      hairlines at 0.15–0.32 mm, the first thing a digital press drops; if they did not, the
      widths are in the build output and the heaviest few are the fallback.
      **⚑ The contact column has 2.5 mm of slack left**, measured out of the PDF’s own glyph
      positions: the email line ends at 1.894 in and the QR plate starts at 2.121 in, of which
      0.130 in is the designed gap. It fits and does not wrap. A longer address does not.
      **⚑ Matthew’s is ember on Bone — the COLOURWAY, not the old ember-bone card.** That file
      reads `LAND & FIRE`, leads with fire mitigation and has no QR; the README says not to
      migrate those to the new descriptor. His card is the current card recoloured: same
      lockup, same QR, same "Lawn, Land & Fire". **If the fire-led copy is what he actually
      wanted, that is a reversal of the 2026-09-28 descriptor decision — say so and it is two
      lines.**
      **⚑ On a light ground the roots move to the other end of the ramp.** Ten hairlines at
      0.15–0.32 mm; they need the most contrast, which is the lightest stop on Pine (Frost,
      14.46:1) and the DARKEST on Bone (Timber, 12.05:1). Copying the Pine ramp across renders
      fine and the press drops the root system. The build now asserts it.
      **Verified, not eyeballed:** 2 pages each at 3.750 × 2.250 in read out of the PDFs; 10/10
      roots on all three; every ramp stop ≥ 3:1; and **the QR decoded back out of the finished
      PDFs** — all three return the same `linktr.ee/SixFoldColorado` that is on the printed
      cards. Brandon’s is regenerated **only as a regression test** — it is byte-identical to
      the printed card once comments are stripped, which is what proves the other two inherit
      an audited layout. His cards are printed; nothing reorders them.
      Spec and the full trade-offs: `operations/business-card-print/README.md`.

- [ ] **SX-10 — One call to Colorado Springs Utilities.** Settles three things at once, and
      the first is load-bearing: **(1)** whether the three-day watering limit still stands —
      last confirmed **May 2026**, Denver escalated to a total ban in August, and that figure is
      what the ads and the lawn quotes rest on. **(2)** Whether a contractor may file an
      establishment permit on a customer’s behalf. **(3)** Whether it costs anything — a
      secondary site said $50 and both copies of the utility’s own PDF are silent, so it cannot
      be quoted. `ESTP@csu.org`, or the Conservation Center, 2855 Mesa Rd. Background:
      `sixfold/research/water-restrictions-2026.md`.

- [ ] **SX-11 — Message Karen on Nextdoor, 8 October.** ⚑ **A dated commitment**, and the
      only thing on this list with a fixed day rather than a deadline. **Karen, not Kara** —
      different person, and Nextdoor is the channel.
      **✅ Who she is, answered 2026-10-01: a live inbound lead for TREE CLEARING.** She posted
      on Nextdoor about needing trees cleared; Matthew reached out around early September; she
      replied **Sun 27 or Mon 28 Sep** saying she wants Sixfold to come out and quote, but
      needed some time first. **The 8th is the reconnect** — the goal is to book a site visit,
      walk it with a team, and quote. **This is a prospective client, not an errand.**
      **⚑ Find out where she is before the visit is booked.** If the property is inside
      **Colorado Springs city limits** and the trees are **15 ft or taller**, that work needs a
      city tree-contractor licence, which is gated on insurance Sixfold does not carry — see
      the licence note. Out in the county it is not an issue. **One question on the 8th.**
      Tools are ready: the walk sheet, and the quote build at `/summit-de59ae83/`.

- [ ] **SX-5 — Yard signs.** Reuses the brand kit and the cascading mark. Own constraint set:
      read at 20–30 ft from a road, so the QR has to be much bigger than the card's and the
      type is a different scale problem entirely.
- [ ] **SX-6 — Giveaway merch** — stickers, magnets, pens. Magnet artwork already exists and is
      unordered; stickers are close to the same file. Pens need a one-colour version of the
      mark, which the cascade is not.
- [ ] **SX-7 — PPE branding.** Hi-vis, helmets, hoodies. Needs the single-ink mark from SX-6,
      plus a decision on embroidery vs print — the cascade cannot be embroidered.
- [ ] **SX-8 — Loyalty / repeat-customer programme.** Worth doing *after* the first season's
      close-out sheets exist, or it's designed against no data.
- [x] **SX-9 — Territory and lead list from public parcel data.** **✅ DONE — the deliverable
      exists and is in use: 11 towns, 378 neighbourhoods, 15,442 doors, live on the site and
      being knocked.** Ticked 2026-10-01. **The two things still “needed from the meeting” were
      never build work — they are decisions, and they are split out as SX-9f** so this line
      stops looking unfinished when the tool it describes has been working for days.
      Original scope and reasoning: ✅ Scoped 2026-09-29: county
      assessor records, not bought consumer lists. Output is a **door-to-door walk list and a
      territory map**, ranked by lot size and wildfire hazard.
      **⚑ Two things settle before building.** (1) **Cold calling is the regulated half** —
      parcel records carry addresses and owner names but no phone numbers, and appending them
      pulls you into DNC/TCPA territory. Door-knocking does not. (2) **Whose team is walking
      it** — Sixfold's own crew, or Surge's field team with Sixfold as a client? Different
      entities, so it changes what gets built and under whose name.
      **2026-09-29: settled — Sixfold's own crew, nothing to do with Surge's field team.**
      Meeting piece: `sixfold/operations/Sixfold-Door-Territory.pdf`.
      ✅ **The tool is built and working** — `sixfold/operations/door-territory/`. First run on
      Monument at 0.7 mi returned **320 doors to knock across 68 streets**, averaging 0.35
      acres, with the non-resident owners separated out. Run it for any place and radius.
      (Those two meeting questions are now **SX-9f**.)
- [x] **SX-9a — Teller and Douglas.** ✅ **Done 2026-09-29** via the statewide Colorado parcel
      composite — `build-walklist-co.mjs`. Castle Rock 1 mi → **1,216 doors**; Woodland Park
      0.8 mi → **1,143 doors**, avg 0.52 acres. Faster than El Paso: both addresses are on the
      record, so no geocoding. **⚑ El Paso cannot use that layer** — it contributes geometry
      only, which is why two scripts exist.
- [x] **SX-9c — Door rounds on the website.** ✅ **LIVE 2026-09-29** at
      `sixfoldcolorado.com/summit-de59ae83/`. Crew codes issued. See [DEPLOY-ROUNDS.md](sixfold/site/summit-de59ae83/DEPLOY-ROUNDS.md). **Roster corrected 2026-09-30 and reconciled
      here 2026-10-01: six codes, not three** — Matthew admin; Brandon, Brad, Nneka, Cai and
      Will D crew. **✅ Uploaded, and the curl checks were run against the live
      host 2026-09-30 — reconciled 2026-10-01.** Door JSON **404** (it is not under the document
      root at all, which beats a 403), `rounds.php` **401** without a session,
      `submissions.log` **403** — which closes an assumption carried untested since the site
      went live: this host *does* honour a `.htaccess` deny for `.log`.
      **⚑ But two secret `.php` files returned 200** — see SX-9e. Original scope:
      [ROUNDS-WEB-SCOPE.md](sixfold/operations/door-territory/ROUNDS-WEB-SCOPE.md). The Claude
      artifact works but needs a Claude seat per crew member, so it is your view, not theirs.
      The site version needs no accounts. **✅ The one open decision is settled by what was
      issued: a code per person**, not a shared crew link — six of them, with roles separating
      the two views. That is what makes knock-to-quote real.
- [x] **SX-9d — Door data: ✅ LIVE 2026-10-01 — confirmed on the site by Matthew:** Monument
      **7,514 to knock** (7,515 doors, one already marked — a pre-rebuild crew mark still on its
      house, which is live proof the superset held) and Black Forest **9,286**.
      **15,442 → 31,422 doors**, proven a **pure superset** before shipping: every existing
      door kept its id AND its address (0 lost, 0 moved, 0 renamed), so every crew mark lands on
      the house it was made on. **Ticks when it is live**, not before. Upload steps below.
      **⚑ THE BIG FINDING: Monument and Black Forest had been silently TRUNCATED since the day
      they were built.** `build-walklist.mjs` capped every El Paso pull at 4,000 parcels and
      **stopped without a word** when it hit it. Monument’s box holds 14,737 parcels, Black
      Forest’s 20,436. **Monument was showing 2,330 of ~7,500 eligible doors; Black Forest 1,005
      of ~9,300. The home market was running at about a quarter of its real size.**
      It surfaced only because the superset gate failed — the first rebuild lost 101 doors, all
      El Paso, all past the cap. The cap is now 50,000 and **exits with an error when it bites**.
      A cap that drops data silently is worse than none.
      | | before | after |
      |---|---|---|
      | Black Forest | 1,005 | **9,286** |
      | Monument | 2,330 | **7,515** |
      | Castle Rock | 6,564 | 7,189 |
      | Woodland Park | 2,578 | 2,751 |
      | Franktown | 1,030 | 1,656 |
      | the other six | 1,935 | 3,025 |
      **Field impact: none.** The app sends one neighbourhood at a time; the largest any phone
      receives is 44 KB. **⚑ But Wolf Village Dr is now one 404-door “neighbourhood”** — more
      than an afternoon. Worth splitting if the crew finds it unwieldy.
      **Re-run `verify-superset.mjs` before EVERY future upload** of rebuilt door data.
      Original decision record:
      Matthew delegated the
      call — *“whatever is best for the company”* — and said waiting for usage to reset is fine.
      **✅ RAISE THE 2.5-ACRE CEILING — do it.** Black Forest, Larkspur, Divide and Florissant are
      being clipped, and those are exactly the big-lot properties the fire and land work is
      built for. **Widening is safe: marks survive a rebuild**, so nothing already knocked is
      lost. Clear win.
      **❌ COLORADO SPRINGS — NOT NOW.** Three reasons, and the third is the one that decides it:
      121,709 parcels is a lot of regeneration; city lots are small so the per-door case is
      weaker than the big-lot towns; and **Colorado Springs is the one market where trees 15 ft
      and over need a city licence Sixfold cannot get without insurance it does not carry.**
      Knocking doors for tree work in the exact city where the tree work cannot be sold is
      backwards. Revisit when the insurance exists.
      **⚑ Execution deferred to a fresh day** — the regenerate + upload is the expensive half.
      Remember: publish → regenerate → upload → flush.
- [x] **SX-9b — Wildfire hazard per door: ✅ LIVE 2026-10-02 (with the 1 October batch).**
      A badge on every door and a **“Most fire hazard”** sort on the neighbourhood list, which
      ranks by high-hazard doors **still to knock** (Palmer Lake: Forest View Way first, 46 left,
      18 very high). 17/17 tests, light and dark checked, every colour ≥ 4.5:1. Ships in the
      same upload as the phone field and satellite link. **Ticks when live.**
      Pipeline step `sample-wildfire.mjs` (incremental, cached by coordinate). Write-up:
      [WILDFIRE-HAZARD.md](sixfold/operations/door-territory/WILDFIRE-HAZARD.md).
      **The undocumented `TetraTechWUI` layer is replaced by the USDA Forest Service’s Wildfire
      Hazard Potential (2023, 270 m)** — open, documented, authoritative. Class mapping **proven on
      known places**, not assumed: 1 very low · 2 low · 3 moderate · 4 high · 5 very high ·
      6 non-burnable · 7 water (the Divide conifer lot reads 4, Pueblo Reservoir 7).
      **All 31,422 doors sampled, zero missing. It narrows hard: 861 very high, 6,705 high or
      above (21%).** By town: Florissant 68%, Palmer Lake 48%, Woodland Park 46%, **Monument 29%
      — 2,212 high-hazard doors around the base** — down to Castle Rock 6%.
      **This is Sixfold’s version of Via’s hail map**: hazard map → satellite → knock → manual
      lookup for the few worth calling.
      **⚑ Caveats:** 270 m cells rate *neighbourhoods*, not lots (the satellite button is the
      per-house check); class 6 “non-burnable” means town or farmland, **not** “safe” — never
      exclude on it; hazard is not a sales signal; data is 2023.
      **Next: build it** — sample at rebuild, store per door, badge + sort/filter in the app.
      Must pass `verify-superset.mjs`. Lot-size band still to be judged on a real afternoon.
- [x] **SX-9e — Move `rounds-codes.php` and `secrets.php` above the document root. ✅ LIVE 2026-10-03, verified: both old URLs 404, sign-in and the form email work from sixfold-private/.** Found by
      the live check on 2026-09-30, added to the register 2026-10-01. **Both return 200 with a
      zero-byte body** — not a leak, but the `.htaccess` deny is not what is protecting them.
      PHP executing the file is. That holds until the day PHP does not run for that directory —
      a handler misconfiguration, a version change, a directory copied without the handler —
      and then `rounds-codes.php` serves as plain text and **every crew code is public**.
      The fix is the one already applied to the door data and the quote data: move the file
      above `public_html` and include it by absolute path. **Not urgent, and it should be done
      before the code list grows.** Re-check by fetching the *body*, not the status:
      `curl -s .../api/rounds-codes.php | wc -c` must be 0.

## Surge

- [ ] **SX-9f — Two things the door programme still needs from the team meeting.** Split out
      of SX-9 2026-10-01 — they were holding a finished build open.
      **(1) Which suburb gets walked first.** The data covers 11 towns and nobody has picked
      the starting one. Worth deciding against where the crew actually is, not where the
      biggest door count is.
      **(2) The solicitation-permit position for Monument, Colorado Springs and unincorporated
      El Paso.** **Matthew 2026-10-01: the doors team researches neighbourhoods before going
      out and marks off the ones posted no-solicitation.** Sound for signs and HOAs — and it
      became SX-13, a flag in the app.
      **⚑ BUT IT DOES NOT CLOSE THIS ITEM, AND THIS IS THE HALF THAT PRODUCES THE FINE.**
      A **municipal canvassing permit** is a jurisdiction-level requirement, not a
      neighbourhood one. If Monument requires a permit per canvasser, the crew needs it on
      **every street in Monument** — no amount of researching neighbourhoods avoids it.
      **Still needs a phone call, per jurisdiction. Pairs with SX-10**, which is already a call
      to a Colorado Springs public body.

- [x] **SX-13 — “No soliciting” flags in the rounds app: ✅ BOTH LEVELS LIVE 2026-10-02**
      (uploaded and checked by Matthew on his phone). **Door:** a fourth outcome, `nosolicit`, under Not now.
      It counts as done and leaves the hazard count, and Undo asks first. **Neighbourhood:** any
      crew member can raise it, only an admin can clear it, and it warns rather than hides. It is
      **stored against the door ids, not the name**, and a simulated rename-and-split rebuild left
      both halves flagged. The orphan risk below is answered: the marks log is never pruned, so the
      door flag is never deleted, and `verify-superset` keeps ids stable.
      Original scope: [NO-SOLICIT-SCOPE.md](sixfold/operations/door-territory/NO-SOLICIT-SCOPE.md).
      **Two levels, and the door-level one matters more than the ask.** A sign is **per house**,
      the crew sees it standing there, and ignoring one is trespass in some places. Door
      outcomes are `booked | later | miss` in an append-only log validated in exactly one
      place, so a fourth outcome is a contained change — **but it must never come back.**
      *Not now* returns next season, *no answer* returns the same afternoon; **no soliciting is
      permanent and should not offer an easy undo.**
      **Neighbourhood level is the ask**: flag it, visible **before** anyone drives out. Two
      calls when building — warn rather than hide (an entrance posting does not always mean
      every door), and **admin-only to clear**, or one wrong flag quietly deletes a
      neighbourhood from the programme.
      **⚑ A rebuild can orphan the flag.** Marks survive rebuilds, but a door that *drops out*
      leaves its mark orphaned and the report already prunes those. Harmless for a *not now*;
      for a no-soliciting flag it is **a protection silently disappearing and the door being
      knocked again.** Store it outside the ordinary marks log, or exempt it from pruning.
      Widening (SX-9d) is safe; narrowing is not.
      **Deferred: the app is live, so this is code + upload + cache flush.**

- [x] **SX-14 — Phone numbers on the door list. ✅ LIVE 2026-10-02 (with the 1 October batch).** Matthew asked 2026-10-01 whether numbers can
      be cross-referenced onto the addresses, and whether an API could be wired in here.
      **Short answer: yes technically, and the far better version is free and already missing.**
      **✅ CORRECTION 2026-10-01: lead NOTIFICATION is not the problem.** Matthew gets
      notifications from **Google Business Profile, Nextdoor, Meta and the website** — all four.
      The “3 of 4 channels notify nobody” note predates the 2026-09-28 site-email fix and is
      **stale; stop repeating it.** His actual constraint is **traffic volume, not capture.**
      **⚑ THE APP STILL CAPTURES NO PHONE NUMBER AT THE DOOR — that part stands.** A door is
      `{address, acres, owner}` and a mark is `{outcome, by, when}` — there is nowhere to put
      one. **So when a crew member books a quote, the number the homeowner just handed them
      goes onto a scrap of paper and into nobody’s system.** That number has **consent given
      in person**, it belongs to someone who already said yes, and it costs nothing to collect.
      It is worth more than 15,442 appended numbers. **Do this first, and it is a small change:
      a field on the “quote booked” outcome.** Same shape as the lead-intake problem.
      **On appending — it is possible, with three real problems.**
      **(1) The name on parcel data is the OWNER, not the resident**, and the walk lists already
      separate non-resident owners out. Appending to those reaches a landlord in another state,
      not the person who answers the door.
      **(2) The legal exposure is the kind that attracts plaintiffs, not regulators.** TCPA
      restricts automated calls and texts to cell phones without prior express consent, **a text
      counts as a call**, and it carries **statutory damages per message with a private right of
      action** — which is why it is an industry for litigators. On top of that: the **national
      Do Not Call registry** (scrub, and keep an internal list) and **Colorado’s own no-call
      list**. *Shapes, not citations — I could not re-verify the current specifics in session,
      and a calling or texting programme needs a real opinion before it starts, not mine.*
      **(3) It reverses a decision already made.** SX-9 was scoped to door-knocking precisely
      because *“parcel records carry addresses and owner names but no phone numbers, and
      appending them pulls you into DNC/TCPA territory. Door-knocking does not.”* Fine to
      revisit — but revisit it knowingly.
      **The API question: yes.** Property-data and skip-trace vendors sell exactly this behind an
      API key, and the site already has the pattern for holding one — `api/secrets.php`, same as
      the Gmail SMTP credentials, kept out of the repo and out of the web root. **Give me an
      account and a key and wiring it in is straightforward.** *Not naming vendors or prices
      here: I could not verify either this session, and stale pricing is worse than none.*
      **⚑ Asked 2026-10-01: is there anywhere free to pull it from? Essentially no, and the
      reason is structural rather than commercial. Cell numbers were never public records.**
      Landline white pages were public because the phone company published a directory; cell
      numbers never had one, and most households are now wireless-only. **So there is no
      authoritative file to look numbers up in.** What vendors sell is *assembled* — stitched
      together from credit headers, marketing lists and purchase histories — which is why it
      costs money, why match rates are imperfect, and why it is regulated.
      **✅ BOTH “free source” IDEAS WERE CHECKED 2026-10-01 AND BOTH ARE DEAD. Do not build
      either.**
      **(1) The Secretary of State lookup — measured against the real data, and it returns
      almost nothing.** Scanned all 11 walk lists: **2,030 of 15,442 owners (13.1%) look like
      entities — and 2,024 of those are TRUSTS.** Trust 1,013 · living trust 657 · revocable
      354. **Zero LLCs. Zero Inc, Corp, Ltd, LLP, LP.** Only ~5 doors in the whole dataset would
      resolve at the SoS.
      **⚑ And the premise was wrong, which matters more than the yield.** I assumed
      entity-owned meant investor or absentee. **A revocable living trust is an estate-planning
      wrapper, is not filed with the state, has no registered agent, and the people in it LIVE
      THERE.** 13% of the walk list being family trusts means **long-tenured owners on big
      lots** — among the best doors to knock, not landlords to route around. Worth saying to
      the crew.
      **(2) The Colorado voter file — the legal risk is lower than I flagged, but the data is
      not there.** Primary source: **C.R.S. 1-2-227** — voter registration records *“are public
      records subject to examination by any person, and such person has the right to make
      copies”*. No commercial-use prohibition in that section. **But Douglas County’s own list
      product lists what it excludes — SSNs, licence numbers, signatures, email addresses, vote
      choices — and phone is not among the fields offered**, and Colorado registration does not
      require one. **So the question is moot: you cannot buy what is not collected.** One call
      to the SoS would settle it definitively; not worth making until something else needs it.
      **The quality argument matters as much as the price.** A bought number that is stale, that
      belongs to a landlord in another state, and that cannot legally be texted is a bad
      purchase at any price.
      **So the order collapses to one item: capture the number at the door.** It is the only
      route that is free, consented, accurate and actually available. Everything else is a
      vendor invoice.
      **▶ 2026-10-01 — Matthew asked whether Via’s method could be built in.** Via (a roofing
      company he helps — separate entity) takes names and addresses from **Prospect Now**, then
      hand-checks each on **Fast People Finder / True People Search**, using their “last seen”
      dates to pick the live number before cold calling.
      **What carries over, and what does not:**
      • **Prospect Now would mostly duplicate what Sixfold already has free.** Its names and
      addresses come largely from county assessor records — the same source the walk lists
      pull from the state and El Paso GIS layers at no cost. **Via pays for Sixfold’s free tier.**
      • **The people-finder lookup can be supported but not automated.** A human looking a
      name up by hand is what Via does and is fine. Scraping 31,422 names breaks those sites’
      terms, gets blocked, and produces exactly the same regulated phone list.
      • **Buildable and small: a phone field on each door** (with a “found on / last-seen”
      note), filled by hand from a lookup *or* at the door. **It is the same field SX-14
      already needs**, so it is not wasted whichever way calling goes.
      **⚑ The bar that applies whatever the source:** telemarketing to consumers means scrubbing
      every number against the **national Do Not Call registry** and **Colorado’s no-call list**
      before it is dialled, keeping an internal do-not-call list, calling only in permitted
      hours, **no autodialers or prerecorded calls to cells, and no texts**, without prior
      consent. *Shapes, not citations — get a real opinion before a calling programme starts.*
      **Worth knowing for Via too: does it scrub?** That is what decides whether its model is
      safe to copy.
      **Recommendation for Sixfold: not yet.** The door list just doubled, door-knocking carries
      none of this exposure, and Sixfold has no general liability cover on file. **Build the
      phone field (useful either way) and revisit calling once the doors are worked.**
      **✅ PHONE FIELD BUILT AND TESTED 2026-10-01 — awaiting upload** (`api/rounds.php` +
      `summit-de59ae83/index.html`; steps in DEPLOY-ROUNDS.md). Every door now takes a number
      with a source statement: *“Given at the door · 1 Oct 2026”* or *“Found on True People
      Search · last seen Aug 2026”*. Booked quotes in Done take one too. Stored in its own
      append-only `phones-<town>.log`, so it **survives door rebuilds** the way marks do.
      **32/32 end-to-end checks passed**, then rendered and looked at on an iPhone-width screen.
      **⚑ The automated pull from True / Fast People Search was NOT built.** Matthew asked for
      it; the permission system blocked it as personal-data harvesting, and it is against those
      sites’ terms besides. **Lookup stays a human step — exactly how Via does it.** Do not
      try to route around this.
      **The source field is the compliance control:** looked-up numbers show an amber
      “check the Do Not Call lists before calling” note; numbers given at the door do not.
      **Ticks when it is live.**

- [x] **SX-15 — ✅ The surviving half is BUILT 2026-10-03: county value on every Douglas and Teller door**
      (13,884 doors, 46% of all; El Paso none). Matthew: "if it gives us more data, add it." `sample-value.mjs`
      → `value-cache.json` → door files → card + export. Re-run it at each quarterly re-pull (SX-33).
      *Original:* **SX-15 — Enrich each door from the parcel source you already query.** Found 2026-10-01
      while answering “can we attach Whitepages data to each door?” — **the answer is yes to
      enrichment, no to Whitepages, and the good fields are already free.**
      **The statewide layer exposes 35 fields. `build-walklist-co.mjs` asks for 12.** Left on
      the table, all free, all authoritative county record:
      • **`saleDate`** — when they bought it. **The single most useful one.**
      • **`salePrice`**, **`apprValTot`**, **`asedValTot`** — value, a rough qualifier for
      whether a $2,000+ mitigation job is plausible at that door.
      • **`zoningCode` / `zoningDesc`**, **`subName`** (subdivision), **`legalDesc`**,
      **`account`**, and **`URL`** — a direct link to the county record for that parcel.
      **⚑ Why `saleDate` beats a phone number for a knocker.** A 15-year owner has mature
      trees, an established lawn and deferred work — that is the fire-mitigation and aeration
      conversation. Someone who bought six months ago is in the fixing-up-the-new-place window
      and is spending. **Both are good doors; the opener is different, and right now the crew
      cannot tell them apart.**
      **This is free, accurate, legal and already in the query** — unlike scraped people-search
      data, which is assembled, wrong often enough to matter, against the site’s terms, and
      still regulated the moment you call it.
      **⚑ DO IT IN THE SAME REGENERATE AS SX-9d.** Both are a rebuild of all 11 walk lists and
      the expensive half is the regenerate + upload, not the edit. Raising the acre ceiling and
      adding fields in one pass costs what one of them costs. **Adding fields drops no doors,
      so marks survive** — same safety as widening.
      **⚑⚑ MOSTLY DEAD — MEASURED 2026-10-01, AFTER I RECOMMENDED IT. The fields exist in the
      schema but are EMPTY.** Across all 165,309 addressed parcels in Douglas and Teller:
      **`saleDate` 0% · `salePrice` 0% · `zoningDesc` 0% · `URL` 0%** · `subName` 0% Douglas /
      100% Teller. **Only `apprValTot` (appraised value) is filled everywhere.** I pitched
      “owned since” off the field list without checking it held data — the exact error the
      repo’s research standard exists to catch. **What survives is value-only, on ~75% of doors
      (none in El Paso). Held for Matthew’s call rather than spending an app change on it.**
      **⚑ EL PASO CANNOT BE ENRICHED FROM ITS CURRENT LAYER — checked 2026-10-01.**
      `build-walklist.mjs` reads El Paso’s `MailingLabelParcels`, and that layer’s 26 fields
      carry **no sale date, price, value or year built** — names and mailing addresses only, as
      the name says. It does have a per-parcel `hyperlink`, probably to the assessor record.
      **So the split, by door:** statewide composite (Castle Rock, Woodland Park, Franktown,
      Larkspur, Divide, Florissant, Cripple Creek, Sedalia) **~11,600 doors, enrichable free**.
      **El Paso — Monument, Black Forest, Palmer Lake — ~3,800 doors, not**, and those are
      core territory near the base. *(Sedalia is Douglas County; its region field says so,
      which puts it on the statewide side.)*
      **Recommended scope:** enrich the ~75% that is free, raise the acre ceiling everywhere,
      and treat El Paso enrichment as a **separate research question** — find whether El Paso
      publishes an assessor layer with sale data. **The app must show El Paso doors cleanly
      with the fields absent**, not as blanks that look like a bug.

- [x] **SX-16 — Notes, “come back when”, walkable neighbourhoods: ✅ LIVE 2026-10-02.** My top three from the improvements list, shipped together.
      **Notes** on every door (500 chars, who and when, in the export). **“Not now” asks when to
      come back** — a month, three months, spring, fall, a date or none — and the door returns in a
      **“Due to revisit”** section when its date arrives. **The date rides on the mark**, so it is
      offline-safe: tested with the network cut, held on the phone, delivered intact.
      **Neighbourhoods split properly:** biggest 404 → 55, none over 60, median unchanged at 29.
      Two stacked bugs — a one-shot splitter that dumped leftovers into the biggest piece, and
      same-street pieces being glued back together by name. Clashing names now carry a
      house-number range (*“Wolf Village Dr 5738–5842”*). 36/36 tests. **Ticks when live.**
      **The rest of the improvements list is built too: see SX-17.**
- [x] **SX-17 — Slimmer cards, town progress line, nearest-door GPS sort, neighbourhood map,
      admin "Quotes to build": ✅ LIVE 2026-10-02.** Checked: page byte-identical to the tested
      file; denials hold; Matthew confirmed Quotes to build, badges/satellite, house-number names.
      Built in the same pass as SX-13 and SX-16, so **everything from 2026-10-01 goes up as ONE
      upload**: `rounds.php`, `index.html` and the 12 door files. See the top of DEPLOY-ROUNDS.md.
      The map is Leaflet from cdnjs, pinned by checksum, on OpenStreetMap tiles. Quotes-to-build
      lives inside the door app, so SX-2b gets no fourth copy. **180/180 checks** across six suites.
- [x] **SX-18 — The new look for door rounds: ✅ LIVE 2026-10-02.** Checked live: page and all five
      new files byte-identical to the tested build; keypad sign-in renders with no script errors;
      Chrome reports it installable; denials hold.
      **Follow-up fixes built 2026-10-02 after his first live look (awaiting upload, `index.html`
      only):** empty bar on the report page, the dock covering text, Quote booked green → ember,
      and no-answer doors made findable with "Put back on the list". 220/220. **Live and verified
      2026-10-02.** Then **"Doors to come back to"** (every no-answer and due door, across all
      towns, one tap to the right neighbourhood): **live 2026-10-02, confirmed by Matthew.** Then
      **Nearest neighbourhood** on the town screen (sorts by distance, picks the closest town): built
      and tested, awaiting upload, `rounds.php` + `index.html`. Built from the approved preview. **Upload is `index.html` plus five new
      files** (manifest + 4 icons) into `public_html/summit-de59ae83/`. The API and door data are
      unchanged. Includes the home-screen install, the splash, the keypad sign-in, motion with Undo,
      and the map card. **Fixed on the way:** the map's OpenStreetMap credit link could navigate the
      app away mid-round. 211/211 checks.

- [x] **SX-29 — Mailing list of owners who live elsewhere: ✅ BUILT 2026-10-03.** 7,483 letters
      covering 10,207 properties, with fire hazard and trees near the house. El Paso property
      addresses come from state address points (96% right on 311 known doors). Nothing mailed.
      `sixfold/operations/door-territory/mail/MAIL-LIST.md`. Lists stay out of git, as the walk lists do.
- [x] **SX-30 — HOA list: ✅ BUILT 2026-10-03, no records request needed.** The Division of Real
      Estate's free roster, cut to our counties: 97 HOAs matched to our neighbourhoods (32,087
      units); RowCal runs 166 in scope. The roster has no phone or email; a narrowed request for
      those is drafted, NOT sent. `door-territory/hoa-registry/HOA-LIST.md`.
- [x] **SX-31 — Lawn health (NDVI) trial: ✅ FINISHED 2026-10-04 on the 740 Large lawns** (the compact-lawn rule cut Large
      from 2,053). **734 measured.** Every town greened less in summer 2026 than 2025 (median change −0.04 in
      July–August greenness), the same everywhere, which is what a drier year or watering rules look like. Against
      their own neighbours: **95 doors browned noticeably more than the street (≤ −0.05), 80 greened more.** Each
      lawn is only ~5 satellite pixels at 10 m, so this is a trial: good enough to say which large lawns stand out
      from their street, not to diagnose one lawn. Results: `lawn-trial/ndvi-results.csv` (gitignored, has names)
      and `ndvi-summary.json`. Not in the app; Matthew decides whether it goes on the cards.
      *Original:* Sentinel-2,
      summer 2025 vs 2026, weighted by the door app's own lawn outline. Early finding: at 10 m only
      about a third of Palmer Lake's large lawns are compact enough to read. The image metadata's
      offset turned out to be wrong for these files and was dropped (measured on lake water).
- [x] **SX-34 — Door app opens with no signal: ✅ LIVE 2026-10-03, verified signed in (Claude Check code), rides with SX-28/32 (adds `sw.js`).**
      Network-first service worker: with signal nothing changes; with none, the last copy of the page,
      sign-in, towns and recent neighbourhoods open with a strip. Sign-out wipes it. 12 checks with the
      server really off.
- [x] **SX-36 — Extra work spotted at the door: ✅ LIVE 2026-10-03, verified signed in (Claude Check).**
      Matthew's list: one door can lead to several jobs. "+ Extra work" on every card: branches over the
      roof, gutters full of debris, brush or junk against the house, dead or dying trees, irrigation
      problem, bare or patchy lawn, overgrown beds or weeds. Saves with no signal; shows on the card, in
      Quotes to build and the export (`extra_work`). About the property, so a sale does not hide it.
- [x] **SX-37 — Results tracking: ✅ LIVE 2026-10-03, verified signed in (Claude Check).** Booked doors get Won (job
      value) or Lost (reason: price, someone else, maybe later, stopped answering, doing it themselves) in
      Quotes to build; won and lost move to their own section. New admin **Results** screen: knocked →
      booked → won by fire hazard, lawn, trees, county value, town and extra work, with rows under 10 doors
      greyed. Matthew: "over time this proves the app works and makes the scoring smarter." 23 checks.
- [x] **SX-38 lawn on the photo, SX-39 stats tips, SX-40 Communities, SX-41 alerts: ✅ LIVE 2026-10-03, verified
      signed in (outlines live for Monument, Palmer Lake and part of Black Forest; the rest upload when built)** (Matthew: one upload, before Monday's meeting). See DEPLOY-ROUNDS.md.
      SX-38's outline packs are still building in the background (about 0.45 lawns/s on the hotel connection).
      SX-41 has no fire-season countdown on purpose (year-round season; warnings are the trigger) and no email yet (needs a cron).
- [x] **SX-44 route + SX-45 Jobber CSV: ✅ LIVE 2026-10-03, verified.** Route: nearest-next + 2-opt from your position, Google Maps walking link for the next 10 stops. Jobber: booked doors in Jobber's import headings (checked against help.getjobber.com 2026-10-03); no ZIP yet.
- [ ] **SX-42 scheduled lawn health: ✅ BUILT 2026-10-03, first run May 2027.** `node ndvi-trial.mjs --month=2027-06`
      compares a month with the same month a year earlier (May-Sept only; winter refused; clouds, shadow
      and snow masked per pixel), writes ndvi-results-YYYY-MM.csv; `node build-lawn-outlines.mjs --green-only`
      then refreshes the app's lawn photos. Nothing to run until the growing season.
- [ ] **SX-46 Do Not Call — facts checked 2026-10-03, still Sixfold's to register.** Federal registry: first five area
      codes free for every telemarketer (FTC, FY2027 fees from 1 Oct 2026: $85 per extra area code); Sixfold's
      towns are 719 and 303/720 (983 overlay), so free. Colorado no-call list: sliding-scale fee, **no fee under
      five employees** (C.R.S. 6-1-905(3)(b)(II)). **Matthew 2026-10-03: Sixfold has fewer than five employees (most crew are
      contractors or gig hires), so the state list should cost nothing** — registration is still needed to download it. Separate: the Colorado AG's telemarketer registration ($200,
      coag.gov) — **whether Sixfold's calls need it is a legal question for Brandon's attorney**. Only looked-up
      numbers matter; numbers given at the door are consent. Once the lists are downloaded, the app can check
      looked-up numbers against them.
- [ ] **SX-47 county wildfire plans: ✅ Teller LIVE 2026-10-03 (62 neighbourhoods verified).** `cwpp/build-cwpp.mjs` reads the
      Teller County CWPP 2025 tables (162 rated communities) and matches 28 to our neighbourhood names (62
      neighbourhoods). **Still open: El Paso (current plan not found) and Douglas (county plan is from 2011;
      Perry Park MD has a 2023 local plan).**
- [ ] **SX-38..47 — the rest of Matthew's 2026-10-03 upgrade list, in his agreed order after SX-36/37:**
      **SX-38** lawn photo in the lawn chip (2023 aerial with the counted lawn shaded; greenness + image
      dates for Large) · **SX-39** tips on the stats page from each person's numbers · **SX-40** HOA /
      Firewise view to pitch a whole community · **SX-41** alerts: NWS red flag / fire weather / heat / air
      quality, nearby fires (national incident feed), fire-season countdown; banner + email to Contact@ via
      a SiteGround cron; never knock inside an active fire or evacuation · **SX-42** scheduled lawn health:
      every 1-2 months May-Sept, same month last year, skip winter/snow/cloud, show image dates ·
      **SX-43** fuel overgrowth yearly in late spring; the 2-yearly USDA aerial (0.6 m) is the real signal,
      10 m mostly noise; crew Before/After photo tags for homeowners · **SX-44** route planning (walking
      order + open in Maps) · **SX-45** Jobber-format CSV (only if Jobber is adopted; the CRM decision was
      no purchase) · **SX-46** Do Not Call scrubbing, gated on Sixfold registering (federal list free for
      5 area codes; Colorado's list believed paid, unconfirmed); door-given numbers are consent ·
      **SX-47** county wildfire protection plans (El Paso, Douglas, Teller): tag the neighbourhoods they name.
- [x] **SX-35 — When a house sells: ✅ LIVE 2026-10-03, verified signed in (Claude Check code), rides with the upload.** Owner history
      across rebuilds; a real change (no shared name) sets "new owner since". Records surely from before
      the sale are set aside and labelled; ones from the window around the sale stay live with "check
      it's the new owner's" (no sale dates in county data). Fable review fixes in (name-check bug,
      sale window, offline sign-out, stale saved copies). Detection starts from the re-pull after
      the first build. Needed before the January re-pull (SX-33).
- [x] **SX-32 — One town per door: ✅ LIVE 2026-10-03, verified signed in (Claude Check code), rides with SX-28.** 958 doors were in two
      town lists (all of Palmer Lake inside Monument; Castle Rock overlapping Franktown and Sedalia),
      each copy with its own marks. Each door now belongs to the nearest town; everything recorded under
      the other town follows it (the server reads partner towns' logs). No id or address changed; gate
      passed. Also from Fable's review: the gate now fails when it compared nothing or a town vanished
      from index.json; the refresh steps include the gate; saves for doors on no list are refused (409).
      **Still open: the house-sale question** (old owner's phone and notes stay with the address).
- [x] **SX-28 — Security fixes from the Fable review: ✅ LIVE 2026-10-03, verified signed in (Claude Check code), awaiting upload (`rounds.php` + `quote.php` + `api/submit.php` + `index.html`).**
      Removed codes now sign out at once; sessions are tied to the code (not the name) and the role
      comes from the list; a right code no longer clears wrong ones; locked sign-in counting; site-wide pause after 60 wrong codes an hour;
      plus smaller fixes. Nothing critical was found. Fable re-checked the fixes and found three
      more (same-name merge, IPv4-in-IPv6 shared counter, silent pause); fixed and re-tested.
      Plus the save-queue fixes from Fable's review (newer saves win, signed-out saves kept, the
      queue belongs to a person, a Wi-Fi login page can't empty it) and quote.php's session check.
      **Everyone signs in once after the upload.** Notes: DEPLOY-ROUNDS.md, SX-28.
- [x] **SX-27 — Leads screen: ✅ LIVE 2026-10-03, verified (page matches build, test enquiry emailed and appeared in Leads).**
      One admin list for every enquiry, with status and notes. Website form leads file themselves;
      Meta/Nextdoor/phone/referral are added by hand. This tracks what happened to a lead. It is
      not a notification fix (notifications already work, see SX-14). **Also fixed:** the
      website form's default "lawn" choice had no label, so most site enquiries arrived as
      "Enquiry". Upload notes: DEPLOY-ROUNDS.md, SX-27.
- [x] **SX-26 — Everything saves with no signal: ✅ LIVE 2026-10-03, verified.**
      Notes, phones, emails, lawn answers and photos join marks in the offline queue (photos in
      IndexedDB). The queue now keeps on 5xx and moves past refused items; it used to do the
      opposite. index.html only.
- [x] **SX-24 — Trees near the house: ✅ LIVE 2026-10-03, verified.** 26,430 of 31,422 doors have a reading. Most of the rest are houses built after the survey (whole new subdivisions in Black Forest: 1,882 doors). Superset gate passed, all 20 suites pass.
      LiDAR (USGS 3DEP) for El Paso 2018 and Douglas 2020, the canopy map for Teller (no 3DEP
      there). Zones 0–5 / 5–30 / 30–100 ft from the house. The canopy map was tried first and
      missed whole evergreen clumps, so LiDAR replaced it where it exists. Upload: rounds.php +
      index.html + 12 door files. Method: tree-zones/TREES.md. Plus a **Trees** neighbourhood sort (Matthew: "add the tree sort
      before the upload"). Two spot-checks reshaped the rules: roof-aware alignment, despeckling, the roof-edge band, and
      "against" needing zone 1 and zone 2.
- [x] **SX-25 — Neighbourhood subdivision + Firewise tags: ✅ LIVE 2026-10-03, verified.**
      Subdivision names: Teller from the statewide record, Douglas from the county table; El Paso
      uses metro districts (~30%, no public subdivision names). NFPA Firewise sites within 600 m,
      labelled "nearby, confirm". **Draft CORA request for the HOA registry, NOT SENT**
      (HOA-RECORDS-REQUEST.md). Declined: the senior/veteran homestead flag (not in the data, and
      it would be a list of seniors). Already done before this request: the owner-address match.
- [x] **SX-23 — Money sheets on door cards: ✅ LIVE 2026-10-02, checked on Matthew's phone.** Tax credit ·
      Insurance · Grants, each an internal sheet with say / don't-say lines. Grants is county-aware. Per-door
      flags were rejected after counting: tax applies to every door; insurance has no per-door signal beyond
      the fire badge; no door is 40+ acres. Research refreshed the same day. **Douglas County's contractor
      list is PREFERRED, not required, so the old "never mention it" rule is gone.** The 2026 round is closed.
      Upload: rounds.php + index.html + docs/money.json. **✅ Documents rebuilt 2026-10-02:** the funding directory
      (HTML, PDF 16 pp, artifact v2), the tax notebook (v1.1, PDF 7 pp, artifact v2, which also replaced a stale
      Englewood build) and the marketing plan (HTML, PDF 16 pp, artifact v2) all carry the corrected Douglas rule
      and thinning line.
- [x] **SX-22 — Doors come back on their own: ✅ LIVE 2026-10-02, checked on Matthew's phone.**
      Put back = mistake (off My doors and the stats). Not now rejoins the to-knock list on its date.
      No answer rejoins it after `MISS_REST_DAYS` = 2 — **confirmed by Matthew 2026-10-02**.
      Same two files as SX-21. 364/364 checks.
- [x] **SX-21 — My doors on My stats: ✅ LIVE 2026-10-02, checked on Matthew's phone.** Every door
      the person acted on, filtered by day or week, with Change / Put back / Open door on each one.
      Matthew's request. Also: neighbourhoods now open on Street order, not the last-used map.
      Upload is `rounds.php` + `index.html`. 359/359 checks.
- [x] **SX-20 — Doors-team requests: ✅ LIVE 2026-10-02, checked on Matthew's phone.** My stats
      (everyone) and Team stats (admin), the full door card on the map (minimise, next dot), email
      per door, walk-through photos (shrunk and GPS-stripped on the phone, stored outside
      public_html). Upload is `rounds.php` + `index.html`. It can ride with the lawn door files.
      Researched whatgrassisthis.com: a free AI grass identifier with no API and no named operator.
      Fine on a crew phone, nothing to build on. Offered a grass-type quick-pick for overseeding
      quotes (not built). 326/326 checks.
- [x] **SX-19 — ✅ LIVE 2026-10-02 (all 12 door files uploaded, checked on Matthew's phone). LAWN RUN FINISHED 2026-10-02: 31,060 of 31,422 doors have a lawn level (6 Black Forest lots from the 2021 photo — the 2023 tile is unreadable there; 362 with none: 240 no parcel at the point, 102 lot too big, 4 off the photo). Door files rebuilt, PURE SUPERSET, committed. AWAITING UPLOAD of the 12 door files.** Lawn size per door, the aeration counterpart to the fire map. BUILT 2026-10-02 as a
      LAWN LEVEL (Matthew: "build it out now, calibrate over time with input from the doors"). Crew
      correct it in the app, and their answers are exported as calibration data. Awaiting the full
      measuring run, then upload.**
      **To finish: say "finish the lawn run".** Steps are in memory (sixfold-lawn-size-trial): resume
      `lawn-trial/sample-lawn.mjs`, rebuild, verify superset against the committed door files, commit,
      then upload rounds.php + index.html + 12 door files. 2023 USDA aerial photos (30 cm, near-infrared, public domain) plus a tree-
      height map: green and under 1 m counts as lawn. **Suburban lots photographed in September come
      out right**, e.g. Russet Sky's outline matches the photo. **Four failure modes:** mid-October
      photos undercount (13 of 39 lots); brown dormant lawns are missed; scrub oak on wooded acreage
      reads as lawn; anything after 2023 isn't in the photo. **Next if he wants it:** add the 2021
      photo as a second look, show "mostly trees" on wooded lots, then a "Most lawn" sort and a
      per-door figure. **First true check: one lot Sixfold has measured on the ground.** Write-up:
      [LAWN-SIZE.md](sixfold/operations/door-territory/LAWN-SIZE.md).
- [ ] **SG-1 — Site edits from Brandon's and Lance's evaluations.** **Blocked on you sending me
      their notes** — I don't have them. Also note staging is two commits behind local, so
      re-bundle before anyone reviews anything.
- [ ] **SG-2 — Finish the remaining social accounts** and level the branding across all of them.
      The cross-platform kit already exists for seven platforms, draft-only.
- [ ] **SG-3 — Surge Linktree** — accuracy pass. Pairs with X-2.
- [ ] **SG-4 — Google Drive for Surge content.** Sixfold's team share is a working model to copy.
- [x] **SG-5 — Pull down the WhatsApp content** from the Surge chats while it's still there.
      **✅ PHOTOS PULLED 2026-10-01.** The urgent half is done — the thing that disappears on
      someone else's schedule is off the clock.
      **⏰ REMIND HIM 2026-10-08: pull again. Content comes in regularly**, so this is a
      recurring sweep, not a one-off — his words. Pairs with SX-11, which is the same day.
      **✅ The TEXT is pulled too — confirmed 2026-10-01, “all the content”.** So the quotes,
      agreements and promises that lived only in those messages are now off someone else's
      phone. **Nothing on this list is time-expiring any more.**
      **⚑ Next question for it is where it landed and whether it is backed up** — content
      rescued onto one machine is one machine away from being lost again. If it is not in the
      OneDrive mirror it is not safe. Pairs with P-3, the same problem with phone photos.
      **Time-sensitive in a way the rest of this list isn't** — chat history is the one thing
      that disappears on someone else's schedule.
- [ ] **SG-6 — Get team leaders into reviews and content.** The one-page field guide for
      capturing raw material already exists and has never been handed out.

## Cross-cutting

- [ ] **X-1 — Account inventory** (read the section above — inventory, not passwords).
      Underpins X-4 and X-5.
      **⚑ Aliases belong in it, not just mailboxes.** 2026-10-01: `M.Sharpe@SixfoldColorado.com`
      turned out to be an alias on `Contact@`, which is invisible from outside and changes who
      can read mail sent to it. An inventory that lists mailboxes but not their aliases misses
      exactly the thing that decides access.
- [x] **X-2 — QR audit across everything.** ✅ **Done 2026-09-29** — all 13 assets decoded, 2
      destinations, **no defects found**. Register: [shared/qr-register.md](shared/qr-register.md).
      It turned up three *gaps* rather than errors, now split out below.
- [ ] **X-2a — Sixfold has no review QR.** Blocks X-3 at parity with Surge. **Needs Sixfold's
      Place ID or `g.page` review link from its Google Business Profile** — then the generator
      makes the family and Surge's review collateral can be reskinned.
- [ ] **X-2b — Surge has no general/social QR**, only a review one. **⚑ Gated on SG-2 — the
      moment the Surge socials are all built, they need one scannable front door.** Linktree is
      the obvious route but not the only one: a page on the Surge site is the version Surge owns
      outright, and does not depend on a free tier staying free. Decide the destination first,
      generate the code second — see the Linktree lesson in
      [shared/qr-register.md](shared/qr-register.md).
- [ ] **X-2c — Future Sixfold collateral should point at the website, not Linktree.** Not a
      reprint — the cards are done. See the register for why this matters more than it looks.
- [ ] **X-3 — Reviews push**, both entities. The real Google review link, Place ID and QR
      collateral already exist for Sixfold. Overlaps SG-6.
- [ ] **X-4 — Move everything you manage onto the right email accounts.** Needs X-1 first or
      you'll miss things.
- [ ] **X-5 — Inbox sweep** — Surge, Sixfold, personal.
- [ ] **X-6 — Content plan, schedule, and start posting.** Both entities, separate voices,
      never blended. ⚑ **Standing rule: I draft and stage, nothing gets posted or scheduled
      without your explicit go each time.**
- [ ] **X-7 — Ad budget and cost-per-lead discipline.** Currently $50/day on one Meta ad with no
      review date set. Do this *with* the first week's numbers rather than before them.
- [ ] **X-8 — Weekly analytics pull** across everything running. **Do this last** — it's a
      wrapper around things that are still moving, and building it now means rebuilding it.

## Personal

- [ ] **P-1 — Tacoma contract.** **✅ The six terms from the 2026-09-29 conversation are now
      in the document** — see [redline-2026-10-01.md](personal/redline-2026-10-01.md).
      Term 12 months, deposit $7,000, §12 split into Holder default and **Owner default**, a new
      **§6.6 ninety-day mechanical** clause with an as-is carve-out, and escrow and registration
      drafted as **tick-boxes rather than decisions made for you**. The insurance half of term 6
      turned out to **already exist** — additional insured, loss payee, certificate and
      cancellation notice are all in the Insurance Agreement already.
      **⚑ Nothing sent, nothing signed. You're the seller and the buyer is your boss.**
      **⚑ THE MONEY GOT WORSE, NOT BETTER.** The term doubled to 12 months, the deposit fell
      $1,000 and is **still refundable in full**, and you picked up a repair obligation. With the
      12-month ROFR after it that is **24 months you cannot sell**, and if he walks you keep
      **$0** against a $24,000 cash offer that was real on 24 Sep. The 80/20 read means this is
      about what the 20% costs — and right now it costs you everything and him nothing.
      **✅ 2026-10-01, three of his calls are in. (1) The non-refundable deposit is DROPPED** —
      his call, his reasoning: the read is that they buy it out, so a clause that only bites in
      the walk-away case is not worth asking for. Removed everywhere. **Do not re-propose it.**
      **(2) Escrow is settled** — §3 now states outright that Owner remains the owner and the
      named owner on the title for the whole Term, and that **any arrangement requiring him to
      endorse the title before completion is outside the Agreement.** The only remaining choice
      is who physically holds the unsigned certificate. **(3) He is filling in the price
      himself.**
      **⚑ “DUAL REGISTRATION” CANNOT BE DONE — AND DOES NOT NEED TO BE.** Checked against the
      statute. **C.R.S. 42-3-113(2):** registration cards are issued **to the owner**, so adding
      Brandon to the registration means adding him to the **title**, making him a co-owner — the
      lienholder exposure already rejected, by another door. **C.R.S. 42-3-113(6):** the card
      must be *“in the possession of the driver or carried in the vehicle”* — **the statute asks
      where the card is, not whose name is on it.** So §5.1 keeps the truck in Matthew’s name and
      a new **§5.6 + Exhibit E** do the job the proposal was reaching for: registration card,
      proof of insurance, and a signed one-page **Authority to Operate** in the glovebox, with a
      notary line. It answers the roadside worry better than a second name would.
      **✅ AUDITED 2026-10-01 — six defects found and fixed**, four of them introduced by the
      redraft and **two that pre-dated it**. The two that mattered most:
      **⚑ §13 did not survive outcome (b)** — the clause keeping this deal out of the employment
      relationship died exactly when the deal failed and they still worked together. It now
      survives however the Agreement ends, and says so itself.
      **⚑ A note claiming §12(a) and §12(b) mirror each other would have handed Brandon a 10-day
      cure right on concealing the truck, not returning it, and using it in a crime** — the
      three things you need to act on at once. Replaced with the real asymmetry and why.
      Also: an ambiguous §12(b)(3), Exhibit A having no mechanical section to baseline §6.6
      against, an ambiguous 90-day window, and §5.6 not covering every way the Term can end.
      Re-runnable: `node personal/audit-agreement.mjs` — all checks pass.
      **⚑ NOT READY TO SIGN. Of 113 blanks, ~14 are decisions; the rest are identity, dates
      and exhibit line-items filled at handover.** The decisions: the price, the §6.6 repair cap
      (uncapped, one transmission costs more than the deposit), **the §6.4 mileage cap**, the two
      refund day-counts (§8(b) and §11), the ROFR deposit, venue county, the escrow tick-box, and
      **four coverage limits in the Insurance Agreement** — those limits are the pot your assets
      sit behind.
      **⚑ THE MILEAGE CAP IS THE ONE TO NOTICE.** §6.4 is unticked and both figures are blank,
      and §8(b)(3) can only deduct “mileage overage under Section 6.4” — **no cap set means no
      overage to deduct.** That mattered less at six months. At twelve it is the biggest
      uncompensated transfer left: a year of miles, truck handed back, $7,000 refunded in full.
      It is **not** the non-refundable deposit by another name — it is payment for value actually
      consumed, standard in every lease, and it costs Brandon nothing if he buys.
      **⚑ Still unresolved since 2026-09-23 and it now has teeth: whose names are on the physical
      title.** §1 carries a clear-title representation and the new §12(b)(4) makes an untrue §1
      representation an **Owner default**. Check the paper title before signing anything.
      **This is the highest-consequence item on the whole list** and the only one with a
      counterparty waiting on you.
- [ ] **P-2 — Stringline plan**, finalise and start pushing. Still ahead: the full USPTO search
      and the LLC-vs-trade-name question. Nothing registered yet.
- [ ] **P-3 — Clear the phone photos.** ⚑ **Confirm they're in the OneDrive mirror before
      deleting anything** — and Sixfold has a standing photo gap, so check whether any job
      photos on there are the only copies before they go.

---

## ⏰ Dated reminders — check these at the top of a session

| When | What |
|---|---|
| **3 Oct** | **SX-1b(2)** — ask Matthew for the PPE counts and sizes back from Brandon and Brad |
| **7 Oct** | **SX-3a** — last safe signing day for Kara to keep the 12 Oct start |
| **8 Oct** | **SX-11** — Karen on Nextdoor, and **SG-5** — pull WhatsApp again |
| **12 Oct** | Kara's aeration job |
| **late Oct** | **SX-1b(3)** — if the snow blower is still unconfirmed, there is time to rent or subcontract; in December there is not |
| **1 Nov** | Kara's first monthly payment · **19 Nov** first monthly visit |
| **early Jan 2027**, then every quarter (Apr, Jul, Oct) | **SX-33 — re-pull the county parcel records** and rebuild the door lists, so a house that sold shows "new owner since" and the old owner's phone, email and notes are set aside (SX-35, built 2026-10-03). Matthew 2026-10-03: quarterly, as a reminder rather than automated. Run the gate (DEPLOY-ROUNDS.md "Refreshing the door lists") |

**⚑ These are written here on purpose.** Session-scheduled reminders do not survive the
session — the register does, and it is read at the start of each one.

## Suggested order — refreshed 2026-10-01

**This week, because they expire or someone is waiting:**

| | Why now |
|---|---|
| **SX-3a** | Correct the DocuSign tags **before Kara signs** — impossible afterwards. Signing by **7 Oct** keeps the 12 Oct job |
| **P-1** | A counterparty is waiting, and it is the highest-consequence item here |
| **SG-5** | Chat history disappears on someone else’s schedule. Nothing else on this list does |
| **SX-10** | One phone call, and the ads and lawn quotes rest on the answer |
| **SX-11** | Dated: **8 October**. A fixed day, not a deadline |

**Next, because everything else sits on them:** SX-1b → SX-2 → SX-3 · X-1 → X-4

**Cheap, and they close gaps the last three days opened:** SX-2b (one source or four steps
every reprice), the chipper-hire guard inside SX-1b(1), SX-9e.

**Share one dependency** — a single-ink mark: SX-5, SX-6, SX-7. Much less work together than apart.

**Last, both need data that does not exist yet:** X-8, SX-8.

**Done 2026-09-29/30:** SX-1, SX-9a, SX-9c, X-2. **Done 2026-09-30/10-01:** SX-2a, SX-4b, SX-9, SG-5, SX-9d.

**Partly done, deliberately not ticked — the list should not flatter:** SX-9d (decided, not
executed) · SX-1b (two of three answered; PPE still open) · SX-3a (envelope fixed and the
spoken notice given; waiting on her signature) · SX-2 (reference set settled, item is wider)
· P-1 (drafted and audited, not signed).

**Reconciled against the commits 2026-10-01.** Eight commits had landed since the register was
last touched and none of them were on it. What changed: SX-2a ticked; SX-2 was three versions
stale; SX-2b and SX-9e are new, both split out of work that shipped with a decision left over;
SX-1b(1) and SX-9c's open flags were answered by checks that had already been run.
