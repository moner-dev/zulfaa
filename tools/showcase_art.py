# -*- coding: utf-8 -*-
"""Prepares the homepage carousel's screenshots for the web, from the masters.

    python tools/showcase_art.py [MASTERS_DIR]

THE MASTERS. The app's own screenshots, organised by language and theme and
kept OUTSIDE this repository - it is the deployment, and archival originals
have no business being published - at

    ../assets/masters/screenshots/{AR,En,NL}/{Dark,Light}/<screen>-<lang>-<theme>.png|jpg
    ../assets/masters/screenshots/screenshot-manifest.csv

The manifest records every master's classification (screen, language, theme)
and its SHA-256. A master is used only when the manifest says it IS that
screen in that language and theme, and its bytes still match - a file that
merely has the right name is not enough.

WHAT IS WRITTEN. For every entry in tools/shots.json, in all six combinations:

    assets/showcase/<screen>-<lang>-<theme>.webp       full size, the preview
    assets/showcase/<screen>-<lang>-<theme>-640.webp   the carousel slide

Nothing is ever substituted. If a screen lacks any of its six masters, this
script stops and names what is missing; that screen does not belong in
shots.json until the screenshots exist.

The pixels are the screenshots as captured: resized for the 640 width only,
never cropped, recoloured or framed. Lossy WebP at high quality - these are
screens of text, checked by eye at 640 px (q85) and full size (q88). The
masters themselves are only ever read.

Idempotent: an existing output with the same bytes is left alone, so a second
run changes nothing.
"""
import csv, hashlib, io, json, os, sys
from PIL import Image

TOOLS = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(TOOLS)
MASTERS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(SITE), "assets", "masters", "screenshots")
OUT = os.path.join(SITE, "assets", "showcase")

LANGS = ("en", "ar", "nl")
THEMES = ("light", "dark")
THUMB_W = 640
QUALITY = {"full": 88, "thumb": 85}


def names(screen, lang, theme):
    base = "%s-%s-%s" % (screen, lang, theme)
    return base + ".webp", "%s-%d.webp" % (base, THUMB_W)


def encode(im, quality):
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6)
    return buf.getvalue()


def write_if_changed(path, data):
    if os.path.exists(path) and open(path, "rb").read() == data:
        return False
    with open(path, "wb") as fh:
        fh.write(data)
    return True


def main():
    shots = json.load(open(os.path.join(TOOLS, "shots.json"), encoding="utf-8"))
    rows = list(csv.DictReader(open(os.path.join(MASTERS, "screenshot-manifest.csv"), encoding="utf-8-sig")))
    wanted = {sh["file"] for sh in shots}

    # the classified master for each (screen, lang, theme): the manifest row
    # whose file name is exactly <screen>-<lang>-<theme> (a "-2" retake is
    # recorded, but never chosen implicitly)
    table, missing = {}, []
    for sh in shots:
        for lang in LANGS:
            for theme in THEMES:
                stem = "%s-%s-%s" % (sh["file"], lang, theme)
                hit = [r for r in rows if r["screen"] == sh["file"] and r["language"] == lang
                       and r["theme"] == theme and os.path.splitext(os.path.basename(r["new_relative_path"]))[0] == stem]
                if len(hit) != 1:
                    missing.append(stem)
                    continue
                table[(sh["file"], lang, theme)] = hit[0]
    if missing:
        raise SystemExit("missing masters - these screens cannot be in shots.json yet:\n  " + "\n  ".join(missing))

    os.makedirs(OUT, exist_ok=True)
    written = 0
    for (screen, lang, theme), row in sorted(table.items()):
        src = os.path.join(MASTERS, row["new_relative_path"])
        raw = open(src, "rb").read()
        assert hashlib.sha256(raw).hexdigest() == row["sha256"], "master changed since it was classified: " + src
        im = Image.open(io.BytesIO(raw))
        im.load()
        im = im.convert("RGB")
        sh = next(s for s in shots if s["file"] == screen)
        assert im.size == (sh["w"], sh["h"]), "%s is %dx%d, shots.json says %dx%d" % (src, *im.size, sh["w"], sh["h"])
        full, thumb = names(screen, lang, theme)
        th = round(THUMB_W * im.size[1] / im.size[0])
        written += write_if_changed(os.path.join(OUT, full), encode(im, QUALITY["full"]))
        written += write_if_changed(os.path.join(OUT, thumb), encode(im.resize((THUMB_W, th), Image.LANCZOS), QUALITY["thumb"]))
    print("%d screens x %d languages x %d themes: %d files written, %d already current"
          % (len(wanted), len(LANGS), len(THEMES), written, 2 * len(table) - written))


if __name__ == "__main__":
    main()
