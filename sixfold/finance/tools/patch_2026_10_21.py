"""2026-10-21, Matthew: set monthly costs (truck $1,000, ads $6,066, aerator $325, storage $414, trailer credit card $500) with a weekly
view; fertilizer $40 per 50 lb bag; a 20% employee cost on every job. One-off patch of build_expenses.py (kept for the record)."""
import io
p = __file__.replace('patch_2026_10_21.py', 'build_expenses.py')
s = io.open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    c = s.count(a)
    if c != 1:
        raise SystemExit(f'count {c} for: {a[:90]}')
    s = s.replace(a, b)


M = "Matthew, 21 Oct 2026: "

# ---- Fixed costs: weekly column, the new monthly figures, ads as their own section
rep(r"""hdr(fx, 4, ['Item', 'Vendor', 'Billed', 'Amount per bill ($)', 'Status', 'Sixfold share', 'Monthly cost ($)', 'Yearly cost ($)', 'Renews / next', 'Where the number came from'],
    [56, 22, 11, 14, 11, 11, 14, 14, 13, 70])""",
r"""hdr(fx, 4, ['Item', 'Vendor', 'Billed', 'Amount per bill ($)', 'Status', 'Sixfold share', 'Monthly cost ($)', 'Weekly cost ($)', 'Yearly cost ($)', 'Renews / next', 'Where the number came from'],
    [56, 22, 11, 14, 11, 11, 14, 13, 14, 13, 70])""")
rep(r"""    ('Aeration (monthly)', '', 'Monthly', None, 'Active', 1, '', 'You said aeration costs a set amount a month. Fill in what it is and how much.'),
    ('Storage unit, 333 W Hampden Ave', '', 'Monthly', None, 'Active', 1, '', 'The address is the app\'s travel base. Rent: fill in.'),""",
f"""    ('Aerator', '', 'Monthly', 325, 'Active', 1, '', '{M}$325 a month for the aerator.'),
    ('Storage unit, 333 W Hampden Ave', '', 'Monthly', 414, 'Active', 1, '', '{M}$414 a month for storage.'),
    ('Credit card payment (holds the trailers)', '', 'Monthly', 500, 'Active', 1, '', '{M}$500 a month on the credit card that holds the trailers.'),""")
rep(r"""    ('Truck 1: payment', '', 'Monthly', None, 'Active', 1, '', ''),
    ('Truck 1: insurance', '', 'Monthly', None, 'Active', 1, '', ''),
    ('Truck 1: registration', 'Colorado DMV', 'Yearly', None, 'Active', 1, '', ''),
    ('Truck 2: payment', '', 'Monthly', None, 'Active', 1, '', 'Set Stopped if there is only one truck.'),
    ('Truck 2: insurance', '', 'Monthly', None, 'Active', 1, '', ''),
    ('Truck 2: registration', 'Colorado DMV', 'Yearly', None, 'Active', 1, '', ''),""",
f"""    ('Truck', '', 'Monthly', 1000, 'Active', 1, '', '{M}truck $1,000 a month.'),
    ('Truck: insurance, if not in the $1,000', '', 'Monthly', None, 'Active', 1, '', 'Leave empty if the $1,000 already covers it.'),
    ('Truck: registration, if not in the $1,000', 'Colorado DMV', 'Yearly', None, 'Active', 1, '', ''),
    ('sec', 'Advertising'),
    ('ADS', 'Meta', 'Monthly', 6066, 'Active', 1, '', '{M}$6,066 a month for ads. On the Profit tab as its own line.'),""")
rep("""    first = first or r
    item, vend, billed, amt, status, share, renews, src = row""", """    first = first or r
    item, vend, billed, amt, status, share, renews, src = row
    if item == 'ADS': item = 'Ads (Meta)'; ADS_ROW = r""")
rep("""        for col in range(1, 11): fx.cell(row=r, column=col).fill = SEC""", """        for col in range(1, 12): fx.cell(row=r, column=col).fill = SEC""")
rep("""    put(fx, f'H{r}', f'=G{r}*12', fmt=USD)
    put(fx, f'I{r}', renews, BLUE); put(fx, f'J{r}', src, SUB)""", """    put(fx, f'H{r}', f'=G{r}*12/52', fmt=USD)
    put(fx, f'I{r}', f'=G{r}*12', fmt=USD)
    put(fx, f'J{r}', renews, BLUE); put(fx, f'K{r}', src, SUB)""")
rep("""put(fx, f'A{r}', 'Total fixed costs', bold=True)
put(fx, f'G{r}', f'=SUM(G{first}:G{last})', fmt=USD, bold=True); put(fx, f'H{r}', f'=SUM(H{first}:H{last})', fmt=USD, bold=True)
for col in range(1, 11): fx.cell(row=r, column=col).fill = TOT; fx.cell(row=r, column=col).border = TOPB
FIX_TOTAL = f"'Fixed costs'!$G${r}\"""", """put(fx, f'A{r}', 'Total set costs, ads included', bold=True)
for col in 'GHI': put(fx, f'{col}{r}', f'=SUM({col}{first}:{col}{last})', fmt=USD, bold=True)
for col in range(1, 12): fx.cell(row=r, column=col).fill = TOT; fx.cell(row=r, column=col).border = TOPB
FIX_TOTAL = f"'Fixed costs'!$G${r}"; FIX_WEEK = f"'Fixed costs'!$H${r}"
ADS_M = f"'Fixed costs'!$G${ADS_ROW}"; ADS_W = f"'Fixed costs'!$H${ADS_ROW}\"""")
rep("""put(fx, 'A2', 'What Sixfold pays whether or not there is a job. Monthly cost = the bill turned into a month, times Sixfold\\'s share. Status "Planned" or "Stopped" counts as 0.', SUB)""",
    """put(fx, 'A2', 'What Sixfold pays whether or not there is a job. Monthly cost = the bill turned into a month, times Sixfold\\'s share; weekly = monthly x 12 / 52. Status "Planned" or "Stopped" counts as 0.', SUB)""")

# ---- fertilizer $40 per 50 lb bag
rep(r"""    ('Fertilizer: price per bag ($)', 58.99, USD, 'LESCO 24-0-11, True Value list price Oct 2026. Not a Sixfold receipt: put SiteOne\'s price in if it differs.'),""",
    f"""    ('Fertilizer: price per bag ($)', 40, USD, '{M}$40 for a 50 lb bag.'),""")
rep(r"""    ('Fertilizer price: LESCO 24-0-11 at True Value list price $58.99 for 50 lb (Oct 2026). Not a Sixfold receipt: put SiteOne\'s price in if it differs.', None),""",
    """    ('Fertilizer price: $40 for a 50 lb bag (your figure, 21 Oct 2026), at LESCO 24-0-11\\'s label rate.', None),""")

# ---- employee cost: 20% of every job's price
rep(r"""    ('Road miles per straight-line mile', 1.3, '0.0', 'The app\'s setting: roads are about 30% longer than a straight line.'),""",
    r"""    ('Road miles per straight-line mile', 1.3, '0.0', 'The app\'s setting: roads are about 30% longer than a straight line.'),
    ('Employee cost: share of each job\'s price', 0.2, PCT, 'Matthew, 21 Oct 2026: a 20% employee cost on every job.'),""")
rep("""    put(vj, f'X{r}', f'=IF(W{r}<>"",N(W{r}),IFERROR(IF(INDEX({EMP_H},MATCH(F{r},{EMP_N},0))="Per job ($)",N(INDEX({EMP_R},MATCH(F{r},{EMP_N},0))),IF(INDEX({EMP_H},MATCH(F{r},{EMP_N},0))="Per job (% of price)",N(INDEX({EMP_R},MATCH(F{r},{EMP_N},0)))*G{r},0)),0))', GREEN, USD)""",
    """    put(vj, f'X{r}', f'=IF(W{r}<>"",N(W{r}),G{r}*{VI[9]})', fmt=USD)""")
rep("""                        ('X', '=IF(G{r}="","",IF(W{r}<>"",N(W{r}),IFERROR(IF(INDEX(' + EMP_H + ',MATCH(F{r},' + EMP_N + ',0))="Per job ($)",N(INDEX(' + EMP_R + ',MATCH(F{r},' + EMP_N + ',0))),IF(INDEX(' + EMP_H + ',MATCH(F{r},' + EMP_N + ',0))="Per job (% of price)",N(INDEX(' + EMP_R + ',MATCH(F{r},' + EMP_N + ',0)))*G{r},0)),0)))', USD),""",
    """                        ('X', '=IF(G{r}="","",IF(W{r}<>"",N(W{r}),G{r}*' + VI[9] + '))', USD),""")
rep("""'Square fees ($)', 'Other materials ($)', 'Crew pay override ($)', 'Crew pay ($)',""", """'Square fees ($)', 'Other materials ($)', 'Employee cost override ($)', 'Employee cost, 20% ($)',""")
rep("""mrow(17, 'Crew pay (per job)', f'=SUMIFS({VR("X")},{VR("AB")},{{m}}{DONE})', 'Variable per job, from the Employees tab')""",
    """mrow(17, 'Employee cost (20% of each job)', f'=SUMIFS({VR("X")},{VR("AB")},{{m}}{DONE})', 'Variable per job: 20% of each job\\'s price')""")
rep("""put(pf, 'A46', 'Per-job costs leave out crew pay until the Employees tab is filled in. Margin is left blank in a month with under $100 in.', SUB)""",
    """put(pf, 'A46', 'Per-job costs include the 20% employee cost. Margin is left blank in a month with under $100 in.', SUB)""")
rep("""put(em, 'A2', 'Paid how: "Per job ($)" = a flat amount each job; "Per job (% of price)" = a share of the job price (type 30% as 30%); "Hourly" = rate x hours a month; "Salary (monthly)" = the month\\'s pay; "Not paid" = owner or unpaid. Per-job pay shows on each job, not in the monthly total.', SUB)""",
    """put(em, 'A2', 'The crew on each job costs 20% of the job price, set on the Variable per job tab. Use this tab only for pay NOT tied to a job: "Hourly" = rate x hours a month; "Salary (monthly)" = the month\\'s pay; "Per job" or "Not paid" = nothing extra here.', SUB)""")
rep("""r += 2; put(em, f'A{r}', 'Example: Brad on "Per job ($)" with Rate 100 puts $100 of crew pay on each of his jobs. On "Per job (% of price)" with Rate 30% he gets 30% of each job price.', SUB)""",
    """r += 2; put(em, f'A{r}', 'Example: an office person on "Hourly" at 20 for 80 hours a month adds $1,600 a month here. Crew paid from jobs stay "Per job" (covered by the 20%).', SUB)""")
rep("""    ('Employees: who is paid and how. Set "Per job" pay here once and it fills in on every job that person did.', None),""",
    """    ('Employees: pay not tied to a job (hourly or salary). The crew on each job is the 20% employee cost on the Variable per job tab.', None),""")
rep("""    ('Variable per job: every job with its seed, fertilizer, gas, card fees and crew pay, and what the job made.', None),""",
    """    ('Variable per job: every job with its seed, fertilizer, gas, card fees and the 20% employee cost, and what the job made.', None),""")
rep("""    ('5. Pay: how Brad, Jen, Nneka and Cai are paid (per job, hourly, salary, a share of the job) and the rate. No pay is recorded in the app.', None),""",
    """    ('5. Pay not tied to a job: is anyone (Jen, Nneka, Cai) paid hourly or a salary on top of the 20% per job?', None),""")

# ---- Profit: ads from the Fixed costs tab; set costs without ads; one-week view
rep(r"""put(pf, 'D21', '=169.28+134.84+541.07', BLUE, USD, note='Matthew\'s Meta screenshots, 19-20 Oct: Instant Form ad 13-14 Oct $169.28, Instant Form ad since 19 Oct $134.84, Messenger ad since 15 Oct $541.07. Lifetime figures as of 20 Oct, all in October. The 365 ad account\'s earlier spend is not included (question 9).')
put(pf, 'E21', '=SUM(B21:D21)', fmt=USD); put(pf, 'F21', 'Meta screenshots 19-20 Oct (same as the Stats page). Aug and Sep: fill in.', SUB)""",
r"""put(pf, 'D21', f'={ADS_M}', GREEN, USD, note='Matthew, 21 Oct 2026: ads are $6,066 a month (Fixed costs tab). For comparison, the Meta screenshots of 19-20 Oct showed $845.19 spent from 13 to 20 Oct.')
put(pf, 'E21', '=SUM(B21:D21)', fmt=USD); put(pf, 'F21', 'October: $6,066 a month (Fixed costs tab). Aug and Sep: fill in if ads ran.', SUB)""")
rep("""put(pf, 'A22', 'Count fixed costs this month? (1 yes, 0 no)')""", """put(pf, 'A22', 'Count set costs this month? (1 yes, 0 no)')""")
rep("""mrow(23, 'Fixed costs', f'={FIX_TOTAL}*{{c}}22', 'Fixed costs tab: monthly total')""",
    """mrow(23, 'Set costs (truck, storage, aerator, card, software)', f'=({FIX_TOTAL}-{ADS_M})*{{c}}22', 'Fixed costs tab: monthly total without ads')""")
rep("""pf.freeze_panes = 'B6'""", """sec(48, 'One week')
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
pf.freeze_panes = 'B6'""")

# ---- Read me
rep(r"""    ('1. "Aeration x amount a month": what is it (machine payment, rental, payment to someone) and how much?', None),
    ('2. Storage unit at 333 W Hampden Ave: monthly rent.', None),
    ('3. Trucks: how many, and each one\'s payment, insurance and registration.', None),""",
"""    ('Answered 21 Oct: truck $1,000, ads $6,066, aerator $325, storage $414, trailer credit card $500 (all a month); fertilizer $40 a bag; employees 20% of every job.', None),
    ('3. Truck: does the $1,000 include insurance and registration?', None),""")
rep("""    ('Ad spend: your Meta screenshots of 19-20 Oct, the same figures the Stats page uses.', None),""",
    """    ('Truck, ads, aerator, storage, the trailer credit card, the fertilizer price and the 20% employee cost: your figures, 21 Oct 2026.', None),""")
rep(r"""    ('9. Ad spend before October, and whether the 365 ad account\'s earlier spend (Pipeline read $600 lifetime on it) is already inside the October figures. I could not tell, so it is left out.', None),""",
    """    ('9. Did ads run in August or September?', None),""")
rep("""    ('Fixed costs: websites, software, platforms, storage, trucks, insurance, the monthly aeration cost. Monthly and yearly side by side.', None),""",
    """    ('Fixed costs: websites, software, storage, the truck, the aerator, the trailer card, insurance and ads. Monthly, weekly and yearly side by side.', None),""")
rep("""    ('Profit: money in, per-job costs, fixed costs and net profit by month (Aug, Sep, Oct 2026), plus each business to date.', None),""",
    """    ('Profit: money in, per-job costs, set costs, ads and net profit by month (Aug, Sep, Oct 2026), each business to date, and one week (pick the Monday).', None),""")

io.open(p, 'w', encoding='utf-8').write(s)
print('patched')
