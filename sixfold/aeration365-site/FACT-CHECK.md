# aeration365.com landing page: notes and fact-check log

**Built:** 2026-10-14, at Matthew's request ("a pretty simple landing page branded with 365 as well as a form built in where people can request a quote or that is seeking information").
**Brand:** 365 Aeration & Seeding. **No Sixfold anywhere on the page** (Matthew: remove Sixfold from the customer side entirely). The test checks this.
**Status:** built and tested locally. **Not uploaded.** It goes up once Matthew has attached Aeration365.com in SiteGround.

## What the form does

It posts from the visitor's browser to the Sixfold app (`traverseplatforms.com/api/rounds.php?action=a365lead`). Only aeration365.com and www.aeration365.com are allowed to post there.

When a request comes in:
- It becomes a **New** lead in the Pipeline, source **"365 website"**.
- The house is found from the street address when it is one we have measured.
- Everyone with the Office role (Jen) gets a phone alert.
- Nothing about the house is sent back to the visitor.

Spam protection:
- a hidden field (a bot that fills it is thanked, and nothing is kept);
- at least 3 seconds on the page;
- 5 requests a day per address, and 300 a day for the whole site.

Test: scratchpad `ptest/a365site-test.mjs`, 20/20 checks.

## Fact-check log

| Line on the page | Source | Result |
|---|---|---|
| Plugs about two to three inches deep | CSU Extension PlantTalk 1505, *Lawn Aeration* (holes 2–3 in deep, 2–4 in apart) | Verified 2026-09-25 (aeration ad kit); same source reused |
| On compacted ground, aeration lets water and fertilizer reach the roots instead of running off | CSU PlantTalk 1505 (compaction sheds water; aeration helps water and fertilizer reach the root zone) | Verified 2026-09-25 |
| Seed straight after aerating, the order CSU Extension describes for thickening a thin lawn | CSU Extension fact sheet 7.241, *Renovating the Home Lawn* (overseeding after core aeration) | Verified 2026-09-25 |
| Water if you can: a little water a day or two before helps the machine go deeper | CSU PlantTalk 1505 (water a couple of days prior for deep plugs) | Verified 2026-09-25. **Softened 2026-10-14** (Matthew, after Bryce: asking customers to prepare gives them reasons to cancel). "We can run your sprinklers when we arrive" is our own offer, not a source fact; the crew must actually do it |
| The plugs stay on the lawn and break down back into the grass | UMass Amherst Extension, *Management of Compaction and Coring* (cores left on the surface and broken down as topdressing) | Verified 2026-09-25. "A week or two" of looking untidy is our own wording, not a source figure |
| Spring and fall work best; any time the ground isn't frozen, but not when hot and dry | CSU PlantTalk 1505 | Verified 2026-09-25 |
| "Denver metro" | Matthew's service area: 45 miles of 333 W Hampden Ave, Englewood. The Facebook kit says "Denver metro" too | Business fact |
| Phone (720) 830-4553 | Matthew, 2026-10-14: "the point of contact for the site and other documents" (replaced (303) 915-1045 from the Facebook kit) | Matthew's number for the brand |
| contact@aeration365.com | Matthew listed support, billing and contact aliases (2026-10-14) | **Matthew to confirm the exact alias** |
| "We use what you send only to answer your request. We don't sell or share it." | How the app treats leads: they are held in the Sixfold app; nothing is sold or shared | **A promise. Keep it true**, or change it if leads are ever shared |

**Not used:** prices, months for the fall window (no CSU source names months), "fast scheduling" or "fair pricing" (from the Facebook bio; neither is checkable), and any claim that aeration or overseeding is "the most effective" anything.

Sources:
- <https://planttalk.colostate.edu/topics/lawns/1505-lawn-aeration/>
- <https://extension.colostate.edu/topic-areas/yard-garden/renovating-the-home-lawn-7-241/>
- UMass Amherst Extension, *Management of Compaction and Coring*
