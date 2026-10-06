# Trees near the house, per door (SX-24, 2026-10-02)

**What the crew sees:** a chip on each door card, using the Colorado State Forest Service's
defensible-space zones around the house:
- **Trees against house**: 25% or more tree cover in the first 5 ft AND 25% or more in 5–30 ft (revised 2026-10-03; zone 1 alone was too noisy);
- **Heavy trees, 30 ft**: 35% or more in the 5–30 ft zone;
- **Some trees, 30 ft**: 10% or more in that zone;
- **Clear, 30 ft**: less than that.

Tapping the chip shows the numbers: cover in 0–5 ft, 5–30 ft and 30–100 ft, and the tallest tree
within 30 ft. It also says whether the reading came from LiDAR (with the survey year) or the
satellite canopy map. It's a fire-work signal at the house, much finer than the fire badge, which
rates areas 270 m across.

## Method
1. **The lot:** the statewide parcel boundary containing the door.
2. **The house:** the largest Microsoft building outline whose centre is on the lot (Global ML
   Building Footprints, ODbL, release 2026-02-23).
3. **Heights:**
   - **El Paso: USGS 3DEP LiDAR `CO_Eastern_ElPaso_2018`.** Douglas: `CO_DRCOG_2_2020`. Both are
     public Entwine Point Tiles on AWS.
   - **Teller has no 3DEP coverage**, so it uses the Meta/WRI canopy-height map, labelled "map" on
     the chip.
4. **The zones:** every 1 m cell on the lot outside the house is sorted by its distance from the
   wall: 0–5 ft, 5–30 ft, 30–100 ft.
5. **What counts as a tree:** a cell 2 m or taller with split-pulse returns. Canopy splits a laser
   pulse; a solid roof doesn't.
6. **Two fixes for roofs.** These surveys leave roofs unclassified, which caused both:
   - the outline is slid up to 5 m to where it sits on the most roof;
   - within 1 m of the wall a cell must stand 1.5 m above the roof, because a pulse that clips an
     eave splits like canopy.
7. **Download depth:**
   - LiDAR is read only to the tile depth that gives about 1 m spacing (El Paso depth 9, Douglas
     depth 10).
   - On the test lots this gave the same answers as full depth with roughly a tenth of the download.

## Why LiDAR and not the canopy map
The first version used the Meta canopy map everywhere. On the 41-door trial it missed whole clumps
of evergreens: 3840 Sierra Vista Rd, Palmer Lake, read 1% cover at 30–100 ft where the photo shows
large conifers. LiDAR read 18%, and the picture matched the photo.
A house wrongly shown as "clear" is the error that costs a fire lead, so LiDAR replaced the map
wherever 3DEP exists. That covers about 27,500 of the 31,422 doors.

## Checked lots (LiDAR, z1 / z2 / z3 = 0–5 / 5–30 / 30–100 ft)
| Lot | Reading | Against the photo |
|---|---|---|
| 17890 Sierra Way (Brandon's) | 0.41 / 0.58 / 0.82 | Forested lot, trees over the north roof edge |
| 2787 Russet Sky Ct | 0.08 / 0.03 / 0.25 | Open new build; the 0.25 is the tree row along the west fence |
| 3840 Sierra Vista Rd | 0.04 / 0.02 / 0.18 | Clear by the house, conifer clumps further out |
| 1648 Marsh Hawk Cir | 0.07 / 0.35 / 0.07 | Mature trees in the yard (Matthew measured three canopies) |
| 3685 El Rancho Way | 0.44 / 0.64 / 0.66 | Trees against the house |

## The spot-check that changed the alignment (2026-10-02)
Nine random "trees against house" doors were checked against the photo (`spot-check.mjs`). Five
were right. Three were wrong, and they shared one cause: the outline had been slid onto whatever
stood tallest, and on wooded lots that meant tree crowns, so yard trees then counted as "against".
One house was newer than the 2018 survey and so wasn't in the LiDAR at all.

**The fix:**
- the outline aligns only on roof-like cells (2.5 m+ with single returns);
- the slide is capped at 3 m;
- where the roof is hidden under canopy, the outline stays as drawn;
- where there is no roof at all, the house is newer than the survey and the door gets no reading.

The re-check of the same nine showed outlines on their roofs and red cells only where trees
touch the walls. Every LiDAR door was re-measured with the fix.

## The second spot-check (Douglas, 2026-10-03)
Castle Rock read 69% "trees against house", which was implausible for its newer suburbs. The
photos showed lines of one or two cells tracing just outside the walls and along fences: cells
straddling a roof edge or fence read as split-pulse "canopy".

**The fixes, applied to every survey:**
- **Neighbour rule:** a tree-like cell counts only when 3 of its 8 neighbours are tree-like too.
- **Roof-edge band:** within 2 m of the wall, a cell counts only if it is a crown above the roof
  (roof + 1.5 m) or a shrub well below the eaves (roof − 3 m).
- **"Against" needs both zones:** zone 1 and zone 2 cover both have to reach 25%.

On the checked lots: Brandon's, El Rancho, Mount Herman and Indian Summer stay "against", open
Russet Sky reads "clear", and Marsh Hawk, Johnson Dr and Red Hawk Ridge read "heavy". The tiles
are now kept on disk (`lidar-cache/`, gitignored), so future tuning needs no re-download.

## Limits, stated on the card
- **LiDAR is from 2018 (El Paso) and 2020 (Douglas).** Trees cut since still show; houses built
  since may have no outline.
- **About 1 in 8 trial doors had no house outline** (new builds, or outlines merged across lots).
  Those doors get no chip.
- **Zone 1 is a 5 ft band.** Lot lines and outlines are each off by a few feet, so read it as
  "trees against the house: yes / no", not a percentage.
- **Teller uses the canopy map, which undercounts.** The detail line says so.

## Files
- `zones.mjs`: zones, house picking, the canopy-map measurement.
- `lidar.mjs`: the LiDAR reader and measurement.
- `fetch-buildings.mjs`: downloads the outline tiles once.
- `sample-trees.mjs`: the full run, incremental, writing `../tree-cache.json`.
- `trial-trees.mjs` / `probe-lidar.mjs`: the trial and the comparison pictures (gitignored).
