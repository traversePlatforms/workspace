# Code review, 2026-10-27: speed, compactness, space

Read-only pass over the Traverse / Sixfold 365 code (app page, API, edition builder, data pipeline, hosting). Nothing was
edited, committed, deployed or deleted. Every number below was measured on this laptop or read from the Traverse server
over SSH (read-only commands) on the night of 26/27 Oct 2026; the measuring commands are noted so the figures can be re-run.

Matthew's ask: "check all the files, all the codes, make it quicker, make it more compact, free up space that needs it."

## The ten findings that matter most

| # | Finding | Where | Expected effect |
|---|---|---|---|
| 1 | The towns answer (`action=regions`) is recomputed from every door in the state after **any** mark, note, phone or photo in **any** town: its cache key is every `.json` and `.log` in the data folder. Decoding the 98 town files alone takes 3.4 s on this laptop with PHP 8.4 (994,137 doors); the shared host is slower, and it does it twice (admin and crew kinds). Sixfold logged 102 marks today. | `traverse/app/api/rounds.php:3167` | Towns screen after a mark: seconds to under 100 ms; most of the API's CPU seconds (the GrowBig limit is 2,000/hour) |
| 2 | One neighbourhood (`action=area`) still `json_decode`s every **whole** side file for the town: wind-denver 11.2 MB, security-denver 14.7 MB, hailrep-aurora 8.5 MB, plus year, roof, photo, outline, material, naip, solar, permit, pest. The town file itself was already split per neighbourhood (TR-7); the side files were not. | `rounds.php:213`, `rounds.php:3309-3338` | Big-town door lists for admins: about 400 ms and 200+ MB per request to about 30 ms and under 20 MB |
| 3 | The phone parses a 4.7 MB towns answer on every open (24,546 neighbourhoods; 739 KB gzipped) and then `JSON.stringify`s it twice to see whether anything changed. | `index.html:17651-17660`, `rounds.php:3172` | First paint without a 4.7 MB parse; 700 KB less per open when nothing changed; the server already computes the `sig` to compare |
| 4 | Four regenerable pipeline caches are tracked in git and have been committed 7-9 times each: 19 blobs over 5 MB = 422 MB of the 325 MB `.git`. Two of them are modified right now (lawn-cache 31 to 74 MB, value-cache 39 to 69 MB): the next `git add -A` adds another ~140 MB. | `traverse/data-pipeline/door-territory/{tree,lawn,value,wildfire}-cache.json`, `.gitignore` | Stops `.git` growing by tens of MB per pipeline run; a history rewrite would take `.git` from 325 MB to about 40 MB |
| 5 | 228 GB of the 243 GB under `traverse/` is `tree-zones/lidar-cache/`: USGS 3DEP point-cloud tiles, public, re-downloadable, gitignored, excluded from the Drive backup, and already reduced to `tree-cache.json` (79 MB). The laptop's only large folder. | `traverse/data-pipeline/door-territory/tree-zones/lidar-cache/` | 228 GB back, with nothing lost that cannot be fetched again |
| 6 | Six installs on the server each hold a full copy of the same town data (`monument.json` is byte-identical in all six; 5.1 GB of data folders) plus a `town-cache/` each (1.9 GB, ~25,000 files per install, ~150,000 files in all). GrowBig's limit is 400,000 inodes; `www/` already holds 159,649 files. | `~/www/traverseplatforms.com/*-data/rounds/`, `rounds.php:684` | 3-4 GB and ~120,000 inodes back; headroom for the next install |
| 7 | The Spanish dictionary (167 KB raw, 49 KB brotli, 16% of the page's wire bytes) is inlined in the page and shipped to every English device; it is only parsed when the device is set to Spanish. | `index.html:2434`, `traverse/app/i18n/sync-es.cjs` | 49 KB less per open for every English phone; zero behaviour change |
| 8 | ~300 KB of the 865 KB API (a365 quote/lead/booking, Square, ClickUp, Meta, JobNimbus, kit, Stripe) serves only Sixfold 365 or one edition, and is copied into all six installs. | `rounds.php` action blocks `a365quote` 36 KB, `squarecheckrun` 27 KB, `clickuppoll` 17 KB, `a365lead` 17 KB; ~230 KB of helper functions | Five editions' API ~40% smaller; the shared file readable again |
| 9 | `rounds.php` has been uploaded half-written more than once: the PHP error log holds 16 parse errors ("Unterminated comment starting line 2934", "Unclosed '('"), i.e. minutes when every app request failed. | `~/www/traverseplatforms.com/public_html/api/php_errorlog` | Zero-downtime uploads: write to `rounds.php.new`, then `mv` |
| 10 | `~/upload-backups/` holds 884 MB in 624 files, all from October (deploy backups and the 42 `*.pre-*` copies moved there 25 Oct); `traverse/editions/dist/` holds 2.9 GB of rebuildable output including three stale upload folders from 9 Oct. | server `~/upload-backups/`, local `traverse/editions/dist/upload-*` | ~800 MB on the server, ~1 GB locally, nothing lost (archive first) |

Not confirmed as a cost: the brief said the dark-mode CSS rules are duplicated per selector. They are, but only in 12 lines
(2.1 KB of 245 KB). Not worth touching. The log replays (`leadsAll`, `jobsAll`, `readLines`) were memoised per request on
22 Oct and the logs are small (leads.log 30 KB, leadst.log 107 KB, jobs.log 17 KB, the biggest marks log 5 KB), so they are
not a hotspot today either; the two that grow are `taplog-YYYY-MM.log` (570 KB this month) and `squarehook.log` (266 KB).

---

## 1. Speed

### 1a. Page weight and first load

Measured: `traverse/app/summit-de59ae83/index.html` is 17,749 lines, 1,710,618 bytes in the source. The shipped copy
(`traverse/app/dist/summit-de59ae83/index.html`, made by `traverse/editions/minify-page.cjs`) is 1,230,107 bytes:
CSS 244,963, JS 816,634, Spanish JSON 167,214, markup the rest. Over the wire the live page is 313,223 bytes (nginx sends
brotli; `curl` from the server, 68 ms). The page is served `Cache-Control: private, no-cache` (its own `.htaccess`), so
every open revalidates and, when the ETag differs, downloads the whole thing again. `sw.js` is network-first with a 6 s
timeout, so with signal the network copy is always what runs.

The network cost is therefore modest; the cost that remains is **parsing and compiling 817 KB of JavaScript on every open
on a phone** (roughly 0.3-0.8 s on a mid-range Android before the first line of the app runs) and the towns answer (1c).

| Item | file:line | Why it matters | Gain | Risk | Change |
|---|---|---|---|---|---|
| Spanish dictionary inlined for everyone | `index.html:2434` (one 169,560-byte line); `i18n/sync-es.cjs` writes it | 167 KB raw / 49 KB brotli shipped to every English device; only read when `doorapp.lang === 'es'` (`index.html:2452-2454`) | 16% of the wire bytes on every open for the whole crew | None for English devices; Spanish devices make one extra request (keep it in `sw.js` SHELL so it works offline) | `sync-es.cjs` stops inlining `es.json` and copies it to `summit-de59ae83/es.json` instead; `engine.js` fetches it when `LANG === 'es'` (sync) and starts the MutationObserver when it arrives. `build-editions.cjs` already copies the app folder. `minify-page.cjs` keeps its JSON-skip rule for the day the block is gone. |
| One 15,210-line closure | `index.html:2585-17747`, everything inside one IIFE | Every role downloads and compiles every screen: a crew phone compiles the office desk (`deskTerr` 13842, `planDraw` 16882, `deskBrowse` 9521, `deskHome` 9375, `officeView` 17453, `statsPageView` 17196, `calendarView` 10721, `jobBookView` 5652, `quoteBox` 8210, `crimeMapView` 15488, `aerialView` 15890, `houseLookupView` 7783, `a365PricingView` 8458), roughly 5,000-6,000 lines that only admins, office or desk users ever open | Crew phones compile ~40% less JS per open | Medium: the screens share `S`, `q`, `api`, `ico` and ~80 helpers through the closure; a split needs an explicit shared object and a loader, and `build-editions.cjs` counts its swaps in one file | Second step, after 1c. Move the desk/office views into `app-desk.js` loaded by `deskWide() \|\| role in (admin, office)`; `sw.js` SHELL carries both files. Do it once, with the swap counts in `build-editions.cjs` updated. |
| Leaflet / protomaps | `index.html:13580-13613` | Already loaded on demand from cdnjs/jsdelivr with SRI, only when a map opens | none | none | Nothing; this is already right. |
| Topo texture as a data URI | `index.html:1075` (21,487 bytes) | A 21 KB CSS line, compresses to a few KB | small | none | Leave, or move to `topo.svg` beside the page if the CSS is ever split. |
| Google Fonts | `index.html:25-27` | Three families from fonts.googleapis.com, loaded `media="print"` then swapped: non-blocking. Offline first open shows system fonts | none | none | Nothing. |

### 1b. Main-thread hotspots in the page

| Item | file:line | Why it matters | Gain | Risk | Change |
|---|---|---|---|---|---|
| Towns answer parsed and stringified on every open | `index.html:17651-17660` (`refresh`): `JSON.stringify(S.regions)` before and after `api('regions')`; `index.html:2919, 2922` run `areaFill` and the TOWN_NAME fill over all 24,546 areas each time | 4.7 MB JSON (739 KB gzipped) parsed, then stringified twice to compare, on a phone, before the Colorado screen settles: roughly 0.5-1 s of main-thread work on a mid phone, every open and every `refresh()` | Colorado screen settles immediately when nothing changed; no 4.7 MB parse for the common case | Low | Server: put the `sig` it already computes (`rounds.php:3172`) in the answer and honour `If-None-Match` for `regions` (send `ETag: "<sig>"`, answer 304; `rounds.php:259` currently sets `Cache-Control: no-store` for everything, so add a per-action exception). Page: compare `j.sig` to `S.regionsSig` instead of stringifying. Then, as a second step, split the answer: towns with totals (small, every open) and one town's areas on demand (`action=regions&town=`), cached by `sw.js` like `area`. |
| Full rebuild per click | `drawPipe` `index.html:12816-12981`; `renderDoors` `index.html:16343-16579`; `renderAreas` 4174; 73 `view.textContent = ''` sites | Every stage tap, fold or toggle tears down and rebuilds the whole list (`leadCard`/`quoteCard`/`doorCardFor` per item) and then `window.scrollTo(0, y)`; fine at 50 items, visible at 300+ doors or on the desk's two-column pipeline | Smooth taps on big neighbourhoods and the full pipeline | Low-medium | Keep the rebuild (it is simple and correct) but build into a `DocumentFragment` and swap once, and skip the rebuild when only `aria-pressed` changes (stage/mode buttons: toggle classes, re-filter the existing cards by `data-id`). |
| `queue()` parses localStorage per door | `index.html:16544` (`pendingFor` in the Done list), 11 call sites; `queue()` at 2621 does `JSON.parse(localStorage)` each call | O(doors) JSON parses of the save queue per render | small, free | None | Parse once per render: `var pend = pendingSet()` built from one `queue()` call, pass it down. |
| Spanish text engine | `index.html:2464` builds one regex of **2,209 alternatives** (`FRE`); `tr()` runs it twice per string (2481); the MutationObserver (2520-2527) watches `attributes` and `characterData` on the whole document | On a Spanish device every render runs a 2,209-way alternation over every text node and three attributes of every element; the English side pays nothing | Spanish devices render as fast as English ones | Low; Spanish only | In `tr()`, skip `FRE` when the string has no space or is shorter than 4 characters; bucket `FRAG` keys by first word and test only that bucket's regex; drop `attributes: true` from the observer and translate `placeholder/title/aria-label` in `q()` instead (the page's own element factory, 2616). |
| `renderRegions` select rebuilt on every `renderAreas` | `index.html:4151-4172`, called at 4184 | Iterates every area of every town to count doors to knock each time the neighbourhood list draws | small | None | Cache the per-town "to knock" count on `S.regions[i]._todo` when the answer arrives (`areaFill`). |

### 1c. Server hotspots in rounds.php

Context: PHP 8.2, opcache on, `memory_limit` 768 MB, `max_execution_time` 0 (checked over SSH). The 865 KB file compiles
once; the 191 top-level `if ($action === ...)` blocks cost nothing measurable. The per-request memo of log files
(`jsonLines` `rounds.php:795`, `logRows` 804, `leadsAllRaw` 4299, `jobsAll` 5078) is in place since 22 Oct and the logs
are small, so **log replay is not where the time goes**. These are:

| Item | file:line | Why it matters | Gain | Risk | Change |
|---|---|---|---|---|---|
| Whole-state recompute of `regions` after any write | `rounds.php:3152-3280`; the key at 3160-3171 hashes every `*.json`, `*.log` and `docs/*.json` in `DATA_DIR` and `customers.log` | Any mark, note, phone, photo, lead, job or walk anywhere invalidates the kept answer; the next phone recomputes **every town** (`loadRegion` of all 98 files, 994,137 doors, 3.4 s of `json_decode` alone on this laptop; the loop at 3193-3245 on top), and there are two kinds (`a1t`, `c1t`), so twice. With a crew out, that is one multi-second, 260 MB request per mark, on a plan metered in CPU seconds. No lock either: two phones asking at once both recompute (3178 reads, 3279 writes). | Towns after a mark: under 100 ms; CPU seconds cut by the largest single factor available | Low-medium: same loop, cached per town instead of per state | Cache per town: `town-cache/<town>/areas-<kind>.json` keyed on that town's file + its own logs (as `townKnockStats` already does at 712-737 with `marks`/`result` logs; extend the signature to `areaflag`, `lawnfix`, `dassign`, `assign` and `customers.log`). `regions` becomes: for each town, read or rebuild its part, then concatenate; the state-wide odds (3247-3273) are computed from the cached `_seg` totals. Hold a `flock` on `regions-cache-<kind>.lock` while rebuilding so a second request serves the previous file instead of rebuilding again. |
| Whole side files decoded per neighbourhood | `loadSide` `rounds.php:206-216` (`$only` path at 213 still decodes the whole file); called 13 times in `area` at 3309-3338 | For one Denver neighbourhood as a Roofing admin: wind 11.2 MB (47 ms, ~90 MB), hailrep, security 14.7 MB, year 3.5 MB (45 ms), roof, photo, outline, material, naip, solar, permit, census, nri: about 300-450 ms and 200+ MB peak per request, before the door loop; the Plan asks for 40 areas per POST and pays it once per POST, the crew once per neighbourhood. (`php -r` timings in this review; Node parses are 2-3x faster than PHP.) | Area answers in the big towns from ~400 ms to ~30 ms; memory from 200 MB to under 20 MB; `security-*.json`'s per-door `json_decode` (the `packed` form at 211) becomes unnecessary | Low: `townSplit` already has the fallback shape | In `townSplit` (684-710), when a side file's stamp changes, write its rows per neighbourhood into `town-cache/<town>/s-<kind>-a<i>.json` (ids are known from `a<i>.json`), with a `sides.json` of stamps; `loadSide($only)` reads those when present, falls back to the whole file when not. |
| Per-area re-decode inside the loop | `rounds.php:3409`: `permit-index.json` decoded inside `foreach ($data['areas'] ...)`; `rounds.php:3406` `loadAreaFlags($key)` per area | 40 decodes of the same file in a 40-area POST | small | None | Hoist both above the loop. |
| Search index built on a phone's first search | `searchIndexFile` `rounds.php:1145-1167`: rebuilt when any town file is newer; decodes every town; Sixfold's `search-index.txt` is absent on the server right now (`stat` printed blank), so the first search tomorrow rebuilds it (the six "Allowed memory size exhausted" fatals on 25 Oct were this path; the streaming fix landed the same day) | Several seconds and hundreds of MB inside a user request, once per upload | First search after an upload answers at once | None | Call `searchIndexFile()` from the nightly cron (`sixfold-tools/nightly-backup.php` runs at 00:00) and from the deploy script after a town upload (`curl` the API as Claude Check is read-only and `search` is in its allow-list, `rounds.php:2927`). |
| `Cache-Control: no-store` on every JSON | `rounds.php:259` | No conditional GETs, so `regions` (739 KB gz) and `company`/`me` always travel in full | 700 KB per open saved when towns are unchanged | Low; `sw.js` keeps `regions`/`area`/`me`/`company` for offline and copes with 304 only if the page falls back to the kept copy: easier is to keep 200s but make the body tiny (`{ok:true, same:true}`) when the page sends `X-Regions-Sig` and it matches | Add the sig handshake described in 1b; keep `no-store` for everything else. |
| `regions` answer rebuilt per request kind | `rounds.php:3159` | `a1t` and `c1t` differ only in `who`, `on`, `bestN/bestS/sc`; two full recomputes | halves the recompute | None | One cached full answer; strip the admin-only fields per role on the way out (the page already tolerates missing fields via `AREA_ZERO`/`AREA_NULL`). |

### 1d. Town data size and shape

Measured on `parker.json` (24,642 doors, 6,695,825 bytes, 272 bytes/door): key names are 26% of the file, the `id` field
(the slug of `address`) 9.8%, owner names 10.9%, `trees` objects 1.23 MB, `lawn` objects 0.78 MB. A compact form (no `id`,
two-letter keys, `lawn`/`trees` as arrays) is 63% of the raw size (4.22 MB) and gzips to 1.04 MB against 1.25 MB. Town files
are never sent to a phone whole (the API rebuilds each area answer), so the gain is disk and decode time, not wire.

| Item | file:line | Why it matters | Gain | Risk | Change |
|---|---|---|---|---|---|
| Wind reports repeated per door | `wind-*.json` (37 files, 134.6 MB; `wind-parker.json` 7.3 MB, 10.0 reports/door, 28% older than 2024); written by the pipeline, read at `rounds.php:219-237` | Every door within 10 miles carries the same event string ("2024-08-13\|83\|measured\|8"); the file is 24,717 near-identical lists. It gzips 44:1 (165 KB), which says how redundant it is | ~120 MB per install on disk (x6 on the server), decode time in 1c | Low | Store the town's events once (`events: [...]`) and per door a list of event indexes with the miles, or just the door's position and compute the 10-mile filter at read from `events` (24,717 doors x N events is cheap once per area). |
| `security-*.json` double-encoded | `"packed":1`, each door a JSON **string** (`security-parker.json` 902,631 bytes vs 785,729 unpacked, +15%), unpacked per row at `rounds.php:211` | Added to save memory when decoding whole files; moot once side files are split per area (1c) | 15% of 67.7 MB; one fewer decode per door | None after 1c | Write plain objects again in `data-pipeline/door-territory/security/build-security.mjs` once 1c is in. |
| Town file keys and the `id` field | `traverse/data-pipeline/door-territory/build-rounds-data.mjs` writes; `rounds.php` reads `$d['id']` in ~60 places; `townSplit` 684 | 37% of 172 MB of town files per install (x6 on the server) and ~30% of decode time | ~64 MB per install; faster `regions` rebuilds and `townSplit` | Medium: every reader of `id`, `address`, `lawn`, `trees` on both sides; the page gets its doors from the API so it needs no change if the API expands them | Do after 1c and the per-town `regions` cache, when decode time stops mattering; otherwise leave. The honest gain is disk, and disk is not the server's constraint (see 3c). |
| Lat/lon precision | town files 6 dp (10 cm); area answers round `la`/`lo` to 4 dp | fine | none | none | Nothing. |
| Compression and headers | nginx: page and `sw.js` arrive `content-encoding: br`; API JSON `br` too (`rounds.php:263` comment, confirmed) | Already right | none | none | Nothing beyond the `regions` sig in 1c. |

## 2. Compactness

Measured with a script over the source (`analyse-page.cjs` in this session's scratchpad; re-runnable):

- Page: 817 named functions, **none unreferenced**; the repeated names (`paint` x5, `draw` x5, `go` x3, `run` x3) are
  local closures, not duplicates. 148 UPPER_CASE constants, all used. Clean on that measure.
- CSS: 1,222 distinct class selectors; 72 never appear outside `<style>`, 59 of them with no dynamic-prefix match
  (`l-new l-contacted l-walk l-quoted l-won l-lost f5 f4 f3 lv-L lv-M lv-S lv-N lv-T lv-x tl-against tl-heavy tl-some
  tl-clear r3 cmonth qqgrp sv-likely sv-possible sv-below role-manager role-admin role-crew s-door s-website matchn
  dh-tool dh-tools sdayrow oplan sqday fbadge comt1..comt5 c-fair c-check jslot jday jdh jclosed jcrew jch jarea jt jx
  jopen` and the `leaflet-*` ones, which Leaflet itself applies). About 75 rules, ~5 KB. Several of these (`l-*`, `lv-*`,
  `tl-*`, `s-*`, `role-*`) are likely built by concatenation; check each before cutting. Ten rule bodies repeat 4-11
  times (the 11.5 px uppercase label, `go-tint` chips): 1-2 KB if made utility classes. The dark-mode duplication is 12
  lines, 2.1 KB. **CSS is not where the bytes are.**
- Spanish: 2,515 keys; 12 whose English never appears in the page or API (statutory lines, 1.6 KB). Consistent.
- rounds.php: 412 functions; `icsLine` (1340) and `icsFold` (2070) are both used through `array_map` (9175, 2117), so
  no dead functions found by name. 191 action blocks.

| Item | file:line | Why it matters | Gain | Risk | Change |
|---|---|---|---|---|---|
| Sixfold-365 and integration code in the shared API | `rounds.php`: `a365quote` 36 KB, `squarecheckrun` 27 KB, `jobweather` 27 KB, `jobber` 21 KB, `companyset` 17 KB, `clickuppoll` 17 KB, `a365lead` 17 KB, `leadadd` 16 KB, `jobdone` 16 KB; helpers `a365*`, `square*`, `sq*`, `clickup*`/`cu*`, `meta*`, `jn*`, `kit*`, `stripe*`, `pay*`, `hop*` ~230 KB; 350 of 9,950 lines mention a365 or Jen | Every edition ships and compiles Sixfold's quote funnel, Square and ClickUp sync, Facebook lead polling and JobNimbus; the file is the hardest in the repo to read and the one uploaded half-written (4) | Editions' API ~300 KB smaller; a change to the 365 funnel can no longer break Roofing | Medium: the helpers share `leadsAll`, `jobsAll`, `appendLine`; one include per family, required after the session gate, keeps `global` state as is | `api/rounds-a365.php` (a365*, kit*, Square, Stripe), `api/rounds-sync.php` (ClickUp, Meta, JobNimbus); `rounds.php` does `if (feature('company') \|\| kitOn()) require __DIR__.'/rounds-a365.php';` and `build-editions.cjs` copies only the includes an edition's features name (it already rewrites `api/<api>-*.php`). |
| Roofing-preview plumbing | `index.html:2721-2735` (`ROOF_HIDE`, `ROOF_SHOW`, `roofOn`, `S.roofView`), `feat('roofPreview')` x2; the comment at 2722 says Roofing is its own app since 6 Oct; no `company.json` in the repo or in `editions/dist` sets `roofPreview` | A settings path (Profile > Roofing preview) and a card filter nobody uses | ~60 lines, one fewer branch in `cardOn` | None if no live `company.json` sets it (check Sixfold's live copy first) | Remove `roofPreview`, `S.roofView`, the Profile switch, `ROOF_HIDE`/`ROOF_SHOW`; `cardOn` reads only `CO.card`. |
| `walkdesk` and `crew` flags | `feat('walkdesk')` x32 in the page, `feature('walkdesk')` x61 in the API; `"crew": true` in all five edition company files | If every install has them on, 93 branches guard nothing | readability | Confirm against the six live `company.json` files first | If all six are on, make the behaviour unconditional and delete the flag; if Sixfold's is off, keep. |
| Sixfold names in shared keys | `index.html:2595` `QKEY = 'sixfold.rounds.queue'`, 2606 `'sixfold.theme'`, 2666 `'sixfold.rounds.signedout'`, 4248 `'sixfold.rounds.sort'`, `sw.js` `X-Sixfold-Offline`; `build-editions.cjs` swaps them per edition | Works, but each swap is a counted string the build can trip on | fewer swaps | Low; changing a key on Sixfold's live phones loses the stored value once (theme, sort; the queue must be migrated) | Read the prefix from one `STORE` constant that the build swaps once; migrate the queue key on first run. |
| `DEPLOY-ROUNDS.md` in the app folder | `traverse/app/summit-de59ae83/DEPLOY-ROUNDS.md` (137 KB) | Operations notes sit inside the deployable folder; not on the server (checked: the folder holds ten files and the URL answers 403) | tidiness | None | Move to `traverse/app/DEPLOY-ROUNDS.md` so a future folder upload cannot carry it. |
| Unused CSS classes | see list above; `index.html:43-2425` | ~5 KB | small | Low after checking the concatenated ones | Cut after a grep per class for `'xxx-' +` patterns. |
| `sampleAnswer` | `index.html:2775-2895` (11 KB) | The sample door's made-up answers, compiled for everyone | small | None | Leave; it is the one honest demo (tools open empty). |

## 3. Space

### 3a. Laptop (working tree)

`du` on 26/27 Oct: `traverse/` 243 GB, `surge/` 4.0 GB (video and photos, gitignored), `sixfold/` 459 MB, `_archive/` 160 MB,
`matthew/` 114 MB, `node_modules/` 63 MB. Inside `traverse/`: `data-pipeline/` 239 GB, `editions/` 2.9 GB, `app/` 997 MB.

| Item | Where | Size | Regenerable? In a backup? | Plan (archive, never delete; count references first) |
|---|---|---|---|---|
| LiDAR point-cloud tiles | `traverse/data-pipeline/door-territory/tree-zones/lidar-cache/` (9 survey folders: `CO_DRCOG_1_2020`, `CO_DRCOG_2_2020`, `CO_Eastern_B1_2018`, `CO_Eastern_ElPaso_2018`, `TX_CentralEast_1_A23`, ...) | **228 GB** | Yes: public USGS 3DEP EPT tiles from `s3-us-west-2.amazonaws.com/usgs-lidar-public/` (`tree-zones/lidar.mjs:21`); results are in `tree-cache.json` (79 MB, every door scored). Gitignored (`tree-zones/.gitignore:5`); excluded from the Drive backup (`shared/tools/Backup-ToGoogleDrive.ps1:88`). So it exists nowhere else and is the laptop's only large folder. | References: `lidar.mjs`, `teller-grids.mjs`, `sample-trees.mjs`, `resume-trees-2026-10-16.sh`. Options, Matthew's call: (a) move to an external drive as `lidar-cache-2026-10/` and leave a `README` with the survey list and the fetch command; (b) since it is a download cache of public data, delete it after the next tree pass confirms `tree-cache.json` covers every town (the pipeline refetches on demand, and the hotspot rule applies: office Wi-Fi only). Texas (`TX_CentralEast_1_A23`) is tabled and can go first. |
| Roof-material model cache | `roofs/material/cache/` | 6.8 GB | Rebuilt by `roofs/material/fetch.mjs` (NAIP windows); not in the Drive backup (`material\cache` excluded) | Keep until the material model is retrained; then archive like the above. |
| County assessor downloads | `assessor/raw/` 647 MB, `commercial/raw/` 359 MB, `permits/raw/`, `pest/cache/` 397 MB, `lawn-trial/cloud/` 205 MB, `lawn-trial/drcog-turf/` 141 MB | ~1.9 GB | Downloads; gitignored; `raw`, `se-cache` excluded from the Drive backup | Leave; refetchable, modest. |
| Edition build output | `traverse/editions/dist/` (gitignored) | 2.9 GB: `traverse-data` 748 MB and four more data folders, plus `upload/`, `upload-2026-10-09/`, `upload-speed-2026-10-09/`, `upload-teller-2026-10-09/` | Rebuilt by `node traverse/editions/build-editions.cjs` in minutes; excluded from the Drive backup | Archive the three dated `upload-*` folders (zips from the 9 Oct move) to `_archive/editions-uploads-2026-10-09/` with a manifest, then remove them from `dist/`. `dist/` itself is scratch. |
| App data | `traverse/app/data/rounds/` | 993 MB (69 town files 172 MB; `wind-*` 134.6 MB; `hailrep-*` 87.7 MB; `security-*` 67.7 MB; `lawnmask-*` 42.7 MB; `solar-*` 42.3 MB; ...) | Built by the pipeline; the named owners rule keeps it out of git; it is in the Drive backup | Shrinks with 1d (wind dedupe alone ~120 MB). |
| Peak desk test screenshots | `matthew/peak-pickleball-sponsorship/tests/*.png` | 16 tracked PNG files, 2.9 MB total of tracked images in the repo | Regenerated by the test run and show as modified every run | Gitignore `tests/*.png` and `tests/*.pdf`; keep one reference set under `tests/golden/` if a before/after is wanted. |

### 3b. Git

`.git` is 325 MB (pack 300.8 MB). The 19 blobs over 5 MB are 422 MB uncompressed and are **all** four pipeline caches:

| File | Size now | Commits | In `.git` |
|---|---|---|---|
| `traverse/data-pipeline/door-territory/tree-cache.json` | 79.0 MB | 9 | 75.3 + 32.2 + 22.6 + 14.8 + 10.7 + 3.3 MB blobs |
| `.../lawn-cache.json` | 73.6 MB (HEAD holds 31.3 MB; **modified, uncommitted**) | 9 | 29.8 + 24.6 + 17.0 + 10.8 + 5.7 MB |
| `.../value-cache.json` | 69.4 MB (HEAD holds 39.3 MB; **modified, uncommitted**) | 7 | 37.5 + 37.5 + 31.9 + 25.4 MB |
| `.../wildfire-cache.json` | 15.0 MB | 7 | 14.3 + 12.3 MB |
| `.../hoa-cache.json` | 3.7 MB | 4 | 3.5 MB |

Why it matters: the repo's own header says it is "NOT a backup tool"; these are regenerable download caches (the Drive
backup and the OneDrive mirror hold them); every pipeline run that touches them and gets committed adds 20-40 MB of pack,
and `github-sync.sh` pushes it. The next `git add -A` tonight will add two more ~70 MB blobs.

Plan, in order: (1) **before the next commit**, `git rm --cached` the five files and add
`traverse/data-pipeline/door-territory/*-cache.json` to `.gitignore` (files stay on disk; nothing lost); (2) later, with
Matthew's go and a fresh backup, `git filter-repo --invert-paths --path traverse/data-pipeline/door-territory/<each>` to
drop them from history (`.git` to about 40 MB), then a forced push through `github-sync.sh` only (never `main` directly,
per the standing rule). Step 2 is a history rewrite and can wait; step 1 should not.

Also: 436 uncommitted changes in the tree tonight (another worker is active); the review did not touch them.

### 3c. Server (Traverse GrowBig, over SSH, read-only)

Totals: `~/www/traverseplatforms.com/` about 7.1 GB and 159,649 files; `~/upload-backups/` 884 MB, 624 files; disk use on
the box 84% of 2.3 TB (shared), account inodes not shown by `df -i` (the server-wide figure is 18%). SiteGround's GrowBig
allowance (memory, 11 Oct): 50 GB and **400,000 inodes**. Disk is not the constraint; **inodes will be**.

| Item | Where | Size / count | Plan |
|---|---|---|---|
| Six copies of the same towns | `sixfold-data` 836 MB, `traverse-data` 1.1 GB, `traverse-yards-data` 768 MB, `traverse-solar-data` 888 MB, `traverse-pest-data` 739 MB, `traverse-security-data` 763 MB; `monument.json` has the same md5 in all six; `year-parker.json` the same in three | 5.1 GB, of which perhaps 1.5 GB is distinct | Put one read-only copy of each town and side file under `~/www/traverseplatforms.com/traverse-shared/towns/` (the sibling folder already exists for `installs.json` and geo) and make each install's `rounds/<file>.json` a symlink; `rounds.php` resolves everything through `DATA_DIR` paths (`regionFile` 645, `loadSide` 213), and `is_readable`/`filemtime`/`filesize` follow symlinks, so no code change. `build-editions.cjs` writes the symlink set per edition from its `keep()` filter instead of copying. Upload once, verify by md5, switch per install with a backup in `~/upload-backups/`. Gain ~3.5 GB. |
| `town-cache/` per install | `*-data/rounds/town-cache/` | 1.9 GB; 25,230 + 24,910 + 24,878 + 24,861 x3 = **149,601 files** (37% of the inode allowance) | With shared towns, share the cache too: `town-cache` as a symlink into `traverse-shared/town-cache/` (the content depends only on the town file; `knocks.json` and the per-kind `areas-*.json` from 1c are per install, so keep those in a per-install `town-cache-local/`). Or pack each town's areas into one file with an offset index (`a.idx` + `a.bin`), which drops 250 files per town to 3. Gain ~120,000 inodes. |
| Deploy backups | `~/upload-backups/` | 884 MB, 624 files, all October: `full-sixfold-2026-10-14-night.tgz` 100 MB, `before-yardv2-*-20261026.tgz` 5 x 11-44 MB, `before-2026-10-10b/d.tgz` 34 MB each, `data-*-before-2026-10-12.tgz`, the 42 `*.pre-*` files moved on 25 Oct | Keep the newest two per install and the monthly `full-*`; download the rest to `_archive/server-upload-backups-2026-10/` (with `MOVE-MANIFEST-*.csv`, as the archive rule asks), md5 both ends, then remove from the server. ~750 MB and ~550 files back. Adopt a rule: a backup older than the one after it is a candidate. |
| Nightly app backups | `sixfold-data/backups/sixfold-backup-YYYY-MM-DD.json.gz` | 22 files, ~110 KB each, 1.1 MB | Fine. Add a 60-day prune to `nightly-backup.php` (keep the 1st of each month). |
| Growing logs | `sixfold-data/rounds/taplog-2026-10.log` 570 KB/month; `squarehook.log` 266 KB; `leads/*.pre-democlean-20261020` copies | small | `taplog` already rolls monthly; gzip months older than two (`taplogread` 3041 reads only the current and previous month). Move the two `.pre-democlean` files to `~/upload-backups/`. |
| Lookup files | `*-lookup.json` | 97 files, 56 MB per install | Part of the shared-towns move. |

## 4. Correctness and security, found on the way

What is right and should stay: HMAC-signed cookie (`rounds.php:489-511`), HttpOnly + SameSite=Lax + Secure
(`startSession` 1917-1921), every request re-looks the person up by code id (`rounds.php:2944` onwards), one device per
class, sign-in throttled per IP and site-wide with failures-only counting (587-623, 2005-2015), `search` 150/10 min, `photo`
120/hour with size, dimension and per-door caps (3515-3531), region keys and photo names regex-checked before any path
(645, 1402), atomic writes for whole files (`writeJsonAtomic` 1745), `LOCK_EX` on every append, View-as validated and
read-only for non-super (2910-2920), Claude Check on an allow-list (2924-2931), CSV cells through `csvSafe`, `X-Robots-Tag`
and `Referrer-Policy` on the API, data outside `public_html`.

| Flag | file:line | What | Risk | Suggested change |
|---|---|---|---|---|
| **Half-written uploads of rounds.php** | server `public_html/api/php_errorlog`: "PHP Parse error: Unterminated comment starting line 2934" x4, "Unclosed '('" x3, "Unterminated comment starting line 879" x2, "... line 1819" x2, "Unclosed '['" x2, "unexpected string content" x5 | Each is a window in which every request to every Sixfold screen failed; the file is written in place by `tar xzf -` over SSH on a connection that drops | Outage per deploy, silent unless someone taps at that moment | Upload to `rounds.php.new`, verify md5, `mv -f rounds.php.new rounds.php` (atomic on the same filesystem); same for every `*-rounds.php`. Put it in `traverse-deploy-over-ssh`'s procedure. |
| **Memory exhausted x6 on 25 Oct** | same log; `searchIndexFile` `rounds.php:1145` | Fixed that day by streaming; the index is absent on Sixfold now, so the next first search rebuilds it inside a request | A slow first search per upload; a repeat if a town grows past the limit again | Build nightly (1c). Watch the log for the message after the next upload. |
| No cap on door views for a session | `area` accepts 40 neighbourhoods per POST (`rounds.php:3287`); `viewCount` (545-560) only **logs** at 20,000 doors/day | A stolen crew cookie (45-day life) can read a whole town (Denver, 50,000 doors) in ~30 requests; the design note at the top of the file promises "~26 doors and not 2,656" | Policy, not a bug: Matthew's call | A per-person daily ceiling for `crew` only (e.g. 3,000 doors; office, desk, admin and Claude Check exempt), answered 429 with a message the page shows; the counter already exists. |
| Two phones rebuild the towns answer at once | `rounds.php:3178-3279` | No lock around the recompute; both pay the full cost and race on the write (atomic, so no corruption) | Doubled CPU at busy moments | `flock` on a lock file; the loser serves the previous cache file if its head still matches an older sig, else waits. (Folds into 1c.) |
| `adSpendReminder` writes without a lock | `rounds.php:5719-5720` | A date-stamp file; two writers can only write the same date | none | Leave, or `LOCK_EX` for consistency. |
| `sw.js` keeps door answers for 7 days | `sw.js` `MAX_AGE`, `KEEP` | Names and addresses on a shared iPad until sign-out or 7 days; by design and documented | known | Nothing; noted so it is not re-raised. |
| `document.write` of an iframe on load | `index.html:11` | The layout preview frames the page in itself with `location.href`, quotes escaped | none found | Nothing. |
| `innerHTML` sites | `index.html` 16 sites, all with literal markup or sanitised path data (`paintCompany` 2545-2554 strips `d`/`fill`); `4628` inserts an SVG string the page builds | no user text reaches them | none | Nothing. |
| Peak desk, prospect desk, assistant | `matthew/peak-pickleball-sponsorship/app/api/desk.php` (319 lines), `scan.php`; `traverse/prospect-desk/app/index.html` (514 lines); `assistant/hub/index.html` | Not reviewed line by line in this pass (the ask was the field app and its data) | unknown | A separate short pass; they follow the same single-file pattern at a tenth of the size. |

## 5. Order of work

Quick wins first; each line says what it buys. Items 1-3 touch only files nobody else is editing tonight except
`rounds.php` (coordinate with the worker changing the app).

1. **Untrack the pipeline caches** (`git rm --cached` + `.gitignore`, 3b). Ten minutes; stops a 140 MB commit tonight.
2. **Per-town `regions` cache with a lock** (`rounds.php:3152-3280`, 1c). Half a day. The towns screen after a mark goes
   from seconds to under 100 ms; the largest CPU saving on the plan.
3. **Side files split per neighbourhood in `townSplit`** (`rounds.php:206-216, 684-710, 3309-3338`), hoist the two
   per-area decodes at 3406/3409. Half a day. Big-town door lists from ~400 ms to ~30 ms and a tenth of the memory.
4. **Sig handshake for `regions`** (page `17651-17660`, API `3172`), then the towns/areas split. Half a day. No 4.7 MB
   parse per open; 700 KB less per open.
5. **Spanish dictionary out of the page** (`sync-es.cjs`, `engine.js`). One hour. 49 KB less per open for every English
   phone.
6. **Atomic uploads and a nightly search-index build.** One hour. Ends the parse-error outages and the first-search stall.
7. **Server tidy:** archive `~/upload-backups/` to the laptop's `_archive/` with a manifest (3c); move the two
   `.pre-democlean` files. One hour. ~800 MB and ~550 files.
8. **Shared towns and town-cache across the six installs** (3c). One day with verification. ~3.5 GB and ~120,000 inodes;
   needed before a seventh install.
9. **LiDAR cache** (3a): Matthew decides external drive or delete; either way 228 GB back. Texas first.
10. **Wind event dedupe** in the pipeline (1d). Half a day. ~120 MB per install, faster decodes.
11. **Sixfold-365 and integrations into includes** (2). One to two days. Smaller edition APIs and a readable `rounds.php`.
12. **Desk/office JS split** (1a). Two days. ~40% less JS compiled on crew phones.
13. **Town-file compaction** (1d). Only if disk or decode time still matters after 2, 3 and 8.

Expected effect of 1-7 together: the two slow paths crews feel (towns after a mark, opening a big neighbourhood) drop by
an order of magnitude, the page loses 16% of its wire weight, the server's CPU-second use falls by the largest single
component, `.git` stops growing by tens of MB per pipeline run, and ~1 GB comes back on the server. 8-9 recover the
inode headroom and the laptop's disk.

## How the figures were taken

- Sizes: `wc -lc`, `stat`, `du -sh`, `gzip -9c | wc -c`, Node `zlib.brotliCompressSync` on the dist page.
- Page analysis: a Node script over the source (class selectors vs. uses outside `<style>`, named functions vs.
  references, `es.json` keys vs. page text, `feat()`/`feature()` counts, action-block sizes). Scratchpad only; not kept in
  the repo.
- Parse timings: `php -r` with PHP 8.4 on this laptop (`json_decode` of each big file, and all 99 towns in sequence), Node
  `JSON.parse` for comparison. The shared host is slower; treat them as lower bounds.
- Server: `bash ~/.ssh/sg.sh trav '<read-only command>'`: `du`, `ls`, `md5sum`, `stat`, `find | wc -l`, `df -i`,
  `php -i`, `curl -I` against the site from the server itself, and `tail` of `php_errorlog`. No codes or config files were
  opened or printed.
- Git: `git count-objects -vH`, `git rev-list --objects --all | git cat-file --batch-check`, `git log --follow` per file.

---

## 6. What was done, 27 Oct 2026 (night)

The safe items, in this order, each its own commit, each tested against the code before it on the local harness and deployed
with `traverse/ops/deploy-app.sh` (backup, rename-into-place upload, md5 of every file, version stamps, API 401 signed out),
then checked live with the read-only Claude Check accounts. Figures are measured, not estimated.

| Item | Commit | Measured |
|---|---|---|
| 9. Rename-into-place uploads + search index off the request path | f2f1fd2 | `~/bin/safe-extract.sh` stages beside the target and `mv`s each file; used by `push-edition.sh` (backups now time-stamped), `upload-towns-sixfold.sh`, `refresh-weekly.sh`, `refresh-permits.sh` and the new `deploy-app.sh`. All six search indexes rebuilt hourly by `sixfold-tools/search-index-warm.php` (started from `morning-email.php`): 4-5.5 s each outside any request; Sixfold's, missing at review time, is there (99 MB, built 05:25 UTC). |
| 4/7. Untrack the pipeline caches | cca9e94 | `git rm --cached` of tree/lawn/value/wildfire/hoa `-cache.json` + `.gitignore`; files stay on disk and in the Drive backup; stops ~140 MB per commit. History rewrite **not** done (Matthew's call). |
| 1. Towns answer cached per town, with a lock | f55adc5 | Live Sixfold, towns answer after one town's log changed: **4.87 s -> 0.23 s**; kept answer 0.056 -> 0.040 s. Harness: answers identical to the old code for admin and crew, cold, kept and after a mark (regions-equal 6/6); a mark rebuilds only its town and the towns sharing its doors. |
| 3. Towns signature first | 58f053e | With towns in hand the phone asks `regionsig`: **72 bytes on the wire / 0.031 s** instead of the full answer's **1,076,071 bytes (4.67 MB unpacked) / 0.071 s**; the full answer comes only when the signature changed. No `JSON.stringify` of the whole list. Harness: regionsig 5/5 (yesterday's page 3/5), regions-equal 6/6. |
| 7b. Spanish dictionary out of the page | d7a5ed4 | Live page over the wire (brotli): **Sixfold 318,875 -> 269,614 bytes (-15.4%)**, editions **310,845 -> ~261,415 (-15.9%)**, every open of every English phone. Spanish phones fetch `es.json` once (55.8 KB br) and the worker keeps it. Dictionaries identical to the live inline ones (2,561 Sixfold, 2,560 editions). Harness vs yesterday's shipped page 6/6 (same Spanish screen, English never asks for es.json, Spanish with no signal); live, all six sign-in screens in Spanish. |
| 10. Archive, don't delete | c364de3 | Server: 293 `~/upload-backups` files older than 7 days (to 19 Oct) in `~/upload-backups/_archive/upload-backups-to-2026-10-19.tar` (504 MB) with a CSV manifest; every member md5-checked out of the tarball before the originals went; **550 -> 257 top-level files; bytes unchanged** (they were already `.tgz`). Laptop: the three 9 Oct upload packs (14 files, 4.3 MB, no references) into `_archive/editions-uploads-2026-10-09/` with README and manifest. |
| Small: Office "Square" item | 354c257 | Shown only where the install has a `square.json` (`me.sq`, a file check). Live: Sixfold true, the five editions false. Harness 6/6 (yesterday's code showed it with no file). |

Harness note: the local `php -S` ran at PHP's default 128 MB and had been running out of memory on sign-in, regions and stats
(626 fatals in its log); it now runs at the live 768 MB. Failures shared by old and new code (territory, onetown, readonly;
edparity 44/47) are harness state, unchanged by any of the above.

### Not done tonight, and why

- **2. Side files per neighbourhood: not done.** Writing one file per side kind per neighbourhood (about 13 kinds x ~25,000
  neighbourhoods per install) would add roughly 300,000 files per install; `town-cache/` already holds 149,601 against
  GrowBig's 400,000-inode allowance. The safe shape, for a day of its own:
  1. In `townSplit` (`rounds.php`, the per-town split), when a side file's `fileSig` changes, write **one packed file per side
     kind per town**: `town-cache/<town>/s-<kind>.bin` (each neighbourhood's rows as JSON, back to back) and
     `s-<kind>.idx` (`{"sig": "...", "a0": [offset, length], "a1": [...]}`). Two files per kind per town, ~26 per town.
  2. `loadSide($kind, $key, $only)` reads `s-<kind>.idx`, checks its `sig` against the side file's `fileSig`, and `fseek`s
     to the asked neighbourhoods' slices; on any mismatch or missing file it falls back to today's whole-file decode, so
     a finisher that uploads a new side file is never served stale rows (the sig changes with the upload).
  3. The pipeline and cloud finishers need no change (they keep uploading whole side files under the same names); the
     split happens lazily on the server. `security-*.json`'s `packed` per-door strings can go once this is in.
  4. Test: area answers byte-identical to the old code for every edition's biggest town (Denver, Aurora, Parker), cold
     and after a side-file upload; inode count per install before/after (expect +~2,500).
  Also left: hoisting `permit-index.json` and `loadAreaFlags` out of the area loop: the town key is fixed for the loop,
  the flags come from the per-request memo, and `permit-index.json` is 1,997 bytes, so the saving is microseconds.
- **5. LiDAR cache (228 GB) and 6. shared towns / town-cache symlinks: not touched**, waiting for Matthew.
- **Server bytes from `~/upload-backups`:** reclaiming the ~500 MB means moving the tarball off the server (to the laptop's
  `_archive/`) and removing it there; left for Matthew, since it takes the only server-side copy away.
- **Seen on the way:** the phone fetches the full towns answer twice on first open (the after-sign-in preload and
  `refresh()` race); yesterday's page does the same. A one-line guard would halve first-open bytes; not changed tonight.
