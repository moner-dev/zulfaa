# -*- coding: utf-8 -*-
"""The 403 page: /403/, /ar/403/ and /nl/403/.

WHAT IT IS FOR. "This page exists, but you may not open it" - not a missing
page (that is the 404) and not a broken server (that is maintenance). The tone
follows from that: calm, no blame, and a way forward.

WHAT THIS HOST CAN AND CANNOT DO. GitHub Pages has no access control and never
answers 403 by itself, so these are ordinary pages served as HTTP 200 - the
same honest position as /maintenance/. They exist so that anything which DOES
restrict access later (a CDN rule, a proxy, a gated preview) has a finished,
on-brand page in each language to send a visitor to.

THREE PAGES, NOT ONE FILE. The 404 has to be a single root file because that is
all Pages serves for an unknown URL, so its chrome is English and only its
message is localised. A 403 has no such limit: it is reached by a real
address, so each language gets its own full page - Arabic chrome and all, laid
out right to left - exactly as the maintenance page does.

THE SHELL AND THE COMPOSITION ARE THE 404'S. Top Bar, header, lantern and
footer come from chrome.py; the layout is the 404's own `.nf` system in
assets/zulfaa.css (artwork leading, words beside it, the same breakpoints, the
dock kept away, the warm air behind the sticker at night). The sticker's
transparent margins match the 404's, so nothing had to be retuned - see
tools/forbidden_art.py. The one CSS rule that is the 403's alone tints that air
toward the artwork's crimson.

NOT INDEXED. `noindex, follow`, no canonical, absent from the sitemap.
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ── the words ──────────────────────────────────────────────────────────────
# Beside the page that uses them, as the 404 and the maintenance page keep
# theirs. The secondary action is Support rather than "Go back": a visitor who
# was sent here usually arrived from somewhere they cannot return to usefully,
# and the one person who can actually change a "no" is a human being. Support
# exists in all three languages.
COPY = {
    "en": {
        "title": "This page is private",
        "body": "The page is here, but it isn’t open to visitors. If you think you should have access, we’re happy to help.",
        "home": "Return home",
        "more": "Contact support",
    },
    "ar": {
        "title": "هذه الصفحة خاصة",
        "body": "الصفحة موجودة، لكنها غير متاحة للزوار. إن كنت ترى أنه ينبغي أن يُتاح لك الوصول إليها، فيسعدنا أن نساعدك.",
        "home": "العودة إلى الرئيسية",
        "more": "تواصل مع الدعم",
    },
    "nl": {
        "title": "Deze pagina is niet openbaar",
        "body": "De pagina bestaat, maar is niet toegankelijk voor bezoekers. Denkt u dat u wel toegang zou moeten hebben? We helpen u graag.",
        "home": "Terug naar de startpagina",
        "more": "Neem contact op",
    },
}

PAGE = "403/"


def build(lang):
    from chrome import LANGS, JS_CLASS, THEME_BOOT, asset, e, up, header, footer, main_open

    c = COPY[lang]
    depth = 1 if lang == "en" else 2
    a = up(depth)
    base = a + LANGS[lang]["base"]
    home = base or "./"

    # page="403/" makes every language menu offer THIS page in the other
    # languages and marks no nav item as current, which is the truth here.
    chrome = header(lang, PAGE, depth)

    return f"""<!doctype html>
<html lang="{lang}" dir="{LANGS[lang]['dir']}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{e(c['title'])} — ZULFAA</title>
    <meta name="description" content="{e(c['body'])}" />
    <meta name="robots" content="noindex, follow" />
    <link rel="icon" type="image/png" href="{a}assets/favicon-64.png" />
    <link rel="apple-touch-icon" href="{a}assets/apple-touch-icon.png" />
    <link rel="stylesheet" href="{a}{asset("assets/zulfaa.css")}" />
{JS_CLASS}
{THEME_BOOT}
    <meta name="theme-color" content="#fef9f0" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="ZULFAA" />
    <meta property="og:title" content="{e(c['title'])} — ZULFAA" />
  </head>
  <body>
{chrome}{main_open(lang, depth)}        <section class="nf nf-403" aria-labelledby="nf-title">
          <div class="nf-art" aria-hidden="true">
            <img
              src="{a}assets/forbidden-842.webp"
              srcset="{a}assets/forbidden-562.webp 562w, {a}assets/forbidden-842.webp 842w, {a}assets/forbidden-1122.webp 1122w"
              sizes="(min-width: 56.25rem) min(38vw, 26rem), min(74vw, 19rem)"
              width="1122"
              height="1402"
              alt=""
              decoding="async"
              fetchpriority="high"
            />
          </div>
          <div class="nf-copy">
            <h1 class="nf-title" id="nf-title">{e(c['title'])}</h1>
            <p class="nf-body">{e(c['body'])}</p>
            <div class="nf-actions">
              <a class="btn primary" href="{home}">{e(c['home'])}</a>
              <a class="btn" href="{base}support/">{e(c['more'])}</a>
            </div>
          </div>
        </section>
      </div>
    </main>

{footer(lang, PAGE, depth)}"""


def apply():
    from chrome import LANGS, write
    return [write(os.path.join(LANGS[l]["base"], "403", "index.html").replace("\\", "/"), build(l))
            for l in ("en", "ar", "nl")]


if __name__ == "__main__":
    for w in apply():
        print("  " + w)
