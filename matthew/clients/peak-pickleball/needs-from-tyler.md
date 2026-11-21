# Peak: what I need from Tyler (or Peak's admin)

Made 19 Nov 2026, after the meeting; updated 20 Nov (evening: 8a sponsor add-ons, the GoDaddy note under 16, and the TVs) and 21 Nov (the website access under 16; a clean ask-list copy for Matthew on the Desktop, "Peak - what I need from Tyler.txt"). **21 Nov: Matthew SENT Tyler the open-items list (the Desktop copy).** Waiting on his answers. **DONE** marks what is already sorted.

## 1. The deal (first)
1. A yes on price and scope, and the start date.
2. Who signs: Tyler or Scott. Also a billing contact and how Peak will pay.
3. Whether the website build ($3,000) is part of it.

## 2. Email (once committed)
Simplest ask (Matthew, 19 Nov): give Matthew the **Exchange Administrator** role, not Global Administrator. Then Matthew can do items 4 and 6 himself (the shared mailbox, an alias, Send As, sending from an alias, DKIM signing). It still leaves out the GoDaddy DNS records and app approvals (item 5). Cai and the other sellers have no Peak email addresses, so replies come to Matthew until the shared mailbox exists.
4. **DONE 19 Nov (Matthew, as admin):** **Shared mailbox** "Peak Pickleball" (for example tours@ or partnerships@peakpickleball.us). It's free, with no licence. Give Matthew **Full Access** and **Send As**. Then emails show as from "Peak Pickleball" and the team sees the replies.
5. **DONE 19 Nov:** **One more approval click** for the "Matthew outreach" app, so it can send from that shared mailbox. Matthew sends the link.
6. **IN PROGRESS 20 Nov: the GoDaddy CNAMEs are in (Tyler gave Matthew the GoDaddy login); waiting on Microsoft to publish the keys, then Matthew enables signing.** **DKIM** for peakpickleball.us. In Microsoft Defender, turn on DKIM, then add the two CNAME records at the domain's DNS (GoDaddy). Nothing more is needed from Tyler for this.
7. **DONE 20 Nov: Tyler gave Matthew full control of the sponsor and expo blasts.** **OK to email in Peak's name** to the sponsor list (43) and the expo list (35), and his read of the two email drafts.

## 3. Answers for the emails and tours
8. Are the offer shapes really on offer: court naming, event presence, and memberships bundled for a sponsor's staff? Is renting the whole building for expos on offer? (The emails now say "growing our group of local sponsors", Cai's wording, so the "first group" question is settled.)
8a. **The tech add-ons for sponsors** (new 20 Nov; the sheet for Brandon is matthew/peak-pickleball-sponsorship/sponsor-add-ons-for-brandon-2026-11-20.pdf): is Peak OK offering tracked QR codes on court signs, a monthly sponsor report, sponsor slides on the TVs, member deals with codes, and a staff sign-up link? Who sets their prices: Peak, Brandon or Matthew?
9. Are the sponsor packages still $12,000 and $24,000 a year?
10. **OK to share Peak's own numbers with prospects:** about 630 members paying dues and about 67,000 sign-ups a year. These are used in Jamie's email (Bad Daddy's).
11. Tours: how long they run (we assumed 30 minutes), who meets the visitors, and which days and times to offer.
12. Do Cai, Brandon, Nneka and Lance have Peak email addresses, so they can get copies of the tour confirmations?

## 4. Access for the work (read-only where possible)
13. **Patch Retention:** view-only access, or a list of what it sends. Also its billing terms, renewal date and the text opt-in count.
14. **CourtReserve:** the cancellation reasons report, exported to Excel. Tyler already OK'd running it read-only. Also the branded app: does it come with a 1-year contract? And who built the older iPhone app (HVPC LLC)?
15. **CourtReserve's old "API" key with full access:** set up by a former IT employee and unused. Suggest he checks it and turns it off. We haven't touched it.
16. **Website** (expanded 21 Nov). The site is WordPress, on the paid Avada theme plus a custom "Peak-Pickleball" theme. It runs on a server named host.lwdserver.com, probably the company that built it. The code lives in that hosting account, so getting it means getting the hosting.
   - Who built and hosts the site, and whether Peak has a contract with them.
   - A **WordPress Administrator** login (peakpickleball.us/wp-admin) in Matthew's own name.
   - **SFTP or cPanel** on the hosting account, or a **full backup** (files plus database).
   - The **Avada licence**, and confirmation that Peak (not the builder) owns the custom theme.
   - GoDaddy, the domain and DNS: **DONE**. He gave Matthew the login on 20 Nov.
   - **For Tyler to know (no action):** on 20 Nov Matthew added three records at GoDaddy for peakpickleball.us, and changed nothing else. They are two DKIM records (selector1 and selector2) and one `links` record, so the links in Peak's emails show Peak's own name (links.peakpickleball.us) instead of the Traverse server's.
16a. **Site metrics (read-only), so the reports can show website numbers:**
   - **Google Analytics:** add Matthew's Google account as a **Viewer** on the Peak Pickleball property. The site already runs Google Analytics 4 (tag G-WDBWJ1Q6HN). It shows visitors, where they came from, top pages, and whether email clicks turn into visits.
   - **Google Search Console:** add Matthew as a **Restricted** user on peakpickleball.us. It shows the Google searches people find Peak through.
   - In each tool, Tyler adds the user under Admin › Property access management (Analytics) or Settings › Users and permissions (Search Console). This needs the Google email address Matthew wants to use.
17. **One answer for each price and rule,** so the new site matches. Court cancellation is 4 hours, not 24. Is the family court rate $6 or $7? Also his OK on a privacy policy page.
18. **Socials:** admin on Meta Business Suite (Facebook and Instagram), Google Business Profile, the LinkedIn page, YouTube, TikTok, Paage and the Facebook group. Who answers DMs today?
19. **Ads:** the monthly ad budget, who approves each ad, and access to the Meta ad account and Google Ads (or OK to create them).
20. **TVs:** how many there are, where they are, what device feeds each one, and what they show. Also whether Peak is OK with sponsor slides on them. The sponsor TV reel (item 8a) needs this.

## Fact-check log
- Shared mailbox, Send As and the extra app permission: Microsoft 365 needs an Exchange or Global admin for each. Matthew isn't one. The "Grant admin consent" button was greyed out for him on 17 Nov.
- Tyler's OK for the read-only cancellation report: given 13 Nov (memory, peak-internal-systems-and-site).
- The site's 4 h vs 24 h and $7 vs $6 contradictions: checked live on 19 Nov.
- The CourtReserve branded app's 1-year contract: from CourtReserve's pricing page, 19 Nov. Not confirmed for Peak's own account.
- Lists of 43 and 35: from Outbox on 19 Nov.
- The GA4 tag G-WDBWJ1Q6HN, and the site being WordPress on a separate host, not GoDaddy: checked from the live homepage on 20 Nov (the gtag script, the wp-json links, Server: LiteSpeed).
- The theme and host, checked from the live homepage on 21 Nov:
  - WordPress 7.1.5 (generator tag), with themes/Avada and themes/Peak-Pickleball in the page's file paths.
  - The IP 170.249.198.162 resolves back to host.lwdserver.com.
  - Who runs lwdserver.com: **unresolved**. Don't name a company until Tyler says.
