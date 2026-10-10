# City of Thornton building permits -> thornton-permits.json (2026-10-10). Matthew requested the city's permit report
# (Building Permit Report 010116 - Current.xlsx, 2016-01-04 to the day it was pulled) and dropped it in raw/thornton/.
# Keeps only re-roofs ("Re-Roof") and solar ("Electrical PV Solar"), each as [street address, day, kind] like
# douglas-permits.json. Owner and contractor columns are never read into the output.
#   "C:/Users/Surge Inc/AppData/Local/Programs/Python/Python313/python.exe" -I convert-thornton.py
import json, os, re, glob, datetime, openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
src = sorted(glob.glob(os.path.join(HERE, 'raw', 'thornton', '*.xlsx')))[-1]

def norm_addr(a):   # the same as normAddr in fetch-douglas.mjs
    s = re.sub(r'[.,#]', ' ', str(a or '').upper())
    s = re.sub(r'\s+(UNIT|APT|STE)\s+\S+$', '', s)
    return re.sub(r'\s+', ' ', s).strip()

wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
rows = wb.worksheets[0].iter_rows(values_only=True)
for r in rows:
    if r and sum(1 for x in r if x not in (None, '')) >= 3:
        hdr = [str(x).strip() if x is not None else '' for x in r]; break
col = lambda part: next(i for i, h in enumerate(hdr) if part.lower() in h.lower())
i_type, i_work, i_date, i_num, i_addr = col('Type Of Construction'), col('Work Type'), col('date Issued'), col('permitnumber'), col('Project Address')

permits, days, n = {}, [], {'roof': 0, 'solar': 0}
for r in rows:
    t = str(r[i_type] or '').strip(); w = str(r[i_work] or '').strip().lower()
    kind = 'roof' if t == 'Re-Roof' else 'solar' if (t == 'Electrical PV Solar' or w.startswith('solar photovoltaic')) else None
    if not kind or not r[i_addr] or not r[i_date]: continue
    d = r[i_date]; day = d.strftime('%Y-%m-%d') if isinstance(d, (datetime.date, datetime.datetime)) else str(d)[:10]
    street = str(r[i_addr]).split(',')[0]
    permits[str(r[i_num] or len(permits))] = [norm_addr(street), day, kind]; days.append(day); n[kind] += 1
days.sort()
out = {'source': 'City of Thornton building permits (permit report requested by Matthew, 2026-10)', 'since': days[0], 'through': days[-1],
       'fetched': datetime.date.today().isoformat(), 'permits': permits}
json.dump(out, open(os.path.join(HERE, 'thornton-permits.json'), 'w', encoding='utf8'))
print(f"thornton-permits.json: {n['roof']} re-roofs, {n['solar']} solar, {days[0]} to {days[-1]}")
