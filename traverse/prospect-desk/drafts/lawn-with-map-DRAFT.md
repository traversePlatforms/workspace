# Lawn & landscape prospect email, "With map" version — DRAFT (2026-10-30, TR-49)

The lawn version of the roofing "with map" email, for the Prospect Desk's **Lawn and yards** template (the desk's trade key is
`yards`; "lawn" in TR-49 means this trade). Same shape and length as the roofing template: greeting, one paragraph on what Traverse
is, four bullets on what the house card shows (the city's lawn map sits under the bullets in the HTML version), price, who they deal
with, the demo line, the close. Audience (Matthew 30 Oct): small companies and start-ups, "companies that need a product like this
to grow but can't afford something like SalesRabbit".

Status: **loaded as the desk's Lawn and yards template and HELD** (send-after stays 4102444800, year 2100). Nothing has gone to any
company. One test went to Matthew's personal Gmail with the sample city Castle Rock.

## The email

<!-- subject -->
Colorado lawn map for {company}

<!-- body -->
Hi {first},

I'm Matthew. I built Traverse here in Colorado: a field-sales app for lawn and landscape crews of one to ten people, with door maps, CRM, phones, quotes and the office side in one place. We've mapped 1.24 million Colorado homes, and the house cards show:

- The lawn's size in square feet, house by house
- Which streets around {city} have the most large lawns still to knock
- The town's watering days, so you have an opener at the door
- A quote from that lawn size and your own prices, sent from your phone

A client has had success with it, and I'm opening it to small companies at a price a start-up can carry: Solo is $59 a month for your first year as a founding company (25% off, billed yearly), then $79, locked in for as long as you stay. No setup fee, and a 7-day money-back guarantee from the day your app is live.

You'd deal with me directly, and in return for the founding price I'd ask for your honest feedback on what to build next.

I'd be glad to show you your area in a 15-minute demo (traverseplatforms.com/demo).

Worth a look?
<!-- /body -->

The desk adds the signature from Settings, the postal address and the "Unsubscribe: <link>" line. In the With map version the
company's city map (homes with a lawn of 5,000 sq ft or more, from `app/m/maps.json`) sits under the bullets with its caption; a city
with no lawn map goes plain.

Length: 201 words before the signature (the roofing template is 162; the price paragraph carries the extra). A first cut ran to 225 words; that longer version is the one
in the lawn test email sent to Matthew's Gmail on 30 Oct (same claims, wordier price and set-up lines). The queued messages carry
this trimmed text.

## Fact-check log

Every claim, and where it comes from. "Pricing page" = `traverse/marketing-site/site/public_html/index.html` (the live homepage's
pricing section, 2026-10-30) and `/cancellation/`.

| Claim | Source | Status |
|---|---|---|
| "a field-sales app ... with door maps, CRM, phones, quotes and the office side in one place" | Homepage: "properties, phone calls, quotes, jobs and the office in one app"; the same sentence shape as the approved roofing template | OK |
| "crews of one to ten people" | Matthew's direction (30 Oct). Plans cover 1 (Solo), up to 5 (Team), up to 12 (Company): pricing page and `/cancellation/` | OK (audience, not a plan limit) |
| "1.24 million Colorado homes" (was "over a million"; Matthew 30 Oct: say 1.24 million) | Live editions hold 1,237,418 homes in 407 towns (server index, 30 Oct, after Group 3). Earlier note: The other six templates say "1.24 million" (Matthew's go, 29 Oct); memory: ~1.09M mapped before Group 3 lands, 1.24M after. "Over a million" is true either way. Switch to "1.24 million" to match the roofing text if Matthew prefers | OK, his choice |
| "The lawn's size in square feet, house by house" | App: lawn chip on the house card ("Large lawn, about 5,100 sq ft"), `TRAVERSE-MANUAL.html` "Lawn size per door"; Yards edition `card.lawn: true` (`traverse/editions/build-editions.cjs`) | OK |
| "Which streets around {city} have the most large lawns still to knock" | App: "lawn: neighbourhoods with the most large and medium lawns STILL TO KNOCK first" (the edition's ranking) | OK |
| "The town's watering days, so you have something to open with" | App door card tip: "Ask about their watering days. It shows you know the area and opens the conversation."; Yards `card.water: true` | OK |
| "A quote built from that lawn size and your own prices, sent from your phone" | TR-33 quote kit: lead card > Build a quote (prices from the house card's lawn sq ft) > send quote page; on when `walkdesk` is on and no `a365`. Checked on the server 30 Oct: the Yards edition has `walkdesk: true`, no `a365`. Price unit "per 1,000 sq ft of lawn" (`KIT_SHOW`) | OK |
| "A client has had success with it" | The only proof wording allowed (Matthew 29 Oct). No client named, no trade named, no "daily" | OK |
| "Solo is $59 a month for your first year as a founding company (25% off, billed yearly), then $79" | Pricing page Solo card: "Founding price ~~$79~~ $59 / month ... Billed yearly. 25% off your first 12 months, then $79. Month to month: ~~$99~~ $74." | OK |
| "locked in for as long as you stay" | Pricing page: "Your price is locked in, and you keep every feature, for as long as you stay with us. If you leave and come back, current terms apply." (the $79 is what is locked, not the $59) | OK |
| "No setup fee" | Pricing page: "No setup fee, and a 7-day money-back guarantee on every plan." | OK |
| "7-day money-back guarantee from the day your app is live" | Pricing page FAQ and `/cancellation/`; the same line is in the roofing template | OK |
| "You'd deal with me directly" | Every plan includes "A set-up call and a first-week check-in" (pricing page); Matthew is the owner and the only person at Traverse (signature "Owner, Traverse Platforms LLC"). The first cut spelled this out ("I do the set-up call and the first-week check-in myself"); cut for length | OK |
| "In return for the founding price I'd ask for your honest feedback" | Matthew's direction (30 Oct): founding price in exchange for feedback. An ask, not a claim | OK |
| "15-minute demo (traverseplatforms.com/demo)" | `/demo/` page exists; the same line is in the roofing template | OK |

Corrected while drafting:

- The brief said "no setup time". The pricing page makes **no setup-time promise** (review 30 Oct: "no setup-time promise";
  `/cancellation/`: "We set up your company's app ... after your payment, and tell you the day it is live"). The email says
  "no setup fee", which the page does say.
- "Locked in" applies to the **$79** list price after the founding year, not to the $59. Worded to match the page.
- No data source is named (the brief's rule). The approved 27 Oct templates were allowed to name NOAA, NWS, FBI, police reports
  and CSU weather stations; the previous Lawn and yards template named "Colorado State University's weather stations" and "aerial
  photos and laser scans". Matthew can put a soil-temperature bullet back if he wants it; the fact (soil temperature from weather
  stations, for aeration and seeding timing) is in the app.

Left out on purpose: trees near the house, soil temperature, year built, home value and recent sales (all on the card, but the
brief asked for lawn size, what to ask and the quote on the spot, and four bullets is the roofing template's length).

## The template this replaced (Lawn and yards, loaded 29 Oct evening; kept here so it can be put back from Settings)

Subject: Colorado lawn map for {company}

    Hi {first},

    I'm Matthew. I built Traverse here in Colorado: a field-sales platform for lawn and landscaping companies, with CRM, office and crew tools, phones and door maps in one place. We've mapped 1.24 million Colorado homes, and the house cards show:

    - The lawn's size in square feet, measured from aerial photos and laser scans
    - Trees near the house
    - Soil temperature from Colorado State University's weather stations, so you know when to aerate and seed
    - Year built, home value and recent sales

    Your crew works the best doors first, and the office runs the pipeline, quotes, signed agreements with deposits and the jobs board from the same app.

    I'd be glad to show you your area in a 15-minute demo (traverseplatforms.com/demo). Every plan has a 7-day money-back guarantee from the day your app is live.

    If you start with us now, you'd get 25% off your first year, and your price is locked in for life as long as you're with us.

    Worth a look?

## How the 30 lawn prospects were picked (30 Oct)

From the desk's own Lawn and yards list (5,309 companies from the TR-21 state register, 2,817 of them formed 2021 or later). Rule,
in order: formed 2021-2026; a Front Range city that has a lawn map; lawn, landscape, turf or yard in the name (tree, sprinkler,
irrigation, fence, snow, supply, nursery and the like dropped); no franchise or national brand (name list in the picking script) and
no supply, materials, curbing or pet-waste companies; a working email (the desk's `emailOk = yes`); website up (the desk's
"website down: may have closed" flag drops it); then the desk's fit grade (A before B, no C). Spread across towns rather than all
Denver and Colorado Springs. Enrichment: only what the desk already holds (the cloud look-up of 26 Oct); no people-search, no
Hunter or Apollo calls, no owner names.

Of the 1,509 young Front Range lawn-named companies with no franchise mark: 156 had a usable email, 54 a website only, 1,299 nothing
beyond the register (one with a phone only). The 30 picked all have an email (the desk cannot queue a company without one): 19 from
their own website, 11 from the business listing. Formed: 2021 x9, 2022 x5, 2023 x9, 2024 x4, 2025 x2, 2026 x1. Fit: A x7, B x23.
Towns: Colorado Springs 5, Denver 5, Castle Rock 3, Boulder 2, Centennial 2, Highlands Ranch 2, Thornton 2, and one each in Arvada,
Brighton, Broomfield, Elizabeth, Erie, Lakewood, Littleton, Longmont, Monument. The company list (names only, no contact details) is
in the session scratchpad (`lawn-picked-list.txt`) and on the desk's Email page as the waiting queue.
