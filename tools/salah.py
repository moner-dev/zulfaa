# -*- coding: utf-8 -*-
"""The homepage Salah section: a living scene of the day with a small prayer-focus interface over it.

ONE SOURCE FOR THREE PAGES, like the showcase: home.py renders this into /ar/ and /nl/, and the hand-written English
index.html receives the same markup through tools/write_en.py (marked region <!-- salah:start/end -->).

TWO LAYERS, KEPT APART ON PURPOSE.
  .salah-scene   the WebGL canvas (the approved, locked scene engine in assets/salah/engine, synced by
                 tools/salah_sync.py) over a poster that is also the fallback without WebGL or scripting;
  .salah-ui      ordinary HTML: the prayer focus, the day line, the location chip, today's times, the city picker.
No text is ever drawn into the scene, and the interface never touches the sun. Both read one timing model
(assets/salah/day-model.js).

SIX CONTEXTUAL STATES, ONE COMPONENT FAMILY. The section carries data-phase="fajr|sunrise|dhuhr|asr|maghrib|isha";
the stylesheet turns that into a restrained tint, and into which of the six small icons below is shown. Sunrise is a
milestone of the day, not a prayer: it is on the day line and in the list, marked as such, and never the "next prayer".

WORDS live in tools/salah_strings.py and reach the script as JSON embedded in the section - the script has none.
"""
import html
import json

import salah_runtime
from salah_strings import T

ENABLED = True  # False removes the section from all three homepages on the next build
POINTS = ("fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha")

_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">%s</svg>'
ICONS = {
    # first light: a thin crescent still up, the horizon beginning to glow
    "fajr": '<path d="M15.5 4.2a5 5 0 1 0 4.3 7.3 4.2 4.2 0 0 1-4.3-7.3Z"/><path d="M3 18.5h18"/><path d="M7 21.5h10"/>',
    "sunrise": '<path d="M6.5 17a5.5 5.5 0 0 1 11 0"/><path d="M3 17h2M19 17h2M12 6.5V9M5.6 10.6l1.5 1.5M18.4 10.6l-1.5 1.5"/><path d="M8 20.5h8"/>',
    "dhuhr": '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
    "asr": '<circle cx="14.5" cy="9.5" r="3.6"/><path d="M14.5 2.8v1.7M21.2 9.5h-1.7M19.2 4.8 18 6M9.8 4.8 11 6M7.8 9.5h1.7"/><path d="M3 18.5h18"/><path d="M9 18.5 4.5 21.5"/>',
    "maghrib": '<path d="M6.5 16a5.5 5.5 0 0 1 11 0"/><path d="M3 16h18"/><path d="M12 5.5V8M5.6 9.6l1.5 1.5M18.4 9.6l-1.5 1.5"/><path d="M6 19.5h12M9 22.5h6"/>',
    "isha": '<path d="M14.8 3.6a7.4 7.4 0 1 0 5.6 12.6A6.4 6.4 0 0 1 14.8 3.6Z"/><path d="m18.6 5.2.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5Z"/>',
    "pin": '<path d="M12 21s6.5-5.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.6 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.3"/>',
    "list": '<path d="M8 7h11M8 12h11M8 17h11"/><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01"/>',
    "close": '<path d="m6 6 12 12M18 6 6 18"/>',
    "search": '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.4-4.4"/>',
}


def icon(name, cls=""):
    return (_SVG % ICONS[name]).replace("<svg ", '<svg class="%s" ' % cls, 1) if cls else _SVG % ICONS[name]


def render_salah(lang, a=""):
    if not ENABLED:
        return ""
    t, e = T[lang], html.escape
    names = t["names"]
    phase_icons = "".join(icon(p, "salah-ico salah-ico-%s" % p) for p in POINTS)
    line = "\n".join(
        '                  <li class="salah-point%s" data-point="%s"><span class="salah-dot" aria-hidden="true"></span>'
        '<span class="salah-point-name">%s</span></li>' % (" is-milestone" if p == "sunrise" else "", p, e(names[p])) for p in POINTS)
    rows = "\n".join(
        '                  <li class="salah-row%s" data-row="%s"><span class="salah-row-name">%s</span>'
        '<time class="salah-row-time" data-salah-time="%s">--:--</time></li>'
        % (" is-milestone" if p == "sunrise" else "", p, e(names[p]), p) for p in POINTS)
    words = json.dumps({k: v for k, v in t.items() if k not in ("eyebrow", "title", "note", "noScript")}, ensure_ascii=False)
    words = words.replace("</", "<\\/")  # never let a string close the script element
    # everything the section loads comes from ONE content-addressed folder (tools/salah_runtime.py): the folder name is
    # the version, so the stylesheet, the entry module, every module it imports and every scene asset change together
    rt = salah_runtime.build()
    return f'''        <!-- salah:start -->
        <link rel="stylesheet" href="{a}{rt}salah.css" />
        <section class="salah" id="prayer-times" aria-labelledby="salah-title" data-salah data-phase="dhuhr" data-status="next" data-lang="{lang}" data-assets="{a}{rt}">
          <div class="shell salah-head">
            <p class="salah-eyebrow">{e(t["eyebrow"])}</p>
            <h2 id="salah-title">{e(t["title"])}</h2>
            <p class="salah-note">{e(t["note"])}</p>
          </div>

          <div class="salah-stage">
            <!-- layer 1: the scene. One canvas; the poster is the placeholder and the fallback. -->
            <div class="salah-scene">
              <img class="salah-poster" src="{a}{rt}poster/dhuhr.webp" width="1280" height="548" alt="{e(t["sceneAlt"])}" loading="lazy" decoding="async" data-salah-poster />
              <canvas class="salah-canvas" aria-hidden="true" data-salah-canvas></canvas>
            </div>

            <!-- layer 2: the interface. Plain HTML over the scene; never drawn into it. -->
            <div class="salah-ui" data-salah-ui hidden>
              <div class="salah-focus salah-glass" role="group" aria-labelledby="salah-name">
                <p class="salah-badge"><span class="salah-icons">{phase_icons}</span><span data-salah-text="status">{e(t["next"])}</span></p>
                <p class="salah-name" id="salah-name" data-salah-text="name">{e(names["dhuhr"])}</p>
                <p class="salah-time"><time data-salah-text="time">--:--</time></p>
                <p class="salah-countdown" data-salah-text="countdown">&nbsp;</p>
                <ol class="salah-line" aria-label="{e(t["dayLine"])}" data-salah-line>
{line}
                  <li class="salah-marker" aria-hidden="true" data-salah-marker></li>
                </ol>
                <div class="salah-actions">
                  <button class="salah-chip" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="salah-places" data-salah-open="places">{icon("pin")}<span data-salah-text="place">&nbsp;</span><span class="vh"> - {e(t["changePlace"])}</span></button>
                  <button class="salah-chip" type="button" aria-expanded="false" aria-controls="salah-times" data-salah-open="times">{icon("list")}<span data-salah-text="timesToggle">{e(t["todaysTimes"])}</span></button>
                </div>
              </div>

              <div class="salah-panel salah-glass" id="salah-times" data-salah-panel="times" hidden>
                <div class="salah-panel-head">
                  <h3 data-salah-text="timesTitle">{e(t["todaysTimes"])}</h3>
                  <button class="salah-x" type="button" aria-label="{e(t["close"])}" data-salah-close>{icon("close")}</button>
                </div>
                <ol class="salah-rows">
{rows}
                </ol>
                <p class="salah-fine">{e(t["sunriseNote"])}</p>
                <p class="salah-fine" data-salah-text="methodNote">{e(t["methodNote"])}</p>
              </div>

              <div class="salah-panel salah-glass" id="salah-places" role="dialog" aria-labelledby="salah-places-title" data-salah-panel="places" hidden>
                <div class="salah-panel-head">
                  <h3 id="salah-places-title">{e(t["chooseCity"])}</h3>
                  <button class="salah-x" type="button" aria-label="{e(t["close"])}" data-salah-close>{icon("close")}</button>
                </div>
                <label class="salah-search">{icon("search")}<span class="vh">{e(t["searchCity"])}</span>
                  <input type="search" placeholder="{e(t["searchCity"])}" autocomplete="off" spellcheck="false" data-salah-search /></label>
                <ul class="salah-cities" data-salah-cities></ul>
                <p class="salah-fine" data-salah-text="placeSource">&nbsp;</p>
                <button class="salah-link" type="button" data-salah-timezone>{e(t["useTimeZone"])}</button>
              </div>

              <p class="vh" aria-live="polite" data-salah-text="announce"></p>
            </div>
            <noscript><p class="salah-noscript">{e(t["noScript"])}</p></noscript>
          </div>
          <script type="application/json" data-salah-words>{words}</script>
        </section>
        <script type="module" src="{a}{rt}salah-section.js"></script>
        <!-- salah:end -->
'''
