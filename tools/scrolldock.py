# -*- coding: utf-8 -*-
"""The scroll dock: two arrows, bottom-right, on every page.

WHAT IT IS. A small pair of buttons that take the reader to the top of the page
or to the start of the footer in one press, rather than a viewport at a time.
It is rendered by chrome.footer(), so every generated page gets it from one
place; the hand-written English pages receive the same block through the
markers below (tools/write_en.py).

WHAT IT IS NOT. It is not a scroll spy, it does not animate on its own, and it
never takes the scroll away from the reader: the buttons call
window.scrollTo() once and nothing listens to the wheel or to touch.

The arrows are decorative, so they are aria-hidden and the button carries the
name. `aria-disabled` rather than `disabled` is deliberate - see assets/…js -
because a `disabled` button drops focus on the floor the moment the reader
scrolls with the keyboard."""
import html

UI = {
    "en": {"up": "Back to top", "down": "Skip to the footer"},
    "ar": {"up": "العودة إلى أعلى الصفحة", "down": "الانتقال إلى تذييل الصفحة"},
    "nl": {"up": "Terug naar boven", "down": "Naar de voettekst"},
}

ARROW_UP = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
            '<path d="M12 19V6M6 12l6-6 6 6"/></svg>')
ARROW_DOWN = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" '
              'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
              '<path d="M12 5v13M6 12l6 6 6-6"/></svg>')


def esc(s):
    return html.escape(s, quote=True)


def render(lang):
    t = UI[lang]
    return (
        '    <!-- scrolldock:start -->\n'
        '    <div class="dock" data-dock hidden>\n'
        '      <button class="dock-btn" type="button" data-dock-up aria-label="%s" title="%s">\n'
        '        %s\n'
        '      </button>\n'
        '      <button class="dock-btn" type="button" data-dock-down aria-label="%s" title="%s">\n'
        '        %s\n'
        '      </button>\n'
        '    </div>\n'
        '    <!-- scrolldock:end -->\n'
        % (esc(t["up"]), esc(t["up"]), ARROW_UP,
           esc(t["down"]), esc(t["down"]), ARROW_DOWN))
