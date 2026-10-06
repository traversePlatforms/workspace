# Yardbook vs the door app — what each does

**Written 2026-10-04** for Matthew, after the name "Yardbook" came up for the app and turned out to be taken.
Internal. The app's future company and name are not decided; this sits with the app for now.

**Yardbook's own site (yardbook.com) refused automated reading (HTTP 403).** Everything about Yardbook below comes
from review and comparison sites dated June–September 2026, cross-checked where two agree. Where they disagree it
says so. Check yardbook.com in a browser before quoting any of it to anyone.

---

## The short version

**They are different products that meet in the middle.**

- **Yardbook runs a lawn-care business that already has customers:** scheduling crews, recurring jobs, invoices,
  online payments, time clocks, chemical records. It has nothing for finding customers door to door.
- **The door app finds and wins customers:** every door scored before the knock, the knock itself, the follow-up
  from first call to won, then a light customer list. It has no invoicing, payments or crew scheduling.

The overlap is small: a customer list, routes for the day, measuring a lawn from the air, and a web form that
files leads.

---

## What Yardbook does

| Area | What it does | Source |
|---|---|---|
| Scheduling | Jobs on a list, by assignment or on a calendar; recurring and season-based jobs; basic multi-crew scheduling | Connecteam (Aug 2026), Jobber (Jun 2026), Quo |
| Routes | Drag-and-drop route planning on every plan, free included. **Connecteam calls the optimizer unreliable** | Connecteam, Quo |
| Quotes | Estimates and quotes; a lot measurement tool from satellite images; price by lot size (in beta) | Connecteam, Jobber, Quo |
| Money | Invoices; customers pay online by card; automatic invoice reminders (Business plan); processing fee waived on Business | Quo, Connecteam |
| Customers | Customer database, bulk import; bulk email and text messages (Business) | Connecteam, Quo |
| Crew and kit | Time clock, expenses, equipment maintenance logs, inventory | Connecteam, Capterra |
| Lawn-specific | Chemical application tracking; multi-step chemical programs (Business) | Quo, Jobber |
| Leads | "Customized lead capture" on the Business plan (detail not given) | Quo |
| Extras | Branded customer portal and QuickBooks sync (Enterprise); Mailchimp and Zapier | Quo, Connecteam, Jobber |
| Phones | Android app that works offline; iPhone only as a beta or mobile website | Connecteam, Jobber |
| Price | Free plan; **Business $34.99 and Enterprise $49.99 a month**. Jobber and Connecteam say flat monthly with unlimited users; one blog (Quo) says per user. **Unresolved: check their pricing page** | Jobber, Connecteam, Quo |
| Reviews | 4.4 out of 5 from 14 reviews (Capterra and GetApp); Connecteam scores it 6.35/10 | Capterra, GetApp, Connecteam |

**What reviewers count against it:** a dated web screen; a weak iPhone experience; the route optimizer; text
message length limits; payment fees on the free plan; no two-factor sign-in. Managers can't dispatch from the phone
(Connecteam). Jobber's page (a competitor, so read with care) lists no customer self-serve hub, no financing, no
review automation or marketing tools.

---

## Side by side

| | Yardbook | The door app |
|---|---|---|
| **Finding customers** | — | Every owner-occupied door in the territory from public records, scored for fire hazard, lawn size (from aerial photos) and trees at the house; county value; new owners flagged; HOA, Firewise and wildfire-plan tags |
| **Knocking** | — | Neighbourhood lists sorted by lawn, fire, trees, doors left or booking odds; a filter for the best doors; street order, nearest door, walking route and map; works with no signal; come-back dates; no-soliciting flags |
| **At the door** | — | Phone, email, photos, notes, extra work spotted, a homeowner fire check and report; book the walk with a calendar entry and a confirmation text |
| **What to say** | — | Money sheets per county (tax credit, insurance law, grants); water rules per town |
| **Leads** | A lead capture form (Business plan) | Website form and Linktree file themselves; Meta leads import from one file; Nextdoor and phone typed in; one Pipeline from To call to Won |
| **Quoting** | Estimates; lot measurement; lot-size pricing (beta) | Quote builder (cost-up from the walk), lawn measured from the door's outline |
| **Results** | Customisable reports | Which kinds of doors turn into jobs, by fire, lawn, trees, value and town; a booking-odds sort |
| **Team** | Time clock; GPS at clock-in and out | Doors, conversations and quotes per person; leaderboard; territories; no location tracking |
| **Customers** | Customer database, bulk email and text | Customer list with plans, visits, spend and what's due; route for today; review-request text; customers marked on the map |
| **Scheduling crews** | Yes: calendar, recurring jobs, dispatch | No: next-visit-due only |
| **Invoices and payments** | Yes: invoices, card payments, reminders | No (agreements linked, prices recorded) |
| **Accounting** | QuickBooks sync (Enterprise) | No (a Jobber-ready export of door bookings) |
| **Chemicals, equipment, time clock** | Yes | No |
| **Customer portal** | Yes (Enterprise) | No |
| **Phones** | Android app offline; iPhone weak | Web app on any phone or iPad, installs to the home screen, works offline |
| **Safety nets** | Automatic backups (Business) | Nightly backups kept 30 days; a morning email to the office |
| **Price** | Free / $34.99 / $49.99 a month | Not sold yet |

---

## What this means for the app

1. **It isn't a Yardbook competitor so much as the step before it.** Yardbook, Jobber and their peers start once
   someone is a customer. Nothing in Yardbook helps a crew decide which doors to knock, or captures what happens at
   the door. That gap is what the app does best.
2. **Don't rebuild their half.** Invoicing, payments, crew scheduling and QuickBooks are what these products compete
   on, and they're cheap or free. The better move is to hand customers over to them cleanly: the Jobber export
   already exists, and the same could be done for Yardbook.
3. **The data is the hard part to copy.** Door scoring, lawn size and trees from aerial photos and lidar, county
   values, and the money and water sheets were built for Colorado. **Every new state needs that work redone**: the
   county records, the funding rules, the water providers. That is both the moat and the cost of rolling out.
4. **The name.** Yardbook sells to the same lawn-care companies the app would be sold to, so the name is out.

---

## Fact-check log

| Claim | Tier | Source and date |
|---|---|---|
| Yardbook is lawn-care and landscaping business software, based in Phoenix, with a free tier | **B** | Toolradar summary via search; Connecteam review, Aug 2026; Y Combinator company page listed |
| Features: scheduling, recurring jobs, routing, estimates, lot measurement, invoicing, card payments, customer database, time tracking, expenses, equipment, chemical tracking, QuickBooks (Enterprise), Mailchimp, Zapier | **B** | Connecteam (Aug 2026), Jobber comparison (updated 24 Jun 2026), Capterra, Quo; agree with each other |
| Plans: free, Business $34.99/mo, Enterprise $49.99/mo | **B** | Connecteam; Jobber ("all with unlimited users") |
| Paid plans priced **per user** | **C — unresolved** | Quo blog only; contradicted by Jobber and Connecteam. Not used as fact |
| Route optimizer unreliable; no break/overtime tracking; no 2FA | **C** | Connecteam's own testing; one source |
| 4.4/5 from 14 reviews | **B** | Capterra and GetApp (Sep 2026) |
| What Yardbook lacks (portal on low plans, financing, marketing, AI) | **C** | Jobber's comparison: written by a competitor |
| Anything from yardbook.com itself | **—** | **Not read: the site returned 403 to automated fetches.** Check in a browser |

Sources: [Connecteam review](https://connecteam.com/reviews/yardbook/) ·
[Jobber vs Yardbook](https://www.getjobber.com/comparison/jobber-vs-yardbook/) ·
[Capterra](https://www.capterra.com/p/207272/Yardbook/) ·
[GetApp](https://www.getapp.com/landscape-software/a/yardbook/) ·
[Quo: lawn care software](https://www.quo.com/blog/lawn-care-business-software/) ·
[Y Combinator: Yardbook](https://www.ycombinator.com/companies/yardbook)
