# Traverse Privacy Policy (DRAFT)

**Status: first draft, 2026-10-13, for review with the subscription agreement. Not reviewed by a lawyer. Shown on traverseplatforms.com/privacy/ marked as a draft while the site is unlisted.**

> **Counsel note:** written from what the website and the app actually collect, checked against the code on 2026-10-13. Every factual line about the product is in the fact-check log at the end. The Colorado Privacy Act questions are the same ones in the subscription agreement's §8.1 (controller or processor, the public-records exclusion, whether door data licensing is a "sale").

## Privacy Policy

**Last updated: [DATE] · Draft**

This policy explains what Traverse Platforms LLC ("Traverse", "we", "us") collects, why, and what you can do about it. It covers three groups of people:

1. **Visitors to traverseplatforms.com**, including anyone who books a demo.
2. **Our clients and the people who use Traverse for them** (their admins, managers and crews).
3. **Homeowners**, whose property information appears in the app.

Questions or requests: **privacy@traverseplatforms.com**, or (303) 596-9515.

### 1. Visitors to our website

**What we collect.** When you book a demo or ask for your app's link, we collect what you type into the form: your name, company, email, phone number, trade, team size, the towns you work and any notes. We also keep the time of the request and the internet address it came from, to stop spam.

**What we use it for.** To hold the demo, contact you about it, answer your request, and keep a record of who has asked.

**Cookies and tracking.** The website sets no advertising or analytics cookies and uses no tracking pixels. Your browser loads the site's fonts from Google Fonts, which receives your internet address when it does. Our hosting company keeps standard server logs.

### 2. Clients and the people who use Traverse

**Account and sign-in information.** Each person's name and role, the kind of device they sign in from (for example "iPhone" or "Windows computer"), and when they sign in and out. Anyone can add a profile photo of themselves.

**What people record in the app.** Door outcomes with the time, notes (typed or spoken), photos, phone numbers and email addresses homeowners give, appointments, customers, leads and results. This is the client's own data (see section 4).

**How the app is used.** Which screens and buttons are used, so we and the client can see what helps. Never what anyone types.

**Downloads and shared sign-ins.** Every download from the app is logged. The app flags a sign-in that looks shared, using the addresses of the doors marked and the time between them, and frequent switches between phones.

**Location.** The app asks for a phone's location only when the person chooses a feature that uses it, such as the nearest door or the map. The location is used on the phone to show where they are and to order their stops. **It is not sent to us or stored**, and the app does not track anyone in the background.

**Payments.** Billing is handled by Stripe. We receive the plan, the number of seats and whether a payment succeeded. We never see or store card numbers.

### 3. Homeowners

**What the app shows about a property.** Traverse shows information about homes so that companies can plan their work: the property's address, the owner's name as it appears in public government records, lot and building details, the home's assessed value, and estimates worked out from published sources (for example roof size, lawn size, storm history and solar potential). Much of it is an estimate and may be out of date. Traverse scores houses, not people.

**What Traverse does not add.** We do not add phone numbers or email addresses to the property information. A phone number appears only when a homeowner gives it to a client at the door, or when a client chooses to use a phone-lookup service and pays for it.

**Notes from a visit.** If a client's representative visits your home, what they record (for example your answer, or a phone number you give them) belongs to that client and is handled under section 4.

**Your choices.** You can ask us what Traverse shows about your property, to correct something that is wrong, or to have your name removed from the property information. Email privacy@traverseplatforms.com with the address. To stop a company visiting or calling you, tell that company; the app lets them mark your home "No soliciting".

### 4. Client data is the client's

The information a client and its people put into Traverse (customers, leads, notes, phone numbers, appointments) belongs to that client. We hold it only to run Traverse for them. Each client has its own separate copy of Traverse, and one client's data is never shown to another. If you want to see, correct or delete information a company recorded about you, contact that company; we will help them answer you.

### 5. Who we share information with

We do not sell the personal information of our website visitors or app users. We share information only with the service providers that run Traverse, and only what each needs:

- **SiteGround** hosts the website and the app, in the United States.
- **Google Workspace** carries our email.
- **Stripe** processes subscription payments.
- **Twilio** sends text messages, when a client turns texting on; texts go from that client's own number.
- **JobNimbus**, when a client connects it, receives the bookings the client sends it.
- **A phone-lookup provider**, when a client turns lookups on and pays for them.
- **Map and weather image services** provide the map, aerial and radar pictures the app loads on your device; they receive your device's internet address, as any website does.

We may also disclose information when the law requires it, to protect people's safety, or as part of a sale or merger of our business, where the buyer keeps this policy's promises.

> **Counsel note (§5):** the door data itself is licensed to clients inside the app. Whether that licensing is a "sale" of personal data under the Colorado Privacy Act, or falls under the exclusion for information a government makes publicly available, is Question 4 in the subscription agreement. The sentence "we do not sell" is limited here to visitors' and users' information on purpose.

### 6. How long we keep it

- **Demo bookings and link requests:** up to [24 months], then deleted.
- **Client data:** for as long as the client subscribes. After a subscription ends, the client has 30 days to download its records; we then delete them, and backups are overwritten within 30 further days.
- **Sign-in and usage records:** for as long as the client subscribes, then deleted with the client's data.
- **Payment records:** as long as tax and accounting law requires.

### 7. Security

Each client has its own copy of Traverse with its own sign-ins. Sign-in codes are six digits, chosen by the client's admins, and each code works on one phone and one computer at a time. Roles limit what each person sees, and the limits are enforced on our server. Only Traverse can download the door list, at most 500 doors at a time, and every download is logged. The site and app use HTTPS. Records are backed up every night.

No system is perfectly secure. If we learn of unauthorized access to personal information we hold, we will tell the affected client, and the people affected where the law requires.

### 8. Your rights

Depending on where you live, you may have the right to ask what personal information we hold about you, to correct it, to delete it, to get a copy, and to opt out of its sale or its use for targeted advertising or profiling. To make a request, email privacy@traverseplatforms.com. We will confirm who you are before acting, answer within 45 days, and not treat you differently for asking. If we turn down a request, you can appeal by replying to our answer.

> **Counsel note (§8):** the rights list and the 45-day window follow the Colorado Privacy Act's general shape; confirm against C.R.S. 6-1-1306 and the Attorney General's rules, and whether Traverse is covered at all at current volumes.

### 9. Children

Traverse is for businesses. It is not meant for anyone under 16, and we do not knowingly collect children's information.

### 10. Changes

If we change this policy, we will post the new version here with its date, and tell clients by email before a significant change takes effect.

---

## Fact-check log

| Claim | Checked against | Result |
|---|---|---|
| Demo form fields; time and internet address kept; spam limits | traverse/marketing-site/site-src/demo/api.php (2026-10-13) | Verified |
| No analytics or advertising cookies; Google Fonts loaded | Homepage source: no analytics scripts; fonts.googleapis.com link | Verified |
| Device type, sign-in times, screens and buttons (never typing), download log, shared sign-in flags | rounds.php (devClass, taplog, exportLog, flags) | Verified |
| Location used on the phone only, not sent | Terms of Use fact-check (S.here never sent), 2026-10-12 | Verified then |
| Stripe: no card data reaches Traverse | billing.php (Stripe Checkout and portal only) | Verified |
| No phone numbers or emails added to door data; skip trace only when a client turns it on | Door data builders carry none (sixfold-door-territory notes: "No phone numbers, ever"); skiptrace feature is Sixfold only | Verified |
| Each client has its own copy; data never shown to another | build-editions.cjs / clients.cjs (separate folders) | Verified |
| Codes six digits, one phone + one computer, 500-door download cap, nightly backups | rounds.php; TASKS TR-10 | Verified |
| Service providers listed | The app's integrations (SiteGround, Workspace, Stripe, Twilio, JobNimbus, phone lookups, map and radar tiles) | Verified against the code |
| 45-day answer window, rights list | Colorado Privacy Act general shape | **Counsel to confirm** |
| Retention of 24 months for bookings | Business choice, bracketed | **Matthew to decide** |
