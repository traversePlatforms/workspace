# Visual set — 2026-09-14

Four social boards, **company register**, built as send-ready PDFs.

**Status: all four are drafts. Nothing published, nothing scheduled, nothing staged to a
platform.** No posting endpoint was called and no account state was changed. The standing
instruction in `CLAUDE.md` holds: finished work ends in a draft file.

**Open [index.html](index.html) in a browser** to see all four beside their copy.

---

## The four

| # | Board | Visual form | Source | Files |
|---|---|---|---|---|
| 1 | [The conversation works. The door has to open first.](01-doors-contact-rate-draft.md) | Emphasis bar chart + a three-step gate | Gerber & Huber, *Stanford Social Innovation Review*, 2016 | `01-doors-contact-rate.{html,pdf,png}` |
| 2 | [The biggest donor in America is a person.](02-where-giving-comes-from-draft.md) | Photographic masthead + part-to-whole stacked bar | Giving USA 2026 / IU Lilly Family School of Philanthropy | `02-where-giving-comes-from.{html,pdf,png}` |
| 3 | [Watch the swing, not the target.](03-talk-time-swing-draft.md) | Dumbbell chart on one axis | Gong, 326,000 calls | `03-talk-time-swing.{html,pdf,png}` |
| 4 | [Training week is not the learning week.](04-recall-not-review-draft.md) | Four-step flow + two evidence cards (**not a chart**) | Murre & Dros 2015; Roediger & Karpicke 2006 | `04-recall-not-review.{html,pdf,png}` |

Four topics, four different visual forms, no repetition in either. Two dark boards, two light,
alternating. Each `.pdf` is **one borderless page at 1080×1350 (4:5)** — the LinkedIn and Instagram
portrait frame, and it prints cleanly at that ratio. The `.png` beside it is the same board as a
flat image, for anywhere a PDF is awkward.

## The engine

Every piece follows `brand-voice-company.md` §6: **a verifiable external fact plus our read on it.**
No piece runs on training material as its substance — piece 4 uses the morning development block as
the thing the research explains, which is the "seasoning" role §6 describes.

**No Surge metric appears anywhere in the set.** None exist in usable form — scope, date and a
pullable internal source (§8, open question 1). That gap is the single biggest constraint on this
kind of work and this set makes it visible again: three of the four boards end on somebody else's
number because we do not have our own.

## What is deliberately absent from all four

- **No Surge performance figure of any kind.**
- No pay, earnings, ranges, or atmospheric income language.
- No hours, schedule, clock times, or day-in-the-life framing. Piece 4 describes the morning block
  by its content only.
- No promotion or advancement framing.
- **No client named at any resolution.** Piece 2 carries a cleared photograph captioned by sector.
- No scale, footprint, office count or growth framing.
- **No uniqueness or proprietary-method claim.** Piece 4 states the opposite out loud.

## Four numbers that were found and rejected

The research standard earned its keep on this set.

1. **"One additional vote per 14 contacts"** (piece 1) — the most quotable figure in the canvassing
   literature. Three routes to the primary text failed (403, scanned image, paywall), and it
   **conflicts** with the figures that were verified: 4.3 points per contact is closer to one vote
   per 23. Conflicting sources, none authoritative to hand, so it came out.
2. **"Gong retired the 43:57 ratio"** (piece 3) — the framing of the earlier draft on this topic.
   Re-reading the page on 14 Sep 2026, it carries the 326k findings *and* still references 43:57.
   Not supportable, not claimed. See that draft's log.
3. **"You forget 70% within 24 hours"** (piece 4) — traced only to retellings of Ebbinghaus. In
   neither paper. The board prints the fact that it was cut.
4. **"Face-to-face is the highest-converting fundraising channel"** (piece 2) — every hit was a
   vendor blog. No primary source found, so the claim is absent rather than softened.

Two figures survived with caveats printed on the asset itself: the two channel numbers in piece 1
that the source states as ceilings rather than estimates (drawn with a hatched open end), and the
2016 date on that article, which is on the board because the reader should get to weigh it.

## Build notes

- **Palette is the sanctioned one** from `brand/guidelines/README.md`. Nothing was invented. The two
  de-emphasis greys were chosen by running the dataviz validator rather than by eye: `#4b544d` on
  the light ground and `#7d867f` on the dark one both clear CVD separation, the normal-vision floor
  and 3:1 contrast against the brand green.
- **Nominal categories are not ramped.** Piece 2's four giving sources use one emphasis hue plus a
  single de-emphasis grey, separated by the 2px surface gap. Shading four sources
  darker-where-bigger would double-encode the length the bar already shows.
- **Fonts are embedded as data URIs** in `_fonts.css` — Anton for display and Archivo for text, the
  website's own faces. Nothing about the render depends on the network, so the PDFs are
  reproducible offline.
- **`_board.css`** is the shared board system; `_logo.css` carries the wordmark as a mask so it
  takes the board's ink colour. Editing any of the three re-skins all four boards.
- **Rebuild:** the boards are the `.html` files; the PDFs and PNGs are exports. Re-render with
  headless Chrome (`--print-to-pdf` honours `@page`), or with the session script that also captures
  the PNG proof in print media so what gets checked is what gets printed.
- **Do not round-trip these files through PowerShell `Get-Content -Raw`** — the em-dashes and `·`
  will double-encode. `CLAUDE.md`, environment traps.

## Before any of this goes out

1. **Piece 3's date stamp moves.** The Gong page was stamped 20 March 2025 in August and 4 March
   2026 now. Re-read the page and match the copy to the stamp on the day it posts.
2. **Piece 2's photograph** is already live on `/sectors/nonprofit/`. If you would rather the set
   not reuse a site image, `canvassing-25` is cleared and unplaced — though the README there is
   honest that it is bottom-heavy.
3. **Piece 1 rests on a 2016 article.** It is on the board, but it is the thing a sharp reader will
   pick at first.
