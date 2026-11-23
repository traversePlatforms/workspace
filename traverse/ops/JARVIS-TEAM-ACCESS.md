# Who can do what through J.A.R.V.I.S.

Set by Matthew on 23 Nov 2026: "What she needs is just to be able to make the changes she needs to the app and calendar as she deems fit
... Anything that has major changes involved needs to come to me but she needs to be able to do what she needs to function." Each person
works through their own J.A.R.V.I.S. chat. Nobody on the team gets the cloud computer itself: it holds Matthew's codes, keys, pay note
and Surge's restricted notes.

| Person | Where | J.A.R.V.I.S. does for them | Comes to Matthew |
|---|---|---|---|
| **Jen McPherson** | Sixfold 365 app (office) | Her office work end to end (leads, quotes, scheduling, jobs, payments, receipts, single customer emails); price changes (never showing the math); data fixes, small bugs and contained new features, tested and deployed | Anything drastic or that could break the app: how leads, jobs, payments, forms, pricing or sign-ins work; deposit rules; customer-facing wording; accounts; refunds; deleting; other companies |
| **Jen McPherson** | Post calendar (Sixfold only) | Her posts as her (words, date, photo); fixes and contained changes to the calendar app for her work, tested and deployed | Approval and posting (never done for her: she taps Approve herself), the runner, other clients (Surge), accounts, anything that changes the calendar for others |
| **Brad McPherson** | Sixfold 365 app (crew side) | His jobs, time, photos, walks, schedule, stats, days off; small fixes and contained features on the crew screens | Everything outside the crew side (that's Jen's or Matthew's), and anything drastic |
| **Cai and Nneka** | Peak Sponsor Desk (sponsors and expos) | Sellers' work in the desk and small app changes, tested and deployed | Sending, email/booking settings, packages, proposals, signed deals, P&L, devices |

## How it's enforced

- **Sixfold app:** `traverse/ops/help-desk-prompt.md` (Jen's limits; Brad's "crew side only" section). Brad's chat exists only because his
  crew account has the `jarvis` switch on the server (`$acct['jarvis'][<id>]`, `jvCrew()` in api/rounds.php); other crew logins don't
  see the chat. Each help message records the writer's role.
- **Post calendar:** the cloud watcher gives a working session only when every person in the conversation is Jen's Sixfold-only client
  sign-in (`only_jen_posts`, role `client`, scope `["sixfold"]`); her rules are `traverse/ops/jarvis-posts-jen-prompt.md`. Anyone else
  (the editor, other clients) keeps the restricted session (`./jv-posts.sh` only). Her change requests on posts are also answered every
  10 minutes by `request-watch.sh` (VM timer `traverse-post-requests`).
- **Peak desk:** `traverse/ops/jarvis-peak-prompt.md`; `desk.php as "<name>"` refuses what isn't theirs.
- Each person sees only their own chats; Matthew sees all. 40 sessions a day per app for everyone but Matthew.
- Major changes: the session sets status `matthew`, which pings his phone and lands in his J.A.R.V.I.S. desk.
