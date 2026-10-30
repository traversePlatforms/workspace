# Hail and live weather: sources and the hail-hours rebuild (2026-10-29)

## Hail hours for every town and day

`rebuild-hail-hours.mjs` rebuilds `app/data/rounds/hail-hours.json` (the hours hail of 0.75 in or more showed over a town on a storm day;
the door card's "about 3-5 pm"). `build-hail-hours.mjs` only adds days it has not seen, so towns added after 2026-10-12 had no hours
for older days (27 towns, 66 days then; the plan on 2026-10-29 is 187 towns, 160 days, 1,318 town-days).

- `node rebuild-hail-hours.mjs stage <plan.json>` on the laptop: each town's door box and each date's towns, from every `hail-<town>.json`
  and `hail-storms.json`. No owners and no door ids leave the laptop.
- `node rebuild-hail-hours.mjs build <plan.json> <out.json> [--conc=4]` on the cloud machine: about 36 radar files a day (one every
  20 minutes, 11 am to 11 pm Colorado time); resumes from `<out.json>.progress`. A one-day trial on 2026-10-29 (2026-08-26, 16 towns)
  took 74 s; the old file had 4 towns that day, the rebuild 7 (3 of the 4, plus 4 towns added since; Parker's 5 pm hour did not come back,
  with 35 of 36 radar files in the archive).
- Run by `finish-hailhours-2026-10-29.sh`, stage `hailhours` of `traverse/ops/run-cloud-finishers.sh`, after `g3hail.done`. It pushes
  the one file to Roofing (`push-edition.sh traverse-data '^hail-hours\.json$'`), the only edition with hail files.

Source: NOAA/NSSL MRMS MESH, archived by Iowa State University (mtarchive.geol.iastate.edu), as build-hail.mjs uses it.

## Live weather in the app (rounds.php, the page)

| What | Source | Terms (fetched 2026-10-29) |
|---|---|---|
| Active alerts, Colorado | `api.weather.gov/alerts/active?area=CO`, one request per refresh for all installs, shared in `traverse-shared/weather/nws-co.json` | weather.gov/documentation/services-web-api: "intended to be open data, free to use for any purpose"; reasonable rate limits; a User-Agent with contact is asked for (agentHeader) |
| Zone outlines (alerts with no polygon) | `api.weather.gov/zones/<type>/<id>`, kept 30 days in `traverse-shared/weather/zones.json` | as above |
| Alert links | `forecast.weather.gov/showsigwx.php?warnzone=..&warncounty=..&product1=..` (shows the text when given a forecast zone and a county, checked against live alerts); otherwise `api.weather.gov/alerts/<id>` | NWS, public |
| Wildfires | NIFC WFIGS current incident locations, one envelope query over Colorado + ~60 mi, shared in `traverse-shared/weather/wfigs-co.json` | NIFC's licence text is a liability disclaimer (not legal documents); no use restriction |
| Radar tiles, time, past hour | Iowa Environmental Mesonet: `cache/tile.py/1.0.0/nexrad-n0q-900913[-mXXm]`, `data/gis/images/4326/USCOMP/n0q_0.json`; the `-m05m`..`-m55m` layers are listed on mesonet.agron.iastate.edu/ogc/ | IEM disclaimer: "in the public domain and may be used freely by anyone for any lawful purpose. Attributing the Iowa Environmental Mesonet of Iowa State University would be appreciated." Credit kept on every map |

`alerts.weather.gov` no longer resolves (checked 2026-10-29, also against 8.8.8.8). Event names are as `api.weather.gov/alerts/types`
lists them on 2026-10-29 (Extreme Cold Warning, not Wind Chill Warning).
