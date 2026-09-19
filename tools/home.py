# -*- coding: utf-8 -*-
"""The localised landing page, carousel and lightbox included."""
import os, sys, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chrome import (S, LANGS, C, SHOTS, CAPS, ALT, MAIL, DEV, e, head, header, footer, up, asset,
                        main_open)
from quick_access import render as quick_access
from articles import render_journal
from lower import render_trust, render_contact

# The screenshot carousel and its preview are rendered by tools/showcase.py,
# shared with the English original (tools/write_en.py). THUMB_W and BASE_RATIO
# live there too.
from showcase import render_showcase, render_lightbox, THUMB_W, BASE_RATIO  # noqa: E402,F401
from salah import render_salah  # noqa: E402


# ── the hero phone ────────────────────────────────────────────────────────
# A 3D device rendered by assets/hero3d.js on a transparent canvas. The two
# stills are the same scene captured from that renderer (tools/hero3d/
# capture_stills.mjs), so the static page, the no-WebGL page and the first
# live frame are one picture. Each language gets its OWN screenshots: the
# Arabic phone shows the Arabic app, never the English one.
STILL_W, STILL_H = 704, 1408
STILL_SIZES = (352, 704, 1056)  # 1x, 2x, 3x of the 22rem box
STILL_SIZES_ATTR = "(max-width: 56.25rem) min(18rem, 76vw), 22rem"

PAUSE_SVG = ('<svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
             '<rect x="6.5" y="5" width="3.6" height="14" rx="1.2"/>'
             '<rect x="13.9" y="5" width="3.6" height="14" rx="1.2"/></svg>')
PLAY_SVG = ('<svg class="icon-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
            '<path d="M8 5.6v12.8c0 .8.9 1.3 1.6.9l10-6.4a1 1 0 0 0 0-1.8l-10-6.4C8.9 4.3 8 4.8 8 5.6Z"/></svg>')


def still(lang, a, theme, extra):
    srcset = ", ".join("%sassets/hero3d/still-%s-%s-%d.webp %dw" % (a, lang, theme, w, w) for w in STILL_SIZES)
    return f"""                <img
                  class="phone3d-still still-{theme}"
                  src="{a}assets/hero3d/still-{lang}-{theme}-{STILL_W}.webp"
                  srcset="{srcset}"
                  sizes="{STILL_SIZES_ATTR}"
                  alt=""
                  width="{STILL_W}"
                  height="{STILL_H}"
                  decoding="async"{extra}
                />"""


DRAG_SVG = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            '<path d="M7 8 3 12l4 4M17 8l4 4-4 4M3 12h18"/></svg>')


def hero_phone(lang, a, alt, hint):
    # data-stage="loading" only matters with scripting on (html.js): the
    # stylesheet then waits for the live phone or, failing that, the still
    return f"""              <div
                class="phone3d"
                role="img"
                aria-label="{html.escape(alt)}"
                data-theme="light"
                data-stage="loading"
                data-model="{a}assets/hero3d/zulfaa-phone.glb"
                data-screen-light="{a}assets/hero3d/screen-{lang}-light.webp"
                data-screen-dark="{a}assets/hero3d/screen-{lang}-dark.webp"
              >
{still(lang, a, "light", chr(10) + '                  fetchpriority="high"')}
{still(lang, a, "dark", "")}
                <p class="drag-hint" aria-hidden="true" hidden>{DRAG_SVG}<span>{e(hint)}</span></p>
              </div>"""


def motion_button(label):
    # pauses the recurring turn; hidden until the live phone can move
    return ('                <button class="motion-toggle" type="button" aria-pressed="false" title="%s" hidden>\n'
            '                  %s\n                  %s\n'
            '                  <span class="vh">%s</span>\n'
            '                </button>' % (html.escape(label), PAUSE_SVG, PLAY_SVG, e(label)))


def status_region(shown_dark, shown_light):
    # announced after a theme change the visitor asked for (never on the timer)
    return ('              <p class="vh" aria-live="polite" data-hero3d-status data-dark="%s" data-light="%s"></p>'
            % (html.escape(shown_dark), html.escape(shown_light)))


def build_home(lang):
    p, d = "", 1
    s, prod, n = S[lang], C[lang]["product"], C[lang]["nav"]
    a = up(d)
    return (head(lang, p, d, s["homeTitle"], s["homeDesc"]) + header(lang, p, d)
            + main_open(lang, d) + f"""        <div class="hero-wrap">
          <section class="hero">
            <div class="hero-copy">
              <p class="wordmark-ar" lang="ar">زُلْفَى</p>
              <h1>{e(s['heroTitle'])}</h1>
              <p class="tagline">{e(s['heroLead'])}</p>
              <div class="hero-actions">
                <a class="btn primary" href="mailto:{MAIL}?subject=ZULFAA">{e(s['ctaNotify'])}</a>
                <a class="btn" href="#showcase-title">{e(s['ctaInside'])}</a>
              </div>
              <p class="hero-trust">{e(s['heroTrust'])}</p>
            </div>
            <div class="hero-stage">
{hero_phone(lang, a, s['shotAlt'], s['dragHint'])}
              <div class="hero-controls">
                <button class="theme-demo" type="button" aria-pressed="false">
                  <span class="knob" aria-hidden="true"></span>
                  <span class="vh">{e(s['themeLabel'])}</span>
                  <span class="label-day" aria-hidden="true">{e(s['dayLabel'])}</span>
                  <span class="label-night" aria-hidden="true">{e(s['nightLabel'])}</span>
                </button>
{motion_button(s['motionPause'])}
              </div>
{status_region(s['shownDark'], s['shownLight'])}
            </div>
          </section>
        </div>

        <hr class="rule" />

        <p class="lede">{e(s['lede'])}</p>

{quick_access(lang, a)}

      </div>

{render_showcase(lang, a)}
{render_salah(lang, a)}
{render_journal(lang, a)}

{render_trust(lang, a)}

{render_contact(lang, a)}
    </main>

{render_lightbox(lang)}    <script src="{a}{asset("assets/quick-access.js")}" defer></script>
    <script src="{a}{asset("assets/carousel.js")}" defer></script>
    <script src="{a}{asset("assets/contact-config.js")}" defer></script>
    <script src="{a}{asset("assets/contact.js")}" defer></script>
    <script type="module" src="{a}{asset("assets/hero3d.js")}"></script>
""" + footer(lang, p, d))
