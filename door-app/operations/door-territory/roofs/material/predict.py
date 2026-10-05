"""Step 5: a roof material for every house that can carry one, in the app's data folder.

Writes site/data/rounds/material-<town>.json:
  { source, built, classes, thresholds, doors: { id: { m: 'asphalt'|'tile'|'shake'|'metal'|'flat', p: 0-1, src: 'county'|'imagery' } } }
Where Douglas County's assessor has the material it is used as is (src county, p 1). Everywhere else the model's
call is written only when its probability clears that class's threshold (model-report.json, from the held-out
cross-validation), and only for crops with enough clear roof pixels. Houses below the threshold are left out.
  python predict.py [town ...]
"""
import json, pickle, sys, time
from pathlib import Path
import numpy as np
import pandas as pd
from features import MIN_PX, CLASS_OF, TOWNS

HERE = Path(__file__).parent
CACHE = HERE / 'cache'
DATA = HERE.parents[3] / 'site' / 'data' / 'rounds'


def main(towns):
    with open(CACHE / 'model.pkl', 'rb') as f:
        M = pickle.load(f)
    model, cols, classes, th = M['model'], M['features'], M['classes'], M['thresholds']
    usable = {c: t['t'] for c, t in th.items() if t}
    print('thresholds in use:', usable, '| no threshold reached 90%:', [c for c in classes if not th.get(c)])
    built = time.strftime('%Y-%m-%d')
    summary = {}
    for town in towns:
        f = CACHE / f'features-{town}.csv'
        if not f.exists():
            print(town, 'no features'); continue
        df = pd.read_csv(f)
        yf = DATA / f'year-{town}.json'
        county = {k: CLASS_OF[v['mat']] for k, v in (json.loads(yf.read_text())['doors'].items() if yf.exists() else []) if v.get('mat') in CLASS_OF}
        doors = {}
        for id_, cls in county.items():
            doors[id_] = {'m': cls, 'p': 1, 'src': 'county'}
        # no building outline means the window is a 6 m disc on the parcel point, which can sit on trees or lawn: skipped
        ok = df[(df.roof_px >= MIN_PX) & (df.nofp == 0)].reset_index(drop=True)
        # the chosen model leans on year built and the LiDAR roof size; the Teller towns have neither, and the
        # imagery-only model reached 90% precision in no class, so they get no imagery calls (see README)
        has_struct = (DATA / f'year-{town}.json').exists() and (DATA / f'roof-{town}.json').exists()
        if not has_struct:
            print(f'{town}: no year/roof data, imagery-only model reaches no threshold -> no imagery calls')
            ok = ok.iloc[0:0]
        if len(ok):
            P = np.zeros((len(ok), len(classes)))
            pp = model.predict_proba(ok[cols].to_numpy(np.float64))
            for j, c in enumerate(model.classes_): P[:, c] = pp[:, j]
            pred = P.argmax(1)
            for i, id_ in enumerate(ok.id):
                if id_ in doors: continue
                c = classes[pred[i]]; p = float(P[i, pred[i]])
                if c in usable and p >= usable[c]:
                    doors[id_] = {'m': c, 'p': round(p, 2), 'src': 'imagery'}
        n_doors = sum(len(a['doors']) for a in json.loads((DATA / f'{town}.json').read_text())['areas'])
        n_county = sum(1 for d in doors.values() if d['src'] == 'county'); n_img = len(doors) - n_county
        by_cls = {}
        for d in doors.values(): by_cls[d['m']] = by_cls.get(d['m'], 0) + 1
        out = {'source': 'Douglas County assessor roof material (county) + USDA NAIP 2023 0.3 m imagery classifier (imagery); see operations/door-territory/roofs/material/README.md',
               'built': built, 'classes': {'asphalt': 'composition shingle or roll', 'tile': 'concrete or clay tile', 'shake': 'wood shake', 'metal': 'metal', 'flat': 'built-up or membrane'},
               'thresholds': usable, 'doors': doors}
        (DATA / f'material-{town}.json').write_text(json.dumps(out, separators=(',', ':')))
        summary[town] = {'doors': n_doors, 'structural_data': has_struct, 'crops': int(len(df)), 'usable_crops': int(len(ok)), 'county': n_county, 'imagery': n_img, 'labelled': len(doors), 'share': round(len(doors) / max(n_doors, 1), 3), 'by_class': by_cls}
        print(f'{town}: {n_doors} doors, {len(ok)} usable crops, county {n_county}, imagery {n_img}, total {len(doors)} ({summary[town]["share"]:.0%}) {by_cls}')
    (HERE / 'coverage.json').write_text(json.dumps(summary, indent=1))
    return summary


if __name__ == '__main__':
    main([t for t in sys.argv[1:] if not t.startswith('--')] or TOWNS)
