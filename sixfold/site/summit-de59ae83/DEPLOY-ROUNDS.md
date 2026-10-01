# Door rounds — what to upload, and the one check that matters

**Built 2026-09-29. Nothing has been uploaded.** Phase 1 of
[ROUNDS-WEB-SCOPE.md](../../operations/door-territory/ROUNDS-WEB-SCOPE.md).

**Additive only.** Every file below is new. Nothing that already works on the site is
touched — in particular `api/submit.php`, `api/config.php` and `api/secrets.php` are not
modified, moved, or re-uploaded.

## ⚑ Phone numbers added 2026-10-01 — upload these two (SX-14)

| From | To | Note |
|---|---|---|
| `api/rounds.php` | `public_html/api/rounds.php` | over the existing one — adds the `phone` action |
| `summit-de59ae83/index.html` | `public_html/summit-de59ae83/index.html` | over the existing one — the phone field |

**Nothing to create by hand.** The first number saved creates `phones-<town>.log` in
`sixfold-data/rounds/`, beside the marks logs and outside `public_html` for the same reason.

**Why a separate log and not the door files:** the door files are rebuilt from county data
(as they were on 2026-10-01). Numbers stored inside them would be wiped by the next rebuild.
Keyed on door id in their own append-only file, they survive exactly the way marks do.

**What a crew member sees:** each door shows its number, a line saying where it came from
— *"Given at the door · 1 Oct 2026"* or *"Found on True People Search · last seen Aug
2026"* — and **"+ Add a phone number"** or **"Edit number"**. Booked quotes in the Done list
take a number too, since that is the moment one is usually handed over.

**⚑ Numbers are typed in by a person.** Nothing in the app fetches from a people-search site.
Automated pulling was declined on 2026-10-01 — blocked by the permission system as personal-
data harvesting, and against those sites' terms besides.

**⚑ The source field decides what you may do with a number.** *Given at the door* is consent.
*Looked up* is a cold call, and those doors carry an amber note: check the national and Colorado
Do Not Call lists before calling.

**Tested before shipping:** 32 checks against a scratch copy on real HTTP with throwaway codes
— save, read back, normalisation, eight refusals (bad number, bad source, bad month, unknown
town, path traversal, GET on a write), removal, marks unaffected, crew blocked from export,
admin export carrying five phone columns, log unreachable over HTTP. Then rendered at iPhone
width and looked at: no sideways scroll, inputs at 16 px so iOS does not zoom on tap.

**One known limit:** a phone save is not in the offline queue (that queue is mark-only and
would misread it). With no signal, the form stays open with the number still typed and asks
for a retry — nothing is lost unless the crew member navigates away.

**After uploading: flush the cache, then check plain against busted** — see below.

## ⚑ Quote build added 2026-09-30 — upload this too

Signing in now lands on a **tools chooser** rather than straight on doors. Two tiles: **Door
rounds** for everyone, **Quote build** for admins only.

| From | To | Note |
|---|---|---|
| `api/quote.php` | `public_html/api/quote.php` | **New.** Admin-only storage for rates and saved jobs |
| `summit-de59ae83/index.html` | over the existing one | The chooser |
| `summit-de59ae83/quote.html` | `public_html/summit-de59ae83/quote.html` | **New.** Generated — do not hand-edit |

**Nothing to create by hand.** `quote.php` makes `sixfold-data/quote/` itself on first write,
beside `sixfold-data/rounds/` and outside `public_html` for the same reason: this is the cost
model, the margins and saved customer quotes, and an `.htaccess` deny already failed once on
this host.

### The gate is a ROLE, not a code

Matthew asked for it locked to him while he tests it. **His six-digit code is not written
anywhere in the site** — putting a code into a file the web server serves is one
misconfiguration away from publishing it, and `rounds-codes.php` says of itself *"never commit,
never paste it anywhere".*

Instead the check is `role === 'admin'`, in **two** places: the tile is not rendered for crew,
and `quote.php` refuses them 403. The second one is what matters — a crew sign-in produces a
valid session, so hiding the button alone would protect nothing.

**To let Brad in later:** change his line in `api/rounds-codes.php` from `crew` to `admin` and
re-upload that one file. Nothing else changes. ⚑ Note that also gives him the doors admin view —
who marked what, the totals and the CSV export. If those need to be separate, the roles need a
third level rather than a second.

### ⚑ FLUSH THE CACHE FIRST, then check PLAIN urls

**Site Tools → Speed → Caching → Flush**, then hard-refresh. This is step one, not an
afterthought, and it bit on 2026-10-01: both files were uploaded correctly and the chooser still
did not appear, because SiteGround kept serving the previous day’s `index.html` on the plain URL.

**A cache-busted check cannot see this.** `?v=123` is a different URL, so it misses the proxy and
fetches the new file every time — the verification passes while every real browser gets the old
page. Check **plain AND busted** and compare:

```
curl -s https://sixfoldcolorado.com/summit-de59ae83/ | wc -c
curl -s "https://sixfoldcolorado.com/summit-de59ae83/?v=$(date +%s)" | wc -c
```

**Different byte counts mean the cache is stale.** `curl -D-` shows `X-Proxy-Cache: HIT` and a
`Last-Modified` from before the upload, which is the tell. API responses are not cached, so a
passing `quote.php` check proves nothing about the pages.

### Check it, in this order

```
curl -s -o /dev/null -w "%{http_code}\n" https://sixfoldcolorado.com/api/quote.php?action=me
```

**Expect 401** signed out. Then sign in as **crew** in a browser and load
`/summit-de59ae83/quote.html` — expect the page to replace itself with *"Your code opens door
rounds but not the quote build."* Then sign in as **admin**: the Quote build tile appears and the
page loads.

### ⚑ What the gate does NOT protect

**`quote.html` is an ordinary page and its source carries the default rate table** — $100 a
man-hour, 65 man-minutes a tree, the dump presets, the haul floors, the whole cost model as plain
JavaScript. Anyone who knows the `summit-de59ae83` URL can read it **without signing in at all.**

What the gate protects is the *saved* side: rates anyone has edited, and every saved job with its
customer name and price. Those live behind `quote.php` and outside the web root.

So the defaults rest on the same thing the doors page rests on: **the path being unguessable.**
That was accepted for a door list. Whether it is accepted for the margins is a separate decision,
and if not, the fix is to serve `LINES` and `COSTS` from `quote.php` too rather than baking them
into the page. **Not done, and worth deciding before anyone else is given the URL.**

### Keeping the two copies in step

`quote.html` is **generated** from `quotes/quote-engine.artifact.html` by
`sixfold/site/build-quote-page.mjs`. The artifact stays the single source of the pricing logic;
the generator changes only the two storage calls and the file download.

**Re-run it after any reprice, and re-upload**, or the site keeps quoting the old numbers:

```
node sixfold/site/build-quote-page.mjs
```

That is the v2/v3 trap in a new place. The artifact sat two days behind the file once and every
quote built in between was 43% low on labour. There are now **three** things that can drift —
the file, the artifact and the site — so a reprice means publish *and* regenerate *and* upload.

---

## Upload

| From | To | Notes |
|---|---|---|
| `summit-de59ae83/index.html` | `public_html/summit-de59ae83/index.html` | the crew page |
| `api/rounds.php` | `public_html/api/rounds.php` | the only thing that serves door data |
| `api/rounds-codes.php` | `public_html/api/rounds-codes.php` | ⚑ the live codes — see below |
| `data/rounds/*.json` | **`sixfold-data/rounds/`** — beside `public_html`, **NOT inside it** | the door lists |

**⚑⚑ CORRECTED 2026-10-01 — the door data goes OUTSIDE `public_html`.** This row used to say
`public_html/data/rounds/`, which is **where the data lived on the first deploy and is exactly
the location that leaked**: `/data/rounds/monument.json` returned **200 and served home
addresses to anyone**, because SiteGround did not honour the `.htaccess` deny. `api/rounds.php`
now reads `dirname(__DIR__, 2) . '/sixfold-data/rounds'` — a sibling of `public_html` that the
web server cannot serve at all. **The stale row survived the fix and would have walked the next
upload straight back into the leak** — as of 2026-10-01 that is 31,422 names and addresses.

**Upload the `.json` files into `sixfold-data/rounds/`, overwriting what is there.** No
`.htaccess` is needed there — nothing outside the web root can be requested. **After uploading,
confirm `https://sixfoldcolorado.com/data/rounds/monument.json` still returns 404.**

**⚑ `api/rounds-codes.php` is gitignored and holds the live codes.** It is not in the
repository; it is on this machine only. Treat it like `secrets.php`.

## The check that matters — do this immediately after uploading

Established practice on this site: **verify a live host by requesting what must be denied.**

```
curl -s -o /dev/null -w "%{http_code}\n" https://sixfoldcolorado.com/data/rounds/monument.json
curl -s -o /dev/null -w "%{http_code}\n" https://sixfoldcolorado.com/api/rounds-codes.php
curl -s -o /dev/null -w "%{http_code}\n" https://sixfoldcolorado.com/api/rounds.php?action=regions
```

**⚑ A status code alone does not answer this. Read the body.** Corrected 2026-09-30 after the
check was actually run against the live host for the first time.

### What the live host really returns, measured 2026-09-30

| Request | Got | Verdict |
|---|---|---|
| `/data/rounds/monument.json` | **404** | **Safe.** `/data/` 404s exactly like a path that does not exist, and this host *does* return 403 where it means it (`/api/` and `/api/.ratelimit/` both do). **The door JSON is not under the document root at all** — which is better than a 403, because there is nothing there to deny |
| `/api/rounds-codes.php` | **200, and zero bytes** | **Not a leak, but not the designed protection either.** PHP executes the file and a top-level `return` emits nothing, so the body is empty. **The `.htaccess` deny is not what is protecting it** |
| `/api/secrets.php` | **200, and zero bytes** | Same situation, same caveat |
| `/api/submissions.log` | **403** | **Safe, and this closes an assumption that had been carried untested since the app went live.** `.htaccess` deny *does* work for `.log` on this host |
| `/api/rounds.php?action=regions` | **401** | The sign-in gate working without a session |

**So the rule for this host is narrower than "SiteGround ignores `.htaccess`":** it honours a
deny for `.log`, and a `.php` file still answers 200 because PHP runs it first.

**⚑ The two `.php` secret files are protected by PHP executing them, not by any deny rule.**
That holds until the day PHP does not run for that directory — a handler misconfiguration, a
version change, a directory copied somewhere without the handler — and then `rounds-codes.php`
serves as plain text and **every crew code is public**.

**The fix is the one already applied to the door data: move it above the document root** and
have `rounds.php` include it by absolute path. Not urgent, not done, and it should be done
before the code list grows.

**When re-running the check, always fetch the body:**

```
curl -s https://sixfoldcolorado.com/api/rounds-codes.php | wc -c      # must be 0
curl -s https://sixfoldcolorado.com/api/rounds-codes.php | grep -c "'"  # must be 0
```

**A non-zero byte count on that first line is the emergency.** Change `session_key`, reissue
every code, and move the file above the document root.

## Also do

- **⚑ DO NOT put the path in `robots.txt`.** An earlier draft of this file said to add a
  `Disallow` line. That was wrong and would have defeated the point: **robots.txt is public**,
  so anyone reading `sixfoldcolorado.com/robots.txt` would be handed the address of the
  internal tool. The page already sends `noindex` and the API sends `X-Robots-Tag: noindex`,
  which is what actually keeps it out of search results.
- **Do not link the page from anywhere on the public site**, and do not mention the path in
  anything customer-facing.

## The codes

Six digits each, handed out in person or by a channel you trust — not in a group chat.

| Person | Role | What they see |
|---|---|---|
| Matthew | admin | everything, plus who marked what and the CSV export |
| Brandon | crew | neighbourhoods and doors |
| Brad | crew | neighbourhoods and doors |
| Nneka | crew | neighbourhoods and doors |
| Cai | crew | neighbourhoods and doors |
| Will D | crew | neighbourhoods and doors |

**Roster corrected 2026-09-30** — Nneka and Cai were already in `rounds-codes.php` and missing
from this table, and **Will D was added the same day**. The codes themselves are never written
here: this file is tracked in git, `rounds-codes.php` is not.

Adding or removing someone is one line in `api/rounds-codes.php`. Removing a code deletes the
way in; their past marks stay in the log under their name.

**If a code gets loose:** change `session_key` in that file. Every session everywhere ends and
everyone signs in again with new codes.

## Refreshing the door lists

```
node ../../operations/door-territory/build-walklist-pdf.mjs <area>.csv   # clustering
node ../../operations/door-territory/build-rounds-data.mjs              # writes data/rounds/
```
Then re-upload `data/rounds/*.json` only. **The marks log is never regenerated** — it lives on
the server and is the record.

## What was tested here, and what was not

**Tested against a real PHP 8.4 server before upload:** the sign-in gate refuses every action
without a session (401); a wrong code is refused; a good code signs in and marking works;
marks persist and carry the right name; a crew code is refused the admin report (403); a door
id containing `../` is refused; the sign-in rate limit trips after 8 tries (429); the CSV
exports cleanly; undo removes a mark.

**Not tested, because it cannot be from here:** whether this host honours `.htaccess` (the
curl checks above are exactly that test), the live PHP version, and real phone signal in the
neighbourhoods.

---

## ⚑ The folder name is deliberately meaningless

`/rounds/` was the first name and it was too obvious — guessable, and it announces that there
is an internal application on a customer-facing domain. The path is now
**`/summit-de59ae83/`**.

**This is not what protects the data.** The sign-in gate and keeping the door lists outside the
document root are what protect it, and both are tested. An unguessable path adds one thing on
top: nobody stumbles on it, and nobody browsing the site learns that the tool exists.

**Change it whenever you like** — rename the folder on the server and tell the crew. Nothing
else refers to it: the page reaches the API as `../api/rounds.php`, which works at any
single-level path.

**Hand it out as a bookmark or a QR code, not as something typed.** `brand/qr/build-qr.mjs`
already generates codes; one pointed at this URL, shown once, means nobody ever types it and
it never appears in a text message.

## What to upload for the 2026-09-29 revisions

| File | Where | Why |
|---|---|---|
| `summit-de59ae83/index.html` | rename `public_html/rounds` → `public_html/summit-de59ae83`, then upload into it | the no-answer section, and the new path |
| `api/rounds.php` | over the existing one | counts no-answers separately from done |
| `api/rounds-codes.php` | over the existing one | Brad's full name |

**Three states now, not two.** A **no answer** means nobody was home — that door is not
finished. It leaves the main list, so nobody re-knocks it the same afternoon, and lands in its
own **"No answer — try again"** section with the buttons still live. The neighbourhood card
shows it too: *"18 to knock · 5 to try again"*. **Quote booked** and **Not now** are done and
sit under **Done**.
