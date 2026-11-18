# Outbox (built 17 Nov 2026)

One private page for every email Matthew's tools send by themselves. Matthew asked for it on 17 Nov: "Can we make this peak email automatic url. attach to my hub. And can we build out the same thing for the sixfold automated emails we do? and just attach it to the same url. call it something else not peak related". Asked which emails: "Any email (and soon maybe text messages) that we automate".

- **Page:** https://traverseplatforms.com/outbox-092b0f/. It is also the **Outbox** tab in the hub (the last tab, Alt+8).
- **Sign-in:** one code, Matthew's. It is stored only in `C:\Users\Matthew sharpe\.ssh\outbox-code.txt` and is never printed. The server keeps only a hash of it, in `~/www/traverseplatforms.com/outbox-data/code.hash` (0700, never in git). The sign-in lasts a rolling year.
- **Sections, one per business, never mixed:**
  - **Peak:** the Peak outreach sender, with all of its controls. Source is `matthew/peak-pickleball-sponsorship/mail/public/`, which goes up as `outbox-092b0f/peak/` with `peak-site.php` as its `site.php`. Its data stays in `peak-mail-data/`.
  - **Sixfold:** read only. Shows aftercare, the two-day follow-up, deposit reminders, the signed copy, the newsletter, the website-form email, the morning email, the end-of-day report and the Saturday weekly, and the monthly profit email.
  - **Traverse:** read only. Shows the Prospect Desk, demo booking emails, sign-up and setup emails, notes to Matthew, the client apps' end-of-day and care emails, and the post calendar alert.
  - **Texts:** nothing is automated yet.
- **How the read-only sections work:** they read each sender's own log and switch files on the server (`lib.php` names every file). Nothing in Outbox can change what Sixfold or Traverse sends.
- **The old address** `/peak-mail-31dc56/` keeps working:
  - `index.php` forwards to Outbox and `api.php` answers 410.
  - `oauth.php` is Microsoft's registered redirect. It, `r.php`, `u.php` and `cron.php` are one-line pointers to the Outbox copy, so the hourly cron and the overnight check need no change.
- **Microsoft redirect:**
  - Outbox's Peak section switches between the old registered redirect and Outbox's own, `https://traverseplatforms.com/outbox-092b0f/peak/oauth.php`.
  - Switch only after that address has been added in Entra (App registrations > Matthew outreach > Authentication).
- **Build and upload:**
  1. Run `node assistant/outbox/tools/assemble.mjs <out>`. It writes `<out>/outbox-092b0f/` and `<out>/peak-mail-31dc56/`.
  2. Upload each folder with `~/bin/safe-extract.sh`, after a backup in `~/upload-backups/`.
- **Command line (server):** `php outbox-092b0f/cli.php summary | check | setcode`. `setcode` reads the code from a pipe.
- **Tests:**
  - `node assistant/outbox/tests/outbox-test.mjs` runs on throwaway copies of every log. It sends nothing and calls no Microsoft address.
  - `node assistant/outbox/tests/hub-tabs-test.mjs` checks that every hub tab opens in headless Chrome. Add `HUB_URL=...` to check the live hub's tab list.
  - The Peak sender's own test is `matthew/peak-pickleball-sponsorship/mail/tests/mail-test.mjs`.
