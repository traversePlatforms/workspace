# Peak Pickleball: Meta ad plan for new members (23 Nov 2026)

> **DRAFT: NOTHING LAUNCHED.** No ad account, Pixel, audience or campaign was opened, created or changed. The budget isn't set: it depends on what Peak approves. The plan needs Tyler's go, a privacy policy on the site (section 6) and Peak's own ad account access before anything runs.

This is Matthew's work for Peak, his own client. Peak's numbers are from the read-only CourtReserve and Patch pull of 23 Nov 2026 (`tools/impact.mjs`). People are counted by anonymous id only.

## 1. Was the free class really the best way in? Yes, by a wide margin

Matthew's recollection was that the free class converts best. The data agrees.

**Method.**
- **Who's counted:** every CourtReserve account created **11 Nov 2025 to 23 Sep 2026**. That window gives everyone at least 60 days to join.
- **Grouped by:** the first thing each person did at Peak (a kept booking or check-in).
- **"Joined":** their **first-ever dues payment** falls within 60 days of that first visit.

| First thing they did | People | Joined within 60 days | Rate | Still paying 3 months after joining |
|---|---|---|---|---|
| **Free class (Learn to Play)** | 745 | 238 | **31.9%** | 43% of joiners |
| Open Play / social play (drop-in) | 978 | 30 | 3.1% | 40% |
| Court booking | 1,226 | 24 | 2.0% | 46% |
| League, tournament or event | 164 | 3 | 1.8% | (3 people) |
| Member Hold group (a friend's court) | 82 | 1 | 1.2% | (1 person) |
| Paid class or lesson | 22 | 0 | 0% | |
| Joined before any visit (paid first) | 232 | 232 | n/a | 48% |
| No visit recorded | 935 | 0 | 0% | |

**Any free class at all, not just as the first visit** (same accounts): **45.6%** of people who took the free class went on to pay dues (446 of 978). Of those who never took it, **3.2%** did (110 of 3,417).

Three more points from the data:

- **The decision is fast.** Of the 1,087 non-members who took a free class in the baseline year (11 Nov 2025 to 10 Nov 2026), 37.3% paid dues within 7 days and 43.7% within 60. Most join on Starter: 310 of 336 converts paid $35 as their first dues.
- **It held up last year too, but lower.** For accounts created 11 Nov 2024 to 12 Sep 2025, the free class as first visit converted at 22.1%, against 6.8% for Open Play and 3.3% for court bookings.
- **The 80% figure doesn't hold up.**
  - The "80% of class-takers become members" figure (2 Nov meeting) was Scott's own classes, Tyler said on 11 Nov. Nothing in the data supports 80%.
  - Use **about 32% for new people** (free class as first visit) or **about 44 to 46% for everyone who takes it**.
  - The month-to-month range is wide: 16% (Jun 2026) to 61% (Dec 2025) within 30 days.

**What a free-class convert is worth.** This covers converts whose class was 11 Nov 2025 to 23 May 2026 (336 people), over their first 180 days:

| | Mean | Median |
|---|---|---|
| Dues | $148 | $140 |
| All spending (dues, court fees, events, shop, less refunds) | $291 | $192 |

**Capacity is there.**
- Free class sessions ran **24 to 44% full** in most months. Only January 2026 ran higher, at 80%.
- Peak cut sessions from about 33 a month to 17 to 20 a month from September 2026. That still leaves roughly 100 empty seats a month: November has 154 seats and 63 booked.
- Of 1,411 free-class sign-ups in the baseline year, **1,108 checked in (78.5%)**. 217 cancelled and 65 were no-shows.

**So the funnel to buy is:** ad → book the free Intro class → attend → Starter (then grow into Play, Flex or Unlimited).

## 2. Objective and funnel

- **Campaign objective:** **Leads**, optimised for free-class bookings. Meta's Leads objective covers both instant forms and website conversions. Pick one route below.
  - **Route 1, recommended once the site has a page for it:** the ad goes to a "Free Intro to Pickleball" landing page on peakpickleball.us. That page has the class times and a button to the CourtReserve booking.
  - The Pixel sees the landing page visit and the click to book ("Lead"). **It can't see the booking itself**, because that happens on CourtReserve's site, not Peak's.
  - **Route 2, works today:** a Meta instant form ("Save my spot: pick a day"). Peak's front desk then books the person in and calls or texts them.
  - This is easier to count, but it adds front-desk work. Form leads tend to show up less often than people who book themselves, so treat that as a risk and measure it.
- **After the booking:** the free-class follow-up series in `patch-automations-2026-11-23.md` (A1 to A7) does the converting. **It is switched off today (since 29 Sep).**
  - **Turn it back on before spending on ads.** Otherwise the most valuable step is missing.

## 3. Audiences

1. **Local radius around 1730 Briargate Blvd.** Paying members' top ZIPs (23 Nov, 625 members with a ZIP) are:
   - 80919 (85) and 80920 (82)
   - 80921 (51), 80132 Monument (45), 80918 (41), 80908 (38)
   - 80924 (34), 80831 Falcon/Peyton (31), 80923 (25) and 80906 (24)

   These ten hold **73%** of members with a ZIP. Free-class first-timers come from the same ZIPs, led by 80920, 80921, 80919, 80918, 80923 and 80132.
   - **Start with a radius that just covers Monument and Falcon/Peyton**, or with those ZIPs as a list. Check the circle on Meta's map; the distances weren't measured here.
2. **Age.** Free-class first-timers are younger than members:
   - First-timers: 30s (223), 50s (231), 40s (184), 60s (182) and 20s (122).
   - Members lean 50+: 60s 277, 50s 152, 70+ 132.
   - **Start at 25 to 65+ and let Meta's delivery find the pockets.** Don't exclude older players. Senior Play is a strong product, and members 55+ have their own plans.
3. **Interests.** Use these as a hint for Meta's Advantage+ audience, not a hard limit: pickleball, tennis, racquet sports, fitness, recreation. Meta has been retiring detailed interest options, so take what the ad manager offers on the day.
4. **Lookalikes from members.** Allowed only with Peak's own approval and done inside Peak's account.
   - Meta requires that the advertiser has "all of the necessary rights and permissions and a lawful basis" to use the data (Business Tools Terms §1). Customer lists fall under Meta's Customer List Custom Audience Terms.
   - A seed needs at least 100 people from one country (Meta Marketing API docs).
   - **Matthew should not export or upload Peak's member list.** The pull rules keep names and emails out of everything he holds. If Tyler wants a member lookalike, Peak uploads the list itself, or uses a Pixel audience instead (people who clicked "book" on the landing page, once there are 100+).
5. **Retargeting.**
   - **Site visitors (Pixel)** from the last 30 to 60 days: the Pixel (id 624560343236394) is on peakpickleball.us today, checked 23 Nov.
   - **Instagram and Facebook engagers** from the last 90 days.
   - **Exclude current members** where Peak can supply a list. Otherwise exclude Pixel visitors to the member login page if the site has one.

## 4. Offer and creative

- **Offer:** the free Intro to Pickleball class, with paddles and balls provided and no experience needed. It's real, it's free and it's what converts. **No discount needed.**
- **Creative: real photos and video only, no AI images.** Use photos of Peak's own courts, coaches and players, with permission, from Cammie's library or new shots. Angles to test:
  1. **"Never played? Start here."** First-timers mid-rally in a free class, with the coach visible. Tagline: "Free Intro class. Paddles on us."
  2. **"Find your people."** Social Play / Dinks & Drinks, with groups laughing between games. The community angle is Peak's own: "Learn. Play. Connect. Belong."
  3. **"24 courts, all year, indoors."** A wide shot of the hall. It works in Colorado winter: no wind, no snow.
  4. **"From your first class to your first league."** A short sequence: Intro, then Starter, then Open Play, then a league night.
- **Copy guardrails:**
  - Quote only facts Peak can stand behind (free class, paddles provided, indoor, Starter price for grads).
  - Don't quote the 80% or 45% figures in ads.
  - Fix the cancel-window and court-rate conflicts on the site first (4 h vs 24 h; $6 vs $7 per hour).

## 5. Budget scenarios ($500 / $1,000 / $2,000 a month)

**Peak's own rates (data):**
- Booked → attended: **78.5%** (1,108 of 1,411)
- Attended → joined within 60 days, for new people: **31.9%** (2025-26; 22.1% the year before)
- Value per new member in their first 180 days: **$148 in dues**, $291 in total spend

**Assumptions (not Peak data; replace them with week-2 actuals):**
- Peak does have Meta ad history, but none of it was built to get free-class bookings (see "What Peak's past ads cost" below). The earlier line here, "no Meta ads were found on 4 Nov", was wrong: it was written before Peak's two ad accounts were reachable (23 Nov). None is known on Google.
- The cost per free-class booking is still unknown, because no past ad counted bookings or leads. The table shows three **assumed** costs: $20, $40 and $60 per booking.
- Ad-sourced people may convert worse than people who found Peak themselves. A row at **half** Peak's rate is included.

Members = bookings × 78.5% × join rate.

| Monthly spend | Assumed cost per booking | Bookings | Attend | New members at 31.9% | At half (16%) | Cost per new member (31.9% / 16%) |
|---|---|---|---|---|---|---|
| $500 | $20 / $40 / $60 | 25 / 12 / 8 | 20 / 10 / 7 | 6 / 3 / 2 | 3 / 2 / 1 | $80–240 / $160–480 |
| $1,000 | $20 / $40 / $60 | 50 / 25 / 17 | 39 / 20 / 13 | 13 / 6 / 4 | 6 / 3 / 2 | $80–240 / $160–480 |
| $2,000 | $20 / $40 / $60 | 100 / 50 / 33 | 79 / 39 / 26 | 25 / 13 / 8 | 13 / 6 / 4 | $80–240 / $160–480 |

**What Peak's past ads cost (baseline, read 23 Nov 2026 from the two ad accounts, read only: `tools/meta-pull.mjs`, `data/pulls/store/meta/`).**

- **Peak Pickleball** (act_1188880533429803): **$1,108.70 lifetime**. Spend runs 29 Dec 2025 to 3 Oct 2026: Dec 2025 $161, Jan 2026 $713, Feb $51, Sep $163, Oct $20. 276,959 impressions, 5,916 clicks, 3,099 link clicks.
- **Social DFY** (act_3855284241380919): **$205.60 lifetime**, all between 3 and 13 Sep 2026. 25,722 impressions, 1,710 clicks, 1,128 link clicks.
- **Both accounts have a campaign still switched on and neither has spent since 3 Oct (last 30 days: $0).** "PickleFest" (awareness, $8 a day since 14 Sep, active) and "Promoting ... CourtReserve event" in Social DFY (link clicks, $12 a day since 3 Sep, active).
- **No ad ever recorded a lead.** Meta shows no lead actions, so the cost of a free-class booking has no baseline.

| Campaign (account) | Spend | Link clicks | Cost per link click | Landing-page views |
|---|---|---|---|---|
| Glow Pickleball Event Traffic (Peak) | $119.73 | 562 | $0.21 | 510 |
| Golden Ring National Championship (two copies, Peak) | $152.75 and $274.97 | 477 and 1,110 | $0.32 and $0.25 | 369 and 907 |
| Golden Ring 5.0+ Traffic (two copies, Peak) | $83.05 and $149.89 | 256 and 452 | $0.32 and $0.33 | 204 and 402 |
| Traffic (Targeting CCC3) (Peak) | $65.54 | 136 | $0.48 | 82 |
| Promoting a CourtReserve event page (Social DFY) | $119.69 | 789 | $0.15 | 548 |
| Promoting peakpickleball.us/play-pickleball (Social DFY) | $85.91 | 339 | $0.25 | 284 |
| Awareness campaigns: Glow Awareness, PickleFest, Intro to Pickleball (Peak) | $79.81, $153.13 and $29.83 | 41, 54 and 11 | $1.95, $2.84 and $2.71 | none |

- **Read it as:** traffic ads to an event or site page cost **about $0.15 to $0.48 per link click** (the whole traffic set: about $0.27). Awareness ads cost ten times that per link click, as expected (they buy views, not clicks), and "Intro to Pickleball" ($30, 11 link clicks) never got going.
- **What it does not say:** how many of those clicks became bookings. A click is not a booking, so these numbers set the floor for the cost of a click, not for the $20 to $60 per booking assumed above.
- **Going forward:** the nightly pull adds Peak's Page, Instagram and ad numbers to the Sunday scorecard (spend, link clicks, leads, cost per click and per lead), so a new campaign reads against this baseline.

How to read it:

- **Break-even on dues alone:** about **$148 per new member** over 180 days.
- **On total spend:** about **$291**.
  - At Peak's own conversion rate, the ads pay back within 6 months on dues if a booking costs **up to about $37** ($148 × 0.785 × 0.319).
  - On total spend, up to about **$73**.
- **At $2,000 and a cheap booking cost, capacity binds.** 100 bookings a month is about the ~100 empty free-class seats a month at today's schedule. Add sessions back first: there were ~33 a month before September.
- **Recommendation: start at $500 to $1,000** for the 4-week test. Scale only if week 2 to 3 shows a real cost per booking.

## 6. Measurement, and the privacy policy must come first

- **Must fix before any ad runs: peakpickleball.us has no privacy policy.**
  - /privacy-policy/ and /privacy/ both return 404 (checked 23 Nov 2026), and the homepage has no privacy link.
  - Meta's Business Tools Terms (§3) require "a clear and prominent notice on each web page where our pixels are used". That notice has to say how users can opt out, and link to a way to do it.
  - The Pixel is already running on the site, so the policy is overdue whether or not ads run.
  - The policy is in the scope of the website project quoted on 3 Nov. Colorado privacy law is a question for Peak's attorney, not this plan.
- **What Meta can measure:** landing-page views and "book now" clicks (Pixel Lead event), and instant-form leads.
- **What only CourtReserve can measure:** free-class bookings, attendance and Starter sign-ups. The nightly pull already tracks these:
  - new accounts per week
  - first-time free-class bookings per week
  - free-class attendance
  - new members (first dues) per week
  - **the "How did you hear about us?" answer.** CourtReserve asks it at sign-up, and Facebook and Instagram are options. From 23 Nov the nightly pull keeps that answer, and nothing else from the custom fields.
  - **It is mostly left blank:** 4,761 of 5,014 accounts created since 11 Nov 2025 have no answer. The most common answers are Friend or Family (125), Walked in / Drove By (54) and Google Search (23); Facebook has 2.
  - **Ask Tyler whether the question can be made required at sign-up.** That is a CourtReserve setting change, so it's his call, and it's the cheapest way to see ad-sourced sign-ups.
- **Weekly readout:** spend → Meta leads → CourtReserve new free-class first-timers ("heard about": Facebook/Instagram vs all) → attended → joined. **Compare against the baseline:**
  - about **21 free-class first-timers a week**: 1,104 people, 11 Nov 2025 to 10 Nov 2026
  - **14.7 new members a week**
  - The same weeks last year are also in `impact.json`, because of the Nov to Jan seasonality.
- **UTM tags** on every ad link: `utm_source=meta&utm_medium=paid&utm_campaign=free-intro-<month>`. Google Analytics (G-WDBWJ1Q6HN, on the site 23 Nov) sees the landing page. CourtReserve doesn't keep UTMs, which is why the "heard about" answer matters.

## 7. Four-week test schedule (once approved)

| Week | What happens | Decision at the end of the week |
|---|---|---|
| 0 (before) | Privacy policy live. Free-class follow-up (Patch A1 to A7) switched back on. Landing page or instant form ready. Pixel Lead event tested. Real photos chosen. Tyler approves budget and copy. | Go / no-go |
| 1 | Two ad sets on the local radius (Advantage+ audience vs interest hint), each with angles 1 and 2. Daily cap at ¼ of the monthly budget ÷ 7. | Kill any ad with no bookings after ~$75 |
| 2 | Keep the better ad set. Add angle 3 or 4. Start retargeting site visitors and IG/FB engagers. | First cost-per-booking read: compare it with the $37 break-even |
| 3 | Shift budget to the best ad. Check attendance (CourtReserve) and the "heard about" answers. | Is attendance holding near 78%? |
| 4 | Hold steady and gather the 30-day joins from week 1 bookings. | Scale, hold or stop. The full 60-day join read comes ~8 weeks after the test starts |

## Fact-check log

**Verified**
- **Entry-point table, 45.6% / 3.2%, 7-day and 60-day rates, 30-day monthly range, value per convert, booked → attended rate, free-class capacity, ZIPs and age bands:** computed 23 Nov 2026 from the CourtReserve pull (`tools/impact.mjs`, `data/pulls/2026-11-23/impact.json`).
- **Past ad spend, clicks and cost per link click:** Meta Graph API (read only), both ad accounts, 23 Nov 2026; campaign totals computed from account insights at campaign level.
- **Pixel id and GA tag:** on the homepage, and /privacy-policy/ and /privacy/ return 404 (curl, 23 Nov 2026).
- **Meta Business Tools Terms §1 and §3 wording:** facebook.com/legal/businesstech, read 23 Nov 2026.
- **Lookalike seed of at least 100 people per country:** Meta Marketing API docs, developers.facebook.com/docs/marketing-api/audiences/guides/lookalike-audiences. A third-party test (Jon Loomer) reports the minimum isn't strictly enforced; plan on 100+ anyway.
- **Prices:** CourtReserve membership types, 23 Nov.

**Corrected**
- "No Meta ads were found" (4 Nov draft) was wrong: Peak has two ad accounts with history, $1,108.70 and $205.60 lifetime, none spending since 3 Oct (Graph API v21.0 read, 23 Nov 2026; the per-day rows sum to the accounts' lifetime totals exactly).
- The free class does convert best, but not at 80%. Earlier notes used 45%, which matches "everyone who took it" (45.6% here). For new people from ads, the right rate is about 32% (first visit = free class).
- The 4 Nov first-draft figure of 18.6% was already withdrawn.

**Unresolved**
- The cost per booking on Meta for Peak: no past ad counted bookings or leads, so every scenario row is still an assumption (the past cost per link click is known).
- Whether ad-sourced people convert like everyone else.
- The radius distances (not measured).
- Whether Meta still offers the pickleball interest in Peak's ad account.
- Lookalike approval (Peak's decision).
- Whether Peak's site will host the landing page, or the instant form is used instead.
- Attribution: "How did you hear about us?" is blank for 95% of recent accounts, so until it's required, ad results rest on the timing of new free-class bookings against spend.
