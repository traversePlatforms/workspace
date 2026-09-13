"""
Rasterises a PDF into a tiled contact sheet PNG so a whole document can be
looked at in one image.

Why it exists: PDFs built by tools/html-to-pdf.mjs have to be checked by eye —
page fit, orphaned headings, panels split across a break — and there is no PDF
viewer in this loop. pypdfium2 and Pillow are already installed; poppler is not.

Run:  python tools/pdf-contact-sheet.py <file.pdf> [out.png] [--cols N] [--scale S]
"""
import sys
from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageDraw

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opts = {a.split("=")[0]: a.split("=")[1] for a in sys.argv[1:] if a.startswith("--") and "=" in a}

src = Path(args[0])
out = Path(args[1]) if len(args) > 1 else src.with_suffix(".sheet.png")
cols = int(opts.get("--cols", 4))
scale = float(opts.get("--scale", 1.1))

pdf = pdfium.PdfDocument(str(src))
tiles = [p.render(scale=scale).to_pil().convert("RGB") for p in pdf]

w = max(t.width for t in tiles)
h = max(t.height for t in tiles)
cols = min(cols, len(tiles))
rows = (len(tiles) + cols - 1) // cols
gap, label = 14, 22

sheet = Image.new("RGB", (cols * w + (cols + 1) * gap,
                          rows * (h + label) + (rows + 1) * gap), (110, 110, 110))
draw = ImageDraw.Draw(sheet)
for i, t in enumerate(tiles):
    x = gap + (i % cols) * (w + gap)
    y = gap + (i // cols) * (h + label + gap)
    draw.text((x + 2, y + 5), f"page {i + 1}", fill=(255, 255, 255))
    sheet.paste(t, (x, y + label))
    draw.rectangle([x, y + label, x + t.width - 1, y + label + t.height - 1], outline=(30, 30, 30))

sheet.save(out)
print(f"{out}  {len(tiles)} pages  {sheet.width}x{sheet.height}")
