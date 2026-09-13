# Sales research set — five topics, five infographics

Built 2026-08-18. **Register: company** throughout. **Status: all five are drafts. Nothing
published, nothing scheduled, nothing staged to a platform.** The Blotato visual API renders
images; it does not post. No posting endpoint was called and no account state was changed.

Every piece follows the §6 engine: **a verifiable external fact plus our read on it.** No piece
runs on training material as its substance, and no Surge metric appears anywhere in the set —
none exist in usable form yet (§8, open question 1).

## The five

| # | Topic | Source | Template | Asset |
|---|---|---|---|---|
| 1 | [The listening ratio everyone quotes is gone](01-talk-ratio-linkedin-draft.md) | Gong, 326K calls, updated Mar 2025 | Tutorial carousel, monocolor | 7 cards, 4:5 |
| 2 | [11 to 14 questions, then it drops](02-discovery-questions-linkedin-draft.md) | Gong, 519K calls | Quote card, paper background | 7 cards, 4:5 |
| 3 | [What is left of training week by Monday](03-retention-linkedin-draft.md) | Ebbinghaus / Murre & Dros 2015; Roediger & Karpicke 2006 | **Hand-authored whiteboard** | 1 board, 1080×1350 |
| 4 | [Deliberate practice explains less than it is sold as](04-deliberate-practice-linkedin-draft.md) | Macnamara, Hambrick & Oswald 2014 | Tweet card, dark | 6 cards, 4:5 |
| 5 | [Buyers want no rep, and they want a rep](05-buyers-ai-linkedin-draft.md) | Gartner, 645 buyers, published May 2026 | Tutorial carousel, flat | 7 cards, 4:5 |

Five topics, five different templates, no overlap in either. All five are written for LinkedIn.

**Open [review.html](review.html) in a browser to see the assets beside the copy.**

## Use these files, not the others

| Piece | Post this | Notes |
|---|---|---|
| 1 | `01-talk-ratio-1…7.jpg` | **Drop card 8.** CTA card rendered "Hi, I'm Alex" on purple with tofu buttons |
| 2 | `02-questions-1…7.jpg` | All seven clean. The `highlighterColor` input is dead — no green on any card |
| 3 | `03-retention-board.png` | Rebuild from the HTML if edited; the PNG is an export, not the source |
| 4 | `04-practice-1…6.jpg` | No CTA card on this template. See the draft for an alternate running order |
| 5 | `05-buyers-1…7.jpg` | **Drop card 8**, same CTA defect plus "Alex Hormozi" in the profile band |

## Published to the website, 2026-08-20

**Three of these five are now live on surgeftw.com at `/insights/`** — the
content hub built from recommendation 6 of the site review. Pieces 1, 2 and 3.
They are rewritten as articles rather than pasted: the posts ran to a 200-word
LinkedIn limit and cut verified material to make it, and the articles restore
that from the fact-check logs. Nothing was added that is not in a log here.

Each source was **re-verified first-hand** before publication rather than
trusted from these logs. All four held: Gong's talk-to-listen page confirmed
326,000 calls and the 60/57/62 split; the discovery page confirmed 519,000+ and
the front-load versus spread finding; PLOS ONE and the Roediger and Karpicke
record (via NCBI E-utilities, since PubMed refuses a plain fetch) confirmed
verbatim.

**Pieces 4 and 5 are written into the site's data file and deliberately not
published**, each with its reason recorded on the entry:

- **Piece 4** is held on decision 1 below. It is your call and publishing it
  would have taken the call away from you.
- **Piece 5** is held on decision 2 below. Its figures still have not been read
  first-hand, and the research standard requires that before publication. Open
  the Gartner release in a browser, confirm the numbers, and it goes live
  unchanged.

Both flip on by deleting one `status: 'held'` line in
`dev/surge-site/src/data/insights.ts`.

**One thing found while re-verifying, not published:** Gong's own
*winning-sales-conversations* page still states the 43:57 ratio as current, and
carries a 2026 modification stamp. It is a sharper illustration of piece 1's
point than anything in the post. It stays out because "Gong contradicts Gong"
is a line this draft already cut for making the piece about a company rather
than about the finding.

## Three things to decide before any of this goes out

1. **Piece 4 is the risky one.** It quotes a finding that skim-reads as "training barely
   matters", published by a company that sells training. The draft argues it is defensible and
   explains why, and it also gives the alternate card order that moves our interpretation
   earlier. Your call.
2. **Piece 5's primary source could not be opened directly.** Gartner and BusinessWire both
   403 automated fetches. Every figure was read from a verbatim wire mirror. Open the Gartner
   page in a browser and confirm the seven numbers before it posts.
3. **Piece 4's tweet-card handle.** It renders `@surge.ftw`, which is the real Instagram
   handle, on a visual that looks like an X post. Surge has no X account. Blank the handle if
   that implication is unwanted.

## What the render pass found

**Thirty Blotato cards across four structured templates. Zero fabrications.** Every content
card came back character-for-character as passed. That is now consistent across every
structured-template run on this project, and it is why all four Blotato pieces here were put
on structured templates rather than the image family — **all five topics carry a citation**,
and the image family invents a person, a date or a quotation whenever the genre implies one.

New findings worth keeping:

- **The CTA card defect is confirmed on both tutorial-carousel templates a third time**, and it is worse than "tofu boxes." With `ctaGreeting`/`ctaDescription` unset it falls back to **the template author's real name and bio**. Publishing that card would put Alex Hormozi's name on a Surge asset. Always drop it.
- **`highlighterColor` is dead** on the paper-background quote card (`f941e306`), exactly as `accentColor` is dead on the monocolor tutorial carousel. Add it to the list of inputs that silently do nothing.
- **`ctaButtonText` is also ignored** on the flat tutorial carousel — it rendered "Get Insights →" over the supplied "Swipe".
- **The flat template auto-numbers content items.** Fine for a sequence, wrong for an unordered list.

The one hand-authored board took two render passes: the first collided the subhead with the
rule and plotted five of the study's six intervals. Both fixed and re-checked.

## What is deliberately absent from all five

- **No Surge metric of any kind.** Results are the differentiator and no figure with scope, date and a pullable source exists yet.
- No pay, earnings, ranges, or atmospheric income language.
- No hours, schedule, or day-in-the-life. Piece 3 describes the morning development block by its content, with no clock times.
- No promotion or advancement framing.
- No client named, at any resolution, and no client statistics.
- No scale, footprint or growth framing.
- **No uniqueness or proprietary-method claim.** Piece 4 is where the temptation was strongest and the draft records the line that was cut for it.
- The word "employee" appears nowhere.
- **Three content-farm numbers were found and rejected:** the still-circulating 43:57 talk ratio (piece 1 — this became the post), "you forget 70% within 24 hours" (piece 3), and Gartner's 2019-era 17% buyer-time figure being reported as current (piece 5).

## One thing this set gets close to

Piece 4 ends on "a way to tell whether it moved," and piece 1 ends on a number nobody re-checked.
Both point at the same gap: **there is still no internal Surge measurement to point at.** That is
§8's first open question, and this set makes it more visible than previous work has.
