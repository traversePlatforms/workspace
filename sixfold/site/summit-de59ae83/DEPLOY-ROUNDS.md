# Door rounds — what to upload, and the one check that matters

**Built 2026-09-29. Nothing has been uploaded.** Phase 1 of
[ROUNDS-WEB-SCOPE.md](../../operations/door-territory/ROUNDS-WEB-SCOPE.md).

**Additive only.** Every file below is new. Nothing that already works on the site is
touched — in particular `api/submit.php`, `api/config.php` and `api/secrets.php` are not
modified, moved, or re-uploaded.

## ⚑ Lawn level per door (SX-19) — 2026-10-02: `rounds.php` + `index.html` + all 12 door files

| From | To |
|---|---|
| `api/rounds.php` | `public_html/api/rounds.php` |
| `summit-de59ae83/index.html` | `public_html/summit-de59ae83/index.html` |
| all 12 `data/rounds/*.json` | **`sixfold-data/rounds/`**, beside `public_html`, NOT inside it (overwrite) |

Then flush the cache. `lawn-cache.json` is **not** uploaded; it's a build input.

What it does:
- **Every door carries a lawn level:** *Large lawn · 2023*, *Medium*, *Small*, *Little or no lawn*,
  or *Mostly trees*. It comes from the 2023 USDA aerial photo plus a tree-height map
  (`operations/door-territory/lawn-trial/sample-lawn.mjs`; method and checks in `LAWN-SIZE.md`).
  **A level, never square feet:** the method reads open lots ~8% high and lawn under mature trees
  20–45% low.
- **Crew correct it at the door.** Tap the badge, then None / Small / Medium / Large. The answer
  replaces the photo's for everyone, shows as *"· crew"*, and goes in the export
  (`lawn_crew_level`, `lawn_crew_by`, beside the photo level and its approximate square feet).
  **Those answers are the calibration data:** after a season, the export is the dataset that
  re-tunes the cut-offs. New log: `lawnfix-<town>.log`, created on first use.
- **A Lawn sort** on the town screen (the bottom bar is now Map order · Nearest · Fire · Lawn).
  It puts the neighbourhoods with the most large and medium lawns still to knock first, and each
  card shows *"6 large · 22 medium lawns"*. Crew answers count.
- **Quotes to build** shows the lawn on each booked door.

Tested: 24/24 new checks, plus all nine earlier suites (263 total). Rebuilt door files verified as a
pure superset (31,422 doors, same ids).

## ⚑ Nearest neighbourhood — 2026-10-02, `rounds.php` + `index.html`

| From | To |
|---|---|
| `api/rounds.php` | `public_html/api/rounds.php` |
| `summit-de59ae83/index.html` | `public_html/summit-de59ae83/index.html` |

Matthew's point: inside a neighbourhood the doors are all close together; the useful question is
**which neighbourhood to drive to**. The town screen's bottom bar is now **Map order · Nearest ·
Fire hazard**.
- **Nearest** takes one location fix and sorts neighbourhoods by distance to each one's centre,
  showing *"0.2 mi"* on every card.
- On a fresh fix it **moves to the closest town** and says *"Showing Monument, the closest town to
  you."* Picking a different town by hand afterwards sticks.
- The API's `regions` action now returns `la`/`lo` per neighbourhood: the average of its doors'
  parcel centroids, computed when the list is served. **No data rebuild.**
- Nearest inside a neighbourhood is kept, because rural neighbourhoods can spread over miles.

11/11 new checks, including the first card matching an independent distance recount. All eight
earlier suites pass.

## ⚑ Doors to come back to — 2026-10-02, `index.html` only  *(live 2026-10-02)*

With about 30,000 doors, a no-answer showed only as one chip on one neighbourhood card among
thousands. The town screen now shows **"N doors to come back to"**, counting every no-answer
and every door whose come-back date has arrived, **across every town**. Tapping it lists just
those neighbourhoods, grouped by town. Tapping one switches to its town and opens it at the
right section (No answer, or Due to revisit). Built from counts the page already loads, so it
makes no extra request. Also fixed: opening a neighbourhood reset the scroll after drawing,
which undid any jump to a section. 8/8 new checks plus the earlier suites.

## ⚑ Fixes from the first live look — 2026-10-02, `index.html` only  *(live 2026-10-02)*

Matthew's notes after signing in on phone and desktop:
- **An empty black bar on the report page (and any page without a view switch).** The page
  never declared `[hidden]{display:none}`, so the dock's `display:flex` overrode the `hidden`
  attribute. Fixed globally.
- **The bottom bar covered text.** It floated over the list. Now it's a solid bar flush with
  the bottom edge (safe-area aware), and the page is padded so the last item clears it.
- **Quote booked was green, which read as "already booked".** It's ember now. Green only
  ever means done.
- **No-answer doors were hard to find and couldn't be put back.** A row at the top now says
  *"1 no answer to try again"*; tapping it opens the section and scrolls to it. Each no-answer
  door has **Put back on the list**, with Undo in the toast.

220/220 checks across seven suites.

## ⚑ The new look — 2026-10-02, page + five new files (SX-18)  *(live 2026-10-02)*

| From | To |
|---|---|
| `summit-de59ae83/index.html` | `public_html/summit-de59ae83/index.html` (over the existing one) |
| `manifest.json`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | `public_html/summit-de59ae83/` (**new**, next to `index.html`) |

**`rounds.php` and the door files are unchanged.** Don't re-upload them. Then flush the cache.

What changed, from the approved preview (https://claude.ai/artifact/Q32vDrTndXxnazGLuxooWJ):
- **Sign in:** a dark screen with the Ridge mark, six code boxes and a big number pad. Six digits
  sends the code. A wrong code shakes and clears. A keyboard works too.
- **App bar:** a dark Timber bar on every screen, with the mark, the town picker and your initials.
  Tap your initials to get back to field tools and sign out.
- **Neighbourhoods:** a town summary card with a progress ring, a ring on each neighbourhood, and
  coloured chips. The sort switch is a dock at the bottom of the screen.
- **Doors:** a coloured edge for fire hazard, small Satellite / + Phone / + Note chips, and solid
  buttons with icons.
  - Marking a door stamps it, slides it away, ticks the count down and shows a toast with
    **Undo**. The toast names what was marked and **never says "saved"**: offline marks still
    show *not sent yet*.
  - An ember burst on Quote booked, and a finished screen when the last door is marked. A
    no-answer doesn't count as finished.
- **Map:** tapping a dot opens a card from the bottom. "You" is a pulsing dot.
  - **The map's credit links now open in a new tab.** Testing found that tapping the
    OpenStreetMap link navigated the whole app away mid-round.
- **Home screen:** a manifest and icons. Add it from the browser's share menu and it opens full
  screen with the Sixfold icon. A splash with the mark shows while it loads.
  - **No service worker, on purpose.** The page always loads fresh, so an upload is never hidden
    behind a stale offline copy. Offline marking works exactly as before.
- Phones set to reduce motion get every change without the animation.

**Tested:** **211 checks, all passing**, on a scratch copy with throwaway codes:
- a new 30-check suite for the look: keypad, wrong code, keyboard entry, motion on, toast, Undo
  on the server, the finished screen, the icons, no script errors;
- all six earlier suites, updated for the new sign-in and map card.

Rendered at iPhone width in light and dark.

## ⚑⚑ THE ONE UPLOAD — everything built 2026-10-01, in a single pass  *(live 2026-10-02)*

**Every section below dated 2026-10-01 goes up in this one upload.** Nothing from today has
been uploaded yet; the files on disk carry all of it.

| From | To |
|---|---|
| `api/rounds.php` | `public_html/api/rounds.php` (over the existing one) |
| `summit-de59ae83/index.html` | `public_html/summit-de59ae83/index.html` (over the existing one) |
| all 12 `data/rounds/*.json` | **`sixfold-data/rounds/`**, beside `public_html` and **NOT inside it** (overwrite) |

Then **flush the cache** (Site Tools → Speed → Caching → Flush) and run the checks under
*The check that matters*. **Nothing to create by hand:** the new `quoted-<town>.log` appears the
first time an admin ticks a quote sent, and `areaflags-<town>.log` the first time a
neighbourhood is flagged. **No data rebuild was needed for this batch.** The door
files are the ones verified as a pure superset at commit `b6efb24`.

## ⚑ Slimmer cards, town progress, no soliciting, nearest door, map, quotes to build — 2026-10-01

### Slimmer cards
The fire badge now sits at the start of the acres/owner line. The satellite link moved into
one tools row: **Satellite ↗ · + Add phone · + Add note**. That's about two lines shorter per
door, so you get more doors per screen.

### Town progress
Under *"pick a neighbourhood"* there's now a line like *"212 of 737 doors visited · 9 quotes
booked · 3 due back"* with a bar under it. **Visited** means every door with any mark,
including no-answers, because the door was walked to.

### No soliciting (SX-13)
Inside the **Not now** chooser: **"No-soliciting sign — skip this door for good."** It counts
as done and leaves the fire-hazard count. It also has its own column in *Who marked what* and
appears in the export as `nosolicit`. **Undoing it asks first.** An accidental undo would put
the door back in front of the next crew member. Every other Undo still goes straight through.
**The neighbourhood flag too.** At the bottom of every door list: *"No-soliciting sign at the
entrance? Flag this neighbourhood."* Any crew member can raise it, after a confirm. After
that:
- the neighbourhood card shows **No soliciting posted** with its name struck through, and it
  sinks to the bottom of the fire-hazard sort;
- opening it shows a warning naming who flagged it and when, above the list and the map.

**It warns, it doesn't lock.** A sign at one entrance may not cover every street, so the
doors stay markable. **Only an admin can clear it**, with a confirm. Otherwise one wrong tap
quietly drops a neighbourhood from the programme. Crew get 403 from the API, not just a
missing button.

**⚑ The flag is stored against the door ids it covered, not the neighbourhood name.** Names
change when the lists are rebuilt, and today's split renamed dozens of them. A flag keyed on
a name would silently fall off and those doors would get knocked again. **Tested:** a flagged
neighbourhood renamed and split in two by a simulated rebuild came out with **both** halves
still flagged, and nothing else picked it up. Clearing either half clears the posting.

Checking for HOA bans before heading out is still the doors team's research job. The flag is
where they record what they find.

### Street order · Nearest · Map
A switch at the top of every neighbourhood, and each phone remembers its own choice.
- **Nearest** asks the phone for its location **once**, then sorts the doors nearest first,
  showing *"20 ft"* or *"0.3 mi"* on each card. It never tracks continuously, because that
  drains a phone over an afternoon. **↻ Update my location** takes a new fix. If location is
  blocked, the page says so and the list still works.
- **Map** shows every door as a dot: blue = to knock, green = due back, amber = no answer,
  grey = done. A **red ring** marks high fire hazard and a **black dot** is you. Tapping a dot
  shows the address and status. **Show card** jumps back to the list and highlights that door.
  - Street tiles come from **OpenStreetMap**, with the credit their policy requires.
  - The map library is **Leaflet 1.9.4 from cdnjs, pinned by checksum** (subresource integrity).
    This page is signed in to names and addresses, so a tampered copy of the library is
    refused rather than run.
  - The library loads only when Map is tapped, so the list stays fast. With no signal the map
    says it couldn't load and Street order carries on.

### Quotes to build (admins)
A new tile on the tools chooser. It lists every door marked **Quote booked**, across every
town, newest first. Each one has the address, the town and neighbourhood, the owner, acres,
the fire badge, the number with its source (tap to call), the note, who booked it, and a
satellite link. **Mark quote sent** moves it into a collapsed *Sent* list, and it can be
undone. Crew get 403 from both new API actions, not just a missing tile.
It's kept inside the door app on purpose. The Quote Build tool already exists in three copies
that must be kept in step (SX-2b), and this doesn't add a fourth.

### Tested
**62/62** on the new batch plus **25/25** on the neighbourhood flag, against a scratch copy on real PHP with throwaway codes, then
deleted. That includes a faked GPS position (the nearest door came out first and distances
ran in order), location refused, the map with the network cut, the real Leaflet file passing
its checksum, real taps on map markers, and both new admin actions refused to crew. **All four
earlier suites rerun against the final files:** phone 32/32, satellite 8/8, fire 17/17,
notes and come-back 36/36. That's **180 checks** in total. Rendered at iPhone width in light
and dark.

## ⚑ Notes, "come back when", and walkable neighbourhoods — 2026-10-01, same three uploads

**Same three uploads again, newer versions:** `api/rounds.php`, `summit-de59ae83/index.html`, and
all 12 `data/rounds/*.json` into **`sixfold-data/rounds/`** (beside `public_html`). One upload
carries everything built today. **Flush the cache afterwards.**

### Notes on every door
**"+ Add a note"** on each card: *"dog in the yard"*, *"back after 5"*, *"wants aeration in spring"*.
Up to 500 characters, line breaks kept. Shows who wrote it and when. Stored in
`notes-<town>.log` beside the marks — keyed on the door, so it survives rebuilds. In the export.

### "Not now" now asks "when should we come back?"
**In a month · In 3 months · Spring · Fall** (each showing its actual month), **pick a date**, or
**Not now — no date**. When the date arrives the door comes back in its own **"Due to revisit"**
section, buttons live, saying *"asked us back 1 Apr 2027 — due"*. Neighbourhood cards show
*"2 due back"*. Done rows read *"Not now · back Apr 2027"*.

**⚑ The date rides on the Not-now mark itself**, so it uses the same offline queue: **tested
with the network cut** — held on the phone as "not sent yet", sent with its date intact when
signal returned. A due high-hazard door counts towards the fire sort again.

### Neighbourhoods are walkable now
**Biggest 404 → 55 doors. None over 60** (was 183). Median unchanged at 29. 727 → 1,167
neighbourhoods. **Two stacked bugs:** the splitter split once and dumped leftovers into the
biggest piece; and pieces that shared a street name were glued back together, because the
neighbourhood file groups by name. Clashing names now carry their house-number range —
*"Wolf Village Dr 5738–5842"* — so a crew knows which stretch. **Non-clashing names did not
change.** Door ids are untouched: marks, numbers and notes all stay on their doors.

### Tested
**36/36** on a scratch copy with throwaway codes, including the offline case. Rebuild verified a
pure superset (31,422 doors, same ids). Rendered at iPhone width, light and dark.

## ⚑ Fire hazard badges + sort, 2026-10-01 — upload the same three again (SX-9b)

**Same three uploads as below, newer versions** — `api/rounds.php`, `summit-de59ae83/index.html`,
and every `data/rounds/*.json` into **`sixfold-data/rounds/`** (beside `public_html`, not in it).
This one upload carries the phone field, the satellite link AND the fire hazard together.
**Then flush the cache** — Site Tools → Speed → Caching → Flush.

**`wildfire-cache.json` is NOT uploaded.** It is a build input; the hazard class is already baked
into each door in the `.json` files.

### What the crew sees

- **A badge on every door:** *Very high fire hazard* (solid red) · *High* (solid orange) ·
  *Moderate* (amber outline) · *Low* / *Very low* (grey outline) · **Fire map: not rated**
  (dashed). Booked quotes in Done carry a small one, for the estimate visit.
- **A sort switch on the neighbourhood list:** *Map order* (walking routes, the default) or
  *Most fire hazard*, which puts the neighbourhoods with the most high-hazard doors **still to
  knock** first. Each neighbourhood shows a pill — *"46 high fire hazard · 18 very high"*.
  The choice is remembered on that phone.

### ⚑ Rules built into it — do not "simplify" these away

- **"Not rated" is never "low".** Class 6 means the 270 m cell is mapped as town or farmland; a
  wooded lot can sit inside one. It gets a dashed badge and is never hidden or sorted out.
- **The count is high-hazard doors STILL TO KNOCK.** Booking one drops it; a *no answer* does
  not, because that door still needs a visit. A worked-out neighbourhood sinks down the sort.
- **It rates neighbourhoods, not houses** (270 m cells). The satellite link is the per-house check.

### Tested

17/17 on a scratch copy with throwaway codes: the per-neighbourhood count matched an
independent recount of its doors (46 = 46, very-high 18 = 18); booking dropped it, a no-answer
did not, undo restored it; the sort was strictly descending; map order came back exactly; the
choice survived a reload; every card showed a badge; class 6 read "not rated". Rendered at
iPhone width in light and dark. Every badge colour checked at ≥ 4.5:1 contrast.

### Rebuilding the hazard data

`node sample-wildfire.mjs` then `node build-rounds-data.mjs`. Sampling is incremental — it
only asks the Forest Service about coordinates it has not seen — so after a door rebuild it
fetches the new doors only. Run `verify-superset.mjs` before uploading, as always.

## ⚑ Phone numbers + satellite view, 2026-10-01 — ONE upload, three parts (SX-14)

| From | To | Note |
|---|---|---|
| `api/rounds.php` | `public_html/api/rounds.php` | over the existing one — the `phone` action, and coordinates on each door |
| `summit-de59ae83/index.html` | `public_html/summit-de59ae83/index.html` | over the existing one — the phone field and the satellite link |
| `data/rounds/*.json` | **`sixfold-data/rounds/`** — beside `public_html`, NOT inside it | the door files, now carrying each parcel’s coordinates |

**⚑ The satellite link needs the new door files.** Upload the page without them and the link
simply does not appear (it hides itself when a door has no coordinates) — nothing breaks, but
nothing shows either. All three together.

### Satellite view

Each door shows **"Satellite view ↗"**, which opens Google Maps in satellite mode on that
parcel — in the Maps app on a phone, if installed. It is the Google Earth step in Via’s
funnel: **see the trees and brush crowding the house before knocking or quoting.** Booked
quotes in Done get a smaller one, for a look before the estimate visit.

- **Uses the parcel centroid, not the address.** Rural addresses here can geocode to the
  nearest road; the coordinates come from the parcel boundary itself.
- **Zoom follows lot size** — 20 under an acre, 19 for 1–3, 18 from 3 up — because the
  centroid is the middle of the *lot*, not the house, and a 10-acre lot needs the room.
- **Format is Google’s documented Maps URL** (`map_action=map`, `basemap=satellite`), checked
  against Google’s own docs rather than remembered.
- **Coordinates were carried through the pipeline**, not bolted on: they were already parsed
  by `build-walklist-pdf.mjs` for the neighbourhood clustering and thrown away on the line
  that writes the sidecar. All 31,422 doors carry them, all inside Colorado; the rebuild was
  verified a pure superset (same doors, same ids) before shipping.
- **Tested:** 8 checks on a scratch copy, then the link followed in a real browser — it opened
  Google Maps in satellite on 480 High Rd, Divide: a 10-acre lot that is nearly solid conifer,
  which is the whole point.

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
