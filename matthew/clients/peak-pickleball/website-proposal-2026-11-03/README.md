# Peak Pickleball: website price and timeline (3 Nov 2026)

For Brandon, to take to Peak. Matthew's own client work (not Surge, not the sponsor desk). **Draft: not sent.** Matthew sends it.

- `peak-website-proposal.html`: the source. Print with Chrome: `chrome.exe --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf=<out.pdf> file:///<this folder>/peak-website-proposal.html`
- `Peak-Pickleball-Website-Price-and-Timeline.pdf`: the two pages Brandon gets.

## Where the numbers come from

| Line | Source |
|---|---|
| $4,500 design and build, about 13 pages | `matthew/services-pricing.md` §3: Standard site, 8 to 15 pages |
| $500 edit screen and the one set of prices, hours and rules | Matthew's call (3 Nov chat), so the total meets the $5,000 Brandon gave Peak (meeting notes, 2 Nov). The rate card's data-driven tier is $8,000 for 16-30 pages |
| Half at signature, half at launch; live once the second half clears | services-pricing.md §3 and §5 |
| $1,400 a month, 12 months, build waived | services-pricing.md §2 (Engine, committed monthly) and §3 (waived on a 12-month Engine) |
| Engine contents | services-pricing.md §2, Engine list, in plain words |
| $85 an hour for changes | services-pricing.md §4 |
| Ads 12% of spend, $350 minimum; Peak pays the platforms and keeps the accounts | services-pricing.md §4 and §5 |
| Client owns the site once paid | services-pricing.md §5 |

**Not from the rate card. Matthew should confirm or cut these:**
- "If something we built doesn't work as agreed, we fix it at no charge."
- "Prices hold for 30 days from 3 November 2026."
- "Twelve months, then month to month with thirty days' notice." The 30 days' notice is on the rate card; "then month to month" is not.

## Fact-check log

| Claim in the PDF | Checked against | Status |
|---|---|---|
| 34 pages on the site today | audit-2026-10-22 (website/raw), 21-22 Oct; site rechecked live 2 Nov | Verified |
| No way to book from the site (0 "Book a court" buttons) | audit 22 Oct; rechecked 2 Nov | Verified |
| Main image 6 to 14 seconds on a phone; target under 2.5 s | Lighthouse lab runs, 22 Oct (home 5.9-14.3 s; other pages 3.3-12.4 s); 2.5 s is Google's "good" LCP line | Verified; lab figures vary run to run, which the footer says |
| 14 MB autoplay video | audit 22 Oct | Verified |
| Prices and rules disagree (family rate, cancellation, membership notice, walk-ins, closing time) | audit 22 Oct: $6 vs $7; 24 h vs 4 h; "cancel anytime" vs 15 days; walk in vs reservation; 9 pm vs 10 pm | Verified |
| Corporate form can't be sent; scholarship has no form | audit 22 Oct | Verified |
| Google Analytics and Meta Pixel with no privacy policy | audit 22 Oct; rechecked 2 Nov | Verified |
| 4.9 stars from 585 Google reviews | Peak's Google profile, 22 Oct | Verified on 22 Oct; may have moved since |
| Site built by Lighthouse on WordPress | audit 22 Oct (site footer and page source) | Verified |
| "Most people who take a class become members" | Peak's own figure (80%), 2 Nov meeting | Not checked. Worded as "most", with no number in the PDF |
| CourtReserve first-time approval is a setting | not checked | Worded as a question for Peak |

Left out on purpose: the 16,000 subscribers / 69% open rate (Matthew wasn't sure of either; Apple Mail Privacy Protection inflates open rates), and which service Peak pays $500 a month for (conflicting in the 2 Nov notes).

## One-page quote (Peak-Pickleball-Website-Quote.pdf, from peak-website-1page.html)

3 Nov, 1:28 pm, Matthew via J.A.R.V.I.S. (h202611031308229592): no 12-month version; make it a six-week build and divide the $3,000 across the six weeks. The page now shows $3,000 up front (half to start, half at launch) or $500 a week for 6 weeks, and a six-week timeline (weeks 1-6) starting when Peak sends logins, answers and photos. The earlier $250 a month for 12 months copy is kept as the `.pre-help-h202611031308229592` files. Draft, not sent.
