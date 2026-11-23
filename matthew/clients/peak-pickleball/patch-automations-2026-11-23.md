# Peak Pickleball: Patch Retention automation audit (23 Nov 2026)

> **DRAFT: NOT CREATED IN PATCH, NOT SENT.** Nothing in this file has been built, switched on, scheduled or sent. Matthew and Tyler review it first; every automation below needs Tyler's go before anyone creates it in Patch.

This is Matthew's work for Peak, his own client (not Surge). It's built from the read-only pull of 23 Nov 2026 (`tools/nightly-pull.sh`). The data sits in `data/pulls/` (gitignored), and no names were kept.

## 1. How this was read, and what Patch would not give

- **Patch API, with Peak's key, GET only.**
  - `/v1/messages` returned every message since **25 Feb 2025**: 402,065 rows, made up of 400,416 sent and 1,649 replies.
  - `/v1/contacts` returns only the 50 newest contacts, and paging is ignored.
  - There are no endpoints for automations, campaigns, segments or reports.
  - **So the automation settings (trigger, audience, timing) are rebuilt here from the sends themselves.**
- **How each trigger was worked out.**
  - Each Patch contact carries a CourtReserve link (`PatchContactId`), and 99% of sends matched a CourtReserve member.
  - Every send was timed against that person's own CourtReserve history: check-ins, bookings, account creation, dues payments and birth month (`tools/patch-triggers.mjs`).
  - A trigger stated below is an **inference from timing**, and the share of sends that fit it is given each time.
- **Message wording.**
  - Patch only returns message text for recent sends (about the last few weeks), so the wording of the 2025 automations is gone. Their names are unknown and are described by what they did.
  - Subjects for Oct 2025 onward come from the 13 Nov pull. The nightly pull now keeps each automation's subject and a scrubbed copy of its text as it sends, so this gap won't grow.
- **Patch's MCP connector** (mcp.patchretention.com) would show the real settings, but it needs a person to sign in to Patch. The API key was refused with "access token is not bound to a user". The easiest way to confirm everything in section 2 is **15 minutes in Patch with Tyler, read-only**.
- **Open and click rates.** Rates are on delivered emails. Open rates are inflated by Apple Mail privacy across the industry, so use them for comparison only. Patch also marks sends "converted" without saying how, so that column is left out.

## 2. What is automated in Patch today

### 2a. The current set (built Sep 2025 to Mar 2026)

| # | Automation (subject) | Trigger (inferred, with fit) | Audience | Timing | Status (last send) | Sent since Feb 2025 | Open | Click |
|---|---|---|---|---|---|---|---|---|
| 1 | Birthday: "Celebrate your birthday with 50% OFF Peak gear!" | Birthday month (96% of sends went to people in their birth month) | Everyone with a birth date, 89% of them free Drop In accounts | 10 to 11 am MT | **Not sending since 19 Nov 2026** (ran daily before) | 12,685 email | 19.0% | 1.2% |
| 1b | Birthday step 2: "Celebrate with 50% OFF Open Play for you + a friend" | Same birthday trigger (79% birth month) | Same | 10 am | Rare or stopped (6 Jul 2026) | 2,250 email | 24.0% | 0.0% |
| 2 | "Thank you for visiting today!" (Google review ask) | Check-in: 87% of sends fall within 26 h after a check-in (median 18.7 h). Once per person, so most likely the first visit only | Anyone who checks in, 70% of them Drop In | 8 to 9 am the next morning | **Stopped? (last 1 Nov 2026)** | 2,641 email | 29.2% | 2.7% |
| 3 | Plan welcomes, one per plan: Starter / Play / Unlimited / Senior Play / Senior Unlimited / Platinum | A plan starts: sent a median of ~28 h after the person's dues payment | New or changed plan | 8 to 9 am | **Stopped? (last 1 Nov 2026)** (Unlimited 27 Oct, Senior Play 2 Oct, Senior Unlimited 1 Sep) | Starter 316, Play 362, Unlimited 253, Senior Play 140, Senior Unl. 39, Platinum 2 | Starter 42.8%, Play 31.1%, Unl. 38.5%, Senior 47.8% | Starter 10.0%, Play 3.3%, Unl. 2.0% |
| 4 | "You're in! Drop in & play pickleball whenever it works for you" | New account (99% within 26 h of the account being created) | New free accounts | 9 am | **Stopped (13 Jul 2026)** | 1,245 email | 23.7% | 1.5% |
| 5 | "Your Free Intro to Pickleball Class is tomorrow!" | Booked on the free class (87% sent within 26 h before it; median 23.9 h) | Free-class sign-ups | 4 to 5 pm the day before | **Stopped (29 Sep 2026)** | 767 email | 30.0% | 0.7% |
| 6 | "Congrats on completing Intro! Unlock your Starter Membership 🎉" | Free class ended (85% within 26 h after it; median 15 h) | Free-class attendees | 8 am the next morning | **Stopped (29 Sep 2026)** | 575 email | 26.8% | 2.7% |

### 2b. The 2025 set (all stopped 24 to 26 Jul 2025, except row 7, which stopped 26 Jun 2025)

These ran from late Feb 2025. All of them sent email plus text.

| # | What it did (inferred) | Trigger and timing | People | Sent | Email open / click |
|---|---|---|---|---|---|
| 7 | Monthly nudge to free Drop In accounts | Recurring about every 31 days, Mon/Wed/Thu/Sat at 9 am | ~7,200 | 24,751 email + 22,590 text | 21.0% / 0.0% (145 email + 245 text unsubscribes) |
| 8 | "We miss you" series for visitors | 3 emails + 3 texts at about 35, 60 and 90 days after the last check-in | ~2,700 per step | 9,006 email + 7,704 text | 22.6 to 23.2% / 0.1 to 0.4% |
| 9 | Second lapsed-visitor series | 2 emails + 2 texts about 7 weeks after the last visit, two days apart, mostly Fridays | ~1,700 | 3,473 email + 3,364 text | 18 to 20% / 0.1 to 0.2% |
| 10 | New-account onboarding | 2 emails, ~1.6 days and ~8.6 days after the account was created | ~3,100 | 6,506 email | 23% / 0.6% |
| 11 | New-member welcome | 2 emails, ~16 h and ~8 days after the first dues payment | ~135 | 274 email | 38 to 41% / 2.2% |
| 12 | **Lapsed-member win-back** | 3 emails + 3 texts at ~36, ~46 and ~60 days after the last dues payment | ~450 / 410 / 357 | 1,339 email + 1,314 text | 32 to 34% / up to 0.7% |
| 1c, 2b | Birthday texts and visit thank-you text | As rows 1 and 2 | | 3,103 + 1,685 text | The thank-you text was clicked by 19.7% |

### What the history shows

1. **No Patch automation has sent anything since 19 Nov 2026.**
   - The birthday email sent 23 to 41 a day through 19 Nov, then none on 20, 21 or 22 Nov.
   - Blasts still go out: the Thanksgiving email reached 5,001 people on 23 Nov.
2. **Before that, from 1 Nov, only the birthday email was still sending.**
   - The plan welcomes and the visit thank-you all last sent at 16:00 UTC on 1 Nov, the same minute.
   - Since then, Peak has had 33 new paying members and none of them got a welcome.
   - That looks like a switch-off, or a trigger that stopped firing, not a quiet patch. **Ask Tyler first: was it intentional?**
3. **The free-class reminder and the follow-up both stopped on 29 Sep 2026.**
   - About 103 first-time free-class attendees in October and November got neither.
   - This is the automation behind Peak's best conversion path (section 3).
4. **New free accounts have had no welcome since 13 Jul 2026.** That's 1,569 accounts created from 14 Jul to 22 Nov.
5. **Texting ran at scale in spring 2025 and then stopped.**
   - In March 2025 a text blast went to 6,775 people. 624 sends were marked unsubscribed, plus 773 more on the one-off replies that month (most likely STOP confirmations).
   - All automated texts ended in July 2025. Since then, 3 texts have gone out.
   - **Email consent:** 13,752 accounts are opted in to marketing email, and 2,512 have unsubscribed from it.
   - **2,882 of 16,264 CourtReserve accounts are opted in to marketing texts today** (CourtReserve marketing consent, 23 Nov). That is the number the 13 Nov notes couldn't get.
6. **Win-back has been tried before.** Rows 8, 9 and 12 ran for five months in 2025 with clicks under 1%. Any new win-back needs a reason to come back (an offer or an event), not just "we miss you".
7. **Copy conflicts to fix wherever this copy is reused:**
   - The Starter and Play welcomes say "$6 per hour". CourtReserve's own plan text says **$7 per hour** for Starter and Play, which matches Tyler on 11 Nov.
   - The Play welcome says "cancel anytime with 30 days' notice", but CourtReserve says Play is "must cancel 15 days in advance".
   - The Play welcome points to the "Peak Pickleball **Starter** Community" Facebook group.
   - The 16 Nov Thanksgiving blast preheader reads "we;re".

## 3. The gaps, against what a club like Peak normally automates

The audience sizes are from the 23 Nov pull. The trigger types marked **proven** have already fired in Peak's own Patch account (section 2). **Unconfirmed** means Patch may not see that CourtReserve event, so check it in Patch before building.

| Gap | Today | Audience now | Trigger type |
|---|---|---|---|
| A. Free-class follow-up series | 2 emails, stopped 29 Sep | 49 to 106 first-timers a month since May 2026 (49 in Oct); 612 past attendees who never joined (12 months) | proven (booked, class ended) |
| B. New member welcome series | 1 email per plan, stopped 1 Nov | 33 since 1 Nov; 14.7 a week in the baseline year | proven (plan start) |
| B2. New account welcome | Stopped 13 Jul | 1,569 since 14 Jul | proven (account created) |
| C. Lapsed member win-back | Ran in 2025, stopped Jul 2025 | Last dues 45 to 90 days ago: 80; 90 to 180 days: 197; 180 to 365 days: 469 | proven (days since last dues) |
| C2. Cancellation save | None | ~22 paid plans with an end date set (Nov 2026 to Feb 2027) | unconfirmed (end date set) |
| D. Failed payment / card expiring | None in Patch | Nov 2026: 21 paid accounts suspended; 2 November dues charges ($194) past due on 23 Nov (corrected: the earlier 27/$1,690 counted charges not yet due) | unconfirmed (past due / suspended) |
| E. Birthday | Gear 50%, not sending since 19 Nov | 14,883 accounts have a birth date | proven |
| F. Membership renewal (prepaid annual) | None | 39 accounts next billed Sep to Oct 2027 | unconfirmed (next payment date) |
| G. League / event reminders, release your spot | None in Patch (CourtReserve's own booking emails unknown) | 17.2% of event sign-ups cancelled in the baseline year; 60% of Open Play cancels in the last 24 h (4 Nov baseline); 2,331 still waitlisted | proven (booked: row 5) |
| H. Referral ask | None | 807 active paid members | proven (plan start + days) |
| I. Review request | Stopped 1 Nov | Every visit | proven (check-in) |
| J. Drop-in (guest) to member | None since Jul 2025 | **426 non-members with 3+ check-ins in the last 60 days; 157 with 6+** | proven (check-in) |
| K. No-show follow-up | None | 967 Open Play no-shows marked in CourtReserve check-ins (whole store); $10 no-show fees charged 104 times | unconfirmed (no-show status) |
| L. Starter upgrade (one of the six places to grow) | None | 194 active Starter members | proven (plan start + days) |

### Top 5 by likely effect

1. **A, the free-class series.** People who took the free class went on to pay dues at **45.6%**, against **3.2%** for people who never did (accounts created 11 Nov 2025 to 23 Sep 2026). The one follow-up Peak had is off.
2. **B and B2, the welcome series.** Both are off. With monthly churn averaging 11.4% in the baseline (paid in one month, then nothing for two), the first month is where members are lost.
3. **J, drop-in regulars to members.** 426 people already play at least 3 times in 60 days and pay $12 an hour.
4. **C and C2, win-back and cancellation save.** 80 + 197 recent lapses, plus ~22 scheduled cancellations that can still be caught.
5. **D, failed payment.** 21 suspended accounts and about 3 charges a month still unpaid at 10 days (corrected 23 Nov: the earlier 27/$1,690 counted charges raised before their due day). Plans suspend 10 days past due and cancel at 11 (CourtReserve plan settings), so a reminder has to land inside 10 days.

## 4. The automations, written out (paste-ready drafts)

Conventions for every draft below.

- **Voice.** Peak's own: a caps headline, "Hi {first_name},", short warm paragraphs, light emoji, signed "— The Peak Pickleball Team", and the tagline "Learn. Play. Connect. Belong." from Peak's 16 Nov newsletter.
- **Footer.** Use Peak's standard Patch footer (address, phone (719) 377-4725, unsubscribe).
- **Texts.** Texts go only to people opted in to texts (CourtReserve marketing consent). Each ends with "Reply STOP to opt out" unless Patch adds that itself (check in Patch). Each is kept under 160 characters where possible.
- **Merge tags.** `{first_name}` is Patch's merge tag as it appears in Peak's own emails. Any other tag shown, such as `{class_time}`, has to be checked against Patch's tag list before use.
- **Placeholders for Tyler.** Anything in **[BRACKETS]** is a business decision for Tyler (offers, rewards, deadlines). Nothing in brackets is a Peak policy today.
- **Exit rule for every series:** stop as soon as the person starts a paid plan (or, for the payment series, pays).

---

### A. Free-class follow-up series (replaces rows 5 and 6)
**Trigger:** registered for an event in the "Learn to Play Pickleball" category (A1, A2), then event end time (A3 to A7). **Audience:** free-class sign-ups with no active paid plan. **Exclude:** guests, staff, anyone already on a paid plan. **Exit:** starts any paid plan.

**A1. Email, the day before, 4 pm (restores row 5)**
- Subject: Your free Intro to Pickleball class is tomorrow! 🏓
- Preheader: Paddles and balls are on us. Here's what to expect.
> **SEE YOU TOMORROW AT PEAK!**
> Hi {first_name},
> You're booked for our free Intro to Pickleball class tomorrow. We can't wait to get you on court.
> **What to bring:** comfortable clothes, court or athletic shoes, and water. Paddles and balls are on us.
> **When you arrive:** check in at the front desk, and our coaches will take it from there. No experience needed. Most people are rallying by the end of the class.
> **Where:** Peak Pickleball, 1730 Briargate Blvd, Colorado Springs.
> Can't make it? Please cancel in the CourtReserve app so someone on the waitlist can take your spot.
> See you on the courts!
> — The Peak Pickleball Team

**A2. Text, 2 hours before (text opt-ins only)**
> Peak Pickleball: Hi {first_name}, see you soon for your free Intro to Pickleball class! Paddles and balls are on us. 1730 Briargate Blvd. Reply STOP to opt out.

**A3. Email, the next morning, 8 am (restores row 6, rewritten)**
- Subject: You did it, {first_name}! Your Starter Membership is unlocked 🎉
- Preheader: An exclusive plan just for Intro grads.
> **FROM INTRO TO GAME ON**
> Hi {first_name},
> Thanks for joining us for Intro to Pickleball! You've now unlocked **Peak Starter**, a membership only for players who've completed Intro.
> - **$35/month**, no contract
> - Courts at **$7 per hour** (instead of $12)
> - **Two free Peak Pickleball University classes**: PPU 101 (Dinking, Dropping & Resetting) and PPU 102 (Serve, Return & Gameplay)
> - Book courts 7 days ahead
> - Guided Open Play to build confidence with light instruction
>
> **[BUTTON: Start my Starter Membership]**
> Questions? Our front desk Player Assistants are happy to help.
> — The Peak Pickleball Team

*(Check before sending: the Starter price, the court rate (CourtReserve says $7, the old email said $6), and whether Starter eligibility expires after a set time.)*

**A4. Email, day 3 (no plan yet)**
- Subject: Your next step on the court
- Preheader: Guided Open Play is the easiest way to keep going.
> **KEEP THE MOMENTUM GOING**
> Hi {first_name},
> The best time to play again is this week, while it's all fresh. **Guided Open Play** is made for new players: you play real games with a coach nearby to help.
> **[BUTTON: See the Guided Open Play schedule]**
> Starter members also get PPU 101 and 102 included, so you can learn the shots that make the game click.
> **[BUTTON: Unlock Starter, $35/month]**
> — The Peak Pickleball Team

**A5. Text, day 7 (no plan yet, text opt-ins only)**
> Peak Pickleball: Hi {first_name}, ready for round two? Starter is $35/mo with 2 free PPU classes, just for Intro grads: [LINK]. Reply STOP to opt out.

**A6. Email, day 14 (no plan yet)**
- Subject: Come play with us this week
- Preheader: Quieter courts, easy booking, the same friendly crew.
> **YOUR COURT IS WAITING**
> Hi {first_name},
> It's been two weeks since your Intro class. We'd love to see you back. Weekday afternoons are some of our quietest times, which makes them perfect for practising what you learned.
> **[BUTTON: Book a court]** or **[BUTTON: Join Guided Open Play]**
> Your Starter offer is still waiting for you. **[If Tyler sets a deadline: "until [DATE]".]**
> — The Peak Pickleball Team

**A7. Email, day 30 (no plan yet; last in the series)**
- Subject: Still thinking about it?
> Hi {first_name},
> No pressure, just a reminder that you can play at Peak any time as a drop-in ($12 per hour, no membership). When you're ready to play more often, Starter is there for you.
> **[BUTTON: See membership options]**
> Learn. Play. Connect. Belong.
> — The Peak Pickleball Team

---

### B. New member welcome series (restores row 3, adds steps)
**Trigger:** paid plan starts (proven: row 3 fired ~28 h after a dues payment). **Audience:** new paid plans (Starter, Play, Flex, Unlimited, Senior Play, Senior Unlimited, Platinum, Student). **Exclude:** plan changes between paid plans (send L instead), staff, sponsors. **Timing:** B1 the next morning at 8 am, B2 day 3, B3 day 14, B4 day 30.

**B1. Email: the existing per-plan welcome, switched back on, with three fixes.** Use $7 per hour where CourtReserve says so. Use 15 days' cancellation notice for Play and Flex, as CourtReserve's plan text says. Link Play members to the right Facebook group, not the "Starter Community".

**B1b. Text, same morning (text opt-ins only)**
> Peak Pickleball: Welcome to the Peak family, {first_name}! 🎉 Download the CourtReserve app to book courts and check in with your QR code. Reply STOP to opt out.

**B2. Email, day 3**
- Subject: Make your first week count
- Preheader: The easiest ways to find games and people at your level.
> **FIND YOUR GAME**
> Hi {first_name},
> Here are the three easiest ways members find regular games at Peak:
> 1. **Open Play** is drop in, rotate, and meet players at your level. **[BUTTON: Open Play schedule]**
> 2. **Social Play** and **Dinks & Drinks** are relaxed, friendly, and our best-filled sessions.
> 3. **Leagues** give you a regular group, a regular night and friendly competition. **[BUTTON: See leagues]**
>
> Tip: weekday mornings 8 to 11 am fill fastest. Book ahead, or try early afternoon for open courts.
> — The Peak Pickleball Team

**B3. Email, day 14**
- Subject: How's it going, {first_name}?
> Hi {first_name},
> You've been a Peak member for two weeks. How's it going? Just hit reply and tell us anything: what you love, what's confusing, what you'd like more of. A real person on our team reads every reply.
> — The Peak Pickleball Team

**B4. Email, day 30: leads into H (referral)**
- Subject: One month in 🏓
> Hi {first_name},
> One month at Peak! Thanks for being part of the community. Know someone who'd love it? Our free Intro to Pickleball class is the best way to start, and it's on us. **[BUTTON: Share the free class]**
> — The Peak Pickleball Team

### B2. New account welcome (restores row 4)
**Trigger:** account created (proven). **Audience:** new free (Drop In) accounts. **Timing:** the next morning at 9 am. **Message:** turn the existing "You're in!" email back on, and add one line and a button under the drop-in price: "New to pickleball? Start with our **free Intro to Pickleball** class. **[BUTTON: Book the free class]**". The data says the free class is where new people become members.

---

### C. Lapsed member win-back (replaces 2025 row 12)
**Trigger:** days since the last dues payment, with the plan now ended ("No Membership" in CourtReserve). Row 12 fired on this in 2025. **Audience:** ex-paid members, not staff or sponsors, not on a prepaid annual. **Timing:** day 14, day 45 and day 90 after the plan ends. **Lesson from 2025:** row 12 got 32 to 34% opens but under 1% clicks, so each step carries a reason to come back.

**C1. Email, 14 days after the plan ends**
- Subject: We miss you on the courts, {first_name}
> **THE COURTS AREN'T THE SAME WITHOUT YOU**
> Hi {first_name},
> We noticed your membership ended, and we'd love to know why. One click tells us: **[Too busy] [Price] [Moved / travel] [Injury] [Something else]**. Every answer goes straight to our team.
> If price was the reason, there may be a better fit now. **Peak Flex** is $99/month with no hourly court fees, and **Peak Senior Play** is $29/month for players 55+.
> **[BUTTON: Compare memberships]**
> — The Peak Pickleball Team

**C2. Email, day 45**
- Subject: Come back for [OFFER]
> Hi {first_name},
> Here's what's coming up at Peak: **[NEXT EVENT, e.g. Christmas Cup 12 to 13 Dec]**. Come back and play: **[OFFER: Tyler to choose, e.g. first month back at a set price, or a free guest pass]**.
> **[BUTTON: Rejoin Peak]**
> — The Peak Pickleball Team

**C3. Text, day 90 (text opt-ins only)**
> Peak Pickleball: Hi {first_name}, we'd love to have you back! [OFFER] this month: [LINK]. Reply STOP to opt out.

### C2. Cancellation save (new)
**Trigger:** a membership end date is set in CourtReserve. This is **unconfirmed**: check whether Patch sees an end date before the plan ends. **Audience:** paid plans with an end date in the future. **Timing:** the next morning, once.

- Subject: Before you go, {first_name}
> Hi {first_name},
> We saw your membership is set to end on [END DATE]. Before it does, is there something we could do better? Just reply. If it's the price or your schedule, here are other ways to stay:
> - **Peak Flex**: $99/month, no hourly court fees
> - **Peak Play**: $39/month, courts at $7 per hour
> - **Peak Senior Play** (55+): $29/month
> - **[PAUSE OPTION: only if Peak offers a freeze]**
>
> **[BUTTON: Change my plan instead]**
> — The Peak Pickleball Team

---

### D. Failed payment (new)
**Trigger:** a membership payment fails or goes past due. This is **unconfirmed**: check whether Patch receives past due or suspended from CourtReserve. CourtReserve suspends paid plans **10 days** past due and auto-cancels at **11**. **Audience:** paid plans with an unpaid dues charge. **Timing:** day 1, day 5 and day 9 past due. **Exit:** paid. **Tone:** plain and kind, with no blame. Most failures are expired or replaced cards.

**D1. Email + text, day 1**
- Subject: Quick fix needed: your Peak payment didn't go through
> Hi {first_name},
> Your membership payment of [AMOUNT] didn't go through. This usually just means a card expired or was replaced. You can update it in a minute in the CourtReserve app under **My Account → Payment Methods**, or stop by the front desk.
> **[BUTTON: Update my card]**
> — The Peak Pickleball Team
- Text: Peak Pickleball: Hi {first_name}, your membership payment didn't go through. Update your card in the CourtReserve app to keep your plan active. Reply STOP to opt out.

**D2. Email, day 5**
- Subject: Your Peak membership: payment still needed
> Hi {first_name}, just a reminder: we still couldn't collect your membership payment. To keep your booking privileges and member rates, please update your card by **[DATE: day 10]**. **[BUTTON: Update my card]**

**D3. Email + text, day 9**
- Subject: Last reminder: keep your Peak membership active
> Hi {first_name}, your membership will be paused tomorrow if the payment isn't updated. It only takes a minute: **[BUTTON: Update my card]**. Questions? Call us at (719) 377-4725.

**Card expiring:** the CourtReserve API does not show card expiry dates, so Patch probably can't trigger on them. Ask Tyler whether CourtReserve already sends its own "card expiring" notice before building one.

---

### E. Birthday (ran daily until 19 Nov: restart, refresh)
Keep row 1 (gear 50%). It's Peak's longest-running automation, but it has sent nothing since 19 Nov, so restart it first. Three changes:

1. Split by audience. Of the people it reaches, 89% are free accounts.
2. **Paid members:** add the old step 2 back as a member perk.
   - Subject: Happy birthday, {first_name}! Bring a friend on us 🎉
   > Hi {first_name}, happy birthday from all of us at Peak! This month, bring a friend to Open Play and **[OFFER: their session is free / 50% off, as Tyler chooses]**. Show this email at the front desk. — The Peak Pickleball Team
3. **Free accounts:** swap the gear offer for the free Intro class or a discounted Open Play session, so the email leads to a visit rather than to merchandise. **[Tyler to choose]**

---

### F. Prepaid annual renewal (new)
**Trigger:** 30 days and 7 days before the next payment date on Unlimited Annual or Platinum Annual. This is **unconfirmed**: check whether Patch can use the CourtReserve next-payment date. **Audience:** 39 accounts next billed Sep to Oct 2027 (the 41 prepaid annual members from Sep and Oct 2026). **Build it any time before Aug 2027.**

- Subject: Your Peak annual membership renews on [DATE]
> Hi {first_name},
> Thank you for a year at Peak! Your **[PLAN]** annual membership renews on **[DATE]** at **[PRICE]**. There's nothing you need to do. If anything has changed, or you'd like to switch plans, just reply or visit the front desk before then.
> — The Peak Pickleball Team

---

### G. League and event reminders, with "release your spot" (new)
**Trigger:** registered for an event (proven: row 5 used a booking trigger). **Audience:** Open Play, Social, Senior, DUPR, Early Play, leagues, Peak events. Not the free class, which has A1 and A2. **Timing:** 26 hours before the start (so it lands before the window closes), email or text.

- **First check that CourtReserve isn't already sending a reminder**, so people don't get two.
- **Cancel windows:**
  - Tyler (11 Nov) gave 4 h for courts.
  - The 4 Nov baseline used 4 h for Open Play and 24 h for classes.
  - Peak's FAQ still says 24 h. Confirm the window for each category before wording it.

- Text: Peak Pickleball: See you tomorrow at [EVENT] [TIME]! Can't make it? Cancel in the CourtReserve app by [CUTOFF] so a waitlisted player gets in. Reply STOP to opt out.
- Email subject: See you tomorrow at [EVENT]
> Hi {first_name}, you're on for **[EVENT]** tomorrow at **[TIME]**. Plans changed? Please cancel in the CourtReserve app by **[CUTOFF]**. There are players on the waitlist who'd love the spot. See you on court! — The Peak Pickleball Team

---

### H. Referral ask (new)
**Trigger:** 60 days on a paid plan, with 8 or more check-ins in that time. Checking the check-in count needs a Patch condition: **unconfirmed**. Without it, use 60 days on a plan. **Audience:** active paid members. **Timing:** once, at 10 am.

- Subject: Who should play at Peak next?
> **SHARE THE GAME**
> Hi {first_name},
> You've been playing at Peak for two months. Thank you! Who in your life would love it? The free Intro to Pickleball class is the easiest way in: paddles provided, no experience needed.
> **[BUTTON: Send them the free class]**
> **[REWARD: only if Tyler sets one, e.g. a guest pass when a friend joins]**
> — The Peak Pickleball Team

---

### I. Review request (restores row 2, moves it)
**Trigger:** check-in (proven). **Change:** ask **members on their 5th check-in** (or 30 days into a plan), not first-time visitors. People who keep coming are the ones with something to say. Keep the existing copy and Google link. **Also ask Tyler** whether row 2 was switched off on purpose on 1 Nov.

---

### J. Drop-in regular to member (new; the biggest untapped list)
**Trigger:** 3rd check-in within 30 days, for people with no paid plan. Check-in is proven; the count condition is **unconfirmed** in Patch. **Audience now:** 426 people (3+ check-ins in the last 60 days), 157 of them with 6+. **Timing:** the next morning at 9 am, at most once every 90 days.

- Subject: You're playing a lot, {first_name}. Here's how to pay less 🏓
> **YOU'RE ONE OF OUR REGULARS**
> Hi {first_name},
> You've been on court at Peak a lot lately, and we love it. As a drop-in you pay **$12 per hour**. Members pay less:
> - **Peak Play**, $39/month: courts at **$7 per hour**. It pays for itself at about **8 hours a month**.
> - **Peak Flex**, $99/month: **no hourly court fees**, Mon to Sat 12 to 5 pm plus Sunday.
> - **Peak Unlimited**, $159/month: **no hourly fees, any time**, plus a guest pass every month.
>
> **[BUTTON: Find my best plan]**
> — The Peak Pickleball Team

*(Break-even worked from CourtReserve's listed prices: Play $39 ÷ ($12 − $7) = 7.8 hours a month. The Flex hours come from the 4 Nov packet and the Flex listing, so check them before sending.)*

---

### K. No-show follow-up (new)
**Trigger:** check-in status "No-Show". This is **unconfirmed**: CourtReserve records it (967 Open Play no-shows in the pulled check-ins), but Patch may not see it. **Audience:** anyone marked No-Show. **Timing:** the next morning, at most once a month per person.

**Tyler decides first:**
- whether the $10 no-show fee is policy. It was charged 104 times, mostly Oct 2025 and Feb 2026, and only twice since.
- whether this message mentions it.

- Subject: We missed you yesterday
> Hi {first_name},
> We saved you a spot at **[EVENT]** yesterday but didn't see you. Hope all is well! Next time plans change, please cancel in the CourtReserve app, even last minute, so someone on the waitlist can play. **[If policy: "No-shows may be charged a $10 fee."]**
> — The Peak Pickleball Team

---

### L. Starter upgrade (one of the six places to grow; new)
**Trigger:** 75 days on Starter (proven: plan start plus days). **Audience:** 194 active Starter members. **Timing:** day 75, then day 120 if they're still on Starter.

- Subject: Ready for your next level, {first_name}?
> **YOU'VE GROWN YOUR GAME**
> Hi {first_name},
> You started at Peak with Intro and Starter. Look at you now! If you're playing more, there's a plan that fits:
> - **Peak Flex**, $99/month: no hourly court fees, Mon to Sat 12 to 5 pm plus Sunday
> - **Peak Unlimited**, $159/month: play any time with no hourly fees, plus a monthly guest pass
>
> **[BUTTON: Compare my options]**
> — The Peak Pickleball Team

*(Tyler, 11 Nov: Starter members who upgrade pay $159 for Unlimited.)*

## 5. What to ask Tyler before anything is built

**Answered 23 Nov, 4:29 pm (Cammie, by email to Matthew):** she turned the automations off on purpose, "for now", so each email can be revisited and redesigned: Peak's branding and the correct logos, a stronger brand voice, better calls to action, and a review of each one's rules and triggers. She agreed with the order (automations first, then the website, then ads) and wants to work on both together, with visibility and oversight for both of them. So bringing them back is a joint redesign with Cammie, not a switch-on.

1. Were the welcome and thank-you automations switched off on 1 Nov, the free-class pair on 29 Sep, and the birthday email after 19 Nov, on purpose? Has something changed in the CourtReserve to Patch connection (for example with the 15 Oct Momentum upgrade or the branded app)?
2. Can Matthew have a read-only look at Patch's automation screen (or sign in to Patch's MCP connector) to confirm the triggers inferred here?
3. Which CourtReserve events can Patch trigger on: past due or suspended, end date set, no-show, next payment date?
4. Does CourtReserve already send booking reminders, payment-failed or card-expiring emails?
5. The offers and rewards in brackets: win-back offer, referral reward, birthday member perk, freeze option, and whether Starter eligibility expires.
6. Texts: what Patch's text pricing is within the $499/month, and the sending number.
7. The court rate for Starter and Play ($7 per CourtReserve, $6 in the emails) and Play's notice period (15 or 30 days).

## Fact-check log

**Verified (from the 23 Nov pull unless noted)**
- Patch history:
  - 402,065 messages, 25 Feb 2025 to 23 Nov 2026
  - sends, opens, clicks and unsubscribes per automation block
  - the last-send dates
  - the 1 Nov 16:00 UTC stop, and no automation sends from 20 to 22 Nov
- Trigger timings: from `patch-triggers.mjs`, joining 99% of sends to CourtReserve members.
- Consent: text opt-ins 2,882 of 16,264 accounts; email opt-ins 13,752; 2,512 unsubscribed from marketing email.
- Audiences:
  - 426 / 157 drop-in regulars
  - 194 Starter
  - 807 paid active
  - lapsed 80 / 197 / 469
  - 27 open November charges ($1,690) on 23 Nov, but only 2 ($194) past due (corrected 23 Nov)
  - 21 suspended
  - 1,569 new accounts since 14 Jul
  - 33 new paying members since 1 Nov (first-ever dues, 1 to 22 Nov)
- Free class: 45.6% vs 3.2%.
- Churn: 11.4%.
- Suspend and cancel days (10 / 11): CourtReserve membership type settings.
- Prices: CourtReserve membership type list, 23 Nov.
- Message copy and voice: Peak's own Patch emails (birthday, thank-you, Starter and Play welcomes, the 3 Nov and 16 Nov newsletters).

**Corrected**
- The 13 Nov notes said "only 4 automations" and counted 1,290 "Congrats on completing Intro" emails. The full history shows 12 automation sequences since Feb 2025 (6 current, 6 from 2025). Peak's free-class follow-up was two emails: a reminder (767) and the congrats (575).
- "Texting has essentially never been used" was true only from Aug 2025 on. About 39,760 automated texts and 32,874 blast texts went out from Feb to Jul 2025.
- Patch's 50-newest contacts showed 26 of 50 with texts on; that is not representative. The CourtReserve consent count (2,882) replaces it.

**Unresolved**
- The real names, settings and wording of the 2025 automations (Patch no longer returns their content).
- Whether the 29 Sep, 1 Nov and 19 Nov stops were deliberate, or the connection broke.
- Which CourtReserve events Patch can trigger on (marked unconfirmed above).
- What Patch's "converted" counts.
- The court rate and Play notice conflicts.
- Open rates are inflated by Apple Mail privacy.
- The cause of the March 2025 text unsubscribes (STOP confirmations is an inference).

## Addendum, 23 Nov: Patch's own list figures (Matthew, Patch > Automations, extra columns; nothing changed or saved there)

| Automation | Sent | Patch revenue | $ per message | Opt-outs (rate) | Last run | Last modified |
|---|---|---|---|---|---|---|
| New Paid Membership Welcome | 274 | $4,973.76 | $18.15 | 0 (0%) | 24 Jul 2025 | 9 Jun 2026 |
| Target New Non-Members | 6,506 | $107,269.78 | $16.49 | 47 (0.7%) | 25 Jul 2025 | 19 Aug 2026 |
| Google Review | 4,326 | $36,324.28 | $8.40 | 10 (0.2%) | 2 Nov 2026 | 23 Nov 2026 6:17 am |
| PPU Pipeline | 1,342 | $10,605.37 | $7.90 | 5 (0.4%) | 1 Nov 2026 | 9 Nov 2026 |
| Membership Create | 2,357 | $16,942.31 | $7.19 | 9 (0.4%) | 2 Nov 2026 | 2 Nov 2026 5:00 pm |
| Expired Membership Winback | 2,653 | $5,302.81 | $2.00 | 35 (1.3%) | 25 Jul 2025 | 6 Oct 2025 |
| Birthday Email | 18,038 | $32,494.90 | $1.80 | 401 (2.2%) | 19 Nov 2026 | 20 Nov 2026 4:26 pm |
| Non-Member At-Risk/Lost Winback | 6,837 | $7,347.00 | $1.07 | 94 (1.4%) | 25 Jul 2025 | 15 Jun 2026 |
| Non-Member Reengagement | 16,710 | $15,187.85 | $0.91 | 126 (0.8%) | 25 Jul 2025 | 3 Aug 2026 |
| Non-Member Pushing Convert | 47,341 | $24,464.57 | $0.52 | 390 (0.8%) | 26 Jun 2025 | 16 Nov 2026 |

All 17 are Enabled off / Draft. Patch "revenue" is attribution (spend by anyone who got a message), not proof the message caused it: use it to
rank, not as a result. Suggested order to bring back (Tyler decides): the two welcomes + Target New Non-Members, then Google Review and PPU
Pipeline; review the Birthday email's audience and wording first (highest opt-out rate); Non-Member Pushing Convert last or not at all
(47,341 sent, 0 clicks). Someone with Patch access is editing them now (latest 23 Nov 6:17 am): coordinate before building anything.
