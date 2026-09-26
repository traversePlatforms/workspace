# Aeration ad kit — Google Search and a filmed ad

**Prepared:** 2026-09-25
**Audience:** internal. Matthew placing the search ads, Brad filming.
**Status:** Draft. **Nothing placed, nothing filmed, nothing scheduled, no budget committed.**
**Deliverable:** [Sixfold-Aeration-Ad-Kit.pdf](Sixfold-Aeration-Ad-Kit.pdf) — 7 pages, the sendable version
**Design source:** [aeration-ad-kit.html](aeration-ad-kit.html) — style block lifted from `ad-script-kit.html`, so the two sheets match
**Video companion, 2026-09-25:** [aeration-video-2026-09/](aeration-video-2026-09/) — a frame-built Facebook video ad for this weekend, because no footage exists and none is being shot. The filmed script below is better and should replace it as soon as there is real footage.
**Companion:** the Nextdoor and Facebook post is [../content/06-aeration-post.md](../content/06-aeration-post.md), and it is post 6 in [../content/Sixfold-Content-Set.pdf](../content/Sixfold-Content-Set.pdf).

> **The designed sheet is still the ember palette, not palette A.** Palette A was adopted
> 2026-09-24 for the **website only**; the ~133 other files carrying an ember value move in one
> coordinated pass once the mark is settled. Repainting this sheet alone would make it the odd
> one out of the marketing set.

---

## Why the existing Ad Script Kit does not carry over

[ad-script-kit.md](ad-script-kit.md) is built on one idea: *every competitor sells the work,
nobody sells the money.* Four parties pay for fire mitigation and almost no homeowner knows it,
so the ad is about the money rather than the chainsaw.

**There is no money story for a lawn.** No tax credit, no insurer discount, no county cost-share,
no grant. Reskinning that kit for aeration would produce an ad with its engine removed.

**What does transfer is the shape of the idea, not its content:** be the one that turns up
knowing how the work actually goes. For aeration that is a different, smaller, truer gap —
everyone sells *a pass over the lawn*, and nobody explains what it does, when it works, or why
the plugs are left lying there.

Two facts do the whole job, and neither appears in a competitor's ad on the Front Range:

1. **Water the lawn a couple of days before** — dry ground will not give up a deep plug.
2. **The plugs stay on the lawn**, look untidy for a fortnight, and that is where the benefit is.

**Do not claim to be the honest one.** Just carry the information. Saying "unlike other
companies, we tell you the truth" is a claim the reader will go and test.

---

## ⚑ Two gates before any of this spends money

### 1. The search ads need the repositioned site live

The local build leads with lawn aeration. **sixfoldcolorado.com still leads with fire
mitigation** — the 2026-09-21 build. Point search ads at it as it stands and:

- someone clicking "lawn aeration" lands on a page whose headline is fire mitigation;
- Google scores landing-page relevance against the query, so the mismatch costs money on
  every click before anything else goes wrong.

**Re-bundle and upload before the first click, not after.** The form-email problem matters
here too: a form submission is logged but no email arrives, so paid clicks would produce leads
that sit in `submissions.log` until someone remembers to open it.

### 2. ~~There is still no aerator and no aeration rate~~ — half closed 2026-09-25

**Sixfold owns an aerator and a riding mower** (Matthew, 2026-09-25), so the "when can you come" half is answerable and the site claim is no longer unbacked.

**The price half stands.** Ads generate calls, and a call asks what it costs. The only figure is Kara's $1,100 for ¾ acre with seed and fertilizer inside it, which Matthew has set as an internal gauge — not a rate and not a published price. So the answer to a stranger still has to be agreed in advance rather than improvised at the moment someone is deciding whether to trust a new company.

You chose to push this fall knowing that, which is a fair call for a small test. **Worth having
a price you are willing to be wrong about before the first ad runs**, rather than during it.

---

## Google Search — responsive search ad

Google allows up to **15 headlines of 30 characters** and **4 descriptions of 90 characters**,
and assembles them itself. Every asset below is inside the limit and none carries a price, a
credential, a guarantee or a capacity claim.

### Headlines

| # | Headline | Chars |
|---|---|---|
| 1 | Core Aeration, Front Range | 26 |
| 2 | Lawn Aeration in Monument | 25 |
| 3 | Aeration and Overseeding | 24 |
| 4 | Colorado Springs Aeration | 25 |
| 5 | Aerate Before It Freezes | 24 |
| 6 | Hollow Tine Core Aeration | 25 |
| 7 | Real Plugs, Not Spike Holes | 27 |
| 8 | Compacted Lawn? Core It. | 24 |
| 9 | Aeration Plus Seed, One Visit | 29 |
| 10 | Black Forest, Palmer Lake | 25 |
| 11 | Based in Monument, CO | 21 |
| 12 | We Walk It Before We Quote | 26 |
| 13 | Book a Lawn Walk | 16 |
| 14 | Overseed After Aerating | 23 |
| 15 | Fall Aeration Window | 20 |

### Descriptions

| # | Description | Chars |
|---|---|---|
| 1 | Core aeration and overseeding in El Paso, Teller and southern Douglas counties. | 79 |
| 2 | Hollow tines pull plugs two to three inches deep. The cores stay and feed the lawn. | 83 |
| 3 | Spring and fall are the windows. We walk the property and tell you what it needs. | 81 |
| 4 | Monument, Colorado Springs, Black Forest, Palmer Lake, Larkspur, Castle Rock. | 77 |

### Keywords, tight to start

Exact and phrase only. Broad match on a small budget in a new account spends it on tyre-kickers.

```
[lawn aeration]                    [core aeration]
"lawn aeration near me"            "aeration and overseeding"
"lawn aeration colorado springs"   "aerate lawn monument co"
"core aeration black forest"       "overseeding colorado springs"
```

### ⚑ Negative keywords — the ones that matter

**"Aeration" is not only a lawn word.** Left alone, this campaign will pay for clicks from
septic, wastewater, pond and brewing searches, which is the same collision that once put
Surge in the HVAC business by mis-transcription.

```
-septic      -wastewater   -sewage      -pond        -lagoon
-aquarium    -fish         -diffuser    -blower      -tank
-brewing     -wine         -compost
```

And the ones that click but never buy:

```
-rental      -rent        -for sale    -diy         -"how to"
-machine     -jobs        -hiring      -salary      -course
```

### Settings

| | |
|---|---|
| **Location** | Radius around Monument rather than the whole state. The service area on record is 35 miles, and **widening it needs Brandon** |
| **Location option** | *Presence* — people in the area, not people interested in it. The default includes the second and wastes small budgets |
| **Schedule** | Daylight hours. A lawn-care click at 2am is rarely a lawn-care click |
| **Landing page** | `/services/#lawn` once the repositioned site is live — not the home page, and not before |
| **Conversion** | The form is the conversion. **It logs but does not email**, so decide how a lead gets noticed before spending |

---

## The filmed ad, for Brad

### The one shot nobody else uses

Every aeration ad on the internet opens on the machine. **Open on a plug in a hand.**

A soil core is a genuinely odd-looking object — a two-to-three-inch cylinder of earth with grass
still attached to the top. Most people have never seen one close up and have no idea it is what
the service produces. Hold it to camera before anything else happens and the viewer has already
learned something, which is the whole strategy in one frame.

The machine is in the ad. It is not the first thing in the ad — same rule the fire kit set.

### Thirty seconds

| Beat | On screen | Words |
|---|---|---|
| 0–4s | Close on a hand holding one plug, turf side up | "This came out of a lawn about ten seconds ago." |
| 4–10s | Wide: the machine working, plugs dropping behind it | "It's called core aeration. Hollow tines, straight down, two to three inches." |
| 10–18s | Ground level: water pooling on hard ground, then soaking into an aerated patch | "Compacted soil sheds water instead of taking it. That's why the same patch goes brown first every year." |
| 18–24s | The lawn covered in plugs, then a later shot of the same lawn clear | "The plugs stay. They look untidy for a fortnight and then they're gone back into the turf." |
| 24–30s | Crew walking the property with the owner. Mark and phone number | "We'll walk it with you and tell you what it needs. Sixfold Colorado." |

### Sixty seconds — add these two beats

- **Before the machine**, at about 8s: *"One thing worth doing before anyone turns up — water it a couple of days beforehand. Dry ground won't give up a deep plug."* This is the line that earns a share, because it is useful whether or not they ever call.
- **After the plugs beat**, at about 40s: overseeding. *"Seed goes down straight after, while the holes are open. That's the part that thickens it."*

### Lines that are safe to say as written

Every one traces to the fact check below. **Changing the numbers is where this goes wrong.**

- "Hollow tines, straight down, two to three inches."
- "Holes two to three inches deep and no more than two to four inches apart."
- "It only does much if actual cores come out, rather than a spike pressing the hole shut."
- "Water it a couple of days beforehand — dry ground won't give up a deep plug."
- "The plugs stay on the lawn and break down back into it."
- "Spring and fall are the best windows, and it can be done any time the ground isn't frozen or baked hard."

### Do not say

- Any price, any discount, any "free estimate" — standing rule, and the site auditor greps for it.
- "Licensed and insured", "certified", "bonded" — none of it is true yet.
- Any guarantee that the lawn thickens, greens up or that seed takes. It depends on water and weather, and the customer agreement says so in writing.
- Anything implying a crew size, a booking limit, or a job count. Sixfold has no aeration track record and the ad should not imply one.
- "We're the honest ones." Carry the facts; do not editorialise about carrying them.

---

## Fact check

| Claim used in an ad | Status |
|---|---|
| Hollow tines, plugs two to three inches, dropped on the surface and broken down as topdressing | **Verified** — UMass Amherst Extension, *Management of Compaction and Coring* |
| Holes 2–3 in deep, 2–4 in apart; most effective when actual cores are pulled; water a couple of days prior for deep plugs | **Verified** — CSU PlantTalk 1505, *Lawn Aeration* |
| Compaction sheds water; aeration helps water and fertilizer reach the root zone and controls thatch | **Verified** — CSU PlantTalk 1505 |
| Spring and fall best; any time the ground is not frozen; not when hot and dry | **Verified** — CSU PlantTalk 1505 |
| Overseeding after aeration, 3–4 lb per 1,000 sq ft | **Verified** — CSU Extension 7.241, *Renovating the Home Lawn*. The rate is not in the ad copy, only in the seeding decision |
| Google RSA limits: 15 headlines at 30 characters, 4 descriptions at 90 | **Verified** — Google Ads Help, *About responsive search ads*. Every asset above counted, not estimated |
| A specific month range for the Front Range fall window | **Not used.** No CSU source names months |
| Cost per click, expected volume, or any budget figure | **Not estimated, and not invented.** No account exists and no benchmark was checked |
| That Sixfold can perform aeration | **Verified 2026-09-25** — aerator and riding mower owned, recorded in `operations/gear-checklist.md` §Turf equipment. The *rate* is still a gauge, not a rate |

Sources: <https://planttalk.colostate.edu/topics/lawns/1505-lawn-aeration/> ·
<https://www.umass.edu/agriculture-food-environment/home-lawn-garden/fact-sheets/management-of-compaction-coring> ·
<https://extension.colostate.edu/topic-areas/yard-garden/renovating-the-home-lawn-7-241/> ·
<https://support.google.com/google-ads/answer/7684791>
