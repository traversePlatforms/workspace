# Traverse launch checklist (28 Oct 2026; emails start Thu 29 Oct, 8 am)

Checked live tonight unless marked otherwise. **Bold = has to happen before the first email goes out.**

## A. Tonight, before the first email

| # | Item | Who | Status 28 Oct |
|---|---|---|---|
| 1 | **Review the homepage FAQ (TR-24)** | Matthew | waiting |
| 2 | **Look over the new screenshots (TR-25)** | Matthew | live, waiting |
| 3 | **Privacy policy and cancellation policy still show "Draft"** to visitors. Did the attorney cover them? If yes, the label comes off; if not, decide whether to launch with them as they are | Matthew decides, Claude edits | open |
| 4 | **Postal address in Prospect Desk → Settings** (CAN-SPAM: every commercial email needs one; the desk refuses to queue without it). LLC mailing address, PO box or virtual mailbox; it is printed in every email | Matthew | **not set** |
| 5 | **Open the site** (`bash traverse/ops/open-site.sh`): password off, the 7 public pages listable by Google, robots.txt + sitemap.xml, cache flushed, checked as a visitor; `open-site.sh undo` puts it back | Claude, on Matthew's go | staged and dry-run checked; **every template links people to traverseplatforms.com and the demo page, so this must be done before 8 am** |
| 6 | **Send yourself one test from the Prospect Desk** (to a personal Gmail and an Outlook/Hotmail address): check it lands in the inbox, not spam, and the unsubscribe link works | Matthew | open |
| 7 | **Queue a small first batch (10–20)**, not the full 40: a three-week-old domain sending cold email should start small and build up | Matthew presses Queue | open |
| 8 | **Book one demo yourself on your phone** after the site opens, and cancel it from the email link: proves booking, confirmation email and cancel end to end | Matthew | open |
| 9 | **Demo slots vs your Surge hours**: the calendar offers Mon–Fri 9–5. Block or narrow it to times you can really take a call | Matthew | open |

Already done and checked tonight: email login for sending works (Gmail accepted it, nothing sent); SPF, DKIM and DMARC are published for traverseplatforms.com; every email carries signature, postal address, an unsubscribe link and the one-click unsubscribe header; the unsubscribe page works without the password; all links and images on the 7 public pages work; the demo calendar answers (slots 9:00–4:30 tomorrow); share image works; prices on the page match the 26 Oct plans; contact emails are the real hello@/support@/billing@; customer agreement v2 approved by the attorney; Stripe live (Roofing tile); templates v4 approved and loaded.

## B. First week after launch

- **Google Search Console + Bing Webmaster Tools** for traverseplatforms.com; submit sitemap.xml (a Google verification record already exists on the domain; it may be the Workspace one).
- **Ramp the sending**: 10–20 a day for the first days, watch bounces, spam complaints and replies, then 30–40.
- **Answer replies fast** (same day): replies are the warmest leads you'll get; log them in the Prospect Desk.
- **Honour unsubscribes** (automatic in the desk) and "no thanks" replies by hand within 10 business days (CAN-SPAM).
- **DMARC reports**: add a reporting address to the DMARC record so spoofing or delivery problems show up.
- **Measure the funnel**: emails sent → replies → demo bookings → trials/sign-ups, from the desk and the demo bookings. There is no analytics on the site; if you want site visits counted, add a cookie-free counter or UTM tags on the email links.
- **Support readiness**: support@ watched daily (an auto-reply with response time), the (303) 596-9515 voicemail greeting says Traverse, a short "how to get set up" email for new customers.
- **First-customer path rehearsed**: who creates the install, codes and data region within the promised 2 business days; Mark live; the 7-day money-back and Refund-and-cancel steps (Traverse-only); set the founding end date when the first customer signs (TR-31).
- **Google Workspace trial ends 7 Nov**: check the plan and price before it charges.

## C. What startups normally have in place at launch (general practice, not a legal opinion)

**Legal and money**
- Entity, EIN and a business bank account; Stripe paying out to it (live since 26 Oct).
- Terms, privacy policy and refund policy published as final versions (A3), and the customer agreement customers actually accept at checkout (v2).
- **Sales tax on software**: Colorado and some home-rule cities tax SaaS differently; ask an accountant before the first invoice. (Not researched here.)
- Business insurance: general liability plus tech E&O / cyber, since the app holds customers' customer data. Your call; ask your agent.
- Trademark: the TRAVERSE Class 42 question was raised once (traverse-name-trademark); your call.

**Product**
- Backups running (TR-10 nightly) and a restore you've actually tried once.
- Someone notified if the site or app goes down (uptime monitor; free ones exist).
- A demo account and a 15-minute demo script that shows the three things prospects care about (the hail map, the door list, the office view).
- Known limits written down so support answers are consistent (e.g. texting off, which towns are covered).

**Sales and marketing**
- One-page price sheet (PDF) to send after a demo, matching the site.
- A follow-up after the first email (one or two nudges, a few days apart), planned before the first one goes out.
- Credibility when prospects look you up: a LinkedIn company page for Traverse Platforms, your LinkedIn showing Traverse, and the site live and indexed.
- A short list of answers to the usual objections (price, "we already use X", data source, contracts).

**Launch style**
- Soft launch: a small batch first, fix what breaks, then widen. Don't send all six trades at once on day one.
- Decide the number you're watching (e.g. demos booked per 100 emails) and look at it daily for the first two weeks.
