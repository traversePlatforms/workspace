# The field positions of a PACS (True Automation / Harris Govern) appraisal export, from its layout spreadsheet (16 Nov 2026: Galveston
# and Brazoria CADs publish their certified rolls in this format). One sheet; each file's fields follow a "File #N: ... (APPRAISAL_X.TXT)"
# row, as rows of name, type, start, end, length, description. Writes { "APPRAISAL_INFO": { field: [start, end] }, ... } (1-based, inclusive).
#   python -I pacs-layout.py "<Appraisal Export Layout - 8.0.xx.xlsx>" <out.json>
import sys, json, re, openpyxl
wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
out, cur = {}, None
for r in wb.worksheets[0].iter_rows(values_only=True):
    r = [("" if c is None else str(c)).strip() for c in r]
    m = re.search(r"File #\d+:.*\((APPRAISAL_[A-Z_]+)\.TXT\)", r[0] if r else "", re.I)
    if m: cur = m.group(1).upper(); out[cur] = {}; continue
    if cur and len(r) >= 5 and r[0] and re.fullmatch(r"\d+(\.0)?", r[2]) and re.fullmatch(r"\d+(\.0)?", r[3]):
        out[cur][r[0]] = [int(float(r[2])), int(float(r[3]))]
json.dump(out, open(sys.argv[2], "w"), indent=0)
for k, v in out.items(): print(k, len(v))
