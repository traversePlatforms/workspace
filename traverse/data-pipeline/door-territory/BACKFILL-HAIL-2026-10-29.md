# Hail and wind history backfill (29 Oct 2026)

Matthew, 29 Oct: hail history for every town that lacks it. Before this, Roofing's storm files covered only the towns built before 6 Oct. On the live server, 152 of 184 towns (613,173 doors) had no hail file and no wind file, and 88 had no ground-report file. The 32 towns that did have files were also missing every door added since their first build. Denver, for example, had hail on 39,057 doors out of today's 105,486.

## How the history was first built (unchanged method)

- **Radar hail** (`hail/build-hail.mjs`): NOAA/NSSL MRMS MESH 24-hour maximum, from Iowa State's archive (mtarchive.geol.iastate.edu). A door gets an entry when it saw 0.75 in or more in the 3 x 3 grid squares around it (about 1 km each way). The keep rule is in `storm-keep.mjs`: a storm day stays two years, or five if hail reached 2 in anywhere on our doors that day. This produces `hail-<town>.json`, `hail-storms.json` and `hail-paths.json`.
- **Ground reports** (`hail/build-hail-reports.mjs`): NOAA Storm Events (NCEI) plus NWS Local Storm Reports (IEM), 0.75 in or more within 2 miles. This produces `hailrep-<town>.json` and `hail-reports.json`.
- **Wind** (`wind/build-wind.mjs`): NWS Local Storm Reports (IEM), gusts of 50 mph or more or damage within 10 miles, at most 10 per door, same keep rule. This produces `wind-<town>.json` and `wind-storms.json`.
- **The server's storm job** (`app/api/rounds.php` stormRefresh, at most every 12 hours) adds each new day's radar hail to every door in the index and owns `hail-storms.json` and `hail-paths.json`. When a storm day passes the keep rule, it filters every town's hail file down to the days still in `hail-storms.json`. Any backfilled day missing from that list would therefore be wiped at the next drop. That is why the backfill adds its days to the list (below) instead of only sending town files.

## What was run

On the cloud machine (`~/run/hailfill`, `hail/hail-backfill-vm.sh`, 13 minutes, niced, alongside Group 3):

1. **Door points only.** `node hail/backfill-hail.mjs stage <dir>` writes id, lat and lon for each of Roofing's 184 towns (1,098,915 doors). No owners or addresses go to the cloud machine.
2. **Radar days.** `build-hail.mjs fetch 2021-10-01 2026-10-28` covers the **whole state** (`HAIL_BOX=36.95,41.05,-109.1,-102`), so towns added later need no second download. That was 1,307 days, 3 with no file. Days before 2021-10 were not fetched because the keep rule cannot hold them.
3. **Per-door hail.** `backfill-hail.mjs build`: the same rules as build-hail.mjs, with doors looked up by grid square. Output: `hail-<town>.json` for every town, `hail-storms-backfill.json` (115 kept storm days, back to 2022-06-07) and `hail-paths-backfill.json`.
4. **Ground reports and wind.** `build-hail-reports.mjs` and `build-wind.mjs`, unchanged apart from `ROUNDS_DATA=<dir>`. Storm Events was refreshed to the 2026 file of 26 Oct, and spotter reports to today.

**Check of the method:** where the old and new files cover the same door and day, the values are identical (Denver 51,275 entries, Castle Rock 6,079, Monument 8,829, Thornton 36,149, Woodland Park 1,932, with 0 differing). The new files add the doors the old build never had. They also add days that became "major" storm days (2 in or more somewhere) once all towns count, which keeps the whole day.

## What went live (Roofing only: `traverse-data`; no other edition keeps hail-, hailrep- or wind- files)

1. **`hail/merge-storms.py`** ran on the server under the storm job's own lock, after a backup to `~/upload-backups/before-hailfill-20261029-180847.tgz`. Storm list went from 66 to 115 days (49 added). The new towns were added to 656 existing days' town lists, and 102 town entries were raised (more doors now). 21,302 map squares were added near doors. The 32 existing town files had the backfill joined in per door, day by day (for example, Denver went from 39,057 to 106,607 doors with storms, and Castle Rock from 6,594 to 19,696). "through" stays the server's (2026-10-28), and nothing was dropped.
2. **`push-edition.sh traverse-data`** used an exact filter: hail- for the 152 towns with no file, plus every hailrep-, every wind- (including wind-storms.json) and hail-reports.json. That was **522 files, MD5 MATCH (522)**, with a server backup first. hail-storms.json, hail-paths.json and the 32 server-owned hail town files were not sent.
3. **Live check:** on Roofing, sample door lists show hail, ground reports and wind on every door (Aurora 32/32, Fort Collins 44/44, Greeley 50/50, Pueblo 28/28). Storm days lists 237 days (hail through 10-28, wind through 10-27). The Hail screen lists 115 storm days.

**Coverage:** before, 37.9% of Roofing's doors were in towns with hail history. After, every town has it: 567,584 of the 613,170 doors in the 152 new towns had a storm of 0.75 in or more on a kept day (92.6%).

Local copies were synced afterwards. app/data/rounds holds the server's merged hail files and the new hailrep and wind files. Backups of the old local copies are in the session scratchpad (`local-before-hailfill/`).

## ⚑ Needs the app before spring 2027: the storm job's memory

stormRefresh holds every door in the index in memory (measured on the server: 308 MB for 1.1 million doors). It also holds every touched town's hail file at once. On a day that passes the keep rule, that means **every** town's file.

- With the backfill, holding all hail files takes **978 MB**, against PHP's 768 MB limit. Before the backfill it was 299 MB.
- **The next drop is 2027-04-22** (the 2025-04-22 storm turns two years old).
- A big storm day loads only the towns it hit. The worst day in the record (2023-06-21, 72 towns) would add about 585 MB to the 308 MB base. Kept storm days in two years of all-year data fall in April to September only.

**So nothing breaks this winter.** Before April 2027, stormRefresh must handle one town at a time. Gather each day's hits as small per-town lists, then load, merge, keep-filter, write and free each town file in turn, and do the same in the drop loop. Otherwise the first big storm day or the first drop will run out of memory. The run then fails partway with storm-refresh.json not updated, so every Hail and Storm days request retries and fails. TASKS.md TR-37.

## Re-running (for new towns, e.g. Group 3 at stage B)

The statewide day files stay on the cloud machine (`~/run/hailfill/days`, 76 MB).

1. Stage the door points again: `node hail/backfill-hail.mjs stage <dir>` after the towns are in Roofing's index.
2. Copy them to the cloud machine.
3. Run `THROUGH=<server's through> bash ~/run/hailfill/hail-backfill-vm.sh`. The fetch is skipped (fetch.done); remove fetch.done to add newer days.
4. Run `merge-storms.py` on the server (`--dry` first), then `push-edition.sh traverse-data` with an exact filter that leaves out the hail files the server already has.
