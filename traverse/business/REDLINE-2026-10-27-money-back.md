# Traverse agreement changes, 27 October 2026: money-back guarantee replaces the free pilot

For the attorney. Nothing here has been sent to anyone. The attorney confirmed version 1 (26 October 2026). These changes make version 2.

## Why

Matthew's decisions on 27 October 2026:

- The free 7-day pilot for founding companies is gone.
- The card is charged when the company subscribes.
- Traverse sets up the company's app within 2 business days of payment: towns, branding, sign-in codes, prices and terms.
- A 7-day money-back guarantee runs from the day the app is live.
- The founding offer is otherwise unchanged:
  - about 25% off the first 12 months;
  - the founding window is a year from Traverse's first paying client.
- Customer-facing copy now describes the founding price as "your price is locked in for life as long as you're with us". The contract keeps the precise meaning: the list price on the Order Form does not increase while the subscription continues without a break. The founding discount itself still covers only the first 12 months.

## Subscription Agreement (traverse/business/client-agreement.md)

### §9.3

**Old:** "**9.3 Founding clients and pilots.** If the Order Form gives a founding-client discount or free pilot, those terms apply as stated there. A free pilot is offered once per client; at its end the subscription starts and is billed unless the Client cancels before the pilot ends."

**New:** "**9.3 Setup and the money-back guarantee.** The first payment is charged when the Client subscribes. Traverse then sets up the Client's Install (its towns, branding, sign-in codes, prices and terms) within 2 business days (Monday to Friday, except US federal holidays), or longer only while Traverse is waiting on something it needs from the Client, and tells the Client the day the Install is live (the **"Go-Live Date"**). If the Client is not satisfied, it may cancel by email to **billing@traverseplatforms.com** at any time before the Go-Live Date or within 7 days after it, and Traverse will refund that first payment in full and end the subscription. The guarantee applies once per client, to its first subscription."

### §9.6 Price changes

**Old:** "Traverse may change its prices for any renewal by giving at least 30 days' notice before the renewal date. Founding-client discounts last for the period stated on the Order Form."

**New:** "Traverse may change its prices for any renewal by giving at least 30 days' notice before the renewal date. For a founding client, the list price on its Order Form is locked in: it does not increase while the subscription continues without a break. The founding-client discount itself lasts only for the period stated on the Order Form (the first 12 months); after that the Client pays that locked-in list price."

Version 1 had a contradiction here. The Order Form said a founding client's list price "does not rise". §9.6 let Traverse change prices at any renewal, with no exception for founding clients. The new text resolves it in the Order Form's favour.

### §9.7 Refunds

**Old:** "Fees are non-refundable except as this Agreement expressly provides (§2.6, §10.4, §14.1)."

**New:** "Fees are non-refundable except as this Agreement expressly provides (§2.6, §9.3, §10.4, §14.1)."

### Exhibit A, Order Form: "Founding client" row

**Old:** "[Yes / No]. If yes (the company signs up within a year of Traverse's first paying client): a free 7-day pilot, then the founding prices on this Order Form (about 25% off, in whole dollars) for the first 12 months, and the list price on this Order Form does not rise while the subscription continues"

**New:** "[Yes / No]. If yes (the company signs up within a year of Traverse's first paying client): the founding prices on this Order Form (about 25% off, in whole dollars) for the first 12 months, and the list price on this Order Form is locked in for as long as the subscription continues without a break (§9.6)"

### Exhibit A, Order Form: new "Setup and guarantee" row

**Old:** (none)

**New:** "Install set up within 2 business days of the first payment; 7-day money-back guarantee from the Go-Live Date (§9.3)"

### Exhibit A, version line

**Old:** "governed by the Traverse Subscription Agreement version 1, dated 26 October 2026"

**New:** "governed by the Traverse Subscription Agreement version 2, dated 27 October 2026"

Nothing else in the Agreement changed. §10.2 renewal and notice, §10.4 and §14.1 refunds, and §2.6 are as you confirmed them.

## Cancellation and Refund Policy (traverse/business/cancellation-policy-DRAFT.md, the public page /cancellation/)

### Monthly plans

**Old:** "We don't charge a cancellation fee, and we don't refund part of a month."

**New:** "We don't charge a cancellation fee, and we don't refund part of a month, except under the money-back guarantee below."

### When we do refund: new first bullet

**Old:** (none)

**New:** "**If Traverse isn't right for you.** In your first 7 days live, under the money-back guarantee below."

### "The founding-company pilot" section, replaced by two sections

**Old:** "**The founding-company pilot.** Founding companies get a free 7-day pilot, once. If you cancel before the pilot ends, you are not charged. If you don't, your plan starts and is billed when the pilot ends."

**New:** "**Setup and the 7-day money-back guarantee.** Your card is charged when you subscribe. We set up your company's app (your towns, branding, sign-in codes, prices and terms) within 2 business days, and tell you the day it is live. If Traverse isn't right for you, email billing@traverseplatforms.com before your app is live or within 7 days after, and we refund your first payment in full and end your plan. This is once per company, on its first plan."

and

"**Founding companies.** Companies that sign up in our first year get about 25% off their first 12 months, and their price is locked in for life as long as they're with us."

**Last updated:** 27 October 2026 (it was 26 October 2026).

## Terms of Use

No change. The Terms of Use never mentioned the pilot, refunds or prices.

## Questions for the attorney

1. **"Locked in for life".** This is customer-facing wording, on the website, in the app and in the cancellation policy. The contract says the list price "does not increase while the subscription continues without a break" (§9.6 and the Order Form). Is the marketing phrase safe next to that? Should "without a break" be defined, for example as a lapse from a failed payment that is cured within the §9.4 period?
2. **The 2-business-day setup.** The text adds "or longer only while Traverse is waiting on something it needs from the Client". Is that enough protection? Does Traverse need a remedy for late setup, or is the money-back right enough?
3. **The guarantee window.** It runs from payment, through setup, until 7 days after the Go-Live Date. Traverse decides the Go-Live Date and tells the Client. Should the Client be able to dispute it, for example by requiring the notice in writing by email?
4. **Once per client.** The guarantee applies "once per client, to its first subscription". Is that clear enough to stop a company from cancelling and re-subscribing to claim it again?
5. **What gets refunded.** Only "that first payment". For a yearly plan that is the whole year. Confirm that is intended, and that Stripe's processing fee is not deducted (Traverse absorbs it).
6. **Colorado or FTC rules** on money-back guarantees and automatic renewal. Is anything needed beyond the existing §10.2 renewal disclosure?

## Where it shows

- **Billing screen in the app, every install:**
  - "Setting up your app (up to 2 business days)" until Traverse marks it live, then "Live since X · money-back guarantee until Y (7 days)".
  - Before paying: "The card is charged today. We set your app up within 2 business days, and you get a 7-day money-back guarantee from the day it is live."
  - Founding line: "your price is locked in for life as long as you're with us".
- **Refunds are never automatic.** Only Traverse's own sign-in can press "Refund and cancel", and only inside the window.
- **Stripe checkout** no longer includes a trial.
- **Website** (still behind its password):
  - pricing: "No setup fee: we set you up within 2 business days, and every plan has a 7-day money-back guarantee from the day your app is live";
  - the founding paragraph;
  - two FAQ answers: setup, and cancelling;
  - the demo page;
  - /terms/ and /cancellation/, rebuilt from these files.
