# Solar (TraverseSolar only)

Per-door solar facts for the Solar edition: roof area by facing, slope and shade from the USGS 3DEP LiDAR, the system that fits,
its estimated yearly production, and the power company. Built offline; the app only reads `app/data/rounds/solar-<town>.json`.

| Script | Writes |
|---|---|
| `sample-solar.mjs` | `solar-cache.json` (per house: area by facing S/SE/SW/E/W/N/flat, median slope, shade count, survey year) |
| `fetch-inputs.mjs` | `pvwatts.json` (one Larkspur point, the old yield table, now the fallback) and `utilities.geojson` |
| `fetch-pv-grid.mjs` | `pv-grid.json` (2026-10-29: yearly output per kW by place, facing and slope) |
| `utility-figures.mjs` | `utility-figures.json` (EIA-861 figures per power company) |
| `build-solar.mjs` (`node sample-solar.mjs --build --all-towns`) | `app/data/rounds/solar-<town>.json`, `solar-utilities.json` |

Only the Solar edition ships `solar-*` files (`keep()` in `editions/build-editions.cjs` drops them from every other edition) and
the API sends the row only where `features.solar` is on (`solarOn()` in `rounds.php`). Sixfold never gets it.

## Production estimate (2026-10-29)

Per door with a measured roof:

1. **Usable area**: 60% of each sun-facing part (S, SE, SW, E, W; north is never counted) is usable once fire-code walkways along
   edges and ridges, vents and chimneys are kept clear. Flat area counts only when the roof is mostly flat (panels tilted 10 degrees
   south); on a pitched roof the cells reading flat are ridges and valleys.
2. **Panel density**: a 400 W panel is about 20 sq ft, so about 0.215 kW per square metre of panel, or about 1.2 kW per 100 sq ft
   of sun-facing roof once the 60% is applied. Panels are whole: `pn = floor(area x 0.6 / 20)` per part; `kw = pn x 0.4`.
3. **Sun**: each part's kWh per kW a year from PVWatts at **this house's 0.25-degree cell**, for its facing and the roof's median
   slope (`pv-grid.json`, below). `yk` on the door is the house's blend before shade.
4. **Shade factor** (`sf`): PVWatts' 14% system losses already include 3% for shading, taken as the open roof. "Some" tall canopy on
   the sunny side takes another 10% off (0.9), "heavy" 20% (0.8). **These two factors are our assumption, not a measured loss**:
   the scan counts tree cells as tall as the roof within 20 m to the south; it does not trace the sun's path. The card says so and
   shows the figure without shade.
5. `kwh = sum over parts (pn x 0.4 x kWh per kW) x sf`, rounded to 100. It is **the most that fits**, not a system sized to the
   household's use, and the card says that too.

Door fields: `pn`, `kw`, `kwh` (after shade since 2026-10-29; before, unshaded at Larkspur), `ev: 2` (this method), `yk`, `sf`
(only when under 1). The card (`solarEstLine()` in the app page) reads `ev`; an older file without it keeps the old line.

### pv-grid.json: how the sun table is built

PVWatts v8 call parameters: `module_type=0` (standard), `losses=14`, `array_type=1` (fixed roof mount), defaults otherwise
(DC to AC 1.2, inverter 96%). Weather: NSRDB PSM V3 GOES TMY (tmy-2020), the nearest 4 km cell.

- one south/25-degree call per 0.25-degree cell holding measured doors, at the **mean position of those doors** (47 cells);
- the full table (E, SE, S, SW, W x 10, 20, 30, 40, 50 degrees, plus south/25) per 1-degree block, at its busiest cell (8 blocks);
- a house gets: its cell's south/25 figure x its block's ratio for the facing and slope, interpolated between slopes.

**Check of the shortcut** (`--check=6`, 2026-10-29): the full table fetched at 6 more cells (90 figures) against the shortcut:
mean error -0.4% to +0.2% per cell; worst 5.2% (east-facing at 50 degrees), worst 3.1% at 30 degrees or under.
345 calls in all, under the key's 1,000 an hour.

### Sanity check against published figures

- PVWatts itself, Denver (39.74, -104.99), south 20 degrees, defaults: **1,595 kWh per kW a year** (capacity factor 18.2%).
  The grid's Denver-metro cell (39.75, -105) gives 1,627 at south 25; the Colorado cells run 1,494-1,757 at south 25.
- EU JRC PVGIS 5.2 with its PVGIS-NSRDB data (an independent model), building-mounted, 14% losses: Denver 1,510 (20 degrees),
  1,538 (25 degrees); Colorado Springs 1,568 (20 degrees). PVWatts runs about 4-6% above PVGIS's building-integrated mounting,
  which assumes hotter modules than a roof rack.
- Per house, before shade, the blend over the facings used is 1,316 / 1,441 / 1,568 kWh per kW (10th / median / 90th
  percentile); Denver's median 1,437, Monument 1,492, Woodland Park 1,510. Lower than south-only because east and west parts count.

### Coverage (built 2026-10-29 from the cache as it stood)

673,990 of 1,093,827 Colorado doors (61.6%) carry an estimate; 726 more have a measured roof with no panel fitting. 98 towns are
50%+ covered (659,103 of 836,129 doors). 53 towns have none because `sample-solar.mjs` has not measured them (largest: Fort Collins,
Pueblo, Grand Junction, Pueblo West); Castle Rock (5,875 of 19,531), Longmont and Greeley are thin because they were re-pulled after
measuring. Measuring them fills them on the next build; no new sun calls are needed unless a town sits outside the 47 cells
(the build then uses the nearest cell and block).

Shade classes on estimated doors: open 61,210, some 144,095, heavy 468,685. Heavy dominates in the older metro (Englewood 88%,
Wheat Ridge 91%) and is lower on the 2018 El Paso survey (Black Forest 36%), so the class depends on the survey as well as the trees.

## Sources and terms

- **PVWatts v8**, National Laboratory of the Rockies (formerly NREL), U.S. Department of Energy, `developer.nlr.gov` (the old
  `developer.nrel.gov` host no longer resolves). Terms read 2026-10-29 at developer.nlr.gov/terms: the data "may be used for any
  purpose whatsoever"; the DOE/NLR names may not be used to endorse or promote. So the card names it as the source of the sun data,
  never as an endorsement. 1,000 requests an hour on a key. Key: the free api.data.gov key in `../data-gov-key.txt` (not in git;
  `NLR_API_KEY` overrides). No new sign-up was needed.
- **PVGIS 5.2** (EU Joint Research Centre), used only for the cross-check above, not shipped. Commission content may be reused with
  credit and changes indicated (Decision 2011/833/EU), but PVGIS-NSRDB is third-party (NREL) data and the API page states no
  commercial-use terms, so it was not chosen.
- **USGS 3DEP LiDAR** (public domain), **Colorado OIT Electric Utility Service Territories**, **EIA-861** as before.

## Rebuild

```
node fetch-pv-grid.mjs [--check=6]                       # resumable; delete pv-grid.json to refetch everything
node --max-old-space-size=8192 sample-solar.mjs --build --all-towns
```
From a worktree: `--data=<main>/traverse/app/data/rounds --cache=<main>/.../solar/solar-cache.json --keyfile=<main>/.../data-gov-key.txt`.
