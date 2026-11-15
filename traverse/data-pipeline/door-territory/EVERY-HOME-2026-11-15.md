# Every home in Colorado (15 Nov 2026)

Matthew, 15 Nov: "I eventually want to have every residential property in Colorado on this list that we possibly can." He picked all of:

- **A.** A fresh recount, then the Front Range sweep and Huerfano.
- **B.** Townhome condos.
- **C.** Mobile homes.
- **D.** Apartment and condo buildings.
- **E.** A recurring new-construction refresh.

Plus two asks from the main session the same day:

- the full rebuild and upload for the lawn confidence mark (`y: 1`);
- yard readings for the doors that had none.

## Where it stands

| Part | State |
|---|---|
| App support for mobile homes, townhomes, buildings | **LIVE** on Sixfold 365, the five editions and practice |
| Lawn mark `y: 1` on every door file | Rebuild and upload **running** (`every1115/rebuild-upload-all-20261115.sh`) |
| Recount | **Done** on the cloud machine (state layer read 15 Nov) |
| Lawns for doors with no yard reading (76,260) | **Measuring** on the VM (stage `yardgap`) |
| A + B + C + D lists | **Built**. Measuring (stage `ehb`) is queued after `yardgap` |
| Going live with A–D | Automatic, through the Wi-Fi queue jobs `yardgap` then `every` |
| E: quarterly refresh | Scheduled. Windows task "Traverse new homes refresh", 15 Feb / May / Aug / Nov at 02:00. It needs the cloud machine |

## The rule for what is a door

The state parcel layer gives one record per parcel. In most counties a condo unit is its own parcel, so "condo" alone can't tell a townhome from a flat. The rule used is the postal one:

- **A home with its own street address is a door.** A house, a townhome, or a mobile home on its own lot.
- **Units under one shared street address are one building entry.**
  - A unit is written after #, UNIT, APT, STE, BLDG or SPC.
  - Or it is a bare unit number after the street type: "12354 W NEVADA PL 304" in Jefferson.
  - Same-address parcels stacked on one footprint also count as units (Denver's condos).
  - Units are grouped by street address + ZIP (or city), so the same address in two towns is not merged.

The first run used "a condo parcel with its own footprint is a townhome". It gave Arapahoe 27,870 "townhomes", most of them flats ("2575 S SYRACUSE WAY Ste I306"). It was replaced before anything was measured.

Jefferson's "Condo, Res: Attached" (the example in the brief) turned out to be mostly flats. Of its 13,243 parcels, only 323 stand alone on their own footprint. The rest share a footprint, with unit numbers like 201 and 304. Under the rule, they become buildings.

### Owner test (who lives there)

The owner test was redone for every row:

- **Units are allowed for.** "406 RIDGES BLVD #23" now matches a mailing line of "406 RIDGES BLVD UNIT 23".
- **A mailing line with no street is "not known"** (`unk`).
- **A PO box is local** when its ZIP is one the county's own owner-lived houses mail from. This is Group 3's rule (Matthew 29 Oct: local PO box = lives here).

### Huerfano

The address-point adapter in the 8 Nov plan cannot work here: Huerfano has no address points on the state layer. Its property addresses are simply written street first:

- "01ST ST W # 00101" is 101 W 1ST ST. The owner's mailing line confirms it.
- The rewrite also handles "# 00438 & 440", "# 00353.5" and a trailing "UNIT 40".

Its homes go to Group 3's five Huerfano targets (Walsenburg, La Veta and their rural areas, Gardner rural), plus "Huerfano County (other)".

## What is being added (recount, 15 Nov, 43 counties)

**Before:** 1,770,653 doors in 418 towns (Roofing count, without the commercial test towns):

- 1,244,870 owner-lived;
- 467,060 owner elsewhere;
- 53,635 not known.

**Being added:**

| Kind | Count | How it shows |
|---|---|---|
| Houses, owner lives here | 33,711 | Ordinary doors (`occ` here), Sixfold too |
| Houses, owner elsewhere / not known | 16,455 / 2,272 | Doors labelled as today's rented homes |
| Townhomes (`hk: 'th'`) | 17,769 (8,767 here, 8,555 elsewhere, 447 unknown) | Ordinary doors, labelled "Townhome", Sixfold too |
| Townhome label on doors we already have | 40,835 | Label only (Jefferson Townhomes, Denver rowhouses, condo-coded own-address homes) |
| Mobile homes on their own lot (`hk: 'mh'`) | 980 | Editions: listed with a label and a "Hide mobile homes" filter. Sixfold: never |
| Condo buildings (`hk: 'b'`, bk condo) | 10,181 entries, 109,747 units | Editions: off until an admin turns buildings on, then a "Buildings only" filter. Sixfold: never |
| Apartment buildings (bk apt) | 5,047 entries | Same as condo buildings. Unit count only where the county gives it (El Paso); else a band from the land use, or "units not on record" |
| Mobile home parks (bk mhp) | 368 entries, 2,659 spaces | Same as condo buildings |

**Expected after:** about 1,841,840 doors (+71,187), plus 15,596 building entries that are hidden by default.

The doors go into:

- **298 towns of ours.** Each new door is placed beside its nearest existing door, as the rented homes were.
- **54 new towns.** These are:
  - the 6 Huerfano ones;
  - 9 named places, among them Del Norte, Monte Vista, Gypsum, Meeker, Wray and Eckley;
  - "(other)" towns in 30 counties.

  Buildings join 201 towns.

### By county (the biggest; all 43 in `every1115/b/kinds.json` once copied back)

| County | Parcels | Ours already | Houses, owner here | Houses, elsewhere/unknown | Townhomes | Mobile homes | Buildings | Units in them | Over 10 ac (out) |
|---|---|---|---|---|---|---|---|---|---|
| Arapahoe | 231,438 | 162,845 | 8,381 | 1,025 | 3,377 | 14 | 2,613 | 25,282 | 1,526 |
| El Paso | 277,007 | 215,670 | 519 | 3,997 | 3,605 | 450 | 2,896 | 5,059 | 4,656 |
| Jefferson | 258,817 | 186,437 | 4,817 | 1,225 | 1,509 | 0 | 2,175 | 12,212 | 2,724 |
| Boulder | 144,551 | 123,932 | 5,213 | 2,304 | 3 | 0 | 839 | 1,455 | 3,914 |
| Douglas | 164,818 | 121,212 | 6,193 | 879 | 0 | 3 | 110 | 994 | 1,106 |
| Adams | 188,474 | 156,334 | 4,703 | 1,373 | 21 | 0 | 4 | 23 | 1,008 |
| Weld | 163,491 | 105,483 | 2,627 | 2,543 | 3 | 0 | 0 | 0 | 450 |
| Routt | 25,414 | 9,106 | 0 | 55 | 3,688 | 40 | 82 | 6 | 1,991 |
| Huerfano | 18,042 | 1 | 870 | 2,550 | 49 | 0 | 38 | 314 | 1,583 |
| Denver | 240,257 | 174,971 | 0 | 3 | 2,684 | 2 | 2,907 | 37,633 | 1,159 |
| Pitkin | 19,146 | 6,836 | 6 | 11 | 1,115 | 3 | 616 | 5,129 | 371 |
| Larimer | 180,960 | 133,277 | 141 | 355 | 4 | 59 | 350 | 4,441 | 5,077 |
| Mesa | 78,984 | 52,111 | 7 | 23 | 265 | 0 | 1,133 | 7,224 | 1,190 |
| Summit | 38,372 | 29,184 | 0 | 196 | 122 | 0 | 687 | 5,671 | 595 |
| **All 43** | **2,589,396** | **1,685,560** | **33,711** | **18,727** | **17,769** | **980** | **15,596** | **112,763** | **57,718** |

How to read the table:

- "Ours already" counts parcels matched to one of our doors. A parcel matches when a door or lookup home sits within 6 m of it (15 m in El Paso), or the same address sits within 150 m.
- Not homes: 319,996 parcels are not homes and 311,070 have no property address.

## Lawns for doors with no yard reading (main session's ask)

The main session's figure was about 215,000 doors without a yard reading. Broken down, those doors are:

| Doors | Why | Done now |
|---|---|---|
| 72,125 | No yard entry at all: towns added since the last yard run (El Paso and PO-box batches, rented homes) | **Measuring** |
| 4,135 | "No lot found" outside the address-point counties | **Measuring again** (may have been a failed lookup) |
| 51,299 | "No lot found" in Montrose, Delta, Las Animas, Alamosa, Conejos, Costilla, Bent, Mineral | **Cannot be measured by the yard method**: those counties' parcels are not on the state layer (known, cloud-fill-1031) |
| 16,490 | Lots too big for the yard method | By design |
| 9,994 | Shared lots (common ground) | By design |

How the measuring runs:

- **Who is included:** 76,260 doors in 348 towns (34,493 owner-lived), owner-lived-heaviest towns first.
- **Settings:** the 11 Nov ones (green 0.33, despeckle 4, roof buffer 1).
- **How:** yardv3's pipeline (`every1115/yardgap.sh`), into `~/run/lawn-trial/yard-gap/`.
- **Finisher:** `every1115/finish-yardgap-2026-11-15.sh`, run by the Wi-Fi queue job `yardgap`.
  - It uses finish-yardv3's own checks, including its rule that up to 25 doors or 0.5% of a town may read no lawn.
  - The merge is **add-only**: a door gets a reading where it had none or a no-lot answer. An existing reading is never replaced.
  - The acreage rule in build-yard-v2.mjs `yardLawn()` is untouched.

The every-home doors are measured in `ehb` with the same settings. This covers houses, townhomes and mobile homes; buildings get no lawn.

## Cloud machine (fill1031 queue)

| Stage | What | State / ETA |
|---|---|---|
| `ehpull` | State parcel layer read again: 43 counties, 2,589,396 parcels, with owner names, so these files stay on the VM | Done 19:16Z 15 Nov (2 h 25 min) |
| `ehlist` | Recount and lists (`every1115/classify-vm.mjs`, `make-lists-vm.mjs`) | Done 19:17Z. Re-run by hand ~19:40Z with the address rule |
| `yardgap` | 76,260 doors' yards, 3 workers | Started 19:17Z; about 2–4 h (lot lines for the newer towns are fetched one request at a time) |
| `ehb` | Measuring the every-home batch (`every1115/ehb-vm.sh`). Per list: door files, building outlines, yard, trees, roof + sun where a laser survey covers, values. New towns also get roof material and close-up photos | After `yardgap`; about 10–14 h. Expected done Mon 16 Nov, during the day MT |

- **VM time:** all of it ends well before the planned stop on Sun 22 Nov. No extension is needed for this work.
- **E needs the VM afterwards.** The quarterly refresh needs a cloud machine each quarter (see below).

## Laptop finishers (Wi-Fi queue, in this order)

1. **`yardgap`** (`ops/wifi-queue/jobs/yardgap.sh`): waits for `yardgap.vmdone`, then copy back, merge, build, checks, and uploads every town to Sixfold and the five editions, with md5 checks.
2. **`every`** (`jobs/every.sh` → `every1115/finish-every-2026-11-15.sh`):
   - waits for `ehb.vmdone`, and for every other build or upload to end;
   - copies back, places the lists, merges the caches and registers the new towns;
   - builds;
   - **STOPS before any upload** if a town of ours has fewer doors than before, or any existing door id is missing;
   - otherwise uploads the changed towns to Sixfold and the five editions.

   After it, still to do by hand:
   - storm history for the new towns (the g3hail method);
   - a roof-material pass for the added doors.

**Preview build, 15 Nov 12:55 MT.** The real lists for our towns (not the 54 new towns, whose neighbourhoods are made on the VM) were built into the scratchpad; nothing live was touched. Result:

- Colorado entries in our towns: 1,770,653 → 1,848,378 (+77,725, of which 14,948 are building entries, hidden by default);
- 43,745 townhome labels and 977 mobile homes;
- **0 existing door ids lost**.

The first preview lost one: "2847 B RD", a rented home in Orchard Mesa. A neighbour's new list, promoted earlier in the same pass, claimed it. Fixed in `build-rounds-data.mjs`: the existing lookup lists keep their old order, and the new lists run only after every town's.

Gates in `build-rounds-data.mjs`:

- **Mobile homes and buildings** are built only while `every1115/KINDS-READY` exists. It was made 15 Nov, after the app went live. Delete it to hold them back; door ids don't move either way.
- **Townhomes and houses** need no gate: old app code shows them as plain doors.

## What went live today

**App: home kinds.** Branch `hk-kinds-1115` (commits 1c355b90, b0e9a34f), merged as 02fd863b.

- **Server:** one rule, `doorHkHidden()`, sits in the same choke point as the owner filter (`occKeep`). Through it, lists, counts, scores, the regions cache, search, the House lookup, storm doors, the plan, the CSV and leads all follow.
- **Setting:** Office > Setup > "Mobile homes and buildings", stored in `door-who.json` as `mh` / `b`.
  - Editions default to mobile homes on and buildings off.
  - On Sixfold 365 both are always off.
- **Page:** labels, plus the filters "Hide mobile homes" and "Buildings only". Spanish is included.
- **Tests (harness):**
  - Sixfold config: 33/33 API and 6/6 page checks.
  - Edition config: 74/74 API and 25/25 page checks.
  - Branch against HEAD on data without kinds: 96/96 answers identical.
- **Deploy:**
  - `deploy-app.sh homekinds-1115`: **all checks passed**. Backup `~/upload-backups/before-homekinds-1115-20261115-102518.tgz`.
  - `deploy-practice.sh`: all checks passed.

**Lawn mark rebuild** (`every1115/rebuild-upload-all-20261115.sh`): every door file rebuilt, with no new data.

- Door counts are unchanged in every town.
- Doors with a lawn size: 1,645,097 → 1,645,097.
- Promoted rented doors with a yard reading carry `y: 1` too (one more line in `build-rounds-data.mjs`).
- Backup of the old door files: `ProjectBackup/rebuild-20261115-before/door-files-before.tgz`.
- Upload results:
  - Sixfold: all 421 towns uploaded 12:05–12:28 MT in batches of 8, each batch confirmed (server backups `~/upload-backups/before-rebuild-<town>-20261115.tgz`).
  - The editions push then failed on a DNS loss (12:37, the laptop dropped off the hotel Wi-Fi). It was re-run 12:40–12:49 on Surge WiFi (`every1115/push-editions-20261115.sh`, log `logs-push-editions-20261115.log`).
  - Yards, Pest, Security, Solar and Roofing: each **MD5 MATCH (374)** and json ok. Backups: `before-push-traverse-yards-data-20261115-124032.tgz`, `...-pest-data-...-124111`, `...-security-data-...-124221`, `...-solar-data-...-124732`, `before-push-traverse-data-20261115-124840.tgz`.
  - Live read-back: monument 224a46826f24, highlands-ranch f118c491dcad and welby eb74628f684b, identical on Sixfold, Yards and Roofing.
  - Before the push, all 2,094 edition door files were checked equal to the build.

## E: the quarterly refresh

`every1115/refresh-quarterly.sh`, run by the Windows task "Traverse new homes refresh" (`ops/refresh-new-homes.sh`). First run: 15 Feb 2027, 02:00.

Each run:

1. Exports today's doors to the cloud machine.
2. Adds three dated stages (`eq<date>pull` / `list` / `meas`) to the fill1031 queue. These are the same pull, recount and measuring as above, so any house on the layer that is not a door yet comes in: houses built or first recorded since the last run, and anything missed.
3. Hands the finish to the Wi-Fi queue job `everyq`.

If the cloud machine does not answer, the run writes so in `logs-refresh-quarterly.log` and does nothing. After 22 Nov that will be the case unless the VM is kept or restarted for a day each quarter.

## Left out, and why

- **Fremont, Chaffee, Otero:** their terms forbid it. **Cheyenne, Phillips, Moffat:** they need the county's permission. Moffat is on the layer and is skipped by the pull (TR-36).
- **Prowers, Kit Carson, Lincoln, Baca, Crowley, Jackson, Kiowa:** no public bulk source (8 Nov plan).
- **Houses on more than 10 acres:** 57,718 parcels, 23,244 of them owner-lived. This is the walk lists' cap (Matthew 16 Oct: keep it).
- **Mobile homes in parks:** the ~90,000 Census mobile homes are mostly not separate parcels. A park is one parcel, and its spaces have no addresses on the layer. They come in as 368 park entries, not doors.
- **Counties that give no unit-level land use** (Adams, Boulder, Douglas, Weld say only "Residential"): a single-parcel apartment block there can't be told from a house by the record. Units under one address are still caught by the address rule.
- **1,110 doors we already have that the county codes as mobile homes:** left as ordinary doors. Labelling them would hide them from Sixfold's lists and from its crews' marks. This is Matthew's call.

## Decisions for Matthew

1. **Mobile homes in the editions: shown by default (with "Hide mobile homes"), or hidden until switched on?**
   - Built as shown, following "with a filter so crews can hide them".
   - It is one admin switch per install, or a one-line default change.
2. **The 1,110 existing doors the county calls mobile homes:** label them (they then leave Sixfold's lists) or leave them as they are (current choice).
3. **The 10-acre cap:** 23,244 owner-lived houses on bigger parcels are out.
4. **The quarterly refresh needs a cloud machine after 22 Nov:** keep the VM, restart it for a day each quarter, or skip E.
5. **TR-36 counties:** unchanged (emails, or buying Fremont / Chaffee).

## Fact-check log

**Verified:**

- **Census targets.** ACS 2020-24 B25024 and B25032, as fetched for the 8 Nov plan (`gap1108/acs-county-2026-11-08.json`). Not re-fetched today.
- **State layer read 15 Nov.** 43 counties, 2,589,396 parcels. That is exactly the 8 Nov count (2,599,937) minus Moffat (10,541), so the layer's parcel counts have not moved in a week.
- **Huerfano rewrite.** Checked against owners' mailing lines: "01ST ST W # 00101" vs "101 W 1ST ST WALSENBURG"; "07TH ST W # 00438 & 440" vs "438 W 7TH STREET". Huerfano now gives:
  - 870 owner-lived houses;
  - 2,550 houses where the owner lives elsewhere or it is not known (most "not known" rows have no street on the mailing line);
  - 49 townhomes and 38 buildings.

  Census: 4,016 houses, 2,100 owner-occupied.
- **Unit rule.** Checked on samples: Arapahoe "2575 S SYRACUSE WAY Ste I306"; Jefferson "12354 W NEVADA PL 304/302/201"; Mesa "406 RIDGES BLVD #23" with mail "406 RIDGES BLVD UNIT 23".
- **Mobile home sample.** El Paso "MANUFACTURED HOUSING" parcels on their own lots; Larimer and Park "Mobile Home".

**Corrected:**

- First run's townhome rule (own footprint): replaced by the address rule. Arapahoe "townhomes" went from 27,870 to 3,377.
- First run's owner test: unit-blind, and every Huerfano PO box read as non-local.
- First-run Huerfano: 73% read "owner elsewhere"; corrected as above.

**Unresolved:**

- Apartment unit counts outside El Paso: the band or "not on record" is shown instead.
- Where the land use is generic, attached homes on their own parcels carry no townhome label.
- The yard method can't measure the eight address-point counties.
