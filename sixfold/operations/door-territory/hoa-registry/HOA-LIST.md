# HOA list for El Paso, Douglas and Teller

**Built 2026-10-03** from the state's active-HOA roster, downloaded free from the Division of Real
Estate. Nothing has been sent to anyone. Rebuild: download a fresh roster (see the header of
`build-hoa-list.mjs`), save it as `hoa-roster-active-<date>.csv`, run `node build-hoa-list.mjs`.

## What's in it

| | HOAs | Units |
|---|---|---|
| Name matches one of our neighbourhoods **and** mails from our counties | 97 | 32,087 |
| Name matches, manager in the Denver metro: **confirm before using** | 42 | |
| In our counties by county or mailing ZIP, no neighbourhood match | 883 | |
| **Total in scope** | **1,022** | |

97 of the in-scope HOAs are matched to 54 of the 186 subdivisions on our door lists, and to 60 of
the 93 HOAs and metro districts that own land in our towns (from the mailing list's
`communities.csv`).

Files:
- `hoa-sixfold.csv`: one row per HOA, matched ones first. It shows which neighbourhood and how
  many of our doors, whether it owns land in our towns (parcels, acres, fire hazard), units,
  managed or self-managed, management company, designated agent and mailing address.
- `management-companies.csv`: the same HOAs grouped by who manages them.
- `summary.json`: the counts above.

## The finding that matters: a few managers run most of them

869 of the 1,022 are professionally managed. The biggest managers in our area:

| Manager | HOAs | Matched to our doors | Units |
|---|---|---|---|
| RowCal Management | 166 | 11 | 15,287 |
| MSI LLC | 97 | 12 | 26,314 |
| Dorman Association Management | 62 | 6 | 6,736 |
| Advance HOA Management | 50 | 4 | 12,081 |
| RealManage / Hammersmith | 48 | 7 | 10,635 |

One relationship with a manager can put Sixfold in front of dozens of boards at once, for common-area
fire mitigation, mowing and aeration. Their office numbers are on their own websites, which is why
the records request for agent phone numbers is optional (see `../HOA-RECORDS-REQUEST.md`).

## How to read a match

- **match** means the HOA's name, stripped of words like "Homeowners Association", "Filing 4"
  and "Inc", is the same as a subdivision on our door lists, and its mailing ZIP or county is in
  El Paso, Douglas or Teller. It is strong, but it is still a name: "Cottonwood Creek" in Colorado
  Springs and "Upper Cottonwood Creek" in Black Forest may not be the same place. Glance at the
  neighbourhood before relying on it.
- **name only, manager in Denver metro** means the name matches but the mailing address is a
  Denver-area manager's office. Some are real local HOAs (Crystal Valley Ranch in Castle Rock is
  run from Denver). Others share a common name with an HOA elsewhere.
- **zip / county only** means the HOA is somewhere in our counties, not tied to our neighbourhoods.

## Limits

- **No phone or email**, and no map boundary. The roster is name, agent, mailing address, units,
  management and renewal dates. The Division says it cannot verify what HOAs submit.
- **County is blank on most of the roster** (7,959 of 8,596). That's why ZIP is used as well, and
  a ZIP is only a guess: a manager's office can be in another town.
- **About 30 mailing addresses are descriptions, not addresses** (for example "Meadows Blvd And
  Butterfield Crossing Drive"). Write to the management company for those.
- One "management company" is a law firm (Altitude Community Law). It's in the data as submitted.

## Fact-check log
- **Source and what it contains:** the Division of Real Estate roster generator, downloaded
  2026-10-03 (8,596 rows, file header lists every field). The Division's Open Record Requests
  page says HOA registration lists are public and points to this generator.
- **County blank on 7,959 rows:** counted from the file.
- **Name-only matches mostly elsewhere:** checked by hand 2026-10-03. Of 106 name-only matches,
  the top mailing cities were Denver 15, Westminster 7, Crested Butte 6, Aurora 6, Boulder 5,
  Breckenridge 5. So name-only rows outside the Denver metro were dropped.
- **Parsing:** the roster has unquoted names containing quote marks. The first parse swallowed
  about 1,000 rows. Fixed, and the parsed count (8,596) matches the file's line count.
- **Unresolved:** whether a matched HOA's land really sits in our neighbourhood. That needs a map
  boundary, which the roster doesn't have; county plat records do.
