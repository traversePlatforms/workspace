# Brian Skelton — aeration, overseed and fertilize, $400 (2026-10-05)

**Customer:** Brian Skelton · (303) 396-9050 · bskelton@pauleyc.com · 5171 Starflower Ct, Castle Rock, CO
**Job:** full core aeration, overseeding, fertilizing. **$400.00 fixed**, first payment $200.00 on or before the first day of work, $200.00 on completion.
**Date:** not yet agreed. Section 6 of the agreement is left blank for it.
**Monthly:** he is also to be a **$100/month** client. **On hold until Matthew has more information** (Matthew, 2026-10-05). Not in this packet.

## Files

| File | Pages | For |
|---|---|---|
| `quotes/Sixfold-Quote-and-Agreement-Aeration-Brian-Skelton.pdf` | 6 | **The one to send** and to upload to DocuSign: quote in front, then the agreement |
| (no standalone quote) | | Removed 2026-10-05: Matthew opened it looking for the agreement. Packet only. |
| `quotes/_part-quote-brian.pdf`, `agreements/_part-agreement-brian.pdf` | 1, 5 | Intermediate. **Never send.** |

Sources: `quotes/brian-aeration.src.html`, `agreements/brian-aeration-agreement.src.html`. Rebuild:

```
node quotes/build.mjs && node agreements/build.mjs
node tools/html-to-pdf.mjs brian
python tools/merge-pdf.py quotes/Sixfold-Quote-and-Agreement-Aeration-Brian-Skelton.pdf quotes/_part-quote-brian.pdf agreements/_part-agreement-brian.pdf
```

## Built from Kara's aeration pair; what changed

- Parties, price and payment split.
- **No seed or fertilizer quantities.** Kara's said 200 lb / 150 lb; none were given for this job, so none are promised. Section 2 already says the mix and analysis go on the work record.
- **"Two crew on site" removed** from section 2: not given for this job.
- **Section 6:** no date, no signing deadline, no Columbus Day note.
- **Clause 10:** "the date in section 6 is held" in place of Kara's fixed date.
- **Three leftovers from the tree job tidied** (they were in Kara's too): clause 4 "before any stump grinding or ground disturbance" → "before any ground disturbance"; clause 6 "removing trees" → "this work"; clause 8 examples now a rock shelf, an unmarked line, a hornet nest (were hidden rot, a hazard lean, a stump on a boulder).
- **Descriptor** is "Lawn, Land & Fire", the one decided 2026-09-28. Kara's documents still carry the older "Land & Fire".
- **Water line on the quote:** Castle Rock Water's temporary irrigation exemption for new seed (30 days, any day, still before 8am / after 8pm), worded "if the property is on Castle Rock Water" because the provider for this street is not confirmed.

## ⚑ Flags for Matthew

1. **Who supplies the seed and fertilizer.** Carried from Kara's job: Sixfold supplies them, inside the $400. If Brian is supplying them, sections 2 and 5 and the quote change.
2. **Watering in on the day and blowing the hard surfaces** are carried from Kara's job as Sixfold's standard aeration visit. Not stated for this job.
3. **The 50/50 split** follows the packet rule; $200 / $200.
4. **When a date is agreed:** fill section 6, and sign at least three business days before work starts (Sundays and federal holidays do not count; Saturday does). Work done inside the cancellation window earns nothing if he cancels.
5. **Brandon fills the Notice of Cancellation dates** on both copies at signing (the division of labour from 2026-09-14). Blank dates are the legal risk. In DocuSign, **do not put signature tags on the Notice of Cancellation pages** (the Kara envelope had optional ones).

## From the door app (internal only, not on any customer document)

The lot is in the door data (Castle Rock, Starflower Rd area): **0.35 acres**, county value about $740k. The 2023 aerial reads it as **mostly trees, with almost no open lawn visible**, and LiDAR has heavy tree cover within 5 ft of the house. Worth a look at the walk: how much turf there is to aerate, and the trees near the house are a fire-mitigation conversation. The agreement already says the walk, not an area written in advance, fixes the scope.

## Fact-check log

| Claim | Source | Status |
|---|---|---|
| Name, phone, email, address, price, services | Matthew, 2026-10-05 | As given |
| $100/month maintenance on hold | Matthew, 2026-10-05 | Not in packet |
| Castle Rock Water temporary irrigation exemption: 30 days for seed, any day, time-of-day rule applies | `sixfold/research/water-restrictions-2026.md` (grade A: crconserve.com / crgov.com) | Used, conditional on the provider |
| Castle Rock Water serves this street | — | **Unconfirmed**; worded "if" |
| Materials supplied by Sixfold; water-in; blow-down | Carried from Kara's job | **Flagged** (1, 2) |
| Clause citations (4, 7, 9, 10, 11) | Checked against the rendered pages | Correct |
| Page counts: quote 1, agreement 5, packet 6; agreement at scale 1 (10.5pt notice type) | Rendered 2026-10-05 | Correct |
