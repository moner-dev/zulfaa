# -*- coding: utf-8 -*-
"""An article's picture: the app's own screenshot inside the empty phone frame,
one per language and theme.

    python tools/article_art.py

THE INPUTS, kept outside this repository (it is the deployment):

    ../assets/masters/screenshots/...        the classified screenshots and
    ../assets/masters/screenshots/screenshot-manifest.csv   their manifest
    ../assets/masters/device/empty-mobile.png  the empty phone, 941x1672, its
                                               screen opening transparent

For every article in tools/articles.py with a `screen`, and every language and
theme whose screenshot the manifest classifies as exactly that screen (bytes
checked against the recorded SHA-256), this writes

    assets/articles/<screen>-<lang>-<theme>.webp       941x1672, transparent
    assets/articles/<screen>-<lang>-<theme>-640.webp   640 wide

NOTHING IS SUBSTITUTED. A missing screenshot is reported and no file is written
for it; articles.py shows a language in the new pictures only when both of its
themes exist, and otherwise keeps that language's previous picture.

HOW A SCREENSHOT GOES IN. The opening was measured from the frame's alpha
channel: x 121-820, y 95-1576 (700x1482), corners of radius ~84, the island at
y 109-170. The screenshot (945x2055) is scaled to the opening's width, which
makes it 40 px taller than the opening; those 40 px are taken off the TOP -
Android's status bar, which the island covers anyway (54 px of the original).
Nothing below the status bar is cropped, stretched or recoloured. The frame is
drawn over the screenshot, so the bezel's own anti-aliased edge is the edge.

Idempotent: an output with the same bytes is left alone.
"""
import csv, hashlib, io, os, sys
from PIL import Image, ImageDraw

TOOLS = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(TOOLS)
MASTERS = os.path.join(os.path.dirname(SITE), "assets", "masters")
SHOTS = os.path.join(MASTERS, "screenshots")
FRAME = os.path.join(MASTERS, "device", "empty-mobile.png")
OUT = os.path.join(SITE, "assets", "articles")

sys.path.insert(0, TOOLS)
from articles import ARTICLES  # noqa: E402

LANGS = ("en", "ar", "nl")
THEMES = ("light", "dark")
FRAME_SIZE = (941, 1672)
OPENING = (121, 95, 821, 1577)  # x0, y0, x1, y1 (exclusive)
RADIUS = 84
THUMB_W = 640
QUALITY = 88


def encode(im):
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=QUALITY, method=6, alpha_quality=100)
    return buf.getvalue()


def write_if_changed(path, data):
    if os.path.exists(path) and open(path, "rb").read() == data:
        return False
    with open(path, "wb") as fh:
        fh.write(data)
    return True


def compose(frame, shot):
    x0, y0, x1, y1 = OPENING
    w, h = x1 - x0, y1 - y0
    shot = shot.convert("RGB")
    scaled_h = round(shot.height * w / shot.width)
    assert scaled_h >= h, "the screenshot is shorter than the opening; nothing would fill it"
    shot = shot.resize((w, scaled_h), Image.LANCZOS)
    shot = shot.crop((0, scaled_h - h, w, scaled_h))  # the surplus comes off the status bar
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=RADIUS, fill=255)
    canvas = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    canvas.paste(shot, (x0, y0), mask)
    return Image.alpha_composite(canvas, frame)


def main():
    frame = Image.open(FRAME).convert("RGBA")
    assert frame.size == FRAME_SIZE, "the phone frame is %dx%d, expected %dx%d" % (*frame.size, *FRAME_SIZE)
    cx, cy = (OPENING[0] + OPENING[2]) // 2, (OPENING[1] + OPENING[3]) // 2
    assert frame.getpixel((cx, cy))[3] == 0, "the frame's screen is not transparent where the opening should be"

    rows = list(csv.DictReader(open(os.path.join(SHOTS, "screenshot-manifest.csv"), encoding="utf-8-sig")))
    os.makedirs(OUT, exist_ok=True)
    written, current, missing = 0, 0, []
    for art in ARTICLES:
        screen = art.get("screen")
        if not screen:
            continue
        for lang in LANGS:
            for theme in THEMES:
                stem = "%s-%s-%s" % (screen, lang, theme)
                hit = [r for r in rows if r["screen"] == screen and r["language"] == lang and r["theme"] == theme
                       and os.path.splitext(os.path.basename(r["new_relative_path"]))[0] == stem]
                if len(hit) != 1:
                    missing.append(stem)
                    continue
                src = os.path.join(SHOTS, hit[0]["new_relative_path"])
                raw = open(src, "rb").read()
                assert hashlib.sha256(raw).hexdigest() == hit[0]["sha256"], "master changed since it was classified: " + src
                out = compose(frame, Image.open(io.BytesIO(raw)))
                th = out.resize((THUMB_W, round(THUMB_W * out.height / out.width)), Image.LANCZOS)
                for name, im in ((stem + ".webp", out), ("%s-%d.webp" % (stem, THUMB_W), th)):
                    if write_if_changed(os.path.join(OUT, name), encode(im)):
                        written += 1
                    else:
                        current += 1
    print("article art: %d files written, %d already current" % (written, current))
    if missing:
        print("no screenshot yet (nothing substituted): " + ", ".join(missing))


if __name__ == "__main__":
    main()
