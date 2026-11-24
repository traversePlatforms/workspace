# Outbox automations mock for Peak (24 Nov 2026)

A clickable mock of Outbox as Peak Pickleball's member-email automation tool, in place of Patch Retention. Matthew's own product (Outbox), with Peak as the client workspace inside it. For Matthew to review first. **Nothing in it sends, saves or reads real data.** Every screen carries the banner "Mock: nothing here sends. Sample data."

- **Private URL:** https://traverseplatforms.com/outbox-automations-mock-d34874/ (the folder name is also in `server/folder-name.txt`). The sign-in code is only in `~/.ssh/outbox-mock-code.txt` (0600), never in git or chat; the server keeps its sha256 (`'om|' . code`) only.
- **Server:** the same pattern as the Peak website mock. `public_html/outbox-automations-mock-d34874/` holds `index.php` (= `server/gate.php`) and `.htaccess` (= `server/htaccess.txt`). The files sit outside public_html in `~/www/traverseplatforms.com/outbox-automations-mock-private/site/` (0700/0600), with `config.php` (the hash) and `data/` (sessions, attempts). 10 wrong codes per IP per 15 minutes; byte ranges served.
- **No indexing:** noindex meta on the page, `X-Robots-Tag` from the gate and `.htaccess`, and `Disallow: /outbox-automations-mock-` in robots.txt (the prefix only). Backup of robots.txt before the change: `~/upload-backups/robots.before-outbox-mock-20261124.txt` (on the server and on the VM).
- **To update:** edit `site/`, then `tar -C site -cf - . | bash ~/jarvis/bin/sg.sh trav 'cd ~/www/traverseplatforms.com/outbox-automations-mock-private/site && tar -xf -'`. **To take it down:** delete both folders on the server and the robots line.

## Screens (hash routes in one page, `site/app.js`)

1. **Automations** (`#/automations`): Outbox's 23 Nov list view (its own stylesheet, `site/outbox-base.css`, copied from `public/index.php`), with Outbox's Peak accent. Summary strip, filters (Channel, Status, Type), search, sortable columns: Name, Channels, Enabled, Status, Type, Last run, Next run, Sent, Delivered, Opened, Clicked, Replies, Joined, Opt-outs, Bounces, Failed. The first four (free-class reminder and follow-up, new-member welcome: Running; new free-account welcome: Approved; Google review: Waiting for approval) above 13 drafts from `matthew/clients/peak-pickleball/patch-automations-2026-11-23.md`. Text is shown on every row as "Text · later".
2. **Drawer** (`#/automations/<id>[/flow|/stats]`): status and Enabled switch, How it works (WHEN / WHO / THEN / EXIT), and Messages, Flow (the free class: reminder, follow-up next morning, day 7 if not joined) and Stats (7 and 30 days, joined within 7 days from CourtReserve, per email, last sends with made-up names).
3. **Email editor** (`#/edit/<id>/<step>[/light|/full]`): subject, preview text, headline, body with `{first_name}` and `{class_time}`, one button (label and link), the Light / Full design switch with a live preview of each, Save and "Send me a test" (both do nothing), and the approval box (Draft → Waiting for approval → Approved → Running; "Cammie approves before it goes live").
4. **Approvals** (`#/approvals`): what's waiting for Cammie, and what's approved but not switched on.
5. **Results** (`#/results`): sends, clicks, opt-outs, members who joined, and a line against Patch's period.
6. **Settings** (`#/settings`): sending domain with SPF / DKIM / DMARC (example), unsubscribes imported from Patch, the CourtReserve connection (checks every 15 minutes, example), people and texts.

## Data

All numbers are made up and marked "Sample data" or "example". People are made up (Alex Sample, Jordan Example and so on). The email wording follows the write-up's style, rewritten as samples; prices, rules and anything Peak hasn't decided are in [brackets]. Peak's logo (`logo-fit-black/white.png`, `favicon.png`) and one photo (`open-play-action.webp`, the full-design hero) come from the website mock's `img/`; the same photo-permission note applies before anything is shown outside.

## Checks

- `node tests/click-test.mjs` (local copy on `python3 -m http.server 8787` in `site/`) or `CODE_FILE=~/.ssh/outbox-mock-code.txt node tests/click-test.mjs https://traverseplatforms.com/outbox-automations-mock-d34874/` (live: the sign-in form alone first, then every screen). 20/20 on 24 Nov.
- curl, 24 Nov: without the code every path returns the sign-in form; a wrong code 401; with it every file 200 with the right type, unknown paths 404, ranges 206.
- Screenshots in `tests/` (desktop 1440 px, phone 390 px), not in git.
