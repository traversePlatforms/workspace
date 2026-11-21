# J.A.R.V.I.S. in the apps (built 2026-11-21, TASKS JV-APPS)

Matthew, 21 Nov 2026: "I need Jarvis built into the post application, I need it built into the peak application. That way everyone has
access to a version of Jarvis they can use to make changes that they need. Also go ahead and build Jarvis into the Houston version." Then,
for Peak: "I need cai brandon and nneka to be able to make changes to the peak application ... not spend time fixing working as the
middleman between everyone".

The Sixfold field app's J.A.R.V.I.S. chat (rounds.php help.log, help-watch.sh) made app-neutral, for apps that are not the field app.

| File | What | On the server |
|---|---|---|
| `jv-lib.php` | the chat's store: help.log rows, photos, voice notes, PDFs; who sees what; the watcher's side (next, reply, transcript, attach, final-since) | a copy beside each app's API: `public_html/peak-desk-28d38d/api/jv-lib.php`, `post-calendar-tools/jv-lib.php` |
| `jv.php` | the watcher's tool over SSH: `php jv.php <peak\|posts> next\|count\|reply\|transcript\|attach\|final-since`, and `posts act` (below) | `jv-tools/jv.php` (beside public_html) |
| `jv-chat.js` | the page's chat: blue button, window, photos, voice notes, Earlier, Clear, Refresh now | `jv-chat.js` beside each page (minified) |

Each app keeps its own chat in its own data folder: `peak-desk-data/jarvis/`, `post-calendar-data/jarvis/` (help.log, help-files/<ticket>/).
Your own conversations; the app's admin (Matthew) sees everyone's. The watchers (`traverse/ops/help-watch.sh` on the laptop,
`help-watch-cloud.sh` on the cloud machine) find waiting chats through `api/help-pending.php?a=peak|posts` and handle them in `one_app`.
Replies go through `traverse/ops/jv-reply.sh <peak|posts|c-slug> <ticket> <status>`; status `matthew` also alerts Matthew in his own
J.A.R.V.I.S. desk (`jarvis-status.sh alert`).

## The three, and what each J.A.R.V.I.S. may do

- **Peak Sponsor Desk** (Cai, Brandon, Nneka, Lance; Matthew): a working session (Sonnet) with `traverse/ops/jarvis-peak-prompt.md`. Desk
  data as that person through `php desk.php as "<name>" <action>` (the button's own code; rows marked `via: J.A.R.V.I.S.`), bug fixes and
  normal changes (a field, a filter, a column, a template, wording, a small feature): tested with desk-test.mjs, deployed with
  `matthew/peak-pickleball-sponsorship/tools/deploy-desk.sh`, committed. To Matthew: sending email or texts, the blasts and Outbox, booking
  rules, deleting, prices and packages, accounts, drastic changes, other companies. `desk.php as` refuses those itself (REFUSED, exit 3).
- **Post calendar** (Jen and the client approvers; editors): a restricted session (Sonnet, no settings, no MCP) with
  `traverse/ops/jarvis-posts-prompt.md` whose only tool is `./jv-posts.sh` → `jv.php posts act <ticket> list|show|edit|date|undate|photo`,
  run as the person who wrote (their account's role and clients, re-read each time; only while that chat is being worked on): a draft's
  words, date and photo. It can never approve, publish, remove, or touch holds, roll forward, pins or connections; an edit to an approved
  post drops it to draft for the person's own tap. Pinned posts, rolling and held clients keep their dates.
- **Houston Lawn (test) install** (`c-houston-lawn-test`, Matthew only): from read-only to a working session with
  `traverse/ops/jarvis-houston-prompt.md`: that install's data, backup before each write, no code changes (shared by every edition); money,
  prices, accounts, payment connections, sending and deleting go to Matthew. Its chat is still the field app's (help-*.php --install=).

Matthew's own conversations (every message in them his) get his treatment in all three: Opus, `jarvis-matthew-prompt.md`, no app limits
(his standing rules still hold: approving a post stays his tap). Everyone else: Sonnet, 40 sessions a day per app (`JARVIS_APP_DAY_CAP`).

## Tests
- Peak: `node matthew/peak-pickleball-sponsorship/tests/desk-test.mjs --page dist/index.html` (the J.A.R.V.I.S. section: chat, who sees
  what, `as` and its refusals, jv.php, the screen).
- Post calendar: `node traverse/post-calendar/test/pc-test.mjs` (chat, scope, `posts act` and its refusals) and `pc-ui-test.mjs` (the button
  and window at phone size).
- Watchers: `bash traverse/ops/help-watch-cloud.sh --guard-test` (on the VM) and `bash traverse/ops/jarvis-cloud.sh test` (section 11b).
