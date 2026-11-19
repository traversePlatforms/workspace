# Matthew's assistant

Matthew's own tool for both personal and business clerical work. It belongs to Matthew, not to Surge, Sixfold or Traverse. Started 2026-10-22.

**First part: email.** Every 10 minutes it checks each connected Gmail inbox and has Claude sort each new email: needs a reply, to do, calendar, waiting on others, for your information, receipt, newsletter, offer, or looks like spam. Where a reply is wanted, it writes a draft into that inbox's Gmail Drafts. **It never sends on its own.** Matthew reads each email in full in the assistant and replies there (2026-10-22): he can have Claude write or rewrite the reply, save it as a Gmail draft, or press **Send**, which asks "Send this reply to … from …?" first and sends from that inbox in the same thread.

**Ask (2026-10-22).** A chat with the assistant, from the **Ask** button in the top bar. Claude can see the waiting list, search every inbox (Gmail search), read an email, write a reply as a Gmail draft, and take an email off the list. It has **no send tool**: a reply it writes comes with a **Review and send** button that opens the same reply sheet, so sending is always Matthew's Send plus yes. Code in `private/lib/chat.php`; the conversation is kept in `data/chat.json` (last 40 turns, 12 sent each time); **New chat** clears it.

- Page: `https://traverseplatforms.com/a-e018bb82/`. Password only, after a one-time setup code.
- Inboxes (connected 2026-10-22): personal Gmail, Traverse, contact@sixfoldcolorado.com (his alone) and Surge (his choice, after I flagged it as employer mail).
- Claude: `claude-opus-5-5` through the official PHP SDK (`anthropic-ai/sdk`), with server-side fallbacks on. Sorting runs on `claude-haiku-5-5` (since 2026-10-22, about a hundredth of a cent an email; no fallback) at effort `low` with a JSON schema; drafts and Ask stay on Opus 5.5 at `medium`.

## Where things are

| | Repo | Server (`~/www/traverseplatforms.com/`) |
|---|---|---|
| Page and its door | `server/public/index.html`, `api.php` | `public_html/a-e018bb82/` |
| Code | `server/private/app.php`, `cron.php`, `lib/*.php` | `assistant-private/` (outside public_html, 0700) |
| SDK | `server/private/composer.json` | `assistant-private/vendor/` (`composer install` on the server) |
| Data | never in the repo | `assistant-private/data/` (0700; config.json 0600) |

Data files: `config.json` holds the password hash, the Anthropic key, the Google client and the settings. `accounts.json` holds each inbox's refresh token. `items.json` holds each email's summary for 21 days; the email itself stays in Gmail. `chat.json` holds the Ask conversation. `seen.json` lists message ids already sorted. `assistant.log` and `cron.log` are the logs.

**The 10-minute check.** The host has no `crontab` command. The check runs from the Facebook leads job (`traverse/app/tools/meta-leads.php`, every 5 minutes), every other round, in the background. It can move to its own job in SiteGround Site Tools later.

## Setup (Matthew, once)

1. Open the page, enter the setup code and choose a password (12+ characters).
2. **Anthropic:** console.anthropic.com → API Keys → create a key → paste it in Setup and save. Usage is paid per use.
3. **Google** (about 10 minutes, signed in as the Google account that will own the app):
   - console.cloud.google.com → new project "Assistant".
   - Turn on the Gmail API.
   - OAuth consent screen:
     - External.
     - Add the scope `https://www.googleapis.com/auth/gmail.modify`.
     - **Publish app (In production).** "Testing" signs you out every 7 days.
   - Credentials → OAuth client ID → Web application. Under authorised redirect URIs, add the address Setup shows.
   - Paste the client ID and client secret in Setup and save.
4. **Connect an inbox** for each address. Google warns the app is unverified: choose Advanced, then Go to Assistant. For Traverse and Sixfold (Google Workspace), first allow the app in that Workspace's admin console: Security → API controls → App access control.

## Rules

- Nothing is sent unless Matthew presses Send and says yes; nothing is posted or deleted. Gmail's scope is `gmail.modify`, which covers reading, drafts and sending but cannot delete mail for good. Each send is logged (inbox, recipient, subject) in assistant.log.
- An email is someone else's words. The prompts tell Claude to treat it as data and never follow instructions inside it.
- Keys are pasted into the page, never into chat, and are never returned to the page.
- **Next parts**, not built yet:
  - Socials through each platform's own API, with no Blotato.
  - eBay listings through eBay's Sell API.
  - Links to this workspace and to Claude Desktop.
  - Each will post only after Matthew approves it.

**As an app (2026-10-22).** `manifest.json`, `sw.js` and the navy route-mark icons (made with `traverse/editions/app-icon.cjs`, fill #13294b) let Chrome or Edge install the page as its own window with a taskbar icon, and a phone add it to the home screen. The worker stores nothing; with no connection it shows a "No connection" screen.

**Spending (2026-10-22).** Every call adds its cost to `data/usage.json` (this month, by sorting, drafts and Ask), worked out from Anthropic's token counts at the prices in `lib/claude.php` (`C_PRICES`: update them if Anthropic changes prices). The main screen shows "$X of $100 used this month" and warns at 80%; Settings has the breakdown and the monthly credit figure (Max 5x: $100).

**Which mail gets sorted.** Every 10 minutes, each inbox's mail from the last 3 days that is still in the Inbox, up to 20 per inbox per check, leaving out Gmail's Promotions, Social, Updates and Forums tabs (Settings). Done items leave the list; the rest drop off after 21 days. Ask can search all mail, not just the sorted list.

**The hub (2026-10-22).** `assistant/hub/` goes to `public_html/hub-cc1f31de/`: one installable window with three tabs: the field app (`/summit-de59ae83/`), the assistant and the Peak desk. They are all on traverseplatforms.com, so each loads in a frame (the apps send `X-Frame-Options: SAMEORIGIN`, which allows it) with its own sign-in. A tab loads when first opened and then stays loaded. Alt+1/2/3 switch tabs. To add an app, add a line to `APPS` in its index.html. The field app's edition switch moves only its own tab when it is inside the hub (the `ownFrame` check, 2026-10-22).

**Groceries (2026-10-27).** A shared grocery list, purple with a raccoon logo (Claire's favourite colour): add, check off, edit, remove, and clear checked.
- **Who gets in:** Matthew from the Groceries button (signed in). Claire with her own grocery-only password: Matthew sets it on the list page, and she signs in at `g.html`. Her sign-in is a signed cookie kept 180 days that opens only the list. Setting a new password signs her old devices out.
- **Prices:** King Soopers Federal & Belleview (store 62000109), through Kroger's Products API with Matthew's keys in `data/kroger.json` (0600, never sent to the page; his copy is `~/.ssh/kroger.json`). Tap Find price to pick the product; picks are remembered by the item's words (`data/gro-picks.json`). Prices refresh when they're over 6 hours old. The total uses the sale price when there is one.
- **Files:** data `data/groceries.json`; code `lib/groceries.php` and `lib/kroger.php`; page `public/g.html` plus `raccoon.svg`, `gro-icon-*.png` and `gro-manifest.json`.


**Caching (27 Oct):** SiteGround's front server hands plain files out with a 6-month cache and skips .htaccess. So `g.html`, `gro-manifest.json` and `index.html` are **chmod 600** on the server. Apache then serves them with "private, no-cache", so an upload shows at once. **Every upload of these files must chmod 600 again** (a new file lands 644).

## J.A.R.V.I.S., the merged page (2026-11-18)

Matthew: "Yeah I want it them merged together. It will give jarvis application more function other then just the chat feature." Design: direction A "Halo" from `design/mockups-2026-11-18/jarvis-hub.html` ("Definitely the halo version"). For Matthew only.

- **Where:** source `assistant/jarvis/` (`index.html` and `fonts/`). It goes up to `public_html/a-e018bb82/jarvis/`, inside the Assistant's folder, so the Assistant's sign-in covers it and it talks to `../api.php`. `index.html` is chmod 600, like the Assistant's. The hub's **J.A.R.V.I.S.** tab opens it. The **Assistant** tab is unchanged and still opens the classic page.
- **Two brains, always named on the command bar:**
  - **"Assistant, instant"** is the Ask chat (`action=chat`). It is called only when Matthew sends a question.
  - **"J.A.R.V.I.S. desk, sent to your laptop, a few minutes"** puts the message in J.A.R.V.I.S.'s own desk store (`action=jvdesksend`; since 19 Nov, see "Standalone" below; until then it was a ticket in the Field app's help desk). help-watch on the laptop answers it, and the page polls for the reply.
  - The chips ("What's waiting?", "Morning check" and so on) and "Add … to groceries" answer from data already on screen. They make no model call.
- **Sending:** an email goes only through the reply sheet's Send, then a yes in the confirm, then `action=send` with `confirmed`. That is the same as the classic page. A reply into a staff member's J.A.R.V.I.S. thread also asks first, and is marked "Matthew:".
- **Panels and their sources:**
  - **01 Inbox:** "Needs you" (needs-a-reply mail across the inboxes, plus team requests waiting on him), then one folding row per inbox with its waiting count and draft badge. Source: `action=home`.
  - **02 Team requests:** the Field app's and the Houston install's `helplist`, read with Matthew's own sign-in in each app. A 401 shows "sign in to its app once".
  - **03 Today:** the overnight check comes from `action=jvstatus`. Outbox's sent, waiting and failed come from Outbox's own `api.php?action=state`. Peak desk follow-ups due and late come from the desk's `api/desk.php?action=data`, which is read only.
  - **04 Builds:** `jvstatus`.
  - **05 Calendar (18 Nov):** the Traverse inbox's primary Google Calendar, read only, next 7 days (`jvCalendar()` in `lib/jarvis.php`, cached 5 minutes in `data/jarvis/cal-cache.json`), then the "calendar" emails. Matthew: "it should show my traverse one, which ill add both business and personal items to". **Connect Traverse calendar** posts `connect` with `cal`, which adds `calendar.readonly` to that one sign-in only (other inboxes stay Gmail-only) and returns to `jarvis/`. The account is marked `cal` from Google's granted scopes. Errors shown in the panel: Calendar API off in the Cloud project, or connected without Calendar.
  - **Groceries:** `action=gro`.
- **Crowding:** the inbox rows fold, and so does "Needs you" (4 shown). Each side panel folds into an icon on its edge, with a count. Folded and open state is kept per device in localStorage (`jarvis.fold`, `jarvis.open`, `jarvis.brain`). On a phone the panels become the Inbox, Team, Today and More tabs.
- **Laptop status:** `lib/jarvis.php` serves `data/jarvis/status.json` (0600), passing only whitelisted fields. The file is written by `assistant/jarvis/tools/jarvis-status.sh`:
  - `push` sends the last overnight check's ok count and PROBLEM lines plus the builds list. The overnight check runs it at its end, every 30 minutes, which also makes "Laptop online" true. The page treats anything over 45 minutes old as offline.
  - `build start|step|pct|done|fail|drop <id> …` is for a builder to call as it goes. Each change is pushed straight away.
- **Calendar, to switch on later:**
  1. Turn on the Google Calendar API in the Assistant's Google Cloud project.
  2. Add the scope `https://www.googleapis.com/auth/calendar.readonly` under Data Access.
  3. Add it to `G_SCOPES` in `lib/google.php`.
  4. Reconnect each inbox whose calendar should show.
  5. Have `jvStatus()` read the next events.
- **The eight (19 Nov, P-8; Matthew: "go ahead and add the 8 steps"):** all free; nothing here sends an email or a text, posts, or approves a post.
  1. **Laptop asleep warning.** `help-watch.sh` sends a heartbeat every 5 minutes while it runs and is not paused (`jarvis-status.sh beat` writes `data/jarvis/beat.txt`; any push counts too). Over 12 minutes old: "Laptop asleep since 6:32 pm: desk requests will run when it wakes", in the line under the desk switch, on top, and on the card when he sends to the desk. The Assistant (instant) works either way.
  2. **Meeting mode** (chip "Meeting notes"): the company first, from a fixed list (Surge, Sixfold, Traverse, Peak, Personal, Other + name; Send stays off until one is picked), then the notes (typed or dictated), sent to the desk as `[MEETING NOTES]`. The desk's rules are in `traverse/ops/jarvis-matthew-prompt.md`: folders per company (`personal/meetings/` is gitignored), to-dos in TASKS.md, follow-ups as draft files only, a short summary back.
  3. **Reminders** (panel 06, chip "Remind me…", or typed "remind me 4 Jan about reMarkable", read on the page with no model call; the Assistant has an `add_reminder` tool for anything else). Kept in `data/jarvis/reminders.json`, seeded once with the dated reminders from TASKS.md and memory. The 10-minute check (`cron.php`, on meta-leads.php) pushes each due one once to Matthew's phones through `jvpush.php`, which loads the Field app's own `helpAlertMatthew()` (the alert a desk reply makes, super admin only); it writes into no chat thread. Done and +1 day per reminder. Once the Traverse calendar is connected again with `calendar.events` (`calWrite`), each open reminder is also put on it, once.
  4. **Morning brief** (panel 04 and chip "Brief me", read aloud even with Voice off): today's Traverse calendar, reminders due and coming up, decisions waiting, team requests, builds, Outbox sent / waiting / failed / bounces (never clicks, replies or unsubscribes), Peak desk follow-ups.
  5. **Waiting on you** (panel 02): `assistant/jarvis/waiting.json` on the laptop (sessions add with `jarvis-status.sh waiting add`, drop with `waiting drop`), pushed in status.json. Approve / Decline with a note asks first, is kept in `data/jarvis/decisions.json` (`action=jvdecide`) and goes to the desk as `[DECISION] <id>`; one tap covers that one item. Items about approving a post or sending an email are refused by the script and dropped by the server.
  6. **Money** (panel 09): renewals and trial ends from the reminders; Traverse Stripe read only (`jarvis-money.mjs stripe`, the restricted key on the laptop, at most every 25 minutes: this month, available, pending); the Spend Ledger's totals (`jarvis-money.mjs ledger` with the artifact's `expenses` documents piped in; the server cannot reach the artifact). Numbers only; never a card, key, customer or his pay.
  7. **Remember this** (a button on every message and answer, and a chip): the text goes to the desk as `[REMEMBER THIS]`, which saves it into the Claude Code memory (one fact per file, MEMORY.md pointer, no duplicates) and says what it saved.
  8. **Driving mode** (the car button on top; Drive on the phone): four big buttons (Brief me, What's new, Remind me, Talk), the answers, everything read aloud; Talk sends what he says by itself; the mic reopens after a reply only with "Listen again" on (kept per device). iPhone: the first tap unlocks the voice; the ringer switch on silent can mute it (said on screen).
- **Standalone, off the Sixfold app (19 Nov, P-9; Matthew: "go ahead with moving the desk chats off sixfold app completely. Jarvis for me needs to be in stand alone thing entirely. So we need to make sure that it doesnt have any connect with sixfold. Jens still can obviously").**
  - **His desk chats** live in `data/jarvis/desk/` (`lib/desk.php`): `desk.log` append-only (msg, reply, status, transcript rows, the Field app's shape), `state.json` per thread, `files/<thread>/` for photos, voice notes and PDFs (0700/0600, served only to his session by `action=jvdeskfile`, voice notes with byte ranges). Page actions: `jvdesk` (list), `jvdesksend` (new or more: text, up to 4 photos, one voice note; the Field app's limits; 60 an hour), `jvdeskclose`. The thread opens in full inside J.A.R.V.I.S. (photos, voice notes with their words, PDFs, inline reply with Photo and Voice note); `?desk=<id>` opens one (what an alert opens).
  - **The laptop:** `help-watch.sh` looks every 5 s at `api.php?action=jvdpending` with the laptop key (header `X-Jarvis-Key`; the key is in `~/.ssh/jarvis-desk-key.txt`, the server keeps only its SHA-256 in `data/jarvis/desk/laptop-key.json`; wrong keys count as wrong sign-ins), and over SSH while HTTPS is captcha'd (a 4th count on the stream). It takes the thread with `php assistant-private/jvdesk.php next` (also `count`, `reply`, `attach`, `transcript`, `final-since`, `import`, `setkey`, `push-state`), runs the same session (his prompt, Opus, the quick pass), and the session answers with `assistant/jarvis/tools/jarvis-reply.sh <id|main> answered|working|matthew [refresh] [--pdf f]` (HTTPS with the key, SSH if that fails). `main` = his main thread h202611181123486ccb (moved over with its history). `jarvis-status.sh alert "<text>"` posts there for builders and the overnight check. `traverse/ops/help-reply.sh` sends any reply to a moved thread (`assistant/jarvis/tools/desk-moved.txt`) on to jarvis-reply.sh, except when the watcher is answering a message written in the Sixfold app itself (`HELP_REPLY_SIXFOLD=1`).
  - **Phone alerts, its own:** Web Push from this server (`lib/webpush.php`, a copy of the Field app's plain-PHP Web Push) with its own VAPID key (`data/jarvis/push-vapid.json`, made once, never replaced) to the devices he turns on (`data/jarvis/push-subs.json`; bell in the top bar, or More, "Phone alerts and the app": Turn on alerts, Send a test, Turn off here). `jvPush()` sends desk answers (not `working` notes), reminders and builder alerts. Until a PHONE has subscribed, the old route (`jvpush.php`, the Field app's Matthew-only alert) runs as well; once one has, only Web Push. iPhone: alerts only from J.A.R.V.I.S. added to the Home Screen (said on screen).
  - **Its own app:** `jarvis/manifest.json` (name J.A.R.V.I.S., id, start_url and scope `/a-e018bb82/jarvis/`, standalone), `jarvis/sw.js` (scope jarvis/ only: install, push, a tap opens J.A.R.V.I.S. at the thread; keeps nothing), icons from the hub's halo mark (`tools/make-icons.cjs`). Chrome/Edge install it as its own window; iPhone: Safari, Share, Add to Home Screen. The hub's J.A.R.V.I.S. tab still works. Top bar adds **Posts** (`/posts-ab8c57/`) and the **Sixfold app** (`/summit-de59ae83/`), each in a view with its own sign-in.
  - **Still touching Sixfold, by his choice:** Team requests (the Sixfold and Houston staff chats, read with his own Field-app sign-in, replies into them asked first), the Sixfold inbox, Sixfold in Brief me and the Outbox numbers. His own old Sixfold tickets are left out of Team requests (they moved).
  - **Moved 19 Nov:** his own tickets from the Sixfold app's help.log (every message his) were copied into the store with their files (`jvdesk.php import`, each row once, `src: sixfold`); help.log itself was not rewritten: each moved ticket got one closing status row there (the Field app's own `closed`), so it leaves the open list in the Sixfold app.
- **Test:** `node assistant/jarvis/tests/jarvis-test.mjs` runs on a throwaway copy, with a Gmail mock (`ASSISTANT_GMAIL_MOCK`, honoured only by PHP's own test server) and stub apps. It saves screenshots to `assistant/jarvis/shots/`.
