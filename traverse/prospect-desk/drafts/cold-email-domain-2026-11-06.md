# A separate domain for cold email (6 Nov 2026)

**Why:** ~1,823 cold emails went from traverseplatforms.com with a 4.1% bounce rate. That same domain sends demo confirmations, client welcome emails and app mail. Spam complaints and bounces count against the domain, so cold outreach should run on its own look-alike domain, warmed up slowly, and the main domain stays clean.

**Checked on Porkbun, 6 Nov (availability only, nothing bought):**

| Domain | Status | Price |
|---|---|---|
| traversefield.com | Available | $11.81 first year, $11.81 renewal |
| traversecrews.com | Available | $11.81 first year, $11.81 renewal |
| gettraverse.com, trytraverse.com, usetraverse.com, traversehq.com | Taken | |

**Buying needs Matthew's go.**

## Setup once bought (Claude can do all but the payment)
1. DNS at Porkbun: MX for Google, SPF, DKIM and DMARC (start `p=none`), and a redirect of the bare domain to traverseplatforms.com, so anyone who types it lands on the real site.
2. A mailbox: add the domain to the Traverse Google Workspace (as a secondary domain with one sending user, or an alias domain). **The Workspace trial ends 7 Nov (LA-4)**, so settle the plan first. Check the per-user price before adding a user.
3. Warm-up for 2-3 weeks before any volume: start at 10-15 a day, mostly to people likely to reply, then step up. The desk's hourly and daily caps already do the pacing.
4. Verify every address before sending (Hunter's verifier is already set up) to keep bounces under 2%.
5. The desk sends the new free-map sequence from this mailbox. Replies go to the same inbox Matthew's assistant already reads, or forward to M.Sharpe@TraversePlatforms.com.
