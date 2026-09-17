# -*- coding: utf-8 -*-
"""Copies the six Start screenshots into assets/hero3d/ as WebP, untouched.

No crop, no resize, no mirroring, no colour change: the texture is the
screenshot at its own 945x2055. The Arabic images already contain their RTL
layout, so they are never flipped here or in the page.

    python tools/hero3d/prepare_screens.py [SOURCE_DIR]
"""
import os, sys
from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_SRC = os.path.join(os.path.dirname(SITE), "ScreenShots", "Mobile Screenshots", "Mobile", "Start page")
SRC = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
OUT = os.path.join(SITE, "assets", "hero3d")

FILES = {
    ("ar", "light"): "Start-Light-Ar.png", ("ar", "dark"): "Start-Dark-Ar.png",
    ("en", "light"): "Start-Light-En.png", ("en", "dark"): "Start-Dark-En.png",
    ("nl", "light"): "Start-Light-NL.png", ("nl", "dark"): "Start-Dark-NL.png",
}

os.makedirs(OUT, exist_ok=True)
for (lang, theme), name in FILES.items():
    im = Image.open(os.path.join(SRC, name))
    assert im.size == (945, 2055), (name, im.size)
    im = im.convert("RGB")
    dst = os.path.join(OUT, "screen-%s-%s.webp" % (lang, theme))
    # LOSSLESS: lossy WebP (even at quality 94) moved text and icon edges by up
    # to 78 levels. The screen must show the screenshot, not an approximation.
    im.save(dst, "WEBP", lossless=True, quality=100, method=6, exact=True)
    back = Image.open(dst).convert("RGB")
    assert back.tobytes() == im.tobytes(), "lossless round trip changed pixels: " + dst
    print("%-26s <- %s  %d KB" % (os.path.basename(dst), name, os.path.getsize(dst) // 1024))
