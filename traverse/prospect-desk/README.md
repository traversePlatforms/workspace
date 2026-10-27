# Traverse Prospect Desk (TR-21, built 2026-10-26)

Matthew's desk for selling Traverse: the Colorado companies by trade (roofing, roofing and solar, solar, pest, security, yards) from
the prospect list, worked like the Peak Sponsor Desk. Status from Not contacted to Customer, notes, next steps, contact details,
add a company by hand, knock a company off (No / Not now, one tap to undo), and email many companies at once.

- **Live:** https://traverseplatforms.com/prospects-47bfe6/ (also the fourth tab of the hub, `/hub-cc1f31de/`). Sign-in code for
  Matthew in `~/.ssh/traverse-prospects-code.txt` on the laptop; never printed. More codes: `php .../prospects-47bfe6/api/desk.php
  addaccount "Name" admin` on the server (prints the code once).
- **Files:** `app/` (index.html, api/desk.php, manifest, sw.js, icons from `tools/desk-icons.cjs`), `tools/build-seed.mjs` (the seed
  from a prospect CSV), `tools/push-seed.sh` (rebuild and upload the seed). Upload copy: `node shared/tools/minify-public.cjs
  traverse/prospect-desk/app traverse/prospect-desk/dist index.html sw.js`, then dist/index.html and dist/sw.js plus the rest of
  app/ to `public_html/prospects-47bfe6/`. `.public-path` holds the folder name.
- **Data:** `~/www/traverseplatforms.com/traverse-prospects-data/` (outside public_html): seed.json (company contact details: never in
  git or a public folder), events.log (everything done on the desk, append-only, replayed over the seed), queue.json, accounts,
  sessions. A new seed never drops desk history: ids are the state register's record numbers.

## Email to many

One message per company, written from the trade's template (Settings; merge fields {company}, {city}, {first}, {trade}), each to one
address (never everyone in To/CC/BCC). Matthew picks companies (from the Prospects filter, ticks, or the Email page's own filters),
reads every message, and taps Queue. The hourly cron job (`traverse/app/tools/morning-email.php`, in `sixfold-tools/`) runs
`desk.php sendqueue 10` in the background: weekdays 8 am to 5 pm Colorado time, about 2 minutes apart, at most the daily cap
(Settings; default 40, highest 80). Sent from m.sharpe@traverseplatforms.com through the same Gmail login as the website's demo
bookings (`traverse-site-private/site-config.php`).

- **Off until the postal address is set** (Settings): CAN-SPAM wants a physical postal address in every commercial email. A PO box or
  a registered mailbox is fine.
- Every message ends with the signature, the address and an unsubscribe link (also as List-Unsubscribe headers for one-click). The
  link works without a sign-in and marks the company never to be emailed again; "They said no more emails" on the desk does the same.
- Skipped at queue time and again at send time: no usable email, unsubscribed, an email whose domain cannot take mail (email_ok = no
  from the cloud check), knocked off, customers, already waiting.
- A Not contacted company moves to Emailed when its message goes. Stop on the Email page empties the queue.
- The starting templates are drafts: they describe the app plainly, claim nothing about anyone's results and name no data source.

## Tests

Harness (scratchpad `pdtest/desk-test.mjs`): php -S with `DESK_DATA` (throwaway data) and `DESK_MAIL_MOCK` (messages to a file;
nothing is sent), `DESK_ANYTIME=1` and `DESK_GAP` for the queue. 57/57 on 2026-10-26. Hub with the fourth tab: `ptest/hub-test4.mjs`
14/14. Node 24's fetch trips on big replies from php -S (it closes the connection): the test talks to the API with node:http.
