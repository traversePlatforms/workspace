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

- [ ] **SX-2b — Three copies of the quote engine can now drift.** Split out of SX-2a
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

- [ ] **SX-3 — Fire-mitigation funding inside the quote generator.** When a fire quote is
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
- [ ] **SX-9d — Door data: decided 2026-10-01, execution deferred.** Matthew delegated the
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
- [ ] **SX-9b — Still open on the walk list.** The wildfire layer (`TetraTechWUI` exists but its
      `gridcode` legend is undocumented — needs the source doc before it can be trusted), and
      whatever the first real afternoon of knocking says about the lot-size band.
- [ ] **SX-9e — Move `rounds-codes.php` and `secrets.php` above the document root.** Found by
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

- [ ] **SX-13 — “No soliciting” flags in the rounds app.** Matthew's idea 2026-10-01, scoped
      and **not built**: [NO-SOLICIT-SCOPE.md](sixfold/operations/door-territory/NO-SOLICIT-SCOPE.md).
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

- [ ] **SX-14 — Phone numbers on the door list.** Matthew asked 2026-10-01 whether numbers can
      be cross-referenced onto the addresses, and whether an API could be wired in here.
      **Short answer: yes technically, and the far better version is free and already missing.**
      **⚑ THE APP CAPTURES NO PHONE NUMBER AT ALL. THAT IS THE REAL GAP.** A door is
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
      **Two genuinely free exceptions, both narrow and both worth doing before paying anyone:**
      **(1) LLC- and trust-owned parcels → Colorado Secretary of State business search**, free,
      gives a registered agent with an address and often a contact. **These are disproportionately
      the non-resident owners the walk lists already separate out**, so it covers part of exactly
      the group door-knocking cannot reach.
      **(2) The Colorado voter file** is sold cheaply by the state and can carry a phone.
      **⚑ Commercial use of voter data is restricted in many states and I have not verified
      Colorado's rule — do not touch this one until that is checked.**
      **The quality argument matters as much as the price.** A bought number that is stale, that
      belongs to a landlord in another state, and that cannot legally be texted is a bad
      purchase at any price.
      **Recommended order: capture-at-the-door first, the free SoS pass second, buying last or
      never.** The first is free, consented and immediately useful. The second is free and
      legitimate. The third costs money, needs legal advice, and mostly returns landlords.

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

**Done 2026-09-29/30:** SX-1, SX-9a, SX-9c, X-2. **Done 2026-09-30/10-01:** SX-2a, SX-4b, SX-9, SG-5.

**Partly done, deliberately not ticked — the list should not flatter:** SX-9d (decided, not
executed) · SX-1b (two of three answered; PPE still open) · SX-3a (envelope fixed and the
spoken notice given; waiting on her signature) · SX-2 (reference set settled, item is wider)
· P-1 (drafted and audited, not signed).

**Reconciled against the commits 2026-10-01.** Eight commits had landed since the register was
last touched and none of them were on it. What changed: SX-2a ticked; SX-2 was three versions
stale; SX-2b and SX-9e are new, both split out of work that shipped with a decision left over;
SX-1b(1) and SX-9c's open flags were answered by checks that had already been run.
