# -*- coding: utf-8 -*-
"""Writes the /ar/ and /nl/ subtrees and re-renders the header of the English pages."""
import os, re, sys, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chrome import (SITE, LANGS, S, C, write, e, up, PREVIEW, OUT_ROOT, ORIGIN,
                    header_html, primary_nav, JS_CLASS, NAV_JS, reversion)
from pages import build_privacy, build_terms, build_support, build_delete
from home import build_home
from articles import ARTICLES, PUBLISHED as ARTICLES_PUBLISHED, build_index as build_articles_index, build_article
from notfound import build as build_notfound
from updates import build_updates

BUILDERS = {"": build_home, "privacy/": build_privacy, "terms/": build_terms,
            "delete-data/": build_delete, "support/": build_support}

written = []
for lang in ("ar", "nl"):
    for page, fn in BUILDERS.items():
        path = os.path.join(LANGS[lang]["base"], page, "index.html").replace("\\", "/")
        written.append(write(path, fn(lang)))

# ── the journal ─────────────────────────────────────────────────────────────
# The articles are new pages with no hand-written English original, so all
# three languages are generated from tools/articles.py - English included.
# Nothing is written while articles.PUBLISHED is False.
for lang in (("en", "ar", "nl") if ARTICLES_PUBLISHED else ()):
    base = LANGS[lang]["base"]
    written.append(write(os.path.join(base, "articles", "index.html").replace("\\", "/"),
                         build_articles_index(lang)))
    for art in ARTICLES:
        written.append(write(os.path.join(base, "articles", art["slug"], "index.html").replace("\\", "/"),
                             build_article(lang, art["slug"])))

# ── the 404 ─────────────────────────────────────────────────────────────────
# One file, at the root, because that is the only one GitHub Pages will serve
# for an unknown URL - it does not look inside /ar/ or /nl/. All three messages
# ship inside it. tools/notfound.py explains the <base> and the language boot.
written.append(write("404.html", build_notfound()))

# ── the 403 ─────────────────────────────────────────────────────────────────
# Three real pages (/403/, /ar/403/, /nl/403/), not one root file: a 403 is
# reached by an address, so each language gets its own chrome. It borrows the
# 404's composition. tools/forbidden.py explains what Pages can and cannot do.
from forbidden import apply as apply_forbidden
written += apply_forbidden()

# ── the Updates Oasis: generated in ALL THREE languages ─────────────────────
# Every other English page at the root is a hand-written, Play-facing original
# and build.py only re-renders its header. /updates/ is the exception, and
# deliberately so: its every word comes from tools/releases/*.json, so an
# English copy kept by hand would be a fourth transcription of the same data
# and the first thing to fall out of step with the other two languages. Adding
# a future release stays "one file plus one index line, in three languages at
# once" only if no language is maintained by hand.
for lang in ("en", "ar", "nl"):
    path = os.path.join(LANGS[lang]["base"], "updates/", "index.html").replace("\\", "/")
    written.append(write(path, build_updates(lang)))

EN_PAGES = {"index.html": ("", 0), "privacy/index.html": ("privacy/", 1),
            "terms/index.html": ("terms/", 1), "delete-data/index.html": ("delete-data/", 1),
            "support/index.html": ("support/", 1)}

# ── the English pages ───────────────────────────────────────────────────────
# These are hand-written, Play-facing originals. build.py touches exactly
# three things in them, each idempotent:
#
#   1. the <header>: re-rendered from ui_strings.S["en"] and chrome.primary_nav,
#      so the navigation, the menu button and the language menu are the one
#      implementation across every page;
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

# The generated chrome is a marked region so it can be replaced as a unit.
# The second alternative is the legacy shape - a bare header, optionally
# preceded by sentinels a previous build left behind - so pages written before
# the markers existed are repaired on the next run rather than accumulating.
HEADER_RE = re.compile(
    r'    <!-- site-chrome:start -->.*?    <!-- site-chrome:end -->\n\n'
    r'|(?:    <div class="head-sentinel"[^>]*></div>\n)*'
    r'    <header class="site-head">.*?</header>\n\n', re.S)


def english_header(t, page, depth):
    # The English originals carry the one primary navigation (chrome.primary_nav)
    # like every generated page; the links they used to hold are not read.
    m = HEADER_RE.search(t)
    assert m, "no <header class=\"site-head\"> in the English page"
    return t[:m.start()] + header_html("en", page, depth, primary_nav("en", page, depth)) + t[m.end():]


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

# ── maintenance ─────────────────────────────────────────────────────────────
# Last, because it edits pages the steps above have just written: the three
# /maintenance/ pages from tools/maintenance.json, then the gate line in the
# <head> of each covered page - added while `enabled` is true, removed when it
# is not. tools/maintenance.py explains what a static host can and cannot do.
from maintenance import apply as apply_maintenance
written += apply_maintenance()

print("wrote %d files -> %s" % (len(written), OUT_ROOT))
for w in written:
    print("  " + w)
