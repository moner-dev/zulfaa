# -*- coding: utf-8 -*-
"""The 404 page: ONE file at the site root, because that is all GitHub Pages
serves.

HOW THE ROUTING ACTUALLY WORKS. Pages answers any unknown URL on the domain
with the contents of the root `404.html` and status 404 - and it does NOT look
for a 404.html inside a subdirectory, so `/ar/nope/` is answered by this same
file. It also leaves the browser's address bar on the unknown URL, which is the
part that breaks naive 404 pages: a relative `assets/zulfaa.css` on
`/deep/unknown/path/` resolves to `/deep/unknown/assets/zulfaa.css` and the
page arrives unstyled.

Hence `<base href="/">` in the head. Every relative URL the shared chrome
writes - the stylesheet, the emblem, the nav, the footer, the scripts - then
resolves from the site root no matter how deep the unknown URL was. The one
in-page link the footer writes, `#contact`, therefore goes to `/#contact`,
the contact block on the home page, which is where it should go.

LANGUAGE, WITHOUT A REDIRECT. The owner's rule: the visitor keeps the address
they asked for and its 404 status, and the WHOLE page speaks the language of
that address - `/ar/...` Arabic and right to left, `/nl/...` Dutch, anything
else English. One file cannot be three pages, so it carries one live page and
two inert ones:

  * the body is the complete English page, built by the same chrome.header(),
    main_open() and footer() calls as every other page. With scripting off this
    is what shows, which is the honest fallback;
  * the Arabic and Dutch pages are the same calls with `lang` changed, each
    inside a <template>. A template's content is not part of the document: its
    ids, menus and buttons do not exist until they are used, so there are never
    three headers, three drawers or duplicate ids on the page;
  * a head script (LANG_BOOT) reads the path before anything paints. For ar/nl
    it sets <html lang dir>, the title and the metadata, and hides the body;
  * an inline script after the templates (SWAP) - still during parsing, and so
    BEFORE the deferred nav.js, lantern.js and scrolldock.js - puts the chosen
    template in place of the English page, removes the templates and shows the
    body. The scripts then find exactly one header, drawer, lantern, footer and
    dock, as on any other page.

Nothing can be left blank: the swap inserts the new page before it removes the
old one, clears the hiding class in a `finally`, and the hiding rule carries a
1.5 s CSS fallback that shows the body even if no script after the boot ever
runs. With scripting off the boot never hides anything.

LIMITS, stated plainly. Without JavaScript every unknown URL gets the English
page (the `/ar/` and `/nl/` home links are in its language menu). The title and
metadata are also English to anything that does not run scripts - crawlers
included, which is harmless for a noindex page.

The language menu offers the three HOME pages: there is no localized "this
page" for an address that does not exist, and home pages cannot bounce back.

NOT INDEXED. A 404 carries `noindex, follow` and no canonical: it is a status,
not a document, and a canonical would invite a crawler to treat it as one.

THE ARTWORK. assets/notfound-*.webp carries the words PAGE NOT FOUND in English,
painted into the supplied master (assets/masters/404.png, one raster layer;
tools/notfound_art.py only resizes it). It is decorative (alt="") and is kept
as supplied - a text-free master is needed to remove the English words.
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chrome import asset, header, footer, main_open, JS_CLASS, THEME_BOOT, NAV_JS, e  # noqa: E402

# ── the words ──────────────────────────────────────────────────────────────
# Kept here beside the page that uses them, as the lantern and the scroll dock
# keep theirs. Everything AROUND the message - top bar, header, drawer, language
# menu, lantern, dock, footer - comes from those shared sources in `lang`.
# The secondary call to action points at the Articles index, which exists in
# all three languages. Links are root-absolute: the page is served at any depth.
COPY = {
    "en": {
        "dir": "ltr",
        "title": "Page not found",
        "body": "This path doesn’t seem to lead anywhere.",
        "home": "Return home",
        "more": "Read the articles",
        "at": "/", "atMore": "/articles/",
    },
    "ar": {
        "dir": "rtl",
        "title": "الصفحة غير موجودة",
        "body": "لا يبدو أن هذا المسار يؤدي إلى أي مكان.",
        "home": "العودة إلى الرئيسية",
        "more": "تصفّح المقالات",
        "at": "/ar/", "atMore": "/ar/articles/",
    },
    "nl": {
        "dir": "ltr",
        "title": "Pagina niet gevonden",
        "body": "Dit pad lijkt nergens heen te leiden.",
        "home": "Terug naar de startpagina",
        "more": "Lees de artikelen",
        "at": "/nl/", "atMore": "/nl/articles/",
    },
}

LANGS_BY_PATH = ("ar", "nl")


def page_title(lang):
    return "%s — ZULFAA" % COPY[lang]["title"]


# The hiding rule is inline so it applies before the stylesheet arrives, and it
# ends itself: after 1.5 s the body is visible whatever did or did not run.
SWAP_STYLE = ('    <style>html.nf-swap body{visibility:hidden;animation:nf-reveal 0s 1.5s forwards}'
              '@keyframes nf-reveal{to{visibility:visible}}</style>')


def lang_boot():
    """The head script: pick the language from the path, before the first paint."""
    meta = {l: {"dir": COPY[l]["dir"], "t": page_title(l), "d": COPY[l]["body"]} for l in LANGS_BY_PATH}
    data = json.dumps(meta, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return ('    <script>(function(){try{var M=%s,m=location.pathname.match(/^\\/(ar|nl)(\\/|$)/);'
            'if(!m)return;var l=m[1],c=M[l],h=document.documentElement;'
            'h.classList.add("nf-swap");h.setAttribute("data-nf",l);h.lang=l;h.dir=c.dir;document.title=c.t;'
            'var s=function(q,v){var n=document.querySelector(q);if(n)n.setAttribute("content",v)};'
            's(\'meta[name="description"]\',c.d);s(\'meta[property="og:title"]\',c.t);'
            's(\'meta[property="og:description"]\',c.d)}catch(e){}})();</script>' % data)


# Runs where it stands, during parsing: after the templates, before the deferred
# scripts. Insert first, remove second, un-hide always.
SWAP = ('    <script>(function(){var h=document.documentElement,b=document.body;try{'
        'var l=h.getAttribute("data-nf"),t=l&&document.getElementById("nf-page-"+l),'
        'first=b.querySelector("template[data-nf-page]");'
        'if(t&&first){var old=[],n=b.firstChild;while(n&&n!==first){old.push(n);n=n.nextSibling}'
        'b.insertBefore(document.importNode(t.content,true),first);'
        'for(var i=0;i<old.length;i++)b.removeChild(old[i])}'
        '}catch(e){}finally{var ts=b.querySelectorAll("template[data-nf-page]");'
        'for(var j=0;j<ts.length;j++)ts[j].parentNode.removeChild(ts[j]);'
        'h.classList.remove("nf-swap")}})();</script>')

# The artwork is decorative: the heading and the sentence below it carry the
# whole message in the reader's own language (see THE ARTWORK above).
ART = (
    '            <img\n'
    '              src="assets/notfound-842.webp"\n'
    '              srcset="assets/notfound-562.webp 562w, assets/notfound-842.webp 842w,'
    ' assets/notfound-1122.webp 1122w"\n'
    '              sizes="(min-width: 56.25rem) min(38vw, 26rem), min(74vw, 19rem)"\n'
    '              width="1122"\n'
    '              height="1402"\n'
    '              alt=""\n'
    '              decoding="async"\n'
    '              fetchpriority="high"\n'
    '            />')


def shell(lang):
    """(the visible page for `lang`, the closing scripts): header, main, footer
    and dock, exactly as chrome.py builds them for any page at depth 0."""
    c = COPY[lang]
    # page="" gives every language menu the three HOME pages; the same argument
    # would mark Home as the current nav item, which is not true here.
    chrome = header(lang, "", 0).replace(' aria-current="page"', "", 1)
    closing = footer(lang, "", 0)
    cut = closing.index(NAV_JS % "")
    body = (chrome + main_open(lang, 0)
            + '        <section class="nf" aria-labelledby="nf-title">\n'
              '          <div class="nf-art" aria-hidden="true">\n'
            + ART + '\n'
              '          </div>\n'
              '          <div class="nf-copy">\n'
              '            <h1 class="nf-title" id="nf-title">%s</h1>\n'
              '            <p class="nf-body">%s</p>\n'
              '            <div class="nf-actions">\n'
              '              <a class="btn primary" href="%s">%s</a>\n'
              '              <a class="btn" href="%s">%s</a>\n'
              '            </div>\n'
              '          </div>\n'
              '        </section>\n'
              '      </div>\n'
              '    </main>\n\n'
              % (e(c["title"]), e(c["body"]), c["at"], e(c["home"]), c["atMore"], e(c["more"]))
            + closing[:cut])
    return body, closing[cut:]


def build():
    """The English page, the Arabic and Dutch pages as templates, and the swap."""
    en_body, scripts = shell("en")
    templates = "".join(
        '    <template id="nf-page-%s" data-nf-page="%s">\n%s    </template>\n' % (l, l, shell(l)[0])
        for l in LANGS_BY_PATH)
    return f"""<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- Every relative URL below resolves from the site root, because Pages
         serves this file at whatever unknown address was asked for. -->
    <base href="/" />
    <title>{e(page_title("en"))}</title>
    <meta name="description" content="{e(COPY["en"]["body"])}" />
    <meta name="robots" content="noindex, follow" />
    <link rel="icon" type="image/png" href="assets/favicon-64.png" />
    <link rel="apple-touch-icon" href="assets/apple-touch-icon.png" />
    <link rel="stylesheet" href="{asset("assets/zulfaa.css")}" />
{JS_CLASS}
{THEME_BOOT}
    <meta name="theme-color" content="#fef9f0" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="ZULFAA" />
    <meta property="og:title" content="{e(page_title("en"))}" />
    <meta property="og:description" content="{e(COPY["en"]["body"])}" />
{SWAP_STYLE}
{lang_boot()}
  </head>
  <body>
{en_body}{templates}{SWAP}
{scripts}"""
