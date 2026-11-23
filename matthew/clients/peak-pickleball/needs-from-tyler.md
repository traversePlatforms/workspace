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

## Tyler's answers, 23 Nov 2026 (his email to Matthew)
- **Pay (item 1/2):** Peak pays contractors through QuickBooks, biweekly: Fri 4 Dec, then 18 Dec. He's heard "a setup fee plus $150/week"
  and, from Brandon, "$300/wk", and asks Matthew for his price directly. Once agreed, their accountant **Nathan Kimbro** sets up direct
  deposit. W-9: received.
- **Website (item 16):** built by a contractor they still use, **Wes, wes@lighthousewd.com**; hosting, theme, backup and licence questions go
  to him (Tyler offers to connect them by email). WordPress admin login sent by email (stored ~/.ssh/peak-wordpress.json; login page
  peakpickleball.us/login-secure/ answers). It's a shared "peakadmin" login: still ask for one in Matthew's own name.
- **Google Business Profile:** Tyler added Matthew (invitation sent): accept it; that also gives the review count/rating for the day-one
  baseline. Google Analytics / Search Console (16a): not answered ("not sure about any of the other access").
- **Facebook:** Cammie gave Matthew access (23 Nov).
- **Sponsorships (items 8, 9):** three kinds: **Title** (large prominent signage), **Court** (large court signage + the court named in
  CourtReserve), **Logo** (smaller signage + digital advertising). Usually also: logo in the biweekly newsletter, website and rotating digital
  signage, plus two Unlimited memberships. Agreements have been customised (hard to fulfil); **Brandon is standardising packages**, so
  structure goes through Brandon. Tyler offers the **sponsor tracking spreadsheet and current agreements**: say yes.
- **TVs (item 20):** 4 at the WhistlePig bar (sports/free Samsung channels/YouTube TV, no ads); front desk vertical monitor (BrightSign);
  pro shop TV (court layout); coffee bar TV (BrightSign); golf simulator TV (golf, not BrightSign); 3 downstairs (BrightSign: one court
  layout, two upcoming events/programs). So sponsor slides would go on the BrightSign screens (front desk, coffee bar, downstairs).
- **Not answered yet:** everything else on the list ("I'm not sure about any of the other access you're requesting").

## 5. New since the 21 Nov list (added 23 Nov 2026; not sent yet)
21. **Sponsor exclusivity:** does any current sponsor deal give a sponsor exclusivity in its category? Matthew doesn't know. It matters
    before approaching in-club tenants or partners who compete with a sponsor (for example Stretch Zone vs StretchLab, a PT clinic vs
    Rally Back Therapy or Orthopedic Centers of Colorado). Ask for the list of deals with any exclusivity terms.
22. **Website: the Ziggi's coffee line is out of date.** peakpickleball.us/amenities still says Ziggi's provides the free self-serve
    coffee. Matthew, 23 Nov: Ziggi's used to and no longer does. Ask Tyler to have it taken down (or changed to the new partner once there
    is one): as it stands it's free advertising for Ziggi's. Who edits the site is item 16.
23. **Coffee partner:** does Peak still want free coffee for members, and roughly how many cups a week the station served; is a partner's
    coffee for sale in the pro shop OK, and at what margin.
24. **Patch Retention automations:** once Matthew has written up the missing ones, his OK (or a named approver) before any is created in
    Patch, even switched off. Tyler's 4 Nov consent was to look, not change.
25. **Holiday hours:** tours and booking links around Thanksgiving and Christmas: which days Peak is closed or short-staffed, so nobody is
    offered a tour then (Cai offered a prospect Wed 25 Nov at 5 pm).
26. **URGENT: Patch's automatic emails have stopped** (found 23 Nov in the read-only pull; detail in patch-automations-2026-11-23.md).
    The birthday email sent 23-41 a day until 19 Nov, then none. The per-plan welcomes and the visit thank-you stopped at the same minute
    on 1 Nov (33 new paying members since got no welcome). The free-class reminder and "unlock Starter" stopped 29 Sep (~103 first-timers
    missed). The new-account welcome stopped 13 Jul (1,569 accounts). Blasts still go out (Thanksgiving, 5,001 people), so either the
    automations were switched off or the CourtReserve-to-Patch connection broke (possibly the 15 Oct Momentum upgrade or the branded app).
    Ask Tyler: did anyone turn them off, and can he (or Patch support) check the CourtReserve connection.
    **What the data shows (23 Nov):** not billing (blasts kept going all November, 6,766 so far, so the account is paid and sending); not one
    cut-off date (they stopped 29 Sep, 1 Nov and 19 Nov). Each stopped right after a normal daily run: the welcome and thank-you ran their
    usual 9 am batch on Sun 1 Nov and never again; the birthday email ran its normal 11 am batch on Thu 19 Nov (26 sent) and never again. The
    birthday one doesn't need anything new from CourtReserve (the birthdays are already in Patch), so a broken connection wouldn't stop it:
    that points to a change inside Patch (paused, edited, or given an end date). The same thing happened on Fri 25 Jul 2025, when five
    automations stopped within 35 minutes. **Where the answer is:** Patch > Automations: each one's status (Active / Paused / Ended), any end
    date, and its activity or history (who changed it, when). Our access can't see that screen.
    **Confirmed 23 Nov (Matthew looked at Patch > Automations):** all 17 automations show Enabled OFF and status Draft. Last runs: Google
    Review and Membership Create 2 Nov 12:51-12:52 am, PPU Pipeline 1 Nov 5:00 pm, Birthday Email 19 Nov 11:00 am, five on 25 Jul 2025
    9:02-10:04 am (Target New Non-Members, Non-Member Reengagement, At-Risk/Lost Winback, New Paid Membership Welcome, Expired Membership
    Winback). Patch's own revenue figures for them: Target New Non-Members $107,270, Google Review $36,324, Birthday $32,495, Non-Member
    Pushing Convert $24,465, Membership Create $16,942, Non-Member Reengagement $15,188, PPU Pipeline $10,605. Nobody on our side has turned
    anything back on. Ask Tyler: who switched them off and why (a choice, a cost, texting rules, Patch support?), and which he wants back on.
    If nobody knows, Patch support can read who disabled them and when from the account's history.
    **Last Modification Time (Matthew, Patch list view, 23 Nov):** Google Review edited **23 Nov 6:17 am** (today); Birthday 20 Nov 4:26 pm;
    Non-Member Pushing Convert 16 Nov 2:33 pm; PPU Pipeline 9 Nov 9:35 am; Membership Create 2 Nov 5:00 pm; PEAK QR Code 2 Nov 9:49 am;
    three SMS drafts (test, 101 People copy, Intro Automation) 21 Sep 3:25-3:33 pm (the one text since Jul 2025 went out that day);
    Target New Non-Members 19 Aug 2026; Non-Member Reengagement 3 Aug 2026; At-Risk/Lost Winback 15 Jun 2026; New Paid Membership Welcome
    9 Jun 2026. So someone with Patch access has been reworking them as drafts for months and switching them off after their last runs
    (during working hours), latest edit this morning. **The real ask:** who is editing the Patch automations, what's the plan, and how do we
    coordinate so Matthew's drafts (patch-automations-2026-11-23.md) don't collide with theirs.
27. **Two small fixes the pull turned up:** the welcome emails say $6 an hour and 30 days' notice, CourtReserve says $7 and 15 days (which is
    right?); and "How did you hear about us?" is blank on 95% of accounts: making it required at sign-up lets ads be measured.
28. **Missed dues payments: what happens today, and a reminder.** 21 paid accounts are suspended on the member list (5 of them since
    Jan 2026, so the 11-day auto-cancel isn't happening for them). (Corrected 23 Nov: the "27 unpaid ($1,690)" figure was mostly charges
    not due yet; only 2 November charges ($194) were past due on 23 Nov.) From the data: about 58 dues charges a month are paid more than a
    day late (7.4%), median 1 day, and most are paid in the end, which looks like CourtReserve retrying the card or sending its own notice;
    about 3 a month are still unpaid at 10 days. Patch sends nothing about it. Ask Tyler: does CourtReserve retry and email automatically,
    does staff call anyone, why are 5 accounts suspended since January and not cancelled, and is he OK adding a Patch failed-payment
    reminder (text and email) that lands inside the 10 days (drafted as D in patch-automations-2026-11-23.md).
29. **Texting:** Peak texted members heavily from Feb to Jul 2025 (about 9,000 automated texts a month, and a 32,000-text blast in March
    2025), then stopped on Fri 25 Jul 2025, the same morning five automations were switched off. Since then: one text (Sep 2026). 2,882
    accounts have opted in to marketing texts, and Patch now prompts "It's Time to Send an SMS Blast!". Ask Tyler: why texting stopped (cost,
    complaints, a choice?) and whether Peak wants it back for the free-class and failed-payment reminders.

30. **Yes to your offer:** please send the sponsor tracking spreadsheet and the current sponsorship agreements.
31. **Wes:** yes please, connect us by email (hosting, theme and Avada licence ownership, backups, the two custom Peak plugins).
32. **Website changes, your OK first:** publish a real privacy policy (the site's "Privacy Policy" is an unpublished WordPress draft, and the
    Meta Pixel and Google Analytics run without one; your attorney may want to see it), and take the Ziggi's line off the Amenities page.
33. **WordPress login:** a login in Matthew's own name, and change the shared "peakadmin" password since it went by email. Worth telling Wes:
    the "WP File Manager" plugin is switched on (a common target for attackers) and 4 plugin updates are waiting.
34. **Google Analytics (G-WDBWJ1Q6HN):** add m.sharpe@traverseplatforms.com as a Viewer (probably Wes has it), and Search Console as a
    Restricted user. This was item 16a; no answer yet.

35. **OK to read Peak's QuickBooks for reporting?** Nathan gave Matthew access to Peak's company QuickBooks for payroll setup. With Tyler's OK,
    a read-only connection would pull reports only (monthly profit and loss, revenue by area: memberships, events, pro shop, Whistle Pig,
    sponsorships; marketing spend), never payroll or employee pay, and never write anything. It makes the before/after results and ad return
    complete.

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
