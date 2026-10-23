# Aeration video ad — Facebook, weekend of 2026-09-26

**Built:** 2026-09-25
**For:** Matthew, to assemble and place. **Nothing is placed, scheduled, boosted or spending.**
**Companion:** the search ads and the filmed script are in [aeration-ad-kit-2026-09.md](../aeration-ad-kit-2026-09.md). This file is the no-footage version of the same ad, built to run this weekend.

**Why frames and not film.** No aeration footage exists, none is being shot before the weekend, and every photograph in the library is trees, slash or cleared ground. Drawings are the honest substitute: they illustrate rather than pretend to document, which a stock lawn photo would not. **When there is real footage, the filmed script in the ad kit is better than this and should replace it.**

---

## What is in the box

| | |
|---|---|
| `out/9x16/` | Eight 1080×1920 PNGs — Reels, Stories, and the vertical feed |
| `out/4x5/` | The same eight at 1080×1350 — the 4:5 feed cut |
| `preview.html` | **Plays the clip** at the real timings, in a browser. Toggles: 20s/30s cut, 9:16 vs 4:5, and a mock Reels UI so the safe areas can be judged in motion rather than argued about |
| `frames.html` | Review sheet. Every frame with the Reels safe areas drawn on top |
| `build-frames.mjs` | The generator. **The frame text lives there, not here** — change it there and re-run `node build-frames.mjs` |

**Two cuts out of the same eight frames.** The 20-second cut is the one to run first: frames 1, 2, 3, 4, 5, 8. The 30-second cut adds 6 and 7.

---

## See it first

Open **preview.html** in a browser. It runs the same frames on the same timings, so you can judge the hook and the pace before spending fifteen minutes in CapCut. There is no ffmpeg on this machine, so an actual MP4 has to come out of CapCut — the preview is not the deliverable.

## Assembly — CapCut, about fifteen minutes

1. New project, canvas **9:16**.
2. Import `out/9x16/` and drop all eight in filename order. Filenames sort correctly; do not re-order them.
3. Set each frame's duration from the table below. **No transitions**, or a 0.2s dissolve at most — a cross-fade on a text frame costs you a readable word.
4. Music: use a track cleared for commercial use. **Meta's own Sound Collection, inside Ads Manager, is the safe one.** CapCut's library is not licensed for paid ads by default, and that is the sort of thing that gets an ad account, not just an ad, taken down.
5. Export **1080×1920, 30fps, MP4 (H.264)**. Repeat with `out/4x5/` on a 4:5 canvas if you want the feed cut as well — same durations.

| # | Frame | Holds | In the 20s cut |
|---|---|---|---|
| 01 | `core` — the plug | 3.5s | ✅ |
| 02 | `tines` — hollow tines, depth | 3.5s | ✅ |
| 03 | `water` — compacted vs cored | 4s | ✅ |
| 04 | `water-it` — water it a couple of days before | 4s | ✅ |
| 05 | `plugs-stay` — the plugs stay on the lawn | 4s | ✅ |
| 06 | `seed` — seed goes down after | 3.5s | — |
| 07 | `when` — spring and fall | 3.5s | — |
| 08 | `cta` — walk it with you | 4.5s | ✅ |

**Full cut 30.5s. Short cut 23.5s.**

### If you want a voiceover

Read it on a phone in a quiet room, one line per frame — the lines are in `build-frames.mjs` under `vo:` and every one of them is already cleared against the fact check in the ad kit. A voice makes the ad noticeably better and costs ten minutes. **It does not replace the on-screen text**, which is what carries the ad for the majority who watch with the sound off.

---

## The ad itself

### Primary text — three, run one

**A — the useful fact first.** Longest odds on a click, best odds on a share.

> Water the lawn a couple of days before anyone aerates it. Dry ground won't give up a deep plug, and a shallow pass does very little.
>
> Core aeration pulls plugs two to three inches out of the turf so water and fertilizer reach the roots instead of running off. The plugs stay where they fall and break back down into the lawn.
>
> Sixfold Colorado — Monument, Colorado Springs, Black Forest, Palmer Lake.

**B — short, straight.**

> Hollow tines, two to three inches down, plugs left on the surface to break down. That's core aeration, and it's what compacted Front Range ground needs before anything else will help.
>
> We'll walk your lawn and tell you what it needs.

**C — seasonal. Dates itself, so only run it now.**

> Spring and fall are the windows for aerating, and one of them is open. Core aeration and overseeding across El Paso, Teller and southern Douglas counties — we'll walk the property with you first.

### Headline and description

| Field | Use |
|---|---|
| Headline | `Core aeration on the Front Range` (32) · or `Lawn aeration in Monument, CO` (29) |
| Description | `Aeration and overseeding` · or `El Paso, Teller, southern Douglas` |
| Button | **Learn more** |
| Destination | `https://sixfoldcolorado.com/services/aeration/` |

**Not "Book now" and not "Get quote."** Book now implies a calendar that does not exist, and get quote implies a price is waiting at the other end. Learn more is what the page actually does.

### Settings

| | |
|---|---|
| **Objective** | **Traffic**, to the website. Not Leads — an instant form lands in Meta's inbox, which is the same failure as `submissions.log`: captured, and nobody looking |
| **Special ad category** | **None.** Lawn care is not housing, employment, credit or politics |
| **Location** | Radius on **Monument**, set to **"People living in or recently in this location."** The default includes people merely *interested* in the area and it will eat a small budget |
| **Radius** | Keep it inside the service area on record — El Paso, Teller and southern Douglas. **Widening that is Brandon's call**, not an ad setting |
| **Age** | 30–65+. Below 30 rents |
| **Detailed targeting** | **None to start.** On a small budget geography does more work than interests, and Meta's homeowner-ish audiences are thin and expensive |
| **Placements** | Advantage+ placements on — you have both 9:16 and 4:5, so let it use them |
| **Budget** | Yours. Whatever it is, treat the weekend as a **read, not a verdict** — a two-day run will not finish Meta's learning phase, so cost per click will look worse than a steady run would |

---

## ⚑ Before it spends anything

1. **The site has to be up in the new shape.** The ad points at `/services/aeration/`, which exists on disk and **not on sixfoldcolorado.com** — the live site is still the 2026-09-21 fire-led build. You said you'll have it up before launch; this is the thing that has to be true. Re-bundle with `make-bundle.mjs`, upload, cache-bust, and open the URL yourself before the ad goes live.
2. **Decide what the phone answer is.** Ads make the phone ring, and the first question is what it costs. There is no aeration rate of Sixfold's own — the only figure is Kara's $1,100 for ¾ acre with seed and fertilizer inside it, and that is an internal gauge. **Agree the sentence before the phone rings**, even if the sentence is "we price it at the walk."
3. **The site form still logs without emailing.** Anyone who fills it in this weekend is in `submissions.log` and nowhere else. Open it Monday, or put the phone number first.

---

## What is deliberately not in the ad

- **No price, no discount, no "free estimate."** Standing rule, and it is also what stops a weekend test from setting a number you have not costed.
- **No "licensed and insured," certified, or bonded.** None of it is true yet.
- **No guarantee** that the lawn thickens or the seed takes. It depends on water and weather, and the customer agreement says so in writing.
- **No crew size, no booking limit, no job count.** Sixfold has no aeration track record and the ad should not imply one.
- **No before-and-after.** There is no real Sixfold aeration job to show.
- **No months named.** No CSU source gives a Front Range window in months, so the ad says spring and fall and stops.
- **No "we're the honest ones."** The ad carries the facts; it does not congratulate itself for carrying them.

---

## Design notes

**Palette A, not the marketing set's ember.** The website adopted Palette A on 2026-09-24 — green leads, ember keeps the call to action and fire mitigation only. These frames follow the website rather than the marketing set, because they are customer-facing, they land on a page built in Palette A, and an orange lawn ad fights its own subject. Ember appears exactly once, on the button-shaped chip in frame 8.

**One invented colour: `--soil`.** You cannot draw a soil core in five greens. It is illustration-only — never type, never a surface, never brand — and it appears in two drawings.

**Safe areas.** Reels paints its own UI over the frame: profile row and caption at the bottom, sound and menu at the top. Nothing that must be read sits in the bottom 420px or the top 250px of a 9:16 frame. `frames.html` draws those bands over each frame so you can see it holds.

**The drawings are proportioned, not decorative.** The core is drawn near 1:3.3 because a real one is about ¾ inch across and two to three inches long; the depth bracket in frame 2 measures the actual tine penetration drawn, not a decorative arrow.

---

## Fact check

| Claim on screen | Status |
|---|---|
| Hollow tines, two to three inches deep, two to four inches apart | **Verified** — CSU PlantTalk 1505, *Lawn Aeration* |
| A core is roughly ¾ in across, 2–3 in long, dropped on the surface and broken down as topdressing | **Verified** — UMass Amherst Extension, *Management of Compaction and Coring* |
| Compacted ground sheds water; aeration helps water and fertilizer reach the root zone | **Verified** — CSU PlantTalk 1505 |
| Water it a couple of days before; dry ground will not give up a deep plug | **Verified** — CSU PlantTalk 1505 |
| Spring and fall are the windows; any time the ground is not frozen or baked hard | **Verified** — CSU PlantTalk 1505. **No months named** — no CSU source gives them |
| Seed goes down after aeration, while the holes are open | **Verified** — CSU Extension 7.241, *Renovating the Home Lawn* |
| "The patch that goes brown first every year" | **Reasonable inference from the compaction fact, not a cited claim.** It describes what a homeowner sees; it is not a number and nothing rests on it |
| Meta's ratios, character limits and placement behaviour | ⚑ **Not re-verified today.** Ads Manager enforces its own limits live and shows them as you type — the copy above is written short enough that the exact numbers do not matter. Check the character counter, not this table |
| Cost per click, expected reach, expected leads | **Not estimated and not invented.** No account history exists |
| That Sixfold performs aeration | **Verified 2026-09-25** — Sixfold owns an aerator and a riding mower. `operations/gear-checklist.md` §Turf equipment |

Sources: <https://planttalk.colostate.edu/topics/lawns/1505-lawn-aeration/> ·
<https://www.umass.edu/agriculture-food-environment/home-lawn-garden/fact-sheets/management-of-compaction-coring> ·
<https://extension.colostate.edu/topic-areas/yard-garden/renovating-the-home-lawn-7-241/>
