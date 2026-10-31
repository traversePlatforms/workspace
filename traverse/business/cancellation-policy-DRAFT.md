# Traverse Cancellation and Refund Policy (DRAFT)

**Status: first draft, 2026-10-13; setup and money-back guarantee added 2026-10-27 (replacing the founding pilot); approved by Matthew 2026-10-28; no free trial, refunds by Traverse, seats (admin plus the plan's people, changed through billing@), founding features and the Billing path added 2026-10-29, for review with the subscription agreement (§9 and §10 there say the same in contract terms). Not reviewed by a lawyer. Shown on traverseplatforms.com/cancellation/ marked as a draft while the site is unlisted.**

## Cancellation and Refund Policy

**Last updated: [DATE]**

### Monthly plans

You can cancel any time. Your plan keeps working until the end of the month you have already paid for, and then it stops. We don't charge a cancellation fee, and we don't refund part of a month, except under the money-back guarantee below.

### Yearly plans

A yearly plan costs 20% less than paying month to month, and it is paid once a year. You can turn off the renewal any time; the plan then runs to the end of the year you paid for. We don't refund the unused part of a year, except in the cases below.

### When we do refund

- **If Traverse isn't right for you.** In your first 7 days live, under the money-back guarantee below.
- **If we can't fix a fault.** If Traverse doesn't work as described and we can't fix it within 30 days of you telling us, you can end the plan and we refund what you prepaid for the time left.
- **If we take away what you paid for.** If we remove a core part of Traverse during your paid term, you can end the plan and we refund the time left.
- **If we charged you by mistake.** Tell us within 60 days at billing@traverseplatforms.com and we refund the mistaken charge.

### Setup and the 7-day money-back guarantee

There is no free trial. Your card is charged when you subscribe. We set up your company's app (your towns, branding, sign-in codes, prices and terms) after your payment, and tell you the day it is live. If Traverse isn't right for you, email billing@traverseplatforms.com before your app is live or within 7 days after, and we refund your first payment in full and end your plan. This is once per company, on its first plan.

Traverse makes every refund, back to the payment method you used.

### Founding companies

Companies that sign up in our first year get 25% off their first 12 months. Their price is locked in, and they keep every feature, for as long as they stay with us. If a company leaves and comes back, the terms current then apply.

### Seats

One plan per company. Every plan includes one admin account plus its people: Duo 1 person, Team up to 5, Company up to 12. To add or remove seats, email **billing@traverseplatforms.com**; seats don't change on their own. An added seat is billed for the rest of the current period. A removed seat comes off from your next bill.

### If a payment fails

We email your billing contact. If the payment is still not made 14 days after that email, we may pause your company's access until it is. Your records are not deleted while access is paused.

### How to cancel

- In the app, where your app has Billing: **Setup › Billing › Manage billing** (admins only).
- Or email **billing@traverseplatforms.com** from your account's billing email.

### Your records after you cancel

For 30 days after your plan ends, you can download your customers, bookings and other records, or ask us for a copy. After that we delete them, and our backups are overwritten within 30 more days.

Questions: **billing@traverseplatforms.com** or (303) 596-9515.

---

## Fact-check log

| Claim | Matches | Result |
|---|---|---|
| Yearly 20% less | Homepage and billing.php display prices, 30 Oct plans Duo / Team / Company ($79 vs $99, $199 vs $249, $439 vs $549 a month; extra people $35 vs $45, $29 vs $39) | Verified: base prices 20% (20.2%, 20.1%, 20.0%); extra people 22–26% |
| Faults: 30 days to fix, then pro-rata refund | Subscription agreement §14.1 | Matches the draft |
| Removed core feature: refund | Subscription agreement §2.6 | Matches the draft |
| Charged at checkout; set up after payment (no set-up time promised, 30 Oct); 7-day money-back from go-live, once | Matthew 2026-10-27 (replaces the free 7-day pilot); billing.php: no trial at checkout, paid_at on the first paid subscription event, live_at from Traverse's Mark live, refund only by Traverse within the window; subscription agreement §9.3 | Verified against the code; **attorney to confirm the wording** |
| Founding: 25% off 12 months, price locked in for life while they stay | billing.php founding_pct 25 (coupon for 12 months); subscription agreement §9.6 and Order Form (list price does not increase while the subscription continues without a break) | Matches; Matthew's phrase (27 Oct) |
| Added seats pro-rata | Stripe customer portal set to create prorations (traverse/ops/stripe-setup.mjs) | Verified |
| Seats: admin plus the plan's people; changed through billing@, not automatic | Matthew 2026-10-29 (admin account decided today); billing.php: plan and seat changes go through Traverse, the portal cannot change a subscription | Matches the policy; **the app's seat count is being changed to leave the admin account out (29 Oct)** |
| No free trial; refunds only by Traverse | Matthew 2026-10-27; billing.php: no trial at checkout, refund super-only | Verified |
| Founding: keep every feature while they stay; current terms on return | Matthew 2026-10-29 | Business decision |
| Pause after 14 days unpaid | Subscription agreement §9.4; the app itself never locks anyone out today | **Business choice; the app does not enforce it yet** |
| Manage billing path in the app | index.html Setup group → Billing tile (feat billing: TraverseRoofing only as of 2026-10-29); billingportal action | Verified; other editions email billing@ |
| 30 days to download, backups overwritten in 30 more | Subscription agreement §10.5; nightly backups keep the newest 30 | Matches the draft |
| 60 days to report a mistaken charge | Business choice | **Matthew to confirm** |
