# Horizon Outreach Partners and Events: online presence audit (28 Oct 2026)

Matthew's own client work (Donny's company), not Surge and not Sixfold. Asked for on 28 Oct: "a deep dive of this site, company, socials, platforms etc." in the style of the Peak audit, plus how the site and socials work on phone and tablet. Prompted by Donny's assistant asking for a second "HOPE" website so they could open a second Indeed account.

**Nothing has been sent to Donny or his assistant.** Matthew reviews first.

## The deliverable
- `Horizon-Outreach-Online-Audit.pdf`: 4 pages (overview and website; the job seeker's path on phone and tablet; social and listings; the HOPE/Indeed question and the plan).
- Built by `node build-audit.mjs` (writes horizon-audit.html), then printed by `node print-audit.mjs`. The print script refuses to print if a page overflows, and checks that the PDF has 4 pages. preview-p1..4.png are the page images.

## Evidence and fact-check logs
| Part | Findings (with fact-check log) | Evidence |
|---|---|---|
| Website | website/findings.md | website/raw (page text, link check, SEO, contrast, tap targets, DNS, cookies), website/screens (1440 / 390 / 820 / 1180 px), website/speed |
| Social | social/findings.md, social/inventory.csv | social/captures, social/screenshots |
| Social on phone and tablet | social/devices/findings-devices.md | social/devices (iPhone and iPad views, logged out) |
| Company, listings, recruiting, HOPE name | company/findings.md | company/*.txt, rdap and USPTO results |
| Indeed's rules | indeed-policy.md | Indeed's own pages, quoted with dates |

Screenshots and raw captures are not in git (as with the Peak audit); the Google Drive backup holds them.

## Kept out of the PDF on purpose
- **The VAA / Project Liberty job post:** a search summary described a Horizon "Brand Ambassador" post naming the Veterans Association of America and Project Liberty as clients. It couldn't be opened, so it stays unverified (company/findings.md).
- **State filing details:** the NC Secretary of State record was blocked. The LLC name came from an aggregator, so formation date, officers and agent are unconfirmed.
- **Indeed and Glassdoor pages for Horizon itself:** both refused automated reads, so they need a check in a browser.

## Limits worth knowing
- Speed figures are our own throttled Chrome test, not Lighthouse scores.
- Social counts are as shown logged out. Older Instagram posts and first-post dates are hidden, so they weren't estimated.
- The session's safety check stopped headless screenshots of bot-checked sites (NC SOS, OpenCorporates). That was not worked around.
- The site's only WordPress account is "donnyparada1088" (public user list and author page). That is the first source tying Donny Parada to this company.
