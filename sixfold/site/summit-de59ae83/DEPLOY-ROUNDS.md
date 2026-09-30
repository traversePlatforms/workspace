# Door rounds — what to upload, and the one check that matters

**Built 2026-09-29. Nothing has been uploaded.** Phase 1 of
[ROUNDS-WEB-SCOPE.md](../../operations/door-territory/ROUNDS-WEB-SCOPE.md).

**Additive only.** Every file below is new. Nothing that already works on the site is
touched — in particular `api/submit.php`, `api/config.php` and `api/secrets.php` are not
modified, moved, or re-uploaded.

## Upload

| From | To | Notes |
|---|---|---|
| `summit-de59ae83/index.html` | `public_html/summit-de59ae83/index.html` | the crew page |
| `api/rounds.php` | `public_html/api/rounds.php` | the only thing that serves door data |
| `api/rounds-codes.php` | `public_html/api/rounds-codes.php` | ⚑ the live codes — see below |
| `data/rounds/*.json` | `public_html/data/rounds/` | the door lists |
| `data/rounds/.htaccess` | `public_html/data/rounds/.htaccess` | ⚑ **upload this FIRST** |

**⚑ Upload `data/rounds/.htaccess` before the JSON files, not after.** Between the two there
is a window where 2,656 home addresses are downloadable by anyone who guesses the path.

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
