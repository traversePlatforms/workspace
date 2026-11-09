# Who lives here: the `occ` door field (spec, 8 Nov 2026)

Matthew, 8 Nov: "go ahead and the rented doors, just make sure its obvious which are owner lived in and which arent. Also add a filter into the searches and stuff to be able to mark to find owner listed homes."

## The field

Every door in every town door file carries **`occ`**, a string with one of three values:

| `occ` | Meaning | Where it comes from | Suggested label |
|---|---|---|---|
| `"here"` | The owner lives here. | The county record's mailing address is this house, or a PO box in the house's own town or ZIP (Group 3 rule, Matthew 29 Oct). | "Owner lives here" |
| `"away"` | The owner lives elsewhere: a rental, a second home, or an owner who gets mail at another address. | The mailing address is somewhere else. | "Owner lives elsewhere (rented or second home)" |
| `"unk"` | Nobody can tell. | No owner on record (Group 3b address-point counties: Montrose, Delta, Las Animas, Alamosa, Conejos, Costilla, Bent, Mineral, Washington), or an owner with no mailing address (Sedgwick). | "Occupancy unknown" |

These are the only three values, lower case.

### Which files carry it

- **Door files.** Written by `build-rounds-data.mjs` into each door object of `app/data/rounds/<town>.json`. Those files feed Sixfold, and `build-editions.cjs` copies them unchanged into every edition's `<edition>-data/rounds/`.
- **`index.json`.** Every region also gets `occ: { here, away, unk }` counts. `doors` stays the total of all three.

### Existing doors

- Every door on today's lists passed the owner-lives-here test, so it builds as `"here"`.
- The exception is a door whose `lim` is `noowner` or `noocc`, which builds as `"unk"`.
- `lim: "noname"` (Eagle and Summit: name withheld) is still `"here"`, because occupancy was tested on the mailing address.

### Live files from before this build

Door files already on the server have no `occ` until they are re-uploaded. For those, the exact equivalent is:

```
occ = d.occ ?? ((d.lim === 'noowner' || d.lim === 'noocc') ? 'unk' : 'here')
```

That rule is exact, not a guess: no `away` door exists in any file built before this field.

### `lim` and `rent`

- **`lim` stays as it is.** It says what the county record lacks: `noowner`, `noocc`, `noname`. `occ` says who lives there. They are separate questions.
- **`rent` is retired for door files.** `rent: 1` on the office-lookup files (`<town>-lookup.json`, House lookup only) means the same as `occ: "away"`. Lookup files keep `rent` while they exist. Once the rented homes join the door lists they empty out (7,827 homes stay: public owners and repeats).
- Do not read `rent` on doors.

## The server (api/rounds.php)

The server lists door fields one by one, so `occ` reaches the app only once it is passed through. Add it everywhere a door goes out:

- the area answer;
- the house lookup / Find an address;
- crew search;
- plan table;
- storm doors;
- best points;
- Pipeline / Customers, where they show a door.

Use the fallback above:

```php
'occ' => in_array($d['occ'] ?? null, ['here', 'away', 'unk'], true) ? $d['occ']
       : (in_array($d['lim'] ?? null, ['noowner', 'noocc'], true) ? 'unk' : 'here'),
```

### Counts and scores

Every server-side count and score must apply the install's default filter, or Sixfold's numbers change the day the data lands. That covers:

- "N to knock" and area / town totals;
- neighbourhood scores (`sc`, `sc8`, `bestTownPoints`);
- the regions cache;
- the stats page and EOD report door counts.

Note that the regions-cache signature already changes with the data, so cached answers refresh when the files change.

## The app

### Default view per install

- **Sixfold 365 (`CO.a365`): `"here"` only.** Crews' walk lists, counts and routes stay exactly as now until Matthew says otherwise.
  - The office House lookup still finds every home, as it does today.
  - It shows the `occ` label instead of "not on the door lists".
- **Every edition (Roofing, Yards, Solar, Pest, Security, client installs): all doors**, each with its label.

### Filter

- A Sort & filter chip "Owner lives here" (occ `here`), and its pair "Owner lives elsewhere" (occ `away`).
- Saved per phone like the other filters.
- Offered in the same places: door list, map, desktop workspace, plan table, office lookup and search results.
- Matthew's words: "a filter ... to find owner listed homes".

### Searches

- Find an address and the crew search must match every door, whatever its `occ`.
- Each result shows the label.
- The filter, when set, narrows results.

### Card wording for `"away"`

- The owner shown is the owner of record (likely the landlord). The House lookup already says "Owner of record (the landlord, likely)".
- The person at the door is likely a tenant or a guest.

### Scores

The door score's ability part (value, block owner share) is unchanged. Whether `away` doors should sink in Best first is a product call: none is made here.

## When data with `away` doors goes live

**Nothing with `away` doors is uploaded until both of these exist:**

- `gap1108/GO-rented`: Matthew has seen the counts. This file is also the switch that makes `build-rounds-data.mjs` promote the homes.
- `gap1108/APP-READY`: the server passes `occ`, the default filter is live on Sixfold, and labels and filter are live on every install.

**Upload order:** the app and server first, then the data (`gap1108/finish-rent-2026-11-08.sh`).

A build without `GO-rented` carries `occ` on every door but adds no `away` doors. Its door counts are identical to today's, checked 8 Nov on a preview build: 0 of 406 towns differ.

## Counts (8 Nov preview builds, doors)

### Built on the laptop today

The preview promotes the 96 core towns' office-lookup homes.

| Install | Towns | `here` | `away` | `unk` | Total | Doors in its index now |
|---|---|---|---|---|---|---|
| Roofing, Yards, Solar, Pest, Security (each) | 403 | 1,185,052 | 249,892 | 53,635 | 1,488,579 | 1,232,330 |
| Sixfold 365 (all towns in its index, Texas metros included) | 406 | 1,315,137 | 249,892 | 53,635 | 1,618,664 | 1,362,415 |

Of the office-lookup homes, 256,249 join the lists:

- 249,892 as `away`;
- 6,357 as `here`: owner-lives-here rows the walk lists left out.

### Still measuring on the cloud machine

These come in through the same build and are not in the table above.

| Batch | Doors | `occ` |
|---|---|---|
| El Paso batch (`ep`) | 46,762 | `here` |
| Group 3 local PO boxes (`g3po`) | 23,598 | `here` |
| Rented homes in Groups 1-3 and the El Paso batch (`rent/`, 276 towns: Larimer 42,230, Weld 18,981, Pueblo 15,552, Mesa 13,230, Summit 11,277, Grand 11,001 ...) | 218,503 | `away` |

### When everything has landed (estimate)

Editions would have about **1,255,000 `here` + 468,000 `away` + 53,600 `unk`**.

The `away` figure runs above the Census count of rented and vacant houses in a few counties:

- Grand, Weld and Larimer records don't mark condo units, duplex halves or mobile homes.
- Some owners use a mailing address that isn't the house.

Those doors are still labelled `away`, so the filter separates them.
