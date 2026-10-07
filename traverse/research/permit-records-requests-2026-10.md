# Building permit data requests (draft, not sent)

**For:** Matthew to review and send himself, if he wants TraverseRoofing and TraverseSolar to know which houses in these towns already have a new roof or solar panels.
**Status:** draft, 2026-10-07. Nothing has been sent.

## Why

Since 2026-10-07 the Roofing and Solar cards show each door's latest re-roof permit and any solar permit, and Best first sinks a house re-roofed after its hail, or one that already has panels. That works where the building department publishes its permits:

| Covered | Source |
|---|---|
| Colorado Springs (all four), Security-Widefield, Fountain, Monument, Palmer Lake, Black Forest | Pikes Peak Regional Building Department, public permit map service |
| Woodland Park (city limits only) | Pikes Peak Regional Building Department |
| Highlands Ranch, Sedalia, Franktown, Larkspur (county permits only) | Douglas County building division, open data |

These towns issue their own permits and publish no bulk list that we found (checked 2026-10-07):

| Town | Editions it's in | Where to send | Notes |
|---|---|---|---|
| Castle Rock | Roofing, Solar | Town of Castle Rock **Open Records Center** (crgov.com/1977/Open-Records). You make an account. | The town says emailed requests are not honored. Permits run through its eTRAKiT system. |
| Parker | Roofing, Solar | Town of Parker open records form (parkerco.gov/138/Open-Records-Request) | |
| Castle Pines | Roofing, Solar | City of Castle Pines; its public records policy was amended 2026-02-10. Find the request form or clerk's email on castlepinesco.gov. | I couldn't confirm the submission route. |
| Arvada | Solar | City of Arvada "Records and Requests" page (arvadaco.gov/797/City-Records), online form | |
| Centennial | Solar | City of Centennial; find its records request page on centennialco.gov | I couldn't confirm the submission route. |
| Thornton | Solar | City of Thornton City Clerk (its policy is Administrative Directive 3-06) | Thornton posts a monthly permit report as a PDF (about two years back). The request asks for the longer history in a spreadsheet. |

**Fees:** Colorado's open records law lets a town charge for research time after the first hour. The letter asks for an estimate before any work starts. Check each town's fee on its own page; I didn't verify their rates.

**Timing:** towns normally answer within three business days, which can be extended by seven more.

**Before sending:** fill in the bracketed parts. The letter asks for addresses, dates and permit types only, never owner or applicant names. If a town sends names anyway, they stay in the private pipeline folder and are never published, like the county files.

---

## The letter

> **To:** Records Custodian, [Town / City of ...]
> **From:** Matthew Sharpe, [email], [phone]
> **Date:** [date]
> **Subject:** Open records request: residential re-roof and solar permits, 2016 to date
>
> Under the Colorado Open Records Act (C.R.S. 24-72-201 et seq.), I'm requesting a list of residential building permits issued by [Town / City of ...] from January 1, 2016 to the present, for these work types only:
>
> - re-roofing or roof replacement
> - solar photovoltaic (rooftop solar) installation, removal, or removal and reinstallation
>
> **For each permit, only:**
> - permit number
> - property address (and parcel or schedule number, if you keep it)
> - permit type or work description
> - date issued (and date finaled, if you keep it)
> - permit status
>
> I'm not asking for owner, applicant or contractor names, plans, or any other documents.
>
> A spreadsheet or CSV export from your permit system would be ideal. If your permit system can run this as a saved report, a copy of that report answers this request.
>
> If there is a fee, please send me the estimate before starting. If any part of the request is denied, please say which part and why.
>
> If this list can be provided again on a schedule (for example monthly), I would also like to know how to receive it.
>
> Thank you,
> Matthew Sharpe

---

## When a file comes back

Drop it in `traverse/data-pipeline/door-territory/permits/raw/` (create the folder; it stays out of git) and tell Claude which town it is. `build-permits.mjs` already matches doors by parcel number or by address. A new source is a short reader plus one line in its town list.

## Fact-check log

| Claim | Checked against | Result |
|---|---|---|
| Castle Rock takes requests through its Open Records Center and doesn't honor emailed requests | crgov.com/1977/Open-Records (search result text, 2026-10-07) | Verified |
| Parker has an online open records form | parkerco.gov/138/Open-Records-Request (search result text) | Verified as listed; form not opened |
| Castle Pines amended its public records policy on 2026-02-10 (Resolution 26-09) | castlepinesco.gov policy PDF title | Verified; the submission route was not found |
| Arvada takes requests through an online form on its Records and Requests page | arvadaco.gov/797/City-Records (search result text) | Verified. A $30/hour fee also appeared, but it may belong to the Arvada Fire Protection District, so it was left out |
| Thornton's CORA policy is Administrative Directive 3-06, and it posts monthly permit reports as PDFs | thorntonco.gov (policy PDF; report URLs, May 2026 report opened 2026-10-07) | Verified |
| Centennial's submission route | not found | Unresolved: find it on centennialco.gov |
| Three business days, extendable by seven | Colorado open records law, as summarised on several Colorado government pages | Verified |
| The state's hourly fee cap | one search summary gave a figure; not traced to the statute | Left out |
| No bulk permit data published by these six towns | ArcGIS Online catalog and web searches, 2026-10-07 | No dataset found; a town could still publish one we missed |
