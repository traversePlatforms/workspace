# Damaging wind near each door

Built 2026-10-05. Mirrors `../hail/` (same door files in, same kind of per-town file out). Admin-only in the app.

**What it answers:** on which days did somebody near this house report a wind gust of 50 mph or more, or
wind damage, and how far away was the report. **What it does not answer:** what the wind was *at* the house.
Nobody measures that. A house with no entry had nobody reporting near it, not calm weather.

## Source: NWS Local Storm Reports, via the Iowa Environmental Mesonet

`build-wind.mjs` downloads every Colorado Local Storm Report (LSR) since 2020-01-01 from Iowa State's
archive (`https://mesonet.agron.iastate.edu/cgi-bin/request/gis/lsr.py`, one CSV per year, all WFOs,
`state=CO`) and keeps five report types:

| code | type | what it is |
|---|---|---|
| G | TSTM WND GST | a thunderstorm gust, mph |
| N | NON-TSTM WND GST | a gust from a high-wind event (downslope / Chinook / front), mph |
| A | HIGH SUST WINDS | sustained wind, mph (rare, 12 rows a year) |
| D | TSTM WND DMG | thunderstorm wind damage, usually no number |
| O | NON-TSTM WND DMG | high-wind damage, usually no number |

Each row has a lat/lon (rounded to 0.01 degrees, about half a mile), the reporting source (ASOS airport
sensor, AWOS, Mesonet / RAWS / CWOP station, trained spotter, public, utility) and a **QUALIFIER**:
`M` measured, `E` estimated, `U` unknown. That qualifier is why this source won over the others:

- **SPC storm reports** (`spc.noaa.gov/climo/reports/`, `wcm/data/<year>_wind.csv`): thunderstorm wind only, so
  the Front Range's worst roof wind, the December downslope storms (2021-12-15, 2021-12-30, 2022-12-01/02,
  2025-12-17), is not in it at all. The yearly files are the post-reviewed NCEI set and lag a year or more;
  2026 is not there. Checked for 2023: 151 Colorado rows in SPC against 308 gust + 39 damage LSR rows, the
  difference being review, dedup and SPC's 50 kt (58 mph) floor.
- **NWS severe thunderstorm warning polygons with a wind tag** (also on IEM): forecasts, not observations, and
  again thunderstorms only. The app's hail strip already reads live warnings; a history of warned areas
  would be a different, weaker product ("your house was inside a 60 mph warning"). Not used.
- **RTMA / URMA gridded gust analysis** (NOAA, hourly, 2.5 km, on AWS as `noaa-rtma-pds` from 2019):
  the only candidate that gives a value *at* the house. Not feasible for this build: a daily maximum needs
  all 24 hourly GRIB2 files, about 10 MB each, so roughly 60,000 files and 600+ GB for 2020 to now, plus a
  GRIB2 decoder for a packing the hail decoder (`../hail/mesh.mjs`) does not handle. The analysis also
  draws on the same sparse stations and smooths across terrain; in the Rampart Range it would look exact
  without being so. Revisit only if a per-house number is worth a multi-day download.

The LSR set is what the NWS actually received. It is preliminary (never reviewed), it has re-issued
duplicates (391 dropped by matching day, lat/lon, type and speed), and it is sparse.

## How a report reaches a door

- **Radius: 10 miles** (`RADIUS_MI`). Chosen by measuring coverage on a 1-in-25 sample of doors:

  | town | 3 mi: doors with any report, median storm days | 5 mi | 10 mi |
  |---|---|---|---|
  | Black Forest | 93 %, 2 days | 100 %, 12 | 100 %, 55 |
  | Monument | 100 %, 7 | 100 %, 16 | 100 %, 46 |
  | Castle Rock | 100 %, 4 | 100 %, 7 | 100 %, 18 |
  | Woodland Park | 100 %, 1 | 100 %, 1 | 100 %, 32 |
  | Florissant | 94 %, 3 | 100 %, 4 | 100 %, 5 |
  | Cripple Creek | 0 % | 0 % | 0 % once the summit station is excluded |

  At 5 miles Woodland Park has one storm day in six years, because its stations (Rampart RAWS, Manchester
  RAWS) sit 7 to 10 miles from the houses. At 10 miles every town but Cripple Creek is covered. The cost is
  that a Black Forest house gets the Air Force Academy airfield's gust, 8 miles away on the other side of
  the Palmer Divide ridge. **The distance is stored with every entry so the app can say so.** Tightening is
  one constant and a rebuild.
- **Floor: 50 mph** (`MIN_MPH`). NWS severe is 58 mph; 50 catches the station gusts that bracket a severe
  day. Damage reports are kept whatever their number (most have none).
- **Day:** the Colorado calendar day (America/Denver), converted from the report's UTC time. A storm at
  7 pm shows under the right date.
- **One entry per door per day:** the strongest gust within the radius (nearest wins a tie); if no gust of
  50+ was reported, the nearest damage report. `kind` is `measured` (qualifier M), `estimated` (E or U:
  nobody measured it) or `damage`.
- **Cap: 10 days per door** (`CAP`), the strongest kept, then ordered newest first. Most doors in the big
  towns have 40 to 60 qualifying days in 10 miles, so the cap bites everywhere; `capped` in each file says
  how many doors lost days. A damage report with no number ranks as 58 mph for the cut.
- **Excluded:** reports whose place is "Pikes Peak" (`EXCLUDE_PLACE`), 15 rows. The summit station at
  38.84 -105.04 is 14,115 ft and reads 95 mph on an ordinary windy day; it is within 10 miles of Cripple
  Creek and Woodland Park and was the only thing giving Cripple Creek entries. Ridge RAWS stations
  (Rampart Reservoir "4 E Crystola", Manchester "9 NNW Woodland Park", Carpenter Peak) are kept: exposed,
  but at the height of the houses around them. Add a pattern to drop another.

## Output (app/data/rounds/)

`wind-<town>.json`
```
{ source, radiusMi: 10, minMph: 50, built, from: "2020-01-01", through, cap: 10, capped,
  doors: { "<door id>": [ [ "YYYY-MM-DD", mph|null, "measured"|"estimated"|"damage", miles ], ... newest first ] } }
```
`miles` is whole miles from the house to the report (0 = under half a mile). The door file's `owner`
field is never read into this builder; only `id`, `lat`, `lon` leave `<town>.json`.

`wind-storms.json`
```
{ source, radiusMi, minMph, built, from, through, days,
  storms: [ { date, max, kind, reports, n,
              towns: { "<key>": { label, n, max, kind } },
              pts: [ [lat, lon, mph|null, kind, place, source], ... strongest first ] }, ... newest first ] }
```
`n` = doors with an entry that day, `reports` = distinct reports within 10 miles of any door, `pts` = those
reports, for a map (592 points over 129 days, 78 KB).

Sizes: Black Forest 3.1 MB, Monument 2.4 MB, Castle Rock 2.4 MB, Woodland Park 0.9 MB, the rest under
0.6 MB. The cap is what sets these; 10 entries times 33 bytes per door.

## Coverage, 2026-10-05 build

15,465 Colorado wind rows read, 11,802 kept. 129 storm days (17 a year, 28 in 2022). Latest report
2026-09-19. 30,409 of 30,464 doors have at least one entry (every door outside Cripple Creek).

| town | doors with an entry | distinct days in the lists |
|---|---|---|
| Monument | 7,071 of 7,071 | 19 |
| Palmer Lake | 444 of 444 | 15 |
| Black Forest | 9,286 of 9,286 | 42 |
| Castle Rock | 7,082 of 7,082 | 31 |
| Larkspur | 671 of 671 | 12 |
| Sedalia | 575 of 575 | 21 |
| Franktown | 1,545 of 1,545 | 21 |
| Woodland Park | 2,751 of 2,751 | 14 |
| Divide | 575 of 575 | 16 |
| Florissant | 409 of 409 | 5 |
| Cripple Creek | 0 of 55 | 0 |

Strongest days (max measured gust within 10 miles of a door; doors touched):
2021-12-15 100 mph (Air Force Academy AWOS), 20,818 doors in 8 towns; 2020-06-06 87 mph (the June 2020
derecho), 30,368 doors in 10 towns; 2025-12-17 85 mph, 21,892; 2022-12-02 84 mph, 28,287; 2022-12-01
82 mph, 28,453; 2024-05-06 83 mph, 27,679; 2021-12-30 81 mph (the Marshall Fire wind), 19,911;
2026-02-17 79 mph, 28,671; 2022-10-23 78 mph, 19,906. 2024-08-13 83 mph touched only 461 Franktown doors.

## Caveats, in order of how much they matter

1. **A point report is not the wind at the house.** Gusts in this terrain change by 20 mph across a
   mile. The entry says "a station N miles away saw X"; the app should say that too.
2. **No entry is not no wind.** Cripple Creek has no station within 10 miles that is not a summit. Its 55
   doors are blank for that reason only.
3. **Almost everything is "measured"** (293k of 300k list entries) because most 50+ mph reports here come
   from airport and mesonet sensors. "Estimated" and "damage" entries are the spotter and public reports,
   which are rarer but closer to houses.
4. **Stations change.** A mesonet station that was not there in 2020 makes 2024 look windier than 2020.
   The 2022 peak (28 storm days) is partly that.
5. **The cap drops days.** Only the strongest 10 per door survive; a 55 mph day in a 60-day list is gone.
   `wind-storms.json` keeps every day.
6. **LSRs are preliminary** and depend on what each office logs; Pueblo (El Paso, Teller) and Boulder
   (Douglas) have different habits. Day counts across the county line are not comparable.
7. Reports older than the archive's reach (before 2020) are not fetched; `FROM` sets it, the archive goes
   back to 2003.

## Re-run

```
cd traverse/data-pipeline/door-territory/wind
node build-wind.mjs all        # fetch (cache/, gitignored; the current year refreshes if older than 20 h) then build
node build-wind.mjs build      # rebuild from the cache only
```
About 15 s for the download, 1 s for the build. Past years are never re-downloaded; delete the file in
`cache/` to force it. `build` reads the towns from `app/data/rounds/index.json`, so a new town needs no
change here. The outputs are not ignored by the repo `.gitignore` the way `hail-*.json` are; decide before
committing.

## Fact-check log

| claim | status | source |
|---|---|---|
| IEM LSR archive: CGI, parameters, CSV columns, QUALIFIER M/E/U, archive from 2003 | verified 2026-10-05 by fetching the form and the CSV | https://mesonet.agron.iastate.edu/request/gis/lsrs.phtml, https://mesonet.agron.iastate.edu/cgi-bin/request/gis/lsr.py |
| LSR type codes G/D/N/O/A and their meanings | verified: TYPECODE and TYPETEXT columns in the 2021 Colorado download (229 G, 45 D, 1,857 N, 64 O, 12 A) | same |
| Re-issued duplicates in the archive | verified: identical rows differing only in remark; 391 dropped over 2020-26 | the downloaded CSVs |
| SPC yearly wind file: format, knots, thunderstorm only, 2023 Colorado count 151 | verified by download | https://www.spc.noaa.gov/wcm/data/2023_wind.csv, https://www.spc.noaa.gov/climo/reports/ |
| SPC daily report CSVs exist (`YYMMDD_rpts_wind.csv`, speed UNK when estimated) | verified by download of 2023-06-22 | https://www.spc.noaa.gov/climo/reports/230622_rpts_wind.csv |
| NWS severe thunderstorm wind criterion 58 mph (50 kt) | standard NWS definition, not re-fetched | https://www.spc.noaa.gov/misc/about.html |
| RTMA/URMA: hourly, 2.5 km CONUS, on AWS from 2019, bucket `noaa-rtma-pds` | verified from the AWS registry page summary; the per-file size (~10 MB) is from memory and not re-measured | https://registry.opendata.aws/noaa-rtma/ |
| "1 N Pikes Peak" 38.84 -105.04 is the summit | the coordinates are the summit's (38.8409 -105.0423); the station id FW1962 is a CWOP station, its exact placement not checked | the downloaded CSVs |
| 100 mph at the Air Force Academy on 2021-12-15 | in the data (KAFF AWOS); matches the public record of that windstorm, not separately re-fetched | the downloaded CSVs |
| 2020-06-06 derecho, 2021-12-30 Marshall Fire wind | the dates and gusts are in the data; the event names are from memory | the downloaded CSVs |
| coverage table at 3/5/10 miles | measured on every 25th door per town, 2026-10-05 | scratch analysis, not kept |
| Unresolved | whether ridge RAWS stations (Rampart, Manchester, Carpenter Peak) should count; kept, with the distance shown | |
| Unresolved | whether the 10-day cap should prefer recent days over strong days | |
