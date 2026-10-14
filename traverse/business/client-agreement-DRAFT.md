# Traverse Subscription Agreement (DRAFT)

**Status: first full draft, written 2026-10-13 from the client-contract outline (TR-18), for attorney review. Not reviewed by a lawyer. Not legal advice. Not sent to anyone.**

How to read this draft:

- `[BRACKETS]` are blanks to fill or business choices to make. Each has a suggested default.
- **Counsel notes** (in boxes like this one) explain why a clause is written the way it is and what to check. Delete them before use.
- The Terms of Use each person accepts at sign-in are a separate document ([terms-of-use-DRAFT.md](terms-of-use-DRAFT.md)). §2.4 makes the client responsible for its people following them.
- `[ENTITY]` = Traverse Platforms LLC, a Colorado limited liability company, once filed.

---

## Traverse Subscription Agreement

This Subscription Agreement (the **"Agreement"**) is between **[ENTITY]** (**"Traverse"**, "we", "us") and the company named on the Order Form (the **"Client"**, "you"). It takes effect on the date the Order Form is signed or accepted online (the **"Effective Date"**).

### 1. Definitions

- **"Authorized User"**: a person the Client lets sign in to its Install: its employees, contractors and agents who work on its behalf.
- **"Client Data"**: everything the Client and its Authorized Users put into the Service or create through it, including customers, leads, notes, phone numbers and email addresses collected from homeowners, photos, appointments, door outcomes, results and training content. Client Data does not include Door Data.
- **"Door Data"**: the property and area information Traverse provides in the Service, and anything derived from it. That includes property records, owner-of-record names, addresses, lot and building details, scores and rankings, maps, aerial photos, storm, roof, lawn, tree, solar, pest, crime and other layers, estimates and neighbourhood groupings, whether shown on a door card, a map, a list or a table.
- **"Documentation"**: the help and setup material Traverse makes available for the Service.
- **"Edition"**: the trade version of the Service named on the Order Form (for example Roofing, Yards, Solar, Pest or Security).
- **"Install"**: the separate copy of the Service Traverse runs for the Client, with its own web address, sign-ins and data.
- **"Order Form"**: the order (Exhibit A, or an online checkout that references this Agreement) stating the Edition, plan, Seats, fees and Subscription Term.
- **"Seat"**: one Authorized User who can sign in. A Seat may not be shared between people.
- **"Service"**: the Traverse field-sales software provided over the internet, including the Install, the Door Data shown in it, its features, and the Documentation.
- **"Subscription Term"**: the initial term on the Order Form and each renewal.
- **"Support Account"**: the administrator sign-in Traverse keeps in every Install (described in §2.5).
- **"Third-Party Service"**: a service not provided by Traverse that the Client chooses to connect or use through the Service, such as payment processing, texting, a CRM, or a phone-lookup provider.

### 2. The Service

**2.1 Access.** During the Subscription Term, and subject to this Agreement, Traverse grants the Client a non-exclusive, non-transferable right for its Authorized Users to access and use the Service for the Client's internal business purposes, up to the number of Seats on the Order Form.

**2.2 Your own Install.** Traverse provides the Service to the Client as its own Install. Client Data is kept in the Client's Install and is not shown to any other Traverse client.

**2.3 Sign-ins.** Each Authorized User needs their own sign-in. Sign-ins may not be shared, lent or used by more than one person. A sign-in works on one phone or tablet and one computer at a time. The Client is responsible for keeping sign-in codes confidential, for giving and removing access, and for telling Traverse promptly if it suspects unauthorized use.

**2.4 Terms of Use.** Each Authorized User must accept Traverse's Terms of Use before using the Service. The Client is responsible for its Authorized Users' compliance with this Agreement and the Terms of Use, and for anything done under their sign-ins.

**2.5 Support Account.** Traverse keeps one administrator sign-in, marked "Traverse", in every Install, to provide support, keep the Service running and secure, and check compliance with §3 and §4. The Client cannot change or remove it. Traverse will use it only for those purposes and will treat what it sees as Confidential Information.

> **Counsel note (2.5):** the app's super-admin sign-in sits above the client's admins and is the only account that can export the door list or see sign-in codes. The outline asks for plain disclosure. Check the wording is enough, and whether the client's staff should also be told in the Terms of Use.

**2.6 Changes to the Service.** Traverse may change, add to or remove parts of the Service, including Door Data layers, towns and features. Traverse will not make a change during a paid Subscription Term that materially reduces the core functionality the Client paid for without [30] days' notice. If such a change happens, the Client may end the affected subscription and receive a pro-rata refund of prepaid fees for the remaining term.

**2.7 Coverage.** The Service covers the towns and areas listed in the Edition at the time of use. Coverage and the data available differ by town. Traverse does not promise any particular town, data layer or level of coverage unless the Order Form says so.

**2.8 Third-Party Services.** Some features work only with a Third-Party Service the Client chooses to use, under that provider's own terms and at the Client's cost (for example Stripe for payment, Twilio for texting, JobNimbus or Jobber for CRM, BatchData for phone lookups). Traverse is not responsible for Third-Party Services. If the Client connects one, the Client authorizes Traverse to exchange the necessary data with it.

### 3. Door Data licence

**3.1 Licence.** Door Data is licensed, not sold. During the Subscription Term, Traverse grants the Client a non-exclusive, non-transferable, non-sublicensable licence for its Authorized Users to view and use Door Data **inside the Service**, to plan and carry out the Client's own sales and service work in the covered areas.

**3.2 What the Client may not do with Door Data.** The Client will not, and will not let anyone else:

1. copy, download, export, scrape, harvest or record Door Data in bulk, by any means, including scripts, bots, browser tools, screen capture or manual re-keying, beyond the normal day-to-day use of the Service;
2. sell, resell, license, rent, share, publish or otherwise make Door Data available to anyone outside the Client, including the Client's affiliates or other businesses;
3. use Door Data to build, add to or improve any database, list, map, product or service, whether for the Client or anyone else;
4. use Door Data for any purpose other than the Client's own work under §3.1, including for credit, insurance, employment or tenant screening;
5. remove notices, try to get around the Service's role limits, export limits, logs or sign-in rules, or reach Door Data the Client's plan or roles do not provide.

**3.3 What the Client keeps.** Information an Authorized User learns at a property (for example a homeowner's answer, phone number or a note) is Client Data, even when it is entered on a door card.

**3.4 Monitoring.** The Service logs downloads, unusually heavy viewing of Door Data, and signs of shared sign-ins. Traverse may review these logs to enforce this §3.

**3.5 Remedies.** A breach of §3.2 causes Traverse harm that money alone may not repair. Traverse may suspend access immediately under §11, seek an injunction without posting a bond (where the law allows), and recover its damages. [In addition, for each property record extracted in breach of §3.2, the Client will pay liquidated damages of $[X], which the parties agree is a reasonable estimate of Traverse's loss and not a penalty.]

> **Counsel note (3.5):** the bracketed liquidated-damages sentence is optional. Question 1 for counsel: is it enforceable in Colorado at a per-record figure, and what figure is defensible? The app already enforces the technical side: only Traverse's super admin can download the door list, at most 500 doors at a time, and every download is logged.

### 4. Other restrictions

The Client will not, and will not let anyone else:

1. copy, modify, translate or make derivative works of the Service, or reverse engineer, decompile or try to extract its source code, except where the law expressly allows despite this limit;
2. resell, sublicense, time-share or provide the Service to anyone other than its Authorized Users;
3. use the Service to build a competing product, or access it to benchmark for a competitor;
4. test, probe or interfere with the Service's security or operation, or upload anything harmful;
5. use the Service in breach of any law, or to harass, deceive or harm anyone.

### 5. Client Data

**5.1 Ownership.** The Client owns its Client Data. Traverse gets no ownership rights in it.

**5.2 Licence to Traverse.** The Client grants Traverse a non-exclusive licence to host, copy, process, transmit and display Client Data only as needed to provide, secure, support and improve the Service for the Client, to send it to Third-Party Services the Client connects, and as the law requires.

**5.3 No sharing across clients.** Traverse will not show the Client's Client Data to other clients, combine it into Door Data offered to others, or sell it. Features that use nearby activity (for example neighbours already on service) use only the Client's own Client Data.

**5.4 Usage information.** Traverse may collect information about how the Service is used (for example which screens and buttons are used, and performance data) and use it to run and improve the Service. Traverse will not disclose it in a way that identifies the Client or any person.

> **Counsel note (5.4):** the app records screens and buttons used (never what is typed), sign-in device types, and door marks with times. The Terms of Use disclose this to staff. Check whether it makes Traverse a processor of employee data, which is Terms of Use question 3.

**5.5 Export.** The Client can download its customers, bookings and backups from the Service at any time while its subscription is active, using the Service's export tools.

**5.6 Client responsibility.** The Client is responsible for the accuracy and lawfulness of Client Data, and for having the rights and consents needed to collect it and put it in the Service. That includes homeowners' phone numbers, email addresses and photos.

### 6. Estimates and accuracy

**6.1 Estimates.** Much of the Door Data is estimated, modelled or taken from public records and outside sources, not measured at the property. That includes radar hail estimates, wind reports, roof size, pitch, age and material, lawn size, tree cover, solar output, scores, rankings, values and crime counts. Public records can be out of date, and the owner of record may not be the person at the door.

**6.2 No guarantees to homeowners.** The Client will not present Door Data to homeowners or anyone else as a measurement, inspection, appraisal or guarantee, and will check anything material before relying on it.

**6.3 Not a consumer report.** Door Data describes properties and areas, not people's credit, character or eligibility. The Client will not use it as, or in place of, a consumer report, or for any purpose covered by the Fair Credit Reporting Act.

> **Counsel note (6.3):** included because the app scores houses (need and likely ability to pay, from county value and the area's owner-occupied share), deliberately not people. Check the wording keeps the product clear of the FCRA.

### 7. The Client's sales conduct

**7.1 The Client chooses how it sells.** The Client decides how, when and to whom it sells, and is solely responsible for doing so lawfully. That includes:

1. **door-to-door rules**: local solicitation permits, licensing, hours and "No Soliciting" rules;
2. **cancellation rights**: the federal rule on sales made at a home (16 CFR Part 429, the three-day right to cancel) and any state rules for the Client's trade (for example, for Colorado roofing work, C.R.S. 6-22-103 and 6-22-104). Where the Service shows cancellation windows or reminders, they are a convenience; the Client remains responsible for its contracts and notices;
3. **calls and texts**: national and state Do Not Call rules, consent requirements for calls and texts, and the federal telephone consumer rules (the Telephone Consumer Protection Act, 47 U.S.C. 227). Texting from the Service, where the Client turns it on, is sent from the Client's own number and Twilio account; the Client is the sender;
4. **phone lookups**: any provider's terms and the law on contacting the numbers it returns;
5. **honest dealing**: truthful claims, licensing and insurance for its trade, and fair treatment of homeowners.

**7.2 People who ask not to be contacted.** The Client will honour requests not to be contacted, and will record them in the Service (for example the No Soliciting outcome) or its own systems.

> **Counsel note (7):** Question 3 for counsel: the indemnity in §15.1 runs from the client to Traverse for claims arising from the client's sales conduct, calls and texts. Check its scope. Citations to confirm: 16 CFR 429 was read on eCFR on 2026-10-11; the C.R.S. 6-22 sections are as cited in the app; 47 U.S.C. 227 was not re-read.

### 8. Privacy and security

**8.1 Roles.** For Client Data, the Client decides what is collected and why, and Traverse processes it on the Client's behalf to provide the Service. [If required, the parties will sign Traverse's Data Processing Addendum (Exhibit C), which then forms part of this Agreement.]

> **Counsel note (8.1):** Question 4. Under the Colorado Privacy Act (C.R.S. 6-1-1301 and following), a controller is covered if it processes the personal data of 100,000+ Colorado consumers a year, or 25,000+ while earning revenue from selling personal data. SB 24-041 proposed removing the second test at the end of 2026; its final status was not confirmed. Information a government makes publicly available is excluded from personal data, which may cover most Door Data. Each install's door list holds roughly 120,000–250,000 homes with owner-of-record names from county records. Decide: controller or processor for each kind of data, whether the public-records exclusion covers Door Data, and whether Exhibit C is needed.

**8.2 Security.** Traverse will maintain reasonable administrative, technical and physical safeguards for the Service and Client Data. Exhibit B summarizes them.

**8.3 Incidents.** If Traverse becomes aware of unauthorized access to Client Data in its systems, it will notify the Client without undue delay, and within [72 hours] where practicable. It will also provide the information the Client reasonably needs to meet its own obligations.

**8.4 Privacy requests.** Requests about personal data may be sent to **privacy@traverseplatforms.com**. If a homeowner or Authorized User contacts Traverse about Client Data, Traverse will pass the request to the Client.

### 9. Fees and payment

**9.1 Fees.** The Client will pay the fees on the Order Form. Unless the Order Form says otherwise, fees are billed in advance, monthly or yearly, through Traverse's payment processor (currently Stripe), and charged to the payment method on file.

**9.2 Seats.** Fees are per Seat, except a Duo plan, which covers up to [2] Authorized Users. The Client may add Seats at any time; added Seats are billed pro-rata for the rest of the billing period. If more people can sign in than the Client has paid for, Traverse may [notify the Client and] bill the extra Seats from the date they were added.

> **Business choice (9.2):** the app currently only warns when people exceed paid seats; it never locks anyone out or bills automatically. Pick "warn only", "warn, then bill after [14] days", or "bill automatically".

**9.3 Founding clients and pilots.** If the Order Form gives a founding-client discount or free pilot, those terms apply as stated there. A free pilot is offered once per client; at its end the subscription starts and is billed unless the Client cancels before the pilot ends.

**9.4 Late payment.** If a payment fails or is late, Traverse will notify the Client. If it is not paid within [14] days of that notice, Traverse may suspend the Service under §11 until payment is made.

**9.5 Taxes.** Fees exclude taxes. The Client pays any sales, use or similar taxes on its purchase, other than taxes on Traverse's income.

**9.6 Price changes.** Traverse may change its prices for any renewal by giving at least [30] days' notice before the renewal date. Founding-client discounts last for the period stated on the Order Form.

**9.7 Refunds.** Fees are non-refundable except as this Agreement expressly provides (§2.6, §10.4, §14.1).

> **Counsel note (9):** Question 6: whether Colorado (and Colorado home-rule cities) tax this subscription, and whether the refund and renewal terms need anything for a small-business buyer. Prices currently shown on traverseplatforms.com: Duo $99 per crew a month billed yearly ($129 month to month); Crew $35 per person a month yearly ($45 monthly); Pro $69 yearly ($89 monthly); second edition on Pro $20 per person a month; founding companies 30% off Pro for the first year and a 14-day pilot.

### 10. Term and ending

**10.1 Term.** This Agreement starts on the Effective Date and continues until every Subscription Term has ended.

**10.2 Renewal.** Each Subscription Term renews automatically for the same length (monthly or yearly) unless either party gives notice of non-renewal before the end of the current term. The Client can cancel in the app's billing page, or by email to **billing@traverseplatforms.com**. [For yearly plans, notice must be given at least [30] days before renewal.]

**10.3 Ending for breach.** Either party may end this Agreement by written notice if the other materially breaches it and does not fix the breach within [30] days of notice. Traverse may end it immediately for a breach of §3.2 or §4.

**10.4 Refund on ending for Traverse's breach.** If the Client ends this Agreement under §10.3 because of Traverse's breach, Traverse will refund prepaid fees for the remaining term.

**10.5 After it ends.**

1. Access to the Service and the licence to Door Data end. The Client stops using Door Data and deletes any it holds outside the Service.
2. For [30] days after the end, Traverse will, on request, give the Client access to download its Client Data, or provide an export.
3. After that window, Traverse will delete the Client's Install and Client Data. Backup copies are overwritten within [30] further days, except anything the law requires Traverse to keep.
4. Fees owed up to the end remain due.

> **Counsel note (10.5):** Question 7: retention. Server backups are currently kept nightly with the newest 30 retained, which matches the bracketed 30 days.

**10.6 Survival.** Sections 3.2, 3.5, 4, 5.1, 6, 7, 9 (for fees owed), 10.5, 12, 13, 14.2, 15, 16 and 17 survive the end of this Agreement.

### 11. Suspension

Traverse may suspend all or part of the Service, or an Authorized User's sign-in, if:

1. fees are overdue under §9.4;
2. Traverse reasonably believes there is a breach of §3.2 or §4, or a shared sign-in;
3. there is a security threat, or suspension is needed to comply with law.

Traverse will give notice before suspending where practical, will limit the suspension to what is needed, and will restore access promptly once the cause is fixed.

### 12. Confidentiality

**12.1 What is confidential.** "Confidential Information" means non-public information one party shares with the other that is marked confidential, or that a reasonable person would understand to be confidential. For Traverse, that includes the Service, Door Data and pricing not published. For the Client, it includes Client Data.

**12.2 Duties.** The receiving party will use Confidential Information only for this Agreement, protect it with at least reasonable care, and share it only with its people and advisers who need it and are bound to keep it confidential.

**12.3 Exceptions.** These duties do not cover information that is or becomes public through no fault of the receiver, was already known to the receiver, is received from someone else lawfully, or is developed independently. A party may disclose Confidential Information when the law requires, after giving notice where allowed.

### 13. Ownership and feedback

**13.1 Traverse's rights.** Traverse and its licensors own the Service and the Door Data, and all intellectual property in them. Except for the rights expressly granted here, no rights pass to the Client.

**13.2 Feedback.** If the Client suggests improvements, Traverse may use them without obligation.

**13.3 Name.** Traverse may list the Client's name as a customer [only with the Client's written permission].

### 14. Warranties and disclaimers

**14.1 Traverse's warranty.** Traverse warrants that during the Subscription Term the Service will perform materially as described in the Documentation. If it does not, the Client's remedy is for Traverse to fix the problem, or, if Traverse cannot within [30] days of notice, for the Client to end the affected subscription and receive a pro-rata refund of prepaid fees.

**14.2 Disclaimer.** Except as stated in §14.1, the Service and Door Data are provided "as is" and "as available". To the extent the law allows, Traverse disclaims all other warranties, express or implied, including merchantability, fitness for a particular purpose, accuracy, non-infringement, and that the Service will be uninterrupted or error-free. Traverse does not promise any sales result.

### 15. Indemnities

**15.1 By the Client.** The Client will defend and indemnify Traverse against third-party claims, and the resulting losses, fines and reasonable legal costs, arising from:

1. the Client's sales conduct, contracts, calls, texts or contact with homeowners (§7);
2. Client Data, including the Client's collection and use of phone numbers and other personal information;
3. a breach of §3.2 or §4 by the Client or its Authorized Users.

**15.2 By Traverse.** Traverse will defend and indemnify the Client against third-party claims that the Service, as provided by Traverse, infringes a United States copyright or misappropriates a trade secret. This does not cover claims arising from Client Data, Third-Party Services, combinations with things Traverse did not provide, or use in breach of this Agreement. If such a claim arises, Traverse may modify the Service, get the right for the Client to keep using it, or end the affected subscription and refund prepaid fees for the remaining term.

> **Counsel note (15.2):** deliberately limited to copyright and trade secrets. It leaves out patents, and trademarks for now: a live federal registration for TRAVERSE in Class 42 (Reg. 5110999, Traverse Data, Inc., for online software that collects, analyzes and licenses user data) sits close to this product. Settle the name question before widening this clause.

**15.3 Process.** The party seeking indemnity must notify the other promptly, let it control the defence and settlement (no settlement may admit fault or impose obligations on the indemnified party without its consent), and give reasonable help at the other's cost.

### 16. Limitation of liability

**16.1 Cap.** Each party's total liability arising from this Agreement will not exceed the fees the Client paid or owed to Traverse in the [12] months before the event giving rise to the claim.

**16.2 Excluded damages.** Neither party is liable for lost profits, lost revenue, lost data (except Traverse's obligations under §8 and §10.5), or indirect, incidental, special, consequential or punitive damages, even if told they were possible.

**16.3 Exceptions.** §16.1 and §16.2 do not limit: the Client's obligation to pay fees; the Client's liability for a breach of §3.2 or §4; either party's indemnity obligations under §15; or liability that cannot be limited by law.

### 17. General

**17.1 Law and venue.** Colorado law governs this Agreement, without regard to conflict-of-law rules. Courts in the City and County of Denver, Colorado, have exclusive jurisdiction, except that Traverse may seek an injunction in any court to protect the Service or Door Data.

**17.2 Notices.** Notices go to the email addresses on the Order Form, and to Traverse at **support@traverseplatforms.com** (legal notices: **[legal@traverseplatforms.com]**). A notice is given when sent, unless the sender receives a bounce.

**17.3 Assignment.** Neither party may assign this Agreement without the other's consent, except to a successor in a merger, acquisition or sale of substantially all of its relevant business, with notice.

**17.4 Events outside control.** Neither party is liable for delay or failure caused by events beyond its reasonable control (for example outages of hosting, internet, power or outside data sources, natural disasters or government action), other than payment obligations.

**17.5 Relationship.** The parties are independent contractors. Nothing here creates a partnership, joint venture or employment.

**17.6 Order of precedence.** If documents conflict, the Order Form governs, then this Agreement, then Exhibit C, then the Documentation.

**17.7 Changes.** Traverse may update this Agreement for new subscriptions and renewals by posting the new version and giving [30] days' notice. Changes apply from the next renewal. Any other change needs both parties' written agreement.

**17.8 Electronic signature.** The Order Form may be signed or accepted electronically, and this Agreement binds the parties as if signed on paper.

**17.9 Other terms.** If a part of this Agreement is unenforceable, the rest stays in effect. A failure to enforce is not a waiver. This Agreement, with the Order Form and exhibits, is the entire agreement on its subject and replaces earlier discussions. Purchase-order terms the Client issues do not apply.

> **Counsel note (17.8):** Question 8: whether accepting online (a checkout that references this Agreement) is enough, or each client should sign an Order Form. The app's billing page sends clients to Stripe Checkout today; it does not show this Agreement or record acceptance yet.

---

## Exhibit A: Order Form

| | |
|---|---|
| **Client** (legal name) | [ ] |
| **Client contact and notice email** | [ ] |
| **Billing email** | [ ] |
| **Edition** | [Roofing / Yards / Solar / Pest / Security] |
| **Second edition** (Pro only) | [None / name] at $20 per person a month |
| **Plan** | [Duo: up to 2 people / Crew / Pro] |
| **Seats** | [ ] (Duo: up to [2]) |
| **Billing** | [Monthly / Yearly], in advance, by card through Stripe |
| **Fees** | [Duo $129 a month or $99 a month billed yearly / Crew $45 a person a month or $35 billed yearly / Pro $89 a person a month or $69 billed yearly] |
| **Founding client** | [Yes / No]. If yes: a free 14-day pilot, then 30% off Pro for the first 12 months |
| **Start date** | [ ] |
| **Initial Subscription Term** | [1 month / 12 months], renewing under §10.2 |
| **Install address** | Provided by Traverse at setup |
| **Optional features** (Client's own accounts and cost) | Texting (Twilio) · JobNimbus · Phone lookups |
| **Special terms** | [None] |

This Order Form is governed by the Traverse Subscription Agreement [version 1, dated ___], which the Client has read and accepts.

Signed for **[ENTITY]**: ______________________ Name: Matthew Sharpe Title: [Manager / Member] Date: ________

Signed for **the Client**: ______________________ Name: ______________ Title: ______________ Date: ________

---

## Exhibit B: Security summary

What the Service does today (checked against the code, 2026-10-13):

- **A separate Install per client**, with its own web address, sign-ins, data folder and phone-alert key. One client's data is never shown in another client's Install.
- **Sign-in codes** of six digits, chosen by the client's admins, with simple patterns (runs such as 123456, or one digit repeated) refused. One phone or tablet and one computer per sign-in at a time.
- **Roles:** crew, manager (their own team only) and admin, with Traverse's Support Account above them. Every rule is enforced on the server, not only hidden in the app.
- **Downloads:** the door list can be downloaded only by Traverse's Support Account, at most 500 doors at a time. Every download in the Service is logged and visible to the client's admins.
- **Shared sign-in flags:** marks too far apart for the time between them, and frequent phone switches, are flagged to admins. The Service does not collect users' phone location.
- **Hosting** in the United States (SiteGround), over HTTPS.
- **Backups:** a nightly copy of each Install's records, the newest 30 kept.
- **Phone numbers:** the Service never texts a looked-up number; texting, where turned on, honours STOP replies and quiet hours.

---

## Exhibit C: Data Processing Addendum

[To be drafted by counsel if §8.1 requires it. See counsel note at §8.1.]

---

## Questions for counsel, in one place

1. **§3.5**: Liquidated damages for bulk extraction of Door Data. Enforceable per record in Colorado? What figure?
2. **§2.8, §7.1(4)**: Phone-lookup results. Who owns them, and does the provider's licence limit reuse? (BatchData; Sixfold only today.)
3. **§15.1**: Scope of the client's indemnity for sales conduct, Do Not Call and texting.
4. **§8.1**: Colorado Privacy Act. Controller or processor for each kind of data; whether the public-records exclusion covers Door Data; is Exhibit C needed; status of SB 24-041.
5. **§2.5**: Is the Support Account disclosure enough?
6. **§9**: Sales tax on subscriptions (state and home-rule cities), refund and renewal terms.
7. **§10.5**: Data retention after cancellation; anything that must be kept.
8. **§17.8**: Is online acceptance enough, or a signed Order Form per client?
9. **§6.3**: Does the house-not-person scoring keep the product outside the FCRA?
10. **§15.2 and the name**: Given the live TRAVERSE Class 42 registration (Reg. 5110999, Traverse Data, Inc.) and the Class 9 registration (Reg. 2022392, Open Systems Holdings Corp.), is a clearance opinion needed before launch?

---

## Fact-check log

| Claim | Source | Status |
|---|---|---|
| Each client has its own Install; Client Data isn't shown to others | build-editions.cjs and clients.cjs (separate folder, API, data and private folder per install) | Verified against the code |
| Support Account above client admins; only it exports the door list (500 max); downloads logged; sign-in codes visible only to it | rounds.php `planexport`, `accountpins`, `exportLog` (2026-10-11) | Verified |
| Six-digit codes; runs and repeated digits refused | rounds.php `acctWeakCode` | Verified |
| One phone/tablet and one computer per sign-in | rounds.php one-device rule (2026-10-12) | Verified |
| Shared-sign-in flags from door addresses and times; no phone location collected | rounds.php `flags`; Terms of Use fact-check log | Verified |
| Pest neighbour features use only the install's own customers | rounds.php pest/security rows from this install's customers.log | Verified |
| Texts only to numbers given at the door; STOP and quiet hours (8 am–9 pm) | rounds.php `smsTarget`; sms.php | Verified |
| Nightly backups, newest 30 kept | TASKS.md TR-10; traverse/ops/pull-server-backup.sh | Verified (TASKS record) |
| Plans and prices | traverseplatforms.com, read from the server 2026-10-13; billing.php `display` | Verified |
| 16 CFR 429: three-day cancellation for home sales | eCFR, read 2026-10-11 (outline log) | Verified then; re-check before use |
| C.R.S. 6-22-103 and 6-22-104 (Colorado roofing) | As cited in the app since 2026-10-09 | Counsel to confirm current text |
| 47 U.S.C. 227 (TCPA) | General knowledge | Not re-read; counsel to confirm |
| Colorado Privacy Act thresholds (100,000 consumers; or 25,000 plus revenue from sales); government-public information excluded; SB 24-041 would remove the 25,000 test at the end of 2026 | SB 21-190 and SB 24-041 texts (leg.colorado.gov), Colorado AG CPA page, via search 2026-10-13 | Thresholds from the statute; SB 24-041's final status not confirmed |
| TRAVERSE Reg. 5110999, Class 42, Traverse Data, Inc., live | USPTO trademark search, 2026-10-13 | Verified on USPTO data |
| TRAVERSE Reg. 2022392, Class 9, Open Systems Holdings Corp., live, renewed 2016 | USPTO TSDR, 2026-10-13 | Verified |
| [ENTITY] not yet filed | Matthew, 2026-10-13 ("working on getting an LLC") | As stated |
