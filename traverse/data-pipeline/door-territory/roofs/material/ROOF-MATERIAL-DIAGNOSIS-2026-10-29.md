# Roof material: why it returned nothing (overnight, 29 Oct 2026)

You asked: find out why the roof-material model returns nothing, and fix it if it's a code problem. Nothing is live.
Nothing went into `app/data/rounds`, nothing was uploaded and no town files were rebuilt. Every test ran in a scratch
copy on the cloud machine (`~/matdiag/`).

## What's wrong

**Two separate problems. Only the first one is a code problem.**

1. **The cloud machine never had the county files, so the model was switched off for Group 1.** The roof-material scan
   moved to the cloud machine on 26 Oct (`group1/queue2.sh`). The model needs each town's `year-<town>.json` (year built
   and the assessor's roof material). Those files are built on the laptop from the county downloads in `assessor/raw/`.
   That folder holds owners' names, so it never goes to the cloud. On the cloud machine `predict.py` found no year file
   and took it to mean the county has no data. It wrote an empty material file and moved on.
   - The contradiction in the Greeley log has a simple cause. `features.py` correctly found 20,060 crops with enough
     clear roof. `predict.py` then threw them all away at the "no year/roof data" step, and only after that printed
     "0 usable crops".
   - Greeley's year file was already on the laptop, carrying **20,011 Weld County roof records**. Across the 30 Group 1
     towns in Weld, Boulder and Adams the laptop holds **46,440** of them. None reached the model.
   - Nobody caught it because the smoke test was Morrison. Morrison is in Jefferson County, which has no data, so
     "nothing" was the right answer there.

2. **A second bug turned up along the way: Boulder and Weld spell the materials differently, and the code only knew
   Douglas County's spellings.** Boulder writes "Asphalt", "Metal", "Shake" and "Rubber Membrane". Weld also writes
   "Shingle Comp" and "Metal Ribbed". Any record spelled another way was dropped as unknown. That cost about **44,000**
   county records in towns that are already live: Longmont 13,584, Boulder 11,387, Lafayette 3,807, Erie 3,795,
   Commerce City 3,147, Louisville 3,031, Superior 1,799 and more. Most of those houses still got a photo call or a
   "probably" guess. They should have had the county's answer.

3. **Not a bug: 39 towns (262,527 doors) have no county roof data anywhere.** These are Arapahoe (Aurora, Centennial,
   Englewood, Littleton, Greenwood Village and others), Jefferson (Lakewood, Golden, Wheat Ridge, Ken-Caryl, Evergreen,
   the Group 1 Jefferson towns), Broomfield and Clear Creek (Idaho Springs). Arapahoe publishes nothing in bulk (noted
   10 Oct), and we hold no Jefferson or Broomfield file. For these towns the model abstains on purpose: without year
   built it was never 90% right. See "Honest limits" below.

## Evidence

- On the cloud machine `ls app/data/rounds/year-g1-*` lists 0 files. On the laptop the same command lists 30.
- `coverage.json`: every town with zero calls has `structural_data: false`. Every town with `true` got calls.
- The scratch copy ran the 26 Oct `predict.py` on La Salle and got exactly the cloud result: "653 doors, 0 usable
  crops, total 0".
- Door IDs in the laptop's year files match the cloud's door and features files (Greeley: 20,057 of 20,060).

## What I changed (commit `75957d2`, code only)

- `predict.py` **stops instead of writing an empty file** when a town sits in a county we hold assessor data for
  (`assessor/town-county.json`) but its year file is missing. It exits with an error, so the queue won't mark the town
  done or delete its crops. The log now prints how many crops were clear before any gate.
- `predict.py` also skips photo calls if the features table was made before the year file arrived. Otherwise the model
  would run with no year built at all.
- `features.py` now re-fills just the county and year columns in an existing features table when a year file turns up
  later (`python features.py --struct <town>` does only that). The photo numbers stay as they were, so **the crops the
  queue deleted are not needed again**.
- Boulder's and Weld's spellings now map onto the five classes. Slate has no class and stays out. "Wood Shingle" counts
  as shake; say if you'd rather leave it out. The model trains on Douglas only, so the model and its 90% thresholds have
  not changed.

## Test result (scratch copy on the cloud machine, not live)

| Town | Before | After | County record | Photo call | "Probably" |
|---|---:|---:|---:|---:|---:|
| Greeley (20,060 doors) | 0 | 20,054 | 20,010 | 11 | 33 |
| Evans (4,465) | 0 | 4,463 | 4,443 | 6 | 14 |
| La Salle (653) | 0 | 652 | 644 | 1 | 7 |
| Nunn (97) | 0 | 88 | 88 | 0 | 0 |
| Longmont (22,371) | 175 county | 13,759 county | 13,759 | 2,440 | 6,055 |

Longmont's total barely changes. What changes is that about 13,600 houses go from a photo call or a guess to the
county's own record.

Nunn gets no photo calls because none of its 97 houses has a building outline. That's a separate gap in the outline
data and has nothing to do with this bug.

## What a re-run would take

All of it runs on the cloud machine. It's light work: no new photos, no lot lines, no gis.colorado.gov.

1. Copy the 30 Group 1 year files from the laptop to the cloud machine (a few MB). Then run `features.py --struct` and
   `predict.py` on them. **About 10 minutes.** Towns: Greeley, Greeley rural, Evans, Johnstown, Johnstown-Milliken
   rural, Milliken, Severance, Eaton, La Salle, Kersey, Gilcrest, Pierce, Nunn, Ault, Ault rural, Berthoud, Aristocrat
   Ranchettes, Todd Creek, Shaw Heights, North Washington, Bald Mountain rural, Pine Brook Hill, Lazy Acres, Paragon
   Estates, Altona, Allenspark, Eldora, Eldorado Springs, St Ann Highlands, Sugarloaf. **Adds about 46,000 houses with
   a roof material**, almost all county records, out of 53,257 doors.
2. Run `predict.py` again on the towns already live with Boulder or Weld records. Their year files are on the cloud
   machine already. **About 5 minutes.** Towns: Boulder, Longmont, Lafayette, Louisville, Superior, Erie, Gunbarrel,
   Niwot, Lyons, Nederland, Commerce City, Lochbuie, Dacono, Brighton, Thornton, Windsor and a few with a handful each.
   **About 41,500 houses move from a photo call or guess to a county record; about 2,500 are new.**
3. Then the usual: copy back, rebuild the editions, upload. That waits for your go-ahead. It's the same path as
   `finish-material-2026-10-26.sh`, which would also need its file list to include `year-g1-*.json` on the way out.

The Group 2 scan will hit the same wall unless the year files go to the cloud first. Group 2's big counties (Larimer,
Mesa, Pueblo) aren't among the counties `build-year.mjs` reads yet, so they'd land in the "no county data" case below.

## Honest limits

**For the 39 towns with no county data, the photo alone can't clear the bar in any useful way.** Tonight I tested it
again with far more training data than on 5 Oct. Back then the model only had Douglas County's records. This time it
had about 39,000 county-labelled roofs from four counties (Douglas, Adams, Weld, Boulder) and was scored on each county
it hadn't seen. This was an experiment in the scratch copy only, and nothing about it is live.

- **Tile, shake, metal and flat:** still never 90% right in every county, with or without the LiDAR roof size.
  Overall it was right 94% of the time, but nearly all of that comes from asphalt.
- **Asphalt:** 93-98% right in each held-out county. But asphalt is already 86-97% of the roofs in those counties.
  So the model mostly says "asphalt" for nearly everything, and is about as right as that guess would be anyway.
  Douglas, which has the most tile, came out at 93% against 86% asphalt to begin with. That gain is real, but small.
- If you wanted it anyway, Aurora would get about 76,000 "asphalt" calls out of 80,000 clear crops. I haven't
  switched this on. It would be a choice to label nearly every house "asphalt", knowing it misses most metal, tile and
  shake. That's your call, and I'd describe those calls as "probably asphalt" rather than certain.

**What would actually fix those towns:** assessor roof-material records for Jefferson, Arapahoe and Broomfield. Those
are the same kind of file Adams, Weld and Boulder already give us. Jefferson and Arapahoe would cover most of the
262,527 doors. Arapahoe is noted as publishing nothing in bulk, so that one may need a records request. The other
route is a few hundred roofs labelled by hand per county, which teaches the model what metal and tile look like there.

Smaller limits:

- County records are only as current as the assessor. Weld lists 773 "Wood Shake" roofs in Greeley. The README already
  says shake labels go stale after a re-roof.
- All photos are from autumn 2023.

## Fact-check log

| Claim | Source | Status |
|---|---|---|
| No year files on the cloud machine for Group 1 | `ls` on the VM, 29 Oct 05:41 UTC | verified |
| 20,011 Weld roof records in Greeley; 46,440 across 30 Group 1 towns | laptop `year-g1-*.json`, counted against each town's door file | verified |
| About 44,000 dropped Boulder/Weld/Adams records in live towns | laptop `year-*.json` vs the class map; per town in commit `75957d2` | verified |
| 39 towns, 262,527 doors with no county data | `coverage.json` + `assessor/town-county.json` + door files | verified |
| Before/after per town | scratch runs in `~/matdiag/` on the VM, 29 Oct | verified |
| Arapahoe publishes nothing in bulk | note in `assessor/build-year.mjs` (10 Oct); not re-checked tonight | carried over |
| Re-run times | from tonight's scratch runs (Greeley predict in seconds); copy and upload not timed | estimate |
