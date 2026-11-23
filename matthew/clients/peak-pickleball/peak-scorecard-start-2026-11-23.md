# Peak Pickleball: the weekly scorecard's starting point (Week 0, 16 to 22 Nov 2026)

> **For Matthew only.** These numbers go in his Sunday business report and nowhere else. Nothing was sent, and nothing was changed
> in CourtReserve or Patch. Read-only data from the nightly pull of 23 Nov 2026.

Matthew, 23 Nov 2026: "I am considering today the first day of work for peak ... track where they are at currently so that I can see
how much they are growing week to week ... I need to be measuring whatever we can."

- **Day one:** Monday 23 Nov 2026.
- **Week 0:** Monday 16 to Sunday 22 Nov 2026, the last full week before day one. Every later week is compared with it.
- **Week N:** the Nth Monday-to-Sunday week from day one. Week 1 is 23 to 29 Nov.
- **Week 1 is Thanksgiving week, so it is seasonal.** Read it against the same week last year (24 to 30 Nov 2025, which was also
  Thanksgiving week), not against Week 0. Christmas and New Year weeks get the same label in the report.
- **Made by:** `node tools/impact.mjs --week-end=2026-11-22` (readable) or `--json`. The Sunday report runs it for its own week.
  The definitions are in `impact-measurement-2026-11-23.md` and in the WEEK MODE block of `tools/impact.mjs`. Change both together.

## Week 0

- **12-month normal:** baseline B, 11 Nov 2025 to 10 Nov 2026 (the 12 months before Tyler's go). Counts are per week; rates are over
  the 12 months; the paying-members count is the average of B's Sundays.
- **Same week last year:** 364 days earlier, Mon 17 to Sun 23 Nov 2025.
- **Last week:** 9 to 15 Nov 2026.

| Metric | Week 0 | 12-month normal | Same week last year | Week before (9-15 Nov) |
|---|---|---|---|---|
| Paying members (dues cover the Sunday) | **727** | 794 | 793 | 735 |
| Active on a paid plan, member list (23 Nov) | **807** | n/a | n/a | n/a |
| Suspended on a paid plan, member list (23 Nov) | **21** | n/a | n/a | n/a |
| New members | **13** | 14.7 | 27 | 10 |
| Lapsed members (not final until 22 Dec) | **26** | 19.4 | 10 | 15 |
| Dues collected | **$9,696** | $13,187 | $12,254 | $7,744 |
| Free-class first-timers | **16** | 21.2 | 26 | 14 |
| Free-class attendance | **18** | 22.9 | 27 | 15 |
| Joined within 7 days of a free class (4 of 15; not final until 30 Nov) | **26.7%** | 37.3% | 53.8% | 21.4% |
| New accounts | **50** | 94.3 | 99 | 46 |
| Court utilisation, all hours | **41.5%** | 41.0% | 42.1% | 40.2% |
| Court utilisation, weekday 3 to 5 pm | **27.1%** | 26.8% | 30.3% | 25.3% |
| Court utilisation, 5 to 8 am | **18.4%** | 15.3% | 18.2% | 16.3% |
| Open Play fill | **23.6%** | 46.7% | 53.7% | 21.3% |
| Open Play sessions full (of 39) | **1** | 5.2 (of 41.3) | 14 (of 65) | 0 (of 38) |
| Event registrations, kept | **1,234** | 1,283 | 1,390 | 1,153 |
| Event cancellations | **177** | 266 | 328 | 160 |
| Event cancellation rate | **12.5%** | 17.2% | 19.1% | 12.2% |
| Waitlist sign-ups | **88** | 103 | 213 | 79 |
| Check-ins | **1,537** | 1,754 | 1,930 | 1,396 |
| Unique active players | **854** | n/a | 960 | 820 |
| Patch messages sent | **6,004** | 1,653 | 241 | 206 |
| Patch blasts | **5,874** | 1,351 | 0 | 0 |
| Patch automations | **127** | 300 | 241 | 206 |
| Patch open rate | **39.7%** | 18.5% | 24.9% | 18.5% |
| Patch click rate | **3.4%** | 1.2% | 2.5% | 1.0% |
| Patch unsubscribe rate | **0.4%** | 0.4% | 1.2% | 1.0% |

**Patch automations that sent anything:**

- **Week 0:** only the birthday email ("Celebrate your birthday with 50% OFF Peak gear!", 127).
- **Week before:** the birthday email, 206.
- **Same week last year:** the birthday email (167), "Thank you for visiting today!" (50), "Your Free Intro to Pickleball Class is
  tomorrow!" (12), and the plan welcomes: Play (5), Senior Play (3), Unlimited (3) and Senior Unlimited (1).

**Patch blasts in Week 0:**

- "We Heard You! Thanksgiving Morning at Peak" went to 5,001 people.
- "What's Happening at Peak? Friendsgiving, Christmas Cup & More!" went to 873 people.
- 3 more emails went out with no class (one-off sends).

**Not in the scorecard yet:**

- **Website (Google Analytics):** not available yet (waiting on access from Peak).
- **Meta ads:** not available yet (waiting on access from Peak).
- **Membership Report and leagues:** the API answers 401. League play is counted inside event registrations.
- **Monthly churn:** stays monthly in impact.json (11.4% baseline). It can only be read two months after the month. Weekly lapses
  stand in for it here.

## How to read Week 0

- **Week 0 is below normal almost everywhere.** It is also below the same week last year. That is the starting line, not a verdict:
  nothing has been built or changed yet.
- **New members:** 13 against 27 a year ago.
- **New accounts:** 50 against 99 a year ago.
- **Open Play fill:** 23.6% against 53.7% a year ago.
  - There are fewer sessions (39 against 65).
  - The 7 am "All Levels" sessions had nobody booked at all.
- **Patch automations:** only the birthday email sent. A year ago the same week also had the visit thank-you, the free-class
  reminder and the plan welcomes (see `patch-automations-2026-11-23.md`).
- **The Week 0 open and click rates are high because of the blasts.** Two newsletters went to engaged lists. Compare automations with
  automations only.

## Day one: the state of Peak's own tools (23 Nov 2026)

Matthew, 23 Nov: everything as it stood before he came on board is the "before", including what Peak had switched off. Telling Peak to turn
the Patch automations back on is part of his work, so their return counts toward his results. The raw data as of today is frozen, read-only,
in `data/baseline-day-one-2026-11-23/` (store + snapshot, MD5SUMS; gitignored; carried by the nightly workspace backup).

**Patch automations on day one: all 17 Enabled OFF, status Draft** (Matthew's screenshots of Patch > Automations, 23 Nov):

| Automation | Last ran | Last edited | Sent (lifetime) | Patch revenue |
|---|---|---|---|---|
| Google Review | 2 Nov 2026 | 23 Nov 2026 6:17 am | 4,326 | $36,324 |
| Birthday Email | 19 Nov 2026 | 20 Nov 2026 | 18,038 | $32,495 |
| Membership Create (welcome) | 2 Nov 2026 | 2 Nov 2026 | 2,357 | $16,942 |
| PPU Pipeline | 1 Nov 2026 | 9 Nov 2026 | 1,342 | $10,605 |
| PEAK QR Code Automation | 16 Sep 2026 | 2 Nov 2026 | 1 | $0 |
| Non-Member Pushing Convert | 26 Jun 2025 | 16 Nov 2026 | 47,341 | $24,465 |
| Target New Non-Members | 25 Jul 2025 | 19 Aug 2026 | 6,506 | $107,270 |
| Non-Member Reengagement | 25 Jul 2025 | 3 Aug 2026 | 16,710 | $15,188 |
| Non-Member At-Risk/Lost Winback | 25 Jul 2025 | 15 Jun 2026 | 6,837 | $7,347 |
| New Paid Membership Welcome | 24 Jul 2025 | 9 Jun 2026 | 274 | $4,974 |
| Expired Membership Winback | 25 Jul 2025 | 6 Oct 2025 | 2,653 | $5,303 |
| test, 101 People (copy), Intro Automation, Instructor Reminders, Member Recapture | never | 2025-2026 | 0 | $0 |

**Texting on day one:** none since 25 Jul 2025 apart from one text on 21 Sep 2026; 2,882 accounts opted in to marketing texts.
**Missed dues on day one:** 21 paid accounts suspended; 27 November dues charges unpaid ($1,690); no Patch reminder exists.
**Week 0 automation sends:** 127, all the birthday email (blasts 5,874, mostly the 22 Nov Thanksgiving blast).

**What each automation should move once it's back on** (the Week 0 / day-one value to beat is in the Week 0 table above unless noted):

| Automation coming back | Measure it moves | Day-one value |
|---|---|---|
| Free-class follow-up (stopped 29 Sep) | Joined within 7 days of a free class; within 60 days | 26.7% (Week 0); 60-day normal 43.7% |
| Membership Create / New Paid Membership Welcome | New members still paying after 3 months; upgrades from Starter | being added (see below) |
| Target New Non-Members, PPU Pipeline, Non-Member Pushing Convert | Non-members and drop-in regulars becoming members | 426 non-members with 3+ check-ins in 60 days (23 Nov); conversion rate being added |
| Winbacks (Expired, At-Risk/Lost, Reengagement) | Lapsed members coming back within 90 days | being added |
| Google Review | Google review count and star rating | to capture (Google Business Profile) |
| Birthday Email | Spend in the birthday month; gear sales | being added |
| A missed-payment reminder (new) | Suspended accounts recovered before cancelling; unpaid dues | 21 suspended / $1,690 unpaid (Nov) |

**Changes log** (every change made on Matthew's advice, with its date, so the before/after reads against it):

| Date | Change | Who made it |
|---|---|---|
| 23 Nov 2026 | Day one. Nothing changed yet. | — |

## Fact-check log

**Verified (23 Nov 2026, `tools/impact.mjs --week-end=2026-11-22` on the store of the 23 Nov pull)**

- These Week 0 figures match the nightly `impact.json` of 23 Nov:
  - new members 13, 10 the week before and 27 the same week last year (`newMembers.byWeek`)
  - the baseline per-week normals: new members 14.7, kept registrations 1,283.3, check-ins 1,753.8
  - utilisation 41.0% / 26.8% / 15.3%
  - email 18.5% / 1.2% / 0.4%
  - 7-day free-class join rate 37.3%
  - member list 807 active and 21 suspended
- **Open Play fill** was cross-checked two ways. The event list's registered counts and the kept registrations joined to the same
  sessions agree exactly: 173 places booked of 732 in Week 0, and 875 of 1,630 a year ago.
- **Patch sends** add up: 5,001 + 873 blasts + 127 birthday + 3 one-off = 6,004.

**Corrected**

- **The 5,001-person Thanksgiving blast is in Week 0, not Week 1.** Patch logs it at 00:01 on 23 Nov UTC, which is 5:01 pm on Sunday
  22 Nov in Colorado. The impact document calls it "the blast of 23 Nov", by its UTC date. The scorecard counts by Colorado day.

**Unresolved**

- **Paying members (dues) uses a 35-day cover, so it reads higher than the calendar-month count.**
  - A 31-day cover reproduces impact.json's October count of 665 exactly.
  - The 35-day cover keeps members who are a few days late on a card retry, so it gives 744 on 31 Oct. It moves less from week to
    week.
  - Compare it only with itself.
- **Lapsed members and the 7-day join rate change after the fact.**
  - Lapsed members settle 30 days after the Sunday: a late payment takes someone off the list.
  - The 7-day join rate settles 7 days after the Sunday.
  - The report shows them as they stand when it runs.
- **The member list exists only from 23 Nov 2026,** so the 807 and 21 have no last-week or last-year value. From Week 1 on, the
  report compares them with the previous Sunday's report.
- **New accounts come from today's member list,** so accounts deleted since are not counted. Older weeks may read a little low.
- **Dues collected counts cash in the week,** so prepaid annuals count in full the week they are paid. There were none in Week 0,
  the week before, or the same week last year. Dues are also lumpy by billing day, so read the trend over several weeks.
- **Family members:** whether family members on a paying parent's plan count as members is still Tyler's call. They are in the 807
  and out of the dues count.
