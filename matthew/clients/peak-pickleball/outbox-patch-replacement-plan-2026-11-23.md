# Replacing Patch Retention with Outbox at Peak Pickleball: build plan

<style>header p{display:none}</style>

**PLAN ONLY, DRAFT for Matthew.** Nothing in it has been built, no server or DNS record has been changed, and nothing has been sent. Patch stays on. Written 24 Nov 2026, from Matthew's ask of 23 Nov.

**What this is.** Outbox is Matthew's own email tool. He already runs it for Sixfold, Traverse and Peak. Peak would pay for the service and the use of it, the same way it pays for Patch today. It would not be buying the product. This plan covers what it takes for Outbox to do the job Patch does for Peak, how long that takes, what it costs to run, and what we need from Peak.

**The short version**

- Patch costs Peak **$499 a month** (from our 11 Nov notes; still to confirm with Tyler). At Peak's volume, sending the same email through Amazon SES costs **about $1 to $6 a month**. Even Peak's busiest month on record would cost about $18.
- Texts are left out. Patch hasn't sent an automated text since July 2025.
- **The build runs in five phases.** The domain gets set up in early December. The four automations Cammie is redesigning are built and run **in shadow** (computed but not sent) through the website launch. In January they move over from Patch **one at a time**. The newsletter and the other automations follow in late January and February. Patch is cancelled once all of that has run cleanly, on whatever notice its contract needs.
- **Cammie approves every email before it goes live.** Nothing sends without her OK.

---

## 1. What Patch does for Peak today, and what Outbox already has

### Patch today (from the 23 Nov audit, `patch-automations-2026-11-23.md`)

- **Automations.** Patch has 17 in its list, and all 17 are off or draft as of 23 Nov. Cammie switched them off on purpose so she can redesign them.
  - **Ran up to Nov 2026:** birthday, the per-plan welcomes, the visit thank-you and Google review ask, the free-class reminder and follow-up (PPU Pipeline), and the new free-account welcome.
  - **Ran in 2025, stopped in July 2025:** the monthly nudge to free accounts, two "we miss you" series, new-account onboarding, the new-member welcome and the lapsed-member win-back.
- **Blasts (campaigns).** Newsletters and announcements. For example, the Thanksgiving email reached 5,001 people on 23 Nov.
- **How Patch triggers.** It reads CourtReserve events: check-ins, account creation, plan starts, dues payments, free-class bookings, class end times and birth month. 99% of Patch sends match a CourtReserve member.
- **Volume.** About 400,416 messages since 25 Feb 2025, of which 326,237 were email and 74,179 text. Over the last 12 months (Dec 2025 to Nov 2026) Patch sent **91,441 emails**: about 7,600 a month on average, with the busiest month at 33,198 (Sep 2026). Automations alone run about 1,100 to 1,400 a month. Blasts make up the rest.
- **Health of the list over those 12 months** (Patch's own message stats): 229 bounced (0.25%), 555 dropped, 18 spam complaints (0.02%) and 317 unsubscribes. That is a clean list to start from.
- **Consent (CourtReserve, 23 Nov).** 13,752 accounts are opted in to marketing email and 2,512 have unsubscribed from it. 2,882 of 16,264 accounts are opted in to marketing texts.
- **How Patch sends.** Peak's SPF record includes `patchsend.com`, and patchsend.com's own SPF includes `amazonses.com`. So Patch already sends Peak's email through Amazon SES, the same service this plan uses (DNS checked 24 Nov 2026).

### Outbox today (`assistant/outbox/`)

| Already built | What it gives the Peak replacement |
|---|---|
| A Patch-style list of automatic email streams, with a side drawer for each (How it works, Messages, Flow, Stats), filters and sortable columns | The screen Cammie and Matthew would run the automations from. Matthew chose this layout because he finds Patch's easier to read. |
| The Peak outreach sender: hourly batches, a sending window, a rate cap and a slow ramp on the first day | The batching and pacing logic. |
| Open tracking (`o.php`), click tracking (`r.php`) and an unsubscribe page that unsubscribes only on a button press (`u.php`), all served on Peak's own `links.peakpickleball.us` since 20 Nov | Branded links and the basis for one-click unsubscribe. |
| Safety stops: a list pauses itself if bounces pass 8% after 20 sends; Start is refused while an email is a DRAFT or the postal address is missing; unsubscribed, bounced and STOP addresses are never emailed | The same guard rails, carried over to the automations. |
| Bounce, reply and STOP reading from the Peak Partnerships inbox | The pattern for handling replies. |
| **Change the words** (built for Sixfold's four customer emails): edit each line, preview with a made-up customer, Save, keep versions with their numbers, Put this back | The way Cammie edits words without touching the layout. |
| A test suite that runs on throwaway copies and sends nothing | The way each automation gets tested before it runs. |

**What Outbox can't do today.** It sends Peak mail through Microsoft 365 (Graph), and Microsoft 365 is not built for bulk mail: our 4 Nov notes put Exchange Online at 10,000 recipients a day. It has no CourtReserve triggers, no HTML email templates, no `List-Unsubscribe` headers, and only one sign-in, Matthew's. Section 2 covers each of these.

---

## 2. The gap list

### 2a. CourtReserve triggers

**What CourtReserve allows** (checked 24 Nov 2026):

- **Rate limit: 60 calls per minute per API key.** Going over returns HTTP 429 with a Retry-After header (CourtReserve help centre and API help page).
- The API comes with the Advance, Momentum and Enterprise plans. Peak has been on Momentum since 15 Oct.
- **Webhooks exist, but only in CourtReserve's "Integrations API".** That API's own documentation lists webhook subscriptions with signed deliveries and retries. The payload types cover members, payments (including a failure message), event registrations, reservations and events. **There is no check-in webhook in the list.**
  - We have **not confirmed** that Peak's API key can use the Integrations API.
  - Creating a subscription is a write (POST), so it needs Tyler's OK and a key with that permission.
  - **So the plan polls first, and adds webhooks later only if the key allows them.**
- `member/get` can filter by "created or updated since" a date and time, so each poll only has to fetch the accounts that changed. The check-in report filters by date only: each poll re-reads today's check-ins and keeps the new ones.

**How we poll.** Every **10 minutes**, from the server Outbox runs on. Each poll reads:

- today's check-ins
- members created or updated since the last poll, with marketing consent
- today's payments and transactions (dues, which show plan starts and failed payments)
- event registrations for today and the next two days (the free class)

That's roughly 6 to 12 calls per poll, well under 60 a minute. The nightly 2:30 am pull carries on as it is and stays the full record.

**How close to "right after a check-in".** In principle, within about 10 to 20 minutes of the front desk checking someone in. That assumes the check-in report shows same-day check-ins as they happen, which we haven't tested yet: **test it in Phase 1.**

Speed isn't what matters here. Patch sent the review ask at 8 to 9 am **the next morning**. Each automation keeps a send window (for example, no email between 8 pm and 8 am Colorado time), so a check-in only has to be seen before the next window opens.

| Trigger | CourtReserve source | Used by |
|---|---|---|
| Plan starts (first paid dues, or the membership type changes to a paid plan) | member updates, transactions | New-member welcome |
| Account created | member `createdDateTime` | New free-account welcome |
| Booked on the free class | event registrations in the "Learn to Play Pickleball" category | Free-class reminder |
| Free class ended (and attended) | event end time, check-ins and attendance | Free-class follow-up |
| Check-in (with a count, for "5th check-in") | check-in report | Google review request |
| Birth month, last visit, last dues payment, payment failed or past due | members, check-ins, transactions | Phase 3 automations |

### 2b. Audience rules

Each automation gets written rules, shown in its drawer the way Outbox already shows WHEN / THEN / SEND:

- **Who's in:** for example, "new paid plan, not staff, not a sponsor".
- **Who's out:** every email checks the suppression list, CourtReserve's unsubscribe flag, staff and test accounts, guests without an email, and anyone already in a newer step.
- **Exit:** for example, the free-class series stops the moment someone starts a paid plan.
- **Once per person:** the review ask goes once per person, ever. Win-backs go at most once every 90 days.
- **Send window and daily cap** for each automation.
- **Before a rule goes live,** its drawer shows "this rule would match N people this week", so Cammie can check it against what she expects.

### 2c. Template: one light layout, plus a promotional variant

- **Light, for reminders and welcomes.** Peak logo at the top, short paragraphs, **one** button, plain footer. Mostly text, so it reads like a note from the club and is more likely to land in the main inbox.
  - Colours from Cammie's brand kit (Peak Cyan #23C5E2, Navy #1F3D67). Button text is navy or black on cyan, because white on cyan fails the contrast check.
  - Logos are Cammie's supplied files only, never redrawn or recoloured.
- **Promotional, for the newsletter, birthday and win-backs.** The same frame, plus a header image, photo blocks, two or three sections and more than one button.
- **What Cammie edits:** the words, images, buttons and links, through Change the words, with a preview, a test send and saved versions. The layout itself is fixed, so it can't break on a phone or in Outlook.
- **Every email goes as HTML with a plain-text copy,** and is checked in Gmail, Outlook, Apple Mail and Yahoo before it goes live.

### 2d. Unsubscribe and consent, kept in step with CourtReserve

- **Two-way rule: one "no" anywhere wins everywhere.**
  - Outbox keeps its own suppression list: unsubscribes, hard bounces and spam complaints.
  - Every poll reads CourtReserve's `UnsubscribeFromMarketingEmails` and marketing consent. Anyone who has opted out there is suppressed in Outbox.
- **Writing an Outbox unsubscribe back to CourtReserve is not confirmed.** CourtReserve's `member/update` documentation doesn't list a consent field. Until a test (with Tyler's OK) shows it works, Outbox sends Peak a weekly list to mark in CourtReserve. Outbox never emails these people in the meantime.
- **Which emails need marketing consent:**
  - Promotional emails (newsletter, birthday offers, win-backs) go only to people opted in to marketing email.
  - Service emails (the free-class reminder, the welcome after someone joins) are a decision for Tyler and Cammie. **The plan's default is to honour every unsubscribe for every email.**
- **One-click unsubscribe:** every email carries the `List-Unsubscribe` and `List-Unsubscribe-Post` headers (RFC 8058) and a visible link. Unsubscribes take effect immediately, well inside Yahoo's two-day rule. `u.php` already unsubscribes on a POST, which is what one-click needs.
- **Every email carries Peak's postal address,** as the outreach sender already requires.

### 2e. The sending domain on peakpickleball.us

**Today's records** (checked 24 Nov 2026):

- SPF: `include:spf.protection.outlook.com include:patchsend.com -all`
- DMARC: `p=none`, reports to postmaster@
- DKIM for Microsoft 365: live since 21 Nov
- MX: Microsoft 365
- DNS host: GoDaddy (domaincontrol.com)

**Plan:**

1. **A sending subdomain,** for example `mail.peakpickleball.us`. Bulk mail then has its own name and doesn't drag on the reputation of staff mail from Microsoft 365. The From address would read something like "Peak Pickleball <team@mail.peakpickleball.us>". **Cammie and Tyler pick the address,** and where replies go (see the open questions).
2. **SES Easy DKIM:** three CNAME records. Mail is signed as the domain, so DMARC passes on DKIM alignment.
3. **Custom MAIL FROM** (for example `bounce.mail.peakpickleball.us`): one MX and one SPF TXT on that name, so SPF aligns too. The root SPF record doesn't change, and stays under SPF's 10-lookup limit.
4. **DMARC:** stays `p=none` at first, and we read the reports. Moving to `quarantine` later is optional, and only once Microsoft 365, Patch (while it lasts) and SES all pass.
5. **Google Postmaster Tools** on the domain, to watch the spam rate. **Yahoo's sender hub** too, if we can register there.
6. **Gmail and Yahoo bulk-sender rules.** Google's rules apply to senders of more than 5,000 a day to Gmail. Peak's blasts can reach that, so we meet the bulk rules from day one:
   - SPF, DKIM and DMARC, aligned
   - one-click unsubscribe on marketing mail
   - TLS
   - a spam rate kept below 0.3% (Google's target is under 0.1%)
7. **Warm-up.** The automations go first, because they are small (about 40 a day across all of them) and well opened. That builds the new subdomain's reputation for three to four weeks before the first blast. Then the first blasts go to the most engaged people first (opened or clicked in the last 90 days), in growing batches over several days, before the full list.
8. **SES production access.** A new SES account starts in the sandbox, where it can only send to verified addresses. The request to leave it is part of Phase 0.
9. **After Patch is cancelled,** take `include:patchsend.com` out of the root SPF record.

**Who controls DNS: Wes's question.** Our notes say Matthew is an admin on the GoDaddy account and added the Microsoft DKIM records there on 20 Nov. Before adding anything for SES, **confirm with Wes (and Tyler) whose account it is, and that nothing on the website depends on records we'd touch.** Every change is an addition. Nothing existing is edited.

### 2f. Reporting, with revenue measured from CourtReserve

**Patch's "revenue" counts any spend by anyone who got a message.** That ranks emails, but it doesn't show what an email caused.

Outbox reports, for each automation and each email:

- sent, delivered, clicked, unsubscribed, bounced and complained (opens are shown but marked rough, because of Apple Mail)
- **what people did next, read from CourtReserve:**
  - booked a court or event within 7 days
  - came in (checked in) within 14 days
  - started or upgraded a paid plan within 30 days
  - for the free class: attended, then joined
- **an optional hold-out**, so we can say what an email *caused*. A small random share (for example 1 in 10) doesn't get that email, and the two groups are compared. This is for Tyler and Cammie to decide. It suits the promotional emails better than the welcomes.

The Patch comparison readout (shadow vs Patch) is built in Phase 1. The two-weekly readout Cammie asked for (sent, clicks, opt-outs, how many went on to book or join) comes straight from this screen, and also feeds Matthew's Sunday report.

### 2g. Approval: Cammie approves before anything goes live

- **Each automation moves through these states:** Draft → Shadow (works out who it would send to, sends nothing) → **Awaiting Cammie** → Live. Paused stops it at any point.
- **Live needs Cammie's approval in Outbox,** recorded with her name and the time. Editing the words or the rules of a live email sends that change back to "Awaiting Cammie", and the last approved version keeps sending until she approves the new one.
- **Test send:** any email can be sent to Cammie's own inbox with a made-up member's details.
- **Cammie's own sign-in.** Outbox has one sign-in today (Matthew's). The plan adds a second login for Cammie that sees **only Peak's section.** It can edit words, approve and pause, but can't touch Sixfold or Traverse.
- **While she's away:** who approves, or whether everything waits for her, is one of the open questions.

### 2h. Failure alerts

- **CourtReserve:** a poll that fails (401, 429, 5xx) three times in a row, or no successful poll in 60 minutes.
- **Sending:** SES bounce and complaint notices come back through Amazon SNS to an Outbox address.
  - An automation pauses itself if its bounces pass 5% or its complaints pass 0.1% on a rolling 7 days.
  - Sending pauses everywhere if SES puts the account under review.
- **"Nothing happened" checks:** an alert if an automation that should fire every day hasn't fired in its usual time. For example, there were check-ins yesterday but no review asks. This is exactly the silent stop the 23 Nov audit found in Patch (1 Nov, 19 Nov).
- **Where alerts go:** Matthew's J.A.R.V.I.S. app (`jarvis-status.sh needs`), a line in the overnight check, and a red row in Outbox. Cammie gets a plain email if an automation she approved has paused.
- **A daily one-line summary** to Matthew: polls, sends, bounces, complaints and anything paused.

---

## 3. Phases, effort and timeline

Effort is rough build time (Matthew and Claude together), not calendar time. Calendar time is longer because of waiting: AWS's review, DNS access, Cammie's approvals and the holidays.

| Phase | What | Rough effort | When |
|---|---|---|---|
| **0. Sending setup and domain** | SES account on Matthew's own AWS account, and a request for production access. Sending subdomain, DKIM, MAIL FROM and SPF records (after Wes and Tyler OK them). SNS bounce and complaint notices. Postmaster Tools. One-click unsubscribe headers. Suppression list loaded: CourtReserve unsubscribes, plus Patch's own unsubscribes, bounces and complaints (section 6). Seed tests to Gmail, Yahoo, Outlook and iCloud. | 2 to 3 days | 1 to 11 Dec |
| **1. The four automations, in shadow** | CourtReserve poller. Audience rules. The light template. Cammie's login and approval flow. Reporting. The alerts. The four automations (new-member welcome, free-class reminder and follow-up, new free-account welcome, Google review request) built from Cammie's **approved Patch redesign** as the source of the words. Shadow from about 14 Dec: every day, Outbox lists who it *would* have emailed, next to who Patch actually emailed (Patch sends show in the nightly pull). | 8 to 10 days | 7 Dec to 18 Dec, then shadow runs through the holidays |
| *Website launch window* | **No DNS changes and no cutovers.** The website goes live on Tue 29 Dec, with 1 Jan as the deadline. Shadow keeps running, and it sends nothing. | none | 19 Dec to 4 Jan |
| **2. Parallel run, then cutover one automation at a time** | Cammie approves each one. On cutover day it goes **on in Outbox and off in Patch together**, so nobody gets both. Then a week of watching before the next. Suggested order, smallest first to warm the domain: (1) new-member welcome, (2) free-class reminder and follow-up, (3) new free-account welcome, (4) Google review request. Patch keeps sending everything else, including blasts. | 3 to 4 days, spread out | 5 Jan to about 30 Jan |
| **3. The other automations and the newsletter** | The promotional template. A newsletter and blast composer with an audience picker and a schedule (scheduling only after Cammie's approval of that send). Engaged-first warm-up for blasts. Then birthday, win-backs, the drop-in-regular-to-member email, failed payment and the rest, each as Cammie redesigns it. **Give Patch notice once at least two newsletters have gone cleanly from Outbox**, on whatever notice its contract needs. | 8 to 12 days | Late Jan into Feb; Patch notice around mid Feb |
| **4. Texts (optional, later)** | Only if Peak wants texts back. It needs a text provider and US carrier (10DLC) registration, which takes time. Texts go only to the 2,882 text opt-ins, with STOP handling. Priced at the time; not in this plan's costs. | 5 to 8 days, plus registration waiting | Not before March |

**What the timeline means for February.** Patch's $499 only stops once Patch is cancelled and its notice period has run out. If the newsletter moves over cleanly by mid February, Patch could end late Feb or in March, depending on the contract. **The saving may land a few weeks after the February pay change, not on the same day.** Confirm the notice period early (section 7) so the dates can be lined up.

---

## 4. Running costs per month

| Item | Cost | Source and date |
|---|---|---|
| Amazon SES sending (Essentials plan) | **$0.16 per 1,000 emails** up to 10 million a month, no plan fee | AWS SES pricing page, read 24 Nov 2026 |
| At Peak's last-12-month average (about 7,600 emails a month) | **about $1.22** | 7,600 × $0.16 / 1,000 |
| At Peak's busiest month in the last year (33,198, Sep 2026) | **about $5.31** | same rate |
| At Peak's busiest month on record (112,258, Apr 2025) | **about $17.96** | same rate |
| Attachments | $0.12 per GB; none planned | AWS SES pricing page, 24 Nov 2026 |
| Dedicated IP | $15 a month plus $0.08 per 1,000. An optional add-on that this plan doesn't use: at a few thousand emails a month, SES's shared sending addresses are enough | Price: AWS SES pricing page, 24 Nov 2026. "Not needed": a planning choice |
| Domain, DNS, Postmaster Tools | $0: Peak already owns the domain; Postmaster Tools is free | — |

**Realistic total: about $2 to $6 a month,** with $20 as a safe ceiling even if Peak goes back to 2025's blast volume. Matthew's working figure of $10 to $20 sits comfortably above what the volume needs.

New AWS accounts also get up to $200 of free-tier credit for six months (AWS pricing page). That's left out of the figures so they don't rely on it.

**Not counted:**

- **Matthew's time** to build, run and support it. That's what Peak's service fee pays for.
- **Hosting:** the server Outbox already runs on, which Matthew already pays for and shares with his other tools.
- **Texts** (Phase 4).

---

## 5. The savings case for Peak (a paragraph Matthew can adapt)

> Peak pays Patch Retention $499 a month for its member emails. Sending the same emails through my own email system, Outbox, costs Peak about $2 to $6 a month at today's volume (Amazon's published rate of $0.16 per 1,000 emails), and under $20 even in a very busy month. Outbox already runs the automatic emails for my other clients. For Peak it would take its triggers straight from CourtReserve, show Cammie every email before it goes live, and report what members actually did afterwards (booked, came in, joined) instead of Patch's "revenue" estimate. We'd build it alongside Patch over the next few months and move each email across only once it has run side by side, so nothing goes quiet during the switch. That frees up about $480 a month, which covers most of the move in my weekly fee from $150 to $300 that I'm proposing from February, so Peak's total spend barely changes while it gets more done.

*(Arithmetic for Matthew, not for the paragraph: $150 more a week is about $650 a month, so $480 covers about three quarters of it. The paragraph says "most" for that reason. If Matthew and Peak ever part ways, the fallback offer is Outbox as a service at about $300 a month, still below Patch.)*

---

## 6. Risks

| Risk | What could happen | How the plan handles it |
|---|---|---|
| **Deliverability on a new sending name** | A new subdomain has no reputation, and a big first blast could land in spam. | Warm up on the small, well-opened automations first (about 40 a day). Blasts go to engaged people first, in growing batches. Postmaster Tools watched daily. The automatic pause at 5% bounces or 0.1% complaints. Patch's list is already clean (0.25% bounces, 0.02% complaints over 12 months), which helps. |
| **Cammie loses Patch's designer** | Today she can build an email visually in Patch. In Outbox she couldn't drag blocks around. | The two fixed layouts are built *with* her from her own redesign of the first four, so the look she chose carries over. She changes words, images, buttons and links in a form with a live preview and a test send, and can't break the layout. For something unusual, she can design a header image in her own tools and drop it in. **Ask her on 24 Nov whether that is enough.** If it isn't, it's better to know before the build. |
| **Depending on one person (Matthew)** | If Matthew is away or ill, nobody can fix it. | Monitoring and alerts (section 2h) catch silent stops. Any automation can be paused by Cammie herself. A **written runbook** covers how to pause everything, read the alerts, re-run a poll, restore from backup, and who to call. Settings and templates go in the nightly off-site backup. Until Patch is cancelled, Patch is the fallback. After that, the runbook says how Peak can point the same domain at another sender within a day. |
| **CourtReserve API limits** | 60 calls a minute per key. A busy poll plus the nightly pull could hit it. A CourtReserve change could break a trigger. | Polls use about 6 to 12 calls. The nightly pull and the polls share one pacing helper (today's code waits 1.1 seconds between calls and honours Retry-After). A poll is skipped while the nightly pull is running. Alerts fire after three failed polls in a row. Webhooks get added later only if Peak's key allows them. |
| **The move from Patch** | History stays in Patch. Unsubscribes **must not be lost**, or people who opted out get emailed again. | **History isn't migrated.** The nightly pull already keeps Patch's message history read-only for reporting. **Unsubscribes, bounces and complaints are imported before the first send:** (1) Patch's own export, asked for from Peak; (2) as a backstop, every Patch message our pull marked unsubscribed, bounced, dropped or complained (since Feb 2025), matched to the CourtReserve member through `PatchContactId`; (3) CourtReserve's own unsubscribe flag. If any of the three says no, the answer is no. |
| **Two systems sending at once** | During the parallel run, someone gets the same email twice. | Each automation is switched on in Outbox and off in Patch on the same day, and checked against the nightly Patch pull the next morning. |
| **Personal data on a second server** | The automations need email addresses and first names, which the nightly pull deliberately strips out. | Only email, first name and consent are kept, on the sending server, in a private folder (0700, never in git). They're read from CourtReserve and refreshed each poll. Nothing goes to a third party except SES, which needs the address to deliver. |

---

## 7. What we need from Peak

1. **Tyler's OK** to build the replacement and run it alongside Patch, and later to switch each automation across.
2. **Wes, or DNS access** with Wes's blessing: who owns the GoDaddy account, and an OK to add the SES records (all additions, nothing changed).
3. **Cammie's approvals:** the template look, each automation's words and rules before it goes live, and who approves while she's away.
4. **Patch's price, contract end date and notice period.** The $499 a month is from our 11 Nov notes and still needs confirming.
5. **The Patch unsubscribe export,** and bounced and complained contacts if Patch offers them. It has to come from Patch's own screens: the Patch API only returns the 50 newest contacts.
6. **CourtReserve, later and only with Tyler's OK:** whether Peak's API key can use webhooks, and a one-off test of writing an unsubscribe back to a member.

---

## 8. Open questions

1. What From address and display name should Outbox use? And where do replies go? Patch received 1,649 replies since Feb 2025. Front Desk (info@) belongs to the staff; a new Peak mailbox is another option.
2. Do service emails (free-class reminder, new-member welcome) go to people who unsubscribed from marketing email? The plan's default is no.
3. Does CourtReserve's check-in report show today's check-ins as they happen? (To test in Phase 1.)
4. Can Peak's API key use CourtReserve's Integrations API webhooks? Can `member/update` set the marketing unsubscribe flag?
5. Does Cammie want a hold-out group for measuring what an email caused, and on which emails?
6. Which automations after the first four, and in what order? The 23 Nov audit suggests birthday after an audience review, then win-back and the drop-in regulars.
7. Does Peak want texts back at all (Phase 4)?
8. Patch's notice period. This decides when the saving starts, and so whether it lines up with February.
9. Is Cammie's redesign of the first four in Patch the source for Outbox's words? The plan assumes yes, so she only writes each email once.

---

## Fact-check log

**Verified**

- **Amazon SES prices:** Essentials $0.16 per 1,000 (0 to 10 million a month), no plan fee; attachments $0.12 per GB; managed dedicated IP $15 a month plus $0.08 per 1,000; free-tier credit up to $200 for 6 months. Source: aws.amazon.com/ses/pricing, read 24 Nov 2026. The page also gives 21 Jul 2026 as the date Essentials became the default for inactive accounts.
- **CourtReserve API:**
  - **60 calls per minute per key,** 429 with Retry-After. Sources: CourtReserve help centre, "Setup API access integration" (updated "over 3 weeks ago" as of 24 Nov 2026), and api.courtreserve.com/apihelp.
  - **API on the Advance, Momentum and Enterprise plans.** Source: help centre, "Understanding the CourtReserve API". Peak has been on Momentum since 15 Oct (Tyler, 11 Nov).
  - **Webhook subscriptions** exist in the "Integrations API" swagger (`/api/v1/courtsapp/webhooks/...`), with payload types for member, payment, event registration, reservation and event, and no check-in type. Source: api.courtreserve.com/swagger/docs/integrations, read 24 Nov 2026.
  - `member/get` supports `createdOrUpdatedFrom` with a time, and `includeMarketingConsent`. The check-in report filters by date and by ranges of up to 31 days. Source: api.courtreserve.com/swagger/docs/organization, read 24 Nov 2026.
- **Gmail:** above 5,000 a day to Gmail accounts, senders need SPF, DKIM and DMARC, alignment, one-click unsubscribe (`List-Unsubscribe-Post`, RFC 8058) for marketing mail, and a spam rate below 0.3%; Google recommends below 0.1%. Source: Google Workspace Admin Help, "Email sender guidelines" (support.google.com/a/answer/81126), read 24 Nov 2026; requirements in force since 1 Feb 2024.
- **Yahoo:** SPF and DKIM, DMARC at least p=none and passing, one-click unsubscribe (RFC 8058 recommended), honour unsubscribes within 2 days, spam rate below 0.3%. Source: senders.yahooinc.com/best-practices, read 24 Nov 2026; enforced from Feb 2024.
- **Peak's DNS,** by lookup on 24 Nov 2026: SPF includes outlook and patchsend with `-all`; DMARC `p=none`; MX Microsoft 365; nameservers GoDaddy; `links.peakpickleball.us` resolves to the Outbox server. patchsend.com's SPF includes amazonses.com.
- **Patch volume and list health,** from the 23 Nov read-only pull:
  - 326,237 emails and 74,179 texts since 25 Feb 2025
  - 91,441 emails from Dec 2025 to 23 Nov 2026
  - busiest months 33,198 (Sep 2026) and 112,258 (Apr 2025)
  - over the last 12 months: 229 bounced, 555 dropped, 18 complaints, 317 unsubscribed
- **Consent figures:** 13,752 opted in to email, 2,512 unsubscribed, 2,882 of 16,264 opted in to texts. Source: CourtReserve, 23 Nov pull.
- **Outbox capabilities:** `assistant/outbox/README.md`, `lib.php` (`obStreams`), and the Peak sender README and `u.php` (POST-only unsubscribe). There is no `List-Unsubscribe` header in the sender today (searched the code, 24 Nov).

**Corrected or narrowed**

- **Running cost.** "$10 to $20 a month" is a ceiling. At the last 12 months' real volume, SES comes to about $1 to $6 a month. $18 is the busiest month on record.
- **Timing of the saving.** The February pay change and the end of Patch may not line up exactly: that depends on Patch's notice period (unknown).

**Unresolved**

- Patch's price ($499 a month, our 11 Nov notes), contract end date and notice period. To confirm with Tyler.
- Whether Peak's CourtReserve key can use webhooks, and whether CourtReserve accepts a write-back of the unsubscribe flag.
- Whether the check-in report shows same-day check-ins as they happen.
- Who owns the GoDaddy account (Wes's question). Our notes say Matthew has admin there.
- Exchange Online's 10,000 recipients a day comes from our 4 Nov notes. It wasn't re-checked here; it only explains why Microsoft 365 isn't used for bulk mail.
- The From address Patch uses today. It wasn't in the API pull.
- **No Peak revenue figures are used in this plan,** by design. Patch's "revenue" column from the 23 Nov audit is left out.
