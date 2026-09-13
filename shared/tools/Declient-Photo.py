"""
Remove client identifiers from Surge field photography.

Three operations, chosen per mark:

  clone   copy a clean patch of the same material over the mark, feathered at
          the edges. Used where clean matching fabric exists nearby - it keeps
          the weave, the fold shading and the grain, so nothing reads as a
          patch.

  ramp    rebuild the covered area by interpolating across it from clean
          columns on both sides, row by row, plus matched grain. Used on large
          flat areas (a draped tablecloth) where no clean patch is big enough
          but the surface is a smooth gradient.

  blur    gaussian, used only on small objects that must stay legible AS
          objects - a lanyard ribbon, an ID badge - where deleting them would
          look stranger than softening them.

Coordinates are full-resolution pixels on the ORIGINAL file. Originals are
never written to.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SRC = Path(r"c:\Users\Surge Inc\OneDrive\Desktop\claude test 2\brand\photos\client-branded-DO-NOT-PUBLISH")
OUT = Path(r"c:\Users\Surge Inc\OneDrive\Desktop\claude test 2\brand\photos\field-cleared")


def feather_mask(w, h, edge):
    """Alpha ramp: 1 in the middle, falling to 0 over `edge` px at each side."""
    fx = np.ones(w)
    fy = np.ones(h)
    e = max(1, min(edge, w // 2, h // 2))
    ramp = np.linspace(0, 1, e + 2)[1:-1]
    fx[:e] = ramp
    fx[-e:] = ramp[::-1]
    fy[:e] = ramp
    fy[-e:] = ramp[::-1]
    return (fy[:, None] * fx[None, :])[:, :, None]


def clone(a, box, dx, dy, edge=18):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    patch = a[y0 + dy:y1 + dy, x0 + dx:x1 + dx].astype(np.float32)
    if patch.shape[:2] != (h, w):
        raise ValueError(f"clone source out of bounds for {box} offset {dx},{dy}")
    m = feather_mask(w, h, edge)
    a[y0:y1, x0:x1] = patch * m + a[y0:y1, x0:x1].astype(np.float32) * (1 - m)


def _tile_to(src, w, h):
    """Repeat `src` by mirroring until it covers w x h, then crop."""
    reps_y = -(-h // src.shape[0])
    reps_x = -(-w // src.shape[1])
    row = []
    for i in range(reps_y):
        cols = []
        for j in range(reps_x):
            blk = src
            if i % 2:
                blk = blk[::-1]
            if j % 2:
                blk = blk[:, ::-1]
            cols.append(blk)
        row.append(np.concatenate(cols, axis=1))
    return np.concatenate(row, axis=0)[:h, :w]


def ramp(a, box, lpad=110, rpad=110, texture=None, edge=45):
    """Rebuild `box` from the columns either side of it.

    The low frequencies come from a per-row linear interpolation, which
    reproduces the lighting gradient exactly. The high frequencies come from
    real fabric sampled at `texture` - synthetic gaussian grain reads as
    plastic next to a woven surface, which is what makes a rebuilt patch
    visible when someone zooms in.
    """
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    left = a[y0:y1, x0 - lpad:x0].astype(np.float32)
    right = a[y0:y1, x1:x1 + rpad].astype(np.float32)
    lm = left.mean(axis=1)
    rm = right.mean(axis=1)
    t = np.linspace(0.0, 1.0, w)[None, :, None]
    fill = lm[:, None, :] * (1 - t) + rm[:, None, :] * t
    fill = np.asarray(
        Image.fromarray(np.clip(fill, 0, 255).astype(np.uint8)).filter(
            ImageFilter.GaussianBlur(3)
        )
    ).astype(np.float32)

    if texture is not None:
        tx, ty, tw, th = texture
        samp = a[ty:ty + th, tx:tx + tw].astype(np.float32)
        low = np.asarray(
            Image.fromarray(np.clip(samp, 0, 255).astype(np.uint8)).filter(
                ImageFilter.GaussianBlur(6)
            )
        ).astype(np.float32)
        fill += _tile_to(samp - low, w, h)
    else:
        g = float(np.std(left - lm[:, None, :]))
        fill += np.random.default_rng(7).normal(0, max(g, 1.0), fill.shape)

    m = feather_mask(w, h, edge)
    a[y0:y1, x0:x1] = np.clip(fill * m + a[y0:y1, x0:x1].astype(np.float32) * (1 - m), 0, 255)


def blur(a, box, radius, edge=8):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    region = Image.fromarray(a[y0:y1, x0:x1].astype(np.uint8))
    soft = np.asarray(region.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32)
    m = feather_mask(w, h, edge)
    a[y0:y1, x0:x1] = soft * m + a[y0:y1, x0:x1].astype(np.float32) * (1 - m)


JOBS = {
    # Booth outside a convenience store. The client mark appears five times.
    #
    # The tablecloth logo is handled by CROP, not by retouching. Rebuilding
    # 1000px of draped black fabric left a faint rectangle no matter how the
    # fill was blended, and the logo sits below the table's front lip - so
    # cutting the frame at the lip removes it with nothing to detect. The crop
    # also tightens a loose composition, which is why it is the first choice
    # here rather than the fallback.
    "canvassing-08": [
        # Chest emblem + org name + tagline, x2030-2235 y2355-2540. Cloned
        # from the plain shirt below and slightly left: level-left runs into
        # the lanyard and the necklace cord, and directly below-right is the
        # orange sleeve.
        ("clone", (1985, 2315, 2275, 2575), -140, 300),
        # Lanyard ribbon: the org name is printed along it three times over
        # this run, plus a logo at y2530. One box for the whole visible run.
        ("blur", (1730, 2245, 1815, 2880), 9),
        # ID badge: org roundel, org graphic, and a role line up the side.
        ("blur", (1690, 2930, 1865, 3170), 12),
        # Printed info sheet on the clipboard, org name in its heading.
        ("blur", (2450, 3420, 3100, 3820), 12),
        ("crop", (240, 300, 3840, 3900)),
    ],
    # Two reps at the booth outside a garden centre. 1200x1600 - the tablecloth
    # here is flat and evenly lit, with clean fabric either side at every row,
    # so the ramp rebuild works where it did not on 08.
    "canvassing-25": [
        ("ramp", (400, 1020, 850, 1350), 100, 150, (300, 1040, 100, 300)),
        ("blur", (580, 372, 622, 404), 5),                 # cap, left man
        ("blur", (745, 368, 788, 400), 5),                 # cap, right man
        ("blur", (548, 918, 690, 1000), 8),                # goal board, names the org
        ("blur", (788, 918, 940, 1005), 8),                # printed sheet
        ("blur", (678, 655, 715, 725), 6),                 # badge on lanyard
        # The open ledger is handwritten canvassing notes. Illegible at any
        # size this ships at, but it is the kind of page that carries donor
        # names and amounts, so it does not go out sharp.
        ("blur", (295, 900, 480, 1000), 6),
    ],
    # Rep with balloons at a grocery frontage. 1200x1600.
    "canvassing-24": [
        ("ramp", (600, 1180, 1030, 1580), 150, 150, (450, 1200, 140, 380)),
        ("blur", (250, 238, 310, 298), 6),                 # cap being worn
        ("blur", (866, 1042, 946, 1098), 7),               # spare cap on the table
        ("blur", (545, 1088, 740, 1150), 7),               # printed sheets
        ("blur", (1085, 1145, 1200, 1200), 7),             # printed sheets, right edge
    ],
}


WEB_LONG_EDGE = 1800


def run(name):
    im = Image.open(SRC / f"{name}.jpg").convert("RGB")
    a = np.asarray(im).astype(np.float32).copy()
    crop_box = None
    for op in JOBS[name]:
        kind = op[0]
        if kind == "clone":
            clone(a, op[1], op[2], op[3])
        elif kind == "ramp":
            ramp(a, op[1], op[2], op[3], op[4])
        elif kind == "blur":
            blur(a, op[1], op[2])
        elif kind == "crop":
            crop_box = op[1]
        else:
            raise ValueError(kind)
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    if crop_box:
        out = out.crop(crop_box)
    OUT.mkdir(parents=True, exist_ok=True)
    master = OUT / f"{name}-cleared.jpg"
    out.save(master, quality=95, subsampling=0)

    # Web copy. The downscale is a second line of defence as well as a file-size
    # measure: fine print that survived a blur at full resolution does not
    # survive being resampled to a third of it.
    scale = WEB_LONG_EDGE / max(out.size)
    web = out
    if scale < 1:
        web = out.resize(
            (round(out.size[0] * scale), round(out.size[1] * scale)), Image.LANCZOS
        )
    web_path = OUT / f"{name}-web.jpg"
    web.save(web_path, quality=88, optimize=True, progressive=True)
    print(f"{name}: master {out.size} -> {master.name} | web {web.size} -> {web_path.name}")
    return out


if __name__ == "__main__":
    for n in sys.argv[1:] or JOBS:
        run(n)
