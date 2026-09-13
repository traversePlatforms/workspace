# Builds candidate Surge logomarks from the real letterforms + the wordmark's bar device.
# Glyphs are normalised to cap height 100; "w" is the advance width at that cap height.
import os, re, json

GLYPH_FILE = r"C:\Users\SURGEI~1\AppData\Local\Temp\claude\glyphs.json.txt"
GLYPHS = json.loads("{" + open(GLYPH_FILE).read().strip().rstrip(",") + "}")

# --- proportions measured off the source bitmap ----------------------------
# bar 219 x 19 px against an 88 px cap height
BAR_T = 0.216          # bar thickness, in cap heights
TRACK = 0.48           # wordmark tracking, in cap heights

TOK = re.compile(r"[MLQZ]|-?\d*\.?\d+")


def scaled(name, k, dx, dy):
    """Bake a scale+translate into the path data so it can be a subpath of one <path>."""
    toks = TOK.findall(GLYPHS[name]["d"])
    out = []
    j = 0
    while j < len(toks):
        t = toks[j]
        if t in "MLQZ":
            out.append(t)
            j += 1
        else:
            out.append("%.2f %.2f" % (float(t) * k + dx, float(toks[j + 1]) * k + dy))
            j += 2
    s = ""
    for o in out:
        s += o if o in "MLQZ" else (" " + o)
    return s


def glyph(name, cap, x, y):
    return scaled(name, cap / 100.0, x, y), GLYPHS[name]["w"] * cap / 100.0


def rect(x, y, w, h):
    return "M%.3f %.3fH%.3fV%.3fH%.3fZ" % (x, y, x + w, y + h, x)


def svg(vb, d, evenodd=True):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" fill="currentColor"'
            '%s><path d="%s"/></svg>'
            % (vb, ' fill-rule="evenodd"' if evenodd else "", d))


def line(text, cap, x, y, track=TRACK):
    d = ""
    cx = x
    for i, ch in enumerate(text):
        p, w = glyph(ch, cap, cx, y)
        d += p
        cx += w + (track * cap if i < len(text) - 1 else 0)
    return d, cx - x


MARKS, LOCKUPS = {}, {}

# 1. STEP — the wordmark's two bars and nothing else.
L, T = 60.0, 19.0
MARKS["step"] = svg("0 0 100 51", rect(40, 0, L, T) + rect(0, 32, L, T))

# 2. ASCENT — the same bar stepped three times.
L, T = 54.0, 14.0
MARKS["ascent"] = svg("0 0 100 62", rect(46, 0, L, T) + rect(23, 24, L, T) + rect(0, 48, L, T))

# 3. SPIKE — the bar stood on end, one of them surging past the rest.
W, G = 14.0, 7.5
MARKS["spike"] = svg("0 0 100 70", "".join(
    rect(i * (W + G), 70 - h, W, h) for i, h in enumerate([20, 28, 70, 44, 30])))

# 4. BADGE — solid square, S and both bars knocked out of it.
cap, sx, sy = 52.0, 24.0, 25.0
_, sw = glyph("S", cap, 0, 0)
bt = cap * BAR_T
MARKS["badge"] = svg("0 0 100 100",
                     rect(0, 0, 100, 100)
                     + scaled("S", cap / 100.0, sx, sy)
                     + rect(sx + sw + 7, sy + 2, 100 - (sx + sw + 7) - 11, bt)
                     + rect(11, sy + cap + 6, sw * 0.72, bt))

# 5. S-RULE — one letter carrying the wordmark's own construction:
#    a bar above and right, a bar below and left.
cap = 62.0
s, sw = glyph("S", cap, 0, 16)
bt = cap * BAR_T
MARKS["s-rule"] = svg("0 0 100 100",
                      s + rect(sw + 8, 22, 100 - sw - 8, bt) + rect(0, 16 + cap + 9, sw + 14, bt))

# 6. CUT — the S struck through edge to edge.
cap = 74.0
s, sw = glyph("S", cap, 16, 0)
MARKS["cut"] = svg("0 0 100 74", s + rect(0, 74 * 0.40, 100, cap * BAR_T), evenodd=False)

# 7. CORNER — the bars turned into an open bracket. Structure rather than ascent.
T = 14.0
MARKS["corner"] = svg("0 0 100 100",
                      rect(0, 0, 74, T) + rect(0, 0, T, 74)
                      + rect(26, 86, 74, T) + rect(86, 26, T, 74))

# --- lockups ---------------------------------------------------------------

# A. SINGLE LINE — SURGE on one line, both bars kept as over- and under-rules.
cap = 100.0
body, w = line("SURGE", cap, 0, 26)
bt = cap * BAR_T
LOCKUPS["single-line"] = svg("0 0 %.1f %.1f" % (w, 26 + cap + 26),
                             rect(w * 0.44, 0, w * 0.56, bt) + body
                             + rect(0, 26 + cap + 12, w * 0.56, bt))

# B. COMPACT STACK — SU over RGE, left-aligned, tracking tightened.
#    ~1.5:1 instead of the primary's 3.7:1, for narrow columns.
cap, t2 = 100.0, 0.20
su, suw = line("SU", cap, 0, 0, t2)
rge, rgew = line("RGE", cap, 0, cap * 1.16, t2)
bt = cap * BAR_T
tot_w = max(suw, rgew)
tot_h = cap * 2.16 + bt + cap * 0.10
LOCKUPS["compact-stack"] = svg("0 0 %.1f %.1f" % (tot_w, tot_h),
                               su + rge
                               + rect(suw + cap * 0.16, cap * 0.16, tot_w - suw - cap * 0.16, bt)
                               + rect(0, tot_h - bt, tot_w * 0.62, bt))

OUT = r"C:\Users\SURGEI~1\AppData\Local\Temp\claude\marks"
os.makedirs(OUT, exist_ok=True)
for name, s in list(MARKS.items()) + list(LOCKUPS.items()):
    open(os.path.join(OUT, name + ".svg"), "w").write(s)
    print(name, len(s))
