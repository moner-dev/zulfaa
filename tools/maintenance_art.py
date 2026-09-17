# -*- coding: utf-8 -*-
"""Prepares the 503 maintenance sticker for the web, from the master artwork.

    python tools/maintenance_art.py [MASTER.png]

The same contract as tools/notfound_art.py, for the same kind of master: a
1122x1402 RGBA sticker - an arch over a night skyline, a hanging lantern, a
pocket watch holding a gear and crossed tools between the numerals, leaves on
a marble podium - drawn on TRANSPARENCY with its own shadow baked in. So:

  * the alpha channel is kept; the page's own ground is what it sits on;
  * nothing is cropped - the master's transparent margin is part of where the
    artwork sits in its own box, and the podium's shadow reaches into it;
  * the aspect ratio is held exactly at every width.
"""
import os, sys
from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MASTER = os.path.join(os.path.dirname(SITE), "assets", "masters", "503.png")
MASTER = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MASTER
OUT = os.path.join(SITE, "assets")

WIDTHS = [562, 842, 1122]

im = Image.open(MASTER)
assert im.mode == "RGBA", "the master must keep its transparency: " + im.mode
src_w, src_h = im.size
print("master %dx%d  %s  %d KB" % (src_w, src_h, im.mode, os.path.getsize(MASTER) // 1024))

for w in WIDTHS:
    h = round(w * src_h / src_w)
    out = im if w == src_w else im.resize((w, h), Image.LANCZOS)
    dst = os.path.join(OUT, "maintenance-%d.webp" % w)
    out.save(dst, "WEBP", quality=88, method=6, alpha_quality=100)
    back = Image.open(dst)
    assert back.size == (w, h), (dst, back.size)
    assert back.mode in ("RGBA", "P"), "transparency lost in " + dst
    assert back.getchannel("A").getextrema()[0] == 0, "no transparent pixels left in " + dst
    print("  maintenance-%-5d %4dx%-4d  %4d KB" % (w, w, h, os.path.getsize(dst) // 1024))

print("aspect ratio %.5f held across the ladder" % (src_h / src_w))
