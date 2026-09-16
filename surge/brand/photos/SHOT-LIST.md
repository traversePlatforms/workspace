# Shot list — what the site actually needs

Written 2026-09-11, when Matthew said he would add more photography.

**Photo supply is the single biggest blocker on the site right now.** Four processed
web images exist and most are already placed. It is what is holding up the photo
rotation, the "why choose us" section, the sector/channel depth and the hero video
stills — one session with a camera unblocks all of them.

This list exists so that session produces usable frames rather than fifty photos that
do not fit any slot. **Read the Rules section before shooting** — a frame that breaks
one of those is unusable no matter how good it is.

---

## Rules — these make a frame unusable

From `brand/notes/RESTRICTED.md`. Photo restrictions were loosened on 2026-09-07 and
again on 2026-09-11, so this is a short list now, but it is absolute.

1. **No children.** Matthew's own standing exclusion. No unlock path.
2. **No identifiable members of the public** who have not agreed — anyone who stopped
   at a booth, anyone walking past, a competitor's employee in a branded polo.
3. **No legible personal information** — ID badges with full names and credentials,
   a screen with someone's details on it, a per-person leaderboard.
4. **Client logos and branding ARE fine now** — on shirts, caps, lanyards, laminates,
   banners, kiosks. That was cleared. The words on the page still never name a client.
5. **Boards are fine** — KPI targets, dollar figures, training content on a whiteboard.
   The 2026-09-07 revision cleared board content in photographs. Names against dollar
   figures are still personal information, so a leaderboard with people's names is out.

If a frame is good but breaks one of these, keep it in `brand/photos/` and note why —
do not delete it, and do not use it.

---

## Technical

- **Landscape, 4:3.** Every photo slot on the site crops to 4:3. Shoot wider than you
  need so there is room to crop.
- **At least 1440px on the long edge** before processing. The pipeline downscales;
  it cannot invent detail.
- **Horizontal, not vertical.** Phone video and stills default to portrait — turn it
  sideways. A vertical frame loses most of its content to the 4:3 crop.
- **Avoid heavy backlight from the windows.** Several existing office frames are
  silhouettes because the subject is standing in front of the glass.
- Drop everything in `brand/photos/` in a dated folder. Processing to web sizes is a
  build step, not something to do by hand:
  `node surge/website/build/deploy/optimise-images.mjs surge/brand/photos/<folder>`
  takes HEIC or JPEG, crops to 4:3 at 1440×1080, strips the phone's metadata, and
  warns on any frame that is portrait or too small.

---

## Slots, in priority order

### 1. Photo rotation — the biggest win per photo
The rotator is built and live on `/what-we-do/`'s page-head (`assets/site.css` `.rot`).
**One frame behaves as a plain figure; a second one switches rotation on.** It is the
answer to "more photography without longer pages", and it needs the least from you:
any two or three frames that suit a slot it is already in.

- **Target: 3 frames per slot, 4:3.** Two works; three is better.
- Slots ready or easy to convert: `/what-we-do/` page-head, `/about/` page-head,
  `/about/` "The team" split photo, the homepage Teaching block.
- Frames in one slot should be **the same kind of thing** — three field shots, or
  three office shots. Not one of each; rotating between unrelated subjects reads as
  a slideshow rather than a set.

### 2. "Why choose us" section — 4 frames
Blocked on this, and it is the one Cydcor item still unbuilt. Four cards, each with a
photo and a short heading. What each frame needs to show:

| Card | Frame |
|---|---|
| You see who is on your account | A small group at a desk or board — recognisable faces, working, not posed |
| Numbers the day they happen | Someone entering or reviewing numbers; a board mid-update |
| Trained, then coached | The morning block: a trainer and a rep, paired practice |
| One office, every account | The floor, wide — the room as a room |

The fourth already half-exists (`office-floor-wide.jpg`). The other three do not.

### 3. Hero video stills
Covered in detail in `drafts/surge-site/assets/video/README.md`. Short version:
**shoot a few seconds of video while you are there**, horizontal, slow continuous
movement, nothing legible in frame. It gets blurred to 3px and darkened to 26% behind
the headline, so 1280×720 is plenty.

### 4. Replace `canvassing.jpg`
A known open item. The frame currently used for the careers page is `canvassing-25`,
which `brand/photos/field-cleared/README.md` itself calls "cleared but unplaced — tone
does not fit any page." Anything better replaces it.

### 5. Brandon Long's headshot
`brand/photos/people/` has a 395×333 face-only source with no shoulders or margin — it
will not cut out cleanly onto the studio-grey background the rest of the roster uses,
so he is the one person still on his original brick photo. **Needs a real
head-and-shoulders shot against a plain wall**, matching the framing of Cai's and
Maya's. Five minutes with a phone in the right spot fixes it.

### 6. Channel coverage — the gap nobody has filled
`/what-we-do/` names four channels. Only two have ever been photographed:

- Door to door — **no usable frame exists**
- Phone outreach — **no usable frame exists** (a rep at a desk on a headset would do it)
- Events — covered (`field-booth-event`)
- Booths — covered (`field-kiosk`, `field-booth-nonprofit`)

Phone outreach is the easy one and it is entirely in-office.

---

## What we already have, so you do not re-shoot it

In `drafts/surge-site/assets/img/`: `hero-bg`, `office-floor-wide`, `team-corridor`,
`trainer-presenting`, `morning-block`, `training-cohort-notes`, `canvassing`,
`field-kiosk`, `field-booth-event`, `field-booth-nonprofit`, plus the headshots in
`people/`. Originals are in `drafts/_surge-site-img-originals/` and `brand/photos/`.
