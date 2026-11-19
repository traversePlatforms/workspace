# Desk emails and booking links: DRAFT for Matthew to approve (19 Nov 2026)

Matthew, for Cai: "a follow up email ... she wants to be able to customize it to who she is talking to ... a box in the peak desk app ...
she can fill it out with whatever she wants to say click send and it will send it to the prospect. She also wants a calendar feature built
out, so that when she emails people like this or when follow up emails are sent they can click a link and book a time slot based on the
availability." Later the same day: availability is one shared schedule for the whole desk, not per person.

**Both are built and both are OFF.** Nothing has been sent to anyone, and no booking link takes bookings yet. The two switches are in the
desk under **More › Settings**: "Desk emails" and "Booking links". Only an admin sees them.

---

## 1. What Cai sees on a card

Every company card (Sponsors and Expo leads) has a new section, **Write an email**, under "Send a message".

- **Write an email to Robin…** opens the box.
- **To:** a list of the people on the card who have an email and are not marked Don't contact, best contact first. "Someone else"
  lets her type a name and an email.
- **Start from:** a blank email, or any saved template (the same ones as Send a message). The template fills in their first name, the
  company and the next tour, and she can change every word. The template's own sign-off name is dropped, because her signature goes under
  the email anyway.
- **Subject** and **Message:** whatever she wants to say.
- **Insert my booking link:** puts `{book}` where her cursor is ("Pick a time that suits you: {book}"). When the email is sent, `{book}`
  becomes a link made for that email. The link knows the company and the person, so the booking page is already filled in for them, and
  the booking lands on this card with Cai as host.
- **Preview:** the email as it would go: To, From (Matthew's Peak Outlook), Reply-To, Subject, her words, her signature, Peak's address
  and the opt-out line. Nothing is sent.
- **Send:** asks "Send this email to Robin Field (robin@…) now? It goes from Matthew's Peak Outlook, signed by you." Then it goes.
- **Copy** and **Open in my mail app:** for when she would rather send it herself. Both still work while desk emails are off. Her
  personal booking link goes in place of `{book}`, and the card asks her to log it, as Send a message does.

After Send:
- The card's Activity shows **Emailed "subject" to Robin Field (robin@…) from the desk**, by Cai. **Show the email** opens the whole
  email, with "booking link opened 2 times" and "and they booked" when that happens.
- It counts as Cai's email this week. It moves the stage the way any email does (To contact → Emailed), and she becomes owner if nobody
  owns the company. The follow-up she picked on the card is set.
- If it did not go (Microsoft down, for example), the card says **Email not sent: … Retry**. Retry sends the same email, and it can never
  go twice. Outbox's Peak section counts it and flags it.
- It will not send to anyone marked Don't contact, to anyone on the Peak email do-not-email list (unsubscribed, bounced, replied STOP),
  or while the message still has a `{field}` left unfilled.

**Her settings:** More › **My email & booking link**:
- **My email signature:** starts as "Cai Silva / Peak Pickleball", and she can add her phone.
- **Replies to my emails go to:** optional. If she puts her own address here, replies to her desk emails go to her. Left empty,
  replies come to your Peak inbox.
- **My booking link:** her personal link to paste anywhere, with "Make a new link" if it ever needs replacing.

While **Desk emails** is off: **Send** is greyed and says "Send turns on once Matthew says go. Until then use Preview, then Copy or Open
in my mail app." While **Booking links** is off, the Insert button is greyed and says "Booking links turn on once Matthew says go."

## 2. A sample email as the prospect gets it

From: matthewsharpe@peakpickleball.us (your Peak Outlook)
Reply-To: Cai's own address, only if she sets one
Subject: Following up from today

```
Hi Robin,

Good to talk today. Pick a time that suits you: https://traverseplatforms.com/peak-book/?m=dm1a2b3c4d5e-0f1e2d3c4b5a

Thanks,
Cai Silva
Peak Pickleball

Peak Pickleball, 1730 Briargate Blvd, Colorado Springs, CO 80920
If you'd rather not get emails from Peak, reply and let me know.
```

It goes as plain text, with the same words as simple HTML (the link clickable). The booking link is the only link that is counted. There
is no open image unless you turn that setting on.

## 3. The booking page (what the prospect sees)

Public address: **https://traverseplatforms.com/peak-book/** plus the link's own code. Without a valid code it shows nothing.
Screenshots: `tests/booking-page.png` and `tests/booking-page-phone.png`.

```
PEAK PICKLEBALL
Book a time with Peak Pickleball

A 30-minute visit to Peak Pickleball with Cai Silva[, for <their company>]. Pick a time below. Times are Mountain time.
Where: Peak Pickleball, 1730 Briargate Blvd, Colorado Springs, CO 80920. The entrance is from the parking lot off Jamboree Drive;
there is no way in from inside Chapel Hills Mall.

Tuesday, November 24    8:00 am  8:30 am  ...  3:30 pm
Wednesday, November 25  2:00 pm  2:30 pm  3:00 pm  3:30 pm
...
Your name / Your email / [Company or organisation] / [What would you like to talk about? Sponsoring at Peak | Holding an event or expo at Peak]
Anything we should know (optional)
[Book this time]
```

The company field and the "talk about" question show only when the link doesn't already know who they are.

After booking: **"You are booked. Tuesday, November 24 at 2:00 pm (Mountain time), 30 minutes, with Cai Silva."** It repeats the
address, and adds "A confirmation email with a calendar invite is on its way" when tour confirmations are on. There is an
**Add it to my calendar** button, and "Need to change it? Reply to the email, or call Peak at (719) 377-4725."

Other answers it can give:
- "You already have a time" (one booking per person at a time)
- "That time was just taken. Pick another one."
- "Not taking bookings right now" (while the switch is off)
- "That link did not work"

**The hours (one schedule for the whole desk):** Mon, Wed, Fri 2:00–4:00 pm; Tue, Thu 8:00 am–4:00 pm, Mountain time. Meetings are
30 minutes (the last starts at 3:30, so it ends by 4). Bookings need 24 hours' notice and can be up to 14 days out. Admins change these in
More › Settings › Booking links: the days and times, the length, the notice, how far ahead, and blocked dates.

**One booking per slot, desk-wide:** a slot disappears for everyone once it is taken. That covers a booking from any link and a tour typed
on the desk (sponsors or expo). Two people pressing Book on the same slot at the same moment: one gets it, the other is told it was just
taken.

**What a booking does:**
- **The tour goes on the right card.** From an email link, it lands on that company. From a personal or general link, the desk matches
  the visitor's email, then the company name. Otherwise it makes a new lead marked **"Booked from link"** on the list they picked. The
  company moves to Meeting / tour booked (or Tour booked on the Expo leads).
- **The host is the person whose link it was.** It shows on their Today ("Booked from your booking link") and on Tours, it goes into their
  calendar feed, and they become owner if nobody owns the company. The **general link** (Settings) has no host: admins see it on Today,
  and someone picks it up.
- **You get a heads-up email for every booking,** as the Peak email's book-a-time page does now: who, when, whose link, new lead or not,
  and their note.
- **The tour confirmation email and invite go to them** only if that switch is on too.
- **The Peak email's `{book}` now leads here.** The old b.php sends people on to this page, so outreach bookings use the same hours and
  slots. The view and the booking are still counted in the Peak email's stats. The outreach lists are untouched and still paused.

Not built: a reschedule or cancel link in the confirmation. To change a time, they reply or call, and the host moves the tour on the desk.
The existing tour confirmation then sends the updated invite.

## 4. How to turn it on

1. Read this file. The wording that goes out:
   - the opt-out line ("If you'd rather not get emails from Peak, reply and let me know.")
   - the booking page text in section 3
   - the default signature (desk name + "Peak Pickleball")
2. **Block the days Peak is closed.** No holidays are blocked yet, so Thanksgiving (Thu 26 Nov), Christmas and New Year's Day currently
   show open times. Add them in More › Settings › Booking links › Blocked dates (one a line, like 2026-11-26).
3. Booking links: More › Settings › Booking links › **On** › Save. Then open your own link (More › My email & booking link) on your phone
   and look at the times.
4. Desk emails: More › Settings › Desk emails › **On** › Save. It refuses to turn on while your Peak Outlook isn't connected. Send the
   first one to yourself: add yourself as a contact on a test card, write an email, Send, and check it arrives and the booking link works.
5. Tour confirmations are a separate switch (Settings › Tour confirmation emails), still off. With it on, link bookings also get the
   confirmation and calendar invite.

Each switch change is logged (`peak-desk-data/deskmail-settings.log`, `book-settings.log`).

## Fact-check log

| Claim | Source | Status |
|---|---|---|
| 1730 Briargate Blvd, Colorado Springs, CO 80920 | Peak's site /contact/ (matthew/clients/peak-pickleball/research.md); Apple Maps and BBB, audit 22 Oct 2026 (as in tour-confirmation-DRAFT.md) | Verified |
| Entrance from the parking lot off Jamboree Drive; no way in from inside Chapel Hills Mall | research.md: Peak's site /contact/ and the Gazette, 16 May 2024; coloradounderpar listing | Verified as of the research. **Peak should confirm nothing has changed.** |
| Peak's phone (719) 377-4725 | Apple Maps, BBB, Bing listings (audit 22 Oct 2026) | Verified |
| The hours: Mon, Wed, Fri 2–4 pm; Tue, Thu 8 am–4 pm; 30-minute slots | Matthew, 19 Nov 2026 (via the coordinator) | His instruction, not a claim |
| 24 hours' notice, 14 days ahead | Carried over from the Peak email's book-a-time defaults (18 Nov) | Desk setting |
| Sales emails need a postal address and a way to opt out; a reply-based opt-out is allowed | FTC, "CAN-SPAM Act: A Compliance Guide for Business" | From the guide as known; **not re-read online today** |
| "Mountain time"; times in America/Denver | The desk's own clock (America/Denver) | Verified |

**Corrected:** none.

**Left out:** prices, court counts, sizes and anything else about Peak. The booking page and the email footer only say where Peak is and
how to reach it. Whatever Cai writes in her own email is hers. The desk does not check it.

**Unresolved:**
- Whether Peak is open on the holidays (blocked dates are empty until you decide).
- Whether replies to a seller's Reply-To address reach them. Each seller should send one test to themselves after setting it.
