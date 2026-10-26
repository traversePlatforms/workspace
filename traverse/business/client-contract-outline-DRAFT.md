# Traverse client agreement — outline for counsel (DRAFT)

**Prepared 2026-10-11 for Matthew Sharpe's attorney (TR-18).** This is a list of what the agreement needs to cover and the business decisions behind each part. It is a starting point for counsel to draft from. It is not a contract and not legal advice; nothing here has been reviewed by a lawyer.

**Parties:** Traverse Platforms LLC (being formed in Colorado; not yet filed as of this date) and the client company.
**What is sold:** a subscription to a field-sales app ("the Service"). It comes in trade editions (roofing, lawn and yard, solar, pest, security). Each client gets its own install: a separate web address, separate data, its own sign-ins.

---

## 1. What the client gets

- **A right to use the Service**, for its own staff, during the subscription. Plans are per company with a number of people included (Solo 1, Crew up to 5, Team up to 12); each person beyond that is an extra seat.
- **Door data:** property records, scores and layers shown per door, inside the app. The client may *use* it to plan and knock. It does not *own* it.
- **Support access:** Traverse keeps one administrator sign-in in every install (the "super admin") for support. The client cannot change or remove it. This should be disclosed plainly.

## 2. What the client may not do

These rules cover the door data, Traverse's product:
- No bulk copying, scraping or automated downloading of door data. The app lets only Traverse download the door list (500 doors at a time) and logs every download and unusually heavy viewing.
- No reselling, sublicensing or sharing door data with third parties, including the client's other businesses.
- No sharing of sign-ins between people. Each person needs their own seat.
- No reverse engineering, and no attempts to get around the app's role limits.
- **Question for counsel:** what remedy applies, and whether liquidated damages are appropriate for bulk extraction.

## 3. Who owns what

| Data | Owner | Notes |
|---|---|---|
| The client's customers, leads, notes, phone numbers it collected, appointments, results | **The client** | Traverse holds them only to run the Service. The client can download them at any time (customers, backups, bookings for its CRM). |
| Door data (public-record property data, scores, storm and roof layers, estimates) | **Traverse** (licensed to the client during the term) | Built from public sources and Traverse's processing. |
| Skip-trace phone results the client paid for | **Question for counsel** | The client paid the provider through the app; the provider's own terms may limit reuse. |

## 4. Accuracy and estimates

The client should acknowledge that much of the door data is **estimated or derived**, not measured on site:
- radar hail estimates;
- roof age and material estimates;
- lawn size levels;
- tree cover;
- solar output figures;
- values and owner names from county records, which can be out of date. The owner on record may not be the person at the door.

The client must not present these to homeowners as guarantees. Traverse does not warrant accuracy.

## 5. The client's sales conduct

The client chooses how it sells and is responsible for doing so lawfully. The agreement should place on the client, at minimum:
- local solicitation and permit rules (city door-to-door ordinances);
- **home-sale cancellation rights**: the federal cooling-off rule for door-to-door sales (16 CFR 429), plus any state rules for the client's trade. For Colorado roofing, the app shows the windows from C.R.S. 6-22 but cannot guarantee compliance;
- **calls and texts**: Do Not Call registries, consent for texting (the app's texting feature, when switched on, sends from the client's own number through Twilio), and the federal telephone consumer rules (TCPA, 47 U.S.C. 227);
- honesty in claims made at the door.

**Question for counsel:** the indemnity running from the client to Traverse for claims arising from the client's sales conduct, calls or texts.

## 6. Privacy

- Door data includes owner names and property addresses from public records. Clients add personal data of their own: homeowners' phone numbers, emails and notes.
- **Question for counsel:** how the Colorado Privacy Act applies. That covers whether Traverse is a controller or a processor for each kind of data, whether the public-records exemption covers the door data, and what a data-processing addendum must say.
- Contact for privacy requests: **privacy@traverseplatforms.com**.
- Security summary for clients: separate install per client; sign-in codes; role limits (crew, manager, admin, with Traverse's super admin above); download and heavy-viewing log; server in the US (SiteGround).

## 7. Money

- **Billing:** subscription billed through Stripe; per company with people included, extra seats per person; monthly or yearly. There is a founding-client price, and the trial terms come from the app's billing settings.
- **Seats:** the app warns when people exceed paid seats. Whether to bill the overage automatically is a business decision; it currently warns only.
- **Non-payment:** decide when access is suspended and when data is deleted.
- **Questions for counsel:** taxes, refunds and price changes on renewal.

## 8. Term, ending and data

- **Term** and automatic renewal; notice period to cancel.
- **On cancellation:** the client gets a window to download its own records (§3). After it, the install and the client's data are deleted, except backups for a short set period and records the law requires Traverse to keep.
- **Traverse may suspend** for non-payment, for breach of §2 (the download and heavy-viewing log is the evidence), or for unlawful use.

## 9. The usual terms

Confidentiality, limitation of liability (capped at fees paid, for example over 12 months), no consequential damages, service availability (no uptime promise at first; consider one later), changes to the Service, assignment, Colorado law and venue, notices (support@traverseplatforms.com for service, privacy@traverseplatforms.com for privacy), entire agreement.

---

## Questions for counsel, in one place

1. Liquidated damages or other remedy for bulk extraction of door data (§2).
2. Ownership and reuse of skip-trace results under the provider's terms (§3).
3. Indemnity scope for the client's sales conduct, Do Not Call and texting (§5).
4. Colorado Privacy Act: controller or processor, public-records exemption, need for a data-processing addendum (§6).
5. Disclosure wording for Traverse's built-in support sign-in (§1).
6. Taxes on subscriptions, refunds, price changes at renewal (§7).
7. Data retention after cancellation, and what must be kept (§8).
8. Whether a click-through agreement is enough, or a signed order form is needed for each client.

---

## Fact-check log

| Claim | Source | Status |
|---|---|---|
| Federal cooling-off rule for door-to-door sales: cancel by midnight of the third business day; refund within 10 business days | 16 CFR 429.1, read on eCFR 2026-10-11 | Verified |
| Colorado roofing cancellation windows (72 h after signing; 72 h after an insurer's denial) | C.R.S. 6-22-103 and 6-22-104, as cited in the app's code since 2026-10-09 | Cited from the app's own notes; counsel to confirm current text |
| Colorado Privacy Act applies to some businesses that sell personal data | Flagged 2026-10-06 in Traverse's planning notes; statute not re-read here | **Unresolved:** counsel to confirm thresholds and exemptions |
| TCPA citation 47 U.S.C. 227 | General knowledge, not re-read here | Counsel to confirm |
| What the app does (super admin, 500-door cap, logs, per-install data, Stripe, Twilio) | Traverse code, commits a40a00b, a6d2c34, 19b0c70 (2026-10-11) | Verified against the code |
| Traverse Platforms LLC not yet filed | Matthew, 2026-10-11 (Stripe conversation) | As stated by Matthew |
