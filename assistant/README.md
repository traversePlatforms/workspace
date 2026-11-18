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
  - **"J.A.R.V.I.S. desk, sent to your laptop, a few minutes"** sends a ticket as Matthew to the Field app's help desk (`/api/rounds.php?action=helpsend`). help-watch on the laptop answers it, and the page polls for the reply.
  - The chips ("What's waiting?", "Morning check" and so on) and "Add … to groceries" answer from data already on screen. They make no model call.
- **Sending:** an email goes only through the reply sheet's Send, then a yes in the confirm, then `action=send` with `confirmed`. That is the same as the classic page. A reply into a staff member's J.A.R.V.I.S. thread also asks first, and is marked "Matthew:".
- **Panels and their sources:**
  - **01 Inbox:** "Needs you" (needs-a-reply mail across the inboxes, plus team requests waiting on him), then one folding row per inbox with its waiting count and draft badge. Source: `action=home`.
  - **02 Team requests:** the Field app's and the Houston install's `helplist`, read with Matthew's own sign-in in each app. A 401 shows "sign in to its app once".
  - **03 Today:** the overnight check comes from `action=jvstatus`. Outbox's sent, waiting and failed come from Outbox's own `api.php?action=state`. Peak desk follow-ups due and late come from the desk's `api/desk.php?action=data`, which is read only.
  - **04 Builds:** `jvstatus`.
  - **05 Calendar:** a placeholder for now, plus the "calendar" emails.
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
- **Test:** `node assistant/jarvis/tests/jarvis-test.mjs` runs on a throwaway copy, with a Gmail mock (`ASSISTANT_GMAIL_MOCK`, honoured only by PHP's own test server) and stub apps. It saves screenshots to `assistant/jarvis/shots/`.
