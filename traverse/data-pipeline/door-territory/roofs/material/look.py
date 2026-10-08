"""Spot-check: draw a few crops with their house outline and the roof mask the feature step uses.
   python look.py <town> [n=12] [start=0] [out=look.png]   (PNGs are gitignored here; delete after looking)"""
import sys, json, gzip, io
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from features import load_crop, roof_mask, ring_px

HERE = Path(__file__).parent
town = sys.argv[1] if len(sys.argv) > 1 else 'larkspur'
n = int(sys.argv[2]) if len(sys.argv) > 2 else 12
start = int(sys.argv[3]) if len(sys.argv) > 3 else 0
out = sys.argv[4] if len(sys.argv) > 4 else 'look.png'
houses = json.loads((HERE / 'cache' / f'houses-{town}.json').read_text())
idx = json.loads((HERE / 'cache' / f'crops-{town}.json').read_text())
want = sys.argv[5] if len(sys.argv) > 5 else None   # e.g. "Concrete Tile": only houses the county lists as that
labels = {}
yf = HERE.parents[3] / 'app' / 'data' / 'rounds' / f'year-{town}.json'
if yf.exists():
    labels = {k: v.get('mat') for k, v in json.loads(yf.read_text())['doors'].items()}
if want and want.startswith('pred:'):   # "pred:asphalt": houses the finished material-<town>.json calls that, from imagery
    mf = json.loads((HERE.parents[3] / 'app' / 'data' / 'rounds' / f'material-{town}.json').read_text())['doors']
    labels = {k: f"{v['m']} {v['p']} ({v['src']})" for k, v in mf.items()}
    sel = {k for k, v in mf.items() if v['src'] == 'imagery' and v['m'] == want[5:]}
    ids = [i for i in idx if i in sel and 'err' not in idx[i]][start:start + n]
else:
    ids = [i for i in idx if 'err' not in idx[i] and (want is None or labels.get(i) == want) and (HERE / 'cache' / 'crops' / town / (i + '.npy.gz')).exists()][start:start + n]
T = 160
cols = 4
rows = (len(ids) + cols - 1) // cols
sheet = Image.new('RGB', (cols * T * 2, rows * (T + 14)), 'black')
dr = ImageDraw.Draw(sheet)
for k, id_ in enumerate(ids):
    a = load_crop(town, id_)
    h, meta = houses[id_], idx[id_]
    rgb = Image.fromarray(np.moveaxis(a[:3], 0, -1))
    m = roof_mask(a, h, meta)
    ov = rgb.copy(); d2 = ImageDraw.Draw(ov)
    if h['ring']:
        d2.polygon([tuple(p) for p in ring_px(h['ring'], meta)], outline=(255, 255, 0))
    mm = Image.fromarray((m * 255).astype(np.uint8)).convert('RGB')
    red = Image.new('RGB', mm.size, (255, 0, 255))
    ov = Image.composite(Image.blend(ov, red, 0.45), ov, Image.fromarray((m * 255).astype(np.uint8)))
    x, y = (k % cols) * T * 2, (k // cols) * (T + 14)
    sheet.paste(rgb.resize((T, T)), (x, y)); sheet.paste(ov.resize((T, T)), (x + T, y))
    dr.text((x + 2, y + T), f"{id_[:22]} {labels.get(id_, '')} {h['how']} {int(m.sum())}px", fill='white')
sheet.save(HERE / out)
print('wrote', out, ids)
