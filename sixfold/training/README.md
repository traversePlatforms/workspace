# Sixfold training: the lessons in the door app

> ## Revamped 2026-10-13: the Sixfold Field Guide
>
> Matthew: *"redo and revamp our current documents like the at the door page what to say what not to say … a better field
> guide … build the field guide into the app for sixfold … I want it to have the branding and pdf … just for sixfold."*
>
> **One source, two outputs.** These lesson files now build both the app's Training section (`build-training.mjs` →
> `training.json`) and the branded **Sixfold Field Guide PDF** (`build-field-guide.mjs` → `field-guide.html` →
> `node sixfold/tools/html-to-pdf.mjs Field-Guide` → `Sixfold-Field-Guide.pdf`, 26 pages). They cannot say different things.
>
> **Card markers.** A line starting `Say:`, `They say:`, `Do:`, `Don't:`, `Never:`, `Law:` or `Tip:` is drawn as a card in
> the app and in the PDF. Consecutive `Do:` / `Don't:` / `Never:` lines group into one list card. Say and Never differ by
> label and mark (" / ✕) as well as colour, because ember and moss fail colourblind separation.
>
> **In the app (Sixfold only):** Training opens with a branded Field Guide card (the Ridge mark, *Start with the door visit*,
> *Open the PDF*); lessons have Previous / Next; the door list has *What to say at the door*. Switched on by
> `features.fieldguide` in Sixfold's company.json; the PDF is served to signed-in crew by the `guidepdf` action from
> `sixfold-data/rounds/docs/field-guide.pdf`. The editions never get the lessons, the PDF or the switch.
>
> **What changed in the content:**
> - **New first lesson: At the door, the whole visit on one page** (built only from the lessons below and their sources).
> - **New lesson: Your sign-in** (one phone and one computer at a time; what the app records; location stays on the phone).
> - **Using the app** brought up to date: Routes, Walk booked / Quote sent / Not now / No answer, the score and reasons, the
>   buttons under the score, the folded lines, grey dots, extra phone numbers.
> - **Stale button names fixed:** "Quote booked" → Walk booked (sales, phones); the no-soliciting button named exactly.
> - **Openers:** trees and fire now "lawn work and wildfire mitigation" (aeration leads, per the 2026-09-23 positioning).
> - Objections, do's and don'ts, never-say, water and the legal lines converted to cards. **No wording of a rule changed.**
> - **The door crib sheet** (`agreements/field-instructions`): its fire-led sample opener ("we do fire mitigation on the
>   Front Range … wildfire risk notices") replaced by the aeration opener above. Nothing else on it changed; still 2 pages.
>
> **Fact-check log (2026-10-13):** every new line traces to an existing lesson or its source. The talking point "From the
> aerial photo, your lawn's about ___ square feet" is the app's own 2023-photo estimate, so the lesson says "about" and
> forbids calling it a measurement. "Law:" cards: the 30-second rule (C.R.S. 6-1-105(1)(p)), calling hours (47 CFR
> 64.1200(c)(1)), saying the cancellation right aloud (16 CFR 429; C.R.S. 5-3-401 to 405), Colorado 811's two business days.
> Nothing here is legal advice; the agreements' crib sheets govern where they differ.
>
> **Upload:** `training.json` replaces every live lesson (check the live list first: on 2026-10-13 it matched the repo
> build exactly), and `field-guide.pdf` goes to `sixfold-data/rounds/docs/`.

**Written 2026-10-05.** The crew's Training section in the door app, under seven headings: Doors · Sales · Quotes ·
Phones · Paperwork · Safety · Using the app. **31 lessons.** Internal: for Sixfold's crew, not for customers or for
publishing.

Matthew, 2026-10-05: *"You can incorporate Surge's training methods into Sixfold's, but it does need to be rebranded to
Sixfold's brand. So don't edit it to Sixfold but recreate it as another file under Sixfold's folders."* Surge's originals
in `surge/training-source/` are untouched. Everything here is a new Sixfold document.

## Files

| File | Heading in the app | Lessons |
|---|---|---|
| [01-doors.md](01-doors.md) | Doors | 4 |
| [02-sales.md](02-sales.md) | Sales | 8 |
| [03-quotes.md](03-quotes.md) | Quotes | 4 |
| [04-phones.md](04-phones.md) | Phones | 4 |
| [05-paperwork.md](05-paperwork.md) | Paperwork | 4 |
| [06-safety.md](06-safety.md) | Safety | 3 |
| [07-using-the-app.md](07-using-the-app.md) | Using the app | 4 |
| [build-training.mjs](build-training.mjs) | builds `traverse/app/data/rounds/training.json` | |

Each `## ` heading is one lesson. Inside it, `### ` is a heading, `- ` a bullet and a blank line a new paragraph, which
is all the app draws. No bold or code marks: the build refuses them, because they would show as raw characters.
`Source:` lines stay in these files and never reach the app.

**To change a lesson:** edit the file, run `node sixfold/training/build-training.mjs`, upload `training.json` to
`sixfold-data/rounds/`. **The upload replaces every lesson in the app**, including any the office typed in there. The live
list was empty when this was first built (checked 2026-10-05); check it again before each upload.

## Where each lesson came from

| Lesson | Built from |
|---|---|
| The first thirty seconds | Surge *5 Steps* (SEE, WWW, KISS) + Colorado's 30-second rule (door crib sheet) |
| Working the territory | Surge *Law of averages* (exposure) + *Successful Business Practices* step 5 |
| Your day: goals, numbers and attitude | Surge *Law of averages* (GRACE) + *Successful Business Practices* |
| No soliciting: three levels | door-app NO-SOLICIT-SCOPE |
| The five steps | Surge *5 Steps to Build Value* |
| Objections: AIR and FFF | Surge *Objections*, with Sixfold's own objections and true answers |
| The closing circle | Surge *Closing circle* |
| Building value honestly: GIFTS | Surge *Gifts* |
| Adding the second service | Surge *Steps to Rehash* |
| Do's and don'ts | Surge *Dos and Don'ts* |
| What we never say | door crib sheet, water research, aeration ad rules, agreements |
| Water, wells and seed | sixfold/research/water-restrictions-2026 |
| Walking a lawn | Sixfold aeration agreement (sections 2-4, clauses 4-5), water research |
| Walking a tree or clearing job | sixfold/operations/quote-walk-sheet |
| Prices: the office sets them | agreements, door crib sheet, aeration ad rules |
| Jobs we don't take, or call in first | safety guide B5-B6, walk sheet, Colorado Springs tree licence, 811 rule |
| Answering the phone, Calling a lead back, Voicemail | **new**: no phone material existed (see below) |
| Where leads come in | APP-GUIDE, DEPLOY-ROUNDS |
| The four Paperwork lessons | sixfold/agreements field-instructions + remote-signing, DocuSign setup notes, payment clauses |
| The three Safety lessons | sixfold/research/crew-safety-and-compliance |
| The four Using the app lessons | door-app APP-GUIDE |

## What changed from Surge's originals, and why

Surge's method was written for fundraisers asking for a donation at a booth or door. A Sixfold rep is selling a home
service at the customer's house, which brings home-solicitation law with it. **These changes are deliberate; don't put
the originals back.**

1. **"Don't mention they can cancel any time" is reversed.** A Sixfold rep must tell the buyer orally, as they sign, that
   they can cancel within three business days (16 CFR 429.1(e)). It is now the first "don't" in Do's and don'ts, worded as
   "never skip telling them".
2. **Fear of loss: "last day", "sold out", "too late" are allowed only when true.** A made-up deadline or shortage can be a
   deceptive trade practice under the Colorado Consumer Protection Act. The lesson gives real ones instead: the season, the
   schedule, seeding too late.
3. **Greed: "everyone", "last person", "point at the receipt"** now carry "only when it's true" and "only if you really did
   that house". FFF's "the last person felt..." likewise.
4. **Rehash step 1 changed from "secure the payment (card type?)" to "secure the first yes"** (the booked walk or the
   signed agreement). Sixfold takes no payment at the door: the aeration agreements put the first payment on or before the
   first day of work and never use the word "deposit". (The blank tree-job template, service-agreement.src.html, still
   carries a "Deposit, if any, paid today" box; the crew rule follows the packet rule, not that template.)
5. **"Work a full 8 hours" became "set your own goal; how long you work is your call".** Sixfold's crew are contractors,
   and setting a contractor's hours is a mark of employment.
6. **"55% body language, 38% tone, 7% words" was dropped.** It is a misapplied reading of a 1960s study about feelings,
   not a fact about communication. The point (how you say it matters) is kept.
7. **The 1:15 / 1:10 / 1:05 ratios were dropped.** They are Surge's fundraising numbers. Sixfold has no target ratio yet;
   the lesson points at the crew's own numbers in the app.
8. **Presentation: "Stress the deal" and "Triple price breakdown" were dropped.** Sixfold gives no price at the door (no
   flat aeration rate: every lawn is quoted from its walk), so there is no deal to stress or price to break down. "Dollars,
   not bucks" is kept; "Us vs them" was dropped because its meaning wasn't clear from the original.
9. **Surge's objection list was replaced.** Its answers were about donations (cash, online, other charities). Sixfold's
   list covers price, doing it yourself, water restrictions, wells, the seed guarantee and weed spraying, each with a true
   answer.
10. **"Fill out every donor form" and "KPI form at the end of the day"** became marking every door in the app and getting
    the booking details right: the app records the day.
11. **The closing circle gained "when the circle stops"**: a clear no, a closing door, or being asked to leave. Surge's
    "repeat at least three times" became "don't stop at the first no".
12. **Sixfold's copy rules applied throughout**: never licensed, insured, bonded, certified or Firewise; no promised tax
    credit, refund or discount; no germination guarantee; no pesticide; landscaping is its own service, never the cleanup
    after fire mitigation; "first payment", never "deposit".

The acronyms (SEE, WWW, KISS, AIR, FFF, GIFTS, GRACE, rehash) are kept as they were: they're the memorable part of the
method.

## New material, not from a Surge original

The four Phones lessons and the opener examples are new. They're built from the five steps and Sixfold's own rules, and
nothing in them is a claim about Sixfold that isn't sourced elsewhere in this repo. Federal calling hours (8 am to 9 pm,
the called person's time) are from 47 CFR 64.1200(c)(1).

## Open items, for Brandon

1. **Town permits for door-to-door.** The Doors lesson tells the crew to ask the office before working a new town. Whether
   Monument, Colorado Springs or unincorporated El Paso require a permit per canvasser is still unanswered (SX-9f).
2. **A target ratio.** None is set. Once a few weeks of door numbers exist, a "good day" ratio could go into *Your day*.
3. **Meta form leads.** The Phones lesson says someone checks Meta's Leads Center every day and imports them. Who that is
   isn't decided.
4. **Phone scripts in Brandon's words.** The phone lessons are a starting point. If Brandon has a way he likes the phone
   answered, it should replace mine.
5. **Gear.** The printed gear checklist is stale (noted 2026-09-30). The Safety lessons don't depend on it.

## Fact-check log

| Claim | Source | Status |
|---|---|---|
| 30-second identification rule | C.R.S. 6-1-105(1)(p), as summarised in sixfold/agreements/field-instructions | Verified 2026-10-06 against the statute text (colorado.public.law): "within thirty seconds after beginning the conversation, identifies himself or herself, whom he or she represents, and the purpose of the call" |
| Oral notice of the right to cancel; seller fills the forms; ten-day refund | 16 CFR 429.1(e) (oral), 429.1(c) (seller completes both forms), 429.1(g) (refund within 10 business days); C.R.S. 5-3-404(1) (refund within ten days) | Verified 2026-10-06 (LII, colorado.public.law). The lesson's "ten days" is Colorado's tighter figure |
| Business day = any day except Sunday or a federal holiday; Saturday counts | 16 CFR 429.0 (definition of business day); OPM 2026 holiday list (Columbus Day = Monday 12 October 2026) | Verified 2026-10-06 |
| Cancellation stays open three years if the paperwork is defective | C.R.S. 5-3-403 | Verified 2026-10-06 |
| No compensation for work done before a cancellation | C.R.S. 5-3-405(3) | Verified 2026-10-06: "the seller is not entitled to compensation for any services the seller performed pursuant to it" |
| Emergency exception, all three conditions | 16 CFR 429.0(a)(3); C.R.S. 5-3-402(5) | Verified 2026-10-06. The three conditions in the lesson are the federal ones; Colorado's version also requires the seller to have made a substantial beginning of performance before any cancellation arrives. Meeting both is the safe reading |
| 811: two business days before digging | C.R.S. 9-1.5-103(3)(b) | Verified 2026-10-06 (colorado.public.law): "at least two business days prior thereto not including the day of actual notice". Note C.R.S. 9-1.5-102 excludes routine landscape maintenance no deeper than 4 inches by mechanical means from "excavation", so a core-aeration pass is probably not a locate-required dig; the agreements promise a locate anyway, so the lesson keeps it |
| Water: aeration needs a green, watered lawn; overseed exposed; household-use-only wells | sixfold/research/water-restrictions-2026.md (CSU Extension, State Engineer), corrected 2026-10-04 | Carried; re-check each season |
| Power lines 10 ft; no climbing; first aid; hearing; fuel; OSHA reporting | sixfold/research/crew-safety-and-compliance.md (29 CFR 1910) | Carried |
| Colorado Springs licence for paid work on trees 15 ft+ | City Clerk's Tree Service License page (memory note, verified 2026-09-14) | Carried |
| Calling hours 8 am-9 pm | 47 CFR 64.1200(c)(1) | Verified 2026-10-06 (LII): "before the hour of 8 a.m. or after 9 p.m. (local time at the called party's location)". The rule's definition of telephone solicitation excludes calls the person invited (a form they filled in), so the hours are a Sixfold house rule for call-backs, not a legal limit on them |
| Lead flow (website form, Meta import, + Add a lead, owners) | APP-GUIDE, DEPLOY-ROUNDS | Checked against the app 2026-10-06: + Add a lead and Import leads from Meta are in the Pipeline, which is admin-only; the Phones lessons now say so |
| Looked-up numbers and Do Not Call | summit-de59ae83/index.html dncMark() | Checked 2026-10-06: for a number found with Look up number the app shows "Looked up, not given, check the Do Not Call lists before calling". It does not check the lists; only a skip-traced number (BatchData, switched off) carries a provider answer. The Phones lesson was corrected |
| No answer comes back after two days; Not now offers a month, 3 months, spring, fall or a date; the no-soliciting flag sits inside Not now; any crew member can flag a neighbourhood, only an admin clears it | api/rounds.php MISS_REST_DAYS = 2; index.html | Checked 2026-10-06 |
| "55/38/7" is a misreading of Mehrabian's study | Widely documented; Mehrabian has said his results don't generalise to communication | Dropped, not claimed. 2026-10-06: the GIFTS lesson still said "your body and your voice carry most of the message", the same claim in softer words; reworded |
| First-aider and kit on every crew | crew-safety-and-compliance.md B1 and Part E item 4 | 2026-10-06: the source lists these as required and not yet in place, so the Safety lesson now says "must have", not "has" |

## Review 2026-10-06 (overnight fact-check)

Changed: 02-sales (GIFTS tone line), 04-phones (+ Add a lead is admin-only; looked-up numbers are not checked against Do
Not Call by the app), 05-paperwork (what the agreements actually say about deposits), 06-safety (first-aider and kit as
rules, not facts), this README (point 4 and the log above). Full report: reviews/2026-10-06/documents.md.
