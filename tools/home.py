# -*- coding: utf-8 -*-
"""The localised landing page, carousel and lightbox included."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chrome import (S, LANGS, C, SHOTS, CAPS, ALT, MAIL, DEV, e, head, header, footer, up, asset)

GLYPHS = [
 '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />',
 '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M19 18v3H6.5A2.5 2.5 0 0 1 4 18.5" />',
 '<path d="M12 21s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10Z" />',
 '<circle cx="12" cy="12" r="9" /><path d="M15.5 8.5 13.6 13.6 8.5 15.5l1.9-5.1Z" />',
 '<path d="M18 8A6 6 0 0 0 6 8c0 6-2.5 7-2.5 7h17S18 14 18 8Z" /><path d="M10.5 20a2 2 0 0 0 3 0" />',
 '<path d="M8 4h8v4a4 4 0 0 1-8 0Z" /><path d="M16 5h3v2a3 3 0 0 1-3 3M8 5H5v2a3 3 0 0 0 3 3" /><path d="M12 12v4M9 20h6" />',
]
SVG = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
       'stroke-linecap="round" stroke-linejoin="round">%s</svg>')
MAG = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
       'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
       '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M10.5 7.5v6M7.5 10.5h6M15.5 15.5 21 21"/></svg>')
ARR_L = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>')
ARR_R = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>')
X = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
     'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>')


# The showcase images are the Store artwork as supplied: full-bleed posters and
# phone mockups on a transparent ground. Every slide shares one height; `--k` is
# the slide's width relative to the common 941x1672 proportion, so a wider or
# narrower image keeps its own shape instead of being cropped or letterboxed.
BASE_RATIO = 941 / 1672
THUMB_W = 640


def shot_k(sh):
    return "%.4f" % ((sh["w"] / sh["h"]) / BASE_RATIO)


def shot_class(sh):
    return "shot shot--device" if sh.get("device") else "shot"


def shot_src(a, sh):
    return "%sassets/showcase/%s.webp" % (a, sh["file"])


def shot_srcset(a, sh):
    return "%sassets/showcase/%s-%d.webp %dw, %sassets/showcase/%s.webp %dw" % (
        a, sh["file"], THUMB_W, THUMB_W, a, sh["file"], sh["w"])


def shot_sizes(sh):
    k = (sh["w"] / sh["h"]) / BASE_RATIO
    # the row width is clamp(11.5rem, 56vw, 16rem) x k; 16rem meets 56vw at 457px
    return "(max-width: 457px) %.0fvw, %.1frem" % (56 * k, 16 * k)


def build_home(lang):
    p, d = "", 1
    s, prod, n = S[lang], C[lang]["product"], C[lang]["nav"]
    a = up(d)
    N = len(SHOTS)

    cards = "".join(
        '            <article class="card%s">\n'
        '              <span class="glyph" aria-hidden="true">%s</span>\n'
        '              <h3>%s</h3>\n              <p>%s</p>\n            </article>\n\n'
        % (" gold" if i == 5 else "", SVG % GLYPHS[i], t, b)
        for i, (t, b) in enumerate(s["cards"]))

    slides = ""
    for i, sh in enumerate(SHOTS):
        cap = CAPS[lang][i]
        slides += (
            '          <li\n            class="%s"\n            style="--k: %s"\n            role="group"\n'
            '            aria-roledescription="slide"\n            aria-label="%d / %d: %s"\n'
            '            data-cap="%s"\n          >\n'
            '            <div class="shot-frame">\n'
            '              <img\n                src="%s"\n                srcset="%s"\n                sizes="%s"\n'
            '                width="%d"\n                height="%d"\n                alt="%s"\n'
            '                loading="%s"\n                decoding="async"%s\n              />\n'
            '              <button\n                class="shot-zoom"\n                type="button"\n'
            '                data-zoom="%d"\n                aria-label="%s"\n              >%s</button>\n'
            '            </div>\n            <p class="shot-cap">%s</p>\n          </li>\n'
            % (shot_class(sh), shot_k(sh), i + 1, N, e(cap), e(cap), shot_src(a, sh), shot_srcset(a, sh),
               shot_sizes(sh), sh["w"], sh["h"], e(ALT[lang] % cap),
               "eager" if i < 3 else "lazy", ' fetchpriority="high"' if i == 0 else "",
               i, e(s["zoomLabel"] % cap), MAG, e(cap)))

    return (head(lang, p, d, s["homeTitle"], s["homeDesc"]) + header(lang, p, d) + f"""    <main>
      <div class="shell">
        <section class="hero">
          <img class="hero-emblem" src="{a}assets/emblem-768.webp" alt="ZULFAA" width="768" height="768" />
          <p class="wordmark-ar" lang="ar" dir="rtl">زُلْفَى</p>
          <h1>Zulfaa</h1>
          <p class="tagline">{e(prod['tagline'])}</p>
          <p class="pill">{e(s['pill'])}</p>
        </section>

        <hr class="rule" />

        <p class="lede">{e(s['lede'])}</p>

        <section class="band" aria-labelledby="features">
          <h2 class="section-title" id="features">{e(s['featTitle'])}</h2>
          <p class="section-note">{e(s['featNote'])}</p>
          <div class="grid">
{cards}          </div>
        </section>

      </div>

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
          </div>

          <button class="car-arrow car-next" type="button" aria-label="{e(s['nextShot'])}" aria-controls="shot-scroller">
            {ARR_R}
          </button>

          <p class="car-status" aria-live="polite">
            <b data-car-index>01</b> / <span data-car-total>{N:02d}</span> &middot; <span data-car-cap>{e(CAPS[lang][0])}</span>
          </p>
          <p class="car-hint">{e(s['hint'])}</p>
        </div>
      </section>

      <div class="shell">
        <section class="band" aria-labelledby="privacy-first">
          <h2 class="section-title" id="privacy-first">{e(s['localTitle'])}</h2>
          <p class="section-note">{e(s['localNote'])}</p>
          <div class="linkrow">
            <a class="btn primary" href="privacy/">{e(s['readPrivacy'])}</a>
            <a class="btn" href="terms/">{e(n['terms'])}</a>
            <a class="btn" href="delete-data/">{e(s['deleteNav'])}</a>
            <a class="btn" href="support/">{e(n['support'])}</a>
          </div>
        </section>

        <section class="band" aria-labelledby="availability">
          <h2 class="section-title" id="availability">{e(s['availTitle'])}</h2>
          <p class="section-note">{e(s['availNote'])}</p>
        </section>
      </div>
    </main>

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
            <img class="lb-img" alt="" width="941" height="1672" decoding="async" />
            <figcaption class="lb-cap">
              <b data-lb-index>01</b> / <span data-lb-total>{N:02d}</span> &middot; <span data-lb-name></span>
            </figcaption>
          </figure>
        </div>

        <button class="lb-btn lb-next" type="button" aria-label="{e(s['nextShot'])}">
          {ARR_R}
        </button>
      </div>
    </div>
    <script src="{a}{asset("assets/carousel.js")}" defer></script>
""" + footer(lang, p, d))
