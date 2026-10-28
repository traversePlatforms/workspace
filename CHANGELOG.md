# Change log

One entry per day of everything Matthew and Claude changed across the sites, apps, posts and settings, newest first. Started 2026-10-27, at Matthew's request: "since we have a back up going on we should create a change log".

**Where the files are:**
- **The day's visual document:** `changelog/YYYY-MM-DD.html` and `.pdf` in this workspace, which is backed up. A copy goes on the Desktop in **End of Day Reports**.
- **The full detail of each change:** the git history (`git log`). Each entry here is the short version.

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
