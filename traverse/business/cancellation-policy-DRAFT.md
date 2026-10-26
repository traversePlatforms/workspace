# Traverse Cancellation and Refund Policy (DRAFT)

**Status: first draft, 2026-10-13, for review with the subscription agreement (§9 and §10 there say the same in contract terms). Not reviewed by a lawyer. Shown on traverseplatforms.com/cancellation/ marked as a draft while the site is unlisted.**

## Cancellation and Refund Policy

**Last updated: [DATE] · Draft**

### Monthly plans

You can cancel any time. Your plan keeps working until the end of the month you have already paid for, and then it stops. We don't charge a cancellation fee, and we don't refund part of a month.

### Yearly plans

A yearly plan costs about 20% less than paying month to month, and it is paid once a year. You can turn off the renewal any time; the plan then runs to the end of the year you paid for. We don't refund the unused part of a year, except in the cases below.

### When we do refund

- **If we can't fix a fault.** If Traverse doesn't work as described and we can't fix it within 30 days of you telling us, you can end the plan and we refund what you prepaid for the time left.
- **If we take away what you paid for.** If we remove a core part of Traverse during your paid term, you can end the plan and we refund the time left.
- **If we charged you by mistake.** Tell us within 60 days at billing@traverseplatforms.com and we refund the mistaken charge.

### The founding-company pilot

Founding companies get a free 14-day pilot, once. If you cancel before the pilot ends, you are not charged. If you don't, your plan starts and is billed when the pilot ends.

### Seats

Adding a person adds a seat, billed for the rest of the current period. Removing a person takes effect from your next bill.

### If a payment fails

We email your billing contact. If the payment is still not made 14 days after that email, we may pause your company's access until it is. Your records are not deleted while access is paused.

### How to cancel

- In the app: **Office → Setup → Billing → Manage billing** (admins only).
- Or email **billing@traverseplatforms.com** from your account's billing email.

### Your records after you cancel

For 30 days after your plan ends, you can download your customers, bookings and other records, or ask us for a copy. After that we delete them, and our backups are overwritten within 30 more days.

Questions: **billing@traverseplatforms.com** or (303) 596-9515.

---

## Fact-check log

| Claim | Matches | Result |
|---|---|---|
| Yearly about 20% less | Homepage and billing.php display prices, 26 Oct plans ($79 vs $99, $199 vs $249, $449 vs $549 a month; extra people $35 vs $45, $29 vs $39) | Verified: 18–26% |
| Faults: 30 days to fix, then pro-rata refund | Subscription agreement §14.1 | Matches the draft |
| Removed core feature: refund | Subscription agreement §2.6 | Matches the draft |
| 14-day founding pilot, once | billing.php (trial_days 14, once per install) | Verified |
| Added seats pro-rata | Stripe customer portal set to create prorations (traverse/ops/stripe-setup.mjs) | Verified |
| Pause after 14 days unpaid | Subscription agreement §9.4; the app itself never locks anyone out today | **Business choice; the app does not enforce it yet** |
| Manage billing path in the app | index.html Office → Setup → Billing; billingportal action | Verified |
| 30 days to download, backups overwritten in 30 more | Subscription agreement §10.5; nightly backups keep the newest 30 | Matches the draft |
| 60 days to report a mistaken charge | Business choice | **Matthew to confirm** |
