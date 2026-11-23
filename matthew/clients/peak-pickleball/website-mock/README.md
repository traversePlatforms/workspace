# Peak Pickleball: clickable website mock (draft, 23 Nov 2026)

Matthew Sharpe's own work for Peak. A clickable mock to show Tyler and Cammie before the platform decision on Mon 30 Nov 2026. It follows [website-plan-2026-11-23.md](../website-plan-2026-11-23.md) §3 (site map), §4 (conversion path) and §5 (must-haves). **Nothing on peakpickleball.us, WordPress, CourtReserve or Peak's shared Drive was changed.** Every page carries the banner "Draft mock for Peak, not the live site".

## Where it is

- **Private URL:** https://traverseplatforms.com/peak-site-mock-3384b5/ (sign-in code only in `~/.ssh/peak-mock-code.txt`, never in git or chat logs).
- **Server:** `public_html/peak-site-mock-3384b5/` holds only `index.php` (the gate, = `server/gate.php`) and `.htaccess` (= `server/htaccess.txt`). The pages, CSS, images and fonts sit outside public_html in `~/www/traverseplatforms.com/peak-site-mock-private/site/` (0700/0600), with `config.php` (the code's sha256 only) and `data/` (sessions, attempts). Same pattern as `/stats-54b859/`.
- **No indexing:** `<meta name="robots" content="noindex, nofollow, noarchive">` on every page; `X-Robots-Tag: noindex, nofollow, noarchive` from both the gate and `.htaccess`; `robots.txt` has `Disallow: /peak-site-mock-` (the prefix only, so robots.txt doesn't publish the full address). Not linked from anywhere. Backup of the old robots.txt: `~/upload-backups/robots.before-peak-mock-20261123.txt`.
- **Not signed in**, every path (pages and images) returns the sign-in form; 10 wrong codes per IP per 15 minutes.

**To update:** edit the files here, then upload `site` again (tar over `sg.sh trav`, as on 23 Nov) and re-check. To take it down: delete both folders on the server and the robots line.

## Pages

`index.html` (Home), `free-class.html` (the main conversion page), `memberships.html`, `play.html` (play schedule, leagues and tournaments, lessons and learning), `events.html` (upcoming events, private events, venue and expo rental, fundraisers, enquiry form), `sponsors.html` (Partner with Peak), and `coming-soon.html?p=<name>` for every other site-map item (PPU, FAQ, Fitness, Golf, Give 'Em Heaven, Amenities, Visit & Contact, Tournaments, privacy, terms, accessibility, About, Work with us).

Shared header (logo, menus, "Try a free class" and "Book now"), footer (address, hours, phone, emails, Instagram, Facebook, policy links), a working phone menu, and the fixed phone bar (Free class / Book / Call), all per plan §3. Forms are mock only: submit shows a note and sends nothing.

## Built for WordPress (Option B)

Plain HTML, one CSS file and 50 lines of JS: no framework, no build step. The header and footer are the same block on every page (becomes `header.php`/`footer.php` or block-theme template parts). Colours are CSS custom properties (map to `theme.json`). Buttons carry `data-event` names from plan §4 (`free_class_click`, `book_click`, `join_click`, `call_click`, `email_click`) ready for GA4 tagging. Forms name their inbox in `data-inbox` (Ninja Forms in the build). The pages were stamped once from a scratch script; edit the HTML directly from now on.

## Brand and assets (copied read-only from Cammie's "Peak Brand & Marketing Library")

Only `rclone lsf` / `copy` FROM the library with `--drive-shared-with-me`; nothing was written there.

| Used here | From library folder |
|---|---|
| `logo-fit-black.png`, `logo-fit-white.png`, `logo-slogan-white.png`, `favicon.png` (from the Swish) | Peak Branding / Peak Pickleball Brand Kit (Logo Fit Black/White, Peak Slogan White, Peak Swish Isolated Black). Resized only, transparent edges trimmed; not recoloured or altered |
| Colours #23C5E2, #1F3D67, #231F20, #5D6670, #BAC1C7, #F3F5F7, #FFFFFF | Peak_Pickleball_Branding_Package.xlsx, Color Palette tab |
| `hero-courts`, `class-group`, `junior-play`, `courts-in-play` | Play Types Content / Youth Clinic (IMG_8077, 8152, 8101, 8096) |
| `womens-play`, `members-smiles` | Play Types Content / Women's Play (IMG_4741, 4744) |
| `open-play-action`, `dupr-serve`, `players-laughing`, `sponsor-wall` | Tournaments / 5th Annual Veteran's Tournament / Day 2 Gender Doubles Content (_MG_0931, 0044, 0716, 0615) |
| `tournament-podium`, `adaptive-play` | Tournaments / Pike Peak or Bust Tournament (IMG_5724, 5779) |
| `neon-nights` | Events / Neon Nights / Neon Nights (IMG_4560) |
| `lounge-social`, `senior-group` | Holidays / Labor Day BBQ Bash (IMG_4396, 4403) |
| "No experience needed / No equipment needed / Bring your friends / Bring your family / All ages welcome" | Peak Branding / Intro to Pickleball / "Your First Class Is Free at Peak Pickleball.png" (the flyer's text only; its photo was not used) |

Photos are WebP, 900-1600 px wide, 37-191 KB each. Fonts: the brand sheet has no typography yet, so the mock uses the live site's own fonts (Golos Text headings, Inter body, from its Avada CSS), self-hosted woff2 from Google Fonts (OFL). Cammie decides.

Not used: "Random Peak Content" (an Air Force Academy event, not Peak's building); the Intro flyer photos and "ChatGPT Image" files (AI-made; plan §5 says real photos only).

**Photo permission (plan question 3):** these are Peak's own photos, but the people in them (including children in the Youth Clinic shots) haven't been confirmed as cleared for the website. Cammie to confirm before anything goes public; the class photo on the free-class page should be swapped for a real Learn to Play class.

## Fact-check log

**From peakpickleball.us, fetched 23 Nov 2026 (curl):**

| Fact | Page |
|---|---|
| 1730 Briargate Blvd, Colorado Springs, CO 80920; (719) 377-4725; open 7 days; Mon-Fri 7:00am-9:00pm, Sat-Sun 7:00am-8:00pm; info@, groupevents@, lessons@ addresses; Chapel Hills Mall between Dillard's and American Freight, enter from the parking lot off Jamboree Drive, no entrance from inside the mall | /contact/ |
| 24 courts; 4 championship 34'x64' with spectator seating; 19 recreational 32'x62'; 1 private court; 2 dink practice courts with full-width nets; two-level, air-conditioned; oversized concrete courts; spectator areas; noise-dampening; ADA accessible; guest Wi-Fi; event room for parties; ping pong; cornhole | /about/ |
| Every plan, price and feature on Memberships (Drop-In $12/h, Play $39 + $7/h, Flex $99 with Mon-Sat 12-5pm and Sunday, Unlimited $159, Platinum $199, Student $9 for 14-22, PPU $25 a class, booking windows 3/7/10/14 days, guest passes, BOGO and free Whistle Pig drinks, parking pass, 5% military/senior, Family Plan), and the fine print (4 h court/Open Play cancel, 24 h classes/clinics/lessons, check-in by QR or photo ID, payment at booking, court moves, guest pass rules and blackouts, no holds, annual non-refundable, re-joining at current prices) | /membership/ |
| Free intro class content (rules, court positions, key terminology, scoring; equipment provided); every play type description; the 9 CourtReserve list links | /play-pickleball/ |
| Guided Open Play: bridge from PPU to Open Play, light coaching, free, paddles and balls provided; its CR link | /guided-open-play/ |
| PPL: elite coed league, combine, drafted teams, Monday or Tuesday nights, standings, stats, playoffs; its CR links | /peak-premier-league/ |
| Loaner paddles; balls by sponsor Selkirk; ball machine $10/h with pickup tubes; reservations needed; account first; call the front desk for help | /faqs/ |
| Whistle Pig Brewing on site; free daily coffee "courtesy of Peak Pickleball" (Ziggi's not mentioned anywhere in the mock); The Kitchen seats up to 20 with tables, marker board, TV | /amenities/ |
| Multi-court rental $40 per court per hour, max 24 courts, add-ons $60/h (Kitchen, Golf Sim, Cornhole/Ping pong) | /multi-court-event/ |
| Court Sponsor items (6'x3' inner-court sign, medallions, 2 paddles + group lesson for 4); Title items (premium visibility, medallions, VIP events and mentions) | /partner-with-peak/ (prices left off, per plan proposal §3) |
| Sponsor names by tier; signs carry QR codes; many sponsors are local businesses | /peak-sponsors/ |
| Instagram and Facebook links; CourtReserve memberships link | Home page |

**From the plan (website-plan-2026-11-23.md):** the site map and menu structure; BOOK NOW link (CR public bookings); 4.9 stars from 587 Google reviews (Google Business Profile, 23 Nov); Starter $35 for Intro grads (CR sales data); partnerships@peakpickleball.us for sponsor forms; Title / Court / Logo tiers; the conflicts flagged below; the fixed phone bar; contrast rule (dark text on cyan).

**Copy written for the mock (not factual claims):** headings, intros and button labels. Lines that would have needed a source were cut: "thousands of active members" (live sponsor page; Peak's own data doesn't support it), "one of the largest privately owned indoor pickleball facilities", the expo's square footage and the April 2026 Senior Lifestyle Expo (not on Peak's site, brand files or the plan).

**Placeholders still waiting on Peak** (yellow brackets on the pages):
- Tyler: family court rate ($7 or $6); membership notice (cancel anytime / 15 / 30 days); Starter shown or not; Wellhub and app wording; annual payment wording; holiday hours; whether CR account approval is still needed for the free class; late-cancel fee on the free class; party, corporate and expo packages and prices; expo day rate, layout, load-in, nets; Member-Hold rules; lesson prices; who answers event enquiries and how fast; fundraiser terms. Tyler signs off every price.
- Cammie: headline and tagline; usual class days and times; what to wear; minimum age; the events list (Neon Nights dates etc.); Social Play description and CR link; whether Junior Play stays; sponsor logos and the current sponsor list; photo permissions.
- Brandon: final sponsor package contents, including Logo tier.
- League lead: season dates, levels, formats.
- Book a Pro booking link (the plan's "existing lesson link" wasn't on the pages fetched).

**Unresolved:** the Veterans Play CR link exists on /play-pickleball/ today (the plan said it had none); used as found.

## Checks run (23 Nov 2026)

- curl: gate page 200 with X-Robots-Tag; any path without a session returns the sign-in form; a wrong code gets 401; with the code (read from the file, never printed) all 7 pages, CSS, JS, images and fonts return 200 with the right types; unknown paths 404; robots.txt shows the prefix rule.
- Headless Chrome (CDP, signed in, 390 px wide): `tests/phone-index.png`, `tests/phone-free-class.png` (full page, phone bar hidden for the capture), `*-first-screen.png` (with the phone bar), `tests/phone-menu-open.png`. Desktop checked at 1440, 1280 and 1024 px. The phone menu shows below 1100 px.
- Not yet done: Lighthouse speed run and a full WCAG pass (plan week 4).
