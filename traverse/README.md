# Door App (working name)

Matthew's door-knocking app: walk lists from public county parcel records, a door card per house, territories, a pipeline, customers, and the office tools around them. **"Door App" is a placeholder until the company name is picked**; the folder gets renamed with it.

**It is Matthew's, not Sixfold's, Surge's or Stringline's.** He planned and built it himself (with Claude), on his own computer, after moving to 1099 in August 2026, with no agreement assigning it to anyone. Sixfold is its first user and runs it on sixfoldcolorado.com until the app has its own domain and hosting. Moved out of `sixfold/` on 2026-10-04.

**Who it is for next:** roofing companies paying for it, Colorado first, county by county. Roofing would replace lawn size with hail history per door, roof age and roof size (see the 2026-10-04 notes in the project memory).

## Layout

The folders mirror the old `sixfold/` layout on purpose, so every script and link kept working through the move. Reshaping them comes with the product work, not before.

| Folder | What | On the server today |
|---|---|---|
| `site/summit-de59ae83/` | The app page, service worker, manifest, icons, `.htaccess`, and [DEPLOY-ROUNDS.md](site/summit-de59ae83/DEPLOY-ROUNDS.md) (every upload, newest first) | `public_html/summit-de59ae83/` |
| `site/api/` | `rounds.php` (the whole API) and `skiptrace.php` (always uploaded together), plus the example config files | `public_html/api/` |
| `site/tools/` | The cron jobs: nightly backup, morning email, skip trace | `sixfold-tools/` (beside public_html) |
| `site/data/rounds/` | The built door files per town (owners' names: never inside public_html) | `sixfold-data/rounds/` (beside public_html) |
| `operations/door-territory/` | The data pipeline: county records to door files, lawn size, trees, wildfire, HOAs, the mailing list; plus the scope docs, the demo (APP-SHOWCASE.html), the guide (APP-GUIDE.html) and the Yardbook comparison | Not uploaded |

## Company settings: one file per install (2026-10-04)

Nothing about one company is written into the code any more. Each install has a **`company.json`** beside its door files (on the host: `sixfold-data/rounds/company.json`; Sixfold's copy is `site/data/rounds/company.json`). It holds:

| Setting | What it changes |
|---|---|
| `name`, `short`, `tagline` | The sign-in screen, the bar, the install button, the tab title, texts sent to homeowners, the fire report, the morning email, backups, calendar files |
| `phone`, `email`, `site`, `appUrl` | "To change it, call …" in the booking text, the report footer, the morning email's link, who the app says it is to the weather service |
| `visit`, `visitShort` | What booking the quote books: "yard walk" / "Walk" for Sixfold, "roof inspection" / "Inspection" for a roofer. Renames Book the walk, Walk booked, Walks coming up |
| `logo` | The mark (an SVG path). None: a monogram of the first letter |
| `colors` | Optional overrides of the colour tokens, light and dark |
| `services`, `leadNeeds`, `extraWork` | The customer services, the enquiry "what do they want" list, the extra-work chips at the door. The server checks against the same lists |
| `card` | Which parts of the door card show: `lawn`, `trees`, `fire`, `money`, `water` (missing = shown; a part with no data never shows). Admins can also switch one device to **Roofing preview** on the tools screen |
| `features` | Tools switched on: `quote` (Quote builder), `communities` (HOA / Firewise screen), `firecheck` (fire check + report), `skiptrace` |
| `links.googleReview` | The Ask for a review link |

**Nothing in it is secret**: the page reads it before anyone signs in. Never put a key, a code or a price in it. [company.example.json](company.example.json) is a made-up roofing company, and the template for the next install.

**What the settings do not cover yet:** the door data itself (lawn size, trees, wildfire come from the data pipeline, so a roofer's door files are simply built without them, and those parts of the card disappear on their own); `manifest.json` and the icons (each install uploads its own); the morning email's wording ("walks"); and the code comments, which still tell the app's history with Sixfold and can be read by anyone who opens the page source. Stripping comments is a build step to add before a second company goes live.

## Hail per door (2026-10-04, admins only)

The first roofing piece, switched on by `features.hail`. NOAA's radar estimate of the largest hail within about 1 km of each house, per day, April to September since 2020 (MRMS MESH, archived by Iowa State). Built offline with `operations/door-territory/hail/build-hail.mjs` (`fetch`, then `build`); it writes `hail-<town>.json` and `hail-storms.json` beside the door files. The app shows them only to admins: a **Hail** screen (storm days, newest first, and the neighbourhoods each one hit) and a hail line on the door card. It is an estimate that runs smaller than ground reports for big stones; see [research/ROOFING-DATA-CHECK-2026-10.md](research/ROOFING-DATA-CHECK-2026-10.md). Not updated automatically yet: re-run fetch and build, then upload the hail files.

## Roof size, pitch and year built (2026-10-04, admins only)

Switched on by `features.roof`. Two offline builders write files beside the door files (gitignored, regenerable):

- **`operations/door-territory/roofs/sample-roofs.mjs`** measures each house's roof from the USGS laser scans already on this computer (El Paso 2018, Douglas 2020): footprint from the building outline slid onto the roof, pitch from a small plane fitted across the roof cells, area = footprint / cos(pitch), and squares (100 sq ft). Then `--build` writes `roof-<town>.json`. 21,530 of 26,674 doors measured; 98% of the houses with no roof in the scan were built in or after the scan year. Teller has no laser scan.
- **`operations/door-territory/assessor/build-year.mjs`** matches the free county files (downloaded into `assessor/raw/`, gitignored: owners' names) to the doors by parcel: year built for El Paso and Douglas, plus year remodeled, roof shape and roof material for Douglas. Writes `year-<town>.json`. 98.6% of doors matched.

Checks against Douglas County's own roof records: 0.2% of gable and hip roofs read as flat; median pitch 5/12; footprints match county building sizes (median ratio 1.04). Both are estimates and the card says so.

## Hail map, live radar, roof photos (2026-10-05, admins, Roofing preview)

- **Hail map:** each storm on the Hail screen has "Show on the map": the day's radar hail path as ~1 km squares coloured by size (from `hail-paths.json`, written by `build-hail.mjs build`). Opens with live radar off.
- **Live radar:** "Live radar map" on the Hail screen: NOAA NEXRAD national composite through the Iowa Environmental Mesonet's public tile cache, refreshed every 5 minutes; an on/off button under the map.
- **Roof photo:** "See the roof (aerial photo, 2020)" on the roof line. The Denver Regional Aerial Photography Project's 2020 photos at 3 inches a pixel, published by the State of Colorado on AWS Open Data, public domain (`s3://colorado-public-imagery/DRAPP/DRAPP2020/Imagery/`, 5,461 files). The files are stored in 128 px blocks, so the page reads only the blocks over the house (1-2 MB) straight from the bucket; nothing is stored on our server. Framed on the house (centre and size from `roofs/sample-roofs.mjs`). Coverage: all of Castle Rock, most of Franktown and Sedalia (8,503 doors); not Larkspur or El Paso. Built with `roofs/photo-index.mjs index` then `build`, which writes `photo-<town>.json`.

## What else inside this app is Sixfold's

- `site/data/rounds/company.json`: Sixfold's settings.
- `site/data/rounds/docs/money.json` and `MONEY-SHEETS.md`: Sixfold's prices, funding and water notes.
- The crew codes file, which **stays** at `sixfold/site/api/rounds-codes.php` (on the server, in `sixfold-private/`).
- The Quote builder, which **stays** in Sixfold: `sixfold/site/summit-de59ae83/quote.html`, built from `sixfold/quotes/`. `sixfold/site/build-quote-page.mjs` still stamps its version into this app's `index.html`.
- The website contact form (`sixfold/site/api/submit.php`) files Sixfold's enquiries into the app's leads.
- `manifest.json` and the four icons in `site/summit-de59ae83/`, the walk-list PDFs (printed with Sixfold's style and PDF tool) and the leads, customers and logs on the server.

## Uploading

Unchanged by the move: files from `door-app/site/` go to the same places on the Sixfold host as before. Sixfold's own site bundle (`sixfold/site/make-bundle.mjs`) no longer carries any app file; the app goes up file by file, as it always has.
