from PIL import Image, ImageFilter
import sys, math

SRC = r"C:\Users\Surge Inc\OneDrive\Desktop\claude test 2\brand\logos\logooooo-e1757075328860.png"
SCALE = 8
BLUR = 1.2
EPS = 2.4
CORNER_DEG = 55.0

im = Image.open(SRC).convert("RGBA")
bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
bg.alpha_composite(im)
im = bg.convert("L")
W0, H0 = im.size
im = im.resize((W0 * SCALE, H0 * SCALE), Image.LANCZOS).filter(ImageFilter.GaussianBlur(BLUR))
W, H = im.size
px = im.load()
grid = [[1 if px[x, y] < 128 else 0 for x in range(W)] for y in range(H)]


def get(x, y):
    if x < 0 or y < 0 or x >= W or y >= H:
        return 0
    return grid[y][x]


edges = {}
for y in range(H):
    row = grid[y]
    for x in range(W):
        if not row[x]:
            continue
        if not get(x, y - 1):
            edges.setdefault((x, y), []).append((x + 1, y))
        if not get(x + 1, y):
            edges.setdefault((x + 1, y), []).append((x + 1, y + 1))
        if not get(x, y + 1):
            edges.setdefault((x + 1, y + 1), []).append((x, y + 1))
        if not get(x - 1, y):
            edges.setdefault((x, y + 1), []).append((x, y))

used = set()
loops = []
for start in list(edges.keys()):
    for nxt in edges[start]:
        if (start, nxt) in used:
            continue
        loop = [start]
        cur, prev = nxt, start
        used.add((prev, cur))
        guard = 0
        while cur != start and guard < 8000000:
            guard += 1
            loop.append(cur)
            opts = edges.get(cur)
            if not opts:
                break
            dx, dy = cur[0] - prev[0], cur[1] - prev[1]

            def rank(n):
                ndx, ndy = n[0] - cur[0], n[1] - cur[1]
                cross = dx * ndy - dy * ndx
                dot = dx * ndx + dy * ndy
                if cross < 0:
                    return 0
                if dot > 0:
                    return 1
                if cross > 0:
                    return 2
                return 3

            cand = [n for n in opts if (cur, n) not in used]
            if not cand:
                break
            cand.sort(key=rank)
            n = cand[0]
            used.add((cur, n))
            prev, cur = cur, n
        if len(loop) > 24:
            loops.append(loop)


def collapse(pts):
    out = []
    for p in pts:
        if len(out) >= 2:
            ax, ay = out[-2]
            bx, by = out[-1]
            cx, cy = p
            if (bx - ax) * (cy - by) - (by - ay) * (cx - bx) == 0 and \
               (bx - ax) * (cx - bx) >= 0 and (by - ay) * (cy - by) >= 0:
                out[-1] = p
                continue
        out.append(p)
    return out


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    ax, ay = pts[0]
    bx, by = pts[-1]
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    dmax = 0.0
    idx = 0
    for i in range(1, len(pts) - 1):
        px_, py_ = pts[i]
        if L2 == 0:
            d = math.hypot(px_ - ax, py_ - ay)
        else:
            t = max(0.0, min(1.0, ((px_ - ax) * dx + (py_ - ay) * dy) / L2))
            d = math.hypot(px_ - (ax + t * dx), py_ - (ay + t * dy))
        if d > dmax:
            dmax = d
            idx = i
    if dmax > eps:
        return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]


sys.setrecursionlimit(200000)
OX, OY = 62 * SCALE, 30 * SCALE
VW, VH = 598, 162


def snap(v):
    """Pull values within a hair of a whole/half unit onto it, so flats stay flat."""
    r = round(v * 2.0) / 2.0
    return r if abs(v - r) < 0.18 else v


def turn_angle(a, b, c):
    v1 = (b[0] - a[0], b[1] - a[1])
    v2 = (c[0] - b[0], c[1] - b[1])
    n1 = math.hypot(*v1)
    n2 = math.hypot(*v2)
    if n1 == 0 or n2 == 0:
        return 0.0
    cosv = max(-1.0, min(1.0, (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)))
    return math.degrees(math.acos(cosv))


def mid(a, b):
    return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)


def fmt(p):
    return "%s,%s" % (f"{p[0]:.2f}".rstrip("0").rstrip("."), f"{p[1]:.2f}".rstrip("0").rstrip("."))


def emit(pts):
    """pts: closed polygon (no repeated last point), in final coords.
    Hard corners stay corners; smooth runs become quadratic curves through midpoints."""
    n = len(pts)
    sharp = [turn_angle(pts[(i - 1) % n], pts[i], pts[(i + 1) % n]) > CORNER_DEG for i in range(n)]
    # walk, building segments
    d = []
    # choose a start at a sharp corner if one exists
    s = next((i for i in range(n) if sharp[i]), 0)
    order = [(s + k) % n for k in range(n)]
    cur = pts[order[0]]
    d.append("M" + fmt(cur))
    i = 0
    while i < n:
        a = pts[order[i]]
        b = pts[order[(i + 1) % n]]
        if sharp[order[(i + 1) % n]] or turn_angle(a, b, pts[order[(i + 2) % n]]) > CORNER_DEG:
            d.append("L" + fmt(b))
            i += 1
        else:
            # smooth: quadratic with control b, ending at midpoint of b..c
            c = pts[order[(i + 2) % n]]
            d.append("Q" + fmt(b) + " " + fmt(mid(b, c)))
            i += 1
    d.append("Z")
    return "".join(d)



def axis_snap(poly, tol=0.7):
    """Flatten near-horizontal / near-vertical runs so stems and arms read straight."""
    n = len(poly)
    pts = [list(p) for p in poly]
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        if dx == 0 and dy == 0:
            continue
        if abs(dx) <= tol and abs(dy) > tol:
            m = (a[0] + b[0]) / 2.0
            a[0] = b[0] = m
        elif abs(dy) <= tol and abs(dx) > tol:
            m = (a[1] + b[1]) / 2.0
            a[1] = b[1] = m
    return [tuple(p) for p in pts]


# Exact rectangles for the two bars, measured off the source bitmap.
# Source px: top bar x 312-530 y 45-63, bottom bar x 62-280 y 162-180; origin (62,30).
BARS = [(250.0, 15.0, 219.0, 19.0), (0.0, 132.0, 219.0, 19.0)]


def is_bar(poly):
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    w = max(xs) - min(xs)
    h = max(ys) - min(ys)
    return h > 0 and w / h > 6.0


def rect_path(x, y, w, h):
    return "M%g,%gL%g,%gL%g,%gL%g,%gZ" % (x, y, x + w, y, x + w, y + h, x, y + h)


parts = []
bar_slots = 0
for loop in loops:
    pts = collapse(loop)
    if len(pts) < 6:
        continue
    closed = pts + [pts[0]]
    simp = rdp(closed, EPS)
    if len(simp) < 5:
        continue
    poly = [((p[0] - OX) / SCALE, (p[1] - OY) / SCALE) for p in simp[:-1]]
    if is_bar(poly):
        bar_slots += 1
        continue
    poly = axis_snap([(snap(x), snap(y)) for x, y in poly])
    clean = [poly[0]]
    for p in poly[1:]:
        if math.hypot(p[0] - clean[-1][0], p[1] - clean[-1][1]) > 0.05:
            clean.append(p)
    if len(clean) < 5:
        continue
    parts.append(emit(clean))

parts += [rect_path(*b) for b in BARS]

svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" fill="currentColor" '
       'fill-rule="evenodd" role="img" aria-label="Surge">'
       '<path d="%s"/></svg>\n' % (VW, VH, "".join(parts)))
sys.stdout.write(svg)
sys.stderr.write("loops=%d letters=%d bars_detected=%d bytes=%d\n" % (len(loops), len(parts) - 2, bar_slots, len(svg)))
