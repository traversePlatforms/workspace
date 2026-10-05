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

## What inside this app is Sixfold's

The app is one company's install today. These parts are Sixfold's install, not the product:

- `site/data/rounds/docs/money.json` and `MONEY-SHEETS.md`: Sixfold's prices, funding and water notes.
- The crew codes file, which **stays** at `sixfold/site/api/rounds-codes.php` (on the server, in `sixfold-private/`).
- The Quote builder, which **stays** in Sixfold: `sixfold/site/summit-de59ae83/quote.html`, built from `sixfold/quotes/`. `sixfold/site/build-quote-page.mjs` still stamps its version into this app's `index.html`.
- The website contact form (`sixfold/site/api/submit.php`) files Sixfold's enquiries into the app's leads.
- Sixfold's name and look in the page, the walk-list PDFs (printed with Sixfold's style and PDF tool) and the leads, customers and logs on the server.

Turning those into per-company settings is the first product step.

## Uploading

Unchanged by the move: files from `door-app/site/` go to the same places on the Sixfold host as before. Sixfold's own site bundle (`sixfold/site/make-bundle.mjs`) no longer carries any app file; the app goes up file by file, as it always has.
