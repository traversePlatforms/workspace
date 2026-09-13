# 5 Steps to Build Value — LinkedIn carousel (Blotato template test)

**Created:** 2026-08-06. **Status:** draft asset only. Not published, not scheduled, not staged.

**Source:** [training-source/5 Steps to Build Value.docx](../training-source/5%20Steps%20to%20Build%20Value.docx)
**Register:** company.
**Files:** `5-steps-carousel-01.jpg` … `-07.jpg` (intro, 5 content slides, CTA).
**Blotato creation ID:** `518356bf-81db-4b94-a60b-49835b99386f`

---

## Template

**Tutorial Carousel with Monocolor Background** — `/base/v2/tutorial-carousel/e095104b-e6c5-4a81-a89d-b0df3d7c5baf/v1`

Not used before. Chosen deliberately over the single-`description` infographic templates (Whiteboard, Chalkboard, Newspaper, TV Wall, Billboard and the rest of that family), which are the AI-drawing kind that have twice invented whole sections — including a four-step process that contradicted Surge's own five.

**Inputs were passed explicitly, not via `prompt`.** The tool documentation recommends the opposite — pass a prompt and let the AI fill the inputs. **That is precisely the fabrication path and should not be used for anything factual.** Explicit `inputs` on a structured template means the renderer typesets the exact strings supplied and invents nothing.

---

## Verification — all 7 slides downloaded and read

**No fabrication. Every slide renders exactly the text supplied, no additions, no invented steps, no altered wording.**

This is now a third confirmation of the same pattern: **structured templates (tutorial carousel, quote card, tweet card) render literally. Prompt-driven image templates invent.** The rule is reliable enough to plan around.

### Defects found in the render

| # | Issue | Severity |
|---|---|---|
| 1 | **CTA buttons show tofu boxes** — `□ Repost`, `□ Follow`. The template injects an icon glyph the font can't render. | **Blocking** — looks broken |
| 2 | **CTA button text is purple**, off-palette. Not controllable via any exposed input. | Moderate |
| 3 | **`hasAccentLines: true` did nothing visible** on slides 1 and 5. Setting appears inert, or is far too subtle at this size. | Minor |
| 4 | **Content slides are roughly half empty.** Text sits top-third; the lower half is blank. | Moderate — see below |
| 5 | **"Surge / Surge Inc" is redundant.** The `authorName`/`companyName` pair is designed for a person plus a handle. | Minor |

**On #4 — the density problem.** The established house style for Surge infographics is deliberately dense; sparse was a failure mode identified earlier and corrected. This template is structurally sparse and there is no input to change it. Either accept a different look for carousels than for infographics, or push more text into each `description` (they take up to 400 characters and I used well under half).

**On #1 — this alone should stop the asset shipping as-is.** A broken glyph on the final slide is the last thing a reader sees.

---

## What was cut from the source, and why

**This matters more than the render defects.** The source document is not fully publishable, so the carousel is not a faithful reproduction of it. Per [training-publishability-review.md](../training-publishability-review.md) and [brand/notes/RESTRICTED.md](../brand/notes/RESTRICTED.md):

| Step | In the source | In the carousel | Why |
|---|---|---|---|
| 1. Introduction | SEE — Smile, Eye contact, Enthusiasm | **All of it** | Cleared. Clean pedagogy. |
| 2. Short Story | WWW + KISS | **All of it** | Cleared. |
| 3. Presentation | Put it in their hands · Package and Present · **Dollars vs Bucks / Us vs them** · **Stress the deal** · **Triple Price Breakdown** | Only the first two | The rest is Tier 2 restricted — price-framing and pressure mechanics |
| 4. Close | Qualifying questions (**Yes/Yes**) · **Assume the transaction** · Close with confidence · **ABC** | Qualifying questions and confidence only | Presumptive-close mechanics read as manipulation outside the room |
| 5. Rehash | **Remember Everyone Has Another Sale Hidden** · **Introduce second item** · **Double your profit** · **Never stop at a "yes"** · **Close gap on a "no"** | Gratitude only | The entire upsell core is Tier 2 restricted |

### The judgement call you should overrule if you disagree

**Slide 5 is the problem.** In the source, Rehash *is* the second-item upsell — that's the whole step. The carousel presents it as revisiting the conversation and leading with gratitude, which is true of the Steps to Rehash document's step 2, but is not what the step is *for*.

That is arguably a soft misrepresentation of Surge's own training, in Surge's own published material. It isn't false, but a rep reading it would not recognise their job.

**Three options:**

1. **Ship five steps as drafted** — accept that step 5 is represented by its publishable component only.
2. **Drop to four steps** and retitle. Honest, loses the source's structure, and "4 of our 5 steps" invites the question of what the fifth is.
3. **Rewrite step 5 around what's genuinely defensible** — that reps are taught to thank donors and explain the impact — and stop calling it Rehash.

**My recommendation: option 3.** It's the only one that's both accurate and publishable. Option 1 is the current render and I'd not ship it.

---

## Fact-check log

| Claim | Status | Source |
|---|---|---|
| The five steps and their names | **Verified** | `5 Steps to Build Value.docx`, verbatim |
| SEE = Smile, Eye contact, Enthusiasm, with the stated reasons | **Verified verbatim** | Same |
| WWW = who/what/why, KISS = keep it short and simple | **Verified verbatim** | Same |
| "Put it in their hands. Shows Ownership" | **Verified**, lightly rephrased | Same |
| "Package and Present. Shows Value" | **Verified**, lightly rephrased | Same |
| Qualifying questions, close with confidence | **Verified**, mechanics omitted | Same |
| Gratitude and explaining impact | **Verified** | `Steps to Rehash.docx`, step 2 |
| "Surge builds, trains and manages field sales teams for companies that don't have one" | **Verified** | `brand-voice-company.md` §1 |

**Nothing invented.** Every line traces to a source document. Where wording was changed it was compression, not addition.

**Cleared, verified absent:** no proprietary claim, no metrics, no client reference, no named individuals, no compensation, no hours, no advancement framing, no scale claim, no restricted influence technique, no unsourced statistic. The 55/38/7 tonality figure from `Gifts.docx` does not appear anywhere and must not.

**Open — needs your input:**

1. **The step 5 question above.** The one real decision.
2. **Social handles.** I don't know Surge's actual LinkedIn handle, so `companyName` is "Surge Inc" rather than an `@`. I won't invent one.
3. **Brand hex codes.** Palette is still my placeholder set (`#0F5FBF`, `#D2372A`, `#E8C93F`) — see [brand/guidelines/README.md](../brand/guidelines/README.md). One real hex code retunes every asset.
4. **Logo.** This template exposes only `profileImage` on the CTA slide. Worth using the Surge mark there.

---

---

# v2 — regenerated 2026-08-06

**Files:** `5-steps-carousel-v2-01.jpg` … `-07.jpg`. **Creation ID:** `7b7d06a5-d753-4489-918c-369e24b1e132`

**Changes from v1:** real brand palette; Surge logo on every slide; step 5 rewritten per option 3; descriptions lengthened; `hasAccentLines` dropped.

**All 7 slides downloaded and read. No fabrication again — third and fourth confirmation of the rule.**

## What improved

**The logo works.** `profileImage` renders as a circular avatar — so the raw 733×222 wordmark would have been cropped to nothing. I built an 800×800 white tile with the wordmark centred (`scratchpad/surge-logo-square.png`, uploaded to Blotato storage), which gives a clean white circle on the black intro and CTA slides, and a small mark in the footer of every content slide. **Any future template with an avatar slot needs the square tile, not the raw PNG.**

**Black intro/CTA reads much better** than the placeholder blue, and matches the pure-black logo exactly.

**Step 5 is now honest.** "5. After the Yes" — gratitude and explaining what the support pays for. No longer labelled Rehash, so it isn't presenting the upsell step as something it isn't.

**Density improved** but slides still run ~40% empty. The template reserves fixed space regardless of text length.

## The finding that matters

> ### `accentColor` is inert. Surge's green cannot be rendered by this template.

`accentColor: "#4abe4a"` was set and **the green does not appear on a single slide.** Combined with `hasAccentLines` also doing nothing in v1, this template exposes colour inputs that are partly decorative — it will honour `introBackgroundColor`, `contentBackgroundColor` and `ctaBackgroundColor`, and silently ignore the rest.

**So this template can produce black-and-white Surge assets, but not green ones.** For a brand whose single colour is `#4abe4a`, that's a real constraint, and it applies to Blotato's structured templates generally until proven otherwise on each one.

## Defects that persist, confirmed as template-side

| Issue | v1 | v2 | Verdict |
|---|---|---|---|
| CTA buttons render tofu boxes (`□ Repost`) | Yes | **Yes** | Template injects an icon glyph its font lacks. Not caused by my input — reproduced across two different configs. **Unfixable from the API.** |
| Button text is purple | Yes | **Yes** | Hardcoded, no input controls it. Clashes with any brand palette. |
| `accentColor` ignored | Untested | **Yes** | See above |
| `hasAccentLines` ignored | Yes | n/a | Dropped |
| ~40% empty space on content slides | Yes | Reduced | Structural |

**Standing recommendation: do not ship the CTA slide from this template.** Use slides 1–6 and drop slide 7, or accept a visibly broken glyph and an off-brand purple as the reader's last impression.

---

## Verdict on the test

**The pipeline works and is trustworthy.** Explicit inputs into a structured template produce exactly the supplied text, every time, across two runs and fourteen slides. That is a reliable production path for factual content.

**This particular template is mediocre for Surge.** It can't render the brand colour, its CTA slide is broken, and it wastes 40% of every slide. Fine for a test; I wouldn't build a content programme on it.

**Worth testing next:** *Tutorial Carousel with Minimalist Flat Style* — it exposes `backgroundColor`, `borderColor` and `textColor`, which look more likely to be load-bearing than this one's `accentColor`. If those are honoured, green becomes usable.

## If regenerating

Keep: explicit-inputs approach, `4:5`, `font-dmsans`, black intro, the square logo tile.

Change: drop the CTA slide; test whether a different structured template honours `#4abe4a` before committing to a house look for carousels.

---

# v3 — illustrated Blotato test

**Template:** *Image Slideshow with Prominent Text* (`/base/v2/images-with-text/0ddb8655-c3da-43da-9f7d-be1915ca7818/v1`). **Files:** `5-steps-illustrated-01…05.jpg`. **ID:** `286acbbf-6c1e-4948-9b8a-d474130dda1b`

Run in response to "the pages are bleak, can they be spruced up with illustrations." This is the only Blotato template combining **literal typeset text** with an **AI illustration**.

**Text: character-exact on all five.** Nineteen slides across three templates now, zero text fabrication.

**Illustrations: 2 good, 3 unusable.**

| Slide | Result |
|---|---|
| 1 — two figures greeting | Malformed. One figure's arm is a black blob |
| 2 — speech bubble with three symbols | **Failed.** Rendered as a distorted green smiley face. Nothing to do with the brief |
| 3 — hands holding a folder | **Good.** Clean, on-brand, usable |
| 4 — figures with a question mark | **Failed.** Unreadable mash of shapes; reads as a green monster face |
| 5 — hand passing a heart | **Good.** Clean line art, genuinely nice |

~40% hit rate, meaning rerolls.

**The typography is the disqualifier, and it isn't configurable.** All-caps condensed bold white over a dark gradient covering half the frame — a short-form-video aesthetic, wrong for LinkedIn, and it buries the lower half of every illustration. The template exposes **no** text controls: only `slideDuration` and `aspectRatio`.

**One win:** green rendered, via the image prompt rather than a colour input. So Blotato reaches green through image generation but not through structured carousels — and at a more saturated shade than `#4abe4a`, not precisely controllable.

---

# v4 — hand-authored HTML. **This is the recommended asset.**

**Files:** [5-steps-build-value-infographic.html](5-steps-build-value-infographic.html) (source) and `5-steps-build-value-infographic.png` (1108×1350 export).

Built to the established whiteboard house style, retuned to the real palette. Rendered with headless Edge and inspected at each iteration.

**It answers all three complaints at once:**

| Complaint | Blotato | Hand-authored |
|---|---|---|
| Bleak / sparse | ~40% empty, not configurable | Dense by construction — five filled panels, highlighter marks, taped note, marker tray |
| No illustrations | AI, ~40% usable, rerolls | Five inline SVGs, author-controlled, identical every render |
| Brand colour | `accentColor` inert; green impossible | `#4abe4a` exactly, `#2E8B2E` for body-weight green type |

Plus: real logo placement, a marker-tray legend that does actual work (what's taught / what the rep does / why), and the honest §1 line on the taped slip — *"None of this is a system nobody else has… What a company can be judged on is how well it teaches them."*

## Bugs found by rendering it — worth recording

1. **Entrance animation rendered the board blank.** `animation:… both` with `from{opacity:0}` means a headless capture gets opacity 0 for everything. Removed entirely; export boards should not animate.
2. **Header overlapped the rule**, and the first pass had a 160px dead band above the taped note. Took three render-inspect-adjust cycles to land.
3. **Non-ASCII mangled by the logo substitution.** The PowerShell round-trip turned `—` into `â€”` and `·` into `Â·`. Fixed by using `&mdash;` / `&middot;` so the file stays ASCII-only.

**None of these would have been caught without rendering and looking.** Same discipline the Blotato renders get.

## Verdict

**Blotato structured carousels:** fine when you want fast and plain, and trustworthy on text. Not capable of on-brand or designed output.

**Hand-authored HTML:** slower, but it's the only route to Surge's actual brand, and the illustrations are deterministic. Use it for anything that represents the company visually.

**Still open:** the step 5 decision (currently "After the Yes", per option 3), and whether to salvage the two good AI illustrations as assets inside future hand-authored boards.
