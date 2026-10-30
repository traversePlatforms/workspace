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

## Plain or With map (2026-10-30)

Matthew: plain text "reads as a phishing scam or a don't-click-that-link type email ... I am fine with trying out a halfway". A
per-send choice on the Email page (and on Send yourself a test): **Plain text** (the default until he picks; remembered on the device)
or **With map**. With map sends multipart/alternative: the exact plain-text email as today, plus a light HTML version that still reads
as a personal note: the Traverse wordmark, the same words (lists as lists, addresses as plain links), one map of the company's own
city, and a business signature (name, title, company, phone, email, website, small logo, postal address) from Settings. No tracking
pixel, no click tracking, no shortener, no buttons. About 4.5 KB of HTML; the map is hosted, not attached (lighter, no attachment
clip, shown inline in Gmail through its image proxy), and the email reads the same with images off (alt text says what the map shows,
and the caption is repeated as text under it). Tests get "(plain)" or "(with map)" at the end of the subject.

- **The maps:** `node traverse/prospect-desk/tools/build-maps.mjs` (about 30 s) writes `app/m/<family>-<city>-<yyyymmdd>.png`
  (840 x 588, 20-60 KB, gitignored) and `app/m/maps.json` (captions and counts, tracked), from the door files in the main tree. One
  picture per city and trade family: **hail** (Roofing, Roofing and solar, Solar): this year's radar hail paths, NOAA/NSSL MRMS
  (`hail-paths.json`), and the homes whose radar square had 1 in or more on any 2026 day; **moved** (Pest, Security): homes sold in
  the 12 whole months ending two months before the county file's date (recent deeds reach the files late), `moved-<town>.json`;
  **lawn** (Yards): homes with an estimated lawn of 5,000 sq ft or more (NAIP 2023, our measurement). Basemap: grey squares where homes
  are and U.S. Census TIGER/Line roads (public domain); no tiles. Nothing picks out a house: hail on the radar's ~1 km grid, counts in
  squares of at least ~470 m with 3 or more. Cities: Colorado Springs = the four cs- files, Denver = Denver + South Denver.
- **Falls back to plain** when the company's city has no picture for its trade (no file, under 300 homes, too little county sale
  data, or no home under 1 in hail this year: Boulder, Longmont, Fort Collins, Loveland, Grand Junction, Highlands Ranch ...). The
  preview says which go plain.
- The hail count is stricter than the door card's "near the house" rule (the 3 x 3 radar squares around it): Denver 31,772 in-square
  against 66,948 near. The caption uses the stricter count so it matches the picture.
- After a rebuild, upload `app/m/` (new names carry the date, so emails already sent keep their picture; don't delete old ones).

## Tests

Harness (scratchpad `pdtest/desk-test.mjs`): php -S with `DESK_DATA` (throwaway data) and `DESK_MAIL_MOCK` (messages to a file;
nothing is sent), `DESK_ANYTIME=1` and `DESK_GAP` for the queue. 57/57 on 2026-10-26. Hub with the fourth tab: `ptest/hub-test4.mjs`
14/14. Node 24's fetch trips on big replies from php -S (it closes the connection): the test talks to the API with node:http.
