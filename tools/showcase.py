# -*- coding: utf-8 -*-
"""The homepage screenshot carousel and its preview, in all three languages.

ONE SOURCE FOR THREE PAGES. home.py renders this into /ar/ and /nl/; the
hand-written English index.html receives the very same markup through
tools/write_en.py, which replaces only the marked regions
(<!-- showcase:start/end --> and <!-- lightbox:start/end -->).

WHICH SCREENSHOTS. tools/shots.json is the list and the order (English caption
and alt text there; Arabic and Dutch captions in chrome.CAPS, same order).
Every entry exists in six variants - its language x light/dark - written by
tools/showcase_art.py from the classified masters:

    assets/showcase/<screen>-<lang>-<theme>.webp        full size (the preview)
    assets/showcase/<screen>-<lang>-<theme>-640.webp    the slide

A page only ever shows ITS language. There is no substitution: the build stops
if a variant is missing.

THE THEME IS THE SITE'S. No carousel preference exists. The site theme is
`data-site-theme` on <html>, set before first paint by chrome.THEME_BOOT from
the visitor's saved choice and changed by the lantern. So:

  * the markup carries the LIGHT images (what a visitor without scripting, or
    with no saved choice, sees) and both themes' URLs as data attributes;
  * SHOWCASE_BOOT, inline right after the slides, switches them to the dark
    set while the page is still parsing when dark is already the theme. Every
    slide is loading="lazy" and the section is below the fold, so a visitor
    in dark mode does not download the light set first;
  * assets/lantern.js follows the theme from then on (a MutationObserver on
    the attribute the lantern changes, for every themed image on any page),
    and the preview in assets/carousel.js reads the current theme's full-size
    file whenever it shows an image.

Dark screenshots are the app's own dark screens - never a CSS filter.
"""
import html, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chrome import S, SHOTS, CAPS, ALT, e, themed_img_boot  # noqa: E402

THUMB_W = 640
THEMES = ("light", "dark")
# The common proportion of the screenshots (945x2055). --shot-w in the
# stylesheet is a slide's width in this proportion; --k scales any other shape
# so that every slide in the row shares one height.
BASE_RATIO = 945 / 2055
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MAG = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
       'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
       '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M10.5 7.5v6M7.5 10.5h6M15.5 15.5 21 21"/></svg>')
ARR_L = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>')
ARR_R = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>')
X = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
     'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>')

# Runs where it stands, during parsing, before any lazy slide can be fetched.
SHOWCASE_BOOT = themed_img_boot("            ")

for _l in ("ar", "nl"):
    assert len(CAPS[_l]) == len(SHOTS), "chrome.CAPS[%r] has %d captions for %d screenshots" % (_l, len(CAPS[_l]), len(SHOTS))


def caption(lang, i):
    return SHOTS[i]["caption"] if lang == "en" else CAPS[lang][i]


def alt(lang, i):
    return SHOTS[i]["alt"] if lang == "en" else ALT[lang] % caption(lang, i)


def files(a, sh, lang, theme):
    """(full, srcset) for one variant; refuses a variant that does not exist."""
    base = "assets/showcase/%s-%s-%s" % (sh["file"], lang, theme)
    for rel in (base + ".webp", "%s-%d.webp" % (base, THUMB_W)):
        if not os.path.exists(os.path.join(SITE, rel)):
            raise SystemExit("missing %s - run python tools/showcase_art.py (no substitution is made)" % rel)
    full = a + base + ".webp"
    return full, "%s%s-%d.webp %dw, %s %dw" % (a, base, THUMB_W, THUMB_W, full, sh["w"])


def k(sh):
    return (sh["w"] / sh["h"]) / BASE_RATIO


def sizes(sh):
    # the row width is clamp(11.5rem, 56vw, 16rem) x k; 16rem meets 56vw at 457px
    return "(max-width: 457px) %.0fvw, %.1frem" % (56 * k(sh), 16 * k(sh))


def slide(lang, a, i):
    sh, s, n = SHOTS[i], S[lang], len(SHOTS)
    cap = caption(lang, i)
    light, light_set = files(a, sh, lang, "light")
    dark, dark_set = files(a, sh, lang, "dark")
    return (
        '          <li\n'
        '            class="shot"\n'
        '            style="--k: %.4f"\n'
        '            role="group"\n'
        '            aria-roledescription="slide"\n'
        '            aria-label="%d / %d: %s"\n'
        '            data-cap="%s"\n'
        '            data-screen="%s"\n'
        '          >\n'
        '            <div class="shot-frame">\n'
        '              <img\n'
        '                src="%s"\n'
        '                srcset="%s"\n'
        '                sizes="%s"\n'
        '                width="%d"\n'
        '                height="%d"\n'
        '                alt="%s"\n'
        '                loading="lazy"\n'
        '                decoding="async"\n'
        '                data-src-light="%s"\n'
        '                data-srcset-light="%s"\n'
        '                data-src-dark="%s"\n'
        '                data-srcset-dark="%s"\n'
        '              />\n'
        '              <button\n'
        '                class="shot-zoom"\n'
        '                type="button"\n'
        '                data-zoom="%d"\n'
        '                aria-label="%s"\n'
        '              >%s</button>\n'
        '            </div>\n'
        '            <p class="shot-cap">%s</p>\n'
        '          </li>\n'
        % (k(sh), i + 1, n, e(cap), html.escape(cap), sh["file"],
           light, light_set, sizes(sh), sh["w"], sh["h"], html.escape(alt(lang, i)),
           light, light_set, dark, dark_set,
           i, html.escape(s["zoomLabel"] % cap), MAG, e(cap)))


def render_showcase(lang, a=""):
    s = S[lang]
    n = len(SHOTS)
    slides = "".join(slide(lang, a, i) for i in range(n))
    return f"""      <!-- showcase:start -->
      <section class="showcase" aria-labelledby="showcase-title">
        <div class="shell">
          <p class="showcase-eyebrow">{e(s['showEyebrow'])}</p>
          <h2 id="showcase-title">{e(s['showTitle'])}</h2>
          <p class="showcase-note">{e(s['showNote'])}</p>
        </div>

        <div class="carousel" data-carousel>
          <button class="car-arrow car-prev" type="button" aria-label="{e(s['prevShot'])}" aria-controls="shot-scroller">
            {ARR_L}
          </button>

          <div
            class="car-viewport"
            id="shot-scroller"
            tabindex="0"
            role="region"
            aria-roledescription="carousel"
            aria-label="{e(s['shotsLabel'])}"
          >
            <ul class="car-track">
{slides}            </ul>
{SHOWCASE_BOOT}          </div>

          <button class="car-arrow car-next" type="button" aria-label="{e(s['nextShot'])}" aria-controls="shot-scroller">
            {ARR_R}
          </button>

          <p class="car-status" aria-live="polite">
            <b data-car-index>01</b> / <span data-car-total>{n:02d}</span> &middot; <span data-car-cap>{e(caption(lang, 0))}</span>
          </p>
          <p class="car-hint">{e(s['hint'])}</p>
        </div>
      </section>
      <!-- showcase:end -->
"""


def render_lightbox(lang):
    s = S[lang]
    n = len(SHOTS)
    return f"""    <!-- lightbox:start -->
    <div class="lb" id="lb" hidden>
      <div class="lb-backdrop" data-lb-close></div>
      <div class="lb-dialog" role="dialog" aria-modal="true" aria-labelledby="lb-title">
        <h2 class="lb-sr" id="lb-title">{e(s['lbTitle'])}</h2>

        <button class="lb-btn lb-close" type="button" aria-label="{e(s['lbClose'])}" data-lb-close>
          {X}
        </button>

        <button class="lb-btn lb-prev" type="button" aria-label="{e(s['prevShot'])}">
          {ARR_L}
        </button>

        <div class="lb-stage" data-lb-close>
          <figure class="lb-figure">
            <img class="lb-img" alt="" width="{SHOTS[0]['w']}" height="{SHOTS[0]['h']}" decoding="async" />
            <figcaption class="lb-cap">
              <b data-lb-index>01</b> / <span data-lb-total>{n:02d}</span> &middot; <span data-lb-name></span>
            </figcaption>
          </figure>
        </div>

        <button class="lb-btn lb-next" type="button" aria-label="{e(s['nextShot'])}">
          {ARR_R}
        </button>
      </div>
    </div>
    <!-- lightbox:end -->
"""
