# -*- coding: utf-8 -*-
"""Writes the /ar/ and /nl/ subtrees and re-renders the header of the English pages."""
import os, re, sys, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chrome import (SITE, LANGS, S, C, write, e, up, PREVIEW, OUT_ROOT, ORIGIN,
                    header_html, JS_CLASS, NAV_JS, reversion)
from pages import build_privacy, build_terms, build_support, build_delete
from home import build_home

BUILDERS = {"": build_home, "privacy/": build_privacy, "terms/": build_terms,
            "delete-data/": build_delete, "support/": build_support}

written = []
for lang in ("ar", "nl"):
    for page, fn in BUILDERS.items():
        path = os.path.join(LANGS[lang]["base"], page, "index.html").replace("\\", "/")
        written.append(write(path, fn(lang)))

EN_PAGES = {"index.html": ("", 0), "privacy/index.html": ("privacy/", 1),
            "terms/index.html": ("terms/", 1), "delete-data/index.html": ("delete-data/", 1),
            "support/index.html": ("support/", 1)}

# ── the English pages ───────────────────────────────────────────────────────
# These are hand-written, Play-facing originals. build.py touches exactly
# three things in them, each idempotent:
#
#   1. the <header>: re-rendered from the header strings in ui_strings.S["en"]
#      and from the primary links the page already contains (same hrefs, same
#      labels, same aria-current) - so the menu button and the language menu
#      are the one implementation across all fifteen pages;
#   2. the one-line `js` class script in <head> and assets/nav.js before
#      </body>, which the header needs;
#   3. the hreflang alternates.
#
# Nothing below the header is read or written. Running twice is a no-op.
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

HEADER_RE = re.compile(r'    <header class="site-head">.*?</header>\n\n', re.S)
NAV_LINK_RE = re.compile(r'<a href="([^"]*)"( aria-current="page")?>([^<]*)</a>')


def english_header(t, page, depth):
    m = HEADER_RE.search(t)
    assert m, "no <header class=\"site-head\"> in the English page"
    nav = re.search(r'<nav class="site-nav"[^>]*>(.*?)</nav>', m.group(0), re.S)
    assert nav, "no primary nav in the English header"
    links = [(h, html.unescape(label), bool(cur)) for h, cur, label in NAV_LINK_RE.findall(nav.group(1))]
    assert links, "no links in the English primary nav"
    return t[:m.start()] + header_html("en", page, depth, links) + t[m.end():]


for f, (page, depth) in EN_PAGES.items():
    full = os.path.join(SITE, f)
    t = open(full, encoding="utf-8").read()
    orig = t
    a = up(depth)
    t = english_header(t, page, depth)
    # every asset URL carries the current content hash, so a returning browser
    # can never pair this markup with a stylesheet it cached before the deploy
    t = reversion(t)
    if 'classList.add("js")' not in t:
        m = re.search(r'(    <link rel="stylesheet" href="[^"]*assets/zulfaa\.css(?:\?v=[0-9a-f]+)?" />\n)', t)
        assert m, f
        t = t[:m.end(1)] + JS_CLASS + "\n" + t[m.end(1):]
    if "assets/nav.js" not in t:
        assert t.count("  </body>") == 1, f
        t = t.replace("  </body>", NAV_JS % a + "\n  </body>", 1)
    # hreflang alternates
    if 'rel="alternate"' not in t:
        alts = "\n".join('    <link rel="alternate" hreflang="%s" href="%s%s%s" />'
                         % (c, ORIGIN, LANGS[c]["base"], page) for c in ("en", "ar", "nl"))
        alts += '\n    <link rel="alternate" hreflang="x-default" href="%s%s" />' % (ORIGIN, page)
        m = re.search(r'(    <link rel="canonical"[^\n]*\n)', t)
        assert m, f
        t = t[:m.end(1)] + alts + "\n" + t[m.end(1):]
    if t != orig:
        open(full, "w", encoding="utf-8", newline="").write(t)
        written.append(f + "  (header, nav.js, hreflang only)")

print("wrote %d files -> %s" % (len(written), OUT_ROOT))
for w in written:
    print("  " + w)
