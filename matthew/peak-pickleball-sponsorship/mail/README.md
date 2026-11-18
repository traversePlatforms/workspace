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
  - No open pixel. Every web address in an email goes through `r.php` so clicks are counted.
- **Commands (server):** `php cron.php run | stats | import | check | dns`. `setapp` and `setcode` read from a pipe.
- **Overnight check:** section 12 of `shared/tools/overnight-check.sh` prints `cron.php stats`.
- **Test:** `node matthew/peak-pickleball-sponsorship/mail/tests/mail-test.mjs`. It mocks Microsoft and uses throwaway data, and
  sends nothing.
