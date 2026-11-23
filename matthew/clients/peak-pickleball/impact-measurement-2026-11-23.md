# Peak Pickleball: impact measurement, proof of concept (23 Nov 2026)

> **DRAFT for Matthew and Tyler.** Nothing has been sent, and nothing has been changed in CourtReserve or Patch.

This sets up how the work Tyler OK'd on 11 Nov ("six places to grow") will be measured. The numbers come from the read-only nightly pull. The script `tools/impact.mjs` recomputes everything here from `data/pulls/` every night and writes `data/pulls/<date>/impact.json`.

**The honest headline: it is far too early to show impact.**

1. **Nothing has been built or changed yet.** No new automation, ad or site change has gone live since Tyler's go. The "after" period below is the club running as it was.
2. **The period is short.** It covers 12 days (11 to 22 Nov 2026).
3. **Things went the wrong way in that time.** During those 12 days Peak's own Patch automations were mostly not sending: welcomes and the visit thank-you stopped on 1 Nov, the birthday email after 19 Nov, and the free-class follow-up on 29 Sep (see the automation audit). So the after period is, if anything, a slightly worse baseline.

What this document does now is fix the definitions and the starting numbers, so that when changes do go live, the before-and-after is honest.

## 1. Baselines

| Name | Period | Why |
|---|---|---|
| **B0: the 4 Nov baseline** | 1 Nov 2025 to 31 Oct 2026 | The figures in the Year Review packet Tyler said GO on (`data/peak-baseline-2026-11-04.md`, with its 4 Nov corrections) |
| **B: 12 months before GO** | **11 Nov 2025 to 10 Nov 2026** | The main baseline for every metric below |
| **After** | 11 Nov 2026 to yesterday | Grows every night |
| **Same weeks last year** | The after dates minus 364 days (12 to 23 Nov 2025) | Pickleball is seasonal: November to January ran hot last year. This stops a seasonal dip being read as a failure, or a seasonal lift as a win |

**Readout rules:**

- A change gets credit only when the after number beats **both** B (per week) and the same weeks last year.
- No conversion metric is read until its follow-up window has passed. For example, a 60-day join rate needs 60 days.

## 2. Metrics: definition, how it's computed, and the numbers now

All counts are anonymous CourtReserve member ids or Patch contact ids. Two rules apply to every money and membership metric:

- **CourtReserve labels every payment with the member's current plan**, so plan history is never read from the plan name (the 4 Nov correction).
- **Sponsorship rows** (any row whose item, revenue category or plan says "sponsor") are excluded everywhere.

### 2.1 Active members

- **Paying in a month:** a member pays dues in a month when a Membership Fee row (TransactionType "Fee", amount over $0) has a paid date that month.
- **Prepaid annuals:** these are "Misc. Fee" rows ("Prepurchased … Annual"). The member counts as active for 12 months from payment.
- **Also reported:** today's count from the member list (status Active, on a plan that charges).

| | Value |
|---|---|
| Paying dues, Nov 2025 (B start) | **774** |
| Paying dues, Oct 2026 (B end), annuals included | **665** (matches the ~665 recount of 19 Nov) |
| Active on a paid plan, member list, 23 Nov 2026 | **807** (Starter 190, Unlimited 181, Play 178, Senior Play 98, Play Family 46, Unlimited Annual 27, Unlimited Family 26, Senior Unlimited 22, Platinum Annual 16 and others) |
| Suspended on a paid plan, 23 Nov | 21 |

The 807 is higher than 665 because the member list also counts family members and people whose dues are not yet due this month. **Track both, and don't compare one against the other.** November 2026 is a part month and isn't read until it closes.

### 2.2 New members per week

**Definition:** a member's **first-ever** dues payment, or a prepaid annual, counted in the Monday-start week it was paid. The store starts in Sep 2024, so "first-ever" is trusted from Nov 2024 on.

| B (per week) | After so far | Same weeks last year |
|---|---|---|
| **14.7** | 11.1 (19 in 12 days) | 23.9 |

**Too early.** And last November was unusually strong: 26 and 27 new members in the weeks of 10 and 17 Nov 2025.

### 2.3 Free class to member

**Definition:**
- **Attendee:** a kept (not cancelled) registration in the "Learn to Play Pickleball" category, dated to the person's **first** free class.
- **Joined:** their first-ever dues payment falls 0 to 60 days after that class.
- **Excluded:** people already paying dues before the class (17 in B). They are counted separately.

| | People | Eligible | Joined ≤7 days | Joined ≤60 days |
|---|---|---|---|---|
| **B** | 1,104 | 1,087 | 405 (37.3%) | **475 (43.7%)** |
| After so far (not final) | 30 | 29 | 7 | 7 (24.1% so far: needs 60 days) |

Monthly cohorts on a 30-day window, so recent months can be compared:

| Month | Eligible | Joined ≤30 days | Rate |
|---|---|---|---|
| Nov 2025 | 120 | 73 | 60.8% |
| Dec 2025 | 75 | 46 | 61.3% |
| Jan 2026 | 170 | 101 | 59.4% |
| Feb | 80 | 29 | 36.3% |
| Mar | 125 | 46 | 36.8% |
| Apr | 60 | 34 | 56.7% |
| May | 95 | 39 | 41.1% |
| Jun | 87 | 14 | 16.1% |
| Jul | 104 | 37 | 35.6% |
| Aug | 91 | 21 | 23.1% |
| Sep | 65 | 24 | 36.9% |
| Oct | 49 | 16 | 32.7% (not final: no follow-up emails sent this month) |
| Nov (to 22nd) | 53 | 13 | 24.5% (not final) |

The entry-point comparison (free class against Open Play, court bookings and the rest) is in `meta-ad-plan-2026-11-23.md` §1. In short, the free class as a first visit converts at 31.9%, against 2 to 3% for everything else.

### 2.4 Churn

**Definition:**
- **Lost:** paid dues in month M−1, then paid nothing in month M **and** nothing in M+1.
- **Rate:** lost ÷ members paying in M−1.
- **Why two months:** a one-month gap is mostly billing timing, such as a payment on the 31st then the 1st, or a card retried. February 2026 shows it: 312 members "missed" February, but only 110 were really gone.
- **When a month can be read:** only once M+1 has closed, so the latest is September 2026.

| | Value |
|---|---|
| B average monthly churn (Dec 2025 to Sep 2026) | **11.4%** |
| Range | 9.0% (May 2026) to 15.4% (Apr 2026) |
| After | Not readable until January 2027, for November's churn |

### 2.5 Dues revenue

**Definition:** Membership Fee rows net of refunds, plus 1/12 of each prepaid annual for each of its 12 months. Sponsorships are excluded.

| Month | Net dues |
|---|---|
| Nov 2025 | $54,779 |
| Dec 2025 | $58,893 |
| Jan 2026 | $58,130 |
| Feb | $39,426 (billing timing) |
| Mar | $63,836 |
| Apr | $48,248 |
| May | $49,860 |
| Jun | $50,213 |
| Jul | $57,098 |
| Aug | $45,946 |
| Sep | $53,469 |
| Oct | $45,214 |
| **B0 12 months (Nov 2025 to Oct 2026)** | **$625,112** |

- The 4 Nov packet showed Oct 2026 at $39.3k. That figure left the prepaid annuals out; spreading them adds about $5.9k a month. The packet's Sales report line "Memberships $604,969" is a different cut (CourtReserve's report categories, not refunds or annuals).
- Nov 2026 is a part month.

### 2.6 Court utilisation

**Definition:** CourtReserve's Court Utilization report, pulled week by week (the API allows 7 days at a time). It gives, for every hour from 5 am to 9 pm and every day, the % of court time booked. A period's utilisation is the plain average over every (date, hour).

| | B | After | Same weeks last year |
|---|---|---|---|
| All hours | **41.0%** | 40.4% | 40.1% |
| Weekday 3 to 5 pm (the quiet slot the ads should fill) | 26.8% | 27.4% | |
| 5 to 8 am | 15.3% | 16.1% | |

Flat. That's expected, since nothing has changed. The 4 Nov packet's "42%" came from the report screen for 4 Nov 2025 to 4 Nov 2026, so the two match.

### 2.7 Event attendance

**Definition:** kept registrations for events that have already started, by event date. Cancellation rate = cancelled ÷ (cancelled + kept), for events in the period. Check-ins come from CourtReserve's check-in report.

| | B | After | Same weeks last year |
|---|---|---|---|
| Kept registrations a week | **1,283** | 1,176 | 1,320 |
| Check-ins a week | **1,754** | 1,476 | 1,786 |
| Cancellation rate | **17.2%** | 12.6% (too early: late cancels for recent events are still being counted) | |

### 2.8 Email engagement (Patch)

**Definition:** Patch message history. Open and click rates are per delivered email; unsubscribe rate is per delivered. Opens are inflated by Apple Mail privacy, so compare like with like only.

| | B | After |
|---|---|---|
| Emails sent | 86,185 (2 texts) | 1,154 (0 texts) |
| Open / click, all | 18.5% / 1.2% | 54.2% / 6.2% |
| Open / click, automations | 21.1% / 1.7% | 15.5% / 1.4% |
| Unsubscribe | 0.4% | 0.4% |

The after "all" rate is two small newsletters: 892 people on 3 Nov and 873 on 17 Nov, both at about 65% open. Those went to an engaged segment, so this is **not** an improvement to credit. The 5,001-person Thanksgiving blast of 23 Nov falls in the next readout.

### 2.9 to 2.13: the day-one measures (added 23 Nov 2026)

These are in `impact.json` (`dayOneMeasures`: baseline B, the 12 months before it, and monthly cohorts) and in the weekly scorecard.

- **Lagging rows read an earlier cohort.** In the weekly scorecard, a lagging row shows the cohort whose follow-up closed by that
  Sunday, and the note names its dates.
- **Normals count closed cohorts only.** A normal pools only the baseline cohorts whose follow-up had closed by the data day, so it
  fills out until about February 2027.

**2.9 New-member retention (lagging 35 / 65 / 95 days)**

- **New member:** a first-ever dues payment or prepaid annual, trusted from Nov 2024 (§2.2).
- **Still paying N days later:** covered by dues on day N+5 after the first payment. A monthly payment covers 35 days and an annual 365.
  The first payment alone runs out on day 35, so a renewal is needed; the +5 lets it be a few days late.
- **Weekly scorecard:** reads the new members of 5, 10 and 14 weeks earlier.
- **Starter to a higher plan:**
  - Starter = the first day of dues totalled exactly $35, the Starter price.
  - Upgraded = a later day within 90 days paid $39 or more (Play $39, Flex, Unlimited, Platinum). Senior Play ($29) doesn't count.
  - It's read from the amount paid, never the plan name. The weekly row reads Starters of 13 weeks earlier.

| | B (12-month normal) | 12 months before B |
|---|---|---|
| Still paying 30 / 60 / 90 days later | **78.0% / 74.0% / 62.3%** | 71.8% / 67.9% / 60.8% |
| Starter upgraded within 90 days | **3.5%** (15 of 431) | 3.8% (3 of 78) |

**2.10 Non-member regulars to members (count now; join rate lagging 30 / 60 days)**

- **Regular on day S:** 3+ check-in rows in the 60 days to S, with guest rows left out.
- **Not a member:** not covered by dues on S, and not on a staff, comp or family-of-a-member plan in today's member list.
- **Joined:** any dues payment in the 30 or 60 days after S.
- **The count is a Sunday stock.** The join rate is pooled over the Sundays, so someone who stays a regular counts on each Sunday.

| | Value |
|---|---|
| Regulars on Sun 22 Nov 2026 | **414** (the audit's 426 used today's member list; see the scorecard's fact-check log) |
| Average Sunday, B / a year before | 486 / 510 |
| Paid dues within 30 / 60 days, B | **3.9% / 6.4%** |
| The same, 12 months before B | 4.4% / 6.7% |

**2.11 Win-back (lagging 90 days)**

- **Lapse:** a dues cover ran out (day "out") with nothing paid before it and nothing in the 30 days after. It's the same rule as the
  weekly lapsed count.
- **Came back:** paid dues again within 90 days of "out".

| | Value |
|---|---|
| Back within 90 days, B | **8.0%** (67 of 842) |
| 12 months before B | 6.9% (84 of 1,226) |

**2.12 Birthday month (monthly)**

- **Members:** people paying dues in month M whose birth month (anonymous member list, month only) is M.
- **Spend:** every sales row on their account paid that month, net of refunds. Sponsorships are left out, and annuals are spread 1/12 a
  month.
- **Index:** spend in the birthday month ÷ their average over the months they paid dues in the 11 before. 100% means no difference.
- **Control:** the same index for members not born in M, read for that same month. It carries season and tenure.
- **Lift:** index ÷ control.
- **Gear:** POS items in the Apparel/Pro Shop, Paddles/Gear and Shoes groups. Peak's birthday email offers 50% off gear. Gear is counted
  before refunds, because POS refunds carry no item.

| B, 12 months pooled | Birthday month | Control | Lift |
|---|---|---|---|
| All spend | 99.6% | 96.9% | **102.8%** |
| Gear | 117% | 57.4% | **about 2x (203.8%)** |
| Bought gear that month | 5.1% | 3.1% | |

The birthday email ran through B, so this is the "with the email" level. In the 12 months before, the lift was 96.7% for all spend and
89.7% for gear, from thinner history. Single months are noisy.

**2.13 Missed payments (monthly; weekly rows lag 2 weeks)**

This uses the transactions store, which holds every Membership Fee charge, paid or not.

- **Due:** the charge's period start. CourtReserve raises the charge up to about 5 days before.
- **Late:** paid more than 24 hours after due. Days late = whole days.
- **Still unpaid:** an open balance more than 24 hours past due.
- **Suspension point:** still unpaid 10 days after due. Paid plans suspend at 10 days past due and auto-cancel at 11 (plan settings).
- **Recovered before cancel:** paid by day 11.

| | B per month | 12 months before |
|---|---|---|
| Charges paid late | **57.8** (7.4% of charges), median 1 day late | 24.4 (2.8%) |
| Unpaid at 10 days | **3.3** (40 in B: 9 paid by day 11, 21 paid later, 10 never) | 2.3 |
| Day one (23 Nov) | 21 suspended on the member list; 16 open charges ($795) past due; November's 27 open ($1,690) are mostly not due yet (2, $194, past due) | |

CourtReserve doesn't keep every failed charge, so the dues data undercounts suspensions. The member list's Suspended count is the true
figure from 23 Nov on.

### 2.14 Social and ads (added 23 Nov 2026)

Source: `tools/meta-pull.mjs` (Meta Graph API v21.0, GET only, counts only; Peak's Page, its Instagram account and its two ad accounts). Stored in `data/pulls/store/meta/`; computed by the SOCIAL AND ADS block of `tools/impact.mjs` (nightly `impact.json` `social`, and rows in the weekly scorecard).

- **Followers (Page, Instagram):** at the end of the Sunday; change = this Sunday less last Sunday. Day one (23 Nov): Page 1,833, Instagram 962.
- **Posts:** posts and Instagram feed items published that week (30 days kept from the first pull).
- **Reach:** Page `page_total_media_view_unique` and Instagram `reach`, each added up day by day. **Engagement:** Page `page_post_engagements`; Instagram `accounts_engaged`.
- **Ads:** spend, link clicks and leads by day over both ad accounts. Leads = Meta `lead` plus `onsite_conversion.lead_grouped` actions. Cost per link click = spend / link clicks; cost per lead = spend / leads (blank when the divisor is 0).
- Meta days are Pacific. A value reads n/a where the store does not reach back. No 12-month normal.

## 3. What each of the six places to grow will be judged on

| Change (from the packet) | Primary metric | Secondary | Earliest fair read |
|---|---|---|---|
| Free-class follow-up series (Patch A) | Free class → member within 60 days (§2.3), against 43.7% | 7-day join rate; Starter count | 60 days after go-live, plus enough cohorts (~2 months of classes) |
| Welcome series + Starter upgrade (Patch B, L) | New members still paying at 30/60/90 days (§2.9, 78/74/62%); Starter upgrades within 90 days (3.5%) | Dues per member | 3 months |
| Open Play schedule rebalance | Fill of 7 am / 3 pm sessions; Mon/Fri waitlist size | Court utilisation in those hours (§2.6) | 4 to 6 weeks |
| Late-cancel reminders (Patch G) | Share of Open Play cancels in the last 24 h (B0: 60%) | Overall cancellation rate (§2.7) | 4 weeks |
| Ads for quiet times / new members (Meta plan) | First-time free-class bookings a week; new members a week (§2.2) | "How did you hear about us" = Facebook/Instagram | 4-week test, then 60 days for joins |
| Win-back, drop-in → member, failed payment (Patch C, J, D) | Back within 90 days of a lapse (§2.11, 8.0%); regulars paying dues within 60 days (§2.10, 6.4%); charges paid by day 11 and unpaid at 10 days (§2.13) | Churn (§2.4) | 2 to 3 months |
| Birthday email (back on) | Birthday-month lift, all spend and gear (§2.12) | Gear buyers in the birthday month | 3 months of birthdays |

## 4. How to rerun it

- **Nightly:** `tools/nightly-pull.sh` runs CourtReserve, then Patch, then Meta (`meta-pull.mjs`; its failure is logged as `meta=fail` and never fails the run), then `impact.mjs`. It writes `data/pulls/<date>/impact.json` and logs one line to `data/pulls/pull.log`.
- **By hand:** `node tools/impact.mjs` (a readable summary), `--json` (everything) or `--day=YYYY-MM-DD` (as of a past snapshot).
- **Weekly scorecard:** `node tools/impact.mjs --week-end=YYYY-MM-DD` (a Sunday; add `--json` for everything). It shows the week, the week before, the same week last year and the 12-month normal, and writes nothing. Matthew's Sunday business report runs it. Week 0 and day one are in `peak-scorecard-start-2026-11-23.md`.
- The definitions above are the same ones used in the code. **Change them in both places together.**

## Fact-check log

**Verified**
- Every number in §2 was computed on 23 Nov 2026 by `tools/impact.mjs` from the CourtReserve store (sales, event registrations, check-ins, court utilisation, Sep 2024 to Jan 2027) and the Patch store (Feb 2025 to 23 Nov 2026).
- **Matches with earlier work:**
  - 774 members in Nov 2025, and ~665 in Oct 2026 once annuals are counted (4 Nov correction and 19 Nov recount)
  - court use 41% here against 42% on the 4 Nov report screen
  - free class 43.7% here against the 45% used since 4 Nov (a slightly different window and rule)

- **§2.9 to 2.13 (23 Nov 2026)** were computed by `tools/impact.mjs` on the store of the 23 Nov pull, which is byte-identical to the
  frozen `data/baseline-day-one-2026-11-23/store`. The counts behind each figure are in the scorecard's fact-check log. Adding them
  changed none of the existing impact.json fields.

**Corrected**
- **Unpaid dues on day one:** the "27 November charges unpaid ($1,690)" included 24 charges ($1,461) raised ahead of their due day.
  2 ($194) were past due.
- **Churn:** a one-month rule gave 15% a month. The two-month rule gives 11.4%, because one-month gaps are mostly billing timing.
- **Oct 2026 dues:** $45.2k with annuals spread, not the packet's $39.3k without them.

**Unresolved**
- **Too early to read:** every after number (12 days, no changes made yet).
- **Not available from the API:**
  - The Membership Report (401: not granted) and leagues (401). Leagues are read from event registrations instead.
  - Cancellation reasons (CourtReserve's cancel report, UI only).
- **Patch's own "converted" figure** is not used.
- **Day-one measures:**
  - Suspensions read low in the dues data: CourtReserve doesn't keep every failed charge.
  - Starter upgrades billed only as a small proration are missed.
  - The weekly lagging cohorts are small.
  - Normals fill out as cohorts close (until about Feb 2027).
  - The regulars' plan exclusions use today's member list.
- **Family members and the 807 count:** whether family members on a paying parent's plan should count as members is Tyler's call. Today they're in the 807 and out of the dues counts.

**Verified: social and ads (23 Nov 2026):** definitions above match `socialIn()` in `tools/impact.mjs`; day-one 1,833 / 962 read from the API; ad rows sum to the accounts' lifetime spend. Details in `peak-scorecard-start-2026-11-23.md`.
