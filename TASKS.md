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
      **(3) Nothing owned clears snow** — no blade, blower, spreader or shovels — and snow is in
      Kara’s twelve-month agreement from November.
      Plus the numbers pricing needs: aerator tine spec and type, mower deck width, trailer
      capacity. And no overseeder is recorded, though 200 lb of seed goes down on 12 October.

- [ ] **SX-2 — Finalise the quote program** as far as the information allows. **Now artifact
      version 11, rates v4** (reconciled 2026-10-01) — not v7. Since this line was written: the
      `t30` reprice to 65 man-min, the job-type split, the silent $0 that split introduced, and
      a provenance audit that added a sixth **Timed** badge and moved `dump` and the drive blow
      to `all`. Changelog: [quote-engine.md](sixfold/quotes/quote-engine.md).
      **Known open, unchanged:** job 2 prices out at $2,250 against $1,500 charged and that gap
      has never been resolved. Partly blocked by SX-1.
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

- [ ] **SX-3 — Fire-mitigation funding inside the quote generator.** When a fire quote is
      selected, surface the tax credit / grant / insurer re-score material. **This one is
      genuinely good** — the funding research already exists and currently only lives in a
      pamphlet nobody reads at quote time. Build after SX-2.
- [ ] **SX-3a — Kara: get both agreements signed.** **Drafting is done.** Aeration $1,100
      (5pp) and maintenance $250/mo (6pp), both signed-shape, both with a quote and a DocuSign
      packet. Field map and sending rules in `agreements/kara-docusign-setup.md`.
      **⚑ Three things left, in order:**
      **(1)** The live envelope has optional signature tags on the two Notice of Cancellation
      pages. **Correct the envelope — do not void it.** Deleting a tag sends her no email, and
      it needs no approval from anyone because a misplaced field is not a change to the terms.
      **Only possible while she has not signed.**
      **(2)** Say the three-day cancellation right **out loud** on the phone at the moment she
      signs — 16 CFR 429.1(e); an envelope does not discharge it. Note in the job file that you
      did and when.
      **(3)** **Signing by Wednesday 7 October** keeps the 12 October start. Later is not fatal,
      the job just moves. Download the certificate of completion, not just the signed PDF.
      Maintenance has no deadline pressure — first payment 1 Nov, first visit Thu 19 Nov.
- [ ] **SX-4 — Kara end-of-work email**, carrying the relevant packet material. **The only item
      on the list with a real customer waiting.** No template exists — what exists is the
      referral packet (customer-facing) and the job close-out sheet (crew-facing, internal).
- [ ] **SX-4a — Build the end-of-work email standard** as a reference doc (.md + designed .html
      + PDF), so Kara's email is the first use of it rather than a one-off. Covers what every
      close-out email carries: what was done, what was left, what the customer does next, the
      referral ask, the review ask.
- [ ] **SX-4b — Business cards for Matthew and Brad.** The printed card’s back is
      **Brandon Long · Owner · (303) 915-1045 · Contact@SixfoldColorado.com**, so two new backs
      are needed. **The front does not change** — same cascading mark, same "Lawn, Land & Fire".
      Regenerate with `build-card-final.mjs`, which already holds the printed layout.
      **Three things to decide before anything is generated:**
      **Titles** — Brandon is "Owner". What are you and Brad? Nothing on file says.
      **Phone** — Brandon’s carries the company number. Same on all three, or individual ones?
      **Email** — Brandon’s carries the shared `Contact@`, and that was your explicit
      instruction at the time ("not a personal one"). Same rule for these, or do they get
      individual Workspace addresses? Sixfold’s tenant exists but **Brandon still is not on it**.
      **⚑ Regenerating touches the roots.** The Ridge mark has ten root strokes and the flat
      mark is cropped above them, so the wrong mark silently deletes them — it has happened
      once. Check the roots are present in the proof before ordering.
      FedEx wants a two-page PDF, front then back; the spec is in
      `operations/business-card-print/README.md`.

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
      different person, and Nextdoor is the channel. Nothing else is on file about who she is or
      what the message is for, so ask before drafting anything.

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
- [ ] **SX-9 — Territory and lead list from public parcel data.** ✅ Scoped 2026-09-29: county
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
      **⚑ Still needs from the meeting:** which suburb to work first, and the solicitation
      permit position for Monument / Colorado Springs / unincorporated El Paso.
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
- [ ] **SX-9d — Two open decisions on the door data**, both just a regenerate + upload:
      **Colorado Springs** (121,709 parcels — feasible now, but city lots are small and the case
      is weaker than the big-lot towns; probably specific neighbourhoods), and **raising the
      2.5-acre ceiling** so Black Forest, Larkspur, Divide and Florissant stop being clipped.
      ⚑ Widening is safe — marks survive a rebuild. Narrowing retires the marks on dropped doors.
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

- [ ] **SG-1 — Site edits from Brandon's and Lance's evaluations.** **Blocked on you sending me
      their notes** — I don't have them. Also note staging is two commits behind local, so
      re-bundle before anyone reviews anything.
- [ ] **SG-2 — Finish the remaining social accounts** and level the branding across all of them.
      The cross-platform kit already exists for seven platforms, draft-only.
- [ ] **SG-3 — Surge Linktree** — accuracy pass. Pairs with X-2.
- [ ] **SG-4 — Google Drive for Surge content.** Sixfold's team share is a working model to copy.
- [ ] **SG-5 — Pull down the WhatsApp content** from the Surge chats while it's still there.
      **Time-sensitive in a way the rest of this list isn't** — chat history is the one thing
      that disappears on someone else's schedule.
- [ ] **SG-6 — Get team leaders into reviews and content.** The one-page field guide for
      capturing raw material already exists and has never been handed out.

## Cross-cutting

- [ ] **X-1 — Account inventory** (read the section above — inventory, not passwords).
      Underpins X-4 and X-5.
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

- [ ] **P-1 — Tacoma contract.** ⚑ The buy-side redline is answered and **not sent**, and the
      deal is guaranteed-negative as drafted. You're the seller and the buyer is your boss.
      **This is the highest-consequence item on the whole list** and the only one with a
      counterparty waiting on you.
- [ ] **P-2 — Stringline plan**, finalise and start pushing. Still ahead: the full USPTO search
      and the LLC-vs-trade-name question. Nothing registered yet.
- [ ] **P-3 — Clear the phone photos.** ⚑ **Confirm they're in the OneDrive mirror before
      deleting anything** — and Sixfold has a standing photo gap, so check whether any job
      photos on there are the only copies before they go.

---

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

**Done 2026-09-29/30:** SX-1, SX-9a, SX-9c, X-2. **Done 2026-09-30/10-01:** SX-2a.

**Reconciled against the commits 2026-10-01.** Eight commits had landed since the register was
last touched and none of them were on it. What changed: SX-2a ticked; SX-2 was three versions
stale; SX-2b and SX-9e are new, both split out of work that shipped with a decision left over;
SX-1b(1) and SX-9c's open flags were answered by checks that had already been run.
