# -*- coding: utf-8 -*-
"""Prepares the 403 sticker for the web, from the master artwork.

    python tools/forbidden_art.py [MASTER.png]

The 404's twin (tools/notfound_art.py explains every rule, and they all hold
here): a 1122x1402 RGBA sticker - a crimson arch, two lit lanterns, a gilded
lattice gate closed by a padlock over the numerals, a marble podium - drawn on
TRANSPARENCY with its own shadow baked in. Saved WITH alpha, never cropped,
the aspect ratio held exactly across the ladder, lossy WebP at q=88.

The master's transparent margins are within 1% of the 404's (bottom 16.2% vs
17.3%, top 4.8% vs 2.8%), which is why the page reuses the 404's composition
and its `margin-block-end` pull-up unchanged instead of tuning a second copy.
"""
import os, sys
from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MASTER = os.path.join(os.path.dirname(SITE), "assets", "masters", "403.png")
MASTER = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MASTER
OUT = os.path.join(SITE, "assets")

WIDTHS = [562, 842, 1122]

im = Image.open(MASTER)
assert im.mode == "RGBA", "the master must keep its transparency: " + im.mode
src_w, src_h = im.size
print("master %dx%d  %s  %d KB" % (src_w, src_h, im.mode, os.path.getsize(MASTER) // 1024))

for w in WIDTHS:
    h = round(w * src_h / src_w)          # ratio held, never rounded to taste
    out = im if w == src_w else im.resize((w, h), Image.LANCZOS)
    dst = os.path.join(OUT, "forbidden-%d.webp" % w)
    out.save(dst, "WEBP", quality=88, method=6, alpha_quality=100)
    back = Image.open(dst)
    assert back.size == (w, h), (dst, back.size)
    assert back.mode in ("RGBA", "P"), "transparency lost in " + dst
    assert back.getchannel("A").getextrema()[0] == 0, "no transparent pixels left in " + dst
    print("  forbidden-%-5d %4dx%-4d  %4d KB" % (w, w, h, os.path.getsize(dst) // 1024))

print("aspect ratio %.5f held across the ladder" % (src_h / src_w))
