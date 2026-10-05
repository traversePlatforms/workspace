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
| `features` | Tools switched on: `quote` (Quote builder), `communities` (HOA / Firewise screen), `firecheck` (fire check + report), `skiptrace` |
| `links.googleReview` | The Ask for a review link |

**Nothing in it is secret**: the page reads it before anyone signs in. Never put a key, a code or a price in it. [company.example.json](company.example.json) is a made-up roofing company, and the template for the next install.

**What the settings do not cover yet:** the door data itself (lawn size, trees, wildfire come from the data pipeline, so a roofer's door files are simply built without them, and those parts of the card disappear on their own); `manifest.json` and the icons (each install uploads its own); the morning email's wording ("walks"); and the code comments, which still tell the app's history with Sixfold and can be read by anyone who opens the page source. Stripping comments is a build step to add before a second company goes live.

## What else inside this app is Sixfold's

- `site/data/rounds/company.json`: Sixfold's settings.
- `site/data/rounds/docs/money.json` and `MONEY-SHEETS.md`: Sixfold's prices, funding and water notes.
- The crew codes file, which **stays** at `sixfold/site/api/rounds-codes.php` (on the server, in `sixfold-private/`).
- The Quote builder, which **stays** in Sixfold: `sixfold/site/summit-de59ae83/quote.html`, built from `sixfold/quotes/`. `sixfold/site/build-quote-page.mjs` still stamps its version into this app's `index.html`.
- The website contact form (`sixfold/site/api/submit.php`) files Sixfold's enquiries into the app's leads.
- `manifest.json` and the four icons in `site/summit-de59ae83/`, the walk-list PDFs (printed with Sixfold's style and PDF tool) and the leads, customers and logs on the server.

## Uploading

Unchanged by the move: files from `door-app/site/` go to the same places on the Sixfold host as before. Sixfold's own site bundle (`sixfold/site/make-bundle.mjs`) no longer carries any app file; the app goes up file by file, as it always has.
