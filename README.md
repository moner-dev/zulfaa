# ZULFAA — official website

The public website for **ZULFAA**, an Islamic app bringing together prayer times, the Qur'an,
adhkar and du'as, and qibla direction.

Live at <https://zulfaa.nl/>

| Page | URL |
| --- | --- |
| Home | <https://zulfaa.nl/> |
| Privacy Policy | <https://zulfaa.nl/privacy/> |
| Terms of Use | <https://zulfaa.nl/terms/> |
| Support | <https://zulfaa.nl/support/> |

## About this repository

Static HTML and CSS, served by GitHub Pages from the `main` branch at the repository root.
There is no build step: the files here are the files that are served.

- Two small scripts of our own and nothing else: `assets/nav.js` (the side drawer and the
  language menu) and `assets/carousel.js` (the screenshot lightbox). Every
  page, including the Privacy Policy, is fully readable and fully navigable with scripting
  disabled: the header then renders its links inline.
- No third-party requests. The typefaces (Fredoka, Plus Jakarta Sans and Cairo, all under the
  SIL Open Font License — see `assets/fonts/OFL.txt`) are served from this repository.
- No advertising, no analytics, no tracking pixels and no cookies.

The palette and typefaces are the app's own design tokens. The emblem is the ZULFAA brand mark.

## Editing

Content lives in four files:

```
index.html          landing page
privacy/index.html  Privacy Policy
terms/index.html    Terms of Use
support/index.html  Support and FAQ
assets/zulfaa.css   the single stylesheet
assets/nav.js       side drawer + language menu (progressive enhancement)
tools/              generator for ar/ and nl/, and tools/responsive_check.mjs
```

The header (menu button, primary links, language menu) is rendered by `tools/build.py` on all
fifteen pages, the English originals included, so change it in `tools/chrome.py`, never by hand.

Below 1100px the primary nav and the language switcher move into a side drawer that slides in
from the reading end - the right in English and Dutch, the left in Arabic - over a backdrop. It
closes on the close button, the backdrop, Escape, or following a link, keeps Tab inside itself
while open, and holds the page still behind it. Above that width the same markup is laid out as
the ordinary inline header: `.drawer` is `display: contents` there, so there is one set of links
and no duplicate URLs. Inside the drawer the language switcher is a compact segmented row rather
than a menu inside a menu, and `nav.js` drops the menu semantics with the button.
`node tools/responsive_check.mjs` renders every page in headless Chrome at seven widths and
fails on any horizontal overflow; add `--nojs` to check the pages with scripting disabled.

The Privacy Policy and the Terms of Use mirror the documents shown inside the app. When either
changes in the app, change it here too and update the "Last updated" date at the top of the page.

## Rights

ZULFAA, its name, emblem, design and original graphics are the property of
**MONER INTELLIGENCE SYSTEMS**. The religious content referred to in the app remains with its
rights holders, as credited on the app's sources page.
