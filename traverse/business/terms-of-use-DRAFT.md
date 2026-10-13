# Traverse — Terms of Use (DRAFT)

**Status: draft for Matthew and his attorney (TR-18). Not reviewed by counsel. Not published, not shown in the app.**
Written 2026-10-12. These are the terms each **person** who signs in agrees to. The **company** that pays signs the client
agreement ([client-contract-outline-DRAFT.md](client-contract-outline-DRAFT.md)); its §2 already bans shared sign-ins, and that
agreement should say these terms bind the company's staff.

**Where it goes once approved:**
1. **In the app:** shown once at first sign-in with an "I agree" button; the app records who agreed, to which version, and when.
   Linked from Profile afterwards. (Not built yet: it waits for final text.)
2. **On traverseplatforms.com:** a Terms page, linked from the footer and from the sign-in screen.
3. **In the client agreement:** referenced by name and version.

`[ENTITY]` = Traverse Platforms LLC, once filed (not filed as of 2026-10-11). Each `[BRACKET]` is to be filled or decided.

---

## Terms of Use

**Last updated: [DATE] · Version [1]**

These terms are between you and [ENTITY] ("Traverse", "we"). You can use Traverse because the company you work for or with
("your company") has a subscription. By signing in you agree to these terms. If you do not agree, do not sign in.

### 1. Your sign-in is yours

- Your sign-in code is for **you alone**. Do not share it, lend it, post it or let anyone else use it, including someone else
  at your company. Each person needs their own sign-in from your company's admin.
- **One phone and one computer at a time.** Your code works on one phone or tablet and one computer at once. Signing in on
  another phone signs the first one out, and that phone is told why.
- Tell your company's admin straight away if you think someone else has your code. They can give you a new one.
- You are responsible for what is done with your sign-in until you report it.

### 2. What the app records

So that your company can run its teams and so that sign-ins are not shared, the app records:

- **When and on what kind of device you sign in** (for example "iPhone" or "Windows computer"), and when you sign out.
- **The doors you mark, with the time,** and the notes, phone numbers, emails and photos you add.
- **Which screens and buttons you use.** Never what you type.
- **Downloads** made from the app, and unusually heavy viewing of door data.
- **Flags for a sign-in that looks shared.** We compare *where the doors you mark are* (from each door's address, not from your
  phone) and the time between marks. Two marks further apart than anyone could drive in that time are flagged for your
  company's admin, and so is a code that moves between phones several times in a day. A flag is a prompt to ask, not proof.

**Your location.** The app asks for your phone's location only when you choose to use it (for example "nearest door" or the
map). It is used on your phone to show where you are and to order your stops. **The app does not send it to Traverse or store
it,** and it does not track you in the background. You can say no and still use the app.

Your company's admins can see what you record and the records above. [Privacy notice: link, once written.]

### 3. The door data is licensed, not given

The property records, scores, maps and estimates in the app ("door data") belong to Traverse and are licensed to your company
while it subscribes. You may use them to plan and do your company's work. You may not:

- copy, download, scrape, screenshot or export door data in bulk, or use any tool or script to do it;
- give, sell or show door data to anyone outside your company, or use it for another business or for yourself;
- try to get around the app's limits, logs or sign-in rules, or reach data your role does not show you.

Downloads and heavy viewing are logged (section 2).

### 4. Estimates are estimates

Much of the door data is estimated or worked out from public records, aerial photos, laser scans, weather radar and similar
sources, not measured at the property. It can be wrong or out of date. Check anything that matters before relying on it, and
do not tell a homeowner an estimate is a measurement.

### 5. Using the app properly

- Follow the law where you work, including local rules on door-to-door selling, "No Soliciting" signs, do-not-call rules and
  any lists your company keeps of people who asked not to be contacted.
- Only add phone numbers, emails, notes and photos you are allowed to collect. Photos are of the property, not of people, and
  only with the owner's OK.
- Do not use the app to harass anyone, or to put anything false, offensive or unlawful into it.

### 6. If the terms are broken

We or your company may suspend or end a sign-in that breaks these terms, including a shared sign-in. Shared sign-ins can also
be billed to your company as extra seats under its agreement with us.

### 7. The service

We work to keep the app available and accurate but provide it **as it is**, without promises that it will always be available,
error-free or suited to a particular purpose, to the extent the law allows. [Limitation of liability: counsel.]

### 8. Changes

We may update these terms. When we do, the app shows the new version and asks you to agree before you carry on.

### 9. Law and contact

These terms are governed by the laws of the State of Colorado. [Venue: counsel.] Questions: **support@traverseplatforms.com**.

---

## Questions for counsel

1. Is a click-through at first sign-in enough to bind each person, given the company signs the main agreement? Should the
   client agreement make the company responsible for its staff's breaches (§3, §6)?
2. **Location wording (§2):** the app does not send or store phone location; the shared-sign-in flag uses door addresses and
   times. Is the disclosure sufficient, and does anything here need consent beyond the click-through?
3. **Colorado Privacy Act / employee data:** does recording sign-ins, marks and button use for client staff create obligations
   for Traverse (processor for the client?) — ties to the client agreement's §6 question.
4. Billing shared sign-ins as seats (§6): enforceable as written in the client agreement?
5. Limitation of liability, disclaimer and venue wording (§7, §9).
6. Does a Spanish version need to be offered, given the app runs in Spanish for crews?

## Fact-check log

| Claim | Checked against | Result |
|---|---|---|
| One phone + one computer at a time; the other is told why | `traverse/app/api/rounds.php` (devClass, startSession, the 'x' list), onedev-test 11/11, 2026-10-12 | Verified (built today; live once uploaded) |
| Location used only on the phone, not sent or stored | `index.html`: `S.here` is used for the map marker and stop order only; no API call sends it (grep 2026-10-12) | Verified |
| Screens/buttons recorded, never typing | tap log (taplog action), Profile note | Verified |
| Downloads and heavy viewing logged | exportLog, VIEW_STEP | Verified |
| Shared-sign-in flags from door addresses and times | `flags` action (town centres less 10 mi, over 70 mph, crew and managers only) | Verified |
| [ENTITY] not filed | client-contract-outline fact-check log, Matthew 2026-10-11 | As stated by Matthew |
