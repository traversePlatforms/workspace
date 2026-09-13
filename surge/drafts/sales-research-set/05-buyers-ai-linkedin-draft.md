# Buyers want no rep, and they want a rep — LinkedIn draft

**Register:** Company. **Status:** draft only. Not published, not scheduled, not staged.
**Piece 5 of 5** in the sales research set — see [README.md](README.md).
**Asset:** Blotato tutorial carousel, minimalist flat. Template `/base/v2/tutorial-carousel/2491f97b`.
7 cards, 4:5. **Ship cards 1–7, drop card 8.**

**The only piece in the set aimed at a prospective client rather than a prospective rep.**

---

## The post

> Two Gartner findings that get reported as a contradiction.
>
> One: 67% of B2B buyers say they prefer a rep-free buying experience, and 70% would rather the whole purchase were digital and self-service.
>
> Two: 69% prefer to validate AI-generated insights with a sales rep. 45% had used generative AI during the purchase, mostly to research vendors and products, and buyers drew on an average of seven separate information sources.
>
> That is a survey of 645 B2B buyers, run across August and September 2025.
>
> The number that should stop you is further down. 51% said they were more likely to run into misleading information from generative AI. 49% said the same about sales reps.
>
> Gartner's Robert Blaisdell frames it as sellers needing to show up differently rather than mattering less.
>
> Our read: those two findings are not in tension. Information stopped being the thing a rep delivers — buyers have plenty of it and trust it about as much as they trust us. Verification is what is left, and half the market already doubts the verifier.
>
> What would make your team the source someone checks their research against?

**Word count:** 196.

**Hashtags:** #B2BSales #SalesStrategy #BuyerBehaviour #AI

**First comment:** link to the Gartner press release.

---

## Asset note

Rendered on the flat tutorial carousel — the template used for piece 2 of the storm-restoration
set, chosen again here because it is structured and this piece is dense with attributed
statistics. **Eight cards came back; the seven content cards are exact.**

Per the known defect on this template, a light `backgroundColor` with dark `textColor` was
passed rather than a dark background, and the intro card rendered correctly rather than
white-on-white.

**Card 8 is the CTA card and must be dropped.** Same defect as piece 1 and worse: it rendered
tofu glyph boxes on the heading and on the "Bookmark for later" button, and printed **"Alex
Hormozi"** with the template author's bio in the profile band. This is now the third
independent confirmation that the CTA card on both tutorial-carousel templates is unusable
from the API.

**Two silently ignored inputs on this run:**

- `ctaButtonText` was set to "Swipe" and the card rendered **"Get Insights →"**.
- The template auto-numbers content items ("1.", "2.", …), which was not requested. Harmless here — the items are a numbered sequence anyway — but it would be wrong on unordered content.

## Alternate hooks

1. *"Two Gartner findings that get reported as a contradiction."* — used. Sets up the resolution the post exists to deliver.
2. *"67% of B2B buyers would rather not talk to you. 69% want you to check the AI's work."* — much stronger as a hook and slightly overstates: "rep-free experience" is a preference about process, not a statement about any individual seller.
3. *"Half of B2B buyers think a sales rep is a likely source of misleading information."* — the most arresting line available and the least flattering. Worth considering; it is also the honest centre of the research.
4. *"Your buyers are using AI to research you, and then asking a human whether it lied."* — vivid, and it dramatises beyond what the survey says.

## Lines cut, with reasons

- *"Which is why outsourcing your sales team to specialists makes more sense than ever."* — a pitch bolted onto research, and a causal claim the survey does not support.
- *"AI is not coming for sales jobs."* — a prediction. The research measures preferences in one survey window, not the future of the occupation.
- *"49% is the number our industry earned."* — a verdict on the industry, and it edges toward the self-criticism register that §5 keeps out of the feed.
- *"Trust is the new differentiator."* — content-farm phrasing, and it says nothing checkable.

## Fact-check log

| Claim | Status | Source |
|---|---|---|
| Survey of 645 B2B buyers, conducted August–September 2025 | **Verified** | Gartner press release, 20 May 2026, *Gartner Survey Finds 69% of B2B Buyers Turn to Sales Reps to Validate AI-Generated Insights* |
| 69% prefer to validate AI-generated insights with sales reps | **Verified** | Same release, headline finding |
| 45% used GenAI, primarily to gather information on vendors and products | **Verified** | Same release |
| Buyers used an average of seven information sources | **Verified** | Same release |
| 51% more likely to encounter misleading information from GenAI; 49% from sales reps | **Verified** | Same release |
| Robert Blaisdell, VP Analyst, Chief of Research, Gartner Sales practice — the "show up differently" framing | **Verified, close paraphrase of a direct quote** | Same release. His words: "It is a signal that sellers need to show up differently" |
| 67% prefer a rep-free experience; 70% prefer completely digital self-service | **Verified** | Separate Gartner survey published March 2026, referenced within the same release |

**Sourcing note.** `gartner.com` and `businesswire.com` both returned HTTP 403 to automated
fetches, including with a browser user-agent. The release text was read in full via a syndication
mirror that carries the BusinessWire wire copy verbatim. Every figure above is from that text,
including the analyst's name, title and quotation. **Before this posts, open the Gartner page in
a browser and confirm the seven figures** — the wire copy is a faithful mirror, but this is the
one piece in the set where a primary page could not be opened directly.

**Deliberately not used:** the widely circulated Gartner figure that B2B buyers spend only 17%
of the purchase journey with suppliers, and 5–6% with any one supplier. It is real and it is
old — it traces to research from around 2019 and is still being reported as current. Using a
2019 number in a post about AI-era buying would have been the exact error this project's
research standard was written after.

## Constraint flags

- **§1 uniqueness:** none claimed.
- **§2 metrics:** no Surge figure. The closing question is aimed outward, at the reader's team.
- **§3 competitors:** none named. Gartner is a research firm, not an outsourced sales company.
- **§4 confidence:** the closing question is a genuine open question, not a "can we help you?" that invites a no — that distinction is drawn in §4 and this clears it.
- **§5:** no earnings, hours, advancement or culture content. No scale or footprint framing.
- **Client:** not mentioned.
