# -*- coding: utf-8 -*-
"""Writes the /ar/ and /nl/ subtrees and adds the switcher to the English pages."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chrome import SITE, LANGS, S, C, write, e, up, PREVIEW, OUT_ROOT
from pages import build_privacy, build_terms, build_support, build_delete
from home import build_home

BUILDERS = {"": build_home, "privacy/": build_privacy, "terms/": build_terms,
            "delete-data/": build_delete, "support/": build_support}

written = []
for lang in ("ar", "nl"):
    for page, fn in BUILDERS.items():
        path = os.path.join(LANGS[lang]["base"], page, "index.html").replace("\\", "/")
        written.append(write(path, fn(lang)))

# ── the English pages: add the switcher, change nothing else ───────────────
EN_LANGS = [("en", "English"), ("ar", "العربية"), ("nl", "Nederlands")]


def switcher_html(page, depth):
    a = up(depth)
    out = ['        <nav class="lang-switch" aria-label="Language">']
    for code, name in EN_LANGS:
        href = (a + LANGS[code]["base"] + page) or "./"
        cur = ' aria-current="true"' if code == "en" else ""
        out.append('          <a href="%s" lang="%s" hreflang="%s"%s>%s</a>' % (href, code, code, cur, name))
    out.append("        </nav>")
    return "\n".join(out)


EN_PAGES = {"index.html": ("", 0), "privacy/index.html": ("privacy/", 1),
            "terms/index.html": ("terms/", 1), "delete-data/index.html": ("delete-data/", 1),
            "support/index.html": ("support/", 1)}

# ── the English pages ───────────────────────────────────────────────────────
# These are hand-written, Play-facing originals; build.py only inserts the
# language switcher and the hreflang alternates, both idempotent.
#
# IN PREVIEW MODE THEY ARE NOT TOUCHED. The preview exists to show the owner
# next-release clauses; rewriting the published English files while doing that
# is exactly the accident this whole mechanism is meant to prevent. The English
# preview is read in the app instead (`?legal=preview` on a dev build), which
# renders the same strings from the same dictionary.
if PREVIEW:
    print("preview: English pages left untouched (they are the published originals)")
    print("wrote %d files -> %s" % (len(written), OUT_ROOT))
    raise SystemExit(0)

for f, (page, depth) in EN_PAGES.items():
    full = os.path.join(SITE, f)
    t = open(full, encoding="utf-8").read()
    changed = False
    if "lang-switch" not in t:
        # straight after the primary nav closes, inside the header shell
        m = re.search(r'(<nav class="site-nav" aria-label="Primary">.*?</nav>\n)', t, re.S)
        assert m, f
        t = t[:m.end(1)] + switcher_html(page, depth) + "\n" + t[m.end(1):]
        changed = True
    # hreflang alternates
    if 'rel="alternate"' not in t:
        alts = "\n".join('    <link rel="alternate" hreflang="%s" href="https://moner-dev.github.io/zulfaa/%s%s" />'
                         % (c, LANGS[c]["base"], page) for c, _ in EN_LANGS)
        alts += '\n    <link rel="alternate" hreflang="x-default" href="https://moner-dev.github.io/zulfaa/%s" />' % page
        m = re.search(r'(    <link rel="canonical"[^\n]*\n)', t)
        assert m, f
        t = t[:m.end(1)] + alts + "\n" + t[m.end(1):]
        changed = True
    if changed:
        open(full, "w", encoding="utf-8", newline="").write(t)
        written.append(f + "  (switcher + hreflang only)")

print("wrote %d files -> %s" % (len(written), OUT_ROOT))
for w in written:
    print("  " + w)
