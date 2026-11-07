# Free town map sequence: DRAFT (6 Nov 2026)

Matthew 6 Nov, after ~1,823 "with map" emails brought ~80-90 site visits, 1 reply and no demos: "we need to find a way to make this work."

**The change:** stop asking strangers for a demo and a price in the first email. Give something useful first (a free one-page map of their best streets, from `prospect-desk/town-report/`), and ask one small question they can answer with a word. The pitch comes after they say yes.

**Status:** draft only. Nothing loaded into the Prospect Desk, nothing queued, nothing sent. Matthew reviews the wording, then it goes into the desk as held templates, as before.

**Rules kept from the desk:** plain text, no images, no links in the first email (the desk adds the signature, postal address and unsubscribe line). Prospect emails may name data sources (the website may not). Proof wording stays "a client has had success" if proof is mentioned at all.

**Matthew's calls, 6 Nov:** no free months; **the 7-day free trial comes back** (card at signup, 7 days counted from go-live, replaces the money-back guarantee; being built); **no separate domain**: send from traverseplatforms.com, so keep the volume low and verify every address first; **start with the 152 new prospects** (most still need an email found first).

**Merge fields:** `{first}`, `{company}`, `{city}` exist in the desk today. `{homes}`, `{n}`, `{street}` and `{window}` are new: they come from the town report's numbers for that city (the generator writes them per town). A city with no report gets the no-number version.

---

## Email 1: lawn & landscape (about 55 words)

**Subject:** {city} lawn map

> Hi {first},
>
> I mapped {homes} homes in {city} and found {n} with lawns over 5,000 sq ft. The biggest cluster is on {street}.
>
> I put the best streets for lawn care on a one-page map. Want me to send you the {city} one? It's free.

No sign-off in the body: the desk adds the full signature, the postal address and the unsubscribe line.

**A town without a report gets no email:** we only offer a map we can send.

## Email 1: roofing (about 55 words)

**Subject:** hail map for {city}

> Hi {first},
>
> Radar put hail an inch or larger over {n} homes in {city} in the last {window}. {street} had the most.
>
> I put the hardest-hit streets on a one-page map. Want me to send you the {city} one? It's free.

`{window}` matches what the hail data covers (the generator states it: two years, October 2024 to October 2026).

## Follow-up 1: 3-4 days later, same thread

> Hi {first}, bumping this in case it got buried. Happy to send the {city} map over, it only takes me a minute. Want it?

## Follow-up 2: a week after that, same thread, last one

> Hi {first}, last note from me. If a map of your best streets would help for next season, just reply "map" and I'll send it. If not, no worries, I won't email again.

## When they say yes (Matthew sends, with the PDF attached)

> Here's the {city} map, {first}.
>
> It comes out of Traverse, the app I built for small crews: the houses in your area with their {lawn size / roof and hail history}, the streets worth knocking first, and quotes sent from your phone.
>
> If you'd like to see your own area in it, I can walk you through it in 15 minutes: traverseplatforms.com/demo
>
> You can try it free for 7 days once your app is set up, and cancel before then without paying anything. *(this line only once the trial is live on the site)*

**Trial line (Matthew 6 Nov: the 7-day free trial is back; use once it's live on the site):** "You can try it free for 7 days once your app is set up, and cancel before then without paying anything."

~~Founding pilot free until March 1~~: declined by Matthew 6 Nov ("too much free").

---

## Who gets it, suggested order (Matthew decides)

1. **New prospects not yet emailed** (the 152 added on 4 Nov, plus the website-finder additions): Email 1, then the two follow-ups.
2. **The ~1,800 already emailed:** one Email 1 only, no follow-ups, at least two weeks after their first email. A different, smaller ask isn't a repeat of the first.
3. ~~Send from a separate domain~~: declined by Matthew 6 Nov. Sends stay on traverseplatforms.com, so: verify every address before it goes in (target under 2% bounces), and keep to the desk's slow pace.

## Fact-check log

| Claim | Source | Status |
|---|---|---|
| "{n} lawns over 5,000 sq ft" / "biggest cluster on {street}" | Town report generator, counted from the Sixfold/Yards door files per town (lawn.sq >= 5000), per city | Filled per city from data; a city without data gets the no-number version |
| "Hail an inch or larger hit {n} homes in the last {window}" | Town report generator from the Roofing edition's hail files | Window and threshold to match what the generator reports; don't send until checked against a sample |
| "every house in your area with its lawn size / roof and hail history, streets worth knocking first, quotes from your phone" | Same claims as the approved 30 Oct templates (house card lawn chip, "streets with the most large lawns still to knock", TR-33 quote kit) | OK |
| "free" | The map costs them nothing and needs no signup | OK |
| Founding pilot line | Not an offer yet | Held: Matthew's decision |
