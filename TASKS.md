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
      plain against busted — [DEPLOY-ROUNDS.md](traverse/app/summit-de59ae83/DEPLOY-ROUNDS.md).
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
- [x] **SX-3a — Kara: get both agreements signed.** **✅ SIGNED (Matthew confirmed 2026-10-06).** **Drafting is done.** Aeration $1,100
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
- [x] **SX-3b — Brian Skelton, Castle Rock: $400 aeration + overseed + fertilize.** **✅ SIGNED (Matthew confirmed
      2026-10-08). The job is Thursday 15 October.** Added in the 2026-10-06
      tidy-up — the job was in the repo (commits `283e7b4`, `1928cd0`, `6f8ec2c`, all 2026-10-05) but not on
      this list.** Packet `sixfold/quotes/Sixfold-Quote-and-Agreement-Aeration-Brian-Skelton.pdf` (6 pp, quote
      in front), DocuSign sheet `sixfold/agreements/brian-docusign-setup.md`, notes
      `sixfold/agreements/brian-skelton-2026-10-05.notes.md`. **Job Thursday 15 October; last safe signing day
      Friday 9 October** (Sunday 11th and Columbus Day Monday 12th do not count). **Nothing sent.** The
      $100/month maintenance is **ON HOLD** until Matthew has more information — not in the packet. Settled 2026-10-05 (notes, Revision): Sixfold supplies the seed and fertilizer, blows the hard
      surfaces and can water in with the owner's system; the Castle Rock Water note went to the in-person packet. Same spoken-notice and certificate-of-completion rules as
      SX-3a.
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

- [x] **SX-11 — Message Karen on Nextdoor, 8 October.** **✅ Matthew reached out 2026-10-08.** Next: her reply,
      then book the site visit and quote. ⚑ **A dated commitment**, and the
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
      ✅ **The tool is built and working** — `traverse/data-pipeline/door-territory/`. First run on
      Monument at 0.7 mi returned **320 doors to knock across 68 streets**, averaging 0.35
      acres, with the non-resident owners separated out. Run it for any place and radius.
      (Those two meeting questions are now **SX-9f**.)
- [x] **SX-9a — Teller and Douglas.** ✅ **Done 2026-09-29** via the statewide Colorado parcel
      composite — `build-walklist-co.mjs`. Castle Rock 1 mi → **1,216 doors**; Woodland Park
      0.8 mi → **1,143 doors**, avg 0.52 acres. Faster than El Paso: both addresses are on the
      record, so no geocoding. **⚑ El Paso cannot use that layer** — it contributes geometry
      only, which is why two scripts exist.
- [x] **SX-9c — Door rounds on the website.** ✅ **LIVE 2026-09-29** at
      `sixfoldcolorado.com/summit-de59ae83/`. Crew codes issued. See [DEPLOY-ROUNDS.md](traverse/app/summit-de59ae83/DEPLOY-ROUNDS.md). **Roster corrected 2026-09-30 and reconciled
      here 2026-10-01: six codes, not three** — Matthew admin; Brandon, Brad, Nneka, Cai and
      Will D crew. **✅ Uploaded, and the curl checks were run against the live
      host 2026-09-30 — reconciled 2026-10-01.** Door JSON **404** (it is not under the document
      root at all, which beats a 403), `rounds.php` **401** without a session,
      `submissions.log` **403** — which closes an assumption carried untested since the site
      went live: this host *does* honour a `.htaccess` deny for `.log`.
      **⚑ But two secret `.php` files returned 200** — see SX-9e. Original scope:
      [ROUNDS-WEB-SCOPE.md](traverse/data-pipeline/door-territory/ROUNDS-WEB-SCOPE.md). The Claude
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
      [WILDFIRE-HAZARD.md](traverse/data-pipeline/door-territory/WILDFIRE-HAZARD.md).
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
      Original scope: [NO-SOLICIT-SCOPE.md](traverse/data-pipeline/door-territory/NO-SOLICIT-SCOPE.md).
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
      and tested 2026-10-02, `rounds.php` + `index.html` — live with the later uploads of both files
      (every batch from 2026-10-03 on carried them). Built from the approved preview. **Upload is `index.html` plus five new
      files** (manifest + 4 icons) into `public_html/summit-de59ae83/`. The API and door data are
      unchanged. Includes the home-screen install, the splash, the keypad sign-in, motion with Undo,
      and the map card. **Fixed on the way:** the map's OpenStreetMap credit link could navigate the
      app away mid-round. 211/211 checks.

- [x] **SX-29 — Mailing list of owners who live elsewhere: ✅ BUILT 2026-10-03.** 7,483 letters
      covering 10,207 properties, with fire hazard and trees near the house. El Paso property
      addresses come from state address points (96% right on 311 known doors). Nothing mailed.
      `traverse/data-pipeline/door-territory/mail/MAIL-LIST.md`. Lists stay out of git, as the walk lists do.
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
- [x] **SX-48 Around our jobs (after GlassHouse): ✅ LIVE 2026-10-03 — went up in the competitor-audit batch (commit `d917514`), verified 19/19 per DEPLOY-ROUNDS.md; ticked in the 2026-10-06 tidy-up.** *Was:* BUILT AND TESTED 2026-10-03, next upload (index.html + rounds.php).
      Every job won in the last 60 days lists the 40 nearest doors still to knock within half a mile, a route
      from the job (Google Maps; driving when the loop is over 2 mi) and an opener naming the street, never the
      house or customer. Strip on the town list; "Knock around this job" on won quotes. From the competitor audit.
- [x] **SX-49 Fire-weather call list (after HailTrace): ✅ LIVE 2026-10-03 (verified).** When a weather alert
      covers a town or a wildfire is within 30 mi, admins get a call list from the alert details: customers won,
      quotes sent, booked doors there, with numbers given at the door and a check-in script (not a pitch).
- [x] **SX-50 Homeowner fire check + report (after Firemaps / Fire Aside): ✅ LIVE 2026-10-03 (verified).**
      17-item visual check per door from the CSFS Home Ignition Zone guide (2021): Done / Needs work / Couldn't
      check + note; every check kept, so after-the-job sits beside before. Printable homeowner report: what to do
      first (Zone 0 first), full check with Before/Now, photos, HB25-1182 insurance + DR 0104CR credit, "not an
      inspection" disclaimer. Export column `fire_check`. Not a certification, and must never be sold as one.
- [x] **SX-51 Book the walk at the door: ✅ LIVE 2026-10-03 (verified).** Quote booked opens "Book the walk"
      at the top of the list: day (Tomorrow + 2 more, or a date), time or "time to agree", and the walks already
      booked that day. Calendar file (reminders a day and an hour before) and a confirmation text the crew send
      from their own phone, only to a number given at the door. Quotes to build lists the walks coming up.
- [x] **SX-52 Measure from the lawn outline: ✅ LIVE 2026-10-03 (verified).** Build quote
      on a booked door opens Quote build with the door: the outline measured (counted near the house, and all
      the grass) in sq ft and acres, Use fills aeration or the lawn lines already counted. Offered, never filled
      in on its own; the scope draft says where the area came from. Redrawing the outline by hand: not built.
- [x] **SX-53 Leaderboard, daily goals, territories: ✅ LIVE 2026-10-03 (verified), admins only.** *(Territories opened to the crew 2026-10-04, `TERRITORIES_OPEN = true`, Matthew's call — DEPLOY-ROUNDS.md.)* Matthew 2026-10-03:
      permission to run it, admins only while tested. `BOARD_OPEN` in rounds.php opens it to the crew. Ranked by
      quotes booked, then talked to; won is credited to whoever booked the door; one daily goal per person; a
      neighbourhood assigned to a person shows on the list. No location tracking. Test sign-ins left out.
- [x] **SX-54 Odds sort: ✅ LIVE 2026-10-03 (verified), switches on at 150 conversations.** Neighbourhoods by quotes expected
      from the doors still to knock, at the rate doors like them (fire hazard x lawn size) have booked, across
      every town (k = 10 toward the overall rate). Admins see it now with the count so far; crew once ready.
- [x] **SX-55 — Upload Training (31 Sixfold lessons, seven headings) + the month-grid calendar.** Added in the
      **DONE 2026-10-05 (late): Matthew uploaded it before bed; verified read-only 2026-10-06 (page = 7675ff2, 31 lessons live). The overnight fixes are a new small batch at the top of DEPLOY-ROUNDS.**
      2026-10-06 tidy-up: committed `a3d2c7f` (Training) and `7675ff2` (calendar) on 2026-10-05, **NOT uploaded**
      — the only ⏳ batch left at the top of DEPLOY-ROUNDS.md. Four steps: `rounds.php`, `index.html`, then
      `training.json` (new; the live list was empty on 2026-10-05, and **this upload replaces every live
      lesson**), then flush. **Order matters: rounds.php and index.html BEFORE training.json.** Lessons live in
      `sixfold/training/`; see `sixfold/training/README.md` for the changes from Surge's method that must not
      be reverted. **Not on this list, all LIVE per DEPLOY-ROUNDS.md and never registered here:** the
      2026-10-04/05 door-app batches — hail, roofs + year built, company.json settings, Roofing preview, maps +
      radar + roof photos, sample door + hail strip, the big build (teams, calendars, lead owners, goals, storm
      list, wind, phone alerts), Profile + roof materials, the commercial test towns + showcase.
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
      [LAWN-SIZE.md](traverse/data-pipeline/door-territory/LAWN-SIZE.md).
- [x] **SX-62 — Facebook (Meta) lead import — DONE 19 Oct, 6:45 pm:** the hourly retry connected the 365 page once Meta lifted the app restriction; the setup pulled 30 days and added 1 new lead (Dave, new intake form), the rest were already in the Pipeline via ClickUp; the 5-minute poll runs clean. **Was: blocked (15 Oct).** "API access blocked": Meta developer account on hold for unusual activity; confirm it, then resume the import and pull the backlog. See the dated reminders.
      **19 Oct:** Matthew confirmed his developer account (both Meta passwords changed, 2FA on, a Boardman OR data-centre login logged out). The app still shows "API access restricted: ensure all admins have confirmed" (the other admin is the system user Pipeline). A new system token is saved on the server (sixfold-private/meta-setup.json) and **the cron retries the setup every hour by itself** (d6c6ded); the half-hourly overnight check reports "Facebook leads: CONNECTED" once it works. Until then: Leads Center CSV → Pipeline → Import leads from Meta.
- [x] **SX-63 — Contact@SixfoldColorado.com app password dead (15 Oct). FIXED 23 Oct:** Matthew made a new app password; put in both secrets.php files without printing (backups *.pre-newpass-20261023); morning email, the Sixfold site form path and the website-lead email queue all sent a test the same day. Old note: Morning email (hourly cron, to Contact@) and the Sixfold site form's email copies fail at sign-in. New app password from Matthew. See the dated reminders. **23 Oct: Matthew is doing it now** ("i will do the password in a moment"). Steps: sign in as Contact@ → Google Account → Security → App passwords → create. Then I put it in BOTH secrets.php files (Traverse `sixfold-private/secrets.php` for the morning email, Sixfold site `sixfold-private/secrets.php` for the form), never printed, and send a test (`morning-email.php --now`). Checked 22 Oct night: every morning email since 14 Oct failed at `auth`; the site form failed once (16 Oct, Lauren A., who still reached the app). The morning email now leaves 365-website leads out (live 22 Oct).
- [ ] **SX-64 — 365 QR link pages: build BEFORE the print is handed out (16 Oct).** Matthew: "before i give any of it out we can build out each form". The printed codes go to 365aeration.com/card, /yard, /truck, /car (live since 16 Oct: `api/go.php` forwards to the homepage `?from=<piece>` and counts each scan, time + piece only, in `~/www/aeration365.com/scan-log/scans.csv`, outside public_html). To do: a Linktree-style page per address (quote button on top and biggest, then call, text, Facebook; reviews only once a review profile exists), the piece carried into the lead so Jen's Pipeline shows "from: truck" etc. /sign is the agreement page, never reuse it. Print files: sixfold/brand/combined-365-2026-10/build-print.mjs. **2026-10-19: the four link pages are LIVE** (sixfold/aeration365-site/api/go.php): quote, call, text, website; scans counted; web leads keep qr: card|yard|truck|car. **Still to do:** the Facebook page link and, once it exists, a Google review link (both go in  at the top of go.php; their buttons appear by themselves), and whether Jen's Pipeline should show "from: business card" on a lead (her view, so Matthew's call).
- [x] **SX-65 — Crew quick quote + Send to office — DONE 21 Oct (live).** Christian and Bria have "Quick quote" (Accounts button on crew accounts): price a lawn on the spot, a yes goes to the office as quoted + said yes in person. Aerate, seed & feed only (aerate-only has no price rule).
- [x] **SX-66 — Recall, the 3rd-call notice, Couldn't reach — DONE 21 Oct (live).** Leads that come back (form, Facebook, Messenger, crew yes, added again, ClickUp change) return by themselves. Quoted, ready to book shows five at a time.
- [ ] **SX-71 — Merge everything to Sixfold 365 (Matthew 23 Oct: "get rid of the sixfold stuff, get rid of the aeration 365 stuff and just transition entirely to the new branding").** Decided 23 Oct: **one phone, (720) 830-4553 (Jen's: she handles intake)** everywhere online; **contact@365aeration.com is the public email**; **website form leads go to Matthew only: in the app (hidden from Jen) and by email to Contact@SixfoldColorado.com, his private inbox** (live 23 Oct, queued and sent by the 5-minute job; needs the SX-63 app password to actually send); Sixfold's extra pages (services, funding, guides) **held** for later, the homepage stays one simple page aimed at the form; social links go in the footer once the accounts are merged. Legal / trade-name items are not part of this list (Matthew). **Phase 1 (site) — LIVE 23 Oct** on 365aeration.com + aeration365.com (www too), both copies byte-identical to sixfold/aeration365-site/index.html + img/; backups ~/upload-backups/before-sixfold365-launch-*-20261023.tgz on the 365 account; form relay checked; Facebook re-scraped both addresses (new title + share picture). Was: the one-page merged design (`sixfold/site-merged-example/`) has the working form (same relay as the 365 site; service groups lawnall / land / multiple / question; way to reach them; how they heard; address optional; QR source) and is on a private preview at https://365aeration.com/s365-new-7571c6/ (noindex). The app accepts the new service groups (live). The agreement, quote and QR pages were already Sixfold 365 since 21 Oct; the QR page's wording updated (live, both copies). **Open before launch:** a Sixfold 365 share image; the SX-63 app password so the lead emails send. (Website leads stay Matthew-only: decided 23 Oct.) Then launch on both copies (365aeration.com + aeration365.com) on his go. **Phase 2 — DONE 23 Oct except Search Console:** aeration365.com already forwarded everything to 365aeration.com (since 14 Oct). sixfoldcolorado.com now forwards every page (301) to the matching section (aeration #lawn, landscaping/clearing #land, fire/who-pays/wildfire-guide #fire, contact #quote, rest to the homepage); the old field-app addresses go to traverseplatforms.com; api/ and .well-known left alone (sixfold/site/.htaccess, server backup .htaccess.pre-365-20261023). **Search Console DONE 23 Oct** (Contact@SixfoldColorado.com account): both properties verified (365aeration.com by HTML file google68855123f21a06fc.html, keep it; sixfoldcolorado.com auto-verified via Workspace) and the change of address sixfoldcolorado.com → 365aeration.com validated by Matthew. **Phase 2 complete.** **Phase 3 — DONE 23 Oct:** app already all Sixfold 365 (company + a365 name); agreement/quote pages carry the badge; Square location renamed + new logos (statement name: check on the next card payment, expect SQ *SIXFOLD 365). **The app's customer emails (signed copy, aftercare) stay MANUAL** — Matthew: an app password needs 2-step on the account behind contact@365aeration.com, which would disrupt Jen's access; don't push it. Still-used templates rebranded (65589be); outdated ones archived to sixfold/_archive-2026-10-23-rebrand/ with a README; signed documents untouched. Team share rebuilt: Matthew drags sixfold/team-share/files/* into the Drive folder. **Phase 4:** Google Business Profile (rename the kept one, close the other), Facebook rename then merge (between ad runs), Instagram, Nextdoor, Yelp, Linktree, footer socials, signs/magnets/cards.
- [x] **SX-72 — Matthew: check who has ever signed in to Contact@SixfoldColorado.com (23 Oct). ANSWERED same day: only Matthew has access. It stays, as HIS private inbox for website leads (the form emails it; Jen never sees it). Not scrapped.** He thinks Brad and Brandon never have; if so they come off the plan and the address can go. Before scrapping it: it is the Sixfold Google Workspace **super admin** account and the sender of the morning email and the Sixfold site form's copies (SX-63), so those move to the 365 mailbox first.
- [ ] **SX-73 — Matthew: update your email signature to Sixfold 365 (23 Oct).** In Gmail for M.Sharpe@SixfoldColorado.com (the address on your 365 card): gear → See all settings → General → Signature → name Sixfold 365 (not Sixfold Colorado), website 365aeration.com, phone (303) 596-9515 → Save Changes. Claude can make a matching signature with the badge to paste in if wanted.
- [ ] **SX-67 — Square: three items for Matthew (found 21 Oct night check).** **23 Oct: Brian paid in full (00, both halves by Square; Matthew confirmed), flag set to Leave it. The Six Fold Colorado Square location is no longer used (Matthew: "we arent using it anymore now that brian is done"), so no confirm screen for it.** **22 Oct, Matthew:** Kara is paid in full; Brian still owes $200 (the app agrees); the $0 was a deposit hold. All three set to "Leave it" in the night check (square-check-ok.json, backup in ~/upload-backups). **Open:** Kyle's first deposit link (Tue 27, $217, order still an unpaid draft in Square) should be deleted because the second link is paid. My delete was stopped by the permission check, so Matthew deletes it in Square or allows it. **22 Oct: Matthew is asking Jen about it first; wait for his word, don't remind.** Kara Rosenstauch: Square kept $1,100, no job in the app (the two $550 invoices); Brian Skelton: his $200 deposit is recorded as "other", not Square, and $200 still shows owed on a done job; a $0.00 charge on 19 Oct (likely a card saved). Nothing changed without his go. Kyle Allen has two Square deposit links (day changed); one paid, the older one may still be open.
- [x] **SX-68 — Sixfold app → Sixfold 365 + the face lift (DONE 22 Oct) (Matthew 21 Oct: "do them all now, u have my permission for the complete overhaul").** Mock-ups: claude.ai/artifact/Ak9Yhajc2ZKzUmyTtakU1D. Sixfold first (name, Ridge mark, icon, forest/cream/ember, Outfit, bottom menu, customer quote page + signing form), then screen-by-screen layouts, then the five editions (TR-29). **21 Oct ~11:35 PM: the first stage is LIVE** on Sixfold: the new name, mark, icons, colours, headings, chip stages, the phone menu bar, and the 365 quote and signing pages on both 365 copies (commit 589fdab; live company.json backup company-before-s365-20261022-053244.json). **22 Oct: stage 2 LIVE:** the lead card as in the mock-up (big name, Call / Text / Email buttons, details as tiles, Reached out? as a grid), the Jobs table in the new colours (its layout is Jen's and stays), a side menu on computers 1280px and wider (top bar from 1100 to 1279). The quote builder keeps its layout (Jen's Quick quote). TR-29 done the same day.
- [x] **SX-70 — Matthew's 22 Oct list — DONE 22 Oct (live).** Turned-off duplicates removed (Brad McPherson, Cai Silva, Christian Jensen, Nneka Smith: their old codes are free again; Will D kept, no active twin). Jobs and My schedule: This week + Pick a day. Remove from leads (Couldn't reach / Not interested / Spam or a duplicate; kept, never deleted). Customers: a job marked Done counts as logged and as the last visit (Randy now $468, 20 Oct). Results: leads from ads, Messenger, the websites and calls tied to their house and counted with the doors, plus a Where they came from table; 26 of 60 have no house on file yet (17 Facebook), shown on the page. Alerts already worked on computers; the wording now says device, not phone. Gas: EIA weekly Denver regular, checked at most once a day when a quote is priced.
- [x] **SX-69 — Fable's clean-up of 21 Oct's code — DONE 21 Oct (night).** rounds.php tidy, Peak desk and .gitignore taken in, tested and live (319f7e0, cd039d5, 453ad57). Fable found the desktop tools row bug; it went back to 20 Oct (office lost Pipeline and quick quote, managers lost Leads) and is fixed in 589fdab. Report-only items left: houseFacts range has no v2 check (rounds.php lookup-house branch), ensureBookedCustomers replays everything on each poll, a setMe() helper for the four places S.me is set.
- [ ] **SX-60 — Jobber export: TABLED, look into later.** Matthew 2026-10-15: "Table the export to Jobber for now, but keep it in the list as an option we wanna look into." The "Door bookings for Jobber (CSV)" link is hidden on the Pipeline (the `jobber` action still works). Revisit: whether Sixfold moves jobs into Jobber, or the app's own Jobs board is enough.
- [ ] **SX-61 — Lead owner dropdown: TABLED.** Matthew 2026-10-15: "Remove the owner drop downs ... its not needed at the moment, can table it for now." Hidden on lead cards (`leadOwnerRows` kept in the code; server actions unchanged). Revisit when more than one person works the leads.
- [ ] **SX-58 — Connect Square to the app (365).** Asked 2026-10-15 (Matthew: "Add connect square to the app to do list").
      **2026-10-15 SANDBOX LIVE (4d172d5, square-test 29/29):** deposit pay link on the one-page form (pay, then sign), Check the payment on the lead, balance pay link on the job card, webhook endpoint `https://traverseplatforms.com/api/rounds.php?action=squarehook` (waits for the signature key). Sandbox keys = admins only. **Next:** Matthew adds the sandbox webhook + signature key; tests one form himself; then production token + the 365 location.
      Matthew's part: a developer app at developer.squareup.com, Sandbox token + location ID first, saved to `~/.ssh/square.json` (never in chat); a `payment.updated` webhook + signature key. Build: a pay link for the deposit (the amount Jen sets, half by default) sent with the one-page form; the deposit marks itself paid when the webhook arrives; a pay link for the balance on Brad's job card. Production with payments/orders permissions only; the code reads the 365 location only (Square permissions are account-wide).
- [ ] **SX-57 — Facebook Messenger enquiries into the app (365 page).** Asked 2026-10-14, **not now** (Matthew: "add that to the list of stuff to do we dont need to do it right now").
      Lead-form leads already arrive by themselves (every 5 min). Messages need `pages_messaging`, which Meta only offers after **App Review** on the "365 Aeration and Seeding leads" app (Business Verification likely too). Plan when it's time: add the messaging use case, record the screencast Meta asks for, submit; then a webhook or poll turns a new conversation into a lead (source Facebook Messenger). Until then Jen adds message enquiries with + Add a lead. Pairs with the Messages ad on Matthew's list.
- [ ] **SX-56 — Walk desk: book walks with Brandon or Brad from the leads (Sixfold only).** Asked 2026-10-14.
      **2026-10-15 LIVE (cb2bdff, 84f4905):** Who goes is a dropdown on every booked walk (Nobody yet / Brandon / Brad), walks can be "Any time that day"; Brandon + Brad ticked Does walks. 365 jobs: crew picked from a list of everyone (not the office), no tick needed. Kelly Goodridge still to be entered (need her number/email).
      **LIVE 2026-10-14 (commit 796ed96, live check 13/13).** Built and tested the same day (74 checks). It has four parts:
      - **Office role:** for Jen (Pipeline, leads, calls and emails, booking walks, everyone's calendar; no accounts, downloads or settings).
      - **"Does walks" switch** in Accounts.
      - **"Book the walk with someone"** on every lead and door booking in the Pipeline. Both walkers' days show side by side with their free times, and a double booking is warned about.
      - **For the walker:** the walk goes on their calendar (and calendar feed) with everything for it, and their phone gets an alert when it is booked, moved, handed over or cancelled. Their home screen lists their walks, and they record Quote sent / Done / Nobody there.
      Switched on by `features.walkdesk` in Sixfold's company.json only. The editions carry the code switched off.
      **Call tries LIVE 2026-10-14 (d68cfa8):** No answer / Left voicemail / Talked to them on each lead, try again next day, 4 misses then a last text or email (opened on the caller's own phone, filled in), To call in groups.
      **House lookup LIVE 2026-10-14 (4de73b1)** for 365 Aeration: address to lawn range plus confidence, lot, year built, water, miles; tied to leads with the customer's answers; Brad's lawn check. **Next:** quote generator (needs prices from Bryce's memo or Matthew), the customer quote page as 365 Aeration (needs the domain), and job scheduling to Brad. **Data:** 45 miles around 333 W Hampden Ave; phase 0 (Denver, Arvada, Boulder) running, phase 1 still to plan.
      **Jobs board LIVE 2026-10-14 (525792d, jobs-test 38/38, live check from the server):** four arrival times per crew per day (9:30-10:00, 12:00, 12-2, 3:00, from Randy’s sheet), Sunday closed, each crew’s town of the day; book from the quote, the ready-to-book list or an open slot; price, package, whole/front/back, seed and fertilizer, payment (unpaid / deposit + how / paid / service plan), card on file, notes; booking marks the lead Won; on the crew’s calendar and feed with an alert; Brad’s job card says what to collect and takes Done + amount collected; month total. **Live crew list is EMPTY until Brad is ticked "Does walks".** Next: the customer quote page in 365 branding.
      **2026-10-14 evening (eb8733a, LIVE):** customer quote page at 365aeration.com/q/ with Jen’s offered day and one "Book it" button (books the job, lead Won); rented homes (116,552) in Jen’s House lookup only; search ignores town/CO/ZIP; Customers for the office. **Next:** small lots (under the door-list minimum, e.g. 7115 Newhall Dr at 0.119 ac) need a parcel re-pull per town; lawn sizes for the lookup homes; the missing 45-mile towns (phase 1). Loveland (6267 Blackhills Ct) is ~51 mi out: Matthew’s call.
      **2026-10-14 night (419dc10, LIVE):** Sixfold website form posts leads to the app (shared key); Facebook lead fetch built, waiting on Matthew’s Meta app + token; search takes pasted lead lines; Kara’s $1,100 visit marked done. Crons fixed by Matthew and verified 2026-10-14; Facebook feed connected (365 page) and running every 5 min.
      **2026-10-14 late (c0f2f80, f232035, d084676, LIVE):** Jen’s phone-quote flow (calls, voicemail note, Yes/Call back/No, half deposit, one-page form signed on 365aeration.com books the job); lead card shows the property photo and stats. **Brandon: review the agreement wording.** Overnight: Centennial top-up + 10 new towns + rented-home lawns + Denver/Arvada/Boulder trees (run-overnight-2026-10-14.sh); new towns need wiring + upload after. Fable reviewing today’s code.
      **Matthew to do after upload:** make Jen's sign-in (role Office); tick Brandon and Brad "Does walks"; Brandon and Brad each turn on alerts on their phone.

## Surge

- [ ] **SG-1 — Site edits from Brandon's and Lance's evaluations.** **Blocked on you sending me
      their notes** — I don't have them. Also note staging is two commits behind local, so
      re-bundle before anyone reviews anything.
      **Update 2026-10-06 (tidy-up):** the "two commits behind" line is stale — staging carries the
      candidate-first rewrite (commit `550a0b2`, bundle `surge-site-2026-10-05.zip`, verified 60/60
      on 2026-10-05), which applied the office's staging review document dated 2026-09-29. **Whether
      that document IS "Brandon's and Lance's evaluations" is not on record** — if it is, this item is
      done apart from Brandon's check of the out-the-mud wording and Matthew's own walkthrough; if
      their notes are something else, it is still blocked on them. Live surgeftw.com is still the
      WordPress placeholder.
- [ ] **SG-2 — Finish the remaining social accounts** and level the branding across all of them.
      The cross-platform kit already exists for seven platforms, draft-only.
- [ ] **SG-3 — Surge Linktree** — accuracy pass. Pairs with X-2.
- [ ] **SG-4 — Google Drive for Surge content.** Sixfold's team share is a working model to copy.
- [x] **SG-5 — Pull down the WhatsApp content** from the Surge chats while it's still there.
      **✅ PHOTOS PULLED 2026-10-01.** The urgent half is done — the thing that disappears on
      someone else's schedule is off the clock.
      **✅ Pulled again 2026-10-08 (Matthew).** The next sweep has no date yet.
      **⏰ (was) REMIND HIM 2026-10-08: pull again. Content comes in regularly**, so this is a
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
- [ ] **SG-7 — Update the website blog every 2 weeks (recurring, Matthew 2026-10-21).** A new or
      refreshed post on surgeftw.com /blog/ every two weeks, starting from 21 Oct 2026; first due
      **4 Nov 2026**, then 18 Nov, 2 Dec, and on. Surge rules apply in full: read
      `surge/brand-voice-company.md` and `surge/brand/notes/RESTRICTED.md` first, research standard
      and fact-check log, draft only — **publishing the post to the live site still needs his go**
      (and the site itself is not launched yet; until then a post goes to staging).

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
      **Unblocked 2026-10-04:** Matthew supplied the link, `https://g.page/r/CdxyzSzq9tvEEBM/review`,
      and it is live in `traverse/app/data/rounds/docs/money.json` (`links.googleReview`) behind the
      app's "Ask for a review" text. **The QR family itself is still to generate** — noted in the
      2026-10-06 tidy-up.
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
- [ ] **X-10 — Access that saves you clicks, when each comes up** (Matthew 2026-10-09: "add them to the list"):
      **(a) ✅ DONE 2026-10-10** (Sixfold + Surge keys working; the Surge key covers staging and live) — SSH keys for the Surge and Sixfold SiteGround accounts (Site Tools → Devs → SSH Keys
      Manager; save in `C:\Users\Surge Inc\.ssh\`; send the password + Hostname/Username/Port). **(b) ✅ DONE 2026-10-10** (key "claude", stored privately) — a Porkbun API key when
      the .app domains or DNS changes come up (Porkbun → Account → API Access, switched on per domain). **(c)** Fewer
      permission prompts: allow the routine read-only commands that keep asking. Guardrails stay: buying, publishing,
      sending and public changes going live still need your go.
- [ ] **X-9 — A new off-computer backup.** OneDrive went with Microsoft 365 (2026-10-09), so the laptop is now the
      only copy of everything (repo, video, photos, personal). Pick a personal Google Drive (15 GB free; not Sixfold's
      Workspace) and/or an external drive, and the nightly 6 PM mirror gets pointed at it.

## Traverse

Matthew's own field-sales app ([traverse/](traverse/)), its five editions and the data behind them. Added 2026-10-07.

- [ ] **TR-1 — Send the building permit records requests.** Six towns publish no permit list:
      Castle Rock, Parker, Castle Pines (Roofing and Solar), Arvada, Centennial, Thornton (Solar).
      One letter, filled in per town, asking for re-roof and solar permits since 2016 (addresses,
      dates, types; no names) —
      [permit-records-requests-2026-10.md](traverse/research/permit-records-requests-2026-10.md).
      **Castle Rock takes requests only through its online Open Records Center, not email.** Castle
      Pines' and Centennial's routes weren't confirmed: find them on each town's site. Towns may
      charge after the first hour; the letter asks for a quote first. When a file comes back, drop it
      in `traverse/data-pipeline/door-territory/permits/raw/` and tell Claude the town.
      **Request numbers (keep):** Arvada **2026-580**, security key **8A7D2581** — "All other records" (the
      permit list). Arvada **2026-579**, security key **B9809CE7** — filed under the other request type (Matthew
      thinks plans/blueprints), sent in case it helps. Both 2026-10-08.
      **Where it stands (2026-10-08):** **Parker — sent. Centennial — sent. Castle Pines — emailed. Arvada — sent.
      Thornton — sent.** Only **Castle Rock** is left.
      **2026-10-10:** **Thornton — DONE**, report received and in the app data (2,889 doors; re-roofs labelled only
      from 2025, solar from 2023). **Centennial** — replied with portal instructions: its self-service portal
      (Search Public Records → Permit → Advanced → Permit Type + Issued Date → **Export**) exports a date range,
      so Matthew can pull it himself, in yearly chunks. **Castle Pines** — one record at a time only; dropped for now.
      **Parker** — sent a 2023–2026 zip; it's still in his email, to save it to the computer.
      **Later 2026-10-10: Parker DONE** (monthly reports, matched on parcel: 3,211 of 24,715 doors) and **Centennial DONE**
      (I read its public permit search myself, a year at a time: 8,899 of 17,632 doors, 2018 on). All three LIVE on Roofing
      and Solar the same day. Left: **Castle Rock** (call), **Castle Pines** (one at a time; dropped), **Arvada** (request
      2026-580 pending). **Castle Rock** — its portal
      only takes one address per property-records request; next step is calling the Building Division
      (720-733-3527) to ask for a town-wide re-roof/solar report or the right request type. **Castle Pines** —
      no form found; email the letter to its Building Department (buildingdept@castlepinesco.gov, 303-705-0227),
      asking them to pass it to the City Clerk if needed. **Arvada** — use "All other records" (its online permit
      search is one address at a time). **Thornton** — forms.thorntonco.gov/CityClerk/RequestForPublicRecords or
      clerk@ThorntonCO.gov. **Parker police:** optional, the crime-list letter in
      [crime-records-requests-2026-10.md](traverse/research/crime-records-requests-2026-10.md) would put Parker on
      TraverseSecurity's crime map.
- [x] **TR-2 — Apply to AccuLynx for integration access.** **✅ Matthew emailed api@acculynx.com 2026-10-08;
      waiting on their answer.** AccuLynx's developer docs say businesses
      integrating for their customers must request access first, or the roofer's account can be suspended;
      so TraverseRoofing doesn't connect to AccuLynx until they say yes. Their request form is gone, so it's
      an email to api@acculynx.com — drafted in
      [acculynx-access-request-2026-10.md](traverse/research/acculynx-access-request-2026-10.md).
      **Decide the company line first** (Traverse Platforms LLC isn't filed and the site isn't live; your own
      name works). Roofers also need AccuLynx's paid AppConnections add-on to make a key.
- [x] **TR-3 — Domain + hosting.** ✅ **traverseplatforms.com bought 2026-10-09** (Porkbun, renews $11.08/yr, privacy
      free, auto-renew on) and a **SiteGround GrowBig** account ($4.99/mo first year, then $29.99/mo — look at it before
      the year ends). Nameservers on SiteGround, Let's Encrypt + HTTPS Enforce on, homepage and editions page live (still
      noindex: sample pricing, placeholder contact email). The .app edition domains are not bought.
- [ ] **TR-5 — More export options (someday, not now).** Matthew 2026-10-09: SalesRabbit exports into more platforms than
      Traverse does. Today Traverse has JobNimbus (live send + CSV) and a Jobber CSV; AccuLynx waits on their reply (TR-2).
      Look at which CRMs roofers, solar and pest companies actually use before adding any.
- [~] **TR-6 — Roof material for Roofing's new Front Range towns.** ✅ **2026-10-10: the 2020 state photo, 2023 close-up and outline are LIVE for all five** (every door has both photos; outlines on 106,226 of 113,281). ~~Left: roof material only.~~ ✅ **2026-10-11 ~1:15 AM: roof material + year built LIVE** (Roofing, and Solar for Thornton; 12 files, md5-checked, live-checked as Claude Check). Material per town: Thornton 100% (28,712 county record), Commerce City 100% (13,875 county), Erie 95% (5,259 county, rest from the photo), Denver 90% (15,474 photo, 20,806 photo’s guess shown as "probably"; Denver records no roof cover). **Centennial: none** — Arapahoe publishes no year built or roof data, and the photo-only model reached no confidence threshold, so it calls nothing (a records request would fix it).
      **Year built — what each county publishes (checked 2026-10-10, county pages):**
      | Town | County file | Year built | Roof cover recorded |
      |---|---|---|---|
      | Thornton, Commerce City | Adams assessor "Detailed Data Dump – Appraisal" (zip, twice a year) | YEARBLT | **yes** (ROOFTYPE, ROOFCOVER) |
      | Erie (Boulder side) | Boulder assessor Buildings.csv (daily) | builtYear, EffectiveYear | **yes** (Roof_Cover) |
      | Erie (Weld side) | Weld assessor "All Data (CSV)" (weekly) | not yet checked | not yet checked |
      | Denver | Denver open data "Real Property Residential Characteristics" (212,852 homes, updated 2026-10-08) | CCYRBLT + CCAGE_RM (remodel) | no |
      | Centennial | Arapahoe: no public bulk download found | — | — |
      So Adams and Boulder give RECORDED roof material (like Douglas, no model needed); Denver gives year built and
      remodel year for the model; Centennial needs a records request (or the model without year, weaker). Terms on all
      four: as-is disclaimers, no stated ban on reuse. Original note: Thornton, Centennial,
      Erie, Commerce City and Denver went live on Roofing 2026-10-10 with hail, wind, roof size/pitch and permits (Thornton,
      Centennial), but none of the three extras the older towns carry. The close-up and outline need only the photo window
      index and outline-photos.mjs (add the towns to roofs/material TOWNS lists). **Material needs year built**, which comes
      from each county's assessor (Adams, Arapahoe, Boulder, Weld, Denver: none pulled yet); without it the model is weaker.
      Matthew's call on material; crop downloads ~3.5 min per 1,000 doors (~7 h for all five).
- [~] **TR-12 — In-app texting (Twilio).** ✅ **Built 2026-10-10, commit 9657ec6, NOT uploaded, off everywhere.** Text a
      homeowner from the door (only a number saved as "given at the door"), a lead card or a customer card; the thread stays
      with them. Server rules: never a looked-up number, quiet hours 8 am–9 pm Colorado time, STOP/START replies, the first
      text adds "<name>, <company>. Reply STOP to opt out." Replies come in on `?action=smsin` (Twilio signature checked).
      Mock test 21/21 (18/18 after 9 pm, when the quiet-hours refusal is what's tested). **Matthew's part:** a Twilio
      account, a number, and the **A2P 10DLC brand + campaign registration** (US carriers block unregistered business texts;
      takes days to weeks); then keys in `<install>-private/sms-config.php` (shape: api/sms-config.example.php), the number's
      webhook set to the install's `?action=smsin`, and `features.sms: true` in that install's company.json. Cost per text and
      the 10DLC fees: not checked yet (Twilio's pricing page). TCPA/state rules stay each company's responsibility.
- [~] **TR-15 — Sell outside Colorado: the metro builder.** ✅ Built 2026-10-11 (commit ac88760): `node build-metro.mjs <metro>` from
      `traverse/data-pipeline/door-territory/metros/<metro>.json` (towns + where each county publishes parcels). First market **Dallas–Fort Worth**
      (Collin CAD, homestead = owner-occupied): McKinney 49,874 · Plano 54,120 · Frisco Collin side 26,090 homes, with value, year built,
      house size, wildfire, hail, wind, FEMA risk, census. **Not yet for metros:** laser-scan roof size/pitch and solar (no public USGS
      survey reaches Collin County yet), aerial photo / outline / roof material, lawn and trees, permits, crime. **Not in any edition yet:**
      a DFW install needs "dfw" in its company.json townGroups, a Collin County name in the app, and a hosting decision (Matthew).
      Denton County (rest of Frisco) is one more source in the config. Storm and census steps finished 2026-10-11 (commit 662d274): 24 hail days, 20 wind days since 2020.
      **Market installs built 2026-10-11 (commit 86a72ea, Matthew chose one install per market):** a client file with
      "market": "dfw" makes a Texas install (own towns, Central time, Texas storms, Texas 2022 photos, Collin lot lines, nothing
      Colorado). Shared code LIVE on all six installs 2026-10-11 (23 files, md5-checked; no install has a market, so all stay
      Colorado). **TABLED by Matthew 2026-10-11** ("lets table texas"). When it returns: Texas roofing law (federal rule only now),
      the first Texas client, Denton County for the rest of Frisco.
- [x] **TR-16 — Monthly permit refresh.** ✅ 2026-10-11: `traverse/ops/refresh-permits.sh`, Windows task "Traverse permit refresh"
      (1st of the month, 4:10 am, runs when the laptop next wakes). PPRBD, Douglas County and Centennial re-fetched; stops and uploads nothing if
      a source or town shrinks; uploads only changed permit files to Roofing and Solar with backup + md5. Parker/Thornton stay manual (records
      requests). Log: traverse/ops/logs/permit-refresh.log. First run 2026-10-11: PPRBD +152, Douglas +45, Centennial −370 (−1.7%),
      every town within a few doors; 16 files each to Roofing and Solar, md5-checked.
- [ ] **TR-14 — Walkthrough video: ON HOLD (Matthew 2026-10-13: remake it once the features are final; cut 1 is out of date).** Made 2026-10-11, all in
      traverse/videos/roofing-crew-phone/: `roofing-crew-phone.mp4` (TraverseRoofing, a crew member's day, phone, 2:42,
      captions only), `-voice-joe.mp4` (free male voice) and `-voice-kristin.mp4` (free female voice), plus the
      voice-over script `roofing-crew-phone-voiceover.md` if you'd rather record your own. **Decide:** keep the story as
      it is or change scenes/lines; your own voice, joe, kristin, or a paid voice (ElevenLabs etc., prices not checked);
      speed. **Then** Claude makes the rest — every edition × crew / manager / admin × phone and desktop — each with its
      own storyline and a dry run first. Known nits: "Good morning" shows at the 4:45 PM scene and the storm report says
      8:30 AM (the app reads the real clock); the time picker can't be drawn, so 5:30 PM just appears.
- [ ] **TR-17 — Try Desktop layout on a tablet (Matthew).** Added 2026-10-11. Once the change list is live: Profile → Layout →
      Desktop on an iPad or other tablet; it should show the computer layout shrunk to fit the screen (the test browser could not
      shrink it the way a real tablet does). Say if it is too small to use or anything is cut off. Tablet puts it back.
- [x] **TR-19 — Overnight 2026-10-11/12 work: ✅ LIVE (checked 2026-10-13: live rounds.php is byte-identical to the current source, which contains 19b0c70).** Built and tested, NOT live: security fixes (19b0c70),
      speed (7cbbaf7), Spanish sweep (6552394), Yards +Thornton/Erie/Commerce City/Centennial (0cad359). Regression 85/85,
      editions 20/20, change tests all pass. Contract outline for the attorney: traverse/business/client-contract-outline-DRAFT.md.
- [ ] **TR-20 — More Yards towns, then new towns.** Next nights (lawn + trees, one parcel-heavy job at a time): Colorado Springs x4
      (Sixfold's home market: Matthew's call), Denver, Arvada/Boulder/Windsor, Security-Widefield/Fountain. Then build Aurora
      (Arapahoe + Adams), Littleton, Lakewood, Longmont; Larimer (Fort Collins, Loveland) needs its county data found first.
      Plan and figures: traverse/research/markets/yards-markets-2026-10.md.
- [ ] **TR-21 — The prospect list.** 9,102 active Colorado companies by trade (state register, matched by name):
      traverse/research/prospects/prospects.csv (off git). Needs phone/website lookup before any outreach; nothing sent.
- [ ] **TR-22 — Lawn colour (greenness), next growing season.** Tabled by Matthew 2026-10-12 "for the upcoming season". It is
      live only for the 734 large lawns of the SX-31 trial (lawn photo: this summer vs last, browned/greener than neighbours).
      **May 2027:** run `node ndvi-trial.mjs --month=2027-06` (SX-42; May–Sept only, winter refused), widen to every medium and
      large lawn, then `node build-lawn-outlines.mjs --green-only` and upload; consider "browned this summer" as a reason to knock.
      Satellite pixels are ~30 ft (10 m), so small lawns stay unreadable.
- [ ] **TR-23 — Paid hail feeds, when there is income.** Noted 2026-10-12 (Matthew: "add the paid feeds to the notes for a later
      upgrade as we get income in"). Today: NOAA radar MESH daily + hourly, NOAA Storm Events ground reports, NWS same-day spotter
      reports (all free). Later, priced per seat/month by quote: HailTrace, Interactive Hail Maps (HailStrike/ CoreLogic Weather
      Verification are the insurer-grade tier). They sharpen swaths and size near the house; compare one storm against ours first.
- [ ] **TR-24 — Review the homepage FAQ (Matthew).** Added 2026-10-13. Eight questions live on traverseplatforms.com (#faq); add or
      remove what he likes. Source: traverse/marketing-site/project/Main.dc.html (the faq list in the 2026-10-13 pass), then rebuild + upload.
- [ ] **TR-25 — Review the homepage screenshots (Matthew).** Added 2026-10-13. "The real app" section: Roofing on a computer and a
      phone, names and addresses masked (traverse/videos/tools/shots.mjs, local test copy only). The map still shows that
      neighbourhood's real street names.
- [ ] **TR-26 — Founder offer (Matthew to decide).** Added 2026-10-13. Today: a 14-day free pilot + 30% off Pro for 12 months.
      Options raised: shorter trial, deeper discount, or a founder price locked for as long as they stay subscribed.
- [x] **TR-27 — Booking emails need a Gmail app password + privacy@ alias (Matthew).** ✅ App password in place 2026-10-13, test email sent (Google accepted it); ✅ privacy@traverseplatforms.com added as an alias the same day (beside hello@, support@, billing@). Added 2026-10-13. Until the app password is in
      traverse-site-private/site-config.php, demo bookings are saved and shown on the manage page but nobody is emailed.
- [ ] **TR-18 — The client contract (Matthew + an attorney).** Added 2026-10-11. What a company signs before it gets an install:
      a licence to use the door data inside the app only; no bulk copying, export or resale; what happens to their data and access
      when they cancel; who owns what (their customers and notes are theirs; the door data is Traverse's); payment and seats; and the
      data-protection side (the Colorado Privacy Act question flagged earlier). The app now backs it up: only Traverse's super admin
      downloads the door list, 500 at a time, and every download is logged. An attorney should draft or review it.
- [~] **TR-13 — Billing (Stripe).** ✅ **Built 2026-10-10, commit afd2580, NOT uploaded, off everywhere.** Admin-only
      Billing tile: Duo / Crew / Pro, monthly or yearly, seats, second edition on Pro ($20), founding companies get a 14-day
      pilot once + the 30%-off coupon on Pro. Pays on Stripe Checkout; Manage billing = Stripe's portal. Webhook
      `?action=billinghook` (signature checked, this install's events only, repeats ignored) keeps plan/seats/status in
      billing.json. Seats used vs paid warns on Billing and Accounts; **nothing ever locks anyone out** (enforcement is
      Matthew's call, later). Mock test 47/47. **Matthew's part:** a Stripe account (Traverse Platforms LLC, its bank
      account), products + monthly/yearly prices for Duo, Crew, Pro, Second edition, the founding coupon (30%, 12 months),
      the customer portal settings; then per install a webhook endpoint + `<install>-private/billing-config.php` (shape:
      api/billing-config.example.php, every step listed in it) and `features.billing: true`. Start in Stripe test mode.
      Not built: a public sign-up page that makes a new install (installs are still built by hand).
      ✅ **Code uploaded OFF to all six installs 2026-10-11** (Sixfold 85/85 suites, editions 20/20; billing and texting answer "not on"
      live). Turning either on = keys in the private folder + the feature in company.json, nothing else to upload.
- [x] **TR-8 — Company email for Traverse.** ✅ **2026-10-11: done.** Workspace mailbox M.Sharpe@TraversePlatforms.com; MX = smtp.google.com
      (priority 1); SPF passes (Google is inside SiteGround's managed include); DKIM 2048-bit key published and Google shows
      "Authenticating email with DKIM"; DMARC p=none. Left for later: the homepage contact. Original note: Recommended: Google Workspace Business Starter (~$7/user/mo yearly,
      $8.40 monthly — check Google's page), its own Workspace account, not Sixfold's. One mailbox (e.g.
      matthew@traverseplatforms.com) + free aliases (hello@, sales@). **DNS is on SiteGround, not Porkbun**: Google's MX,
      SPF, DKIM and DMARC records go in Site Tools → Domain → DNS Zone Editor (Matthew enters them; Claude walks it).
      Free fallback: SiteGround mail (10 GB shared, weaker delivery). Then swap the homepage's placeholder contact.
- [~] **TR-10 — Backups.** ✅ **2026-10-10: nightly copy of everything that exists only on traverseplatforms.com** (all
      private folders, every log, leads, customers, digests, Sixfold's server backups, app-written settings; ~7 MB) to
      `C:\Users\Surge Inc\TraverseBackups\` (outside the repo — sign-in data; never commit or open), Windows task "Traverse
      server backup", 2:45 AM, newest 30 kept, result in backup.log. Script: traverse/ops/pull-server-backup.sh.
      ✅ **Off-machine copy DONE 2026-10-13:** Google Drive (m.sharpe@traverseplatforms.com), task "Backup claude test 2 to Google Drive"
      6 PM daily: locked archive (git bundle, memory, TraverseBackups, door-territory working data, surge/clients), newest 7, plus a weekly
      photo/video mirror. Old OneDrive task disabled; its 130 GB local copy awaits Matthew's OK to delete.
- [x] **TR-9 — Map tiles: not needed (checked 2026-10-10).** The street map is ALREADY self-hosted: the app draws
      /maps/colorado.pmtiles (146 MB, Protomaps, on traverseplatforms.com since 2026-10-09) on the phone. OpenStreetMap's
      tile server is only the fallback if that file fails to load. Colorado only: a new state needs a bigger file (free
      to build). If a paid fallback is ever wanted: Stadia Maps Starter $20/mo (1M tiles, commercial OK), MapTiler Flex
      $30/mo, Mapbox Static Tiles 200k free then $0.50/1,000 (their pricing pages, 2026-10-10). Free outside services
      still in use, no guarantee: Microsoft Planetary Computer (2023 aerials, close-ups), Iowa State (radar). The hail
      map costs nothing to run and stays included in Roofing.
- [~] **TR-11 — Same address in two towns (bug found 2026-10-10).** Door ids come from the street address alone, so "100
      Main St" in Denver and in Fountain were treated as one door: 56 houses had been dropped from one town, and 20 town pairs
      that share no house were linked, so their logs could read into each other. ✅ Fixed in build-rounds-data.mjs (same house
      only within 150 m), houses restored with their side data, false pairs removed (7 real overlaps kept). **Goes live with the
      next upload** ✅ LIVE 2026-10-10 evening (all six copies now carry the 7 real pairs). Their 2023 close-ups still need a forced houses.mjs run.
- [~] **TR-7 — Split big towns' door files per neighbourhood (server memory).** ✅ **Built and tested 2026-10-10**
      (commit 4d5e077): server-side town cache, no whole-town decode on taps; identical answers on 635 neighbourhoods; a
      Denver tap 190 → 112 MB. **✅ LIVE 2026-10-10 evening** (server town-cache built on first tap per town). Remaining big item per tap: the hail file (unpacked
      for the storm job). Original note: Opening one neighbourhood decodes the whole
      town: Denver's door file alone is ~80 MB of server memory per tap (peak 190 MB with hail and wind), Thornton/Parker
      ~150. Fine under the host's 768 MB, but several crews tapping at once add up. 2026-10-10 already done: side files packed
      in the editions, the best-doors scorer keeps plain numbers (Roofing+Denver towns build ~300 → 234 MB, scores identical).
      Next step if it matters: one file per neighbourhood (or a slim per-town index), and pack hail (the storm job must learn it).
- [x] **TR-4 — Move all six apps to the Traverse hosting** ✅ **Done 2026-10-09:** all six live on traverseplatforms.com, crons moved, everything app-related deleted from Sixfold (its website + secrets.php remain), Sixfold SSH key deleted; the app is the only lead intake for now (the website form just emails). Original note: (Sixfold + the five editions, same folder names on
      traverseplatforms.com). **In progress 2026-10-09:** data and apps copying over SSH. Left: check, set each install's
      address, test, then the switch-over with you — final top-up copy, redirects from the old addresses, the five
      scheduled jobs re-created on Traverse and deleted on Sixfold, crew reinstall. **After: delete both SSH keys** in
      SSH Keys Manager. Sixfold's own website stays on Sixfold's account.

- [ ] **TR-28 — Roofs: finish the laser-scan fix after the property refine.** 2026-10-19: Microsoft's building outlines miss some
      houses, so their roof was read off a shed (3246 Lakefront Dr, Monument: 1.6 squares; really 26.6). The 295 shed-sized roofs
      are fixed and live in Roofing and Solar (121 re-measured from the scan). **Still to run, after the refine pass finishes**
      (it is parcel-heavy on the same state service): `node sample-roofs.mjs --fix=all` in
      `traverse/data-pipeline/door-territory/roofs/` for the ~20,800 doors with no outline and ~9,300 whose outline the scan said
      was off, then build and patch the live roof files the same way (only changed doors). Also re-run Columbine's lawn shapes
      (1,580 failed in the 2026-10-18 internet drop).
- [x] **TR-29 — The face lift for the five editions — DONE 22 Oct (live).** Navy bar and page for all five, each edition's colour on the header strip and icon tiles, flag-orange actions; the old 365 office palette removed (it painted an edition's office account green); office header uses the install's own name; builder now refuses a page with "365 Aeration" in it. Original spec: Same design as Sixfold's on the Traverse system: navy header for all five, each edition's colour on its icon tile and the header strip, flag-orange action buttons, Familjen Grotesk headings. build-editions.cjs needs its anchors updated with the new base colours. Matthew 21 Oct: "Prioritize sixfold app over the other editions since thats the one currently in use."
- [ ] **TR-30 — Sharper, newer photos for lawn quotes: reach out and price them (Matthew 22 Oct: "add reaching out to those companies checking prices etc to the to do list").** Focus: Englewood and about 40 miles out. Nothing is bought, signed or sent without his go; I can draft each note. Who and what to ask:
  - **DRCOG** (Josh Pendleton, jpendleton@drcog.org, 303-480-6784; or the thread Matthew already has open about the 2020 land map): DRAPP 2024 (flown spring 2024) resolution and bands, price through Sanborn, whether a business may use it in its own app, and when it turns free (past years are free once the next flight is out: is there a 2026 flight?).
  - **Sanborn Geospatial** (sells current DRAPP): a quote for DRAPP 2024 over the 40-mile area at 3 inch and 6 inch, licence terms (Sanborn says no recurring fees), delivery format.
  - **Nearmap**: a quote for Denver metro imagery (they fly big metros up to 3x a year, under 3 inch) WITH the AI Lawn Grass layer (square feet of lawn per property) and the API, and written permission to use it inside our app. Their support warns the licence can bar building derived data, so this is the question that decides it. A third-party site says ,000+/yr (not confirmed).
  - **EagleView** and **Vexcel** (commercial side): price per property or per area for current Denver imagery; can it be used in our app. The state’s Vexcel imagery is for governments and their consultants only.
  - **Go iLawn**: price for staff hand-measuring (a third-party site says about $50/month, not confirmed), how old its Denver photos are.
  - **USDA NAIP**: whether Colorado 2025 was flown and when it is published (Planetary Computer has 2023 as the newest over Englewood).
  - First, the free one: the 3-inch DRAPP 2022 trial from Douglas County is in the Wi-Fi queue (job drapp3, 22 Oct); its results say how much better a sharper photo is before anything is bought.

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
- [ ] **P-4 — Matthew's assistant (personal + business clerical), email first: LIVE 22 Oct: keys in, 4 inboxes connected (personal Gmail, Traverse, contact@sixfoldcolorado.com, Surge) and sorting; drafts only.** Page traverseplatforms.com/a-e018bb82/ (setup code given once in chat). He: set his password, paste an Anthropic API key, make the Google OAuth client (steps in assistant/README.md, publish "In production"), connect personal Gmail, Traverse, Sixfold/365. Then I check the first real run. **Anthropic key "Assistant (Traverse Server)", Default workspace, expires 22 Oct 2027 1:00 PM MDT: make a new one and paste it into Setup before then (remind him early October 2027).** Next parts: socials by each platform's own API (drop Blotato), eBay Sell API, links to this workspace and Claude Desktop; everything posts only on his approval.

---

## ⏰ Dated reminders — check these at the top of a session

| When | What |
|---|---|
| ~~20 Oct, first thing~~ | **DONE 19 Oct (connected 6:45 pm).** ~~SX-62 Facebook leads:~~ read the overnight check's "Facebook leads" line (or `ls sixfold-private/meta-setup.json` on the server: present = still waiting). **If CONNECTED:** tell Matthew how many form leads came in (the setup pulls 30 days, skips duplicates) and that Jen has them. **If still waiting:** ask Matthew whether the red "API access restricted" banner is still on the app dashboard; if so, he reports it to Meta developer support (? icon → Report a bug: account confirmed, the only other admin is the system user Pipeline). Remind him he can import the Leads Center CSV meanwhile. |
| **16 Oct, first thing** | **SX-62 Facebook leads blocked:** Meta put the developer account on hold ("Account confirmation needed: unusual activity"; Confirm Account errored on 15 Oct). Matthew confirms it (clean browser / phone app / retry). Then: turn the 5-min import back on if paused, pull the backlog since **14 Oct ~10 pm**, check Jen has them. Until then: Leads Center CSV → Pipeline, Import leads from Meta. |
| **16 Oct, first thing** | **SX-63 Morning email + Sixfold site form email:** the Contact@SixfoldColorado.com Gmail app password is dead (535, both servers; last morning email 7 Oct). Matthew makes a new app password, saves it in ~/.ssh; Claude puts it in both servers' api/config.php and sends a test. Ask whether the morning email should also go to Matthew. |
| **19 Oct** | ~~**365 app mailbox:**~~ **DROPPED 19 Oct (Matthew):** no forms@ seat. Jen sends aftercare by hand like the quotes and forms (Email it from my email / Text it / Copy); no-signature forms send no email; the app adds a mailbox automatically only if sixfold-private/a365-mail.json ever exists. Old item: add forms@aeration365.com in Squarespace (Google Workspace, Starter, about $7.32 a month; the company card was declined on 18 Oct). Allow 2-Step in admin.google.com, turn on 2-Step for forms@ only, make an app password, and save the address and password in `~/.ssh/a365-mail.txt`. Then Claude connects it (sixfold-private/a365-mail.json plus a reply-to of Jen), tests it, and resends the signed copies that never went out (Russ King and one other). ~~Also, before Brad's and Brandon's cards print: B.Long@ and B.McPherson@365Aeration.com don't exist yet.~~ **Done 19 Oct (Matthew):** both added as alternate emails on the main mailbox (they work at both domains through the alias domain), with Gmail filters labelling them For Brad / For Brandon so Jen answers in the right voice. A test email to each @365aeration.com address confirms it. Log the seat in the Spend Ledger. |
| **16 Oct, 6 pm** | Check the Google Drive backup ran by itself (14 + 15 Oct failed: Drive did not restart after a reboot; script now starts it). |
| **3 Oct** | **SX-1b(2)** — ask Matthew for the PPE counts and sizes back from Brandon and Brad |
| **7 Oct** | **SX-3a** — last safe signing day for Kara to keep the 12 Oct start |
| ~~8 Oct~~ | ~~SX-11 Karen on Nextdoor, SG-5 pull WhatsApp again~~ — both done 2026-10-08 |
| ~~9 Oct~~ | ~~SX-3b Brian Skelton's signing day~~ — signed (confirmed 2026-10-08) |
| **12 Oct** | Kara's aeration job |
| **15 Oct** | Brian Skelton's aeration job (SX-3b) |
| **late Oct** | **SX-1b(3)** — if the snow blower is still unconfirmed, there is time to rent or subcontract; in December there is not |
| **1 Nov** | Kara's first monthly payment · **19 Nov** first monthly visit |
| **4 Nov, then every 2 weeks** (18 Nov, 2 Dec, 16 Dec…) | **SG-7 — Surge blog update due.** Remind Matthew; offer a draft post (Surge voice spec + RESTRICTED.md first; draft only). |
| **early Jan 2027**, then every quarter (Apr, Jul, Oct) | **SX-33 — re-pull the county parcel records** and rebuild the door lists, so a house that sold shows "new owner since" and the old owner's phone, email and notes are set aside (SX-35, built 2026-10-03). Matthew 2026-10-03: quarterly, as a reminder rather than automated. Run the gate (DEPLOY-ROUNDS.md "Refreshing the door lists") |

**⚑ These are written here on purpose.** Session-scheduled reminders do not survive the
session — the register does, and it is read at the start of each one.

## Suggested order — refreshed 2026-10-01

**⚑ Stale in places as of the 2026-10-06 tidy-up — the lines are kept as written.** Since 2026-10-01:
SX-9e, SX-2b and SX-9d are done (see their lines), so "cheap, and they close gaps" and "partly done"
below no longer apply to them; SX-3b (Brian, sign by 9 Oct) and SX-55 (Training + calendar upload) are
new and belong in "this week".

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
