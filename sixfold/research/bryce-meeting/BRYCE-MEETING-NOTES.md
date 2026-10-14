# Meeting with Bryce: notes (365 Aeration & Seeding)

**Recording:** `bryce-meeting-2026-10.m4a`, 1 h 48 m. On the Zoom: Bryce (who runs an aeration-and-seeding business in **Houston**), Matthew, Jen, Brad and Brandon. Recorded on Matthew's desktop, October 2026.
**How this was made:** the audio was transcribed on this computer with Whisper (whisper.cpp v1.9.4, large-v3-turbo); nothing left the machine. The full text is in `transcript-raw.txt`, and `transcript-timed.txt` has a timestamp on each line.
**Read with care:**
- The transcript has no speaker names. Who said what is worked out from context.
- Whisper wrote prices as "$4.99" where Bryce clearly said **$499** (the context is "$1,200 an acre", "$500 job, I pay $100"). The notes use the corrected figures.
- From 1:46 to the end it repeats one line about 70 times. That stretch is a transcription glitch over background noise, after the meeting ended, and is ignored.
- **Every number below is Bryce's own figure from his Houston business** (Bermuda and fescue, Houston suppliers), unless it says otherwise. None of it is verified, and Denver costs differ: he says our seed costs about twice his.
- Jen's personal phone number was read out at 22:34. It is deliberately left out of these notes.

---

## 1. Pricing: how Bryce quotes

**He does not price per square foot, and says not to start.** He quotes by looking at the satellite picture and picking a price. "Nothing we do is based off of the size of your yard. It's based off of how much you're willing to pay." (51:27). Per-square-foot math lets customers "wreck you" (55:41–57:04).

His anchor prices:

| Job | His price | Where |
|---|---|---|
| Minimum job | **$299** | 1:15:21, 1:27:02 |
| Jen's yard, about 2,500 sq ft | **$399** | 56:56–57:08 |
| One acre lot (house included, so about ½ acre of grass, ~22,000 sq ft) | **$1,200** | 51:36, 55:53–56:01 |
| The ¾-acre Sixfold job the day before | $1,200 charged (Brad/Matthew); Bryce: "that's all right" | 1:18:09–1:18:15 |
| What he'd quote an acre at in person | about **$3,500** ("that's why my admin quotes, not me") | 1:00:45–1:01:11 |
| Upsell ceiling | an acre "as high as $12,000"; customers wanting it perfect pay $2,000 for a $1,200 lawn | 51:38, 58:24–58:37 |

- **The price ladder he talks in:** $299, $399, $499, $599, $699, $1,200, $2,000.
- **Budget objections:** ask "what is your budget?" A whole acre can be done for $399, but with less seed (51:15–51:27).
- **Travel:** price it in and never mention it ("it's 45 minutes away, you need to account for that; never mention that you're charging for that", 57:38–57:45).
- **More money means more seed and the same labour.** Seed and fertilizer are set per **$100 of sale**, not per square foot (49:24, 51:03, 57:51–58:17). Pay the crew more only when the lot is bigger, not when more seed goes down (58:38–59:05). He calls this "morally correct": two equal acres at $2,000 and $800 do not get the same seed (58:04–58:17).
- **Seed rate:** "never go below **2 lb of seed per 1,000 sq ft**", and rarely over 4 (1:38:38–1:38:56). **This agrees with CSU Extension (3–4 lb per 1,000 after aeration)**, already in our fact-check log.

### He came round to Matthew's automated version (1:25:56–1:29:20)

Bryce worked out the sliding scale himself:
- $1,200 ÷ 22,000 sq ft ≈ 5¢ a square foot;
- $399 ÷ 2,500 ≈ 16¢;
- $299 on 1,000 sq ft ≈ 30¢.

"If his algorithm can learn that when the yard is smaller, the price per square foot goes up, then yes, you guys can automate it." He suggested a minimum of about 1,000 sq ft.

**A starting curve from his three anchors (my arithmetic, not his):** price ≈ $399 × √(lawn sq ft ÷ 2,500), never below $299, rounded to his "…99" steps. It lands on his own numbers:

| Lawn (actual grass) | Curve | Rounded |
|---|---|---|
| up to ~1,800 sq ft | min | **$299** |
| 2,500 sq ft | $399 | **$399** |
| 4,000 | $505 | **$499** |
| 5,000 | $564 | **$599** |
| 7,500 | $691 | **$699** |
| 10,000 | $798 | **$799** |
| 15,000 | $977 | **$999** |
| 22,000 | $1,184 | **$1,199** |
| 30,000 | $1,382 | **$1,399** |

**This is a proposal to decide on, not a price list.** These are Houston anchor points, and it replaces Sixfold's "no flat aeration rate, quote the walk" rule, so Brandon should agree.

### The sod comparison (1:22:12–1:24:50)

Bryce's suggestion for Jen's screen: show what the lawn would cost to re-sod.
- **About $500 per pallet installed**, and a pallet covers **400 sq ft**. The pallet alone is about $250; "Jim charges up to a thousand".
- Examples: 2,500 sq ft is about $3,125 (he said "$3,100"); 10,000 sq ft is about $12,500.
- His line: "hire me twice a year for the next six years, it'll be the same price as sodding one time" (1:24:22–1:24:31).
- **Unverified:** these sod prices are his, and Denver figures need checking before we show them anywhere.

## 2. Crew pay (Bryce's system)

He pays **by the sale, not by the yard** (52:36–54:24):

| Job price | He pays the rep |
|---|---|
| $299 | $40 |
| $399 (front and back) | $65 |
| $499 | $100 |
| $599 and up | about $100, adjusted when a job runs long |

- **Long jobs get topped up.** He paid $150 for a "half acre" that turned out to be a full acre and took five hours, and still made money (59:33–59:56).
- **Service-plan visits** (seed, fertilizer and weed spray, no aeration) pay $30 (1:14:38–1:14:51).
- **His suggested alternative for Sixfold:** a flat **$50 per job**, since the average job takes about an hour (Brad said one to one and a half hours), plus a mileage or gas amount (1:09:20–1:10:05).
- **His example costs on a $399 job** (1:03:02–1:03:29): seed $75 ("half a bag of fescue"), fertilizer $25, rep $65, so $165 in costs and **$240 profit**. Before ads, insurance and the rest.
- **⚠ That doesn't add up at his own seed rate.** Half a 50 lb bag on 2,500 sq ft is about 10 lb per 1,000, against his "2 to 4 lb" rule. One of the two figures is off, or his bags aren't 50 lb. **Use Sixfold's own receipts, not this example.**

## 3. Seed and fertilizer

- **What Sixfold paid** (said in the meeting): **6 bags of fescue for $773** from **Arkansas Valley Seed**, about $129 a bag. SiteOne was about $200 a bag (1:01:47–1:02:01). A bag of fescue was also quoted at about $140; Bryce gets his for about $120 by the pallet (1:01:21–1:01:41).
- **Negotiate volume.** In season he goes through **2,000 lb of seed a week**. Ask for weekly pallets and delivery (1:02:05–1:02:20). His Bermuda costs him $220–250 against $500 retail.
- **Fertilizer:** a SiteOne rep offered to negotiate the price for Sixfold, and someone owes that rep a call (1:02:50–1:02:59).
- **Phosphorus:** Matthew raised Colorado's clay soils, high phosphorus and a zero-phosphorus blend like 14-0-14. Bryce uses one fertilizer all year and says the new seed uses it anyway (2:42–3:37). **Not verified;** check CSU guidance before it goes into any advice.

## 4. In the field

- **Dry, hard lawns** (Brad: the push aerator barely goes in and leaves no plugs, 1:10:13–1:10:44).
  - Bryce: **don't ask customers to water first**: "the more things you ask people to do before you show up gives them more reason to cancel" (1:10:53–1:11:10).
  - Instead, the crew turns the sprinklers on for 5–10 minutes when they arrive, lays seed and fertilizer meanwhile, and aerates last. "The order does not matter at all" (1:13:57–1:14:26).
  - Or Jen calls ahead: "flick your sprinklers on" (1:12:20–1:12:35).
- **⚠ This clashes with what we tell customers.** The landing page's "Good to know: water a couple of days before" (CSU-sourced), and Matthew's service agreement, both ask for watering. **Your call:** keep it, which is accurate and Brad's experience supports it, or soften it to "we'll run your sprinklers when we arrive".
- **⚠ Bryce:** "plugs are very rare… we're just trying to crack the surface… seed only needs to touch the ground" (1:11:14–1:11:44). **That contradicts CSU** ("most effective when actual cores are pulled"). Keep it out of anything customer-facing.
- **Water restrictions:** don't raise them up front; afterwards say "water what you can, be patient" (1:13:14–1:13:49).
- **Rain:** expect "it washed off" complaints. Keep the margin high enough to go back and redo a job (1:18:33–1:18:46).
- **Bigger properties water less**, so expect harder ground on them (1:12:06–1:12:20).
- **Closing rate:** from 22 form leads, he'd expect to close about **4**, depending on the season (17:34). That is his estimate.

## 5. Facebook and Instagram ads (from his ~$130,000 of ad spend, 45:02)

**The big one: run a Messages ad, not a lead form** (16:13–18:22, 1:19:27–1:20:16).
- With a lead form, Jen is cold calling, "you're going to lose 50% right off the bat", and the numbers aren't tied to a conversation.
- With a Messages ad, people tap and they're already talking to Jen, logged with their name, often from work.
- **A new Messages ad was built during the meeting.** Whether it went live was still open at the end. The website still brings form-style requests too.

Other ad rules:
- **Cost per message:** $8 seen on Sixfold's ad. Under $10 is "phenomenal for this business"; his own runs $8–17 (7:50–8:29, 9:08).
- **Never edit a live ad;** it restarts Facebook's learning. Rebuild it instead, even with a re-cut video after about 30 days. Ignore Facebook's "recommendations" (8:00–8:08, 10:47–11:14).
- **Where to work:**
  - **Build** ads in Meta Business Suite. He says building elsewhere "charges a 30% fee"; **not verified**.
  - **Watch** them in Ads Manager.
  - **Fix** them in the Ads Manager phone app (11:33–11:47).
- **"The bug":** within five minutes of going live, open the Ads Manager phone app and check that **Advantage+ placements** is on; he says it switches itself off (8:35–10:43, 29:09–29:20). This is his claim; it's quick to check.
- **Targeting:**
  - Centre the ad on the office (Hampden, Englewood) or the storage unit address, so the business looks real (26:28–27:05).
  - **24-mile radius**, the "algorithm sweet spot". People passing through the circle still count (27:24–27:56).
  - **Ages 33+** (Jen: 35–65 is who's responding).
  - Interests: gardening, landscaping, home and garden, real estate (28:00–28:58).
  - Run continuously; **$100 a day** (29:26–29:39).
  - Note: this differs from the **45-mile** service area Matthew gave for 365. Run the ad at 24 miles and serve 45.
- **Ad text:** put the phone number on its own line ("people don't read"). Facebook favours ads with a website (21:12–23:30).
- **Message set-up:** keep the preset greeting questions, turn the Messenger call invitation on, and leave **automated replies off** ("they know it's AI, they hate that"). Use saved replies for common questions (23:54–26:04).
- **Instagram:** about **40% of his customers come from Instagram**, so link it. Posting on Instagram also posts to Facebook, but not the other way round (23:42–23:49, 1:04:25–1:05:03).
- **Comments:**
  - Reply to every comment ("sent you a message"), then talk in Messenger, never in the comments.
  - Delete insults. Block repeat harassers with "block all pages". Don't block much otherwise.
  - Take angry conversations to the phone (4:30–6:47, 12:48–13:03, 17:05–17:15).
- **Content:**
  - Post every ad's video to the page, so the page doubles as the media library (33:48–34:04, 40:35–41:08).
  - Aim for about one post every two days. It can be as simple as Brad filming a yard and sending it to Jen (1:06:38–1:06:54).
  - Don't start videos on a black frame; it becomes the thumbnail (39:00–40:19).
- **Who controls the page:** **Jen as the only page admin**, so nobody can sabotage or delete it; field content goes to her to screen (15:38–16:03, 42:24–43:07, 1:04:34–1:04:54). Your personal Facebook is tied to the business account, so be careful what you say (14:14–14:31).

## 6. Phone, email, website, payments

- **Jen gets her own phone.** Brandon was getting one that day (1:17:05–1:17:41, 1:44:05). This is presumably **(720) 830-4553**.
- **Calls:** Business Suite calls come through Messenger, separate from her personal calls (24:54–25:07).
- **Payments: Square.** Invoices by email or text, tap to pay in person, cards on file, recurring service plans (1:36:44–1:37:58).
  - Take the deposit **by phone**, not over Messenger (1:35:47–1:36:41).
  - Jen gets the Square login.
  - Matthew: no in-house payment system until volume justifies it (1:37:09–1:37:38).
  - The new Square kit covers the branding.
- **Website:** Bryce's own site is "literally just a form" (43:53–44:01). aeration365.com is now live along those lines.

## 7. Ideas for the app

These were raised or promised by Matthew in the meeting. **None is built yet** unless it says so.

| Idea | Status |
|---|---|
| **Sod comparison** on the house lookup ("re-sodding this lawn would run about $X") | Easy. Needs Denver sod prices verified first. |
| **Quote generator:** price by lawn size on a sliding scale, travel built in silently, the crew's pay, and seed and fertilizer amounts | Waits on the price decision above |
| **Grass type** selection changing the seed cost | With the quote generator |
| **Morning dispatch text** to crew: address, client, number, "3 scoops of fertilizer, 6 scoops of seed" (50:41–51:01) | Fits the walk desk; could go on Brad's job card |
| **Crew pay per job plus mileage**, gas prices, the vehicle's mpg | Bigger. See the tracking note below. |
| **Instant quote on the website** ("fill it out, here's your quote") | Possible. Bryce warns that conversation sells better than forms. |
| **Scheduling in the style of Randy's spreadsheet** (blocking out time and areas, sent to Cai) | Matthew offered to build it in that format. **The spreadsheet isn't in this workspace yet.** |

**⚠ Tracking crews: check before promising.** In the meeting Matthew said the app already tracks where the crew goes (1:33:08–1:33:17). **What the app actually records** is each door marked, with its time, which shows the route after the fact.
- **The phone's GPS location is used on the phone only and never sent or stored.** That is what our draft Terms and Privacy Policy promise.
- **Tracking mileage or live position would be a new feature,** and would need the disclosure in the hiring documents that Matthew mentioned, plus an update to the privacy policy.

## 8. Claims NOT to repeat to customers

- **"No one else does aeration and seeding, it's literally just you guys"** (1:43:13). Not true of the Denver market. Never claim to be the only one.
- **"Grass grows within five days"** (1:15:53).
- **"Grass is the fastest-growing species, faster than bamboo"** (0:30).
- **"A 40×40 lawn offsets a family of four's carbon footprint for a year"** (0:44).
- **"Seed doesn't die, it waits in the soil"** (1:25).

All are unverified. Keep them out of ads, posts and the website.

## 9. Things to do, from the meeting

1. **Decide the 365 price model** (Matthew and Brandon): Bryce's eyeball method, or the sliding curve in §1. That unlocks the quote generator.
2. **Decide crew pay for 365 jobs** (Brad): a per-sale tier ($40 / $65 / $100) or a flat $50 per job plus mileage.
3. **Messages ad:** confirm it's live; check Advantage+ placements in the phone app; link Instagram; add the new number and aeration365.com to the ad text.
4. **Make Jen the only admin** on the 365 page, and add Matthew as ad manager, per Bryce.
5. **Arkansas Valley Seed:** ask for volume pricing and delivery. **Call the SiteOne rep** about fertilizer.
6. **Get Randy's scheduling spreadsheet** (from Cai) into the workspace if it should shape the scheduler.
7. **Water before the visit:** keep or change the landing-page tip (see §4).
