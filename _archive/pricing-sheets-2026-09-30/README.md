# Rate and service sheets A–D — set aside 2026-09-30

Matthew, 2026-09-30: *“those are very old and we don’t use them that often or reference them.
Most of our pricing comes from Brandon and Brad and whatever jobs we’ve actually worked and
completed.”* He asked to keep whichever ones carry that real data. **None of them do.**

## Where the real pricing data actually lives — none of it was touched

| File | What it carries |
|---|---|
| `quotes/rates-brandon-brad-2026-09-23.md` | Brandon and Brad’s own rates |
| `quotes/walk-2026-09-14-job2.md` | Job 2’s recorded costs — dump fee, fuel, rentals, crew days. The first real actuals |
| `quotes/quote-engine.md` + the artifact | The live cost-up engine, $100/man-hour since 2026-09-23 |
| `operations/cost-rates.md`, `work-rates.md` | The crew sheets that capture actuals on the job |

## Why each sheet went

| Sheet | Why |
|---|---|
| **A, B, C** | Priced off the rate card that **lost money on Sedalia** — job 2’s costs show it would have quoted **$1,038 against ~$1,450 of real cost**. They also still carry stump grinding, crew time and the old county line |
| **D** | No prices, so not wrong about money. But its service list is Brandon’s from 25 August — felling, tree removal, brush, trimming, slashing, chipping — with **no aeration, no mowing, no lawn work**. It predates the aeration-led rebrand and omits the lead service |
| **Rate Card INTERNAL** | The printable form of `pricing-guide.html`, the card the guide itself says not to quote from |

## What stayed, and why

**`marketing/pricing-guide.md`** — it opens with *“Do not quote from this card”* and then records
four faults found in the source re-check, **left uncorrected on purpose** because the file is the
record of what was built and why. That is worth more than the card ever was. Its *printable*
forms came here, so nobody prints it by accident.

**`marketing/services-onesheet-d.md`** — it records Brandon’s capability list verbatim and the
caveat he gave with it: *“Once I know for sure what we are limited to I’ll update you.”* That
caveat is the reason nothing else in the project was changed to match the list, and it should
stay readable.

**Records stay, artefacts go** — the same line drawn for the Sedalia notes and for
`operations/business-cards.html`.

## Generators

Five JOBS entries in `tools/html-to-pdf.mjs` were removed in the same commit.
