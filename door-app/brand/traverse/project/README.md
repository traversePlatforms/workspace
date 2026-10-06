Traverse is field sales software: a rep's doors, phone calls, appointments and pipeline in one app, with an edition for each trade. The company is **Traverse Platforms**; traverseplatforms.com explains the product, and each edition lives at its own `traverse<trade>.app` (TraverseSolar, TraverseRoof, TraversePest, TraverseYards).

## The idea

A traverse is the surveyor's way across a territory: measured legs from station to station until the line closes. That is a rep's day, door to door, and a deal's path, stage to stage. The mark is that line: three legs, four stations, rising left to right, the last station in flagging-tape orange, the colour surveyors tie on a stake to say *here*.

## Voice

- Plain and field-tested. Short sentences, verbs first: "Mark the door. Book the walk."
- Say what the app does, never what it will do for a business: no invented results, counts or percentages.
- Name trades and real tasks: "hail at the house", "roof squares", "monthly plan", "come back in spring".
- Sentence case for headings and buttons. No exclamation marks, no emoji.
- One sentence per idea; don't add a sentence explaining why the last one mattered.

## Visual foundations

**Colour.** Grounds are `surface` (the map table) and `surface-raised` (cards). Text is `ink`, secondary `ink-muted`. `deep` (benchmark navy) is the brand's weight: header bands, the parent icon, large blocks; it flips pale in dark so it never sinks into the dark ground, and anything on it is `on-deep`. `flag` is the only action colour: primary buttons, the closing station, the focus ring; never decoration. Edition colours (`solar`, `roof`, `pest`, `yards`) fill tiles, pins and thin header rules in their edition, always with their `on-` colour; never as text on a surface. Pipeline states use `won` / `lost` with their `-soft` grounds, always with the word.

**Type.** `display` (Familjen Grotesk) for the wordmark, headlines and numbers that matter; `sans` (Atkinson Hyperlegible) for everything read, chosen because reps read in sun and in trucks; `mono` (JetBrains Mono) for figures in lists: distances, dates, roof squares, hail sizes. Never below 13px in the app.

**Shape.** Cards and blocks `radius-lg`, buttons `radius-md`, chips and pins `radius-pill`. Cards carry `shadow-card`; chips and buttons are flat. Spacing steps `space-1` to `space-12`; the app's gutter is `space-4`.

**Layout.** The map comes first; lists and cards sit over it. One primary (flag) button per view. Buttons are 44px tall.

**Focus.** Keyboard focus is a solid 2px `focus` (flag) ring, 2px off the element: 4.2:1 on `surface`.

**Imagery.** Real work photographed on site, never stock people. Maps and aerials are welcome; the traverse can be drawn over them in `deep` with the flag close.

## Logo and editions

Use the files in Logos. The colour mark on light grounds, the reverse on `deep`, the navy mark for one-colour work. The close stays flag orange on the colour and reverse marks. Clear space is one closing station; minimum 20px for the mark, 96px for a lockup. Edition lockups pair the edition's icon tile with "Traverse" + the trade word (see the Editions component).

## Iconography

Line icons at 2px stroke with round caps and joins, matching the traverse. Filled only for states (a booked door, a won deal). No emoji.
