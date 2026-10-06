"""Step 3: numbers from each roof crop.

For every crop in cache/crops/<town>/: the roof pixels (inside the house outline, 2 px in from its edge, leaving
out vegetation by NDVI and deep shadow by brightness), then colour, infrared and texture statistics over them,
plus the roof's size and pitch (roof-<town>.json, LiDAR) and the year built (year-<town>.json) where those exist.
Writes cache/features-<town>.csv, one row per door (id, the label if the county has one, the numbers).
  python features.py [town ...]           (all towns when none given; a town is skipped if its csv is newer than its crop index)
"""
import sys, json, gzip, io, csv, time
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

HERE = Path(__file__).parent
CACHE = HERE / 'cache'
DATA = HERE.parents[3] / 'site' / 'data' / 'rounds'
TOWNS = ['castle-rock', 'franktown', 'sedalia', 'larkspur', 'black-forest', 'monument', 'palmer-lake', 'woodland-park', 'divide', 'florissant', 'cripple-creek']
RES = 0.3
NDVI_VEG = 0.30       # vegetation: NDVI above this AND near-infrared well above every visible band (NIR_OVER). A green or
NIR_OVER = 35         # dark-green metal roof reads NDVI 0.25-0.3 with NIR only ~15 over green; a tree reads 0.4+ and 60-80 over
DARK = 60             # sum of R+G+B below this is deep shadow; the colour there is noise
MIN_PX = 40           # fewer clear roof pixels than this (3.6 m2) and the crop is not trusted

# the county's roof materials, collapsed to what the photo can tell apart
CLASS_OF = {
    'Composition Shingle': 'asphalt', 'Composition Roll': 'asphalt',
    'Concrete Tile': 'tile', 'Clay Tile': 'tile',
    'Wood Shake': 'shake',
    'Preformed Metal': 'metal', 'Formed Seam Metal': 'metal', 'Copper Metal': 'metal',
    'Built Up Rock': 'flat', 'Elastomeric Sgl Ply': 'flat',
}


def safe(id_):
    return ''.join(c if c.isalnum() or c in '_-' else '_' for c in str(id_))


def load_crop(town, id_):
    with gzip.open(CACHE / 'crops' / town / (safe(id_) + '.npy.gz'), 'rb') as f:
        return np.load(io.BytesIO(f.read()))   # (5, h, w) uint8: R, G, B, NIR, valid-mask


def ring_px(ring, meta):
    x0, y0, x1, y1 = meta['bbox']; px = meta['px']
    return [((lon - x0) / (x1 - x0) * px, (y1 - lat) / (y1 - y0) * px) for lat, lon in ring]


def footprint_mask(a, h, meta):
    _, H, W = a.shape
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    if h.get('ring'):
        d.polygon([tuple(p) for p in ring_px(h['ring'], meta)], fill=255)
    else:   # no outline known: a 6 m disc on the point
        r = 6 / RES; d.ellipse([W / 2 - r, H / 2 - r, W / 2 + r, H / 2 + r], fill=255)
    m = np.array(im) > 0
    return ndi.binary_erosion(m, iterations=2) if m.sum() > 200 else m


def ndvi_of(a):
    r = a[0].astype(np.float32); n = a[3].astype(np.float32)
    return (n - r) / np.maximum(n + r, 1)


def veg_mask(a):
    nir = a[3].astype(np.float32); vis = a[:3].astype(np.float32).max(0)
    return (ndvi_of(a) > NDVI_VEG) & (nir - vis > NIR_OVER)


def roof_mask(a, h, meta):
    fp = footprint_mask(a, h, meta)
    valid = a[4] > 0
    veg = veg_mask(a)
    dark = a[:3].astype(np.int32).sum(0) < DARK
    return fp & valid & ~veg & ~dark


def rgb_to_hsv(rgb):   # rgb float 0-1, (n,3)
    mx = rgb.max(1); mn = rgb.min(1); d = mx - mn
    v = mx; s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    h = np.zeros_like(mx)
    nz = d > 1e-6
    rm = nz & (mx == r); gm = nz & (mx == g) & ~rm; bm = nz & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    return h * 60, s, v


def rgb_to_lab(rgb):   # sRGB 0-1 -> CIE Lab (D65)
    c = np.where(rgb > 0.04045, ((rgb + 0.055) / 1.055) ** 2.4, rgb / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[:, 1] - 16; A = 500 * (f[:, 0] - f[:, 1]); B = 200 * (f[:, 1] - f[:, 2])
    return L, A, B


def stats(prefix, x, out, pct=True):
    out[prefix + '_mean'] = float(x.mean()); out[prefix + '_std'] = float(x.std())
    if pct:
        p = np.percentile(x, [10, 50, 90]); out[prefix + '_p10'] = float(p[0]); out[prefix + '_p50'] = float(p[1]); out[prefix + '_p90'] = float(p[2])


def features(a, h, meta):
    out = {}
    fp = footprint_mask(a, h, meta)
    valid = a[4] > 0
    ndvi = ndvi_of(a)
    veg = veg_mask(a)
    rgbsum = a[:3].astype(np.int32).sum(0)
    dark = rgbsum < DARK
    inside = fp & valid
    n_in = int(inside.sum())
    out['fp_px'] = n_in
    out['veg_frac'] = float((inside & veg).sum() / max(n_in, 1))        # trees over the roof (or the outline is off)
    out['shadow_frac'] = float((inside & dark).sum() / max(n_in, 1))
    out['nofp'] = 0 if h.get('ring') else 1
    m = inside & ~veg & ~dark
    n = int(m.sum()); out['roof_px'] = n
    if n < MIN_PX:
        return out
    R, G, B, N = (a[i][m].astype(np.float32) for i in range(4))
    rgb = np.stack([R, G, B], 1) / 255
    for name, x in (('r', R), ('g', G), ('b', B), ('nir', N)):
        stats(name, x, out)
    hh, s, v = rgb_to_hsv(rgb)
    # hue as a circular mean (red roofs straddle 0/360)
    ang = np.deg2rad(hh); out['hue_cos'] = float(np.cos(ang).mean()); out['hue_sin'] = float(np.sin(ang).mean())
    out['hue_mean'] = float(np.rad2deg(np.arctan2(out['hue_sin'], out['hue_cos'])) % 360)
    out['hue_conc'] = float(np.hypot(out['hue_cos'], out['hue_sin']))   # 1 = one hue, 0 = all hues
    stats('sat', s, out); stats('val', v, out)
    L, A, Bb = rgb_to_lab(rgb)
    stats('L', L, out); stats('a', A, out); stats('b', Bb, out)
    stats('ndvi', ndvi[m], out)
    eps = 1.0
    out['r_g'] = float((R.mean() + eps) / (G.mean() + eps)); out['r_b'] = float((R.mean() + eps) / (B.mean() + eps))
    out['g_b'] = float((G.mean() + eps) / (B.mean() + eps)); out['nir_r'] = float((N.mean() + eps) / (R.mean() + eps))
    out['nir_vis'] = float((N.mean() + eps) / (rgb.mean() * 255 + eps))
    # two-plane brightness split (a gable's sun side and shade side): Otsu on V
    vs = np.sort(v); k = max(1, int(len(vs) * 0.5))
    t = vs[k]; lo = v[v <= t]; hi = v[v > t]
    out['v_lo'] = float(lo.mean()) if len(lo) else float(v.mean()); out['v_hi'] = float(hi.mean()) if len(hi) else float(v.mean())
    out['v_split'] = out['v_hi'] - out['v_lo']
    # texture on the brightness image, roof pixels only, at 1 px (0.3 m) and 2 px
    V = a[:3].astype(np.float32).mean(0)
    gx = ndi.sobel(V, 1); gy = ndi.sobel(V, 0)
    gm = np.hypot(gx, gy)
    core = ndi.binary_erosion(m, iterations=1)   # gradients that do not touch the mask edge
    if core.sum() < 20:
        core = m
    out['grad_mean'] = float(gm[core].mean()); out['grad_p90'] = float(np.percentile(gm[core], 90))
    lap = ndi.laplace(V)
    out['lap_std'] = float(lap[core].std())
    loc = V - ndi.uniform_filter(V, 5)
    out['local_std5'] = float(loc[core].std())
    loc9 = V - ndi.uniform_filter(V, 9)
    out['local_std9'] = float(loc9[core].std())
    # structure tensor: how lined-up the texture is (seams and tile courses run one way)
    jxx = ndi.gaussian_filter(gx * gx, 2); jyy = ndi.gaussian_filter(gy * gy, 2); jxy = ndi.gaussian_filter(gx * gy, 2)
    tr = jxx + jyy; det = jxx * jyy - jxy * jxy
    disc = np.sqrt(np.maximum(tr * tr / 4 - det, 0))
    l1 = tr / 2 + disc; l2 = tr / 2 - disc
    coh = (l1 - l2) / np.maximum(l1 + l2, 1e-3)
    out['coherence'] = float(coh[core].mean())
    # the same at half resolution (0.6 m), which is what a shingle course or tile rib looks like from further off
    V2 = ndi.zoom(V, 0.5, order=1)
    m2 = ndi.zoom(core.astype(np.float32), 0.5, order=1) > 0.6
    if m2.sum() >= 10:
        g2 = np.hypot(ndi.sobel(V2, 1), ndi.sobel(V2, 0))
        out['grad2_mean'] = float(g2[m2].mean())
        out['local2_std'] = float((V2 - ndi.uniform_filter(V2, 5))[m2].std())
    else:
        out['grad2_mean'] = np.nan; out['local2_std'] = np.nan
    # colour texture: does the hue vary across the roof (patched shingles, weathered shake) or hold (metal, tile)
    out['sat_lap'] = float(np.abs(ndi.laplace(ndi.gaussian_filter(a[0].astype(np.float32) - a[2].astype(np.float32), 1)))[core].mean())
    # the sunlit half on its own (the shaded plane's colour is mostly sky light): the material's colour shows best there
    sun = v >= np.median(v)
    if sun.sum() >= 10:
        out['sun_r'] = float(R[sun].mean()); out['sun_g'] = float(G[sun].mean()); out['sun_b'] = float(B[sun].mean()); out['sun_nir'] = float(N[sun].mean())
        out['sun_L'] = float(L[sun].mean()); out['sun_a'] = float(A[sun].mean()); out['sun_b_'] = float(Bb[sun].mean())
        out['sun_sat'] = float(s[sun].mean()); out['sun_a_std'] = float(A[sun].std()); out['sun_L_std'] = float(L[sun].std())
        out['sun_nir_r'] = float((N[sun].mean() + eps) / (R[sun].mean() + eps))
    # a regular course pattern (tile ribs, standing seams, shingle rows): share of the roof's spectral power at
    # 0.6-1.5 m wavelengths, on the brightness image with the mask's mean removed
    ys, xs = np.where(core)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    patch = np.where(core, V, 0.0)[y0:y1, x0:x1]
    mk = core[y0:y1, x0:x1]
    if mk.sum() >= 60 and min(patch.shape) >= 8:
        patch = np.where(mk, patch - patch[mk].mean(), 0.0)
        F = np.abs(np.fft.fftshift(np.fft.fft2(patch))) ** 2
        hh2, ww2 = F.shape
        fy = np.fft.fftshift(np.fft.fftfreq(hh2))[:, None]; fx = np.fft.fftshift(np.fft.fftfreq(ww2))[None, :]
        fr = np.hypot(fy, fx)                                   # cycles per pixel
        tot = F[fr > 0.02].sum()
        ring = F[(fr >= RES / 1.5) & (fr <= RES / 0.6)].sum()   # wavelengths 0.6-1.5 m
        fine = F[fr > RES / 0.6].sum()                          # under 0.6 m: noise and edges
        out['fft_ring'] = float(ring / max(tot, 1e-6)); out['fft_fine'] = float(fine / max(tot, 1e-6))
    else:
        out['fft_ring'] = np.nan; out['fft_fine'] = np.nan
    return out


def run(town):
    idxf = CACHE / f'crops-{town}.json'
    outf = CACHE / f'features-{town}.csv'
    if not idxf.exists():
        print(town, 'no crops yet'); return
    if outf.exists() and outf.stat().st_mtime > idxf.stat().st_mtime and '--force' not in sys.argv:
        print(town, 'features up to date'); return
    idx = json.loads(idxf.read_text())
    houses = json.loads((CACHE / f'houses-{town}.json').read_text())
    yf = DATA / f'year-{town}.json'; year = json.loads(yf.read_text())['doors'] if yf.exists() else {}
    rf = DATA / f'roof-{town}.json'; roof = json.loads(rf.read_text())['doors'] if rf.exists() else {}
    rows = []; t0 = time.time(); keys = None
    for id_, meta in idx.items():
        if 'err' in meta or not (CACHE / 'crops' / town / (safe(id_) + '.npy.gz')).exists():
            continue
        try:
            a = load_crop(town, id_)
        except Exception as e:
            print('  bad crop', id_, e); continue
        f = features(a, houses[id_], meta)
        y = year.get(id_, {}); r = roof.get(id_, {})
        f['yb'] = y.get('yb', np.nan); f['rm'] = y.get('rm', np.nan); f['bsf'] = y.get('bsf', np.nan)
        f['sq'] = r.get('sq', np.nan); f['pitch'] = r.get('pitch', np.nan); f['deg'] = r.get('deg', np.nan)
        f['flat'] = (1 if r['flat'] else 0) if 'flat' in r else np.nan; f['rh'] = r.get('h', np.nan); f['fp'] = r.get('fp', np.nan)
        f['item_date'] = meta['item'].split('_')[4] if 'item' in meta else ''
        row = {'id': id_, 'town': town, 'mat': y.get('mat', ''), 'cls': CLASS_OF.get(y.get('mat', ''), '')}
        row.update(f)
        rows.append(row)
    if not rows:
        print(town, 'nothing'); return
    keys = ['id', 'town', 'mat', 'cls'] + sorted({k for r in rows for k in r} - {'id', 'town', 'mat', 'cls'})
    with open(outf, 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=keys, restval='')
        w.writeheader()
        for r in rows:
            w.writerow({k: ('' if isinstance(v, float) and np.isnan(v) else v) for k, v in r.items()})
    ok = sum(1 for r in rows if r.get('roof_px', 0) >= MIN_PX)
    print(f'{town}: {len(rows)} crops, {ok} with enough clear roof ({time.time() - t0:.0f} s)')


if __name__ == '__main__':
    towns = [t for t in sys.argv[1:] if not t.startswith('--')] or TOWNS
    for t in towns:
        run(t)
