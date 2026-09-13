# Getting the rates page online — what you actually need to buy

**Built:** 2026-08-24
**Status:** Reference. Nothing purchased, nothing registered, nothing deployed.

---

## The short version

You are right that a domain on its own does nothing — it is just an address, and
it has to point at something. So yes, you need hosting as well.

**But you do not need a server.** What you are picturing — renting a server,
cPanel, Bluehost or GoDaddy at $10–30 a month — is what you need when a site runs
*code* on every visit: WordPress, PHP, a database, user logins. Your page does
none of that. It is a single HTML file with the styling written inside it.

Serving a file that never changes is a different product called **static
hosting**, and the free tiers are far past what this page needs.

---

## The three pieces, and what each one really costs

| Piece | What it is | Cost |
|---|---|---|
| **Domain** | The address people type | **~$10–15/year** |
| **Hosting** | Where the file sits and gets served from | **$0** |
| **Email at that domain** | `matthew@yourdomain.com` | **$0 to ~$7/month** — see below |

### Domain

Buy it from a registrar. Cloudflare, Porkbun and Namecheap all sell at or near
cost. Avoid GoDaddy's cheap first year — it renews high, which is the business
model.

Register it in **your own name and your own account**, not through anyone doing
you a favour. A domain someone else controls is a problem you find out about at
the worst moment.

### Hosting — genuinely free, genuinely not a catch

**Cloudflare Pages** free plan, confirmed against their own limits page:

- **500 builds a month** (you would use one per edit)
- **100 projects** per account, **100 custom domains** per project
- **20,000 files** per site, 25 MiB max per file — this page is one file
- **HTTPS/SSL included**, automatic, nothing to configure or renew

Their docs do not publish a bandwidth or request cap for the free plan.

**Why it can be free:** there is no server sitting there costing them money per
visit. The file is copied to their network and handed out. It costs them close to
nothing, and the free tier is there to get you onto the paid products later.

**Alternatives, same idea:** Netlify and GitHub Pages. Any of the three is fine.
Cloudflare is worth picking because you can buy the domain in the same account
and skip wiring two services together.

**How it works in practice:** drag the file onto the dashboard and it is live in
about a minute. Or connect a Git repo and every push republishes automatically —
worth doing given the Surge and Sixfold sites will both need hosting too, and
neither repo has a remote yet.

### Email — this is the piece that actually costs something

This is where most people get caught, because it is not included in either of the
above.

**Cloudflare Email Routing is free, but it only receives.** It forwards
`matthew@yourdomain.com` to your Gmail inbox — 200 destination addresses and 200
routing rules per their docs. It does **not** let you send *from* that address.
Replies would still come from your Gmail.

To actually send as your domain, one of:

- **Zoho Mail free plan** — 5 users, 5 GB each, one domain, **webmail only** (no
  IMAP or POP, so no Outlook or phone mail app). Free tier is only offered in
  some regions. Enough to start.
- **Google Workspace** — around $7 per user per month. Works with the Gmail app
  you already use, which is the reason most people end up paying it.

**Do this before cold outreach, not after.** A gmail.com address is fine on warm
replies and weak on cold ones, and it is the largest deliverability difference
available for the price.

---

## What would change this

Nothing on the page needs a backend today — the calls to action are a phone
number and an email address, not a form. If you later add a **contact form**, a
static host cannot process it. That needs a form service (Formspree, Basin and
similar have free tiers) or a serverless function. It is a small addition, not a
reason to buy hosting now.

---

## The order to do it in

1. Register the domain, in your own account.
2. Create a Cloudflare Pages project and upload `services-page.html` as
   `index.html`. It is live.
3. Attach the domain to the project. SSL configures itself.
4. Set up email — Cloudflare Email Routing to receive today, Zoho or Google
   Workspace when you want to send as the domain.
5. Put the real phone number on the page and republish.

**Running cost after that: the domain, plus email if you pay for it.**

---

## Fact-check log

| Claim | Source | Status |
|---|---|---|
| Cloudflare Pages free plan: 500 builds/month, 100 projects/account, 100 custom domains/project, 20,000 files, 25 MiB max file | Cloudflare's own Pages platform limits documentation | **Verified.** |
| No bandwidth or request cap published for Cloudflare Pages free | Same page | **Verified as absent** — the docs do not state one. Written as "not published", not as "unlimited", because those are different claims. |
| Cloudflare Email Routing is free, forwards inbound only, 200 destination addresses per account and 200 routing rules per domain, 25 MiB inbound message size | Cloudflare Email Routing limits documentation | **Verified.** Sending from a custom address is a separate product with its own quotas. |
| Zoho Mail free plan: 5 users, 5 GB per user, one domain, webmail only (no IMAP/POP), selected regions only | Zoho's own custom-domain and pricing pages | **Verified.** |
| Google Workspace ~$7 per user per month | Widely published, **not re-verified this session** | **Weak.** Directional only — check Google's current pricing page before committing. Tiers and prices change. |
| Domain ~$10–15/year at cost-price registrars | General market knowledge, **not verified this session** | **Weak.** Order of magnitude. Price varies by TLD, and `.com` differs from the cheap first-year TLDs. Check the renewal price, not the first-year price. |
| Static hosting is free because no compute runs per request | Standard description of how static/CDN hosting works | **Reasoning, not a sourced claim.** Stated as the mechanism, and it is why the free tiers are viable. |
| Formspree and Basin have free tiers for form handling | **Not verified this session** | **Weak.** Named as a direction to look, not a recommendation. Check before relying on it. |

**Unresolved:** no domain has been chosen or checked for availability, and no
trademark screen has been run on a name. Worth doing both together before buying.
