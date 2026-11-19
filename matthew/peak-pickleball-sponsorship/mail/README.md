# Peak outreach email (built 17 Nov 2026)

Hourly batches of plain-text emails from Matthew's Peak Pickleball Outlook mailbox to two lists from the Peak desk: sponsor
prospects and expo-space rental leads. Built on Matthew's ask of 17 Nov ("sending X amount out each hour until our list is tapped").
**Nothing has been sent. Each list starts PAUSED; only Matthew's Start on the page sends.**

- **Page (since 17 Nov evening): inside Outbox**, https://traverseplatforms.com/outbox-092b0f/ (the Peak section; see `assistant/outbox/README.md`). Outbox's sign-in is the way in; the old Peak code (`~/.ssh/peak-mail-code.txt`) is no longer used. The old address `/peak-mail-31dc56/` forwards to Outbox and keeps `oauth.php` (Microsoft's registered redirect), `r.php`, `u.php` and `cron.php` as pointers to the Outbox copy.
- **Where this source goes:** `public/` goes up as `public_html/outbox-092b0f/peak/` (built by `assistant/outbox/tools/assemble.mjs`, which adds a `site.php`). Without a `site.php` the same files still work stand-alone at `/peak-mail-31dc56/` (that is how the test runs them).
- **Data:** private data lives in `~/www/traverseplatforms.com/peak-mail-data/`
  (0700, never in git): app keys, sealed Microsoft token, hashed code, lists, `events.log`, `run.log`.
- **Microsoft:** the Entra app "Matthew outreach" in Peak's tenant. It uses delegated `offline_access User.Read Mail.ReadWrite Mail.Send`
  and redirects to `/peak-mail-31dc56/oauth.php`. If sign-in says *Need admin approval*, Peak's Global admin grants consent once
  (the page shows how).
- **Hourly run:** `sixfold-tools/morning-email.php` (the hourly SiteGround cron) starts `cron.php run` in the background. Each run:
  1. reads the inbox and junk folder for replies and bounce notices. It only reads; it never moves, marks or deletes mail.
  2. skips anyone the desk has since moved on.
  3. sends up to the hourly rate (default 12, max 30; 10 on the first sending day), spread over about 55 minutes. Sending runs only
     inside the window (Mon–Fri 9–4 Colorado time, with holidays off).
- **Safety:**
  - Start is refused while:
    - a template still says DRAFT
    - Peak's postal address is missing
    - Microsoft isn't connected
  - Editing a template, or a re-import that adds people, pauses a running list.
  - A list pauses itself if its bounces pass 8% after 20 sends.
  - Both lists pause if Microsoft blocks the mailbox.
  - Unsubscribed, bounced, STOP and hand-added addresses are never emailed.
  - Every web address in an email goes through `r.php` so clicks are counted.
- **Opens (18 Nov, a setting, on by default):** each email goes as MIME multipart/alternative: the plain text as before, plus the same words in HTML ending in a 1x1 image from `o.php`. First open, total opens and last open are counted per person; the page shows open, click, reply, bounce and booking rates per list. Opens are rough: Apple Mail loads the image as the email arrives (high), Outlook often blocks images (low). The image slightly lowers inbox placement. Off = plain text only.
- **Book a time (18 Nov, off until Matthew turns it on):** `{book}` in an email is the person's own link to `b.php`. They pick a tour or call time from the weekly hours in Settings (no calendar is read). A booking is logged (`booked`), goes on the Peak desk as a tour (`deskBooked`, Meeting / tour booked), and Matthew gets a short heads-up through the website's mailbox (`public_html/demo/_lib.php`, as Traverse's own notices). Replies are never moved or hidden: they stay in Matthew's inbox. Start is refused while an email has `{book}` and booking is off.
- **The Peak desk (18 Nov):** the sender requires the desk's own code (`public_html/peak-desk-28d38d/api/desk-store.php`):
  - the lists are read through it (the same reading as the desk);
  - after each send `deskEmailed` (ref = the send's own id, `pm-...`); a reply `deskReplied`, a STOP or unsubscribe `deskReplied(stop)` (Not now, back in 90 days, unless a person owns the company: then the owner gets a follow-up today); a bounce `deskBounced`; a booking `deskBooked`. All by "Peak email".
  - A desk write that fails never stops or repeats a send. It is logged (`desk` rows) and retried at the start of each hourly run (48 tries, then shown as given up). The page and Outbox say how many are waiting.
  - **Skipped** (a setting, on by default): a company someone owns (any owner but "Peak email"), or one a person touched in the last 14 days, as well as the desk stages beyond To contact (except Emailed / Contacted set by this sender). The counts are on each list ("Skipped on the desk: owned by someone, 3"), and each company is checked again just before its email.
- **Tour confirmations from the Peak desk (19 Nov 2026; OFF until Matthew approves the wording in the desk, More, Settings):**
  - When someone books, moves or cancels a tour with the contact's email and the box ticked, the desk (`app/api/tour-mail.php`) writes the email and a calendar invite. The .ics has one UID per tour and a SEQUENCE per version, with METHOD:CANCEL on a cancel.
  - `pmTourSend()` here sends it from this mailbox, once per ref. The check runs under a lock against `events.log` (rows `tourmail`).
  - It is outside the lists, the hourly rate and the sending window. No open image, no tracked links.
  - Outbox counts them and flags the ones not sent. Retry is on the tour in the desk.
  - A calendar's "Accepted:" answer is not read as a reply.
  - The wording and a sample invite are in `tour-confirmation-DRAFT.md`.
- **Commands (server):** `php cron.php run | stats | import | check | dns`. `setapp` and `setcode` read from a pipe.
- **Overnight check:** section 12 of `shared/tools/overnight-check.sh` prints `cron.php stats`.
- **Test:** `node matthew/peak-pickleball-sponsorship/mail/tests/mail-test.mjs`. It mocks Microsoft and uses throwaway data, and
  sends nothing.
