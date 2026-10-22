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
    ('Orthopedic Centers of Colorado', 'Sports medicine', SC_T.format('Premier') + '. Exclusive healthcare sponsor of Colorado Springs Sports & Social for 2026 (rec leagues). Pickleball players are its patients.', SC + ' ; ' + OCC26,
     'Outreach request form on its site. Proposals due by 30 Sep for the next year; reviewed in Q4; "some exceptions may apply".', OCC, 'A'),
    ('Alpine Bank', 'Bank', SC_T.format('Summit') + '.', SC, 'Front Range sponsorship request form (to its Denver office; asks 60 days ahead). The form may be dated: confirm the current contact first.', ALP, 'A'),
    ('UCHealth (Memorial Hospital; Memorial North)', 'Hospital system', 'No. 4 employer in El Paso County (7,050 staff, 2024). Gives through community grants (southern Colorado grants announced in UCHealth news).', ACFR + ' ; ' + UCH,
     'Community and government affairs, southern Colorado (the senior director is named in UCHealth news releases). Also an employee-membership target (see Employers).', UCH, 'A'),
    ('BOK Financial', 'Bank', SC_T.format('Premier') + '.', SC, 'To find', '', 'A'),
    ('Concept Restaurants', 'Restaurant group', SC_T.format('Premier') + '.', SC, 'To find', '', 'A'),
    ('Neon Pig', 'Restaurant', SC_T.format('Premier') + '.', SC, 'To find', '', 'B'),
    ('OrangeTheory', 'Fitness', SC_T.format('Premier and Essential') + '. Fitness, not racquet sport: a cross-promotion partner more than a buyer.', SC, 'To find (franchise: the local owner decides)', '', 'B'),
    ('Laborjack', 'Moving / labor', SC_T.format('Premier') + '.', SC, 'To find', '', 'B'),
    ('Republic Services', 'Waste and recycling', SC_T.format('Premier') + '.', SC, 'To find', '', 'B'),
    ('KEG1', 'Not checked', SC_T.format('Premier') + '.', SC, 'To find', '', 'B'),
    ('Hotel Polaris', 'Hotel', SC_T.format('Premier') + '. Visiting teams and tournament guests.', SC, 'To find', '', 'B'),
    ('Cheyenne Mountain Resort', 'Resort', SC_T.format('Summit') + '. Check first whether it runs its own courts (could be a competitor).', SC, 'To find', '', 'C'),
    ('Coca-Cola', 'Beverage', SC_T.format('Essential') + '. Also a pouring-rights deal for Peak’s snack bar, if Peak has one.', SC, 'To find', '', 'B'),
    ('Windstar Studios', 'Not checked', SC_T.format('Summit') + '.', SC, 'To find', '', 'B'),
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
ws = sheet(wb, 'Sponsor leads', ['Company', 'Kind', 'Why they fit', 'Source', 'Route in', 'Route link', 'Priority', 'Status', 'Contact (name, role)', 'Next step / date', 'Notes'],
           [(c, k, w, s, r, l, p, '', '', '', '') for c, k, w, s, r, l, p in sorted(LEADS, key=lambda x: (x[6], x[0]))],
           [30, 18, 60, 40, 46, 30, 9, 14, 26, 22, 30], first=True)
dv = DataValidation(type='list', formula1='"Not contacted,Emailed,Called,Tour booked,Toured,Proposal sent,Signed,Not now,No"', allow_blank=True)
ws.add_data_validation(dv); dv.add(f'H2:H{len(LEADS) + 1}')
for r in range(2, len(LEADS) + 2):
    for col in 'HIJK': ws[f'{col}{r}'].fill = YEL
sheet(wb, 'Employers 400+', ['Employer', 'Kind', 'Employees', 'Year of count', 'Source', 'Membership idea / notes'],
      EMP, [40, 20, 12, 12, 46, 70])
sheet(wb, 'What others charge', ['Venue', 'Where', 'Courts', 'What', 'Price as published', 'Per year ($)', 'Source', 'Checked'],
      PRICES, [36, 20, 26, 46, 26, 12, 50, 12])
sheet(wb, 'Fact-check', ['Claim', 'Source', 'Result', 'Note'], FACTS, [50, 50, 26, 70])
wp = wb.create_sheet('Pitch and tour invite'); wp.column_dimensions['A'].width = 110
for t in PITCH:
    wp.append([t]); c = wp.cell(row=wp.max_row, column=1); c.alignment = Alignment(wrap_text=True, vertical='top')
    if t and not t.startswith('-') and not t.startswith('[') and len(t) < 70 and not t.startswith('Hi') and not t.startswith('Subject') and not t.startswith('Could'): c.font = Font(bold=True)
rd = wb.create_sheet('Read me', 0); rd.column_dimensions['A'].width = 110
for t in ['Peak Pickleball: sponsor leads, employers and prices (built ' + CHECKED + ')', '',
          'Sponsor leads: ' + str(len(LEADS)) + ' companies. A = best fit (local, sponsors sport, near Peak or sells to players). Yellow columns are Brandon’s to fill in.',
          'Route in: how to reach them. "To find" means the next step is finding the marketing or community contact (website, call the front desk, LinkedIn by hand).',
          'Employers 400+: for group memberships and staff discounts. Counts with old years need confirming before you quote them.',
          'What others charge: published prices from other venues, each checked at its source. Peak’s own prices are on top for comparison.',
          'Fact-check: what was verified, corrected, and left out.',
          'Nothing in this file has been sent to anyone.']:
    rd.append([t]); rd.cell(row=rd.max_row, column=1).alignment = Alignment(wrap_text=True)
rd['A1'].font = Font(bold=True, size=14)
wb.save(OUT)
print('wrote', OUT, len(LEADS), 'leads,', len(EMP), 'employers,', len(PRICES), 'prices')
