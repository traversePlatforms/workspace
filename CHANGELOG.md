# Change log

One entry per day of everything Matthew and Claude changed across the sites, apps, posts and settings, newest first. Started 2026-10-27, at Matthew's request: "since we have a back up going on we should create a change log".

**Where the files are:**
- **The day's visual document:** `changelog/YYYY-MM-DD.html` and `.pdf` in this workspace, which is backed up. A copy goes on the Desktop in **End of Day Reports**.
- **The full detail of each change:** the git history (`git log`). Each entry here is the short version.

---

## 2026-10-29 (Thursday)

**Sixfold 365 app** (Sixfold only)
- **Reschedule with deposit:** "Change or send again" on a booking with no signature and no deposit reopens it (old job off the board, new day held, the new form asks for a deposit). Jen rebooked Roy this way (Sat 31 Oct). Bookings with a deposit keep their day.
- **Crew notes** on a job: 1,000 characters (was 300). **Job photos:** Jen opens and adds them on the jobs she manages.
- **My stats** on Matthew's sign-in = his pipeline (leads, quoted, jobs landed, sold, rates, still open), counting only his own leads (website + Facebook 26 Oct to 27 Oct 5 pm): 15 leads, 3 jobs. Brandon and other admins keep door stats. **Computer side menu** scrolls on its own and carries My stats.
- **Fixed by hand:** Matt's Won ($359 front yard only, job with Brad 29 Oct); Alberto's email copied to his customer record (his duplicate web lead still open).

**Doors and data**
- **False "new owner" flags fixed** at the source (owner history keyed by town and door): Sixfold 1,278 → 4, each edition 1,314 → 4.
- **Group 2 measured layers** (lawn, trees, roof, sun) live on all six at 4:42 am; close-up roof photos by 6:30 am.
- **Roof material** diagnosed and re-run (Roofing and Solar, 62 towns; Greeley 0 → 20,054, Longmont 175 → 13,759). "Probably asphalt" for the 39 no-county towns stays off; Jefferson and Arapahoe records are TR-35.
- **Hail and wind history** backfilled statewide on Roofing (Oct 2021 to now; hail days 66 → 115). Server storm job memory limit before April 2027 is TR-37.
- **Lawn figures:** re-scored on 19 hand-measured lots (typical miss 24%, old figure 65%); the shared-lot rule fixed, 84,834 cards in 165 towns now show the newer figure (Sixfold + five editions).
- **Group 3:** stage A and 3b counted (223 new towns, 143,368 doors + 777 merged); stage B running on the cloud machine on Matthew's go, uploads by itself. The 13 counties with no statewide source are TR-36.

**Traverse editions** (deployed roles-email-import-1029; Sixfold unchanged)
- Roles (Setter and Technician added, per-trade names, server-enforced; team goals), seats (one admin free, over-seat email, super never counts), one phone + tablet + computer per sign-in, terms acceptance at sign-in, Setup › Email (own mailbox, signed copy + receipt templates), ways to pay (Venmo, Cash App, PayPal, Zelle, own link), Import (customers with plans, leads, past work; undo), one subscription per company. **Your costs** built, off (super only).

**Traverse launch and website:** first prospect emails held with no set time (queue empty). Website and legal pages rewritten to Matthew's wording (pricing: every plan every feature; Terms of Use v2, Subscription Agreement v3, cancellation, privacy, dated 29 Oct) and uploaded, still private. New clauses not attorney-reviewed.

**Sixfold 365 print and email:** event sign-up sheet (ZIP code, "Free quote" consent box, Englewood); Christmas concert ad, three versions, QR to 365aeration.com; Brandon + Jenn shared business card; /concert/ QR page live but unused; 2-day follow-up email drafted, to send from hello@365aeration.com (not sent).

**Clients and admin:** Peak sponsor leads PDF (Lost Island, Hanson Hot Spring Spas; business sources only); Apollo free account (company lookups only); door-list JSON gitignored; 1.4 GB snapshot cleared; cloud finishers wait on the phone hotspot.

**Evening (after the 6:16 pm report):**
- **Sixfold:** tonight's ad spend in Stats ($2,407.29 lifetime; form ad $972.63 / 64 leads, Messenger $1,265.38 / 103; both $81/day); the 8 pm email carried the 28 Oct figures. Randall Carrera off Matthew's pipeline (Send to = the new owner's lead).
- **Editions:** billing on in all five (live Stripe checked with no charge); new movers in every edition (county sale month, Sold tag and filter; 837k of 1.05M homes, 12 counties); Pest house facts (basement, crawl/slab, stories, walls; 755k); Security lot facts (corner, alley, dead end, nearest home, open space, water; 573k; road-behind hidden at ~55% precision); Solar production estimate (NREL PVWatts by area, laser-scan roof, stated shade cut; 674k); permits per trade + Solar roof age and largest hail (Denver, Aurora, Boulder, Longmont added; Aurora share-alike flagged); sales reps send agreements, Pipeline search and Last contacted, in-app email, Group 3 limited-data note, Spanish.
- **Every Colorado home in every edition** (1,093,827): stale index counts recounted, merge script fixed. **Nightly backups** now cover the five editions.
- **Weather:** one shared Colorado alerts call (was ~1,000), warning shapes on maps and houses, winter/wind alerts everywhere, alert links fixed, radar switch on the Doors map (auto-refresh, time, 1-hour loop), wildfires around each app's own towns. Hail timing for every town queued on the cloud machine; same-day hail queued (TR-38); Xweather and HailTrace/Verisk on Matthew's list.
- **Speed:** the towns list is built ahead every hour and after each deploy (was 7-23 s for the first phone); stats skips towns with no marks.

**Running overnight:** Group 3 stage B measuring, then automatic upload, Group 3 storm history, then hail timing; towns list warmed hourly; overnight check; server backup 2:45 am.

---

## 2026-10-28 (Wednesday)

**Sixfold 365 app** (live on Sixfold and the five Traverse editions unless marked)
- **Ad leads:** Facebook ad-form leads are Jen's again from 27 Oct 5 pm; Matthew keeps the ones he had contacted and every website lead.
- **Jen's lead logging:** several steps in one entry (texted, messaged, emailed, one call result); the buttons stay on quoted leads; one-tap voicemail notes; "Price ready" vs "Quote given (texted)".
- **Text the quote / Copy for Messenger:** on the lead card and in the Quote builder; logs the quote as given.
- **Custom quotes:** "Another service" with your own price in the Pipeline quote box; carries to the job, agreement and quote page.
- **Aerate-only price** in the Quote builder; **DIY comparison removed.**
- **One-off jobs:** "Another service" jobs and "+ Book a job" from a customer card.
- **Square:** payments can be tied to a visit on a customer card; Leann's $50 linked to her 27 Oct fall cleanup (her 4 Nov job stays unpaid).
- **Send to Jen** replaces Send to Cai on Matthew's own leads.
- **Schedule:** days-off list folded behind "See days off". **Work hours** card and **Team hours** view.
- **Exports** in seven CRMs' import layouts plus a general CRM file. **Address search** that handles any spelling.

**Doors and data**
- **Group 1 re-clip** by parcel number live (70,488 doors); measured layers uploaded.
- **Group 2:** 43 towns, 159,290 doors live on Sixfold and the editions; Sixfold now 1,091,895 doors. Lawn/trees/roof/sun measuring on the cloud machine (about Friday); close-up roof photos after.

**Traverse launch**
- Launch checklist page; first prospect emails moved to 10 am Thu 29 Oct with a hold; FAQ edits; Draft label off privacy and cancellation; screenshots retaken; "Send yourself a test" on the Prospect Desk; Website tab in the Hub. Opening the site waits on Matthew's go.

**365 website:** social footer (Facebook, Instagram, Google reviews, Nextdoor); QR pages' email to Matthew, call/text to Jen; quote page shows custom services.

**Clients and admin:** Horizon online-presence audit (5 pages); lead close rates and leaks double-checked; Randy's native seed pricing; Home Base rows.

**Running overnight:** Group 2 measuring; new-owner flag fix (rebuild + upload); roof material diagnosis (no live changes); 8 am launch pre-check.

---

## 2026-10-27 (Tuesday)

**Sixfold 365 app** (live on Sixfold and the five Traverse editions unless marked)
- **Monthly plans:** a plan box on customers and saved plans. The next visit moves by the plan's weeks when a job is done. Not charged automatically yet.
- **Visits:** jobs marked Done on the Jobs board now show under Visits.
- **Matthew's leads:**
  - Booked ones show in full to Jen and the office, and never in her Pipeline.
  - Send to Cai hands one of his leads to Cai only.
- **Brad's job lines:** "Work they want done" and "Work I'd suggest".
- **2-day follow-up email:** review link, Brad's suggestions, plans, and 10% off for every customer. Built and switched OFF.
- **Work hours:** on each person's profile; bookings outside them are refused.
- **Alerts:**
  - An alert bell and list in the app.
  - Crew alerts (new or moved job; not-done reminders at 7 pm and 9 am).
  - An office "not marked done" alert.
- **Brad's follow-up bookings:** "needs Jen" until she confirms, plus a To schedule list.
- **Aftercare any time:** Jen can send it whenever; with no mailbox she gets copy, Email and Text.
- **Receipts:** a Receipt button, check number and date received, and Email receipt. Zane's receipt was made by hand.
- **Do-it-yourself comparison:** staff only, in the Quote builder. It usually shows DIY as cheaper, so review it before use.
- **Newsletter:** a screen with approval, unsubscribe and the 1st-of-month send. Built, not sending; the November draft is loaded.
- **Seed cost:** $90 per 50 lb bag.
- **Phone and Tablet layouts:** fixed inside the hub.
- **Device QA fixes:** dark mode, touch targets, iPad.
- **Stats:** counts every-few-weeks plans.

**Traverse**
- **Free pilot replaced:** setup within 2 business days, then a 7-day money-back guarantee from go-live. The site, agreement version 2 and the attorney redline are done; version 2 needs the attorney's OK.
- **Prospect emails:** template version 4, with "locked in for life as long as you're with us". Company names are cleaned up, and the Email tab starts with nothing ticked.
- **Device sweep and speed:** a device sweep of 389 screens, Spanish text out of the page load, and old server backups packed up.

**Posts and content**
- **Posted:**
  - Sixfold 365 post 1 on Facebook and Instagram, 3:00 pm.
  - Surge post 6 on the Surge Inc Facebook page, 3:21 pm.
- **Scheduled:** an Instagram carousel of 6 lawn photos, Sat 31 Oct at 2:00 pm.
- **Facebook photos:** 6 job photos added to the Sixfold 365 page, with location data removed and no feed post.
- **Posting runner on the server:** approved posts go out at their time.
- **Surge:**
  - Surge has its own post layout.
  - The Surge Inc page is connected through the 365 Meta portfolio (separating them is TASKS SG-8).
- **Docs:** the client journey doc with its flowchart, and a photo ledger for posts.

**Email and admin**
- A Sixfold 365 email signature (in the admin footer).
- Six lead follow-up emails in Matthew's wording, ready to paste. Sent by Matthew.
- A note for Jen on setting up the monthly plan.
- Randy's quote plan.

**Matthew's assistant**
- **Grocery list:** shared with Claire, who has a list-only login. It's purple with a raccoon logo and shows King Soopers (Federal & Belleview) prices and a total.

**Laptop**
- **Power:** both power plans are set to never sleep, and closing the lid on the charger does nothing (Armoury Crate kept switching plans).
- **Background jobs:** the Google Drive backup was rerun (last night's was cut off).

**Code review (Fable, evening)** — all of today's code; 4 bugs fixed and deployed, none of which could have sent, charged or exposed anything. Report: traverse/CODE-REVIEW-2026-10-27-evening.md.
- A signed-out web hit could start the newsletter and follow-up sweeps (now command-line only).
- The unsubscribe page said "unsubscribed" when it hadn't saved (over the hourly limit).
- The post runner could repost the first pictures if a run died halfway (it now saves after each post).
- The grocery list hammered Kroger when a product disappeared (now one try per 10 minutes).
- **Left for Matthew:** unsubscribe on a plain link click (email scanners could trigger it), and Jen's quote login sees every crew follow-up.
