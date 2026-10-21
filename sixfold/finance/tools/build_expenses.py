"""Sixfold expenses + profit workbook (2026-10-21). Figures from: the Spend Ledger artifact, the app's jobs (read-only), Square's two
locations (read-only, fees included), the app's pricing constants. Anything only Matthew knows is a yellow cell."""
import sys
from datetime import date
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.comments import Comment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

OUT = sys.argv[1]
F = 'Arial'
BLUE = Font(name=F, color='0000FF')
BLACK = Font(name=F)
GREEN = Font(name=F, color='008000')
BOLD = Font(name=F, bold=True)
TITLE = Font(name=F, bold=True, size=14)
SUB = Font(name=F, italic=True, color='555555', size=9)
HDR = Font(name=F, bold=True, color='FFFFFF')
HFILL = PatternFill('solid', fgColor='2F4F3A')
SEC = PatternFill('solid', fgColor='E4EDE6')
YEL = PatternFill('solid', fgColor='FFFF00')
TOT = PatternFill('solid', fgColor='F2F2F2')
thin = Side(style='thin', color='BBBBBB')
BOX = Border(top=thin, bottom=thin, left=thin, right=thin)
TOPB = Border(top=Side(style='medium', color='333333'))
USD = '$#,##0.00;($#,##0.00);-'
USD0 = '$#,##0;($#,##0);-'
PCT = '0.0%;(0.0%);-'
NUM = '#,##0.0;(#,##0.0);-'
DT = 'yyyy-mm-dd'

wb = Workbook()


def hdr(ws, row, cols, widths=None):
    for i, t in enumerate(cols, 1):
        c = ws.cell(row=row, column=i, value=t)
        c.font = HDR; c.fill = HFILL; c.alignment = Alignment(wrap_text=True, vertical='center'); c.border = BOX
    ws.row_dimensions[row].height = 32
    if widths:
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w


def put(ws, ref, v, font=BLACK, fmt=None, fill=None, note=None, bold=False):
    c = ws[ref]; c.value = v; c.font = Font(name=F, bold=bold, color=font.color) if bold else font
    if fmt: c.number_format = fmt
    if fill: c.fill = fill
    if note: c.comment = Comment(note, 'Claude'); c.comment.width = 320; c.comment.height = 120
    return c


def ask(ws, ref, fmt=None, note=None, v=None):
    return put(ws, ref, v, BLUE, fmt, YEL, note)


# ------------------------------------------------------------------ Read me
rd = wb.active; rd.title = 'Read me'
rd.column_dimensions['A'].width = 4; rd.column_dimensions['B'].width = 110
lines = [
    ('Sixfold: expenses and profit', TITLE),
    ('Built 21 Oct 2026. Covers Sixfold and 365 Aeration & Seeding together; each job and payment is tagged with which one.', SUB),
    ('', None),
    ('How to read the colours', BOLD),
    ('Yellow cell: only you know this. Type the number in. Totals and profit update on their own.', None),
    ('Blue text: a number I put in from a record (Square, the app, the Spend Ledger, a receipt). Hover the cell for where it came from.', None),
    ('Black text: a formula. Leave these alone.', None),
    ('', None),
    ('The tabs', BOLD),
    ('Profit: money in, per-job costs, set costs, ads and net profit by month (Aug, Sep, Oct 2026), each business to date, and one week (pick the Monday).', None),
    ('Fixed costs: websites, software, storage, the truck, the aerator, the trailer card, insurance and ads. Monthly, weekly and yearly side by side.', None),
    ('Variable per job: every job with its seed, fertilizer, gas, card fees and the 20% employee cost, and what the job made.', None),
    ('Employees: pay not tied to a job (hourly or salary). The crew on each job is the 20% employee cost on the Variable per job tab.', None),
    ('Payments: every Square payment on both locations (365Aeration and Six Fold Colorado), with Square\'s fee.', None),
    ('', None),
    ('Where the numbers came from', BOLD),
    ('Websites, domains, hosting, Google Workspace: the Spend Ledger (the expenses tracker artifact, entries tagged Sixfold and 365).', None),
    ('Jobs, prices, crew, seed and fertilizer recorded: the Sixfold app, read on 21 Oct 2026.', None),
    ('Payments and card fees: Square, both locations, read on 21 Oct 2026. Square charged its fee on each card payment; those are the real fees, not a percentage.', None),
    ('Seed price: SiteOne Englewood invoice 24 Jul 2026, 6 x 50 lb LESCO Tuf-Turf for $773.34 with tax ($128.89 a bag).', None),
    ('Fertilizer price: $40 for a 50 lb bag (your figure, 21 Oct 2026), at LESCO 24-0-11\'s label rate.', None),
    ('Gas: EIA weekly Denver regular, $4.244 for the week of 19 Oct 2026 (the price the app uses), 18 mpg truck, drive = straight-line miles x 1.3, there and back.', None),
    ('Truck, ads, aerator, storage, the trailer credit card, the fertilizer price and the 20% employee cost: your figures, 21 Oct 2026.', None),
    ('', None),
    ('Estimates, said plainly', BOLD),
    ('Seed and fertilizer: where Jen recorded the pounds on the quote (Jeremy, Carlos, Randy) those are used. Everyone else is estimated from the lawn size at 3 lb seed per 1,000 sq ft (the app\'s middle rate) and LESCO\'s label rate. The lawn sizes come from the quote, or else the app\'s aerial estimate.', None),
    ('Gas is an estimate from miles, not a receipt. If you keep gas receipts, type the real figure in the "Gas override" column.', None),
    ('Money in is counted when it was paid. Job costs are counted in the month of the job. A deposit taken in one month for a job the next month shows up that way.', None),
    ('Russ and Eric each paid $200 on 16 Oct with the same fee, so which payment is whose does not change anything.', None),
    ('', None),
    ('Questions I could not answer from the records (the yellow cells)', BOLD),
    ('Answered 21 Oct: truck $1,000, ads $6,066, aerator $325, storage $414, trailer credit card $500 (all a month); fertilizer $40 a bag; employees 20% of every job.', None),
    ('3. Truck: does the $1,000 include insurance and registration?', None),
    ('4. Business insurance: premium, and is it monthly or yearly?', None),
    ('5. Pay not tied to a job: is anyone (Jen, Nneka, Cai) paid hourly or a salary on top of the 20% per job?', None),
    ('6. ClickUp, phone lines, anything else billed monthly that is not in the Spend Ledger.', None),
    ('7. The $1,125 check deposited to Six Fold Colorado\'s Square on 2 Sep: which job was it?', None),
    ('8. SiteGround hosts Surge\'s site too. Should Sixfold carry all of it ($359.88 a year) or a share? It is set to 100% for now.', None),
    ('9. Did ads run in August or September?', None),
    ('10. Materials for Kara\'s two jobs ($1,500 landscaping, $1,100 aeration) and Brian\'s lawn size: not recorded anywhere.', None),
    ('', None),
    ('Left out on purpose', BOLD),
    ('Kara\'s $250 monthly lawn visit (booked 19 Nov) is not counted: that agreement is not signed.', None),
    ('Surge and Traverse costs from the Spend Ledger (Claude, surgeftw.com, the Traverse server) are not Sixfold\'s and are not here.', None),
]
for i, (t, f) in enumerate(lines, 1):
    c = rd.cell(row=i, column=2, value=t); c.font = f or BLACK; c.alignment = Alignment(wrap_text=True, vertical='top')
rd['A5'].fill = YEL
rd['A6'].value = 'x'; rd['A6'].font = BLUE

# ------------------------------------------------------------------ Fixed costs
fx = wb.create_sheet('Fixed costs')
put(fx, 'A1', 'Fixed costs', TITLE)
put(fx, 'A2', 'What Sixfold pays whether or not there is a job. Monthly cost = the bill turned into a month, times Sixfold\'s share; weekly = monthly x 12 / 52. Status "Planned" or "Stopped" counts as 0.', SUB)
hdr(fx, 4, ['Item', 'Vendor', 'Billed', 'Amount per bill ($)', 'Status', 'Sixfold share', 'Monthly cost ($)', 'Weekly cost ($)', 'Yearly cost ($)', 'Renews / next', 'Where the number came from'],
    [56, 22, 11, 14, 11, 11, 14, 13, 14, 13, 70])
L = 'Spend Ledger artifact'
rows = [
    ('sec', 'Websites, software and platforms'),
    ('sixfoldcolorado.com domain', 'Squarespace', 'Yearly', 20, 'Active', 1, '2027-08-21', L + ' (first year was about $18)'),
    ('365aeration.com domain', 'Squarespace', 'Yearly', 20, 'Active', 1, '2027-10-14', L + ': the main 365 address'),
    ('aeration365.com domain', 'Squarespace', 'Yearly', 20, 'Active', 1, '2027-10-14', L + ': kept so the mistyped address forwards; 365 email sits on it'),
    ('SiteGround hosting: Sixfold, 365 and Surge sites', 'SiteGround', 'Yearly', 359.88, 'Active', 'ASK1', '2027-09-02', L + '. Hosts Surge\'s site too: set Sixfold\'s share (100% for now).'),
    ('Google Workspace, sixfoldcolorado.com (4 mailboxes)', 'Google via Squarespace', 'Monthly', 33.60, 'Active', 1, '21st', L + ': Starter plan'),
    ('Google Workspace, aeration365.com (Jen\'s mailbox)', 'Google via Squarespace', 'Monthly', 8.40, 'Active', 1, '14th', L),
    ('Google Workspace seat, forms@aeration365.com (app emails)', 'Google via Squarespace', 'Monthly', 8.40, 'ASKS', 1, '', L + ' says Planned (card declined 18 Oct). Set Active once it bills.'),
    ('ClickUp (Jen\'s lead list)', 'ClickUp', 'Monthly', None, 'Active', 1, '', 'Not in the ledger: fill in, or set Stopped if it is free.'),
    ('Phone line(s), incl. 365\'s (720) 830-4553', '', 'Monthly', None, 'Active', 1, '', 'Not in the ledger: fill in.'),
    ('Other software or subscriptions', '', 'Monthly', None, 'Active', 1, '', ''),
    ('sec', 'Operations'),
    ('Aerator', '', 'Monthly', 325, 'Active', 1, '', 'Matthew, 21 Oct 2026: $325 a month for the aerator.'),
    ('Storage unit, 333 W Hampden Ave', '', 'Monthly', 414, 'Active', 1, '', 'Matthew, 21 Oct 2026: $414 a month for storage.'),
    ('Credit card payment (holds the trailers)', '', 'Monthly', 500, 'Active', 1, '', 'Matthew, 21 Oct 2026: $500 a month on the credit card that holds the trailers.'),
    ('Equipment upkeep and repairs', '', 'Monthly', None, 'Active', 1, '', 'An average month, if you want one in.'),
    ('sec', 'Trucks'),
    ('Truck', '', 'Monthly', 1000, 'Active', 1, '', 'Matthew, 21 Oct 2026: truck $1,000 a month.'),
    ('Truck: insurance, if not in the $1,000', '', 'Monthly', None, 'Active', 1, '', 'Leave empty if the $1,000 already covers it.'),
    ('Truck: registration, if not in the $1,000', 'Colorado DMV', 'Yearly', None, 'Active', 1, '', ''),
    ('sec', 'Advertising'),
    ('ADS', 'Meta', 'Monthly', 6066, 'Active', 1, '', 'Matthew, 21 Oct 2026: $6,066 a month for ads. On the Profit tab as its own line.'),
    ('sec', 'Insurance and business'),
    ('Business insurance (general liability)', '', 'Yearly', None, 'Active', 1, '', 'Fill in the premium; change Billed to Monthly if it is paid monthly.'),
    ('Other insurance (workers\' comp, equipment)', '', 'Yearly', None, 'Active', 1, '', ''),
    ('Accounting, bank fees, licences', '', 'Monthly', None, 'Active', 1, '', ''),
]
r = 5; first = None
for row in rows:
    if row[0] == 'sec':
        for col in range(1, 12): fx.cell(row=r, column=col).fill = SEC
        put(fx, f'A{r}', row[1], BOLD); r += 1; continue
    first = first or r
    item, vend, billed, amt, status, share, renews, src = row
    if item == 'ADS': item = 'Ads (Meta)'; ADS_ROW = r
    put(fx, f'A{r}', item); put(fx, f'B{r}', vend)
    put(fx, f'C{r}', billed, BLUE)
    if amt is None: ask(fx, f'D{r}', USD)
    else: put(fx, f'D{r}', amt, BLUE, USD)
    if status == 'ASKS': put(fx, f'E{r}', 'Planned', BLUE, fill=YEL)
    else: put(fx, f'E{r}', status, BLUE)
    if share == 'ASK1': put(fx, f'F{r}', 1, BLUE, PCT, YEL)
    else: put(fx, f'F{r}', share, BLUE, PCT)
    put(fx, f'G{r}', f'=IF(E{r}="Active",IF(C{r}="Monthly",N(D{r}),IF(C{r}="Quarterly",N(D{r})/3,IF(C{r}="Yearly",N(D{r})/12,0))),0)*F{r}', fmt=USD)
    put(fx, f'H{r}', f'=G{r}*12/52', fmt=USD)
    put(fx, f'I{r}', f'=G{r}*12', fmt=USD)
    put(fx, f'J{r}', renews, BLUE); put(fx, f'K{r}', src, SUB)
    r += 1
last = r - 1
put(fx, f'A{r}', 'Total set costs, ads included', bold=True)
for col in 'GHI': put(fx, f'{col}{r}', f'=SUM({col}{first}:{col}{last})', fmt=USD, bold=True)
for col in range(1, 12): fx.cell(row=r, column=col).fill = TOT; fx.cell(row=r, column=col).border = TOPB
FIX_TOTAL = f"'Fixed costs'!$G${r}"; FIX_WEEK = f"'Fixed costs'!$H${r}"
ADS_M = f"'Fixed costs'!$G${ADS_ROW}"; ADS_W = f"'Fixed costs'!$H${ADS_ROW}"
dv = DataValidation(type='list', formula1='"Monthly,Quarterly,Yearly"', allow_blank=True); fx.add_data_validation(dv); dv.add(f'C{first}:C{last + 10}')
dv2 = DataValidation(type='list', formula1='"Active,Planned,Stopped"', allow_blank=True); fx.add_data_validation(dv2); dv2.add(f'E{first}:E{last + 10}')

# one-off purchases
r += 3; put(fx, f'A{r}', 'One-off purchases', BOLD)
put(fx, f'B{r}', 'Printing, tools, signs: counted in the month bought. Seed and fertilizer are NOT entered here; they are counted per job on the Variable sheet.', SUB)
r += 1; ONE_H = r
for i, t in enumerate(['Item', 'Date bought', 'Amount ($)', 'Month', 'Note'], 1):
    c = fx.cell(row=r, column=i, value=t); c.font = HDR; c.fill = HFILL; c.border = BOX
r += 1; ONE_F = r
for item, note in [('Business cards (printed)', 'Fill in the date and the amount.'), ('Yard signs (FedEx print)', 'Fill in when they are printed and paid for.'), ('', ''), ('', ''), ('', ''), ('', '')]:
    put(fx, f'A{r}', item)
    ask(fx, f'B{r}', DT); ask(fx, f'C{r}', USD)
    put(fx, f'D{r}', f'=IF(B{r}="","",TEXT(B{r},"yyyy-mm"))')
    put(fx, f'E{r}', note, SUB); r += 1
ONE_L = r - 1
fx.freeze_panes = 'B5'

# ------------------------------------------------------------------ Employees
em = wb.create_sheet('Employees')
put(em, 'A1', 'Employees and pay', TITLE)
put(em, 'A2', 'The crew on each job costs 20% of the job price, set on the Variable per job tab. Use this tab only for pay NOT tied to a job: "Hourly" = rate x hours a month; "Salary (monthly)" = the month\'s pay; "Per job" or "Not paid" = nothing extra here.', SUB)
em['A2'].alignment = Alignment(wrap_text=True); em.row_dimensions[2].height = 42; em.merge_cells('A2:H2')
hdr(em, 4, ['Name', 'Role', 'Paid how', 'Rate', 'Hours a month (hourly only)', 'Extra on top (payroll tax etc.)', 'Monthly cost, not per job ($)', 'Note'],
    [24, 34, 20, 12, 14, 14, 16, 60])
people = [
    ('Brad McPherson', 'Crew: did 8 of the 9 jobs in the app', 'Recorded as crew on every 365 job except Carlos.'),
    ('Brandon Long', 'Owner; crew on Carlos\'s job', 'Owner pay is a draw, not a cost: leave as "Not paid" unless he takes a set amount per job.'),
    ('Jen McPherson', 'Office: quotes and books 365 jobs', ''),
    ('Nneka', 'Office; runs a door team', ''),
    ('Cai Silva', 'Office', ''),
    ('', '', ''), ('', '', ''),
]
r = 5; E_F = r
for name, role, note in people:
    put(em, f'A{r}', name); put(em, f'B{r}', role)
    if name == 'Brandon Long': put(em, f'C{r}', 'Not paid', BLUE, fill=YEL)
    else: ask(em, f'C{r}')
    ask(em, f'D{r}', '#,##0.00'); ask(em, f'E{r}', '#,##0'); put(em, f'F{r}', 0, BLUE, PCT, YEL)
    put(em, f'G{r}', f'=IF(C{r}="Hourly",N(D{r})*N(E{r}),IF(C{r}="Salary (monthly)",N(D{r}),0))*(1+N(F{r}))', fmt=USD)
    put(em, f'H{r}', note, SUB); r += 1
E_L = r - 1
put(em, f'A{r}', 'Total monthly pay (not per job)', bold=True); put(em, f'G{r}', f'=SUM(G{E_F}:G{E_L})', fmt=USD, bold=True)
for col in range(1, 9): em.cell(row=r, column=col).fill = TOT; em.cell(row=r, column=col).border = TOPB
EMP_TOTAL = f"Employees!$G${r}"
dv3 = DataValidation(type='list', formula1='"Per job ($),Per job (% of price),Hourly,Salary (monthly),Not paid"', allow_blank=True); em.add_data_validation(dv3); dv3.add(f'C{E_F}:C{E_L}')
r += 2; put(em, f'A{r}', 'Example: an office person on "Hourly" at 20 for 80 hours a month adds $1,600 a month here. Crew paid from jobs stay "Per job" (covered by the 20%).', SUB)
em.freeze_panes = 'A5'

# ------------------------------------------------------------------ Payments
pm = wb.create_sheet('Payments')
put(pm, 'A1', 'Payments (Square, both locations)', TITLE)
put(pm, 'A2', 'Read from Square on 21 Oct 2026. Failed charges and a $0 entry are left out. Customer and job are my match by amount and date; check them. A job\'s Square fees are the rows with its customer and job date.', SUB)
hdr(pm, 4, ['Date', 'Month', 'Square location', 'Business', 'Type', 'Amount ($)', 'Refunded ($)', 'Square fee ($)', 'Money in ($)', 'Money in after fee ($)', 'Customer', 'Job it paid for (job date)', 'What it was'],
    [12, 9, 18, 10, 9, 12, 12, 12, 12, 14, 18, 14, 52])
pays = [
    ('2026-08-31', 'Six Fold Colorado', 'Sixfold', 'Card', 1, 0, 0, 'Test', '', 'A $1 card charge: looks like a test.'),
    ('2026-09-02', 'Six Fold Colorado', 'Sixfold', 'Check', 1125, 0, 0, 'ASK', 'ASK', 'A check entered in Square. Which job? (question 7)'),
    ('2026-09-16', 'Six Fold Colorado', 'Sixfold', 'Card', 750, 0, 0, 'Kara R.', '2026-09-17', 'Landscaping, first half. Square charged no fee on this one.'),
    ('2026-09-18', 'Six Fold Colorado', 'Sixfold', 'Card', 750, 0, 14.73, 'Kara R.', '2026-09-17', 'Landscaping, second half'),
    ('2026-10-06', 'Six Fold Colorado', 'Sixfold', 'Card', 550, 0, 16.25, 'Kara R.', '2026-10-12', 'Aeration, first half'),
    ('2026-10-07', 'Six Fold Colorado', 'Sixfold', 'Card', 200, 0, 6.10, 'Brian S.', '2026-10-16', 'Aeration, first half ($200 still owed)'),
    ('2026-10-16', 'Six Fold Colorado', 'Sixfold', 'Card', 550, 0, 16.25, 'Kara R.', '2026-10-12', 'Aeration, second half'),
    ('2026-10-16', '365Aeration', '365', 'Card', 50, 0, 1.75, 'Kirk C.', '2026-10-19', 'Deposit'),
    ('2026-10-16', '365Aeration', '365', 'Card', 200, 0, 6.10, 'Russ K.', '2026-10-16', 'Paid in full'),
    ('2026-10-16', '365Aeration', '365', 'Card', 200, 0, 6.10, 'Eric V.', '2026-10-16', 'Paid in full'),
    ('2026-10-16', '365Aeration', '365', 'Card', 200, 25, 7.15, 'Carlos P.', '2026-10-16', '$200 with $25 refunded: his $175 price'),
    ('2026-10-18', '365Aeration', '365', 'Card', 50, 0, 1.75, 'Sreenivas K.', '2026-10-23', 'Deposit (job 23 Oct)'),
    ('2026-10-19', '365Aeration', '365', 'Card', 249, 0, 8.87, 'Kirk C.', '2026-10-19', 'Balance after the $50 deposit'),
    ('2026-10-20', '365Aeration', '365', 'Card', 468, 0, 15.74, 'Randy C.', '2026-10-20', 'Paid in full'),
    ('2026-10-20', '365Aeration', '365', 'Card', 200, 0, 6.10, 'Joseph B.', '2026-10-30', 'Deposit (job 30 Oct)'),
    ('2026-10-21', '365Aeration', '365', 'Card', 350, 0, 11.85, 'Jeremy', '2026-10-20', 'Paid in full at the $350 agreed'),
]
r = 5; P_F = r
for d, loc, biz, typ, amt, ref, fee, cust, jdate, what in pays:
    put(pm, f'A{r}', date.fromisoformat(d), BLUE, DT)
    put(pm, f'B{r}', f'=TEXT(A{r},"yyyy-mm")')
    put(pm, f'C{r}', loc, BLUE); put(pm, f'D{r}', biz, BLUE); put(pm, f'E{r}', typ, BLUE)
    put(pm, f'F{r}', amt, BLUE, USD); put(pm, f'G{r}', ref, BLUE, USD); put(pm, f'H{r}', fee, BLUE, USD)
    put(pm, f'I{r}', f'=F{r}-G{r}', fmt=USD); put(pm, f'J{r}', f'=I{r}-H{r}', fmt=USD)
    if cust == 'ASK': ask(pm, f'K{r}')
    else: put(pm, f'K{r}', cust, BLUE)
    if jdate == 'ASK': ask(pm, f'L{r}', DT)
    elif jdate: put(pm, f'L{r}', date.fromisoformat(jdate), BLUE, DT)
    put(pm, f'M{r}', what, SUB); r += 1
for _ in range(6):   # room for more
    put(pm, f'B{r}', f'=IF(A{r}="","",TEXT(A{r},"yyyy-mm"))'); put(pm, f'I{r}', f'=IF(F{r}="","",N(F{r})-N(G{r}))', fmt=USD); put(pm, f'J{r}', f'=IF(F{r}="","",N(I{r})-N(H{r}))', fmt=USD)
    for col in 'ADEFGHKL': pm[f'{col}{r}'].number_format = DT if col in 'AL' else (USD if col in 'FGH' else 'General')
    r += 1
P_L = r - 1
put(pm, f'A{r}', 'Total', bold=True)
for col in 'FGHIJ': put(pm, f'{col}{r}', f'=SUM({col}{P_F}:{col}{P_L})', fmt=USD, bold=True)
for col in range(1, 14): pm.cell(row=r, column=col).fill = TOT; pm.cell(row=r, column=col).border = TOPB
r += 1
put(pm, f'A{r}', 'Square fee as a share of card money', SUB); put(pm, f'H{r}', f'=IFERROR(SUMIFS(H{P_F}:H{P_L},E{P_F}:E{P_L},"Card")/SUMIFS(I{P_F}:I{P_L},E{P_F}:E{P_L},"Card"),0)', fmt=PCT)
pm.freeze_panes = 'A5'
PR = lambda col: f"Payments!${col}${P_F}:${col}${P_L}"

# ------------------------------------------------------------------ Variable per job
vj = wb.create_sheet('Variable per job')
put(vj, 'A1', 'Variable costs per job', TITLE)
put(vj, 'A2', 'Seed, fertilizer, gas, Square fees and crew pay for each job, and what each job made. Inputs first; the jobs table is below.', SUB)
put(vj, 'A4', 'Inputs', BOLD)
inp = [
    ('Seed: price per bag ($)', 128.89, USD, 'SiteOne Englewood invoice 2026-07-24: 6 x 50 lb LESCO Tuf-Turf Seed Mixture, $773.34 with tax.'),
    ('Seed: pounds per bag', 50, '#,##0', 'Same invoice.'),
    ('Seed: lb per 1,000 sq ft when not recorded', 3, '#,##0.0', 'The app\'s middle seeding rate (Bryce\'s 2 to 4 lb range; CSU says 3 to 4 after aeration).'),
    ('Fertilizer: price per bag ($)', 40, USD, 'Matthew, 21 Oct 2026: $40 for a 50 lb bag.'),
    ('Fertilizer: pounds per bag', 50, '#,##0', 'Label.'),
    ('Fertilizer: sq ft one bag covers', 12000, '#,##0', 'Label: a 50 lb bag covers about 12,000 sq ft.'),
    ('Gas: price per gallon ($)', 4.244, '$#,##0.000', 'EIA weekly retail, Denver regular, week of 2026-10-19 (what the app uses for quotes).'),
    ('Truck: miles per gallon', 18, '#,##0', 'The app\'s setting (Matthew, 2026-10-15).'),
    ('Road miles per straight-line mile', 1.3, '0.0', 'The app\'s setting: roads are about 30% longer than a straight line.'),
    ('Employee cost: share of each job\'s price', 0.2, PCT, 'Matthew, 21 Oct 2026: a 20% employee cost on every job.'),
]
VI = {}
for i, (lab, v, fmt, src) in enumerate(inp):
    rr = 5 + i
    put(vj, f'A{rr}', lab); put(vj, f'D{rr}', v, BLUE, fmt, note=src); put(vj, f'E{rr}', src, SUB)
    VI[i] = f'$D${rr}'
SEED_LB = f'({VI[0]}/{VI[1]})'          # $ per lb seed
FERT_LB = f'({VI[3]}/{VI[4]})'          # $ per lb fert
FERT_RATE = f'({VI[4]}/{VI[5]})'        # lb per sq ft

T = 16
cols = ['Date', 'Customer', 'Business', 'Service', 'Status', 'Crew', 'Price ($)', 'Collected ($)', 'Still owed ($)', 'Lawn sq ft', 'Lawn size from',
        'Seed lb recorded', 'Seed lb used', 'Seed ($)', 'Fert lb recorded', 'Fert lb used', 'Fert ($)', 'Miles one way (straight line)', 'Gas ($)', 'Gas override ($)',
        'Square fees ($)', 'Other materials ($)', 'Employee cost override ($)', 'Employee cost, 20% ($)', 'Job cost ($)', 'Job profit ($)', 'Margin', 'Month']
hdr(vj, T - 1, cols, [11, 13, 9, 12, 9, 15, 10, 11, 10, 9, 15, 9, 9, 9, 9, 9, 9, 11, 9, 10, 10, 10, 11, 10, 10, 11, 8, 9])
for i in range(len(cols)):
    vj.cell(row=4, column=i + 1).font = BOLD
vj.row_dimensions[T - 1].height = 45
# date, customer, biz, service, status, crew, price, collected, lawn, lawnsrc, seedrec, fertrec, miles
jobs = [
    ('2026-09-17', 'Kara R.', 'Sixfold', 'Landscaping', 'Done', '', 1500, 1500, None, 'No lawn: landscaping', 0, 0, 'ASK'),
    ('2026-10-12', 'Kara R.', 'Sixfold', 'Aeration', 'Done', '', 1100, 1100, 'ASK', 'Not recorded', None, None, 'ASK'),
    ('2026-10-16', 'Brian S.', 'Sixfold', 'Aeration', 'Done', 'Brad McPherson', 400, 200, 'ASK', 'Aerial: trees cover it', None, None, 17.23),
    ('2026-10-16', 'Russ K.', '365', 'Aeration + seed', 'Done', 'Brad McPherson', 200, 200, 800, 'Aerial estimate', None, None, 8.91),
    ('2026-10-16', 'Eric V.', '365', 'Aeration + seed', 'Done', 'Brad McPherson', 200, 200, 700, 'Aerial estimate', None, None, 8.92),
    ('2026-10-16', 'Carlos P.', '365', 'Aeration + seed', 'Done', 'Brandon Long', 175, 175, 1300, 'Jen\'s quote', 2.6, 5.4, 'ASK'),
    ('2026-10-19', 'Kirk C.', '365', 'Aeration + seed', 'Done', 'Brad McPherson', 299, 299, 3600, 'Aerial estimate', None, None, 16.04),
    ('2026-10-20', 'Jeremy', '365', 'Aeration + seed', 'Done', 'Brad McPherson', 350, 350, 1000, 'Jen\'s quote', 3, 4.2, 12.78),
    ('2026-10-20', 'Randy C.', '365', 'Aeration + seed', 'Done', 'Brad McPherson', 468, 468, 2200, 'Jen\'s quote', 7.6, 9.2, 13.07),
    ('2026-10-23', 'Sreenivas K.', '365', 'Aeration + seed', 'Booked', 'Brad McPherson', 339, 50, 200, 'Aerial: looks too small, check', None, None, 9.24),
    ('2026-10-30', 'Joseph B.', '365', 'Aeration + seed', 'Booked', 'Brad McPherson', 814, 200, 'ASK', 'Not recorded', None, None, 'ASK'),
]
r = T; J_F = r
EMP_N = f'Employees!$A${E_F}:$A${E_L}'; EMP_H = f'Employees!$C${E_F}:$C${E_L}'; EMP_R = f'Employees!$D${E_F}:$D${E_L}'
for d, cust, biz, svc, st, crew, price, coll, lawn, lsrc, seedrec, fertrec, miles in jobs:
    put(vj, f'A{r}', date.fromisoformat(d), BLUE, DT); put(vj, f'B{r}', cust, BLUE); put(vj, f'C{r}', biz, BLUE); put(vj, f'D{r}', svc, BLUE)
    put(vj, f'E{r}', st, BLUE); put(vj, f'F{r}', crew, BLUE, fill=YEL if not crew else None)
    put(vj, f'G{r}', price, BLUE, USD0); put(vj, f'H{r}', coll, BLUE, USD0); put(vj, f'I{r}', f'=G{r}-H{r}', fmt=USD0)
    if lawn == 'ASK': ask(vj, f'J{r}', '#,##0')
    elif lawn is None: put(vj, f'J{r}', None)
    else: put(vj, f'J{r}', lawn, BLUE, '#,##0')
    put(vj, f'K{r}', lsrc, SUB)
    for col, v in (('L', seedrec), ('O', fertrec)):
        if v is None: ask(vj, f'{col}{r}', NUM)
        else: put(vj, f'{col}{r}', v, BLUE, NUM)
    put(vj, f'M{r}', f'=IF(L{r}<>"",N(L{r}),N(J{r})/1000*{VI[2]})', fmt=NUM)
    put(vj, f'N{r}', f'=M{r}*{SEED_LB}', fmt=USD)
    put(vj, f'P{r}', f'=IF(O{r}<>"",N(O{r}),N(J{r})*{FERT_RATE})', fmt=NUM)
    put(vj, f'Q{r}', f'=P{r}*{FERT_LB}', fmt=USD)
    if miles == 'ASK': ask(vj, f'R{r}', '#,##0.0')
    else: put(vj, f'R{r}', miles, BLUE, '#,##0.0', note='Straight-line miles from the storage unit (the app\'s 365 base) to the house, from the app\'s map of the property.')
    put(vj, f'S{r}', f'=IF(T{r}<>"",N(T{r}),N(R{r})*{VI[8]}*2/{VI[7]}*{VI[6]})', fmt=USD)
    ask(vj, f'T{r}', USD)
    put(vj, f'U{r}', f'=SUMIFS({PR("H")},{PR("K")},B{r},{PR("L")},A{r})', GREEN, USD)
    ask(vj, f'V{r}', USD); ask(vj, f'W{r}', USD)
    put(vj, f'X{r}', f'=IF(W{r}<>"",N(W{r}),G{r}*{VI[9]})', fmt=USD)
    put(vj, f'Y{r}', f'=N{r}+Q{r}+S{r}+U{r}+N(V{r})+X{r}', fmt=USD)
    put(vj, f'Z{r}', f'=G{r}-Y{r}', fmt=USD)
    put(vj, f'AA{r}', f'=IF(G{r}=0,0,Z{r}/G{r})', fmt=PCT)
    put(vj, f'AB{r}', f'=TEXT(A{r},"yyyy-mm")')
    r += 1
for _ in range(8):   # blank rows for new jobs, formulas ready
    for col, f, fmt in (('I', '=IF(G{r}="","",G{r}-N(H{r}))', USD0), ('M', '=IF(G{r}="","",IF(L{r}<>"",N(L{r}),N(J{r})/1000*' + VI[2] + '))', NUM),
                        ('N', '=IF(G{r}="","",N(M{r})*' + SEED_LB + ')', USD), ('P', '=IF(G{r}="","",IF(O{r}<>"",N(O{r}),N(J{r})*' + FERT_RATE + '))', NUM),
                        ('Q', '=IF(G{r}="","",N(P{r})*' + FERT_LB + ')', USD), ('S', '=IF(G{r}="","",IF(T{r}<>"",N(T{r}),N(R{r})*' + VI[8] + '*2/' + VI[7] + '*' + VI[6] + '))', USD),
                        ('U', '=IF(G{r}="","",SUMIFS(' + PR("H") + ',' + PR("K") + ',B{r},' + PR("L") + ',A{r}))', USD),
                        ('X', '=IF(G{r}="","",IF(W{r}<>"",N(W{r}),G{r}*' + VI[9] + '))', USD),
                        ('Y', '=IF(G{r}="","",N(N{r})+N(Q{r})+N(S{r})+N(U{r})+N(V{r})+N(X{r}))', USD), ('Z', '=IF(G{r}="","",G{r}-N(Y{r}))', USD),
                        ('AA', '=IF(N(G{r})=0,"",N(Z{r})/G{r})', PCT), ('AB', '=IF(A{r}="","",TEXT(A{r},"yyyy-mm"))', 'General')):
        put(vj, f'{col}{r}', f.replace('{r}', str(r)), fmt=fmt)
    vj[f'A{r}'].number_format = DT
    for col in 'GHTVW': vj[f'{col}{r}'].number_format = USD
    r += 1
J_L = r - 1
put(vj, f'A{r}', 'Total', bold=True)
for col in 'GHI': put(vj, f'{col}{r}', f'=SUM({col}{J_F}:{col}{J_L})', fmt=USD0, bold=True)
for col in 'MP': put(vj, f'{col}{r}', f'=SUM({col}{J_F}:{col}{J_L})', fmt=NUM, bold=True)
for col in 'NQSUXYZ': put(vj, f'{col}{r}', f'=SUM({col}{J_F}:{col}{J_L})', fmt=USD, bold=True)
put(vj, f'V{r}', f'=SUM(V{J_F}:V{J_L})', fmt=USD, bold=True)
put(vj, f'AA{r}', f'=IF(G{r}=0,0,Z{r}/G{r})', fmt=PCT, bold=True)
for col in range(1, 29): vj.cell(row=r, column=col).fill = TOT; vj.cell(row=r, column=col).border = TOPB
r += 2
put(vj, f'A{r}', 'Square fees come from the Payments tab by customer. Crew pay comes from the Employees tab unless you type an override. Collected and price are from the app. Seed and fertilizer lb: Jen\'s quote where recorded, otherwise the lawn size x the rates above.', SUB)
dvs = DataValidation(type='list', formula1='"Done,Booked,Cancelled"', allow_blank=True); vj.add_data_validation(dvs); dvs.add(f'E{J_F}:E{J_L}')
dvb = DataValidation(type='list', formula1='"Sixfold,365"', allow_blank=True); vj.add_data_validation(dvb); dvb.add(f'C{J_F}:C{J_L}')
vj.freeze_panes = vj[f'C{T}']
VR = lambda col: f"'Variable per job'!${col}${J_F}:${col}${J_L}"

# ------------------------------------------------------------------ Profit
pf = wb.create_sheet('Profit', 1)
put(pf, 'A1', 'Sixfold profit', TITLE)
put(pf, 'A2', 'Money in is when Square took it. Job costs are in the month of the job (Done jobs only). October runs to the 21st. Yellow = still to fill in; until then those costs count as $0, so profit reads high.', SUB)
pf['A2'].alignment = Alignment(wrap_text=True); pf.merge_cells('A2:F2'); pf.row_dimensions[2].height = 30
pf.column_dimensions['A'].width = 46
for c in 'BCDE': pf.column_dimensions[c].width = 14
pf.column_dimensions['F'].width = 60
months = [('Aug 2026', '2026-08'), ('Sep 2026', '2026-09'), ('Oct 2026', '2026-10')]
for i, (lab, key) in enumerate(months):
    col = 'BCD'[i]
    c = pf[f'{col}4']; c.value = lab; c.font = HDR; c.fill = HFILL; c.alignment = Alignment(horizontal='center')
    put(pf, f'{col}5', key, SUB)
for col, t in (('A', ''), ('E', 'Total'), ('F', 'Where from')):
    c = pf[f'{col}4']; c.value = t; c.font = HDR; c.fill = HFILL
put(pf, 'A5', 'month key (do not edit)', SUB)

def mrow(r, label, ftmpl, note='', bold=False, fmt=USD, font=GREEN):
    put(pf, f'A{r}', label, bold=bold)
    for i in range(3):
        col = 'BCD'[i]; put(pf, f'{col}{r}', ftmpl.replace('{m}', f'{col}$5').replace('{c}', col), font if not bold else BLACK, fmt, bold=bold)
    put(pf, f'E{r}', f'=SUM(B{r}:D{r})', fmt=fmt, bold=bold)
    put(pf, f'F{r}', note, SUB)

def sec(r, t):
    for col in 'ABCDEF': pf[f'{col}{r}'].fill = SEC
    put(pf, f'A{r}', t, BOLD)

sec(7, 'Money in')
mrow(8, 'Payments received (after refunds)', f'=SUMIFS({PR("I")},{PR("B")},{{m}})', 'Payments tab')
mrow(9, 'Square fees', f'=SUMIFS({PR("H")},{PR("B")},{{m}})', 'Payments tab: the fee Square took on each card payment')
mrow(10, 'Money in after fees', '={c}8-{c}9', bold=True)
sec(12, 'Per-job costs (Done jobs)')
DONE = f',{VR("E")},"Done"'
mrow(13, 'Seed', f'=SUMIFS({VR("N")},{VR("AB")},{{m}}{DONE})', 'Variable per job')
mrow(14, 'Fertilizer', f'=SUMIFS({VR("Q")},{VR("AB")},{{m}}{DONE})', 'Variable per job')
mrow(15, 'Gas', f'=SUMIFS({VR("S")},{VR("AB")},{{m}}{DONE})', 'Variable per job (estimate from miles unless overridden)')
mrow(16, 'Other materials', f'=SUMIFS({VR("V")},{VR("AB")},{{m}}{DONE})', 'Variable per job')
mrow(17, 'Employee cost (20% of each job)', f'=SUMIFS({VR("X")},{VR("AB")},{{m}}{DONE})', 'Variable per job: 20% of each job\'s price')
mrow(18, 'Per-job costs', '=SUM({c}13:{c}17)', bold=True)
sec(20, 'Running costs')
put(pf, 'A21', 'Ad spend (Meta)')
ask(pf, 'B21', USD, 'Ad spend in August: fill in if there was any.'); ask(pf, 'C21', USD, 'Ad spend in September: fill in if there was any.')
put(pf, 'D21', f'={ADS_M}', GREEN, USD, note='Matthew, 21 Oct 2026: ads are $6,066 a month (Fixed costs tab). For comparison, the Meta screenshots of 19-20 Oct showed $845.19 spent from 13 to 20 Oct.')
put(pf, 'E21', '=SUM(B21:D21)', fmt=USD); put(pf, 'F21', 'October: $6,066 a month (Fixed costs tab). Aug and Sep: fill in if ads ran.', SUB)
put(pf, 'A22', 'Count set costs this month? (1 yes, 0 no)')
for col in 'BCD': put(pf, f'{col}22', 1, BLUE, '0', YEL)
put(pf, 'F22', 'Set a month to 0 if the business was not paying these yet.', SUB)
mrow(23, 'Set costs (truck, storage, aerator, card, software)', f'=({FIX_TOTAL}-{ADS_M})*{{c}}22', 'Fixed costs tab: monthly total without ads')
mrow(24, 'Pay not tied to a job (hourly, salary)', f'={EMP_TOTAL}*{{c}}22', 'Employees tab')
mrow(25, 'One-off purchases', f"=SUMIFS('Fixed costs'!$C${ONE_F}:$C${ONE_L},'Fixed costs'!$D${ONE_F}:$D${ONE_L},{{m}})", 'Fixed costs tab, one-off purchases table')
put(pf, 'A26', 'Running costs', bold=True)
for col in 'BCDE': put(pf, f'{col}26', f'=SUM({col}21,{col}23:{col}25)', fmt=USD, bold=True)
for col in 'ABCDEF': pf[f'{col}28'].border = TOPB; pf[f'{col}28'].fill = TOT
put(pf, 'A28', 'Net profit', bold=True)
for col in 'BCDE': put(pf, f'{col}28', f'={col}10-{col}18-{col}26', fmt=USD, bold=True)
put(pf, 'A29', 'Net margin (profit / money in)')
for col in 'BCDE': put(pf, f'{col}29', f'=IF({col}8<100,"",{col}28/{col}8)', fmt=PCT)

sec(31, 'Still to come in')
put(pf, 'A32', 'Owed on Done jobs'); put(pf, 'B32', f'=SUMIFS({VR("I")},{VR("E")},"Done")', GREEN, USD0); put(pf, 'C32', 'Brian S. owes $200', SUB)
put(pf, 'A33', 'Booked jobs: price'); put(pf, 'B33', f'=SUMIFS({VR("G")},{VR("E")},"Booked")', GREEN, USD0); put(pf, 'C33', 'Sreenivas (23 Oct) and Joseph (30 Oct)', SUB)
put(pf, 'A34', 'Booked jobs: deposits already in'); put(pf, 'B34', f'=SUMIFS({VR("H")},{VR("E")},"Booked")', GREEN, USD0)
put(pf, 'A35', 'Booked jobs: still to collect'); put(pf, 'B35', '=B33-B34', fmt=USD0)

sec(37, 'Each business to date (Done jobs, before running costs)')
for i, t in enumerate(['', 'Sixfold', '365', 'Both'], 0):
    c = pf.cell(row=38, column=1 + i, value=t or None); c.font = HDR; c.fill = HFILL
biz_rows = [('Jobs done', 'COUNTIFS({E},"Done",{C},"{b}")', '#,##0'),
            ('Job prices', 'SUMIFS({G},{E},"Done",{C},"{b}")', USD0),
            ('Per-job costs (materials, gas, fees, crew)', 'SUMIFS({Y},{E},"Done",{C},"{b}")', USD),
            ('Job profit', None, USD),
            ('Margin', None, PCT),
            ('Average price per job', None, USD0)]
for k, (lab, f, fmt) in enumerate(biz_rows):
    rr = 39 + k; put(pf, f'A{rr}', lab, bold=(lab == 'Job profit'))
    for j, b in enumerate(['Sixfold', '365']):
        col = 'BC'[j]
        if f: put(pf, f'{col}{rr}', '=' + f.replace('{E}', VR('E')).replace('{C}', VR('C')).replace('{G}', VR('G')).replace('{Y}', VR('Y')).replace('{b}', b), GREEN, fmt)
    for col in 'BCD':
        if lab == 'Job profit': put(pf, f'{col}{rr}', f'={col}40-{col}41', fmt=fmt, bold=True)
        elif lab == 'Margin': put(pf, f'{col}{rr}', f'=IF({col}40=0,0,{col}42/{col}40)', fmt=fmt)
        elif lab == 'Average price per job': put(pf, f'{col}{rr}', f'=IF({col}39=0,0,{col}40/{col}39)', fmt=fmt)
        elif col == 'D': put(pf, f'D{rr}', f'=B{rr}+C{rr}', fmt=fmt)
put(pf, 'A46', 'Per-job costs include the 20% employee cost. Margin is left blank in a month with under $100 in.', SUB)
sec(48, 'One week')
put(pf, 'A49', 'Week starting (a Monday)'); put(pf, 'B49', date(2026, 10, 12), BLUE, DT, YEL, note='Change this date to see another week. 12 Oct = last week, the same week as the Stats page.')
put(pf, 'C49', '=B49+6', fmt=DT); put(pf, 'D49', 'Sunday', SUB)
WK = f',{VR("A")},">="&$B$49,{VR("A")},"<="&$C$49,{VR("E")},"Done"'
wrows = [('Jobs done', f'=COUNTIFS({VR("E")},"Done",{VR("A")},">="&$B$49,{VR("A")},"<="&$C$49)', '#,##0'),
         ('Job prices', f'=SUMIFS({VR("G")}{WK})', USD),
         ('Per-job costs (seed, fertilizer, gas, Square fees, 20% employee cost)', f'=SUMIFS({VR("Y")}{WK})', USD),
         ('Set costs for a week (truck, storage, aerator, card, software)', f'={FIX_WEEK}-{ADS_W}', USD),
         ('Ads for a week', f'={ADS_W}', USD),
         ('Pay not tied to a job, for a week', f'={EMP_TOTAL}*12/52', USD)]
for k, (lab, f, fmt) in enumerate(wrows):
    put(pf, f'A{50 + k}', lab); put(pf, f'B{50 + k}', f, GREEN, fmt)
put(pf, 'A56', 'Profit for the week', bold=True); put(pf, 'B56', '=B51-B52-B53-B54-B55', fmt=USD, bold=True)
for col in 'ABCDEF': pf[f'{col}56'].border = TOPB; pf[f'{col}56'].fill = TOT
put(pf, 'A57', 'A week = a month x 12 / 52.', SUB)
pf.freeze_panes = 'B6'

for ws in wb.worksheets:
    ws.sheet_view.showGridLines = False if ws.title in ('Read me', 'Profit') else True
wb.active = 1
wb.calculation.fullCalcOnLoad = True
wb.save(OUT)
print('saved', OUT)
