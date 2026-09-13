# Assembles the logo kit page: inlines every mark once as a <symbol>, then <use> does the rest.
import os, re

ROOT = r"C:\Users\Surge Inc\OneDrive\Desktop\claude test 2"
MARKS = r"C:\Users\SURGEI~1\AppData\Local\Temp\claude\marks"
SRC = os.path.join(ROOT, "brand", "logos", "kit", "surge-logo-kit.src.html")
OUT = os.path.join(ROOT, "brand", "logos", "kit", "surge-logo-kit.html")


def parts(path):
    s = open(path).read()
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    fr = 'evenodd' if 'fill-rule="evenodd"' in s else None
    inner = re.sub(r"^<svg[^>]*>|</svg>\s*$", "", s)
    return vb, fr, inner


def symbol(sid, path):
    vb, fr, inner = parts(path)
    fra = ' fill-rule="evenodd"' if fr else ""
    return '<symbol id="%s" viewBox="%s" fill="currentColor"%s>%s</symbol>' % (sid, vb, fra, inner), vb


syms = []
ratios = {}

wm_vb, _, wm_inner = parts(os.path.join(ROOT, "brand", "logos", "surge-wordmark.svg"))
syms.append('<symbol id="wordmark" viewBox="%s" fill="currentColor" fill-rule="evenodd">%s</symbol>' % (wm_vb, wm_inner))
ratios["wordmark"] = wm_vb

for sid, fn in [("m-step", "step"), ("m-ascent", "ascent"), ("m-spike", "spike"),
                ("m-corner", "corner"), ("m-s-rule", "s-rule"), ("m-cut", "cut"),
                ("m-badge", "badge"), ("l-single", "single-line"), ("l-stack", "compact-stack")]:
    s, vb = symbol(sid, os.path.join(MARKS, fn + ".svg"))
    syms.append(s)
    ratios[sid] = vb

# ---- measured drawing of the wordmark -------------------------------------
G = "#4abe4a"
D = "#1f7a1f"
FS = 26
LBL = 'font-family="IBM Plex Mono,monospace" font-size="%d" fill="%s" letter-spacing="1"' % (FS, D)
TICK = 10


def dim_h(x0, x1, y, label, above=False):
    ty = y - 16 if above else y + FS + 8
    return ('<path d="M%g %gV%g M%g %gV%g M%g %gH%g" stroke="%s" stroke-width="3" fill="none"/>'
            '<text x="%g" y="%g" text-anchor="middle" %s>%s</text>'
            % (x0, y - TICK, y + TICK, x1, y - TICK, y + TICK, x0, y, x1, D,
               (x0 + x1) / 2, ty, LBL, label))


def dim_v(y0, y1, x, label, right=False):
    tx = x + 16 if right else x - 16
    anchor = "start" if right else "end"
    return ('<path d="M%g %gH%g M%g %gH%g M%g %gV%g" stroke="%s" stroke-width="3" fill="none"/>'
            '<text x="%g" y="%g" text-anchor="%s" %s>%s</text>'
            % (x - TICK, y0, x + TICK, x - TICK, y1, x + TICK, x, y0, y1, D,
               tx, (y0 + y1) / 2 + FS * 0.36, anchor, LBL, label))


measured = (
    '<symbol id="wordmark-measured" viewBox="-92 -78 830 316" fill="#000" fill-rule="evenodd">'
    '<g opacity="0.15">%s</g>'
    '<path d="M250 15H469V34H250Z M0 132H219V151H0Z" fill="%s" fill-rule="nonzero"/>'
    '<path d="M-46 0H620 M-46 89H620" stroke="%s" stroke-width="1.5" stroke-dasharray="6 6" '
    'opacity="0.45" fill="none"/>'
    '%s%s%s%s'
    '</symbol>'
) % (
    wm_inner, G, D,
    dim_v(0, 89, -50, "88"),
    dim_h(0, 219, 196, "219 bar length"),
    dim_v(132, 151, 648, "19", right=True),
    dim_h(219, 250, -40, "32 channel", above=True),
)
syms.append(measured)

# ---- clear-space drawing --------------------------------------------------
k = 300.0 / 598.0            # wordmark drawn 300 units wide
wmh = 162 * k
x0, y0 = 68.0, (400 - wmh) / 2
cs = 38 * k                  # clear space = 2 bar thicknesses at this scale
bt = 19 * k

clear = (
    '<symbol id="clearspace" viewBox="0 0 436 400" fill="#000" fill-rule="evenodd">'
    '<rect x="%g" y="%g" width="%g" height="%g" fill="%s" opacity="0.14"/>'
    '<rect x="%g" y="%g" width="%g" height="%g" fill="none" stroke="%s" '
    'stroke-width="2" stroke-dasharray="7 6"/>'
    '<g transform="translate(%g %g) scale(%g)">%s</g>'
    '<g fill="%s"><rect x="%g" y="%g" width="%g" height="%g"/>'
    '<rect x="%g" y="%g" width="%g" height="%g"/></g>'
    '<text x="%g" y="%g" font-family="IBM Plex Mono,monospace" font-size="15" fill="%s" '
    'letter-spacing="1">2 &#215; bar thickness</text>'
    '</symbol>'
) % (
    x0 - cs, y0 - cs, 300 + cs * 2, wmh + cs * 2, G,
    x0 - cs, y0 - cs, 300 + cs * 2, wmh + cs * 2, D,
    x0, y0, k, wm_inner,
    G,
    x0 - cs + 2, y0 - cs + 3, cs * 0.75, bt * 0.55,
    x0 - cs + 2, y0 - cs + 3 + bt * 0.95, cs * 0.75, bt * 0.55,
    x0 - cs, y0 - cs - 13, D,
)
syms.append(clear)

html = open(SRC).read()
block = ('<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" '
         'style="position:absolute"><defs>%s</defs></svg>' % "".join(syms))
html = html.replace("<!--SYMBOLS-->", block)
open(OUT, "w", encoding="utf-8").write(html)
print("wrote", OUT, len(html), "bytes")
