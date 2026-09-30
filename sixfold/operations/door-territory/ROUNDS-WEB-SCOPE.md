# Door rounds on sixfoldcolorado.com — scope

**Written 2026-09-29.** Nothing built, nothing uploaded. This is the decision document.

**The question:** the Claude artifact works, but marking a door needs a Claude account and a
seat. A crew cannot use that. Can the same thing live on the site instead?

**Answer: yes, and it fits what is already there better than expected.** The site already runs
PHP with the exact storage and protection patterns this needs. Nothing new is bought.

---

## ⚑ The one thing that decides the design

**This puts 2,656 households — names, home addresses, lot sizes — on a public web server.**

The artifact is private by default and limited to people invited to it. A page on
`sixfoldcolorado.com` is reachable by anyone who finds the URL. That is a different kind of
exposure from a printed sheet in a truck, and it is the constraint every choice below answers to.

**Three rules fall out of it, and none is optional:**

1. **Nothing renders without a valid session.** No "secret URL" — a link shared into a group
   chat, forwarded once, is public forever and cannot be recalled.
2. **The phone never receives the whole list.** One neighbourhood at a time, fetched after
   sign-in. A leaked session then exposes ~26 doors, not 2,656.
3. **`noindex`, `robots.txt` disallow, and no link to it from anywhere on the public site.**

---

## What it is

Four small pieces, all in patterns the site already uses.

| Piece | What it does |
|---|---|
| `/rounds/` | The crew page. Sign in, pick a neighbourhood, mark doors. One HTML file plus its own CSS/JS. |
| `api/rounds.php` | Answers: sign in, list neighbourhoods, fetch one neighbourhood, record a mark. |
| `data/rounds/` | The door lists and the marks. Outside the document root, or `.htaccess`-denied. |
| `build-rounds-data.mjs` | Turns the `*-areas.json` sidecars into what the server reads — same clustering as the printed sheets and the artifact. |

### Storage — no database needed

The site already writes `submissions.log` with `FILE_APPEND | LOCK_EX` and runs a flock'd
rate-limit store. The same approach carries this:

- **Door lists: read-only JSON per region**, regenerated on deploy. Never written at runtime.
- **Marks: an append-only log**, one JSON object per line — door id, outcome, who, when.
  Append-only with `LOCK_EX` is safe under concurrent writers and cannot be corrupted by two
  crew marking at once. Current state is the log replayed; compaction is a later nicety.

**⚑ No MySQL, no SQLite dependency.** Neither has been confirmed available on the host, and
designing around plain files means it does not matter. If volumes ever justify a database, the
log is trivially importable.

---

## ⚑ The decision I need from you: how people sign in

**Recommendation: a short personal code per person, not one shared crew link.**

| | Shared link or one crew PIN | A code per person |
|---|---|---|
| Setup | nothing | you add a name + code, once per crew member |
| Who marked a door | **unknowable** | on every mark |
| Someone leaves | change it for everyone | delete their code |
| Leak | everything, permanently | one code, revoked in seconds |
| Crew effort | same — type it once, stay signed in | same |

The cost is one line per person in a config file. What it buys is **attribution**, which is
also what makes the knock-to-quote rate real: without it you know 40 doors were knocked, not
who knocked them or how their rates differ. **That is the number the whole exercise exists to
produce**, so the cheap option quietly removes the point.

Codes are checked server-side, rate-limited on the pattern `api/.ratelimit` already uses, and
exchanged for a signed session cookie so the code is typed once a season, not once a door.

---

## What the crew gets

Same shape as the printed sheet, because they will be holding both:

- Sign in once. Stays signed in.
- Pick a neighbourhood — name, doors left, average lot size.
- Each door: address, acres, owner. **Quote booked / Not now / No answer.**
- A marked door leaves the list. Undo is there for a mis-tap.
- Two people in the same neighbourhood see each other's marks within a few seconds.

**⚑ Signal is real and the design has to admit it.** Past Woodland Park there are dead spots.
Marks queue in the browser and send when signal returns, and the page says plainly when
something has not sent yet. **It never claims a mark is saved when it is not** — that is the
failure that would make the crew stop trusting it. The paper sheets stay the fallback.

## What you get

- Live progress per neighbourhood without asking anyone.
- **Knock-to-quote by person and by neighbourhood** — the thing nothing currently measures.
- A CSV export of everything, for the quote engine and for me to read.

---

## Effort, honestly

| Phase | What | Rough size |
|---|---|---|
| 1 | Data build + sign-in + neighbourhood list + marking + append log | the bulk of it |
| 2 | Offline queue, undo, two-crew live refresh | about a third again |
| 3 | Your progress view and CSV export | small |

**Money: nothing.** Same hosting, same domain, no new service, no per-seat cost.

**⚑ Deploy risk is the real cost, not the build.** Uploading to the live site is the step that
can break something that already works — `DEPLOY.md` carries that warning for the main site and
it applies here. The form handler that took a week to get right lives in the same `api/`
folder. Mitigation: ship `/rounds/` and `api/rounds.php` as an additive upload that touches no
existing file, and test on the staging path before the live one.

## What I could not verify from here

- **PHP version and extensions on the live host.** The design avoids needing anything beyond
  core file functions and `hash_hmac`, but this has not been confirmed against the server.
- **Whether `data/` can sit outside the document root** on this hosting plan. If not, the
  `.htaccess` deny pattern already used for `submissions.log` covers it — belt and braces.
- **Real-world signal** in the target neighbourhoods. Nobody has walked one yet.

## What this does not do

No scheduling, no invoicing, no payments. Those are Jobber's job if they are ever wanted, and
that ruling has not changed. This is one thing: which doors were knocked and what happened.
