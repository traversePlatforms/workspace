"""Step 4: train the classifier on the Douglas County assessor's roof materials and measure it honestly.

Labels: Douglas County's roof material (year-<town>.json "mat"), collapsed by features.CLASS_OF into
asphalt / tile / shake / metal / flat. Rows with too few clear roof pixels are left out of training.

Measurements, all on houses the model did not train on:
  1. LEAVE-ONE-TOWN-OUT: four folds, each Douglas town predicted by a model trained on the other three. This is the
     headline number and the source of the confidence thresholds, because the model will be run on towns it has
     never seen; a random split flatters it (neighbouring houses in the same subdivision share a builder's roofs).
  2. the cross-town test the brief asks for: trained on Castle Rock only, tested on Franktown + Sedalia + Larkspur,
     with thresholds from Castle Rock's own five-fold cross-validation;
  3. random five-fold cross-validation over all four towns (the flattering number, for comparison).
Each is run with all features and imagery-only (no LiDAR size/pitch, no year built), with and without class
balancing. The variant with the best leave-one-town-out accuracy becomes the final model, trained on everything
labelled; its thresholds are the leave-one-town-out ones.
Writes cache/model.pkl and model-report.json (beside this file; the README quotes it).
  python train.py
"""
import json, pickle, sys, time
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support
from features import MIN_PX, CLASS_OF

HERE = Path(__file__).parent
CACHE = HERE / 'cache'
DOUGLAS = ['castle-rock', 'franktown', 'sedalia', 'larkspur']
CLASSES = ['asphalt', 'tile', 'shake', 'metal', 'flat']
META = {'id', 'town', 'mat', 'cls', 'item_date'}
STRUCT = {'yb', 'rm', 'bsf', 'sq', 'pitch', 'deg', 'flat', 'rh', 'fp'}
TARGET_PRECISION = 0.90
MIN_SUPPORT = 30       # a threshold is only trusted when at least this many held-out houses pass it
SEED = 7


def load(towns):
    return pd.concat([pd.read_csv(CACHE / f'features-{t}.csv') for t in towns if (CACHE / f'features-{t}.csv').exists()], ignore_index=True)


def feature_cols(df, imagery_only=False):
    cols = [c for c in df.columns if c not in META]
    return [c for c in cols if c not in STRUCT] if imagery_only else cols


def model(balanced=False):
    return HistGradientBoostingClassifier(max_iter=400, learning_rate=0.05, max_leaf_nodes=31, min_samples_leaf=20,
                                          l2_regularization=1.0, early_stopping=False, random_state=SEED,
                                          class_weight='balanced' if balanced else None)


def thresholds(y, P, classes):
    """Per class: the lowest probability at which the houses called that class (argmax) with p >= t are >= 90% right,
    with at least MIN_SUPPORT of them. None when no such t exists."""
    out = {}
    pred = P.argmax(1)
    for ci, c in enumerate(classes):
        sel = pred == ci
        if sel.sum() == 0:
            out[c] = None; continue
        p = P[sel, ci]; hit = (y[sel] == ci)
        order = np.argsort(-p); p, hit = p[order], hit[order]
        cum_hit = np.cumsum(hit); n = np.arange(1, len(p) + 1); prec = cum_hit / n
        ok = np.where((prec >= TARGET_PRECISION) & (n >= MIN_SUPPORT))[0]
        if len(ok) == 0:
            out[c] = None; continue
        k = ok.max()
        out[c] = {'t': float(round(p[k], 3)), 'n': int(n[k]), 'precision': float(round(prec[k], 4)),
                  'recall_at_t': float(round(cum_hit[k] / max((y == ci).sum(), 1), 4))}
    return out


def thresholds_every_town(y, P, town, classes, towns):
    """Stricter: the lowest t at which EVERY held-out town with at least 10 houses called that class is >= 90% right
    (and at least MIN_SUPPORT called over all). The pooled rule is carried by Castle Rock, which is 72% of the labels."""
    out = {}
    pred = P.argmax(1)
    grid = np.concatenate([np.arange(0.30, 0.95, 0.01), np.arange(0.95, 0.9995, 0.001)])
    for ci, c in enumerate(classes):
        found = None
        for t in grid:
            s = (pred == ci) & (P[:, ci] >= t)
            if s.sum() < MIN_SUPPORT: break
            ok = True
            for tw in towns:
                st = s & (town == tw)
                if st.sum() >= 10 and (y[st] == ci).mean() < TARGET_PRECISION: ok = False; break
            if ok:
                found = {'t': float(round(t, 3)), 'n': int(s.sum()), 'precision': float(round((y[s] == ci).mean(), 4)),
                         'recall_at_t': float(round((s & (y == ci)).sum() / max((y == ci).sum(), 1), 4)),
                         'per_town': {tw: {'called': int((s & (town == tw)).sum()), 'precision': float(round((y[s & (town == tw)] == ci).mean(), 4)) if (s & (town == tw)).sum() else None} for tw in towns}}
                break
        out[c] = found
    return out


def at_thresholds(y, P, th, classes):
    pred = P.argmax(1)
    out = {'per_class': {}}
    kept = np.zeros(len(y), bool); right = np.zeros(len(y), bool)
    for ci, c in enumerate(classes):
        t = th.get(c)
        if t is None:
            out['per_class'][c] = None; continue
        s = (pred == ci) & (P[:, ci] >= t['t'])
        kept |= s; right |= s & (y == ci)
        out['per_class'][c] = {'called': int(s.sum()), 'right': int((s & (y == ci)).sum()), 'precision': float(round((s & (y == ci)).sum() / max(s.sum(), 1), 4)),
                               'recall': float(round((s & (y == ci)).sum() / max((y == ci).sum(), 1), 4)), 'support': int((y == ci).sum())}
    out['overall'] = {'kept_share': float(round(kept.mean(), 4)), 'precision': float(round(right.sum() / max(kept.sum(), 1), 4)), 'kept': int(kept.sum())}
    return out


def report(y, P, classes, name, th=None):
    pred = P.argmax(1)
    pr, rc, f1, sup = precision_recall_fscore_support(y, pred, labels=range(len(classes)), zero_division=0)
    cm = confusion_matrix(y, pred, labels=range(len(classes)))
    r = {'name': name, 'n': int(len(y)), 'accuracy': float(round((pred == y).mean(), 4)),
         'per_class': {c: {'precision': float(round(pr[i], 4)), 'recall': float(round(rc[i], 4)), 'f1': float(round(f1[i], 4)), 'support': int(sup[i])} for i, c in enumerate(classes)},
         'confusion': {'rows_true_cols_pred': classes, 'matrix': cm.tolist()}}
    r['thresholds'] = th if th is not None else thresholds(y, P, classes)
    r['thresholds_from'] = 'given' if th is not None else 'this held-out set'
    r['at_thresholds'] = at_thresholds(y, P, r['thresholds'], classes)
    print(f"\n== {name}: n={len(y)} accuracy={r['accuracy']}")
    for c in classes:
        pc = r['per_class'][c]; t = r['thresholds'][c]; a = r['at_thresholds']['per_class'][c]
        print(f"  {c:8s} P={pc['precision']:.3f} R={pc['recall']:.3f} n={pc['support']:5d}  threshold={'none' if t is None else t['t']}"
              + ('' if a is None else f"  -> at t: called {a['called']} precision {a['precision']:.3f} recall {a['recall']:.3f}"))
    print('  confusion (rows = true, cols = predicted):', classes)
    for i, c in enumerate(classes):
        print(f'   {c:8s}', cm[i].tolist())
    print('  at thresholds:', r['at_thresholds']['overall'])
    return r


def oof(X, y, folds, balanced, n_classes):
    P = np.zeros((len(y), n_classes))
    for tr, te in folds:
        m = model(balanced).fit(X[tr], y[tr])
        pp = m.predict_proba(X[te])
        for j, c in enumerate(m.classes_): P[te, c] = pp[:, j]
    return P


def main():
    t0 = time.time()
    df = load(DOUGLAS)
    df = df[(df.cls != '') & df.cls.notna()]
    counts_all = df.cls.value_counts().to_dict()
    df = df[df.roof_px >= MIN_PX].reset_index(drop=True)
    counts = df.cls.value_counts().to_dict()
    print('labelled houses with a usable crop:', counts, '(before the pixel floor:', counts_all, ')')
    y = np.array([CLASSES.index(c) for c in df.cls])
    town = df.town.to_numpy()
    per_town_counts = {t: df[df.town == t].cls.value_counts().to_dict() for t in DOUGLAS}
    out = {'classes': CLASSES, 'class_of': CLASS_OF, 'label_counts': counts, 'label_counts_all': counts_all, 'per_town_counts': per_town_counts,
           'min_px': MIN_PX, 'target_precision': TARGET_PRECISION, 'min_support': MIN_SUPPORT, 'towns': DOUGLAS, 'runs': {}}
    loto_folds = [(np.where(town != t)[0], np.where(town == t)[0]) for t in DOUGLAS]
    skf = list(StratifiedKFold(5, shuffle=True, random_state=SEED).split(df, y))
    cr = town == 'castle-rock'
    best = None
    for variant, img_only in (('all_features', False), ('imagery_only', True)):
        cols = feature_cols(df, img_only)
        X = df[cols].to_numpy(np.float64)
        for balanced in (False, True):
            key = f'{variant}{"_balanced" if balanced else ""}'
            print(f'\n######## {key} ({len(cols)} features)')
            # 1. leave-one-town-out
            P = oof(X, y, loto_folds, balanced, len(CLASSES))
            r1 = report(y, P, CLASSES, f'{key}: leave-one-town-out, all Douglas towns')
            r1['thresholds_every_town'] = thresholds_every_town(y, P, town, CLASSES, DOUGLAS)
            r1['at_thresholds_every_town'] = at_thresholds(y, P, r1['thresholds_every_town'], CLASSES)
            print('   every-town thresholds:', {c: (None if v is None else (v['t'], v['n'], v['precision'], v['recall_at_t'])) for c, v in r1['thresholds_every_town'].items()}, r1['at_thresholds_every_town']['overall'])
            pred = P.argmax(1)
            r1['per_town'] = {}
            for t in DOUGLAS:
                s = town == t
                r1['per_town'][t] = {'n': int(s.sum()), 'accuracy': float(round((pred[s] == y[s]).mean(), 4)),
                                     'at_thresholds': at_thresholds(y[s], P[s], r1['thresholds'], CLASSES)}
                print(f"   held out {t}: n={s.sum()} accuracy={r1['per_town'][t]['accuracy']} at thresholds {r1['per_town'][t]['at_thresholds']['overall']}")
            # 2. Castle Rock -> the other three, thresholds from Castle Rock's own CV
            Xcr, ycr = X[cr], y[cr]
            Pcr = oof(Xcr, ycr, list(StratifiedKFold(5, shuffle=True, random_state=SEED).split(Xcr, ycr)), balanced, len(CLASSES))
            th_cr = thresholds(ycr, Pcr, CLASSES)
            m = model(balanced).fit(Xcr, ycr)
            Pt = np.zeros((int((~cr).sum()), len(CLASSES))); pp = m.predict_proba(X[~cr])
            for j, c in enumerate(m.classes_): Pt[:, c] = pp[:, j]
            r2 = report(y[~cr], Pt, CLASSES, f'{key}: trained on Castle Rock, tested on Franktown + Sedalia + Larkspur (thresholds from Castle Rock CV)', th=th_cr)
            # 3. random five-fold
            P5 = oof(X, y, skf, balanced, len(CLASSES))
            r3 = report(y, P5, CLASSES, f'{key}: random 5-fold CV, all Douglas towns')
            out['runs'][key] = {'features': cols, 'balanced': balanced, 'leave_one_town_out': r1, 'castle_rock_to_others': r2, 'random_cv': r3}
            # the deliverable is the thresholded output, so the variant that labels the most houses at >= 90% precision
            # in every held-out town wins (ties by accuracy)
            score = (r1['at_thresholds_every_town']['overall']['kept_share'], r1['accuracy'])
            if best is None or score > best[0]:
                best = (score, key, cols, balanced, r1['thresholds_every_town'], r1['thresholds'], P)
    score, key, cols, balanced, th, th_pooled, P_best = best
    pd.DataFrame({'id': df.id, 'town': town, 'cls': df.cls, **{f'p_{c}': P_best[:, i] for i, c in enumerate(CLASSES)}}).to_csv(CACHE / 'loto-oof.csv', index=False)
    print(f'\nchosen: {key} (leave-one-town-out accuracy {score})')
    final = model(balanced).fit(df[cols].to_numpy(np.float64), y)
    imp = None
    try:
        from sklearn.inspection import permutation_importance
        sub = np.random.RandomState(SEED).choice(len(y), min(2000, len(y)), replace=False)
        pi = permutation_importance(final, df[cols].to_numpy(np.float64)[sub], y[sub], n_repeats=3, random_state=SEED, scoring='accuracy')
        imp = sorted(zip(cols, pi.importances_mean.round(4).tolist()), key=lambda x: -x[1])[:20]
    except Exception as e:
        print('importance skipped:', e)
    out['final'] = {'variant': key, 'features': cols, 'balanced': balanced, 'thresholds': th, 'thresholds_pooled': th_pooled,
                    'thresholds_from': 'leave-one-town-out, >= 90% precision in every held-out town', 'top_features': imp,
                    'trained_on': int(len(y)), 'classes_in_model': [CLASSES[c] for c in final.classes_]}
    with open(CACHE / 'model.pkl', 'wb') as f:
        pickle.dump({'model': final, 'features': cols, 'classes': CLASSES, 'thresholds': th, 'variant': key}, f)
    (HERE / 'model-report.json').write_text(json.dumps(out, indent=1))
    print(f'\nfinal thresholds: {th}')
    print('top features:', imp)
    print(f'done in {time.time() - t0:.0f} s -> cache/model.pkl, model-report.json')


if __name__ == '__main__':
    main()
