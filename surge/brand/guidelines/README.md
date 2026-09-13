# Guidelines

Rules about how Surge looks. **Anything in here overrides my design choices.**

## Brand colours — supplied 2026-08-06

| Role | Hex | Notes |
|---|---|---|
| **Primary green** | `#4abe4a` | The brand colour. Medium green — white text on it is low contrast, so pair it with black text or use it as an accent against black/white |
| **Grey** | `#ababab` | Neutral |
| **White** | `#ffffff` | |
| **Black** | `#000000` | Matches the logo glyphs exactly |

> **One code needs confirming.** A third value was given as `#a8abal`, which isn't valid hex — `l` isn't a hex digit. Most likely `#a8abab` or `#a8aba1`. **Not in use until confirmed.** `#ababab` is being used in the meantime.

### Deep green — `#2e8b2e`

Not a supplied brand colour, but the second green on the reference board
(`drafts/5-steps-build-value-infographic.html`, `--green-deep`). Use it where
`#4abe4a` fails contrast: green **text or fine rules on a light surface**
(`#4abe4a` is ~2.3:1 on white, under the 3:1 floor). Since the site re-theme
(below) this is the website's everyday accent green — `#4abe4a` is now reserved
for green *fills* (buttons, the CTA band, the footer rule) and for anything
inside a dark accent band, where it clears contrast easily.

### Website UI ramp — DARK (live again 2026-09-08, + additive colour)

**Three themes were tried 2026-09-08; the site is back on the dark build.**
Matthew, after seeing all three applied: keep the dark palette (Surge's
identity) and lift the "consistent darkness" with *additive* colour —
lightly-coloured icons, a funnel infographic, faint green-tinted bands, green
list markers — rather than another re-theme.

| Theme | What | Saved at |
|---|---|---|
| **Dark** (live) | `#0a0a0a` ground, dark bands, Anton uppercase, green accents | `drafts/_surge-site-dark-backup/` (mirror) |
| C | All-light: `#faf8f3` ground, white panels, dark accent bands. "Too white." | `drafts/_surge-site-scheme-c/` |
| B | Dark hero + dark header framing a warm-greige light body; Anton-caps `h2`. | `drafts/_surge-site-scheme-b/` |

Why it stayed dark in the end: light-corporate (Scheme C) read as generic and
lost the brand's voice; the blend (Scheme B) was close but still a re-theme.
Additive colour is the lowest-risk path — it enriches the committed look
instead of replacing it. Token block: `drafts/surge-site/assets/site.css`.
Full logs: `index-draft-notes.md` — "Homepage lighten-within-dark starter set"
(live), and "Scheme B rework" / "Path C rebrand" (the explorations).

**Dark ramp — the sanctioned near-neutral steps between `#000` and `#fff`:**

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#0a0a0a` | page ground — not pure `#000` on purpose |
| `--lift` | `#232323` | raised band / section alternation |
| `--line` | `#333333` | hairlines, borders, grid gaps |
| `--field` | `#1a1a1a` | form control fill (border `#3d3d3d`) |
| `--text` | `#f4f4f4` | body + headings — not `#fff` (glare) |
| `--soft` | `#ababab` | secondary text — the brand grey exactly |
| `--faint` | `#8a8a8a` | meta, captions, legal line |
| `--black` | `#000000` | footer, `.band--black`, text on green fills |
| `--green` / `--brand-green` | `#4abe4a` | accent + fills (clears 8:1 on the ground) |

`h1`/`h2` are Anton uppercase; eyebrows uppercase; trailing full stop on headings.

**Additive-colour components (2026-09-08, homepage first, rolled out to all inner pages same day):**
- `.band--green` — a green-tinted band, `color-mix(#1e1e1e 74%, --brand-green)` ≈ `#294829`.
  On-palette (brand green over a base a step below `--lift`), one section per page. Same
  luminance as a dark band — clear green cast, well short of the solid CTA. (Was
  `color-mix(--lift 88%, --brand-green)` ≈ `#283628`; deepened — read as faded.)
- `.funnel-viz` — single-hue green funnel for the KPI figures (bars narrow to the
  true proportions; numbers wear `--text`, not green; conversion rates as
  labelled connectors).
- `.mini-icons` — a row of green 1.6px line icons + mono labels, as a visual
  index. **Homepage only** — every other page that had a 4/5-item group now uses a
  distinct form so the same grid does not repeat down the site:
  - `.card-grid--jobs` — 2×2 numbered cards with a large faint Anton number watermark
    (`color-mix(--brand-green 26%, transparent)`).
  - `.chan-strip` / `.cs-item` — an unboxed row on one hairline with a green node dot per item
    (dots hidden <720px); an index, not cards.
  - `.flow` / `.flow__step` — a 2–3 step hand-off diagram, mono actor label + Anton headline,
    green chevrons between steps.
  - `.role-chips` — wrapping outlined pills (thin green border, faint green fill, icon + mono
    label) for a loose list of options.
  - `.taxo` — a single mono line (`·`-separated, faint) when a section needs a label strip, not
    a component.
- `.record dt::before` / `.contact-rail dt::before` — a small green diamond marker per term.
- `.card__ico` / `.audience .a-ico` — a 1.6px green line icon on a numbered card or an audience
  option (icon above / beside the heading).
- `.job-list--stepped` — a green rail down the number gutter so a numbered list reads as a
  stepper (≥620px; last row's rail hidden).
- Motion (all gated behind `.anim` + `prefers-reduced-motion`): `.funnel-viz` bars grow;
  `.chan-strip` node dots pop in along the line; `.flow` chevrons fade in after the steps rise;
  `data-stagger` groups rise in sequence.

Green washes (`rgba(74,190,74,.05–.22)`) for tints/glows stay on-palette (brand
green + alpha). **No amber, no red** — form error is a heavy white bar + wording.

**No amber, no red.** Form success is green; form error is a heavier ink
emphasis bar and the message wording. If a warning or error hue is genuinely
wanted, add it here first rather than picking one in CSS.

Green washes (`rgba(74,190,74,.07–.22)`) for faint tints and focus glows are
fine — they're the brand green with alpha, not new colours.

### Consequence: every asset built before this date is off-palette

The old placeholder set was `#0F5FBF` blue, `#D2372A` red, `#E8C93F` highlighter — all invented by me, all wrong. **Affected, all now in `drafts/`:** `law-of-averages-internal-infographic.html`, `law-of-averages-public-infographic.html`, `law-of-averages-square.html`, `training-content-infographic.html`, and the `law-of-averages-carousel/` slides.

None have been retuned yet. Worth doing in one pass rather than piecemeal. **`drafts/5-steps-build-value-infographic.html` is the reference board on the correct palette** — copy its token block.

## Still missing

| Thing | Status | What I'm using |
|---|---|---|
| Brand typeface | **None supplied** | A handwriting system stack for whiteboard assets; `font-dmsans` for Blotato carousels |
| Logo clear space / min size | **None supplied** | My own judgement — small, one placement per asset |
| Tone rules | Covered elsewhere | `brand-voice-company.md`, `brand-voice-personal.md` |

## What to drop in

- A brand guide PDF, if one exists
- Hex codes, even scribbled — `#RRGGBB` for primary, secondary, accent
- Font names, and whether you have licences (matters: I can only embed a face into a published page if it's licensed for it)
- Logo rules — minimum size, clear space, what not to do to it
- Anything from a client that constrains how their work is presented

Partial is fine. One hex code beats none.
