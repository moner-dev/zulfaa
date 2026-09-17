# -*- coding: utf-8 -*-
"""Prepares the 404 sticker for the web, from the master artwork.

    python tools/notfound_art.py [MASTER.png]

The master is a 1122x1402 RGBA sticker - an emerald arch, a hanging lantern, a
compass over the numerals, gilded leaves and a marble podium - drawn on
TRANSPARENCY, with its own soft shadow baked in. Three things follow from that
and none of them may be "tidied":

  * the alpha channel is the whole point. The page's own background is what the
    sticker sits on, in either theme, so the file is saved WITH alpha and is
    never flattened onto a colour.
  * nothing is cropped. The hanging stars reach the top edge and the podium's
    shadow reaches the bottom; trimming the transparent margin would clip them
    and change where the artwork sits in its own box.
  * the aspect ratio is held exactly. Each height is computed from the width,
    so the ladder is the same picture at three sizes and never a squashed one.

Lossy WebP, not lossless: this is painted artwork with soft gradients and a
blurred shadow, where q=88 is indistinguishable and a tenth of the weight. (The
hero screenshots next door are lossless for the opposite reason - they are
screenshots of text.)
"""
import os, sys
from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MASTER = os.path.join(os.path.dirname(SITE), "assets", "masters", "404.png")
MASTER = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MASTER
OUT = os.path.join(SITE, "assets")

# The largest is the master's own width: the sticker is never drawn wider than
# ~430 CSS px, so 1122 covers a 2x screen with room to spare.
WIDTHS = [562, 842, 1122]

im = Image.open(MASTER)
assert im.mode == "RGBA", "the master must keep its transparency: " + im.mode
src_w, src_h = im.size
print("master %dx%d  %s  %d KB" % (src_w, src_h, im.mode, os.path.getsize(MASTER) // 1024))

for w in WIDTHS:
    h = round(w * src_h / src_w)          # ratio held, never rounded to taste
    out = im if w == src_w else im.resize((w, h), Image.LANCZOS)
    dst = os.path.join(OUT, "notfound-%d.webp" % w)
    out.save(dst, "WEBP", quality=88, method=6, alpha_quality=100)
    back = Image.open(dst)
    assert back.size == (w, h), (dst, back.size)
    assert back.mode in ("RGBA", "P"), "transparency lost in " + dst
    assert back.getchannel("A").getextrema()[0] == 0, "no transparent pixels left in " + dst
    print("  notfound-%-5d %4dx%-4d  %4d KB" % (w, w, h, os.path.getsize(dst) // 1024))

print("aspect ratio %.5f held across the ladder" % (src_h / src_w))
