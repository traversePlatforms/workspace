"""
Concatenate PDFs into one packet, preserving each source exactly.

Why merge the PDFs rather than merge the HTML: each document carries its own
`@media print` fit pass keyed to `.sheet:first-of-type`, and the agreement has
sixteen such rules tuned to ITS page 1. Put the quote sheet first in a combined
HTML and every one of those rules lands on the wrong page. Merging the rendered
PDFs also preserves the per-document `scale` set in tools/html-to-pdf.mjs
(the quote prints at 0.84, the agreement at the 0.8 default).

Run:  python tools/merge-pdf.py <out.pdf> <in1.pdf> <in2.pdf> [...]
"""
import sys
from pathlib import Path

import pypdfium2 as pdfium

args = sys.argv[1:]
if len(args) < 2:
    sys.exit("usage: merge-pdf.py <out.pdf> <in1.pdf> <in2.pdf> [...]")

out = Path(args[0])
srcs = [Path(a) for a in args[1:]]
for s in srcs:
    if not s.exists():
        sys.exit(f"missing: {s}")

dest = pdfium.PdfDocument.new()
tally = []
# Keep each source document open until the save: pypdfium2 imports pages by
# reference, and closing a source early yields blank pages in the output.
keep = []
for s in srcs:
    doc = pdfium.PdfDocument(str(s))
    keep.append(doc)
    n = len(doc)
    dest.import_pages(doc)
    tally.append((s.name, n))

dest.save(str(out))
total = sum(n for _, n in tally)
for name, n in tally:
    print(f"  {n:>2} page(s)  {name}")
print(f"  {total:>2} page(s)  -> {out}  ({out.stat().st_size / 1024:.0f} KB)")

check = pdfium.PdfDocument(str(out))
if len(check) != total:
    sys.exit(f"FAIL: output has {len(check)} pages, expected {total}")
print(f"verified: {len(check)} pages")
