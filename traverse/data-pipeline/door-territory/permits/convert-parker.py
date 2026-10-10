# Town of Parker building permits -> parker-permits.json (2026-10-10). Parker answered Matthew's records request with a
# shared folder of monthly reports, January 2023 to September 2026 (raw/parker/full/<year>/<month>/): "All Permits
# Issued" as PDF, and as Excel for July-September 2026. Keeps only re-roofs (subtype REROOF) and solar (subtype SOLAR)
# that were issued, each as [parcel number, day, kind]: the reports carry the county's 12-digit parcel number
# ("ADDRESS POINT GEO RECORD"), the same one parker.csv has, so build-permits matches on it as it does for El Paso.
# Applicant names are never read into the output.
#
# Most PDFs are spreadsheets printed without grid lines, so the table reader finds nothing in them. Every PDF is read
# from word positions instead: each permit's line is the one with its issue date (cells sit on that line, or end on
# it), the columns start where the words on those lines start, and the subtype and parcel are read from that line.
# The ten ruled PDFs (early 2023) centre their cells, so there the subtype is often not on the date's line: they are read
# as tables, and the word reading is compared with the table on the months where both work, which is its check.
#   "C:/Users/Surge Inc/AppData/Local/Programs/Python/Python313/python.exe" -I convert-parker.py
import json, os, re, glob, datetime, collections, openpyxl, pdfplumber

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, 'raw', 'parker', 'full')
DATE = re.compile(r'\d\d/\d\d/\d{4}')
NUM = re.compile(r'[A-Z]{2,6}\d\d-\d{3,5}')
PARCEL = re.compile(r'\d{12}')
ALL = re.compile(r'all\s+per?n?mits', re.I)   # "All Permits Issued April", "All Pernits Issued November", ...
BAD = re.compile(r'VOID|CANCEL|WITHDRAW|DENIED', re.I)

def kind_of(sub):
    s = re.sub(r'\s+', '', str(sub or '').upper())
    return 'roof' if s == 'REROOF' else 'solar' if 'SOLAR' in s else None
def iso(d):
    if isinstance(d, (datetime.date, datetime.datetime)): return d.strftime('%Y-%m-%d')
    m, dd, y = str(d).strip()[:10].split('/'); return f'{y}-{m}-{dd}'

def by_words(pdf):
    """[(num, day, status, subtype, parcel)] for every dated line, read from word positions."""
    pages = []
    for p in pdf.pages:
        lines = collections.defaultdict(list)
        for w in p.extract_words(): lines[round(w['bottom'] / 3)].append(w)
        dated = [sorted(ws, key=lambda w: w['x0']) for ws in lines.values() if any(DATE.fullmatch(w['text']) and w['x0'] < 160 for w in ws)]
        pages.append(dated)
    allines = [ln for pg in pages for ln in pg]
    if not allines: return [], 'no dated lines'
    bins = collections.Counter()
    for ln in allines:
        for x in {round(w['x0'] / 6) for w in ln}: bins[x] += 1
    starts = []
    for b in sorted(b for b, c in bins.items() if c >= 0.2 * len(allines)):
        if not starts or b - starts[-1][-1] > 2: starts.append([b])
        else: starts[-1].append(b)
    starts = [min(g) * 6 - 3 for g in starts]   # left edge of each column
    # columns counted from the date's own column: some printouts have spreadsheet row numbers to its left
    dcol = collections.Counter(max(i for i, st in enumerate(starts) if st <= w['x0']) for ln in allines for w in ln if DATE.fullmatch(w['text']) and w['x0'] >= starts[0]).most_common(1)[0][0]
    if len(starts) < dcol + 6: return [], f'only {len(starts)} columns found'
    out = []
    for ln in allines:
        col = lambda i: ' '.join(w['text'] for w in ln if starts[i] <= w['x0'] < (starts[i + 1] if i + 1 < len(starts) else 1e9))
        date = next(w['text'] for w in ln if DATE.fullmatch(w['text']))
        num = next((w['text'] for w in ln if NUM.fullmatch(w['text'])), None)
        parcel = next((w['text'] for w in ln if PARCEL.fullmatch(w['text'])), None)
        out.append((num, iso(date), col(dcol + 1), col(dcol + 4), parcel))
    return out, None

def by_table(pdf):
    out = []
    for p in pdf.pages:
        for tb in p.extract_tables():
            for r in tb:
                if r and len(r) >= 10 and DATE.fullmatch((r[0] or '').strip()):
                    parcel = next((c.strip() for c in r[5:] if c and PARCEL.fullmatch(c.strip())), None)   # its column moves when a month adds DESCRIPTION
                    out.append((re.sub(r'\s+', '', r[2] or ''), iso(r[0]), r[1], (r[4] or '').replace('\n', ' '), parcel))
    return out

permits, notes, n = {}, [], {'roof': 0, 'solar': 0, 'no parcel': 0}
def keep(num, day, status, sub, parcel):
    k = kind_of(sub)
    if not k or BAD.search(str(status or '')): return
    if not parcel or not PARCEL.fullmatch(str(parcel)): n['no parcel'] += 1; return
    if not num or not NUM.fullmatch(num): num = f'{parcel}-{day}-{k}'   # number wrapped onto two lines in the printout
    if num not in permits: n[k] += 1
    permits[num] = [str(parcel), day, k]

for f in sorted(glob.glob(os.path.join(ROOT, '*', '*', '*'))):
    name = os.path.basename(f)
    if not ALL.search(name): continue
    if f.lower().endswith('.pdf'):
        with pdfplumber.open(f) as pdf:
            rows, err = by_words(pdf)
            if err: notes.append(f'{name}: {err}'); continue
            txt = sum(len(DATE.findall(p.extract_text() or '')) for p in pdf.pages)
            if len(rows) != txt: notes.append(f'{name}: {len(rows)} dated lines but {txt} dates in the text')
            nonum = sum(1 for r in rows if not r[0])
            if nonum: notes.append(f'{name}: {nonum} lines without a permit number')
            tab = by_table(pdf)
            if tab:   # ruled: compare the two readings on the rows that matter
                a = {r[0]: (kind_of(r[3]), r[4]) for r in rows if kind_of(r[3])}
                b = {r[0]: (kind_of(r[3]), r[4]) for r in tab if kind_of(r[3])}
                bad = [k for k in set(a) | set(b) if a.get(k) != b.get(k)]
                notes.append(f'{name}: ruled, words vs table on re-roof/solar rows: {"agree" if not bad else "DIFFER on " + str(len(bad))} ({len(a)} vs {len(b)})')
                for k in bad[:2]: notes.append(f'      {k}: words {a.get(k)} table {b.get(k)}')
            use = tab if tab and len(tab) >= 0.95 * txt else rows
            for r in use: keep(*r)
    elif f.lower().endswith('.xlsx'):
        ws = openpyxl.load_workbook(f, read_only=True, data_only=True).worksheets[0]
        it = ws.iter_rows(values_only=True)
        for r in it:
            if r and 'PERMIT NUMBER' in [str(x).strip().upper() for x in r if x]: hdr = [str(x or '').strip().upper() for x in r]; break
        c = {h: i for i, h in enumerate(hdr)}
        for r in it:
            if not r[c['PERMIT ISSUED DATE']]: continue
            g = r[c['ADDRESS POINT GEO RECORD']]
            keep(re.sub(r'\s+', '', str(r[c['PERMIT NUMBER']] or '')), iso(r[c['PERMIT ISSUED DATE']]), r[c['STATUS']], r[c['PERMIT SUBTYPE']], str(int(g)) if isinstance(g, (int, float)) else g)

days = sorted(p[1] for p in permits.values())
by_year = collections.Counter((p[1][:4], p[2]) for p in permits.values())
out = {'source': 'Town of Parker building division (monthly permit reports, records request by Matthew, 2026-10)', 'key': 'parcel',
       'since': days[0], 'through': days[-1], 'fetched': datetime.date.today().isoformat(), 'permits': permits}
json.dump(out, open(os.path.join(HERE, 'parker-permits.json'), 'w', encoding='utf8'))
for x in notes: print('  ', x)
print('by year:', ' '.join(f'{y} {by_year[(y, "roof")]}r/{by_year[(y, "solar")]}s' for y in sorted({y for y, _ in by_year})))
print(f"parker-permits.json: {n['roof']} re-roofs, {n['solar']} solar ({n['no parcel']} kept out: no parcel number), {days[0]} to {days[-1]}")
