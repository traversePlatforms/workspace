# Surge: holiday toy drive 2026, Facebook posts (DRAFTS)

**Status:** drafts only. Nothing posted, scheduled or queued. Each post goes into the posting calendar for Matthew to approve one at a time. Approval for one is not approval for the next.
**Source:** the toy drive brief Matthew pasted on 6 Nov 2026 (goal 1,500 toys by 23 Dec, partner, items, recipients, boxes at community outreach events 12-6 pm, campaign ideas, suggested caption).
**Page:** Surge Inc on Facebook only. Surge's Instagram is not linked to the posting token (checked 31 Oct). Captions work on Instagram too if that changes.
**Slots:** Mondays and Wednesdays, 3:00 pm Mountain, clear of the eight Tue/Thu November drafts. The last-day post goes at 9:00 am so people still have the afternoon.
**Register:** company ("we"). I read `brand-voice-company.md` and `brand/notes/RESTRICTED.md` before drafting.
**Files:** `posts/toy-drive-NN-*.png` (1080 x 1350), `contact-sheet.png`, `build-toy-drive.mjs`, `data.json` (counts, events and recipients: fill it in and run `node build-toy-drive.mjs`; anything missing renders in amber), `fact-check-log.md`.

## Matthew's calls, 6 Nov 2026

| Question | His call | What it means in the drafts |
|---|---|---|
| Name VAA? (a Surge client; RESTRICTED says clients are never named in text) | **Name VAA, with VAA's OK in writing** | Posts 1 and 14 name the Veterans Association of America as partner. **Both are on HOLD until VAA's email saying Surge may name them is on file.** Logged as a campaign-only revision in RESTRICTED.md. No VAA logo anywhere (the 2026-10-05 logo rule is unchanged). |
| Name the charities? | **Each one, once it confirms** | Until then every post says "local children's charities and families in need". Add a name to `data.json` → `recipients_confirmed` only after that organisation has agreed. |
| What to ask for | **New, unwrapped toys** (not "gently used") | Clothing and essentials are asked for new as well. |
| Where the posts go | **Extra days** | Mon/Wed series, 9 Nov to 28 Dec. The November Tue/Thu drafts are untouched. |

## Still needed before the series can run

1. **VAA's written OK** (one email) before post 1. If it isn't in by Monday morning, post 1 can run without the partner line (variant below), your call.
2. **The event list**: date and place for each drop-off event. Post 1's first comment and post 2 depend on it. Goes in `data.json` → `events`.
3. **Which charities have agreed.** Each name goes in only once confirmed.
4. **Weekly counts from a dated tally**: who counted, when. Each Monday post needs that week's number. I won't put in a figure without one.
5. **Photos for post 4** from the first events (see the photo rules in the flags).

## Photos (Matthew 6 Nov: use these first, before any graphic-only post)

Four WhatsApp photos from the drive's first days, moved off the Desktop to `surge/brand/photos/Toy drive 2026/`:

| File | Shows | Used in |
|---|---|---|
| `2026-11-02-rep-with-box-on-table-b.jpeg` | Rep beside the pink box on the table | Post 1 (announcement) |
| `2026-11-02-box-on-table-c.jpeg` | The box on the table, shop window behind | Post 2 (where to drop off) |
| `2026-11-02-rep-holding-box-a.jpeg` | Rep holding the box on the sidewalk | Post 3 (week one) |
| `2026-11-03-rep-with-gift-box-d.jpeg` | Man holding a wrapped gift prop, downtown street | Post 4 |

**What the crops leave out:** VAA's tablecloth logo, the "Stop Veteran Suicide" signs and the clipboard with a donor tally on it. All four photos have the tablecloth. The crops follow the no-client-gear rule (2026-10-05), and a sign-up tally is a Tier 2 number.

**What the crops can't leave out: the box's own printed poster.** It carries Surge's and VAA's logos, the logos of Children's Hospital Colorado, Boys & Girls Club, Brent's Place and "individual families", and the line "Bring new or slightly used items". At post size the charity logos are small but recognisable. Three questions for you:
1. **VAA's logo on the poster** is client branding in a photo. Is it OK for this campaign, given VAA is named in the text anyway?
2. **The charity logos** say who benefits before each charity has confirmed with us. Did the office confirm them when it printed the poster? If so, the captions can name them too.
3. **"New or slightly used"** on the poster vs "new, unwrapped" in the captions. Either the captions go back to the poster's wording, or the team swaps the poster.

**Also to check:** where photo d was taken (a downtown street with a "General Store 45" sign). It should run only if it's one of this drive's events. Also check that the three people shown are OK being posted. Post 3 has a passer-by far in the background, too small to identify.

## The series at a glance

| # | Date | Kind | Image | Holds on |
|---|---|---|---|---|
| 1 | Mon 9 Nov, 3 pm | Announcement | 1,500 goal, what to bring | VAA written OK, events |
| 2 | Wed 11 Nov, 3 pm | Where to drop off | Event list | Events |
| 3 | Mon 16 Nov, 3 pm | Week one tally | Count, meter, 37 days left | Count |
| 4 | Wed 18 Nov, 3 pm | The team at the boxes | Real photo | Photo, count |
| 5 | Mon 23 Nov, 3 pm | Week two tally | 30 days left | Count |
| 6 | Wed 25 Nov, 3 pm | Thanksgiving challenge | One toy for every seat | Count (image) |
| 7 | Mon 30 Nov, 3 pm | Week three tally | 23 days left | Count |
| 8 | Mon 7 Dec, 3 pm | Week four tally | 16 days left | Count |
| 9 | Wed 9 Dec, 3 pm | Two weeks left | Countdown | Count, events left |
| 10 | Mon 14 Dec, 3 pm | Week five tally | 9 days left | Count |
| 11 | Wed 16 Dec, 3 pm | Final week | Last events | Events, count |
| 12 | Mon 21 Dec, 3 pm | Week six tally | 2 days left | Count |
| 13 | Wed 23 Dec, 9 am | Last day | Today | Today's event, count |
| 14 | Mon 28 Dec, 3 pm | Thank you | Final count, recipients | VAA written OK, final count, recipients |

Hashtags on every post: `#ToyDrive #HolidayGiving #GiveBack #Colorado` (post 6 swaps `#HolidayGiving` for `#Thanksgiving`). First comment carries the event list where a post points to it.

---

## 1. Mon 9 Nov, 3:00 pm: the announcement (HOLD for VAA's written OK)

**Image:** `posts/toy-drive-01-announce.png`

**Facebook caption:**
> We're running a holiday toy drive with the Veterans Association of America, and the goal is 1,500 toys by December 23.
>
> Everything collected goes to local children's charities and families in need. [RECIPIENTS: name each one here once it has agreed to receive.]
>
> What we're collecting:
> New, unwrapped toys
> New clothing for kids
> Holiday items and family essentials
>
> Drop-off boxes are at our community events from 12 to 6 pm. Dates and places are in the comments.
>
> Who's the first person you'd ask to bring one?
>
> #ToyDrive #HolidayGiving #GiveBack #Colorado

**First comment:** the event list, one line each: `Sat 14 Nov, <venue, town>, 12-6 pm`.

**Variant if VAA's OK isn't in by Monday:** first sentence becomes "We're running a holiday toy drive, and the goal is 1,500 toys by December 23." Image: rebuild with the partner line removed (one line in `build-toy-drive.mjs`).

**Alternate hooks:**
- The brief's own opener: "1,500 toys. One community. One big goal." Kept because it came from the office. Three fragments in a row is slogan cadence, which the voice spec steers away from, so it's an option, not the default.
- "1,500 toys by December 23. That's the goal for our holiday toy drive with the Veterans Association of America."

**Lines cut from the brief, and why:**
- "make the holidays magical" and "spread a little extra joy": warm, but it's the vibes register the voice spec (§5) asks culture posts to avoid. The goal and the date carry the post instead.
- "New or gently used": your call, new and unwrapped only.
- "Children's Hospital Colorado, Boys & Girls Clubs, Brent's Place": held until each confirms (your call).
- 🎄🎁❤️: the spec says emoji sparingly. If you want one, 🎁 after the first sentence.
- "Whether you donate one toy or ten, every contribution brings us closer to our goal": fine, just long. Usable to lengthen the post.

---

## 2. Wed 11 Nov, 3:00 pm: where to drop off

**Image:** `posts/toy-drive-02-where-to-drop-off.png` (event rows fill from `data.json`)

**Facebook caption:**
> Here's where to find our toy drive boxes. Every event runs 12 to 6 pm.
>
> [EVENTS: one line each, e.g. Sat 14 Nov, <venue, town>]
>
> Bring a new, unwrapped toy, new clothing for kids, or holiday essentials, and drop it in the box. Our team is there all afternoon.
>
> Which one's closest to you?
>
> #ToyDrive #HolidayGiving #GiveBack #Colorado

**Alternate hook:** "Three places to drop off a toy this month." (only if there are three.)

---

## Weekly tallies (posts 3, 5, 7, 8, 10, 12)

**Images:** `posts/toy-drive-03-week-1.png` and the others. The count, the meter and "to go" fill in from `data.json` → `counts`; "days left" is worked out from the post's date.

**Rule for every tally:** the number comes from the team's dated count. If the drive is behind pace, the post says the real number plainly. No rounding up, no "almost there" unless it is.

### 3. Mon 16 Nov: week one (37 days left)
> One week in: [COUNT] toys toward our goal of 1,500. That leaves [TO GO], with 37 days to go.
>
> Thank you to everyone who has dropped one off so far. Next boxes: [NEXT EVENTS].
>
> What toy did you want most as a kid?
>
> #ToyDrive #HolidayGiving #GiveBack #Colorado

### 5. Mon 23 Nov: week two (30 days left)
> Two weeks in: [COUNT] of 1,500 toys, and 30 days left.
>
> Next boxes: [NEXT EVENTS]. Thanksgiving is Thursday, and we have a challenge for it on Wednesday.
>
> Who's hosting this year?
>
> #ToyDrive #HolidayGiving #GiveBack #Colorado

### 7. Mon 30 Nov: week three (23 days left)
> Three weeks in: [COUNT] of 1,500 toys. [TO GO] to go, and December starts tomorrow.
>
> Next boxes: [NEXT EVENTS].
>
> What's one toy you'd put in the box?
>
> #ToyDrive #HolidayGiving #GiveBack #Colorado

### 8. Mon 7 Dec: week four (16 days left)
> Week four: [COUNT] of 1,500 toys, with 16 days left.
>
> Next boxes: [NEXT EVENTS]. New, unwrapped toys, new clothing for kids, and holiday essentials all count.
>
> What's on your list to pick up this week?
>
> #ToyDrive #HolidayGiving #GiveBack #Colorado

### 10. Mon 14 Dec: week five (9 days left)
> Nine days left, and we're at [COUNT] of 1,500 toys.
>
> Next boxes: [NEXT EVENTS].
>
> Who are you bringing with you?
>
> #ToyDrive #HolidayGiving #GiveBack #Colorado

### 12. Mon 21 Dec: week six (2 days left)
> Two days left: [COUNT] of 1,500 toys. The last boxes are out [LAST EVENTS].
>
> What are you dropping off?
>
> #ToyDrive #HolidayGiving #GiveBack #Colorado

---

## 4. Wed 18 Nov, 3:00 pm: out at our events

**Image:** `posts/toy-drive-04-at-the-boxes.png`, photo d (man with the gift prop). Headline "Out at our events": the photo shows a gift prop, not a drop-off box, so it doesn't claim the boxes are filling.

**Facebook caption:**
> Out at our events this month with the toy drive. This is [NAME or "our team"] at [EVENT] on [DATE].
>
> [ANECDOTE: one real thing from the box, e.g. what someone dropped off and why. Leave the slot empty rather than invent one.]
>
> [COUNT] toys so far toward 1,500. Next boxes: [NEXT EVENTS].
>
> What should go in the box next?
>
> #ToyDrive #HolidayGiving #GiveBack #Colorado

**Photo rules (RESTRICTED.md, unchanged by this campaign):**
- **No children** in frame (your own exclusion). Toy drives draw families, so check every frame.
- **No client shirts, banners, table covers or signage**, VAA's included (2026-10-05 rule). Naming VAA in the text doesn't lift it. If you want VAA gear allowed for this drive, that's a separate call.
- No identifiable members of the public who haven't agreed. Everyone shown OK with it.

---

## 6. Wed 25 Nov, 3:00 pm: Thanksgiving challenge

**Image:** `posts/toy-drive-06-thanksgiving-table.png`

**Facebook caption:**
> A Thanksgiving week challenge: count the chairs at your table tomorrow, and bring that many new, unwrapped toys to one of our toy drive boxes before December 23.
>
> Eight seats, eight toys. Two seats, two toys. Every one goes to local children and families in need.
>
> How many seats are at your table this year?
>
> #ToyDrive #Thanksgiving #GiveBack #Colorado

**Cut:** "tag a friend" and "share to challenge someone". Facebook demotes posts that ask for tags or shares (Meta's engagement-bait rules), so the challenge asks for a toy, not a tag.
**Note:** Surge's Thu 26 Nov November draft is the thank-you post. The two sit fine together.

---

## 9. Wed 9 Dec, 3:00 pm: two weeks left

**Image:** `posts/toy-drive-09-two-weeks-left.png`

**Facebook caption:**
> Two weeks left. We're at [COUNT] of 1,500 toys, with [TO GO] to go before December 23.
>
> The remaining boxes: [EVENTS LEFT].
>
> Who are you bringing along?
>
> #ToyDrive #HolidayGiving #GiveBack #Colorado

---

## 11. Wed 16 Dec, 3:00 pm: final week

**Image:** `posts/toy-drive-11-final-week.png` (last events from `data.json`)

**Facebook caption:**
> Final week. These are the last places to drop off a toy before December 23, all 12 to 6 pm:
>
> [FINAL EVENTS]
>
> We're at [COUNT] of 1,500.
>
> Which day works for you?
>
> #ToyDrive #HolidayGiving #GiveBack #Colorado

---

## 13. Wed 23 Dec, 9:00 am: last day

**Image:** `posts/toy-drive-13-last-day.png`

**Facebook caption:**
> Today is the last day of our holiday toy drive. The boxes are at [TODAY'S EVENT] from 12 to 6 pm.
>
> We're at [COUNT] of 1,500.
>
> What are you bringing?
>
> #ToyDrive #HolidayGiving #GiveBack #Colorado

**Cut:** "Every toy goes out before Christmas". We don't know when the charities hand them out. Add it only if a recipient tells us.

---

## 14. Mon 28 Dec, 3:00 pm: thank you (HOLD for VAA's written OK)

**Image:** `posts/toy-drive-14-thank-you.png`

**Facebook caption:**
> Thank you. Our holiday toy drive with the Veterans Association of America closed on December 23 with [FINAL COUNT] toys[, plus clothing and holiday essentials].
>
> They went to [CONFIRMED RECIPIENTS].
>
> Thank you to everyone who dropped something in a box, and to our team at every event.
>
> What should we do differently next year?
>
> #ToyDrive #HolidayGiving #GiveBack #Colorado

**If the drive finishes short of 1,500:** say the real number and thank people for it. Don't change the goal after the fact or round up.

---

## Flags (checked against RESTRICTED.md and brand-voice-company.md)

1. **VAA is a client, named on your call.** RESTRICTED.md's client-naming rule now has a campaign-only revision (6 Nov). Posts 1 and 14 wait for VAA's written OK. No VAA logo on any image.
2. **The standing test.** If the toy boxes sit at the same booths where reps sign people up as monthly donors, a reader who already suspects the worst could read the drive as a way to draw people to the sign-up. Keeping the toy boxes visibly separate from any sign-up ask avoids that reading. Your call.
3. **Charities named only when confirmed.** Children's Hospital Colorado has its own in-kind donation process and wish list. Boys & Girls Clubs of Metro Denver runs its own holiday toy drive with published guidelines. Someone should ask each one before its name goes in, and ask what they accept. See `fact-check-log.md`.
4. **New, unwrapped only.** The team running the boxes needs to know, since the brief said "gently used". Decide what happens if someone brings a used toy anyway.
5. **No tax-deduction language.** Surge is a for-profit. Whether VAA issues receipts for in-kind gifts is unknown, so the posts say nothing about deductions.
6. **Counts need a source.** Every number is a Surge metric under the voice spec §2: it needs a scope (this drive), a date and a record someone can pull.
7. **Platform deviations, flagged:** captions run 40-90 words (the Facebook precedent, not LinkedIn's 150-200); 4 hashtags on Facebook (as in the November set); event lists go in the first comment, and no links in captions.
