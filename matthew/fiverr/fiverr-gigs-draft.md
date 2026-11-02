# Fiverr gigs — draft (1 Nov 2026)

Matthew's own side work, signed **Matthew Sharpe**. Not Surge, not Sixfold, not Traverse. **Draft only: nothing is posted.** Matthew creates the Fiverr account and posts the gigs himself.

- **The words:** [gigs.mjs](gigs.mjs) (profile, 7 gigs, packages, extras, tags, buyer questions, FAQ, gallery plan). Edit there.
- **The preview:** [preview.html](preview.html) shows how a buyer reads it, with a length check on every title and description.
- **The gig images:** [covers/](covers/), 1280×769 PNGs, one per gig.
- **Rebuild:** `node matthew/fiverr/build.mjs` (headless Chrome renders the covers).

## The seven gigs

| Gig | Basic | Standard | Premium |
|---|---|---|---|
| SPF, DKIM and DMARC | $40 | $75 | $125 |
| Email templates | $50 | $120 | $200 |
| Small business website | $150 | $350 | $600 |
| Print design | $35 | $60 | $100 |
| AI assistant | $100 | $300 | $500 |
| B2B lead list | $30 | $75 | $150 |
| Documents to PDF | $30 | $75 | $150 |

These are starting prices. Raise them 30–50% once a gig has about 10 good reviews. Gigs passed on: custom apps and calculators, and hail maps.

## How the work gets done (internal, not in the listings)

- **SPF, DKIM and DMARC.** Never take a password. Either the client pastes our records in, or adds us as a delegate on the domain only. Every order ends with a test send and a pass report.
- **Email templates.** They send the emails themselves; we never hold their list. The Premium tier loads the templates into their Mailchimp (or similar) as an added user.
- **AI assistant.** Runs on the **client's** account: a Claude Project or custom GPT, or a website chat on their own API key. **Never on Matthew's Claude plan.** His subscription is for his own use, and J.A.R.V.I.S. stays his.
  - Open question: where the website-chat backend runs for Wix or Squarespace sites, which can't run server code. A Cloudflare Worker on the client's own account is likely, but test it before the first order.
- **Lead lists.**
  - Sources: state business records and company websites, same as the cloud look-ups.
  - **Never resell Hunter or Apollo data.** Their terms generally forbid resale.
  - Company data only: no people-search and no personal numbers.
  - Colorado is proven. Other states need a check per order, since each state's register works differently.
- **Documents.** Contracts are formatted and tidied, never advised on; the listing says so.

## Before posting: Matthew's calls

1. **Profile photo.** The preview uses "MS" initials. Fiverr buyers trust a real photo of you; your call.
2. **Gallery samples.** Each gig shows where its 2nd and 3rd images come from (green = ready, amber = to make, red = needs an OK):
   - Traverse work (the site, the manual) is yours and free to show.
   - **Sixfold pieces need Brandon's OK.**
   - **Nothing Surge, ever** (no client names or logos).
   - Made-up-business samples must be marked "sample".
3. **The profile mentions Traverse.** Taking it out is fine if you'd rather keep Fiverr separate.
4. **Categories.** Fiverr's category names change, so each gig gives a suggestion. Pick the closest one when you list it.
5. **Surge overlap.** None of these gigs sell sales teams, training or recruiting, which are Surge's line of business. Keep it that way.

## Fact-check log

**Verified (1 Nov 2026, Fiverr's own pages):**
- **Title:** up to 80 characters. Fiverr suggests under 50 so it isn't cut off on the gig card ([Fiverr Pro gig help](https://help.fiverr.com/hc/en-us/articles/29454478348433-Creating-and-optimizing-your-Fiverr-Pro-Gig)). The preview flags titles over 50. Four go over (52–55); they still fit the 80 limit.
- **Description:** up to 1,200 characters ([Creating a Gig](https://help.fiverr.com/hc/en-us/articles/360010451397-Creating-a-Gig)). All seven are between 620 and 859.
- **Gallery images:** 1280×769 recommended, minimum 712×430, up to 3 images per gig ([Gig images](https://help.fiverr.com/hc/en-us/articles/15863342952977-Creating-Gig-images-and-tagging-your-Gig-gallery)). The covers are 1280×769.
- **AI use:** allowed in every category. Misrepresenting it breaches Fiverr's standards, and a buyer's "no AI" request must be honoured ([Using AI on Fiverr](https://help.fiverr.com/hc/en-us/articles/34998793899665-Using-AI-on-Fiverr-Guidelines-for-freelancers-and-clients), [Community Standards](https://help.fiverr.com/hc/en-us/articles/32242973123985-Our-Community-Standards)). That's why the profile and every FAQ say AI tools are used.
- **Seller fee:** Fiverr keeps 20% of each order, so a $100 order nets $80 ([Fiverr vs Freelancer guide](https://www.fiverr.com/resources/guides/business/fiverr-vs-freelancer)). The preview shows the take-home figure on each package.
- **CAN-SPAM** (lead list FAQ): commercial email needs a valid postal address and a working opt-out ([FTC compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)).

**Corrected while drafting:**
- "Every template is test-sent to real inboxes" became "checked on phone and desktop". We have no client-side sending setup to test from.
- A specific monthly AI usage cost was replaced with "I'll estimate yours before we start". No sourced figure.
- Domain and hosting prices were removed from the website gig. No sourced figure.

**Unresolved:**
- Tag count: the Pro page recommends 3–4, and the standard gig form has allowed 5. Each gig has 5; trim if the form refuses.
- The profile "About" limit is not confirmed. It is 439 characters, which should fit.
- Whether a Claude Project or custom GPT needs a paid plan on the client's side. The FAQ says "I will check before you order".
- The buyer-side service fee: Fiverr's pages disagree. It doesn't affect the listings.
