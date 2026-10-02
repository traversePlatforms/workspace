# Door territory — walk lists from public county records

**Built 2026-09-29** (TASKS.md SX-9). Turns a place name and a radius into a
**street-ordered list of doors worth knocking**, with the reason for each door on the line.

```
node build-walklist.mjs --place=monument --radius=1.5
node build-walklist.mjs --lat=39.0917 --lon=-104.8722 --radius=2 \
                        --min-acres=0.2 --max-acres=2 --out=monument.csv
```

Known places: `monument` · `palmer-lake` · `black-forest` · `larkspur` · `gleneagle` ·
`woodmoor`. Anywhere else, pass `--lat` and `--lon`.

**Everything comes from El Paso County's own public GIS services.** Nothing is scraped from a
web page and nothing is bought.

## First real run — Monument, 0.7 mile radius

| | |
|---|---|
| Parcels in the box | 1,314 |
| In the 0.18–2.5 acre band | 624 |
| **Doors to knock** | **320**, average 0.35 acres, across 68 streets |
| Post instead — owner does not live there | 237 |
| Unresolved | 67 |

Densest streets, which is where a first route should start: **Lake Side Dr (35 doors), McShane
Pl (29), Leisure Lake Dr (23), Candletree Cir (18).**

## How it decides who to knock

**1. Lot size, computed from the parcel geometry.** Area is derived from the polygon itself,
not read from a field, so a change of projection upstream cannot silently corrupt every lot
size. The county's `STArea__` is used only as a cross-check and the script warns if more than a
fifth of parcels disagree by over 15%.

**⚑ `STArea__` is in square feet** — measured, not assumed: computed true ground area against
the county figure gives a median ratio of 10.7476 against the 10.7639 sq ft per square metre
you would expect.

**2. Does the owner actually live there?** This is the part that took two attempts.

The parcel layer carries the owner's **mailing** address, never the property's own address. The
first build tried to recover the property address by **reverse geocoding the parcel centroid**.
That fails twice over: this locator has no rooftop address points, so it interpolates from
street centrelines, and on odd or large parcels it snaps to the nearest road — producing rows
reading `0 0 INTERSTATE 25`. It also reported 596 of 624 owners as non-resident, which is not
what suburban Monument looks like.

**The working method inverts it.** For an owner-occupied home the mailing address *is* the door
address, and it comes straight from the county rather than being interpolated. So the script
**forward geocodes the mailing address and measures how far it is from the parcel.**

**⚑ The 150 m threshold is measured, not chosen.** On a 14-parcel sample the distances came out
cleanly bimodal with nothing in between:

```
on the parcel      24, 34, 37, 43, 45, 67, 70 m
somewhere else     491 m … 7.8 km
```

150 m sits in the middle of an empty gap. **Re-measure it before trusting it somewhere
different in character** — dense townhouses or true ranch land may not separate as cleanly.
`--near-metres=` overrides it.

A PO box mailing address skips the lookup: it can never be a door.

## What it deliberately does not do

**No phone numbers.** Parcel records do not carry them, and appending them turns a walk list
into a **cold-call list**, which brings the federal Do Not Call rules and per-call penalties
with it. Knocking carries none of that. This is a design boundary, not an omission — see
`../Sixfold-Door-Territory.pdf`.

## ⚑ Outputs are gitignored, on purpose

`*.csv` and `.address-cache.json` are excluded from git. The data is public record, but each
file is **a list of named private individuals at their home addresses**, and this repo is
mirrored to OneDrive. They regenerate in a few minutes; nothing is lost by not keeping them.

## Known rough edges

- **Unresolved rows (~11%)** are addresses the locator would not match at score 85 or better.
  They are not necessarily bad doors, just unconfirmed ones.
- **A stray `BOX 361`** can survive inside an otherwise normal street address. The PO-box filter
  only catches `PO BOX` / `POBOX`.
- **El Paso County only.** Teller and southern Douglas publish their own rolls in their own
  formats and are not wired up. One county is a fair test; three is a project.
- **No zoning filter.** `Public/ZoningConsolidatedEPC` exists and carries a `ZoneCategory`
  field; the acre band plus the owner-occupancy test already removes most commercial parcels,
  so it was left out rather than half-built.
- **✅ Wildfire layer: built 2026-10-01** — USFS Wildfire Hazard Potential via `sample-wildfire.mjs`;
  see [WILDFIRE-HAZARD.md](WILDFIRE-HAZARD.md). The note below is the old reason it was blocked.
- **No wildfire layer yet.** `Public/TetraTechWUI` is there and carries a `gridcode`, but
  **nothing on the service documents what the gridcode values mean**, so mapping them to hazard
  classes would be inventing a legend. Needs the source document before it goes in.

## The services used

| What | Endpoint |
|---|---|
| Parcels, owners, mailing addresses | `Public/MailingLabelParcels/MapServer/0` |
| Address lookup | `Public/Composite_Locator_Pro/GeocodeServer/findAddressCandidates` |

**⚑ Do not swap in `Public/EPCPortalLocator2026`** — it resolves to parcel numbers rather than
street addresses. It was tried first.

**⚑ The bulk assessor download is blocked to scripts.** `EPC-Parcel-Data-*.zip` on
`epc-assets.elpasoco.com` returns **403** to any automated request regardless of headers. It has
richer fields (land use, improvement use, values) and would be worth having — but it needs a
manual browser download. The GIS services above are not blocked and are what this runs on.

---

# The crew sheet — `Sixfold-Walk-List.pdf`

A spreadsheet is the wrong object to hand someone in a truck.

```
node build-walklist-pdf.mjs monument-test.csv              # biggest lots first
node build-walklist-pdf.mjs monument-test.csv --by-street  # walking order
```

One command: it writes the HTML, renders the PDF, and **asserts that sheets equals pages**.

**Grouped by region, then biggest lot first**, as asked. Monument at 0.7 mi comes out as
**12 sheets — 282 doors in Monument, 20 in Palmer Lake.** Region comes from the parcel's city,
so it splits itself without being told to; when Teller and Douglas are wired up they become
their own sections automatically.

**⚑ Biggest-first is a priority order, not a route.** Sorted purely by size a rep drives across
town between doors. `--by-street` ranks streets by their best lot and then walks house numbers
in order, which is the version to print if the goal is doors-per-hour rather than
biggest-job-first. The sheet's own footer says which one it is.

**Three tick boxes per door — no answer / not now / quote booked.** That is the reason to print
it rather than email it. A list that comes back blank taught us nothing; one that comes back
marked gives the knock-to-quote rate, which nothing else in the business measures.

## ⚑ Two filters that only became obvious after looking at the render

The first PDF put **a water district, two churches and half a dozen LLCs at the top of the
biggest-lots page** — the worst possible opening for a lawn route. They passed the
owner-occupancy test legitimately: the entity really is based at that address.

- **Non-residential owners are filtered on the owner name** — LLC, INC, CHURCH, DISTRICT, TOWN
  OF, WATER, SANITATION and so on. **TRUST and FAMILY are deliberately kept**, because a family
  trust is a normal way to hold a lived-in home. `--include-business` turns it off.
- **Duplicate addresses are collapsed** — one owner can hold two touching parcels, and that is
  one door.

On the Monument run these removed **15 non-residential owners and 3 duplicates**.

**The lesson is the general one: render it and look at it.** Both defects were invisible in the
CSV and obvious on the page.

## Neighbourhoods — the default ordering

Sorting purely by lot size sends a rep across town between doors. Sorting purely by street
ignores that the best lawns are worth reaching first. **The default now does both:** find the
neighbourhoods, rank those by how good their lawns are, and walk each one whole.

```
node build-walklist-pdf.mjs monument-test.csv            # neighbourhoods (default)
node build-walklist-pdf.mjs monument-test.csv --by-size  # biggest lots first, ignores geography
node build-walklist-pdf.mjs monument-test.csv --by-street
```

Each sheet is one pocket, headed with what it is worth:

> **Lake Meadow Dr area** — Monument · 4 doors · average lot 2.46 acres, best 2.49
> **Mcshane Dr area** — Monument · 21 doors · average lot 0.66 acres, best 1.88

**Method: single-link clustering on the parcel centroids at 250 m** (`--cluster-metres=`).
Houses in a subdivision chain together door to door, while arterials, open land and the
interstate leave gaps wider than the threshold — so the clusters come out as real pockets
rather than arbitrary boxes. Union-find over a grid, one pass.

**The centroids come from the CSV**, which now carries `lat` and `lon` per door. An older CSV
without those columns will not cluster — regenerate it.

**Each cluster is named after its most common street**, because "McShane Dr area" is something
a crew can find and "Cluster 3" is not.

### Known trade-offs

- **Single-link chains.** A continuous ribbon of housing merges into one large cluster. That is
  usually correct — it really is one walkable area — but cluster size is not bounded, so a big
  subdivision becomes several sheets of the same place.
- **Small pockets get their own sheet.** A 4-door cluster prints on a page that fits 26. More
  paper than `--by-size`, but each sheet is a place you finish and leave.

---

# Other counties — what is actually available

Measured 2026-09-29 by querying the services, not by reading documentation.

## There is a statewide parcel layer, and it is very good

**`Colorado_Public_Parcel_Composite`** — one service, all 64 counties, aggregated by the
Governor's Office of IT from the counties themselves:

```
https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0
```

Fields: `countyName` · `situsAdd` · `owner` / `owner2` · `ownerAdd` + city/state/zip ·
**`landAcres`** · `landUseDsc` · `zoningDesc` · `saleDate` · `salePrice` · `apprValTot`.

That is strictly richer than what El Paso publishes directly: **lot size comes as a number**
instead of being computed from geometry, and **land use is a field** instead of being guessed
from the owner's name.

## ⚑ But coverage is per-county, and El Paso contributes nothing

Sampling 1,000 parcels per county for how many rows actually carry each field:

| | El Paso | Teller | Douglas |
|---|---|---|---|
| Parcels | 277,007 | 31,494 | 164,818 |
| `owner` | **0%** | 99% | 100% |
| `ownerAdd` | **0%** | 99% | 100% |
| `situsAdd` | **0%** | 79% | 82% |
| `landAcres` | **0%** | 99% | 98% |
| `landUseDsc` | **0%** | 65% | 100% |

**El Paso contributes geometry only** — every attribute is blank. The statewide layer cannot be
used for our home county, which is exactly why the existing pipeline talks to El Paso's own
services directly. **Always run this coverage check before trusting the statewide layer for a
new county.**

## So, in service-area order

- **El Paso** — working now, via the county's own services. The harder build, and done.
- **Teller and Douglas** — available and *easier* than El Paso. Acres and land use come as
  fields, and 80% carry a property address, so those doors need no geocoding at all. The
  ~20% without one fall back to the owner-mailing-address method already built.
- **Anywhere else in Colorado** — same statewide service, subject to the same coverage check.
  ⚑ Sixfold's service area is El Paso / Teller / southern Douglas and **widening it is
  Brandon's call**, so data availability is not the constraint here. Willingness to drive is.

**Douglas is the best next county to add:** 100% owner and land-use coverage, and its
`landUseDsc = 'Residential'` replaces the owner-name guessing the El Paso build has to do.

## Teller and Douglas — `build-walklist-co.mjs`

```
node build-walklist-co.mjs --place=castle-rock --radius=1.5
node build-walklist-co.mjs --place=woodland-park --radius=1.2
node build-walklist-co.mjs --county=DOUGLAS --lat=39.44 --lon=-104.96 --radius=2
node build-walklist-co.mjs --coverage=DOUGLAS      # check a new county first
```

Places: `castle-rock` · `sedalia` · `larkspur` · `franktown` (Douglas) ·
`woodland-park` · `divide` · `florissant` · `cripple-creek` (Teller).

**Same CSV out, same PDF step.** Only the source differs — and it differs a lot:

| | El Paso (`build-walklist.mjs`) | Teller / Douglas (`build-walklist-co.mjs`) |
|---|---|---|
| Source | the county's own GIS services | the statewide parcel composite |
| Property address | **absent** — recovered by geocoding | on the record |
| Lot size | computed from geometry | `landAcres` field |
| Residential filter | guessed from the owner's name | `landUseDsc` field |
| Owner-occupied test | geocode + distance | string comparison |
| Speed | minutes (one lookup per door) | **seconds — no geocoding at all** |

First runs: **Castle Rock 1 mi → 1,216 doors, average 0.28 acres. Woodland Park 0.8 mi →
1,143 doors, average 0.52 acres** — noticeably bigger lawns up the pass.

**⚑ Teller fills `sitAddCty` on 0% of rows** (Douglas fills it on 100%), so every Teller sheet
came out headed "Unknown" until a fallback was added to the place name. Expect fields to be
missing per county and check rather than assume — `--coverage` exists for this.

## ⚑ Dense towns broke the clustering, and the first fix was worse

Woodland Park is continuous housing, so single-link at 250 m merged **the entire town into one
"neighbourhood" of 1,143 doors across 44 sheets** — technically true, useless in a truck.

The first fix re-clustered oversized groups at a tighter distance, recursively. That **shattered
it into 334 sheets averaging three doors each** — single-link at short range breaks into
per-street crumbs.

**What works is a grid split.** An oversized cluster has its own bounding box cut into roughly
`doors / MAX_DOORS` cells, each kept whole; cells with fewer than six doors fold into the
biggest neighbour. Cells are contiguous by construction, so every piece is still walkable, and
the sheet count lands where you expect. Woodland Park now comes out as **24 named
neighbourhoods over 54 sheets**, and Monument is unchanged at 17.

`--max-area=` sets the cap, default 55 doors — about two sheets.

## One PDF per area

Each run now writes **`Sixfold-Walk-List-<Area>.pdf`**, named from the CSV, so books do not
overwrite each other:

```
node build-walklist-pdf.mjs monument-test.csv    ->  Sixfold-Walk-List-Monument.pdf
node build-walklist-pdf.mjs castle-rock.csv      ->  Sixfold-Walk-List-Castle-Rock.pdf
node build-walklist-pdf.mjs woodland-park.csv    ->  Sixfold-Walk-List-Woodland-Park.pdf
```

**Each sheet inside is one neighbourhood** — that is the unit to hand someone for the day, not
the whole book.

**⚑ The PDFs are gitignored too**, for the same reason as the CSVs: each one is hundreds of
named private individuals at their home addresses.

## ⚑ Long owner names silently spilled pages

Castle Rock rendered **59 sheets as 62 pages**. A wrapped owner name makes its row taller than
the 26 px the pagination is sized against, and the extra rows push off the bottom — invisible
unless the page count is checked, which is why every build asserts `sheets == pages`.

The owner column is now clipped to one line with an ellipsis. The address and the lot size are
what a door is chosen on; the full name is in the CSV if anyone needs it.

## Rebuilding the door data — the full pipeline (2026-10-01)

1. **Snapshot** `../../site/data/rounds/` first.
2. Builder per town — `build-walklist.mjs` (El Paso) or `build-walklist-co.mjs` (statewide), with
   that town's radius and `--out=<town>.csv`.
3. `node build-walklist-pdf.mjs <town>.csv` — writes the sidecar (with coordinates) and the book.
4. `node sample-wildfire.mjs` — fire hazard per coordinate, incremental, cached.
5. `node build-rounds-data.mjs` — the files the app reads.
6. `node verify-superset.mjs <snapshot>` — **must say PURE SUPERSET before any upload.**
