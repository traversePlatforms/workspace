# Fuel cost: EIA weekly price samples (2026-10-30)

The quote's fuel cost (api/rounds.php, above `prcFuelStarter()`) prices the drive with the U.S. Energy Information
Administration's weekly average retail price, dollars per gallon with taxes.

- Pages read (no key): `https://www.eia.gov/dnav/pet/pet_pri_gnd_dcus_sco_w.htm` (Colorado) and
  `https://www.eia.gov/dnav/pet/pet_pri_gnd_dcus_r40_w.htm` (Rocky Mountain region, PADD 4).
- Series: regular gasoline Colorado `EMM_EPMR_PTE_SCO_DPG` (else Rocky Mountain `EMM_EPMR_PTE_R40_DPG`); diesel Rocky Mountain
  `EMD_EPD2D_PTE_R40_DPG`. EIA publishes no weekly Colorado diesel price.
- Terms (eia.gov/about/copyrights_reuse.php, read 2026-10-30): U.S. government publications are public domain; "You may use
  and/or distribute any of our data"; acknowledge the source with its date ("Source: U.S. Energy Information Administration").
  The EIA logo is not to be used. The app shows "Colorado average, week of Oct 26, EIA" and names the source on Prices.
- Refreshed by `tools/fuel-prices.php`, started by the hourly `morning-email.php`; kept in `traverse-shared/fuel/eia.json`.

The two `.htm` files here are those pages as published for the week of Oct 26, 2026 (released Oct 27): Colorado regular
$4.458, Rocky Mountain diesel $6.521. The test harness's EIA stand-in serves them to check the parser.

Road distance: no routing service is used. Estimated road miles = straight line x the company's road factor (default 1.3).
Checked 2026-10-30: the OSRM demo server / routing.openstreetmap.de allow no heavy use (1 request a second) and no access
behind a paywall; GraphHopper's free plan is "for non-commercial use only"; openrouteservice's site states no commercial terms
for its free key; Google and Mapbox were ruled out.
