# Mailing list: owners who don't live at the property

**Built 2026-10-03.** Nothing has been mailed. Rebuild: `node ../build-mail-list.mjs` (after any
walk-list rebuild), then `node ../tree-zones/sample-trees.mjs --mail` for tree readings, then the
builder again to pick them up.

## What it is

The walk lists keep only doors where the owner lives there. Everyone else is on this list:
landlords, second-home owners, investors, family trusts holding a house for someone else. Nobody
answers the door for them, so they get a letter.

| | |
|---|---|
| Properties whose owner lives elsewhere (11 towns) | 10,948 |
| Government-owned, left off | 390 |
| Owned by HOAs and metro districts, on their own list (`communities.csv`) | 351 parcels, 117 owners |
| **Mailable properties** | **10,207** |
| **Letters** (one per mailing address) | **7,483** |
| Owners with more than one property | 861 (3,586 properties; 107 own five or more) |

**Who they are** (by letter): 5,239 people · 1,055 trusts · 1,031 companies · 58 churches and
nonprofits · 100 mixed.

**Where they are:** 3,331 elsewhere in Colorado · 1,531 out of state (most from Texas 265,
California 211, Florida 127, Arizona 100) · 1,601 PO boxes · 791 very close by · 229 unknown.

**Fire hazard** (highest across the owner's properties): 626 very high · 2,257 high ·
1,711 moderate · 283 low or very low · 2,603 not rated (town or farmland on the 270 m map; not
"safe"). **2,883 letters cover a high or very-high hazard property, 541 of them out of state.**

## Files

- `mail-recipients.csv`: **one row per letter.** Name(s), mailing address, owner type, where they
  are, how many properties, total acres, highest fire hazard, most trees near a house, towns, and
  every property address. Sorted with the highest fire hazard and most properties first.
- `mail-properties.csv`: one row per property, with the letter it belongs to, its address and where
  that address came from, fire hazard, trees near the house, owner, parcel number and position.
- `communities.csv`: parcels owned by HOAs, property owners' associations and metro districts.
  Mostly common land. A different pitch, and it lines up with the HOA list in
  `../hoa-registry/HOA-LIST.md`.
- `summary.json`: the counts above.

## Who to write to first

- **Out-of-state owners with a high-hazard property.** They can't see the lot, they likely have
  insurance asking questions, and they need someone local. 541 letters.
- **Owners of several properties.** One letter, several jobs. 861 letters; the top owners are
  builders and developers with dozens of lots.
- **Trees against the house** (once the tree column is filled): the same reading the door app
  shows, for properties nobody has walked.

## Read these before using it

- **A PO box doesn't mean they live elsewhere.** In Cripple Creek, Divide, Florissant and parts of
  Woodland Park, many residents only get mail at a PO box. Cripple Creek has 916 properties on this
  list and 55 knockable doors for that reason. The letter still reaches them.
- **"Very close (may live on the lot)"** means the owner's address is within about 0.3 miles in El
  Paso, where the occupancy check works by distance. Many of these 791 probably live there.
- **The name is the owner on the county record**, which isn't always who reads the mail. Trusts go
  to the trustee; companies often to a property manager.
- **El Paso property addresses are matched, not recorded.** The county's parcel data has no
  property address, so each lot takes the state address point that sits inside it. Checked against
  311 doors whose address is known: **96% right** (300 of 311). Where a lot has several points
  (duplexes, apartments) the first one without a unit number is used, and the file says how many.
- **756 El Paso lots have no address point at all.** Most are probably vacant land. They show as
  "parcel <number>". For fire work a vacant wooded lot is still a job, but the letter has to name
  the lot another way.
- **Don't make the letter look official.** Under federal law (39 U.S.C. § 3001(h)), a sales mailer
  that could reasonably be read as coming from or being endorsed by the federal government can't be
  mailed without set disclaimer wording on the piece and the envelope. A "wildfire notice" style
  invites exactly that reading. Write it as Sixfold.
- **Before printing**, have the mail house standardise the addresses and check them for
  change-of-address. Owner records lag behind moves.

## Fact-check log
- **Source of owners and mailing addresses:** the walk-list CSVs (El Paso County MailingLabelParcels;
  Colorado statewide parcels for Douglas and Teller), built 2026-09-29 to 2026-10-01.
- **El Paso property addresses:** Colorado_Public_Addresses (state address points, 342,821 in El
  Paso, none carrying a parcel number), matched by point-in-parcel against El Paso's parcel
  outlines, 2026-10-03. **Corrected on the way:** the county locator's reverse geocode was tried
  first and got the house number right on only 24 of 219 known doors. It's now only a fallback,
  used where it answers with its own parcel point (71 properties).
- **Duplicates:** neighbouring towns' search circles overlap; 1,476 parcels were listed under two
  towns and are kept once.
- **Owner type** is read from the name (LLC, TRUST, ASSOCIATION...). Banks named "National
  Association" were landing in the HOA list; fixed. Expect a few misreads in a list this size.
- **Fire hazard:** USFS Wildfire Hazard Potential 2023, 270 m, the same source as the door app.
- **39 U.S.C. § 3001(h):** read at law.cornell.edu, 2026-10-03, including the required wording
  ("THIS PRODUCT OR SERVICE HAS NOT BEEN APPROVED OR ENDORSED BY THE FEDERAL GOVERNMENT...") and the
  envelope notice ("THIS IS NOT A GOVERNMENT DOCUMENT").
- **Unresolved:** occupancy for PO-box owners, and whether "very close" owners live on the lot.
