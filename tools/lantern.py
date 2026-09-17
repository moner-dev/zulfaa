# -*- coding: utf-8 -*-
"""The hanging lantern: the site's light/dark control, on the home page.

WHAT IT IS. One <button> containing an inline SVG lantern and three glow
layers. Inline rather than an <img> so the stylesheet can light the glass,
sway the body and ignite the core without a second request; SVG rather than a
bitmap so it stays sharp and weighs almost nothing.

WHAT IT IS NOT. It does not touch the hero phone's own day/night button.
That control belongs to assets/hero3d.js (and the fallback at the foot of
assets/nav.js), keeps `zulfaa-hero-theme` in sessionStorage and sets
`data-theme` on the phone element. The site theme is a different thing with a
different name in different storage: `data-site-theme` on <html>, saved under
`zulfaa-site-theme` in localStorage. Neither can see the other.

STRUCTURE, top to bottom - each part is its own element so it can be lit or
moved on its own: the hook and chain, the cap, the frame with its glass
panels and ribs, the flame core, the finial, and outside the SVG three glow
layers (core bloom, halo, and the spill that washes the page behind it)."""
import html, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

UI = {
    "en": {"toLight": "Switch to light mode", "toDark": "Switch to dark mode",
           "tipLight": "Light mode", "tipDark": "Dark mode"},
    "ar": {"toLight": "التبديل إلى الوضع الفاتح", "toDark": "التبديل إلى الوضع الداكن",
           "tipLight": "الوضع الفاتح", "tipDark": "الوضع الداكن"},
    "nl": {"toLight": "Overschakelen naar lichte modus", "toDark": "Overschakelen naar donkere modus",
           "tipLight": "Lichte modus", "tipDark": "Donkere modus"},
}


def esc(s):
    return html.escape(s, quote=True)


# The drawing. 140 wide, 340 tall. The first attempt was too narrow and too
# straight and read as a canister; this one has a lantern's proportions - a
# shouldered dome, a wider waisted body held in a brass frame, and a splayed
# base - and the parts are large enough to survive being drawn at 5rem.
SVG = """<svg class="ln-svg" viewBox="0 0 140 340" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="ln-metal" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#0e241f" />
                  <stop offset="28%" stop-color="#2d564c" />
                  <stop offset="47%" stop-color="#7f9d91" />
                  <stop offset="58%" stop-color="#456d61" />
                  <stop offset="78%" stop-color="#1c3b34" />
                  <stop offset="100%" stop-color="#0b1d19" />
                </linearGradient>
                <linearGradient id="ln-brass" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#6d5119" />
                  <stop offset="22%" stop-color="#c79a35" />
                  <stop offset="44%" stop-color="#f6e2a6" />
                  <stop offset="62%" stop-color="#d7a93c" />
                  <stop offset="84%" stop-color="#8a681f" />
                  <stop offset="100%" stop-color="#5c4514" />
                </linearGradient>
                <!-- The glass panel is painted OVER the dark metal frame, so a
                     low alpha here does not show the cream page through it - it
                     shows the frame, which is why the unlit lantern used to read
                     as a solid olive canister. It is pale and nearly opaque
                     instead, and the flame is drawn after it. Dark mode replaces
                     this fill outright, in the stylesheet. (Do not name a real
                     asset path in this comment: the build rewrites every one it
                     finds into a versioned URL, and write_en puts the pristine
                     text back, so the two would rewrite each other for ever.) -->
                <linearGradient id="ln-glass" x1="0.1" y1="0" x2="0.9" y2="1">
                  <stop offset="0%" stop-color="#f7fbf8" stop-opacity="0.92" />
                  <stop offset="38%" stop-color="#dcebe2" stop-opacity="0.8" />
                  <stop offset="100%" stop-color="#9fbdae" stop-opacity="0.72" />
                </linearGradient>
                <radialGradient id="ln-core" cx="0.5" cy="0.58" r="0.52">
                  <stop offset="0%" stop-color="#fff8e8" />
                  <stop offset="30%" stop-color="#ffe0a0" />
                  <stop offset="64%" stop-color="#eeb44e" stop-opacity="0.45" />
                  <stop offset="100%" stop-color="#e09a2c" stop-opacity="0" />
                </radialGradient>
                <linearGradient id="ln-sheen" x1="0" y1="0" x2="1" y2="0.6">
                  <stop offset="0%" stop-color="#ffffff" stop-opacity="0.40" />
                  <stop offset="55%" stop-color="#ffffff" stop-opacity="0.08" />
                  <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
                </linearGradient>
              </defs>

              <!-- the ceiling hook: fixed, the sway happens under it -->
              <path class="ln-hook" d="M70 3v7" />
              <circle class="ln-hook-ring" cx="70" cy="14" r="4" />

              <g class="ln-swing">
                <!-- chain: interlocking links, alternating so it reads as chain -->
                <g class="ln-chain">
                  <ellipse cx="70" cy="26" rx="3.4" ry="5.4" />
                  <ellipse cx="70" cy="36" rx="2.2" ry="5.4" />
                  <ellipse cx="70" cy="46" rx="3.4" ry="5.4" />
                  <ellipse cx="70" cy="56" rx="2.2" ry="5.4" />
                  <ellipse cx="70" cy="66" rx="3.4" ry="5.4" />
                  <ellipse cx="70" cy="76" rx="2.2" ry="5.4" />
                </g>

                <!-- crown: a small finial, then the shouldered dome -->
                <path class="ln-brass-fill" d="M70 82c1.6 0 2.6 1 2.6 2.4S71.6 87 70 87s-2.6-1-2.6-2.6S68.4 82 70 82Z" />
                <path class="ln-cap-top" d="M70 88c10 5 17 12.5 20 21H50c3-8.5 10-16 20-21Z" />
                <path class="ln-cap-sheen" d="M70 88c-5.5 2.8-10 6.8-13 11.4 3.6-2.6 8-4.4 13-5.2Z" />
                <rect class="ln-brass" x="46" y="109" width="48" height="7" rx="3" />

                <!-- the body: glass held between two brass rings, four uprights -->
                <path class="ln-frame" d="M48 116h44l6 84a8 8 0 0 1-8 9H50a8 8 0 0 1-8-9Z" />
                <path class="ln-glass" d="M52 120h36l5 76a5 5 0 0 1-5 5.5H52a5 5 0 0 1-5-5.5Z" />
                <g class="ln-rib">
                  <path d="M49 118 54 202" />
                  <path d="M91 118 86 202" />
                  <path d="M63 118v84" />
                  <path d="M77 118v84" />
                </g>
                <path class="ln-sheen" d="M56 123h7l-2.5 72h-7Z" />

                <!-- the flame: small, sitting on its burner, inside a lit volume -->
                <ellipse class="ln-core" cx="70" cy="168" rx="26" ry="38" />
                <path class="ln-flame" d="M70 146c4.6 7.2 7 11.4 7 15.4a7 7 0 0 1-14 0c0-4 2.4-8.2 7-15.4Z" />
                <path class="ln-flame-inner" d="M70 155c2 3.2 3 5.2 3 7a3 3 0 0 1-6 0c0-1.8 1-3.8 3-7Z" />
                <rect class="ln-burner" x="64" y="176" width="12" height="4.5" rx="1.6" />

                <!-- base: brass ring, a perforated band, splayed foot, drop finial -->
                <rect class="ln-brass" x="42" y="203" width="56" height="8" rx="3" />
                <path class="ln-cap" d="M46 211h48l-7 15H53Z" />
                <g class="ln-perf">
                  <path d="M58 214.5 61.5 218 58 221.5 54.5 218Z" />
                  <path d="M70 214.5 73.5 218 70 221.5 66.5 218Z" />
                  <path d="M82 214.5 85.5 218 82 221.5 78.5 218Z" />
                </g>
                <rect class="ln-brass" x="56" y="226" width="28" height="5" rx="2" />
                <path class="ln-brass-fill" d="M66 231h8l-4 13Z" />
                <circle class="ln-brass-fill" cx="70" cy="247" r="3.1" />
              </g>
            </svg>"""


def render(lang, a=""):
    """The control. `aria-pressed` carries the state; the label and the tooltip
    are swapped by assets/lantern.js, which reads both from the data-* pairs so
    this file stays the only place the words live."""
    t = UI[lang]
    return (
        '          <button\n'
        '            class="lantern"\n'
        '            type="button"\n'
        '            aria-pressed="false"\n'
        '            aria-label="%s"\n'
        '            title="%s"\n'
        '            data-to-dark="%s"\n'
        '            data-to-light="%s"\n'
        '            data-tip-dark="%s"\n'
        '            data-tip-light="%s"\n'
        '          >\n'
        '            <span class="ln-spill" aria-hidden="true"></span>\n'
        '            <span class="ln-halo" aria-hidden="true"></span>\n'
        '            <span class="ln-bloom" aria-hidden="true"></span>\n'
        '            %s\n'
        '          </button>\n'
        % (esc(t["toDark"]), esc(t["tipDark"]), esc(t["toDark"]), esc(t["toLight"]),
           esc(t["tipDark"]), esc(t["tipLight"]), SVG))


def host(lang, a=""):
    """The lantern and the box it hangs in, exactly as every page opens.

    This block is the first thing inside <main>'s shell on all twenty-seven
    pages, which is the whole trick: the shell is the same width and starts at
    the same height everywhere, so the lantern lands in the same place on the
    home page, a policy and an article without one per-page coordinate. The
    box is a positioning anchor and not a layout row - the stylesheet gives it
    no height - so nothing underneath it moves down to make room.

    The markers are what tools/write_en.py replaces on the hand-written
    English originals, so they must survive round trips unchanged."""
    return ('        <!-- lantern:start -->\n'
            '        <div class="lantern-host">\n'
            + render(lang, a) +
            '        </div>\n'
            '        <!-- lantern:end -->\n')


# The one line that decides the theme before anything paints. It runs in <head>,
# before the stylesheet has drawn a single cream pixel, so a visitor who chose
# dark never sees the light page flash first.
BOOT = ('    <script>(function(){try{var t=localStorage.getItem("zulfaa-site-theme");'
        'if(t==="dark"||t==="light")document.documentElement.setAttribute("data-site-theme",t)}'
        'catch(e){}})();</script>')
