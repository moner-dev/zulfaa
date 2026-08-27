# -*- coding: utf-8 -*-
"""Generates the /ar/ and /nl/ subtrees of the ZULFAA website.

English lives at the root and is NOT generated - those pages are the approved,
Play-facing originals and are only ever touched to add the language switcher.
Arabic and Dutch legal text comes from the app (content.json); only the
navigation and marketing copy is authored here.
"""
import json, os, re, sys, html

SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCR)
from ui_strings import S, LANGS, DEIXIS          # noqa: E402
from dd_strings import DD                        # noqa: E402

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = json.load(open(os.path.join(SCR, "content.json"), encoding="utf-8"))
SHOTS = json.load(open(os.path.join(SCR, "shots.json"), encoding="utf-8"))
ORIGIN = "https://moner-dev.github.io/zulfaa/"
MAIL = "moner.intelligence@gmail.com"
DEV = "MONER INTELLIGENCE SYSTEMS"

CAPS = {
 "ar": ["الرئيسية","أوقات الصلاة","القبلة","القرآن الكريم","القرّاء","الأذكار","الأدعية",
        "تحدّي اليوم","التذكيرات","إعدادات الصلاة","مساحتك","القائمة","عن زُلْفَى","الافتتاحية"],
 "nl": ["Start","Gebedstijden","Qibla","De Nobele Koran","Reciteurs","Adhkar","Doe'a",
        "Dagelijkse uitdaging","Herinneringen","Gebedsinstellingen","Uw ruimte","Navigatie",
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
    <link rel="stylesheet" href="{a}assets/zulfaa.css" />
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


def langswitch(lang, page, depth):
    """Plain links - the switcher must work with scripting off."""
    a = up(depth)
    out = ['      <nav class="lang-switch" aria-label="%s">' % e(S[lang]["langLabel"] if lang != "en" else "Language")]
    for l in ("en", "ar", "nl"):
        href = (a + LANGS[l]["base"] + page) or "./"
        cur = ' aria-current="true"' if l == lang else ""
        out.append('        <a href="%s" lang="%s" hreflang="%s"%s>%s</a>' % (href, l, l, cur, e(LANGS[l]["name"])))
    out.append("      </nav>")
    return "\n".join(out)


def header(lang, page, depth):
    a = up(depth)
    s = S[lang]
    n = C[lang]["nav"]
    items = [("", s["home"]), ("privacy/", n["privacy"]), ("terms/", n["terms"]),
             ("delete-data/", s["deleteNav"]), ("support/", n["support"])]
    links = []
    for href, label in items:
        target = a + LANGS[lang]["base"] + href
        cur = ' aria-current="page"' if href == page else ""
        links.append('          <a href="%s"%s>%s</a>' % (target, cur, e(label)))
    return f"""    <header class="site-head">
      <div class="shell">
        <a class="brand" href="{a}{LANGS[lang]['base']}">
          <img src="{a}assets/emblem-256.webp" alt="" width="256" height="256" />
          <span class="brand-name">Zulfaa</span>
        </a>
        <nav class="site-nav" aria-label="{e(s['navLabel'])}">
{chr(10).join(links)}
        </nav>
{langswitch(lang, page, depth)}
      </div>
    </header>

"""


def footer(lang, page, depth):
    a = up(depth)
    s = S[lang]
    n = C[lang]["nav"]
    items = [("", s["home"]), ("privacy/", n["privacy"]), ("terms/", n["terms"]),
             ("delete-data/", s["deleteNav"]), ("support/", n["support"])]
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
    full = os.path.join(SITE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, "w", encoding="utf-8", newline="").write(text)
    return path
