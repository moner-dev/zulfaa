# -*- coding: utf-8 -*-
"""Refresh the English originals' shared parts, idempotently.

build.py deliberately writes nothing below the header of the hand-written
English pages. Two things down there are nevertheless generated from one
source for all three languages - the home page's lower sections and the
footer - so this script is how English receives them:

    python tools/write_en.py

It replaces only marked regions:
  index.html   <!-- journal:start --> … <!-- contact:end -->   (first run: the
               two old bands, "Built local first" and "Availability")
  index.html   <!-- showcase:start --> … <!-- showcase:end -->   the screenshot
               carousel, and <!-- lightbox:start --> … <!-- lightbox:end -->,
               its preview (first run: the hand-kept copies of both)
  every page   <footer class="site-foot"> … </footer>
and makes sure index.html loads the contact scripts. Run it twice: the second
run reports that nothing changed.
"""
import os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chrome import SITE, asset, THEME_BOOT  # noqa: E402
from articles import render_journal  # noqa: E402
from lower import render_trust, render_contact, render_footer  # noqa: E402
from lantern import host as lantern_host  # noqa: E402
from scrolldock import render as render_dock  # noqa: E402
from showcase import render_showcase, render_lightbox  # noqa: E402

PAGES = {"index.html": ("", 0), "privacy/index.html": ("privacy/", 1),
         "terms/index.html": ("terms/", 1), "delete-data/index.html": ("delete-data/", 1),
         "support/index.html": ("support/", 1), "articles/index.html": None}

# Indent-agnostic on purpose: it has to find the block where an earlier version
# of this script put it (inside .hero-wrap, at ten spaces) as well as where it
# goes now, so the home page migrates instead of ending up with two lanterns.
LANTERN_MARKED = re.compile(r"[ ]*<!-- lantern:start -->.*?<!-- lantern:end -->\n", re.S)
SHELL_OPEN = '    <main>\n      <div class="shell">\n'
LANTERN_JS = re.compile(r'    <script src="[^"]*assets/lantern\.js[^"]*" defer></script>\n')
NAV_JS_TAG = re.compile(r'(    <script src="[^"]*assets/nav\.js[^"]*" defer></script>\n)')
DOCK_MARKED = re.compile(r"[ ]*<!-- scrolldock:start -->.*?<!-- scrolldock:end -->\n", re.S)
DOCK_JS = re.compile(r'    <script src="[^"]*assets/scrolldock\.js[^"]*" defer></script>\n')
FOOTER_END = "    </footer>\n"
BOOT_RE = re.compile(r'    <script>\(function\(\)\{try\{var t=localStorage\.getItem\("zulfaa-site-theme"\).*?</script>\n', re.S)
JS_CLASS_LINE = '    <script>document.documentElement.classList.add("js");</script>\n'
LOWER_MARKED = re.compile(r"        <!-- journal:start -->.*?<!-- contact:end -->\n", re.S)
LOWER_LEGACY = re.compile(r'      <div class="shell">\n'
                          r'        <section class="band" aria-labelledby="privacy-first">.*?'
                          r'</section>\n      </div>\n', re.S)
# the home page's footer carries a modifier class (is-joined), so match any
FOOTER_RE = re.compile(r'    <footer class="site-foot[^"]*">.*?    </footer>\n', re.S)
# configuration FIRST: contact.js reads it (see fix_contact_scripts)
SCRIPTS = ("contact-config.js", "contact.js")

# The carousel and its preview. The legacy shapes are the hand-kept English
# copies these regions replace on the first run: the whole showcase <section>,
# and the lightbox <div> with the comment that introduced it. The lightbox's
# inner blocks are indented deeper than its own closing tag, which ends it.
SHOWCASE_MARKED = re.compile(r"      <!-- showcase:start -->.*?<!-- showcase:end -->\n", re.S)
SHOWCASE_LEGACY = re.compile(r'      <section class="showcase" aria-labelledby="showcase-title">.*?\n      </section>\n', re.S)
LIGHTBOX_MARKED = re.compile(r"    <!-- lightbox:start -->.*?<!-- lightbox:end -->\n", re.S)
LIGHTBOX_LEGACY = re.compile(r'    (?:<!-- Screenshot lightbox\..*?-->\n    )?<div class="lb" id="lb" hidden>.*?\n    </div>\n', re.S)


def lower_block():
    return (render_journal("en", "") + "\n\n" + render_trust("en", "")
            + "\n\n" + render_contact("en", "") + "\n")


def fix_lantern(t, rel):
    """Hang the lantern at the top of the page's shell - every page, not just
    the home page. It is the site's only light/dark control, so a page without
    one is a page a visitor in dark mode cannot get out of.

    Every existing marked block is removed first, wherever it sits, and exactly
    one is written back. That both migrates the home page's old block out of
    .hero-wrap and makes running this twice a no-op."""
    t = LANTERN_MARKED.sub("", t)
    i = t.find(SHELL_OPEN)
    assert i != -1, rel + ": no <main>/shell to hang the lantern in"
    j = i + len(SHELL_OPEN)
    return t[:j] + lantern_host("en", "") + t[j:]


def fix_dock(t, rel):
    """The scroll dock, after the footer and fixed to the viewport. Same
    remove-then-write-one shape as the lantern, so running twice is a no-op."""
    t = DOCK_MARKED.sub("", t)
    i = t.rfind(FOOTER_END)
    assert i != -1, rel + ": no footer to place the scroll dock after"
    j = i + len(FOOTER_END)
    return t[:j] + render_dock("en") + t[j:]


def fix_dock_script(t, a, rel):
    tag = '    <script src="%s%s" defer></script>\n' % (a, asset("assets/scrolldock.js"))
    t = DOCK_JS.sub("", t)
    m = LANTERN_JS.search(t)
    assert m, rel + ": no lantern.js tag to place scrolldock.js after"
    return t[:m.end()] + tag + t[m.end():]


def fix_lantern_script(t, a, rel):
    """assets/lantern.js on every English page, after nav.js - the one script
    tag every page already carries, home page or not."""
    tag = '    <script src="%s%s" defer></script>\n' % (a, asset("assets/lantern.js"))
    t = LANTERN_JS.sub("", t)
    m = NAV_JS_TAG.search(t)
    assert m, rel + ": no nav.js tag to place lantern.js after"
    return t[:m.end(1)] + tag + t[m.end(1):]


def fix_boot(t):
    """The theme boot line belongs to every page's <head>; build.py does not
    rewrite the English <head>, so it is placed here."""
    if BOOT_RE.search(t):
        return BOOT_RE.sub(lambda m: THEME_BOOT + "\n", t, count=1)
    i = t.find(JS_CLASS_LINE)
    assert i != -1, "no js-class script to place the theme boot after"
    return t[:i + len(JS_CLASS_LINE)] + THEME_BOOT + "\n" + t[i + len(JS_CLASS_LINE):]


def fix_showcase(t):
    """The screenshot carousel and its preview, from tools/showcase.py - the
    same markup the Arabic and Dutch home pages get from home.py."""
    for marked, legacy, block, what in ((SHOWCASE_MARKED, SHOWCASE_LEGACY, render_showcase("en", ""), "showcase"),
                                        (LIGHTBOX_MARKED, LIGHTBOX_LEGACY, render_lightbox("en"), "lightbox")):
        if marked.search(t):
            t = marked.sub(lambda m: block, t, count=1)
        else:
            assert len(legacy.findall(t)) == 1, "index.html: no %s markers and not exactly one legacy %s" % (what, what)
            t = legacy.sub(lambda m: block, t, count=1)
    return t


def fix_home(t):
    t = fix_showcase(t)
    block = lower_block()
    if LOWER_MARKED.search(t):
        t = LOWER_MARKED.sub(lambda m: block, t, count=1)
    else:
        assert LOWER_LEGACY.search(t), "index.html: no lower sections and no markers"
        t = LOWER_LEGACY.sub(lambda m: block, t, count=1)
    return fix_contact_scripts(t)


def fix_contact_scripts(t):
    """The contact scripts, as ONE block in ONE order, right after carousel.js.

    Order matters: both are `defer`, which runs them in document order, and
    contact.js reads the configuration. The previous version inserted each tag
    separately "after carousel.js" in a loop, so the second insertion landed in
    front of the first and English loaded contact.js before its configuration
    (the Arabic and Dutch pages, from home.py, were always right). Removing
    every existing tag and writing the block back makes the order a property
    of this function, not of how many times it has run. lantern.js is placed
    on every page by fix_lantern_script, not here."""
    for js in SCRIPTS:
        t = re.sub(r'    <script src="[^"]*assets/%s(?:\?v=[0-9a-f]+)?" defer></script>\n' % re.escape(js), "", t)
    block = "".join('    <script src="%s" defer></script>\n' % asset("assets/" + js) for js in SCRIPTS)
    m = re.search(r'    <script src="[^"]*assets/carousel\.js[^"]*" defer></script>\n', t)
    assert m, "index.html: no carousel.js tag to place the contact scripts after"
    t = t[:m.end()] + block + t[m.end():]
    order = [t.find("assets/" + js + "?") for js in SCRIPTS]
    assert -1 not in order and order == sorted(order), "index.html: contact scripts out of order"
    return t


def main():
    changed = []
    for rel, spec in PAGES.items():
        full = os.path.join(SITE, rel)
        if spec is None or not os.path.exists(full):
            continue  # generated pages (articles/) are written by build.py
        page, depth = spec
        t = orig = open(full, encoding="utf-8").read()
        t = fix_boot(t)  # every English page carries the theme boot line
        t = fix_lantern(t, rel)  # ... and every one carries the lantern
        t = fix_lantern_script(t, "../" * depth, rel)
        if rel == "index.html":
            t = fix_home(t)
        assert FOOTER_RE.search(t), rel + ": no footer to replace"
        t = FOOTER_RE.sub(lambda m: render_footer("en", page, depth), t, count=1)
        t = fix_dock(t, rel)  # ... and every one carries the scroll dock
        t = fix_dock_script(t, "../" * depth, rel)
        if t != orig:
            open(full, "w", encoding="utf-8", newline="").write(t)
            changed.append(rel)
    print("write_en: %s" % (", ".join(changed) if changed else "already current"))


if __name__ == "__main__":
    main()
