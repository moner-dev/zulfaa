"""Measure text contrast of the Salah focus glass from review screenshots (WCAG relative luminance).

    python tools/salah_contrast.py SHOT.png [SHOT.png ...]      (desktop captures of tools/salah_check.mjs, 1440 wide)

The glass sits over a moving picture, so the background is measured, not assumed: inside the focus panel the text is a
small bright minority, so the 50th / 85th luminance percentiles of the panel are the typical / brightest BACKGROUND the
text has to hold against. Reports the ratio of the cream ink, the soft ink (78 % over that background) and the phase
accent against both."""
import sys
import numpy as np
from PIL import Image

BOX = (62, 392, 338, 572)  # inside the desktop focus panel of a 1440-wide capture (stage starts at y = 20)
INK = (254, 249, 240)
ACCENTS = {"fajr": "cfd0ff", "sunrise": "ffe0b0", "dhuhr": "f6e2a8", "asr": "ffd793", "maghrib": "ffc07a", "isha": "b9c4ff"}


def lin(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lum(rgb):
    r = lin(rgb)
    return 0.2126 * r[..., 0] + 0.7152 * r[..., 1] + 0.0722 * r[..., 2]


def ratio(a, b):
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


for path in sys.argv[1:]:
    img = np.asarray(Image.open(path).convert("RGB"))
    box = img[BOX[1]:BOX[3], BOX[0]:BOX[2]].reshape(-1, 3)
    l = lum(box)
    name = path.replace("\\", "/").split("/")[-1].split(".")[0]
    accent = tuple(int(ACCENTS.get(name, "f6e2a8")[i:i + 2], 16) for i in (0, 2, 4))
    out = [name.ljust(9)]
    for label, q in (("typical", 50), ("brightest", 85)):
        bl = np.percentile(l, q)
        bg = box[np.argsort(l)[int(len(l) * q / 100) - 1]].astype(np.float64)
        soft = 0.78 * np.array(INK) + 0.22 * bg
        out.append(f"{label} bg L={bl:.3f}: ink {ratio(lum(np.array(INK)), bl):.1f}  soft {ratio(lum(soft), bl):.1f}  accent {ratio(lum(np.array(accent)), bl):.1f}")
    print("   ".join(out))
