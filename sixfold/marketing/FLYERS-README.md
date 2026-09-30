# Flyers and door hanger — 2026-09-18

**Built:** on Matthew's ask for something to hand out, put on doors, put on poles and post
on social. Draft on disk; nothing printed, nothing posted.

| File | Size | For |
|---|---|---|
| `Sixfold-Flyers.pdf` p1 | Letter | **Fire mitigation / who pays** — hand out, leave behind, counter stack |
| `Sixfold-Flyers.pdf` p2 | Letter | **Landscaping, standalone** — hand out, counter stack |
| `Sixfold-Flyers.pdf` p3 | Letter | **The free guide, with tear-off tabs** — poles, boards, hardware shops |
| `Sixfold-Door-Hanger.pdf` | 4.25 × 11 | **Doors.** Front and back |
| `Sixfold-Door-Flyer-Mono.pdf` | 8.5 × 5.5, two up | **The door-to-door leave-behind.** Print this one |
| `Sixfold-Door-Flyer-Green.pdf` | 8.5 × 5.5, two up | Same piece, one green accent, for when a nicer copy is wanted |

Sources: `flyers.html`, `door-hanger.html`, `door-flyer.html`. Rebuild with
`node tools/html-to-pdf.mjs Sixfold-Flyers` / `Door-Hanger` / `Door-Flyer`, all pinned
`scale: 1`.

---

## ⚑ None of them carries an offer, and that is why they exist

`launch-flyers.html` has been blocked since September because its two flyers carry
different, incompatible discounts and **Brandon has picked neither** — and no minimum job
size is set for either. Waiting for that decision has held up flyers for three weeks.

These do not need it. **The differentiator is the money the customer does not know about,
not a percentage off** — which is the strategic finding the whole project rests on
(*every competitor sells the work; nobody sells the money*), and the same position the ad
script kit already takes: *"the scripts above leave the offer out entirely."*

If an offer is ever chosen it drops into the contact strip. Nothing else has to move.

## What is on each, and what is deliberately not

**Page 1 — fire mitigation.** The two funding channels, the ~450 stat, the service list,
and the paperwork promise. Every figure traces to the same sources as `/who-pays/` and the
funding one-pager. No credit amount is promised, no discount is quoted, no county
cost-share is named.

**Page 2 — landscaping.** Makes **no reference to fire work** until the service line at
the foot. It has to be able to stand in front of someone who will never need a saw — see
the landscaping-standalone copy rule. The two blocks are the honest differentiators for a
small outfit: *we walk it before we price it* and *the same crew every time*. The
plant-survival line matches clause 3 of the landscaping agreement, so the flyer and the
contract say the same thing.

**Page 3 — the guide, with tear-offs.** The hook is something free and genuinely useful,
not a service pitch — that is what earns a torn tab. Ten tabs, dashed cut lines, phone and
URL in each. The tab strip pulls out of the sheet's bottom padding so the tabs finish about
0.2 in from the paper edge; a tab that stops half an inch short is hard to get a fingernail
under, which is the only job it has.

**Door hanger.** Front is the mark, what we do, and the number at arm's-length size — a
door hanger is read in about two seconds on the way past. The argument is all on the back
for the ones who turn it over.

---

## Door flyer — rewritten 2026-09-28 around the lawn

**Brandon's ask, in his words:** *"Can we add something like lawn rehab. Or a short
explainer of what we'd do. Like, your lawn sucks, we will make it not."*

So the piece stopped being four service nouns with nothing under them and became **one
argument with a service list beneath it**:

> **LAWN REHAB**
> ### Does your lawn suck?
> Thin, patchy, hard as a driveway? Hard ground sheds water instead of sucking it up, and
> the grass on top thins out no matter what you feed it!
> **1 Aerate. 2 Seed. 3 Feed.** — then the other three services.

**The headline is Matthew's, 2026-09-28, and it is deliberate.** The first pass opened on
*"Thin, patchy, hard as a driveway?"* and he moved that down into the body, putting
Brandon's own phrasing in the largest type on the page. The symptom line still does the
work of letting someone check their own yard — it just no longer has to be the hook. A
noun list ("Lawn & turf — core aeration, overseeding, fertilizing") asks the reader to
already know they need aeration; almost nobody does.

**Brandon's line is the tone, not the claim.** *"We will make it not suck"* is a result,
and the flyer never promises one — it says what we do and in what order, and stops. Same
reason there is **still no price on it**: there is no aeration rate, only Kara's ¾-acre
gauge.

**⚑ The watering tip and the mowing line came off, 2026-09-28** — *"water it a couple of
days ahead, dry ground will not give up a deep plug"* and *"mowing and edging as well,
one-off or month to month."* **Matthew's call: both are a one-to-one conversation, not
print.** Worth knowing they are still the two best things to say on the doorstep, and the
watering tip in particular is the thing no competitor's ad on the Front Range carries
(see `aeration-ad-kit-2026-09.md`). Losing them freed 0.44 in, which went back into the
type rather than into more copy.

**What else moved:**

- **Descriptor is now `Lawn, Land & Fire`** — it still said `Land & Fire`, which the cards
  and magnets no longer do. Brandon's call, and **Matthew showed him the cards, the magnets
  and this flyer on 2026-09-28** — ⚑ his verdict is not written down anywhere, so ask before
  treating it as approved. Nothing is ordered either way.
- **"We stopped by today" moved to the top of the QR column**, which freed the left column
  for the argument and gave the right column a top anchor. The service area is pinned to
  the foot under a matching rule, so the column reads top-and-bottom rather than pooling
  an inch of white.
- **The other three services are unranked and unsequenced** — landscaping is not written
  as the after-job of fire mitigation, per the copy rule.
- **"fuel breaks" came out of the fire line** to hold it to one line. The Colorado State
  Forest Service reference stayed, because that is the part that is checkable.

### ⚑ Vertical room: 4.655 in of 4.700 in used

Under 0.05 in spare — less than one line of body copy. **The overflow is silent**
— the flyer is a fixed 5.5 in box inside an 11 in sheet, so nothing looks wrong on screen
and the only symptom is a **PDF that comes out 2 pages instead of 1**. Check the page count
on every rebuild; the first build of this rewrite failed exactly that way.

The hairline cut rule carries `margin-top:-1px` for the same reason — a zero-height rule
still occupies its own border, and without that the sheet is 11.01 in and spills.

**The type sizes are set to fill the column, not chosen for their own sake.** Cutting the
two lines above freed 0.44 in and it went into the headline, the sub, the gaps between
blocks, and then the `LAWN REHAB` kicker (7.2pt regular → **9.6pt bold**, tracking eased
to .14em, on Matthew's ask that it be visible from further away). If copy goes back on,
those come down again — in that order.

### Fact-check log — the new lawn copy

| Claim on the flyer | Status |
|---|---|
| Hollow tines, cores two to three inches deep, two to four apart | **Verified** — UMass Amherst Extension, 2026-09-23; same wording already shipped in `aeration-video-2026-09/frames.html` |
| The cores stay on the lawn and break back down into it | **Verified** — same source; deliberately kept, it is the thing customers ring up about |
| Hard ground sheds water instead of sucking it up | **Verified** — as above. The frames say *"instead of taking it"*; "sucking it up" is Matthew's wording, to chime with the headline. Same fact |
| Seed goes down while the holes are open; that is what thickens it | **Verified** — as above |
| Spring and fall are the windows | **Verified** — as above |
| Aerate, seed and feed in **one visit** | **Verified against our own job** — Kara's ¾ acre carried 200 lb seed and 150 lb fertilizer; Sixfold owns the aerator |
| *"the grass on top thins out no matter what you feed it"* | **⚑ Unresolved.** A reasonable consequence of the compaction fact above, but not traced to a source of its own. It is the one sentence on here I would cut if you want everything sourced |
| Fire mitigation to Colorado State Forest Service standards | Carried unchanged from the previous version |
| Service area — El Paso, Teller, S. Douglas | Unchanged, and still **derived** (35 mi from Monument), not Brandon's stated area |

## Printing

- **No bleed needed.** Nothing that matters is within 0.5 in of the edge and no colour runs
  off the page, so these print correctly on an office printer. If a shop wants bleed, add
  0.125 in and let the ember rules run out — they are the only elements near an edge.
- **Light register on purpose.** A Pine-dark full-bleed flyer eats toner and looks wrong
  without bleed, and these have to survive being run off fifty at a time on whatever is in
  the office. Same token set as the pamphlet, funding sheet and rate sheets, so the print
  family reads as one company.
- **Door hanger die-cut.** The top **2.6 in carries no content** — every vendor cuts a
  hanger hole there and the dies differ. The dashed circle and slot are screen-only and do
  not print; the vendor supplies the real die line. If their template differs, the only
  thing to move is where the content starts, because nothing is tucked beside the hole.
- **Ember shifts in CMYK** — it comes back a touch duller and browner than on screen. Normal,
  same note as the cards and the magnets.

## ~~⚑ The URL is on all four~~ — cleared 2026-09-28

Standing rule since 2026-09-15 is *design with the URL, print after hosting*. **That gate
is now open: `sixfoldcolorado.com` has been live since 21 Sep 2026**, and the aeration-led
build went up 2026-09-25, so the URL and the QR both land on a real page that leads with
the lawn. The block on printing these for a dead URL no longer applies.

## Social — use the existing kit, do not rebuild

Matthew also asked about posting on media. **There is already a 1080 × 1350 board system**
at `sixfold/content/visual-set-2026-09-14/` with a shared CSS, embedded fonts and a
wordmark mask. Extending that set is the right way to get social versions of these three
messages — **reuse it, do not rebuild**. One caution carried from that folder: **ember and
moss fail colourblind separation as a data pair**, so never use them as two series on the
same board.

Not started, and would be its own job.
