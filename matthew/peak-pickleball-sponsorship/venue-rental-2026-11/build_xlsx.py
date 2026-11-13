"""Peak venue-rental prospects (2026-11-12, Matthew: "people who might want to rent out Peak's 80,000 sq ft ... for expos").

Builds Peak-Venue-Prospects-2026-11.xlsx beside this file from prospects.csv, plus a Venues & rates sheet.
2026-11-13: adds a "Best contact" column on Prospects and a Contacts sheet, both from contacts.csv.
Nothing here is sent anywhere. Run: python build_xlsx.py
"""
import csv
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

HERE = Path(__file__).resolve().parent
OUT = HERE / 'Peak-Venue-Prospects-2026-11.xlsx'

VENUES = [
    ('Venue', 'Space (as published)', 'Rate', 'Source', 'Seen'),
    ('Norris Penrose Event Center, Lower Gold Camp Rd', 'Not on own pages (Villain Arts cites 40,000 sq ft main level)',
     'Not published; info@norrispenrose.com, 719-635-1101', 'https://www.norrispenrose.com/site-tours-event-booking', '2026-11-12'),
    ('Colorado Springs Event Center, 3960 Palmer Park Blvd', 'Not on own pages (Cvent: ~93,000 sq ft in two halls, secondary)',
     'Not published; events@cseventcenter.com, 719-637-3960', 'https://www.coloradospringseventcenter.com/promoters', '2026-11-12'),
    ('Broadmoor World Arena', '19,500 sq ft floor; 26,000 sq ft concourse; 56,000 sq ft outdoor apron',
     'On request', 'https://www.broadmoorworldarena.com/arena-info/book-the-arena', '2026-11-12'),
    ('Douglas County Fairgrounds, Castle Rock', 'Indoor Arena 50,400 sq ft; Sullivan Events Center size not given',
     'Sullivan Events Center $3,000/day + $1,000 deposit; Indoor Arena $1,500/day; Kirk Hall $600/day; whole site $4,500/day; 35% off for 501(c)(3)s',
     'https://www.douglasco.gov/county-fair-grounds/facilities-rental/rental-fees-overview/', '2026-11-12 (policies updated Oct 2025)'),
    ('Jefferson County Fairgrounds, Golden', 'Exhibit Halls 1-3: 10,440 sq ft',
     'Halls 1-3: $1,440 standard / $908 community / $375 youth-ag (basis not stated; reference only)',
     'https://www.jeffco.us/1800/Exhibit-Halls', 'Page updated 2025-12-23'),
    ('Pueblo Convention Center', '17,507 sq ft exhibition hall', 'Not published (enquiry form)',
     'https://www.puebloconventioncenter.com/about-us/', '2026-11-12'),
    ('Colorado State Fairgrounds, Pueblo', 'Events Center ~3,000 capacity', 'Not published; no rentals Aug-Sep',
     'https://coloradostatefair.com/', '2026-11-12 (search summary)'),
    ('Peak Pickleball (for comparison)', '24 courts, two levels, 80,380 sq ft building',
     '$40/court/hour; add-ons $60/hour; = $960/hour for all 24 courts', 'https://www.peakpickleball.us/multi-court-event/', '2026-11-12'),
]

WIDTHS = [8, 26, 34, 48, 40, 26, 26, 50, 32, 44, 50, 12]


def sheet(ws, rows, widths):
    head_fill = PatternFill('solid', fgColor='1F3A5F')
    for r in rows:
        ws.append(r)
    for c in ws[1]:
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = head_fill
        c.alignment = Alignment(wrap_text=True, vertical='top')
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical='top')
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = ws.dimensions


CONTACT_WIDTHS = [8, 30, 7, 24, 30, 32, 16, 26, 40, 50, 22, 11, 70]


def best_contact(c):
    """One-cell summary of the best contact: name, role, then email/phone, else the general route."""
    who = ', '.join(x for x in (c['contact name'], c['role']) if x)
    reach = ' / '.join(x for x in (c['business email'] + (' (pattern, unverified)' if c['email status'].startswith('pattern') else ''),
                                   c['business phone']) if x.strip())
    if not reach:
        reach = c['other route']
    text = (who + '\n' if who else 'No named person. ') + reach
    return text + ('' if c['confidence'] == 'high' else f" [{c['confidence']} confidence]")


rows = list(csv.reader((HERE / 'prospects.csv').open(encoding='utf-8-sig')))
contacts = list(csv.reader((HERE / 'contacts.csv').open(encoding='utf-8-sig')))
chead = contacts[0]
best = {}
for r in contacts[1:]:
    c = dict(zip(chead, r))
    if c['best contact'] == 'yes':
        best[c['organisation']] = best_contact(c)
org_i = rows[0].index('organisation')
rows[0].insert(org_i + 1, 'Best contact (13 Nov)')
for r in rows[1:]:
    if r[org_i] not in best:
        raise SystemExit('no contact row for ' + r[org_i])
    r.insert(org_i + 1, best[r[org_i]])
widths = WIDTHS[:org_i + 1] + [44] + WIDTHS[org_i + 1:]

wb = Workbook()
ws = wb.active
ws.title = 'Prospects'
sheet(ws, rows, widths)
for row in ws.iter_rows(min_row=2, max_col=1):
    row[0].value = int(row[0].value)
cws = wb.create_sheet('Contacts', 1)
sheet(cws, contacts, CONTACT_WIDTHS)
for row in cws.iter_rows(min_row=2, max_col=1):
    row[0].value = int(row[0].value)
sheet(wb.create_sheet('Venues & rates'), VENUES, [40, 44, 60, 60, 24])
wb.save(OUT)
print('wrote', OUT, len(rows) - 1, 'prospects,', len(contacts) - 1, 'contact rows')
