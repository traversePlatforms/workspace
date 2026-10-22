"""Peak Pickleball sponsor leads, employer list and price comparison (2026-10-21, Matthew: "start step 1").

Builds Peak-Sponsor-Leads-2026-10.xlsx beside this folder. Every row carries its source; the Fact-check sheet lists what was
verified, corrected and left unresolved. Nothing here is sent anywhere: Brandon works the sheet and makes the calls.
Run: python build_leads.py
"""
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

OUT = Path(__file__).resolve().parent.parent / 'Peak-Sponsor-Leads-2026-10.xlsx'
CHECKED = '2026-10-21'

SC = 'https://www.coloradospringssports.org/current-members'
CC = 'https://cochamber.com/event/2024-annual-pickleball-tournament'
ACFR = 'https://epc-assets.elpasoco.com/wp-content/uploads/sites/2/2024-ACFR-FINAL-reduced-size.pdf'
OCC = 'https://occ-ortho.com/community-outreach-and-sponsorship/'
OCC26 = 'https://occ-ortho.com/exclusive-healthcare-partner-for-colorado-springs-sports-social-in-2026/'
ALP = 'https://www.alpinebank.com/custom/fi/alpinebank/fb/disclosure/Sponsorship_Request_Form_Front-Range.pdf'
UCH = 'https://www.aol.com/articles/uchealth-awards-218-000-grants-014454931.html'

# --- sponsor leads: company, kind, why they fit, source, route in, priority (A best) ---
SC_T = 'Colorado Springs Sports Corp member, 2026 ({}) tier: pays to back local sport'
LEADS = [
    ('Alpine Bank', 'Bank', SC_T.format('Summit') + '.', SC, 'Front Range sponsorship request form (to its Denver office; asks 60 days ahead). The form may be dated: confirm the current contact first.', ALP, 'A'),
    ('UCHealth (Memorial Hospital; Memorial North)', 'Hospital system', 'No. 4 employer in El Paso County (7,050 staff, 2024). Gives through community grants (southern Colorado grants announced in UCHealth news).', ACFR + ' ; ' + UCH,
     'Community and government affairs, southern Colorado (the senior director is named in UCHealth news releases). Also an employee-membership target (see Employers).', UCH, 'A'),
    ('BOK Financial', 'Bank', SC_T.format('Premier') + '.', SC, 'To find', '', 'A'),
    ('Concept Restaurants', 'Restaurant group', SC_T.format('Premier') + '.', SC, 'To find', '', 'A'),
    ('Neon Pig', 'Creative agency', SC_T.format('Premier') + '.', SC, 'To find', '', 'B'),
    ('OrangeTheory', 'Fitness', SC_T.format('Premier and Essential') + '. Fitness, not racquet sport: a cross-promotion partner more than a buyer.', SC, 'To find (franchise: the local owner decides)', '', 'B'),
    ('Laborjack', 'Moving / labor', SC_T.format('Premier') + '.', SC, 'To find', '', 'B'),
    ('Republic Services', 'Waste and recycling', SC_T.format('Premier') + '.', SC, 'To find', '', 'B'),
    ('KEG1', 'Beverage distributor', SC_T.format('Premier') + '.', SC, 'To find', '', 'B'),
    ('Cheyenne Mountain Resort', 'Resort', SC_T.format('Summit') + '. Check first whether it runs its own courts (could be a competitor).', SC, 'To find', '', 'C'),
    ('Coca-Cola', 'Beverage', SC_T.format('Essential') + '. Also a pouring-rights deal for Peak’s snack bar, if Peak has one.', SC, 'To find', '', 'B'),
    ('Windstar Studios', 'Video production', SC_T.format('Summit') + '.', SC, 'To find', '', 'B'),
    ('Baker and King', 'Not checked', SC_T.format('Essential') + '.', SC, 'To find', '', 'C'),
    ('BCA', 'Not checked', SC_T.format('Essential') + '.', SC, 'To find', '', 'C'),
    ('Dwire Earthmoving, LLC', 'Construction', SC_T.format('Essential') + '.', SC, 'To find', '', 'C'),
    ('Randy R Kilgore & Company', 'Not checked', SC_T.format('Essential') + '.', SC, 'To find', '', 'C'),
    ('Spartan Barbell', 'Fitness', SC_T.format('Essential') + '.', SC, 'To find', '', 'C'),
    ('Spartan Strength Systems', 'Fitness', SC_T.format('Essential') + '.', SC, 'To find', '', 'C'),
    ('Summit Group Consultants', 'Consulting', SC_T.format('Essential') + '.', SC, 'To find', '', 'C'),
    ('Altitude Movement', 'Fitness / movement', SC_T.format('Essential') + '.', SC, 'To find', '', 'C'),
    ('Mind Quest Puzzles and Games', 'Retail', SC_T.format('Essential') + '. Family audience.', SC, 'To find', '', 'C'),
    # media: trade (ads for exposure) as much as cash
    ('The Gazette', 'Media', SC_T.format('Summit') + '. Media partner: ad space in trade for exposure, or event coverage.', SC, 'To find', '', 'B'),
    ('Colorado Media Group', 'Media', SC_T.format('Summit') + '. Media partner, as above.', SC, 'To find', '', 'B'),
    ('Cumulus Media', 'Radio', SC_T.format('Premier') + '. Media partner, as above.', SC, 'To find', '', 'C'),
    ('iHeart Media', 'Radio', SC_T.format('Premier') + '. Media partner, as above.', SC, 'To find', '', 'C'),
    # networks: introductions, not cheques
    ('Colorado Springs Chamber & EDC', 'Business network', SC_T.format('Premier') + '. Introductions to members and a venue for a member event at Peak.', SC, 'To find', '', 'B'),
    ('Southern Colorado Women’s Chamber of Commerce', 'Business network', SC_T.format('Premier') + '. Host a member mixer at Peak.', SC, 'To find', '', 'C'),
    ('Hispanic Chamber of Commerce', 'Business network', SC_T.format('Essential') + '. Host a member mixer at Peak.', SC, 'To find', '', 'C'),
    # companies that already paid to sponsor pickleball (statewide, 2024)
    ('Kaiser Permanente', 'Health insurer / care', 'Paid sponsor of the Colorado Chamber’s 2024 pickleball tournament (Pickle Hour and awards) at the Broadmoor.', CC, 'To find (statewide marketing; check for a Colorado Springs community contact)', '', 'A'),
    ('Molson Coors', 'Beverage', 'Court sponsor, Colorado Chamber 2024 pickleball tournament at the Broadmoor.', CC, 'To find', '', 'B'),
    ('PCL Construction', 'Construction', 'Court sponsor, Colorado Chamber 2024 pickleball tournament.', CC, 'To find', '', 'B'),
    ('McLane Company', 'Distribution', 'Court sponsor, Colorado Chamber 2024 pickleball tournament.', CC, 'To find', '', 'C'),
    ('Climax Molybdenum', 'Mining', 'Court sponsor, Colorado Chamber 2024 pickleball tournament.', CC, 'To find', '', 'C'),
    ('Chord Energy', 'Energy', 'Court sponsor, Colorado Chamber 2024 pickleball tournament.', CC, 'To find', '', 'C'),
    ('Great Range Bison', 'Food', 'Court sponsor, Colorado Chamber 2024 pickleball tournament (name read from its web link; the logo text was unclear).', CC, 'To find', '', 'C'),
    # large employers near Peak: sponsorship and group memberships together
    ('T. Rowe Price', 'Financial services', 'Large campus at 2220 Briargate Pkwy, near Chapel Hills Mall. Over 670 staff in 2008 (old figure). Group memberships first, sponsor second.', 'T. Rowe Price locations page and 2008 release (via search; see Fact-check)', 'To find (HR / benefits for memberships)', '', 'A'),
    ('Ent Credit Union', 'Credit union', 'Headquartered in Colorado Springs; about 1,300 staff (Gazette, 2021). Big local sponsor profile.', 'Gazette 2021 (via search; see Fact-check)', 'To find', '', 'A'),
    ('USAA', 'Insurance / banking', 'Large Colorado Springs campus; about 1,800 staff in 2017 (old figure). Military families: Peak’s neighbourhood.', 'Area Development 2017 (via search; see Fact-check)', 'To find (HR / benefits for memberships)', '', 'B'),
    ('Progressive', 'Insurance', 'Colorado Springs campus; about 1,500 staff in 2011 (old figure).', 'Insurance Journal 2011 (via search; see Fact-check)', 'To find (HR / benefits for memberships)', '', 'B'),
]

# --- employers: 400+ staff, for group memberships ---
EMP = [
    ('Fort Carson', 'Military', 29500, 2024, ACFR, 'Through the base’s morale and welfare office; military rules on discounts apply. Confirm the route before pitching.'),
    ('Peterson, Schriever & Cheyenne (Space Force)', 'Military', 16400, 2024, ACFR, 'As above.'),
    ('U.S. Air Force Academy', 'Military / education', 9200, 2024, ACFR, 'As above.'),
    ('UCHealth Memorial Health System', 'Hospital', 7050, 2024, ACFR, 'Shift workers: off-peak court times. Check which campus is nearest Peak.'),
    ('School District 11', 'Schools', 3600, 2024, ACFR, 'Teacher discounts; summer camps for students.'),
    ('University of Colorado (UCCS)', 'University', 3300, 2024, ACFR, 'Staff and student rates; club team practice.'),
    ('Academy School District 20', 'Schools', 3050, 2024, ACFR, 'Likely Peak’s side of town (north): confirm. Teacher discounts; PE and after-school programmes.'),
    ('El Paso County', 'Government', 3050, 2024, ACFR, 'Employee wellness programme.'),
    ('City of Colorado Springs', 'Government', 2950, 2024, ACFR, 'Employee wellness programme.'),
    ('Colorado Springs Utilities', 'Utility', 2050, 2024, ACFR, 'Employee wellness programme; also a Sports Corp sport sponsor in older lists.'),
    ('USAA', 'Insurance / banking', 1800, 2017, 'Area Development, 2017 (via search)', 'Old figure: confirm. Also on the sponsor list.'),
    ('Progressive', 'Insurance', 1500, 2011, 'Insurance Journal, 2011 (via search)', 'Old figure: confirm.'),
    ('Ent Credit Union', 'Credit union', 1300, 2021, 'Gazette, 2021 (via search)', 'Headquarters in Colorado Springs. Also on the sponsor list.'),
    ('T. Rowe Price', 'Financial services', 670, 2008, 'T. Rowe Price release, 2008 (via search)', 'Briargate Pkwy, near the mall. Old figure: confirm.'),
]

# --- what other venues charge (published, checked) ---
PRICES = [
    ('Peak Pickleball (for reference)', 'Colorado Springs, CO', '24 indoor courts', 'Court sponsor', '$12,000 / year', 12000, 'Peak’s own sponsor sheet (see the Claude Doc, checked 19 Oct)', '2026-10-19'),
    ('Peak Pickleball (for reference)', 'Colorado Springs, CO', '24 indoor courts', 'Title sponsor', '$24,000 / year', 24000, 'As above', '2026-10-19'),
    ('Hudson Valley Pickleball & Golf Center', 'Poughkeepsie, NY', '10 indoor courts, private', 'Court (or golf bay): banner facing the walking lanes + rotating TV ad', '$195 / month for 12 months', 2340, 'https://hvpickleball.com/', CHECKED),
    ('Hudson Valley Pickleball & Golf Center', 'Poughkeepsie, NY', '10 indoor courts, private', 'Court, short term', '$295 / month for 6 months', 1770, 'https://hvpickleball.com/', CHECKED),
    ('Hudson Valley Pickleball & Golf Center', 'Poughkeepsie, NY', '10 indoor courts, private', 'Paddle wall + TV ad', '$69 / month for 12 months', 828, 'https://hvpickleball.com/', CHECKED),
    ('Pooler Recreation', 'Pooler, GA', '8 outdoor pickleball courts, city', 'Court sponsor: 4x6 ft banner, scoreboard + TV logo, website', '$1,000 / calendar year', 1000, 'https://www.pooler-ga.gov/wp-content/uploads/2025/12/Sponsorship-Opportunties.pdf', CHECKED),
    ('Pooler Recreation', 'Pooler, GA', '8 outdoor pickleball courts, city', 'Fence sponsor', '$500 / calendar year', 500, 'As above', CHECKED),
]

FACTS = [
    ('Sports Corp 2026 members and tiers', SC, 'Verified', 'Page footer ©2026; Summit, Premier, Essential, Impact tiers read from the page.'),
    ('Colorado Chamber 2024 pickleball tournament sponsors', CC, 'Verified', 'Statewide chamber, held at the Broadmoor, 5 Sep 2024. No prices on the page.'),
    ('El Paso County top 10 employers, 2024', ACFR, 'Verified', 'Schedule 13, page 169; sources named: Chamber & EDC, Business Journal, CDLE, company sites.'),
    ('OCC: 2026 exclusive healthcare partner of Colorado Springs Sports & Social; outreach deadline 30 Sep', OCC26 + ' ; ' + OCC, 'Verified (via search of OCC’s own pages)', 'The 30 Sep window for the next budget has passed; the page allows exceptions.'),
    ('Alpine Bank Front Range sponsorship form', ALP, 'Verified exists; currency unresolved', 'Addressed to a Denver office; may be an old form.'),
    ('UCHealth gives via community grants in southern Colorado', UCH, 'Verified (news report)', 'The uchealth.com sponsorship form belongs to UC Health Cincinnati: not this system. Not used.'),
    ('Hudson Valley Pickleball prices', 'https://hvpickleball.com/', 'Verified', 'Read from the venue’s own page.'),
    ('Pooler, GA prices', 'Pooler Recreation PDF', 'Corrected', 'A search summary said court sponsor $1,500; the PDF says $1,000 for pickleball alone, $1,500 for pickleball and tennis together.'),
    ('Pictona sponsorship prices', 'pictona.org', 'Unresolved, left out', 'The page returned 404; a search summary also placed Pictona in Cleveland (it is in Florida). Not used.'),
    ('"Pickleball and More" (MA) court prices $1,000–$1,500', 'Its PDF (over 10 MB)', 'Unresolved, left out', 'Too large to open on the hotspot; only a search summary seen.'),
    ('Older Sports Corp sponsor page (Perkins Motors, Athletic Brewing, Scheels, Swire Coca-Cola, Xfinity, KOAA)', 'coloradospringssports.org (page now 404)', 'Unresolved, left out', 'Seen only in search snippets; the page no longer exists. Worth checking by hand: likely good leads.'),
    ('Air Academy Credit Union sponsored the library foundation in 2026', 'search snippet only', 'Unresolved, left out', 'Not opened.'),
    ('Employer headcounts for USAA, Progressive, Ent, T. Rowe Price', 'news and company releases via search', 'Dated (2008–2021)', 'All well over 400, but the numbers are old. Not opened at source; confirm before quoting a number.'),
    ('No current Chamber & EDC largest-employers list found', 'Chamber site, HUD profile, city budget', 'Unresolved', 'HUD and the city’s site refused scripted downloads; the county’s 2024 report is used instead.'),
]

PITCH = [
    'Short pitch (for Brandon; check every fact with Peak before use)',
    '',
    'Peak Pickleball has 24 indoor courts at Chapel Hills Mall. A court sponsorship puts your name on a court that players look at every time they play there.',
    'We would like to show you the club. A 20-minute tour, any weekday, and you can see the courts, the crowd and where your name would go.',
    '',
    'Tour invite (email draft; not sent)',
    'Subject: A 20-minute tour of Peak Pickleball',
    'Hi [first name],',
    'I work with Peak Pickleball at Chapel Hills Mall: 24 indoor courts. We have a few court sponsorships open for [year] and I think [company] would be a good fit because [one line from the "Why they fit" column].',
    'Could I show you around for 20 minutes? Any weekday that suits you.',
    '[Brandon’s name and number]',
    '',
    'Notes',
    '- Tours sell: the price only comes up after they have seen the courts.',
    '- Several companies set next year’s sponsorship budget in Q3 or Q4 (OCC closes on 30 Sep). Ask each one when its budget is set.',
    '- Employers: lead with group memberships or a staff discount, not sponsorship. Peak is already on Wellhub: ask whether the company offers Wellhub before offering a second discount for the same thing.',
    '- No member counts, visit numbers or follower counts in the pitch until Peak gives real ones.',
]

PEAK_SP = 'https://www.peakpickleball.us/peak-sponsors/'
SPR = 'https://springspickleball.com/become-a-sponsor/'
WH = 'https://wellhub.com/en-us/search/partners/peak-pickleball-briargate/'
# --- the ranking: our rating, not data. Fit with pickleball (sports, fitness, health) 0-3; money (size, known sponsor budgets) 0-3;
#     already sponsors local sport 0-2 (Sports Corp Summit/Premier or a paid pickleball sponsor = 2, Essential = 1); near Peak 0-1 ---
SCORE = {
    'Kaiser Permanente': (3, 3, 2, 0), 'UCHealth (Memorial Hospital; Memorial North)': (3, 3, 1, 0), 'Alpine Bank': (1, 3, 2, 0),
    'BOK Financial': (1, 3, 2, 0), 'OrangeTheory': (3, 1, 2, 0), 'Cheyenne Mountain Resort': (0, 3, 2, 0), 'Molson Coors': (1, 3, 2, 0),
    'Concept Restaurants': (1, 2, 2, 0), 'Republic Services': (0, 3, 2, 0), 'Coca-Cola': (1, 3, 1, 0), 'The Gazette': (1, 2, 2, 0),
    'Colorado Media Group': (1, 2, 2, 0), 'Cumulus Media': (1, 2, 2, 0), 'iHeart Media': (1, 2, 2, 0), 'Colorado Springs Chamber & EDC': (1, 2, 2, 0),
    'PCL Construction': (0, 3, 2, 0), 'McLane Company': (0, 3, 2, 0), 'Climax Molybdenum': (0, 3, 2, 0), 'Chord Energy': (0, 3, 2, 0),
    'T. Rowe Price': (1, 3, 0, 1), 'Ent Credit Union': (1, 3, 0, 1), 'USAA': (1, 3, 0, 0), 'Progressive': (1, 3, 0, 0),
    'Neon Pig': (1, 1, 2, 0), 'Great Range Bison': (1, 1, 2, 0), 'Spartan Barbell': (2, 1, 1, 0), 'Spartan Strength Systems': (2, 1, 1, 0),
    'Altitude Movement': (2, 1, 1, 0), 'Laborjack': (0, 1, 2, 0), 'KEG1': (0, 1, 2, 0), 'Windstar Studios': (0, 1, 2, 0),
    'Southern Colorado Women\u2019s Chamber of Commerce': (0, 1, 2, 0), 'Baker and King': (0, 1, 1, 0), 'BCA': (0, 1, 1, 0),
    'Dwire Earthmoving, LLC': (0, 1, 1, 0), 'Randy R Kilgore & Company': (0, 1, 1, 0), 'Summit Group Consultants': (0, 1, 1, 0),
    'Mind Quest Puzzles and Games': (0, 1, 1, 0), 'Hispanic Chamber of Commerce': (0, 1, 1, 0),
}
# --- Peak's own sponsors (renewals) and who has dropped off ---
RENEW = [(n, lvl, 'On Peak\u2019s sponsor page now') for lvl, names in [
    ('Title', ['Phil Long Ford', 'Hotel Polaris', 'Medicare Mentors', 'KKTV', 'Rally Back Therapy', 'Whataburger', 'Dr. Electric', 'Joey\u2019s NY Pizza', 'Red Rock Pizzaria', 'Hi-Tech PDR']),
    ('Court', ['Sign Shop Illuminated', 'Orthopedic Centers of Colorado', 'Stretch Lab', 'Prime IV', 'Air O Sport', 'The Cutting Edge Realtors', 'Choice Floors', 'Think Smart Tech', 'Sourdough & Co.', 'Integrity Bank & Trust', 'Monarch Merchandising', 'Salus Financial Advisors', 'Red Oak Exteriors', 'Denver Iconics', 'Asian Chamber of Commerce']),
    ('Logo', ['Together Won', 'Health & Fitness Expo', 'Whistle Pig Brewing'])] for n in names]
RENEW.append(('Roof Corp of Colorado Springs', 'Former', 'On Peak\u2019s sponsor page in Dec 2025 (Internet Archive), gone by Apr 2026: ask why, and re-pitch'))
# --- Springs Pickleball (the local competitor) ---
PRICES += [
    ('Springs Pickleball (local competitor)', 'Colorado Springs, CO', '19 indoor courts, 2 sites', 'Court partnership, year round: signs, digital, memberships, events', '$5,000 to $35,000 / year (top = naming rights, both sites)', 5000, SPR, CHECKED),
    ('Springs Pickleball (local competitor)', 'Colorado Springs, CO', '19 indoor courts, 2 sites', 'Court Partner: includes 4 memberships, paddles and gear', '$1,000 / month', 12000, SPR, CHECKED),
    ('Springs Pickleball (local competitor)', 'Colorado Springs, CO', '19 indoor courts, 2 sites', 'League / weekly-night sponsor', 'From $1,500 per 6-month season', 3000, SPR, CHECKED),
    ('Springs Pickleball (local competitor)', 'Colorado Springs, CO', '19 indoor courts, 2 sites', 'Event table at tournaments and socials', '$250 / $500 / $800 (15% off a season)', None, SPR, CHECKED),
    ('Springs Pickleball (local competitor)', 'Colorado Springs, CO', '19 indoor courts, 2 sites', 'Tournament sponsor', '$250 to $15,000 per event', None, SPR, CHECKED),
]
WEB = [   # the website pass, 21 Oct (free sources only)
    ('Kaiser Permanente', 'Email communityco@kp.org (Colorado sponsorships; up to 6 weeks)', 'Its rules exclude "advertising activities" and team sponsorships: a court sign will not qualify. Only a community-health event (e.g. free beginner clinics) might.', 'https://about.kaiserpermanente.org/community-health/communities-we-serve/colorado-community/sponsorships-conferences-and-community-service'),
    ('UCHealth', 'Community and government affairs, southern Colorado', 'Its money goes out as grants to nonprofits. A sign at Peak is a marketing spend: ask for marketing, not community giving.', 'https://www.aol.com/articles/uchealth-awards-218-000-grants-014454931.html'),
    ('Ent Credit Union', 'CommunityAdvocacy@Ent.com is for nonprofit grants', 'Ent says marketing sponsorships are handled separately, at the business level: ask for marketing. Ent is merging with Wings Credit Union.', 'https://www.ent.com/Community'),
    ('BOK Financial', 'Online charitable applications', 'Its giving excludes "athletic programs". Bill Sullivan is listed as President & CEO, Colorado Market: a marketing conversation, not a giving request.', 'https://thestatement.bokf.com/Experts/Bill-Sullivan'),
    ('Alpine Bank', 'Event sponsorship form (2017, Denver office, written for nonprofits)', 'Stale and not for a for-profit venue. Ask a Colorado Springs branch who handles marketing.', 'https://www.alpinebank.com/custom/fi/alpinebank/fb/disclosure/Sponsorship_Request_Form_Front-Range.pdf'),
    ('Cheyenne Mountain Resort', 'Not looked for', 'A 2023 travel guide lists pickleball courts at the resort: possibly a competitor. Check before pitching.', 'https://coloradoavidgolfer.com/colorado-getaways-2023-cheyenne-mountain-resort/'),
    ('Molson Coors', 'No public route found', 'Gives mostly in Golden and Denver and to disaster relief.', 'https://www.molsoncoorsblog.com/node/11806'),
    ('Coca-Cola (Swire Coca-Cola, USA)', 'No public route found', 'Announced a $475M, 620,000 sq ft plant at Peak Innovation Park in Colorado Springs (Dec 2025), about 170 jobs: a local hook.', 'https://www.kktv.com/2025/12/11/swire-coca-cola-facility-coming-colorado-springs/'),
    ('Concept Restaurants', 'No marketing contact found', 'A Gazette Q&A (undated) names co-owners Luke Travins and Dave Lux; ask at MacKenzie’s Chop House or Ritz Grill.', 'https://gazette.com/?p=1156034'),
    ('OrangeTheory', 'Franchise: the studio owner decides', 'Owner names found are from 2013 (Stetson Hills studio): ask the studio.', 'https://www.franchising.com/amp/news/20131202_orangetheory_fitness_set_to_open_first_southern_co.html'),
    ('Colorado Media Group', 'Not identified', 'Nothing found under this name; ask the Sports Corp who it is.', ''),
    ('Orthopedic Centers of Colorado (current Peak sponsor)', 'Outreach form; 1-866-506-7200; info@occ-ortho.com', 'Open to "athletic partnerships"; proposals due 30 Sep, some exceptions. Already a Peak court sponsor: this is the renewal route.', 'https://occ-ortho.com/community-outreach-and-sponsorship/'),
]
IDEAS = [
    ('Sell to marketing budgets, not charity', 'Most corporate "sponsorship request" pages are charity budgets for nonprofits, and several exclude advertising or athletics (Kaiser, BOK, Ent’s grants). A court sign at a for-profit club is advertising: Brandon needs the marketing or business-development person, and the pitch is reach and return, not giving.'),
    ('Look like Peak’s current sponsors', 'Peak’s 28 sponsors are mostly local, owner-run businesses: car dealer, restaurants, home services, clinics, realtors, financial advisors. Owners decide fast. More of the same kind (other dealers, clinics, roofers, med spas near Chapel Hills) may close faster than big corporations.'),
    ('Bundle memberships into court sponsorships', 'Springs Pickleball\u2019s $1,000/month Court Partner includes 4 memberships, paddles and gear. Peak\u2019s $12,000 court could include staff memberships: it costs Peak little and the sponsor\u2019s staff become players.'),
    ('Cheaper ways in', 'Springs Pickleball starts at $250 (event tables) and $1,500 (a league season). Peak\u2019s lowest published step is $12,000. A league, tournament or event-table tier lets small local businesses start, then move up.'),
    ('Category exclusivity', 'Springs Pickleball sells it as an add-on: one bank, one hospital, one car dealer. Charge for it, or use it to close.'),
    ('Publish the audience', 'Springs Pickleball shows 20,000+ players, 4,000+ followers, 65+ at every Paddle Up night, 100\u2013300 at events. Peak needs its own real numbers on its sponsor sheet (visits, members, event counts, followers).'),
    ('Tournaments and livestream', 'Springs Pickleball sells tournament tiers with livestream and social coverage. Peak\u2019s national events are a bigger story: sell them as their own packages.'),
    ('Socials as sponsor space', 'Peak\u2019s Instagram has 918 followers against Springs Pickleball\u2019s 4,000+. Taking over and growing Peak\u2019s socials is what makes posts, stories and video worth selling to sponsors.'),
]
WELL = [
    ('Where Peak sits', 'On Wellhub from the Titanium plan ($159.99 a month) only, per its Wellhub page. Employees on cheaper plans cannot use Peak.', WH),
    ('What Wellhub users get', '24 indoor courts; beginner classes and a "Peak Pickleball University" track; open play, leagues, tournaments; members can reserve courts. Hours 7 am to 9 pm weekdays, 7 am to 8 pm weekends. No visit limits or rules listed.', WH),
    ('Idea: a lower tier', 'Ask Peak whether it can join a lower Wellhub plan. More employees could walk in, which means more players for sponsors to reach. First ask Peak what Wellhub pays it, and how that would change on a lower plan.', ''),
    ('Idea: Wellhub nights', 'A beginner clinic or league night for Wellhub users, presented by a sponsor (e.g. a health or fitness company): the sponsor gets the room, Peak gets new players.', ''),
    ('Idea: direct employer plans', 'Wellhub only covers companies that buy it. A direct group plan (10% off for 1\u20135 staff, 20% for 6\u201350, 25% for 51+, as Pickleball Kingdom does; see the Claude Doc) reaches the rest, and the same companies are sponsor prospects.', ''),
    ('Not known', 'What Wellhub pays Peak, how many Wellhub visits it gets, and which local employers offer Wellhub. Ask Peak.', ''),
]
FACTS += [
    ('Peak\u2019s current sponsors (28) and levels', PEAK_SP, 'Verified', 'Page footer \u00a92026. OCC and Hotel Polaris are already Peak sponsors: moved from new leads to Renewals.'),
    ('Roof Corp of Colorado Springs was a Peak sponsor', 'web.archive.org snapshots 2025-12-19 and 2026-04-16', 'Verified', 'On the December 2025 copy, not the April 2026 one or today\u2019s page.'),
    ('Springs Pickleball packages and audience claims', SPR, 'Verified (their own claims)', 'Prices and audience are their marketing; no date on the page.'),
    ('Peak on Wellhub from Titanium ($159.99/mo)', WH, 'Verified', 'Visit limits and per-visit pay are not on the page.'),
    ('Contact tools: Hunter prices', 'https://hunter.io/pricing', 'Verified', 'Free 50 credits/month; Starter $49/month ($34 billed yearly). Emails only.'),
    ('Contact tools: Apollo price', 'review sites (zeliq.com, joinvalley.co, docket.io), 2026', 'Unresolved', 'About $49\u2013$59 per user per month; Apollo\u2019s own page shows no prices to a script; credit allowances conflict.'),
]

import json, re as _re
DATA = Path(__file__).resolve().parent.parent / 'data'
LOOK = json.loads((DATA / 'lookalikes.json').read_text(encoding='utf-8'))
HUN = json.loads((DATA / 'hunter-results.json').read_text(encoding='utf-8'))
# who to ask for, best first: sponsorship and community roles, then marketing, then communications, then the top person
_PRI = [r'sponsor|partnership|alliance|community', r'marketing|brand|advertis', r'communication|public relations|corporate affairs', r'president|ceo|chief executive|owner']
def _rank(pos):
    pos = (pos or '').lower()
    for i, rx in enumerate(_PRI):
        if _re.search(rx, pos): return i
    return 9
CONTACTS = []
for comp, d in HUN.items():
    ppl = sorted(d.get('emails') or [], key=lambda e: (_rank(e.get('pos')), -(e.get('conf') or 0)))
    for i, e in enumerate(ppl):   # everyone Hunter found; the best-matched role first (a general inbox shows as such)
        nm = ((e.get('first') or '') + ' ' + (e.get('last') or '')).strip()
        CONTACTS.append((comp, nm or 'General inbox', e.get('pos') or ('' if nm else 'general'), e.get('v') or '', e.get('conf'), e.get('srcN'), e.get('lastSeen') or '', e.get('li') or '', 'Ask for first' if i == 0 else '', e.get('phone') or ''))

CONTACTS.append(('Kaiser Permanente', 'Colorado community sponsorships', 'Sponsorship inbox (rules exclude advertising)', 'communityco@kp.org', None, None, '', '', 'Ask for first', ''))   # Kaiser's own page
CONTACTS.append(('Colorado Springs Chamber & EDC', 'General inbox', 'general', 'info@cscedc.com', None, None, '', '', 'Ask for first', '719-471-8183'))   # the Chamber's contact page
# who each phone number reaches (data/call-quality.json); its 'people' were confirmed on the company's own page, so they list ahead of Hunter's
# (2026-10-21, Matthew: "do it for all the companies, so that we can get the most accurate numbers")
CQ = {k: v for k, v in json.loads((DATA / 'call-quality.json').read_text(encoding='utf-8')).items() if not k.startswith('_')}
CONTACTS = [(c, p[0], p[1], p[2], None, None, '', '', 'Confirmed', p[3]) for c, q in CQ.items() for p in q.get('people', [])] + CONTACTS
# the local businesses Hunter searched (owners and managers first, then the general inbox)
HLOC = json.loads((DATA / 'hunter-local-results.json').read_text(encoding='utf-8')) if (DATA / 'hunter-local-results.json').exists() else {}
_PRI_L = [r'owner|president|founder|ceo|principal', r'manager|director|marketing']
def _rank_l(e):
    pos = (e.get('pos') or '').lower()
    if not e.get('first'): return 5   # a general inbox
    for i, rx in enumerate(_PRI_L):
        if _re.search(rx, pos): return i
    return 3
LOCAL_BEST = {}
for comp, d in HLOC.items():
    ppl = sorted(d.get('emails') or [], key=lambda e: (_rank_l(e), -(e.get('conf') or 0)))
    for i, e in enumerate(ppl):
        CONTACTS.append((comp + ' (local)', ((e.get('first') or '') + ' ' + (e.get('last') or '')).strip() or 'general inbox', e.get('pos') or ('' if e.get('first') else 'general'), e.get('v') or '', e.get('conf'), e.get('srcN'), e.get('lastSeen') or '', '', 'Ask for first' if i == 0 else '', e.get('phone') or ''))
        if i == 0: LOCAL_BEST[comp] = e.get('v') or ''

thin = Side(style='thin', color='C9CFC9')
HEAD = PatternFill('solid', fgColor='2F5D2C'); HFONT = Font(bold=True, color='FFFFFF')
YEL = PatternFill('solid', fgColor='FFF4C2')

def sheet(wb, title, cols, rows, widths, first=False):
    ws = wb.active if first else wb.create_sheet(title)
    ws.title = title
    ws.append(cols)
    for c in ws[1]: c.fill = HEAD; c.font = HFONT; c.alignment = Alignment(wrap_text=True, vertical='center')
    for r in rows: ws.append(list(r))
    for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows(min_row=2):
        for c in row: c.alignment = Alignment(wrap_text=True, vertical='top'); c.border = Border(bottom=thin)
    ws.freeze_panes = 'A2'; ws.auto_filter.ref = ws.dimensions
    return ws

wb = Workbook()
def sc(c): return SCORE.get(c, (0, 0, 0, 0))
_PH = {k: v for k, v in json.loads((DATA / 'phones.json').read_text(encoding='utf-8')).items() if not k.startswith('_')}
# can Brandon reach them? an email and a phone first, then one of the two, then neither (2026-10-21, Matthew: "reorder our list and have
# the places we have email and numbers"); the score orders each group
_ALIAS = {'Coca-Cola': 'Swire Coca-Cola, USA'}
def has_email(c): return any(x[3] for x in CONTACTS if x[0] == c or c.startswith(x[0]) or x[0] == _ALIAS.get(c)) or c == 'Kaiser Permanente' or bool((_PH.get(c) or {}).get('email'))
def has_phone(c): return bool(_PH.get(c)) or any((x[9] if len(x) > 9 else '') for x in CONTACTS if x[0] == c or c.startswith(x[0]) or x[0] == _ALIAS.get(c))
def reach(c): return int(has_email(c)) + int(has_phone(c))
def _mine(c): return sorted([x for x in CONTACTS if x[0] == c or c.startswith(x[0]) or x[0] == _ALIAS.get(c)], key=lambda x: 0 if x[8] else 1)
def best_email(c): e = [x for x in _mine(c) if x[3]]; return (e[0][3] + ((' (' + e[0][1] + (', ' + e[0][2] if e[0][2] and e[0][2] != 'general' else '') + ')') if e[0][1] else '')) if e else ''
def best_phone(c):
    if c in CQ: return CQ[c]['phone']
    if _PH.get(c): return _PH[c]['phone'] + ' (' + _PH[c]['note'].split(';')[0] + ')'
    p = [x for x in _mine(c) if len(x) > 9 and x[9] and x[9] != 'None']; return (str(p[0][9]) + ' (' + p[0][1] + ')') if p else ''
# the order (2026-10-21, Matthew: "prioritize the list by numbers +email, then numbers, then email. and then ranking"): a phone and an
# email first, then a phone only, then an email only, then neither; the score orders each group
# then (2026-10-21, Matthew: "prioritize the ones that lead to a good person"): who the number reaches, judged in data/call-quality.json
def group(c):
    t = (CQ.get(c) or {}).get('tier')
    if t in (1, 2, 3): return 5 - t          # 4 direct to a good person, 3 small-organisation main line, 2 front desk: ask by name
    if has_email(c): return 1                # email first (no good number)
    return 0
GROUP_NAME = {4: 'Direct to a good person', 3: 'Main line, small organisation', 2: 'Front desk: ask by name', 1: 'Email first', 0: 'Neither yet'}
RANKED = sorted(LEADS, key=lambda x: (-group(x[0]), -int(has_email(x[0])), -sum(sc(x[0])), x[0]))
ws = sheet(wb, 'Sponsor leads', ['Order', 'Company', 'Kind', 'Best email', 'Best phone', 'How to call', 'Group', 'Score /9', 'Fit /3', 'Money /3', 'Sponsors sport /2', 'Near Peak /1', 'Why they fit', 'Source', 'Route in', 'Route link', 'Status', 'Contact (name, role)', 'Email / phone', 'Next step / date', 'Notes', 'Main / local phone', 'Phone source'],
           [(i + 1, c, k, best_email(c), best_phone(c), (CQ.get(c) or {}).get('how', ''), GROUP_NAME[group(c)], sum(sc(c)), *sc(c), w, s, r, l, '', '', '', '', '', (_PH.get(c) or {}).get('phone', ''), (CQ.get(c) or {}).get('src') or (((_PH.get(c) or {}).get('note', '') + ' · ' + (_PH.get(c) or {}).get('src', '')) if _PH.get(c) else '')) for i, (c, k, w, s, r, l, p) in enumerate(RANKED)],
           [6, 30, 18, 40, 16, 60, 22, 8, 7, 8, 9, 8, 58, 36, 44, 28, 14, 26, 26, 20, 26, 16, 40], first=True)
dv = DataValidation(type='list', formula1='"Not contacted,Emailed,Called,Tour booked,Toured,Proposal sent,Signed,Not now,No"', allow_blank=True)
ws.add_data_validation(dv); dv.add(f'Q2:Q{len(LEADS) + 1}')
for r in range(2, len(LEADS) + 2):
    for col in 'QRSTU': ws[f'{col}{r}'].fill = YEL
sheet(wb, 'Renewals (Peak sponsors)', ['Sponsor', 'Level', 'Where seen', 'Renews when', 'Contact', 'Status', 'Notes'], [(n, l, w, '', '', '', '') for n, l, w in RENEW], [34, 10, 60, 14, 26, 14, 30])
sheet(wb, 'Employers 400+', ['Employer', 'Kind', 'Employees', 'Year of count', 'Source', 'Membership idea / notes'],
      EMP, [40, 20, 12, 12, 46, 70])
sheet(wb, 'What others charge', ['Venue', 'Where', 'Courts', 'What', 'Price as published', 'Per year ($)', 'Source', 'Checked'],
      PRICES, [36, 20, 26, 46, 26, 12, 50, 12])
sheet(wb, 'Contacts (Hunter)', ['Company', 'Name', 'Position', 'Email', 'Hunter confidence %', 'Web sources', 'Last seen', 'LinkedIn', 'Pick', 'Phone'], CONTACTS, [26, 24, 36, 34, 12, 10, 12, 36, 14, 18])
sheet(wb, 'Local lookalikes', ['Business', 'Kind', 'Score', 'Miles from Peak', 'Chain / franchise', 'Address', 'Phone', 'Email (Hunter)', 'Website', 'OpenStreetMap', 'Status', 'Notes'], [(r['name'], r['kind'], r['score'], r['miles'], 'yes' if r['chain'] else '', r['addr'], r['phone'], LOCAL_BEST.get(r['name'], ''), r['web'], r['osm'], '', '') for r in LOOK], [34, 26, 7, 9, 10, 32, 16, 32, 34, 30, 14, 26])
sheet(wb, 'Website pass', ['Company', 'Public route found', 'What it means for Peak', 'Source'], WEB, [30, 46, 80, 50])
sheet(wb, 'Ideas to borrow', ['Idea', 'Why'], IDEAS, [34, 110])
sheet(wb, 'Wellhub', ['What', 'Detail', 'Source'], WELL, [24, 100, 50])
sheet(wb, 'Fact-check', ['Claim', 'Source', 'Result', 'Note'], FACTS, [50, 50, 26, 70])
wp = wb.create_sheet('Pitch and tour invite'); wp.column_dimensions['A'].width = 110
for t in PITCH:
    wp.append([t]); c = wp.cell(row=wp.max_row, column=1); c.alignment = Alignment(wrap_text=True, vertical='top')
    if t and not t.startswith('-') and not t.startswith('[') and len(t) < 70 and not t.startswith('Hi') and not t.startswith('Subject') and not t.startswith('Could'): c.font = Font(bold=True)
rd = wb.create_sheet('Read me', 0); rd.column_dimensions['A'].width = 110
for t in ['Peak Pickleball: sponsor leads, employers and prices (built ' + CHECKED + ')', '',
          'Sponsor leads: ' + str(len(LEADS)) + ' new companies, ranked by a score out of 9 (fit with sports, fitness and health; money; already sponsors local sport; near Peak). The score is our rating, not data: change it as you learn. Yellow columns are Brandon\u2019s.',
          'Renewals: Peak\u2019s own 28 sponsors, and one that dropped off (Roof Corp of Colorado Springs).',
          'Contacts (Hunter): marketing, communications and executive staff Hunter found at 11 regional companies (21 Oct, free plan). "Ask for first" = the best-matched role. Hunter has no locations: for big companies, check the person covers Colorado.',
          'Local lookalikes: ' + str(len(LOOK)) + ' businesses within 5 miles of Chapel Hills Mall in the same trades as Peak’s sponsors (OpenStreetMap, ODbL). Score: trade fit, distance, has a website. Peak’s current sponsors left out.',
          'Website pass: what the free search found for the top names (most public routes are charity budgets: ask for marketing).',
          'Ideas to borrow: what Springs Pickleball sells that Peak could. Wellhub: what Peak offers there, and ideas.',
          'Route in: how to reach them. "To find" means the next step is finding the marketing or community contact (website, call the front desk, LinkedIn by hand).',
          'Employers 400+: for group memberships and staff discounts. Counts with old years need confirming before you quote them.',
          'What others charge: published prices from other venues, each checked at its source. Peak’s own prices are on top for comparison.',
          'Fact-check: what was verified, corrected, and left out.',
          'Nothing in this file has been sent to anyone.']:
    rd.append([t]); rd.cell(row=rd.max_row, column=1).alignment = Alignment(wrap_text=True)
rd['A1'].font = Font(bold=True, size=14)
wb.save(OUT)
print('wrote', OUT, len(LEADS), 'leads,', len(EMP), 'employers,', len(PRICES), 'prices')

# --- the brief for Brandon (2026-10-21, Matthew: "whatever we build ... I do want some PDFs that i can share with brandon") ---
import html, subprocess
E = lambda t: html.escape(str(t))
top = RANKED[:15]
rows1 = ''.join(f'<tr><td class="n">{i + 1}</td><td><b>{E(c)}</b><br><small>{E(k)}</small>{("<br><small><b>" + E(CQ[c]["how"]) + (": " + E(CQ[c]["phone"]) if CQ[c]["phone"] else "") + "</b></small>") if c in CQ else ""}</td><td class="n">{sum(sc(c))}</td><td>{E(w)}</td><td>{E(r)}</td></tr>' for i, (c, k, w, s0, r, l, p) in enumerate(top))
lv = {}
for n, l, w in RENEW: lv.setdefault(l, []).append(n)
renew = ''.join(f'<p><b>{E(l)} ({len(v)}):</b> {E(", ".join(v))}</p>' for l, v in lv.items())
pr = ''.join(f'<tr><td>{E(v)}</td><td>{E(c)}</td><td>{E(w)}</td><td>{E(p0)}</td></tr>' for v, wh, c, w, p0, py, src, ck in PRICES)
ideas = ''.join(f'<li><b>{E(a)}.</b> {E(b)}</li>' for a, b in IDEAS)
well = ''.join(f'<li><b>{E(a)}.</b> {E(b)}</li>' for a, b, c in WELL)
webrows = ''.join(f'<tr><td><b>{E(a)}</b></td><td>{E(b)}</td><td>{E(c)}</td></tr>' for a, b, c, d in WEB)
best = [c for c in CONTACTS if c[8] and not c[0].endswith(' (local)')]
hrows = ''.join(f'<tr><td><b>{E(c[0])}</b></td><td>{E(c[1])}</td><td>{E(c[2])}</td><td>{E(c[3])}</td><td class="n">{E(c[4])}%</td></tr>' for c in best)
lrows = ''.join(f'<tr><td><b>{E(r["name"])}</b>{" <small>(chain)</small>" if r["chain"] else ""}{("<br><small>" + E(LOCAL_BEST[r["name"]]) + "</small>") if LOCAL_BEST.get(r["name"]) else ""}</td><td>{E(r["kind"])}</td><td class="n">{r["miles"]}</td><td class="ph">{E(r["phone"]).replace("+1 ","").replace("+1-","")}</td></tr>' for r in LOOK[:30])
emp = ''.join(f'<tr><td>{E(n)}</td><td class="n">{v:,}</td><td class="n">{y}</td></tr>' for n, k, v, y, s0, note in EMP)
doc = f'''<!doctype html><html><head><meta charset="utf-8"><title>Peak sponsorships: brief for Brandon</title><style>
@page {{ size: letter; margin: .45in .5in }} body{{font:10pt/1.35 Arial,Helvetica,sans-serif;color:#1d241f;margin:0}}
h1{{font-size:19pt;margin:0 0 2px}} h2{{font-size:13pt;margin:14px 0 6px;border-bottom:2px solid #2F5D2C;padding-bottom:3px}}
.k{{color:#2F5D2C;font:700 8pt Arial;letter-spacing:.08em;text-transform:uppercase}} .sub{{color:#555;margin:0 0 8px}}
table{{width:100%;border-collapse:collapse;margin:4px 0 8px}} th,td{{border-bottom:1px solid #d5dbd5;padding:4px 5px;text-align:left;vertical-align:top}}
th{{background:#2F5D2C;color:#fff;font-size:8.5pt}} td small{{color:#666}} td.n,th.n{{text-align:right;white-space:nowrap}}
.pg{{page-break-before:always}} td.ph{{white-space:nowrap}} li{{margin:0 0 4px}} p{{margin:4px 0}} .note{{color:#666;font-size:8pt;margin-top:10px}}
</style></head><body>
<div class="k">Peak Pickleball · corporate sponsorships · draft, nothing sent</div>
<h1>Who to call first</h1>
<p class="sub">{len(LEADS)} new companies. Ordered by who the phone reaches: a direct line to a good person first, then small organisations’ main lines, then front desks (ask by name), then email only, then neither; within each by a score out of 9: fit with sports, fitness and health (3), money (3), already sponsors local sport (2), near Peak (1). The score is our rating; change it as you learn. Full list, contacts columns and sources: Peak-Sponsor-Leads-2026-10.xlsx.</p>
<table><tr><th class="n">#</th><th>Company</th><th class="n">Score</th><th>Why they fit</th><th>How to reach them</th></tr>{rows1}</table>
<h2>Renewals: Peak\u2019s own sponsors</h2>
<p>Ask Peak for each sponsor\u2019s renewal date and how each is doing. Keeping these is cheaper than finding new ones.</p>{renew}
<div class="pg"></div>
<div class="k">Peak Pickleball · corporate sponsorships</div>
<h1>What others charge</h1>
<table><tr><th>Venue</th><th>Courts</th><th>What</th><th>Price as published</th></tr>{pr}</table>
<div class="pg"></div>
<div class="k">Peak Pickleball · corporate sponsorships</div>
<h1>Ideas, and how to reach the top names</h1>
<h2>Ideas to borrow</h2><ul>{ideas}</ul>
<h2>Website pass</h2>
<p class="sub">Free sources only, checked {CHECKED}. Most public routes are charity budgets that don’t fit a for-profit court sign: ask for marketing instead.</p>
<table><tr><th>Company</th><th>Public route</th><th>What it means</th></tr>{webrows}</table>
<div class="pg"></div>
<div class="k">Peak Pickleball · corporate sponsorships</div>
<h1>Who to ask for</h1>
<p class="sub">The best-matched marketing or communications person Hunter found at each regional company (free plan, {CHECKED}). Hunter gives no locations: at big companies, check the person covers Colorado. Everyone it found is on the spreadsheet’s Contacts tab.</p>
<table><tr><th>Company</th><th>Name</th><th>Position</th><th>Email</th><th class="n">Confidence</th></tr>{hrows}</table>
<h2>Local businesses like Peak’s sponsors (top 30 of {len(LOOK)})</h2>
<p>Within 5 miles of Chapel Hills Mall, in the trades Peak’s sponsors are in. Owners decide; walk in or call. Emails under a name come from Hunter (20 local businesses searched; 14 had one). Full list on the Local lookalikes tab.</p>
<table><tr><th>Business</th><th>Kind</th><th class="n">Miles</th><th>Phone</th></tr>{lrows}</table>
<div class="pg"></div>
<div class="k">Peak Pickleball · memberships</div>
<h1>Employers and Wellhub</h1>
<h2>Employers with 400+ staff</h2>
<p>For group memberships and staff discounts first; sponsorship second. Counts from 2008\u20132021 need confirming.</p>
<table><tr><th>Employer</th><th class="n">Staff</th><th class="n">Year</th></tr>{emp}</table>
<h2>Wellhub</h2><ul>{well}</ul>
<p class="note">Sources: Hunter.io (contacts, 21 Oct); OpenStreetMap contributors, ODbL (local businesses); El Paso County 2024 financial report (employers); Colorado Springs Sports Corp 2026 member list; Colorado Chamber 2024 pickleball tournament; Peak\u2019s sponsor page and the Internet Archive; Springs Pickleball, Hudson Valley Pickleball and Pooler Recreation sponsor pages; Peak\u2019s Wellhub page. Checked {CHECKED}. Each row\u2019s link is in the spreadsheet.</p>
</body></html>'''
H = OUT.with_name('peak-sponsor-brief.html'); H.write_text(doc, encoding='utf-8')
PDF = OUT.with_name('Peak-Sponsor-Brief-for-Brandon-2026-10.pdf')
subprocess.run([r'C:\Program Files\Google\Chrome\Application\chrome.exe', '--headless=new', '--disable-gpu', '--no-pdf-header-footer', f'--print-to-pdf={PDF}', H.as_uri()], capture_output=True, timeout=120)
print('wrote', PDF, PDF.exists())

# --- the seed for Peak Sponsor Desk (2026-10-21, Matthew: "my job is to build this out") ---
import hashlib
def _id(s): return hashlib.sha1(s.encode('utf-8')).hexdigest()[:10]
seed = {'built': CHECKED, 'leads': []}
web_by = {w[0].split(' (')[0]: w for w in WEB}
for i, (c, k, w, src, r, l, p) in enumerate(RANKED):
    f, m, sp, nr = sc(c)
    ALIAS = {'Coca-Cola': 'Swire Coca-Cola, USA'}   # the list's name -> the name Hunter was asked for
    ppl = [{'name': x[1], 'pos': x[2], 'email': x[3], 'conf': x[4], 'pick': bool(x[8]), 'phone': x[9] if len(x) > 9 else ''} for x in CONTACTS if x[0] == c or c.startswith(x[0]) or x[0] == ALIAS.get(c)]
    wp = web_by.get(c) or web_by.get(c.split(' (')[0])
    seed['leads'].append({'id': _id('lead|' + c), 'list': 'new', 'name': c, 'kind': k, 'score': f + m + sp + nr, 'rank': i + 1, 'why': w, 'route': r, 'routeLink': l, 'source': src,
                          'web': wp[2] if wp else '', 'webLink': (wp[3] or '') if wp else '', 'contacts': ppl})
for n, lvl, w in RENEW:
    seed['leads'].append({'id': _id('renew|' + n), 'list': 'renew', 'name': n, 'kind': lvl + ' sponsor' if lvl != 'Former' else 'Former sponsor', 'score': None, 'why': w, 'route': '', 'contacts': []})
for r in LOOK[:150]:
    ppl = [{'name': x[1], 'pos': x[2], 'email': x[3], 'conf': x[4], 'pick': bool(x[8]), 'phone': x[9] if len(x) > 9 else ''} for x in CONTACTS if x[0] == r['name'] + ' (local)']
    seed['leads'].append({'id': _id('local|' + r['name']), 'list': 'local', 'name': r['name'], 'kind': r['kind'], 'score': r['score'], 'miles': r['miles'], 'chain': r['chain'],
                          'why': f"{r['kind']}, {r['miles']} mi from Peak" + (' (chain or franchise)' if r['chain'] else ''), 'route': 'Walk in or call', 'phone': r['phone'], 'site': r['web'], 'addr': r['addr'], 'contacts': ppl})
PH = {k: v for k, v in json.loads((DATA / 'phones.json').read_text(encoding='utf-8')).items() if not k.startswith('_')}
for l in seed['leads']:
    if l['list'] == 'new' and l['name'] in PH:
        l['phone'] = PH[l['name']]['phone']; l['phoneNote'] = PH[l['name']]['note'] + ' (' + PH[l['name']]['kind'] + ')'
        if PH[l['name']].get('email'): l['contacts'] = l.get('contacts', []) + [{'name': 'General inbox', 'pos': 'general', 'email': PH[l['name']]['email'], 'conf': None, 'pick': not l.get('contacts')}]
    if l['list'] == 'new' and l['name'] in CQ:
        q = CQ[l['name']]; l['callTier'] = q['tier']; l['callHow'] = q['how']; l['phone'] = q['phone']; l['phoneNote'] = ''; l['callSrc'] = q.get('src', '')
seed['packages'] = [{'k': 'court', 'name': 'Court sponsor', 'price': 12000, 'per': 'year', 'note': 'Peak’s published price'}, {'k': 'title', 'name': 'Title sponsor', 'price': 24000, 'per': 'year', 'note': 'Peak’s published price'}]
(DATA / 'desk-seed.json').write_text(json.dumps(seed, ensure_ascii=False, indent=1), encoding='utf-8')
print('desk seed:', len(seed['leads']), 'leads')
