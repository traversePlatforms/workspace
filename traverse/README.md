# Traverse

Matthew's field-sales app: walk lists from public county parcel records, a door card per house, territories, a pipeline,
customers, phones, calendars, training, and the office tools around them. **Traverse** is the product (holding company
to be Traverse Platforms LLC; nothing registered yet). Trade editions: **TraverseRoofing** and **TraverseYards** today,
Solar and Pest on the homepage only.

**It is Matthew's, not Sixfold's, Surge's or Stringline's.** He planned and built it himself (with Claude), on his own
computer, after moving to 1099 in August 2026, with no agreement assigning it to anyone. Sixfold is its first user and
runs it on sixfoldcolorado.com. Moved out of `sixfold/` on 2026-10-04 (as `door-app/`); renamed `traverse/` and grouped
on 2026-10-06 (every move is listed in `_archive/MOVE-MANIFEST-2026-10-06.csv`).

## Layout

| Folder | What it is |
|---|---|
| [app/](app/) | **The app itself: the one source.** The page, offline worker and icons (`summit-de59ae83/`), the API (`api/`), the server's cron jobs (`tools/`) and the built door data (`data/rounds/`). It is also **Sixfold's install**: these files go to Sixfold's server as they are. [DEPLOY-ROUNDS.md](app/summit-de59ae83/DEPLOY-ROUNDS.md) logs every upload. [company.example.json](app/company.example.json) is the template for a new install |
| [editions/](editions/) | **Builds the Traverse editions from `app/`**: [build-editions.cjs](editions/build-editions.cjs) makes TraverseRoofing and TraverseYards, each a separate install with its own colours, data, logins and folders. [roofing-commercial-towns.json](editions/roofing-commercial-towns.json) lists the commercial test towns only Roofing gets. `dist/` (not in git) is the output, laid out like the server, with upload zips in `dist/upload/` |
| [marketing-site/](marketing-site/) | The traverseplatforms.com homepage: `project/` is the design canvas (claude.ai/artifact/7kA7Cu7Pfh7BFyAwqVFQpb), [build-preview.cjs](marketing-site/build-preview.cjs) turns it into the web page in `preview/tp-5ea36a05/` |
| [brand/](brand/) | The brand kit: [build-kit.cjs](brand/build-kit.cjs) writes `project/`, the Design System artifact's files (claude.ai/artifact/QZ8aUZCLNXXeNc2Ns5KrkV) |
| [data-pipeline/](data-pipeline/) | `door-territory/`: county records to door files (`app/data/rounds/`), plus every per-door layer: lawn size, trees, wildfire, HOAs, the mailing list, hail, wind, roofs, year built, aerial photos, the commercial test. Also the scope docs, the demo (APP-SHOWCASE.html) and the guide (APP-GUIDE.html). Owners' names live in its CSVs and `commercial/out/`: not in git, never published |
| [research/](research/) | Roofing data checks, hail, damage thresholds, phone alerts, and the competitor audit (`competitor-audit/`, moved from `sixfold/research/`) |

## Building

```
node traverse/editions/build-editions.cjs          both editions (or: roofing / yards)
node traverse/marketing-site/build-preview.cjs     the homepage web page
node traverse/brand/build-kit.cjs                  the brand kit files
```

**After any change to `app/`, rebuild the editions** and upload what changed, so Roofing and Yards get the same fix as
Sixfold. Never edit `editions/dist/` by hand.

## The installs on the server (all on sixfoldcolorado.com for now)

| | Sixfold | TraverseRoofing | TraverseYards | TraverseSolar |
|---|---|---|---|---|
| App page | `public_html/summit-de59ae83/` | `public_html/tr-cb2e8587/` | `public_html/ty-25604fff/` | `public_html/ts-016064fc/` |
| API | `public_html/api/rounds.php` (+ skiptrace, webpush) | `public_html/api/traverse-rounds.php` (+2) | `public_html/api/traverse-yards-rounds.php` (+2) | `public_html/api/traverse-solar-rounds.php` (+2) |
| Door data | `sixfold-data/rounds/` | `traverse-data/rounds/` | `traverse-yards-data/rounds/` | `traverse-solar-data/rounds/` |
| Codes | `sixfold-private/` | `traverse-private/` | `traverse-yards-private/` | `traverse-solar-private/` |
| Comes from | `app/` as it is | `editions/dist/` | `editions/dist/` | `editions/dist/` |
| Look | Sixfold's | storm slate | field green | late-sun amber |
| On | lawn, trees, fire, quotes, communities | hail, wind, storm list, roofs, commercial towns | lawn, trees, fire, funding, water, communities | roofs, solar (sun-facing roof, shade, panels, output, power company) |

Data and codes always go **beside** public_html, never inside it. The homepage is at `public_html/tp-5ea36a05/`. When
Traverse has its own hosting, the editions and the homepage move there.

## Company settings: one file per install (2026-10-04)

Nothing about one company is written into the code. Each install has a **`company.json`** beside its door files
(Sixfold's: `app/data/rounds/company.json`; the editions' are written by `build-editions.cjs`). It holds:

| Setting | What it changes |
|---|---|
| `name`, `short`, `tagline` | The sign-in screen, the bar, the install button, the tab title, texts sent to homeowners, the fire report, the morning email, backups, calendar files |
| `phone`, `email`, `site`, `appUrl` | "To change it, call …" in the booking text, the report footer, the morning email's link, who the app says it is to the weather service |
| `visit`, `visitShort` | What booking the quote books: "yard walk" / "Walk", "roof inspection" / "Inspection". Renames Book the walk, Walk booked, Walks coming up |
| `logo` | The mark (an SVG path). None: a monogram of the first letter |
| `colors` | Optional overrides of the colour tokens, light and dark |
| `services`, `leadNeeds`, `extraWork` | The customer services, the enquiry "what do they want" list, the extra-work chips at the door. The server checks against the same lists |
| `card` | Which parts of the door card show: `lawn`, `trees`, `fire`, `money`, `water`, `fc`, `hail`, `roof` (missing = shown; a part with no data never shows). Fire weather and wildfire alerts follow `fire`; storm alerts follow `hail` |
| `features` | Tools switched on: `quote`, `communities`, `firecheck`, `skiptrace`, `hail` (storm data and the storm list), `roof`, and `roofPreview` (an admin's Roofing preview; off everywhere since 2026-10-06) |
| `links.googleReview` | The Ask for a review link |

**Nothing in it is secret**: the page reads it before anyone signs in. Never put a key, a code or a price in it.

## Roofing data (admins, `features.hail` / `features.roof`)

- **Hail per door:** NOAA's radar estimate of the largest hail within about 1 km of each house, per day, April to
  September since 2020 (MRMS MESH, archived by Iowa State). `data-pipeline/door-territory/hail/build-hail.mjs`
  (`fetch`, then `build`) writes `hail-<town>.json`, `hail-storms.json` and `hail-paths.json`. It runs smaller than
  ground reports for big stones; see [research/ROOFING-DATA-CHECK-2026-10.md](research/ROOFING-DATA-CHECK-2026-10.md).
- **Wind:** the strongest NWS Local Storm Reports within 10 miles (`wind/build-wind.mjs`).
- **Roof size and pitch:** `roofs/sample-roofs.mjs` measures each roof from the USGS laser scans (El Paso 2018,
  Douglas 2020), then `--build` writes `roof-<town>.json`. Teller has no laser scan.
- **Year built, roof shape and material:** `assessor/build-year.mjs` matches the county files (in `assessor/raw/`,
  not in git: owners' names) to the doors. Writes `year-<town>.json`.
- **Roof photos:** the 2020 DRAPP aerials (`roofs/photo-index.mjs`, `photo-<town>.json`) and the 2023 NAIP close-up
  (`roofs/material/build-naip-photos.mjs`, `naip-<town>.json`).
- **Commercial test:** `commercial/` (pull, resolve owners, enrich, build). `build-app-data.mjs` writes the com-* files
  and the Roofing-only town list, never Sixfold's index.

## What inside `app/` is Sixfold's

- `app/data/rounds/company.json`: Sixfold's settings.
- `app/data/rounds/docs/money.json` and `MONEY-SHEETS.md`: the funding and water sheets and the town→county list
  (no prices). Yards gets a copy with Sixfold's review link taken out.
- `app/data/rounds/training.json`: Sixfold's crew lessons, built from `sixfold/training/`.
- The crew codes file (on the server, in `sixfold-private/`).
- The Quote builder, which **stays** in Sixfold: `sixfold/site/summit-de59ae83/quote.html`, built from `sixfold/quotes/`.
  `sixfold/site/build-quote-page.mjs` stamps its version into `app/summit-de59ae83/index.html`.
- The website contact form (`sixfold/site/api/submit.php`) files Sixfold's enquiries into the app's leads.
- `manifest.json` and the icons in `app/summit-de59ae83/`, the walk-list PDFs, and the leads, customers and logs on the
  server.

A few comments inside the files that run on the server (`app/api/rounds.php`, the app page, `sw.js`, `tools/`) still
say `door-app/`. They were left as they are so those files stay identical to what is live; they get the new paths with
the next real code change.
