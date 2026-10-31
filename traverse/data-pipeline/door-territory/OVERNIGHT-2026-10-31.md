# Overnight cloud queue, 30-31 Oct 2026

Matthew was asleep. The laptop was on hotel Wi-Fi (Woodspring_GUEST), never the phone hotspot. Only one gis.colorado.gov job ran
at a time. Times are UTC.

## What ran and what went live

| # | Stage | Result | Live |
|---|---|---|---|
| 0 | hailhours (hail hours for every hail town and day) | 275 days, 238 with hours, 1,934 town-days; 8,932 radar files read | **Yes, Roofing.** `hail-hours.json`, MD5 MATCH, live md5 273e33b2adcd |
| 1 | g2mat (roof material, Larimer) | 83,244 doors with a material in 14 towns: 81,672 county records, the rest photo calls and "probably" | **Yes, Roofing + Solar.** 43 files per edition, MD5 MATCH |
| 2 | centlawn (Centennial lawns, yard v2) | 8,881 no-lot doors measured again: 8,811 now have a lot, 70 still don't. 7,985 door cards changed | **Yes, Sixfold + all five editions.** MD5 MATCH on each |
| 3 | TR-36 (13 counties with no statewide parcels) | Every county looked at. **Nothing built:** no county has a public source whose terms clearly allow reuse | n/a |
| 4 | commercial (internal building list) | 73,803 parcels in 22 counties: commercial 51,219, industrial 14,095, apartments 8,489 | **No, never.** Stays in `commercial/out/statewide-2026-10-31/` (gitignored) |

### 0. Hail hours

The cloud build finished at 08:45. The finisher's third try then stopped. The reason: the plan file carries its build date, so
restaging it after midnight UTC gave an identical plan a new tag, and the tag check failed. Fixed in
`finish-hailhours-2026-10-29.sh`: a cloud plan that differs only in its `built` date is now used as is. The fixed finisher was run
by hand and went live. Of the old file's town-days, 133 were kept and 3 are not in the rebuild. The old copy is in the scratchpad
(`hailhours/hail-hours.before.json`).

### 1. Roof material: Larimer yes, Mesa and Pueblo no

- **Larimer.** Source: the assessor's Public Data Center, larimer.gov/assessor/publicdata, file `assessor-public-improvement.csv`.
  It has no owner fields. Its `RUNDATE` is 24 Aug 2026.
  - The page's terms are a disclaimer only: "The data shall be used and relied upon only at the risk of the user", "Larimer County
    makes no warranties, representations, or guarantees". The data is described as free and public. That is the same footing as
    the Adams, Weld and Boulder files the editions already use.
  - `assessor/build-year.mjs` now reads it: roof cover, roof type, year built, remodel year and size. The largest residential
    building on each parcel counts as the house.
  - Year files were built for the 13 Larimer Group 2 towns, plus Berthoud's Larimer side (Berthoud: 60 doors before, 4,399 now).
  - On the cloud machine: crops, features and predict for each town (NAIP via Planetary Computer, not gis.colorado.gov).
  - Per town, doors with a material: Fort Collins 31,981 of 32,009; Loveland 21,672 of 21,703; Loveland rural 6,498; Fort Collins
    rural 4,561; Berthoud 4,382 of 4,431; Timnath 3,413; Wellington 3,173; Berthoud rural 1,916; Timnath-Wellington rural 1,653;
    Estes Park rural 1,363; Estes Park 1,280; Livermore rural 852; Laporte 415; Red Feather Lakes 85.
  - Wood shake is common in Larimer's records: Fort Collins 3,312, Loveland 1,011. As the README says, shake labels go stale after
    a re-roof.
- **Mesa: no roof material.** Mesa's open parcel layer (mcgis.mesacounty.us, Open_Data layer 55) has no roof field, and no Mesa
  roof-cover download was found. Mesa also has no laser roof file, so the photo model can't run there either.
  - What Mesa did get: year built (`AYB1ST`) for its 15 Group 2 towns, 38,423 doors. These year files went to Roofing and Solar.
  - Mesa's terms: "distributes GIS data sets as a service to the public", with no commercial restriction (recorded 29 Oct in
    moved/README.md).
- **Pueblo: skipped.** The assessor's search runs on a per-parcel vendor site (puebloco-search.gsacorp.io). There is no bulk file
  and no open service carrying building fields. Only paid resellers list Pueblo roof cover.

### 2. Centennial lawns

**Cause.** The 25 Oct west-side doors had their lot cells saved on the old grid origin, before the fix in `e8cf845`. The cloud
copy of `yard-v2-town.mjs` was older still.

**Fix.**
- The cloud machine got the current script.
- The no-lot doors were cleared and measured again. That took 18.6 minutes at about 5.5 doors/s, with 0 errors.
- The finisher checked the result: same door ids, no earlier reading lost, more lots than before.
- It then built `yard-v2-lawn.json` and the door files, and uploaded Centennial only: Sixfold through upload-towns-sixfold, label
  `centlawn-20261031-0253`, which replaced the one index entry; the five editions with an exact filter.

**Sanity check.**

| | Median lawn (sq ft) | Median lot (sq ft) | Lawn as share of lot |
|---|---:|---:|---:|
| Newly measured Centennial doors | 3,337 | 10,355 | 0.32 |
| Rest of Centennial | 2,508 | | 0.28 |
| Littleton | 2,949 | | 0.30 |
| Columbine | 3,035 | | 0.30 |

The changed cards' median went from 600 to 3,600. The old figure was the pre-v2 photo estimate, which is known to read low. Most of
the changes move up a level: S to L 2,024, N to L 1,149, S to M 896.

### 3. TR-36: the 13 counties

None was built. The rule was to skip any county whose terms are unclear or forbid reuse. Detail is in TASKS.md TR-36. In short:

- **Blocked by written terms:**
  - Fremont: the GIS Authority's layer is "NOT licensed for public or third-party use"; its data is for sale.
  - Chaffee: "Chaffee County is the only entity where this data can be purchased".
  - Otero: no redistribution without an agreement.
- **Public layer but no licence text** (unclear, so ask first): Cheyenne (4,649 parcels, plus an improvements layer with roof cover
  and year built), Phillips (5,503), Moffat (10,590).
- **Nothing public in bulk:** Prowers, Kit Carson, Lincoln, Baca, Crowley, Jackson, Kiowa.

### 4. Commercial building list (internal only)

- **Statewide part.** `commercial/pull-statewide.mjs` ran on the cloud machine against the state parcel layer: one county at a
  time, one request at a time, with pauses. It asked only for the parcel id, property address, lot size, land use, zoning and
  appraised value. No owner fields.
- **El Paso.** `commercial/el-paso-list.mjs` read the assessor's weekly file and skipped the owner and mailing columns: 9,105
  parcels.
- **Biggest counties:** Denver 13,805, El Paso 9,105, Larimer 8,471, Arapahoe 7,546, Adams 7,430, Weld 6,732, Jefferson 5,806,
  Mesa 4,088, Douglas 3,192.
- **22 counties came back empty.** Their state rows have no land-use text: Boulder, Logan and Morgan have none at all; Pueblo,
  Garfield and Clear Creek use local codes; Summit has state codes only. A later pass could use Boulder's own `Buildings.csv` and
  the state abstract codes.
- Counts are in `counts.json` beside the files. Nothing was uploaded, published or committed. The cloud copy is in
  `~/run/ovn1031/commercial-out`.

## Queued now

Nothing. The cloud queue (`~/run/ovn1031/queue.sh`) finished all three of its jobs at 07:44, and every laptop finisher has run.
**The cloud machine is idle.** No queued job is left that the rules allow:

- TR-36 waits on county permissions.
- Pueblo and Mesa roof material wait on a county file.
- Jefferson and Arapahoe roof records (TR-35) wait on records requests.

## Cloud machine cost

These are estimates from list prices, not from the Azure bill.

- Machine: Standard_D4as_v5 in Sweden Central. Running, it costs roughly $4-5 a day.
- About $170 of trial credit is left, and the trial ends around 23 Nov. If the machine stays on until then, it uses roughly
  $100-115 of that.
- Since it is idle now, stopping (deallocating) it until the next job would save most of that. The disk costs little while
  stopped.
- Stopping it is Matthew's call. The finishers need it running only while a job runs.

## Files

| File | What it does |
|---|---|
| `overnight/queue-1031-vm.sh` | The cloud queue |
| `finish-g2mat-2026-10-31.sh` | Laptop finisher for stage 1 |
| `finish-centlawn-2026-10-31.sh` | Laptop finisher for stage 2 |
| `finish-commercial-2026-10-31.sh` | Laptop finisher for stage 4 |
| `traverse/ops/run-cloud-finishers.sh` | Now lists stages g2mat, centlawn and commercial |
| `commercial/pull-statewide.mjs`, `commercial/el-paso-list.mjs` | Build the commercial list |
| `assessor/build-year.mjs` | Now reads Larimer and Mesa |

Each stage's `.done` marker is set in `%LOCALAPPDATA%\ProjectBackup\cloud-finish`, so the overnight check will not run any of them
again.

**Rollback:**
- Scratchpad `g2mat/before*.tgz`, `centlawn/centennial.before.json` and `centlawn/centennial.door.before.json`, `hailhours/hail-hours.before.json`, `ovn1031/year-g1-berthoud.before.json`.
- The server's time-stamped `before-push-*` backups and `~/upload-backups/before-centlawn-20261031-0253.tgz`.
- On the cloud machine: `~/run/ovn1031/vm-backup/` and `~/run/ovn1031/centennial.before.json`.
