# Peak Pickleball: the new website plan (draft, 23 Nov 2026)

> **DRAFT for discussion. Nothing has been built, published or changed** on peakpickleball.us, in WordPress, CourtReserve, Patch or Peak's shared Drive. For Matthew to take to a sit-down with Cammie, then to Tyler for approval. Matthew Sharpe's own work for Peak.

Prepared by Matthew Sharpe. Sources are in the fact-check log at the end. "Proposal" or "recommendation" marks Matthew's suggestions; everything else traces to Peak's own data, Peak's site and documents, or a named primary source.

---

## 1. The goal

Cammie Wilson (Head of Marketing), 23 Nov: *"I strongly believe our website needs to be the priority. I would like to have a new website launched by January 1 ... Without a good website, we're missing too many opportunities."* She also puts the automated emails before ads, so the order is: website, then follow-up emails, then ads.

**What success looks like on 1 Jan.** A new peakpickleball.us is live. It's built on Cammie's site map. Every page leads to one clear next step: book the free class, book a court, join, or send an enquiry. Prices and rules are stored once, so pages can't disagree. A privacy policy is up. Forms keep their entries. Every click into CourtReserve is tracked. That makes the site ready for the follow-up emails and the ads that come after it.

**How we'll judge it.** The scorecard's existing weekly measures, from Peak's CourtReserve data, read against the 12-month normal and the same weeks last year. December and January are seasonal, so last year's weeks are the fair comparison.

| Measure | Week 0 (16-22 Nov) | 12-month normal (per week) | Same week last year |
|---|---|---|---|
| Free-class first-timers | 16 | 21.2 | 26 |
| New accounts | 50 | 94.3 | 99 |
| New members (first dues) | 13 | 14.7 | 27 |
| Website traffic (Google Analytics) | not available yet | | |

Website traffic gets added once Peak gives us Google Analytics access (asked, waiting). No targets are set here. Proposal: once two January weeks are in, Matthew and Cammie set targets against last year's same weeks.

---

## 2. What's wrong with the current site

Checked from outside on 23 Nov 2026 (33 public URLs from the site's own sitemap, plus every internal link on them). Points marked "22 Oct audit" come from Matthew's October audit and weren't re-measured today.

1. **No privacy policy, though tracking runs on every page.** /privacy-policy/ and /privacy/ both return "not found". The WordPress "Privacy Policy" page is still an unpublished draft. Google Analytics (G-WDBWJ1Q6HN) and the Meta Pixel (624560343236394) both load on the homepage. Meta's Business Tools Terms and Google's Analytics terms both require a posted privacy policy. There's no terms or accessibility page either.
2. **Prices and rules disagree with each other.**
   - Family court rate: /faqs/ says children pay **$6.00** an hour. /membership/ says **$7**, and so does CourtReserve's own plan text.
   - Court cancellation: /faqs/ says **24 hours**. /membership/ says court and Open Play need **4 hours**, and classes 24 hours. Tyler confirmed 4 hours on 11 Nov.
   - Membership notice: /membership/ says **"Cancel anytime"** and, lower on the same page, **"15 days' notice"**. Peak's welcome emails say 30 days.
   - Walk-ins: /faqs/ says "walk in and play any time", but asks people to make an account first.
3. **The best path in isn't featured.** The free class turns 31.9% of new people into members within 60 days. Open Play turns 3.1%, and court bookings 2.0%. The homepage has two buttons into CourtReserve (the free class and memberships), and its three big buttons go to /play-pickleball/ and /membership/. The **Starter** plan ($35), which 310 of 336 free-class converts joined first, isn't on the site at all. That may be on purpose, because Starter is for Intro grads only (see question 6).
4. **Broken and dead-end links.**
   - /partner-with-peak/ links to /court-sponsor-package/, which returns "not found". The page has no form either.
   - /become-a-pickleball-professor/ links to /professor-dashboard/, which returns "not found".
   - The "Leagues" menu item (/leagues/) redirects to /play-pickleball/, so there's no leagues page.
   - Guest-hotel booking links on the homepage and /amenities/ carry stay dates of 17 Jul 2025 and 10 Mar 2026.
5. **Enquiries can't be sent, or they go nowhere trackable.**
   - /multi-court-event/ is a fee calculator that ends in "Print / Save PDF". There's no send button.
   - /donate-scholarship/ says "fill out a short application", but there's no form on the page.
   - /contact/ has no form, only email addresses.
   - /peak-sponsors/ says to email the owner directly.
   - The site's five Avada forms keep no entries (they only email Peak). The one Ninja form (Volunteer) has 8 entries ever.
6. **Slow on phones.** The homepage autoplays a **14.1 MB** video (PEAK-FLIGHT-SOCIALNoAudio.mp4, size checked today). The 22 Oct audit measured the main image arriving in 5.9 to 14.3 s on a phone. Google's "good" line is 2.5 s.
7. **Hard to read.** Peak Cyan with white text has a contrast of **2.07:1**. WCAG AA asks for 4.5:1 on normal text, and the 22 Oct audit found failing cyan buttons and tap targets as small as 21 px.
8. **Out-of-date content.** /amenities/ still has a "Visit Vendor Website" button under the free coffee that links to ziggiscoffee.com. Ziggi's no longer provides the coffee. Two "Facility Construction Update" posts from June and September 2024 are still live, and the site doesn't mention Wellhub or Peak's own app (22 Oct audit; neither appears on any page today).
9. **Five different taglines** (22 Oct audit). Today's site alone says "Colorado Springs' Top Indoor Pickleball Club", "...Top Indoor Pickleball Facility" and "one of the largest privately owned indoor pickleball facilities".
10. **Security, a note for Wes.** The shared admin username shows publicly on every page, in the author byline and in /author-sitemap.xml. WP File Manager is switched on, and 4 plugin updates are waiting (23 Nov WordPress review).

---

## 3. The new site map

The backbone is **"NEW Peak Site Map 2026"**, last changed 15 Oct 2026 in Peak's shared library. It replaces the 14 Oct "Peak Site Map 2026", which had the same pages in a flatter order. The doc lists 31 entries under five menus, plus a site-wide **BOOK NOW** button to CourtReserve's public bookings page (app.courtreserve.com/Online/publicbookings/11811/landing).

**How to read the table.** "CR" means CourtReserve. Where Cammie's doc says "- court reserve", the item is a link into CR, shown as a card on its parent page rather than a page of its own. "Who" says who provides the content: Matthew drafts the copy unless it says otherwise, and Cammie approves everything.

**Site-wide:** a header with BOOK NOW (CR bookings) and "Try a free class" (the free-class page). A footer with the address, phone, hours (from the one source of rules), the privacy, terms and accessibility links, and Instagram and Facebook. On phones, a bar fixed to the bottom of the screen: Free class, Book, Call.

### Home
| Page | Purpose | Main call to action, and where it goes | Content needed | Who |
|---|---|---|---|---|
| Home | Say what Peak is in one screen and get first-timers to the free class | "Try a free class" goes to the Free Learn to Play page. "Book now" goes to the CR bookings page | A short hero video or still (compressed), the 4.9 stars from 587 Google reviews, one tagline, three paths (New to pickleball / Play / Host an event), photos | Cammie (photos, video, tagline choice); Matthew (copy) |

### Play
| Page | Purpose | Main call to action, and where it goes | Content needed | Who |
|---|---|---|---|---|
| Play (hub) | One place for every way to play, under the three subtitles from Cammie's map | A card per play type, each going to its own CR event list | A one-line description, who it's for, and a photo for each type | Cammie (photos); Matthew (copy); Tyler (any rules) |
| Play Schedule: Open, Social, Senior, Veterans, DUPR Play | Cards on the Play page (CR links, per Cammie's map) | Each goes to its CR event list | The CR list link for each. /play-pickleball/ already links 9 CR lists (free class, Open Play, leagues, clinics, a by-level session, juniors, Senior, rating-level play, social). Veterans Play has no link yet. Juniors is on the site but not on the map (keep it?) | Cammie or Peak staff (links) |
| Leagues | A real page to replace the /leagues/ redirect. It can hold the existing Peak Premier League page | "See leagues" goes to the CR league list | League formats, seasons, levels | Cammie or the league lead |
| Upcoming Tournaments | Tournaments ahead | Register, on CR or pickleballtournaments.com | The tournament list (the Golden Ring 2027 link already exists) | Cammie |
| Tournament Results | Past winners and photos | Share, or the next tournament | Results and photos per event | Cammie. Proposal: add in January if time runs short |

### Lessons & Learning (on the Play menu, per Cammie's map)
| Page | Purpose | Main call to action, and where it goes | Content needed | Who |
|---|---|---|---|---|
| **START HERE: Free Learn to Play class** | The most important page on the site (see §4). Ads and emails also land here | "Save my spot" goes to the CR free-class list (the link the site uses today) | Class times, what to bring (paddles and balls are provided), what happens after (Starter, if Peak agrees to show it), a short FAQ, real photos of a class with the coach | Cammie (photos); Tyler (the Starter offer); Matthew (copy) |
| Peak Pickleball University | What PPU is, a flow chart of how it works, the Professors, the classes, next steps (Cammie's list) | "Sign up for 101/102" goes to the CR PPU list | The flow chart (Matthew draws it; Cammie approves), the class list and price ($25 a class on /membership/ today) | Cammie, and the PPU lead |
| Book a Pro | Private and semi-private lessons | "Book a pro" goes to CR (the lesson booking link the site uses today) | Coaches, lesson types, **lesson prices** (none are on the site today) | Tyler (prices); the coaches (bios, photos) |
| Guided Open Play | Practice with a guide | Goes to the CR Guided Open Play list | Use the existing page copy | Already on the site |

### Events & Parties
| Page | Purpose | Main call to action, and where it goes | Content needed | Who |
|---|---|---|---|---|
| Events & Parties (hub) | The three subtitles from Cammie's map, as one page with sections | Each section's button | Photos of real events | Cammie |
| Upcoming Events / Club Celebrations | What's on, and the club's own celebrations | Each event goes to its CR event page | The events list. Proposal: a WordPress list Cammie edits, linked to CR | Cammie |
| Birthday Parties / Corporate Events & Team Building / Host an Event at Peak | Private bookings | **"Send an enquiry"**: a form that saves the entry and goes to the events inbox (see §4) | Packages, what's included, the price ranges Peak wants to show, photos. The multi-court fee calculator is folded in or linked | Tyler (packages, prices); Cammie (photos) |
| Private Members Hosted Group Play (Member-Hold) | Explain how a member holds courts for their group | Goes to the CR member reservation | The rules (from the one source) | Tyler |
| Fundraise with Peak / Community Group Events | Fundraisers and community groups | "Send an enquiry" form, as above | What Peak offers and any terms | Tyler and Cammie |

### Memberships
| Page | Purpose | Main call to action, and where it goes | Content needed | Who |
|---|---|---|---|---|
| Memberships | One plan ladder, from the one source of prices (§4) | "Join" goes to the CR public memberships page (on the site today) | Confirmed prices and rules for every plan; Wellhub; the app | **Tyler signs off every number** |
| FAQ | "All the common questions we get" (Cammie's map) | Links to the right page or to CR | The real questions the front desk and DMs get. The answers pull from the one source, so they can't drift | Cammie (questions); Tyler (answers on policy) |

### Beyond the Court
| Page | Purpose | Main call to action, and where it goes | Content needed | Who |
|---|---|---|---|---|
| Peak Fitness | Personal training and The Ernie (55+) | "Book" goes to CR (the existing Fitness booking link) | Use the existing copy and prices, checked | The Fitness lead |
| Peak Golf | The TrackMan simulator | "Book a bay" goes to CR (the existing link); peakgolf.us is linked | Rates (the site shows $50 an hour today) | Peak Golf |
| Give 'Em Heaven | The nonprofit, plus a link to its own site | "Visit Give 'Em Heaven" goes to giveemheaven.us; scholarship requests go to a real form | A short story and the scholarship application form fields | Scott (Exchange Ministries) |
| Partner with Peak | Sponsorships | **"Talk to us about sponsoring"**: a form that goes to the sponsor desk (§4) | The three tiers (Title, Court, Logo) as Brandon standardises them. **Proposal: no prices on the page** until his packages are settled (the page shows $12,000 and $24,000 today) | Brandon (packages); Cammie (sponsor logos) |
| Amenities | Whistle Pig, changing rooms, Dink courts and Pickle Wall, cornhole, ping pong, lounges, the mall food court (Cammie's list) | "Plan your visit" goes to Contact | Photos of each. The Ziggi's link removed | Cammie |

### Pages Cammie's map doesn't list (need a decision)
| Today | Proposal |
|---|---|
| /contact/ | Keep it as **Visit & Contact**: hours, map (only on this page), phone, and a contact form that saves entries |
| Privacy, Terms, Accessibility | **Add them.** They're required (§5) |
| /about/, /visit-the-pro-shop/, /senior-club/, /must-have-apps/, /peak-sponsors/ (sponsor list) | Keep, slimmed down, in the footer or under Beyond the Court. Senior Club folds into Senior Play. The apps page folds into Memberships and FAQ |
| /employment/, /volunteer-at-peak/, /become-a-pickleball-professor/ | Keep, in the footer under "Work with us" |
| /multi-court-event/, /picklefest-map/, /peakdb-court-reserve-watcher-privacy-policy/ | Keep as they are. They're tied to the custom plugin, PickleFest, and an app's required policy. Not in the menu |
| /resources/, /blog/, the two construction posts | Redirect: /resources/ to FAQ, the posts to /about/. Blog only if Cammie wants to keep one |

**Size: 20 pages at launch** (Home; Play and 3 league and tournament pages; Free class, PPU and Book a Pro; Events & Parties and 2 enquiry pages; Memberships, FAQ; Fitness, Golf, Give 'Em Heaven, Partner, Amenities; Visit & Contact), **plus 3 policy pages** and the kept footer pages. Guided Open Play stays as its existing page. The play types and event lists are cards linking to CR, not pages.

---

## 4. The conversion path

**1. Free class first (the data).** Peak's CourtReserve data, accounts created 11 Nov 2025 to 23 Sep 2026, first visit by type:

| First thing they did | People | Joined within 60 days |
|---|---|---|
| Free class (Learn to Play) | 745 | **31.9%** |
| Open Play / social play | 978 | 3.1% |
| Court booking | 1,226 | 2.0% |

- Of everyone who took the free class at any point, 45.6% went on to pay dues.
- 78.5% of free-class sign-ups attend.
- Most decide fast: 37.3% pay within 7 days.
- Sessions run 24 to 44% full in most months, so there's room for more.

**So every page has a route to "Try a free class"**, and the free-class page is the one the ads and emails land on. The "80% of class-takers become members" figure (2 Nov meeting) was Scott's own classes and isn't used.

- **Remove friction in CR (Tyler's call):** a first-timer needs a CourtReserve account and approval before booking (22 Oct audit). Ask whether approval can be skipped for the free class.

**2. Membership plan ladder, from one source.** Proposal: one "Peak facts" screen in WordPress holds every price, hour and rule. Every page and the FAQ read from it, so a change made once shows everywhere. Today's prices, as listed on /membership/ on 23 Nov, are **all for Tyler to confirm**:

- Free Learn to Play class
- **Starter, $35 a month** (for Intro grads; not on the site today)
- Play, $39 a month plus $7 an hour
- Flex, $99 (Mon-Sat 12-5 pm, Sunday all day)
- Unlimited, $159
- Platinum, $199
- Also: Student $9 (ages 14-22), Drop-In $12 an hour, PPU $25 a class

The rules to settle before launch:

- the family rate ($6 or $7)
- court cancellation (4 hours) and class cancellation (24 hours)
- membership notice ("cancel anytime", 15 days or 30 days)
- walk-ins
- guest pass blackouts
- the 5% military and senior discount
- the hours

The welcome emails get the same answers, so the site and Patch agree.

**3. Sponsor and event enquiries routed to the desk.**

- **Partner with Peak:** the form goes to partnerships@peakpickleball.us (the shared mailbox already set up) and onto the sponsor desk as a new lead. Brandon follows up. The desk intake is still to build; until then it's email only.
- **Corporate, parties, fundraisers and Host an Event:** the form goes to groupevents@peakpickleball.us, which is the address the contact page gives for group events today. Who answers it is question 11.
- **Contact and scholarship:** the forms go to info@ and to the Give 'Em Heaven contact.

**4. Forms that actually save entries.** Use **Ninja Forms**, which is already installed and already keeps entries (Volunteer: 8 kept), in place of the Avada forms, which keep none. Each form saves the entry, emails the right inbox and sends the person a confirmation. Spam protection is included. No new plugin is needed.

**5. Tracking.**
- **GA4** (the existing G-WDBWJ1Q6HN, so history carries over). Proposal: one event per action that matters:
  - `free_class_click` (any button into the free-class list)
  - `book_click` (court bookings)
  - `join_click` (memberships)
  - `generate_lead` (each enquiry form sent, labelled by form)
  - `call_click` and `email_click`

  These are marked as key events in GA4.
- **Meta Pixel** (the existing 624560343236394): a `Lead` event on the free-class click, as the Meta ad plan specifies, and `Contact` on enquiry forms. Only once the privacy policy is live.
- **UTMs** on every link Peak controls that points at the site: emails, ads, Instagram and Facebook bios, the Google Business Profile website link, and QR codes on signs and the TVs. The ad links use `utm_source=meta&utm_medium=paid&utm_campaign=free-intro-<month>`, from the Meta ad plan.
- **"How did you hear about us?" made required in CourtReserve** (a setting change, Tyler's call). It's blank on 4,761 of 5,014 accounts created since 11 Nov 2025. CourtReserve doesn't keep UTMs, so this answer is the only way to see where bookings came from once they leave the site.
- **What the site can't see:** the booking itself happens on CourtReserve. The site counts clicks into CR, and the weekly scorecard counts the bookings, attendance and joins from CR's data.

---

## 5. Must-haves

- **Privacy policy (before any ads, and overdue already).**
  - Meta's Business Tools Terms require "a clear and prominent notice on each web page where our pixels are used", including how to opt out.
  - Google's Analytics terms say: "You must post a Privacy Policy" that gives notice of cookies and discloses the use of Google Analytics.
  - Matthew drafts the policy, plus terms and an accessibility statement. **Peak's attorney reviews the wording; the legal text is Peak's.** Colorado privacy law is a question for the attorney, not this plan.
  - Linked in every footer.
- **Accessibility basics**, aiming at WCAG 2.2 AA:
  - text contrast of at least 4.5:1
  - real alt text on every image
  - headings in order
  - every form field labelled
  - keyboard focus visible
  - captions on any video with speech
  - tap targets no smaller than 24 px (WCAG 2.2's minimum; 44 px where possible)

  With Peak's colours, Navy (#1F3D67) or Black (#231F20) text on Peak Cyan passes (5.29:1 and 7.88:1). White on Cyan fails (2.07:1), so the cyan buttons get dark text.
- **Speed.**
  - No 14 MB autoplay video. Use a compressed short loop, or a still image with a play button.
  - Photos resized and served as WebP.
  - The map only on Contact.
  - Target: the main image under 2.5 s on a phone (Google's "good" Largest Contentful Paint). Tested with Lighthouse before launch, and the results recorded.
- **Mobile first.** Designed on a phone, with the fixed bottom bar (Free class, Book, Call). Peak tests on their own phones in week 4.
- **SEO carry-over.**
  - Keep Yoast and carry every page's title and meta description, rewritten only where the page changes.
  - Use the **Redirection plugin** (installed) to send every old URL to its new home: today's 33 sitemap URLs plus /leagues/. Nothing should return a 404 after launch.
  - Resubmit the sitemap in Search Console, then check for 404s weekly through January.
  - Keep the Google Business Profile link pointing at the home page or free-class page, with a UTM.
- **Brand package rules** (Peak_Pickleball_Branding_Package.xlsx):
  - Use the exact hex values: Peak Cyan #23C5E2 (main), Navy #1F3D67, Black #231F20, Dark Gray #5D6670, Medium Gray #BAC1C7, Light Gray #F3F5F7, White #FFFFFF.
  - Use only the supplied logo files: Primary "Fit", Swish, Stacked and Slogan, each in black and white.
  - The rule: *"Do not recreate, recolor, stretch, or alter logos without approval."* **Cammie approves every logo use on the site.**
  - The library has the logos as PNG only, though the sheet lists SVG and EPS. Ask Cammie for the SVGs (sharper and lighter on the web).
  - The sheet has no typography rules yet. Proposal: Matthew suggests web fonts and Cammie decides.
- **Real photos only.** Peak's own courts, coaches and players, with permission. No stock people and no AI images.

---

## 6. Platform decision

### Option A: keep WordPress and Avada, and redesign in place with Wes
- **Pros:**
  - No migration.
  - Wes knows the build.
  - The custom theme and the two custom plugins (Peak Instructor Dashboard and Peak Multi-Court Event Agreement) stay as they are.
  - The least can go wrong technically in five weeks.
- **Cons:**
  - Avada Builder is heavy.
  - Edits depend on the builder, and in practice on Wes.
  - The Avada forms keep no entries (they'd be swapped for Ninja Forms anyway).
  - The speed problems are partly in the build itself.
  - Whether Peak or Lighthouse holds the Avada licence is unknown.

### Option B: rebuild in WordPress with a lighter theme (recommended)
Same WordPress, same hosting, same domain, plugins, users, Yoast, Redirection, GA and Pixel. The new pages are built on a lightweight theme with WordPress's own block editor, on a **staging copy**, then switched over in one step.
- **Pros:**
  - Faster pages.
  - Cammie edits text, photos and events herself.
  - Keeps the URLs and SEO history.
  - Ninja Forms, the custom plugins and the tracking carry over.
  - The "Peak facts" screen works natively.
  - Wes stays involved for hosting and the custom plugins.
- **Cons:**
  - Every page is rebuilt. Avada Builder layouts don't carry over to another theme (Wes to confirm), so the content is re-entered.
  - Need Wes to confirm the two custom plugins don't depend on Avada.
  - More build work than A.

### Option C: another platform (for example a hosted site builder or a custom site)
- **Pros:**
  - Fast, with no plugin upkeep.
  - Peak's own account.
- **Cons:**
  - The two custom plugins wouldn't move and would need replacing.
  - A new host and bill.
  - DNS and SEO migration.
  - Cammie learns a new tool.
  - The most risk to fit into five weeks that include two holiday weeks.
  - Not recommended for 1 Jan.

### Dependencies on Wes (whatever the option)
- **Hosting:** the site runs on LiteSpeed at host.lwdserver.com, which is likely Lighthouse's server (unconfirmed). Peak needs SFTP or cPanel, or Wes to make a staging copy.
- **Avada licence:** who owns it, and whether it's kept if Option B leaves Avada behind.
- **Ownership:** a written confirmation that Peak owns the custom "Peak Pickleball" child theme and the two custom plugins, and what each plugin does and who uses it (the dashboard link on the Professor page is broken today).
- **Backups:** a full backup (files plus database) before any work starts, and how often the host backs up.
- **Housekeeping:** WP File Manager off, the 4 plugin updates applied, the shared admin password changed, and the username not shown publicly.

> **Recommendation: Option B, on a staging copy at Peak's current host, with Wes's help.** Decide by Mon 30 Nov. If Wes's access isn't in place by Fri 4 Dec, fall back to Option A: rebuild the most-used pages (home, free class, memberships, Partner with Peak, contact) inside Avada, add the policy pages, forms and tracking for 1 Jan, and move to B in January.

The 3 Nov quote ($3,000, six one-week sprints from access) covers the build. The build is inside Matthew's $300 a week (settled, Matthew 23 Nov); it isn't billed separately.

---

## 7. Timeline to 1 January

Six weeks from today, and two of them are holiday weeks (Thanksgiving, Thu 26 Nov, and Christmas, Fri 25 Dec). That's tighter than the six full sprints in the 3 Nov quote, so there's no slack. **Proposal:** launch Tue 29 Dec, keep 1 Jan as the hard deadline, and move anything not ready (Tournament Results, Club Celebrations, the blog) into January.

| Week | What happens | Needed from Peak that week |
|---|---|---|
| **1: 23-29 Nov** (Thanksgiving, short week) | The sit-down with Cammie on this plan. Tyler's approval. Wes intro. Content inventory of all 33 URLs. Redirect map drafted. | Cammie: site-map decisions (§3) and page priorities. Tyler: approval, and his OK to publish the privacy policy and fix the Ziggi's link on the current site now. Wes: the intro. |
| **2: 30 Nov-6 Dec** | **Platform decided Mon 30 Nov.** Staging copy made. The "Peak facts" price and rules sheet filled in. Home and free-class page designed. | **Tyler: one answer per price and rule (by Fri 4 Dec).** Wes: backup, staging and access. Cammie: approves the home design, logo use and tagline; SVG logos. |
| **3: 7-13 Dec** | Every page template built. Copy drafted page by page. Forms built (Ninja Forms). | **Cammie: photos and video (by Fri 11 Dec)** and copy approvals as they come. Brandon: sponsor tier wording. Tyler: party and corporate packages, lesson prices. |
| **4: 14-20 Dec** | Content in. GA4 events, Pixel, UTMs. Redirects loaded on staging. Privacy, terms and accessibility drafts. Speed and accessibility checks. **Peak tests on their own phones.** | Cammie and Tyler: test and send fixes (by Fri 18 Dec). Peak's attorney: the policy wording. Tyler: "How did you hear" made required in CR. |
| **5: 21-27 Dec** (Christmas, short week) | Fixes. Final approvals **by Tue 22 Dec**. Content frozen. Launch rehearsal on staging. | Cammie: final sign-off. Tyler: launch go. Wes: a launch time agreed. |
| **6: 28 Dec-1 Jan** | **Go live Tue 29 Dec.** Run the launch checklist. Watch the 404 log, forms and tracking daily to 1 Jan. | Someone at Peak on hand to test bookings from a phone on launch day. |

**The critical path:** Wes's access and a staging copy (week 1-2), then Tyler's single set of prices and rules (4 Dec), then Cammie's photos and copy approvals (11 Dec), then the attorney's policy wording and the phone testing (18 Dec), then final sign-off (22 Dec). A slip at any step moves the launch, and the holiday weeks can't absorb it.

**Go-live checklist**
- [ ] Full backup taken (files plus database) and restore tested
- [ ] Every old URL redirects: no 404s on today's 33 sitemap URLs and /leagues/
- [ ] Yoast titles and descriptions in place; sitemap resubmitted in Search Console
- [ ] Privacy, terms and accessibility pages live and linked in the footer
- [ ] GA4 tag firing; the six events seen in DebugView; key events marked
- [ ] Meta Pixel firing; the Lead event tested in Events Manager
- [ ] Every CR button opens the right list (free class, each play type, PPU, Book a Pro, memberships, Fitness, Golf, BOOK NOW)
- [ ] Every form sends, saves the entry, emails the right inbox and confirms to the sender
- [ ] Prices and rules match the "Peak facts" sheet on every page and in the FAQ
- [ ] Phones: iPhone and Android checked; main image under 2.5 s (Lighthouse); contrast and alt text checked
- [ ] Logos are supplied files only, approved by Cammie; exact hex colours
- [ ] Old Ziggi's link and the dated hotel links gone; no broken links (full crawl)
- [ ] The shared admin password changed; WP File Manager off; plugins updated
- [ ] The Google Business Profile website link updated (with a UTM)
- [ ] The changes log in the scorecard updated with the launch date

---

## 8. Open questions

Already asked in the 23 Nov emails, so not repeated here: the WordPress login, GA and Search Console access, hosting and backups, Avada and theme ownership, the custom plugins, WP File Manager and updates, the privacy policy OK, the Ziggi's line, the $6/$7 rate and 15/30 days' notice, required "How did you hear". (The $3,000 build question is settled: it is inside the $300 a week.)

**For Cammie**
1. Do you agree with the site map choices in §3? The CR links become cards. Which pages that aren't on your map do we keep, fold in or redirect?
2. Which tagline? "Learn. Play. Connect. Belong." is on your Slogan logo. The site uses three others.
3. Photos and video: which folders in the library are cleared to use (people's permission), and which events or classes need new shots before 11 Dec?
4. The SVG versions of the logos, and any fonts you want.
5. Do you want a blog or news section, or just events?

**For Tyler**

6. **Show Starter ($35) on the site** as the step after the free class, or keep it offered only after the class?
7. Can CourtReserve skip the account approval for the free class?
8. Lesson prices and party and corporate packages to publish, or "ask us"?
9. Sponsor prices on the Partner page: show them, or "talk to us" until Brandon's packages are set?
10. Is the walk-in answer "yes, with an account first"? And what are the holiday hours to show over Christmas and New Year?
11. Who answers groupevents@ and the new event enquiries, and how fast?
12. Who signs off the site: Cammie for content, you for prices and launch?
13. Does Peak's attorney need to review the privacy policy and terms, and who is that?

**For Wes** (once Tyler connects us; beyond what's already in the drafted email)

14. Do the two custom plugins depend on Avada, and who uses the Instructor Dashboard (its link from /become-a-pickleball-professor/ is broken)?
15. Can you make a staging copy on the current host, and is there room on the plan for it?
16. Option B leaves Avada: anything in Peak's setup that would break?

---

## Fact-check log

**Verified**

| Claim | Source, and when |
|---|---|
| Cammie's quote and her order (website, emails, ads) | Her 23 Nov email, as recorded in Matthew's Peak notes |
| The site map structure, 31 entries, the BOOK NOW link | "NEW Peak Site Map 2026.docx" from Peak's shared library (modified 15 Oct 2026), copied read-only and converted 23 Nov; matches the PDF in "Peak Website/". The file has no author field: "Cammie's site map" follows her brief |
| The older site map (14 Oct) | "Peak Site Map 2026.docx", same library |
| Brand colours, logo files and logo rule; no typography; PNG only | Peak_Pickleball_Branding_Package.xlsx and the Brand Kit folder listing, 23 Nov |
| 33 public URLs; /leagues/ redirects to /play-pickleball/ | The live sitemap (Yoast) and curl, 23 Nov |
| /privacy-policy/, /privacy/, /terms/ and /accessibility/ return 404 | curl, 23 Nov |
| GA G-WDBWJ1Q6HN and Pixel 624560343236394 on the site | wordpress-review-2026-11-23.md and meta-ad-plan (curl, 23 Nov) |
| $6.00 (FAQ) vs $7 (membership); 24 h (FAQ) vs 4 h (membership); "Cancel anytime" vs 15 days; walk-in text | Page text of /faqs/ and /membership/, 23 Nov |
| $7 in CourtReserve's plan text; the welcome emails' $6 and 30 days | patch-automations-2026-11-23.md |
| Court cancellation is 4 hours | Tyler, 11 Nov (Matthew's notes) |
| The plan prices listed | /membership/ page text, 23 Nov; Starter $35 from the CourtReserve sales data (meta-ad-plan, peak-baseline) |
| Starter appears on no public page | Searched all 33 pages, 23 Nov |
| Broken links /court-sponsor-package/, /professor-dashboard/ | Every internal link checked with curl, 23 Nov (38 unique links) |
| Hotel links dated 2025-07-17 and 2026-03-10 | The link parameters on the homepage and /amenities/, 23 Nov |
| The multi-court page ends in "Print / Save PDF"; no form on the scholarship, contact or partner pages | Page HTML, 23 Nov |
| Avada forms keep no entries; Ninja Volunteer form has 8 | Matthew's notes of the 23 Nov read-only WordPress check |
| 14,127,707-byte homepage video | HTTP content-length, 23 Nov |
| Ziggi's link under the coffee on /amenities/ | Page HTML, 23 Nov. The text now says "courtesy of Peak Pickleball"; the vendor button still links to ziggiscoffee.com |
| The admin username is shown publicly | The author byline on 32 pages and /author-sitemap.xml, 23 Nov |
| Contrast ratios (2.07, 5.29, 7.88:1) | Computed from the brand hex values with the WCAG 2.x relative-luminance formula. AA 4.5:1 from W3C WCAG |
| The conversion table, 45.6%, 78.5%, 37.3%, capacity, 4,761 of 5,014 blank | meta-ad-plan-2026-11-23.md (CourtReserve pull, 23 Nov) |
| The Week 0, 12-month normal and last-year figures | peak-scorecard-start-2026-11-23.md |
| 4.9 stars from 587 Google reviews | Google Business Profile, 23 Nov (scorecard) |
| Meta's notice requirement | Meta Business Tools Terms §3, as read 23 Nov (meta-ad-plan) |
| Google Analytics privacy-policy requirement | Google Analytics Terms of Service §7, marketingplatform.google.com, read 23 Nov |
| Hosting at host.lwdserver.com (LiteSpeed); WordPress plus the Avada child theme; 21 plugins incl. Yoast, Redirection, Ninja Forms, WP File Manager; 4 updates waiting | Matthew's 21 Nov outside check and wordpress-review-2026-11-23.md |
| The 3 Nov quote: $3,000, six one-week sprints | website-proposal-2026-11-03/ (the sent one-page version) |
| Thanksgiving Thu 26 Nov 2026; Christmas Fri 25 Dec; 1 Jan 2027 is a Friday | Calendar |

**From the 22 Oct audit, not re-measured today:** the phone timings of 5.9 to 14.3 s (Lighthouse lab runs, which vary run to run). Google PageSpeed was over its daily quota on 23 Nov, so speed gets re-tested in week 4. Also from the audit: the cyan button contrast of 2.8:1 and tap targets of 21 px, the five taglines, and the account-plus-approval step for first-timers in CourtReserve.

**Assumptions and proposals (not facts)**
- Who provides each piece of content is Matthew's proposal for the sit-down.
- The page count (20 plus 3 policy pages) depends on Cammie's choices in §3.
- The GA4 event names, Ninja Forms for every form, the desk intake (still to build) and the "Peak facts" screen are proposals.
- "Avada Builder layouts don't carry over to another theme" is the general way page builders work. Wes to confirm for this site.
- That lwdserver.com is Lighthouse WD's server is likely, not confirmed.
- The launch date (Tue 29 Dec), the decision dates and the fallback are proposals.
- The WCAG 2.2 tap-target minimum of 24 px is from W3C WCAG 2.2 (SC 2.5.8). 44 px is a recommendation, not a requirement.

**Unresolved**
- Whether the Starter plan should be public (Tyler).
- Who owns the Avada licence, the theme and the plugins (Wes).
- What the Instructor Dashboard does.
- The CourtReserve list link for Veterans Play, and whether Juniors stays.
- Whether the build is billed inside Matthew's weekly arrangement.
- Website traffic numbers (waiting for GA access).
