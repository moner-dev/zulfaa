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
from lantern import host as lantern_host         # noqa: E402
from scrolldock import render as scroll_dock     # noqa: E402

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

# Arabic and Dutch captions, one per shots.json entry and in the same order
# (English is `caption` in shots.json). tools/showcase.py refuses a mismatch.
CAPS = {
 "ar": ["الرئيسية","أوقات الصلاة","القرآن الكريم","القراءة والاستماع","خيارات الآية","القبلة","الأذكار والأدعية",
        "تحدّي اليوم","أسئلة التحدّي","مخطط رمضان","ادخار العمرة","هدف الادّخار","التنبيهات","مساحتك الشخصية","القائمة",
        "المساعدة والدعم"],
 "nl": ["Start","Gebedstijden","De Nobele Koran","Lezen en luisteren","Versopties","Qibla","Adhkar en doe'a",
        "Dagelijkse uitdaging","Uitdagingsvragen","Ramadanplanner","Umrah-sparen","Spaardoel","Meldingen","Uw persoonlijke ruimte","Menu",
        "Hulp en support"],
}
ALT = {"ar": "لقطة من تطبيق زُلْفَى: %s", "nl": "Schermafbeelding uit de ZULFAA-app: %s"}

PAGES = ["", "articles/", "privacy/", "terms/", "delete-data/", "support/", "updates/"]


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
{THEME_BOOT}
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

# The saved site theme, applied before the stylesheet paints anything, so a
# visitor who chose dark never sees the cream page flash first. It is the same
# line on every page, which is why dark survives following a link. The lantern
# that sets it lives on the home page (tools/lantern.py).
THEME_BOOT = ('    <script>(function(){try{var t=localStorage.getItem("zulfaa-site-theme");'
              'if(t==="dark"||t==="light")document.documentElement.setAttribute("data-site-theme",t)}'
              'catch(e){}})();</script>')


def themed_img_boot(indent):
    """For images with both themes' files (data-src-light/-dark, data-srcset-*):
    placed inline right after them, it switches them to the dark set while the
    page is still parsing when dark is already the theme, so a lazy image never
    fetches the light file first. Idempotent - it may run several times on a
    page. assets/lantern.js keeps them in step when the theme changes later."""
    return (indent + '<script>(function(){try{if(document.documentElement.getAttribute("data-site-theme")!=="dark")return;'
            'var s=document.querySelectorAll("img[data-src-dark]");'
            'for(var i=0;i<s.length;i++){s[i].setAttribute("srcset",s[i].getAttribute("data-srcset-dark"));'
            's[i].setAttribute("src",s[i].getAttribute("data-src-dark"))}}catch(e){}})();</script>\n')


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


ASSET_RE = re.compile(r"assets/(?:zulfaa\.css|nav\.js|carousel\.js|hero3d\.js|quick-access\.js"
                      r"|contact-config\.js|contact\.js|lantern\.js|scrolldock\.js|updates\.js)(?:\?v=[0-9a-f]+)?")


def reversion(text):
    """Rewrite every versioned asset URL in a page to the current hash."""
    return ASSET_RE.sub(lambda m: asset(m.group(0).split("?")[0]), text)


NAV_JS = '    <script src="%s' + asset("assets/nav.js") + '" defer></script>'
# Beside nav.js because it belongs to the same furniture: the lantern is on
# every page, so the script that gives it its state has to be too. Without it
# the lantern still draws and the saved theme still applies - it simply cannot
# be changed, which on a secondary page means no way out of dark mode.
LANTERN_JS = '    <script src="%s' + asset("assets/lantern.js") + '" defer></script>'
DOCK_JS = '    <script src="%s' + asset("assets/scrolldock.js") + '" defer></script>'

GLOBE = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
         '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>')
CHEV = ('<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>')
CHECK = ('<svg class="lang-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>')


def lang_links(lang, page, depth):
    """(code, href, is_current) for the three languages, pointing at the SAME
    page in each. Both language menus call this, so "stay on this page when
    the language changes" is implemented once."""
    a = up(depth)
    return [(l, (a + LANGS[l]["base"] + page) or "./", l == lang)
            for l in ("en", "ar", "nl")]


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
    for l, href, cur in lang_links(lang, page, depth):
        out.append('              <li><a href="%s" lang="%s" hreflang="%s"%s>%s%s</a></li>'
                   % (href, l, l, ' aria-current="true"' if cur else "",
                      e(LANGS[l]["name"]), CHECK if cur else ""))
    out.append("            </ul>")
    out.append("          </nav>")
    return "\n".join(out)


def nav_items(lang):
    """The pages, with the labels that language's pages already use.

    English takes `navSupport` ("Support") rather than the app's own "Help &
    Support": the hand-written English headers say Support, and a generated
    footer that disagreed with the header above it would read as a mistake."""
    s = S[lang]
    n = C[lang]["nav"]
    return [("", s["home"]), ("privacy/", n["privacy"]), ("terms/", n["terms"]),
            ("delete-data/", s["deleteNav"]), ("support/", s.get("navSupport", n["support"]))]


# The only external address ZULFAA actually has. The About screen in the app
# links to the same place, so the site and the app agree.
GITHUB = "https://github.com/moner-dev"

PLAY_SVG = ('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
            '<path d="M4 2.7v18.6c0 .6.6 1 1.1.7l14.4-8.6a.9.9 0 0 0 0-1.5L5.1 2'
            'c-.5-.3-1.1.1-1.1.7Z"/></svg>')

GH_SVG = ('<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">'
          '<path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27s-1.36.09-2 .27c-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>')


def topbar_lang(lang, page, depth):
    """The Top Bar's language menu: globe, the current language, a chevron.

    Same markup contract as the navbar's - a button plus a plain <ul> of the
    three links - so assets/nav.js drives it with the very same `disclosure`
    it uses for the navbar menu and the drawer, and Escape, outside-click,
    arrow keys and focus return all come with it.

    Without scripting the button is hidden and this whole control is hidden
    with it; the header still renders its three language links inline, so
    language is never unreachable."""
    s = S[lang]
    out = ['          <div class="topbar-lang">',
           '            <button class="topbar-lang-btn" type="button" aria-haspopup="true" '
           'aria-expanded="false" aria-controls="topbar-lang-menu">',
           '              %s' % GLOBE,
           '              <span class="vh">%s</span>' % e(s["langPrefix"]),
           '              <span class="topbar-lang-name" lang="%s">%s</span>'
           % (lang, e(LANGS[lang]["name"])),
           '              <span class="topbar-lang-code" aria-hidden="true" lang="%s">%s</span>'
           % (lang, e(s["langShort"])),
           '              %s' % CHEV,
           '            </button>',
           '            <ul class="topbar-lang-list" id="topbar-lang-menu">']
    for l, href, cur in lang_links(lang, page, depth):
        out.append('              <li><a href="%s" lang="%s" hreflang="%s"%s>%s%s</a></li>'
                   % (href, l, l, ' aria-current="true"' if cur else "",
                      e(LANGS[l]["name"]), CHECK if cur else ""))
    out.append("            </ul>")
    out.append("          </div>")
    return "\n".join(out)


def topbar(lang, page, depth):
    """A slim bar ABOVE the navigation: the project's social presence at the
    reading start, the Google Play state at the reading end, and one line of
    availability between them on wide screens.

    Every class here is prefixed `topbar-` and every rule is scoped to
    `.topbar`, so nothing in it can reach the header, the side menu, the
    buttons or the hero. It is deliberately NOT sticky - it scrolls away and
    the navbar below it keeps sticking.

    The Play element is a <span>. ZULFAA has no Play listing and no testing
    URL, so there is nothing honest to link to yet; when there is, this
    becomes an <a href> and no layout around it changes.

    Instagram and Facebook are absent because no account for either exists in
    this project. An icon linking nowhere is worse than one fewer icon.
    """
    s = S[lang]
    return f"""    <div class="topbar">
      <div class="topbar-inner">
        <div class="topbar-social">
          <a class="topbar-link" href="{GITHUB}" rel="me noopener" target="_blank">
            {GH_SVG}<span class="vh">{e(s['ghLabel'])}</span>
          </a>
{topbar_lang(lang, page, depth)}
        </div>
        <p class="topbar-note">{e(s['topNote'])}</p>
        <p class="topbar-play">
          <span class="topbar-status">{PLAY_SVG}{e(s['playSoon'])}</span>
        </p>
      </div>
    </div>
"""


def header_html(lang, page, depth, links):
    """The header for any language. `links` is a list of (href, label, current)
    with hrefs already resolved - always chrome.primary_nav() (nav_items() is
    the footer's list).

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
    return f"""    <!-- site-chrome:start -->
{topbar(lang, page, depth)}    <div class="head-sentinel" aria-hidden="true"></div>
    <header class="site-head">
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
    <!-- site-chrome:end -->

"""


# The id of the home page's contact section. Contact in the primary nav and
# the footer's "Write to ZULFAA" both point at it, in the page's language.
CONTACT_ID = "contact"


def primary_nav(lang, page, depth):
    """THE primary navigation, for every page in every language - the desktop
    row and the phone drawer are the same links (header_html).

        Start · Updates · Support · Contact

    Contact is the home page's contact section in this language (/#contact,
    /ar/#contact, /nl/#contact): a plain link, so it works from any page, on
    reload and without scripting. It is never marked current - on the home
    page Start is, and two current destinations would contradict each other.
    Privacy, Terms and Data deletion are NOT here; they are in the footer."""
    s = S[lang]
    home = (up(depth) + LANGS[lang]["base"]) or "./"
    items = [("", s["pnStart"]), ("updates/", s["pnUpdates"]), ("support/", s["pnSupport"])]
    links = [((home + href) if href else home, label, href == page) for href, label in items]
    links.append((home + "#" + CONTACT_ID, s["pnContact"], False))
    return links


def header(lang, page, depth):
    return header_html(lang, page, depth, primary_nav(lang, page, depth))


def footer(lang, page, depth):
    """The closing composition - brand, pages, availability, social, copyright.

    Its markup lives in lower.py beside the contact block it continues, and is
    imported here so every builder keeps calling chrome.footer(). The import is
    inside the function because lower.py reads this module at its own import
    time."""
    from lower import render_footer
    # The dock is fixed to the viewport, so it sits after the footer rather than
    # inside it - it belongs to the page, not to the ending.
    return render_footer(lang, page, depth) + "\n" + scroll_dock(lang) + f"""{NAV_JS % up(depth)}
{LANTERN_JS % up(depth)}
{DOCK_JS % up(depth)}
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


def main_open(lang, depth=0):
    """How every page opens: <main>, the shell, and the lantern hung at the top
    of it.

    The lantern is the site's light/dark control and there is exactly one of it
    per page. Having a single opener is what keeps that true and what keeps it
    in the same place everywhere: no generator positions the lantern, they only
    say "a page starts here". A page that opens its own <main> by hand would
    silently have no way to change the theme."""
    return '    <main>\n      <div class="shell">\n' + lantern_host(lang, up(depth))


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
