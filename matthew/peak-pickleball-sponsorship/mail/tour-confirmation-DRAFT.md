# Tour confirmation email: DRAFT for Matthew to approve (19 Nov 2026)

Matthew's ask, 19 Nov: "when for example, cai books a tour using our app for the peak desk that it send an email automatically to that persons email that she puts in stating when the meeting is etc so they have an email notification that they can connect to their calendar".

**Status: built, OFF.** Nothing has been sent to anyone. The switch is in the Peak desk under More › Settings › Tour confirmation emails. It is admin only and stays Off until you turn it on. You can also change the wording there (Save, Preview, Go back to the first wording).

**Who sends it:** your Peak Outlook (matthewsharpe@peakpickleball.us), through the Peak email sender's existing Microsoft connection. The email is signed with the name of the person who booked the tour, so replies come to your Peak inbox.

**What triggers it:**
- Someone books a tour (sponsors: Meeting / tour booked; expo: Tour booked) with the contact's email, and "Send a confirmation email to ..." is still ticked.
- Moving the tour sends the new time: same invite, updated.
- Cancelling the tour sends a cancellation and withdraws the invite.

**When it is never sent:**
- There is no email on the booking.
- The person is marked Don't contact.
- The booker unticked the box.
- The switch is Off.

Below is the email exactly as the code writes it. The example is made up: Cai books Jamie Polson (jamie@example.com) of "Sample Company" for Tuesday 24 Nov, 2:30 pm, 30 minutes.

## 1. The confirmation

**Subject:** Confirmed: your visit to Peak Pickleball, Tuesday, November 24 at 2:30 pm

```
Hi Jamie,

This confirms your visit to Peak Pickleball.

When: Tuesday, November 24, 2:30 pm Mountain time (30 minutes)
Where: Peak Pickleball, 1730 Briargate Blvd, Colorado Springs, CO 80920
Entrance: from the parking lot off Jamboree Drive. We're connected to Chapel Hills Mall, but there is no way in from inside the mall.
You'll meet: Cai Silva

A calendar invite is attached so you can add it to your calendar. If you need to change the time, reply to this email or call Peak at (719) 377-4725.

Thanks,
Cai Silva
Peak Pickleball
```

The email goes as plain text plus the same words in simple HTML. It has no open-tracking image and no tracked links.

## 2. When the tour is moved

**Subject:** Updated: your visit to Peak Pickleball, Wednesday, November 25 at 10:00 am

The body is the confirmation with the new time, plus this line after "Hi Jamie,":

```
The time has changed. The new details are below, and the calendar invite is updated.
```

## 3. When the tour is cancelled

**Subject:** Cancelled: your visit to Peak Pickleball, Tuesday, November 24 at 2:30 pm

```
Hi Jamie,

Your visit to Peak Pickleball on Tuesday, November 24 at 2:30 pm Mountain time is cancelled, and the calendar invite is withdrawn.

If you'd like to find another time, reply to this email or call Peak at (719) 377-4725.

Thanks,
Cai Silva
Peak Pickleball
```

## 4. The calendar invite (invite.ics, attached and inline)

- **UID:** one per tour, so Gmail and Outlook show "Add to calendar" and update the same event.
- **SEQUENCE:**
  - 0 when booked.
  - Goes up by one each time the tour is moved.
  - Goes up again when it is cancelled. The cancellation goes out as `METHOD:CANCEL` / `STATUS:CANCELLED`.

```
BEGIN:VCALENDAR
PRODID:-//Peak Pickleball//Peak desk//EN
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VTIMEZONE
TZID:America/Denver
X-LIC-LOCATION:America/Denver
BEGIN:DAYLIGHT
TZOFFSETFROM:-0700
TZOFFSETTO:-0600
TZNAME:MDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0600
TZOFFSETTO:-0700
TZNAME:MST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:peak-tour-3f9a1c0d2e@traverseplatforms.com
DTSTAMP:20261119T222423Z
SEQUENCE:0
DTSTART;TZID=America/Denver:20261124T143000
DTEND;TZID=America/Denver:20261124T150000
SUMMARY:Visit to Peak Pickleball (meeting Cai Silva)
LOCATION:Peak Pickleball\, 1730 Briargate Blvd\, Colorado Springs\, CO 809
 20
DESCRIPTION:You'll meet Cai Silva.\nEntrance: from the parking lot off Jam
 boree Drive (no way in from inside Chapel Hills Mall).\nPeak: (719) 377-47
 25\nTo change it\, reply to the email this came with.
ORGANIZER;CN="Peak Pickleball":mailto:matthewsharpe@peakpickleball.us
ATTENDEE;CN="Jamie Polson";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP
 =TRUE:mailto:jamie@example.com
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR
```

## Things to decide before turning it on

1. **The wording above.** Edit it in Settings if you want; the date, time and address fields can't be removed.
2. **Signed by the booker, sent from your mailbox.** The From line shows your Peak Outlook, and replies land in your inbox, not Cai's. Forward them to whoever booked the tour.
3. **"Accepted" answers.** When someone accepts the invite, their calendar's "Accepted: ..." note comes to your Peak inbox. The outreach sender ignores these: they are not counted as replies.
4. **Test first.** Settings has "Send me a test": type your own Gmail address and it sends the sample visit now, even while the switch is Off. Check the email shows "Add to calendar" before you turn it on. This could not be tested here because nothing was sent to a real mailbox. One point is still unknown: whether Microsoft keeps the invite as a proper meeting invite when the email goes out through Graph.

## Fact-check log

| Claim in the email | Source | Status |
|---|---|---|
| 1730 Briargate Blvd, Colorado Springs, CO 80920 | Peak's site /contact/ (matthew/clients/peak-pickleball/research.md); Apple Maps and BBB listings, audit 22 Oct 2026 | Verified |
| Entrance from the parking lot off Jamboree Drive; no way in from inside the mall; connected to Chapel Hills Mall | research.md: Peak's site /contact/ and the Gazette, 16 May 2024. coloradounderpar listing: "entrance from the Jamboree Drive lot" | Verified as of the research. **Peak should confirm nothing has changed.** |
| Peak's phone (719) 377-4725 | Apple Maps, BBB, Bing listings (audit 22 Oct 2026) | Verified |
| "Mountain time"; the invite in America/Denver with daylight-saving rules | US rules: second Sunday of March, first Sunday of November | Verified |
| Length "30 minutes" | Default when the booker doesn't pick one (15 min to 2 hours in the form) | Desk setting, not a claim |

**Corrected:** none.

**Left out:**
- Courts, size, events and prices. A confirmation doesn't need them, and nothing unconfirmed goes to a customer.
- Parking details beyond the entrance.

**Unresolved:** whether Microsoft delivers the invite as a meeting request when it is sent through Graph. The test send answers that.
