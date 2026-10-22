"""Aerator gas on every job (2026-10-21, Matthew: "add the bobcat AE26 costs into both our costs spreadsheets ... we work on data").

Patches Sixfold-Expenses-and-Profit.xlsx in place (never rebuilds it, so typed entries stay):
- Variable per job: inputs in AD5:AF9 (Bobcat AE26-HON tank, Honda GX120 burn, Bobcat's top coverage, a real-pace %), a new
  column AC "Aerator gas ($)" = lawn sq ft / (coverage x pace) x gallons per hour x the gas price in D11, and each job's cost (Y)
  includes it.
- Profit: the Gas line becomes "Gas (truck + aerator)" (S + AC), so no row moves.
Run once: python patch_2026_10_21_aerator.py (refuses to run twice).
"""
import shutil
from pathlib import Path
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment

F = Path(__file__).resolve().parent.parent / 'Sixfold-Expenses-and-Profit.xlsx'
wb = load_workbook(F)
ws = wb['Variable per job']
if ws['AC15'].value:
    raise SystemExit('already patched: AC15 = ' + str(ws['AC15'].value))
shutil.copy(F, F.with_name('Sixfold-Expenses-before-aerator.xlsx'))

head = ws['AB15']
YEL = PatternFill('solid', fgColor='FFF4C2')
# inputs, to the right of the jobs table
ws['AD4'] = 'Aerator gas inputs'; ws['AD4'].font = Font(bold=True)
rows = [
    ('Aerator: fuel tank (gal)', 0.5, '0.00', 'Bobcat AE26-HON spec page (new.bobcat.com, read 2026-10-21): 0.5 gal. Honda lists the GX120 tank as 2.0 L.'),
    ('Aerator: fuel burn (gal per hour)', 0.2642, '0.000', 'Honda GX120: 1.0 L/h at rated power (3,600 rpm), as republished by Honda dealers; not found on Honda’s own site. Full throttle: the most it burns.'),
    ('Aerator: coverage (sq ft per hour)', 40400, '#,##0', 'Bobcat AE26 maximum productivity at 3.5 mph, 26.5 in wide. No turns, trees or overlap: real jobs are slower.'),
    ('Aerator: real pace (share of Bobcat’s top rate)', 1.0, '0%', 'Yours to set. 100% = Bobcat’s figure (the least gas). Lower it once fill-ups show what a tank really covers.'),
    ('Aerator: sq ft per tank', '=AE5/AE6*AE7*AE8', '#,##0', 'Worked out: tank / burn x coverage x pace.'),
]
for i, (label, val, fmt, note) in enumerate(rows):
    r = 5 + i
    ws[f'AD{r}'] = label; ws[f'AE{r}'] = val; ws[f'AE{r}'].number_format = fmt; ws[f'AF{r}'] = note
    ws[f'AF{r}'].alignment = Alignment(wrap_text=False)
    if r == 8: ws[f'AE{r}'].fill = YEL
ws.column_dimensions['AD'].width = 40; ws.column_dimensions['AE'].width = 11; ws.column_dimensions['AF'].width = 60
ws['A3'] = 'Aerator gas inputs are at the right of the table (columns AD to AF).'; ws['A3'].font = Font(italic=True, color='666666')
# the column
ws['AC15'] = 'Aerator gas ($)'
ws['AC15'].font = head.font.copy(); ws['AC15'].fill = head.fill.copy(); ws['AC15'].alignment = head.alignment.copy(); ws['AC15'].border = head.border.copy()
ws.column_dimensions['AC'].width = 11
for r in range(16, 35):
    blank_row = str(ws[f'Y{r}'].value or '').startswith('=IF(G')
    core = f'N(J{r})/($AE$7*$AE$8)*$AE$6*$D$11'
    ws[f'AC{r}'] = f'=IF(G{r}="","",{core})' if blank_row else f'={core}'
    ws[f'AC{r}'].number_format = ws[f'S{r}'].number_format; ws[f'AC{r}'].border = ws[f'S{r}'].border.copy()
    y = ws[f'Y{r}'].value
    if blank_row:
        assert y.endswith('+N(X%d))' % r), y
        ws[f'Y{r}'] = y[:-1] + f'+N(AC{r}))'
    else:
        assert y == f'=N{r}+Q{r}+S{r}+U{r}+N(V{r})+X{r}', y
        ws[f'Y{r}'] = y + f'+N(AC{r})'
note = ws['A37'].value or ''
ws['A37'] = note + ' Aerator gas: lawn sq ft over the Bobcat’s coverage, times its fuel per hour and the gas price (inputs at AD5:AE9); a job with no lawn size has none.'
# Profit: Gas = truck + aerator
p = wb['Profit']
assert p['A15'].value == 'Gas', p['A15'].value
p['A15'] = 'Gas (truck + aerator)'
for col in 'BCD':
    f = p[f'{col}15'].value
    assert '$S$16:$S$34' in f, f
    p[f'{col}15'] = f + '+' + f[1:].replace('$S$16:$S$34', '$AC$16:$AC$34')
if p['E15'].value and '$S$16' in str(p['E15'].value):
    f = p['E15'].value; p['E15'] = f + '+' + f[1:].replace('$S$16:$S$34', '$AC$16:$AC$34')
wb.save(F)
print('patched', F)
