# Where to sell Traverse in Colorado — companies vs homes (2026-10-11)

For Matthew. Built overnight from government data. The three scripts in this folder and `../prospects/` rebuild everything with one command each.

## The short version

- **Lawn and landscaping is the biggest pool of buyers by far:** 5,355 active companies in the state register, against 2,373 roofing.
- **They cluster in the Denver metro, then Colorado Springs, then the northern Front Range:** Fort Collins, Loveland, Longmont, Greeley.
- **The app already covers most of the big counties.** The one large lawn market with no towns built is **Larimer County** (Fort Collins and Loveland). It also has the most lawn companies for its size.
- **Yards gains four towns tonight:** Thornton, Erie, Commerce City and Centennial, all in counties with 160–231 lawn companies.
- **Next nights:** Colorado Springs, Denver and Arvada.
- **Next to build from scratch:** Aurora, then Larimer County.

## Companies and homes by county

Companies: US Census County Business Patterns 2023. This counts business locations with paid employees, so one-person outfits without payroll are missing; real numbers are higher. Homes: Census ACS 2020–2024, owner-occupied.

| County | Owner-occupied homes | Lawn and landscaping | Roofing | Pest | Alarm | Homes per lawn company | Our towns |
|---|---|---|---|---|---|---|---|
| El Paso County | 192,232 | 251 | 108 | 19 | 16 | 766 | 9 (Monument, Colorado Springs ×4, Fountain…) |
| Jefferson County | 170,969 | 239 | 121 | 11 | 15 | 715 | 1 (Arvada) |
| Arapahoe County | 166,534 | 231 | 102 | 28 | 28 | 721 | 1 (Centennial) |
| Denver County | 163,555 | 163 | 103 | 14 | 16 | 1,003 | 1 (Denver) |
| Adams County | 129,415 | 160 | 92 | 14 | 9 | 809 | 2 (Thornton, Commerce City) |
| Douglas County | 108,309 | 131 | 59 | 14 | 4 | 827 | 7 (Castle Rock, Parker, Highlands Ranch…) |
| **Larimer County** | 98,737 | **210** | 80 | 17 | 6 | **470** | **none** |
| Weld County | 94,490 | 177 | 65 | 12 | 9 | 534 | 2 (Windsor, Erie) |
| Boulder County | 84,900 | 169 | 20 | 0* | 0* | 502 | 1 (Boulder) |
| Mesa County | 47,707 | 67 | 17 | 10 | 3 | 712 | none |
| Pueblo County | 47,199 | 37 | 20 | 7 | 3 | 1,276 | none |

\* The Census withholds small counts to protect individual businesses, so 0 can mean "a few".

**Reading it:** "homes per lawn company" is how crowded the market is. Larimer, Boulder and Weld are crowded at 470–534 homes per company, which means many competitors needing an edge. Denver and Pueblo have more homes per company. Both matter for selling Traverse: crowded markets have more buyers who need help finding the right doors.

## Which cities the companies are in

Active companies in the Secretary of State register, by the city on their registration (top 8 per trade):

| Trade | Cities |
|---|---|
| Lawn and landscaping | Denver 732, Colorado Springs 439, **Aurora 332**, **Fort Collins 190**, **Longmont 176**, **Littleton 144**, **Lakewood 135**, Grand Junction 130 |
| Roofing | Denver 400, Colorado Springs 251, **Aurora 159**, Littleton 81, Greeley 81, Pueblo 60, Lakewood 59, Fort Collins 59 |
| Solar | Denver 296, Boulder 82, Colorado Springs 50, Fort Collins 44, Louisville 24, Aurora 23 |
| Pest | Denver 41, Colorado Springs 31, Aurora 16, Centennial 11, Fort Collins 10 |
| Alarm and security | Denver 25, Aurora 14, Colorado Springs 13, Centennial 6, Parker 6 |

**Bold** = no door data built there yet.

## Yards towns: what is happening, and the order after

Lawn size and trees per door are what make Yards worth buying. That data now exists for the 14 original towns, and is being made tonight for:

| Tonight | Doors | County | Lawn companies in county |
|---|---|---|---|
| Erie | 9,587 | Weld | 177 |
| Commerce City | 17,059 | Adams | 160 |
| Thornton | 28,882 | Adams | 160 |
| Centennial | 17,632 | Arapahoe | 231 |

At about 10,000 doors an hour, these four take most of the night. **Then, one or two nights each:**
1. **Colorado Springs, all four quarters** (about 100,000 doors). It's the second-largest pool of lawn companies. It is also Sixfold's home market, so selling Yards there sells Sixfold's kind of data to its competitors. That's your call, raised once before.
2. **Denver** (40,000 doors).
3. **Arvada** (30,000), **Boulder** (15,000), **Windsor** (11,000).
4. **Security-Widefield** and **Fountain** (13,000 together).

## Towns to build next (no door data yet)

| Place | Why | What it takes |
|---|---|---|
| **Aurora** | The largest city with no door data: 332 lawn and 159 roofing companies | Arapahoe and Adams county data, both already used for Centennial, Thornton and Commerce City |
| **Littleton, Lakewood** | 144 and 135 lawn companies | Arapahoe and Jefferson data, already used |
| **Longmont** | 176 lawn companies | Boulder County data, already used |
| **Fort Collins, Loveland** (Larimer County) | 210 lawn companies with payroll, the most for its size | A new county: its assessor data has to be found and wired in first |

## The prospect list

`../prospects/prospects.csv` holds **9,102 active Colorado companies** from the Secretary of State register (refreshed daily). Each row has the company, entity type, city, ZIP, year formed, whether one of our towns covers its city, and a link to its official record. Agents' names and street addresses are left out on purpose. The file stays off git because some company names are people's names.

| Trade | Companies | In our towns | Next to our towns | Elsewhere |
|---|---|---|---|---|
| Lawn and landscaping (Yards) | 5,355 | 2,030 | 1,183 | 2,142 |
| Roofing | 2,373 | 1,021 | 548 | 804 |
| Solar | 969 | 519 | 161 | 289 |
| Pest | 297 | 125 | 62 | 110 |
| Alarm and security | 146 | 64 | 38 | 44 |

**Limits:**
- Companies are matched by trade words in their name. "Smith & Sons LLC" is missed, and a few odd matches get in.
- The register shows that a company exists, not how big it is or whether it still trades. "Formed" year is a rough guide: older usually means established.
- It has no phone numbers or websites. Those come from looking each company up, before any outreach. Nothing has been sent to anyone.

## Fact-check log

| Figure | Source | Checked |
|---|---|---|
| Companies by county and ZIP, per trade | US Census Bureau, County Business Patterns 2023 (api.census.gov/data/2023/cbp; NAICS 561730, 238160, 561710, 561621, 238210) | Pulled 2026-10-11 |
| Owner-occupied homes by county | US Census Bureau, ACS 5-year 2020–2024, B25003_002E | Pulled 2026-10-11 |
| Active companies and their cities | Colorado Secretary of State, Business Entities in Colorado, data.colorado.gov 4ykn-tg5h (updated 2026-10-11) | Pulled 2026-10-11 |
| Solar counts | Census has no solar code: electrical contractors (238210) are used, so the Census figure overstates solar. The register list matches "SOLAR" in names, so it doesn't overstate. | Stated in both files |
| Doors per town | Traverse's own door files (`traverse/app/data/rounds`) | 2026-10-11 |
