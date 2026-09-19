# Flyers and door hanger — 2026-09-18

**Built:** on Matthew's ask for something to hand out, put on doors, put on poles and post
on social. Draft on disk; nothing printed, nothing posted.

| File | Size | For |
|---|---|---|
| `Sixfold-Flyers.pdf` p1 | Letter | **Fire mitigation / who pays** — hand out, leave behind, counter stack |
| `Sixfold-Flyers.pdf` p2 | Letter | **Landscaping, standalone** — hand out, counter stack |
| `Sixfold-Flyers.pdf` p3 | Letter | **The free guide, with tear-off tabs** — poles, boards, hardware shops |
| `Sixfold-Door-Hanger.pdf` | 4.25 × 11 | **Doors.** Front and back |

Sources: `flyers.html`, `door-hanger.html`. Rebuild with
`node tools/html-to-pdf.mjs Sixfold-Flyers` / `Door-Hanger`, both pinned `scale: 1`.

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

## ⚑ The URL is on all four

Standing rule since 2026-09-15 is *design with the URL, print after hosting*. These are
designed. **`SixfoldColorado.com` does not resolve yet** — if these go to a printer before
the site is live, the URL on them is dead, and a flyer on a pole outlives the mistake.

## Social — use the existing kit, do not rebuild

Matthew also asked about posting on media. **There is already a 1080 × 1350 board system**
at `sixfold/content/visual-set-2026-09-14/` with a shared CSS, embedded fonts and a
wordmark mask. Extending that set is the right way to get social versions of these three
messages — **reuse it, do not rebuild**. One caution carried from that folder: **ember and
moss fail colourblind separation as a data pair**, so never use them as two series on the
same board.

Not started, and would be its own job.
