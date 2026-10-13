# Money sheets in the door-rounds app: sources and fact-check log

**Built 2026-10-02 (SX-23).** The three short internal sheets that open from a door card's
"Fire-work money" row: **Tax credit · Insurance · Grants**. The Grants sheet changes with the town's
county. These sheets are for the crew and are not handed to customers.

The content lives in [money.json](money.json). It goes to the private data folder
(`sixfold-data/rounds/docs/money.json`), not to `public_html`. The app fetches it after sign-in,
so a fact can be corrected by uploading the JSON alone, with no new page upload.

**Why sheets and not per-door flags:** counted across all 31,422 doors on 2026-10-02.
- The tax credit applies to any private Colorado land, so a per-door flag would light up every card.
  The real deciding factors (income, who files) are not in the parcel data.
- No door is 40+ acres, so the Forest Ag property-tax classification applies to none.
- Insurance is carrier-specific with no set rate. The best per-door signal is the existing fire badge.
- The one county programme, Douglas County's cost-share, applies to 10,094 doors across 4 towns.
  That is why Grants is county-aware.

**Water (added 2026-10-04).** money.json also carries a `water` block: the Water line on each door card
(aeration: water before and after; the town's provider rule; in the six mostly-well towns, the well rule for a lot
of that size) and a four-tab sheet (This town · Wells · Permits · Say). Every line comes from
[../../../../research/water-restrictions-2026.md](../../../../../sixfold/research/water-restrictions-2026.md), checked
**2026-09-30**, and its fact-check log covers it. Providers that were not checked (Donala, Triview, Palmer
Lake, Cripple Creek, every scheme outside Colorado Springs and Castle Rock) say "not checked" in the app
rather than guessing. Re-check the provider pages before the 2027 season; drought stages move without warning.

**Water for the north-Douglas towns (added 2026-10-07, for the Traverse editions).** Each line comes from the
district's own website, checked **2026-10-07**:

- **Highlands Ranch:** Highlands Ranch Water (Centennial Water and Sanitation District),
  [water-conservation](https://centennialwater.specialdistrict.org/water-conservation). Stage 1 drought restrictions are
  in effect: two days a week, no watering 10am to 6pm from 1 May to 30 September, and outdoor water budgets end
  15 October. The days (odd addresses Wednesday and Saturday, even Thursday and Sunday) and the March 2026 start come
  from the district's announcement,
  [highlands-ranch-water-implements-stage-1-drought-restrictions](https://centennialwater.specialdistrict.org/highlands-ranch-water-implements-stage-1-drought-restrictions).
- **Parker:** Parker Water and Sanitation District, [Watering Restrictions](https://www.pwsd.org/3366/Watering-Restrictions).
  - Even addresses water Sunday, Tuesday and Thursday; odd addresses Monday, Wednesday and Saturday.
  - No watering from 10am to 6pm.
  - New sod needs a permit in season.
  - The daytime limit and the permit ended for the year on 1 October.
  - Other districts serve parts of Parker; the card says to ask.
- **Castle Pines:** Castle Pines North Metropolitan District,
  [2026 watering schedule](https://cpnmd.specialdistrict.org/2026-watering-schedule).
  - Three days a week through September.
  - Lawns only between 8pm and 8am.
  - New sod or plants may be watered daily for 21 days.
  - The even and odd days (Sunday, Tuesday and Thursday; Monday, Wednesday and Saturday) are from the district's 2026
    schedule image and bill insert, not the page's text.
  - **Castle Pines Village has its own district, not checked**; the card says to ask.
- **Not used:** a sprinkler company's page that mixed Parker, Colorado with Parker, Texas.

**Corrected 2026-10-04:** the card said "Aeration needs no watering", from the research's headline "Aeration does
not need water". Colorado State University Extension says water thoroughly the day before, water soon after, keep
watering regularly, and don't core-aerate a lawn that is brown or dormant from water restrictions (PlantTalk
[1505](https://planttalk.colostate.edu/topics/lawns/1505-lawn-aeration/) and [1534](https://planttalk.colostate.edu/topics/lawns/1514-insects-2/)). The card now says "Aeration: water before and after", and the sheet
explains why. **Not changed, Brandon's call:** the well-town sheets still say "sell aeration, mowing or cleanup"
for a household-only well, where the lawn often can't legally be watered and may be dormant.

**Derived from:** [../../../../tax-credit-notebook/README.md](../../../../../sixfold/tax-credit-notebook/README.md) and
[../../../../research/mitigation-funding-directory.md](../../../../../sixfold/research/mitigation-funding-directory.md),
including the refresh at the top of the directory.

## Fact-check log

### Verified
- **Tax credit amounts, eligibility, qualifying and non-qualifying work, and how it is claimed.**
  - Source: Colorado Department of Revenue, *Income Tax Topics: Wildfire Mitigation Measures*, read in full 2026-08-21 and recorded in the notebook README.
  - 2026: the income limit is still **TBD**, re-checked 2026-10-02.
  - 2027–2030 changes ($2,000, refundable, AGI ≤ $300,000): HB26-1289, enacted text.
- **Insurance.**
  - HB25-1182 has been in force since 1 Jul 2026.
  - Draft DOI Regulation 5-1-28 adds:
    - website posting of discounts with amounts, or a statement that there are none;
    - re-scoring within 30 days of receiving evidence;
    - appeals acknowledged in 10 days and decided in 30;
    - evidence that includes receipts, photos and contractor letters;
    - coverage of admitted insurers and the FAIR Plan only.
  - Read from the Division's PDF on 2026-10-02.
- **Douglas County.** Read first-party on 2026-10-02:
  - 50% match: $25,000 home, $50,000 community, $7,500 chipping;
  - the county pays the contractor directly after inspection;
  - two bids, a scope of work and a site map;
  - a site visit before approval;
  - work starts only after the award is signed, with 10 months to finish;
  - the 2026 round is closed;
  - "Residents may choose any qualified contractor". The list is preferred, not required;
  - Sixfold is not on the August 2026 list.
- **Teller County.** The $1M COSWAP grant funds a buffer zone protecting Woodland Park infrastructure, with no homeowner component (KOAA).

- **Water, the four towns added 2026-10-12** (each provider’s own page, read 2026-10-12):
  - Thornton: Thornton Water, April/May 2026 newsletter (thorntonco.gov): Stage 1 from 15 March, lawns two days a week of the homeowner’s choosing, none 10am–6pm.
  - Commerce City: South Adams County Water & Sanitation (southadamswaterco.gov, conserve.southadamswaterco.gov): Stage 1 declared 13 May, two days a week by address, new seed/sod 21 days then twice a week, season ends 15 October.
  - Centennial: Denver Water (denverwater.org, editor’s note on the summer rules page): Stage 1 from 25 March 2026, two assigned days, none 10am–6pm, 1 May to 1 October. Other Centennial districts not checked.
  - Erie: erieco.gov notices disagree on the current stage (April Stage 2 voluntary notice; a later rescinded emergency). Left as "ask" by the research standard.
  - Rejected: a search summary gave "Erie" a Level 2 schedule that was the Town of Silt’s bulletin; a commercial aggregator (lawnbyseason.com) for South Adams days.
- **Water, South Denver and Englewood (added 2026-10-12):** South Denver reuses the Denver Water facts above (denverwater.org, Stage 1 from 25 March 2026, read 2026-10-12). Englewood has its own utility (Englewood Utilities), not researched yet, so its line says "ask" and it has no sheet.
- **Water, Aurora (added 2026-10-12):** card line "Aurora Water: ask" only. Aurora Water's own watering rules were not read; no sheet until they are, so the card states nothing it has not checked.

### Corrected while building
- **The Douglas County rule.** The project rule that Sixfold must never name the cost-share until it is on the approved list rested on reading "preferably from the list" as a requirement. The crew may now mention it, with the "don't say" lines.
- **Douglas chipping cap:** $7,500, not $7,000.
- **A search summary gave $120,000 as the 2026 income limit.** That is wrong: it is the 2023 figure, and DOR says TBD.

### Unresolved, deliberately left off the sheets
- **The effective date of Regulation 5-1-28.** The draft PDF says 14 Feb 2026 and a trade summary says 1 Oct 2026. They conflict, so no date is given.
- **Whether entity-owned land qualifies for the tax credit from 2026.** The sheet sends companies to an accountant.
- **The next Douglas County window.** Not announced.
- **Any El Paso or Teller fire-district rebate.** None confirmed. Check with Black Forest Fire, Tri-Lakes Monument Fire and the NE Teller districts before naming one.
- **HB26-1310** (homeowner home-hardening grants) was postponed indefinitely on 2026-03-23, so it is not on the sheets.
