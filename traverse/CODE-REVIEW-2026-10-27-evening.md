# Code review, 27 October 2026 (evening)

Matthew asked for a run through everything committed on 27 October before he went to bed. This is what was checked, what was
found, what was fixed and deployed, and what is left for him.

**Short version:** four real bugs, all fixed, tested and deployed. None of them could have emailed, charged or exposed anything
tonight. The access rules for Jen's logins hold. The rest of the list is judgement calls, left alone.

Live state that matters tonight (read from the server, nothing changed): there is **no 365 mailbox on the server** (no
`sixfold-private/a365-mail.json`), so the follow-up email, the newsletter, emailed receipts and the aftercare email cannot send
anything yet, whatever the switches say. The follow-up switch is off. One social post is approved, Sixfold 365 photos for
Saturday 31 October, 2 pm.

## What was checked

Every commit from `9f1c151` (00:13) to `5da7aec` (21:55): the field app API (`traverse/app/api/rounds.php`, +1,049 lines),
the page (`traverse/app/summit-de59ae83/index.html`, +782), `billing.php`, the social runner (`tools/social-queue.php`,
`tools/meta-leads.php`), the assistant's grocery list (`assistant/server/private/lib/groceries.php`, `lib/kroger.php`,
`app.php`, `public/g.html`) and the Prospect Desk (`desk.php`). Read in full as diffs, then the helpers they lean on
(`webHide`, `webLead`, `leadsAll`, `quoteInbox`, `qMine`, `desk`, the throttle, the role gates, `sameOrigin`).

Specifically, for each of the questions in the brief:

- **Jen's office and quote logins and Matthew's unbooked leads.** Traced every path: `leads`, `myleads` (both strip them, and
  the Pipeline keeps even his booked ones out), `leadsAll()` (filters for office/quote/manager unless the lead has a job or was
  sent to that person), the by-id gate before the actions (`id`, `lead`, `job`, `cid`, `customer`: a hidden lead answers
  "Not found"), `schedview`/`jobs` (quote login sees her own and his booked jobs in full, everyone else's as Booked/Held),
  `search` (addresses only, no leads), `stats`/`results`/`customers` (go through `leadsAll`), the alerts list (`feedDerive`
  decides by role; new-lead alerts for Matthew's leads go to super only; the quote login's derived alerts use `qMine` or
  `quoteInbox`, which refuses his leads), `tosched`/`fuconfirm` (only leads in `leadsAll`), `receipt`, `jobwork`,
  `followupjob/send`, `aftercaremark` (all `desk()` or `qJob`, which is her own customer or one of his *booked* jobs). The
  `mhand` hand-over marks `owner` + `mhand`, and `sentToMe` opens it to that person only. No hole found.
- **Claire's grocery cookie.** `groAction` runs before the assistant's sign-in check but only for the twelve `gro*` actions;
  inside it `gropass`/`grousers` need Matthew's session, everything else needs `groAllowed()`. The cookie is an HMAC over
  name, expiry and password version with a secret in `config.json`; a new password bumps the version and old cookies die.
  POSTs go through `sameOrigin()`. Kroger keys never leave the server (only shaped product rows go out). Nothing else in
  `app.php` is reachable with her cookie.
- **The public unsubscribe link.** Signed per address (HMAC with the install's session key), so nobody can unsubscribe someone
  else; 30 hits an hour per client. One bug (below).
- **Crew doing office actions.** `fubook` needs `jobMine` (the crew on that job, or the desk); `jobwork` needs `jobOpen`;
  `hours` lets a person read and set their own only (an admin anyone's, a team runner their team's); `alert*` are each
  person's own list; the quote role's allow-list gained only what it needs. `receipt`, `followup*`, `tosched`, `nl*`,
  `billinglive/refund` all gate on desk/quote/admin/super as they should.
- **Secrets reaching a page.** Meta token stays in `meta-social.json` on the CLI runner; Kroger keys stay in `data/kroger.json`;
  Stripe only in `billing.php` server calls. `a365pricing` for office/quote now also returns the DIY retail prices (public
  store prices, by design) and still hides the internal math.
- **Emails, pushes, charges, posts.** Follow-up email: off by default, `followup.json` switch, no backlog (`done.at` before
  the switch-on time minus two days is skipped), 9 am to 6 pm, once per job, three tries an hour apart, Send now only while
  on, nothing without the mailbox or a review link. Newsletter: approval + mailing address + mailbox required, one issue per
  date, one log line per address so a cut run resumes without repeats, never twice (`sent.done`). Crew reminders: from
  27 Oct only, each fires once (`crew-reminders.json`), inside work hours. Stripe: refund only by the super admin, with
  `confirm`, only while `refundable` (paid, not refunded, before `live_at + guarantee_days`; before Mark live it stays open,
  as the comment says). Social runner: one run at a time (lock), `approved` only, 6-hour miss window. Two bugs (below).
- **PHP 8.2 and JS.** `php -l` clean on every PHP file (PHP 8.4 here). The page builds and minifies; the browser tests
  (DIY, frame) pass.

### Tests run

All in the scratchpad against the Roofing test copy (`edcheck`, php -S), after `build-editions.cjs` with today's code.

| Test | Before the fixes | After |
|---|---|---|
| plan-api-test | 22/22 | 22/22 |
| webjobs-test | 16/17 (1 env) | 15/17 (2 env) |
| mhand-test | 19/19 | 19/19 |
| followup-test | 48/48 | 48/48 |
| alerts-test | 24/24 | 24/24 |
| hours-test | 28/28 | 28/28 |
| receipt-test | 25/25 | 25/25 |
| crew-alerts-test | 14/14 | 14/14 |
| fubook-test | 18/18 | 18/18 |
| diy-test (with the summit page) | 15/15 | 15/15 |
| newsletter-test | 25/25 | 25/25 |
| aftercare-test | 14/14 | 14/14 |
| packages-test | 5/5 | 5/5 |
| frame-test | – | 5/5 |
| gro-test (real Kroger, throwaway copy) | – | 23/23 |
| **review-test** (new, the two rounds.php bugs) | 4/8 | 8/8 |
| **social-queue-test** (new, canned Meta answers) | 6/8 | 8/8 |
| **gro-backoff-test** (new, bogus Kroger keys) | 6/7 | 7/7 |

webjobs-test's failures are the shared test copy, not the code: it books a fixed day (10 Nov) that earlier runs of other tests
left held ("That time is held for Kit Tester's quote"; 14 "Kit Tester" leads in the copy's log). Each run of the suite leaves
more. Worth a `--fresh` option one day, not tonight.

## Findings, highest first

### 1. Fixed: a signed-out web hit on `?action=metapoll` ran the newsletter and follow-up sweeps
`traverse/app/api/rounds.php:1652`. The shutdown hook ("ensure booked customers, then the 5-minute job's extras") is registered
before the session check, so any visitor sending `?action=metapoll` got "Sign in first" (401) and the hook still ran
`followupSweep()` and `nlSweep()` from the web worker. What that could do: send an approved newsletter at the wrong moment,
from a web request with no one-a-second pacing (the `usleep` is CLI-only) and the web time limit, so a run could stop
mid-list. Nothing unapproved could go, and tonight nothing at all could (no mailbox). Medium.
**Fix:** the metapoll part of the hook runs only when `PHP_SAPI === 'cli'` and `SIXFOLD_CLI` is defined, which is how
`meta-leads.php` runs it. Test: a draft dropped in `newsletter-inbox/` is no longer imported by the web hit; the command-line
job imports it. Commit `d4efd63`.

### 2. Fixed: the unsubscribe page said "You are unsubscribed" when it had saved nothing
`rounds.php:3096` (`nlunsub`). Past the throttle (30 valid hits an hour from one client address, so a mail scanner or an
office NAT could get there), the write was skipped but the page still showed the success text. CAN-SPAM-wise that is the
worst outcome: the person believes they are off the list. Low likelihood, bad when it happens.
**Fix:** a throttled hit now says it was not saved and to try the link again in an hour or reply to the email. Test: 30 hits
with address A, the 31st with address B: B not saved and the page says so. Commit `8d508ba`.

### 3. Fixed: the social runner could post the same picture twice
`traverse/app/tools/social-queue.php:81`. The queue file was written once, at the end of the run. A run that died half way
(killed, a server restart, Meta hanging on an Instagram carousel: the `$ready` loop can wait two minutes per image and the
whole run twenty minutes or more) left every post `approved`, so the next run (five minutes later) posted the first ones
again. The same end-of-run write also clobbered any post added or held by hand while a run was going. Medium: it needs a
crash, but the window is long and the result is a public double post.
**Fix:** the file is written after each post, merged into the file as it is on disk at that moment (only posts this run took
out of `approved` are written over). `SOCIAL_QUEUE_FAKE` (tests only, an environment variable) answers the Graph calls from a
file so the test never touches Meta. Test: the old runner posted p1 twice after a mid-run death; the new one once, and a post
added and a hold set by hand during a run survive. Commit `086b294`. Uploaded to `sixfold-tools/social-queue.php` (backup in
`~/upload-backups/`, md5 matched). Saturday's post is unaffected (still `approved`, its time untouched).

### 4. Fixed: the grocery list could hammer Kroger
`assistant/server/private/lib/kroger.php:224` (`krRefresh`). The list page polls every five seconds. A picked product that
Kroger no longer returns (delisted, or Kroger down) stayed stale, so every poll from every open phone made a Kroger call,
over 17,000 a day per phone, against the public API's daily quota, after which prices stop for everyone. Low-medium.
**Fix:** a refresh is tried at most once every ten minutes (`data/kroger-refresh.json`); the last known price stays on the
item. Test with bogus keys: four polls, one try (was four). Commit `7cd544e`. Uploaded to `assistant-private/lib/kroger.php`
(backup kept, md5 matched, chmod 600 kept). The live grocery API answers as before.

### Left alone: judgement calls and notes

- **Unsubscribe by GET.** The link unsubscribes on a plain click. Some corporate mail scanners (Microsoft Safe Links and the
  like) follow every link in an email, which would unsubscribe the person without them knowing. The usual answer is a page
  with a button on GET and the RFC 8058 one-click only on POST (which the headers already offer). Changes behaviour; Matthew's
  call. `rounds.php:3091`.
- **`tosched` for the quote login** lists every crew-booked follow-up in full (name, address, notes), not only her own
  customers' as the schedule does. Today only Jen holds a quote login and the brief for the feature is "that info needs to
  get back to Jen", so this is as asked; it would matter if another quote login were ever made. `rounds.php:7301`.
- **Done job advances a customer's plan whatever the job was.** `custPlanAdvance` moves the next visit on for any job marked
  Done on a lead with an active recurring plan, so a one-off aeration for a customer on a monthly mowing plan pushes the
  mowing date. Matches what was asked ("a plan visit marked Done moves it on"); worth knowing. `rounds.php:1319`.
- **Refundable with no end while not marked live.** Until the super admin presses Mark live, `billingRefundable` is true for
  ever (by the comment, "through setup"). Fine while Matthew is the only one who can press either button.
- **In-app list for admin/super alerts only when push keys exist.** `adminAlert` and `superAlert` add to the bell list after
  the `pushVapid` check, so an install with no VAPID keys gets no list entry for those two; `a365Alert` does it the other way
  round. Every live install has keys. `rounds.php:407`, `:8168`.
- **Performance.** `leadsAll()` rebuilds its filtered list on every call and `webJobbedIds()` walks `jobsAll()` each time;
  both are called inside loops (`feedDerive`, `schedview`, `customers`). With the live data (108 leads, 79 jobs) that is a few
  thousand operations per call, not worth a cache tonight. If Sixfold's logs grow past a few thousand lines, cache both by
  file signature as `leadsAllRaw()` already does.
- **`ensureBookedCustomers()` still runs on any `metapoll` hit**, signed in or not, as it did before today. It only derives
  customers from booked leads; harmless, noted.
- **Not reviewed:** the two newsletter drafts' wording (`9a71c16`), the Surge post images and captions, the device-QA
  screenshots, the Peak desk screenshots. Content, not code.

## Deployed

- Field app, all six installs: `deploy-app.sh review-evening-2026-10-27` (backup first, safe extract, md5 of every placed
  file, each API answering 401 signed out). Result: "all checks passed", 58 files, MD5 MATCH (58), backup `before-review-evening-2026-10-27-20261027-223033.tgz`; page
  versions summit `ab568ba3bf6a`, roofing `c4e700d14178`, yards `1abd7aef915e`, solar `afaa981c5b86`, pest `a7e0648159ab`,
  security `7dbbafc1a6df`.
- `sixfold-tools/social-queue.php` and `assistant-private/lib/kroger.php`: uploaded by hand with a backup, temp names and an
  md5 check; permissions kept (600 on the Kroger file).
- Not touched: any data file, queue, log or live customer record. No email, push, charge or post was sent. The newsletter
  was neither approved nor sent.

## For Matthew to decide

1. Unsubscribe on GET vs. a confirm button (finding "Left alone", first bullet).
2. Whether the quote login should see every crew-booked follow-up or only her own customers'.
3. The 365 mailbox (`a365-mail.json`) is still not on the server: until it is, the follow-up email, newsletter, receipts by
   email and aftercare email all stop at "no mailbox" and the app says so. When it goes on, turn the follow-up switch on
   deliberately (it sends no backlog) and approve the November issue only after a test to yourself.

Tests: `scratchpad/review-test.mjs`, `scratchpad/social-queue-test.mjs`, `scratchpad/gro-backoff-test.mjs`, plus the helper
`scratchpad/nltoken.php`; the throwaway assistant copies (`gro-priv`, `gro-pub`, `grob-*`, `sq-priv`) were deleted.
