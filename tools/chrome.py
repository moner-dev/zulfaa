# -*- coding: utf-8 -*-
"""Generates the /ar/ and /nl/ subtrees of the ZULFAA website.

English lives at the root and is NOT generated - those pages are the approved,
Play-facing originals and are only ever touched to re-render their header
(menu button + language menu), which is generated here for every language.
Arabic and Dutch legal text comes from the app (content.json); only the
navigation and marketing copy is authored here.
"""
import json, os, re, sys, html, hashlib

SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCR)
from ui_strings import S, LANGS, DEIXIS          # noqa: E402
from dd_strings import DD                        # noqa: E402

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# ── which content, and where it is written ───────────────────────────────────
# ZULFAA_LEGAL_PREVIEW=1 renders the OWNER PREVIEW: the next-release legal
# clauses that extract_from_app.py drops from the public content file. It reads
# content.preview.json and writes into .preview/, which is gitignored, so a
# preview can never become a publication by forgetting a flag.
PREVIEW = os.environ.get("ZULFAA_LEGAL_PREVIEW") == "1"
C = json.load(open(os.path.join(SCR, "content.preview.json" if PREVIEW else "content.json"), encoding="utf-8"))
OUT_ROOT = os.path.join(SITE, ".preview") if PREVIEW else SITE
SHOTS = json.load(open(os.path.join(SCR, "shots.json"), encoding="utf-8"))
# The public origin. Custom domain since 10 September 2026: GitHub Pages
# served this repository at /zulfaa/ under the project URL, and serves the
# same tree from the ROOT under the domain, so only this line changes and
# every page path below it is unchanged.
ORIGIN = "https://zulfaa.nl/"
MAIL = "moner.intelligence@gmail.com"
DEV = "MONER INTELLIGENCE SYSTEMS"

CAPS = {
 "ar": ["الرئيسية","أوقات الصلاة","القبلة","القرآن الكريم","القراءة والاستماع","القرّاء","الأذكار والأدعية",
        "تحدّي اليوم","أسئلة التحدّي","مخطط رمضان","ادخار العمرة","التذكيرات","إعدادات الصلاة",
        "إعدادات التطبيق","الوضع الداكن","مساحتك","القائمة","المساعدة والدعم","عن زُلْفَى","الافتتاحية"],
 "nl": ["Start","Gebedstijden","Qibla","De Nobele Koran","Lezen en luisteren","Reciteurs","Adhkar en doe'a",
        "Dagelijkse uitdaging","Uitdagingsvragen","Ramadanplanner","Umrah-sparen","Herinneringen",
        "Gebedsinstellingen","App-instellingen","Donker thema","Uw ruimte","Navigatie","Hulp en support",
        "Over ZULFAA","De opening"],
}
ALT = {"ar": "لقطة من تطبيق زُلْفَى: %s", "nl": "Schermafbeelding uit de ZULFAA-app: %s"}

PAGES = ["", "privacy/", "terms/", "delete-data/", "support/"]


def e(t):
    return html.escape(t, quote=False)


def deixis(lang, text):
    for a, b in DEIXIS[lang]:
        text = text.replace(a, b)
    return text


AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"


def num(n, lang):
    """Arabic pages number their clauses in Arabic-Indic digits, as the app does."""
    s = str(n)
    return "".join(AR_DIGITS[int(c)] for c in s) if lang == "ar" else s


def up(depth):
    return "../" * depth


# ── shared chrome ──────────────────────────────────────────────────────────
def head(lang, page, depth, title, desc):
    a = up(depth)
    alts = "\n".join(
        '    <link rel="alternate" hreflang="%s" href="%s%s%s" />' % (l, ORIGIN, LANGS[l]["base"], page)
        for l in ("en", "ar", "nl"))
    return f"""<!doctype html>
<html lang="{lang}" dir="{LANGS[lang]['dir']}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{e(title)}</title>
    <meta name="description" content="{html.escape(desc)}" />
    <link rel="canonical" href="{ORIGIN}{LANGS[lang]['base']}{page}" />
{alts}
    <link rel="alternate" hreflang="x-default" href="{ORIGIN}{page}" />
    <link rel="icon" type="image/png" href="{a}assets/favicon-64.png" />
    <link rel="apple-touch-icon" href="{a}assets/apple-touch-icon.png" />
    <link rel="stylesheet" href="{a}{asset("assets/zulfaa.css")}" />
{JS_CLASS}
    <meta name="theme-color" content="#fef9f0" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="ZULFAA" />
    <meta property="og:title" content="{e(title)}" />
    <meta property="og:description" content="{html.escape(desc)}" />
    <meta property="og:url" content="{ORIGIN}{LANGS[lang]['base']}{page}" />
    <meta property="og:image" content="{ORIGIN}assets/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="{ {'en':'en','ar':'ar','nl':'nl'}[lang] }" />
  </head>
  <body>
"""


# The one line of script in <head>. It flips the class the stylesheet keys
# the collapsed header on, before any of the body is parsed, so a phone never
# paints the open menu and then hides it. With scripting off it never runs and
# the header renders as plain wrapped links - see assets/zulfaa.css.
JS_CLASS = '    <script>document.documentElement.classList.add("js");</script>'


def asset(rel):
    """`assets/x.css` -> `assets/x.css?v=<content hash>`.

    WHY THIS EXISTS. GitHub Pages serves every file with
    `Cache-Control: max-age=600`, so for ten minutes after a deploy a returning
    browser can pair NEW markup with the PREVIOUS stylesheet. That is not a
    slightly-off page: the drawer's own furniture has no styles yet, so the
    close button and the word "Menu" render inline in the header beside a
    language control that should be inside the drawer, and there is no drawer
    at all. That is exactly what shipped on 9 September 2026 and was reported
    as a broken design.

    A content hash in the URL makes the pairing impossible - new markup asks
    for a URL no old cache has ever seen - and it is stable, so rebuilding
    without touching an asset leaves the HTML byte-identical."""
    with open(os.path.join(SITE, rel), "rb") as fh:
        return "%s?v=%s" % (rel, hashlib.sha1(fh.read()).hexdigest()[:8])


ASSET_RE = re.compile(r"assets/(?:zulfaa\.css|nav\.js|carousel\.js)(?:\?v=[0-9a-f]+)?")


def reversion(text):
    """Rewrite every versioned asset URL in a page to the current hash."""
    return ASSET_RE.sub(lambda m: asset(m.group(0).split("?")[0]), text)


NAV_JS = '    <script src="%s' + asset("assets/nav.js") + '" defer></script>'

GLOBE = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
         '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>')
CHEV = ('<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>')
CHECK = ('<svg class="lang-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>')


def langswitch(lang, page, depth):
    """The language menu.

    Three plain links in a list - that is the whole thing with scripting off,
    and what a crawler follows. The button before the list carries the current
    language and is enhanced into a menu button by assets/nav.js; the
    stylesheet hides it until <html> has the `js` class. Same anchors either
    way, so every alternate URL is in the page exactly once."""
    a = up(depth)
    s = S[lang]
    out = ['          <nav class="lang-switch" aria-label="%s">' % e(s["langLabel"]),
           '            <button class="lang-btn" type="button" aria-haspopup="true" aria-expanded="false" '
           'aria-controls="lang-menu">',
           '              %s' % GLOBE,
           '              <span class="vh">%s</span>' % e(s["langPrefix"]),
           '              <span class="lang-name" lang="%s">%s</span>' % (lang, e(LANGS[lang]["name"])),
           '              <span class="lang-code" aria-hidden="true" lang="%s">%s</span>' % (lang, e(s["langShort"])),
           '              %s' % CHEV,
           '            </button>',
           '            <ul class="lang-list" id="lang-menu">']
    for l in ("en", "ar", "nl"):
        href = (a + LANGS[l]["base"] + page) or "./"
        cur = ' aria-current="true"' if l == lang else ""
        out.append('              <li><a href="%s" lang="%s" hreflang="%s"%s>%s%s</a></li>'
                   % (href, l, l, cur, e(LANGS[l]["name"]), CHECK if l == lang else ""))
    out.append("            </ul>")
    out.append("          </nav>")
    return "\n".join(out)


def nav_items(lang):
    s = S[lang]
    n = C[lang]["nav"]
    return [("", s["home"]), ("privacy/", n["privacy"]), ("terms/", n["terms"]),
            ("delete-data/", s["deleteNav"]), ("support/", n["support"])]


def header_html(lang, page, depth, links):
    """The header for any language. `links` is a list of (href, label, current)
    with hrefs already resolved - the English pages hand in the links they
    already contain, the generated pages the ones nav_items() computes.

    Order matters and is deliberate: brand, menu button, primary nav, language
    menu. The brand opens the header at the reading start and `margin-inline-end:
    auto` pushes everything after it to the reading end, so on a phone the menu
    button sits against the edge the drawer slides in from - left of the brand it
    left the whole other half of the header empty and read as unfinished. The tab
    order follows: brand, the button that opens the panel, then the panel.

    THE DRAWER. Below 1100px the primary nav and the language switcher move
    into a side panel that slides in from the READING END - the right in
    English and Dutch, the left in Arabic - over a backdrop. They are wrapped
    in `.drawer` for that, and above the breakpoint that wrapper is
    `display: contents`, so on a desktop its children are laid out by
    `.shell` exactly as they were before it existed. One markup, no
    duplicated links: a second copy of the nav inside a drawer would be a
    second set of URLs for a crawler and a second thing to keep in step.

    The close button and the backdrop are rendered for every page but are
    inert - `display: none` - until the collapsed breakpoint AND `html.js`."""
    a = up(depth)
    s = S[lang]
    home = (a + LANGS[lang]["base"]) or "./"
    rows = "\n".join('            <a href="%s"%s>%s</a>'
                     % (h, ' aria-current="page"' if cur else "", e(label)) for h, label, cur in links)
    return f"""    <header class="site-head">
      <div class="shell">
        <a class="brand" href="{home}">
          <img src="{a}assets/emblem-256.webp" alt="" width="256" height="256" />
          <span class="brand-name">Zulfaa</span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-menu" aria-label="{e(s['menuLabel'])}">
          <span class="bars" aria-hidden="true"><span class="bar"></span><span class="bar"></span><span class="bar"></span></span>
        </button>
        <div class="drawer" id="site-menu">
          <div class="drawer-top">
            <button class="drawer-close" type="button" aria-label="{e(s['closeLabel'])}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
          <nav class="site-nav" aria-label="{e(s['navLabel'])}">
{rows}
          </nav>
{langswitch(lang, page, depth)}
        </div>
        <div class="scrim" hidden></div>
      </div>
    </header>

"""


def header(lang, page, depth):
    a = up(depth)
    links = [(a + LANGS[lang]["base"] + href, label, href == page) for href, label in nav_items(lang)]
    return header_html(lang, page, depth, links)


def footer(lang, page, depth):
    a = up(depth)
    s = S[lang]
    items = nav_items(lang)
    links = "\n".join('          <a href="%s">%s</a>' % (a + LANGS[lang]["base"] + h, e(l)) for h, l in items)
    return f"""    <footer class="site-foot">
      <div class="shell">
        <nav aria-label="{e(s['footerLabel'])}">
{links}
        </nav>
        <p>
          {e(s['devBy'])}<br />
          <span class="dev">Moner Intelligence Systems</span>
        </p>
        <p>{e(s['rights'])}</p>
      </div>
    </footer>
{NAV_JS % a}
  </body>
</html>
"""


def toc(lang, ids, titles):
    s = S[lang]
    li = "\n".join('            <li><a href="#%s">%s. %s</a></li>' % (i, num(n + 1, lang), e(t))
                   for n, (i, t) in enumerate(zip(ids, titles)))
    return f"""        <nav class="toc" aria-labelledby="toc-title">
          <h2 id="toc-title">{e(s['contents'])}</h2>
          <ol>
{li}
          </ol>
        </nav>
"""


def dochead(lang, h1, sub, updated, depth):
    a = up(depth)
    return f"""        <div class="doc-head">
          <img src="{a}assets/emblem-256.webp" alt="" width="256" height="256" />
          <h1>{e(h1)}</h1>
          <p class="sub">{e(sub)}</p>
          <p class="meta">{e(updated)}</p>
        </div>
"""


# ── the clause renderer ────────────────────────────────────────────────────
BULLET = re.compile(r"\s·\s")


def body_html(text):
    """A clause body. Bodies that enumerate with '·' become a list in every
    language, which is how the English pages already read."""
    text = text.strip()
    if " · " in text:
        head_, rest = text.split(" · ", 1)
        parts = BULLET.split(" · " + rest)[1:] if False else rest.split(" · ")
        tail = ""
        if parts:
            last = parts[-1]
            # the sentence that follows the final bullet, if any
            m = re.search(r"(?<=[.。؟?！!])\s+(?=[A-Z\u0600-\u06FF])", last)
            if m and len(last) - m.end() > 60:
                parts[-1], tail = last[:m.start() + 1], last[m.end():]
        lis = "\n".join("              <li>%s</li>" % e(p.strip()) for p in parts if p.strip())
        out = "            <p>%s</p>\n            <ul>\n%s\n            </ul>" % (e(head_.strip()), lis)
        if tail:
            out += "\n            <p>%s</p>" % e(tail.strip())
        return out
    return "            <p>%s</p>" % e(text)


def clauses(lang, sections, linkmap=None):
    out = []
    for i, sec in enumerate(sections):
        b = deixis(lang, sec["body"])
        h = body_html(b)
        if linkmap:
            for needle, href, label in linkmap:
                if needle in b:
                    h = h.replace(e(needle), '<a href="%s">%s</a>' % (href, e(label)), 1)
        out.append('          <section id="%s">\n            <h2>%s. %s</h2>\n%s\n          </section>\n'
                   % (sec["id"], num(i + 1, lang), e(sec["title"]), h))
    return "\n".join(out)


def write(path, text):
    full = os.path.join(OUT_ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, "w", encoding="utf-8", newline="").write(text)
    return path
