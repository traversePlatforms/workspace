# Peak Pickleball as an expo and event venue: prospects and research

Checked 12 November 2026. Matthew's ask (12 Nov): "Need to congregate people who might want to rent out Peak's 80,000 sq ft property in a mall for expos and things like that."

This is Matthew's own client work for Peak, not Surge's, so Surge's voice specs and RESTRICTED.md don't apply. Nothing here has been sent, and nobody has been contacted or signed up. Every contact route in the 12 Nov list is the organisation's own published general route: a contact page, a general or events email, or a main phone. The 13 Nov contacts add named people, using only the business details their organisations or named outlets publish (see "Contacts (13 Nov)"). No people-search sites or LinkedIn were used for either.

Files:
- `prospects.csv`: 64 organisations, one row each, sorted by priority then category.
- `Peak-Venue-Prospects-2026-11.xlsx`: the same list, plus a sheet of competing venues and rates. Built by `build_xlsx.py` from the CSV. Since 13 Nov it also has a "Best contact (13 Nov)" column and a Contacts sheet, both from `contacts.csv`.
- `contacts.csv` (13 Nov): named contacts, 80 rows covering all 64 organisations. See "Contacts (13 Nov)" below.
- `hunter-queue-2026-11-22.csv` (13 Nov): 41 organisations to run through Hunter when credits reset on 22 Nov.
- `Peak-Venue-Prospects-2026-11.pdf`: the readable landscape version. `build-pdf.cjs` writes `venue-prospects.html`, then headless Chrome prints it to PDF.

## Summary

1. **Peak has already hosted an expo.** Pikes Peak Senior News held its 4th annual Senior Lifestyle Expo at Peak on Saturday 18 April 2026, 9 am-2 pm. Its own page puts it at "Peak Pickleball Center, Chapel Hills Mall", with "over 100 business sponsors, nonprofits, and veteran resources" and "Full-Sized Pickleball Courts & Demos". So expos on Peak's floor are possible in practice. How it was laid out around the nets is the first question for Peak (see below), and the organiser is a rebooking and a reference, not a cold prospect.
2. **The square footage holds up, with one caveat.** The building is 80,380 sq ft on two levels (El Paso County Assessor records, via the Gazette). That is the building's total over two floors, not one open exhibit hall, and the courts cover a lot of it (see below).
3. **Most expo business in Colorado Springs goes to two venues.** Norris Penrose Event Center (southwest, Lower Gold Camp Rd) and the Colorado Springs Event Center (east, 3960 Palmer Park Blvd) host the home shows, holiday markets, cons, bridal shows, gun shows, consignment sales and job fairs. Neither publishes its rates. Several promoters already move between them (Nationwide Expos, Colorado Cosmic Con, Villain Arts, the Gazette's Senior Life Expo), so venue loyalty is weak. None of the regular expo venues found is on the north side, where Peak is.
4. **The best fits are short, booth-based shows that don't need vehicles or open rings.** Examples: one-day senior, bridal and job expos; wellness and fitness expos; two- or three-day craft, holiday and home shows. Dog shows, RV shows and anything that needs open floor are long shots if the nets stay up.
5. **Pricing is the open commercial question.** Peak's published multi-court rate is $40 per court per hour (max 24 courts). At that rate the whole building costs $960 an hour, which is $7,680 for an 8-hour day (arithmetic from Peak's page, not a quote). The only published rate for a comparable hall nearby is Douglas County Fairgrounds' James R. Sullivan Events Center at $3,000 a day. Peak would need a separate expo or day rate to compete.

**Count by category (64 total: 24 priority 1, 22 priority 2, 18 priority 3)**

| Category | Rows | P1 | P2 | P3 |
|---|---|---|---|---|
| Craft, holiday & vintage markets | 9 | 4 | 3 | 2 |
| Hobby, collectibles & gun shows | 8 | 1 | 6 | 1 |
| Comic, anime, gaming & esports | 6 | 1 | 2 | 3 |
| Youth, school & sports | 6 | 1 | 2 | 3 |
| Chambers & business associations | 4 | 1 | 1 | 2 |
| Consumer & lifestyle expos | 4 | 1 | 2 | 1 |
| Vehicle, RV & outdoor shows | 4 | 1 | 2 | 1 |
| Corporate planners, DMCs & tourism | 3 | 1 | 2 | 0 |
| Job fairs & career expos | 3 | 1 | 1 | 1 |
| Military & defence | 3 | 0 | 0 | 3 |
| Pet & animal shows | 3 | 2 | 0 | 1 |
| Senior expos | 3 | 2 | 1 | 0 |
| Bridal & family expos | 2 | 2 | 0 | 0 |
| Fitness & wellness expos | 2 | 2 | 0 | 0 |
| Home & garden shows | 2 | 2 | 0 | 0 |
| Nonprofit & community fairs | 2 | 2 | 0 | 0 |

Priority: 1 = a recurring indoor show in Colorado Springs or north El Paso County that rents its venue and could plausibly move or add a date. 2 = a good fit but smaller, further away, or with a catch noted in the row. 3 = a long shot (needs open floor, tied to a hotel or arena, a caution flag, or no contact route found).

## The square footage

| Claim | Finding |
|---|---|
| "80,000 sq ft" | **Verified as about right:** 80,380 sq ft on two levels, from El Paso County Assessor records as reported by the Gazette (16 May 2024, updated 21 Jun 2025). Peak's own site doesn't give a figure; it says "spacious, two-level, air-conditioned facility". |
| One open floor? | **No.** Two levels: 11 courts upstairs and 13 downstairs (Gazette 2024; KRDO Oct 2024 says "24 courts on two stories"). The split of square footage between levels isn't published. |
| How much is court? | From Peak's own court sizes, 4 championship courts at 34 x 64 ft (8,704 sq ft) plus 19 recreational courts at 32 x 62 ft (37,696 sq ft) come to about **46,400 sq ft of court surface**, before the private court and 2 dink courts. That is roughly 58% of the building. This is my arithmetic from the About page, not a published figure. |
| Other spaces | "Event Room for parties", "dedicated spectator areas", championship courts "with spectator seating" (About page). In 2024 the Gazette described an area for corporate parties and "a separate, fenced-off area adjacent to courts that could be rented by businesses and individual groups". |
| Mall connection | "Connected to the Chapel Hills Mall between Dillard's and American Freight". Entry is from the parking lot off Jamboree Drive; "there is no entrance from inside the mall" (Contact page). Mall shoppers don't walk in, and an expo's visitors don't walk out into the mall. |
| Parking | "Free parking also will be available in the mall's parking lot" (Gazette, May 2024). Peak's current site doesn't mention parking. |
| Nets and floor | The About page says "professionally surfaced and maintained OVERSIZED concrete courts" and "2 dink practice courts w/full width nets". **No current public page says the nets are permanent.** Our 21 Oct research file records "permanent nets and lines", but no current public page I checked on 12 Nov confirms it. Treat it as a question for Peak. |
| Loading access | No source mentions a dock, freight door, or elevator between levels. Question for Peak. |

## Limits and questions for Peak

These are open because no public source answers them.

1. **The April 2026 senior expo:** were the 100+ vendors on the courts, between them, or in other spaces? Did nets come down? What did Peak charge, and is 2027 booked? The answers settle most of the questions below.
2. **Nets:** are the posts fixed in the concrete, or can nets come down for an event? How long does it take, and who does it?
3. **Floor:** can booths, pipe and drape, carpet, pallet jacks or vehicles go on the coated court surface? Are there weight or tape rules?
4. **Loading:** is there a dock or a large freight door, and where? How do exhibitors get stock to the upper level? Is there an elevator?
5. **Capacity:** what is the fire-code occupancy for each level? What do promoters need from the fire marshal or Pikes Peak Regional Building for booth layouts?
6. **Mall and landlord rules:** does the lease limit event types (gun shows were raised), signage, hours, alcohol, or after-hours use of the lot? How many parking spaces sit near the Jamboree Drive entrance?
7. **Power, Wi-Fi, restrooms, food:** what is the booth power capacity? Can outside caterers come in, or only the Kitchen add-on? Is alcohol allowed, and under whose licence?
8. **Time:** which days could Peak close one level, or the whole building, without hurting members? Multi-day sales (consignment, gift shows) need 3-5 days including set-up.
9. **Price:** what is the day rate for a full buyout or a single level, versus the published $40/court/hour? What deposit and insurance certificate does Peak require from promoters?
10. **Who books:** is groupevents@peakpickleball.us the right inbox for promoters, and who answers it?

## Competing venues and published rates

Only first-party pages are used. "Not published" means the venue's own page says rates are on request, or shows none.

| Venue | Space (as published) | Rate | Source, date seen |
|---|---|---|---|
| **Norris Penrose Event Center**, 1045 Lower Gold Camp Rd (the venue's own pages also say 945) | Not on its own pages; Villain Arts' show page cites "40,000 square feet of exhibitor space on main level" | Not published (tours and rental enquiries via the site; info@norrispenrose.com, 719-635-1101) | norrispenrose.com/site-tours-event-booking, 12 Nov 2026 |
| **Colorado Springs Event Center**, 3960 Palmer Park Blvd | Not on its own pages (Cvent lists Hall A 42,000 and Hall B 50,000 sq ft, about 93,000 combined: not first-party) | Not published (events@cseventcenter.com, 719-637-3960) | coloradospringseventcenter.com and /promoters, 12 Nov 2026 |
| **Broadmoor World Arena** | 19,500 sq ft column-free floor; 26,000 sq ft concourse; 56,000 sq ft outdoor apron | "Facility rental rates are available upon request" | broadmoorworldarena.com/arena-info/book-the-arena, 12 Nov 2026 (Tech Packet 2025) |
| **Douglas County Fairgrounds**, Castle Rock | Indoor Arena 50,400 sq ft (2,000 seats); Sullivan Events Center size not given (29,000 sq ft per a KUNC caption, secondary) | Sullivan Events Center **$3,000/day** + $1,000 deposit; Indoor Arena $1,500/day + $500; Kirk Hall $600/day; whole fairgrounds $4,500/day + $4,000; conference room $60/hr; **35% off for 501(c)(3)s**; surcharges may apply | douglasco.gov rental-fees-overview and available-facilities, 12 Nov 2026 (policies "updated October 2025"). Older county pages show $2,000/day; the fees-overview page is the current one |
| **Jefferson County Fairgrounds**, Golden | Exhibit Halls 1-3: 10,440 sq ft total | Halls 1-3 together: $1,440 standard, $908 community, $375 youth/ag/Jeffco (per-day basis not stated; "for reference only") | jeffco.us/1800/Exhibit-Halls, last updated 23 Dec 2025, seen 12 Nov 2026 |
| **Pueblo Convention Center** | 17,507 sq ft exhibition hall, divisible into 3 | Not published (enquiry form) | puebloconventioncenter.com/about-us, 12 Nov 2026 (via search; figure on own site) |
| **Colorado State Fairgrounds**, Pueblo | Events Center about 3,000 capacity | Not published (sales and rental manager); not rentable in August and September | coloradostatefair.com, 12 Nov 2026 (search summary of own pages; not fetched directly) |
| **El Paso County Fair & Events Complex**, Calhan | Not confirmed on a first-party page | No current rate sheet found (only a 2019 sheet and a 2023 guide) | elpasoco.com documents, 12 Nov 2026 |
| Hotels used by these events (Great Wolf Lodge, The Antlers, DoubleTree, Hotel Polaris, Cheyenne Mountain Resort, The Broadmoor) | n/a | Not published | n/a |
| **Peak itself** | 24 courts | Multi-court event **$40/court/hour**; add-ons (Kitchen, golf sim, cornhole/ping-pong) $60/hour each; max 24 courts | peakpickleball.us/multi-court-event, 12 Nov 2026 |

## Fact-check log

Checked 12 Nov 2026 unless stated. "Verified" means seen on the source named. Rows marked "fork A/B" were checked by the two research agents that built parts of the list; their full notes are summarised here.

| Claim | Source | Date | Verdict |
|---|---|---|---|
| Peak building 80,380 sq ft on two levels, former Burlington, next to Dillard's | Gazette, gazette.com/business/pickleball-complex-colorado-springs/article_5dcd2cc4-1312-11ef-bf69-3f5225f0743a.html (citing El Paso County Assessor) | Published 16 May 2024, updated 21 Jun 2025 | Verified (secondary, citing assessor records) |
| Peak site gives no square footage; "two-level, air-conditioned facility" | peakpickleball.us/about/ | 12 Nov 2026 | Verified |
| 24 courts: 4 championship 34x64, 19 recreational 32x62, 1 private, 2 dink courts; concrete | peakpickleball.us/about/; Springs Magazine 1 Oct 2024 | 12 Nov 2026 | Verified |
| Nets are permanent | research.md (21 Oct 2026) says so; About and FAQ pages do not | 12 Nov 2026 | **Unresolved**: not confirmed on any current public page |
| No entrance from inside the mall; enter from the lot off Jamboree Dr | peakpickleball.us/contact/ | 12 Nov 2026 | Verified |
| Free parking in the mall lot | Gazette 16 May 2024 | 2024 | Verified (2024 plan) |
| Multi-court event $40/court/hour, add-ons $60/hour, max 24 courts; no policies on page | peakpickleball.us/multi-court-event/ | 12 Nov 2026 | Verified |
| Court surface about 46,400 sq ft (excluding private and dink courts) | Arithmetic from the About page's court sizes | 12 Nov 2026 | Calculation, not a published figure |
| Senior Lifestyle Expo held at Peak, 18 Apr 2026, 9-2, 100+ vendors, run by Pikes Peak Senior News | pikespeakseniornews.com/senior-lifestyle-expo-2026/ (own page); Gazette calendar 15 Mar 2026; Pikes Peak Hospice blog | 12 Nov 2026 | Verified, three sources. The Gazette listing gives socoseniorconnect.com and a truncated phone ending 1971, which matches Pikes Peak Senior News' line |
| 2025 Senior Lifestyle Expo at 4 S. Cascade Ave | seniorsbluebook listing (fork A/B) | 12 Nov 2026 | Address verified; "The Antlers" is an inference and is left out |
| Rocky Mountain State Games pickleball held at Peak | A search summary claimed it | 12 Nov 2026 | **Contradicted** (fork B): the 2025 listing names The Springs (Powers); 2026 was at Springs Pickleball |
| COS Health & Fitness Expo: 150+ exhibitors; next 21-22 Aug 2027 at Great Wolf Lodge | cosfitnessexpo.com | 12 Nov 2026 | Verified |
| Fitness Expo held 22-23 Aug 2026 and 23 Aug 2025 at Great Wolf Lodge | VisitCOS, Gazette, CPR listings | 12 Nov 2026 | Verified from listings; sources disagree on the edition count |
| Peak's sponsor page links cosfitnessexpo.com | research.md fact-check (21 Oct 2026) | 21 Oct 2026 | Verified then; not rechecked |
| Springs Home Show 13-15 Nov 2026 at Norris Penrose by Nationwide Expos; next Colorado Springs show 8-10 Jan 2027 | thespringshomeshow.com | 12 Nov 2026 | Verified; the Jan 2027 venue is not stated on that page (FestivalNet places a Jan 2027 show at the CS Event Center) |
| Nationwide Expos used the CS Event Center in Oct 2025 | Eventbrite listing (via search) | 12 Nov 2026 | Secondary; consistent with listings |
| L&L Colorado Springs Home & Garden Show, Norris Penrose, 5-7 Feb 2027 | homeshowcenter.com/details/coloradospringhome2 | 12 Nov 2026 | Verified; Feb 2026 dates from listings only; aggregators conflict on 2027 dates, own site wins |
| Colorado Country Christmas Gift Show 13-15 Nov 2026 at CS Event Center, produced by Marketplace Events | coloradogiftshow.com | 12 Nov 2026 | Verified; 225 exhibitors and 8,000 shoppers (2024 press) not on own site, left out |
| Holiday Food & Gift Festival 4-6 Dec 2026, Norris Penrose, Springtime Productions | hfgf.com | 12 Nov 2026 | Verified; one aggregator credits Showcase Productions, own site wins |
| Vintage Market Days Colorado Springs 20-22 Nov 2026, Norris Penrose | vintagemarketdays.com/market/colorado-springs | 12 Nov 2026 | Verified |
| Candy Cane show 12-13 Dec 2026, organiser CSLE, about 160 vendors | Norris Penrose calendar; Zeffy listings; venue's old event page (now 404) | 12 Nov 2026 | Dates verified on the venue calendar; organiser and vendor count secondary |
| Colorado Cosmic Con 14-15 Nov 2026, Norris Penrose; run by volunteers | coloradocosmiccon.com and /about | 12 Nov 2026 | Verified; Mar 2025 at CS Event Center from search summary of a Gazette photo page |
| Colorado Springs Comic Con 21-23 Aug 2026 at Broadmoor World Arena; Altered Reality Entertainment | broadmoorworldarena.com/events/detail/comiccon26; cscomiccon.com footer | 12 Nov 2026 | Verified. One aggregator labels the CS Event Center "Altered Reality Event Center"; no other source supports it, so treated as an aggregator error |
| Colorado Bridal & Wedding Expo by American Consumer Shows, 31 May 2026 and 8 Nov 2026 at CS Event Center | Gazette 30 May 2026; CS Event Center calendar | 12 Nov 2026 | Verified; acsshows.com doesn't list the Colorado Springs show on its home page |
| BMSE Colorado Springs Apr and Oct 2026 at Norris Penrose | Norris Penrose calendar (Oct); listings (Apr) | 12 Nov 2026 | October verified on the venue calendar; April from listings |
| Pinners Conference Colorado 25-26 Sep 2026 at Norris Penrose; 24-25 Sep 2027 | Norris Penrose calendar; pinnersconference.com | 12 Nov 2026 | Verified |
| JBF Colorado Springs 19-21 Nov 2026 at CS Event Center | jbfsale.com/coloradosprings/ | 12 Nov 2026 | Verified; a search summary also gave a Sep 2026 pop-up that the page didn't show, so it's left out |
| Women's Expo 7-8 Nov 2026 at Norris Penrose; Donnell Productions; vendor complaints | Norris Penrose calendar; KOAA News5 Investigates (undated); tradeshowz (2025 organiser) | 12 Nov 2026 | Date verified; organiser for 2026 inferred from 2025; complaint article undated |
| Villain Arts tattoo festival: 40,000 sq ft main level; 27-29 Aug 2027 at Norris Penrose; 2025 at 3960 Palmer Park Blvd | villainarts.com show page; VisitCOS | 12 Nov 2026 | Verified; the 2026 venue conflicts between listings and is left open |
| Tanner Gun Show schedule incl. Colorado Springs 9-10 Jan 2027 | tannergunshow.com | 12 Nov 2026 | Verified |
| Pikes Peak Card Show 7 Nov 2026 at Norris Penrose | Norris Penrose calendar | 12 Nov 2026 | Verified; organiser not confirmed |
| Kennel club cluster 22-25 Oct 2026 at Norris Penrose; 700-1,000 entries | Norris Penrose calendar; Gazette 23 Oct 2025 | 12 Nov 2026 | Verified; no club website confirmed |
| Ski swap drop-off 16 Oct 2026 at Roy J. Wasson campus; Oct 2025 swap there | rockymountainskiswaps.com/colorado-springs; Gazette 14 Oct 2025 | 12 Nov 2026 | Verified |
| Douglas County Fairgrounds rates | douglasco.gov rental-fees-overview | 12 Nov 2026 (policies updated Oct 2025) | Verified; older county pages show lower figures ($2,000/day): superseded |
| Jeffco exhibit hall rates | jeffco.us/1800/Exhibit-Halls | Page updated 23 Dec 2025 | Verified; per-day basis not stated |
| Broadmoor World Arena floor sizes; rates on request | broadmoorworldarena.com book-the-arena | 12 Nov 2026 | Verified |
| CS Event Center hall sizes about 90,000-93,000 sq ft | Cvent and directories | 12 Nov 2026 | Secondary only; directories conflict (40,000 to 100,000); left out of the comparison |
| Douglas County Sullivan Events Center 29,000 sq ft | KUNC photo caption, 16 Oct 2025 (fork B) | 2025 | Secondary |
| Fork A: gem show 5-7 Jun 2026 (own site), Expo Pros 2027 dates, RJ Promotions Oddity shows, Colorado Super Show 2027, TECO 2027, All C's Apr 2026, Record Show Nov 2026, Megafest Jul 2026, Castle Rock quilt festival May 2026, Colorado Anime Fest 2027, ISE Jan 2026/2027, BeaconFest 15 Oct 2026 | Each organiser's own site or the outlet named in the row | 12 Nov 2026 | Verified as listed in each row's source column |
| Fork A: Show Me Reptile Show exact Sep 2026 days; Front Range Makers Market 2026 dates; Turco Spirit contact; Tacticon 2026 dates | Listings only, conflicting, or page gone | 12 Nov 2026 | Unresolved; rows say so |
| Fork B: PPWFC fairs (incl. 10 Nov 2026 Community & Veterans Job Fair at CSEC, up to 150 employers); Veterans Expo 10 Jun 2026; FIRST regional 5-8 Mar 2026; Spirit Sports 24-25 Jan 2026 at the arena; Hiring Our Heroes 17 Sep 2026 | ppwfc.org; elpasoco.com; D11 release and Gazette; varsity.com; army.mil | 12 Nov 2026 | Verified |
| Fork B: Veterans Expo vendor count 60+ vs 100+; PPORA job fair 18 vs 19 Feb 2026; AASC 2026 show at Hotel Polaris | County vs KOAA; two PPORA pages; CPR listing | 12 Nov 2026 | Conflicts left in the rows; AASC is secondary only |
| Dropped: Silver Key Senior Summit, Piecing Partners Quilt Guild, Anime Onsen, Springs RetCon, Pikes Peak Gamers (final year 2026), Repticon Denver, SoCo Card Show, SoCo Horror Con, Mystic Boho Vintage Extravaganza, Wild West Home & Handmade Expo, Gothic Market, Brick Convention, 9Health Fair, Imprint Events Group | Could not confirm a 2025/2026 date, the organiser, or a Colorado Springs presence from a reliable source | 12 Nov 2026 | Left out |
| Searched, found nothing usable: church/ministry conferences with expo halls; Pikes Peak REALTORS expo; HBA indoor show (Parade of Homes is in model homes) | Searches (fork B) | 12 Nov 2026 | A gap in the list, not proof none exist |

Outside this list but worth knowing: the Colorado Roofing Association trade show was at the Arapahoe County Fairgrounds on 29 Jan 2026 (aggregator only). The Colorado Senior Games (5-7 Jun 2026, Colorado Springs) include pickleball, so they would book courts, not an expo floor.

## Contacts (13 Nov)

Matthew's ask (13 Nov): find the right named person at each organisation to pitch a venue rental to, with business contact details, so outreach can start. Nothing has been sent, and nobody has been contacted. No forms were submitted.

### Method

Work went in priority order. Four research passes ran in parallel (P1 rows 1-12, P1 rows 13-24, P2, P3), each to the same written brief. Sources were checked in this order:
1. The organisation's own pages: about, team, staff, contact, exhibitor, vendor and press pages, plus footers.
2. Press releases (PR.com, EIN Presswire, PR Newswire) and named outlets: the Gazette, KOAA, KRDO, FOX21, KOA, KUNC, Deseret News, Springs Magazine and army.mil.
3. Event listings that name the organiser (Colorado Gives, FairsAndFestivals, tabletop.events, the venue calendars), used only to point back to a primary source.

The rules held throughout:
- No people-search sites, no LinkedIn and no email-finder API. The Hunter account has 0 credits until 22 Nov.
- No personal cells, home addresses or private emails, unless the organisation itself publishes that address as its contact. Seven addresses are org-published consumer accounts, marked "published by the org" in the notes:
  - Gmail: Front Range Makers Market, CSLE, Villain Arts, Colorado Record Show, CSCA and AFCEA Rocky Mountain's conference VP.
  - Comcast: All C's.
- Every name, email and phone traces to a page that was read. The few taken from search snippets are marked low confidence and say so.
- Names whose only source is older than about two years are kept, flagged "stale (year)" and marked low confidence.
- One email is inferred from a pattern: Karen Hogan at the Gazette, "pattern, unverified". The pattern is first.last@gazette.com, shown by april.borjon@gazette.com on a 4 Jun 2026 Gazette page. It is not used as the Gazette's best contact.
- Where sources conflicted, the detail was left out and the conflict recorded in the row's notes.

I re-read seven of the strongest leads myself on 13 Nov, and all matched what the research passes recorded:
- Pikes Peak Senior News about page
- Marketplace Events show-team page
- RJ Promotions Colorado Springs show page
- Visit COS meetings page
- CS Chamber & EDC staff page
- Tri-Lakes Chamber contact page
- ISE contact page

`contacts.csv` columns are: priority, organisation, best contact (yes on one row per organisation), contact name, role, business email, email status, business phone, other route, source URL(s), source date, confidence, notes. The best contact is the strongest row for that organisation: a named person first, then a direct email, then confidence. There is one judgement override. Altered Reality's best contact is the organisers, Steven and Connie Perry, not their press contact.

### Counts (by organisation, using the best route found for each)

"Direct email" means the address is the person's own, such as Terri@ or kelleyz@. A shared inbox (info@, vet@, an org-published gmail) counts as a general route, even when a named person sits behind it.

| Priority | Named person + direct email | Named person + general route | General route only | Total |
|---|---|---|---|---|
| 1 | 6 | 15 | 3 | 24 |
| 2 | 1 | 15 | 6 | 22 |
| 3 | 6 | 8 | 4 | 18 |
| **All** | **13** | **38** | **13** | **64** |

- **P1 with a direct email:**
  - Pikes Peak Senior News (Anne Jensen, publisher)
  - Tri-Lakes Chamber (Terri Hayes, plus Ashley Maniscalco)
  - Visit COS (Dina Worthen, Cheryl McCullough, Kim Griffis)
  - Marketplace Events (Jenna Naffin, plus Christie Elig)
  - Dana Cain Events (Dana Cain)
  - RJ Promotions (Kelley Zwick, show manager, plus Kevin Hummer)
- **P1 general route only:** American Consumer Shows, The Expo Pros, L&L Exhibition Management. The Gazette has a general route plus the stale, pattern-only Karen Hogan.

### Leads to move on first

1. **Anne Jensen**, Publisher, Pikes Peak Senior News. Anne@pikespeakseniornews.com, (719) 321-1971. She ran the April 2026 expo at Peak, so this is a rebooking for 2027.
2. **Terri Hayes**, President & CEO, Tri-Lakes Chamber. Terri@trilakeschamber.com, with Ashley@trilakeschamber.com (Event Coordinator) copied; (719) 481-3282. Their expo is sold out at the Tri-Lakes YMCA, and the chamber is about 10 miles north of Peak.
3. **Kelley Zwick**, Show Manager, RJ Promotions. kelleyz@rjpromotions.com, (816) 558-6069. Next Colorado Springs show is the Oddity & Bizarre Expo, 20-21 Mar 2027, at the CS Event Center.
4. **Jenna Naffin**, Show Manager, Colorado Country Christmas Gift Show (Marketplace Events). JennaN@mpeshows.com, 484.854.9084. The show runs 13-15 Nov, so wait until after load-out.
5. **Dana Cain**, producer, Dana Cain Events. dana@danacainevents.com, 303-347-8252. She runs two Colorado Springs events a year at Norris Penrose: Cat Fest and the Chocolate & Cheese Fest.
6. **BEACON Senior News**: no named person. Booth line 719-900-7664. beaconfest.com lists a Colorado Springs BeaconFest "coming 2027" (spring), with no venue set yet.
7. **Dina Worthen**, Director of Sales, Visit COS. Dina@VisitCOS.com, 719-685-7632. For sports bookings: **Cheryl McCullough**, Cheryl@VisitCOS.com, 719-685-7642. Visit COS refers planners to venues.
8. **Michelle Alt**, Director, CSLE (Candy Cane Showcase, plus May and August shows). csladiesevents@gmail.com (published by the org), 719-231-5970.
9. **Sandi Griffin**, founder, COS Health & Fitness Expo. contact@cosfitnessexpo.com, 719-246-6705. Peak's sponsor page already links the expo.
10. **Craig Carle**, VP Membership, Marketing & Events, CS Chamber & EDC. ccarle@cscedc.com, 719-575-4329. Copy **Lisa Martinez**, lmartinez@cscedc.com. They are priority 3 as a venue prospect, but this is a direct line to the events lead.

### Hunter queue (22 Nov)

`hunter-queue-2026-11-22.csv` lists 41 organisations that have no named person with a direct email, but do have a domain worth searching. They are ranked by priority, then by how likely Hunter is to help. Where a person is already named, the queue suggests an Email Finder call for that person; otherwise a Domain Search with a department filter. That uses about 41 of the 50 monthly credits.

Two notes on domains:
- gazette.com and coloradospringschamberedc.com were already searched for the sponsor list (`../data/hunter-results.json`). The chamber's staff addresses turned out to be published on cscedc.com, so it needs no search.
- Ten organisations have no domain Hunter can search: Front Range Makers Market, Vintage Market Days, CSLE, Turco Spirit Events, All C's, Colorado Record Show, Pikes Peak Card Show, CSCA, the Coin Club and the Kennel Club. They have gmail, comcast or Facebook routes, or none at all. Reach them through their published routes instead.

### Fact-check log (13 Nov)

**Verified** (own current page, 2026):
- **Named contacts:**
  - Visit COS sales and sports team
  - Marketplace Events show team
  - RJ Promotions show manager and CEO
  - Pikes Peak Senior News publisher and managing editor
  - Tri-Lakes Chamber staff
  - CS Chamber & EDC events staff
  - ISE contact page (Brent Layng, John Caulfield). These emails were decoded from Cloudflare-protected links, so check the spelling before use.
  - Dana Cain (decoded the same way)
  - CHSAA (Rashaan Davis, esports)
  - Tacticon (Andre'a Arnold)
  - AASC (Codi Foley, Laura Nelson)
  - Destination Colorado (Kelly Layton)
  - RMC (Javier Munoz)
  - CSLE (Michelle Alt)
  - Pikes Peak Outdoors (Becky Leinweber)
  - PALS Chess (the McConnells)
  - TECO (Elizabeth Maline)
  - Black Forest guild (Amanda Kennedy)
  - YMCA (Jeremy Strom)
  - BMSE (Steve Strickland, Katie Wright)
  - Show Me Reptile Show (Micky Meyer)
- **Confirmed by a dated 2025-2026 outlet:**
  - Lisa Cooper, gem show chair (Gazette, 4 Jun 2026)
  - Crystal LaTier, interim ED at the Workforce Center (Gazette, 17 Jun 2026)
  - Deborah Hendrix (PR Newswire, Jan 2025)
  - Sol Lee (Gazette, 13 Nov 2025)
  - Sandi Griffin (Springs Magazine, Aug 2026)
  - Debbie English (KOA, Apr 2026)
  - Lissa Shaw (Gazette, Oct 2025)
  - Jon Dix (KXRM, Jan 2025)

**Corrected** (the 12 Nov list was wrong or out of date; details in each row's notes):
- **American Consumer Shows:** the listed acsshows.com/contact-choice/ page has no contact details. The Colorado Springs show has its own site, bridalshowsco-co.com, with exhibitor line 888-433-3976. Its Contact Us page is an unfilled template, so don't use the placeholder number or email.
- **Pikes Peak Workforce Center:**
  - The employer inbox is ppwbrg@elpasoco.com.
  - CEO Traci Marques left in June 2026; Crystal LaTier is interim.
- **Veterans Services:** elpasoco.com/veterans-expo/ now returns 404. The 4 Feb 2026 announcement (elpasoco.com/?p=19735) still loads.
- **Parents Challenge:** the route was unverified on 12 Nov. It is info@parentschallenge.org and 719-306-8557, from the org's Colorado Gives profile.
- **Dana Cain:** she runs two Colorado Springs events a year, not one (Chocolate & Cheese Fest, 4 Apr 2026).
- **Show Me Reptile Show:** it is a Troy, Missouri company running about 25 shows a year. Its email domain is showmereptileshows.com, with an s.
- **RJ Promotions:** no Colorado Springs RV show is on its current schedule; its RV shows are in Kansas. Its Colorado shows are the Oddity & Fear Fest (Sep) and the Oddity & Bizarre Expo (Mar 2027), both at the CS Event Center.
- **JBF:** the sale runs three times a year, and the listed route is a corporate form.
- **Vintage Market Days:** the local inbox is coloradosprings@vintagemarketdays.com.
- **BMSE:** its own site shows no upcoming Colorado Springs date. The Gazette lists 10-12 Apr 2026 as the 2026 show, so the Oct 2026 date on the 12 Nov list is unconfirmed.
- **LANFest:** the 2026 event did happen, 24-27 Sep at the Douglas County Event Center.
- **Villain Arts:** it does publish a contact: TattooedKingpin@gmail.com and 215-423-4780.
- **RMC:** its own site is rmcdmc.com.
- **CSLE:** its own site is csladiesevents.com, and it runs shows in May and August as well as the Candy Cane show.
- **PPORA:** it is now Pikes Peak Outdoors. ppora.org redirects to pikespeakoutdoors.org, and the inbox is info@pikespeakoutdoors.org.
- **CSCA:** it does publish ColoradoCSCA@gmail.com.
- **BEACON Senior News:** a Colorado Springs BeaconFest is announced for spring 2027.
- **Donnell Productions:** the site is womenslivingexpo.com, with phone 203-259-3351.
- **Tacticon:** andrea@gamergirlgames.com is a business-domain address the org publishes, so it is usable.
- **CHSAA and Varsity Spirit:** routes are now verified.
- **CS Chamber & EDC:** staff addresses are on cscedc.com.

**Unresolved:**
- **Stale or unconfirmed names; confirm before using them:**
  - Stephanie Floyd, HFGF (2022-23). How she relates to Springtime Productions isn't stated anywhere.
  - Bethany Oliver, Vintage Market Days (about 2022).
  - Karen Hogan, Gazette (2023).
  - Scott Schulz, Motorcycle Expos (Mar 2024).
  - Barbara Donnell, Donnell Productions (undated KOAA piece, probably 2022). KOAA also reported vendor complaints about attendance.
  - Erica Romero, Workforce Center (one undated KOAA article).
  - Roxanne Bennett, Pinners Conference (2023).
- **Conflicts:**
  - CSCA: the Board page says Earle Wikle is President, but 2026 posts are signed by Kevin McConnell as President.
  - Pikes Peak Outdoors: the page shows (719) 247-5828, but its tel: link dials (719) 575-4311.
  - Motorcycle Expos: the coloradosupershow.com links go to info@coloradomotorcycleexpo.com and 303-835-6967, not the events@ and 720-674-8999 shown as text.
  - Marketplace Events: Hannah Bergey's mailto link points to NicoleP@mpeshows.com.
  - L&L Shows: one PDF prints 800-374-6364 against 800-374-6463 everywhere else.
  - Show Me Reptile Show: its own page now lists Widefield High School, but the Gazette's Sep 2026 listing says the CS Event Center.
- **Couldn't read on 13 Nov:**
  - Blocked by a bot check: hfgf.com, cosfitnessexpo.com. Their routes are carried over from 12 Nov.
  - Returned 403 to every request: spacefoundation.org, spacesymposium.org, coloradofirst.org, parentschallenge.org, beaconseniornews.com. Thomas Dorame (Space Foundation) is from search snippets only.
  - nationwideexpos.com returned empty pages.
  - Tanner Gun Show and Totally Rad Vintage Fest render by script, so no text came through.
- **No usable contact found:** Pikes Peak Card Show (Facebook only), the Coin Club, the Quilt, Craft & Sewing Festival (Rusty Barn), and Turco Spirit Events (phone from a search snippet only).
- **Left out on purpose:**
  - A Kennel Club event chair's aol.com email and phone (snippet only, personal domain).
  - A 719 number tied to Lisa Cooper (likely personal).
  - Names seen only in search snippets of 403 pages (Westword, CPR, Issuu).
- **Check before pitching:**
  - Altered Reality: a Gazette snippet says the 2018 Colorado Springs Comic Con was at Chapel Hills Mall.
  - Sports Corp: the Rocky Mountain State Games pickleball director works for Springs Pickleball, a competitor. Pitch through Shelbi Lowery instead.
